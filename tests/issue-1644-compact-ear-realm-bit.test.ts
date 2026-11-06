/**
 * Issue #1644: compact ears in the save format must read/write the realm-data bit.
 *
 * 1.13c ground truth (samples/d2/D2Common.dll, `objdump -d -M intel`):
 *  - compact decoder ear path 0x6fd7c1f5..0x6fd7c246 (3-bit class, 7-bit level, 7-bit name) ends with
 *    `jmp 0x6fd7c2d7`, the tail shared with every compact item: quest-difficulty (version > 0x5c) and then,
 *    at 0x6fd7c3e3..0x6fd7c42c, `if (bSave && version > 0x56)` one realm-data bit followed by 2 dwords
 *    (+1 more when version > 0x5d) when it is set.
 */
import { describe, expect, it } from 'vitest'
import { getCanonicalItemDataTables } from '../src/client/world/item-tables-provider.ts'
import { BitWriter } from '../src/netproto/core/bit-writer.ts'
import { decodeItemBitstreamWithLength, encodeItemBitstream } from '../src/netproto/d2gs/items/item-bitstream.ts'
import { ITEM_FLAG_COMPACT, ITEM_FLAG_IDENTIFIED, ITEM_FLAG_ISEAR } from '../src/netproto/d2gs/items/item-types.ts'

const tables = getCanonicalItemDataTables()
const SAVE = { saveFormat: true, expectJmHeader: true } as const
const FLAGS = ITEM_FLAG_IDENTIFIED | ITEM_FLAG_ISEAR | ITEM_FLAG_COMPACT

/** A save-format compact ear exactly as 0x6fd7c0c0 reads it. */
function gameEar(realm: boolean, version = 101): { bytes: Uint8Array; bits: number } {
  const bw = new BitWriter()
  bw.writeBits(0x4d4a, 16) // "JM"
  bw.writeBits(FLAGS, 32)
  bw.writeBits(version, 10)
  bw.writeBits(0, 3) // location: stored
  bw.writeBits(0, 4).writeBits(2, 4).writeBits(1, 4).writeBits(1, 3) // bodyLoc, x, y, page
  bw.writeBits(1, 3) // ear class
  bw.writeBits(50, 7) // ear level
  bw.write7BitString('Bob')
  bw.writeBit(realm ? 1 : 0) // 0x6fd7c3f7
  if (realm) {
    bw.writeBits(0x11111111, 32)
    bw.writeBits(0x22222222, 32)
    if (version > 0x5d) bw.writeBits(0x33333333, 32)
  }
  const bits = bw.bitLength
  bw.alignToByte()
  return { bytes: bw.toUint8Array(), bits }
}

describe('issue #1644: compact ear realm-data bit (D2Common 0x6fd7c2d7 / 0x6fd7c3e3)', () => {
  it('decodes a game-written ear without realm data, consuming the realm bit', () => {
    const { bytes, bits } = gameEar(false)
    const r = decodeItemBitstreamWithLength(bytes, tables, 0, SAVE)
    expect(r.bitLength).toBe(bits)
    expect(r.item.earClass).toBe(1)
    expect(r.item.earLevel).toBe(50)
    expect(r.item.earName).toBe('Bob')
  })

  it('decodes a game-written ear with realm data (3 dwords for version > 0x5d)', () => {
    const { bytes, bits } = gameEar(true)
    expect(decodeItemBitstreamWithLength(bytes, tables, 0, SAVE).bitLength).toBe(bits)
    const old = gameEar(true, 0x5d)
    expect(decodeItemBitstreamWithLength(old.bytes, tables, 0, SAVE).bitLength).toBe(old.bits)
  })

  it('writes the realm bit for ears so the encoder round-trips with the game layout', () => {
    const ear = {
      id: 5, itemId: 5, rawFlags: FLAGS, flags: FLAGS, version: 101, location: 0, container: 'inventory',
      storePage: 1, gridX: 2, gridY: 1, bodyLoc: 0, code: 'ear', rawCode: 'ear ', compact: true, isEar: true,
      earClass: 1, earLevel: 50, earName: 'Bob', identified: true, stats: [], setBonusStats: [], runewordStats: [],
    }
    const bytes = encodeItemBitstream(ear as never, tables, SAVE)
    const expected = gameEar(false)
    expect(Array.from(bytes)).toEqual(Array.from(expected.bytes))
    expect(decodeItemBitstreamWithLength(bytes, tables, 0, SAVE).bitLength).toBe(expected.bits)
  })
})
