import { ByteReader, FormatError, TruncatedDataError } from "./reader.ts"; 

/**
 * Diablo II `.pl2` palette+transform decoder.
 *
 * A PL2 is a base palette followed by a long series of *transform tables*: each
 * is 256 bytes mapping a palette index to another palette index. They are how
 * Diablo II does lighting, blending, unit colour shifts and text colours without
 * ever touching RGB — a unit under a light level or a monster variant is drawn
 * through a different transform, over the same indexed sprite. That is why the
 * decoders here keep sprites indexed and resolve colour last.
 *
 * The layout is fixed and entirely positional: one 1024-byte base palette, then
 * tables in this exact order, then a 39-byte text palette and its own transforms.
 * There is no header, no count and no directory, so the table order *is* the
 * format — hence the counts written out below rather than derived.
 *
 * Confidence note: the base palette's stored byte order is taken from the
 * reference implementation (r, g, b, unused). A swapped red/blue would only show
 * against real art, so this is re-checked when a real archive lands.
 */

/** Palette entries (one transform maps every entry). */
const PALETTE_COLORS = 256
/** Bytes per base-palette entry: r, g, b, one unused byte. */
const BASE_ENTRY_BYTES = 4
/** Base palette size in bytes (1024). */
const BASE_BYTES = PALETTE_COLORS * BASE_ENTRY_BYTES
/** Text palette entries. */
const TEXT_COLORS = 13
/** Bytes per text-palette entry (r, g, b). */
const TEXT_ENTRY_BYTES = 3
/** Light-level tables. */
const LIGHT_LEVEL_VARIATIONS = 32
/** Inverse-colour tables. */
const INV_COLOR_VARIATIONS = 16
/** Fine alpha-blend tables per coarse group. */
const ALPHA_BLEND_FINE = 256
/** Additive-blend tables. */
const ADDITIVE_BLENDS = 256
/** Multiplicative-blend tables. */
const MULTIPLY_BLENDS = 256
/** Hue-variation tables. */
const HUE_VARIATIONS = 111
/** Unnamed variation tables (kept as raw tables). */
const UNKNOWN_VARIATIONS = 14
/** Maximum-component blend tables. */
const MAX_COMPONENT_BLENDS = 256
/** Text-colour shift tables. */
const TEXT_SHIFTS = 13

/** One transform table: 256 index remaps. */
export type Pl2Transform = Uint8Array

/** A decoded PL2 palette file. */
export interface Pl2 {
  /** Base palette as 768 RGB triples, ready for the sprite decoders. */
  readonly rgb: Uint8Array
  /** Light-level tables (index into the base palette). */
  readonly lightLevels: readonly Pl2Transform[]
  /** Inverse-colour tables. */
  readonly inverseColors: readonly Pl2Transform[]
  /** Selected-unit shift. */
  readonly selectedUnitShift: Pl2Transform
  /** Alpha-blend tables, grouped coarsely then finely. */
  readonly alphaBlend: readonly (readonly Pl2Transform[])[]
  /** Additive-blend tables. */
  readonly additiveBlend: readonly Pl2Transform[]
  /** Multiplicative-blend tables. */
  readonly multiplyBlend: readonly Pl2Transform[]
  /** Hue-variation tables. */
  readonly hueVariations: readonly Pl2Transform[]
  /** Red-tone shift. */
  readonly redTones: Pl2Transform
  /** Green-tone shift. */
  readonly greenTones: Pl2Transform
  /** Blue-tone shift. */
  readonly blueTones: Pl2Transform
  /** Unnamed variation tables. */
  readonly unknownVariations: readonly Pl2Transform[]
  /** Maximum-component blend tables. */
  readonly maxComponentBlend: readonly Pl2Transform[]
  /** Darkened colour shift. */
  readonly darkenedShift: Pl2Transform
  /** Text palette as RGB triples (39 bytes). */
  readonly textRgb: Uint8Array
  /** Text-colour shift tables. */
  readonly textShifts: readonly Pl2Transform[]
}

/** Raised when a PL2 file is short or malformed. */
export class Pl2Error extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Pl2Error'
  }
}

