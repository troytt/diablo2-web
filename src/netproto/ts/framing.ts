/**
 * Length-prefixed JSON framing for TypeScript authoritative server (`src/netproto/ts/framing.ts`).
 *
 * Preserves `Uint8Array` and `Uint16Array` fields losslessly across JSON serialization.
 */

import { ByteReader } from '../core/byte-reader.ts'
import { ByteWriter } from '../core/byte-writer.ts'
import { ProtocolError } from '../core/errors.ts'
import { decodeText, encodeText } from '../core/text-codec.ts'

export interface SerializedTypedArrayEnvelope {
  readonly __d2TypedArray: 'u8' | 'u16'
  readonly data: readonly number[]
}

function isSerializedTypedArrayEnvelope(val: unknown): val is SerializedTypedArrayEnvelope {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false
  const rec = val as Record<string, unknown>
  return (rec.__d2TypedArray === 'u8' || rec.__d2TypedArray === 'u16') && Array.isArray(rec.data)
}

export function tsJsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { __d2TypedArray: 'u8', data: Array.from(value) } satisfies SerializedTypedArrayEnvelope
  }
  if (value instanceof Uint16Array) {
    return { __d2TypedArray: 'u16', data: Array.from(value) } satisfies SerializedTypedArrayEnvelope
  }
  return value
}

export function tsJsonReviver(_key: string, value: unknown): unknown {
  if (isSerializedTypedArrayEnvelope(value)) {
    return value.__d2TypedArray === 'u8'
      ? new Uint8Array(value.data)
      : new Uint16Array(value.data)
  }
  return value
}

export function encodeTsFrame(obj: unknown): Uint8Array {
  const json = encodeText(JSON.stringify(obj, tsJsonReplacer), 'utf-8')
  const w = new ByteWriter(4 + json.byteLength)
  w.u32LE(json.byteLength)
  w.bytes(json)
  return w.toUint8Array()
}

export class TsFramer<T = unknown> {
  private buf: Uint8Array = new Uint8Array(0)

  push(chunk: Uint8Array): T[] {
    if (chunk.byteLength === 0) return []
    const merged = new Uint8Array(this.buf.byteLength + chunk.byteLength)
    merged.set(this.buf, 0)
    merged.set(chunk, this.buf.byteLength)
    this.buf = merged

    const out: T[] = []
    let offset = 0
    while (offset + 4 <= this.buf.byteLength) {
      const r = new ByteReader(this.buf.subarray(offset, offset + 4))
      const len = r.u32LE()
      if (len === 0 || len > 1024 * 1024) {
        throw new ProtocolError(
          len === 0 ? 'TS frame length cannot be 0' : `TS frame length ${len} exceeds 1MB limit`,
          { proto: 'ts' },
        )
      }
      if (offset + 4 + len > this.buf.byteLength) break
      const jsonText = decodeText(this.buf.subarray(offset + 4, offset + 4 + len), 'utf-8')
      out.push(JSON.parse(jsonText, tsJsonReviver) as T)
      offset += 4 + len
    }
    if (offset > 0) {
      this.buf = this.buf.slice(offset)
    }
    return out
  }

  feed(chunk: Uint8Array): T[] {
    return this.push(chunk)
  }

  get bufferedBytes(): number {
    return this.buf.byteLength
  }
}

