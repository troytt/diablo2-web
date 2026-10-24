/**
 * Diablo II v1.13c World & Extended UI Panels:
 * 1. Quest Log Panel (`Menu\questbackground.dc6`, hotkey `Q`)
 * 2. Waypoint Teleport Panel (`Menu\waygatebackground.dc6`, hotkey `V` or clicking scene Waypoint)
 * 3. Private Stash (`Panel\TradeStash.dc6`, 6x8 grid) & Horadric Cube (`Panel\supertransmogrifier.dc6`, 3x4 grid)
 * 4. Town NPC Stone Interaction Menu (`npcmenu.cpp`) & Vendor Panel (`Panel\buysell.dc6`, `Panel\buyselltabs.dc6`, `Panel\buysellbtn.dc6`)
 * 5. Monster Target Top Plaque (`text.cpp`), Item Hover Tooltip (`showitems.cpp`),
 *    Ground `Alt` Item Labels, Area Entry Gothic Banner (`Font30`), and Escape Menu (`menupanel.dc6`).
 */


import type { UpgradeVerdict } from '../../common/items/item-comparison.ts'
import { D2FontRenderer, type D2ColorCode } from './font.ts'
import { GRID_ITEM_BG_BLUE, GRID_ITEM_BG_GREEN, GRID_ITEM_BG_RED, canPlayerUseUiItem, drawImageWithEtherealAlpha, drawItemSocketOverlay, isUiItemEthereal, nextPlayerContextSeq, resolveGridItemBackgroundFill, resolveItemSpriteRect, type GridPlacement, type InventoryPanel, type PlayerItemRequirementContext, type UiInventoryItem } from './inventory.ts'
import type { Item } from '../../common/items/items.ts'
import { getTblLang, lookupTbl, type TblLang } from '../i18n/lang.ts'
import { STASH_GOLD_CAP, getInventoryGoldLimit, getStashGoldLimit } from '../../common/items/inventory-model.ts'
import { BAKED_UI_MANIFEST } from '../../common/items/baked-ui-meta.ts'
import { type TownNpcServiceDescriptor, getLocalizedNpcName } from '../../common/units/npc-table.ts'
import type { VendorTabId } from '../../common/items/vendor-generator.ts'
import { DRLG_GetActNoFromLevelId } from '../../common/drlg/drlg-drlg.ts'
import { type WorldPanelType, VENDOR_STATUS_DURATION_MS, ACT_TAB_LAYOUT, computeNpcMenuAnchor, type VendorButtonKind, type VendorTradeState, VENDOR_BUTTON_SPECS, resolveVendorButtonLayout, isEligibleArtisanItem } from './panels/panel-layout-constants.ts'
import { type QuestEntry, type QuestTblLookup, type WaypointEntry, questFlagWordIndex, ACT_QUESTS, ACT_WAYPOINTS, getActWaypoints, applyServerQuestFlagsImpl, applyServerQuestStateImpl, lookupQuestStringImpl, resolveCanonicalQuestStateTextImpl, resolveRawQuestStatePrefixImpl, getQuestSpeechKeyImpl, getQuestDisplayTextImpl, isWaypointUnlockedImpl, setUnlockedWaypointsImpl } from './panels/quest-waypoint-data.ts'
import { type NpcMenuActionId, type NpcMenuOption, type NpcMenuContext, buildNpcTalkSubmenuOptions, buildNpcMenuOptions, type NpcMenuState, type NpcSpeechState, setLanguageImpl, openNpcSpeechImpl, openStandaloneSpeechImpl, closeNpcSpeechImpl, handleNpcSpeechWheelImpl, handleNpcSpeechKeyDownImpl, openNpcMenuImpl, openNpcMenuByNameImpl, clickNpcMenuOptionImpl, getNpcMenuLayoutImpl, isPointInNpcMenuImpl, handleNpcMenuMoveImpl, handleNpcMenuClickImpl, drawNpcMenuImpl } from './panels/npc-dialog-menu.ts'
import { hitTestCubeButtonImpl, selectVendorTabImpl, hitTestVendorButtonSlotImpl, getVendorButtonFrameImpl, setVendorShopImpl, clearVendorShopImpl, getStashOverlapsImpl, canPlaceInStashImpl, autoPlaceInStashImpl, clickStashCellImpl, quickTransferToStashImpl, quickTransferFromStashImpl, getCubeOverlapsImpl, canPlaceInCubeImpl, canFitInCubeImpl, autoPlaceInCubeImpl, clickCubeCellImpl, transmuteCubeImpl, quickTransferToCubeImpl, quickTransferFromCubeImpl } from './panels/stash-cube-vendor-state.ts'
import { handleMouseMoveImpl, handleLeftDockClickImpl, drawLeftDockPanelImpl, drawActTabsImpl, drawWrappedTextImpl, drawUseItemPanelImpl, renderActiveLeftPanelImpl } from './panels/left-dock-renderer.ts'
import { isPointInHireMercDialogImpl, handleHireMercMoveImpl, handleHireWheelImpl, handleHireMercClickImpl, assertHireDialogFontImpl, drawHireMercDialogImpl, drawHireScrollbarImpl, drawHireConfirmDialogImpl, drawMercenaryPanelImpl } from './panels/hireling-panel.ts'
import { type HoveredPartyControl, resolvePartyActionCode, getPendingTradeModalLayoutImpl, handlePendingTradeModalClickImpl, handleActiveLeftPanelClickImpl, isMemberInLocalPartyImpl, isMemberInAnyPartyImpl, isLocalPlayerInPartyImpl, getOrderedPartyRosterImpl, hitTestPartyControlImpl, resolvePartyHoverTooltipLinesImpl, handlePartyPanelClickImpl, drawPartyPanelImpl, drawPendingTradeModalImpl, drawTradePanelImpl } from './panels/party-trade-panel.ts'
import { type EscapeMenuRowIndex, type MonsterTargetHudInfo, drawMonsterTargetBarImpl, drawItemTooltipImpl, drawEscapeMenuImpl } from './panels/escape-monster-tooltip.ts'
import {
  type ControlsButtonId,
  type EscapeMenuScreen,
  type EscapeMenuSettingsPatch,
  type EscapeMenuSettingsSnapshot,
} from './panels/escape-options-menu.ts'
import {
  createDefaultKeyBindings,
  DEFAULT_AUDIO_MUTED,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_VIEWPORT_RESOLUTION,
  type KeyBindingsConfig,
  type ViewportResolution,
} from '../settings/client-settings.ts'

export {
  STASH_GOLD_CAP,
  getInventoryGoldLimit,
  getStashGoldLimit,
  GRID_ITEM_BG_BLUE,
  GRID_ITEM_BG_GREEN,
  GRID_ITEM_BG_RED,
  canPlayerUseUiItem,
  resolveGridItemBackgroundFill,
  type PlayerItemRequirementContext,
}


export * from './panels/panel-layout-constants.ts'
export * from './panels/quest-waypoint-data.ts'
export * from './panels/npc-dialog-menu.ts'
export * from './panels/stash-cube-vendor-state.ts'
export * from './panels/left-dock-renderer.ts'
export * from './panels/hireling-panel.ts'
export * from './panels/party-trade-panel.ts'
export * from './panels/escape-monster-tooltip.ts'
export * from './panels/escape-options-menu.ts'

export class WorldPanelsHud {
  lang: TblLang = getTblLang()
  language: 'zh' | 'en' = getTblLang() === 'ENG' ? 'en' : 'zh'
  viewportWidth = 800
  viewportHeight = 600
  defaultFont = new D2FontRenderer()
  font: D2FontRenderer | null = null
  setFont(font: D2FontRenderer | null): void {
    this.font = font
  }
  npcScreenPositions = new Map<number, { x: number; y: number }>()
  resolveNpcScreenPosition: ((npcId: number) => { x: number; y: number } | null) | null = null
  _activePanel: WorldPanelType = 'none'
  isDead = false
  merc: any = null
  hireList: readonly any[] = []
  mercHireList: readonly any[] = []
  hireScrollOffset = 0
  hireSelectedIndex = -1
  hireHoveredIndex: number | null = null
  replaceMercConfirmOpen = false
  pendingHireCandidate: any = null
  hireConfirmHoveredOption: 0 | 1 | null = null
  playerGold = 0
  hasDeadMercenary = false
  deadMercenaryReviveCost = 0
  partyMembers: any[] = []
  messageLogEntries: readonly {
    readonly kind?: string | undefined
    readonly speaker?: string | undefined
    readonly text: string
    readonly color?: number | undefined
    readonly createdAtMs?: number | undefined
  }[] = []
  messageLogScrollOffset = 0
  messageLogCloseHovered = false
  localPlayerId = 1
  localPlayerName = ''
  localPlayerClass: number | string = 1
  localPlayerLevel = 1
  localPartyId = 0xffff
  hoveredPartyControl: HoveredPartyControl | null = null
  pressedPartyButton: { kind: 'leave' | 'partyBtn'; rowIndex?: number } | null = null
  trade: any = null
  questRewardItem: UiInventoryItem | null = null
  activeNpcId: number | null = null
  hoveredMonster: MonsterTargetHudInfo | null = null

