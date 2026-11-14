import { describe, expect, it } from 'vitest'
import * as Netproto from '../../src/netproto/index.ts'
import * as Server from '../../src/server/index.ts'

describe('Issue #1442: 1.13c C2S 0x5E party handshake, lone-member disband & single authoritative PartyManager', () => {
  it('1. 0x06 Invite only records pending invite and emits S2C 0x8B (4 to inviter, 2 to invitee) without changing partyId (D2Game.dll 0x6FD10870)', () => {
    const game = new Server.GameInstance({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0x144201,
      areaId: 1,
    })
    const p1 = game.addPlayer({ charName: 'Inviter', classId: 1, level: 10 })
    const p2 = game.addPlayer({ charName: 'Invitee', classId: 2, level: 10 })
    game.drainEvents(p1)
    game.drainEvents(p2)

    game.enqueueCommand(p1, { type: 'PartyAction', action: 0x06, targetPlayerId: p2 })
    game.stepFrame()

    // Neither player has joined a party yet (partyId stays 0xFFFF)
    expect(game.getPlayerState(p1)!.partyId).toBe(0xffff)
    expect(game.getPlayerState(p2)!.partyId).toBe(0xffff)
    expect(game.partyManager.getPendingInvitesFor(p2)).toEqual([p1])
    expect(game.partyManager.areAllied(p1, p2)).toBe(false)

    // S2C 0x8B relation events: p1 gets relation=4 (invited by me), p2 gets relation=2 (invited me), and NO 0x8D update
    const ev1 = game.drainEvents(p1)
    const ev2 = game.drainEvents(p2)
    expect(ev1.some((e) => e.type === 'Party' && e.kind === 'roster' && e.action === 'update')).toBe(false)
    expect(ev2.some((e) => e.type === 'Party' && e.kind === 'roster' && e.action === 'update')).toBe(false)
    expect(ev1).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: p2,
        playerId: p2,
        relation: 4,
      }),
    )
    expect(ev2).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: p1,
        playerId: p1,
        relation: 2,
      }),
    )
  })

  it('2. 0x08 Accept requires a prior 0x06 invite from target -> player; unsolicited 0x08 is rejected (D2Game.dll 0x6FD10D50)', () => {
    const game = new Server.GameInstance({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0x144202,
      areaId: 1,
    })
    const p1 = game.addPlayer({ charName: 'Alpha', classId: 1, level: 10 })
    const p2 = game.addPlayer({ charName: 'Bravo', classId: 2, level: 10 })
    game.drainEvents(p1)
    game.drainEvents(p2)

    // Unsolicited 0x08 without prior 0x06 invite from p1 -> p2 must be rejected
    game.enqueueCommand(p2, { type: 'PartyAction', action: 0x08, targetPlayerId: p1 })
    game.stepFrame()
    expect(game.getPlayerState(p1)!.partyId).toBe(0xffff)
    expect(game.getPlayerState(p2)!.partyId).toBe(0xffff)
    expect(game.partyManager.areAllied(p1, p2)).toBe(false)

    // Now p1 sends 0x06 invite to p2, and p2 sends 0x08 accept to p1
    game.enqueueCommand(p1, { type: 'PartyAction', action: 0x06, targetPlayerId: p2 })
    game.stepFrame()
    game.drainEvents(p1)
    game.drainEvents(p2)

    game.enqueueCommand(p2, { type: 'PartyAction', action: 0x08, targetPlayerId: p1 })
    game.stepFrame()

    const partyId = game.getPlayerState(p1)!.partyId
    expect(partyId).not.toBe(0xffff)
    expect(game.getPlayerState(p2)!.partyId).toBe(partyId)
    expect(game.partyManager.getPendingInvitesFor(p2)).toEqual([])
    expect(game.partyManager.areAllied(p1, p2)).toBe(true)

    const ev1 = game.drainEvents(p1)
    const ev2 = game.drainEvents(p2)
    for (const evList of [ev1, ev2]) {
      expect(evList).toContainEqual(
        expect.objectContaining({
          type: 'Party',
          kind: 'roster',
          action: 'update',
          source: 0x8d,
          playerId: p1,
          partyId,
        }),
      )
      expect(evList).toContainEqual(
        expect.objectContaining({
          type: 'Party',
          kind: 'roster',
          action: 'update',
          source: 0x8d,
          playerId: p2,
          partyId,
        }),
      )
    }
    expect(ev1).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: p2,
        relation: 1,
      }),
    )
    expect(ev2).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: p1,
        relation: 1,
      }),
    )
  })

  it('3. 0x07 Cancel Invite cancels only a pending invite (p1 -> p3) and NEVER kicks p1 out of their existing party with p2 (D2Game.dll 0x6FD10900)', () => {
    const game = new Server.GameInstance({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0x144203,
      areaId: 1,
    })
    const p1 = game.addPlayer({ charName: 'Leader', classId: 1, level: 20 })
    const p2 = game.addPlayer({ charName: 'Teammate', classId: 2, level: 20 })
    const p3 = game.addPlayer({ charName: 'Outsider', classId: 3, level: 20 })

    // Form party between p1 and p2
    game.enqueueCommand(p1, { type: 'PartyAction', action: 0x06, targetPlayerId: p2 })
    game.stepFrame()
    game.enqueueCommand(p2, { type: 'PartyAction', action: 0x08, targetPlayerId: p1 })
    game.stepFrame()
    const partyId = game.getPlayerState(p1)!.partyId
    expect(partyId).not.toBe(0xffff)
    expect(game.getPlayerState(p2)!.partyId).toBe(partyId)

    // p1 invites p3 (0x06), then cancels the invite to p3 (0x07)
    game.enqueueCommand(p1, { type: 'PartyAction', action: 0x06, targetPlayerId: p3 })
    game.stepFrame()
    expect(game.partyManager.getPendingInvitesFor(p3)).toEqual([p1])
    game.drainEvents(p1)
    game.drainEvents(p2)
    game.drainEvents(p3)

    game.enqueueCommand(p1, { type: 'PartyAction', action: 0x07, targetPlayerId: p3 })
    game.stepFrame()

    // Pending invite to p3 is cleared, and p1 + p2 remain in their party!
    expect(game.partyManager.getPendingInvitesFor(p3)).toEqual([])
    expect(game.getPlayerState(p1)!.partyId).toBe(partyId)
    expect(game.getPlayerState(p2)!.partyId).toBe(partyId)
    expect(game.partyManager.areAllied(p1, p2)).toBe(true)

    const ev1 = game.drainEvents(p1)
    const ev3 = game.drainEvents(p3)
    expect(ev1).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: p3,
        relation: 0,
      }),
    )
    expect(ev3).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: p1,
        relation: 1,
      }),
    )

    // Subsequent 0x08 from p3 after cancel must fail
    game.enqueueCommand(p3, { type: 'PartyAction', action: 0x08, targetPlayerId: p1 })
    game.stepFrame()
    expect(game.getPlayerState(p3)!.partyId).toBe(0xffff)
  })

  it('4. 0x09 Leave Party removes the leaving player and disbands a 2-player party so the lone remaining member also resets to 0xFFFF (D2Game.dll 0x6FCBC840 -> 0x6FCBC930)', () => {
    const game = new Server.GameInstance({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0x144204,
      areaId: 1,
    })
    const p1 = game.addPlayer({ charName: 'MemberA', classId: 1, level: 15 })
    const p2 = game.addPlayer({ charName: 'MemberB', classId: 2, level: 15 })

    game.enqueueCommand(p1, { type: 'PartyAction', action: 0x06, targetPlayerId: p2 })
    game.stepFrame()
    game.enqueueCommand(p2, { type: 'PartyAction', action: 0x08, targetPlayerId: p1 })
    game.stepFrame()
    expect(game.getPlayerState(p1)!.partyId).not.toBe(0xffff)
    expect(game.getPlayerState(p2)!.partyId).toBe(game.getPlayerState(p1)!.partyId)
    game.drainEvents(p1)
    game.drainEvents(p2)

    // p1 leaves the 2-person party -> both p1 and lone remaining member p2 reset to 0xFFFF
    game.enqueueCommand(p1, { type: 'PartyAction', action: 0x09, targetPlayerId: p1 })
    game.stepFrame()

    expect(game.getPlayerState(p1)!.partyId).toBe(0xffff)
    expect(game.getPlayerState(p2)!.partyId).toBe(0xffff)
    expect(game.partyManager.areAllied(p1, p2)).toBe(false)

    const ev2 = game.drainEvents(p2)
    expect(ev2).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'roster',
        action: 'update',
        source: 0x8d,
        playerId: p1,
        partyId: 0xffff,
      }),
    )
    expect(ev2).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'roster',
        action: 'update',
        source: 0x8d,
        playerId: p2,
        partyId: 0xffff,
      }),
    )
  })

  it('5. MultiClientRoomHost shares the single GameInstance.partyManager and round-trips C2S 0x5E / S2C 0x8B & 0x8D over D2GS binary wire', () => {
    const room = new Server.MultiClientRoomHost({
      mapSeed: 0x144205,
      areaId: 1,
    })
    expect(room.partyManager).toBe(room.gameInstance.partyManager)

    const [c1Stream, s1Stream] = Netproto.createMemoryStreamPair()
    const [c2Stream, s2Stream] = Netproto.createMemoryStreamPair()
    const s1 = room.attachClient(s1Stream, { charName: 'WireA', classId: 0, level: 25, protocol: 'd2gs' })
    const s2 = room.attachClient(s2Stream, { charName: 'WireB', classId: 1, level: 25, protocol: 'd2gs' })

    const eventsA: Netproto.ServerEvent[] = []
    const eventsB: Netproto.ServerEvent[] = []
    const adapterA = new Netproto.D2gsAdapter(c1Stream)
    const adapterB = new Netproto.D2gsAdapter(c2Stream)
    adapterA.onEvent((ev) => eventsA.push(ev))
    adapterB.onEvent((ev) => eventsB.push(ev))

    room.stepFrame()
    eventsA.length = 0
    eventsB.length = 0

    // WireA sends C2S 0x5E action 0x06 (Invite) to WireB over D2GS binary stream
    adapterA.send({ type: 'PartyAction', action: 0x06, targetPlayerId: s2.playerUnitId })
    room.stepFrame()

    expect(room.gameInstance.getPlayerState(s1.playerUnitId)!.partyId).toBe(0xffff)
    expect(room.gameInstance.getPlayerState(s2.playerUnitId)!.partyId).toBe(0xffff)
    expect(eventsA).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'relation',
        unitId: s2.playerUnitId,
        relation: 4,
      }),
    )
    expect(eventsB).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'relation',
        unitId: s1.playerUnitId,
        relation: 2,
      }),
    )

    eventsA.length = 0
    eventsB.length = 0

    // WireB sends C2S 0x5E action 0x08 (Accept) to WireA over D2GS binary stream
    adapterB.send({ type: 'PartyAction', action: 0x08, targetPlayerId: s1.playerUnitId })
    room.stepFrame()

    const partyId = room.gameInstance.getPlayerState(s1.playerUnitId)!.partyId
    expect(partyId).not.toBe(0xffff)
    expect(room.gameInstance.getPlayerState(s2.playerUnitId)!.partyId).toBe(partyId)
    expect(room.partyManager.getPartyId(s1.playerUnitId)).toBe(partyId)
    expect(room.partyManager.getPartyId(s2.playerUnitId)).toBe(partyId)
    expect(eventsA).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'roster',
        action: 'update',
        playerId: s1.playerUnitId,
        partyId,
      }),
    )
    expect(eventsB).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'roster',
        action: 'update',
        playerId: s2.playerUnitId,
        partyId,
      }),
    )

    // WireA toggles C2S 0x5D Hostile on WireB over D2GS binary stream -> automatically leaves & disbands party
    eventsA.length = 0
    eventsB.length = 0
    adapterA.send({ type: 'Hostile', targetPlayerId: s2.playerUnitId, hostile: true })
    room.stepFrame()

    expect(room.partyManager.areHostile(s1.playerUnitId, s2.playerUnitId)).toBe(true)
    expect(room.gameInstance.getPlayerState(s1.playerUnitId)!.partyId).toBe(0xffff)
    expect(room.gameInstance.getPlayerState(s2.playerUnitId)!.partyId).toBe(0xffff)
    expect(eventsB).toContainEqual(
      expect.objectContaining({
        type: 'Party',
        kind: 'relation',
        playerId: s1.playerUnitId,
        otherId: s2.playerUnitId,
        relation: 8,
      }),
    )

    room.close()
  })
})
