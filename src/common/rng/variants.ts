import type { Side } from '../world/world-graph.ts'
import { oppositeSide } from '../world/world-graph.ts'

export { oppositeSide }
export type { Side }

export interface VariantCandidate {
  readonly label?: string
  readonly ds1?: string
  readonly slug?: string
  readonly act?: number
  readonly levelId?: number
}

/**
 * Extract the compass direction / orientation from a variant's label or DS1 filename.
 *
 * Each variant (e.g. TownN1, TownE1, TownS1, TownW1) represents an independent town
 * structure with an exit gate in that specific compass direction, not a quadrant.
 *
 * - `TownN1` / `townn1` / `LutN` -> `north`
 * - `TownS1` / `towns1` -> `south`
 * - `TownE1` / `towne1` / `CourtE` -> `east`
 * - `TownW1` / `townw1` / `LutW` / `CourtW` -> `west`
 */
export function variantOrientation(candidate: VariantCandidate): Side | undefined {
  const key = `${candidate.label ?? ''} ${candidate.ds1 ?? ''}`.toLowerCase()
  if (key.includes('townn') || key.includes('lutn') || key.includes('courtn') || key.includes('-north')) {
    return 'north'
  }
  if (key.includes('towns') || key.includes('luts') || key.includes('courts') || key.includes('-south')) {
    return 'south'
  }
  if (key.includes('towne') || key.includes('lute') || key.includes('courte') || key.includes('-east')) {
    return 'east'
  }
  if (key.includes('townw') || key.includes('lutw') || key.includes('courtw') || key.includes('-west')) {
    return 'west'
  }
  return undefined
}

/**
 * Find the candidate variant whose gate / exit orientation matches the required compass side.
 *
 * When travelling between abutting levels across a seam, if the player exits level A heading
 * `fromSide`, the arrival level B must have its corresponding entrance on `oppositeSide(fromSide)`.
 */
export function findMatchingVariant<T extends VariantCandidate>(
  candidates: readonly T[],
  requiredSide?: Side | string,
  variantSeed = 0,
): T | undefined {
  if (candidates.length === 0) return undefined
  if (candidates.length === 1 || requiredSide === undefined || requiredSide === '') {
    return candidates[Math.abs(variantSeed) % candidates.length]
  }

  const side = requiredSide.toLowerCase() as Side
  const matched = candidates.find(c => variantOrientation(c) === side)
  return matched ?? candidates[Math.abs(variantSeed) % candidates.length]
}

/**
 * Get the default town variant for a given act when starting fresh in town.
 *
 * - In Act 1: The Blood Moor (Level 2) has its palisade gate on the North (`Town S Transition`),
 *   so Rogue Encampment (Level 1) must exit to the South (`TownS1.ds1` / `towns1`).
 * - In Act 2: Rocky Waste (Level 41) has its town seam on the South (`Act 2 - Town Seam`),
 *   so Lut Gholein (Level 40) must exit to the North (`LutN.ds1` / `lutn`).
 * - Other acts default to their single town entry.
 */
export function getDefaultTownVariant<T extends VariantCandidate>(
  forAct: readonly T[],
  act: number,
): T | undefined {
  if (act === 1) {
    const towns = forAct.find(c => variantOrientation(c) === 'south')
    if (towns !== undefined) return towns
  } else if (act === 2) {
    const lutn = forAct.find(c => variantOrientation(c) === 'north')
    if (lutn !== undefined) return lutn
  }
  return forAct.find(c => (c.slug ?? '').includes('town')) ?? forAct[0]
}
