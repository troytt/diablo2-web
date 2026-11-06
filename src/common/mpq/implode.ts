/**
 * PKWARE Data Compression Library "implode" decoder.
 *
 * This is the codec behind `MPQ_COMPRESSION_PKWARE` (`mask 0x08`) — and behind
 * every member flagged `MPQ_FILE_IMPLODE` without `MPQ_FILE_COMPRESS`, which is
 * how Diablo II's `Patch_D2.mpq` stores its tables. Without it, real Diablo II
 * archives are unreadable: the container opens and the block table enumerates,
 * but every payload stays compressed.
 *
 * Semantics follow StormLib's `src/pklib/explode.c` (MIT, Copyright (c)
 * Ladislav Zezula); the constant tables were machine-transcribed rather than
 * retyped (see `implode-tables.ts`), so a wrong nibble cannot hide in a table.
 *
 * The stream is bit-oriented: a 16-bit window refills a byte at a time, and each
 * symbol is either a literal (8 raw bits, or a code from the fixed literal
 * alphabet in "ASCII" mode) or a back-reference. Diablo II uses both modes, so
 * both are implemented.
 *
 * Two deliberate departures from the reference:
 *
 * 1. **A back-reference reaching before the start of the output is an error,
 *    not a read of whatever the sliding window held.** The reference keeps a
 *    0x2000-byte window and trusts the encoder to stay in range; here the
 *    history *is* the output, so an out-of-range distance is provably corrupt
 *    input.
 * 2. **The output length is checked, never assumed.** The caller states the
 *    expected size (the archive knows it from the block table) and a stream
 *    that ends short or long throws. Padding with zeros produces a buffer that
 *    decodes into plausible-looking nonsense — the exact failure this project
 *    refuses to ship.
 */
import {
  CHBITSASC, CHCODEASC, DISTBITS, DISTCODE, EXLENBITS, LENBASE, LENBITS, LENCODE,
} from './implode-tables.ts'

/** Compression type byte: literals are raw bytes. */
export const CMP_BINARY = 0
/** Compression type byte: literals come from the fixed ASCII alphabet. */
export const CMP_ASCII = 1

/** `DecodeLit` result meaning "end of stream". */
const LIT_END_OF_STREAM = 0x305
/** `DecodeLit` result meaning "malformed stream". */
const LIT_ERROR = 0x306

/** Raised when an implode stream cannot be decoded. */
export class ImplodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImplodeError'
  }
}

/**
 * Build the "positions" table the decoder probes with the next 8 bits.
 *
 * Each code owns a span of `1 << bits` slots starting at its start index, so the
 * table answers "which code is this prefix" in one indexed read.
 *
 * @param startIndexes - first slot of each code.
 * @param lengthBits - code width in bits.
 * @param elements - number of codes.
 * @returns a 0x100-entry position table.
 */
function generateDecodeTabs(
  startIndexes: readonly number[],
  lengthBits: readonly number[],
  elements: number,
): Uint8Array {
  const positions = new Uint8Array(0x100)
  for (let i = 0; i < elements; i += 1) {
    const length = 1 << (lengthBits[i] ?? 0)
    for (let index = (startIndexes[i] ?? 0); index < 0x100; index += length) positions[index] = i
  }
  return positions
}

/** The literal alphabet's derived tables, built once. */
interface AsciiTables {
  /** Per-character code width, with >8-bit entries rewritten as the reference does. */
  readonly chBits: Uint8Array
  /** First-level literal lookup (8 bits). */
  readonly offs2C34: Uint8Array
  /** Second-level lookup after 4 further bits. */
  readonly offs2D34: Uint8Array
  /** Second-level lookup after 6 further bits. */
  readonly offs2E34: Uint8Array
  /** Lookup used when the next 8 bits are all zero. */
  readonly offs2EB4: Uint8Array
}

/**
 * Derive the literal tables.
 *
 * A literal code wider than 8 bits is split: its low bits index a first-level
 * table that marks the entry as "needs more bits" (`0xff`), and its high bits
 * index a second-level table once 4 or 6 further bits are consumed. The
 * reference rewrites `ChBitsAsc` in place while doing this, which is why the
 * template gets copied here instead of shared.
 *
 * @returns the derived tables.
 */
