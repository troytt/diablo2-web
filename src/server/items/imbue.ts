/**
 * Server Authoritative 1.13c Charsi Imbue (`D2Game.dll` `QUESTS_Act1Q5_ImbueItem` @ `0x6fce0310`).
 *
 * Re-exports `computeCharsiImbueIlvl`, `isEligibleForCharsiImbue113c`, `CharsiImbueOptions`,
 * and `imbueItem113c` from `src/common/items/drop-tables.ts` (plus `imbueItemData113c` and
 * `imbueUiInventoryItem113c` from `src/common/items/item-bridge.ts`), and provides the
 * server convenience wrapper `imbueItemCharsi` with automatic `getEmbeddedDropTables()` fallback.
 */

import {
  computeCharsiImbueIlvl,
  imbueItem113c,
  isEligibleForCharsiImbue113c as commonIsEligibleForCharsiImbue113c,
  type CharsiImbueOptions,
} from '../../common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import type { Item } from '../../common/items/items.ts'
import {
  imbueItemData113c,
  imbueUiInventoryItem113c,
} from '../../common/items/item-bridge.ts'

export function isEligibleForCharsiImbue113c(
  itemOrCode: Parameters<typeof commonIsEligibleForCharsiImbue113c>[0] | string,
  dropTables?: Parameters<typeof commonIsEligibleForCharsiImbue113c>[1],
): boolean {
  const normalized =
    typeof itemOrCode === 'string'
      ? { code: itemOrCode, quality: 'normal' as const, sockets: 0, identified: true }
      : itemOrCode
  return commonIsEligibleForCharsiImbue113c(normalized, dropTables)
}

export {
  computeCharsiImbueIlvl,
  imbueItem113c,
  imbueItemData113c,
  imbueUiInventoryItem113c,
  isEligibleForCharsiImbue113c as canImbueItem113c,
  type CharsiImbueOptions,
  type CharsiImbueOptions as ImbueItemOptions,
}

export type ImbueItemResult = ReturnType<typeof imbueItem113c>

export * from '../../common/items/affix-generator.ts'

/**
 * Server-authoritative Charsi Imbue helper that defaults `dropTables` to `getEmbeddedDropTables()`
 * when not explicitly provided in `options`.
 */
export function imbueItemCharsi(
  itemOrCode: Item | Record<string, unknown> | string,
  playerLevel = 1,
  options?: CharsiImbueOptions,
): ReturnType<typeof imbueItem113c> {
  const dropTables = options?.dropTables ?? getEmbeddedDropTables()
  const effectivePlayerLevel = options?.playerLevel ?? playerLevel
  return imbueItem113c(itemOrCode, effectivePlayerLevel, {
    ...options,
    dropTables,
  })
}
