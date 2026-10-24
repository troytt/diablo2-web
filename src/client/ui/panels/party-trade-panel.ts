import type { WorldPanelsHud } from '../world-panels.ts'
import { D2FontRenderer, type D2ColorCode } from '../font.ts'
import {
  computeCursorItemGridPlacement,
  getInventoryLayout,
  resolveGridItemBackgroundFill,
  type InventoryPanel,
  type UiInventoryItem,
} from '../inventory.ts'
import { lookupTbl, requireTbl, type TblLang } from '../../i18n/lang.ts'
import { CANONICAL_LEVEL_LIGHTING } from '../../../common/world/levels-meta.ts'
import { reportMissingArt } from '../../scene/world-renderer.ts'
import { STONE_BOX_BG_FILL, BUTTON_HOVER_BOX_PAD_X, BUTTON_HOVER_BOX_MIN_W, isUseItemPanel, hitTestUseItemButton, hitTestUseItemSlot, isEligibleArtisanItem } from './panel-layout-constants.ts'
import { CANONICAL_WAYPOINT_CHI_TBL_SUPPLEMENT, CANONICAL_WAYPOINT_ENG_TBL_SUPPLEMENT } from './quest-waypoint-data.ts'
import { drawStoneBoxFrame } from './npc-dialog-menu.ts'

/**
 * Diablo II v1.13c Party Screen (`D2Client.dll` `PARTY_DrawPartyScreen` @ `0x6fb27250`) layout constants.
 * Relative to panel origin `(ox, oy)` (`(80, 60)` in 800x600 dock space, `(0, 0)` in 640x480):
 * - Background (`data/global/ui/MENU/party.dc6` -> `public/ui/party-bg.png`): `320x432` at `(ox, oy)`
 * - Close button (`0x6fb26050` & `0x6fb27278`, `buysellbtn.dc6` frames 10/11): `(ox + 278, oy + 389)`, `32x32` (`[ox+0x116..0x136, oy+0x185..0x1a5]`)
 * - Local player header (`0x6fb260f0` / `0x6fb263c0`): name centered at `ox + 105` (`[ox + 20..ox + 191]`), `oy + 29`; level & class at `oy + 48`
 * - Top "Leave Party" button (`0x6fb255d0`, `partybuttons.dc6` 53x20): `(ox + 227, oy + 15)` (`bottom = oy + 35`)
 * - Other player rows (`0x6fb26790` & `0x6fb269e0`): up to 7 rows, first `rowY = oy + 90` (`0x5a`), stride `38` (`0x26`)
 *   - Name (`0x6fb25780`): `ox + 36` (`0x24`), `rowY`, max width `95px` (`0x5f`) in party / `135px` (`0x87`) unpartied
 *   - Class (`0x6fb24ed0`): `ox + 36`, `rowY + 12` (`0x0c`)
 *   - Level (`0x6fb258c0`): `"Lvl : %2u"` at `ox + 266` (`0x10a`), `rowY + 12`
 *   - Area & Life (`0x6fb254a0`): area name at `ox + 126` (`0x7e`), `rowY + 12` (max width `140px` / `0x8c`), life bar (`partybar.dc6[1]` `46x4`) at `ox + 139`, `rowY - 10`
 *   - Separator bar (`0x6fb253d0` / `0x6fb25030`): `partybar.dc6[0]` (`255x4`) at `ox + 12` (`0x0c`) + `partybar.dc6[1]` (`46x4`) at `ox + 267` (`0x10b`), `y = oy + 67 + i * 38`
 *   - Row controls (`0x6fb269e0` / `0x6fb261c0`, bottom-anchored at `rowY`):
 *     - Hostile (`partyboxes.dc6` frame 4 peaceful swords, `19x19`): `ox + 14` (`0x0e`) — locked peaceful (PvP disabled)
 *     - Main Party Button (`partybuttons.dc6` `53x20`): `ox + 190` (`0xbe`)
 *     - Loot (`partyboxes.dc6` frames 12/14, `19x19`): `ox + 245` (`0xf5`)
 *     - Squelch / Mute (`partyboxes.dc6` frames 0/2, `19x19`): `ox + 266` (`0x10a`)
 *     - Ignore / Ear (`partyboxes.dc6` frames 8/10, `19x19`): `ox + 287` (`0x11f`)
 */
export const PARTY_SCREEN_LAYOUT = {
  width: 320,
  height: 432,
  closeBtn: { relX: 278, relY: 389, w: 32, h: 32 },
  header: { centerX: 105, minRelX: 20, maxRelX: 191, nameRelY: 29, levelClassRelY: 48 },
  leaveBtn: { relX: 227, relY: 15, bottomRelY: 35, w: 53, h: 20 },
  row: {
    firstRelY: 90,
    strideY: 38,
    maxRows: 7,
    nameRelX: 36,
    nameMaxWidthInParty: 95,
    nameMaxWidthUnpartied: 135,
    subLineOffsetY: 12,
    classRelX: 36,
    areaRelX: 126,
    areaMaxWidth: 140,
    levelRelX: 266,
    lifeBarRelX: 139,
    lifeBarOffsetY: -10,
    lifeBarW: 46,
    lifeBarH: 4,
    separatorBaseRelY: 67,
    separatorLeftRelX: 12,
    separatorLeftW: 255,
    separatorRightRelX: 267,
    separatorRightW: 46,
    separatorH: 4,
    hostileRelX: 14,
    partyBtnRelX: 190,
    partyBtnW: 53,
    partyBtnH: 20,
    lootRelX: 245,
    muteRelX: 266,
    ignoreRelX: 287,
    boxSize: 19,
  },
} as const

export const PARTY_CLASS_TBL_KEYS: Readonly<Record<string | number, string>> = {
  0: 'partycharama',
  1: 'partycharsor',
  2: 'partycharnec',
  3: 'partycharpal',
  4: 'partycharbar',
  5: 'partychardru',
  6: 'partycharass',
  ama: 'partycharama',
  amazon: 'partycharama',
  sor: 'partycharsor',
  sorceress: 'partycharsor',
  nec: 'partycharnec',
  necromancer: 'partycharnec',
  pal: 'partycharpal',
  paladin: 'partycharpal',
  bar: 'partycharbar',
  barbarian: 'partycharbar',
  dru: 'partychardru',
  druid: 'partychardru',
  ass: 'partycharass',
  asn: 'partycharass',
  assassin: 'partycharass',
}

/**
 * Resolve localized character class name for Party Screen (`0x6fb24e50` / `0x6fb24ed0`, `.tbl` `0x103a..0x103e` + LoD).
 */
export function resolvePartyClassName(
  classIdOrCode: number | string | null | undefined,
  lang: TblLang = 'ENG',
): string {
  const key =
    typeof classIdOrCode === 'number'
      ? (PARTY_CLASS_TBL_KEYS[classIdOrCode] ?? 'partycharsor')
      : typeof classIdOrCode === 'string'
        ? (PARTY_CLASS_TBL_KEYS[classIdOrCode.trim().toLowerCase()] ?? 'partycharsor')
        : 'partycharsor'
  return requireTbl(key, lang)
}

/**
 * Resolve localized area name for Party Screen (`0x6fb254a0` -> `D2Common_10014(areaId)` -> `.tbl`).
 */
export function resolvePartyAreaName(areaId: number | null | undefined, lang: TblLang = 'ENG'): string {
  if (typeof areaId !== 'number' || !Number.isFinite(areaId) || areaId <= 0) return ''
  const meta = CANONICAL_LEVEL_LIGHTING[areaId]
  if (!meta || !meta.levelName) return ''
  const key = meta.levelName
  if (lang === 'CHI') {
    return lookupTbl(key, 'CHI') ?? CANONICAL_WAYPOINT_CHI_TBL_SUPPLEMENT[key] ?? key
  }
  return lookupTbl(key, 'ENG') ?? CANONICAL_WAYPOINT_ENG_TBL_SUPPLEMENT[key] ?? key
}

/**
 * Truncate party screen text with `...` to fit within `maxWidth` pixels (`D2Client.dll` `0x6fb25780` & `0x6fb254a0`).
 */
export function truncatePartyTextWithEllipsis(
  text: string,
  maxWidth: number,
  font: Pick<D2FontRenderer, 'measureText'>,
  fontName: 'font6' | 'font8' | 'font16' = 'font6',
): string {
  if (!text || maxWidth <= 0) return ''
  if (font.measureText(text, fontName) <= maxWidth) return text
  const ellipsis = '...'
  const ellipsisW = font.measureText(ellipsis, fontName)
  let sliceLen = text.length - 1
  while (sliceLen > 1 && font.measureText(text.slice(0, sliceLen), fontName) + ellipsisW > maxWidth) {
    sliceLen--
  }
  return `${text.slice(0, Math.max(1, sliceLen))}${ellipsis}`
}

export type HoveredPartyControl =
  | { readonly kind: 'close'; readonly centerX: number; readonly anchorY: number }
  | { readonly kind: 'leave'; readonly centerX: number; readonly anchorY: number }
  | {
      readonly kind: 'partyBtn' | 'loot' | 'mute' | 'ignore'
      readonly rowIndex: number
      readonly member: any
      readonly centerX: number
      readonly anchorY: number
    }
/**
 * Resolve canonical D2GS 0x5E party action code (`D2Client.dll` party roster panel):
 * - `0x06`: Invite player to party (`0` / `'none'` / `0x06`)
 * - `0x07`: Cancel party invite sent by us (`1` / `'invited'` / `'invited_by_me'` / `0x07`)
 * - `0x08`: Accept party invite sent to us (`2` / `'invited_me'` / `'invited_by'` / `0x08`)
 * - `0x09`: Leave current party (`3` / `'in_party'` / `'party'` / `0x09`)
 *
 * Throws an explicit Error on null/undefined member or unknown/missing relationship/partyState
 * instead of silently returning `0x06`.
 */
