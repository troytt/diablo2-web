/**
 * Pure Ground Item Bounce Physics & Pickup Reach Geometry (`src/common/items/ground-item-physics.ts`).
 *
 * Shared across `src/common/`, `src/server/`, and `src/client/`.
 * Zero DOM or Node globals.
 */

import type { UiInventoryItem } from './inventory-model.ts'
import type { Item } from './items.ts'
import { ORTHO_SUB_TILE_WIDTH } from '../world/d2map.ts'

export interface GroundItemBounceState {
  startTime: number
  durationMs: number
  peakHeightPx: number
  phase?: 'primary' | 'secondary'
}

export type GroundItemSource = UiInventoryItem | Item | any

export interface GroundItemEntity {
  readonly id: string
  readonly item: GroundItemSource
  name: string
  nameZh: string
  readonly quality: string
  readonly isGold: boolean
  amount: number
  readonly goldAmount?: number | undefined
  readonly invWidth: number
  readonly invHeight: number
  readonly dropTime: number
  x: number // World pixel coordinate X
  y: number // World pixel coordinate Y
  cellX: number // Map cell coordinate X
  cellY: number // Map cell coordinate Y

  /** Sparkle animation phase (0..2*Math.PI) */
  sparklePhase: number

  /** Optional bounce animation state (for inventory-full or dropped items) */
  bounceState?: GroundItemBounceState | null

  /** Authentic drop sound effect identifier from MPQ dropsound column */
  readonly dropSound?: string | undefined
  /** Authentic animation frame index at which drop SFX plays (default: 12) */
  readonly dropSfxFrame?: number | undefined
  /** Whether drop SFX has already played for this bounce sequence */
  sfxPlayed?: boolean | undefined
  /** Whether the underlying item is ethereal (D2 1.13c gray ground label rule) */
  readonly ethereal?: boolean | undefined
  /** Total number of sockets on the underlying item (D2 1.13c gray ground label rule) */
  readonly sockets?: number | undefined
}

export const PLAYER_COLLISION_EXTENT_PX = ORTHO_SUB_TILE_WIDTH // 16px
export const ITEM_COLLISION_EXTENT_PX = ORTHO_SUB_TILE_WIDTH // 16px
export const D2_PICKUP_SUBTILE_REACH_PX = 4 * ORTHO_SUB_TILE_WIDTH // 64px

/**
 * Computes the edge-to-edge distance between a player's collision box and a ground item's collision box.
 */
export function getPickupEdgeDistance(
  playerX: number,
  playerY: number,
  itemX: number,
  itemY: number,
  playerExtentPx = PLAYER_COLLISION_EXTENT_PX,
  itemExtentPx = ITEM_COLLISION_EXTENT_PX,
): number {
  const centerDist = Math.hypot(itemX - playerX, itemY - playerY)
  return Math.max(0, centerDist - (playerExtentPx + itemExtentPx))
}

/**
 * Checks whether a ground item is within authentic Diablo II v1.13c pickup reach (`<= 4` sub-tiles / `64px` edge-to-edge)
 * of the player's collision box.
 */
export function isWithinPickupBounds(
  playerX: number,
  playerY: number,
  itemX: number,
  itemY: number,
  maxEdgeReachPx = D2_PICKUP_SUBTILE_REACH_PX,
): boolean {
  return getPickupEdgeDistance(playerX, playerY, itemX, itemY) <= maxEdgeReachPx
}

/** Calculate parabolic bounce height h(t) at timestamp now. */
export function calculateBounceHeight(bounceState: GroundItemBounceState, now: number): number {
  const elapsed = now - bounceState.startTime
  if (elapsed <= 0 || elapsed >= bounceState.durationMs) return 0

  const p = elapsed / bounceState.durationMs
  // Parabolic equation: h(p) = 4 * H * p * (1 - p)
  return Math.max(0, 4 * bounceState.peakHeightPx * p * (1 - p))
}

/**
 * Trigger authentic Diablo II v1.13c parabolic flippy bounce animation on a ground item.
 * - Primary phase: duration ~350ms, peak height ~28px.
 * - Secondary phase: duration ~175ms, peak height ~7px.
 */
export function triggerFlippyBounce(
  entity: GroundItemEntity,
  now = 0,
  options?: Partial<GroundItemBounceState>,
): void {
  entity.bounceState = {
    startTime: now,
    durationMs: options?.durationMs ?? 350,
    peakHeightPx: options?.peakHeightPx ?? 28,
    phase: options?.phase ?? 'primary',
  }
  entity.sfxPlayed = false
}
