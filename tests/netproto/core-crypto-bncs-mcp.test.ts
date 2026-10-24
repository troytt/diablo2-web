import { describe, expect, it } from 'vitest'
import { BitReader } from '../../src/netproto/core/bit-reader.ts'
import { BitWriter } from '../../src/netproto/core/bit-writer.ts'
import { ByteReader } from '../../src/netproto/core/byte-reader.ts'
import { ByteWriter } from '../../src/netproto/core/byte-writer.ts'
import { ProtocolError } from '../../src/netproto/core/errors.ts'
import { bytesToHex, hexToBytes } from '../../src/netproto/core/packet-tap.ts'
import { defaultTextCodec } from '../../src/netproto/core/text-codec.ts'
import { doubleHash, hashBnetPassword, hashRealmPassword } from '../../src/netproto/crypto/bnet-hash.ts'
import { createSyntheticCdKeyPair, decodeD2CdKey, hashD2CdKey } from '../../src/netproto/crypto/cdkey.ts'
import { getCheckRevision113c } from '../../src/netproto/crypto/check-revision.ts'
import { xsha1, xsha1Ascii } from '../../src/netproto/crypto/xsha1.ts'
import { BncsFramer, encodeBncsFrame } from '../../src/netproto/bncs/framing.ts'
import {
  BncsOpcode,
  decodeBncsS2cPacket,
  encodeBncsLogonRealmEx,
  encodeBncsPing,
} from '../../src/netproto/bncs/packets.ts'
import { BncsSession } from '../../src/netproto/bncs/session.ts'
import { McpFramer, encodeMcpFrame } from '../../src/netproto/mcp/framing.ts'
import {
  McpOpcode,
  decodeMcpS2cPacket,
  encodeMcpStartup,
  parseMcpCharStatString,
} from '../../src/netproto/mcp/packets.ts'
import { McpSession } from '../../src/netproto/mcp/session.ts'
import { createMemoryStreamPair } from '../../src/netproto/transport/memory-stream.ts'