function buildAsciiTables(): AsciiTables {
  const chBits = Uint8Array.from(CHBITSASC)
  const offs2C34 = new Uint8Array(0x100)
  const offs2D34 = new Uint8Array(0x100)
  const offs2E34 = new Uint8Array(0x100)
  const offs2EB4 = new Uint8Array(0x100)

  for (let count = 0xff; count >= 0; count -= 1) {
    const code = (CHCODEASC[count] ?? 0)
    let bits = (chBits[count] ?? 0)
    if (bits <= 8) {
      for (let acc = code; acc < 0x100; acc += 1 << bits) offs2C34[acc] = count
      continue
    }
    const low = code & 0xff
    if (low === 0) {
      // The whole code sits above the first 8 bits: one second-level table.
      bits -= 8
      chBits[count] = bits
      for (let acc = code >>> 8; acc < 0x100; acc += 1 << bits) offs2EB4[acc] = count
      continue
    }
    offs2C34[low] = 0xff
    if ((code & 0x3f) !== 0) {
      bits -= 4
      chBits[count] = bits
      for (let acc = code >>> 4; acc < 0x100; acc += 1 << bits) offs2D34[acc] = count
    } else {
      bits -= 6
      chBits[count] = bits
      for (let acc = code >>> 6; acc < 0x80; acc += 1 << bits) offs2E34[acc] = count
    }
  }
  return { chBits, offs2C34, offs2D34, offs2E34, offs2EB4 }
}

/** Length-code lookup, shared by every call. */
const LENGTH_CODES = generateDecodeTabs(LENCODE, LENBITS, 0x10)
/** Distance-code lookup, shared by every call. */
const DISTANCE_CODES = generateDecodeTabs(DISTCODE, DISTBITS, 0x40)
/** Literal alphabet tables, shared by every call. */
const ASCII = buildAsciiTables()

/**
 * Bit-oriented reader over one compressed sector.
 *
 * `buffer` holds the next 8..16 bits, low bits first; `extraBits` counts the
 * buffered bits beyond the low 8.
 */
class BitStream {
  /** The compressed bytes. */
  private readonly input: Uint8Array
  /** Compression type byte (0 = binary literals, 1 = ASCII alphabet). */
  readonly ctype: number
  /** Dictionary width in bits (4..6). */
  readonly dsizeBits: number
  /** Position of the next byte to fold into the window. */
  private position = 3
  /** Buffered bits beyond the low 8. */
  private extraBits = 0
  /** The 16-bit window; the format reads past the low 8 bits directly. */
  private buffer: number

  constructor(input: Uint8Array, ctype: number, dsizeBits: number, initial: number) {
    this.input = input
    this.ctype = ctype
    this.dsizeBits = dsizeBits
    this.buffer = initial
  }

  /** Width mask for repetition distances. */
  get dsizeMask(): number {
    return 0xffff >>> (0x10 - this.dsizeBits)
  }

  /** The buffered window; the format reads beyond the low 8 bits directly. */
  peek16(): number {
    return this.buffer
  }

  /** The next 8 bits, without consuming them. */
  peek8(): number {
    return this.buffer & 0xff
  }

  /**
   * Consume `bits` bits.
   *
   * @param bits - bit count (never more than 8 in this format).
   * @returns true when the input ran out before the bits could be taken.
   */
  waste(bits: number): boolean {
    if (bits <= this.extraBits) {
      this.extraBits -= bits
      this.buffer >>>= bits
      return false
    }
    this.buffer >>>= this.extraBits
    if (this.position >= this.input.length) return true
    this.buffer |= (this.input[this.position] ?? 0) << 8
    this.position += 1
    this.buffer >>>= bits - this.extraBits
    const rest = this.extraBits - bits + 8
    if (rest < 0) throw new ImplodeError(`bit buffer underflow taking ${String(bits)} bits`)
    this.extraBits = rest
    return false
  }
}

/**
 * Decode one symbol.
 *
 * @param stream - the bit stream.
 * @returns 0x00..0xff for a literal, `0x100 + (length - 2)` for a repetition,
 *   0x305 at end of stream, 0x306 on a malformed stream.
 */
function decodeLit(stream: BitStream): number {
  if ((stream.peek16() & 1) !== 0) {
    if (stream.waste(1)) return LIT_ERROR
    const lengthCode = (LENGTH_CODES[stream.peek8()] ?? 0)
    if (stream.waste((LENBITS[lengthCode] ?? 0))) return LIT_ERROR
    const extraLengthBits = (EXLENBITS[lengthCode] ?? 0)
    if (extraLengthBits === 0) return lengthCode + 0x100
    const extraLength = stream.peek16() & ((1 << extraLengthBits) - 1)
    // A stream that runs dry here is tolerated for exactly one code — the
    // reference's escape hatch for a final repetition, kept for bit parity.
    if (stream.waste(extraLengthBits) && lengthCode + extraLength !== 0x10e) return LIT_ERROR
    return (LENBASE[lengthCode] ?? 0) + extraLength + 0x100
  }

  if (stream.waste(1)) return LIT_ERROR
  if (stream.ctype === CMP_BINARY) {
    const byte = stream.peek8()
    return stream.waste(8) ? LIT_ERROR : byte
  }

  let value: number
  if (stream.peek8() !== 0) {
    value = (ASCII.offs2C34[stream.peek8()] ?? 0)
    if (value === 0xff) {
      if ((stream.peek16() & 0x3f) !== 0) {
        if (stream.waste(4)) return LIT_ERROR
        value = (ASCII.offs2D34[stream.peek8()] ?? 0)
      } else {
        if (stream.waste(6)) return LIT_ERROR
        value = (ASCII.offs2E34[stream.peek16() & 0x7f] ?? 0)
      }
    }
  } else {
    if (stream.waste(8)) return LIT_ERROR
    value = (ASCII.offs2EB4[stream.peek8()] ?? 0)
  }
  return stream.waste((ASCII.chBits[value] ?? 0)) ? LIT_ERROR : value
}

