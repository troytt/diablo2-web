/**
 * Bake all 7 Diablo II character classes into web-native indexed PNG and raw R8 atlases (Schema 2).
 *
 * Classes:
 * - so: Sorceress (法师 / 女巫)
 * - am: Amazon (亚马逊)
 * - ne: Necromancer (死灵法师)
 * - pa: Paladin (圣骑士)
 * - ba: Barbarian (野蛮人)
 * - dz: Druid (德鲁伊)
 * - ai: Assassin (刺客)
 */
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { decodePl2 } from '../../common/formats/pl2.ts'
import { loadCharacterSheet, type CharacterSheet } from '../../common/units/character.ts'
import type { SpriteSheet } from '../../common/formats/sprite.ts'
import { packSheetToR8 } from './pack-entity-assets.ts'
import { encodeIndexedPng } from '../io/png.ts'
import { bakeAnimData } from './pack-animdata.ts'

const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
const PLAYER_MODES = [
  'wl', 'nu', 'rn', 'a1', 'a2', 'bl', 'sc', 'th', 'kk', 's1', 's2', 's3', 's4', 'gh', 'dt', 'dd', 'tn', 'tw',
] as const
const LOOPING_PLAYER_MODES = new Set(['nu', 'wl', 'rn', 'tn', 'tw'])
const PLAYER_WCLASS_ORDER = [
  'hth', '1hs', '1ht', 'ht1', 'ht2', '1ss', '1js', '1st', '1jt', 'bow', '2hs', '2ht', 'stf', 'xbw',
] as const
const PLAYER_MODE_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  a2: ['a2', 'a1'],
  s2: ['s2', 's1', 'sc', 'a1'],
  s3: ['s3', 's1', 'a1'],
  s4: ['s4', 's1', 'a2', 'a1'],
}

export const HERO_SPECS = [
  { token: 'so', code: 'sor', nameZh: '法师', nameEn: 'Sorceress' },
  { token: 'am', code: 'ama', nameZh: '亚马逊', nameEn: 'Amazon' },
  { token: 'ne', code: 'nec', nameZh: '死灵法师', nameEn: 'Necromancer' },
  { token: 'pa', code: 'pal', nameZh: '圣骑士', nameEn: 'Paladin' },
  { token: 'ba', code: 'bar', nameZh: '野蛮人', nameEn: 'Barbarian' },
  { token: 'dz', code: 'dru', nameZh: '德鲁伊', nameEn: 'Druid' },
  { token: 'ai', code: 'ass', nameZh: '刺客', nameEn: 'Assassin' },
] as const

