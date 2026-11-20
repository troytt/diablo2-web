import { ORTHO_SUB_TILE_HEIGHT, ORTHO_SUB_TILE_WIDTH } from '../../common/world/d2map.ts'
import { DEFAULT_VIEWPORT_RESOLUTION, type ViewportResolution } from '../settings/client-settings.ts'

export type { ViewportResolution }

/**
 * Logical size the native D2 1.13c HUD art is authored for: the control panel (`800CtrlPnl7.dc6`) is
 * 800×48 and each dock panel (`800BorderFrame.dc6`) is 400×552. Larger profiles draw that art 1:1 and
 * only re-anchor it (see {@link createViewportProfile}).
 */
export const NATIVE_HUD_WIDTH = 800
export const NATIVE_HUD_HEIGHT = 600

/**
 * Canonical 1.13c viewport camera vertical offset in world orthogonal pixels (-16px).
 * In 1.13c isometric projection, centering on the player shifts the camera by -16px vertically
 * (one 32x16 subtile height) so the player's ground footprint is centered on screen.
 */
export const CAMERA_Y_OFFSET = -16

export interface ViewportProfile {
  readonly id: ViewportResolution
  readonly width: number
  readonly height: number
  /** Control bar x shift `(width - 800) / 2`: the 800px bar stays horizontally centered. */
  readonly barOffsetX: number
  /** Control bar y shift `height - 600`: the bar stays anchored to the bottom edge. */
  readonly barOffsetY: number
  /** Dock panel y shift `(height - 600) / 2`: the native 800×600 panel block stays vertically centered. */
  readonly panelOffsetY: number
}

/**
 * Build a profile whose HUD anchors follow from its size alone:
 * - `barOffsetX   = (width - 800) / 2`
 * - `barOffsetY   = height - 600`
 * - `panelOffsetY = (height - 600) / 2`
 *
 * (1024×768 gives the classic 112 / 168 / 84.) Throws when `id` does not spell `${width}x${height}`,
 * when the size is smaller than the native 800×600 HUD, or when a margin is odd, which would put the
 * centered bar or panels on half pixels.
 */
export function createViewportProfile(
  id: ViewportResolution,
  width: number,
  height: number,
): ViewportProfile {
  if (id !== `${width}x${height}`) {
    throw new Error(`Viewport profile id "${id}" does not match its size ${width}x${height}`)
  }
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`Viewport profile ${id} must have integer dimensions`)
  }
  if (width < 640 || height < 480) {
    throw new Error(
      `Viewport profile ${id} is smaller than the minimum 640x480 resolution`,
    )
  }
  const marginX = width - NATIVE_HUD_WIDTH
  const marginY = height - NATIVE_HUD_HEIGHT
  if (marginX % 2 !== 0 || marginY % 2 !== 0) {
    throw new Error(`Viewport profile ${id} needs even margins to center the HUD on whole pixels`)
  }
  return {
    id,
    width,
    height,
    barOffsetX: marginX / 2,
    barOffsetY: marginY,
    panelOffsetY: marginY / 2,
  }
}

export const VIEWPORT_640x480: ViewportProfile = createViewportProfile('640x480', 640, 480)
export const VIEWPORT_800x600: ViewportProfile = createViewportProfile('800x600', 800, 600)
export const VIEWPORT_1024x768: ViewportProfile = createViewportProfile('1024x768', 1024, 768)
/** ≈16:9 at the native 600-line height (the common HD-mod widescreen size): bar at x = 134, panels at y = 0. */
export const VIEWPORT_1068x600: ViewportProfile = createViewportProfile('1068x600', 1068, 600)
/** 16:9 720p: bar at (240, 120), panels at y = 60. */
export const VIEWPORT_1280x720: ViewportProfile = createViewportProfile('1280x720', 1280, 720)

