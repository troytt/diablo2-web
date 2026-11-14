/**
 * Dynamic Inventory Icon Palette Dyer (`InvTrans` + `Colors.txt`).
 *
 * Implements the authentic Diablo II 1.13c / PD2 `D2CMP` palette index remapping
 * for Magic, Rare, Crafted, Socketed, Set, and Unique inventory icons (`invtransform`)
 * at runtime on an expandable offscreen Canvas shelf, caching the resulting `SpriteRect`
 * directly inside `itemRects[${invFile}_${colorCode}]`.
 */

import type { SpriteRect } from './baked-ui-meta.ts'
import {
  ACT1_PALETTE_RGB_B64,
  BASE_INV_FILE_TO_INV_TRANS,
  CODE_TO_INV_TRANS,
  COLOR_CODE_TO_ROW,
  INV_TRANS_DAT_B64,
} from './item-inv-trans-data.ts'

export const DYNAMIC_ATLAS_SHELF_HEIGHT = 1024
const SHELF_PAD = 2

export interface DynamicImageDataLike {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
}

export interface DynamicCanvasContext2DLike {
  drawImage(image: unknown, dx: number, dy: number): void
  getImageData(sx: number, sy: number, sw: number, sh: number): DynamicImageDataLike
  putImageData(imageData: DynamicImageDataLike, dx: number, dy: number): void
}

export interface DynamicCanvasLike {
  width: number
  height: number
  src?: string
  complete?: boolean
  naturalWidth?: number
  naturalHeight?: number
  __dynamicItemsAtlas?: boolean
  getContext(contextId: '2d', options?: { willReadFrequently?: boolean }): DynamicCanvasContext2DLike | null
}

export interface DynamicImageSourceLike {
  readonly width?: number
  readonly height?: number
  readonly naturalWidth?: number
  readonly naturalHeight?: number
  readonly src?: string
  readonly complete?: boolean
  readonly __dynamicItemsAtlas?: boolean
  readonly ownerDocument?: { createElement?: (tagName: string) => DynamicCanvasLike } | null
}

let cachedAct1PaletteRgb: Uint8Array | null = null
let cachedRgbToPalIdx: Map<number, number> | null = null
const cachedInvTransTables = new Map<number, Uint8Array>()

const B64_LOOKUP = /* @__PURE__ */ (() => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const table = new Uint8Array(128)
  for (let i = 0; i < chars.length; i++) {
    table[chars.charCodeAt(i)] = i
  }
  return table
})()

function decodeBase64(b64: string): Uint8Array {
  let len = b64.length
  while (len > 0 && b64.charCodeAt(len - 1) === 61 /* '=' */) {
    len--
  }
  const outLen = Math.floor((len * 3) / 4)
  const out = new Uint8Array(outLen)
  let outIdx = 0
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_LOOKUP[b64.charCodeAt(i)] ?? 0
    const c1 = i + 1 < len ? (B64_LOOKUP[b64.charCodeAt(i + 1)] ?? 0) : 0
    const c2 = i + 2 < len ? (B64_LOOKUP[b64.charCodeAt(i + 2)] ?? 0) : 0
    const c3 = i + 3 < len ? (B64_LOOKUP[b64.charCodeAt(i + 3)] ?? 0) : 0
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3
    if (outIdx < outLen) out[outIdx++] = (triple >> 16) & 0xff
    if (outIdx < outLen) out[outIdx++] = (triple >> 8) & 0xff
    if (outIdx < outLen) out[outIdx++] = triple & 0xff
  }
  return out
}

export function getAct1PaletteRgb(): Uint8Array {
  if (!cachedAct1PaletteRgb) {
    cachedAct1PaletteRgb = decodeBase64(ACT1_PALETTE_RGB_B64)
  }
  return cachedAct1PaletteRgb
}

function getRgbToPaletteIndexMap(): Map<number, number> {
  if (!cachedRgbToPalIdx) {
    const pal = getAct1PaletteRgb()
    const map = new Map<number, number>()
    for (let i = 1; i < 256; i++) {
      const r = pal[i * 3]!
      const g = pal[i * 3 + 1]!
      const b = pal[i * 3 + 2]!
      const key = (r << 16) | (g << 8) | b
      if (!map.has(key)) {
        map.set(key, i)
      }
    }
    cachedRgbToPalIdx = map
  }
  return cachedRgbToPalIdx
}

