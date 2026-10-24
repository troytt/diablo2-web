/**
 * Side-by-side proof that the baked Act I outdoor maps are the maps D2MOO generates.
 *
 * For one game seed, the native D2MOO oracle (tools/d2moo-oracle) and the TypeScript port
 * (src/game/drlg, fed from the MPQs exactly as scripts/pack-act-assets.ts feeds it) each generate
 * Act I. Both dumps then take the same road to pixels: drlgLevelInputFromDump -> buildDrlgLevelMap
 * (the bake's adapter) -> buildIsoMapScene (the bake's scene builder) -> the renderers below. For
 * every requested level it writes
 *
 *   <name>_d2moo_blueprint.png / <name>_port_blueprint.png / <name>_xor_blueprint.png
 *   <name>_d2moo_iso.png       / <name>_port_iso.png       / <name>_xor_iso.png
 *
 * and fails (exit 1) unless both XOR images are empty. The iso XOR is computed at full resolution
 * on palette indices and the shadow layer; the written iso images are downscaled previews (a block
 * of the XOR preview is lit when any of its pixels differs).
 *
 * It also prints the DT1-mask ambiguity audit of every level (auditDrlgDt1Ambiguity: references whose
 * candidate tiles under their cell's DT1 mask are variants, or span more than one library) and writes
 * everything to summary.json.
 *
 * Blueprint colours (one 3x3-pixel block per sub-tile): walkable sub-tile green, blocked sub-tile
 * tan, cell without any tile near-black, 8x8-tile room grid dark lines, level links and warps red,
 * preset monsters (landmarks) yellow.
 *
 * Usage:
 *   npx tsx scripts/render-drlg-compare.ts [--copy=0] [--seed=0x5eed0100] [--levels=2,3,4]
 *     [--out=DIR] [--scale=4]
 *
 * --copy picks the bake's act copy (0..2): the game seed of that copy (actGameSeed in
 * pack-act-assets.ts) and the scene seed the bake gives its levels. --seed overrides the game seed.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { decodeDt1, type Dt1 } from '../src/common/formats/dt1.ts'
import { decodePal } from '../src/common/formats/pal.ts'
import { cell, parseTable } from '../src/common/world/acts.ts'
import { buildIsoMapScene, type IsoDraw, type IsoMapScene } from '../src/common/world/d2map.ts'
import { DRLG_GetActNoFromLevelId } from '../src/common/drlg/drlg-drlg.ts'
import { dumpAct1, type DrlgDump } from '../src/common/drlg/drlg-dump.ts'
import { act1OutdoorLevelIds, auditDrlgDt1Ambiguity, buildDrlgLevelMap, drlgLevelInputFromDump, outdoorLevelIds, type DrlgDt1Ambiguity, type DrlgLevelMap } from '../src/common/drlg/drlg-map.ts'
import { createDrlgEnv } from '../src/common/drlg/drlg-source.ts'
import { SUB_TILES_PER_TILE } from '../src/common/world/map.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { drlgLevelDt1s, drlgSuperUniqueIds, loadDrlgMpqData, loadDrlgMpqTables, type DrlgMpqData } from '../src/baker/io/drlg-mpq-source.ts'
import { firstDiff, formatDiff, ORACLE_BIN, runOracle } from './lib/drlg-oracle.ts'
import { encodeIndexedPng, encodeRgbaPng } from '../src/baker/io/png.ts'

const ROOT = resolve(import.meta.dirname, '..')
const ARCHIVE_DIR = join(ROOT, 'samples/d2')
const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
const SUPERUNIQUES_TXT = 'data\\global\\excel\\SuperUniques.txt'
const LEVELS_TXT = 'data\\global\\excel\\Levels.txt'
/** Blueprint pixels per sub-tile. */
const BLUEPRINT_SCALE = 3
/** Tiles per side of an outdoor room (DRLG grid cell), for the blueprint grid lines. */
const ROOM_TILES = 8
/** Shadow layer darkening in the iso previews. */
const SHADOW_FACTOR = 0.5

/** Blueprint palette indices. */
const BP = { void: 0, walkable: 1, blocked: 2, grid: 3, link: 4, landmark: 5 } as const
const BLUEPRINT_PALETTE: readonly (readonly [number, number, number])[] = [
  [12, 16, 22], [36, 78, 44], [198, 158, 86], [24, 40, 30], [240, 70, 70], [255, 226, 90],
]

