/**
 * Issue #808 Step 2a — monster NPC S2C packets carry exactly the `int s[7]` the 1.13c D2Client unit
 * handler builds before 0x6FADA750 → monster command function 0x6FAFDC70.
 *
 * Builders [V D2Client 1.13c]:
 *  - 0x67 (16B) 0x6FB5F460: {x@06, y@08, u8@0A, pathType@0C, i16 vel%@0D, u8@0F, u8@0B}; no drift check.
 *  - 0x68 (21B) 0x6FB5F3F0: {type@0A, id@0B, u8@0F, pathType@11, i16 vel%@12, u8@14, u8@10};
 *    drift check (u16@06, u16@08) at 0x6FB5F441.
 *  - 0x69 (12B) 0x6FB5F390: {x@06, y@08, u8@0A, 2, 0, 4, u8@0B}; no drift check.
 *  - 0x6A (12B) 0x6FB5F340: {type@06, id@07, u8@0B, 2, 0, 4, <uninitialised>}; no drift check.
 *  - 0x6B (16B) 0x6FB5F7C0: drift check (u16@0C, u16@0E) at 0x6FB5F7D7, then the 0x69 builder.
 *  - 0x6C (16B) 0x6FB5F750: drift check (u16@0C, u16@0E) at 0x6FB5F76A, then the 0x6A builder.
 *  - 0x6D (10B) 0x6FB5F2B0: {x@05, y@07, life@09, 2, 0, 4, 0}, cmd 7; drift check at 0x6FB5F304.
 */
import { describe, expect, it } from 'vitest'
import { ByteWriter } from '../../src/netproto/core/byte-writer.ts'
import { decodeD2gsServerPacket } from '../../src/netproto/d2gs/registry.ts'
import {
  decode0x67NpcMove,
  decode0x68NpcMoveToTarget,
  decode0x6DNpcStop,
} from '../../src/netproto/d2gs/s2c/movement.ts'
import { decode0x6CNpcAttack } from '../../src/netproto/d2gs/s2c/skills.ts'
import {
  decode0x69SetNpcMode,
  decode0x6ANpcAction,
  decode0x6BNpcAction2,
} from '../../src/netproto/d2gs/s2c/units.ts'

function npcOf(pkt: Uint8Array): unknown {
  const ev = decodeD2gsServerPacket(pkt) as { npc?: unknown }
  return ev.npc
}