/** PD2 `SGD2FreeResolution.json` 4:3 960p: bar at (240, 360), panels at y = 180. */
export const VIEWPORT_1280x960: ViewportProfile = createViewportProfile('1280x960', 1280, 960)
/** PD2 `SGD2FreeResolution.json` 16:9 800p: bar at (312, 200), panels at y = 100. */
export const VIEWPORT_1424x800: ViewportProfile = createViewportProfile('1424x800', 1424, 800)

/** D2 1.13c's own resolutions; reachable only through an explicit `'113c'` (parity tooling and tests). */
export const NATIVE_113C_VIEWPORT_RESOLUTIONS: readonly ViewportResolution[] = [
  '640x480',
  '800x600',
] as const

/** Every registered resolution larger than 1.13c's 800x600 (PD2 SGD2FreeRes order). */
export const EXTENDED_VIEWPORT_RESOLUTIONS: readonly ViewportResolution[] = [
  '1024x768',
  '1068x600',
  '1280x720',
  '1280x960',
  '1424x800',
] as const

export const VIEWPORT_PROFILES: Readonly<Record<ViewportResolution, ViewportProfile>> = {
  '640x480': VIEWPORT_640x480,
  '800x600': VIEWPORT_800x600,
  '1024x768': VIEWPORT_1024x768,
  '1068x600': VIEWPORT_1068x600,
  '1280x720': VIEWPORT_1280x720,
  '1280x960': VIEWPORT_1280x960,
  '1424x800': VIEWPORT_1424x800,
}

/**
 * The in-game resolutions of PD2's `SGD2FreeResolution.json`, in file order (all registered above).
 * The PD2 default (`Ingame Resolution Mode` 3) is `1068x600`; see `src/common/ui/pd2-sgd2freeres.ts`.
 */
export const PD2_SGD2FREERES_VIEWPORT_RESOLUTIONS: readonly ViewportResolution[] = [
  '640x480',
  '800x600',
  '1024x768',
  '1068x600',
  '1280x720',
  '1280x960',
  '1424x800',
] as const

/**
 * What the toolbar offers (and plugins revert to) by default: PD2's SGD2FreeRes list. There is no
 * PD2/1.13c switch; a plugin may still narrow the list with `setAllowedViewports`.
 */
export const DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS: readonly ViewportResolution[] = PD2_SGD2FREERES_VIEWPORT_RESOLUTIONS

/** The client's default viewport profile: SGD2FreeRes' PD2 default (`1068x600`). */
export const DEFAULT_VIEWPORT_PROFILE: ViewportProfile = VIEWPORT_PROFILES[DEFAULT_VIEWPORT_RESOLUTION]

/**
 * The fallback when the current viewport is not in `allowed`: the PD2 default when allowed, else
 * 1.13c's `800x600` when allowed, else the first allowed entry. Throws on an empty list.
 */
export function pickFallbackViewport(allowed: readonly ViewportResolution[]): ViewportResolution {
  if (allowed.length === 0) throw new Error('pickFallbackViewport: no allowed viewport resolutions')
  if (allowed.includes(DEFAULT_VIEWPORT_RESOLUTION)) return DEFAULT_VIEWPORT_RESOLUTION
  if (allowed.includes('800x600')) return '800x600'
  return allowed[0]!
}

/**
 * Logical dock width of the half-screen side panels (inventory, character,
 * quest, skills, stash, trade): the panel art is fixed-size — 400px wide
 * (800x600 native) or 320px at 640x480. Extended viewports (>800x600) keep the
 * same panel size docked to the screen edge and expose the extra width as
 * world "channel" between the two dock zones (computeDockingLayout).
 */
export function panelDockWidth(profile: ViewportProfile): number {
  return profile.id === '640x480' ? 320 : 400
}

/**
 * Compute camera horizontal shift in world pixels when a side panel is open.
 *
 * Authentic Diablo II 1.13c behavior: the open panel covers its dock zone at a
 * screen edge, and the camera pans so the player stays centered in the
 * REMAINING visible area:
 * - Left panel open (Character/Quest/Stash/Party/...): camera center moves LEFT
 *   of the player (negative shift) → player renders in the right visible area.
 * - Right panel open (Inventory/Skills): camera center moves RIGHT of the
 *   player (positive shift) → player renders centered in the left visible area.
 * - Both panels open or neither: no shift.
 *
 * Magnitude: half the panel dock width — the covered half is subtracted and
 * the player recenters in what remains, i.e. shift = panelWidth / 2
 * (320→160 at 640x480, 400→200 at every other resolution, including extended
 * viewports where the panel is NOT half the screen; see panelDockWidth).
 */