/** The bake's act-copy game seed (scripts/pack-act-assets.ts actGameSeed, act 1..5). */
function actGameSeed(act1Based: number, copy: number): number {
  return (0x5eed_0000 + act1Based * 0x100 + copy) >>> 0
}

/** The seed the bake gives the scene of a DRLG level copy (scripts/pack-act-assets.ts, job type 'drlg'). */
function bakeSceneSeed(levelId: number, copy: number): number {
  return 0x5eed_1000 + levelId * 10 + copy + 1
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function parseLevelsSpec(spec: string): number[] {
  const out: number[] = []
  for (const part of spec.split(',').map(s => s.trim()).filter(Boolean)) {
    const range = /^(\d+)-(\d+)$/.exec(part)
    if (range !== null) {
      const lo = Number(range[1])
      const hi = Number(range[2])
      if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo <= 0 || hi < lo) throw new Error(`bad --levels ${spec}`)
      for (let id = lo; id <= hi; id += 1) out.push(id)
    } else {
      const id = Number(part)
      if (!Number.isInteger(id) || id <= 0) throw new Error(`bad --levels ${spec}`)
      out.push(id)
    }
  }
  return out
}

interface Args {
  readonly copy: number
  readonly seed?: number
  readonly levels?: readonly number[]
  readonly allActs: boolean
  readonly out: string
  readonly scale: number
}

function parseArgs(argv: readonly string[]): Args {
  const known = new Set(['copy', 'seed', 'levels', 'out', 'scale'])
  const values = new Map<string, string>()
  for (const arg of argv) {
    const match = /^--([a-z]+)=(.+)$/.exec(arg)
    if (match === null || !known.has(match[1]!)) throw new Error(`unknown argument ${arg} (options: ${[...known].map(k => `--${k}=`).join(' ')})`)
    values.set(match[1]!, match[2]!)
  }
  const copy = Number(values.get('copy') ?? '0')
  if (!Number.isInteger(copy) || copy < 0 || copy > 2) throw new Error('--copy must be 0, 1 or 2')
  const seedText = values.get('seed')
  if (seedText !== undefined && !/^(0x[0-9a-f]+|\d+)$/i.test(seedText)) throw new Error(`bad --seed ${seedText}`)
  const seed = seedText === undefined ? undefined : Number(seedText) >>> 0
  const levelsSpec = values.get('levels')
  const allActs = levelsSpec === 'all'
  const levels = levelsSpec === undefined || allActs ? undefined : parseLevelsSpec(levelsSpec)
  const scale = Number(values.get('scale') ?? '4')
  if (!Number.isInteger(scale) || scale < 1) throw new Error('--scale must be a positive integer')
  const out = resolve(values.get('out') ?? '/tmp/drlg-compare')
  return { copy, ...(seed !== undefined ? { seed } : {}), ...(levels !== undefined ? { levels } : {}), allActs, out, scale }
}

// ---------------------------------------------------------------------------------------------
// Renderers

interface IsoRender {
  readonly width: number
  readonly height: number
  /** Palette index per pixel (0 where nothing was drawn). */
  readonly index: Uint8Array
  /** 1 where the shadow layer darkens the pixel. */
  readonly shade: Uint8Array
  /** 1 where anything was drawn. */
  readonly drawn: Uint8Array
}

/**
 * Paint a scene the way the engine layers it: floors, then shadows (darkening), then walls and roofs
 * in their painter's order. Full resolution, palette indices.
 */
function renderIso(scene: IsoMapScene): IsoRender {
  const width = scene.widthPx
  const height = scene.heightPx
  const index = new Uint8Array(width * height)
  const shade = new Uint8Array(width * height)
  const drawn = new Uint8Array(width * height)
  const paint = (draws: readonly IsoDraw[], mode: 'opaque' | 'shadow'): void => {
    for (const draw of draws) {
      const frame = scene.frames[draw.frameIndex]
      if (frame === undefined) throw new Error(`draw at cell ${String(draw.cellX)},${String(draw.cellY)} names frame ${String(draw.frameIndex)} of ${String(scene.frames.length)}`)
      for (let fy = 0; fy < frame.height; fy += 1) {
        const py = draw.y + fy
        if (py < 0 || py >= height) continue
        for (let fx = 0; fx < frame.width; fx += 1) {
          const px = draw.x + fx
          if (px < 0 || px >= width) continue
          const at = fy * frame.width + fx
          if (frame.mask[at] !== 1) continue
          const to = py * width + px
          if (mode === 'shadow') {
            shade[to] = 1
          } else {
            index[to] = frame.indices[at]!
            shade[to] = 0
            drawn[to] = 1
          }
        }
      }
    }
  }
  paint(scene.floors, 'opaque')
  paint(scene.shadows, 'shadow')
  paint(scene.walls, 'opaque')
  paint(scene.roofs, 'opaque')
  return { width, height, index, shade, drawn }
}

