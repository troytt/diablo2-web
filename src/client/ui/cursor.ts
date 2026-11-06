/**
 * Diablo II v1.13c Authentic Dynamic Cursor & Idle State Machine (`src/ui/cursor.ts`).
 *
 * Implements:
 * - 3-State Cursor Machine:
 *   1. POINTING: Active state when mouse is moving or idle < 2000ms. Renders `protate` swaying frames.
 *   2. OPENING: Triggered after 2000ms of inactivity. Plays `ohand` 8 frames sequentially.
 *   3. OPEN_IDLE: Once `ohand` finishes, loops `orotate` 8 frames.
 *   - Any mouse movement or mouse event (mousedown/mouseup) resets the idle timer back to 0
 *     and returns immediately to POINTING.
 * - Accurate Hotspot and Coordinate Mapping:
 *   - Mouse position (mouseX, mouseY) is the cursor hotspot.
 *   - Hand cursor draws with index finger tip at (mouseX, mouseY).
 *   - Held items (this.inventory.cursorItem) are rendered centered at the cursor hotspot.
 * - Zero Runtime MPQ/DLL calls.
 * - PD2 (the client default): D2GL's HD cursor (`common/ui/pd2-hd-cursor.ts`) drawn from the baked
 *   `/cursor-pd2/manifest.json` sheets. Until they load, and if they are missing (reported through
 *   `reportMissingArt`), the DC6 cursor above is drawn. An explicit `'113c'` always draws the DC6 cursor.
 */

import {
  BUYSELL_CURSOR_FRAMES,
  CURSOR_METADATA,
  type BuySellCursorMode,
  type CursorAtlasMetadata,
  type CursorFrameMeta,
} from '../../common/items/cursor-meta.ts'
import {
  HD_CURSOR_CELL,
  HD_CURSOR_DRAW_SIZE,
  HD_CURSOR_IDLE_STEP_MS,
  HD_CURSOR_OFFSET,
  HdCursorAnimator,
  HdCursorMode,
  HdCursorType,
  PD2_HD_CURSOR_FILES,
  PD2_HD_CURSOR_MANIFEST_URL,
  type CursorFrameRect,
} from '../../common/ui/pd2-hd-cursor.ts'
import type { UiDataMode } from '../../common/ui/pd2-sgd2freeres.ts'
import { reportMissingArt } from '../../client/scene/world-renderer.ts'
import { drawImageWithEtherealAlpha } from './inventory.ts'

export { BUYSELL_CURSOR_FRAMES, type BuySellCursorMode }
export type CursorState = 'POINTING' | 'OPENING' | 'OPEN_IDLE' | 'RELEASE' | 'CLICK_DOWN' | 'TARGET_HOLD'
export type CursorAnimation = 'protate' | 'ohand' | 'orotate' | 'buysell'

export interface CursorRenderInfo {
  readonly state: CursorState
  readonly animation: CursorAnimation
  readonly frameIndex: number
  readonly frame: CursorFrameMeta
  readonly drawX: number
  readonly drawY: number
  readonly hotspotX: number
  readonly hotspotY: number
  readonly bounds: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
}

export interface HeldItemRenderInfo {
  readonly atlas: CanvasImageSource
  readonly rect: {
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
  }
  readonly ethereal?: boolean | undefined
}

export type HdCursorSheetKey = keyof typeof PD2_HD_CURSOR_FILES

/** One sheet of `/cursor-pd2/manifest.json` (written by `pack-pd2-hd-cursor.ts`). */
export interface HdCursorManifestSheet {
  readonly image: string
  readonly width: number
  readonly height: number
  readonly frames: readonly CursorFrameRect[]
}

/** `/cursor-pd2/manifest.json`, validated against `pd2-hd-cursor.ts`. */
export interface HdCursorManifest {
  readonly schema: 1
  readonly mode: 'pd2'
  readonly drawSize: number
  readonly offset: { readonly x: number; readonly y: number }
  readonly idleStepMs: number
  readonly sheets: Readonly<Record<HdCursorSheetKey, HdCursorManifestSheet>>
}

export interface HdCursorSheets {
  readonly manifest: HdCursorManifest
  readonly images: Readonly<Record<HdCursorSheetKey, CanvasImageSource>>
}

