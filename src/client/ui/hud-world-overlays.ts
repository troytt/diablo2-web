/**
 * Diablo II v1.13c Main HUD Frame & World-Space Overlays Renderer (`src/client/ui/hud-world-overlays.ts`).
 *
 * Extracted from `hud-manager.ts`:
 * - Complete HUD frame orchestration (`renderHudFrame`, `hudRepaintUnchanged`, `ensureCanvas2DContext`)
 * - Top-left Mercenary / Summon / Party roster portraits (`hasVisibleTopLeftPortraits`)
 * - Diablo III-style Unique/Set ground item loot beams (`renderGroundItemBeams`)
 * - Ground item label boxes & hovered NPC overhead plaque (`groundLabelHexToD2Color`)
 * - Unit overhead speech bubbles (`renderOverheadSpeechBubbles`)
 * - Top-left real-time chat & event message stream (`renderChatOverlay`)
 * - Dedicated animated cursor canvas layer & cursor renderer (`renderCursorLayer`, `setCursorLayerActive`, `renderCursor`)
 */

import type { D2ColorCode, D2FontRenderer } from './font.ts'
import { BAKED_UI_MANIFEST } from '../../common/items/baked-ui-meta.ts'
import {
  resolveMercPortraitIcon,
  resolvePlayerClassPortraitIcon,
} from '../../common/units/pet-type-table.ts'
import {
  type UiInventoryItem,
  resolveItemSpriteRect,
  isUiItemEthereal,
} from './inventory.ts'
import { requireTbl, type TblLang } from '../i18n/lang.ts'
import { LineGlide } from './line-glide.ts'
import { drawXpBar } from './xp-bar.ts'
import { drawAutoCombatBadge } from './auto-combat-badge.ts'
import { drawPotionShortageBadge } from './potion-shortage-badge.ts'
import { drawUpgradeCrosses } from './upgrade-marker.ts'
import type { GroundItemEnhancementsConfig } from '../settings/client-settings.ts'
import {
  CHAT_OVERLAY_LINE_HEIGHT,
  CHAT_OVERLAY_MAX_ACTIVE_LINES,
  D2_COLOR_INDEX_TO_NAME,
  OVERHEAD_BUBBLE_BASELINE_OFFSET_Y,
  computeChatOverlayLayout113c,
  computeOverheadBubbleLayout113c,
  resolveOverheadBubbleOverlap113c,
  resolveOverheadBubbleText113c,
  wrapChatText113c,
  type OverheadSpeechRect113c,
} from '../../common/chat/chat-113c.ts'
import {
  computeDockingLayout,
  crispHudDpr,
  shouldRenderHudFrame,
  type DockingLayout,
} from './hud-viewport-layout.ts'
import type { HudManager } from './hud-manager.ts'
import { renderLevelEntryTitle113c } from './level-entry-title.ts'

interface HudRenderInternal {
  lastHudFrameTiming: { mouseX: number; mouseY: number; drawMs: number } | null
  lastFullHudRepaintMs: number
  lastIdleRepaintSignature: string | null
  lastCursorLayerSignature: string | null
  readonly cursorCanvas: HTMLCanvasElement | null
  readonly hudCanvas: HTMLCanvasElement
  activeRenderDockingLayout: DockingLayout | null
  groundItemEnhancements: GroundItemEnhancementsConfig
  images: Map<string, HTMLImageElement>
  itemRects: Record<string, { x: number; y: number; w: number; h: number }>
  portraitRects: Record<string, { x: number; y: number; w: number; h: number }>
  readonly callbacks: {
    onRenderAutomapOverlay?: (
      ctx: CanvasRenderingContext2D,
      font: D2FontRenderer,
      logicalWidth: number,
      logicalHeight: number,
    ) => number | null | void
  }
  syncResolutionMode(): boolean
  resolveLocalizedMercLabel(merc: any, lang?: TblLang): string
  computeActiveSkillDmgString(skillId: number): string
  buildControlBarState(): any
  drawGoldDialog(ctx: CanvasRenderingContext2D): void
  hudRepaintUnchanged(nowMs: number): boolean
  ensureCanvas2DContext(rawCtx: CanvasRenderingContext2D): CanvasRenderingContext2D
  renderCursorLayer(nowMs: number): void
}

export function groundLabelHexToD2Color(hex: string | undefined): D2ColorCode {
  switch ((hex ?? '').toLowerCase()) {
    case '#c4a060':
    case '#d8b864':
    case '#c8a15a':
    case '#c7b377':
      return 'gold'
    case '#00fc00':
    case '#00ff00':
      return 'green'
    case '#008000':
      return 'darkgreen'
    case '#ffff64':
      return 'yellow'
    case '#ff8000':
    case '#ffa500':
    case '#ffa800':
    case '#ff9c18':
      return 'orange'
    case '#4880ff':
    case '#6868ff':
    case '#6969ff':
      return 'blue'
    case '#a0a0a0':
    case '#696969':
      return 'gray'
    default:
      return 'white'
  }
}

/**
 * #940 R2 conservative repaint-skip test (idle throttle only). Returns true
 * when every input a HUD drawer reads is byte-identical to the last painted
 * frame, no timed overlay (chat fade, speech bubbles, quest alert, open
 * panels, ground labels) is active, and the 250ms safety repaint is not due.
 */
export function hudRepaintUnchanged(hud: HudManager, nowMs: number): boolean {
  const internal = hud as unknown as HudRenderInternal
  // Safety net: force a full repaint whenever the last one is older than
  // 250ms, so any signal the signature failed to enumerate still updates
  // at 4Hz instead of freezing.
  if (nowMs - internal.lastFullHudRepaintMs >= 250) return false
  if (hud.leftPanel !== 'none' || hud.rightPanel !== 'none') return false
  if (hud.worldPanels.escapeMenuOpen) return false
  if (hud.chatInputOpen || hud.chatOverlayMessages.length > 0 || hud.overheadSpeechBubbles.length > 0) return false
  if (hud.showGroundLabels && hud.groundItemLabelBoxes.length > 0) return false
  // Level entry title (0x6fb6f0d0) is time-animated: repaint while it is up or the level has just changed.
  if (hud.levelEntryTitle.active) return false
  const entryLevelId = hud.resolveLevelEntryLevelId()
  if (entryLevelId !== null && entryLevelId > 0 && entryLevelId !== hud.levelEntryTitle.lastLevel) return false
  const cursorInfo = hud.cursor.getCurrentFrame(nowMs)
  const signature = [
    internal.hudCanvas.width,
    internal.hudCanvas.height,
    hud.mouseX,
    hud.mouseY,
    hud.autoCombatBadge?.on ?? -1,
    hud.potionShortage ?? '',
    // On the dedicated cursor layer the animation cell no longer touches the
    // HUD canvas, so it stops participating in the skip signature there.
    ...(internal.cursorCanvas !== null ? [] : [cursorInfo.frame?.x ?? -1, cursorInfo.frame?.y ?? -1]),
    hud.hp,
    hud.maxHp,
    hud.mana,
    hud.maxMana,
    hud.stamina,
    hud.maxStamina,
    hud.isStaminaBlue,
    hud.poisoned,
    hud.isDead,
    hud.healthPotActive,
    hud.manaPotActive,
    // Quest alert (`0x6face5f0`) is press-state driven, not time-animated:
    // visibility + pressed flag capture every pixel it can change.
    hud.questAlert === null ? -1 : hud.questAlert.alertVisible ? 1 : 0,
    hud.questAlert?.alertPressed === true ? 1 : 0,
    // `pingMs` is deliberately excluded: it jitters on nearly every sync and
    // the 4Hz safety repaint bounds its display staleness.
    hud.showFps ? hud.currentFps : -1,
    hud.hudRevision,
  ].join('|')
  if (signature !== internal.lastIdleRepaintSignature) {
    internal.lastIdleRepaintSignature = signature
    return false
  }
  return true
}

export function ensureCanvas2DContext(rawCtx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  const noop = () => {}
  const methods = [
    'save',
    'restore',
    'clearRect',
    'fillRect',
    'strokeRect',
    'fillText',
    'strokeText',
    'scale',
    'translate',
    'rotate',
    'transform',
    'setTransform',
    'resetTransform',
    'beginPath',
    'closePath',
    'moveTo',
    'lineTo',
    'rect',
    'arc',
    'fill',
    'stroke',
    'clip',
    'drawImage',
    'setLineDash',
  ] as const
  const target = rawCtx as unknown as Record<string, unknown>
  for (const m of methods) {
    if (typeof target[m] !== 'function') {
      target[m] = noop
    }
  }
  if (typeof target.measureText !== 'function') {
    target.measureText = (text: string) => ({ width: String(text ?? '').length * 8 })
  }
  if (typeof target.createLinearGradient !== 'function') {
    target.createLinearGradient = () => ({ addColorStop: noop })
  }
  if (typeof target.createRadialGradient !== 'function') {
    target.createRadialGradient = () => ({ addColorStop: noop })
  }
  return rawCtx
}

/**
 * Tick stamina drain/recovery and draw the complete Diablo II HUD for the active `ViewportProfile`.
 */