  onQuestMessage: ((npcId: number, messageId: number) => void) | null = null
  onPlayNpcMessage: ((classId: number, npcId: number) => void) | null = null
  onNpcEntityAction: ((action: number, npcId: number, complement?: number) => void) | null = null
  onHireMerc: ((npcId: number, mercId: number) => void) | null = null
  onResurrectMerc: ((npcId: number) => void) | null = null
  onMercItem: ((slot: number) => void) | null = null
  onPartyAction: ((action: number, targetPlayerId: number) => void) | null = null
  onHostile: ((targetPlayerId: number, hostile: boolean, button?: number) => void) | null = null
  onSetHostile: ((targetPlayerId: number, hostile: boolean, button?: number) => void) | null = null
  onSquelchToggle: ((targetPlayerId: number, squelched: boolean) => void) | null = null
  onIgnoreToggle: ((targetPlayerId: number, ignored: boolean) => void) | null = null
  onClearMessages: (() => void) | null = null
  onClickButton: ((buttonId: number, complement?: number) => void) | null = null
  onConfirmQuestReward: ((itemId: number, npcId?: number) => void) | null = null
  onMercEquipSlotClick: ((slot: number) => void) | null = null
  onHireMercClick: ((npcId: number, mercId: number) => void) | null = null
  onPartyActionClick: ((action: number, targetPlayerId: number) => void) | null = null
  onHostileToggleClick: ((targetPlayerId: number, hostile: boolean, button?: number) => void) | null = null
  onTradeButtonClick: ((buttonId: number, complement?: number) => void) | null = null
  onTradeGridClick:
    | ((col: number, row: number, hitItem?: UiInventoryItem | null, isRightClick?: boolean) => void)
    | null = null
  onConfirmQuestRewardClick: ((itemId: number, npcId?: number) => void) | null = null
  onIneligibleArtisanItem: (() => void) | null = null
  onCloseActivePanel: (() => void) | null = null
  onNpcMenuAction: ((actionId: NpcMenuActionId, npcId: number, descriptor: TownNpcServiceDescriptor) => void) | null = null
  onNpcCancel: ((npcId: number) => void) | null = null
  onIdentifyAll: ((npcId: number, descriptor?: TownNpcServiceDescriptor) => void) | null = null
  onCloseNpcPanel: (() => void) | null = null
  onCloseNpcSpeech: (() => void) | null = null
  onPlayNpcSpeech: ((soundId: number) => void) | null = null

  scrollMessageLog(deltaLines: number): void {
    this.messageLogScrollOffset = Math.max(0, this.messageLogScrollOffset + deltaLines)
  }

  _npcMenu: NpcMenuState | null = null
  _hireOriginNpc: { descriptor: TownNpcServiceDescriptor; x: number; y: number; npcId: number } | null = null
  _npcSpeech: NpcSpeechState | null = null
  _speechOpenedDuringAction = false
  _npcGossipCursor = new Map<number, number>()

  get activePanel(): WorldPanelType {
    return this._activePanel
  }

  set activePanel(val: WorldPanelType) {
    this._activePanel = val
  }

  get npcMenu(): NpcMenuState | null {
    return this._npcMenu
  }

  set npcMenu(val: NpcMenuState | null) {
    if (val) {
      const unitId = val.npcUnitId ?? val.npcId ?? 0
      if (unitId > 0) this.activeNpcId = unitId
      if (val.npcUnitId === undefined) {
        this._npcMenu = { ...val, npcUnitId: unitId }
      } else {
        this._npcMenu = val
      }
    } else {
      this._npcMenu = null
    }
  }

  get npcSpeech(): NpcSpeechState | null {
    return this._npcSpeech
  }

  set npcSpeech(val: NpcSpeechState | null) {
    this._npcSpeech = val
  }

  selectedActTab = 1
  selectedQuestIdx = -1
  /**
   * NOT 1.13c: controlled by `plugins/hud-enhancements` (`showWeaponDamageFormula`).
   * Defaults to `false` (vanilla 1.13c item tooltip with no extra base white damage / formula lines).
   */
  showWeaponDamageFormula = false
  /**
   * NOT 1.13c: controlled by `plugins/hud-enhancements` (`showRuneNumbers`).
   * Defaults to `false` (vanilla 1.13c rune tooltip title without `(#1..#33)` suffix).
   */
  showRuneNumbers = false
  onDefaultClose: (() => void) | null = null
  onDefaultWaypointTeleport: ((act: number, slug: string, levelId: number) => void) | null = null
  onReplayQuestSpeech: ((speechKey: string) => void) | null = null
  onQuestActTabSelected: ((act0: number) => number) | null = null
  hoveredQuestButton: 'speech' | 'close' | null = null
  pressedQuestButton: 'speech' | 'close' | null = null

  /**
   * Pending 1.13c close-button release. Mouse-down over any panel close `X` only
   * latches this (plus the depressed `buysellbtn.dc6` cell 11 via `pressedCloseKind`);
   * the close fires on mouse-up landing back inside the same button, releasing
   * elsewhere cancels it — same semantics as `LevelPlusButton` (commit c90742e1).
   */
  pendingCloseRelease: {
    /** Coordinate space the latch predicate expects: left-dock local or raw viewport logical. */
    space: 'dock' | 'viewport'
    /** Release-point test, mirroring the exact press hit-test of the latched button. */
    contains: (x: number, y: number) => boolean
    /** Close action captured at press time (fires only on an inside release). */
    fire: () => void
  } | null = null
  /** Which panel's close `X` is currently held down (drives `buysellbtn.dc6` frame 11 drawing). */
  pressedCloseKind: string | null = null

  /** Whether a panel close `X` is currently latched awaiting its mouse-up. */
  hasPendingCloseRelease(): boolean {
    return this.pendingCloseRelease !== null
  }

  /**
   * Latches a close button at mouse-down: consumes the press (returns `true`), shows
   * the depressed cell, and defers the close to `releaseCloseButton`.
   */
  latchCloseButton(
    kind: string,
    space: 'dock' | 'viewport',
    contains: (x: number, y: number) => boolean,
    fire: () => void,
  ): boolean {
    this.pendingCloseRelease = { space, contains, fire }
    this.pressedCloseKind = kind
    return true
  }

  /**
   * Mouse-up: pops the close-button latch. Returns `true` (and runs the captured close
   * action) only when the release lands back inside the latched button; an outside
   * release cancels it (button pops back up, nothing fires).
   */
  releaseCloseButton(dockX: number, dockY: number, viewportX: number, viewportY: number): boolean {
    const latch = this.pendingCloseRelease
    this.pendingCloseRelease = null
    this.pressedCloseKind = null
    this.pressedUseItemButton = null
    if (!latch) return false
    const x = latch.space === 'dock' ? dockX : viewportX
    const y = latch.space === 'dock' ? dockY : viewportY
    if (!latch.contains(x, y)) return false
    latch.fire()
    return true
  }

  /**
   * Drops any latched close button without firing it — used when the panel closes
   * through another path (hotkey / ESC) while its `X` is still held down.
   */
  cancelCloseButton(): void {
    this.pendingCloseRelease = null
    this.pressedCloseKind = null
    this.pressedUseItemButton = null
    this.pendingWaypointRelease = null
    this.pressedWaypointIdx = null
  }

  /**
   * Mouse-up over the waypoint panel: pops the waypoint-row latch. Returns `true` (and
   * runs the captured teleport) only when the release lands back on the pressed row;
   * releasing elsewhere cancels it (icon pops back up, nothing fires).
   */
  releaseWaypointButton(dockX: number, dockY: number): boolean {
    const latch = this.pendingWaypointRelease
    this.pendingWaypointRelease = null
    this.pressedWaypointIdx = null
    if (!latch) return false
    if (!latch.contains(dockX, dockY)) return false
    latch.fire()
    return true
  }

  /**
   * How many act tabs (1..N) the Quest Log and Waypoint panels may show (issue #933).
   *
   * 1.13c hides the `Act II..V` tabs until the player has reached those acts in the
   * current difficulty. The server has no dedicated "act reached" packet — `0x28/0x29`
   * only carry the flat 48-word quest bitfield — so visibility derives from what the
   * client already mirrors:
   * - the act the player currently stands in (`currentLevelId`, always visible), or
   * - any unlocked waypoint in the act (evidence the act was previously entered), or
   * - any non-zero quest-flag word in the act (a quest was started there).
   */
  visibleActTabCount(): number {
    let count = 1
    if (this.currentLevelId !== null && this.currentLevelId > 0) {
      count = Math.max(count, DRLG_GetActNoFromLevelId(this.currentLevelId) + 1)
    }
    for (const [actKey, list] of Object.entries(ACT_WAYPOINTS)) {
      const act = Number(actKey)
      if (act <= count) continue
      if (list.some(wp => this.isWaypointUnlocked(wp.waypointId))) count = act
    }
    for (const [actKey, quests] of Object.entries(ACT_QUESTS)) {
      const act = Number(actKey)
      if (act <= count) continue
      if (quests.some(q => (this.serverQuestFlags[questFlagWordIndex(q)] ?? 0) !== 0)) count = act
    }
    return Math.min(ACT_TAB_LAYOUT.count, count)
  }

  get selectedWaypointAct(): number {
    return this.selectedActTab
  }

  set selectedWaypointAct(act: number) {
    this.selectedActTab = act
  }

  get selectedQuestAct(): number {
    return this.selectedActTab
  }

  set selectedQuestAct(act: number) {
    this.selectedActTab = act
  }
  /** Server stat 15 (`goldbank`), written by `HudModel` only; 0 until received (absent stat = 0). */
  stashGold = 0
  getStashMaxGold(level?: number): number {
    const resolvedLevel =
      level ??
      (this.localPlayerLevel > 1
        ? this.localPlayerLevel
        : (this.activePlayerInventory?.playerLevel ??
          this.activePlayerInventory?.playerContext?.level ??
          this.vendorCharLevel ??
          this.localPlayerLevel ??
          1))
    return getStashGoldLimit(resolvedLevel)
  }
  stashDepositAllEnabled = false
  showItemLevel = false
  showMonsterResists = false
  upgradeVerdictFor: (item: UiInventoryItem) => UpgradeVerdict | null = () => null
  cubeTransmuteCount = 0
  escapeMenuOpen = false
  escapeMenuSelectedIndex: EscapeMenuRowIndex = 2
  escapeMenuScreen: EscapeMenuScreen = 'main'
  optionsSubmenuSelectedIndex = 0
  soundDraggingSlider = false
  controlsScrollOffset = 0
  controlsSelectedRow = 0
  controlsSelectedCol: 'primary' | 'secondary' = 'primary'
  controlsAwaitingBinding = false
  controlsDraftBindings: KeyBindingsConfig | null = null
  controlsPressedButtonId: ControlsButtonId | null = null
  mediumButtonBlankMeta?: { frameW: number; frameH: number; frames: number } | undefined
  escapeMenuFallbackSettings: {
    masterVolume: number
    audioMuted: boolean
    viewport: ViewportResolution
    worldRenderFps: 30 | 60
    keyBindings: KeyBindingsConfig
    fullscreenActive: boolean
    fullscreenSupported: boolean
  } = {
    masterVolume: DEFAULT_MASTER_VOLUME,
    audioMuted: DEFAULT_AUDIO_MUTED,
    viewport: DEFAULT_VIEWPORT_RESOLUTION,
    worldRenderFps: 60,
    keyBindings: createDefaultKeyBindings(),
    fullscreenActive: false,
    fullscreenSupported: true,
  }
  getEscapeMenuSettings: (() => Partial<EscapeMenuSettingsSnapshot>) | null = null
  onUpdateEscapeMenuSettings: ((patch: EscapeMenuSettingsPatch) => void) | null = null
  onToggleEscapeMenuFullscreen: (() => void) | null = null
  lastTooltipRect: { bx: number; by: number; boxW: number; boxH: number } | null = null

