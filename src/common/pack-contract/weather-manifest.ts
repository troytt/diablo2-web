/**
 * Contract of `public/weather/weather.json`, written by `src/baker/packers/pack-weather.ts` and
 * read by the client weather (`src/client/weather/`).
 *
 * It carries what 1.13c LoadWeather (D2Client 0x6fb31750) reads from the MPQs:
 * - the five act palettes (`data\global\palette\ACTn\pal.dat`), from which the client builds the
 *   colour ramps exactly as LoadWeather does;
 * - the three overlay cels that are ever drawn (`data\global\UncompOverlays\Rain3`, `Rain4`, `bubble3`
 *   DC6: splash types 2 / 3 and bubble type 2), packed into one palette-index atlas.
 */

export const WEATHER_MANIFEST_VERSION = 1

/** Overlay cels in the order of their `type` slots (Rain3 = splash 2, Rain4 = splash 3, bubble3 = bubble 2). */
export const WEATHER_CEL_NAMES = ['rain3', 'rain4', 'bubble3'] as const
export type WeatherCelName = (typeof WEATHER_CEL_NAMES)[number]

/** One DC6 frame of a weather overlay cel and where it sits in the atlas. */
export interface PackedWeatherCelFrame {
  /** Frame size in pixels. */
  readonly w: number
  readonly h: number
  /**
   * DC6 offsets as stored. The frame is drawn with its top-left at `(X + ox, Y + oy − h)`, the port's
   * DC6 convention (the exact ±1 of 1.13c DrawCellContext is UNVERIFIED).
   */
  readonly ox: number
  readonly oy: number
  /** Top-left of the frame in the atlas. */
  readonly ax: number
  readonly ay: number
}

export interface PackedWeatherAtlas {
  readonly width: number
  readonly height: number
  /** Row-major palette indices, base64; 0 is transparent. */
  readonly indices: string
}

export interface PackedWeatherManifest {
  readonly version: typeof WEATHER_MANIFEST_VERSION
  /** Act I..V palettes as 256 RGB triplets (768 bytes), base64. `pal.dat` stores B, G, R; this is R, G, B. */
  readonly palettes: readonly string[]
  /** MPQ member → archive it was read from (the one that wins the mount order). */
  readonly sources: Readonly<Record<string, string>>
  readonly cels: Readonly<Record<WeatherCelName, readonly PackedWeatherCelFrame[]>>
  readonly atlas: PackedWeatherAtlas
}

