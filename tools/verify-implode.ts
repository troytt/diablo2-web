/**
 * End-to-end check of the MPQ decoders against the real Diablo II archives.
 *
 * The whole point of this script is that it refuses to grade its own homework:
 * every assertion is about bytes that came out of a Blizzard archive the user
 * supplied, not about a fixture we also generated.
 *
 * Usage:
 *   node scripts/verify-implode.ts [directory] [--quick] [--archive <name>]
 *
 * Exits non-zero when a codec this project claims to implement fails on real
 * data. Codecs it does not implement yet (ADPCM/Huffmann audio, bzip2, sparse)
 * are reported as *unimplemented*, with counts — never silently ignored, and
 * never counted as a pass.
 */
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { COMPRESSION_PKWARE } from '../src/common/mpq/decompress.ts'

const args = process.argv.slice(2)
const dir = args.find((a) => !a.startsWith('--')) ?? 'samples/d2'
const quick = args.includes('--quick')
const only = args.flatMap((a, i) => (a === '--archive' ? [args[i + 1] ?? ''] : []))
/** Cap per archive in `--quick` mode, so the script is usable in a loop. */
const QUICK_LIMIT = 400

/** Archives this project cares about, in mount order. */
const ARCHIVES = ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq', 'd2char.mpq']

/** Raised classification of one member failure. */
type FailureKind = 'implode' | 'unimplemented-codec' | 'missing-key' | 'other'

/**
 * Classify a member read failure.
 *
 * @param err - the thrown error.
 * @returns the kind, plus a label for the report.
 */
function classify(err: unknown): { kind: FailureKind; label: string } {
  const mask = (err as { mask?: unknown }).mask
  const message = String((err as { message?: unknown }).message ?? err)
  if (typeof mask === 'number') {
    if (mask === COMPRESSION_PKWARE) return { kind: 'implode', label: 'pkware implode' }
    const names: string[] = []
    if (mask & 0x01) names.push('huffmann')
    if (mask & 0x10) names.push('bzip2')
    if (mask & 0x20) names.push('sparse')
    if (mask & 0x40) names.push('adpcm-mono')
    if (mask & 0x80) names.push('adpcm-stereo')
    return { kind: 'unimplemented-codec', label: `mask 0x${mask.toString(16)} (${names.join('+') || 'unknown'})` }
  }
  if (/reversed extent|beyond/.test(message)) return { kind: 'missing-key', label: 'unnamed encrypted member (no name → no key)' }
  return { kind: 'other', label: message.slice(0, 70) }
}

let checks = 0
let hardFailures = 0
let totalMembers = 0
let totalBytes = 0
const unimplemented = new Map<string, number>()

/**
 * Assert one expectation.
 *
 * @param ok - whether it held.
 * @param message - what was checked.
 */
function check(ok: boolean, message: string): void {
  checks += 1
  if (!ok) hardFailures += 1
  console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${message}`)
}

const wanted = only.length > 0 ? only : ARCHIVES
console.log(`== real archives in ${dir} (${String(wanted.length)} selected) ==`)

for (const name of wanted) {
  const path = `${dir}/${name}`
  let archive: MpqArchive
  try {
    archive = await MpqArchive.open(await fileSource(path))
  } catch (err) {
    console.log(`\n-- ${name}\n   skip: ${String(err)}`)
    continue
  }
  const names = await archive.nameIndex()
  let files = archive.files(names)
  if (quick && files.length > QUICK_LIMIT) files = files.slice(0, QUICK_LIMIT)

  let ok = 0
  let bytes = 0
  const local = new Map<string, number>()
  for (const file of files) {
    try {
      const decoded = await archive.read(file)
      ok += 1
      bytes += decoded.byteLength
    } catch (err) {
      const { kind, label } = classify(err)
      if (kind === 'implode' || kind === 'other') hardFailures += 1
      if (kind === 'unimplemented-codec') unimplemented.set(label, (unimplemented.get(label) ?? 0) + 1)
      local.set(`${kind === 'missing-key' ? 'no-key' : kind}: ${label}`, (local.get(`${kind === 'missing-key' ? 'no-key' : kind}: ${label}`) ?? 0) + 1)
    }
  }
  totalMembers += files.length
  totalBytes += bytes
  console.log(`\n-- ${name}`)
  console.log(`   members  ${String(ok)}/${String(files.length)} decoded, ${(bytes / 1048576).toFixed(1)} MB out of ${(archive.header.archiveSize / 1048576).toFixed(1)} MB on disk`)
  for (const [label, count] of [...local].sort((a, b) => b[1] - a[1])) {
    const kind = label.startsWith('implode') || label.startsWith('other') ? 'FAIL' : 'info'
    console.log(`   ${kind.padEnd(4)} ${String(count).padStart(5)}  ${label}`)
  }
  console.log(`   names    ${String(archive.files().length - names.size)} of ${String(archive.files().length)} block slots have no name`)
  check(ok > 0, `${name}: at least one member decoded`)

  // Content assertions: a decoder that produces the right *length* but the wrong
  // bytes would still be useless, so look for known strings in known members.
  const levels = archive.find('data\\global\\excel\\levels.txt')
  if (levels !== undefined) {
    const text = Buffer.from(await archive.read(levels)).toString('latin1')
    check(text.includes('LevelName'), `${name}: levels.txt decodes to a real header row`)
    check(text.includes('Act 1 - Town'), `${name}: levels.txt names the Act 1 town`)
  }
  if (name === 'd2data.mpq') {
    const count = names.size
    check(count > 10_000, `d2data.mpq: (listfile) decodes to ${String(count)} names`)
  }
  if (name === 'd2char.mpq') {
    const so = archive.find('data\\global\\chars\\so\\hd\\sohdbhma11hs.dcc')
    if (so !== undefined) {
      const head = await archive.read(so)
      check(
        head[0] === 0x74 && head[1] === 0x06 && head[2] === 0x10 && head[3] === 0x14,
        'd2char.mpq: a Sorceress DCC begins with the DCC signature',
      )
    }
  }
}

console.log('\n== summary ==')
console.log(`   ${String(totalMembers)} members read, ${(totalBytes / 1048576).toFixed(1)} MB decoded`)
if (unimplemented.size > 0) {
  console.log('   not implemented yet (reported, not counted as pass):')
  for (const [label, count] of [...unimplemented].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${String(count).padStart(5)}  ${label}`)
  }
}
console.log(`   ${String(checks - hardFailures)}/${String(checks)} assertions passed`)
if (hardFailures > 0) {
  console.log(`   ${String(hardFailures)} hard failures: a codec that claims to work did not`)
  process.exit(1)
}
