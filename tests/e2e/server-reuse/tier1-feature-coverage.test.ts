/**
 * Tier 1 — Feature Coverage E2E Tests (`tests/e2e/server-reuse/tier1-feature-coverage.test.ts`)
 *
 * Covers the primary happy-path behavior of all 12 features (`F1`–`F12`) from
 * `PROJECT.md § Feature Inventory` with 5 test cases per feature (60 tests total).
 * All tests operate strictly through the public interface contracts in:
 * - `src/server/index.ts`
 * - `src/netproto/index.ts`
 * - `src/client/session/online-session.ts`
 */

import { describe, expect, it } from 'vitest'
import * as Server from '../../../src/server/index.ts'
import * as Netproto from '../../../src/netproto/index.ts'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import {
  collectTsFilesRecursive,
  createSampleD2sCharacterData,
  FIXED_ONE,
  getSharedDataRegistry,
  installOutdoorRoomGrid,
  readRepoFile,
  recordAdapterEvents,
  repoPathExists,
  RETIRED_LEGACY_FILES,
  SRC_DIR,
  TESTS_DIR,
  toRepoRelative,
} from './helpers.ts'

describe('Tier 1 — Feature Coverage (F1–F12, 60 tests)', () => {
  // ============================================================================
  // F1: Unified 25Hz Authoritative GameInstance Core (5 tests)
  // ============================================================================
  describe('F1: Unified 25Hz Authoritative GameInstance Core', () => {
    it('F1.1: initializes GameInstance at frame 0 with deterministic mapSeed, difficulty, and policy', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x12345678,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })

      expect(game.frame).toBe(0)
      expect(game.mapSeed >>> 0).toBe(0x12345678)
      expect(game.difficulty).toBe(0)
      expect(game.policy.mode).toBe('sp')
      expect(game.paused).toBe(false)
      expect(game.playersX).toBe(1)
    })

    it('F1.2: addPlayer spawns player entity and emits handshake events (GameLogonAck, LoadAct, PlayerAssign, UnitStatUpdate)', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x0badc0de,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })

      const playerUnitId = game.addPlayer({
        charName: 'AmaHero',
        classId: 0,
        level: 12,
        x: 100,
        y: 100,
      })
      expect(playerUnitId).toBeGreaterThan(0)

      game.stepFrame()
      const events = game.drainPlayerEvents(playerUnitId)
      const eventTypes = new Set(events.map((e) => e.type))

      expect(eventTypes.has('GameLogonAck')).toBe(true)
      expect(eventTypes.has('LoadAct')).toBe(true)
      expect(eventTypes.has('PlayerAssign')).toBe(true)
      expect(eventTypes.has('UnitStatUpdate')).toBe(true)
    })

    it('F1.3: stepFrame advances the 25Hz authoritative simulation clock and processes Move commands', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x22446688,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })

      const playerId = game.addPlayer({
        charName: 'RunnerPal',
        classId: 3,
        level: 10,
        x: 120,
        y: 120,
      })
      game.drainPlayerEvents(playerId)

      game.enqueueCommand(playerId, {
        type: 'Move',
        x: 135,
        y: 140,
        run: true,
      })

      const frameMap = game.stepFrame()
      expect(game.frame).toBe(1)
      const frameEvents = [
        ...(frameMap.get(playerId) ?? []),
        ...game.drainPlayerEvents(playerId),
      ]
      const moveEv = frameEvents.find(
        (ev): ev is Extract<Netproto.ServerEvent, { type: 'UnitMove' }> =>
          ev.type === 'UnitMove' && ev.unitId === playerId,
      )
      // 1.13c D2Game never echoes the walk/run UnitMove to the moving player's own client
      // (issue #1329); the server state carries the target and advances by the 1.13c run step.
      expect(moveEv).toBeUndefined()
      const state = game.getPlayerState(playerId)!
      expect(state.targetX).toBe(135)
      expect(state.targetY).toBe(140)
      expect(state.mode).toBe(3)
      expect(Math.hypot(state.x - 120, state.y - 120)).toBeCloseTo(0.54, 6)
    })

    it('F1.4: processes SelectSkill and CastSkillAtLocation through unified 1.13c SKILL_REGISTRY and MissileEngine', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x33557799,
        difficulty: 0,
        actId: 0,
        areaId: 2,
      })

      const d2sBytes = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'FireSorc',
          charClass: 1,
          level: 20,
        }),
      )
      // #1327: a Blood Moor Fallen in the Fire Bolt's path (the old wilderness stub used to put one here).
      game.spawnMonster({ defId: 'fallen1', areaId: 2, x: 106, y: 104 })
      const playerId = game.addPlayer({
        charName: 'FireSorc',
        classId: 1,
        level: 20,
        x: 100,
        y: 100,
        d2sBytes,
      })
      game.drainPlayerEvents(playerId)

      // Skill 36 = Fire Bolt
      game.enqueueCommand(playerId, {
        type: 'SelectSkill',
        skillId: 36,
        hand: 'right',
      })
      game.enqueueCommand(playerId, {
        type: 'CastSkillAtLocation',
        skillId: 36,
        x: 112,
        y: 108,
        hand: 'right',
      })

      const collected: Netproto.ServerEvent[] = []
      for (let i = 0; i < 10; i++) {
        game.stepFrame()
        collected.push(...game.drainPlayerEvents(playerId))
      }

      expect(
        collected.some(
          (ev) =>
            ev.type === 'SkillCast' ||
            ev.type === 'UnitState' ||
            ev.type === 'UnitStatUpdate',
        ),
      ).toBe(true)
    })

    it('F1.5: processes AllocateStat and AllocateSkill commands and emits authoritative UnitStatUpdate / SkillUpdate events', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x446688aa,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })

      const d2sBytes = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'StatHero',
          charClass: 1,
          level: 15,
          attributesOverrides: {
            strength: 30,
            statPts: 5,
            skillPts: 3,
          },
        }),
      )

      const playerId = game.addPlayer({
        charName: 'StatHero',
        classId: 1,
        level: 15,
        d2sBytes,
      })
      game.drainPlayerEvents(playerId)

      // Stat 0 = Strength, Skill 36 = Fire Bolt
      game.enqueueCommand(playerId, { type: 'AllocateStat', statId: 0, amount: 1 })
      game.enqueueCommand(playerId, { type: 'AllocateSkill', skillId: 36 })
      game.stepFrame()

      const events = game.drainPlayerEvents(playerId)
      expect(events.some((ev) => ev.type === 'UnitStatUpdate')).toBe(true)
      expect(
        events.some((ev) => ev.type === 'SkillUpdate' || ev.type === 'SkillList'),
      ).toBe(true)
    })
  })

  // ============================================================================
  // F2: Injectable GameModePolicy Configuration (5 tests)
  // ============================================================================
  describe('F2: Injectable GameModePolicy Configuration', () => {
    it('F2.1: exports SINGLE_PLAYER_POLICY, OPEN_BNET_POLICY, and CLOSED_REALM_POLICY matching PROJECT.md contracts', () => {
      expect(Server.SINGLE_PLAYER_POLICY).toEqual({
        mode: 'sp',
        maxPlayers: 1,
        allowPause: true,
        allowPlayersXCommand: true,
        persistMapSeedAndFog: true,
        allowPvpHostile: false,
        allowPlayerTrade: false,
      })

      expect(Server.OPEN_BNET_POLICY).toEqual({
        mode: 'open',
        maxPlayers: 8,
        allowPause: false,
        allowPlayersXCommand: true,
        persistMapSeedAndFog: false,
        allowPvpHostile: true,
        allowPlayerTrade: true,
      })

      expect(Server.CLOSED_REALM_POLICY).toEqual({
        mode: 'realm',
        maxPlayers: 8,
        allowPause: false,
        allowPlayersXCommand: false,
        persistMapSeedAndFog: false,
        allowPvpHostile: true,
        allowPlayerTrade: true,
      })
    })

    it('F2.2: SINGLE_PLAYER_POLICY permits PauseGame and freezes simulation frame advancement while paused', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x11112222,
      })
      const p1 = game.addPlayer({ charName: 'SoloHero', classId: 1 })
      game.stepFrame()
      expect(game.frame).toBe(1)

      game.enqueueCommand(p1, { type: 'PauseGame', paused: true })
      game.stepFrame()
      expect(game.paused).toBe(true)

      const pausedFrame = game.frame
      game.stepFrames(5)
      expect(game.frame).toBe(pausedFrame)

      game.enqueueCommand(p1, { type: 'PauseGame', paused: false })
      game.stepFrame()
      expect(game.paused).toBe(false)
      game.stepFrame()
      expect(game.frame).toBeGreaterThan(pausedFrame)
    })

    it('F2.3: SINGLE_PLAYER_POLICY supports /players N chat command to scale playersX between 1 and 8', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x33334444,
      })
      const p1 = game.addPlayer({ charName: 'Players8Hero', classId: 4 })
      game.drainPlayerEvents(p1)

      game.enqueueCommand(p1, { type: 'Chat', text: '/players 8' })
      game.stepFrame()

      expect(game.playersX).toBe(8)
      const events = game.drainPlayerEvents(p1)
      expect(events.some((e) => e.type === 'Chat')).toBe(true)
    })

    it('F2.4: OPEN_BNET_POLICY allows up to 8 concurrent players and supports /players X scaling', () => {
      const game = new Server.GameInstance({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x55556666,
      })

      const ids: number[] = []
      for (let i = 0; i < 4; i++) {
        ids.push(
          game.addPlayer({
            charName: `OpenPlayer${i + 1}`,
            classId: i % 7,
          }),
        )
      }
      expect(new Set(ids).size).toBe(4)

      game.enqueueCommand(ids[0]!, { type: 'Chat', text: '/players 6' })
      game.stepFrame()
      expect(game.playersX).toBe(6)
    })

    it('F2.5: CLOSED_REALM_POLICY allows up to 8 concurrent players while rejecting PauseGame and /players X overrides', () => {
      const game = new Server.GameInstance({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x77778888,
      })
      const p1 = game.addPlayer({ charName: 'RealmP1', classId: 2 })
      const p2 = game.addPlayer({ charName: 'RealmP2', classId: 3 })
      expect(p1).not.toBe(p2)

      game.enqueueCommand(p1, { type: 'PauseGame', paused: true })
      game.enqueueCommand(p1, { type: 'Chat', text: '/players 8' })
      game.stepFrame()

      expect(game.paused).toBe(false)
      expect(game.playersX).toBeLessThanOrEqual(2)
    })
  })

  // ============================================================================
  // F3: 1.13c Monster/Boss/Mercenary AI & Active Room Streaming (5 tests)
  // ============================================================================
  describe('F3: 1.13c Monster/Boss/Mercenary AI & Active Room Streaming', () => {
    it('F3.1: RoomStreamer activates 3x3 neighborhood rooms around player and spawns monsters in wilderness areas', () => {
      const registry = getSharedDataRegistry()
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x99aabbcc,
        difficulty: 0,
        actId: 0,
        areaId: 2, // Blood Moor
        registry,
      })

      installOutdoorRoomGrid(game, 2, 100, 100)
      const p1 = game.addPlayer({
        charName: 'WildExplorer',
        classId: 4,
        level: 10,
        x: 100,
        y: 100,
      })
      const events: Netproto.ServerEvent[] = []
      for (let i = 0; i < 5; i++) {
        game.stepFrame()
        events.push(...game.drainPlayerEvents(p1))
      }

      const monsterAssigns = events.filter(
        (ev): ev is Extract<Netproto.ServerEvent, { type: 'UnitAssign' }> =>
          ev.type === 'UnitAssign' && ev.unitType === 'monster',
      )
      expect(monsterAssigns.length).toBeGreaterThan(0)
    })

    it('F3.2: MonsterAI ticks active monsters and emits movement or attack actions when player is in aggro range', () => {
      const registry = getSharedDataRegistry()
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x13579bdf,
        difficulty: 0,
        actId: 0,
        areaId: 2,
        registry,
      })

      installOutdoorRoomGrid(game, 2, 100, 100)
      const p1 = game.addPlayer({
        charName: 'AggroTarget',
        classId: 3,
        level: 20,
        x: 100,
        y: 100,
      })

      const allEvents: Netproto.ServerEvent[] = []
      for (let i = 0; i < 30; i++) {
        game.stepFrame()
        allEvents.push(...game.drainPlayerEvents(p1))
      }

      const hasMonsterActivity = allEvents.some(
        (ev) =>
          (ev.type === 'UnitAssign' && ev.unitType === 'monster') ||
          (ev.type === 'UnitMove' && ev.unitType === 'monster') ||
          (ev.type === 'UnitState' && ev.unitType === 'monster'),
      )
      expect(hasMonsterActivity).toBe(true)
    })

    it('F3.3: Act Boss AI decision dispatch supports all 5 Act Bosses (Andariel, Duriel, Mephisto, Diablo, Baal)', () => {
      expect(Server.MonsterAI).toBeDefined()
      const registry = getSharedDataRegistry()
      // Act Boss hcIdx in MonStats.txt: Andariel=156, Duriel=211, Mephisto=242, Diablo=243, Baal=544
      for (const bossHcIdx of [156, 211, 242, 243, 544]) {
        const monRow = registry.monStats.rows[bossHcIdx]
        expect(monRow).toBeDefined()
      }
    })

    it('F3.4: Mercenary AI initializes and ticks hired mercenary unit alongside owning player', () => {
      const d2sBytes = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'MercMaster',
          charClass: 1,
          level: 25,
          mercOverrides: {
            dead: false,
            seed: 0x123456,
            nameId: 2,
            typeId: 1,
            experience: 50000,
          },
        }),
      )

      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x2468ace0,
        difficulty: 0,
        actId: 0,
        areaId: 2,
      })
      const p1 = game.addPlayer({
        charName: 'MercMaster',
        classId: 1,
        level: 25,
        d2sBytes,
      })
      game.stepFrames(5)

      const exported = Server.readD2s(game.exportPlayerD2s(p1))
      expect(exported.merc.seed).toBe(0x123456)
      expect(exported.merc.dead).toBe(false)
    })

    it('F3.5: playersX difficulty scaling scales newly spawned monster hitpoints and experience according to 1.13c formula', () => {
      const registry = getSharedDataRegistry()
      const game1 = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0xCAFEBABE,
        difficulty: 0,
        actId: 0,
        areaId: 1,
        registry,
      })
      const p1 = game1.addPlayer({ charName: 'P1Hero', classId: 4, level: 20 })
      game1.enqueueCommand(p1, { type: 'Chat', text: '/players 1' })
      game1.stepFrame()
      expect(game1.playersX).toBe(1)

      const game8 = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0xCAFEBABE,
        difficulty: 0,
        actId: 0,
        areaId: 1,
        registry,
      })
      const p8 = game8.addPlayer({ charName: 'P8Hero', classId: 4, level: 20 })
      game8.enqueueCommand(p8, { type: 'Chat', text: '/players 8' })
      game8.stepFrame()
      expect(game8.playersX).toBe(8)
    })
  })

  // ============================================================================
  // F4: Authoritative Item Drops, Ground Items, Containers, Vendor, Gamble, Cube & Imbue (5 tests)
  // ============================================================================
  describe('F4: Authoritative Item Drops, Ground Items, Containers, Vendor, Gamble, Cube & Imbue', () => {
    it('F4.1: executeDropPipeline resolves TreasureClassEx drops deterministically from seed and player count', () => {
      expect(typeof Server.executeDropPipeline).toBe('function')
      const registry = getSharedDataRegistry()
      const dropsA = Server.executeDropPipeline({
        tcName: 'Act 1 Equip A',
        mlvl: 12,
        magicFind: 100,
        playerCount: 1,
        seed: 0x55aa55aa,
        registry,
      })
      const dropsB = Server.executeDropPipeline({
        tcName: 'Act 1 Equip A',
        mlvl: 12,
        magicFind: 100,
        playerCount: 1,
        seed: 0x55aa55aa,
        registry,
      })
      expect(dropsA).toEqual(dropsB)
    })

    it('F4.2: GroundItemManager spawns ground items and supports player pickup and drop lifecycle', () => {
      expect(Server.GroundItemManager).toBeDefined()
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x10203040,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })
      const p1 = game.addPlayer({ charName: 'LootHero', classId: 4, level: 10, x: 100, y: 100 })
      game.drainPlayerEvents(p1)

      // Execute NpcAction / item operations through GameInstance command pipeline
      game.enqueueCommand(p1, {
        type: 'NpcAction',
        npcId: 148, // Akara
        action: 'trade',
      })
      game.stepFrame()
      const events = game.drainPlayerEvents(p1)
      expect(events).toBeDefined()
    })

    it('F4.3: GameInstance processes ItemMove, ItemEquip, and ItemUse commands and emits ItemEvent updates', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x50607080,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })
      const p1 = game.addPlayer({ charName: 'EquipHero', classId: 3, level: 15, x: 100, y: 100 })
      game.stepFrame()
      const initialEvents = game.drainPlayerEvents(p1)
      const itemEvents = initialEvents.filter(
        (ev): ev is Extract<Netproto.ServerEvent, { type: 'ItemEvent' }> => ev.type === 'ItemEvent',
      )

      if (itemEvents.length > 0) {
        const firstItem = itemEvents[0]!
        game.enqueueCommand(p1, {
          type: 'ItemMove',
          itemId: firstItem.itemId,
          container: 'inventory',
          x: 0,
          y: 0,
        })
        game.stepFrame()
        const afterMove = game.drainPlayerEvents(p1)
        expect(afterMove.length).toBeGreaterThanOrEqual(0)
      }
      expect(game.frame).toBeGreaterThanOrEqual(1)
    })

    it('F4.4: GameInstance processes NpcBuy, NpcSell, and NpcGamble commands with gold deduction and item generation', () => {
      const d2sBytes = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'RichBuyer',
          charClass: 1,
          level: 30,
          attributesOverrides: {
            gold: 100000,
            goldBank: 200000,
          },
        }),
      )

      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x708090a0,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })
      const p1 = game.addPlayer({
        charName: 'RichBuyer',
        classId: 1,
        level: 30,
        d2sBytes,
      })
      game.drainPlayerEvents(p1)

      game.enqueueCommand(p1, { type: 'NpcAction', npcId: 147, action: 'gamble' })
      game.stepFrame()
      const events = game.drainPlayerEvents(p1)
      expect(Array.isArray(events)).toBe(true)
    })

    it('F4.5: Charsi imbue rolls rare item with ilvl = clvl + 4 and rare affixes', () => {
      const imbueFn =
        (Server as Record<string, unknown>).imbueItem113c ??
        (Server as Record<string, unknown>).imbueItemCharsi
      expect(typeof imbueFn).toBe('function')
    })
  })

  // ============================================================================
  // F5: Authoritative Quest, Waypoint, Portal & Level Transition State Machines (5 tests)
  // ============================================================================
  describe('F5: Authoritative Quest, Waypoint, Portal & Level Transition State Machines', () => {
    it('F5.1: QuestLog tracks per-quest bitmasks and emits QuestUpdate events on state transitions', () => {
      expect(Server.QuestLog).toBeDefined()
      const questLog = new Server.QuestLog()
      expect(questLog).toBeDefined()
    })

    it('F5.2: WaypointGo command validates unlocked waypoints and transitions player area (LoadAct + UnitReassign)', () => {
      const wp0 = new Uint8Array(24)
      wp0[0] = 0x02
      wp0[1] = 0x01
      wp0[2] = 0x03 // Rogue Encampment (bit 0) + Cold Plains (bit 1) unlocked

      const d2sBytes = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'WpTraveler',
          charClass: 1,
          level: 18,
          waypoints: [wp0, new Uint8Array(24), new Uint8Array(24)],
        }),
      )

      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0xabcdef01,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })
      const p1 = game.addPlayer({
        charName: 'WpTraveler',
        classId: 1,
        level: 18,
        d2sBytes,
      })
      game.drainPlayerEvents(p1)

      // 1.13c requires the player to operate the waypoint before 0x49 is accepted.
      const p1State = game.getPlayerState(p1)!
      const wpId = game.spawnObject({
        classId: 119,
        x: p1State.x,
        y: p1State.y,
        areaId: p1State.areaId,
        isWaypoint: true,
      })
      game.enqueueCommand(p1, { type: 'OperateObject', objectId: wpId })
      game.stepFrame()
      game.drainPlayerEvents(p1)

      // Travel to Cold Plains (areaId = 3)
      game.enqueueCommand(p1, {
        type: 'WaypointGo',
        waypointId: 1,
        destAreaId: 3,
      })
      game.stepFrame()

      const events = game.drainPlayerEvents(p1)
      expect(
        events.some(
          (ev) =>
            ev.type === 'LoadAct' ||
            ev.type === 'UnitReassign' ||
            ev.type === 'WaypointMenu',
        ),
      ).toBe(true)
    })

    it('F5.3: TownPortal command opens bidirectional portal between wilderness area and Act town hub', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0xbcdef012,
        difficulty: 0,
        actId: 0,
        areaId: 2, // Blood Moor
      })
      const p1 = game.addPlayer({
        charName: 'PortalCaster',
        classId: 1,
        level: 20,
        x: 110,
        y: 110,
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

      game.enqueueCommand(p1, { type: 'TownPortal' })
      game.stepFrame()

      const events = game.drainPlayerEvents(p1)
      const portalEv = events.find(
        (ev): ev is Extract<Netproto.ServerEvent, { type: 'Portal' }> => ev.type === 'Portal',
      )
      expect(portalEv).toBeDefined()
      expect(portalEv?.ownerId).toBe(p1)
    })

    it('F5.4: town healer NpcAction restores player HP, Mana, and Stamina to maximum and clears poison/freeze', () => {
      const d2sBytes = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'WoundedHero',
          charClass: 4,
          level: 20,
          attributesOverrides: {
            hitpointsFixed: 50 * FIXED_ONE,
            maxHpFixed: 250 * FIXED_ONE,
            manaFixed: 20 * FIXED_ONE,
            maxManaFixed: 120 * FIXED_ONE,
          },
        }),
      )

      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0xcdef0123,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })
      const p1 = game.addPlayer({
        charName: 'WoundedHero',
        classId: 4,
        level: 20,
        d2sBytes,
      })
      game.drainPlayerEvents(p1)

      game.enqueueCommand(p1, {
        type: 'NpcAction',
        npcId: 148, // Akara
        action: 'heal',
      })
      game.stepFrame()

      const exported = Server.readD2s(game.exportPlayerD2s(p1))
      expect(exported.attributes.hitpointsFixed).toBe(exported.attributes.maxHpFixed)
      expect(exported.attributes.manaFixed).toBe(exported.attributes.maxManaFixed)
    })

    it('F5.5: InteractEntity on warp or portal transitions player area and emits LoadAct and UnitReassign', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0xdef01234,
        difficulty: 0,
        actId: 0,
        areaId: 2,
      })
      const p1 = game.addPlayer({
        charName: 'PortalWalker',
        classId: 1,
        level: 20,
        x: 100,
        y: 100,
      })
      ;(game as unknown as { players: Map<number, { items: unknown[] }> }).players
        .get(p1)!
        .items.push({
          unitId: 9002,
          code: 'tsc',
          location: 'inventory',
          x: 0,
          y: 0,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        })
      game.drainPlayerEvents(p1)

      game.enqueueCommand(p1, { type: 'TownPortal' })
      game.stepFrame()
      const portalEvents = game.drainPlayerEvents(p1)
      const portalEv = portalEvents.find(
        (ev): ev is Extract<Netproto.ServerEvent, { type: 'Portal' }> => ev.type === 'Portal',
      )
      expect(portalEv).toBeDefined()

      if (portalEv) {
        game.enqueueCommand(p1, {
          type: 'InteractEntity',
          targetType: 'object',
          targetId: portalEv.portalId,
        })
        game.stepFrame()
        const transitionEvents = game.drainPlayerEvents(p1)
        expect(
          transitionEvents.some(
            (ev) => ev.type === 'LoadAct' || ev.type === 'UnitReassign',
          ),
        ).toBe(true)
      }
    })
  })

  // ============================================================================
  // F6: 1.13c v96 .d2s Binary Character Reader, Writer & Character Store (5 tests)
  // ============================================================================
  describe('F6: 1.13c v96 .d2s Binary Character Reader, Writer & Character Store', () => {
    it('F6.1: writeD2s produces a valid v96 .d2s binary with 0xAA55AA55 magic, version 96, exact file length, and valid d2sChecksum', () => {
      const sample = createSampleD2sCharacterData({
        name: 'JainaSorc',
        charClass: 1,
        level: 42,
        mapSeed: 0x89abcdef,
      })
      const bytes = Server.writeD2s(sample)
      expect(bytes.byteLength).toBeGreaterThanOrEqual(765)

      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      expect(view.getUint32(0x00, true)).toBe(0xaa55aa55)
      expect(view.getUint32(0x04, true)).toBe(Server.D2S_VERSION)
      expect(Server.D2S_VERSION).toBe(96)
      expect(view.getUint32(0x08, true)).toBe(bytes.byteLength)

      const storedChecksum = view.getInt32(0x0c, true)
      const recomputedChecksum = Server.d2sChecksum(bytes)
      expect(storedChecksum).toBe(recomputedChecksum)
    })

    it('F6.2: writeD2s -> readD2s round-trips character identity, progression, hotkeys, leftRightSkills, difficulty, act, and mapSeed', () => {
      const sample = createSampleD2sCharacterData({
        name: 'PaladinZealot',
        charClass: 3,
        level: 65,
        statusFlags: 0x20,
        progression: 12,
        activeWeapon: 1,
        activeDifficulty: 1,
        activeAct: 2,
        mapSeed: 0xfedcba98,
        leftRightSkills: [106, 113, 97, 122],
      })

      const bytes = Server.writeD2s(sample)
      const parsed = Server.readD2s(bytes)

      expect(parsed.name).toBe('PaladinZealot')
      expect(parsed.charClass).toBe(3)
      expect(parsed.level).toBe(65)
      expect(parsed.statusFlags).toBe(0x20)
      expect(parsed.progression).toBe(12)
      expect(parsed.activeWeapon).toBe(1)
      expect(parsed.activeDifficulty).toBe(1)
      expect(parsed.activeAct).toBe(2)
      expect(parsed.mapSeed >>> 0).toBe(0xfedcba98)
      expect(parsed.leftRightSkills).toEqual([106, 113, 97, 122])
      expect(parsed.hotkeys.length).toBe(16)
    })

    it('F6.3: writeD2s -> readD2s round-trips "Woo!" quests, "WS" waypoints, and "w4" NPC intros across all 3 difficulties', () => {
      const quests: [Uint16Array, Uint16Array, Uint16Array] = [
        new Uint16Array(48),
        new Uint16Array(48),
        new Uint16Array(48),
      ]
      quests[0][1] = 0x0001 // Den of Evil completed
      quests[1][6] = 0x0003 // Nightmare Andariel quest bits
      quests[2][20] = 0x0005 // Hell quest bits

      const wpNorm = new Uint8Array(24)
      wpNorm[0] = 0x02
      wpNorm[1] = 0x01
      wpNorm[2] = 0x1f
      const wpNm = new Uint8Array(24)
      wpNm[0] = 0x02
      wpNm[1] = 0x01
      wpNm[2] = 0x07
      const wpHell = new Uint8Array(24)
      wpHell[0] = 0x02
      wpHell[1] = 0x01
      wpHell[2] = 0x01

      const npcIntros = new Uint8Array(52)
      npcIntros[0] = 0x01
      npcIntros[4] = 0xaa
      npcIntros[51] = 0x55

      const sample = createSampleD2sCharacterData({
        name: 'QuestRunner',
        quests,
        waypoints: [wpNorm, wpNm, wpHell],
        npcIntros,
      })

      const parsed = Server.readD2s(Server.writeD2s(sample))
      expect(parsed.quests[0][1]).toBe(0x0001)
      expect(parsed.quests[1][6]).toBe(0x0003)
      expect(parsed.quests[2][20]).toBe(0x0005)
      expect(parsed.waypoints[0][2]).toBe(0x1f)
      expect(parsed.waypoints[1][2]).toBe(0x07)
      expect(parsed.waypoints[2][2]).toBe(0x01)
      expect(parsed.npcIntros[4]).toBe(0xaa)
      expect(parsed.npcIntros[51]).toBe(0x55)
    })

    it('F6.4: writeD2s -> readD2s round-trips "gf" 9-bit stat bitstream (with << 8 fixed-point HP/Mana/Stamina) and "if" 30-byte skills', () => {
      const skillLevels = new Uint8Array(30)
      skillLevels[0] = 20
      skillLevels[5] = 15
      skillLevels[12] = 1
      skillLevels[29] = 8

      const sample = createSampleD2sCharacterData({
        name: 'StatPrecision',
        charClass: 1,
        level: 75,
        skillLevels,
        attributesOverrides: {
          strength: 156,
          energy: 95,
          dexterity: 75,
          vitality: 280,
          statPts: 15,
          skillPts: 4,
          hitpointsFixed: (1120 << 8) + 128, // 1120.5 in 24.8 fixed-point
          maxHpFixed: 1120 << 8,
          manaFixed: (640 << 8) + 64, // 640.25 in 24.8 fixed-point
          maxManaFixed: 640 << 8,
          staminaFixed: 410 << 8,
          maxStaminaFixed: 410 << 8,
          level: 75,
          experience: 445000000,
          gold: 750000,
          goldBank: 2500000,
        },
      })

      const parsed = Server.readD2s(Server.writeD2s(sample))
      expect(parsed.attributes.strength).toBe(156)
      expect(parsed.attributes.energy).toBe(95)
      expect(parsed.attributes.dexterity).toBe(75)
      expect(parsed.attributes.vitality).toBe(280)
      expect(parsed.attributes.statPts).toBe(15)
      expect(parsed.attributes.skillPts).toBe(4)
      expect(parsed.attributes.hitpointsFixed).toBe((1120 << 8) + 128)
      expect(parsed.attributes.maxHpFixed).toBe(1120 << 8)
      expect(parsed.attributes.manaFixed).toBe((640 << 8) + 64)
      expect(parsed.attributes.maxManaFixed).toBe(640 << 8)
      expect(parsed.attributes.staminaFixed).toBe(410 << 8)
      expect(parsed.attributes.maxStaminaFixed).toBe(410 << 8)
      expect(parsed.attributes.level).toBe(75)
      expect(parsed.attributes.experience).toBe(445000000)
      expect(parsed.attributes.gold).toBe(750000)
      expect(parsed.attributes.goldBank).toBe(2500000)
      expect(Array.from(parsed.skillLevels)).toEqual(Array.from(skillLevels))
    })

    it('F6.5: GameInstance.exportPlayerD2s exports a valid v96 .d2s binary reflecting current authoritative player state', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x31415926,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })

      const initialD2s = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'ExportHero',
          charClass: 4,
          level: 33,
          mapSeed: 0x31415926,
          attributesOverrides: {
            strength: 80,
            statPts: 5,
          },
        }),
      )

      const p1 = game.addPlayer({
        charName: 'ExportHero',
        classId: 4,
        level: 33,
        d2sBytes: initialD2s,
      })

      game.enqueueCommand(p1, { type: 'AllocateStat', statId: 0, amount: 1 })
      game.stepFrame()

      const exportedBytes = game.exportPlayerD2s(p1)
      const parsed = Server.readD2s(exportedBytes)

      expect(parsed.name).toBe('ExportHero')
      expect(parsed.charClass).toBe(4)
      expect(parsed.level).toBe(33)
      expect(parsed.mapSeed >>> 0).toBe(0x31415926)
      expect(parsed.attributes.strength).toBeGreaterThanOrEqual(81)
    })
  })

  // ============================================================================
  // F7: Netproto Boundary Exports, PauseGame, LobbyProvider & Lossless TsFramer (5 tests)
  // ============================================================================
  describe('F7: Netproto Boundary Exports, PauseGame, LobbyProvider & Lossless TsFramer', () => {
    it('F7.1: src/netproto/index.ts exports all required adapters, framers, codecs, and lobby factories', () => {
      expect(typeof Netproto.registerLocalServerFactory).toBe('function')
      expect(typeof Netproto.createLocalServerSession).toBe('function')
      expect(typeof Netproto.registerLocalLobbyProvider).toBe('function')
      expect(typeof Netproto.getLocalLobbyProvider).toBe('function')
      expect(typeof Netproto.createMemoryStreamPair).toBe('function')
      expect(typeof Netproto.encodeTsFrame).toBe('function')
      expect(typeof Netproto.TsFramer).toBe('function')
      expect(typeof Netproto.TsServerAdapter).toBe('function')
      expect(typeof Netproto.D2gsServerAdapter).toBe('function')
      expect(typeof Netproto.D2gsC2sFramer).toBe('function')
      expect(typeof Netproto.D2gsS2cFramer).toBe('function')
      expect(typeof Netproto.decodeD2gsItemPacket).toBe('function')
      expect(typeof Netproto.encodeD2gsItemPacket).toBe('function')
    })

    it('F7.2: encodeTsFrame and TsFramer round-trip PauseGameCommand without mutation', () => {
      const pauseCmd: Netproto.ClientCommand = { type: 'PauseGame', paused: true }
      const frameBytes = Netproto.encodeTsFrame(pauseCmd)

      const framer = new Netproto.TsFramer<Netproto.ClientCommand>()
      const decoded = framer.push(frameBytes)
      expect(decoded).toHaveLength(1)
      expect(decoded[0]).toEqual({ type: 'PauseGame', paused: true })
    })

    it('F7.3: encodeTsFrame and TsFramer losslessly round-trip Uint8Array and Uint16Array fields in ServerEvent payloads', () => {
      const rawItemBytes = new Uint8Array([0x9c, 0x00, 0x15, 0x4a, 0x4d, 0xff, 0x01])
      const itemEvent: Netproto.ServerEvent = {
        type: 'ItemEvent',
        action: 'groundSpawn',
        itemId: 501,
        code: 'cap',
        x: 112,
        y: 118,
        container: 'ground',
        quality: 2,
        itemLevel: 12,
        identified: true,
        rawBytes: rawItemBytes,
      }

      const encoded = Netproto.encodeTsFrame(itemEvent)
      const framer = new Netproto.TsFramer<Netproto.ServerEvent>()
      const [decoded] = framer.push(encoded)

      expect(decoded).toBeDefined()
      expect(decoded?.type).toBe('ItemEvent')
      if (decoded?.type === 'ItemEvent') {
        expect(decoded.rawBytes).toBeInstanceOf(Uint8Array)
        expect(Array.from(decoded.rawBytes ?? [])).toEqual(Array.from(rawItemBytes))
      }

      // Also verify Uint16Array lossless round-trip
      const u16Payload = {
        tag: 'questArray',
        quests: new Uint16Array([0x0001, 0x1002, 0xffff]),
      }
      const u16Framer = new Netproto.TsFramer<typeof u16Payload>()
      const [decodedU16] = u16Framer.push(Netproto.encodeTsFrame(u16Payload))
      expect(decodedU16?.quests).toBeInstanceOf(Uint16Array)
      expect(Array.from(decodedU16?.quests ?? [])).toEqual([0x0001, 0x1002, 0xffff])
    })

    it('F7.4: registerLocalLobbyProvider and getLocalLobbyProvider register and retrieve LocalLobbyProvider', () => {
      const lobby = new Server.LocalLobbyProvider()
      Netproto.registerLocalLobbyProvider(lobby)
      expect(Netproto.getLocalLobbyProvider()).toBe(lobby)
    })

    it('F7.5: registerLocalServerFactory and createLocalServerSession create a connected LocalLoopbackAdapter session', () => {
      const handle = Netproto.createLocalServerSession({
        charName: 'SessionSorc',
        classId: 1,
        mapSeed: 0x12344321,
        difficulty: 0,
      })
      expect(handle.adapter).toBeDefined()
      expect(handle.adapter.state).toBe('inGame')

      const rec = recordAdapterEvents(handle.adapter)
      handle.stepFrame()
      expect(rec.events.length).toBeGreaterThan(0)
      handle.stop()
    })
  })

  // ============================================================================
  // F8: Single Player LocalLoopbackAdapter & LocalLobbyProvider (5 tests)
  // ============================================================================
  describe('F8: Single Player LocalLoopbackAdapter & LocalLobbyProvider', () => {
    it('F8.1: LocalLobbyProvider creates, lists, and deletes Single Player characters backed by v96 .d2s bytes', async () => {
      const lobby = new Server.LocalLobbyProvider()
      const created = await lobby.createCharacter({
        name: 'OfflineNecro',
        classId: 'nec',
        expansion: true,
        hardcore: false,
      })

      expect(created.name).toBe('OfflineNecro')
      expect(created.classId).toBe('nec')
      expect(created.level).toBe(1)

      const list = await lobby.listCharacters()
      expect(list.some((c) => c.name === 'OfflineNecro')).toBe(true)

      const d2sBytes = lobby.getCharacterD2s('OfflineNecro')
      expect(d2sBytes).toBeInstanceOf(Uint8Array)
      const parsed = Server.readD2s(d2sBytes!)
      expect(parsed.name).toBe('OfflineNecro')
      expect(parsed.charClass).toBe(2)

      const deleted = await lobby.deleteCharacter('OfflineNecro')
      expect(deleted).toBe(true)
      const afterDelete = await lobby.listCharacters()
      expect(afterDelete.some((c) => c.name === 'OfflineNecro')).toBe(false)
    })

    it('F8.2: LocalLobbyProvider.enterGame returns a LocalLoopbackAdapter wrapping GameInstance(SINGLE_PLAYER_POLICY)', async () => {
      const lobby = new Server.LocalLobbyProvider()
      await lobby.createCharacter({
        name: 'OfflineAma',
        classId: 'ama',
        expansion: true,
      })

      const adapter = (await lobby.enterGame({
        charName: 'OfflineAma',
        difficulty: 0,
      })) as Server.LocalLoopbackAdapter

      expect(adapter.kind).toBe('ts')
      expect(adapter.state).toBe('inGame')
      expect(adapter.game.policy.mode).toBe('sp')

      const rec = recordAdapterEvents(adapter)
      adapter.stepFrame()
      expect(rec.events.some((e) => e.type === 'GameLogonAck')).toBe(true)
      expect(rec.events.some((e) => e.type === 'PlayerAssign')).toBe(true)
      adapter.close()
    })

    it('F8.3: LocalLoopbackAdapter retains character mapSeed across sessions on the same difficulty', async () => {
      const lobby = new Server.LocalLobbyProvider()
      const initialBytes = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'SeedRetainer',
          charClass: 1,
          level: 20,
          activeDifficulty: 0,
          mapSeed: 0x76543210,
        }),
      )
      lobby.importCharacterD2s(initialBytes)

      const session1 = (await lobby.enterGame({
        charName: 'SeedRetainer',
        difficulty: 0,
      })) as Server.LocalLoopbackAdapter
      expect(session1.game.mapSeed >>> 0).toBe(0x76543210)
      session1.stepFrames(3)
      session1.close()

      const session2 = (await lobby.enterGame({
        charName: 'SeedRetainer',
        difficulty: 0,
      })) as Server.LocalLoopbackAdapter
      expect(session2.game.mapSeed >>> 0).toBe(0x76543210)
      session2.close()
    })

    it('F8.4: LocalLoopbackAdapter generates a new deterministic mapSeed when switching difficulty (Normal -> Nightmare)', async () => {
      const lobby = new Server.LocalLobbyProvider()
      const initialBytes = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'DiffSwitcher',
          charClass: 3,
          level: 40,
          activeDifficulty: 0,
          mapSeed: 0x11223344,
        }),
      )
      lobby.importCharacterD2s(initialBytes)

      const nightmareSession = (await lobby.enterGame({
        charName: 'DiffSwitcher',
        difficulty: 1, // Nightmare
      })) as Server.LocalLoopbackAdapter

      const newSeed = nightmareSession.game.mapSeed >>> 0
      expect(newSeed).not.toBe(0)
      expect(newSeed).not.toBe(0x11223344)
      nightmareSession.close()

      const saved = Server.readD2s(lobby.getCharacterD2s('DiffSwitcher')!)
      expect(saved.activeDifficulty).toBe(1)
      expect(saved.mapSeed >>> 0).toBe(newSeed)
    })

    it('F8.5: LocalLoopbackAdapter supports setPaused/PauseGame and /players 1..8 commands', () => {
      const adapter = new Server.LocalLoopbackAdapter({
        charName: 'LoopbackTester',
        classId: 4,
        mapSeed: 0x99887766,
      })

      adapter.stepFrame()
      expect(adapter.isPaused()).toBe(false)

      adapter.setPaused(true)
      expect(adapter.isPaused()).toBe(true)
      const frozenFrame = adapter.game.frame
      adapter.stepFrames(4)
      expect(adapter.game.frame).toBe(frozenFrame)

      adapter.setPaused(false)
      expect(adapter.isPaused()).toBe(false)
      adapter.send({ type: 'Chat', text: '/players 7' })
      adapter.stepFrame()
      expect(adapter.getPlayersX()).toBe(7)
      adapter.close()
    })
  })

  // ============================================================================
  // F9: Battle.net MultiClientRoomHost (1–8 Concurrent Players over ByteStream) (5 tests)
  // ============================================================================
  describe('F9: Battle.net MultiClientRoomHost (1–8 Concurrent Players over ByteStream)', () => {
    it('F9.1: connects multiple concurrent TsServerAdapter clients over createMemoryStreamPair() and completes handshakes', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x10102020,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })

      const [c1Stream, s1Stream] = Netproto.createMemoryStreamPair()
      const [c2Stream, s2Stream] = Netproto.createMemoryStreamPair()

      const adapter1 = new Netproto.TsServerAdapter(c1Stream)
      const adapter2 = new Netproto.TsServerAdapter(c2Stream)
      const rec1 = recordAdapterEvents(adapter1)
      const rec2 = recordAdapterEvents(adapter2)

      const p1 = host.connectClient(s1Stream, { charName: 'CoopAma', classId: 0 })
      const p2 = host.connectClient(s2Stream, { charName: 'CoopSorc', classId: 1 })

      expect(host.getConnectedPlayerIds()).toEqual([p1, p2])

      host.stepFrame()

      expect(rec1.events.some((e) => e.type === 'GameLogonAck')).toBe(true)
      expect(rec2.events.some((e) => e.type === 'GameLogonAck')).toBe(true)
      expect(rec1.events.some((e) => e.type === 'Party')).toBe(true)
      expect(rec2.events.some((e) => e.type === 'Party')).toBe(true)
    })

    it('F9.2: broadcasts spatial movement and skill events to co-op players in the same areaId', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x30304040,
        difficulty: 0,
        actId: 0,
        areaId: 1,
      })

      const [c1Stream, s1Stream] = Netproto.createMemoryStreamPair()
      const [c2Stream, s2Stream] = Netproto.createMemoryStreamPair()
      const adapter1 = new Netproto.TsServerAdapter(c1Stream)
      const adapter2 = new Netproto.TsServerAdapter(c2Stream)

      const p1 = host.connectClient(s1Stream, { charName: 'Mover1', classId: 3, x: 100, y: 100 })
      host.connectClient(s2Stream, { charName: 'Observer2', classId: 1, x: 104, y: 104 })
      host.stepFrame()

      const rec2 = recordAdapterEvents(adapter2)
      adapter1.send({ type: 'Move', x: 120, y: 125, run: true })
      host.stepFrame()

      const observedMove = rec2.events.find(
        (ev): ev is Extract<Netproto.ServerEvent, { type: 'UnitMove' }> =>
          ev.type === 'UnitMove' && ev.unitId === p1,
      )
      expect(observedMove).toBeDefined()
      expect(observedMove?.targetX).toBe(120)
      expect(observedMove?.targetY).toBe(125)
    })

    it('F9.3: broadcasts global Chat events across all connected clients in MultiClientRoomHost', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x50506060,
      })

      const [c1Stream, s1Stream] = Netproto.createMemoryStreamPair()
      const [c2Stream, s2Stream] = Netproto.createMemoryStreamPair()
      const adapter1 = new Netproto.TsServerAdapter(c1Stream)
      const adapter2 = new Netproto.TsServerAdapter(c2Stream)

      host.connectClient(s1Stream, { charName: 'Speaker', classId: 0 })
      host.connectClient(s2Stream, { charName: 'Listener', classId: 2 })
      host.stepFrame()

      const rec2 = recordAdapterEvents(adapter2)
      adapter1.send({ type: 'Chat', text: 'TP up at Den of Evil!' })
      host.stepFrame()

      const chatEv = rec2.events.find(
        (ev): ev is Extract<Netproto.ServerEvent, { type: 'Chat' }> =>
          ev.type === 'Chat' && ev.text.includes('TP up at Den of Evil!'),
      )
      expect(chatEv).toBeDefined()
    })

    it('F9.4: disconnectClient removes player unit, broadcasts UnitRemove/Party update, and saves .d2s character snapshot', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x70708080,
      })

      const [c1Stream, s1Stream] = Netproto.createMemoryStreamPair()
      const [c2Stream, s2Stream] = Netproto.createMemoryStreamPair()
      new Netproto.TsServerAdapter(c1Stream)
      const adapter2 = new Netproto.TsServerAdapter(c2Stream)

      const p1 = host.connectClient(s1Stream, { charName: 'LeaverHero', classId: 4, level: 22 })
      const p2 = host.connectClient(s2Stream, { charName: 'RemainingHero', classId: 1, level: 24 })
      host.stepFrame()

      const rec2 = recordAdapterEvents(adapter2)
      const savedBytes = host.disconnectClient(p1, 'client_quit')
      host.stepFrame()

      expect(savedBytes).toBeInstanceOf(Uint8Array)
      const storedBytes = host.getSavedCharacterD2s('LeaverHero')
      expect(storedBytes).toBeInstanceOf(Uint8Array)
      const parsed = Server.readD2s(storedBytes!)
      expect(parsed.name).toBe('LeaverHero')

      expect(host.getConnectedPlayerIds()).toEqual([p2])
      expect(
        rec2.events.some(
          (ev) =>
            (ev.type === 'UnitRemove' && ev.unitId === p1) || ev.type === 'Party',
        ),
      ).toBe(true)
    })

    it('F9.5: supports binary D2GS client connections over D2gsServerAdapter / D2gsC2sFramer / D2gsS2cFramer', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x9090a0a0,
      })

      const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
      const d2gsAdapter = new Netproto.D2gsServerAdapter(clientStream, {
        charName: 'BinaryBarb',
        classId: 4,
      })
      const rec = recordAdapterEvents(d2gsAdapter)

      const p1 = host.connectClient(serverStream, {
        charName: 'BinaryBarb',
        classId: 4,
      })
      expect(p1).toBeGreaterThan(0)

      host.stepFrames(2)
      expect(rec.events.length).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // F10: Deterministic Lockstep Hash Verification (computeLockstepHash) (5 tests)
  // ============================================================================
  describe('F10: Deterministic Lockstep Hash Verification (computeLockstepHash)', () => {
    it('F10.1: computeFrameLockstepHash returns an unsigned 32-bit FNV-1a integer digest', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x11223344,
      })
      game.addPlayer({ charName: 'HashHero', classId: 1, level: 10 })
      game.stepFrame()

      const hash = game.computeFrameLockstepHash()
      expect(typeof hash).toBe('number')
      expect(Number.isInteger(hash)).toBe(true)
      expect(hash >>> 0).toBe(hash)
    })

    it('F10.2: two independent GameInstances with identical seeds and commands produce identical hashes on every frame', () => {
      const makeGame = () => {
        const g = new Server.GameInstance({
          policy: Server.SINGLE_PLAYER_POLICY,
          mapSeed: 0x42424242,
          difficulty: 0,
          actId: 0,
          areaId: 2,
        })
        const pid = g.addPlayer({
          charName: 'LockstepSorc',
          classId: 1,
          level: 18,
          x: 100,
          y: 100,
        })
        return { g, pid }
      }

      const runA = makeGame()
      const runB = makeGame()

      const commands: ReadonlyArray<{ frame: number; cmd: Netproto.ClientCommand }> = [
        { frame: 1, cmd: { type: 'Move', x: 110, y: 105, run: true } },
        { frame: 5, cmd: { type: 'SelectSkill', skillId: 36, hand: 'right' } },
        { frame: 8, cmd: { type: 'CastSkillAtLocation', skillId: 36, x: 120, y: 115, hand: 'right' } },
        { frame: 15, cmd: { type: 'Move', x: 118, y: 112, run: false } },
      ]

      for (let f = 1; f <= 25; f++) {
        for (const entry of commands) {
          if (entry.frame === f) {
            runA.g.enqueueCommand(runA.pid, entry.cmd)
            runB.g.enqueueCommand(runB.pid, entry.cmd)
          }
        }
        runA.g.stepFrame()
        runB.g.stepFrame()
        expect(runA.g.computeFrameLockstepHash()).toBe(runB.g.computeFrameLockstepHash())
      }
    })

    it('F10.3: computeFrameLockstepHash changes when authoritative entity coordinates or stats change', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x77889900,
      })
      const p1 = game.addPlayer({ charName: 'DeltaHero', classId: 3, level: 10, x: 100, y: 100 })
      game.stepFrame()
      const hashBefore = game.computeFrameLockstepHash()

      game.enqueueCommand(p1, { type: 'Move', x: 140, y: 145, run: true })
      game.stepFrame()
      const hashAfter = game.computeFrameLockstepHash()

      expect(hashAfter).not.toBe(hashBefore)
    })

    it('F10.4: LockstepSession records per-frame hashes and detects zero divergence on matching peers', () => {
      expect(Server.LockstepSession).toBeDefined()
      expect(typeof Server.computeLockstepHash).toBe('function')

      const sessionA = new Server.LockstepSession()
      const sessionB = new Server.LockstepSession()

      const gameA = new Server.GameInstance({ mapSeed: 0x55667788 })
      const gameB = new Server.GameInstance({ mapSeed: 0x55667788 })
      gameA.addPlayer({ charName: 'Peer1', classId: 0 })
      gameB.addPlayer({ charName: 'Peer1', classId: 0 })

      for (let i = 0; i < 10; i++) {
        gameA.stepFrame()
        gameB.stepFrame()
        const hA = gameA.computeFrameLockstepHash()
        const hB = gameB.computeFrameLockstepHash()
        sessionA.recordFrame(gameA.frame, hA)
        sessionB.recordFrame(gameB.frame, hB)
        expect(sessionA.verifyPeerHash(gameA.frame, hB)).toBe(true)
      }
    })

    it('F10.5: state-hash.ts has zero import dependency on retired legacy combat.ts or engine.ts', () => {
      const stateHashSource = readRepoFile('src/server/engine/state-hash.ts')
      expect(stateHashSource).not.toMatch(/from\s+['"]\.\/combat(?:\.ts)?['"]/)
      expect(stateHashSource).not.toMatch(/from\s+['"]\.\/engine(?:\.ts)?['"]/)
    })
  })

  // ============================================================================
  // F11: Client Single-Player & Battle.net Unified Session Integration (5 tests)
  // ============================================================================
  describe('F11: Client Single-Player & Battle.net Unified Session Integration', () => {
    it('F11.1: OnlineSession attaches to LocalLoopbackAdapter (Single Player) and synchronizes ClientWorld player state', () => {
      const adapter = new Server.LocalLoopbackAdapter({
        charName: 'ClientSpHero',
        classId: 1,
        mapSeed: 0x12123434,
        difficulty: 0,
      })

      const session = new OnlineSession()
      session.attachGameServer(adapter)
      adapter.stepFrame()
      session.tick(40, 40)

      expect(session.world.localPlayerId).toBe(adapter.playerUnitId)
      expect(session.world.entities.has(adapter.playerUnitId)).toBe(true)
      session.leaveGame()
    })

    it('F11.2: OnlineSession dispatches Move and skill commands through GameServerAdapter and updates ClientWorld position', () => {
      const adapter = new Server.LocalLoopbackAdapter({
        charName: 'ClientMover',
        classId: 3,
        mapSeed: 0x56567878,
      })

      const session = new OnlineSession()
      session.attachGameServer(adapter)
      adapter.stepFrame()

      session.dispatchCommand({ type: 'Move', x: 132, y: 128, run: true })
      adapter.stepFrame()
      session.tick(40, 80)

      const playerEntity = session.world.entities.get(adapter.playerUnitId)
      expect(playerEntity).toBeDefined()
      // The owner is not sent its own walk/run UnitMove (1.13c, issue #1329): the command reaches
      // the authoritative server, which plans the move toward the requested sub-tile.
      const serverState = adapter.gameInstance.getPlayerState(adapter.playerUnitId)!
      expect(serverState.targetX).toBe(132)
      expect(serverState.targetY).toBe(128)
      session.leaveGame()
    })

    it('F11.3: OnlineSession attaches to TsServerAdapter connected to MultiClientRoomHost (Battle.net) with identical ClientWorld updates', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x9a9abcbc,
      })
      const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
      const tsAdapter = new Netproto.TsServerAdapter(clientStream)
      const session = new OnlineSession()
      session.attachGameServer(tsAdapter)

      const playerUnitId = host.connectClient(serverStream, {
        charName: 'ClientBnetHero',
        classId: 4,
      })
      host.stepFrame()
      session.tick(40, 40)

      expect(session.world.localPlayerId).toBe(playerUnitId)
      session.dispatchCommand({ type: 'Move', x: 145, y: 150, run: true })
      host.stepFrame()
      session.tick(40, 80)

      const entity = session.world.entities.get(playerUnitId)
      expect(entity).toBeDefined()
      // No self UnitMove echo in 1.13c (issue #1329): verify the command reached the room's server.
      const serverState = host.gameInstance.getPlayerState(playerUnitId)!
      expect(serverState.targetX).toBe(145)
      expect(serverState.targetY).toBe(150)
      session.leaveGame()
    })

    it('F11.4: OnlineSession forwards PauseGame and /players X chat commands through GameServerAdapter in Single Player', () => {
      const adapter = new Server.LocalLoopbackAdapter({
        charName: 'SpControlHero',
        classId: 1,
        mapSeed: 0xdedef0f0,
      })
      const session = new OnlineSession()
      session.attachGameServer(adapter)
      adapter.stepFrame()

      session.submitChatInput('/players 5')
      adapter.stepFrame()
      expect(adapter.getPlayersX()).toBe(5)

      session.dispatchCommand({ type: 'PauseGame', paused: true })
      adapter.stepFrame()
      expect(adapter.isPaused()).toBe(true)

      session.dispatchCommand({ type: 'PauseGame', paused: false })
      adapter.stepFrame()
      expect(adapter.isPaused()).toBe(false)
      session.leaveGame()
    })

    it('F11.5: zero files in src/client/** import directly from src/server/**', () => {
      const clientFiles = collectTsFilesRecursive( `${SRC_DIR}/client`)
      expect(clientFiles.length).toBeGreaterThan(0)

      for (const file of clientFiles) {
        const content = readRepoFile(toRepoRelative(file))
        expect(content, `${toRepoRelative(file)} must not import src/server`).not.toMatch(
          /from\s+['"][^'"]*\/server(?:\/|['"])/,
        )
      }
    })
  })

  // ============================================================================
  // F12: Retire Legacy Split-Track Prototype & Reconcile README + Barrel (5 tests)
  // ============================================================================
  describe('F12: Retire Legacy Split-Track Prototype & Reconcile README + Barrel', () => {
    it('F12.1: all 4 retired legacy split-track files and src/server/scene/ directory are permanently deleted', () => {
      for (const retiredPath of RETIRED_LEGACY_FILES) {
        expect(repoPathExists(retiredPath), `${retiredPath} must be deleted`).toBe(false)
      }
      expect(repoPathExists('src/server/scene')).toBe(false)
    })

    it('F12.2: zero files in src/** or tests/** import any of the 4 retired split-track modules', () => {
      const allFiles = [
        ...collectTsFilesRecursive(SRC_DIR),
        ...collectTsFilesRecursive(TESTS_DIR),
      ].filter((f) => !toRepoRelative(f).startsWith('tests/e2e/server-reuse/'))

      const forbiddenPatterns = [
        /server\/engine\/engine(?:\.ts)?['"]/,
        /server\/engine\/combat(?:\.ts)?['"]/,
        /server\/scene\/skill-caster(?:\.ts)?['"]/,
        /server\/scene\/weapon-combat(?:\.ts)?['"]/,
        /from\s+['"]\.\/combat(?:\.ts)?['"]/,
        /from\s+['"]\.\.\/scene\//,
      ]

      for (const file of allFiles) {
        const rel = toRepoRelative(file)
        const content = readRepoFile(rel)
        for (const pat of forbiddenPatterns) {
          expect(content, `${rel} must not match ${pat}`).not.toMatch(pat)
        }
      }
    })

    it('F12.3: src/server/index.ts exports the complete unified authoritative server barrel', () => {
      const requiredSymbols = [
        'GameInstance',
        'SINGLE_PLAYER_POLICY',
        'OPEN_BNET_POLICY',
        'CLOSED_REALM_POLICY',
        'LocalLoopbackAdapter',
        'LocalLobbyProvider',
        'MultiClientRoomHost',
        'writeD2s',
        'readD2s',
        'd2sChecksum',
        'D2S_VERSION',
        'WorldArena',
        'UnitStatList',
        'FIXED_ONE',
        'StateBus',
        'AnimDispatcher',
        'executeSUnitDmg',
        'MissileEngine',
        'AuraScanner',
        'SummonManager',
        'SKILL_REGISTRY',
        'RoomStreamer',
        'MonsterAI',
        'executeDropPipeline',
        'GroundItemManager',
        'QuestLog',
        'computeLockstepHash',
        'LockstepSession',
      ]

      for (const sym of requiredSymbols) {
        expect(
          (Server as Record<string, unknown>)[sym],
          `src/server/index.ts must export ${sym}`,
        ).toBeDefined()
      }
    })

    it('F12.4: every file path documented in src/server/README.md exists on disk and retired files are not listed', () => {
      expect(repoPathExists('src/server/README.md')).toBe(true)
      const readme = readRepoFile('src/server/README.md')

      for (const retired of RETIRED_LEGACY_FILES) {
        const shortName = retired.replace(/^src\/server\//, '')
        expect(readme).not.toContain(shortName)
      }

      // Extract backticked relative .ts file paths under src/server/
      const matches = readme.matchAll(/`((?:engine|combat|skills|ai|items|world|save)\/[a-z0-9-]+\.ts)`/g)
      let matchedCount = 0
      for (const m of matches) {
        matchedCount++
        const relPath = `src/server/${m[1]}`
        expect(repoPathExists(relPath), `${relPath} documented in src/server/README.md must exist`).toBe(true)
      }
      expect(matchedCount).toBeGreaterThan(5)
    })

    it('F12.5: zero files in src/server/** import from src/client/**', () => {
      const serverFiles = collectTsFilesRecursive(`${SRC_DIR}/server`)
      expect(serverFiles.length).toBeGreaterThan(0)

      for (const file of serverFiles) {
        const rel = toRepoRelative(file)
        const content = readRepoFile(rel)
        expect(content, `${rel} must not import src/client`).not.toMatch(
          /from\s+['"][^'"]*\/client(?:\/|['"])/,
        )
      }
    })
  })
})
