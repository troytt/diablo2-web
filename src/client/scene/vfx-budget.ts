/**
 * Graphics-preset draw budgets (port-only presentation layer; never touches simulation or netproto).
 *
 * Decorative VFX — under the `medium` / `low` graphics presets only *decorative* effects are capped per
 * frame, nearest to the camera (= the local player) first:
 *
 * - Missiles whose 1.13c `Missiles.txt` row has `CollideType = 0`: they cannot collide with units, so they
 *   are pure visuals (explosions, debris, trails, puffs, cast flashes). Every colliding missile (fire wall,
 *   blaze, inferno, frozen orb, novas, arrows...) — the real danger and hit carriers — is always drawn.
 * - One-shot overlays (`loop === false`) on units other than the local player. Looping overlays
 *   (auras, buffs, curses, states) and every overlay on the local player are always drawn.
 *
 * A skipped missile still emits its light (the light grid is built from the unit list, not from draws).
 *
 * Ground labels — {@link capGroundItemLabels} keeps the hovered label plus the labels nearest to the
 * viewport centre, in their original order.
 */

import { getMissileTxtData } from '../../common/skills/missiles-data.ts'
import type { GroundItemLabelInput } from '../../common/items/ground-items.ts'
import type { SceneEntityDrawable } from '../view/unit-drawables.ts'

const decorativeMissileCache = new Map<string, boolean>()

/** Whether `missileKey` (a `Missiles.txt` key) is a non-colliding, purely visual missile. */
export function isDecorativeMissileKey(missileKey: string): boolean {
  let cached = decorativeMissileCache.get(missileKey)
  if (cached === undefined) {
    let row: ReturnType<typeof getMissileTxtData> | undefined
    try {
      row = getMissileTxtData(missileKey)
    } catch {
      row = undefined
    }
    // Unknown rows are never treated as decorative (no guessing: draw them).
    cached = row?.collideType === 0
    decorativeMissileCache.set(missileKey, cached)
  }
  return cached
}

/** Whether `entity` counts against the decorative-VFX budget. */
export function isDecorativeVfx(entity: SceneEntityDrawable, localPlayerId: number | undefined): boolean {
  if (entity.drawableKind === 'missile') return isDecorativeMissileKey(entity.missileKey)
  if (entity.drawableKind === 'overlay') {
    return entity.loop === false && (localPlayerId === undefined || entity.ownerUnitId !== localPlayerId)
  }
  return false
}

/**
 * Pick the decorative effects to skip this frame.
 *
 * @param entities - the frame's drawables (any order).
 * @param budget - max decorative effects to draw; `Infinity` disables the cap.
 * @param camX - camera world X (the local player's screen anchor).
 * @param camY - camera world Y.
 * @returns the drawables to skip, or `null` when everything fits the budget.
 */
export function selectVfxSkipSet(
  entities: readonly SceneEntityDrawable[],
  budget: number,
  camX: number,
  camY: number,
): ReadonlySet<SceneEntityDrawable> | null {
  if (!(budget < Number.POSITIVE_INFINITY)) return null
  const cap = Math.max(0, Math.floor(budget))
  let localPlayerId: number | undefined
  for (const e of entities) {
    if (e.drawableKind === 'unit' && e.unitKind === 'player' && e.isLocalPlayer === true) {
      localPlayerId = e.unitId
      break
    }
  }
  const candidates: SceneEntityDrawable[] = []
  for (const e of entities) {
    if (isDecorativeVfx(e, localPlayerId)) candidates.push(e)
  }
  if (candidates.length <= cap) return null
  const dist = new Map<SceneEntityDrawable, number>()
  for (const e of candidates) {
    const dx = e.worldX - camX
    const dy = e.worldY - camY
    dist.set(e, dx * dx + dy * dy)
  }
  candidates.sort((a, b) => dist.get(a)! - dist.get(b)!)
  return new Set(candidates.slice(cap))
}

/**
 * Cap ground item labels: hovered labels always stay, then the labels nearest to (`centerX`, `centerY`).
 * Kept labels retain their original order (the layout pass is order-sensitive).
 */
export function capGroundItemLabels<T extends GroundItemLabelInput>(
  labels: readonly T[],
  max: number,
  centerX: number,
  centerY: number,
): readonly T[] {
  if (!(max < Number.POSITIVE_INFINITY) || labels.length <= max) return labels
  const cap = Math.max(0, Math.floor(max))
  const ranked = labels.map((label, index) => {
    const dx = label.screenX - centerX
    const dy = label.screenY - centerY
    return { index, hovered: label.isHovered === true, dist: dx * dx + dy * dy }
  })
  ranked.sort((a, b) => (a.hovered === b.hovered ? a.dist - b.dist : a.hovered ? -1 : 1))
  const keep = new Set<number>()
  for (const r of ranked) {
    if (keep.size >= cap && !r.hovered) break
    keep.add(r.index)
  }
  return labels.filter((_, index) => keep.has(index))
}