function findPaletteIndexForRgb(r: number, g: number, b: number): number {
  const map = getRgbToPaletteIndexMap()
  const exact = map.get((r << 16) | (g << 8) | b)
  if (exact !== undefined) return exact

  const pal = getAct1PaletteRgb()
  let bestIdx = 1
  let bestDist = Infinity
  for (let i = 1; i < 256; i++) {
    const dr = r - pal[i * 3]!
    const dg = g - pal[i * 3 + 1]!
    const db = b - pal[i * 3 + 2]!
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
      if (dist === 0) break
    }
  }
  return bestIdx
}

export function getInvTransTable(invTrans: number): Uint8Array | null {
  let table = cachedInvTransTables.get(invTrans)
  if (table) return table
  const b64 = INV_TRANS_DAT_B64[invTrans]
  if (!b64) return null
  table = decodeBase64(b64)
  cachedInvTransTables.set(invTrans, table)
  return table
}

export function getInvTransRowTable(invTrans: number, colorCode: string): Uint8Array | null {
  const row = COLOR_CODE_TO_ROW[colorCode.trim().toLowerCase()]
  if (row === undefined) return null
  const table = getInvTransTable(invTrans)
  if (!table || (row + 1) * 256 > table.length) return null
  return table.subarray(row * 256, (row + 1) * 256)
}

/**
 * Resolves the `InvTrans` palette table index (`0`, `1`, `2`, `5`, `6`, `7`, `8`) for a base item.
 * Returns `0` when the base item does not allow inventory icon dyeing (`InvTrans == 0`).
 */
export function resolveItemInvTrans(baseInvFile: string, itemCode?: string): number {
  const invKey = baseInvFile.trim().toLowerCase()
  const byInv = BASE_INV_FILE_TO_INV_TRANS[invKey]
  if (!byInv) return 0
  if (itemCode) {
    const codeKey = itemCode.trim().toLowerCase()
    if (codeKey in CODE_TO_INV_TRANS) {
      return CODE_TO_INV_TRANS[codeKey]!
    }
  }
  return byInv
}

/**
 * Applies the 1.13c / PD2 `InvTrans` palette remap for `colorCode` to RGBA pixel bytes.
 * Transparent pixels (`alpha === 0`) are preserved unchanged.
 */
export function applyInvTransToRgbaPixels(
  rgba: Uint8ClampedArray | Uint8Array,
  invTrans: number,
  colorCode: string,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba)
  const rowTable = getInvTransRowTable(invTrans, colorCode)
  if (!rowTable) return out
  const pal = getAct1PaletteRgb()

  for (let i = 0; i + 3 < out.length; i += 4) {
    const a = out[i + 3]!
    if (a === 0) continue
    const r = out[i]!
    const g = out[i + 1]!
    const b = out[i + 2]!
    const srcIdx = findPaletteIndexForRgb(r, g, b)
    const dstIdx = rowTable[srcIdx]!
    out[i] = pal[dstIdx * 3]!
    out[i + 1] = pal[dstIdx * 3 + 1]!
    out[i + 2] = pal[dstIdx * 3 + 2]!
  }
  return out
}

interface DynamicDyeJob {
  readonly dyedKey: string
  readonly baseKey: string
  readonly baseRect: SpriteRect
  readonly targetRect: SpriteRect
  readonly invTrans: number
  readonly colorCode: string
}

interface DynamicShelfState {
  readonly baseWidth: number
  readonly baseHeight: number
  cursorX: number
  cursorY: number
  rowHeight: number
  readonly jobs: Map<string, DynamicDyeJob>
  readonly canvases: Set<DynamicCanvasLike>
  readonly syncedRectMaps: Set<Record<string, SpriteRect>>
}

const shelvesByDimensions = new Map<string, DynamicShelfState>()
const shelvesByRectMap = new WeakMap<Readonly<Record<string, SpriteRect>>, DynamicShelfState>()

function inferAtlasDimensions(
  itemRects: Readonly<Record<string, SpriteRect>>,
  explicitWidth?: number,
  explicitHeight?: number,
): { width: number; height: number } {
  if (
    typeof explicitWidth === 'number' &&
    explicitWidth > 0 &&
    typeof explicitHeight === 'number' &&
    explicitHeight > 0
  ) {
    return { width: explicitWidth, height: explicitHeight }
  }
  if ('invwss' in itemRects || 'invimma' in itemRects) {
    return { width: 4096, height: 4775 }
  }
  return { width: 2048, height: 7862 }
}

