import { FormatError } from "./reader.ts";


/**
 * Palette formats.
 *
 * Both Diablo I and classic Diablo II store a palette as 256 VGA triples in
 * 768 bytes; Diablo II additionally ships `.pl2` files, which carry the palette
 * plus per-entity colour shifts (not implemented until a real `.pl2` is at
 * hand — see the note at the end of this file).
 */

/** A decoded 256-colour palette. */
export interface Palette {
  /** RGB triples, 0..255, 768 bytes. */
  readonly rgb: Uint8Array
  /** Number of entries (always 256 for the supported formats). */
  readonly size: number
}

/** Raised when a palette file is not the supported variant. */
export class PaletteError extends Error {}

/**
 * Decode a raw 768-byte palette (`.pal`).
 *
 * @param data - the complete file.
 * @returns the palette.
 */
export function decodePal(data: Uint8Array): Palette {
  if (data.byteLength < 768) {
    throw new PaletteError(`palette is ${String(data.byteLength)} bytes, expected at least 768`)
  }
  return { rgb: data.subarray(0, 768), size: 256 }
}

/**
 * Decode a 256-byte colour translation table (`.trn`).
 *
 * A translation table is a per-index remap applied when drawing: Diablo uses it
 * for monster variants (a red skeleton, a black bow skeleton, ...) so one
 * sprite set serves several looks. That is exactly the use case Diablo II's
 * palette shifts cover too, so the mechanism is shared.
 *
 * @param data - the complete file.
 * @returns a 256-entry index remap.
 */
export function decodeTrn(data: Uint8Array): Uint8Array {
  if (data.byteLength !== 256) {
    throw new PaletteError(`translation table is ${String(data.byteLength)} bytes, expected 256`)
  }
  return data
}


/**
 * Expand palette indices into RGBA, optionally through a translation table.
 *
 * @param indices - one palette index per pixel.
 * @param mask - 1 where the pixel is opaque, 0 where transparent.
 * @param palette - the palette to resolve colours with.
 * @param trn - optional index remap applied before the palette lookup.
 * @returns RGBA8 pixels matching the index buffer's layout.
 */
export function indicesToRgba(
  indices: Uint8Array,
  mask: Uint8Array,
  palette: Palette,
  trn?: Uint8Array,
): Uint8ClampedArray {
  if (mask.length < indices.length) {
    throw new FormatError('pal', 'mask', mask.length, 'mask buffer smaller than indices buffer');
  }
  if (trn !== undefined && trn.length < 256) {
    throw new FormatError('pal', 'trn', trn.length, 'translation table smaller than 256 entries');
  }
  if (palette.rgb.length < 768) {
    throw new FormatError('pal', 'palette', palette.rgb.length, 'palette RGB buffer smaller than 768 bytes');
  }

  const rgba = new Uint8ClampedArray(indices.length * 4)
  for (let i = 0; i < indices.length; i += 1) {
    if (mask[i] === 0) continue
    // palette.rgb is 768 bytes (which safely covers 255 * 3 + 2).
    const index = trn === undefined ? indices[i]! : trn[indices[i]!]!
    const at = index * 3
    rgba[i * 4] = palette.rgb[at]!
    rgba[i * 4 + 1] = palette.rgb[at + 1]!
    rgba[i * 4 + 2] = palette.rgb[at + 2]!
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

// Diablo II's `.pl2` carries more than a palette: five act palettes plus
// "transformation" tables indexed by unit type. Its layout only earns trust
// against a real file, so it lands with the rest of the D2 decoders rather than
// being written blind here.
