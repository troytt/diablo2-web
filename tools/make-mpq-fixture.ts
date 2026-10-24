/**
 * MPQ fixture packer: write a real MPQ v1 archive containing the generated
 * fixtures.
 *
 * This exists so the *whole* user path can be exercised before any Blizzard data
 * is available: drop an archive in, have the engine open it, list it, decode map
 * members from it, and render a map. It is also the only way to test the
 * reader's stored-member path and its sector logic against something whose
 * contents are known byte for byte.
 *
 * The archive is written to the v1 rules the reader implements: both tables
 * encrypted with their fixed keys, members stored either raw or as zlib sectors
 * with a compression-mask byte per sector, and — deliberately — a mix of both so
 * one archive covers both code paths.
 *
 * This is tooling, not engine code: it is not shipped and not imported by the app.
 *
 * Usage: node scripts/make-mpq-fixture.ts <fixture-directory> [output.mpq]
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  BLOCK_TABLE_KEY, HASH_NAME_A, HASH_NAME_B, HASH_TABLE_KEY, HASH_TABLE_OFFSET,
  encryptBlock, hashString, normalizeName,
} from '../src/common/mpq/crypt.ts'

/** v1 header size in bytes. */
const HEADER_SIZE = 32
/** Archive signature ('MPQ\x1A'). */
const MAGIC = 0x1a51504d
/** Sector size shift: sectors are `512 << shift` bytes. */
const SECTOR_SHIFT = 3
/** Resulting sector size. */
const SECTOR_SIZE = 512 << SECTOR_SHIFT
/** Flag: entry exists. */
const FILE_EXISTS = 0x80000000
/** Flag: member uses the multi-codec compression path (sector table present). */
const FILE_COMPRESS = 0x00000200
/**
 * Flag: member is stored as one unit, with no sector offset table.
 *
 * This is not optional for stored members: a reader that sees neither this flag
 * nor `FILE_COMPRESS` takes the sector path and reads a sector table out of the
 * file's own data. Omitting it produces an archive only a lenient reader can
 * open — which is exactly how this was found, by an independent reader failing
 * on the stored members while the compressed ones read fine.
 */
const FILE_SINGLE_UNIT = 0x01000000
/** Compression mask byte for zlib. */
const MASK_ZLIB = 0x02

/** One member to pack. */
interface Member {
  /** Archive name (either separator). */
  readonly name: string
  /** Contents. */
  readonly data: Uint8Array
  /** Whether to store it through the compressed sector path. */
  readonly compress: boolean
}

/**
 * Deflate one buffer with the platform compressor.
 *
 * @param data - input bytes.
 * @returns the zlib stream.
 */
async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Encode one member's stored bytes and flags.
 *
 * @param member - the member to encode.
 * @returns the stored bytes, stored size, flags and (when compressed) layout.
 */
async function encodeMember(member: Member): Promise<{ stored: Uint8Array; flags: number }> {
  if (!member.compress) {
    // Stored members have no sector offset table at all, which is what
    // SINGLE_UNIT declares.
    return { stored: member.data, flags: (FILE_EXISTS | FILE_SINGLE_UNIT) >>> 0 }
  }
  const sectorCount = Math.max(1, Math.ceil(member.data.byteLength / SECTOR_SIZE))
  const tableSize = (sectorCount + 1) * 4
  const payloads: Uint8Array[] = []
  for (let sector = 0; sector < sectorCount; sector += 1) {
    const from = sector * SECTOR_SIZE
    const raw = member.data.subarray(from, Math.min(from + SECTOR_SIZE, member.data.byteLength))
    const deflated = await deflate(raw)
    // A sector that did not shrink is stored raw, which is what the reader
    // detects by comparing the stored size to the expected size.
    payloads.push(deflated.byteLength < raw.byteLength ? concat([new Uint8Array([MASK_ZLIB]), deflated]) : raw)
  }
  const total = tableSize + payloads.reduce((sum, payload) => sum + payload.byteLength, 0)
  const stored = new Uint8Array(total)
  const view = new DataView(stored.buffer)
  let at = tableSize
  payloads.forEach((payload, sector) => {
    // Offsets are relative to the block start and include the table itself,
    // which is why the first entry equals the table size.
    view.setUint32(sector * 4, at, true)
    stored.set(payload, at)
    at += payload.byteLength
  })
  view.setUint32(sectorCount * 4, total, true)
  return { stored, flags: (FILE_EXISTS | FILE_COMPRESS) >>> 0 }
}

/**
 * Concatenate buffers.
 *
 * @param parts - the buffers.
 * @returns their concatenation.
 */
function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const part of parts) { out.set(part, at); at += part.byteLength }
  return out
}

/**
 * Write an MPQ v1 archive.
 *
 * @param members - members to pack.
 * @returns the archive bytes.
 */