export async function bakeAllCharacters(archiveDir = 'samples/d2', outDir = 'public'): Promise<void> {
  const t0 = performance.now()
  const archives = new MountedArchives()
  for (const name of MOUNTS) {
    try {
      const archive = await MpqArchive.open(await fileSource(join(archiveDir, name)))
      archives.add(name, archive)
    } catch (err) {
      console.warn(`skip ${name}: ${(err as Error).message}`)
    }
  }

  const animDataJsonPath = join(outDir, 'anim', 'animdata.json')
  if (!existsSync(animDataJsonPath)) {
    await bakeAnimData(archiveDir, outDir)
  }
  const animData = JSON.parse(readFileSync(animDataJsonPath, 'utf8'))

  const globalEntityDir = join(outDir, 'entities')
  await mkdir(globalEntityDir, { recursive: true })

  const characterManifestEntries: {
    token: string
    code: string
    nameEn: string
    nameZh: string
    file: string
    metaFile: string
    width: number
    height: number
    directions: number
    modes: string[]
  }[] = []

  const characterClipsByKey: Record<string, Record<string, {
    group: number
    directions: number
    frames: number
    speed: number
    loop: boolean
    events: { f: number; c: number }[]
  }>> = {}

  for (const spec of HERO_SPECS) {
    const { token, code, nameZh, nameEn } = spec
    const charT0 = performance.now()
    console.log(`Baking character: ${nameZh} (${nameEn}, token: ${token})...`)

    const charSheets: CharacterSheet[] = []
    const charClips: Record<string, {
      group: number
      directions: number
      frames: number
      speed: number
      loop: boolean
      events: { f: number; c: number }[]
    }> = {}

    let charGroupOffset = 0
    let totalCharMembers = 0

    for (const mode of PLAYER_MODES) {
      const candidateModes = PLAYER_MODE_FALLBACKS[mode] ?? [mode]
      let chosenSheet: CharacterSheet | undefined
      let chosenMode = mode as string
      let chosenWeapon = 'hth'

      for (const cm of candidateModes) {
        for (const wc of PLAYER_WCLASS_ORDER) {
          const cofPath = `data\\global\\chars\\${token}\\cof\\${token}${cm}${wc}.cof`
          if (!archives.has(cofPath)) continue
          if (cm !== mode && charClips[cm]) {
            chosenMode = cm
            chosenWeapon = wc
            break
          }
          const candidateSheet = await loadCharacterSheet(archives, token, cm, wc)
          if (candidateSheet.members.length > 0) {
            chosenSheet = candidateSheet
            chosenMode = cm
            chosenWeapon = wc
            break
          }
        }
        if (chosenSheet || (chosenMode !== mode && charClips[chosenMode])) break
      }

      if (!chosenSheet && chosenMode !== mode && charClips[chosenMode]) {
        const baseClip = charClips[chosenMode]!
        const cofName = `${token.toUpperCase()}${mode.toUpperCase()}${chosenWeapon.toUpperCase()}`
        const animRecord = animData.clips[cofName] ?? animData.clips[`${token.toUpperCase()}${chosenMode.toUpperCase()}${chosenWeapon.toUpperCase()}`]
        const speed = animRecord?.speed ?? baseClip.speed
        const events = animRecord?.events
          ? animRecord.events.map(([f, c]: [number, number]) => ({ f, c }))
          : baseClip.events
        charClips[mode] = {
          ...baseClip,
          speed,
          loop: LOOPING_PLAYER_MODES.has(mode),
          events,
        }
        continue
      }

      const sheet = chosenSheet ?? await loadCharacterSheet(archives, token, chosenMode, chosenWeapon)
      charSheets.push(sheet)
      totalCharMembers += sheet.members.length

      const cofName = `${token.toUpperCase()}${chosenMode.toUpperCase()}${chosenWeapon.toUpperCase()}`
      const animRecord = animData.clips[cofName] ?? animData.clips[`${token.toUpperCase()}${chosenMode.toUpperCase()}HTH`]
      const speed = animRecord?.speed ?? 256
      const events = (animRecord?.events ?? []).map(([f, c]: [number, number]) => ({ f, c }))
      charClips[mode] = {
        group: charGroupOffset,
        directions: sheet.directions,
        frames: sheet.framesPerDirection,
        speed,
        loop: LOOPING_PLAYER_MODES.has(mode),
        events,
      }
      charGroupOffset += sheet.sheet.groups.length
    }

    characterClipsByKey[token] = charClips
    characterClipsByKey[`char-${token}`] = charClips

    const charJoined: SpriteSheet = {
      groups: charSheets.flatMap(s => s.sheet.groups),
      width: null,
    }

    const packedCharR8 = packSheetToR8(charJoined)
    const r8File = `char-${token}.r8`
    const jsonFile = `char-${token}.json`
    const metaJson = JSON.stringify({
      schema: 2,
      token,
      file: r8File,
      format: 'r8',
      width: packedCharR8.width,
      height: packedCharR8.height,
      directions: charClips.wl?.directions ?? 16,
      walk: charClips.wl?.group ?? 0,
      stand: charClips.nu?.group ?? 16,
      walkOffset: charClips.wl?.group ?? 0,
      standOffset: charClips.nu?.group ?? 16,
      walkFrames: charClips.wl?.frames ?? 8,
      standFrames: charClips.nu?.frames ?? 8,
      members: totalCharMembers,
      clips: charClips,
      modes: charClips,
      groups: packedCharR8.groups,
    })

    await writeFile(join(globalEntityDir, r8File), packedCharR8.r8)
    await writeFile(join(globalEntityDir, jsonFile), metaJson)

    characterManifestEntries.push({
      token,
      code,
      nameEn,
      nameZh,
      file: r8File,
      metaFile: jsonFile,
      width: packedCharR8.width,
      height: packedCharR8.height,
      directions: charClips.wl?.directions ?? 16,
      modes: Object.keys(charClips),
    })

    console.log(`  ✓ ${nameZh} (${token}) finished in ${(performance.now() - charT0).toFixed(0)} ms (atlas: ${packedCharR8.width}x${packedCharR8.height})`)
  }

  const manifestJson = JSON.stringify({
    schema: 2,
    characters: characterManifestEntries,
    characterClips: characterClipsByKey,
  }, null, 2)

  await writeFile(join(globalEntityDir, 'character-manifest.json'), manifestJson)

  // Update index.json in globalEntityDir with characterClips if present
  const idxPath = join(globalEntityDir, 'index.json')
  if (existsSync(idxPath)) {
    try {
      const parsed = JSON.parse(readFileSync(idxPath, 'utf8'))
      parsed.characterClips = characterClipsByKey
      await writeFile(idxPath, JSON.stringify(parsed))
    } catch (err) {
      console.warn(`Could not update ${idxPath}: ${(err as Error).message}`)
    }
  }

  console.log(`All 7 characters baked successfully in ${(performance.now() - t0).toFixed(0)} ms!`)
}

function parseCharactersCliArgs(argv: readonly string[]): { archiveDir: string; outDir: string } {
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

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { archiveDir, outDir } = parseCharactersCliArgs(process.argv.slice(2))
  bakeAllCharacters(archiveDir, outDir).catch(err => {
    console.error('Failed to bake characters:', err)
    process.exit(1)
  })
}