  activeVendorDescriptor: TownNpcServiceDescriptor | null = null
  vendorMode: 'trade' | 'gamble' = 'trade'
  activeVendorTab: VendorTabId = 'armor'
  /** Server unit id of the NPC whose store is open (`ClientWorld.npcInteraction.npcId`); `null` when closed. */
  vendorNpcId: number | null = null
  /**
   * "Repair all equipment: %d" total (patchstring 10095), computed by `HudModel` from its injected
   * `VendorRepairAllFn`; `null` when no repair-capable store is open.
   */
  vendorRepairAllCost: number | null = null

  get repairAllCost(): number {
    return this.vendorRepairAllCost ?? 0
  }

  set repairAllCost(value: number | null) {
    this.vendorRepairAllCost = value
  }
  /** Synced from the server character level by `HudManager.syncPlayerContext()`. */
  vendorCharLevel = 1
  vendorPlayerStats: PlayerItemRequirementContext = {
    level: 1,
    str: 0,
    dex: 0,
  }
  vendorTradeState: VendorTradeState = 'idle'
  hoveredVendorButtonSlot: 0 | 1 | 2 | 3 | null = null
  pressedMomentarySlot: 0 | 1 | 2 | 3 | null = null
  hoveredCubeButton: 'transmute' | 'close' | null = null
  pressedCubeButton: 'transmute' | 'close' | null = null
  activePlayerInventory: InventoryPanel | null = null
  vendorStatusMsg: { text: string; color: D2ColorCode; untilMs: number } | null = null
  hoveredVendorItem: { item: UiInventoryItem; x: number; y: number; col: number; row: number } | null = null
  vendorTabPlacements: Record<VendorTabId, GridPlacement[]> = {
    armor: [],
    weapons1: [],
    weapons2: [],
    misc: [],
  }
  gamblePlacements: GridPlacement[] = []
  playerContextSeq = 0

  setPlayerContext(ctx: Partial<PlayerItemRequirementContext>): void {
    const nextLevel = ctx.level !== undefined ? Math.max(1, ctx.level) : Math.max(1, this.vendorCharLevel)
    this.vendorCharLevel = nextLevel
    this.vendorPlayerStats = {
      level: nextLevel,
      str: ctx.str !== undefined ? Math.max(0, ctx.str) : this.vendorPlayerStats.str,
      dex: ctx.dex !== undefined ? Math.max(0, ctx.dex) : this.vendorPlayerStats.dex,
      classCode: ctx.classCode ?? this.vendorPlayerStats.classCode,
    }
    const seq = nextPlayerContextSeq()
    this.playerContextSeq = seq
    if (this.activePlayerInventory) {
      this.activePlayerInventory.playerContext = { ...this.vendorPlayerStats }
      this.activePlayerInventory.playerContextSeq = seq
    }
  }

  getEffectivePlayerContext(): PlayerItemRequirementContext {
    if (
      this.activePlayerInventory &&
      this.activePlayerInventory.playerContextSeq > this.playerContextSeq
    ) {
      return {
        ...this.activePlayerInventory.playerContext,
      }
    }
    return {
      ...this.vendorPlayerStats,
      level: Math.max(1, this.vendorCharLevel),
    }
  }

  canPlayerUseVendorItem(item: UiInventoryItem): boolean {
    return canPlayerUseUiItem(item, this.getEffectivePlayerContext(), this.vendorMode)
  }

  get repairCursorMode(): boolean {
    return this.vendorTradeState === 'repair'
  }

  set repairCursorMode(val: boolean) {
    this.vendorTradeState = val ? 'repair' : 'idle'
  }

  releaseMomentaryVendorButton(): void {
    this.pressedMomentarySlot = null
    this.pressedCubeButton = null
  }

  /**
   * D2Client.dll `0x6fb3b600` (Transmute button) & `0x6fb3b650` (Cube Close button):
   * - Transmute: `relX ∈ [144, 184]`, `relY ∈ [257, 297]` (`x ∈ [224, 264]`, `y ∈ [317, 357]`)
   * - Close: `relX ∈ [275, 315]`, `relY ∈ [380, 420]` (`x ∈ [355, 395]`, `y ∈ [440, 480]`)
   */
  hitTestCubeButton(...args: Parameters<typeof hitTestCubeButtonImpl>): ReturnType<typeof hitTestCubeButtonImpl> {
    return (hitTestCubeButtonImpl as any).apply(this, args)
  }

  isVendorTabPresent(tabId: VendorTabId): boolean {
    if (this.vendorMode === 'gamble') {
      return false
    }
    return this.vendorTabPlacements[tabId].length > 0
  }

  /**
   * D2Client.dll `0x6fb3f710` (`0x6fb3f7a1–0x6fb3f873`):
   * If requested tab is empty, cycle forward `(idx + 1) % 4` up to 4 tries to find a non-empty tab.
   */
  selectVendorTab(...args: Parameters<typeof selectVendorTabImpl>): ReturnType<typeof selectVendorTabImpl> {
    return (selectVendorTabImpl as any).apply(this, args)
  }

  /**
   * D2Client.dll `0x6fb4c27a` (mousedown) & `0x6fb3f260` (hover):
   * Open intervals `relX ∈ (tableX, tableX + 45)`, `relY ∈ (371, 415)`, enabled slots only.
   */
  hitTestVendorButtonSlot(...args: Parameters<typeof hitTestVendorButtonSlotImpl>): ReturnType<typeof hitTestVendorButtonSlotImpl> {
    return (hitTestVendorButtonSlotImpl as any).apply(this, args)
  }

  getActiveVendorButtonLayout(): readonly [VendorButtonKind, VendorButtonKind, VendorButtonKind, VendorButtonKind] {
    if (!this.activeVendorDescriptor) {
      throw new Error('Cannot resolve vendor button layout without active vendor descriptor')
    }
    return resolveVendorButtonLayout(this.activeVendorDescriptor.hcIdx, this.vendorMode)
  }

  getVendorButtonFrame(...args: Parameters<typeof getVendorButtonFrameImpl>): ReturnType<typeof getVendorButtonFrameImpl> {
    return (getVendorButtonFrameImpl as any).apply(this, args)
  }

  /**
   * Returns the active `buysell.dc6` cursor frame index per D2Client.dll `0x6fb475e1` / `0x6fbbb238` (+0x10),
   * or `null` when `vendorTradeState === 'idle'`.
   */
  getActiveVendorCursorFrame(): number | null {
    if (this.vendorTradeState === 'idle') return null
    return VENDOR_BUTTON_SPECS[this.vendorTradeState].cursorFrame
  }

  showVendorStatus(text: string, color: D2ColorCode = 'gold', nowMs = performance.now()): void {
    this.vendorStatusMsg = { text, color, untilMs: nowMs + VENDOR_STATUS_DURATION_MS }
  }

  setNpcScreenPosition(npcId: number, x: number, y: number): void {
    this.npcScreenPositions.set(npcId, { x, y })
  }

  openNpcMenuAtUnitScreen(
    descriptor: TownNpcServiceDescriptor,
    npcScreenX: number,
    npcScreenY: number,
    npcId: number | null = null,
    context?: NpcMenuContext,
  ): void {
    const anchor = computeNpcMenuAnchor(npcScreenX, npcScreenY)
    this.openNpcMenu(descriptor, anchor.x, anchor.y, npcId, context)
  }

  /**
   * D2Client.dll `0x6fba3ba0` (`gNpcMenuTable`) + `0x6faf8c50` (`NPCMENU_Open`):
   * Uses official 1.13c `.tbl` string IDs:
   * - `3381` (`talk`): `交談` (`talk`)
   * - `4020` (`identify`): `辨視物品` (`Identify Items`)
   * - `3334` (`trade` with `canRepair`): `交易/修理` (`trade/repair`)
   * - `3396` (`trade` without `canRepair`): `交易` (`trade`)
   * - `3398` (`gamble`): `賭博` (`gamble`)
   * - `4142` (`cancel`): `取消` (`cancel`)
   */
  buildNpcMenuOptions(descriptor: TownNpcServiceDescriptor, context?: NpcMenuContext): readonly NpcMenuOption[] {
    return buildNpcMenuOptions(descriptor, context)
  }

  buildNpcTalkSubmenuOptions(
    descriptor: TownNpcServiceDescriptor,
    context?: NpcMenuContext,
  ): readonly NpcMenuOption[] {
    return buildNpcTalkSubmenuOptions(descriptor, context)
  }

  setLanguage(...args: Parameters<typeof setLanguageImpl>): ReturnType<typeof setLanguageImpl> {
    return (setLanguageImpl as any).apply(this, args)
  }

  openNpcSpeech(...args: Parameters<typeof openNpcSpeechImpl>): ReturnType<typeof openNpcSpeechImpl> {
    return (openNpcSpeechImpl as any).apply(this, args)
  }

  openStandaloneSpeech(...args: Parameters<typeof openStandaloneSpeechImpl>): ReturnType<typeof openStandaloneSpeechImpl> {
    return (openStandaloneSpeechImpl as any).apply(this, args)
  }