export function renderHudFrame(
  hud: HudManager,
  nowMs: number = performance.now(),
  playerMoving: boolean = false,
): void {
  const internal = hud as unknown as HudRenderInternal
  // #940 R3: the cursor lives on its own layer and repaints every call, ahead
  // of both idle gates — cursor animation must never be throttled away.
  if (internal.cursorCanvas !== null) {
    internal.renderCursorLayer(nowMs)
  }
  if (
    hud.enableIdleThrottle &&
    !isHudTextMoving(hud, nowMs) &&
    !shouldRenderHudFrame(internal.lastHudFrameTiming, hud.mouseX, hud.mouseY, nowMs)
  ) {
    return
  }
  internal.lastHudFrameTiming = { mouseX: hud.mouseX, mouseY: hud.mouseY, drawMs: nowMs }
  hud.syncPlayerContext()
  // Stamina is server state (stat 10 / 0x95); no client-side drain/regen simulation.
  void playerMoving

  // #940 R2 conservative repaint skip: when nothing any drawer reads has
  // changed since the last full paint (mouse, values, container revision,
  // cursor animation cell) and no timed overlay is active, the canvas
  // already shows exactly what a repaint would produce — skip the whole
  // rasterization.
  if (hud.enableIdleThrottle && !isHudTextMoving(hud, nowMs) && internal.hudRepaintUnchanged(nowMs)) {
    return
  }
  internal.lastFullHudRepaintMs = nowMs

  const is640 = internal.syncResolutionMode()
  const profile = hud.viewportProfile
  const hasWindow = typeof window !== 'undefined'
  const winW = hasWindow && window.innerWidth ? window.innerWidth : profile.width
  const winH = hasWindow && window.innerHeight ? window.innerHeight : profile.height
  const cssW = Math.max(320, internal.hudCanvas.clientWidth || winW)
  const cssH = Math.max(240, internal.hudCanvas.clientHeight || winH)
  const dpr = crispHudDpr(cssW, cssH, profile)
  const targetW = Math.round(cssW * dpr)
  const targetH = Math.round(cssH * dpr)
  if (internal.hudCanvas.width !== targetW || internal.hudCanvas.height !== targetH) {
    internal.hudCanvas.width = targetW
    internal.hudCanvas.height = targetH
  }

  const docking = computeDockingLayout(cssW, cssH, dpr, profile)
  internal.activeRenderDockingLayout = docking
  const { uiScale, offsetX, offsetY } = docking
  // Panels are authored in native 800x600 coordinates (left at x = 0, right at x = 400); shift them onto their docks.
  const deltaLeft = docking.leftDockX
  const deltaRight = docking.rightDockX - 400
  const panelOffsetY = docking.panelOffsetY ?? profile.panelOffsetY
  const barOffsetX = docking.barOffsetX ?? profile.barOffsetX
  const barOffsetY = docking.barOffsetY ?? profile.barOffsetY

  // Enable pointer events on HUD canvas only when hovering HUD/Panels, holding cursorItem, or in active trade/identify cursor mode
  const intercept =
    hud.isPointInterceptedByHud(hud.mouseX, hud.mouseY) ||
    hud.inventory.cursorItem !== null ||
    hud.worldPanels.vendorTradeState !== 'idle' ||
    hud.inventory.isIdentifyMode() ||
    hud.pendingIdentifyScrollId !== null
  if (internal.hudCanvas.style) {
    internal.hudCanvas.style.pointerEvents = intercept ? 'auto' : 'none'
  }

  const rawCtx = hud.ctx ?? internal.hudCanvas.getContext('2d')
  if (!rawCtx) {
    internal.activeRenderDockingLayout = null
    return
  }
  const ctx = internal.ensureCanvas2DContext(rawCtx)
  ctx.imageSmoothingEnabled = false
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, targetW, targetH)

  // 0. Automap 2D Text Overlay (Warp/Stash Font6 labels, NPC names, Top-Right Gold Font16 Level Name + Difficulty)
  ctx.translate(Math.round(offsetX * dpr), Math.round(offsetY * dpr))
  ctx.scale(uiScale * dpr, uiScale * dpr)
  const areaTitleLeft = internal.callbacks.onRenderAutomapOverlay?.(ctx, hud.font, profile.width, profile.height) ?? profile.width

  // 0b. Top-Left Mercenary Portrait & Life Bar (R3.3) + Summoned Minions + Party Mini-Portraits (R5.1)
  if (hud.leftPanel === 'none' && hud.showPartyPortraits !== false) {
    const atlasImg = internal.images.get('portraitsAtlas')
    let slotX = 16

    // 1. Mercenary (slot 0 — Hireables.cpp 0x6fb0b5a0: only living mercenary in g_pRosterPetList)
    if (hud.merc && !hud.merc.isDead) {
      const mercLabel = internal.resolveLocalizedMercLabel(hud.merc, hud.lang)
      hud.font.drawText(ctx, mercLabel, slotX + 24, 10, {
        font: 'font6',
        color: 'gold',
        align: 'center',
        shadow: true,
      })

      const hpRatio = Math.max(
        0,
        Math.min(1, Number(hud.merc.hp ?? 0) / Math.max(1, Number(hud.merc.maxHp ?? 1))),
      )
      ctx.fillStyle = 'rgba(16, 16, 20, 0.85)'
      ctx.fillRect(slotX, 16, 48, 48)
      ctx.strokeStyle = '#8b7344'
      ctx.strokeRect(slotX + 0.5, 16.5, 47, 47)

      const iconKey = String(hud.merc.iconKey || resolveMercPortraitIcon(hud.merc.classId))
      const pRect = internal.portraitRects[iconKey] || internal.portraitRects[iconKey.toLowerCase()]
      if (pRect && atlasImg) {
        ctx.drawImage(atlasImg, pRect.x, pRect.y, pRect.w, pRect.h, slotX + 1, 17, 46, 41)
      }

      // 1.13c Hireables.cpp (0x6fb0b5a0): 46x5 life bar inside bottom slot of 48x48 portrait frame
      ctx.fillStyle = '#181818'
      ctx.fillRect(slotX + 1, 58, 46, 5)
      ctx.fillStyle = hpRatio >= 0.5 ? '#20a020' : hpRatio >= 0.25 ? '#d0a020' : '#c02020'
      ctx.fillRect(slotX + 1, 58, Math.round(46 * hpRatio), 5)
      slotX += 56
    }

    // 2. Summoned Minions (PetType.txt & Hireables.cpp)
    if (hud.summonPortraits && hud.summonPortraits.length > 0) {
      for (let sIdx = 0; sIdx < hud.summonPortraits.length; sIdx++) {
        const summon = hud.summonPortraits[sIdx]
        if (!summon) continue
        const sLabel = String(summon.label || '')
        hud.font.drawText(ctx, sLabel, slotX + 24, 10, {
          font: 'font6',
          color: 'white',
          align: 'center',
        })

        const sFrameH = summon.drawHp ? 48 : 43
        ctx.fillStyle = 'rgba(16, 16, 20, 0.85)'
        ctx.fillRect(slotX, 16, 48, sFrameH)
        ctx.strokeStyle = '#6c5838'
        ctx.strokeRect(slotX + 0.5, 16.5, 47, sFrameH - 1)

        const sRect =
          internal.portraitRects[summon.iconKey] ||
          internal.portraitRects[String(summon.iconKey).toLowerCase()]
        if (sRect && atlasImg) {
          ctx.drawImage(atlasImg, sRect.x, sRect.y, sRect.w, sRect.h, slotX + 1, 17, 46, 41)
        }

        if (summon.drawHp) {
          const sLifeRatio = Math.max(0, Math.min(1, Number(summon.lifePct ?? 100) / 100))
          ctx.fillStyle = '#181818'
          ctx.fillRect(slotX + 1, 58, 46, 5)
          ctx.fillStyle = sLifeRatio >= 0.5 ? '#20a020' : sLifeRatio >= 0.25 ? '#d0a020' : '#c02020'
          ctx.fillRect(slotX + 1, 58, Math.round(46 * sLifeRatio), 5)
        }

        if (summon.iconType === 2 || summon.count > 1) {
          hud.font.drawText(ctx, String(summon.count), slotX + 4, 28, {
            font: 'font6',
            color: 'white',
            align: 'left',
          })
        }
        slotX += 56
      }
    }

    // 3. Allied Party Members (Only in same party, excluding self and unpartied players)
    if (hud.partyMembers.length > 0) {
      for (let idx = 0; idx < hud.partyMembers.length; idx++) {
        const member = hud.partyMembers[idx]
        if (!member) continue
        if (member.isSelf === true) continue
        const isExplicitUnpartied =
          member.partyId === 0xffff && (member.partyState === 'none' || member.partyState === 0)
        if (isExplicitUnpartied) continue

        const memberName = String(member.name || `P${member.unitId ?? idx + 1}`)
        hud.font.drawText(ctx, memberName, slotX + 24, 10, {
          font: 'font6',
          color: 'white',
          align: 'center',
        })

        const lifeRatio = Math.max(0, Math.min(1, Number(member.lifePct ?? 100) / 100))
        ctx.fillStyle = 'rgba(16, 16, 20, 0.82)'
        ctx.fillRect(slotX, 16, 48, 48)
        ctx.strokeStyle = member.hostile ? '#c02020' : '#7a6840'
        ctx.strokeRect(slotX + 0.5, 16.5, 47, 47)

        const classIcon = member.portraitIcon || resolvePlayerClassPortraitIcon(member.charClass)
        const mRect =
          internal.portraitRects[classIcon] || internal.portraitRects[String(classIcon).toLowerCase()]
        if (mRect && atlasImg) {
          ctx.drawImage(atlasImg, mRect.x, mRect.y, mRect.w, mRect.h, slotX + 1, 17, 46, 41)
        }

        ctx.fillStyle = '#181818'
        ctx.fillRect(slotX + 1, 58, 46, 5)
        ctx.fillStyle = member.hostile
          ? '#c02020'
          : lifeRatio >= 0.5
            ? '#20a020'
            : lifeRatio >= 0.25
              ? '#d0a020'
              : '#c02020'
        ctx.fillRect(slotX + 1, 58, Math.round(46 * lifeRatio), 5)
        slotX += 56
      }
    }
  }

  // 0c-pre. Ground Item Loot Beams (Diablo III-style vertical light pillar + 2:1 isometric base ring, Issue #957)
  if (internal.groundItemEnhancements.showUniqueSetBeams && hud.groundItemBeams.length > 0) {
    hud.renderGroundItemBeams(ctx, nowMs)
  }

  // 0c. Ground Item Labels (`D2Client.dll` `0x6fb08fb0` Alt labels & `0x6fb6fec0` / `D2Win_10085` single hover plaque)
  if (hud.groundItemLabelBoxes.length > 0) {
    ctx.save()
    const usePersistentLabelStyle =
      hud.showGroundLabels || internal.groundItemEnhancements.alwaysShowUniqueSetLabels
    for (const box of hud.groundItemLabelBoxes) {
      ctx.fillStyle = usePersistentLabelStyle
        ? box.isHovered
          ? 'rgba(16, 36, 104, 0.85)'
          : 'rgba(0, 0, 0, 0.5)'
        : 'rgba(0, 0, 0, 0.75)'
      ctx.fillRect(box.x, box.y, box.width, box.height)
      const d2Color = groundLabelHexToD2Color(box.color)
      const textCenterX = Math.round(box.x + box.width / 2)
      const textBaselineY = Math.round(box.y + box.height - 4)
      hud.font.drawText(ctx, box.text, textCenterX, textBaselineY, {
        font: 'font16',
        color: d2Color,
        align: 'center',
      })
      drawUpgradeCrosses(ctx, hud.font, box.text, hud.groundUpgradeVerdict(box.id), textCenterX, textBaselineY)
    }
    ctx.restore()
  }

  // 0d. Hovered NPC Overhead Name Label (`D2Client.dll` `0x6fb70920` world-space overhead text)
  if (hud.hoveredNpcLabel && !hud.worldPanels.npcMenu && !hud.worldPanels.npcSpeech) {
    const { text, screenX, screenY } = hud.hoveredNpcLabel
    if (text) {
      ctx.save()
      const boxW = Math.max(48, hud.font.measureText(text, 'font16') + 16)
      const boxH = 20
      const boxX = Math.round(screenX - boxW / 2)
      const boxY = Math.round(screenY - boxH + 4)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
      ctx.fillRect(boxX, boxY, boxW, boxH)
      hud.font.drawText(ctx, text, Math.round(screenX), Math.round(screenY), {
        font: 'font16',
        color: 'gold',
        align: 'center',
      })
      ctx.restore()
    }
  }

  // 0e. Unit Overhead Speech Bubbles (`D2Client.dll` `0x6fb2ca40` `MSG_DrawOverheadSpeech` & `0x6fb2af20` `MSG_ResolveOverheadOverlap`)
  hud.renderOverheadSpeechBubbles(ctx, nowMs)

  if (hud.messageLogEntries.length > 0 && hud.worldPanels.messageLogEntries.length === 0) {
    hud.worldPanels.messageLogEntries = hud.messageLogEntries
  }

  // 1. Left-Half Dock Panel (`0..400, panelOffsetY..panelOffsetY+553`, or `0..320, 0..432` in 640x480)
  const borderLeftImg = is640 ? null : (internal.images.get('borderLeft') ?? null)
  const borderRightImg = is640 ? null : (internal.images.get('borderRight') ?? null)
  if (hud.leftPanel === 'char') {
    ctx.save()
    ctx.translate(deltaLeft, panelOffsetY)
    hud.charSheet.draw(
      ctx,
      {
        hp: hud.hp,
        maxHp: hud.maxHp,
        mana: hud.mana,
        maxMana: hud.maxMana,
        stamina: hud.stamina,
        maxStamina: hud.maxStamina,
        leftSkillDmg:
          hud.charSheet.attrs.leftSkillDmg ||
          internal.computeActiveSkillDmgString(hud.hotkeys.leftSkillId),
        rightSkillDmg:
          hud.charSheet.attrs.rightSkillDmg ||
          internal.computeActiveSkillDmgString(hud.hotkeys.rightSkillId),
      },
      {
        borderLeftImg,
        charSheetImg: internal.images.get('charSheet') ?? null,
        buySellBtnImg: internal.images.get('buySellBtn') ?? null,
        levelBtnImg: internal.images.get('levelBtn') ?? null,
      },
      hud.font,
      true,
    )
    ctx.restore()
  } else if (hud.leftPanel !== 'none') {
    ctx.save()
    const isPendingTradeOnly =
      hud.leftPanel === 'trade' &&
      !hud.trade?.active &&
      (hud.trade?.pendingModal === 'wait' || hud.trade?.pendingModal === 'request')
    if (hud.leftPanel !== 'hire' && hud.leftPanel !== 'msg' && !isPendingTradeOnly) {
      ctx.translate(deltaLeft, panelOffsetY)
    }
    if (hud.partyMembers.length > 0 && hud.worldPanels.partyMembers.length === 0) {
      hud.worldPanels.partyMembers = hud.partyMembers
    }
    if (!hud.worldPanels.localPlayerName && hud.charSheet.attrs.name) {
      hud.worldPanels.localPlayerName = hud.charSheet.attrs.name
    }
    if (hud.worldPanels.localPlayerClass === null && hud.currentClass !== null) {
      hud.worldPanels.localPlayerClass = hud.currentClass
    }
    if (hud.worldPanels.localPlayerLevel <= 1 && hud.charSheet.attrs.level > 1) {
      hud.worldPanels.localPlayerLevel = hud.charSheet.attrs.level
    }
    if (
      hud.leftPanel === 'quest' ||
      hud.leftPanel === 'waypoint' ||
      hud.leftPanel === 'stash' ||
      hud.leftPanel === 'cube' ||
      hud.leftPanel === 'vendor' ||
      hud.leftPanel === 'merc' ||
      hud.leftPanel === 'party' ||
      hud.leftPanel === 'barkscroll' ||
      hud.leftPanel === 'recipescroll'
    ) {
      hud.worldPanels.drawLeftDockPanel(
        ctx,
        hud.leftPanel,
        {
          borderLeftImg,
          questBgImg: internal.images.get('questBg') ?? null,
          waypointBgImg: internal.images.get('waypointBg') ?? null,
          stashBgImg: internal.images.get('stashBg') ?? null,
          cubeBgImg: internal.images.get('cubeBg') ?? null,
          vendorBgImg: internal.images.get('vendorBg') ?? null,
          vendorTabsImg: internal.images.get('vendorTabs') ?? null,
          buySellBtnImg: internal.images.get('buySellBtn') ?? null,
          miniConvertImg: internal.images.get('miniConvert') ?? null,
          questsAtlasImg: internal.images.get('questsAtlas') ?? null,
          itemsAtlasImg: internal.images.get('itemsAtlas') ?? null,
          waypointTabsImg: internal.images.get('waypointTabs') ?? null,
          waypointIconsImg: internal.images.get('waypointIcons') ?? null,
          questTabsImg: internal.images.get('questTabs') ?? null,
          questSocketsImg: internal.images.get('questSockets') ?? null,
          questLastImg: internal.images.get('questLast') ?? null,
          scroinBgImg: internal.images.get('scroinBg') ?? null,
          scroinRunesImg: internal.images.get('scroinRunes') ?? null,
          scroinGlowImg: internal.images.get('scroinGlow') ?? null,
          horadricBgImg: internal.images.get('horadricBg') ?? null,
          invpsImg: internal.images.get('invps') ?? null,
          recipeScrollBgImg: internal.images.get('recipeScrollBg') ?? null,
          mercBgImg: internal.images.get('mercBg') ?? null,
          invArmorImg: internal.images.get('invArmor') ?? null,
          invHelmGloveImg: internal.images.get('invHelmGlove') ?? null,
          invWeaponsImg: internal.images.get('invWeapons') ?? null,
          partyBgImg: internal.images.get('partyBg') ?? null,
          partyButtonsImg: internal.images.get('partyButtons') ?? null,
          partyBoxesImg: internal.images.get('partyBoxes') ?? null,
          partyBarImg: internal.images.get('partyBar') ?? null,
          nowMs,
          inventory: hud.inventory,
        },
        hud.font,
      )
    } else if (typeof (hud.worldPanels as any).renderActiveLeftPanel === 'function') {
      ;(hud.worldPanels as any).renderActiveLeftPanel(
        ctx,
        hud.leftPanel,
        hud.font,
        {
          borderLeftImg,
          boxPiecesImg: internal.images.get('boxPieces'),
          focus16Img: internal.images.get('focus16'),
          textSlidImg: internal.images.get('textSlid') ?? internal.images.get('textslid'),
          horadricBgImg: internal.images.get('horadricBg') ?? null,
          upgradeBgImg: internal.images.get('upgradeBg') ?? null,
          buySellBtnImg: internal.images.get('buySellBtn') ?? null,
          tradeBgImg: internal.images.get('tradeBg') ?? null,
          tradeBtnImg: internal.images.get('tradeBtn') ?? null,
          goldCoinBtnImg: internal.images.get('goldCoinBtn') ?? null,
          itemsAtlasImg: internal.images.get('itemsAtlas') ?? null,
          partyBgImg: internal.images.get('partyBg') ?? null,
          partyButtonsImg: internal.images.get('partyButtons') ?? null,
          partyBoxesImg: internal.images.get('partyBoxes') ?? null,
          partyBarImg: internal.images.get('partyBar') ?? null,
          inventory: hud.inventory,
        },
        profile.width,
        profile.height,
      )
    } else {
      hud.worldPanels.drawLeftDockPanel(
        ctx,
        hud.leftPanel as any,
        {
          borderLeftImg,
          questBgImg: internal.images.get('questBg') ?? null,
          waypointBgImg: internal.images.get('waypointBg') ?? null,
          stashBgImg: internal.images.get('stashBg') ?? null,
          cubeBgImg: internal.images.get('cubeBg') ?? null,
          vendorBgImg: internal.images.get('vendorBg') ?? null,
          vendorTabsImg: internal.images.get('vendorTabs') ?? null,
          buySellBtnImg: internal.images.get('buySellBtn') ?? null,
          miniConvertImg: internal.images.get('miniConvert') ?? null,
          questsAtlasImg: internal.images.get('questsAtlas') ?? null,
          itemsAtlasImg: internal.images.get('itemsAtlas') ?? null,
          waypointTabsImg: internal.images.get('waypointTabs') ?? null,
          waypointIconsImg: internal.images.get('waypointIcons') ?? null,
          questTabsImg: internal.images.get('questTabs') ?? null,
          questSocketsImg: internal.images.get('questSockets') ?? null,
          questLastImg: internal.images.get('questLast') ?? null,
          scroinBgImg: internal.images.get('scroinBg') ?? null,
          scroinRunesImg: internal.images.get('scroinRunes') ?? null,
          scroinGlowImg: internal.images.get('scroinGlow') ?? null,
          mercBgImg: internal.images.get('mercBg') ?? null,
          invArmorImg: internal.images.get('invArmor') ?? null,
          invHelmGloveImg: internal.images.get('invHelmGlove') ?? null,
          invWeaponsImg: internal.images.get('invWeapons') ?? null,
          partyBgImg: internal.images.get('partyBg') ?? null,
          partyButtonsImg: internal.images.get('partyButtons') ?? null,
          partyBoxesImg: internal.images.get('partyBoxes') ?? null,
          partyBarImg: internal.images.get('partyBar') ?? null,
          nowMs,
          inventory: hud.inventory,
        },
        hud.font,
      )
    }
    ctx.restore()
  }

  // 2. Right-Half Dock Panel (`400+deltaRight..800+deltaRight, panelOffsetY..panelOffsetY+553`, or `320..640, 0..432` in 640x480)
  if (hud.rightPanel === 'inv') {
    hud.inventory.stashOpen = hud.leftPanel === 'stash'
    hud.inventory.lang = hud.lang
    ctx.save()
    ctx.translate(deltaRight, panelOffsetY)
    hud.inventory.draw(
      ctx,
      {
        borderRightImg,
        invSheetImg: internal.images.get('invSheet') ?? null,
        invTab0Img: internal.images.get('invTab0') ?? null,
        invTab1Img: internal.images.get('invTab1') ?? null,
        buySellBtnImg: internal.images.get('buySellBtn') ?? null,
        goldCoinBtnImg: internal.images.get('goldCoinBtn') ?? null,
        gemSocketImg: internal.images.get('gemSocket') ?? null,
        itemsAtlasImg: internal.images.get('itemsAtlas') ?? null,
        itemRects: internal.itemRects,
      },
      hud.font,
    )
    ctx.restore()
  } else if (hud.rightPanel === 'skill') {
    ctx.save()
    ctx.translate(deltaRight, panelOffsetY)
    hud.skillTree.draw(
      ctx,
      {
        borderRightImg,
        skillPointsImg: internal.images.get('skillPoints') ?? null,
        skillTabsImg: internal.images.get('skillTabs') ?? null,
        buySellBtnImg: internal.images.get('buySellBtn') ?? null,
      },
      hud.font,
      true,
    )
    ctx.restore()
  }

  // 2b. Top-Left Real-Time Chat & Event Message Stream Overlay (`D2Client.dll` `0x6fb2b730` `MSG_DrawChatOverlay`)
  hud.renderChatOverlay(ctx, profile.width, nowMs)
  const overlayLang = hud.lang === 'ENG' ? 'ENG' : 'CHI'
  if (hud.autoCombatBadge !== null) drawAutoCombatBadge(ctx, hud.font, hud.autoCombatBadge, barOffsetX, barOffsetY, overlayLang)
  if (hud.potionShortage !== null) drawPotionShortageBadge(ctx, hud.font, hud.potionShortage, barOffsetX, barOffsetY, overlayLang)
  if (hud.showXpBar && hud.leftPanel === 'none' && hud.rightPanel === 'none' && !hud.worldPanels.escapeMenuOpen) {
    const xpState = internal.buildControlBarState()
    hud.xpRate.record(xpState.xp, nowMs)
    drawXpBar(ctx, hud.font, xpState, profile.width, overlayLang, { perHour: hud.xpRate.perHour(nowMs), mouseX: hud.mouseX, mouseY: hud.mouseY, rightLimit: areaTitleLeft })
  }

  // 3..6. Bottom Control Panel, Globes, Belt, and Skill Hotkeys (translated by barOffsetX, barOffsetY)
  const activeCtrlPnlImg = is640
    ? (internal.images.get('ctrlPnl640') ?? internal.images.get('ctrlPnl') ?? null)
    : (internal.images.get('ctrlPnl') ?? null)
  const activeMiniPanelImg =
    !hud.controlBar.isMultiplayer && internal.images.get('miniPanelSingle')
      ? internal.images.get('miniPanelSingle')!
      : (internal.images.get('miniPanel') ?? null)

  ctx.save()
  ctx.translate(barOffsetX, barOffsetY)
  hud.controlBar.draw(
    ctx,
    internal.buildControlBarState(),
    {
      ctrlPnlImg: activeCtrlPnlImg,
      runBtnImg: internal.images.get('runBtn') ?? null,
      menuBtnImg: internal.images.get('menuBtn') ?? null,
      miniPanelImg: activeMiniPanelImg,
      miniPanelBtnsImg: internal.images.get('miniPanelBtns') ?? null,
      levelBtnImg: internal.images.get('levelBtn') ?? null,
      levelSocketImg: internal.images.get('levelSocket') ?? null,
    },
    hud.font,
  )

  // 4. Life & Mana Globes (`Hlthmana.dc6` + `overlap.dc6`)
  hud.globes.draw(
    ctx,
    {
      hp: hud.hp,
      maxHp: hud.maxHp,
      mana: hud.mana,
      maxMana: hud.maxMana,
      poisoned: hud.poisoned,
      healthPotActive: hud.healthPotActive,
      potionLifePercent: hud.potionLifePercent,
      manaPotActive: hud.manaPotActive,
      potionManaPercent: hud.potionManaPercent,
    },
    {
      lifeImg: internal.images.get('globeLife') ?? null,
      manaImg: internal.images.get('globeMana') ?? null,
      poisonImg: internal.images.get('globePoison') ?? null,
      overlapLeftImg: internal.images.get('overlapLeft') ?? null,
      overlapRightImg: internal.images.get('overlapRight') ?? null,
    },
    hud.font,
  )

  // 5. 4x4 Belt & Pop-up Belt (`ctrlpnl_popbelt.dc6`)
  hud.belt.draw(
    ctx,
    {
      popbeltImg: internal.images.get('popbelt') ?? null,
      itemsAtlasImg: internal.images.get('itemsAtlas') ?? null,
      itemRects: internal.itemRects,
    },
    hud.font,
  )

  // 6. Left & Right Active Skill Slots & Speedbar Popup (`spellsel.cpp`) — drawn above belt so speedbar popup & tooltips are never occluded
  if (hud.maxMana > 0 || hud.mana > 0) {
    hud.hotkeys.currentMana = hud.mana
  }
  hud.hotkeys.draw(
    ctx,
    internal.images.get('genericSkills') ?? null,
    hud.font,
    Boolean(hud.inventory.equipped.weapon1),
  )

  // 6b. 1.13c Quest Alert button (`UI 0x11`, `D2Client.dll` `0x6face5f0`)
  const alertRect = hud.getQuestAlertBarLocalRect()
  if (alertRect && hud.questAlert) {
    const label = requireTbl('CfgQuestLog', hud.lang)
    const textW = hud.font.measureText(label, 'font16')
    const labelX = alertRect.x1 + 1 + 17 - Math.trunc(textW / 2)
    hud.font.drawText(ctx, label, labelX, alertRect.yText, {
      font: 'font16',
      color: 'white',
      align: 'left',
    })
    const socketImg = internal.images.get('levelSocket') ?? null
    if (socketImg) {
      ctx.drawImage(socketImg, alertRect.x1, alertRect.y2 - 36)
    }
    const btnImg = internal.images.get('levelBtn') ?? null
    if (btnImg) {
      const frame =
        hud.questAlert.alertPressed && hud.hitTestQuestAlert(hud.mouseX, hud.mouseY) ? 1 : 0
      ctx.drawImage(btnImg, frame * 30, 0, 30, 30, alertRect.x1 + 3, alertRect.y2 - 34, 30, 30)
    }
  }
  ctx.restore()

  // 6c. In-Game Chat Input Box (`D2Client.dll` `0x6fb20140` `CHAT_DrawChatInputBox` + `0x6fb1ef20` `CHAT_DrawCursor`)
  hud.renderChatInputBox(ctx, profile.width, profile.height, nowMs)

  // 7. Top-Center Monster Target Health Bar & Plaque (`D2Client.dll` `0x6FB70850`)
  hud.worldPanels.drawMonsterTargetBar(ctx, hud.targetMonster, hud.font, {
    leftPanelOpen: hud.leftPanel !== 'none',
    rightPanelOpen: hud.rightPanel !== 'none',
    canvasWidth: profile.width,
  })

  // 8. Town NPC Stone Interaction Menu (`npcmenu.cpp` + `dialog.cpp` + `boxpieces.dc6`)
  if (
    (hud.worldPanels.npcMenu || hud.worldPanels.npcSpeech !== null) &&
    hud.leftPanel !== 'hire' &&
    (hud.worldPanels as any).activePanel !== 'hire'
  ) {
    hud.worldPanels.drawNpcMenu(
      ctx,
      hud.font,
      {
        boxPiecesImg: internal.images.get('boxPieces') ?? null,
        focus16Img: internal.images.get('focus16') ?? null,
      },
      profile.width,
      profile.height,
    )
  }

  // 10. Hover Tooltips (Inventory / Equipment / Stash / Cube / Vendor / Merc / Trade / Quest Reward / Skill Tree)
  if (
    (hud.rightPanel === 'inv' ||
      hud.leftPanel === 'stash' ||
      hud.leftPanel === 'cube' ||
      hud.leftPanel === 'vendor' ||
      hud.leftPanel === 'merc' ||
      hud.leftPanel === 'trade' ||
      hud.leftPanel === 'imbue' ||
      hud.leftPanel === 'add_sockets' ||
      hud.leftPanel === 'personalize' ||
      hud.leftPanel === 'orifice') &&
    hud.inventory.hoveredItem &&
    !hud.inventory.cursorItem
  ) {
    hud.worldPanels.drawItemTooltip(
      ctx,
      hud.inventory.hoveredItem,
      hud.font,
      hud.leftPanel === 'vendor',
      profile.width,
      profile.height,
    )
  }
  if (hud.leftPanel === 'char' && hud.charSheet.showStatGainTooltips && hud.charSheet.hoveredStat) {
    ctx.save()
    ctx.translate(deltaLeft, panelOffsetY)
    hud.charSheet.drawStatTooltip(ctx, hud.font, profile.width - deltaLeft - 8)
    ctx.restore()
  }
  if (hud.leftPanel === 'char' && hud.charSheet.showDamageFormulaTooltips && hud.charSheet.hoveredDamageHand) {
    ctx.save()
    ctx.translate(deltaLeft, panelOffsetY)
    hud.charSheet.drawDamageTooltip(ctx, hud.font, profile.width - deltaLeft - 8)
    ctx.restore()
  }
  if (hud.rightPanel === 'skill' && hud.skillTree.hoveredSkill) {
    ctx.save()
    ctx.translate(deltaRight, panelOffsetY)
    hud.skillTree.drawSkillTooltip(ctx, hud.font, 8 - deltaRight)
    ctx.restore()
  }

  // 10b. Gold dialog (drop / deposit / withdraw)
  internal.drawGoldDialog(ctx)

  // 10c. Authentic In-Game Escape Menu (`D2Client.dll` `gmenu.cpp` `0x6fb15230`)
  if (hud.worldPanels.escapeMenuOpen) {
    hud.worldPanels.drawEscapeMenu(ctx, profile.width, profile.height, nowMs, {
      escOptionsImg: internal.images.get('escOptions') ?? null,
      escExitImg: internal.images.get('escExit') ?? null,
      escReturnImg: internal.images.get('escReturn') ?? null,
      pentSpinImg: internal.images.get('pentSpin') ?? null,
      boxPiecesImg: internal.images.get('boxPieces') ?? null,
      textSlidImg: internal.images.get('textSlid') ?? null,
      focus16Img: internal.images.get('focus16') ?? null,
      btnMediumImg: internal.images.get('btnMedium') ?? null,
      font: hud.font,
    })
  }

  // 10c-2. Level entry title (`D2Client.dll` `0x6fb6f0d0`, called from the UI draw at `0x6fb73aa1` after the
  // escape menu `0x6fb15230`): "Entering The Blood Moor", 120 frames, centred at (W/2, H/2 - 0x8c).
  renderLevelEntryTitle113c(
    ctx,
    hud.levelEntryTitle,
    hud.resolveLevelEntryLevelId(),
    hud.levelEntryQuestSource,
    internal.images.get('levelEntryTitles') ?? null,
    hud.state.ready,
    nowMs,
    profile.width,
    profile.height,
  )

  // 10d. Authentic Death Presentation (`youdiedhardcore.dc6` & `youdiedinst.dc6` centered at (W/2, H/2 - 94) and (W/2, H/2 - 46))
  if (hud.isDead || Boolean((hud.worldPanels as any).isDead)) {
    const centerX = Math.round(profile.width / 2)
    const centerY = Math.round(profile.height / 2)
    ctx.save()
    ctx.fillStyle = 'rgba(80, 0, 0, 0.45)'
    ctx.fillRect(0, 0, profile.width, profile.height)
    const hardcoreImg = internal.images.get('deathHardcore')
    const instImg = internal.images.get('deathInst')
    const y1 = centerY - 94
    const y2 = centerY - 46

    if (hardcoreImg) {
      ctx.drawImage(hardcoreImg, centerX - Math.round(hardcoreImg.width / 2), y1)
    } else {
      hud.font.drawText(
        ctx,
        hud.lang === 'CHI' ? '你已經死了' : 'YOU HAVE DIED',
        centerX,
        y1 + 18,
        {
          font: 'fontexocet10',
          color: 'red',
          align: 'center',
          lang: hud.lang,
        },
      )
    }

    if (instImg) {
      ctx.drawImage(instImg, centerX - Math.round(instImg.width / 2), y2)
    } else {
      hud.font.drawText(
        ctx,
        hud.lang === 'CHI' ? '請按 ESC 繼續' : 'PRESS ESC TO CONTINUE.',
        centerX,
        y2 + 18,
        {
          font: 'font16',
          color: 'gold',
          align: 'center',
          lang: hud.lang,
        },
      )
    }
    ctx.restore()
  }

  // 11. Authentic Hand / Trade Cursor & Held Item at Hotspot
  // (on the dedicated cursor layer when present — see renderCursorLayer)
  if (internal.cursorCanvas === null) {
    hud.renderCursor(ctx, nowMs)
  }

  ctx.restore()
  hud.syncPublishedState()
  internal.activeRenderDockingLayout = null
}

