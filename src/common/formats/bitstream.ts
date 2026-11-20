import { InvalidFieldError, TruncatedDataError } from "./reader.ts";

/**
 * Least-significant-bit-first bit reader for Diablo II's packed sprite
 * containers.
 *
 * Diablo II's `.dcc` files are not byte-aligned anywhere. The direction header
 * ends mid-byte, the per-frame headers that follow are packed at whatever bit
 * width the direction declares, and the four payload streams (equal-cell
 * flags, pixel mask, encoding type, raw pixel codes) are laid out back to back
 * starting at *bit* offsets — a stream that begins at byte 23 bit 6 stays at
 * byte 23 bit 6 for its whole length.
 *
 * That has two consequences a naive reader gets wrong:
 *
 * - The reader's position has to be a bit index, not a byte cursor. Anything
 *   that rounds to a byte boundary shifts every subsequent pixel code.
 * - `copy()` must capture that exact bit position while giving the copy its own
 *   read counter. The DCC decoder clones the reader to walk a sub-stream and
 *   then skips the original past the sub-stream's declared bit length, and it
 *   compares each sub-stream's *own* counter against its declared length as a
 *   sanity check — so the copy must start counting from zero, not inherit the
 *   parent's total.
 *
 * Bits are consumed least-significant-bit first within each byte, which is how
 * the format was packed and what the reference implementation does.
 */

/** Largest single read the format ever needs: a 32-bit header word. */
const MAX_READ_BITS = 32

/**
 * A reader over a byte buffer positioned at a bit offset.
 *
 * Reads past the end of the buffer throw instead of yielding zeroes: a DCC
 * whose streams overrun its own extent is corrupt or mis-parsed, and both cases
 * must be reported rather than silently producing a plausible-looking sprite.
 */
export class BitReader {
  /** The bytes being read. Never copied, so clones share one buffer. */
  private readonly data: Uint8Array
  /** Current position, in bits from the start of `data`. */
  private position: number
  /** Bits consumed by *this* reader, mirroring the reference's per-stream count. */
  private read: number

  /**
   * @param data - the buffer to read.
   * @param bitOffset - starting position in bits (the DCC direction offset is
   *   stored in bytes and scaled by 8 by the caller).
   */
  constructor(data: Uint8Array, bitOffset = 0) {
    if (!Number.isInteger(bitOffset) || bitOffset < 0) {
      throw new Error(`bit offset ${String(bitOffset)} is not a non-negative integer`)
    }
    this.data = data
    this.position = bitOffset
    this.read = 0
  }

  /** The reader's position in bits from the start of the buffer. */
  get bitOffset(): number {
    return this.position
  }

  /**
   * Bits consumed by this reader.
   *
   * A clone starts this count at zero, matching the reference: the DCC decoder
   * uses it to prove each sub-stream was consumed exactly to its declared
   * length.
   *
   * @returns the count.
   */
  bitsRead(): number {
    return this.read
  }

  /**
   * Read one bit.
   *
   * @returns 0 or 1.
   */
  getBit(): number {
    const position = this.position
    if (position >= this.data.length * 8) {
      throw new TruncatedDataError('dcc', 'bit', position >>> 3, 1, 0, this.data.length)
    }
    this.position = position + 1
    this.read += 1
    return ((this.data[position >>> 3] ?? 0) >>> (position & 7)) & 1
  }

  /**
   * Read `count` bits as an unsigned value, low bit first.
   *
   * @param count - 0..32 bits; a count of 0 reads nothing and returns 0, as the
   *   reference does (DCC declares optional field widths as 0 to mean absent).
   * @returns the value, as an unsigned 32-bit number.
   */
  getBits(count: number): number {
    if (count === 0) return 0
    if (count < 0 || count > MAX_READ_BITS || !Number.isInteger(count)) {
      throw new InvalidFieldError('dcc', 'bit count', this.position, count, `0..${String(MAX_READ_BITS)}`)
    }
    const data = this.data
    const start = this.position
    const end = start + count
    if (end > data.length * 8) {
      throw new TruncatedDataError('dcc', 'bits', start >>> 3, Math.ceil(end / 8) - (start >>> 3), data.length - (start >>> 3), data.length)
    }
    let result = 0
    let shift = 0
    let position = start
    // Consume whole or partial bytes; a chunk never straddles more than one
    // byte boundary, so `shift + take <= 32` and nothing is lost to `<<`.
    while (position < end) {
      const bit = position & 7
      const take = Math.min(8 - bit, end - position)
      const chunk = ((data[position >>> 3] ?? 0) >>> bit) & ((1 << take) - 1)
      result |= chunk << shift
      shift += take
      position += take
    }
    this.position = end
    this.read += count
    return result >>> 0
  }

  /**
   * Read one byte.
   *
   * @returns 0..255.
   */
  getByte(): number {
    return this.getBits(8)
  }

  /**
   * Read a little-endian signed 32-bit word.
   *
   * @returns the value.
   */
  getInt32(): number {
    return makeSigned(this.getBits(32), 32)
  }

  /**
   * Read a little-endian unsigned 32-bit word.
   *
   * @returns the value.
   */
  getUint32(): number {
    return this.getBits(32)
  }

  /**
   * Read `count` bits and interpret them as two's-complement signed.
   *
   * @param count - the field width; 0 reads nothing and returns 0.
   * @returns the signed value.
   */
  getSignedBits(count: number): number {
    return makeSigned(this.getBits(count), count)
  }

  /**
   * Advance without reading.
   *
   * Skips are unchecked, as in the reference: the DCC decoder skips past
   * sub-streams it already consumed through a clone, and the last one lands
   * exactly on the end of the payload.
   *
   * @param count - bits to skip.
   */
  skipBits(count: number): void {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`cannot skip ${String(count)} bits`)
    }
    this.position += count
    this.read += count
  }

  /**
   * Clone this reader at the current bit position.
   *
   * The clone shares the buffer, starts with the same bit offset — mid-byte
   * positions included, which is the whole point — and resets its own
   * `bitsRead()` counter to zero.
   *
   * @returns the clone.
   */
  copy(): BitReader {
    return new BitReader(this.data, this.position)
  }
}

/**
 * Interpret a bit field as two's-complement signed, matching the reference's
 * `MakeSigned` exactly: 0 bits is 0, a single bit is 0 or -1 (there is no
 * redundant sign bit to spend), and everything else is sign-extended from the
 * top bit.
 *
 * @param value - the unsigned field, as read.
 * @param bits - the field width.
 * @returns the signed value.
 */
function makeSigned(value: number, bits: number): number {
  if (bits === 0) return 0
  if (bits === 1) return -value
  if (((value >>> 0) & (1 << (bits - 1))) === 0) return value | 0
  // Sign extension is done by subtraction in the unsigned domain, exactly like
  // the reference, so widths above 31 (where JS bitwise ops stay 32-bit) agree.
  let result = 0xffffffff
  for (let i = 0; i < bits; i += 1) {
    if (((value >>> i) & 1) === 0) result = (result - 2 ** i) >>> 0
  }
  return result | 0
}
