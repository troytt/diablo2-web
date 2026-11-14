/**
 * Pixel-level check for the DT1 decoder.
 *
 * The Go reference package parses DT1 headers correctly but never calls its own
 * graphics decoder, so it cannot serve as a pixel oracle. This closes that gap
 * from the other side: the fixture generator writes down the grid it encoded,
 * and the decoder must reproduce it pixel for pixel — which validates the
 * placement logic (skip runs, row advance, isometric tables, y-offset) rather
 * than merely "did not throw".
 *
 * Usage: node scripts/verify-dt1-pixels.ts <fixture-directory>
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decodeDt1 } from '../src/common/formats/dt1.ts'

interface Expected {
  readonly width: number
  readonly height: number
  readonly tiles: readonly { readonly format: number; readonly base: number; readonly pixels: readonly number[] }[]
}

const dir = process.argv[2]
if (dir === undefined) {
  console.error('usage: node scripts/verify-dt1-pixels.ts <fixture-directory>')
  process.exit(2)
}
const expected = JSON.parse(await readFile(join(dir, 'expected-dt1.json'), 'utf8')) as Expected
const library = decodeDt1(new Uint8Array(await readFile(join(dir, 'fixture.dt1'))))

const problems: string[] = []
expected.tiles.forEach((want, index) => {
  const tile = library.tiles[index]
  if (tile === undefined) { problems.push(`tile ${String(index)} missing`); return }
  const block = tile.blocks[0]
  if (block === undefined) { problems.push(`tile ${String(index)} has no blocks`); return }
  if (block.format !== want.format) problems.push(`tile ${String(index)} format ${String(block.format)} != ${String(want.format)}`)
  let mismatched = 0
  for (let at = 0; at < want.pixels.length; at += 1) {
    if ((block.pixels[at] ?? 0) !== want.pixels[at]) mismatched += 1
  }
  if (mismatched > 0) problems.push(`tile ${String(index)}: ${String(mismatched)} of ${String(want.pixels.length)} pixels differ`)
})

console.log(`fixture    ${join(dir, 'fixture.dt1')}`)
console.log(`tiles      ${String(library.tiles.length)}`)
console.log(`pixels     ${String(expected.tiles.reduce((n, t) => n + t.pixels.length, 0))} compared`)
console.log(`mismatches ${String(problems.length)}`)
for (const problem of problems.slice(0, 8)) console.log(`  - ${problem}`)
console.log(problems.length === 0 ? 'RESULT     every pixel matches the encoded pattern' : 'RESULT     FAILED')
process.exit(problems.length === 0 ? 0 : 1)
