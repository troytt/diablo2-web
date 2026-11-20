/**
 * Comprehensive verification of offline pre-baked Schema 2 entity, object, character, UI, missile, overlay, and skill atlases.
 *
 * Checks:
 * 1. Global R8 textures in `public/entities/`.
 * 2. Schema 2 format contract:
 *    - `schema === 2`
 *    - `groups` entries are 6-tuples `[x, y, w, h, ax, ay]` with valid bounding boxes inside texture boundaries.
 * 3. Characters (`char-am`, `char-so`, `char-ne`, `char-pa`, `char-ba`, `char-dz`, `char-ai`):
 *    - Directions = 16
 *    - All 11 player modes present: `wl, nu, rn, a1, a2, sc, gh, dt, dd, tn, tw`.
 *    - Ground-truth loop flags: NU, WL, RN, TN, TW loop; A1, A2, SC, GH, DT, DD do not loop.
 *    - Backward-compatibility aliases `walk` and `stand`.
 * 4. Monsters & Town NPCs (`monster-*.{json,r8}` + `monsterByClassId` / `monstersByHcIdx` 0..733):
 *    - All 211 unique monster/NPC art specs verified.
 *    - Town NPCs (`146` Cain, `147` Gheed, `148` Akara, `150` Kashya, `154` Charsi, `155` Warriv) verified.
 *    - Directions in {1, 4, 8, 16}.
 * 5. Objects (`object-*.{json,r8}` + `objectByClassId` / `objectsByClassId` 0..572 + `objectLookupByActTypeId`):
 *    - All 531 unique drawable object art specs verified (`26` Gibbet, `39` Rogue Torch, `119` Waypoint, `267` Stash, etc.).
 * 6. UI, Flippy Multi-Frame Sprites, Missiles, Overlays & Skills:
 *    - `ui/manifest.json` & `ui/ui-atlas.json` (`itemRects`, `flippyRects`, `flippyFrames`, `itemClassIdToCode` 0..658).
 *    - Valid PNG headers and dimensions (`0` corrupt PNGs, `0` missing indices).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT_DIR = process.cwd()
const PACK_ROOT = join(ROOT_DIR, 'public', 'packs')

import { D2_DRAW_MODE_BLENDS } from '../../common/gfx/draw-mode.ts'
import type {
  BakedUiManifest,
  ClipMeta,
  EntityMeta,
  PackedEntityCatalogIndex,
} from '../../common/pack-contract/index.ts'
import { ENTITY_ATLAS_MAX_PAGE_HEIGHT } from '../../common/pack-contract/index.ts'
export type { ClipMeta, EntityMeta }

const CHARACTER_SLUGS = [
  'char-am',
  'char-so',
  'char-ne',
  'char-pa',
  'char-ba',
  'char-dz',
  'char-ai',
] as const

function verifyPngFile(pngPath: string, label: string, expectedWidth?: number, expectedHeight?: number): void {
  if (!existsSync(pngPath)) {
    throw new Error(`${label}: PNG file missing at ${pngPath}`)
  }
  const png = readFileSync(pngPath)
  if (png.byteLength < 24 || png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) {
    throw new Error(`${label}: corrupt PNG signature in ${pngPath}`)
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const pngWidth = view.getUint32(16)
  const pngHeight = view.getUint32(20)
  if (pngWidth < 1 || pngHeight < 1) {
    throw new Error(`${label}: invalid PNG dimensions ${pngWidth}x${pngHeight} in ${pngPath}`)
  }
  if (expectedWidth !== undefined && pngWidth !== expectedWidth) {
    throw new Error(`${label}: PNG width mismatch ${pngWidth} vs ${expectedWidth} in ${pngPath}`)
  }
  if (expectedHeight !== undefined && pngHeight !== expectedHeight) {
    throw new Error(`${label}: PNG height mismatch ${pngHeight} vs ${expectedHeight} in ${pngPath}`)
  }
}

/** Largest `MAX_TEXTURE_SIZE` on mainstream desktop WebGL2; `addIndexedAtlas` throws above it. */
const DESKTOP_MAX_TEXTURE_SIZE = 16384

