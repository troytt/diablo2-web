/**
 * Pure runtime VA execution tracer for 1.13c D2Game.dll and D2Common.dll kernel functions.
 *
 * Zero host imports, zero wall-clock access, and near-zero inactive fast path (`if (!active) return`).
 */

let active = false
const d2GameHits = new Set<number>()
const d2CommonHits = new Set<number>()

function formatHexVa32(va: number): string {
  return `0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

export function beginVaTrace113c(): void {
  d2GameHits.clear()
  d2CommonHits.clear()
  active = true
}

export function endVaTrace113c(): Set<string> {
  active = false
  const out = new Set<string>()
  for (const va of d2CommonHits) {
    out.add(`D2Common:${formatHexVa32(va)}`)
  }
  for (const va of d2GameHits) {
    out.add(`D2Game:${formatHexVa32(va)}`)
  }
  d2CommonHits.clear()
  d2GameHits.clear()
  return out
}

export function isVaTraceActive113c(): boolean {
  return active
}

export function hitD2GameVa113c(va: number): void {
  if (!active) return
  d2GameHits.add(va >>> 0)
}

export function hitD2CommonVa113c(va: number): void {
  if (!active) return
  d2CommonHits.add(va >>> 0)
}
