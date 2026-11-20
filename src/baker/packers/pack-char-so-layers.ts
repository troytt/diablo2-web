/**
 * Bake modular paperdoll DCC layers, COF descriptors, AnimData clips, and
 * `Palette/*.dat` color shift tables for ANY playable class into
 * `public/chars/<token>/`.
 * Default (`all`) bakes every class; a single token can be baked explicitly.
 *
 * Ground Truth (Diablo II v1.13c):
 * - `data\global\chars\so\cof\*.cof` (94 COF files)
 * - `data\global\chars\so\<comp>\so<comp><variant><mode><wclass>.dcc` (1,669 DCC files across 77 `<comp>-<variant>` pairs)
 * - `data\global\items\Palette\*.dat` (8 palette shift tables, each 21 colors × 256 bytes = 5,376 bytes)
 *
 * This offline pack script eliminates any runtime dependency on MPQ archives while allowing
 * instant on-demand loading and caching of paperdoll component variants and dye transforms.
 */
import { copyFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'

import {
  PLAYER_CLASS_TOKENS,
  normalizeCharacterClass,
  type PlayerClassToken,
} from '../../common/units/char-appearance.ts'

const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const

/**
 * 1.13c `D2CMP.dll` `D2Comp.cpp` palette shift `.dat` files indexed by `Transform` (1..8).
 */
export const PALETTE_SHIFT_FILES: Readonly<Record<number, string>> = {
  1: 'data\\global\\items\\Palette\\grey.dat',
  2: 'data\\global\\items\\Palette\\grey2.dat',
  3: 'data\\global\\items\\Palette\\gold.dat',
  4: 'data\\global\\items\\Palette\\brown.dat',
  5: 'data\\global\\items\\Palette\\greybrown.dat',
  6: 'data\\global\\items\\Palette\\invgrey.dat',
  7: 'data\\global\\items\\Palette\\invgrey2.dat',
  8: 'data\\global\\items\\Palette\\invgreybrown.dat',
}

export interface SorceressLayerPackManifest {
  readonly schema: 1
  readonly metaFile: string
  readonly cofs: Record<string, [number, number]>
  readonly palettes: Record<number, [number, number]>
  readonly animClips: Record<string, { speed: number; events: [number, number][] }>
  readonly layers: Record<
    string,
    {
      readonly file: string
      readonly dccs: Record<string, [number, number]>
    }
  >
}

export type CharacterLayerPackManifest = SorceressLayerPackManifest

async function writeFileAtomic(targetPath: string, content: string | Uint8Array): Promise<void> {
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Math.random().toString(36).slice(2)}`
  await writeFile(tmpPath, content)
  await rename(tmpPath, targetPath)
}

export async function packCharacterLayers(
  classTokenOrId: PlayerClassToken | string | number = 'so',
  archiveDir = 'samples/d2',
  outDir = 'public',
): Promise<SorceressLayerPackManifest> {
  const { classToken } = normalizeCharacterClass(classTokenOrId)
  const archives = new MountedArchives()
  for (const name of MOUNTS) {
    const fullPath = join(archiveDir, name)
    if (!existsSync(fullPath)) {
      throw new Error(`Required MPQ archive missing: ${fullPath}`)
    }
    const archive = await MpqArchive.open(await fileSource(fullPath))
    archives.add(name, archive)
  }

  const animDataPath = join(outDir, 'anim', 'animdata.json')
  if (!existsSync(animDataPath)) {
    throw new Error(`Missing ${animDataPath}. Run 'npm run pack:animdata' first.`)
  }
  const animData = JSON.parse(readFileSync(animDataPath, 'utf8')) as {
    clips: Record<string, { frames: number; speed: number; events?: [number, number][] }>
  }

  const charOutDir = join(outDir, 'chars', classToken)
  const layersOutDir = join(charOutDir, 'layers')
  await mkdir(layersOutDir, { recursive: true })

  const charPrefix = `data\\global\\chars\\${classToken}\\`
  const cofPrefix = `${charPrefix}cof\\`

  // 1. Collect all members under data\global\chars\<classToken>\
  const allMembers = await archives.listFiles()
  const cofPaths: string[] = []
  const dccByCompVariant = new Map<string, { modeWclass: string; path: string }[]>()

  for (const member of allMembers) {
    const norm = member.replace(/\//g, '\\')
    const lower = norm.toLowerCase()
    if (!lower.startsWith(charPrefix)) continue

    if (lower.startsWith(cofPrefix) && lower.endsWith('.cof')) {
      cofPaths.push(norm)
      continue
    }

    if (lower.endsWith('.dcc')) {
      // Format: data\global\chars\<token>\<comp>\<token><comp><variant><mode><wclass>.dcc
      const parts = lower.split('\\')
      if (parts.length !== 6) continue
      const comp = parts[4]!
      const fileName = parts[5]!
      const baseName = fileName.slice(0, -4) // strip .dcc
      if (!baseName.startsWith(`${classToken}${comp}`) || baseName.length !== 12) continue
      const variant = baseName.slice(4, 7)
      const modeWclass = baseName.slice(7, 12).toUpperCase()
      const key = `${comp}-${variant}`
      const list = dccByCompVariant.get(key) ?? []
      list.push({ modeWclass, path: norm })
      dccByCompVariant.set(key, list)
    }
  }

  cofPaths.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  // 2. Pack meta.bin (COFs + Palette shift .dat files)
  const metaChunks: Uint8Array[] = []
  let metaOffset = 0
  const cofs: Record<string, [number, number]> = {}
  const animClips: Record<string, { speed: number; events: [number, number][] }> = {}

  for (const cofPath of cofPaths) {
    const fileName = cofPath.split('\\').pop()!
    const cofToken = fileName.slice(0, -4).toUpperCase()
    const bytes = await archives.read(cofPath)
    cofs[cofToken] = [metaOffset, bytes.byteLength]
    metaChunks.push(bytes)
    metaOffset += bytes.byteLength

    const clipRec = animData.clips[cofToken]
    animClips[cofToken] = {
      speed: clipRec?.speed ?? 256,
      events: clipRec?.events ?? [],
    }
  }

  const palettes: Record<number, [number, number]> = {}
  for (let transIdx = 1; transIdx <= 8; transIdx += 1) {
    const palPath = PALETTE_SHIFT_FILES[transIdx]!
    const bytes = await archives.read(palPath)
    if (bytes.byteLength !== 21 * 256) {
      throw new Error(`Unexpected palette shift size for ${palPath}: ${bytes.byteLength} (expected 5376)`)
    }
    palettes[transIdx] = [metaOffset, bytes.byteLength]
    metaChunks.push(bytes)
    metaOffset += bytes.byteLength
  }

  const metaBin = new Uint8Array(metaOffset)
  let cursor = 0
  for (const chunk of metaChunks) {
    metaBin.set(chunk, cursor)
    cursor += chunk.byteLength
  }
  await writeFileAtomic(join(charOutDir, 'meta.bin'), metaBin)

  // 3. Pack each <comp>-<variant>.bin
  const sortedLayerKeys = [...dccByCompVariant.keys()].sort()
  const layers: Record<string, { file: string; dccs: Record<string, [number, number]> }> = {}

  let totalDccCount = 0
  let totalDccBytes = 0

  for (const key of sortedLayerKeys) {
    const entries = dccByCompVariant.get(key)!
    entries.sort((a, b) => a.modeWclass.localeCompare(b.modeWclass))

    const chunks: Uint8Array[] = []
    let offset = 0
    const dccs: Record<string, [number, number]> = {}

    for (const entry of entries) {
      const bytes = await archives.read(entry.path)
      dccs[entry.modeWclass] = [offset, bytes.byteLength]
      chunks.push(bytes)
      offset += bytes.byteLength
      totalDccCount += 1
    }

    const layerBin = new Uint8Array(offset)
    let pos = 0
    for (const chunk of chunks) {
      layerBin.set(chunk, pos)
      pos += chunk.byteLength
    }

    const relFile = `layers/${key}.bin`
    await writeFileAtomic(join(charOutDir, relFile), layerBin)
    layers[key] = { file: relFile, dccs }
    totalDccBytes += offset
  }

  const manifest: SorceressLayerPackManifest = {
    schema: 1,
    metaFile: 'meta.bin',
    cofs,
    palettes,
    animClips,
    layers,
  }

  const manifestRelFile = 'manifest.json'
  await writeFileAtomic(join(charOutDir, manifestRelFile), JSON.stringify(manifest))
  console.log(
    `Packed character (${classToken}) paperdoll layers -> ${charOutDir}: ${Object.keys(cofs).length} COFs, 8 Palette tables (${(metaOffset / 1024).toFixed(1)} KB meta.bin), ${sortedLayerKeys.length} layer packs (${totalDccCount} DCCs, ${(totalDccBytes / 1024 / 1024).toFixed(2)} MB)`,
  )
  return manifest
}

export async function packSorceressLayers(
  archiveDir = 'samples/d2',
  outDir = 'public',
): Promise<SorceressLayerPackManifest> {
  return packCharacterLayers('so', archiveDir, outDir)
}

/**
 * Bakes the modular paperdoll layer packs for every playable class
 * (`public/chars/<token>/`).
 */
export async function packAllCharacterLayerPacks(
  archiveDir = 'samples/d2',
  outDir = 'public',
): Promise<void> {
  for (const token of PLAYER_CLASS_TOKENS) {
    await packCharacterLayers(token, archiveDir, outDir)
  }
}

export { PLAYER_CLASS_TOKENS }

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argToken = process.argv[2] ?? 'all'
  const run = argToken === 'all'
    ? packAllCharacterLayerPacks()
    : packCharacterLayers(argToken)
  run.catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