export function computePanelCameraShift(
  leftPanelOpen?: boolean,
  rightPanelOpen?: boolean,
  panelWidthPx = 400,
): number {
  const left = Boolean(leftPanelOpen)
  const right = Boolean(rightPanelOpen)
  const shiftPx = Math.round(panelWidthPx / 2)
  if (left && !right) return -shiftPx
  if (right && !left) return shiftPx
  return 0
}

/**
 * Resolve a profile from a resolution id (case/whitespace-insensitive) or from a profile-like object
 * (matched by exact width × height). A missing id (or an unregistered size) resolves to the client
 * default {@link DEFAULT_VIEWPORT_PROFILE} (PD2 SGD2FreeRes, `1068x600`); an unknown id string throws.
 * Use {@link getViewportProfileBySize} where an unknown size must fail instead.
 */
export function getViewportProfile(
  input: ViewportResolution | ViewportProfile | string | null | undefined,
): ViewportProfile {
  if (input === null || input === undefined) {
    return DEFAULT_VIEWPORT_PROFILE
  }
  if (typeof input === 'object' && 'width' in input && 'height' in input) {
    return findViewportProfileBySize(input.width, input.height) ?? DEFAULT_VIEWPORT_PROFILE
  }
  if (typeof input === 'string') {
    const clean = input.trim().toLowerCase()
    if (clean === '') {
      return DEFAULT_VIEWPORT_PROFILE
    }
    if (Object.hasOwn(VIEWPORT_PROFILES, clean)) {
      return VIEWPORT_PROFILES[clean as ViewportResolution]
    }
    throw new Error(`Unknown viewport profile "${input}"`)
  }
  return DEFAULT_VIEWPORT_PROFILE
}

/**
 * Strict numeric lookup of a registered profile by its logical size. `height` may be omitted only for a
 * width registered once (`1280` is both `1280x720` and PD2's `1280x960`, so it needs a height).
 * Throws for any size that is not a registered profile, or is ambiguous.
 */
export function getViewportProfileBySize(width: number, height?: number): ViewportProfile {
  if (height === undefined) {
    const matches = Object.values(VIEWPORT_PROFILES).filter((p) => p.width === width)
    if (matches.length > 1) {
      throw new Error(`Viewport width ${width} is ambiguous (${matches.map((p) => p.id).join(', ')}); pass a height`)
    }
  }
  const profile = findViewportProfileBySize(width, height)
  if (!profile) {
    const known = Object.keys(VIEWPORT_PROFILES).join(', ')
    throw new Error(`No viewport profile for ${width}x${height ?? '?'} (registered: ${known})`)
  }
  return profile
}

function findViewportProfileBySize(width: number, height?: number): ViewportProfile | undefined {
  return Object.values(VIEWPORT_PROFILES).find(
    (p) => p.width === width && (height === undefined || p.height === height),
  )
}

/**
 * Whether `profile` is larger than the native 800×600 HUD. Extended profiles pin the 400px dock panels
 * to the viewport edges (left at `x = 0`, right at `x = width - 400`, leaving a `width - 800` px center
 * corridor) and shift the control bar by `barOffsetX/Y`. The 800×600 profile instead docks the panels
 * against the browser window margins (`marginW`).
 */
export function isExtendedViewport(profile: ViewportProfile): boolean {
  return profile.width > NATIVE_HUD_WIDTH || profile.height > NATIVE_HUD_HEIGHT
}

/** Toolbar label for a registered resolution, e.g. `1280×720`. */
export function formatViewportLabel(id: ViewportResolution): string {
  const profile = VIEWPORT_PROFILES[id]
  return `${profile.width}×${profile.height}`
}

