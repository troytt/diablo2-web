/**
 * HUD Model Bridge (`src/client/ui-model/hud-model.ts`).
 *
 * Bridges authoritative `ClientWorld` state (`SelfState`, `ContainerStore`, `ClientUnit`s,
 * `QuestState`, `WaypointMenu`), `LocalMovementPredictor`, and `AutomapView` into `HudManager`
 * (`src/ui/hud-manager.ts`), and translates HUD panel interactions into protocol-neutral
 * `ClientCommand` messages.
 *
 * Modularized into focused sub-modules (Issue #985 Step 3.3):
 * - `./hud-skill-bonuses.ts`: Class/bodyLoc lookup maps & `+Skills` preaggregation
 * - `./hud-item-adapter.ts`: `ItemData` -> `UiInventoryItem` conversion, container digests, monster target info
 * - `./hud-world-sync.ts`: `syncFromWorldImpl`, `syncNpcInteraction`, `refreshHoveredItems`, `decoratePlayerItemPrices`
 * - `./hud-command-actions.ts`: `HudCommandSink` & NPC/inventory/waypoint/quest/artisan command dispatchers
 *
 * Zero imports from `src/netproto/{bncs,mcp,d2gs,crypto}/**` — consumes only `src/netproto/index.ts`.
 */

import type { CharacterClassCode } from '../../common/units/classes.ts'
import type { TownNpcServiceDescriptor } from '../../common/units/npc-table.ts'
import type {
  CharClassId,
  ClientCommand,
  Hand,
  ItemData,
} from '../../netproto/index.ts'
import type { AutomapView } from '../automap/automap-view.ts'
import type { LocalMovementPredictor } from '../motion/predictor.ts'
import type { BaseStatKey } from '../ui/character-sheet.ts'
import {
  computeHudSkillDamageString,
  type HudCommandSink,
  type HudManager,
} from '../ui/hud-manager.ts'
import type {
  EquipSlotId,
  GridPlacement,
  UiInventoryItem,
} from '../ui/inventory.ts'
import type { ClientWorld, NpcInteractionState } from '../world/client-world.ts'
import { D2StatId } from '../world/stat-list.ts'
import {
  activateSkillHotkeyImpl,
  allocateSkillImpl,
  allocateStatImpl,
  assignSkillHotkeyImpl,
  autoBeltItemImpl,
  buyFromNpcImpl,
  cancelNpcSessionImpl,
  castTownPortalImpl,
  clickButtonImpl,
  closeActiveNpcPanelImpl,
  closeCubeImpl,
  closeNpcImpl,
  closeStashImpl,
  closeWaypointImpl,
  completeArtisanUiImpl,
  completeOrificeUiImpl,
  confirmQuestRewardImpl,
  cycleBoundSkillsImpl,
  depositGoldImpl,
  dropGoldImpl,
  dropItemImpl,
  equipItemImpl,
  findWorldItemImpl,
  firstActiveQuestIndexImpl,
  handleNpcMenuActionImpl,
  hireMercImpl,
  identifyAllAtNpcImpl,
  identifyItemImpl,
  isThrottledImpl,
  itemToCubeImpl,
  mercItemImpl,
  npcClassOfImpl,
  npcDescriptorImpl,
  npcEntityActionImpl,
  onQuestLogClosedImpl,
  onQuestLogOpenedImpl,
  openArtisanWindowImpl,
  openNpcGambleImpl,
  openNpcTradeImpl,
  partyActionImpl,
  pickupItemToCursorImpl,
  placeCursorItemImpl,
  playerItemModeImpl,
  playNpcMessageImpl,
  priceContextImpl,
  putBeltItemImpl,
  questMessageImpl,
  removeBeltItemImpl,
  repairAllAtNpcImpl,
  repairItemAtNpcImpl,
  replayQuestSpeechImpl,
  requestQuestDataImpl,
  requireOpenStoreImpl,
  requirePlayerItemImpl,
  requireVendorPriceImpl,
  requireVendorRepairAllImpl,
  resolveActTabForAreaImpl,
  resurrectImpl,
  resurrectMercImpl,
  scrollToBookImpl,
  selectSkillImpl,
  sellToNpcImpl,
  setHostileImpl,
  socketItemImpl,
  swap2HandedDualImpl,
  swap2HandedItemImpl,
  swapBeltItemImpl,
  swapContainerItemImpl,
  swapEquipItemImpl,
  swapWeaponsImpl,
  teleportToLevelImpl,
  teleportWaypointImpl,
  toggleRunWalkImpl,
  transmuteCubeImpl,
  tryNpcDescriptorImpl,
  unequipItemImpl,
  useBeltSlotImpl,
  useItemImpl,
  vendorBuyImpl,
  vendorRepairAllImpl,
  vendorRepairItemImpl,
  vendorSellImpl,
  withdrawGoldImpl,
} from './hud-command-actions.ts'
import {
  computeEquippedDigestForWorld,
  computeHudContainersDigestForWorld,
  convertWorldItemToUiItem,
  getUnidentifiedItemCountInWorld,
  hasUnidentifiedItemsInWorld,
  resolveClassCode,
  resolveEquippedContextForModel,
  type UiItemCacheEntry,
} from './hud-item-adapter.ts'
import {
  applyQuestEventToPlayerQuestsImpl,
  decoratePlayerItemPricesImpl,
  handleAutoPartyEventImpl,
  isFastPathMonsterEventImpl,
  isFastPathVitalsEventImpl,
  NPC_STATE_CLOSED,
  refreshHoveredItemsImpl,
  resolveNpcScreenPositionImpl,
  syncFromWorldImpl,
  syncHoveredMonsterTargetImpl,
  syncNpcInteractionImpl,
  syncVitalsFromWorldImpl,
} from './hud-world-sync.ts'
import { aggregateUnit } from './stat-engine.ts'
import { depositAllToStash, type StashDepositResult } from './stash-deposit.ts'
import type { VendorPriceContext, VendorPriceFn, VendorRepairAllFn } from './vendor-price.ts'

export * from './hud-skill-bonuses.ts'
export * from './hud-item-adapter.ts'
export * from './hud-world-sync.ts'
export * from './hud-command-actions.ts'

export interface HudModelOptions {
  readonly world: ClientWorld
  readonly hudManager?: HudManager | null | undefined
  readonly predictor?: LocalMovementPredictor | null | undefined
  readonly automap?: AutomapView | null | undefined
  readonly onCommand?: ((cmd: ClientCommand) => void) | undefined
  /** Store price provider (D2Common #10107); required before a store opens. Production: `vendorPrice113c`. */
  readonly vendorPrice?: VendorPriceFn | undefined
  /** Repair-all cost provider (D2Common #10071); required before a store opens. Production: `vendorRepairAll113c`. */
  readonly vendorRepairAll?: VendorRepairAllFn | undefined
  /** Optional UI sound sink (e.g. sell sound 0xdd = 221 item_gold). */
  readonly playUiSound?: ((soundId: number) => void) | undefined
  /** Clock for the store click throttle (ms); defaults to `performance.now`. */
  readonly now?: (() => number) | undefined
}

export interface HudModelSnapshot {
  readonly charName: string
  /** `null` until the server assigns the class (MCP char list / `0x59` UnitAssign). */
  readonly charClass: CharClassId | null
  readonly classCode: CharacterClassCode | null
  readonly level: number
  readonly xp: number
  readonly hp: number
  readonly maxHp: number
  readonly mana: number
  readonly maxMana: number
  readonly stamina: number
  readonly maxStamina: number
  readonly str: number
  readonly dex: number
  readonly vit: number
  readonly ene: number
  readonly statPoints: number
  readonly skillPoints: number
  readonly gold: number
  readonly stashGold: number
  readonly leftSkillId: number
  readonly rightSkillId: number
  readonly isRunning: boolean
  readonly weaponSet: 0 | 1
  readonly inventoryCount: number
  readonly equippedCount: number
  readonly beltCount: number
  readonly stashCount: number
  readonly cubeCount: number
  readonly cursorItemId: number | null
  readonly unlockedWaypoints: readonly number[]
  readonly panels: Readonly<Record<string, boolean>>
}