/** How the HD cursor fetches its manifest and images (injectable for tests). */
export interface HdCursorAssetLoader {
  fetchJson(url: string): Promise<unknown>
  loadImage(url: string): Promise<CanvasImageSource>
}

/**
 * Check a parsed `/cursor-pd2/manifest.json` against the D2GL constants it was baked from. Any mismatch
 * throws (a stale or foreign manifest must not be drawn with the wrong geometry).
 */
export function parseHdCursorManifest(raw: unknown): HdCursorManifest {
  const fail = (msg: string): never => {
    throw new Error(`${PD2_HD_CURSOR_MANIFEST_URL}: ${msg}`)
  }
  if (raw === null || typeof raw !== 'object') fail('not an object')
  const m = raw as Record<string, unknown>
  if (m.schema !== 1) fail(`schema ${String(m.schema)} (expected 1)`)
  if (m.mode !== 'pd2') fail(`mode ${String(m.mode)} (expected pd2)`)
  if (m.drawSize !== HD_CURSOR_DRAW_SIZE) fail(`drawSize ${String(m.drawSize)} (expected ${HD_CURSOR_DRAW_SIZE})`)
  if (m.idleStepMs !== HD_CURSOR_IDLE_STEP_MS) fail(`idleStepMs ${String(m.idleStepMs)} (expected ${HD_CURSOR_IDLE_STEP_MS})`)
  const offset = m.offset as { x?: unknown; y?: unknown } | null | undefined
  if (!offset || offset.x !== HD_CURSOR_OFFSET.x || offset.y !== HD_CURSOR_OFFSET.y) {
    fail(`offset ${JSON.stringify(offset)} (expected ${JSON.stringify(HD_CURSOR_OFFSET)})`)
  }
  const sheetsRaw = m.sheets as Record<string, unknown> | null | undefined
  if (!sheetsRaw || typeof sheetsRaw !== 'object') fail('missing sheets')
  const sheets = {} as Record<HdCursorSheetKey, HdCursorManifestSheet>
  for (const key of Object.keys(PD2_HD_CURSOR_FILES) as HdCursorSheetKey[]) {
    const spec = PD2_HD_CURSOR_FILES[key]
    const s = sheetsRaw![key] as Partial<HdCursorManifestSheet> | undefined
    if (!s || typeof s.image !== 'string' || s.image === '') fail(`sheet ${key} has no image`)
    if (s!.width !== spec.width || s!.height !== spec.height) {
      fail(`sheet ${key} is ${String(s!.width)}x${String(s!.height)} (expected ${spec.width}x${spec.height})`)
    }
    const frames = s!.frames
    if (!Array.isArray(frames) || frames.length !== spec.frames) {
      fail(`sheet ${key} has ${Array.isArray(frames) ? frames.length : 'no'} frames (expected ${spec.frames})`)
    }
    frames!.forEach((r, i) => {
      if (r.x !== i * HD_CURSOR_CELL || r.y !== 0 || r.width !== HD_CURSOR_CELL || r.height !== HD_CURSOR_CELL) {
        fail(`sheet ${key} frame ${i} is ${JSON.stringify(r)} (expected a ${HD_CURSOR_CELL}px cell at x=${i * HD_CURSOR_CELL})`)
      }
    })
    sheets[key] = { image: s!.image!, width: spec.width, height: spec.height, frames: frames! }
  }
  return {
    schema: 1,
    mode: 'pd2',
    drawSize: HD_CURSOR_DRAW_SIZE,
    offset: { x: HD_CURSOR_OFFSET.x, y: HD_CURSOR_OFFSET.y },
    idleStepMs: HD_CURSOR_IDLE_STEP_MS,
    sheets,
  }
}

/** Browser loader: `fetch` for the manifest, `Image` for the sheets. Throws where neither exists. */
export const BROWSER_HD_CURSOR_LOADER: HdCursorAssetLoader = {
  async fetchJson(url: string): Promise<unknown> {
    if (typeof fetch !== 'function') throw new Error('fetch is not available')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return res.json() as Promise<unknown>
  },
  loadImage(url: string): Promise<CanvasImageSource> {
    if (typeof Image === 'undefined') return Promise.reject(new Error('Image is not available'))
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`failed to load ${url}`))
      img.src = url
    })
  },
}

