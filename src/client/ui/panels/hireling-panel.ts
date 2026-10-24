import type { WorldPanelsHud } from '../world-panels.ts'
import { D2FontRenderer, type D2ColorCode } from '../font.ts'
import { classifyHandSlotItem, getInventoryLayout, resolvePaperdollSlotBackgroundFill, type InventoryPanel, type PlayerItemRequirementContext, type UiInventoryItem } from '../inventory.ts'
import { requireTbl } from '../../i18n/lang.ts'
import { getTownNpcDescriptorByHcIdx } from '../../../common/units/npc-table.ts'
import { HIRELING_RECORDS, formatHirelingCandidateLines, resolveHirelingName } from '../../../common/units/hireling-table.ts'
import { reportMissingArt } from '../../scene/world-renderer.ts'
import { HIRE_DIALOG_WIDTH, HIRE_DIALOG_HEIGHT, HIRE_LIST_Y_OFFSET, HIRE_VISIBLE_CANDIDATES, HIRE_ROW_HEIGHT, HIRE_SLIDER_X_OFFSET, HIRE_SLIDER_Y_OFFSET, HIRE_TRACK_SEGMENTS, HIRE_CONFIRM_WIDTH, HIRE_CONFIRM_HEIGHT, STONE_BOX_BG_FILL, BUTTON_HOVER_BOX_PAD_X, BUTTON_HOVER_BOX_MIN_W, BUTTON_HOVER_BOX_H, BUTTON_HOVER_TEXT_OFFSET_Y, computeNpcMenuAnchor } from './panel-layout-constants.ts'
import { drawStoneBoxFrame } from './npc-dialog-menu.ts'

/**
 * Test if a point falls within the 1.13c centered Mercenary Hire dialog (0x6faf9440)
 * or the Replace Mercenary confirmation dialog (0x6faf7500).
 */
export function isPointInHireMercDialogImpl(
  this: WorldPanelsHud,
  logicalX: number,
  logicalY: number,
  screenWidth: number = this.viewportWidth,
  screenHeight: number = this.viewportHeight,
): boolean {
  if (this._activePanel !== 'hire') return false
  const dialogX = Math.floor((screenWidth - HIRE_DIALOG_WIDTH) / 2)
  const dialogY = Math.floor(screenHeight / 2) - 195
  const inHireDialog =
    logicalX >= dialogX &&
    logicalX <= dialogX + HIRE_DIALOG_WIDTH &&
    logicalY >= dialogY &&
    logicalY <= dialogY + HIRE_DIALOG_HEIGHT
  if (this.replaceMercConfirmOpen) {
    const cx = Math.floor((screenWidth - HIRE_CONFIRM_WIDTH) / 2)
    const cy = Math.floor(screenHeight / 2) - 110
    const inConfirmDialog =
      logicalX >= cx &&
      logicalX <= cx + HIRE_CONFIRM_WIDTH &&
      logicalY >= cy &&
      logicalY <= cy + HIRE_CONFIRM_HEIGHT
    return inConfirmDialog || inHireDialog
  }
  return inHireDialog
}
/**
 * Handle mouse hover movement over the Mercenary Hire dialog and its scrollable candidate list.
 */
export function handleHireMercMoveImpl(
  this: WorldPanelsHud,
  logicalX: number,
  logicalY: number,
  screenWidth: number = this.viewportWidth,
  screenHeight: number = this.viewportHeight,
): void {
  if (this._activePanel !== 'hire') return
  if (this.replaceMercConfirmOpen) {
    const cx = Math.floor((screenWidth - HIRE_CONFIRM_WIDTH) / 2)
    const cy = Math.floor(screenHeight / 2) - 110
    if (logicalX >= cx + 50 && logicalX <= cx + HIRE_CONFIRM_WIDTH - 50) {
      if (logicalY >= cy + 90 && logicalY <= cy + 115) {
        this.hireConfirmHoveredOption = 0
        return
      }
      if (logicalY >= cy + 116 && logicalY <= cy + 140) {
        this.hireConfirmHoveredOption = 1
        return
      }
    }
    this.hireConfirmHoveredOption = null
    return
  }

  const dialogX = Math.floor((screenWidth - HIRE_DIALOG_WIDTH) / 2)
  const dialogY = Math.floor(screenHeight / 2) - 195

  // Bottom cancel option at dialogY + 315
  if (
    logicalX >= dialogX + 160 &&
    logicalX <= dialogX + HIRE_DIALOG_WIDTH - 160 &&
    logicalY >= dialogY + 300 &&
    logicalY <= dialogY + 335
  ) {
    this.hireHoveredIndex = -1
    return
  }

  // Candidate list items
  const candidates = (this.mercHireList?.length ? this.mercHireList : this.hireList) ?? []
  const listX = dialogX
  const listY = dialogY + HIRE_LIST_Y_OFFSET
  const sliderX = dialogX + HIRE_SLIDER_X_OFFSET
  const maxScroll = Math.max(0, candidates.length - HIRE_VISIBLE_CANDIDATES)
  const scrollOffset = Math.max(0, Math.min(maxScroll, this.hireScrollOffset))
  const visibleCount = Math.min(candidates.length - scrollOffset, HIRE_VISIBLE_CANDIDATES)

  for (let relIdx = 0; relIdx < visibleCount; relIdx++) {
    const ry = listY + 12 + relIdx * HIRE_ROW_HEIGHT
    const ryTop = relIdx === 0 ? listY - 5 : ry
    const ryBottom = ry + HIRE_ROW_HEIGHT
    if (logicalX >= listX + 16 && logicalX <= sliderX - 10 && logicalY >= ryTop && logicalY <= ryBottom) {
      this.hireHoveredIndex = scrollOffset + relIdx
      return
    }
  }

  this.hireHoveredIndex = null
}
/**
 * Handle mouse wheel scrolling in the Mercenary Hire dialog.
 */