/**
 * Returns true when any top-left portrait (mercenary, summon, or allied party member) is visible.
 * Used by `MSG_DrawChatOverlay` (`0x6fb2b730`) to shift `startY` from `20` (`0x14`) to `95` (`0x5F`).
 */
export function hasVisibleTopLeftPortraits(hud: HudManager): boolean {
  if (hud.leftPanel !== 'none' || hud.showPartyPortraits === false) return false
  if (hud.merc && !hud.merc.isDead) return true
  if (hud.summonPortraits && hud.summonPortraits.length > 0) return true
  for (const member of hud.partyMembers) {
    if (!member || member.isSelf === true) continue
    const isExplicitUnpartied =
      member.partyId === 0xffff && (member.partyState === 'none' || member.partyState === 0)
    if (!isExplicitUnpartied) return true
  }
  return false
}

interface BakedBeamSprite {
  readonly canvas: HTMLCanvasElement
  readonly width: number
  readonly height: number
  readonly anchorX: number
  readonly anchorY: number
  readonly baseHeight: number
}

const bakedBeamSpriteCache = new Map<string, BakedBeamSprite>()

function getOrBakeBeamSprite(quality: 'unique' | 'set', isHovered: boolean): BakedBeamSprite | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null
  }
  const key = `${quality}:${isHovered ? '1' : '0'}`
  const existing = bakedBeamSpriteCache.get(key)
  if (existing) return existing

  const baseHeight = isHovered ? 172 : 152
  const width = 64
  const height = baseHeight + 24
  const anchorX = 32
  const anchorY = baseHeight + 4
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const bctx = canvas.getContext('2d')
  if (!bctx) return null

  const isUnique = quality === 'unique'
  const outerRgb = isUnique ? '255, 138, 24' : '0, 216, 64'
  const midRgb = isUnique ? '255, 196, 84' : '96, 255, 136'
  const coreRgb = isUnique ? '255, 246, 210' : '220, 255, 232'
  const hoverBoost = isHovered ? 1.18 : 1.0

  bctx.save()
  try {
    bctx.globalCompositeOperation = 'lighter'
  } catch {
    // ignore
  }

  // 1. Pre-bake 2:1 Isometric Hollow Ground Halo at nominal radius 28
  bctx.save()
  bctx.translate(anchorX, anchorY - 3)
  bctx.scale(1, 0.5)
  const radGrad = bctx.createRadialGradient(0, 0, 1, 0, 0, 28)
  radGrad.addColorStop(0, `rgba(${coreRgb}, 0)`)
  radGrad.addColorStop(0.42, `rgba(${midRgb}, 0.04)`)
  radGrad.addColorStop(0.68, `rgba(${midRgb}, ${(0.28 * hoverBoost).toFixed(3)})`)
  radGrad.addColorStop(1, `rgba(${outerRgb}, 0)`)
  bctx.fillStyle = radGrad
  bctx.beginPath()
  bctx.arc(0, 0, 28, 0, Math.PI * 2)
  bctx.fill()
  bctx.restore()

  // 2. Pre-bake Vertical Skyward Multi-Layered Light Pillar
  const topY = anchorY - baseHeight
  const outerW = 22
  const gOuter = bctx.createLinearGradient(anchorX, anchorY, anchorX, topY)
  gOuter.addColorStop(0, `rgba(${outerRgb}, 0.04)`)
  gOuter.addColorStop(0.12, `rgba(${outerRgb}, ${(0.24 * hoverBoost).toFixed(3)})`)
  gOuter.addColorStop(0.5, `rgba(${outerRgb}, ${(0.12 * hoverBoost).toFixed(3)})`)
  gOuter.addColorStop(1, `rgba(${outerRgb}, 0)`)
  bctx.fillStyle = gOuter
  bctx.fillRect(anchorX - outerW / 2, topY, outerW, baseHeight)

  const midW = 8
  const gMid = bctx.createLinearGradient(anchorX, anchorY, anchorX, topY)
  gMid.addColorStop(0, `rgba(${midRgb}, 0.03)`)
  gMid.addColorStop(0.12, `rgba(${midRgb}, ${(0.34 * hoverBoost).toFixed(3)})`)
  gMid.addColorStop(0.55, `rgba(${midRgb}, ${(0.18 * hoverBoost).toFixed(3)})`)
  gMid.addColorStop(1, `rgba(${midRgb}, 0)`)
  bctx.fillStyle = gMid
  bctx.fillRect(anchorX - midW / 2, topY, midW, baseHeight)

  const coreW = 2
  const coreBaseY = anchorY - 12
  const coreHeight = Math.max(16, Math.round(baseHeight * 0.88) - 12)
  const coreTopY = coreBaseY - coreHeight
  const gCore = bctx.createLinearGradient(anchorX, coreBaseY, anchorX, coreTopY)
  gCore.addColorStop(0, `rgba(${coreRgb}, 0)`)
  gCore.addColorStop(0.08, `rgba(${coreRgb}, ${(0.48 * hoverBoost).toFixed(3)})`)
  gCore.addColorStop(0.65, `rgba(${coreRgb}, ${(0.24 * hoverBoost).toFixed(3)})`)
  gCore.addColorStop(1, `rgba(${coreRgb}, 0)`)
  bctx.fillStyle = gCore
  bctx.fillRect(anchorX - 1, coreTopY, coreW, coreHeight)
  bctx.restore()

  const baked: BakedBeamSprite = {
    canvas,
    width,
    height,
    anchorX,
    anchorY,
    baseHeight,
  }
  bakedBeamSpriteCache.set(key, baked)
  return baked
}

