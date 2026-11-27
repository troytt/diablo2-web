/**
 * PD2 widescreen presentation: `SGD2FreeRes.dll` config, resolution ids, tile culling bound, screen
 * shift, and the draw layouts of the 800 interface bar, the interface-bar background and the
 * side-screen background / border frame.
 *
 * Ground truth and how each part was checked:
 * - `pd2-data/SGD2FreeResolution.json` (metadata version 3.0.1.0) is parsed as-is; the PD2 values are
 *   pinned in {@link PD2_SGD2FREERES_CONFIG} and the test re-reads the file.
 * - `pd2-data/SGD2FreeRes.dll` contains every default asset path and config key used below (the test
 *   greps the DLL), and the DC6 frame sizes in {@link SGD2FREERES_PANEL_FRAME_SIZES} are what the decoder
 *   reads from `SGD2FreeRes.mpq` (27 DC6s under `data\SGD2FreeResolution\ui\panel\`).
 * - The layout arithmetic is a port of the upstream C++ source, SlashGaming Diablo II Free Resolution
 *   (`mir-diablo-ii-tools/SlashGaming-Diablo-II-Free-Resolution` @ `f58f85ca`) plus its drawing API
 *   (`SlashGaming-Diablo-II-API`, `CelContext_Wrapper::DrawFrame` / `CelFile_Wrapper::DrawAllFrames`).
 *   The shipped DLL has not been diffed against that commit instruction by instruction; every function
 *   below names the source file it ports.
 * - Not ported, and throwing: the screen background "ribbons" (`DrawLeft/RightScreenBackgroundRibbon`).
 *
 * PD2 is the client's runtime default (1068x600 from `Ingame Resolution Mode` 3); 1.13c's 800x600 is only
 * reachable through an explicit `'113c'` (parity tooling and tests).
 */

/** Which presentation mode the UI draws: Project Diablo 2 (default) or vanilla 1.13c (explicit only). */
export type UiDataMode = '113c' | 'pd2'

/** A `width x height` pair as SGD2FreeRes stores it. */
export interface Sgd2Resolution {
  readonly width: number
  readonly height: number
}

export interface Sgd2FreeResConfig {
  readonly version: readonly [number, number, number, number]
  /** `Ingame Resolutions`, in file order. */
  readonly ingameResolutions: readonly Sgd2Resolution[]
  /** `Ingame Resolution Mode`: a *config* (registry) id, see {@link resolveSgd2IngameResolution}. */
  readonly ingameResolutionMode: number
  readonly mainMenuResolution: Sgd2Resolution
  readonly customMpqFile: string
  readonly screenBorderFrameEnabled: boolean
  readonly useOriginalScreenBorderFrame: boolean
  readonly use800InterfaceBar: boolean
}

const MAIN_KEY = 'SlashGaming Diablo II Free Resolution'
const META_KEY = '!!!Metadata (Do not modify)!!!'

export const SGD2_RESOLUTION_640x480: Sgd2Resolution = { width: 640, height: 480 }
/** D2 1.13c's fixed in-game resolution, used only for an explicit `'113c'` presentation. */
export const SGD2_RESOLUTION_800x600_113C: Sgd2Resolution = { width: 800, height: 600 }

function parseResolution(raw: unknown, where: string): Sgd2Resolution {
  if (typeof raw !== 'string') throw new Error(`SGD2FreeRes: ${where} must be a "WxH" string, got ${JSON.stringify(raw)}`)
  const m = /^\s*(\d+)\s*x\s*(\d+)\s*$/i.exec(raw)
  if (!m) throw new Error(`SGD2FreeRes: ${where} "${raw}" is not "WxH"`)
  return { width: Number(m[1]), height: Number(m[2]) }
}

function requireKey(obj: Record<string, unknown>, key: string): unknown {
  if (!Object.hasOwn(obj, key)) throw new Error(`SGD2FreeRes: missing key "${key}"`)
  return obj[key]
}

function requireBool(obj: Record<string, unknown>, key: string): boolean {
  const v = requireKey(obj, key)
  if (typeof v !== 'boolean') throw new Error(`SGD2FreeRes: "${key}" must be a boolean`)
  return v
}

