/**
 * Bake character, monster, Town NPC, and interactive object animations into
 * web-native indexed PNG and raw R8 atlases (Schema 2).
 *
 * Pre-packing entity animations into `<outDir>/entities/` (`public/entities/`)
 * eliminates runtime HTTP Range requests to
 * `d2char.mpq` / `d2data.mpq` / `d2exp.mpq` and removes JS-side DCC/DC6/COF
 * decompression & compositing during level boot and online server snapshots.
 */
import { mkdir, writeFile, rename, copyFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isMainThread, Worker, parentPort, workerData } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import { availableParallelism } from 'node:os'
import { performance } from 'node:perf_hooks'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { decodePl2 } from '../../common/formats/pl2.ts'
import {
  compositeMonsterAnimation,
  compositeObjectAnimation,
  TARGET_MONSTER_MODES,
  TARGET_OBJECT_MODES,
  type CofLayerDrawBlendMode,
  type MonsterAnimationSheet,
} from '../../common/units/monster-art.ts'
import { ACT_MONSTER_SPECS, MONSTER_ART_MAP, resolveMonsterArtSpec } from '../../common/units/monster-mapping.ts'
import {
  MONSTER_COMPONENT_VARIANT_BAKES_113C,
  monsterComponentVariantKey113c,
  monsterComponentVariantOverrides113c,
} from '../../common/units/monster-component-variants-113c.ts'
import {
  CANONICAL_SUPER_UNIQUE_LANDMARKS,
  CANONICAL_SUPERUNIQUES_TABLE,
  readSuperUniques,
} from '../../common/units/monsters-data.ts'
import { TOWN_NPC_DESCRIPTORS } from '../../common/units/npc-table.ts'
import { loadObjectsTable, OBJECT_MODE_TOKENS, type ObjectsRow } from '../../common/units/objects.ts'
import { OBJECT_LOOKUP_ROWS } from '../../common/units/object-lookup-data.ts'
import { OBJECT_TYPE_OBJECT } from '../../common/units/object-lookup.ts'
import { parseTable, cell } from '../../common/world/acts.ts'
import type {
  ClipMeta,
  EntityAtlasPage,
  EntityFrameTuple,
  MonsterIndexEntry,
  ObjectIndexEntry,
  ObjectLookupIndexEntry,
  PackedEntityIndexEntry,
} from '../../common/pack-contract/index.ts'
import { ENTITY_ATLAS_MAX_PAGE_HEIGHT } from '../../common/pack-contract/index.ts'
import type { SpriteSheet, SpriteGroup } from '../../common/formats/sprite.ts'
import { encodeIndexedPng } from '../io/png.ts'
import { bakeAnimData } from './pack-animdata.ts'

function makeEmptyGlowGroups(baseSheet: SpriteSheet): SpriteGroup[] {
  return baseSheet.groups.map(g => ({
    frames: g.frames.map(f => ({
      width: 1,
      height: 1,
      indices: new Uint8Array(1),
      mask: new Uint8Array(1),
      ...(f.anchorX !== undefined ? { anchorX: f.anchorX } : {}),
      ...(f.anchorY !== undefined ? { anchorY: f.anchorY } : {}),
    })),
  }))
}

const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
const PAGE_SIZE = 4096

const LOOPING_MONSTER_MODES = new Set(['nu', 'wl', 'rn', 'on'])
const LOOPING_OBJECT_MODES = new Set(['nu', 'on'])

