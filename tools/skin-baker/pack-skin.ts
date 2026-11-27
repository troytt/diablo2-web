/**
 * Offline Character Skin Atlas Packer (`tools/skin-baker/pack-skin.ts`).
 *
 * Crops transparent bounds, computes exact ground-foot `anchorX`/`anchorY` offsets,
 * shelf-packs diffuse + optional additive `glow` frames into content-hashed 32-bit
 * RGBA PNG pages (`<= 4096x4096`, auto-paging when needed), validates the resulting
 * `skin.json`, updates `public/skins/index.json`, and emits an optional `.d2skin.zip`.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { encodeRgbaPng } from '../../src/baker/io/png.ts'
import { buildStoreZipArchive } from '../../src/common/formats/zip-reader.ts'
import type { PlayerClassToken } from '../../src/common/units/char-appearance.ts'
import {
  validateCharacterSkinIndex,
  validateCharacterSkinManifest,
  type CharacterSkinCatalogEntry,
  type CharacterSkinFrameTuple,
  type CharacterSkinLocalizedText,
  type CharacterSkinManifest,
  type CharacterSkinMinionSpec,
  type CharacterSkinPageSpec,
} from '../../src/common/units/character-skin.ts'
import type { AnimClipMeta } from '../../src/common/units/unit-types.ts'

export interface RawRgbaSkinFrame {
  readonly width: number
  readonly height: number
  /** Row-major RGBA8 (`width * height * 4` bytes). */
  readonly pixels: Uint8Array
  /** Ground-foot X coordinate inside this frame buffer. */
  readonly footX: number
  readonly footY: number
  /** Optional additive glow RGBA8 buffer of identical `width * height * 4` dimensions. */
  readonly glowPixels?: Uint8Array | undefined
}

export interface RawSkinClipInput {
  readonly key: string
  readonly speed: number
  readonly loop: boolean
  /** `directions[dirIdx][frameIdx]` */
  readonly directions: readonly (readonly RawRgbaSkinFrame[])[]
}

export interface PackMinionSkinInput {
  readonly name: CharacterSkinLocalizedText
  readonly directions: number
  readonly renderScale?: number | undefined
  readonly floating?: boolean | undefined
  readonly shadowOffsetY?: number | undefined
  readonly shadowScale?: number | undefined
  readonly clips: readonly RawSkinClipInput[]
  readonly portraitRgba?: { readonly width: number; readonly height: number; readonly pixels: Uint8Array } | undefined
}

export interface PackCharacterSkinInput {
  readonly id: string
  readonly name: CharacterSkinLocalizedText
  readonly description?: CharacterSkinLocalizedText | undefined
  readonly author?: string | undefined
  readonly targetClass: PlayerClassToken
  readonly directions: number
  readonly renderScale?: number | undefined
  readonly floating?: boolean | undefined
  readonly shadowOffsetY?: number | undefined
  readonly shadowScale?: number | undefined
  readonly respectMorph?: boolean | undefined
  readonly clips: readonly RawSkinClipInput[]
  readonly previewRgba?: { readonly width: number; readonly height: number; readonly pixels: Uint8Array } | undefined
  readonly minions?: Readonly<Record<string, PackMinionSkinInput>> | undefined
}

export interface PackedCharacterSkinBundle {
  readonly manifest: CharacterSkinManifest
  readonly files: Readonly<Record<string, Uint8Array>>
  readonly zipBytes: Uint8Array
}

interface CroppedSubFrame {
  readonly width: number
  readonly height: number
  readonly pixels: Uint8Array
  readonly anchorX: number
  readonly anchorY: number
}

const MAX_PAGE_DIM = 4096

function cropRgbaFrame(
  pixels: Uint8Array,
  width: number,
  height: number,
  footX: number,
  footY: number,
): CroppedSubFrame {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    const rowOff = y * width * 4
    for (let x = 0; x < width; x += 1) {
      if (pixels[rowOff + x * 4 + 3]! > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      width: 1,
      height: 1,
      pixels: new Uint8Array(4),
      anchorX: 0,
      anchorY: 0,
    }
  }

  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  const out = new Uint8Array(cw * ch * 4)
  for (let row = 0; row < ch; row += 1) {
    const srcStart = ((minY + row) * width + minX) * 4
    out.set(pixels.subarray(srcStart, srcStart + cw * 4), row * cw * 4)
  }

  return {
    width: cw,
    height: ch,
    pixels: out,
    anchorX: Math.round(minX - footX),
    anchorY: Math.round(minY - footY),
  }
}