function requireUint(obj: Record<string, unknown>, key: string): number {
  const v = requireKey(obj, key)
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw new Error(`SGD2FreeRes: "${key}" must be an unsigned integer`)
  return v
}

/**
 * Parse `SGD2FreeResolution.json`. Every key the presentation needs must be present; the
 * upstream defaults (`config.cc`) are not filled in silently.
 */
export function parseSgd2FreeResConfig(jsonText: string): Sgd2FreeResConfig {
  const root = JSON.parse(jsonText) as Record<string, unknown>
  const main = requireKey(root, MAIN_KEY) as Record<string, unknown>
  if (main === null || typeof main !== 'object') throw new Error(`SGD2FreeRes: "${MAIN_KEY}" must be an object`)
  const meta = requireKey(main, META_KEY) as Record<string, unknown>
  const version = [
    requireUint(meta, 'Major Version A'),
    requireUint(meta, 'Major Version B'),
    requireUint(meta, 'Minor Version A'),
    requireUint(meta, 'Minor Version B'),
  ] as const
  const list = requireKey(main, 'Ingame Resolutions')
  if (!Array.isArray(list) || list.length === 0) throw new Error('SGD2FreeRes: "Ingame Resolutions" must be a non-empty array')
  const customMpq = requireKey(main, 'Custom MPQ File')
  if (typeof customMpq !== 'string') throw new Error('SGD2FreeRes: "Custom MPQ File" must be a string')
  return {
    version,
    ingameResolutions: list.map((r, i) => parseResolution(r, `Ingame Resolutions[${i}]`)),
    ingameResolutionMode: requireUint(main, 'Ingame Resolution Mode'),
    mainMenuResolution: parseResolution(requireKey(main, 'Main Menu Resolution'), 'Main Menu Resolution'),
    customMpqFile: customMpq,
    screenBorderFrameEnabled: requireBool(main, 'Enable Screen Border Frame?'),
    useOriginalScreenBorderFrame: requireBool(main, 'Use Original Screen Border Frame?'),
    use800InterfaceBar: requireBool(main, 'Use 800 Interface Bar?'),
  }
}

/** `pd2-data/SGD2FreeResolution.json` as shipped (re-checked against the file by the test). */
export const PD2_SGD2FREERES_CONFIG: Sgd2FreeResConfig = {
  version: [3, 0, 1, 0],
  ingameResolutions: [
    { width: 640, height: 480 },
    { width: 800, height: 600 },
    { width: 1024, height: 768 },
    { width: 1068, height: 600 },
    { width: 1280, height: 720 },
    { width: 1280, height: 960 },
    { width: 1424, height: 800 },
  ],
  ingameResolutionMode: 3,
  mainMenuResolution: { width: 800, height: 600 },
  customMpqFile: 'SGD2FreeRes.mpq',
  screenBorderFrameEnabled: true,
  useOriginalScreenBorderFrame: false,
  use800InterfaceBar: true,
}

/**
 * Resolutions SGD2FreeRes allows when joining the official Project Diablo 2 Battle.net gateway
 * (`helper/game_resolution.cc`, entry "Project Diablo 2", gateway hash
 * `AB3C21D075AFC5B3A07EEF579576454D89C998E4`). The local config list applies otherwise.
 */
export const PD2_GATEWAY_SGD2_RESOLUTIONS: readonly Sgd2Resolution[] = [
  { width: 640, height: 480 },
  { width: 800, height: 600 },
  { width: 856, height: 480 },
  { width: 1068, height: 600 },
]

function sameRes(a: Sgd2Resolution, b: Sgd2Resolution): boolean {
  return a.width === b.width && a.height === b.height
}

/**
 * Config id -> game resolution, ported from `get_resolution_registry/replacement.cpp`
 * (`reg == 0 ? 0 : reg + 1`, out-of-range reg -> min config id) and `helper/game_resolution.cc`
 * (`GetIngameResolutionFromId`: id 0 = 640x480, id 1 = main menu resolution, otherwise the list entry at
 * `id - 1` when the list starts with 640x480, else `id - 2`).
 *
 * `resolutions` is the "non-crashing" list; under D2DX/D2GL glide (PD2's renderers) that is the
 * whole configured list, which is the default here.
 */
