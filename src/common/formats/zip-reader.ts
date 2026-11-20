/**
 * Zero-Dependency Pure TypeScript ZIP Reader & Store Writer (`src/common/formats/zip-reader.ts`).
 *
 * Parses and constructs `.d2skin.zip` packages in both browser and headless test environments
 * with zero npm dependencies, zero DOM globals, and zero `node:*` imports (Rules 3 & 4 compliant).
 * Supports ZIP `STORE` (method 0) and `DEFLATE` (method 8 via standard Web `DecompressionStream`).
 */

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50

/** Hard safety cap: 64 MB total extracted bytes per skin archive (prevents zip-bomb attacks). */
export const MAX_SKIN_ZIP_EXTRACTED_BYTES = 64 * 1024 * 1024
export const MAX_SKIN_ZIP_ENTRY_COUNT = 64

const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

export function computeZipCrc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.byteLength; i += 1) {
    c = (CRC32_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)) >>> 0
  }
  return (c ^ 0xffffffff) >>> 0
}

function sanitizeZipEntryPath(rawPath: string): string | null {
  const norm = rawPath.replace(/\\/g, '/').replace(/^\/+/, '').trim()
  if (!norm || norm.endsWith('/')) return null
  const parts = norm.split('/')
  for (const part of parts) {
    if (!part || part === '.' || part === '..') {
      throw new Error(`Unsafe path "${rawPath}" inside .d2skin.zip archive`)
    }
  }
  return parts.join('/')
}

interface MinimalDecompressionStream {
  readonly readable: {
    getReader(): {
      read(): Promise<{ readonly done: boolean; readonly value?: Uint8Array | undefined }>
    }
  }
  readonly writable: {
    getWriter(): {
      write(chunk: Uint8Array): Promise<void>
      close(): Promise<void>
    }
  }
}

async function inflateRawBytes(compressed: Uint8Array, expectedSize: number): Promise<Uint8Array> {
  const DecompCtor = (
    globalThis as {
      readonly DecompressionStream?: new (format: 'deflate-raw') => MinimalDecompressionStream
    }
  ).DecompressionStream
  if (typeof DecompCtor !== 'function') {
    throw new Error('DecompressionStream("deflate-raw") is not available in this runtime')
  }
  const ds = new DecompCtor('deflate-raw')
  const writer = ds.writable.getWriter()
  const writePromise = writer.write(compressed).then(() => writer.close())
  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const step = await reader.read()
    if (step.done) break
    if (step.value) {
      total += step.value.byteLength
      if (total > MAX_SKIN_ZIP_EXTRACTED_BYTES) {
        throw new Error(`ZIP entry exceeds ${String(MAX_SKIN_ZIP_EXTRACTED_BYTES)} byte limit`)
      }
      chunks.push(step.value)
    }
  }
  await writePromise
  if (total !== expectedSize) {
    throw new Error(`ZIP entry size mismatch: expected ${String(expectedSize)} bytes, got ${String(total)}`)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function stripCommonSingleTopDir(files: Map<string, Uint8Array>): Map<string, Uint8Array> {
  if (files.has('skin.json')) return files
  const keys = [...files.keys()]
  if (keys.length === 0) return files
  const firstSlash = keys[0]!.indexOf('/')
  if (firstSlash <= 0) return files
  const prefix = keys[0]!.slice(0, firstSlash + 1)
  if (!keys.every((k) => k.startsWith(prefix))) return files
  const stripped = new Map<string, Uint8Array>()
  for (const [k, v] of files.entries()) {
    const sub = k.slice(prefix.length)
    if (sub.length > 0) stripped.set(sub, v)
  }
  return stripped.has('skin.json') ? stripped : files
}

/**
 * Extract all files from a `.zip` / `.d2skin.zip` archive into an in-memory map
 * keyed by normalized relative forward-slash paths. If all files sit under a single
 * wrapper folder containing `skin.json`, automatically strips that wrapper folder.
 */
export async function extractZipArchive(zipBytes: Uint8Array): Promise<ReadonlyMap<string, Uint8Array>> {
  if (zipBytes.byteLength < 22) {
    throw new Error('Invalid ZIP archive: file is smaller than 22-byte EOCD header')
  }
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength)
  const minEocdOffset = Math.max(0, zipBytes.byteLength - (22 + 0xffff))
  let eocdOffset = -1
  for (let pos = zipBytes.byteLength - 22; pos >= minEocdOffset; pos -= 1) {
    if (view.getUint32(pos, true) === EOCD_SIGNATURE) {
      eocdOffset = pos
      break
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Invalid ZIP archive: End of Central Directory (EOCD) signature not found')
  }

  const entryCount = view.getUint16(eocdOffset + 10, true)
  const cdSize = view.getUint32(eocdOffset + 12, true)
  const cdOffset = view.getUint32(eocdOffset + 16, true)
  if (entryCount > MAX_SKIN_ZIP_ENTRY_COUNT) {
    throw new Error(`ZIP archive has ${String(entryCount)} entries (max ${String(MAX_SKIN_ZIP_ENTRY_COUNT)})`)
  }
  if (cdOffset + cdSize > zipBytes.byteLength) {
    throw new Error('Invalid ZIP archive: central directory exceeds archive bounds')
  }

  const decoder = new TextDecoder('utf-8')
  const files = new Map<string, Uint8Array>()
  let totalExtracted = 0
  let cursor = cdOffset

  for (let i = 0; i < entryCount; i += 1) {
    if (cursor + 46 > zipBytes.byteLength) {
      throw new Error('Invalid ZIP archive: truncated central directory header')
    }
    if (view.getUint32(cursor, true) !== CENTRAL_FILE_HEADER_SIGNATURE) {
      throw new Error('Invalid ZIP archive: bad central directory file header signature')
    }
    const method = view.getUint16(cursor + 10, true)
    const expectedCrc = view.getUint32(cursor + 16, true)
    const compSize = view.getUint32(cursor + 20, true)
    const uncompSize = view.getUint32(cursor + 24, true)
    const nameLen = view.getUint16(cursor + 28, true)
    const extraLen = view.getUint16(cursor + 30, true)
    const commentLen = view.getUint16(cursor + 32, true)
    const localHeaderOffset = view.getUint32(cursor + 42, true)

    const rawName = decoder.decode(zipBytes.subarray(cursor + 46, cursor + 46 + nameLen))
    cursor += 46 + nameLen + extraLen + commentLen

    if (rawName.startsWith('__MACOSX/') || rawName.endsWith('.DS_Store')) {
      continue
    }
    const cleanPath = sanitizeZipEntryPath(rawName)
    if (cleanPath === null) continue

    totalExtracted += uncompSize
    if (totalExtracted > MAX_SKIN_ZIP_EXTRACTED_BYTES) {
      throw new Error(`ZIP archive exceeds ${String(MAX_SKIN_ZIP_EXTRACTED_BYTES)} byte limit`)
    }

    if (localHeaderOffset + 30 > zipBytes.byteLength) {
      throw new Error(`Invalid ZIP archive: local header out of bounds for "${cleanPath}"`)
    }
    if (view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(`Invalid ZIP archive: bad local file header signature for "${cleanPath}"`)
    }
    const localNameLen = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true)
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
    const dataEnd = dataStart + compSize
    if (dataEnd > zipBytes.byteLength) {
      throw new Error(`Invalid ZIP archive: compressed payload out of bounds for "${cleanPath}"`)
    }

    const payload = zipBytes.subarray(dataStart, dataEnd)
    let extracted: Uint8Array
    if (method === 0) {
      if (compSize !== uncompSize) {
        throw new Error(`Invalid STORED ZIP entry "${cleanPath}": size mismatch`)
      }
      extracted = new Uint8Array(payload)
    } else if (method === 8) {
      extracted = await inflateRawBytes(payload, uncompSize)
    } else {
      throw new Error(`Unsupported ZIP compression method ${String(method)} on "${cleanPath}"`)
    }

    const actualCrc = computeZipCrc32(extracted)
    if (actualCrc !== expectedCrc) {
      throw new Error(`CRC-32 mismatch for "${cleanPath}" inside ZIP archive`)
    }
    files.set(cleanPath, extracted)
  }

  return stripCommonSingleTopDir(files)
}