/** A downscaled RGBA preview of an iso render (nearest sample of each block). */
function isoPreview(render: IsoRender, rgb: Uint8Array, scale: number): Uint8Array {
  const width = Math.ceil(render.width / scale)
  const height = Math.ceil(render.height / scale)
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = (y * scale) * render.width + x * scale
      const to = (y * width + x) * 4
      if (render.drawn[from] !== 1) {
        pixels[to + 3] = 255
        continue
      }
      const factor = render.shade[from] === 1 ? SHADOW_FACTOR : 1
      const colour = render.index[from]! * 3
      pixels[to] = Math.round(rgb[colour]! * factor)
      pixels[to + 1] = Math.round(rgb[colour + 1]! * factor)
      pixels[to + 2] = Math.round(rgb[colour + 2]! * factor)
      pixels[to + 3] = 255
    }
  }
  return encodeRgbaPng({ width, height, pixels })
}

/** Differing pixels of two iso renders, and a downscaled mask of them (a block lights up if any pixel in it differs). */
function isoXor(a: IsoRender, b: IsoRender, scale: number): { differing: number; png: Uint8Array } {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`iso renders differ in size: ${String(a.width)}x${String(a.height)} vs ${String(b.width)}x${String(b.height)}`)
  }
  const width = Math.ceil(a.width / scale)
  const height = Math.ceil(a.height / scale)
  const pixels = new Uint8Array(width * height)
  let differing = 0
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const at = y * a.width + x
      if (a.index[at] !== b.index[at] || a.shade[at] !== b.shade[at] || a.drawn[at] !== b.drawn[at]) {
        differing += 1
        pixels[Math.floor(y / scale) * width + Math.floor(x / scale)] = 1
      }
    }
  }
  const palette = new Uint8Array(256 * 3)
  palette.set([255, 0, 255], 3)
  return { differing, png: encodeIndexedPng({ width, height, pixels, palette }) }
}

interface Blueprint {
  readonly width: number
  readonly height: number
  readonly pixels: Uint8Array
}

/** The level's collision, cells, room grid, links and landmarks, one block per sub-tile. */
function renderBlueprint(map: DrlgLevelMap, scene: IsoMapScene): Blueprint {
  const { gridWidth, gridHeight } = scene
  const width = gridWidth * BLUEPRINT_SCALE
  const height = gridHeight * BLUEPRINT_SCALE
  const pixels = new Uint8Array(width * height).fill(BP.void)
  const block = (subX: number, subY: number, colour: number): void => {
    for (let dy = 0; dy < BLUEPRINT_SCALE; dy += 1) {
      for (let dx = 0; dx < BLUEPRINT_SCALE; dx += 1) {
        const px = subX * BLUEPRINT_SCALE + dx
        const py = subY * BLUEPRINT_SCALE + dy
        if (px >= 0 && px < width && py >= 0 && py < height) pixels[py * width + px] = colour
      }
    }
  }
  for (let subY = 0; subY < gridHeight; subY += 1) {
    for (let subX = 0; subX < gridWidth; subX += 1) {
      const cell = map.ds1.cells[Math.floor(subY / SUB_TILES_PER_TILE)]?.[Math.floor(subX / SUB_TILES_PER_TILE)]
      const hasTile = cell !== undefined && (cell.floors.some(f => f.prop1 !== 0) || cell.walls.some(w => w.prop1 !== 0))
      if (!hasTile) continue
      block(subX, subY, scene.blocked[subY * gridWidth + subX] === 0 ? BP.walkable : BP.blocked)
    }
  }
  const step = ROOM_TILES * SUB_TILES_PER_TILE * BLUEPRINT_SCALE
  for (let py = 0; py < height; py += step) pixels.fill(BP.grid, py * width, (py + 1) * width)
  for (let px = 0; px < width; px += step) for (let py = 0; py < height; py += 1) pixels[py * width + px] = BP.grid
  const marker = (subX: number, subY: number, colour: number): void => {
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) block(subX + dx, subY + dy, colour)
  }
  const centre = Math.floor(SUB_TILES_PER_TILE / 2)
  for (const entrance of map.entrances) {
    if (entrance.warp !== undefined) marker(entrance.warp.subX, entrance.warp.subY, BP.link)
    else marker(entrance.x * SUB_TILES_PER_TILE + centre, entrance.y * SUB_TILES_PER_TILE + centre, BP.link)
  }
  for (const landmark of map.landmarks) marker(landmark.subX, landmark.subY, BP.landmark)
  return { width, height, pixels }
}

