import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  BncsCreateAccountError,
  BncsCreateAccountStatus,
  BncsFramer,
  BncsOpcode,
  ByteWriter,
  decodeBncsS2cPacket,
  encodeBncsCreateAccount2,
} from '../src/netproto/index.ts'
import { encodeBncsFrame } from '../src/netproto/bncs/framing.ts'

describe('BNCS SID_CREATEACCOUNT2 (0x3D) Packet Encoding & Status Decoding', () => {
  it('defines canonical BncsCreateAccountStatus constants (0x00..0x08)', () => {
    assert.equal(BncsCreateAccountStatus.OK, 0x00)
    assert.equal(BncsCreateAccountStatus.TOO_SHORT, 0x01)
    assert.equal(BncsCreateAccountStatus.INVALID_CHARS, 0x02)
    assert.equal(BncsCreateAccountStatus.BANNED_WORD, 0x03)
    assert.equal(BncsCreateAccountStatus.ALREADY_EXISTS, 0x04)
    assert.equal(BncsCreateAccountStatus.STILL_PROCESSING, 0x05)
    assert.equal(BncsCreateAccountStatus.NOT_ENOUGH_ALPHANUM, 0x06)
    assert.equal(BncsCreateAccountStatus.ADJACENT_PUNCT, 0x07)
    assert.equal(BncsCreateAccountStatus.TOO_MANY_PUNCT, 0x08)
  })

  it('encodes C->S SID_CREATEACCOUNT2 (0x3D) with 20-byte XSHA-1 hash + NUL-terminated username', () => {
    const hash20 = new Uint8Array(20)
    for (let i = 0; i < 20; i++) hash20[i] = (i + 1) & 0xff
    const framed = encodeBncsCreateAccount2('Deckard_Cain', hash20)

    assert.equal(framed[0], 0xff)
    assert.equal(framed[1], BncsOpcode.SID_CREATEACCOUNT2)
    const totalLen = framed[2]! | (framed[3]! << 8)
    assert.equal(totalLen, 4 + 20 + 'Deckard_Cain'.length + 1)
    assert.deepEqual(framed.subarray(4, 24), hash20)
    const nameBytes = framed.subarray(24, totalLen - 1)
    assert.equal(new TextDecoder().decode(nameBytes), 'Deckard_Cain')
    assert.equal(framed[totalLen - 1], 0x00)
  })

  it('decodes S->C SID_CREATEACCOUNT2 (0x3D) across all status codes and optional name suggestions', () => {
    const statuses = [
      BncsCreateAccountStatus.OK,
      BncsCreateAccountStatus.TOO_SHORT,
      BncsCreateAccountStatus.INVALID_CHARS,
      BncsCreateAccountStatus.BANNED_WORD,
      BncsCreateAccountStatus.ALREADY_EXISTS,
      BncsCreateAccountStatus.STILL_PROCESSING,
      BncsCreateAccountStatus.NOT_ENOUGH_ALPHANUM,
      BncsCreateAccountStatus.ADJACENT_PUNCT,
      BncsCreateAccountStatus.TOO_MANY_PUNCT,
    ]

    for (const status of statuses) {
      const suggestion = status === BncsCreateAccountStatus.ALREADY_EXISTS ? 'Deckard_Cain2' : ''
      const w = new ByteWriter()
      w.u32LE(status)
      w.cstring(suggestion)
      const frame = encodeBncsFrame(BncsOpcode.SID_CREATEACCOUNT2, w.toUint8Array())

      const framer = new BncsFramer()
      const rawPackets = framer.push(frame)
      assert.equal(rawPackets.length, 1)

      const decoded = decodeBncsS2cPacket(rawPackets[0]!)
      assert.equal(decoded.type, 'SID_CREATEACCOUNT2')
      if (decoded.type === 'SID_CREATEACCOUNT2') {
        assert.equal(decoded.data.status, status)
        assert.equal(decoded.data.suggestion, suggestion)
        assert.equal(decoded.data.nameSuggestion, suggestion)
      }
    }
  })

  it('constructs BncsCreateAccountError with status, suggestion, and nameSuggestion', () => {
    const err = new BncsCreateAccountError(
      BncsCreateAccountStatus.ALREADY_EXISTS,
      'Tyrael_2',
      'Tyrael',
    )
    assert.equal(err.name, 'BncsCreateAccountError')
    assert.equal(err.status, BncsCreateAccountStatus.ALREADY_EXISTS)
    assert.equal(err.suggestion, 'Tyrael_2')
    assert.equal(err.nameSuggestion, 'Tyrael_2')
    assert.equal(err.conn, 'bncs')
    assert.equal(err.packetId, 0x3d)
  })
})
