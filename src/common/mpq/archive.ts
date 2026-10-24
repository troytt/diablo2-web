/**
 * MPQ archive reader (format v1).
 *
 * Layered like the format itself:
 *   header → encrypted hash table → encrypted block table → per-file sectors.
 * Tables are always encrypted in v1, so opening an archive is a decrypt of
 * two tables; a member read is an offset-table read plus one decrypt (and
 * optionally one decompress) per sector, all through a random-access
 * {@link MpqSource} so a large archive is never held in memory.
 *
 * Classic Diablo/Diablo II archives are v1. v2+ headers (and the v4
 * `MPQ\x1B` container) are rejected explicitly rather than misparsed.
 */
import {
  BLOCK_TABLE_KEY, HASH_NAME_A, HASH_NAME_B, HASH_TABLE_KEY, HASH_TABLE_OFFSET,
  decryptBlock, fileKey, hashString, normalizeName,
} from './crypt.ts'
import { MpqCompressionError, compressionMaskName, decompressSector, decompressSectorSync, COMPRESSION_PKWARE } from './decompress.ts'
import { ImplodeError, explode } from './implode.ts'
import type { MpqSource } from './source.ts'

/** Sector size is `512 << shift`; the shift lives in the header. */
const SECTOR_SIZE_BASE = 512
/** A hash-table entry's `blockIndex` sentinel: the slot never held a file. */
const BLOCK_INDEX_FREE = 0xffffffff

/** `MPQ_FILE_IMPLODE`: PKWARE-imploded file. */
const FILE_IMPLODE = 0x00000100
/** `MPQ_FILE_COMPRESS`: file uses the multi-codec compression mask. */
const FILE_COMPRESS = 0x00000200
/** `MPQ_FILE_ENCRYPTED`: file blocks are encrypted. */
const FILE_ENCRYPTED = 0x00010000
/** `MPQ_FILE_FIX_KEY`: file key is adjusted by offset and size. */
const FILE_FIX_KEY = 0x00020000
/** `MPQ_FILE_SINGLE_UNIT`: file is stored as one unit, with no sector table. */
const FILE_SINGLE_UNIT = 0x01000000
/** `MPQ_FILE_DELETE_MARKER`: tombstone entry. */
const FILE_DELETE_MARKER = 0x02000000
/** `MPQ_FILE_SECTOR_CRC`: one extra sector of checksums follows the offset table. */
const FILE_SECTOR_CRC = 0x04000000
/** `MPQ_FILE_EXISTS`: entry names a real file. */
const FILE_EXISTS = 0x80000000

/** The v1 archive signature. */
const MPQ_MAGIC = 0x1a51504d

/** Parsed archive header (v1 fields). */
export interface MpqHeader {
  /** Header size field as stored. */
  headerSize: number
  /** Declared archive size in bytes. */
  archiveSize: number
  /** Container format version (0 = v1). */
  formatVersion: number
  /** Sector size in bytes, derived from the stored shift. */
  sectorSize: number
  /** Offset of the hash table. */
  hashTableOffset: number
  /** Offset of the block table. */
  blockTableOffset: number
  /** Hash table length in entries. */
  hashTableEntries: number
  /** Block table length in entries. */
  blockTableEntries: number
}

/** One resolved archive member. */
export interface MpqFile {
  /** Normalized (backslash) name this file was found under. */
  readonly name: string
  /** Index of the file's block-table entry. */
  readonly blockIndex: number
  /** Locale field of the hash-table entry. */
  readonly locale: number
  /** Stored offset of the file's first byte. */
  readonly blockOffset: number
  /** Stored size in bytes. */
  readonly compressedSize: number
  /** Uncompressed size in bytes. */
  readonly fileSize: number
  /** Raw flag word. */
  readonly flags: number
}

/** Options for {@link MpqArchive.open}. */
export interface MpqOpenOptions {
  /**
   * Extra names to expose, for archives whose `(listfile)` is missing or
   * incomplete — the normal case for Diablo II's `d2data.mpq`, whose names
   * come from a community listfile.
   */
  listfile?: readonly string[] | undefined
}

/**
 * A readable archive.
 */