function getOrCreateShelf(
  itemRects: Readonly<Record<string, SpriteRect>>,
  explicitWidth?: number,
  explicitHeight?: number,
): DynamicShelfState {
  const existingByMap = shelvesByRectMap.get(itemRects)
  if (existingByMap) {
    existingByMap.syncedRectMaps.add(itemRects as Record<string, SpriteRect>)
    return existingByMap
  }
  const { width, height } = inferAtlasDimensions(itemRects, explicitWidth, explicitHeight)
  const key = `${width}x${height}`
  let shelf = shelvesByDimensions.get(key)
  if (!shelf) {
    shelf = {
      baseWidth: width,
      baseHeight: height,
      cursorX: SHELF_PAD,
      cursorY: height + SHELF_PAD,
      rowHeight: 0,
      jobs: new Map(),
      canvases: new Set(),
      syncedRectMaps: new Set(),
    }
    shelvesByDimensions.set(key, shelf)
  }
  shelf.syncedRectMaps.add(itemRects as Record<string, SpriteRect>)
  shelvesByRectMap.set(itemRects, shelf)
  return shelf
}

function renderDyeJobToCanvas(canvas: DynamicCanvasLike, job: DynamicDyeJob): void {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) ?? canvas.getContext('2d')
    if (!ctx || typeof ctx.getImageData !== 'function' || typeof ctx.putImageData !== 'function') {
      return
    }
    const { baseRect, targetRect, invTrans, colorCode } = job
    if (baseRect.w <= 0 || baseRect.h <= 0) return
    const srcData = ctx.getImageData(baseRect.x, baseRect.y, baseRect.w, baseRect.h)
    const dyedPixels = applyInvTransToRgbaPixels(srcData.data, invTrans, colorCode)
    const g = globalThis as {
      ImageData?: new (data: Uint8ClampedArray, sw: number, sh?: number) => DynamicImageDataLike
    }
    const outData =
      typeof g.ImageData === 'function'
        ? new g.ImageData(new Uint8ClampedArray(dyedPixels), baseRect.w, baseRect.h)
        : (() => {
            srcData.data.set(dyedPixels)
            return srcData
          })()
    ctx.putImageData(outData, targetRect.x, targetRect.y)
  } catch {
    // Ignore canvas security or headless stub errors
  }
}

/**
 * Ensures that a palette-dyed sprite rect `${baseInvFile}_${colorCode}` exists in `itemRects`.
 * If the combination is not pre-baked in `items-atlas.png` and the base item has `InvTrans > 0`,
 * allocates a `SpriteRect` on the dynamic shelf, registers it in `itemRects`, and renders the
 * palette-transformed pixels onto all active dynamic atlas canvases.
 */
export function ensureDyedItemSpriteRect(
  baseInvFile: string,
  colorCode: string,
  itemRects: Readonly<Record<string, SpriteRect>>,
  itemCode?: string,
): SpriteRect | undefined {
  const baseKey = baseInvFile.trim().toLowerCase()
  const color = colorCode.trim().toLowerCase()
  if (!baseKey || !color) return undefined

  const dyedKey = `${baseKey}_${color}`
  if (itemRects[dyedKey]) {
    return itemRects[dyedKey]
  }

  const baseRect = itemRects[baseKey]
  if (!baseRect || baseRect.w <= 0 || baseRect.h <= 0) {
    return undefined
  }

  const invTrans = resolveItemInvTrans(baseKey, itemCode)
  if (invTrans <= 0) {
    return undefined
  }

  const rowTable = getInvTransRowTable(invTrans, color)
  if (!rowTable) {
    return undefined
  }

  const shelf = getOrCreateShelf(itemRects)
  const existingJob = shelf.jobs.get(dyedKey)
  if (existingJob) {
    ;(itemRects as Record<string, SpriteRect>)[dyedKey] = existingJob.targetRect
    return existingJob.targetRect
  }

  if (shelf.cursorX + baseRect.w + SHELF_PAD > shelf.baseWidth) {
    shelf.cursorX = SHELF_PAD
    shelf.cursorY += shelf.rowHeight + SHELF_PAD
    shelf.rowHeight = 0
  }
  if (shelf.cursorY + baseRect.h + SHELF_PAD > shelf.baseHeight + DYNAMIC_ATLAS_SHELF_HEIGHT) {
    return undefined
  }

  const targetRect: SpriteRect = {
    x: shelf.cursorX,
    y: shelf.cursorY,
    w: baseRect.w,
    h: baseRect.h,
    ...(baseRect.offsetX !== undefined ? { offsetX: baseRect.offsetX } : {}),
    ...(baseRect.offsetY !== undefined ? { offsetY: baseRect.offsetY } : {}),
  }
  shelf.cursorX += baseRect.w + SHELF_PAD
  if (baseRect.h > shelf.rowHeight) {
    shelf.rowHeight = baseRect.h
  }

  const job: DynamicDyeJob = {
    dyedKey,
    baseKey,
    baseRect,
    targetRect,
    invTrans,
    colorCode: color,
  }
  shelf.jobs.set(dyedKey, job)

  for (const mapRef of shelf.syncedRectMaps) {
    mapRef[dyedKey] = targetRect
  }
  ;(itemRects as Record<string, SpriteRect>)[dyedKey] = targetRect

  for (const canvas of shelf.canvases) {
    renderDyeJobToCanvas(canvas, job)
  }

  return targetRect
}

