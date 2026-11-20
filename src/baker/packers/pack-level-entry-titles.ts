/**
 * Bakes the 1.13c level entry titles ("Entering The Blood Moor") into one atlas.
 *
 * Source: `Levels.txt` `EntryFile` → `data\local\ui\eng\<ACT%d|EXPANSION>\<EntryFile>.dc6`, plus the two
 * quest overrides (`ACT1\A1Q1`, `ACT1\A1Q5`) of `D2Client.dll` `0x6fb8be88`. See
 * `src/common/world/level-entry-title-113c.ts` for the runtime contract.
 *
 * The Chinese client shows the same English DC6s (decision on issue #1007), so only `eng` is baked.
 *
 * Every title is drawn by `D2Win #10138(..., drawMode = 5, paletteShift = 1)`; palette shift 1 selects
 * the PL2 `textShifts[1]` remap (renderer table `+0xd0 + 1 * 4`, filled from `0x6f921638` by
 * `D2Win 0x6f8eee60`), which is applied here so the runtime draws the atlas as-is.
 *
 * Outputs:
 * - `public/ui/level-entry-titles.png` (indexed, ACT1 `pal.pl2`, index 0 transparent)
 * - `src/common/world/level-entry-titles-113c.ts` (atlas rects + level → title key)
 *
 * Missing DC6s, unexpected frame geometry or a level without `EntryFile` fail the run.
 *
 * Usage: npm run pack:level-entry-titles   (MPQs from D2_DATA_DIR or samples/d2)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { decodeDc6, type Dc6Frame } from '../../common/formats/dc6.ts'
import { decodePl2 } from '../../common/formats/pl2.ts'
import { parseTable } from '../../common/items/tables.ts'
import type { MountedArchives } from '../../common/mpq/mount.ts'
import { DRLG_GetActNoFromLevelId } from '../../common/drlg/drlg-drlg.ts'
import {
  LEVEL_ENTRY_TITLE_FRAME_STRIDE,
  LEVEL_ENTRY_TITLE_QUEST_OVERRIDES,
  levelEntryTitleKey,
} from '../../common/world/level-entry-title-113c.ts'
import { encodeIndexedPng } from '../io/png.ts'
import { DEFAULT_NODE_MPQ_DIR, mountNodeArchives } from '../mpq-archive-source.ts'

const LEVELS_MEMBER = 'data/global/excel/Levels.txt'
const PALETTE_MEMBER = 'data/global/palette/ACT1/pal.pl2'
const FIRST_LEVEL_ID = 1
const LAST_LEVEL_ID = 136
/** D2Win #10138 `paletteShift` argument pushed at `0x6fb6f33f`. */
const TITLE_TEXT_SHIFT = 1
export const LEVEL_ENTRY_TITLES_PNG = 'level-entry-titles.png'
const GENERATED_MODULE = 'src/common/world/level-entry-titles-113c.ts'

interface BakedTitle {
  readonly key: string
  readonly width: number
  readonly height: number
  readonly pixels: Uint8Array
}

interface TitleRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface LevelEntryTitleBake {
  readonly png: Uint8Array
  readonly atlasWidth: number
  readonly atlasHeight: number
  readonly rects: ReadonlyMap<string, TitleRect>
  readonly titleKeyByLevel: ReadonlyMap<number, string>
}

/** Map an atlas key back to its MPQ member. */
function memberForKey(key: string): string {
  return `data/local/ui/eng/${key}.dc6`
}

/** Stitch a title's frames left-to-right after checking the D2Win #10138 geometry assumptions. */
function stitchTitle(key: string, frames: readonly Dc6Frame[], shift: Uint8Array): BakedTitle {
  if (frames.length === 0) throw new Error(`${key}: DC6 has no frames`)
  const height = frames[0]!.height
  frames.forEach((f, i) => {
    if (f.height !== height) throw new Error(`${key}: frame ${String(i)} height ${String(f.height)} != ${String(height)}`)
    if (f.offsetX !== 0 || f.offsetY !== 0) {
      throw new Error(`${key}: frame ${String(i)} has offset (${String(f.offsetX)},${String(f.offsetY)}); expected (0,0)`)
    }
    if (i < frames.length - 1 && f.width !== LEVEL_ENTRY_TITLE_FRAME_STRIDE) {
      throw new Error(`${key}: non-final frame ${String(i)} is ${String(f.width)} px wide; #10138 advances 256 px`)
    }
  })
  const width = frames.reduce((sum, f) => sum + f.width, 0)
  const pixels = new Uint8Array(width * height)
  let ox = 0
  for (const f of frames) {
    for (let y = 0; y < f.height; y++) {
      for (let x = 0; x < f.width; x++) {
        const i = y * f.width + x
        if (f.mask[i] === 0) continue
        const shifted = shift[f.indices[i]!]!
        // Index 0 is the PNG transparent index; an opaque pixel must never land on it.
        if (shifted === 0) throw new Error(`${key}: textShifts[1] maps opaque index ${String(f.indices[i])} to 0`)
        pixels[y * width + ox + x] = shifted
      }
    }
    ox += f.width
  }
  return { key, width, height, pixels }
}

/**
 * Read Levels.txt and every title DC6, returning the atlas and its metadata.
 *
 * @param archives - mounted 1.13c MPQs.
 */
