import { describe, expect, it } from 'vitest'
import { ByteWriter } from '../../src/netproto/core/byte-writer.ts'
import {
  BitWriter,
  decodeD2gsS2cPacket,
  decodeD2gsServerPacket,
  getMonsterAnimCompBitWidths,
  S2C_PACKET_SIZES,
} from '../../src/netproto/index.ts'

describe('D2GS S->C 1.13c packet decoders (M1)', () => {
  it('decodes 0x09 AssignWarp with warpId populated on UnitSnapshot', () => {
    const w = new ByteWriter(S2C_PACKET_SIZES[0x09]!)
    w.u8(0x09)
    w.u8(5) // unitType = tile
    w.u32LE(300) // unitId
    w.u8(18) // warpId / classId
    w.u16LE(5100)
    w.u16LE(5200)
    const ev = decodeD2gsServerPacket(w.toUint8Array())
    expect(ev.type).toBe('UnitAssign')
    if (ev.type === 'UnitAssign') {
      expect(ev.unit.unitType).toBe(5)
      expect(ev.unit.id).toBe(300)
      expect(ev.unit.classId).toBe(18)
      expect(ev.unit.warpId).toBe(18)
      expect(ev.unit.x).toBe(5100)
      expect(ev.unit.y).toBe(5200)
    }
  })

  it('decodes 0x27 NPCInfo, 0x91 NPCGetShow, and 0xAB NPCHeal', () => {
    const w27 = new ByteWriter(S2C_PACKET_SIZES[0x27]!)
    w27.u8(0x27)
    w27.u8(1)
    w27.u32LE(44)
    w27.bytes(new Uint8Array(34))
    const ev27 = decodeD2gsS2cPacket(w27.toUint8Array())
    expect(ev27).toMatchObject({ type: 'Npc', kind: 'info', npcId: 44 })

    const w91 = new ByteWriter(S2C_PACKET_SIZES[0x91]!)
    w91.u8(0x91)
    w91.u8(0)
    w91.bytes(new Uint8Array(24))
    const ev91 = decodeD2gsS2cPacket(w91.toUint8Array())
    expect(ev91).toMatchObject({ type: 'Npc', kind: 'menu' })

    const wab = new ByteWriter(S2C_PACKET_SIZES[0xab]!)
    wab.u8(0xab)
    wab.u8(1)
    wab.u32LE(44)
    wab.u8(120)
    const evab = decodeD2gsS2cPacket(wab.toUint8Array())
    expect(evab).toEqual({ type: 'Npc', kind: 'heal', npcId: 44, result: 120 })
  })

  it('decodes 0x4E MercForHire, 0x4F StartMercList, 0x81 MercAssign, and 0x9B MercReviveCost', () => {
    const w4f = new ByteWriter(1)
    w4f.u8(0x4f)
    expect(decodeD2gsS2cPacket(w4f.toUint8Array())).toEqual({
      type: 'Merc',
      kind: 'hireList',
    })

    const w4e = new ByteWriter(7)
    w4e.u8(0x4e)
    w4e.u16LE(14)
    w4e.u32LE(0x12345678)
    expect(decodeD2gsS2cPacket(w4e.toUint8Array())).toEqual({
      type: 'Merc',
      kind: 'hireList',
      nameId: 14,
      value: 0x12345678,
    })

    const w81 = new ByteWriter(20)
    w81.u8(0x81)
    w81.u8(0)
    w81.u16LE(271)
    w81.u32LE(1)
    w81.u32LE(99)
    w81.u32LE(0xdeadbeef)
    w81.u16LE(14)
    w81.u16LE(0x5678)
    expect(decodeD2gsS2cPacket(w81.toUint8Array())).toEqual({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 99,
      classId: 271,
      nameId: 14,
      seed: 0xdeadbeef,
      value: 0xdeadbeef,
    })

    const w9b = new ByteWriter(7)
    w9b.u8(0x9b)
    w9b.u16LE(14)
    w9b.u32LE(25000)
    expect(decodeD2gsS2cPacket(w9b.toUint8Array())).toEqual({
      type: 'Merc',
      kind: 'stat',
      nameId: 14,
      value: 25000,
    })
  })

  it('decodes 0x77 ButtonActions, 0x78 TradeAccepted (with partnerName), 0x79 GoldInTrade, and 0x92 ClearDisplay', () => {
    const w77 = new ByteWriter(2)
    w77.u8(0x77)
    w77.u8(0x01)
    expect(decodeD2gsS2cPacket(w77.toUint8Array())).toEqual({
      type: 'Trade',
      action: 0x01,
    })

    const w78 = new ByteWriter(21)
    w78.u8(0x78)
    w78.fixedCString('TradeBuddy', 16)
    w78.u32LE(7)
    expect(decodeD2gsS2cPacket(w78.toUint8Array())).toEqual({
      type: 'Trade',
      action: 0x78,
      partnerId: 7,
      partnerName: 'TradeBuddy',
    })

    const w79 = new ByteWriter(6)
    w79.u8(0x79)
    w79.u8(1)
    w79.u32LE(12500)
    expect(decodeD2gsS2cPacket(w79.toUint8Array())).toEqual({
      type: 'Trade',
      action: 0x7901,
      gold: 12500,
    })

    const w92 = new ByteWriter(6)
    w92.u8(0x92)
    w92.u8(0)
    w92.u32LE(7)
    expect(decodeD2gsS2cPacket(w92.toUint8Array())).toEqual({
      type: 'Trade',
      action: 0x9200,
      partnerId: 7,
    })
  })

  it('decodes 0xAC AssignNPC 4-bit bitstream mode (D2Game.dll 0x6fcacac9 / D2Client.dll 0x6fb5e462)', () => {
    // Alive Rogue Scout (classId=564) with bitstream byte 0x01 (low 4 bits = 1 MONMODE_NEUTRAL)
    const alivePkt = new Uint8Array([
      0xac,
      0x2a, 0x00, 0x00, 0x00, // id = 42
      0x34, 0x02,             // classId = 564 (act1hire / Rogue Scout)
      0xf6, 0x13,             // x = 5110
      0xc4, 0x13,             // y = 5060
      0x80,                   // lifePct = 128 (full HP)
      0x0e,                   // packet length = 14
      0x01,                   // bitstream: low 4 bits = 1 (MONMODE_NEUTRAL)
    ])
    const aliveEv = decodeD2gsServerPacket(alivePkt)
    expect(aliveEv.type).toBe('UnitAssign')
    if (aliveEv.type === 'UnitAssign') {
      expect(aliveEv.unit.unitType).toBe(1)
      expect(aliveEv.unit.id).toBe(42)
      expect(aliveEv.unit.classId).toBe(564)
      expect(aliveEv.unit.lifePct).toBe(128)
      expect(aliveEv.unit.mode).toBe(1) // MONMODE_NEUTRAL, never 0 (MONMODE_DEATH)
      expect(aliveEv.unit.direction).toBeGreaterThanOrEqual(0)
      expect(aliveEv.unit.direction).toBeLessThan(64)
    }

    // Dead monster corpse (lifePct = 0, bitstream low 4 bits = 12 MONMODE_DEAD)
    const corpsePkt = new Uint8Array([
      0xac,
      0x99, 0x00, 0x00, 0x00,
      0x01, 0x00,
      0x00, 0x14,
      0x00, 0x14,
      0x00, // lifePct = 0
      0x0e,
      0x0c, // low 4 bits = 12 (MONMODE_DEAD)
    ])
    const corpseEv = decodeD2gsServerPacket(corpsePkt)
    expect(corpseEv.type).toBe('UnitAssign')
    if (corpseEv.type === 'UnitAssign') {
      expect(corpseEv.unit.lifePct).toBe(0)
      expect(corpseEv.unit.mode).toBe(12)
    }

    // SuperUnique Bishibosh (classId=58 fallenshaman1, superUniqueId=0) with hasAnimComp=1, bossMods=[8, 9], nameSeed=0x1234, ownerId=0xdeadbeef
    const bw = new BitWriter()
    bw.writeBits(1, 4) // rawMode = 1 (MONMODE_NEUTRAL)
    bw.writeBit(1) // hasAnimComp = 1
    const widths = getMonsterAnimCompBitWidths(1) // hcIdx=1 (returned / Skeleton, has multi-bit component widths)
    for (let i = 0; i < 16; i++) {
      bw.writeBits(i % (1 << widths[i]!), widths[i]!)
    }
    bw.writeBit(1) // hasMonsterFlags = 1
    bw.writeBit(0) // champion = 0
    bw.writeBit(1) // unique = 1
    bw.writeBit(1) // superunique = 1
    bw.writeBit(0) // minion = 0
    bw.writeBit(0) // ghostly = 0
    bw.writeBits(0, 16) // superUniqueId = 0 (Bishibosh)
    bw.writeBits(8, 8) // mod 0 = 8 (Magic Resistant)
    bw.writeBits(9, 8) // mod 1 = 9 (Fire Enchanted)
    bw.writeBits(0, 8) // terminator = 0
    bw.writeBits(0x1234, 16) // nameSeed = 0x1234
    bw.writeBit(1) // hasOwner = 1
    bw.writeBits(0xdeadbeef, 32) // ownerId = 0xdeadbeef
    const bitBytes = bw.toUint8Array()
    const totalLen = 13 + bitBytes.byteLength
    const bossWriter = new ByteWriter(totalLen)
    bossWriter.u8(0xac)
    bossWriter.u32LE(777)
    bossWriter.u16LE(1)
    bossWriter.u16LE(5120)
    bossWriter.u16LE(5140)
    bossWriter.u8(96)
    bossWriter.u8(totalLen)
    bossWriter.bytes(bitBytes)

    const bossEv = decodeD2gsServerPacket(bossWriter.toUint8Array())
    expect(bossEv.type).toBe('UnitAssign')
    if (bossEv.type === 'UnitAssign') {
      expect(bossEv.unit.id).toBe(777)
      expect(bossEv.unit.classId).toBe(1)
      expect(bossEv.unit.isUnique).toBe(true)
      expect(bossEv.unit.isSuperUnique).toBe(true)
      expect(bossEv.unit.superUniqueId).toBe(0)
      expect(bossEv.unit.bossMods).toEqual([8, 9])
      expect(bossEv.unit.nameSeed).toBe(0x1234)
      expect(bossEv.unit.ownerId).toBe(0xdeadbeef)
      expect(bossEv.unit.compVariants).toHaveLength(16)
    }
  })

  it('maps 0x69/0x6A/0x6B state command index via D2Client.dll 0x6fb82e68 (MONSTER_CMD_TO_MODE)', () => {
    // 0x69 SetNPCMode: [0x69, id:u32, cmd:u8, x:u16, y:u16, lifePct:u8, unk:u8]
    const make69 = (cmd: number, lifePct: number) => {
      const w = new ByteWriter(12)
      w.u8(0x69)
      w.u32LE(77)
      w.u8(cmd)
      w.u16LE(5100)
      w.u16LE(5200)
      w.u8(lifePct)
      w.u8(0)
      return decodeD2gsServerPacket(w.toUint8Array())
    }

    // cmd 0x07 -> mode 1 (MONMODE_NEUTRAL)
    expect(make69(0x07, 128)).toMatchObject({ type: 'UnitMode', id: 77, mode: 1, lifePct: 128 })
    // cmd 0x06 -> mode 3 (MONMODE_GETHIT)
    expect(make69(0x06, 96)).toMatchObject({ type: 'UnitMode', id: 77, mode: 3, lifePct: 96 })
    // cmd 0x08 -> mode 0 (MONMODE_DEATH)
    expect(make69(0x08, 0)).toMatchObject({ type: 'UnitMode', id: 77, mode: 0, lifePct: 0 })
    // cmd 0x09 -> mode 12 (MONMODE_DEAD)
    expect(make69(0x09, 0)).toMatchObject({ type: 'UnitMode', id: 77, mode: 12, lifePct: 0 })
    // cmd 0x0A -> mode 4 (MONMODE_ATTACK1)
    expect(make69(0x0a, 128)).toMatchObject({ type: 'UnitMode', id: 77, mode: 4, lifePct: 128 })
    // cmd 0x10 -> mode 5 (MONMODE_ATTACK2)
    expect(make69(0x10, 128)).toMatchObject({ type: 'UnitMode', id: 77, mode: 5, lifePct: 128 })
    // cmd 0x04 -> mode 7 (MONMODE_CAST)
    expect(make69(0x04, 128)).toMatchObject({ type: 'UnitMode', id: 77, mode: 7, lifePct: 128 })

    // Real 1.13c Charsi 0x6B NPCAction2 packet from 02-d2gs-town-walk-chat.d2cap:
    // 6b 08000000 0c 000000000000 3f16 9a11 (rawCmd=0x0C Sequence, paramByte=0x00 must NOT zero out lifePct)
    const charsi6b = new Uint8Array([
      0x6b,
      0x08, 0x00, 0x00, 0x00, // id = 8 (Charsi)
      0x0c,                   // rawCmd = 0x0C -> mode 8 (MONMODE_SEQUENCE)
      0x00, 0x00, 0x00, 0x00, // targetX=0, targetY=0
      0x00, 0x00,             // paramByte=0, animSpeed=0
      0x3f, 0x16,             // x = 5695
      0x9a, 0x11,             // y = 4506
    ])
    const charsiEv = decodeD2gsServerPacket(charsi6b)
    expect(charsiEv).toEqual({
      type: 'UnitMode',
      unitType: 1,
      id: 8,
      mode: 8,
      // #808: D2Client 0x6FB5F7C0 drift-checks (u16@0C, u16@0E), then builds {x, y, @0A, 2, 0, 4, @0B}.
      npc: { opcode: 0x6b, cmd: 0x0c, s: [0, 0, 0, 2, 0, 4, 0], driftCheckAt: { x: 5695, y: 4506 } },
    })
  })

  it('decodes 0x67 NPCMove and 0x68 NPCMoveToTarget walk/run moveType, pathType, and velocityPercent (1.13c D2PacketDef.h)', () => {
    // Real 0x67 NPCMove from 04-d2gs-idle-60s.d2cap (Akara id=11 walking to (5313,6294) with pathType=2, nVelocity=75):
    // 67 0b000000 01 c114 9618 0000 02 4b00 00
    const akara67 = new Uint8Array([
      0x67,
      0x0b, 0x00, 0x00, 0x00, // id = 11
      0x01,                   // moveType = 0x01 (walk)
      0xc1, 0x14,             // targetX = 5313
      0x96, 0x18,             // targetY = 6294
      0x00, 0x00,             // unk0x0A
      0x02,                   // pathType = 2 (PATHTYPE_TOWARD)
      0x4b, 0x00,             // velocityPercent = 75 (0x004b)
      0x00,                   // unk0x0F
    ])
    const ev67 = decodeD2gsServerPacket(akara67)
    expect(ev67).toEqual({
      type: 'UnitMove',
      unitType: 1,
      id: 11,
      mode: 'walk',
      to: { x: 5313, y: 6294 },
      pathType: 2,
      velocityPercent: 75,
      // #808: D2Client 0x6FB5F460 s = {x, y, @0A, pathType @0C, vel @0D, @0F, @0B}.
      npc: { opcode: 0x67, cmd: 1, s: [5313, 6294, 0, 2, 75, 0, 0] },
    })

    const w68Run = new ByteWriter(21)
    w68Run.u8(0x68)
    w68Run.u32LE(88)
    w68Run.u8(0x18) // 0x18 = run in 0x68 NPCMoveToTarget
    w68Run.u16LE(5100)
    w68Run.u16LE(5200)
    w68Run.u8(0) // targetType = player
    w68Run.u32LE(1) // targetId = 1
    w68Run.u16LE(0) // unk0x0F
    w68Run.u8(2) // pathType = 2
    w68Run.i16LE(155) // velocityPercent = 155 (e.g. Fallen run: 75 + (100*9/5 - 100) = 155)
    w68Run.u8(0) // unk0x14
    const ev68 = decodeD2gsServerPacket(w68Run.toUint8Array())
    expect(ev68).toMatchObject({
      type: 'UnitMove',
      unitType: 1,
      id: 88,
      mode: 'run',
      from: { x: 5100, y: 5200 },
      target: { unitType: 0, id: 1 },
      pathType: 2,
      velocityPercent: 155,
    })
  })
})

