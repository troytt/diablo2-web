import { STASH_GOLD_CAP } from '../../common/items/inventory-model.ts'
import type { ClientWorld } from '../world/client-world.ts'
import type { ItemData } from '../world/inventory.ts'
import { getCanonicalItemDataTables } from '../world/item-tables-provider.ts'

const STASH_BUFFER = 4
const INVENTORY_BUFFER = 0
const STASH_COLS = 6
const STASH_ROWS = 8
const STEP_TIMEOUT_MS = 2500
const POLL_MS = 20
const KEPT_IN_INVENTORY = new Set(['cm1', 'cm2', 'cm3', 'tbk', 'ibk', 'box'])

export interface StashDepositHost {
  readonly world: ClientWorld
  pickupItemToCursor(itemId: number): void
  placeCursorItem(itemId: number, col: number, row: number, buffer: number): void
  depositGold(amount: number): void
}

export interface StashDepositResult {
  readonly moved: number
  readonly left: number
  readonly gold: number
}

interface Footprint {
  readonly col: number
  readonly row: number
  readonly w: number
  readonly h: number
}

const range = (length: number): number[] => Array.from({ length }, (_, i) => i)

const codeOf = (item: { readonly code?: string }): string => (item.code ?? '').trim().toLowerCase()

const sizeOf = (item: { readonly code?: string }): { readonly w: number; readonly h: number } => {
  const meta = getCanonicalItemDataTables().getItemBaseMeta(codeOf(item))
  return { w: meta?.invWidth ?? 1, h: meta?.invHeight ?? 1 }
}

const overlaps = (a: Footprint, b: Footprint): boolean =>
  a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h

export const findFreeSlot = (occupied: readonly Footprint[], w: number, h: number, cols = STASH_COLS, rows = STASH_ROWS): Footprint | null =>
  range(cols - w + 1)
    .flatMap((col) => range(rows - h + 1).map((row) => ({ col, row, w, h })))
    .find((slot) => occupied.every((o) => !overlaps(slot, o))) ?? null

export const waitFor = (condition: () => boolean, timeoutMs = STEP_TIMEOUT_MS): Promise<boolean> =>
  new Promise((resolve) => {
    const deadline = performance.now() + timeoutMs
    const poll = (): void => (condition() ? resolve(true) : performance.now() > deadline ? resolve(false) : void setTimeout(poll, POLL_MS))
    poll()
  })

export async function depositItemsToStash(host: StashDepositHost, items: readonly ItemData[], isStashOpen: () => boolean): Promise<number> {
  const { containers } = host.world
  let moved = 0
  for (const item of items) {
    if (!isStashOpen() || containers.cursor !== null) break
    const { w, h } = sizeOf(item)
    const slot = findFreeSlot([...containers.stash.values()].map((s) => ({ col: s.gridX, row: s.gridY, ...sizeOf(s) })), w, h)
    if (slot === null) continue
    host.pickupItemToCursor(item.id)
    if (!(await waitFor(() => containers.cursor?.id === item.id))) break
    host.placeCursorItem(item.id, slot.col, slot.row, STASH_BUFFER)
    if (!(await waitFor(() => containers.stash.has(item.id)))) {
      host.placeCursorItem(item.id, item.gridX, item.gridY, INVENTORY_BUFFER)
      break
    }
    moved++
  }
  return moved
}

export async function depositAllToStash(host: StashDepositHost, isStashOpen: () => boolean): Promise<StashDepositResult> {
  const { containers, self } = host.world
  const candidates = [...containers.inventory.values()].filter((item) => !KEPT_IN_INVENTORY.has(codeOf(item)))
  const moved = await depositItemsToStash(host, candidates, isStashOpen)
  const gold = isStashOpen() ? Math.min(self.gold, STASH_GOLD_CAP - self.stashGold) : 0
  if (gold > 0) host.depositGold(gold)
  return { moved, left: candidates.length - moved, gold: Math.max(0, gold) }
}