export function resolvePartyActionCode(
  member:
    | {
        readonly relationship?: number | string | undefined
        readonly partyState?: number | string | undefined
        readonly partyId?: number | undefined
      }
    | null
    | undefined,
): 0x06 | 0x07 | 0x08 | 0x09 {
  if (!member || typeof member !== 'object') {
    throw new Error('resolvePartyActionCode requires a valid party member descriptor')
  }
  const state = member.partyState !== undefined ? member.partyState : member.relationship
  if (state === 0x06 || state === 0 || state === 'none' || state === 'hostile') {
    return 0x06
  }
  if (state === 0x07 || state === 1 || state === 'invited' || state === 'invited_by_me') {
    return 0x07
  }
  if (state === 0x08 || state === 2 || state === 'invited_me' || state === 'invited_by') {
    return 0x08
  }
  if (state === 0x09 || state === 3 || state === 'in_party' || state === 'party') {
    return 0x09
  }
  throw new Error(`resolvePartyActionCode: unrecognized party relationship/state ${JSON.stringify(state)}`)
}
/**
 * Layout of the centered 1.13c Trade Invitation / Waiting stone modal (`D2Client.dll` `0x6fb099e0`):
 * - `pendingModal === 'wait'`: `"Waiting for other player"` (`strParty9`) + centered `cancel` (`0x4F 0x02`)
 * - `pendingModal === 'request'`: `"%s wants to trade with you"` (`strParty8`) + `ok` (`0x4F 0x03`) + `cancel` (`0x4F 0x02`)
 */
export function getPendingTradeModalLayoutImpl(
  this: WorldPanelsHud,
  screenWidth: number = this.viewportWidth,
  screenHeight: number = this.viewportHeight,
): {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly ok: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly cancel: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly waitCancel: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
} {
  const w = 260
  const h = 110
  const x = Math.round(screenWidth / 2 - w / 2)
  const y = Math.round((screenHeight - 47) / 2 - h / 2)
  return {
    x,
    y,
    w,
    h,
    ok: { x: x + 30, y: y + h - 34, w: 80, h: 22 },
    cancel: { x: x + w - 110, y: y + h - 34, w: 80, h: 22 },
    waitCancel: { x: x + Math.round((w - 80) / 2), y: y + h - 34, w: 80, h: 22 },
  }
}
export function handlePendingTradeModalClickImpl(
  this: WorldPanelsHud,
  mx: number,
  my: number,
  onClickButton?: ((buttonId: number, complement?: number) => void) | null,
  screenWidth: number = this.viewportWidth,
  screenHeight: number = this.viewportHeight,
): boolean {
  const mode = this.trade?.pendingModal
  if (mode !== 'wait' && mode !== 'request') return false
  const l = this.getPendingTradeModalLayout(screenWidth, screenHeight)
  const inRect = (r: { x: number; y: number; w: number; h: number }) =>
    mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h
  const fire = onClickButton ?? this.onTradeButtonClick ?? this.onClickButton
  if (mode === 'wait') {
    if (inRect(l.waitCancel) || inRect(l.cancel)) {
      if (this.trade) {
        this.trade.pendingModal = null
        this.trade.active = false
      }
      if (!this.trade?.active) {
        this._activePanel = 'none'
      }
      fire?.(0x02, 0)
      return true
    }
    return mx >= l.x && mx <= l.x + l.w && my >= l.y && my <= l.y + l.h
  }
  if (inRect(l.ok)) {
    if (this.trade) {
      this.trade.pendingModal = null
    }
    fire?.(0x03, 0)
    return true
  }
  if (inRect(l.cancel)) {
    if (this.trade) {
      this.trade.pendingModal = null
      this.trade.active = false
    }
    if (!this.trade?.active) {
      this._activePanel = 'none'
    }
    fire?.(0x02, 0)
    return true
  }
  return mx >= l.x && mx <= l.x + l.w && my >= l.y && my <= l.y + l.h
}
/**
 * Handle mouse click on an active left-side dock panel (`merc`, `hire`, `party`, `trade`, `imbue`, `add_sockets`, `personalize`, `orifice`).
 */
