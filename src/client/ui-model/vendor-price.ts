/**
 * Vendor price provider contract (`src/client/ui-model/vendor-price.ts`).
 *
 * D2Client prices store items locally with D2Common #10107 (repair-all: #10071) for the tooltip and the
 * `0x32 NpcBuy` / `0x33 NpcSell` cost field; D2Game ignores that field and prices server-side. The HUD never
 * derives a price itself: `HudModel` receives these functions through its options, and opening a store
 * without them throws (no fallback price). Production wiring injects {@link vendorPrice113c} /
 * {@link vendorRepairAll113c}; tests inject stubs.
 */

import type { ItemData } from '../../netproto/index.ts'
import type { ClientWorld } from '../world/client-world.ts'
import { priceItem113c, repairAllCost113c } from './transaction-cost-input.ts'

/** Pricing inputs: the server-mirrored world (clvl, difficulty, quests, reduced-price stats) and the NPC class. */
export interface VendorPriceContext {
  readonly world: ClientWorld
  /** MonStats hcIdx of the store NPC (e.g. 147 = Gheed). */
  readonly npcClass: number
}

/** Transaction type `0` buy, `1` sell, `2` gamble, `3` repair; returns the displayed / sent gold amount. */
export type VendorPriceFn = (item: ItemData, type: 0 | 1 | 2 | 3, ctx: VendorPriceContext) => number

/** "Repair all equipment: %d" total (patchstring 10095) for the player's equipped items. */
export type VendorRepairAllFn = (ctx: VendorPriceContext) => number

/** D2Common 1.13c #10107 port. */
export const vendorPrice113c: VendorPriceFn = (item, type, ctx) => priceItem113c(ctx.world, item, type, ctx.npcClass)

/** D2Common 1.13c #10071 port. */
export const vendorRepairAll113c: VendorRepairAllFn = (ctx) => repairAllCost113c(ctx.world, ctx.npcClass)
