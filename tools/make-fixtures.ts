/**
 * Fixture generator: encode a DC6 file from a known index grid.
 *
 * Format work without real assets needs its own evidence, and "my decoder reads
 * what my encoder wrote" proves nothing on its own. So the fixtures here are
 * written strictly to the published layout (the Kaitai `dc6.ksy` definition
 * plus the two independent decoders' agreement on the run alphabet and row
 * order), and every claim is then checked against an *independent* decoder:
 * `scripts/verify-dc6.sh` runs `dc6png` over the generated file and compares
 * the PNG it produces against the grid encoded here.
 *
 * Usage: node scripts/make-fixtures.ts <output-directory>
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { encodeTbl } from '../src/baker/io/tbl-writer.ts'
import { join } from 'node:path'

/** Byte offset of the file header in a DC6. */
const FILE_HEADER_SIZE = 24
/** Byte offset of a frame header inside its frame. */
const FRAME_HEADER_SIZE = 32
/** Scanline terminator. */
const END_OF_SCANLINE = 0x80
/** Longest literal run a single chunk byte can introduce. */
const MAX_LITERAL_RUN = 0x7f

/**
 * A frame as a top-down grid of palette indices, `0` meaning transparent.
 */
interface FixtureFrame {
  readonly width: number
  readonly height: number
  /** Rows top-down; each row must be `width` long. */
  readonly rows: readonly (readonly number[])[]
  readonly offsetX: number
  readonly offsetY: number
}

/**
 * Encode one frame's run stream.
 *
 * Rows are emitted **bottom-up**, matching how the format stores them: the
 * first scanline written belongs to the frame's last row.
 *
 * @param frame - the frame to encode.
 * @returns the run stream.
 */
function encodeFrameStream(frame: FixtureFrame): Uint8Array {
  const bytes: number[] = []
  for (let rowIndex = frame.height - 1; rowIndex >= 0; rowIndex -= 1) {
    const row = frame.rows[rowIndex]!
    let x = 0
    while (x < frame.width) {
      const value = row[x]!
      let run = 0
      while (x + run < frame.width && row[x + run] === value && run < MAX_LITERAL_RUN) run += 1
      if (value === 0) {
        bytes.push(END_OF_SCANLINE | run)
      } else {
        bytes.push(run)
        for (let i = 0; i < run; i += 1) bytes.push(row[x + i]!)
      }
      x += run
    }
    bytes.push(END_OF_SCANLINE)
  }
  return new Uint8Array(bytes)
}

/**
 * Encode a DC6 file.
 *
 * @param directions - directions to write.
 * @param framesPerDirection - frames per direction.
 * @param frameOf - builds the frame at a given position.
 * @returns the encoded file.
 */
function encodeDc6(
  directions: number,
  framesPerDirection: number,
  frameOf: (direction: number, frame: number) => FixtureFrame,
): Uint8Array {
  const total = directions * framesPerDirection
  const encoded: { stream: Uint8Array; frame: FixtureFrame }[] = []
  for (let index = 0; index < total; index += 1) {
    const direction = Math.floor(index / framesPerDirection)
    const frame = index % framesPerDirection
    const spec = frameOf(direction, frame)
    encoded.push({ stream: encodeFrameStream(spec), frame: spec })
  }

  const pointerTableSize = total * 4
  let offset = FILE_HEADER_SIZE + pointerTableSize
  const pointers: number[] = []
  for (const entry of encoded) {
    pointers.push(offset)
    // Frame header + run stream + 3-byte terminator.
    offset += FRAME_HEADER_SIZE + entry.stream.byteLength + 3
  }

  const out = new Uint8Array(offset)
  const view = new DataView(out.buffer)
  view.setInt32(0x00, 6, true)          // version
  view.setUint32(0x04, 0, true)         // flags
  view.setUint32(0x08, 0, true)         // encoding
  view.setUint32(0x0c, 0, true)         // termination
  view.setInt32(0x10, directions, true)
  view.setInt32(0x14, framesPerDirection, true)
  pointers.forEach((pointer, index) => { view.setUint32(FILE_HEADER_SIZE + index * 4, pointer, true) })

  encoded.forEach((entry, index) => {
    const at = pointers[index]!
    view.setInt32(at + 0x00, 0, true)                  // flipped
    view.setInt32(at + 0x04, entry.frame.width, true)
    view.setInt32(at + 0x08, entry.frame.height, true)
    view.setInt32(at + 0x0c, entry.frame.offsetX, true)
    view.setInt32(at + 0x10, entry.frame.offsetY, true)
    view.setUint32(at + 0x14, 0, true)                 // unknown
    view.setInt32(at + 0x18, 0, true)                  // next block
    view.setInt32(at + 0x1c, entry.stream.byteLength, true)
    out.set(entry.stream, at + FRAME_HEADER_SIZE)
  })
  return out
}

/**
 * A palette whose entries are unambiguous under channel reordering: red and
 * blue differ for every index, so a byte-swapped read is visible rather than
 * silent.
 *
 * @returns 768 bytes of RGB triples.
 */