export function handleActiveLeftPanelClickImpl(
  this: WorldPanelsHud,
  arg1: string | number,
  arg2: number,
  arg3?:
    | number
    | {
        onClose?: (() => void) | undefined
        onMercItem?: ((slot: number) => void) | undefined
        onHireMerc?: ((npcId: number, mercId: number) => void) | undefined
        onPartyAction?: ((action: number, targetPlayerId: number) => void) | undefined
        onSetHostile?: ((targetPlayerId: number, hostile: boolean, button?: number) => void) | undefined
        onSquelchToggle?: ((targetPlayerId: number, squelched: boolean) => void) | undefined
        onIgnoreToggle?: ((targetPlayerId: number, ignored: boolean) => void) | undefined
        onClearMessages?: (() => void) | undefined
        onClickButton?: ((buttonId: number, complement?: number) => void) | undefined
        onOpenTradeGoldDialog?: (() => void) | undefined
        onTradeGridClick?:
          | ((col: number, row: number, hitItem?: UiInventoryItem | null, isRightClick?: boolean) => void)
          | undefined
        onConfirmQuestReward?: ((itemId: number, npcId?: number) => void) | undefined
        onIneligibleItem?: (() => void) | undefined
        inventory?: { cursorItem: UiInventoryItem | null } | undefined
      },
  isRightClick = false,
  _isShiftClick = false,
  callbacksArg?: {
    onClose?: (() => void) | undefined
    onMercItem?: ((slot: number) => void) | undefined
    onHireMerc?: ((npcId: number, mercId: number) => void) | undefined
    onPartyAction?: ((action: number, targetPlayerId: number) => void) | undefined
    onSetHostile?: ((targetPlayerId: number, hostile: boolean, button?: number) => void) | undefined
    onSquelchToggle?: ((targetPlayerId: number, squelched: boolean) => void) | undefined
    onIgnoreToggle?: ((targetPlayerId: number, ignored: boolean) => void) | undefined
    onClearMessages?: (() => void) | undefined
    onClickButton?: ((buttonId: number, complement?: number) => void) | undefined
    onOpenTradeGoldDialog?: (() => void) | undefined
    onTradeGridClick?:
      | ((col: number, row: number, hitItem?: UiInventoryItem | null, isRightClick?: boolean) => void)
      | undefined
    onConfirmQuestReward?: ((itemId: number, npcId?: number) => void) | undefined
    onIneligibleItem?: (() => void) | undefined
    inventory?: { cursorItem: UiInventoryItem | null } | undefined
  },
): boolean {
  const panel = typeof arg1 === 'string' ? (arg1 && arg1 !== 'none' ? arg1 : this._activePanel) : this._activePanel
  const mx = typeof arg1 === 'string' ? arg2 : arg1
  const my = typeof arg1 === 'string' ? (typeof arg3 === 'number' ? arg3 : 0) : arg2
  const callbacks = typeof arg1 === 'string' ? callbacksArg : typeof arg3 === 'object' ? arg3 : callbacksArg

  if (panel === 'hire') {
    return this.handleHireMercClick(mx, my, callbacks, this.viewportWidth, this.viewportHeight)
  }

  if (
    panel !== 'merc' &&
    panel !== 'hire' &&
    panel !== 'party' &&
    panel !== 'msg' &&
    panel !== 'trade' &&
    panel !== 'imbue' &&
    panel !== 'add_sockets' &&
    panel !== 'personalize' &&
    panel !== 'orifice'
  ) {
    return false
  }

  if (panel === 'merc') {
    const is640 = this.viewportWidth <= 640
    const mercLayout = getInventoryLayout('Hireling', is640 ? 0 : 1)
    const mOx = mercLayout.invLeft
    const mOy = mercLayout.invTop
    if (
      mx < mOx ||
      mx > mOx + mercLayout.invWidth ||
      my < mOy ||
      my > mOy + mercLayout.invHeight
    ) {
      return false
    }
    // D2Client.dll 0x6fb3bd90: Close button (`buysellbtn.dc6` frame 10/11 at `ox+272, oy+385`, hit-box `[ox+270..ox+302, oy+384..oy+416]`)
    if (mx >= mOx + 270 && mx <= mOx + 302 && my >= mOy + 384 && my <= mOy + 416) {
      // 1.13c semantics: press latches the depressed cell, the close fires on mouse-up
      // landing back on the button (`releaseCloseButton`).
      return this.latchCloseButton(
        'merc',
        'dock',
        (x, y) => x >= mOx + 270 && x <= mOx + 302 && y >= mOy + 384 && y <= mOy + 416,
        () => {
          this._activePanel = 'none'
          ;(callbacks?.onClose ?? this.onCloseActivePanel ?? this.onCloseNpcPanel)?.()
        },
      )
    }
    // D2Client.dll 0x6fb47be0 / inventory.txt Hireling / Hireling2 equipment slots (head=1, torso=3, rArm=4, lArm=5)
    const slots: ReadonlyArray<{ slot: number; x: number; y: number; w: number; h: number }> = [
      { slot: 1, x: mercLayout.slots.head.left, y: mercLayout.slots.head.top, w: mercLayout.slots.head.width, h: mercLayout.slots.head.height },
      { slot: 3, x: mercLayout.slots.torso.left, y: mercLayout.slots.torso.top, w: mercLayout.slots.torso.width, h: mercLayout.slots.torso.height },
      { slot: 4, x: mercLayout.slots.rArm.left, y: mercLayout.slots.rArm.top, w: mercLayout.slots.rArm.width, h: mercLayout.slots.rArm.height },
      { slot: 5, x: mercLayout.slots.lArm.left, y: mercLayout.slots.lArm.top, w: mercLayout.slots.lArm.width, h: mercLayout.slots.lArm.height },
    ]
    for (const s of slots) {
      if (mx >= s.x && mx <= s.x + s.w && my >= s.y && my <= s.y + s.h) {
        const hasCursorItem = Boolean(
          callbacks?.inventory?.cursorItem ?? this.activePlayerInventory?.cursorItem ?? (this as any).cursorItem,
        )
        const m = this.merc as any
        const eq = m?.equipped ?? m?.equipment ?? (this as any).mercEquipped
        const hasOffhand = Boolean(m?.shieldItem ?? m?.offhandItem ?? eq?.leftHand ?? eq?.weapon2)
        const hasWeapon = Boolean(m?.weaponItem ?? eq?.rightHand ?? eq?.weapon1)
        const resolvedSlot = !hasCursorItem && s.slot === 5 && !hasOffhand && hasWeapon ? 4 : s.slot
        ;(callbacks?.onMercItem ?? this.onMercEquipSlotClick ?? this.onMercItem)?.(resolvedSlot)
        return true
      }
    }
    return true
  }

  if (isUseItemPanel(panel)) {
    // D2Client.dll useitem.cpp mouse handlers (absolute screen coordinates, see USE_ITEM_LAYOUT).
    // The WM_LBUTTONDOWN handler (0x6fb50320) marks every left click as handled while the window is open.
    if (isRightClick) return true
    const button = hitTestUseItemButton(mx, my)
    if (button === 1) {
      // Close button (0x6fb4fd70): return the placed item and close the window.
      // 1.13c semantics (issue #927): mouse-down latches the depressed cell, the
      // close fires on mouse-up landing back on the button (`releaseCloseButton`).
      this.pressedUseItemButton = 1
      return this.latchCloseButton(
        'useitem-close',
        'dock',
        (x, y) => hitTestUseItemButton(x, y) === 1,
        () => {
          this.pressedUseItemButton = null
          if (this.questRewardItem && callbacks?.inventory) {
            if (!callbacks.inventory.cursorItem) {
              callbacks.inventory.cursorItem = this.questRewardItem
            } else {
              ;(callbacks.inventory as any).autoPlaceInGrid?.(this.questRewardItem)
            }
            this.questRewardItem = null
          }
          this.hoveredQuestRewardItem = null
          this._activePanel = 'none'
          ;(callbacks?.onClose ?? this.onCloseActivePanel ?? this.onCloseNpcPanel)?.()
        },
      )
    }
    if (button === 0) {
      // Confirm button (0x6fb4f830): only acts once an eligible item has been placed (state 2).
      this.pressedUseItemButton = 0
      const qItem = this.questRewardItem as
        | { id?: string | number; itemId?: number; serverId?: number }
        | null
        | undefined
      if (!qItem || !isEligibleArtisanItem(panel, qItem as any)) {
        return true
      }
      const rawId = qItem.serverId ?? qItem.itemId ?? qItem.id ?? 1
      const itemId =
        typeof rawId === 'number' && rawId > 0
          ? rawId
          : Number.parseInt(String(rawId).replace(/\D+/g, ''), 10) || 1
      if (itemId > 0) {
        const npcId = Number(
          this._npcMenu?.npcUnitId ?? this._npcMenu?.npcId ?? this.activeNpcId ?? this.vendorNpcId ?? 0,
        )
        const confirmCb =
          callbacks?.onConfirmQuestReward ?? this.onConfirmQuestRewardClick ?? this.onConfirmQuestReward
        this.pressedUseItemButton = null
        if (confirmCb) {
          confirmCb(itemId, npcId)
        } else {
          this.onNpcEntityAction?.(0, npcId, itemId)
        }
        this.questRewardItem = null
        this.hoveredQuestRewardItem = null
        this._activePanel = 'none'
      }
      return true
    }
    if (hitTestUseItemSlot(mx, my)) {
      // Item drop/pick rect (0x6fb503ae..0x6fb503d2): cursor item must pass the NPC/orifice check.
      if (callbacks?.inventory?.cursorItem) {
        if (isEligibleArtisanItem(panel, callbacks.inventory.cursorItem)) {
          const prev = this.questRewardItem
          this.questRewardItem = callbacks.inventory.cursorItem
          callbacks.inventory.cursorItem = prev ?? null
        } else {
          // D2Client.dll 0x6fb50451: PlaySound(3, 0, 0, 0, 0) on ineligible item drop
          ;(callbacks?.onIneligibleItem ?? this.onIneligibleArtisanItem)?.()
        }
      } else if (this.questRewardItem && callbacks?.inventory) {
        callbacks.inventory.cursorItem = this.questRewardItem
        this.questRewardItem = null
      }
      return true
    }
    return true
  }

  if (
    panel === 'trade' &&
    (this.trade?.pendingModal === 'wait' || this.trade?.pendingModal === 'request')
  ) {
    const modalHandled = this.handlePendingTradeModalClick(
      mx,
      my,
      callbacks?.onClickButton ?? this.onTradeButtonClick ?? this.onClickButton,
    )
    if (modalHandled || !this.trade?.active) {
      return modalHandled
    }
  }

  if (panel === 'msg') {
    // D2Client.dll 0x6fb2c770 (`MSG_OpenMessageLog`) + 0x6fb53560 (`D2Dialog_OnLButtonDown`) + 0x6fb17c10 (`D2TextSlid_OnLButtonDown`):
    // Full-viewport stone dialog at `[5, 30, viewportWidth - 20, viewportHeight - 130]`.
    const frameX = 5
    const frameY = 30
    const frameW = Math.max(320, this.viewportWidth - 20)
    const frameH = Math.max(240, this.viewportHeight - 130)
    if (mx < frameX || mx > frameX + frameW || my < frameY || my > frameY + frameH) {
      return false
    }
    const boxX = 5
    const boxY = 65
    const boxW = frameW
    const boxH = Math.max(160, this.viewportHeight - 200)
    const sliderX = boxX + boxW - 18
    const sliderTopY = boxY + 3
    const trackSegments = Math.max(1, Math.floor((boxH - 16) / 12) - 1)
    const downArrowY = sliderTopY + 12 + trackSegments * 12

    // Scrollbar Up / Down / Track click (`0x6fb17c10`)
    if (mx >= sliderX - 6 && mx <= sliderX + 18 && my >= boxY && my <= boxY + boxH) {
      if (my <= sliderTopY + 14) {
        this.scrollMessageLog(1)
      } else if (my >= downArrowY - 2) {
        this.scrollMessageLog(-1)
      } else if (my < boxY + boxH / 2) {
        this.scrollMessageLog(5)
      } else {
        this.scrollMessageLog(-5)
      }
      return true
    }

    // Bottom selectable Line 1: "Close" (`0x1030`) at baseline `y = viewportHeight - 114` (`0x6fb2c801..0x6fb2c82c`)
    const closeBaselineY = frameY + 21 + (this.viewportHeight - 165)
    if (
      mx >= frameX + 15 &&
      mx <= frameX + frameW - 15 &&
      my >= closeBaselineY - 18 &&
      my <= frameY + frameH
    ) {
      this._activePanel = 'none'
      this.messageLogCloseHovered = false
      ;(callbacks?.onClose ?? this.onCloseActivePanel ?? this.onCloseNpcPanel)?.()
      return true
    }

    return true
  }

  const ox = this.viewportWidth <= 640 ? 0 : 80
  const oy = this.viewportWidth <= 640 ? 0 : 60
  const pw = 320
  const ph = 432
  if (mx < ox || mx > ox + pw || my < oy || my > oy + ph) {
    return false
  }

  if (panel === 'party') {
    return this.handlePartyPanelClick(mx, my, ox, oy, callbacks)
  }

  // Close [X] button in top-right corner of the panel, or bottom-left/bottom-right on non-trade panels
  const isTopRightX = panel !== 'trade' && mx >= ox + pw - 28 && mx <= ox + pw - 8 && my >= oy + 8 && my <= oy + 28
  const isBottomX =
    panel !== 'trade' &&
    my >= oy + 380 &&
    my <= oy + 422 &&
    (mx >= ox + 260 || mx <= ox + 58)
  if (isTopRightX || isBottomX) {
    // 1.13c semantics: press latches the depressed cell, the close fires on mouse-up
    // landing back on the same top-right / bottom X region.
    return this.latchCloseButton(
      'active',
      'dock',
      (x, y) =>
        (x >= ox + pw - 28 && x <= ox + pw - 8 && y >= oy + 8 && y <= oy + 28) ||
        (y >= oy + 380 && y <= oy + 422 && (x >= ox + 260 || x <= ox + 58)),
      () => {
        if (this.questRewardItem && callbacks?.inventory) {
          if (!callbacks.inventory.cursorItem) {
            callbacks.inventory.cursorItem = this.questRewardItem
          } else {
            ;(callbacks.inventory as any).autoPlaceInGrid?.(this.questRewardItem)
          }
          this.questRewardItem = null
        }
        this._activePanel = 'none'
        ;(callbacks?.onClose ?? this.onCloseActivePanel ?? this.onCloseNpcPanel)?.()
      },
    )
  }
  if (panel === 'trade') {
    const fireTradeBtn = callbacks?.onClickButton ?? this.onTradeButtonClick ?? this.onClickButton

    // 1. Self Gold Coin button + Gold display box (D2Client.dll 0x6fb0a8a0: relX 135..301, relY 220..248)
    if (mx >= ox + 135 && mx <= ox + 301 && my >= oy + 220 && my <= oy + 248) {
      if (callbacks?.onOpenTradeGoldDialog) {
        callbacks.onOpenTradeGoldDialog()
      } else {
        const goldOffer = Number(this.trade?.selfGold ?? this.trade?.myGold ?? 0) || 0
        fireTradeBtn?.(0x08, goldOffer)
      }
      return true
    }

    // 2. Self Accept checkmark button (`buysellbtn.dc6` frame 16/17 at ox + 223, oy + 384, 32x32; hit-box relX 221..255, relY 383..417)
    if (mx >= ox + 221 && mx <= ox + 255 && my >= oy + 383 && my <= oy + 417) {
      if (this.trade?.acceptDisabled) {
        return true
      }
      const accepted = Boolean(this.trade?.selfAccepted ?? this.trade?.myAccepted)
      if (this.trade) {
        this.trade.selfAccepted = !accepted
        this.trade.myAccepted = !accepted
      }
      fireTradeBtn?.(accepted ? 0x07 : 0x04, 0)
      return true
    }

    // 3. Cancel [X] button (`buysellbtn.dc6` frame 10/11 at ox + 275, oy + 384, 32x32; hit-box relX 273..307, relY 383..417, plus legacy relX 260..312, relY 380..408)
    if (
      (mx >= ox + 273 && mx <= ox + 307 && my >= oy + 383 && my <= oy + 417) ||
      (mx >= ox + 260 && mx <= ox + 312 && my >= oy + 380 && my <= oy + 408) ||
      (mx >= ox + pw - 28 && mx <= ox + pw - 8 && my >= oy + 8 && my <= oy + 28)
    ) {
      fireTradeBtn?.(0x02, 0)
      return true
    }

    // 4. Self 10x4 trade grid (`trade.dc6`: ox + 18, oy + 252, 290x116; plus legacy 100, 315, 290x116)
    const inAuthSelfGrid =
      mx >= ox + 18 && mx < ox + 18 + 290 && my >= oy + 252 && my < oy + 252 + 116
    const inLegacySelfGrid = mx >= 100 && mx < 100 + 290 && my >= 315 && my < 315 + 116
    if (inAuthSelfGrid || inLegacySelfGrid) {
      const gridOriginX = inAuthSelfGrid ? ox + 18 : 100
      const gridOriginY = inAuthSelfGrid ? oy + 252 : 315
      const selfItems = (this.trade?.selfItems ?? this.trade?.myItems ?? []) as UiInventoryItem[]
      const cursor = callbacks?.inventory?.cursorItem ?? this.activePlayerInventory?.cursorItem ?? null
      if (cursor && !isRightClick) {
        const placements = selfItems.map((it: any) => ({
          item: it,
          col: Number(it.gridX ?? it.col ?? 0),
          row: Number(it.gridY ?? it.row ?? 0),
        }))
        const placement = computeCursorItemGridPlacement(
          mx,
          my,
          { x: gridOriginX, y: gridOriginY, cols: 10, rows: 4, cellPx: 29 },
          cursor,
          placements,
        )
        if (!placement.inBounds || placement.overlaps.length > 1) {
          return true
        }
        ;(callbacks?.onTradeGridClick ?? this.onTradeGridClick)?.(
          placement.col,
          placement.row,
          placement.overlaps[0]?.item ?? null,
          false,
        )
        return true
      }
      const col = Math.max(0, Math.min(9, Math.floor((mx - gridOriginX) / 29)))
      const row = Math.max(0, Math.min(3, Math.floor((my - gridOriginY) / 29)))
      const hitItem =
        selfItems.find((it: any) => {
          const gx = Number(it.gridX ?? it.col ?? 0)
          const gy = Number(it.gridY ?? it.row ?? 0)
          const gw = Math.max(1, Number(it.invWidth ?? it.w ?? 1))
          const gh = Math.max(1, Number(it.invHeight ?? it.h ?? 1))
          return col >= gx && col < gx + gw && row >= gy && row < gy + gh
        }) ?? null
      ;(callbacks?.onTradeGridClick ?? this.onTradeGridClick)?.(col, row, hitItem, isRightClick)
      return true
    }

    return true
  }

  return true
}
/**
 * Determine whether a roster entry belongs to the local player's party (`D2Client.dll` `0x6fb25780`).
 */
