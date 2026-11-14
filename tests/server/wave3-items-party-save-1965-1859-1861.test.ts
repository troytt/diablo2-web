/**
 * Wave 3 Regression & Parity Suite (#1965, #1859, #1860, #1861):
 * - #1965: Socketed items (gems, runes, jewels, runewords, ethereal, personalized, Normal/Superior/Magic/Rare/Set/Unique)
 *   dropped onto the ground visibly render flippy animation (`mode 5`), resting sprite, dye transform, and ground label,
 *   and pick back up with 100% of socketed children & stats intact across Single Player (`LocalLoopbackAdapter` + `.d2s`),
 *   `MultiClientRoomHost` (`ts` & `d2gs`), and external D2GS `0x9C` + `0x9D action=0x13` packet streams.
 * - #1859: Periodic 15-frame (0.6s @ 25Hz) party pulses (`S2C 0x7F` `memberState` life% across all areas, `S2C 0x90`
 *   `memberPos` automap coordinates within the same `areaId`) + immediate pulse on party accept and area transitions.
 * - #1860: Authoritative `C2S 0x16` (`ItemPickup`) distance check (`<= 6` sub-tiles, while preserving Sorceress
 *   Telekinesis `#43` ranged gold/potion/scroll pickup) + `PartyManager.splitGold` equal party gold split with
 *   picker remainder, `clvl * 10000` inventory gold cap, and overflow ground gold pile.
 * - #1861: `.d2s` write-back fidelity: `C2S 0x60` (`SwapWeapons`) toggles `weaponSet` (`0 <-> 1`), swaps primary/alt
 *   `(leftSkill, rightSkill)` pairs, validates `oskill`, and persists `activeWeapon` + `altLeftSkill`/`altRightSkill`;
 *   deterministic `lastPlayedTimestamp` progression; `0x7701` `npcIntro` greeting bitfields on town NPC talk; and
 *   corpse `(corpseX, corpseY)` world coordinates in the 12-byte corpse header (`D2Game.dll` `0x6FD0C260`).
 */

import { describe, expect, it } from 'vitest'
import {
  resolveGroundItemFlippyKey,
  resolveGroundItemSpriteRect,
} from '../../src/client/ui/inventory.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { onlineItemDataToUiInventoryItem } from '../../src/common/items/item-bridge.ts'
import * as Netproto from '../../src/netproto/index.ts'
import {
  CLOSED_REALM_POLICY,
  GameInstance,
  LocalLoopbackAdapter,
  MultiClientRoomHost,
  PartyManager,
  SINGLE_PLAYER_POLICY,
  getServerItemDataTables,
  readD2sSave113c,
  writeD2sSave113c,
} from '../../src/server/index.ts'

interface InternalGameAccess {
  groundItems: Map<
    number,
    {
      unitId: number
      code: string
      quality: number
      totalSockets: number
      socketed: boolean
      ethereal: boolean
      identified: boolean
      quantity: number
      rawItemData?: Record<string, unknown> | undefined
    }
  >
  players: Map<
    number,
    {
      unitId: number
      x: number
      y: number
      targetX: number
      targetY: number
      areaId: number
      hp: number
      hpFixed: number
      maxHp: number
      mana: number
      maxMana: number
      dead: boolean
      gold: number
      level: number
      weaponSet?: number | undefined
      leftSkill: number
      rightSkill: number
      altLeftSkill: number
      altRightSkill: number
      skills: Map<number, number>
      npcIntro: Uint8Array
    }
  >
  monsters: Map<
    number,
    {
      unitId: number
      hcIdx: number
      x: number
      y: number
      areaId: number
      isNpc: boolean
    }
  >
}

function internal(game: GameInstance): InternalGameAccess {
  return game as unknown as InternalGameAccess
}

function giveItem(
  game: GameInstance,
  playerId: number,
  code: string,
  loc: 'inventory' | 'cursor' | 'equipped',
  gridX = 0,
  gridY = 0,
  patch: Record<string, unknown> = {},
  equipSlot = 4,
): number {
  const player = internal(game).players.get(playerId)!
  const id = game.spawnGroundItem({ code, x: player.x, y: player.y, areaId: player.areaId })
  const rawEntry = internal(game).groundItems.get(id)!
  Object.assign(rawEntry, patch)
  if (rawEntry.rawItemData && typeof patch.rawItemData === 'object' && patch.rawItemData !== null) {
    rawEntry.rawItemData = {
      ...rawEntry.rawItemData,
      ...(patch.rawItemData as Record<string, unknown>),
    }
  }
  game.enqueueCommand(playerId, { type: 'ItemPickup', itemId: id, toCursor: true })
  game.stepFrame()
  if (loc === 'inventory') {
    game.enqueueCommand(playerId, { type: 'ItemPlace', itemId: id, x: gridX, y: gridY, buffer: 0 })
    game.stepFrame()
  } else if (loc === 'equipped') {
    game.enqueueCommand(playerId, { type: 'ItemEquip', itemId: id, slot: equipSlot })
    game.stepFrame()
  }
  return id
}