/**
 * Reactive model synchronizing `ClientWorld` state into `HudManager` and dispatching
 * `ClientCommand` actions triggered by user HUD interactions.
 */
export class HudModel implements HudCommandSink {
  readonly world: ClientWorld
  hudManager: HudManager | null
  predictor: LocalMovementPredictor | null
  automap: AutomapView | null
  onCommand?: ((cmd: ClientCommand) => void) | undefined

  private unsubWorld: (() => void) | null = null
  private hoveredMonsterId: number | null = null
  private escapeMenuOpen = false
  private readonly priceProvider: VendorPriceFn | null
  private readonly repairAllProvider: VendorRepairAllFn | null
  private readonly uiSound: ((soundId: number) => void) | null
  private readonly now: () => number
  /** NPC/stash state seen by the last sync; panels react to transitions only. */
  private prevNpc: NpcInteractionState = NPC_STATE_CLOSED
  private prevTradeActive = false
  private prevAct = -1
  /** `world.waypointMenuSeq` already reacted to (each S2C 0x63 opens the Waypoint panel once). */
  private handledWaypointMenuSeq: number
  /** Active waypoint unitId from the most recent S2C 0x63 while the Waypoint menu is open. */
  private activeWaypointUnitId: number | null = null
  /** `D2Client.dll` `[0x6fbacdd5]` (`sentPacketFlag`): whether C2S `0x49` has been sent for the current waypoint menu. */
  private waypointPacketSent = true
  /** `lastNpcTransaction.seq` already reacted to (each S2C 0x2A is shown once). */
  private handledNpcTransactionSeq: number
  /**
   * D2Client.dll `[0x6fbc9753]`: dropsound of the store item of the last buy request (0x6faf70a1); the
   * S2C 0x2A result-0 reply plays it and resets it to 0 (0x6fafb694..0x6fafb6ae).
   */
  pendingVendorBuySoundId = 0
  /** `world.questLog.selectRequest.seq` already reacted to. */
  private handledQuestSelectSeq: number
  private readonly lastNpcActionAt = new Map<string, number>()
  /** Message shown for the last non-success S2C 0x2A (string.tbl index + localized text). */
  lastNpcTransactionMessage: { readonly tblKey: string; readonly text: string } | null = null
  private _playerQuests = new Uint16Array(48)
  private readonly playedAutoQuestStringIds = new Set<number>()
  activeMenu: { title: string; options: Array<{ id: string; label: string; enabled: boolean }> } | null = null
  private boundHudInstance: HudManager | null = null
  private activeSyncEquippedItems: readonly ItemData[] | null = null
  private activeSyncEquippedSig: string | null = null
  private readonly uiItemCacheById = new Map<string | number, UiItemCacheEntry>()
  private readonly uiItemCacheByRef = new WeakMap<ItemData, UiItemCacheEntry>()
  private cachedEquippedRev = -1
  private cachedEquippedDigest = 0
  private cachedEquippedItems: readonly ItemData[] = []
  private cachedEquippedSig = ''
  private lastSyncedHudRef: HudManager | null = null
  private lastSyncedContainersRev = -1
  private lastSyncedContainersDigest = 0
  private lastSyncedPlayerLevel = -1
  private lastSyncedWeaponSet = -1
  private lastSyncedArtisanOpen = false
  private lastSyncedQuestRewardId: string | number | null = null
  private lastSyncedStoreOpen = false
  private lastSyncedVendorKey: string | null = null
  private lastSyncedGridItemsRef: GridPlacement[] | null = null
  private lastSyncedStashItemsRef: GridPlacement[] | null = null
  private lastSyncedCubeItemsRef: GridPlacement[] | null = null
  private lastSyncedCursorItemRef: UiInventoryItem | null = null
  private cachedScrollCounts = new Map<number, number>()
  private cachedHasUnidentifiedItems = false
  private cachedMercEquipped: {
    head: UiInventoryItem | null
    helm: UiInventoryItem | null
    torso: UiInventoryItem | null
    armor: UiInventoryItem | null
    rightHand: UiInventoryItem | null
    weapon1: UiInventoryItem | null
    leftHand: UiInventoryItem | null
    weapon2: UiInventoryItem | null
  } | null = null
  private cachedMercEquipment: {
    head: UiInventoryItem | null
    helm: UiInventoryItem | null
    torso: UiInventoryItem | null
    armor: UiInventoryItem | null
    rightHand: UiInventoryItem | null
    weapon1: UiInventoryItem | null
    leftHand: UiInventoryItem | null
    weapon2: UiInventoryItem | null
  } | null = null
  private cachedSelfTradeItems: UiInventoryItem[] = []
  private cachedPartnerTradeItems: UiInventoryItem[] = []
  private pendingArtisanConfirmNpcId: number | null = null

  constructor(options: HudModelOptions) {
    this.world = options.world
    this.hudManager = options.hudManager ?? null
    this.predictor = options.predictor ?? null
    this.automap = options.automap ?? null
    this.onCommand = options.onCommand
    this.priceProvider = options.vendorPrice ?? null
    this.repairAllProvider = options.vendorRepairAll ?? null
    this.uiSound = options.playUiSound ?? null
    this.now = options.now ?? (() => performance.now())
    this.handledWaypointMenuSeq = this.world.waypointMenuSeq
    this.handledNpcTransactionSeq = this.world.lastNpcTransaction?.seq ?? 0
    this.handledQuestSelectSeq = this.world.questLog.selectRequest?.seq ?? 0
    this.syncPlayerQuestsFromWorld()
    if (this.hudManager) {
      this.bindHudCallbacks(this.hudManager)
    }

    this.unsubWorld = this.world.onChange((ev) => {
      this.applyQuestEventToPlayerQuests(ev)
      this.handleAutoPartyEvent(ev)
      if (this.suppressAutoSync) {
        return
      }
      if (
        ev.type === 'OpenUi' &&
        (ev.uiId === 6 || ev.uiId === 7) &&
        (this.pendingArtisanConfirmNpcId !== null || ev.unitType === 0 || ev.unitId === 0)
      ) {
        this.completeArtisanUi(ev.uiId, this.pendingArtisanConfirmNpcId ?? ev.unitId)
        return
      }
      if (this.isFastPathMonsterEvent(ev)) {
        this.syncTargetMonsterFromWorld()
      } else if (this.isFastPathVitalsEvent(ev)) {
        this.syncVitalsFromWorld()
      } else {
        this.syncFromWorld()
      }
    })
  }

  /**
   * Auto-Party on room entry & invite events (Issue #909 R4):
   * 1. Auto-accept incoming party invites (`partyState === 2 | 3 | 'invited_me'`) via `C2S 0x5E (action=0x08)`.
   * 2. Auto-invite unpartied players (`0x5B`, `0x75`, `0x8B relation=0`) via `C2S 0x5E (action=0x06)`.
   */
  private handleAutoPartyEvent(ev: any): void {
    handleAutoPartyEventImpl(this, ev)
  }

  suppressAutoSync = false

