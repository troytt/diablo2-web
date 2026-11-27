/**
 * Extra hardware palette rows for per-unit colormaps (issue #1516 / #1517).
 *
 * The renderer's palette texture holds the act palette (row 0) and the fixed variation rows 1..PALETTE_ROWS-1.
 * Monster colormaps (palshift.dat / RandTransforms.dat, `monster-colormap-113c.ts`) are appended after them on
 * demand: {@link colormapPaletteRow} hands out one row per distinct 256-byte table and notifies the renderer, which
 * re-uploads the palette texture with the new rows remapped through the current act palette.
 */

import type { Pl2Transform } from '../../common/formats/pl2.ts'

/** First row handed out for extra colormaps (= renderer `PALETTE_ROWS`). */
export const EXTRA_COLORMAP_FIRST_ROW = 17
/** Rows the vertex encoding can address: `a_palette = liftY * PALETTE_ROW_STRIDE + row`. */
export const PALETTE_ROW_STRIDE = 1024

const rows = new Map<Pl2Transform, number>()
const tables: Pl2Transform[] = []
const listeners = new Set<() => void>()

/** Palette row for a colormap table (registered on first use). */
export function colormapPaletteRow(table: Pl2Transform): number {
  const known = rows.get(table)
  if (known !== undefined) return known
  const row = EXTRA_COLORMAP_FIRST_ROW + tables.length
  if (row >= PALETTE_ROW_STRIDE) throw new RangeError(`palette row ${String(row)} exceeds the vertex encoding`)
  rows.set(table, row)
  tables.push(table)
  for (const listener of listeners) listener()
  return row
}

/** Registered extra tables, in row order (row = EXTRA_COLORMAP_FIRST_ROW + index). */
export function extraColormapTables(): readonly Pl2Transform[] {
  return tables
}

export function onExtraColormapsChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