export function resolveSgd2IngameResolution(
  config: Sgd2FreeResConfig,
  configMode: number = config.ingameResolutionMode,
  resolutions: readonly Sgd2Resolution[] = config.ingameResolutions,
): Sgd2Resolution {
  if (resolutions.length === 0) throw new Error('SGD2FreeRes: empty resolution list')
  const startsAt640 = sameRes(resolutions[0]!, SGD2_RESOLUTION_640x480)
  const minConfigId = startsAt640 ? 0 : 1
  const maxConfigId = resolutions.length + minConfigId
  let reg = configMode
  if (reg < minConfigId || reg >= maxConfigId) reg = minConfigId
  const ingameId = reg === 0 ? 0 : reg + 1
  if (ingameId === 0) return SGD2_RESOLUTION_640x480
  if (ingameId === 1) return config.mainMenuResolution
  const index = startsAt640 ? ingameId - 1 : ingameId - 2
  const res = resolutions[index]
  if (!res) throw new Error(`SGD2FreeRes: ingame id ${ingameId} is outside the resolution list`)
  return res
}

/** D2's 640x480 base the side screens are laid out around (`set_screen_shift`, border frames). */
const BASE_W = 640
const BASE_H = 480

/** C++ `int / int` (truncates toward zero). */
function idiv(a: number, b: number): number {
  return Math.trunc(a / b)
}

export interface Sgd2Rect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/**
 * `set_tile_culling_bound/replacement.cpp`: tiles are culled outside
 * `(-80, -80, width + 80, height + 40)`; perspective mode widens it (ported as written, including
 * the `int` truncations).
 */
export function computeSgd2TileCullingRect(width: number, height: number, perspective = false): Sgd2Rect {
  let left = -80
  let top = -80
  let right = width + 80
  let bottom = height + 40
  if (perspective) {
    const height2 = Math.trunc(height / 2)
    const width2 = Math.trunc(width / 2)
    let ratio = height2 < 866.0 ? 1732.0 / (1732.0 - height2) - 1.0 : 1.0
    top -= Math.trunc(height2 * ratio)
    left -= Math.trunc(width2 * ratio)
    right += Math.trunc(width2 * ratio)
    ratio = 1.0 - 1500.0 / (1500.0 + height2)
    bottom -= Math.trunc(height2 * ratio)
  }
  return { left, top, right, bottom }
}

/** `set_screen_shift/replacement.cpp`: `x = w/2 - 320`, `y = -(h/2 - 240)`. */
export function computeSgd2ScreenShift(width: number, height: number): { readonly x: number; readonly y: number } {
  return { x: idiv(width, 2) - BASE_W / 2, y: -(idiv(height, 2) - BASE_H / 2) }
}

/** Frame sizes `[width, height]` of the SGD2FreeRes.mpq DC6s (all offsets are 0). Checked by the test. */
export const SGD2FREERES_PANEL_FRAME_SIZES: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  D2MRChooseResolutionBack: [[256, 256], [144, 256], [256, 144], [144, 144]],
  D2MRFancyBorderBottom: [[256, 60], [28, 60]],
  D2MRFancyBorderCorner: [[60, 60]],
  D2MRFancyBorderInterfaceLeft: [[81, 256], [81, 256], [81, 40]],
  D2MRFancyBorderInterfaceRight: [[81, 256], [81, 256], [81, 40]],
  D2MRFancyBorderLeft: [[60, 256], [60, 28]],
  D2MRFancyBorderRight: [[60, 256], [60, 28]],
  D2MRFancyBorderTop: [[256, 60], [28, 60]],
  D2MRFancyHorizontalBar: [[256, 60], [256, 60], [35, 60]],
  D2MRFancyPanelHorizontalBar: [[254, 47]],
  D2MRFancyPanelInvertHorizontalBar: [[254, 47]],
  D2MRFancyPanelInvertLeft: [[238, 47]],
  D2MRFancyPanelInvertRight: [[238, 47]],
  D2MRFancyPanelLeft: [[238, 47]],
  D2MRFancyPanelRight: [[238, 47]],
  D2MRFancyVerticalBar: [[60, 256], [60, 256], [60, 35]],
  D2MRStoneBack: [[256, 256], [256, 256], [256, 256], [256, 256]],
  NeoD2MRFancyBorderBottomLeft: [[256, 62], [28, 62]],
  NeoD2MRFancyBorderBottomRight: [[256, 62], [28, 62]],
  NeoD2MRFancyBorderCornerBottomLeft: [[59, 62]],
  NeoD2MRFancyBorderCornerBottomRight: [[59, 62]],
  NeoD2MRFancyBorderCornerTopLeft: [[58, 60]],
  NeoD2MRFancyBorderCornerTopRight: [[59, 60]],
  NeoD2MRFancyBorderInterfaceLeft: [[80, 256], [80, 256], [80, 42]],
  NeoD2MRFancyBorderInterfaceRight: [[80, 256], [80, 256], [80, 42]],
  NeoD2MRFancyBorderTopLeft: [[256, 60], [28, 60]],
  NeoD2MRFancyBorderTopRight: [[256, 60], [29, 60]],
}