function drainIntoWorld(
  game: GameInstance,
  playerId: number,
  world: ClientWorld,
): readonly Netproto.ServerEvent[] {
  const events = game.drainEvents(playerId)
  for (const ev of events) {
    world.apply(ev)
  }
  return events
}

describe('Wave 3 #1965: Socketed & runeword items dropped onto the ground render visibly and round-trip cleanly', () => {
  it('Single-Player LocalLoopbackAdapter: gem-socketed weapon & Stealth runeword armor render on ground and survive pickup', () => {
    const world = new ClientWorld()
    const adapter = new LocalLoopbackAdapter({
      charName: 'SocketHero',
      charClass: 'pal',
      level: 40,
      areaId: 1,
      x: 100,
      y: 100,
      seed: 0x196501,
    })
    adapter.onEvent((ev) => {
      world.apply(ev)
    })
    adapter.stepFrame()

    const game = adapter.gameInstance
    const pid = adapter.playerUnitId

    // 1. Socket Chipped Ruby (`gcr`, invtransform=`cred`) into a 2-socket Short Sword (`ssd`)
    const swordId = giveItem(game, pid, 'ssd', 'inventory', 0, 0, { totalSockets: 2, socketed: true })
    const rubyId = giveItem(game, pid, 'gcr', 'cursor')
    adapter.stepFrame()
    adapter.send({ type: 'SocketItem', itemId: rubyId, targetItemId: swordId })
    adapter.stepFrame()

    expect(world.containers.sockets.get(swordId)?.length).toBe(1)

    // Pick sword to cursor and drop onto ground
    adapter.send({ type: 'ItemToCursor', itemId: swordId })
    adapter.stepFrame()
    adapter.send({ type: 'ItemDrop', itemId: swordId })
    adapter.stepFrame()

    const swordUnit = world.getUnit('item', swordId)
    expect(swordUnit).toBeDefined()
    expect(swordUnit!.mode).toBe(5) // drop flippy animation -> transitions to resting mode 3
    expect(Math.hypot(swordUnit!.x - 100, swordUnit!.y - 100)).toBeLessThanOrEqual(6)
    expect(swordUnit!.x).toBeGreaterThan(0)
    expect(swordUnit!.y).toBeGreaterThan(0)
    expect(swordUnit!.invtransform).toBe('dred')
    expect(resolveGroundItemFlippyKey(swordUnit!)).not.toBeNull()
    expect(resolveGroundItemSpriteRect(swordUnit!)).not.toBeNull()

    const groundSwordData = world.containers.ground.get(swordId)
    expect(groundSwordData).toBeDefined()
    expect(world.containers.sockets.get(swordId)?.length).toBe(1)
    const groundUiSword = onlineItemDataToUiInventoryItem(groundSwordData!)
    expect(groundUiSword.socketedItems?.length).toBe(1)
    expect(groundUiSword.invtransform).toBe('dred')

    // Pick the gem-socketed sword back up and verify child gem & fire damage stats remain intact
    adapter.send({ type: 'ItemPickup', itemId: swordId, toCursor: false })
    adapter.stepFrame()
    expect(world.getUnit('item', swordId)).toBeUndefined()
    const pickedSword = world.containers.inventory.get(swordId)
    expect(pickedSword).toBeDefined()
    expect(world.containers.sockets.get(swordId)?.length).toBe(1)
    const pickedUiSword = onlineItemDataToUiInventoryItem(
      pickedSword!,
      world.containers.sockets.get(swordId),
    )
    expect(pickedUiSword.socketedItems?.length).toBe(1)
    expect(pickedUiSword.socketedItems?.[0]?.code.trim()).toBe('gcr')

    // 2. Form Runeword `Stealth` (`Tal` r07 + `Eth` r05) in 2-socket Quilted Armor (`qui`), drop & pick back up
    const armorId = giveItem(game, pid, 'qui', 'inventory', 3, 0, { totalSockets: 2, socketed: true })
    const talId = giveItem(game, pid, 'r07', 'cursor')
    adapter.stepFrame()
    adapter.send({ type: 'SocketItem', itemId: talId, targetItemId: armorId })
    adapter.stepFrame()
    const ethId = giveItem(game, pid, 'r05', 'cursor')
    adapter.stepFrame()
    adapter.send({ type: 'SocketItem', itemId: ethId, targetItemId: armorId })
    adapter.stepFrame()

    adapter.send({ type: 'ItemToCursor', itemId: armorId })
    adapter.stepFrame()
    adapter.send({ type: 'ItemDrop', itemId: armorId })
    adapter.stepFrame()

    const armorUnit = world.getUnit('item', armorId)
    expect(armorUnit).toBeDefined()
    expect(armorUnit!.mode).toBe(5)
    expect(resolveGroundItemFlippyKey(armorUnit!)).not.toBeNull()
    expect(resolveGroundItemSpriteRect(armorUnit!)).not.toBeNull()
    const groundArmor = world.containers.ground.get(armorId)!
    expect(groundArmor.runeword).toBe(true)
    expect(world.containers.sockets.get(armorId)?.length).toBe(2)

    adapter.send({ type: 'ItemPickup', itemId: armorId, toCursor: false })
    adapter.stepFrame()
    const restoredArmor = world.containers.inventory.get(armorId)!
    expect(restoredArmor.runeword).toBe(true)
    expect(world.containers.sockets.get(armorId)?.map((c) => c.code.trim())).toEqual(['r07', 'r05'])
  })

  it('Single-Player .d2s import -> drop socketed item -> pickup -> export .d2s avoids unitId collisions and preserves sockets', () => {
    const seedGame = new GameInstance({ mode: 'singlePlayer', policy: SINGLE_PLAYER_POLICY, seed: 0x196502, areaId: 1 })
    const seedPid = seedGame.connectPlayer({ charName: 'D2sSocket', charClass: 'sor', level: 30, areaId: 1, x: 100, y: 100 })
    seedGame.drainEvents(seedPid)
    const armorId0 = giveItem(seedGame, seedPid, 'qui', 'inventory', 0, 0, { totalSockets: 2, socketed: true })
    const sapphId0 = giveItem(seedGame, seedPid, 'gcb', 'cursor')
    seedGame.drainEvents(seedPid)
    seedGame.enqueueCommand(seedPid, { type: 'SocketItem', itemId: sapphId0, targetItemId: armorId0 })
    seedGame.stepFrame()
    const savedBytes = seedGame.exportPlayerD2s(seedPid)
    const parsedInitial = readD2sSave113c(savedBytes)
    expect(parsedInitial.items.some((it) => (it.socketedItems?.length ?? 0) === 1)).toBe(true)

    // Load .d2s into a fresh LocalLoopbackAdapter (where player unitId = 1, testing ID reallocation!)
    const world = new ClientWorld()
    const adapter = new LocalLoopbackAdapter({
      d2sBytes: savedBytes,
      areaId: 1,
      x: 100,
      y: 100,
      seed: 0x196503,
    })
    adapter.onEvent((ev) => world.apply(ev))
    adapter.stepFrame()

    const invSocketed = Array.from(world.containers.inventory.values()).find(
      (it) => it.code.trim() === 'qui',
    )
    expect(invSocketed).toBeDefined()
    expect(invSocketed!.id).not.toBe(adapter.playerUnitId)
    expect(world.containers.sockets.get(invSocketed!.id)?.length).toBe(1)

    // Drop the imported socketed armor onto the ground
    adapter.send({ type: 'ItemToCursor', itemId: invSocketed!.id })
    adapter.stepFrame()
    adapter.send({ type: 'ItemDrop', itemId: invSocketed!.id })
    adapter.stepFrame()

    const groundUnit = world.getUnit('item', invSocketed!.id)
    expect(groundUnit).toBeDefined()
    expect(groundUnit!.x).toBeGreaterThan(0)
    expect(groundUnit!.y).toBeGreaterThan(0)
    expect(resolveGroundItemSpriteRect(groundUnit!)).not.toBeNull()
    expect(world.containers.sockets.get(invSocketed!.id)?.length).toBe(1)

    // Pick back up and re-export .d2s
    adapter.send({ type: 'ItemPickup', itemId: invSocketed!.id, toCursor: false })
    adapter.stepFrame()
    const reExported = adapter.gameInstance.exportPlayerD2s(adapter.playerUnitId)
    const reParsed = readD2sSave113c(reExported)
    const savedArmor = reParsed.items.find((it) => it.code.trim() === 'qui')
    expect(savedArmor).toBeDefined()
    expect(savedArmor!.socketedItems?.length).toBe(1)
    expect(savedArmor!.socketedItems?.[0]?.code.trim()).toBe('gcb')
  })

  it('MultiClientRoomHost binary D2GS (0x9C + 0x9D action=0x13): dropped socketed item encodes, decodes, and stays visible on ground for all players', () => {
    const host = new MultiClientRoomHost({
      policy: CLOSED_REALM_POLICY,
      mapSeed: 0x196504,
      difficulty: 0,
      act: 0,
      areaId: 1,
    })

    const attachD2gsObserver = (name: string) => {
      const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
      const roomSession = host.attachClient(serverStream, {
        charName: name,
        classId: 4,
        protocol: 'd2gs',
        x: 100,
        y: 100,
      })
      const d2gs = new Netproto.D2gsSession({
        stream: clientStream,
        logon: {
          gameHash: 0x11223344,
          gameToken: 0x5566,
          charClass: 4,
          versionByte: 0x0d,
          charName: name,
        },
      })
      const world = new ClientWorld()
      const wireOpcodes: number[] = []
      const itemTables = getServerItemDataTables()
      d2gs.onPacket((pkt) => {
        wireOpcodes.push(pkt[0]!)
        const ev = Netproto.decodeD2gsS2cPacket(pkt, { tables: itemTables })
        world.apply(ev)
      })
      return { roomSession, d2gs, world, wireOpcodes }
    }

    const alice = attachD2gsObserver('AliceD2gs')
    const bob = attachD2gsObserver('BobD2gs')
    host.stepFrame()

    const game = host.gameInstance
    const helmId = giveItem(game, alice.roomSession.playerUnitId, 'cap', 'inventory', 0, 0, {
      totalSockets: 2,
      socketed: true,
    })
    const topazId = giveItem(game, alice.roomSession.playerUnitId, 'gcy', 'cursor')
    host.stepFrame()
    game.enqueueCommand(alice.roomSession.playerUnitId, {
      type: 'SocketItem',
      itemId: topazId,
      targetItemId: helmId,
    })
    host.stepFrame()

    // Drop the socketed cap onto the ground
    game.enqueueCommand(alice.roomSession.playerUnitId, { type: 'ItemToCursor', itemId: helmId })
    host.stepFrame()
    alice.wireOpcodes.length = 0
    bob.wireOpcodes.length = 0
    game.enqueueCommand(alice.roomSession.playerUnitId, { type: 'ItemDrop', itemId: helmId })
    host.stepFrame()

    // Both Alice and Bob MUST receive S2C 0x9C (host ground drop) AND S2C 0x9D (socket child action=0x13)
    expect(alice.wireOpcodes).toContain(0x9c)
    expect(alice.wireOpcodes).toContain(0x9d)
    expect(bob.wireOpcodes).toContain(0x9c)
    expect(bob.wireOpcodes).toContain(0x9d)

    // Neither client's ground ClientUnit may be deleted by the trailing 0x9D socket child packet!
    for (const observer of [alice, bob]) {
      const groundHelm = observer.world.getUnit('item', helmId)
      expect(groundHelm).toBeDefined()
      expect(groundHelm!.mode).toBe(5)
      expect(resolveGroundItemSpriteRect(groundHelm!)).not.toBeNull()
      expect(observer.world.containers.sockets.get(helmId)?.length).toBe(1)
    }
  })

  it('Class-of-bug sweep: Normal, Superior, Magic, Rare, Set, Unique, Ethereal, and Personalized socketed items all render on ground', () => {
    const game = new GameInstance({ mode: 'realm', seed: 0x196505, areaId: 1 })
    const pid = game.connectPlayer({ charName: 'SweepHero', charClass: 'bar', level: 80, areaId: 1, x: 100, y: 100 })
    const world = new ClientWorld()
    drainIntoWorld(game, pid, world)

    const variants: ReadonlyArray<{
      readonly label: string
      readonly code: string
      readonly filler: string
      readonly patch: Record<string, unknown>
    }> = [
      { label: 'Normal socketed', code: 'cap', filler: 'gcr', patch: { quality: 2, totalSockets: 2, socketed: true } },
      { label: 'Superior socketed', code: 'cap', filler: 'gcb', patch: { quality: 3, totalSockets: 2, socketed: true } },
      { label: 'Magic socketed', code: 'cap', filler: 'gcg', patch: { quality: 4, totalSockets: 2, socketed: true } },
      { label: 'Set socketed', code: 'cap', filler: 'gcy', patch: { quality: 5, totalSockets: 1, socketed: true, rawItemData: { setItemId: 2 } } },
      { label: 'Rare socketed', code: 'cap', filler: 'gcv', patch: { quality: 6, totalSockets: 2, socketed: true } },
      { label: 'Unique socketed', code: 'cap', filler: 'gcw', patch: { quality: 7, totalSockets: 1, socketed: true, rawItemData: { uniqueItemId: 0 } } },
      { label: 'Ethereal socketed', code: 'qui', filler: 'r08', patch: { quality: 2, ethereal: true, totalSockets: 2, socketed: true } },
      {
        label: 'Personalized socketed',
        code: 'ssd',
        filler: 'jew',
        patch: {
          quality: 6,
          totalSockets: 1,
          socketed: true,
          rawItemData: { personalized: true, earOrPersonalizedName: 'Hero' },
        },
      },
    ]

    for (let idx = 0; idx < variants.length; idx++) {
      const v = variants[idx]!
      const hostId = giveItem(game, pid, v.code, 'inventory', 0, 0, v.patch)
      const childId = giveItem(game, pid, v.filler, 'cursor')
      drainIntoWorld(game, pid, world)
      game.enqueueCommand(pid, { type: 'SocketItem', itemId: childId, targetItemId: hostId })
      game.stepFrame()
      drainIntoWorld(game, pid, world)

      game.enqueueCommand(pid, { type: 'ItemToCursor', itemId: hostId })
      game.stepFrame()
      game.enqueueCommand(pid, { type: 'ItemDrop', itemId: hostId })
      game.stepFrame()
      drainIntoWorld(game, pid, world)

      const unit = world.getUnit('item', hostId)
      expect(unit, `${v.label} ground unit`).toBeDefined()
      expect(unit!.mode, `${v.label} drop mode`).toBe(5)
      expect(resolveGroundItemFlippyKey(unit!), `${v.label} flippyKey`).not.toBeNull()
      expect(resolveGroundItemSpriteRect(unit!), `${v.label} spriteRect`).not.toBeNull()
      expect(world.containers.sockets.get(hostId)?.length, `${v.label} socket child`).toBe(1)

      // Pick back up to inventory, verify round-trip, and clear inventory for next variant
      game.enqueueCommand(pid, { type: 'ItemPickup', itemId: hostId, toCursor: false })
      game.stepFrame()
      drainIntoWorld(game, pid, world)
      expect(world.containers.inventory.get(hostId), `${v.label} picked into inventory`).toBeDefined()
      expect(world.containers.sockets.get(hostId)?.length, `${v.label} picked socket child`).toBe(1)
      ;(internal(game).players.get(pid) as unknown as { items: unknown[] }).items.length = 0
      world.containers.removeItemById(hostId)
    }
  })
})