/**
 * Verify every R8 page of a monster/object pack (issue #921): each page exists, has
 * width*height bytes, stays within ENTITY_ATLAS_MAX_PAGE_HEIGHT when paged, and every
 * frame tuple (base + glow) lies inside the page it references.
 */
function verifyEntityR8Pages(meta: EntityMeta, dir: string, label: string): void {
  const pages = meta.pages ?? [{ file: meta.file, width: meta.width, height: meta.height }]
  if (meta.pages !== undefined) {
    const first = meta.pages[0]
    if (!first || first.file !== meta.file || first.width !== meta.width || first.height !== meta.height) {
      throw new Error(`${label}: pages[0] must mirror file/width/height`)
    }
  }
  for (const page of pages) {
    if (meta.pages !== undefined && page.height > ENTITY_ATLAS_MAX_PAGE_HEIGHT) {
      throw new Error(`${label}: page ${page.file} is ${page.height} rows, over ${ENTITY_ATLAS_MAX_PAGE_HEIGHT}`)
    }
    if (page.width > DESKTOP_MAX_TEXTURE_SIZE || page.height > DESKTOP_MAX_TEXTURE_SIZE) {
      throw new Error(
        `${label}: page ${page.file} is ${page.width}x${page.height}, over the ${DESKTOP_MAX_TEXTURE_SIZE}px GPU texture limit; rebake it (paged)`,
      )
    }
    const r8Path = join(dir, page.file)
    if (!existsSync(r8Path)) throw new Error(`${label}: missing R8 page ${r8Path}`)
    const bytes = readFileSync(r8Path).byteLength
    if (bytes !== page.width * page.height) {
      throw new Error(`${label}: ${page.file} byte length mismatch: ${bytes} vs ${page.width * page.height}`)
    }
  }
  for (const groups of [meta.groups, meta.glowGroups ?? []]) {
    for (let g = 0; g < groups.length; g += 1) {
      for (let f = 0; f < groups[g]!.length; f += 1) {
        const tuple = groups[g]![f]!
        const pageIdx = tuple[6] ?? 0
        const page = pages[pageIdx]
        if (page === undefined) throw new Error(`${label}: group ${g} frame ${f} references missing page ${pageIdx}`)
        verifyFrameTuples([[tuple]], page.width, page.height, `${label} (group ${g} frame ${f})`)
      }
    }
  }
}

function verifyFrameTuples(groups: any[][], width: number, height: number, label: string): void {
  for (let g = 0; g < groups.length; g += 1) {
    const group = groups[g]!
    for (let f = 0; f < group.length; f += 1) {
      const tuple = group[f]!
      if (!Array.isArray(tuple) || tuple.length < 6) {
        throw new Error(`${label}: group ${g} frame ${f} is not a 6-tuple [x,y,w,h,ax,ay]: ${JSON.stringify(tuple)}`)
      }
      const [x, y, w, h, ax, ay] = tuple
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof w !== 'number' ||
        typeof h !== 'number' ||
        typeof ax !== 'number' ||
        typeof ay !== 'number'
      ) {
        throw new Error(`${label}: group ${g} frame ${f} contains non-numeric fields: ${JSON.stringify(tuple)}`)
      }
      if (w < 1 || h < 1) {
        throw new Error(`${label}: group ${g} frame ${f} has non-positive dimension: ${w}x${h}`)
      }
      if (x < 0 || y < 0 || x + w > width || y + h > height) {
        throw new Error(
          `${label}: group ${g} frame ${f} exceeds bounds [${x},${y},${w},${h}] for texture ${width}x${height}`,
        )
      }
    }
  }
}

