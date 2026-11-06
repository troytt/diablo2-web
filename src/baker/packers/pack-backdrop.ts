/**
 * Packs the 1.13c level backdrop assets for issues #1537 / #1538 into `public/backdrop/backdrop.json`:
 *
 * - `data\global\ui\summit01.dc6` (12 frames of 256x256) and `data\global\ui\cloud01.dc6` (2 frames), loaded by
 *   D2Client.dll 0x6fb3a6c0 through 0x6fadb420 (and freed by 0x6fb3a140 outside the Arreat Summit);
 * - the five act palettes, taken from the weather manifest builder (`pal.dat`, cross-checked there against the
 *   `pal.pl2` base palette the tiles use).
 *
 * The cels go into one indexed atlas (index 0 transparent): summit01 as a 4x3 grid in frame order, cloud01 below.
 *
 * Usage: npm run bake -- backdrop   (or `tsx src/baker/packers/pack-backdrop.ts [mpqDir] [outFile]`)
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { decodeDc6, type Dc6Frame } from '../../common/formats/dc6.ts'
import type { MountedArchives } from '../../common/mpq/mount.ts'
import {
  BACKDROP_CEL_NAMES,
  BACKDROP_MANIFEST_VERSION,
  validateBackdropManifest,
  type BackdropCelName,
  type PackedBackdropCelFrame,
  type PackedBackdropManifest,
} from '../../common/pack-contract/backdrop-manifest.ts'
import { encodeBase64 } from '../../common/pack-contract/weather-manifest.ts'
import { DEFAULT_NODE_MPQ_DIR, mountNodeArchives } from '../mpq-archive-source.ts'
import { buildWeatherManifest } from './pack-weather.ts'

export const BACKDROP_OUT_FILE = 'public/backdrop/backdrop.json'

export const BACKDROP_CEL_MEMBERS: Readonly<Record<BackdropCelName, string>> = Object.freeze({
  summit01: 'data\\global\\ui\\summit01.dc6',
  cloud01: 'data\\global\\ui\\cloud01.dc6',
})

/** summit01 is drawn as rows of four 256-pixel columns (frames 0..3, 4..7, 8..11). */
const SUMMIT_COLUMNS = 4

async function readCel(archives: MountedArchives, name: BackdropCelName, sources: Record<string, string>): Promise<readonly Dc6Frame[]> {
  const member = BACKDROP_CEL_MEMBERS[name]
  const hit = archives.find(member)
  if (hit === undefined) throw new Error(`pack-backdrop: ${member} is in none of the mounted archives`)
  sources[member] = hit.entry.label
  const sheet = decodeDc6(await archives.read(member))
  if (sheet.groups.length !== 1) throw new Error(`pack-backdrop: ${member} has ${String(sheet.groups.length)} directions, need 1`)
  return sheet.groups[0]!.frames
}

export async function buildBackdropManifest(archives: MountedArchives): Promise<PackedBackdropManifest> {
  const weather = await buildWeatherManifest(archives)
  const sources: Record<string, string> = {}
  for (const [member, label] of Object.entries(weather.sources)) {
    if (member.includes('\\palette\\')) sources[member] = label
  }
  const summit = await readCel(archives, 'summit01', sources)
  const cloud = await readCel(archives, 'cloud01', sources)
  const cels = {} as Record<BackdropCelName, PackedBackdropCelFrame[]>
  cels.summit01 = summit.map((f, i) => ({
    w: f.width,
    h: f.height,
    ox: f.offsetX,
    oy: f.offsetY,
    ax: (i % SUMMIT_COLUMNS) * 256,
    ay: Math.floor(i / SUMMIT_COLUMNS) * 256,
  }))
  const summitRows = Math.ceil(summit.length / SUMMIT_COLUMNS)
  let cx = 0
  cels.cloud01 = cloud.map((f) => {
    const frame = { w: f.width, h: f.height, ox: f.offsetX, oy: f.offsetY, ax: cx, ay: summitRows * 256 }
    cx += f.width
    return frame
  })
  for (const f of summit) if (f.width > 256 || f.height > 256) throw new Error('pack-backdrop: summit01 frame exceeds 256x256')
  const width = Math.max(SUMMIT_COLUMNS * 256, cx)
  const height = summitRows * 256 + Math.max(...cloud.map((f) => f.height))
  const indices = new Uint8Array(width * height)
  const decoded: Record<BackdropCelName, readonly Dc6Frame[]> = { summit01: summit, cloud01: cloud }
  for (const name of BACKDROP_CEL_NAMES) {
    decoded[name].forEach((f, i) => {
      const at = cels[name][i]!
      for (let row = 0; row < f.height; row += 1) {
        for (let col = 0; col < f.width; col += 1) {
          const src = row * f.width + col
          if (f.mask[src] === 0) continue
          const index = f.indices[src]!
          if (index === 0) throw new Error(`pack-backdrop: ${BACKDROP_CEL_MEMBERS[name]} frame ${String(i)} has an opaque index-0 pixel`)
          indices[(at.ay + row) * width + at.ax + col] = index
        }
      }
    })
  }
  const sortedSources: Record<string, string> = {}
  for (const member of Object.keys(sources).sort()) sortedSources[member] = sources[member]!
  const manifest: PackedBackdropManifest = {
    version: BACKDROP_MANIFEST_VERSION,
    palettes: weather.palettes,
    sources: sortedSources,
    cels,
    atlas: { width, height, indices: encodeBase64(indices) },
  }
  validateBackdropManifest(JSON.parse(JSON.stringify(manifest)))
  return manifest
}

async function main(): Promise<void> {
  const archiveDir = process.argv[2] ?? DEFAULT_NODE_MPQ_DIR
  const outFile = resolve(process.argv[3] ?? BACKDROP_OUT_FILE)
  const manifest = await buildBackdropManifest(mountNodeArchives(archiveDir))
  await mkdir(dirname(outFile), { recursive: true })
  await writeFile(outFile, `${JSON.stringify(manifest)}\n`, 'utf8')
  console.log(`pack-backdrop: atlas ${String(manifest.atlas.width)}x${String(manifest.atlas.height)} -> ${outFile}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}
