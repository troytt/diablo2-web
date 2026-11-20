import { appraiseItem, isTwoHanded, slotOf, TIER_RANK, type Appraisal, type AppraisalContext } from '../../common/items/loot-appraisal.ts'
import { appraisalContextOf } from '../../common/items/loot-context.ts'
import { onlineItemDataToUiInventoryItem } from '../../common/items/item-bridge.ts'
import type { ItemData } from '../../netproto/index.ts'
import type { HudModel } from '../ui-model/hud-model.ts'
import { depositItemsToStash, waitFor } from '../ui-model/stash-deposit.ts'
import type { HudManager } from '../ui/hud-manager.ts'
import type { ClientWorld } from '../world/client-world.ts'
import { freeSpots, planRoom, type JudgedItem, type RoomPlan } from './auto-loot.ts'

export interface InventoryCareConfig {
  readonly makeRoom: boolean
  readonly sellJunk: boolean
  readonly stashValuables: boolean
}

export interface InventoryCareHost {
  readonly world: ClientWorld
  readonly hudManager: HudManager
  readonly hudModel: HudModel | null
}

const INVENTORY_BUFFER = 0
const GEAR_KINDS = new Set(['magic', 'rare', 'set', 'unique', 'jewel', 'base', 'normal'])
const FUTURE_UPGRADE = 'Better'
const STASHED_KINDS = new Set<Appraisal['kind']>(['rune', 'gem', 'jewel', 'unique', 'set', 'rare', 'base'])