  barkscrollDeciphered = false
  cairnStoneOrder: readonly [number, number, number, number, number] | null = null
  barkscrollAnimFrame = 0
  barkscrollLastTickMs: number | null = null

  /**
   * D2Client.dll `0x6fb2cf10` (`BARKSCROLL_OpenUndeciphered`) & `0x6fb2cf50` (`BARKSCROLL_OpenDeciphered`):
   * Opens the Scroll of Inifuss left-dock panel (`scroin.dc6`).
   */
  openBarkscroll(deciphered: boolean, stoneOrder?: readonly number[] | null): void {
    this.barkscrollDeciphered = deciphered
    if (stoneOrder && stoneOrder.length >= 5) {
      this.cairnStoneOrder = [
        stoneOrder[0]! | 0,
        stoneOrder[1]! | 0,
        stoneOrder[2]! | 0,
        stoneOrder[3]! | 0,
        stoneOrder[4]! | 0,
      ]
    } else if (!this.cairnStoneOrder) {
      this.cairnStoneOrder = [0, 1, 2, 3, 4]
    }
    this.barkscrollAnimFrame = 0
    this.barkscrollLastTickMs = null
    this._activePanel = 'barkscroll'
  }

  recipeScrollText: string | null = null

  /**
   * D2Client.dll `0x6fb3e8e0` (`UI_OpenRecipeScroll`) & `0x6fb3e770` (`UI_DrawRecipeScroll`):
   * Opens the Horadric Scroll (`tr1`) recipe panel (`recipescroll.dc6`, `320x432`) displaying `a2q2scroll` (3396).
   */
  openRecipeScroll(text?: string): void {
    const raw =
      text && text.trim().length > 0
        ? text.trim()
        : this.lookupQuestString('a2q2scroll', this.lang) ??
          this.resolveCanonicalQuestStateText('A2Q2EarlyReturnScrollCain', this.lang)
    const resolved = raw.replace(/^\d+\r?\n/, '').trim()
    this.recipeScrollText = resolved.length > 0 ? resolved : null
    this._activePanel = 'recipescroll'
  }

  closeNpcSpeech(...args: Parameters<typeof closeNpcSpeechImpl>): ReturnType<typeof closeNpcSpeechImpl> {
    return (closeNpcSpeechImpl as any).apply(this, args)
  }

  handleNpcSpeechWheel(...args: Parameters<typeof handleNpcSpeechWheelImpl>): ReturnType<typeof handleNpcSpeechWheelImpl> {
    return (handleNpcSpeechWheelImpl as any).apply(this, args)
  }

  handleNpcSpeechKeyDown(...args: Parameters<typeof handleNpcSpeechKeyDownImpl>): ReturnType<typeof handleNpcSpeechKeyDownImpl> {
    return (handleNpcSpeechKeyDownImpl as any).apply(this, args)
  }

  openNpcMenu(...args: Parameters<typeof openNpcMenuImpl>): ReturnType<typeof openNpcMenuImpl> {
    return (openNpcMenuImpl as any).apply(this, args)
  }

  openNpcMenuByName(...args: Parameters<typeof openNpcMenuByNameImpl>): ReturnType<typeof openNpcMenuByNameImpl> {
    return (openNpcMenuByNameImpl as any).apply(this, args)
  }

  clickNpcMenuOption(...args: Parameters<typeof clickNpcMenuOptionImpl>): ReturnType<typeof clickNpcMenuOptionImpl> {
    return (clickNpcMenuOptionImpl as any).apply(this, args)
  }

  confirmQuestReward(arg0?: number | 'imbue' | 'add_sockets' | 'personalize' | 'orifice', arg1?: number): boolean {
    const itemId = typeof arg0 === 'number' ? arg0 : arg1
    const qItem = this.questRewardItem as { id?: string | number; itemId?: number } | null
    const resolvedId =
      itemId ??
      (qItem ? Number(qItem.id ?? qItem.itemId ?? 0) : 0)
    if (!resolvedId || resolvedId <= 0 || Number.isNaN(resolvedId)) return false

    const panel =
      typeof arg0 === 'string'
        ? arg0
        : (this._activePanel === 'imbue' ||
          this._activePanel === 'add_sockets' ||
          this._activePanel === 'personalize' ||
          this._activePanel === 'orifice'
            ? this._activePanel
            : null)
    if (panel && qItem && !isEligibleArtisanItem(panel, qItem as any)) {
      return false
    }

    const npcId = this._npcMenu?.npcUnitId ?? this._npcMenu?.npcId ?? this.activeNpcId ?? this.vendorNpcId ?? 0
    if (this.onConfirmQuestReward) {
      this.onConfirmQuestReward(resolvedId, npcId)
    } else {
      this.onNpcEntityAction?.(0, npcId, resolvedId)
    }
    this.questRewardItem = null
    this.hoveredQuestRewardItem = null
    if (
      this._activePanel === 'imbue' ||
      this._activePanel === 'add_sockets' ||
      this._activePanel === 'personalize' ||
      this._activePanel === 'orifice'
    ) {
      this._activePanel = 'none'
    }
    return true
  }

  drawItemSprite(
    ctx: CanvasRenderingContext2D,
    item: UiInventoryItem,
    x: number,
    y: number,
    w: number,
    h: number,
    atlas?: HTMLImageElement | null,
    isHovered?: boolean,
  ): void {
    const rect = resolveItemSpriteRect(item, BAKED_UI_MANIFEST.itemRects)
    const atlasImg = atlas !== undefined ? atlas : this.getItemsAtlasImage()
    if (rect && atlasImg) {
      const scale = Math.min(w / rect.w, h / rect.h, 1)
      const dw = Math.round(rect.w * scale)
      const dh = Math.round(rect.h * scale)
      const dx = x + Math.round((w - dw) / 2)
      const dy = y + Math.round((h - dh) / 2)
      drawImageWithEtherealAlpha(ctx, isUiItemEthereal(item), () => {
        ctx.drawImage(atlasImg, rect.x, rect.y, rect.w, rect.h, dx, dy, dw, dh)
      })
      drawItemSocketOverlay(
        ctx,
        item,
        x,
        y,
        w,
        h,
        {
          itemsAtlasImg: atlasImg,
          itemRects: BAKED_UI_MANIFEST.itemRects,
        },
        { isHovered },
      )
    } else {
      const itemName = String(item.name ?? item.code ?? 'Item')
      ctx.fillStyle = '#e8c26b'
      if (typeof ctx.fillText === 'function') {
        ctx.fillText(itemName, x + 8, y + Math.floor(h / 2))
      }
    }
  }

  /**
   * Show the store the server filled with `0x9C AddToShop` items (`ClientWorld.containers.shop`).
   * `pages`: one entry per shop item with its bitstream `storePage` (1..4 -> tab index 0..3, D2Client
   * 0x6fb91178 tab table). Re-applying the same store keeps the selected tab unless it became empty
   * (D2Client 0x6fb3f710 advances to the next non-empty tab).
   */
  setVendorShop(...args: Parameters<typeof setVendorShopImpl>): ReturnType<typeof setVendorShopImpl> {
    return (setVendorShopImpl as any).apply(this, args)
  }

  /** Forget the store (NpcCancel sent: D2Client frees the store units, the server sends no RemoveFromShop). */
  clearVendorShop(...args: Parameters<typeof clearVendorShopImpl>): ReturnType<typeof clearVendorShopImpl> {
    return (clearVendorShopImpl as any).apply(this, args)
  }

  /** Repair-all total set by `HudModel`; throws when the store has a Repair All button but no cost was provided. */
  requireRepairAllCost(): number {
    if (this.vendorRepairAllCost === null) {
      throw new Error('WorldPanelsHud: Repair All cost not provided (HudModel needs a VendorRepairAllFn)')
    }
    return this.vendorRepairAllCost
  }

  getActiveVendorPlacements(): GridPlacement[] {
    if (this.vendorMode === 'gamble') {
      return this.gamblePlacements
    }
    return this.vendorTabPlacements[this.activeVendorTab] ?? []
  }

  /** Runtime quest status overrides: questId -> 'completed' | 'active' | 'locked' */
  questStatuses = new Map<string, 'completed' | 'active' | 'locked'>()
  cachedQuestsAtlasImg: HTMLImageElement | null = null
  cachedBoxPiecesImg: HTMLImageElement | null = null
  cachedMiniConvertImg: HTMLImageElement | null = null
  cachedWaypointIconsImg: HTMLImageElement | null = null
  cachedItemsAtlasImg: HTMLImageElement | null = null
  cachedQuestTabsImg: HTMLImageElement | null = null
  cachedQuestSocketsImg: HTMLImageElement | null = null
  cachedQuestLastImg: HTMLImageElement | null = null
  cachedWaypointTabsImg: HTMLImageElement | null = null

  getQuestStatus(quest: QuestEntry): 'completed' | 'active' | 'locked' {
    return this.questStatuses.get(quest.id) ?? quest.status
  }

  setQuestStatus(questId: string, status: 'completed' | 'active' | 'locked'): void {
    this.questStatuses.set(questId, status)
  }

  /**
   * D2Client.dll `0x6fba81a6` (`[0x6fba81a4 + 2]`): Tal Rasha True Tomb symbol offset (`0..6`),
   * populated by `S2C 0x50` (`QuestMessage` messageType `0x16`).
   */
  tombOffset: number | null = null

  hasServerQuestState = false
  serverQuestFlags: number[] = []
  serverGameQuestFlags: number[] = []
  serverQuestStatusBytes: number[] = []
  denMonstersRemaining = 0
  questBarbsRemaining = 0

  /**
   * Replace every quest status from the server quest-flag words (`ClientWorld.quests`):
   * bit 0 set = completed, any other bit set = active (started), 0 = locked (not started).
   */
  applyServerQuestFlags(...args: Parameters<typeof applyServerQuestFlagsImpl>): ReturnType<typeof applyServerQuestFlagsImpl> {
    return (applyServerQuestFlagsImpl as any).apply(this, args)
  }

