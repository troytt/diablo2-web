/**
 * Nearest palette entry, D2CMP #10049 (D2CMP 0x6fe19d30) as reached through D2Win #10190
 * (D2Win 0x6f8eed70).
 *
 * Metric: Σ (entry[c] − target[c])² over the three colour bytes; the comparison is a strict `<`,
 * so on ties the FIRST (lowest) index wins. Index 0 takes part like any other entry.
 *
 * `palette` holds 256 triplets in the palette's own byte order (an act `pal.dat` stores B, G, R) and
 * the target is given in the same order. The 1.13c weather tables always pass byte 0 == byte 2, so
 * the B/R order does not change their result.
 */
export function nearestPaletteIndex(palette: Uint8Array, c0: number, c1: number, c2: number): number {
  if (palette.length < 256 * 3) {
    throw new Error(`nearestPaletteIndex: palette has ${palette.length} bytes, need 768`)
  }
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let i = 0; i < 256; i += 1) {
    const d0 = palette[i * 3]! - c0
    const d1 = palette[i * 3 + 1]! - c1
    const d2 = palette[i * 3 + 2]! - c2
    const distance = d0 * d0 + d1 * d1 + d2 * d2
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  return best
}
