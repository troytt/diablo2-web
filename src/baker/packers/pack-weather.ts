/**
 * Bake the 1.13c client weather assets into `public/weather/weather.json`.
 *
 * The runtime may not open an MPQ, so this packer extracts what LoadWeather (D2Client 0x6fb31750)
 * reads:
 * - `data\global\palette\ACT1..5\pal.dat`: the act palettes that LoadWeather's nearest-colour search
 *   (D2Win #10190 → D2CMP #10049) runs over. Each one must equal the base palette of the act's
 *   `pal.pl2`, which is what the tile renderer draws with; the packer fails otherwise.
 * - `data\global\UncompOverlays\Rain3.dc6`, `Rain4.dc6`, `bubble3.dc6`: the only overlay cels the
 *   1.13c client draws (splash types 2 / 3, bubble type 2). Rain1/Rain2 and bubble1/2/4 are loaded
 *   by LoadWeather but never drawn, so they are not packed.
 *
 * Every member is read through the 1.13c mount order (the last archive that has it wins).
 * `tests/client/weather-assets-parity.test.ts` requires the checked-in JSON to equal this output.
 *
 * Usage:
 *   npx tsx src/baker/packers/pack-weather.ts [<archiveDir>] [<outFile>]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { decodeDc6 } from '../../common/formats/dc6.ts'
import { decodePl2 } from '../../common/formats/pl2.ts'
import type { MountedArchives } from '../../common/mpq/mount.ts'
import {
  WEATHER_CEL_NAMES,
  WEATHER_MANIFEST_VERSION,
  encodeBase64,
  validateWeatherManifest,
  type PackedWeatherCelFrame,
  type PackedWeatherManifest,
  type WeatherCelName,
} from '../../common/pack-contract/index.ts'
import { DEFAULT_NODE_MPQ_DIR, mountNodeArchives } from '../mpq-archive-source.ts'

export const WEATHER_OUT_FILE = 'public/weather/weather.json'

/** LoadWeather's `%s\UncompOverlays\RainN` / `bubbleN` cels that are drawn (base path `DATA\GLOBAL`). */
export const WEATHER_CEL_MEMBERS: Readonly<Record<WeatherCelName, string>> = Object.freeze({
  rain3: 'data\\global\\UncompOverlays\\Rain3.dc6',
  rain4: 'data\\global\\UncompOverlays\\Rain4.dc6',
  bubble3: 'data\\global\\UncompOverlays\\bubble3.dc6',
})

export function weatherPaletteMember(act: number, file: 'pal.dat' | 'pal.pl2'): string {
  if (!Number.isInteger(act) || act < 1 || act > 5) throw new Error(`weatherPaletteMember: act ${String(act)}`)
  return `data\\global\\palette\\ACT${String(act)}\\${file}`
}

/** Gap between atlas frames and rows (nearest sampling needs none; it keeps frames visibly apart). */
const ATLAS_GAP = 1

interface DecodedCelFrame {
  readonly width: number
  readonly height: number
  readonly indices: Uint8Array
  readonly mask: Uint8Array
  readonly offsetX: number
  readonly offsetY: number
}

async function readMember(archives: MountedArchives, member: string, sources: Record<string, string>): Promise<Uint8Array> {
  const hit = archives.find(member)
  if (hit === undefined) throw new Error(`pack-weather: ${member} is in none of the mounted archives`)
  sources[member] = hit.entry.label
  return await archives.read(member)
}

/** `pal.dat` stores B, G, R; returns R, G, B. */
function palDatToRgb(dat: Uint8Array, member: string): Uint8Array {
  if (dat.length !== 768) throw new Error(`pack-weather: ${member} has ${String(dat.length)} bytes, need 768`)
  const rgb = new Uint8Array(768)
  for (let i = 0; i < 256; i += 1) {
    rgb[i * 3] = dat[i * 3 + 2]!
    rgb[i * 3 + 1] = dat[i * 3 + 1]!
    rgb[i * 3 + 2] = dat[i * 3]!
  }
  return rgb
}

function decodeCel(bytes: Uint8Array, member: string): readonly DecodedCelFrame[] {
  const sheet = decodeDc6(bytes)
  if (sheet.groups.length !== 1) {
    throw new Error(`pack-weather: ${member} has ${String(sheet.groups.length)} directions, LoadWeather cels have 1`)
  }
  const frames = sheet.groups[0]!.frames
  if (frames.length === 0) throw new Error(`pack-weather: ${member} has no frames`)
  return frames
}

