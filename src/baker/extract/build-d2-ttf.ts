/**
 * Authentic Diablo II v1.13c TrueType (`.ttf`) WebFont Builder.
 *
 * Vectorizes the 256-glyph DC6 bitmap font tables from `d2data.mpq`
 * (`data\local\font\latin\font42.dc6` + `font42.tbl` for `D2Exocet`, and
 * `data\local\font\latin\fontformal12.dc6` + `fontformal12.tbl` for `D2Formal436`)
 * into standards-compliant TrueType (`sfnt` 0x00010000) font files with zero
 * external network dependencies.
 */

import type { SpriteFrame } from '../../common/formats/sprite.ts'

interface Point {
  readonly x: number
  readonly y: number
}

/**
 * Trace closed polygon contours (clockwise outer boundaries, counter-clockwise holes
 * in +X right, +Y up coordinates) from a binary foreground mask `mask[y * width + x]`.
 */
export function traceBitmapContours(
  mask: Uint8Array,
  width: number,
  height: number,
  baselineY: number,
  scale: number,
): Point[][] {
  interface Edge {
    x0: number
    y0: number
    x1: number
    y1: number
    dir: number // 0=up, 1=right, 2=down, 3=left
    used: boolean
  }

  const edgesByStart = new Map<string, Edge[]>()
  const allEdges: Edge[] = []
  const addEdge = (x0: number, y0: number, x1: number, y1: number, dir: number): void => {
    const e: Edge = { x0, y0, x1, y1, dir, used: false }
    allEdges.push(e)
    const k = `${x0},${y0}`
    let list = edgesByStart.get(k)
    if (!list) {
      list = []
      edgesByStart.set(k, list)
    }
    list.push(e)
  }

  const get = (x: number, y: number): number => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0
    return mask[y * width + x] ?? 0
  }

  for (let y = 0; y < height; y++) {
    const yUp = baselineY - y
    for (let x = 0; x < width; x++) {
      if (!get(x, y)) continue
      if (!get(x - 1, y)) addEdge(x, yUp - 1, x, yUp, 0)
      if (!get(x, y - 1)) addEdge(x, yUp, x + 1, yUp, 1)
      if (!get(x + 1, y)) addEdge(x + 1, yUp, x + 1, yUp - 1, 2)
      if (!get(x, y + 1)) addEdge(x + 1, yUp - 1, x, yUp - 1, 3)
    }
  }

  const contours: Point[][] = []
  for (const startEdge of allEdges) {
    if (startEdge.used) continue
    const rawPts: { x: number; y: number; dir: number }[] = []
    let cur: Edge | undefined = startEdge
    while (cur && !cur.used) {
      cur.used = true
      rawPts.push({ x: cur.x0, y: cur.y0, dir: cur.dir })
      const candidates = edgesByStart.get(`${cur.x1},${cur.y1}`)
      if (!candidates) break
      let next: Edge | undefined
      const prefDirs = [(cur.dir + 1) % 4, cur.dir, (cur.dir + 3) % 4]
      for (const pd of prefDirs) {
        next = candidates.find(c => !c.used && c.dir === pd)
        if (next) break
      }
      if (!next) {
        next = candidates.find(c => !c.used)
      }
      cur = next
    }
    if (rawPts.length < 4) continue
    const simplified: Point[] = []
    for (let i = 0; i < rawPts.length; i++) {
      const prev = rawPts[(i + rawPts.length - 1) % rawPts.length]!
      const curr = rawPts[i]!
      if (prev.dir !== curr.dir) {
        simplified.push({
          x: Math.round(curr.x * scale),
          y: Math.round(curr.y * scale),
        })
      }
    }
    if (simplified.length >= 3) {
      contours.push(simplified)
    }
  }

  return contours
}

export interface Dc6FrameLike {
  readonly width: number
  readonly height: number
  readonly indices: Uint8Array
}

export interface BuildTrueTypeFontOptions {
  readonly familyName: string
  readonly postScriptName: string
  readonly frames: readonly Dc6FrameLike[]
  readonly tblBytes: Uint8Array
  readonly baselineY: number
  readonly scale: number
  readonly isForeground: (paletteIdx: number) => boolean
  readonly minContourAreaPixels?: number
  readonly refineMask?: (mask: Uint8Array, frame: Dc6FrameLike) => void
}

function computePolygonSignedArea(pts: readonly Point[]): number {
  let area2 = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    area2 += a.x * b.y - b.x * a.y
  }
  return area2 * 0.5
}

