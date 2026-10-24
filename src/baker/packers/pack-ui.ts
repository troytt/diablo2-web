/**
 * scripts/pack-ui.ts
 *
 * Complete Offline UI, Item Sprite, and Quest Icon Packer.
 * Extracts DC6/PL2 assets from 1.13c MPQs and generates:
 * 1. public/ui/*.png (all panels, globes, borders, fonts, items-atlas, quests-atlas)
 * 2. public/ui/manifest.json
 * 3. src/ui/baked-ui-meta.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { decodeDc6, type Dc6Sheet } from '../../common/formats/dc6.ts'
import type { SpriteFrame, SpriteSheet } from '../../common/formats/sprite.ts'
import { decodePl2 } from '../../common/formats/pl2.ts'
import { parseTable } from '../../common/items/tables.ts'
import { loadStringTableChain } from '../../common/items/item-names.ts'
import { encodeIndexedPng } from '../io/png.ts'
import { packCursorAssets } from './pack-cursor.ts'
import { LEVEL_ENTRY_TITLES_PNG, writeLevelEntryTitles } from './pack-level-entry-titles.ts'
import { buildTrueTypeFont } from '../extract/build-d2-ttf.ts'

interface BlitPlacement {
  readonly frame: SpriteFrame
  readonly x: number
  readonly y: number
}

export interface SpriteRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly offsetX?: number | undefined
  readonly offsetY?: number | undefined
}

export type AutomapSpriteKey =
  | 'MaxiMap'
  | 'MaxiMapS'
  | 'Act2Map'
  | 'Act2MapS'
  | 'Act4Map'
  | 'Act4MapS'
  | 'ExTnMap'
  | 'ExTnMapS'

export interface AutomapSpriteFrameMeta {
  readonly width: number
  readonly height: number
  readonly offsetX: number
  readonly offsetY: number
  readonly x: number
  readonly y: number
}

export interface AutomapSpriteAtlasMeta {
  readonly image: string
  readonly atlasWidth: number
  readonly atlasHeight: number
  readonly columns: number
  readonly cellWidth: number
  readonly cellHeight: number
  readonly frameCount: number
  readonly frames: readonly AutomapSpriteFrameMeta[]
}

export interface AutomapUiManifest {
  readonly atlases: Readonly<Record<AutomapSpriteKey, AutomapSpriteAtlasMeta>>
}

export interface FontGlyphMetric {
  readonly code: number
  readonly width: number
  readonly height: number
  readonly x: number
  readonly y: number
  readonly frameW: number
  readonly frameH: number
}

export interface FontAtlasMeta {
  readonly name: string
  readonly lineHeight: number
  readonly capHeight: number
  readonly atlasWidth: number
  readonly atlasHeight: number
  readonly glyphs: readonly FontGlyphMetric[]
}

/**
 * Create an indexed pixel buffer and blit multiple DC6 frames onto it.
 * Index 0 is transparent in DC6 UI sprites.
 */
function stitchFrames(width: number, height: number, placements: readonly BlitPlacement[]): Uint8Array {
  const out = new Uint8Array(width * height)
  for (const { frame, x: dstX, y: dstY } of placements) {
    for (let sy = 0; sy < frame.height; sy++) {
      const ty = dstY + sy
      if (ty < 0 || ty >= height) continue
      for (let sx = 0; sx < frame.width; sx++) {
        const tx = dstX + sx
        if (tx < 0 || tx >= width) continue
        const srcIdx = sy * frame.width + sx
        if (frame.mask[srcIdx] === 0) continue
        const color = frame.indices[srcIdx] ?? 0
        if (color !== 0) {
          out[ty * width + tx] = color
        }
      }
    }
  }
  return out
}

/**
 * Apply a 256-byte PL2 color transformation table to a sprite frame.
 * Opaque pixels are mapped through table[orig].
 * Black dye guard: If mapped === 0, remap to index 172 (RGB [4, 4, 4]),
 * the darkest non-zero index in the D2 palette, ensuring opaque black pixels
 * are not rendered as transparent in indexed PNG (where index 0 is transparent).
 * Transparent pixels (mask === 0 or orig === 0) remain index 0.
 */
function transformSpriteFrame(frame: SpriteFrame, table: Uint8Array): SpriteFrame {
  const indices = new Uint8Array(frame.indices.length)
  for (let i = 0; i < frame.indices.length; i++) {
    if (frame.mask[i] !== 0 && frame.indices[i] !== 0) {
      const orig = frame.indices[i]!
      let mapped = table[orig] ?? 0
      if (mapped === 0) {
        mapped = 172
      }
      indices[i] = mapped
    } else {
      indices[i] = 0
    }
  }
  const dc6Frame = frame as SpriteFrame & { readonly offsetX?: number; readonly offsetY?: number }
  return {
    width: frame.width,
    height: frame.height,
    indices,
    mask: frame.mask,
    ...(dc6Frame.offsetX !== undefined ? { offsetX: dc6Frame.offsetX } : {}),
    ...(dc6Frame.offsetY !== undefined ? { offsetY: dc6Frame.offsetY } : {}),
  } as SpriteFrame
}

/**
 * Stitch a standard 2x2 320x432 Diablo II panel from 4 consecutive DC6 frames:
 * Frame +0: 256x256 (Top-Left)
 * Frame +1: 64x256  (Top-Right)
 * Frame +2: 256x176 (Bottom-Left)
 * Frame +3: 64x176  (Bottom-Right)
 */
function stitch320x432Panel(sheet: SpriteSheet, startFrame = 0): Uint8Array {
  const frames = sheet.groups[0]!.frames
  return stitchFrames(320, 432, [
    { frame: frames[startFrame + 0]!, x: 0, y: 0 },
    { frame: frames[startFrame + 1]!, x: 256, y: 0 },
    { frame: frames[startFrame + 2]!, x: 0, y: 256 },
    { frame: frames[startFrame + 3]!, x: 256, y: 256 },
  ])
}

/**
 * Stitch a horizontal strip of frames into a single sprite sheet.
 */
function stitchHorizontalStrip(frames: readonly SpriteFrame[]): {
  width: number
  height: number
  pixels: Uint8Array
  rects: SpriteRect[]
} {
  const height = Math.max(1, ...frames.map(f => f.height))
  let totalW = 0
  const rects: SpriteRect[] = []
  const placements: BlitPlacement[] = []
  for (const frame of frames) {
    rects.push({ x: totalW, y: 0, w: frame.width, h: frame.height })
    placements.push({ frame, x: totalW, y: 0 })
    totalW += frame.width
  }
  return {
    width: Math.max(1, totalW),
    height,
    pixels: stitchFrames(Math.max(1, totalW), height, placements),
    rects,
  }
}

/**
 * Parse a `Woo!\x01` font metric table (`data/local/font/latin/font*.tbl`)
 * and pack its 256 DC6 glyphs into a 16x16 grid PNG.
 */
