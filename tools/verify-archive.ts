/**
 * Full-archive verification: decode every named member and check the magic
 * bytes of the formats whose signature is known.
 *
 * A decode that merely returns without throwing proves little, so the checks
 * below assert real structure (RIFF headers, PCX manufacturer bytes, CEL frame
 * counts, palette sizes). Run:
 *   node scripts/verify-archive.ts <archive> [--write <dir>]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'

const [path, ...flags] = process.argv.slice(2)
if (path === undefined) {
  console.error('usage: node scripts/verify-archive.ts <archive> [--write <dir>]')
  process.exit(2)
}
const writeIndex = flags.indexOf('--write')
const outDir = writeIndex === -1 ? undefined : flags[writeIndex + 1]

const archive = await MpqArchive.open(await fileSource(path))
const names = await archive.listFiles()
const byExt = new Map<string, number>()
let decoded = 0
let sizeMismatch = 0
const failures: string[] = []
const magicFails: string[] = []

const ext = (name: string): string => {
  const cut = name.lastIndexOf('.')
  return cut === -1 ? '(none)' : name.slice(cut).toLowerCase()
}

/** Check a decoded member against its format's signature. */
function checkMagic(name: string, data: Uint8Array): void {
  const ascii = (at: number, length: number): string =>
    String.fromCharCode(...data.subarray(at, at + length))
  switch (ext(name)) {
    case '.wav':
      if (data.byteLength < 12 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WAVE') {
        magicFails.push(`${name}: not RIFF/WAVE`)
      }
      break
    case '.pcx':
      if (data.byteLength < 4 || data[0] !== 0x0a || data[2] !== 1) {
        magicFails.push(`${name}: not a PCX (enc=${String(data[2])})`)
      }
      break
    case '.cel': {
      const view = new DataView(data.buffer, data.byteOffset, Math.min(4, data.byteLength))
      const frames = view.getUint32(0, true)
      if (data.byteLength < 8 || frames === 0 || frames > 512) {
        magicFails.push(`${name}: implausible CEL frame count ${String(frames)}`)
      }
      break
    }
    case '.trn':
      if (data.byteLength !== 256) magicFails.push(`${name}: .trn is ${String(data.byteLength)} bytes, expected 256`)
      break
    default:
      break
  }
}

for (const name of names) {
  byExt.set(ext(name), (byExt.get(ext(name)) ?? 0) + 1)
  const file = archive.find(name)
  if (file === undefined) { failures.push(`${name}: hash lookup failed`); continue }
  try {
    const data = await archive.read(file)
    if (data.byteLength !== file.fileSize) {
      sizeMismatch += 1
      failures.push(`${name}: ${String(data.byteLength)} != ${String(file.fileSize)}`)
      continue
    }
    checkMagic(name, data)
    decoded += 1
    if (outDir !== undefined) {
      const target = join(outDir, name.replace(/\\/g, '/'))
      await mkdir(join(target, '..'), { recursive: true })
      await writeFile(target, data)
    }
  } catch (error) {
    failures.push(`${name}: ${(error as Error).message}`)
  }
}

console.log(`archive   ${path}`)
console.log(`named     ${String(names.length)}`)
console.log(`decoded   ${String(decoded)}`)
console.log(`mismatch  ${String(sizeMismatch)}`)
console.log(`failures  ${String(failures.length)}`)
console.log(`magic     ${magicFails.length === 0 ? 'all known signatures OK' : `${String(magicFails.length)} bad`}`)
for (const line of magicFails.slice(0, 10)) console.log(`  ! ${line}`)
for (const line of failures.slice(0, 10)) console.log(`  - ${line}`)
const exts = [...byExt].sort((a, b) => b[1] - a[1]).slice(0, 12)
console.log(`by ext    ${exts.map(([e, n]) => `${e}:${String(n)}`).join('  ')}`)