/**
 * Build a deterministic uncompressed (`STORE`, method 0) `.zip` archive from an ordered
 * record/array of `{ path, bytes }` entries. PNG/WebP payloads are already compressed,
 * so `STORE` produces near-identical file sizes with instant zero-overhead packaging.
 */
export function buildStoreZipArchive(
  entries: readonly { readonly path: string; readonly bytes: Uint8Array }[],
): Uint8Array {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0

  for (const entry of entries) {
    const cleanPath = sanitizeZipEntryPath(entry.path)
    if (!cleanPath) {
      throw new Error(`Invalid ZIP entry path "${entry.path}"`)
    }
    const nameBytes = encoder.encode(cleanPath)
    const data = entry.bytes
    const crc = computeZipCrc32(data)

    const localHeader = new Uint8Array(30 + nameBytes.byteLength)
    const lv = new DataView(localHeader.buffer)
    lv.setUint32(0, LOCAL_FILE_HEADER_SIGNATURE, true)
    lv.setUint16(4, 20, true) // version needed: 2.0
    lv.setUint16(6, 0x0800, true) // UTF-8 filename flag
    lv.setUint16(8, 0, true) // method 0 = STORE
    lv.setUint16(10, 0, true) // fixed DOS time (deterministic)
    lv.setUint16(12, 0x21, true) // fixed DOS date 1980-01-01 (deterministic)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.byteLength, true)
    lv.setUint32(22, data.byteLength, true)
    lv.setUint16(26, nameBytes.byteLength, true)
    lv.setUint16(28, 0, true)
    localHeader.set(nameBytes, 30)

    const centralHeader = new Uint8Array(46 + nameBytes.byteLength)
    const cv = new DataView(centralHeader.buffer)
    cv.setUint32(0, CENTRAL_FILE_HEADER_SIGNATURE, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.byteLength, true)
    cv.setUint32(24, data.byteLength, true)
    cv.setUint16(28, nameBytes.byteLength, true)
    cv.setUint16(30, 0, true)
    cv.setUint16(32, 0, true)
    cv.setUint16(34, 0, true)
    cv.setUint16(36, 0, true)
    cv.setUint32(38, 0, true)
    cv.setUint32(42, localOffset, true)
    centralHeader.set(nameBytes, 46)

    localParts.push(localHeader, data)
    centralParts.push(centralHeader)
    localOffset += localHeader.byteLength + data.byteLength
  }

  const cdSize = centralParts.reduce((sum, p) => sum + p.byteLength, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, EOCD_SIGNATURE, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, localOffset, true)
  ev.setUint16(20, 0, true)

  const totalSize = localOffset + cdSize + eocd.byteLength
  const out = new Uint8Array(totalSize)
  let pos = 0
  for (const part of localParts) {
    out.set(part, pos)
    pos += part.byteLength
  }
  for (const part of centralParts) {
    out.set(part, pos)
    pos += part.byteLength
  }
  out.set(eocd, pos)
  return out
}
