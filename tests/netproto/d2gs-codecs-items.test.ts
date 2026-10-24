import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCanonicalItemDataTables } from '../../src/client/world/item-tables-provider.ts'
import { ProtocolError } from '../../src/netproto/core/errors.ts'
import {
  defaultD2gsHuffmanCodec,
  parseD2gsBlockHeader,
  wrapD2gsCompressedBlock,
} from '../../src/netproto/d2gs/compression.ts'
import { validateC2sPacket } from '../../src/netproto/d2gs/framing-c2s.ts'
import { D2gsS2cFramer, resolveS2cPacketSize } from '../../src/netproto/d2gs/framing-s2c.ts'
import {
  D2GS_S2C_REGISTRY,
  decodeD2gsS2cPacket,
  encodeD2gsClientCommand,
} from '../../src/netproto/d2gs/registry.ts'
import {
  HUFFMAN_BIT_LENGTHS,
  HUFFMAN_BIT_MASKS,
  HUFFMAN_CODES,
} from '../../src/netproto/d2gs/tables/huffman.ts'
import {
  C2S_PACKET_SIZES,
  D2CLIENT_S2C_HANDLERS,
  S2C_PACKET_SIZES,
} from '../../src/netproto/d2gs/tables/s2c-sizes.ts'
import type { ClientCommand } from '../../src/netproto/domain/client-command.ts'
import { replayD2CapFile } from '../../tools/netproto-replay.ts'

describe('D2GS 1.13c extracted tables, Huffman codec, S2C/C2S framing & registry', () => {
  it('verifies extracted 1.13c D2Net.dll and Fog.dll tables match binary invariants', () => {
    expect(S2C_PACKET_SIZES).toHaveLength(181) // 0x00..0xB4
    expect(C2S_PACKET_SIZES).toHaveLength(113) // 0x00..0x70
    expect(D2CLIENT_S2C_HANDLERS).toHaveLength(175) // 0x00..0xAE
    expect(HUFFMAN_BIT_LENGTHS).toHaveLength(256)
    expect(HUFFMAN_CODES).toHaveLength(256)
    expect(HUFFMAN_BIT_MASKS).toHaveLength(16)

    // Every non-zero S2C opcode in S2C_PACKET_SIZES must be registered in D2GS_S2C_REGISTRY
    for (let op = 0; op < S2C_PACKET_SIZES.length; op++) {
      if (S2C_PACKET_SIZES[op] !== 0) {
        const entry = D2GS_S2C_REGISTRY[op]
        expect(entry, `Missing D2GS_S2C_REGISTRY entry for 0x${op.toString(16)}`).toBeDefined()
        expect(entry!.d2ClientHandlerVa).toMatch(/^0x6fb[0-9a-f]{5}$/)
      }
    }
  })

  it('round-trips arbitrary byte buffers through Fog.dll Huffman compress/decompress and block framing', () => {
    const sample = new Uint8Array(320)
    for (let i = 0; i < sample.length; i++) {
      sample[i] = (i * 73 + 19) & 0xff
    }
    const compressed = defaultD2gsHuffmanCodec.compress(sample)
    const decompressed = defaultD2gsHuffmanCodec.decompress(compressed)
    expect(Array.from(decompressed)).toEqual(Array.from(sample))

    // 1-byte header (< 0xF0)
    const smallFrame = wrapD2gsCompressedBlock(new Uint8Array(10).fill(0x55))
    const hSmall = parseD2gsBlockHeader(smallFrame, 0)
    expect(hSmall).toEqual({
      headerSize: 1,
      headerLen: 1,
      totalFrameSize: 11,
      totalBlockBytes: 11,
      compressedPayloadLen: 10,
    })

    // 2-byte header (>= 0xF0)
    const bigPayload = new Uint8Array(300).fill(0xaa)
    const bigFrame = wrapD2gsCompressedBlock(bigPayload)
    const hBig = parseD2gsBlockHeader(bigFrame, 0)
    expect(hBig).toEqual({
      headerSize: 2,
      headerLen: 2,
      totalFrameSize: 302,
      totalBlockBytes: 302,
      compressedPayloadLen: 300,
    })
  })

  it('frames uncompressed 0xAF greeting followed by multi-packet compressed blocks in D2gsS2cFramer', () => {
    const framer = new D2gsS2cFramer()
    expect(framer.isCompressedMode).toBe(false)

    // 1. Push uncompressed [0xAF, 0x01] greeting
    const greetingOut = framer.push(new Uint8Array([0xaf, 0x01]))
    expect(greetingOut).toHaveLength(1)
    expect(greetingOut[0]!.packetId).toBe(0xaf)
    expect(framer.isCompressedMode).toBe(true)

    // 2. Build a multi-packet decompressed buffer: 0x01 GameFlags (8B) + 0x00 GameLoading (1B) + 0x02 GameLogonSuccess (1B) + 0x04 LoadDone (1B)
    const rawBlock = new Uint8Array([
      0x01, 0x00, 0x04, 0x00, 0x30, 0x00, 0x01, 0x01,
      0x00,
      0x02,
      0x04,
    ])
    const compressedBlock = wrapD2gsCompressedBlock(defaultD2gsHuffmanCodec.compress(rawBlock))

    // Feed in 2 fragments
    expect(framer.push(compressedBlock.subarray(0, 3))).toHaveLength(0)
    const split = framer.push(compressedBlock.subarray(3))
    expect(split.map((p) => p.packetId)).toEqual([0x01, 0x00, 0x02, 0x04])

    const tables = getCanonicalItemDataTables()
    const flagsEv = decodeD2gsS2cPacket(split[0]!.bytes, { tables })
    expect(flagsEv).toEqual({
      type: 'GameFlags',
      difficulty: 0,
      hardcore: false,
      expansion: true,
      ladder: true,
    })

    // Invalid opcode 0x30 (size 0 in 1.13c table) throws ProtocolError
    expect(() => resolveS2cPacketSize(new Uint8Array([0x30]), 0)).toThrow(ProtocolError)
  })

  it('encodes and validates all ClientCommand variants against C2S_PACKET_SIZES', () => {
    const commands: readonly ClientCommand[] = [
      { type: 'Move', run: false, to: { x: 5100, y: 5200 } },
      { type: 'Move', run: true, to: { x: 5104, y: 5204 } },
      { type: 'MoveToUnit', run: false, target: { unitType: 1, id: 10 } },
      { type: 'MoveToUnit', run: true, target: { unitType: 1, id: 10 } },
      { type: 'SkillAt', hand: 'left', at: { x: 5110, y: 5210 }, hold: true },
      { type: 'SkillAt', hand: 'right', at: { x: 5110, y: 5210 }, hold: false },
      { type: 'SkillOn', hand: 'left', target: { unitType: 1, id: 12 }, shift: true, hold: false },
      { type: 'SkillOn', hand: 'right', target: { unitType: 1, id: 12 }, shift: false, hold: true },
      { type: 'SelectSkill', hand: 'right', skill: 36 },
      { type: 'Interact', target: { unitType: 2, id: 25 } },
      { type: 'ItemPickup', itemId: 101, toCursor: false },
      { type: 'ItemDrop', itemId: 101 },
      { type: 'ItemToCursor', itemId: 101 },
      { type: 'ItemPlace', itemId: 101, x: 2, y: 1, buffer: 0 },
      { type: 'ItemEquip', itemId: 101, slot: 4 },
      { type: 'ItemUnequip', slot: 4 },
      { type: 'ItemSwap', itemId: 102, slot: 4 },
      { type: 'BeltPut', itemId: 103, slot: 0 },
      { type: 'BeltRemove', itemId: 103 },
      { type: 'BeltUse', itemId: 103, shift: false },
      { type: 'ItemUse', itemId: 104, at: { x: 5100, y: 5200 } },
      { type: 'SocketItem', itemId: 105, targetItemId: 106 },
      { type: 'IdentifyItem', itemId: 107, scrollId: 108 },
      { type: 'NpcInit', target: { unitType: 1, id: 15 } },
      { type: 'NpcCancel', target: { unitType: 1, id: 15 } },
      { type: 'NpcOpenTrade', npcId: 15 },
      { type: 'NpcOpenGamble', npcId: 15 },
      { type: 'NpcBuy', npcId: 15, itemId: 200, itemMode: 0, gamble: false, shiftFill: false, cost: 50 },
      { type: 'NpcSell', npcId: 15, itemId: 200, itemMode: 0, cost: 25 },
      { type: 'NpcRepairItem', npcId: 15, itemId: 200, itemMode: 1, durability: 3 },
      { type: 'NpcRepairAll', npcId: 15 },
      { type: 'AddStatPoint', statId: 0, count: 1 },
      { type: 'AddSkillPoint', skillId: 36 },
      { type: 'WaypointGo', waypointId: 30, destAreaId: 1 },
      { type: 'ClickButton', buttonId: 0x12, amount: 0 },
      { type: 'Party', action: 6, targetPlayerId: 2 },
      { type: 'Hostile', targetPlayerId: 2, hostile: true },
      { type: 'Trade', action: 2, gold: 0 },
      { type: 'Chat', text: 'Hello world' },
      { type: 'OverheadChat', text: 'Watch out!' },
      { type: 'Resurrect' },
      { type: 'SwapWeapons' },
      { type: 'Ping' },
      { type: 'LeaveGame' },
    ]

    for (const cmd of commands) {
      const pkts = encodeD2gsClientCommand(cmd, 'gbk', 12345)
      expect(pkts.length).toBeGreaterThan(0)
      for (const pkt of pkts) {
        expect(() => validateC2sPacket(pkt)).not.toThrow()
      }
    }
  })
})

