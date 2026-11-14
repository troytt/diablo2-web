import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import * as Netproto from '../../src/netproto/index.ts'
import * as Server from '../../src/server/index.ts'

describe('Wave 1 P0 Network & Binary Protocol Parity (#1777..#1783)', () => {
  describe('#1777: Native D2GS 0xAF compression greeting, 0x68/0x6B logon sequence & D2Net Huffman framing', () => {
    it('completes authentic 1.13c [0xAF, 0x01] -> 0x68 -> compressed [0x01, 0x02] -> 0x6B -> compressed world load + 0x04 with pure D2gsSession', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x17770001,
        difficulty: 1,
        act: 0,
        areaId: 1,
      })

      const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
      const wireTap = new Netproto.InMemoryPacketTap()

      // Tap raw server->client wire chunks by wrapping clientStream before D2gsSession attaches
      const rawS2cChunks: Uint8Array[] = []
      const tappedClientStream: Netproto.ByteStream = {
        label: clientStream.label,
        write(chunk: Uint8Array): void {
          wireTap.record({
            t: 0,
            conn: 'game',
            dir: 'c2s',
            raw: new Uint8Array(chunk),
            isRawStreamChunk: true,
          })
          clientStream.write(chunk)
        },
        onData(cb: (chunk: Uint8Array) => void): () => void {
          return clientStream.onData((chunk) => {
            rawS2cChunks.push(new Uint8Array(chunk))
            wireTap.record({
              t: 0,
              conn: 'game',
              dir: 's2c',
              raw: new Uint8Array(chunk),
              isRawStreamChunk: true,
            })
            cb(chunk)
          })
        },
        onClose(cb: (reason: Netproto.CloseReason) => void): () => void {
          return clientStream.onClose(cb)
        },
        close(reason?: Netproto.CloseReason): void {
          clientStream.close(reason)
        },
      }

      const roomSession = host.attachClient(serverStream, {
        charName: 'PureD2gsHero',
        classId: 1,
        protocol: 'd2gs',
        x: 100,
        y: 100,
      })

      const d2gsSession = new Netproto.D2gsSession({
        stream: tappedClientStream,
        logon: {
          gameHash: 0xdeadbeef,
          gameToken: 0x1234,
          charClass: 1,
          versionByte: 0x0d,
          charName: 'PureD2gsHero',
        },
      })

      const receivedPackets: Uint8Array[] = []
      d2gsSession.onPacket((pkt) => receivedPackets.push(new Uint8Array(pkt)))

      expect(d2gsSession.state).toBe('entering')
      expect(roomSession.handshakeState).toBe('ingame')

      // First S2C wire chunk MUST be uncompressed [0xAF, 0x01]
      expect(rawS2cChunks.length).toBeGreaterThanOrEqual(2)
      expect(Array.from(rawS2cChunks[0]!)).toEqual([0xaf, 0x01])

      // Subsequent S2C wire chunks MUST be Huffman-compressed frames within D2Net's <= 0x0FFF block ceiling
      for (let i = 1; i < rawS2cChunks.length; i++) {
        const chunk = rawS2cChunks[i]!
        expect(chunk.byteLength).toBeLessThanOrEqual(0x0fff)
        const hdr = Netproto.parseD2gsBlockHeader(chunk)
        expect(hdr).not.toBeNull()
        expect(hdr!.totalFrameSize).toBeLessThanOrEqual(chunk.byteLength)
      }

      // Step room frame to deliver initial world load and verify packet order
      host.stepFrame()
      expect(d2gsSession.state).toBe('ingame')

      const opcodes = receivedPackets.map((p) => p[0]!)
      expect(opcodes[0]).toBe(0xaf) // CompressionInfo greeting first in causal wire order
      expect(opcodes[1]).toBe(0x01) // GameFlags
      expect(opcodes[2]).toBe(0x02) // GameLogonSuccess
      expect(opcodes).toContain(0x03) // LoadAct
      expect(opcodes).toContain(0x29) // QuestLog
      expect(opcodes).toContain(0x59) // AssignPlayer
      expect(opcodes[opcodes.length - 1]).toBe(0x04) // LoadDone terminates world load

      // Verify difficulty=1 propagated into S2C 0x01 GameFlags
      const gameFlagsPkt = receivedPackets.find((p) => p[0] === 0x01)!
      expect(gameFlagsPkt[1]).toBe(1)

      // Deterministic .d2cap JSONL round-trip replay through fresh D2gsS2cFramer
      const jsonl = wireTap.toD2CapJsonl({
        format: 'd2cap-v1',
        createdAt: '2026-01-01T00:00:00.000Z',
        server: 'local-room-host',
        scenario: 'issue-1777',
      })
      const parsed = Netproto.parseD2CapJsonl(jsonl)
      const replayFramer = new Netproto.D2gsS2cFramer()
      const replayedOpcodes: number[] = []
      for (const rec of parsed.records) {
        if (rec.conn === 'game' && rec.dir === 's2c') {
          for (const pkt of replayFramer.push(Netproto.hexToBytes(rec.hex))) {
            replayedOpcodes.push(pkt.bytes[0]!)
          }
        }
      }
      expect(replayedOpcodes).toEqual(opcodes)

      d2gsSession.leaveAndClose()
      host.close()
    })

    it('splits large >4KB S2C packet bursts into valid <= 0x0FFF D2Net Huffman blocks without truncation', () => {
      const chatPackets: Uint8Array[] = []
      for (let i = 0; i < 80; i++) {
        const pkts = Netproto.serverEventToS2cPackets({
          type: 'Chat',
          kind: 'say',
          from: `Speaker${i}`,
          text: `Long repetitive message payload #${i} - ${'xyz123987!@#'.repeat(6)}`,
        })
        chatPackets.push(...pkts)
      }

      const frames = Netproto.encodeD2gsCompressedPackets(chatPackets)
      expect(frames.length).toBeGreaterThan(1)
      for (const frame of frames) {
        expect(frame.byteLength).toBeLessThanOrEqual(0x0fff)
      }

      const s2cFramer = new Netproto.D2gsS2cFramer()
      // Trigger compressed mode via [0xAF, 0x01]
      expect(s2cFramer.push(new Uint8Array([0xaf, 0x01]))).toHaveLength(1)

      const decoded: Uint8Array[] = []
      for (const frame of frames) {
        decoded.push(...s2cFramer.push(frame).map((f) => f.bytes))
      }
      expect(decoded).toHaveLength(chatPackets.length)
      for (let i = 0; i < chatPackets.length; i++) {
        expect(decoded[i]).toEqual(chatPackets[i])
      }
    })
  })

  describe('#1778: Exhaustive serverEventToS2cPackets coverage & 1.13c monster 0x67/0x68/0x6D movement packets', () => {
    it('encodes all ServerEvent variants with zero bogus [0x04] LoadDone fallbacks and round-trips cleanly', () => {
      const sampleItem: Partial<Netproto.ItemData> = {
        id: 701,
        itemId: 701,
        code: 'rin',
        location: 0,
        container: 'inventory',
        x: 2,
        y: 1,
        storePage: 1,
        compact: false,
        identified: true,
        ilvl: 20,
        quality: 4,
        magicPrefixId: 10,
        magicSuffixId: 12,
        stats: [{ statId: 0, param: 0, value: 5 }],
      }

      const allVariants: readonly Netproto.ServerEvent[] = [
        { type: 'GameLoading' },
        { type: 'UnloadAct' },
        { type: 'GameLogonAck', playerUnitId: 1, mapSeed: 0x11223344, difficulty: 1 },
        { type: 'PlayerAssign', unitId: 1, classId: 1, charName: 'Sorc', x: 100, y: 100 },
        { type: 'ProtocolSync', opcode: 0x16, byteLength: 13, entries: [{ unitType: 'monster', id: 10, x: 110, y: 112 }] },
        { type: 'ProtocolSync', opcode: 0x57, byteLength: 14, monsterEnchant: { monsterId: 10, unitType: 1, nameSeed: 7, bossMods: [5, 8, 0], champion: false } },
        { type: 'ProtocolSync', opcode: 0x5f, byteLength: 5, playerData2C: 42 },
        { type: 'ProtocolSync', opcode: 0x92, byteLength: 6, unit: { rawUnitType: 2, id: 20 } },
        { type: 'ProtocolSync', opcode: 0x93, byteLength: 8, playerSkillUpdate: { playerId: 1, value: 1, skillGroup: 0, mode: 1 } },
        { type: 'ProtocolSync', opcode: 0x98, byteLength: 7, evilHut: { monsterId: 10, value: 3 } },
        { type: 'MonsterSpecial', classId: 243 },
        { type: 'CreateMissile', missileClassId: 59, at: { x: 100, y: 105 }, target: { x: 120, y: 125 }, level: 3 },
        { type: 'GameFlags', difficulty: 2, arenaFlags: 0, expansion: true, hardcore: false, ladder: true },
        { type: 'LoadAct', act: 1, mapSeed: 0x11223344, areaId: 40, objectSeed: 0 },
        { type: 'EnvironmentSync', cycleIndex: 1, ticks: 100, eclipse: false },
        { type: 'LoadComplete' },
        { type: 'UnloadComplete' },
        { type: 'GameLogout' },
        { type: 'GameLogout', reason: 1 },
        { type: 'CanGoToAct', act: 1 },
        { type: 'OpenUi', unitId: 55, uiId: 1 },
        { type: 'RoomReveal', tileX: 80, tileY: 84, areaId: 1 },
        { type: 'RoomHide', tileX: 80, tileY: 84, areaId: 1 },
        { type: 'UnitAssign', unit: { unitType: 'player', id: 1, classId: 1, name: 'Sorc', x: 100, y: 100 } },
        { type: 'UnitAssign', unit: { unitType: 'monster', id: 10, classId: 18, x: 110, y: 112, mode: 1, lifePct: 128 } },
        { type: 'UnitAssign', unit: { unitType: 'object', id: 20, classId: 119, x: 102, y: 104, mode: 1 } },
        { type: 'UnitAssign', unit: { unitType: 'tile', id: 30, classId: 4, x: 130, y: 132 } },
        { type: 'UnitRemove', unitType: 'monster', id: 10 },
        { type: 'UnitMove', unitType: 'player', id: 1, mode: 'run', from: { x: 100, y: 100 }, to: { x: 110, y: 112 } },
        { type: 'UnitMove', unitType: 'monster', id: 10, mode: 'walk', from: { x: 110, y: 112 }, to: { x: 116, y: 118 } },
        { type: 'UnitMove', unitType: 'monster', id: 10, mode: 'run', from: { x: 110, y: 112 }, to: { x: 100, y: 100 }, target: { unitType: 'player', id: 1 } },
        { type: 'UnitMove', unitType: 'monster', id: 10, mode: 'stop', to: { x: 116, y: 118 } },
        { type: 'UnitReassign', unitType: 'player', id: 1, at: { x: 100, y: 100 }, snap: true },
        { type: 'UnitStatUpdate', unitType: 'player', unitId: 1, statId: 14, value: 5000 },
        { type: 'UnitState', unitType: 'player', unitId: 1, state: 32, active: true },
        { type: 'UnitState', unitType: 'player', unitId: 1, state: 32, active: false },
        { type: 'SkillUpdate', unitId: 1, skillId: 36, level: 5, bonus: 1 },
        { type: 'UnitMode', unitType: 'monster', id: 10, mode: 12, at: { x: 116, y: 118 }, lifePct: 0 },
        { type: 'UnitMode', unitType: 'object', id: 20, mode: 2, eventCode: 3, eventFlag: 0 },
        { type: 'UnitOverlay', rawUnitType: 0, id: 1, overlayIndex: 42 },
        { type: 'UnitHoverTextClear', rawUnitType: 1, id: 10 },
        { type: 'CorpseAssign', assign: 1, ownerId: 1, corpseId: 999 },
        { type: 'SkillCast', caster: { unitType: 'player', id: 1 }, skill: 36, level: 5, target: { unitType: 'monster', id: 10 } },
        { type: 'SkillCast', caster: { unitType: 'player', id: 1 }, skill: 54, level: 1, target: { x: 120, y: 125 } },
        { type: 'SkillCast', caster: { unitType: 'player', id: 1 }, skill: 56, level: 4, target: { x: 120, y: 125 }, triggered: true },
        { type: 'UnitSkillEvent', flag: 1, skill: 98, level: 3, caster: { rawUnitType: 0, id: 1 }, target: { rawUnitType: 0, id: 1 }, x: 100, y: 100 },
        { type: 'StatSet', stat: 12, value: 15 },
        { type: 'StatSet', unit: { unitType: 'item', id: 701 }, stat: 70, value: 14 },
        { type: 'StatSet', unit: { unitType: 'monster', id: 10 }, stat: 6, value: 25600 },
        { type: 'LifeMana', life: 120, mana: 80, stamina: 100, at: { x: 100, y: 100 }, vx: 0, vy: 0 },
        { type: 'LifeMana', life: -1, mana: -1, stamina: 100, at: { x: 102, y: 104 }, vx: 0, vy: 0 },
        { type: 'Experience', value: 1500, isDelta: true },
        { type: 'StateSet', unit: { unitType: 'player', id: 1 }, state: 32, stats: [], complete: true },
        { type: 'StateEnd', unit: { unitType: 'player', id: 1 }, state: 32 },
        { type: 'StateSkillEffect', unit: { unitType: 'player', id: 1 }, skillId: 54 },
        { type: 'ItemEvent', action: 0x04, itemId: 701, container: 'inventory', x: 2, y: 1, item: sampleItem },
        { type: 'WeaponSwitch' },
        { type: 'CursorClear', unitType: 'player', id: 1 },
        { type: 'UseSpecialItem', unitType: 'player', id: 1 },
        { type: 'ItemFlagUpdate', ownerType: 0, ownerId: 1, itemId: 701, flag: 0x100, enabled: 1 },
        { type: 'ItemRelate', opcode: 0x47, param: 0, itemId: 701, value: 1 },
        { type: 'SkillList', unitId: 1, skills: [{ skillId: 36, level: 5 }] },
        { type: 'ActiveSkill', unitId: 1, hand: 'right', skill: 36, itemId: 0xffffffff },
        { type: 'Npc', kind: 'menu', npcId: 55, act: 0, npcFlags: [0, 0, 0, 0, 0, 0, 0, 0] },
        { type: 'Npc', kind: 'heal', npcId: 55, unitType: 1, result: 128 },
        { type: 'Npc', kind: 'wantsInteract', npcId: 55, unitType: 1 },
        { type: 'NpcInfo', unitType: 1, unitId: 55, messages: [{ menu: 0, stringId: 101 }] },
        { type: 'NpcTransaction', flag: 1, result: 0, itemId: 701, gold: 1200 },
        { type: 'WaypointMenu', unitId: 20, open: [0, 1, 9] },
        { type: 'QuestState', kind: 'log', quests: new Uint16Array(48) },
        { type: 'Party', source: 0x5b, kind: 'roster', action: 'join', playerId: 1, charClass: 1, charName: 'Sorc', charLevel: 15, partyId: 0xffff },
        { type: 'Trade', action: 5, gold: 2500 },
        { type: 'Chat', kind: 'say', from: 'Sorc', text: 'Hello sanctuary' },
        { type: 'Chat', kind: 'event', eventType: 4, subType: 0, name1: 'Sorc', text: '' },
        { type: 'PlaySound', unit: { unitType: 'player', id: 1 }, sound: 19 },
        { type: 'Merc', kind: 'assign', ownerId: 1, mercId: 901, classId: 271, nameId: 1 },
        { type: 'Merc', kind: 'hireList' },
        { type: 'Merc', kind: 'stat', mercId: 901, stat: 6, value: 120 },
        { type: 'Merc', kind: 'exp', mercId: 901, stat: 13, value: 50 },
        { type: 'Portal', portalId: 21, ownerId: 1, ownerName: 'Sorc', areaId: 1, destAreaId: 2, localId: 21, remoteId: 22 },
        { type: 'Pong', rttMs: 12, tickCount: 77 },
        { type: 'Warden', payload: new Uint8Array([0x01, 0x02, 0x03]) },
        { type: 'SaveChunk', isFirst: true, totalSize: 4, chunk: new Uint8Array([1, 2, 3, 4]) },
        { type: 'Opaque', proto: 'd2gs', id: 0x13, raw: new Uint8Array([0x13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) },
      ]

      const tables = Netproto.getDefault113cItemDataTables()
      for (const ev of allVariants) {
        const packets = Netproto.serverEventToS2cPackets(ev)
        expect(packets.length).toBeGreaterThan(0)
        for (const pkt of packets) {
          if (ev.type !== 'LoadComplete') {
            expect(pkt[0]).not.toBe(0x04)
          } else {
            expect(pkt[0]).toBe(0x04)
          }
          const decoded = Netproto.decodeD2gsS2cPacket(pkt, { tables, encoding: 'gbk', rttMs: 0 })
          expect(decoded).toBeDefined()
        }
      }

      // Specifically verify 1.13c monster movement opcodes 0x67, 0x68, 0x6D vs player 0x0F
      const monWalk = Netproto.serverEventToS2cPackets({
        type: 'UnitMove',
        unitType: 'monster',
        id: 42,
        mode: 'walk',
        from: { x: 100, y: 102 },
        to: { x: 108, y: 110 },
      })
      expect(monWalk[0]![0]).toBe(0x67)
      expect(monWalk[0]!.byteLength).toBe(16)
      expect(Netproto.decodeD2gsS2cPacket(monWalk[0]!)).toMatchObject({
        type: 'UnitMove',
        unitType: 1,
        id: 42,
      })

      const monChase = Netproto.serverEventToS2cPackets({
        type: 'UnitMove',
        unitType: 'monster',
        id: 42,
        mode: 'run',
        from: { x: 100, y: 102 },
        to: { x: 100, y: 100 },
        target: { unitType: 'player', id: 1 },
      })
      expect(monChase[0]![0]).toBe(0x68)
      expect(monChase[0]!.byteLength).toBe(21)
      expect(Netproto.decodeD2gsS2cPacket(monChase[0]!)).toMatchObject({
        type: 'UnitMove',
        unitType: 1,
        id: 42,
        target: { unitType: 0, id: 1 },
      })

      const monStop = Netproto.serverEventToS2cPackets({
        type: 'UnitMove',
        unitType: 'monster',
        id: 42,
        mode: 'stop',
        to: { x: 108, y: 110 },
      })
      expect(monStop[0]![0]).toBe(0x6d)
      expect(monStop[0]!.byteLength).toBe(10)
    })
  })

  describe('#1779: C2S 0x38 NpcEntityAction (trade/gamble/hire/artisan) & complete C2S opcode sweep', () => {
    it('losslessly decodes 0x34..0x38, 0x4F, 0x61, 0x62 and full C2S command set in decodeD2gsC2sPacketToCommand', () => {
      const roundtripCases: ReadonlyArray<{
        readonly cmd: Netproto.ClientCommand
        readonly expectedType: Netproto.ClientCommand['type']
        readonly check?: (decoded: Netproto.ClientCommand) => void
      }> = [
        {
          cmd: { type: 'SkillAt', hand: 'left', at: { x: 111, y: 222 }, hold: true },
          expectedType: 'SkillAt',
          check: (d) => expect(d).toMatchObject({ hand: 'left', at: { x: 111, y: 222 }, hold: true }),
        },
        {
          cmd: { type: 'SkillOn', hand: 'right', target: { unitType: 'monster', id: 77 }, shift: true, hold: false },
          expectedType: 'SkillOn',
          check: (d) => expect(d).toMatchObject({ hand: 'right', shift: true, hold: false }),
        },
        {
          cmd: { type: 'SwapContainerItem', cursorItemId: 10, targetItemId: 20, x: 3, y: 2 },
          expectedType: 'SwapContainerItem',
          check: (d) => expect(d).toMatchObject({ cursorItemId: 10, targetItemId: 20, x: 3, y: 2 }),
        },
        {
          cmd: { type: 'BeltSwap', cursorItemId: 11, beltItemId: 22 },
          expectedType: 'BeltSwap',
        },
        {
          cmd: { type: 'IdentifyItem', itemId: 101, scrollId: 202 },
          expectedType: 'IdentifyItem',
          check: (d) => expect(d).toMatchObject({ itemId: 101, scrollId: 202 }),
        },
        {
          cmd: { type: 'SocketItem', itemId: 301, targetItemId: 302 },
          expectedType: 'SocketItem',
        },
        {
          cmd: { type: 'ScrollToBook', scrollId: 401, bookId: 402 },
          expectedType: 'ScrollToBook',
          check: (d) => expect(d).toMatchObject({ scrollId: 401, bookId: 402 }),
        },
        {
          cmd: { type: 'ItemToCube', itemId: 501, cubeId: 502 },
          expectedType: 'ItemToCube',
        },
        {
          cmd: { type: 'NpcBuy', npcId: 12, itemId: 88, itemMode: 4, gamble: true, shiftFill: true, cost: 50000 },
          expectedType: 'NpcBuy',
          check: (d) => expect(d).toMatchObject({ npcId: 12, itemId: 88, gamble: true, shiftFill: true }),
        },
        {
          cmd: { type: 'NpcIdentifyAll', npcId: 50 },
          expectedType: 'NpcIdentifyAll',
        },
        {
          cmd: { type: 'NpcRepairItem', npcId: 50, itemId: 90, itemMode: 1, durability: 12 },
          expectedType: 'NpcRepairItem',
        },
        {
          cmd: { type: 'NpcRepairAll', npcId: 50 },
          expectedType: 'NpcRepairAll',
        },
        {
          cmd: { type: 'HireMerc', npcId: 51, mercId: 901 },
          expectedType: 'HireMerc',
        },
        {
          cmd: { type: 'NpcIdentifyGamble', itemId: 601 },
          expectedType: 'NpcIdentifyGamble',
        },
        {
          cmd: { type: 'NpcEntityAction', action: 2, npcId: 52, complement: 0 },
          expectedType: 'NpcEntityAction',
          check: (d) => expect(d).toMatchObject({ type: 'NpcEntityAction', action: 2, npcId: 52, complement: 0 }),
        },
        {
          cmd: { type: 'AllocateStat', statId: 0, amount: 5 },
          expectedType: 'AllocateStat',
          check: (d) => expect(d).toMatchObject({ statId: 0, amount: 5 }),
        },
        {
          cmd: { type: 'ClickButton', buttonId: 0x14, amount: 0x00024680 },
          expectedType: 'ClickButton',
          check: (d) => expect(d).toMatchObject({ buttonId: 0x14, amount: 0x00024680 }),
        },
        {
          cmd: { type: 'DropGold', unitId: 1, amount: 1234 },
          expectedType: 'DropGold',
        },
        {
          cmd: { type: 'AssignSkillHotkey', slot: 3, hand: 'left', skill: 54 },
          expectedType: 'AssignSkillHotkey',
          check: (d) => expect(d).toMatchObject({ slot: 3, hand: 'left', skill: 54 }),
        },
        {
          cmd: { type: 'RunToggle', run: false },
          expectedType: 'RunToggle',
          check: (d) => expect(d).toMatchObject({ run: false }),
        },
        {
          cmd: { type: 'MercItem', slot: 4 },
          expectedType: 'MercItem',
        },
        {
          cmd: { type: 'NpcResurrectMerc', npcId: 51 },
          expectedType: 'NpcResurrectMerc',
        },
        {
          cmd: { type: 'ItemToBelt', itemId: 777 },
          expectedType: 'ItemToBelt',
        },
      ]

      for (const tc of roundtripCases) {
        const encoded = Netproto.encodeD2gsClientCommand(tc.cmd)
        expect(encoded).toHaveLength(1)
        const decoded = Server.decodeD2gsC2sPacketToCommand(encoded[0]!)
        expect(decoded).not.toBeNull()
        expect(decoded!.type).toBe(tc.expectedType)
        tc.check?.(decoded!)
      }
    })

    it('opens Gamble mystery stock on C2S 0x38 action=2 vs normal Trade stock on action=1 over binary D2GS, plus 0x4F gold deposit/withdraw', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x17790002,
        areaId: 1,
      })
      const game = host.getGameInstance()

      const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
      const roomSess = host.attachClient(serverStream, {
        charName: 'GambleHero',
        classId: 4,
        level: 30,
        gold: 150_000,
        x: 100,
        y: 100,
        protocol: 'd2gs',
      })
      const gheedId = game.spawnMonster({
        hcIdx: 147, // Gheed (Act 1 gamble + trade vendor)
        areaId: 1,
        x: 102,
        y: 100,
        hp: 100,
        maxHp: 100,
        isNpc: true,
        isVendor: true,
      })

      const adapter = new Netproto.D2gsServerAdapter(clientStream)
      const world = new ClientWorld()
      const session = new OnlineSession({ world })
      session.attachGameServer(adapter)

      host.stepFrame()

      // 1. Open Gamble window via binary C2S 0x38 (action = 2)
      session.sendCommand({ type: 'NpcInit', target: { unitType: 1, id: gheedId } }, 1000)
      session.sendCommand({ type: 'NpcEntityAction', action: 2, npcId: gheedId, complement: 0 }, 1500)
      host.stepFrame()

      const gambleShopItems = Array.from(world.containers.shop.values())
      expect(gambleShopItems.length).toBeGreaterThan(0)
      expect(gambleShopItems.every((it) => it.identified === false)).toBe(true)

      // 2. Open normal Trade window via binary C2S 0x38 (action = 1)
      session.sendCommand({ type: 'NpcEntityAction', action: 1, npcId: gheedId, complement: 0 }, 2000)
      host.stepFrame()

      const tradeShopItems = Array.from(world.containers.shop.values())
      expect(tradeShopItems.length).toBeGreaterThan(0)
      expect(tradeShopItems.some((it) => it.identified === true)).toBe(true)

      // 3. Deposit & Withdraw >65535 gold via binary C2S 0x4F ClickButton (0x14 / 0x13)
      session.sendCommand({ type: 'ClickButton', buttonId: 0x14, amount: 80_000 }, 2500)
      host.stepFrame()
      expect(game.getPlayerState(roomSess.playerUnitId)!.gold).toBe(70_000)
      expect(game.getPlayerState(roomSess.playerUnitId)!.goldBank).toBe(80_000)

      session.sendCommand({ type: 'ClickButton', buttonId: 0x13, amount: 30_000 }, 3000)
      host.stepFrame()
      expect(game.getPlayerState(roomSess.playerUnitId)!.gold).toBe(100_000)
      expect(game.getPlayerState(roomSess.playerUnitId)!.goldBank).toBe(50_000)

      session.destroy()
      host.close()
    })
  })

  describe('#1780: C2S 0x1F SwapContainerItem across ts & d2gs (1x1, 2x2, 2x4 & >=2 overlap rejection)', () => {
    for (const protocol of ['ts', 'd2gs'] as const) {
      it(`atomically swaps 1x1, 2x2, and 2x4 items in inventory & stash and rejects >=2 overlapping items (${protocol})`, () => {
        const host = new Server.MultiClientRoomHost({
          policy: Server.CLOSED_REALM_POLICY,
          mapSeed: 0x17800000 + (protocol === 'd2gs' ? 1 : 0),
          areaId: 1,
        })
        const game = host.getGameInstance()
        const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
        host.attachClient(serverStream, {
          charName: 'SwapHero',
          classId: 0,
          level: 20,
          x: 100,
          y: 100,
          protocol,
        })
        const adapter =
          protocol === 'd2gs'
            ? new Netproto.D2gsServerAdapter(clientStream)
            : new Netproto.TsServerAdapter(clientStream)
        const world = new ClientWorld()
        const session = new OnlineSession({ world })
        session.attachGameServer(adapter)
        host.stepFrame()

        // Spawn Ring A (1x1), Ring B (1x1), Buckler (2x2), Tower Shield / Ancient Armor (2x3 / 2x4: 'aar' = 2x4)
        const ringA = game.spawnGroundItem({ code: 'rin', x: 100, y: 100, areaId: 1 })
        const ringB = game.spawnGroundItem({ code: 'amu', x: 100, y: 100, areaId: 1 })
        const shield2x2 = game.spawnGroundItem({ code: 'buc', x: 100, y: 100, areaId: 1 })
        const armor2x4 = game.spawnGroundItem({ code: 'aar', x: 100, y: 100, areaId: 1 })
        host.stepFrame()

        // Place ringA at inv (0,0) and ringB at inv (1,0)
        session.sendCommand({ type: 'ItemPickup', itemId: ringA, toCursor: true })
        host.stepFrame()
        session.sendCommand({ type: 'ItemPlace', itemId: ringA, x: 0, y: 0, buffer: 0 })
        host.stepFrame()

        session.sendCommand({ type: 'ItemPickup', itemId: ringB, toCursor: true })
        host.stepFrame()
        session.sendCommand({ type: 'ItemPlace', itemId: ringB, x: 1, y: 0, buffer: 0 })
        host.stepFrame()

        // Pick up 2x2 shield onto cursor
        session.sendCommand({ type: 'ItemPickup', itemId: shield2x2, toCursor: true })
        host.stepFrame()
        expect(world.containers.cursor?.id).toBe(shield2x2)

        // REJECT case: swapping 2x2 shield at (0,0) overlaps BOTH ringA (0,0) and ringB (1,0) (>=2 items!)
        session.sendCommand({
          type: 'SwapContainerItem',
          cursorItemId: shield2x2,
          targetItemId: ringA,
          x: 0,
          y: 0,
        })
        host.stepFrame()
        expect(world.containers.cursor?.id).toBe(shield2x2)
        expect(world.containers.inventory.get(ringA)).toMatchObject({ x: 0, y: 0 })
        expect(world.containers.inventory.get(ringB)).toMatchObject({ x: 1, y: 0 })

        // Move ringB to stash (0,0) so (0,0..1,1) in inventory only has ringA
        // First swap 2x2 shield with ringB at (1,0)? At (1,0), 2x2 occupies [1..2]x[0..1], which ONLY overlaps ringB!
        session.sendCommand({
          type: 'SwapContainerItem',
          cursorItemId: shield2x2,
          targetItemId: ringB,
          x: 1,
          y: 0,
        })
        host.stepFrame()
        expect(world.containers.cursor?.id).toBe(ringB)
        expect(world.containers.inventory.get(shield2x2)).toMatchObject({ x: 1, y: 0 })

        // Place cursor ringB (1x1) into Stash (0,0) (buffer = 4)
        session.sendCommand({ type: 'ItemPlace', itemId: ringB, x: 0, y: 0, buffer: 4 })
        host.stepFrame()
        expect(world.containers.cursor).toBeNull()
        expect(world.containers.stash.get(ringB)).toMatchObject({ x: 0, y: 0 })

        // Pick up 2x4 Ancient Armor ('aar') onto cursor and swap directly with ringB in Stash at (0,0)!
        session.sendCommand({ type: 'ItemPickup', itemId: armor2x4, toCursor: true })
        host.stepFrame()
        expect(world.containers.cursor?.id).toBe(armor2x4)

        session.sendCommand({
          type: 'SwapContainerItem',
          cursorItemId: armor2x4,
          targetItemId: ringB,
          x: 0,
          y: 0,
        })
        host.stepFrame()
        expect(world.containers.cursor?.id).toBe(ringB)
        expect(world.containers.stash.get(armor2x4)).toMatchObject({ x: 0, y: 0 })

        // Swap 1x1 ringB on cursor back onto 2x4 armor in Stash at (0,0)!
        session.sendCommand({
          type: 'SwapContainerItem',
          cursorItemId: ringB,
          targetItemId: armor2x4,
          x: 0,
          y: 0,
        })
        host.stepFrame()
        expect(world.containers.cursor?.id).toBe(armor2x4)
        expect(world.containers.stash.get(ringB)).toMatchObject({ x: 0, y: 0 })

        session.destroy()
        host.close()
      })
    }
  })

  describe('#1781: C2S 0x27 IdentifyItem with loose scroll (isc) and Tome of Identify (ibk)', () => {
    for (const protocol of ['ts', 'd2gs'] as const) {
      it(`consumes isc or decrements ibk quantity, identifies target item, and rejects ibk with quantity 0 (${protocol})`, () => {
        const host = new Server.MultiClientRoomHost({
          policy: Server.CLOSED_REALM_POLICY,
          mapSeed: 0x17810000 + (protocol === 'd2gs' ? 1 : 0),
          areaId: 1,
        })
        const game = host.getGameInstance()
        const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
        host.attachClient(serverStream, {
          charName: 'IdHero',
          classId: 1,
          level: 25,
          x: 100,
          y: 100,
          protocol,
        })
        const adapter =
          protocol === 'd2gs'
            ? new Netproto.D2gsServerAdapter(clientStream)
            : new Netproto.TsServerAdapter(clientStream)
        const world = new ClientWorld()
        const session = new OnlineSession({ world })
        session.attachGameServer(adapter)
        host.stepFrame()

        const unidRing1 = game.spawnGroundItem({
          code: 'rin',
          x: 100,
          y: 100,
          areaId: 1,
          quality: 4,
          identified: false,
          stats: [{ statId: 0, value: 12 }],
        })
        const unidRing2 = game.spawnGroundItem({
          code: 'rin',
          x: 100,
          y: 100,
          areaId: 1,
          quality: 6,
          identified: false,
          stats: [{ statId: 2, value: 15 }],
        })
        const unidRing3 = game.spawnGroundItem({
          code: 'rin',
          x: 100,
          y: 100,
          areaId: 1,
          quality: 7,
          identified: false,
        })
        const scrollIsc = game.spawnGroundItem({ code: 'isc', x: 100, y: 100, areaId: 1 })
        const tomeIbk = game.spawnGroundItem({ code: 'ibk', x: 100, y: 100, areaId: 1, quantity: 1 })
        host.stepFrame()

        for (const id of [unidRing1, unidRing2, unidRing3, scrollIsc, tomeIbk]) {
          session.sendCommand({ type: 'ItemPickup', itemId: id, toCursor: false })
          host.stepFrame()
        }

        expect(world.containers.inventory.get(unidRing1)?.identified).toBe(false)
        expect(world.containers.inventory.get(unidRing2)?.identified).toBe(false)
        expect(world.containers.inventory.has(scrollIsc)).toBe(true)

        // 1. Identify unidRing1 using loose 'isc' scroll -> scroll disappears, ring1 becomes identified
        session.sendCommand({ type: 'IdentifyItem', itemId: unidRing1, scrollId: scrollIsc })
        host.stepFrame()

        expect(world.containers.inventory.has(scrollIsc)).toBe(false)
        expect(world.containers.inventory.get(unidRing1)?.identified).toBe(true)

        // 2. Identify unidRing2 using 'ibk' tome (qty 1 -> 0) -> ring2 becomes identified
        session.sendCommand({ type: 'IdentifyItem', itemId: unidRing2, scrollId: tomeIbk })
        host.stepFrame()

        expect(world.containers.inventory.get(unidRing2)?.identified).toBe(true)
        expect(world.containers.inventory.get(tomeIbk)?.quantity).toBe(0)

        // 3. Attempt to identify unidRing3 with empty 'ibk' (qty === 0) -> MUST reject!
        session.sendCommand({ type: 'IdentifyItem', itemId: unidRing3, scrollId: tomeIbk })
        host.stepFrame()

        expect(world.containers.inventory.get(unidRing3)?.identified).toBe(false)
        expect(world.containers.inventory.get(tomeIbk)?.quantity).toBe(0)

        session.destroy()
        host.close()
      })
    }
  })

  describe('#1782: C2S 0x29 ScrollToBook (tsc->tbk, isc->ibk, maxstack=20 & mismatch rejection)', () => {
    for (const protocol of ['ts', 'd2gs'] as const) {
      it(`inserts matching cursor scroll into tome (<20), clears cursor, and rejects full (20) or mismatched tomes (${protocol})`, () => {
        const host = new Server.MultiClientRoomHost({
          policy: Server.CLOSED_REALM_POLICY,
          mapSeed: 0x17820000 + (protocol === 'd2gs' ? 1 : 0),
          areaId: 1,
        })
        const game = host.getGameInstance()
        const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
        host.attachClient(serverStream, {
          charName: 'TomeHero',
          classId: 2,
          level: 15,
          x: 100,
          y: 100,
          protocol,
        })
        const adapter =
          protocol === 'd2gs'
            ? new Netproto.D2gsServerAdapter(clientStream)
            : new Netproto.TsServerAdapter(clientStream)
        const world = new ClientWorld()
        const session = new OnlineSession({ world })
        session.attachGameServer(adapter)
        host.stepFrame()

        const tomeTbk = game.spawnGroundItem({ code: 'tbk', x: 100, y: 100, areaId: 1, quantity: 19 })
        const tomeIbk = game.spawnGroundItem({ code: 'ibk', x: 100, y: 100, areaId: 1, quantity: 5 })
        const tsc1 = game.spawnGroundItem({ code: 'tsc', x: 100, y: 100, areaId: 1 })
        const tsc2 = game.spawnGroundItem({ code: 'tsc', x: 100, y: 100, areaId: 1 })
        const isc1 = game.spawnGroundItem({ code: 'isc', x: 100, y: 100, areaId: 1 })
        host.stepFrame()

        session.sendCommand({ type: 'ItemPickup', itemId: tomeTbk, toCursor: false })
        host.stepFrame()
        session.sendCommand({ type: 'ItemPickup', itemId: tomeIbk, toCursor: false })
        host.stepFrame()

        // Pick up tsc1 onto cursor
        session.sendCommand({ type: 'ItemPickup', itemId: tsc1, toCursor: true })
        host.stepFrame()
        expect(world.containers.cursor?.id).toBe(tsc1)

        // Mismatch: 'tsc' onto 'ibk' MUST be rejected without consuming cursor scroll
        session.sendCommand({ type: 'ScrollToBook', scrollId: tsc1, bookId: tomeIbk })
        host.stepFrame()
        expect(world.containers.cursor?.id).toBe(tsc1)
        expect(world.containers.inventory.get(tomeIbk)?.quantity).toBe(5)

        // Valid: 'tsc' onto 'tbk' (19 -> 20) clears cursor and increments tome to 20
        session.sendCommand({ type: 'ScrollToBook', scrollId: tsc1, bookId: tomeTbk })
        host.stepFrame()
        expect(world.containers.cursor).toBeNull()
        expect(world.containers.inventory.get(tomeTbk)?.quantity).toBe(20)

        // Cap check: 'tsc' onto full 'tbk' (20) MUST be rejected without consuming tsc2
        session.sendCommand({ type: 'ItemPickup', itemId: tsc2, toCursor: true })
        host.stepFrame()
        expect(world.containers.cursor?.id).toBe(tsc2)
        session.sendCommand({ type: 'ScrollToBook', scrollId: tsc2, bookId: tomeTbk })
        host.stepFrame()
        expect(world.containers.cursor?.id).toBe(tsc2)
        expect(world.containers.inventory.get(tomeTbk)?.quantity).toBe(20)

        // Drop tsc2 on ground so cursor is free, then insert 'isc' into 'ibk' (5 -> 6)
        session.sendCommand({ type: 'ItemDrop', itemId: tsc2 })
        host.stepFrame()
        session.sendCommand({ type: 'ItemPickup', itemId: isc1, toCursor: true })
        host.stepFrame()
        session.sendCommand({ type: 'ScrollToBook', scrollId: isc1, bookId: tomeIbk })
        host.stepFrame()
        expect(world.containers.cursor).toBeNull()
        expect(world.containers.inventory.get(tomeIbk)?.quantity).toBe(6)

        session.destroy()
        host.close()
      })
    }
  })

  describe('#1783: Default MultiClientRoomHost AOI filtering & ground item / active missile enter-AOI resync', () => {
    it('enables AOI filtering by default so Rogue Encampment players never receive Cold Plains monsters or drops', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x17830001,
        areaId: 1,
      })
      expect(host.aoiEnabled).toBe(true)
      expect(host.aoiFilter.radius).toBe(Server.DEFAULT_AOI_RADIUS_SUBTILES)

      const game = host.getGameInstance()
      const [c1, s1] = Netproto.createMemoryStreamPair()
      const [c2, s2] = Netproto.createMemoryStreamPair()

      // Player A in Rogue Encampment (area 1)
      host.attachClient(s1, {
        charName: 'TownWatcher',
        classId: 0,
        areaId: 1,
        x: 100,
        y: 100,
        protocol: 'd2gs',
      })
      // Player B in Cold Plains (area 3)
      host.attachClient(s2, {
        charName: 'PlainsHunter',
        classId: 4,
        areaId: 3,
        x: 100,
        y: 100,
        protocol: 'd2gs',
      })

      const aEvents: Netproto.ServerEvent[] = []
      const bEvents: Netproto.ServerEvent[] = []
      const adapterA = new Netproto.D2gsServerAdapter(c1)
      const adapterB = new Netproto.D2gsServerAdapter(c2)
      adapterA.onEvent((ev) => aEvents.push(ev))
      adapterB.onEvent((ev) => bEvents.push(ev))

      host.stepFrame()
      aEvents.length = 0
      bEvents.length = 0

      // Spawn monster and ground loot in Cold Plains (area 3)
      const coldPlainsMon = game.spawnMonster({
        hcIdx: 18,
        areaId: 3,
        x: 106,
        y: 106,
        hp: 80,
        maxHp: 80,
      })
      const coldPlainsLoot = game.spawnGroundItem({
        code: 'cap',
        areaId: 3,
        x: 104,
        y: 104,
      })

      host.stepFrames(4)

      // Player B in Cold Plains sees both monster and ground drop
      expect(
        bEvents.some(
          (e) =>
            e.type === 'UnitAssign' &&
            (e.unitId === coldPlainsMon || e.unit?.id === coldPlainsMon),
        ),
      ).toBe(true)
      expect(
        bEvents.some((e) => e.type === 'ItemEvent' && e.itemId === coldPlainsLoot),
      ).toBe(true)

      // Player A in Rogue Encampment receives ZERO Cold Plains monster or ground loot packets
      expect(
        aEvents.some(
          (e) =>
            (e.type === 'UnitAssign' &&
              (e.unitId === coldPlainsMon || e.unit?.id === coldPlainsMon)) ||
            (e.type === 'UnitMove' &&
              (e.id === coldPlainsMon || e.unitId === coldPlainsMon)) ||
            (e.type === 'ItemEvent' && e.itemId === coldPlainsLoot),
        ),
      ).toBe(false)

      host.close()
    })

    it('resyncs pre-existing ground items (0x9C) for pickup and flying missiles (0x73) when entering viewer AOI', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x17830002,
        areaId: 2,
      })
      const game = host.getGameInstance()

      const [cA, sA] = Netproto.createMemoryStreamPair()
      const [cB, sB] = Netproto.createMemoryStreamPair()

      // Player A at (80, 100), Player B far away at (195, 100) (distance = 115 > 100 AOI radius)
      host.attachClient(sA, {
        charName: 'ExplorerA',
        classId: 0,
        level: 20,
        areaId: 2,
        x: 80,
        y: 100,
        protocol: 'd2gs',
      })
      host.attachClient(sB, {
        charName: 'CasterB',
        classId: 1,
        level: 20,
        newSkills: 5,
        mana: 200,
        maxMana: 200,
        areaId: 2,
        x: 195,
        y: 100,
        protocol: 'd2gs',
      })

      const adapterA = new Netproto.D2gsServerAdapter(cA)
      const adapterB = new Netproto.D2gsServerAdapter(cB)
      const worldA = new ClientWorld()
      const sessionA = new OnlineSession({ world: worldA })
      sessionA.attachGameServer(adapterA)

      const aRawEvents: Netproto.ServerEvent[] = []
      adapterA.onEvent((ev) => aRawEvents.push(ev))

      // Allocate & select Sorceress B's Fire Bolt (skill 36) over binary C2S 0x3B + 0x3C
      adapterB.send({ type: 'AllocateSkill', skillId: 36 })
      adapterB.send({ type: 'SelectSkill', hand: 'right', skill: 36, itemId: 0xffffffff })
      host.stepFrame()

      // Spawn ground item at (190, 100) — distance 110 from A (outside A's 100-subtile AOI!)
      const farLootId = game.spawnGroundItem({
        code: 'rin',
        areaId: 2,
        x: 190,
        y: 100,
        quality: 4,
      })
      host.stepFrame()

      expect(worldA.containers.ground.has(farLootId)).toBe(false)

      // Sorceress B at (195, 100) fires Fire Bolt toward (80, 100) — initial spawn is at ~195 (dist 115 > 100, culled for A!)
      aRawEvents.length = 0
      adapterB.send({
        type: 'SkillAt',
        hand: 'right',
        at: { x: 80, y: 100 },
        hold: false,
      })
      host.stepFrame()
      expect(aRawEvents.some((e) => e.type === 'CreateMissile')).toBe(false)

      // Now Player A runs east toward (190, 100) while missile flies west -> both missile & ground loot enter A's AOI!
      sessionA.sendCommand({ type: 'RunToLocation', x: 190, y: 100 }, 1000)
      host.stepFrames(28)

      // 1. Long-range missile entered A's AOI in flight and emitted CreateMissile (0x73)
      expect(aRawEvents.some((e) => e.type === 'CreateMissile')).toBe(true)

      // 2. Ground item at (190, 100) entered A's AOI via S2C 0x9C AddToGround
      expect(worldA.containers.ground.has(farLootId)).toBe(true)

      // 3. Walk A all the way to (190, 100) and pick up the revealed ground item!
      sessionA.sendCommand({ type: 'RunToLocation', x: 190, y: 100 }, 2400)
      host.stepFrames(240)
      sessionA.sendCommand({ type: 'ItemPickup', itemId: farLootId, toCursor: false }, 12000)
      host.stepFrames(3)

      expect(worldA.containers.inventory.has(farLootId)).toBe(true)
      expect(worldA.containers.ground.has(farLootId)).toBe(false)

      sessionA.destroy()
      host.close()
    })
  })
})