function verifyCharacterMeta(meta: EntityMeta, label: string, checkSorceressEvents = false): void {
  if (meta.schema !== 2) {
    throw new Error(`${label}: expected schema === 2, got ${meta.schema}`)
  }
  if (meta.directions !== 16) {
    throw new Error(`${label}: expected 16 directions, got ${meta.directions}`)
  }
  if (!meta.clips) {
    throw new Error(`${label}: missing clips dictionary`)
  }

  const expectedModes = ['wl', 'nu', 'rn', 'a1', 'a2', 'sc', 'gh', 'dt', 'dd', 'tn', 'tw']
  for (const mode of expectedModes) {
    const clip = meta.clips[mode]
    if (!clip) {
      throw new Error(`${label}: missing required player mode clip: ${mode}`)
    }
    const dirCount = clip.directions ?? meta.directions
    if (clip.group < 0 || clip.group + dirCount > meta.groups.length) {
      throw new Error(
        `${label}: mode ${mode} group ${clip.group} (directions: ${dirCount}) out of bounds for ${meta.groups.length} groups`,
      )
    }
    if (clip.frames < 1) {
      throw new Error(`${label}: mode ${mode} has invalid frame count: ${clip.frames}`)
    }
    if (clip.speed <= 0) {
      throw new Error(`${label}: mode ${mode} has invalid speed: ${clip.speed}`)
    }
  }

  if (
    !meta.clips.nu!.loop ||
    !meta.clips.wl!.loop ||
    !meta.clips.rn!.loop ||
    !meta.clips.tn!.loop ||
    !meta.clips.tw!.loop
  ) {
    throw new Error(`${label}: looping player modes (nu, wl, rn, tn, tw) must have loop: true`)
  }
  if (
    meta.clips.a1!.loop ||
    meta.clips.a2!.loop ||
    meta.clips.sc!.loop ||
    meta.clips.gh!.loop ||
    meta.clips.dt!.loop ||
    meta.clips.dd!.loop
  ) {
    throw new Error(`${label}: action/one-shot player modes (a1, a2, sc, gh, dt, dd) must have loop: false`)
  }

  if (checkSorceressEvents) {
    const a1AttackEvent = meta.clips.a1!.events.find(e => e.c === 1)
    if (!a1AttackEvent || a1AttackEvent.f !== 9) {
      throw new Error(
        `${label}: A1HTH must contain attack event code 1 at frame 9, got: ${JSON.stringify(meta.clips.a1!.events)}`,
      )
    }
    const scCastEvent = meta.clips.sc!.events.find(e => e.c === 1)
    if (!scCastEvent || scCastEvent.f !== 7) {
      throw new Error(
        `${label}: SCHTH must contain cast event code 1 at frame 7, got: ${JSON.stringify(meta.clips.sc!.events)}`,
      )
    }
  }

  if (meta.walk !== meta.clips.wl!.group) {
    throw new Error(`${label}: walk alias mismatch: ${meta.walk} vs ${meta.clips.wl!.group}`)
  }
  if (meta.stand !== meta.clips.nu!.group) {
    throw new Error(`${label}: stand alias mismatch: ${meta.stand} vs ${meta.clips.nu!.group}`)
  }
}

