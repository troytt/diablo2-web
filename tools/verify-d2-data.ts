/**
 * Validate the real Diablo II archives dropped into `samples/d2/`.
 *
 * User-supplied game data lives outside version control (`samples/` is
 * ignored), so this script is the only durable record of what is actually on
 * disk. It opens every archive with the project's own reader — the point is to
 * prove this decoder copes with real Blizzard containers, not to trust a
 * third-party tool's opinion.
 *
 * Usage:
 *   node scripts/verify-d2-data.ts [directory]
 *
 * Exits non-zero when a hard expectation fails. A readable `(listfile)` is NOT
 * one of them: Diablo II 1.13 archives compress it with PKWARE implode
 * (`mask 0x8`), which `src/mpq/decompress.ts` does not implement yet, so the
 * failure is reported as a known gap with the exact mask.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { compressionMaskName } from '../src/common/mpq/decompress.ts'

/** Archives the rest of the project expects to find, with why they matter. */
const REQUIRED = new Map([
  ['d2data.mpq', 'classic base data: tiles, sprites, palettes'],
  ['d2exp.mpq', 'expansion data: Act 5, new monsters, expansion tables'],
  ['d2char.mpq', 'character animations (DCC/COF sources)'],
  ['patch_d2.mpq', 'the 1.13 data delta the engine actually mounts'],
  ['d2xmusic.mpq', 'expansion music: Act 5, expansion intro and quest stingers'],
])

const root = process.argv[2] ?? 'samples/d2'

/** Every `.mpq` under `root`, recursively, case-insensitively. */
async function findArchives(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await findArchives(path)))
    else if (entry.name.toLowerCase().endsWith('.mpq')) out.push(path)
  }
  return out.sort()
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

let failures = 0
let checks = 0
const note = (ok: boolean, message: string): void => {
  checks += 1
  if (!ok) failures += 1
  console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${message}`)
}

let archives: string[]
try {
  archives = await findArchives(root)
} catch (err) {
  console.error(`cannot read ${root}: ${String(err)}`)
  process.exit(2)
}

console.log(`== samples/d2 archives (${String(archives.length)} found) ==`)
if (archives.length === 0) {
  console.log('   nothing to check — put the user-supplied MPQs in samples/d2/ first')
  process.exit(0)
}

const seen = new Set<string>()
for (const path of archives) {
  const name = relative(root, path).replaceAll('\\', '/')
  const nameLower = name.toLowerCase()
  const info = await stat(path)
  const digest = await sha256(path)
  console.log(`\n-- ${name}`)
  console.log(`   bytes    ${String(info.size)}`)
  console.log(`   sha256   ${digest}`)
  note(/\.mpq$/i.test(name), 'has the .mpq extension')

  let archive: MpqArchive
  try {
    archive = await MpqArchive.open(await fileSource(path))
  } catch (err) {
    note(false, `opens as an MPQ archive (${String(err)})`)
    continue
  }

  const h = archive.header
  console.log(`   header   v${String(h.formatVersion + 1)} headerSize=${String(h.headerSize)} sectorSize=${String(h.sectorSize)}`)
  console.log(`   tables   hash @${String(h.hashTableOffset)} (${String(h.hashTableEntries)}), block @${String(h.blockTableOffset)} (${String(h.blockTableEntries)})`)
  console.log(`   blocks   ${String(archive.files().length)} occupied slots`)
  console.log(`   flags    ${[...archive.flagHistogram()].map(([k, v]) => `${k}=${String(v)}`).join(', ')}`)

  note(h.formatVersion === 0, 'is an MPQ v1 header (the only format this reader supports)')
  note((h.hashTableEntries & (h.hashTableEntries - 1)) === 0 && h.hashTableEntries > 0, 'hash table size is a non-zero power of two')
  note(h.sectorSize === 4096 || h.sectorSize === 512, `sector size ${String(h.sectorSize)} is plausible`)
  note(
    h.archiveSize === info.size,
    h.archiveSize === info.size
      ? 'header archiveSize matches the file length'
      : `header archiveSize ${String(h.archiveSize)} != file length ${String(info.size)} (trailing data or a truncated copy)`,
  )
  note(archive.files().length > 0, 'at least one occupied block slot')

  if (REQUIRED.has(nameLower)) seen.add(nameLower)

  // Names are the interesting part: does the archive still carry a listfile?
  try {
    const names = await archive.listFiles()
    console.log(`   names    ${String(names.length)} from (listfile)`)
    const sample = names.filter((n) => /\.(dt1|dcc|dc6|tbl|bin|txt|pal|cel)$/i.test(n)).slice(0, 6)
    if (sample.length > 0) console.log(`   sample   ${sample.join(', ')}`)
  } catch (err) {
    const mask = typeof (err as { mask?: unknown }).mask === 'number' ? (err as { mask: number }).mask : undefined
    const label = mask === undefined ? 'unknown' : `mask 0x${mask.toString(16)} ${compressionMaskName(mask)}`
    console.log(`   names    unreadable: ${String(err)}`)
    console.log(`   known gap: (listfile) needs ${label} — not implemented in src/mpq/decompress.ts`)
  }
}

console.log('\n== required data files ==')
for (const [name, why] of REQUIRED) {
  const present = seen.has(name)
  note(present, `${name} present${present ? '' : ` (${why})`}`)
}

console.log(`\n${String(checks - failures)}/${String(checks)} checks passed`)
if (failures > 0) {
  console.log('NOTE: real Diablo II archives are only fully readable once PKWARE implode (mask 0x8) lands;')
  console.log('      listfile gaps above are informational, not counted as failures.')
  process.exit(1)
}