function makePalette(): Uint8Array {
  const palette = new Uint8Array(768)
  for (let index = 0; index < 256; index += 1) {
    palette[index * 3] = index
    palette[index * 3 + 1] = (index * 7) & 0xff
    palette[index * 3 + 2] = 255 - index
  }
  return palette
}

/**
 * A frame with every interesting run shape: a full literal row, a mixed
 * literal/transparent row, an all-transparent row, and a two-chunk row.
 *
 * @param seed - shifts the index values so frames differ.
 * @returns the frame.
 */
function patternFrame(seed: number): FixtureFrame {
  const width = 8
  const height = 4
  const rows: number[][] = []
  // Top row: two literal runs (3 then 5) — exercises consecutive literal chunks.
  rows.push([seed + 1, seed + 2, seed + 3, seed + 4, seed + 5, seed + 6, seed + 7, seed + 8])
  // Second row: literal 3, transparent 2, literal 3.
  rows.push([seed + 9, seed + 10, seed + 11, 0, 0, seed + 12, seed + 13, seed + 14])
  // Third row: entirely transparent.
  rows.push([0, 0, 0, 0, 0, 0, 0, 0])
  // Bottom row: single transparent pixel then a full literal run.
  rows.push([0, seed + 15, seed + 16, seed + 17, seed + 18, seed + 19, seed + 20, seed + 21])
  return { width, height, rows, offsetX: seed, offsetY: -seed }
}

/**
 * A synthetic walking actor: eight directions by eight frames.
 *
 * Diablo II units that are not composite-animated ship as per-direction DC6
 * sheets, so this is the shape the engine's actor path consumes. Each direction
 * gets its own filled block and each frame shifts it, so a decoder, an atlas or
 * a draw order that mixes directions up is visible in a screenshot rather than
 * silently plausible.
 *
 * @param directions - direction count.
 * @param framesPerDirection - frames per direction.
 * @param size - frame edge in pixels.
 * @returns the encoded DC6.
 */
function encodeActor(directions: number, framesPerDirection: number, size: number): Uint8Array {
  return encodeDc6(directions, framesPerDirection, (direction, frame) => {
    const rows: number[][] = []
    const blockWidth = 16 + direction * 3
    const inset = (frame * 4) % (size - blockWidth)
    for (let y = 0; y < size; y += 1) {
      const row: number[] = []
      const inBlock = y >= 16 && y < 16 + blockWidth
      for (let x = 0; x < size; x += 1) {
        const lit = inBlock && x >= inset && x < inset + blockWidth
        row.push(lit ? 1 + ((direction * 16 + frame * 2 + (y % 8)) % 250) : 0)
      }
      rows.push(row)
    }
    return { width: size, height: size, rows, offsetX: 0, offsetY: 0 }
  })
}

const outDir = process.argv[2]
if (outDir === undefined) {
  console.error('usage: node scripts/make-fixtures.ts <output-directory>')
  process.exit(2)
}
await mkdir(outDir, { recursive: true })

const directions = 2
const framesPerDirection = 2
const file = encodeDc6(directions, framesPerDirection, (direction, frame) => patternFrame(direction * 4 + frame * 22 + 1))
await writeFile(join(outDir, 'fixture.dc6'), file)
await writeFile(join(outDir, 'palette.pal'), makePalette())

/** The grid each frame is expected to decode to, top-down. */
const expected = {
  directions,
  framesPerDirection,
  palette: 'palette.pal',
  frames: Array.from({ length: directions }, (_, direction) =>
    Array.from({ length: framesPerDirection }, (_, frame) => {
      const spec = patternFrame(direction * 4 + frame * 22 + 1)
      return { width: spec.width, height: spec.height, rows: spec.rows }
    })),
}
await writeFile(join(outDir, 'expected.json'), JSON.stringify(expected, null, 2))

// Data tables in the shape Diablo II ships them: tab-separated with a header
// row, under the same member path the game uses.
const monstats = [
  'Id\tName\tHP\tDamage\tCooldownTicks\tReach\tAggroRadius\tSpeed\tXP',
  'fallen\tFallen\t12\t3\t24\t36\t220\t80\t8',
  'zombie\tZombie\t30\t6\t32\t40\t170\t50\t15',
  'skeleton\tSkeleton\t18\t4\t28\t38\t260\t70\t12',
].join('\r\n')
const experience = ['Level\tXP', '1\t0', '2\t20', '3\t60', '4\t140', '5\t280'].join('\r\n')
await mkdir(join(outDir, 'data', 'global', 'excel'), { recursive: true })
await writeFile(join(outDir, 'data', 'global', 'excel', 'monstats.txt'), monstats)
await writeFile(join(outDir, 'data', 'global', 'excel', 'experience.txt'), experience)
console.log(`wrote ${join(outDir, 'data', 'global', 'excel')}/{monstats,experience}.txt`)