/**
 * Build a complete TrueType (`.ttf`) binary buffer from a 256-glyph DC6 sheet and `.tbl` metrics.
 */
export function buildTrueTypeFont(options: BuildTrueTypeFontOptions): Uint8Array {
  const {
    familyName,
    postScriptName,
    frames,
    tblBytes,
    baselineY,
    scale,
    isForeground,
    minContourAreaPixels = 0,
    refineMask,
  } = options

  interface BuiltGlyph {
    contours: Point[][]
    advanceWidth: number
    xMin: number
    yMin: number
    xMax: number
    yMax: number
  }

  const glyphs: BuiltGlyph[] = []
  const unicodeToGlyph = new Map<number, number>()

  // Glyph 0: .notdef
  glyphs.push({
    contours: [
      [
        { x: 40, y: 0 },
        { x: 40, y: 600 },
        { x: 440, y: 600 },
        { x: 440, y: 0 },
      ],
      [
        { x: 100, y: 60 },
        { x: 380, y: 60 },
        { x: 380, y: 540 },
        { x: 100, y: 540 },
      ],
    ],
    advanceWidth: 500,
    xMin: 40,
    yMin: 0,
    xMax: 440,
    yMax: 600,
  })

  const win1252Map: Record<number, number> = {
    0x80: 0x20ac,
    0x82: 0x201a,
    0x83: 0x0192,
    0x84: 0x201e,
    0x85: 0x2026,
    0x86: 0x2020,
    0x87: 0x2021,
    0x88: 0x02c6,
    0x89: 0x2030,
    0x8a: 0x0160,
    0x8b: 0x2039,
    0x8c: 0x0152,
    0x8e: 0x017d,
    0x91: 0x2018,
    0x92: 0x2019,
    0x93: 0x201c,
    0x94: 0x201d,
    0x95: 0x2022,
    0x96: 0x2013,
    0x97: 0x2014,
    0x98: 0x02dc,
    0x99: 0x2122,
    0x9a: 0x0161,
    0x9b: 0x203a,
    0x9c: 0x0153,
    0x9e: 0x017e,
    0x9f: 0x0178,
  }

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
  ].filter((f): f is Dc6FrameLike => Boolean(f && f.width > 0 && f.height > 0))

  const isSameFrame = (a: Dc6FrameLike | undefined, b: Dc6FrameLike | undefined): boolean => {
    if (!a || !b || a.width === 0 || b.width === 0) return false
    if (a.width !== b.width || a.height !== b.height) return false
    for (let i = 0; i < a.indices.length; i++) {
      if (isForeground(a.indices[i] ?? 0) !== isForeground(b.indices[i] ?? 0)) return false
    }
    return true
  }

  const isPlaceholderQuestionMark = (f: Dc6FrameLike | undefined): boolean =>
    placeholderCandidates.some(cand => isSameFrame(f, cand))

  const dotRecOff = 12 + 0x2e * 14
  const dotMetricW = dotRecOff + 3 < tblBytes.length ? (tblBytes[dotRecOff + 3] || 6) : 6
  const dotFrameIdx = dotRecOff + 8 < tblBytes.length ? (tblBytes[dotRecOff + 8] ?? 0x2e) : 0x2e
  const dotFrame = frames[dotFrameIdx] ?? frames[0x2e]

  const dashRecOff = 12 + 0x2d * 14
  const dashMetricW = dashRecOff + 3 < tblBytes.length ? (tblBytes[dashRecOff + 3] || 8) : 8
  const dashFrameIdx = dashRecOff + 8 < tblBytes.length ? (tblBytes[dashRecOff + 8] ?? 0x2d) : 0x2d
  const dashFrame = frames[dashFrameIdx] ?? frames[0x2d]

  for (let code = 0x20; code <= 0xff; code++) {
    const recOff = 12 + code * 14
    let metricWidth = recOff + 3 < tblBytes.length ? (tblBytes[recOff + 3] || 8) : 8
    const frameIdx = recOff + 8 < tblBytes.length ? (tblBytes[recOff + 8] ?? code) : code
    let frame = frames[frameIdx] ?? frames[code]
    let glyphBaselineY = baselineY

    let yShiftUnits = 0
    if ((code === 0xb7 || code === 0x95) && dotFrame && dotFrame.width > 0 && dotFrame.height > 0) {
      frame = dotFrame
      metricWidth = dotMetricW
      yShiftUnits = Math.round(baselineY * 0.35 * scale)
    } else if (code !== 0x3f && code !== 0x20 && code !== 0xa0 && isPlaceholderQuestionMark(frame)) {
      if ((code === 0x96 || code === 0x97) && dashFrame && dashFrame.width > 0 && dashFrame.height > 0) {
        frame = dashFrame
        metricWidth = dashMetricW
      } else {
        continue
      }
    }

    let contours: Point[][] = []
    if (code !== 0x20 && code !== 0xa0 && frame && frame.width > 0 && frame.height > 0) {
      const mask = new Uint8Array(frame.width * frame.height)
      for (let i = 0; i < mask.length; i++) {
        mask[i] = isForeground(frame.indices[i] ?? 0) ? 1 : 0
      }
      refineMask?.(mask, frame)
      contours = traceBitmapContours(mask, frame.width, frame.height, glyphBaselineY, scale)
      if (minContourAreaPixels > 0 && contours.length > 1) {
        const minAreaUnits = minContourAreaPixels * scale * scale
        const filtered = contours.filter(c => Math.abs(computePolygonSignedArea(c)) > minAreaUnits)
        if (filtered.length > 0) contours = filtered
      }
      if (yShiftUnits !== 0) {
        contours = contours.map(c => c.map(p => ({ x: p.x, y: p.y + yShiftUnits })))
      }
    }

    let xMin = 0
    let yMin = 0
    let xMax = 0
    let yMax = 0
    if (contours.length > 0) {
      xMin = Infinity
      yMin = Infinity
      xMax = -Infinity
      yMax = -Infinity
      for (const c of contours) {
        for (const p of c) {
          if (p.x < xMin) xMin = p.x
          if (p.y < yMin) yMin = p.y
          if (p.x > xMax) xMax = p.x
          if (p.y > yMax) yMax = p.y
        }
      }
    }

    const advanceWidth = Math.max(
      Math.round(metricWidth * scale),
      contours.length > 0 ? xMax + Math.round(scale) : Math.round(6 * scale),
    )

    const gIdx = glyphs.length
    glyphs.push({
      contours,
      advanceWidth,
      xMin,
      yMin,
      xMax,
      yMax,
    })

    if (code < 0x7f || code >= 0xa0) {
      unicodeToGlyph.set(code, gIdx)
    } else if (win1252Map[code]) {
      unicodeToGlyph.set(win1252Map[code]!, gIdx)
    }
  }

  const glyfChunks: Uint8Array[] = []
  const locaOffsets: number[] = []
  let currentGlyfOffset = 0

  let fontXMin = Infinity
  let fontYMin = Infinity
  let fontXMax = -Infinity
  let fontYMax = -Infinity
  let maxPoints = 0
  let maxContours = 0
  let advanceWidthMax = 0
  let minLsb = Infinity
  let minRsb = Infinity
  let xMaxExtent = -Infinity

  for (const g of glyphs) {
    locaOffsets.push(currentGlyfOffset)
    if (g.advanceWidth > advanceWidthMax) advanceWidthMax = g.advanceWidth
    if (g.contours.length === 0) {
      minLsb = Math.min(minLsb, 0)
      minRsb = Math.min(minRsb, g.advanceWidth)
      xMaxExtent = Math.max(xMaxExtent, 0)
      continue
    }

    if (g.xMin < fontXMin) fontXMin = g.xMin
    if (g.yMin < fontYMin) fontYMin = g.yMin
    if (g.xMax > fontXMax) fontXMax = g.xMax
    if (g.yMax > fontYMax) fontYMax = g.yMax
    if (g.xMin < minLsb) minLsb = g.xMin
    const rsb = g.advanceWidth - g.xMax
    if (rsb < minRsb) minRsb = rsb
    if (g.xMax > xMaxExtent) xMaxExtent = g.xMax

    const numContours = g.contours.length
    if (numContours > maxContours) maxContours = numContours
    const allPts: Point[] = []
    const endPts: number[] = []
    for (const c of g.contours) {
      for (const p of c) allPts.push(p)
      endPts.push(allPts.length - 1)
    }
    if (allPts.length > maxPoints) maxPoints = allPts.length

    const rawLen = 10 + numContours * 2 + 2 + allPts.length * 5
    const paddedLen = (rawLen + 3) & ~3
    const buf = new Uint8Array(paddedLen)
    const dv = new DataView(buf.buffer)
    dv.setInt16(0, numContours, false)
    dv.setInt16(2, g.xMin, false)
    dv.setInt16(4, g.yMin, false)
    dv.setInt16(6, g.xMax, false)
    dv.setInt16(8, g.yMax, false)
    let off = 10
    for (const ep of endPts) {
      dv.setUint16(off, ep, false)
      off += 2
    }
    dv.setUint16(off, 0, false) // instructionLength = 0
    off += 2
    for (let i = 0; i < allPts.length; i++) {
      buf[off++] = 0x01
    }
    let prevX = 0
    for (const pt of allPts) {
      dv.setInt16(off, pt.x - prevX, false)
      prevX = pt.x
      off += 2
    }
    let prevY = 0
    for (const pt of allPts) {
      dv.setInt16(off, pt.y - prevY, false)
      prevY = pt.y
      off += 2
    }

    glyfChunks.push(buf)
    currentGlyfOffset += paddedLen
  }
  locaOffsets.push(currentGlyfOffset)

  const glyfTable = new Uint8Array(currentGlyfOffset)
  let gPos = 0
  for (const chunk of glyfChunks) {
    glyfTable.set(chunk, gPos)
    gPos += chunk.length
  }

  const locaTable = new Uint8Array(locaOffsets.length * 4)
  const locaDv = new DataView(locaTable.buffer)
  locaOffsets.forEach((o, idx) => locaDv.setUint32(idx * 4, o, false))

  const headTable = new Uint8Array(54)
  const headDv = new DataView(headTable.buffer)
  headDv.setUint32(0, 0x00010000, false)
  headDv.setUint32(4, 0x00010000, false)
  headDv.setUint32(8, 0, false)
  headDv.setUint32(12, 0x5f0f3cf5, false)
  headDv.setUint16(16, 0x000b, false)
  headDv.setUint16(18, 1024, false)
  headDv.setInt16(36, fontXMin, false)
  headDv.setInt16(38, fontYMin, false)
  headDv.setInt16(40, fontXMax, false)
  headDv.setInt16(42, fontYMax, false)
  headDv.setUint16(44, 0, false)
  headDv.setUint16(46, 8, false)
  headDv.setInt16(48, 2, false)
  headDv.setInt16(50, 1, false)
  headDv.setInt16(52, 0, false)

  const ascender = Math.max(832, fontYMax)
  const descender = Math.min(-192, fontYMin)

  const hheaTable = new Uint8Array(36)
  const hheaDv = new DataView(hheaTable.buffer)
  hheaDv.setUint32(0, 0x00010000, false)
  hheaDv.setInt16(4, ascender, false)
  hheaDv.setInt16(6, descender, false)
  hheaDv.setInt16(8, 0, false)
  hheaDv.setUint16(10, advanceWidthMax, false)
  hheaDv.setInt16(12, minLsb, false)
  hheaDv.setInt16(14, minRsb, false)
  hheaDv.setInt16(16, xMaxExtent, false)
  hheaDv.setInt16(18, 1, false)
  hheaDv.setInt16(20, 0, false)
  hheaDv.setInt16(22, 0, false)
  hheaDv.setInt16(32, 0, false)
  hheaDv.setUint16(34, glyphs.length, false)

  const maxpTable = new Uint8Array(32)
  const maxpDv = new DataView(maxpTable.buffer)
  maxpDv.setUint32(0, 0x00010000, false)
  maxpDv.setUint16(4, glyphs.length, false)
  maxpDv.setUint16(6, maxPoints, false)
  maxpDv.setUint16(8, maxContours, false)
  maxpDv.setUint16(10, 0, false)
  maxpDv.setUint16(12, 0, false)
  maxpDv.setUint16(14, 2, false)

  const hmtxTable = new Uint8Array(glyphs.length * 4)
  const hmtxDv = new DataView(hmtxTable.buffer)
  glyphs.forEach((g, idx) => {
    hmtxDv.setUint16(idx * 4, g.advanceWidth, false)
    hmtxDv.setInt16(idx * 4 + 2, g.contours.length > 0 ? g.xMin : 0, false)
  })

  const os2Table = new Uint8Array(96)
  const os2Dv = new DataView(os2Table.buffer)
  const avgWidth = Math.round(
    glyphs.reduce((acc, g) => acc + g.advanceWidth, 0) / Math.max(1, glyphs.length),
  )
  os2Dv.setUint16(0, 4, false)
  os2Dv.setInt16(2, avgWidth, false)
  os2Dv.setUint16(4, 400, false)
  os2Dv.setUint16(6, 5, false)
  os2Dv.setUint16(8, 0, false)
  os2Dv.setInt16(10, 650, false)
  os2Dv.setInt16(12, 600, false)
  os2Dv.setInt16(14, 0, false)
  os2Dv.setInt16(16, 75, false)
  os2Dv.setInt16(18, 650, false)
  os2Dv.setInt16(20, 600, false)
  os2Dv.setInt16(22, 0, false)
  os2Dv.setInt16(24, 350, false)
  os2Dv.setInt16(26, 50, false)
  os2Dv.setInt16(28, 300, false)
  os2Dv.setInt16(30, 0, false)
  os2Table.set([2, 0, 5, 3, 0, 0, 0, 0, 0, 0], 32)
  os2Dv.setUint32(42, 0x00000003, false)
  os2Table.set([0x42, 0x4c, 0x49, 0x5a], 58)
  os2Dv.setUint16(62, 0x0040, false)
  const sortedCodes = [...unicodeToGlyph.keys()].sort((a, b) => a - b)
  os2Dv.setUint16(64, sortedCodes[0] ?? 0x0020, false)
  os2Dv.setUint16(66, sortedCodes[sortedCodes.length - 1] ?? 0x00ff, false)
  os2Dv.setInt16(68, ascender, false)
  os2Dv.setInt16(70, descender, false)
  os2Dv.setInt16(72, 0, false)
  os2Dv.setUint16(74, ascender, false)
  os2Dv.setUint16(76, Math.abs(descender), false)
  os2Dv.setUint32(78, 0x00000001, false)
  os2Dv.setInt16(86, 512, false)
  os2Dv.setInt16(88, 704, false)
  os2Dv.setUint16(90, 0, false)
  os2Dv.setUint16(92, 0x0020, false)
  os2Dv.setUint16(94, 1, false)

  interface Seg {
    start: number
    end: number
    delta: number
  }
  const segs: Seg[] = []
  for (const code of sortedCodes) {
    const gIdx = unicodeToGlyph.get(code)!
    const delta = (gIdx - code) & 0xffff
    const prev = segs[segs.length - 1]
    if (prev && prev.end + 1 === code && prev.delta === delta) {
      prev.end = code
    } else {
      segs.push({ start: code, end: code, delta })
    }
  }
  segs.push({ start: 0xffff, end: 0xffff, delta: 1 })
  const segCount = segs.length
  const segCountX2 = segCount * 2
  const maxPow2 = 1 << Math.floor(Math.log2(segCount))
  const searchRangeCmap = maxPow2 * 2
  const entrySelectorCmap = Math.floor(Math.log2(segCount))
  const rangeShiftCmap = segCountX2 - searchRangeCmap

  const subtableLen = 16 + segCount * 8
  const cmapTable = new Uint8Array(4 + 8 * 2 + subtableLen)
  const cmapDv = new DataView(cmapTable.buffer)
  cmapDv.setUint16(0, 0, false)
  cmapDv.setUint16(2, 2, false)
  cmapDv.setUint16(4, 0, false)
  cmapDv.setUint16(6, 3, false)
  cmapDv.setUint32(8, 20, false)
  cmapDv.setUint16(12, 3, false)
  cmapDv.setUint16(14, 1, false)
  cmapDv.setUint32(16, 20, false)

  let cOff = 20
  cmapDv.setUint16(cOff, 4, false)
  cmapDv.setUint16(cOff + 2, subtableLen, false)
  cmapDv.setUint16(cOff + 4, 0, false)
  cmapDv.setUint16(cOff + 6, segCountX2, false)
  cmapDv.setUint16(cOff + 8, searchRangeCmap, false)
  cmapDv.setUint16(cOff + 10, entrySelectorCmap, false)
  cmapDv.setUint16(cOff + 12, rangeShiftCmap, false)
  cOff += 14
  for (const s of segs) {
    cmapDv.setUint16(cOff, s.end, false)
    cOff += 2
  }
  cmapDv.setUint16(cOff, 0, false)
  cOff += 2
  for (const s of segs) {
    cmapDv.setUint16(cOff, s.start, false)
    cOff += 2
  }
  for (const s of segs) {
    cmapDv.setUint16(cOff, s.delta, false)
    cOff += 2
  }
  for (let i = 0; i < segs.length; i++) {
    cmapDv.setUint16(cOff, 0, false)
    cOff += 2
  }

  const nameRecords: { nameId: number; str: string }[] = [
    { nameId: 1, str: familyName },
    { nameId: 2, str: 'Regular' },
    { nameId: 3, str: `${familyName}-1.13c` },
    { nameId: 4, str: familyName },
    { nameId: 5, str: 'Version 1.13c' },
    { nameId: 6, str: postScriptName },
  ]
  const encodedStrings: Uint8Array[] = nameRecords.map(r => {
    const b = new Uint8Array(r.str.length * 2)
    const dv = new DataView(b.buffer)
    for (let i = 0; i < r.str.length; i++) {
      dv.setUint16(i * 2, r.str.charCodeAt(i), false)
    }
    return b
  })
  const storageOffset = 6 + nameRecords.length * 12
  const totalStrBytes = encodedStrings.reduce((a, b) => a + b.length, 0)
  const nameTable = new Uint8Array(storageOffset + totalStrBytes)
  const nameDv = new DataView(nameTable.buffer)
  nameDv.setUint16(0, 0, false)
  nameDv.setUint16(2, nameRecords.length, false)
  nameDv.setUint16(4, storageOffset, false)
  let strCur = 0
  nameRecords.forEach((rec, idx) => {
    const strBytes = encodedStrings[idx]!
    const rOff = 6 + idx * 12
    nameDv.setUint16(rOff, 3, false)
    nameDv.setUint16(rOff + 2, 1, false)
    nameDv.setUint16(rOff + 4, 0x0409, false)
    nameDv.setUint16(rOff + 6, rec.nameId, false)
    nameDv.setUint16(rOff + 8, strBytes.length, false)
    nameDv.setUint16(rOff + 10, strCur, false)
    nameTable.set(strBytes, storageOffset + strCur)
    strCur += strBytes.length
  })

  const postTable = new Uint8Array(32)
  const postDv = new DataView(postTable.buffer)
  postDv.setUint32(0, 0x00030000, false)
  postDv.setInt32(4, 0, false)
  postDv.setInt16(8, -100, false)
  postDv.setInt16(10, 50, false)
  postDv.setUint32(12, 0, false)

  const tables: { tag: string; data: Uint8Array }[] = [
    { tag: 'OS/2', data: os2Table },
    { tag: 'cmap', data: cmapTable },
    { tag: 'glyf', data: glyfTable },
    { tag: 'head', data: headTable },
    { tag: 'hhea', data: hheaTable },
    { tag: 'hmtx', data: hmtxTable },
    { tag: 'loca', data: locaTable },
    { tag: 'maxp', data: maxpTable },
    { tag: 'name', data: nameTable },
    { tag: 'post', data: postTable },
  ].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))

  const calcChecksum = (bytes: Uint8Array): number => {
    const paddedLen = (bytes.length + 3) & ~3
    const padded = new Uint8Array(paddedLen)
    padded.set(bytes)
    const dv = new DataView(padded.buffer)
    let sum = 0
    for (let i = 0; i < paddedLen; i += 4) {
      sum = (sum + dv.getUint32(i, false)) >>> 0
    }
    return sum
  }

  const numTables = tables.length
  const dirSize = 12 + numTables * 16
  let totalSize = dirSize
  const offsets: number[] = []
  for (const t of tables) {
    offsets.push(totalSize)
    totalSize += (t.data.length + 3) & ~3
  }

  const out = new Uint8Array(totalSize)
  const outDv = new DataView(out.buffer)
  outDv.setUint32(0, 0x00010000, false)
  outDv.setUint16(4, numTables, false)
  outDv.setUint16(6, 128, false)
  outDv.setUint16(8, 3, false)
  outDv.setUint16(10, 32, false)

  let headOffsetInFile = 0
  tables.forEach((t, idx) => {
    const entryOff = 12 + idx * 16
    for (let c = 0; c < 4; c++) {
      out[entryOff + c] = t.tag.charCodeAt(c)
    }
    const chksum = calcChecksum(t.data)
    const fileOff = offsets[idx]!
    if (t.tag === 'head') headOffsetInFile = fileOff
    outDv.setUint32(entryOff + 4, chksum, false)
    outDv.setUint32(entryOff + 8, fileOff, false)
    outDv.setUint32(entryOff + 12, t.data.length, false)
    out.set(t.data, fileOff)
  })

  const fileSum = calcChecksum(out)
  const checkSumAdjustment = (0xb1b0afba - fileSum) >>> 0
  outDv.setUint32(headOffsetInFile + 8, checkSumAdjustment, false)

  return out
}