/** Fetch and validate `/cursor-pd2/manifest.json`, then load both sheets it names. */
export async function loadHdCursorSheets(loader: HdCursorAssetLoader = BROWSER_HD_CURSOR_LOADER): Promise<HdCursorSheets> {
  const manifest = parseHdCursorManifest(await loader.fetchJson(PD2_HD_CURSOR_MANIFEST_URL))
  const [hand, other] = await Promise.all([
    loader.loadImage(manifest.sheets.hand.image),
    loader.loadImage(manifest.sheets.other.image),
  ])
  return { manifest, images: { hand, other } }
}

/** The PD2 HD cursor sheets, shared by every `CursorController` (front-end and HUD) using the browser loader. */
let sharedBrowserHdCursorSheets: Promise<HdCursorSheets> | null = null

/**
 * D2GL `CursorType` for the DC6 controller's current state. The trade cursors map 1:1
 * (`buysell.dc6` identify/buy/sell/repair -> `other.png` cells 0..3); the hand maps by animation: a
 * pressed button is `Press`, the pointing and closing hand (`protate`, reversed `ohand`) is `Hand`
 * (whose frame walk closes the hand), and the opening / open idle hand (`ohand`, `orotate`) is `Idle`.
 */
export function hdCursorTypeFor(state: CursorState, tradeMode: BuySellCursorMode | null): HdCursorType {
  switch (tradeMode) {
    case 'identify':
      return HdCursorType.Identify
    case 'buy':
      return HdCursorType.Buy
    case 'sell':
      return HdCursorType.Sell
    case 'repair':
      return HdCursorType.Repair
    case null:
      break
    default:
      throw new Error(`hdCursorTypeFor: unknown trade cursor mode ${String(tradeMode)}`)
  }
  switch (state) {
    case 'CLICK_DOWN':
      return HdCursorType.Press
    case 'POINTING':
    case 'RELEASE':
    case 'TARGET_HOLD':
      return HdCursorType.Hand
    case 'OPENING':
    case 'OPEN_IDLE':
      return HdCursorType.Idle
    default:
      throw new Error(`hdCursorTypeFor: unknown cursor state ${String(state)}`)
  }
}

export type HdCursorStatus = 'off' | 'idle' | 'loading' | 'ready' | 'missing'

export class CursorController {
  readonly metadata: CursorAtlasMetadata
  mouseX: number = 0
  mouseY: number = 0
  lastActivityTime: number = 0
  lastNowMs: number = 0
  private lastUpdateNowMs: number = NaN
  state: CursorState = 'POINTING'

  /** 8.8 fixed-point counters for frame progression and release rewind per D2Client.dll 0x6fac647c..0x6fac68e3 */
  fixedPointCounter: number = 0
  releaseCounter: number = 0

  /**
   * Active D2Client.dll `buysell.dc6` cursor override (`CursorId = 6` at `0x6fba8558`):
   * - `'buy'` -> frame 3 (`0x6fb3ba30`, `nTradeMode = 2`)
   * - `'sell'` -> frame 4 (`0x6fb3b9f0`, `nTradeMode = 3`)
   * - `'repair'` -> frame 1 (`0x6fb3ba70`, `nTradeMode = 4`)
   * - `'identify'` -> frame 0 (`0x6fb36fb7` / packet `0x3f`)
   * - `null` -> standard hand cursor (`protate` / `ohand` / `orotate`)
   */
  tradeCursorMode: BuySellCursorMode | null = null

  /** Milliseconds of inactivity before transitioning from POINTING to OPENING (D2Client 0x6fac6840 add ecx, 0x1388 = 5000ms). */
  idleThresholdMs: number = 5000

  /** Frame playback duration for looping swaying animations (protate & orotate). */
  frameDurationMs: number = 125 // 8 FPS

  /** Frame playback duration for one-shot finger-to-palm opening transition (ohand). */
  openingFrameDurationMs: number = 125 // 8 frames * 125ms = 1000ms total opening time

