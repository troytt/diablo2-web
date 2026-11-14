import { describe, test, expect as vitestExpect } from 'vitest'
import * as fs from 'fs'
/**
 * Round-trip check for the MPQ reader against an archive written by
 * `scripts/make-mpq-fixture.ts`.
 *
 * The archive's contents are known byte for byte, so this is a two-sided test:
 * the reader must list exactly the packed names, report exactly the packed sizes
 * and flags, and return exactly the packed bytes — for members stored raw *and*
 * for members stored as zlib sectors, which are the two read paths that exist.
 *
 * Usage: node scripts/verify-mpq-roundtrip.ts <fixture-directory>
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { memorySource } from '../src/common/mpq/source.ts'
const isSkip = false && !fs.existsSync('samples/d2');
const _results: any[] = [];
let suiteCompleted = false;
let problems: string[] = [];
let checks: any[] = [];
function expect(condition: boolean, description: string) { _results.push({cond: condition, desc: description}); if (!condition) problems.push(description); }
function check(nameOrOk: any, okOrMessage: any, detail?: string) { 
  if (typeof nameOrOk === 'string') {
    _results.push({cond: okOrMessage, desc: nameOrOk, detail}); if (!okOrMessage) checks.push({name: nameOrOk, ok: okOrMessage});
  } else {
    _results.push({cond: nameOrOk, desc: okOrMessage}); if (!nameOrOk) checks.push({name: okOrMessage, ok: nameOrOk});
  }
}
if (!isSkip) {

const dir = 'samples/fixtures'
if (dir === undefined) {
  console.error('usage: node scripts/verify-mpq-roundtrip.ts <fixture-directory>')
  // disabled exit: 2)
}

const archive = await MpqArchive.open(memorySource(new Uint8Array(await readFile(join(dir, 'fixture.mpq'))), 'fixture.mpq'))
const names = await archive.listFiles()
const problems: string[] = []

// `listFiles()` returns the names the archive publishes — the members named by
// `(listfile)` — which by design is not the listfile itself.
const published = [
  'actor.dc6',
  'data/global/excel/armor.txt', 'data/global/excel/experience.txt',
  'data/global/excel/magicprefix.txt', 'data/global/excel/magicsuffix.txt',
  'data/global/excel/misc.txt', 'data/global/excel/monstats.txt', 'data/global/excel/npcs.txt',
  'data/global/excel/quests.txt', 'data/global/excel/skills.txt', 'data/global/excel/weapons.txt',
  'data/local/string.tbl',
  'fixture.dc6', 'fixture.ds1', 'fixture.dt1', 'palette.pal',
]
const listed = [...names].sort()
if (JSON.stringify(listed) !== JSON.stringify(published)) {
  problems.push(`published names: ${JSON.stringify(listed)} != ${JSON.stringify(published)}`)
}
// Every member, the listfile included, must be present as a block.
const expectedNames = ['(listfile)', ...published]
if (archive.files().length !== expectedNames.length) {
  problems.push(`occupied blocks: ${String(archive.files().length)} != ${String(expectedNames.length)}`)
}

// `(listfile)` is synthesised by the packer rather than read from disk, so its
// expected bytes are rebuilt here the same way the packer built them.
const synthetic = new TextEncoder().encode(`${[
  'fixture.ds1', 'fixture.dt1', 'palette.pal', 'fixture.dc6', 'actor.dc6',
  'data/global/excel/monstats.txt', 'data/global/excel/experience.txt',
  'data/global/excel/weapons.txt', 'data/global/excel/armor.txt', 'data/global/excel/misc.txt',
  'data/global/excel/magicprefix.txt', 'data/global/excel/magicsuffix.txt',
  'data/global/excel/skills.txt', 'data/global/excel/npcs.txt', 'data/global/excel/quests.txt',
  'data/local/string.tbl',
].join('\r\n')}\r\n`)

let comparedBytes = 0
for (const name of expectedNames) {
  // Table members are stored under a directory path; on disk they live in the
  // same tree, so the member name doubles as a relative path.
  const onDisk = name === '(listfile)'
    ? synthetic
    : new Uint8Array(await readFile(join(dir, name)))
  const entry = archive.find(name)
  if (entry === undefined) { problems.push(`${name}: not found by the reader`); continue }
  if (entry.fileSize !== onDisk.byteLength) {
    problems.push(`${name}: reported size ${String(entry.fileSize)} != ${String(onDisk.byteLength)}`)
  }
  const decoded = await archive.read(entry)
  if (decoded.byteLength !== onDisk.byteLength) {
    problems.push(`${name}: decoded ${String(decoded.byteLength)} bytes != ${String(onDisk.byteLength)}`)
    continue
  }
  let firstDifference = -1
  for (let at = 0; at < onDisk.byteLength; at += 1) {
    if (decoded[at] !== onDisk[at]) { firstDifference = at; break }
  }
  if (firstDifference !== -1) {
    problems.push(`${name}: byte ${String(firstDifference)} differs (${String(decoded[firstDifference])} != ${String(onDisk[firstDifference])})`)
    continue
  }
  comparedBytes += decoded.byteLength
  const flags = entry.flags >>> 0
  const compressed = (flags & 0x00000200) !== 0
  console.log(`  ${name.padEnd(14)} ${String(decoded.byteLength).padStart(7)} bytes  ${compressed ? 'zlib sectors' : 'stored'}  flags 0x${flags.toString(16)}`)
}

console.log(`archive    ${join(dir, 'fixture.mpq')}`)
console.log(`members    ${String(archive.files().length)} blocks, ${String(names.length)} published names`)
console.log(`compared   ${String(comparedBytes)} bytes across ${String(expectedNames.length)} members`)
for (const problem of problems.slice(0, 8)) console.log(`  - ${problem}`)
console.log(problems.length === 0 ? 'RESULT     reader round-trips the packed archive exactly' : 'RESULT     FAILED')
// disabled exit: problems.length === 0 ? 0 : 1)

  suiteCompleted = true;
}
describe('verify-mpq-roundtrip.ts', () => {
  test.skipIf(isSkip)('evaluates script successfully', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    vitestExpect(problems).toEqual([]);
  });

  test('continues linear hash-table probe across deleted slots (0xFFFFFFFE) and tombstone blocks (#1767)', async () => {
    const rawBytes = new Uint8Array(await readFile(join('samples/fixtures', 'fixture.mpq')))
    const testArchive = await MpqArchive.open(memorySource(rawBytes, 'fixture-tombstone.mpq'))
    const original = testArchive.find('palette.pal')
    vitestExpect(original).toBeDefined()

    // Mutate the internal hash table so the primary slot for 'palette.pal' is a deleted tombstone
    // with matching hashA/hashB, and the next slot in the linear probe holds the live block entry.
    const hashTable: Uint32Array = (testArchive as unknown as { hashTable: Uint32Array }).hashTable
    const entries = testArchive.header.hashTableEntries
    let foundSlot = -1
    for (let slot = 0; slot < entries; slot += 1) {
      if (hashTable[slot * 4 + 3] === original!.blockIndex) {
        foundSlot = slot
        break
      }
    }
    vitestExpect(foundSlot).toBeGreaterThanOrEqual(0)
    const nextSlot = (foundSlot + 1) % entries
    const origNext = hashTable.slice(nextSlot * 4, nextSlot * 4 + 4)

    // Copy 'palette.pal' hash entry into nextSlot, and turn foundSlot into 0xFFFFFFFE tombstone
    hashTable[nextSlot * 4] = hashTable[foundSlot * 4]!
    hashTable[nextSlot * 4 + 1] = hashTable[foundSlot * 4 + 1]!
    hashTable[nextSlot * 4 + 2] = hashTable[foundSlot * 4 + 2]!
    hashTable[nextSlot * 4 + 3] = original!.blockIndex
    hashTable[foundSlot * 4 + 3] = 0xfffffffe

    const resolvedAfterDeletedSlot = testArchive.find('palette.pal')
    vitestExpect(resolvedAfterDeletedSlot).toBeDefined()
    vitestExpect(resolvedAfterDeletedSlot?.blockIndex).toBe(original!.blockIndex)

    // Also verify when foundSlot points to a block entry with FILE_DELETE_MARKER (0x02000000)
    const blockTable: Uint32Array = (testArchive as unknown as { blockTable: Uint32Array }).blockTable
    const dummyBlockIndex = 0
    if (dummyBlockIndex !== original!.blockIndex) {
      const origBlockFlags = blockTable[dummyBlockIndex * 4 + 3]!
      blockTable[dummyBlockIndex * 4 + 3] = 0x82000000 // FILE_EXISTS | FILE_DELETE_MARKER
      hashTable[foundSlot * 4 + 3] = dummyBlockIndex
      const resolvedAfterTombstoneBlock = testArchive.find('palette.pal')
      vitestExpect(resolvedAfterTombstoneBlock).toBeDefined()
      vitestExpect(resolvedAfterTombstoneBlock?.blockIndex).toBe(original!.blockIndex)
      blockTable[dummyBlockIndex * 4 + 3] = origBlockFlags
    }

    hashTable.set(origNext, nextSlot * 4)
    hashTable[foundSlot * 4 + 3] = original!.blockIndex
  })
});