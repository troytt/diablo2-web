/**
 * Offline FrontEnd / Battle.net / CharSelect / Campfire / Loading Screen Asset Packer.
 *
 * Strictly follows Diablo II v1.13c decompiled binary assembly:
 * - D2Launch.dll (Main Menu 0x6fa598b0, Bnet Login 0x6fa51440, CharCreate 0x6fa5d780, CharSelect 0x6fa4af00/0x6fa627e0)
 * - D2Multi.dll  (Battle.net Lobby & Create Game 0x6f9d8c90)
 * - D2Client.dll (10-frame Door Loading Screen 0x6fab24e0)
 * - D2Win.dll & D2Gdi.dll (D2Gfx_DrawChar 0x6f876580..0x6f87658f textShifts & D2WinAnimImage 0x6f8f0a50)
 *
 * Extracts all authentic DC6 sprites, palettes, colored bitmap font atlases,
 * 7-class campfire animation strips, 7-class town-neutral (TN) avatar strips,
 * and English TBL strings into `public/ui/frontend/`.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { decodeDc6 } from '../../common/formats/dc6.ts'
import type { SpriteFrame, SpriteSheet } from '../../common/formats/sprite.ts'
import { applyTransform, decodePl2, type Pl2, type Pl2Transform } from '../../common/formats/pl2.ts'
import { decodeTbl } from '../../common/formats/tbl.ts'
import { loadCharacterSheet } from '../../common/units/character.ts'
import { encodeIndexedPng } from '../io/png.ts'
import { generateAssetManifest } from '../io/asset-manifest.ts'
import type { FontAtlasMeta, FontGlyphMetric } from './pack-ui.ts'

interface BlitPlacement {
  readonly frame: SpriteFrame
  readonly x: number
  readonly y: number
}

export interface PackedStripFrameMeta {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly anchorX: number
  readonly anchorY: number
}

export interface PackedAnimStripMeta {
  readonly file: string
  readonly width: number
  readonly height: number
  readonly frameCount: number
  readonly rate?: number
  readonly animRate?: number
  readonly drawMode?: number
  readonly frames: readonly PackedStripFrameMeta[]
}

/**
 * Create an indexed pixel buffer and blit multiple DC6 frames onto it.
 * Index 0 is transparent in DC6 UI sprites.
 */
function stitchFrames(
  width: number,
  height: number,
  placements: readonly BlitPlacement[],
  transparentZero = true,
): Uint8Array {
  const out = new Uint8Array(width * height)
  for (const { frame, x: dstX, y: dstY } of placements) {
    for (let sy = 0; sy < frame.height; sy++) {
      const ty = dstY + sy
      if (ty < 0 || ty >= height) continue
      for (let sx = 0; sx < frame.width; sx++) {
        const tx = dstX + sx
        if (tx < 0 || tx >= width) continue
        const srcIdx = sy * frame.width + sx
        if (transparentZero && frame.mask[srcIdx] === 0) continue
        const color = frame.indices[srcIdx] ?? 0
        if (!transparentZero || color !== 0) {
          out[ty * width + tx] = color
        }
      }
    }
  }
  return out
}

/**
 * Stitch a 12-frame (4x3 grid: 256+256+256+32 = 800, 256+256+88 = 600) full-screen DC6 background.
 */
function stitch800x600Background(sheet: SpriteSheet): Uint8Array {
  const f = sheet.groups[0]!.frames
  if (f.length < 12) {
    throw new Error(`Expected at least 12 frames for 800x600 background, got ${f.length}`)
  }
  const colX = [0, 256, 512, 768]
  const rowY = [0, 256, 512]
  const placements: BlitPlacement[] = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      placements.push({
        frame: f[r * 4 + c]!,
        x: colX[c]!,
        y: rowY[r]!,
      })
    }
  }
  return stitchFrames(800, 600, placements, false)
}

/**
 * Stitch pairs of horizontally split button frames (e.g. WideButtonBlank 256+16 = 272).
 */
function stitchButtonStates(
  sheet: SpriteSheet,
  chunksPerState: number,
): {
  width: number
  height: number
  pixels: Uint8Array
  stateWidth: number
  stateHeight: number
  stateCount: number
} {
  const frames = sheet.groups[0]!.frames
  const stateCount = Math.min(2, Math.floor(frames.length / chunksPerState))
  let stateWidth = 0
  for (let c = 0; c < chunksPerState; c++) {
    stateWidth += frames[c]!.width
  }
  const stateHeight = frames[0]!.height
  const totalWidth = stateWidth * stateCount
  const placements: BlitPlacement[] = []
  for (let s = 0; s < stateCount; s++) {
    let curX = s * stateWidth
    for (let c = 0; c < chunksPerState; c++) {
      const frame = frames[s * chunksPerState + c]!
      placements.push({ frame, x: curX, y: 0 })
      curX += frame.width
    }
  }
  return {
    width: totalWidth,
    height: stateHeight,
    pixels: stitchFrames(totalWidth, stateHeight, placements),
    stateWidth,
    stateHeight,
    stateCount,
  }
}

/**
 * Composite an optional non-additive overlay SpriteSheet onto a base SpriteSheet frame-by-frame
 * in top-left anchor-relative coordinates (anchorX = left, anchorY = top).
 */
function compositeOverlayFrames(
  baseFrames: readonly SpriteFrame[],
  overlayFrames: readonly SpriteFrame[] | null,
): SpriteFrame[] {
  const count = baseFrames.length
  const result: SpriteFrame[] = []
  for (let i = 0; i < count; i++) {
    const base = baseFrames[i]!
    const ov = overlayFrames && i < overlayFrames.length ? overlayFrames[i]! : null
    if (!ov) {
      result.push(base)
      continue
    }
    const baseLeft = base.anchorX ?? 0
    const baseTop = base.anchorY ?? 0
    const baseRight = baseLeft + base.width
    const baseBottom = baseTop + base.height

    const ovLeft = ov.anchorX ?? 0
    const ovTop = ov.anchorY ?? 0
    const ovRight = ovLeft + ov.width
    const ovBottom = ovTop + ov.height

    const minLeft = Math.min(baseLeft, ovLeft)
    const minTop = Math.min(baseTop, ovTop)
    const maxRight = Math.max(baseRight, ovRight)
    const maxBottom = Math.max(baseBottom, ovBottom)

    const unionW = Math.max(1, maxRight - minLeft)
    const unionH = Math.max(1, maxBottom - minTop)
    const indices = new Uint8Array(unionW * unionH)
    const mask = new Uint8Array(unionW * unionH)

    // Blit base
    const bx0 = baseLeft - minLeft
    const by0 = baseTop - minTop
    for (let sy = 0; sy < base.height; sy++) {
      for (let sx = 0; sx < base.width; sx++) {
        const sIdx = sy * base.width + sx
        if (base.mask[sIdx] === 0) continue
        const c = base.indices[sIdx] ?? 0
        if (c === 0) continue
        const dIdx = (by0 + sy) * unionW + (bx0 + sx)
        indices[dIdx] = c
        mask[dIdx] = 1
      }
    }

    // Blit overlay
    const ox0 = ovLeft - minLeft
    const oy0 = ovTop - minTop
    for (let sy = 0; sy < ov.height; sy++) {
      for (let sx = 0; sx < ov.width; sx++) {
        const sIdx = sy * ov.width + sx
        if (ov.mask[sIdx] === 0) continue
        const srcColor = ov.indices[sIdx] ?? 0
        if (srcColor === 0) continue
        const dIdx = (oy0 + sy) * unionW + (ox0 + sx)
        indices[dIdx] = srcColor
        mask[dIdx] = 1
      }
    }

    result.push({
      width: unionW,
      height: unionH,
      anchorX: minLeft,
      anchorY: minTop,
      indices,
      mask,
    })
  }
  return result
}