/**
 * Decode a repetition's backward distance.
 *
 * @param stream - the bit stream.
 * @param repLength - the repetition length already decoded.
 * @returns the distance in bytes (1-based), or 0 when the stream ended.
 */
function decodeDist(stream: BitStream, repLength: number): number {
  const distPosCode = (DISTANCE_CODES[stream.peek8()] ?? 0)
  if (stream.waste((DISTBITS[distPosCode] ?? 0))) return 0
  if (repLength === 2) {
    // Two-byte repetitions carry two extra bits instead of the full dictionary
    // width: the encoder knows a distance in 4..(4*distPosCode+3) range.
    const distance = (distPosCode << 2) | (stream.peek16() & 0x03)
    return stream.waste(2) ? 0 : distance + 1
  }
  const distance = (distPosCode << stream.dsizeBits) | (stream.peek16() & stream.dsizeMask)
  return stream.waste(stream.dsizeBits) ? 0 : distance + 1
}

/**
 * Decode a whole implode stream into exactly `expectedSize` bytes.
 *
 * @param input - the compressed bytes, stream header included.
 * @param expectedSize - the uncompressed length the archive declares.
 * @returns the decoded bytes.
 */
export function explode(input: Uint8Array, expectedSize = 0): Uint8Array {
  if (input.length <= 4) throw new ImplodeError(`implode stream too short (${String(input.length)} bytes)`)
  const ctype = (input[0] ?? 0)
  const dsizeBits = (input[1] ?? 0)
  if (ctype !== CMP_BINARY && ctype !== CMP_ASCII) throw new ImplodeError(`unknown implode mode ${String(ctype)}`)
  if (dsizeBits < 4 || dsizeBits > 6) throw new ImplodeError(`invalid implode dictionary size ${String(dsizeBits)}`)
  const stream = new BitStream(input, ctype, dsizeBits, (input[2] ?? 0))

  let out = new Uint8Array(expectedSize > 0 ? expectedSize : Math.max(4096, input.byteLength * 4))
  let outLen = 0
  for (;;) {
    const literal = decodeLit(stream)
    if (literal === LIT_ERROR) throw new ImplodeError('implode stream ended mid-symbol')
    if (literal === LIT_END_OF_STREAM) break
    if (literal >= 0x100) {
      const repLength = literal - 0xfe
      const minusDist = decodeDist(stream, repLength)
      if (minusDist === 0) throw new ImplodeError('implode stream ended inside a repetition')
      const source = outLen - minusDist
      if (source < 0) {
        throw new ImplodeError(`back-reference ${String(minusDist)} bytes before the start of the output`)
      }
      if (expectedSize > 0 && outLen + repLength > expectedSize) {
        throw new ImplodeError(`output overflow: ${String(outLen + repLength)} > ${String(expectedSize)}`)
      }
      if (outLen + repLength > out.byteLength) {
        let nextCap = out.byteLength * 2
        while (nextCap < outLen + repLength) nextCap *= 2
        const next = new Uint8Array(nextCap)
        next.set(out.subarray(0, outLen), 0)
        out = next
      }
      // Byte at a time on purpose: when the encoder stored a run, the
      // repetition overlaps itself, and that overlap is part of the format.
      for (let i = 0; i < repLength; i += 1) out[outLen + i] = out[source + i]!
      outLen += repLength
    } else {
      if (expectedSize > 0 && outLen >= expectedSize) {
        throw new ImplodeError(`output overflow at byte ${String(outLen)} (expected ${String(expectedSize)})`)
      }
      if (outLen >= out.byteLength) {
        const next = new Uint8Array(out.byteLength * 2)
        next.set(out, 0)
        out = next
      }
      out[outLen] = literal
      outLen += 1
    }
  }
  if (expectedSize > 0 && outLen !== expectedSize) {
    throw new ImplodeError(`decoded ${String(outLen)} bytes, expected ${String(expectedSize)}`)
  }
  return out.subarray(0, outLen)
}

export const explodePkware = explode