/** Reads the inputs from mounted 1.13c archives and builds the manifest (deterministic). */
export async function buildWeatherManifest(archives: MountedArchives): Promise<PackedWeatherManifest> {
  const sources: Record<string, string> = {}

  const palettes: string[] = []
  for (let act = 1; act <= 5; act += 1) {
    const datMember = weatherPaletteMember(act, 'pal.dat')
    const pl2Member = weatherPaletteMember(act, 'pal.pl2')
    const rgb = palDatToRgb(await readMember(archives, datMember, sources), datMember)
    const pl2Rgb = decodePl2(await readMember(archives, pl2Member, sources)).rgb
    for (let i = 0; i < 768; i += 1) {
      if (pl2Rgb[i] !== rgb[i]) {
        throw new Error(
          `pack-weather: act ${String(act)} pal.dat entry ${String(Math.floor(i / 3))} differs from the pal.pl2 base palette the tiles use`,
        )
      }
    }
    palettes.push(encodeBase64(rgb))
  }

  const decoded = {} as Record<WeatherCelName, readonly DecodedCelFrame[]>
  for (const name of WEATHER_CEL_NAMES) {
    const member = WEATHER_CEL_MEMBERS[name]
    decoded[name] = decodeCel(await readMember(archives, member, sources), member)
  }

  // One atlas row per cel, frames left to right.
  const cels = {} as Record<WeatherCelName, PackedWeatherCelFrame[]>
  let width = 0
  let y = 0
  for (const name of WEATHER_CEL_NAMES) {
    let x = 0
    let rowHeight = 0
    cels[name] = decoded[name].map(f => {
      const frame: PackedWeatherCelFrame = { w: f.width, h: f.height, ox: f.offsetX, oy: f.offsetY, ax: x, ay: y }
      x += f.width + ATLAS_GAP
      rowHeight = Math.max(rowHeight, f.height)
      return frame
    })
    width = Math.max(width, x - ATLAS_GAP)
    y += rowHeight + ATLAS_GAP
  }
  const height = y - ATLAS_GAP
  const indices = new Uint8Array(width * height)
  for (const name of WEATHER_CEL_NAMES) {
    decoded[name].forEach((f, i) => {
      const at = cels[name][i]!
      for (let row = 0; row < f.height; row += 1) {
        for (let col = 0; col < f.width; col += 1) {
          const src = row * f.width + col
          if (f.mask[src] === 0) continue
          const index = f.indices[src]!
          if (index === 0) {
            throw new Error(`pack-weather: ${WEATHER_CEL_MEMBERS[name]} frame ${String(i)} has an opaque index-0 pixel; the atlas uses 0 as transparent`)
          }
          indices[(at.ay + row) * width + at.ax + col] = index
        }
      }
    })
  }

  const sortedSources: Record<string, string> = {}
  for (const member of Object.keys(sources).sort()) sortedSources[member] = sources[member]!
  const manifest: PackedWeatherManifest = {
    version: WEATHER_MANIFEST_VERSION,
    palettes,
    sources: sortedSources,
    cels,
    atlas: { width, height, indices: encodeBase64(indices) },
  }
  validateWeatherManifest(JSON.parse(JSON.stringify(manifest)))
  return manifest
}

/** The file text (2-space JSON, LF, trailing newline). */
export function renderWeatherManifest(manifest: PackedWeatherManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

async function main(): Promise<void> {
  const archiveDir = process.argv[2] ?? DEFAULT_NODE_MPQ_DIR
  const outFile = resolve(process.argv[3] ?? WEATHER_OUT_FILE)
  const manifest = await buildWeatherManifest(mountNodeArchives(archiveDir))
  await mkdir(dirname(outFile), { recursive: true })
  await writeFile(outFile, renderWeatherManifest(manifest), 'utf8')
  const frames = WEATHER_CEL_NAMES.map(n => `${n} ${String(manifest.cels[n].length)}`).join(', ')
  console.log(
    `pack-weather: 5 act palettes, ${frames} frames, atlas ${String(manifest.atlas.width)}x${String(manifest.atlas.height)} -> ${outFile}`,
  )
}

const invokedPath = process.argv[1] !== undefined ? resolve(process.argv[1]) : ''
if (invokedPath.endsWith('pack-weather.ts')) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
}