const nameOf = (item: ItemData) => onlineItemDataToUiInventoryItem(item).name || item.code.trim()
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export class InventoryCare {
  config: InventoryCareConfig | null = null
  readonly discarded = new Set<number>()
  private job: Promise<unknown> | null = null
  private readonly appraisals = new WeakMap<ItemData, { readonly context: AppraisalContext; readonly appraisal: Appraisal }>()
  private visited: 'vendor' | 'stash' | null = null

  constructor(private readonly host: InventoryCareHost) {}

  get busy(): boolean {
    return this.job !== null
  }

  appraise(item: ItemData): Appraisal {
    const context = appraisalContextOf(this.host.world)
    const hit = this.appraisals.get(item)
    if (hit?.context === context) return hit.appraisal
    const appraisal = appraiseItem(item, context)
    this.appraisals.set(item, { context, appraisal })
    return appraisal
  }

  roomFor(item: ItemData): RoomPlan | null {
    const judged: JudgedItem[] = [...this.host.world.containers.inventory.values()].map((owned) => ({ ...owned, appraisal: this.appraise(owned) }))
    const plan = planRoom(judged, item.invWidth, item.invHeight, this.appraise(item), true)
    return plan?.kind === 'fits' || this.config?.makeRoom === true ? plan : null
  }

  makeRoom(plan: RoomPlan, incoming: ItemData): void {
    if (plan.kind === 'fits' || this.config?.makeRoom !== true) return
    this.run(async () => {
      if (plan.kind === 'move') return this.moveItem(plan.itemId, plan.x, plan.y)
      const dropped: string[] = []
      for (const itemId of plan.itemIds) {
        const item = this.host.world.containers.inventory.get(itemId)
        if (item === undefined || !(await this.dropItem(itemId))) break
        this.discarded.add(itemId)
        dropped.push(nameOf(item))
      }
      if (dropped.length > 0) this.toast(`Made room for ${nameOf(incoming)}`, `Dropped ${dropped.join(', ')}`, 'tan')
    })
  }

  tick(): void {
    const panel = this.host.hudManager.leftPanel
    const visit = panel === 'vendor' || panel === 'stash' ? panel : null
    if (visit === null) this.visited = null
    if (visit === null || visit === this.visited || this.busy || this.config === null || this.host.world.containers.cursor !== null) return
    this.visited = visit
    if (visit === 'vendor' && this.config.sellJunk) this.run(() => this.sellJunk())
    if (visit === 'stash' && this.config.stashValuables) this.run(() => this.stashValuables())
  }

  private run(task: () => Promise<unknown>): void {
    if (this.job !== null) return
    this.job = task()
      .catch(() => undefined)
      .finally(() => {
        this.job = null
      })
  }

  private inventoryWhere(test: (appraisal: Appraisal) => boolean): ItemData[] {
    return [...this.host.world.containers.inventory.values()].filter((item) => test(this.appraise(item)))
  }

  private async sellJunk(): Promise<void> {
    const { world, hudModel, hudManager } = this.host
    if (hudModel === null) return
    const goldBefore = world.self.gold
    let sold = 0
    for (const item of [...this.junk, ...this.clutter]) {
      if (hudManager.leftPanel !== 'vendor' || !hudModel.vendorSell(item.id) || !(await waitFor(() => !world.containers.inventory.has(item.id)))) break
      sold++
    }
    if (sold > 0) this.toast(`Sold ${plural(sold, 'junk item')}`, `+${Math.max(0, world.self.gold - goldBefore).toLocaleString('en-US')} gold`, 'gold')
  }

  get stashable(): ItemData[] {
    return this.inventoryWhere((appraisal) => !appraisal.locked && appraisal.upgradeSlot === undefined && STASHED_KINDS.has(appraisal.kind) && TIER_RANK[appraisal.tier] >= TIER_RANK.good)
  }

  get clutter(): ItemData[] {
    return this.inventoryWhere((appraisal) => !appraisal.locked && appraisal.tier === 'keep' && GEAR_KINDS.has(appraisal.kind) && !appraisal.reason.startsWith(FUTURE_UPGRADE)).filter((item) => item.identified)
  }

  get upgrades(): ItemData[] {
    return this.inventoryWhere((appraisal) => !appraisal.locked && appraisal.upgradeSlot !== undefined).filter((item) => item.identified)
  }

  private async freeOffhand(item: ItemData): Promise<boolean> {
    const { world, hudModel } = this.host
    const shield = [...world.containers.equipment.values()].find((equipped) => slotOf(equipped) === 'weapon2')
    if (!isTwoHanded(item) || shield === undefined) return true
    const spot = freeSpots([...world.containers.inventory.values()], shield.invWidth, shield.invHeight)[0]
    if (hudModel === null || spot === undefined) return false
    hudModel.unequipItem('weapon2')
    if (!(await waitFor(() => world.containers.cursor?.id === shield.id))) return false
    hudModel.placeCursorItem(shield.id, spot.x, spot.y, INVENTORY_BUFFER)
    return waitFor(() => world.containers.cursor === null)
  }

  async wearUpgrades(): Promise<number> {
    const { world, hudModel } = this.host
    let worn = 0
    for (const item of this.upgrades) {
      const slot = this.appraise(item).upgradeSlot
      if (hudModel === null || slot === undefined || !(await this.freeOffhand(item))) break
      const current = [...world.containers.equipment.values()].find((equipped) => slotOf(equipped) === slot)
      hudModel.pickupItemToCursor(item.id)
      if (!(await waitFor(() => world.containers.cursor?.id === item.id))) break
      if (current) hudModel.swapEquipItem(item.id, slot)
      else hudModel.equipItem(item.id, slot)
      if (!(await waitFor(() => world.containers.cursor?.id !== item.id))) break
      const old = world.containers.cursor
      const spot = old && freeSpots(world.containers.inventory.values(), old.invWidth, old.invHeight)[0]
      if (old && spot) hudModel.placeCursorItem(old.id, spot.x, spot.y, INVENTORY_BUFFER)
      else if (old) hudModel.dropItem(old.id)
      if (!(await waitFor(() => world.containers.cursor === null))) break
      worn++
    }
    if (worn > 0) this.toast(`Equipped ${plural(worn, 'upgrade')}`, '', 'green')
    return worn
  }

  get junk(): ItemData[] {
    return this.inventoryWhere((appraisal) => appraisal.tier === 'junk' && !appraisal.locked)
  }

  private async stashValuables(): Promise<void> {
    const { hudModel, hudManager } = this.host
    if (hudModel === null) return
    const valuables = this.stashable
    const moved = await depositItemsToStash(hudModel, valuables, () => hudManager.leftPanel === 'stash')
    if (moved > 0) this.toast(`Stashed ${plural(moved, 'valuable')}`, valuables.slice(0, moved).map(nameOf).join(', '), 'green')
  }

  private async moveItem(itemId: number, x: number, y: number): Promise<boolean> {
    const { world, hudModel } = this.host
    if (hudModel === null) return false
    hudModel.pickupItemToCursor(itemId)
    if (!(await waitFor(() => world.containers.cursor?.id === itemId))) return false
    hudModel.placeCursorItem(itemId, x, y, INVENTORY_BUFFER)
    return waitFor(() => world.containers.inventory.get(itemId)?.gridX === x && world.containers.cursor === null)
  }

  private async dropItem(itemId: number): Promise<boolean> {
    const { world, hudModel } = this.host
    if (hudModel === null) return false
    hudModel.pickupItemToCursor(itemId)
    if (!(await waitFor(() => world.containers.cursor?.id === itemId))) return false
    hudModel.dropItem(itemId)
    return waitFor(() => world.containers.cursor === null && !world.containers.inventory.has(itemId))
  }

  private toast(title: string, detail: string, color: 'tan' | 'gold' | 'green'): void {
    this.host.hudManager.toasts.push({ title, detail, color }, performance.now())
  }
}