export function verifyMonsterMeta(meta: EntityMeta, label: string): void {
  if (meta.schema !== 2) {
    throw new Error(`${label}: expected schema === 2, got ${meta.schema}`)
  }
  if (!meta.token || !meta.weapon) {
    throw new Error(`${label}: missing token or weapon`)
  }
  if (meta.directions < 1 || meta.directions > 32) {
    throw new Error(`${label}: invalid directions count: ${meta.directions}`)
  }
  if (!meta.clips || !meta.clips.nu) {
    throw new Error(`${label}: missing nu mode in clips`)
  }

  for (const [mode, clip] of Object.entries(meta.clips)) {
    const dirCount =
      clip.directions ?? (mode === 'dd' || mode === 'dt' ? meta.groups.length - clip.group : meta.directions)
    if (clip.group < 0 || clip.group + dirCount > meta.groups.length) {
      throw new Error(
        `${label}: mode ${mode} group ${clip.group} (directions: ${dirCount}) out of bounds for ${meta.groups.length} groups`,
      )
    }
    if (clip.frames < 1) {
      throw new Error(`${label}: mode ${mode} has invalid frame count: ${clip.frames}`)
    }
    if (clip.speed <= 0) {
      throw new Error(`${label}: mode ${mode} has invalid speed: ${clip.speed}`)
    }
  }

  if (meta.clips.wl && meta.walkOffset !== meta.clips.wl.group) {
    throw new Error(`${label}: walkOffset mismatch: ${meta.walkOffset} vs ${meta.clips.wl.group}`)
  }
  if (meta.standOffset !== meta.clips.nu.group) {
    throw new Error(`${label}: standOffset mismatch: ${meta.standOffset} vs ${meta.clips.nu.group}`)
  }

  if (meta.blendMode && !(D2_DRAW_MODE_BLENDS as readonly string[]).includes(meta.blendMode)) {
    throw new Error(`${label}: invalid blendMode: ${meta.blendMode}`)
  }
  if (meta.glowGroups) {
    if (meta.glowGroups.length !== meta.groups.length) {
      throw new Error(
        `${label}: glowGroups length ${meta.glowGroups.length} does not match groups length ${meta.groups.length}`,
      )
    }
    // Glow frame bounds are checked per page by verifyEntityR8Pages (issue #921).
  }
}

export function verifyObjectMeta(meta: EntityMeta, label: string): void {
  if (meta.schema !== 2) {
    throw new Error(`${label}: expected schema === 2, got ${meta.schema}`)
  }
  if (!meta.token) {
    throw new Error(`${label}: missing token`)
  }
  if (meta.directions < 1 || meta.directions > 32) {
    throw new Error(`${label}: invalid directions count: ${meta.directions}`)
  }
  if (!meta.clips || !meta.clips.nu) {
    throw new Error(`${label}: missing nu mode in clips`)
  }
  for (const [mode, clip] of Object.entries(meta.clips)) {
    const dirCount = clip.directions ?? meta.directions
    if (clip.group < 0 || clip.group + dirCount > meta.groups.length) {
      throw new Error(
        `${label}: mode ${mode} group ${clip.group} (directions: ${dirCount}) out of bounds for ${meta.groups.length} groups`,
      )
    }
    if (clip.frames < 1) {
      throw new Error(`${label}: mode ${mode} has invalid frame count: ${clip.frames}`)
    }
  }
  if (meta.blendMode && !(D2_DRAW_MODE_BLENDS as readonly string[]).includes(meta.blendMode)) {
    throw new Error(`${label}: invalid blendMode: ${meta.blendMode}`)
  }
  if (meta.glowGroups) {
    if (meta.glowGroups.length !== meta.groups.length) {
      throw new Error(
        `${label}: glowGroups length ${meta.glowGroups.length} does not match groups length ${meta.groups.length}`,
      )
    }
    // Glow frame bounds are checked per page by verifyEntityR8Pages (issue #921).
  }
}

