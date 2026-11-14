/**
 * Decode every Diablo I sprite member in an archive and report what the
 * decoders had to infer.
 *
 * The width story is the interesting part and differs per format:
 *
 * - `.cel` runs are row-bounded, so a wrong width makes runs overrun a row and
 *   the file is rejected. Auto-detection is therefore a real check, and a
 *   decoded file is strong evidence the decoder matches the shipped data.
 * - `.cl2` runs may cross rows, so *any* width consumes the stream. There the
 *   width must come from the game's tables — `SetPlrAnims` for players,
 *   `monsterdata[].width` for monsters — and success means the decoder agrees
 *   with those parameters. `cl2WidthCandidates` additionally reports widths
 *   that leave the stream row-aligned, which is a necessary (not sufficient)
 *   property of the true width.
 *
 * Usage: node scripts/verify-sprites.ts <archive> [--player] [--samples]
 */
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { cl2WidthCandidates, decodeSpriteFile, detectSpriteWidth } from '../src/common/formats/cel.ts'
import { PLAYER_SPRITE_WIDTH } from '../src/common/formats/sprite.ts'

const [path, ...flags] = process.argv.slice(2)
if (path === undefined) {
  console.error('usage: node scripts/verify-sprites.ts <archive> [--player] [--samples]')
  process.exit(2)
}
const showPlayer = flags.includes('--player')
const showSamples = flags.includes('--samples')

/** Widths the game's own tables give for player graphics (`SetPlrAnims`). */
const PLAYER_WIDTHS = [
  PLAYER_SPRITE_WIDTH.stand, PLAYER_SPRITE_WIDTH.walk,
  PLAYER_SPRITE_WIDTH.attack, PLAYER_SPRITE_WIDTH.attackNarrow,
  PLAYER_SPRITE_WIDTH.monk, PLAYER_SPRITE_WIDTH.monkAttack,
]
/** Most monospecies monster art is 128 wide (`monsterdata[].width`). */
const MONSTER_WIDTHS = [128, 160, 96, 64]

const archive = await MpqArchive.open(await fileSource(path))
const names = await archive.listFiles()

const celWidths = new Map<number, number>()
const cl2Widths = new Map<number, number>()
const failures: string[] = []
const ambiguous: string[] = []
const playerRows: string[] = []
let celTotal = 0
let celOk = 0
let cl2Total = 0
let cl2Ok = 0
const started = Date.now()

/** The directory that owns an archive name (`monsters`, `plrgfx`, ...). */
function topDir(name: string): string {
  const cut = name.indexOf('\\')
  return cut === -1 ? '(root)' : name.slice(0, cut)
}

for (const name of names) {
  const lower = name.toLowerCase()
  const mode = lower.endsWith('.cl2') ? 'cl2' : lower.endsWith('.cel') ? 'cel' : null
  if (mode === null) continue
  const file = archive.find(name)
  if (file === undefined) {
    failures.push(`${name}: hash lookup failed`)
    continue
  }
  const data = await archive.read(file)

  if (mode === 'cel') {
    celTotal += 1
    const width = detectSpriteWidth(data)
    if (width === null) {
      failures.push(`${name}: no width consumes the file exactly`)
      continue
    }
    try {
      const sheet = decodeSpriteFile(data, 'cel', { width })
      const frames = sheet.groups.reduce((total, group) => total + group.frames.length, 0)
      if (frames === 0) throw new Error('decoded zero frames')
      celOk += 1
      celWidths.set(width, (celWidths.get(width) ?? 0) + 1)
    } catch (error) {
      failures.push(`${name} (width ${String(width)}): ${(error as Error).message}`)
    }
    continue
  }

  cl2Total += 1
  const dir = topDir(name)
  const candidates = dir === 'plrgfx' ? PLAYER_WIDTHS : dir === 'monsters' ? MONSTER_WIDTHS : PLAYER_WIDTHS
  // The game's tables for this kind of art, tried in order.
  let matched: number | null = null
  for (const width of candidates) {
    try {
      const sheet = decodeSpriteFile(data, 'cl2', { width })
      const frames = sheet.groups.reduce((total, group) => total + group.frames.length, 0)
      if (frames > 0) { matched = width; break }
    } catch {
      // try the next width
    }
  }
  if (matched !== null) {
    cl2Ok += 1
    cl2Widths.set(matched, (cl2Widths.get(matched) ?? 0) + 1)
    const aligned = cl2WidthCandidates(data, candidates)
    if (!aligned.includes(matched)) {
      ambiguous.push(`${name}: decodes at ${String(matched)} but the stream is not row-aligned there`)
    }
    if (showPlayer && dir === 'plrgfx') {
      const sheet = decodeSpriteFile(data, 'cl2', { width: matched })
      const frames = sheet.groups.reduce((total, group) => total + group.frames.length, 0)
      const tallest = Math.max(...sheet.groups.flatMap(group => group.frames.map(frame => frame.height)))
      playerRows.push(
        `${name.padEnd(34)} groups=${String(sheet.groups.length)} frames=${String(frames)}`
        + ` width=${String(matched)} tallest=${String(tallest)} aligned=[${aligned.join(',')}]`,
      )
    }
  } else {
    const aligned = cl2WidthCandidates(data, [...PLAYER_WIDTHS, ...MONSTER_WIDTHS, 32, 48, 64, 80, 160, 192, 256])
    const msg = `${name} (${dir}): no table width decoded it; row-aligned candidates: ${aligned.length === 0 ? 'none' : aligned.join(',')}`
    ambiguous.push(msg)
    failures.push(msg)
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1)
const formatHistogram = (histogram: Map<number, number>): string =>
  [...histogram].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w, n]) => `${String(w)}px:${String(n)}`).join('  ')

console.log(`archive   ${path}`)
console.log(`cel       ${String(celOk)}/${String(celTotal)} decoded   widths ${formatHistogram(celWidths)}`)
console.log(`cl2       ${String(cl2Ok)}/${String(cl2Total)} decoded   widths ${formatHistogram(cl2Widths)}`)
console.log(`failures  ${String(failures.length)}`)
for (const line of failures.slice(0, 10)) console.log(`  - ${line}`)
console.log(`notes     ${String(ambiguous.length)}`)
const noteLimit = showSamples ? 12 : 4
for (const line of ambiguous.slice(0, noteLimit)) console.log(`  · ${line}`)
if (showSamples && ambiguous.length > noteLimit) console.log(`  · … ${String(ambiguous.length - noteLimit)} more`)
console.log(`elapsed   ${seconds}s`)
if (showPlayer) {
  console.log('--- player graphics ---')
  for (const row of playerRows.slice(0, 30)) console.log(`  ${row}`)
}
if (failures.length > 0 || celOk !== celTotal || cl2Ok !== cl2Total) {
  process.exitCode = 1
}