async function writeMpq(members: readonly Member[]): Promise<Uint8Array> {
  const encoded = await Promise.all(members.map(async member => ({
    name: normalizeName(member.name),
    ...await encodeMember(member),
    fileSize: member.data.byteLength,
  })))

  // Lay out the file data first, then the two tables.
  let cursor = HEADER_SIZE
  const placed = encoded.map(entry => {
    const at = cursor
    cursor += entry.stored.byteLength
    return { ...entry, filePos: at }
  })
  const hashTableSize = Math.max(4, nextPowerOfTwo(placed.length * 2))
  const hashTablePos = cursor
  cursor += hashTableSize * 16
  const blockTablePos = cursor
  cursor += placed.length * 16
  const archiveSize = cursor

  const out = new Uint8Array(archiveSize)
  const view = new DataView(out.buffer)
  placed.forEach(entry => { out.set(entry.stored, entry.filePos) })

  // Block table: position, stored size, file size, flags.
  placed.forEach((entry, index) => {
    const at = blockTablePos + index * 16
    view.setUint32(at, entry.filePos, true)
    view.setUint32(at + 4, entry.stored.byteLength, true)
    view.setUint32(at + 8, entry.fileSize, true)
    view.setUint32(at + 12, entry.flags, true)
  })

  // Hash table: one entry per member at its probe position, free slots marked
  // with the 0xFFFFFFFF sentinel the reader stops on.
  const hashTable = new Uint8Array(hashTableSize * 16)
  const hashView = new DataView(hashTable.buffer)
  for (let slot = 0; slot < hashTableSize; slot += 1) {
    hashView.setUint32(slot * 16 + 12, 0xffffffff, true)
  }
  placed.forEach((entry, index) => {
    const hashA = hashString(entry.name, HASH_NAME_A)
    const hashB = hashString(entry.name, HASH_NAME_B)
    let slot = hashString(entry.name, HASH_TABLE_OFFSET) % hashTableSize
    // Linear probing, exactly as the reader walks it.
    while (hashView.getUint32(slot * 16 + 12, true) !== 0xffffffff) slot = (slot + 1) % hashTableSize
    const at = slot * 16
    hashView.setUint32(at, hashA, true)
    hashView.setUint32(at + 4, hashB, true)
    hashView.setUint16(at + 8, 0, true)   // locale
    hashView.setUint16(at + 10, 0, true)  // platform
    hashView.setUint32(at + 12, index, true)
  })
  encryptBlock(hashTable, HASH_TABLE_KEY)

  const blockTable = new Uint8Array(out.subarray(blockTablePos, blockTablePos + placed.length * 16))
  encryptBlock(blockTable, BLOCK_TABLE_KEY)

  out.set(hashTable, hashTablePos)
  out.set(blockTable, blockTablePos)
  view.setUint32(0x00, MAGIC, true)
  view.setUint32(0x04, HEADER_SIZE, true)
  view.setUint32(0x08, archiveSize, true)
  view.setUint16(0x0c, 0, true)          // format version 1
  view.setUint16(0x0e, SECTOR_SHIFT, true)
  view.setUint32(0x10, hashTablePos, true)
  view.setUint32(0x14, blockTablePos, true)
  view.setUint32(0x18, hashTableSize, true)
  view.setUint32(0x1c, placed.length, true)
  return out
}

/**
 * Round a value up to a power of two.
 *
 * @param value - the value.
 * @returns the next power of two.
 */
function nextPowerOfTwo(value: number): number {
  let result = 1
  while (result < value) result *= 2
  return result
}

const dir = process.argv[2]
if (dir === undefined) {
  console.error('usage: node scripts/make-mpq-fixture.ts <fixture-directory> [output.mpq]')
  process.exit(2)
}
const output = process.argv[3] ?? join(dir, 'fixture.mpq')

// The map members are the point; one of them is stored raw so the archive
// exercises both the stored and the compressed read paths.
const names = [
  'fixture.ds1', 'fixture.dt1', 'palette.pal', 'fixture.dc6', 'actor.dc6',
  'data/global/excel/monstats.txt', 'data/global/excel/experience.txt',
  'data/global/excel/weapons.txt', 'data/global/excel/armor.txt', 'data/global/excel/misc.txt',
  'data/global/excel/magicprefix.txt', 'data/global/excel/magicsuffix.txt',
  'data/global/excel/skills.txt', 'data/global/excel/npcs.txt', 'data/global/excel/quests.txt',
  'data/local/string.tbl',
]
const members: Member[] = []
for (const name of names) {
  const data = new Uint8Array(await readFile(join(dir, name)))
  members.push({ name, data, compress: name !== 'palette.pal' })
}
members.push({
  name: '(listfile)',
  data: new TextEncoder().encode(`${names.join('\r\n')}\r\n`),
  compress: false,
})

const archive = await writeMpq(members)
await writeFile(output, archive)
console.log(`wrote ${output} (${String(archive.byteLength)} bytes, ${String(members.length)} members)`)
console.log(`  stored   : ${members.filter(member => !member.compress).map(member => member.name).join(', ')}`)
console.log(`  zlib     : ${members.filter(member => member.compress).map(member => member.name).join(', ')}`)