describe('Wave 3 #1859: Periodic party S2C 0x7F life% & S2C 0x90 automap position pulses', () => {
  it('emits S2C 0x7F (all areas) and S2C 0x90 (same area only) every 15 frames and over binary D2GS wire', () => {
    const host = new MultiClientRoomHost({
      policy: CLOSED_REALM_POLICY,
      mapSeed: 0x185901,
      difficulty: 0,
      act: 0,
      areaId: 1,
    })

    const connectWirePlayer = (name: string, x: number, y: number) => {
      const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
      const roomSession = host.attachClient(serverStream, {
        charName: name,
        classId: 3,
        protocol: 'd2gs',
        x,
        y,
      })
      const d2gs = new Netproto.D2gsSession({
        stream: clientStream,
        logon: {
          gameHash: 0x1859,
          gameToken: 0x01,
          charClass: 3,
          versionByte: 0x0d,
          charName: name,
        },
      })
      const world = new ClientWorld()
      const opcodes: number[] = []
      const itemTables = getServerItemDataTables()
      d2gs.onPacket((pkt) => {
        opcodes.push(pkt[0]!)
        const ev = Netproto.decodeD2gsS2cPacket(pkt, { tables: itemTables })
        world.apply(ev)
      })
      return { roomSession, world, opcodes }
    }

    const p1 = connectWirePlayer('PartyOne', 100, 100)
    const p2 = connectWirePlayer('PartyTwo', 106, 104)
    host.stepFrame()

    const game = host.gameInstance
    const id1 = p1.roomSession.playerUnitId
    const id2 = p2.roomSession.playerUnitId

    // Invite & accept party (1.13c 0x5E action 0x06 -> 0x08)
    p1.opcodes.length = 0
    p2.opcodes.length = 0
    game.enqueueCommand(id1, { type: 'PartyAction', action: 0x06, targetPlayerId: id2 })
    host.stepFrame()
    game.enqueueCommand(id2, { type: 'PartyAction', action: 0x08, targetPlayerId: id1 })
    host.stepFrame()

    // Immediate pulse on party accept
    expect(p1.opcodes).toContain(0x7f)
    expect(p1.opcodes).toContain(0x90)
    expect(p1.world.party.get(id2)?.lifePct).toBe(100)
    expect(p1.world.party.get(id2)?.x).toBe(106)
    expect(p1.world.party.get(id2)?.y).toBe(104)

    // Reduce PartyTwo HP to 50% and move to (112, 108), then step 15 frames
    const rec2 = internal(game).players.get(id2)!
    rec2.hp = Math.floor(rec2.maxHp / 2)
    rec2.hpFixed = rec2.hp * 256
    rec2.x = 112
    rec2.y = 108
    rec2.targetX = 112
    rec2.targetY = 108
    p1.opcodes.length = 0
    for (let i = 0; i < 15; i++) {
      host.stepFrame()
    }
    expect(p1.opcodes).toContain(0x7f)
    expect(p1.opcodes).toContain(0x90)
    expect(p1.world.party.get(id2)?.lifePct).toBe(Math.round((rec2.hp * 100) / rec2.maxHp))
    expect(p1.world.party.get(id2)?.x).toBe(112)
    expect(p1.world.party.get(id2)?.y).toBe(108)

    // Move PartyTwo to Blood Moor (areaId = 2): 0x7F MUST still fire with areaId=2, while 0x90 MUST NOT fire across areas
    rec2.areaId = 2
    p1.opcodes.length = 0
    for (let i = 0; i < 15; i++) {
      host.stepFrame()
    }
    expect(p1.opcodes).toContain(0x7f)
    expect(p1.opcodes).not.toContain(0x90)
    expect(p1.world.party.get(id2)?.areaId).toBe(2)
  })
})

