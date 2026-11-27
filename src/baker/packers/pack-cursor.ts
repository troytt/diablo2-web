/**
 * scripts/pack-cursor.ts
 *
 * Extracts authentic Diablo II v1.13c cursor DC6 assets from d2data.mpq:
 * - protate.dc6 (8 frames: pointing hand swaying animation, CursorId 5)
 * - ohand.dc6 (8 frames: finger-to-palm opening transition, CursorId 2)
 * - orotate.dc6 (8 frames: open palm swaying idle animation, CursorId 3)
 * - buysell.dc6 (10 frames: Identify=0, Repair=1, Buy=3, Sell=4, etc., CursorId 6 at 0x6fba8558)
 *
 * Packs all 34 frames into public/ui/cursor.png with metadata in src/ui/cursor-meta.ts.
 * Enforces Zero Runtime MPQ/DLL Architectural Invariant.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { decodeDc6, type Dc6Frame } from '../../common/formats/dc6.ts'
import { decodePl2 } from '../../common/formats/pl2.ts'
import { encodeIndexedPng } from '../io/png.ts'

export interface CursorFrameMeta {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly offsetX: number
  readonly offsetY: number
  readonly hotspotX: number
  readonly hotspotY: number
}

export const BUYSELL_CURSOR_FRAMES = {
  identify: 0,
  repair: 1,
  buy: 3,
  sell: 4,
} as const

export type BuySellCursorMode = keyof typeof BUYSELL_CURSOR_FRAMES

export interface CursorAtlasMetadata {
  readonly atlasWidth: number
  readonly atlasHeight: number
  readonly frameWidth: number
  readonly frameHeight: number
  readonly buysellFrameHeight: number
  readonly protate: readonly CursorFrameMeta[]
  readonly ohand: readonly CursorFrameMeta[]
  readonly orotate: readonly CursorFrameMeta[]
  readonly buysell: readonly CursorFrameMeta[]
  readonly frames: Record<string, CursorFrameMeta>
}

export async function packCursorAssets(projectRoot: string = process.cwd()): Promise<CursorAtlasMetadata> {
  const mpqPath = join(projectRoot, 'samples', 'd2', 'd2data.mpq')
  const mpq = await MpqArchive.open(await fileSource(mpqPath))

  const palFile = mpq.find('data/global/palette/ACT1/pal.pl2')
  if (!palFile) throw new Error('data/global/palette/ACT1/pal.pl2 not found in d2data.mpq')
  const pl2 = decodePl2(await mpq.read(palFile))

  const animNames = ['protate', 'ohand', 'orotate'] as const
  const decodedSheets: Record<string, readonly Dc6Frame[]> = {}

  for (const name of animNames) {
    const file = mpq.find(`data/global/ui/CURSOR/${name}.dc6`)
    if (!file) throw new Error(`Cursor DC6 not found: data/global/ui/CURSOR/${name}.dc6`)
    const sheet = decodeDc6(await mpq.read(file))
    const frames = sheet.groups[0]?.frames ?? []
    if (frames.length !== 8) {
      throw new Error(`Expected 8 frames in ${name}.dc6, got ${frames.length}`)
    }
    decodedSheets[name] = frames
  }

  const buysellFile = mpq.find('data/global/ui/CURSOR/buysell.dc6')
  if (!buysellFile) throw new Error('Cursor DC6 not found: data/global/ui/CURSOR/buysell.dc6')
  const buysellSheet = decodeDc6(await mpq.read(buysellFile))
  const buysellFrames = buysellSheet.groups[0]?.frames ?? []
  if (buysellFrames.length !== 10) {
    throw new Error(`Expected 10 frames in buysell.dc6, got ${buysellFrames.length}`)
  }

  // Layout:
  // - Rows 0..2 (y = 0..95): 3 hand animations (protate, ohand, orotate), 8 columns x 32x32
  // - Rows 3..4 (y = 96..175): buysell.dc6 10 frames (frames 0..7 at y=96, frames 8..9 at y=136), 32x40 cells
  const CELL_W = 32
  const CELL_H = 32
  const BUYSELL_CELL_H = 40
  const COLS = 8
  const HAND_ROWS = 3
  const BUYSELL_ROWS = 2
  const atlasWidth = CELL_W * COLS // 256
  const atlasHeight = CELL_H * HAND_ROWS + BUYSELL_CELL_H * BUYSELL_ROWS // 96 + 80 = 176
  const pixels = new Uint8Array(atlasWidth * atlasHeight)

  const metaLists: Record<string, CursorFrameMeta[]> = {
    protate: [],
    ohand: [],
    orotate: [],
    buysell: [],
  }
  const allFrames: Record<string, CursorFrameMeta> = {}

  animNames.forEach((anim, row) => {
    const frames = decodedSheets[anim]!
    frames.forEach((frame, col) => {
      const dstX = col * CELL_W
      const dstY = row * CELL_H

      // Blit frame pixels into atlas
      for (let sy = 0; sy < frame.height; sy++) {
        const ty = dstY + sy
        for (let sx = 0; sx < frame.width; sx++) {
          const tx = dstX + sx
          const srcIdx = sy * frame.width + sx
          if (frame.mask[srcIdx] !== 0) {
            const color = frame.indices[srcIdx] ?? 0
            if (color !== 0) {
              pixels[ty * atlasWidth + tx] = color
            }
          }
        }
      }

      // Hotspot calculation:
      // In D2 DC6 coordinates, pointing finger tip is at col 0, row 0 of frame 0.
      // For protate (offsetX = -1), the tip is at (0, 0).
      // When palm spreads in ohand/orotate (offsetX = -2), the anchor shifts left 1px.
      const hotspotX = anim === 'protate' ? 0 : Math.max(0, -frame.offsetX - 1)
      const hotspotY = 0

      const frameMeta: CursorFrameMeta = {
        x: dstX,
        y: dstY,
        w: frame.width,
        h: frame.height,
        offsetX: frame.offsetX,
        offsetY: frame.offsetY,
        hotspotX,
        hotspotY,
      }

      metaLists[anim]!.push(frameMeta)
      allFrames[`${anim}_${col}`] = frameMeta
    })
  })

  // Blit buysell.dc6 (10 frames of 32x40)
  const buysellBaseY = CELL_H * HAND_ROWS // 96
  buysellFrames.forEach((frame, idx) => {
    const col = idx % COLS
    const row = Math.floor(idx / COLS)
    const dstX = col * CELL_W
    const dstY = buysellBaseY + row * BUYSELL_CELL_H

    for (let sy = 0; sy < frame.height; sy++) {
      const ty = dstY + sy
      for (let sx = 0; sx < frame.width; sx++) {
        const tx = dstX + sx
        const srcIdx = sy * frame.width + sx
        if (frame.mask[srcIdx] !== 0) {
          const color = frame.indices[srcIdx] ?? 0
          if (color !== 0) {
            pixels[ty * atlasWidth + tx] = color
          }
        }
      }
    }

    const frameMeta: CursorFrameMeta = {
      x: dstX,
      y: dstY,
      w: frame.width,
      h: frame.height,
      offsetX: frame.offsetX,
      offsetY: frame.offsetY,
      hotspotX: 0,
      hotspotY: 0,
    }

    metaLists.buysell!.push(frameMeta)
    allFrames[`buysell_${idx}`] = frameMeta
  })

  const atlasMeta: CursorAtlasMetadata = {
    atlasWidth,
    atlasHeight,
    frameWidth: CELL_W,
    frameHeight: CELL_H,
    buysellFrameHeight: BUYSELL_CELL_H,
    protate: metaLists.protate!,
    ohand: metaLists.ohand!,
    orotate: metaLists.orotate!,
    buysell: metaLists.buysell!,
    frames: allFrames,
  }

  // Save public/ui/cursor.png
  const outDir = join(projectRoot, 'public', 'ui')
  mkdirSync(outDir, { recursive: true })
  const pngData = encodeIndexedPng({
    width: atlasWidth,
    height: atlasHeight,
    pixels,
    palette: pl2.rgb,
    transparentIndex: 0,
  })
  writeFileSync(join(outDir, 'cursor.png'), pngData)

  // Save src/ui/cursor-meta.ts
  const metaCode = `/**
 * Authentic Diablo II v1.13c Cursor Atlas Metadata.
 * Auto-generated by scripts/pack-cursor.ts.
 * Enforces Zero Runtime MPQ/DLL Architectural Invariant.
 */