  /**
   * Apply full 1.13c server quest state (`0x28` player quest flags, `0x29` game quest flags,
   * `0x52` 41-byte quest history status bytes, and `0x50` / `0x5D` Den of Evil & Mount Arreat counters)
   * per `D2Client.dll` `0x6facce00..0x6facd6dc` and `0x6fba8188`.
   */
  applyServerQuestState(...args: Parameters<typeof applyServerQuestStateImpl>): ReturnType<typeof applyServerQuestStateImpl> {
    return (applyServerQuestStateImpl as any).apply(this, args)
  }

  questTblLookup?: QuestTblLookup | undefined
  questStringTableChain?: { get(key: string): string | undefined } | null | undefined

  setQuestTblLookup(lookup: QuestTblLookup | null | undefined): void {
    this.questTblLookup = lookup ?? undefined
  }

  setQuestStringTableChain(chain: { get(key: string): string | undefined } | null | undefined): void {
    this.questStringTableChain = chain ?? undefined
  }

  lookupQuestString(...args: Parameters<typeof lookupQuestStringImpl>): ReturnType<typeof lookupQuestStringImpl> {
    return (lookupQuestStringImpl as any).apply(this, args)
  }

  resolveCanonicalQuestStateText(...args: Parameters<typeof resolveCanonicalQuestStateTextImpl>): ReturnType<typeof resolveCanonicalQuestStateTextImpl> {
    return (resolveCanonicalQuestStateTextImpl as any).apply(this, args)
  }

  /**
   * Look up the raw (untrimmed) TBL string for `appendCount` (`0x6facd2b6..0x6facd39a`:
   * e.g. `qstsa1q14` -> `"Monsters remaining: "` / `"剩下的怪物： "`, `qstsa1q13` -> `""`).
   */
  resolveRawQuestStatePrefix(...args: Parameters<typeof resolveRawQuestStatePrefixImpl>): ReturnType<typeof resolveRawQuestStatePrefixImpl> {
    return (resolveRawQuestStatePrefixImpl as any).apply(this, args)
  }

  /**
   * Resolve the NPC speech string key (`wSpeechStr`, `[esi+0x25f]`) for the currently selected quest
   * per `D2Client.dll` `0x6facce00..0x6facd6dc` and `0x6fba8188`.
   */
  getQuestSpeechKey(...args: Parameters<typeof getQuestSpeechKeyImpl>): ReturnType<typeof getQuestSpeechKeyImpl> {
    return (getQuestSpeechKeyImpl as any).apply(this, args)
  }

  getQuestDisplayText(...args: Parameters<typeof getQuestDisplayTextImpl>): ReturnType<typeof getQuestDisplayTextImpl> {
    return (getQuestDisplayTextImpl as any).apply(this, args)
  }

  createOrLoadUiImage(manifestUrl: string | undefined, keyName: string): HTMLImageElement {
    if (!manifestUrl) {
      throw new Error(`Missing required BAKED_UI_MANIFEST.images.${keyName}`)
    }
    if (typeof Image !== 'undefined') {
      const img = new Image()
      img.src = manifestUrl
      return img
    }
    return {
      src: manifestUrl,
      complete: true,
      naturalWidth: 256,
      naturalHeight: 256,
      width: 256,
      height: 256,
    } as unknown as HTMLImageElement
  }

  assertValidUiImage(img: HTMLImageElement | null | undefined, label: string): HTMLImageElement {
    if (!img) {
      throw new Error(`Missing required UI image asset: ${label}`)
    }
    const maybeImg = img as { complete?: boolean; naturalWidth?: number; width?: number; src?: string }
    if (maybeImg.complete === false && !maybeImg.src) {
      throw new Error(`Unloaded UI image asset: ${label}`)
    }
    if (
      maybeImg.complete === true &&
      typeof maybeImg.naturalWidth === 'number' &&
      maybeImg.naturalWidth <= 0 &&
      !maybeImg.src
    ) {
      throw new Error(`Empty UI image asset: ${label}`)
    }
    return img
  }