function blueprintPng(blueprint: Blueprint): Uint8Array {
  const palette = new Uint8Array(256 * 3)
  BLUEPRINT_PALETTE.forEach((colour, at) => palette.set(colour, at * 3))
  return encodeIndexedPng({ width: blueprint.width, height: blueprint.height, pixels: blueprint.pixels, palette })
}

function blueprintXor(a: Blueprint, b: Blueprint): { differing: number; png: Uint8Array } {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`blueprints differ in size: ${String(a.width)}x${String(a.height)} vs ${String(b.width)}x${String(b.height)}`)
  }
  const pixels = new Uint8Array(a.pixels.length)
  let differing = 0
  for (let at = 0; at < pixels.length; at += 1) {
    if (a.pixels[at] !== b.pixels[at]) {
      pixels[at] = 1
      differing += 1
    }
  }
  const palette = new Uint8Array(256 * 3)
  palette.set([255, 0, 255], 3)
  return { differing, png: encodeIndexedPng({ width: a.width, height: a.height, pixels, palette }) }
}

/**
 * Count how many visible draws in `scene` differ in `(library, tile)` from the exact `pTile`
 * pointers chosen by the native D2MOO oracle in `oracleDump`.
 */
function countVariantDiffs(oracleDump: DrlgDump, levelId: number, tables: DrlgMpqData['tables'], map: DrlgLevelMap, scene: IsoMapScene): number {
  const input = drlgLevelInputFromDump(oracleDump, levelId, tables)
  const cellsX = input.coord.width + 1
  const cellsY = input.coord.height + 1
  const seen = new Set<string>()
  const expectedByCellKind = new Map<string, string[]>()
  for (const t of input.tiles) {
    if (seen.has(t.key)) continue
    seen.add(t.key)
    if (t.x < 0 || t.y < 0 || t.x >= cellsX || t.y >= cellsY) continue
    if (t.tile === null) continue
    // buildIsoMapScene skips hidden floors and walls (MAPTILE_HIDDEN = 0x8), while shadows are drawn whenever prop1 !== 0
    if ((t.kind === 'floor' || t.kind === 'wall') && (t.flags & 0x0000_0008) !== 0) continue
    const key = `${String(t.x)},${String(t.y)},${t.kind}`
    const list = expectedByCellKind.get(key) ?? []
    list.push(`${t.tile.library}#${String(t.tile.index)}`)
    expectedByCellKind.set(key, list)
  }

  const actualByCellKind = new Map<string, string[]>()
  const recordDraw = (draw: IsoDraw, kind: 'floor' | 'shadow' | 'wall'): void => {
    const key = `${String(draw.cellX)},${String(draw.cellY)},${kind}`
    const list = actualByCellKind.get(key) ?? []
    list.push(`${map.dt1Names[draw.library] ?? '?'}#${String(draw.tile)}`)
    actualByCellKind.set(key, list)
  }
  for (const d of scene.floors) recordDraw(d, 'floor')
  for (const d of scene.shadows) recordDraw(d, 'shadow')
  for (const d of scene.walls) recordDraw(d, 'wall')
  for (const d of scene.roofs) recordDraw(d, 'wall')

  const allKeys = new Set([...expectedByCellKind.keys(), ...actualByCellKind.keys()])
  let diffs = 0
  for (const key of allKeys) {
    const exp = (expectedByCellKind.get(key) ?? []).slice().sort()
    const act = (actualByCellKind.get(key) ?? []).slice().sort()
    const maxLen = Math.max(exp.length, act.length)
    for (let i = 0; i < maxLen; i += 1) {
      if (exp[i] !== act[i]) diffs += 1
    }
  }
  return diffs
}

// ---------------------------------------------------------------------------------------------
// Driver