export interface CursorFrameMeta {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly offsetX: number
  readonly offsetY: number
  readonly hotspotX: number
  readonly hotspotY: number
}

/**
 * D2Client.dll v1.13c \`buysell.dc6\` cursor frame indices (\`0x6fac62c0\` / \`0x6fbbb238\` +0x10):
 * - Frame 0: Identify target cursor (\`0x6fb36fb7\` / packet \`0x3f\`)
 * - Frame 1: Repair anvil/hammer cursor (\`0x6fb3ba70\`, \`nTradeMode = 4\`)
 * - Frame 3: Buy coin/hand cursor (\`0x6fb3ba30\`, \`nTradeMode = 2\`)
 * - Frame 4: Sell coin/hand cursor (\`0x6fb3b9f0\`, \`nTradeMode = 3\`)
 */
export const BUYSELL_CURSOR_FRAMES = {
  identify: 0,
  repair: 1,
  buy: 3,
  sell: 4,
} as const

export type BuySellCursorMode = keyof typeof BUYSELL_CURSOR_FRAMES

export interface CursorAtlasMetadata {
  readonly atlasWidth: number
  readonly atlasHeight: number
  readonly frameWidth: number
  readonly frameHeight: number
  readonly buysellFrameHeight: number
  readonly protate: readonly CursorFrameMeta[]
  readonly ohand: readonly CursorFrameMeta[]
  readonly orotate: readonly CursorFrameMeta[]
  readonly buysell: readonly CursorFrameMeta[]
  readonly frames: Record<string, CursorFrameMeta>
}

export const CURSOR_METADATA: CursorAtlasMetadata = ${JSON.stringify(atlasMeta, null, 2)} as const
`
  writeFileSync(join(projectRoot, 'src', 'common', 'items', 'cursor-meta.ts'), metaCode, 'utf8')
  console.log(`Extracted 34 authentic cursor frames (24 hand + 10 buysell) -> public/ui/cursor.png (${atlasWidth}x${atlasHeight})`)
  console.log('Saved metadata to src/common/items/cursor-meta.ts')

  return atlasMeta
}

if (process.argv[1]?.endsWith('pack-cursor.ts')) {
  packCursorAssets()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('pack-cursor failed:', err)
      process.exit(1)
    })
}
