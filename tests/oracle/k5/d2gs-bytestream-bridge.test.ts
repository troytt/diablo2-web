import { describe, expect, it } from 'vitest'
import { STATES_CheckState113c, STATLIST_GetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'
import { UNITS_GetX113c, UNITS_GetY113c } from '../../../src/d2kern-113c/common/unit.ts'
import { D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  fogCompressPacket113c,
  frameServerPacket113c,
} from '../../../src/d2kern-113c/net/packet-sink.ts'
import {
  D2gsAdapter,
  D2gsS2cFramer,
  D2gsSession,
  createMemoryStreamPair,
  encodeC2sAddStatPoint,
  encodeC2sChat,
  encodeC2sGameLogon,
  encodeC2sLeaveGame,
  encodeC2sMove,
  encodeC2sMoveToUnit,
  encodeC2sPing,
  encodeC2sSelectSkill,
  parseD2gsBlockHeader,
  type ServerEvent,
} from '../../../src/netproto/index.ts'
import {
  D2GS_KERNEL_FRAME_MS_113C,
  D2gsKernelBridge113c,
} from '../../../src/server/net/d2gs-kernel-bridge-113c.ts'

describe('[K5] ByteStream <-> d2kern-113c D2gsKernelBridge113c', () => {
  it('completes full [0xAF, 0x01] -> 0x68 -> 0x01/0x02 -> 0x6B -> 0x03..0x04 room-entry handshake into D2gsAdapter', () => {
    const bridge = new D2gsKernelBridge113c({
      initSeed: 0xcafebabe,
      objectSeed: 0x01020304,
      difficulty: 1,
      expansion: true,
      hardcore: true,
      ladder: true,
      act: 0,
      areaId: 1,
      roomSubtileX: 5520,
      roomSubtileY: 5880,
      roomSubtileWidth: 80,
      roomSubtileHeight: 80,
      spawnX: 5560,
      spawnY: 5920,
    })

    const events: ServerEvent[] = []
    const conn = bridge.connectD2gsAdapter({
      logon: {
        gameHash: 0x11223344,
        gameToken: 1,
        charClass: 1,
        versionByte: 0x0d,
        charName: 'SorceressK5',
      },
    })
    conn.adapter.onEvent((ev) => events.push(ev))

    expect(conn.session.state).toBe('ingame')
    expect(conn.adapter.state).toBe('ingame')
    expect(conn.handle.getClientState()).toBe(4)
    expect(conn.adapter.stats.protocolErrors).toBe(0)
    expect(conn.adapter.listenerErrors).toBe(0)
    expect(events.some((e) => e.type === 'LoadComplete')).toBe(true)

    const pPlayer = conn.handle.getPlayerPtr()
    expect(pPlayer).not.toBe(0)
    expect(UNITS_GetX113c(bridge.m, pPlayer)).toBe(5560)
    expect(UNITS_GetY113c(bridge.m, pPlayer)).toBe(5920)

    const uncompressed = bridge.drainUncompressedS2CPackets(conn.clientId)
    const opcodes = uncompressed.map((p) => p.opcode)

    // Verify exact 1.13c handshake & world bootstrap S2C sequence:
    expect(opcodes[0]).toBe(0xaf) // Q0 uncompressed compression greeting `[0xAF, 0x01]`
    expect(uncompressed[0]!.bytes).toEqual(new Uint8Array([0xaf, 0x01]))
    expect(opcodes).toContain(0x01) // GameFlags
    expect(opcodes).toContain(0x00) // GameLoading
    expect(opcodes).toContain(0x02) // GameLogonSuccess
    expect(opcodes).toContain(0x03) // LoadAct
    expect(opcodes).toContain(0x53) // EnvironmentSync
    expect(opcodes).toContain(0x07) // RoomReveal (MapAdd)
    expect(opcodes).toContain(0x59) // AssignPlayer
    expect(opcodes).toContain(0x75) // PlayerPartyInfo
    expect(opcodes).toContain(0x15) // ReassignPlayer
    expect(opcodes).toContain(0x23) // AssignSkill
    expect(opcodes).toContain(0x1d) // BaseAttributeByte
    expect(opcodes).toContain(0xaa) // AddUnitState (UNIT_SendAllStatesBitstreamToClient113c)
    expect(opcodes).toContain(0x04) // LoadDone
    expect(opcodes[opcodes.length - 1]).toBe(0x8f) // Pong to D2gsSession's auto-0x6D Ping on 0x02

    // Verify wire packets: first packet is raw `[0xAF, 0x01]`, all subsequent packets are Fog.#10223 compressed
    const wire = bridge.drainWirePackets(conn.clientId)
    expect(wire.length).toBeGreaterThanOrEqual(3)
    expect(wire[0]!.queue).toBe(0)
    expect(wire[0]!.wireBytes).toEqual(new Uint8Array([0xaf, 0x01]))
    for (let i = 1; i < wire.length; i++) {
      const hdr = parseD2gsBlockHeader(wire[i]!.wireBytes, 0)
      expect(hdr).not.toBeNull()
      expect(hdr!.totalFrameSize).toBe(wire[i]!.wireBytes.byteLength)
    }

    void conn.adapter.close()
  })

  it('delivers all decoded room-entry ServerEvents when attaching listener before stream greeting', () => {
    const bridge = new D2gsKernelBridge113c({
      initSeed: 0x55aa1234,
      objectSeed: 0x77889900,
      difficulty: 2,
      expansion: true,
      hardcore: false,
      ladder: true,
      act: 0,
      areaId: 1,
      spawnX: 5555,
      spawnY: 5915,
    })

    const [clientStream, serverStream] = createMemoryStreamPair()
    const session = new D2gsSession({
      stream: clientStream,
      logon: {
        gameHash: 0x22334455,
        gameToken: 1,
        charClass: 3,
        versionByte: 0x0d,
        charName: 'PaladinK5',
      },
    })
    const adapter = new D2gsAdapter({
      session,
      tables: bridge.tables,
    })

    const events: ServerEvent[] = []
    adapter.onEvent((ev) => events.push(ev))

    const handle = bridge.attachClientStream(serverStream, {
      wireFormat: 'compressed',
      sendCompressionGreeting: true,
      defaultCharName: 'PaladinK5',
      defaultCharClass: 3,
    })

    expect(adapter.state).toBe('ingame')
    expect(adapter.stats.protocolErrors).toBe(0)
    expect(adapter.listenerErrors).toBe(0)
    expect(
      events.some(
        (e) =>
          e.type === 'GameFlags' &&
          e.difficulty === 2 &&
          e.hardcore === false &&
          e.expansion === true &&
          e.ladder === true,
      ),
    ).toBe(true)
    expect(
      events.some(
        (e) =>
          e.type === 'LoadAct' &&
          e.act === 0 &&
          e.areaId === 1 &&
          e.mapSeed === 0x55aa1234 &&
          e.objectSeed === 0x77889900,
      ),
    ).toBe(true)
    expect(events.some((e) => e.type === 'EnvironmentSync')).toBe(true)
    expect(events.some((e) => e.type === 'RoomReveal' && e.areaId === 1)).toBe(true)
    expect(
      events.some(
        (e) =>
          e.type === 'UnitAssign' &&
          e.unit.unitType === 0 &&
          e.classId === 3 &&
          e.unit.name === 'PaladinK5' &&
          e.unit.x === 5555 &&
          e.unit.y === 5915,
      ),
    ).toBe(true)
    expect(events.some((e) => e.type === 'StatSet' && e.stat === 0)).toBe(true)
    expect(events.some((e) => e.type === 'StatSet' && e.stat === 6)).toBe(true)
    expect(events.some((e) => e.type === 'LoadComplete')).toBe(true)

    void adapter.close()
    handle.close()
  })

  it('executes Walk (0x01), Run (0x03), WalkToUnit (0x02), and RunToUnit (0x04) across 25fps (40ms) kernel frames', () => {
    const bridge = new D2gsKernelBridge113c({
      areaId: 2, // Blood Moor (allows true wilderness Run mode = 3 + stamina drain)
      roomSubtileX: 5000,
      roomSubtileY: 5000,
      roomSubtileWidth: 100,
      roomSubtileHeight: 100,
      spawnX: 5020,
      spawnY: 5020,
    })

    const conn = bridge.connectD2gsAdapter({
      logon: {
        gameHash: 0xabcdef01,
        gameToken: 1,
        charClass: 4, // Barbarian
        versionByte: 0x0d,
        charName: 'BarbRunner',
      },
    })
    const events: ServerEvent[] = []
    conn.adapter.onEvent((ev) => events.push(ev))
    events.length = 0
    bridge.drainUncompressedS2CPackets()

    const pPlayer = conn.handle.getPlayerPtr()
    expect(UNITS_GetX113c(bridge.m, pPlayer)).toBe(5020)
    expect(UNITS_GetY113c(bridge.m, pPlayer)).toBe(5020)

    // 1. Send C2S `0x01 WalkToLocation` via `D2gsAdapter.send` -> `ByteStream` -> `D2Net.#10016` -> `0x6FCEC550`
    conn.adapter.send({ type: 'WalkToLocation', x: 5028, y: 5020 })
    expect(bridge.packetSink.inboundPendingCount(1)).toBe(1)

    const steppedWalk = bridge.advanceTimeMs(D2GS_KERNEL_FRAME_MS_113C * 25)
    expect(steppedWalk).toBe(25)
    expect(bridge.frame).toBe(25)
    expect(bridge.tickMs).toBe(1000)

    expect(UNITS_GetX113c(bridge.m, pPlayer)).toBe(5028)
    expect(UNITS_GetY113c(bridge.m, pPlayer)).toBe(5020)
    expect(events.some((e) => e.type === 'UnitMove' && e.mode === 'walk')).toBe(true)
    expect(events.some((e) => e.type === 'UnitMove' && e.mode === 'stop')).toBe(true) // 0x0D PlayerStop upon arrival
    expect(events.some((e) => e.type === 'WalkVerify')).toBe(true) // 0x96 WalkVerify upon arrival

    // 2. Send C2S `0x03 RunToLocation` via `D2gsAdapter.send` -> verifies Run mode (`0x0F`), stamina drain (`0x95`), and arrival (`0x0D`)
    events.length = 0
    const stamBefore = STATLIST_GetUnitStat113c(bridge.m, pPlayer, 10, 0)
    conn.adapter.send({ type: 'RunToLocation', x: 5042, y: 5032 })

    bridge.advanceTimeMs(D2GS_KERNEL_FRAME_MS_113C * 45)
    const stamAfter = STATLIST_GetUnitStat113c(bridge.m, pPlayer, 10, 0)
    expect(stamAfter).toBeLessThan(stamBefore)
    expect(UNITS_GetX113c(bridge.m, pPlayer)).toBe(5042)
    expect(UNITS_GetY113c(bridge.m, pPlayer)).toBe(5032)
    expect(events.some((e) => e.type === 'UnitMove' && e.mode === 'run')).toBe(true)
    expect(events.some((e) => e.type === 'LifeMana' || e.type === 'WalkVerify')).toBe(true)

    // 3. Spawn a monster and test C2S `0x02 WalkToUnit` & `0x04 RunToUnit` over raw ByteStream
    const mon = bridge.spawnMonsterInRoom({
      classId: 1, // Fallen
      x: 5052,
      y: 5032,
    })
    events.length = 0
    conn.clientStream.write(encodeC2sMoveToUnit(false, { unitType: 1, id: mon.unitId })) // 0x02 WalkToUnit
    bridge.stepFrame()
    expect(bridge.m.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(2) // PLRMODE_WALK

    conn.clientStream.write(encodeC2sMoveToUnit(true, { unitType: 1, id: mon.unitId })) // 0x04 RunToUnit
    bridge.advanceTimeMs(D2GS_KERNEL_FRAME_MS_113C * 30)
    expect(Math.abs(UNITS_GetX113c(bridge.m, pPlayer) - 5052)).toBeLessThanOrEqual(3)
    expect(conn.adapter.stats.protocolErrors).toBe(0)

    void conn.adapter.close()
  })

  it('roundtrips S2C unit (0xAC), attributes (0x1D/0x1E/0x1F + C2S 0x3A), states (0xA7/0xA8/0xA9), map (0x07/0x08), skills (0x3C->0x23), ping/pong (0x6D->0x8F), and logout (0x69->0x06)', () => {
    const bridge = new D2gsKernelBridge113c({
      areaId: 1,
      spawnX: 5560,
      spawnY: 5920,
    })
    const conn = bridge.connectD2gsAdapter()
    const events: ServerEvent[] = []
    conn.adapter.onEvent((ev) => events.push(ev))
    events.length = 0
    bridge.drainUncompressedS2CPackets()

    const pPlayer = conn.handle.getPlayerPtr()

    // 1. Unit packet `0xAC AssignNpc`
    const fallen = bridge.spawnMonsterInRoom({
      classId: 1,
      x: 5570,
      y: 5924,
      hp: 80,
      maxHp: 100,
    })
    expect(
      events.some(
        (e) =>
          e.type === 'UnitAssign' &&
          e.unit.unitType === 1 &&
          e.unit.id === fallen.unitId &&
          e.classId === 1 &&
          e.unit.x === 5570 &&
          e.unit.y === 5924,
      ),
    ).toBe(true)

    // 2. Attribute packets `0x1D` (byte), `0x1E` (word), `0x1F` (dword), plus C2S `0x3A AddStatPoint`
    events.length = 0
    bridge.drainUncompressedS2CPackets(conn.clientId)
    bridge.setPlayerStatAndSync(conn.clientId, 0, 45) // 0x1D Strength = 45
    bridge.setPlayerStatAndSync(conn.clientId, 13, 1200) // 0x1E Experience = 1200
    bridge.setPlayerStatAndSync(conn.clientId, 14, 150000) // 0x1F Gold = 150000

    const attrOpcodes = bridge.drainUncompressedS2CPackets(conn.clientId).map((p) => p.opcode)
    expect(attrOpcodes).toEqual([0x1d, 0x1e, 0x1f])
    expect(events.some((e) => e.type === 'StatSet' && e.stat === 0 && e.value === 45)).toBe(true)
    expect(events.some((e) => e.type === 'StatSet' && e.stat === 13 && e.value === 1200)).toBe(true)
    expect(events.some((e) => e.type === 'StatSet' && e.stat === 14 && e.value === 150000)).toBe(true)

    // Spend 2 stat points into Strength via C2S `0x3A`
    events.length = 0
    conn.clientStream.write(encodeC2sAddStatPoint(0, 2))
    bridge.stepFrame()
    expect(STATLIST_GetUnitStat113c(bridge.m, pPlayer, 0, 0)).toBe(47)
    expect(STATLIST_GetUnitStat113c(bridge.m, pPlayer, 4, 0)).toBe(3)
    expect(events.some((e) => e.type === 'StatSet' && e.stat === 0 && e.value === 47)).toBe(true)

    // 3. State packets `0xA7` (DelayedState), `0xA8` (SetState with ItemStatCost bitstream), and `0xA9` (EndState)
    events.length = 0
    bridge.setUnitStateAndSync(pPlayer, 8, true) // STATE_SALVATION = 8 (flag-only 0xA7)
    expect(STATES_CheckState113c(bridge.m, pPlayer, 8)).not.toBe(0)
    expect(
      events.some((e) => e.type === 'StateSet' && e.state === 8 && e.origin === 0xa7),
    ).toBe(true)

    events.length = 0
    bridge.setUnitStateAndSync(pPlayer, 32, true, [{ statId: 76, param: 0, value: 50 }]) // STATE_BATTLEORDERS = 32 (0xA8)
    expect(STATES_CheckState113c(bridge.m, pPlayer, 32)).not.toBe(0)
    expect(
      events.some(
        (e) =>
          e.type === 'StateSet' &&
          e.state === 32 &&
          e.origin === 0xa8 &&
          e.complete === true &&
          e.stats?.[0]?.statId === 76 &&
          e.stats?.[0]?.value === 50,
      ),
    ).toBe(true)

    events.length = 0
    bridge.setUnitStateAndSync(pPlayer, 32, false) // 0xA9 EndState
    expect(STATES_CheckState113c(bridge.m, pPlayer, 32)).toBe(0)
    expect(events.some((e) => e.type === 'StateEnd' && e.state === 32)).toBe(true)

    // 4. Map packets `0x07 RoomReveal` & `0x08 RoomHide`
    events.length = 0
    bridge.revealRoomToClient(conn.clientId, 1120, 1180, 1)
    bridge.hideRoomFromClient(conn.clientId, 1120, 1180, 1)
    expect(
      events.some((e) => e.type === 'RoomReveal' && e.tileX === 1120 && e.tileY === 1180 && e.areaId === 1),
    ).toBe(true)
    expect(
      events.some((e) => e.type === 'RoomHide' && e.tileX === 1120 && e.tileY === 1180 && e.areaId === 1),
    ).toBe(true)

    // 5. Skill select C2S `0x3C` -> S2C `0x23 AssignSkill` (`ActiveSkill`)
    events.length = 0
    conn.clientStream.write(encodeC2sSelectSkill('left', 0, 0xffffffff))
    bridge.stepFrame()
    expect(
      events.some((e) => e.type === 'ActiveSkill' && e.hand === 'left' && e.skill === 0),
    ).toBe(true)

    // 6. Ping/Pong (`0x6D` -> 33-byte `0x8F`) and LeaveGame (`0x69` -> 1-byte `0x06` + disconnect)
    bridge.drainUncompressedS2CPackets()
    conn.clientStream.write(encodeC2sPing(1234, 0))
    const pongPkts = bridge.drainUncompressedS2CPackets(conn.clientId)
    expect(pongPkts.some((p) => p.opcode === 0x8f && p.bytes.byteLength === 33)).toBe(true)

    events.length = 0
    conn.clientStream.write(encodeC2sLeaveGame())
    expect(events.some((e) => e.type === 'GameLogout')).toBe(true)
    expect(conn.handle.getClientState()).toBe(5)
    expect(conn.adapter.stats.protocolErrors).toBe(0)

    void conn.adapter.close()
  })

  it('roundtrips Fog.#10223 Huffman wire compression for both 1-byte (< 0xF0) and 2-byte (>= 0xF0) framed blocks plus fragmented C2S chunks', () => {
    const bridge = new D2gsKernelBridge113c({
      areaId: 1,
      spawnX: 5560,
      spawnY: 5920,
    })

    // Connect raw ByteStream pair and feed C2S packets fragmented 1 byte at a time
    const [clientStream, serverStream] = createMemoryStreamPair()
    const framer = new D2gsS2cFramer(false)
    const framedPackets: Array<{ packetId: number; bytes: Uint8Array }> = []
    clientStream.onData((chunk) => {
      const decoded = framer.push(chunk)
      for (const p of decoded) {
        framedPackets.push({ packetId: p.packetId, bytes: p.bytes })
      }
    })

    const handle = bridge.attachClientStream(serverStream, {
      wireFormat: 'compressed',
      sendCompressionGreeting: true,
    })
    expect(framer.isCompressedMode).toBe(true)
    expect(framedPackets.length).toBe(1)
    expect(framedPackets[0]!.packetId).toBe(0xaf)

    // Send 37-byte `0x68 GameLogon` + 1-byte `0x6B EnterGame` + variable-length `0x15 Chat` + 5-byte `0x01 Walk` 1 byte at a time
    const logonBytes = encodeC2sGameLogon({
      gameHash: 0x12345678,
      gameToken: 1,
      charClass: 2, // Necromancer
      versionByte: 0x0d,
      charName: 'ByteFragNecro',
    })
    const enterBytes = new Uint8Array([0x6b])
    const chatBytes = encodeC2sChat('hello from 1-byte fragments')
    const walkBytes = encodeC2sMove(false, { x: 5566, y: 5922 })

    const streamBurst = new Uint8Array(
      logonBytes.byteLength + enterBytes.byteLength + chatBytes.byteLength + walkBytes.byteLength,
    )
    let off = 0
    streamBurst.set(logonBytes, off)
    off += logonBytes.byteLength
    streamBurst.set(enterBytes, off)
    off += enterBytes.byteLength
    streamBurst.set(chatBytes, off)
    off += chatBytes.byteLength
    streamBurst.set(walkBytes, off)

    for (let i = 0; i < streamBurst.byteLength; i++) {
      clientStream.write(streamBurst.subarray(i, i + 1))
    }
    bridge.stepFrame()

    expect(handle.getClientState()).toBe(4)
    expect(framedPackets.some((p) => p.packetId === 0x04)).toBe(true)
    expect(framedPackets.some((p) => p.packetId === 0x26)).toBe(true) // echoed chat
    expect(framedPackets.some((p) => p.packetId === 0x0f)).toBe(true) // walk move sync

    // Verify >= 0xF0 2-byte compressed block (`headerSize === 2`, `wire[0] >= 0xF0`) roundtrips 1:1
    bridge.drainUncompressedS2CPackets(handle.clientId)
    bridge.drainWirePackets(handle.clientId)
    framedPackets.length = 0

    const rawBatch = new Uint8Array(62 * 6)
    for (let i = 0; i < 62; i++) {
      const base = i * 6
      const v = (((i * 0x9e3779b9) ^ 0x5a5aa5a5) >>> 1) >>> 0
      rawBatch[base] = 0x1f
      rawBatch[base + 1] = 14
      rawBatch[base + 2] = v & 0xff
      rawBatch[base + 3] = (v >>> 8) & 0xff
      rawBatch[base + 4] = (v >>> 16) & 0xff
      rawBatch[base + 5] = (v >>> 24) & 0xff
    }
    const compressedPayloadLen = fogCompressPacket113c(rawBatch)
    const framed2Byte = frameServerPacket113c(1, rawBatch)
    expect(compressedPayloadLen + 2).toBeGreaterThanOrEqual(0xf0)
    expect(framed2Byte[0]! & 0xf0).toBe(0xf0)
    const parsedHdr = parseD2gsBlockHeader(framed2Byte, 0)
    expect(parsedHdr).toEqual({
      headerSize: 2,
      headerLen: 2,
      totalFrameSize: framed2Byte.byteLength,
      totalBlockBytes: framed2Byte.byteLength,
      compressedPayloadLen,
    })

    const pLarge = bridge.m.alloc(rawBatch.byteLength)
    bridge.m.loadBlock(pLarge, rawBatch)
    bridge.packetSink.sendPacketFromMemory(bridge.m, 1, handle.clientId, pLarge, rawBatch.byteLength)
    const drainedLarge = bridge.packetSink.drain()
    expect(drainedLarge.length).toBe(1)
    expect(drainedLarge[0]!.wireBytes![0]! & 0xf0).toBe(0xf0)

    const split62 = framer.push(drainedLarge[0]!.wireBytes!)
    expect(split62.length).toBe(62)
    for (let i = 0; i < 62; i++) {
      expect(split62[i]!.packetId).toBe(0x1f)
      expect(split62[i]!.bytes).toEqual(rawBatch.subarray(i * 6, (i + 1) * 6))
    }

    handle.close()
  })

  it('supports uncompressed ByteStream consumers and preserves bit-identical twin-bridge lockstep determinism', () => {
    const runScenario = () => {
      const bridge = new D2gsKernelBridge113c({
        initSeed: 0x13572468,
        objectSeed: 0x24681357,
        areaId: 2,
        roomSubtileX: 5200,
        roomSubtileY: 5200,
        roomSubtileWidth: 100,
        roomSubtileHeight: 100,
        spawnX: 5230,
        spawnY: 5230,
      })

      const [uncompClient, uncompServer] = createMemoryStreamPair()
      const uncompChunks: Uint8Array[] = []
      uncompClient.onData((chunk) => uncompChunks.push(chunk.slice()))

      const uncompHandle = bridge.attachClientStream(uncompServer, {
        clientId: 1,
        wireFormat: 'uncompressed',
        defaultCharName: 'TwinDruid',
        defaultCharClass: 5,
      })
      uncompClient.write(new Uint8Array([0x6b]))

      // Verify uncompressed stream received raw S2C game packets (no `[0xAF, 0x01]` greeting)
      expect(uncompChunks.length).toBeGreaterThan(0)
      expect(uncompChunks[0]![0]).not.toBe(0xaf)

      bridge.spawnMonsterInRoom({ classId: 1, x: 5255, y: 5245 })
      uncompClient.write(encodeC2sMove(true, { x: 5248, y: 5240 }))
      for (let f = 0; f < 20; f++) {
        bridge.stepFrame()
      }
      uncompClient.write(encodeC2sMove(false, { x: 5236, y: 5234 }))
      for (let f = 0; f < 20; f++) {
        bridge.stepFrame()
      }

      const pPlr = uncompHandle.getPlayerPtr()
      const finalState = {
        frame: bridge.frame,
        tickMs: bridge.tickMs,
        x: UNITS_GetX113c(bridge.m, pPlr),
        y: UNITS_GetY113c(bridge.m, pPlr),
        mode: bridge.m.get(pPlr, D2UnitStrc.dwAnimMode),
        stamina: STATLIST_GetUnitStat113c(bridge.m, pPlr, 10, 0),
        uncompressed: bridge.drainUncompressedS2CPackets().map((p) => Array.from(p.bytes)),
        wire: bridge.drainWirePackets().map((p) => Array.from(p.wireBytes)),
        streamBytes: uncompChunks.map((c) => Array.from(c)),
      }
      uncompHandle.close()
      return finalState
    }

    const runA = runScenario()
    const runB = runScenario()

    expect(runA.frame).toBe(40)
    expect(runA.tickMs).toBe(1600)
    expect(runA.x).toBe(5236)
    expect(runA.y).toBe(5234)
    expect(runA).toEqual(runB)
  })
})
