import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import * as Netproto from '../../src/netproto/index.ts'
import * as Server from '../../src/server/index.ts'

describe('Wave 5 P2 Network Packet Parity (#1932, #1933, #1934)', () => {
  it('#1932, #1934: WalkVerify rubberband, 0x53 EnvironmentSync on area transition, and simple C2S packet passing', async () => {
    const host = new Server.MultiClientRoomHost({
      policy: Server.CLOSED_REALM_POLICY,
      mapSeed: 0x1932,
      difficulty: 1,
      act: 0,
      areaId: 1, // Rogue Encampment
    })

    const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
    const session = host.attachClient(serverStream, {
      charName: 'P2Hero',
      classId: 1,
      protocol: 'd2gs',
      x: 5000,
      y: 5000,
      areaId: 1,
    })

    const adapter = new Netproto.D2gsServerAdapter(clientStream)
    const rawEvents: Netproto.ServerEvent[] = []
    adapter.onEvent((ev) => rawEvents.push(ev))

    // Start
    host.stepFrame(); await new Promise(r => setImmediate(r));
    rawEvents.length = 0;

    // Test C2S 0x5F UpdatePlayerPos causing 0x96 WalkVerify
    (host.getGameInstance() as any).findPlayerPath = () => [];
    adapter.send({ type: 'UpdatePlayerPos', x: 4980, y: 5000 }) // close invalid pos
    host.stepFrame(); await new Promise(r => setImmediate(r));
    expect(rawEvents.some((e) => e.type === 'WalkVerify')).toBe(true)

    rawEvents.length = 0

    // Test C2S 0x3F Say
    adapter.send({ type: 'Say', phraseId: 25 })
    host.stepFrame(); await new Promise(r => setImmediate(r));

    rawEvents.length = 0

    // Test C2S 0x58 QuestMessageSound
    adapter.send({ type: 'QuestMessageSound', questId: 21 })
    host.stepFrame(); await new Promise(r => setImmediate(r));
    expect(rawEvents.some((e) => e.type === 'PlaySound' && e.sound === 21)).toBe(true)

    rawEvents.length = 0

    // Force transition area to trigger 0x53 EnvironmentSync
    // Area 2 (Blood Moor)
    const game = host.getGameInstance()
    const playerRecord = (game as any).players.get(session.playerUnitId)!
    // Warp the player to Blood Moor
    ;(game as any).transitionPlayerArea(playerRecord, 2, { kind: 'waypoint' })
    host.stepFrame(); await new Promise(r => setImmediate(r));
    expect(rawEvents.some((e) => e.type === 'EnvironmentSync')).toBe(true)

    host.close()
  })

  it('#1933: C2S 0x02 WalkToTarget and 0x4B RequestEntityUpdate', async () => {
    const host = new Server.MultiClientRoomHost({
      policy: Server.CLOSED_REALM_POLICY,
      mapSeed: 0x1933,
      act: 0,
      areaId: 1,
    })

    const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
    const session = host.attachClient(serverStream, {
      charName: 'MoverHero',
      classId: 1,
      protocol: 'd2gs',
      x: 5000,
      y: 5000,
    })

    const adapter = new Netproto.D2gsServerAdapter(clientStream)
    const rawEvents: Netproto.ServerEvent[] = []
    adapter.onEvent((ev) => rawEvents.push(ev))

    host.stepFrame(); await new Promise(r => setImmediate(r));

    const game = host.getGameInstance()
    const monsterId = game.spawnMonster({
      hcIdx: 1, // zombie
      areaId: 1,
      x: 5010,
      y: 5010,
    })

    host.stepFrame(); await new Promise(r => setImmediate(r));
    rawEvents.length = 0

    // C2S 0x02 WalkToTarget
    adapter.send({ type: 'WalkToTarget', unitKind: 1, unitId: monsterId } as any)
    host.stepFrames(10); await new Promise(r => setImmediate(r));
    
    // Check if player actually started moving (PLRMODE_TW = 6 in Town areaId=1 per D2Game 0x6FC9866C)
    const playerRecord = (game as any).players.get(session.playerUnitId)!
    expect(playerRecord.mode).toBe(6) // town walking

    rawEvents.length = 0

    // C2S 0x4B RequestEntityUpdate
    adapter.send({ type: 'RequestEntityUpdate', unitType: 1, unitId: monsterId })
    host.stepFrame(); await new Promise(r => setImmediate(r));
    
    host.close()
  })

  it('#1934: S2C 0x7A SummonAction 13-byte wire parity on summon', async () => {
    const host = new Server.MultiClientRoomHost({
      policy: Server.CLOSED_REALM_POLICY,
      mapSeed: 0x1934,
      act: 0,
      areaId: 1,
    })

    const [c1, s1] = Netproto.createMemoryStreamPair()
    const [c2, s2] = Netproto.createMemoryStreamPair()

    const session1 = host.attachClient(s1, {
      charName: 'Necro',
      classId: 2, // Necromancer
      protocol: 'd2gs',
      x: 5000,
      y: 5000,
    })
    
    const session2 = host.attachClient(s2, {
      charName: 'Observer',
      classId: 1, // Sorceress
      protocol: 'd2gs',
      x: 5005,
      y: 5005,
    })

    const adapter1 = new Netproto.D2gsServerAdapter(c1)
    const adapter2 = new Netproto.D2gsServerAdapter(c2)
    const world1 = new ClientWorld()
    const events1: Netproto.ServerEvent[] = []
    const events2: Netproto.ServerEvent[] = []
    adapter1.onEvent((ev) => {
      events1.push(ev)
      world1.apply(ev)
    })
    adapter2.onEvent(ev => events2.push(ev))

    host.stepFrames(5); await new Promise(r => setImmediate(r));
    events1.length = 0
    events2.length = 0

    const game = host.getGameInstance()
    const p1Record = (game as any).players.get(session1.playerUnitId)!
    
    const petId1 = game.summonPet(p1Record.unitId, { skillId: 221, slvl: 5, x: p1Record.x + 1, y: p1Record.y });
    host.stepFrame(); await new Promise(r => setImmediate(r));
    
    const summonEvent = events1.find(e => e.type === 'Merc' && e.mercId === (petId1 as any)?.pet?.unitId)
    expect(summonEvent).toBeDefined()
    expect((summonEvent as any).isSummonAction).toBe(true)
    expect((summonEvent as any).summonAction).toBe(1)
    expect(
      [...world1.pets.values()].filter((p) => p.ownerId === p1Record.unitId && p.petType === (summonEvent as any).petType).length,
    ).toBe(1)

    // Spawn a second one: 13-byte 0x7A adds a second entry to ClientWorld.pets (matching D2Client g_pPetList 0x6fbcc4d4)
    events1.length = 0
    const petId2 = game.summonPet(p1Record.unitId, { skillId: 221, slvl: 5, x: p1Record.x - 1, y: p1Record.y })
    host.stepFrame(); await new Promise(r => setImmediate(r));
    const summonEvent2 = events1.find(e => e.type === 'Merc' && e.mercId === (petId2 as any)?.pet?.unitId)
    expect(summonEvent2).toBeDefined()
    expect((summonEvent2 as any).isSummonAction).toBe(true)
    expect(
      [...world1.pets.values()].filter((p) => p.ownerId === p1Record.unitId && p.petType === (summonEvent2 as any).petType).length,
    ).toBe(2)

    host.close()
  })
})