describe('Live .d2cap wire capture replay & 0x9C/0x9D item bitstream verification', () => {
  const fixtureFiles = [
    'tests/fixtures/netproto/01-bncs-mcp-lobby.d2cap',
    'tests/fixtures/netproto/02-d2gs-town-walk-chat.d2cap',
    'tests/fixtures/netproto/03-d2gs-items-npc-skills.d2cap',
    'tests/fixtures/netproto/04-d2gs-idle-60s.d2cap',
  ]

  for (const relPath of fixtureFiles) {
    it(`replays ${relPath} with 0 unknown, 0 opaque, and 0 protocol errors`, () => {
      const res = replayD2CapFile(resolve(process.cwd(), relPath), { strict: true })
      expect(res.totalRecords).toBeGreaterThan(100)
      expect(res.unknownPackets).toBe(0)
      expect(res.opaquePackets).toBe(0)
      expect(res.protocolErrors).toBe(0)
      expect(res.world.mapSeed).toBeGreaterThan(0)
      expect(res.world.areaId).toBe(1)
      expect(res.world.selfId).toBeGreaterThan(0)
      expect(res.world.self.name).toBe('WebBotOne')
      expect(res.world.self.x).toBeGreaterThan(0)
      expect(res.world.self.y).toBeGreaterThan(0)
      expect(res.world.self.life).toBe(50)
      expect(res.world.self.maxLife).toBe(50)
      expect(res.world.containers.inventory.size).toBeGreaterThanOrEqual(2)
      expect(res.world.containers.equipment.size).toBeGreaterThanOrEqual(2)
      expect(res.world.containers.belt.size).toBeGreaterThanOrEqual(4)
    })
  }
})
