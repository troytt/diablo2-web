/**
 * Random-access byte sources for archive reading.
 *
 * Pure isomorphic sources (`MpqSource`, `memorySource`, `windowSource`).
 * Browser-only sources (`blobSource`, `httpRangeSource`) live in `src/client/assets/browser-mpq-source.ts`.
 */

/** Random-access read port consumed by {@link MpqArchive}. */
export interface MpqSource {
  /** Total size in bytes. */
  readonly size: number
  /** Human-readable identity, for diagnostics and error messages. */
  readonly label: string
  /**
   * Read an exact byte range.
   *
   * @param offset - absolute byte offset.
   * @param length - number of bytes; the result is always exactly this long.
   * @returns the requested bytes.
   */
  read(offset: number, length: number): Promise<Uint8Array>
  /**
   * Optional synchronous read of an exact byte range.
   */
  readSync?(offset: number, length: number): Uint8Array
}

/**
 * Build a source over an in-memory buffer (tests, small archives, Node CLI).
 *
 * @param data - the archive bytes.
 * @param label - identity shown in diagnostics.
 * @returns the source.
 */
export function memorySource(data: Uint8Array, label = 'memory'): MpqSource {
  const readSync = (offset: number, length: number): Uint8Array => {
    if (offset < 0 || offset + length > data.byteLength) {
      throw new RangeError(`${label}: read ${String(offset)}+${String(length)} beyond ${String(data.byteLength)}`)
    }
    return data.subarray(offset, offset + length)
  }
  return {
    size: data.byteLength,
    label,
    read: async (offset, length) => readSync(offset, length),
    readSync,
  }
}

/**
 * Build a bounded view over another source, so per-file reads stay inside one file's
 * extent (a corrupt offset table then fails loudly instead of reading into a
 * neighbour).
 *
 * @param source - the underlying source.
 * @param start - window start offset.
 * @param length - window length.
 * @returns the windowed source.
 */
export function windowSource(source: MpqSource, start: number, length: number): MpqSource {
  return {
    size: length,
    label: source.label,
    read: (offset, count) => source.read(start + offset, count),
    ...(source.readSync
      ? { readSync: (offset: number, count: number) => source.readSync!(start + offset, count) }
      : {}),
  }
}