/**
 * NOT 1.13c: Renders Diablo III-style vertical loot beams and 2:1 isometric base rings
 * (`rx : ry = 2 : 1` per isometric ground perspective law) for Unique and Set ground items
 * when claimed by a plugin (Issue #957).
 */
export function renderGroundItemBeams(
  hud: HudManager,
  ctx: CanvasRenderingContext2D,
  nowMs: number,
): void {
  const internal = hud as unknown as HudRenderInternal
  if (!internal.groundItemEnhancements.showUniqueSetBeams || hud.groundItemBeams.length === 0) {
    return
  }
  ctx.save()
  const prevComp = ctx.globalCompositeOperation
  try {
    ctx.globalCompositeOperation = 'lighter'
  } catch {
    // Fallback for minimal mock 2D contexts
  }

  const canLinearGrad = typeof ctx.createLinearGradient === 'function'
  const canRadialGrad = typeof ctx.createRadialGradient === 'function'
  const canArc = typeof ctx.beginPath === 'function' && typeof ctx.arc === 'function'
  const canScale = typeof ctx.translate === 'function' && typeof ctx.scale === 'function'
  const canBlitBaked = typeof ctx.drawImage === 'function' && typeof document !== 'undefined'

  for (const beam of hud.groundItemBeams) {
    const bx = Math.round(beam.screenX)
    const by = Math.round(beam.screenY)
    const isUnique = beam.quality === 'unique'

    // Unique = warm Diablo III Legendary amber-gold; Set = vibrant Diablo III emerald green
    const outerRgb = isUnique ? '255, 138, 24' : '0, 216, 64'
    const midRgb = isUnique ? '255, 196, 84' : '96, 255, 136'
    const coreRgb = isUnique ? '255, 246, 210' : '220, 255, 232'
    const ringRgb = isUnique ? '255, 184, 64' : '64, 255, 112'

    const phase = ((beam.id * 2654435761) >>> 0) % 1000
    const t = (Math.max(0, nowMs) + phase) * 0.0035
    const pulse = 0.88 + 0.12 * Math.sin(t)
    const hoverBoost = beam.isHovered ? 1.18 : 1.0
    const heightScale = 0.96 + 0.04 * Math.sin(t * 0.8)
    const beamHeight = Math.round((beam.isHovered ? 172 : 152) * heightScale)
    const topY = by - beamHeight

    const baked = canBlitBaked ? getOrBakeBeamSprite(beam.quality, Boolean(beam.isHovered)) : null
    if (baked) {
      const prevAlpha = ctx.globalAlpha
      ctx.globalAlpha = prevAlpha * pulse
      const dstH = Math.round(baked.height * heightScale)
      const dstAnchorY = Math.round(baked.anchorY * heightScale)
      ctx.drawImage(
        baked.canvas,
        0,
        0,
        baked.width,
        baked.height,
        bx - baked.anchorX,
        by - dstAnchorY,
        baked.width,
        dstH,
      )
      ctx.globalAlpha = prevAlpha

      if (canArc && canScale && typeof ctx.stroke === 'function') {
        ctx.save()
        ctx.translate(bx, by - 3)
        ctx.scale(1, 0.5)
        const ringProgress = ((Math.max(0, nowMs) + phase) % 1800) / 1800
        const ringRadiusX = 12 + ringProgress * 18
        const ringAlpha = Math.min(1, (1 - ringProgress) * 0.42 * hoverBoost)
        ctx.strokeStyle = `rgba(${ringRgb}, ${ringAlpha.toFixed(3)})`
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.arc(0, 0, ringRadiusX, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    } else {
      // 1. 2:1 Isometric Hollow Ground Halo & Expanding Ripple Ring (rx : ry = 2 : 1 via scale(1, 0.5))
      if (canArc && canScale) {
        ctx.save()
        ctx.translate(bx, by - 3)
        ctx.scale(1, 0.5)

        const baseRadiusX = 28 * pulse
        if (canRadialGrad) {
          const radGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, baseRadiusX)
          radGrad.addColorStop(0, `rgba(${coreRgb}, 0)`)
          radGrad.addColorStop(0.42, `rgba(${midRgb}, 0.04)`)
          radGrad.addColorStop(0.68, `rgba(${midRgb}, ${(0.28 * pulse * hoverBoost).toFixed(3)})`)
          radGrad.addColorStop(1, `rgba(${outerRgb}, 0)`)
          ctx.fillStyle = radGrad
        } else {
          ctx.fillStyle = `rgba(${midRgb}, ${(0.14 * pulse * hoverBoost).toFixed(3)})`
        }
        ctx.beginPath()
        ctx.arc(0, 0, baseRadiusX, 0, Math.PI * 2)
        ctx.fill()

        const ringProgress = ((Math.max(0, nowMs) + phase) % 1800) / 1800
        const ringRadiusX = 12 + ringProgress * 18
        const ringAlpha = Math.min(1, (1 - ringProgress) * 0.42 * hoverBoost)
        if (typeof ctx.stroke === 'function') {
          ctx.strokeStyle = `rgba(${ringRgb}, ${ringAlpha.toFixed(3)})`
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.arc(0, 0, ringRadiusX, 0, Math.PI * 2)
          ctx.stroke()
        }

        ctx.restore()
      }

      // 2. Vertical Skyward Multi-Layered Light Pillar
      // 2a. Wide outer colored aura (width = 22px)
      const outerW = 22
      if (canLinearGrad) {
        const gOuter = ctx.createLinearGradient(bx, by, bx, topY)
        gOuter.addColorStop(0, `rgba(${outerRgb}, 0.04)`)
        gOuter.addColorStop(0.12, `rgba(${outerRgb}, ${(0.24 * pulse * hoverBoost).toFixed(3)})`)
        gOuter.addColorStop(0.5, `rgba(${outerRgb}, ${(0.12 * pulse * hoverBoost).toFixed(3)})`)
        gOuter.addColorStop(1, `rgba(${outerRgb}, 0)`)
        ctx.fillStyle = gOuter
      } else {
        ctx.fillStyle = `rgba(${outerRgb}, ${(0.14 * pulse * hoverBoost).toFixed(3)})`
      }
      ctx.fillRect(bx - outerW / 2, topY, outerW, beamHeight)

      // 2b. Mid beam body (width = 8px)
      const midW = 8
      if (canLinearGrad) {
        const gMid = ctx.createLinearGradient(bx, by, bx, topY)
        gMid.addColorStop(0, `rgba(${midRgb}, 0.03)`)
        gMid.addColorStop(0.12, `rgba(${midRgb}, ${(0.34 * pulse * hoverBoost).toFixed(3)})`)
        gMid.addColorStop(0.55, `rgba(${midRgb}, ${(0.18 * pulse * hoverBoost).toFixed(3)})`)
        gMid.addColorStop(1, `rgba(${midRgb}, 0)`)
        ctx.fillStyle = gMid
      } else {
        ctx.fillStyle = `rgba(${midRgb}, ${(0.22 * pulse * hoverBoost).toFixed(3)})`
      }
      ctx.fillRect(bx - midW / 2, topY, midW, beamHeight)

      // 2c. Inner core filament (width = 2px, starting 12px above `by` so it never crosses the item sprite)
      const coreW = 2
      const coreBaseY = by - 12
      const coreHeight = Math.max(16, Math.round(beamHeight * 0.88) - 12)
      const coreTopY = coreBaseY - coreHeight
      if (canLinearGrad) {
        const gCore = ctx.createLinearGradient(bx, coreBaseY, bx, coreTopY)
        gCore.addColorStop(0, `rgba(${coreRgb}, 0)`)
        gCore.addColorStop(0.08, `rgba(${coreRgb}, ${(0.48 * pulse * hoverBoost).toFixed(3)})`)
        gCore.addColorStop(0.65, `rgba(${coreRgb}, ${(0.24 * pulse * hoverBoost).toFixed(3)})`)
        gCore.addColorStop(1, `rgba(${coreRgb}, 0)`)
        ctx.fillStyle = gCore
      } else {
        ctx.fillStyle = `rgba(${coreRgb}, ${(0.35 * pulse * hoverBoost).toFixed(3)})`
      }
      ctx.fillRect(bx - 1, coreTopY, coreW, coreHeight)
    }

    // 3. Rising Light Motes (starting above the ground item sprite)
    for (let m = 0; m < 4; m++) {
      const motePeriod = 1500 + m * 230
      const motePhase = ((Math.max(0, nowMs) + phase + m * 410) % motePeriod) / motePeriod
      const moteY = Math.round(by - 16 - motePhase * (beamHeight * 0.76))
      const moteDriftX = Math.round(Math.sin(t * 1.4 + m * 1.9) * 3.5)
      const moteAlpha = Math.sin(motePhase * Math.PI) * 0.55 * hoverBoost
      ctx.fillStyle = `rgba(${coreRgb}, ${moteAlpha.toFixed(3)})`
      ctx.fillRect(bx + moteDriftX - 1, moteY - 1, 2, 3)
    }
  }

  try {
    ctx.globalCompositeOperation = prevComp
  } catch {
    // ignore
  }
  ctx.restore()
}

/**
 * D2Client.dll `0x6fb2ca40` (`MSG_DrawOverheadSpeech`) & `0x6fb2af20` (`MSG_ResolveOverheadOverlap`):
 * Renders speech bubbles above units with `overheadText`, wrapped at `180px` (`0xB4`) in `font16`,
 * anchored at `(unitScreenX - boxW/2, unitScreenY - 50 - lineCount * 15 - 6)`, with overlap avoidance.
 */
export function renderOverheadSpeechBubbles(
  hud: HudManager,
  ctx: CanvasRenderingContext2D,
  nowMs: number,
): void {
  if (!hud.overheadSpeechBubbles || hud.overheadSpeechBubbles.length === 0) return
  ctx.save()
  const placedRects: OverheadSpeechRect113c[] = []
  const measureFn = (s: string) => hud.font.measureText(s, 'font16')
  const lang: TblLang = hud.lang === 'ENG' ? 'ENG' : 'CHI'

  for (const bubble of hud.overheadSpeechBubbles) {
    if (!bubble.text) continue
    if (bubble.expireAtMs !== undefined && bubble.expireAtMs <= nowMs) continue
    const resolvedText = resolveOverheadBubbleText113c(
      bubble.text,
      bubble.unitType ?? bubble.unitKey,
      lang,
    )
    if (!resolvedText) continue
    const layout = computeOverheadBubbleLayout113c(
      resolvedText,
      bubble.screenX,
      bubble.screenY,
      measureFn,
      bubble.color ?? 0,
    )
    if (layout.lines.length === 0) continue
    const resolved = resolveOverheadBubbleOverlap113c(
      {
        x: layout.boxX,
        y: layout.boxY,
        width: layout.boxW,
        height: layout.boxH,
      },
      placedRects,
    )

    // D2Client.dll 0x6fb2b240 (MSG_DrawOverheadBubbleAt): translucent black rect (no border stroke),
    // with alphabetic text baseline at top + 16 + i * 15 so 13px font16 glyphs sit inside [top+3, top+16].
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
    ctx.fillRect(resolved.x, resolved.y, resolved.width, resolved.height)

    const centerX = Math.round(resolved.x + resolved.width / 2)
    for (let i = 0; i < layout.lines.length; i++) {
      const line = layout.lines[i]!
      const colorName = (D2_COLOR_INDEX_TO_NAME[line.color] ?? 'white') as D2ColorCode
      const lineY = resolved.y + OVERHEAD_BUBBLE_BASELINE_OFFSET_Y + i * CHAT_OVERLAY_LINE_HEIGHT
      hud.font.drawText(ctx, line.text, centerX, lineY, {
        font: 'font16',
        color: colorName,
        align: 'center',
        lang,
      })
    }
  }
  ctx.restore()
}

/**
 * D2Client.dll `0x6fb2b730` (`MSG_DrawChatOverlay`):
 * Renders the top-left active chat & event message stream (`10,000 ms` TTL, max 6 wrapped lines per message,
 * max 18 active lines total, portrait & left-panel avoidance, `15px` line height with translucent black rect).
 */
const chatOverlayGlides = new WeakMap<HudManager, LineGlide>()

const chatOverlayGlide = (hud: HudManager): LineGlide =>
  chatOverlayGlides.get(hud) ?? chatOverlayGlides.set(hud, new LineGlide()).get(hud)!

const isSpeechAutoScrolling = (speech: HudManager['worldPanels']['npcSpeech']): boolean =>
  speech?.autoScroll === true && (speech.scrollY ?? 0) < (speech.maxScrollY ?? 0)

const isHudTextMoving = (hud: HudManager, nowMs: number): boolean =>
  isSpeechAutoScrolling(hud.worldPanels.npcSpeech) ||
  chatOverlayGlides.get(hud)?.isMoving(nowMs) === true

export function renderChatOverlay(
  hud: HudManager,
  ctx: CanvasRenderingContext2D,
  screenWidth: number,
  nowMs: number,
): void {
  if (hud.showFps && !hud.worldPanels.escapeMenuOpen) {
    const fpsText = `FPS: ${hud.currentFps}   Ping: ${hud.pingMs}`
    hud.font.drawText(ctx, fpsText, screenWidth - 16, 16, {
      font: 'font16',
      color: 'gold',
      align: 'right',
    })
  }
  if (!hud.chatOverlayMessages || hud.chatOverlayMessages.length === 0) return
  if (hud.worldPanels.escapeMenuOpen) return
  if (hud.leftPanel === 'msg' || (hud.leftPanel !== 'none' && hud.rightPanel !== 'none')) return

  const activeMsgs = hud.chatOverlayMessages.filter(
    (m) => m.text && (m.expireAtMs === undefined || m.expireAtMs > nowMs),
  )
  if (activeMsgs.length === 0) return

  const layout = computeChatOverlayLayout113c({
    screenWidth,
    leftPanelOpen: hud.leftPanel !== 'none',
    rightPanelOpen: hud.rightPanel !== 'none',
    hasTopLeftPortraits: hud.hasVisibleTopLeftPortraits(),
  })

  const measureFn = (s: string) => hud.font.measureText(s, 'font16')
  const allLines = activeMsgs.flatMap((msg) =>
    wrapChatText113c(msg.text, measureFn, layout.maxWrapWidth, msg.color ?? 0).map((line, wrapIndex) => ({ ...line, key: `${msg.createdAtMs ?? ''}|${msg.text}|${wrapIndex}` })),
  )
  if (allLines.length === 0) return

  const visibleStart = Math.max(0, allLines.length - CHAT_OVERLAY_MAX_ACTIVE_LINES)
  const glide = chatOverlayGlide(hud).update(allLines.map((l) => l.key), visibleStart, allLines.length - visibleStart, CHAT_OVERLAY_LINE_HEIGHT, nowMs)
  const firstDrawn = Math.max(0, visibleStart - Math.ceil(Math.max(0, glide) / CHAT_OVERLAY_LINE_HEIGHT))

  const lang: TblLang = hud.lang === 'ENG' ? 'ENG' : 'CHI'
  ctx.save()
  if (glide !== 0) {
    ctx.beginPath()
    ctx.rect(0, layout.startY - 14, screenWidth, CHAT_OVERLAY_MAX_ACTIVE_LINES * CHAT_OVERLAY_LINE_HEIGHT + 2)
    ctx.clip()
  }
  for (let i = firstDrawn; i < allLines.length; i++) {
    const line = allLines[i]!
    const lineY = layout.startY + (i - visibleStart) * CHAT_OVERLAY_LINE_HEIGHT + glide
    const bgX = layout.startX - 5
    const bgY = lineY - 14
    const bgW = Math.max(20, line.width) + 10
    const bgH = 16
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
    ctx.fillRect(bgX, bgY, bgW, bgH)

    const colorName = (D2_COLOR_INDEX_TO_NAME[line.color] ?? 'white') as D2ColorCode
    hud.font.drawText(ctx, line.text, layout.startX, lineY, {
      font: 'font16',
      color: colorName,
      align: 'left',
      lang,
    })
  }
  ctx.restore()
}

/**
 * D2Client.dll `0x6fb20140` (`CHAT_DrawChatInputBox`) & `0x6fb1ef20` (`CHAT_DrawCursor`):
 * - Box rect: `left = 127` (`0x7f`), `top = screenHeight - 103` (`-0x67`),
 *   `right = screenWidth - 128` (`-0x80`, so `width = screenWidth - 255`),
 *   `bottom = top + 47` (`screenHeight - 56`, so `height = 47`).
 * - Drawn via `D2GFX_DrawFilledRect(127, screenHeight - 103, screenWidth - 128, screenHeight - 56, 0, 1)`
 *   (translucent black fill, no border stroke, no "Say:" prefix).
 * - Typed buffer word-wrapped in `font16` (`color = 'white'`) to `maxWrapW = screenWidth - 265` (`-0x109`)
 *   across up to 3 lines (`lineIdx = 0..2`), drawn at `x = 131` (`0x83`), `y = screenHeight - 88 + lineIdx * 15`.
 * - Blinking underscore cursor `0x0D4C` (`"_"`, `500ms` ON / `100ms` OFF) drawn at
 *   `x = 131 + lastLineWidth`, `y = screenHeight - 88 + lastLineIdx * 15` in `font16` white.
 */
export function renderChatInputBox(
  hud: HudManager,
  ctx: CanvasRenderingContext2D,
  screenWidth: number,
  screenHeight: number,
  nowMs: number,
): void {
  if (typeof document !== 'undefined') {
    const domInput = document.getElementById('d2-ingame-chat-input') as HTMLInputElement | null
    if (domInput && domInput.dataset.d2Synced === '1') {
      hud.chatInputOpen = !domInput.hidden
      hud.chatInputText = domInput.value
    }
  }
  if (!hud.chatInputOpen || hud.worldPanels.escapeMenuOpen) return

  const barOffsetX = screenWidth > 800 ? Math.floor((screenWidth - 800) / 2) : 0
  const boxLeft = barOffsetX + 127
  const boxTop = screenHeight - 103
  const boxRight = screenWidth - barOffsetX - 128
  const boxWidth = Math.max(120, boxRight - boxLeft)
  const boxHeight = 47

  ctx.save()
  // 0x6fb2025b: D2GFX_DrawFilledRect(127, screenHeight - 103, screenWidth - 128, screenHeight - 56, 0, 1)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
  ctx.fillRect(boxLeft, boxTop, boxWidth, boxHeight)

  const maxWrapW = Math.max(100, boxWidth - 10)
  const lang: TblLang = hud.lang === 'ENG' ? 'ENG' : 'CHI'
  const measureFn = (s: string) => hud.font.measureText(s, 'font16')

  const rawText = hud.chatInputText ?? ''
  const lines: string[] = []
  let rem = rawText
  for (let lineIdx = 0; lineIdx < 3; lineIdx++) {
    if (lineIdx === 2 || measureFn(rem) <= maxWrapW) {
      lines.push(rem)
      break
    }
    let fitLen = 1
    while (fitLen < rem.length && measureFn(rem.slice(0, fitLen + 1)) <= maxWrapW) {
      fitLen++
    }
    const lastSpaceIdx = rem.lastIndexOf(' ', fitLen)
    if (lastSpaceIdx > 0) {
      lines.push(rem.slice(0, lastSpaceIdx))
      rem = rem.slice(lastSpaceIdx + 1)
    } else {
      lines.push(rem.slice(0, fitLen))
      rem = rem.slice(fitLen)
    }
  }
  if (lines.length === 0) {
    lines.push('')
  }

  const textX = boxLeft + 4
  const baseLine0Y = screenHeight - 88
  for (let i = 0; i < lines.length; i++) {
    const lineStr = lines[i]!
    if (lineStr.length > 0) {
      hud.font.drawText(ctx, lineStr, textX, baseLine0Y + i * 15, {
        font: 'font16',
        color: 'white',
        align: 'left',
        lang,
      })
    }
  }

  // 0x6fb1ef20 (`CHAT_DrawCursor`): 500ms ON (`0x1f4`) / 100ms OFF (`0x64`), `.tbl` `0x0D4C` ("_")
  const lastLineIdx = lines.length - 1
  const lastLineText = lines[lastLineIdx] ?? ''
  const lastLineWidth = lastLineText.length > 0 ? measureFn(lastLineText) : 0
  const cursorVisible = Math.floor(Math.max(0, nowMs)) % 600 < 500
  if (cursorVisible) {
    hud.font.drawText(ctx, '_', textX + lastLineWidth, baseLine0Y + lastLineIdx * 15, {
      font: 'font16',
      color: 'white',
      align: 'left',
      lang,
    })
  }
  ctx.restore()
}

/**
 * #940 R3: repaints the dedicated cursor layer (`#d2-cursor-canvas`) — sizing,
 * clear and docking transform mirror the HUD canvas paint in `render()`, then
 * the cursor sprite is drawn alone.
 */
export function renderCursorLayer(hud: HudManager, nowMs: number): void {
  const internal = hud as unknown as HudRenderInternal
  const canvas = internal.cursorCanvas
  if (canvas === null) return
  // `syncCursorMode` first so a trade/identify flip enters the signature below.
  hud.syncCursorMode(nowMs)
  const cursorInfo = hud.cursor.getCurrentFrame(nowMs)
  const heldItem = hud.inventory.cursorItem
  const signature = [
    hud.mouseX,
    hud.mouseY,
    cursorInfo.frame?.x ?? -1,
    cursorInfo.frame?.y ?? -1,
    hud.cursor.tradeCursorMode ?? '',
    heldItem === null ? '' : heldItem.id,
    canvas.clientWidth,
    canvas.clientHeight,
  ].join('|')
  if (signature === internal.lastCursorLayerSignature) return
  internal.lastCursorLayerSignature = signature
  const rawCtx = canvas.getContext('2d')
  if (!rawCtx) return
  const ctx = internal.ensureCanvas2DContext(rawCtx)
  const profile = hud.viewportProfile
  const hasWindow = typeof window !== 'undefined'
  const winW = hasWindow && window.innerWidth ? window.innerWidth : profile.width
  const winH = hasWindow && window.innerHeight ? window.innerHeight : profile.height
  const cssW = Math.max(320, canvas.clientWidth || winW)
  const cssH = Math.max(240, canvas.clientHeight || winH)
  const dpr = crispHudDpr(cssW, cssH, profile)
  const targetW = Math.round(cssW * dpr)
  const targetH = Math.round(cssH * dpr)
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW
    canvas.height = targetH
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, targetW, targetH)
  }
  if (canvas.style) {
    canvas.style.display = 'block'
  }
  const { uiScale, offsetX, offsetY } = computeDockingLayout(cssW, cssH, dpr, profile)
  ctx.imageSmoothingEnabled = false
  ctx.save()
  ctx.translate(Math.round(offsetX * dpr), Math.round(offsetY * dpr))
  ctx.scale(uiScale * dpr, uiScale * dpr)
  hud.renderCursor(ctx, nowMs)
  ctx.restore()
}

