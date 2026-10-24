import { describe, expect, it } from 'vitest'
import { ByteReader } from '../../src/netproto/core/byte-reader.ts'
import { validateC2sPacket } from '../../src/netproto/d2gs/framing-c2s.ts'
import {
  C2S_PACKET_SIZES,
  encodeC2sBeltPut,
  encodeC2sBeltRemove,
  encodeC2sBeltSwap,
  encodeC2sBeltUse,
  encodeC2sCancelController,
  encodeC2sClickButton,
  encodeC2sHostile,
  encodeC2sIdentifyItem,
  encodeC2sMercItem,
  encodeC2sNpcEntityAction,
  encodeC2sNpcMercHire,
  encodeC2sNpcMercResurrect,
  encodeC2sPartyAction,
  encodeC2sQuestMessage,
  encodeC2sResurrect,
  encodeC2sScrollToBook,
  encodeC2sSocketItem,
  encodeC2sSwapContainerItem,
  encodeC2sSwapEquippedItem,
  encodeC2sWarpTo,
  encodeClientCommand,
  type ClientCommand,
} from '../../src/netproto/index.ts'

describe('D2GS C->S 1.13c packet encoders & ClientCommand dispatch (M1)', () => {
  it('encodes all 18 M1 C2S opcodes with exact 1.13c byte layout and C2S_PACKET_SIZES validation', () => {
    // 0x09 WarpTo (9B): [0x09][unitType:u32=5][warpId:u32]
    const pkt09 = encodeC2sWarpTo(101)
    expect(pkt09.byteLength).toBe(C2S_PACKET_SIZES[0x09])
    expect(() => validateC2sPacket(pkt09)).not.toThrow()
    {
      const r = new ByteReader(pkt09)
      expect(r.u8()).toBe(0x09)
      expect(r.u32LE()).toBe(5)
      expect(r.u32LE()).toBe(101)
    }

    // 0x1D SwapEquippedItem (9B): [0x1D][itemId:u32][bodyLoc:u32]
    const pkt1d = encodeC2sSwapEquippedItem(200, 4)
    expect(pkt1d.byteLength).toBe(C2S_PACKET_SIZES[0x1d])
    expect(() => validateC2sPacket(pkt1d)).not.toThrow()

    // 0x1F SwapContainerItem (17B): [0x1F][cursorItemId:u32][replacedItemId:u32][x:u32][y:u32]
    const pkt1f = encodeC2sSwapContainerItem(201, 202, 5, 3)
    expect(pkt1f.byteLength).toBe(C2S_PACKET_SIZES[0x1f])
    expect(() => validateC2sPacket(pkt1f)).not.toThrow()
    {
      const r = new ByteReader(pkt1f)
      expect(r.u8()).toBe(0x1f)
      expect(r.u32LE()).toBe(201)
      expect(r.u32LE()).toBe(202)
      expect(r.u32LE()).toBe(5)
      expect(r.u32LE()).toBe(3)
    }

    // 0x23 BeltPut (9B), 0x24 BeltRemove (5B), 0x25 BeltSwap (9B), 0x26 BeltUse (13B)
    const pkt23 = encodeC2sBeltPut(301, 2)
    const pkt24 = encodeC2sBeltRemove(301)
    const pkt25 = encodeC2sBeltSwap(302, 301)
    const pkt26 = encodeC2sBeltUse(301, true)
    expect(pkt23.byteLength).toBe(C2S_PACKET_SIZES[0x23])
    expect(pkt24.byteLength).toBe(C2S_PACKET_SIZES[0x24])
    expect(pkt25.byteLength).toBe(C2S_PACKET_SIZES[0x25])
    expect(pkt26.byteLength).toBe(C2S_PACKET_SIZES[0x26])
    expect(new DataView(pkt26.buffer).getUint32(5, true)).toBe(1)

    // 0x27 IdentifyItem (9B), 0x28 SocketItem (9B), 0x29 ScrollToBook (9B)
    const pkt27 = encodeC2sIdentifyItem(401, 402)
    const pkt28 = encodeC2sSocketItem(403, 404)
    const pkt29 = encodeC2sScrollToBook(405, 406)
    expect(pkt27.byteLength).toBe(C2S_PACKET_SIZES[0x27])
    expect(pkt28.byteLength).toBe(C2S_PACKET_SIZES[0x28])
    expect(pkt29.byteLength).toBe(C2S_PACKET_SIZES[0x29])

    // 0x31 QuestMessage (9B), 0x36 NpcMercHire (9B), 0x38 NpcEntityAction (13B), 0x62 NpcMercResurrect (5B)
    const pkt31 = encodeC2sQuestMessage(50, 120)
    const pkt36 = encodeC2sNpcMercHire(50, 9)
    const pkt38 = encodeC2sNpcEntityAction(3, 50, 0)
    const pkt62 = encodeC2sNpcMercResurrect(50)
    expect(pkt31.byteLength).toBe(C2S_PACKET_SIZES[0x31])
    expect(pkt36.byteLength).toBe(C2S_PACKET_SIZES[0x36])
    expect(pkt38.byteLength).toBe(C2S_PACKET_SIZES[0x38])
    expect(pkt62.byteLength).toBe(C2S_PACKET_SIZES[0x62])

    // 0x41 Resurrect (1B), 0x48 CancelController (1B), 0x4F ClickButton (7B), 0x5D Hostile (7B), 0x5E PartyAction (6B), 0x61 MercItem (3B)
    const pkt41 = encodeC2sResurrect()
    const pkt48 = encodeC2sCancelController()
    const pkt4f = encodeC2sClickButton(0x02, 0)
    const pkt5d = encodeC2sHostile(77, true)
    const pkt5e = encodeC2sPartyAction(6, 77)
    const pkt61 = encodeC2sMercItem(3)
    expect(pkt41.byteLength).toBe(C2S_PACKET_SIZES[0x41])
    expect(pkt48.byteLength).toBe(C2S_PACKET_SIZES[0x48])
    expect(pkt48[0]).toBe(0x48)
    expect(() => validateC2sPacket(pkt48)).not.toThrow()
    expect(pkt4f.byteLength).toBe(C2S_PACKET_SIZES[0x4f])
    expect(pkt5d.byteLength).toBe(C2S_PACKET_SIZES[0x5d])
    expect(pkt5e.byteLength).toBe(C2S_PACKET_SIZES[0x5e])
    expect(pkt61.byteLength).toBe(C2S_PACKET_SIZES[0x61])
  })

  it('dispatches all M1 ClientCommand variants via encodeClientCommand', () => {
    const commands: ClientCommand[] = [
      { type: 'WarpTo', warpId: 10 },
      { type: 'TakeWarp', warpId: 10 },
      { type: 'SwapContainerItem', cursorItemId: 1, replacedItemId: 2, x: 0, y: 0 },
      { type: 'BeltSwap', cursorItemId: 3, beltItemId: 4 },
      { type: 'ScrollToBook', scrollId: 5, bookId: 6 },
      { type: 'QuestMessage', npcId: 7, messageId: 8 },
      { type: 'MercHire', npcId: 7, mercId: 9 },
      { type: 'NpcEntityAction', action: 1, npcId: 7, complement: 0 },
      { type: 'Resurrect' },
      { type: 'CancelController' },
      { type: 'ClickButton', buttonId: 0x04, amount: 500 },
      { type: 'Hostile', targetPlayerId: 12, hostile: true },
      { type: 'PartyAction', action: 7, targetPlayerId: 12 },
      { type: 'MercItem', slot: 4 },
      { type: 'MercResurrect', npcId: 7 },
    ]

    for (const cmd of commands) {
      const pkts = encodeClientCommand(cmd)
      expect(pkts).toHaveLength(1)
      expect(() => validateC2sPacket(pkts[0]!)).not.toThrow()
    }
  })
})