/** Transform tables in the order they appear, and how many of each. */
const TABLE_ORDER: readonly (readonly [string, number])[] = [
  ['lightLevels', LIGHT_LEVEL_VARIATIONS],
  ['inverseColors', INV_COLOR_VARIATIONS],
  ['selectedUnitShift', 1],
  // Coarse alpha groups, each a run of fine tables.
  ['alphaBlend0', ALPHA_BLEND_FINE],
  ['alphaBlend1', ALPHA_BLEND_FINE],
  ['alphaBlend2', ALPHA_BLEND_FINE],
  ['additiveBlend', ADDITIVE_BLENDS],
  ['multiplyBlend', MULTIPLY_BLENDS],
  ['hueVariations', HUE_VARIATIONS],
  ['redTones', 1],
  ['greenTones', 1],
  ['blueTones', 1],
  ['unknownVariations', UNKNOWN_VARIATIONS],
  ['maxComponentBlend', MAX_COMPONENT_BLENDS],
  ['darkenedShift', 1],
]

/**
 * The file size a PL2 must have, in bytes: base palette, every transform, the
 * text palette and its shifts.
 *
 * @returns the expected size.
 */
export function pl2ExpectedSize(): number {
  const tables = TABLE_ORDER.reduce((sum, [, count]) => sum + count, 0) + TEXT_SHIFTS
  return BASE_BYTES + tables * PALETTE_COLORS + TEXT_COLORS * TEXT_ENTRY_BYTES
}

/**
 * Decode a PL2 file.
 *
 * @param data - the complete file.
 * @returns the palette and its transforms.
 */
export function decodePl2(data: Uint8Array): Pl2 {
  const expected = pl2ExpectedSize()
  if (data.byteLength < expected) {
    throw new TruncatedDataError('pl2', 'file', 0, expected, data.byteLength, data.byteLength)
  }
  const r = new ByteReader(data, 'pl2')

  const rgb = new Uint8Array(PALETTE_COLORS * 3)
  for (let index = 0; index < PALETTE_COLORS; index += 1) {
    rgb[index * 3] = r.u8('base r')
    rgb[index * 3 + 1] = r.u8('base g')
    rgb[index * 3 + 2] = r.u8('base b')
    r.skip(1, 'base unused')
  }

  const take = (count: number): Pl2Transform[] => {
    const tables: Pl2Transform[] = []
    for (let index = 0; index < count; index += 1) {
      tables.push(r.bytes(PALETTE_COLORS, 'table').slice())
    }
    return tables
  }
  const takeOne = (): Pl2Transform => r.bytes(PALETTE_COLORS, 'table').slice()

  const lightLevels = take(LIGHT_LEVEL_VARIATIONS)
  const inverseColors = take(INV_COLOR_VARIATIONS)
  const selectedUnitShift = takeOne()
  const alphaBlend = [
    take(ALPHA_BLEND_FINE),
    take(ALPHA_BLEND_FINE),
    take(ALPHA_BLEND_FINE),
  ]
  const additiveBlend = take(ADDITIVE_BLENDS)
  const multiplyBlend = take(MULTIPLY_BLENDS)
  const hueVariations = take(HUE_VARIATIONS)
  const redTones = takeOne()
  const greenTones = takeOne()
  const blueTones = takeOne()
  const unknownVariations = take(UNKNOWN_VARIATIONS)
  const maxComponentBlend = take(MAX_COMPONENT_BLENDS)
  const darkenedShift = takeOne()

  const textRgb = new Uint8Array(TEXT_COLORS * TEXT_ENTRY_BYTES)
  for (let index = 0; index < TEXT_COLORS; index += 1) {
    textRgb[index * 3] = r.u8('text r')
    textRgb[index * 3 + 1] = r.u8('text g')
    textRgb[index * 3 + 2] = r.u8('text b')
  }

  const textShifts = take(TEXT_SHIFTS)

  return {
    rgb,
    lightLevels, inverseColors, selectedUnitShift, alphaBlend,
    additiveBlend, multiplyBlend, hueVariations,
    redTones, greenTones, blueTones,
    unknownVariations, maxComponentBlend, darkenedShift,
    textRgb, textShifts,
  }
}

/**
 * Resolve a transform into a concrete palette.
 *
 * @param baseRgb - the base palette as RGB triples.
 * @param transform - the index remap to apply.
 * @returns a 768-byte RGB palette.
 */
export function applyTransform(baseRgb: Uint8Array, transform: Pl2Transform): Uint8Array {
  const out = new Uint8Array(PALETTE_COLORS * 3)
  for (let index = 0; index < PALETTE_COLORS; index += 1) {
    const source = (transform[index] ?? 0) * 3
    out[index * 3] = baseRgb[source] ?? 0
    out[index * 3 + 1] = baseRgb[source + 1] ?? 0
    out[index * 3 + 2] = baseRgb[source + 2] ?? 0
  }
  return out
}

