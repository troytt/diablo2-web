/**
 * Diablo II v1.13c Health & Mana Globes (`Panel\Hlthmana.dc6` & `Panel\overlap.dc6`).
 *
 * Implements bottom-up liquid clipping proportional to `hp / maxHp` and `mana / maxMana`,
 * poison green globe state, demon/angel gargoyle glass relief overlays (`overlap.dc6`),
 * and hover/click-to-lock numerical readout (`Life: X / Y`, `Mana: X / Y`).
 */

import type { D2FontRenderer } from './font.ts'
import type { TblLang } from '../i18n/lang.ts'
import { reportMissingArt } from '../../client/scene/world-renderer.ts'
import { resolveTblKey } from '../../common/data/canonical-tbl-strings.ts'

export interface GlobeState {
  readonly hp: number
  readonly maxHp: number
  readonly mana: number
  readonly maxMana: number
  readonly poisoned?: boolean
  /** True while `STATE_HEALTHPOT` (`state = 100` / `0x64`) is active (`D2Client.dll 0x6fad7c3c`). */
  readonly healthPotActive?: boolean
  /** Target HP percentage (`0..100`) from `STAT_HPREGEN (74)` (`D2Client.dll 0x6fad7c5c`). */
  readonly potionLifePercent?: number
  /** True while `STATE_MANAPOT` (`state = 106` / `0x6A`) is active (`D2Client.dll 0x6fad7ad0`). */
  readonly manaPotActive?: boolean
  /** Target Mana percentage (`0..100`) from `STAT_MANARECOVERY (26)` (`D2Client.dll 0x6fad7b06`). */
  readonly potionManaPercent?: number
}

export interface GlobeBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Canonical 800x600 Life Globe coordinates (`D2Client.dll` `0x6fad7bd0`: `xLeft = 29`, `yBottom = 600 - 13 = 587` -> `yTop = 507`). */
export const LIFE_GLOBE_BOUNDS: GlobeBounds = {
  x: 29,
  y: 507,
  width: 80,
  height: 80,
}

/** Canonical 800x600 Mana Globe coordinates (`D2Client.dll` `0x6fad7a90`: `xLeft = 800 - 111 = 689`, `yBottom = 600 - 13 = 587` -> `yTop = 507`). */
export const MANA_GLOBE_BOUNDS: GlobeBounds = {
  x: 689,
  y: 507,
  width: 80,
  height: 80,
}

/** Canonical 640x480 Life Globe coordinates (`D2Client.dll` `0x6fad7bd0`: `xLeft = 29`, `yBottom = 480 - 13 = 467` -> `yTop = 387`). */
export const LIFE_GLOBE_BOUNDS_640: GlobeBounds = {
  x: 29,
  y: 387,
  width: 80,
  height: 80,
}

/** Canonical 640x480 Mana Globe coordinates (`D2Client.dll` `0x6fad7a90`: `xLeft = 640 - 111 = 529`, `yBottom = 480 - 13 = 467` -> `yTop = 387`). */
export const MANA_GLOBE_BOUNDS_640: GlobeBounds = {
  x: 529,
  y: 387,
  width: 80,
  height: 80,
}

export class GlobesHud {
  lifeHovered = false
  manaHovered = false
  lifeTextPinned = false
  manaTextPinned = false
  lang: TblLang = 'CHI'
  is640 = false

  get hoveredGlobe(): 'hp' | 'mana' | null {
    if (this.lifeHovered) return 'hp'
    if (this.manaHovered) return 'mana'
    return null
  }

  set hoveredGlobe(val: 'hp' | 'mana' | null) {
    this.lifeHovered = val === 'hp'
    this.manaHovered = val === 'mana'
  }

  get lifeGlobeBounds(): GlobeBounds {
    return this.is640 ? LIFE_GLOBE_BOUNDS_640 : LIFE_GLOBE_BOUNDS
  }

  get manaGlobeBounds(): GlobeBounds {
    return this.is640 ? MANA_GLOBE_BOUNDS_640 : MANA_GLOBE_BOUNDS
  }

  /**
   * Compute vertical clip rectangle for a globe given current/max values.
   * Life Globe (`D2Client.dll 0x6fad7c09..0x6fad7c21`) clamps `clipH` to a minimum of 2px
   * when `current > 0` so living players remain visible above the `overlap.dc6` bottom rim.
   * Mana Globe (`D2Client.dll 0x6fad7abd..0x6fad7ad2`) uses `minAlivePixels = 0` (no minimum clamp).
   */
  static computeClipRect(
    bounds: GlobeBounds,
    current: number,
    max: number,
    minAlivePixels = bounds === LIFE_GLOBE_BOUNDS || bounds === LIFE_GLOBE_BOUNDS_640 ? 2 : 0,
  ): { srcY: number; dstY: number; clipH: number; ratio: number } {
    const safeMax = Math.max(1, max)
    const ratio = Math.max(0, Math.min(1, current / safeMax))
    const rawClipH = Math.round(bounds.height * ratio)
    const clipH =
      current > 0 && minAlivePixels > 0
        ? Math.min(bounds.height, Math.max(minAlivePixels, rawClipH))
        : rawClipH
    const srcY = bounds.height - clipH
    const dstY = bounds.y + srcY
    return { srcY, dstY, clipH, ratio }
  }

