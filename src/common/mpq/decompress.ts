/**
 * MPQ sector decompression.
 *
 * A compressed sector starts with one mask byte naming the codecs applied to
 * the payload; combined masks (e.g. `HUFFMANN | ADPCM_MONO` on Diablo's WAV
 * data) are unwound in the fixed order below, which is the order StormLib
 * applies them in.
 *
 * zlib needs no code of its own: `DecompressionStream('deflate')` is the
 * platform decoder, present in browsers and in Node. PKWARE implode needed real
 * code — Diablo II stores almost every table and asset with it — so it lives in
 * `implode.ts` and is called here.
 */

import { ImplodeError, explode } from './implode.ts';
import { decompressHuffman } from './huffman.ts';
import { decompressAdpcm } from './adpcm.ts';

/** Codec bit: adaptive Huffmann (FGK variant). */
export const COMPRESSION_HUFFMANN = 0x01
/** Codec bit: zlib/deflate. */
export const COMPRESSION_ZLIB = 0x02
/** Codec bit: PKWARE Data Compression Library implode. */
export const COMPRESSION_PKWARE = 0x08
/** Codec bit: bzip2. */
export const COMPRESSION_BZIP2 = 0x10
/** Codec bit: sparse (run-length + mask bytes). */
export const COMPRESSION_SPARSE = 0x20
/** Codec bit: ADPCM, mono, 4-bit. */
export const COMPRESSION_ADPCM_MONO = 0x40
/** Codec bit: ADPCM, stereo, 4-bit. */
export const COMPRESSION_ADPCM_STEREO = 0x80

/** Raised when a sector cannot be decoded. */
export class MpqCompressionError extends Error {
  /** The compression mask that failed, when known. */
  readonly mask: number | undefined

  /**
   * @param message - human-readable failure.
   * @param mask - the compression mask that failed, when known.
   */
  constructor(message: string, mask?: number) {
    super(message)
    this.name = 'MpqCompressionError'
    this.mask = mask
  }
}

/**
 * Name the codecs a mask selects, for diagnostics.
 *
 * @param mask - the compression mask byte.
 * @returns a `+`-joined list, or `stored` for an empty mask.
 */
export function compressionMaskName(mask: number): string {
  const parts: string[] = []
  if (mask & COMPRESSION_HUFFMANN) parts.push('huffmann')
  if (mask & COMPRESSION_ZLIB) parts.push('zlib')
  if (mask & COMPRESSION_PKWARE) parts.push('pkware')
  if (mask & COMPRESSION_BZIP2) parts.push('bzip2')
  if (mask & COMPRESSION_SPARSE) parts.push('sparse')
  if (mask & COMPRESSION_ADPCM_MONO) parts.push('adpcm-mono')
  if (mask & COMPRESSION_ADPCM_STEREO) parts.push('adpcm-stereo')
  return parts.length === 0 ? 'stored' : parts.join('+')
}

/**
 * Inflate one zlib stream.
 *
 * @param data - zlib-wrapped deflate bytes.
 * @returns the inflated bytes.
 */
async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Decode one compressed sector payload (mask byte included).
 *
 * @param input - the stored sector bytes, mask byte first.
 * @param expectedSize - the sector's uncompressed length.
 * @returns the decoded sector.
 */