const RAND_TRANSFORMS_113C_B64 =
  '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lpaWl5mZmpmeo56foKGio6TY3KKeo6OkrK2ur7Cxs7O0tbW3t7m6ury6vr7AFsXDxcXGx8jIysvLzc7O0NHSnx2g1tbY2dnb3N3epOCs4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AIiIiImMuo2MkZeXmZKWra8RsxO6FRbGjRmQG9EdHh8grK2ur7CIiLGIiIiIiLOJiYm1iYmJjLq6jYyMjI2MjI2NjYyNjI6NkMWRjZCSkJOTk5KQkpOTlZOXlZaXlpWWl5aX2JaXmZqZl5mamZmemaOIEYmJiYyNjYyOkJCTkJOSl5KWl5manoiJjImMjZCOkJOSk5WVlpeZmZqXnqOekp/YmqPf2NyanqOj36ytrq+wsRGztLW1t7e5urq8ur6+wMDFw8WNxsfIyMqQks3OztDR0p8d2NbW2NnZ29zd3t/grOLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/wCIiIiJiomNjI6Rl5mSlq2vEbMTuhUWxo0ZkBvRHR4fIKytrq6wiIixiIiIiIiIiYmJiYmJiYyJuomMjImNjIyNjI2MjYyOjpGQjo6QkJCRkZGQkJKTkZKTkZOWl5WUlpeVl5iWl5mYl5eYmpeYmpmjiBGJiYqMjY2MjI2QkZCTkpeSlZeYmp2IiYqJjI2OjJCRkpOVlZaXmJial5yenZKV2Jqj39jcmpyjnt+sra6vsLERs7S1tbe3ubq6vLq+vsDAjcONjcbHyBnKkJLNzs3Q0dKS0tjW1tjZ2dvc3d7f4Kzi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8AiIiIiYqJiYqOkZGckpWtrxGzE7oVFsONGZAb0R0eHyCsrK2usIiIsYiIiIiIiImIiomJiYmKibqJjIqJiYyMjIyOjI2Kjo6OjYyOkJCOkZGRkJGSkZGSkZGUlJGUlJSXlJeYlJeYmJeXmJyXl5yYnYiIiYmKioyMioyOjpGRkZKRlJSXmJiciImKiYyNjoyRkZCRlJSUl5iYnJecnZySldiand/Y25qcnZ3frK2ur7CxEbO0tbS3E7m6ury6vr7AwI3DjY3Gx8gZypCSzc7N0NHSktKW1tbY2dnb3N3e3+Cs4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AIiIiImKiYuOjpGUnJKVra8RsxO6FRbG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'

const COLD_TRANSFORM_108_B64 =
  'AIiIierq6o+Pj4+bnJubrYiIierqj4+Pj4+Pj5ubm50grK2IiIiIiIiIiIiJiYmJiYnq6urq6urqj4/q6o+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ucm5udm9+IiOrqieqPj4+Pj4+Pj5ubm5ubm5ubnYjq6uqPj4+Pj4+bm5ubm5ubm5ybnZ2dm5ubnd/fm52dnd/f36ytroiIiImJiYuL6urqj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj5ubm5ubm5ubm5ubm5ubm52d39/fm4iIiIiIieqJ6qyIiIiIiYmJi4vq6uqPj4+Pj4+P/w=='

const POISON_TRANSFORM_104_B64 =
  'AHFxdXV1eXl5eXmBh4GFD3F1dXV5eXl5eXl5gYGFhaIgrK1xcXFxcXFxcXF1dXV1dXV1dXV5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXmBeYF5eYGBgYGBgYGBgYWBhYWFhYWFhYWFoYWFhYWhhYWih6RxdXV1dXl5eXl5eXl5eYGBgYGFhYWhonF5dXV5eXl5eYGBgYWFhYWFhYeFoqKigYWFoamkhaGioaSppKytcXFxcXV1dXV1eXl5eXl5eXl5eXl5eXl5eXl5eYF5gYGBgYGBhYWFhYWFhYWFh6GipKSkhXFxcXF1dXV1eaxxcXFxdXV1dXV1dXl5eXl5eXmB/w=='

const B64_LOOKUP = new Uint8Array(128)
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (let i = 0; i < B64_ALPHABET.length; i += 1) {
  B64_LOOKUP[B64_ALPHABET.charCodeAt(i)] = i
}

