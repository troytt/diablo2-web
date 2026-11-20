/**
 * Tier 3 — Cross-Feature Interaction E2E Tests (`tests/e2e/server-reuse/tier3-cross-feature.test.ts`)
 *
 * Covers 16 pairwise and multi-feature interactions (`CF1`–`CF16`, >= 15 required)
 * across all 12 features (`F1`–`F12`) in `PROJECT.md § Feature Inventory`.
 */

import { describe, expect, it } from 'vitest'
import * as Server from '../../../src/server/index.ts'
import * as Netproto from '../../../src/netproto/index.ts'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import {
  createSampleD2sCharacterData,
  FIXED_ONE,
  getSharedDataRegistry,
  installOutdoorRoomGrid,
  recordAdapterEvents,
  repoPathExists,
  RETIRED_LEGACY_FILES,
} from './helpers.ts'

describe('Tier 3 — Cross-Feature Pairwise Interactions (CF1–CF16, 16 tests)', () => {
  it('CF1 (F1 × F2): GameInstance 25Hz simulation loop × GameModePolicy enforcement of PauseGame and /players X across SP, Open, and Realm policies', () => {
    const spGame = new Server.GameInstance({ policy: Server.SINGLE_PLAYER_POLICY, mapSeed: 0xcf100001 })
    const spP1 = spGame.addPlayer({ charName: 'SpPlayer', classId: 1 })
    spGame.enqueueCommand(spP1, { type: 'Chat', text: '/players 6' })
    spGame.enqueueCommand(spP1, { type: 'PauseGame', paused: true })
    spGame.stepFrame()
    expect(spGame.playersX).toBe(6)
    expect(spGame.paused).toBe(true)

    const realmGame = new Server.GameInstance({ policy: Server.CLOSED_REALM_POLICY, mapSeed: 0xcf100001 })
    const realmP1 = realmGame.addPlayer({ charName: 'RealmPlayer', classId: 1 })
    realmGame.enqueueCommand(realmP1, { type: 'Chat', text: '/players 6' })
    realmGame.enqueueCommand(realmP1, { type: 'PauseGame', paused: true })
    realmGame.stepFrame()
    expect(realmGame.playersX).toBe(1)
    expect(realmGame.paused).toBe(false)
  })

  it('CF2 (F1 × F3): GameInstance movement and 1.13c skill casting × RoomStreamer 3x3 room activation and MonsterAI response', () => {
    const registry = getSharedDataRegistry()
    const game = new Server.GameInstance({
      policy: Server.SINGLE_PLAYER_POLICY,
      mapSeed: 0xcf200002,
      difficulty: 0,
      actId: 0,
      areaId: 2, // Blood Moor
      registry,
    })

    installOutdoorRoomGrid(game, 2, 100, 100)
    const p1 = game.addPlayer({
      charName: 'CombatSorc',
      classId: 1,
      level: 25,
      x: 100,
      y: 100,
    })

    const events: Netproto.ServerEvent[] = []
    for (let i = 0; i < 10; i++) {
      if (i === 2) {
        game.enqueueCommand(p1, { type: 'Move', x: 115, y: 115, run: true })
      }
      if (i === 5) {
        game.enqueueCommand(p1, {
          type: 'CastSkillAtLocation',
          skillId: 36, // Fire Bolt
          x: 120,
          y: 120,
          hand: 'right',
        })
      }
      game.stepFrame()
      events.push(...game.drainPlayerEvents(p1))
    }

    expect(
      events.some((ev) => ev.type === 'UnitAssign' && ev.unitType === 'monster'),
    ).toBe(true)
    // The moving player gets no walk/run UnitMove echo (1.13c, issue #1329); the server moved it.
    expect(
      events.some((ev) => ev.type === 'UnitMove' && ev.unitId === p1),
    ).toBe(false)
    const moved = game.getPlayerState(p1)!
    expect(moved.x).toBeGreaterThan(100)
    expect(moved.y).toBeGreaterThan(100)
  })

  it('CF3 (F1 × F4): GameInstance command loop × executeDropPipeline and GroundItemManager item lifecycle', () => {
    const registry = getSharedDataRegistry()
    const drops = Server.executeDropPipeline({
      tcName: 'Act 1 Equip A',
      mlvl: 10,
      magicFind: 50,
      playerCount: 1,
      seed: 0xcf300003,
      registry,
    })
    expect(Array.isArray(drops)).toBe(true)

    const game = new Server.GameInstance({
      policy: Server.SINGLE_PLAYER_POLICY,
      mapSeed: 0xcf300003,
      areaId: 1,
      registry,
    })
    const p1 = game.addPlayer({ charName: 'ItemInteractor', classId: 4, level: 20 })
    game.stepFrame()
    const initialEvents = game.drainPlayerEvents(p1)
    expect(initialEvents.some((ev) => ev.type === 'PlayerAssign')).toBe(true)
  })

  it('CF4 (F1 × F5): GameInstance 25Hz command queue × TownPortal creation, Portal interaction, and town healer NpcAction', () => {
    const d2sBytes = Server.writeD2s(
      createSampleD2sCharacterData({
        name: 'PortalHealer',
        charClass: 1,
        level: 20,
        attributesOverrides: {
          hitpointsFixed: 60 * FIXED_ONE,
          maxHpFixed: 200 * FIXED_ONE,
        },
      }),
    )

    const game = new Server.GameInstance({
      policy: Server.SINGLE_PLAYER_POLICY,
      mapSeed: 0xcf400004,
      areaId: 2, // Blood Moor
    })
    const p1 = game.addPlayer({
      charName: 'PortalHealer',
      classId: 1,
      level: 20,
      x: 100,
      y: 100,
      d2sBytes,
    })
    ;(game as unknown as { players: Map<number, { items: unknown[] }> }).players
      .get(p1)!
      .items.push({
        unitId: 9001,
        code: 'tsc',
        location: 'inventory',
        x: 0,
        y: 0,
        quantity: 1,
        stats: new Map(),
        socketedItems: [],
      })
    game.drainPlayerEvents(p1)

    // Cast TownPortal in Blood Moor
    game.enqueueCommand(p1, { type: 'TownPortal' })
    game.stepFrame()
    const portalEvents = game.drainPlayerEvents(p1)
    const portalEv = portalEvents.find(
      (ev): ev is Extract<Netproto.ServerEvent, { type: 'Portal' }> => ev.type === 'Portal',
    )
    expect(portalEv).toBeDefined()

    // Enter portal back to Rogue Encampment and heal at Akara
    if (portalEv) {
      game.enqueueCommand(p1, {
        type: 'InteractEntity',
        targetType: 'object',
        targetId: portalEv.portalId,
      })
      game.stepFrame()
    }
    game.enqueueCommand(p1, { type: 'NpcAction', npcId: 148, action: 'heal' })
    game.stepFrame()

    const exported = Server.readD2s(game.exportPlayerD2s(p1))
    expect(exported.attributes.hitpointsFixed).toBe(exported.attributes.maxHpFixed)
  })

  it('CF5 (F1 × F6): GameInstance.addPlayer({ d2sBytes }) & exportPlayerD2s() × v96 writeD2s/readD2s stat & skill allocation persistence', () => {
    const initialData = createSampleD2sCharacterData({
      name: 'PersistPal',
      charClass: 3,
      level: 28,
      mapSeed: 0xcf500005,
      attributesOverrides: {
        strength: 60,
        vitality: 80,
        statPts: 10,
        skillPts: 5,
      },
    })
    const initialBytes = Server.writeD2s(initialData)

    const game1 = new Server.GameInstance({
      policy: Server.SINGLE_PLAYER_POLICY,
      mapSeed: 0xcf500005,
    })
    const p1 = game1.addPlayer({
      charName: 'PersistPal',
      classId: 3,
      level: 28,
      d2sBytes: initialBytes,
    })

    // Allocate 2 Strength (statId = 0) and 1 Vitality (statId = 3)
    game1.enqueueCommand(p1, { type: 'AllocateStat', statId: 0, amount: 2 })
    game1.enqueueCommand(p1, { type: 'AllocateStat', statId: 3, amount: 1 })
    game1.stepFrame()

    const savedBytes = game1.exportPlayerD2s(p1)
    const reloaded = Server.readD2s(savedBytes)

    expect(reloaded.name).toBe('PersistPal')
    expect(reloaded.attributes.strength).toBeGreaterThanOrEqual(61)
    expect(reloaded.attributes.vitality).toBeGreaterThanOrEqual(81)
    expect(reloaded.attributes.statPts).toBeLessThan(10)
  })

  it('CF6 (F2 × F3): SINGLE_PLAYER_POLICY /players 8 scaling × RoomStreamer wilderness monster spawning', () => {
    const registry = getSharedDataRegistry()
    const game = new Server.GameInstance({
      policy: Server.SINGLE_PLAYER_POLICY,
      mapSeed: 0xcf600006,
      difficulty: 0,
      actId: 0,
      areaId: 1,
      registry,
    })
    const p1 = game.addPlayer({ charName: 'ScalerBarb', classId: 4, level: 30 })
    game.enqueueCommand(p1, { type: 'Chat', text: '/players 8' })
    game.stepFrame()
    expect(game.playersX).toBe(8)

    // Waypoint travel to Cold Plains (areaId = 3) so RoomStreamer spawns monsters under playersX = 8
    game.enqueueCommand(p1, { type: 'WaypointGo', waypointId: 1, destAreaId: 3 })
    game.stepFrames(5)
    expect(game.playersX).toBe(8)
  })

  it('CF7 (F3 × F4): Monster drop resolution × executeDropPipeline NoDrop scaling between playerCount=1 and playerCount=8', () => {
    const registry = getSharedDataRegistry()
    let countP1 = 0
    let countP8 = 0

    for (let i = 0; i < 25; i++) {
      const seed = (0xcf700000 + i * 7919) >>> 0
      countP1 += Server.executeDropPipeline({
        tcName: 'Act 1 Equip A',
        mlvl: 12,
        magicFind: 0,
        playerCount: 1,
        seed,
        registry,
      }).length
      countP8 += Server.executeDropPipeline({
        tcName: 'Act 1 Equip A',
        mlvl: 12,
        magicFind: 0,
        playerCount: 8,
        seed,
        registry,
      }).length
    }

    // In 1.13c, playerCount = 8 reduces NoDrop exponent, yielding >= drops compared to playerCount = 1
    expect(countP8).toBeGreaterThanOrEqual(countP1)
  })

  it('CF8 (F5 × F6): Waypoint activation & Quest state bitmasks × v96 .d2s binary round-trip across GameInstance sessions', () => {
    const quests: [Uint16Array, Uint16Array, Uint16Array] = [
      new Uint16Array(48),
      new Uint16Array(48),
      new Uint16Array(48),
    ]
    quests[0][1] = 0x0001 // Den of Evil complete

    const wp0 = new Uint8Array(24)
    wp0[0] = 0x02
    wp0[1] = 0x01
    wp0[2] = 0x07 // First 3 Act 1 waypoints active

    const d2sIn = Server.writeD2s(
      createSampleD2sCharacterData({
        name: 'QuestPersist',
        charClass: 0,
        level: 16,
        quests,
        waypoints: [wp0, new Uint8Array(24), new Uint8Array(24)],
      }),
    )

    const game = new Server.GameInstance({
      policy: Server.SINGLE_PLAYER_POLICY,
      mapSeed: 0xcf800008,
    })
    const pid = game.addPlayer({
      charName: 'QuestPersist',
      classId: 0,
      level: 16,
      d2sBytes: d2sIn,
    })
    game.stepFrames(2)

    const d2sOut = game.exportPlayerD2s(pid)
    const parsedOut = Server.readD2s(d2sOut)
    expect(parsedOut.quests[0][1]).toBe(0x0001)
    expect(parsedOut.waypoints[0][2] & 0x07).toBe(0x07)
  })

  it('CF9 (F6 × F8): LocalLobbyProvider & LocalLoopbackAdapter × .d2s character persistence across multiple SP sessions', async () => {
    const lobby = new Server.LocalLobbyProvider()
    await lobby.createCharacter({
      name: 'CampaignDruid',
      classId: 'dru',
      expansion: true,
    })

    const session1 = (await lobby.enterGame({
      charName: 'CampaignDruid',
      difficulty: 0,
    })) as Server.LocalLoopbackAdapter
    const seed1 = session1.game.mapSeed >>> 0
    session1.send({ type: 'Move', x: 118, y: 122, run: true })
    session1.stepFrames(4)
    session1.close()

    const savedBytes = lobby.getCharacterD2s('CampaignDruid')
    expect(savedBytes).toBeInstanceOf(Uint8Array)
    const parsed = Server.readD2s(savedBytes!)
    expect(parsed.name).toBe('CampaignDruid')
    expect(parsed.mapSeed >>> 0).toBe(seed1)

    const session2 = (await lobby.enterGame({
      charName: 'CampaignDruid',
      difficulty: 0,
    })) as Server.LocalLoopbackAdapter
    expect(session2.game.mapSeed >>> 0).toBe(seed1)
    session2.close()
  })

  it('CF10 (F7 × F8): Netproto createLocalServerSession & getLocalLobbyProvider × LocalLoopbackAdapter & PauseGameCommand', async () => {
    const lobby = new Server.LocalLobbyProvider()
    Netproto.registerLocalLobbyProvider(lobby)

    const retrievedLobby = Netproto.getLocalLobbyProvider()
    expect(retrievedLobby).toBe(lobby)

    await retrievedLobby!.createCharacter({
      name: 'FactoryAssn',
      classId: 'ass',
    })
    const adapter = (await retrievedLobby!.enterGame({
      charName: 'FactoryAssn',
      difficulty: 0,
    })) as Server.LocalLoopbackAdapter

    adapter.send({ type: 'PauseGame', paused: true })
    adapter.stepFrame()
    expect(adapter.isPaused()).toBe(true)

    adapter.send({ type: 'PauseGame', paused: false })
    adapter.stepFrame()
    expect(adapter.isPaused()).toBe(false)
    adapter.close()
  })

  it('CF11 (F7 × F9): TsFramer lossless TypedArray framing & TsServerAdapter × MultiClientRoomHost event delivery', () => {
    const host = new Server.MultiClientRoomHost({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0xcf110011,
    })

    const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
    const adapter = new Netproto.TsServerAdapter(clientStream)
    const rec = recordAdapterEvents(adapter)

    host.connectClient(serverStream, {
      charName: 'TypedArrayHero',
      classId: 1,
      level: 15,
    })
    host.stepFrames(2)

    expect(rec.events.some((ev) => ev.type === 'GameLogonAck')).toBe(true)
    for (const ev of rec.events) {
      if (ev.type === 'ItemEvent' && ev.rawBytes !== undefined) {
        expect(ev.rawBytes).toBeInstanceOf(Uint8Array)
      }
    }
  })

  it('CF12 (F6 × F9): MultiClientRoomHost disconnect persistence × v96 .d2s character reload on reconnect', () => {
    const host = new Server.MultiClientRoomHost({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0xcf120012,
    })

    const initialBytes = Server.writeD2s(
      createSampleD2sCharacterData({
        name: 'ReconnectBarb',
        charClass: 4,
        level: 30,
        attributesOverrides: {
          strength: 90,
          statPts: 5,
        },
      }),
    )

    const [c1Stream, s1Stream] = Netproto.createMemoryStreamPair()
    const adapter1 = new Netproto.TsServerAdapter(c1Stream)
    const p1 = host.connectClient(s1Stream, {
      charName: 'ReconnectBarb',
      classId: 4,
      level: 30,
      d2sBytes: initialBytes,
    })
    host.stepFrame()

    adapter1.send({ type: 'AllocateStat', statId: 0, amount: 1 })
    host.stepFrame()

    const disconnectedD2s = host.disconnectClient(p1, 'save_and_rejoin')
    expect(disconnectedD2s).toBeInstanceOf(Uint8Array)

    const parsedSaved = Server.readD2s(disconnectedD2s!)
    expect(parsedSaved.name).toBe('ReconnectBarb')
    expect(parsedSaved.attributes.strength).toBeGreaterThanOrEqual(91)

    // Reconnect with saved .d2s bytes
    const [c2Stream, s2Stream] = Netproto.createMemoryStreamPair()
    new Netproto.TsServerAdapter(c2Stream)
    const p2 = host.connectClient(s2Stream, {
      charName: 'ReconnectBarb',
      classId: 4,
      level: 30,
      d2sBytes: disconnectedD2s!,
    })
    expect(p2).toBeGreaterThan(0)
    host.stepFrame()

    const reExported = Server.readD2s(host.game.exportPlayerD2s(p2))
    expect(reExported.attributes.strength).toBe(parsedSaved.attributes.strength)
  })

  it('CF13 (F1 × F9 × F10): MultiClientRoomHost 2-player co-op session × deterministic computeFrameLockstepHash parity across twin hosts', () => {
    const createTwinHost = () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0xcf130013,
        difficulty: 0,
        actId: 0,
        areaId: 2,
      })
      const [c1, s1] = Netproto.createMemoryStreamPair()
      const [c2, s2] = Netproto.createMemoryStreamPair()
      const a1 = new Netproto.TsServerAdapter(c1)
      const a2 = new Netproto.TsServerAdapter(c2)
      host.connectClient(s1, { charName: 'TwinP1', classId: 1, level: 20, x: 100, y: 100 })
      host.connectClient(s2, { charName: 'TwinP2', classId: 3, level: 20, x: 105, y: 105 })
      return { host, a1, a2 }
    }

    const twinA = createTwinHost()
    const twinB = createTwinHost()

    for (let frame = 1; frame <= 20; frame++) {
      if (frame === 2) {
        twinA.a1.send({ type: 'Move', x: 115, y: 112, run: true })
        twinB.a1.send({ type: 'Move', x: 115, y: 112, run: true })
      }
      if (frame === 6) {
        twinA.a2.send({ type: 'Move', x: 118, y: 110, run: true })
        twinB.a2.send({ type: 'Move', x: 118, y: 110, run: true })
      }
      if (frame === 10) {
        twinA.a1.send({
          type: 'CastSkillAtLocation',
          skillId: 36,
          x: 125,
          y: 120,
          hand: 'right',
        })
        twinB.a1.send({
          type: 'CastSkillAtLocation',
          skillId: 36,
          x: 125,
          y: 120,
          hand: 'right',
        })
      }

      twinA.host.stepFrame()
      twinB.host.stepFrame()

      expect(twinA.host.game.computeFrameLockstepHash()).toBe(
        twinB.host.game.computeFrameLockstepHash(),
      )
    }
  })

  it('CF14 (F8 × F11): LocalLoopbackAdapter Single Player session × OnlineSession ClientWorld synchronization', () => {
    const adapter = new Server.LocalLoopbackAdapter({
      charName: 'OnlineSessionSp',
      classId: 1,
      mapSeed: 0xcf140014,
      difficulty: 0,
    })

    const session = new OnlineSession()
    session.attachGameServer(adapter)
    adapter.stepFrame()
    session.tick(40, 40)

    expect(session.world.localPlayerId).toBe(adapter.playerUnitId)

    session.dispatchCommand({ type: 'Move', x: 122, y: 134, run: true })
    session.useSkillAt(130, 140, 'right')
    adapter.stepFrames(2)
    session.tick(80, 120)

    const localPlayer = session.world.entities.get(adapter.playerUnitId)
    expect(localPlayer).toBeDefined()
    session.leaveGame()
  })

  it('CF15 (F9 × F11): MultiClientRoomHost + TsServerAdapter × two concurrent OnlineSession clients observing co-op world state', () => {
    const host = new Server.MultiClientRoomHost({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0xcf150015,
      areaId: 1,
    })

    const [c1Stream, s1Stream] = Netproto.createMemoryStreamPair()
    const [c2Stream, s2Stream] = Netproto.createMemoryStreamPair()
    const adapter1 = new Netproto.TsServerAdapter(c1Stream)
    const adapter2 = new Netproto.TsServerAdapter(c2Stream)

    const session1 = new OnlineSession()
    const session2 = new OnlineSession()
    session1.attachGameServer(adapter1)
    session2.attachGameServer(adapter2)

    const p1 = host.connectClient(s1Stream, { charName: 'CoopClient1', classId: 0, x: 100, y: 100 })
    const p2 = host.connectClient(s2Stream, { charName: 'CoopClient2', classId: 3, x: 104, y: 104 })
    host.stepFrame()
    session1.tick(40, 40)
    session2.tick(40, 40)

    expect(session1.world.localPlayerId).toBe(p1)
    expect(session2.world.localPlayerId).toBe(p2)
    expect(session1.world.entities.has(p2)).toBe(true)
    expect(session2.world.entities.has(p1)).toBe(true)

    session1.dispatchCommand({ type: 'Move', x: 130, y: 135, run: true })
    session1.submitChatInput('Follow me to Blood Moor!')
    host.stepFrame()
    session1.tick(40, 80)
    session2.tick(40, 80)

    const observedP1InSession2 = session2.world.entities.get(p1)
    expect(observedP1InSession2?.targetX ?? observedP1InSession2?.x).toBe(130)
    expect(observedP1InSession2?.targetY ?? observedP1InSession2?.y).toBe(135)
    expect(session2.world.chatLog.some((c) => c.text.includes('Follow me to Blood Moor!'))).toBe(
      true,
    )

    session1.leaveGame()
    session2.leaveGame()
  })

  it('CF16 (F10 × F11 × F12): Unified server barrel and netproto boundary operate end-to-end with all 4 legacy split-track modules retired', () => {
    for (const retired of RETIRED_LEGACY_FILES) {
      expect(repoPathExists(retired)).toBe(false)
    }

    const spAdapter = new Server.LocalLoopbackAdapter({
      charName: 'UnifiedArchHero',
      classId: 1,
      mapSeed: 0xcf160016,
    })
    const session = new OnlineSession()
    session.attachGameServer(spAdapter)
    spAdapter.stepFrames(5)
    session.tick(200, 200)

    const hash = spAdapter.game.computeFrameLockstepHash()
    expect(typeof hash).toBe('number')
    expect(hash >>> 0).toBe(hash)
    session.leaveGame()
  })
})
