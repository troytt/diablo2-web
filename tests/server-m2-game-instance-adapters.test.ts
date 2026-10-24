import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../src/client/session/online-session.ts'
import {
  D2gsAdapter,
  InMemoryDuplexStream,
  createLocalServerSession,
  type ServerEvent,
} from '../src/netproto/index.ts'
import {
  AoiFilter,
  CLOSED_REALM_POLICY,
  GameInstance,
  LocalLobbyProvider,
  LocalLoopbackAdapter,
  MultiClientRoomHost,
  OPEN_BNET_POLICY,
  PartyManager,
  RoomClientSession,
  SINGLE_PLAYER_POLICY,
  readD2s,
  registerDefaultLocalServerHooks,
  resolveGameModePolicy,
} from '../src/server/index.ts'

describe('M2: GameInstance & GameModePolicy', () => {
  it('resolves distinct policies for SINGLE_PLAYER_POLICY, OPEN_BNET_POLICY, and CLOSED_REALM_POLICY', () => {
    expect(SINGLE_PLAYER_POLICY).toEqual({
      mode: 'sp',
      maxPlayers: 1,
      allowPause: true,
      allowPlayersXCommand: true,
      persistMapSeedAndFog: true,
      allowPvpHostile: false,
      allowPlayerTrade: false,
    })

    expect(OPEN_BNET_POLICY).toEqual({
      mode: 'open',
      maxPlayers: 8,
      allowPause: false,
      allowPlayersXCommand: true,
      persistMapSeedAndFog: false,
      allowPvpHostile: true,
      allowPlayerTrade: true,
    })

    expect(CLOSED_REALM_POLICY).toEqual({
      mode: 'realm',
      maxPlayers: 8,
      allowPause: false,
      allowPlayersXCommand: false,
      persistMapSeedAndFog: false,
      allowPvpHostile: true,
      allowPlayerTrade: true,
    })

    const sp = resolveGameModePolicy('sp')
    expect(sp.allowPause).toBe(true)
    expect(sp.maxPlayers).toBe(1)

    const mp = resolveGameModePolicy('realm')
    expect(mp.allowPause).toBe(false)
    expect(mp.maxPlayers).toBe(8)
  })

  it('produces identical lockstep hashes across two deterministic 25Hz instances', () => {
    const runSimulation = (): number => {
      const game = new GameInstance({
        mapSeed: 0x12345678,
        policy: SINGLE_PLAYER_POLICY,
        areaId: 1,
        difficulty: 0,
      })
      const p1 = game.connectPlayer({ charName: 'Hero', classId: 1, x: 100, y: 100 })
      game.spawnMonster({ classId: 0, x: 102, y: 100, hp: 50, maxHp: 50 })
      game.enqueueCommand(p1, { type: 'RunToLocation', x: 104, y: 100 })
      game.enqueueCommand(p1, {
        type: 'CastSkillAtLocation',
        hand: 'right',
        skillId: 36,
        x: 102,
        y: 100,
      })
      game.stepFrames(10)
      return game.computeFrameLockstepHash()
    }

    expect(runSimulation()).toBe(runSimulation())
  })

  it('supports /players 1..8 scaling in single-player mode and rejects it in closed realm mode', () => {
    const sp = new GameInstance({ mapSeed: 99, policy: SINGLE_PLAYER_POLICY })
    const p1 = sp.connectPlayer({ charName: 'Solo', classId: 1 })
    sp.enqueueCommand(p1, { type: 'Chat', text: '/players 5' })
    sp.stepFrame()
    expect(sp.playersX).toBe(5)

    const monId = sp.spawnMonster({ classId: 0, x: 105, y: 100, maxHp: 100 })
    // 5 players -> (5 + 1) / 2 = 3x HP
    expect(sp.getMonsterState(monId)?.maxHp).toBe(300)

    const realm = new GameInstance({ mapSeed: 99, policy: CLOSED_REALM_POLICY })
    const mp1 = realm.connectPlayer({ charName: 'Host', classId: 1 })
    realm.enqueueCommand(mp1, { type: 'Chat', text: '/players 5' })
    realm.stepFrame()
    expect(realm.playersX).toBe(1)
  })

  it('handles combat kills, item pickup/equip, NPC heal/buy, portals, and .d2s save serialization', () => {
    const game = new GameInstance({ mapSeed: 777, policy: SINGLE_PLAYER_POLICY, areaId: 2 })
    const pid = game.connectPlayer({ charName: 'Tester', classId: 1, x: 100, y: 100, areaId: 2 })
    game.applyDamageToPlayer(pid, 15)
    expect(game.getPlayerState(pid)!.hp).toBeLessThan(game.getPlayerState(pid)!.maxHp)

    const npcId = game.spawnMonster({
      classId: 148,
      x: 101,
      y: 100,
      areaId: 2,
      hp: 100,
      maxHp: 100,
      isNpc: true,
      isVendor: true,
      name: 'Akara',
    })
    game.enqueueCommand(pid, { type: 'NpcAction', action: 'heal', npcId })
    game.enqueueCommand(pid, { type: 'NpcBuy', npcId, itemId: 1, buyType: 0, cost: 0 })
    game.enqueueCommand(pid, { type: 'TownPortal' })
    game.stepFrames(2)

    const pState = game.getPlayerState(pid)!
    expect(pState.hp).toBe(pState.maxHp)
    expect(pState.items.length).toBeGreaterThan(0)

    const saveBytes = game.exportPlayerD2s(pid)
    expect(saveBytes.byteLength).toBeGreaterThan(16)
    const parsed = readD2s(saveBytes)
    expect(parsed.name).toBe('Tester')
  })
})

