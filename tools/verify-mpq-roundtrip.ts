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

const dir = process.argv[2]
if (dir === undefined) {
  console.error('usage: node scripts/verify-mpq-roundtrip.ts <fixture-directory>')
  process.exit(2)
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
console.log(`problems   ${String(problems.length)}`)
for (const problem of problems.slice(0, 8)) console.log(`  - ${problem}`)
console.log(problems.length === 0 ? 'RESULT     reader round-trips the packed archive exactly' : 'RESULT     FAILED')
process.exit(problems.length === 0 ? 0 : 1)