export function isMemberInLocalPartyImpl(this: WorldPanelsHud, member: any): boolean {
  if (!member || typeof member !== 'object') return false
  const state = member.partyState !== undefined ? member.partyState : member.relationship
  if (state === 0x09 || state === 3 || state === 'in_party' || state === 'party') return true
  if (state === 1 && member.relationship === 'in_party') return true
  if (
    typeof this.localPartyId === 'number' &&
    this.localPartyId > 0 &&
    this.localPartyId !== 0xffff &&
    member.partyId === this.localPartyId
  ) {
    return true
  }
  return false
}
/**
 * Determine whether a roster entry is in any active party (`partyId !== 0xffff && partyId > 0`).
 */
export function isMemberInAnyPartyImpl(this: WorldPanelsHud, member: any): boolean {
  if (this.isMemberInLocalParty(member)) return true
  const pid = Number(member?.partyId ?? 0xffff)
  return Number.isFinite(pid) && pid > 0 && pid !== 0xffff
}
/**
 * Determine whether the local player is currently in an active party (`D2Client.dll` `0x6fb255d0`).
 */
export function isLocalPlayerInPartyImpl(this: WorldPanelsHud): boolean {
  if (
    typeof this.localPartyId === 'number' &&
    this.localPartyId > 0 &&
    this.localPartyId !== 0xffff
  ) {
    return true
  }
  return this.partyMembers.some((m) => this.isMemberInLocalParty(m))
}
/**
 * Return up to 7 other players grouped by party (`D2Client.dll` `0x6fb26790`):
 * 1. Members in local player's party (`'local'`)
 * 2. Members in other parties (`'party:<partyId>'`)
 * 3. Unpartied players (`'none'`)
 */
export function getOrderedPartyRosterImpl(this: WorldPanelsHud): Array<{ member: any; groupKey: string }> {
  const localGroup: Array<{ member: any; groupKey: string }> = []
  const otherPartyGroups = new Map<number, Array<{ member: any; groupKey: string }>>()
  const unpartiedGroup: Array<{ member: any; groupKey: string }> = []

  for (const member of this.partyMembers) {
    if (!member || typeof member !== 'object') continue
    if (this.isMemberInLocalParty(member)) {
      localGroup.push({ member, groupKey: 'local' })
    } else if (this.isMemberInAnyParty(member)) {
      const pid = Number(member.partyId)
      const groupKey = `party:${pid}`
      let list = otherPartyGroups.get(pid)
      if (!list) {
        list = []
        otherPartyGroups.set(pid, list)
      }
      list.push({ member, groupKey })
    } else {
      unpartiedGroup.push({ member, groupKey: 'none' })
    }
  }

  const ordered: Array<{ member: any; groupKey: string }> = [...localGroup]
  for (const list of otherPartyGroups.values()) {
    ordered.push(...list)
  }
  ordered.push(...unpartiedGroup)
  return ordered.slice(0, PARTY_SCREEN_LAYOUT.row.maxRows)
}
/**
 * Hit-test Party Screen controls (`D2Client.dll` `0x6fb261c0` & `0x6fb26b20`).
 */
export function hitTestPartyControlImpl(this: WorldPanelsHud, mx: number, my: number, ox: number, oy: number): HoveredPartyControl | null {
  const L = PARTY_SCREEN_LAYOUT
  // 1. Close button (`[ox + 278..ox + 310, oy + 389..oy + 421]`)
  if (
    mx >= ox + L.closeBtn.relX &&
    mx <= ox + L.closeBtn.relX + L.closeBtn.w &&
    my >= oy + L.closeBtn.relY &&
    my <= oy + L.closeBtn.relY + L.closeBtn.h
  ) {
    return {
      kind: 'close',
      centerX: ox + L.closeBtn.relX + Math.trunc(L.closeBtn.w / 2),
      anchorY: oy + L.closeBtn.relY,
    }
  }

  // 2. Top "Leave Party" button (`[ox + 227..ox + 280, oy + 15..oy + 35]`)
  if (
    this.isLocalPlayerInParty() &&
    mx >= ox + L.leaveBtn.relX &&
    mx <= ox + L.leaveBtn.relX + L.leaveBtn.w &&
    my >= oy + L.leaveBtn.relY &&
    my <= oy + L.leaveBtn.bottomRelY
  ) {
    return {
      kind: 'leave',
      centerX: ox + L.leaveBtn.relX + Math.trunc(L.leaveBtn.w / 2),
      anchorY: oy + L.leaveBtn.relY,
    }
  }

  // 3. Roster row buttons (`rowY = oy + 90 + i * 38`)
  const rows = this.getOrderedPartyRoster()
  for (let i = 0; i < rows.length; i++) {
    const { member } = rows[i]!
    const rowY = oy + L.row.firstRelY + i * L.row.strideY
    if (my < rowY - 22 || my > rowY + 16) continue

    // Main Party Button (`ox + 190..ox + 243`) — only interactive when member is not already in a party
    if (
      mx >= ox + L.row.partyBtnRelX &&
      mx <= ox + L.row.partyBtnRelX + L.row.partyBtnW &&
      !this.isMemberInAnyParty(member)
    ) {
      return {
        kind: 'partyBtn',
        rowIndex: i,
        member,
        centerX: ox + L.row.partyBtnRelX + Math.trunc(L.row.partyBtnW / 2),
        anchorY: rowY - L.row.partyBtnH,
      }
    }

    // Loot Button (`ox + 245..ox + 264`)
    if (mx >= ox + L.row.lootRelX && mx <= ox + L.row.lootRelX + L.row.boxSize) {
      return {
        kind: 'loot',
        rowIndex: i,
        member,
        centerX: ox + L.row.lootRelX + Math.trunc(L.row.boxSize / 2),
        anchorY: rowY - L.row.boxSize,
      }
    }

    // Squelch / Mute Button (`ox + 266..ox + 285`)
    if (mx >= ox + L.row.muteRelX && mx <= ox + L.row.muteRelX + L.row.boxSize) {
      return {
        kind: 'mute',
        rowIndex: i,
        member,
        centerX: ox + L.row.muteRelX + Math.trunc(L.row.boxSize / 2),
        anchorY: rowY - L.row.boxSize,
      }
    }

    // Ignore / Ear Button (`ox + 287..ox + 306`)
    if (mx >= ox + L.row.ignoreRelX && mx <= ox + L.row.ignoreRelX + L.row.boxSize) {
      return {
        kind: 'ignore',
        rowIndex: i,
        member,
        centerX: ox + L.row.ignoreRelX + Math.trunc(L.row.boxSize / 2),
        anchorY: rowY - L.row.boxSize,
      }
    }
  }

  return null
}
/**
 * Build localized 1- or 2-line hover tooltip strings for Party Screen controls (`D2Client.dll` `0x6fb25d30` & `0x6fb26b20`).
 */
