/**
 * Diablo II v1.13c Complete HUD & UI Orchestrator (`src/ui/hud-manager.ts`).
 *
 * Coordinates:
 * - 800x600 Logical Viewport scaling onto the full-window `#d2-hud-canvas`
 * - Bottom 800px Control Panel (`control-bar.ts`), Life/Mana Globes (`globes.ts`),
 *   4x4 Belt (`belt.ts`), and Left/Right Skill Speedbar (`hotkeys.ts`)
 * - Left-Half Dock (`0..400, 0..553` + `800BorderFrame` Left):
 *   Character Sheet (`A`/`C`), Quest Log (`Q`), Waypoint Menu (`V`), Stash, Horadric Cube, Vendor
 * - Right-Half Dock (`400..800, 0..553` + `800BorderFrame` Right):
 *   Inventory & Equipment Paperdoll (`I`/`B`), Skill Tree (`T`)
 * - Top Monster Health Bar, Item Hover Tooltips, Ground `Alt` Item Labels, Area Entry Banner,
 *   and Authentic Hand Cursor (`CURSOR\ohand.dc6`) / Held `cursorItem` Sprite.
 *
 * Sub-modules:
 * - `hud-viewport-layout.ts`: Viewport & docking coordinate math, weapon/skill damage formatters
 * - `hud-gold-dialog.ts`: Gold drop / deposit / withdraw / trade modal dialog
 * - `hud-input-router.ts`: HUD hit-testing, keyboard shortcuts, mouse press/release & grid click routing
 * - `hud-world-overlays.ts`: Main HUD frame renderer, ground item beams, speech bubbles, chat & cursor layer
 */

import type { PotionShortageKind } from './potion-shortage-badge.ts'
import { D2FontRenderer } from './font.ts'
import type { GroundItemLabelBox } from '../../common/items/ground-items.ts'
import { GlobesHud } from './globes.ts'
import { BeltHud } from './belt.ts'
import { SkillHotkeysHud } from './hotkeys.ts'
import { ControlBarHud, type MiniPanelAction } from './control-bar.ts'
import { TouchControlsHud } from './touch-controls.ts'
import { BAKED_UI_MANIFEST } from '../../common/items/baked-ui-meta.ts'
import { resolveHirelingName } from '../../common/units/hireling-table.ts'
import {
  InventoryPanel,
  canPlayerUseUiItem,
  isUiItemUnidentified,
  type EquipSlotId,
  type UiInventoryItem,
} from './inventory.ts'
import { upgradeVerdict, type BuildProfile, type UpgradeVerdict } from '../../common/items/item-comparison.ts'
import { XpGainFeed, XpRateTracker } from './xp-bar.ts'
import { ToastFeed } from './toasts.ts'
import type { AutomapHudFootprint } from './minimap.ts'
import { onlineItemDataToUiInventoryItem } from '../../common/items/item-bridge.ts'
import type { ItemData } from '../../netproto/index.ts'
import { groundItemBadges, isLootHidden, type ItemInfoConfig } from './ground-item-info.ts'
import { badgesWidth, type ItemBadge } from './item-badges.ts'
import { D2_EXPERIENCE_TABLE_99 } from '../../common/skills/formulas.ts'
import { CharacterSheetPanel, type BaseStatKey } from './character-sheet.ts'
import { SkillTreePanel } from './skill-tree-panel.ts'
import {
  ESCAPE_MENU_ACTIONS,
  WorldPanelsHud,
  computeEscapeMenuLayout,
  enterEscapeMenuScreen,
  handleEscapeSubmenuMouseDown,
  handleEscapeSubmenuWheel,
  hitTestEscapeMenu,
  moveEscapeSubmenuSelection,
  navigateEscapeMenuBack,
  resolveEscapeMenuSettings,
  type EscapeMenuAction,
  type EscapeMenuRowIndex,
  type EscapeMenuScreen,
  type EscapeMenuSettingsPatch,
  type EscapeMenuSettingsSnapshot,
  type LeftDockPanelKind,
  type MonsterTargetHudInfo,
  type VendorTradeState,
} from './world-panels.ts'
import {
  CursorController,
  type BuySellCursorMode,
  type CursorAnimation,
  type CursorState,
} from './cursor.ts'
import type { CharacterClassCode } from '../../common/units/classes.ts'
import {
  getGameLang,
  setCurrentLang,
  toTblLang,
  type GameLang,
  type TblLang,
} from '../i18n/lang.ts'
import { setTooltipLocale } from '../../common/items/item-tooltip.ts'
import {
  computeViewportAnchors,
  getViewportProfile,
  getViewportProfileBySize,
  isExtendedViewport,
  VIEWPORT_800x600,
  type ViewportAnchorMetrics,
  type ViewportProfile,
} from '../view/viewport-profile.ts'
import type {
  GroundItemEnhancementsConfig,
  HudEnhancementsConfig,
  ViewportResolution,
} from '../settings/client-settings.ts'
import { questAlertHit, questAlertRect, type QuestAlertRect } from '../world/quest-log-state.ts'

import {
  clientToLogical,
  computeDockingLayout,
  computeHudSkillDamageString,
  getActiveHudDockingLayout,
  getHudCanvasRect,
  logicalToClient,
  toControlBarLocal,
  type DockingLayout,
  type GroundItemBeamDescriptor,
} from './hud-viewport-layout.ts'
import {
  cancelGoldDialog,
  confirmGoldDialog,
  drawGoldDialog,
  getGoldDialogLayout,
  goldDialogBalance,
  handleGoldDialogClick,
  openGoldDialog,
  setGoldDialogAmount,
  typeGoldDialogKey,
  type GoldDialogLayout,
  type GoldDialogMode,
  type GoldDialogState,
} from './hud-gold-dialog.ts'
import {
  bindHudWindowEvents,
  createControlBarReleaseCallbacks,
  disposeHudWindowEvents,
  drinkHudBeltSlot,
  forwardGridClick,
  forwardInventoryPanelClick,
  handleHudKeyDown,
  handleHudMouseDown,
  handleHudMouseMove,
  handleHudMouseUp,
  handleSkillAllocated,
  handleVendorInventoryClick,
  isPointInterceptedByHud,
  playHudCantCarrySound,
  playHudCantUseSound,
  playHudItemDropUiSound,
  playHudItemUseUiSound,
  triggerHudResurrect,
} from './hud-input-router.ts'
import {
  ensureCanvas2DContext,
  hasVisibleTopLeftPortraits,
  hudRepaintUnchanged,
  renderChatInputBox,
  renderChatOverlay,
  renderCursor,
  renderCursorLayer,
  renderGroundItemBeams,
  renderHudFrame,
  renderOverheadSpeechBubbles,
  setCursorLayerActive,
  syncHudPublishedState,
} from './hud-world-overlays.ts'
import {
  LevelEntryTitle113c,
  type LevelEntryTitleQuestSource,
} from '../../common/world/level-entry-title-113c.ts'
import {
  LEVEL_ENTRY_TITLE_ATLAS,
  LEVEL_ENTRY_TITLE_KEY_BY_LEVEL,
} from '../../common/world/level-entry-titles-113c.ts'
import { SharedAssetPool } from '../multibox/shared-asset-pool.ts'

export * from './hud-viewport-layout.ts'
export * from './hud-gold-dialog.ts'
export * from './hud-input-router.ts'
export * from './hud-world-overlays.ts'

export { CHAR_PANEL_ORIGIN } from './character-sheet.ts'
export { INV_PANEL_ORIGIN, INV_GRID_ORIGIN } from './inventory.ts'
export { SKILL_PANEL_ORIGIN } from './skill-tree-panel.ts'
export {
  STASH_PANEL_ORIGIN,
  STASH_GRID_ORIGIN,
  CUBE_PANEL_ORIGIN,
  CUBE_GRID_ORIGIN,
  CUBE_TRANSMUTE_BTN_BOUNDS,
  CUBE_CLOSE_BTN_BOUNDS,
  VENDOR_PANEL_ORIGIN,
  VENDOR_GRID_ORIGIN,
  ESCAPE_MENU_ACTIONS,
  computeEscapeMenuLayout,
  computeOptionsSubmenuLayout,
  computeControlsMenuLayout,
  hitTestEscapeMenu,
  type EscapeMenuAction,
  type EscapeMenuRowIndex,
  type EscapeMenuScreen,
  type EscapeMenuSettingsPatch,
  type EscapeMenuSettingsSnapshot,
} from './world-panels.ts'

export type LeftPanelType =
  | LeftDockPanelKind
  | 'merc'
  | 'hire'
  | 'party'
  | 'msg'
  | 'trade'
  | 'imbue'
  | 'add_sockets'
  | 'personalize'

export interface PublishedHudState {
  ready: boolean
  dc6DecodeFailures: number
  decodedDc6Count: number
  cursorState: CursorState
  cursorTradeMode?: BuySellCursorMode | null
  cursorAnimation?: CursorAnimation
  cursorFrameIndex?: number
  assetsLoaded: {
    ctrlPnl: boolean
    globes: boolean
    borders: boolean
    invSheet: boolean
    charSheet: boolean
    skillTree: boolean
    font: boolean
    itemsAtlas: boolean
    questsAtlas: boolean
    escapeMenu?: boolean
  }
  leftPanel: LeftPanelType
  rightPanel: 'none' | 'inv' | 'skill'
  beltExpanded: boolean
  beltPotionsCount: number
  miniPanelOpen: boolean
  isRunning: boolean
  showGroundLabels: boolean
  cursorItem: string | null
  equippedSlots: string[]
  bagItemsCount: number
  weaponSwapSet: 0 | 1
  leftSkillId: number
  rightSkillId: number
  characterLevel: number
  statPoints: number
  skillPoints: number
  hp: number
  maxHp: number
  mana: number
  maxMana: number
  stamina: number
  maxStamina: number
  docking: DockingLayout
  viewportProfile?: ViewportProfile
  activeVendor?: string | null
  vendorMode?: 'trade' | 'gamble'
  vendorTradeState?: VendorTradeState
  vendorTab?: string
  vendorItemsCount?: number
  npcMenuOpen?: boolean
  escapeMenuOpen?: boolean
  escapeMenuSelectedIndex?: EscapeMenuRowIndex
  escapeMenuScreen?: EscapeMenuScreen
}

/**
 * Server-authoritative HUD command sink (online mode: `HudModel`). Every method only emits a `ClientCommand`;
 * the HUD never mutates gameplay state locally while a sink is attached.
 */