/** Archive directory of the SGD2FreeRes art. */
export const SGD2FREERES_PANEL_DIR = 'data\\SGD2FreeResolution\\ui\\panel\\'

/** `config.cc` default image paths (all present as strings in PD2's `SGD2FreeRes.dll`). */
export const SGD2FREERES_DEFAULT_IMAGES = {
  screenBackground: 'D2MRStoneBack',
  leftBorderLeft: 'NeoD2MRFancyBorderInterfaceLeft',
  leftBorderTop: 'NeoD2MRFancyBorderTopLeft',
  leftBorderTopRight: 'NeoD2MRFancyBorderCornerTopLeft',
  leftBorderBottom: 'NeoD2MRFancyBorderBottomLeft',
  leftBorderBottomRight: 'NeoD2MRFancyBorderCornerBottomLeft',
  rightBorderRight: 'NeoD2MRFancyBorderInterfaceRight',
  rightBorderTop: 'NeoD2MRFancyBorderTopRight',
  rightBorderTopLeft: 'NeoD2MRFancyBorderCornerTopRight',
  rightBorderBottom: 'NeoD2MRFancyBorderBottomRight',
  rightBorderBottomLeft: 'NeoD2MRFancyBorderCornerBottomRight',
  horizontalRibbon: 'D2MRFancyHorizontalBar',
  verticalRibbon: 'D2MRFancyVerticalBar',
  interfaceBarCenter: 'D2MRFancyPanelInvertHorizontalBar',
  interfaceBarLeft: 'D2MRFancyPanelInvertLeft',
  interfaceBarRight: 'D2MRFancyPanelInvertRight',
} as const

/** Frame sizes of `data\global\ui\PANEL\800CtrlPnl7.dc6` in the PD2 stack (checked by the test). */
export const CTRLPNL800_FRAME_SIZES: readonly (readonly [number, number])[] = [
  [117, 104], [128, 55], [128, 55], [128, 55], [86, 55], [117, 104], [128, 55],
]