/**
 * Pack a sequence of SpriteFrames into a grid sprite sheet (max width ~2048) to keep texture sizes compact.
 */
function packFramesToGrid(
  file: string,
  frames: readonly SpriteFrame[],
  maxRowWidth = 2048,
  options?: {
    readonly rate?: number
    readonly animRate?: number
    readonly drawMode?: number
  },
): {
  meta: PackedAnimStripMeta
  pixels: Uint8Array
} {
  let curX = 0
  let curY = 0
  let rowH = 0
  let maxW = 1
  const placements: BlitPlacement[] = []
  const frameMetas: PackedStripFrameMeta[] = []

  for (const frame of frames) {
    if (curX > 0 && curX + frame.width > maxRowWidth) {
      curX = 0
      curY += rowH + 1
      rowH = 0
    }
    placements.push({ frame, x: curX, y: curY })
    frameMetas.push({
      x: curX,
      y: curY,
      w: frame.width,
      h: frame.height,
      anchorX: frame.anchorX ?? 0,
      anchorY: frame.anchorY ?? 0,
    })
    curX += frame.width + 1
    if (curX > maxW) maxW = curX
    if (frame.height > rowH) rowH = frame.height
  }

  const totalH = Math.max(1, curY + rowH)
  const pixels = stitchFrames(maxW, totalH, placements)
  return {
    meta: {
      file,
      width: maxW,
      height: totalH,
      frameCount: frames.length,
      ...(options?.rate !== undefined ? { rate: options.rate } : {}),
      ...(options?.animRate !== undefined ? { animRate: options.animRate } : {}),
      ...(options?.drawMode !== undefined ? { drawMode: options.drawMode } : {}),
      frames: frameMetas,
    },
    pixels,
  }
}

/**
 * Build a bitmap font atlas from `data\local\font\latin\font*.dc6` and `.tbl`.
 */
function buildFontAtlas(
  name: string,
  dc6: SpriteSheet,
  tblBytes: Uint8Array,
): {
  meta: FontAtlasMeta
  pixels: Uint8Array
} {
  const magic = new TextDecoder().decode(tblBytes.slice(0, 4))
  if (magic !== 'Woo!') {
    throw new Error(`Invalid font tbl header for ${name}: ${magic}`)
  }
  const lineHeight = tblBytes[10] || 14
  const capHeight = tblBytes[11] || 16
  const frames = dc6.groups[0]!.frames
  const cellW = Math.max(16, ...frames.map(f => f.width))
  const cellH = Math.max(16, ...frames.map(f => f.height))
  const atlasWidth = cellW * 16
  const atlasHeight = cellH * 16

  const placements: BlitPlacement[] = []
  const glyphs: FontGlyphMetric[] = []

  for (let i = 0; i < 256; i++) {
    const recOff = 12 + i * 14
    const metricWidth = recOff + 3 < tblBytes.length ? (tblBytes[recOff + 3] || 6) : 6
    const metricHeight = recOff + 4 < tblBytes.length ? (tblBytes[recOff + 4] || lineHeight) : lineHeight
    const frameIdx = recOff + 8 < tblBytes.length ? (tblBytes[recOff + 8] ?? i) : i
    const frame = frames[frameIdx] ?? frames[i]
    const gx = (i % 16) * cellW
    const gy = Math.floor(i / 16) * cellH
    if (frame) {
      placements.push({ frame, x: gx, y: gy })
    }
    glyphs.push({
      code: i,
      width: metricWidth,
      height: metricHeight,
      x: gx,
      y: gy,
      frameW: frame?.width ?? 0,
      frameH: frame?.height ?? 0,
    })
  }

  return {
    meta: {
      name,
      lineHeight,
      capHeight,
      atlasWidth,
      atlasHeight,
      glyphs,
    },
    pixels: stitchFrames(atlasWidth, atlasHeight, placements),
  }
}

function resolveDefaultArchiveDir(argDir?: string): string {
  if (argDir && existsSync(argDir)) return argDir
  if (process.env.D2_DATA_DIR && existsSync(process.env.D2_DATA_DIR)) return process.env.D2_DATA_DIR
  if (existsSync('samples/d2')) return 'samples/d2'
  return argDir ?? 'samples/d2'
}