export interface HudCommandSink {
  allocateStat(key: BaseStatKey): boolean
  allocateSkill(skillId: number): boolean
  selectSkill(hand: 'left' | 'right', skillId: number): void
  assignSkillHotkey?(slot: number, hand: 'left' | 'right', skillId: number, itemId?: number): void
  activateSkillHotkey?(slot: number): boolean
  cycleBoundSkills?(step: -1 | 1): boolean
  useBeltSlot(col: number, shiftToMerc?: boolean): boolean
  autoBeltItem?(itemId: number): boolean | void
  onAutoBeltItem?(itemId: number): boolean | void
  swapWeapons(): void
  pickupItemToCursor(itemId: number): void
  /** `buffer`: `0` = inventory, `3` = cube, `4` = stash. */
  placeCursorItem(itemId: number, col: number, row: number, buffer: number): void
  equipItem(itemId: number, slot: EquipSlotId): void
  unequipItem(slot: EquipSlotId): void
  swapEquipItem?(cursorItemId: number, slot: EquipSlotId): void
  onSwapEquipItem?(cursorItemId: number, slot: EquipSlotId): void
  swap2HandedItem?(cursorItemId: number, slot: EquipSlotId): void
  onSwap2HandedItem?(cursorItemId: number, slot: EquipSlotId): void
  swap2HandedDual?(cursorItemId: number, slot: EquipSlotId): void
  onSwap2HandedDual?(cursorItemId: number, slot: EquipSlotId): void
  swapContainerItem?(cursorItemId: number, targetItemId: number, col: number, row: number, buffer: number): void
  putBeltItem?(cursorItemId: number, slotIndex: number): void
  removeBeltItem?(itemId: number): void
  swapBeltItem?(cursorItemId: number, beltItemId: number): void
  identifyItem?(targetItemId: number, scrollItemId: number): void
  socketItem?(cursorItemId: number, targetItemId: number): void
  scrollToBook?(scrollItemId: number, bookItemId: number): void
  dropItem(itemId: number): void
  dropGold(amount: number): void
  useItem(itemId: number): void
  transmuteCube(): void
  teleportToLevel(destAreaId: number): void
  closeWaypoint?(): void
  /** NPC menu "trade" / "trade/repair": `0x38` action 1. */
  openNpcTrade(npcId: number): void
  /** NPC menu "gamble": `0x38` action 2 (Gheed, Elzix, Alkor, Jamella, Anya, Nihlathak). */
  openNpcGamble(npcId: number): void
  /** NPC menu "Identify Items" (Deckard Cain): `0x34`. */
  identifyAllAtNpc(npcId: number): void
  /** Close the NPC menu / store: `0x30 NpcCancel`. The server sends nothing back. */
  closeNpc(npcId: number): void
  /** Store grid click on a shop item: `0x32 NpcBuy` (gamble flag from the open window). */
  vendorBuy(itemId: number, shiftFill: boolean): void
  /** Sell a player item: `0x33 NpcSell`. */
  vendorSell(itemId: number): void
  /** Repair one item: `0x35 NpcRepair`. */
  vendorRepairItem(itemId: number): void
  /** Repair all equipped items: `0x35` with field4 = 0x80000000. */
  vendorRepairAll(): void
  /** Gold dialog mode 3: `0x4F` button 0x14. */
  depositGold(amount: number): void
  depositAllToStash?(): Promise<unknown>
  /** Gold dialog mode 4: `0x4F` button 0x13. */
  withdrawGold(amount: number): void
  /** Stash panel closed: `0x4F` button 0x12 (no reply). */
  closeStash(): void
  /** Horadric Cube panel closed: `0x4F` button 0x17 (`TRADEBTN_CLOSECUBE`, no reply). */
  closeCube?(): void
  /** Drop held cursor item onto Horadric Cube item icon (`0x2A ItemToCubeIndirect`). */
  itemToCube?(itemId: number, cubeId: number): void
  questMessage?(npcId: number, messageId: number): void
  npcEntityAction?(actionType: number, entityId: number, complement: number): void
  hireMerc?(npcId: number, mercListIndex: number): void
  resurrectMerc?(npcId: number): void
  mercItem?(bodyLoc: number): void
  resurrect?(): void
  partyAction?(action: number, playerUnitId: number): void
  setHostile?(playerUnitId: number, hostile: boolean, button?: number): void
  hostile?(playerUnitId: number, flag: number | boolean, button?: number): void
  clickButton?(buttonId: number, complement?: number): void
  requestQuestData?(): void
  onQuestLogOpened?(): number
  onQuestLogClosed?(): void
  confirmQuestReward?(itemId?: number): void
  closeActiveNpcPanel?(): void
  closeHoradricOrifice?(orificeObjectId?: number): void
  handleNpcMenuAction?(action: string, payload?: any): void
  onResurrect?(): void
  onSwapContainerItem?(cursorItemId: number, targetItemId: number, col: number, row: number, buffer: number): void
  onPutBeltItem?(cursorItemId: number, slotIndex: number): void
  onRemoveBeltItem?(itemId: number): void
  onSwapBeltItem?(cursorItemId: number, beltItemId: number): void
  onUseBeltSlot?(slotIndex: number, shiftToMerc?: boolean): boolean | void
  onIdentifyItem?(targetItemId: number, scrollItemId: number): void
  onSocketItem?(cursorItemId: number, targetItemId: number): void
  onScrollToBook?(scrollItemId: number, bookItemId: number): void
  onItemToCube?(itemId: number, cubeId: number): void
  onUseInventoryItem?(itemId: number, x?: number, y?: number): void
}

/** Parse the numeric server item id carried by a `UiInventoryItem` synced from `ClientWorld`; throws otherwise. */
export function serverItemIdOf(item: UiInventoryItem): number {
  const id = Number(item.id)
  if (!Number.isInteger(id) || id < 0) throw new Error(`HUD item "${item.id}" has no server item id`)
  return id
}

export class HudManager {
  readonly font = new D2FontRenderer()
  readonly globes = new GlobesHud()
  readonly belt = new BeltHud()
  readonly hotkeys = new SkillHotkeysHud()
  readonly controlBar = new ControlBarHud()
  readonly inventory = new InventoryPanel()
  readonly charSheet = new CharacterSheetPanel()
  readonly skillTree = new SkillTreePanel()
  readonly worldPanels = Object.assign(new WorldPanelsHud(), { upgradeVerdictFor: (item: UiInventoryItem) => this.upgradeVerdictFor(item) })
  readonly cursor = new CursorController()
  readonly touchControls = new TouchControlsHud()

  /**
   * Idle 25fps throttle for the 2D HUD repaint (see {@link shouldRenderHudFrame}).
   * Off by default so tests forcing `render(t)` per mutation keep drawing every
   * call; the production main loop enables it.
   */
  enableIdleThrottle = false
  private lastHudFrameTiming: { mouseX: number; mouseY: number; drawMs: number } | null = null

  private _leftPanel: LeftPanelType = 'none'
  get leftPanel(): LeftPanelType {
    return this._leftPanel
  }
  set leftPanel(val: LeftPanelType) {
    const prev = this._leftPanel
    this._leftPanel = val
    this.charSheet.visible = val === 'char'
    if (prev !== 'quest' && val === 'quest') {
      this.worldPanels.selectedQuestIdx = this._commandSink?.onQuestLogOpened?.() ?? -1
      this._commandSink?.requestQuestData?.()
    } else if (prev === 'quest' && val !== 'quest') {
      this._commandSink?.onQuestLogClosed?.()
    }
  }

  private _rightPanel: 'none' | 'inv' | 'skill' = 'none'
  get rightPanel(): 'none' | 'inv' | 'skill' {
    return this._rightPanel
  }
  set rightPanel(val: 'none' | 'inv' | 'skill') {
    this._rightPanel = val
    this.inventory.visible = val === 'inv'
    this.skillTree.visible = val === 'skill'
    if (val !== 'skill') {
      this.skillTree.hoveredSkill = null
    }
  }
  isRunning = true
  itemInfo: ItemInfoConfig | null = null
  private altGroundLabels = false
  get showGroundLabels(): boolean {
    return this.altGroundLabels || Boolean(this.itemInfo?.alwaysShow)
  }
  set showGroundLabels(shown: boolean) {
    this.altGroundLabels = shown
  }
  /** Screen-space (800x600 viewport) ground item label boxes laid out for the current frame. */
  groundItemLabelBoxes: readonly GroundItemLabelBox[] = []
  /** Screen-space (logical viewport) Diablo III-style loot beams for Unique/Set ground items (Issue #957). */
  groundItemBeams: readonly GroundItemBeamDescriptor[] = []
  private groundItemEnhancements: GroundItemEnhancementsConfig = {
    showUniqueSetBeams: false,
    alwaysShowUniqueSetLabels: false,
  }
  /** Server-authoritative vitals (`0x18`/`0x95` + stats 6..11); 0 until the server sends them. */
  stamina = 0
  maxStamina = 0
  isStaminaBlue = false
  hp = 0
  maxHp = 0
  mana = 0
  maxMana = 0
  poisoned = false
  healthPotActive = false
  potionLifePercent = 0
  manaPotActive = false
  potionManaPercent = 0

  /**
   * Level entry title ("Entering The Blood Moor", D2Client.dll 0x6fb6f0d0). Per client, not per game:
   * `g_nLastLevel` (0x6fbd3410) is never reset by the game init.
   */
  readonly levelEntryTitle = new LevelEntryTitle113c(LEVEL_ENTRY_TITLE_KEY_BY_LEVEL)
  /** `g_QuestAvail` reader for the title quest overrides (set by `OnlineSession`). */
  levelEntryQuestSource: LevelEntryTitleQuestSource | null = null
  /**
   * Local player's room level (`D2Common #10826(#10331(player))`), `null` with no player / room
   * (set by `OnlineSession`). Unwired HUDs fall back to `worldPanels.currentLevelId`.
   */
  levelEntryLevelSource: (() => number | null) | null = null

  /** Level id `0x6fb6f0d0` sees this frame. */
  resolveLevelEntryLevelId(): number | null {
    return this.levelEntryLevelSource !== null ? this.levelEntryLevelSource() : this.worldPanels.currentLevelId
  }

  /** Server-authoritative death / mercenary / party / trade state synced by `HudModel`. */
  isDead = false
  /**
   * When `true` (Standalone Trade Hall `/trade.html`), `HudManager`:
   * - loads only the 16 Trade Hall panel/item/cursor images + fonts (`loadAssets(baseUrl, { tradeHallOnly: true })`)
   * - skips control bar, globes, belt, skill speedbar, portraits, and level-entry title rendering
   * - keeps the Right-Half Dock (`invchar6.dc6` Inventory) open alongside the Left-Half Dock (`stash` / `trade` / `cube`)
   * - blocks accidental `dropItem` onto the unrendered town ground when clicking outside panels with a `cursorItem`.
   */
  tradeHallMode = false
  /** Optional status text displayed on the Left-Half Dock when `tradeHallMode` is true and `leftPanel === 'none'`. */
  tradeHallIdleHint: {
    readonly title: string
    readonly subtitle?: string | undefined
  } | null = null
  merc: any = null
  hireList: readonly any[] = []
  mercHireList: readonly any[] = []
  partyMembers: any[] = []
  summonPortraits: any[] = []
  chatOverlayMessages: readonly {
    readonly kind?: string | undefined
    readonly speaker?: string | undefined
    readonly text: string
    readonly color?: number | undefined
    readonly createdAtMs?: number | undefined
    readonly expireAtMs?: number | undefined
  }[] = []
  messageLogEntries: readonly {
    readonly kind?: string | undefined
    readonly speaker?: string | undefined
    readonly text: string
    readonly color?: number | undefined
    readonly createdAtMs?: number | undefined
  }[] = []
  overheadSpeechBubbles: readonly {
    readonly unitType?: string | undefined
    readonly unitId?: number | undefined
    readonly unitKey?: string | undefined
    readonly text: string
    readonly color?: number | undefined
    readonly screenX: number
    readonly screenY: number
    readonly expireAtMs?: number | undefined
  }[] = []
  showFps = false
  showPartyPortraits = true
  helpOverlayOpen = false
  /** D2Client.dll `0x6fb20140` (`CHAT_DrawChatInputBox`): true while in-game chat input box is open. */
  chatInputOpen = false
  /** D2Client.dll `0x6fb8a468` (`g_wszChatInputBuffer`): active typed string in in-game chat input box. */
  chatInputText = ''
  showXpBar = false
  readonly xpRate = new XpRateTracker()
  readonly xpGains = new XpGainFeed()
  readonly toasts = new ToastFeed()
  lowLifeWarning = false
  upgradeHints = false
  resolveGroundItem: ((unitId: number) => ItemData | undefined) | null = null
  resolveBuild: (() => BuildProfile) | null = null
  private readonly groundUiItems = new WeakMap<ItemData, UiInventoryItem>()
  private upgradeVerdicts = new Map<UiInventoryItem, UpgradeVerdict | null>()
  private upgradeMarkersKey = ''
  autoCombatBadge: { readonly on: boolean; readonly key: string } | null = null
  potionShortage: PotionShortageKind | null = null
  currentFps = 0
  pingMs = 0
  trade: any = null
  pendingIdentifyScrollId: number | null = null