  /** PD2 D2GL HD cursor (the default); `'113c'` keeps the DC6 cursor. */
  readonly hdCursor: HdCursorMode
  private readonly hdAnimator = new HdCursorAnimator()
  private hdSheets: HdCursorSheets | null = null
  private hdStatus: Exclude<HdCursorStatus, 'off'> = 'idle'
  private hdLoad: Promise<void> | null = null

  constructor(
    metadata: CursorAtlasMetadata = CURSOR_METADATA,
    initialTimeMs: number = 0,
    dataMode: UiDataMode = 'pd2',
  ) {
    this.metadata = metadata
    this.lastActivityTime = initialTimeMs
    this.lastNowMs = initialTimeMs
    this.hdCursor = new HdCursorMode(dataMode)
  }

  /** `'pd2'` (default) draws the HD cursor; `'113c'` the DC6 cursor. */
  setDataMode(mode: UiDataMode): void {
    this.hdCursor.setDataMode(mode)
  }

  getDataMode(): UiDataMode {
    return this.hdCursor.getDataMode()
  }

  /** `'off'` in 1.13c mode; otherwise where the HD sheets are (`'missing'` means DC6 fallback, reported). */
  getHdCursorStatus(): HdCursorStatus {
    return this.hdCursor.isEnabled() ? this.hdStatus : 'off'
  }

  /**
   * Load the HD cursor sheets (`render` starts this on its own in PD2 mode). A missing or invalid
   * `/cursor-pd2/manifest.json` or sheet is reported through `reportMissingArt` and the DC6 cursor is
   * drawn instead. Pass a `loader` to bypass the shared browser load (tests).
   */
  loadHdCursor(loader?: HdCursorAssetLoader): Promise<void> {
    if (this.hdLoad) return this.hdLoad
    this.hdStatus = 'loading'
    let sheets: Promise<HdCursorSheets>
    if (loader) {
      sheets = loadHdCursorSheets(loader)
    } else {
      sharedBrowserHdCursorSheets ??= loadHdCursorSheets(BROWSER_HD_CURSOR_LOADER)
      sheets = sharedBrowserHdCursorSheets
    }
    this.hdLoad = sheets.then(
      (loaded) => {
        this.hdSheets = loaded
        this.hdStatus = 'ready'
      },
      (err: unknown) => {
        this.hdStatus = 'missing'
        reportMissingArt(
          'ui-cursor',
          PD2_HD_CURSOR_MANIFEST_URL,
          `PD2 HD cursor unavailable, drawing the DC6 cursor: ${err instanceof Error ? err.message : String(err)}`,
        )
      },
    )
    return this.hdLoad
  }

  /**
   * D2GL HD cursor draw for this frame, or `null` when the HD cursor is off or not loaded (the DC6
   * cursor is drawn then).
   */
  getHdCursorDraw(nowMs: number = performance.now()) {
    if (!this.hdCursor.isEnabled() || this.hdStatus !== 'ready') return null
    if (nowMs !== this.lastUpdateNowMs) this.update(nowMs)
    return this.hdAnimator.draw(hdCursorTypeFor(this.state, this.tradeCursorMode), this.mouseX, this.mouseY, nowMs)
  }

  /**
   * Sets or clears the `buysell.dc6` cursor mode (`'buy' | 'sell' | 'repair' | 'identify' | null`).
   */
  setTradeCursorMode(mode: BuySellCursorMode | null, nowMs: number = this.lastNowMs): void {
    if (this.tradeCursorMode !== mode) {
      this.tradeCursorMode = mode
      this.resetIdle(nowMs)
    }
  }

  /**
   * Resets the idle timer and reverts state immediately to POINTING.
   */
  resetIdle(nowMs: number = performance.now()): void {
    this.lastActivityTime = nowMs
    this.lastNowMs = nowMs
    this.lastUpdateNowMs = NaN
    this.state = 'POINTING'
    this.fixedPointCounter = 0
    this.releaseCounter = 0
  }

