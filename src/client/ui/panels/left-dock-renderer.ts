import type { WorldPanelsHud } from '../world-panels.ts'
import { D2FontRenderer, type D2ColorCode } from '../font.ts'
import { canSocketUiItem, classifyHandSlotItem, computeCursorItemGridPlacement, drawImageWithEtherealAlpha, drawItemSocketOverlay, getInventoryLayout, isScrollForTome, isUiItemEthereal, isUiItemUnidentified, isUsableRightClickItem, resolveGridItemBackgroundFill, resolveItemSpriteRect, type InventoryPanel, type UiInventoryItem } from '../inventory.ts'
import { lookupTbl, requireTbl } from '../../i18n/lang.ts'
import { BAKED_UI_MANIFEST } from '../../../common/items/baked-ui-meta.ts'
import { buildQuestLogPage, trueTombSymbolFrame113c, INVPS_FRAME_W, INVPS_FRAME_H, INVPS_DRAW_REL_X, INVPS_DRAW_REL_BOTTOM_Y } from '../../world/quest-log-state.ts'
import { D2_COLOR_INDEX_TO_NAME, MSG_LOG_MAX_VISIBLE_LINES, resolveChatTblIndex, wrapChatText113c, type WrappedChatLine113c } from '../../../common/chat/chat-113c.ts'
import { drawStoneBoxFrame } from './npc-dialog-menu.ts'
import { type LeftDockPanelKind, type WorldPanelType, BARKSCROLL_RUNE_POS, BARKSCROLL_GLOW_POS, BARKSCROLL_STEP_THRESHOLDS, STONE_BOX_BG_FILL, BUTTON_HOVER_BOX_PAD_X, BUTTON_HOVER_BOX_MIN_W, BUTTON_HOVER_BOX_H, BUTTON_HOVER_TEXT_OFFSET_Y, VENDOR_BUTTON_HOVER_ANCHOR_Y, VENDOR_STATUS_TEXT_POS, ACT_TAB_LAYOUT, QUEST_SOCKET_DC6_FRAME, questIconTopLeft113c, questSocketTopLeft113c, hitTestQuestSlot113c, STASH_GRID_ORIGIN, STASH_GOLD_BTN_HIT, STASH_DEPOSIT_ALL_BTN, CUBE_PANEL_ORIGIN, CUBE_GRID_ORIGIN, CUBE_TRANSMUTE_BTN_BOUNDS, CUBE_CLOSE_BTN_BOUNDS, VENDOR_GRID_ORIGIN, VENDOR_GOLD_BOX_RECESS, VENDOR_BUTTON_TABLE_X, VENDOR_BUTTON_DRAW_Y, VENDOR_BUTTON_HIT_Y_MIN, VENDOR_BUTTON_HIT_Y_MAX, VENDOR_BUTTON_HIT_W, VENDOR_BUTTON_SPECS, resolveVendorButtonLayout, VENDOR_TABS, type UseItemPanelKind, isUseItemPanel, USE_ITEM_LAYOUT, USE_ITEM_INSTRUCTION_TBL, USE_ITEM_BUTTON_TBL, hitTestUseItemButton, hitTestUseItemSlot, wrapUseItemText } from './panel-layout-constants.ts'
import { questFlagWordIndex, getActQuests, resolveWaypointName, getActWaypoints, WAYPOINT_ROW_OFFSETS_Y, getWaypointRowOffsetY, getWaypointTextOffsetY } from './quest-waypoint-data.ts'

/** D2Client.dll 0x6fb4c32c `mov ebx, 1` -> 0x6fb4c341 PlaySound: store button mousedown sound (Sounds.txt 1 `cursor_pass`). */
export const VENDOR_BUTTON_PRESS_SOUND_ID = 1

const isInsideRelRect = (x: number, y: number, r: { readonly relX0: number; readonly relX1: number; readonly relY0: number; readonly relY1: number }): boolean =>
  x >= r.relX0 && x <= r.relX1 && y >= r.relY0 && y <= r.relY1

function drawStashDepositAllButton(ctx: CanvasRenderingContext2D, font: D2FontRenderer, ox: number, oy: number, label: string): void {
  const { relX0, relX1, relY0, relY1 } = STASH_DEPOSIT_ALL_BTN
  const [x, y, w, h] = [ox + relX0, oy + relY0, relX1 - relX0, relY1 - relY0]
  ctx.fillStyle = STONE_BOX_BG_FILL
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#8c7448'
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  font.drawText(ctx, label, x + w / 2, y + h - 6, { font: 'font16', color: 'gold', align: 'center' })
}