  /**
   * Returns `true` when `ev` only updates world units (monsters, objects, tiles, missiles, ground
   * unit removals, or non-HUD system packets) that do not affect local player HUD panels, inventory,
   * mercenary, pets, or active NPC/stash interaction, allowing `syncTargetMonsterFromWorld()` to run
   * instead of a full `syncFromWorld()` rebuild (#940).
   */
  isFastPathMonsterEvent(
    ev:
      | {
          readonly type?: string | undefined
          readonly kind?: string | undefined
          readonly unitType?: unknown
          readonly id?: number | undefined
          readonly unitId?: number | undefined
          readonly npcId?: number | undefined
          readonly npcUnitId?: number | undefined
          readonly isSelf?: boolean | undefined
          readonly unit?: { readonly unitType?: unknown; readonly id?: number | undefined } | undefined
        }
      | undefined,
  ): boolean {
    return isFastPathMonsterEventImpl(this, ev)
  }

  /**
   * Returns `true` when `ev` only updates local player vitals (`LifeMana` or `StatSet` for current
   * HP/Mana/Stamina/regen) after the HUD globes have already been initialized, allowing O(1)
   * `syncVitalsFromWorld()` instead of a full `syncFromWorld()` rebuild (#940).
   */
  isFastPathVitalsEvent(
    ev:
      | {
          readonly type?: string | undefined
          readonly stat?: number | undefined
          readonly value?: number | undefined
          readonly life?: number | undefined
          readonly at?: { readonly x?: number | undefined; readonly y?: number | undefined } | undefined
          readonly unit?: { readonly unitType?: unknown; readonly id?: number | undefined } | undefined
        }
      | undefined,
  ): boolean {
    return isFastPathVitalsEventImpl(this, ev)
  }

  /**
   * Fast O(1) update of player vitals (HP/Mana/Stamina globes, regen percentages, and active states)
   * without rebuilding containers, character sheet, or skill tree (#940).
   */
  syncVitalsFromWorld(): void {
    syncVitalsFromWorldImpl(this)
  }

  get playerQuests(): Uint16Array {
    return this._playerQuests
  }

  private syncPlayerQuestsFromWorld(): void {
    const wq = this.world.quests
    if (this._playerQuests.length !== wq.length) {
      this._playerQuests = new Uint16Array(wq.length)
    }
    this._playerQuests.set(wq)
  }

  /**
   * Apply a server quest event to `_playerQuests` only when it carries authoritative 16-bit quest
   * bitflags (`S2C 0x28` with `updateType === 6` or a valid unit in the world per `0x6fafb8a0`,
   * or synthetic `QuestState` with `source === undefined`).
   * Single-byte UI filter packets (`0x29`, `0x50`, `0x52`, `0x5D`, `0x5E`, `0x89`) never overwrite `_playerQuests`.
   */
  applyQuestEventToPlayerQuests(ev: {
    readonly type?: string | undefined
    readonly source?: number | undefined
    readonly updateType?: number | undefined
    readonly unitId?: number | undefined
    readonly quests?: ArrayLike<number> | undefined
    readonly flags?: ArrayLike<number> | number | undefined
  }): void {
    applyQuestEventToPlayerQuestsImpl(this, ev)
  }

  get hud(): HudManager | null {
    return this.hudManager
  }

  set hud(hudManager: HudManager | null) {
    this.attachHudManager(hudManager)
  }

  private bindHudCallbacks(hud: HudManager): void {
    this.boundHudInstance = hud
    hud.commandSink = this
    hud.resolveGroundItem = (unitId) => this.world.containers.ground.get(unitId)
    hud.resolveBuild = () => ({
      classIndex: this.world.self.charClass ?? -1,
      skillPoints: new Map([...this.world.self.skillEntries.values()].map((s) => [s.skillId, s.baseLevel ?? s.level])),
    })
    hud.questAlert = this.world.questLog
    if (this.uiSound) {
      hud.onPlayUiSound = (soundId) => {
        if (typeof soundId === 'number') {
          this.uiSound?.(soundId)
        }
      }
    }
    hud.hotkeys.onSelectSkill = (side, skillId) => {
      this.selectSkill(side, skillId)
    }
    hud.hotkeys.onAssignHotkey = (slot, side, skillId, itemId) => {
      this.assignSkillHotkey(slot, side, skillId, itemId)
    }
    ;(hud as any).onWeaponSwitch = () => {
      this.swapWeapons()
    }
    ;(hud as any).onMercEquipSlotClick = (slot: number) => this.mercItem(slot)
    ;(hud as any).onHireMercClick = (npcId: number, mercId: number) =>
      this.hireMerc(
        npcId ||
          this.world.npcInteraction.npcId ||
          (hud.worldPanels as any)?.activeNpcId ||
          (hud.worldPanels as any)?.vendorNpcId ||
          0,
        mercId,
      )
    ;(hud as any).onPartyActionClick = (action: number, targetPlayerId: number) =>
      this.partyAction(action, targetPlayerId)
    ;(hud as any).onHostileToggleClick = (targetPlayerId: number, hostile: boolean, button?: number) =>
      this.setHostile(targetPlayerId, hostile, button ?? 1)
    hud.onSquelchToggle = (targetPlayerId: number, squelched: boolean) => {
      this.world.setPlayerSquelched(targetPlayerId, squelched)
      this.syncFromWorld()
    }
    hud.onIgnoreToggle = (targetPlayerId: number, ignored: boolean) => {
      this.world.setPlayerIgnored(targetPlayerId, ignored)
      this.syncFromWorld()
    }
    hud.onClearMessages = () => {
      this.world.clearMessageLog()
      this.syncFromWorld()
    }
    ;(hud as any).onTradeButtonClick = (buttonId: number, complement?: number) =>
      this.clickButton(buttonId, complement ?? 0)
    ;(hud as any).onConfirmQuestRewardClick = (itemId: number, npcId?: number) =>
      this.confirmQuestReward(itemId, npcId)
    const wp = hud.worldPanels as any
    wp.onQuestActTabSelected = (act0: number) =>
      this.world.questLog.selectActTab(act0, () => this.firstActiveQuestIndex(act0))
    wp.onQuestMessage = (npcId: number, messageId = 0) => this.questMessage(npcId, messageId)
    wp.onReplayQuestSpeech = (speechKey: string) => this.replayQuestSpeech(speechKey)
    wp.onNpcEntityAction = (action: number, npcId: number, complement?: number) =>
      this.npcEntityAction(action, npcId, complement ?? 0)
    wp.onNpcCancel = (npcId?: number) => this.cancelNpcSession(npcId)
    wp.onHireMerc = (npcId: number, mercId: number) =>
      this.hireMerc(
        npcId ||
          this.world.npcInteraction.npcId ||
          wp.activeNpcId ||
          wp.vendorNpcId ||
          0,
        mercId,
      )
    wp.onResurrectMerc = (npcId?: number) => this.resurrectMerc(npcId)
    wp.onMercItem = (slot: number) => this.mercItem(slot)
    wp.onPartyAction = (action: number, targetPlayerId: number) => this.partyAction(action, targetPlayerId)
    wp.onHostile = (targetPlayerId: number, hostile: boolean, button?: number) =>
      this.setHostile(targetPlayerId, hostile, button ?? 1)
    wp.onSetHostile = (targetPlayerId: number, hostile: boolean, button?: number) =>
      this.setHostile(targetPlayerId, hostile, button ?? 1)
    wp.onSquelchToggle = (targetPlayerId: number, squelched: boolean) => {
      this.world.setPlayerSquelched(targetPlayerId, squelched)
      this.syncFromWorld()
    }
    wp.onIgnoreToggle = (targetPlayerId: number, ignored: boolean) => {
      this.world.setPlayerIgnored(targetPlayerId, ignored)
      this.syncFromWorld()
    }
    wp.onClearMessages = () => {
      this.world.clearMessageLog()
      this.syncFromWorld()
    }
    wp.onClickButton = (buttonId: number, complement?: number) => this.clickButton(buttonId, complement ?? 0)
    wp.onConfirmQuestReward = (itemId: number, npcId?: number) =>
      this.confirmQuestReward(itemId, typeof npcId === 'number' ? npcId : undefined)
    wp.onMercEquipSlotClick = (slot: number) => this.mercItem(slot)
    wp.onHireMercClick = (npcId: number, mercId: number) =>
      this.hireMerc(
        npcId ||
          (this.world.npcInteraction.npcId ?? 0) ||
          wp.activeNpcId ||
          wp.vendorNpcId ||
          0,
        mercId,
      )
    wp.onPartyActionClick = (action: number, targetPlayerId: number) =>
      this.partyAction(action, targetPlayerId)
    wp.onHostileToggleClick = (targetPlayerId: number, hostile: boolean, button?: 1 | 2) =>
      this.setHostile(targetPlayerId, hostile, button ?? 1)
    wp.onTradeButtonClick = (buttonId: number, complement = 0) =>
      this.clickButton(buttonId, complement)
    wp.onConfirmQuestRewardClick = (itemId: number, npcIdOrPanel?: number | string) =>
      this.confirmQuestReward(
        itemId,
        typeof npcIdOrPanel === 'number' ? npcIdOrPanel : undefined,
      )
    wp.onNpcMenuAction = (actionId: string, npcId?: number, descriptor?: TownNpcServiceDescriptor) =>
      this.handleNpcMenuAction(actionId, npcId, descriptor)
    wp.onCloseNpcPanel = () => this.closeActiveNpcPanel()
    wp.resolveNpcScreenPosition = (npcId: number) => this.resolveNpcScreenPosition(npcId, hud)
  }