export function resolvePartyHoverTooltipLinesImpl(this: WorldPanelsHud, ctrl: HoveredPartyControl): string[] {
  if (ctrl.kind === 'close') {
    return [requireTbl('close', this.lang)]
  }
  if (ctrl.kind === 'leave') {
    return [requireTbl('strParty24', this.lang)]
  }
  const mName = String(ctrl.member?.name ?? ctrl.member?.charName ?? '')
  if (ctrl.kind === 'partyBtn') {
    const code = this.resolvePartyActionCode(ctrl.member)
    if (code === 0x08) {
      return [`${requireTbl('strParty3', this.lang)}${mName}`, requireTbl('strParty4', this.lang)]
    }
    if (code === 0x07) {
      return [`${requireTbl('strParty5', this.lang)}${mName}`, requireTbl('strParty6', this.lang)]
    }
    return [`${requireTbl('strParty1', this.lang)}${mName}`, requireTbl('strParty2', this.lang)]
  }
  if (ctrl.kind === 'loot') {
    const allowed = Boolean(ctrl.member?.lootPermit ?? ctrl.member?.lootAllowed ?? ctrl.member?.lootPermitted)
    if (allowed) {
      return [`${requireTbl('strParty13', this.lang)}${mName}`, requireTbl('strParty14', this.lang)]
    }
    return [`${requireTbl('strParty11', this.lang)}${mName}`, requireTbl('strParty12', this.lang)]
  }
  if (ctrl.kind === 'mute') {
    const muted = Boolean(ctrl.member?.muted ?? ctrl.member?.squelched)
    if (muted) {
      return [`${requireTbl('strParty22', this.lang)}${mName}`]
    }
    return [`${requireTbl('strParty19', this.lang)}${mName}`]
  }
  const ignored = Boolean(ctrl.member?.ignored ?? ctrl.member?.deafened)
  if (ignored) {
    return [`${requireTbl('strParty15', this.lang)}${mName}`, requireTbl('strParty16', this.lang)]
  }
  return [`${requireTbl('strParty17', this.lang)}${mName}`, requireTbl('strParty18', this.lang)]
}
/**
 * Handle mouse click inside the 1.13c Party Screen (`D2Client.dll` `0x6fb261c0`).
 * Note: Hostile box (`ox + 14`) is permanently disabled (PvP closed).
 */
export function handlePartyPanelClickImpl(
  this: WorldPanelsHud,
  mx: number,
  my: number,
  ox: number,
  oy: number,
  callbacks?: {
    onClose?: (() => void) | undefined
    onPartyAction?: ((action: number, targetPlayerId: number) => void) | undefined
    onSetHostile?: ((targetPlayerId: number, hostile: boolean, button?: number) => void) | undefined
    onSquelchToggle?: ((targetPlayerId: number, squelched: boolean) => void) | undefined
    onIgnoreToggle?: ((targetPlayerId: number, ignored: boolean) => void) | undefined
    inventory?: { cursorItem: UiInventoryItem | null } | undefined
  },
): boolean {
  const L = PARTY_SCREEN_LAYOUT
  const pw = L.width

  // 1. Close button (`[ox + 278..ox + 310, oy + 389..oy + 421]` or legacy top-right/bottom-right)
  const isCloseBtn =
    (mx >= ox + L.closeBtn.relX &&
      mx <= ox + L.closeBtn.relX + L.closeBtn.w &&
      my >= oy + L.closeBtn.relY &&
      my <= oy + L.closeBtn.relY + L.closeBtn.h) ||
    (mx >= ox + pw - 28 && mx <= ox + pw - 8 && my >= oy + 8 && my <= oy + 28) ||
    (my >= oy + 380 && my <= oy + 422 && (mx >= ox + 260 || mx <= ox + 58))
  if (isCloseBtn) {
    return this.latchCloseButton(
      'party',
      'dock',
      (x, y) =>
        (x >= ox + L.closeBtn.relX &&
          x <= ox + L.closeBtn.relX + L.closeBtn.w &&
          y >= oy + L.closeBtn.relY &&
          y <= oy + L.closeBtn.relY + L.closeBtn.h) ||
        (x >= ox + pw - 28 && x <= ox + pw - 8 && y >= oy + 8 && y <= oy + 28) ||
        (y >= oy + 380 && y <= oy + 422 && (x >= ox + 260 || x <= ox + 58)),
      () => {
        this._activePanel = 'none'
        ;(callbacks?.onClose ?? this.onCloseActivePanel ?? this.onCloseNpcPanel)?.()
      },
    )
  }

  // 2. Top "Leave Party" button (`0x6fb255d0`: `[ox + 227..ox + 280, oy + 15..oy + 35]`)
  if (
    this.isLocalPlayerInParty() &&
    mx >= ox + L.leaveBtn.relX &&
    mx <= ox + L.leaveBtn.relX + L.leaveBtn.w &&
    my >= oy + L.leaveBtn.relY &&
    my <= oy + L.leaveBtn.bottomRelY
  ) {
    const firstMemberId = Number(
      this.partyMembers[0]?.unitId ?? this.partyMembers[0]?.playerId ?? 0,
    )
    const targetId = this.localPlayerId > 0 ? this.localPlayerId : firstMemberId || 1
    ;(callbacks?.onPartyAction ?? this.onPartyActionClick ?? this.onPartyAction)?.(0x09, targetId)
    return true
  }

  // 3. Roster rows (`rowY = oy + 90 + i * 38`)
  const rows = this.getOrderedPartyRoster()
  for (let i = 0; i < rows.length; i++) {
    const { member } = rows[i]!
    const rowY = oy + L.row.firstRelY + i * L.row.strideY
    if (my < rowY - 22 || my > rowY + 16) continue

    const targetId = Number(member?.unitId ?? member?.playerId ?? 0)
    if (targetId <= 0) return true

    // 3a. Hostile box (`ox + 14..ox + 33`): PvP / Hostile disabled (Issue #909 R3) — no-op!
    if (mx >= ox + L.row.hostileRelX && mx <= ox + L.row.hostileRelX + L.row.boxSize) {
      return true
    }

    // 3b. Main Party Button (`ox + 190..ox + 243`): Invite (0x06), Cancel (0x07), Accept (0x08)
    if (mx >= ox + L.row.partyBtnRelX && mx <= ox + L.row.partyBtnRelX + L.row.partyBtnW) {
      if (!this.isMemberInAnyParty(member)) {
        const action = this.resolvePartyActionCode(member)
        ;(callbacks?.onPartyAction ?? this.onPartyActionClick ?? this.onPartyAction)?.(
          action,
          targetId,
        )
      }
      return true
    }

    // 3c. Loot Button (`ox + 245..ox + 264`): toggle corpse loot permission (`0x5D` button=2)
    if (mx >= ox + L.row.lootRelX && mx <= ox + L.row.lootRelX + L.row.boxSize) {
      const currentlyAllowed = Boolean(
        member?.lootPermit ?? member?.lootAllowed ?? member?.lootPermitted,
      )
      const nextAllowed = !currentlyAllowed
      member.lootPermit = nextAllowed
      member.lootAllowed = nextAllowed
      member.lootPermitted = nextAllowed
      ;(
        callbacks?.onSetHostile ??
        this.onHostileToggleClick ??
        this.onSetHostile ??
        this.onHostile
      )?.(targetId, nextAllowed, 2)
      return true
    }

    // 3d. Squelch / Mute Button (`ox + 266..ox + 285`)
    if (mx >= ox + L.row.muteRelX && mx <= ox + L.row.muteRelX + L.row.boxSize) {
      const nextMuted = !Boolean(member?.muted ?? member?.squelched)
      member.muted = nextMuted
      member.squelched = nextMuted
      ;(callbacks?.onSquelchToggle ?? this.onSquelchToggle)?.(targetId, nextMuted)
      return true
    }

    // 3e. Ignore / Ear Button (`ox + 287..ox + 306`)
    if (mx >= ox + L.row.ignoreRelX && mx <= ox + L.row.ignoreRelX + L.row.boxSize) {
      const nextIgnored = !Boolean(member?.ignored ?? member?.deafened)
      member.ignored = nextIgnored
      member.deafened = nextIgnored
      ;(callbacks?.onIgnoreToggle ?? this.onIgnoreToggle)?.(targetId, nextIgnored)
      return true
    }
  }

  return true
}
/**
 * Draw the authentic Diablo II v1.13c Party Screen (`D2Client.dll` `PARTY_DrawPartyScreen` @ `0x6fb27250`).
 */