/** One sprite draw, resolved to its top-left screen corner. */
export interface Sgd2DrawOp {
  /** DC6 base name (e.g. `D2MRStoneBack`) or `800CtrlPnl7`. */
  readonly image: string
  readonly frame: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type FrameSizes = readonly (readonly [number, number])[]

type XAnchor = 'left' | 'center' | 'right'
type YAnchor = 'top' | 'center' | 'bottom'

function frameSize(sizes: FrameSizes, frame: number, image: string): readonly [number, number] {
  const s = sizes[frame]
  if (!s) throw new Error(`SGD2FreeRes: ${image} has no frame ${frame}`)
  return s
}

function sizesOf(image: string, table: Readonly<Record<string, FrameSizes>>): FrameSizes {
  const s = table[image]
  if (!s) throw new Error(`SGD2FreeRes: no frame sizes for ${image}`)
  return s
}

/**
 * `CelContext_Wrapper::DrawFrame`: x is moved left by `width` (right) or `width / 2` (center); the
 * game call takes the bottom edge, so `top` adds `height`, `center` adds `height / 2`. Returned as the
 * top-left corner.
 */
function drawFrame(image: string, sizes: FrameSizes, frame: number, x: number, y: number, ax: XAnchor, ay: YAnchor): Sgd2DrawOp {
  const [w, h] = frameSize(sizes, frame, image)
  const left = ax === 'left' ? x : ax === 'center' ? x - idiv(w, 2) : x - w
  const bottom = ay === 'top' ? y + h : ay === 'center' ? y + idiv(h, 2) : y
  return { image, frame, x: left, y: bottom - h, width: w, height: h }
}

/** `CelFile_Wrapper::DrawAllFrames`: a `columns x rows` grid anchored as a block, drawn top-left first. */
function drawAllFrames(
  image: string,
  sizes: FrameSizes,
  x: number,
  y: number,
  columns: number,
  rows: number,
  ax: XAnchor,
  ay: YAnchor,
): Sgd2DrawOp[] {
  let totalW = 0
  for (let c = 0; c < columns; c++) totalW += frameSize(sizes, c, image)[0]
  let totalH = 0
  for (let r = 0; r < rows; r++) totalH += frameSize(sizes, r * columns, image)[1]
  const startX = ax === 'left' ? x : ax === 'center' ? x - idiv(totalW, 2) : x - totalW
  const startY = ay === 'top' ? y : ay === 'center' ? y - idiv(totalH, 2) : y - totalH
  const ops: Sgd2DrawOp[] = []
  let coveredH = 0
  for (let r = 0; r < rows; r++) {
    let coveredW = 0
    for (let c = 0; c < columns; c++) {
      const f = c + r * columns
      ops.push(drawFrame(image, sizes, f, startX + coveredW, startY + coveredH, 'left', 'top'))
      coveredW += frameSize(sizes, f, image)[0]
    }
    coveredH += frameSize(sizes, r * columns, image)[1]
  }
  return ops
}

/**
 * `enable_800_interface_bar/replacement.cpp` (`Sgd2fr_D2Client_Draw800InterfaceBar`): frames 1..4 of
 * `800CtrlPnl7.dc6`, centered horizontally, bottom-aligned to the screen.
 */
export function layoutSgd2InterfaceBar800(
  width: number,
  height: number,
  sizes: FrameSizes = CTRLPNL800_FRAME_SIZES,
): Sgd2DrawOp[] {
  let barW = 0
  for (let f = 1; f <= 4; f++) barW += frameSize(sizes, f, '800CtrlPnl7')[0]
  let x = idiv(width - barW, 2)
  const ops: Sgd2DrawOp[] = []
  for (let f = 1; f <= 4; f++) {
    ops.push(drawFrame('800CtrlPnl7', sizes, f, x, height, 'left', 'bottom'))
    x += frameSize(sizes, f, '800CtrlPnl7')[0]
  }
  return ops
}

/**
 * `draw_interface_bar_background/replacement.cpp`: a black `height - 47 .. height` strip, then each
 * half is filled from `117 + 48` px inward, first with the side image's frames, then by repeating the
 * center image, until it reaches `width / 2`. Bottom edge at `height - 1`.
 */
export function layoutSgd2InterfaceBarBackground(
  width: number,
  height: number,
  table: Readonly<Record<string, FrameSizes>> = SGD2FREERES_PANEL_FRAME_SIZES,
): { readonly blackRect: Sgd2Rect; readonly ops: Sgd2DrawOp[] } {
  const half = idiv(width, 2)
  const ops: Sgd2DrawOp[] = []
  const centerImg = SGD2FREERES_DEFAULT_IMAGES.interfaceBarCenter
  const center = sizesOf(centerImg, table)
  for (const side of ['left', 'right'] as const) {
    const sideImg = side === 'left' ? SGD2FREERES_DEFAULT_IMAGES.interfaceBarLeft : SGD2FREERES_DEFAULT_IMAGES.interfaceBarRight
    const sideSizes = sizesOf(sideImg, table)
    const ax: XAnchor = side === 'left' ? 'left' : 'right'
    const at = (covered: number): number => (side === 'left' ? covered : width - covered)
    let covered = 117 + 48
    for (let f = 0; f < sideSizes.length && covered < half; f++) {
      ops.push(drawFrame(sideImg, sideSizes, f, at(covered), height - 1, ax, 'bottom'))
      covered += sideSizes[f]![0]
    }
    for (let i = 0; covered < half; i++) {
      const f = i % center.length
      ops.push(drawFrame(centerImg, center, f, at(covered), height - 1, ax, 'bottom'))
      covered += center[f]![0]
    }
  }
  return { blackRect: { left: 0, top: height - 47, right: width, bottom: height }, ops }
}

export type Sgd2ScreenSide = 'left' | 'right'

/**
 * `draw_screen_background/replacement.cpp` `DrawLeft/RightScreenBackground`: a black half-screen
 * rectangle, then `D2MRStoneBack` tiled outward from the screen center. Even rows use frames
 * `0..n/2-1`, odd rows `n/2..n-1`; the left half walks the frames in reverse. The row loop is bounded by
 * `resolution.width` (sic, upstream), which only over-draws below the screen.
 */
export function layoutSgd2ScreenBackground(
  side: Sgd2ScreenSide,
  width: number,
  height: number,
  table: Readonly<Record<string, FrameSizes>> = SGD2FREERES_PANEL_FRAME_SIZES,
): { readonly blackRect: Sgd2Rect; readonly ops: Sgd2DrawOp[] } {
  const img = SGD2FREERES_DEFAULT_IMAGES.screenBackground
  const sizes = sizesOf(img, table)
  const half = idiv(width, 2)
  const halfFrames = idiv(sizes.length, 2)
  if (halfFrames === 0) throw new Error(`SGD2FreeRes: ${img} needs at least 2 frames`)
  const ops: Sgd2DrawOp[] = []
  let coveredH = 0
  for (let row = 0; coveredH < width; row++) {
    let coveredW = 0
    const rowStart = (row % 2) * halfFrames
    for (let col = 0; coveredW < half - 1; col++) {
      const f = side === 'left'
        ? rowStart + ((halfFrames - 1) - (col % halfFrames))
        : rowStart + (col % halfFrames)
      // Frame offsets are added upstream; every SGD2FreeRes frame has offset (0, 0).
      const x = side === 'left' ? half - coveredW : half + coveredW
      ops.push(drawFrame(img, sizes, f, x, coveredH, side === 'left' ? 'right' : 'left', 'top'))
      coveredW += sizes[f]![0]
    }
    coveredH += sizes[rowStart]![1]
  }
  const blackRect = side === 'left'
    ? { left: 0, top: 0, right: half, bottom: height }
    : { left: half, top: 0, right: width, bottom: height }
  return { blackRect, ops }
}

/**
 * `DrawCustomLeft/RightScreenBorderFrame`: the Neo border pieces around the 640x480-centered side
 * screen. The vertical piece's total height sets the frame's top and bottom around the `256 + 176` px
 * panel; corners sit on the screen's center line, edges continue outward.
 */
export function layoutSgd2CustomScreenBorderFrame(
  side: Sgd2ScreenSide,
  width: number,
  height: number,
  table: Readonly<Record<string, FrameSizes>> = SGD2FREERES_PANEL_FRAME_SIZES,
): Sgd2DrawOp[] {
  const I = SGD2FREERES_DEFAULT_IMAGES
  const vertImg = side === 'left' ? I.leftBorderLeft : I.rightBorderRight
  const topImg = side === 'left' ? I.leftBorderTop : I.rightBorderTop
  const topCornerImg = side === 'left' ? I.leftBorderTopRight : I.rightBorderTopLeft
  const bottomImg = side === 'left' ? I.leftBorderBottom : I.rightBorderBottom
  const bottomCornerImg = side === 'left' ? I.leftBorderBottomRight : I.rightBorderBottomLeft
  const vert = sizesOf(vertImg, table)
  const top = sizesOf(topImg, table)
  const topCorner = sizesOf(topCornerImg, table)
  const bottom = sizesOf(bottomImg, table)
  const bottomCorner = sizesOf(bottomCornerImg, table)

  const half = idiv(width, 2)
  const screenTop = idiv(height - BASE_H, 2)
  const vertH = vert.reduce((s, f) => s + f[1], 0)
  const borderTop = screenTop + idiv((256 + 176) - vertH, 2)
  const borderBottom = screenTop + idiv((256 + 176) + vertH, 2)
  const sumW = (s: FrameSizes): number => s.reduce((a, f) => a + f[0], 0)
  const out = side === 'left' ? 'right' : 'left'
  const sign = side === 'left' ? -1 : 1

  return [
    ...drawAllFrames(topCornerImg, topCorner, half, borderTop, topCorner.length, 1, out, 'top'),
    ...drawAllFrames(topImg, top, half + sign * sumW(topCorner), borderTop, top.length, 1, out, 'top'),
    ...drawAllFrames(bottomCornerImg, bottomCorner, half, borderBottom, bottomCorner.length, 1, out, 'bottom'),
    ...drawAllFrames(bottomImg, bottom, half + sign * sumW(bottomCorner), borderBottom, bottom.length, 1, out, 'bottom'),
    ...drawAllFrames(
      vertImg,
      vert,
      side === 'left' ? idiv(width - BASE_W, 2) : idiv(width + BASE_W, 2),
      borderTop,
      1,
      vert.length,
      out,
      'top',
    ),
  ]
}

/** `DrawLeft/RightScreenBackgroundRibbon`: not ported yet (no guessed geometry). */
export function layoutSgd2ScreenBackgroundRibbon(side: Sgd2ScreenSide): never {
  throw new Error(
    `SGD2FreeRes: the ${side} screen background ribbon (D2MRFancyHorizontalBar / D2MRFancyVerticalBar) is not ported`,
  )
}

/** Everything SGD2FreeRes draws behind an open side screen, in its call order. */
export function layoutSgd2SideScreen(
  side: Sgd2ScreenSide,
  width: number,
  height: number,
  config: Sgd2FreeResConfig = PD2_SGD2FREERES_CONFIG,
): { readonly blackRect: Sgd2Rect; readonly ops: Sgd2DrawOp[] } {
  if (config.useOriginalScreenBorderFrame) {
    throw new Error('SGD2FreeRes: the original 800BorderFrame layout is not ported (PD2 uses the custom frame)')
  }
  const bg = layoutSgd2ScreenBackground(side, width, height)
  const border = config.screenBorderFrameEnabled ? layoutSgd2CustomScreenBorderFrame(side, width, height) : []
  return { blackRect: bg.blackRect, ops: [...bg.ops, ...border] }
}

export type Sgd2ResolutionId = `${number}x${number}`

export function formatSgd2Resolution(r: Sgd2Resolution): Sgd2ResolutionId {
  return `${r.width}x${r.height}`
}

/**
 * The presentation resolution. PD2 (the default) uses the resolution its `SGD2FreeResolution.json`
 * selects (1068x600 as shipped) and offers its whole list; an explicit `'113c'` keeps D2's 800x600.
 */
export class Sgd2FreeResPresentation {
  private mode: UiDataMode = 'pd2'