interface Side {
  readonly map: DrlgLevelMap
  readonly scene: IsoMapScene
  readonly iso: IsoRender
  readonly blueprint: Blueprint
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!existsSync(ORACLE_BIN)) throw new Error(`${ORACLE_BIN} is missing: run ./tools/d2moo-oracle/build.sh`)
  const missing = MOUNTS.filter(name => !existsSync(join(ARCHIVE_DIR, name)))
  if (missing.length > 0) throw new Error(`the 1.13c archives are required in ${ARCHIVE_DIR}; missing ${missing.join(', ')}`)
  mkdirSync(args.out, { recursive: true })

  const archives = new MountedArchives()
  for (const name of MOUNTS) archives.add(name, await MpqArchive.open(await fileSource(join(ARCHIVE_DIR, name))))
  const baseTables = await loadDrlgMpqTables(member => archives.read(member))
  const superUniqueIds = drlgSuperUniqueIds(parseTable(await archives.read(SUPERUNIQUES_TXT)), baseTables)
  const levelsTxt = parseTable(await archives.read(LEVELS_TXT))
  const levelName = (levelId: number): string => {
    const row = levelsTxt.rows.find(r => Number(cell(levelsTxt, r, 'Id')) === levelId)
    if (row === undefined) throw new Error(`Levels.txt has no row with Id ${String(levelId)}`)
    return cell(levelsTxt, row, 'LevelName')
  }
  const allOutdoorLevels = outdoorLevelIds(baseTables)
  const defaultActLevels = act1OutdoorLevelIds(baseTables)
  const targetLevels = args.allActs ? allOutdoorLevels : (args.levels ?? defaultActLevels)
  for (const levelId of targetLevels) {
    if (!allOutdoorLevels.includes(levelId)) throw new Error(`level ${String(levelId)} is not an outdoor DRLG level (${allOutdoorLevels.join(', ')})`)
  }

  const acts = [...new Set(targetLevels.map(id => DRLG_GetActNoFromLevelId(id)))].sort((a, b) => a - b)
  const dt1Cache = new Map<string, Dt1>()
  const summary: Record<string, unknown>[] = []
  const ambiguityTotal = { refs: 0, variantGroups: 0, crossLibrary: 0, crossLibraryLevelWide: 0 }
  let totalVariantDiffs = 0
  let allDumpsIdentical = true
  let failed = false
  let lastSeedHex = ''

  for (const actNo of acts) {
    const act1Based = actNo + 1
    const data: DrlgMpqData = await loadDrlgMpqData(member => archives.read(member), act1Based)
    const palette = decodePal(await archives.read(`data\\global\\palette\\act${String(act1Based)}\\pal.dat`))
    const actLevels = outdoorLevelIds(data.tables, actNo)
    const actTargetLevels = targetLevels.filter(id => DRLG_GetActNoFromLevelId(id) === actNo)
    const gameSeed = args.seed ?? actGameSeed(act1Based, args.copy)
    const seedHex = `0x${gameSeed.toString(16).padStart(8, '0')}`
    lastSeedHex = seedHex
    console.log(`game seed ${seedHex} (act ${String(act1Based)} copy ${String(args.copy)}), levels ${actTargetLevels.join(', ')} of [${actLevels.join(', ')}]`)
    const oracle: DrlgDump = runOracle({ seed: gameSeed, levels: actLevels, difficulty: 0, isolated: false }).doc
    delete oracle.oracle
    const port: DrlgDump = dumpAct1(createDrlgEnv(data.source, data.tables), gameSeed, actLevels, { difficulty: 0, isolated: false, act: actNo })
    const dumpDiff = firstDiff(oracle, port, '$')
    console.log(dumpDiff === null ? 'dumps: identical' : `dumps: DIFFER at ${formatDiff(dumpDiff)}`)
    if (dumpDiff !== null) {
      allDumpsIdentical = false
      failed = true
    }

    const library = (name: string): Dt1 => {
      let dt1 = dt1Cache.get(name)
      if (dt1 === undefined) {
        dt1 = decodeDt1(data.source.readFile(name))
        dt1Cache.set(name, dt1)
      }
      return dt1
    }
    const side = (dump: DrlgDump, levelId: number, fallbackSeed: number): Side => {
      const input = drlgLevelInputFromDump(dump, levelId, data.tables)
      const map = buildDrlgLevelMap(input, { tables: data.tables, dt1: drlgLevelDt1s(input, data.source, dt1Cache), superUniqueIds })
      const scene = buildIsoMapScene(map.ds1, map.dt1Names.map(library), fallbackSeed)
      return { map, scene, iso: renderIso(scene), blueprint: renderBlueprint(map, scene) }
    }

    for (const levelId of actTargetLevels) {
      const name = slug(levelName(levelId))
      // Pass distinct fallback seeds (0 vs bakeSceneSeed) so any unpinned tile would diverge between d2moo and ours
      const d2moo = side(oracle, levelId, 0)
      const ours = side(port, levelId, bakeSceneSeed(levelId, args.copy))
      const variantDiffs = countVariantDiffs(oracle, levelId, data.tables, ours.map, ours.scene)
      totalVariantDiffs += variantDiffs
      const iso = isoXor(d2moo.iso, ours.iso, args.scale)
      const bp = blueprintXor(d2moo.blueprint, ours.blueprint)
      const ambiguity: DrlgDt1Ambiguity = auditDrlgDt1Ambiguity(ours.map, ours.map.dt1Names.map(library))
      ambiguityTotal.refs += ambiguity.refs
      ambiguityTotal.variantGroups += ambiguity.variantGroups
      ambiguityTotal.crossLibrary += ambiguity.crossLibrary
      ambiguityTotal.crossLibraryLevelWide += ambiguity.crossLibraryLevelWide
      const write = (file: string, png: Uint8Array): void => writeFileSync(join(args.out, `${name}_${file}.png`), png)
      write('d2moo_blueprint', blueprintPng(d2moo.blueprint))
      write('port_blueprint', blueprintPng(ours.blueprint))
      write('xor_blueprint', bp.png)
      write('d2moo_iso', isoPreview(d2moo.iso, palette.rgb, args.scale))
      write('port_iso', isoPreview(ours.iso, palette.rgb, args.scale))
      write('xor_iso', iso.png)
      const s = ours.map.stats
      const row = {
        levelId,
        name,
        canvas: `${String(ours.map.ds1.width)}x${String(ours.map.ds1.height)}`,
        walls: s.walls,
        floors: s.floors,
        shadows: s.shadows,
        objects: s.objects,
        monsters: s.monsters,
        entrances: ours.map.entrances.length,
        landmarks: ours.map.landmarks.length,
        isoPx: `${String(ours.iso.width)}x${String(ours.iso.height)}`,
        variantDiffs,
        isoDiffering: iso.differing,
        blueprintDiffering: bp.differing,
        dt1Ambiguity: ambiguity,
      }
      summary.push(row)
      console.log(`L${String(levelId)} ${name}: canvas ${row.canvas}, ${String(s.walls)} walls / ${String(s.floors)} floors / ${String(s.shadows)} shadows, `
        + `${String(row.entrances)} links, ${String(row.landmarks)} landmarks; variantDiffs ${String(variantDiffs)}; iso ${row.isoPx} px, differing ${String(iso.differing)}; blueprint differing ${String(bp.differing)}`)
      console.log(`  DT1 ambiguity: ${String(ambiguity.libraries)} libraries, ${String(ambiguity.refs)} refs, ${String(ambiguity.variantGroups)} with variants, `
        + `${String(ambiguity.crossLibrary)} cross-library under cell masks (${String(ambiguity.crossLibraryLevelWide)} with one level-wide pool)`)
      if (variantDiffs !== 0 || iso.differing !== 0 || bp.differing !== 0) failed = true
    }
  }
  console.log(`DT1 ambiguity total: ${String(ambiguityTotal.refs)} refs, ${String(ambiguityTotal.variantGroups)} with variants, `
    + `${String(ambiguityTotal.crossLibrary)} cross-library under cell masks (${String(ambiguityTotal.crossLibraryLevelWide)} with one level-wide pool), variantDiffs ${String(totalVariantDiffs)}`)
  writeFileSync(join(args.out, 'summary.json'), JSON.stringify({ seed: lastSeedHex, copy: args.copy, dumpsIdentical: allDumpsIdentical, variantDiffs: totalVariantDiffs, dt1Ambiguity: ambiguityTotal, levels: summary }, null, 1))
  console.log(failed ? 'FAIL: the D2MOO and port images or tile variants differ' : `OK: 0 variant diffs and every XOR image is empty; images in ${args.out}`)
  if (failed) process.exitCode = 1
}

await main()