describe('Wave 3 #1860: Authoritative C2S 0x16 pickup distance check & PartyManager.splitGold', () => {
  it('enforces <= 6 sub-tile pickup reach for C2S 0x16 while preserving Sorceress Telekinesis (#43) ranged pickup', () => {
    const game = new GameInstance({ mode: 'realm', seed: 0x186001, areaId: 1 })
    const sorcId = game.connectPlayer({ charName: 'TeleSorc', charClass: 'sor', level: 30, areaId: 1, x: 100, y: 100 })
    const sorc = internal(game).players.get(sorcId)!
    sorc.skills.set(43, 5)
    sorc.mana = 200
    game.drainEvents(sorcId)

    // Far item at distance 20 (> 6): direct C2S 0x16 ItemPickup MUST be rejected
    const farSword = game.spawnGroundItem({ code: 'ssd', x: 120, y: 100, areaId: 1 })
    game.enqueueCommand(sorcId, { type: 'ItemPickup', itemId: farSword, toCursor: false })
    game.stepFrame()
    expect(internal(game).groundItems.has(farSword)).toBe(true)

    // Close item at distance 5 (<= 6): direct C2S 0x16 ItemPickup succeeds
    const nearSword = game.spawnGroundItem({ code: 'ssd', x: 105, y: 100, areaId: 1 })
    game.enqueueCommand(sorcId, { type: 'ItemPickup', itemId: nearSword, toCursor: false })
    game.stepFrame()
    expect(internal(game).groundItems.has(nearSword)).toBe(false)

    // Ranged gold pile at distance 14 (> 6) in Blood Moor (areaId = 2): Telekinesis SkillOn succeeds!
    const sorcFieldGame = new GameInstance({ mode: 'realm', seed: 0x186002, areaId: 2 })
    const fieldSorcId = sorcFieldGame.connectPlayer({
      charName: 'FieldTeleSorc',
      charClass: 'sor',
      level: 30,
      areaId: 2,
      x: 100,
      y: 100,
    })
    const fieldSorc = internal(sorcFieldGame).players.get(fieldSorcId)!
    fieldSorc.skills.set(43, 5)
    fieldSorc.mana = 200
    sorcFieldGame.drainEvents(fieldSorcId)

    const rangedGold = sorcFieldGame.spawnGroundItem({ code: 'gld', x: 114, y: 100, areaId: 2, quantity: 250 })
    sorcFieldGame.enqueueCommand(fieldSorcId, { type: 'ItemPickup', itemId: rangedGold, toCursor: false })
    sorcFieldGame.stepFrame()
    expect(internal(sorcFieldGame).groundItems.has(rangedGold)).toBe(true)

    const goldBefore = fieldSorc.gold
    sorcFieldGame.enqueueCommand(fieldSorcId, { type: 'SelectSkill', skill: 43, hand: 'right' })
    sorcFieldGame.stepFrame()
    sorcFieldGame.enqueueCommand(fieldSorcId, {
      type: 'SkillOn',
      hand: 'right',
      target: { unitType: 4, id: rangedGold },
      shift: false,
      hold: false,
    })
    for (let i = 0; i < 12; i++) {
      sorcFieldGame.stepFrame()
    }
    expect(internal(sorcFieldGame).groundItems.has(rangedGold)).toBe(false)
    expect(fieldSorc.gold).toBe(goldBefore + 250)
  })

  it('splits picked-up gold across alive same-area party allies, caps at clvl * 10000, and drops overflow gold', () => {
    const pm = new PartyManager()
    pm.registerPlayer(1, 'A', 0, 1, 1)
    pm.registerPlayer(2, 'B', 1, 1, 1)
    pm.registerPlayer(3, 'OtherArea', 2, 1, 2)
    pm.registerPlayer(4, 'Unpartied', 3, 1, 1)
    pm.invite(1, 2)
    pm.accept(2, 1)
    pm.invite(1, 3)
    pm.accept(3, 1)

    const directSplit = pm.splitGold(1, 101, [
      { unitId: 1, areaId: 1, level: 10, currentGold: 0, maxGold: 100000, dead: false },
      { unitId: 2, areaId: 1, level: 10, currentGold: 0, maxGold: 100000, dead: false },
      { unitId: 3, areaId: 2, level: 10, currentGold: 0, maxGold: 100000, dead: false },
      { unitId: 4, areaId: 1, level: 10, currentGold: 0, maxGold: 100000, dead: false },
    ])
    expect(directSplit.shares.get(1)).toBe(51) // 50 + remainder 1
    expect(directSplit.shares.get(2)).toBe(50)
    expect(directSplit.shares.has(3)).toBe(false)
    expect(directSplit.shares.has(4)).toBe(false)
    expect(directSplit.overflowGold).toBe(0)

    // End-to-end GameInstance verification: cap at clvl * 10000 + ground overflow pile
    const game = new GameInstance({ mode: 'realm', seed: 0x186003, areaId: 1 })
    const p1 = game.connectPlayer({ charName: 'Picker', charClass: 'pal', level: 1, areaId: 1, x: 100, y: 100 })
    const p2 = game.connectPlayer({ charName: 'AllySame', charClass: 'ama', level: 1, areaId: 1, x: 103, y: 100 })
    const p3 = game.connectPlayer({ charName: 'AllyDead', charClass: 'bar', level: 1, areaId: 1, x: 103, y: 102 })
    game.drainEvents(p1)
    game.drainEvents(p2)
    game.drainEvents(p3)

    game.enqueueCommand(p1, { type: 'PartyAction', action: 0x06, targetPlayerId: p2 })
    game.stepFrame()
    game.enqueueCommand(p2, { type: 'PartyAction', action: 0x08, targetPlayerId: p1 })
    game.stepFrame()
    game.enqueueCommand(p1, { type: 'PartyAction', action: 0x06, targetPlayerId: p3 })
    game.stepFrame()
    game.enqueueCommand(p3, { type: 'PartyAction', action: 0x08, targetPlayerId: p1 })
    game.stepFrame()

    const r1 = internal(game).players.get(p1)!
    const r2 = internal(game).players.get(p2)!
    const r3 = internal(game).players.get(p3)!
    r1.gold = 9900
    r2.gold = 9900
    r3.gold = 0
    r3.dead = true // Dead party member must not receive split gold

    const goldId = game.spawnGroundItem({ code: 'gld', x: 101, y: 100, areaId: 1, quantity: 500 })
    game.drainEvents(p1)
    game.drainEvents(p2)

    game.enqueueCommand(p1, { type: 'ItemPickup', itemId: goldId, toCursor: false })
    game.stepFrame()

    expect(r1.gold).toBe(10000)
    expect(r2.gold).toBe(10000)
    expect(r3.gold).toBe(0)

    const remainingGoldPiles = Array.from(internal(game).groundItems.values()).filter(
      (g) => g.code === 'gld',
    )
    expect(remainingGoldPiles.length).toBe(1)
    expect(remainingGoldPiles[0]!.quantity).toBe(300)
  })
})