function shelfPackRgbaPages(
  prefix: string,
  groups: readonly (readonly CroppedSubFrame[])[],
): {
  readonly pages: readonly { readonly spec: CharacterSkinPageSpec; readonly pngBytes: Uint8Array }[]
  readonly tuples: readonly (readonly CharacterSkinFrameTuple[])[]
} {
  const flatFrames = groups.flatMap((g) => g)
  const widest = Math.max(1, ...flatFrames.map((f) => f.width))
  const totalArea = flatFrames.reduce((sum, f) => sum + (f.width + 2) * (f.height + 2), 0)

  let pageWidth = Math.min(MAX_PAGE_DIM, Math.max(256, widest + 2))
  while (pageWidth < MAX_PAGE_DIM && pageWidth * pageWidth < totalArea * 1.2) {
    pageWidth = Math.min(MAX_PAGE_DIM, pageWidth * 2)
  }

  interface Placement {
    readonly pageIdx: number
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
    readonly anchorX: number
    readonly anchorY: number
    readonly pixels: Uint8Array
  }

  const pageHeights: number[] = []
  const placements: Placement[] = []

  let curPage = 0
  let cursorX = 1
  let shelfY = 1
  let shelfH = 0

  for (const frame of flatFrames) {
    const fw = frame.width
    const fh = frame.height
    if (cursorX + fw + 1 > pageWidth) {
      shelfY += shelfH + 2
      shelfH = 0
      cursorX = 1
    }
    if (shelfY + fh + 1 > MAX_PAGE_DIM) {
      pageHeights[curPage] = Math.max(1, shelfY + shelfH + 1)
      curPage += 1
      cursorX = 1
      shelfY = 1
      shelfH = 0
    }
    placements.push({
      pageIdx: curPage,
      x: cursorX,
      y: shelfY,
      w: fw,
      h: fh,
      anchorX: frame.anchorX,
      anchorY: frame.anchorY,
      pixels: frame.pixels,
    })
    cursorX += fw + 2
    shelfH = Math.max(shelfH, fh)
  }
  pageHeights[curPage] = Math.max(1, shelfY + shelfH + 1)

  const pageBuffers = pageHeights.map((h) => new Uint8Array(pageWidth * h * 4))
  for (const p of placements) {
    const buf = pageBuffers[p.pageIdx]!
    for (let row = 0; row < p.h; row += 1) {
      const dstOff = ((p.y + row) * pageWidth + p.x) * 4
      const srcOff = row * p.w * 4
      buf.set(p.pixels.subarray(srcOff, srcOff + p.w * 4), dstOff)
    }
  }

  const pages = pageBuffers.map((buf, idx) => {
    const h = pageHeights[idx]!
    const pngBytes = encodeRgbaPng({ width: pageWidth, height: h, pixels: buf, compressionLevel: 9 })
    const hash8 = createHash('sha256').update(pngBytes).digest('hex').slice(0, 8)
    const file = pageBuffers.length === 1 ? `${prefix}-${hash8}.png` : `${prefix}-${String(idx)}-${hash8}.png`
    return {
      spec: { file, width: pageWidth, height: h },
      pngBytes,
    }
  })

  const tuples: CharacterSkinFrameTuple[][] = []
  let consumed = 0
  for (const group of groups) {
    const gTuples: CharacterSkinFrameTuple[] = []
    for (let i = 0; i < group.length; i += 1) {
      const p = placements[consumed]!
      consumed += 1
      gTuples.push(
        pages.length > 1
          ? [p.x, p.y, p.w, p.h, p.anchorX, p.anchorY, p.pageIdx]
          : [p.x, p.y, p.w, p.h, p.anchorX, p.anchorY],
      )
    }
    tuples.push(gTuples)
  }

  return { pages, tuples }
}