/**
 * #940 R3: shows/clears the dedicated cursor layer.
 */
export function setCursorLayerActive(hud: HudManager, active: boolean): void {
  const internal = hud as unknown as HudRenderInternal
  const canvas = internal.cursorCanvas
  if (canvas === null) return
  if (active) return
  internal.lastCursorLayerSignature = null
  const rawCtx = canvas.getContext('2d')
  if (rawCtx) {
    rawCtx.setTransform(1, 0, 0, 1, 0, 0)
    rawCtx.clearRect(0, 0, canvas.width, canvas.height)
  }
  if (canvas.style) {
    canvas.style.display = 'none'
  }
}

/**
 * Renders the authentic animated hand cursor, `buysell.dc6` trade/repair/identify cursor, or held cursorItem at cursor hotspot.
 */
export function renderCursor(
  hud: HudManager,
  ctx: CanvasRenderingContext2D,
  nowMs: number = performance.now(),
): void {
  const internal = hud as unknown as HudRenderInternal
  hud.syncCursorMode(nowMs)
  const cursorAtlas = internal.images.get('cursorAtlas') ?? internal.images.get('cursorHand') ?? null
  const effectiveRects =
    Object.keys(internal.itemRects).length > 0 ? internal.itemRects : BAKED_UI_MANIFEST.itemRects
  const heldItem = hud.inventory.cursorItem
    ? {
        atlas: internal.images.get('itemsAtlas') ?? null,
        rect: resolveItemSpriteRect(hud.inventory.cursorItem, effectiveRects) ?? null,
        ethereal: isUiItemEthereal(hud.inventory.cursorItem),
      }
    : null

  hud.cursor.render(
    ctx,
    cursorAtlas,
    nowMs,
    heldItem && heldItem.atlas && heldItem.rect
      ? { atlas: heldItem.atlas, rect: heldItem.rect, ethereal: heldItem.ethereal }
      : null,
  )
}