export async function decompressSector(input: Uint8Array, expectedSize: number): Promise<Uint8Array> {
  if (input.byteLength === 0) return input
  const mask = input[0]
  if (mask === undefined) throw new Error('Truncated sector')
  if (mask === 0) {
    // A zero mask marks a stored payload that merely carried the marker byte.
    return input.subarray(1, 1 + expectedSize)
  }
  let current: Uint8Array = input.subarray(1)
  let remaining = mask

  if (remaining & COMPRESSION_ZLIB) {
    current = await inflateZlib(current)
    remaining &= ~COMPRESSION_ZLIB
  }
  if (remaining & COMPRESSION_PKWARE) {
    // PKWARE is the last codec before bzip2/sparse/ADPCM in the reference
    // order, so the payload it sees is already at its final length.
    try {
      current = explode(current, expectedSize)
    } catch (err) {
      const detail = err instanceof ImplodeError ? err.message : String(err)
      throw new MpqCompressionError(`pkware implode failed: ${detail} (mask 0x${mask.toString(16)})`, mask)
    }
    remaining &= ~COMPRESSION_PKWARE
  }
  if (remaining & COMPRESSION_BZIP2) {
    throw new MpqCompressionError(`bzip2 decoder not implemented yet (mask 0x${mask.toString(16)})`, mask)
  }
  if (remaining & COMPRESSION_SPARSE) {
    throw new MpqCompressionError(`sparse decoder not implemented yet (mask 0x${mask.toString(16)})`, mask)
  }
  if (remaining & COMPRESSION_HUFFMANN) {
    try {
      current = decompressHuffman(current, expectedSize)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new MpqCompressionError(`huffman failed: ${detail} (mask 0x${mask.toString(16)})`, mask)
    }
    remaining &= ~COMPRESSION_HUFFMANN
  }
  if (remaining & COMPRESSION_ADPCM_STEREO) {
    try {
      current = decompressAdpcm(current, expectedSize, 2)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new MpqCompressionError(`adpcm stereo failed: ${detail} (mask 0x${mask.toString(16)})`, mask)
    }
    remaining &= ~COMPRESSION_ADPCM_STEREO
  }
  if (remaining & COMPRESSION_ADPCM_MONO) {
    try {
      current = decompressAdpcm(current, expectedSize, 1)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new MpqCompressionError(`adpcm mono failed: ${detail} (mask 0x${mask.toString(16)})`, mask)
    }
    remaining &= ~COMPRESSION_ADPCM_MONO
  }
  if (remaining !== 0) {
    throw new MpqCompressionError(`unknown compression bits 0x${remaining.toString(16)} (mask 0x${mask.toString(16)})`, mask)
  }
  if (current.byteLength !== expectedSize) {
    throw new MpqCompressionError(
      `decoded ${String(current.byteLength)} bytes, expected ${String(expectedSize)} (mask 0x${mask.toString(16)})`,
      mask,
    )
  }
  return current
}

/**
 * Synchronous sector decompression for non-zlib MPQ sectors (PKWARE implode, Huffman, ADPCM, stored).
 */
export function decompressSectorSync(input: Uint8Array, expectedSize: number): Uint8Array {
  if (input.byteLength === 0) return input
  const mask = input[0]
  if (mask === undefined) throw new Error('Truncated sector')
  if (mask === 0) {
    return input.subarray(1, 1 + expectedSize)
  }
  let current: Uint8Array = input.subarray(1)
  let remaining = mask

  if (remaining & COMPRESSION_ZLIB) {
    throw new MpqCompressionError(`zlib requires async decompressSector (mask 0x${mask.toString(16)})`, mask)
  }
  if (remaining & COMPRESSION_PKWARE) {
    try {
      current = explode(current, expectedSize)
    } catch (err) {
      const detail = err instanceof ImplodeError ? err.message : String(err)
      throw new MpqCompressionError(`pkware implode failed: ${detail} (mask 0x${mask.toString(16)})`, mask)
    }
    remaining &= ~COMPRESSION_PKWARE
  }
  if (remaining & COMPRESSION_BZIP2) {
    throw new MpqCompressionError(`bzip2 decoder not implemented yet (mask 0x${mask.toString(16)})`, mask)
  }
  if (remaining & COMPRESSION_SPARSE) {
    throw new MpqCompressionError(`sparse decoder not implemented yet (mask 0x${mask.toString(16)})`, mask)
  }
  if (remaining & COMPRESSION_HUFFMANN) {
    try {
      current = decompressHuffman(current, expectedSize)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new MpqCompressionError(`huffman failed: ${detail} (mask 0x${mask.toString(16)})`, mask)
    }
    remaining &= ~COMPRESSION_HUFFMANN
  }
  if (remaining & COMPRESSION_ADPCM_STEREO) {
    try {
      current = decompressAdpcm(current, expectedSize, 2)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new MpqCompressionError(`adpcm stereo failed: ${detail} (mask 0x${mask.toString(16)})`, mask)
    }
    remaining &= ~COMPRESSION_ADPCM_STEREO
  }
  if (remaining & COMPRESSION_ADPCM_MONO) {
    try {
      current = decompressAdpcm(current, expectedSize, 1)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new MpqCompressionError(`adpcm mono failed: ${detail} (mask 0x${mask.toString(16)})`, mask)
    }
    remaining &= ~COMPRESSION_ADPCM_MONO
  }
  if (remaining !== 0) {
    throw new MpqCompressionError(`unknown compression bits 0x${remaining.toString(16)} (mask 0x${mask.toString(16)})`, mask)
  }
  if (current.byteLength !== expectedSize) {
    throw new MpqCompressionError(
      `decoded ${String(current.byteLength)} bytes, expected ${String(expectedSize)} (mask 0x${mask.toString(16)})`,
      mask,
    )
  }
  return current
}

