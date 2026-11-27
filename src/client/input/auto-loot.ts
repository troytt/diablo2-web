import type { ItemData } from '../../netproto/index.ts'
import { GEM_INFO } from '../../common/items/gems-data.ts'
import { TIER_RANK, type Appraisal, type LootTier } from '../../common/items/loot-appraisal.ts'

export interface LootCategories {
  readonly runes: boolean
  readonly uniques: boolean
  readonly sets: boolean
  readonly rares: boolean
  readonly charms: boolean
  readonly jewels: boolean
  readonly gems: boolean
}

export type AutoLootRules = { readonly mode: 'smart'; readonly minTier: LootTier } | ({ readonly mode: 'categories' } & LootCategories)

const INVENTORY_COLUMNS = 10
const INVENTORY_ROWS = 4
const FLAWLESS = 4
const MAX_DROPPED_RANK = TIER_RANK.keep

const CATEGORY_OF_KIND: Partial<Record<Appraisal['kind'], keyof LootCategories>> = { rune: 'runes', unique: 'uniques', set: 'sets', rare: 'rares', charm: 'charms', jewel: 'jewels', gem: 'gems' }

const inCategory = (rules: LootCategories, { code }: Pick<ItemData, 'code'>, { kind }: Appraisal): boolean => {
  const category = CATEGORY_OF_KIND[kind]
  return category !== undefined && rules[category] && (kind !== 'gem' || (GEM_INFO[code.trim().toLowerCase()]?.tier ?? 0) >= FLAWLESS)
}

export const isWantedLoot = (rules: AutoLootRules, item: Pick<ItemData, 'code'>, appraisal: Appraisal): boolean =>
  rules.mode === 'smart' ? appraisal.kind !== 'gold' && appraisal.kind !== 'consumable' && TIER_RANK[appraisal.tier] >= TIER_RANK[rules.minTier] : inCategory(rules, item, appraisal)

export type Placed = Pick<ItemData, 'id' | 'gridX' | 'gridY' | 'invWidth' | 'invHeight'>

const cellsOf = (item: Pick<Placed, 'gridX' | 'gridY' | 'invWidth' | 'invHeight'>, columns = INVENTORY_COLUMNS): number[] =>
  [...Array(Math.max(1, item.invHeight)).keys()].flatMap((dy) => [...Array(Math.max(1, item.invWidth)).keys()].map((dx) => (item.gridY + dy) * columns + item.gridX + dx))

export function freeSpots(items: Iterable<Placed>, width: number, height: number, columns = INVENTORY_COLUMNS, rows = INVENTORY_ROWS): { readonly x: number; readonly y: number }[] {
  const taken = new Set([...items].flatMap((item) => cellsOf(item, columns)))
  const spots = [...Array(Math.max(0, rows - height + 1)).keys()].flatMap((y) => [...Array(Math.max(0, columns - width + 1)).keys()].map((x) => ({ x, y })))
  return spots.filter(({ x, y }) => cellsOf({ gridX: x, gridY: y, invWidth: width, invHeight: height }, columns).every((cell) => !taken.has(cell)))
}

export const fitsInInventory = (items: Iterable<Placed>, width: number, height: number): boolean => freeSpots(items, width, height).length > 0

export type RoomPlan = { readonly kind: 'fits' } | { readonly kind: 'move'; readonly itemId: number; readonly x: number; readonly y: number } | { readonly kind: 'drop'; readonly itemIds: readonly number[] }

export interface JudgedItem extends Placed {
  readonly appraisal: Appraisal
}

const rankOf = ({ appraisal }: JudgedItem) => TIER_RANK[appraisal.tier] * 1000 + appraisal.score

export function planRoom(items: readonly JudgedItem[], width: number, height: number, incoming: Appraisal, allowDrops: boolean): RoomPlan | null {
  if (fitsInInventory(items, width, height)) return { kind: 'fits' }
  const without = (gone: readonly JudgedItem[]) => items.filter((item) => !gone.includes(item))
  const move = items
    .flatMap((item) => freeSpots(without([item]), item.invWidth, item.invHeight).filter(({ x, y }) => x !== item.gridX || y !== item.gridY).map((spot) => ({ item, spot })))
    .find(({ item, spot }) => fitsInInventory([...without([item]), { ...item, gridX: spot.x, gridY: spot.y }], width, height))
  if (move) return { kind: 'move', itemId: move.item.id, x: move.spot.x, y: move.spot.y }
  if (!allowDrops) return null
  const expendable = items.filter(({ appraisal }) => !appraisal.locked && TIER_RANK[appraisal.tier] <= MAX_DROPPED_RANK && TIER_RANK[appraisal.tier] < TIER_RANK[incoming.tier]).sort((a, b) => rankOf(a) - rankOf(b))
  const single = expendable.find((item) => fitsInInventory(without([item]), width, height))
  if (single) return { kind: 'drop', itemIds: [single.id] }
  const greedy = expendable.reduce<JudgedItem[]>((dropped, item) => (fitsInInventory(without(dropped), width, height) ? dropped : [...dropped, item]), [])
  if (!fitsInInventory(without(greedy), width, height)) return null
  const needed = [...greedy].reverse().reduce((dropped, item) => (fitsInInventory(without(dropped.filter((other) => other !== item)), width, height) ? dropped.filter((other) => other !== item) : dropped), greedy)
  return { kind: 'drop', itemIds: needed.map(({ id }) => id) }
}
