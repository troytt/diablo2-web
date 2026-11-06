import type { NpcDef } from './quests.ts'
export type { NpcDef }

/**
 * Whether a packed scene entry carries its own sprite frame.
 *
 * Two render passes branch on this: the object/sprite layer draws the entry only
 * when it is true, and the placeholder-box layer draws only when it is false.
 * They must agree exactly or an NPC ends up with a box painted over its art, so
 * the test lives here once instead of being copied into both call sites.
 *
 * Declared as a type guard so the sprite layer gets `frame` narrowed to
 * non-null from the same call that gates it, leaving no second check to drift.
 */
export function hasPackedSprite<TFrame>(
  entry: { readonly frame?: TFrame | null }
): entry is { readonly frame: TFrame } {
  return entry.frame !== undefined && entry.frame !== null
}