export function handleMouseMoveImpl(this: WorldPanelsHud, logicalX: number, logicalY: number): void {
  if (this._activePanel === 'hire') {
    this.handleHireMercMove(logicalX, logicalY, this.viewportWidth, this.viewportHeight)
    return
  }
  if (this._activePanel === 'msg') {
    const closeBaselineY = this.viewportHeight - 114
    this.messageLogCloseHovered =
      logicalX >= 20 &&
      logicalX <= this.viewportWidth - 35 &&
      logicalY >= closeBaselineY - 16 &&
      logicalY <= closeBaselineY + 8
    return
  }
  this.hoveredStashItem = null
  this.hoveredCubeItem = null
  this.hoveredVendorItem = null
  this.hoveredMercItem = null
  this.hoveredTradeItem = null
  this.hoveredQuestRewardItem = null
  this.hoveredVendorButtonSlot = this.activeVendorDescriptor
    ? this.hitTestVendorButtonSlot(logicalX, logicalY)
    : null
  this.hoveredCubeButton = this.hitTestCubeButton(logicalX, logicalY)
  if (this.pressedCubeButton !== null && this.hoveredCubeButton !== this.pressedCubeButton) {
    this.pressedCubeButton = null
  }
  this.hoveredWaypointIdx = null
  this.hoveredStashButton = null
  this.hoveredWaypointClose = false
  this.hoveredMercClose = false

  const ox = 80
  const oy = 60
  if (
    logicalX >= ox + STASH_GOLD_BTN_HIT.relX0 &&
    logicalX <= ox + STASH_GOLD_BTN_HIT.relX1 &&
    logicalY >= oy + STASH_GOLD_BTN_HIT.relY0 &&
    logicalY <= oy + STASH_GOLD_BTN_HIT.relY1
  ) {
    this.hoveredStashButton = 'gold'
  } else if (
    logicalX >= ox + 272 &&
    logicalX <= ox + 304 &&
    logicalY >= oy + 383 &&
    logicalY <= oy + 418
  ) {
    this.hoveredStashButton = 'close'
  }
  if (
    logicalX >= ox + 271 &&
    logicalX <= ox + 304 &&
    logicalY >= oy + 386 &&
    logicalY <= oy + 418
  ) {
    this.hoveredWaypointClose = true
  }
  if (
    logicalX >= ox + 272 &&
    logicalX <= ox + 304 &&
    logicalY >= oy + 384 &&
    logicalY <= oy + 416
  ) {
    this.hoveredMercClose = true
  }
  if (logicalX >= ox + 230 && logicalX <= ox + 259 && logicalY >= oy + 391 && logicalY <= oy + 423) {
    this.hoveredQuestButton = 'speech'
  } else if (logicalX >= ox + 278 && logicalX <= ox + 313 && logicalY >= oy + 392 && logicalY <= oy + 425) {
    this.hoveredQuestButton = 'close'
  } else {
    this.hoveredQuestButton = null
  }
  if (this.pressedQuestButton !== null && this.hoveredQuestButton !== this.pressedQuestButton) {
    this.pressedQuestButton = null
  }
  if (logicalX >= ox + 17 && logicalX <= ox + 298) {
    const wps = getActWaypoints(this.selectedActTab)
    for (let i = 0; i < wps.length; i++) {
      const rowY = getWaypointRowOffsetY(i)
      const wy = oy + rowY
      if (logicalY >= wy && logicalY <= wy + 31) {
        this.hoveredWaypointIdx = i
        break
      }
    }
  }

  if (
    logicalX >= STASH_GRID_ORIGIN.x &&
    logicalX < STASH_GRID_ORIGIN.x + STASH_GRID_ORIGIN.cols * STASH_GRID_ORIGIN.cellPx &&
    logicalY >= STASH_GRID_ORIGIN.y &&
    logicalY < STASH_GRID_ORIGIN.y + STASH_GRID_ORIGIN.rows * STASH_GRID_ORIGIN.cellPx
  ) {
    const col = Math.floor((logicalX - STASH_GRID_ORIGIN.x) / STASH_GRID_ORIGIN.cellPx)
    const row = Math.floor((logicalY - STASH_GRID_ORIGIN.y) / STASH_GRID_ORIGIN.cellPx)
    const hit = this.stashItems.find(
      p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
    )
    if (hit) {
      this.hoveredStashItem = {
        item: hit.item,
        x: STASH_GRID_ORIGIN.x + (hit.col + hit.item.invWidth / 2) * STASH_GRID_ORIGIN.cellPx,
        y: STASH_GRID_ORIGIN.y + hit.row * STASH_GRID_ORIGIN.cellPx,
      }
    }
  }

  if (
    logicalX >= CUBE_GRID_ORIGIN.x &&
    logicalX < CUBE_GRID_ORIGIN.x + CUBE_GRID_ORIGIN.cols * CUBE_GRID_ORIGIN.cellPx &&
    logicalY >= CUBE_GRID_ORIGIN.y &&
    logicalY < CUBE_GRID_ORIGIN.y + CUBE_GRID_ORIGIN.rows * CUBE_GRID_ORIGIN.cellPx
  ) {
    const col = Math.floor((logicalX - CUBE_GRID_ORIGIN.x) / CUBE_GRID_ORIGIN.cellPx)
    const row = Math.floor((logicalY - CUBE_GRID_ORIGIN.y) / CUBE_GRID_ORIGIN.cellPx)
    const hit = this.cubeItems.find(
      p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
    )
    if (hit) {
      this.hoveredCubeItem = {
        item: hit.item,
        x: CUBE_GRID_ORIGIN.x + (hit.col + hit.item.invWidth / 2) * CUBE_GRID_ORIGIN.cellPx,
        y: CUBE_GRID_ORIGIN.y + hit.row * CUBE_GRID_ORIGIN.cellPx,
      }
    }
  }

  if (
    logicalX >= VENDOR_GRID_ORIGIN.x &&
    logicalX < VENDOR_GRID_ORIGIN.x + VENDOR_GRID_ORIGIN.cols * VENDOR_GRID_ORIGIN.cellPx &&
    logicalY >= VENDOR_GRID_ORIGIN.y &&
    logicalY < VENDOR_GRID_ORIGIN.y + VENDOR_GRID_ORIGIN.rows * VENDOR_GRID_ORIGIN.cellPx
  ) {
    const col = Math.floor((logicalX - VENDOR_GRID_ORIGIN.x) / VENDOR_GRID_ORIGIN.cellPx)
    const row = Math.floor((logicalY - VENDOR_GRID_ORIGIN.y) / VENDOR_GRID_ORIGIN.cellPx)
    const placements = this.getActiveVendorPlacements()
    const hit = placements.find(
      p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
    )
    if (hit) {
      this.hoveredVendorItem = {
        item: hit.item,
        x: VENDOR_GRID_ORIGIN.x + (hit.col + hit.item.invWidth / 2) * VENDOR_GRID_ORIGIN.cellPx,
        y: VENDOR_GRID_ORIGIN.y + hit.row * VENDOR_GRID_ORIGIN.cellPx,
        col: hit.col,
        row: hit.row,
      }
    }
  }

  // Mercenary equipment slots (`merc` left panel, `inventory.txt` `Hireling2`)
  const m = this.merc
  if (m) {
    const hireLayout = getInventoryLayout('Hireling', 1)
    const hOx = ox - hireLayout.invLeft
    const hOy = oy - hireLayout.invTop
    const eq = m.equipped ?? m.equipment
    const headItem = m.headItem ?? eq?.helm ?? eq?.head ?? null
    const bodyItem = m.bodyItem ?? eq?.armor ?? eq?.torso ?? null
    const weaponItem = m.weaponItem ?? eq?.weapon1 ?? eq?.rightHand ?? null
    const shieldItem = m.shieldItem ?? eq?.weapon2 ?? eq?.leftHand ?? null
    const is2HWeapon =
      weaponItem !== null &&
      (Boolean(weaponItem.twoHanded) ||
        classifyHandSlotItem(weaponItem as UiInventoryItem) === 'strict_two_handed_weapon')
    const mercSlots: ReadonlyArray<{ x: number; y: number; w: number; h: number; item: UiInventoryItem | null }> = [
      {
        x: hireLayout.slots.head.left + hOx,
        y: hireLayout.slots.head.top + hOy,
        w: hireLayout.slots.head.width,
        h: hireLayout.slots.head.height,
        item: headItem,
      },
      {
        x: hireLayout.slots.torso.left + hOx,
        y: hireLayout.slots.torso.top + hOy,
        w: hireLayout.slots.torso.width,
        h: hireLayout.slots.torso.height,
        item: bodyItem,
      },
      {
        x: hireLayout.slots.rArm.left + hOx,
        y: hireLayout.slots.rArm.top + hOy,
        w: hireLayout.slots.rArm.width,
        h: hireLayout.slots.rArm.height,
        item: weaponItem,
      },
      {
        x: hireLayout.slots.lArm.left + hOx,
        y: hireLayout.slots.lArm.top + hOy,
        w: hireLayout.slots.lArm.width,
        h: hireLayout.slots.lArm.height,
        item: shieldItem ?? (is2HWeapon ? weaponItem : null),
      },
    ]
    for (const s of mercSlots) {
      if (s.item && logicalX >= s.x && logicalX <= s.x + s.w && logicalY >= s.y && logicalY <= s.y + s.h) {
        this.hoveredMercItem = {
          item: s.item,
          x: s.x + s.w / 2,
          y: s.y,
        }
        break
      }
    }
  }

  // Player-to-player trade grids & buttons (`trade` left panel, D2Client.dll 0x6fb4a410 / 0x6fb49889 / 0x6fb49ca7)
  this.hoveredTradeButton = null
  if (this.trade) {
    if (
      this.trade.partnerAccepted &&
      logicalX >= ox + 275 &&
      logicalX <= ox + 307 &&
      logicalY >= oy + 170 &&
      logicalY <= oy + 202
    ) {
      this.hoveredTradeButton = 'partnerAccept'
    } else if (
      logicalX >= ox + 221 &&
      logicalX <= ox + 255 &&
      logicalY >= oy + 383 &&
      logicalY <= oy + 417
    ) {
      this.hoveredTradeButton = 'selfAccept'
    } else if (
      logicalX >= ox + 273 &&
      logicalX <= ox + 307 &&
      logicalY >= oy + 383 &&
      logicalY <= oy + 417
    ) {
      this.hoveredTradeButton = 'cancel'
    } else if (
      logicalX >= ox + 35 &&
      logicalX <= ox + 301 &&
      logicalY >= oy + 220 &&
      logicalY <= oy + 248
    ) {
      this.hoveredTradeButton = 'gold'
    }

    const checkTradeGrid = (gridX: number, gridY: number, items: readonly any[] | undefined) => {
      if (
        !items ||
        this.hoveredTradeItem ||
        logicalX < gridX ||
        logicalX >= gridX + 290 ||
        logicalY < gridY ||
        logicalY >= gridY + 116
      ) {
        return
      }
      const col = Math.floor((logicalX - gridX) / 29)
      const row = Math.floor((logicalY - gridY) / 29)
      const hit = items.find((it: any) => {
        const gx = Number(it.gridX ?? it.col ?? 0)
        const gy = Number(it.gridY ?? it.row ?? 0)
        const gw = Math.max(1, Number(it.invWidth ?? it.w ?? 1))
        const gh = Math.max(1, Number(it.invHeight ?? it.h ?? 1))
        return col >= gx && col < gx + gw && row >= gy && row < gy + gh
      })
      if (hit) {
        const gx = Number(hit.gridX ?? hit.col ?? 0)
        const gy = Number(hit.gridY ?? hit.row ?? 0)
        const gw = Math.max(1, Number(hit.invWidth ?? hit.w ?? 1))
        this.hoveredTradeItem = {
          item: hit as UiInventoryItem,
          x: gridX + (gx + gw / 2) * 29,
          y: gridY + gy * 29,
        }
      }
    }
    // Authentic 1.13c trade.dc6 grid origins: partner at (ox + 18, oy + 36), self at (ox + 18, oy + 252),
    // plus fallback for legacy test coordinates (ox + 15, oy + 60) / (ox + 15, oy + 220)
    checkTradeGrid(ox + 18, oy + 36, this.trade.partnerItems)
    checkTradeGrid(ox + 15, oy + 60, this.trade.partnerItems)
    checkTradeGrid(ox + 18, oy + 252, this.trade.selfItems ?? this.trade.myItems)
    checkTradeGrid(ox + 15, oy + 220, this.trade.selfItems ?? this.trade.myItems)
  }

  // useitem.cpp (`imbue` / `add_sockets` / `personalize` / `orifice`): button hover + placed-item tooltip
  if (isUseItemPanel(this._activePanel)) {
    this.hoveredUseItemButton = hitTestUseItemButton(logicalX, logicalY)
    if (this.pressedUseItemButton !== null && this.hoveredUseItemButton !== this.pressedUseItemButton) {
      this.pressedUseItemButton = null
    }
    if (this.questRewardItem && hitTestUseItemSlot(logicalX, logicalY)) {
      this.hoveredQuestRewardItem = {
        item: this.questRewardItem,
        x: USE_ITEM_LAYOUT.item.centerX,
        y: USE_ITEM_LAYOUT.slot.top,
      }
    }
  } else {
    this.hoveredUseItemButton = null
    this.pressedUseItemButton = null
  }

  if (this._activePanel === 'party') {
    const pOx = this.viewportWidth <= 640 ? 0 : 80
    const pOy = this.viewportWidth <= 640 ? 0 : 60
    this.hoveredPartyControl = this.hitTestPartyControl(logicalX, logicalY, pOx, pOy)
  } else {
    this.hoveredPartyControl = null
    this.pressedPartyButton = null
  }
}
export function handleLeftDockClickImpl(
  this: WorldPanelsHud,
  kind: Exclude<LeftDockPanelKind, 'none' | 'char'>,
  logicalX: number,
  logicalY: number,
  callbacksOrOx?:
    | {
        onClose?: () => void
        onWaypointTeleport?:
          | ((act: number, slug: string, levelId: number) => void)
          | ((levelId: number) => void)
        onOpenCube?: () => void
        onCastTownPortal?: (source?: 'tbk' | 'tsc', item?: UiInventoryItem) => boolean | void
        inventory?: InventoryPanel
        isShiftClick?: boolean
        isRightClick?: boolean
        /**
         * Server-authoritative mode: the cube Transmute button only requests `ClickButton 0x18`; no local recipe run.
         */
        onTransmute?: () => void
        /**
         * Server-authoritative mode: stash / cube grid clicks are forwarded (pick-up / place / use) and never move
         * items locally. The containers are rebuilt from `ClientWorld` when the server answers.
         */
        onContainerGridClick?: (
          container: 'stash' | 'cube',
          col: number,
          row: number,
          hitItem: UiInventoryItem | null,
          isRightClick: boolean,
        ) => void
        /** Server-authoritative quick-transfer from stash/cube to inventory (`C2S 0x19` + `0x18`). */
        onQuickTransferToInventory?: (
          item: UiInventoryItem,
          targetCol: number,
          targetRow: number,
        ) => void
        /** Stash gold coin button: open the withdraw gold dialog. */
        onStashGoldButton?: () => void
        onStashDepositAll?: () => void
        /** Vendor grid click on a store item (buy / gamble). `shiftFill`: Shift held (0x32 shift-fill flag). */
        onVendorBuy?: (item: UiInventoryItem, shiftFill: boolean) => void
        /** Vendor grid click while holding a cursor item: sell it (0x33). */
        onVendorSell?: (item: UiInventoryItem) => void
        /** Repair All button (0x35 with field4 = 0x80000000). */
        onVendorRepairAll?: () => void
        /** 1.13c UI sound (Sounds.txt row index), e.g. the vendor button press sound (D2Client 0x6fb4c339). */
        onPlayUiSound?: (soundId: number) => void
        /** Mercenary Screen equipment slot callback (`C2S 0x61`). */
        onMercItem?: ((slot: number) => void) | undefined
        /** Party Screen action callback (`C2S 0x5E`). */
        onPartyAction?: (action: number, targetPlayerId: number) => void
        /** Party Screen hostile / loot permission callback (`C2S 0x5D`). */
        onSetHostile?: (targetPlayerId: number, hostile: boolean, button?: number) => void
      }
    | number,
  explicitOy?: number,
): boolean {
  if (logicalX > 400) return false
  const ox = typeof callbacksOrOx === 'number' ? callbacksOrOx : 80
  const oy = typeof explicitOy === 'number' ? explicitOy : 60
  const rawCallbacks =
    typeof callbacksOrOx === 'object' && callbacksOrOx !== null ? callbacksOrOx : {}
  const callbacks = {
    ...rawCallbacks,
    onClose: rawCallbacks.onClose ?? (() => this.onDefaultClose?.()),
    onWaypointTeleport: (act: number, slug: string, levelId: number) => {
      const fn = rawCallbacks.onWaypointTeleport
      if (fn) {
        if (fn.length === 1) {
          ;(fn as (dest: number) => void)(levelId)
        } else {
          ;(fn as (a: number, s: string, l: number) => void)(act, slug, levelId)
        }
      } else {
        this.onDefaultWaypointTeleport?.(act, slug, levelId)
      }
    },
  }

  if (kind === 'merc' || kind === 'party') {
    return this.handleActiveLeftPanelClick(
      kind,
      logicalX,
      logicalY,
      Boolean(callbacks.isRightClick),
      Boolean(callbacks.isShiftClick),
      {
        onClose: callbacks.onClose,
        onMercItem: callbacks.onMercItem,
        onPartyAction: callbacks.onPartyAction,
        onSetHostile: callbacks.onSetHostile,
        inventory: callbacks.inventory,
      },
    )
  }

  // Generic Close button (`x = ox + 272, y = oy + 388` or `ox + 18, oy + 385`) for non-vendor/non-quest panels only.
  // Quest, Waypoint, and Barkscroll panels only have the bottom-right close button (`D2Client.dll` 0x6fb5a210 / 0x6fb2cf90).
  // RecipeScroll (`recipescroll.dc6`) has the centered close button at `ox + 148, oy + 368` (`228, 428` per `0x6fb3e846`) as well as bottom-right close.
  // Vendor panels manage their 4 button slots via D2Client.dll 0x6fb3f430 / 0x6fb4c27a (where slot 3 is Repair All on blacksmiths).
  if (
    kind === 'recipescroll' &&
    logicalX >= ox + 144 &&
    logicalX <= ox + 184 &&
    logicalY >= oy + 360 &&
    logicalY <= oy + 404
  ) {
    // 1.13c semantics: press latches the depressed X, the close fires on mouse-up
    // landing back on it (`releaseCloseButton`).
    return this.latchCloseButton(
      'recipescroll-center',
      'dock',
      (x, y) => x >= ox + 144 && x <= ox + 184 && y >= oy + 360 && y <= oy + 404,
      () => callbacks.onClose(),
    )
  }
  const isCloseBtnX =
    kind === 'quest' || kind === 'waypoint' || kind === 'barkscroll' || kind === 'recipescroll'
      ? logicalX >= ox + 260
      : logicalX >= ox + 260 || logicalX <= ox + 58
  if (
    kind !== 'vendor' &&
    kind !== 'quest' &&
    logicalY >= oy + 380 &&
    logicalY <= oy + 426 &&
    isCloseBtnX
  ) {
    // 1.13c semantics: press latches the depressed X, the close fires on mouse-up
    // landing back on the same bottom-left / bottom-right region.
    const onRightX = logicalX >= ox + 260
    return this.latchCloseButton(
      kind,
      'dock',
      (x, y) =>
        y >= oy + 380 &&
        y <= oy + 426 &&
        (onRightX ? x >= ox + 260 : x <= ox + 58),
      () => {
        this.vendorTradeState = 'idle'
        this.pressedMomentarySlot = null
        this.pressedCubeButton = null
        callbacks.onClose()
      },
    )
  }

  if (kind === 'quest') {
    // Quest Log Close button (`D2Client.dll` 0x6facf3c0 / 0x6facf810: `buysellbtn.dc6` frame 10/11 at `ox + 278, oy + 386`, hitbox `relX ∈ [278, 313], relY ∈ [392, 425]`)
    if (logicalX >= ox + 272 && logicalX <= ox + 313 && logicalY >= oy + 386 && logicalY <= oy + 425) {
      // 1.13c semantics: press latches the depressed cell 11, close fires on mouse-up.
      return this.latchCloseButton(
        'quest',
        'dock',
        (x, y) => x >= ox + 272 && x <= ox + 313 && y >= oy + 386 && y <= oy + 425,
        () => {
          this.pressedQuestButton = null
          callbacks.onClose()
        },
      )
    }
    // Quest Log Replay Speech button (`D2Client.dll` 0x6facf3c0 / 0x6facf870: `questlast.dc6` frame 0/1 at `ox + 226, oy + 387`, hitbox `relX ∈ [230, 259], relY ∈ [391, 423]`)
    if (logicalX >= ox + 226 && logicalX <= ox + 259 && logicalY >= oy + 387 && logicalY <= oy + 423) {
      const actQuests = getActQuests(this.selectedActTab)
      const selectedQuest = this.selectedQuestIdx >= 0 ? actQuests[this.selectedQuestIdx] : undefined
      if (selectedQuest && this.getQuestStatus(selectedQuest) !== 'locked') {
        const speechKey = this.getQuestSpeechKey(selectedQuest)
        if (speechKey) {
          this.onReplayQuestSpeech?.(speechKey)
        }
      }
      return true
    }
  }

  // Act Tabs (`Act I..V` at top of Quest / Waypoint panels: `ox + 4 + i * 62`, `oy + 8 .. oy + 59` above row 0)
  // 1.13c (issue #933): only acts reached in this difficulty respond — hidden tabs are not clickable.
  if (
    (kind === 'quest' || kind === 'waypoint') &&
    logicalY >= oy + ACT_TAB_LAYOUT.topYOffset &&
    logicalY < oy + WAYPOINT_ROW_OFFSETS_Y[0]!
  ) {
    const visibleCount = this.visibleActTabCount()
    for (let i = 0; i < visibleCount; i++) {
      const tx = ox + ACT_TAB_LAYOUT.startXOffset + i * ACT_TAB_LAYOUT.strideX
      const maxX = i === visibleCount - 1 ? tx + ACT_TAB_LAYOUT.frameWidth : tx + ACT_TAB_LAYOUT.strideX
      if (logicalX >= tx && logicalX < maxX) {
        this.selectedActTab = i + 1
        if (kind === 'quest') {
          this.selectedQuestIdx = this.onQuestActTabSelected ? this.onQuestActTabSelected(i) : -1
        }
        return true
      }
    }
  }

  if (kind === 'quest') {
    // 6 Quest Sockets (`2 rows × 3 cols`) — unstarted (`locked` / mode 2) quests cannot be selected (`D2Client.dll` 0x6facce00 / 0x6facf4f3)
    // Slot hit-rects come from the 1.13c table at `0x6fba8100` via `0x6facc7a0`.
    const actQuests = getActQuests(this.selectedActTab)
    const slot = hitTestQuestSlot113c(logicalX - ox, logicalY - oy, actQuests.length)
    if (slot >= 0) {
      const q = actQuests[slot]!
      if (this.getQuestStatus(q) !== 'locked') {
        this.selectedQuestIdx = slot
      }
      return true
    }
  } else if (kind === 'waypoint') {
    const list = getActWaypoints(this.selectedActTab)
    for (let i = 0; i < list.length; i++) {
      const rowY = getWaypointRowOffsetY(i)
      const wy = oy + rowY
      if (logicalX >= ox + 17 && logicalX <= ox + 298 && logicalY >= wy && logicalY <= wy + 32) {
        const wp = list[i]!
        if (!this.isWaypointUnlocked(wp)) return true
        if (this.isCurrentWaypoint(wp)) return true
        // 1.13c semantics (issue #933): mouse-down only latches the depressed icon;
        // the teleport fires on mouse-up landing back on the same row.
        this.pressedWaypointIdx = i
        const act = wp.act
        const slug = wp.slug
        const levelId = wp.levelId
        this.pendingWaypointRelease = {
          contains: (x, y) => {
            if (x < ox + 17 || x > ox + 298) return false
            const rowY2 = getWaypointRowOffsetY(i)
            return y >= oy + rowY2 && y <= oy + rowY2 + 32
          },
          fire: () => {
            callbacks.onWaypointTeleport(act, slug, levelId)
            callbacks.onClose()
          },
        }
        return true
      }
    }
  } else if (kind === 'cube') {
    // 1. Transmute button (`D2Client.dll` 0x6fb3b600: `relX ∈ [144, 184], relY ∈ [257, 297]`, drawn at `ox + 144, oy + 260, 32x32`)
    if (this.hitTestCubeButton(logicalX, logicalY) === 'transmute') {
      if (!callbacks.isRightClick) {
        this.pressedCubeButton = 'transmute'
        if (callbacks.onTransmute) {
          callbacks.onTransmute()
        } else {
          this.cubeTransmuteCount += 1
          this.transmuteCube()
        }
      }
      return true
    }

    // 2. Horadric Cube 3x4 Grid (`CUBE_GRID_ORIGIN`)
    if (
      logicalX >= CUBE_GRID_ORIGIN.x &&
      logicalX < CUBE_GRID_ORIGIN.x + CUBE_GRID_ORIGIN.cols * CUBE_GRID_ORIGIN.cellPx &&
      logicalY >= CUBE_GRID_ORIGIN.y &&
      logicalY < CUBE_GRID_ORIGIN.y + CUBE_GRID_ORIGIN.rows * CUBE_GRID_ORIGIN.cellPx
    ) {
      const col = Math.floor((logicalX - CUBE_GRID_ORIGIN.x) / CUBE_GRID_ORIGIN.cellPx)
      const row = Math.floor((logicalY - CUBE_GRID_ORIGIN.y) / CUBE_GRID_ORIGIN.cellPx)
      const hit = this.cubeItems.find(
        p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
      )
      const inv = callbacks.inventory ?? this.activePlayerInventory ?? undefined
      const heldCursor = inv?.cursorItem ?? null
      const isIdentify = Boolean(inv?.isIdentifyMode())

      if (
        ((callbacks.isShiftClick && !callbacks.isRightClick) ||
          (callbacks.isRightClick && hit && !isUsableRightClickItem(hit.item.code))) &&
        !heldCursor &&
        !isIdentify &&
        inv
      ) {
        if (hit && this.quickTransferFromCube(hit.item, inv)) {
          const placed = inv.gridItems[inv.gridItems.length - 1]
          if (placed && callbacks.onQuickTransferToInventory) {
            callbacks.onQuickTransferToInventory(hit.item, placed.col, placed.row)
          }
        }
        return true
      }

      if (callbacks.onContainerGridClick) {
        if (heldCursor && !callbacks.isRightClick && !isIdentify) {
          const cursorCode = (heldCursor.code ?? '').trim().toLowerCase()
          if (cursorCode === 'box' || cursorCode === 'cube') {
            return true
          }
          const placement = computeCursorItemGridPlacement(
            logicalX,
            logicalY,
            CUBE_GRID_ORIGIN,
            heldCursor,
            this.cubeItems,
          )
          if (
            placement.directHit &&
            (isScrollForTome(heldCursor.code, placement.directHit.item.code) ||
              canSocketUiItem(heldCursor, placement.directHit.item))
          ) {
            callbacks.onContainerGridClick(
              'cube',
              placement.rawCol,
              placement.rawRow,
              placement.directHit.item,
              false,
            )
            return true
          }
          if (!placement.inBounds || placement.overlaps.length > 1) {
            return true
          }
          callbacks.onContainerGridClick(
            'cube',
            placement.col,
            placement.row,
            placement.overlaps[0]?.item ?? null,
            false,
          )
          return true
        }
        callbacks.onContainerGridClick('cube', col, row, hit?.item ?? null, callbacks.isRightClick === true)
        return true
      }

      if (callbacks.inventory?.isIdentifyMode()) {
        if (callbacks.isRightClick) {
          callbacks.inventory.cancelIdentifyMode()
        } else if (hit && isUiItemUnidentified(hit.item)) {
          callbacks.inventory.applyIdentifyToItem(hit.item, {
            stashItems: this.stashItems,
            cubeItems: this.cubeItems,
          })
        } else {
          callbacks.inventory.cancelIdentifyMode()
        }
        return true
      }

      if (callbacks.isRightClick && callbacks.inventory) {
        if (hit && isUsableRightClickItem(hit.item.code)) {
          callbacks.inventory.usePlacedItemByRightClick(hit, 'cube', this.cubeItems, {
            onOpenCube: () => callbacks.onOpenCube?.(),
            onCastTownPortal: (source, item) => callbacks.onCastTownPortal?.(source, item),
          })
          return true
        }
        if (hit) {
          this.quickTransferFromCube(hit.item, callbacks.inventory)
        }
        return true
      }

      if (callbacks.isShiftClick && callbacks.inventory) {
        if (hit) {
          this.quickTransferFromCube(hit.item, callbacks.inventory)
        }
        return true
      }

      if (callbacks.inventory) {
        let targetCol = col
        let targetRow = row
        if (heldCursor) {
          const placement = computeCursorItemGridPlacement(
            logicalX,
            logicalY,
            CUBE_GRID_ORIGIN,
            heldCursor,
            this.cubeItems,
          )
          if (
            placement.directHit &&
            (isScrollForTome(heldCursor.code, placement.directHit.item.code) ||
              canSocketUiItem(heldCursor, placement.directHit.item))
          ) {
            targetCol = placement.rawCol
            targetRow = placement.rawRow
          } else if (!placement.inBounds || placement.overlaps.length > 1) {
            return true
          } else {
            targetCol = placement.col
            targetRow = placement.row
          }
        }
        const result = this.clickCubeCell(targetCol, targetRow, callbacks.inventory.cursorItem)
        if (result.handled) {
          callbacks.inventory.cursorItem = result.newCursorItem
          return true
        }
      }
      return true
    }
  } else if (kind === 'stash') {
    if (this.stashDepositAllEnabled && isInsideRelRect(logicalX - ox, logicalY - oy, STASH_DEPOSIT_ALL_BTN)) {
      if (!callbacks.isRightClick) callbacks.onStashDepositAll?.()
      return true
    }
    // Stash gold coin button (panel-relative x 73..150, y 24..41): opens the withdraw dialog.
    if (
      logicalX >= ox + STASH_GOLD_BTN_HIT.relX0 &&
      logicalX <= ox + STASH_GOLD_BTN_HIT.relX1 &&
      logicalY >= oy + STASH_GOLD_BTN_HIT.relY0 &&
      logicalY <= oy + STASH_GOLD_BTN_HIT.relY1
    ) {
      if (!callbacks.isRightClick && this.stashGold > 0) {
        if (!callbacks.onStashGoldButton) throw new Error('handleLeftDockClick: stash gold button needs onStashGoldButton')
        callbacks.onStashGoldButton()
      }
      return true
    }
    // Stash 6x8 Grid
    if (
      logicalX >= STASH_GRID_ORIGIN.x &&
      logicalX < STASH_GRID_ORIGIN.x + STASH_GRID_ORIGIN.cols * STASH_GRID_ORIGIN.cellPx &&
      logicalY >= STASH_GRID_ORIGIN.y &&
      logicalY < STASH_GRID_ORIGIN.y + STASH_GRID_ORIGIN.rows * STASH_GRID_ORIGIN.cellPx
    ) {
      const col = Math.floor((logicalX - STASH_GRID_ORIGIN.x) / STASH_GRID_ORIGIN.cellPx)
      const row = Math.floor((logicalY - STASH_GRID_ORIGIN.y) / STASH_GRID_ORIGIN.cellPx)
      const hit = this.stashItems.find(
        p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
      )
      const inv = callbacks.inventory ?? this.activePlayerInventory ?? undefined
      const heldCursor = inv?.cursorItem ?? null
      const isIdentify = Boolean(inv?.isIdentifyMode())

      if (
        ((callbacks.isShiftClick && !callbacks.isRightClick) ||
          (callbacks.isRightClick && hit && !isUsableRightClickItem(hit.item.code))) &&
        !heldCursor &&
        !isIdentify &&
        inv
      ) {
        if (hit && this.quickTransferFromStash(hit.item, inv)) {
          const placed = inv.gridItems[inv.gridItems.length - 1]
          if (placed && callbacks.onQuickTransferToInventory) {
            callbacks.onQuickTransferToInventory(hit.item, placed.col, placed.row)
          }
        }
        return true
      }

      if (callbacks.onContainerGridClick) {
        if (heldCursor && !callbacks.isRightClick && !isIdentify) {
          const placement = computeCursorItemGridPlacement(
            logicalX,
            logicalY,
            STASH_GRID_ORIGIN,
            heldCursor,
            this.stashItems,
          )
          const isBoxItem = (it: UiInventoryItem | null | undefined) =>
            (it?.code ?? '').trim().toLowerCase() === 'box'
          const boxTarget =
            placement.overlaps.length === 1 && isBoxItem(placement.overlaps[0]!.item)
              ? placement.overlaps[0]!.item
              : (!placement.inBounds || placement.overlaps.length > 1) &&
                  placement.directHit &&
                  isBoxItem(placement.directHit.item)
                ? placement.directHit.item
                : null
          if (boxTarget) {
            callbacks.onContainerGridClick(
              'stash',
              placement.rawCol,
              placement.rawRow,
              boxTarget,
              false,
            )
            return true
          }
          if (
            placement.directHit &&
            (isScrollForTome(heldCursor.code, placement.directHit.item.code) ||
              canSocketUiItem(heldCursor, placement.directHit.item))
          ) {
            callbacks.onContainerGridClick(
              'stash',
              placement.rawCol,
              placement.rawRow,
              placement.directHit.item,
              false,
            )
            return true
          }
          if (!placement.inBounds || placement.overlaps.length > 1) {
            return true
          }
          callbacks.onContainerGridClick(
            'stash',
            placement.col,
            placement.row,
            placement.overlaps[0]?.item ?? null,
            false,
          )
          return true
        }
        callbacks.onContainerGridClick('stash', col, row, hit?.item ?? null, callbacks.isRightClick === true)
        return true
      }

      if (callbacks.inventory?.isIdentifyMode()) {
        if (callbacks.isRightClick) {
          callbacks.inventory.cancelIdentifyMode()
        } else if (hit && isUiItemUnidentified(hit.item)) {
          callbacks.inventory.applyIdentifyToItem(hit.item, {
            stashItems: this.stashItems,
            cubeItems: this.cubeItems,
          })
        } else {
          callbacks.inventory.cancelIdentifyMode()
        }
        return true
      }

      if (callbacks.isRightClick && callbacks.inventory) {
        if (hit && isUsableRightClickItem(hit.item.code)) {
          callbacks.inventory.usePlacedItemByRightClick(hit, 'stash', this.stashItems, {
            onOpenCube: () => callbacks.onOpenCube?.(),
            onCastTownPortal: (source, item) => callbacks.onCastTownPortal?.(source, item),
          })
          return true
        }
        if (hit) {
          this.quickTransferFromStash(hit.item, callbacks.inventory)
        }
        return true
      }

      if (callbacks.isShiftClick && callbacks.inventory) {
        if (hit) {
          this.quickTransferFromStash(hit.item, callbacks.inventory)
        }
        return true
      }

      if (callbacks.inventory) {
        let targetCol = col
        let targetRow = row
        if (heldCursor) {
          const placement = computeCursorItemGridPlacement(
            logicalX,
            logicalY,
            STASH_GRID_ORIGIN,
            heldCursor,
            this.stashItems,
          )
          if (
            placement.directHit &&
            (isScrollForTome(heldCursor.code, placement.directHit.item.code) ||
              canSocketUiItem(heldCursor, placement.directHit.item))
          ) {
            targetCol = placement.rawCol
            targetRow = placement.rawRow
          } else if (!placement.inBounds || placement.overlaps.length > 1) {
            return true
          } else {
            targetCol = placement.col
            targetRow = placement.row
          }
        }
        const result = this.clickStashCell(targetCol, targetRow, callbacks.inventory.cursorItem)
        if (result.handled) {
          callbacks.inventory.cursorItem = result.newCursorItem
          return true
        }
      }
      return true
    }
  } else if (kind === 'vendor') {
    if (!this.activeVendorDescriptor || this.activeVendorDescriptor.vendorId === null) {
      throw new Error('Cannot handle vendor click without an active vendor descriptor')
    }
    if (callbacks.isRightClick && this.vendorTradeState !== 'idle') {
      this.vendorTradeState = 'idle'
      return true
    }
    const relX = logicalX - ox
    const relY = logicalY - oy

    // 1. D2Client.dll `0x6fb4c0e5–0x6fb4c233`: Tab click (`relY ∈ [1, 31]`, 80px bands `<=80, <=160, <=240, <=320`)
    if (this.vendorMode === 'trade' && relY >= 1 && relY <= 31 && relX >= 0 && relX <= 320) {
      const tabIdx = relX <= 80 ? 0 : relX <= 160 ? 1 : relX <= 240 ? 2 : 3
      const chosen = VENDOR_TABS[tabIdx]!
      if (this.isVendorTabPresent(chosen.id) && chosen.id !== this.activeVendorTab) {
        this.activeVendorTab = chosen.id
        this.hoveredVendorItem = null
      }
      return true
    }

    // 2. D2Client.dll `0x6fb4c27a–0x6fb4c3ee`: Button mousedown hit-test & mutual-exclusion state machine
    const hitSlot = this.hitTestVendorButtonSlot(logicalX, logicalY)
    if (hitSlot !== null) {
      // D2Client.dll 0x6fb4c326..0x6fb4c341: an enabled store button (`[slot + 0x6fbbb238] == 1`) plays
      // PlaySound(ebx = 1 /* cursor_pass */, 0, 0, 0, 0) on mousedown, before the button action (#991).
      callbacks.onPlayUiSound?.(VENDOR_BUTTON_PRESS_SOUND_ID)
      const layout = resolveVendorButtonLayout(this.activeVendorDescriptor.hcIdx, this.vendorMode)
      const btnKind = layout[hitSlot]!
      if (btnKind === 'buy' || btnKind === 'sell' || btnKind === 'repair') {
        this.pressedMomentarySlot = null
        this.vendorTradeState = this.vendorTradeState === btnKind ? 'idle' : btnKind
      } else if (btnKind === 'repairAll') {
        this.vendorTradeState = 'idle'
        this.pressedMomentarySlot = hitSlot
        if (!callbacks.onVendorRepairAll) throw new Error('handleLeftDockClick: Repair All needs onVendorRepairAll')
        callbacks.onVendorRepairAll()
      } else if (btnKind === 'close') {
        // 1.13c semantics: press latches the depressed slot cell, the close fires on
        // mouse-up landing back on the same slot (`releaseCloseButton`).
        this.pressedMomentarySlot = hitSlot
        return this.latchCloseButton(
          'vendor',
          'dock',
          (x, y) => this.hitTestVendorButtonSlot(x, y) === hitSlot,
          () => {
            this.vendorTradeState = 'idle'
            this.pressedMomentarySlot = null
            callbacks.onClose()
          },
        )
      }
      return true
    }
    if (relY > VENDOR_BUTTON_HIT_Y_MIN && relY < VENDOR_BUTTON_HIT_Y_MAX && relX > VENDOR_BUTTON_TABLE_X[0] && relX < VENDOR_BUTTON_TABLE_X[3] + VENDOR_BUTTON_HIT_W) {
      // Clicked disabled blank slot (`0x6fb3d300` no-op)
      return true
    }

    // 3. Vendor 10x10 Grid (`VENDOR_GRID_ORIGIN`)
    if (
      logicalX >= VENDOR_GRID_ORIGIN.x &&
      logicalX < VENDOR_GRID_ORIGIN.x + VENDOR_GRID_ORIGIN.cols * VENDOR_GRID_ORIGIN.cellPx &&
      logicalY >= VENDOR_GRID_ORIGIN.y &&
      logicalY < VENDOR_GRID_ORIGIN.y + VENDOR_GRID_ORIGIN.rows * VENDOR_GRID_ORIGIN.cellPx
    ) {
      const col = Math.floor((logicalX - VENDOR_GRID_ORIGIN.x) / VENDOR_GRID_ORIGIN.cellPx)
      const row = Math.floor((logicalY - VENDOR_GRID_ORIGIN.y) / VENDOR_GRID_ORIGIN.cellPx)

      const inv = callbacks.inventory ?? this.activePlayerInventory
      // Holding a cursor item over the store grid sells it (server answers with 0x2A + item/stat packets).
      if (inv?.cursorItem) {
        if (!callbacks.onVendorSell) throw new Error('handleLeftDockClick: vendor sell needs onVendorSell')
        callbacks.onVendorSell(inv.cursorItem)
        return true
      }
      // Buy works in 'idle' or 'buy' state; never buy while the sell / repair cursor is armed.
      if (this.vendorTradeState === 'idle' || this.vendorTradeState === 'buy') {
        const hit = this.getActiveVendorPlacements().find(
          p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
        )
        if (hit) {
          if (!callbacks.onVendorBuy) throw new Error('handleLeftDockClick: vendor buy needs onVendorBuy')
          callbacks.onVendorBuy(hit.item, Boolean(callbacks.isShiftClick))
        }
      }
      return true
    }
  }
  return true
}
export function drawLeftDockPanelImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  kind: Exclude<LeftDockPanelKind, 'none' | 'char'>,
  assets: {
    borderLeftImg: HTMLImageElement | null
    questBgImg: HTMLImageElement | null
    waypointBgImg: HTMLImageElement | null
    stashBgImg: HTMLImageElement | null
    cubeBgImg: HTMLImageElement | null
    vendorBgImg: HTMLImageElement | null
    vendorTabsImg?: HTMLImageElement | null
    buySellBtnImg: HTMLImageElement | null
    miniConvertImg?: HTMLImageElement | null
    questsAtlasImg?: HTMLImageElement | null
    questSocketsImg?: HTMLImageElement | null
    questLastImg?: HTMLImageElement | null
    scroinBgImg?: HTMLImageElement | null
    scroinRunesImg?: HTMLImageElement | null
    scroinGlowImg?: HTMLImageElement | null
    horadricBgImg?: HTMLImageElement | null
    upgradeBgImg?: HTMLImageElement | null
    invpsImg?: HTMLImageElement | null
    recipeScrollBgImg?: HTMLImageElement | null
    mercBgImg?: HTMLImageElement | null
    invArmorImg?: HTMLImageElement | null
    invHelmGloveImg?: HTMLImageElement | null
    invWeaponsImg?: HTMLImageElement | null
    partyBgImg?: HTMLImageElement | null
    partyButtonsImg?: HTMLImageElement | null
    partyBoxesImg?: HTMLImageElement | null
    partyBarImg?: HTMLImageElement | null
    nowMs?: number
    itemsAtlasImg?: HTMLImageElement | null
    waypointTabsImg?: HTMLImageElement | null
    waypointIconsImg?: HTMLImageElement | null
    questTabsImg?: HTMLImageElement | null
    inventory?: InventoryPanel | null
  },
  font: D2FontRenderer,
): void {
  // useitem.cpp windows draw only their inset + buttons (no border frame, no close button).
  if (isUseItemPanel(kind)) {
    this.renderActiveLeftPanel(ctx, kind, font, {
      horadricBgImg: assets.horadricBgImg,
      upgradeBgImg: assets.upgradeBgImg,
      buySellBtnImg: assets.buySellBtnImg,
      itemsAtlasImg: assets.itemsAtlasImg,
    })
    return
  }

  // 1. Left 800x600 Gothic Stone Border (`800BorderFrame.dc6` frames 0..4)
  if (assets.borderLeftImg) {
    ctx.drawImage(assets.borderLeftImg, 0, 0)
  }

  const ox = 80
  const oy = 60

  const isEn = this.lang === 'ENG'

  if (kind === 'quest') {
    if (assets.questBgImg) ctx.drawImage(assets.questBgImg, ox, oy)
    this.drawActTabs(
      ctx,
      ox,
      oy,
      font,
      assets.questTabsImg !== undefined ? assets.questTabsImg : this.getQuestTabsImage(),
    )

    const quests = getActQuests(this.selectedActTab)
    if (this.selectedQuestIdx >= quests.length) {
      this.selectedQuestIdx = -1
    }

    const atlas = this.assertValidUiImage(
      assets.questsAtlasImg !== undefined ? assets.questsAtlasImg : this.getQuestsAtlasImage(),
      'questsAtlasImg',
    )
    const questSocketsImg =
      assets.questSocketsImg !== undefined ? assets.questSocketsImg : this.getQuestSocketsImage()
    const questLastImg =
      assets.questLastImg !== undefined ? assets.questLastImg : this.getQuestLastImage()

    for (let i = 0; i < 6; i++) {
      // In Act 4, sockets 3, 4, 5 (indices 3, 4, 5) are unassigned
      if (i >= quests.length) {
        continue
      }
      const q = quests[i]!
      const status = this.getQuestStatus(q)
      const selected = this.selectedQuestIdx === i && status !== 'locked'

      const rectKey =
        status === 'completed'
          ? `${q.iconKey}_done`
          : selected && `${q.iconKey}_pressed` in BAKED_UI_MANIFEST.questRects
            ? `${q.iconKey}_pressed`
            : status === 'locked' && `${q.iconKey}_unstarted` in BAKED_UI_MANIFEST.questRects
              ? `${q.iconKey}_unstarted`
              : q.iconKey
      const rect = BAKED_UI_MANIFEST.questRects[rectKey]
      if (!rect) {
        throw new Error(`Missing quest icon sprite rect: ${rectKey}`)
      }
      // D2Client.dll 0x6facf2c1..0x6facf4e0: icon DC6 bottom-left anchored at slot table `0x6fba8100` (drawX, drawY).
      const icon = questIconTopLeft113c(i)
      ctx.drawImage(atlas, rect.x, rect.y, rect.w, rect.h, ox + icon.x, oy + icon.y, rect.w, rect.h)

      // D2Client.dll 0x6facf4f3..0x6facf558: questsockets.dc6 overlay drawn after the icon, 1px higher when selected.
      if (questSocketsImg) {
        const socketFrame = selected ? 1 : 0
        const sw = QUEST_SOCKET_DC6_FRAME.width
        const sh = QUEST_SOCKET_DC6_FRAME.height
        const socket = questSocketTopLeft113c(i, selected)
        ctx.drawImage(questSocketsImg, socketFrame * sw, 0, sw, sh, ox + socket.x, oy + socket.y, sw, sh)
      }
    }

    const activeQ = this.selectedQuestIdx >= 0 ? quests[this.selectedQuestIdx] : undefined
    if (activeQ) {
      // D2Client.dll 0x6facf589..0x6facf5e3 (Issue #1008): the A2Q6 True Tomb symbol (invps.dc6) is drawn
      // BEFORE the title / body text (0x6facf65d..0x6facf73a), with drawMode 3 (DRAWMODE_MODULATE).
      if (activeQ.id === 'a2q6' && this.hasServerQuestState) {
        const bitIdx = questFlagWordIndex(activeQ)
        const page = buildQuestLogPage({
          row: bitIdx,
          playerWords: this.serverQuestFlags,
          gameWords: this.serverGameQuestFlags,
          status: this.serverQuestStatusBytes[bitIdx] ?? 0,
          den: this.denMonstersRemaining,
          barbs: this.questBarbsRemaining,
        })
        const tombFrame = trueTombSymbolFrame113c(activeQ.id, page, this.tombOffset)
        if (tombFrame !== null) {
          const invpsImg = this.assertValidUiImage(
            assets.invpsImg !== undefined ? assets.invpsImg : this.getInvpsImage(),
            'invpsImg',
          )
          ctx.save()
          ctx.globalCompositeOperation = 'screen'
          ctx.drawImage(
            invpsImg,
            tombFrame * INVPS_FRAME_W,
            0,
            INVPS_FRAME_W,
            INVPS_FRAME_H,
            ox + INVPS_DRAW_REL_X,
            oy + INVPS_DRAW_REL_BOTTOM_Y - INVPS_FRAME_H,
            INVPS_FRAME_W,
            INVPS_FRAME_H,
          )
          ctx.restore()
        }
      }
      const qInfo = this.getQuestDisplayText(activeQ)
      font.drawText(ctx, qInfo.title, ox + 160, oy + 282, {
        font: 'fontexocet10',
        color: qInfo.status === 'completed' ? 'gold' : 'white',
        align: 'center',
      })
      this.drawWrappedText(ctx, font, qInfo.body, ox + 26, oy + 300, 268, 14, 6, 'fontformal12')
    }

    if (questLastImg) {
      const lastFrame = this.pressedQuestButton === 'speech' ? 1 : 0
      ctx.drawImage(questLastImg, lastFrame * 28, 0, 28, 31, ox + 226, oy + 387, 28, 31)
    }
    if (assets.buySellBtnImg) {
      const closeFrame = this.pressedCloseKind === 'quest' ? 11 : 10
      ctx.drawImage(assets.buySellBtnImg, closeFrame * 32, 0, 32, 32, ox + 278, oy + 386, 32, 32)
    }

    if (this.hoveredQuestButton === 'speech' || this.hoveredQuestButton === 'close') {
      const hoverText =
        this.hoveredQuestButton === 'speech'
          ? this.resolveCanonicalQuestStateText('strplaylast')
          : this.resolveCanonicalQuestStateText('strClose')
      const padX = BUTTON_HOVER_BOX_PAD_X
      const boxW = Math.max(BUTTON_HOVER_BOX_MIN_W, font.measureText(hoverText, 'font16') + padX * 2)
      const boxH = BUTTON_HOVER_BOX_H
      const boxX = this.hoveredQuestButton === 'speech' ? ox + 226 : ox + 278
      const boxY = oy + 386 - boxH
      ctx.fillStyle = STONE_BOX_BG_FILL
      ctx.fillRect(boxX, boxY, boxW, boxH)
      font.drawText(ctx, hoverText, boxX + padX, boxY + BUTTON_HOVER_TEXT_OFFSET_Y, {
        font: 'font16',
        color: 'white',
        align: 'left',
      })
    }
  } else if (kind === 'waypoint') {
    if (assets.waypointBgImg) ctx.drawImage(assets.waypointBgImg, ox, oy)
    this.drawActTabs(
      ctx,
      ox,
      oy,
      font,
      assets.waypointTabsImg !== undefined ? assets.waypointTabsImg : this.getWaypointTabsImage(),
    )
    const wps = getActWaypoints(this.selectedActTab)

    for (let i = 0; i < wps.length; i++) {
      const wp = wps[i]!
      const rowY = getWaypointRowOffsetY(i)
      const wy = oy + rowY
      const isHovered = this.hoveredWaypointIdx === i
      const isUnlocked = this.isWaypointUnlocked(wp)
      const isCurrent = isUnlocked && this.isCurrentWaypoint(wp)

      if (isUnlocked) {
        const waypointIconsImg = this.assertValidUiImage(
          assets.waypointIconsImg !== undefined ? assets.waypointIconsImg : this.getWaypointIconsImage(),
          'waypointIconsImg',
        )
        // 1.13c (issue #933): frames 1/4 are the pressed cells — shown only while the
        // row is held down; hovering keeps the raised icon and only brightens the label.
        const isPressed = this.pressedWaypointIdx === i
        const iconFrameIdx = isCurrent ? (isPressed ? 1 : 0) : (isPressed ? 4 : 3)
        const iconSx = iconFrameIdx * 30
        ctx.drawImage(waypointIconsImg, iconSx, 0, 30, 30, ox + 17, wy + 1, 30, 30)
      }

      const wpName = resolveWaypointName(wp.levelId, this.lang)
      font.drawText(ctx, wpName, ox + 80, oy + getWaypointTextOffsetY(i), {
        font: 'fontexocet10',
        color: isUnlocked ? (isHovered ? 'white' : 'gold') : 'gray',
      })
    }
  } else if (kind === 'stash') {
    if (assets.stashBgImg) ctx.drawImage(assets.stashBgImg, ox, oy)
    font.drawText(ctx, requireTbl('bank', this.lang), ox + 172, oy + 35, {
      font: 'font8',
      color: 'gold',
      align: 'center',
    })
    font.drawText(
      ctx,
      `${requireTbl('strGoldInStash', this.lang)} ${this.stashGold}`,
      ox + 160,
      oy + 61,
      {
        font: 'font8',
        color: 'white',
        align: 'center',
      },
    )

    if (this.stashDepositAllEnabled) drawStashDepositAllButton(ctx, font, ox, oy, this.lang === 'ENG' ? 'Deposit All' : '全部存入')

    // 6x8 grid cell borders
    for (let r = 0; r < STASH_GRID_ORIGIN.rows; r++) {
      for (let c = 0; c < STASH_GRID_ORIGIN.cols; c++) {
        const cx = STASH_GRID_ORIGIN.x + c * STASH_GRID_ORIGIN.cellPx
        const cy = STASH_GRID_ORIGIN.y + r * STASH_GRID_ORIGIN.cellPx
        ctx.strokeStyle = 'rgba(64, 52, 38, 0.4)'
        ctx.strokeRect(cx + 0.5, cy + 0.5, STASH_GRID_ORIGIN.cellPx - 1, STASH_GRID_ORIGIN.cellPx - 1)
      }
    }

    // Draw items stored in stash
    const playerCtx = this.getEffectivePlayerContext()
    const hasCursorItem = Boolean((assets.inventory ?? this.activePlayerInventory)?.cursorItem)
    const atlas =
      this.stashItems.length > 0
        ? this.assertValidUiImage(
            assets.itemsAtlasImg !== undefined ? assets.itemsAtlasImg : this.getItemsAtlasImage(),
            'itemsAtlasImg',
          )
        : (assets.itemsAtlasImg ?? null)
    for (const placed of this.stashItems) {
      const gx = STASH_GRID_ORIGIN.x + placed.col * STASH_GRID_ORIGIN.cellPx
      const gy = STASH_GRID_ORIGIN.y + placed.row * STASH_GRID_ORIGIN.cellPx
      const gw = placed.item.invWidth * STASH_GRID_ORIGIN.cellPx
      const gh = placed.item.invHeight * STASH_GRID_ORIGIN.cellPx
      const isHovered = this.hoveredStashItem?.item.id === placed.item.id

      ctx.fillStyle = resolveGridItemBackgroundFill(placed.item, playerCtx, {
        isHovered,
        hasCursorItem,
      })
      ctx.fillRect(gx + 1, gy + 1, gw - 2, gh - 2)

      const rect = resolveItemSpriteRect(placed.item, BAKED_UI_MANIFEST.itemRects)
      if (!rect) {
        throw new Error(`Missing item sprite rect for stash item: ${placed.item.code}`)
      }
      const scale = Math.min(gw / rect.w, gh / rect.h, 1)
      const dw = Math.round(rect.w * scale)
      const dh = Math.round(rect.h * scale)
      const dx = gx + Math.round((gw - dw) / 2)
      const dy = gy + Math.round((gh - dh) / 2)
      drawImageWithEtherealAlpha(ctx, isUiItemEthereal(placed.item), () => {
        ctx.drawImage(atlas!, rect.x, rect.y, rect.w, rect.h, dx, dy, dw, dh)
      })

      drawItemSocketOverlay(ctx, placed.item, gx, gy, gw, gh, {
        itemsAtlasImg: atlas,
        itemRects: BAKED_UI_MANIFEST.itemRects,
        isHovered,
      })
    }
  } else if (kind === 'cube') {
    if (assets.cubeBgImg) ctx.drawImage(assets.cubeBgImg, ox, oy)

    // 3x4 Horadric Cube grid cell borders (`Inventory.txt` Transmogrify Box1)
    for (let r = 0; r < CUBE_GRID_ORIGIN.rows; r++) {
      for (let c = 0; c < CUBE_GRID_ORIGIN.cols; c++) {
        const cx = CUBE_GRID_ORIGIN.x + c * CUBE_GRID_ORIGIN.cellPx
        const cy = CUBE_GRID_ORIGIN.y + r * CUBE_GRID_ORIGIN.cellPx
        ctx.strokeStyle = 'rgba(64, 52, 38, 0.4)'
        ctx.strokeRect(cx + 0.5, cy + 0.5, CUBE_GRID_ORIGIN.cellPx - 1, CUBE_GRID_ORIGIN.cellPx - 1)
      }
    }

    // Draw items stored in Horadric Cube
    const playerCtx = this.getEffectivePlayerContext()
    const hasCursorItem = Boolean((assets.inventory ?? this.activePlayerInventory)?.cursorItem)
    const atlas =
      this.cubeItems.length > 0
        ? this.assertValidUiImage(
            assets.itemsAtlasImg !== undefined ? assets.itemsAtlasImg : this.getItemsAtlasImage(),
            'itemsAtlasImg',
          )
        : (assets.itemsAtlasImg ?? null)
    for (const placed of this.cubeItems) {
      const gx = CUBE_GRID_ORIGIN.x + placed.col * CUBE_GRID_ORIGIN.cellPx
      const gy = CUBE_GRID_ORIGIN.y + placed.row * CUBE_GRID_ORIGIN.cellPx
      const gw = placed.item.invWidth * CUBE_GRID_ORIGIN.cellPx
      const gh = placed.item.invHeight * CUBE_GRID_ORIGIN.cellPx
      const isHovered = this.hoveredCubeItem?.item.id === placed.item.id

      ctx.fillStyle = resolveGridItemBackgroundFill(placed.item, playerCtx, {
        isHovered,
        hasCursorItem,
      })
      ctx.fillRect(gx + 1, gy + 1, gw - 2, gh - 2)

      const rect = resolveItemSpriteRect(placed.item, BAKED_UI_MANIFEST.itemRects)
      if (!rect) {
        throw new Error(`Missing item sprite rect for cube item: ${placed.item.code}`)
      }
      const scale = Math.min(gw / rect.w, gh / rect.h, 1)
      const dw = Math.round(rect.w * scale)
      const dh = Math.round(rect.h * scale)
      const dx = gx + Math.round((gw - dw) / 2)
      const dy = gy + Math.round((gh - dh) / 2)
      drawImageWithEtherealAlpha(ctx, isUiItemEthereal(placed.item), () => {
        ctx.drawImage(atlas!, rect.x, rect.y, rect.w, rect.h, dx, dy, dw, dh)
      })

      drawItemSocketOverlay(ctx, placed.item, gx, gy, gw, gh, {
        itemsAtlasImg: atlas,
        itemRects: BAKED_UI_MANIFEST.itemRects,
        isHovered,
      })
    }

    // D2Client.dll `0x6fb49615..0x6fb49656`: Cube Close button (`buysellbtn.dc6` frame 10 or 11 at `ox + 275, oy + 383`)
    if (assets.buySellBtnImg) {
      const closeFrame = this.pressedCloseKind === 'cube' ? 11 : 10
      ctx.drawImage(
        assets.buySellBtnImg,
        closeFrame * 32,
        0,
        32,
        32,
        ox + CUBE_CLOSE_BTN_BOUNDS.relX,
        oy + CUBE_CLOSE_BTN_BOUNDS.relY,
        CUBE_CLOSE_BTN_BOUNDS.w,
        CUBE_CLOSE_BTN_BOUNDS.h,
      )
    }

    // D2Client.dll `0x6fb49657..0x6fb49698`: Cube Transmute button (`miniconvert.dc6` frame 0 or 1 at `ox + 144, oy + 260`)
    const miniConvertImg = this.assertValidUiImage(
      assets.miniConvertImg !== undefined ? assets.miniConvertImg : this.getMiniConvertImage(),
      'miniConvertImg',
    )
    const transmuteFrame = this.pressedCubeButton === 'transmute' ? 1 : 0
    ctx.drawImage(
      miniConvertImg,
      transmuteFrame * 32,
      0,
      32,
      32,
      ox + CUBE_TRANSMUTE_BTN_BOUNDS.relX,
      oy + CUBE_TRANSMUTE_BTN_BOUNDS.relY,
      CUBE_TRANSMUTE_BTN_BOUNDS.w,
      CUBE_TRANSMUTE_BTN_BOUNDS.h,
    )

    // D2Client.dll `0x6fb49720..0x6fb497c8`: Centered framed hover tooltip (`改變`/`Transmute`, `關閉`/`Close` in Font16)
    if (this.hoveredCubeButton !== null) {
      const spec =
        this.hoveredCubeButton === 'transmute' ? CUBE_TRANSMUTE_BTN_BOUNDS : CUBE_CLOSE_BTN_BOUNDS
      const hoverText = requireTbl(spec.strIdx === 3341 ? 'strUiMenu2' : 'strClose', this.lang)
      const padX = BUTTON_HOVER_BOX_PAD_X
      const boxW = Math.max(BUTTON_HOVER_BOX_MIN_W, font.measureText(hoverText, 'font16') + padX * 2)
      const boxH = BUTTON_HOVER_BOX_H
      const centerX = ox + (spec.tooltipCenterX - CUBE_PANEL_ORIGIN.x)
      const anchorY = oy + (spec.tooltipAnchorY - CUBE_PANEL_ORIGIN.y)
      const boxX = Math.round(centerX - boxW / 2)
      const boxY = anchorY - boxH
      ctx.fillStyle = STONE_BOX_BG_FILL
      ctx.fillRect(boxX, boxY, boxW, boxH)
      font.drawText(ctx, hoverText, centerX, boxY + BUTTON_HOVER_TEXT_OFFSET_Y, {
        font: 'font16',
        color: 'white',
        align: 'center',
      })
    }
  } else if (kind === 'vendor') {
    if (!this.activeVendorDescriptor || this.activeVendorDescriptor.vendorId === null) {
      throw new Error('Cannot draw vendor panel without an active vendor descriptor')
    }
    if (!assets.vendorBgImg || !assets.vendorTabsImg || !assets.buySellBtnImg) {
      throw new Error('Missing required baked UI assets for vendor panel (vendorBgImg, vendorTabsImg, buySellBtnImg)')
    }

    // 1. D2Client.dll `0x6fb45c8a–0x6fb45d63`: `buysell.dc6` 320x432 stitched background
    ctx.drawImage(assets.vendorBgImg, ox, oy)

    // 2. D2Client.dll `0x6fb458a0..0x6fb45b58`: Items on the active store page (`Inventory.txt` Monster2 grid at `ox+16, oy+63`)
    const placements = this.getActiveVendorPlacements()
    const atlas =
      placements.length > 0
        ? this.assertValidUiImage(
            assets.itemsAtlasImg !== undefined ? assets.itemsAtlasImg : this.getItemsAtlasImage(),
            'itemsAtlasImg',
          )
        : (assets.itemsAtlasImg ?? null)
    const playerCtx = this.getEffectivePlayerContext()
    const hasCursorItem = Boolean((assets.inventory ?? this.activePlayerInventory)?.cursorItem)
    for (const placed of placements) {
      const gx = VENDOR_GRID_ORIGIN.x + placed.col * VENDOR_GRID_ORIGIN.cellPx
      const gy = VENDOR_GRID_ORIGIN.y + placed.row * VENDOR_GRID_ORIGIN.cellPx
      const gw = placed.item.invWidth * VENDOR_GRID_ORIGIN.cellPx
      const gh = placed.item.invHeight * VENDOR_GRID_ORIGIN.cellPx
      const isHovered = this.hoveredVendorItem?.item.id === placed.item.id

      ctx.fillStyle = resolveGridItemBackgroundFill(placed.item, playerCtx, {
        isHovered,
        hasCursorItem,
        vendorMode: this.vendorMode,
      })
      ctx.fillRect(gx + 1, gy + 1, gw - 2, gh - 2)

      const rect = resolveItemSpriteRect(placed.item, BAKED_UI_MANIFEST.itemRects)
      if (!rect) {
        throw new Error(`Missing item sprite rect for vendor item: ${placed.item.code}`)
      }
      const scale = Math.min(gw / rect.w, gh / rect.h, 1)
      const dw = Math.round(rect.w * scale)
      const dh = Math.round(rect.h * scale)
      const dx = gx + Math.round((gw - dw) / 2)
      const dy = gy + Math.round((gh - dh) / 2)
      drawImageWithEtherealAlpha(ctx, isUiItemEthereal(placed.item), () => {
        ctx.drawImage(atlas!, rect.x, rect.y, rect.w, rect.h, dx, dy, dw, dh)
      })

      drawItemSocketOverlay(ctx, placed.item, gx, gy, gw, gh, {
        itemsAtlasImg: atlas,
        itemRects: BAKED_UI_MANIFEST.itemRects,
        isHovered,
      })
    }

    // 3. D2Client.dll `0x6fb45df1–0x6fb45e51`: 4 button slots (`buysellbtn.dc6` at `ox + tableX - 1`, `oy + 385`)
    const btnLayout = resolveVendorButtonLayout(this.activeVendorDescriptor.hcIdx, this.vendorMode)
    for (let slot = 0 as 0 | 1 | 2 | 3; slot < 4; slot = (slot + 1) as 0 | 1 | 2 | 3) {
      const frameIdx = this.getVendorButtonFrame(slot, btnLayout)
      const drawX = ox + VENDOR_BUTTON_TABLE_X[slot]! - 1
      const drawY = oy + VENDOR_BUTTON_DRAW_Y
      ctx.drawImage(assets.buySellBtnImg, frameIdx * 32, 0, 32, 32, drawX, drawY, 32, 32)
    }

    // 4. D2Client.dll `0x6fb45e5e–0x6fb45f5d`: `buyselltabs.dc6` present tabs + Font16 `.tbl` labels (skipped in gamble mode)
    if (this.vendorMode !== 'gamble') {
      for (const tab of VENDOR_TABS) {
        if (!this.isVendorTabPresent(tab.id)) continue
        const selected = this.activeVendorTab === tab.id
        const frameIdx = selected ? tab.index : tab.index + 4
        ctx.drawImage(assets.vendorTabsImg, frameIdx * 79, 0, 79, 31, ox + tab.xOffset, oy, 79, 31)
        if (this.vendorMode === 'trade') {
          font.drawText(ctx, requireTbl(tab.tblKey, this.lang), ox + tab.centerX, oy + tab.textY, {
            font: 'font16',
            color: selected ? 'gold' : 'white',
            align: 'center',
          })
        }
      }
    }

    // 5. D2Client.dll `0x6fb494c5` -> `0x6fb3cfb0(2)` (`0x6fb3d00e..0x6fb3d0da`, `0x6fb3d25d..0x6fb3d2a0`):
    //    Bottom-left recessed box (`relX 17..200, relY 359..375`) displays Stash Gold (`strIdx 0xcf3` `'stash'`
    //    left-aligned at `ox + 21` and `STAT_GOLDBANK` right-aligned at `ox + 198`), or temporary status toast.
    if (this.vendorStatusMsg && performance.now() < this.vendorStatusMsg.untilMs) {
      font.drawText(
        ctx,
        this.vendorStatusMsg.text,
        ox + VENDOR_STATUS_TEXT_POS.relX,
        oy + VENDOR_STATUS_TEXT_POS.relY,
        {
          font: 'font8',
          color: this.vendorStatusMsg.color,
          align: 'center',
        },
      )
    } else {
      font.drawText(
        ctx,
        requireTbl('stash', this.lang),
        ox + VENDOR_GOLD_BOX_RECESS.labelRelX,
        oy + VENDOR_GOLD_BOX_RECESS.textRelY,
        {
          font: 'font8',
          color: 'white',
          align: 'left',
        },
      )
      font.drawText(
        ctx,
        String(Math.floor(Math.max(0, this.stashGold))),
        ox + VENDOR_GOLD_BOX_RECESS.amountRightRelX,
        oy + VENDOR_GOLD_BOX_RECESS.textRelY,
        {
          font: 'font8',
          color: 'white',
          align: 'right',
        },
      )
    }

    // 6. D2Client.dll `0x6fb3f260` -> D2Win #10085 (`0x6f8f33a0`): Left-anchored framed button hover text
    if (this.hoveredVendorButtonSlot !== null) {
      const slot = this.hoveredVendorButtonSlot
      const btnKind = btnLayout[slot]!
      const spec = VENDOR_BUTTON_SPECS[btnKind]
      if (spec.enabled) {
        const hoverText =
          btnKind === 'repairAll'
            ? requireTbl('patchstring#95', this.lang).replace('%d', String(this.requireRepairAllCost()))
            : spec.tblKey
              ? requireTbl(spec.tblKey, this.lang)
              : isEn
                ? spec.labelEn
                : spec.labelZh
        const padX = BUTTON_HOVER_BOX_PAD_X
        const boxW = Math.max(BUTTON_HOVER_BOX_MIN_W, font.measureText(hoverText, 'font16') + padX * 2)
        const boxH = BUTTON_HOVER_BOX_H
        const boxX = ox + VENDOR_BUTTON_TABLE_X[slot]!
        const boxY = oy + VENDOR_BUTTON_HOVER_ANCHOR_Y - boxH
        ctx.fillStyle = STONE_BOX_BG_FILL
        ctx.fillRect(boxX, boxY, boxW, boxH)
        font.drawText(ctx, hoverText, boxX + padX, boxY + BUTTON_HOVER_TEXT_OFFSET_Y, {
          font: 'font16',
          color: 'white',
          align: 'left',
        })
      }
    }
  } else if (kind === 'barkscroll') {
    // D2Client.dll `0x6fb2cc60` (`BARKSCROLL_Draw`):
    // 1. 4-frame stitched `scroin.dc6` background at `(ox, oy)` (`320x432`).
    const scroinBgImg =
      assets.scroinBgImg !== undefined ? assets.scroinBgImg : this.getScroinBgImage()
    if (scroinBgImg) {
      ctx.drawImage(scroinBgImg, ox, oy)
    }
    // 2. 5 rune numbers (`scroin2.dc6` frames 0..4, 40x25 strip) at `BARKSCROLL_RUNE_POS[0..4]`.
    const scroinRunesImg =
      assets.scroinRunesImg !== undefined ? assets.scroinRunesImg : this.getScroinRunesImage()
    if (scroinRunesImg) {
      for (let i = 0; i < 5; i++) {
        const pos = BARKSCROLL_RUNE_POS[i]!
        ctx.drawImage(scroinRunesImg, i * 40, 0, 40, 25, ox + pos.x, oy + pos.y - 25, 40, 25)
      }
    }
    // 3. If deciphered (`bkd`), advance 25fps animation (`0x6fbd15ac`) and draw glowing Cairn Stone order (`scroin3.dc6`).
    if (this.barkscrollDeciphered) {
      const now = assets.nowMs ?? (typeof performance !== 'undefined' ? performance.now() : Date.now())
      if (this.barkscrollLastTickMs === null) {
        this.barkscrollLastTickMs = now
      } else if (now - this.barkscrollLastTickMs >= 40) {
        const steps = Math.min(10, Math.floor((now - this.barkscrollLastTickMs) / 40))
        this.barkscrollLastTickMs += steps * 40
        this.barkscrollAnimFrame += steps
        if (this.barkscrollAnimFrame > 118) {
          this.barkscrollAnimFrame = 0
        }
      }
      const scroinGlowImg =
        assets.scroinGlowImg !== undefined ? assets.scroinGlowImg : this.getScroinGlowImage()
      const order = this.cairnStoneOrder ?? [0, 1, 2, 3, 4]
      if (scroinGlowImg) {
        for (let stepIdx = 0; stepIdx < 5; stepIdx++) {
          const threshold = BARKSCROLL_STEP_THRESHOLDS[stepIdx]!
          if (this.barkscrollAnimFrame > threshold) {
            const stoneIdx = Math.max(0, Math.min(4, order[stepIdx] ?? stepIdx))
            const glowPos = BARKSCROLL_GLOW_POS[stoneIdx]!
            let delta = this.barkscrollAnimFrame - threshold
            if (delta > 20) delta = 20
            ctx.drawImage(
              scroinGlowImg,
              (delta - 1) * 120,
              0,
              120,
              160,
              ox + glowPos.x - 150,
              oy + glowPos.y - 88,
              120,
              160,
            )
          }
        }
      }
    }
    // 4. Close button (`buysellbtn.dc6` frame 10 at `ox + 277, oy + 387`, per `0x6fb2cdc4`;
    //    frame 11 depressed while held down, 1.13c mouse driver semantics).
    if (assets.buySellBtnImg) {
      const closeFrame = this.pressedCloseKind === 'barkscroll' ? 11 : 10
      ctx.drawImage(assets.buySellBtnImg, closeFrame * 32, 0, 32, 32, ox + 277, oy + 387, 32, 32)
    }
  } else if (kind === 'recipescroll') {
    // D2Client.dll 0x6fb3e770 (UI_DrawRecipeScroll):
    // 1. Background `recipescroll.dc6` (320x432) at (ox, oy).
    const recipeScrollBgImg =
      assets.recipeScrollBgImg !== undefined
        ? assets.recipeScrollBgImg
        : this.getRecipeScrollBgImage()
    if (recipeScrollBgImg) {
      ctx.drawImage(recipeScrollBgImg, ox, oy)
    }
    // 2. Scroll text (`a2q2scroll`, string ID 3396) in fontformal12 at (ox + 64, oy + 120)
    const scrollText = (
      this.recipeScrollText ||
      this.lookupQuestString('a2q2scroll', this.lang) ||
      this.resolveCanonicalQuestStateText('A2Q2EarlyReturnScrollCain', this.lang)
    )
      .replace(/^\d+\r?\n/, '')
      .trim()
    this.drawWrappedText(ctx, font, scrollText, ox + 64, oy + 120, 192, 16, 10, 'fontformal12')
    // 3. Close button (`buysellbtn.dc6` frame 10 at `ox + 148, oy + 368` per `0x6fb3e846`;
    //    frame 11 depressed while held down, 1.13c mouse driver semantics)
    if (assets.buySellBtnImg) {
      const closeFrame = this.pressedCloseKind === 'recipescroll-center' ? 11 : 10
      ctx.drawImage(assets.buySellBtnImg, closeFrame * 32, 0, 32, 32, ox + 148, oy + 368, 32, 32)
    }
  } else if (kind === 'merc') {
    this.drawMercenaryPanel(ctx, ox, oy, font, {
      mercBgImg: assets.mercBgImg,
      invArmorImg: assets.invArmorImg,
      invHelmGloveImg: assets.invHelmGloveImg,
      invWeaponsImg: assets.invWeaponsImg,
      buySellBtnImg: assets.buySellBtnImg,
      itemsAtlasImg: assets.itemsAtlasImg,
      inventory: assets.inventory,
    })
  } else if (kind === 'party') {
    this.drawPartyPanel(ctx, ox, oy, font, {
      partyBgImg: assets.partyBgImg,
      partyButtonsImg: assets.partyButtonsImg,
      partyBoxesImg: assets.partyBoxesImg,
      partyBarImg: assets.partyBarImg,
      buySellBtnImg: assets.buySellBtnImg,
    })
  } else if (
    kind === 'hire' ||
    kind === 'trade' ||
    kind === 'msg'
  ) {
    this.renderActiveLeftPanel(ctx, kind, font, {
      buySellBtnImg: assets.buySellBtnImg,
    })
  }

    if (
      kind !== 'vendor' &&
      kind !== 'cube' &&
      kind !== 'quest' &&
      kind !== 'barkscroll' &&
      kind !== 'recipescroll' &&
      kind !== 'merc' &&
      kind !== 'msg' &&
      kind !== 'party' &&
      assets.buySellBtnImg
    ) {
      // Generic close `X` (stash / waypoint): frame 11 depressed while held down.
      const closeFrame = this.pressedCloseKind === kind ? 11 : 10
      ctx.drawImage(assets.buySellBtnImg, closeFrame * 32, 0, 32, 32, ox + 272, oy + 388, 32, 32)
    }

    if (kind === 'stash' && this.hoveredStashButton !== null) {
      const isGold = this.hoveredStashButton === 'gold'
      const hoverText = requireTbl(isGold ? 'strBankGoldWithdraw' : 'strClose', this.lang)
      const padX = BUTTON_HOVER_BOX_PAD_X
      const boxW = Math.max(BUTTON_HOVER_BOX_MIN_W, font.measureText(hoverText, 'font16') + padX * 2)
      const boxH = BUTTON_HOVER_BOX_H
      const centerX = isGold ? ox + 111 : ox + 288
      const anchorY = isGold ? oy + 22 : oy + 384
      const boxX = Math.round(centerX - boxW / 2)
      const boxY = anchorY - boxH
      ctx.fillStyle = STONE_BOX_BG_FILL
      ctx.fillRect(boxX, boxY, boxW, boxH)
      font.drawText(ctx, hoverText, centerX, boxY + BUTTON_HOVER_TEXT_OFFSET_Y, {
        font: 'font16',
        color: 'white',
        align: 'center',
      })
    } else if (kind === 'waypoint' && this.hoveredWaypointClose) {
      const hoverText = requireTbl('strClose', this.lang)
      const padX = BUTTON_HOVER_BOX_PAD_X
      const boxW = Math.max(BUTTON_HOVER_BOX_MIN_W, font.measureText(hoverText, 'font16') + padX * 2)
      const boxH = BUTTON_HOVER_BOX_H
      const centerX = ox + 288
      const anchorY = oy + 384
      const boxX = Math.round(centerX - boxW / 2)
      const boxY = anchorY - boxH
      ctx.fillStyle = STONE_BOX_BG_FILL
      ctx.fillRect(boxX, boxY, boxW, boxH)
      font.drawText(ctx, hoverText, centerX, boxY + BUTTON_HOVER_TEXT_OFFSET_Y, {
        font: 'font16',
        color: 'white',
        align: 'center',
      })
    }
}
export function drawActTabsImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  _font: D2FontRenderer,
  tabsImg?: HTMLImageElement | null,
): void {
  const validTabsImg = this.assertValidUiImage(tabsImg, 'actTabsImg')
  // 1.13c (issue #933): only acts reached in this difficulty get a tab; clamp the
  // selection so a stale `selectedActTab` never points at a hidden tab.
  const visibleCount = this.visibleActTabCount()
  if (this.selectedActTab > visibleCount) {
    this.selectedActTab = visibleCount
    this.selectedQuestIdx = -1
  }
  for (let i = 0; i < visibleCount; i++) {
    const act = i + 1
    const active = this.selectedActTab === act
    const frameIdx = active ? i * 2 : i * 2 + 1
    const sx = frameIdx * ACT_TAB_LAYOUT.frameWidth
    const tx = ox + ACT_TAB_LAYOUT.startXOffset + i * ACT_TAB_LAYOUT.strideX
    ctx.drawImage(
      validTabsImg,
      sx,
      0,
      ACT_TAB_LAYOUT.frameWidth,
      ACT_TAB_LAYOUT.height,
      tx,
      oy + ACT_TAB_LAYOUT.topYOffset,
      ACT_TAB_LAYOUT.frameWidth,
      ACT_TAB_LAYOUT.height,
    )
  }
}
export function drawWrappedTextImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  font: D2FontRenderer,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines = 10,
  fontName: 'fontformal12' | 'font8' = 'fontformal12',
): void {
  const paragraphs = text.split(/\r?\n/)
  let curY = y
  let linesDrawn = 0

  for (const p of paragraphs) {
    if (linesDrawn >= maxLines) break
    const rawTokens = p.match(/\s*[\x21-\xff]+|\s*[^\s\x21-\xff]/g) ?? []
    let line = ''
    for (const rawToken of rawTokens) {
      const trimmed = rawToken.trimStart()
      const candidate = line ? `${line}${rawToken.startsWith(' ') ? ' ' : ''}${trimmed}` : trimmed
      if (line && font.measureText(candidate, fontName) > maxW) {
        if (linesDrawn + 1 >= maxLines) {
          const truncated = line.slice(0, Math.max(0, line.length - 2)) + '...'
          font.drawText(ctx, truncated, x, curY, { font: fontName, color: 'white' })
          return
        }
        font.drawText(ctx, line, x, curY, { font: fontName, color: 'white' })
        linesDrawn++
        curY += lineH
        line = trimmed
      } else {
        line = candidate
      }
      while (line && font.measureText(line, fontName) > maxW && line.length > 1) {
        let splitIdx = 1
        while (splitIdx < line.length && font.measureText(line.slice(0, splitIdx + 1), fontName) <= maxW) {
          splitIdx++
        }
        if (linesDrawn + 1 >= maxLines) {
          const truncated = line.slice(0, Math.max(1, splitIdx - 2)) + '...'
          font.drawText(ctx, truncated, x, curY, { font: fontName, color: 'white' })
          return
        }
        font.drawText(ctx, line.slice(0, splitIdx), x, curY, { font: fontName, color: 'white' })
        linesDrawn++
        curY += lineH
        line = line.slice(splitIdx)
      }
    }
    if (line && linesDrawn < maxLines) {
      font.drawText(ctx, line, x, curY, { font: fontName, color: 'white' })
      linesDrawn++
      curY += lineH
    }
  }
}
/**
 * D2Client.dll `useitem.cpp` draw (`0x6fb4f460` + item `0x6fb4fb00`), see {@link USE_ITEM_LAYOUT}.
 * Coordinates are absolute (left-dock local) screen coordinates.
 */