  getQuestsAtlasImage(): HTMLImageElement {
    if (this.cachedQuestsAtlasImg) return this.cachedQuestsAtlasImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.questsAtlas, 'questsAtlas')
    this.cachedQuestsAtlasImg = img
    return img
  }

  getBoxPiecesImage(): HTMLImageElement {
    if (this.cachedBoxPiecesImg) return this.cachedBoxPiecesImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.boxPieces, 'boxPieces')
    this.cachedBoxPiecesImg = img
    return img
  }

  cachedTextSlidImg: HTMLImageElement | null = null
  getTextSlidImage(): HTMLImageElement {
    if (this.cachedTextSlidImg) return this.cachedTextSlidImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.textslid, 'textslid')
    this.cachedTextSlidImg = img
    return img
  }

  getMiniConvertImage(): HTMLImageElement {
    if (this.cachedMiniConvertImg) return this.cachedMiniConvertImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.miniConvert, 'miniConvert')
    this.cachedMiniConvertImg = img
    return img
  }

  getWaypointIconsImage(): HTMLImageElement {
    if (this.cachedWaypointIconsImg) return this.cachedWaypointIconsImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.waypointIcons, 'waypointIcons')
    this.cachedWaypointIconsImg = img
    return img
  }

  getItemsAtlasImage(): HTMLImageElement {
    if (this.cachedItemsAtlasImg) return this.cachedItemsAtlasImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.itemsAtlas, 'itemsAtlas')
    this.cachedItemsAtlasImg = img
    return img
  }

  getQuestTabsImage(): HTMLImageElement {
    if (this.cachedQuestTabsImg) return this.cachedQuestTabsImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.questTabs, 'questTabs')
    this.cachedQuestTabsImg = img
    return img
  }

  getQuestSocketsImage(): HTMLImageElement {
    if (this.cachedQuestSocketsImg) return this.cachedQuestSocketsImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.questSockets, 'questSockets')
    this.cachedQuestSocketsImg = img
    return img
  }

  getQuestLastImage(): HTMLImageElement {
    if (this.cachedQuestLastImg) return this.cachedQuestLastImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.questLast, 'questLast')
    this.cachedQuestLastImg = img
    return img
  }

  cachedScroinBgImg: HTMLImageElement | null = null
  cachedScroinRunesImg: HTMLImageElement | null = null
  cachedScroinGlowImg: HTMLImageElement | null = null

  getScroinBgImage(): HTMLImageElement {
    if (this.cachedScroinBgImg) return this.cachedScroinBgImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.scroinBg, 'scroinBg')
    this.cachedScroinBgImg = img
    return img
  }

  getScroinRunesImage(): HTMLImageElement {
    if (this.cachedScroinRunesImg) return this.cachedScroinRunesImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.scroinRunes, 'scroinRunes')
    this.cachedScroinRunesImg = img
    return img
  }

  getScroinGlowImage(): HTMLImageElement {
    if (this.cachedScroinGlowImg) return this.cachedScroinGlowImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.scroinGlow, 'scroinGlow')
    this.cachedScroinGlowImg = img
    return img
  }

  cachedHoradricBgImg: HTMLImageElement | null = null
  cachedInvpsImg: HTMLImageElement | null = null
  cachedRecipeScrollBgImg: HTMLImageElement | null = null

  getHoradricBgImage(): HTMLImageElement {
    if (this.cachedHoradricBgImg) return this.cachedHoradricBgImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.horadricBg, 'horadricBg')
    this.cachedHoradricBgImg = img
    return img
  }

  cachedUpgradeBgImg: HTMLImageElement | null = null

  getUpgradeBgImage(): HTMLImageElement {
    if (this.cachedUpgradeBgImg) return this.cachedUpgradeBgImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.upgradeBg, 'upgradeBg')
    this.cachedUpgradeBgImg = img
    return img
  }

  getInvpsImage(): HTMLImageElement {
    if (this.cachedInvpsImg) return this.cachedInvpsImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.invps, 'invps')
    this.cachedInvpsImg = img
    return img
  }

  getRecipeScrollBgImage(): HTMLImageElement {
    if (this.cachedRecipeScrollBgImg) return this.cachedRecipeScrollBgImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.recipeScrollBg, 'recipeScrollBg')
    this.cachedRecipeScrollBgImg = img
    return img
  }

  getWaypointTabsImage(): HTMLImageElement {
    if (this.cachedWaypointTabsImg) return this.cachedWaypointTabsImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.waypointTabs, 'waypointTabs')
    this.cachedWaypointTabsImg = img
    return img
  }

  cachedMercBgImg: HTMLImageElement | null = null
  cachedInvArmorImg: HTMLImageElement | null = null
  cachedInvHelmGloveImg: HTMLImageElement | null = null
  cachedInvWeaponsImg: HTMLImageElement | null = null
  cachedBuySellBtnImg: HTMLImageElement | null = null

  getMercBgImage(): HTMLImageElement {
    if (this.cachedMercBgImg) return this.cachedMercBgImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.mercBg, 'mercBg')
    this.cachedMercBgImg = img
    return img
  }

  getInvArmorImage(): HTMLImageElement {
    if (this.cachedInvArmorImg) return this.cachedInvArmorImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.invArmor, 'invArmor')
    this.cachedInvArmorImg = img
    return img
  }

  getInvHelmGloveImage(): HTMLImageElement {
    if (this.cachedInvHelmGloveImg) return this.cachedInvHelmGloveImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.invHelmGlove, 'invHelmGlove')
    this.cachedInvHelmGloveImg = img
    return img
  }

  getInvWeaponsImage(): HTMLImageElement {
    if (this.cachedInvWeaponsImg) return this.cachedInvWeaponsImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.invWeapons, 'invWeapons')
    this.cachedInvWeaponsImg = img
    return img
  }

  getBuySellBtnImage(): HTMLImageElement {
    if (this.cachedBuySellBtnImg) return this.cachedBuySellBtnImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.buySellBtn, 'buySellBtn')
    this.cachedBuySellBtnImg = img
    return img
  }

  cachedTradeBgImg: HTMLImageElement | null = null
  cachedGoldCoinBtnImg: HTMLImageElement | null = null

  getTradeBgImage(): HTMLImageElement {
    if (this.cachedTradeBgImg) return this.cachedTradeBgImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.tradeBg, 'tradeBg')
    this.cachedTradeBgImg = img
    return img
  }

  getGoldCoinBtnImage(): HTMLImageElement {
    if (this.cachedGoldCoinBtnImg) return this.cachedGoldCoinBtnImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.goldCoinBtn, 'goldCoinBtn')
    this.cachedGoldCoinBtnImg = img
    return img
  }

  cachedPartyBgImg: HTMLImageElement | null = null
  cachedPartyButtonsImg: HTMLImageElement | null = null
  cachedPartyBoxesImg: HTMLImageElement | null = null
  cachedPartyBarImg: HTMLImageElement | null = null

  getPartyBgImage(): HTMLImageElement {
    if (this.cachedPartyBgImg) return this.cachedPartyBgImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.partyBg, 'partyBg')
    this.cachedPartyBgImg = img
    return img
  }

  getPartyButtonsImage(): HTMLImageElement {
    if (this.cachedPartyButtonsImg) return this.cachedPartyButtonsImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.partyButtons, 'partyButtons')
    this.cachedPartyButtonsImg = img
    return img
  }

  getPartyBoxesImage(): HTMLImageElement {
    if (this.cachedPartyBoxesImg) return this.cachedPartyBoxesImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.partyBoxes, 'partyBoxes')
    this.cachedPartyBoxesImg = img
    return img
  }

  getPartyBarImage(): HTMLImageElement {
    if (this.cachedPartyBarImg) return this.cachedPartyBarImg
    const img = this.createOrLoadUiImage(BAKED_UI_MANIFEST.images.partyBar, 'partyBar')
    this.cachedPartyBarImg = img
    return img
  }

  stashItems: GridPlacement[] = []
  hoveredStashItem: { item: UiInventoryItem; x: number; y: number } | null = null
  cubeItems: GridPlacement[] = []
  hoveredCubeItem: { item: UiInventoryItem; x: number; y: number } | null = null
  hoveredMercItem: { item: UiInventoryItem; x: number; y: number } | null = null
  hoveredTradeItem: { item: UiInventoryItem; x: number; y: number } | null = null
  hoveredTradeButton: 'partnerAccept' | 'selfAccept' | 'cancel' | 'gold' | null = null
  pressedTradeButton: 'selfAccept' | 'cancel' | 'gold' | null = null
  hoveredStashButton: 'gold' | 'close' | null = null
  hoveredWaypointClose = false
  hoveredMercClose = false
  hoveredQuestRewardItem: { item: UiInventoryItem; x: number; y: number } | null = null
  hoveredWaypointIdx: number | null = null
  /**
   * Waypoint row currently held down (1.13c semantics, issue #933): mouse-down latches
   * the depressed icon cell (`waypoint-icons.png` frame 1 current / 4 non-current); the
   * teleport fires on mouse-up landing back on the same row (`releaseWaypointButton`).
   */
  pressedWaypointIdx: number | null = null
  pendingWaypointRelease: {
    contains: (x: number, y: number) => boolean
    fire: () => void
  } | null = null

  /**
   * The waypoint that opened this menu or where the player currently stands.
   * Ground Truth (D2Client.dll 1.13c):
   * - 0x6fbacdd0: Current level ID
   * - 0x6fbacdd4: Current waypoint ID
   */
  currentWaypointId: number | null = null
  currentLevelId: number | null = null

  /** Runtime waypoint unlocked overrides: waypointId -> boolean */
  waypointUnlockedOverrides = new Map<number, boolean>()

  isWaypointUnlocked(...args: Parameters<typeof isWaypointUnlockedImpl>): ReturnType<typeof isWaypointUnlockedImpl> {
    return (isWaypointUnlockedImpl as any).apply(this, args)
  }

  setWaypointUnlocked(waypointId: number, unlocked: boolean): void {
    this.waypointUnlockedOverrides.set(waypointId, unlocked)
  }

  setUnlockedWaypoints(...args: Parameters<typeof setUnlockedWaypointsImpl>): ReturnType<typeof setUnlockedWaypointsImpl> {
    return (setUnlockedWaypointsImpl as any).apply(this, args)
  }

  clearWaypointUnlockedOverrides(): void {
    this.waypointUnlockedOverrides.clear()
  }

  setCurrentWaypoint(waypointId: number | null, levelId?: number | null): void {
    this.currentWaypointId = waypointId
    if (levelId !== undefined) {
      this.currentLevelId = levelId
    }
  }

  setCurrentLevel(levelId: number | null): void {
    this.currentLevelId = levelId
  }

  isCurrentWaypoint(wp: WaypointEntry): boolean {
    if (this.currentWaypointId !== null && this.currentWaypointId !== undefined) {
      if (wp.waypointId === this.currentWaypointId) return true
    }
    if (this.currentLevelId !== null && this.currentLevelId !== undefined) {
      if (wp.levelId === this.currentLevelId) return true
    }
    return false
  }

  getWaypointsForAct(act = this.selectedActTab): Array<WaypointEntry & { unlocked: boolean }> {
    return getActWaypoints(act).map((wp) => ({
      ...wp,
      unlocked: this.isWaypointUnlocked(wp),
    }))
  }

  /**
   * Check whether an item of (w, h) can be placed at (col, row) in the 6x8 stash grid.
   * Throws RangeError if placed out of bounds. Returns all overlapping GridPlacements.
   */
  getStashOverlaps(...args: Parameters<typeof getStashOverlapsImpl>): ReturnType<typeof getStashOverlapsImpl> {
    return (getStashOverlapsImpl as any).apply(this, args)
  }

  canPlaceInStash(...args: Parameters<typeof canPlaceInStashImpl>): ReturnType<typeof canPlaceInStashImpl> {
    return (canPlaceInStashImpl as any).apply(this, args)
  }

  autoPlaceInStash(...args: Parameters<typeof autoPlaceInStashImpl>): ReturnType<typeof autoPlaceInStashImpl> {
    return (autoPlaceInStashImpl as any).apply(this, args)
  }

  clickStashCell(...args: Parameters<typeof clickStashCellImpl>): ReturnType<typeof clickStashCellImpl> {
    return (clickStashCellImpl as any).apply(this, args)
  }

  quickTransferToStash(...args: Parameters<typeof quickTransferToStashImpl>): ReturnType<typeof quickTransferToStashImpl> {
    return (quickTransferToStashImpl as any).apply(this, args)
  }

  quickTransferFromStash(...args: Parameters<typeof quickTransferFromStashImpl>): ReturnType<typeof quickTransferFromStashImpl> {
    return (quickTransferFromStashImpl as any).apply(this, args)
  }

  /**
   * Check whether an item of (w, h) can be placed at (col, row) in the 3x4 Horadric Cube grid.
   */
  getCubeOverlaps(...args: Parameters<typeof getCubeOverlapsImpl>): ReturnType<typeof getCubeOverlapsImpl> {
    return (getCubeOverlapsImpl as any).apply(this, args)
  }

  canPlaceInCube(...args: Parameters<typeof canPlaceInCubeImpl>): ReturnType<typeof canPlaceInCubeImpl> {
    return (canPlaceInCubeImpl as any).apply(this, args)
  }

  /**
   * Ground Truth (`D2Client.dll` `0x6fb470b3..0x6fb47154` & `D2Common.dll` `D2Inventory.cpp:961`):
   * Returns `true` when `item` is not the Horadric Cube (`box`) and at least one free `(col, row)`
   * cell in the `3x4` Cube grid can accommodate `(invWidth, invHeight)`.
   */
  canFitInCube(...args: Parameters<typeof canFitInCubeImpl>): ReturnType<typeof canFitInCubeImpl> {
    return (canFitInCubeImpl as any).apply(this, args)
  }

  autoPlaceInCube(...args: Parameters<typeof autoPlaceInCubeImpl>): ReturnType<typeof autoPlaceInCubeImpl> {
    return (autoPlaceInCubeImpl as any).apply(this, args)
  }

  clickCubeCell(...args: Parameters<typeof clickCubeCellImpl>): ReturnType<typeof clickCubeCellImpl> {
    return (clickCubeCellImpl as any).apply(this, args)
  }

  /**
   * Executes Horadric Cube transmutation recipes (`CubeMain.txt`) on `this.cubeItems`.
   */
  transmuteCube(...args: Parameters<typeof transmuteCubeImpl>): ReturnType<typeof transmuteCubeImpl> {
    return (transmuteCubeImpl as any).apply(this, args)
  }

  quickTransferToCube(...args: Parameters<typeof quickTransferToCubeImpl>): ReturnType<typeof quickTransferToCubeImpl> {
    return (quickTransferToCubeImpl as any).apply(this, args)
  }

  quickTransferFromCube(...args: Parameters<typeof quickTransferFromCubeImpl>): ReturnType<typeof quickTransferFromCubeImpl> {
    return (quickTransferFromCubeImpl as any).apply(this, args)
  }

  handleMouseMove(...args: Parameters<typeof handleMouseMoveImpl>): ReturnType<typeof handleMouseMoveImpl> {
    return (handleMouseMoveImpl as any).apply(this, args)
  }

  getNpcMenuLayout(...args: Parameters<typeof getNpcMenuLayoutImpl>): ReturnType<typeof getNpcMenuLayoutImpl> {
    return (getNpcMenuLayoutImpl as any).apply(this, args)
  }

  isPointInNpcMenu(...args: Parameters<typeof isPointInNpcMenuImpl>): ReturnType<typeof isPointInNpcMenuImpl> {
    return (isPointInNpcMenuImpl as any).apply(this, args)
  }

  handleNpcMenuMove(...args: Parameters<typeof handleNpcMenuMoveImpl>): ReturnType<typeof handleNpcMenuMoveImpl> {
    return (handleNpcMenuMoveImpl as any).apply(this, args)
  }

  handleNpcMenuClick(...args: Parameters<typeof handleNpcMenuClickImpl>): ReturnType<typeof handleNpcMenuClickImpl> {
    return (handleNpcMenuClickImpl as any).apply(this, args)
  }

  handleLeftDockClick(...args: Parameters<typeof handleLeftDockClickImpl>): ReturnType<typeof handleLeftDockClickImpl> {
    return (handleLeftDockClickImpl as any).apply(this, args)
  }

  drawLeftDockPanel(...args: Parameters<typeof drawLeftDockPanelImpl>): ReturnType<typeof drawLeftDockPanelImpl> {
    return (drawLeftDockPanelImpl as any).apply(this, args)
  }

  /**
   * Draw Town NPC Stone Interaction Menu (`dialog.cpp` `0x6fb53840` + `npcmenu.cpp` `0x6faf8c50` + `boxpieces.dc6` `0x6fb6e4c0`).
   */
  drawNpcMenu(...args: Parameters<typeof drawNpcMenuImpl>): ReturnType<typeof drawNpcMenuImpl> {
    return (drawNpcMenuImpl as any).apply(this, args)
  }

  /**
   * Test if a point falls within the 1.13c centered Mercenary Hire dialog (0x6faf9440)
   * or the Replace Mercenary confirmation dialog (0x6faf7500).
   */
  isPointInHireMercDialog(...args: Parameters<typeof isPointInHireMercDialogImpl>): ReturnType<typeof isPointInHireMercDialogImpl> {
    return (isPointInHireMercDialogImpl as any).apply(this, args)
  }

  /**
   * Handle mouse hover movement over the Mercenary Hire dialog and its scrollable candidate list.
   */
  handleHireMercMove(...args: Parameters<typeof handleHireMercMoveImpl>): ReturnType<typeof handleHireMercMoveImpl> {
    return (handleHireMercMoveImpl as any).apply(this, args)
  }

  /**
   * Handle mouse wheel scrolling in the Mercenary Hire dialog.
   */
  handleHireWheel(...args: Parameters<typeof handleHireWheelImpl>): ReturnType<typeof handleHireWheelImpl> {
    return (handleHireWheelImpl as any).apply(this, args)
  }

  /**
   * Handle mouse click within the Mercenary Hire dialog or confirmation dialog.
   */
  handleHireMercClick(...args: Parameters<typeof handleHireMercClickImpl>): ReturnType<typeof handleHireMercClickImpl> {
    return (handleHireMercClickImpl as any).apply(this, args)
  }

  assertHireDialogFont(...args: Parameters<typeof assertHireDialogFontImpl>): ReturnType<typeof assertHireDialogFontImpl> {
    return (assertHireDialogFontImpl as any).apply(this, args)
  }

  /**
   * Draw the authentic Diablo II v1.13c 490x350 Mercenary Hire Stone Dialog (0x6faf9440).
   */
  drawHireMercDialog(...args: Parameters<typeof drawHireMercDialogImpl>): ReturnType<typeof drawHireMercDialogImpl> {
    return (drawHireMercDialogImpl as any).apply(this, args)
  }

  drawHireScrollbar(...args: Parameters<typeof drawHireScrollbarImpl>): ReturnType<typeof drawHireScrollbarImpl> {
    return (drawHireScrollbarImpl as any).apply(this, args)
  }

  drawHireConfirmDialog(...args: Parameters<typeof drawHireConfirmDialogImpl>): ReturnType<typeof drawHireConfirmDialogImpl> {
    return (drawHireConfirmDialogImpl as any).apply(this, args)
  }

  drawActTabs(...args: Parameters<typeof drawActTabsImpl>): ReturnType<typeof drawActTabsImpl> {
    return (drawActTabsImpl as any).apply(this, args)
  }

  drawWrappedText(...args: Parameters<typeof drawWrappedTextImpl>): ReturnType<typeof drawWrappedTextImpl> {
    return (drawWrappedTextImpl as any).apply(this, args)
  }

  /**
   * Draw Top-Center Monster Target Health Bar & 2-Line Subtext Plaque
   * (`D2Client.dll` `0x6FB70850`, `0x6FACFDD0`, `0x6FB6FCA0`, `0x6FB719B0`, `0x6FB71A20`, `D2Win.dll` `Ordinal_10070`).
   */
  drawMonsterTargetBar(...args: Parameters<typeof drawMonsterTargetBarImpl>): ReturnType<typeof drawMonsterTargetBarImpl> {
    return (drawMonsterTargetBarImpl as any).apply(this, args)
  }

  /**
   * Draw Canonical Diablo II Item Hover Tooltip (`showitems.cpp` `0x6fb47fd8` & `0x6fb49fe0`).
   * - All lines use uniform `font16`.
   * - Weapon speed line appears AFTER `Required Dexterity`, `Required Strength`, and `Required Level`.
   * - Tight box sizing (`maxW + 16`, `lines.length * 16 + 16`) with `STONE_BOX_BG_FILL` (`rgba(0, 0, 0, 0.85)`) and NO border stroke.
   */
  drawItemTooltip(...args: Parameters<typeof drawItemTooltipImpl>): ReturnType<typeof drawItemTooltipImpl> {
    return (drawItemTooltipImpl as any).apply(this, args)
  }

  /**
   * Draw the authentic Diablo II v1.13c In-Game Escape Menu (`D2Client.dll` `gmenu.cpp` `0x6fb15230..0x6fb15555`
   * & `D2Win.dll` `#10138` `0x6f8f17a0`):
   * - No background box or screen dimming: draws the 3 stitched DC6 banners (`Options.dc6`, `Exit.dc6`,
   *   `ReturnToGame.dc6`) directly over the game viewport.
   * - Draws counter-rotating 8-frame 3D pentagrams (`CURSOR\Pentspin.dc6`, 50ms/frame) flanking the selected row.
   */
  drawEscapeMenu(...args: Parameters<typeof drawEscapeMenuImpl>): ReturnType<typeof drawEscapeMenuImpl> {
    return (drawEscapeMenuImpl as any).apply(this, args)
  }

  resolvePartyActionCode(member: any): 0x06 | 0x07 | 0x08 | 0x09 {
    return resolvePartyActionCode(member)
  }

  /**
   * Layout of the centered 1.13c Trade Invitation / Waiting stone modal (`D2Client.dll` `0x6fb099e0`):
   * - `pendingModal === 'wait'`: `"Waiting for other player"` (`strParty9`) + centered `cancel` (`0x4F 0x02`)
   * - `pendingModal === 'request'`: `"%s wants to trade with you"` (`strParty8`) + `ok` (`0x4F 0x03`) + `cancel` (`0x4F 0x02`)
   */
  getPendingTradeModalLayout(...args: Parameters<typeof getPendingTradeModalLayoutImpl>): ReturnType<typeof getPendingTradeModalLayoutImpl> {
    return (getPendingTradeModalLayoutImpl as any).apply(this, args)
  }

  handlePendingTradeModalClick(...args: Parameters<typeof handlePendingTradeModalClickImpl>): ReturnType<typeof handlePendingTradeModalClickImpl> {
    return (handlePendingTradeModalClickImpl as any).apply(this, args)
  }

  /**
   * Handle mouse click on an active left-side dock panel (`merc`, `hire`, `party`, `trade`, `imbue`, `add_sockets`, `personalize`, `orifice`).
   */
  handleActiveLeftPanelClick(...args: Parameters<typeof handleActiveLeftPanelClickImpl>): ReturnType<typeof handleActiveLeftPanelClickImpl> {
    return (handleActiveLeftPanelClickImpl as any).apply(this, args)
  }

  /**
   * Determine whether a roster entry belongs to the local player's party (`D2Client.dll` `0x6fb25780`).
   */
  isMemberInLocalParty(...args: Parameters<typeof isMemberInLocalPartyImpl>): ReturnType<typeof isMemberInLocalPartyImpl> {
    return (isMemberInLocalPartyImpl as any).apply(this, args)
  }

  /**
   * Determine whether a roster entry is in any active party (`partyId !== 0xffff && partyId > 0`).
   */
  isMemberInAnyParty(...args: Parameters<typeof isMemberInAnyPartyImpl>): ReturnType<typeof isMemberInAnyPartyImpl> {
    return (isMemberInAnyPartyImpl as any).apply(this, args)
  }

  /**
   * Determine whether the local player is currently in an active party (`D2Client.dll` `0x6fb255d0`).
   */
  isLocalPlayerInParty(...args: Parameters<typeof isLocalPlayerInPartyImpl>): ReturnType<typeof isLocalPlayerInPartyImpl> {
    return (isLocalPlayerInPartyImpl as any).apply(this, args)
  }

  /**
   * Return up to 7 other players grouped by party (`D2Client.dll` `0x6fb26790`):
   * 1. Members in local player's party (`'local'`)
   * 2. Members in other parties (`'party:<partyId>'`)
   * 3. Unpartied players (`'none'`)
   */
  getOrderedPartyRoster(...args: Parameters<typeof getOrderedPartyRosterImpl>): ReturnType<typeof getOrderedPartyRosterImpl> {
    return (getOrderedPartyRosterImpl as any).apply(this, args)
  }

  /**
   * Hit-test Party Screen controls (`D2Client.dll` `0x6fb261c0` & `0x6fb26b20`).
   */
  hitTestPartyControl(...args: Parameters<typeof hitTestPartyControlImpl>): ReturnType<typeof hitTestPartyControlImpl> {
    return (hitTestPartyControlImpl as any).apply(this, args)
  }

  /**
   * Build localized 1- or 2-line hover tooltip strings for Party Screen controls (`D2Client.dll` `0x6fb25d30` & `0x6fb26b20`).
   */
  resolvePartyHoverTooltipLines(...args: Parameters<typeof resolvePartyHoverTooltipLinesImpl>): ReturnType<typeof resolvePartyHoverTooltipLinesImpl> {
    return (resolvePartyHoverTooltipLinesImpl as any).apply(this, args)
  }

  /**
   * Handle mouse click inside the 1.13c Party Screen (`D2Client.dll` `0x6fb261c0`).
   * Note: Hostile box (`ox + 14`) is permanently disabled (PvP closed).
   */
  handlePartyPanelClick(...args: Parameters<typeof handlePartyPanelClickImpl>): ReturnType<typeof handlePartyPanelClickImpl> {
    return (handlePartyPanelClickImpl as any).apply(this, args)
  }

  /**
   * Draw the authentic Diablo II v1.13c Party Screen (`D2Client.dll` `PARTY_DrawPartyScreen` @ `0x6fb27250`).
   */
  drawPartyPanel(...args: Parameters<typeof drawPartyPanelImpl>): ReturnType<typeof drawPartyPanelImpl> {
    return (drawPartyPanelImpl as any).apply(this, args)
  }

  /**
   * Draw the authentic Diablo II v1.13c Mercenary (Hireling / Pet) Screen (`D2Client.dll` `UI_DrawMercScreen` @ `0x6fb4ae80`).
   *
   * Ground Truth References:
   * - `0x6fb4ae80` (`UI_DrawMercScreen`): Panel background (`Panel\NPCInv.dc6` 4-frame 320x432 stitched),
   *   empty slot silhouettes (`0x6fb3b2f0`), equipped items (`0x6fb47be0`), close button (`0x6fb4afc1`),
   *   mercenary name (`0x6fb40eb0`), 12 `.tbl` labels (`0x6fb3c8b0`), and 12 stat readouts (`0x6fb3ea20`).
   * - `inventory.txt` rows `Hireling` (640x480, `invLeft=0, invTop=0`) & `Hireling2` (800x600, `invLeft=80, invTop=60`):
   *   - `head` (`slot 1`): `ox + 135, oy + 8, w: 54, h: 51`
   *   - `torso` (`slot 3`): `ox + 133, oy + 77, w: 56, h: 82`
   *   - `rArm` (`slot 4`): `ox + 20, oy + 47, w: 55, h: 112`
   *   - `lArm` (`slot 5`): `ox + 251, oy + 47, w: 55, h: 112`
   */
  drawMercenaryPanel(...args: Parameters<typeof drawMercenaryPanelImpl>): ReturnType<typeof drawMercenaryPanelImpl> {
    return (drawMercenaryPanelImpl as any).apply(this, args)
  }

  /** Hovered useitem.cpp button (0 = confirm, 1 = close), maintained by `handleMouseMove`. */
  hoveredUseItemButton: 0 | 1 | null = null

  /**
   * D2Client.dll `useitem.cpp` draw (`0x6fb4f460` + item `0x6fb4fb00`), see {@link USE_ITEM_LAYOUT}.
   * Coordinates are absolute (left-dock local) screen coordinates.
   */
  drawUseItemPanel(...args: Parameters<typeof drawUseItemPanelImpl>): ReturnType<typeof drawUseItemPanelImpl> {
    return (drawUseItemPanelImpl as any).apply(this, args)
  }

  /** Pressed useitem.cpp button (`.data 0x6fb8ec86` pressed byte), set on mouse down over a button. */
  pressedUseItemButton: 0 | 1 | null = null

  /**
   * Render left-side panels (`merc`, `hire`, `party`, `trade`, `imbue`, `add_sockets`, `personalize`, `orifice`).
   */
  renderActiveLeftPanel(...args: Parameters<typeof renderActiveLeftPanelImpl>): ReturnType<typeof renderActiveLeftPanelImpl> {
    return (renderActiveLeftPanelImpl as any).apply(this, args)
  }

  /**
   * Draw the centered 1.13c Trade Invitation / Waiting stone modal (`D2Client.dll` `0x6fb099e0`):
   * - `pendingModal === 'wait'` (`0x77 0x00`): `"Waiting for other player"` (`strParty9`, `#4104`) + Cancel (`0x4F 0x02`)
   * - `pendingModal === 'request'` (`0x77 0x01`): `"%s wants to trade with you"` (`strParty8`, `#4103`) + OK (`0x4F 0x03`) + Cancel (`0x4F 0x02`)
   */
  drawPendingTradeModal(...args: Parameters<typeof drawPendingTradeModalImpl>): ReturnType<typeof drawPendingTradeModalImpl> {
    return (drawPendingTradeModalImpl as any).apply(this, args)
  }

  /**
   * Draw the authentic Diablo II v1.13c Player-to-Player Trade Screen (`D2Client.dll` `UI_DrawTradeScreen` @ `0x6fb4a410`).
   *
   * Ground Truth References (`D2Client.dll` `0x6fb4a410..0x6fb4a6d8`):
   * - `0x6fb4a41e..0x6fb4a471`: `Panel\trade.dc6` 4-piece 320x432 background at `(ox, oy)`.
   * - `0x6fb4a476..0x6fb4a515`: Partner name at `(ox + 25, oy + 27)` and Self name at `(ox + 25, oy + 242)` (`font16` white, truncated to `<= 112px`).
   * - `0x6fb4a51a..0x6fb4a5e0`: Partner gold right-aligned at `(ox + 292, oy + 27)` and Self gold right-aligned at `(ox + 292, oy + 242)`.
   * - `0x6fb3c8b0` (`.data` `0x6fb81380`): `"Gold"` (`#2215`) centered at `(ox + 187, oy + 27)` and `(ox + 187, oy + 242)`.
   * - `0x6fb4a5e5..0x6fb4a600`: Partner accept indicator (`buysellbtn.dc6` frame 16/17 at `(ox + 275, oy + 170)`, `32x32`).
   * - `0x6fb4a605..0x6fb4a625`: Cancel button (`buysellbtn.dc6` frame 10/11 at `(ox + 275, oy + 384)`, `32x32`).
   * - `0x6fb4a62a..0x6fb4a644`: Self gold coin button (`goldcoinbtn.dc6` frame 0/1 at `(ox + 145, oy + 221)`, `20x18`).
   * - `0x6fb4a649..0x6fb4a6d4`: Self accept checkmark button (`buysellbtn.dc6` frame 16/17 at `(ox + 223, oy + 384)`, `32x32`; red lockout overlay when `acceptDisabled`).
   * - `inventory.txt` `Trade Page 1` / `Trade Page 2`: Partner 10x4 grid at `(ox + 18, oy + 36)` (`290x116`, `29x29` cells) and Self 10x4 grid at `(ox + 18, oy + 252)` (`290x116`, `29x29` cells).
   */
  drawTradePanel(...args: Parameters<typeof drawTradePanelImpl>): ReturnType<typeof drawTradePanelImpl> {
    return (drawTradePanelImpl as any).apply(this, args)
  }

  /**
   * Convenience unified render entrypoint for headless/unit test verification.
   */
  render(ctx: CanvasRenderingContext2D, _font?: D2FontRenderer | null): void {
    const isEn = this.lang === 'ENG' || this.language === 'en'
    const fillTextSafe = (text: string, x: number, y: number, color = '#e8d090') => {
      ctx.fillStyle = color
      if (typeof ctx.fillText === 'function') {
        ctx.fillText(text, x, y)
      }
    }

    if (this._activePanel !== 'none') {
      this.renderActiveLeftPanel(ctx, this._activePanel, _font)
    }

    if (this._npcSpeech) {
      ctx.fillStyle = 'rgba(12, 10, 8, 0.92)'
      ctx.fillRect(230, 140, 340, 156)
      ctx.strokeStyle = '#6c5838'
      ctx.strokeRect(230, 140, 340, 156)
      fillTextSafe(this._npcSpeech.npcName, 400, 164, '#e8c26b')
      for (let i = 0; i < this._npcSpeech.lines.length; i++) {
        fillTextSafe(this._npcSpeech.lines[i]!, 248, 190 + i * 18, '#ffffff')
      }
    } else if (this._npcMenu) {
      const menuOpts = this._npcMenu.options ?? []
      ctx.fillStyle = 'rgba(12, 10, 8, 0.92)'
      ctx.fillRect(300, 140, 200, 40 + menuOpts.length * 22)
      ctx.strokeStyle = '#6c5838'
      ctx.strokeRect(300, 140, 200, 40 + menuOpts.length * 22)
      const headerName = this._npcMenu.descriptor
        ? getLocalizedNpcName(this._npcMenu.descriptor, this.lang)
        : this._npcMenu.npcName
      fillTextSafe(headerName, 400, 162, '#e8c26b')
      for (let i = 0; i < menuOpts.length; i++) {
        const opt = menuOpts[i]!
        fillTextSafe(isEn ? opt.labelEn : opt.labelZh, 400, 186 + i * 21, '#ffffff')
      }
    }

    if (this.isDead) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(160, 220, 480, 120)
      fillTextSafe(
        lookupTbl('strYouHaveDied', this.lang) ?? (isEn ? 'YOU HAVE DIED' : '你已經死亡'),
        400,
        280,
        '#d02020',
      )
    }
  }

  get snapshot() {
    return {
      activePanel: this._activePanel,
      isDead: this.isDead,
      npcMenu: this._npcMenu
        ? {
            npcUnitId: this._npcMenu.npcUnitId ?? this._npcMenu.npcId ?? 0,
            npcHcIdx: this._npcMenu.descriptor?.hcIdx ?? 0,
            npcName: this._npcMenu.npcName,
            x: this._npcMenu.x,
            y: this._npcMenu.y,
            options: (this._npcMenu.options ?? []).map(o => o.id),
            talking: this._npcMenu.talking,
          }
        : null,
      npcSpeech: this._npcSpeech
        ? {
            npcHcIdx: this._npcSpeech.descriptor?.hcIdx ?? 0,
            text: this._npcSpeech.text,
            lines: this._npcSpeech.lines,
          }
        : null,
      merc: this.merc,
      mercHireList: this.mercHireList,
      partyMembers: this.partyMembers,
      trade: this.trade,
      questRewardItem: this.questRewardItem,
      language: this.language,
    }
  }
}