describe('netproto core primitives (ByteReader/ByteWriter, BitReader/BitWriter, TextCodec)', () => {
  it('round-trips little-endian integers and strings via ByteWriter and ByteReader', () => {
    const w = new ByteWriter(16)
    w.u8(0xfe)
    w.i8(-12)
    w.u16LE(0x1234)
    w.i16LE(-3210)
    w.u32LE(0xdeadbeef)
    w.i32LE(-123456789)
    w.cstring('Sanctuary')
    w.fixedCString('Hero', 8)

    const buf = w.toUint8Array()
    const r = new ByteReader(buf)
    expect(r.u8()).toBe(0xfe)
    expect(r.i8()).toBe(-12)
    expect(r.u16LE()).toBe(0x1234)
    expect(r.i16LE()).toBe(-3210)
    expect(r.u32LE()).toBe(0xdeadbeef)
    expect(r.i32LE()).toBe(-123456789)
    expect(r.cstring()).toBe('Sanctuary')
    expect(r.fixedCString(8)).toBe('Hero')
    expect(r.remaining).toBe(0)
  })

  it('throws ProtocolError when ByteReader reads past end of buffer', () => {
    const r = new ByteReader(new Uint8Array([0x01, 0x02]), 0, 'd2gs', 0x01)
    expect(r.u16LE()).toBe(0x0201)
    expect(() => r.u8()).toThrow(ProtocolError)
  })

  it('round-trips arbitrary LSB-first bit widths and signed fields via BitWriter and BitReader', () => {
    const bw = new BitWriter()
    bw.writeBit(1)
    bw.writeBit(0)
    bw.writeBits(0x15, 5)
    bw.writeBits(0x3ff, 10)
    bw.writeBits(0xdeadbeef, 32)
    bw.writeSignedBits(-42, 8)
    bw.writeSignedBits(-1023, 12)
    bw.writeAscii('gld')
    bw.alignToByte()
    bw.writeBits(0xab, 8)

    const bytes = bw.toUint8Array()
    const br = new BitReader(bytes)
    expect(br.readBit()).toBe(1)
    expect(br.readBit()).toBe(0)
    expect(br.readBits(5)).toBe(0x15)
    expect(br.readBits(10)).toBe(0x3ff)
    expect(br.readBits(32)).toBe(0xdeadbeef)
    expect(br.readSignedBits(8)).toBe(-42)
    expect(br.readSignedBits(12)).toBe(-1023)
    expect(br.readAscii(3)).toBe('gld')
    br.alignToByte()
    expect(br.readBits(8)).toBe(0xab)
    expect(br.bitsRemaining).toBe(0)
    expect(() => br.readBit()).toThrow(ProtocolError)
  })

  it('encodes and decodes UTF-8, raw GBK, and Storm.dll CP1252->UTF-8 double-encoded GBK strings cleanly', () => {
    const ascii = defaultTextCodec.encode('Act1Town', 'utf-8')
    expect(defaultTextCodec.decode(ascii, 'utf-8')).toBe('Act1Town')
    // GBK bytes for "暗黑" (0xB0 0xB5 0xBA 0xDA)
    const gbkBytes = new Uint8Array([0xb0, 0xb5, 0xba, 0xda])
    expect(defaultTextCodec.decode(gbkBytes, 'gbk')).toBe('暗黑')

    // 1. Storm.dll!#912 (0x6fc25b50 CP1252 table 0x6fc356b0) + #902 (0x6fc257a0 UTF-8) double-encoded GBK:
    // "你是？" -> GBK [0xC4, 0xE3, 0xCA, 0xC7, 0xA3, 0xBF] -> CP1252 "ÄãÊÇ£¿" -> UTF-8:
    const stormDoubleEncoded = new Uint8Array([
      0xc3, 0x84, 0xc3, 0xa3, 0xc3, 0x8a, 0xc3, 0x87, 0xc2, 0xa3, 0xc2, 0xbf,
    ])
    expect(defaultTextCodec.decode(stormDoubleEncoded, 'gbk')).toBe('你是？')

    // 2. Even-length 3-byte UTF-8 Chinese ("你是" = 6 bytes E4 BD A0 E6 98 AF) must not misdecode as GBK "浣犲旾"
    const evenUtf8Chinese = new Uint8Array([0xe4, 0xbd, 0xa0, 0xe6, 0x98, 0xaf])
    expect(defaultTextCodec.decode(evenUtf8Chinese, 'gbk')).toBe('你是')

    // 3. 2-byte raw GBK characters whose bytes [0xC2..0xDF, 0x80..0xBF] also form valid 2-byte UTF-8
    for (const phrase of ['没', '么', '什么', '谢谢', '一', '小牛', '你是？']) {
      const encodedGbk = defaultTextCodec.encode(phrase, 'gbk')
      expect(defaultTextCodec.decode(encodedGbk, 'gbk')).toBe(phrase)
    }
  })
})

describe('netproto crypto (XSha1, BNet password hash, CD-Key hash, CheckRevision 1.13c)', () => {
  it('computes deterministic Broken SHA-1 (xsha1) and double password hashes', () => {
    const emptyDigest = bytesToHex(xsha1(new Uint8Array(0)))
    expect(emptyDigest).toHaveLength(40)
    // Lowercases password before hashing per PvPGN / Battle.net spec
    const hUpper = bytesToHex(hashBnetPassword('MySecretPass123'))
    const hLower = bytesToHex(hashBnetPassword('mysecretpass123'))
    expect(hUpper).toBe(hLower)

    const proof = doubleHash(0x509cb8b4, 0x24d6da71, hashBnetPassword('testpass'))
    expect(proof.byteLength).toBe(20)

    const realmProof = hashRealmPassword(0xb4b89c50, 0x24d6da71)
    expect(bytesToHex(realmProof)).toBe('dfde6704ae8e22bf6a050ddb7c801979259b3233')
    expect(xsha1Ascii('password')).toHaveLength(20)
  })

  it('decodes and hashes 16-char D2 CD-Keys and provides 1.13c CheckRevision constants', () => {
    const pair = createSyntheticCdKeyPair(1)
    const h1 = hashD2CdKey(0xb4b89c50, 0x24d6da71, pair.classic)
    const h2 = hashD2CdKey(0xb4b89c50, 0x24d6da71, pair.expansion)
    expect(h1.productValue).toBe(0x06)
    expect(h2.productValue).toBe(0x0a)
    expect(h1.hashedKeyData).toHaveLength(20)
    expect(h2.hashedKeyData).toHaveLength(20)

    const decoded = decodeD2CdKey('2678-4682-7468-2648', 0x06)
    expect(decoded.keyLength).toBe(16)
    expect(decoded.productValue).toBe(0x06)

    const ver = getCheckRevision113c()
    expect(ver.versionByte).toBe(0x0d)
  })
})