  constructor(
    private readonly config: Sgd2FreeResConfig = PD2_SGD2FREERES_CONFIG,
    mode: UiDataMode = 'pd2',
  ) {
    this.setDataMode(mode)
  }

  setDataMode(mode: UiDataMode): void {
    if (mode !== '113c' && mode !== 'pd2') throw new Error(`Sgd2FreeResPresentation: unknown data mode ${String(mode)}`)
    this.mode = mode
  }

  getDataMode(): UiDataMode {
    return this.mode
  }

  defaultResolution(): Sgd2Resolution {
    return this.mode === 'pd2' ? resolveSgd2IngameResolution(this.config) : SGD2_RESOLUTION_800x600_113C
  }

  /** {@link defaultResolution} as a `WxH` id. */
  defaultResolutionId(): Sgd2ResolutionId {
    return formatSgd2Resolution(this.defaultResolution())
  }

  /** {@link availableResolutions} as `WxH` ids, in file order. */
  availableResolutionIds(): readonly Sgd2ResolutionId[] {
    return this.availableResolutions().map(formatSgd2Resolution)
  }

  availableResolutions(): readonly Sgd2Resolution[] {
    return this.mode === 'pd2'
      ? this.config.ingameResolutions
      : [SGD2_RESOLUTION_640x480, SGD2_RESOLUTION_800x600_113C]
  }

  /** Whether the SGD2FreeRes side-screen background and border are drawn (PD2 above 800x600 only). */
  drawsSideScreenFrame(width: number, height: number): boolean {
    return this.mode === 'pd2' && this.config.screenBorderFrameEnabled && (width > 800 || height > 600)
  }
}