async function main(): Promise<void> {
  const t0 = performance.now()
  const archiveDir = resolveDefaultArchiveDir(process.argv[2])
  console.log(`Mounting Diablo II v1.13c MPQ archives from ${archiveDir}...`)
  const archives = new MountedArchives()
  for (const m of ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    archives.add(m, await MpqArchive.open(await fileSource(join(archiveDir, m))))
  }

  const skyPl2 = decodePl2(await archives.read('data\\global\\palette\\sky\\pal.pl2'))
  const fecharPl2 = decodePl2(await archives.read('data\\global\\palette\\fechar\\pal.pl2'))
  const act1Pl2 = decodePl2(await archives.read('data\\global\\palette\\act1\\pal.pl2'))
  const loadingPl2Bytes = await archives.read('data\\global\\palette\\loading\\pal.pl2')
  const loadingRgb = new Uint8Array(256 * 3)
  for (let i = 0; i < 256; i++) {
    loadingRgb[i * 3] = loadingPl2Bytes[i * 4] ?? 0
    loadingRgb[i * 3 + 1] = loadingPl2Bytes[i * 4 + 1] ?? 0
    loadingRgb[i * 3 + 2] = loadingPl2Bytes[i * 4 + 2] ?? 0
  }

  const outDir = join(process.cwd(), 'public', 'ui', 'frontend')
  const fontsDir = join(outDir, 'fonts')
  const campfireDir = join(outDir, 'campfire')
  const avatarsDir = join(outDir, 'avatars')
  mkdirSync(outDir, { recursive: true })
  mkdirSync(fontsDir, { recursive: true })
  mkdirSync(campfireDir, { recursive: true })
  mkdirSync(avatarsDir, { recursive: true })

  let decodedCount = 0
  const decodeUiDc6 = async (path: string): Promise<SpriteSheet> => {
    const bytes = await archives.read(path)
    const sheet = decodeDc6(bytes)
    decodedCount++
    for (const g of sheet.groups) {
      for (const f of g.frames) {
        ;(f as { anchorX?: number; anchorY?: number }).anchorX = f.offsetX
        ;(f as { anchorX?: number; anchorY?: number }).anchorY = f.offsetY - f.height
      }
    }
    return sheet
  }

  const savePng = (
    relPath: string,
    width: number,
    height: number,
    pixels: Uint8Array,
    palette: Uint8Array,
    transparent = true,
  ): void => {
    const png = encodeIndexedPng({
      width,
      height,
      pixels,
      palette,
      transparentIndex: transparent ? 0 : undefined,
    })
    writeFileSync(join(outDir, relPath), png)
  }

  // ============================================================================
  // 1. 800x600 Full-Screen Backgrounds
  // ============================================================================
  console.log('Packing 800x600 full-screen backgrounds...')
  const mainBgDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\gameselectscreenEXP.dc6')
  const mainBgPixels = stitch800x600Background(mainBgDc6)
  savePng('bg-main-menu.png', 800, 600, mainBgPixels, skyPl2.rgb, false)

  const charCreateBgDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\charactercreationscreenEXP.dc6')
  const charCreateBgPixels = stitch800x600Background(charCreateBgDc6)
  savePng('bg-char-create.png', 800, 600, charCreateBgPixels, fecharPl2.rgb, false)

  const charSelectBgDc6 = await decodeUiDc6('data\\global\\ui\\CharSelect\\characterselectscreenEXP.dc6')
  const charSelectBgPixels = stitch800x600Background(charSelectBgDc6)
  savePng('bg-char-select.png', 800, 600, charSelectBgPixels, skyPl2.rgb, false)

  const waitingRoomBgDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\waitingroombkgd.dc6')
  const waitingRoomBgPixels = stitch800x600Background(waitingRoomBgDc6)
  savePng('bg-waiting-room.png', 800, 600, waitingRoomBgPixels, act1Pl2.rgb, false)

  // ============================================================================
  // 2. Dialogs, Popups & Selection Boxes
  // ============================================================================
  console.log('Packing dialogs, popups, and buttons...')
  const popupDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\PopUp_340x224.dc6')
  const pf = popupDc6.groups[0]!.frames
  const popupPixels = stitchFrames(340, 224, [
    { frame: pf[0]!, x: 0, y: 0 },
    { frame: pf[1]!, x: 256, y: 0 },
  ], false)
  savePng('popup-340x224.png', 340, 224, popupPixels, skyPl2.rgb, false)

  const termsBgDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\TermsofUseBckg.dc6')
  const tbf = termsBgDc6.groups[0]!.frames
  const termsBgPixels = stitchFrames(593, 451, [
    { frame: tbf[0]!, x: 0, y: 0 },
    { frame: tbf[1]!, x: 256, y: 0 },
    { frame: tbf[2]!, x: 512, y: 0 },
    { frame: tbf[3]!, x: 0, y: 256 },
    { frame: tbf[4]!, x: 256, y: 256 },
    { frame: tbf[5]!, x: 512, y: 256 },
  ], false)
  savePng('terms-of-use-bg.png', 593, 451, termsBgPixels, skyPl2.rgb, false)

  let scrollbarDc6: SpriteSheet
  try {
    scrollbarDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\joingamescrollbars.dc6')
  } catch {
    scrollbarDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\joingamescrollbars.dc6')
  }
  const sbf = scrollbarDc6.groups[0]!.frames
  const scrollbarPlacements: BlitPlacement[] = []
  for (let i = 0; i < Math.min(6, sbf.length); i++) {
    scrollbarPlacements.push({ frame: sbf[i]!, x: i * 12, y: 0 })
  }
  const scrollbarPixels = stitchFrames(72, 14, scrollbarPlacements, true)
  savePng('scrollbar.png', 72, 14, scrollbarPixels, skyPl2.rgb, true)

  const createGameBgDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\creategamebckg.dc6')
  const cgf = createGameBgDc6.groups[0]!.frames
  const createGameBgPixels = stitchFrames(373, 373, [
    { frame: cgf[0]!, x: 0, y: 0 },
    { frame: cgf[1]!, x: 256, y: 0 },
    { frame: cgf[2]!, x: 0, y: 256 },
    { frame: cgf[3]!, x: 256, y: 256 },
  ], false)
  savePng('create-game-bg.png', 373, 373, createGameBgPixels, act1Pl2.rgb, false)

  const joinGameBgDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\joingamebckg.dc6')
  const jgf = joinGameBgDc6.groups[0]!.frames
  const joinGameBgPixels = stitchFrames(373, 373, [
    { frame: jgf[0]!, x: 0, y: 0 },
    { frame: jgf[1]!, x: 256, y: 0 },
    { frame: jgf[2]!, x: 0, y: 256 },
    { frame: jgf[3]!, x: 256, y: 256 },
  ], false)
  savePng('join-game-bg.png', 373, 373, joinGameBgPixels, act1Pl2.rgb, false)

  const charSelectBoxDc6 = await decodeUiDc6('data\\global\\ui\\CharSelect\\charselectbox.dc6')
  const csbf = charSelectBoxDc6.groups[0]!.frames
  const charSelectBoxPixels = stitchFrames(272, 93, [
    { frame: csbf[0]!, x: 0, y: 0 },
    { frame: csbf[1]!, x: 256, y: 0 },
  ], true)
  savePng('charselectbox.png', 272, 93, charSelectBoxPixels, skyPl2.rgb, true)

  const realmSelectDc6 = await decodeUiDc6('data\\global\\ui\\CharSelect\\Realmselect.dc6')
  const rsf = realmSelectDc6.groups[0]!.frames[0]!
  savePng('realmselect.png', rsf.width, rsf.height, rsf.indices, skyPl2.rgb, true)

  const realmBtnDc6 = await decodeUiDc6('data\\global\\ui\\CharSelect\\RealmSelectbuttonthin.dc6')
  const realmBtnStrip = stitchButtonStates(realmBtnDc6, 1)
  savePng('btn-realm-thin.png', realmBtnStrip.width, realmBtnStrip.height, realmBtnStrip.pixels, skyPl2.rgb, true)

  // ============================================================================
  // 3. Buttons, Textboxes, Checkboxes, Radio Buttons & Chat Gem
  // ============================================================================
  const wideBtnDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\WideButtonBlank.dc6')
  const wideBtnStrip = stitchButtonStates(wideBtnDc6, 2) // 272x35 x 2 states = 544x35
  savePng('btn-wide.png', wideBtnStrip.width, wideBtnStrip.height, wideBtnStrip.pixels, skyPl2.rgb, true)

  const wide3BtnDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\3WideButtonBlank.dc6')
  const wide3BtnStrip = stitchButtonStates(wide3BtnDc6, 2) // 272x35 x 2 states = 544x35
  savePng('btn-3wide.png', wide3BtnStrip.width, wide3BtnStrip.height, wide3BtnStrip.pixels, skyPl2.rgb, true)

  const wide02BtnDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\WideButtonBlank02.dc6')
  const wide02BtnStrip = stitchButtonStates(wide02BtnDc6, 2) // 272x25 x 2 states = 544x25
  savePng('btn-wide02.png', wide02BtnStrip.width, wide02BtnStrip.height, wide02BtnStrip.pixels, skyPl2.rgb, true)

  const medBtnDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\MediumButtonBlank.dc6')
  const medBtnStrip = stitchButtonStates(medBtnDc6, 1) // 128x35 x 2 states = 256x35
  savePng('btn-medium.png', medBtnStrip.width, medBtnStrip.height, medBtnStrip.pixels, skyPl2.rgb, true)

  const shortBtnDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\NarrowButtonBlank.dc6')
  const shortBtnStrip = stitchButtonStates(shortBtnDc6, 1) // 135x25 x 2 states = 270x25
  savePng('btn-short.png', shortBtnStrip.width, shortBtnStrip.height, shortBtnStrip.pixels, skyPl2.rgb, true)

  const tallBtnDc6 = await decodeUiDc6('data\\global\\ui\\CharSelect\\TallButtonBlank.dc6')
  const tallBtnStrip = stitchButtonStates(tallBtnDc6, 1) // 168x60 x 2 states = 336x60
  savePng('btn-tall.png', tallBtnStrip.width, tallBtnStrip.height, tallBtnStrip.pixels, skyPl2.rgb, true)

  const popupOkCancelDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\PopUpOkCancel2.dc6')
  const pocf = popupOkCancelDc6.groups[0]!.frames
  const popupOkCancelPixels = stitchFrames(264, 176, [
    { frame: pocf[0]!, x: 0, y: 0 },
    { frame: pocf[1]!, x: 256, y: 0 },
  ], false)
  savePng('popup-okcancel.png', 264, 176, popupOkCancelPixels, skyPl2.rgb, false)

  const textboxDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\textbox2.dc6')
  const tbFrame = textboxDc6.groups[0]!.frames[0]!
  savePng('textbox.png', tbFrame.width, tbFrame.height, tbFrame.indices, skyPl2.rgb, true)

  const clickboxDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\clickbox.dc6')
  const clickboxStrip = stitchButtonStates(clickboxDc6, 1) // 15x16 x 2 states = 30x16
  savePng('clickbox.png', clickboxStrip.width, clickboxStrip.height, clickboxStrip.pixels, fecharPl2.rgb, true)

  const joinClickboxDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\joingameclickbox.dc6')
  const joinClickboxStrip = stitchButtonStates(joinClickboxDc6, 1)
  savePng('joingameclickbox.png', joinClickboxStrip.width, joinClickboxStrip.height, joinClickboxStrip.pixels, act1Pl2.rgb, true)

  const radioDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\radiobutton.dc6')
  const radioStrip = stitchButtonStates(radioDc6, 1) // 16x16 x 2 states = 32x16
  savePng('radiobutton.png', radioStrip.width, radioStrip.height, radioStrip.pixels, act1Pl2.rgb, true)

  const gemBtnDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\gembutton.dc6')
  const gemBtnStrip = stitchButtonStates(gemBtnDc6, 1) // 2 states
  savePng('gembutton.png', gemBtnStrip.width, gemBtnStrip.height, gemBtnStrip.pixels, act1Pl2.rgb, true)

  const chatLeftBtnsDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\chatleftbuttons.dc6')
  const chatLeftBtnsStrip = stitchButtonStates(chatLeftBtnsDc6, 1) // 80x20 x 2 states
  savePng('btn-chatleft.png', chatLeftBtnsStrip.width, chatLeftBtnsStrip.height, chatLeftBtnsStrip.pixels, act1Pl2.rgb, true)

  const chatRightTopBtnsDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\chatrighttopbuttons.dc6')
  const chatRightTopBtnsStrip = stitchButtonStates(chatRightTopBtnsDc6, 1) // 119x20 x 2 states
  savePng('btn-chatrighttop.png', chatRightTopBtnsStrip.width, chatRightTopBtnsStrip.height, chatRightTopBtnsStrip.pixels, act1Pl2.rgb, true)

  const chatRightBtnsDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\chatrightbuttons.dc6')
  const chatRightBtnsStrip = stitchButtonStates(chatRightBtnsDc6, 1) // 79x20 x 2 states
  savePng('btn-chatright.png', chatRightBtnsStrip.width, chatRightBtnsStrip.height, chatRightBtnsStrip.pixels, act1Pl2.rgb, true)

  const gameBtnDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\GameButtonBlank.dc6')
  const gameBtnStrip = stitchButtonStates(gameBtnDc6, 1) // 172x32 x 2 states
  savePng('btn-game.png', gameBtnStrip.width, gameBtnStrip.height, gameBtnStrip.pixels, act1Pl2.rgb, true)

  const btnCancelDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\CancelButtonBlank.dc6')
  const btnCancelStrip = stitchButtonStates(btnCancelDc6, 1) // 96x32 x 2 states
  savePng('btn-create-cancel.png', btnCancelStrip.width, btnCancelStrip.height, btnCancelStrip.pixels, act1Pl2.rgb, true)

  let popupSmallBtnDc6: SpriteSheet
  try {
    popupSmallBtnDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\CancelButtonBlank.dc6')
  } catch {
    popupSmallBtnDc6 = btnCancelDc6
  }
  const popupSmallBtnStrip = stitchButtonStates(popupSmallBtnDc6, 1) // 96x32 x 2 states = 192x32
  savePng('btn-popup-small.png', popupSmallBtnStrip.width, popupSmallBtnStrip.height, popupSmallBtnStrip.pixels, skyPl2.rgb, true)

  const btnCreateGameDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\creategamebutton.dc6')
  const btnCreateGameStrip = stitchButtonStates(btnCreateGameDc6, 1) // 144x36 x 2 states
  savePng('btn-create-game.png', btnCreateGameStrip.width, btnCreateGameStrip.height, btnCreateGameStrip.pixels, act1Pl2.rgb, true)

  const greyLevelBoxDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\GreyLevelBox.dc6')
  const glbFrame = greyLevelBoxDc6.groups[0]!.frames[0]!
  savePng('grey-level-box.png', glbFrame.width, glbFrame.height, glbFrame.indices, act1Pl2.rgb, true)

  // ============================================================================
  // 4. Burning Diablo II Logos (Main Menu & Battle.net Lobby) + Campfire Flames
  // ============================================================================
  console.log('Packing burning Diablo II logos and campfire flame animations...')
  // Main Menu Burning Logo at control anchor (400, 120) on gameselectscreenEXP.dc6
  // Note: D2WinAnimImage with ptAnimTable == NULL subtracts frame0.offset from each frame!
  const logoBlackLDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\D2logoBlackLeft.DC6')
  const logoBlackRDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\D2logoBlackRight.DC6')
  const logoFireLDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\D2logoFireLeft.DC6')
  const logoFireRDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\D2logoFireRight.DC6')

  const animStrips: Record<string, PackedAnimStripMeta> = {}

  {
    const blackFrames = compositeOverlayFrames(
      logoBlackLDc6.groups[0]!.frames,
      logoBlackRDc6.groups[0]!.frames,
    )
    const packedBlack = packFramesToGrid('logo-main-black.png', blackFrames, 2048, { rate: 1 })
    savePng(packedBlack.meta.file, packedBlack.meta.width, packedBlack.meta.height, packedBlack.pixels, skyPl2.rgb, true)
    animStrips['logoMainBlack'] = packedBlack.meta

    const fireFrames = compositeOverlayFrames(
      logoFireLDc6.groups[0]!.frames,
      logoFireRDc6.groups[0]!.frames,
    )
    const packedFire = packFramesToGrid('logo-main-fire.png', fireFrames, 2048, { rate: 1 })
    savePng(packedFire.meta.file, packedFire.meta.width, packedFire.meta.height, packedFire.pixels, skyPl2.rgb, true)
    animStrips['logoMainFire'] = packedFire.meta
  }

  // Battle.net Small Burning Logo at control anchor (84, 52) on waitingroombkgd.dc6
  const bnetBlackDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\D2logoBlackBnet.dc6')
  const bnetFireDc6 = await decodeUiDc6('data\\global\\ui\\BIGMENU\\D2logoBnet.dc6')
  {
    const packedBlack = packFramesToGrid('logo-bnet-black.png', bnetBlackDc6.groups[0]!.frames, 2048, { rate: 1 })
    savePng(packedBlack.meta.file, packedBlack.meta.width, packedBlack.meta.height, packedBlack.pixels, skyPl2.rgb, true)
    animStrips['logoBnetBlack'] = packedBlack.meta

    const packedFire = packFramesToGrid('logo-bnet-fire.png', bnetFireDc6.groups[0]!.frames, 2048, { rate: 1 })
    savePng(packedFire.meta.file, packedFire.meta.width, packedFire.meta.height, packedFire.pixels, skyPl2.rgb, true)
    animStrips['logoBnetFire'] = packedFire.meta
  }

  // Campfire `fire.dc6` at expansion control anchor (345, 470) on charactercreationscreenEXP.dc6 (0x6fa63080)
  const fireDc6 = await decodeUiDc6('data\\global\\ui\\FrontEnd\\fire.dc6')
  {
    const packed = packFramesToGrid('campfire/fire-strip.png', fireDc6.groups[0]!.frames, 2048, {
      rate: 1,
      drawMode: 3,
    })
    savePng(packed.meta.file, packed.meta.width, packed.meta.height, packed.pixels, fecharPl2.rgb, true)
    animStrips['campfireFlame'] = packed.meta
  }

  // ============================================================================
  // 5. 7-Class Campfire Multi-State Animations (fechar/pal.pl2)
  // ============================================================================
  console.log('Packing 7-class campfire multi-state animations...')
  // Per D2Launch.dll 0x6fa68df8, 0x6fa60c08, 0x6fa65d9c, 0x6fa65db0 & 0x6fa5d780:
  // Note: ptAnimTable != NULL does NOT subtract frame0.offset!
  // DrawMode: 5 = DRAWMODE_NORMAL, 3 = DRAWMODE_MODULATE (screen)
  interface ClassCampfireSpec {
    readonly id: string
    readonly dir: string
    readonly prefix: string
    readonly states: readonly {
      readonly key: string
      readonly base: string
      readonly rate: number
      readonly overlay?: string
      readonly overlayDrawMode?: 3 | 5
      readonly compositeOverlay?: boolean
    }[]
  }

  const CAMPFIRE_SPECS: readonly ClassCampfireSpec[] = [
    {
      id: 'am',
      dir: 'amazon',
      prefix: 'am',
      states: [
        { key: 'nu1', base: 'amnu1.dc6', rate: 3 },
        { key: 'nu2', base: 'amnu2.dc6', rate: 3 },
        { key: 'nu3', base: 'amnu3.dc6', rate: 2 },
        { key: 'fw', base: 'amfw.dc6', rate: 1, overlay: 'amfws.dc6', compositeOverlay: true },
        { key: 'bw', base: 'ambw.dc6', rate: 1 },
      ],
    },
    {
      id: 'as',
      dir: 'assassin',
      prefix: 'as',
      states: [
        { key: 'nu1', base: 'asnu1.dc6', rate: 3 },
        { key: 'nu2', base: 'asnu2.dc6', rate: 3 },
        { key: 'nu3', base: 'asnu3.dc6', rate: 2 },
        { key: 'fw', base: 'asfw.dc6', rate: 1 },
        { key: 'bw', base: 'asbw.dc6', rate: 1 },
      ],
    },
    {
      id: 'ne',
      dir: 'necromancer',
      prefix: 'ne',
      states: [
        { key: 'nu1', base: 'nenu1.dc6', rate: 3 },
        { key: 'nu2', base: 'nenu2.dc6', rate: 3 },
        { key: 'nu3', base: 'nenu3.dc6', rate: 2, overlay: 'nenu3s.dc6', overlayDrawMode: 3 },
        { key: 'fw', base: 'nefw.dc6', rate: 1, overlay: 'nefws.dc6', overlayDrawMode: 3 },
        { key: 'bw', base: 'nebw.dc6', rate: 1, overlay: 'nebws.dc6', overlayDrawMode: 3 },
      ],
    },
    {
      id: 'ba',
      dir: 'barbarian',
      prefix: 'ba',
      states: [
        { key: 'nu1', base: 'banu1.dc6', rate: 2 },
        { key: 'nu2', base: 'banu2.dc6', rate: 2 },
        { key: 'nu3', base: 'banu3.dc6', rate: 1 },
        { key: 'fw', base: 'bafw.dc6', rate: 1, overlay: 'bafws.dc6', overlayDrawMode: 5 },
        { key: 'bw', base: 'babw.dc6', rate: 1 },
      ],
    },
    {
      id: 'pa',
      dir: 'paladin',
      prefix: 'pa',
      states: [
        { key: 'nu1', base: 'panu1.dc6', rate: 2 },
        { key: 'nu2', base: 'panu2.dc6', rate: 2 },
        { key: 'nu3', base: 'panu3.dc6', rate: 2 },
        { key: 'fw', base: 'pafw.dc6', rate: 1, overlay: 'pafws.dc6', overlayDrawMode: 5 },
        { key: 'bw', base: 'pabw.dc6', rate: 1 },
      ],
    },
    {
      id: 'so',
      dir: 'sorceress',
      prefix: 'so',
      states: [
        { key: 'nu1', base: 'sonu1.dc6', rate: 2 },
        { key: 'nu2', base: 'sonu2.dc6', rate: 2 },
        { key: 'nu3', base: 'sonu3.dc6', rate: 1, overlay: 'sonu3s.dc6', overlayDrawMode: 3 },
        { key: 'fw', base: 'sofw.dc6', rate: 1, overlay: 'sofws.dc6', overlayDrawMode: 3 },
        { key: 'bw', base: 'sobw.dc6', rate: 1, overlay: 'sobws.dc6', overlayDrawMode: 3 },
      ],
    },
    {
      id: 'dz',
      dir: 'druid',
      prefix: 'dz',
      states: [
        { key: 'nu1', base: 'dznu1.dc6', rate: 2 },
        { key: 'nu2', base: 'dznu2.dc6', rate: 2 },
        { key: 'nu3', base: 'dznu3.dc6', rate: 2 },
        { key: 'fw', base: 'dzfw.dc6', rate: 1 },
        { key: 'bw', base: 'dzbw.dc6', rate: 1 },
      ],
    },
  ]

  const campfireClasses: Record<string, Record<string, PackedAnimStripMeta>> = {}
  for (const cls of CAMPFIRE_SPECS) {
    campfireClasses[cls.id] = {}
    for (const st of cls.states) {
      const basePath = `data\\global\\ui\\FrontEnd\\${cls.dir}\\${st.base}`
      const baseDc6 = await decodeUiDc6(basePath)
      const ovDc6 = st.overlay
        ? await decodeUiDc6(`data\\global\\ui\\FrontEnd\\${cls.dir}\\${st.overlay}`)
        : null

      if (ovDc6 && st.compositeOverlay) {
        const composited = compositeOverlayFrames(baseDc6.groups[0]!.frames, ovDc6.groups[0]!.frames)
        const relFile = `campfire/${cls.id}-${st.key}.png`
        const packed = packFramesToGrid(relFile, composited, 2048, { rate: st.rate, drawMode: 5 })
        savePng(relFile, packed.meta.width, packed.meta.height, packed.pixels, fecharPl2.rgb, true)
        campfireClasses[cls.id]![st.key] = packed.meta
      } else {
        const relFile = `campfire/${cls.id}-${st.key}.png`
        const packed = packFramesToGrid(relFile, baseDc6.groups[0]!.frames, 2048, {
          rate: st.rate,
          drawMode: 5,
        })
        savePng(relFile, packed.meta.width, packed.meta.height, packed.pixels, fecharPl2.rgb, true)
        campfireClasses[cls.id]![st.key] = packed.meta

        if (ovDc6 && st.overlayDrawMode !== undefined) {
          const ovRelFile = `campfire/${cls.id}-${st.key}-ov.png`
          const ovPacked = packFramesToGrid(ovRelFile, ovDc6.groups[0]!.frames, 2048, {
            rate: st.rate,
            drawMode: st.overlayDrawMode,
          })
          savePng(ovRelFile, ovPacked.meta.width, ovPacked.meta.height, ovPacked.pixels, fecharPl2.rgb, true)
          // Also write nested subdir path (`campfire/<id>/<phase>_ov.png`) for path compatibility
          mkdirSync(join(outDir, 'campfire', cls.id), { recursive: true })
          savePng(
            `campfire/${cls.id}/${st.key}_ov.png`,
            ovPacked.meta.width,
            ovPacked.meta.height,
            ovPacked.pixels,
            fecharPl2.rgb,
            true,
          )
          campfireClasses[cls.id]![`${st.key}_ov`] = ovPacked.meta
        }
      }
    }
  }

  // ============================================================================
  // 6. 10-Frame Door Opening Loading Screen (`Loadingscreen.dc6` + `loading/pal.pl2`)
  // ============================================================================
  console.log('Packing 10-frame Door Opening Loading Screen...')
  const loadingDc6 = await decodeUiDc6('data\\global\\ui\\Loading\\Loadingscreen.dc6')
  const loadingPacked = packFramesToGrid('loading-door-strip.png', loadingDc6.groups[0]!.frames, 2560, { rate: 3 })
  savePng(
    loadingPacked.meta.file,
    loadingPacked.meta.width,
    loadingPacked.meta.height,
    loadingPacked.pixels,
    loadingRgb,
    false,
  )
  animStrips['loadingDoor'] = loadingPacked.meta

  // ============================================================================
  // 7. 7-Class Town-Neutral (`TN`) Character Selection Avatars (Direction 0 = South)
  // ============================================================================
  console.log('Packing 7-class Town-Neutral (TN) Character Selection avatar strips...')
  const AVATAR_TOKENS = ['am', 'ai', 'ne', 'ba', 'pa', 'so', 'dz'] as const
  const charAvatars: Record<string, PackedAnimStripMeta> = {}
  for (const token of AVATAR_TOKENS) {
    const tnSheet = await loadCharacterSheet(archives, token, 'tn', 'hth', undefined, true)
    // Group 0 in loadCharacterSheet is direction 0 (dir64=0 -> dccDir=4 = straight South towards camera)
    const southFrames = tnSheet.sheet.groups[0]!.frames
    const relFile = `avatars/char-${token}-tn.png`
    const packed = packFramesToGrid(relFile, southFrames, 2048, { animRate: tnSheet.speed ?? 256 })
    savePng(relFile, packed.meta.width, packed.meta.height, packed.pixels, skyPl2.rgb, true)
    charAvatars[token] = packed.meta
  }

  // ============================================================================
  // 8. Colored Bitmap Font Atlases (`D2Gfx_DrawChar` 0x6f876580..0x6f87658f)
  // ============================================================================
  // Color 0 = Base skyPl2.rgb (White / Bright Engraved)
  // Color 1..12 = applyTransform(skyPl2.rgb, skyPl2.textShifts[color])
  //   1 = Red (Hardcore / Error)
  //   2 = Bright Green (Expansion Character)
  //   3 = Blue
  //   4 = Gold / Bronze (Engraved Button Labels, Titles, Character Names)
  //   5 = Dark Gray (Disabled Button Labels)
  //   7 = Tan
  //   8 = Orange
  //   9 = Yellow
  console.log('Packing multi-shade chiseled bitmap font atlases...')
  const FONT_NAMES = [
    'font6',
    'font8',
    'font16',
    'font24',
    'font30',
    'font42',
    'fontexocet8',
    'fontexocet10',
    'fontformal10',
    'fontformal11',
    'fontformal12',
    'fontridiculous',
  ] as const
  const FONT_COLORS = [0, 1, 2, 3, 4, 5, 7, 8, 9] as const
  const fontMetas: Record<string, FontAtlasMeta> = {}
  const fontAtlasPixels: Record<string, Uint8Array> = {}

  for (const fn of FONT_NAMES) {
    const fDc6 = await decodeUiDc6(`data\\local\\font\\latin\\${fn}.dc6`)
    const fTbl = await archives.read(`data\\local\\font\\latin\\${fn}.tbl`)
    const built = buildFontAtlas(fn, fDc6, fTbl)
    fontMetas[fn] = built.meta
    fontAtlasPixels[fn] = built.pixels

    for (const c of FONT_COLORS) {
      const pal = c === 0 ? skyPl2.rgb : applyTransform(skyPl2.rgb, skyPl2.textShifts[c]!)
      savePng(
        `fonts/${fn}-c${c}.png`,
        built.meta.atlasWidth,
        built.meta.atlasHeight,
        built.pixels,
        pal,
        true,
      )
    }
  }
  writeFileSync(join(fontsDir, 'metrics.json'), JSON.stringify(fontMetas, null, 2))

  // ============================================================================
  // 8b. Victory screen (`D2Client.dll` 0x6faf3a70, after S2C 0x61 07)
  // ============================================================================
  // Expansion branch: `ui\menu\endgame2.dc6` (12 cells drawn bottom-anchored at x 0/256/512/768,
  // y 256/512/600), `ui\menu\endgameok.dc6` (2 frames: up / pressed) and the palette
  // `Palette\endgame2\pal.pl2` loaded through D2Win #10128 (0x6faf3b62). Text is Font42 color 4 and
  // Font16 color 0 drawn under that palette.
  console.log('Packing victory screen (endgame2) assets...')
  const endgameDir = join(outDir, 'endgame')
  mkdirSync(endgameDir, { recursive: true })
  const endgamePl2 = decodePl2(await archives.read('data\\global\\palette\\endgame2\\pal.pl2'))
  const endgameBg = await decodeUiDc6('data\\global\\ui\\menu\\endgame2.dc6')
  savePng('endgame/endgame2.png', 800, 600, stitch800x600Background(endgameBg), endgamePl2.rgb, false)
  const endgameOk = await decodeUiDc6('data\\global\\ui\\menu\\endgameok.dc6')
  const okFrames = endgameOk.groups[0]!.frames
  if (okFrames.length !== 2 || okFrames.some((f) => f.width !== 96 || f.height !== 32)) {
    throw new Error('endgameok.dc6: expected 2 frames of 96x32 (up / pressed)')
  }
  savePng(
    'endgame/endgameok.png',
    192,
    32,
    stitchFrames(192, 32, [
      { frame: okFrames[0]!, x: 0, y: 0 },
      { frame: okFrames[1]!, x: 96, y: 0 },
    ]),
    endgamePl2.rgb,
    true,
  )
  for (const [fn, c] of [['font42', 4], ['font16', 0]] as const) {
    const meta = fontMetas[fn]!
    const pal = c === 0 ? endgamePl2.rgb : applyTransform(endgamePl2.rgb, endgamePl2.textShifts[c]!)
    savePng(`endgame/${fn}-c${c}.png`, meta.atlasWidth, meta.atlasHeight, fontAtlasPixels[fn]!, pal, true)
  }

  // ============================================================================
  // 9. Canonical English Strings from string.tbl / expansionstring.tbl / patchstring.tbl
  // ============================================================================
  console.log('Extracting canonical English TBL strings...')
  const strBase = decodeTbl(await archives.read('data\\local\\lng\\eng\\string.tbl'))
  const strExp = decodeTbl(await archives.read('data\\local\\lng\\eng\\expansionstring.tbl'))
  const strPatch = decodeTbl(await archives.read('data\\local\\lng\\eng\\patchstring.tbl'))

  const lookupByKey = (key: string): string | undefined => {
    for (const table of [strPatch, strExp, strBase]) {
      const found = table.dict.get(key)
      if (found) return found
    }
    return undefined
  }

  const lookupById = (id: number): string | undefined => {
    const raw =
      id < 10000
        ? strBase[id]
        : id < 20000
          ? strPatch[id - 10000]
          : strExp[id - 20000]
    return raw?.trim() || undefined
  }

  const defaultTermsOfUseText = [
    'BATTLE.NET TERMS OF USE AGREEMENT',
    '',
    'THE BATTLE.NET SERVICE IS PROVIDED TO YOU UNDER THE TERMS AND CONDITIONS OF THIS TERMS OF USE AGREEMENT ("AGREEMENT") AND ANY OPERATING RULES OR POLICIES THAT MAY BE PUBLISHED FROM TIME TO TIME BY BLIZZARD ENTERTAINMENT ("BLIZZARD").',
    '',
    'PLEASE READ THE FOLLOWING TERMS AND CONDITIONS CAREFULLY. BY CLICKING THE "AGREE" BUTTON BELOW, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THE TERMS AND CONDITIONS OF THIS AGREEMENT.',
    '',
    '1. GRANT OF A LIMITED LICENSE TO USE THE SERVICE',
    'Subject to your agreement to and continuing compliance with this Agreement, Blizzard hereby grants, and you hereby accept, a limited, non-exclusive, non-transferable license to access and use the Battle.net Service solely for your personal, non-commercial entertainment purposes.',
    '',
    '2. ADDITIONAL LICENSE LIMITATIONS',
    'The license granted to you in Section 1 is subject to the limitations set forth in Sections 1 and 2 (collectively, the "License Limitations"). Any use of the Service or the Game in violation of the License Limitations will be regarded as an infringement of Blizzard\'s copyrights in and to the Game. You agree that you will not, under any circumstances:',
    '(a) use cheats, automation software (bots), hacks, mods or any other unauthorized third-party software designed to modify the Battle.net Service or the Game experience;',
    '(b) exploit the Game or any of its parts, including without limitation the Service, for any commercial purpose;',
    '(c) use any unauthorized third-party software that intercepts, "mines", or otherwise collects information from or through the Game or the Service;',
    '(d) modify or cause to be modified any files that are a part of the Game or the Service in any way not expressly authorized by Blizzard;',
    '(e) host, provide or develop matchmaking services for the Game or the Service, or intercept, emulate or redirect the communication protocols used by Blizzard in any way, for any purpose, including without limitation unauthorized play over the internet, network play, or as part of content aggregation networks;',
    '(f) facilitate, create or maintain any unauthorized connection to the Game or the Service, including without limitation any connection to any unauthorized server that emulates, or attempts to emulate, the Service.',
    '',
    '3. ELIGIBILITY AND ACCOUNT SECURITY',
    'When creating an account on Battle.net, you must choose an Account Name and a Password. You may not use an Account Name that is used by someone else, is vulgar or offensive, or otherwise violates the Terms of Use. You are solely responsible for maintaining the confidentiality of your Password and for all activities that occur under your Account.',
    '',
    '4. CODE OF CONDUCT',
    'As with all things, your use of Battle.net is governed by certain rules of conduct. While using the Battle.net Service, you agree to abide by rules of fair play and respect toward other players. Harassment, threats, hate speech, impersonation of Blizzard employees, and disruptive behavior in chat channels or games may result in temporary or permanent suspension of your Battle.net Account.',
    '',
    '5. ACCOUNT EXPIRATION AND TERMINATION',
    'Battle.net accounts and characters are subject to periodic expiration if left inactive. Accounts that have not been logged into for a period of ninety (90) days may be automatically deleted. Blizzard reserves the right to terminate this Agreement and revoke your access to the Battle.net Service at any time if you breach any provision of this Agreement.',
    '',
    '6. DISCLAIMER OF WARRANTIES AND LIMITATION OF LIABILITY',
    'THE BATTLE.NET SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS FOR YOUR USE, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, AND THOSE ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.',
    '',
    'BY CLICKING "AGREE" BELOW, YOU CONFIRM THAT YOU HAVE READ AND ACCEPTED THIS BATTLE.NET TERMS OF USE AGREEMENT IN ITS ENTIRETY.',
  ].join('\n')

  const s4007 = lookupById(4007) ?? 'Barbarian'
  const s4008 = lookupById(4008) ?? 'Paladin'
  const s4009 = lookupById(4009) ?? 'Necromancer'
  const s4010 = lookupById(4010) ?? 'Sorceress'
  const s4011 = lookupById(4011) ?? 'Amazon'
  const s4012 = lookupById(4012) ?? 'Druid'
  const s4013 = lookupById(4013) ?? 'Assassin'
  const s4057 = lookupById(4057) ?? 'Level'
  const s5017 = lookupById(5017) ?? 'Level %d'
  const s5098 = lookupById(5098)
  const s5100 = lookupById(5100)
  if (!s5098 || !s5100) throw new Error('string.tbl is missing victory screen strings 5098 / 5100')
  const s5101 = lookupById(5101) ?? 'EXIT'
  const s5102 = lookupById(5102) ?? 'OK'
  const s5103 = lookupById(5103) ?? 'CANCEL'
  const s5150 = lookupById(5150) ?? 'CREATE GAME'
  const s5151 = lookupById(5151) ?? 'JOIN GAME'
  const s5171 = lookupById(5171) ?? 'Connecting to Battle.net'
  const s5172 = lookupById(5172) ?? 'Querying gateway'
  const s5173 = lookupById(5173) ?? 'Connecting to the fastest server'
  const s5174 = lookupById(5174) ?? 'Accessing your account'
  const s5175 = lookupById(5175) ?? 'Checking versions'
  const s5176 = lookupById(5176) ?? 'Verifying CD-key'
  const s5177 = lookupById(5177) ?? 'Getting player profile'
  const s5180 = lookupById(5180) ?? 'Terms of Use'
  const s5181 = lookupById(5181) ?? 'AGREE'
  const s5182 = lookupById(5182) ?? 'DISAGREE'
  const s5204 = lookupById(5204) ?? 'Battle.net Log In'
  const s5205 =
    lookupById(5205) ??
    "To use an existing Battle.net account, enter the information below and click 'Log In'. Otherwise, click 'Create New Account'."
  const s5216 = lookupById(5216) ?? 'Account name must be at least 2 characters.'
  const s5217 = lookupById(5217) ?? "Account name can't be more than 15 characters."
  const s5218 = lookupById(5218) ?? "Passwords don't match."
  const s5219 = lookupById(5219) ?? 'Password must be at least 2 characters.'
  const s5220 = lookupById(5220) ?? "Password can't be more than 15 characters."
  const s5221 = lookupById(5221) ?? 'CREATE NEW ACCOUNT'
  const s5222 = lookupById(5222) ?? 'Create Battle.net Account'
  const s5223 = lookupById(5223) ?? 'Enter the Name and Password for your new battle.net account.'
  const s5224 = lookupById(5224) ?? 'Account Name'
  const s5225 = lookupById(5225) ?? 'Password'
  const s5226 = lookupById(5226) ?? 'Verify Password'
  const s5227 = lookupById(5227) ?? 'PLEASE READ'
  const s5228 =
    lookupById(5228) ??
    'Please note that inactive accounts are deleted at regular times. If you create a new account, you must be logged into Battle.net long enough - either in one session, or spread over several - to have accumulated 2 hours of time within the first 48 hours.'
  const s5229 =
    lookupById(5229) ??
    'After that, your account becomes permanent so long as you continue to log into this account once every 90 days.'
  const s5230 =
    lookupById(5230) ??
    'PLEASE WRITE DOWN YOUR PASSWORD. BLIZZARD DOES NOT HAVE ACCESS TO PASSWORDS, AND CANNOT FIND OR REPLACE FORGOTTEN PASSWORDS.'
  const s5231 =
    lookupById(5231) ??
    'User names must be at least two characters in length. Please try again with a different name.'
  const s5232 = lookupById(5232) ?? 'Your user name contained one or more illegal characters.'
  const s5233 = lookupById(5233) ?? 'Your user name contained one or more disallowed words.'
  const s5234 =
    lookupById(5234) ??
    'Your previous account creation request is still being processed. Please wait a few moments and try logging in with the account you just created.'
  const s5235 =
    lookupById(5235) ?? 'Your name did not have enough alpha-numeric characters in it.'
  const s5236 =
    lookupById(5236) ?? 'Your name contained too many adjacent punctuation characters in it.'
  const s5237 =
    lookupById(5237) ?? 'Your name contained too many punctuation characters in it.'
  const s5238 =
    lookupById(5238) ?? 'The passwords you have typed do not match. Please enter the same password twice.'
  const s5239 =
    lookupById(5239) ??
    'An account already exists with the name you have chosen.  Please try again with a different name.'
  const s5249 = lookupById(5249) ?? 'Unable to Create Account'
  const s5275 = lookupById(5275) ?? 'Game Name Players'
  const s5334 = lookupById(5334) ?? 'Gem Activated'
  const s5335 = lookupById(5335) ?? 'Gem Deactivated'
  const s5336 = lookupById(5336) ?? 'Perfect Gem Activated'
  const s10834 = lookupById(10834) ?? 'Verify Password'
  const s11127 = lookupById(11127) ?? 'PLEASE WRITE DOWN YOUR PASSWORD.'
  const s11132 = lookupById(11132) ?? 'Expires Today'
  const s11133 = lookupById(11133) ?? 'Expires in %d days'
  const s11134 = lookupById(11134) ?? 'Character Expired'
  const s22731 = lookupById(22731) ?? 'EXPANSION CHARACTER'

  const strings = {
    singlePlayer: lookupByKey('strSinglePlayer') ?? 'SINGLE PLAYER',
    battleNet: lookupByKey('strBattleNet') ?? 'BATTLE.NET',
    otherMultiplayer: lookupByKey('strOtherMultiplayer') ?? 'OTHER MULTIPLAYER',
    exitDiablo2: lookupByKey('strExitDiablo2') ?? 'EXIT DIABLO II',
    credits: 'CREDITS',
    cinematics: 'CINEMATICS',
    gatewayPrefix: 'GATEWAY: ',
    connectingToBattleNet: s5171,
    queryingGateway: s5172,
    connectingToFastest: s5173,
    accessingAccount: s5174,
    checkingVersions: s5175,
    verifyingCdKey: s5176,
    gettingPlayerProfile: s5177,
    loginTitle: s5204,
    bnetLoginTitle: s5204,
    loginInstruction: s5205,
    bnetLoginInstruction: s5205,
    accountName: s5224,
    password: s5225,
    verifyPassword: s10834 || s5226,
    logIn: 'LOG IN',
    accountSettings: 'ACCOUNT SETTINGS',
    createNewAccount: s5221,
    createBnetAccountTitle: s5222,
    exit: s5101,
    ok: s5102,
    cancel: s5103,
    createAccountInstruction: s5223,
    termsOfUseTitle: s5180,
    agree: s5181,
    disagree: s5182,
    dontAgree: s5182,
    pleaseReadTitle: s5227,
    pleaseReadPara1: s5228,
    pleaseReadPara2: s5229,
    pleaseReadPara3: s5230 || s11127,
    errAccountTooShort: s5216,
    errAccountTooLong: s5217,
    errPasswordMismatch: s5218,
    errPasswordTooShort: s5219,
    errPasswordTooLong: s5220,
    errAccountDisallowed: s5231,
    errAccountInvalidChars: s5232,
    errAccountBannedWord: s5233,
    errAccountStillProcessing: s5234,
    errAccountNotEnoughAlphanum: s5235,
    errAccountAdjacentPunct: s5236,
    errAccountTooManyPunct: s5237,
    errAccountExistsSuggest: s5238,
    errAccountAlreadyExists: s5239,
    unableToCreateAccount: s5249,
    termsOfUseText: defaultTermsOfUseText,
    levelLabel: s4057,
    levelFormat: s5017,
    expiresToday: s11132,
    expiresInDays: s11133,
    characterExpired: s11134,
    gemActivated: s5334,
    gemDeactivated: s5335,
    perfectGemActivated: s5336,
    '4007': s4007,
    '4008': s4008,
    '4009': s4009,
    '4010': s4010,
    '4011': s4011,
    '4012': s4012,
    '4013': s4013,
    '4057': s4057,
    '5017': s5017,
    '5098': s5098,
    '5100': s5100,
    '5101': s5101,
    '5102': s5102,
    '5103': s5103,
    '5150': s5150,
    '5151': s5151,
    '5171': s5171,
    '5172': s5172,
    '5173': s5173,
    '5174': s5174,
    '5175': s5175,
    '5176': s5176,
    '5177': s5177,
    '5180': s5180,
    '5181': s5181,
    '5182': s5182,
    '5204': s5204,
    '5205': s5205,
    '5216': s5216,
    '5217': s5217,
    '5218': s5218,
    '5219': s5219,
    '5220': s5220,
    '5221': s5221,
    '5222': s5222,
    '5223': s5223,
    '5224': s5224,
    '5225': s5225,
    '5226': s5226,
    '5227': s5227,
    '5228': s5228,
    '5229': s5229,
    '5230': s5230,
    '5231': s5231,
    '5232': s5232,
    '5233': s5233,
    '5234': s5234,
    '5235': s5235,
    '5236': s5236,
    '5237': s5237,
    '5238': s5238,
    '5239': s5239,
    '5249': s5249,
    '5275': s5275,
    '5334': s5334,
    '5335': s5335,
    '5336': s5336,
    '10834': s10834,
    '11127': s11127,
    '11132': s11132,
    '11133': s11133,
    '11134': s11134,
    '22731': s22731,
    chooseClassTitle: 'Choose a class for your campaign',
    characterName: 'Character Name',
    expansionCharacter: s22731,
    hardcore: 'HARDCORE',
    ladderCharacter: 'LADDER CHARACTER',
    selectCharacterTitle: 'Select a Character',
    createNewCharacter: 'CREATE NEW\nCHARACTER',
    convertToExpansion: 'CONVERT TO\nEXPANSION',
    deleteCharacter: 'DELETE\nCHARACTER',
    classes: {
      am: {
        name: s4011,
        desc:
          lookupByKey('strAmazonDesc') ??
          'Skilled with the spear and the bow, she is a very versatile fighter.',
      },
      as: {
        name: s4013,
        desc:
          lookupByKey('AssasinDesc') ??
          'Schooled in the Martial Arts, her mind and body are deadly weapons.',
      },
      ne: {
        name: s4009,
        desc:
          lookupByKey('strNecroDesc') ??
          'Summoning undead minions and cursing his enemies are his specialties.',
      },
      ba: {
        name: s4007,
        desc:
          lookupByKey('strBarbDesc') ??
          'He is unequaled in close-quarters combat and mastery of weapons.',
      },
      pa: {
        name: s4008,
        desc:
          lookupByKey('strPaladinDesc') ??
          'He is a natural party leader, holy man, and blessed warrior.',
      },
      so: {
        name: s4010,
        desc:
          lookupByKey('strSorcDesc') ??
          'She has mastered the elemental magics -- fire, lightning, and ice.',
      },
      dz: {
        name: s4012,
        desc:
          lookupByKey('DruidDesc') ??
          'Commanding the forces of nature, he summons wild beasts and raging storms to his side.',
      },
    },
    lobby: {
      send: 'SEND',
      whisper: 'WHISPER',
      help: 'HELP',
      squelch: 'SQUELCH',
      unsquelch: 'UNSQUELCH',
      emote: 'EMOTE',
      create: 'CREATE',
      join: 'JOIN',
      ladder: 'LADDER',
      channel: 'CHANNEL',
      quit: 'QUIT',
      createGameTitle: 'Create Game',
      joinGameTitle: s5151,
      joinGameBtn: s5151,
      joinGameListHeader: s5275,
      gameName: 'Game Name',
      gamePassword: 'Password',
      gameDescription: 'Game Description',
      maxPlayers: 'Max Number of Players',
      charDifference: 'Character Difference',
      selectDifficulty: 'Select Difficulty',
      normal: 'Normal',
      nightmare: 'Nightmare',
      hell: 'Hell',
      createGameBtn: 'CREATE GAME',
      gemActivated: s5334,
      gemDeactivated: s5335,
      perfectGemActivated: s5336,
    },
  }

  const manifest = {
    version: '1.13c',
    decodedDc6Count: decodedCount,
    animStrips,
    campfireClasses,
    charAvatars,
    fontColors: FONT_COLORS,
    strings,
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest))
  const assetManifest = generateAssetManifest()
  console.log(
    `Successfully packed ${decodedCount} DC6 sheets + 7 TN character avatars + ${FONT_NAMES.length * FONT_COLORS.length} colored font atlases in ${(performance.now() - t0).toFixed(0)} ms! (asset-manifest=${assetManifest.version})`,
  )
}

main().catch(err => {
  console.error('pack-frontend-ui failed:', err)
  process.exit(1)
})