  /**
   * Detach the world listener when disposing the session.
   */
  dispose(): void {
    if (this.hudManager?.commandSink === this) {
      this.hudManager.commandSink = null
      this.hudManager.questAlert = null
      this.hudManager.onPlayUiSound = undefined
    }
    this.boundHudInstance = null
    this.lastSyncedHudRef = null
    this.cachedMercEquipped = null
    this.cachedMercEquipment = null
    this.uiItemCacheById.clear()
    if (this.unsubWorld) {
      this.unsubWorld()
      this.unsubWorld = null
    }
  }

  /**
   * Bind or replace the active `HudManager` instance and synchronize immediately.
   */
  attachHudManager(hudManager: HudManager | null): void {
    if (this.hudManager && this.hudManager !== hudManager && this.hudManager.commandSink === this) {
      this.hudManager.commandSink = null
      this.hudManager.questAlert = null
      this.hudManager.onPlayUiSound = undefined
    }
    if (this.hudManager !== hudManager) {
      this.boundHudInstance = null
    }
    this.hudManager = hudManager
    if (hudManager) {
      this.bindHudCallbacks(hudManager)
      hudManager.escapeMenuOpen = this.escapeMenuOpen
      this.syncFromWorld()
    }
  }

  private computeEquippedDigest(): number {
    return computeEquippedDigestForWorld(this.world)
  }

  private resolveEquippedContext(): {
    readonly equippedItems: readonly ItemData[]
    readonly equippedSig: string
  } {
    return resolveEquippedContextForModel(this)
  }

  private computeHudContainersDigest(): number {
    return computeHudContainersDigestForWorld(this.world)
  }

  /**
   * Convert a `ClientWorld` `ItemData` into a canonical 1.13c `UiInventoryItem` with its socketed children.
   */
  toUiItem(item: ItemData): UiInventoryItem {
    return convertWorldItemToUiItem(this, item)
  }

  /**
   * Whether the player currently carries any unidentified item across inventory or cube.
   * Per D2 1.13c Cain identify, only inventory and Horadric Cube are checked (NOT equipped or stash).
   */
  hasUnidentifiedItems(): boolean {
    return hasUnidentifiedItemsInWorld(this.world)
  }

  /**
   * Count unidentified items carried by player (inventory + Horadric cube).
   */
  getUnidentifiedItemCount(): number {
    return getUnidentifiedItemCountInWorld(this.world)
  }

  /**
   * Build a pure snapshot of the HUD state derived from `ClientWorld`.
   */
  getSnapshot(): HudModelSnapshot {
    const self = this.world.self
    const stats = self.stats
    const classCode = self.charClass === null ? null : resolveClassCode(self.charClass)

    const invItems = [...this.world.containers.inventory.values()]
    const eqItems = [...this.world.containers.equipment.values()]
    const beltItems = [...this.world.containers.belt.values()]
    const stashItems = [...this.world.containers.stash.values()]
    const cubeItems = [...this.world.containers.cube.values()]
    const cursorItem = this.world.containers.cursor
    const leftPanel = (this.hudManager?.leftPanel ?? 'none') as string
    const rightPanel = (this.hudManager?.rightPanel ?? 'none') as string
    const escapeMenuOpen = this.hudManager ? this.hudManager.escapeMenuOpen : this.escapeMenuOpen
    this.escapeMenuOpen = escapeMenuOpen

    let snapMaxHp = self.maxLife
    let snapMaxMana = self.maxMana
    let snapMaxStamina = self.maxStamina
    if (this.hudManager && this.hudManager.maxHp > 0) {
      snapMaxHp = this.hudManager.maxHp
      snapMaxMana = this.hudManager.maxMana
      snapMaxStamina = this.hudManager.maxStamina
    } else if (self.charClass !== null) {
      const agg = aggregateUnit({
        kind: 'player',
        stats: self.stats,
        level: self.level > 0 ? self.level : undefined,
        activeStates: self.states,
        classId: self.charClass,
        hardSkillLevels: self.skills,
        containers: this.world.containers,
      })
      const baseHp = agg.base(7)
      snapMaxHp =
        baseHp > 0
          ? Math.max(1, Math.floor(agg.total(7) / 256))
          : self.maxLife + Math.max(0, Math.floor(agg.total(7) / 256))
      const baseMana = agg.base(9)
      snapMaxMana =
        baseMana > 0
          ? Math.max(0, Math.floor(agg.total(9) / 256))
          : self.maxMana + Math.max(0, Math.floor(agg.total(9) / 256))
      const baseStam = agg.base(11)
      snapMaxStamina =
        baseStam > 0
          ? Math.max(0, Math.floor(agg.total(11) / 256))
          : self.maxStamina + Math.max(0, Math.floor(agg.total(11) / 256))
    }

    return {
      charName: self.name,
      charClass: self.charClass,
      classCode,
      level: self.level,
      xp: self.experience,
      hp: snapMaxHp > 0 ? Math.max(0, Math.min(snapMaxHp, self.life)) : self.life,
      maxHp: snapMaxHp,
      mana: snapMaxMana > 0 ? Math.max(0, Math.min(snapMaxMana, self.mana)) : self.mana,
      maxMana: snapMaxMana,
      stamina: snapMaxStamina > 0 ? Math.max(0, Math.min(snapMaxStamina, self.stamina)) : self.stamina,
      maxStamina: snapMaxStamina,
      str: stats.get(D2StatId.Strength),
      dex: stats.get(D2StatId.Dexterity),
      vit: stats.get(D2StatId.Vitality),
      ene: stats.get(D2StatId.Energy),
      statPoints: stats.get(D2StatId.StatPts),
      skillPoints: stats.get(D2StatId.NewSkills),
      gold: stats.get(D2StatId.Gold),
      stashGold: stats.get(D2StatId.GoldBank),
      leftSkillId: self.leftSkill,
      rightSkillId: self.rightSkill,
      isRunning: this.hudManager ? this.hudManager.isRunning : (this.predictor?.getSnapshot().running ?? true),
      weaponSet: self.weaponSet,
      inventoryCount: invItems.length,
      equippedCount: eqItems.length,
      beltCount: beltItems.length,
      stashCount: stashItems.length,
      cubeCount: cubeItems.length,
      cursorItemId: cursorItem ? cursorItem.id : null,
      unlockedWaypoints: [...this.world.waypoints].sort((a, b) => a - b),
      panels: {
        inventory: rightPanel === 'inv' || rightPanel === 'inventory',
        inv: rightPanel === 'inv' || rightPanel === 'inventory',
        skill: rightPanel === 'skill',
        skillTree: rightPanel === 'skill',
        char: leftPanel === 'char',
        character: leftPanel === 'char',
        quest: leftPanel === 'quest',
        questLog: leftPanel === 'quest',
        waypoint: leftPanel === 'waypoint',
        party: leftPanel === 'party' || leftPanel === 'waypoint',
        merc: leftPanel === 'merc',
        msg: leftPanel === 'msg',
        messageLog: leftPanel === 'msg',
        hire: leftPanel === 'hire',
        trade: leftPanel === 'trade',
        imbue: leftPanel === 'imbue',
        add_sockets: leftPanel === 'add_sockets',
        personalize: leftPanel === 'personalize',
        stash: leftPanel === 'stash',
        cube: leftPanel === 'cube',
        vendor: leftPanel === 'vendor',
        automap: this.automap ? this.automap.getMode() !== 'off' : false,
        escapeMenu: escapeMenuOpen,
      },
    }
  }