export interface ViewportRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ViewportAnchorMetrics {
  readonly profile: ViewportProfile
  readonly bottomBar: ViewportRect
  readonly leftPanel: ViewportRect
  readonly rightPanel: ViewportRect
  readonly centerGapX: number
  readonly centerGapWidth: number
  readonly playAreaCenter: { readonly x: number; readonly y: number }
  readonly screenCenter: { readonly x: number; readonly y: number }
}

/**
 * Compute exact native D2 1.13c HUD panel & control bar anchors for a given `ViewportProfile`.
 * - Bottom bar (800×48) is horizontally centered at `x = barOffsetX`, `y = height - 48 = 552 + barOffsetY`.
 * - Left panel (400×552) is anchored at `x = 0`, `y = panelOffsetY`.
 * - Right panel (400×552) is anchored at `x = width - 400`, `y = panelOffsetY`.
 * - With both panels open, extended profiles leave a `width - 800` px playable gap in the center
 *   (`x = 400..width - 400`): 224px in 1024×768, 268px in 1068×600, 480px in 1280×720.
 */
export function computeViewportAnchors(
  profileOrId: ViewportProfile | ViewportResolution = VIEWPORT_800x600,
): ViewportAnchorMetrics {
  const profile = getViewportProfile(profileOrId)
  if (profile.id === '640x480') {
    return {
      profile,
      bottomBar: {
        x: 0,
        y: 432,
        width: 640,
        height: 48,
      },
      leftPanel: {
        x: 0,
        y: 0,
        width: 320,
        height: 432,
      },
      rightPanel: {
        x: 320,
        y: 0,
        width: 320,
        height: 432,
      },
      centerGapX: 320,
      centerGapWidth: 0,
      playAreaCenter: {
        x: 320,
        y: 216,
      },
      screenCenter: {
        x: 320,
        y: 240,
      },
    }
  }
  const bottomBar: ViewportRect = {
    x: profile.barOffsetX,
    y: 552 + profile.barOffsetY,
    width: 800,
    height: 48,
  }
  const leftPanel: ViewportRect = {
    x: 0,
    y: profile.panelOffsetY,
    width: 400,
    height: 552,
  }
  const rightPanel: ViewportRect = {
    x: profile.width - 400,
    y: profile.panelOffsetY,
    width: 400,
    height: 552,
  }
  return {
    profile,
    bottomBar,
    leftPanel,
    rightPanel,
    centerGapX: 400,
    centerGapWidth: Math.max(0, rightPanel.x - 400),
    playAreaCenter: {
      x: profile.width / 2,
      y: (profile.height - 48) / 2,
    },
    screenCenter: {
      x: profile.width / 2,
      y: profile.height / 2,
    },
  }
}

/**
 * Convert world orthogonal pixel coordinates `(worldX, worldY)` to screen pixels
 * given the camera center `(cameraCenterX, cameraCenterY)` and active `ViewportProfile`.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  cameraCenterX: number,
  cameraCenterY: number,
  profile: ViewportProfile = VIEWPORT_800x600,
): { x: number; y: number } {
  return {
    x: worldX - cameraCenterX + profile.width / 2,
    y: worldY - cameraCenterY + profile.height / 2,
  }
}

/**
 * Convert screen pixels `(screenX, screenY)` to world orthogonal pixel coordinates
 * given the camera center `(cameraCenterX, cameraCenterY)` and active `ViewportProfile`.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  cameraCenterX: number,
  cameraCenterY: number,
  profile: ViewportProfile = VIEWPORT_800x600,
): { x: number; y: number } {
  return {
    x: screenX - profile.width / 2 + cameraCenterX,
    y: screenY - profile.height / 2 + cameraCenterY,
  }
}

/**
 * Convert 1.13c isometric sub-tile coordinates `(subX, subY)` to world orthogonal pixels.
 *
 * Diablo II 1.13c floor tiles are 160×80 px diamonds (DT1 floor blocks) holding 5×5 sub-tiles,
 * so one sub-tile is a 32×16 px diamond and the tile grid places cell `(cx, cy)` at
 * `((cx - cy) * 80, (cx + cy) * 40)` (`ORTHO_CELL_WIDTH` / `ORTHO_CELL_HEIGHT`, see
 * `buildIsoMapScene` / `localSubTileToOrtho`). Units (server sub-tile coordinates) MUST use the
 * same lattice as the tiles they stand on:
 *   `worldX = originX + (subX - subY) * 16`   (`ORTHO_SUB_TILE_WIDTH  = 80 / 5 = 16`)
 *   `worldY = originY + (subX + subY) * 8`    (`ORTHO_SUB_TILE_HEIGHT = 40 / 5 = 8`)
 *
 * Issue #539: this used to multiply by `ORTHO_SUB_TILE_WIDTH / 2` and `ORTHO_SUB_TILE_HEIGHT / 2`,
 * i.e. a 16×8 px lattice at half the tile scale. Every unit (and the camera that follows the
 * player) was drawn at half its distance from the level iso origin, so a player standing on
 * Rogue Encampment floor appeared outside the palisade among the trees.
 */