export class MpqArchive {
  /** Parsed header of the open archive. */
  readonly header: MpqHeader
  /** Names supplied from outside the archive, when any. */
  private readonly names: readonly string[] | undefined
  /** The underlying byte source. */
  private readonly source: MpqSource
  /** Hash-table words, decrypted. */
  private readonly hashTable: Uint32Array
  /** Block-table words, decrypted. */
  private readonly blockTable: Uint32Array

  private constructor(
    source: MpqSource,
    header: MpqHeader,
    hashTable: Uint32Array,
    blockTable: Uint32Array,
    options: MpqOpenOptions,
  ) {
    this.source = source
    this.header = header
    this.hashTable = hashTable
    this.blockTable = blockTable
    this.names = options.listfile
  }

  /**
   * Open an archive over a random-access source.
   *
   * @param source - byte source positioned at the archive start.
   * @param options - listfile supplement.
   * @returns the open archive.
   */
  static async open(source: MpqSource, options: MpqOpenOptions = {}): Promise<MpqArchive> {
    const head = await source.read(0, 32)
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength)
    const magic = view.getUint32(0, true)
    if (magic !== MPQ_MAGIC) {
      throw new Error(`${source.label}: not an MPQ archive (magic 0x${magic.toString(16)})`)
    }
    const formatVersion = view.getUint16(0x0c, true)
    if (formatVersion !== 0) {
      throw new Error(
        `${source.label}: MPQ format v${String(formatVersion + 1)} is not supported yet (only v1 headers)`,
      )
    }
    const blockSizeShift = view.getUint16(0x0e, true)
    const header: MpqHeader = {
      headerSize: view.getUint32(0x04, true),
      archiveSize: view.getUint32(0x08, true),
      formatVersion,
      sectorSize: SECTOR_SIZE_BASE << blockSizeShift,
      hashTableOffset: view.getUint32(0x10, true),
      blockTableOffset: view.getUint32(0x14, true),
      hashTableEntries: view.getUint32(0x18, true),
      blockTableEntries: view.getUint32(0x1c, true),
    }
    if (header.hashTableEntries === 0 || (header.hashTableEntries & (header.hashTableEntries - 1)) !== 0) {
      throw new Error(`${source.label}: hash table size ${String(header.hashTableEntries)} is not a non-zero power of two`)
    }
    const rawHash = await source.read(header.hashTableOffset, header.hashTableEntries * 16)
    decryptBlock(rawHash, HASH_TABLE_KEY)
    const rawBlock = await source.read(header.blockTableOffset, header.blockTableEntries * 16)
    decryptBlock(rawBlock, BLOCK_TABLE_KEY)
    return new MpqArchive(
      source,
      header,
      wordsOf(rawHash),
      wordsOf(rawBlock),
      options,
    )
  }

  /**
   * Synchronously open an archive over a random-access source that supports `readSync`.
   */
  static openSync(source: MpqSource, options: MpqOpenOptions = {}): MpqArchive {
    if (!source.readSync) {
      throw new Error(`${source.label}: source does not support synchronous readSync`)
    }
    const head = source.readSync(0, 32)
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength)
    const magic = view.getUint32(0, true)
    if (magic !== MPQ_MAGIC) {
      throw new Error(`${source.label}: not an MPQ archive (magic 0x${magic.toString(16)})`)
    }
    const formatVersion = view.getUint16(0x0c, true)
    if (formatVersion !== 0) {
      throw new Error(
        `${source.label}: MPQ format v${String(formatVersion + 1)} is not supported yet (only v1 headers)`,
      )
    }
    const blockSizeShift = view.getUint16(0x0e, true)
    const header: MpqHeader = {
      headerSize: view.getUint32(0x04, true),
      archiveSize: view.getUint32(0x08, true),
      formatVersion,
      sectorSize: SECTOR_SIZE_BASE << blockSizeShift,
      hashTableOffset: view.getUint32(0x10, true),
      blockTableOffset: view.getUint32(0x14, true),
      hashTableEntries: view.getUint32(0x18, true),
      blockTableEntries: view.getUint32(0x1c, true),
    }
    if (header.hashTableEntries === 0 || (header.hashTableEntries & (header.hashTableEntries - 1)) !== 0) {
      throw new Error(`${source.label}: hash table size ${String(header.hashTableEntries)} is not a non-zero power of two`)
    }
    const rawHash = new Uint8Array(source.readSync(header.hashTableOffset, header.hashTableEntries * 16))
    decryptBlock(rawHash, HASH_TABLE_KEY)
    const rawBlock = new Uint8Array(source.readSync(header.blockTableOffset, header.blockTableEntries * 16))
    decryptBlock(rawBlock, BLOCK_TABLE_KEY)
    return new MpqArchive(
      source,
      header,
      wordsOf(rawHash),
      wordsOf(rawBlock),
      options,
    )
  }

  /**
   * Resolve one name.
   *
   * @param name - archive name, either separator.
   * @returns the member, or `undefined` when the archive has no such name.
   */
  find(name: string): MpqFile | undefined {
    const target = normalizeName(name)
    const hashA = hashString(target, HASH_NAME_A)
    const hashB = hashString(target, HASH_NAME_B)
    const start = hashString(target, HASH_TABLE_OFFSET) % this.header.hashTableEntries
    let fallback: MpqFile | undefined
    for (let step = 0; step < this.header.hashTableEntries; step += 1) {
      const slot = (start + step) % this.header.hashTableEntries
      const base = slot * 4
      const entryHashA = this.hashTable[base]!
      const entryHashB = this.hashTable[base + 1]!
      const locale = this.hashTable[base + 2]! & 0xffff
      const blockIndex = this.hashTable[base + 3]!
      if (blockIndex === BLOCK_INDEX_FREE) return fallback
      if (entryHashA !== hashA || entryHashB !== hashB) continue
      const file = this.fileAt(blockIndex, target, locale)
      if (file === undefined) return fallback
      // Neutral locale wins when an archive carries localized duplicates.
      if (locale === 0) return file
      fallback ??= file
    }
    return fallback
  }

  /**
   * Describe one block-table entry.
   *
   * @param blockIndex - index into the block table.
   * @param name - name to attach.
   * @param locale - locale to attach.
   * @returns the member, or `undefined` for a free/tombstone slot.
   */
  private fileAt(blockIndex: number, name: string, locale: number): MpqFile | undefined {
    if (blockIndex >= this.header.blockTableEntries) return undefined
    const base = blockIndex * 4
    const flags = this.blockTable[base + 3]!
    if ((flags & FILE_EXISTS) === 0 || (flags & FILE_DELETE_MARKER) !== 0) return undefined
    return {
      name,
      blockIndex,
      locale,
      blockOffset: this.blockTable[base]!,
      compressedSize: this.blockTable[base + 1]!,
      fileSize: this.blockTable[base + 2]!,
      flags,
    }
  }

  /**
   * Every occupied block-table slot, named where a name is known.
   *
   * Diablo II's `d2data.mpq` carries no `(listfile)`, so the useful way to
   * explore it is by block index; this enumeration keeps that door open.
   *
   * @param names - optional index → name map (e.g. a parsed community listfile).
   * @returns one entry per occupied block-table slot.
   */
  files(names?: ReadonlyMap<number, string>): MpqFile[] {
    const out: MpqFile[] = []
    for (let blockIndex = 0; blockIndex < this.header.blockTableEntries; blockIndex += 1) {
      const name = names?.get(blockIndex)
      const file = this.fileAt(blockIndex, name ?? `block:${String(blockIndex)}`, 0)
      if (file !== undefined) out.push(file)
    }
    return out
  }

  private async decodeSector(body: Uint8Array, expected: number, masked: boolean): Promise<Uint8Array> {
    if (body.byteLength === expected) return body
    if (masked) return decompressSector(body, expected)
    try {
      return explode(body, expected)
    } catch (err) {
      const detail = err instanceof ImplodeError ? err.message : String(err)
      throw new MpqCompressionError(`implode-only member: ${detail}`, COMPRESSION_PKWARE)
    }
  }

  private decodeSectorSync(body: Uint8Array, expected: number, masked: boolean): Uint8Array {
    if (body.byteLength === expected) return body
    if (masked) return decompressSectorSync(body, expected)
    try {
      return explode(body, expected)
    } catch (err) {
      const detail = err instanceof ImplodeError ? err.message : String(err)
      throw new MpqCompressionError(`implode-only member: ${detail}`, COMPRESSION_PKWARE)
    }
  }

  /**
   * Read and decode one member.
   *
   * @param file - a member from {@link find} (or {@link files}).
   * @returns the decoded bytes.
   */
  async read(file: MpqFile): Promise<Uint8Array> {
    const { flags, fileSize, compressedSize, blockOffset, name } = file
    if (fileSize === 0) return new Uint8Array(0)
    const encrypted = (flags & FILE_ENCRYPTED) !== 0
    const singleUnit = (flags & FILE_SINGLE_UNIT) !== 0
    const compressed = (flags & (FILE_COMPRESS | FILE_IMPLODE)) !== 0
    const masked = (flags & FILE_COMPRESS) !== 0
    const key = fileKey(name, blockOffset, fileSize, (flags & FILE_FIX_KEY) !== 0)

    if (singleUnit) {
      const raw = await this.source.read(blockOffset, compressedSize)
      if (encrypted) decryptBlock(raw, key)
      if (!compressed) return raw
      return this.decodeSector(raw, fileSize, masked)
    }

    if (!compressed) {
      const raw = await this.source.read(blockOffset, fileSize)
      if (!encrypted) return raw
      const sectorSize = this.header.sectorSize
      for (let sector = 0; sector * sectorSize < fileSize; sector += 1) {
        const from = sector * sectorSize
        const to = Math.min(from + sectorSize, fileSize)
        decryptBlock(raw.subarray(from, to), (key + sector) >>> 0)
      }
      return raw
    }

    const sectorSize = this.header.sectorSize
    const sectorCount = Math.ceil(fileSize / sectorSize)
    const tableEntries = sectorCount + ((flags & FILE_SECTOR_CRC) !== 0 ? 1 : 0)
    const table = await this.source.read(blockOffset, (tableEntries + 1) * 4)
    if (encrypted) decryptBlock(table, (key - 1) >>> 0)
    const offsets = new DataView(table.buffer, table.byteOffset, table.byteLength)
    const out = new Uint8Array(fileSize)
    for (let sector = 0; sector < sectorCount; sector += 1) {
      const from = offsets.getUint32(sector * 4, true)
      const to = offsets.getUint32((sector + 1) * 4, true)
      if (to < from) {
        throw new MpqCompressionError(
          `${name}: sector ${String(sector)} has a reversed extent (${String(from)}..${String(to)})`,
        )
      }
      const expected = Math.min(sectorSize, fileSize - sector * sectorSize)
      const stored = await this.source.read(blockOffset + from, to - from)
      if (encrypted) decryptBlock(stored, (key + sector) >>> 0)
      const decoded = await this.decodeSector(stored, expected, masked)
      if (decoded.byteLength !== expected) {
        throw new MpqCompressionError(
          `${name}: sector ${String(sector)} decoded ${String(decoded.byteLength)} bytes, expected ${String(expected)}`,
        )
      }
      out.set(decoded, sector * sectorSize)
    }
    return out
  }

  /**
   * Synchronously read and decode one member.
   */
  readSync(file: MpqFile): Uint8Array {
    if (!this.source.readSync) {
      throw new Error(`${this.source.label}: source does not support readSync`)
    }
    const { flags, fileSize, compressedSize, blockOffset, name } = file
    if (fileSize === 0) return new Uint8Array(0)
    const encrypted = (flags & FILE_ENCRYPTED) !== 0
    const singleUnit = (flags & FILE_SINGLE_UNIT) !== 0
    const compressed = (flags & (FILE_COMPRESS | FILE_IMPLODE)) !== 0
    const masked = (flags & FILE_COMPRESS) !== 0
    const key = fileKey(name, blockOffset, fileSize, (flags & FILE_FIX_KEY) !== 0)

    if (singleUnit) {
      const raw = new Uint8Array(this.source.readSync(blockOffset, compressedSize))
      if (encrypted) decryptBlock(raw, key)
      if (!compressed) return raw
      return this.decodeSectorSync(raw, fileSize, masked)
    }

    if (!compressed) {
      const raw = new Uint8Array(this.source.readSync(blockOffset, fileSize))
      if (!encrypted) return raw
      const sectorSize = this.header.sectorSize
      for (let sector = 0; sector * sectorSize < fileSize; sector += 1) {
        const from = sector * sectorSize
        const to = Math.min(from + sectorSize, fileSize)
        decryptBlock(raw.subarray(from, to), (key + sector) >>> 0)
      }
      return raw
    }

    const sectorSize = this.header.sectorSize
    const sectorCount = Math.ceil(fileSize / sectorSize)
    const tableEntries = sectorCount + ((flags & FILE_SECTOR_CRC) !== 0 ? 1 : 0)
    const table = new Uint8Array(this.source.readSync(blockOffset, (tableEntries + 1) * 4))
    if (encrypted) decryptBlock(table, (key - 1) >>> 0)
    const offsets = new DataView(table.buffer, table.byteOffset, table.byteLength)
    const out = new Uint8Array(fileSize)
    for (let sector = 0; sector < sectorCount; sector += 1) {
      const from = offsets.getUint32(sector * 4, true)
      const to = offsets.getUint32((sector + 1) * 4, true)
      if (to < from) {
        throw new MpqCompressionError(
          `${name}: sector ${String(sector)} has a reversed extent (${String(from)}..${String(to)})`,
        )
      }
      const expected = Math.min(sectorSize, fileSize - sector * sectorSize)
      const stored = new Uint8Array(this.source.readSync(blockOffset + from, to - from))
      if (encrypted) decryptBlock(stored, (key + sector) >>> 0)
      const decoded = this.decodeSectorSync(stored, expected, masked)
      if (decoded.byteLength !== expected) {
        throw new MpqCompressionError(
          `${name}: sector ${String(sector)} decoded ${String(decoded.byteLength)} bytes, expected ${String(expected)}`,
        )
      }
      out.set(decoded, sector * sectorSize)
    }
    return out
  }

  /**
   * Read a member by name.
   *
   * @param name - archive name, either separator.
   * @returns the decoded bytes.
   */
  async readByName(name: string): Promise<Uint8Array> {
    const file = this.find(name)
    if (file === undefined) throw new Error(`${this.source.label}: no such file "${name}"`)
    return this.read(file)
  }

  /**
   * Synchronously read a member by name.
   */
  readByNameSync(name: string): Uint8Array {
    const file = this.find(name)
    if (file === undefined) throw new Error(`${this.source.label}: no such file "${name}"`)
    return this.readSync(file)
  }

  /**
   * The names **this archive actually contains**: `(listfile)` when present, plus
   * any supplied external listfile, deduplicated and each verified through the
   * hash table.
   *
   * A community listfile names every retail archive at once, so it cannot be
   * trusted as-is: a name it lists may live in a *different* archive. Filtering by
   * {@link find} is what makes "the archive does not contain this member" a fact
   * rather than a statement about which names happened to be enumerated.
   *
   * @returns the known names, in listfile order.
   */
  async listFiles(): Promise<string[]> {
    const seen = new Set<string>()
    const out: string[] = []
    const push = (name: string): void => {
      const trimmed = name.trim()
      if (trimmed === '' || seen.has(trimmed.toLowerCase())) return
      seen.add(trimmed.toLowerCase())
      if (trimmed === '(listfile)' || this.find(trimmed) !== undefined) out.push(trimmed)
    }
    const internal = this.find('(listfile)')
    if (internal !== undefined) {
      const text = new TextDecoder().decode(await this.read(internal))
      for (const line of text.split(/\r?\n/)) push(line)
    }
    for (const name of this.names ?? []) push(name)
    return out
  }

  /**
   * Map block-table index → name for every name the archive can resolve.
   *
   * A file's encryption key is derived from its *name*, so an anonymous block
   * cannot be decrypted at all; this map is what turns block indices back into
   * readable entries for archives whose listfile is external.
   *
   * @returns the index → name map.
   */
  async nameIndex(): Promise<Map<number, string>> {
    const index = new Map<number, string>()
    for (const name of await this.listFiles()) {
      const file = this.find(name)
      if (file !== undefined && !index.has(file.blockIndex)) index.set(file.blockIndex, file.name)
    }
    return index
  }

  /**
   * Describe the codecs an archive uses across all occupied blocks — the
   * quickest way to see which decoders a given archive actually needs.
   *
   * Blocks that are both encrypted and nameless are counted as `unknown`:
   * their key cannot be derived without the name.
   *
   * @param names - optional index → name map (see {@link nameIndex}).
   * @returns mask name → count.
   */
  async compressionHistogram(names?: ReadonlyMap<number, string>): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    const bump = (name: string): void => { counts.set(name, (counts.get(name) ?? 0) + 1) }
    for (const file of this.files(names)) {
      if (file.fileSize === 0) continue
      const singleUnit = (file.flags & FILE_SINGLE_UNIT) !== 0
      const encrypted = (file.flags & FILE_ENCRYPTED) !== 0
      const compressed = (file.flags & (FILE_COMPRESS | FILE_IMPLODE)) !== 0
      if (!compressed) {
        bump('stored')
        continue
      }
      const named = names?.has(file.blockIndex) ?? !encrypted
      if (!named) {
        bump('unknown (encrypted, unnamed)')
        continue
      }
      const key = fileKey(file.name, file.blockOffset, file.fileSize, (file.flags & FILE_FIX_KEY) !== 0)
      const sectorSize = this.header.sectorSize
      if (singleUnit) {
        const raw = await this.source.read(file.blockOffset, Math.min(file.compressedSize, file.fileSize))
        if (encrypted) decryptBlock(raw, key)
        bump(compressionMaskName(raw[0] ?? 0))
        continue
      }
      const sectorCount = Math.ceil(file.fileSize / sectorSize)
      const tableEntries = sectorCount + ((file.flags & FILE_SECTOR_CRC) !== 0 ? 1 : 0)
      const table = await this.source.read(file.blockOffset, (tableEntries + 1) * 4)
      if (encrypted) decryptBlock(table, (key - 1) >>> 0)
      const offsets = new DataView(table.buffer, table.byteOffset, table.byteLength)
      const from = offsets.getUint32(0, true)
      const to = offsets.getUint32(4, true)
      if (to <= from) continue
      const raw = await this.source.read(file.blockOffset + from, to - from)
      if (encrypted) decryptBlock(raw, key)
      bump(compressionMaskName(raw[0] ?? 0))
    }
    return counts
  }

  /**
   * Count how many members carry each storage flag — the fastest way to see
   * what a given archive will exercise (encryption, single-unit storage, ...).
   *
   * @returns flag name → count.
   */
  flagHistogram(): Map<string, number> {
    const counts = new Map<string, number>()
    const bump = (name: string): void => { counts.set(name, (counts.get(name) ?? 0) + 1) }
    for (const file of this.files()) {
      if (file.fileSize === 0) { bump('empty'); continue }
      bump('total')
      if ((file.flags & FILE_ENCRYPTED) !== 0) bump('encrypted')
      if ((file.flags & FILE_FIX_KEY) !== 0) bump('fix-key')
      if ((file.flags & FILE_SINGLE_UNIT) !== 0) bump('single-unit')
      if ((file.flags & FILE_COMPRESS) !== 0) bump('compressed')
      if ((file.flags & FILE_IMPLODE) !== 0) bump('imploded')
      if ((file.flags & FILE_SECTOR_CRC) !== 0) bump('sector-crc')
    }
    return counts
  }
}

/**
 * Reinterpret a byte buffer as little-endian words.
 *
 * Hash and block tables are arrays of `uint32`; the cipher already produced
 * little-endian bytes, so the view is only for convenience.
 *
 * @param bytes - the decrypted table.
 * @returns the words.
 */
function wordsOf(bytes: Uint8Array): Uint32Array {
  const count = bytes.byteLength >>> 2
  const words = new Uint32Array(count)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = 0; i < count; i += 1) {
    words[i] = view.getUint32(i * 4, true)
  }
  return words
}
