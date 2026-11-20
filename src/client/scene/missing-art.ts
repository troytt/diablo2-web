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

export interface PreloadMissEntry {
  readonly kind: 'loading-not-preloaded'
  readonly category: string
  readonly id: string
  readonly detail?: string | undefined
  readonly firstSeenAt: number
  resolvedAt?: number | undefined
  durationMs?: number | undefined
  framesLoading: number
}

declare global {
  interface Window {
    __d2MissingArt?: MissingArtEntry[]
    __d2PreloadMisses?: PreloadMissEntry[]
  }
}

const missingArtRegistry = new Map<string, MissingArtEntry>()
const missingArtList: MissingArtEntry[] = []

const preloadMissRegistry = new Map<string, PreloadMissEntry>()
const preloadMissList: PreloadMissEntry[] = []

if (typeof window !== 'undefined') {
  if (!window.__d2MissingArt) {
    window.__d2MissingArt = missingArtList
  }
  if (!window.__d2PreloadMisses) {
    window.__d2PreloadMisses = preloadMissList
  }
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

/**
 * Record a live on-screen entity whose art pack was still `'loading'` (uncached at spawn /
 * slow pack decode, Issue #1775). Kept separate from `window.__d2MissingArt` so permanent
 * `missing-pack` assertions remain strict while preload misses are observable.
 */
export function reportPreloadMiss(category: string, id: string, detail?: string): void {
  const normCategory = category.trim() || 'unknown'
  const normId = id.trim() || 'unknown'
  const key = `${normCategory}:${normId}`
  const existing = preloadMissRegistry.get(key)
  if (existing !== undefined) {
    if (existing.resolvedAt === undefined) {
      existing.framesLoading += 1
    }
    return
  }
  const entry: PreloadMissEntry = {
    kind: 'loading-not-preloaded',
    category: normCategory,
    id: normId,
    ...(detail !== undefined ? { detail } : {}),
    firstSeenAt: Date.now(),
    framesLoading: 1,
  }
  preloadMissRegistry.set(key, entry)
  preloadMissList.push(entry)
  if (typeof window !== 'undefined') {
    window.__d2PreloadMisses = preloadMissList
  }
}

export function resolvePreloadMiss(category: string, id: string): void {
  const normCategory = category.trim() || 'unknown'
  const normId = id.trim() || 'unknown'
  const existing = preloadMissRegistry.get(`${normCategory}:${normId}`)
  if (existing !== undefined && existing.resolvedAt === undefined) {
    const now = Date.now()
    existing.resolvedAt = now
    existing.durationMs = Math.max(0, now - existing.firstSeenAt)
  }
}

export function getPreloadMissEntries(): readonly PreloadMissEntry[] {
  return preloadMissList
}

export function clearPreloadMissEntries(): void {
  preloadMissRegistry.clear()
  preloadMissList.length = 0
  if (typeof window !== 'undefined') {
    window.__d2PreloadMisses = preloadMissList
  }
}