  handleMouseMove(logicalX: number, logicalY: number): void {
    this.lifeHovered = this.hitGlobe(this.lifeGlobeBounds, logicalX, logicalY)
    this.manaHovered = this.hitGlobe(this.manaGlobeBounds, logicalX, logicalY)
  }

  handleClick(logicalX: number, logicalY: number): boolean {
    const screenW = this.is640 ? 640 : 800
    const screenH = this.is640 ? 480 : 600
    const inLifeBox =
      logicalX >= 30 && logicalX <= 105 && logicalY >= screenH - 75 && logicalY <= screenH - 15
    if (inLifeBox || this.hitGlobe(this.lifeGlobeBounds, logicalX, logicalY)) {
      this.lifeTextPinned = !this.lifeTextPinned
      return true
    }
    const inManaBox =
      logicalX >= screenW - 106 &&
      logicalX <= screenW - 31 &&
      logicalY >= screenH - 75 &&
      logicalY <= screenH - 15
    if (inManaBox || this.hitGlobe(this.manaGlobeBounds, logicalX, logicalY)) {
      this.manaTextPinned = !this.manaTextPinned
      return true
    }
    return false
  }

  private hitGlobe(b: GlobeBounds, x: number, y: number): boolean {
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    const dx = x - cx
    const dy = y - cy
    return dx * dx + dy * dy <= 38 * 38
  }