export function drawUseItemPanelImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  panel: UseItemPanelKind,
  fontRenderer: D2FontRenderer | null | undefined,
  assets:
    | {
        horadricBgImg?: HTMLImageElement | null | undefined
        upgradeBgImg?: HTMLImageElement | null | undefined
        buySellBtnImg?: HTMLImageElement | null | undefined
        itemsAtlasImg?: HTMLImageElement | null | undefined
      }
    | undefined,
): void {
  if (!fontRenderer) throw new Error(`useitem panel '${panel}' requires a D2FontRenderer (font16)`)
  const L = USE_ITEM_LAYOUT

  // 1. Inset: menu\horadricback (mode 0) or menu\upgrade (mode 1), bottom-left anchored at (105, 270).
  const insetImg = this.assertValidUiImage(
    panel === 'orifice'
      ? assets?.horadricBgImg !== undefined
        ? assets.horadricBgImg
        : this.getHoradricBgImage()
      : assets?.upgradeBgImg !== undefined
        ? assets.upgradeBgImg
        : this.getUpgradeBgImage(),
    panel === 'orifice' ? 'horadricBgImg' : 'upgradeBgImg',
  )
  ctx.drawImage(insetImg, L.inset.x, L.inset.bottomY - L.inset.height, L.inset.width, L.inset.height)

  // 2. buysellbtn buttons (frame 16 checkmark / frame 10 close, +1 while pressed).
  const btnImg = this.assertValidUiImage(
    assets?.buySellBtnImg !== undefined ? assets.buySellBtnImg : this.getBuySellBtnImage(),
    'buySellBtnImg',
  )
  for (let i = 0; i < L.buttons.length; i++) {
    const b = L.buttons[i]!
    const frame = b.frame + (this.pressedUseItemButton === i ? 1 : 0)
    ctx.drawImage(btnImg, frame * 32, 0, 32, 32, b.drawX, b.drawY - 32, 32, 32)
  }

  // 3. Button hover label (D2GFX #10014 TRANS75 black box + font16 white text).
  const hovered = this.hoveredUseItemButton
  if (hovered !== null) {
    const b = L.buttons[hovered]!
    const label = requireTbl(USE_ITEM_BUTTON_TBL[panel][hovered], this.lang)
    const meta = fontRenderer.getFontMeta('font16')
    if (!meta) throw new Error('useitem button label requires font16 metrics (D2Win #10083 nHeight)')
    const w = fontRenderer.measureText(label, 'font16')
    const half = Math.trunc(w / 2)
    const x1 = b.drawX - half + 10
    const y1 = b.drawY - meta.lineHeight - 42
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.fillRect(x1, y1, w + 12, meta.lineHeight + 6)
    fontRenderer.drawText(ctx, label, b.drawX - half + 16, b.drawY - 38, { font: 'font16', color: 'white' })
  }

  // 4. Mode-1 instruction text (Charsi / Larzuk / Anya), font16 gold, wrapped at 300 px.
  if (panel !== 'orifice') {
    const text = requireTbl(USE_ITEM_INSTRUCTION_TBL[panel], this.lang)
    const lines = wrapUseItemText(fontRenderer, text, L.text.wrapWidth)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const w = fontRenderer.measureText(line, 'font16')
      fontRenderer.drawText(ctx, line, L.text.centerX - Math.trunc(w / 2), L.text.firstBaselineY + i * L.text.lineStep, {
        font: 'font16',
        color: 'gold',
      })
    }
  }

  // 5. Placed item, drawn 1:1 at x = 167 - (w >> 1), y = 106 + (h < 112 ? (114 - h) >> 1 : 0).
  const item = this.questRewardItem
  if (item) {
    const rect = resolveItemSpriteRect(item, BAKED_UI_MANIFEST.itemRects)
    if (!rect) throw new Error(`useitem panel: no baked inventory sprite for item code '${item.code}'`)
    const atlasImg = this.assertValidUiImage(
      assets?.itemsAtlasImg !== undefined ? assets.itemsAtlasImg : this.getItemsAtlasImage(),
      'itemsAtlasImg',
    )
    const dx = L.item.centerX - (rect.w >> 1)
    const dy = L.item.top + (rect.h < L.item.tallThreshold ? (L.item.boxH - rect.h) >> 1 : 0)
    drawImageWithEtherealAlpha(ctx, isUiItemEthereal(item), () => {
      ctx.drawImage(atlasImg, rect.x, rect.y, rect.w, rect.h, dx, dy, rect.w, rect.h)
    })
    drawItemSocketOverlay(ctx, item, dx, dy, rect.w, rect.h, {
      itemsAtlasImg: atlasImg,
      itemRects: BAKED_UI_MANIFEST.itemRects,
      isHovered: this.hoveredQuestRewardItem?.item.id === item.id,
    })
  }
}
/**
 * Render left-side panels (`merc`, `hire`, `party`, `trade`, `imbue`, `add_sockets`, `personalize`, `orifice`).
 */
