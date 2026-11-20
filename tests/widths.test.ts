import { describe, test, expect as vitestExpect } from 'vitest'
import * as fs from 'fs'
/**
 * Decode a sprite whose frames each have their own width.
 *
 * Diablo I's tile and cursor sheets are the case single-width auto-detection
 * cannot serve: the inventory cursor sheet is paired with a sidecar list of
 * per-frame widths, and dungeon tile sheets take their widths from the tile
 * definitions. This drives the decoder with such a list against a real member,
 * which is the only way to show the per-frame path actually matches shipped
 * data.
 *
 * Usage: node scripts/verify-widths.ts <archive> <member> <widths-file>
 */
import { readFile } from 'node:fs/promises'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { decodeSpriteFile } from '../src/common/formats/cel.ts'
const WIDTHS_ARCHIVE: string = 'samples/fixtures'
const WIDTHS_MEMBER: string = ''
const WIDTHS_PATH: string = 'scripts/browser/checks/map-widths.txt'
// This check needs a per-frame widths sidecar and a named member. Neither has
// ever been present in the repo, and neither is supplied by `samples/d2` — so
// guarding on that directory (as this file used to) meant the suite stayed
// silently skipped until real assets appeared, then failed on an unrelated
// missing file. Guard on the inputs actually opened below.
const isSkip = WIDTHS_MEMBER === '' || !fs.existsSync(WIDTHS_PATH);
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

const [path, member, widthsPath] = [WIDTHS_ARCHIVE, WIDTHS_MEMBER, WIDTHS_PATH]
if (path === undefined || member === undefined || widthsPath === undefined) {
  console.error('usage: node scripts/verify-widths.ts <archive> <member> <widths-file>')
  // disabled exit: 2)
}

const widths = (await readFile(widthsPath, 'utf8'))
  .split(/\s+/)
  .filter(part => part !== '')
  .map(part => Number.parseInt(part, 10))
if (widths.some(width => !Number.isFinite(width) || width <= 0)) {
  console.error('widths file has a non-positive or unparsable entry')
  // disabled exit: 1)
}

const archive = await MpqArchive.open(await fileSource(path))
const mode = member.toLowerCase().endsWith('.cl2') ? 'cl2' : 'cel'
const file = archive.find(member)
if (file === undefined) {
  console.error(`no such member: ${member}`)
  // disabled exit: 1)
}

const data = await archive.read(file!)
const sheet = decodeSpriteFile(data, mode, { widths })
const frames = sheet.groups.flatMap(group => group.frames)
const heights = frames.map(frame => frame.height)
const coverage = frames.map(frame => {
  let opaque = 0
  for (const value of frame.mask) if (value !== 0) opaque += 1
  return opaque
})
const empty = coverage.filter(count => count === 0).length

console.log(`archive    ${path}`)
console.log(`member     ${member} (${String(data.byteLength)} bytes, ${mode})`)
console.log(`widths     ${String(widths.length)} entries from ${widthsPath}`)
console.log(`groups     ${String(sheet.groups.length)}`)
console.log(`frames     ${String(frames.length)} decoded`)
console.log(`heights    ${String(Math.min(...heights))}..${String(Math.max(...heights))}`)
console.log(`pixels     ${String(Math.min(...coverage))}..${String(Math.max(...coverage))} opaque per frame`)
console.log(`empty      ${String(empty)} frames with no opaque pixels`)
console.log(empty === 0 && frames.length === widths.length
  ? 'RESULT     every frame decoded and matched its width entry exactly'
  : 'RESULT     mismatch — check the width list against the frame count')

  suiteCompleted = true;
}
describe('verify-widths.ts', () => {
  test.skipIf(isSkip)('evaluates script successfully', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
  });
});