  get isRunMode(): boolean {
    return this.hudManager ? this.hudManager.isRunning : (this.predictor?.getSnapshot().running ?? true)
  }

  get leftSkillId(): number {
    return this.world.self.leftSkill
  }

  get rightSkillId(): number {
    return this.world.self.rightSkill
  }

  /**
   * Alias for `syncFromWorld()`.
   */
  sync(): void {
    this.syncFromWorld()
  }

  /**
   * Toggle a left or right HUD panel (`inventory`, `character`, `skillTree`, `quest`/`questLog`,
   * `waypoint`/`party`, `merc`, `msg`/`messageLog`, `automap`, `escapeMenu`).
   */
  togglePanel(panel: string): boolean {
    if (panel === 'escapeMenu') {
      if (this.hudManager) {
        this.escapeMenuOpen = this.hudManager.toggleEscapeMenu()
        return this.escapeMenuOpen
      }
      this.escapeMenuOpen = !this.escapeMenuOpen
      return this.escapeMenuOpen
    }
    if (panel === 'automap') {
      this.toggleAutomap()
      return this.automap ? this.automap.getMode() !== 'off' : false
    }
    if (!this.hudManager) return false
    switch (panel) {
      case 'inventory':
      case 'inv':
        this.hudManager.toggleRightPanel('inv')
        return this.hudManager.rightPanel === 'inv'
      case 'skill':
      case 'skillTree':
        this.hudManager.toggleRightPanel('skill')
        return this.hudManager.rightPanel === 'skill'
      case 'char':
      case 'character':
        this.hudManager.toggleLeftPanel('char')
        return this.hudManager.leftPanel === 'char'
      case 'quest':
      case 'questLog':
        this.hudManager.toggleLeftPanel('quest')
        return this.hudManager.leftPanel === 'quest'
      case 'waypoint':
        this.hudManager.toggleLeftPanel('waypoint')
        return this.hudManager.leftPanel === 'waypoint'
      case 'party':
        this.hudManager.toggleLeftPanel('party' as any)
        return (this.hudManager.leftPanel as string) === 'party'
      case 'merc':
        if (!this.world.merc || this.world.merc.isDead) {
          if ((this.hudManager.leftPanel as string) === 'merc') {
            this.hudManager.leftPanel = 'none'
          }
          return false
        }
        this.hudManager.toggleLeftPanel('merc' as any)
        return (this.hudManager.leftPanel as string) === 'merc'
      case 'msg':
      case 'messageLog':
        this.hudManager.toggleLeftPanel('msg')
        return (this.hudManager.leftPanel as string) === 'msg'
      default:
        return false
    }
  }

  closeAllPanels(): void {
    this.escapeMenuOpen = false
    const npcId =
      this.world.npcInteraction.npcId ??
      (this.hudManager?.worldPanels as any)?.npcMenu?.npcUnitId ??
      (this.hudManager?.worldPanels as any)?.npcMenu?.npcId ??
      (this.hudManager?.worldPanels as any)?.npcSpeech?.npcUnitId ??
      (this.hudManager?.worldPanels as any)?.npcSpeech?.npcId ??
      (this.hudManager?.worldPanels as any)?.activeNpcId ??
      null
    if (npcId !== null && npcId > 0) {
      this.closeNpc(npcId)
    }
    this.hudManager?.closeAllPanels()
  }

  /**
   * Toggle Automap overlay visibility (`Tab` key / HUD MiniPanel Automap button)
   * without overwriting the `automap-reveal` plugin reveal mode (`'off' | 'level' | 'act'`).
   */
  toggleAutomap(): void {
    if (!this.automap) return
    this.automap.requestVisibilityToggle()
  }

  /**
   * Synchronize `ClientWorld` state into `HudManager` (vitals, character sheet, skills,
   * inventory/equipment/stash/cube/belt containers, waypoints, death, mercenary, party, trade, and NPC state).
   */
  syncFromWorld(): void {
    this.syncPlayerQuestsFromWorld()
    const hud = this.hudManager
    if (!hud) return

    if (this.boundHudInstance !== hud || hud.commandSink !== this) {
      this.bindHudCallbacks(hud)
    }

    const eqCtx = this.resolveEquippedContext()
    this.activeSyncEquippedItems = eqCtx.equippedItems
    this.activeSyncEquippedSig = eqCtx.equippedSig
    try {
      this.syncFromWorldImpl(hud)
    } finally {
      this.activeSyncEquippedItems = null
      this.activeSyncEquippedSig = null
    }
  }

  private syncFromWorldImpl(hud: HudManager): void {
    syncFromWorldImpl(this, hud)
  }

  private refreshHoveredItems(hud: HudManager): void {
    refreshHoveredItemsImpl(hud)
  }

  private computeSkillDamageString(skillId: number, hud: HudManager): string {
    return computeHudSkillDamageString(skillId, hud, this.world.self.skillEntries, this.world.self.states)
  }

  resolveNpcScreenPosition(
    npcId: number,
    hud: HudManager | null = this.hudManager,
  ): { x: number; y: number } | null {
    return resolveNpcScreenPositionImpl(this, npcId, hud)
  }

  private syncNpcInteraction(hud: HudManager): void {
    syncNpcInteractionImpl(this, hud)
  }

  /** Sell value (and repair cost at smiths) on the player's bag, equipped, and cursor items while a store is open. */
  private decoratePlayerItemPrices(hud: HudManager, price: VendorPriceFn, ctx: VendorPriceContext, canRepair: boolean): void {
    decoratePlayerItemPricesImpl(this, hud, price, ctx, canRepair)
  }

  private npcDescriptor(npcId: number): TownNpcServiceDescriptor | undefined {
    return npcDescriptorImpl(this, npcId)
  }

  private tryNpcDescriptor(npcId: number): TownNpcServiceDescriptor | undefined {
    return tryNpcDescriptorImpl(this, npcId)
  }

  /** MonStats hcIdx of NPC unit `npcId`; throws when the unit is not in the world. */
  private npcClassOf(npcId: number): number {
    return npcClassOfImpl(this, npcId)
  }

  private priceContext(npcId: number): VendorPriceContext {
    return priceContextImpl(this, npcId)
  }

