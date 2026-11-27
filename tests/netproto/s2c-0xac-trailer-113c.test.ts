import { describe, expect, it } from 'vitest'
import { ByteWriter } from '../../src/netproto/core/byte-writer.ts'
import { BitWriter, decodeD2gsS2cPacket } from '../../src/netproto/index.ts'
import type { ItemDataTables } from '../../src/netproto/domain/ids.ts'

// ItemStatCost.txt rows (Send Bits / Send Param Bits / Signed): velocitypercent 67 = 10/0/1, alignment 172 = 2/0/0.
const ISC: Record<number, { sendBits: number; sendParamBits: number; signed: boolean }> = {
  67: { sendBits: 10, sendParamBits: 0, signed: true },
  68: { sendBits: 10, sendParamBits: 0, signed: true },
  172: { sendBits: 2, sendParamBits: 0, signed: false },
}
const tables = {
  itemStatCost: new Map(),
  armor: new Map(),
  weapons: new Map(),
  misc: new Map(),
  getStatMeta: () => undefined,
  getStatCost: (id: number) => (ISC[id] ? ({ id, ...ISC[id] } as any) : undefined),
  getItemBaseMeta: () => undefined,
  getItemMeta: () => undefined,
} as unknown as ItemDataTables

function pkt0xAC(bits: Uint8Array): Uint8Array {
  const total = 13 + bits.byteLength
  const w = new ByteWriter(total)
  w.u8(0xac)
  w.u32LE(4242)
  w.u16LE(5) // classId 5 (no multi-bit components needed: hasAnimComp = 0)
  w.u16LE(5000)
  w.u16LE(5100)
  w.u8(128)
  w.u8(total)
  w.bytes(bits)
  return w.toUint8Array()
}

describe('S2C 0xAC trailing fields (D2Client.dll 0x6fb5e4fc..0x6fb5e85a / D2Game.dll 0x6fcacbb3..0x6fcacf3f)', () => {
  it('has no owner bit without monster flags; reads the 31-bit player owner and stat list', () => {
    const bw = new BitWriter()
    bw.writeBits(1, 4) // mode NU
    bw.writeBit(0) // hasAnimComp
    bw.writeBit(0) // hasMonsterFlags = 0 -> no owner bit (0x6fb5e503 je 0x6fb5e5f1)
    bw.writeBit(1) // has player owner
    bw.writeBits(0x1234567, 31)
    bw.writeBit(1) // hasStats
    bw.writeBits(67, 9)
    bw.writeSignedBits(-25, 10)
    bw.writeBits(172, 9)
    bw.writeBits(2, 2)
    bw.writeBits(0x1ff, 9)
    const ev = decodeD2gsS2cPacket(pkt0xAC(bw.toUint8Array()), { tables })
    expect(ev.type).toBe('UnitAssign')
    if (ev.type !== 'UnitAssign') return
    expect(ev.unit.ownerId).toBe(0x1234567)
    expect(ev.unit.ownerType).toBe(0)
    expect(ev.unit.stats).toEqual([
      { statId: 67, param: 0, value: -25 },
      { statId: 172, param: 0, value: 2 },
    ])
  })

  it('reads the flags-block owner, then the trailing fields', () => {
    const bw = new BitWriter()
    bw.writeBits(1, 4)
    bw.writeBit(0)
    bw.writeBit(1) // hasMonsterFlags
    bw.writeBit(1) // champion
    bw.writeBits(0, 4)
    bw.writeBits(0, 8) // no boss mods
    bw.writeBits(0x4321, 16) // nameSeed
    bw.writeBit(1) // flags-block owner
    bw.writeBits(0xdeadbeef, 32)
    bw.writeBit(0) // no player owner
    bw.writeBit(1) // hasStats
    bw.writeBits(68, 9)
    bw.writeSignedBits(50, 10)
    bw.writeBits(0x1ff, 9)
    const ev = decodeD2gsS2cPacket(pkt0xAC(bw.toUint8Array()), { tables })
    if (ev.type !== 'UnitAssign') throw new Error('expected UnitAssign')
    expect(ev.unit.isChampion).toBe(true)
    expect(ev.unit.nameSeed).toBe(0x4321)
    expect(ev.unit.ownerId).toBe(0xdeadbeef)
    expect(ev.unit.stats).toEqual([{ statId: 68, param: 0, value: 50 }])
  })

  it('a minimal monster (flags=0, owner=0, stats=0) has no owner and no stats', () => {
    const bw = new BitWriter()
    bw.writeBits(1, 4)
    bw.writeBit(0)
    bw.writeBit(0)
    bw.writeBit(0)
    bw.writeBit(0)
    const ev = decodeD2gsS2cPacket(pkt0xAC(bw.toUint8Array()), { tables })
    if (ev.type !== 'UnitAssign') throw new Error('expected UnitAssign')
    expect(ev.unit.ownerId).toBeUndefined()
    expect(ev.unit.stats).toBeUndefined()
  })
})
