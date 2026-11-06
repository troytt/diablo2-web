/**
 * Milestone M1 (`m1_netproto_d2s_core`) Verification Suite (`tests/server-m1-netproto-d2s-core.test.ts`).
 *
 * Tests all Part A, Part B, Part C, and Part D deliverables:
 * - Part A: `PauseGameCommand`, lossless `Uint8Array`/`Uint16Array` framing in `encodeTsFrame`/`TsFramer`,
 *   `registerLocalServerFactory`/`createLocalServerSession`, `registerLocalLobbyProvider`/`getLocalLobbyProvider`,
 *   and `encodeItemBitstream`/`decodeItemBitstreamWithLength` via `src/netproto/index.ts`.
 * - Part B: 1.13c v96 `.d2s` binary reader & writer (`writeD2sSave113c` -> `readD2sSave113c`, checksum,
 *   `"gf"` attributes, `"if"` 30-byte skills, `"JM"` items + socketed children, corpse `"JM"`, mercenary `"jf"`,
 *   Iron Golem `"kf"`, `InMemoryD2sCharacterStore`).
 * - Part C: `src/server/ai/monster-ai.ts` (`executeShamanResurrect113c`, `executeOblivionKnightCurse113c`,
 *   `executeActBossAi113c`, `triggerMonsterDeathAffixes113c`, `tickMercenaryAi25Hz`) & `src/server/ai/room-streamer.ts`
 *   (`RoomStreamer.updateForPlayers`), `src/server/items/drop-pipeline.ts` (`resolveMonsterDropPending113c`,
 *   `executePendingMonsterDrop113c`), `src/server/items/imbue.ts` (`imbueItemCharsi`), and
 *   `src/server/items/ground-items.ts` (`worldToCell`).
 * - Part D: `src/server/engine/state-hash.ts` (`computeLockstepHash` on `CombatWorld`, `WorldArena`, and `GameInstance`),
 *   `unsummonOwnPetAt` in `src/server/ai/summon-manager.ts`, and `DRUID_TRANSFORM_CLT_OVERLAYS_113C` in `src/server/skills/skills.ts`.
 */

import { describe, expect, it, vi } from 'vitest'
import * as commonDropTables from '../src/common/items/drop-tables.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import {
  ProtocolError,
  TsClientAdapter,
  TsFramer,
  TsServerAdapter,
  createLocalServerSession,
  createMemoryStreamPair,
  decodeItemBitstream,
  decodeItemBitstreamWithLength,
  encodeD2gsClientCommand,
  encodeItemBitstream,
  encodeTsFrame,
  getLocalLobbyProvider,
  registerLocalLobbyProvider,
  registerLocalServerFactory,
  type ItemData,
  type LobbyProvider,
  type PauseGameCommand,
  type ServerEvent,
} from '../src/netproto/index.ts'
import {
  MON_UMOD,
  MonsterAI,
  createPlayer,
  createWorld,
  damageMonster,
  executeActBossAi113c,
  executeOblivionKnightCurse113c,
  executeShamanResurrect113c,
  tickMercenaryAi25Hz,
  tickMonsters,
  triggerMonsterDeathAffixes113c,
  type Monster,
} from '../src/server/ai/monster-ai.ts'
import { RoomStreamer, streamActiveRooms113c } from '../src/server/ai/room-streamer.ts'
import { UNSUMMON_PICK_RADIUS, unsummonOwnPetAt } from '../src/server/ai/summon-manager.ts'
import { LockstepSession, computeLockstepHash, hashWorldState } from '../src/server/engine/state-hash.ts'
import {
  executeDropPipeline,
  executePendingMonsterDrop113c,
  getEmbeddedDropTables,
  queueMonsterDeathDrop113c,
  resolveMonsterDropPending113c,
  tickPendingMonsterDrops113c,
} from '../src/server/items/drop-pipeline.ts'
import { worldToCell } from '../src/server/items/ground-items.ts'
import { computeCharsiImbueIlvl, imbueItemCharsi, isEligibleForCharsiImbue113c } from '../src/server/items/imbue.ts'
import {
  D2S_MAGIC,
  D2sCharacterStore,
  D2sCharacterStoreImpl,
  InMemoryD2sCharacterStore,
  computeD2sChecksum,
  extractCharSummaryFromD2s,
  getServerItemDataTables,
  readD2s,
  readD2sSave,
  readD2sSave113c,
  verifyD2sChecksum,
  writeD2s,
  writeD2sSave,
  writeD2sSave113c,
  type D2sCharacterSave,
} from '../src/server/save/save.ts'
import {
  DRUID_TRANSFORM_CLT_OVERLAYS_113C,
  applyEnchantBuff,
  canCastEnchantOn,
} from '../src/server/skills/skills.ts'