  /**
   * Updates cursor position and resets the idle timer.
   * If hand is open, transitions to RELEASE state to play ohand in reverse.
   */
  handleMouseMove(x: number, y: number, nowMs: number = performance.now()): void {
    this.mouseX = x
    this.mouseY = y
    this.lastUpdateNowMs = NaN
    if (this.state === 'OPEN_IDLE') {
      this.state = 'RELEASE'
      this.releaseCounter = (8 << 8) - 0x100
      this.lastActivityTime = nowMs
      this.lastNowMs = nowMs
      return
    }
    if (this.state === 'OPENING') {
      this.state = 'RELEASE'
      this.releaseCounter = Math.min((8 << 8) - 0x100, Math.max(0, this.fixedPointCounter))
      this.lastActivityTime = nowMs
      this.lastNowMs = nowMs
      return
    }
    if (this.state === 'RELEASE') {
      this.lastActivityTime = nowMs
      this.lastNowMs = nowMs
      return
    }
    this.resetIdle(nowMs)
  }

  /**
   * Mouse down event handler; transitions to CLICK_DOWN state.
   */
  handleMouseDown(nowMs: number = performance.now()): void {
    this.lastActivityTime = nowMs
    this.lastNowMs = nowMs
    this.lastUpdateNowMs = NaN
    if (this.tradeCursorMode === null) {
      this.state = 'CLICK_DOWN'
    }
  }

  /**
   * Mouse up event handler; reverts from CLICK_DOWN to POINTING.
   */
  handleMouseUp(nowMs: number = performance.now()): void {
    this.lastActivityTime = nowMs
    this.lastNowMs = nowMs
    this.lastUpdateNowMs = NaN
    if (this.state === 'CLICK_DOWN') {
      this.state = 'POINTING'
    }
  }

  /**
   * Evaluates the state machine transitions based on elapsed idle time and 8.8 fixed-point timers.
   */
  update(nowMs: number = performance.now()): CursorState {
    this.lastNowMs = nowMs
    this.lastUpdateNowMs = nowMs
    if (this.tradeCursorMode !== null) {
      this.state = 'POINTING'
      return this.state
    }

    if (this.state === 'CLICK_DOWN') {
      return this.state
    }

    if (this.state === 'RELEASE') {
      this.releaseCounter -= 0x40
      if (this.releaseCounter <= 0) {
        this.releaseCounter = 0
        this.state = 'POINTING'
        this.lastActivityTime = nowMs
      }
      return this.state
    }

    const idleMs = Math.max(0, nowMs - this.lastActivityTime)
    const openingTotalMs = 8 * this.openingFrameDurationMs

    if (idleMs < this.idleThresholdMs) {
      this.state = 'POINTING'
      this.fixedPointCounter = 0
    } else if (idleMs < this.idleThresholdMs + openingTotalMs) {
      this.state = 'OPENING'
      const openingElapsed = idleMs - this.idleThresholdMs
      const frameIdx = Math.min(7, Math.floor(openingElapsed / this.openingFrameDurationMs))
      const frac = Math.floor(((openingElapsed % this.openingFrameDurationMs) / this.openingFrameDurationMs) * 0x100)
      this.fixedPointCounter = (frameIdx << 8) + frac
    } else {
      this.state = 'OPEN_IDLE'
      this.fixedPointCounter = 8 << 8
    }

    return this.state
  }