export function syncHudPublishedState(hud: HudManager): void {
  const internal = hud as unknown as HudRenderInternal & {
    decodedDc6Count: number
    dc6DecodeFailures: number
  }
  hud.syncPlayerContext()
  hud.syncCursorMode(hud.cursor.lastNowMs)
  const cursorInfo = hud.cursor.getCurrentFrame(hud.cursor.lastNowMs)
  hud.state.dc6DecodeFailures = internal.dc6DecodeFailures
  hud.state.decodedDc6Count = internal.decodedDc6Count
  hud.state.assetsLoaded = {
    ctrlPnl: internal.images.has('ctrlPnl'),
    globes: internal.images.has('globeLife') && internal.images.has('globeMana'),
    borders: internal.images.has('borderLeft') && internal.images.has('borderRight'),
    invSheet: internal.images.has('invSheet'),
    charSheet: internal.images.has('charSheet'),
    skillTree: true,
    font: hud.font.loaded,
    itemsAtlas: internal.images.has('itemsAtlas'),
    questsAtlas: internal.images.has('questsAtlas'),
    escapeMenu:
      internal.images.has('escOptions') &&
      internal.images.has('escExit') &&
      internal.images.has('escReturn') &&
      internal.images.has('pentSpin'),
  }
  hud.state.leftPanel = hud.leftPanel
  hud.state.rightPanel = hud.rightPanel
  hud.state.beltExpanded = hud.belt.isExpanded
  hud.state.beltPotionsCount = hud.belt.countTotalPotions()
  hud.state.miniPanelOpen = hud.controlBar.miniPanelOpen
  hud.state.isRunning = hud.isRunning
  hud.state.showGroundLabels = hud.showGroundLabels
  hud.state.cursorState = hud.cursor.state
  hud.state.cursorTradeMode = hud.cursor.tradeCursorMode
  hud.state.cursorAnimation = cursorInfo.animation
  hud.state.cursorFrameIndex = cursorInfo.frameIndex
  hud.state.cursorItem = hud.inventory.cursorItem?.id ?? null
  hud.state.equippedSlots = Object.keys(hud.inventory.equipped)
  hud.state.bagItemsCount = hud.inventory.gridItems.length
  hud.state.weaponSwapSet = hud.inventory.weaponSwapSet
  hud.state.leftSkillId = hud.hotkeys.leftSkillId
  hud.state.rightSkillId = hud.hotkeys.rightSkillId
  hud.state.characterLevel = hud.charSheet.attrs.level
  hud.state.statPoints = hud.charSheet.attrs.statPoints
  hud.state.skillPoints = hud.skillTree.unspentSkillPoints
  hud.state.hp = Math.round(hud.hp)
  hud.state.maxHp = Math.round(hud.maxHp)
  hud.state.mana = Math.round(hud.mana)
  hud.state.maxMana = Math.round(hud.maxMana)
  hud.state.stamina = Math.round(hud.stamina)
  hud.state.maxStamina = Math.round(hud.maxStamina)
  hud.state.docking = hud.getDockingLayout()
  hud.state.viewportProfile = hud.viewportProfile
  hud.state.activeVendor = hud.worldPanels.activeVendorDescriptor?.displayName ?? null
  hud.state.vendorMode = hud.worldPanels.vendorMode
  hud.state.vendorTradeState = hud.worldPanels.vendorTradeState
  hud.state.vendorTab = hud.worldPanels.activeVendorTab
  hud.state.vendorItemsCount = hud.worldPanels.getActiveVendorPlacements().length
  hud.state.npcMenuOpen = hud.worldPanels.npcMenu !== null
  hud.state.escapeMenuOpen = hud.worldPanels.escapeMenuOpen
  hud.state.escapeMenuSelectedIndex = hud.worldPanels.escapeMenuSelectedIndex
  hud.state.escapeMenuScreen = hud.worldPanels.escapeMenuScreen
  internal.lastHudFrameTiming = null
  if (internal.hudCanvas?.style) {
    const intercept =
      hud.isPointInterceptedByHud(hud.mouseX, hud.mouseY) ||
      hud.inventory.cursorItem !== null ||
      hud.worldPanels.vendorTradeState !== 'idle' ||
      hud.inventory.isIdentifyMode() ||
      hud.pendingIdentifyScrollId !== null
    internal.hudCanvas.style.pointerEvents = intercept ? 'auto' : 'none'
  }
}