  private requireVendorPrice(): VendorPriceFn {
    return requireVendorPriceImpl(this)
  }

  private requireVendorRepairAll(): VendorRepairAllFn {
    return requireVendorRepairAllImpl(this)
  }

  /** The open store (`npcInteraction.window` trade / gamble); throws when none is open. */
  private requireOpenStore(action: string): { npcId: number; gamble: boolean; ctx: VendorPriceContext } {
    return requireOpenStoreImpl(this, action)
  }

  /** `true` when `action` ran less than 2000 ms ago (the click is dropped, like D2Client). */
  private isThrottled(action: string): boolean {
    return isThrottledImpl(this, action)
  }

  /** Player item by id from the bag, the paperdoll or the cursor. */
  private requirePlayerItem(itemId: number, action: string): ItemData {
    return requirePlayerItemImpl(this, itemId, action)
  }

  /** 1.13c D2GAME_STORES_SellItem_6FCC7680 itemMode (0 = STORED, 1 = EQUIPPED, 4 = CURSOR). */
  private playerItemMode(item: ItemData): number {
    return playerItemModeImpl(this, item)
  }

  private findWorldItem(itemId: number): ItemData | undefined {
    return findWorldItemImpl(this, itemId)
  }

  /**
   * Update the hovered/targeted monster unit ID and refresh `hudManager.targetMonster`.
   */
  setHoveredMonster(monsterUnitId: number | null): void {
    this.hoveredMonsterId = monsterUnitId
    this.syncHoveredMonsterTarget()
    this.hudManager?.syncPublishedState()
  }

  /**
   * Lightweight target-monster-only HUD refresh for high-frequency non-self monster packets
   * (`UnitMove`, `UnitMode`, `UnitOverlay`). Avoids rebuilding inventory, skills, quests, and
   * party views when only a monster's HP/position/mode changed.
   */
  syncTargetMonsterFromWorld(): void {
    if (this.hoveredMonsterId === null) return
    this.syncHoveredMonsterTarget()
    this.hudManager?.syncPublishedState()
  }

  private syncHoveredMonsterTarget(): void {
    syncHoveredMonsterTargetImpl(this)
  }

  private emitCommand(cmd: ClientCommand): void {
    this.onCommand?.(cmd)
  }

  // ---------------------------------------------------------------------------
  // HUD User Action -> ClientCommand Dispatchers
  // ---------------------------------------------------------------------------

  /**
   * Allocate a base attribute point (`str`, `dex`, `vit`, `ene`) and emit `AddStatPoint (0x3A)`.
   */
  allocateStat(key: BaseStatKey, count?: number): boolean {
    return allocateStatImpl(this, key, count)
  }

  /**
   * Request a skill point allocation (`AddSkillPoint 0x3B`). The tree updates when the server answers (0x21).
   */
  allocateSkill(skillId: number): boolean {
    return allocateSkillImpl(this, skillId)
  }

  /**
   * Request the active left or right hand skill (`0x3C SelectSkill`). The quickbar updates on `0x23`.
   */
  selectSkill(hand: Hand, skillId: number, itemId = 0xffffffff): void {
    selectSkillImpl(this, hand, skillId, itemId)
  }

  /**
   * Bind or unbind (`skillId === 0xffff`) a skill hotkey slot `0..15` (`0x51 AssignSkillHotkey`).
   */
  assignSkillHotkey(slot: number, hand: Hand, skillId: number, itemId = 0xffffffff): void {
    assignSkillHotkeyImpl(this, slot, hand, skillId, itemId)
  }

  /**
   * Activate a bound skill hotkey slot `0..15` (`0x3C SelectSkill`).
   */
  activateSkillHotkey(slot: number): boolean {
    return activateSkillHotkeyImpl(this, slot)
  }

  /**
   * Cycle through bound skill hotkeys (`0x6faed6d0`, `step = -1 | 1`) and select the skill (`0x3C`).
   */
  cycleBoundSkills(step: -1 | 1): boolean {
    return cycleBoundSkillsImpl(this, step)
  }

  /**
   * Shift+Left-Click auto-place inventory item into belt (`0x63 ItemToBelt`, `0x6fb46ff8`).
   */
  autoBeltItem(itemId: number): boolean {
    return autoBeltItemImpl(this, itemId)
  }

  onAutoBeltItem(itemId: number): boolean {
    return this.autoBeltItem(itemId)
  }

  /**
   * Use the potion at belt `slotIndex` (`0..15`, or column `0..3`) via `BeltUse (0x26)` with its real server item id.
   * Returns `false` (no command) when ClientWorld has no item at that slot/column.
   */
  useBeltSlot(slotIndex: number, shift = false): boolean {
    return useBeltSlotImpl(this, slotIndex, shift)
  }

  onUseBeltSlot(slotIndex: number, shift = false): boolean {
    return this.useBeltSlot(slotIndex, shift)
  }

  /**
   * Swap the held cursor item with an occupied equipment slot (`0x1D ItemSwap`, 9B).
   */
  swapEquipItem(itemId: number, slot: EquipSlotId | string | number): void {
    swapEquipItemImpl(this, itemId, slot)
  }

  onSwapEquipItem(itemId: number, slot: EquipSlotId | string | number): void {
    this.swapEquipItem(itemId, slot)
  }

  /**
   * Swap a cursor 1H weapon/shield into an empty hand slot by unequipping the opposite 2H weapon (`0x1B ItemSwap2Handed`, 9B).
   */
  swap2HandedItem(itemId: number, slot: EquipSlotId | string | number): void {
    swap2HandedItemImpl(this, itemId, slot)
  }

  onSwap2HandedItem(itemId: number, slot: EquipSlotId | string | number): void {
    this.swap2HandedItem(itemId, slot)
  }

  /**
   * Swap a cursor 2H weapon with two equipped 1H weapons/shield (`0x1E ItemSwap2HandedDual`, 9B).
   */
  swap2HandedDual(itemId: number, slot: EquipSlotId | string | number): void {
    swap2HandedDualImpl(this, itemId, slot)
  }

  onSwap2HandedDual(itemId: number, slot: EquipSlotId | string | number): void {
    this.swap2HandedDual(itemId, slot)
  }

  /**
   * Swap the held cursor item with an occupied container item (`0x1F SwapContainerItem`, 17B).
   */
  swapContainerItem(
    cursorItemId: number,
    targetItemId: number,
    x: number,
    y: number,
    container?: number,
  ): void {
    swapContainerItemImpl(this, cursorItemId, targetItemId, x, y, container)
  }

  onSwapContainerItem(
    cursorItemId: number,
    targetItemId: number,
    x: number,
    y: number,
    container?: number,
  ): void {
    this.swapContainerItem(cursorItemId, targetItemId, x, y, container)
  }

  /**
   * Put the held cursor item into belt slot `slot` (`0x23 BeltPut`, 9B).
   */
  putBeltItem(itemId: number, slot: number): void {
    putBeltItemImpl(this, itemId, slot)
  }

  onPutBeltItem(itemId: number, slot: number): void {
    this.putBeltItem(itemId, slot)
  }

  /**
   * Remove a potion from the belt onto the cursor (`0x24 BeltRemove`, 5B).
   */
  removeBeltItem(itemId: number): void {
    removeBeltItemImpl(this, itemId)
  }

  onRemoveBeltItem(itemId: number): void {
    this.removeBeltItem(itemId)
  }

  /**
   * Swap the held cursor potion with a belt potion (`0x25 BeltSwap`, 9B).
   */
  swapBeltItem(cursorItemId: number, beltItemId: number): void {
    swapBeltItemImpl(this, cursorItemId, beltItemId)
  }

  onSwapBeltItem(cursorItemId: number, beltItemId: number): void {
    this.swapBeltItem(cursorItemId, beltItemId)
  }

