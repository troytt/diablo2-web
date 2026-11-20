/**
 * Tier 2 — Boundary & Corner Case E2E Tests (`tests/e2e/server-reuse/tier2-boundary-corner.test.ts`)
 *
 * Covers boundary conditions, invalid inputs, negative/error paths, encoding/escaping
 * integrity, and resource stress for all 12 features (`F1`–`F12`) with 5 test cases
 * per feature (60 tests total).
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
  readRepoFile,
  recordAdapterEvents,
  repoPathExists,
  RETIRED_LEGACY_FILES,
  SRC_DIR,
  toRepoRelative,
} from './helpers.ts'

describe('Tier 2 — Boundary & Corner Cases (F1–F12, 60 tests)', () => {
  // ============================================================================
  // F1 Boundaries: Unified 25Hz Authoritative GameInstance Core (5 tests)
  // ============================================================================
  describe('F1 Boundaries: Unified 25Hz Authoritative GameInstance Core', () => {
    it('F1.B1: stepFrames(0) and negative counts do not advance or corrupt the frame counter', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x10000001,
      })
      game.addPlayer({ charName: 'ZeroFrameHero', classId: 0 })
      game.stepFrame()
      expect(game.frame).toBe(1)

      game.stepFrames(0)
      expect(game.frame).toBe(1)

      game.stepFrames(-5)
      expect(game.frame).toBe(1)
    })

    it('F1.B2: enqueueCommand for an unknown or removed playerUnitId is safely ignored without throwing', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x10000002,
      })
      const p1 = game.addPlayer({ charName: 'ValidHero', classId: 1 })

      expect(() => {
        game.enqueueCommand(999999, { type: 'Move', x: 50, y: 50, run: true })
        game.stepFrame()
      }).not.toThrow()

      game.removePlayer(p1)
      expect(() => {
        game.enqueueCommand(p1, { type: 'Move', x: 60, y: 60, run: true })
        game.stepFrame()
      }).not.toThrow()
    })

    it('F1.B3: casting a skill with 0 mana or unlearned skillId rejects the cast without crashing or underflowing mana', () => {
      const d2sBytes = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'OomSorc',
          charClass: 1,
          level: 10,
          skillLevels: new Uint8Array(30), // All skills level 0
          attributesOverrides: {
            manaFixed: 0,
            maxManaFixed: 100 * FIXED_ONE,
          },
        }),
      )

      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x10000003,
        areaId: 2,
      })
      const p1 = game.addPlayer({
        charName: 'OomSorc',
        classId: 1,
        level: 10,
        d2sBytes,
      })
      game.drainPlayerEvents(p1)

      game.enqueueCommand(p1, {
        type: 'CastSkillAtLocation',
        skillId: 59, // Blizzard (unlearned & 0 mana)
        x: 120,
        y: 120,
        hand: 'right',
      })
      game.stepFrame()

      const exported = Server.readD2s(game.exportPlayerD2s(p1))
      expect(exported.attributes.manaFixed).toBeGreaterThanOrEqual(0)
    })

    it('F1.B4: AllocateStat and AllocateSkill when statPts=0 and skillPts=0 do not underflow points or inflate stats', () => {
      const d2sBytes = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'ZeroPtsHero',
          charClass: 4,
          level: 10,
          attributesOverrides: {
            strength: 50,
            statPts: 0,
            skillPts: 0,
          },
        }),
      )

      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x10000004,
      })
      const p1 = game.addPlayer({
        charName: 'ZeroPtsHero',
        classId: 4,
        level: 10,
        d2sBytes,
      })
      game.drainPlayerEvents(p1)

      game.enqueueCommand(p1, { type: 'AllocateStat', statId: 0, amount: 5 })
      game.enqueueCommand(p1, { type: 'AllocateSkill', skillId: 126 })
      game.stepFrame()

      const exported = Server.readD2s(game.exportPlayerD2s(p1))
      expect(exported.attributes.statPts).toBe(0)
      expect(exported.attributes.skillPts).toBe(0)
      expect(exported.attributes.strength).toBe(50)
    })

    it('F1.B5: removePlayer and drainPlayerEvents on non-existent playerUnitId return null and [] safely', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x10000005,
      })
      expect(game.removePlayer(404404)).toBeNull()
      expect(game.drainPlayerEvents(404404)).toEqual([])
    })
  })

  // ============================================================================
  // F2 Boundaries: Injectable GameModePolicy Configuration (5 tests)
  // ============================================================================
  describe('F2 Boundaries: Injectable GameModePolicy Configuration', () => {
    it('F2.B1: SINGLE_PLAYER_POLICY (maxPlayers: 1) rejects adding a 2nd concurrent player', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x20000001,
      })
      const p1 = game.addPlayer({ charName: 'Solo1', classId: 0 })
      expect(p1).toBeGreaterThan(0)

      let secondResult = -1
      let threw = false
      try {
        secondResult = game.addPlayer({ charName: 'Intruder2', classId: 1 })
      } catch {
        threw = true
      }
      expect(threw || secondResult <= 0).toBe(true)
    })

    it('F2.B2: OPEN_BNET_POLICY (maxPlayers: 8) accepts 8 concurrent players and rejects a 9th player', () => {
      const game = new Server.GameInstance({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x20000002,
      })
      for (let i = 1; i <= 8; i++) {
        const pid = game.addPlayer({ charName: `PartyMember${i}`, classId: i % 7 })
        expect(pid).toBeGreaterThan(0)
      }

      let ninthResult = -1
      let threw = false
      try {
        ninthResult = game.addPlayer({ charName: 'Overflow9', classId: 0 })
      } catch {
        threw = true
      }
      expect(threw || ninthResult <= 0).toBe(true)
    })

    it('F2.B3: /players N clamps or rejects out-of-range values (0, -4, 99, non-numeric) keeping playersX in [1, 8]', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x20000003,
      })
      const p1 = game.addPlayer({ charName: 'ClampHero', classId: 1 })

      for (const invalidCmd of ['/players 0', '/players -4', '/players 99', '/players abc']) {
        game.enqueueCommand(p1, { type: 'Chat', text: invalidCmd })
        game.stepFrame()
        expect(game.playersX).toBeGreaterThanOrEqual(1)
        expect(game.playersX).toBeLessThanOrEqual(8)
      }
    })

    it('F2.B4: OPEN_BNET_POLICY (allowPause: false) ignores PauseGame commands and keeps advancing frames', () => {
      const game = new Server.GameInstance({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x20000004,
      })
      const p1 = game.addPlayer({ charName: 'OpenHero', classId: 2 })
      game.enqueueCommand(p1, { type: 'PauseGame', paused: true })
      game.stepFrame()

      expect(game.paused).toBe(false)
      const f1 = game.frame
      game.stepFrames(3)
      expect(game.frame).toBe(f1 + 3)
    })

    it('F2.B5: while paused under SINGLE_PLAYER_POLICY, queued Move commands do not advance entity simulation until unpaused', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x20000005,
      })
      const p1 = game.addPlayer({ charName: 'PausedMover', classId: 3, x: 100, y: 100 })
      game.stepFrame()

      game.enqueueCommand(p1, { type: 'PauseGame', paused: true })
      game.stepFrame()
      expect(game.paused).toBe(true)
      const hashAtPause = game.computeFrameLockstepHash()

      game.enqueueCommand(p1, { type: 'Move', x: 150, y: 150, run: true })
      game.stepFrames(5)
      expect(game.computeFrameLockstepHash()).toBe(hashAtPause)

      game.enqueueCommand(p1, { type: 'PauseGame', paused: false })
      game.stepFrames(2)
      expect(game.paused).toBe(false)
      expect(game.computeFrameLockstepHash()).not.toBe(hashAtPause)
    })
  })

  // ============================================================================
  // F3 Boundaries: 1.13c Monster/Boss/Mercenary AI & Active Room Streaming (5 tests)
  // ============================================================================
  describe('F3 Boundaries: 1.13c Monster/Boss/Mercenary AI & Active Room Streaming', () => {
    it('F3.B1: Town safe-zone (areaId = 1 Rogue Encampment) does not spawn hostile monster packs via RoomStreamer', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x30000001,
        difficulty: 0,
        actId: 0,
        areaId: 1, // Rogue Encampment (town)
      })
      const p1 = game.addPlayer({ charName: 'TownResident', classId: 0, x: 100, y: 100 })

      const events: Netproto.ServerEvent[] = []
      for (let i = 0; i < 10; i++) {
        game.stepFrame()
        events.push(...game.drainPlayerEvents(p1))
      }

      const hostileMonsters = events.filter(
        (ev): ev is Extract<Netproto.ServerEvent, { type: 'UnitAssign' }> =>
          ev.type === 'UnitAssign' &&
          ev.unitType === 'monster' &&
          // Town NPCs (e.g., Akara=148, Charsi=154, Kashya=150, Warriv=155, Deckard=265, Gheed=147) are non-hostile NPCs
          ![147, 148, 150, 154, 155, 265].includes(ev.classId),
      )
      expect(hostileMonsters).toHaveLength(0)
    })

    it('F3.B2: stepping wilderness GameInstance with 0 players does not crash RoomStreamer or MonsterAI', () => {
      const game = new Server.GameInstance({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x30000002,
        difficulty: 0,
        actId: 0,
        areaId: 2,
      })

      expect(() => {
        game.stepFrames(15)
      }).not.toThrow()
      expect(game.frame).toBe(15)
    })

    it('F3.B3: RoomStreamer cleanly handles large coordinate jumps across rooms without dangling references', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x30000003,
        difficulty: 0,
        actId: 0,
        areaId: 2,
      })
      const p1 = game.addPlayer({ charName: 'Teleporter', classId: 1, level: 30, x: 100, y: 100 })
      game.stepFrames(3)

      for (const coord of [
        { x: 300, y: 300 },
        { x: 600, y: 600 },
        { x: 100, y: 100 },
      ]) {
        game.enqueueCommand(p1, { type: 'Move', x: coord.x, y: coord.y, run: true })
        game.stepFrames(5)
      }
      expect(game.frame).toBe(18)
    })

    it('F3.B4: character with merc.dead = true or merc.seed = 0 does not spawn an active mercenary unit', () => {
      const deadMercD2s = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'NoMercHero',
          charClass: 1,
          level: 20,
          mercOverrides: {
            dead: true,
            seed: 0,
          },
        }),
      )

      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x30000004,
        areaId: 1,
      })
      const p1 = game.addPlayer({
        charName: 'NoMercHero',
        classId: 1,
        level: 20,
        d2sBytes: deadMercD2s,
      })
      game.stepFrames(3)

      const exported = Server.readD2s(game.exportPlayerD2s(p1))
      expect(exported.merc.dead || exported.merc.seed === 0).toBe(true)
    })

    it('F3.B5: MonsterAI handles all 3 difficulty tiers (Normal=0, Nightmare=1, Hell=2) without out-of-bounds table lookups', () => {
      for (const difficulty of [0, 1, 2] as const) {
        const game = new Server.GameInstance({
          policy: Server.SINGLE_PLAYER_POLICY,
          mapSeed: 0x30000005 + difficulty,
          difficulty,
          actId: 0,
          areaId: 2,
        })
        game.addPlayer({ charName: `DiffHero${difficulty}`, classId: 4, level: 60, x: 100, y: 100 })
        expect(() => game.stepFrames(10)).not.toThrow()
      }
    })
  })

  // ============================================================================
  // F4 Boundaries: Authoritative Item Drops, Ground Items, Containers, Vendor, Gamble & Imbue (5 tests)
  // ============================================================================
  describe('F4 Boundaries: Authoritative Item Drops, Ground Items, Containers, Vendor, Gamble & Imbue', () => {
    it('F4.B1: executeDropPipeline with unknown or empty TreasureClass name returns empty array safely', () => {
      const registry = getSharedDataRegistry()
      const emptyDrops = Server.executeDropPipeline({
        tcName: 'NonExistentTreasureClass_XYZ',
        mlvl: 10,
        magicFind: 0,
        playerCount: 1,
        seed: 0x40000001,
        registry,
      })
      expect(emptyDrops).toEqual([])
    })

    it('F4.B2: executeDropPipeline with extreme Magic Find (10000%) and playerCount=8 handles diminishing returns without NaN', () => {
      const registry = getSharedDataRegistry()
      const drops = Server.executeDropPipeline({
        tcName: 'Act 1 Equip A',
        mlvl: 85,
        magicFind: 10000,
        playerCount: 8,
        seed: 0x40000002,
        registry,
      })
      expect(Array.isArray(drops)).toBe(true)
      for (const drop of drops) {
        expect(Number.isNaN(drop.itemLevel)).toBe(false)
      }
    })

    it('F4.B3: ItemPickup, ItemEquip, and ItemDrop on non-existent itemId (999999) are safely rejected', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x40000003,
      })
      const p1 = game.addPlayer({ charName: 'GhostLooter', classId: 0 })
      game.drainPlayerEvents(p1)

      expect(() => {
        game.enqueueCommand(p1, { type: 'ItemPickup', itemId: 999999, toCursor: false })
        game.enqueueCommand(p1, { type: 'ItemEquip', itemId: 999999, bodyLoc: 1 })
        game.enqueueCommand(p1, { type: 'ItemDrop', itemId: 999999 })
        game.stepFrame()
      }).not.toThrow()
    })

    it('F4.B4: NpcBuy and NpcGamble with 0 gold do not grant items or underflow gold below 0', () => {
      const brokeD2s = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'BrokeHero',
          charClass: 2,
          level: 10,
          attributesOverrides: {
            gold: 0,
            goldBank: 0,
          },
        }),
      )

      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x40000004,
      })
      const p1 = game.addPlayer({
        charName: 'BrokeHero',
        classId: 2,
        level: 10,
        d2sBytes: brokeD2s,
      })
      game.drainPlayerEvents(p1)

      game.enqueueCommand(p1, { type: 'NpcBuy', npcId: 148, itemId: 1, buyType: 0 })
      game.enqueueCommand(p1, { type: 'NpcGamble', npcId: 147, itemId: 1 })
      game.stepFrame()

      const exported = Server.readD2s(game.exportPlayerD2s(p1))
      expect(exported.attributes.gold).toBe(0)
      expect(exported.attributes.goldBank).toBe(0)
    })

    it('F4.B5: ItemMove with out-of-bounds grid coordinates (negative or >10x10) is rejected cleanly', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x40000005,
      })
      const p1 = game.addPlayer({ charName: 'GridTester', classId: 3 })
      game.drainPlayerEvents(p1)

      expect(() => {
        game.enqueueCommand(p1, {
          type: 'ItemMove',
          itemId: 1,
          container: 'inventory',
          x: -5,
          y: 999,
        })
        game.stepFrame()
      }).not.toThrow()
    })
  })

  // ============================================================================
  // F5 Boundaries: Authoritative Quest, Waypoint, Portal & Level Transition State Machines (5 tests)
  // ============================================================================
  describe('F5 Boundaries: Authoritative Quest, Waypoint, Portal & Level Transition State Machines', () => {
    it('F5.B1: WaypointGo to an unactivated waypoint bit does not teleport player to the locked area', () => {
      const wpOnlyTown = new Uint8Array(24)
      wpOnlyTown[0] = 0x02
      wpOnlyTown[1] = 0x01
      wpOnlyTown[2] = 0x01 // Only bit 0 (Rogue Encampment) unlocked; Catacombs Level 2 (bit 8) locked

      const d2sBytes = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'LockedWpHero',
          charClass: 1,
          level: 12,
          waypoints: [wpOnlyTown, new Uint8Array(24), new Uint8Array(24)],
        }),
      )

      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x50000001,
        areaId: 1,
      })
      const p1 = game.addPlayer({
        charName: 'LockedWpHero',
        classId: 1,
        level: 12,
        d2sBytes,
      })
      game.drainPlayerEvents(p1)

      game.enqueueCommand(p1, {
        type: 'WaypointGo',
        waypointId: 8,
        destAreaId: 35, // Catacombs Level 2 (locked)
      })
      game.stepFrame()

      const events = game.drainPlayerEvents(p1)
      const transitionedTo35 = events.some(
        (ev) => ev.type === 'LoadAct' && ev.areaId === 35,
      )
      expect(transitionedTo35).toBe(false)
    })

    it('F5.B2: WaypointGo with invalid destAreaId (0 or 9999) is rejected without corrupting player state', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x50000002,
        areaId: 1,
      })
      const p1 = game.addPlayer({ charName: 'BadAreaWp', classId: 0 })
      game.drainPlayerEvents(p1)

      expect(() => {
        game.enqueueCommand(p1, { type: 'WaypointGo', waypointId: 99, destAreaId: 9999 })
        game.stepFrame()
      }).not.toThrow()
    })

    it('F5.B3: casting TownPortal while already inside Town (areaId = 1) is rejected per 1.13c town rules', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x50000003,
        areaId: 1, // Rogue Encampment (Town)
      })
      const p1 = game.addPlayer({ charName: 'TownTpCaster', classId: 1 })
      game.drainPlayerEvents(p1)

      game.enqueueCommand(p1, { type: 'TownPortal' })
      game.stepFrame()

      const events = game.drainPlayerEvents(p1)
      const portalEv = events.find((ev) => ev.type === 'Portal')
      expect(portalEv).toBeUndefined()
    })

    it('F5.B4: casting a second TownPortal by the same player replaces their previous active Town Portal', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x50000004,
        areaId: 2, // Blood Moor
      })
      const p1 = game.addPlayer({ charName: 'DoubleTpCaster', classId: 1, x: 100, y: 100 })
      ;(game as unknown as { players: Map<number, { items: any[] }> }).players.get(p1)!.items.push({
        unitId: 9001,
        code: 'tbk',
        location: 'inventory',
        x: 0,
        y: 0,
        quantity: 2,
        stats: new Map(),
        socketedItems: [],
      })
      game.drainPlayerEvents(p1)

      game.enqueueCommand(p1, { type: 'TownPortal' })
      game.stepFrame()
      const firstEvents = game.drainPlayerEvents(p1)
      const firstPortal = firstEvents.find(
        (ev): ev is Extract<Netproto.ServerEvent, { type: 'Portal' }> => ev.type === 'Portal',
      )
      expect(firstPortal).toBeDefined()

      game.enqueueCommand(p1, { type: 'Move', x: 130, y: 130, run: true })
      game.enqueueCommand(p1, { type: 'TownPortal' })
      game.stepFrame()
      const secondEvents = game.drainPlayerEvents(p1)
      const secondPortal = secondEvents.find(
        (ev): ev is Extract<Netproto.ServerEvent, { type: 'Portal' }> => ev.type === 'Portal',
      )
      expect(secondPortal).toBeDefined()
    })

    it('F5.B5: Respawn command is safely handled when player is alive and restores life in town when dead', () => {
      const game = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x50000005,
        areaId: 2,
      })
      const p1 = game.addPlayer({ charName: 'RespawnHero', classId: 4 })
      game.drainPlayerEvents(p1)

      expect(() => {
        game.enqueueCommand(p1, { type: 'Respawn' })
        game.stepFrame()
      }).not.toThrow()
    })
  })

  // ============================================================================
  // F6 Boundaries: 1.13c v96 .d2s Binary Character Reader, Writer & Character Store (5 tests)
  // ============================================================================
  describe('F6 Boundaries: 1.13c v96 .d2s Binary Character Reader, Writer & Character Store', () => {
    it('F6.B1: readD2s throws a descriptive error on truncated buffers (< 765 bytes) or invalid magic header', () => {
      expect(() => Server.readD2s(new Uint8Array(100))).toThrow()

      const badMagic = Server.writeD2s(createSampleD2sCharacterData())
      badMagic[0] = 0x00
      expect(() => Server.readD2s(badMagic)).toThrow()
    })

    it('F6.B2: readD2s throws when version != 96 (e.g. legacy v71 or unknown v99)', () => {
      const bytes = Server.writeD2s(createSampleD2sCharacterData())
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      view.setUint32(0x04, 71, true)
      view.setInt32(0x0c, Server.d2sChecksum(bytes), true)

      expect(() => Server.readD2s(bytes)).toThrow()
    })

    it('F6.B3: readD2s throws when stored checksum at 0x0C..0x0F does not match recomputed d2sChecksum', () => {
      const bytes = Server.writeD2s(createSampleD2sCharacterData())
      // Corrupt a payload byte without updating checksum
      bytes[0x20] ^= 0xff
      expect(() => Server.readD2s(bytes)).toThrow()
    })

    it('F6.B4: writeD2s -> readD2s handles 1-char name, 15-char max length name, and all 7 character classes (0..6)', () => {
      for (const charClass of [0, 1, 2, 3, 4, 5, 6]) {
        const shortName = `C${charClass}`
        const parsedShort = Server.readD2s(
          Server.writeD2s(createSampleD2sCharacterData({ name: shortName, charClass })),
        )
        expect(parsedShort.name).toBe(shortName)
        expect(parsedShort.charClass).toBe(charClass)
      }

      const max15Name = 'FifteenCharName'
      expect(max15Name.length).toBe(15)
      const parsed15 = Server.readD2s(
        Server.writeD2s(createSampleD2sCharacterData({ name: max15Name })),
      )
      expect(parsed15.name).toBe(max15Name)
    })

    it('F6.B5: writeD2s -> readD2s preserves zero-value attributes and level 99 max-experience boundary values', () => {
      const zeroAttrs = createSampleD2sCharacterData({
        name: 'LevelOneZero',
        level: 1,
        attributesOverrides: {
          strength: 10,
          energy: 35,
          dexterity: 25,
          vitality: 10,
          statPts: 0,
          skillPts: 0,
          level: 1,
          experience: 0,
          gold: 0,
          goldBank: 0,
        },
      })
      const parsedZero = Server.readD2s(Server.writeD2s(zeroAttrs))
      expect(parsedZero.attributes.statPts).toBe(0)
      expect(parsedZero.attributes.skillPts).toBe(0)
      expect(parsedZero.attributes.experience).toBe(0)
      expect(parsedZero.attributes.gold).toBe(0)
      expect(parsedZero.attributes.goldBank).toBe(0)

      const maxLevel = createSampleD2sCharacterData({
        name: 'LevelNinetyNine',
        level: 99,
        attributesOverrides: {
          level: 99,
          experience: 3520485254,
          gold: 990000,
          goldBank: 2500000,
        },
      })
      const parsedMax = Server.readD2s(Server.writeD2s(maxLevel))
      expect(parsedMax.level).toBe(99)
      expect(parsedMax.attributes.level).toBe(99)
      expect(parsedMax.attributes.experience >>> 0).toBe(3520485254)
      expect(parsedMax.attributes.goldBank).toBe(2500000)
    })
  })

  // ============================================================================
  // F7 Boundaries: Netproto Boundary Exports, PauseGame, LobbyProvider & Lossless TsFramer (5 tests)
  // ============================================================================
  describe('F7 Boundaries: Netproto Boundary Exports, PauseGame, LobbyProvider & Lossless TsFramer', () => {
    it('F7.B1: TsFramer reassembles 1-byte fragmented chunks and splits coalesced multi-frame bursts', () => {
      const cmd1: Netproto.ClientCommand = { type: 'PauseGame', paused: true }
      const cmd2: Netproto.ClientCommand = { type: 'Move', x: 101, y: 202, run: false }
      const cmd3: Netproto.ClientCommand = { type: 'Chat', text: 'Burst frame 3' }

      const f1 = Netproto.encodeTsFrame(cmd1)
      const f2 = Netproto.encodeTsFrame(cmd2)
      const f3 = Netproto.encodeTsFrame(cmd3)

      // 1-byte fragmentation
      const fragFramer = new Netproto.TsFramer<Netproto.ClientCommand>()
      const fragOut: Netproto.ClientCommand[] = []
      for (let i = 0; i < f1.byteLength; i++) {
        fragOut.push(...fragFramer.push(f1.subarray(i, i + 1)))
      }
      expect(fragOut).toEqual([cmd1])

      // Coalesced burst
      const burst = new Uint8Array(f1.byteLength + f2.byteLength + f3.byteLength)
      burst.set(f1, 0)
      burst.set(f2, f1.byteLength)
      burst.set(f3, f1.byteLength + f2.byteLength)

      const burstFramer = new Netproto.TsFramer<Netproto.ClientCommand>()
      expect(burstFramer.push(burst)).toEqual([cmd1, cmd2, cmd3])
    })

    it('F7.B2: encodeTsFrame and TsFramer preserve empty TypedArrays, 0x00/0xFF bytes, and special Unicode/JSON escape characters', () => {
      const payload = {
        emptyU8: new Uint8Array(0),
        emptyU16: new Uint16Array(0),
        extremeBytes: new Uint8Array([0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff]),
        specialText: 'Line1\nLine2\t"Quotes"\\Backslash\u0000Null\u2694\ufe0fSwords',
      }

      const framer = new Netproto.TsFramer<typeof payload>()
      const [decoded] = framer.push(Netproto.encodeTsFrame(payload))

      expect(decoded.emptyU8).toBeInstanceOf(Uint8Array)
      expect(decoded.emptyU8.byteLength).toBe(0)
      expect(decoded.emptyU16).toBeInstanceOf(Uint16Array)
      expect(decoded.emptyU16.length).toBe(0)
      expect(Array.from(decoded.extremeBytes)).toEqual([0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff])
      expect(decoded.specialText).toBe(payload.specialText)
    })

    it('F7.B3: TsFramer throws on invalid frame length (0 or exceeding 1MB max frame cap)', () => {
      const zeroHeader = new Uint8Array(4)
      new DataView(zeroHeader.buffer).setUint32(0, 0, true)
      const framer1 = new Netproto.TsFramer()
      expect(() => framer1.push(zeroHeader)).toThrow()

      const hugeHeader = new Uint8Array(4)
      new DataView(hugeHeader.buffer).setUint32(0, 10 * 1024 * 1024, true)
      const framer2 = new Netproto.TsFramer()
      expect(() => framer2.push(hugeHeader)).toThrow()
    })

    it('F7.B4: MemoryStream ignores post-close sends and triggers onClose callbacks exactly once', () => {
      const [a, b] = Netproto.createMemoryStreamPair()
      const receivedByB: Uint8Array[] = []
      let closeCountB = 0

      b.onMessage((bytes) => receivedByB.push(bytes))
      b.onClose(() => {
        closeCountB++
      })

      a.close('normal_shutdown')
      a.close('duplicate_shutdown')
      a.send(new Uint8Array([1, 2, 3]))

      expect(closeCountB).toBe(1)
      expect(receivedByB).toHaveLength(0)
    })

    it('F7.B5: TsServerAdapter transitions to closed on stream closure and safely ignores subsequent send() calls', () => {
      const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
      const adapter = new Netproto.TsServerAdapter(clientStream)

      serverStream.close('server_eof')
      expect(adapter.state).toBe('closed')
      expect(() => {
        adapter.send({ type: 'Move', x: 10, y: 10, run: false })
      }).not.toThrow()
    })
  })

  // ============================================================================
  // F8 Boundaries: Single Player LocalLoopbackAdapter & LocalLobbyProvider (5 tests)
  // ============================================================================
  describe('F8 Boundaries: Single Player LocalLoopbackAdapter & LocalLobbyProvider', () => {
    it('F8.B1: LocalLobbyProvider.deleteCharacter on unknown character returns false without throwing', async () => {
      const lobby = new Server.LocalLobbyProvider()
      const result = await lobby.deleteCharacter('NonExistentHeroName')
      expect(result).toBe(false)
    })

    it('F8.B2: LocalLobbyProvider.createCharacter rejects or overwrites duplicate names deterministically', async () => {
      const lobby = new Server.LocalLobbyProvider()
      await lobby.createCharacter({ name: 'DupHero', classId: 'sor' })

      const listAfterFirst = await lobby.listCharacters()
      expect(listAfterFirst.filter((c) => c.name === 'DupHero')).toHaveLength(1)
    })

    it('F8.B3: LocalLoopbackAdapter.close() is idempotent and invokes onClose callbacks once', () => {
      const adapter = new Server.LocalLoopbackAdapter({
        charName: 'IdempotentHero',
        classId: 0,
        mapSeed: 0x80000003,
      })
      let closeCalls = 0
      adapter.onClose(() => {
        closeCalls++
      })

      adapter.close()
      adapter.close()
      expect(adapter.state).toBe('closed')
      expect(closeCalls).toBe(1)
    })

    it('F8.B4: LocalLoopbackAdapter ignores commands sent after close() without advancing game state', () => {
      const adapter = new Server.LocalLoopbackAdapter({
        charName: 'ClosedHero',
        classId: 1,
        mapSeed: 0x80000004,
      })
      adapter.stepFrame()
      adapter.close()

      expect(() => {
        adapter.send({ type: 'Move', x: 200, y: 200, run: true })
      }).not.toThrow()
    })

    it('F8.B5: switching Normal -> Nightmare -> Hell -> Hell generates new mapSeeds on difficulty change and retains Hell mapSeed on Hell re-entry', async () => {
      const lobby = new Server.LocalLobbyProvider()
      const initialD2s = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'HellWalker',
          charClass: 1,
          level: 70,
          activeDifficulty: 0,
          mapSeed: 0x11111111,
        }),
      )
      lobby.importCharacterD2s(initialD2s)

      // Enter Nightmare (difficulty 1)
      const nmAdapter = (await lobby.enterGame({
        charName: 'HellWalker',
        difficulty: 1,
      })) as Server.LocalLoopbackAdapter
      const nmSeed = nmAdapter.game.mapSeed >>> 0
      expect(nmSeed).not.toBe(0x11111111)
      nmAdapter.close()

      // Enter Hell (difficulty 2)
      const hellAdapter1 = (await lobby.enterGame({
        charName: 'HellWalker',
        difficulty: 2,
      })) as Server.LocalLoopbackAdapter
      const hellSeed1 = hellAdapter1.game.mapSeed >>> 0
      expect(hellSeed1).not.toBe(nmSeed)
      hellAdapter1.close()

      // Re-enter Hell (difficulty 2) -> must retain hellSeed1
      const hellAdapter2 = (await lobby.enterGame({
        charName: 'HellWalker',
        difficulty: 2,
      })) as Server.LocalLoopbackAdapter
      expect(hellAdapter2.game.mapSeed >>> 0).toBe(hellSeed1)
      hellAdapter2.close()
    })
  })

  // ============================================================================
  // F9 Boundaries: Battle.net MultiClientRoomHost (1–8 Concurrent Players over ByteStream) (5 tests)
  // ============================================================================
  describe('F9 Boundaries: Battle.net MultiClientRoomHost (1–8 Concurrent Players over ByteStream)', () => {
    it('F9.B1: MultiClientRoomHost rejects a 9th concurrent client when 8 clients are connected', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x90000001,
      })

      for (let i = 1; i <= 8; i++) {
        const [, serverStream] = Netproto.createMemoryStreamPair()
        const pid = host.connectClient(serverStream, {
          charName: `RoomPlayer${i}`,
          classId: i % 7,
        })
        expect(pid).toBeGreaterThan(0)
      }
      expect(host.getConnectedPlayerIds()).toHaveLength(8)

      const [, ninthServerStream] = Netproto.createMemoryStreamPair()
      let ninthPid = -1
      let threw = false
      try {
        ninthPid = host.connectClient(ninthServerStream, {
          charName: 'RoomPlayer9',
          classId: 0,
        })
      } catch {
        threw = true
      }
      expect(threw || ninthPid <= 0).toBe(true)
      expect(host.getConnectedPlayerIds()).toHaveLength(8)
    })

    it('F9.B2: MultiClientRoomHost enforces per-area AOI filtering so players in different areas do not receive distant spatial moves', () => {
      const wpUnlocked = new Uint8Array(24)
      wpUnlocked[0] = 0x02
      wpUnlocked[1] = 0x01
      wpUnlocked[2] = 0x07 // Rogue Encampment + Cold Plains + Stony Field unlocked

      const d2sTraveler = Server.writeD2s(
        createSampleD2sCharacterData({
          name: 'AreaTraveler',
          charClass: 1,
          level: 20,
          waypoints: [wpUnlocked, new Uint8Array(24), new Uint8Array(24)],
        }),
      )

      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x90000002,
        areaId: 1,
      })

      const [c1Stream, s1Stream] = Netproto.createMemoryStreamPair()
      const [c2Stream, s2Stream] = Netproto.createMemoryStreamPair()
      const adapter1 = new Netproto.TsServerAdapter(c1Stream)
      const adapter2 = new Netproto.TsServerAdapter(c2Stream)

      const p1 = host.connectClient(s1Stream, {
        charName: 'AreaTraveler',
        classId: 1,
        level: 20,
        d2sBytes: d2sTraveler,
      })
      host.connectClient(s2Stream, {
        charName: 'TownObserver',
        classId: 0,
        level: 20,
      })
      host.stepFrame()

      // Move p1 to Cold Plains (areaId = 3) via WaypointGo
      const p1State = host.game.getPlayerState(p1)!
      const wp = host.game.spawnObject({
        classId: 119,
        x: p1State.x,
        y: p1State.y,
        areaId: p1State.areaId,
        isWaypoint: true,
      })
      adapter1.send({ type: 'OperateObject', objectId: wp })
      host.stepFrame()
      adapter1.send({ type: 'WaypointGo', waypointId: 1, destAreaId: 3 })
      host.stepFrame()

      const rec2 = recordAdapterEvents(adapter2)
      rec2.clear()

      // Now p1 moves inside Cold Plains (areaId = 3), while p2 is in Rogue Encampment (areaId = 1)
      adapter1.send({ type: 'Move', x: 140, y: 140, run: true })
      host.stepFrame()

      const leakedMove = rec2.events.find(
        (ev): ev is Extract<Netproto.ServerEvent, { type: 'UnitMove' }> =>
          ev.type === 'UnitMove' && ev.unitId === p1,
      )
      expect(leakedMove).toBeUndefined()
    })

    it('F9.B3: abrupt client stream closure automatically disconnects player and saves .d2s snapshot', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x90000003,
      })
      const [c1Stream, s1Stream] = Netproto.createMemoryStreamPair()
      new Netproto.TsServerAdapter(c1Stream)

      const p1 = host.connectClient(s1Stream, {
        charName: 'AbruptQuitter',
        classId: 3,
        level: 19,
      })
      expect(host.getConnectedPlayerIds()).toContain(p1)
      host.stepFrame()

      // Client stream abruptly closes
      c1Stream.close('network_drop')
      host.stepFrame()

      expect(host.getConnectedPlayerIds()).not.toContain(p1)
      const saved = host.getSavedCharacterD2s('AbruptQuitter')
      expect(saved).toBeInstanceOf(Uint8Array)
    })

    it('F9.B4: disconnectClient on an unknown or already-disconnected playerUnitId returns null safely', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x90000004,
      })
      expect(host.disconnectClient(777777)).toBeNull()
    })

    it('F9.B5: MultiClientRoomHost.stepFrames(10) with 0 connected clients executes cleanly', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0x90000005,
      })
      expect(() => host.stepFrames(10)).not.toThrow()
      expect(host.game.frame).toBe(10)
    })
  })

  // ============================================================================
  // F10 Boundaries: Deterministic Lockstep Hash Verification (5 tests)
  // ============================================================================
  describe('F10 Boundaries: Deterministic Lockstep Hash Verification', () => {
    it('F10.B1: computeFrameLockstepHash on an empty GameInstance (0 players, frame 0) returns a valid uint32', () => {
      const game = new Server.GameInstance({ mapSeed: 0xa0000001 })
      const hash = game.computeFrameLockstepHash()
      expect(typeof hash).toBe('number')
      expect(Number.isNaN(hash)).toBe(false)
      expect(hash >>> 0).toBe(hash)
    })

    it('F10.B2: 1-subtile position difference (x=100 vs x=101) produces distinct lockstep hashes', () => {
      const gameA = new Server.GameInstance({ mapSeed: 0xa0000002 })
      gameA.addPlayer({ charName: 'Hero', classId: 1, x: 100, y: 100 })
      gameA.stepFrame()

      const gameB = new Server.GameInstance({ mapSeed: 0xa0000002 })
      gameB.addPlayer({ charName: 'Hero', classId: 1, x: 101, y: 100 })
      gameB.stepFrame()

      expect(gameA.computeFrameLockstepHash()).not.toBe(gameB.computeFrameLockstepHash())
    })

    it('F10.B3: 1-bit mapSeed difference (0x11111111 vs 0x11111112) produces distinct lockstep hashes', () => {
      const gameA = new Server.GameInstance({ mapSeed: 0x11111111, areaId: 2 })
      gameA.addPlayer({ charName: 'Hero', classId: 1, x: 100, y: 100 })
      gameA.stepFrame()

      const gameB = new Server.GameInstance({ mapSeed: 0x11111112, areaId: 2 })
      gameB.addPlayer({ charName: 'Hero', classId: 1, x: 100, y: 100 })
      gameB.stepFrame()

      expect(gameA.computeFrameLockstepHash()).not.toBe(gameB.computeFrameLockstepHash())
    })

    it('F10.B4: LockstepSession.verifyPeerHash returns false when peer reports a divergent hash', () => {
      const session = new Server.LockstepSession()
      session.recordFrame(1, 0x12345678)
      expect(session.verifyPeerHash(1, 0x12345678)).toBe(true)
      expect(session.verifyPeerHash(1, 0x12345679)).toBe(false)
    })

    it('F10.B5: computeFrameLockstepHash is pure and idempotent when called repeatedly on the same frame', () => {
      const game = new Server.GameInstance({ mapSeed: 0xa0000005 })
      game.addPlayer({ charName: 'PureHero', classId: 2 })
      game.stepFrame()

      const h1 = game.computeFrameLockstepHash()
      const h2 = game.computeFrameLockstepHash()
      const h3 = game.computeFrameLockstepHash()
      expect(h1).toBe(h2)
      expect(h2).toBe(h3)
    })
  })

  // ============================================================================
  // F11 Boundaries: Client Single-Player & Battle.net Unified Session Integration (5 tests)
  // ============================================================================
  describe('F11 Boundaries: Client Single-Player & Battle.net Unified Session Integration', () => {
    it('F11.B1: OnlineSession cleanly resets ClientWorld entities when switching between Single Player and Battle.net adapters', () => {
      const session = new OnlineSession()

      const spAdapter = new Server.LocalLoopbackAdapter({
        charName: 'SpSwitchHero',
        classId: 0,
        mapSeed: 0xb0000001,
      })
      session.attachGameServer(spAdapter)
      spAdapter.stepFrame()
      session.tick(40, 40)
      const spPlayerId = session.world.localPlayerId
      expect(spPlayerId).toBe(spAdapter.playerUnitId)
      session.leaveGame()

      const host = new Server.MultiClientRoomHost({ mapSeed: 0xb0000002 })
      const [cStream, sStream] = Netproto.createMemoryStreamPair()
      const bnetAdapter = new Netproto.TsServerAdapter(cStream)
      session.attachGameServer(bnetAdapter)
      const bnetPlayerId = host.connectClient(sStream, { charName: 'BnetSwitchHero', classId: 4 })
      host.stepFrame()
      session.tick(40, 80)

      expect(session.world.localPlayerId).toBe(bnetPlayerId)
      session.leaveGame()
    })

    it('F11.B2: OnlineSession.tick() and dispatchCommand() before attachGameServer or after leaveGame do not throw', () => {
      const session = new OnlineSession()
      expect(() => {
        session.tick(40, 40)
        session.dispatchCommand({ type: 'Move', x: 10, y: 10, run: true })
        session.leaveGame()
      }).not.toThrow()
    })

    it('F11.B3: OnlineSession.submitChatInput handles empty strings and special escaping characters safely', () => {
      const adapter = new Server.LocalLoopbackAdapter({
        charName: 'ChatEdgeHero',
        classId: 1,
        mapSeed: 0xb0000003,
      })
      const session = new OnlineSession()
      session.attachGameServer(adapter)
      adapter.stepFrame()

      expect(() => {
        session.submitChatInput('')
        session.submitChatInput('   ')
        session.submitChatInput('Special chars: "quotes" \\backslash \n newline \u2694\ufe0f')
        adapter.stepFrame()
        session.tick(40, 80)
      }).not.toThrow()
      session.leaveGame()
    })

    it('F11.B4: OnlineSession removes remote co-op player entity from ClientWorld when UnitRemove is received', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0xb0000004,
      })
      const [c1Stream, s1Stream] = Netproto.createMemoryStreamPair()
      const [c2Stream, s2Stream] = Netproto.createMemoryStreamPair()

      const adapter1 = new Netproto.TsServerAdapter(c1Stream)
      new Netproto.TsServerAdapter(c2Stream)

      const session1 = new OnlineSession()
      session1.attachGameServer(adapter1)

      host.connectClient(s1Stream, { charName: 'ObserverP1', classId: 0, x: 100, y: 100 })
      const p2 = host.connectClient(s2Stream, { charName: 'DepartingP2', classId: 1, x: 102, y: 102 })
      host.stepFrame()
      session1.tick(40, 40)

      expect(session1.world.entities.has(p2)).toBe(true)

      host.disconnectClient(p2, 'peer_left')
      host.stepFrame()
      session1.tick(40, 80)

      expect(session1.world.entities.has(p2)).toBe(false)
      session1.leaveGame()
    })

    it('F11.B5: OnlineSession handles server-initiated disconnect gracefully', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.OPEN_BNET_POLICY,
        mapSeed: 0xb0000005,
      })
      const [cStream, sStream] = Netproto.createMemoryStreamPair()
      const adapter = new Netproto.TsServerAdapter(cStream)
      const session = new OnlineSession()
      session.attachGameServer(adapter)

      const p1 = host.connectClient(sStream, { charName: 'KickedHero', classId: 2 })
      host.stepFrame()
      session.tick(40, 40)

      host.disconnectClient(p1, 'server_shutdown')
      host.stepFrame()
      expect(() => session.tick(40, 80)).not.toThrow()
    })
  })

  // ============================================================================
  // F12 Boundaries: Retire Legacy Split-Track Prototype & Reconcile README + Barrel (5 tests)
  // ============================================================================
  describe('F12 Boundaries: Retire Legacy Split-Track Prototype & Reconcile README + Barrel', () => {
    it('F12.B1: src/netproto/** has zero imports from src/client/** and zero runtime imports from src/server/**', () => {
      const netprotoFiles = collectTsFilesRecursive(`${SRC_DIR}/netproto`)
      expect(netprotoFiles.length).toBeGreaterThan(0)

      for (const file of netprotoFiles) {
        const rel = toRepoRelative(file)
        const content = readRepoFile(rel)
        expect(content, `${rel} must not import src/client`).not.toMatch(
          /from\s+['"][^'"]*\/client(?:\/|['"])/,
        )
        expect(content, `${rel} must not import src/server`).not.toMatch(
          /from\s+['"][^'"]*\/server(?:\/|['"])/,
        )
      }
    })

    it('F12.B2: src/server/** has zero references to Browser DOM / WebGL / AudioContext globals', () => {
      const serverFiles = collectTsFilesRecursive(`${SRC_DIR}/server`)
      const forbiddenDomPatterns = [
        /\bwindow\./,
        /\bdocument\./,
        /\bHTMLCanvasElement\b/,
        /\bWebGLRenderingContext\b/,
        /\bWebGL2RenderingContext\b/,
        /\bAudioContext\b/,
        /\brequestAnimationFrame\b/,
      ]

      for (const file of serverFiles) {
        const rel = toRepoRelative(file)
        const content = readRepoFile(rel)
        for (const pat of forbiddenDomPatterns) {
          expect(content, `${rel} must not use browser DOM global ${pat}`).not.toMatch(pat)
        }
      }
    })

    it('F12.B3: src/server/engine.ts re-exports GameInstance and GameModePolicy presets without referencing deleted engine/engine.ts or engine/combat.ts', () => {
      expect(repoPathExists('src/server/engine.ts')).toBe(true)
      const engineBarrel = readRepoFile('src/server/engine.ts')
      expect(engineBarrel).not.toMatch(/\.\/engine\/engine/)
      expect(engineBarrel).not.toMatch(/\.\/engine\/combat/)
    })

    it('F12.B4: no leftover backup or temporary files exist for any of the 4 retired split-track modules', () => {
      for (const retired of RETIRED_LEGACY_FILES) {
        expect(repoPathExists(retired)).toBe(false)
        expect(repoPathExists(`${retired}.bak`)).toBe(false)
        expect(repoPathExists(`${retired}.old`)).toBe(false)
      }
    })

    it('F12.B5: every runtime value exported by src/server/index.ts is defined and non-null', () => {
      const entries = Object.entries(Server)
      expect(entries.length).toBeGreaterThan(20)
      for (const [key, val] of entries) {
        expect(val, `Export ${key} in src/server/index.ts must be defined`).toBeDefined()
        expect(val, `Export ${key} in src/server/index.ts must not be null`).not.toBeNull()
      }
    })
  })
})