export function subTileToWorldOrtho(
  subX: number,
  subY: number,
  originX = 0,
  originY = 0,
): { x: number; y: number } {
  return {
    x: originX + (subX - subY) * ORTHO_SUB_TILE_WIDTH,
    y: originY + (subX + subY) * ORTHO_SUB_TILE_HEIGHT,
  }
}

/**
 * Convert sub-tile `(subX, subY)` directly to screen coordinates relative to camera sub-tile `(camSubX, camSubY)`
 * (same 32×16 px sub-tile lattice as {@link subTileToWorldOrtho}).
 */
export function subTileToScreen(
  subX: number,
  subY: number,
  camSubX: number,
  camSubY: number,
  profile: ViewportProfile = VIEWPORT_800x600,
  panelShiftX = 0,
): { x: number; y: number } {
  const dSubX = subX - camSubX
  const dSubY = subY - camSubY
  return {
    x: profile.width / 2 - panelShiftX + (dSubX - dSubY) * ORTHO_SUB_TILE_WIDTH,
    y: profile.height / 2 - CAMERA_Y_OFFSET + (dSubX + dSubY) * ORTHO_SUB_TILE_HEIGHT,
  }
}

/**
 * Convert screen click `(screenX, screenY)` to fractional sub-tile coordinates relative to camera sub-tile `(camSubX, camSubY)`
 * (exact inverse of {@link subTileToScreen}).
 */
export function screenToSubTile(
  screenX: number,
  screenY: number,
  camSubX: number,
  camSubY: number,
  profile: ViewportProfile = VIEWPORT_800x600,
  panelShiftX = 0,
): { x: number; y: number } {
  const relX = screenX - (profile.width / 2 - panelShiftX)
  const relY = screenY - (profile.height / 2 - CAMERA_Y_OFFSET)
  const dx = relX / ORTHO_SUB_TILE_WIDTH
  const dy = relY / ORTHO_SUB_TILE_HEIGHT
  return {
    x: camSubX + (dy + dx) / 2,
    y: camSubY + (dy - dx) / 2,
  }
}

export interface ViewportFitDimensions {
  readonly logicalWidth: number
  readonly logicalHeight: number
  readonly containerWidth: number
  readonly containerHeight: number
  readonly scale: number
  readonly cssWidth: number
  readonly cssHeight: number
  readonly letterboxLeft: number
  readonly letterboxTop: number
}

/**
 * Compute the largest CSS box (`cssWidth × cssHeight`) that preserves the profile's aspect ratio
 * (4:3 for 800×600 / 1024×768, ≈16:9 for 1068×600, 16:9 for 1280×720)
 * that fits inside `(containerWidth × containerHeight)`, retaining side black bars (pillarboxing)
 * on widescreen containers or top/bottom black bars (letterboxing) on narrow containers.
 */
