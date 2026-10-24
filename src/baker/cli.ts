/**
 * Unified Offline Asset & Table Baker CLI (`src/baker/cli.ts`).
 *
 * Usage:
 *   npm run bake -- <target> [--ffmpeg <path>]
 *   npm run bake -- --verify
 *
 * Supported targets:
 *   tiles, acts, entities, missiles, overlays, ui, frontend-ui,
 *   animdata, char-layers, characters, cursor, skills, drop-data, tbl,
 *   input-tables, monstats2-flags, monster-path, overlay-rows, weather,
 *   sound-tables, sfx, music, manifest, all
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  UNIVERSAL_DT1_PATHS,
  isCacheableAssetPath,
  validateAssetManifest,
  validatePackManifest,
  validateUniversalDt1Libraries,
} from '../common/pack-contract/index.ts'
import { hashFileSha256Prefix, validatePublicAssetRoots } from './io/asset-manifest.ts'
import { cell, loadActTables, resolveLevelLibraries } from '../common/world/acts.ts'
import { formatAudioAuditReport, runAudioAudit } from './audit/verify-audio-113c.ts'
import { DEFAULT_NODE_MPQ_DIR, mountNodeArchives } from './mpq-archive-source.ts'
import { auditDropParity } from './packers/pack-canonical-drop-data.ts'
import {
  FFMPEG_ENV_VAR_113C,
  parsePackSfxCliArgs113c,
  probeFfmpegOpus113c,
} from './packers/pack-sfx.ts'

const TARGET_SCRIPTS: Readonly<Record<string, string>> = {
  tiles: 'src/baker/packers/pack-tiles.ts',
  acts: 'src/baker/packers/pack-act-assets.ts',
  entities: 'src/baker/packers/pack-entity-assets.ts',
  missiles: 'src/baker/packers/pack-missiles.ts',
  overlays: 'src/baker/packers/pack-overlays.ts',
  ui: 'src/baker/packers/pack-ui.ts',
  'frontend-ui': 'src/baker/packers/pack-frontend-ui.ts',
  animdata: 'src/baker/packers/pack-animdata.ts',
  excel: 'src/baker/packers/pack-excel-tables.ts',
  'char-layers': 'src/baker/packers/pack-char-so-layers.ts',
  'char-so': 'src/baker/packers/pack-char-so-layers.ts',
  characters: 'src/baker/packers/pack-characters.ts',
  cursor: 'src/baker/packers/pack-cursor.ts',
  'pd2-hd-cursor': 'src/baker/packers/pack-pd2-hd-cursor.ts',
  skills: 'src/baker/packers/pack-skill-assets.ts',
  'drop-data': 'src/baker/packers/pack-canonical-drop-data.ts',
  tbl: 'src/baker/packers/pack-canonical-tbl.ts',
  'input-tables': 'src/baker/packers/pack-input-tables-113c.ts',
  'monstats2-flags': 'src/baker/packers/pack-monstats2-flags.ts',
  'monster-path': 'src/baker/packers/pack-monster-path-data.ts',
  'overlay-rows': 'src/baker/packers/pack-overlay-rows.ts',
  weather: 'src/baker/packers/pack-weather.ts',
  'sound-tables': 'src/baker/packers/pack-sound-tables.ts',
  sfx: 'src/baker/packers/pack-sfx.ts',
  music: 'src/baker/packers/pack-music.ts',
  'ambient-sounds': 'src/baker/packers/pack-ambient-sounds.ts',
  '--pack-ambient-sounds': 'src/baker/packers/pack-ambient-sounds.ts',
  ambient: 'src/baker/packers/pack-ambient-sounds.ts',
  'skill-sounds': 'src/baker/packers/pack-skill-sounds.ts',
  'pack-skill-sounds': 'src/baker/packers/pack-skill-sounds.ts',
  '--pack-skill-sounds': 'src/baker/packers/pack-skill-sounds.ts',
  'monster-sounds': 'src/baker/packers/pack-monster-sounds.ts',
  'pack-monster-sounds': 'src/baker/packers/pack-monster-sounds.ts',
  '--pack-monster-sounds': 'src/baker/packers/pack-monster-sounds.ts',
  '--monster-sounds': 'src/baker/packers/pack-monster-sounds.ts',
  monsters: 'src/baker/packers/pack-monster-sounds.ts',
  speech: 'src/baker/packers/pack-speech.ts',
  'pack-speech': 'src/baker/packers/pack-speech.ts',
  '--pack-speech': 'src/baker/packers/pack-speech.ts',
  '--speech': 'src/baker/packers/pack-speech.ts',
  manifest: 'src/baker/io/asset-manifest.ts',
}

export const ALL_BAKE_TARGETS: readonly string[] = [
  'animdata',
  'excel',
  'tiles',
  'characters',
  'char-layers',
  'entities',
  'overlay-rows',
  'cursor',
  'missiles',
  'overlays',
  'ui',
  'frontend-ui',
  'skills',
  'drop-data',
  'tbl',
  'weather',
  'sound-tables',
  'sfx',
  'music',
  'ambient-sounds',
  'monster-sounds',
  'speech',
  'skill-sounds',
  'manifest',
]

export interface BakerVerifySummary {
  readonly tileManifestVerified: boolean
  readonly publicRootsVerified: boolean
  readonly levelsVerified: number
  readonly universalDt1Count: number
  readonly dropParityVerified: boolean
  readonly entityPacksVerified: boolean
  /** Sections of the shared 1.13c audio audit (`src/baker/audit/verify-audio-113c.ts`) that passed. */
  readonly audioSectionsVerified: readonly string[]
}

