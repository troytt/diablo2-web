/**
 * PL2 fixture generator.
 *
 * PL2 is purely positional — no header, no counts, no directory — so the only
 * way to test it without a real file is to write the bytes in the documented
 * order and let an independent decoder read them back. Every table gets a
 * pattern that depends on its *global index*, so a table read out of order, or a
 * group with the wrong count, changes the digests the parity harness compares
 * rather than passing silently.
 *
 * Usage: node scripts/make-pl2-fixture.ts <output-directory>
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pl2ExpectedSize } from '../src/common/formats/pl2.ts'

/** Palette entries per transform table. */
const PALETTE_COLORS = 256
/** Groups in file order: name → table count. */
const GROUPS: readonly (readonly [string, number])[] = [
  ['lightLevels', 32],
  ['inverseColors', 16],
  ['selectedUnitShift', 1],
  ['alphaBlend0', 256],
  ['alphaBlend1', 256],
  ['alphaBlend2', 256],
  ['additiveBlend', 256],
  ['multiplyBlend', 256],
  ['hueVariations', 111],
  ['redTones', 1],
  ['greenTones', 1],
  ['blueTones', 1],
  ['unknownVariations', 14],
  ['maxComponentBlend', 256],
  ['darkenedShift', 1],
  ['textShifts', 13],
]

const outDir = process.argv[2]
if (outDir === undefined) {
  console.error('usage: node scripts/make-pl2-fixture.ts <output-directory>')
  process.exit(2)
}
await mkdir(outDir, { recursive: true })

const size = pl2ExpectedSize()
const file = new Uint8Array(size)
let cursor = 0

// Base palette: r, g, b plus an unused byte that is deliberately not zero, so a
// decoder that reads it as colour data (or as alpha) is caught.
for (let index = 0; index < PALETTE_COLORS; index += 1) {
  file[cursor++] = index
  file[cursor++] = (index * 3) & 0xff
  file[cursor++] = (index * 7) & 0xff
  file[cursor++] = 0xab
}

// Transform tables: table `k` maps entry `i` to `(i + k) mod 256`, which makes
// every table distinct and its position observable.
let table = 0
for (const [, count] of GROUPS) {
  for (let index = 0; index < count; index += 1) {
    for (let entry = 0; entry < PALETTE_COLORS; entry += 1) {
      file[cursor++] = (entry + table) & 0xff
    }
    table += 1
  }
}

// Text palette (13 entries, three bytes each).
for (let index = 0; index < 13; index += 1) {
  file[cursor++] = (10 + index) & 0xff
  file[cursor++] = (20 + index) & 0xff
  file[cursor++] = (30 + index) & 0xff
}

if (cursor !== size) {
  throw new Error(`fixture wrote ${String(cursor)} bytes, expected ${String(size)}`)
}

const path = join(outDir, 'fixture.pl2')
await writeFile(path, file)
await writeFile(join(outDir, 'pl2-groups.json'), JSON.stringify(GROUPS, null, 2))
console.log(`wrote ${path} (${String(file.byteLength)} bytes, ${String(table)} transform tables + 13 text shifts)`)
