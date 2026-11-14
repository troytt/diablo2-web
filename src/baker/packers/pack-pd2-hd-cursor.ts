/**
 * PD2 HD Cursor Packer.
 *
 * Copies D2GL's HD cursor sheets (`<pd2Dir>/Data/assets/textures/cursor/{hand,other}.png`, see
 * `src/common/ui/pd2-hd-cursor.ts`) into `public/cursor-pd2/` after checking their size against the
 * frame counts D2GL loads them with, and writes a `manifest.json` with the frame rects, hotspot and
 * draw size. 1.13c keeps its DC6 cursor (`npm run bake -- cursor`).
 *
 * Usage: npm run bake -- pd2-hd-cursor   (or: tsx src/baker/packers/pack-pd2-hd-cursor.ts)
 */

import { homedir } from 'node:os'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  HD_CURSOR_DRAW_SIZE,
  HD_CURSOR_IDLE_STEP_MS,
  HD_CURSOR_OFFSET,
  PD2_HD_CURSOR_FILES,
  sliceHdCursorStrip,
} from '../../common/ui/pd2-hd-cursor.ts'
import { PD2_D2GL_FONT_FILES } from '../../common/ui/pd2-d2gl.ts'

function resolveDefaultNodePd2Dir(): string {
  if (process.env.PD2_DATA_DIR && existsSync(process.env.PD2_DATA_DIR)) {
    return process.env.PD2_DATA_DIR
  }
  const candidates = [
    'samples/pd2',
    join(homedir(), 'pd2-data'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return process.env.PD2_DATA_DIR ?? join(homedir(), 'pd2-data')
}

export const DEFAULT_NODE_PD2_DIR = resolveDefaultNodePd2Dir()

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Width and height from a PNG's IHDR chunk. */
export function readPngSize(bytes: Uint8Array): { readonly width: number; readonly height: number } {
  if (bytes.length < 24 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error('not a PNG file')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const type = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!)
  if (type !== 'IHDR') throw new Error(`PNG first chunk is ${type}, expected IHDR`)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

export function bakePd2HdCursor(projectRoot: string = process.cwd(), pd2Dir: string = DEFAULT_NODE_PD2_DIR): number {
  const outDir = join(projectRoot, 'public', 'cursor-pd2')
  mkdirSync(outDir, { recursive: true })
  const sheets: Record<string, unknown> = {}
  for (const [key, spec] of Object.entries(PD2_HD_CURSOR_FILES)) {
    const src = join(pd2Dir, spec.path)
    const { width, height } = readPngSize(readFileSync(src))
    const rects = sliceHdCursorStrip(width, height, spec.frames)
    copyFileSync(src, join(outDir, `${key}.png`))
    sheets[key] = { image: `/cursor-pd2/${key}.png`, source: spec.path, width, height, frames: rects }
    console.log(`[PD2 HD Cursor Packer] ${key}: ${String(width)}x${String(height)}, ${String(spec.frames)} frames`)
  }
  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(
      { schema: 1, mode: 'pd2', drawSize: HD_CURSOR_DRAW_SIZE, offset: HD_CURSOR_OFFSET, idleStepMs: HD_CURSOR_IDLE_STEP_MS, sheets },
      null,
      2,
    ),
  )

  const srcLut = join(pd2Dir, 'Data', 'assets', 'textures', 'lut.png')
  if (existsSync(srcLut)) {
    const uiPd2Dir = join(projectRoot, 'public', 'ui-pd2')
    mkdirSync(uiPd2Dir, { recursive: true })
    copyFileSync(srcLut, join(uiPd2Dir, 'lut.png'))
  }
  const fontsOutDir = join(projectRoot, 'public', 'ui', 'fonts')
  mkdirSync(fontsOutDir, { recursive: true })
  for (const fontSpec of Object.values(PD2_D2GL_FONT_FILES)) {
    const srcFont = join(pd2Dir, fontSpec.path)
    const dstFont = join(projectRoot, 'public', fontSpec.url.replace(/^\//, ''))
    if (existsSync(srcFont)) {
      copyFileSync(srcFont, dstFont)
    }
  }

  return Object.keys(sheets).length
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const n = bakePd2HdCursor()
    console.log(`[PD2 HD Cursor Packer] baked ${String(n)} sheets into public/cursor-pd2/`)
  } catch (err) {
    console.error('[PD2 HD Cursor Packer] Failed:', err)
    process.exitCode = 1
  }
}