  draw(
    ctx: CanvasRenderingContext2D,
    state: GlobeState,
    assets: {
      lifeImg: HTMLImageElement | null
      manaImg: HTMLImageElement | null
      poisonImg: HTMLImageElement | null
      poisonLifeImg?: HTMLImageElement | null
      overlapLeftImg: HTMLImageElement | null
      overlapRightImg: HTMLImageElement | null
    },
    font: D2FontRenderer,
  ): void {
    const lifeBounds = this.lifeGlobeBounds
    const manaBounds = this.manaGlobeBounds
    const lifeClip = GlobesHud.computeClipRect(lifeBounds, state.hp, state.maxHp, 2)
    const manaClip = GlobesHud.computeClipRect(manaBounds, state.mana, state.maxMana, 0)
    const currentClipH = lifeClip.clipH
    const currentManaClipH = manaClip.clipH

    // Dark socket bowl under globes
    this.drawSocketBowl(ctx, lifeBounds)
    this.drawSocketBowl(ctx, manaBounds)

    // 1a. STATE_HEALTHPOT (100) 25%-alpha incremental red healing preview band (`D2Client.dll 0x6fad7c37..0x6fad7cbd`)
    // Always uses `assets.lifeImg` (`Hlthmana.dc6` frame 0 red liquid) even when `state.poisoned` is true (`0x6fad7c43`).
    if (state.healthPotActive && (state.potionLifePercent ?? 0) > 0 && assets.lifeImg) {
      const clampedLifePct = Math.min(100, Math.max(0, state.potionLifePercent!))
      const targetClipH = Math.min(
        lifeBounds.height,
        Math.trunc((clampedLifePct * lifeBounds.height) / 100),
      )
      if (targetClipH > currentClipH) {
        const bandH = targetClipH - currentClipH
        const bandTop = lifeBounds.height - targetClipH
        const prevAlpha = ctx.globalAlpha ?? 1
        ctx.save()
        ctx.globalAlpha = 0.25
        ctx.drawImage(
          assets.lifeImg,
          0,
          bandTop,
          lifeBounds.width,
          bandH,
          lifeBounds.x,
          lifeBounds.y + bandTop,
          lifeBounds.width,
          bandH,
        )
        ctx.globalAlpha = prevAlpha
        ctx.restore()
      }
    }

    // 1b. Draw Life Liquid (clipped bottom-up, opaque `DRAWMODE_NORMAL = 5` per `0x6fad7cc7..0x6fad7d18`)
    const poisonLiquidImg = assets.poisonImg ?? assets.poisonLifeImg ?? null
    const activeLifeImg = state.poisoned && poisonLiquidImg ? poisonLiquidImg : assets.lifeImg
    if (activeLifeImg && currentClipH > 0) {
      ctx.drawImage(
        activeLifeImg,
        0,
        lifeClip.srcY,
        lifeBounds.width,
        currentClipH,
        lifeBounds.x,
        lifeClip.dstY,
        lifeBounds.width,
        currentClipH,
      )
    } else if (currentClipH > 0) {
      reportMissingArt(
        'ui-globe',
        state.poisoned ? 'poison' : 'life',
        'Authentic life globe asset missing on draw',
      )
    }

    // 2a. STATE_MANAPOT (106) 25%-alpha incremental blue mana preview band (`D2Client.dll 0x6fad7ad0..0x6fad7b60`)
    if (state.manaPotActive && (state.potionManaPercent ?? 0) > 0 && assets.manaImg) {
      const clampedManaPct = Math.min(100, Math.max(0, state.potionManaPercent!))
      const targetManaClipH = Math.min(
        manaBounds.height,
        Math.trunc((clampedManaPct * manaBounds.height) / 100),
      )
      if (targetManaClipH > currentManaClipH) {
        const bandH = targetManaClipH - currentManaClipH
        const bandTop = manaBounds.height - targetManaClipH
        const prevAlpha = ctx.globalAlpha ?? 1
        ctx.save()
        ctx.globalAlpha = 0.25
        ctx.drawImage(
          assets.manaImg,
          0,
          bandTop,
          manaBounds.width,
          bandH,
          manaBounds.x,
          manaBounds.y + bandTop,
          manaBounds.width,
          bandH,
        )
        ctx.globalAlpha = prevAlpha
        ctx.restore()
      }
    }

    // 2b. Draw Mana Liquid (clipped bottom-up)
    if (assets.manaImg && currentManaClipH > 0) {
      ctx.drawImage(
        assets.manaImg,
        0,
        manaClip.srcY,
        manaBounds.width,
        currentManaClipH,
        manaBounds.x,
        manaClip.dstY,
        manaBounds.width,
        currentManaClipH,
      )
    } else if (currentManaClipH > 0) {
      reportMissingArt('ui-globe', 'mana', 'Authentic mana globe asset missing on draw')
    }

    // 3. Draw Demon & Angel Gargoyle Relief Overlays (`overlap.dc6`)
    if (assets.overlapLeftImg) {
      ctx.drawImage(assets.overlapLeftImg, 28, this.is640 ? 387 : 507)
    } else {
      reportMissingArt('ui-globe', 'overlap-left', 'Authentic overlap left asset missing on draw')
    }
    if (assets.overlapRightImg) {
      ctx.drawImage(assets.overlapRightImg, this.is640 ? 530 : 690, this.is640 ? 383 : 503)
    } else {
      reportMissingArt('ui-globe', 'overlap-right', 'Authentic overlap right asset missing on draw')
    }

    // 4. Full localized numerical readouts on mouse hover or pinned state via tbl format strings (`panelhealth`, `panelmana`, D2Client.dll 0x6FAD7590)
    const tipY = this.is640 ? 385 : 505
    if (this.lifeTextPinned || this.lifeHovered) {
      const tmpl = resolveTblKey('panelhealth', this.lang) ?? (this.lang === 'ENG' ? 'Life: %d / %d' : '生命： %d / %d')
      const text = tmpl
        .replace(/%[du]/, String(Math.max(0, Math.round(state.hp))))
        .replace(/%[du]/, String(Math.round(state.maxHp)))
      this.drawGlobeTooltip(ctx, font, text, lifeBounds.x + 36, tipY)
    }
    if (this.manaTextPinned || this.manaHovered) {
      const tmpl = resolveTblKey('panelmana', this.lang) ?? (this.lang === 'ENG' ? 'Mana: %d / %d' : '法力： %d / %d')
      const text = tmpl
        .replace(/%[du]/, String(Math.max(0, Math.round(state.mana))))
        .replace(/%[du]/, String(Math.round(state.maxMana)))
      this.drawGlobeTooltip(ctx, font, text, manaBounds.x + 44, tipY)
    }
  }

  private drawGlobeTooltip(
    ctx: CanvasRenderingContext2D,
    font: D2FontRenderer,
    text: string,
    cx: number,
    y: number,
  ): void {
    const maxW = this.is640 ? 640 : 800
    const w = font.measureText(text, 'font16')
    const clampedCx = Math.max(Math.ceil(w / 2) + 6, Math.min(maxW - Math.ceil(w / 2) - 6, Math.round(cx)))
    font.drawText(ctx, text, clampedCx, y, {
      font: 'font16',
      color: 'white',
      align: 'center',
      shadow: true,
    })
  }

  /**
   * Empty-globe backdrop. 1.13c shows the game world darkened through the
   * unfilled part of the health/mana globes (the HUD canvas is a transparent
   * overlay above the world), so this must stay TRANSLUCENT — an opaque bowl
   * here renders the classic "black upper half" at low HP/mana.
   */
  private drawSocketBowl(ctx: CanvasRenderingContext2D, b: GlobeBounds): void {
    ctx.save()
    ctx.beginPath()
    ctx.arc(b.x + b.width / 2, b.y + b.height / 2, b.width / 2 - 2, 0, Math.PI * 2)
    ctx.fillStyle = GLOBE_EMPTY_BACKDROP_STYLE
    ctx.fill()
    ctx.restore()
  }
}

/** Translucent dark glass over the world for the unfilled globe area (user-verified vs 1.13c). */
export const GLOBE_EMPTY_BACKDROP_STYLE = 'rgba(8, 6, 5, 0.55)'