// Item tables, in the shape Diablo II ships them (a leading unnamed column is
// common in the real files, so one is included here to keep that path exercised).
const tables: Record<string, string> = {
  'weapons.txt': [
    '\tId\tName\tType\tInvWidth\tInvHeight\tDamage\tValue\tLevel\tMaxStack',
    '\tswd\tShort Sword\tweap\t1\t3\t5\t30\t1\t1',
    '\taxe\tHand Axe\tweap\t2\t3\t8\t60\t3\t1',
    '\tgsw\tGreat Sword\tweap\t2\t4\t18\t200\t10\t1',
  ].join('\r\n'),
  'armor.txt': [
    'Id\tName\tType\tInvWidth\tInvHeight\tDefense\tValue\tLevel\tMaxStack',
    'buc\tBuckler\tarmo\t2\t2\t4\t25\t1\t1',
    'cap\tCap\tarmo\t2\t2\t6\t40\t2\t1',
    'plt\tPlate Mail\tarmo\t2\t3\t30\t400\t12\t1',
  ].join('\r\n'),
  'misc.txt': [
    'Id\tName\tType\tInvWidth\tInvHeight\tMaxStack\tValue',
    'hp1\tMinor Healing Potion\tmisc\t1\t1\t5\t20',
    'mp1\tMinor Mana Potion\tmisc\t1\t1\t5\t25',
    'key\tKey\tmisc\t1\t1\t12\t10',
  ].join('\r\n'),
  'magicprefix.txt': [
    'Id\tName\tLevel\titype1\titype2\tmod1code\tmod1min\tmod1max\tmod2code\tmod2min\tmod2max',
    'cruel\tCruel\t12\tweap\t\tmaxdamage\t30\t40\t\t\t',
    'sturdy\tSturdy\t3\tarmo\t\tdefense\t5\t9\t\t\t',
    'fine\tFine\t5\tweap\tarmo\tmaxdamage\t2\t4\tdefense\t1\t3',
  ].join('\r\n'),
  'magicsuffix.txt': [
    'Id\tName\tLevel\titype1\tmod1code\tmod1min\tmod1max',
    'of_might\tof Might\t5\tweap\tstrength\t2\t5',
    'of_the_fox\tof the Fox\t3\t\tdexterity\t1\t3',
    'of_health\tof Health\t4\t\tmaxhp\t10\t20',
  ].join('\r\n'),
}
for (const [name, body] of Object.entries(tables)) {
  await writeFile(join(outDir, 'data', 'global', 'excel', name), body)
}
console.log(`wrote ${String(Object.keys(tables).length)} item tables under data/global/excel/`)

// Skills, NPCs and quests, plus the string table their numeric name cells point
// into — so the `.tbl` decoder is exercised by the game path, not only by its
// own test.
const m4Tables: Record<string, string> = {
  'skills.txt': [
    'Id\tName\tManaCost\tCooldownTicks\tRange\tSpeed\tMinDam\tMaxDam\tPerLevel\tRadius',
    'attack\tBasic Attack\t0\t10\t48\t0\t4\t6\t1\t20',
    'firebolt\t1\t6\t20\t260\t320\t7\t10\t3\t20',
    'frostnova\t2\t14\t50\t70\t0\t12\t16\t4\t90',
  ].join('\r\n'),
  'npcs.txt': [
    'Id\tName\tQuest\tOffer\tProgress\tDone',
    'cain\t3\tden\t6\t7\t8',
  ].join('\r\n'),
  'quests.txt': [
    'Id\tName\tDescription\tMonsterId\tKillCount\tRewardXP\tRewardGold',
    // A wildcard objective: the fixture has three monster types, so a quest that
    // names one of them could not be completed deterministically in a short run.
    'den\t4\t5\t*\t3\t60\t120',
  ].join('\r\n'),
}
for (const [name, body] of Object.entries(m4Tables)) {
  await writeFile(join(outDir, 'data', 'global', 'excel', name), body)
}
// Index order matters: the tables above address these by number.
const stringTable = encodeTbl([
  '', 'Fire Bolt', 'Frost Nova', 'Deckard Cain',
  'Kill the Fallen', 'Slay five of the fallen in the moor',
  'The fallen plague us.|Will you help?',
  'Still working?|The fallen remain.',
  'Well done, hero.',
])
await writeFile(join(outDir, 'data', 'local', 'string.tbl'), stringTable).catch(async () => {
  await mkdir(join(outDir, 'data', 'local'), { recursive: true })
  await writeFile(join(outDir, 'data', 'local', 'string.tbl'), stringTable)
})
console.log(`wrote 3 M4 tables and data/local/string.tbl (${String(stringTable.byteLength)} bytes)`)

const actor = encodeActor(8, 8, 64)
await writeFile(join(outDir, 'actor.dc6'), actor)
console.log(`wrote ${join(outDir, 'actor.dc6')} (${String(actor.byteLength)} bytes, 8 directions x 8 frames of 64x64)`)
console.log(`wrote ${join(outDir, 'fixture.dc6')} (${String(file.byteLength)} bytes)`)
console.log(`wrote ${join(outDir, 'palette.pal')} and expected.json`)
