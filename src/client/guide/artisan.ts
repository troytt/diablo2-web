import { equipSlotsOf, gearScore, slotOf } from '../../common/items/loot-appraisal.ts'
import { appraisalContextOf } from '../../common/items/loot-context.ts'
import type { ItemData } from '../../netproto/index.ts'
import { freeSpots } from '../input/auto-loot.ts'
import type { HudModel } from '../ui-model/hud-model.ts'
import { waitFor } from '../ui-model/stash-deposit.ts'
import type { HudManager } from '../ui/hud-manager.ts'
import type { ClientWorld } from '../world/client-world.ts'

export type ArtisanKind = 'imbue' | 'add_sockets'

const NORMAL = 2
const MAGIC = 4
const STEP_MS = 3000
const DONE_MS = 6000
const INVENTORY_BUFFER = 0

export interface ArtisanHost {
  readonly world: ClientWorld
  readonly hudManager: HudManager
  readonly hudModel: HudModel
}

const qualifies: Readonly<Record<ArtisanKind, (item: ItemData) => boolean>> = {
  imbue: (item) => item.quality === NORMAL && !item.socketed && !item.ethereal,
  add_sockets: (item) => (item.quality ?? NORMAL) !== MAGIC && !item.socketed && item.totalSockets === 0,
}

export function artisanPick(world: ClientWorld, kind: ArtisanKind): ItemData | null {
  const { build } = appraisalContextOf(world)
  const { equipment, inventory } = world.containers
  const candidates = [...equipment.values(), ...inventory.values()].filter((item) => item.identified && equipSlotsOf(item).length > 0 && qualifies[kind](item))
  const worn = (item: ItemData) => (equipment.has(item.id) ? 1 : 0)
  return candidates.sort((a, b) => worn(b) - worn(a) || gearScore(b, build) - gearScore(a, build))[0] ?? null
}

async function intoInventory({ world, hudModel }: ArtisanHost, item: ItemData): Promise<boolean> {
  if (world.containers.inventory.has(item.id)) return true
  const slot = slotOf(item)
  const spot = freeSpots(world.containers.inventory.values(), item.invWidth, item.invHeight)[0]
  if (slot === undefined || !spot) return false
  hudModel.unequipItem(slot)
  if (!(await waitFor(() => world.containers.cursor?.id === item.id, STEP_MS))) return false
  hudModel.placeCursorItem(item.id, spot.x, spot.y, INVENTORY_BUFFER)
  return waitFor(() => world.containers.inventory.has(item.id) && world.containers.cursor === null, STEP_MS)
}

async function putAway({ world, hudModel }: ArtisanHost, slot: ReturnType<typeof slotOf>): Promise<void> {
  const held = world.containers.cursor
  if (held === null) return
  const spot = freeSpots(world.containers.inventory.values(), held.invWidth, held.invHeight)[0]
  if (slot !== undefined) hudModel.equipItem(held.id, slot)
  else if (spot) hudModel.placeCursorItem(held.id, spot.x, spot.y, INVENTORY_BUFFER)
  await waitFor(() => world.containers.cursor === null, STEP_MS)
}

export async function useArtisan(host: ArtisanHost, kind: ArtisanKind, npcId: number): Promise<ItemData | null> {
  const { world, hudManager, hudModel } = host
  const item = artisanPick(world, kind)
  if (item === null) return null
  const slot = slotOf(item)
  if (!(await intoInventory(host, item))) return null
  hudModel.handleNpcMenuAction(kind, npcId)
  if (!(await waitFor(() => hudManager.leftPanel === kind, STEP_MS))) return null
  hudModel.pickupItemToCursor(item.id)
  if (!(await waitFor(() => world.containers.cursor?.id === item.id, STEP_MS))) return null
  hudModel.confirmQuestReward(item.id, npcId)
  await waitFor(() => world.containers.cursor?.id !== item.id, DONE_MS)
  await waitFor(() => world.containers.cursor !== null || hudManager.leftPanel !== kind, STEP_MS)
  await putAway(host, slot)
  hudModel.closeActiveNpcPanel()
  return item
}