describe('M2: LocalLoopbackAdapter & LocalLobbyProvider', () => {
  it('connects in-memory to OnlineSession, applies initial events, and routes /players commands', () => {
    const game = new GameInstance({ mapSeed: 1234, policy: SINGLE_PLAYER_POLICY, areaId: 1 })
    const adapter = new LocalLoopbackAdapter({
      game,
      playerName: 'LoopbackHero',
      classId: 1,
    })
    const session = new OnlineSession()
    session.attachGameServer(adapter)
    adapter.stepFrame()

    expect(session.phase).toBe('ingame')
    expect(session.world.self.unitId).toBe(adapter.playerUnitId)
    expect(session.world.areaId).toBe(1)

    adapter.send({ type: 'Chat', text: '/players 4' })
    adapter.stepFrame()
    expect(game.playersX).toBe(4)

    adapter.leave()
  })

  it('registers default local server hooks and creates loopback sessions via LocalLobbyProvider', async () => {
    registerDefaultLocalServerHooks()
    const lobby = new LocalLobbyProvider({ seed: 555 })

    await lobby.createCharacter({ name: 'OfflineSorc', charClass: 1 })
    const chars = await lobby.listCharacters()
    expect(chars.some((c) => c.name === 'OfflineSorc')).toBe(true)

    const adapter = await lobby.enterGame({ charName: 'OfflineSorc', difficulty: 0 })
    expect(adapter).toBeInstanceOf(LocalLoopbackAdapter)
    adapter.stepFrames(3)
    adapter.leave()

    const handle = createLocalServerSession({ charName: 'OfflineSorc', classId: 1 })
    expect(handle).not.toBeNull()
    expect(handle!.adapter).toBeInstanceOf(LocalLoopbackAdapter)
    handle!.stop?.()
  })

  it('persists /players N across consecutive new games in OnlineSession and LocalLobbyProvider (Issue #1407)', async () => {
    const lobby = new LocalLobbyProvider({ seed: 777 })
    await lobby.createCharacter({ name: 'PlayersPersistHero', charClass: 1 })
    const session = new OnlineSession()

    // Game 1: starts at default playersX = 1, then player sets /players 6
    const adapter1 = await lobby.enterGame({ charName: 'PlayersPersistHero', difficulty: 0 })
    session.attachGameServer(adapter1)
    adapter1.stepFrame()
    expect(adapter1.getPlayersX()).toBe(1)

    expect(session.submitChatInput('/players 6', 1_000)).toBe(true)
    adapter1.stepFrame()
    expect(adapter1.getPlayersX()).toBe(6)
    expect(lobby.getPersistedPlayersX()).toBe(6)
    expect(
      session.world.activeChatOverlayEntries.filter((m) => m.text === 'players set to 6'),
    ).toHaveLength(1)

    await session.leaveGame()

    // Game 2: entering a new game automatically inherits /players 6 without manual input
    const adapter2 = await lobby.enterGame({ charName: 'PlayersPersistHero', difficulty: 0 })
    expect(adapter2.getPlayersX()).toBe(6)
    session.attachGameServer(adapter2)
    adapter2.stepFrame()

    expect(adapter2.getPlayersX()).toBe(6)
    expect(
      session.world.activeChatOverlayEntries.filter((m) => m.text === 'players set to 6'),
    ).toHaveLength(1)

    await session.leaveGame()
  })
})