async function writeFileAtomic(targetPath: string, content: string | Uint8Array): Promise<void> {
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Math.random().toString(36).slice(2)}`
  await writeFile(tmpPath, content)
  await rename(tmpPath, targetPath)
}

async function writeJsonAtomic(targetPath: string, data: unknown): Promise<void> {
  await writeFileAtomic(targetPath, JSON.stringify(data))
}

function findOpaqueBlackIndex(palette: Uint8Array): number {
  let bestIdx = 1
  let bestDist = Infinity
  for (let i = 1; i < 256; i += 1) {
    const r = palette[i * 3]!
    const g = palette[i * 3 + 1]!
    const b = palette[i * 3 + 2]!
    const dist = r * r + g * g + b * b
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
      if (dist === 0) break
    }
  }
  return bestIdx
}

export interface PackedEntitySheet {
  readonly png: Uint8Array
  readonly width: number
  readonly height: number
  readonly groups: [number, number, number, number, number, number][][]
}

export interface PackedEntityR8 {
  readonly r8: Uint8Array
  readonly width: number
  readonly height: number
  readonly groups: [number, number, number, number, number, number][][]
}

export interface PackedEntityR8Page {
  readonly r8: Uint8Array
  readonly width: number
  readonly height: number
}

export interface PackedEntityR8Pages {
  readonly pages: readonly PackedEntityR8Page[]
  /** `[x, y, width, height, anchorX, anchorY, page]` per frame. */
  readonly groups: [number, number, number, number, number, number, number][][]
}

/**
 * Shelf-pack all frames of a SpriteSheet into one or more raw 8-bit index pages (`gl.R8`).
 * A new page is opened whenever the next shelf would grow the current page past
 * `maxPageHeight` rows, so every page stays uploadable as a single texture.
 * Index 0 represents transparency; opaque pixels with original index 0 are remapped to `opaqueBlack`.
 */
export function packSheetToR8Pages(
  sheet: SpriteSheet,
  opaqueBlack = 172,
  maxPageHeight: number = ENTITY_ATLAS_MAX_PAGE_HEIGHT,
): PackedEntityR8Pages {
  const frames = sheet.groups.flatMap(g => g.frames)
  const widest = Math.max(1, ...frames.map(f => f.width))
  const area = frames.reduce((sum, f) => sum + (f.width + 1) * (f.height + 1), 0)
  let pageWidth = Math.min(PAGE_SIZE, Math.max(widest + 2, 512))
  while (pageWidth < PAGE_SIZE && pageWidth * pageWidth < area * 1.15) {
    pageWidth *= 2
  }
  pageWidth = Math.min(PAGE_SIZE, pageWidth)

  let page = 0
  let cursorX = 0
  let shelfY = 0
  let shelfHeight = 0
  const pageHeights: number[] = [0]
  const placements: { x: number; y: number; width: number; height: number; page: number }[] = []

  for (const frame of frames) {
    const w = Math.max(1, Math.min(frame.width, pageWidth))
    const h = Math.max(1, Math.min(frame.height, PAGE_SIZE, maxPageHeight))
    if (cursorX + w > pageWidth) {
      shelfY += shelfHeight + 1
      shelfHeight = 0
      cursorX = 0
    }
    if (shelfY + h > maxPageHeight) {
      page += 1
      pageHeights.push(0)
      shelfY = 0
      shelfHeight = 0
      cursorX = 0
    }
    placements.push({ x: cursorX, y: shelfY, width: w, height: h, page })
    cursorX += w + 1
    shelfHeight = Math.max(shelfHeight, h)
    pageHeights[page] = Math.max(pageHeights[page]!, shelfY + shelfHeight)
  }

  const pages: PackedEntityR8Page[] = pageHeights.map(height => {
    const pageHeight = Math.max(1, height)
    return { r8: new Uint8Array(pageWidth * pageHeight), width: pageWidth, height: pageHeight }
  })

  let idx = 0
  for (const frame of frames) {
    const place = placements[idx]!
    idx += 1
    const r8 = pages[place.page]!.r8
    for (let row = 0; row < place.height; row += 1) {
      const fromRow = row * frame.width
      const toRow = (place.y + row) * pageWidth + place.x
      for (let col = 0; col < place.width; col += 1) {
        const srcAt = fromRow + col
        if (frame.mask[srcAt] === 0) {
          r8[toRow + col] = 0
        } else {
          const val = frame.indices[srcAt]!
          r8[toRow + col] = val === 0 ? opaqueBlack : val
        }
      }
    }
  }

  const groups: [number, number, number, number, number, number, number][][] = []
  let consumed = 0
  for (const group of sheet.groups) {
    const gList: [number, number, number, number, number, number, number][] = []
    for (let i = 0; i < group.frames.length; i += 1) {
      const p = placements[consumed]!
      const f = group.frames[i]!
      consumed += 1
      gList.push([p.x, p.y, p.width, p.height, f.anchorX ?? 0, f.anchorY ?? 0, p.page])
    }
    groups.push(gList)
  }

  return { pages, groups }
}

/**
 * Shelf-pack all frames of a SpriteSheet into a single raw 8-bit index buffer (`gl.R8`).
 * Index 0 represents transparency; opaque pixels with original index 0 are remapped to 172 (`rgb(4,4,4)`).
 * Each frame tuple stores [x, y, width, height, anchorX, anchorY] (Schema 2).
 * The page is unbounded in height; entity packs use {@link packSheetToR8Pages}.
 */
export function packSheetToR8(sheet: SpriteSheet, opaqueBlack = 172): PackedEntityR8 {
  const packed = packSheetToR8Pages(sheet, opaqueBlack, Number.POSITIVE_INFINITY)
  const only = packed.pages[0]!
  return {
    r8: only.r8,
    width: only.width,
    height: only.height,
    groups: packed.groups.map(g => g.map(([x, y, w, h, ax, ay]) => [x, y, w, h, ax, ay] as [number, number, number, number, number, number])),
  }
}

/** Page `0` keeps the historical `<slug>.r8` name; extra pages are `<slug>.p<N>.r8`. */
export function entityAtlasPageFileName(slug: string, page: number): string {
  return page === 0 ? `${slug}.r8` : `${slug}.p${String(page)}.r8`
}

/**
 * Write every page of a packed entity atlas and return the JSON fields that
 * describe it. Single-page packs keep the exact historical schema (no `pages`,
 * 6-element frame tuples); multi-page packs add `pages` and a 7th page index.
 */
async function writeEntityR8Pages(
  dir: string,
  slug: string,
  packed: PackedEntityR8Pages,
): Promise<{
  readonly file: string
  readonly width: number
  readonly height: number
  readonly pages?: EntityAtlasPage[]
  readonly groups: EntityFrameTuple[][]
}> {
  const multi = packed.pages.length > 1
  const pages: EntityAtlasPage[] = []
  for (let i = 0; i < packed.pages.length; i += 1) {
    const p = packed.pages[i]!
    const file = entityAtlasPageFileName(slug, i)
    await writeFileAtomic(join(dir, file), p.r8)
    pages.push({ file, width: p.width, height: p.height })
  }
  const first = pages[0]!
  return {
    file: first.file,
    width: first.width,
    height: first.height,
    ...(multi ? { pages } : {}),
    groups: packed.groups.map(g =>
      g.map(([x, y, w, h, ax, ay, page]): EntityFrameTuple => (multi ? [x, y, w, h, ax, ay, page] : [x, y, w, h, ax, ay])),
    ),
  }
}

/**
 * Shelf-pack all frames of a SpriteSheet into a single indexed PNG buffer.
 */
export function packSheetToPng(sheet: SpriteSheet, palette: Uint8Array): PackedEntitySheet {
  const opaqueBlack = findOpaqueBlackIndex(palette)
  const packed = packSheetToR8(sheet, opaqueBlack)
  const png = encodeIndexedPng({
    width: packed.width,
    height: packed.height,
    pixels: packed.r8,
    palette,
    transparentIndex: 0,
  })
  return { png, width: packed.width, height: packed.height, groups: packed.groups }
}

export interface MonsterJob {
  readonly type: 'monster'
  readonly jobId: number
  readonly key: string
  readonly token: string
  readonly weapon: string
  readonly allowedModes: readonly string[]
  readonly acts: readonly number[]
  readonly archiveDir: string
  readonly outDir: string
  /** Per-unit MonStats2 component variants (see `monster-component-variants-113c.ts`), e.g. `{ s4: 'pos', s5: 'pos' }`. */
  readonly componentVariants?: Readonly<Record<string, string>> | undefined
}

export interface ObjectJob {
  readonly type: 'object'
  readonly jobId: number
  readonly slug: string
  readonly token: string
  readonly baseIsMonsters: boolean
  readonly acts: readonly number[]
  readonly frameDeltas?: readonly number[]
  readonly cycleAnims?: readonly number[]
  readonly archiveDir: string
  readonly outDir: string
}

export type EntityJob = MonsterJob | ObjectJob

export interface MonsterResult {
  readonly type: 'monster'
  readonly jobId: number
  readonly key: string
  readonly token: string
  readonly weapon: string
  readonly skipped?: boolean
  readonly file?: string
  readonly format?: 'r8' | 'png'
  readonly width?: number
  readonly height?: number
  readonly directions?: number
  readonly standOffset?: number
  readonly walkOffset?: number
  readonly standFrames?: number
  readonly walkFrames?: number
  readonly blendMode?: CofLayerDrawBlendMode
  readonly modes?: readonly string[]
}

export interface ObjectResult {
  readonly type: 'object'
  readonly jobId: number
  readonly slug: string
  readonly token: string
  readonly baseIsMonsters: boolean
  readonly skipped?: boolean
  readonly file?: string
  readonly format?: 'r8' | 'png'
  readonly width?: number
  readonly height?: number
  readonly directions?: number
  readonly standOffset?: number
  readonly standFrames?: number
  readonly blendMode?: CofLayerDrawBlendMode
  readonly modes?: readonly string[]
}

export type EntityResult = MonsterResult | ObjectResult

class EntityWorkerContext {
  public readonly archives: MountedArchives
  public readonly animData: any
  public readonly monstats2: any
  public readonly palettes: Record<number, Uint8Array>

  constructor(
    archives: MountedArchives,
    animData: any,
    monstats2: any,
    palettes: Record<number, Uint8Array>,
  ) {
    this.archives = archives
    this.animData = animData
    this.monstats2 = monstats2
    this.palettes = palettes
  }

  static async create(archiveDir: string, outDir: string): Promise<EntityWorkerContext> {
    const archives = new MountedArchives()
    for (const name of MOUNTS) {
      try {
        const archive = await MpqArchive.open(await fileSource(join(archiveDir, name)))
        archives.add(name, archive)
      } catch (err) {
        console.warn(`skip ${name}: ${(err as Error).message}`)
      }
    }

    const palettes: Record<number, Uint8Array> = {}
    for (let act = 1; act <= 5; act += 1) {
      try {
        const pl2Bytes = await archives.read(`data\\global\\palette\\act${String(act)}\\pal.pl2`)
        palettes[act] = decodePl2(pl2Bytes).rgb
      } catch (err) {
        console.warn(`Act ${act} palette load skipped: ${(err as Error).message}`)
      }
    }

    const animDataJsonPath = join(outDir, 'anim', 'animdata.json')
    const monstats2JsonPath = join(outDir, 'anim', 'monstats2.json')
    if (!existsSync(animDataJsonPath) || !existsSync(monstats2JsonPath)) {
      throw new Error(`AnimData or MonStats2 JSON missing in ${join(outDir, 'anim')}. Run 'npm run pack:animdata' first.`)
    }
    const animData = JSON.parse(readFileSync(animDataJsonPath, 'utf8'))
    const monstats2 = JSON.parse(readFileSync(monstats2JsonPath, 'utf8'))

    return new EntityWorkerContext(archives, animData, monstats2, palettes)
  }
}

async function processMonsterJob(job: MonsterJob, ctx: EntityWorkerContext): Promise<MonsterResult> {
  const { archives, animData } = ctx
  const { key, token, weapon, outDir, jobId, componentVariants } = job
  const globalEntityDir = join(outDir, 'entities')

  const monSheets: { mode: string; sheet: MonsterAnimationSheet }[] = []
  for (const mode of TARGET_MONSTER_MODES) {
    try {
      const anim = await compositeMonsterAnimation(archives, token, mode, weapon, componentVariants)
      monSheets.push({ mode, sheet: anim })
    } catch (err) {
      // Mode COF not found for this monster; skip. A variant bake must not silently drop a mode on other errors.
      if (componentVariants !== undefined && !String((err as Error).message).startsWith('Monster COF not found')) {
        throw err
      }
    }
  }

  if (monSheets.length === 0) {
    return { type: 'monster', jobId, key, token, weapon, skipped: true }
  }

  const clips: Record<string, ClipMeta> = {}

  let groupOffset = 0
  let baseDirections = 8
  for (const { mode, sheet } of monSheets) {
    const animKey = `${token.toUpperCase()}${mode.toUpperCase()}${weapon.toUpperCase()}`
    const animHthKey = `${token.toUpperCase()}${mode.toUpperCase()}HTH`
    const animRecord = animData.clips[animKey] ?? animData.clips[animHthKey]
    const speed = animRecord?.speed && animRecord.speed > 0 ? animRecord.speed : 256
    const events = (animRecord?.events ?? []).map(([f, c]: [number, number]) => ({ f, c }))

    clips[mode] = {
      group: groupOffset,
      directions: sheet.directions,
      frames: sheet.framesPerDirection,
      speed,
      loop: LOOPING_MONSTER_MODES.has(mode),
      events,
    }
    if (mode === 'nu') {
      baseDirections = sheet.directions
    }
    groupOffset += sheet.sheet.groups.length
  }

  if (!clips.nu) {
    const firstClip = Object.values(clips)[0]!
    clips.nu = { ...firstClip, loop: true }
    baseDirections = firstClip.directions
  }

  const hasGlow = monSheets.some(s => s.sheet.glowSheet !== undefined)
  const primarySheets = monSheets.filter(s => s.mode === 'nu' || s.mode === 'wl')
  const sheetsForBlend = primarySheets.length > 0 ? primarySheets : monSheets.slice(0, 1)
  const monsterBlendMode: CofLayerDrawBlendMode = !hasGlow
    ? (sheetsForBlend.find(s => s.sheet.blendMode !== undefined && s.sheet.blendMode !== 'normal')?.sheet.blendMode ?? 'normal')
    : 'normal'

  const glowClips: Record<string, ClipMeta> = {}

  if (hasGlow) {
    for (const { mode, sheet } of monSheets) {
      if (sheet.glowSheet !== undefined) {
        glowClips[mode] = { ...clips[mode]! }
      }
    }
    const firstGlow = Object.values(glowClips)[0]
    if (!glowClips.nu && firstGlow !== undefined && firstGlow.group === clips.nu.group) {
      glowClips.nu = { ...firstGlow }
    }
  }

  const baseGroups = monSheets.flatMap(s => s.sheet.sheet.groups)
  const baseCount = baseGroups.length

  const allGlowGroups = hasGlow
    ? monSheets.flatMap(s => s.sheet.glowSheet?.groups ?? makeEmptyGlowGroups(s.sheet.sheet))
    : []

  const joinedSheet: SpriteSheet = {
    groups: hasGlow ? [...baseGroups, ...allGlowGroups] : baseGroups,
    width: null,
  }

  const packedMon = packSheetToR8Pages(joinedSheet, 172)
  const jsonFileName = `monster-${key}.json`
  const written = await writeEntityR8Pages(globalEntityDir, `monster-${key}`, packedMon)
  const packedBaseGroups = written.groups.slice(0, baseCount)
  const packedGlowGroups = hasGlow ? written.groups.slice(baseCount) : undefined

  const metaPayload = {
    schema: 2,
    token,
    weapon,
    file: written.file,
    format: 'r8',
    blendMode: monsterBlendMode,
    width: written.width,
    height: written.height,
    ...(written.pages !== undefined ? { pages: written.pages } : {}),
    directions: baseDirections,
    clips,
    modes: clips,
    ...(hasGlow ? { glowClips } : {}),
    ...(clips.wl ? { walkOffset: clips.wl.group, walkFrames: clips.wl.frames } : {}),
    standOffset: clips.nu.group,
    standFrames: clips.nu.frames,
    groups: packedBaseGroups,
    ...(hasGlow ? { glowGroups: packedGlowGroups } : {}),
  }

  await writeJsonAtomic(join(globalEntityDir, jsonFileName), metaPayload)

  return {
    type: 'monster',
    jobId,
    key,
    token,
    weapon,
    file: written.file,
    format: 'r8',
    width: written.width,
    height: written.height,
    directions: baseDirections,
    standOffset: clips.nu.group,
    walkOffset: clips.wl?.group,
    standFrames: clips.nu.frames,
    walkFrames: clips.wl?.frames,
    blendMode: monsterBlendMode,
    modes: Object.keys(clips),
  }
}

async function processObjectJob(job: ObjectJob, ctx: EntityWorkerContext): Promise<ObjectResult> {
  const { archives, animData } = ctx
  const { slug, token, baseIsMonsters, frameDeltas, cycleAnims, outDir, jobId } = job
  const globalEntityDir = join(outDir, 'entities')

  const objSheets: { mode: string; modeIdx: number; sheet: MonsterAnimationSheet }[] = []
  for (let modeIdx = 0; modeIdx < TARGET_OBJECT_MODES.length; modeIdx += 1) {
    const mode = TARGET_OBJECT_MODES[modeIdx]!
    try {
      const anim = await compositeObjectAnimation(archives, token, mode, baseIsMonsters)
      objSheets.push({ mode, modeIdx, sheet: anim })
    } catch {
      // Mode COF not found for this object; skip
    }
  }

  if (objSheets.length === 0) {
    return { type: 'object', jobId, slug, token, baseIsMonsters, skipped: true }
  }

  const clips: Record<string, ClipMeta> = {}
  let groupOffset = 0
  let baseDirections = 1

  for (const { mode, modeIdx, sheet } of objSheets) {
    const animHthKey = `${token.toUpperCase()}${mode.toUpperCase()}HTH`
    const animObjKey = `${token.toUpperCase()}${mode.toUpperCase()}`
    const animRecord = animData.clips[animHthKey] ?? animData.clips[animObjKey]
    const rowDelta = frameDeltas?.[modeIdx] ?? 0
    const speed = animRecord?.speed ?? (rowDelta > 0 ? rowDelta : 256)
    const events = (animRecord?.events ?? []).map(([f, c]: [number, number]) => ({ f, c }))
    const cycleFlag = cycleAnims?.[modeIdx]
    const loop = cycleFlag !== undefined ? cycleFlag !== 0 : LOOPING_OBJECT_MODES.has(mode)

    clips[mode] = {
      group: groupOffset,
      directions: sheet.directions,
      frames: sheet.framesPerDirection,
      speed,
      loop,
      events,
    }
    if (mode === 'nu') {
      baseDirections = sheet.directions
    }
    groupOffset += sheet.sheet.groups.length
  }

  if (!clips.nu) {
    const firstClip = Object.values(clips)[0]!
    clips.nu = { ...firstClip }
    baseDirections = firstClip.directions
  }

  const hasGlow = objSheets.some(s => s.sheet.glowSheet !== undefined)
  const objectBlendMode: CofLayerDrawBlendMode = !hasGlow
    ? (objSheets.find(s => s.sheet.blendMode !== undefined && s.sheet.blendMode !== 'normal')?.sheet.blendMode ?? 'normal')
    : 'normal'

  const glowClips: Record<string, ClipMeta> = {}
  if (hasGlow) {
    for (const { mode, sheet } of objSheets) {
      if (sheet.glowSheet !== undefined) {
        glowClips[mode] = { ...clips[mode]! }
      }
    }
    const firstGlow = Object.values(glowClips)[0]
    if (!glowClips.nu && firstGlow !== undefined && firstGlow.group === clips.nu.group) {
      glowClips.nu = { ...firstGlow }
    }
  }

  const baseGroups = objSheets.flatMap(s => s.sheet.sheet.groups)
  const baseCount = baseGroups.length

  const allGlowGroups = hasGlow
    ? objSheets.flatMap(s => s.sheet.glowSheet?.groups ?? makeEmptyGlowGroups(s.sheet.sheet))
    : []

  const joinedSheet: SpriteSheet = {
    groups: hasGlow ? [...baseGroups, ...allGlowGroups] : baseGroups,
    width: null,
  }

  const packedObj = packSheetToR8Pages(joinedSheet, 172)
  const jsonFileName = `object-${slug}.json`
  const written = await writeEntityR8Pages(globalEntityDir, `object-${slug}`, packedObj)
  const packedBaseGroups = written.groups.slice(0, baseCount)
  const packedGlowGroups = hasGlow ? written.groups.slice(baseCount) : undefined

  const metaPayload = {
    schema: 2,
    token,
    baseIsMonsters,
    anchorZeroed: true,
    file: written.file,
    format: 'r8',
    blendMode: objectBlendMode,
    width: written.width,
    height: written.height,
    ...(written.pages !== undefined ? { pages: written.pages } : {}),
    directions: baseDirections,
    clips,
    modes: clips,
    ...(hasGlow ? { glowClips } : {}),
    standOffset: clips.nu.group,
    standFrames: clips.nu.frames,
    groups: packedBaseGroups,
    ...(hasGlow ? { glowGroups: packedGlowGroups } : {}),
  }

  await writeJsonAtomic(join(globalEntityDir, jsonFileName), metaPayload)

  return {
    type: 'object',
    jobId,
    slug,
    token,
    baseIsMonsters,
    file: written.file,
    format: 'r8',
    width: written.width,
    height: written.height,
    directions: baseDirections,
    standOffset: clips.nu.group,
    standFrames: clips.nu.frames,
    blendMode: objectBlendMode,
    modes: Object.keys(clips),
  }
}

async function processJob(job: EntityJob, ctx: EntityWorkerContext): Promise<EntityResult> {
  if (job.type === 'object') {
    return await processObjectJob(job, ctx)
  }
  return await processMonsterJob(job, ctx)
}

async function runWorkerPool(
  jobs: readonly EntityJob[],
  numWorkers: number,
  archiveDir: string,
  outDir: string,
): Promise<EntityResult[]> {
  return new Promise((resolvePromise, reject) => {
    const bootstrap = `
      import { register } from 'tsx/esm/api'
      register()
      import(${JSON.stringify(import.meta.url)})
    `
    const results: EntityResult[] = new Array(jobs.length)
    const queue = [...jobs]
    let completedCount = 0
    let shuttingDown = false
    let isDone = false

    const workers: Worker[] = []

    const cleanup = () => {
      if (isDone) return
      isDone = true
      shuttingDown = true
      for (const w of workers) {
        w.terminate().catch(() => {})
      }
    }

    const abort = (err: Error) => {
      if (shuttingDown) return
      cleanup()
      reject(err)
    }

    const assignNextJob = (worker: Worker) => {
      if (shuttingDown) return
      if (queue.length > 0) {
        const nextJob = queue.shift()!
        worker.postMessage({ type: 'job', job: nextJob })
      } else if (completedCount === jobs.length) {
        cleanup()
        resolvePromise(results)
      }
    }

    for (let i = 0; i < numWorkers; i += 1) {
      const worker = new Worker(bootstrap, {
        eval: true,
        execArgv: ['--import', 'tsx'],
        workerData: { archiveDir, outDir, workerId: i + 1 },
      })

      worker.on('message', (msg: { type: string; result?: EntityResult; label?: string; message?: string; stack?: string }) => {
        if (shuttingDown) return
        if (msg.type === 'ready') {
          assignNextJob(worker)
        } else if (msg.type === 'result') {
          const res = msg.result!
          results[res.jobId] = res
          completedCount += 1
          if (completedCount % 50 === 0 || completedCount === jobs.length) {
            const label =
              res.type === 'monster'
                ? `monster-${res.key}`
                : `object-${res.slug}`
            console.log(`[${String(completedCount).padStart(3)}/${String(jobs.length)}] Packed ${label}`)
          }
          assignNextJob(worker)
        } else if (msg.type === 'error') {
          console.error(`\n❌ Error packing entity ${msg.label ?? ''}: ${msg.message ?? ''}`)
          if (msg.stack) console.error(msg.stack)
          abort(new Error(`Worker failed on entity ${msg.label ?? ''}: ${msg.message ?? ''}`))
        }
      })

      worker.on('error', (err) => {
        console.error(`\n❌ Worker thread fatal error: ${err.message}`, err.stack)
        abort(err)
      })

      worker.on('exit', (code) => {
        if (code !== 0 && !shuttingDown) {
          abort(new Error(`Worker thread exited unexpectedly with code ${String(code)}`))
        }
      })

      workers.push(worker)
    }
  })
}

function startWorker(): void {
  process.on('unhandledRejection', (reason) => {
    console.error('Worker unhandled rejection:', reason)
    parentPort?.postMessage({
      type: 'error',
      jobId: -1,
      label: 'unhandled-rejection',
      message: String(reason),
      stack: (reason as Error)?.stack,
    })
  })

  const data = (workerData ?? {}) as { archiveDir?: string; outDir?: string; workerId?: number }
  const archiveDir = data.archiveDir ?? 'samples/d2'
  const outDir = data.outDir ?? 'public'

  let ctxPromise: Promise<EntityWorkerContext> | null = null

  parentPort?.on('message', async (msg: { type: string; job?: EntityJob }) => {
    if (msg.type === 'job' && msg.job) {
      try {
        if (!ctxPromise) {
          ctxPromise = EntityWorkerContext.create(
            msg.job.archiveDir || archiveDir,
            msg.job.outDir || outDir,
          )
        }
        const ctx = await ctxPromise
        const result = await processJob(msg.job, ctx)
        parentPort?.postMessage({ type: 'result', result })
      } catch (err) {
        const job = msg.job
        const label =
          job.type === 'monster'
            ? job.key
            : `object-${job.slug}`
        parentPort?.postMessage({
          type: 'error',
          jobId: job.jobId,
          label,
          message: (err as Error).message,
          stack: (err as Error).stack,
        })
      }
    } else if (msg.type === 'shutdown') {
      process.exit(0)
    }
  })

  // Pre-initialize context and signal ready
  ctxPromise = EntityWorkerContext.create(archiveDir, outDir)
  ctxPromise
    .then(() => {
      parentPort?.postMessage({ type: 'ready' })
    })
    .catch((err) => {
      parentPort?.postMessage({
        type: 'error',
        jobId: -1,
        label: 'worker-init',
        message: (err as Error).message,
        stack: (err as Error).stack,
      })
    })
}

/**
 * Rebake one monster pack (`monster-<key>.{json,r8[,pN.r8]}`) through the exact
 * production job path, e.g. after a packer change that only affects a few
 * oversized packs. Requires `<outDir>/anim/{animdata,monstats2}.json`.
 * Does not touch `entities/index.json`: the class -> key mapping is unchanged.
 */
export async function bakeSingleMonster(
  archiveDir: string,
  outDir: string,
  token: string,
  weapon: string,
  key: string,
): Promise<MonsterResult> {
  await mkdir(join(outDir, 'entities'), { recursive: true })
  const ctx = await EntityWorkerContext.create(archiveDir, outDir)
  const res = await processMonsterJob(
    { type: 'monster', jobId: 0, key, token, weapon, allowedModes: [...TARGET_MONSTER_MODES], acts: [], archiveDir, outDir },
    ctx,
  )
  if (res.skipped) throw new Error(`monster ${token}/${weapon}: no COF found for any of ${TARGET_MONSTER_MODES.join(',')}`)
  return res
}

/**
 * One monster job per (MonStats2 component-variant bake, variant index): `monster-<token>-<weapon>-<comps><variant>`.
 * The client picks these from the unit's 0xAC component bytes (`resolveMonsterComponentVariantKey113c`).
 */
export function buildMonsterComponentVariantJobs113c(archiveDir: string, outDir: string): MonsterJob[] {
  const jobs: MonsterJob[] = []
  for (const bake of MONSTER_COMPONENT_VARIANT_BAKES_113C) {
    bake.variants.forEach((_, idx) => {
      jobs.push({
        type: 'monster',
        jobId: 0,
        key: monsterComponentVariantKey113c(bake, idx),
        token: bake.token,
        weapon: bake.weapon,
        componentVariants: monsterComponentVariantOverrides113c(bake, idx),
        allowedModes: [...TARGET_MONSTER_MODES],
        acts: [],
        archiveDir,
        outDir,
      })
    })
  }
  return jobs
}

/**
 * Bake only the component-variant monster packs (does not touch `entities/index.json`; the variant packs are
 * resolved by key on the client). Requires `<outDir>/anim/{animdata,monstats2}.json`.
 */
export async function bakeMonsterComponentVariants113c(archiveDir: string, outDir: string): Promise<MonsterResult[]> {
  await mkdir(join(outDir, 'entities'), { recursive: true })
  const ctx = await EntityWorkerContext.create(archiveDir, outDir)
  const results: MonsterResult[] = []
  for (const job of buildMonsterComponentVariantJobs113c(archiveDir, outDir)) {
    const res = await processMonsterJob(job, ctx)
    if (res.skipped) throw new Error(`monster variant ${job.key}: no COF found`)
    results.push(res)
  }
  return results
}

export async function bakeEntities(archiveDir = 'samples/d2', outDir = 'public'): Promise<void> {
  const monstats2JsonPath = join(outDir, 'anim', 'monstats2.json')
  const animDataJsonPath = join(outDir, 'anim', 'animdata.json')
  if (!existsSync(animDataJsonPath) || !existsSync(monstats2JsonPath)) {
    console.log(`AnimData/MonStats2 missing in ${join(outDir, 'anim')}; baking animdata first...`)
    await bakeAnimData(archiveDir, outDir)
  }
  const monstats2 = JSON.parse(readFileSync(monstats2JsonPath, 'utf8'))

  const globalEntityDir = join(outDir, 'entities')
  await mkdir(globalEntityDir, { recursive: true })

  // Mount archives once on main thread to parse MonStats.txt, MonStats2.txt, and Objects.txt
  const mainArchives = new MountedArchives()
  for (const name of MOUNTS) {
    try {
      const archive = await MpqArchive.open(await fileSource(join(archiveDir, name)))
      mainArchives.add(name, archive)
    } catch (err) {
      console.warn(`skip ${name}: ${(err as Error).message}`)
    }
  }

  const monstatsRaw = await mainArchives.read('data\\global\\excel\\monstats.txt')
  const monstats2Raw = await mainArchives.read('data\\global\\excel\\monstats2.txt')
  const monstatsTable = parseTable(monstatsRaw)
  const monstats2Table = parseTable(monstats2Raw)

  const baseWById = new Map<string, string>()
  const sizeXById = new Map<string, number>()
  const sizeYById = new Map<string, number>()
  for (const row of monstats2Table.rows) {
    const id = cell(monstats2Table, row, 'Id').trim().toLowerCase()
    if (!id || id === 'expansion') continue
    const bw = cell(monstats2Table, row, 'BaseW').trim().toLowerCase() || 'hth'
    baseWById.set(id, bw)
    sizeXById.set(id, Number(cell(monstats2Table, row, 'SizeX') || '1') || 1)
    sizeYById.set(id, Number(cell(monstats2Table, row, 'SizeY') || '1') || 1)
  }

  // 1. Collect all unique monster (token, weapon) specs and raw MonStats.txt rows (0..733)
  const uniqueSpecs = new Map<string, { token: string; weapon: string }>()
  interface RawMonStatsCatalogRow {
    readonly hcIdx: number
    readonly id: string
    readonly token: string
    readonly weapon: string
    readonly inTown: boolean
    readonly npc: boolean
    readonly interact: boolean
    readonly align: number
    readonly sizeX: number
    readonly sizeY: number
    readonly velocity: number
    readonly run: number
    readonly scale: number
    readonly baseCol: number
  }
  const rawMonsterCatalog: RawMonStatsCatalogRow[] = []

  for (const row of monstatsTable.rows) {
    const id = cell(monstatsTable, row, 'Id').trim()
    const hcIdxStr = cell(monstatsTable, row, 'hcIdx').trim()
    if (!id || id.toLowerCase() === 'expansion' || hcIdxStr === '') continue
    const hcIdx = Number(hcIdxStr)
    const lowerId = id.toLowerCase()
    const mapped = resolveMonsterArtSpec(lowerId)
    const rawCode = cell(monstatsTable, row, 'Code').trim().toUpperCase()
    const monStatsEx = cell(monstatsTable, row, 'MonStatsEx').trim().toLowerCase() || lowerId
    const token = (mapped?.token || rawCode).trim().toUpperCase()
    const weapon = (mapped?.weapon || baseWById.get(monStatsEx) || baseWById.get(lowerId) || 'hth').trim().toLowerCase()

    if (token) {
      const key = `${token.toLowerCase()}-${weapon.toLowerCase()}`
      if (!uniqueSpecs.has(key)) {
        uniqueSpecs.set(key, { token, weapon })
      }
    }

    rawMonsterCatalog.push({
      hcIdx,
      id: lowerId,
      token,
      weapon,
      inTown: cell(monstatsTable, row, 'InTown') === '1',
      npc: cell(monstatsTable, row, 'npc') === '1',
      interact: cell(monstatsTable, row, 'Interact') === '1',
      align: Number(cell(monstatsTable, row, 'Align') || '0') || 0,
      sizeX: sizeXById.get(monStatsEx) ?? sizeXById.get(lowerId) ?? 1,
      sizeY: sizeYById.get(monStatsEx) ?? sizeYById.get(lowerId) ?? 1,
      velocity: Number(cell(monstatsTable, row, 'Velocity') || '0') || 0,
      run: Number(cell(monstatsTable, row, 'Run') || '0') || 0,
      scale: Number(cell(monstatsTable, row, 'Scale') || '100') || 100,
      baseCol: Number(cell(monstatsTable, row, 'TransLvl') || '0') || 0,
    })
  }

  for (const spec of Object.values(MONSTER_ART_MAP)) {
    const tok = spec.token.trim().toUpperCase()
    const wep = spec.weapon.trim().toLowerCase() || 'hth'
    if (!tok) continue
    const key = `${tok.toLowerCase()}-${wep}`
    if (!uniqueSpecs.has(key)) {
      uniqueSpecs.set(key, { token: tok, weapon: wep })
    }
  }

  for (let act = 1; act <= 5; act += 1) {
    const specs = ACT_MONSTER_SPECS[act] ?? []
    for (const spec of specs) {
      if (!spec.token) continue
      const key = `${spec.token.toLowerCase()}-${spec.weapon.toLowerCase()}`
      if (!uniqueSpecs.has(key)) {
        uniqueSpecs.set(key, { token: spec.token.toUpperCase(), weapon: spec.weapon.toLowerCase() })
      }
    }
  }

  // Include SuperUnique landmark bosses, minions, and Town NPCs
  const superUniques = readSuperUniques(CANONICAL_SUPERUNIQUES_TABLE)
  const extraMonsterIds = new Set<string>(['valkyrie', 'dopplezon'])
  for (const su of superUniques) extraMonsterIds.add(su.monsterId)
  for (const landmark of CANONICAL_SUPER_UNIQUE_LANDMARKS) {
    if (landmark.minionMonsterId) extraMonsterIds.add(landmark.minionMonsterId)
  }
  for (const npc of TOWN_NPC_DESCRIPTORS) {
    extraMonsterIds.add(npc.npcTxtKey)
  }
  for (const monsterId of extraMonsterIds) {
    const spec = resolveMonsterArtSpec(monsterId)
    if (spec && spec.token) {
      const key = `${spec.token.toLowerCase()}-${spec.weapon.toLowerCase()}`
      if (!uniqueSpecs.has(key)) {
        uniqueSpecs.set(key, { token: spec.token.toUpperCase(), weapon: spec.weapon.toLowerCase() })
      }
    }
  }

  // Map acts where each monster is referenced
  const monsterActsMap = new Map<string, number[]>()
  for (let act = 1; act <= 5; act += 1) {
    const specs = ACT_MONSTER_SPECS[act] ?? []
    for (const spec of specs) {
      if (!spec.token) continue
      const key = `${spec.token.toLowerCase()}-${spec.weapon.toLowerCase()}`
      const list = monsterActsMap.get(key) ?? []
      if (!list.includes(act)) list.push(act)
      monsterActsMap.set(key, list)
    }
  }
  for (const npc of TOWN_NPC_DESCRIPTORS) {
    const spec = resolveMonsterArtSpec(npc.npcTxtKey)
    if (spec && spec.token) {
      const key = `${spec.token.toLowerCase()}-${spec.weapon.toLowerCase()}`
      const act = npc.actIndex + 1
      const list = monsterActsMap.get(key) ?? []
      if (!list.includes(act)) list.push(act)
      monsterActsMap.set(key, list)
    }
  }

  // 2. Collect all unique drawable object specs from Objects.txt (0..572) + OBJECT_LOOKUP_ROWS
  const objectsTable = await loadObjectsTable(mainArchives)
  const uniqueObjectSpecs = new Map<
    string,
    {
      slug: string
      token: string
      baseIsMonsters: boolean
      acts: Set<number>
      row?: ObjectsRow
    }
  >()

  for (const row of objectsTable.rows) {
    if (row.draw === 0) continue
    const tok = row.token.trim().toUpperCase()
    if (!tok || tok === 'XX' || tok === 'SS' || tok === 'SL') continue
    const slug = tok.toLowerCase()
    let entry = uniqueObjectSpecs.get(slug)
    if (!entry) {
      entry = { slug, token: tok, baseIsMonsters: false, acts: new Set<number>(), row }
      uniqueObjectSpecs.set(slug, entry)
    }
    if (row.act >= 1 && row.act <= 5) {
      entry.acts.add(row.act)
    }
  }

  const parsedObjectLookups: {
    lookupKey: string
    act: number
    type: number
    ds1Id: number
    objectsTxtId: number
    token: string
    mode: string
    direction: number
    baseIsMonsters: boolean
    slug: string | null
  }[] = []

  for (const [actStr, packed] of Object.entries(OBJECT_LOOKUP_ROWS)) {
    const act = Number(actStr)
    for (const rec of packed.split(';')) {
      if (!rec) continue
      const parts = rec.split(':')
      const ds1Id = Number(parts[0])
      const objectsTxtId = Number(parts[1])
      const rawTok = (parts[2] ?? '').trim().toUpperCase()
      const mode = (parts[3] ?? '').trim().toLowerCase()
      let direction = -1
      let baseIsMonsters = false
      for (const flag of parts.slice(4)) {
        if (flag === 'm') baseIsMonsters = true
        else if (flag.startsWith('d')) direction = Number(flag.slice(1))
      }
      const validTok = rawTok && rawTok !== 'XX' && rawTok !== 'SS' && rawTok !== 'SL' ? rawTok : ''
      const slug = validTok ? (baseIsMonsters ? `mon-${validTok.toLowerCase()}` : validTok.toLowerCase()) : null
      if (slug && validTok) {
        let entry = uniqueObjectSpecs.get(slug)
        if (!entry) {
          const fallbackRow = objectsTxtId >= 0 ? objectsTable.byId.get(objectsTxtId) : undefined
          entry = {
            slug,
            token: validTok,
            baseIsMonsters,
            acts: new Set<number>(),
            ...(fallbackRow ? { row: fallbackRow } : {}),
          }
          uniqueObjectSpecs.set(slug, entry)
        }
        if (act >= 1 && act <= 5) {
          entry.acts.add(act)
        }
      }
      parsedObjectLookups.push({
        lookupKey: `${String(act)}:${String(OBJECT_TYPE_OBJECT)}:${String(ds1Id)}`,
        act,
        type: OBJECT_TYPE_OBJECT,
        ds1Id,
        objectsTxtId,
        token: rawTok,
        mode,
        direction,
        baseIsMonsters,
        slug,
      })
    }
  }

  // 3. Build job list: Monsters + Objects (player characters are baked by pack-all-characters.ts)
  const jobs: EntityJob[] = []

  const monsterEntries = [...uniqueSpecs.entries()]
  for (let i = 0; i < monsterEntries.length; i += 1) {
    const [key, spec] = monsterEntries[i]!
    jobs.push({
      type: 'monster',
      jobId: jobs.length,
      key,
      token: spec.token,
      weapon: spec.weapon,
      allowedModes: [...TARGET_MONSTER_MODES],
      acts: monsterActsMap.get(key) ?? [],
      archiveDir,
      outDir,
    })
  }
  for (const variantJob of buildMonsterComponentVariantJobs113c(archiveDir, outDir)) {
    jobs.push({ ...variantJob, jobId: jobs.length })
  }

  const objectEntries = [...uniqueObjectSpecs.values()]
  for (let i = 0; i < objectEntries.length; i += 1) {
    const objSpec = objectEntries[i]!
    jobs.push({
      type: 'object',
      jobId: jobs.length,
      slug: objSpec.slug,
      token: objSpec.token,
      baseIsMonsters: objSpec.baseIsMonsters,
      acts: [...objSpec.acts],
      ...(objSpec.row ? { frameDeltas: objSpec.row.frameDelta, cycleAnims: objSpec.row.cycleAnim } : {}),
      archiveDir,
      outDir,
    })
  }

  // 4. Worker pool concurrency governor
  const defaultMaxWorkers = typeof availableParallelism === 'function' ? availableParallelism() : 8
  const envWorkers = process.env.MAX_WORKERS !== undefined ? parseInt(process.env.MAX_WORKERS, 10) : undefined
  const maxWorkers = envWorkers !== undefined ? Math.max(1, envWorkers) : Math.max(1, Math.min(defaultMaxWorkers, 16))
  const useWorkers = maxWorkers > 1
  const numWorkers = useWorkers ? Math.min(maxWorkers, jobs.length) : 1

  console.log(
    `Baking ${String(jobs.length)} entities (${String(monsterEntries.length)} monster specs + ${String(objectEntries.length)} object specs) using ${useWorkers ? `${String(numWorkers)} worker threads` : 'sequential execution'}...`,
  )
  const startTime = performance.now()

  let results: EntityResult[]
  if (useWorkers) {
    results = await runWorkerPool(jobs, numWorkers, archiveDir, outDir)
  } else {
    const ctx = await EntityWorkerContext.create(archiveDir, outDir)
    results = []
    let count = 0
    for (const job of jobs) {
      const res = await processJob(job, ctx)
      results.push(res)
      count += 1
      const label =
        res.type === 'monster'
          ? `monster-${res.key}`
          : `object-${res.slug}`
      console.log(`[${String(count).padStart(3)}/${String(jobs.length)}] Packed ${label}`)
    }
  }

  // 5. Summarize and build full catalog indices
  const monsterResults = results.filter((r): r is MonsterResult => r.type === 'monster')
  const objectResults = results.filter((r): r is ObjectResult => r.type === 'object')
  const validMonsters = monsterResults.filter(m => !m.skipped)
  const validObjects = objectResults.filter(o => !o.skipped)

  const validMonsterByKey = new Map<string, MonsterResult>()
  for (const m of validMonsters) {
    validMonsterByKey.set(m.key, m)
  }

  const validObjectBySlug = new Map<string, ObjectResult>()
  for (const o of validObjects) {
    validObjectBySlug.set(o.slug, o)
  }

  console.log(`Composited ${validMonsters.length} unique monster specs and ${validObjects.length} unique object specs across Acts 1..5.`)

  const monsterByClassId: Record<string, MonsterIndexEntry> = {}
  for (const row of rawMonsterCatalog) {
    const candidateKey = row.token ? `${row.token.toLowerCase()}-${row.weapon.toLowerCase()}` : null
    const baked = candidateKey ? validMonsterByKey.get(candidateKey) : undefined
    const validKey = baked ? baked.key : null
    const directions = baked?.directions ?? 8
    monsterByClassId[String(row.hcIdx)] = {
      hcIdx: row.hcIdx,
      classId: row.hcIdx,
      id: row.id,
      token: row.token,
      weapon: row.weapon,
      key: validKey,
      slug: validKey,
      file: validKey ? `monster-${validKey}.r8` : null,
      metaFile: validKey ? `monster-${validKey}.json` : null,
      packPath: validKey ? `monster-${validKey}` : null,
      inTown: row.inTown,
      npc: row.npc,
      isNpc: row.npc,
      interact: row.interact,
      align: row.align,
      sizeX: row.sizeX,
      sizeY: row.sizeY,
      velocity: row.velocity,
      run: row.run,
      directions,
      dirCount: directions,
      scale: row.scale,
      baseCol: row.baseCol,
      modes: baked?.modes ?? [],
    }
  }

  const lookupsByObjectsTxtId = new Map<number, typeof parsedObjectLookups>()
  for (const item of parsedObjectLookups) {
    if (item.objectsTxtId < 0) continue
    const list = lookupsByObjectsTxtId.get(item.objectsTxtId) ?? []
    list.push(item)
    lookupsByObjectsTxtId.set(item.objectsTxtId, list)
  }

  const objectByClassId: Record<string, ObjectIndexEntry> = {}
  for (const row of objectsTable.rows) {
    const rawTok = row.token.trim().toUpperCase()
    const actTokens: Record<number, string> = {}
    const actSlugs: Record<number, string> = {}
    const matchingLookups = lookupsByObjectsTxtId.get(row.id) ?? []
    let fallbackBaked: ObjectResult | undefined
    let fallbackTok = rawTok
    let fallbackBaseIsMonsters = false

    for (const lookup of matchingLookups) {
      const lookupBaked = lookup.slug ? validObjectBySlug.get(lookup.slug) : undefined
      if (lookupBaked) {
        actTokens[lookup.act] = lookup.token
        actSlugs[lookup.act] = lookupBaked.slug
        if (!fallbackBaked) {
          fallbackBaked = lookupBaked
          fallbackTok = lookup.token
          fallbackBaseIsMonsters = lookup.baseIsMonsters
        }
      }
    }

    const candidateSlug = row.draw !== 0 && rawTok && rawTok !== 'XX' && rawTok !== 'SS' && rawTok !== 'SL' ? rawTok.toLowerCase() : null
    const directBaked = candidateSlug ? validObjectBySlug.get(candidateSlug) : undefined
    const baked = directBaked ?? (row.draw !== 0 ? fallbackBaked : undefined)
    const validSlug = baked ? baked.slug : null
    const resolvedTok = directBaked ? rawTok : (baked ? fallbackTok : rawTok)
    const baseIsMonsters = directBaked ? false : (baked ? fallbackBaseIsMonsters : false)
    const modesFromRow = OBJECT_MODE_TOKENS.filter((_, idx) => (row.mode[idx] ?? 0) !== 0).map(m => m.toLowerCase())
    const directions = baked?.directions ?? 1
    const isDrawable = row.draw !== 0 && (validSlug !== null || Object.keys(actSlugs).length > 0)

    objectByClassId[String(row.id)] = {
      id: row.id,
      classId: row.id,
      name: row.name,
      description: row.description ?? row.name,
      token: resolvedTok,
      slug: validSlug,
      file: validSlug ? `object-${validSlug}.r8` : null,
      metaFile: validSlug ? `object-${validSlug}.json` : null,
      packPath: validSlug ? `object-${validSlug}` : null,
      actTokens,
      actSlugs,
      baseIsMonsters,
      draw: isDrawable,
      isDoor: row.isDoor,
      subClass: row.subClass,
      sizeX: row.sizeX,
      sizeY: row.sizeY,
      xOffset: row.xOffset,
      yOffset: row.yOffset,
      operateRange: row.operateRange ?? 0,
      selectable: row.selectable.map(s => s !== 0),
      frameCnt: row.frameCnt,
      frameCounts: row.frameCnt,
      frameDelta: row.frameDelta,
      frameDeltas: row.frameDelta,
      cycleAnim: row.cycleAnim.map(c => c !== 0),
      start: row.start,
      directions,
      dirCount: directions,
      modes: baked?.modes ?? modesFromRow,
      blendMode: baked?.blendMode ?? row.blendMode ?? 'normal',
      trans: row.trans,
    }
  }

  const objectLookupByActTypeId: Record<string, ObjectLookupIndexEntry> = {}
  for (const item of parsedObjectLookups) {
    const baked = item.slug ? validObjectBySlug.get(item.slug) : undefined
    const validSlug = baked ? baked.slug : null
    objectLookupByActTypeId[item.lookupKey] = {
      act: item.act,
      type: item.type,
      ds1Id: item.ds1Id,
      id: item.ds1Id,
      objectsTxtId: item.objectsTxtId,
      classId: item.objectsTxtId,
      token: item.token,
      mode: item.mode,
      direction: item.direction,
      baseIsMonsters: item.baseIsMonsters,
      slug: validSlug,
      file: validSlug ? `object-${validSlug}.r8` : null,
      metaFile: validSlug ? `object-${validSlug}.json` : null,
      packPath: validSlug ? `object-${validSlug}` : null,
    }
  }

  const packedEntitiesList: PackedEntityIndexEntry[] = [
    ...validMonsters.map(m => ({
      key: m.key,
      token: m.token,
      weapon: m.weapon,
      file: m.file!,
      format: m.format ?? 'r8',
      blendMode: m.blendMode ?? 'normal',
      width: m.width!,
      height: m.height!,
      directions: m.directions!,
    })),
    ...validObjects.map(o => ({
      key: `object-${o.slug}`,
      token: o.token,
      weapon: o.baseIsMonsters ? 'mon' : 'obj',
      file: o.file!,
      format: o.format ?? 'r8',
      blendMode: o.blendMode ?? 'normal',
      width: o.width!,
      height: o.height!,
      directions: o.directions!,
    })),
  ]

  let characterClips: unknown = undefined
  const charManifestPath = join(globalEntityDir, 'character-manifest.json')
  if (existsSync(charManifestPath)) {
    try {
      const charManifest = JSON.parse(readFileSync(charManifestPath, 'utf8'))
      if (Array.isArray(charManifest.clips)) {
        characterClips = charManifest.clips.map((c: Record<string, unknown>) => ({
          key: c.key,
          classCode: c.classCode,
          token: c.token,
          weapon: c.weapon,
          file: c.file,
          metaFile: c.metaFile,
          format: c.format,
          width: c.width,
          height: c.height,
          directions: c.directions,
          modes: c.modes,
        }))
      }
    } catch {
      // ignore if unreadable
    }
  }

  const indexPayload = {
    schema: 2,
    character: 'char-so',
    characters: ['char-am', 'char-so', 'char-ne', 'char-pa', 'char-ba', 'char-dz', 'char-ai'],
    ...(characterClips !== undefined ? { characterClips } : {}),
    entities: packedEntitiesList,
    monsterByClassId,
    monstersByHcIdx: monsterByClassId,
    objectByClassId,
    objectsByClassId: objectByClassId,
    objectLookupByActTypeId,
  }

  await writeJsonAtomic(join(globalEntityDir, 'index.json'), indexPayload)

  const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2)
  console.log(`✓ All entity packs (${validMonsters.length} monsters + ${validObjects.length} objects) successfully generated in ${elapsedSec}s.`)
}

function parseEntityCliArgs(argv: readonly string[]): { archiveDir: string; outDir: string } {
  let archiveDir = 'samples/d2'
  let outDir = 'public'
  const positional: string[] = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    if (arg === '--mpq-dir' && argv[i + 1]) {
      archiveDir = argv[++i]!
    } else if (arg.startsWith('--mpq-dir=')) {
      archiveDir = arg.slice('--mpq-dir='.length)
    } else if (arg === '--out-dir' && argv[i + 1]) {
      outDir = argv[++i]!
    } else if (arg.startsWith('--out-dir=')) {
      outDir = arg.slice('--out-dir='.length)
    } else if (!arg.startsWith('--')) {
      positional.push(arg)
    }
  }
  if (positional[0]) archiveDir = positional[0]
  if (positional[1]) outDir = positional[1]
  return { archiveDir, outDir }
}

if (isMainThread) {
  if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { archiveDir, outDir } = parseEntityCliArgs(process.argv.slice(2))
    const run = process.argv.includes('--component-variants-only')
      ? bakeMonsterComponentVariants113c(archiveDir, outDir).then(results => {
          for (const r of results) console.log(`✓ monster-${r.key} (${String(r.width)}x${String(r.height)}, modes ${(r.modes ?? []).join(',')})`)
        })
      : bakeEntities(archiveDir, outDir)
    run.catch(err => {
      console.error(err)
      process.exit(1)
    })
  }
} else {
  startWorker()
}