describe('BNCS & MCP framing, packets, and sessions', () => {
  it('frames fragmented BNCS packets and decodes live SID_LOGONREALMEX +MCP_STARTUP layout', () => {
    // Live SID_LOGONREALMEX S->C packet
    const logonRealmHex =
      'ff3e5600509cb8b40000000000000000100000007f00000117e1000071dad6240000000000000000505832440d0000000000000000000000cf16a2f62e712f5e640012aefa5d38214a478a866432776562626f743100'
    const raw = hexToBytes(logonRealmHex)
    const framer = new BncsFramer()
    expect(framer.push(raw.subarray(0, 10))).toHaveLength(0)
    const pkts = framer.push(raw.subarray(10))
    expect(pkts).toHaveLength(1)

    const decoded = decodeBncsS2cPacket(pkts[0]!)
    expect(decoded.type).toBe('SID_LOGONREALMEX')
    if (decoded.type === 'SID_LOGONREALMEX') {
      expect(decoded.data.mcpCookie).toBe(0xb4b89c50)
      expect(decoded.data.mcpStatus).toBe(0)
      expect(decoded.data.mcpIp).toBe('127.0.0.1')
      expect(decoded.data.mcpPort).toBe(6113)
      expect(decoded.data.uniqueName).toBe('d2webbot1')

      // MCP_STARTUP omits mcpIp/mcpPort (8B) -> 77 bytes total
      const mcpStartup = encodeMcpStartup(decoded.data)
      expect(bytesToHex(mcpStartup)).toBe(
        '4d0001509cb8b400000000000000001000000071dad6240000000000000000505832440d0000000000000000000000cf16a2f62e712f5e640012aefa5d38214a478a866432776562626f743100',
      )
    }
  })

  it('parses MCP_CHARLIST2 33-byte statStrings accurately', () => {
    const charListHex =
      '3b00190800010000000100ffffff7f576562426f744f6e65008d80ffffffffff2dff4fffffff07ffffffffffffffffffffff01e080808001ffff00'
    const mcpFramer = new McpFramer()
    const pkts = mcpFramer.push(hexToBytes(charListHex))
    expect(pkts).toHaveLength(1)
    const decoded = decodeMcpS2cPacket(pkts[0]!)
    expect(decoded.type).toBe('MCP_CHARLIST2')
    if (decoded.type === 'MCP_CHARLIST2') {
      expect(decoded.chars).toHaveLength(1)
      expect(decoded.chars[0]!.name).toBe('WebBotOne')
      expect(decoded.chars[0]!.charClass).toBe(6)
      expect(decoded.chars[0]!.level).toBe(1)
      expect(decoded.chars[0]!.expansion).toBe(true)
      expect(decoded.chars[0]!.hardcore).toBe(false)
      expect(decoded.chars[0]!.ladder).toBe(true)
    }

    // Also test Sorceress (classByte = 2 -> classId = 1)
    const sorcStat = new Uint8Array(33).fill(0xff)
    sorcStat[0] = 0x84
    sorcStat[1] = 0x80
    sorcStat[13] = 0x02 // Sorceress (1 + 1)
    sorcStat[25] = 42 // level 42
    sorcStat[26] = 0xe4 // 0x80 | LADDER (0x40) | EXPANSION (0x20) | HARDCORE (0x04)
    sorcStat[27] = 0x80 | (15 << 1) // 0x9e: progression = 15 (bits 1..5 per Fog.#10085)
    const summary = parseMcpCharStatString('TestSorc', 123456, sorcStat)
    expect(summary.charClass).toBe(1)
    expect(summary.level).toBe(42)
    expect(summary.expansion).toBe(true)
    expect(summary.hardcore).toBe(true)
    expect(summary.ladder).toBe(true)
    expect(summary.progression).toBe(15)
    expect(summary.difficulty).toBe(2)
  })

  it('auto-echoes SID_PING in BncsSession and completes MCP startup over MemoryStream', async () => {
    const [clientStream, serverStream] = createMemoryStreamPair()
    const bncs = new BncsSession(clientStream, { clientToken: 0x11223344 })

    const serverReceived: Uint8Array[] = []
    serverStream.onData((chunk) => serverReceived.push(chunk))

    // Server sends SID_PING (0x25)
    serverStream.write(encodeBncsPing(0xdeadbeef))
    expect(serverReceived).toHaveLength(1)
    expect(bytesToHex(serverReceived[0]!)).toBe('ff250800efbeadde')
    bncs.close()

    // Test McpSession startup + charLogon
    const [mcpClientStream, mcpServerStream] = createMemoryStreamPair()
    const mcp = new McpSession(mcpClientStream)
    mcpServerStream.onData((chunk) => {
      if (chunk.length >= 3 && chunk[2] === McpOpcode.MCP_STARTUP) {
        mcpServerStream.write(encodeMcpFrame(McpOpcode.MCP_STARTUP, new Uint8Array([0, 0, 0, 0])))
      } else if (chunk.length >= 3 && chunk[2] === McpOpcode.MCP_CHARLOGON) {
        mcpServerStream.write(encodeMcpFrame(McpOpcode.MCP_CHARLOGON, new Uint8Array([0, 0, 0, 0])))
      }
    })

    const status = await mcp.startup({
      mcpCookie: 1,
      mcpStatus: 0,
      mcpChunk1: new Uint8Array(8),
      mcpIp: '127.0.0.1',
      mcpPort: 6113,
      mcpChunk2: new Uint8Array(48),
      uniqueName: 'bot',
    })
    expect(status).toBe(0)
    expect(mcp.state).toBe('ready')

    const logonStatus = await mcp.charLogon('WebBotOne')
    expect(logonStatus).toBe(0)
    expect(mcp.state).toBe('charLoggedIn')
    expect(mcp.activeCharacter).toBe('WebBotOne')
    mcp.close()
  })

  it('encodes SID_LOGONREALMEX request and decodes SID_SETEMAIL cleanly', () => {
    const req = encodeBncsLogonRealmEx(0x11223344, new Uint8Array(20).fill(0xaa), 'Sanctuary')
    expect(req[0]).toBe(0xff)
    expect(req[1]).toBe(BncsOpcode.SID_LOGONREALMEX)

    const setEmail = encodeBncsFrame(BncsOpcode.SID_SETEMAIL, new Uint8Array(0))
    const framer = new BncsFramer()
    const [rawPkt] = framer.push(setEmail)
    expect(decodeBncsS2cPacket(rawPkt!).type).toBe('SID_SETEMAIL')
  })

  it('sends 1.13c SID_NULL (0x00) every 180,000 ms after handshake begins and stops on close', async () => {
    const { FakeClock } = await import('../../src/netproto/core/clock.ts')
    const { BNCS_KEEPALIVE_INTERVAL_MS } = await import('../../src/netproto/bncs/session.ts')
    const { InMemoryPacketTap } = await import('../../src/netproto/core/packet-tap.ts')

    expect(BNCS_KEEPALIVE_INTERVAL_MS).toBe(180_000)

    const clock = new FakeClock(1000)
    const tap = new InMemoryPacketTap()
    const [clientStream, serverStream] = createMemoryStreamPair()
    const bncs = new BncsSession(clientStream, { clock, packetTap: tap, clientToken: 0x11223344 })

    const serverFramer = new BncsFramer()
    let initSeen = false
    const serverNullsReceived: Uint8Array[] = []

    serverStream.onData((chunk) => {
      let data = chunk
      if (!initSeen && data[0] === 0x01) {
        initSeen = true
        data = data.subarray(1)
      }
      for (const pkt of serverFramer.push(data)) {
        if (pkt.id === BncsOpcode.SID_AUTH_INFO) {
          const w = new ByteWriter()
          w.u32LE(0)
          w.u32LE(0xabcdef01)
          w.u32LE(0)
          w.u32LE(0)
          w.u32LE(0)
          w.cstring('ver-IX86-1.mpq')
          w.cstring('A=1 B=2 C=3 4 A=A^S B=B^C C=C^A A=A^B')
          serverStream.write(encodeBncsFrame(BncsOpcode.SID_AUTH_INFO, w.toUint8Array()))
        } else if (pkt.id === BncsOpcode.SID_AUTH_CHECK) {
          serverStream.write(encodeBncsFrame(BncsOpcode.SID_AUTH_CHECK, new Uint8Array([0, 0, 0, 0, 0])))
        } else if (pkt.id === BncsOpcode.SID_NULL) {
          serverNullsReceived.push(pkt.raw)
          // PvPGN bnetd _client_pingreq echoes 4-byte SID_NULL (FF 00 04 00)
          serverStream.write(encodeBncsFrame(BncsOpcode.SID_NULL, new Uint8Array(0)))
        }
      }
    })

    await bncs.handshake()
    expect(serverNullsReceived).toHaveLength(0)

    // Before 180,000 ms (0x2bf20): no SID_NULL sent
    clock.advance(179_999)
    expect(serverNullsReceived).toHaveLength(0)

    // At exactly 180,000 ms: first SID_NULL sent (FF 00 04 00) and echoed by server
    clock.advance(1)
    expect(serverNullsReceived).toHaveLength(1)
    expect(bytesToHex(serverNullsReceived[0]!)).toBe('ff000400')

    // At 360,000 ms: second SID_NULL sent
    clock.advance(180_000)
    expect(serverNullsReceived).toHaveLength(2)

    const nullTapEntries = tap.entries.filter((e) => e.packetName === 'SID_NULL')
    expect(nullTapEntries.filter((e) => e.dir === 'c2s')).toHaveLength(2)
    expect(nullTapEntries.filter((e) => e.dir === 's2c')).toHaveLength(2)

    // Closing session stops the keepalive timer
    bncs.close()
    clock.advance(540_000)
    expect(serverNullsReceived).toHaveLength(2)
  })

  it('decodes MCP_GAMEINFO (0x06) per 1.13c D2MCPClient.dll (0x6fa26280) including creatorLevel, levelDiff, description, and player roster', async () => {
    const payload = new ByteWriter()
    payload.u16LE(0x0042) // requestId
    payload.u32LE(0) // status
    payload.u32LE(3725) // uptimeSec (1:02:05)
    payload.u8(45) // creatorLevel (+0x0b from opcode)
    payload.u8(10) // levelDiff (+0x0c from opcode)
    payload.u8(4) // maxPlayers (+0x0d from opcode)
    payload.u8(2) // playerCount (+0x0e from opcode)
    const classes = new Uint8Array(16)
    classes[0] = 1 // Sorceress
    classes[1] = 3 // Paladin
    payload.bytes(classes) // +0x0f..+0x1e
    const levels = new Uint8Array(16)
    levels[0] = 45
    levels[1] = 50
    payload.bytes(levels) // +0x1f..+0x2e
    payload.cstring('Baal Runs Fast') // +0x2f description cstring
    payload.cstring('Isendra') // player[0]
    payload.cstring('Roland') // player[1]

    const frame = encodeMcpFrame(McpOpcode.MCP_GAMEINFO, payload.toUint8Array())
    const framer = new McpFramer()
    const [rawPkt] = framer.push(frame)
    const decoded = decodeMcpS2cPacket(rawPkt!)
    expect(decoded.type).toBe('MCP_GAMEINFO')
    if (decoded.type === 'MCP_GAMEINFO') {
      expect(decoded.requestId).toBe(0x0042)
      expect(decoded.info.status).toBe(0)
      expect(decoded.info.uptimeSec).toBe(3725)
      expect(decoded.info.creatorLevel).toBe(45)
      expect(decoded.info.levelDiff).toBe(10)
      expect(decoded.info.maxPlayers).toBe(4)
      expect(decoded.info.description).toBe('Baal Runs Fast')
      expect(decoded.info.players).toEqual([
        { name: 'Isendra', charClass: 1, level: 45 },
        { name: 'Roland', charClass: 3, level: 50 },
      ])
    }

    // Verify McpSession.getGameInfo round-trip
    const [clientStream, serverStream] = createMemoryStreamPair()
    const mcp = new McpSession(clientStream)
    serverStream.onData((chunk) => {
      if (chunk.length >= 3 && chunk[2] === McpOpcode.MCP_GAMEINFO) {
        const reqId = chunk[3]! | (chunk[4]! << 8)
        const resp = new ByteWriter()
        resp.u16LE(reqId)
        resp.u32LE(0)
        resp.u32LE(125)
        resp.u8(80)
        resp.u8(0xff)
        resp.u8(8)
        resp.u8(1)
        const cls = new Uint8Array(16)
        cls[0] = 2 // Necromancer
        resp.bytes(cls)
        const lvls = new Uint8Array(16)
        lvls[0] = 80
        resp.bytes(lvls)
        resp.cstring('Cow Level')
        resp.cstring('Xul')
        serverStream.write(encodeMcpFrame(McpOpcode.MCP_GAMEINFO, resp.toUint8Array()))
      }
    })
    const info = await mcp.getGameInfo('CowRun-01')
    expect(info.creatorLevel).toBe(80)
    expect(info.levelDiff).toBe(0xff)
    expect(info.description).toBe('Cow Level')
    expect(info.players).toEqual([{ name: 'Xul', charClass: 2, level: 80 }])
    mcp.close()
  })

  it('handles MCP_GAMELIST (0x05) without truncating on playerCount===0, deduplicates by index/name, and encodes Hardcore flag 0x800 (#931)', async () => {
    const { encodeMcpGameList } = await import('../../src/netproto/mcp/packets.ts')
    const hcFrame = encodeMcpGameList(0x0007, '', 0x0800)
    expect(bytesToHex(hcFrame)).toBe('0a000507000008000000')

    const [clientStream, serverStream] = createMemoryStreamPair()
    const mcp = new McpSession(clientStream)
    const receivedFlags: number[] = []

    const buildGameListPkt = (
      reqId: number,
      index: number,
      playerCount: number,
      status: number,
      name: string,
      description: string,
    ): Uint8Array => {
      const w = new ByteWriter()
      w.u16LE(reqId)
      w.u32LE(index)
      w.u8(playerCount)
      w.u32LE(status >>> 0)
      w.cstring(name)
      w.cstring(description)
      return encodeMcpFrame(McpOpcode.MCP_GAMELIST, w.toUint8Array())
    }

    serverStream.onData((chunk) => {
      if (chunk.length >= 9 && chunk[2] === McpOpcode.MCP_GAMELIST) {
        const reqId = chunk[3]! | (chunk[4]! << 8)
        const flags =
          (chunk[5]! | (chunk[6]! << 8) | (chunk[7]! << 16) | (chunk[8]! << 24)) >>> 0
        receivedFlags.push(flags)

        // 1. Open game with name.length > 0 and playerCount === 0 (must be retained per D2Multi.dll 0x6f9e2120 and NOT terminate listGames!)
        serverStream.write(buildGameListPkt(reqId, 1, 0, 0x00300004, 'StaleEmptyGame', ''))
        // 2. Closed/invalid status game without GAME_STAT_OPEN (0x04) bit (must be skipped without terminating!)
        serverStream.write(buildGameListPkt(reqId, 2, 2, 0x00300000, 'ClosedGame', ''))
        // 3. Valid open Normal game (status = 0x00300004)
        serverStream.write(buildGameListPkt(reqId, 3, 1, 0x00300004, 'NormalOpen1', 'act1 walk'))
        // 4. Duplicate index (3) with updated playerCount = 3 (must deduplicate in place per 0x6f9e2120)
        serverStream.write(buildGameListPkt(reqId, 3, 3, 0x00300004, 'NormalOpen1', 'act1 walk'))
        // 5. Valid open Hell game (status = 0x00302004, cross-difficulty visibility)
        serverStream.write(buildGameListPkt(reqId, 4, 2, 0x00302004, 'HellBaal01', 'baal run'))
        // 6. Real d2cs 17-byte end-of-list sentinel (name="", desc="", 3 trailing 0x00 bytes)
        const sentinel = new Uint8Array(17)
        sentinel[0] = 17
        sentinel[1] = 0
        sentinel[2] = McpOpcode.MCP_GAMELIST
        sentinel[3] = reqId & 0xff
        sentinel[4] = (reqId >>> 8) & 0xff
        serverStream.write(sentinel)
      }
    })

    const streamedNames: string[] = []
    const games = await mcp.listGames('', {
      flags: 0x0800,
      onGame: (g) => {
        streamedNames.push(`${g.name}:${g.playerCount}`)
      },
    })

    expect(receivedFlags).toEqual([0x0800])
    expect(streamedNames).toEqual([
      'StaleEmptyGame:0',
      'NormalOpen1:1',
      'NormalOpen1:3',
      'HellBaal01:2',
    ])
    expect(games).toEqual([
      {
        index: 1,
        name: 'StaleEmptyGame',
        description: '',
        playerCount: 0,
        status: 0x00300004,
      },
      {
        index: 3,
        name: 'NormalOpen1',
        description: 'act1 walk',
        playerCount: 3,
        status: 0x00300004,
      },
      {
        index: 4,
        name: 'HellBaal01',
        description: 'baal run',
        playerCount: 2,
        status: 0x00302004,
      },
    ])
    mcp.close()

    // Also verify McpSession.getGameInfo resolves with unavailable status 0xffffffff (no TimeoutError)
    // when d2cs sends no S2C 0x06 response for a non-existent/closed game
    const [clientStream2] = createMemoryStreamPair()
    const mcp2 = new McpSession(clientStream2)
    const missingInfo = await mcp2.getGameInfo('MissingRoom', { timeoutMs: 25 })
    expect(missingInfo.name).toBe('MissingRoom')
    expect(missingInfo.status >>> 0).toBe(0xffffffff)
    expect(missingInfo.players).toEqual([])
    mcp2.close()
  })
})