  /** Optional 2D rendering context override (used by headless/unit tests). */
  ctx: CanvasRenderingContext2D | null = null
  /** Optional weapon switch callback. */
  onWeaponSwitch?: (() => void) | undefined
  onMercEquipSlotClick?: ((slot: number) => void) | undefined
  onHireMercClick?: ((npcId: number, mercId: number) => void) | undefined
  onPartyActionClick?: ((action: number, targetPlayerId: number) => void) | undefined
  onHostileToggleClick?: ((targetPlayerId: number, hostile: boolean, button?: number) => void) | undefined
  onSquelchToggle?: ((targetPlayerId: number, squelched: boolean) => void) | undefined
  onIgnoreToggle?: ((targetPlayerId: number, ignored: boolean) => void) | undefined
  onClearMessages?: (() => void) | undefined
  onTradeButtonClick?: ((buttonId: number, complement?: number) => void) | undefined
  onConfirmQuestRewardClick?: ((itemId: number, npcId?: number) => void) | undefined

  mouseX = 400
  mouseY = 300

  /** Optional target monster on top plaque. */
  targetMonster: MonsterTargetHudInfo | null = null
  /** Optional world-space overhead label for a hovered interactable NPC (`D2Client.dll` `0x6fb70920`). */
  hoveredNpcLabel: { readonly text: string; readonly screenX: number; readonly screenY: number } | null = null

  private images = new Map<string, HTMLImageElement>()
  private itemRects: Record<string, { x: number; y: number; w: number; h: number }> = {}
  private portraitRects: Record<string, { x: number; y: number; w: number; h: number }> =
    (BAKED_UI_MANIFEST as any).portraitRects ?? {}
  private decodedDc6Count = 415
  private dc6DecodeFailures = 0
  private eventsBound = false
  private inputFocused = true
  /** #954: `[target, type, handler, options]` tuples registered by `bindEvents` for `dispose()`. */
  private readonly boundWindowEvents: [
    Window | HTMLCanvasElement,
    string,
    EventListener,
    (boolean | AddEventListenerOptions | undefined)?,
  ][] = []
  /** #940 R2: container revision mirrored by `HudModel.syncFromWorldImpl` (repaint skip-gate input). */
  hudRevision = -1
  /** #940 R2: last full 2D repaint timestamp (4Hz safety repaint anchor). */
  private lastFullHudRepaintMs = -Infinity
  /** #940 R2: signature of the last fully painted idle frame. */
  private lastIdleRepaintSignature: string | null = null
  /**
   * #940 R3: dedicated cursor layer. When present, the animated cursor is
   * composited on its own canvas above the HUD canvas every render frame, so
   * cursor animation no longer forces a full HUD repaint (it is excluded from
   * the skip signature). When absent (tests, headless harnesses) the cursor is
   * drawn into `hudCanvas` during full repaints, exactly as before.
   */
  private readonly cursorCanvas: HTMLCanvasElement | null

  /**
   * #940 R2 conservative repaint-skip test (idle throttle only).
   */
  private hudRepaintUnchanged(nowMs: number): boolean {
    return hudRepaintUnchanged(this, nowMs)
  }

  readonly state: PublishedHudState = {
    ready: false,
    dc6DecodeFailures: 0,
    decodedDc6Count: 415,
    cursorState: 'POINTING',
    cursorTradeMode: null,
    cursorAnimation: 'protate',
    cursorFrameIndex: 0,
    assetsLoaded: {
      ctrlPnl: false,
      globes: false,
      borders: false,
      invSheet: false,
      charSheet: false,
      skillTree: false,
      font: false,
      itemsAtlas: false,
      questsAtlas: false,
    },
    leftPanel: 'none',
    rightPanel: 'none',
    beltExpanded: false,
    beltPotionsCount: 0,
    miniPanelOpen: true,
    isRunning: true,
    showGroundLabels: false,
    cursorItem: null,
    equippedSlots: [],
    bagItemsCount: 0,
    weaponSwapSet: 0,
    leftSkillId: 0,
    rightSkillId: 0,
    characterLevel: 0,
    statPoints: 0,
    skillPoints: 0,
    hp: 0,
    maxHp: 0,
    mana: 0,
    maxMana: 0,
    stamina: 0,
    maxStamina: 0,
    docking: computeDockingLayout(800, 600, 1),
    vendorTradeState: 'idle',
  }

  /** `null` until the server assigns the character class (see `setCharacterClass`). */
  currentClass: CharacterClassCode | null = null
  private _commandSink: HudCommandSink | null = null

  /**
   * D2Client gold dialog: mode `0` drop (string 4033), `3` deposit (4049), `4` withdraw (4050).
   */
  goldDialog: GoldDialogState | null = null

  /**
   * 1.13c Quest Alert button state (`UI 0x11`, `D2Client.dll` `0x6fba9e20`, `0x6facc980`, `0x6facd840`, `0x6face5f0`).
   * Bound by `HudModel` to `ClientWorld.questLog`.
   */
  questAlert: {
    readonly alertVisible: boolean
    readonly alertPressed: boolean
    pressAlert(inside: boolean): boolean
    releaseAlert(inside: boolean): boolean
  } | null = null

  private getPanelModeBitmask(): number {
    return (this._leftPanel !== 'none' ? 2 : 0) | (this._rightPanel !== 'none' ? 1 : 0)
  }

  getQuestAlertBarLocalRect(): QuestAlertRect | null {
    if (!this.questAlert?.alertVisible) return null
    if (this.isDead || Boolean((this.worldPanels as any).isDead)) return null
    const panelMode = this.getPanelModeBitmask()
    if (panelMode === 3 || this._leftPanel === 'quest') return null
    const is640 = this.syncResolutionMode()
    return questAlertRect(is640 ? 640 : 800, panelMode, this._leftPanel === 'char')
  }

  hitTestQuestAlert(logicalX: number, logicalY: number): boolean {
    const rect = this.getQuestAlertBarLocalRect()
    if (!rect) return false
    if (isExtendedViewport(this.viewportProfile)) {
      const docking = this.getDockingLayout()
      const barPt = toControlBarLocal(logicalX, logicalY, docking)
      return questAlertHit(rect, barPt.x, barPt.y)
    }
    return questAlertHit(rect, logicalX, logicalY)
  }

  /**
   * Server-authoritative command sink (online: `HudModel`). When attached, HUD interactions only emit
   * `ClientCommand`s; all displayed state changes arrive back from the server through `HudModel.syncFromWorld()`.
   */
  get commandSink(): HudCommandSink | null {
    return this._commandSink
  }

  set commandSink(sink: HudCommandSink | null) {
    this._commandSink = sink
    this.hotkeys.onSelectSkill = sink ? (side, skillId) => sink.selectSkill(side, skillId) : undefined
  }

  /**
   * Apply the server-assigned character class (MCP character list / `0x59` UnitAssign classId) to every
   * class-dependent panel: skill tree layout, quickbar, character sheet and item requirement context.
   * Hard points, bonus levels and quickbar skills are cleared; `HudModel` rebuilds them from the server skill list.
   */
  setCharacterClass(classCode: CharacterClassCode): void {
    if (this.tradeHallMode) {
      this.currentClass = classCode
      this.charSheet.classCode = classCode
      this.inventory.updatePlayerContext({ classCode })
      this.syncPublishedState()
      return
    }
    if (this.currentClass === classCode && this.skillTree.characterClass === classCode) {
      this.hotkeys.preloadClassSkillIcons(classCode)
      return
    }
    this.currentClass = classCode
    this.charSheet.classCode = classCode
    this.skillTree.setClass(classCode)
    this.skillTree.hardPoints.clear()
    this.skillTree.bonusLevels.clear()
    this.hotkeys.setAvailableSkills([])
    this.hotkeys.preloadClassSkillIcons(classCode)
    this.inventory.updatePlayerContext({ classCode })
    this.syncPublishedState()
  }

  /**
   * Normalize a campfire class ID (`'am'`, `'so'`, `'ne'`, `'pa'`, `'ba'`, `'dz'`, `'as'`),
   * sprite token (`'ai'`), or 3-letter class code (`'ama'`, `'sor'`, `'nec'`, `'pal'`, `'bar'`, `'dru'`, `'ass'`)
   * and preload all 30 class skill icons, universal action/scroll icons, and 3 skill tree tab backgrounds.
   */
  preloadForCharacterClass(classOrToken: string): CharacterClassCode | null {
    const map: Readonly<Record<string, CharacterClassCode>> = {
      am: 'ama',
      ama: 'ama',
      amazon: 'ama',
      so: 'sor',
      sor: 'sor',
      sorceress: 'sor',
      ne: 'nec',
      nec: 'nec',
      necromancer: 'nec',
      pa: 'pal',
      pal: 'pal',
      paladin: 'pal',
      ba: 'bar',
      bar: 'bar',
      barbarian: 'bar',
      dz: 'dru',
      dr: 'dru',
      dru: 'dru',
      druid: 'dru',
      as: 'ass',
      ai: 'ass',
      ass: 'ass',
      assassin: 'ass',
    }
    const normalized = map[classOrToken.trim().toLowerCase()] ?? null
    if (normalized === null) return null
    this.setCharacterClass(normalized)
    return normalized
  }

  private _lang: TblLang = 'CHI'

  get lang(): TblLang {
    return this._lang
  }

  set lang(val: TblLang) {
    this.setLang(val)
  }

