/**
 * Item `dropsound` lookup (D2Client.dll 0x6fb31e40).
 *
 * 0x6fb31e40 reads the item's ItemsTxt `dropsound` (record +0x124) — the sound the client plays when an item is
 * placed into a container / slot, and the sound a store buy request remembers in [0x6fbc9753] for the S2C 0x2A
 * result-0 reply (0x6faf709c..0x6faf70a1 -> 0x6fafb694..0x6fafb69e). Gold uses `item_gold` (221).
 */

import { getSoundIdByName113c } from '../../common/audio/sounds-113c.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'

/** Minimal item shape: base code plus an optional pre-resolved `dropSound` Sounds.txt name. */
export interface ItemDropSoundSource113c {
  readonly code?: string | undefined
  readonly dropSound?: string | undefined
}

/** Sounds.txt row of the item's `dropsound` (gold -> item_gold); 0 when the item has none. */
export function resolveItemDropSoundId113c(item: ItemDropSoundSource113c | null | undefined): number {
  if (!item) return 0
  const code = (item.code ?? '').trim().toLowerCase()
  let soundName = item.dropSound
  if (!soundName && code) {
    if (code === 'gld') {
      soundName = 'item_gold'
    } else {
      try {
        const tables = getEmbeddedDropTables() as any
        const base =
          typeof tables.getBase === 'function'
            ? tables.getBase(code)
            : (tables.weapons?.get(code) ?? tables.armor?.get(code) ?? tables.misc?.get(code))
        soundName = base?.dropsound
      } catch {
        // embedded drop tables not loaded (tests / early boot): no dropsound
      }
    }
  }
  return soundName ? (getSoundIdByName113c(soundName) ?? 0) : 0
}