/**
 * Wraps a loaded `items-atlas.png` image into a dynamic offscreen `<canvas>` with an extra
 * vertical shelf (`DYNAMIC_ATLAS_SHELF_HEIGHT`) so runtime palette-dyed sprites can be blitted
 * and drawn with standard single-pass `ctx.drawImage(atlas, rect.x, rect.y, ...)`.
 */
export function prepareDynamicItemsAtlas<T extends DynamicImageSourceLike>(
  sourceImg: T,
  itemRects: Readonly<Record<string, SpriteRect>>,
  explicitWidth?: number,
  explicitHeight?: number,
): T | DynamicCanvasLike {
  if (!sourceImg) return sourceImg
  if (sourceImg.__dynamicItemsAtlas) {
    const shelf = getOrCreateShelf(itemRects, explicitWidth, explicitHeight)
    for (const job of shelf.jobs.values()) {
      ;(itemRects as Record<string, SpriteRect>)[job.dyedKey] = job.targetRect
    }
    return sourceImg
  }
  const ownerDoc = sourceImg.ownerDocument
  if (!ownerDoc || typeof ownerDoc.createElement !== 'function') {
    return sourceImg
  }

  const imgWidth = sourceImg.naturalWidth || sourceImg.width || explicitWidth || 0
  const imgHeight = sourceImg.naturalHeight || sourceImg.height || explicitHeight || 0
  if (imgWidth <= 0 || imgHeight <= 0) {
    return sourceImg
  }

  const shelf = getOrCreateShelf(itemRects, imgWidth, imgHeight)
  for (const job of shelf.jobs.values()) {
    ;(itemRects as Record<string, SpriteRect>)[job.dyedKey] = job.targetRect
  }

  try {
    const canvas = ownerDoc.createElement('canvas')
    canvas.width = shelf.baseWidth
    canvas.height = shelf.baseHeight + DYNAMIC_ATLAS_SHELF_HEIGHT
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) ?? canvas.getContext('2d')
    if (!ctx || typeof ctx.drawImage !== 'function') {
      return sourceImg
    }
    ctx.drawImage(sourceImg, 0, 0)

    const srcUrl = sourceImg.src ?? ''
    Object.defineProperty(canvas, '__dynamicItemsAtlas', {
      value: true,
      configurable: true,
    })
    Object.defineProperty(canvas, 'complete', {
      value: true,
      configurable: true,
    })
    Object.defineProperty(canvas, 'naturalWidth', {
      get: () => canvas.width,
      configurable: true,
    })
    Object.defineProperty(canvas, 'naturalHeight', {
      get: () => canvas.height,
      configurable: true,
    })
    if (srcUrl) {
      Object.defineProperty(canvas, 'src', {
        value: srcUrl,
        writable: true,
        configurable: true,
      })
    }

    shelf.canvases.add(canvas)
    for (const job of shelf.jobs.values()) {
      renderDyeJobToCanvas(canvas, job)
    }
    return canvas
  } catch {
    return sourceImg
  }
}