export function renderActiveLeftPanelImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  panelOverride?: WorldPanelType,
  fontRenderer?: D2FontRenderer | null,
  assets?: {
    borderLeftImg?: HTMLImageElement | null | undefined
    boxPiecesImg?: HTMLImageElement | null | undefined
    focus16Img?: HTMLImageElement | null | undefined
    textSlidImg?: HTMLImageElement | null | undefined
    horadricBgImg?: HTMLImageElement | null | undefined
    upgradeBgImg?: HTMLImageElement | null | undefined
    buySellBtnImg?: HTMLImageElement | null | undefined
    mercBgImg?: HTMLImageElement | null | undefined
    invArmorImg?: HTMLImageElement | null | undefined
    invHelmGloveImg?: HTMLImageElement | null | undefined
    invWeaponsImg?: HTMLImageElement | null | undefined
    tradeBgImg?: HTMLImageElement | null | undefined
    tradeBtnImg?: HTMLImageElement | null | undefined
    goldCoinBtnImg?: HTMLImageElement | null | undefined
    partyBgImg?: HTMLImageElement | null | undefined
    partyButtonsImg?: HTMLImageElement | null | undefined
    partyBoxesImg?: HTMLImageElement | null | undefined
    partyBarImg?: HTMLImageElement | null | undefined
    itemsAtlasImg?: HTMLImageElement | null | undefined
    inventory?: InventoryPanel | null | undefined
  },
  screenWidth: number = this.viewportWidth,
  screenHeight: number = this.viewportHeight,
): void {
  const panel = panelOverride ?? this._activePanel
  if (panel === 'none') return

  if (panel === 'hire') {
    this.drawHireMercDialog(ctx, fontRenderer, assets, screenWidth, screenHeight)
    return
  }

  if (panel === 'merc') {
    const ox = screenWidth <= 640 ? 0 : 80
    const oy = screenWidth <= 640 ? 0 : 60
    this.drawMercenaryPanel(ctx, ox, oy, fontRenderer, assets)
    return
  }

  if (panel === 'trade') {
    const ox = screenWidth <= 640 ? 0 : 80
    const oy = screenWidth <= 640 ? 0 : 60
    this.drawTradePanel(ctx, ox, oy, fontRenderer, assets, screenWidth, screenHeight)
    return
  }

  if (panel === 'party') {
    const ox = screenWidth <= 640 ? 0 : 80
    const oy = screenWidth <= 640 ? 0 : 60
    this.drawPartyPanel(ctx, ox, oy, fontRenderer, assets)
    return
  }

  if (panel === 'msg') {
    // D2Client.dll 0x6fb2c770 (`MSG_OpenMessageLog`) + 0x6fb53840 (`D2Dialog_Draw`) + 0x6fb17fd0 (`D2TextSlid_Draw`):
    // - Outer D2Dialog stone frame: `x = 5, y = 30, w = screenWidth - 20, h = screenHeight - 130`
    // - Line 0 Title: `.tbl` `0x0FC3` ("Message Log" / "訊息紀錄") centered at `y = 30 + 21 = 51` in `font16` gold (`color = 4`)
    // - Inner D2TextSlid box: `x = 5, y = 65, w = screenWidth - 20, h = screenHeight - 200`
    //   - Text entries wrapped to `boxW - 50` in `font16`, drawn at `x = 5 + 32 = 37`, baseline `y = 65 + 25 + i * 16`
    //   - Scrollbar (`textslid.dc6`): `sliderX = boxX + boxW - 18`, `sliderTopY = boxY + 3` (`68`)
    // - Line 1 Close: `.tbl` `0x1030` ("Close" / "關閉") centered at `y = 51 + (screenHeight - 165) = screenHeight - 114`
    //   in `font16`, `'blue'` (`3`) when hovered else `'white'` (`0`).
    const frameX = 5
    const frameY = 30
    const frameW = Math.max(320, screenWidth - 20)
    const frameH = Math.max(240, screenHeight - 130)
    const boxX = 5
    const boxY = 65
    const boxW = frameW
    const boxH = Math.max(160, screenHeight - 200)
    const isEn = this.lang === 'ENG' || this.language === 'en'

    const boxPiecesImg =
      assets && assets.boxPiecesImg !== undefined ? assets.boxPiecesImg : this.getBoxPiecesImage()
    const textSlidImg =
      assets && assets.textSlidImg !== undefined ? assets.textSlidImg : this.getTextSlidImage()

    if (boxPiecesImg) {
      drawStoneBoxFrame(ctx, frameX, frameY, frameW, frameH, boxPiecesImg, true)
      drawStoneBoxFrame(ctx, boxX, boxY, boxW, boxH, boxPiecesImg, false)
    } else {
      ctx.fillStyle = STONE_BOX_BG_FILL
      ctx.fillRect(frameX + 1, frameY, frameW - 2, frameH - 2)
      ctx.strokeStyle = '#6c5838'
      ctx.strokeRect(frameX, frameY, frameW, frameH)
      ctx.strokeRect(boxX, boxY, boxW, boxH)
    }

    const header =
      resolveChatTblIndex(0x0fc3, this.lang) ||
      lookupTbl('strpanel7', this.lang) ||
      (isEn ? 'Message Log' : '訊息紀錄')
    const closeLabel =
      resolveChatTblIndex(0x1030, this.lang) ||
      lookupTbl('strClose', this.lang) ||
      (isEn ? 'Close' : '關閉')
    const font = fontRenderer ?? this.font ?? this.defaultFont

    const drawMsgText = (
      text: string,
      x: number,
      y: number,
      colorCode: D2ColorCode = 'gold',
      align: 'left' | 'center' | 'right' = 'left',
    ) => {
      if (font && typeof font.drawText === 'function') {
        font.drawText(ctx, text, x, y, {
          font: 'font16',
          color: colorCode,
          align,
          lang: isEn ? 'ENG' : 'CHI',
        })
      } else if (typeof ctx.fillText === 'function') {
        ctx.fillText(text, x, y)
      }
    }

    const centerX = frameX + Math.floor(frameW / 2)
    drawMsgText(header, centerX, frameY + 21, 'gold', 'center')

    const maxWrapW = Math.max(160, boxW - 50)
    const measureFn = (s: string) =>
      font && typeof font.measureText === 'function' ? font.measureText(s, 'font16') : s.length * 8
    const allLines: WrappedChatLine113c[] = []
    for (const entry of this.messageLogEntries) {
      const wrapped = wrapChatText113c(entry.text, measureFn, maxWrapW, entry.color ?? 0)
      for (const wLine of wrapped) {
        allLines.push(wLine)
      }
    }

    // D2Client.dll 0x6fb17b4c (`D2TextSlid_RecalcThumb`): `visibleLines = (boxH - 32) / 16`
    const maxVisible = Math.max(1, Math.floor((boxH - 32) / 16))
    const maxOffset = Math.max(0, allLines.length - maxVisible)
    const clampedOffset = Math.max(0, Math.min(maxOffset, this.messageLogScrollOffset))
    const startIdx = Math.max(0, allLines.length - maxVisible - clampedOffset)
    const visibleSlice = allLines.slice(startIdx, startIdx + maxVisible)

    const textX = boxX + 32
    const firstLineBaselineY = boxY + 25
    for (let i = 0; i < visibleSlice.length; i++) {
      const line = visibleSlice[i]!
      const colorName = (D2_COLOR_INDEX_TO_NAME[line.color] ?? 'white') as D2ColorCode
      drawMsgText(line.text, textX, firstLineBaselineY + i * 16, colorName, 'left')
    }

    // D2Client.dll 0x6fb18012..0x6fb18181 (`D2TextSlid_Draw` scrollbar using `textslid.dc6`):
    const sliderX = boxX + boxW - 18
    const sliderTopY = boxY + 3
    const trackSegments = Math.max(1, Math.floor((boxH - 16) / 12) - 1)
    if (textSlidImg) {
      const fw = 12
      const fh = 13
      const drawSliderFrame = (frameIdx: number, dx: number, dy: number) => {
        ctx.drawImage(textSlidImg, frameIdx * fw, 0, fw, fh, dx, dy, fw, fh)
      }
      drawSliderFrame(9, sliderX, sliderTopY)
      for (let i = 0; i < trackSegments; i++) {
        drawSliderFrame(13, sliderX, sliderTopY + 12 + i * 12)
      }
      drawSliderFrame(8, sliderX, sliderTopY + 12 + trackSegments * 12)
      if (allLines.length > maxVisible) {
        const thumbMaxYOffset = Math.max(0, (trackSegments - 3) * 12)
        const thumbRatio = maxOffset > 0 ? startIdx / maxOffset : 1
        const thumbY = sliderTopY + 12 + Math.round(thumbRatio * thumbMaxYOffset)
        drawSliderFrame(16, sliderX - 1, thumbY)
        drawSliderFrame(14, sliderX - 1, thumbY + 12)
        drawSliderFrame(15, sliderX - 1, thumbY + 24)
      }
    }

    // D2Client.dll 0x6fb2c801..0x6fb2c82c & 0x6fb2c8d8: Line 1 "Close" (`0x1030`) at `y = screenHeight - 114`
    const closeY = frameY + 21 + (screenHeight - 165)
    const closeColor: D2ColorCode = this.messageLogCloseHovered ? 'blue' : 'white'
    drawMsgText(closeLabel, centerX, closeY, closeColor, 'center')
    return
  }

  if (isUseItemPanel(panel)) {
    this.drawUseItemPanel(ctx, panel, fontRenderer, assets)
    return
  }
}