function decodeBase64Bytes(b64: string): Uint8Array {
  const cleanLen = b64.length
  let pad = 0
  if (cleanLen >= 1 && b64.charCodeAt(cleanLen - 1) === 61) pad += 1
  if (cleanLen >= 2 && b64.charCodeAt(cleanLen - 2) === 61) pad += 1
  const outLen = ((cleanLen * 3) >> 2) - pad
  const out = new Uint8Array(outLen)
  let outIdx = 0
  for (let i = 0; i < cleanLen; i += 4) {
    const c0 = B64_LOOKUP[b64.charCodeAt(i)] ?? 0
    const c1 = B64_LOOKUP[b64.charCodeAt(i + 1)] ?? 0
    const c2 = B64_LOOKUP[b64.charCodeAt(i + 2)] ?? 0
    const c3 = B64_LOOKUP[b64.charCodeAt(i + 3)] ?? 0
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3
    if (outIdx < outLen) out[outIdx++] = (triple >> 16) & 0xff
    if (outIdx < outLen) out[outIdx++] = (triple >> 8) & 0xff
    if (outIdx < outLen) out[outIdx++] = triple & 0xff
  }
  return out
}

const rawRandTransforms = decodeBase64Bytes(RAND_TRANSFORMS_113C_B64)

/**
 * Authentic 1.13c `data\global\monsters\RandTransforms.dat` (30 x 256-byte monster colormap shifts).
 * Used by `D2CMP.dll` / `D2Client.dll` for Unique bosses, Champions, and `MonStats.txt` `TransLvl` shifts.
 */
export const RAND_TRANSFORMS_113C: readonly Pl2Transform[] = Array.from({ length: 30 }, (_, idx) =>
  rawRandTransforms.subarray(idx * PALETTE_COLORS, (idx + 1) * PALETTE_COLORS),
)

/** Authentic 1.13c Cold/Freeze state shift (`States.txt` `colorpri=100, colorshift=108` -> `hueVariations[107]`). */
export const DEFAULT_COLD_TRANSFORM_113C: Pl2Transform = decodeBase64Bytes(COLD_TRANSFORM_108_B64)

/** Authentic 1.13c Poison state shift (`States.txt` `colorpri=95, colorshift=104` -> `hueVariations[103]`). */
export const DEFAULT_POISON_TRANSFORM_113C: Pl2Transform = decodeBase64Bytes(POISON_TRANSFORM_104_B64)

/** Authentic 1.13c Unique boss gold/amber colormap shift (`RandTransforms.dat` row 4). */
export const DEFAULT_UNIQUE_TRANSFORM_113C: Pl2Transform = RAND_TRANSFORMS_113C[4]!

/** Authentic 1.13c Champion/Elite royal blue/violet colormap shift (`RandTransforms.dat` row 24). */
export const DEFAULT_CHAMPION_TRANSFORM_113C: Pl2Transform = RAND_TRANSFORMS_113C[24]!

/**
 * 16 canonical 256-byte color variation remap tables (`rows 1..16` in the hardware palette texture):
 * - Index 0 (Row 1): Cold / Freeze shift (`States.txt` shift 108)
 * - Index 1 (Row 2): Poison shift (`States.txt` shift 104)
 * - Index 2 (Row 3): Unique Boss Gold/Amber (`RandTransforms[4]`)
 * - Index 3 (Row 4): Champion / Elite Royal Blue/Violet (`RandTransforms[24]`)
 * - Indices 4..15 (Rows 5..16): Authentic 1.13c `RandTransforms.dat` monster/item color variations
 */
export const DEFAULT_INV_COLOR_VARIATIONS_113C: readonly Pl2Transform[] = [
  DEFAULT_COLD_TRANSFORM_113C,
  DEFAULT_POISON_TRANSFORM_113C,
  DEFAULT_UNIQUE_TRANSFORM_113C,
  DEFAULT_CHAMPION_TRANSFORM_113C,
  RAND_TRANSFORMS_113C[0]!,
  RAND_TRANSFORMS_113C[1]!,
  RAND_TRANSFORMS_113C[2]!,
  RAND_TRANSFORMS_113C[3]!,
  RAND_TRANSFORMS_113C[5]!,
  RAND_TRANSFORMS_113C[6]!,
  RAND_TRANSFORMS_113C[9]!,
  RAND_TRANSFORMS_113C[12]!,
  RAND_TRANSFORMS_113C[15]!,
  RAND_TRANSFORMS_113C[18]!,
  RAND_TRANSFORMS_113C[21]!,
  RAND_TRANSFORMS_113C[27]!,
]

