/**
 * Self-check for the DC6 decoder against the generated fixture.
 *
 * This proves the decoder and the encoder agree; it does *not* prove the
 * format understanding is right. That second claim is what
 * `scripts/verify-dc6.sh` establishes, by having the independent `dc6png`
 * decoder read the same fixture and produce the same image.
 *
 * Usage: node scripts/verify-dc6.ts <fixture-directory>
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decodeDc6 } from '../src/common/formats/dc6.ts'

interface ExpectedFrame {
  readonly width: number
  readonly height: number
  readonly rows: readonly (readonly number[])[]
}
interface Expected {
  readonly directions: number
  readonly framesPerDirection: number
  readonly frames: readonly (readonly ExpectedFrame[])[]
}

const dir = process.argv[2]
if (dir === undefined) {
  console.error('usage: node scripts/verify-dc6.ts <fixture-directory>')
  process.exit(2)
}

const expected = JSON.parse(await readFile(join(dir, 'expected.json'), 'utf8')) as Expected
const sheet = decodeDc6(new Uint8Array(await readFile(join(dir, 'fixture.dc6'))))

const problems: string[] = []
if (sheet.header.directions !== expected.directions) {
  problems.push(`directions: ${String(sheet.header.directions)} != ${String(expected.directions)}`)
}
if (sheet.header.framesPerDirection !== expected.framesPerDirection) {
  problems.push(`frames per direction: ${String(sheet.header.framesPerDirection)} != ${String(expected.framesPerDirection)}`)
}
if (sheet.header.version !== 6) problems.push(`version: ${String(sheet.header.version)} != 6`)

let frames = 0
for (let direction = 0; direction < expected.directions; direction += 1) {
  const group = sheet.groups[direction]
  if (group === undefined) { problems.push(`direction ${String(direction)} missing`); continue }
  for (let frameIndex = 0; frameIndex < expected.framesPerDirection; frameIndex += 1) {
    const want = expected.frames[direction]?.[frameIndex]
    const got = group.frames[frameIndex]
    if (want === undefined || got === undefined) { problems.push(`frame ${String(direction)}/${String(frameIndex)} missing`); continue }
    frames += 1
    if (got.width !== want.width || got.height !== want.height) {
      problems.push(`frame ${String(direction)}/${String(frameIndex)} size ${String(got.width)}x${String(got.height)} != ${String(want.width)}x${String(want.height)}`)
      continue
    }
    for (let y = 0; y < want.height; y += 1) {
      for (let x = 0; x < want.width; x += 1) {
        const at = y * want.width + x
        const wantIndex = want.rows[y]?.[x] ?? 0
        const gotIndex = got.indices[at] ?? 0
        const wantOpaque = wantIndex === 0 ? 0 : 1
        if (gotIndex !== wantIndex || (got.mask[at] ?? 0) !== wantOpaque) {
          problems.push(`frame ${String(direction)}/${String(frameIndex)} px ${String(x)},${String(y)}: index ${String(gotIndex)}/mask ${String(got.mask[at] ?? 0)} != ${String(wantIndex)}/${String(wantOpaque)}`)
        }
      }
    }
    // Placement fields travel through untouched.
    if (got.offsetX !== direction * 4 + frameIndex * 22 + 1 || got.offsetY !== -(direction * 4 + frameIndex * 22 + 1)) {
      problems.push(`frame ${String(direction)}/${String(frameIndex)} anchors ${String(got.offsetX)},${String(got.offsetY)} are wrong`)
    }
  }
}

console.log(`fixture    ${join(dir, 'fixture.dc6')}`)
console.log(`decoded    ${String(frames)} frames, ${String(sheet.header.directions)} directions x ${String(sheet.header.framesPerDirection)}`)
console.log(`mismatches ${String(problems.length)}`)
for (const problem of problems.slice(0, 12)) console.log(`  - ${problem}`)
console.log(problems.length === 0 ? 'RESULT     decoder matches the encoded grid exactly' : 'RESULT     FAILED')
process.exit(problems.length === 0 ? 0 : 1)
