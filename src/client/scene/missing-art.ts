/**
 * One-shot missing-art reporting (`src/client/scene/missing-art.ts`).
 *
 * Extracted from `world-renderer.ts` so the drawable-build path
 * (`view/unit-drawables.ts`) can report data faults the same way the draw path does,
 * without an import cycle. Reports once per `(category, id)` pair, logs via
 * `console.error`, and records entries in `window.__d2MissingArt` for automated
 * browser verification. Never throws synchronous exceptions inside the RAF loop.
 */

export interface MissingArtEntry {
  readonly category: string
  readonly id: string
  readonly detail?: string | undefined
  readonly timestamp: number
}

declare global {
  interface Window {
    __d2MissingArt?: MissingArtEntry[]
  }
}

const missingArtRegistry = new Map<string, MissingArtEntry>()
const missingArtList: MissingArtEntry[] = []

if (typeof window !== 'undefined' && !window.__d2MissingArt) {
  window.__d2MissingArt = missingArtList
}

export function reportMissingArt(category: string, id: string, detail?: string): void {
  const normCategory = category.trim() || 'unknown'
  const normId = id.trim() || 'unknown'
  const key = `${normCategory}:${normId}`
  if (missingArtRegistry.has(key)) return
  const entry: MissingArtEntry = {
    category: normCategory,
    id: normId,
    ...(detail !== undefined ? { detail } : {}),
    timestamp: Date.now(),
  }
  missingArtRegistry.set(key, entry)
  missingArtList.push(entry)
  if (typeof window !== 'undefined') {
    window.__d2MissingArt = missingArtList
  }
  console.error(`[D2MissingArt] ${normCategory}:${normId}${detail ? ` — ${detail}` : ''}`)
}

export function getMissingArtEntries(): readonly MissingArtEntry[] {
  return missingArtList
}

export function clearMissingArtEntries(): void {
  missingArtRegistry.clear()
  missingArtList.length = 0
  if (typeof window !== 'undefined') {
    window.__d2MissingArt = missingArtList
  }
}