/** A validated manifest with its binary fields decoded. */
export interface WeatherManifestData {
  /** Index `act - 1`; 768 RGB bytes each. */
  readonly palettes: readonly Uint8Array[]
  readonly cels: Readonly<Record<WeatherCelName, readonly PackedWeatherCelFrame[]>>
  readonly atlas: { readonly width: number; readonly height: number; readonly indices: Uint8Array }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_VALUE = new Int16Array(128).fill(-1)
for (let i = 0; i < B64.length; i += 1) B64_VALUE[B64.charCodeAt(i)] = i

/** Standard padded base64 (RFC 4648 §4). */
export function encodeBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0
    const triple = (b0 << 16) | (b1 << 8) | b2
    out += B64[(triple >> 18) & 63]! + B64[(triple >> 12) & 63]!
    out += i + 1 < bytes.length ? B64[(triple >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? B64[triple & 63]! : '='
  }
  return out
}

/** Strict padded base64 decode: throws on a bad length, a foreign character or misplaced padding. */
export function decodeBase64Strict(text: string, what: string): Uint8Array {
  if (text.length % 4 !== 0) throw new Error(`${what}: base64 length ${String(text.length)} is not a multiple of 4`)
  let pad = 0
  if (text.endsWith('==')) pad = 2
  else if (text.endsWith('=')) pad = 1
  const out = new Uint8Array((text.length / 4) * 3 - pad)
  let o = 0
  for (let i = 0; i < text.length; i += 4) {
    const last = i + 4 === text.length
    let triple = 0
    for (let k = 0; k < 4; k += 1) {
      const code = text.charCodeAt(i + k)
      const isPad = code === 61
      if (isPad && !(last && k >= 4 - pad)) throw new Error(`${what}: misplaced base64 padding at ${String(i + k)}`)
      const v = isPad ? 0 : code < 128 ? B64_VALUE[code]! : -1
      if (v < 0) throw new Error(`${what}: invalid base64 character at ${String(i + k)}`)
      triple = (triple << 6) | v
    }
    if (o < out.length) out[o++] = (triple >> 16) & 0xff
    if (o < out.length) out[o++] = (triple >> 8) & 0xff
    if (o < out.length) out[o++] = triple & 0xff
  }
  return out
}

function fail(path: string, message: string): never {
  throw new Error(`weather.json ${path}: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((k, i) => k !== expected[i])) {
    fail(path, `keys ${JSON.stringify(actual)} must be exactly ${JSON.stringify(expected)}`)
  }
}

function requireInt(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    fail(path, `${JSON.stringify(value)} is not an integer in [${String(min)}, ${String(max)}]`)
  }
  return value
}

/** Validates the raw JSON (exact keys, ranges, frames inside the atlas) and decodes its binary fields. */
export function validateWeatherManifest(raw: unknown): WeatherManifestData {
  if (!isRecord(raw)) fail('', 'is not an object')
  requireKeys(raw, ['version', 'palettes', 'sources', 'cels', 'atlas'], '')
  if (raw.version !== WEATHER_MANIFEST_VERSION) fail('.version', `${JSON.stringify(raw.version)} is not ${String(WEATHER_MANIFEST_VERSION)}`)

  if (!Array.isArray(raw.palettes) || raw.palettes.length !== 5) fail('.palettes', 'must list the 5 act palettes')
  const palettes = raw.palettes.map((p, i) => {
    if (typeof p !== 'string') fail(`.palettes[${String(i)}]`, 'is not a string')
    const bytes = decodeBase64Strict(p, `weather.json .palettes[${String(i)}]`)
    if (bytes.length !== 768) fail(`.palettes[${String(i)}]`, `decodes to ${String(bytes.length)} bytes, need 768`)
    return bytes
  })

  if (!isRecord(raw.sources)) fail('.sources', 'is not an object')
  for (const [member, archive] of Object.entries(raw.sources)) {
    if (typeof archive !== 'string' || archive === '') fail(`.sources[${member}]`, 'must name an archive')
  }

  if (!isRecord(raw.atlas)) fail('.atlas', 'is not an object')
  requireKeys(raw.atlas, ['width', 'height', 'indices'], '.atlas')
  const width = requireInt(raw.atlas.width, '.atlas.width', 1, 4096)
  const height = requireInt(raw.atlas.height, '.atlas.height', 1, 4096)
  if (typeof raw.atlas.indices !== 'string') fail('.atlas.indices', 'is not a string')
  const indices = decodeBase64Strict(raw.atlas.indices, 'weather.json .atlas.indices')
  if (indices.length !== width * height) {
    fail('.atlas.indices', `decodes to ${String(indices.length)} bytes, need ${String(width * height)}`)
  }

  if (!isRecord(raw.cels)) fail('.cels', 'is not an object')
  requireKeys(raw.cels, WEATHER_CEL_NAMES, '.cels')
  const cels = {} as Record<WeatherCelName, PackedWeatherCelFrame[]>
  for (const name of WEATHER_CEL_NAMES) {
    const frames = raw.cels[name]
    if (!Array.isArray(frames) || frames.length === 0) fail(`.cels.${name}`, 'must list at least one frame')
    cels[name] = frames.map((f, i) => {
      const path = `.cels.${name}[${String(i)}]`
      if (!isRecord(f)) fail(path, 'is not an object')
      requireKeys(f, ['w', 'h', 'ox', 'oy', 'ax', 'ay'], path)
      const frame: PackedWeatherCelFrame = {
        w: requireInt(f.w, `${path}.w`, 1, width),
        h: requireInt(f.h, `${path}.h`, 1, height),
        ox: requireInt(f.ox, `${path}.ox`, -4096, 4096),
        oy: requireInt(f.oy, `${path}.oy`, -4096, 4096),
        ax: requireInt(f.ax, `${path}.ax`, 0, width - 1),
        ay: requireInt(f.ay, `${path}.ay`, 0, height - 1),
      }
      if (frame.ax + frame.w > width || frame.ay + frame.h > height) fail(path, 'lies outside the atlas')
      return frame
    })
  }
  return { palettes, cels, atlas: { width, height, indices } }
}