export function drawPartyPanelImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  fontRenderer?: D2FontRenderer | null,
  assets?: {
    partyBgImg?: HTMLImageElement | null | undefined
    partyButtonsImg?: HTMLImageElement | null | undefined
    partyBoxesImg?: HTMLImageElement | null | undefined
    partyBarImg?: HTMLImageElement | null | undefined
    buySellBtnImg?: HTMLImageElement | null | undefined
  },
): void {
  const font = fontRenderer ?? this.font ?? this.defaultFont
  const L = PARTY_SCREEN_LAYOUT

  // 1. Panel backdrop + `data/global/ui/MENU/party.dc6` (`public/ui/party-bg.png`, 320x432) at `(ox, oy)`
  ctx.fillStyle = 'rgba(12, 10, 8, 0.92)'
  ctx.fillRect(ox, oy, L.width, L.height)
  const partyBgImg =
    assets && 'partyBgImg' in assets ? assets.partyBgImg : this.getPartyBgImage()
  if (partyBgImg) {
    ctx.drawImage(partyBgImg, ox, oy)
  }

  const partyButtonsImg =
    assets && assets.partyButtonsImg !== undefined
      ? assets.partyButtonsImg
      : this.getPartyButtonsImage()
  const partyBoxesImg =
    assets && assets.partyBoxesImg !== undefined
      ? assets.partyBoxesImg
      : this.getPartyBoxesImage()
  const partyBarImg =
    assets && assets.partyBarImg !== undefined ? assets.partyBarImg : this.getPartyBarImage()
  const buySellBtnImg =
    assets && assets.buySellBtnImg !== undefined
      ? assets.buySellBtnImg
      : this.getBuySellBtnImage()

  // 2. Close `[X]` button (`0x6fb26050` & `0x6fb27278`, `buysellbtn.dc6` frame 10/11 at `ox + 278, oy + 389`)
  if (buySellBtnImg) {
    const closeFrame =
      this.pressedCloseKind === 'party' || this.pressedCloseKind === 'active' ? 11 : 10
    ctx.drawImage(
      buySellBtnImg,
      closeFrame * 32,
      0,
      32,
      32,
      ox + L.closeBtn.relX,
      oy + L.closeBtn.relY,
      L.closeBtn.w,
      L.closeBtn.h,
    )
  }

  // 3. Local player header (`0x6fb260f0` / `0x6fb263c0`): centered at `ox + 105`, `oy + 29` and `oy + 48`
  const localName = this.localPlayerName || (this.lang === 'CHI' ? '英雄' : 'Hero')
  font.drawText(ctx, localName, ox + L.header.centerX, oy + L.header.nameRelY, {
    font: 'font16',
    color: 'white',
    align: 'center',
  })
  const localLevel = Math.max(1, Number(this.localPlayerLevel || this.vendorCharLevel || 1))
  const localClassStr = resolvePartyClassName(
    this.localPlayerClass ?? this.vendorPlayerStats.classCode ?? 1,
    this.lang,
  )
  const levelLine = `${requireTbl('level', this.lang)} ${localLevel} ${localClassStr}`
  font.drawText(ctx, levelLine, ox + L.header.centerX, oy + L.header.levelClassRelY, {
    font: 'font16',
    color: 'white',
    align: 'center',
  })

  // 4. Top "Leave Party" button (`0x6fb255d0`: `partybuttons.dc6` 53x20 at `ox + 227, oy + 15`)
  if (this.isLocalPlayerInParty()) {
    const isLeavePressed = this.pressedPartyButton?.kind === 'leave'
    if (partyButtonsImg) {
      ctx.drawImage(
        partyButtonsImg,
        (isLeavePressed ? 1 : 0) * L.leaveBtn.w,
        0,
        L.leaveBtn.w,
        L.leaveBtn.h,
        ox + L.leaveBtn.relX,
        oy + L.leaveBtn.relY,
        L.leaveBtn.w,
        L.leaveBtn.h,
      )
    }
    const leaveLabel = requireTbl('Leave', this.lang)
    font.drawText(
      ctx,
      leaveLabel,
      ox + L.leaveBtn.relX + Math.trunc(L.leaveBtn.w / 2) + (isLeavePressed ? -2 : 0),
      oy + L.leaveBtn.relY + 15 + (isLeavePressed ? 2 : 0),
      {
        font: 'font16',
        color: 'white',
        align: 'center',
      },
    )
  }

  // 5. Other player rows (`0x6fb26790` & `0x6fb269e0`): `rowY = oy + 90 + i * 38`
  const rowFont = this.lang === 'CHI' ? 'font8' : 'font6'
  const rows = this.getOrderedPartyRoster()
  for (let i = 0; i < rows.length; i++) {
    const { member, groupKey } = rows[i]!
    const rowY = oy + L.row.firstRelY + i * L.row.strideY

    // 5a. Group separator bar (`0x6fb253d0` / `0x6fb25030`) between different party groups
    if (i > 0 && rows[i - 1]!.groupKey !== groupKey) {
      const sepY = oy + L.row.separatorBaseRelY + i * L.row.strideY
      if (partyBarImg) {
        ctx.drawImage(
          partyBarImg,
          0,
          0,
          L.row.separatorLeftW,
          L.row.separatorH,
          ox + L.row.separatorLeftRelX,
          sepY - L.row.separatorH,
          L.row.separatorLeftW,
          L.row.separatorH,
        )
        ctx.drawImage(
          partyBarImg,
          L.row.separatorLeftW,
          0,
          L.row.separatorRightW,
          L.row.separatorH,
          ox + L.row.separatorRightRelX,
          sepY - L.row.separatorH,
          L.row.separatorRightW,
          L.row.separatorH,
        )
      } else {
        ctx.fillStyle = '#6c5838'
        ctx.fillRect(
          ox + L.row.separatorLeftRelX,
          sepY - L.row.separatorH,
          L.row.separatorLeftW + L.row.separatorRightW,
          2,
        )
      }
    }

    const inSameParty = this.isMemberInLocalParty(member)
    const inAnyParty = this.isMemberInAnyParty(member)

    // 5b. Player Name (`0x6fb25780`): green if in same party, white otherwise, truncated with `...`
    const rawName = String(
      member.name ?? member.charName ?? `Player #${member.unitId ?? member.playerId ?? i + 1}`,
    )
    const maxNameW = inAnyParty ? L.row.nameMaxWidthInParty : L.row.nameMaxWidthUnpartied
    const displayName = truncatePartyTextWithEllipsis(rawName, maxNameW, font, rowFont)
    font.drawText(ctx, displayName, ox + L.row.nameRelX, rowY, {
      font: rowFont,
      color: inSameParty ? 'green' : 'white',
      align: 'left',
    })

    // 5c. Class (`0x6fb24ed0`) & Level (`0x6fb258c0`) on second line `rowY + 12`
    const mClassStr = resolvePartyClassName(
      member.charClass ?? member.classId ?? member.classCode ?? 1,
      this.lang,
    )
    font.drawText(ctx, mClassStr, ox + L.row.classRelX, rowY + L.row.subLineOffsetY, {
      font: rowFont,
      color: 'white',
      align: 'left',
    })
    const mLevel = Math.max(1, Number(member.level ?? member.charLevel ?? 1))
    font.drawText(
      ctx,
      `Lvl : ${String(mLevel).padStart(2, ' ')}`,
      ox + L.row.levelRelX,
      rowY + L.row.subLineOffsetY,
      {
        font: rowFont,
        color: 'white',
        align: 'left',
      },
    )

    // 5d. Same-Party Area Name & Life Bar (`0x6fb254a0`)
    if (inSameParty) {
      const areaStr = resolvePartyAreaName(
        Number(member.areaId ?? member.levelId ?? 0),
        this.lang,
      )
      if (areaStr) {
        const displayArea = truncatePartyTextWithEllipsis(
          areaStr,
          L.row.areaMaxWidth,
          font,
          rowFont,
        )
        font.drawText(ctx, displayArea, ox + L.row.areaRelX, rowY + L.row.subLineOffsetY, {
          font: rowFont,
          color: 'white',
          align: 'left',
        })
      }

      const rawLife = Number(member.lifePct ?? 100)
      const clampedPct = Math.max(
        0,
        Math.min(100, rawLife > 100 ? Math.round((rawLife * 100) / 128) : rawLife),
      )
      const fillW = Math.round((L.row.lifeBarW * clampedPct) / 100)
      const barX = ox + L.row.lifeBarRelX
      const barY = rowY + L.row.lifeBarOffsetY
      ctx.fillStyle = '#180808'
      ctx.fillRect(barX, barY, L.row.lifeBarW, L.row.lifeBarH)
      if (fillW > 0) {
        ctx.fillStyle = '#b81818'
        ctx.fillRect(barX, barY, fillW, L.row.lifeBarH)
      }
      if (partyBarImg) {
        ctx.drawImage(
          partyBarImg,
          L.row.separatorLeftW,
          0,
          L.row.lifeBarW,
          L.row.lifeBarH,
          barX,
          barY,
          L.row.lifeBarW,
          L.row.lifeBarH,
        )
      }
    }

    // 5e. Row Controls (`0x6fb269e0`):
    // (1) Hostile box (`partyboxes.dc6` frame 4 peaceful swords at `ox + 14, rowY - 19`, locked peaceful)
    if (partyBoxesImg) {
      ctx.drawImage(
        partyBoxesImg,
        4 * L.row.boxSize,
        0,
        L.row.boxSize,
        L.row.boxSize,
        ox + L.row.hostileRelX,
        rowY - L.row.boxSize,
        L.row.boxSize,
        L.row.boxSize,
      )
    }

    // (2) Main Party Button / Status (`ox + 190`)
    const actionCode = this.resolvePartyActionCode(member)
    const btnCenterX = ox + L.row.partyBtnRelX + Math.trunc(L.row.partyBtnW / 2)
    if (inSameParty) {
      font.drawText(ctx, requireTbl('Yourparty', this.lang), btnCenterX, rowY - 5, {
        font: rowFont,
        color: 'white',
        align: 'center',
      })
    } else if (inAnyParty) {
      font.drawText(ctx, requireTbl('Inparty', this.lang), btnCenterX, rowY - 5, {
        font: rowFont,
        color: 'white',
        align: 'center',
      })
    } else {
      const isBtnPressed =
        this.pressedPartyButton?.kind === 'partyBtn' && this.pressedPartyButton?.rowIndex === i
      if (partyButtonsImg) {
        ctx.drawImage(
          partyButtonsImg,
          (isBtnPressed ? 1 : 0) * L.row.partyBtnW,
          0,
          L.row.partyBtnW,
          L.row.partyBtnH,
          ox + L.row.partyBtnRelX,
          rowY - L.row.partyBtnH,
          L.row.partyBtnW,
          L.row.partyBtnH,
        )
      }
      const btnLabel =
        actionCode === 0x08
          ? requireTbl('Accept', this.lang)
          : actionCode === 0x07
            ? requireTbl('strUiMenu1', this.lang)
            : requireTbl('Invite', this.lang)
      const btnColor: D2ColorCode = actionCode === 0x08 ? 'green' : 'white'
      font.drawText(
        ctx,
        btnLabel,
        btnCenterX + (isBtnPressed ? -2 : 0),
        rowY - 5 + (isBtnPressed ? 2 : 0),
        {
          font: rowFont,
          color: btnColor,
          align: 'center',
        },
      )
    }

    // (3) Loot box (`partyboxes.dc6` frame 14 allowed / 12 disallowed at `ox + 245, rowY - 19`)
    const lootAllowed = Boolean(
      member.lootPermit ?? member.lootAllowed ?? member.lootPermitted,
    )
    const lootFrame = lootAllowed ? 14 : 12
    if (partyBoxesImg) {
      ctx.drawImage(
        partyBoxesImg,
        lootFrame * L.row.boxSize,
        0,
        L.row.boxSize,
        L.row.boxSize,
        ox + L.row.lootRelX,
        rowY - L.row.boxSize,
        L.row.boxSize,
        L.row.boxSize,
      )
    }

    // (4) Squelch / Mute box (`partyboxes.dc6` frame 2 muted / 0 unmuted at `ox + 266, rowY - 19`)
    const muted = Boolean(member.muted ?? member.squelched)
    const muteFrame = muted ? 2 : 0
    if (partyBoxesImg) {
      ctx.drawImage(
        partyBoxesImg,
        muteFrame * L.row.boxSize,
        0,
        L.row.boxSize,
        L.row.boxSize,
        ox + L.row.muteRelX,
        rowY - L.row.boxSize,
        L.row.boxSize,
        L.row.boxSize,
      )
    }

    // (5) Ignore / Ear box (`partyboxes.dc6` frame 10 ignored / 8 unignored at `ox + 287, rowY - 19`)
    const ignored = Boolean(member.ignored ?? member.deafened)
    const ignoreFrame = ignored ? 10 : 8
    if (partyBoxesImg) {
      ctx.drawImage(
        partyBoxesImg,
        ignoreFrame * L.row.boxSize,
        0,
        L.row.boxSize,
        L.row.boxSize,
        ox + L.row.ignoreRelX,
        rowY - L.row.boxSize,
        L.row.boxSize,
        L.row.boxSize,
      )
    }
  }

  // 6. Hover Tooltips (`0x6fb26b20` & `0x6fb25d30`)
  if (this.hoveredPartyControl !== null) {
    const lines = this.resolvePartyHoverTooltipLines(this.hoveredPartyControl)
    if (lines.length > 0) {
      const padX = BUTTON_HOVER_BOX_PAD_X
      const lineH = 16
      const maxLineW = Math.max(...lines.map((l) => font.measureText(l, 'font16')))
      const boxW = Math.max(BUTTON_HOVER_BOX_MIN_W, maxLineW + padX * 2)
      const boxH = lines.length * lineH + 6
      const boxX = Math.max(
        ox + 4,
        Math.min(ox + L.width - boxW - 4, Math.round(this.hoveredPartyControl.centerX - boxW / 2)),
      )
      const boxY = Math.max(oy + 2, this.hoveredPartyControl.anchorY - boxH - 2)
      ctx.fillStyle = STONE_BOX_BG_FILL
      ctx.fillRect(boxX, boxY, boxW, boxH)
      for (let idx = 0; idx < lines.length; idx++) {
        font.drawText(
          ctx,
          lines[idx]!,
          boxX + Math.round(boxW / 2),
          boxY + 15 + idx * lineH,
          {
            font: 'font16',
            color: 'white',
            align: 'center',
          },
        )
      }
    }
  }
}
/**
 * Draw the centered 1.13c Trade Invitation / Waiting stone modal (`D2Client.dll` `0x6fb099e0`):
 * - `pendingModal === 'wait'` (`0x77 0x00`): `"Waiting for other player"` (`strParty9`, `#4104`) + Cancel (`0x4F 0x02`)
 * - `pendingModal === 'request'` (`0x77 0x01`): `"%s wants to trade with you"` (`strParty8`, `#4103`) + OK (`0x4F 0x03`) + Cancel (`0x4F 0x02`)
 */