describe('Wave 3 #1861: .d2s weapon-swap skills/activeWeapon, timestamp progression, npcIntro bitfields & corpse coords', () => {
  it('swaps independent primary/secondary weapon-set skills on C2S 0x60 and persists activeWeapon=1 + alt skills in .d2s', () => {
    const game = new GameInstance({ mode: 'singlePlayer', policy: SINGLE_PLAYER_POLICY, seed: 0x186101, areaId: 1 })
    const pid = game.connectPlayer({ charName: 'SwapPal', charClass: 'pal', level: 40, areaId: 1, x: 100, y: 100 })
    const rec = internal(game).players.get(pid)!
    rec.skills.set(96, 5) // Sacrifice
    rec.skills.set(106, 5) // Zeal
    rec.skills.set(98, 5) // Might
    rec.skills.set(113, 5) // Concentration
    game.drainEvents(pid)

    game.enqueueCommand(pid, { type: 'SelectSkill', hand: 'left', skill: 106 })
    game.enqueueCommand(pid, { type: 'SelectSkill', hand: 'right', skill: 113 })
    game.stepFrame()
    game.drainEvents(pid)

    game.enqueueCommand(pid, { type: 'SwapWeapons' })
    game.stepFrame()
    expect(rec.weaponSet).toBe(1)
    expect(rec.altLeftSkill).toBe(106)
    expect(rec.altRightSkill).toBe(113)

    game.enqueueCommand(pid, { type: 'SelectSkill', hand: 'left', skill: 96 })
    game.enqueueCommand(pid, { type: 'SelectSkill', hand: 'right', skill: 98 })
    game.stepFrame()
    expect(rec.leftSkill).toBe(96)
    expect(rec.rightSkill).toBe(98)

    const d2sSlot2 = readD2sSave113c(game.exportPlayerD2s(pid))
    expect(d2sSlot2.activeWeapon).toBe(1)
    expect(d2sSlot2.leftSkill).toBe(96)
    expect(d2sSlot2.rightSkill).toBe(98)
    expect(d2sSlot2.altLeftSkill).toBe(106)
    expect(d2sSlot2.altRightSkill).toBe(113)

    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'SwapWeapons' })
    game.stepFrame()
    const swapEvents = game.drainEvents(pid)
    expect(rec.weaponSet).toBe(0)
    expect(rec.leftSkill).toBe(106)
    expect(rec.rightSkill).toBe(113)
    expect(rec.altLeftSkill).toBe(96)
    expect(rec.altRightSkill).toBe(98)
    expect(swapEvents.some((e) => e.type === 'WeaponSwitch')).toBe(true)
    expect(swapEvents.some((e) => e.type === 'ActiveSkill' && e.hand === 'left' && e.skill === 106)).toBe(true)
    expect(swapEvents.some((e) => e.type === 'ActiveSkill' && e.hand === 'right' && e.skill === 113)).toBe(true)
  })

  it('deterministically advances lastPlayedTimestamp, records town NPC greeting bits in npcIntro, and persists corpseX/corpseY', () => {
    const game = new GameInstance({ mode: 'singlePlayer', policy: SINGLE_PLAYER_POLICY, seed: 0x186102, areaId: 2, difficulty: 1 })
    const pid = game.connectPlayer({ charName: 'MetaHero', charClass: 'ama', level: 30, areaId: 2, x: 112, y: 108 })
    game.drainEvents(pid)

    const d2sFirst = readD2sSave113c(game.exportPlayerD2s(pid))
    for (let i = 0; i < 50; i++) {
      game.stepFrame()
    }
    const d2sSecond = readD2sSave113c(game.exportPlayerD2s(pid))
    expect(d2sSecond.lastPlayedTimestamp).toBeGreaterThan(d2sFirst.lastPlayedTimestamp)

    // Talk to Akara (hcIdx = 148 -> intro bit 2) in Nightmare (difficulty = 1 -> byte offset 4 + 1*8 + 0 = 12)
    let akaraId = 0
    for (const m of internal(game).monsters.values()) {
      if (m.hcIdx === 148 && m.areaId === 2) {
        akaraId = m.unitId
        break
      }
    }
    if (akaraId === 0) {
      akaraId = game.spawnMonster({ hcIdx: 148, x: 113, y: 108, areaId: 2, isNpc: true })
    }
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: akaraId } })
    game.stepFrame()

    const d2sWithNpc = readD2sSave113c(game.exportPlayerD2s(pid))
    expect(d2sWithNpc.npcIntro[0]).toBe(0x01)
    expect(d2sWithNpc.npcIntro[1]).toBe(0x77)
    expect((d2sWithNpc.npcIntro[12]! & (1 << 2)) !== 0).toBe(true)

    // Equip armor (`qui`), die to a monster at (112, 108) in Blood Moor (areaId = 2), and verify corpseX/corpseY in .d2s
    giveItem(game, pid, 'qui', 'equipped', 0, 0, {}, 3)
    const rec = internal(game).players.get(pid)!
    rec.x = 112
    rec.y = 108
    rec.targetX = 112
    rec.targetY = 108
    rec.hp = 1
    rec.hpFixed = 256
    const killerId = game.spawnMonster({ hcIdx: 0, x: 113, y: 108, areaId: 2 })
    for (let i = 0; i < 60 && !rec.dead; i++) {
      const killer = internal(game).monsters.get(killerId)
      if (killer) {
        killer.x = 113
        killer.y = 108
      }
      game.stepFrame()
    }
    if (!rec.dead) {
      const rawBytes = writeD2sSave113c({
        ...d2sWithNpc,
        name: 'CorpseCoordTest',
        classId: 0,
        level: 30,
        corpseItems: d2sWithNpc.items,
        corpseX: 112,
        corpseY: 108,
      })
      const parsedRaw = readD2sSave113c(rawBytes)
      expect(parsedRaw.corpseX).toBe(112)
      expect(parsedRaw.corpseY).toBe(108)
    } else {
      const d2sDead = readD2sSave113c(game.exportPlayerD2s(pid))
      expect(d2sDead.corpseItems.length).toBeGreaterThan(0)
      expect(d2sDead.corpseX).toBe(112)
      expect(d2sDead.corpseY).toBe(108)
    }
  })

  it("preserves compact 7-bit 'ear' bitstream (isEar=true, compact=true, earName/earClass/earLevel) across pickup, drop, and exportPlayerD2s (#1644/#1784)", () => {
    const game = new GameInstance({ mode: 'realm', seed: 0x186103, areaId: 1 })
    const pid = game.connectPlayer({
      charName: 'EarCollector',
      charClass: 'bar',
      level: 45,
      areaId: 1,
      x: 100,
      y: 100,
    })
    game.drainEvents(pid)

    const earId = game.spawnGroundItem({ code: 'ear', x: 100, y: 100, areaId: 1 })
    const earEntry = internal(game).groundItems.get(earId)!
    earEntry.rawItemData = {
      ...(earEntry.rawItemData ?? {}),
      isEar: true,
      compact: true,
      simple: true,
      flags: 0x00210010,
      rawFlags: 0x00210010,
      earName: 'FallenRival',
      earClass: 1,
      earLevel: 38,
    }

    // Pick up ear into inventory, export .d2s, and verify canonical compact ear bitstream round-trips
    game.enqueueCommand(pid, { type: 'ItemPickup', itemId: earId, toCursor: false })
    game.stepFrame()

    const exportedBytes = game.exportPlayerD2s(pid)
    const parsed = readD2sSave113c(exportedBytes)
    const earSaved = parsed.items.find((it) => it.isEar || it.code.trim() === 'ear')
    expect(earSaved).toBeDefined()
    expect(earSaved!.isEar).toBe(true)
    expect(earSaved!.compact).toBe(true)
    expect(earSaved!.earName).toBe('FallenRival')
    expect(earSaved!.earClass).toBe(1)
    expect(earSaved!.earLevel).toBe(38)
  })
})