  /**
   * Computes the current active animation, frame index, drawing coordinates, and bounds.
   */
  getCurrentFrame(nowMs: number = performance.now()): CursorRenderInfo {
    if (nowMs !== this.lastUpdateNowMs) {
      this.update(nowMs)
    }

    let anim: CursorAnimation
    let frameIndex: number
    let frameMeta: CursorFrameMeta

    if (this.tradeCursorMode !== null) {
      anim = 'buysell'
      frameIndex = BUYSELL_CURSOR_FRAMES[this.tradeCursorMode]
      const buysellFrame = this.metadata.buysell?.[frameIndex]
      if (!buysellFrame) {
        throw new Error(`Missing buysell cursor frame ${frameIndex} for mode '${this.tradeCursorMode}'`)
      }
      frameMeta = buysellFrame
    } else {
      const idleMs = Math.max(0, nowMs - this.lastActivityTime)
      const openingTotalMs = 8 * this.openingFrameDurationMs

      if (this.state === 'POINTING' || this.state === 'CLICK_DOWN') {
        anim = 'protate'
        if (this.state === 'CLICK_DOWN') {
          frameIndex = 0
        } else {
          // Looping pointing hand swaying animation driven by animation clock
          const safeClock = Math.max(0, nowMs)
          frameIndex = Math.floor(safeClock / this.frameDurationMs) % 8
        }
      } else if (this.state === 'RELEASE') {
        anim = 'ohand'
        frameIndex = Math.min(7, Math.max(0, this.releaseCounter >> 8))
      } else if (this.state === 'OPENING') {
        anim = 'ohand'
        // Plays ohand 8 frames sequentially
        const openingElapsed = Math.max(0, idleMs - this.idleThresholdMs)
        frameIndex = Math.min(7, Math.max(0, Math.floor(openingElapsed / this.openingFrameDurationMs)))
      } else {
        anim = 'orotate'
        // Open palm swaying idle animation loops 8 frames
        const openIdleElapsed = Math.max(0, idleMs - this.idleThresholdMs - openingTotalMs)
        frameIndex = Math.floor(openIdleElapsed / this.frameDurationMs) % 8
      }

      if (frameIndex < 0 || isNaN(frameIndex)) {
        frameIndex = 0
      }

      const frameList = this.metadata[anim]
      if (!frameList || frameList.length === 0) {
        throw new Error(`Missing cursor animation sequence '${anim}' in cursor metadata`)
      }
      const frame = frameList[frameIndex]
      if (!frame) {
        throw new Error(`Missing cursor frame index ${frameIndex} for animation '${anim}'`)
      }
      frameMeta = frame
    }

    const drawX = Math.round(this.mouseX - frameMeta.hotspotX)
    const drawY = Math.round(this.mouseY - frameMeta.hotspotY)

    return {
      state: this.state,
      animation: anim,
      frameIndex,
      frame: frameMeta,
      drawX,
      drawY,
      hotspotX: frameMeta.hotspotX,
      hotspotY: frameMeta.hotspotY,
      bounds: {
        x: drawX,
        y: drawY,
        width: frameMeta.w,
        height: frameMeta.h,
      },
    }
  }

  /**
   * Returns current cursor rendering bounds.
   */
  getRenderBounds(nowMs: number = performance.now()): { x: number; y: number; width: number; height: number } {
    return this.getCurrentFrame(nowMs).bounds
  }

  /**
   * Renders the cursor (or held item) to the 2D context.
   */
  render(
    ctx: CanvasRenderingContext2D,
    cursorAtlas: CanvasImageSource | null,
    nowMs: number = performance.now(),
    heldItem?: HeldItemRenderInfo | null,
  ): void {
    this.update(nowMs)

    // When an item is held on cursor, render the item centered at cursor hotspot
    if (heldItem && heldItem.atlas && heldItem.rect) {
      const sr = heldItem.rect
      const dx = Math.round(this.mouseX - sr.w / 2)
      const dy = Math.round(this.mouseY - sr.h / 2)
      drawImageWithEtherealAlpha(ctx, Boolean(heldItem.ethereal), () => {
        ctx.drawImage(heldItem.atlas, sr.x, sr.y, sr.w, sr.h, dx, dy, sr.w, sr.h)
      })
      return
    }

    // PD2 (default): D2GL's HD cursor. The DC6 cursor below covers loading and the reported missing case.
    if (this.hdCursor.isEnabled()) {
      if (this.hdStatus === 'idle') void this.loadHdCursor()
      const sheets = this.hdSheets
      const draw = this.getHdCursorDraw(nowMs)
      if (draw && sheets) {
        const cell = sheets.manifest.sheets[draw.sheet].frames[draw.cell]
        if (!cell) throw new Error(`HD cursor sheet ${draw.sheet} has no cell ${draw.cell}`)
        ctx.drawImage(sheets.images[draw.sheet], cell.x, cell.y, cell.width, cell.height, draw.x, draw.y, draw.size, draw.size)
        return
      }
    }

    // Otherwise, render the authentic animated hand cursor or buysell trade cursor
    if (!cursorAtlas) {
      reportMissingArt('ui-cursor', 'cursorAtlas', `state=${this.state}`)
      return
    }

    const info = this.getCurrentFrame(nowMs)
    ctx.drawImage(
      cursorAtlas,
      info.frame.x,
      info.frame.y,
      info.frame.w,
      info.frame.h,
      info.drawX,
      info.drawY,
      info.frame.w,
      info.frame.h,
    )
  }
}