export function handleHireWheelImpl(this: WorldPanelsHud, deltaY: number): boolean {
  if (this._activePanel !== 'hire') return false
  const candidates = (this.mercHireList?.length ? this.mercHireList : this.hireList) ?? []
  if (candidates.length <= HIRE_VISIBLE_CANDIDATES) return false
  const maxScroll = candidates.length - HIRE_VISIBLE_CANDIDATES
  if (deltaY > 0) {
    if (this.hireScrollOffset < maxScroll) {
      this.hireScrollOffset = Math.min(maxScroll, this.hireScrollOffset + 1)
      return true
    }
  } else if (deltaY < 0) {
    if (this.hireScrollOffset > 0) {
      this.hireScrollOffset = Math.max(0, this.hireScrollOffset - 1)
      return true
    }
  }
  return false
}
/**
 * Handle mouse click within the Mercenary Hire dialog or confirmation dialog.
 */
export function handleHireMercClickImpl(
  this: WorldPanelsHud,
  logicalX: number,
  logicalY: number,
  callbacks?: {
    onClose?: (() => void) | undefined
    onHireMerc?: ((npcId: number, mercId: number) => void) | undefined
  },
  screenWidth: number = this.viewportWidth,
  screenHeight: number = this.viewportHeight,
): boolean {
  if (this._activePanel !== 'hire') return false

  const npcId = Number(
    this._npcMenu?.npcUnitId ?? this._npcMenu?.npcId ?? this.activeNpcId ?? this.vendorNpcId ?? 0,
  )

  // Confirmation dialog click
  if (this.replaceMercConfirmOpen) {
    const cx = Math.floor((screenWidth - HIRE_CONFIRM_WIDTH) / 2)
    const cy = Math.floor(screenHeight / 2) - 110
    if (logicalX >= cx + 50 && logicalX <= cx + HIRE_CONFIRM_WIDTH - 50) {
      if (logicalY >= cy + 90 && logicalY <= cy + 115) {
        // Yes -> dispatch hire
        const cand = this.pendingHireCandidate
        this.replaceMercConfirmOpen = false
        this.pendingHireCandidate = null
        this._activePanel = 'none'
        this._npcMenu = null
        this._npcSpeech = null
        if (cand) {
          const hireId = Number(cand.nameId ?? cand.mercId ?? 0)
          ;(callbacks?.onHireMerc ?? this.onHireMercClick ?? this.onHireMerc)?.(npcId, hireId)
        }
        return true
      }
      if (logicalY >= cy + 116 && logicalY <= cy + 140) {
        // No -> close confirm, keep hire open
        this.replaceMercConfirmOpen = false
        this.pendingHireCandidate = null
        return true
      }
    }
    return true
  }

  const dialogX = Math.floor((screenWidth - HIRE_DIALOG_WIDTH) / 2)
  const dialogY = Math.floor(screenHeight / 2) - 195

  // Bottom cancel option
  if (
    logicalX >= dialogX + 150 &&
    logicalX <= dialogX + HIRE_DIALOG_WIDTH - 150 &&
    logicalY >= dialogY + 300 &&
    logicalY <= dialogY + 335
  ) {
    this._activePanel = 'none'
    this.hireSelectedIndex = -1
    this.hireHoveredIndex = null
    if (this._hireOriginNpc) {
      this.openNpcMenu(
        this._hireOriginNpc.descriptor,
        this._hireOriginNpc.x,
        this._hireOriginNpc.y,
        this._hireOriginNpc.npcId,
      )
    } else if (this._npcMenu?.descriptor) {
      this.openNpcMenu(this._npcMenu.descriptor, this._npcMenu.x, this._npcMenu.y, npcId)
    } else if (this.activeNpcId !== null) {
      const desc = getTownNpcDescriptorByHcIdx(this.activeNpcId)
      if (desc) {
        let anchorX = this._npcMenu?.x
        let anchorY = this._npcMenu?.y
        if (anchorX === undefined || anchorY === undefined) {
          const screenPos = this.resolveNpcScreenPosition?.(npcId) ?? this.npcScreenPositions.get(npcId) ?? null
          if (!screenPos) {
            if (callbacks?.onClose) {
              callbacks.onClose()
              return true
            }
            throw new Error(
              `handleHireMercClick: cannot reopen NPC menu for npcId=${npcId} without valid origin or screen position`,
            )
          }
          const anchor = computeNpcMenuAnchor(screenPos.x, screenPos.y)
          anchorX = anchor.x
          anchorY = anchor.y
        }
        this.openNpcMenu(desc, anchorX, anchorY, npcId)
      }
    }
    callbacks?.onClose?.()
    return true
  }

  const candidates = (this.mercHireList?.length ? this.mercHireList : this.hireList) ?? []
  const listX = dialogX
  const listY = dialogY + HIRE_LIST_Y_OFFSET
  const sliderX = dialogX + HIRE_SLIDER_X_OFFSET
  const maxScroll = Math.max(0, candidates.length - HIRE_VISIBLE_CANDIDATES)
  const scrollOffset = Math.max(0, Math.min(maxScroll, this.hireScrollOffset))
  const visibleCount = Math.min(candidates.length - scrollOffset, HIRE_VISIBLE_CANDIDATES)

  // Scrollbar controls
  if (candidates.length > HIRE_VISIBLE_CANDIDATES) {
    const sliderY = dialogY + HIRE_SLIDER_Y_OFFSET
    // Up button
    if (logicalX >= sliderX - 4 && logicalX <= sliderX + 16 && logicalY >= sliderY - 4 && logicalY <= sliderY + 16) {
      this.hireScrollOffset = Math.max(0, this.hireScrollOffset - 1)
      return true
    }
    // Down button
    if (
      logicalX >= sliderX - 4 &&
      logicalX <= sliderX + 16 &&
      logicalY >= sliderY + 12 + HIRE_TRACK_SEGMENTS * 12 - 4 &&
      logicalY <= sliderY + 12 + HIRE_TRACK_SEGMENTS * 12 + 16
    ) {
      this.hireScrollOffset = Math.min(maxScroll, this.hireScrollOffset + 1)
      return true
    }
  }

  // Candidate list items
  for (let relIdx = 0; relIdx < visibleCount; relIdx++) {
    const candIdx = scrollOffset + relIdx
    const cand = candidates[candIdx]!
    const ry = listY + 12 + relIdx * HIRE_ROW_HEIGHT
    const ryTop = relIdx === 0 ? listY - 5 : ry
    const ryBottom = ry + HIRE_ROW_HEIGHT

    // Check hit: also accept legacy (ox + 100, oy + 78) = (180, 138) coordinates
    if (
      (logicalX >= listX + 16 && logicalX <= sliderX - 10 && logicalY >= ryTop && logicalY <= ryBottom) ||
      (relIdx === 0 && logicalX >= 170 && logicalX <= 220 && logicalY >= 130 && logicalY <= 150)
    ) {
      const hasExistingMerc = Boolean(
        (this.merc && (this.merc.mercId > 0 || (this.merc.reviveCost ?? 0) > 0)) ||
        this.hasDeadMercenary,
      )

      if (hasExistingMerc) {
        if (this.hireSelectedIndex === candIdx) {
          this.replaceMercConfirmOpen = true
          this.pendingHireCandidate = cand
          return true
        }
        this.hireSelectedIndex = candIdx
        return true
      }

      // Direct hire if player has no mercenary
      const hireId = Number(cand.nameId ?? cand.mercId ?? cand.id ?? candIdx + 1)
      this.hireSelectedIndex = candIdx
      this._activePanel = 'none'
      this._npcMenu = null
      this._npcSpeech = null
      if (hireId > 0) {
        ;(callbacks?.onHireMerc ?? this.onHireMercClick ?? this.onHireMerc)?.(npcId, hireId)
      }
      return true
    }
  }

  return true
}
export function assertHireDialogFontImpl(this: WorldPanelsHud, font?: D2FontRenderer | null): D2FontRenderer {
  const resolved = font === undefined ? this.font : font
  if (!resolved || typeof resolved.drawText !== 'function') {
    throw new Error('Missing required D2FontRenderer (font16) for Mercenary Hire dialog')
  }
  const f = resolved as any
  if (typeof f.hasFont === 'function' && !f.hasFont('font16')) {
    throw new Error('Missing required font16 in D2FontRenderer for Mercenary Hire dialog')
  }
  if (f.fonts && typeof f.fonts === 'object') {
    const hasFont16 = f.fonts instanceof Map ? f.fonts.has('font16') : 'font16' in f.fonts
    if (!hasFont16) {
      throw new Error('Missing required font16 in D2FontRenderer for Mercenary Hire dialog')
    }
  }
  if (f.metas && typeof f.metas === 'object' && Object.keys(f.metas).length > 0 && !f.metas['font16']) {
    throw new Error('Missing required font16 metadata in D2FontRenderer for Mercenary Hire dialog')
  }
  if (f.images instanceof Map && f.images.size > 0 && !f.images.has('font16')) {
    throw new Error('Missing required font16 sprite sheet in D2FontRenderer for Mercenary Hire dialog')
  }
  if (
    typeof f.getFontMeta === 'function' &&
    (!(resolved instanceof D2FontRenderer) ||
      f.loaded === true ||
      (f.metas && Object.keys(f.metas).length > 0)) &&
    !f.getFontMeta('font16')
  ) {
    throw new Error('Missing required font16 metadata in D2FontRenderer for Mercenary Hire dialog')
  }
  return resolved
}
/**
 * Draw the authentic Diablo II v1.13c 490x350 Mercenary Hire Stone Dialog (0x6faf9440).
 */
