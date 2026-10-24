/**
 * S2C 0x5A EventMessages: the netproto decoder (D2Client.dll packet handler 0x6fb5d6b0) returns only the raw
 * packet fields; the TBL message text and colour are built on the client side by the message routine
 * 0x6fb2e200 (`ClientWorld.apply('Chat')` → `formatEventPacket0x5A`, ENG and CHI). This keeps `src/netproto`
 * free of `src/common` imports (tests/arch/boundaries.test.ts Rule 2, tests/netproto/boundary.test.ts).
 */
import { describe, expect, it } from 'vitest'
import { ByteWriter } from '../../src/netproto/core/byte-writer.ts'
import { decodeD2gsS2cPacket, S2C_PACKET_SIZES } from '../../src/netproto/index.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

function eventPacket0x5A(fields: {
  eventType: number
  color: number
  arg: number
  subType: number
  name1: string
  name2: string
}): Uint8Array {
  const w = new ByteWriter(40)
  w.u8(0x5a)
  w.u8(fields.eventType)
  w.u8(fields.color)
  w.u32LE(fields.arg)
  w.u8(fields.subType)
  w.fixedCString(fields.name1, 16)
  w.fixedCString(fields.name2, 16)
  return w.toUint8Array()
}

describe('S2C 0x5A EventMessages: raw decode (0x6fb5d6b0), client-side formatting (0x6fb2e200)', () => {
  it('decodes the 40-byte packet into raw fields only (no formatted text, raw colour)', () => {
    expect(S2C_PACKET_SIZES[0x5a]).toBe(40)
    const pkt = eventPacket0x5A({ eventType: 0x02, color: 0, arg: 7, subType: 3, name1: 'Paladin', name2: 'pal_acc' })
    expect(pkt.byteLength).toBe(40)
    const ev = decodeD2gsS2cPacket(pkt)
    expect(ev).toEqual({
      type: 'Chat',
      kind: 'event',
      from: 'Paladin',
      text: '',
      color: 0,
      eventType: 0x02,
      arg: 7,
      subType: 3,
      name1: 'Paladin',
      name2: 'pal_acc',
    })
  })

  it('ClientWorld formats the decoded event in ENG and CHI with the 0x6fb2e200 colour', () => {
    const joined = decodeD2gsS2cPacket(
      eventPacket0x5A({ eventType: 0x02, color: 0, arg: 0, subType: 0, name1: 'Paladin', name2: 'pal_acc' }),
    )
    const world = new ClientWorld()
    world.lang = 'ENG'
    world.apply(joined, 1_000)
    const en = world.messageLogEntries.at(-1)
    expect(en?.kind).toBe('event')
    expect(en?.text).toBe("Paladin(pal_acc) joined our world. Diablo's minions grow stronger.")
    expect(en?.formattedEn).toBe("Paladin(pal_acc) joined our world. Diablo's minions grow stronger.")
    expect(en?.formattedZh).toBe('Paladin（pal_acc）進入了我們的世界。暗黑破壞神的嘍囉又更強了。')
    // Event 0x02 forces colour 4 (gold) whatever the packet carries.
    expect(en?.color).toBe(4)

    world.lang = 'CHI'
    const slain = decodeD2gsS2cPacket(
      eventPacket0x5A({ eventType: 0x06, color: 1, arg: 0, subType: 0, name1: 'Amazon', name2: 'Andariel' }),
    )
    expect(slain).toMatchObject({ text: '', color: 1 })
    world.apply(slain, 2_000)
    const zh = world.messageLogEntries.at(-1)
    expect(zh?.text).toBe('Amazon死亡，殺死他的是Andariel')
    expect(zh?.formattedEn).toBe('Amazon was slain by Andariel')
    // Event 0x06 keeps the packet colour.
    expect(zh?.color).toBe(1)
  })
})