describe('Milestone M1 (m1_netproto_d2s_core) — Netproto, .d2s v96 Binary Save, Monster AI, Drops & Lockstep Hash', () => {
  describe('Part A: src/netproto/ Extensions & Lossless TypedArray TsFramer (Feature F7)', () => {
    it('supports PauseGameCommand and encodes to empty D2GS byte array without throwing', () => {
      const pauseCmdType: PauseGameCommand = { type: 'PauseGame', paused: true }
      const pauseCmdKind: PauseGameCommand = {
        type: 'PauseGame',
        kind: 'pauseGame',
        tick: 42,
        paused: false,
      }
      expect(encodeD2gsClientCommand(pauseCmdType)).toEqual([])
      expect(encodeD2gsClientCommand(pauseCmdKind)).toEqual([])

      let receivedCmd: PauseGameCommand | null = null
      const [clientStream, serverStream] = createMemoryStreamPair()
      const serverAdapter = new TsServerAdapter(serverStream)
      serverAdapter.onEvent((ev) => {
        const cmd = ev as unknown as PauseGameCommand
        if (cmd.type === 'PauseGame' || cmd.kind === 'pauseGame') {
          receivedCmd = cmd
        }
      })
      const clientAdapter = new TsClientAdapter(clientStream)
      clientAdapter.send(pauseCmdKind)
      expect(receivedCmd).toEqual(pauseCmdKind)
    })

    it('losslessly round-trips Uint8Array and Uint16Array over encodeTsFrame and TsFramer', () => {
      const automapBits = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02])
      const tileIds = new Uint16Array([1024, 2048, 4096, 65535])
      const bitstream = new Uint8Array([0x4a, 0x4d, 0x10, 0x08, 0x80, 0x00])

      const events: ServerEvent[] = [
        {
          type: 'WorldSnapshot',
          tick: 15,
          levelId: 2,
          discoveredAutomapCells: automapBits,
        } as unknown as ServerEvent,
        {
          type: 'TileDelta',
          tick: 16,
          tiles: tileIds,
        } as unknown as ServerEvent,
        {
          type: 'ItemAction',
          action: 0,
          item: {
            id: 99,
            code: 'hax',
          } as unknown as ItemData,
          bitstream,
        } as unknown as ServerEvent,
      ]

      const framer = new TsFramer()
      for (const ev of events) {
        const frame = encodeTsFrame({ kind: 'event', payload: ev })
        // Verify chunked streaming (split frame across 2 chunks)
        const mid = Math.floor(frame.byteLength / 2)
        expect(framer.feed(frame.subarray(0, mid))).toEqual([])
        expect(framer.bufferedBytes).toBe(mid)
        const decoded = framer.feed(frame.subarray(mid))
        expect(decoded.length).toBe(1)
        const payload = (decoded[0] as any).payload
        if (payload.type === 'WorldSnapshot') {
          expect(payload.discoveredAutomapCells).toBeInstanceOf(Uint8Array)
          expect(Array.from(payload.discoveredAutomapCells)).toEqual(Array.from(automapBits))
        } else if (payload.type === 'TileDelta') {
          expect(payload.tiles).toBeInstanceOf(Uint16Array)
          expect(Array.from(payload.tiles)).toEqual(Array.from(tileIds))
        } else if (payload.type === 'ItemAction') {
          expect(payload.bitstream).toBeInstanceOf(Uint8Array)
          expect(Array.from(payload.bitstream)).toEqual(Array.from(bitstream))
        }
      }
      expect(framer.bufferedBytes).toBe(0)
    })

    it('enforces TsFramer.push() length bounds (len === 0 and len > 1 MiB throw ProtocolError) and supports MemoryStream/TsServerAdapter ergonomics', () => {
      const framerZero = new TsFramer()
      expect(() => framerZero.push(new Uint8Array([0, 0, 0, 0]))).toThrow(ProtocolError)

      const framerOversize = new TsFramer()
      const oversizeHeader = new Uint8Array(4)
      new DataView(oversizeHeader.buffer).setUint32(0, 1024 * 1024 + 1, true)
      expect(() => framerOversize.push(oversizeHeader)).toThrow(ProtocolError)

      // MemoryStream send / onMessage / close(string) + post-close no-op
      const [streamA, streamB] = createMemoryStreamPair()
      const chunks: Uint8Array[] = []
      let closeReason: unknown = null
      streamB.onMessage((c) => chunks.push(c))
      streamB.onClose((r) => {
        closeReason = r
      })
      streamA.send(new Uint8Array([1, 2, 3]))
      expect(chunks.length).toBe(1)
      expect(Array.from(chunks[0]!)).toEqual([1, 2, 3])
      streamA.close('done')
      expect(closeReason).toEqual({ kind: 'local', reason: 'done' })
      // Post-close send is a safe no-op
      expect(() => streamA.send(new Uint8Array([4, 5]))).not.toThrow()
      expect(chunks.length).toBe(1)

      // TsServerAdapter.kind, getStats(), and post-close send no-op
      const [clientStream, serverStream] = createMemoryStreamPair()
      const serverAdapter = new TsServerAdapter(serverStream)
      const clientAdapter = new TsClientAdapter(clientStream)
      expect(serverAdapter.kind).toBe('ts')
      expect(serverAdapter.getStats().packetsSent).toBe(0)
      serverAdapter.send({ type: 'PauseGame', paused: true })
      expect(serverAdapter.getStats().packetsSent).toBe(1)
      expect(clientAdapter.getStats().packetsIn).toBe(1)
      serverAdapter.close()
      expect(() => serverAdapter.send({ type: 'PauseGame', paused: false })).not.toThrow()
      expect(serverAdapter.getStats().packetsSent).toBe(1)
    })

    it('registers and invokes LocalServerSessionFactory and LobbyProvider via src/netproto/index.ts', async () => {
      const [clientStream] = createMemoryStreamPair()
      const mockAdapter = new TsClientAdapter(clientStream)
      registerLocalServerFactory((req) => ({
        adapter: mockAdapter,
        stepFrame: vi.fn(),
        stepTick: vi.fn(),
        exportD2s: () => new Uint8Array([req?.mapSeed ? req.mapSeed & 0xff : 0]),
        stop: vi.fn(),
      }))

      const session = createLocalServerSession({
        charName: 'SorceressM1',
        charClassId: 1,
        classId: 'sor',
        difficulty: 0,
        mapSeed: 0xdeadbeef,
      })
      expect(session).not.toBeNull()
      expect(session!.adapter).toBe(mockAdapter)
      expect(session!.exportD2s()[0]).toBe(0xef)

      const charSummary = {
        name: 'SorceressM1',
        charClass: 1 as const,
        classId: 1 as const,
        level: 24,
        hardcore: false,
        dead: false,
        expansion: true,
        ladder: false,
        act: 1,
        difficulty: 0 as const,
        expiresAt: 0,
        equipmentGraphics: new Uint8Array(9),
        rawStatString: new Uint8Array(33),
      }
      const provider: LobbyProvider = {
        mode: 'local',
        listCharacters: async () => [charSummary],
        createCharacter: async () => charSummary,
        deleteCharacter: async () => true,
        selectCharacter: async () => {},
        listGames: async () => [],
        enterGame: async () => mockAdapter,
      }
      registerLocalLobbyProvider(provider)
      expect(getLocalLobbyProvider()).toBe(provider)
      expect((await getLocalLobbyProvider()!.listCharacters()).length).toBe(1)
    })

    it('encodes and decodes 1.13c item bitstreams with byte length tracking', () => {
      const tables = getServerItemDataTables()
      const sampleItem = {
        id: 1,
        code: 'cap ',
        location: 0,
        x: 2,
        y: 1,
        panel: 0,
        ear: false,
        simple: false,
        identified: true,
        ethereal: false,
        socketed: true,
        runeword: false,
        personalized: false,
        ilvl: 25,
        quality: 4, // magic
        socketCount: 1,
        totalSockets: 1,
        defense: 18,
        maxDurability: 12,
        durability: 10,
        magicPrefixIds: [0],
        magicSuffixIds: [0],
        stats: [{ statId: 0, param: 0, value: 10 }], // +10 Strength
      } as unknown as ItemData
      const bytes = encodeItemBitstream(sampleItem, { tables })
      expect(bytes[0]).toBe(0x4a) // 'J'
      expect(bytes[1]).toBe(0x4d) // 'M'

      const decodedWithLen = decodeItemBitstreamWithLength(bytes, tables, 0, 96)
      expect(decodedWithLen.byteLength).toBe(bytes.byteLength)
      expect(decodedWithLen.item.code.trim()).toBe('cap')
      expect(decodedWithLen.item.container).toBe('inventory')
      expect(decodedWithLen.item.x).toBe(2)
      expect(decodedWithLen.item.y).toBe(1)

      const decodedDirect = decodeItemBitstream(bytes, tables, 0, 96)
      expect(decodedDirect.code.trim()).toBe('cap')
    })
  })

  describe('Part B: 1.13c v96 .d2s Binary Reader & Writer (Feature F6)', () => {
    it('round-trips a full 1.13c v96 .d2s save including header, gf attributes, if 30 skills, JM items + socketed child, corpse, jf merc, and kf iron golem', () => {
      const skills = new Uint8Array(30)
      skills[0] = 5
      skills[1] = 12
      skills[29] = 3

      const hostHelm = {
        id: 101,
        code: 'cap ',
        location: 1,
        equippedSlot: 1,
        x: 0,
        y: 0,
        panel: 0,
        ear: false,
        simple: false,
        identified: true,
        ethereal: false,
        socketed: true,
        runeword: false,
        personalized: false,
        ilvl: 30,
        quality: 2,
        socketCount: 1,
        totalSockets: 1,
        defense: 15,
        maxDurability: 12,
        durability: 12,
        stats: [],
        socketedItems: [
          {
            id: 102,
            code: 'gcv ', // Chipped Amethyst
            location: 6,
            x: 0,
            y: 0,
            panel: 0,
            ear: false,
            simple: true,
            identified: true,
            ethereal: false,
            socketed: false,
            runeword: false,
            personalized: false,
            ilvl: 1,
            quality: 2,
            socketCount: 0,
            stats: [],
          } as unknown as ItemData,
        ],
      } as unknown as ItemData

      const mercWeapon = {
        id: 201,
        code: 'spr ', // Spear
        location: 1,
        equippedSlot: 4,
        x: 0,
        y: 0,
        panel: 0,
        ear: false,
        simple: false,
        identified: true,
        ethereal: false,
        socketed: false,
        runeword: false,
        personalized: false,
        ilvl: 20,
        quality: 2,
        socketCount: 0,
        maxDurability: 30,
        durability: 28,
        stats: [],
      } as unknown as ItemData

      const golemSourceItem = {
        id: 301,
        code: 'hax ', // Hand Axe
        location: 1,
        equippedSlot: 4,
        x: 0,
        y: 0,
        panel: 0,
        ear: false,
        simple: false,
        identified: true,
        ethereal: false,
        socketed: false,
        runeword: false,
        personalized: false,
        ilvl: 15,
        quality: 2,
        socketCount: 0,
        maxDurability: 28,
        durability: 28,
        stats: [],
      } as unknown as ItemData

      const saveInput: D2sCharacterSave = {
        name: 'NecroLord',
        classId: 2, // Necromancer
        classCode: 'nec',
        level: 42,
        statusFlags: 0x20, // Expansion
        progression: 5,
        activeWeapon: 0,
        timestamp: 1700000000,
        mapSeed: 0xcafebabe,
        difficulty: 1, // Nightmare
        act: 2,
        attributes: {
          strength: 75,
          energy: 90,
          dexterity: 60,
          vitality: 140,
          statpts: 10,
          newskills: 4,
          hitpoints: 350 * 256,
          maxhp: 380 * 256,
          mana: 220 * 256,
          maxmana: 240 * 256,
          stamina: 180 * 256,
          maxstamina: 190 * 256,
          level: 42,
          experience: 21500000,
          gold: 85000,
          goldbank: 420000,
        },
        skills,
        items: [hostHelm],
        corpseItems: [],
        mercenary: {
          flags: 0,
          guid: 0x11223344,
          nameId: 3,
          typeId: 11,
          experience: 540000,
          items: [mercWeapon],
        },
        ironGolemItem: golemSourceItem,
      }

      const binary = writeD2sSave113c(saveInput)
      const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength)
      expect(view.getUint32(0, true)).toBe(D2S_MAGIC)
      expect(view.getUint32(4, true)).toBe(96)
      expect(view.getUint32(8, true)).toBe(binary.byteLength)
      expect(verifyD2sChecksum(binary)).toBe(true)
      expect(view.getUint32(12, true)).toBe(computeD2sChecksum(binary))

      const parsed = readD2sSave113c(binary)
      expect(parsed.name).toBe('NecroLord')
      expect(parsed.classId).toBe(2)
      expect(parsed.classCode).toBe('nec')
      expect(parsed.level).toBe(42)
      expect(parsed.mapSeed).toBe(0xcafebabe)
      expect(parsed.difficulty).toBe(1)
      expect(parsed.act).toBe(2)
      expect(parsed.attributes.strength).toBe(75)
      expect(parsed.attributes.vitality).toBe(140)
      expect(parsed.attributes.gold).toBe(85000)
      expect(parsed.attributes.goldbank).toBe(420000)
      expect(parsed.skills[0]).toBe(5)
      expect(parsed.skills[1]).toBe(12)
      expect(parsed.skills[29]).toBe(3)
      expect(parsed.items.length).toBe(1)
      expect(parsed.items[0]!.code.trim()).toBe('cap')
      expect(parsed.items[0]!.container).toBe('equipment')
      expect(parsed.items[0]!.socketedItems?.length).toBe(1)
      expect(parsed.items[0]!.socketedItems?.[0]?.code.trim()).toBe('gcv')
      expect(parsed.items[0]!.socketedItems?.[0]?.container).toBe('socket')
      expect(parsed.mercenary?.guid).toBe(0x11223344)
      expect(parsed.mercenary?.items.length).toBe(1)
      expect(parsed.mercenary?.items[0]!.code.trim()).toBe('spr')
      expect(parsed.ironGolemItem?.code.trim()).toBe('hax')

      // Test InMemoryD2sCharacterStore
      const store = new InMemoryD2sCharacterStore()
      store.saveCharacter(parsed)
      expect(store.listNames()).toEqual(['NecroLord'])
      expect(store.loadCharacter('necrolord')?.name).toBe('NecroLord')
      expect(store.delete('NECROLORD')).toBe(true)
      expect(store.listNames()).toEqual([])
    })

    it('preserves item containers (inventory, stash, cube, belt, equipment), structured quests/waypoints tuples, npcIntros [0x01, 0x77], *Fixed attributes, and aliases', () => {
      const quests: [Uint16Array, Uint16Array, Uint16Array] = [
        new Uint16Array(48),
        new Uint16Array(48),
        new Uint16Array(48),
      ]
      quests[0][1] = 0x0001 // Den of Evil completed
      quests[2][15] = 0x0013

      const waypoints: [Uint8Array, Uint8Array, Uint8Array] = [
        new Uint8Array(24),
        new Uint8Array(24),
        new Uint8Array(24),
      ]
      waypoints[0][2] = 0x07 // Rogue Encampment + Cold Plains + Stony Field
      waypoints[1][2] = 0x01

      const npcIntros = new Uint8Array(52)
      npcIntros[0] = 0x01
      npcIntros[1] = 0x77
      npcIntros[8] = 0xff

      const invItem = {
        id: 11,
        code: 'rin ',
        container: 'inventory' as const,
        x: 3,
        y: 2,
        simple: false,
        identified: true,
        ilvl: 40,
        quality: 4,
        magicPrefixIds: [0],
        magicSuffixIds: [0],
        stats: [],
      }
      const stashItem = {
        id: 12,
        code: 'amu ',
        container: 'stash' as const,
        x: 4,
        y: 5,
        simple: false,
        identified: true,
        ilvl: 50,
        quality: 4,
        magicPrefixIds: [0],
        magicSuffixIds: [0],
        stats: [],
      }
      const cubeItem = {
        id: 13,
        code: 'gcv ',
        container: 'cube' as const,
        x: 1,
        y: 1,
        simple: true,
        identified: true,
        ilvl: 10,
        quality: 2,
        stats: [],
      }
      const beltItem = {
        id: 14,
        code: 'hp1 ',
        container: 'belt' as const,
        x: 2,
        y: 0,
        simple: true,
        identified: true,
        ilvl: 1,
        quality: 2,
        stats: [],
      }

      const skillLevels = new Uint8Array(30)
      skillLevels[3] = 9

      const bytes = writeD2s({
        name: 'PaladinHero',
        classId: 3,
        level: 65,
        statusFlags: 0x20,
        progression: 12,
        activeWeapon: 1,
        timestampSec: 1712345678,
        leftRightSkills: [2, 112, 0, 113],
        difficultyTowns: [0x80, 0x01, 0x02],
        mapSeed: 0x12345678,
        quests,
        waypoints,
        npcIntros,
        attributes: {
          strength: 120,
          energy: 25,
          dexterity: 100,
          vitality: 210,
          statPts: 15,
          skillPts: 3,
          hitpointsFixed: 950 * 256,
          maxHpFixed: 1000 * 256,
          manaFixed: 180 * 256,
          maxManaFixed: 200 * 256,
          staminaFixed: 300 * 256,
          maxStaminaFixed: 310 * 256,
          level: 65,
          experience: 180000000,
          gold: 120000,
          goldBank: 1500000,
        },
        skillLevels,
        items: [invItem, stashItem, cubeItem, beltItem],
        merc: {
          dead: true,
          guid: 0x99887766,
          nameId: 5,
          typeId: 7,
          experience: 900000,
          items: [],
        },
      })

      expect(verifyD2sChecksum(bytes)).toBe(true)
      const summary = extractCharSummaryFromD2s(bytes)
      expect(summary.name).toBe('PaladinHero')
      expect(summary.classId).toBe(3)
      expect(summary.level).toBe(65)

      const decoded = readD2s(bytes)
      expect(decoded.name).toBe('PaladinHero')
      expect(decoded.timestampSec).toBe(1712345678)
      expect(decoded.leftRightSkills).toEqual([2, 112, 0, 113])
      expect(decoded.difficultyTowns).toEqual([0x80, 0x01, 0x02])
      expect(decoded.quests[0][1]).toBe(0x0001)
      expect(decoded.quests[2][15]).toBe(0x0013)
      expect(decoded.waypoints[0][2]).toBe(0x07)
      expect(decoded.waypoints[1][2]).toBe(0x01)
      expect(decoded.npcIntros[0]).toBe(0x01)
      expect(decoded.npcIntros[1]).toBe(0x77)
      expect(decoded.npcIntros[8]).toBe(0xff)
      expect(decoded.attributes.statPts).toBe(15)
      expect(decoded.attributes.skillPts).toBe(3)
      expect(decoded.attributes.hitpointsFixed).toBe(950 * 256)
      expect(decoded.attributes.maxHpFixed).toBe(1000 * 256)
      expect(decoded.attributes.manaFixed).toBe(180 * 256)
      expect(decoded.attributes.maxManaFixed).toBe(200 * 256)
      expect(decoded.attributes.staminaFixed).toBe(300 * 256)
      expect(decoded.attributes.maxStaminaFixed).toBe(310 * 256)
      expect(decoded.attributes.goldBank).toBe(1500000)
      expect(decoded.skillLevels[3]).toBe(9)
      expect(decoded.merc?.dead).toBe(true)
      expect(decoded.merc?.guid).toBe(0x99887766)

      // Verify all 4 containers round-tripped intact
      expect(decoded.items.map((it) => it.container)).toEqual(['inventory', 'stash', 'cube', 'belt'])
      expect(decoded.items[0]!.x).toBe(3)
      expect(decoded.items[0]!.y).toBe(2)
      expect(decoded.items[1]!.x).toBe(4)
      expect(decoded.items[1]!.y).toBe(5)
      expect(decoded.items[2]!.x).toBe(1)
      expect(decoded.items[2]!.y).toBe(1)
      expect(decoded.items[3]!.x).toBe(2)

      // Verify D2sCharacterStore / D2sCharacterStoreImpl aliases and saveBytes/loadBytes
      const store = new D2sCharacterStore()
      expect(store).toBeInstanceOf(D2sCharacterStoreImpl)
      store.saveBytes('PaladinHero', bytes)
      expect(store.loadBytes('paladinhero')).toEqual(bytes)
      store.saveCharacter('PaladinCopy', decoded)
      expect(store.loadCharacter('paladincopy')?.name).toBe('PaladinHero')
      expect(readD2sSave(writeD2sSave(decoded)).name).toBe('PaladinHero')
    })
  })

  describe('Part C: Monster AI, RoomStreamer, Drop Pipeline, Imbue & Ground Items (Features F3 & F4)', () => {
    it('executes Shaman resurrection, Oblivion Knight curses, Act Boss AI, death affixes, and Mercenary 25Hz AI', () => {
      const world = createWorld(200, 200, 500, 200, 'pal')
      const terrain = { overlap: () => 0 }
      const rng = new D2Rng(0x123456)

      // 1. Fallen Shaman resurrects dead Fallen corpse
      const deadFallen: Monster = {
        index: 0,
        stats: {
          id: 'fallen1',
          name: 'Fallen',
          hp: 25,
          damage: 4,
          cooldownTicks: 20,
          reach: 35,
          aggroRadius: 200,
          speed: 80,
          xp: 10,
        },
        x: 230,
        y: 230,
        hp: 0,
        cooldown: 0,
        state: 'dead',
        facing: 0,
        hitFlash: 0,
        corpseTicks: 100,
      }
      const shaman: Monster = {
        index: 1,
        stats: {
          id: 'fallenshaman1',
          name: 'Fallen Shaman',
          hp: 40,
          damage: 6,
          cooldownTicks: 25,
          reach: 35,
          aggroRadius: 240,
          speed: 70,
          xp: 25,
        },
        x: 250,
        y: 250,
        hp: 40,
        cooldown: 0,
        state: 'idle',
        facing: 0,
        hitFlash: 0,
        corpseTicks: 0,
      }
      world.monsters.push(deadFallen, shaman)
      const revived = executeShamanResurrect113c(world, shaman, rng)
      expect(revived).toBe(deadFallen)
      expect(deadFallen.state).toBe('idle')
      expect(deadFallen.hp).toBe(25)

      // 2. Oblivion Knight casts 1.13c curse (never Iron Maiden)
      const okKnight: Monster = {
        index: 2,
        stats: {
          id: 'doomknight3',
          name: 'Oblivion Knight',
          hp: 120,
          damage: 15,
          cooldownTicks: 25,
          reach: 40,
          aggroRadius: 300,
          speed: 80,
          xp: 100,
        },
        x: 240,
        y: 200,
        hp: 120,
        cooldown: 0,
        state: 'chase',
        facing: 0,
        hitFlash: 0,
        corpseTicks: 0,
      }
      world.monsters.push(okKnight)
      const curseCast = executeOblivionKnightCurse113c(world, okKnight, world.player, 10)
      expect(typeof curseCast).toBe('string')
      expect(curseCast).not.toBe('ironmaiden')
      expect(world.events.some((e) => e.kind === 'unitOverlay')).toBe(true)

      // 3. Act Boss AI (Diablo)
      const diablo: Monster = {
        index: 3,
        stats: {
          id: 'diablo',
          name: 'Diablo',
          hp: 1000,
          damage: 45,
          cooldownTicks: 25,
          reach: 50,
          aggroRadius: 400,
          speed: 100,
          xp: 5000,
          rank: 'boss',
          isBoss: true,
        },
        x: 260,
        y: 200,
        hp: 1000,
        cooldown: 0,
        state: 'attack',
        facing: 0,
        hitFlash: 0,
        corpseTicks: 0,
      }
      world.monsters.push(diablo)
      const bossAction = executeActBossAi113c(world, diablo, world.player, rng)
      expect(bossAction.action).toBe('special')

      // 4. Fire Enchanted death affix & partial monster stub with Lightning/Cold UMods
      const feBoss: Monster = {
        index: 4,
        stats: {
          id: 'zombie1',
          name: 'Fire Zombie',
          hp: 80,
          damage: 10,
          cooldownTicks: 25,
          reach: 35,
          aggroRadius: 200,
          speed: 60,
          xp: 50,
          modifiers: ['fire_enchanted'],
        },
        x: 210,
        y: 200,
        hp: 10,
        cooldown: 0,
        state: 'attack',
        facing: 0,
        hitFlash: 0,
        corpseTicks: 0,
      }
      ;(feBoss as any).umods = [MON_UMOD.FIRE]
      world.monsters.push(feBoss)
      const hpBefore = world.player.hp
      damageMonster(world, feBoss.index, 50, world.player)
      expect(feBoss.state).toBe('dead')
      expect(world.player.hp).toBeLessThan(hpBefore)
      expect(triggerMonsterDeathAffixes113c(world, feBoss, world.player).length).toBeGreaterThanOrEqual(1)

      // Partial monster stub without monster.stats
      const partialStub = {
        id: 'scarab1',
        x: 205,
        y: 205,
        hp: 0,
        maxHp: 120,
        level: 15,
        umods: [MON_UMOD.COLD, MON_UMOD.LIGHTNING],
      } as unknown as Monster
      const stubEvents = MonsterAI.triggerMonsterDeathAffixes113c({ events: [] } as any, partialStub, world.player)
      expect(stubEvents.some((e) => e.missileType === 'frostnova')).toBe(true)
      expect(stubEvents.some((e) => e.missileType === 'chargedbolt')).toBe(true)

      // 5. Mercenary 25Hz AI
      const merc = {
        id: 'merc_1',
        act: 2 as const,
        x: 220,
        y: 220,
        hp: 300,
        maxHp: 300,
        level: 25,
        damage: 30,
        cooldown: 0,
        cooldownTicks: 15,
        reach: 45,
        speed: 120,
        alive: true,
      }
      tickMercenaryAi25Hz(world, merc, world.player, terrain, rng)
      expect(merc.cooldown).toBeGreaterThan(0)
    })

    it('retargets living party members when a closer player is dead (alive === false or hp <= 0)', () => {
      const world = createWorld(100, 100, 300, 100, 'bar')
      const terrain = { overlap: () => 0 }
      const deadClosestPlayer = createPlayer(110, 100, 0, 100, 'sor')
      deadClosestPlayer.alive = false
      deadClosestPlayer.hp = 0
      const livingFartherPlayer = createPlayer(180, 100, 300, 100, 'pal')
      world.players = [deadClosestPlayer, livingFartherPlayer]

      const zombie: Monster = {
        index: 0,
        stats: {
          id: 'zombie1',
          name: 'Zombie',
          hp: 50,
          damage: 8,
          cooldownTicks: 20,
          reach: 30,
          aggroRadius: 250,
          speed: 100,
          xp: 15,
        },
        x: 120,
        y: 100,
        hp: 50,
        cooldown: 0,
        state: 'idle',
        facing: 0,
        hitFlash: 0,
        corpseTicks: 0,
      }
      world.monsters = [zombie]
      tickMonsters(world, terrain)
      // Zombie at x=120 must chase livingFartherPlayer at x=180 (moving right, x > 120), NOT deadClosestPlayer at x=110
      expect(zombie.x).toBeGreaterThan(120)
    })

    it('streams active rooms across multiple distant players simultaneously and supports [x, y] tuple coordinates', () => {
      const world = createWorld(100, 100)
      const terrain = { overlap: () => 0 }
      const streamer = new RoomStreamer(
        world,
        terrain,
        [
          {
            id: 'room_west',
            minX: 0,
            minY: 0,
            maxX: 200,
            maxY: 200,
            packs: [],
          },
          {
            id: 'room_east',
            minX: 5000,
            minY: 5000,
            maxX: 5200,
            maxY: 5200,
            packs: [],
          },
        ],
        { activationRadius: 500, deactivationRadius: 800 },
      )
      const resMulti = streamer.updateForPlayers([
        { x: 100, y: 100 },
        [5100, 5100],
      ])
      expect(resMulti.activeRoomIds).toEqual(['room_west', 'room_east'])
      expect(resMulti.populatedRooms.length).toBe(2)

      // When player 2 leaves room_east beyond deactivationRadius, only room_west remains active
      const resAfterMove = streamActiveRooms113c(streamer, [
        [100, 100],
        [200, 200],
      ])
      expect(resAfterMove.activeRoomIds).toEqual(['room_west'])
    })

    it('resolves and executes 1.13c monster drops (including 1-arg executeDropPipeline and itemLevel alias), Charsi imbue, and worldToCell', () => {
      const dropTables = getEmbeddedDropTables()
      const spy = vi.spyOn(commonDropTables, 'executeDropPipeline')

      const monster: Monster = {
        index: 7,
        stats: {
          id: 'fallen1',
          name: 'Fallen',
          hp: 20,
          damage: 3,
          cooldownTicks: 20,
          reach: 35,
          aggroRadius: 200,
          speed: 80,
          xp: 10,
          level: 5,
          rank: 'normal',
        },
        x: 320,
        y: 160,
        hp: 0,
        cooldown: 0,
        state: 'dead',
        facing: 0,
        hitFlash: 0,
        corpseTicks: 10,
        dwInitSeed: 0x13572468,
        animMode: 'dt',
        deathTicks: 2,
      }

      const killEvent = {
        kind: 'kill' as const,
        x: 320,
        y: 160,
        subjectId: 'fallen1',
        monsterIndex: 7,
        monsterLevel: 5,
        monsterRank: 'normal' as const,
      }

      const pending = resolveMonsterDropPending113c(monster, killEvent, {
        dropTables,
        difficulty: 'normal',
      })
      expect(pending).not.toBeNull()
      expect(pending!.tcName.length).toBeGreaterThan(0)

      const dropped = executePendingMonsterDrop113c(dropTables, pending!, 'normal')
      expect(Array.isArray(dropped)).toBe(true)
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()

      // 1-arg executeDropPipeline with mlvl/seed aliases and itemLevel populated
      const oneArgDrops = executeDropPipeline({
        tcName: 'Act 1 Equip A',
        mlvl: 12,
        seed: 0x12345678,
      })
      expect(oneArgDrops.length).toBeGreaterThan(0)
      expect(oneArgDrops[0]!.ilvl).toBe(12)
      expect(oneArgDrops[0]!.itemLevel).toBe(12)

      // Death-gated drop queue & countdown
      queueMonsterDeathDrop113c(monster, killEvent, { dropTables, difficulty: 'normal' })
      expect(monster.dropRolled).toBeUndefined()
      expect(tickPendingMonsterDrops113c([monster], dropTables, 'normal').length).toBe(0)
      expect(tickPendingMonsterDrops113c([monster], dropTables, 'normal').length).toBe(1)
      expect(monster.dropRolled).toBe(true)

      // Charsi Imbue
      expect(computeCharsiImbueIlvl(20)).toBe(24)
      expect(isEligibleForCharsiImbue113c('cap', dropTables)).toBe(true)
      const imbued = imbueItemCharsi('cap', 20, { dropTables, rng: new D2Rng(0x424242) })
      expect(imbued).not.toBeNull()
      expect(imbued!.quality).toBe('rare')

      // worldToCell
      const cell = worldToCell({ originX: 0, originY: 0 }, 800, 400)
      expect(cell.cellX).toBe(10)
      expect(cell.cellY).toBe(0)
    })
  })

  describe('Part D: Lockstep State Hash on CombatWorld & WorldArena, unsummonOwnPetAt & Druid Overlays (Feature F10)', () => {
    it('computes deterministic lockstep hash across CombatWorld, WorldArena, and GameInstance shapes (invariant to Map insertion order)', () => {
      const world1 = createWorld(150, 250)
      const world2 = createWorld(150, 250)
      expect(computeLockstepHash(world1)).toBe(computeLockstepHash(world2))

      world2.player.x = 180
      expect(computeLockstepHash(world1)).not.toBe(computeLockstepHash(world2))

      // Map insertion-order invariance on GameInstance players and monsters Maps
      const instA = {
        frame: 50,
        players: new Map([
          [1, { id: 1, x: 100, y: 200, hp: 300, level: 10 }],
          [2, { id: 2, x: 400, y: 500, hp: 250, level: 12 }],
        ]),
        monsters: new Map([
          [10, { id: 10, x: 150, y: 250, hp: 80, mode: 1 }],
          [20, { id: 20, x: 350, y: 450, hp: 120, mode: 2 }],
        ]),
      }
      const instB = {
        frame: 50,
        players: new Map([
          [2, { id: 2, x: 400, y: 500, hp: 250, level: 12 }],
          [1, { id: 1, x: 100, y: 200, hp: 300, level: 10 }],
        ]),
        monsters: new Map([
          [20, { id: 20, x: 350, y: 450, hp: 120, mode: 2 }],
          [10, { id: 10, x: 150, y: 250, hp: 80, mode: 1 }],
        ]),
      }
      expect(hashWorldState(instA)).toBe(hashWorldState(instB))

      // LockstepSession default constructor + recordFrame + verifyPeerHash
      const lockstep = new LockstepSession()
      lockstep.recordFrame(10, 0xabcdef01)
      expect(lockstep.verifyPeerHash(10, 0xabcdef01)).toBe(true)
      expect(lockstep.verifyPeerHash(1, 10, 0xabcdef01)).toBe(true)
      expect(lockstep.verifyPeerHash(10, 0xdeadbeef)).toBe(false)
      expect(lockstep.desyncReport).not.toBeNull()

      // WorldArena-like source
      const arena1 = {
        tickCount: 12,
        player: {
          x: 300,
          y: 400,
          statList: {
            getHp: () => 250,
            getHp256: () => 250 * 256,
            getAccruedStat: () => 18,
          },
        },
        targets: [
          {
            id: 'mon_1',
            x: 340,
            y: 410,
            statList: {
              getHp: () => 90,
              getHp256: () => 90 * 256,
            },
            stateBus: {
              getActiveStateNames: () => ['chill'],
            },
          },
        ],
      }
      const arena2 = {
        ...arena1,
        targets: [
          {
            ...arena1.targets[0]!,
            statList: {
              getHp: () => 45,
              getHp256: () => 45 * 256,
            },
          },
        ],
      }
      expect(computeLockstepHash(arena1)).not.toBe(computeLockstepHash(arena2))
      expect(computeLockstepHash(arena1, 99)).not.toBe(computeLockstepHash(arena1, 12))
    })

    it('relocates unsummonOwnPetAt (including strict owner verification on shared arena.pets), applyEnchantBuff, canCastEnchantOn, and DRUID_TRANSFORM_CLT_OVERLAYS_113C', () => {
      expect(UNSUMMON_PICK_RADIUS).toBe(80)
      const playerWithPets = {
        summons: [
          { uid: 'p1', petType: 'skeleton', x: 100, y: 100, alive: true },
          { uid: 'p2', petType: 'hydra', x: 100, y: 100, alive: true }, // hydra is not unsummonable
        ],
      }
      const removed = unsummonOwnPetAt(playerWithPets, 105, 102)
      expect(removed?.uid).toBe('p1')
      expect(playerWithPets.summons.length).toBe(1)

      // Shared arena.pets pool: unsummonOwnPetAt(arena, 'player-1', ...) must reject unowned or other-player pets
      const sharedArena = {
        pets: [
          { id: 1, petType: 'skeleton', x: 100, y: 100, alive: true }, // no ownerId
          { id: 2, petType: 'skeleton', x: 100, y: 100, alive: true, ownerId: 'player-2' },
          { id: 3, petType: 'golem', x: 100, y: 100, alive: true, ownerId: 'player-1' },
        ],
      }
      expect(unsummonOwnPetAt(sharedArena, 'player-3', 100, 100)).toBeNull()
      const ownRemoved = unsummonOwnPetAt(sharedArena, 'player-1', 100, 100)
      expect(ownRemoved?.id).toBe(3)
      expect(sharedArena.pets.length).toBe(2)

      const p = createPlayer(100, 100)
      applyEnchantBuff(p, 5)
      expect(p.enchantTicks).toBeGreaterThan(0)
      expect(canCastEnchantOn('ally')).toBe(true)
      expect(canCastEnchantOn('enemy')).toBe(false)

      expect(DRUID_TRANSFORM_CLT_OVERLAYS_113C[223]).toEqual({ into: 'wolf_into', undo: 'wolf_undo' })
      expect(DRUID_TRANSFORM_CLT_OVERLAYS_113C[228]).toEqual({ into: 'bear_into', undo: 'bear_undo' })
      expect(DRUID_TRANSFORM_CLT_OVERLAYS_113C.werewolf).toBe(423)
      expect(DRUID_TRANSFORM_CLT_OVERLAYS_113C.werebear).toBe(424)
    })
  })
})