export function runVerification(): void {
  console.log('=== Verifying Pre-baked Schema 2 Entity, Object, Character & UI Packs ===')

  // 1. Verify Global entities in public/entities/
  const entityDirs = [join(ROOT_DIR, 'public', 'entities')]
  for (const dir of entityDirs) {
    if (!existsSync(dir)) {
      throw new Error(`Entity directory not found: ${dir}`)
    }
    if (!existsSync(join(dir, 'index.json'))) {
      throw new Error(`Missing index.json in ${dir}`)
    }
  }

  const globalDir = join(ROOT_DIR, 'public', 'entities')
  const catalog = JSON.parse(readFileSync(join(globalDir, 'index.json'), 'utf8')) as PackedEntityCatalogIndex
  const monsterMap = catalog.monsterByClassId ?? catalog.monstersByHcIdx ?? {}
  const objectMap = catalog.objectByClassId ?? catalog.objectsByClassId ?? {}
  const lookupMap = catalog.objectLookupByActTypeId ?? {}

  if (Object.keys(monsterMap).length !== 734) {
    throw new Error(`Expected 734 monsterByClassId entries (0..733), got ${Object.keys(monsterMap).length}`)
  }
  if (Object.keys(objectMap).length !== 573) {
    throw new Error(`Expected 573 objectByClassId entries (0..572), got ${Object.keys(objectMap).length}`)
  }
  if (Object.keys(lookupMap).length < 400) {
    throw new Error(`Expected >= 400 objectLookupByActTypeId entries, got ${Object.keys(lookupMap).length}`)
  }

  // Verify Act 1 Town NPCs in monsterByClassId
  const requiredTownNpcHcIdx = [146, 147, 148, 150, 154, 155]
  for (const hcIdx of requiredTownNpcHcIdx) {
    const entry = monsterMap[String(hcIdx)]
    if (!entry || !entry.file || !entry.metaFile || !entry.packPath) {
      throw new Error(`Missing Town NPC art entry for hcIdx=${hcIdx}: ${JSON.stringify(entry)}`)
    }
    for (const dir of entityDirs) {
      if (!existsSync(join(dir, entry.file)) || !existsSync(join(dir, entry.metaFile))) {
        throw new Error(`Missing Town NPC pack file ${entry.file} in ${dir}`)
      }
    }
  }

  // Verify canonical interactive objects (Gibbet 26, Rogue Torch 39, Waypoint 119, Stash 267)
  const requiredObjectIds = [26, 39, 119, 267]
  for (const objId of requiredObjectIds) {
    const entry = objectMap[String(objId)]
    if (!entry || !entry.file || !entry.metaFile || !entry.packPath) {
      throw new Error(`Missing object art entry for id=${objId}: ${JSON.stringify(entry)}`)
    }
    for (const dir of entityDirs) {
      if (!existsSync(join(dir, entry.file)) || !existsSync(join(dir, entry.metaFile))) {
        throw new Error(`Missing object pack file ${entry.file} in ${dir}`)
      }
    }
  }

  // 2. Verify all 7 player classes (char-am..char-ai)
  for (const charSlug of CHARACTER_SLUGS) {
    for (const dir of entityDirs) {
      const charJsonPath = join(dir, `${charSlug}.json`)
      const charR8Path = join(dir, `${charSlug}.r8`)
      if (!existsSync(charJsonPath) || !existsSync(charR8Path)) {
        throw new Error(`Missing ${charSlug} in ${dir}: ${charJsonPath} or ${charR8Path}`)
      }
      const charMeta: EntityMeta = JSON.parse(readFileSync(charJsonPath, 'utf8'))
      verifyCharacterMeta(charMeta, `${dir}/${charSlug}`, charSlug === 'char-so')
      verifyFrameTuples(charMeta.groups, charMeta.width, charMeta.height, `${dir}/${charSlug}`)
      const charR8Bytes = readFileSync(charR8Path)
      if (charR8Bytes.byteLength !== charMeta.width * charMeta.height) {
        throw new Error(
          `${dir}/${charSlug}.r8 byte length mismatch: ${charR8Bytes.byteLength} vs ${charMeta.width * charMeta.height}`,
        )
      }
    }
  }
  console.log(`✓ Verified all 7 player class R8 atlases (${CHARACTER_SLUGS.join(', ')}) in public/entities`)

  // 3. Verify all Global monsters (monster-*.json / .r8)
  const globalFiles = readdirSync(globalDir)
  const monsterJsonFiles = globalFiles.filter(f => f.startsWith('monster-') && f.endsWith('.json'))
  if (monsterJsonFiles.length < 200) {
    throw new Error(`Expected at least 200 global monster files, found: ${monsterJsonFiles.length}`)
  }

  for (const f of monsterJsonFiles) {
    const slug = f.replace('.json', '')
    const jsonPath = join(globalDir, f)
    const r8Path = join(globalDir, `${slug}.r8`)
    if (!existsSync(r8Path)) {
      throw new Error(`Missing R8 texture for ${f}: ${r8Path}`)
    }

    const meta: EntityMeta = JSON.parse(readFileSync(jsonPath, 'utf8'))
    verifyMonsterMeta(meta, `Global ${slug}`)
    verifyEntityR8Pages(meta, globalDir, `Global ${slug}`)
  }
  console.log(`✓ Global monsters & Town NPCs: verified ${monsterJsonFiles.length} monster .r8 atlases`)

  // 4. Verify all Global objects (object-*.json / .r8)
  const objectJsonFiles = globalFiles.filter(f => f.startsWith('object-') && f.endsWith('.json'))
  if (objectJsonFiles.length < 500) {
    throw new Error(`Expected at least 500 global object files, found: ${objectJsonFiles.length}`)
  }

  for (const f of objectJsonFiles) {
    const slug = f.replace('.json', '')
    const jsonPath = join(globalDir, f)
    const r8Path = join(globalDir, `${slug}.r8`)
    if (!existsSync(r8Path)) {
      throw new Error(`Missing R8 texture for ${f}: ${r8Path}`)
    }

    const meta: EntityMeta = JSON.parse(readFileSync(jsonPath, 'utf8'))
    verifyObjectMeta(meta, `Global ${slug}`)
    verifyEntityR8Pages(meta, globalDir, `Global ${slug}`)
  }
  console.log(`✓ Global objects: verified ${objectJsonFiles.length} object .r8 atlases`)

  // 5. Verify UI & Multi-frame Flippy Atlases
  const uiDirs = [join(ROOT_DIR, 'public', 'ui')]
  for (const uiDir of uiDirs) {
    const manifestPath = join(uiDir, 'manifest.json')
    const uiAtlasPath = join(uiDir, 'ui-atlas.json')
    const itemsAtlasPng = join(uiDir, 'items-atlas.png')
    if (!existsSync(manifestPath) || !existsSync(uiAtlasPath)) {
      throw new Error(`Missing UI manifest.json or ui-atlas.json in ${uiDir}`)
    }
    verifyPngFile(itemsAtlasPng, `${uiDir}/items-atlas.png`)
    const uiManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as BakedUiManifest
    const itemRectCount = Object.keys(uiManifest.itemRects ?? {}).length
    const flippyRectCount = Object.keys(uiManifest.flippyRects ?? {}).length
    const flippyFrameCount = Object.keys(uiManifest.flippyFrames ?? {}).length
    const classIdCount = Object.keys(uiManifest.itemClassIdToCode ?? {}).length
    if (itemRectCount < 700) {
      throw new Error(`${uiDir}: expected >= 700 itemRects, got ${itemRectCount}`)
    }
    if (flippyRectCount < 210) {
      throw new Error(`${uiDir}: expected >= 210 flippyRects, got ${flippyRectCount}`)
    }
    if (flippyFrameCount < 210) {
      throw new Error(`${uiDir}: expected >= 210 flippyFrames entries, got ${flippyFrameCount}`)
    }
    if (classIdCount !== 659) {
      throw new Error(`${uiDir}: expected 659 itemClassIdToCode entries (0..658), got ${classIdCount}`)
    }
    if ((uiManifest.flippyFrames?.['flpgld']?.length ?? 0) < 2) {
      throw new Error(`${uiDir}: expected multi-frame flippyFrames['flpgld']`)
    }
  }
  console.log(`✓ UI & Multi-Frame Flippy Atlases verified in ${uiDirs.join(' & ')}`)

  // 6. Verify Missiles, Overlays (incl. objsb), and Skills
  for (const sub of ['missiles', 'overlays', 'skills'] as const) {
    const pubSub = join(ROOT_DIR, 'public', sub)
    for (const d of [pubSub]) {
      if (!existsSync(d)) {
        throw new Error(`Missing ${sub} directory: ${d}`)
      }
      const pngFiles = readdirSync(d).filter(f => f.endsWith('.png'))
      if (pngFiles.length < 20) {
        throw new Error(`Expected >= 20 PNG files in ${d}, found ${pngFiles.length}`)
      }
      for (const pf of pngFiles) {
        verifyPngFile(join(d, pf), `${d}/${pf}`)
      }
    }
  }
  if (!existsSync(join(ROOT_DIR, 'public', 'overlays', 'objsb.png'))) {
    throw new Error('Missing shrine shimmer overlay objsb.png in public/overlays')
  }
  const requiredGenericSkillIcons = [
    'icon_0.png',
    'icon_0_sword.png',
    'icon_0_fist.png',
    'icon_1.png',
    'icon_2.png',
    'icon_3.png',
    'icon_4.png',
    'icon_5.png',
    'icon_217.png',
    'icon_218.png',
    'icon_219.png',
    'icon_220.png',
    'icon_350.png',
  ]
  for (const iconFile of requiredGenericSkillIcons) {
    verifyPngFile(join(ROOT_DIR, 'public', 'skills', iconFile), `public/skills/${iconFile}`, 48, 48)
  }
  console.log('✓ Missiles, Overlays (incl. objsb), and Skills PNG atlases & manifests verified (0 corrupt PNGs)')

  // 7. Verify per-Act PNG entity packs (Acts 1..5) if present
  for (let act = 1; act <= 5; act += 1) {
    const actDir = join(PACK_ROOT, `act${act}`, 'entities')
    if (!existsSync(actDir)) {
      continue
    }

    const actCharJson = join(actDir, 'char-so.json')
    const actCharPng = join(actDir, 'char-so.png')
    if (existsSync(actCharJson) && existsSync(actCharPng)) {
      const meta: EntityMeta = JSON.parse(readFileSync(actCharJson, 'utf8'))
      verifyCharacterMeta(meta, `Act ${act} char-so`, true)
      verifyFrameTuples(meta.groups, meta.width, meta.height, `Act ${act} char-so`)
      verifyPngFile(actCharPng, `Act ${act} char-so.png`, meta.width, meta.height)
    }

    const actFiles = readdirSync(actDir)
    const actMonJsonFiles = actFiles.filter(f => f.startsWith('monster-') && f.endsWith('.json'))
    for (const f of actMonJsonFiles) {
      const slug = f.replace('.json', '')
      const jsonPath = join(actDir, f)
      const pngPath = join(actDir, `${slug}.png`)
      if (!existsSync(pngPath)) {
        throw new Error(`Act ${act} missing PNG for ${f}: ${pngPath}`)
      }

      const meta: EntityMeta = JSON.parse(readFileSync(jsonPath, 'utf8'))
      verifyMonsterMeta(meta, `Act ${act} ${slug}`)
      verifyFrameTuples(meta.groups, meta.width, meta.height, `Act ${act} ${slug}`)
      if (meta.glowGroups) verifyFrameTuples(meta.glowGroups, meta.width, meta.height, `Act ${act} ${slug} (glowGroups)`)
      verifyPngFile(pngPath, `Act ${act} ${slug}.png`, meta.width, meta.height)
    }
    console.log(`✓ Act ${act}: verified char-so + ${actMonJsonFiles.length} monster PNG atlases`)
  }

  console.log('=== All Entity, Object, Character, UI, Missile, Overlay & Skill Packs Verified (0 errors) ===')
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runVerification()
}