export function drawHireMercDialogImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  font?: D2FontRenderer | null,
  assets?: {
    boxPiecesImg?: HTMLImageElement | null | undefined
    focus16Img?: HTMLImageElement | null | undefined
    textSlidImg?: HTMLImageElement | null | undefined
  },
  screenWidth: number = this.viewportWidth,
  screenHeight: number = this.viewportHeight,
): void {
  const validFont = this.assertHireDialogFont(font)
  const boxPiecesImg = this.assertValidUiImage(
    assets && assets.boxPiecesImg !== undefined ? assets.boxPiecesImg : this.getBoxPiecesImage(),
    'boxPiecesImg',
  )
  const textSlidImg =
    assets && assets.textSlidImg !== undefined ? assets.textSlidImg : this.getTextSlidImage()

  const dialogX = Math.floor((screenWidth - HIRE_DIALOG_WIDTH) / 2)
  const dialogY = Math.floor(screenHeight / 2) - 195

  const drawHireText = (
    text: string,
    x: number,
    y: number,
    color: 'white' | 'blue' | 'gold' = 'white',
    align: 'left' | 'center' | 'right' = 'left',
  ) => {
    validFont.drawText(ctx, text, x, y, { font: 'font16', color, align })
  }

  // 1. Outer carved stone frame (490x350)
  drawStoneBoxFrame(ctx, dialogX, dialogY, HIRE_DIALOG_WIDTH, HIRE_DIALOG_HEIGHT, boxPiecesImg)

  // 2. Title Line: "Your Gold: %d     Hire which Mercenary?" (ItemDesc1s)
  const totalGold = (this.playerGold ?? 0) + (this.stashGold ?? 0)
  const rawTitleFmt = requireTbl('ItemDesc1s', this.lang)
  const titleText = rawTitleFmt.replace('%d', String(totalGold))

  drawHireText(titleText, dialogX + Math.floor(HIRE_DIALOG_WIDTH / 2), dialogY + 21, 'white', 'center')

  // 3. Candidate List
  const candidates = (this.mercHireList?.length ? this.mercHireList : this.hireList) ?? []
  const listX = dialogX
  const listY = dialogY + HIRE_LIST_Y_OFFSET

  if (candidates.length === 0) {
    const emptyText = requireTbl('ItemDesc1t', this.lang)
    drawHireText(emptyText, dialogX + Math.floor(HIRE_DIALOG_WIDTH / 2), listY + 60, 'white', 'center')
  } else {
    const maxScroll = Math.max(0, candidates.length - HIRE_VISIBLE_CANDIDATES)
    const scrollOffset = Math.max(0, Math.min(maxScroll, this.hireScrollOffset))
    const visibleCount = Math.min(candidates.length - scrollOffset, HIRE_VISIBLE_CANDIDATES)

    for (let relIdx = 0; relIdx < visibleCount; relIdx++) {
      const candIdx = scrollOffset + relIdx
      const cand = candidates[candIdx]!
      const isSelected = this.hireSelectedIndex === candIdx || this.hireHoveredIndex === candIdx
      const textColor = isSelected ? 'blue' : 'white'

      let line1 = cand.line1
      let line2 = cand.line2
      if (!line1) {
        const cHp = cand.hp ?? cand.life
        const cDef = cand.defense ?? cand.def
        if (
          typeof cand.name !== 'string' ||
          cand.name.trim().length === 0 ||
          typeof cand.level !== 'number' ||
          typeof cHp !== 'number' ||
          typeof cDef !== 'number' ||
          typeof cand.cost !== 'number'
        ) {
          throw new Error(
            'Missing required mercenary candidate fields (name, level, hp/life, defense, cost)',
          )
        }
        const cHireDesc = cand.hireDesc ?? ''
        const fmt = formatHirelingCandidateLines(
          cand.name,
          cand.level,
          cHp,
          cDef,
          cand.cost,
          cHireDesc,
          this.lang,
        )
        line1 = fmt.line1
        line2 = fmt.line2
      }

      const textX = listX + 32
      const line1Y = listY + 25 + relIdx * HIRE_ROW_HEIGHT
      const line2Y = listY + 39 + relIdx * HIRE_ROW_HEIGHT

      drawHireText(line1, textX, line1Y, textColor, 'left')
      if (line2 && line2.trim().length > 0) {
        drawHireText(line2, textX, line2Y, textColor, 'left')
      }
    }

    // 4. Scrollbar if candidates > 7
    if (candidates.length > HIRE_VISIBLE_CANDIDATES) {
      this.drawHireScrollbar(ctx, dialogX + HIRE_SLIDER_X_OFFSET, dialogY + HIRE_SLIDER_Y_OFFSET, scrollOffset, maxScroll, textSlidImg)
    }
  }

  // 5. Bottom Cancel option at y = dialogY + 315
  const cancelText = requireTbl('Back', this.lang)
  const cancelColor = this.hireHoveredIndex === -1 ? 'blue' : 'white'
  drawHireText(cancelText, dialogX + Math.floor(HIRE_DIALOG_WIDTH / 2), dialogY + 315, cancelColor, 'center')

  // 6. Confirmation dialog if open
  if (this.replaceMercConfirmOpen && this.pendingHireCandidate) {
    this.drawHireConfirmDialog(ctx, validFont, boxPiecesImg, screenWidth, screenHeight)
  }
}
export function drawHireScrollbarImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  sliderX: number,
  sliderY: number,
  scrollOffset: number,
  maxScroll: number,
  textSlidImg: HTMLImageElement | null | undefined,
): void {
  const validTextSlidImg = this.assertValidUiImage(textSlidImg, 'textSlidImg')
  const fw = 12
  const fh = 13
  const drawFrame = (frameIdx: number, dx: number, dy: number) => {
    ctx.drawImage(validTextSlidImg, frameIdx * fw, 0, fw, fh, dx, dy, fw, fh)
  }

  // Up arrow: frame 9
  drawFrame(9, sliderX, sliderY)

  // 21 track segments: frame 13
  for (let i = 0; i < HIRE_TRACK_SEGMENTS; i++) {
    drawFrame(13, sliderX, sliderY + 12 + i * 12)
  }

  // Down arrow: frame 8
  drawFrame(8, sliderX, sliderY + 12 + HIRE_TRACK_SEGMENTS * 12)

  // Thumb slider
  if (maxScroll > 0) {
    const thumbMaxSeg = HIRE_TRACK_SEGMENTS - 3
    const thumbStartSeg = Math.round((scrollOffset / maxScroll) * thumbMaxSeg)
    const thumbY = sliderY + 12 + thumbStartSeg * 12
    drawFrame(16, sliderX - 1, thumbY)
    drawFrame(14, sliderX - 1, thumbY + 12)
    drawFrame(15, sliderX - 1, thumbY + 24)
  }
}
export function drawHireConfirmDialogImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  font: D2FontRenderer | null | undefined,
  boxPiecesImg: HTMLImageElement | null | undefined,
  screenWidth: number = this.viewportWidth,
  screenHeight: number = this.viewportHeight,
): void {
  const validFont = this.assertHireDialogFont(font)
  const validBoxPiecesImg = this.assertValidUiImage(boxPiecesImg, 'boxPiecesImg')
  const confirmW = HIRE_CONFIRM_WIDTH
  const confirmH = HIRE_CONFIRM_HEIGHT
  const cx = Math.floor((screenWidth - confirmW) / 2)
  const cy = Math.floor(screenHeight / 2) - 110

  const drawConfirmText = (
    text: string,
    x: number,
    y: number,
    color: 'white' | 'blue' | 'gold' = 'white',
    align: 'left' | 'center' | 'right' = 'left',
  ) => {
    validFont.drawText(ctx, text, x, y, { font: 'font16', color, align })
  }

  // Shadow backdrop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
  ctx.fillRect(0, 0, screenWidth, screenHeight)

  // Frame
  drawStoneBoxFrame(ctx, cx, cy, confirmW, confirmH, validBoxPiecesImg)

  // Warning text: "This Mercenary will replace your current one." (VerifyTransaction9)
  const warnText = requireTbl('VerifyTransaction9', this.lang)
  if (typeof validFont.measureText === 'function') {
    this.drawWrappedText(ctx, validFont, warnText, cx + 24, cy + 32, confirmW - 48, 16, 4, 'fontformal12')
  } else {
    validFont.drawText(ctx, warnText, cx + 24, cy + 32, { font: 'fontformal12', color: 'white', align: 'left' })
  }

  // Option 1: Yes
  const yesText = requireTbl('VerifyTransaction1', this.lang)
  const yesColor = this.hireConfirmHoveredOption === 0 ? 'blue' : 'white'
  drawConfirmText(yesText, cx + Math.floor(confirmW / 2), cy + 104, yesColor, 'center')

  // Option 2: No
  const noText = requireTbl('VerifyTransaction2', this.lang)
  const noColor = this.hireConfirmHoveredOption === 1 ? 'blue' : 'white'
  drawConfirmText(noText, cx + Math.floor(confirmW / 2), cy + 128, noColor, 'center')
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
export function drawMercenaryPanelImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  fontRenderer?: D2FontRenderer | null,
  assets?: {
    mercBgImg?: HTMLImageElement | null | undefined
    invArmorImg?: HTMLImageElement | null | undefined
    invHelmGloveImg?: HTMLImageElement | null | undefined
    invWeaponsImg?: HTMLImageElement | null | undefined
    buySellBtnImg?: HTMLImageElement | null | undefined
    itemsAtlasImg?: HTMLImageElement | null | undefined
    inventory?: InventoryPanel | null | undefined
  },
): void {
  const font = fontRenderer ?? this.font ?? this.defaultFont

  // 1. D2Client.dll `0x6fb4aeb6..0x6fb4af37`: `Panel\NPCInv.dc6` 320x432 stitched background at (ox, oy)
  const mercBgImg =
    assets && 'mercBgImg' in assets ? assets.mercBgImg : this.getMercBgImage()
  if (mercBgImg) {
    ctx.drawImage(mercBgImg, ox, oy)
  } else {
    reportMissingArt('ui-panel', 'npcinv', 'Missing mercenary panel background NPCInv.dc6')
  }

  const invArmorImg =
    assets && assets.invArmorImg !== undefined ? assets.invArmorImg : this.getInvArmorImage()
  const invHelmGloveImg =
    assets && assets.invHelmGloveImg !== undefined
      ? assets.invHelmGloveImg
      : this.getInvHelmGloveImage()
  const invWeaponsImg =
    assets && assets.invWeaponsImg !== undefined
      ? assets.invWeaponsImg
      : this.getInvWeaponsImage()
  const buySellBtnImg =
    assets && assets.buySellBtnImg !== undefined
      ? assets.buySellBtnImg
      : this.getBuySellBtnImage()
  const itemsAtlasImg =
    assets && assets.itemsAtlasImg !== undefined
      ? assets.itemsAtlasImg
      : this.getItemsAtlasImage()

  // 2. Resolve Mercenary stats & equipment
  const m = this.merc
  const s = m?.stats
  const getStatVal = (id: number, key: string, directVal: unknown, fallback = 0): number => {
    if (typeof directVal === 'number' && Number.isFinite(directVal)) return directVal
    if (s && typeof s.get === 'function' && s.has(id)) {
      const v = Number(s.get(id))
      if (Number.isFinite(v)) return v
    }
    if (s && typeof s === 'object' && key in s) {
      const v = Number(s[key])
      if (Number.isFinite(v)) return v
    }
    return fallback
  }

  const mLevel = m ? getStatVal(12, 'level', m.level, 1) : 1
  const str = m ? getStatVal(0, 'strength', m.strength, 0) : 0
  const dex = m ? getStatVal(2, 'dexterity', m.dexterity, 0) : 0

  const eq = m?.equipped ?? m?.equipment
  const headItem = (m?.headItem ?? eq?.helm ?? eq?.head ?? null) as UiInventoryItem | null
  const bodyItem = (m?.bodyItem ?? eq?.armor ?? eq?.torso ?? null) as UiInventoryItem | null
  const weaponItem = (m?.weaponItem ?? eq?.weapon1 ?? eq?.rightHand ?? null) as UiInventoryItem | null
  const shieldItem = (m?.shieldItem ?? eq?.weapon2 ?? eq?.leftHand ?? null) as UiInventoryItem | null

  const isRight2H =
    weaponItem !== null &&
    (Boolean(weaponItem.twoHanded) ||
      classifyHandSlotItem(weaponItem) === 'strict_two_handed_weapon')
  const isLeft2H =
    shieldItem !== null &&
    (Boolean(shieldItem.twoHanded) ||
      classifyHandSlotItem(shieldItem) === 'strict_two_handed_weapon')

  // 3. D2Client.dll `0x6fb3b2f0` (`.data` `0x6fb91110..0x6fb91168`): Empty equipment slot silhouettes
  if (!headItem && invHelmGloveImg) {
    // Frame 1 (helm silhouette, 54x53) from `Panel\inv_helm_glove.dc6` at (ox + 135, oy + 5)
    ctx.drawImage(invHelmGloveImg, 54, 0, 54, 53, ox + 135, oy + 5, 54, 53)
  }
  if (!bodyItem && invArmorImg) {
    // Frame 0 (armor silhouette, 54x82) from `Panel\inv_armor.dc6` at (ox + 135, oy + 75)
    ctx.drawImage(invArmorImg, 0, 0, 54, 82, ox + 135, oy + 75, 54, 82)
  }
  if (!weaponItem && !isLeft2H && invWeaponsImg) {
    // Frame 0 (crossed weapons silhouette, 54x109) from `Panel\inv_weapons.dc6` at (ox + 20, oy + 48)
    ctx.drawImage(invWeaponsImg, 0, 0, 54, 109, ox + 20, oy + 48, 54, 109)
  }
  if (!shieldItem && !isRight2H && invWeaponsImg) {
    // Frame 0 (crossed weapons silhouette, 54x109) from `Panel\inv_weapons.dc6` at (ox + 251, oy + 48)
    ctx.drawImage(invWeaponsImg, 0, 0, 54, 109, ox + 251, oy + 48, 54, 109)
  }

  // 4. D2Client.dll `0x6fb47be0` (`INVENTORY_DrawEquippedItems`): Equipped item sprites & requirement backdrops
  const is640 = ox === 0 && oy === 0
  const hireLayout = getInventoryLayout('Hireling', is640 ? 0 : 1)
  const hOx = ox - hireLayout.invLeft
  const hOy = oy - hireLayout.invTop
  const mercReqCtx: PlayerItemRequirementContext = {
    level: mLevel,
    str,
    dex,
  }
  const hasCursorItem = Boolean((assets?.inventory ?? this.activePlayerInventory)?.cursorItem)

  const equipSlots: ReadonlyArray<{
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
    readonly item: UiInventoryItem | null
    readonly phantom2H?: UiInventoryItem | null | undefined
  }> = [
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
      phantom2H: !weaponItem && isLeft2H ? shieldItem : null,
    },
    {
      x: hireLayout.slots.lArm.left + hOx,
      y: hireLayout.slots.lArm.top + hOy,
      w: hireLayout.slots.lArm.width,
      h: hireLayout.slots.lArm.height,
      item: shieldItem,
      phantom2H: !shieldItem && isRight2H ? weaponItem : null,
    },
  ]

  for (const slot of equipSlots) {
    if (slot.item) {
      const isHovered =
        this.hoveredMercItem?.item === slot.item ||
        (this.hoveredMercItem?.item?.id !== undefined &&
          String(this.hoveredMercItem.item.id) ===
            String((slot.item as any).id ?? (slot.item as any).itemId))
      const slotFill = resolvePaperdollSlotBackgroundFill(slot.item, mercReqCtx, {
        isHovered,
        hasCursorItem,
      })
      if (slotFill) {
        ctx.fillStyle = slotFill
        ctx.fillRect(slot.x + 1, slot.y + 1, slot.w - 2, slot.h - 2)
      }
      this.drawItemSprite(ctx, slot.item, slot.x, slot.y, slot.w, slot.h, itemsAtlasImg, isHovered)
    } else if (slot.phantom2H) {
      ctx.save()
      ctx.globalAlpha = 0.45
      this.drawItemSprite(ctx, slot.phantom2H, slot.x, slot.y, slot.w, slot.h, itemsAtlasImg, false)
      ctx.restore()
    }
  }

  // 5. D2Client.dll `0x6fb4afc1` (`buysellbtn.dc6` frame 10/11 at `ox + 272, oy + 385`;
  //    frame 11 depressed while held down, 1.13c mouse driver semantics)
  if (buySellBtnImg) {
    const closeFrame = this.pressedCloseKind === 'merc' ? 11 : 10
    ctx.drawImage(buySellBtnImg, closeFrame * 32, 0, 32, 32, ox + 272, oy + 385, 32, 32)
  }

  // 6. D2Client.dll `0x6fb3c8b0` (`.data` @ `0x6fb81398`): 12 static `.tbl` labels
  const labelFont = this.lang === 'CHI' ? 'font8' : 'font6'
  const drawLeftLabel = (tblKey: string, relX: number, relY: number) => {
    font.drawText(ctx, requireTbl(tblKey, this.lang), ox + relX, oy + relY, {
      font: labelFont,
      color: 'white',
      align: 'left',
    })
  }
  const drawCenteredResLabel = (tblKey: string, relY: number) => {
    const text = requireTbl(tblKey, this.lang)
    const lines = text.split(/\r?\n/)
    const centerX = ox + 213
    if (lines.length >= 2) {
      font.drawText(ctx, lines[0]!, centerX, oy + relY - 4, {
        font: labelFont,
        color: 'white',
        align: 'center',
      })
      font.drawText(ctx, lines[1]!, centerX, oy + relY + 4, {
        font: labelFont,
        color: 'white',
        align: 'center',
      })
    } else {
      font.drawText(ctx, text, centerX, oy + relY, {
        font: labelFont,
        color: 'white',
        align: 'center',
      })
    }
  }

  drawLeftLabel('strchrexp', 15, 236)
  drawLeftLabel('strchrlvl', 145, 236)
  drawLeftLabel('strchrnxtlvl', 200, 236)
  drawLeftLabel('strchrstr', 15, 281)
  drawLeftLabel('strchrdex', 15, 305)
  drawLeftLabel('strchrskm', 15, 329)
  drawLeftLabel('strchrdef', 15, 353)
  drawLeftLabel('strchrlif', 180, 214)

  drawCenteredResLabel('strchrfir', 281)
  drawCenteredResLabel('strchrcol', 305)
  drawCenteredResLabel('strchrlit', 329)
  drawCenteredResLabel('strchrpos', 353)

  const drawCloseHoverTooltip = () => {
    if (!this.hoveredMercClose) return
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

  if (!m) {
    drawCloseHoverTooltip()
    return
  }

  // 7. D2Client.dll `0x6fb40eb0`: Mercenary name in `font6` white at `(ox + 15, oy + 214)`, truncated to <= 160 px
  const rawMercClassId = Number(m.classId ?? m.hcIdx ?? 0)
  const normMercClassId = rawMercClassId === 560 ? 561 : rawMercClassId
  const tblMercName =
    typeof m.nameId === 'number' && m.nameId >= 0 && (normMercClassId > 0 || m.nameId >= 1000)
      ? resolveHirelingName(normMercClassId, m.nameId, this.lang)
      : ''
  const isRealMercName = (s: unknown): s is string =>
    typeof s === 'string' && s.length > 0 && !s.startsWith('Mercenary #') && !s.startsWith('Merc #')
  const validTblMercName = isRealMercName(tblMercName) ? tblMercName : ''
  const validNameZh = isRealMercName(m.nameZh) ? m.nameZh : ''
  const validNameEn = isRealMercName(m.nameEn) ? m.nameEn : ''
  const validName = isRealMercName(m.name) ? m.name : ''
  const rawName = String(
    this.lang === 'CHI'
      ? (validNameZh || validTblMercName || validName || m.name || `佣兵 #${m.nameId ?? m.mercId ?? 0}`)
      : (validNameEn || validTblMercName || validName || m.name || `Merc #${m.nameId ?? m.mercId ?? 0}`),
  )
  let truncName = rawName
  while (truncName.length > 1 && font.measureText(truncName, 'font6') > 160) {
    truncName = truncName.slice(0, -1)
  }
  font.drawText(ctx, truncName, ox + 15, oy + 214, {
    font: 'font6',
    color: 'white',
    align: 'left',
  })

  // 8. D2Client.dll `0x6fb3ea20` (`.data` @ `0x6fb91210`): 12 dynamic stat readouts (`font16` -> `font6` overflow fallback)
  const maxLife = getStatVal(7, 'maxHp', m.maxLife ?? m.maxHp, 100)
  const rawLifePct = Number(m.lifePct ?? 128) || 0
  const lifePctScale =
    m.lifePctScale === 100 ? 100 : m.lifePctScale === 128 || rawLifePct > 100 ? 128 : 100
  const life = getStatVal(
    6,
    'hp',
    m.life ?? m.hp,
    Math.round((rawLifePct / lifePctScale) * maxLife),
  )
  const exp = Number(m.experience ?? m.exp ?? getStatVal(13, 'experience', undefined, 0)) || 0

  let nextExp = Number(m.nextExp ?? m.nextLevelXp ?? getStatVal(30, 'nextExp', undefined, 0)) || 0
  if (nextExp <= 0 && mLevel > 0 && mLevel < 98) {
    const mClassId = Number(m.classId ?? m.hcIdx ?? 271)
    const rec =
      HIRELING_RECORDS.find((r) => r.version === 100 && r.classId === mClassId) ??
      HIRELING_RECORDS.find((r) => r.classId === mClassId)
    if (rec && rec.expPerLvl > 0) {
      nextExp = rec.expPerLvl * (mLevel + 2) * (mLevel + 1) * (mLevel + 1)
    }
  }

  const minDmg = getStatVal(21, 'damageMin', m.minDamage ?? m.damageMin, 0)
  const maxDmg = getStatVal(22, 'damageMax', m.maxDamage ?? m.damageMax, 0)
  const def = getStatVal(31, 'defense', m.defense, 0)
  const fr = getStatVal(39, 'fireResist', m.fireResist, 0)
  const cr = getStatVal(43, 'coldResist', m.coldResist, 0)
  const lr = getStatVal(41, 'lightResist', m.lightResist, 0)
  const pr = getStatVal(45, 'poisonResist', m.poisonResist, 0)

  const lifeColor = (m.hpColor ?? 'white') as D2ColorCode
  const strColor = (m.strengthColor ?? m.strColor ?? 'white') as D2ColorCode
  const dexColor = (m.dexterityColor ?? m.dexColor ?? 'white') as D2ColorCode
  const dmgColor = (m.damageColor ?? 'white') as D2ColorCode
  const defColor = (m.defenseColor ?? 'white') as D2ColorCode
  const resolveResColorFallback = (val: number, explicit?: unknown): D2ColorCode => {
    if (typeof explicit === 'string' && explicit.length > 0) return explicit as D2ColorCode
    if (val >= 75) return 'gold'
    if (val < 0) return 'red'
    return 'white'
  }
  const frColor = resolveResColorFallback(fr, m.fireResistColor)
  const crColor = resolveResColorFallback(cr, m.coldResistColor)
  const lrColor = resolveResColorFallback(lr, m.lightResistColor)
  const prColor = resolveResColorFallback(pr, m.poisonResistColor)

  const drawMercStatVal = (
    text: string,
    relX: number,
    relY: number,
    align: 'right' | 'center',
    maxW: number,
    color: D2ColorCode,
  ) => {
    const overflow = maxW > 0 && font.measureText(text, 'font16') > maxW
    const chosenFont = overflow ? 'font6' : 'font16'
    const drawY = oy + relY - (overflow ? 1 : 2)
    font.drawText(ctx, text, ox + relX, drawY, {
      font: chosenFont,
      color,
      align,
    })
  }

  drawMercStatVal(String(exp), 120, 254, 'right', 0, 'white')
  drawMercStatVal(String(mLevel), 175, 254, 'right', 0, 'white')
  drawMercStatVal(String(nextExp), 305, 254, 'right', 0, 'white')
  drawMercStatVal(`${life} / ${maxLife}`, 258, 215, 'center', 0, lifeColor)
  drawMercStatVal(String(str), 154, 282, 'right', 48, strColor)
  drawMercStatVal(String(dex), 154, 306, 'right', 48, dexColor)
  drawMercStatVal(`${minDmg}-${maxDmg}`, 154, 330, 'right', 48, dmgColor)
  drawMercStatVal(String(def), 154, 354, 'right', 48, defColor)
  drawMercStatVal(String(fr), 309, 282, 'right', 48, frColor)
  drawMercStatVal(String(cr), 309, 306, 'right', 48, crColor)
  drawMercStatVal(String(lr), 309, 330, 'right', 48, lrColor)
  drawMercStatVal(String(pr), 309, 354, 'right', 48, prColor)
  drawCloseHoverTooltip()
}