/**
 * Runs offline contract, universal DT1, 136-level library, drop table, entity pack and 1.13c audio
 * (`npm run verify:audio`, every registered section) verification.
 */
export async function runBakerVerify(rootDir: string = process.cwd()): Promise<BakerVerifySummary> {
  console.log('=== Diablo II v1.13c Baker Offline Contract & Pack Verification ===')

  // 0. Validate public/ top-level asset roots against CACHEABLE_PREFIXES and verify cursor-pd2/ manifest coverage (#1314)
  const publicDir = join(rootDir, 'public')
  const publicRoots = validatePublicAssetRoots(publicDir)
  const assetManifestPath = join(publicDir, 'asset-manifest.json')
  if (existsSync(assetManifestPath)) {
    const assetManifest = validateAssetManifest(
      JSON.parse(readFileSync(assetManifestPath, 'utf-8')),
    )
    for (const rel of ['cursor-pd2/hand.png', 'cursor-pd2/manifest.json', 'cursor-pd2/other.png']) {
      const abs = join(publicDir, rel)
      if (!existsSync(abs)) continue
      if (!isCacheableAssetPath(rel)) {
        throw new Error(`Expected ${rel} to be cacheable via isCacheableAssetPath (#1314)`)
      }
      const expectedHash = hashFileSha256Prefix(abs).hash
      const actualHash = assetManifest.files[rel]
      if (actualHash !== expectedHash) {
        throw new Error(
          `Asset manifest mismatch for ${rel}: manifest=${String(actualHash)} !== disk=${expectedHash} (run "npm run pack:manifest")`,
        )
      }
    }
  }
  console.log(
    `✓ Public asset roots verified (${publicDir}): ${String(publicRoots.cacheableDirs.length)} cacheable dirs [${publicRoots.cacheableDirs.join(', ')}]`,
  )

  // 1. Validate tile catalog manifest (`public/act-packs/tiles/index.json`)
  const tileIndexPath = join(rootDir, 'public', 'act-packs', 'tiles', 'index.json')
  if (!existsSync(tileIndexPath)) {
    throw new Error(`Tile catalog index.json not found in ${tileIndexPath}`)
  }
  const rawTileIndex = JSON.parse(readFileSync(tileIndexPath, 'utf-8')) as import('../common/pack-contract/index.ts').PackedTileCatalogIndex
  const tileCatalog = validatePackManifest(rawTileIndex)
  console.log(
    `✓ Tile catalog verified (${tileIndexPath}): ${tileCatalog.totalLibraries} libraries, ${tileCatalog.totalTiles} tiles, missingFiles=${tileCatalog.missingFiles.length}, invisWalFloorVerified=${String(tileCatalog.invisWalFloorVerified)}`,
  )

  // 2. Verify all 136 levels resolve universal DT1s (`Blank.dt1`, `InvisWal.dt1`, `Warp.dt1`)
  const archiveDir = existsSync(join(rootDir, 'samples', 'd2', 'd2data.mpq'))
    ? join(rootDir, 'samples', 'd2')
    : DEFAULT_NODE_MPQ_DIR
  const archives = await mountNodeArchives(archiveDir)
  const tables = await loadActTables(archives)
  let levelsVerified = 0
  for (let levelId = 1; levelId <= 136; levelId += 1) {
    const row = tables.levels.rows.find(r => Number(cell(tables.levels, r, 'Id')) === levelId)
    if (!row) {
      throw new Error(`Missing level Id=${levelId} in Levels.txt`)
    }
    const levelTypeId = Number(cell(tables.levels, row, 'LevelType'))
    const libs = resolveLevelLibraries(tables, levelTypeId)
    validateUniversalDt1Libraries(libs, `levelId=${levelId} (levelType=${levelTypeId})`)
    levelsVerified += 1
  }
  console.log(
    `✓ All ${levelsVerified}/136 levels verified to include the ${UNIVERSAL_DT1_PATHS.length} universal DT1s (${UNIVERSAL_DT1_PATHS.join(', ')})`,
  )

  // 3. Verify 1.13c canonical drop data parity (MonStats, SuperUniques, DifficultyLevels)
  const dropAudit = await auditDropParity(
    archiveDir,
    join(rootDir, 'src', 'common', 'data', 'canonical-drop-data.ts'),
  )
  if (
    !dropAudit.monstatsMatch ||
    !dropAudit.superUniquesMatch ||
    !dropAudit.difficultyLevelsMatch ||
    dropAudit.monsterKindsCount !== 734 ||
    dropAudit.superUniquesCount !== 66 ||
    dropAudit.difficultyLevelsCount !== 3
  ) {
    throw new Error(`Drop data parity check failed: ${JSON.stringify(dropAudit)}`)
  }
  console.log(
    `✓ Canonical drop data parity verified: ${dropAudit.monsterKindsCount} MonsterKinds, ${dropAudit.superUniquesCount} SuperUniques, ${dropAudit.difficultyLevelsCount} DifficultyLevels`,
  )

  // 4. Verify Schema 2 entity packs if present
  let entityPacksVerified = false
  if (existsSync(join(rootDir, 'public', 'entities'))) {
    const res = spawnSync(
      process.execPath,
      ['--import', 'tsx', join(rootDir, 'src', 'baker', 'audit', 'verify-entity-packs.ts')],
      { cwd: rootDir, stdio: 'inherit' },
    )
    if (res.status !== 0) {
      throw new Error(`verify-entity-packs.ts failed with status ${String(res.status)}`)
    }
    entityPacksVerified = true
  }

  // 5. Audit the 1.13c audio pipeline — the same module and sections as `npm run verify:audio` (no skips).
  const audioReport = await runAudioAudit({ rootDir, mpqDir: archiveDir })
  for (const line of formatAudioAuditReport(audioReport)) console.log(line)
  if (!audioReport.ok) {
    const failed = audioReport.sections.filter(s => !s.ok).map(s => s.id)
    throw new Error(`Audio audit failed: ${String(audioReport.errorCount)} error(s) in [${failed.join(', ')}]`)
  }

  console.log('=== All Baker Offline Verifications Passed (0 errors) ===')
  return {
    tileManifestVerified: true,
    publicRootsVerified: true,
    levelsVerified,
    universalDt1Count: UNIVERSAL_DT1_PATHS.length,
    dropParityVerified: true,
    entityPacksVerified,
    audioSectionsVerified: audioReport.sections.map(s => s.id),
  }
}