export function drawPendingTradeModalImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  fontRenderer?: D2FontRenderer | null,
  boxPiecesOverride?: HTMLImageElement | null,
  screenWidth: number = this.viewportWidth,
  screenHeight: number = this.viewportHeight,
): void {
  const mode = this.trade?.pendingModal
  if (mode !== 'wait' && mode !== 'request') return
  const font = fontRenderer ?? this.font ?? this.defaultFont
  const l = this.getPendingTradeModalLayout(screenWidth, screenHeight)
  const boxPiecesImg =
    boxPiecesOverride !== undefined ? boxPiecesOverride : this.getBoxPiecesImage()
  if (boxPiecesImg) {
    drawStoneBoxFrame(ctx, l.x, l.y, l.w, l.h, boxPiecesImg)
  } else {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.fillRect(l.x, l.y, l.w, l.h)
    ctx.strokeStyle = '#6c5c40'
    ctx.strokeRect(l.x + 0.5, l.y + 0.5, l.w - 1, l.h - 1)
  }

  // D2Client.dll 0x6fb099e0 (`0x77 0x00`) & 0x6fb09ac0 (`0x77 0x01`):
  // Line 0 is `D2LANG_GetStringByReferenceIndex(0x0fcb)` (`strWaitingForOtherPlayer`, #4043) for 'wait',
  // and `D2LANG_GetStringByReferenceIndex(0x0fca)` (`string#4042`, "agree to trade" / "同意進行交易") for 'request'
  // without fabricating a placeholder name when `S2C 0x77 0x01` arrives before `S2C 0x78`.
  const partnerName = this.trade?.partnerName?.trim()
  const rawPrompt =
    mode === 'wait'
      ? requireTbl('strWaitingForOtherPlayer', this.lang)
      : partnerName
        ? `${partnerName} ${requireTbl('string#4042', this.lang)}`
        : requireTbl('string#4042', this.lang)
  font.drawText(ctx, rawPrompt, l.x + Math.round(l.w / 2), l.y + 34, {
    font: 'font16',
    color: 'white',
    align: 'center',
  })

  const buttons =
    mode === 'wait'
      ? ([[l.waitCancel, 'lowercasecancel']] as const)
      : ([
          [l.ok, 'ok'],
          [l.cancel, 'lowercasecancel'],
        ] as const)
  ctx.strokeStyle = '#6c5c40'
  for (const [rect, key] of buttons) {
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1)
    font.drawText(ctx, requireTbl(key, this.lang), rect.x + Math.round(rect.w / 2), rect.y + 16, {
      font: 'font16',
      color: 'white',
      align: 'center',
    })
  }
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
export function drawTradePanelImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  fontRenderer?: D2FontRenderer | null,
  assets?: {
    borderLeftImg?: HTMLImageElement | null | undefined
    boxPiecesImg?: HTMLImageElement | null | undefined
    tradeBgImg?: HTMLImageElement | null | undefined
    tradeBtnImg?: HTMLImageElement | null | undefined
    buySellBtnImg?: HTMLImageElement | null | undefined
    goldCoinBtnImg?: HTMLImageElement | null | undefined
    itemsAtlasImg?: HTMLImageElement | null | undefined
    inventory?: InventoryPanel | null | undefined
  },
  screenWidth: number = this.viewportWidth,
  screenHeight: number = this.viewportHeight,
): void {
  const font = fontRenderer ?? this.font ?? this.defaultFont

  // If waiting for trade invitation response before the trade window opens, render only the centered stone modal
  if (
    (this.trade?.pendingModal === 'wait' || this.trade?.pendingModal === 'request') &&
    !this.trade?.active
  ) {
    this.drawPendingTradeModal(ctx, font, assets?.boxPiecesImg, screenWidth, screenHeight)
    return
  }

  // 1. 800x600 decorative left border frame
  if (screenWidth > 640 && assets?.borderLeftImg) {
    ctx.drawImage(assets.borderLeftImg, 0, 0)
  }

  // 2. `Panel\trade.dc6` 320x432 stitched background at (ox, oy)
  const tradeBgImg =
    assets && assets.tradeBgImg !== undefined ? assets.tradeBgImg : this.getTradeBgImage()
  if (tradeBgImg) {
    ctx.drawImage(tradeBgImg, ox, oy, 320, 432)
  } else {
    reportMissingArt('ui-panel', 'trade', 'Missing trade panel background trade.dc6')
  }

  const buySellBtnImg =
    assets && assets.buySellBtnImg !== undefined
      ? assets.buySellBtnImg
      : this.getBuySellBtnImage()
  const goldCoinBtnImg =
    assets && assets.goldCoinBtnImg !== undefined
      ? assets.goldCoinBtnImg
      : this.getGoldCoinBtnImage()
  const itemsAtlasImg =
    assets && assets.itemsAtlasImg !== undefined
      ? assets.itemsAtlasImg
      : this.getItemsAtlasImage()

  // 3. Partner & Self names (D2Client.dll 0x6fb4a476..0x6fb4a515: font16 white, truncated to <= 112px)
  const truncate112 = (raw: string): string => {
    let s = raw
    while (s.length > 1 && font.measureText(s, 'font16') > 112) {
      s = s.slice(0, -1)
    }
    return s
  }
  const isEn = this.lang === 'ENG' || this.language === 'en'
  const partnerName = truncate112(
    String(this.trade?.partnerName || (isEn ? 'Partner' : '交易對象')),
  )
  const selfName = truncate112(
    String(this.trade?.selfName || (isEn ? 'Player' : '玩家')),
  )
  font.drawText(ctx, partnerName, ox + 25, oy + 27, {
    font: 'font16',
    color: 'white',
    align: 'left',
  })
  font.drawText(ctx, selfName, ox + 25, oy + 242, {
    font: 'font16',
    color: 'white',
    align: 'left',
  })

  // 4. "Gold" labels (#2215) & gold amounts (D2Client.dll 0x6fb3c8b0 & 0x6fb4a51a..0x6fb4a5e0)
  const labelFont = this.lang === 'CHI' ? 'font8' : 'font6'
  const goldLabel = requireTbl('Gold', this.lang)
  font.drawText(ctx, goldLabel, ox + 187, oy + 27, {
    font: labelFont,
    color: 'white',
    align: 'center',
  })
  font.drawText(ctx, goldLabel, ox + 187, oy + 242, {
    font: labelFont,
    color: 'white',
    align: 'center',
  })

  const partnerGold = Math.max(0, Math.floor(Number(this.trade?.partnerGold ?? 0) || 0))
  const selfGold = Math.max(
    0,
    Math.floor(Number(this.trade?.selfGold ?? this.trade?.myGold ?? 0) || 0),
  )
  font.drawText(ctx, String(partnerGold), ox + 292, oy + 27, {
    font: 'font16',
    color: 'white',
    align: 'right',
  })
  font.drawText(ctx, String(selfGold), ox + 292, oy + 242, {
    font: 'font16',
    color: 'white',
    align: 'right',
  })

  // 5. Self gold coin button (`goldcoinbtn.dc6` frame 0/1, 20x18 at ox + 145, oy + 221)
  if (goldCoinBtnImg) {
    const coinFrame = this.pressedTradeButton === 'gold' ? 1 : 0
    ctx.drawImage(goldCoinBtnImg, 0, coinFrame * 18, 20, 18, ox + 145, oy + 221, 20, 18)
  }

  // 6. Partner 10x4 grid (ox + 18, oy + 36) & Self 10x4 grid (ox + 18, oy + 252), 29x29 cells
  const playerCtx = this.getEffectivePlayerContext()
  const drawTradeGridItems = (
    gridOriginX: number,
    gridOriginY: number,
    items: readonly any[] | undefined,
  ) => {
    if (!items) return
    for (const rawIt of items) {
      const it = rawIt as UiInventoryItem
      const gx = Math.max(0, Math.min(9, Number((rawIt as any).gridX ?? (rawIt as any).col ?? 0)))
      const gy = Math.max(0, Math.min(3, Number((rawIt as any).gridY ?? (rawIt as any).row ?? 0)))
      const gw = Math.max(1, Number(it.invWidth ?? (rawIt as any).w ?? 1))
      const gh = Math.max(1, Number(it.invHeight ?? (rawIt as any).h ?? 1))
      const cellX = gridOriginX + gx * 29
      const cellY = gridOriginY + gy * 29
      const cellW = gw * 29
      const cellH = gh * 29
      const isHovered =
        this.hoveredTradeItem?.item === it ||
        (this.hoveredTradeItem?.item?.id !== undefined &&
          String(this.hoveredTradeItem.item.id) ===
            String((rawIt as any).id ?? (rawIt as any).itemId))
      const fill = resolveGridItemBackgroundFill(it, playerCtx, { isHovered })
      ctx.fillStyle = fill
      ctx.fillRect(cellX, cellY, cellW, cellH)
      this.drawItemSprite(ctx, it, cellX, cellY, cellW, cellH, itemsAtlasImg, isHovered)
    }
  }
  drawTradeGridItems(ox + 18, oy + 36, this.trade?.partnerItems)
  drawTradeGridItems(ox + 18, oy + 252, this.trade?.selfItems ?? this.trade?.myItems)

  // 7. Partner accept indicator (`buysellbtn.dc6` frame 16/17 at ox + 275, oy + 170),
  //    Self accept button (`buysellbtn.dc6` frame 16/17 at ox + 223, oy + 384),
  //    and Cancel [X] button (`buysellbtn.dc6` frame 10/11 at ox + 275, oy + 384)
  //    D2Client.dll 0x6fb4a262..0x6fb4a370:
  //    - Partner accepted (`g_bPartnerAccepted != 0`): frame 17 tinted green (`colorTint = 2`, `0x6fabd0e4`).
  //    - Self accept disabled (`g_bAcceptDisabled != 0`): frame 16 tinted red (`colorTint = 1`, `0x6fabd0e4`).
  //    - Self accepted (`g_bSelfAccepted != 0`): frame 17 tinted green (`colorTint = 2`, `0x6fabd0e4`).
  const partnerAccepted = Boolean(this.trade?.partnerAccepted)
  const selfAccepted = Boolean(this.trade?.selfAccepted ?? this.trade?.myAccepted)
  if (buySellBtnImg) {
    const partnerFrame = partnerAccepted ? 17 : 16
    ctx.drawImage(buySellBtnImg, partnerFrame * 32, 0, 32, 32, ox + 275, oy + 170, 32, 32)

    const selfFrame = !this.trade?.acceptDisabled && selfAccepted ? 17 : 16
    ctx.drawImage(buySellBtnImg, selfFrame * 32, 0, 32, 32, ox + 223, oy + 384, 32, 32)

    const cancelFrame = this.pressedTradeButton === 'cancel' ? 11 : 10
    ctx.drawImage(buySellBtnImg, cancelFrame * 32, 0, 32, 32, ox + 275, oy + 384, 32, 32)
  }

  if (partnerAccepted) {
    ctx.fillStyle = 'rgba(0, 200, 0, 0.42)'
    ctx.fillRect(ox + 275, oy + 170, 32, 32)
  }

  // D2Client.dll 0x6fb4a2d3..0x6fb4a370: red lockout overlay when `acceptDisabled`, or green tint when `selfAccepted`
  if (this.trade?.acceptDisabled) {
    ctx.fillStyle = 'rgba(180, 0, 0, 0.55)'
    ctx.fillRect(ox + 223, oy + 384, 32, 32)
  } else if (selfAccepted) {
    ctx.fillStyle = 'rgba(0, 200, 0, 0.42)'
    ctx.fillRect(ox + 223, oy + 384, 32, 32)
  }

  // 8. Button hover tooltips (D2Client.dll 0x6fb09810: cancel #4130, accept #4131, gold #4046 strTradeGoldHowMuch)
  if (this.hoveredTradeButton === 'cancel') {
    const tip = requireTbl('string#4130', this.lang)
    const w = font.measureText(tip, 'font16')
    const bx = ox + 291 - Math.trunc(w / 2) - 6
    const by = oy + 358
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.fillRect(bx, by, w + 12, 22)
    font.drawText(ctx, tip, ox + 291, by + 16, {
      font: 'font16',
      color: 'white',
      align: 'center',
    })
  } else if (this.hoveredTradeButton === 'selfAccept') {
    const tip = requireTbl('string#4131', this.lang)
    const w = font.measureText(tip, 'font16')
    const bx = ox + 239 - Math.trunc(w / 2) - 6
    const by = oy + 358
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.fillRect(bx, by, w + 12, 22)
    font.drawText(ctx, tip, ox + 239, by + 16, {
      font: 'font16',
      color: 'white',
      align: 'center',
    })
  } else if (this.hoveredTradeButton === 'gold') {
    const tip = requireTbl('strTradeGoldHowMuch', this.lang)
    const w = font.measureText(tip, 'font16')
    const bx = ox + 100 - Math.trunc(w / 2) - 6
    const by = oy + 195
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.fillRect(bx, by, w + 12, 22)
    font.drawText(ctx, tip, ox + 100, by + 16, {
      font: 'font16',
      color: 'white',
      align: 'center',
    })
  } else if (this.hoveredTradeButton === 'partnerAccept' && this.trade?.partnerAccepted) {
    const tip = requireTbl('string#4131', this.lang)
    const w = font.measureText(tip, 'font16')
    const bx = ox + 291 - Math.trunc(w / 2) - 6
    const by = oy + 144
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.fillRect(bx, by, w + 12, 22)
    font.drawText(ctx, tip, ox + 291, by + 16, {
      font: 'font16',
      color: 'white',
      align: 'center',
    })
  }

  if (this.trade?.pendingModal === 'wait' || this.trade?.pendingModal === 'request') {
    this.drawPendingTradeModal(ctx, font, assets?.boxPiecesImg, screenWidth, screenHeight)
  }
}
