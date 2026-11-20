import { describe, expect, it } from 'vitest'
import { PartyManager } from '../../src/server/net/party.ts'
import { decodeD2gsC2sPacketToCommand } from '../../src/server/net/session.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('1.13c C2S 0x5D Player Relationship & PvP Level 9 Check (#1476)', () => {
  it('decodes C2S 0x5D wire packet (7 bytes) into Hostile client command', () => {
    // 0x5d, button=4, state=1, targetPlayerId=100 (0x64, 0x00, 0x00, 0x00)
    const pkt = new Uint8Array([0x5d, 0x04, 0x01, 0x64, 0x00, 0x00, 0x00])
    const cmd = decodeD2gsC2sPacketToCommand(pkt)
    expect(cmd).toEqual({
      type: 'Hostile',
      targetPlayerId: 100,
      hostile: true,
      button: 4,
    })

    // Button 1 (Mute), state 0 (unmute)
    const pktMute = new Uint8Array([0x5d, 0x01, 0x00, 0x05, 0x00, 0x00, 0x00])
    const cmdMute = decodeD2gsC2sPacketToCommand(pktMute)
    expect(cmdMute).toEqual({
      type: 'Hostile',
      targetPlayerId: 5,
      hostile: false,
      button: 1,
    })
  })

  it('PartyManager supports setMuted and isMuted (relation bit 1)', () => {
    const pm = new PartyManager()
    pm.addPlayer(1, 'HeroA')
    pm.addPlayer(2, 'HeroB')

    expect(pm.isMuted(1, 2)).toBe(false)
    const muteEvs = pm.setMuted(1, 2, true)
    expect(pm.isMuted(1, 2)).toBe(true)
    expect(pm.isMuted(2, 1)).toBe(false) // One-way mute

    expect(muteEvs).toContainEqual({
      type: 'Party',
      kind: 'relation',
      source: 0x8c,
      unitId: 1,
      playerId: 1,
      otherId: 2,
      relation: 1,
    })

    const unmuteEvs = pm.setMuted(1, 2, false)
    expect(pm.isMuted(1, 2)).toBe(false)
    expect(unmuteEvs).toContainEqual({
      type: 'Party',
      kind: 'relation',
      source: 0x8c,
      unitId: 1,
      playerId: 1,
      otherId: 2,
      relation: 0,
    })
  })

  it('PartyManager supports setLootPermission and hasLootPermission (relation bit 2)', () => {
    const pm = new PartyManager()
    pm.addPlayer(1, 'HeroA')
    pm.addPlayer(2, 'HeroB')

    expect(pm.hasLootPermission(1, 2)).toBe(false)
    const lootEvs = pm.setLootPermission(1, 2, true)
    expect(pm.hasLootPermission(1, 2)).toBe(true)
    expect(pm.hasLootPermission(2, 1)).toBe(false) // One-way permission

    expect(lootEvs).toContainEqual({
      type: 'Party',
      kind: 'relation',
      source: 0x8c,
      unitId: 1,
      playerId: 1,
      otherId: 2,
      relation: 2,
    })

    pm.setLootPermission(1, 2, false)
    expect(pm.hasLootPermission(1, 2)).toBe(false)
  })

  it('GameInstance rejects hostile when allowPvpHostile is false', () => {
    const game = new GameInstance({
      mapSeed: 12345,
      maxPlayers: 8,
      policy: {
        allowPvpHostile: false,
      },
    })

    const aId = game.addPlayer({ name: 'Alice', classId: 0, level: 10 })
    const bId = game.addPlayer({ name: 'Bob', classId: 1, level: 10 })

    game.drainEvents(aId)

    // Alice tries to hostile Bob
    game.enqueueCommand(aId, {
      type: 'Hostile',
      targetPlayerId: bId,
      hostile: true,
      button: 4,
    })
    game.stepFrame()

    const outboxA = game.drainEvents(aId)
    // No relation events broadcast, hostility remains false
    expect(outboxA.filter(e => e.type === 'Party' && e.kind === 'relation')).toHaveLength(0)
    expect(game.partyManager.areHostile(aId, bId)).toBe(false)
  })

  it('GameInstance rejects hostile when either player is below level 9 (D2Game 0x6fd11153..0x6fd11177)', () => {
    const game = new GameInstance({
      mapSeed: 12345,
      maxPlayers: 8,
      policy: {
        allowPvpHostile: true,
      },
    })

    const aId = game.addPlayer({ name: 'Alice', classId: 0, level: 8 }) // Level 8 < 9
    const bId = game.addPlayer({ name: 'Bob', classId: 1, level: 10 })

    game.drainEvents(aId)

    // Alice (level 8) tries to hostile Bob (level 10)
    game.enqueueCommand(aId, {
      type: 'Hostile',
      targetPlayerId: bId,
      hostile: true,
      button: 4,
    })
    game.stepFrame()

    expect(game.partyManager.areHostile(aId, bId)).toBe(false)
    expect(game.drainEvents(aId).filter(e => e.type === 'Party' && e.kind === 'relation')).toHaveLength(0)

    // Bob (level 10) tries to hostile Alice (level 8)
    game.enqueueCommand(bId, {
      type: 'Hostile',
      targetPlayerId: aId,
      hostile: true,
      button: 4,
    })
    game.stepFrame()

    expect(game.partyManager.areHostile(aId, bId)).toBe(false)
  })

  it('GameInstance declares hostile when both players are level >= 9, leaves shared party, and broadcasts S2C 0x8C', () => {
    const game = new GameInstance({
      mapSeed: 12345,
      maxPlayers: 8,
      policy: {
        allowPvpHostile: true,
      },
    })

    const aId = game.addPlayer({ name: 'Alice', classId: 0, level: 9 })
    const bId = game.addPlayer({ name: 'Bob', classId: 1, level: 12 })

    // First form a party
    game.partyManager.invite(aId, bId)
    game.partyManager.acceptInvite(bId, aId)
    expect(game.partyManager.areAllied(aId, bId)).toBe(true)

    game.drainEvents(aId)

    game.enqueueCommand(aId, {
      type: 'Hostile',
      targetPlayerId: bId,
      hostile: true,
      button: 4,
    })
    game.stepFrame()

    expect(game.partyManager.areHostile(aId, bId)).toBe(true)
    expect(game.partyManager.areAllied(aId, bId)).toBe(false)

    // Broadcasts S2C 0x8C with relation 8
    const outboxA = game.drainEvents(aId)
    const relationEv = outboxA.find(
      e => e.type === 'Party' && e.kind === 'relation' && e.relation === 8,
    )
    expect(relationEv).toBeDefined()
  })

  it('GameInstance suppresses chat from muted players (Button 1)', () => {
    const game = new GameInstance({
      mapSeed: 12345,
      maxPlayers: 8,
    })

    const aId = game.addPlayer({ name: 'Alice', classId: 0 })
    const bId = game.addPlayer({ name: 'Bob', classId: 1 })

    // Alice mutes Bob
    game.enqueueCommand(aId, {
      type: 'Hostile',
      targetPlayerId: bId,
      hostile: true,
      button: 1,
    })
    game.stepFrame()

    game.drainEvents(aId)
    game.drainEvents(bId)

    // Bob says something
    game.enqueueCommand(bId, {
      type: 'Chat',
      text: 'Hello Alice',
    })
    game.stepFrame()

    const outboxA = game.drainEvents(aId)
    const outboxB = game.drainEvents(bId)

    // Bob receives his own message, but Alice does NOT because Bob is muted
    expect(outboxB.some(e => e.type === 'Chat' && e.text === 'Hello Alice')).toBe(true)
    expect(outboxA.some(e => e.type === 'Chat' && e.text === 'Hello Alice')).toBe(false)
  })
})