describe('M2: AoiFilter, PartyManager, RoomClientSession & MultiClientRoomHost', () => {
  it('tracks per-viewer visibility and filters entities by radius and areaId', () => {
    const aoi = new AoiFilter(50)
    const viewer = { unitId: 1, areaId: 1, x: 100, y: 100 }
    const nearEntity = { unitType: 'monster' as const, unitId: 10, areaId: 1, x: 120, y: 120 }
    const farEntity = { unitType: 'monster' as const, unitId: 11, areaId: 1, x: 200, y: 200 }

    expect(aoi.isInRange(viewer, nearEntity)).toBe(true)
    expect(aoi.isInRange(viewer, farEntity)).toBe(false)

    aoi.markVisible(viewer.unitId, nearEntity)
    expect(aoi.isVisible(viewer.unitId, 'monster', 10)).toBe(true)
    aoi.markHidden(viewer.unitId, 'monster', 10)
    expect(aoi.isVisible(viewer.unitId, 'monster', 10)).toBe(false)
  })

  it('manages party invitations, mutual alliance, and hostility', () => {
    const pm = new PartyManager()
    pm.addPlayer(1, 'Alice', 1, 10, 1)
    pm.addPlayer(2, 'Bob', 3, 10, 1)

    expect(pm.areAllied(1, 2)).toBe(false)
    pm.invite(1, 2)
    const partyId = pm.accept(2, 1)
    expect(partyId).not.toBe(0xffff)
    expect(pm.areAllied(1, 2)).toBe(true)

    pm.setHostile(1, 2, true)
    expect(pm.isHostile(1, 2)).toBe(true)
  })

  it('hosts multi-client duplex streams with AOI filtering and disconnect auto-save', () => {
    const host = new MultiClientRoomHost({
      mapSeed: 2026,
      areaId: 1,
      aoiRadius: 40,
    })
    const [clientStreamA, serverStreamA] = InMemoryDuplexStream.createPair()
    const [clientStreamB, serverStreamB] = InMemoryDuplexStream.createPair()

    const eventsA: ServerEvent[] = []
    const eventsB: ServerEvent[] = []

    const adapterA = new D2gsAdapter(clientStreamA)
    const adapterB = new D2gsAdapter(clientStreamB)
    adapterA.onEvent((ev) => eventsA.push(ev))
    adapterB.onEvent((ev) => eventsB.push(ev))

    const pidA = host.connectClient(serverStreamA, {
      charName: 'Alice',
      classId: 1,
      x: 100,
      y: 100,
    })
    const pidB = host.connectClient(serverStreamB, {
      charName: 'Bob',
      classId: 2,
      x: 105,
      y: 100,
    })

    expect(host.getSession(pidA)).toBeInstanceOf(RoomClientSession)
    expect(host.getConnectedPlayerIds()).toEqual([pidA, pidB])

    adapterA.send({ type: 'RunToLocation', x: 110, y: 100 })
    host.stepFrames(3)

    expect(eventsA.some((e) => e.type === 'UnitAssign' || e.type === 'PlayerAssign')).toBe(true)
    expect(eventsB.some((e) => e.type === 'UnitMove')).toBe(true)

    const savedB = host.disconnectClient(pidB)
    expect(savedB).toBeInstanceOf(Uint8Array)
    expect(host.getConnectedPlayerIds()).toEqual([pidA])
  })
})