  private resolveLocalizedMercLabel(merc: any, lang: TblLang = this._lang): string {
    if (!merc) return lang === 'CHI' ? '佣兵' : 'Merc'
    const isRealMercName = (s: unknown): s is string =>
      typeof s === 'string' && s.length > 0 && !s.startsWith('Mercenary #') && !s.startsWith('Merc #')
    const rawClassId = Number(merc.classId ?? merc.hcIdx ?? 0)
    const normClassId = rawClassId === 560 ? 561 : rawClassId
    const tblName =
      typeof merc.nameId === 'number' && merc.nameId >= 0 && (normClassId > 0 || merc.nameId >= 1000)
        ? resolveHirelingName(normClassId, merc.nameId, lang)
        : ''
    const validTblName = isRealMercName(tblName) ? tblName : ''
    const validNameZh = isRealMercName(merc.nameZh) ? merc.nameZh : ''
    const validNameEn = isRealMercName(merc.nameEn) ? merc.nameEn : ''
    const validName = isRealMercName(merc.name) ? merc.name : ''
    if (lang === 'CHI') {
      return String(validNameZh || validTblName || validName || merc.name || '佣兵')
    }
    return String(validNameEn || validTblName || validName || merc.name || 'Merc')
  }

  setLang(lang: GameLang | TblLang): void {
    const tbl = toTblLang(lang)
    this._lang = tbl
    setCurrentLang(tbl === 'ENG' ? 'en' : 'zh')
    setTooltipLocale(tbl === 'ENG' ? 'en' : 'zh')
    this.worldPanels.setLanguage(tbl)
    this.charSheet.lang = tbl
    this.skillTree.lang = tbl
    this.hotkeys.lang = tbl
    this.controlBar.lang = tbl
    this.globes.lang = tbl
    const isRealMercName = (s: unknown): s is string =>
      typeof s === 'string' && s.length > 0 && !s.startsWith('Mercenary #') && !s.startsWith('Merc #')
    const syncMercObjLang = (m: any) => {
      if (!m || typeof m !== 'object') return
      const rawClassId = Number(m.classId ?? m.hcIdx ?? 0)
      const normClassId = rawClassId === 560 ? 561 : rawClassId
      if (typeof m.nameId === 'number' && m.nameId >= 0 && (normClassId > 0 || m.nameId >= 1000)) {
        if (!isRealMercName(m.nameEn)) {
          const en = resolveHirelingName(normClassId, m.nameId, 'ENG')
          if (isRealMercName(en)) {
            m.nameEn = en
          }
        }
        if (!isRealMercName(m.nameZh)) {
          const zh = resolveHirelingName(normClassId, m.nameId, 'CHI')
          if (isRealMercName(zh)) {
            m.nameZh = zh
          }
        }
      }
      if (!isRealMercName(m.nameEn) && isRealMercName(m.name) && m.name !== m.nameZh) {
        m.nameEn = m.name
      }
      if (isRealMercName(m.nameEn) || isRealMercName(m.nameZh)) {
        m.name = this.resolveLocalizedMercLabel(m, tbl)
      }
    }
    syncMercObjLang(this.merc)
    if (this.worldPanels.merc !== this.merc) {
      syncMercObjLang(this.worldPanels.merc)
    }
  }

  /** Optional callback invoked when an Escape menu row is activated ('options' | 'saveAndExit' | 'returnToGame'). */
  onEscapeMenuAction?: ((action: EscapeMenuAction) => void) | undefined
  /** Optional 1.13c UI sound callback (Sounds.txt row index). */
  onPlayUiSound?: ((soundId: number) => void) | undefined

  private playCantUseSound(): void {
    playHudCantUseSound(this)
  }

  private playCantCarrySound(): void {
    playHudCantCarrySound(this)
  }

  /** D2Client.dll 0x6fb31e40: play item dropsound when placing/equipping an item in a container/slot. */
  private playItemDropUiSound(item: UiInventoryItem | null | undefined): void {
    playHudItemDropUiSound(this, item)
  }

  /** D2Client.dll 0x6fb31d70: play item usesound when using an item (potion drink / scroll / tome). */
  private playItemUseUiSound(itemOrCode: UiInventoryItem | string | null | undefined): void {
    playHudItemUseUiSound(this, itemOrCode)
  }

  private readonly hudCanvas: HTMLCanvasElement
  get canvas(): HTMLCanvasElement {
    return this.hudCanvas
  }

  private readonly callbacks: {
    onToggleAutomap: () => void
    onWaypointTeleport: (act: number, slug: string, levelId?: number) => void
    onToggleAutomapMode?: () => void
    onCycleAutomapFade?: () => void
    onToggleAutomapNames?: () => void
    onResetAutomapPan?: () => void
    onPanAutomap?: (dx: number, dy: number) => boolean
    onRenderAutomapOverlay?: (
      ctx: CanvasRenderingContext2D,
      font: D2FontRenderer,
      logicalWidth: number,
      logicalHeight: number,
    ) => AutomapHudFootprint | null | void
    onCastTownPortal?: (source?: 'tbk' | 'tsc', item?: UiInventoryItem) => boolean | void
    onDropItemToGround?: (item: UiInventoryItem, mousePos?: { x: number; y: number }) => void
    onDropGoldToGround?: (amount: number, mousePos?: { x: number; y: number }) => void
    onEscapeMenuAction?: (action: EscapeMenuAction) => void
    onPlayUiSound?: (soundId: number) => void
  }
  constructor(
    hudCanvas?: HTMLCanvasElement | null,
    callbacks?: {
      onToggleAutomap?: () => void
      onWaypointTeleport?: (act: number, slug: string, levelId?: number) => void
      onToggleAutomapMode?: () => void
      onCycleAutomapFade?: () => void
      onToggleAutomapNames?: () => void
      onResetAutomapPan?: () => void
      onPanAutomap?: (dx: number, dy: number) => boolean
      onRenderAutomapOverlay?: (
        ctx: CanvasRenderingContext2D,
        font: D2FontRenderer,
        logicalWidth: number,
        logicalHeight: number,
      ) => AutomapHudFootprint | null | void
      onCastTownPortal?: (source?: 'tbk' | 'tsc', item?: UiInventoryItem) => boolean | void
      onDropItemToGround?: (item: UiInventoryItem, mousePos?: { x: number; y: number }) => void
      onDropGoldToGround?: (amount: number, mousePos?: { x: number; y: number }) => void
      onEscapeMenuAction?: (action: EscapeMenuAction) => void
      onPlayUiSound?: (soundId: number) => void
    },
    cursorCanvas?: HTMLCanvasElement | null,
  ) {
    // #913: belt rows (`Belts.txt numboxes / 4`) always follow the item in the belt body location.
    this.belt.bindEquippedBeltSource(() => this.inventory.equipped.belt ?? null)
    this.cursorCanvas = cursorCanvas ?? null
    this.hudCanvas =
      hudCanvas ??
      ({
        width: 800,
        height: 600,
        clientWidth: 800,
        clientHeight: 600,
        style: { cursor: 'none', pointerEvents: 'none' },
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: this.viewportProfile.width,
          height: this.viewportProfile.height,
          right: this.viewportProfile.width,
          bottom: this.viewportProfile.height,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
        getContext: () => null,
        addEventListener: () => {},
      } as unknown as HTMLCanvasElement)
    this.callbacks = {
      onToggleAutomap: () => {},
      onWaypointTeleport: () => {},
      ...callbacks,
    }
    this.onEscapeMenuAction = callbacks?.onEscapeMenuAction
    this.onPlayUiSound = callbacks?.onPlayUiSound
    this.setLang(getGameLang())
    this.worldPanels.activePlayerInventory = this.inventory
    this.worldPanels.onDefaultClose = () => {
      const prev = this.leftPanel
      this.leftPanel = 'none'
      ;(this.worldPanels as any).activePanel = 'none'
      if (prev !== 'none') this.leaveLeftPanel(prev)
      this.syncPublishedState()
    }
    this.worldPanels.onDefaultWaypointTeleport = (act, slug, levelId) => {
      if (this._commandSink) {
        this._commandSink.teleportToLevel(levelId)
      } else {
        this.callbacks.onWaypointTeleport(act, slug, levelId)
      }
    }
    this.hotkeys.bindSharedIconCache(this.skillTree.getSkillIconsMap())
    this.hotkeys.tooltipResolver = (skillId: number) => this.skillTree.getTooltipViewModel(skillId)
    if (this.hudCanvas && this.hudCanvas.style) {
      this.hudCanvas.style.cursor = 'none'
    }
    this.bindEvents()
  }

  /** Server authority: only requests `AddStatPoint`; attributes/vitals change when the server answers. */
  allocateStat(attr: 'strength' | 'dexterity' | 'vitality' | 'energy' | BaseStatKey): boolean {
    const shortKey: BaseStatKey =
      attr === 'strength'
        ? 'str'
        : attr === 'dexterity'
        ? 'dex'
        : attr === 'vitality'
        ? 'vit'
        : attr === 'energy'
        ? 'ene'
        : attr
    if (this._commandSink) return this._commandSink.allocateStat(shortKey)
    return false
  }

  useBeltSlot(col: number, shiftToMerc = false): boolean {
    return this.drinkBeltSlot(col, shiftToMerc)
  }

  dropInventoryGold(amount: number, _mousePos?: { x: number; y: number }): number {
    // Server authority: request `0x50 DropGold`; gold stat and ground pile arrive from the server.
    this._commandSink?.dropGold(amount)
    return 0
  }

  get screenWidth(): number {
    return this.viewportProfile.width
  }

  get screenHeight(): number {
    return this.viewportProfile.height
  }

  /** Switch to the registered profile of exactly this logical size; throws for an unregistered size. */
  resize(width: number, height?: number): ViewportProfile {
    return this.setViewportProfile(getViewportProfileBySize(width, height))
  }

  setHudEnhancements(patch: Partial<HudEnhancementsConfig>): void {
    if (typeof patch.showBasePlusBonusStats === 'boolean') {
      this.charSheet.showBasePlusBonusStats = patch.showBasePlusBonusStats
    }
    if (typeof patch.showBasePlusBonusSkills === 'boolean') {
      this.skillTree.showBasePlusBonusSkills = patch.showBasePlusBonusSkills
      this.hotkeys.showBasePlusBonusSkills = patch.showBasePlusBonusSkills
    }
    if (typeof patch.showStatGainTooltips === 'boolean') {
      this.charSheet.showStatGainTooltips = patch.showStatGainTooltips
      if (!patch.showStatGainTooltips) {
        this.charSheet.hoveredStat = null
      }
    }
    if (typeof patch.showWeaponDamageFormula === 'boolean') {
      this.worldPanels.showWeaponDamageFormula = patch.showWeaponDamageFormula
      this.charSheet.showDamageFormulaTooltips = patch.showWeaponDamageFormula
      if (!patch.showWeaponDamageFormula) {
        this.charSheet.hoveredDamageHand = null
      }
    }
    if (typeof patch.showAdvancedStatsButton === 'boolean') {
      this.charSheet.showAdvancedStatsButton = patch.showAdvancedStatsButton
      if (!patch.showAdvancedStatsButton) {
        this.charSheet.advancedStatsOpen = false
      }
    }
    if (typeof patch.showRuneNumbers === 'boolean') {
      this.worldPanels.showRuneNumbers = patch.showRuneNumbers
    }
  }