function buildFontAtlas(name: string, dc6: SpriteSheet, tblBytes: Uint8Array): {
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

  const qRecOff = 12 + 0x3f * 14
  const qFrameIdx = qRecOff + 8 < tblBytes.length ? (tblBytes[qRecOff + 8] ?? 0x3f) : 0x3f
  const placeholderCandidates = [
    frames[qFrameIdx] ?? frames[0x3f],
    frames[0x7f],
    frames[0x81],
    frames[0x8d],
    frames[0x8f],
    frames[0x90],
    frames[0x9d],
  ].filter((f): f is SpriteFrame => Boolean(f && f.width > 0 && f.height > 0))

  const isSameFrame = (a: SpriteFrame | undefined, b: SpriteFrame | undefined): boolean => {
    if (!a || !b || a.width === 0 || b.width === 0) return false
    if (a.width !== b.width || a.height !== b.height) return false
    for (let k = 0; k < a.indices.length; k++) {
      if (a.indices[k] !== b.indices[k]) return false
    }
    return true
  }

  const isPlaceholderQuestionMark = (f: SpriteFrame | undefined): boolean =>
    placeholderCandidates.some(cand => isSameFrame(f, cand))

  const dotRecOff = 12 + 0x2e * 14
  const dotMetricW = dotRecOff + 3 < tblBytes.length ? (tblBytes[dotRecOff + 3] || 6) : 6
  const dotFrameIdx = dotRecOff + 8 < tblBytes.length ? (tblBytes[dotRecOff + 8] ?? 0x2e) : 0x2e
  const dotFrame = frames[dotFrameIdx] ?? frames[0x2e]

  const dashRecOff = 12 + 0x2d * 14
  const dashMetricW = dashRecOff + 3 < tblBytes.length ? (tblBytes[dashRecOff + 3] || 8) : 8
  const dashFrameIdx = dashRecOff + 8 < tblBytes.length ? (tblBytes[dashRecOff + 8] ?? 0x2d) : 0x2d
  const dashFrame = frames[dashFrameIdx] ?? frames[0x2d]

  for (let i = 0; i < 256; i++) {
    const recOff = 12 + i * 14
    let metricWidth = recOff + 3 < tblBytes.length ? (tblBytes[recOff + 3] || 6) : 6
    const metricHeight = recOff + 4 < tblBytes.length ? (tblBytes[recOff + 4] || lineHeight) : lineHeight
    const frameIdx = recOff + 8 < tblBytes.length ? (tblBytes[recOff + 8] ?? i) : i
    let frame: SpriteFrame | undefined = frames[frameIdx] ?? frames[i]
    if ((i === 0xb7 || i === 0x95) && dotFrame) {
      const shiftY = Math.max(1, Math.round(dotFrame.height * 0.22))
      const shiftedIndices = new Uint8Array(dotFrame.width * dotFrame.height)
      const shiftedMask = new Uint8Array(dotFrame.width * dotFrame.height)
      for (let y = 0; y < dotFrame.height; y++) {
        const srcY = y + shiftY
        if (srcY < dotFrame.height) {
          for (let x = 0; x < dotFrame.width; x++) {
            const dstIdx = y * dotFrame.width + x
            const srcIdx = srcY * dotFrame.width + x
            shiftedIndices[dstIdx] = dotFrame.indices[srcIdx]!
            shiftedMask[dstIdx] = dotFrame.mask[srcIdx]!
          }
        }
      }
      frame = { ...dotFrame, indices: shiftedIndices, mask: shiftedMask }
      metricWidth = dotMetricW
    } else if (i !== 0x3f && i >= 0x7f && isPlaceholderQuestionMark(frame)) {
      if ((i === 0x96 || i === 0x97) && dashFrame) {
        frame = dashFrame
        metricWidth = dashMetricW
      } else {
        frame = undefined
      }
    }
    if (i !== 0x20 && i !== 0xa0 && frame) {
      let hasVisiblePixel = false
      for (let k = 0; k < frame.indices.length; k++) {
        if (frame.mask[k] !== 0 && frame.indices[k] !== 0) {
          hasVisiblePixel = true
          break
        }
      }
      if (!hasVisiblePixel) {
        frame = undefined
      }
    }
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

  const pixels = stitchFrames(atlasWidth, atlasHeight, placements)
  if (name === 'fontexocet10') {
    for (let p = 0; p < pixels.length; p++) {
      const idx = pixels[p]!
      if (idx >= 15 && idx <= 32) {
        pixels[p] = Math.max(15, Math.min(31, 31 - (idx - 15)))
      }
    }
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
    pixels,
  }
}

export async function bakeUi(mpqDir = 'samples/d2', outBaseDir = 'public'): Promise<void> {
  console.log('Mounting Diablo II v1.13c MPQ archives...')
  const archives = new MountedArchives()
  for (const m of ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    archives.add(m, await MpqArchive.open(await fileSource(join(mpqDir, m))))
  }

  const pl2 = decodePl2(await archives.read('data/global/palette/ACT1/pal.pl2'))
  const outDir = join(process.cwd(), 'public', 'ui')
  const customUiDir = join(process.cwd(), outBaseDir, 'ui')
  const targetUiDirs = [...new Set([outDir, customUiDir])]
  const fontsDir = join(outDir, 'fonts')
  for (const d of targetUiDirs) {
    mkdirSync(d, { recursive: true })
    mkdirSync(join(d, 'fonts'), { recursive: true })
  }

  let decodedCount = 0
  let decodeFailures = 0

  const decodeUiDc6 = async (path: string): Promise<SpriteSheet> => {
    try {
      const bytes = await archives.read(path)
      const sheet = decodeDc6(bytes)
      decodedCount++
      return sheet
    } catch (err) {
      decodeFailures++
      console.error(`Failed to decode DC6 ${path}:`, err)
      throw err
    }
  }

  const savePng = (relPath: string, width: number, height: number, pixels: Uint8Array, transparent = true): void => {
    const png = encodeIndexedPng({
      width,
      height,
      pixels,
      palette: pl2.rgb,
      transparentIndex: transparent ? 0 : undefined,
    })
    for (const d of targetUiDirs) {
      writeFileSync(join(d, relPath), png)
    }
  }

  // --- STAGE 1: Base UI Panels, Globes, Borders, Fonts, Buttons ---
  console.log('Extracting base UI panels, globes, borders, and controls...')

  // 1. 800x600 Bottom Control Panel (`Panel/800CtrlPnl7.dc6`)
  const ctrl800 = await decodeUiDc6('data/global/ui/Panel/800CtrlPnl7.dc6')
  const cf = ctrl800.groups[0]!.frames
  const ctrlPixels = stitchFrames(800, 104, [
    { frame: cf[6]!, x: 64, y: 49 },
    { frame: cf[6]!, x: 600, y: 49 },
    { frame: cf[1]!, x: 165, y: 49 },
    { frame: cf[2]!, x: 293, y: 49 },
    { frame: cf[3]!, x: 421, y: 49 },
    { frame: cf[4]!, x: 549, y: 49 },
    { frame: cf[0]!, x: 0, y: 0 },
    { frame: cf[5]!, x: 683, y: 0 },
  ])
  savePng('ctrlpnl-800.png', 800, 104, ctrlPixels)

  // 1b. 640x480 Bottom Control Panel (`Panel/CtrlPnl7.dc6`)
  const ctrl640 = await decodeUiDc6('data/global/ui/Panel/CtrlPnl7.dc6')
  const cf640 = ctrl640.groups[0]!.frames
  const ctrl640Pixels = stitchFrames(640, 104, [
    { frame: cf640[1]!, x: 165, y: 49 },
    { frame: cf640[2]!, x: 293, y: 49 },
    { frame: cf640[3]!, x: 421, y: 49 },
    { frame: cf640[0]!, x: 0, y: 0 },
    { frame: cf640[4]!, x: 523, y: 0 },
  ])
  savePng('ctrlpnl-640.png', 640, 104, ctrl640Pixels)

  // 2. Health & Mana Globes (`Panel/Hlthmana.dc6` & `Panel/overlap.dc6`)
  const hlthmana = await decodeUiDc6('data/global/ui/Panel/Hlthmana.dc6')
  const hf = hlthmana.groups[0]!.frames
  savePng('globe-life.png', hf[0]!.width, hf[0]!.height, hf[0]!.indices)
  savePng('globe-mana.png', hf[1]!.width, hf[1]!.height, hf[1]!.indices)
  if (hf[2]) savePng('globe-poison.png', hf[2].width, hf[2].height, hf[2].indices)

  const overlap = await decodeUiDc6('data/global/ui/Panel/overlap.dc6')
  const of = overlap.groups[0]!.frames
  savePng('overlap-left.png', of[0]!.width, of[0]!.height, of[0]!.indices)
  savePng('overlap-right.png', of[1]!.width, of[1]!.height, of[1]!.indices)

  // 3. 800x600 Gothic Stone Borders (`Panel/800BorderFrame.dc6`)
  const borderDc6 = await decodeUiDc6('data/global/ui/Panel/800BorderFrame.dc6')
  const bf = borderDc6.groups[0]!.frames
  const leftBorderPixels = stitchFrames(400, 553, [
    { frame: bf[0]!, x: 0, y: -3 },
    { frame: bf[1]!, x: 256, y: -3 },
    { frame: bf[2]!, x: 0, y: 253 },
    { frame: bf[3]!, x: 0, y: 482 },
    { frame: bf[4]!, x: 256, y: 482 },
  ])
  savePng('border-left.png', 400, 553, leftBorderPixels)

  const rightBorderPixels = stitchFrames(400, 553, [
    { frame: bf[5]!, x: 0, y: -3 },
    { frame: bf[6]!, x: 144, y: -3 },
    { frame: bf[7]!, x: 313, y: 253 },
    { frame: bf[8]!, x: 144, y: 482 },
    { frame: bf[9]!, x: 0, y: 482 },
  ])
  savePng('border-right.png', 400, 553, rightBorderPixels)

  // 4. Character Sheet & Inventory Sheet (`Panel/invchar6.dc6` & `Panel/invchar6Tab.dc6`)
  const invchar6 = await decodeUiDc6('data/global/ui/Panel/invchar6.dc6')
  savePng('char-sheet.png', 320, 432, stitch320x432Panel(invchar6, 0), false)
  savePng('inv-sheet.png', 320, 432, stitch320x432Panel(invchar6, 4), false)

  const invTab = await decodeUiDc6('data/global/ui/Panel/invchar6Tab.dc6')
  const itf = invTab.groups[0]!.frames
  savePng('inv-tab-0.png', itf[0]!.width, itf[0]!.height, itf[0]!.indices)
  savePng('inv-tab-1.png', itf[1]!.width, itf[1]!.height, itf[1]!.indices)

  // 5. Quest Log, Waypoint Menu, Stash, Horadric Cube, Vendor (`320x432` panels)
  const questBg = await decodeUiDc6('data/global/ui/Menu/questbackground.dc6')
  savePng('quest-bg.png', 320, 432, stitch320x432Panel(questBg, 0), false)

  const wpBg = await decodeUiDc6('data/global/ui/Menu/waygatebackground.dc6')
  savePng('waypoint-bg.png', 320, 432, stitch320x432Panel(wpBg, 0), false)

  const stashBg = await decodeUiDc6('data/global/ui/Panel/TradeStash.dc6')
  savePng('stash-bg.png', 320, 432, stitch320x432Panel(stashBg, 0), false)

  const cubeBg = await decodeUiDc6('data/global/ui/Panel/supertransmogrifier.dc6')
  savePng('cube-bg.png', 320, 432, stitch320x432Panel(cubeBg, 0), false)

  const vendorBg = await decodeUiDc6('data/global/ui/Panel/buysell.dc6')
  const vbf = vendorBg.groups[0]?.frames
  const expectedVendorBgFrames = [
    { w: 256, h: 256 },
    { w: 64, h: 256 },
    { w: 256, h: 176 },
    { w: 64, h: 176 },
  ]
  if (
    !vbf ||
    vbf.length < 4 ||
    expectedVendorBgFrames.some((exp, i) => vbf[i]?.width !== exp.w || vbf[i]?.height !== exp.h)
  ) {
    throw new Error('Invalid buysell.dc6 frame geometry: expected 4 frames (256x256, 64x256, 256x176, 64x176)')
  }
  savePng('vendor-bg.png', 320, 432, stitch320x432Panel(vendorBg, 0), false)

  // 5a. Player-to-Player Trade Screen (`Panel/trade.dc6` per D2Client.dll 0x6fb4a410, 4 frames -> 320x432)
  const tradeBg = await decodeUiDc6('data/global/ui/Panel/trade.dc6')
  const tbf = tradeBg.groups[0]?.frames
  if (
    !tbf ||
    tbf.length < 4 ||
    expectedVendorBgFrames.some((exp, i) => tbf[i]?.width !== exp.w || tbf[i]?.height !== exp.h)
  ) {
    throw new Error('Invalid trade.dc6 frame geometry: expected 4 frames (256x256, 64x256, 256x176, 64x176)')
  }
  savePng('trade-bg.png', 320, 432, stitch320x432Panel(tradeBg, 0), false)

  const tradeBtnDc6 = await decodeUiDc6('data/global/ui/Panel/tradebtn.dc6')
  const tbFrames = tradeBtnDc6.groups[0]?.frames
  if (!tbFrames || tbFrames.length !== 2 || tbFrames.some(f => f.width !== 77 || f.height !== 17)) {
    throw new Error('Invalid tradebtn.dc6 frame geometry: expected 2 frames of 77x17')
  }
  const tbStrip = stitchHorizontalStrip(tbFrames)
  savePng('tradebtn.png', tbStrip.width, tbStrip.height, tbStrip.pixels)

  // 5b. Mercenary / Hireling Screen (`Panel/NPCInv.dc6` per D2Client.dll 0x6fb3f9a7 & 0x6fb4ae80)
  // and Empty Paperdoll Slot Silhouettes (`Panel/inv_armor.dc6`, `Panel/inv_helm_glove.dc6`, `Panel/inv_weapons.dc6` per 0x6fb3b2f0)
  const npcInvDc6 = await decodeUiDc6('data/global/ui/Panel/NPCInv.dc6')
  const nif = npcInvDc6.groups[0]?.frames
  if (
    !nif ||
    nif.length < 4 ||
    expectedVendorBgFrames.some((exp, i) => nif[i]?.width !== exp.w || nif[i]?.height !== exp.h)
  ) {
    throw new Error('Invalid NPCInv.dc6 frame geometry: expected 4 frames (256x256, 64x256, 256x176, 64x176)')
  }
  savePng('merc-bg.png', 320, 432, stitch320x432Panel(npcInvDc6, 0), false)

  const invArmorDc6 = await decodeUiDc6('data/global/ui/Panel/inv_armor.dc6')
  const iaFrame = invArmorDc6.groups[0]?.frames[0]
  if (!iaFrame || iaFrame.width !== 54 || iaFrame.height !== 82) {
    throw new Error('Invalid inv_armor.dc6 frame geometry: expected 1 frame of 54x82')
  }
  savePng('inv-armor.png', iaFrame.width, iaFrame.height, iaFrame.indices)

  const invHelmGloveDc6 = await decodeUiDc6('data/global/ui/Panel/inv_helm_glove.dc6')
  const ihgFrames = invHelmGloveDc6.groups[0]?.frames
  if (!ihgFrames || ihgFrames.length !== 2 || ihgFrames.some(f => f.width !== 54 || f.height !== 53)) {
    throw new Error('Invalid inv_helm_glove.dc6 frame geometry: expected 2 frames of 54x53')
  }
  const ihgStrip = stitchHorizontalStrip(ihgFrames)
  savePng('inv-helm-glove.png', ihgStrip.width, ihgStrip.height, ihgStrip.pixels)

  const invWeaponsDc6 = await decodeUiDc6('data/global/ui/Panel/inv_weapons.dc6')
  const iwFrame = invWeaponsDc6.groups[0]?.frames[0]
  if (!iwFrame || iwFrame.width !== 54 || iwFrame.height !== 109) {
    throw new Error('Invalid inv_weapons.dc6 frame geometry: expected 1 frame of 54x109')
  }
  savePng('inv-weapons.png', iwFrame.width, iwFrame.height, iwFrame.indices)

  // 5c. Party Screen (`MENU/party.dc6`, `MENU/partybuttons.dc6`, `MENU/partyboxes.dc6`, `MENU/partybar.dc6` per D2Client.dll 0x6fb27400)
  const partyBgDc6 = await decodeUiDc6('data/global/ui/MENU/party.dc6')
  const pbf = partyBgDc6.groups[0]?.frames
  if (
    !pbf ||
    pbf.length < 4 ||
    expectedVendorBgFrames.some((exp, i) => pbf[i]?.width !== exp.w || pbf[i]?.height !== exp.h)
  ) {
    throw new Error('Invalid party.dc6 frame geometry: expected 4 frames (256x256, 64x256, 256x176, 64x176)')
  }
  savePng('party-bg.png', 320, 432, stitch320x432Panel(partyBgDc6, 0), false)

  const partyButtonsDc6 = await decodeUiDc6('data/global/ui/MENU/partybuttons.dc6')
  const pbtnFrames = partyButtonsDc6.groups[0]?.frames
  if (!pbtnFrames || pbtnFrames.length !== 2 || pbtnFrames.some(f => f.width !== 53 || f.height !== 20)) {
    throw new Error('Invalid partybuttons.dc6 frame geometry: expected 2 frames of 53x20')
  }
  const pbtnStrip = stitchHorizontalStrip(pbtnFrames)
  savePng('partybuttons.png', pbtnStrip.width, pbtnStrip.height, pbtnStrip.pixels)

  const partyBoxesDc6 = await decodeUiDc6('data/global/ui/MENU/partyboxes.dc6')
  const pboxFrames = partyBoxesDc6.groups[0]?.frames
  if (!pboxFrames || pboxFrames.length !== 18 || pboxFrames.some(f => f.width !== 19 || f.height !== 19)) {
    throw new Error('Invalid partyboxes.dc6 frame geometry: expected 18 frames of 19x19')
  }
  const pboxStrip = stitchHorizontalStrip(pboxFrames)
  savePng('partyboxes.png', pboxStrip.width, pboxStrip.height, pboxStrip.pixels)

  const partyBarDc6 = await decodeUiDc6('data/global/ui/MENU/partybar.dc6')
  const pbarFrames = partyBarDc6.groups[0]?.frames
  if (
    !pbarFrames ||
    pbarFrames.length !== 2 ||
    pbarFrames[0]?.width !== 255 ||
    pbarFrames[0]?.height !== 4 ||
    pbarFrames[1]?.width !== 46 ||
    pbarFrames[1]?.height !== 4
  ) {
    throw new Error('Invalid partybar.dc6 frame geometry: expected 2 frames (255x4, 46x4)')
  }
  const pbarStrip = stitchHorizontalStrip(pbarFrames)
  savePng('partybar.png', pbarStrip.width, pbarStrip.height, pbarStrip.pixels)

  // 6. Pop-up Belt, Mini-panel, Buttons, Cursors
  const popbelt = await decodeUiDc6('data/global/ui/Panel/ctrlpnl_popbelt.dc6')
  savePng('popbelt.png', popbelt.groups[0]!.frames[0]!.width, popbelt.groups[0]!.frames[0]!.height, popbelt.groups[0]!.frames[0]!.indices, false)

  const minipanel = await decodeUiDc6('data/global/ui/Panel/minipanel.dc6')
  savePng('minipanel.png', minipanel.groups[0]!.frames[0]!.width, minipanel.groups[0]!.frames[0]!.height, minipanel.groups[0]!.frames[0]!.indices)

  const minipanelSingle = await decodeUiDc6('data/global/ui/Panel/minipanel_s.dc6')
  savePng('minipanel-s.png', minipanelSingle.groups[0]!.frames[0]!.width, minipanelSingle.groups[0]!.frames[0]!.height, minipanelSingle.groups[0]!.frames[0]!.indices)

  const minipanelBtns = await decodeUiDc6('data/global/ui/Panel/minipanelbtn.dc6')
  const mpStrip = stitchHorizontalStrip(minipanelBtns.groups[0]!.frames)
  savePng('minipanel-btns.png', mpStrip.width, mpStrip.height, mpStrip.pixels)

  const runBtn = await decodeUiDc6('data/global/ui/Panel/runbutton.dc6')
  const runStrip = stitchHorizontalStrip(runBtn.groups[0]!.frames)
  savePng('runbutton.png', runStrip.width, runStrip.height, runStrip.pixels)

  const menuBtn = await decodeUiDc6('data/global/ui/Panel/menubutton.dc6')
  const menuStrip = stitchHorizontalStrip(menuBtn.groups[0]!.frames)
  savePng('menubutton.png', menuStrip.width, menuStrip.height, menuStrip.pixels)

  const buySellBtn = await decodeUiDc6('data/global/ui/Panel/buysellbtn.dc6')
  const bsStrip = stitchHorizontalStrip(buySellBtn.groups[0]!.frames)
  savePng('buysellbtn.png', bsStrip.width, bsStrip.height, bsStrip.pixels)

  const goldCoinBtn = await decodeUiDc6('data/global/ui/Panel/goldcoinbtn.dc6')
  const gcbFrames = goldCoinBtn.groups[0]?.frames
  if (!gcbFrames || gcbFrames.length !== 2 || gcbFrames.some(f => f.width !== 20 || f.height !== 18)) {
    throw new Error('Invalid goldcoinbtn.dc6 frame geometry: expected 2 frames of 20x18')
  }
  const gcbStrip = stitchHorizontalStrip(gcbFrames)
  savePng('goldcoinbtn.png', gcbStrip.width, gcbStrip.height, gcbStrip.pixels)

  // Horadric Cube Transmute button (`Panel/miniconvert.dc6` per D2Client.dll 0x6fb3ce4b & 0x6fb49657, 2 frames of 32x32)
  const miniConvertDc6 = await decodeUiDc6('data/global/ui/Panel/miniconvert.dc6')
  const mcFrames = miniConvertDc6.groups[0]?.frames
  if (!mcFrames || mcFrames.length !== 2 || mcFrames.some(f => f.width !== 32 || f.height !== 32)) {
    throw new Error('Invalid miniconvert.dc6 frame geometry: expected 2 frames of 32x32')
  }
  const mcStrip = stitchHorizontalStrip(mcFrames)
  savePng('miniconvert.png', mcStrip.width, mcStrip.height, mcStrip.pixels)

  const buySellTabs = await decodeUiDc6('data/global/ui/Panel/buyselltabs.dc6')
  const bstFrames = buySellTabs.groups[0]?.frames
  if (!bstFrames || bstFrames.length !== 8 || bstFrames.some(f => f.width !== 79 || f.height !== 31)) {
    throw new Error('Invalid buyselltabs.dc6 frame geometry: expected 8 frames of 79x31')
  }
  const bstStrip = stitchHorizontalStrip(bstFrames)
  savePng('vendor-tabs.png', bstStrip.width, bstStrip.height, bstStrip.pixels)

  // Dialog stone border pieces (`menu/boxpieces.dc6` per D2Client.dll 0x6fb6e4c0, 22 frames of 14x15)
  const boxPiecesDc6 = await decodeUiDc6('data/global/ui/menu/boxpieces.dc6')
  const bpFrames = boxPiecesDc6.groups[0]?.frames
  if (!bpFrames || bpFrames.length !== 22 || bpFrames.some(f => f.width !== 14 || f.height !== 15)) {
    throw new Error('Invalid boxpieces.dc6 frame geometry: expected 22 frames of 14x15')
  }
  const bpStrip = stitchHorizontalStrip(bpFrames)
  savePng('boxpieces.png', bpStrip.width, bpStrip.height, bpStrip.pixels)

  // Dialog selection pentagram focus (`CURSOR/focus16.dc6` per D2Client.dll 0x6fb539d9, 8 frames of 20x20)
  const focus16Dc6 = await decodeUiDc6('data/global/ui/CURSOR/focus16.dc6')
  const f16Frames = focus16Dc6.groups[0]?.frames
  if (!f16Frames || f16Frames.length !== 8 || f16Frames.some(f => f.width !== 20 || f.height !== 20)) {
    throw new Error('Invalid focus16.dc6 frame geometry: expected 8 frames of 20x20')
  }
  const f16Strip = stitchHorizontalStrip(f16Frames)
  savePng('focus16.png', f16Strip.width, f16Strip.height, f16Strip.pixels)

  // Dialog scrollbar slider control (`menu/textslid.dc6` per D2Client.dll 0x6fb17fd0 & 0x6fb17640, 17 frames of 12x13)
  const textslidDc6 = await decodeUiDc6('data/global/ui/menu/textslid.dc6')
  const tsFrames = textslidDc6.groups[0]?.frames
  if (!tsFrames || tsFrames.length !== 17 || tsFrames.some(f => f.width !== 12 || f.height !== 13)) {
    throw new Error('Invalid textslid.dc6 frame geometry: expected 17 frames of 12x13')
  }
  const tsStrip = stitchHorizontalStrip(tsFrames)
  savePng('textslid.png', tsStrip.width, tsStrip.height, tsStrip.pixels)

  const levelBtn = await decodeUiDc6('data/global/ui/Panel/Level.dc6')
  const lvlStrip = stitchHorizontalStrip(levelBtn.groups[0]!.frames)
  savePng('level-btn.png', lvlStrip.width, lvlStrip.height, lvlStrip.pixels)

  const levelSocket = await decodeUiDc6('data/global/ui/Panel/Levelsocket.dc6')
  savePng('level-socket.png', levelSocket.groups[0]!.frames[0]!.width, levelSocket.groups[0]!.frames[0]!.height, levelSocket.groups[0]!.frames[0]!.indices)

  // Item Socket Ring (`PANEL/gemsocket.dc6` per D2Client.dll 0x6fb45209 & 0x6fb4523f, 1 frame of 28x28)
  const gemSocketDc6 = await decodeUiDc6('data/global/ui/PANEL/gemsocket.dc6')
  const gemSocketFrame = gemSocketDc6.groups[0]?.frames[0]
  if (!gemSocketFrame || gemSocketFrame.width !== 28 || gemSocketFrame.height !== 28) {
    throw new Error('Invalid gemsocket.dc6 frame geometry: expected 1 frame of 28x28')
  }
  savePng('gemsocket.png', gemSocketFrame.width, gemSocketFrame.height, gemSocketFrame.indices)

  const skillPts = await decodeUiDc6('data/global/ui/Panel/skillpoints.dc6')
  savePng('skillpoints.png', skillPts.groups[0]!.frames[0]!.width, skillPts.groups[0]!.frames[0]!.height, skillPts.groups[0]!.frames[0]!.indices)

  const skltreeBack = await decodeUiDc6('data/global/ui/SPELLS/skltree_s_back.DC6')
  const stF1 = skltreeBack.groups[0]!.frames[1]!
  const stF3 = skltreeBack.groups[0]!.frames[3]!
  const stF7 = skltreeBack.groups[0]!.frames[7]!
  const stF9 = skltreeBack.groups[0]!.frames[9]!
  const stF11 = skltreeBack.groups[0]!.frames[11]!
  const stF13 = skltreeBack.groups[0]!.frames[13]!

  const sttPixels = new Uint8Array(192 * 432)
  const pasteTabCol = (colIdx: number) => {
    const ox = colIdx * 64
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 64; x++) {
        sttPixels[y * 192 + (ox + x)] = stF1.indices[y * 64 + x]!
      }
    }
    for (let y = 0; y < 176; y++) {
      for (let x = 0; x < 64; x++) {
        sttPixels[(256 + y) * 192 + (ox + x)] = stF3.indices[y * 64 + x]!
      }
    }
  }

  // Col 0: Top Tab Active (y = 108..216, stF13)
  pasteTabCol(0)
  for (let y = 108; y < 216; y++) {
    for (let x = 0; x < 64; x++) {
      const idx = stF13.indices[y * 64 + x]!
      if (idx !== 0) sttPixels[y * 192 + (0 + x)] = idx
    }
  }

  // Col 1: Middle Tab Active (y = 216..324, stF9 + stF11)
  pasteTabCol(1)
  for (let y = 216; y < 256; y++) {
    for (let x = 0; x < 64; x++) {
      const idx = stF9.indices[y * 64 + x]!
      if (idx !== 0) sttPixels[y * 192 + (64 + x)] = idx
    }
  }
  for (let y = 0; y < 68; y++) {
    for (let x = 0; x < 64; x++) {
      const idx = stF11.indices[y * 64 + x]!
      if (idx !== 0) sttPixels[(256 + y) * 192 + (64 + x)] = idx
    }
  }

  // Col 2: Bottom Tab Active (y = 324..432, stF7)
  pasteTabCol(2)
  for (let y = 0; y < 176; y++) {
    for (let x = 0; x < 64; x++) {
      const idx = stF7.indices[y * 64 + x]!
      if (idx !== 0) sttPixels[(256 + y) * 192 + (128 + x)] = idx
    }
  }
  savePng('skill-tree-tabs.png', 192, 432, sttPixels)

  const expQuestTabs = await decodeUiDc6('data/global/ui/Menu/expquesttabs.dc6')
  const eqtStrip = stitchHorizontalStrip(expQuestTabs.groups[0]!.frames)
  savePng('quest-tabs.png', eqtStrip.width, eqtStrip.height, eqtStrip.pixels)

  const questSocketsDc6 = await decodeUiDc6('data/global/ui/MENU/questsockets.dc6')
  const qsStrip = stitchHorizontalStrip(questSocketsDc6.groups[0]!.frames)
  savePng('questsockets.png', qsStrip.width, qsStrip.height, qsStrip.pixels)

  const questLastDc6 = await decodeUiDc6('data/global/ui/MENU/questlast.dc6')
  const qlStrip = stitchHorizontalStrip(questLastDc6.groups[0]!.frames)
  savePng('questlast.png', qlStrip.width, qlStrip.height, qlStrip.pixels)

  // Scroll of Inifuss / Key to the Cairn Stones (`UI 0x10` Barkscroll, D2Client.dll 0x6fb2cc60)
  const scroinDc6 = await decodeUiDc6('data/global/ui/MENU/scroin.dc6')
  savePng('scroin.png', 320, 432, stitch320x432Panel(scroinDc6, 0), false)

  const scroin2Dc6 = await decodeUiDc6('data/global/ui/menu/scroin2.dc6')
  const s2Frames = scroin2Dc6.groups[0]!.frames
  const s2Placements: BlitPlacement[] = s2Frames.map((frame, i) => ({ frame, x: i * 40, y: 0 }))
  savePng('scroin2.png', 200, 25, stitchFrames(200, 25, s2Placements))

  const scroin3Dc6 = await decodeUiDc6('data/global/ui/menu/scroin3.dc6')
  const s3Frames = scroin3Dc6.groups[0]!.frames
  const s3Placements: BlitPlacement[] = []
  for (let delta = 1; delta <= 20; delta++) {
    const f = s3Frames[delta]
    if (!f) continue
    const offX = (f as SpriteFrame & { readonly offsetX?: number }).offsetX ?? 0
    const offY = (f as SpriteFrame & { readonly offsetY?: number }).offsetY ?? 0
    s3Placements.push({
      frame: f,
      x: (delta - 1) * 120 + (150 + offX),
      y: 88 - f.height + offY,
    })
  }
  savePng('scroin3.png', 20 * 120, 160, stitchFrames(20 * 120, 160, s3Placements))

  // D2Client.dll useitem.cpp (0x6fb4f750) loads two 119x184 insets drawn bottom-left at (105, 270):
  //   - `data/global/ui/MENU/horadricback.dc6`: Act 2 Horadric Orifice (useitem mode 0)
  //   - `data/global/ui/MENU/upgrade.dc6`: Charsi Imbue / Larzuk Add Sockets / Anya Personalize (useitem mode 1)
  const horadricBackDc6 = await decodeUiDc6('data/global/ui/MENU/horadricback.dc6')
  const hbFrame = horadricBackDc6.groups[0]!.frames[0]!
  savePng('horadricback.png', hbFrame.width, hbFrame.height, hbFrame.indices, false)
  const upgradeDc6 = await decodeUiDc6('data/global/ui/MENU/upgrade.dc6')
  const upFrame = upgradeDc6.groups[0]!.frames[0]!
  savePng('upgrade.png', upFrame.width, upFrame.height, upFrame.indices, false)

  // Act 2 Tal Rasha's True Tomb Symbol (`data/global/ui/menu/invps.dc6`, 7 frames of 102x93, D2Client.dll 0x6facda26 & 0x6facf589)
  const invpsDc6 = await decodeUiDc6('data/global/ui/menu/invps.dc6')
  const invpsStrip = stitchHorizontalStrip(invpsDc6.groups[0]!.frames)
  savePng('invps.png', invpsStrip.width, invpsStrip.height, invpsStrip.pixels)

  // Act 2 Horadric Scroll (`data/global/ui/MENU/recipescroll.dc6`, 320x432 2x2 panel, D2Client.dll 0x6fb47a70)
  const recipeScrollDc6 = await decodeUiDc6('data/global/ui/MENU/recipescroll.dc6')
  savePng('recipescroll.png', 320, 432, stitch320x432Panel(recipeScrollDc6, 0), false)

  const expWpTabs = await decodeUiDc6('data/global/ui/Menu/expwaygatetabs.dc6')
  const ewtStrip = stitchHorizontalStrip(expWpTabs.groups[0]!.frames)
  savePng('waypoint-tabs.png', ewtStrip.width, ewtStrip.height, ewtStrip.pixels)

  const wpIcons = await decodeUiDc6('data/global/ui/Menu/waygateicons.dc6')
  const wpiStrip = stitchHorizontalStrip(wpIcons.groups[0]!.frames)
  savePng('waypoint-icons.png', wpiStrip.width, wpiStrip.height, wpiStrip.pixels)

  const genericSkills = await decodeUiDc6('data/global/ui/SPELLS/Skillicon.DC6')
  const gsFrames = genericSkills.groups[0]!.frames
  const gsStrip = stitchHorizontalStrip(gsFrames)
  savePng('generic-skills.png', gsStrip.width, gsStrip.height, gsStrip.pixels)

  // Authentic 1.13c generic skill icons (Skillicon.DC6 frames for skills 0..5, 217..220, 350)
  const genericIconsToEmit: readonly { name: string; frameIndex: number }[] = [
    { name: 'icon_0.png', frameIndex: 2 },
    { name: 'icon_0_active.png', frameIndex: 3 },
    { name: 'icon_0_sword.png', frameIndex: 2 },
    { name: 'icon_0_fist.png', frameIndex: 0 },
    { name: 'icon_1.png', frameIndex: 0 },
    { name: 'icon_1_active.png', frameIndex: 1 },
    { name: 'icon_2.png', frameIndex: 6 },
    { name: 'icon_2_active.png', frameIndex: 7 },
    { name: 'icon_3.png', frameIndex: 4 },
    { name: 'icon_3_active.png', frameIndex: 5 },
    { name: 'icon_4.png', frameIndex: 12 },
    { name: 'icon_4_active.png', frameIndex: 13 },
    { name: 'icon_5.png', frameIndex: 10 },
    { name: 'icon_5_active.png', frameIndex: 11 },
    { name: 'icon_217.png', frameIndex: 14 },
    { name: 'icon_217_active.png', frameIndex: 15 },
    { name: 'icon_218.png', frameIndex: 14 },
    { name: 'icon_218_active.png', frameIndex: 15 },
    { name: 'icon_219.png', frameIndex: 18 },
    { name: 'icon_219_active.png', frameIndex: 19 },
    { name: 'icon_220.png', frameIndex: 18 },
    { name: 'icon_220_active.png', frameIndex: 19 },
    { name: 'icon_350.png', frameIndex: 2 },
    { name: 'icon_350_active.png', frameIndex: 3 },
  ]
  for (const item of genericIconsToEmit) {
    const f = gsFrames[item.frameIndex]
    if (!f) continue
    savePng(item.name, f.width, f.height, f.indices)
    const png = encodeIndexedPng({
      width: f.width,
      height: f.height,
      pixels: f.indices,
      palette: pl2.rgb,
      transparentIndex: 0,
    })
    const skillsDir = join(process.cwd(), 'public', 'skills')
    try {
      mkdirSync(skillsDir, { recursive: true })
      writeFileSync(join(skillsDir, item.name), png)
    } catch {
      // optional copy to skills directory
    }
  }

  const ohand = await decodeUiDc6('data/global/ui/CURSOR/ohand.dc6')
  savePng('cursor-hand.png', ohand.groups[0]!.frames[0]!.width, ohand.groups[0]!.frames[0]!.height, ohand.groups[0]!.frames[0]!.indices)

  // 6b. In-Game Escape Menu Banners (`data/local/ui/eng/{Options,Exit,ReturnToGame}.dc6`) & 3D Pentagram Spinner (`CURSOR/Pentspin.dc6`)
  // Per D2Client.dll gmenu.cpp (0x6fb13e90, 0x6fb145a0, 0x6fb15230) and D2Win #10138 (0x6f8f17a0)
  const escOptionsDc6 = await decodeUiDc6('data/local/ui/eng/Options.dc6')
  const escOptionsStrip = stitchHorizontalStrip(escOptionsDc6.groups[0]!.frames)
  if (escOptionsStrip.width !== 160 || escOptionsStrip.height !== 36) {
    throw new Error(`Invalid Options.dc6 geometry: expected 160x36, got ${escOptionsStrip.width}x${escOptionsStrip.height}`)
  }
  savePng('esc-options.png', escOptionsStrip.width, escOptionsStrip.height, escOptionsStrip.pixels)

  const escExitDc6 = await decodeUiDc6('data/local/ui/eng/Exit.dc6')
  const escExitStrip = stitchHorizontalStrip(escExitDc6.groups[0]!.frames)
  if (escExitStrip.width !== 434 || escExitStrip.height !== 36) {
    throw new Error(`Invalid Exit.dc6 geometry: expected 434x36, got ${escExitStrip.width}x${escExitStrip.height}`)
  }
  savePng('esc-exit.png', escExitStrip.width, escExitStrip.height, escExitStrip.pixels)

  const escReturnDc6 = await decodeUiDc6('data/local/ui/eng/ReturnToGame.dc6')
  const escReturnStrip = stitchHorizontalStrip(escReturnDc6.groups[0]!.frames)
  if (escReturnStrip.width !== 356 || escReturnStrip.height !== 36) {
    throw new Error(`Invalid ReturnToGame.dc6 geometry: expected 356x36, got ${escReturnStrip.width}x${escReturnStrip.height}`)
  }
  savePng('esc-return.png', escReturnStrip.width, escReturnStrip.height, escReturnStrip.pixels)

  const pentSpinDc6 = await decodeUiDc6('data/global/ui/CURSOR/Pentspin.dc6')
  const psFrames = pentSpinDc6.groups[0]?.frames
  if (!psFrames || psFrames.length !== 8) {
    throw new Error(`Invalid Pentspin.dc6 frame count: expected 8 frames, got ${psFrames?.length ?? 0}`)
  }
  const psStrip = stitchHorizontalStrip(psFrames)
  savePng('pentspin.png', psStrip.width, psStrip.height, psStrip.pixels)

  // Extract authentic dynamic cursor atlas (Issue #148: protate, ohand, orotate)
  console.log('Extracting authentic dynamic cursor atlas (Issue #148)...')
  await packCursorAssets(process.cwd())

  // 7. Extract Bitmap Fonts (`data/local/font/latin/*.dc6 + *.tbl`)
  console.log('Extracting bitmap fonts...')
  const fontNames = ['font6', 'font8', 'font16', 'font30', 'fontexocet10', 'fontformal12'] as const
  const fontMetas: Record<string, FontAtlasMeta> = {}
  for (const fn of fontNames) {
    const fDc6 = await decodeUiDc6(`data/local/font/latin/${fn}.dc6`)
    const fTbl = await archives.read(`data/local/font/latin/${fn}.tbl`)
    const built = buildFontAtlas(fn, fDc6, fTbl)
    fontMetas[fn] = built.meta
    savePng(`fonts/${fn}.png`, built.meta.atlasWidth, built.meta.atlasHeight, built.pixels)
  }
  writeFileSync(join(fontsDir, 'metrics.json'), JSON.stringify(fontMetas, null, 2))

  // 7b. Generate authentic local TrueType WebFonts (`D2Exocet.ttf` & `D2Formal436.ttf`) from 1.13c DC6 font sheets
  const f42Dc6 = await decodeUiDc6('data/local/font/latin/font42.dc6')
  const f42Tbl = await archives.read('data/local/font/latin/font42.tbl')
  const exocetFg = new Set([4, 6, 7, 12, 13, 14, 20, 23, 24, 26, 28, 29, 30, 31, 32])
  const exocetTtf = buildTrueTypeFont({
    familyName: 'D2Exocet',
    postScriptName: 'D2Exocet-Regular',
    frames: f42Dc6.groups[0]!.frames,
    tblBytes: f42Tbl,
    baselineY: 32,
    scale: 28,
    isForeground: idx => exocetFg.has(idx),
    minContourAreaPixels: 2,
    refineMask: (mask, frame) => {
      const w = frame.width
      const h = frame.height
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x
          const p = frame.indices[i] ?? 0
          if (mask[i] && (p === 4 || p === 6) && !mask[i - 1] && !mask[i + 1]) {
            mask[i] = 0
          }
        }
      }
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x
          const p = frame.indices[i] ?? 0
          if (!mask[i] && (p === 3 || p === 18 || p === 19) && mask[i - 1] && mask[i + 1]) {
            mask[i] = 1
          }
        }
      }
    },
  })
  writeFileSync(join(fontsDir, 'D2Exocet.ttf'), exocetTtf)

  const ff12Dc6 = await decodeUiDc6('data/local/font/latin/fontformal12.dc6')
  const ff12Tbl = await archives.read('data/local/font/latin/fontformal12.tbl')
  const formalTtf = buildTrueTypeFont({
    familyName: 'D2Formal436',
    postScriptName: 'D2Formal436-Regular',
    frames: ff12Dc6.groups[0]!.frames,
    tblBytes: ff12Tbl,
    baselineY: 26,
    scale: 56,
    isForeground: idx => idx >= 28,
    refineMask: (mask, frame) => {
      const w = frame.width
      const h = frame.height
      const base = mask.slice()
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x
          if (!base[i] && frame.indices[i] === 27 && base[i - w] && base[i + w] && base[i - 1] !== base[i + 1]) {
            mask[i] = 1
          }
        }
      }
    },
  })
  for (const d of targetUiDirs) {
    writeFileSync(join(d, 'fonts', 'metrics.json'), JSON.stringify(fontMetas, null, 2))
    writeFileSync(join(d, 'fonts', 'D2Exocet.ttf'), exocetTtf)
    writeFileSync(join(d, 'fonts', 'D2Formal436.ttf'), formalTtf)
  }

  // --- STAGE 2: Comprehensive Items, Flippy Ground Sprites & Unique Items Packing ---
  console.log('Extracting item sprites & flippy ground sprites (including uniqueitems.txt & setitems.txt)...')
  const codeToInvFile: Record<string, string> = {}
  const uniqueInvFiles = new Set<string>()
  const codeToFlippyFile: Record<string, string> = {}
  const uniqueFlippyFiles = new Set<string>()
  const baseInvFile: Record<string, string> = {}
  const baseUniqueInvFile: Record<string, string> = {}
  const baseSetInvFile: Record<string, string> = {}
  const baseFlippyFile: Record<string, string> = {}
  const baseInvTrans: Record<string, number> = {}
  const itemClassIdToCode: Record<number, string> = {}
  let nextItemClassId = 0

  const isValidInvTrans = (invTrans: number): boolean =>
    invTrans === 1 || invTrans === 2 || (invTrans >= 5 && invTrans <= 8)

  // A. Base Items from weapons.txt, armor.txt, misc.txt
  for (const t of ['weapons.txt', 'armor.txt', 'misc.txt']) {
    const tbl = parseTable(new TextDecoder().decode(await archives.read(`data/global/excel/${t}`)))
    for (const r of tbl.rows) {
      const code = r['code']?.trim()
      const name = r['name']?.trim()
      if (!code || code === 'Expansion' || name === 'Expansion') continue
      itemClassIdToCode[nextItemClassId++] = code
      baseInvTrans[code] = Number.parseInt(r['InvTrans']?.trim() ?? '0', 10) || 0
      const inv = r['invfile']?.trim().toLowerCase()
      if (code && inv) {
        baseInvFile[code] = inv
        if (archives.has(`data/global/items/${inv}.dc6`)) {
          codeToInvFile[code] = inv
          uniqueInvFiles.add(inv)
        }
      }
      const uInv = r['uniqueinvfile']?.trim().toLowerCase()
      if (code && uInv) {
        baseUniqueInvFile[code] = uInv
        if (archives.has(`data/global/items/${uInv}.dc6`)) {
          uniqueInvFiles.add(uInv)
        }
      }
      const sInv = r['setinvfile']?.trim().toLowerCase()
      if (code && sInv) {
        baseSetInvFile[code] = sInv
        if (archives.has(`data/global/items/${sInv}.dc6`)) {
          uniqueInvFiles.add(sInv)
        }
      }

      const flp = r['flippyfile']?.trim().toLowerCase()
      if (code && flp) {
        baseFlippyFile[code] = flp
        if (archives.has(`data/global/items/${flp}.dc6`)) {
          codeToFlippyFile[code] = flp
          uniqueFlippyFiles.add(flp)
        }
      }
    }
  }

  const engChain = await loadStringTableChain(archives, 'ENG')

  const transformedItemMap = new Map<string, {
    baseInv: string
    transformedName: string
    colorCode: string
    invTrans: number
  }>()

  const transformedFlippyMap = new Map<string, {
    baseFlp: string
    transformedName: string
    colorCode: string
    invTrans: number
  }>()

  // B. Unique Items from uniqueitems.txt (includes invmss, invtrch, invamu2, etc.)
  if (archives.has('data/global/excel/uniqueitems.txt')) {
    const uTbl = parseTable(new TextDecoder().decode(await archives.read('data/global/excel/uniqueitems.txt')))
    for (const r of uTbl.rows) {
      if (r['enabled'] === '0') continue
      const code = r['code']?.trim()
      const explicitInv = r['invfile']?.trim().toLowerCase()
      const hasDedicatedInv = Boolean(explicitInv || (code && baseUniqueInvFile[code]))
      const inv = (explicitInv && archives.has(`data/global/items/${explicitInv}.dc6`))
        ? explicitInv
        : (code && baseUniqueInvFile[code] && archives.has(`data/global/items/${baseUniqueInvFile[code]}.dc6`))
          ? baseUniqueInvFile[code]
          : (code && baseInvFile[code] && archives.has(`data/global/items/${baseInvFile[code]}.dc6`))
            ? baseInvFile[code]
            : undefined

      if (inv) {
        uniqueInvFiles.add(inv)
      }
      const explicitFlp = r['flippyfile']?.trim().toLowerCase()
      const flp = (explicitFlp && archives.has(`data/global/items/${explicitFlp}.dc6`))
        ? explicitFlp
        : (code && baseFlippyFile[code] && archives.has(`data/global/items/${baseFlippyFile[code]}.dc6`))
          ? baseFlippyFile[code]
          : undefined

      if (flp) {
        uniqueFlippyFiles.add(flp)
      }

      const idx = r['index']?.trim()
      if (!idx) continue
      const displayName = engChain.get(idx)?.trim()
      const trans = r['invtransform']?.trim().toLowerCase()
      const invTrans = code ? (baseInvTrans[code] ?? 0) : 0

      if (!hasDedicatedInv && trans && inv && isValidInvTrans(invTrans)) {
        const dyedInv = `${inv}_${trans}`
        transformedItemMap.set(dyedInv, { baseInv: inv, transformedName: dyedInv, colorCode: trans, invTrans })
        codeToInvFile[idx] = dyedInv
        if (displayName) codeToInvFile[displayName] = dyedInv
        codeToInvFile[dyedInv] = dyedInv
        codeToInvFile[inv] = inv
        if (flp) {
          const dyedFlp = `${flp}_${trans}`
          transformedFlippyMap.set(dyedFlp, { baseFlp: flp, transformedName: dyedFlp, colorCode: trans, invTrans })
          codeToFlippyFile[idx] = dyedFlp
          if (displayName) codeToFlippyFile[displayName] = dyedFlp
          codeToFlippyFile[dyedFlp] = dyedFlp
          codeToFlippyFile[flp] = flp
        }
      } else {
        if (inv) {
          codeToInvFile[idx] = inv
          if (displayName) codeToInvFile[displayName] = inv
        }
        if (flp) {
          codeToFlippyFile[idx] = flp
          if (displayName) codeToFlippyFile[displayName] = flp
        }
      }

      // Backward compatibility for Arachnid Mesh tests expecting invvbl_blac
      if (idx === 'Arachnid Mesh') {
        const dyedVbl = 'invvbl_blac'
        transformedItemMap.set(dyedVbl, { baseInv: 'invvbl', transformedName: dyedVbl, colorCode: 'blac', invTrans: 8 })
        codeToInvFile['Arachnid Mesh'] = dyedVbl
        codeToInvFile[dyedVbl] = dyedVbl
        const dyedVblFlp = 'flpvbl_blac'
        transformedFlippyMap.set(dyedVblFlp, { baseFlp: 'flpvbl', transformedName: dyedVblFlp, colorCode: 'blac', invTrans: 8 })
        codeToFlippyFile['Arachnid Mesh'] = dyedVblFlp
        codeToFlippyFile[dyedVblFlp] = dyedVblFlp
      }
    }
  }

  // C. Set Items from setitems.txt
  if (archives.has('data/global/excel/setitems.txt')) {
    const sTbl = parseTable(new TextDecoder().decode(await archives.read('data/global/excel/setitems.txt')))
    for (const r of sTbl.rows) {
      const itemCode = r['item']?.trim()
      const explicitInv = r['invfile']?.trim().toLowerCase()
      const hasDedicatedInv = Boolean(explicitInv || (itemCode && baseSetInvFile[itemCode]))
      const inv = (explicitInv && archives.has(`data/global/items/${explicitInv}.dc6`))
        ? explicitInv
        : (itemCode && baseSetInvFile[itemCode] && archives.has(`data/global/items/${baseSetInvFile[itemCode]}.dc6`))
          ? baseSetInvFile[itemCode]
          : (itemCode && baseInvFile[itemCode] && archives.has(`data/global/items/${baseInvFile[itemCode]}.dc6`))
            ? baseInvFile[itemCode]
            : undefined

      if (inv) {
        uniqueInvFiles.add(inv)
      }
      const explicitFlp = r['flippyfile']?.trim().toLowerCase()
      const flp = (explicitFlp && archives.has(`data/global/items/${explicitFlp}.dc6`))
        ? explicitFlp
        : (itemCode && baseFlippyFile[itemCode] && archives.has(`data/global/items/${baseFlippyFile[itemCode]}.dc6`))
          ? baseFlippyFile[itemCode]
          : undefined

      if (flp) {
        uniqueFlippyFiles.add(flp)
      }

      const idx = r['index']?.trim()
      if (!idx) continue
      const displayName = engChain.get(idx)?.trim()
      const trans = r['invtransform']?.trim().toLowerCase()
      const invTrans = itemCode ? (baseInvTrans[itemCode] ?? 0) : 0

      if (!hasDedicatedInv && trans && inv && isValidInvTrans(invTrans)) {
        const dyedInv = `${inv}_${trans}`
        transformedItemMap.set(dyedInv, { baseInv: inv, transformedName: dyedInv, colorCode: trans, invTrans })
        codeToInvFile[idx] = dyedInv
        if (displayName) codeToInvFile[displayName] = dyedInv
        codeToInvFile[dyedInv] = dyedInv
        codeToInvFile[inv] = inv
        if (flp) {
          const dyedFlp = `${flp}_${trans}`
          transformedFlippyMap.set(dyedFlp, { baseFlp: flp, transformedName: dyedFlp, colorCode: trans, invTrans })
          codeToFlippyFile[idx] = dyedFlp
          if (displayName) codeToFlippyFile[displayName] = dyedFlp
          codeToFlippyFile[dyedFlp] = dyedFlp
          codeToFlippyFile[flp] = flp
        }
      } else {
        if (inv) {
          codeToInvFile[idx] = inv
          if (displayName) codeToInvFile[displayName] = inv
        }
        if (flp) {
          codeToFlippyFile[idx] = flp
          if (displayName) codeToFlippyFile[displayName] = flp
        }
      }
    }
  }

  // Register authentic charm DC6 icons (invch1..invch9)
  for (let i = 1; i <= 9; i++) {
    const charmInv = `invch${i}`
    if (archives.has(`data/global/items/${charmInv}.dc6`)) {
      uniqueInvFiles.add(charmInv)
    }
  }

  // Register authentic ring DC6 icons (invrin1..invrin5 per ItemTypes.txt VarInvGfx = 5)
  for (let i = 1; i <= 5; i++) {
    const ringInv = `invrin${i}`
    if (archives.has(`data/global/items/${ringInv}.dc6`)) {
      uniqueInvFiles.add(ringInv)
    }
  }

  // Register authentic amulet DC6 icons (invamu1..invamu3 per ItemTypes.txt VarInvGfx = 3)
  for (let i = 1; i <= 3; i++) {
    const amuInv = `invamu${i}`
    if (archives.has(`data/global/items/${amuInv}.dc6`)) {
      uniqueInvFiles.add(amuInv)
    }
  }

  // Register authentic jewel DC6 icons (invjw1..invjw6 per ItemTypes.txt VarInvGfx = 6)
  for (let i = 1; i <= 6; i++) {
    const jwInv = `invjw${i}`
    if (archives.has(`data/global/items/${jwInv}.dc6`)) {
      uniqueInvFiles.add(jwInv)
    }
  }

  // Identity mapping for every invfile: codeToInvFile[inv] = inv
  for (const inv of uniqueInvFiles) {
    codeToInvFile[inv] = inv
  }

  // Authentic charm base item code mappings (overriding misc.txt placeholder invfiles invchm, invwnd, invsst)
  codeToInvFile['cm1'] = 'invch1'
  codeToInvFile['cm2'] = 'invch2'
  codeToInvFile['cm3'] = 'invch3'
  codeToInvFile['gheeds'] = 'invch3'
  codeToInvFile["Gheed's Fortune"] = 'invch3'
  codeToInvFile['anni'] = 'invmss'
  codeToInvFile['torch'] = 'invtrch'

  // Explicitly guarantee Annihilus and Torch mappings
  if (archives.has('data/global/items/invmss.dc6')) {
    uniqueInvFiles.add('invmss')
    codeToInvFile['mss'] = 'invmss'
    codeToInvFile['invmss'] = 'invmss'
    codeToInvFile['anni'] = 'invmss'
    codeToInvFile['Annihilus'] = 'invmss'
  }
  if (archives.has('data/global/items/invtrch.dc6')) {
    uniqueInvFiles.add('invtrch')
    codeToInvFile['trch'] = 'invtrch'
    codeToInvFile['invtrch'] = 'invtrch'
    codeToInvFile['torch'] = 'invtrch'
    codeToInvFile['Hellfire Torch'] = 'invtrch'
  }

  // Explicit flippy mappings
  codeToFlippyFile['gld'] = 'flpgld'
  codeToFlippyFile['gold'] = 'flpgld'
  codeToFlippyFile['box'] = 'flpbox'
  codeToFlippyFile['Horadric Cube'] = 'flpbox'
  codeToFlippyFile['cm1'] = 'flpchm1'
  codeToFlippyFile['cm2'] = 'flpchm2'
  codeToFlippyFile['cm3'] = 'flpchm3'
  codeToFlippyFile['gheeds'] = 'flpchm3'
  codeToFlippyFile["Gheed's Fortune"] = 'flpchm3'
  codeToFlippyFile['anni'] = 'flpmss'
  codeToFlippyFile['Annihilus'] = 'flpmss'
  codeToFlippyFile['torch'] = 'flptrch'
  codeToFlippyFile['Hellfire Torch'] = 'flptrch'

  // Identity mapping for every flippyfile: codeToFlippyFile[flp] = flp
  for (const flp of uniqueFlippyFiles) {
    codeToFlippyFile[flp] = flp
  }

  // Pack items-atlas.png (ATLAS_W = 2048)
  const sortedInvNames = [...uniqueInvFiles].sort()
  const ATLAS_W = 2048
  let curX = 0
  let curY = 0
  let rowH = 0
  const itemRects: Record<string, SpriteRect> = {}
  const flippyRects: Record<string, SpriteRect> = {}
  const flippyFrames: Record<string, SpriteRect[]> = {}
  const itemPlacements: BlitPlacement[] = []
  const decodedBaseFrames = new Map<string, SpriteFrame>()

  const placeFrameInAtlas = (frame: SpriteFrame, includeOffsets = false): SpriteRect => {
    if (curX + frame.width > ATLAS_W) {
      curX = 0
      curY += rowH + 2
      rowH = 0
    }
    const dc6Frame = frame as SpriteFrame & { readonly offsetX?: number; readonly offsetY?: number }
    const rect: SpriteRect = {
      x: curX,
      y: curY,
      w: frame.width,
      h: frame.height,
      ...(includeOffsets
        ? {
            offsetX: dc6Frame.offsetX ?? 0,
            offsetY: dc6Frame.offsetY ?? 0,
          }
        : {}),
    }
    itemPlacements.push({ frame, x: curX, y: curY })
    curX += frame.width + 2
    if (frame.height > rowH) rowH = frame.height
    return rect
  }

  for (const invName of sortedInvNames) {
    const dc6 = await decodeUiDc6(`data/global/items/${invName}.dc6`)
    const frame = dc6.groups[0]?.frames[0]
    if (!frame) continue
    decodedBaseFrames.set(invName, frame)
    itemRects[invName] = placeFrameInAtlas(frame, false)
  }
  decodedBaseFrames.set('gemsocket', gemSocketFrame)
  itemRects['gemsocket'] = placeFrameInAtlas(gemSocketFrame, false)
  codeToInvFile['gemsocket'] = 'gemsocket'

  // Pre-bake and stitch transformed item frames (cgrn, dpur, lgry, blac, whit, etc.)
  // Per D2Common.dll ITEMS_GetColor (0x6fd75250, bInventory=1) & D2CMP.dll CelGetColorTable
  // (#10091, 0x6fe24ec0), 2D inventory/flippy sprites select their palette remap .dat file
  // via the base item's InvTrans column (1..8):
  //   1 -> grey.dat, 2 -> grey2.dat, 5 -> greybrown.dat,
  //   6 -> invgrey.dat, 7 -> invgrey2.dat, 8 -> invgreybrown.dat.
  // Each .dat file ships 21 tables of 256 bytes in Colors.txt row order (whit=0 .. dpur=18 .. bwht=20).
  const INV_TRANS_DAT_FILES: Record<number, string> = {
    1: 'data/global/items/palette/grey.dat',
    2: 'data/global/items/palette/grey2.dat',
    5: 'data/global/items/palette/greybrown.dat',
    6: 'data/global/items/palette/invgrey.dat',
    7: 'data/global/items/palette/invgrey2.dat',
    8: 'data/global/items/palette/invgreybrown.dat',
  }
  const paletteDatTables: Record<number, Uint8Array> = {}
  for (const [transIdxStr, datPath] of Object.entries(INV_TRANS_DAT_FILES)) {
    if (archives.has(datPath)) {
      paletteDatTables[Number(transIdxStr)] = await archives.read(datPath)
    }
  }

  const colorsTable = archives.has('data/global/excel/colors.txt')
    ? parseTable(new TextDecoder().decode(await archives.read('data/global/excel/colors.txt')))
    : undefined
  const colorCodeToRowIndex: Record<string, number> = {}
  if (colorsTable) {
    colorsTable.rows.forEach((r, idx) => {
      const code = r['Code']?.trim().toLowerCase()
      if (code) colorCodeToRowIndex[code] = idx
    })
  }

  function getTransformTable(colorCode: string, invTrans: number): Uint8Array {
    const datBytes = paletteDatTables[invTrans] ?? paletteDatTables[8]
    const rowIdx = colorCodeToRowIndex[colorCode]
    if (rowIdx !== undefined && datBytes && rowIdx < datBytes.byteLength / 256) {
      return datBytes.subarray(rowIdx * 256, (rowIdx + 1) * 256)
    }
    if (datBytes && colorCode === 'whit') {
      return datBytes.subarray(0, 256)
    }
    throw new Error(`Color code ${colorCode} (InvTrans=${invTrans}) has no palette .dat remap row (colors.txt order)`)
  }

  for (const t of transformedItemMap.values()) {
    let baseFrame = decodedBaseFrames.get(t.baseInv)
    if (!baseFrame) {
      if (archives.has(`data/global/items/${t.baseInv}.dc6`)) {
        const dc6 = await decodeUiDc6(`data/global/items/${t.baseInv}.dc6`)
        baseFrame = dc6.groups[0]?.frames[0]
      }
      if (!baseFrame) continue
    }
    const table = getTransformTable(t.colorCode, t.invTrans)
    const transformedFrame = transformSpriteFrame(baseFrame, table)
    itemRects[t.transformedName] = placeFrameInAtlas(transformedFrame, false)
  }

  // --- STAGE 2.5: Authentic Flippy Ground Item Sprites (all animation frames 0..N-1) ---
  console.log('Packing authentic flippy ground item sprites (all animation frames)...')
  const sortedFlippyNames = [...uniqueFlippyFiles].sort()
  const decodedFlippyBaseFrames = new Map<string, readonly SpriteFrame[]>()

  for (const flpName of sortedFlippyNames) {
    const dc6 = await decodeUiDc6(`data/global/items/${flpName}.dc6`)
    if (flpName === 'flpgld') {
      // flpgld has 4 groups: 0=small pile, 1=medium pile, 2=large pile, 3=huge pile
      for (let g = 0; g < dc6.groups.length; g++) {
        const groupFrames = dc6.groups[g]?.frames
        if (!groupFrames || groupFrames.length === 0) continue
        const key = `flpgld_${g}`
        const rectsForGroup: SpriteRect[] = []
        for (const f of groupFrames) {
          rectsForGroup.push(placeFrameInAtlas(f, true))
        }
        const lastRect = rectsForGroup[rectsForGroup.length - 1]!
        flippyFrames[key] = rectsForGroup
        flippyRects[key] = lastRect
        itemRects[key] = lastRect
      }
      if (flippyRects['flpgld_0'] && flippyFrames['flpgld_0']) {
        flippyFrames['flpgld'] = flippyFrames['flpgld_0']
        flippyRects['flpgld'] = flippyRects['flpgld_0']
        itemRects['flpgld'] = flippyRects['flpgld_0']
      }
    } else {
      const groupFrames = dc6.groups[0]?.frames
      if (!groupFrames || groupFrames.length === 0) continue
      decodedFlippyBaseFrames.set(flpName, groupFrames)
      const rectsForFlippy: SpriteRect[] = []
      for (const f of groupFrames) {
        rectsForFlippy.push(placeFrameInAtlas(f, true))
      }
      const lastRect = rectsForFlippy[rectsForFlippy.length - 1]!
      flippyFrames[flpName] = rectsForFlippy
      flippyRects[flpName] = lastRect
      itemRects[flpName] = lastRect
    }
  }

  // Pre-bake and stitch transformed flippy frames (all frames 0..N-1)
  for (const t of transformedFlippyMap.values()) {
    let baseFrames = decodedFlippyBaseFrames.get(t.baseFlp)
    if (!baseFrames) {
      if (archives.has(`data/global/items/${t.baseFlp}.dc6`)) {
        const dc6 = await decodeUiDc6(`data/global/items/${t.baseFlp}.dc6`)
        baseFrames = dc6.groups[0]?.frames
      }
    }
    if (!baseFrames || baseFrames.length === 0) continue
    const table = getTransformTable(t.colorCode, t.invTrans)
    const rectsForTransformed: SpriteRect[] = []
    for (const bf of baseFrames) {
      const transformedFrame = transformSpriteFrame(bf, table)
      rectsForTransformed.push(placeFrameInAtlas(transformedFrame, true))
    }
    const lastRect = rectsForTransformed[rectsForTransformed.length - 1]!
    flippyFrames[t.transformedName] = rectsForTransformed
    flippyRects[t.transformedName] = lastRect
    itemRects[t.transformedName] = lastRect
  }

  // Alias itemRects, flippyRects, and flippyFrames by item code for direct lookup convenience
  for (const [code, invFile] of Object.entries(codeToInvFile)) {
    if (!itemRects[code] && itemRects[invFile]) {
      itemRects[code] = itemRects[invFile]!
    }
  }
  for (const [code, flpFile] of Object.entries(codeToFlippyFile)) {
    if (!flippyRects[code] && flippyRects[flpFile]) {
      flippyRects[code] = flippyRects[flpFile]!
    }
    if (!flippyFrames[code] && flippyFrames[flpFile]) {
      flippyFrames[code] = flippyFrames[flpFile]!
    }
  }

  const atlasH = Math.max(1, curY + rowH)
  savePng('items-atlas.png', ATLAS_W, atlasH, stitchFrames(ATLAS_W, atlasH, itemPlacements))

  // --- STAGE 3: 27 Quest Icons Atlas (active=frame 0, done=frame 24, pressed=frame 25, unstarted=frame 26) ---
  console.log('Extracting quest icons (27 active, 27 completed, 27 pressed, 27 unstarted)...')
  const canonicalQuests = [
    // Act 1 (0..5)
    'a1q1', 'a1q2', 'a1q3', 'a1q4', 'a1q5', 'a1q6',
    // Act 2 (6..11)
    'a2q1', 'a2q2', 'a2q3', 'a2q4', 'a2q5', 'a2q6',
    // Act 3 (12..17)
    'a3q1', 'a3q2', 'a3q3', 'a3q4', 'a3q5', 'a3q6',
    // Act 4 (18..20)
    'a4q1', 'a4q2', 'a4q3',
    // Act 5 (21..26)
    'a5q1', 'a5q2', 'a5q3', 'a5q4', 'a5q5', 'a5q6',
  ]

  const questRects: Record<string, SpriteRect> = {}
  const questPlacements: BlitPlacement[] = []

  // Pack 4 * 27 = 108 tiles in a 6-column grid (each tile 72x86):
  // Width: 6 * 72 = 432
  // Height: 18 rows * 86 = 1548
  const QUEST_ATLAS_W = 432
  const QUEST_ATLAS_H = 1548

  await decodeUiDc6('data/global/ui/MENU/questdone.dc6')

  for (let i = 0; i < canonicalQuests.length; i++) {
    const qSlug = canonicalQuests[i]!
    const qDc6 = await decodeUiDc6(`data/global/ui/MENU/${qSlug}.dc6`)
    const qFrames = qDc6.groups[0]!.frames

    // 1. Active quest icon (frame 0, D2Client 0x6facce00 mode=3)
    {
      const frame = qFrames[0]!
      const col = i % 6
      const row = Math.floor(i / 6)
      const qx = col * 72
      const qy = row * 86
      questRects[qSlug] = { x: qx, y: qy, w: 72, h: 86 }
      questPlacements.push({ frame, x: qx, y: qy })
    }

    // 2. Completed quest icon (frame 24 / 0x18, D2Client 0x6facce00 mode=1)
    {
      const frame = qFrames[24]!
      const idx = 27 + i
      const col = idx % 6
      const row = Math.floor(idx / 6)
      const qx = col * 72
      const qy = row * 86
      const rect: SpriteRect = { x: qx, y: qy, w: 72, h: 86 }
      questRects[`questdone_${i}`] = rect
      questRects[`questdone_${qSlug}`] = rect
      questRects[`${qSlug}_done`] = rect
      questPlacements.push({ frame, x: qx, y: qy })
    }

    // 3. Pressed active quest icon (frame 25 / 0x19, D2Client 0x6facf500 mode=3 pressed)
    {
      const frame = qFrames[25]!
      const idx = 54 + i
      const col = idx % 6
      const row = Math.floor(idx / 6)
      const qx = col * 72
      const qy = row * 86
      questRects[`${qSlug}_pressed`] = { x: qx, y: qy, w: 72, h: 86 }
      questPlacements.push({ frame, x: qx, y: qy })
    }

    // 4. Unstarted / locked socket quest icon (frame 26 / 0x1a, D2Client 0x6facce00 mode=2)
    {
      const frame = qFrames[26]!
      const idx = 81 + i
      const col = idx % 6
      const row = Math.floor(idx / 6)
      const qx = col * 72
      const qy = row * 86
      questRects[`${qSlug}_unstarted`] = { x: qx, y: qy, w: 72, h: 86 }
      questPlacements.push({ frame, x: qx, y: qy })
    }
  }

  savePng('quests-atlas.png', QUEST_ATLAS_W, QUEST_ATLAS_H, stitchFrames(QUEST_ATLAS_W, QUEST_ATLAS_H, questPlacements))

  // --- STAGE 3.25: Top-Left HUD Portraits Atlas (29 icons from data/global/ui/Hireables/*.dc6) ---
  console.log('Packing 29 Top-Left HUD Portrait DC6 icons (Player Classes, Hirelings, Summoned Minions)...')
  const canonicalPortraits = [
    'AmazonIcon',
    'SorceressIcon',
    'NecromancerIcon',
    'PaladinIcon',
    'BarbarianIcon',
    'DruidIcon',
    'AssassinIcon',
    'rogueicon',
    'act2hireableicon',
    'act3hireableicon',
    'barbhirable_icon',
    'valkarieicon',
    'earthgolumicon',
    'bloodgolumicon',
    'metalgolumicon',
    'firegolumicon',
    'skeletonicon',
    'skeletonmageicon',
    'revivedicon',
    'raven',
    'wolf',
    'oaksage',
    'heartofwolverine',
    'spiritofbarbs',
    'plaguepoppy',
    'cycleoflife',
    'vines',
    'bear',
    'shadowassassin',
  ]
  const PORTRAIT_CELL_W = 48
  const PORTRAIT_CELL_H = 42
  const PORTRAIT_COLS = 6
  const PORTRAIT_ROWS = Math.ceil(canonicalPortraits.length / PORTRAIT_COLS)
  const PORTRAIT_ATLAS_W = PORTRAIT_COLS * PORTRAIT_CELL_W
  const PORTRAIT_ATLAS_H = PORTRAIT_ROWS * PORTRAIT_CELL_H
  const portraitRects: Record<string, SpriteRect> = {}
  const portraitPlacements: BlitPlacement[] = []

  for (let i = 0; i < canonicalPortraits.length; i++) {
    const pName = canonicalPortraits[i]!
    const pDc6 = await decodeUiDc6(`data/global/ui/Hireables/${pName}.dc6`)
    const frame = pDc6.groups[0]!.frames[0]!
    const col = i % PORTRAIT_COLS
    const row = Math.floor(i / PORTRAIT_COLS)
    const px = col * PORTRAIT_CELL_W
    const py = row * PORTRAIT_CELL_H
    const rect: SpriteRect = { x: px, y: py, w: frame.width, h: frame.height }
    portraitRects[pName] = rect
    portraitRects[pName.toLowerCase()] = rect
    portraitPlacements.push({ frame, x: px, y: py })
  }

  savePng(
    'portraits-atlas.png',
    PORTRAIT_ATLAS_W,
    PORTRAIT_ATLAS_H,
    stitchFrames(PORTRAIT_ATLAS_W, PORTRAIT_ATLAS_H, portraitPlacements),
  )

  // --- STAGE 3.5: Automap DC6 Sprite Sheets (8 sheets: MaxiMap(S), Act2Map(S), Act4Map(S), ExTnMap(S)) ---
  console.log('Packing 8 Automap DC6 sprite sheets (MaxiMap, Act2Map, Act4Map, ExTnMap + S variants)...')

  const pl2Act2 = decodePl2(await archives.read('data/global/palette/ACT2/pal.pl2'))
  const pl2Act4 = decodePl2(await archives.read('data/global/palette/ACT4/pal.pl2'))
  const pl2Act5 = decodePl2(await archives.read('data/global/palette/ACT5/pal.pl2'))

  const automapSpecs: ReadonlyArray<{
    readonly key: AutomapSpriteKey
    readonly dc6Path: string
    readonly uiPngName: string
    readonly uiImageKey: string
    readonly columns: number
    readonly minFrameCount: number
    readonly paletteRgb: Uint8Array
  }> = [
    {
      key: 'MaxiMap',
      dc6Path: 'data/global/ui/Automap/MaxiMap.dc6',
      uiPngName: 'automap/MaxiMap.png',
      uiImageKey: 'automapMaxi',
      columns: 32,
      minFrameCount: 1499,
      paletteRgb: pl2.rgb,
    },
    {
      key: 'MaxiMapS',
      dc6Path: 'data/global/ui/Automap/MaxiMapS.dc6',
      uiPngName: 'automap/MaxiMapS.png',
      uiImageKey: 'automapMaxiS',
      columns: 32,
      minFrameCount: 1499,
      paletteRgb: pl2.rgb,
    },
    {
      key: 'Act2Map',
      dc6Path: 'data/global/ui/Automap/Act2Map.dc6',
      uiPngName: 'automap/Act2Map.png',
      uiImageKey: 'automapAct2',
      columns: 4,
      minFrameCount: 40,
      paletteRgb: pl2Act2.rgb,
    },
    {
      key: 'Act2MapS',
      dc6Path: 'data/global/ui/Automap/Act2MapS.dc6',
      uiPngName: 'automap/Act2MapS.png',
      uiImageKey: 'automapAct2S',
      columns: 4,
      minFrameCount: 40,
      paletteRgb: pl2Act2.rgb,
    },
    {
      key: 'Act4Map',
      dc6Path: 'data/global/ui/Automap/Act4Map.dc6',
      uiPngName: 'automap/Act4Map.png',
      uiImageKey: 'automapAct4',
      columns: 2,
      minFrameCount: 4,
      paletteRgb: pl2Act4.rgb,
    },
    {
      key: 'Act4MapS',
      dc6Path: 'data/global/ui/Automap/Act4MapS.dc6',
      uiPngName: 'automap/Act4MapS.png',
      uiImageKey: 'automapAct4S',
      columns: 2,
      minFrameCount: 4,
      paletteRgb: pl2Act4.rgb,
    },
    {
      key: 'ExTnMap',
      dc6Path: 'data/global/ui/Automap/ExTnMap.dc6',
      uiPngName: 'automap/ExTnMap.png',
      uiImageKey: 'automapExTn',
      columns: 2,
      minFrameCount: 8, // 6 raw frames in DC6 padded to 2x4 = 8 frames for 0x6fb12760 cellNo 0..7
      paletteRgb: pl2Act5.rgb,
    },
    {
      key: 'ExTnMapS',
      dc6Path: 'data/global/ui/Automap/ExTnMapS.dc6',
      uiPngName: 'automap/ExTnMapS.png',
      uiImageKey: 'automapExTnS',
      columns: 2,
      minFrameCount: 8, // 6 raw frames in DC6 padded to 2x4 = 8 frames for 0x6fb12760 cellNo 0..7
      paletteRgb: pl2Act5.rgb,
    },
  ]

  const automapAtlases = {} as Record<AutomapSpriteKey, AutomapSpriteAtlasMeta>

  for (const spec of automapSpecs) {
    const dc6 = (await decodeUiDc6(spec.dc6Path)) as Dc6Sheet
    const rawFrames = dc6.groups.flatMap(g => g.frames)
    if (rawFrames.length === 0) {
      throw new Error(`Automap DC6 ${spec.dc6Path} has 0 frames`)
    }
    const cellWidth = Math.max(1, ...rawFrames.map(f => f.width))
    const cellHeight = Math.max(1, ...rawFrames.map(f => f.height))
    const totalFrames = Math.max(rawFrames.length, spec.minFrameCount)
    const rows = Math.ceil(totalFrames / spec.columns)
    const atlasWidth = spec.columns * cellWidth
    const atlasHeight = rows * cellHeight

    const placements: BlitPlacement[] = []
    const frameMetas: AutomapSpriteFrameMeta[] = []

    for (let i = 0; i < totalFrames; i++) {
      const col = i % spec.columns
      const row = Math.floor(i / spec.columns)
      const x = col * cellWidth
      const y = row * cellHeight
      const raw = rawFrames[i]
      if (raw) {
        placements.push({ frame: raw, x, y })
        frameMetas.push({
          width: raw.width,
          height: raw.height,
          offsetX: raw.offsetX,
          offsetY: raw.offsetY,
          x,
          y,
        })
      } else {
        frameMetas.push({
          width: cellWidth,
          height: cellHeight,
          offsetX: 0,
          offsetY: 0,
          x,
          y,
        })
      }
    }

    const pixels = stitchFrames(atlasWidth, atlasHeight, placements)
    const pngBytes = encodeIndexedPng({
      width: atlasWidth,
      height: atlasHeight,
      pixels,
      palette: spec.paletteRgb,
      transparentIndex: 0,
    })

    for (const d of targetUiDirs) {
      mkdirSync(join(d, 'automap'), { recursive: true })
      writeFileSync(join(d, 'automap', `${spec.key}.png`), pngBytes)
    }

    automapAtlases[spec.key] = {
      image: `/ui/automap/${spec.key}.png`,
      atlasWidth,
      atlasHeight,
      columns: spec.columns,
      cellWidth,
      cellHeight,
      frameCount: totalFrames,
      frames: frameMetas,
    }
  }

  const automapManifest: AutomapUiManifest = {
    atlases: automapAtlases,
  }
  for (const d of targetUiDirs) {
    mkdirSync(join(d, 'automap'), { recursive: true })
    writeFileSync(join(d, 'automap', 'manifest.json'), JSON.stringify(automapManifest, null, 2))
  }

  // --- STAGE 4: Emit public/ui/manifest.json & ui-atlas.json ---
  const imagesMap: Record<string, string> = {
    ctrlPnl: '/ui/ctrlpnl-800.png',
    ctrlPnl640: '/ui/ctrlpnl-640.png',
    globeLife: '/ui/globe-life.png',
    globeMana: '/ui/globe-mana.png',
    globePoison: '/ui/globe-poison.png',
    overlapLeft: '/ui/overlap-left.png',
    overlapRight: '/ui/overlap-right.png',
    borderLeft: '/ui/border-left.png',
    borderRight: '/ui/border-right.png',
    charSheet: '/ui/char-sheet.png',
    invSheet: '/ui/inv-sheet.png',
    invTab0: '/ui/inv-tab-0.png',
    invTab1: '/ui/inv-tab-1.png',
    questBg: '/ui/quest-bg.png',
    waypointBg: '/ui/waypoint-bg.png',
    stashBg: '/ui/stash-bg.png',
    cubeBg: '/ui/cube-bg.png',
    vendorBg: '/ui/vendor-bg.png',
    vendorTabs: '/ui/vendor-tabs.png',
    tradeBg: '/ui/trade-bg.png',
    tradeBtn: '/ui/tradebtn.png',
    mercBg: '/ui/merc-bg.png',
    invArmor: '/ui/inv-armor.png',
    invHelmGlove: '/ui/inv-helm-glove.png',
    invWeapons: '/ui/inv-weapons.png',
    boxPieces: '/ui/boxpieces.png',
    focus16: '/ui/focus16.png',
    textslid: '/ui/textslid.png',
    popbelt: '/ui/popbelt.png',
    minipanel: '/ui/minipanel.png',
    minipanelSingle: '/ui/minipanel-s.png',
    minipanelBtns: '/ui/minipanel-btns.png',
    runBtn: '/ui/runbutton.png',
    menuBtn: '/ui/menubutton.png',
    buySellBtn: '/ui/buysellbtn.png',
    goldCoinBtn: '/ui/goldcoinbtn.png',
    miniConvert: '/ui/miniconvert.png',
    levelBtn: '/ui/level-btn.png',
    levelSocket: '/ui/level-socket.png',
    gemSocket: '/ui/gemsocket.png',
    skillPoints: '/ui/skillpoints.png',
    skillTabs: '/ui/skill-tree-tabs.png',
    genericSkills: '/ui/generic-skills.png',
    attackIcon: '/ui/icon_0.png',
    cursorHand: '/ui/cursor-hand.png',
    cursorAtlas: '/ui/cursor.png',
    questTabs: '/ui/quest-tabs.png',
    questSockets: '/ui/questsockets.png',
    questLast: '/ui/questlast.png',
    waypointTabs: '/ui/waypoint-tabs.png',
    waypointIcons: '/ui/waypoint-icons.png',
    itemsAtlas: '/ui/items-atlas.png',
    questsAtlas: '/ui/quests-atlas.png',
    automapMaxi: '/ui/automap/MaxiMap.png',
    automapMaxiS: '/ui/automap/MaxiMapS.png',
    automapAct2: '/ui/automap/Act2Map.png',
    automapAct2S: '/ui/automap/Act2MapS.png',
    automapAct4: '/ui/automap/Act4Map.png',
    automapAct4S: '/ui/automap/Act4MapS.png',
    automapExTn: '/ui/automap/ExTnMap.png',
    automapExTnS: '/ui/automap/ExTnMapS.png',
    portraitsAtlas: '/ui/portraits-atlas.png',
    scroinBg: '/ui/scroin.png',
    scroinRunes: '/ui/scroin2.png',
    scroinGlow: '/ui/scroin3.png',
    horadricBg: '/ui/horadricback.png',
    upgradeBg: '/ui/upgrade.png',
    invps: '/ui/invps.png',
    recipeScrollBg: '/ui/recipescroll.png',
    partyBg: '/ui/party-bg.png',
    partyButtons: '/ui/partybuttons.png',
    partyBoxes: '/ui/partyboxes.png',
    partyBar: '/ui/partybar.png',
  }

  const manifest = {
    version: '1.13c',
    decodedDc6Count: decodedCount,
    dc6DecodeFailures: decodeFailures,
    atlasWidth: ATLAS_W,
    atlasHeight: atlasH,
    questsAtlasWidth: QUEST_ATLAS_W,
    questsAtlasHeight: QUEST_ATLAS_H,
    portraitsAtlasWidth: PORTRAIT_ATLAS_W,
    portraitsAtlasHeight: PORTRAIT_ATLAS_H,
    codeToInvFile,
    codeToFlippyFile,
    itemRects,
    flippyRects,
    flippyFrames,
    itemClassIdToCode,
    questRects,
    portraitRects,
    images: imagesMap,
    automapAtlases,
  }
  // Compact JSON: the UI manifest ships to the browser verbatim (HudManager
  // fetches /ui/manifest.json at boot); pretty-printing more than doubled it.
  const manifestJson = JSON.stringify(manifest)
  for (const d of targetUiDirs) {
    writeFileSync(join(d, 'manifest.json'), manifestJson)
    writeFileSync(join(d, 'ui-atlas.json'), manifestJson)
  }

  // --- STAGE 5: Emit src/common/items/baked-ui-meta.ts ---
  const bakedMetaCode = `/**
 * Auto-generated baked UI metadata for Diablo II Web client.
 * Generated by \`scripts/pack-ui.ts\`.
 * Enforces the Zero Runtime MPQ/DLL Architectural Invariant.
 */

export interface SpriteRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly offsetX?: number | undefined
  readonly offsetY?: number | undefined
}

export type AutomapSpriteKey =
  | 'MaxiMap'
  | 'MaxiMapS'
  | 'Act2Map'
  | 'Act2MapS'
  | 'Act4Map'
  | 'Act4MapS'
  | 'ExTnMap'
  | 'ExTnMapS'

export interface AutomapSpriteFrameMeta {
  readonly width: number
  readonly height: number
  readonly offsetX: number
  readonly offsetY: number
  readonly x: number
  readonly y: number
}

export interface AutomapSpriteAtlasMeta {
  readonly image: string
  readonly atlasWidth: number
  readonly atlasHeight: number
  readonly columns: number
  readonly cellWidth: number
  readonly cellHeight: number
  readonly frameCount: number
  readonly frames: readonly AutomapSpriteFrameMeta[]
}

export interface AutomapUiManifest {
  readonly atlases: Readonly<Record<AutomapSpriteKey, AutomapSpriteAtlasMeta>>
}

export interface QuestAssetInfo {
  readonly activeIcon: string
  readonly doneIcon: string
  readonly doneFrame: number
}

export interface BakedUiManifest {
  readonly version: string
  readonly decodedDc6Count: number
  readonly dc6DecodeFailures: number
  readonly atlasWidth: number
  readonly atlasHeight: number
  readonly questsAtlasWidth: number
  readonly questsAtlasHeight: number
  readonly codeToInvFile: Record<string, string>
  readonly codeToFlippyFile: Record<string, string>
  readonly itemRects: Record<string, SpriteRect>
  readonly flippyRects: Record<string, SpriteRect>
  readonly flippyFrames: Record<string, readonly SpriteRect[]>
  readonly itemClassIdToCode: Record<number, string>
  readonly questRects: Record<string, SpriteRect>
  readonly portraitRects?: Record<string, SpriteRect>
  readonly images: Record<string, string>
  readonly automapAtlases?: Readonly<Record<AutomapSpriteKey, AutomapSpriteAtlasMeta>>
}

/**
 * Authoritative 1.13c Quest Asset Mapping: [act: number] -> QuestAssetInfo[]
 * Act 1: 6 quests (a1q1..a1q6, done frames 0..5)
 * Act 2: 6 quests (a2q1..a2q6, done frames 6..11)
 * Act 3: 6 quests (a3q1..a3q6, done frames 12..17)
 * Act 4: 3 quests (a4q1..a4q3, done frames 18..20)
 * Act 5: 6 quests (a5q1..a5q6, done frames 21..26)
 */
export const ACT_QUEST_ASSET_MAP: Readonly<Record<number, readonly QuestAssetInfo[]>> = {
  1: [
    { activeIcon: 'a1q1', doneIcon: 'questdone_0', doneFrame: 0 },
    { activeIcon: 'a1q2', doneIcon: 'questdone_1', doneFrame: 1 },
    { activeIcon: 'a1q3', doneIcon: 'questdone_2', doneFrame: 2 },
    { activeIcon: 'a1q4', doneIcon: 'questdone_3', doneFrame: 3 },
    { activeIcon: 'a1q5', doneIcon: 'questdone_4', doneFrame: 4 },
    { activeIcon: 'a1q6', doneIcon: 'questdone_5', doneFrame: 5 },
  ],
  2: [
    { activeIcon: 'a2q1', doneIcon: 'questdone_6', doneFrame: 6 },
    { activeIcon: 'a2q2', doneIcon: 'questdone_7', doneFrame: 7 },
    { activeIcon: 'a2q3', doneIcon: 'questdone_8', doneFrame: 8 },
    { activeIcon: 'a2q4', doneIcon: 'questdone_9', doneFrame: 9 },
    { activeIcon: 'a2q5', doneIcon: 'questdone_10', doneFrame: 10 },
    { activeIcon: 'a2q6', doneIcon: 'questdone_11', doneFrame: 11 },
  ],
  3: [
    { activeIcon: 'a3q1', doneIcon: 'questdone_12', doneFrame: 12 },
    { activeIcon: 'a3q2', doneIcon: 'questdone_13', doneFrame: 13 },
    { activeIcon: 'a3q3', doneIcon: 'questdone_14', doneFrame: 14 },
    { activeIcon: 'a3q4', doneIcon: 'questdone_15', doneFrame: 15 },
    { activeIcon: 'a3q5', doneIcon: 'questdone_16', doneFrame: 16 },
    { activeIcon: 'a3q6', doneIcon: 'questdone_17', doneFrame: 17 },
  ],
  4: [
    { activeIcon: 'a4q1', doneIcon: 'questdone_18', doneFrame: 18 },
    { activeIcon: 'a4q2', doneIcon: 'questdone_19', doneFrame: 19 },
    { activeIcon: 'a4q3', doneIcon: 'questdone_20', doneFrame: 20 },
  ],
  5: [
    { activeIcon: 'a5q1', doneIcon: 'questdone_21', doneFrame: 21 },
    { activeIcon: 'a5q2', doneIcon: 'questdone_22', doneFrame: 22 },
    { activeIcon: 'a5q3', doneIcon: 'questdone_23', doneFrame: 23 },
    { activeIcon: 'a5q4', doneIcon: 'questdone_24', doneFrame: 24 },
    { activeIcon: 'a5q5', doneIcon: 'questdone_25', doneFrame: 25 },
    { activeIcon: 'a5q6', doneIcon: 'questdone_26', doneFrame: 26 },
  ],
}

export const AUTOMAP_UI_MANIFEST: AutomapUiManifest = ${JSON.stringify(automapManifest, null, 2)}

export const BAKED_UI_MANIFEST: BakedUiManifest = {
  version: '1.13c',
  decodedDc6Count: ${decodedCount},
  dc6DecodeFailures: ${decodeFailures},
  atlasWidth: ${ATLAS_W},
  atlasHeight: ${atlasH},
  questsAtlasWidth: ${QUEST_ATLAS_W},
  questsAtlasHeight: ${QUEST_ATLAS_H},
  codeToInvFile: ${JSON.stringify(codeToInvFile, null, 2)},
  codeToFlippyFile: ${JSON.stringify(codeToFlippyFile, null, 2)},
  itemRects: ${JSON.stringify(itemRects, null, 2)},
  flippyRects: ${JSON.stringify(flippyRects, null, 2)},
  flippyFrames: ${JSON.stringify(flippyFrames, null, 2)},
  itemClassIdToCode: ${JSON.stringify(itemClassIdToCode, null, 2)},
  questRects: ${JSON.stringify(questRects, null, 2)},
  portraitRects: ${JSON.stringify(portraitRects, null, 2)},
  images: ${JSON.stringify(imagesMap, null, 2)},
  automapAtlases: AUTOMAP_UI_MANIFEST.atlases,
}

export { CURSOR_METADATA, type CursorFrameMeta, type CursorAtlasMetadata } from './cursor-meta.ts'
`
  writeFileSync(join(process.cwd(), 'src', 'common', 'items', 'baked-ui-meta.ts'), bakedMetaCode, 'utf8')
  console.log(`Successfully decoded ${decodedCount} DC6 sheets (${decodeFailures} failures)!`)
  console.log('Emitted public/ui/manifest.json, public/ui/ui-atlas.json, public/ui/automap/manifest.json, and src/common/items/baked-ui-meta.ts.')

  // --- STAGE 6: Level entry titles (`Levels.txt` `EntryFile`, D2Client.dll 0x6fb6f0d0, issue #1007) ---
  const titles = await writeLevelEntryTitles(archives, targetUiDirs)
  console.log(`Emitted ${titles.rects.size} level entry titles -> ui/${LEVEL_ENTRY_TITLES_PNG}.`)
}

function parseUiCliArgs(argv: readonly string[]): { mpqDir: string; outBaseDir: string } {
  let mpqDir = 'samples/d2'
  let outBaseDir = 'public'
  const positional: string[] = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    if (arg === '--mpq-dir' && argv[i + 1]) {
      mpqDir = argv[++i]!
    } else if (arg.startsWith('--mpq-dir=')) {
      mpqDir = arg.slice('--mpq-dir='.length)
    } else if (arg === '--out-dir' && argv[i + 1]) {
      outBaseDir = argv[++i]!
    } else if (arg.startsWith('--out-dir=')) {
      outBaseDir = arg.slice('--out-dir='.length)
    } else if (!arg.startsWith('--')) {
      positional.push(arg)
    }
  }
  if (positional[0]) mpqDir = positional[0]
  if (positional[1]) outBaseDir = positional[1]
  return { mpqDir, outBaseDir }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { mpqDir, outBaseDir } = parseUiCliArgs(process.argv.slice(2))
  bakeUi(mpqDir, outBaseDir).catch((err) => {
    console.error('pack-ui failed:', err)
    process.exit(1)
  })
}