export function computeViewportFitSize(
  profileOrId: ViewportProfile | ViewportResolution,
  containerWidth: number,
  containerHeight: number,
): ViewportFitDimensions {
  const profile = getViewportProfile(profileOrId)
  const validContainer =
    Number.isFinite(containerWidth) &&
    Number.isFinite(containerHeight) &&
    containerWidth > 0 &&
    containerHeight > 0

  if (!validContainer) {
    return {
      logicalWidth: profile.width,
      logicalHeight: profile.height,
      containerWidth: profile.width,
      containerHeight: profile.height,
      scale: 1,
      cssWidth: profile.width,
      cssHeight: profile.height,
      letterboxLeft: 0,
      letterboxTop: 0,
    }
  }

  const scale = Math.min(containerWidth / profile.width, containerHeight / profile.height)
  const cssWidth = Math.max(1, Math.round(profile.width * scale))
  const cssHeight = Math.max(1, Math.round(profile.height * scale))
  const letterboxLeft = Math.max(0, Math.floor((containerWidth - cssWidth) / 2))
  const letterboxTop = Math.max(0, Math.floor((containerHeight - cssHeight) / 2))

  return {
    logicalWidth: profile.width,
    logicalHeight: profile.height,
    containerWidth,
    containerHeight,
    scale,
    cssWidth,
    cssHeight,
    letterboxLeft,
    letterboxTop,
  }
}

export interface ViewportContainerLike {
  readonly clientWidth: number
  readonly clientHeight: number
}

export interface ViewportDomTargets {
  readonly containerEl?: ViewportContainerLike | null | undefined
  readonly stageEl?:
    | {
        style: { width: string; height: string }
        parentElement?: ViewportContainerLike | null
        setAttribute?: (name: string, value: string) => void
      }
    | null
    | undefined
  readonly glCanvas?: { width: number; height: number; style?: { width: string; height: string } } | null | undefined
  readonly hudCanvas?: { width: number; height: number; style?: { width: string; height: string } } | null | undefined
  readonly onResize?: ((profile: ViewportProfile) => void) | undefined
}

/**
 * Resize the stage container, WebGL2 canvas, and 2D HUD overlay canvas in lockstep.
 * When a container (`containerEl` or `stageEl.parentElement`) with positive dimensions is available,
 * stretches the stage CSS box to fit the container while preserving the profile's aspect ratio.
 */
export function applyViewportProfileToDom(
  profileOrId: ViewportProfile | ViewportResolution,
  targets: ViewportDomTargets,
): ViewportProfile {
  const profile = getViewportProfile(profileOrId)
  const container = targets.containerEl ?? targets.stageEl?.parentElement ?? null
  const hasContainerBounds =
    container !== null &&
    Number.isFinite(container.clientWidth) &&
    Number.isFinite(container.clientHeight) &&
    container.clientWidth > 0 &&
    container.clientHeight > 0

  const fit = hasContainerBounds
    ? computeViewportFitSize(profile, container.clientWidth, container.clientHeight)
    : null

  if (targets.stageEl) {
    targets.stageEl.style.width = fit ? `${fit.cssWidth}px` : `${profile.width}px`
    targets.stageEl.style.height = fit ? `${fit.cssHeight}px` : `${profile.height}px`
    targets.stageEl.setAttribute?.('data-viewport', profile.id)
  }
  if (targets.glCanvas) {
    targets.glCanvas.width = profile.width
    targets.glCanvas.height = profile.height
    if (targets.glCanvas.style) {
      targets.glCanvas.style.width = fit ? '100%' : `${profile.width}px`
      targets.glCanvas.style.height = fit ? '100%' : `${profile.height}px`
    }
  }
  if (targets.hudCanvas) {
    targets.hudCanvas.width = profile.width
    targets.hudCanvas.height = profile.height
    if (targets.hudCanvas.style) {
      targets.hudCanvas.style.width = fit ? '100%' : `${profile.width}px`
      targets.hudCanvas.style.height = fit ? '100%' : `${profile.height}px`
    }
  }
  targets.onResize?.(profile)
  return profile
}

