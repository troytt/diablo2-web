/**
 * Baked 1.13c level backdrop assets (`npm run bake -- backdrop` → `public/backdrop/backdrop.json`), issues #1537 /
 * #1538: the two DC6 cels D2Client.dll 0x6fb3a6c0 draws behind the Arreat Summit (level 120) —
 * `data\global\ui\summit01` (12 frames of 256x256) and `data\global\ui\cloud01` (2 frames) — and the act palettes
 * (the Arcane Sanctuary starfield 0x6fb3ae00 picks its colours with the D2Win #10190 nearest-colour search over the
 * act palette).
 */

import { decodeBase64Strict } from './weather-manifest.ts'

export const BACKDROP_MANIFEST_VERSION = 1 as const

export const BACKDROP_CEL_NAMES = ['summit01', 'cloud01'] as const
export type BackdropCelName = (typeof BACKDROP_CEL_NAMES)[number]

export interface PackedBackdropCelFrame {
  /** Frame size in pixels. */
  readonly w: number
  readonly h: number
  /** DC6 offsets as stored (0 for both cels). */
  readonly ox: number
  readonly oy: number
  /** Top-left of the frame in the atlas. */
  readonly ax: number
  readonly ay: number
}

export interface PackedBackdropManifest {
  readonly version: typeof BACKDROP_MANIFEST_VERSION
  /** Act I..V palettes as 256 RGB triplets (768 bytes), base64 (`pal.dat` is B, G, R; this is R, G, B). */
  readonly palettes: readonly string[]
  readonly sources: Readonly<Record<string, string>>
  readonly cels: Readonly<Record<BackdropCelName, readonly PackedBackdropCelFrame[]>>
  /** Row-major palette indices, base64; 0 is transparent. */
  readonly atlas: { readonly width: number; readonly height: number; readonly indices: string }
}

export interface BackdropManifestData {
  readonly palettes: readonly Uint8Array[]
  readonly cels: Readonly<Record<BackdropCelName, readonly PackedBackdropCelFrame[]>>
  readonly atlas: { readonly width: number; readonly height: number; readonly indices: Uint8Array }
}

function fail(msg: string): never {
  throw new Error(`backdrop manifest: ${msg}`)
}

function int(v: unknown, what: string, min = 0): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min) fail(`${what} is not an integer >= ${String(min)}`)
  return v
}

/** Validate a parsed manifest and decode its binary fields; throws on any deviation. */
export function validateBackdropManifest(raw: unknown): BackdropManifestData {
  if (typeof raw !== 'object' || raw === null) fail('not an object')
  const m = raw as Partial<PackedBackdropManifest>
  if (m.version !== BACKDROP_MANIFEST_VERSION) fail(`version ${String(m.version)}`)
  if (!Array.isArray(m.palettes) || m.palettes.length !== 5) fail('palettes must hold 5 acts')
  const palettes = m.palettes.map((p, i) => {
    const bytes = decodeBase64Strict(String(p), `palette ${String(i + 1)}`)
    if (bytes.length !== 768) fail(`palette ${String(i + 1)} has ${String(bytes.length)} bytes`)
    return bytes
  })
  const atlas = m.atlas
  if (typeof atlas !== 'object' || atlas === null) fail('no atlas')
  const width = int(atlas.width, 'atlas.width', 1)
  const height = int(atlas.height, 'atlas.height', 1)
  const indices = decodeBase64Strict(String(atlas.indices), 'atlas.indices')
  if (indices.length !== width * height) fail(`atlas has ${String(indices.length)} indices, need ${String(width * height)}`)
  const cels = {} as Record<BackdropCelName, PackedBackdropCelFrame[]>
  for (const name of BACKDROP_CEL_NAMES) {
    const frames = m.cels?.[name]
    if (!Array.isArray(frames) || frames.length === 0) fail(`cel ${name} has no frames`)
    cels[name] = frames.map((f, i) => {
      const frame: PackedBackdropCelFrame = {
        w: int(f.w, `${name}[${String(i)}].w`, 1),
        h: int(f.h, `${name}[${String(i)}].h`, 1),
        ox: int(f.ox, `${name}[${String(i)}].ox`, -4096),
        oy: int(f.oy, `${name}[${String(i)}].oy`, -4096),
        ax: int(f.ax, `${name}[${String(i)}].ax`),
        ay: int(f.ay, `${name}[${String(i)}].ay`),
      }
      if (frame.ax + frame.w > width || frame.ay + frame.h > height) fail(`${name}[${String(i)}] lies outside the atlas`)
      return frame
    })
  }
  if (cels.summit01.length !== 12) fail(`summit01 has ${String(cels.summit01.length)} frames, 0x6fb3a6c0 draws 12`)
  if (cels.cloud01.length !== 2) fail(`cloud01 has ${String(cels.cloud01.length)} frames, 0x6fb3a6c0 draws 2`)
  return { palettes, cels, atlas: { width, height, indices } }
}