export async function bakeLevelEntryTitles(archives: MountedArchives): Promise<LevelEntryTitleBake> {
  const pl2 = decodePl2(await archives.read(PALETTE_MEMBER))
  const shift = pl2.textShifts[TITLE_TEXT_SHIFT]
  if (shift === undefined) throw new Error(`pal.pl2 has no textShifts[${String(TITLE_TEXT_SHIFT)}]`)

  const table = parseTable(new TextDecoder().decode(await archives.read(LEVELS_MEMBER)))
  const titleKeyByLevel = new Map<number, string>()
  for (const row of table.rows) {
    const rawId = row['Id']
    if (rawId === undefined || !/^\d+$/.test(rawId)) continue
    const id = Number(rawId)
    if (id < FIRST_LEVEL_ID || id > LAST_LEVEL_ID) continue
    const act = Number(row['Act'])
    if (!Number.isInteger(act) || act !== DRLG_GetActNoFromLevelId(id)) {
      throw new Error(`Levels.txt Id=${rawId}: Act '${String(row['Act'])}' disagrees with DRLG_GetActNoFromLevelId`)
    }
    if (titleKeyByLevel.has(id)) throw new Error(`Levels.txt: duplicate Id ${rawId}`)
    titleKeyByLevel.set(id, levelEntryTitleKey(id, act, row['EntryFile'] ?? ''))
  }
  for (let id = FIRST_LEVEL_ID; id <= LAST_LEVEL_ID; id++) {
    if (!titleKeyByLevel.has(id)) throw new Error(`Levels.txt: level ${String(id)} missing`)
  }

  const keys = [...new Set([...titleKeyByLevel.values(), ...LEVEL_ENTRY_TITLE_QUEST_OVERRIDES.map(o => o.titleKey)])].sort()
  const titles: BakedTitle[] = []
  for (const key of keys) {
    const sheet = decodeDc6(await archives.read(memberForKey(key)))
    if (sheet.groups.length !== 1) throw new Error(`${key}: expected 1 direction, got ${String(sheet.groups.length)}`)
    titles.push(stitchTitle(key, sheet.groups[0]!.frames, shift))
  }

  const atlasWidth = Math.max(...titles.map(t => t.width))
  const atlasHeight = titles.reduce((sum, t) => sum + t.height, 0)
  const atlas = new Uint8Array(atlasWidth * atlasHeight)
  const rects = new Map<string, TitleRect>()
  let y0 = 0
  for (const t of titles) {
    for (let y = 0; y < t.height; y++) {
      atlas.set(t.pixels.subarray(y * t.width, (y + 1) * t.width), (y0 + y) * atlasWidth)
    }
    rects.set(t.key, { x: 0, y: y0, w: t.width, h: t.height })
    y0 += t.height
  }
  const png = encodeIndexedPng({ width: atlasWidth, height: atlasHeight, pixels: atlas, palette: pl2.rgb, transparentIndex: 0 })
  return { png, atlasWidth, atlasHeight, rects, titleKeyByLevel }
}

/** Render the generated TypeScript metadata module. */
export function renderLevelEntryTitlesModule(bake: LevelEntryTitleBake): string {
  const lines = [
    '/**',
    ' * Diablo II v1.13c level entry title atlas metadata (`Levels.txt` `EntryFile` DC6s, English).',
    ' *',
    ' * GENERATED by src/baker/packers/pack-level-entry-titles.ts (`npm run pack:level-entry-titles`). Do not edit by hand.',
    ' */',
    '',
    'export interface LevelEntryTitleRect {',
    '  readonly x: number',
    '  readonly y: number',
    '  readonly w: number',
    '  readonly h: number',
    '}',
    '',
    `export const LEVEL_ENTRY_TITLE_ATLAS = Object.freeze({ image: '${LEVEL_ENTRY_TITLES_PNG}', width: ${String(bake.atlasWidth)}, height: ${String(bake.atlasHeight)} })`,
    '',
    '/** Atlas rect per title key (`<act1..act4|expansion>/<entryfile>`). */',
    'export const LEVEL_ENTRY_TITLE_RECTS: Readonly<Record<string, LevelEntryTitleRect>> = Object.freeze({',
  ]
  for (const [key, r] of [...bake.rects].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  '${key}': { x: ${String(r.x)}, y: ${String(r.y)}, w: ${String(r.w)}, h: ${String(r.h)} },`)
  }
  lines.push('})', '', '/** Levels.txt id → title key (from `Act` / `EntryFile`). */')
  lines.push('export const LEVEL_ENTRY_TITLE_KEY_BY_LEVEL: Readonly<Record<number, string>> = Object.freeze({')
  for (const [id, key] of [...bake.titleKeyByLevel].sort(([a], [b]) => a - b)) {
    lines.push(`  ${String(id)}: '${key}',`)
  }
  lines.push('})', '')
  return lines.join('\n')
}

/**
 * Bake and write the atlas into every `<dir>/` and regenerate the metadata module.
 *
 * @param archives - mounted 1.13c MPQs.
 * @param uiDirs - output `public/ui`-style directories.
 */
export async function writeLevelEntryTitles(archives: MountedArchives, uiDirs: readonly string[]): Promise<LevelEntryTitleBake> {
  const bake = await bakeLevelEntryTitles(archives)
  for (const dir of uiDirs) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, LEVEL_ENTRY_TITLES_PNG), bake.png)
  }
  writeFileSync(resolve(GENERATED_MODULE), renderLevelEntryTitlesModule(bake))
  return bake
}

async function main(): Promise<void> {
  const archives = mountNodeArchives(process.argv[2] ?? DEFAULT_NODE_MPQ_DIR)
  const bake = await writeLevelEntryTitles(archives, [resolve('public', 'ui')])
  console.log(
    `level entry titles: ${String(bake.rects.size)} titles for ${String(bake.titleKeyByLevel.size)} levels, ` +
      `atlas ${String(bake.atlasWidth)}x${String(bake.atlasHeight)} -> public/ui/${LEVEL_ENTRY_TITLES_PNG}, ${GENERATED_MODULE}`,
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
