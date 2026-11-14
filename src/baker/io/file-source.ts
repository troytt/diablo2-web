/**
 * Filesystem-backed source for Node-side tooling.
 *
 * Kept out of `source.ts` on purpose: a static `node:fs/promises` import in a
 * module the browser bundle reaches makes bundlers externalize it and emit a
 * compatibility warning, even though the browser never calls it.
 */
import type { MpqSource } from '../../common/mpq/source.ts'

/**
 * Build a source over a filesystem path.
 *
 * @param path - file path.
 * @returns the source.
 */
export async function fileSource(path: string): Promise<MpqSource> {
  const { open, stat } = await import('node:fs/promises')
  const handle = await open(path, 'r')
  const info = await stat(path)
  return {
    size: info.size,
    label: path,
    read: async (offset, length) => {
      if (offset < 0 || offset + length > info.size) {
        throw new RangeError(`${path}: read ${String(offset)}+${String(length)} beyond ${String(info.size)}`)
      }
      const buffer = new Uint8Array(length)
      let done = 0
      while (done < length) {
        const { bytesRead } = await handle.read(buffer, done, length - done, offset + done)
        if (bytesRead === 0) throw new Error(`${path}: short read at ${String(offset + done)}`)
        done += bytesRead
      }
      return buffer
    },
  }
}