  getHudEnhancements(): HudEnhancementsConfig {
    return {
      showBasePlusBonusStats: this.charSheet.showBasePlusBonusStats,
      showBasePlusBonusSkills: this.skillTree.showBasePlusBonusSkills,
      showStatGainTooltips: this.charSheet.showStatGainTooltips,
      showWeaponDamageFormula: this.worldPanels.showWeaponDamageFormula,
      showAdvancedStatsButton: this.charSheet.showAdvancedStatsButton,
      showRuneNumbers: this.worldPanels.showRuneNumbers,
    }
  }

  setGroundItemEnhancements(patch: Partial<GroundItemEnhancementsConfig>): void {
    const nextBeams =
      typeof patch.showUniqueSetBeams === 'boolean'
        ? patch.showUniqueSetBeams
        : this.groundItemEnhancements.showUniqueSetBeams
    const nextLabels =
      typeof patch.alwaysShowUniqueSetLabels === 'boolean'
        ? patch.alwaysShowUniqueSetLabels
        : this.groundItemEnhancements.alwaysShowUniqueSetLabels
    this.groundItemEnhancements = {
      showUniqueSetBeams: nextBeams,
      alwaysShowUniqueSetLabels: nextLabels,
    }
    if (!nextBeams) {
      this.groundItemBeams = []
    }
  }

  getGroundItemEnhancements(): GroundItemEnhancementsConfig {
    return {
      showUniqueSetBeams: this.groundItemEnhancements.showUniqueSetBeams,
      alwaysShowUniqueSetLabels: this.groundItemEnhancements.alwaysShowUniqueSetLabels,
    }
  }

  load(baseUrl = '/ui'): Promise<void> {
    return this.init(baseUrl)
  }

  private syncResolutionMode(): boolean {
    const is640 = this.viewportProfile.id === '640x480'
    this.controlBar.is640 = is640
    this.globes.is640 = is640
    this.belt.is640 = is640
    this.hotkeys.is640 = is640
    return is640
  }

  togglePartyPortraits(): boolean {
    this.showPartyPortraits = !this.showPartyPortraits
    this.syncPublishedState()
    return this.showPartyPortraits
  }

  toggleHelpOverlay(): boolean {
    this.helpOverlayOpen = !this.helpOverlayOpen
    this.syncPublishedState()
    return this.helpOverlayOpen
  }

  handleMouseMove(logicalX: number, logicalY: number): void {
    handleHudMouseMove(this, logicalX, logicalY)
  }

