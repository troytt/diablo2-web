import type { Potion } from './auto-potion.ts'
import { areBeltPotionsCompatible, BELT_COLS, itemToBeltPotion, type BeltModel, type BeltPotion } from '../../common/items/belt-model.ts'

export type BeltSlots = Pick<BeltModel, 'findAutoPlacePotionSlot' | 'getSlot'>
export type BeltColumnKinds = readonly (BeltPotion | null)[]

export const beltColumnKinds = (belt: BeltSlots, remembered: BeltColumnKinds = []): BeltColumnKinds =>
  Array.from({ length: BELT_COLS }, (_, col) => belt.getSlot(col, 0) ?? remembered[col] ?? null)

export const beltRefillPick = (belt: BeltSlots, potions: readonly Potion[], kinds: BeltColumnKinds = beltColumnKinds(belt), skip?: number): number | null => {
  const carried = potions.flatMap((p) => {
    if (!('itemId' in p) || p.itemId === skip) return []
    const potion = itemToBeltPotion({ code: p.code })
    const slot = potion && belt.findAutoPlacePotionSlot(potion)
    return potion && slot ? [{ itemId: p.itemId, potion, kind: slot.row > 0 ? potion : (kinds[slot.col] ?? null) }] : []
  })
  const missing = (potion: BeltPotion) => !kinds.some((k) => k !== null && areBeltPotionsCompatible(k, potion))
  const pick =
    carried.find(({ potion, kind }) => (kind === null ? missing(potion) : areBeltPotionsCompatible(kind, potion))) ??
    carried.find(({ kind }) => kind === null)
  return pick?.itemId ?? null
}