function stripFfmpegFlags(argv: readonly string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    if (arg === '--ffmpeg' || arg === '--ffmpeg-path') {
      i += 1
      continue
    }
    if (arg.startsWith('--ffmpeg=') || arg.startsWith('--ffmpeg-path=')) {
      continue
    }
    out.push(arg)
  }
  return out
}

function runSubscript(
  scriptRelPath: string,
  extraArgs: readonly string[],
  rootDir: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const scriptPath = join(rootDir, scriptRelPath)
  const res = spawnSync(
    process.execPath,
    ['--import', 'tsx', scriptPath, ...extraArgs],
    { cwd: rootDir, stdio: 'inherit', env },
  )
  if (res.status !== 0) {
    throw new Error(`Baker target ${scriptRelPath} exited with code ${String(res.status)}`)
  }
}

export interface RunBakerCliOptions {
  readonly rootDir?: string | undefined
  readonly env?: NodeJS.ProcessEnv | undefined
  readonly skipFfmpegProbe?: boolean | undefined
  readonly runTarget?: (
    target: string,
    scriptRelPath: string,
    extraArgs: readonly string[],
    rootDir: string,
    env: NodeJS.ProcessEnv,
  ) => void
}

export async function runBakerCli(
  argv: readonly string[] = process.argv.slice(2),
  options?: RunBakerCliOptions,
): Promise<void> {
  const rootDir = resolve(options?.rootDir ?? process.cwd())
  const baseEnv: NodeJS.ProcessEnv = { ...(options?.env ?? process.env) }
  if (argv.includes('--verify') || argv[0] === 'verify') {
    await runBakerVerify(rootDir)
    return
  }

  const target = argv[0]
  const rawRestArgs = argv.slice(1)

  if (!target || target === '--help' || target === '-h') {
    console.log(
      `Usage: npm run bake -- <target|--verify> [--ffmpeg <path>]\nTargets: ${Object.keys(TARGET_SCRIPTS).join(', ')}, all`,
    )
    return
  }

  const parsedFfmpeg = parsePackSfxCliArgs113c(rawRestArgs, baseEnv)
  if (parsedFfmpeg.ffmpegPath !== undefined) {
    baseEnv[FFMPEG_ENV_VAR_113C] = parsedFfmpeg.ffmpegPath
  }
  const restArgs = stripFfmpegFlags(rawRestArgs)
  const runner =
    options?.runTarget ??
    ((_t, scriptRelPath, extraArgs, root, env) => runSubscript(scriptRelPath, extraArgs, root, env))

  if (target === 'all' || target === '--all') {
    let manifestRefreshed = false
    try {
      for (const key of ALL_BAKE_TARGETS) {
        if (
          (key === 'sfx' ||
            key === 'music' ||
            key === 'ambient-sounds' ||
            key === 'skill-sounds' ||
            key === 'monster-sounds' ||
            key === 'speech') &&
          !options?.skipFfmpegProbe
        ) {
          probeFfmpegOpus113c(parsedFfmpeg.ffmpegPath, key, baseEnv)
        }
        runner(key, TARGET_SCRIPTS[key]!, restArgs, rootDir, baseEnv)
        if (key === 'manifest') {
          manifestRefreshed = true
        }
      }
    } finally {
      if (!manifestRefreshed && existsSync(join(rootDir, 'public'))) {
        try {
          runner('manifest', TARGET_SCRIPTS.manifest!, [], rootDir, baseEnv)
        } catch (manifestErr) {
          console.warn(
            '[bake] Failed to refresh fallback asset-manifest.json after target failure:',
            manifestErr,
          )
        }
      }
    }
    return
  }

  const scriptRel = TARGET_SCRIPTS[target]
  if (!scriptRel) {
    throw new Error(
      `Unknown bake target "${target}". Expected one of: ${Object.keys(TARGET_SCRIPTS).join(', ')}, all, --verify`,
    )
  }
  if (
    (target === 'sfx' ||
      target === 'music' ||
      target === 'ambient-sounds' ||
      target === 'ambient' ||
      target === '--pack-ambient-sounds' ||
      target === 'skill-sounds' ||
      target === 'pack-skill-sounds' ||
      target === '--pack-skill-sounds' ||
      target === 'monster-sounds' ||
      target === 'pack-monster-sounds' ||
      target === '--pack-monster-sounds' ||
      target === '--monster-sounds' ||
      target === 'monsters' ||
      target === 'speech' ||
      target === 'pack-speech' ||
      target === '--pack-speech' ||
      target === '--speech') &&
    !options?.skipFfmpegProbe
  ) {
    probeFfmpegOpus113c(parsedFfmpeg.ffmpegPath, target, baseEnv)
  }
  runner(target, scriptRel, restArgs, rootDir, baseEnv)
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMain) {
  runBakerCli().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
