/**
 * Wave 2 P0: Online socketing (#1830), Horadric Cube transmute (#1829), and player-to-player safe trade (#1785).
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { CANONICAL_RUNES_TABLE } from '../../src/common/items/runeword.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import * as Netproto from '../../src/netproto/index.ts'
import * as Server from '../../src/server/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { QUEST_FLAG_COMPLETED_113C, setQuestFlag113c } from '../../src/server/engine/quests-113c.ts'
import {
  ENABLED_CUBEMAIN_RECIPES_113C,
  ALL_CUBEMAIN_ROWS_113C,
} from '../../src/server/items/cubemain-data-113c.ts'
import {
  executeSocketItem113c,
  resolveGemSocketItemStats113c,
} from '../../src/server/items/cube-engine-113c.ts'
import { readD2sSave113c } from '../../src/server/save/d2s-reader.ts'
import {
  TRADE_ACCEPT_LOCKOUT_FRAMES_113C,
  planInventoryPlacements113c,
} from '../../src/server/net/trade-manager-113c.ts'

type Loc = 'inventory' | 'stash' | 'cube' | 'cursor' | 'trade'

interface Internal {
  groundItems: Map<number, { totalSockets: number; socketed: boolean; quality: number }>
  players: Map<number, { items: { unitId: number; location: string; x: number; y: number }[]; questFlags: Uint16Array; gold: number; level: number }>
}

function internal(game: GameInstance): Internal {
  return game as unknown as Internal
}

function newGame(seed: number, mode: 'realm' | 'sp' = 'realm'): GameInstance {
  return new GameInstance({ mode, seed, areaId: 1 })
}

function connect(game: GameInstance, name: string, x: number, extra: Record<string, unknown> = {}): number {
  const id = game.connectPlayer({ charClass: 'pal', name, x, y: 100, areaId: 1, level: 40, ...extra })
  game.drainEvents(id)
  return id
}

function give(
  game: GameInstance,
  pid: number,
  code: string,
  loc: Loc,
  x = 0,
  y = 0,
  patch: Partial<{ totalSockets: number; quality: number }> = {},
): number {
  const id = game.spawnGroundItem({ code, x: 100, y: 100, areaId: 1 })
  Object.assign(internal(game).groundItems.get(id)!, patch)
  game.enqueueCommand(pid, { type: 'ItemPickup', itemId: id, toCursor: true })
  game.stepFrame()
  if (loc !== 'cursor') {
    const buffer = loc === 'stash' ? 4 : loc === 'cube' ? 3 : loc === 'trade' ? 2 : 0
    game.enqueueCommand(pid, { type: 'ItemPlace', itemId: id, x, y, buffer })
    game.stepFrame()
  }
  return id
}

function itemOf(game: GameInstance, pid: number, itemId: number) {
  return game.getPlayerState(pid)!.items.find((i) => i.unitId === itemId)
}

function tradeActions(events: readonly Netproto.ServerEvent[]): number[] {
  return events.filter((e) => e.type === 'Trade').map((e) => (e as { action: number }).action)
}

function click(game: GameInstance, pid: number, buttonId: number, amount?: number): void {
  game.enqueueCommand(pid, { type: 'ClickButton', buttonId, ...(amount !== undefined ? { amount } : {}) })
}

function openTrade(game: GameInstance, a: number, b: number): void {
  game.enqueueCommand(a, { type: 'Interact', target: { unitType: 0, id: b } })
  game.stepFrame()
  click(game, b, 0x03)
  game.stepFrame()
}

describe('Wave 2 P0 #1830: C2S 0x28 SocketItem + Gems.txt gemapplytype + Runes.txt runewords', () => {
  it('resolves slot-specific Gems.txt mods (weapon vs helm vs shield)', () => {
    const weapon = resolveGemSocketItemStats113c({ code: 'gcr', stats: [] }, 'ssd')
    const helm = resolveGemSocketItemStats113c({ code: 'gcr', stats: [] }, 'cap')
    const shield = resolveGemSocketItemStats113c({ code: 'gcr', stats: [] }, 'buc')
    expect(weapon.length).toBeGreaterThan(0)
    expect(helm.length).toBeGreaterThan(0)
    expect(shield.length).toBeGreaterThan(0)
    // Chipped Ruby: weapon fire-min/max (48/49), helm +10 life (7 << 8), shield +12% fire resist (39).
    expect(weapon).toEqual([
      { statId: 48, param: 0, value: 3 },
      { statId: 49, param: 0, value: 4 },
    ])
    expect(helm).toEqual([{ statId: 7, param: 0, value: 2560 }])
    expect(shield).toEqual([{ statId: 39, param: 0, value: 12 }])
    expect(JSON.stringify(weapon)).not.toBe(JSON.stringify(helm))
    expect(JSON.stringify(helm)).not.toBe(JSON.stringify(shield))
  })

  it('sockets a gem from the cursor into an inventory helm and applies helmMods', () => {
    const game = newGame(0x18300001)
    const pid = connect(game, 'Socketer', 100)
    const helm = give(game, pid, 'cap', 'inventory', 0, 0, { totalSockets: 2 })
    const gem = give(game, pid, 'gcr', 'cursor')
    game.drainEvents(pid)

    game.enqueueCommand(pid, { type: 'SocketItem', itemId: gem, targetItemId: helm })
    game.stepFrame()
    const events = game.drainEvents(pid)

    const host = itemOf(game, pid, helm)!
    expect(host.socketedItems.map((c) => c.unitId)).toEqual([gem])
    expect(game.getPlayerState(pid)!.items.some((i) => i.unitId === gem)).toBe(false)
    expect(host.stats.get(7)).toBe(2560)
    expect(host.stats.has(48)).toBe(false)
    const types = events.map((e) => e.type)
    expect(types).toContain('CursorClear')
    const socketEv = events.find(
      (e) => e.type === 'ItemEvent' && (e as { action: unknown }).action === 0x0a,
    ) as { container: string; ownerId: number } | undefined
    expect(socketEv?.container).toBe('socket')
    expect(socketEv?.ownerId).toBe(helm)
    expect(
      events.some((e) => e.type === 'ItemEvent' && (e as { action: unknown }).action === 0x15),
    ).toBe(true)
  })

  it('completes the Stealth runeword (Tal + Eth) in a 2-socket normal body armor', () => {
    const game = newGame(0x18300002)
    const pid = connect(game, 'Runer', 100)
    const armor = give(game, pid, 'qui', 'inventory', 0, 0, { totalSockets: 2 })
    const tal = give(game, pid, 'r07', 'cursor')
    game.enqueueCommand(pid, { type: 'SocketItem', itemId: tal, targetItemId: armor })
    game.stepFrame()
    expect(itemOf(game, pid, armor)!.rawItemData?.runeword ?? false).toBe(false)
    const eth = give(game, pid, 'r05', 'cursor')
    game.enqueueCommand(pid, { type: 'SocketItem', itemId: eth, targetItemId: armor })
    game.stepFrame()
    const host = itemOf(game, pid, armor)!
    expect(host.socketedItems).toHaveLength(2)
    expect(host.rawItemData?.runeword).toBe(true)
    expect((host.rawItemData?.runewordStats ?? []).length).toBeGreaterThan(0)

    // Full socket: a third filler is rejected without consuming it.
    const extra = give(game, pid, 'r01', 'cursor')
    game.enqueueCommand(pid, { type: 'SocketItem', itemId: extra, targetItemId: armor })
    game.stepFrame()
    expect(itemOf(game, pid, extra)?.location).toBe('cursor')
    expect(itemOf(game, pid, armor)!.socketedItems).toHaveLength(2)
  })

  it('rejects socketing an equipped host when the resulting level requirement exceeds clvl', () => {
    const game = newGame(0x18300003)
    const pid = connect(game, 'LowLvl', 100, { level: 1 })
    const armor = give(game, pid, 'qui', 'inventory', 0, 0, { totalSockets: 2 })
    game.enqueueCommand(pid, { type: 'ItemEquip', itemId: armor, slot: 3 })
    game.stepFrame()
    expect(itemOf(game, pid, armor)!.location).toBe('equipped')
    const ber = give(game, pid, 'r30', 'cursor')
    game.enqueueCommand(pid, { type: 'SocketItem', itemId: ber, targetItemId: armor })
    game.stepFrame()
    expect(itemOf(game, pid, ber)?.location).toBe('cursor')
    expect(itemOf(game, pid, armor)!.socketedItems).toHaveLength(0)
  })

  it('gates server=1 ladder runewords on the ladder flag', () => {
    const ladderRw = CANONICAL_RUNES_TABLE.ladder.find(
      (r) => r.complete && r.itypes.includes('tors') && r.runes.length <= 4,
    )
    expect(ladderRw).toBeDefined()
    const run = (isLadder: boolean): boolean => {
      let host: Netproto.ItemData = {
        id: 1 as Netproto.UnitId,
        code: 'aar',
        quality: 2,
        identified: true,
        socketed: true,
        totalSockets: ladderRw!.runes.length,
        stats: [],
        socketedItems: [],
      } as unknown as Netproto.ItemData
      let ok = true
      ladderRw!.runes.forEach((rune, i) => {
        const res = executeSocketItem113c({
          host,
          filler: { id: (10 + i) as Netproto.UnitId, code: rune, quality: 2, identified: true, stats: [] } as unknown as Netproto.ItemData,
          rng: new D2Rng(77),
          playerLevel: 99,
          isHostEquipped: false,
          isLadder,
        })
        if (!res.ok) ok = false
        else host = res.hostItem
      })
      return ok && Boolean(host.runeword)
    }
    expect(run(false)).toBe(false)
    expect(run(true)).toBe(true)
  })
})

describe('Wave 2 P0 #1829: Horadric Cube 0x2A ItemToCube + 0x4F 0x18 transmute', () => {
  it('ships exactly 146 enabled Cubemain.txt recipes out of 151 rows', () => {
    expect(ALL_CUBEMAIN_ROWS_113C.length).toBe(151)
    expect(ENABLED_CUBEMAIN_RECIPES_113C.length).toBe(146)
  })

  it('places items via ItemToCube, rejects the cube inside itself, and transmutes 3 chipped gems', () => {
    const game = newGame(0x18290001)
    const pid = connect(game, 'Cuber', 100)
    const cube = give(game, pid, 'box', 'inventory', 0, 0)
    const gems: number[] = []
    for (let i = 0; i < 3; i++) {
      const g = give(game, pid, 'gcv', 'cursor')
      game.enqueueCommand(pid, { type: 'ItemToCube', itemId: g, cubeId: cube })
      game.stepFrame()
      expect(itemOf(game, pid, g)!.location).toBe('cube')
      expect(itemOf(game, pid, g)!.storePage).toBe(4)
      gems.push(g)
    }
    game.drainEvents(pid)
    click(game, pid, 0x18)
    game.stepFrame()
    const items = game.getPlayerState(pid)!.items.filter((i) => i.location === 'cube')
    expect(items.map((i) => i.code)).toEqual(['gfv'])
    for (const g of gems) expect(itemOf(game, pid, g)).toBeUndefined()
    const events = game.drainEvents(pid)
    expect(
      events.filter((e) => e.type === 'ItemEvent' && (e as { action: unknown }).action === 0x05),
    ).toHaveLength(3)
  })

  it('upgrades 3 El runes into Eld and leaves non-matching contents untouched', () => {
    const game = newGame(0x18290002)
    const pid = connect(game, 'RuneCuber', 100)
    give(game, pid, 'box', 'inventory', 0, 0)
    for (let i = 0; i < 3; i++) give(game, pid, 'r01', 'cube', i, 0)
    click(game, pid, 0x18)
    game.stepFrame()
    expect(game.getPlayerState(pid)!.items.filter((i) => i.location === 'cube').map((i) => i.code)).toEqual(['r02'])

    const lone = give(game, pid, 'rin', 'cube', 1, 1)
    click(game, pid, 0x18)
    game.stepFrame()
    expect(itemOf(game, pid, lone)?.location).toBe('cube')
  })

  it('opens the Cow Level portal (classId 60 -> area 39) only after Baal and only in Rogue Encampment', () => {
    const game = newGame(0x18290003)
    const pid = connect(game, 'Cowboy', 100)
    give(game, pid, 'box', 'inventory', 0, 0)
    give(game, pid, 'leg', 'cube', 0, 0)
    give(game, pid, 'tbk', 'cube', 1, 0)
    click(game, pid, 0x18)
    game.stepFrame()
    expect(game.getPlayerState(pid)!.items.filter((i) => i.location === 'cube')).toHaveLength(2)

    setQuestFlag113c(internal(game).players.get(pid)!.questFlags, 'a5q6', QUEST_FLAG_COMPLETED_113C)
    game.drainEvents(pid)
    click(game, pid, 0x18)
    game.stepFrame()
    expect(game.getPlayerState(pid)!.items.filter((i) => i.location === 'cube')).toHaveLength(0)
    const portal = game
      .drainEvents(pid)
      .find((e) => e.type === 'UnitAssign' && (e as { classId?: number }).classId === 60)
    expect(portal).toBeDefined()
  })
})

describe('Wave 2 P0 #1785: player-to-player safe trade', () => {
  it('plans 10x4 placements atomically', () => {
    expect(planInventoryPlacements113c([], [{ unitId: 1, width: 2, height: 4 }])).not.toBeNull()
    const full = Array.from({ length: 40 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10), width: 1, height: 1 }))
    expect(planInventoryPlacements113c(full, [{ unitId: 1, width: 1, height: 1 }])).toBeNull()
  })

  it('is disabled in single-player policy', () => {
    const game = newGame(0x17850000, 'sp')
    const a = connect(game, 'Solo', 100)
    expect(game.policy.allowPlayerTrade).toBe(false)
    game.enqueueCommand(a, { type: 'Interact', target: { unitType: 0, id: a + 1 } })
    game.stepFrame()
    expect(tradeActions(game.drainEvents(a))).toEqual([])
  })

  it('opens a town trade, mirrors offers, exchanges gold + items atomically, and completes with 0x0D', () => {
    const game = newGame(0x17850001)
    const a = connect(game, 'Alice', 100, { gold: 5000 })
    const b = connect(game, 'Bob', 102, { gold: 1000 })
    game.enqueueCommand(a, { type: 'Interact', target: { unitType: 0, id: b } })
    game.stepFrame()
    expect(tradeActions(game.drainEvents(a))).toContain(0x00)
    expect(tradeActions(game.drainEvents(b))).toContain(0x01)
    click(game, b, 0x03)
    game.stepFrame()
    expect(tradeActions(game.drainEvents(a))).toContain(0x78)
    expect(tradeActions(game.drainEvents(b))).toContain(0x78)

    const ring = give(game, a, 'rin', 'trade', 0, 0)
    expect(itemOf(game, a, ring)!.location).toBe('trade')
    const bEvents = game.drainEvents(b)
    const mirror = bEvents.find(
      (e) => e.type === 'ItemEvent' && (e as { container: string }).container === 'tradePartner',
    ) as { item: Netproto.ItemData } | undefined
    expect(mirror?.item.storePage).toBe(2)
    expect(tradeActions(bEvents)).toContain(0x06)

    click(game, a, 0x08, 500)
    game.stepFrame()
    expect(game.drainEvents(b).some((e) => e.type === 'Trade' && (e as { action: number }).action === 0x7900)).toBe(true)

    click(game, a, 0x04)
    click(game, b, 0x04)
    game.stepFrame()
    expect(tradeActions(game.drainEvents(a))).toContain(0x0d)
    expect(tradeActions(game.drainEvents(b))).toContain(0x0d)
    expect(itemOf(game, a, ring)).toBeUndefined()
    const moved = itemOf(game, b, ring)!
    expect(moved.location).toBe('inventory')
    expect(moved.ownerId).toBe(b)
    expect(game.getPlayerState(a)!.gold).toBe(4500)
    expect(game.getPlayerState(b)!.gold).toBe(1500)
  })

  it('rejects untradable quest items and the Horadric Cube', () => {
    const game = newGame(0x17850002)
    const a = connect(game, 'Quester', 100)
    const b = connect(game, 'Other', 102)
    openTrade(game, a, b)
    const box = give(game, a, 'box', 'trade', 0, 0)
    expect(itemOf(game, a, box)!.location).toBe('cursor')
  })

  it('engages the 75-frame anti-scam lockout when an offered item is pulled after a checkmark', () => {
    const game = newGame(0x17850003)
    const a = connect(game, 'Scammer', 100)
    const b = connect(game, 'Victim', 102)
    openTrade(game, a, b)
    const ring = give(game, a, 'rin', 'trade', 0, 0)
    click(game, b, 0x04)
    game.stepFrame()
    game.drainEvents(a)
    game.drainEvents(b)

    game.enqueueCommand(a, { type: 'ItemToCursor', itemId: ring })
    game.stepFrame()
    const bEvents = game.drainEvents(b)
    expect(tradeActions(bEvents)).toContain(0x0e)
    expect(
      bEvents.some(
        (e) =>
          e.type === 'ItemEvent' &&
          (e as { action: unknown }).action === 0x05 &&
          (e as { container: string }).container === 'tradePartner',
      ),
    ).toBe(true)

    click(game, b, 0x04)
    game.stepFrame()
    expect(tradeActions(game.drainEvents(b))).not.toContain(0x04)

    game.stepFrames(TRADE_ACCEPT_LOCKOUT_FRAMES_113C)
    expect(tradeActions(game.drainEvents(b))).toContain(0x0f)
    click(game, b, 0x04)
    game.stepFrame()
    expect(tradeActions(game.drainEvents(b))).toContain(0x04)
  })

  it('refuses the commit with 0x07/0x08 when the recipient inventory is full (no mutation)', () => {
    const game = newGame(0x17850004)
    const a = connect(game, 'Giver', 100)
    const b = connect(game, 'Hoarder', 102)
    for (let i = 0; i < 40; i++) give(game, b, 'rin', 'inventory', i % 10, Math.floor(i / 10))
    expect(game.getPlayerState(b)!.items.filter((i) => i.location === 'inventory')).toHaveLength(40)
    openTrade(game, a, b)
    const amu = give(game, a, 'amu', 'trade', 0, 0)
    click(game, a, 0x04)
    click(game, b, 0x04)
    game.stepFrame()
    expect(tradeActions(game.drainEvents(b))).toContain(0x07)
    expect(tradeActions(game.drainEvents(a))).toContain(0x08)
    expect(itemOf(game, a, amu)!.location).toBe('trade')
  })

  it('refuses the commit with 0x09/0x0A when gold would exceed clvl * 10000', () => {
    const game = newGame(0x17850005)
    const a = connect(game, 'Rich', 100, { gold: 400000 })
    const b = connect(game, 'Poor', 102, { level: 1, gold: 9000 })
    openTrade(game, a, b)
    click(game, a, 0x08, 5000)
    game.stepFrame()
    click(game, a, 0x04)
    click(game, b, 0x04)
    game.stepFrame()
    expect(tradeActions(game.drainEvents(b))).toContain(0x09)
    expect(game.getPlayerState(a)!.gold).toBe(400000)
    expect(game.getPlayerState(b)!.gold).toBe(9000)
  })

  it('returns all offered items on cancel and losslessly persists them on disconnect (.d2s)', () => {
    const game = newGame(0x17850006)
    const a = connect(game, 'Canceler', 100)
    const b = connect(game, 'Leaver', 102)
    openTrade(game, a, b)
    const ring = give(game, a, 'rin', 'trade', 0, 0)
    click(game, a, 0x02)
    game.stepFrame()
    expect(itemOf(game, a, ring)!.location).toBe('inventory')
    expect(tradeActions(game.drainEvents(b))).toContain(0x0c)

    openTrade(game, a, b)
    const amu = give(game, b, 'amu', 'trade', 0, 0)
    expect(itemOf(game, b, amu)!.location).toBe('trade')
    const saved = game.disconnectPlayer(b)!
    expect(tradeActions(game.drainEvents(a))).toContain(0x0c)
    const parsed = readD2sSave113c(saved)
    expect(parsed.items.some((i) => i.code.trim() === 'amu')).toBe(true)
  })
})

describe('Wave 2 P0 #1785/#1830 over MultiClientRoomHost (ts & d2gs)', () => {
  for (const protocol of ['ts', 'd2gs'] as const) {
    it(`mirrors partner trade offers and socket children into ClientWorld (${protocol})`, () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x17851000 + (protocol === 'd2gs' ? 1 : 0),
        areaId: 1,
      })
      const game = host.getGameInstance()
      const attach = (name: string, x: number) => {
        const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
        const roomSess = host.attachClient(serverStream, { charName: name, classId: 3, level: 30, x, y: 100, protocol })
        const adapter =
          protocol === 'd2gs'
            ? new Netproto.D2gsServerAdapter(clientStream)
            : new Netproto.TsServerAdapter(clientStream)
        const world = new ClientWorld()
        const session = new OnlineSession({ world })
        session.attachGameServer(adapter)
        return { roomSess, world, session }
      }
      const alice = attach('AliceNet', 100)
      const bob = attach('BobNet', 102)
      host.stepFrame()
      const a = alice.roomSess.playerUnitId
      const b = bob.roomSess.playerUnitId

      // Socket a chipped ruby into a helm and verify the client tracks it as a socket child.
      const helmId = game.spawnGroundItem({ code: 'cap', x: 100, y: 100, areaId: 1 })
      ;(game as unknown as Internal).groundItems.get(helmId)!.totalSockets = 2
      const gemId = game.spawnGroundItem({ code: 'gcr', x: 100, y: 100, areaId: 1 })
      host.stepFrame()
      alice.session.sendCommand({ type: 'ItemPickup', itemId: helmId, toCursor: true })
      host.stepFrame()
      alice.session.sendCommand({ type: 'ItemPlace', itemId: helmId, x: 0, y: 0, buffer: 0 })
      host.stepFrame()
      alice.session.sendCommand({ type: 'ItemPickup', itemId: gemId, toCursor: true })
      host.stepFrame()
      alice.session.sendCommand({ type: 'SocketItem', itemId: gemId, targetItemId: helmId })
      host.stepFrame()
      expect(alice.world.containers.cursor).toBeNull()
      expect(alice.world.containers.sockets.get(helmId)?.map((c) => c.id)).toEqual([gemId])

      // Trade: offer the socketed helm; Bob must see it in tradePartner with its socket child.
      alice.session.sendCommand({ type: 'Interact', target: { unitType: 0, id: b } })
      host.stepFrame()
      bob.session.sendCommand({ type: 'ClickButton', buttonId: 0x03 })
      host.stepFrame()
      alice.session.sendCommand({ type: 'ItemToCursor', itemId: helmId })
      host.stepFrame()
      alice.session.sendCommand({ type: 'ItemPlace', itemId: helmId, x: 0, y: 0, buffer: 2 })
      host.stepFrame()
      expect(bob.world.containers.tradePartner.has(helmId)).toBe(true)
      expect(bob.world.containers.sockets.get(helmId)?.map((c) => c.id)).toEqual([gemId])

      alice.session.sendCommand({ type: 'ClickButton', buttonId: 0x04 })
      bob.session.sendCommand({ type: 'ClickButton', buttonId: 0x04 })
      host.stepFrame()
      host.stepFrame()
      expect(bob.world.containers.inventory.has(helmId)).toBe(true)
      expect(bob.world.containers.tradePartner.size).toBe(0)
      expect(alice.world.containers.inventory.has(helmId)).toBe(false)
      expect(game.getPlayerState(b)!.items.find((i) => i.unitId === helmId)?.socketedItems).toHaveLength(1)
      expect(game.getPlayerState(a)!.items.some((i) => i.unitId === helmId)).toBe(false)

      alice.session.destroy()
      bob.session.destroy()
      host.close()
    })
  }
})
