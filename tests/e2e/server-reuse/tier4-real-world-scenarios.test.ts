/**
 * Tier 4 — Real-World Application Scenarios E2E Tests
 * (`tests/e2e/server-reuse/tier4-real-world-scenarios.test.ts`)
 *
 * Covers 6 comprehensive end-to-end user journeys and architectural scenarios (`RW1`–`RW6`)
 * spanning all 12 features (`F1`–`F12`) in `PROJECT.md § Feature Inventory`.
 */

import { describe, expect, it } from 'vitest'
import * as Server from '../../../src/server/index.ts'
import * as Netproto from '../../../src/netproto/index.ts'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import {
  collectTsFilesRecursive,
  createSampleD2sCharacterData,
  getSharedDataRegistry,
  readRepoFile,
  recordAdapterEvents,
  repoPathExists,
  RETIRED_LEGACY_FILES,
  SRC_DIR,
  TESTS_DIR,
  toRepoRelative,
} from './helpers.ts'

describe('Tier 4 — Real-World Application Scenarios (RW1–RW6, 6 tests)', () => {
  it('RW1: Single Player Campaign Loopback Session (LocalLobbyProvider + LocalLoopbackAdapter full lifecycle)', async () => {
    const lobby = new Server.LocalLobbyProvider({
      registry: getSharedDataRegistry(),
    })
    Netproto.registerLocalLobbyProvider(lobby)

    // 1. Create Single Player Sorceress character via LocalLobbyProvider
    const summary = await lobby.createCharacter({
      name: 'CampaignSorc',
      classId: 'sor',
      expansion: true,
      hardcore: false,
    })
    expect(summary.name).toBe('CampaignSorc')
    expect(summary.classId).toBe('sor')

    // Seed initial character with skill points, stat points, and Cold Plains waypoint unlocked
    const wp0 = new Uint8Array(24)
    wp0[0] = 0x02
    wp0[1] = 0x01
    wp0[2] = 0x03 // Rogue Encampment + Cold Plains unlocked
    const seededBytes = Server.writeD2s(
      createSampleD2sCharacterData({
        name: 'CampaignSorc',
        charClass: 1,
        level: 18,
        activeDifficulty: 0,
        mapSeed: 0x13572468,
        waypoints: [wp0, new Uint8Array(24), new Uint8Array(24)],
        attributesOverrides: {
          strength: 45,
          energy: 75,
          dexterity: 35,
          vitality: 65,
          statPts: 10,
          skillPts: 5,
        },
      }),
    )
    lobby.importCharacterD2s(seededBytes)

    // 2. Enter Normal difficulty game via LocalLoopbackAdapter
    const spSession1 = (await lobby.enterGame({
      charName: 'CampaignSorc',
      difficulty: 0,
    })) as Server.LocalLoopbackAdapter
    const rec1 = recordAdapterEvents(spSession1)

    expect(spSession1.game.policy).toEqual(Server.SINGLE_PLAYER_POLICY)
    const normalSeed = spSession1.game.mapSeed >>> 0
    expect(normalSeed).toBe(0x13572468)

    // 3. Walk/run in town, allocate stat + skill points, scale /players 8
    spSession1.send({ type: 'Move', x: 112, y: 116, run: true })
    spSession1.send({ type: 'AllocateStat', statId: 0, amount: 2 }) // +2 Strength
    spSession1.send({ type: 'AllocateSkill', skillId: 36 }) // +1 Fire Bolt
    spSession1.send({ type: 'Chat', text: '/players 8' })
    spSession1.stepFrames(5)

    expect(spSession1.getPlayersX()).toBe(8)
    expect(rec1.events.some((ev) => ev.type === 'GameLogonAck')).toBe(true)
    expect(rec1.events.some((ev) => ev.type === 'UnitStatUpdate')).toBe(true)

    // 4. Waypoint travel to Cold Plains (areaId = 3), stream monsters, and cast Fire Bolt
    const spState = spSession1.game.getPlayerState(spSession1.playerUnitId)!
    const spWp = spSession1.game.spawnObject({
      classId: 119,
      x: spState.x,
      y: spState.y,
      areaId: spState.areaId,
      isWaypoint: true,
    })
    spSession1.send({ type: 'OperateObject', objectId: spWp })
    spSession1.stepFrames(1)
    spSession1.send({ type: 'WaypointGo', waypointId: 1, destAreaId: 3 })
    spSession1.stepFrames(3)

    spSession1.send({ type: 'SelectSkill', skillId: 36, hand: 'right' })
    spSession1.send({
      type: 'CastSkillAtLocation',
      skillId: 36,
      x: 125,
      y: 125,
      hand: 'right',
    })
    spSession1.stepFrames(8)

    // 5. Toggle ESC PauseGame
    spSession1.send({ type: 'PauseGame', paused: true })
    spSession1.stepFrame()
    expect(spSession1.isPaused()).toBe(true)
    const frameWhenPaused = spSession1.game.frame
    spSession1.stepFrames(5)
    expect(spSession1.game.frame).toBe(frameWhenPaused)

    spSession1.send({ type: 'PauseGame', paused: false })
    spSession1.stepFrames(2)
    expect(spSession1.isPaused()).toBe(false)
    expect(spSession1.game.frame).toBeGreaterThan(frameWhenPaused)

    // 6. Leave game and verify .d2s binary persistence
    spSession1.close()
    const savedNormalBytes = lobby.getCharacterD2s('CampaignSorc')
    expect(savedNormalBytes).toBeInstanceOf(Uint8Array)
    const parsedNormal = Server.readD2s(savedNormalBytes!)
    expect(parsedNormal.mapSeed >>> 0).toBe(normalSeed)
    expect(parsedNormal.attributes.strength).toBeGreaterThanOrEqual(46)

    // 7. Re-enter Normal difficulty -> verify mapSeed and stats are retained
    const spSession2 = (await lobby.enterGame({
      charName: 'CampaignSorc',
      difficulty: 0,
    })) as Server.LocalLoopbackAdapter
    expect(spSession2.game.mapSeed >>> 0).toBe(normalSeed)
    spSession2.close()

    // 8. Enter Nightmare difficulty (difficulty = 1) -> verify new deterministic mapSeed is rolled
    const spNightmare = (await lobby.enterGame({
      charName: 'CampaignSorc',
      difficulty: 1,
    })) as Server.LocalLoopbackAdapter
    const nightmareSeed = spNightmare.game.mapSeed >>> 0
    expect(nightmareSeed).not.toBe(0)
    expect(nightmareSeed).not.toBe(normalSeed)
    spNightmare.close()
  })

  it('RW2: Battle.net Multi-Client Co-op & AOI Room Session (MultiClientRoomHost + 3 TsServerAdapters + MemoryStream)', () => {
    const host = new Server.MultiClientRoomHost({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0x24681357,
      difficulty: 0,
      actId: 0,
      areaId: 1, // Rogue Encampment
      registry: getSharedDataRegistry(),
    })

    const wpUnlocked = new Uint8Array(24)
    wpUnlocked[0] = 0x02
    wpUnlocked[1] = 0x01
    wpUnlocked[2] = 0x07 // Rogue Encampment + Cold Plains + Stony Field unlocked

    const makePlayerD2s = (name: string, charClass: number) =>
      Server.writeD2s(
        createSampleD2sCharacterData({
          name,
          charClass,
          level: 25,
          waypoints: [wpUnlocked, new Uint8Array(24), new Uint8Array(24)],
        }),
      )

    const [c1Stream, s1Stream] = Netproto.createMemoryStreamPair()
    const [c2Stream, s2Stream] = Netproto.createMemoryStreamPair()
    const [c3Stream, s3Stream] = Netproto.createMemoryStreamPair()

    const adapter1 = new Netproto.TsServerAdapter(c1Stream)
    const adapter2 = new Netproto.TsServerAdapter(c2Stream)
    const adapter3 = new Netproto.TsServerAdapter(c3Stream)

    const rec1 = recordAdapterEvents(adapter1)
    const rec2 = recordAdapterEvents(adapter2)
    const rec3 = recordAdapterEvents(adapter3)

    const p1 = host.connectClient(s1Stream, {
      charName: 'CoopPaladin',
      classId: 3,
      level: 25,
      x: 100,
      y: 100,
      d2sBytes: makePlayerD2s('CoopPaladin', 3),
    })
    const p2 = host.connectClient(s2Stream, {
      charName: 'CoopSorceress',
      classId: 1,
      level: 25,
      x: 102,
      y: 102,
      d2sBytes: makePlayerD2s('CoopSorceress', 1),
    })
    const p3 = host.connectClient(s3Stream, {
      charName: 'TownNecro',
      classId: 2,
      level: 25,
      x: 104,
      y: 104,
      d2sBytes: makePlayerD2s('TownNecro', 2),
    })

    expect(host.getConnectedPlayerIds()).toEqual([p1, p2, p3])
    host.stepFrame()

    // All 3 players receive GameLogonAck and Party roster
    for (const rec of [rec1, rec2, rec3]) {
      expect(rec.events.some((e) => e.type === 'GameLogonAck')).toBe(true)
      expect(rec.events.some((e) => e.type === 'Party')).toBe(true)
    }

    // Player 1 & Player 2 travel to Cold Plains (areaId = 3) while Player 3 remains in Rogue Encampment (areaId = 1)
    const p1State = host.game.getPlayerState(p1)!
    const sharedWp = host.game.spawnObject({
      classId: 119,
      x: p1State.x,
      y: p1State.y,
      areaId: p1State.areaId,
      isWaypoint: true,
    })
    adapter1.send({ type: 'OperateObject', objectId: sharedWp })
    adapter2.send({ type: 'OperateObject', objectId: sharedWp })
    host.stepFrames(1)
    adapter1.send({ type: 'WaypointGo', waypointId: 1, destAreaId: 3 })
    adapter2.send({ type: 'WaypointGo', waypointId: 1, destAreaId: 3 })
    host.stepFrames(2)

    rec1.clear()
    rec2.clear()
    rec3.clear()

    // Player 1 moves and casts Fire Bolt in Cold Plains (areaId = 3), and sends a global Chat message
    adapter1.send({ type: 'Move', x: 130, y: 135, run: true })
    adapter1.send({
      type: 'CastSkillAtLocation',
      skillId: 36,
      x: 140,
      y: 140,
      hand: 'right',
    })
    adapter1.send({ type: 'Chat', text: 'Fighting in Cold Plains!' })
    host.stepFrames(3)

    // Player 2 (same areaId = 3) receives Player 1's spatial UnitMove and global Chat
    expect(
      rec2.events.some(
        (ev) => ev.type === 'UnitMove' && ev.unitId === p1,
      ),
    ).toBe(true)
    expect(
      rec2.events.some(
        (ev) => ev.type === 'Chat' && ev.text.includes('Fighting in Cold Plains!'),
      ),
    ).toBe(true)

    // Player 3 (in Rogue Encampment, areaId = 1) receives global Chat, but NOT distant spatial UnitMove from areaId = 3
    expect(
      rec3.events.some(
        (ev) => ev.type === 'Chat' && ev.text.includes('Fighting in Cold Plains!'),
      ),
    ).toBe(true)
    expect(
      rec3.events.some(
        (ev) => ev.type === 'UnitMove' && ev.unitId === p1,
      ),
    ).toBe(false)

    // Player 2 disconnects -> .d2s snapshot is saved and remaining players are notified
    rec1.clear()
    rec3.clear()
    const p2Saved = host.disconnectClient(p2, 'player2_exit')
    host.stepFrame()

    expect(p2Saved).toBeInstanceOf(Uint8Array)
    expect(Server.readD2s(p2Saved!).name).toBe('CoopSorceress')
    expect(host.getConnectedPlayerIds()).toEqual([p1, p3])
    expect(
      rec1.events.some(
        (ev) => (ev.type === 'UnitRemove' && ev.unitId === p2) || ev.type === 'Party',
      ),
    ).toBe(true)
  })

  it('RW3: Battle.net Binary D2GS Wire Session (MultiClientRoomHost + D2gsServerAdapter / D2gsC2sFramer / D2gsS2cFramer)', () => {
    const host = new Server.MultiClientRoomHost({
      policy: Server.CLOSED_REALM_POLICY,
      mapSeed: 0x369cf012,
      difficulty: 0,
      actId: 0,
      areaId: 1,
    })

    const [clientStream1, serverStream1] = Netproto.createMemoryStreamPair()
    const [clientStream2, serverStream2] = Netproto.createMemoryStreamPair()

    const d2gsClient1 = new Netproto.D2gsServerAdapter(clientStream1, {
      charName: 'D2gsAmazon',
      classId: 0,
    })
    const d2gsClient2 = new Netproto.D2gsServerAdapter(clientStream2, {
      charName: 'D2gsBarb',
      classId: 4,
    })

    const rec1 = recordAdapterEvents(d2gsClient1)
    const rec2 = recordAdapterEvents(d2gsClient2)

    const p1 = host.connectClient(serverStream1, {
      charName: 'D2gsAmazon',
      classId: 0,
      x: 100,
      y: 100,
    })
    const p2 = host.connectClient(serverStream2, {
      charName: 'D2gsBarb',
      classId: 4,
      x: 105,
      y: 105,
    })

    expect(p1).toBeGreaterThan(0)
    expect(p2).toBeGreaterThan(0)
    host.stepFrames(2)

    expect(rec1.events.length).toBeGreaterThan(0)
    expect(rec2.events.length).toBeGreaterThan(0)

    d2gsClient1.send({ type: 'Move', x: 120, y: 122, run: true })
    d2gsClient2.send({
      type: 'CastSkillAtLocation',
      skillId: 0,
      x: 118,
      y: 120,
      hand: 'right',
    })
    host.stepFrames(3)

    // 1.13c: the walk/run UnitMove goes to the other client, never back to the mover (issue #1329).
    const isP1Move = (ev: Netproto.ServerEvent): boolean =>
      ev.type === 'UnitMove' && (ev.id === p1 || ev.unitId === p1)
    expect(rec2.events.some(isP1Move)).toBe(true)
    expect(rec1.events.some(isP1Move)).toBe(false)
  })

  it('RW4: Deterministic Lockstep Replay & State Hash Verification over 250 frames (10s @ 25Hz)', () => {
    const registry = getSharedDataRegistry()

    const buildSimulation = () => {
      const game = new Server.GameInstance({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x87654321,
        difficulty: 0,
        actId: 0,
        areaId: 2, // Blood Moor
        registry,
      })

      const p1D2s = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'LockstepSorc',
          charClass: 1,
          level: 30,
          mapSeed: 0x87654321,
        }),
      )
      const p2D2s = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'LockstepPal',
          charClass: 3,
          level: 30,
          mapSeed: 0x87654321,
        }),
      )

      const p1 = game.addPlayer({
        charName: 'LockstepSorc',
        classId: 1,
        level: 30,
        x: 100,
        y: 100,
        d2sBytes: p1D2s,
      })
      const p2 = game.addPlayer({
        charName: 'LockstepPal',
        classId: 3,
        level: 30,
        x: 106,
        y: 106,
        d2sBytes: p2D2s,
      })

      return { game, p1, p2, lockstep: new Server.LockstepSession() }
    }

    const simA = buildSimulation()
    const simB = buildSimulation()

    for (let f = 1; f <= 250; f++) {
      if (f % 20 === 1) {
        const destX = 100 + ((f * 7) % 60)
        const destY = 100 + ((f * 11) % 60)
        simA.game.enqueueCommand(simA.p1, { type: 'Move', x: destX, y: destY, run: true })
        simB.game.enqueueCommand(simB.p1, { type: 'Move', x: destX, y: destY, run: true })
      }
      if (f % 25 === 5) {
        const targetX = 110 + ((f * 5) % 40)
        const targetY = 110 + ((f * 9) % 40)
        simA.game.enqueueCommand(simA.p1, {
          type: 'CastSkillAtLocation',
          skillId: 36, // Fire Bolt
          x: targetX,
          y: targetY,
          hand: 'right',
        })
        simB.game.enqueueCommand(simB.p1, {
          type: 'CastSkillAtLocation',
          skillId: 36,
          x: targetX,
          y: targetY,
          hand: 'right',
        })
      }
      if (f % 30 === 10) {
        const p2X = 105 + ((f * 3) % 50)
        const p2Y = 105 + ((f * 13) % 50)
        simA.game.enqueueCommand(simA.p2, { type: 'Move', x: p2X, y: p2Y, run: true })
        simB.game.enqueueCommand(simB.p2, { type: 'Move', x: p2X, y: p2Y, run: true })
      }

      simA.game.stepFrame()
      simB.game.stepFrame()

      const hashA = simA.game.computeFrameLockstepHash()
      const hashB = simB.game.computeFrameLockstepHash()

      expect(hashA, `Lockstep hash mismatch at frame ${f}`).toBe(hashB)
      simA.lockstep.recordFrame(f, hashA)
      expect(simA.lockstep.verifyPeerHash(f, hashB)).toBe(true)
    }

    expect(simA.game.frame).toBe(250)
    expect(simB.game.frame).toBe(250)
  })

  it('RW5: Client OnlineSession Dual-Mode Adapter Integration (Single Player LocalLoopbackAdapter <-> Battle.net TsServerAdapter)', () => {
    const session = new OnlineSession()

    // Phase 1: Single Player via LocalLoopbackAdapter
    const spAdapter = new Server.LocalLoopbackAdapter({
      charName: 'DualModeHero',
      classId: 1,
      mapSeed: 0x5555aaaa,
      difficulty: 0,
    })
    session.attachGameServer(spAdapter)
    spAdapter.stepFrame()
    session.tick(40, 40)

    expect(session.world.localPlayerId).toBe(spAdapter.playerUnitId)
    session.dispatchCommand({ type: 'Move', x: 128, y: 132, run: true })
    session.submitChatInput('/players 4')
    spAdapter.stepFrames(2)
    session.tick(80, 120)

    expect(spAdapter.getPlayersX()).toBe(4)
    // No self UnitMove echo in 1.13c (issue #1329): the authoritative server holds the target.
    const spState = spAdapter.gameInstance.getPlayerState(spAdapter.playerUnitId)!
    expect(spState.targetX).toBe(128)
    expect(spState.targetY).toBe(132)

    session.leaveGame()

    // Phase 2: Battle.net via TsServerAdapter + MultiClientRoomHost
    const roomHost = new Server.MultiClientRoomHost({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0x5555aaaa,
      difficulty: 0,
    })
    const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
    const bnetAdapter = new Netproto.TsServerAdapter(clientStream)
    session.attachGameServer(bnetAdapter)

    const bnetUnitId = roomHost.connectClient(serverStream, {
      charName: 'DualModeHero',
      classId: 1,
    })
    roomHost.stepFrame()
    session.tick(40, 160)

    expect(session.world.localPlayerId).toBe(bnetUnitId)
    session.dispatchCommand({ type: 'Move', x: 128, y: 132, run: true })
    roomHost.stepFrames(2)
    session.tick(80, 240)

    const bnetState = roomHost.gameInstance.getPlayerState(bnetUnitId)!
    expect(bnetState.targetX).toBe(128)
    expect(bnetState.targetY).toBe(132)

    session.leaveGame()
  })

  it('RW6: Architectural & Legacy Split-Track Retirement Audit (src/server/README.md, src/server/index.ts, strict module boundaries)', () => {
    // 1. All 4 legacy split-track prototype files and src/server/scene/ are permanently deleted
    for (const retired of RETIRED_LEGACY_FILES) {
      expect(repoPathExists(retired), `${retired} must not exist`).toBe(false)
    }
    expect(repoPathExists('src/server/scene')).toBe(false)

    // 2. Zero files across src/** and tests/** import any retired module
    const codeFiles = [
      ...collectTsFilesRecursive(SRC_DIR),
      ...collectTsFilesRecursive(TESTS_DIR),
    ].filter((f) => !toRepoRelative(f).startsWith('tests/e2e/server-reuse/'))

    for (const file of codeFiles) {
      const rel = toRepoRelative(file)
      const content = readRepoFile(rel)
      expect(content, `${rel} must not import retired engine/engine.ts`).not.toMatch(
        /server\/engine\/engine(?:\.ts)?['"]/,
      )
      expect(content, `${rel} must not import retired engine/combat.ts`).not.toMatch(
        /server\/engine\/combat(?:\.ts)?['"]/,
      )
      expect(content, `${rel} must not import retired scene/skill-caster.ts`).not.toMatch(
        /server\/scene\/skill-caster(?:\.ts)?['"]/,
      )
      expect(content, `${rel} must not import retired scene/weapon-combat.ts`).not.toMatch(
        /server\/scene\/weapon-combat(?:\.ts)?['"]/,
      )
    }

    // 3. src/server/README.md documents only existing files and includes the new unified modules
    const readme = readRepoFile('src/server/README.md')
    expect(readme).toContain('engine/game-instance.ts')
    expect(readme).toContain('loopback-adapter.ts')
    expect(readme).toContain('room-host.ts')
    expect(readme).toContain('save/d2s-reader.ts')
    expect(readme).toContain('save/d2s-writer.ts')

    // 4. Strict directional boundaries: src/client -x-> src/server and src/server -x-> src/client
    const clientFiles = collectTsFilesRecursive(`${SRC_DIR}/client`)
    for (const file of clientFiles) {
      const rel = toRepoRelative(file)
      const content = readRepoFile(rel)
      expect(content, `${rel} must not import src/server`).not.toMatch(
        /from\s+['"][^'"]*\/server(?:\/|['"])/,
      )
    }

    const serverFiles = collectTsFilesRecursive(`${SRC_DIR}/server`)
    for (const file of serverFiles) {
      const rel = toRepoRelative(file)
      const content = readRepoFile(rel)
      expect(content, `${rel} must not import src/client`).not.toMatch(
        /from\s+['"][^'"]*\/client(?:\/|['"])/,
      )
    }
  })
})