  handleClick(
    logicalX: number,
    logicalY: number,
    button = 0,
    modifiers?: { shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean },
  ): void {
    const clientPt = this.logicalToClient(logicalX, logicalY)
    const fakeEvent = {
      button,
      clientX: clientPt.x,
      clientY: clientPt.y,
      _logicalX: logicalX,
      _logicalY: logicalY,
      shiftKey: Boolean(modifiers?.shiftKey),
      ctrlKey: Boolean(modifiers?.ctrlKey),
      altKey: Boolean(modifiers?.altKey),
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as MouseEvent
    // Press only — the release arrives separately via the window `mouseup` listener
    // (`handleHudMouseUp`), which carries the real release coordinates so buttons
    // latched here fire only when released back inside their rect.
    this.handleHudMouseDown(fakeEvent)
  }

  async init(
    baseUrl = '/ui',
    options?: { readonly tradeHallOnly?: boolean | undefined },
  ): Promise<void> {
    if (options?.tradeHallOnly) {
      this.tradeHallMode = true
      this.rightPanel = 'inv'
      this.inventory.visible = true
    } else {
      this.hotkeys.preloadSkillIcons()
      this.skillTree.preloadAssets()
    }

    try {
      await this.font.load(`${baseUrl}/fonts`)
    } catch (err) {
      console.warn(`[HudManager] Failed to load font metrics from ${baseUrl}/fonts:`, err)
    }

    try {
      const mRes = await fetch(`${baseUrl}/manifest.json`)
      if (mRes.ok) {
        const manifest = (await mRes.json()) as any
        this.itemRects = manifest.itemRects
        if (manifest.portraitRects) {
          this.portraitRects = manifest.portraitRects
        }
        this.decodedDc6Count = manifest.decodedDc6Count
        this.dc6DecodeFailures = manifest.dc6DecodeFailures
      }
    } catch {
      // Keep default manifest metadata
    }

    try {
      const feRes = await fetch(`${baseUrl}/frontend/manifest.json`)
      if (feRes.ok) {
        const feManifest = (await feRes.json()) as {
          assets?: { mediumButtonBlank?: { width: number; height: number; frameCount: number } }
        }
        const mbb = feManifest?.assets?.mediumButtonBlank
        if (mbb) {
          this.worldPanels.mediumButtonBlankMeta = {
            frameW: mbb.width,
            frameH: mbb.height,
            frames: mbb.frameCount,
          }
        }
      }
    } catch {
      // Fallback to default 128x35 2-frame mediumbuttonblank dimensions
    }

    const tradeHallImageFiles: Record<string, string> = {
      borderLeft: `${baseUrl}/border-left.png`,
      borderRight: `${baseUrl}/border-right.png`,
      invSheet: `${baseUrl}/inv-sheet.png`,
      invTab0: `${baseUrl}/inv-tab-0.png`,
      invTab1: `${baseUrl}/inv-tab-1.png`,
      stashBg: `${baseUrl}/stash-bg.png`,
      cubeBg: `${baseUrl}/cube-bg.png`,
      tradeBg: `${baseUrl}/trade-bg.png`,
      tradeBtn: `${baseUrl}/tradebtn.png`,
      buySellBtn: `${baseUrl}/buysellbtn.png`,
      goldCoinBtn: `${baseUrl}/goldcoinbtn.png`,
      boxPieces: `${baseUrl}/boxpieces.png`,
      cursorHand: `${baseUrl}/cursor-hand.png`,
      cursorAtlas: `${baseUrl}/cursor.png`,
      itemsAtlas: `${baseUrl}/items-atlas.png`,
      gemSocket: `${baseUrl}/gemsocket.png`,
      btnMedium: `${baseUrl}/frontend/btn-medium.png`,
      mediumButtonBlank: `${baseUrl}/frontend/btn-medium.png`,
    }

    const imageFiles: Record<string, string> = options?.tradeHallOnly
      ? tradeHallImageFiles
      : {
      ctrlPnl: `${baseUrl}/ctrlpnl-800.png`,
      ctrlPnl640: `${baseUrl}/ctrlpnl-640.png`,
      globeLife: `${baseUrl}/globe-life.png`,
      globeMana: `${baseUrl}/globe-mana.png`,
      globePoison: `${baseUrl}/globe-poison.png`,
      overlapLeft: `${baseUrl}/overlap-left.png`,
      overlapRight: `${baseUrl}/overlap-right.png`,
      borderLeft: `${baseUrl}/border-left.png`,
      borderRight: `${baseUrl}/border-right.png`,
      charSheet: `${baseUrl}/char-sheet.png`,
      invSheet: `${baseUrl}/inv-sheet.png`,
      invTab0: `${baseUrl}/inv-tab-0.png`,
      invTab1: `${baseUrl}/inv-tab-1.png`,
      questBg: `${baseUrl}/quest-bg.png`,
      waypointBg: `${baseUrl}/waypoint-bg.png`,
      stashBg: `${baseUrl}/stash-bg.png`,
      cubeBg: `${baseUrl}/cube-bg.png`,
      vendorBg: `${baseUrl}/vendor-bg.png`,
      vendorTabs: `${baseUrl}/vendor-tabs.png`,
      popbelt: `${baseUrl}/popbelt.png`,
      miniPanel: `${baseUrl}/minipanel.png`,
      miniPanelSingle: `${baseUrl}/minipanel-s.png`,
      miniPanelBtns: `${baseUrl}/minipanel-btns.png`,
      deathHardcore: `${baseUrl}/death-hardcore.png`,
      deathInst: `${baseUrl}/death-inst.png`,
      runBtn: `${baseUrl}/runbutton.png`,
      menuBtn: `${baseUrl}/menubutton.png`,
      buySellBtn: `${baseUrl}/buysellbtn.png`,
      goldCoinBtn: `${baseUrl}/goldcoinbtn.png`,
      miniConvert: `${baseUrl}/miniconvert.png`,
      levelBtn: `${baseUrl}/level-btn.png`,
      levelSocket: `${baseUrl}/level-socket.png`,
      skillPoints: `${baseUrl}/skillpoints.png`,
      skillTabs: `${baseUrl}/skill-tree-tabs.png`,
      waypointTabs: `${baseUrl}/waypoint-tabs.png`,
      waypointIcons: `${baseUrl}/waypoint-icons.png`,
      questTabs: `${baseUrl}/quest-tabs.png`,
      questSockets: `${baseUrl}/questsockets.png`,
      questLast: `${baseUrl}/questlast.png`,
      genericSkills: `${baseUrl}/generic-skills.png`,
      cursorHand: `${baseUrl}/cursor-hand.png`,
      cursorAtlas: `${baseUrl}/cursor.png`,
      boxPieces: `${baseUrl}/boxpieces.png`,
      focus16: `${baseUrl}/focus16.png`,
      textSlid: `${baseUrl}/textslid.png`,
      escOptions: `${baseUrl}/esc-options.png`,
      escExit: `${baseUrl}/esc-exit.png`,
      escReturn: `${baseUrl}/esc-return.png`,
      pentSpin: `${baseUrl}/pentspin.png`,
      itemsAtlas: `${baseUrl}/items-atlas.png`,
      questsAtlas: `${baseUrl}/quests-atlas.png`,
      portraitsAtlas: `${baseUrl}/portraits-atlas.png`,
      scroinBg: `${baseUrl}/scroin.png`,
      scroinRunes: `${baseUrl}/scroin2.png`,
      scroinGlow: `${baseUrl}/scroin3.png`,
      horadricBg: `${baseUrl}/horadricback.png`,
      upgradeBg: `${baseUrl}/upgrade.png`,
      invps: `${baseUrl}/invps.png`,
      recipeScrollBg: `${baseUrl}/recipescroll.png`,
      mercBg: `${baseUrl}/merc-bg.png`,
      invArmor: `${baseUrl}/inv-armor.png`,
      invHelmGlove: `${baseUrl}/inv-helm-glove.png`,
      invWeapons: `${baseUrl}/inv-weapons.png`,
      tradeBg: `${baseUrl}/trade-bg.png`,
      tradeBtn: `${baseUrl}/tradebtn.png`,
      partyBg: `${baseUrl}/party-bg.png`,
      partyButtons: `${baseUrl}/partybuttons.png`,
      partyBoxes: `${baseUrl}/partyboxes.png`,
      partyBar: `${baseUrl}/partybar.png`,
      gemSocket: `${baseUrl}/gemsocket.png`,
      btnMedium: `${baseUrl}/frontend/btn-medium.png`,
      mediumButtonBlank: `${baseUrl}/frontend/btn-medium.png`,
      levelEntryTitles: `${baseUrl}/${LEVEL_ENTRY_TITLE_ATLAS.image}`,
    }

    const pool = SharedAssetPool.getGlobal()
    await Promise.all(
      Object.entries(imageFiles).map(async ([key, src]) => {
        const img = await pool.loadImage(src)
        if (img) {
          this.images.set(key, img)
        }
      }),
    )

    this.bindEvents()
    this.syncPublishedState()
    this.state.ready = true
  }

  openNpcMenuByName(name: string, screenX = 400, screenY = 220): boolean {
    const ok = this.worldPanels.openNpcMenuByName(name, screenX, screenY)
    if (ok) {
      this.syncPublishedState()
    }
    return ok
  }

  private requireSink(action: string): HudCommandSink {
    if (!this._commandSink) throw new Error(`HudManager.${action}: no server command sink attached`)
    return this._commandSink
  }

  /** Server opened a store (`ClientWorld.npcInteraction.window`): show the vendor panel with the inventory. */
  showVendorPanel(): void {
    if (!this.worldPanels.activeVendorDescriptor) {
      throw new Error('HudManager.showVendorPanel: no store set (WorldPanelsHud.setVendorShop)')
    }
    this.worldPanels.npcMenu = null
    this.leftPanel = 'vendor'
    this.charSheet.visible = false
    if (this.rightPanel !== 'inv') this.toggleRightPanel('inv')
    this.syncPublishedState()
  }

  /** Server opened the stash (S2C 0x77 action 0x10): show the stash panel with the inventory. */
  showStashPanel(): void {
    this.leftPanel = 'stash'
    ;(this.worldPanels as any).activePanel = 'stash'
    this.charSheet.visible = false
    if (this.rightPanel !== 'inv') this.toggleRightPanel('inv')
    this.syncPublishedState()
  }

  /** Server opened the Horadric Cube (S2C 0x77 action 0x15): show the cube panel with the inventory. */
  showCubePanel(): void {
    this.leftPanel = 'cube'
    ;(this.worldPanels as any).activePanel = 'cube'
    this.charSheet.visible = false
    if (this.rightPanel !== 'inv') this.toggleRightPanel('inv')
    this.syncPublishedState()
  }

  /** World state closed `kind` (already noted by `ClientWorld`): hide it without sending anything. */
  hideLeftPanelFromWorld(kind: 'vendor' | 'stash' | 'cube' | 'orifice'): void {
    if (this.leftPanel !== kind) return
    this.leftPanel = 'none'
    ;(this.worldPanels as any).activePanel = 'none'
    if (kind === 'vendor') {
      this.worldPanels.vendorTradeState = 'idle'
      this.worldPanels.releaseMomentaryVendorButton()
    }
    if (kind === 'orifice') {
      if (this.worldPanels.questRewardItem) {
        if (!this.inventory.cursorItem) {
          this.inventory.cursorItem = this.worldPanels.questRewardItem
        } else {
          this.inventory.autoPlaceInGrid(this.worldPanels.questRewardItem)
        }
        this.worldPanels.questRewardItem = null
      }
      this.worldPanels.hoveredQuestRewardItem = null
      ;(this.worldPanels as any).activeNpcId = null
    }
    if ((this.goldDialog?.mode === 3 || this.goldDialog?.mode === 4) && kind === 'stash') {
      this.goldDialog = null
    }
    if (this.rightPanel === 'inv' && !this.tradeHallMode) {
      this.rightPanel = 'none'
      this.inventory.visible = false
    }
    this.syncPublishedState()
  }

  /** Dismiss the NPC menu and speech dialog, ending the interaction (`0x30 NpcCancel`). */
  dismissNpcMenu(): void {
    const menu = this.worldPanels.npcMenu
    const speech = this.worldPanels.npcSpeech
    if (!menu && !speech) return
    const npcId =
      menu?.npcId ??
      (menu as any)?.npcUnitId ??
      (speech as any)?.npcUnitId ??
      (speech as any)?.npcId ??
      this.worldPanels.activeNpcId ??
      null
    this.worldPanels.closeNpcSpeech()
    this.worldPanels.npcMenu = null
    this.worldPanels.npcSpeech = null
    if (npcId !== null && npcId > 0) {
      this._commandSink?.closeNpc(npcId)
    }
    this.syncPublishedState()
  }

  /** Leaving the vendor / stash / cube panel tells the server (`0x30` / `0x4F 0x12` / `0x4F 0x17`); other panels are local. */
  leaveLeftPanel(prev?: LeftPanelType): void {
    const target = prev ?? (this.leftPanel !== 'none' ? this.leftPanel : (this.worldPanels.activePanel as any))
    // The panel is closing through another path (hotkey / ESC): a close `X` that is
    // still held down must not fire on the eventual mouse-up.
    this.worldPanels.cancelCloseButton()
    if (target === 'vendor') {
      const npcId = this.worldPanels.vendorNpcId
      this.worldPanels.clearVendorShop()
      if (npcId !== null) this.requireSink('closeVendor').closeNpc(npcId)
    } else if (target === 'stash') {
      if (this.goldDialog && this.goldDialog.mode !== 0) this.goldDialog = null
      this._commandSink?.closeStash()
    } else if (target === 'cube') {
      this._commandSink?.closeCube?.()
    } else if (target === 'waypoint') {
      this._commandSink?.closeWaypoint?.()
    } else if (
      target === 'hire' ||
      target === 'imbue' ||
      target === 'add_sockets' ||
      target === 'personalize' ||
      target === 'orifice'
    ) {
      if (
        target === 'imbue' ||
        target === 'add_sockets' ||
        target === 'personalize' ||
        target === 'orifice'
      ) {
        if (this.worldPanels.questRewardItem) {
          if (!this.inventory.cursorItem) {
            this.inventory.cursorItem = this.worldPanels.questRewardItem
          } else {
            this.inventory.autoPlaceInGrid(this.worldPanels.questRewardItem)
          }
          this.worldPanels.questRewardItem = null
        }
        this.worldPanels.hoveredQuestRewardItem = null
      }
      if (this._commandSink?.closeActiveNpcPanel) {
        this._commandSink.closeActiveNpcPanel()
      } else {
        ;(this.worldPanels as any).onCloseNpc?.()
      }
    } else if (target === 'trade' && (this.trade?.active || this.trade?.pendingModal)) {
      if (typeof (this.worldPanels as any).onTradeButtonClick === 'function') {
        ;(this.worldPanels as any).onTradeButtonClick(2, 0)
      } else if (this._commandSink?.clickButton) {
        this._commandSink.clickButton(2, 0)
      } else {
        ;(this.worldPanels as any).onTradeAction?.(2)
      }
    }
  }

  /** Source balance the gold dialog clamps to: stash gold for withdraw, inventory gold otherwise. */
  goldDialogBalance(mode: GoldDialogMode): number {
    return goldDialogBalance(this, mode)
  }

  /** Open the gold dialog pre-filled with the whole source balance. */
  openGoldDialog(mode: GoldDialogMode): void {
    openGoldDialog(this, mode)
  }

  /** Set the typed amount, clamped to `0 .. source balance`. */
  setGoldDialogAmount(amount: number): void {
    setGoldDialogAmount(this, amount)
  }

  /** Digit / Backspace editing; the first digit after opening replaces the pre-filled amount. */
  typeGoldDialogKey(key: string): void {
    typeGoldDialogKey(this, key)
  }

  /** "ok": send the request for the clamped amount (nothing for 0) and close the dialog. */
  confirmGoldDialog(): void {
    confirmGoldDialog(this)
  }

  cancelGoldDialog(): void {
    cancelGoldDialog(this)
  }

  /** Gold dialog box (centered stone box: title, amount, ok / cancel). */
  getGoldDialogLayout(): GoldDialogLayout {
    return getGoldDialogLayout(this)
  }

  private handleGoldDialogClick(x: number, y: number): void {
    handleGoldDialogClick(this, x, y)
  }

  private drawGoldDialog(ctx: CanvasRenderingContext2D): void {
    drawGoldDialog(this, ctx)
  }

  /**
   * Toggle a Left-Half Panel (`char`, `quest`, `waypoint`, `stash`, `cube`, `vendor`, `merc`, `hire`, `party`, `trade`, `imbue`, `add_sockets`, `personalize`, `orifice`, `barkscroll`, `recipescroll`).
   * Strictly follows D2Client.dll mutual exclusion on the Left Dock (`0..400`).
   */
  toggleLeftPanel(kind: Exclude<LeftPanelType, 'none'>): void {
    const prev = this.leftPanel
    if (prev === kind) {
      this.leftPanel = 'none'
      ;(this.worldPanels as any).activePanel = 'none'
      this.charSheet.visible = false
      this.worldPanels.vendorTradeState = 'idle'
      this.worldPanels.releaseMomentaryVendorButton()
      this.leaveLeftPanel(prev)
    } else {
      if (kind === 'vendor' && !this.worldPanels.activeVendorDescriptor) {
        throw new Error('Cannot open vendor panel without an active vendor session')
      }
      if (
        kind !== 'vendor' &&
        kind !== 'hire' &&
        kind !== 'imbue' &&
        kind !== 'add_sockets' &&
        kind !== 'personalize' &&
        kind !== 'orifice' &&
        ((this.worldPanels as any).npcMenu || (this.worldPanels as any).npcSpeech)
      ) {
        this.dismissNpcMenu()
      }
      this.leftPanel = kind
      ;(this.worldPanels as any).activePanel = kind === 'char' ? 'none' : kind
      if (prev !== 'none') this.leaveLeftPanel(prev)
      this.charSheet.visible = kind === 'char'
      if (kind === 'msg' && this.rightPanel !== 'none') {
        this.rightPanel = 'none'
        this.inventory.visible = false
        this.skillTree.visible = false
      }
      if (
        (kind === 'stash' ||
          kind === 'cube' ||
          kind === 'vendor' ||
          kind === 'trade' ||
          kind === 'imbue' ||
          kind === 'add_sockets' ||
          kind === 'personalize' ||
          kind === 'orifice') &&
        this.rightPanel === 'none'
      ) {
        this.toggleRightPanel('inv')
      }
    }
    this.syncPublishedState()
  }

  setLeftPanel(kind: LeftPanelType): void {
    if (kind === 'none') {
      const prev = this.leftPanel
      if (prev !== 'none') {
        this.leftPanel = 'none'
        ;(this.worldPanels as any).activePanel = 'none'
        this.charSheet.visible = false
        this.leaveLeftPanel(prev)
        this.syncPublishedState()
      }
      return
    }
    if (this.leftPanel !== kind) {
      this.toggleLeftPanel(kind)
    }
  }

  openLeftPanel(kind: Exclude<LeftPanelType, 'none'>): void {
    this.setLeftPanel(kind)
  }

  /**
   * Toggle a Right-Half Panel (`inv` or `skill`).
   * Strictly follows D2Client.dll mutual exclusion on the Right Dock (`400..800`).
   */
  toggleRightPanel(kind: 'inv' | 'skill'): void {
    if (this.rightPanel === kind) {
      this.rightPanel = 'none'
      this.inventory.visible = false
      this.skillTree.visible = false
    } else {
      if (this.leftPanel === 'msg') {
        this.leftPanel = 'none'
        ;(this.worldPanels as any).activePanel = 'none'
      }
      this.rightPanel = kind
      this.inventory.visible = kind === 'inv'
      this.skillTree.visible = kind === 'skill'
    }
    this.syncPublishedState()
  }

  get escapeMenuOpen(): boolean {
    return this.worldPanels.escapeMenuOpen
  }

  set escapeMenuOpen(val: boolean) {
    if (val && !this.worldPanels.escapeMenuOpen) {
      this.worldPanels.escapeMenuSelectedIndex = 2
      enterEscapeMenuScreen(this.worldPanels, 'main', 0)
    } else if (!val) {
      enterEscapeMenuScreen(this.worldPanels, 'main', 0)
      this.worldPanels.controlsDraftBindings = null
    }
    this.worldPanels.escapeMenuOpen = val
    this.syncPublishedState()
  }

  get escapeMenuScreen(): EscapeMenuScreen {
    return this.worldPanels.escapeMenuScreen
  }

  set escapeMenuScreen(screen: EscapeMenuScreen) {
    enterEscapeMenuScreen(this.worldPanels, screen, 0)
    this.syncPublishedState()
  }

  get escapeMenuSelectedIndex(): EscapeMenuRowIndex {
    return this.worldPanels.escapeMenuSelectedIndex
  }

  set escapeMenuSelectedIndex(idx: EscapeMenuRowIndex) {
    this.worldPanels.escapeMenuSelectedIndex = idx
    this.syncPublishedState()
  }

  /**
   * Bind external settings & fullscreen callbacks so the in-game Options menu
   * (Sound, Video, Configure Controls) stays synchronized with `ClientSettings` and `Toolbar`.
   */
  configureEscapeMenuSettings(callbacks: {
    getSettings?: () => Partial<EscapeMenuSettingsSnapshot>
    onUpdateSettings?: (patch: EscapeMenuSettingsPatch) => void
    onToggleFullscreen?: () => void
  }): void {
    this.worldPanels.getEscapeMenuSettings = callbacks.getSettings ?? null
    this.worldPanels.onUpdateEscapeMenuSettings = (patch) => {
      if (patch.viewport !== undefined) {
        this.setViewportProfile(patch.viewport)
      }
      callbacks.onUpdateSettings?.(patch)
      this.syncPublishedState()
    }
    this.worldPanels.onToggleEscapeMenuFullscreen = () => {
      callbacks.onToggleFullscreen?.()
      this.syncPublishedState()
    }
  }

  getActiveKeyBindings() {
    return resolveEscapeMenuSettings(this.worldPanels).keyBindings
  }

  /**
   * Toggle the authentic 1.13c In-Game Escape Menu (`D2Client.dll` `0x6fb15760` & `0x6fb15bc0`).
   * Opening the Escape menu closes any open panels and resets the default selection to row 2 (`Return to Game`).
   * When inside an Options submenu (`'options' | 'sound' | 'video' | 'controls'`), steps back one menu level.
   */
  toggleEscapeMenu(): boolean {
    if (this.worldPanels.escapeMenuOpen) {
      const stillOpen = navigateEscapeMenuBack(this.worldPanels)
      this.onPlayUiSound?.(2)
      this.syncPublishedState()
      return stillOpen
    }
    this.closeAllPanels()
    this.worldPanels.escapeMenuOpen = true
    this.worldPanels.escapeMenuSelectedIndex = 2
    enterEscapeMenuScreen(this.worldPanels, 'main', 0)
    this.syncPublishedState()
    return true
  }

  /**
   * Move Escape menu selection up (`delta = -1`) or down (`delta = 1`) with wrap-around (`0x6fb14ee0` / `0x6fb14f50`).
   */
  moveEscapeMenuSelection(delta: -1 | 1): EscapeMenuRowIndex {
    if (this.worldPanels.escapeMenuScreen !== 'main') {
      moveEscapeSubmenuSelection(this.worldPanels, delta)
      this.onPlayUiSound?.(1)
      this.syncPublishedState()
      return this.worldPanels.escapeMenuSelectedIndex
    }
    const next = ((this.worldPanels.escapeMenuSelectedIndex + delta + 3) % 3) as EscapeMenuRowIndex
    this.worldPanels.escapeMenuSelectedIndex = next
    this.onPlayUiSound?.(1)
    this.syncPublishedState()
    return next
  }

  /**
   * Activate the Escape menu item at `index` (defaults to current `escapeMenuSelectedIndex`).
   */
  activateEscapeMenuIndex(index: EscapeMenuRowIndex = this.worldPanels.escapeMenuSelectedIndex): EscapeMenuAction {
    this.worldPanels.escapeMenuSelectedIndex = index
    this.onPlayUiSound?.(2)
    const action = ESCAPE_MENU_ACTIONS[index]
    if (action === 'options') {
      enterEscapeMenuScreen(this.worldPanels, 'options', 0)
    } else if (action === 'returnToGame' || action === 'saveAndExit') {
      this.worldPanels.escapeMenuOpen = false
      enterEscapeMenuScreen(this.worldPanels, 'main', 0)
    }
    this.syncPublishedState()
    this.onEscapeMenuAction?.(action)
    return action
  }

  /**
   * Hit-test and activate an Escape menu item at logical coordinates `(logicalX, logicalY)`.
   */
  handleEscapeMenuClick(logicalX: number, logicalY: number): EscapeMenuAction | string | null {
    if (this.worldPanels.escapeMenuScreen !== 'main') {
      const subAction = handleEscapeSubmenuMouseDown(
        this.worldPanels,
        logicalX,
        logicalY,
        this.viewportProfile.width,
        this.viewportProfile.height,
      )
      if (subAction !== null) {
        this.onPlayUiSound?.(2)
        this.syncPublishedState()
      }
      return subAction
    }
    const hit = hitTestEscapeMenu(logicalX, logicalY, this.viewportProfile.width, this.viewportProfile.height)
    if (hit === null) return null
    return this.activateEscapeMenuIndex(hit)
  }

  handleWheel(deltaY: number): boolean {
    if (this.worldPanels.escapeMenuOpen && this.worldPanels.escapeMenuScreen === 'controls') {
      const handled = handleEscapeSubmenuWheel(this.worldPanels, deltaY)
      if (handled) this.syncPublishedState()
      return handled
    }
    if (
      this.worldPanels.npcMenu?.talking ||
      this.worldPanels.npcSpeech !== null
    ) {
      return this.worldPanels.handleNpcSpeechWheel(deltaY)
    }
    if (this.leftPanel === 'hire' || (this.worldPanels as any).activePanel === 'hire') {
      return this.worldPanels.handleHireWheel(deltaY)
    }
    if (
      this.leftPanel === 'msg' &&
      this.mouseX >= 5 &&
      this.mouseX <= this.viewportProfile.width - 15 &&
      this.mouseY >= 30 &&
      this.mouseY <= this.viewportProfile.height - 100
    ) {
      if (deltaY !== 0) {
        this.worldPanels.scrollMessageLog(deltaY < 0 ? 1 : -1)
      }
      return true
    }
    if (deltaY === 0) return false
    const step: -1 | 1 = deltaY < 0 ? -1 : 1
    if (this._commandSink?.cycleBoundSkills) {
      return this._commandSink.cycleBoundSkills(step)
    }
    const cycled = this.hotkeys.cycleBoundSkills(step)
    if (cycled) {
      this.syncPublishedState()
      return true
    }
    return false
  }

  closeAllPanels(): boolean {
    const anyOpen =
      this.leftPanel !== 'none' ||
      this.rightPanel !== 'none' ||
      this.belt.lockedOpen ||
      this.hotkeys.openPopup !== null ||
      this.worldPanels.npcMenu !== null ||
      this.worldPanels.npcSpeech !== null ||
      this.worldPanels.escapeMenuOpen ||
      this.goldDialog !== null ||
      this.inventory.isIdentifyMode() ||
      this.pendingIdentifyScrollId !== null
    const prevLeft = this.leftPanel
    this.goldDialog = null
    this.pendingIdentifyScrollId = null
    this.dismissNpcMenu()
    this.leftPanel = 'none'
    if (prevLeft !== 'none') this.leaveLeftPanel(prevLeft)
    this.rightPanel = 'none'
    this.charSheet.visible = false
    this.inventory.visible = false
    this.inventory.cancelIdentifyMode()
    this.skillTree.visible = false
    this.belt.lockedOpen = false
    this.hotkeys.openPopup = null
    this.worldPanels.npcMenu = null
    this.worldPanels.closeNpcSpeech()
    this.worldPanels.npcSpeech = null
    this.worldPanels.activePanel = 'none'
    if (this.worldPanels.questRewardItem) {
      if (!this.inventory.cursorItem) {
        this.inventory.cursorItem = this.worldPanels.questRewardItem
      } else {
        this.inventory.autoPlaceInGrid(this.worldPanels.questRewardItem)
      }
      this.worldPanels.questRewardItem = null
    }
    this.worldPanels.hoveredQuestRewardItem = null
    this.worldPanels.escapeMenuOpen = false
    enterEscapeMenuScreen(this.worldPanels, 'main', 0)
    this.worldPanels.controlsDraftBindings = null
    this.worldPanels.vendorTradeState = 'idle'
    this.worldPanels.releaseMomentaryVendorButton()
    this.syncPublishedState()
    return anyOpen
  }

  viewportProfile: ViewportProfile = VIEWPORT_800x600
  private cachedCanvasRect: DOMRect | null = null
  private cachedCanvasRectKey = ''
  private activeRenderDockingLayout: DockingLayout | null = null

  private invalidateCanvasRectCache(): void {
    this.cachedCanvasRect = null
    this.cachedCanvasRectKey = ''
  }

  private getCanvasRect(): DOMRect {
    return getHudCanvasRect(this)
  }

  getViewportProfile(): ViewportProfile {
    return this.viewportProfile
  }

  setViewportProfile(profileOrId: ViewportProfile | ViewportResolution): ViewportProfile {
    this.viewportProfile = getViewportProfile(profileOrId)
    this.worldPanels.viewportWidth = this.viewportProfile.width
    this.worldPanels.viewportHeight = this.viewportProfile.height
    this.invalidateCanvasRectCache()
    this.syncResolutionMode()
    this.syncPublishedState()
    return this.viewportProfile
  }

  getViewportAnchors(): ViewportAnchorMetrics {
    return computeViewportAnchors(this.viewportProfile)
  }

  /**
   * Convert client CSS pixel coordinates into the active Diablo II logical viewport (`ViewportProfile` size).
   */
  clientToLogical(clientX: number, clientY: number): { x: number; y: number } {
    return clientToLogical(clientX, clientY, this.getCanvasRect(), 1, this.viewportProfile)
  }

  /**
   * Convert Diablo II logical viewport coordinates into client CSS pixel coordinates.
   */
  logicalToClient(logicalX: number, logicalY: number): { x: number; y: number } {
    return logicalToClient(logicalX, logicalY, this.getCanvasRect(), 1, this.viewportProfile)
  }

  /**
   * Returns current widescreen panel docking layout metrics.
   */
  getDockingLayout(): DockingLayout {
    return getActiveHudDockingLayout(this)
  }

  /**
   * Whether `(logicalX, logicalY)` hits the top-left 48x48 Mercenary portrait
   * (`Hireables.cpp` `0x6fb0b880`: slot 0 at `[16..64, 16..64]` when no left panel is open).
   */
  isPointInMercPortrait(logicalX: number, logicalY: number): boolean {
    if (this.leftPanel !== 'none') return false
    if (!this.merc || this.merc.isDead) return false
    return logicalX >= 16 && logicalX <= 64 && logicalY >= 16 && logicalY <= 64
  }

  /**
   * Whether a logical `(x, y)` point hits an active HUD panel or control bar,
   * so scene clicks/walks underneath are suppressed.
   */
  isPointInterceptedByHud(logicalX: number, logicalY: number): boolean {
    return isPointInterceptedByHud(this, logicalX, logicalY)
  }

  drinkBeltSlot(col: number, shiftToMerc = false): boolean {
    return drinkHudBeltSlot(this, col, shiftToMerc)
  }

  drinkInventoryPotion(itemId: number, code: string): boolean {
    const sink = this._commandSink
    if (!sink) return false
    this.playItemUseUiSound(code)
    if (sink.onUseInventoryItem) sink.onUseInventoryItem(itemId)
    else sink.useItem(itemId)
    return true
  }

  private triggerResurrect(): void {
    triggerHudResurrect(this)
  }

  handleKeyDown(
    rawEvent: KeyboardEvent | { key: string; preventDefault?: () => void; target?: any } | string,
  ): void {
    handleHudKeyDown(this, rawEvent)
  }

  isInputFocused(): boolean {
    return this.inputFocused
  }

  setInputFocused(focused: boolean): void {
    this.inputFocused = focused
    if (!focused && this.showGroundLabels) {
      this.showGroundLabels = false
      this.syncPublishedState()
    }
  }

  private bindEvents(): void {
    bindHudWindowEvents(this)
  }

  /**
   * #954: remove every DOM listener registered by `bindEvents` so a retired
   * HudManager (and the session graph it anchors) can actually be collected.
   */
  dispose(): void {
    disposeHudWindowEvents(this)
  }

  handleHudMouseUp(logicalX: number, logicalY: number, button = 0): void {
    handleHudMouseUp(this, logicalX, logicalY, button)
  }

  private controlBarReleaseCallbacks(): {
    onToggleRun: () => void
    onMiniPanelAction: (action: MiniPanelAction) => void
  } {
    return createControlBarReleaseCallbacks(this)
  }

  handleHudMouseDown(
    eOrX: MouseEvent | number,
    logicalY?: number,
    _viewportW?: number,
    _viewportH?: number,
  ): void {
    handleHudMouseDown(this, eOrX, logicalY, _viewportW, _viewportH)
  }

  private handleVendorInventoryClick(x: number, y: number, isRightClick: boolean, isCtrlClick = false): boolean {
    return handleVendorInventoryClick(this, x, y, isRightClick, isCtrlClick)
  }

  private forwardInventoryPanelClick(
    x: number,
    y: number,
    isRightClick: boolean,
    isShiftClick = false,
  ): boolean {
    return forwardInventoryPanelClick(this, x, y, isRightClick, isShiftClick)
  }

  private forwardGridClick(
    buffer: number,
    col: number,
    row: number,
    hitItem: UiInventoryItem | null,
    isRightClick: boolean,
    isShiftClick = false,
  ): void {
    forwardGridClick(this, buffer, col, row, hitItem, isRightClick, isShiftClick)
  }

  private handleSkillAllocated(skillId: number): void {
    handleSkillAllocated(this, skillId)
  }

  private computeActiveSkillDmgString(skillId: number): string {
    return computeHudSkillDamageString(skillId, this)
  }

  upgradeVerdictFor(item: UiInventoryItem): UpgradeVerdict | null {
    if (!this.upgradeHints) return null
    const context = this.inventory.playerContext
    const build = this.resolveBuild?.()
    const key = `${Object.values(this.inventory.equipped).map((e) => (typeof e === 'object' && e ? e.id : '-')).join(',')}|${JSON.stringify(context)}|${build?.classIndex}:${[...(build?.skillPoints ?? [])].join(';')}`
    if (key !== this.upgradeMarkersKey) [this.upgradeVerdicts, this.upgradeMarkersKey] = [new Map(), key]
    if (!this.upgradeVerdicts.has(item)) {
      const unidentified = isUiItemUnidentified(item)
      const requirementsView = unidentified ? { ...item, identified: true, isGambleMystery: false, rawItem: undefined } : item
      this.upgradeVerdicts.set(item, upgradeVerdict(item, this.inventory.equipped, { canUse: canPlayerUseUiItem(requirementsView, context), unidentified, ...(build ? { build } : {}) }))
    }
    return this.upgradeVerdicts.get(item) ?? null
  }

  setItemInfo(config: ItemInfoConfig | null): void {
    this.itemInfo = config
    this.worldPanels.showItemLevel = Boolean(config?.itemLevel)
  }

  private groundUiItem(data: ItemData): UiInventoryItem {
    return this.groundUiItems.get(data) ?? this.groundUiItems.set(data, onlineItemDataToUiInventoryItem(data)).get(data)!
  }

  groundLabelBadges(unitId: number): readonly ItemBadge[] {
    const data = this.resolveGroundItem?.(unitId)
    const verdict = data ? this.upgradeVerdictFor(this.groundUiItem(data)) : null
    return [...(verdict ? [{ kind: 'upgrade', verdict } as const] : []), ...(data && this.itemInfo?.labelDetails ? groundItemBadges(data) : [])]
  }

  groundLabelBadgesWidth(unitId: number): number {
    return badgesWidth(this.groundLabelBadges(unitId), this.font)
  }

  hidesGroundItem(unitId: number): boolean {
    const filter = this.itemInfo?.lootFilter ?? 'off'
    const data = filter === 'off' ? undefined : this.resolveGroundItem?.(unitId)
    return data !== undefined && isLootHidden(data, this.groundUiItem(data).allowedSlots.length > 0, filter)
  }

  private buildControlBarState() {
    return {
      level: this.charSheet.attrs.level,
      xp: this.charSheet.attrs.xp,
      currentLevelXp: D2_EXPERIENCE_TABLE_99[this.charSheet.attrs.level] ?? 0,
      nextLevelXp: this.charSheet.attrs.nextLevelXp,
      stamina: this.stamina,
      maxStamina: this.maxStamina,
      isRunning: this.isRunning,
      unspentStatPoints: this.charSheet.attrs.statPoints,
      unspentSkillPoints: this.skillTree.unspentSkillPoints,
      isStaminaBlue: this.isStaminaBlue,
    }
  }

  /**
   * Synchronizes the `CursorController` `buysell.dc6` override mode from active HUD states
   * (`inventory.isIdentifyMode()` or `worldPanels.vendorTradeState`).
   */
  syncCursorMode(nowMs: number = this.cursor.lastNowMs): void {
    const tradeMode: BuySellCursorMode | null =
      this.inventory.isIdentifyMode() || this.pendingIdentifyScrollId !== null
        ? 'identify'
        : this.leftPanel === 'vendor' && this.worldPanels.vendorTradeState !== 'idle'
          ? this.worldPanels.vendorTradeState
          : null
    this.cursor.setTradeCursorMode(tradeMode, nowMs)
  }

  syncPlayerContext(): void {
    // Not ready until the server assigns the class; requirement checks keep their neutral context.
    if (this.currentClass === null) return
    const playerCtx = {
      level: this.charSheet.attrs.level,
      str: this.charSheet.attrs.str,
      dex: this.charSheet.attrs.dex,
      classCode: this.currentClass,
    }
    this.inventory.setPlayerContext(playerCtx)
    this.worldPanels.setPlayerContext(playerCtx)
  }

  syncPublishedState(): void {
    syncHudPublishedState(this)
  }

  private ensureCanvas2DContext(rawCtx: CanvasRenderingContext2D): CanvasRenderingContext2D {
    return ensureCanvas2DContext(rawCtx)
  }

  /**
   * Tick stamina drain/recovery and draw the complete Diablo II HUD for the active `ViewportProfile`.
   */
  render(
    nowMs: number = performance.now(),
    playerMoving: boolean = false,
  ): void {
    renderHudFrame(this, nowMs, playerMoving)
  }

  /**
   * Returns true when any top-left portrait (mercenary, summon, or allied party member) is visible.
   */
  hasVisibleTopLeftPortraits(): boolean {
    return hasVisibleTopLeftPortraits(this)
  }

  /**
   * NOT 1.13c: Renders Diablo III-style vertical loot beams and 2:1 isometric base rings
   * for Unique and Set ground items when claimed by a plugin (Issue #957).
   */
  renderGroundItemBeams(ctx: CanvasRenderingContext2D, nowMs: number): void {
    renderGroundItemBeams(this, ctx, nowMs)
  }

  /**
   * D2Client.dll `0x6fb2ca40` (`MSG_DrawOverheadSpeech`) & `0x6fb2af20` (`MSG_ResolveOverheadOverlap`):
   * Renders speech bubbles above units with `overheadText`.
   */
  renderOverheadSpeechBubbles(ctx: CanvasRenderingContext2D, nowMs: number): void {
    renderOverheadSpeechBubbles(this, ctx, nowMs)
  }

  /**
   * D2Client.dll `0x6fb2b730` (`MSG_DrawChatOverlay`):
   * Renders the top-left active chat & event message stream.
   */
  renderChatOverlay(ctx: CanvasRenderingContext2D, screenWidth: number, nowMs: number): void {
    renderChatOverlay(this, ctx, screenWidth, nowMs)
  }

  /**
   * D2Client.dll `0x6fb20140` (`CHAT_DrawChatInputBox`) & `0x6fb1ef20` (`CHAT_DrawCursor`):
   * Renders the bottom in-game chat input box (`127 .. screenWidth - 128`, `screenHeight - 103 .. screenHeight - 56`)
   * with `font16` white word-wrapped text and blinking `_` cursor (`0x0D4C`).
   */
  renderChatInputBox(
    ctx: CanvasRenderingContext2D,
    screenWidth: number,
    screenHeight: number,
    nowMs: number,
  ): void {
    renderChatInputBox(this, ctx, screenWidth, screenHeight, nowMs)
  }

  private lastCursorLayerSignature: string | null = null

  private renderCursorLayer(nowMs: number): void {
    renderCursorLayer(this, nowMs)
  }

  /**
   * #940 R3: shows/clears the dedicated cursor layer.
   */
  setCursorLayerActive(active: boolean): void {
    setCursorLayerActive(this, active)
  }

  /**
   * Renders the authentic animated hand cursor, `buysell.dc6` trade/repair/identify cursor, or held cursorItem at cursor hotspot.
   */
  renderCursor(ctx: CanvasRenderingContext2D, nowMs: number = performance.now()): void {
    renderCursor(this, ctx, nowMs)
  }
}