  /**
   * Identify `itemId` using identify scroll/tome `scrollId` (`0x27 IdentifyItem`, 9B).
   */
  identifyItem(itemId: number, scrollId: number): void {
    identifyItemImpl(this, itemId, scrollId)
  }

  onIdentifyItem(itemId: number, scrollId: number): void {
    this.identifyItem(itemId, scrollId)
  }

  /**
   * Insert socket filler `itemId` into socketed host `targetItemId` (`0x28 SocketItem`, 9B).
   * No-op when `targetItem` is already at full socket capacity.
   */
  socketItem(itemId: number, targetItemId: number): void {
    socketItemImpl(this, itemId, targetItemId)
  }

  onSocketItem(itemId: number, targetItemId: number): void {
    this.socketItem(itemId, targetItemId)
  }

  /**
   * Stack scroll `scrollId` into tome `bookId` (`0x29 ScrollToBook`, 9B).
   * Validates `isc -> ibk` and `tsc -> tbk` compatibility when both items exist in `ClientWorld`.
   */
  scrollToBook(scrollId: number, bookId: number): void {
    scrollToBookImpl(this, scrollId, bookId)
  }

  onScrollToBook(scrollId: number, bookId: number): void {
    this.scrollToBook(scrollId, bookId)
  }

  /**
   * Send NPC voice/message playback request (`0x4D PlayNpcMessage`, 3B: `[0x4D, u16 classId]`).
   */
  playNpcMessage(classId: number): void {
    playNpcMessageImpl(this, classId)
  }

  /**
   * Send NPC quest dialogue message (`0x31 QuestMessage`, 9B).
   * Allows `0xffffffff` (`-1`) for object speech box completion callbacks (`D2Client.dll` `0x6fb212c0`).
   */
  questMessage(npcId: number, messageId = 0): void {
    questMessageImpl(this, npcId, messageId)
  }

  /**
   * Send generic NPC entity action (`0x38 NpcEntityAction`, 13B).
   */
  npcEntityAction(action: number, npcId: number, complement = 0): void {
    npcEntityActionImpl(this, action, npcId, complement)
  }

  /**
   * Hire a mercenary (`0x36 MercHire`, 9B).
   */
  hireMerc(npcId: number, mercId: number): void {
    hireMercImpl(this, npcId, mercId)
  }

  /**
   * Resurrect the player's dead mercenary (`0x62 MercResurrect`, 5B).
   */
  resurrectMerc(npcId?: number): void {
    resurrectMercImpl(this, npcId)
  }

  /**
   * Equip/unequip a mercenary item slot (`0x61 MercItem`, 3B).
   */
  mercItem(slot: number): void {
    mercItemImpl(this, slot)
  }

  /**
   * Resurrect the player after death (`0x41 Resurrect`, 1B).
   */
  resurrect(): void {
    resurrectImpl(this)
  }

  onResurrect(): void {
    this.resurrect()
  }

  /**
   * Send a party action (`0x5E PartyAction`, 6B: `0x06` invite, `0x07` cancel, `0x08` accept, `0x09` leave).
   */
  partyAction(action: number, targetPlayerId: number): void {
    partyActionImpl(this, action, targetPlayerId)
  }

  /**
   * Toggle corpse loot permission (`0x5D Hostile`, 7B).
   * Issue #909 R3: PvP hostility (`button = 1`) is disabled and never sends a packet.
   */
  setHostile(targetPlayerId: number, hostile: boolean | number, button = 1): void {
    setHostileImpl(this, targetPlayerId, hostile, button)
  }

  hostile(targetPlayerId: number, hostile: boolean | number, button = 1): void {
    this.setHostile(targetPlayerId, hostile, button)
  }

  /**
   * Send a UI button click (`0x4F ClickButton`, 7B).
   */
  clickButton(buttonId: number, complement = 0): void {
    clickButtonImpl(this, buttonId, complement)
  }

  /**
   * Confirm a quest reward item action (Charsi imbue, Larzuk socket, Anya personalize via `0x38 NpcEntityAction`,
   * or Horadric Orifice via `0x44 StaffInOrifice` with `state = 3`).
   */
  confirmQuestReward(itemId: number, explicitNpcId?: number): void {
    confirmQuestRewardImpl(this, itemId, explicitNpcId)
  }

  /**
   * Close the active NPC/object interaction and all HUD panels.
   */
  closeActiveNpcPanel(): void {
    closeActiveNpcPanelImpl(this)
  }

  /**
   * Handle `S2C 0x58` `uiAction = 5` (`D2Client.dll` `0x6fb4fb30` / `0x6fb502bd..0x6fb502c9`):
   * consume the staff from the orifice slot, close the orifice UI without emitting `0x44` cancel,
   * and play sound `5` (`cursor_staff_in_orifice`) on `extra != 0` or `3` (`cursor_cant_use`) on `0`.
   */
  completeOrificeUi(extra = 0): void {
    completeOrificeUiImpl(this, extra)
  }

  /**
   * Handle `S2C 0x58` `uiAction = 6 | 7` (`D2Client.dll` `0x6fb502d4 -> 0x6fb4f9e0 -> 0x6faf8150 -> 0x6faf7b20`):
   * close only the 1-slot artisan window (`imbue`, `add_sockets`, `personalize`), keep the right-dock inventory
   * open so the returned cursor item can be placed into the bag, and send `C2S 0x30 NpcCancel(npcId)`.
   */
  completeArtisanUi(uiId: 6 | 7, explicitNpcId?: number): void {
    completeArtisanUiImpl(this, uiId, explicitNpcId)
  }

  /**
   * Open 1-slot artisan/orifice panel (`imbue`, `add_sockets`, `personalize`, `orifice`), docking inventory on right.
   */
  openArtisanWindow(kind: 'imbue' | 'add_sockets' | 'personalize' | 'orifice', npcId?: number): void {
    openArtisanWindowImpl(this, kind, npcId)
  }

  /**
   * Handle an NPC menu option selection (`talk`, `talk_intro`, `talk_gossip`, `talk_quest:*`, `identify`, `hire`, `resurrect`, `travel_*`, `imbue`, `add_sockets`, `personalize`).
   */
  handleNpcMenuAction(
    actionId: string,
    npcId?: number,
    descriptor?: TownNpcServiceDescriptor,
  ): void {
    handleNpcMenuActionImpl(this, actionId, npcId, descriptor)
  }

  /**
   * Request a weapon set swap (`SwapWeapons 0x60`); `weaponSet` changes when the server confirms.
   */
  swapWeapons(): void {
    swapWeaponsImpl(this)
  }

  /**
   * Request fresh quest log data (`RequestQuestData 0x40`, D2Client.dll 0x6faccac0).
   */
  requestQuestData(): void {
    requestQuestDataImpl(this)
  }

  /**
   * 1.13c `QUESTLOG_Open` (`0x6faccac0`): hide the Quest Alert button (`UI 0x11`), sync the active
   * Act tab from the player's current level (`D2Common_10826`), and select the highlighted quest.
   */
  onQuestLogOpened(): number {
    return onQuestLogOpenedImpl(this)
  }

  /**
   * Port-side equivalent of the native `0x6facda90` icon-animation-flag scan: the first quest of
   * `act0` whose panel status is `active` (started, not completed), by socket index; `-1` when none.
   */
  private firstActiveQuestIndex(act0: number): number {
    return firstActiveQuestIndexImpl(this, act0)
  }

  onQuestLogClosed(): void {
    onQuestLogClosedImpl(this)
  }

  /**
   * Replay the active quest speech (`questlast.dc6` button in Quest Log, `D2Client.dll` `0x6facd5b0`).
   */
  replayQuestSpeech(speechKey: string): void {
    replayQuestSpeechImpl(this, speechKey)
  }