export function packCharacterSkinBundle(input: PackCharacterSkinInput): PackedCharacterSkinBundle {
  const mainCroppedGroups: CroppedSubFrame[][] = []
  const glowCroppedGroups: CroppedSubFrame[][] = []
  const clipsMeta: Record<string, AnimClipMeta> = {}
  let hasAnyGlow = false
  let groupOffset = 0

  for (const clip of input.clips) {
    if (clip.directions.length !== input.directions) {
      throw new Error(
        `Clip "${clip.key}" has ${String(clip.directions.length)} directions, expected ${String(input.directions)}`,
      )
    }
    const frameCount = clip.directions[0]?.length ?? 0
    if (frameCount < 1) {
      throw new Error(`Clip "${clip.key}" must have >= 1 frame`)
    }
    for (const dirFrames of clip.directions) {
      if (dirFrames.length !== frameCount) {
        throw new Error(`Clip "${clip.key}" has inconsistent frame counts across directions`)
      }
      const dirMain: CroppedSubFrame[] = []
      const dirGlow: CroppedSubFrame[] = []
      for (const raw of dirFrames) {
        dirMain.push(cropRgbaFrame(raw.pixels, raw.width, raw.height, raw.footX, raw.footY))
        if (raw.glowPixels) {
          const croppedGlow = cropRgbaFrame(raw.glowPixels, raw.width, raw.height, raw.footX, raw.footY)
          if (croppedGlow.width > 1 || croppedGlow.height > 1) {
            hasAnyGlow = true
          }
          dirGlow.push(croppedGlow)
        } else {
          dirGlow.push({ width: 1, height: 1, pixels: new Uint8Array(4), anchorX: 0, anchorY: 0 })
        }
      }
      mainCroppedGroups.push(dirMain)
      glowCroppedGroups.push(dirGlow)
    }
    clipsMeta[clip.key.toLowerCase()] = {
      group: groupOffset,
      directions: input.directions,
      frames: frameCount,
      speed: clip.speed,
      loop: clip.loop,
      events: [],
    }
    groupOffset += input.directions
  }

  const mainPacked = shelfPackRgbaPages('atlas', mainCroppedGroups)
  const glowPacked = hasAnyGlow ? shelfPackRgbaPages('glow', glowCroppedGroups) : null

  const files: Record<string, Uint8Array> = {}
  for (const p of mainPacked.pages) {
    files[p.spec.file] = p.pngBytes
  }
  if (glowPacked) {
    for (const p of glowPacked.pages) {
      files[p.spec.file] = p.pngBytes
    }
  }

  let previewFile: string | undefined
  if (input.previewRgba) {
    const previewPng = encodeRgbaPng(input.previewRgba)
    const hash8 = createHash('sha256').update(previewPng).digest('hex').slice(0, 8)
    previewFile = `preview-${hash8}.png`
    files[previewFile] = previewPng
  }

  let packedMinions: Record<string, CharacterSkinMinionSpec> | undefined
  if (input.minions && Object.keys(input.minions).length > 0) {
    packedMinions = {}
    for (const [rawKey, mInput] of Object.entries(input.minions)) {
      const mKey = rawKey.trim().toLowerCase()
      const mMainGroups: CroppedSubFrame[][] = []
      const mGlowGroups: CroppedSubFrame[][] = []
      const mClipsMeta: Record<string, AnimClipMeta> = {}
      let mHasAnyGlow = false
      let mGroupOff = 0

      for (const clip of mInput.clips) {
        if (clip.directions.length !== mInput.directions) {
          throw new Error(
            `Minion "${mKey}" clip "${clip.key}" has ${String(clip.directions.length)} directions, expected ${String(mInput.directions)}`,
          )
        }
        const fCount = clip.directions[0]?.length ?? 0
        if (fCount < 1) {
          throw new Error(`Minion "${mKey}" clip "${clip.key}" must have >= 1 frame`)
        }
        for (const dirFrames of clip.directions) {
          if (dirFrames.length !== fCount) {
            throw new Error(`Minion "${mKey}" clip "${clip.key}" has inconsistent frame counts across directions`)
          }
          const dirMain: CroppedSubFrame[] = []
          const dirGlow: CroppedSubFrame[] = []
          for (const raw of dirFrames) {
            dirMain.push(cropRgbaFrame(raw.pixels, raw.width, raw.height, raw.footX, raw.footY))
            if (raw.glowPixels) {
              const croppedGlow = cropRgbaFrame(raw.glowPixels, raw.width, raw.height, raw.footX, raw.footY)
              if (croppedGlow.width > 1 || croppedGlow.height > 1) {
                mHasAnyGlow = true
              }
              dirGlow.push(croppedGlow)
            } else {
              dirGlow.push({ width: 1, height: 1, pixels: new Uint8Array(4), anchorX: 0, anchorY: 0 })
            }
          }
          mMainGroups.push(dirMain)
          mGlowGroups.push(dirGlow)
        }
        mClipsMeta[clip.key.toLowerCase()] = {
          group: mGroupOff,
          directions: mInput.directions,
          frames: fCount,
          speed: clip.speed,
          loop: clip.loop,
          events: [],
        }
        mGroupOff += mInput.directions
      }

      const mMainPacked = shelfPackRgbaPages(`minion-${mKey}`, mMainGroups)
      const mGlowPacked = mHasAnyGlow ? shelfPackRgbaPages(`minion-${mKey}-glow`, mGlowGroups) : null
      for (const p of mMainPacked.pages) {
        files[p.spec.file] = p.pngBytes
      }
      if (mGlowPacked) {
        for (const p of mGlowPacked.pages) {
          files[p.spec.file] = p.pngBytes
        }
      }

      let portraitFile: string | undefined
      if (mInput.portraitRgba) {
        const portPng = encodeRgbaPng(mInput.portraitRgba)
        const pHash8 = createHash('sha256').update(portPng).digest('hex').slice(0, 8)
        portraitFile = `portrait-${mKey}-${pHash8}.png`
        files[portraitFile] = portPng
      }

      packedMinions[mKey] = {
        name: mInput.name,
        directions: mInput.directions,
        ...(mInput.renderScale !== undefined ? { renderScale: mInput.renderScale } : {}),
        ...(mInput.floating !== undefined ? { floating: mInput.floating } : {}),
        ...(mInput.shadowOffsetY !== undefined ? { shadowOffsetY: mInput.shadowOffsetY } : {}),
        ...(mInput.shadowScale !== undefined ? { shadowScale: mInput.shadowScale } : {}),
        ...(portraitFile ? { portraitFile } : {}),
        pages: mMainPacked.pages.map((p) => p.spec),
        ...(mGlowPacked ? { glowPages: mGlowPacked.pages.map((p) => p.spec) } : {}),
        clips: mClipsMeta,
        ...(mGlowPacked ? { glowClips: mClipsMeta } : {}),
        groups: mMainPacked.tuples,
        ...(mGlowPacked ? { glowGroups: mGlowPacked.tuples } : {}),
      }
    }
  }

  const manifest = validateCharacterSkinManifest({
    schema: 1,
    id: input.id,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    ...(input.author ? { author: input.author } : {}),
    targetClass: input.targetClass,
    format: 'rgba',
    directions: input.directions,
    ...(input.renderScale !== undefined ? { renderScale: input.renderScale } : {}),
    ...(input.floating !== undefined ? { floating: input.floating } : {}),
    ...(input.shadowOffsetY !== undefined ? { shadowOffsetY: input.shadowOffsetY } : {}),
    ...(input.shadowScale !== undefined ? { shadowScale: input.shadowScale } : {}),
    ...(input.respectMorph !== undefined ? { respectMorph: input.respectMorph } : {}),
    ...(previewFile ? { previewFile } : {}),
    pages: mainPacked.pages.map((p) => p.spec),
    ...(glowPacked ? { glowPages: glowPacked.pages.map((p) => p.spec) } : {}),
    clips: clipsMeta,
    ...(glowPacked ? { glowClips: clipsMeta } : {}),
    groups: mainPacked.tuples,
    ...(glowPacked ? { glowGroups: glowPacked.tuples } : {}),
    ...(packedMinions ? { minions: packedMinions } : {}),
  })

  const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`)
  files['skin.json'] = manifestBytes

  const zipEntries = Object.keys(files)
    .sort()
    .map((path) => ({ path, bytes: files[path]! }))
  const zipBytes = buildStoreZipArchive(zipEntries)

  return { manifest, files, zipBytes }
}

/**
 * Write a packed character skin bundle into `<skinsRoot>/<manifest.id>/` and atomically
 * update `<skinsRoot>/index.json` for hot-deploy static serving.
 */
export function writeSkinBundleToPublicSkinsDir(
  bundle: PackedCharacterSkinBundle,
  skinsRoot: string = resolve(process.cwd(), 'public', 'skins'),
  emitZipCopy = false,
): void {
  const skinDir = join(skinsRoot, bundle.manifest.id)
  mkdirSync(skinDir, { recursive: true })
  for (const oldName of readdirSync(skinDir)) {
    rmSync(join(skinDir, oldName), { force: true, recursive: true })
  }
  for (const [relName, bytes] of Object.entries(bundle.files)) {
    writeFileSync(join(skinDir, relName), bytes)
  }
  if (emitZipCopy) {
    writeFileSync(join(skinsRoot, `${bundle.manifest.id}.d2skin.zip`), bundle.zipBytes)
  }

  const indexPath = join(skinsRoot, 'index.json')
  let existingEntries: CharacterSkinCatalogEntry[] = []
  if (existsSync(indexPath)) {
    try {
      const parsed = validateCharacterSkinIndex(JSON.parse(readFileSync(indexPath, 'utf8')))
      existingEntries = parsed.skins.filter((s) => s.id !== bundle.manifest.id)
    } catch {
      existingEntries = []
    }
  }

  const newEntry: CharacterSkinCatalogEntry = {
    id: bundle.manifest.id,
    name: bundle.manifest.name,
    ...(bundle.manifest.description ? { description: bundle.manifest.description } : {}),
    ...(bundle.manifest.author ? { author: bundle.manifest.author } : {}),
    targetClass: bundle.manifest.targetClass,
    source: 'builtin',
    manifestPath: `${bundle.manifest.id}/skin.json`,
    ...(bundle.manifest.previewFile ? { previewPath: `${bundle.manifest.id}/${bundle.manifest.previewFile}` } : {}),
  }

  const nextIndex = validateCharacterSkinIndex({
    schema: 1,
    skins: [...existingEntries, newEntry],
  })
  writeFileSync(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`, 'utf8')
}