/** Expected byte size of a packed `palette.bin` containing 17 rows x 256 colors x 3 RGB bytes (13,056 bytes). */
export const PACKED_PALETTE_BIN_BYTES = (1 + INV_COLOR_VARIATIONS) * PALETTE_COLORS * 3

/**
 * Encode a 768-byte base RGB palette and 16 x 256-byte color variation tables into a 13,056-byte
 * (`17 * 256 * 3`) pre-resolved 17-row RGB `palette.bin` buffer.
 *
 * Row 0 (`0..767`) holds the base Act palette (index 0 set to `0,0,0`).
 * Rows 1..16 (`r * 768 .. (r + 1) * 768 - 1`) hold pre-resolved RGB triples for each of the 16
 * color variation tables (`baseRgb[variation[colorIndex]]`, with index 0 forced to `0,0,0`).
 */
export function encodePaletteBin(
  rgb: Uint8Array,
  variations: readonly Pl2Transform[] = DEFAULT_INV_COLOR_VARIATIONS_113C,
): Uint8Array {
  if (rgb.byteLength < 768) {
    throw new TruncatedDataError('palette.bin', 'rgb', 0, 768, rgb.byteLength, rgb.byteLength)
  }
  const out = new Uint8Array(PACKED_PALETTE_BIN_BYTES)
  out.set(rgb.subarray(0, 768), 0)
  out[0] = 0
  out[1] = 0
  out[2] = 0
  for (let i = 0; i < INV_COLOR_VARIATIONS; i += 1) {
    const table = variations[i] ?? DEFAULT_INV_COLOR_VARIATIONS_113C[i]!
    const rowOffset = (i + 1) * 768
    out[rowOffset] = 0
    out[rowOffset + 1] = 0
    out[rowOffset + 2] = 0
    for (let colorIndex = 1; colorIndex < PALETTE_COLORS; colorIndex += 1) {
      const mapped = table[colorIndex] ?? colorIndex
      const srcOffset = mapped * 3
      const dstOffset = rowOffset + colorIndex * 3
      out[dstOffset] = rgb[srcOffset] ?? 0
      out[dstOffset + 1] = rgb[srcOffset + 1] ?? 0
      out[dstOffset + 2] = rgb[srcOffset + 2] ?? 0
    }
  }
  return out
}

/**
 * Decode a `palette.bin` buffer (supports 13,056-byte 17-row RGB, 4,864-byte RGB + 16 index tables, or 768-byte base RGB).
 */
export function decodePaletteBin(bytes: Uint8Array): {
  readonly rgb: Uint8Array
  readonly variations: readonly Pl2Transform[]
  readonly rows: readonly Uint8Array[]
} {
  if (bytes.byteLength < 768) {
    throw new TruncatedDataError('palette.bin', 'rgb', 0, 768, bytes.byteLength, bytes.byteLength)
  }
  const rgb = bytes.subarray(0, 768)
  if (bytes.byteLength >= PACKED_PALETTE_BIN_BYTES) {
    const rows: Uint8Array[] = []
    for (let r = 0; r < 1 + INV_COLOR_VARIATIONS; r += 1) {
      rows.push(bytes.subarray(r * 768, (r + 1) * 768))
    }
    return { rgb, variations: DEFAULT_INV_COLOR_VARIATIONS_113C, rows }
  }
  const legacyPackedBytes = 768 + INV_COLOR_VARIATIONS * PALETTE_COLORS
  const variations: Pl2Transform[] = []
  if (bytes.byteLength >= legacyPackedBytes) {
    for (let i = 0; i < INV_COLOR_VARIATIONS; i += 1) {
      const offset = 768 + i * PALETTE_COLORS
      variations.push(bytes.subarray(offset, offset + PALETTE_COLORS))
    }
  } else {
    variations.push(...DEFAULT_INV_COLOR_VARIATIONS_113C)
  }
  const rows: Uint8Array[] = [rgb]
  for (let i = 0; i < INV_COLOR_VARIATIONS; i += 1) {
    const row = applyTransform(rgb, variations[i]!)
    row[0] = 0
    row[1] = 0
    row[2] = 0
    rows.push(row)
  }
  return { rgb, variations, rows }
}