  /**
   * Toggle run/walk state (`R` hotkey or control bar button).
   */
  toggleRunWalk(): boolean {
    return toggleRunWalkImpl(this)
  }

  private resolveActTabForArea(areaId: number, act0Based: number): number {
    return resolveActTabForAreaImpl(areaId, act0Based)
  }

  /**
   * Teleport to `destAreaId` via an open waypoint (`0x49 WaypointGo`).
   */
  teleportWaypoint(waypointUnitId: number, destAreaId: number): void {
    teleportWaypointImpl(this, waypointUnitId, destAreaId)
  }

  /**
   * Close the active Waypoint menu without teleporting (`D2Client.dll` `0x6fb5a380`):
   * if no `0x49` packet was sent yet (`!this.waypointPacketSent`), sends C2S `0x49` with `destAreaId = 0`.
   */
  closeWaypoint(): void {
    closeWaypointImpl(this)
  }

  /** Waypoint teleport from the HUD waypoint panel, using the waypoint object from the last `0x63`. */
  teleportToLevel(destAreaId: number): void {
    teleportToLevelImpl(this, destAreaId)
  }

  /** Alias for `teleportToLevel` used by `WorldPanelsHud` / online HUD callers. */
  waypointTeleport(destAreaId: number): void {
    this.teleportToLevel(destAreaId)
  }

  /**
   * Drop `amount` inventory gold on the ground (`0x50 DropGold`).
   */
  dropGold(amount: number): void {
    dropGoldImpl(this, amount)
  }

  /**
   * Right-click use of an inventory item (`0x20 ItemUse` or `0x3E SelectMainItem` / barkscroll / recipescroll).
   */
  useItem(itemId: number): void {
    useItemImpl(this, itemId)
  }

  onUseInventoryItem(itemId: number): void {
    this.useItem(itemId)
  }

  /**
   * Request casting a Town Portal (`TownPortal`).
   */
  castTownPortal(): void {
    castTownPortalImpl(this)
  }

  /**
   * Pick up an inventory/container item to the cursor (`0x19 ItemToCursor`).
   */
  pickupItemToCursor(itemId: number): void {
    pickupItemToCursorImpl(this, itemId)
  }

  /**
   * Place the held cursor item into a container grid (`0x18 ItemPlace`).
   * `buffer`: `0` = inventory, `3` = cube, `4` = stash.
   */
  placeCursorItem(itemId: number, col: number, row: number, buffer = 0): void {
    placeCursorItemImpl(this, itemId, col, row, buffer)
  }

  /**
   * Equip an item onto a body slot (`0x1A ItemEquip`).
   */
  equipItem(itemId: number, slot: EquipSlotId | number): void {
    equipItemImpl(this, itemId, slot)
  }

  /**
   * Unequip an item from a body slot (`0x1C ItemUnequip`).
   */
  unequipItem(slot: EquipSlotId | number): void {
    unequipItemImpl(this, slot)
  }

  /**
   * Drop the cursor item onto the ground (`0x17 ItemDrop`).
   */
  dropItem(itemId: number): void {
    dropItemImpl(this, itemId)
  }

  /**
   * Trigger Horadric Cube transmute (`0x4F ClickButton` `buttonId = 0x18`).
   */
  transmuteCube(): void {
    transmuteCubeImpl(this)
  }

  /**
   * Buy an item from an active NPC vendor (`0x32 NpcBuy`).
   */
  buyFromNpc(p: { npcId: number; itemId: number; itemMode: number; gamble: boolean; shiftFill: boolean; cost: number }): void {
    buyFromNpcImpl(this, p)
  }

  /**
   * Sell an item to an active NPC vendor (`0x33 NpcSell`).
   */
  sellToNpc(p: { npcId: number; itemId: number; itemMode: number; cost: number }): void {
    sellToNpcImpl(this, p)
  }

  /**
   * Repair one item at an NPC smith (`0x35` with itemMode / current durability).
   */
  repairItemAtNpc(p: { npcId: number; itemId: number; itemMode: number; durability: number }): void {
    repairItemAtNpcImpl(this, p)
  }

  /**
   * Repair all items at an NPC smith (`0x35` field4 = 0x80000000).
   */
  repairAllAtNpc(npcId: number): void {
    repairAllAtNpcImpl(this, npcId)
  }

  /**
   * Identify all items via Deckard Cain (`0x34 NpcIdentifyAll`).
   */
  identifyAllAtNpc(npcId: number): void {
    identifyAllAtNpcImpl(this, npcId)
  }

  /** NPC menu "trade" / "trade/repair" (`0x38` action 1). Throws when no price provider is configured. */
  openNpcTrade(npcId: number): void {
    openNpcTradeImpl(this, npcId)
  }

  /** NPC menu "gamble" (`0x38` action 2); only the six 1.13c gamble NPC classes. */
  openNpcGamble(npcId: number): void {
    openNpcGambleImpl(this, npcId)
  }

  /** Close the NPC menu / store (`0x30 NpcCancel`); the server sends nothing back. */
  closeNpc(npcId: number): void {
    closeNpcImpl(this, npcId)
  }

  /** Cancel/dismiss current NPC session (`0x30 NpcCancel`) and clear HUD NPC menu. */
  cancelNpcSession(npcId?: number): void {
    cancelNpcSessionImpl(this, npcId)
  }

  /** Store grid click on shop item `itemId`: `0x32 NpcBuy` with the #10107 buy / gamble price. */
  vendorBuy(itemId: number, shiftFill: boolean): boolean {
    return vendorBuyImpl(this, itemId, shiftFill)
  }

  /** Sell player item `itemId`: `0x33 NpcSell` with the #10107 sell price and 1.13c itemMode (0=STORED, 1=EQUIPPED, 4=CURSOR). */
  vendorSell(itemId: number): boolean {
    return vendorSellImpl(this, itemId)
  }

  /** Repair player item `itemId` (`0x35`); durability is the item's current value (absent stat = 0). */
  vendorRepairItem(itemId: number): boolean {
    return vendorRepairItemImpl(this, itemId)
  }

  /** Repair All button (`0x35` field4 = 0x80000000). */
  vendorRepairAll(): boolean {
    return vendorRepairAllImpl(this)
  }

  /** Gold dialog mode 3: `0x4F ClickButton` 0x14 DepositGold. Non-positive amounts send nothing. */
  depositGold(amount: number): void {
    depositGoldImpl(this, amount)
  }

  private stashDepositRun: Promise<StashDepositResult> | null = null

  depositAllToStash(): Promise<StashDepositResult> {
    return (this.stashDepositRun ??= depositAllToStash(this, () => this.hudManager?.leftPanel === 'stash').finally(() => void (this.stashDepositRun = null)))
  }

  /** Gold dialog mode 4: `0x4F ClickButton` 0x13 WithdrawGold. Non-positive amounts send nothing. */
  withdrawGold(amount: number): void {
    withdrawGoldImpl(this, amount)
  }

  /** Stash panel closed: `0x4F ClickButton` 0x12 CloseStash (no reply). */
  closeStash(): void {
    closeStashImpl(this)
  }

  /** Horadric Cube panel closed: `0x4F ClickButton` 0x17 CloseCube (no reply). */
  closeCube(): void {
    closeCubeImpl(this)
  }

  /** Place the held cursor item indirectly into the Horadric Cube (`0x2A ItemToCube`). */
  itemToCube(itemId: number, cubeId: number): void {
    itemToCubeImpl(this, itemId, cubeId)
  }

  onItemToCube(itemId: number, cubeId: number): void {
    this.itemToCube(itemId, cubeId)
  }
}