describe('#808 NPC S2C decoders build the D2Client 1.13c s[7]', () => {
  it('0x67 real capture: walk (cmd 1) to (5435,4691), stepnum 1, STRAIGHT (7), 75 %, maxDist 5', () => {
    const pkt = new Uint8Array([
      0x67, 0x06, 0x00, 0x00, 0x00, 0x01, 0x3b, 0x15, 0x53, 0x12, 0x01, 0x00, 0x07, 0x4b, 0x00, 0x05,
    ])
    expect(npcOf(pkt)).toEqual({ opcode: 0x67, cmd: 1, s: [5435, 4691, 1, 7, 75, 5, 0] })
    expect(decodeD2gsServerPacket(pkt)).toMatchObject({
      type: 'UnitMove',
      unitType: 1,
      id: 6,
      mode: 'walk',
      to: { x: 5435, y: 4691 },
      pathType: 7,
      velocityPercent: 75,
    })
  })

  it('0x67 reads @0A and @0B as two separate bytes and the velocity as signed', () => {
    const w = new ByteWriter(16)
    w.u8(0x67)
    w.u32LE(0x1234)
    w.u8(0x17) // run
    w.u16LE(4000)
    w.u16LE(4100)
    w.u8(0x0c) // @0A → s2
    w.u8(0x22) // @0B → s6
    w.u8(2) // @0C path type → s3
    w.i16LE(-3) // @0D → s4 (movsx)
    w.u8(0x10) // @0F → s5
    expect(npcOf(w.toUint8Array())).toEqual({
      opcode: 0x67,
      cmd: 0x17,
      s: [4000, 4100, 0x0c, 2, -3, 0x10, 0x22],
    })
  })

  it('0x68: target type/id in s0/s1, server current position only as the drift-check point', () => {
    const w = new ByteWriter(21)
    w.u8(0x68)
    w.u32LE(88)
    w.u8(0x18) // run
    w.u16LE(5100) // @06 server x
    w.u16LE(5200) // @08 server y
    w.u8(0) // @0A target type
    w.u32LE(0x01020304) // @0B target id
    w.u8(3) // @0F → s2
    w.u8(9) // @10 → s6
    w.u8(2) // @11 path type → s3
    w.i16LE(155) // @12 → s4
    w.u8(7) // @14 → s5
    expect(npcOf(w.toUint8Array())).toEqual({
      opcode: 0x68,
      cmd: 0x18,
      s: [0, 0x01020304, 3, 2, 155, 7, 9],
      driftCheckAt: { x: 5100, y: 5200 },
    })
  })

  it('0x69: {x, y, @0A, 2, 0, 4, @0B} and no drift-check point', () => {
    const w = new ByteWriter(12)
    w.u8(0x69)
    w.u32LE(77)
    w.u8(0x08) // DT
    w.u16LE(5100)
    w.u16LE(5200)
    w.u8(0x11) // @0A
    w.u8(0x05) // @0B (hit class for cmd 6/8)
    expect(npcOf(w.toUint8Array())).toEqual({
      opcode: 0x69,
      cmd: 0x08,
      s: [5100, 5200, 0x11, 2, 0, 4, 0x05],
    })
  })

  it('0x6A: {type, id, @0B, 2, 0, 4, null} — s6 is left uninitialised by 0x6FB5F340', () => {
    const w = new ByteWriter(12)
    w.u8(0x6a)
    w.u32LE(77)
    w.u8(0x0a) // A1 on target
    w.u8(0) // @06 target type
    w.u32LE(1) // @07 target id
    w.u8(0x40) // @0B
    expect(npcOf(w.toUint8Array())).toEqual({
      opcode: 0x6a,
      cmd: 0x0a,
      s: [0, 1, 0x40, 2, 0, 4, null],
    })
  })

  it('0x6B real capture (Charsi): S1 with (0,0) and drift check at (5695,4506)', () => {
    const pkt = new Uint8Array([
      0x6b, 0x08, 0x00, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3f, 0x16, 0x9a, 0x11,
    ])
    expect(npcOf(pkt)).toEqual({
      opcode: 0x6b,
      cmd: 0x0c,
      s: [0, 0, 0, 2, 0, 4, 0],
      driftCheckAt: { x: 5695, y: 4506 },
    })
  })

  it('0x6C: 0x6A layout plus the drift-check point (u16@0C, u16@0E)', () => {
    const w = new ByteWriter(16)
    w.u8(0x6c)
    w.u32LE(300)
    w.u8(0x0a)
    w.u8(0) // @06 target type
    w.u32LE(1) // @07 target id
    w.u8(0x21) // @0B
    w.u16LE(4355) // @0C
    w.u16LE(4531) // @0E
    expect(npcOf(w.toUint8Array())).toEqual({
      opcode: 0x6c,
      cmd: 0x0a,
      s: [0, 1, 0x21, 2, 0, 4, null],
      driftCheckAt: { x: 4355, y: 4531 },
    })
  })

  it('0x6D real capture: cmd 7, s = {x, y, life, 2, 0, 4, 0}, drift check at (x, y)', () => {
    const pkt = new Uint8Array([0x6d, 0x06, 0x00, 0x00, 0x00, 0x3b, 0x15, 0x53, 0x12, 0x80])
    expect(npcOf(pkt)).toEqual({
      opcode: 0x6d,
      cmd: 7,
      s: [5435, 4691, 0x80, 2, 0, 4, 0],
      driftCheckAt: { x: 5435, y: 4691 },
    })
  })

  it('fails fast on any length other than the 1.13c table size', () => {
    const sizes: ReadonlyArray<readonly [number, number, (pkt: Uint8Array) => unknown]> = [
      [0x67, 16, decode0x67NpcMove],
      [0x68, 21, decode0x68NpcMoveToTarget],
      [0x69, 12, decode0x69SetNpcMode],
      [0x6a, 12, decode0x6ANpcAction],
      [0x6b, 16, decode0x6BNpcAction2],
      [0x6c, 16, decode0x6CNpcAttack],
      [0x6d, 10, decode0x6DNpcStop],
    ]
    for (const [opcode, size, decode] of sizes) {
      for (const len of [size - 1, size + 1]) {
        const pkt = new Uint8Array(len)
        pkt[0] = opcode
        const label = `0x${opcode.toString(16)} len ${String(len)}`
        expect(() => decodeD2gsServerPacket(pkt), label).toThrow()
        expect(() => decode(pkt), `${label} (direct)`).toThrow(/expected \d+ bytes/)
      }
    }
  })
})