describe('WsStream RFC 6455 close code normalization (#1021)', () => {
  it('passes valid RFC 6455 close code 1000 when closed without arguments or with reserved code, and detaches handlers', async () => {
    const { WsStream } = await import('../../src/netproto/transport/ws-stream.ts')
    const closeCalls: Array<number | undefined> = []

    const makeMockWs = () => ({
      binaryType: 'arraybuffer',
      readyState: 1,
      onopen: null as ((ev: unknown) => void) | null,
      onmessage: null as ((ev: { readonly data: unknown }) => void) | null,
      onerror: null as ((ev: unknown) => void) | null,
      onclose: null as ((ev: { readonly code?: number; readonly reason?: string }) => void) | null,
      send: () => {},
      close: (code?: number) => {
        closeCalls.push(code)
      },
    })

    // 1. Default close() -> sends 1000 on wire, emits { kind: 'local' }
    const ws1 = makeMockWs()
    const stream1 = new WsStream(ws1, 'bncs', 'wss://www.laiseek.xyz/d2net/bnet')
    const reasons1: unknown[] = []
    stream1.onClose((r) => reasons1.push(r))
    stream1.close()
    expect(closeCalls).toEqual([1000])
    expect(reasons1).toEqual([{ kind: 'local' }])
    expect(ws1.onclose).toBeNull()
    expect(ws1.onmessage).toBeNull()

    // 2. Application close code in 3000..4999 -> preserved on wire
    const ws2 = makeMockWs()
    const stream2 = new WsStream(ws2, 'mcp', 'wss://www.laiseek.xyz/d2net/realm')
    const reasons2: unknown[] = []
    stream2.onClose((r) => reasons2.push(r))
    stream2.close(4001)
    expect(closeCalls).toEqual([1000, 4001])
    expect(reasons2).toEqual([{ kind: 'local', code: 4001 }])

    // 3. Reserved/non-wire code (e.g. 1005/1006) -> normalized to 1000 on wire to avoid DOM InvalidAccessError / websockify 1005 echo
    const ws3 = makeMockWs()
    const stream3 = new WsStream(ws3, 'bncs', 'wss://www.laiseek.xyz/d2net/bnet')
    stream3.close(1005)
    expect(closeCalls).toEqual([1000, 4001, 1000])
  })
})



