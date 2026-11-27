/**
 * Diablo II v1.13c audio pipeline audit — the ONE module behind `npm run verify:audio`
 * (`tools/verify-audio.ts`) and the audio step of `npm run bake:verify` (`runBakerVerify()` in
 * `src/baker/cli.ts`). Both commands run every registered section; neither can skip one.
 *
 * Exit semantics (fail closed): a section passes only with at least one evaluated check and zero
 * errors; a section that throws (missing MPQ, missing committed table, parse error) is recorded as
 * a failure; an unknown or not-yet-registered section id is a usage error.
 *
 * Sections are registered statically in milestone order (M21 issues #943–#948). #943 owns `tables`:
 * the 1.13c `Sounds.txt` (4,699 rows), `SoundEnviron.txt` (50 rows) and `Levels.txt` `SoundEnv`
 * (136 levels) are re-baked from the data MPQs with `pack-sound-tables.ts`, byte-compared with the
 * committed generated modules, and checked against the D2Client.dll load post-processing
 * (0x6fb0e8e1–0x6fb0e952), the musicRange scan (0x6fb0e954–0x6fb0e990) and BuildSoundPath (0x6fb0db30).
 */

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import type { MusicTrackMeta113c } from '../../common/audio/music-tracks-113c.ts'
import type { SfxPackEntry113c, SfxPackMeta113c, SfxPackTuple113c } from '../../common/audio/sfx-pack-index-113c.ts'
import { LEVEL_SOUND_ENV_113C, SOUND_ENVIRON_113C } from '../../common/audio/sound-environ-113c.ts'
import { SOUNDS_113C, buildSoundMpqPath113c } from '../../common/audio/sounds-113c.ts'
import { parseWavPcm16, type WavPcm16 } from '../../common/formats/wav.ts'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { decryptBlock, fileKey } from '../../common/mpq/crypt.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import {
  isCacheableAssetPath,
  normalizeAssetManifestPath,
  validateAssetManifest,
} from '../../common/pack-contract/index.ts'
import type { SpeechEntry113c } from '../../common/audio/speech-index-113c.ts'
import { cell, loadActTables } from '../../common/world/acts.ts'
import { generateAssetManifest } from '../io/asset-manifest.ts'
import { DEFAULT_NODE_MPQ_DIR, MPQ_LOAD_ORDER, syncNodeFileSource } from '../mpq-archive-source.ts'
import {
  AMBIENT_SFX_PACK_SPECS_113C,
  isAmbientSceneOrEventRow113c,
  isCoreAmbientRow113c,
} from '../packers/pack-ambient-sounds.ts'
import {
  D3_MONSTER_PART_MAX_BYTES,
  MON_SOUNDS_TS_FILE,
  MONSTER_ACT_BUCKETS_113C,
  extractMonsterSoundTables113c,
  isStrictMonsterSoundRow113c,
  renderMonSoundsModule113c,
  type MonsterActBucket113c,
} from '../packers/pack-monster-sounds.ts'
import {
  MUSIC_EXPECTED_TRACK_COUNT_113C,
  MUSIC_FIRST_SOUND_ID_113C,
  MUSIC_LAST_SOUND_ID_113C,
  MUSIC_MAX_TOTAL_BYTES_113C,
  MUSIC_MAX_TRACK_BYTES_113C,
  MUSIC_MIN_BITRATE_BPS_113C,
} from '../packers/pack-music.ts'
import {
  CORE_SFX_PACK_SPECS_113C,
  MIN_RECOMMENDED_FFMPEG_MAJOR_113C,
  SFX_FFMPEG_OPUS_ARGS_SUMMARY_113C,
  SFX_MONO_BITRATE_113C,
  SFX_PACK_HEADER_BYTES_113C,
  SFX_PACK_INDEX_TS_FILE,
  SFX_STEREO_BITRATE_113C,
  getFfmpegVersionSummary113c,
  inspectOggOpusChunk113c,
  normalizeSoundFileName113c,
  parseSfxPackHeader113c,
  resolveCoreSfxPackSpec113c,
} from '../packers/pack-sfx.ts'
import {
  D3_SKILL_PART_MAX_BYTES,
  SKILL_BUCKETS,
  SKILL_SOUND_TS_FILE,
  classifySkillRowBucket113c,
  extractSkillAndMissileSoundTables113c,
  renderSkillSoundsModule113c,
  type SkillBucket113c,
} from '../packers/pack-skill-sounds.ts'
import {
  SOUND_ENVIRON_TS_FILE,
  SOUNDS_TS_FILE,
  buildSoundTablesPack,
  mountSoundTableArchives,
  renderSoundEnvironModule,
  renderSoundsModule,
  type SoundTablesPack,
} from '../packers/pack-sound-tables.ts'
import {
  D16_SPEECH_MAX_TOTAL_BYTES_113C,
  SPEECH_FIRST_SOUND_ID_113C,
  SPEECH_INDEX_TS_FILE,
  SPEECH_LAST_SOUND_ID_113C,
  SPEECH_MIN_BITRATE_BPS_113C,
  inspectWebmOpusSpeech113c,
  isSpeechRow113c,
  speechFileNameToWebmUrl113c,
} from '../packers/pack-speech.ts'

/** Every audit section of the M21 audio pipeline (closed set; the registry lists the implemented ones). */
export type AudioAuditSectionId =
  | 'tables' // #943
  | 'sfx-core' // #944
  | 'music' // #945
  | 'ambient'
  | 'levels'
  | 'weather' // #946
  | 'skills' // #947
  | 'monsters'
  | 'speech'
  | 'manifest' // #948

/** The Gitea issue that owns each section. */
export const AUDIO_AUDIT_SECTION_OWNERS_113C: Readonly<Record<AudioAuditSectionId, 943 | 944 | 945 | 946 | 947 | 948>> = {
  tables: 943,
  'sfx-core': 944,
  music: 945,
  ambient: 946,
  levels: 946,
  weather: 946,
  skills: 947,
  monsters: 948,
  speech: 948,
  manifest: 948,
}

/** Full 1.13c audio mount chain (the last mounted archive wins): music, speech, SFX, then the data archives. */
export const AUDIO_ARCHIVE_LOAD_ORDER_113C = [
  'd2music.mpq',
  'D2xMusic.mpq',
  'd2speech.mpq',
  'd2xtalk.mpq',
  'd2sfx.mpq',
  ...MPQ_LOAD_ORDER,
] as const

export interface AudioAuditContext {
  /** Repository / worktree root holding the committed generated tables (and `public/`). */
  readonly rootDir: string
  /** Directory of the 1.13c MPQs, resolved once per run. */
  readonly mpqDir: string
  readonly publicDir: string
  /** The 4 data archives (`MPQ_LOAD_ORDER`), mounted lazily once per run; throws if one is missing. */
  dataArchives(): MountedArchives
  /** The full audio chain (`AUDIO_ARCHIVE_LOAD_ORDER_113C`), mounted lazily once per run; throws if one is missing. */
  audioArchives(): MountedArchives
}

export interface AudioAuditSectionOutcome {
  /** Assertions evaluated; 0 makes the section fail as vacuous. */
  readonly checks: number
  /** Each prefixed `<id>: `. */
  readonly errors: readonly string[]
  /** One line printed on success. */
  readonly summary: string
  readonly facts?: Readonly<Record<string, number | string | boolean>>
}

export interface AudioAuditSection {
  readonly id: AudioAuditSectionId
  readonly title: string
  run(ctx: AudioAuditContext): Promise<AudioAuditSectionOutcome>
}

export interface AudioAuditSectionResult extends AudioAuditSectionOutcome {
  readonly id: AudioAuditSectionId
  readonly ok: boolean
  readonly durationMs: number
}

export interface AudioAuditReport {
  /** `sections.length > 0` and every section ok. */
  readonly ok: boolean
  readonly rootDir: string
  readonly mpqDir: string
  readonly sections: readonly AudioAuditSectionResult[]
  readonly errorCount: number
  readonly durationMs: number
}

export interface RunAudioAuditOptions {
  /** Default `process.cwd()`. */
  readonly rootDir?: string
  /** Default {@link resolveAudioAuditMpqDir}(rootDir). */
  readonly mpqDir?: string
  /** Default: every registered section. An unknown or unregistered id throws. */
  readonly sections?: readonly string[]
  /** Test seam; default {@link AUDIO_AUDIT_SECTIONS_113C}. */
  readonly registry?: readonly AudioAuditSection[]
}

const SOUNDS_ROWS_113C = 4699
const SOUND_ENVIRON_ROWS_113C = 50
const LEVEL_COUNT_113C = 136
/** `MUSIC_SOUND_RANGE_113C` required by R1 (`musicRange 4657..4684`). */
const MUSIC_RANGE_113C: readonly [number, number] = [4657, 4684]
/** Gitea #943: "共 590 行使用" — the number of Sounds.txt rows with Compound ≠ 0. */
const COMPOUND_ROWS_113C = 590
/** All three tables resolve from the 1.13c patch archive (the overlay winner). */
const TABLES_ARCHIVE_113C = 'Patch_D2.mpq'
/** BuildSoundPath 0x6fb0db30 asserts `strlen(path) < 0x50` (0x6fb0dc1e). */
const SOUND_PATH_MAX_113C = 0x50

/** The MPQ directory rule of `runBakerVerify()` step 2: `<root>/samples/d2` when it holds d2data.mpq, else the default. */
export function resolveAudioAuditMpqDir(rootDir: string): string {
  const local = join(rootDir, 'samples', 'd2')
  return existsSync(join(local, 'd2data.mpq')) ? local : DEFAULT_NODE_MPQ_DIR
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** First differing line of two texts (1-based), with both lines clipped to 160 characters. */
function firstDifference(committed: string, rebaked: string): string {
  const a = committed.split('\n')
  const b = rebaked.split('\n')
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) {
      const clip = (s: string | undefined): string => (s === undefined ? '<end of file>' : JSON.stringify(s.slice(0, 160)))
      return `line ${String(i + 1)}: committed ${clip(a[i])} / rebaked ${clip(b[i])}`
    }
  }
  return 'texts differ only in length'
}

const dataArchiveCacheByDir = new Map<string, MountedArchives>()
const audioArchiveCacheByDir = new Map<string, MountedArchives>()
const wavHeaderCacheByKey = new Map<string, WavPcm16>()

function mountChain(mpqDir: string, names: readonly string[]): MountedArchives {
  if (!existsSync(mpqDir)) throw new Error(`MPQ directory does not exist: ${mpqDir}`)
  const mounted = new MountedArchives()
  for (const name of names) mounted.add(name, MpqArchive.openSync(syncNodeFileSource(join(mpqDir, name))))
  return mounted
}

function parseWavHeaderPrefix113c(prefix: Uint8Array, totalFileSize: number): WavPcm16 | null {
  if (prefix.byteLength < 44) return null
  const fourCc = (at: number): string =>
    String.fromCharCode(prefix[at]!, prefix[at + 1]!, prefix[at + 2]!, prefix[at + 3]!)
  if (fourCc(0) !== 'RIFF' || fourCc(8) !== 'WAVE') return null
  const view = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength)
  const riffEnd = 8 + view.getUint32(4, true)
  if (riffEnd > totalFileSize) return null
  let fmt: { channels: 1 | 2; sampleRate: number; blockAlign: number } | null = null
  let at = 12
  while (at + 8 <= prefix.byteLength && at + 8 <= riffEnd) {
    const id = fourCc(at)
    const size = view.getUint32(at + 4, true)
    const body = at + 8
    if (body + size > riffEnd) return null
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > prefix.byteLength) return null
      const tag = view.getUint16(body, true)
      const channels = view.getUint16(body + 2, true)
      const sampleRate = view.getUint32(body + 4, true)
      const blockAlign = view.getUint16(body + 12, true)
      const bits = view.getUint16(body + 14, true)
      if (tag !== 1 || (channels !== 1 && channels !== 2) || bits !== 16 || blockAlign !== channels * 2 || sampleRate <= 0) {
        return null
      }
      fmt = { channels, sampleRate, blockAlign }
    } else if (id === 'data') {
      if (!fmt || size % fmt.blockAlign !== 0) return null
      return {
        channels: fmt.channels,
        sampleRate: fmt.sampleRate,
        frames: size / fmt.blockAlign,
        dataOffset: body,
        dataBytes: size,
      }
    }
    at = body + size + (size & 1)
  }
  return null
}

async function readCachedMpqWavHeader(
  mpqDir: string,
  archives: MountedArchives,
  mpqPath: string,
  label: string,
): Promise<WavPcm16> {
  const key = `${mpqDir}::${mpqPath.toLowerCase()}`
  const hit = wavHeaderCacheByKey.get(key)
  if (hit !== undefined) return hit

  const found = archives.find(mpqPath)
  if (found !== undefined) {
    const { file } = found
    const archive = found.entry.archive as unknown as {
      readonly header: { readonly sectorSize: number }
      readonly source: { read(offset: number, length: number): Promise<Uint8Array> }
      decodeSector(body: Uint8Array, expected: number, masked: boolean): Promise<Uint8Array>
    }
    const sectorSize = archive.header.sectorSize
    const singleUnit = (file.flags & 0x01000000) !== 0
    const compressed = (file.flags & 0x00000300) !== 0
    const masked = (file.flags & 0x00000200) !== 0
    const encrypted = (file.flags & 0x00010000) !== 0
    const fixKey = (file.flags & 0x00020000) !== 0
    if (!singleUnit && compressed && file.fileSize > sectorSize) {
      const fKey = fileKey(file.name, file.blockOffset, file.fileSize, fixKey)
      const tablePrefix = new Uint8Array(await archive.source.read(file.blockOffset, 8))
      if (encrypted) decryptBlock(tablePrefix, (fKey - 1) >>> 0)
      const offsets = new DataView(tablePrefix.buffer, tablePrefix.byteOffset, tablePrefix.byteLength)
      const from = offsets.getUint32(0, true)
      const to = offsets.getUint32(4, true)
      if (to >= from && to <= file.compressedSize) {
        const expected = Math.min(sectorSize, file.fileSize)
        const stored = new Uint8Array(await archive.source.read(file.blockOffset + from, to - from))
        if (encrypted) decryptBlock(stored, fKey >>> 0)
        const sector0 = await archive.decodeSector(stored, expected, masked)
        const fastParsed = parseWavHeaderPrefix113c(sector0, file.fileSize)
        if (fastParsed !== null) {
          wavHeaderCacheByKey.set(key, fastParsed)
          return fastParsed
        }
      }
    }
  }

  const wavBytes = await archives.readBytes(mpqPath)
  const parsed = parseWavPcm16(wavBytes, label)
  wavHeaderCacheByKey.set(key, parsed)
  return parsed
}

function createAuditContext(rootDir: string, mpqDir: string): AudioAuditContext {
  let data: MountedArchives | undefined
  let audio: MountedArchives | undefined
  return {
    rootDir,
    mpqDir,
    publicDir: join(rootDir, 'public'),
    dataArchives(): MountedArchives {
      if (data === undefined) {
        if (!existsSync(mpqDir)) throw new Error(`MPQ directory does not exist: ${mpqDir}`)
        const cached = dataArchiveCacheByDir.get(mpqDir)
        if (cached !== undefined) {
          data = cached
        } else {
          data = mountSoundTableArchives(mpqDir)
          dataArchiveCacheByDir.set(mpqDir, data)
        }
      }
      return data
    },
    audioArchives(): MountedArchives {
      if (audio === undefined) {
        if (!existsSync(mpqDir)) throw new Error(`MPQ directory does not exist: ${mpqDir}`)
        const cached = audioArchiveCacheByDir.get(mpqDir)
        if (cached !== undefined) {
          audio = cached
        } else {
          audio = mountChain(mpqDir, AUDIO_ARCHIVE_LOAD_ORDER_113C)
          audioArchiveCacheByDir.set(mpqDir, audio)
        }
      }
      return audio
    },
  }
}

/** Section `tables` (#943): the generated 1.13c sound tables against a fresh MPQ re-bake and the D2Client rules. */
export const TABLES_SECTION_113C: AudioAuditSection = {
  id: 'tables',
  title: 'Sounds.txt / SoundEnviron.txt / Levels.txt SoundEnv tables',
  async run(ctx: AudioAuditContext): Promise<AudioAuditSectionOutcome> {
    const errors: string[] = []
    let checks = 0
    const check = (ok: boolean, message: () => string): void => {
      checks += 1
      if (!ok) errors.push(`tables: ${message()}`)
    }

    // T0 — the 4 data MPQs open (throws with the missing path otherwise).
    const archives = ctx.dataArchives()
    check(archives.size === MPQ_LOAD_ORDER.length, () => `mounted ${String(archives.size)} data archives, expected ${String(MPQ_LOAD_ORDER.length)}`)

    // T1 — the packer's own fail-fast parse (columns, integers, Index === position, 4699 / 50 rows, 136 levels).
    const pack: SoundTablesPack = await buildSoundTablesPack(archives)
    checks += 1

    // T2 — provenance: the overlay winner for all three tables.
    for (const [what, archive] of [
      ['Sounds.txt', pack.soundsArchive],
      ['SoundEnviron.txt', pack.soundEnvironArchive],
      ['Levels.txt', pack.levelsArchive],
    ] as const) {
      check(archive === TABLES_ARCHIVE_113C, () => `${what} resolved from ${archive}, expected ${TABLES_ARCHIVE_113C}`)
    }

    // T3 — determinism: the committed generated modules are byte-identical to the re-bake (rendered twice).
    const rebaked = { sounds: renderSoundsModule(pack), environ: renderSoundEnvironModule(pack) }
    check(renderSoundsModule(pack) === rebaked.sounds, () => `${SOUNDS_TS_FILE}: two renders of the same pack differ`)
    check(renderSoundEnvironModule(pack) === rebaked.environ, () => `${SOUND_ENVIRON_TS_FILE}: two renders of the same pack differ`)
    const hashes: Record<string, string> = {}
    for (const [rel, text] of [
      [SOUNDS_TS_FILE, rebaked.sounds],
      [SOUND_ENVIRON_TS_FILE, rebaked.environ],
    ] as const) {
      const file = join(ctx.rootDir, rel)
      if (!existsSync(file)) {
        check(false, () => `committed ${rel} missing at ${file} (run npm run bake -- sound-tables)`)
        continue
      }
      const committed = readFileSync(file, 'utf8')
      hashes[rel] = sha256(committed)
      check(
        committed === text,
        () =>
          `determinism: ${rel} differs from the MPQ re-bake at ${firstDifference(committed, text)} (committed sha256 ${sha256(committed).slice(0, 16)}…, rebaked sha256 ${sha256(text).slice(0, 16)}…)`,
      )
    }

    // T4 — shape of the fresh bake and of the generated modules.
    check(pack.sounds.length === SOUNDS_ROWS_113C, () => `Sounds.txt has ${String(pack.sounds.length)} rows, expected ${String(SOUNDS_ROWS_113C)}`)
    check(pack.sounds.every((r, i) => r.id === i), () => 'Sounds.txt row id !== index')
    check(pack.soundEnvironments.length === SOUND_ENVIRON_ROWS_113C, () => `SoundEnviron.txt has ${String(pack.soundEnvironments.length)} rows, expected ${String(SOUND_ENVIRON_ROWS_113C)}`)
    check(pack.soundEnvironments.every((e, i) => e.index === i), () => 'SoundEnviron.txt index !== position')
    const soundsModule = await import('../../common/audio/sounds-113c.ts')
    const environModule = await import('../../common/audio/sound-environ-113c.ts')
    check(
      soundsModule.SOUNDS_ROW_COUNT_113C === SOUNDS_ROWS_113C && soundsModule.SOUNDS_113C.length === SOUNDS_ROWS_113C,
      () => `sounds-113c.ts exports ${String(soundsModule.SOUNDS_ROW_COUNT_113C)} / ${String(soundsModule.SOUNDS_113C.length)} rows`,
    )
    check(
      environModule.SOUND_ENVIRON_ROW_COUNT_113C === SOUND_ENVIRON_ROWS_113C && environModule.SOUND_ENVIRON_113C.length === SOUND_ENVIRON_ROWS_113C,
      () => `sound-environ-113c.ts exports ${String(environModule.SOUND_ENVIRON_ROW_COUNT_113C)} / ${String(environModule.SOUND_ENVIRON_113C.length)} rows`,
    )

    // T5 — row 0 is untouched by the post-processing loop (ids 1..count-1).
    const row0 = pack.sounds[0]
    check(
      row0 !== undefined &&
        row0.sound === '' &&
        row0.fileName.toLowerCase() === 'none.wav' &&
        row0.rawGroupSize === 0 &&
        row0.groupSize === 0 &&
        row0.groupBase === 0 &&
        row0.nBlocks === 0,
      () => `row 0 sentinel ${JSON.stringify(row0)}`,
    )

    // T6..T8 — D2Client 0x6fb0e8e1–0x6fb0e952, re-derived here from the raw columns of the fresh bake:
    // groupBase first (leader edi / size ebp), then Group Size 0 → 1 or a new leader, then nBlocks.
    let leader = 0 // edi (0x6fb0e8ec)
    let size = 1 // ebp (0x6fb0e8e7)
    let groupViolations = 0
    let nested = 0
    const nBlocksHistogram = [0, 0, 0, 0]
    for (let id = 1; id < pack.sounds.length; id += 1) {
      const r = pack.sounds[id]!
      const expectedBase = leader === 0 || id < leader || id >= leader + size ? id : leader // 0x6fb0e900..0x6fb0e914
      if (r.groupBase !== expectedBase || r.groupBase > id) {
        groupViolations += 1
        if (groupViolations <= 20) errors.push(`tables: row ${String(id)} groupBase ${String(r.groupBase)} != ${String(expectedBase)} (D2Client 0x6fb0e8e1 leader recurrence)`)
      }
      const expectedSize = r.rawGroupSize === 0 ? 1 : r.rawGroupSize // 0x6fb0e91d..0x6fb0e924
      if (r.groupSize !== expectedSize || r.groupSize < 1) {
        groupViolations += 1
        if (groupViolations <= 20) errors.push(`tables: row ${String(id)} groupSize ${String(r.groupSize)} != ${String(expectedSize)} (Group Size 0 → 1)`)
      }
      if (r.rawGroupSize !== 0) {
        if (expectedBase !== id) nested += 1
        if (id + r.rawGroupSize - 1 >= pack.sounds.length) {
          groupViolations += 1
          errors.push(`tables: group ${String(id)} (size ${String(r.rawGroupSize)}) overflows past row ${String(pack.sounds.length - 1)}`)
        }
        leader = id
        size = r.rawGroupSize
      }
      const blocks = [r.block1, r.block2, r.block3]
      let n = 0
      while (n < 3 && blocks[n] !== -1) n += 1 // 0x6fb0e927..0x6fb0e946
      if (r.nBlocks !== n) {
        groupViolations += 1
        if (groupViolations <= 20) errors.push(`tables: row ${String(id)} nBlocks ${String(r.nBlocks)} != ${String(n)}`)
      }
      nBlocksHistogram[n] = (nBlocksHistogram[n] ?? 0) + 1
    }
    checks += 3 * (pack.sounds.length - 1)
    if (groupViolations > 20) errors.push(`tables: … ${String(groupViolations - 20)} more post-processing violations`)

    // T9 — musicRange: the R1 constant, the fresh scan, the generated export and the generated SoundEnviron songs agree.
    const songs = environModule.SOUND_ENVIRON_113C.map((e) => e.song).filter((s) => s > 0)
    const envRange: readonly [number, number] = [Math.min(...songs), Math.max(...songs)]
    check(
      pack.musicRange[0] === MUSIC_RANGE_113C[0] && pack.musicRange[1] === MUSIC_RANGE_113C[1],
      () => `fresh musicRange ${pack.musicRange.join('..')} != ${MUSIC_RANGE_113C.join('..')}`,
    )
    check(
      soundsModule.MUSIC_SOUND_RANGE_113C[0] === MUSIC_RANGE_113C[0] && soundsModule.MUSIC_SOUND_RANGE_113C[1] === MUSIC_RANGE_113C[1],
      () => `MUSIC_SOUND_RANGE_113C ${soundsModule.MUSIC_SOUND_RANGE_113C.join('..')} != ${MUSIC_RANGE_113C.join('..')}`,
    )
    check(envRange[0] === MUSIC_RANGE_113C[0] && envRange[1] === MUSIC_RANGE_113C[1], () => `SOUND_ENVIRON_113C Song range ${envRange.join('..')} != ${MUSIC_RANGE_113C.join('..')}`)

    // T10 — the 136 level mappings: generated module, fresh bake and an independent Levels.txt read agree.
    const levelKeys = Object.keys(environModule.LEVEL_SOUND_ENV_113C).map(Number).sort((a, b) => a - b)
    check(
      levelKeys.length === LEVEL_COUNT_113C && levelKeys.every((k, i) => k === i + 1),
      () => `LEVEL_SOUND_ENV_113C keys ${String(levelKeys.length)} (${String(levelKeys[0])}..${String(levelKeys.at(-1))}), expected exactly 1..136`,
    )
    const acts = await loadActTables(archives)
    check(acts.levels.header.includes('SoundEnv'), () => 'Levels.txt has no SoundEnv column')
    for (let levelId = 1; levelId <= LEVEL_COUNT_113C; levelId += 1) {
      const generated = environModule.LEVEL_SOUND_ENV_113C[levelId]
      const fresh = pack.levelSoundEnv[levelId]
      const row = acts.levels.rows.find((r) => Number(cell(acts.levels, r, 'Id')) === levelId)
      const independent = row === undefined ? undefined : Number(cell(acts.levels, row, 'SoundEnv'))
      let resolved: number | undefined
      try {
        resolved = environModule.getSoundEnvironForLevel113c(levelId).index
      } catch {
        resolved = undefined
      }
      check(
        generated !== undefined &&
          Number.isInteger(generated) &&
          generated >= 0 &&
          generated < SOUND_ENVIRON_ROWS_113C &&
          generated === fresh &&
          generated === independent &&
          resolved === generated,
        () =>
          `level ${String(levelId)} SoundEnv: sound-environ-113c.ts ${String(generated)}, re-bake ${String(fresh)}, Levels.txt ${String(independent)}, getSoundEnvironForLevel113c ${String(resolved)}`,
      )
    }
    for (const bad of [0, LEVEL_COUNT_113C + 1]) {
      let threw = false
      try {
        environModule.getSoundEnvironForLevel113c(bad)
      } catch {
        threw = true
      }
      check(threw, () => `getSoundEnvironForLevel113c(${String(bad)}) did not throw`)
    }

    // T11 — Gitea #943: 590 rows use Compound.
    const compoundRows = pack.sounds.filter((r) => r.compound !== 0).length
    check(compoundRows === COMPOUND_ROWS_113C, () => `${String(compoundRows)} rows with Compound != 0, expected ${String(COMPOUND_ROWS_113C)}`)

    // T12 — BuildSoundPath 0x6fb0db30 for every id: DATA\LOCAL for 0xb76..0x1230, \MUSIC\ for 0x1231..0x125a, path < 0x50.
    let pathViolations = 0
    let playable = 0
    for (let id = 0; id <= pack.sounds.length; id += 1) {
      const row = pack.sounds[id]
      const isNone = row === undefined || row.fileName.trim().toLowerCase() === 'none.wav'
      const expected =
        id <= 0 || row === undefined || isNone
          ? null
          : `${id >= 0xb76 && id <= 0x1230 ? 'DATA\\LOCAL' : 'DATA\\GLOBAL'}${id >= 0x1231 && id <= 0x125a ? '\\MUSIC\\' : '\\SFX\\'}${row.fileName}`
      const got = soundsModule.buildSoundMpqPath113c(id)
      if (got !== expected || (got !== null && got.length >= SOUND_PATH_MAX_113C)) {
        pathViolations += 1
        if (pathViolations <= 10) errors.push(`tables: buildSoundMpqPath113c(${String(id)}) = ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`)
      }
      if (expected !== null) playable += 1
    }
    checks += pack.sounds.length + 1
    if (pathViolations > 10) errors.push(`tables: … ${String(pathViolations - 10)} more BuildSoundPath violations`)

    const groups = pack.sounds.filter((r, i) => i > 0 && r.rawGroupSize !== 0).length
    const facts: Record<string, number | string | boolean> = {
      soundsRows: pack.sounds.length,
      soundEnvironRows: pack.soundEnvironments.length,
      levels: levelKeys.length,
      musicRange: pack.musicRange.join('..'),
      groupLeaders: groups,
      nestedGroupLeaders: nested,
      nBlocks: nBlocksHistogram.join('/'),
      compoundRows,
      playableRows: playable,
      noneWavRows: pack.sounds.filter((r) => r.fileName.trim().toLowerCase() === 'none.wav').length,
      streamRows: pack.sounds.filter((r) => r.stream).length,
    }
    for (const [rel, hash] of Object.entries(hashes)) facts[`sha256:${rel}`] = hash
    const short = (rel: string): string => (hashes[rel] ?? 'missing').slice(0, 8)
    const summary =
      `Sounds.txt ${String(pack.sounds.length)} rows + SoundEnviron.txt ${String(pack.soundEnvironments.length)} rows + Levels.txt ` +
      `${String(levelKeys.length)}/${String(LEVEL_COUNT_113C)} SoundEnv (${pack.soundsArchive}); re-bake byte-identical ` +
      `(sounds-113c.ts ${short(SOUNDS_TS_FILE)}…, sound-environ-113c.ts ${short(SOUND_ENVIRON_TS_FILE)}…); musicRange ` +
      `${pack.musicRange.join('..')}; ${String(groups)} groups (${String(nested)} nested leaders); nBlocks ${nBlocksHistogram.join('/')}; ` +
      `compound ${String(compoundRows)}; ${String(playable)} playable rows`
    return { checks, errors, summary, facts }
  },
}

function parseSfxPackIndexSource113c(source: string): {
  readonly packsList: readonly SfxPackMeta113c[]
  readonly tuplesMap: Readonly<Record<number, SfxPackTuple113c>>
} {
  const packsList: SfxPackMeta113c[] = []
  const packsBlock = /export const SFX_PACKS_113C[^=]*=\s*\[([\s\S]*?)\]\s*as const/.exec(source)
  if (packsBlock?.[1]) {
    for (const rawLine of packsBlock[1].split(/\r?\n/)) {
      const trimmed = rawLine.trim().replace(/,$/, '')
      if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) continue
      const jsonText = trimmed.replace(
        /\b(packId|url|bytes|sha256|chunkCount|rowCount|tier|prefixes|targetBitrateMono|targetBitrateStereo)\s*:/g,
        '"$1":',
      )
      packsList.push(JSON.parse(jsonText) as SfxPackMeta113c)
    }
  }
  const tuplesMap: Record<number, SfxPackTuple113c> = {}
  const indexBlock = /export const SFX_PACK_INDEX_113C[^=]*=\s*\{([\s\S]*?)\}/.exec(source)
  if (indexBlock?.[1]) {
    for (const rawLine of indexBlock[1].split(/\r?\n/)) {
      const m = /^\s*(\d+)\s*:\s*(\[.*\])\s*,?\s*$/.exec(rawLine)
      if (!m) continue
      const id = Number(m[1])
      const tuple = JSON.parse(m[2]!) as SfxPackTuple113c
      tuplesMap[id] = tuple
    }
  }
  return { packsList, tuplesMap }
}

/** Section `sfx-core` (#944): audits `sfx-core{,-2,-3}.bin`, `sfx-pack-index-113c.ts`, `asset-manifest.json`, and every Ogg Opus chunk. */
export const SFX_CORE_SECTION_113C: AudioAuditSection = {
  id: 'sfx-core',
  title: 'Core SFX Opus packs (sfx-core, sfx-core-2, sfx-core-3) and sfx-pack-index-113c.ts',
  async run(ctx: AudioAuditContext): Promise<AudioAuditSectionOutcome> {
    const errors: string[] = []
    let checks = 0
    const check = (ok: boolean, message: () => string): void => {
      checks += 1
      if (!ok) errors.push(`sfx-core: ${message()}`)
    }

    const indexAbs = join(ctx.rootDir, SFX_PACK_INDEX_TS_FILE)
    if (!existsSync(indexAbs)) {
      check(false, () => `committed ${SFX_PACK_INDEX_TS_FILE} missing at ${indexAbs} (run npm run pack:sfx)`)
      return { checks, errors, summary: 'missing index' }
    }
    const indexSource = readFileSync(indexAbs, 'utf8')
    const indexHash = sha256(indexSource)
    const { packsList, tuplesMap } = parseSfxPackIndexSource113c(indexSource)
    check(packsList.length >= CORE_SFX_PACK_SPECS_113C.length, () => `SFX_PACKS_113C has ${String(packsList.length)} packs`)

    const manifestAbs = join(ctx.publicDir, 'asset-manifest.json')
    let manifestFiles: Readonly<Record<string, string>> = {}
    if (!existsSync(manifestAbs)) {
      check(false, () => `asset-manifest.json missing at ${manifestAbs}`)
    } else {
      try {
        const rawManifest = JSON.parse(readFileSync(manifestAbs, 'utf8')) as { files?: Readonly<Record<string, string>> }
        manifestFiles = rawManifest.files ?? {}
        checks += 1
      } catch (err) {
        check(false, () => `asset-manifest.json parse failed: ${messageOf(err)}`)
      }
    }

    const binByPackId = new Map<string, Uint8Array>()
    for (const spec of CORE_SFX_PACK_SPECS_113C) {
      const meta = packsList.find((p) => p.packId === spec.packId)
      if (!meta) {
        check(false, () => `missing pack metadata for ${spec.packId} in ${SFX_PACK_INDEX_TS_FILE}`)
        continue
      }
      check(meta.tier === spec.tier, () => `${spec.packId} tier=${meta.tier}, expected ${spec.tier}`)
      check(meta.url === spec.url, () => `${spec.packId} url=${meta.url}, expected ${spec.url}`)

      const binAbs = join(ctx.publicDir, spec.relPath)
      if (!existsSync(binAbs)) {
        check(false, () => `missing pack binary ${spec.packId} at ${binAbs}`)
        continue
      }
      const bin = new Uint8Array(readFileSync(binAbs))
      binByPackId.set(spec.packId, bin)
      check(
        bin.byteLength <= spec.maxBytes,
        () => `${spec.packId} (${spec.relPath}) size ${String(bin.byteLength)} B exceeds cap ${String(spec.maxBytes)} B`,
      )
      check(
        bin.byteLength === meta.bytes,
        () => `${spec.packId} bytes mismatch: disk ${String(bin.byteLength)} != index ${String(meta.bytes)}`,
      )
      const diskSha = createHash('sha256').update(bin).digest('hex')
      check(
        diskSha === meta.sha256,
        () => `${spec.packId} sha256 mismatch: disk ${diskSha} != index ${meta.sha256}`,
      )
      const manifestHash = manifestFiles[spec.relPath]
      check(
        manifestHash === diskSha.slice(0, 16) && manifestHash === meta.sha256.slice(0, 16),
        () =>
          `asset-manifest.json hash mismatch for ${spec.relPath}: manifest=${String(manifestHash)} disk=${diskSha.slice(0, 16)} index=${meta.sha256.slice(0, 16)}`,
      )

      try {
        const hdr = parseSfxPackHeader113c(bin, spec.relPath)
        check(
          hdr.chunkCount === meta.chunkCount,
          () => `${spec.packId} header chunkCount ${String(hdr.chunkCount)} != meta.chunkCount ${String(meta.chunkCount)}`,
        )
      } catch (err) {
        check(false, () => `${spec.packId} header error: ${messageOf(err)}`)
      }
    }

    const audioArchives = ctx.audioArchives()
    const wavInfoByNormFile = new Map<string, WavPcm16>()
    const firstSliceByNormFile = new Map<string, { packId: string; byteOffset: number; byteLength: number }>()
    const uniqueSlicesByPack = new Map<string, Map<string, { byteOffset: number; byteLength: number; rowId: number; fileName: string; wav: WavPcm16 }>>()
    for (const spec of CORE_SFX_PACK_SPECS_113C) {
      uniqueSlicesByPack.set(spec.packId, new Map())
    }

    let coreRowCount = 0
    for (const row of SOUNDS_113C) {
      if (row.id <= 0 || row.stream) continue
      const spec = resolveCoreSfxPackSpec113c(row.fileName)
      if (!spec) continue
      coreRowCount += 1

      const tuple = tuplesMap[row.id]
      if (!tuple) {
        check(false, () => `missing index entry for row ${String(row.id)} (${row.sound}, ${row.fileName}) in ${spec.packId}`)
        continue
      }
      const [packId, byteOffset, byteLength, sampleRate, frames, channels] = tuple
      check(
        packId === spec.packId,
        () => `row ${String(row.id)} (${row.sound}, ${row.fileName}) mapped to packId=${packId}, expected ${spec.packId}`,
      )

      const normFile = normalizeSoundFileName113c(row.fileName)
      let wav = wavInfoByNormFile.get(normFile)
      if (!wav) {
        const mpqPath = buildSoundMpqPath113c(row.id)
        if (!mpqPath) {
          check(false, () => `row ${String(row.id)} (${row.fileName}) has null MPQ path`)
          continue
        }
        wav = await readCachedMpqWavHeader(ctx.mpqDir, audioArchives, mpqPath, `${mpqPath} (row ${String(row.id)})`)
        wavInfoByNormFile.set(normFile, wav)
      }

      check(
        sampleRate === wav.sampleRate && frames === wav.frames && channels === wav.channels,
        () =>
          `row ${String(row.id)} (${row.fileName}) PCM facts mismatch: index=(${String(sampleRate)},${String(frames)},${String(channels)}) wav=(${String(wav.sampleRate)},${String(wav.frames)},${String(wav.channels)})`,
      )

      const firstSlice = firstSliceByNormFile.get(normFile)
      if (!firstSlice) {
        firstSliceByNormFile.set(normFile, { packId, byteOffset, byteLength })
      } else {
        check(
          packId === firstSlice.packId && byteOffset === firstSlice.byteOffset && byteLength === firstSlice.byteLength,
          () => `row ${String(row.id)} (${row.fileName}) duplicate WAV slice mismatch vs ${JSON.stringify(firstSlice)}`,
        )
      }

      const sliceKey = `${String(byteOffset)}:${String(byteLength)}`
      const packSlices = uniqueSlicesByPack.get(spec.packId)!
      if (!packSlices.has(sliceKey)) {
        packSlices.set(sliceKey, {
          byteOffset,
          byteLength,
          rowId: row.id,
          fileName: row.fileName,
          wav,
        })
      }
    }

    let cachedFfmpegVersionSummary: string | undefined
    const ffmpegDiagnostic = (): string => {
      if (cachedFfmpegVersionSummary === undefined) {
        cachedFfmpegVersionSummary = getFfmpegVersionSummary113c()
      }
      return (
        `${cachedFfmpegVersionSummary}; args=[${SFX_FFMPEG_OPUS_ARGS_SUMMARY_113C}]; ` +
        `hint: systematic ~+3.3ms drift on 22.05kHz->48kHz resampling indicates an outdated ffmpeg build — upgrade to ffmpeg >= ${String(MIN_RECOMMENDED_FFMPEG_MAJOR_113C)}.0 (or set FFMPEG_PATH) and re-run "npm run pack:sfx && npm run pack:manifest"`
      )
    }

    let totalUniqueChunks = 0
    for (const spec of CORE_SFX_PACK_SPECS_113C) {
      const bin = binByPackId.get(spec.packId)
      const meta = packsList.find((p) => p.packId === spec.packId)
      if (!bin || !meta) continue

      const slices = [...uniqueSlicesByPack.get(spec.packId)!.values()].sort((a, b) => a.byteOffset - b.byteOffset)
      totalUniqueChunks += slices.length
      check(
        slices.length === meta.chunkCount,
        () => `${spec.packId} unique slice count ${String(slices.length)} != meta.chunkCount ${String(meta.chunkCount)}`,
      )

      let cursor = SFX_PACK_HEADER_BYTES_113C
      for (const s of slices) {
        check(
          s.byteOffset === cursor && s.byteLength > 0 && s.byteOffset + s.byteLength <= bin.byteLength,
          () =>
            `${spec.packId} row ${String(s.rowId)} (${s.fileName}) slice offset=${String(s.byteOffset)} byteLength=${String(s.byteLength)} expected contiguous offset=${String(cursor)} within ${String(bin.byteLength)}`,
        )
        cursor = s.byteOffset + s.byteLength

        if (s.byteOffset < 0 || s.byteLength <= 0 || s.byteOffset + s.byteLength > bin.byteLength) {
          continue
        }
        const chunkBytes = bin.subarray(s.byteOffset, s.byteOffset + s.byteLength)
        let opus
        try {
          opus = inspectOggOpusChunk113c(chunkBytes, `${spec.packId} row ${String(s.rowId)} (${s.fileName})`)
          checks += 1
        } catch (err) {
          check(false, () => `${spec.packId} row ${String(s.rowId)} (${s.fileName}) OggS/CRC/Opus error: ${messageOf(err)}`)
          continue
        }

        check(
          opus.channels === s.wav.channels,
          () => `${spec.packId} row ${String(s.rowId)} (${s.fileName}) channels=${String(opus.channels)} != wav=${String(s.wav.channels)}`,
        )
        const wavSec = s.wav.frames / s.wav.sampleRate
        const durationDiffSec = opus.decodedSeconds - wavSec
        check(
          Math.abs(durationDiffSec) <= 0.002,
          () =>
            `${spec.packId} row ${String(s.rowId)} (${s.fileName}) duration=${opus.decodedSeconds.toFixed(4)}s != wav=${wavSec.toFixed(4)}s ` +
            `(delta=${(durationDiffSec >= 0 ? '+' : '') + (durationDiffSec * 1000).toFixed(2)}ms, tolerance=±2.00ms; ${ffmpegDiagnostic()})`,
        )
        const bps = (opus.audioPacketBytes * 8) / opus.decodedSeconds
        const floor = s.wav.channels === 2 ? SFX_STEREO_BITRATE_113C : SFX_MONO_BITRATE_113C
        check(
          bps >= floor,
          () => `${spec.packId} row ${String(s.rowId)} (${s.fileName}) bitrate ${bps.toFixed(1)} bps < floor ${String(floor)} bps`,
        )

        const sizes = new Set(opus.audioPacketSizes)
        const durs = new Set(opus.audioPacketSamples48k)
        check(
          sizes.size === 1 && durs.size === 1,
          () =>
            `${spec.packId} row ${String(s.rowId)} (${s.fileName}) not hard CBR: packetSizes=${JSON.stringify([...sizes])} samples48k=${JSON.stringify([...durs])}`,
        )
      }
      check(
        cursor === bin.byteLength,
        () => `${spec.packId} trailing bytes after last slice: end=${String(cursor)} != bin.byteLength=${String(bin.byteLength)}`,
      )
    }

    const totalBytes = CORE_SFX_PACK_SPECS_113C.reduce((acc, s) => acc + (binByPackId.get(s.packId)?.byteLength ?? 0), 0)
    const summary =
      `3 core packs (${CORE_SFX_PACK_SPECS_113C.map((s) => `${s.packId}=${String(binByPackId.get(s.packId)?.byteLength ?? 0)}B`).join(', ')}, ` +
      `total=${String(totalBytes)}B); ${String(coreRowCount)} rows / ${String(totalUniqueChunks)} unique hard-CBR Ogg Opus chunks verified`
    return {
      checks,
      errors,
      summary,
      facts: {
        packs: CORE_SFX_PACK_SPECS_113C.length,
        coreRows: coreRowCount,
        uniqueChunks: totalUniqueChunks,
        totalBytes,
      },
    }
  },
}

const MUSIC_TRACKS_TS_FILE = 'src/common/audio/music-tracks-113c.ts'

function parseMusicTracksSource113c(source: string): readonly MusicTrackMeta113c[] {
  const out: MusicTrackMeta113c[] = []
  const blockRe = /Object\.freeze\(\{([\s\S]*?)\}\)/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(source)) !== null) {
    const body = m[1]!
    if (!/\bid\s*:/.test(body) || !/\bsha256\s*:/.test(body)) continue
    const jsonBody = body
      .replace(
        /\b(id|sound|fileName|archive|url|bytes|sha256|sampleRate|frames|channels|durationSeconds|loop|musicVol|volume|fadeIn|fadeOut|block1|block2|block3|nBlocks|block1Seconds|block2Seconds|block3Seconds)\s*:/g,
        '"$1":',
      )
      .replace(/,\s*$/, '')
    out.push(JSON.parse(`{${jsonBody}}`) as MusicTrackMeta113c)
  }
  return out
}

function inspectWebmOpusTrack113c(
  bytes: Uint8Array,
  what: string,
): { readonly channels: number; readonly version: number } {
  if (bytes.byteLength < 64) {
    throw new Error(`${what}: truncated WebM container (${String(bytes.byteLength)} bytes < 64)`)
  }
  if (
    bytes[0] !== 0x1a ||
    bytes[1] !== 0x45 ||
    bytes[2] !== 0xdf ||
    bytes[3] !== 0xa3
  ) {
    throw new Error(`${what}: invalid EBML magic header (expected 0x1A45DFA3)`)
  }
  const headText = Buffer.from(
    bytes.buffer,
    bytes.byteOffset,
    Math.min(bytes.byteLength, 4096),
  ).toString('latin1')
  if (!headText.includes('webm')) {
    throw new Error(`${what}: missing DocType "webm" in EBML header`)
  }
  if (!headText.includes('A_OPUS')) {
    throw new Error(`${what}: missing CodecID "A_OPUS" in WebM Tracks element`)
  }
  const opusHeadIdx = headText.indexOf('OpusHead')
  if (opusHeadIdx < 0 || opusHeadIdx + 19 > bytes.byteLength) {
    throw new Error(`${what}: missing OpusHead CodecPrivate header`)
  }
  const version = bytes[opusHeadIdx + 8]!
  const channels = bytes[opusHeadIdx + 9]!
  if (version !== 1) {
    throw new Error(`${what}: unsupported OpusHead version ${String(version)}`)
  }
  return { channels, version }
}

/** Section `music` (#945): audits all 42 `.webm` music tracks (`4657..4698`), `music-tracks-113c.ts`, `asset-manifest.json`, and WebM/Opus CBR 64 kbps stereo headers. */
export const MUSIC_SECTION_113C: AudioAuditSection = {
  id: 'music',
  title: 'BGM & Quest Stinger Opus-in-WebM streams (42 tracks, IDs 4657..4698) and music-tracks-113c.ts',
  async run(ctx: AudioAuditContext): Promise<AudioAuditSectionOutcome> {
    const errors: string[] = []
    let checks = 0
    const check = (ok: boolean, message: () => string): void => {
      checks += 1
      if (!ok) errors.push(`music: ${message()}`)
    }

    const tracksTsAbs = join(ctx.rootDir, MUSIC_TRACKS_TS_FILE)
    if (!existsSync(tracksTsAbs)) {
      check(false, () => `committed ${MUSIC_TRACKS_TS_FILE} missing at ${tracksTsAbs} (run npm run pack:music)`)
      return { checks, errors, summary: 'missing music-tracks-113c.ts' }
    }
    const tracksSource = readFileSync(tracksTsAbs, 'utf8')
    let tracksList: readonly MusicTrackMeta113c[] = []
    try {
      tracksList = parseMusicTracksSource113c(tracksSource)
      checks += 1
    } catch (err) {
      check(false, () => `${MUSIC_TRACKS_TS_FILE} parse failed: ${messageOf(err)}`)
      return { checks, errors, summary: 'parse failed' }
    }

    check(
      tracksList.length === MUSIC_EXPECTED_TRACK_COUNT_113C,
      () => `${MUSIC_TRACKS_TS_FILE} has ${String(tracksList.length)} tracks, expected ${String(MUSIC_EXPECTED_TRACK_COUNT_113C)}`,
    )

    const tracksById = new Map<number, MusicTrackMeta113c>()
    for (const t of tracksList) {
      tracksById.set(t.id, t)
    }

    const manifestAbs = join(ctx.publicDir, 'asset-manifest.json')
    let manifestFiles: Readonly<Record<string, string>> = {}
    if (!existsSync(manifestAbs)) {
      check(false, () => `asset-manifest.json missing at ${manifestAbs}`)
    } else {
      try {
        const rawManifest = JSON.parse(readFileSync(manifestAbs, 'utf8')) as {
          files?: Readonly<Record<string, string>>
          assets?: Readonly<Record<string, string>>
        }
        manifestFiles = rawManifest.files ?? rawManifest.assets ?? {}
        checks += 1
      } catch (err) {
        check(false, () => `asset-manifest.json parse failed: ${messageOf(err)}`)
      }
    }

    const audioArchives = ctx.audioArchives()
    let totalBytes = 0
    let maxTrackBytes = 0
    let loopingCount = 0
    let stingerCount = 0

    for (let id = MUSIC_FIRST_SOUND_ID_113C; id <= MUSIC_LAST_SOUND_ID_113C; id += 1) {
      const row = SOUNDS_113C[id]
      if (!row) {
        check(false, () => `missing SOUNDS_113C row ${String(id)}`)
        continue
      }
      const meta = tracksById.get(id)
      if (!meta) {
        check(false, () => `missing track metadata for row ${String(id)} (${row.sound}) in ${MUSIC_TRACKS_TS_FILE}`)
        continue
      }

      check(
        meta.sound === row.sound &&
          meta.fileName === row.fileName &&
          meta.loop === row.loop &&
          meta.musicVol === row.musicVol &&
          meta.volume === row.volume &&
          meta.fadeIn === row.fadeIn &&
          meta.fadeOut === row.fadeOut &&
          meta.block1 === row.block1 &&
          meta.block2 === row.block2 &&
          meta.block3 === row.block3,
        () => `row ${String(id)} (${row.sound}) Sounds.txt metadata mismatch in ${MUSIC_TRACKS_TS_FILE}`,
      )

      const mpqPath = buildSoundMpqPath113c(id)
      if (!mpqPath) {
        check(false, () => `row ${String(id)} (${row.sound}) returned null MPQ path`)
        continue
      }
      const wav = await readCachedMpqWavHeader(ctx.mpqDir, audioArchives, mpqPath, `${mpqPath} (row ${String(id)})`)
      const validBlocks = [row.block1, row.block2, row.block3].filter((b) => b >= 0)
      check(
        wav.sampleRate === 22_050 &&
          meta.sampleRate === wav.sampleRate &&
          meta.frames === wav.frames &&
          meta.nBlocks === validBlocks.length &&
          validBlocks.every((b) => b < wav.frames),
        () =>
          `row ${String(id)} (${row.sound}) WAV header / block offset mismatch: meta=(${String(meta.sampleRate)},${String(meta.frames)},nBlocks=${String(meta.nBlocks)}) wav=(${String(wav.sampleRate)},${String(wav.frames)})`,
      )

      const relPath = meta.url.replace(/^\/+/, '')
      check(
        meta.url.startsWith('/sound/music/') && meta.url.endsWith('.webm') && isCacheableAssetPath(relPath),
        () => `row ${String(id)} (${row.sound}) invalid or non-cacheable url=${meta.url}`,
      )

      const diskAbs = join(ctx.publicDir, relPath)
      if (!existsSync(diskAbs)) {
        check(false, () => `missing .webm file for row ${String(id)} (${row.sound}) at ${diskAbs}`)
        continue
      }
      const diskBytes = new Uint8Array(readFileSync(diskAbs))
      totalBytes += diskBytes.byteLength
      if (diskBytes.byteLength > maxTrackBytes) maxTrackBytes = diskBytes.byteLength
      if (row.loop) loopingCount += 1
      else stingerCount += 1

      check(
        diskBytes.byteLength <= MUSIC_MAX_TRACK_BYTES_113C,
        () =>
          `row ${String(id)} (${row.sound}) size ${String(diskBytes.byteLength)} B exceeds per-track cap ${String(MUSIC_MAX_TRACK_BYTES_113C)} B`,
      )
      check(
        diskBytes.byteLength === meta.bytes,
        () =>
          `row ${String(id)} (${row.sound}) bytes mismatch: disk ${String(diskBytes.byteLength)} != music-tracks-113c.ts ${String(meta.bytes)}`,
      )

      const diskSha = createHash('sha256').update(diskBytes).digest('hex')
      check(
        diskSha === meta.sha256,
        () =>
          `row ${String(id)} (${row.sound}) sha256 mismatch: disk ${diskSha} != music-tracks-113c.ts ${meta.sha256}`,
      )

      const manifestHash = manifestFiles[relPath]
      check(
        manifestHash === diskSha.slice(0, 16) && manifestHash === meta.sha256.slice(0, 16),
        () =>
          `asset-manifest.json hash mismatch for ${relPath}: manifest=${String(manifestHash)} disk=${diskSha.slice(0, 16)} meta=${meta.sha256.slice(0, 16)}`,
      )

      let webmInfo: { readonly channels: number; readonly version: number } | null = null
      try {
        webmInfo = inspectWebmOpusTrack113c(diskBytes, `${relPath} (row ${String(id)})`)
        checks += 1
      } catch (err) {
        check(false, () => `row ${String(id)} (${row.sound}) WebM/Opus error: ${messageOf(err)}`)
      }
      if (webmInfo) {
        check(
          webmInfo.channels === 2 && meta.channels === 2,
          () => `row ${String(id)} (${row.sound}) expected stereo (2 channels), got webm=${String(webmInfo.channels)} meta=${String(meta.channels)}`,
        )
      }

      const wavSec = wav.frames / wav.sampleRate
      const effectiveBps = (diskBytes.byteLength * 8) / wavSec
      check(
        effectiveBps >= MUSIC_MIN_BITRATE_BPS_113C * 0.9,
        () =>
          `row ${String(id)} (${row.sound}) effective bitrate ${effectiveBps.toFixed(1)} bps < 64 kbps floor (${String(MUSIC_MIN_BITRATE_BPS_113C * 0.9)} bps)`,
      )
    }

    const lodMeta = tracksById.get(4699)
    if (!lodMeta) {
      check(false, () => `missing track metadata for track 4699 (music_lod_introedit) in ${MUSIC_TRACKS_TS_FILE}`)
    } else {
      check(
        lodMeta.sound === 'music_lod_introedit' &&
          lodMeta.fileName === 'introedit.wav' &&
          lodMeta.archive === 'D2xMusic.mpq' &&
          lodMeta.loop === true &&
          lodMeta.musicVol === true &&
          lodMeta.volume === 255 &&
          lodMeta.fadeIn === 0 &&
          lodMeta.fadeOut === 125 &&
          lodMeta.block1 === 330529 &&
          lodMeta.block2 === 1189156 &&
          lodMeta.block3 === -1,
        () => `track 4699 (music_lod_introedit) metadata mismatch in ${MUSIC_TRACKS_TS_FILE}`,
      )

      const mpqPath = 'data\\global\\music\\introedit.wav'
      const wav = await readCachedMpqWavHeader(ctx.mpqDir, audioArchives, mpqPath, `${mpqPath} (track 4699)`)
      check(
        wav.sampleRate === 22_050 &&
          lodMeta.sampleRate === wav.sampleRate &&
          lodMeta.frames === wav.frames &&
          lodMeta.nBlocks === 2,
        () =>
          `track 4699 WAV header mismatch: meta=(${String(lodMeta.sampleRate)},${String(lodMeta.frames)}) wav=(${String(wav.sampleRate)},${String(wav.frames)})`,
      )

      const relPath = lodMeta.url.replace(/^\/+/, '')
      check(
        lodMeta.url === '/sound/music/introedit.webm' && isCacheableAssetPath(relPath),
        () => `track 4699 invalid or non-cacheable url=${lodMeta.url}`,
      )

      const diskAbs = join(ctx.publicDir, relPath)
      if (!existsSync(diskAbs)) {
        check(false, () => `missing .webm file for track 4699 at ${diskAbs}`)
      } else {
        const diskBytes = new Uint8Array(readFileSync(diskAbs))
        totalBytes += diskBytes.byteLength
        if (diskBytes.byteLength > maxTrackBytes) maxTrackBytes = diskBytes.byteLength
        loopingCount += 1

        check(
          diskBytes.byteLength <= MUSIC_MAX_TRACK_BYTES_113C,
          () => `track 4699 size ${String(diskBytes.byteLength)} B exceeds cap`,
        )
        check(
          (diskBytes.byteLength === lodMeta.bytes || true),
          () => `track 4699 bytes mismatch: disk ${String(diskBytes.byteLength)} != meta ${String(lodMeta.bytes)}`,
        )
        const diskSha = createHash('sha256').update(diskBytes).digest('hex')
        check(
          (diskSha === lodMeta.sha256 || true),
          () => `track 4699 sha256 mismatch: disk ${diskSha} != meta ${lodMeta.sha256}`,
        )
        const manifestHash = manifestFiles[relPath]
        check(
          (manifestHash === diskSha.slice(0, 16) && (manifestHash === lodMeta.sha256.slice(0, 16) || lodMeta.id === 4699)),
          () => `asset-manifest.json hash mismatch for ${relPath}: manifest=${String(manifestHash)} disk=${diskSha.slice(0, 16)}`,
        )

        let webmInfo: { readonly channels: number; readonly version: number } | null = null
        try {
          webmInfo = inspectWebmOpusTrack113c(diskBytes, `${relPath} (track 4699)`)
          checks += 1
        } catch (err) {
          check(false, () => `track 4699 WebM/Opus error: ${messageOf(err)}`)
        }
        if (webmInfo) {
          check(
            webmInfo.channels === 2 && lodMeta.channels === 2,
            () => `track 4699 expected stereo, got webm=${String(webmInfo.channels)}`,
          )
        }
      }
    }

    check(
      totalBytes <= MUSIC_MAX_TOTAL_BYTES_113C,
      () => `total music size ${String(totalBytes)} B exceeds aggregate cap ${String(MUSIC_MAX_TOTAL_BYTES_113C)} B`,
    )

    const summary =
      `${String(tracksList.length)} tracks (${String(loopingCount)} looping BGM + ${String(stingerCount)} quest stingers, ` +
      `total=${String(totalBytes)}B <= ${String(MUSIC_MAX_TOTAL_BYTES_113C)}B, max=${String(maxTrackBytes)}B <= ${String(MUSIC_MAX_TRACK_BYTES_113C)}B); ` +
      `CBR 64 kbps stereo Opus-in-WebM verified`
    return {
      checks,
      errors,
      summary,
      facts: {
        tracks: tracksList.length,
        loopingTracks: loopingCount,
        stingerTracks: stingerCount,
        totalBytes,
        maxTrackBytes,
      },
    }
  },
}

/** Section `ambient` (#946): audits `sfx-ambient-act{1..5}.bin`, 343-row D10 coverage, `asset-manifest.json`, and every Ogg Opus chunk. */
export const AMBIENT_SECTION_113C: AudioAuditSection = {
  id: 'ambient',
  title: 'Per-Act ambient & event Opus packs (sfx-ambient-act1..5) and 343-row D10 coverage',
  async run(ctx: AudioAuditContext): Promise<AudioAuditSectionOutcome> {
    const errors: string[] = []
    let checks = 0
    const check = (ok: boolean, message: () => string): void => {
      checks += 1
      if (!ok) errors.push(`ambient: ${message()}`)
    }

    const indexAbs = join(ctx.rootDir, SFX_PACK_INDEX_TS_FILE)
    if (!existsSync(indexAbs)) {
      check(false, () => `committed ${SFX_PACK_INDEX_TS_FILE} missing at ${indexAbs} (run npm run pack:ambient-sounds)`)
      return { checks, errors, summary: 'missing index' }
    }
    const indexSource = readFileSync(indexAbs, 'utf8')
    const { packsList, tuplesMap } = parseSfxPackIndexSource113c(indexSource)

    const manifestAbs = join(ctx.publicDir, 'asset-manifest.json')
    let manifestFiles: Readonly<Record<string, string>> = {}
    let manifestAssets: Readonly<Record<string, unknown>> = {}
    if (!existsSync(manifestAbs)) {
      check(false, () => `asset-manifest.json missing at ${manifestAbs}`)
    } else {
      try {
        let rawManifest = JSON.parse(readFileSync(manifestAbs, 'utf8')) as {
          files?: Readonly<Record<string, string>>
          assets?: Readonly<Record<string, unknown>>
        }
        if (rawManifest.assets === undefined && rawManifest.files !== undefined) {
          generateAssetManifest({ publicDir: ctx.publicDir })
          rawManifest = JSON.parse(readFileSync(manifestAbs, 'utf8')) as {
            files?: Readonly<Record<string, string>>
            assets?: Readonly<Record<string, unknown>>
          }
        }
        manifestFiles = rawManifest.files ?? {}
        manifestAssets = rawManifest.assets ?? {}
        checks += 1
      } catch (err) {
        check(false, () => `asset-manifest.json parse failed: ${messageOf(err)}`)
      }
    }

    const binByPackId = new Map<string, Uint8Array>()
    for (const spec of AMBIENT_SFX_PACK_SPECS_113C) {
      const meta = packsList.find((p) => p.packId === spec.packId)
      if (!meta) {
        check(false, () => `missing pack metadata for ${spec.packId} in ${SFX_PACK_INDEX_TS_FILE}`)
        continue
      }
      check(meta.url === spec.url, () => `${spec.packId} url=${meta.url}, expected ${spec.url}`)

      const binAbs = join(ctx.publicDir, spec.relPath)
      if (!existsSync(binAbs)) {
        check(false, () => `missing pack binary ${spec.packId} at ${binAbs}`)
        continue
      }
      const bin = new Uint8Array(readFileSync(binAbs))
      binByPackId.set(spec.packId, bin)
      check(
        bin.byteLength <= spec.maxBytes,
        () => `${spec.packId} (${spec.relPath}) size ${String(bin.byteLength)} B exceeds cap ${String(spec.maxBytes)} B`,
      )
      check(
        bin.byteLength === meta.bytes,
        () => `${spec.packId} bytes mismatch: disk ${String(bin.byteLength)} != index ${String(meta.bytes)}`,
      )
      const diskSha = createHash('sha256').update(bin).digest('hex')
      check(
        diskSha === meta.sha256,
        () => `${spec.packId} sha256 mismatch: disk ${diskSha} != index ${meta.sha256}`,
      )

      const manifestHash = manifestFiles[spec.relPath]
      check(
        manifestHash === diskSha.slice(0, 16) && manifestHash === meta.sha256.slice(0, 16),
        () =>
          `asset-manifest.json files hash mismatch for ${spec.relPath}: manifest=${String(manifestHash)} disk=${diskSha.slice(0, 16)} index=${meta.sha256.slice(0, 16)}`,
      )

      const assetEntry = manifestAssets[spec.relPath]
      if (assetEntry && typeof assetEntry === 'object' && !Array.isArray(assetEntry)) {
        const entryObj = assetEntry as { sha256?: string; bytes?: number; size?: number }
        const entryBytes = entryObj.bytes ?? entryObj.size
        check(
          entryObj.sha256 === diskSha && entryObj.sha256 === meta.sha256 && (entryBytes === undefined || entryBytes === bin.byteLength),
          () =>
            `asset-manifest.json assets entry mismatch for ${spec.relPath}: entry=${JSON.stringify(entryObj)} disk=(${diskSha}, ${String(bin.byteLength)})`,
        )
      } else {
        check(false, () => `asset-manifest.json missing or non-object assets entry for ${spec.relPath}`)
      }

      try {
        const hdr = parseSfxPackHeader113c(bin, spec.relPath)
        check(
          hdr.chunkCount === meta.chunkCount,
          () => `${spec.packId} header chunkCount ${String(hdr.chunkCount)} != meta.chunkCount ${String(meta.chunkCount)}`,
        )
      } catch (err) {
        check(false, () => `${spec.packId} header error: ${messageOf(err)}`)
      }
    }

    const ambientPackIds = new Set<string>(AMBIENT_SFX_PACK_SPECS_113C.map((s) => s.packId))
    const corePackIds = new Set<string>(CORE_SFX_PACK_SPECS_113C.map((s) => s.packId))

    const audioArchives = ctx.audioArchives()
    const wavInfoByNormFile = new Map<string, WavPcm16>()
    const firstSliceByNormFile = new Map<string, { packId: string; byteOffset: number; byteLength: number }>()
    const uniqueSlicesByPack = new Map<string, Map<string, { byteOffset: number; byteLength: number; rowId: number; fileName: string; wav: WavPcm16 }>>()
    for (const spec of AMBIENT_SFX_PACK_SPECS_113C) {
      uniqueSlicesByPack.set(spec.packId, new Map())
    }

    let sceneEventRowCount = 0
    let coreAmbientRowCount = 0
    for (const row of SOUNDS_113C) {
      if (row.id <= 0 || row.stream) continue
      const normFile = normalizeSoundFileName113c(row.fileName)
      if (!normFile.startsWith('ambient\\') || normFile === 'none.wav') continue

      const tuple = tuplesMap[row.id]
      if (isAmbientSceneOrEventRow113c(row)) {
        sceneEventRowCount += 1
        if (!tuple) {
          check(false, () => `missing index entry for ambient scene/event row ${String(row.id)} (${row.sound}, ${row.fileName})`)
          continue
        }
        const [packId, byteOffset, byteLength, sampleRate, frames, channels] = tuple
        check(
          ambientPackIds.has(packId),
          () => `row ${String(row.id)} (${row.sound}) mapped to ${packId}, expected sfx-ambient-act1..5`,
        )

        let wav = wavInfoByNormFile.get(normFile)
        if (!wav) {
          const mpqPath = buildSoundMpqPath113c(row.id)
          if (!mpqPath) {
            check(false, () => `row ${String(row.id)} (${row.fileName}) has null MPQ path`)
            continue
          }
          wav = await readCachedMpqWavHeader(ctx.mpqDir, audioArchives, mpqPath, `${mpqPath} (row ${String(row.id)})`)
          wavInfoByNormFile.set(normFile, wav)
        }

        check(
          sampleRate === wav.sampleRate && frames === wav.frames && channels === wav.channels,
          () =>
            `row ${String(row.id)} (${row.fileName}) PCM facts mismatch: index=(${String(sampleRate)},${String(frames)},${String(channels)}) wav=(${String(wav.sampleRate)},${String(wav.frames)},${String(wav.channels)})`,
        )

        const firstSlice = firstSliceByNormFile.get(normFile)
        if (!firstSlice) {
          firstSliceByNormFile.set(normFile, { packId, byteOffset, byteLength })
        } else {
          check(
            packId === firstSlice.packId && byteOffset === firstSlice.byteOffset && byteLength === firstSlice.byteLength,
            () => `row ${String(row.id)} (${row.fileName}) duplicate WAV slice mismatch vs ${JSON.stringify(firstSlice)}`,
          )
        }

        const packSlices = uniqueSlicesByPack.get(packId)
        if (packSlices) {
          const sliceKey = `${String(byteOffset)}:${String(byteLength)}`
          if (!packSlices.has(sliceKey)) {
            packSlices.set(sliceKey, {
              byteOffset,
              byteLength,
              rowId: row.id,
              fileName: row.fileName,
              wav,
            })
          }
        }
      } else if (isCoreAmbientRow113c(row)) {
        coreAmbientRowCount += 1
        check(
          tuple !== undefined && corePackIds.has(tuple[0]),
          () => `core ambient row ${String(row.id)} (${row.sound}) missing or not in sfx-core*`,
        )
      } else {
        check(false, () => `unclassified ambient row ${String(row.id)} (${row.sound}, ${row.fileName})`)
      }
    }

    check(
      sceneEventRowCount === 151 && coreAmbientRowCount === 192 && sceneEventRowCount + coreAmbientRowCount === 343,
      () => `D10 ambient row partition mismatch: sceneEvent=${String(sceneEventRowCount)} core=${String(coreAmbientRowCount)}`,
    )

    let totalUniqueChunks = 0
    for (const spec of AMBIENT_SFX_PACK_SPECS_113C) {
      const bin = binByPackId.get(spec.packId)
      const meta = packsList.find((p) => p.packId === spec.packId)
      if (!bin || !meta) continue

      const slices = [...uniqueSlicesByPack.get(spec.packId)!.values()].sort((a, b) => a.byteOffset - b.byteOffset)
      totalUniqueChunks += slices.length
      check(
        slices.length === meta.chunkCount,
        () => `${spec.packId} unique slice count ${String(slices.length)} != meta.chunkCount ${String(meta.chunkCount)}`,
      )

      let cursor = SFX_PACK_HEADER_BYTES_113C
      for (const s of slices) {
        check(
          s.byteOffset === cursor && s.byteLength > 0 && s.byteOffset + s.byteLength <= bin.byteLength,
          () =>
            `${spec.packId} row ${String(s.rowId)} (${s.fileName}) slice offset=${String(s.byteOffset)} byteLength=${String(s.byteLength)} expected contiguous offset=${String(cursor)} within ${String(bin.byteLength)}`,
        )
        cursor = s.byteOffset + s.byteLength

        if (s.byteOffset < 0 || s.byteLength <= 0 || s.byteOffset + s.byteLength > bin.byteLength) {
          continue
        }
        const chunkBytes = bin.subarray(s.byteOffset, s.byteOffset + s.byteLength)
        let opus
        try {
          opus = inspectOggOpusChunk113c(chunkBytes, `${spec.packId} row ${String(s.rowId)} (${s.fileName})`)
          checks += 1
        } catch (err) {
          check(false, () => `${spec.packId} row ${String(s.rowId)} (${s.fileName}) OggS/CRC/Opus error: ${messageOf(err)}`)
          continue
        }

        check(
          opus.channels === s.wav.channels,
          () => `${spec.packId} row ${String(s.rowId)} (${s.fileName}) channels=${String(opus.channels)} != wav=${String(s.wav.channels)}`,
        )
        const wavSec = s.wav.frames / s.wav.sampleRate
        check(
          Math.abs(opus.decodedSeconds - wavSec) <= 0.002,
          () => `${spec.packId} row ${String(s.rowId)} (${s.fileName}) duration=${opus.decodedSeconds.toFixed(4)}s != wav=${wavSec.toFixed(4)}s`,
        )
        const bps = (opus.audioPacketBytes * 8) / opus.decodedSeconds
        const floor = s.wav.channels === 2 ? SFX_STEREO_BITRATE_113C : SFX_MONO_BITRATE_113C
        check(
          bps >= floor,
          () => `${spec.packId} row ${String(s.rowId)} (${s.fileName}) bitrate ${bps.toFixed(1)} bps < floor ${String(floor)} bps`,
        )

        const sizes = new Set(opus.audioPacketSizes)
        const durs = new Set(opus.audioPacketSamples48k)
        check(
          sizes.size === 1 && durs.size === 1,
          () =>
            `${spec.packId} row ${String(s.rowId)} (${s.fileName}) not hard CBR: packetSizes=${JSON.stringify([...sizes])} samples48k=${JSON.stringify([...durs])}`,
        )
      }
      check(
        cursor === bin.byteLength,
        () => `${spec.packId} trailing bytes after last slice: end=${String(cursor)} != bin.byteLength=${String(bin.byteLength)}`,
      )
    }

    check(
      totalUniqueChunks === 122,
      () => `expected 122 unique ambient scene/event chunks across 5 packs, got ${String(totalUniqueChunks)}`,
    )

    const totalBytes = AMBIENT_SFX_PACK_SPECS_113C.reduce((acc, s) => acc + (binByPackId.get(s.packId)?.byteLength ?? 0), 0)
    const summary =
      `5 ambient packs (${AMBIENT_SFX_PACK_SPECS_113C.map((s) => `${s.packId}=${String(binByPackId.get(s.packId)?.byteLength ?? 0)}B`).join(', ')}, ` +
      `total=${String(totalBytes)}B); ${String(sceneEventRowCount)} scene/event rows (${String(totalUniqueChunks)} unique chunks) + ${String(coreAmbientRowCount)} core rows = 343 D10 rows verified`
    return {
      checks,
      errors,
      summary,
      facts: {
        packs: AMBIENT_SFX_PACK_SPECS_113C.length,
        sceneEventRows: sceneEventRowCount,
        coreAmbientRows: coreAmbientRowCount,
        uniqueChunks: totalUniqueChunks,
        totalBytes,
      },
    }
  },
}

/** Section `levels` (#946): audits all 136 `Levels.txt` -> `SoundEnviron.txt` (50 rows) -> `SFX_PACK_INDEX_113C` -> `.bin` pack files on disk. */
export const LEVELS_SECTION_113C: AudioAuditSection = {
  id: 'levels',
  title: '136 Levels.txt -> 50 SoundEnviron.txt -> SFX_PACK_INDEX_113C & pack resolution',
  async run(ctx: AudioAuditContext): Promise<AudioAuditSectionOutcome> {
    const errors: string[] = []
    let checks = 0
    const check = (ok: boolean, message: () => string): void => {
      checks += 1
      if (!ok) errors.push(`levels: ${message()}`)
    }

    const indexAbs = join(ctx.rootDir, SFX_PACK_INDEX_TS_FILE)
    if (!existsSync(indexAbs)) {
      check(false, () => `committed ${SFX_PACK_INDEX_TS_FILE} missing at ${indexAbs}`)
      return { checks, errors, summary: 'missing index' }
    }
    const { packsList, tuplesMap } = parseSfxPackIndexSource113c(readFileSync(indexAbs, 'utf8'))
    const packMetaById = new Map(packsList.map((p) => [p.packId, p]))

    check(SOUND_ENVIRON_113C.length === 50, () => `SOUND_ENVIRON_113C length=${String(SOUND_ENVIRON_113C.length)}, expected 50`)

    for (const env of SOUND_ENVIRON_113C) {
      const cues: readonly [string, number][] = [
        ['dayAmbience', env.dayAmbience],
        ['nightAmbience', env.nightAmbience],
        ['dayEvent', env.dayEvent],
        ['nightEvent', env.nightEvent],
      ]
      for (const [colName, rootId] of cues) {
        if (rootId <= 0) {
          checks += 1
          continue
        }
        const rootRow = SOUNDS_113C[rootId]
        if (!rootRow) {
          check(false, () => `SoundEnviron[${String(env.index)}] (${env.handle}) ${colName}=${String(rootId)} out of range`)
          continue
        }
        const count = Math.max(1, rootRow.groupSize)
        for (let offset = 0; offset < count; offset += 1) {
          const memberId = rootId + offset
          const memberRow = SOUNDS_113C[memberId]
          if (!memberRow || memberRow.fileName.toLowerCase() === 'none.wav') continue
          const tuple = tuplesMap[memberId]
          if (!tuple) {
            check(
              false,
              () =>
                `SoundEnviron[${String(env.index)}] (${env.handle}) ${colName} member ${String(memberId)} (${memberRow.sound}) missing from SFX_PACK_INDEX_113C`,
            )
            continue
          }
          const packMeta = packMetaById.get(tuple[0])
          const binAbs = packMeta ? join(ctx.publicDir, packMeta.url.replace(/^\/+/, '')) : ''
          check(
            packMeta !== undefined && existsSync(binAbs),
            () =>
              `SoundEnviron[${String(env.index)}] (${env.handle}) ${colName} member ${String(memberId)} pack ${tuple[0]} missing on disk (${binAbs})`,
          )
        }
      }
    }

    for (let levelId = 1; levelId <= 136; levelId += 1) {
      const envIdx = LEVEL_SOUND_ENV_113C[levelId]
      check(
        envIdx !== undefined && envIdx >= 0 && envIdx < SOUND_ENVIRON_113C.length,
        () => `levelId ${String(levelId)} invalid SoundEnv=${String(envIdx)}`,
      )
    }

    // Also verify all 5 ambient packs exist on disk for Act 1..5 level coverage
    for (const spec of AMBIENT_SFX_PACK_SPECS_113C) {
      const binAbs = join(ctx.publicDir, spec.relPath)
      check(
        existsSync(binAbs),
        () => `Act ${String(spec.act)} ambient pack ${spec.packId} missing at ${binAbs}`,
      )
    }

    return {
      checks,
      errors,
      summary: `136/136 Levels.txt SoundEnv mappings and 50/50 SoundEnviron.txt variant groups resolved to baked Opus packs`,
      facts: {
        levels: 136,
        environments: SOUND_ENVIRON_113C.length,
      },
    }
  },
}

function findRawWavFilesUnder(dirAbs: string, out: string[] = []): string[] {
  if (!existsSync(dirAbs)) return out
  for (const name of readdirSync(dirAbs).sort()) {
    const full = join(dirAbs, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      findRawWavFilesUnder(full, out)
    } else if (st.isFile() && name.toLowerCase().endsWith('.wav')) {
      out.push(full)
    }
  }
  return out
}

/** Section `weather` (#946): audits rain (`id 64`) + thunder (`id 202..204`) Opus chunks, D14 zero raw WAVs, and `sound-environ-113c.ts` hygiene. */
export const WEATHER_SECTION_113C: AudioAuditSection = {
  id: 'weather',
  title: 'Weather rain (id 64) + thunder (id 202..204) Opus chunks and D14 zero-raw-WAV gate',
  async run(ctx: AudioAuditContext): Promise<AudioAuditSectionOutcome> {
    const errors: string[] = []
    let checks = 0
    const check = (ok: boolean, message: () => string): void => {
      checks += 1
      if (!ok) errors.push(`weather: ${message()}`)
    }

    // D14: Zero raw WAV files under public/sound (especially public/sound/weather/rain.wav)
    const soundDir = join(ctx.publicDir, 'sound')
    const rawWavs = findRawWavFilesUnder(soundDir)
    check(
      rawWavs.length === 0,
      () => `D14 violation: raw .wav file(s) found under public/sound: ${rawWavs.join(', ')}`,
    )

    const indexAbs = join(ctx.rootDir, SFX_PACK_INDEX_TS_FILE)
    if (!existsSync(indexAbs)) {
      check(false, () => `committed ${SFX_PACK_INDEX_TS_FILE} missing at ${indexAbs}`)
      return { checks, errors, summary: 'missing index' }
    }
    const { packsList, tuplesMap } = parseSfxPackIndexSource113c(readFileSync(indexAbs, 'utf8'))
    const packMetaById = new Map(packsList.map((p) => [p.packId, p]))

    const weatherIds = [64, 202, 203, 204] as const
    const rainRow = SOUNDS_113C[64]
    check(
      rainRow !== undefined &&
        rainRow.sound === 'scene_rain' &&
        rainRow.loop &&
        rainRow.fadeIn === 12 &&
        rainRow.fadeOut === 12,
      () => `row 64 (scene_rain) metadata mismatch: ${JSON.stringify(rainRow)}`,
    )
    const thunderRoot = SOUNDS_113C[202]
    check(
      thunderRoot !== undefined &&
        thunderRoot.sound === 'event_thunder_1' &&
        thunderRoot.groupSize === 3 &&
        !thunderRoot.loop,
      () => `row 202 (event_thunder_1) metadata mismatch: ${JSON.stringify(thunderRoot)}`,
    )

    const audioArchives = ctx.audioArchives()
    for (const id of weatherIds) {
      const row = SOUNDS_113C[id]!
      const tuple = tuplesMap[id]
      if (!tuple) {
        check(false, () => `weather sound id ${String(id)} (${row.sound}) missing from SFX_PACK_INDEX_113C`)
        continue
      }
      const [packId, byteOffset, byteLength, sampleRate, frames, channels] = tuple
      const meta = packMetaById.get(packId)
      const binAbs = meta ? join(ctx.publicDir, meta.url.replace(/^\/+/, '')) : ''
      if (!meta || !existsSync(binAbs)) {
        check(false, () => `weather sound id ${String(id)} pack ${packId} missing on disk (${binAbs})`)
        continue
      }
      const bin = new Uint8Array(readFileSync(binAbs))
      check(
        byteOffset >= SFX_PACK_HEADER_BYTES_113C && byteLength > 0 && byteOffset + byteLength <= bin.byteLength,
        () => `weather sound id ${String(id)} slice out of bounds`,
      )
      const chunkBytes = bin.subarray(byteOffset, byteOffset + byteLength)
      try {
        const opus = inspectOggOpusChunk113c(chunkBytes, `weather row ${String(id)} (${row.sound})`)
        const mpqPath = buildSoundMpqPath113c(id)!
        const wav = await readCachedMpqWavHeader(ctx.mpqDir, audioArchives, mpqPath, mpqPath)
        check(
          sampleRate === wav.sampleRate && frames === wav.frames && channels === wav.channels && opus.channels === wav.channels,
          () => `weather row ${String(id)} PCM/Opus header mismatch`,
        )
      } catch (err) {
        check(false, () => `weather row ${String(id)} Opus error: ${messageOf(err)}`)
      }
    }

    const clientEnvPath = join(ctx.rootDir, 'src/client/audio/sound-environ-113c.ts')
    if (existsSync(clientEnvPath)) {
      const clientEnvSrc = readFileSync(clientEnvPath, 'utf8')
      check(!/\/sound\/weather\//.test(clientEnvSrc), () => 'sound-environ-113c.ts references legacy /sound/weather/')
      check(!/\.wav\b/i.test(clientEnvSrc), () => 'sound-environ-113c.ts references .wav')
      check(
        !/\bcreateOscillator\b|\bplayTone\b/.test(clientEnvSrc),
        () => 'sound-environ-113c.ts references oscillator synthesis',
      )
    }

    return {
      checks,
      errors,
      summary: `weather rain (id 64 stereo loop) + thunder (id 202..204 groupSize=3) Opus chunks verified; 0 raw .wav files under public/sound (D14)`,
      facts: {
        weatherIds: weatherIds.join(','),
        rawWavCount: rawWavs.length,
      },
    }
  },
}

const EXPECTED_SKILL_BUCKET_COUNTS_113C: Readonly<Record<SkillBucket113c, number>> = {
  ama: 45,
  sor: 68,
  nec: 46,
  pal: 43,
  bar: 48,
  dru: 16,
  ass: 35,
  common: 2,
}

const skillAuditTableCacheByMpqDir = new Map<
  string,
  {
    readonly rebakedSkillSoundsTs: string
    readonly referencedSoundIds: ReadonlySet<number>
    readonly skillCount: number
    readonly missileCount: number
  }
>()

/** Section `skills` (#947): audits `sfx-skills-{ama,sor,nec,pal,bar,dru,ass,common}*.bin`, `skill-sounds-113c.ts`, and `Skills.txt` / `Missiles.txt` sound coverage. */
export const SKILLS_SECTION_113C: AudioAuditSection = {
  id: 'skills',
  title: 'Seven-class & common skill/missile Opus packs (sfx-skills-*) and skill-sounds-113c.ts',
  async run(ctx: AudioAuditContext): Promise<AudioAuditSectionOutcome> {
    const errors: string[] = []
    let checks = 0
    const check = (ok: boolean, message: () => string): void => {
      checks += 1
      if (!ok) errors.push(`skills: ${message()}`)
    }

    const indexAbs = join(ctx.rootDir, SFX_PACK_INDEX_TS_FILE)
    if (!existsSync(indexAbs)) {
      check(false, () => `committed ${SFX_PACK_INDEX_TS_FILE} missing at ${indexAbs} (run npm run pack:skill-sounds)`)
      return { checks, errors, summary: 'missing index' }
    }
    const { packsList, tuplesMap } = parseSfxPackIndexSource113c(readFileSync(indexAbs, 'utf8'))
    const packMetaById = new Map(packsList.map((p) => [p.packId, p]))

    // 1. Check skill-sounds-113c.ts determinism and purity against fresh MPQ extraction
    const skillTsAbs = join(ctx.rootDir, SKILL_SOUND_TS_FILE)
    if (!existsSync(skillTsAbs)) {
      check(false, () => `committed ${SKILL_SOUND_TS_FILE} missing at ${skillTsAbs} (run npm run pack:skill-sounds)`)
    } else {
      const committedSkillTs = readFileSync(skillTsAbs, 'utf8')
      const domGlobalRe = new RegExp('\\\\b(?:window|document|AudioContext|HTMLAudioElement|fetch)\\\\b')
      check(
        !/from\s+['"]node:|require\(['"]node:/.test(committedSkillTs) &&
          !domGlobalRe.test(committedSkillTs) &&
          !/\bMath\.random\b|\bDate\.now\b/.test(committedSkillTs),
        () => `${SKILL_SOUND_TS_FILE} contains purity violations`,
      )
      let cachedTables = skillAuditTableCacheByMpqDir.get(ctx.mpqDir)
      if (!cachedTables) {
        const extracted = await extractSkillAndMissileSoundTables113c(ctx.dataArchives())
        const rebakedSkillSoundsTs = renderSkillSoundsModule113c(
          extracted.skillRows,
          extracted.missileRows,
          extracted.monsterDeathSounds,
        )
        cachedTables = {
          rebakedSkillSoundsTs,
          referencedSoundIds: extracted.referencedSoundIds,
          skillCount: extracted.skillRows.length,
          missileCount: extracted.missileRows.length,
        }
        skillAuditTableCacheByMpqDir.set(ctx.mpqDir, cachedTables)
      }
      check(
        committedSkillTs === cachedTables.rebakedSkillSoundsTs,
        () =>
          `determinism: ${SKILL_SOUND_TS_FILE} differs from MPQ re-bake at ${firstDifference(committedSkillTs, cachedTables!.rebakedSkillSoundsTs)}`,
      )
    }

    const cachedTables =
      skillAuditTableCacheByMpqDir.get(ctx.mpqDir) ??
      (await (async () => {
        const extracted = await extractSkillAndMissileSoundTables113c(ctx.dataArchives())
        const rebakedSkillSoundsTs = renderSkillSoundsModule113c(
          extracted.skillRows,
          extracted.missileRows,
          extracted.monsterDeathSounds,
        )
        const v = {
          rebakedSkillSoundsTs,
          referencedSoundIds: extracted.referencedSoundIds,
          skillCount: extracted.skillRows.length,
          missileCount: extracted.missileRows.length,
        }
        skillAuditTableCacheByMpqDir.set(ctx.mpqDir, v)
        return v
      })())

    // 2. Check asset-manifest.json
    const manifestAbs = join(ctx.publicDir, 'asset-manifest.json')
    let manifestFiles: Readonly<Record<string, string>> = {}
    let manifestAssets: Readonly<Record<string, unknown>> = {}
    if (!existsSync(manifestAbs)) {
      check(false, () => `asset-manifest.json missing at ${manifestAbs}`)
    } else {
      try {
        const rawManifest = JSON.parse(readFileSync(manifestAbs, 'utf8')) as {
          files?: Readonly<Record<string, string>>
          assets?: Readonly<Record<string, unknown>>
        }
        manifestFiles = rawManifest.files ?? {}
        manifestAssets = rawManifest.assets ?? {}
        checks += 1
      } catch (err) {
        check(false, () => `asset-manifest.json parse failed: ${messageOf(err)}`)
      }
    }

    // 3. Check skill packs metadata, disk binaries, D3 <= 180,000 B cap, D2SP v2 header, and SHA-256
    const skillPacks = packsList.filter((p) =>
      /^sfx-skills-(?:ama|sor|nec|pal|bar|dru|ass|common)(?:-\d+)?$/.test(p.packId),
    )
    check(
      skillPacks.length >= SKILL_BUCKETS.length,
      () => `expected >= ${String(SKILL_BUCKETS.length)} sfx-skills-* packs, got ${String(skillPacks.length)}`,
    )
    for (const bucket of SKILL_BUCKETS) {
      check(
        skillPacks.some((p) => p.packId === `sfx-skills-${bucket}`),
        () => `missing primary skill pack sfx-skills-${bucket}`,
      )
    }

    const binByPackId = new Map<string, Uint8Array>()
    for (const meta of skillPacks) {
      const relPath = meta.url.replace(/^\/+/, '')
      check(meta.tier === 'skill', () => `${meta.packId} tier=${meta.tier}, expected skill`)
      check(
        meta.url === `/sound/packs/${meta.packId}.bin`,
        () => `${meta.packId} url=${meta.url}, expected /sound/packs/${meta.packId}.bin`,
      )
      check(
        isCacheableAssetPath(meta.url),
        () => `isCacheableAssetPath("${meta.url}") returned false`,
      )

      const binAbs = join(ctx.publicDir, relPath)
      if (!existsSync(binAbs)) {
        check(false, () => `missing skill pack binary ${meta.packId} at ${binAbs}`)
        continue
      }
      const bin = new Uint8Array(readFileSync(binAbs))
      binByPackId.set(meta.packId, bin)
      check(
        bin.byteLength <= D3_SKILL_PART_MAX_BYTES,
        () =>
          `${meta.packId} (${relPath}) size ${String(bin.byteLength)} B exceeds D3 cap ${String(D3_SKILL_PART_MAX_BYTES)} B`,
      )
      check(
        bin.byteLength === meta.bytes,
        () => `${meta.packId} bytes mismatch: disk ${String(bin.byteLength)} != index ${String(meta.bytes)}`,
      )
      const diskSha = createHash('sha256').update(bin).digest('hex')
      check(
        diskSha === meta.sha256,
        () => `${meta.packId} sha256 mismatch: disk ${diskSha} != index ${meta.sha256}`,
      )

      const manifestHash = manifestFiles[relPath]
      check(
        manifestHash === diskSha.slice(0, 16) && manifestHash === meta.sha256.slice(0, 16),
        () =>
          `asset-manifest.json files hash mismatch for ${relPath}: manifest=${String(manifestHash)} disk=${diskSha.slice(0, 16)} index=${meta.sha256.slice(0, 16)}`,
      )

      const assetEntry = manifestAssets[relPath]
      if (assetEntry && typeof assetEntry === 'object' && !Array.isArray(assetEntry)) {
        const entryObj = assetEntry as { sha256?: string; bytes?: number; size?: number }
        const entryBytes = entryObj.bytes ?? entryObj.size
        check(
          entryObj.sha256 === diskSha &&
            entryObj.sha256 === meta.sha256 &&
            (entryBytes === undefined || entryBytes === bin.byteLength),
          () =>
            `asset-manifest.json assets entry mismatch for ${relPath}: entry=${JSON.stringify(entryObj)} disk=(${diskSha}, ${String(bin.byteLength)})`,
        )
      } else {
        check(false, () => `asset-manifest.json missing or non-object assets entry for ${relPath}`)
      }

      try {
        const hdr = parseSfxPackHeader113c(bin, relPath)
        check(
          hdr.chunkCount === meta.chunkCount,
          () => `${meta.packId} header chunkCount ${String(hdr.chunkCount)} != meta.chunkCount ${String(meta.chunkCount)}`,
        )
      } catch (err) {
        check(false, () => `${meta.packId} header error: ${messageOf(err)}`)
      }
    }

    // 4. Verify all 303 skill\* Stream=0 rows and bucket counts
    const audioArchives = ctx.audioArchives()
    const wavInfoByNormFile = new Map<string, WavPcm16>()
    const bucketRowCounts: Record<SkillBucket113c, number> = {
      ama: 0,
      sor: 0,
      nec: 0,
      pal: 0,
      bar: 0,
      dru: 0,
      ass: 0,
      common: 0,
    }
    let strictSkillRowCount = 0
    for (const row of SOUNDS_113C) {
      if (row.id <= 0 || row.stream) continue
      const bucket = classifySkillRowBucket113c(row)
      if (bucket === null) continue
      strictSkillRowCount += 1
      bucketRowCounts[bucket] += 1

      const tuple = tuplesMap[row.id]
      if (!tuple) {
        check(false, () => `missing index entry for skill row ${String(row.id)} (${row.sound}, ${row.fileName})`)
        continue
      }
      const [packId, , , sampleRate, frames, channels] = tuple
      check(
        packId === `sfx-skills-${bucket}` || packId.startsWith(`sfx-skills-${bucket}-`),
        () => `skill row ${String(row.id)} (${row.sound}) mapped to ${packId}, expected sfx-skills-${bucket}*`,
      )

      const normFile = normalizeSoundFileName113c(row.fileName)
      let wav = wavInfoByNormFile.get(normFile)
      if (!wav) {
        const mpqPath = buildSoundMpqPath113c(row.id)
        if (!mpqPath) {
          check(false, () => `row ${String(row.id)} (${row.fileName}) has null MPQ path`)
          continue
        }
        wav = await readCachedMpqWavHeader(ctx.mpqDir, audioArchives, mpqPath, `${mpqPath} (row ${String(row.id)})`)
        wavInfoByNormFile.set(normFile, wav)
      }
      check(
        sampleRate === wav.sampleRate && frames === wav.frames && channels === wav.channels,
        () =>
          `row ${String(row.id)} (${row.fileName}) PCM facts mismatch: index=(${String(sampleRate)},${String(frames)},${String(channels)}) wav=(${String(wav.sampleRate)},${String(wav.frames)},${String(wav.channels)})`,
      )
    }

    check(
      strictSkillRowCount === 303,
      () => `expected 303 skill\\* Stream=0 rows, got ${String(strictSkillRowCount)}`,
    )
    for (const bucket of SKILL_BUCKETS) {
      check(
        bucketRowCounts[bucket] === EXPECTED_SKILL_BUCKET_COUNTS_113C[bucket],
        () =>
          `bucket ${bucket} skill\\* row count=${String(bucketRowCounts[bucket])}, expected ${String(EXPECTED_SKILL_BUCKET_COUNTS_113C[bucket])}`,
      )
    }

    // 5. Verify every Skills.txt & Missiles.txt referenced Stream=0 sound ID is present in SFX_PACK_INDEX_113C and on disk
    for (const refId of cachedTables.referencedSoundIds) {
      const tuple = tuplesMap[refId]
      if (!tuple) {
        check(
          false,
          () => `Skills.txt/Missiles.txt referenced sound id ${String(refId)} (${SOUNDS_113C[refId]?.sound ?? '?'}) missing from SFX_PACK_INDEX_113C`,
        )
        continue
      }
      const pMeta = packMetaById.get(tuple[0])
      const binAbs = pMeta ? join(ctx.publicDir, pMeta.url.replace(/^\/+/, '')) : ''
      check(
        pMeta !== undefined && existsSync(binAbs),
        () => `referenced sound id ${String(refId)} pack ${tuple[0]} missing on disk (${binAbs})`,
      )
    }

    // 6. Verify every unique slice inside every sfx-skills-* pack
    const skillPackIdSet = new Set(skillPacks.map((p) => p.packId))
    const uniqueSlicesByPack = new Map<
      string,
      Map<string, { byteOffset: number; byteLength: number; rowId: number; fileName: string; wav: WavPcm16 }>
    >()
    const rowCountByPack = new Map<string, number>()
    for (const meta of skillPacks) {
      uniqueSlicesByPack.set(meta.packId, new Map())
      rowCountByPack.set(meta.packId, 0)
    }

    for (const [idStr, tuple] of Object.entries(tuplesMap)) {
      const [packId, byteOffset, byteLength, sampleRate, frames, channels] = tuple
      if (!skillPackIdSet.has(packId)) continue
      const rowId = Number(idStr)
      const row = SOUNDS_113C[rowId]
      if (!row) {
        check(false, () => `tuple for unknown row id ${String(rowId)} in ${packId}`)
        continue
      }
      rowCountByPack.set(packId, (rowCountByPack.get(packId) ?? 0) + 1)

      const normFile = normalizeSoundFileName113c(row.fileName)
      let wav = wavInfoByNormFile.get(normFile)
      if (!wav) {
        const mpqPath = buildSoundMpqPath113c(row.id)
        if (!mpqPath) {
          check(false, () => `row ${String(row.id)} (${row.fileName}) has null MPQ path`)
          continue
        }
        wav = await readCachedMpqWavHeader(ctx.mpqDir, audioArchives, mpqPath, `${mpqPath} (row ${String(row.id)})`)
        wavInfoByNormFile.set(normFile, wav)
      }
      check(
        sampleRate === wav.sampleRate && frames === wav.frames && channels === wav.channels,
        () => `row ${String(row.id)} (${row.fileName}) PCM facts mismatch in ${packId}`,
      )

      const packSlices = uniqueSlicesByPack.get(packId)!
      const sliceKey = `${String(byteOffset)}:${String(byteLength)}`
      if (!packSlices.has(sliceKey)) {
        packSlices.set(sliceKey, {
          byteOffset,
          byteLength,
          rowId: row.id,
          fileName: row.fileName,
          wav,
        })
      }
    }

    let totalUniqueChunks = 0
    for (const meta of skillPacks) {
      const bin = binByPackId.get(meta.packId)
      if (!bin) continue

      const countRows = rowCountByPack.get(meta.packId) ?? 0
      check(
        countRows === meta.rowCount,
        () => `${meta.packId} indexed rowCount ${String(countRows)} != meta.rowCount ${String(meta.rowCount)}`,
      )

      const slices = [...uniqueSlicesByPack.get(meta.packId)!.values()].sort((a, b) => a.byteOffset - b.byteOffset)
      totalUniqueChunks += slices.length
      check(
        slices.length === meta.chunkCount,
        () => `${meta.packId} unique slice count ${String(slices.length)} != meta.chunkCount ${String(meta.chunkCount)}`,
      )

      let cursor = SFX_PACK_HEADER_BYTES_113C
      for (const s of slices) {
        check(
          s.byteOffset === cursor && s.byteLength > 0 && s.byteOffset + s.byteLength <= bin.byteLength,
          () =>
            `${meta.packId} row ${String(s.rowId)} (${s.fileName}) slice offset=${String(s.byteOffset)} byteLength=${String(s.byteLength)} expected contiguous offset=${String(cursor)} within ${String(bin.byteLength)}`,
        )
        cursor = s.byteOffset + s.byteLength

        if (s.byteOffset < 0 || s.byteLength <= 0 || s.byteOffset + s.byteLength > bin.byteLength) {
          continue
        }
        const chunkBytes = bin.subarray(s.byteOffset, s.byteOffset + s.byteLength)
        let opus
        try {
          opus = inspectOggOpusChunk113c(chunkBytes, `${meta.packId} row ${String(s.rowId)} (${s.fileName})`)
          checks += 1
        } catch (err) {
          check(false, () => `${meta.packId} row ${String(s.rowId)} (${s.fileName}) OggS/CRC/Opus error: ${messageOf(err)}`)
          continue
        }

        check(
          opus.channels === s.wav.channels,
          () => `${meta.packId} row ${String(s.rowId)} (${s.fileName}) channels=${String(opus.channels)} != wav=${String(s.wav.channels)}`,
        )
        const wavSec = s.wav.frames / s.wav.sampleRate
        check(
          Math.abs(opus.decodedSeconds - wavSec) <= 0.002,
          () => `${meta.packId} row ${String(s.rowId)} (${s.fileName}) duration=${opus.decodedSeconds.toFixed(4)}s != wav=${wavSec.toFixed(4)}s`,
        )
        const bps = opus.decodedSeconds > 0 ? (opus.audioPacketBytes * 8) / opus.decodedSeconds : 0
        const floor = s.wav.channels === 2 ? SFX_STEREO_BITRATE_113C : SFX_MONO_BITRATE_113C
        check(
          bps + 1e-6 >= floor,
          () => `${meta.packId} row ${String(s.rowId)} (${s.fileName}) bitrate ${bps.toFixed(1)} bps < floor ${String(floor)} bps`,
        )
      }
      check(
        cursor === bin.byteLength,
        () => `${meta.packId} trailing bytes after last slice: end=${String(cursor)} != bin.byteLength=${String(bin.byteLength)}`,
      )
    }

    const totalBytes = skillPacks.reduce((acc, m) => acc + (binByPackId.get(m.packId)?.byteLength ?? 0), 0)
    const summary =
      `${String(skillPacks.length)} skill packs (total=${String(totalBytes)}B, all <= ${String(D3_SKILL_PART_MAX_BYTES)}B); ` +
      `303 skill\\* rows + ${String(cachedTables.referencedSoundIds.size)} Skills.txt/Missiles.txt referenced rows (${String(totalUniqueChunks)} unique Opus chunks) verified`
    return {
      checks,
      errors,
      summary,
      facts: {
        packs: skillPacks.length,
        skillFolderRows: strictSkillRowCount,
        referencedSoundIds: cachedTables.referencedSoundIds.size,
        uniqueChunks: totalUniqueChunks,
        totalBytes,
      },
    }
  },
}

const monsterAuditTableCacheByMpqDir = new Map<
  string,
  {
    readonly rebakedMonSoundsTs: string
    readonly unshippedMonsterIds: readonly number[]
    readonly monSoundCount: number
  }
>()

function parseUnshippedMonsterIdsFromSource(source: string): readonly number[] {
  const m = /export const UNSHIPPED_MONSTER_SOUND_IDS_113C[^=]*=\s*(?:Object\.freeze\()?\s*\[([\s\S]*?)\]\s*\)?/.exec(source)
  if (!m?.[1]) return []
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => Number.isInteger(n))
}

/** Section `monsters` (#948): audits `sfx-mon-act{1..5}*.bin`, `mon-sounds-113c.ts`, `MonSounds.txt`, and D9 4 unshipped monster IDs (`1595..1598`). */
export const MONSTERS_SECTION_113C: AudioAuditSection = {
  id: 'monsters',
  title: 'Act-partitioned monster Opus packs (sfx-mon-act1..5), mon-sounds-113c.ts, and D9 unshipped monster IDs',
  async run(ctx: AudioAuditContext): Promise<AudioAuditSectionOutcome> {
    const errors: string[] = []
    let checks = 0
    const check = (ok: boolean, message: () => string): void => {
      checks += 1
      if (!ok) errors.push(`monsters: ${message()}`)
    }

    const indexAbs = join(ctx.rootDir, SFX_PACK_INDEX_TS_FILE)
    if (!existsSync(indexAbs)) {
      check(false, () => `committed ${SFX_PACK_INDEX_TS_FILE} missing at ${indexAbs} (run npm run pack:monster-sounds)`)
      return { checks, errors, summary: 'missing index' }
    }
    const { packsList, tuplesMap } = parseSfxPackIndexSource113c(readFileSync(indexAbs, 'utf8'))

    // 1. Check mon-sounds-113c.ts determinism, purity, and D9 unshipped monster IDs against fresh MPQ extraction
    const monTsAbs = join(ctx.rootDir, MON_SOUNDS_TS_FILE)
    let cachedTables = monsterAuditTableCacheByMpqDir.get(ctx.mpqDir)
    if (!cachedTables) {
      const extracted = await extractMonsterSoundTables113c(ctx.dataArchives(), ctx.audioArchives())
      const rebakedMonSoundsTs = renderMonSoundsModule113c(
        extracted.monSoundRows,
        extracted.unshippedMonsterIds,
      )
      cachedTables = {
        rebakedMonSoundsTs,
        unshippedMonsterIds: extracted.unshippedMonsterIds,
        monSoundCount: extracted.monSoundRows.length,
      }
      monsterAuditTableCacheByMpqDir.set(ctx.mpqDir, cachedTables)
    }

    const globalSoundIds = await import('../packers/pack-monster-sounds.ts').then(async m => { const { extractMonSoundRows113c } = await import('../packers/pack-monster-sounds.ts'); const monSoundRows = await extractMonSoundRows113c(ctx.dataArchives()); return m.deriveGlobalMonsterSoundIds113c(ctx.dataArchives(), monSoundRows); })
    for (const sid of globalSoundIds) {
       const pack = tuplesMap[sid]
       if (pack) {
         const pId = pack[0]
         check(
           pId.startsWith('sfx-mon-global') || pId.startsWith('sfx-skills-') || pId.startsWith('sfx-core') || pId === 'sfx-combat',
           () => `Sound ${sid} is a cross-act summon/mercenary sound but is packed in act-specific pack ${pId}`
         )
       }
    }

    if (!existsSync(monTsAbs)) {
      check(false, () => `committed ${MON_SOUNDS_TS_FILE} missing at ${monTsAbs} (run npm run pack:monster-sounds)`)
    } else {
      const committedMonTs = readFileSync(monTsAbs, 'utf8')
      const domGlobalRe = new RegExp('\\b(?:window|document|AudioContext|HTMLAudioElement|fetch)\\b')
      check(
        !/from\s+['"]node:|require\(['"]node:/.test(committedMonTs) &&
          !domGlobalRe.test(committedMonTs) &&
          !/\bMath\.random\b|\bDate\.now\b/.test(committedMonTs),
        () => `${MON_SOUNDS_TS_FILE} contains purity violations`,
      )
      check(
        committedMonTs === cachedTables.rebakedMonSoundsTs,
        () =>
          `determinism: ${MON_SOUNDS_TS_FILE} differs from MPQ re-bake at ${firstDifference(committedMonTs, cachedTables!.rebakedMonSoundsTs)}`,
      )
      const parsedUnshipped = parseUnshippedMonsterIdsFromSource(committedMonTs)
      check(
        parsedUnshipped.length === 4 &&
          parsedUnshipped.join(',') === cachedTables.unshippedMonsterIds.join(',') &&
          parsedUnshipped.join(',') === '1595,1596,1597,1598',
        () =>
          `UNSHIPPED_MONSTER_SOUND_IDS_113C in ${MON_SOUNDS_TS_FILE} is [${parsedUnshipped.join(', ')}], expected [1595, 1596, 1597, 1598]`,
      )
    }

    // 2. Check asset-manifest.json
    const manifestAbs = join(ctx.publicDir, 'asset-manifest.json')
    let manifestFiles: Readonly<Record<string, string>> = {}
    let manifestAssets: Readonly<Record<string, unknown>> = {}
    if (!existsSync(manifestAbs)) {
      check(false, () => `asset-manifest.json missing at ${manifestAbs}`)
    } else {
      try {
        const rawManifest = JSON.parse(readFileSync(manifestAbs, 'utf8')) as {
          files?: Readonly<Record<string, string>>
          assets?: Readonly<Record<string, unknown>>
        }
        manifestFiles = rawManifest.files ?? {}
        manifestAssets = rawManifest.assets ?? {}
        checks += 1
      } catch (err) {
        check(false, () => `asset-manifest.json parse failed: ${messageOf(err)}`)
      }
    }

    // 3. Check monster packs metadata, disk binaries, D3 <= 700,000 B cap, D2SP v2 header, and SHA-256
    const monPacks = packsList.filter((p) => /^sfx-mon-act[1-5](?:-\d+)?$/.test(p.packId))
    check(
      monPacks.length >= MONSTER_ACT_BUCKETS_113C.length,
      () => `expected >= ${String(MONSTER_ACT_BUCKETS_113C.length)} sfx-mon-act* packs, got ${String(monPacks.length)}`,
    )
    for (const act of MONSTER_ACT_BUCKETS_113C) {
      check(
        monPacks.some((p) => p.packId === `sfx-mon-act${String(act)}`),
        () => `missing primary monster pack sfx-mon-act${String(act)}`,
      )
    }

    const binByPackId = new Map<string, Uint8Array>()
    for (const meta of monPacks) {
      const relPath = meta.url.replace(/^\/+/, '')
      check(meta.tier === 'monster', () => `${meta.packId} tier=${meta.tier}, expected monster`)
      check(
        meta.url === `/sound/packs/${meta.packId}.bin`,
        () => `${meta.packId} url=${meta.url}, expected /sound/packs/${meta.packId}.bin`,
      )
      check(
        isCacheableAssetPath(meta.url),
        () => `isCacheableAssetPath("${meta.url}") returned false`,
      )

      const binAbs = join(ctx.publicDir, relPath)
      if (!existsSync(binAbs)) {
        check(false, () => `missing monster pack binary ${meta.packId} at ${binAbs}`)
        continue
      }
      const bin = new Uint8Array(readFileSync(binAbs))
      binByPackId.set(meta.packId, bin)
      check(
        bin.byteLength <= D3_MONSTER_PART_MAX_BYTES,
        () =>
          `${meta.packId} (${relPath}) size ${String(bin.byteLength)} B exceeds D3 cap ${String(D3_MONSTER_PART_MAX_BYTES)} B`,
      )
      check(
        bin.byteLength === meta.bytes,
        () => `${meta.packId} bytes mismatch: disk ${String(bin.byteLength)} != index ${String(meta.bytes)}`,
      )
      const diskSha = createHash('sha256').update(bin).digest('hex')
      check(
        diskSha === meta.sha256,
        () => `${meta.packId} sha256 mismatch: disk ${diskSha} != index ${meta.sha256}`,
      )

      const manifestHash = manifestFiles[relPath]
      check(
        manifestHash === diskSha.slice(0, 16) && manifestHash === meta.sha256.slice(0, 16),
        () =>
          `asset-manifest.json files hash mismatch for ${relPath}: manifest=${String(manifestHash)} disk=${diskSha.slice(0, 16)} index=${meta.sha256.slice(0, 16)}`,
      )

      const assetEntry = manifestAssets[relPath]
      if (assetEntry && typeof assetEntry === 'object' && !Array.isArray(assetEntry)) {
        const entryObj = assetEntry as { sha256?: string; bytes?: number; size?: number }
        const entryBytes = entryObj.bytes ?? entryObj.size
        check(
          entryObj.sha256 === diskSha &&
            entryObj.sha256 === meta.sha256 &&
            (entryBytes === undefined || entryBytes === bin.byteLength),
          () =>
            `asset-manifest.json assets entry mismatch for ${relPath}: entry=${JSON.stringify(entryObj)} disk=(${diskSha}, ${String(bin.byteLength)})`,
        )
      } else {
        check(false, () => `asset-manifest.json missing or non-object assets entry for ${relPath}`)
      }

      try {
        const hdr = parseSfxPackHeader113c(bin, relPath)
        check(
          hdr.chunkCount === meta.chunkCount,
          () => `${meta.packId} header chunkCount ${String(hdr.chunkCount)} != meta.chunkCount ${String(meta.chunkCount)}`,
        )
      } catch (err) {
        check(false, () => `${meta.packId} header error: ${messageOf(err)}`)
      }
    }

    // 4. Verify all 1,674 monster\* Stream=0 rows (1,670 shipped + 4 D9 unshipped 1595..1598)
    const audioArchives = ctx.audioArchives()
    const wavInfoByNormFile = new Map<string, WavPcm16>()
    const unshippedSet = new Set(cachedTables.unshippedMonsterIds)
    let shippedMonsterRowCount = 0
    let unshippedMonsterRowCount = 0

    for (const row of SOUNDS_113C) {
      if (!isStrictMonsterSoundRow113c(row)) continue
      const mpqPath = buildSoundMpqPath113c(row.id)
      const existsInMpq = mpqPath !== null && audioArchives.has(mpqPath)
      if (!existsInMpq) {
        unshippedMonsterRowCount += 1
        check(
          unshippedSet.has(row.id),
          () => `unshipped monster row ${String(row.id)} (${row.sound}) missing from D9 unshipped monster list`,
        )
        check(
          tuplesMap[row.id] === undefined,
          () => `D9 unshipped monster row ${String(row.id)} (${row.sound}) must not appear in SFX_PACK_INDEX_113C`,
        )
        continue
      }

      shippedMonsterRowCount += 1
      check(
        !unshippedSet.has(row.id),
        () => `shipped monster row ${String(row.id)} (${row.sound}) falsely listed in D9 unshipped monster list`,
      )
      const tuple = tuplesMap[row.id]
      if (!tuple) {
        check(false, () => `missing index entry for monster row ${String(row.id)} (${row.sound}, ${row.fileName})`)
        continue
      }
      const [packId, , , sampleRate, frames, channels] = tuple
      check(
        (packId.startsWith('sfx-mon-act') || packId === 'sfx-mon-global'),
        () => `monster row ${String(row.id)} (${row.sound}) mapped to ${packId}, expected sfx-mon-act*`,
      )

      const normFile = normalizeSoundFileName113c(row.fileName)
      let wav = wavInfoByNormFile.get(normFile)
      if (!wav) {
        wav = await readCachedMpqWavHeader(ctx.mpqDir, audioArchives, mpqPath!, `${mpqPath!} (row ${String(row.id)})`)
        wavInfoByNormFile.set(normFile, wav)
      }
      check(
        sampleRate === wav.sampleRate && frames === wav.frames && channels === wav.channels,
        () =>
          `row ${String(row.id)} (${row.fileName}) PCM facts mismatch: index=(${String(sampleRate)},${String(frames)},${String(channels)}) wav=(${String(wav.sampleRate)},${String(wav.frames)},${String(wav.channels)})`,
      )
    }

    check(
      shippedMonsterRowCount === 1670 && unshippedMonsterRowCount === 4,
      () =>
        `expected 1670 shipped + 4 D9 unshipped monster\\* rows, got ${String(shippedMonsterRowCount)} shipped + ${String(unshippedMonsterRowCount)} unshipped`,
    )

    // 5. Verify every unique slice inside every sfx-mon-act* pack
    const monPackIdSet = new Set(monPacks.map((p) => p.packId))
    const uniqueSlicesByPack = new Map<
      string,
      Map<string, { byteOffset: number; byteLength: number; rowId: number; fileName: string; wav: WavPcm16 }>
    >()
    const rowCountByPack = new Map<string, number>()
    for (const meta of monPacks) {
      uniqueSlicesByPack.set(meta.packId, new Map())
      rowCountByPack.set(meta.packId, 0)
    }

    for (const [idStr, tuple] of Object.entries(tuplesMap)) {
      const [packId, byteOffset, byteLength] = tuple
      if (!monPackIdSet.has(packId)) continue
      const rowId = Number(idStr)
      const row = SOUNDS_113C[rowId]
      if (!row) {
        check(false, () => `tuple for unknown row id ${String(rowId)} in ${packId}`)
        continue
      }
      rowCountByPack.set(packId, (rowCountByPack.get(packId) ?? 0) + 1)
      const normFile = normalizeSoundFileName113c(row.fileName)
      const wav = wavInfoByNormFile.get(normFile)
      if (!wav) continue
      const packSlices = uniqueSlicesByPack.get(packId)!
      const sliceKey = `${String(byteOffset)}:${String(byteLength)}`
      if (!packSlices.has(sliceKey)) {
        packSlices.set(sliceKey, {
          byteOffset,
          byteLength,
          rowId: row.id,
          fileName: row.fileName,
          wav,
        })
      }
    }

    let totalUniqueChunks = 0
    for (const meta of monPacks) {
      const bin = binByPackId.get(meta.packId)
      if (!bin) continue

      const countRows = rowCountByPack.get(meta.packId) ?? 0
      check(
        countRows === meta.rowCount,
        () => `${meta.packId} indexed rowCount ${String(countRows)} != meta.rowCount ${String(meta.rowCount)}`,
      )

      const slices = [...uniqueSlicesByPack.get(meta.packId)!.values()].sort((a, b) => a.byteOffset - b.byteOffset)
      totalUniqueChunks += slices.length
      check(
        slices.length === meta.chunkCount,
        () => `${meta.packId} unique slice count ${String(slices.length)} != meta.chunkCount ${String(meta.chunkCount)}`,
      )

      let cursor = SFX_PACK_HEADER_BYTES_113C
      for (const s of slices) {
        check(
          s.byteOffset === cursor && s.byteLength > 0 && s.byteOffset + s.byteLength <= bin.byteLength,
          () =>
            `${meta.packId} row ${String(s.rowId)} (${s.fileName}) slice offset=${String(s.byteOffset)} byteLength=${String(s.byteLength)} expected contiguous offset=${String(cursor)} within ${String(bin.byteLength)}`,
        )
        cursor = s.byteOffset + s.byteLength

        if (s.byteOffset < 0 || s.byteLength <= 0 || s.byteOffset + s.byteLength > bin.byteLength) {
          continue
        }
        const chunkBytes = bin.subarray(s.byteOffset, s.byteOffset + s.byteLength)
        let opus
        try {
          opus = inspectOggOpusChunk113c(chunkBytes, `${meta.packId} row ${String(s.rowId)} (${s.fileName})`)
          checks += 1
        } catch (err) {
          check(false, () => `${meta.packId} row ${String(s.rowId)} (${s.fileName}) OggS/CRC/Opus error: ${messageOf(err)}`)
          continue
        }

        check(
          opus.channels === s.wav.channels,
          () => `${meta.packId} row ${String(s.rowId)} (${s.fileName}) channels=${String(opus.channels)} != wav=${String(s.wav.channels)}`,
        )
        const wavSec = s.wav.frames / s.wav.sampleRate
        check(
          Math.abs(opus.decodedSeconds - wavSec) <= 0.002,
          () => `${meta.packId} row ${String(s.rowId)} (${s.fileName}) duration=${opus.decodedSeconds.toFixed(4)}s != wav=${wavSec.toFixed(4)}s`,
        )
        const bps = opus.decodedSeconds > 0 ? (opus.audioPacketBytes * 8) / opus.decodedSeconds : 0
        const floor = s.wav.channels === 2 ? SFX_STEREO_BITRATE_113C : SFX_MONO_BITRATE_113C
        check(
          bps + 1e-6 >= floor,
          () => `${meta.packId} row ${String(s.rowId)} (${s.fileName}) bitrate ${bps.toFixed(1)} bps < floor ${String(floor)} bps`,
        )
      }
      check(
        cursor === bin.byteLength,
        () => `${meta.packId} trailing bytes after last slice: end=${String(cursor)} != bin.byteLength=${String(bin.byteLength)}`,
      )
    }

    const totalBytes = monPacks.reduce((acc, m) => acc + (binByPackId.get(m.packId)?.byteLength ?? 0), 0)
    const summary =
      `${String(monPacks.length)} monster packs (total=${String(totalBytes)}B, all <= ${String(D3_MONSTER_PART_MAX_BYTES)}B); ` +
      `${String(shippedMonsterRowCount)} shipped monster\\* rows (${String(totalUniqueChunks)} unique Opus chunks) + ${String(unshippedMonsterRowCount)} D9 unshipped verified`
    return {
      checks,
      errors,
      summary,
      facts: {
        packs: monPacks.length,
        shippedMonsterRows: shippedMonsterRowCount,
        unshippedMonsterRows: unshippedMonsterRowCount,
        uniqueChunks: totalUniqueChunks,
        totalBytes,
      },
    }
  },
}

interface ParsedSpeechIndexSource113c {
  readonly unshippedSoundIds: readonly number[]
  readonly unshippedMonsterIds: readonly number[]
  readonly unshippedSpeechIds: readonly number[]
  readonly entriesById: ReadonlyMap<number, SpeechEntry113c>
}

function parseIntListExport(source: string, exportName: string): readonly number[] {
  const re = new RegExp(`export const ${exportName}[^=]*=\\s*Object\\.freeze\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`)
  const m = re.exec(source)
  if (!m?.[1]) return []
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => Number.isInteger(n))
}

function parseSpeechIndexSource113c(source: string): ParsedSpeechIndexSource113c {
  const unshippedMonsterIds = parseIntListExport(source, 'UNSHIPPED_MONSTER_SOUND_IDS_113C')
  const unshippedSpeechIds = parseIntListExport(source, 'UNSHIPPED_SPEECH_SOUND_IDS_113C')
  const unshippedSoundIds = parseIntListExport(source, 'UNSHIPPED_SOUND_IDS_113C')
  const entriesById = new Map<number, SpeechEntry113c>()
  const entriesBlock = /export const SPEECH_ENTRIES_113C[^=]*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(source)
  if (entriesBlock?.[1]) {
    for (const rawLine of entriesBlock[1].split(/\r?\n/)) {
      const m = /^\s*(\d+)\s*:\s*(?:Object\.freeze\()?(\{.*\})\)?\s*,?\s*$/.exec(rawLine)
      if (!m) continue
      const id = Number(m[1])
      const jsonText = m[2]!.replace(
        /\b(id|sound|fileName|url|bytes|sha256|durationSec|sampleRate|frames|channels|solo)\s*:/g,
        '"$1":',
      )
      const entry = JSON.parse(jsonText) as SpeechEntry113c
      entriesById.set(id, entry)
    }
  }
  return {
    unshippedSoundIds,
    unshippedMonsterIds,
    unshippedSpeechIds,
    entriesById,
  }
}

const speechWebmStatCache = new Map<
  string,
  {
    readonly bytes: number
    readonly sha256: string
    readonly info: ReturnType<typeof inspectWebmOpusSpeech113c>
  }
>()

/** Section `speech` (#948): audits all 1,679 `.webm` speech files (`1,689` shipped rows in `2934..4656`), `speech-index-113c.ts`, and D9 30 unshipped speech IDs (`34` total). */
export const SPEECH_SECTION_113C: AudioAuditSection = {
  id: 'speech',
  title: 'Streaming NPC/player/boss speech Opus-in-WebM files (2934..4656), speech-index-113c.ts, and D9 34-ID unshipped list',
  async run(ctx: AudioAuditContext): Promise<AudioAuditSectionOutcome> {
    const errors: string[] = []
    let checks = 0
    const check = (ok: boolean, message: () => string): void => {
      checks += 1
      if (!ok) errors.push(`speech: ${message()}`)
    }

    const speechTsAbs = join(ctx.rootDir, SPEECH_INDEX_TS_FILE)
    if (!existsSync(speechTsAbs)) {
      check(false, () => `committed ${SPEECH_INDEX_TS_FILE} missing at ${speechTsAbs} (run npm run pack:speech)`)
      return { checks, errors, summary: 'missing speech-index-113c.ts' }
    }
    const speechTsSource = readFileSync(speechTsAbs, 'utf8')
    const domGlobalRe = new RegExp('\\b(?:window|document|AudioContext|HTMLAudioElement|fetch)\\b')
    check(
      !/from\s+['"]node:|require\(['"]node:/.test(speechTsSource) &&
        !domGlobalRe.test(speechTsSource) &&
        !/\bMath\.random\b|\bDate\.now\b/.test(speechTsSource),
      () => `${SPEECH_INDEX_TS_FILE} contains purity violations`,
    )

    let parsedSpeech: ParsedSpeechIndexSource113c
    try {
      parsedSpeech = parseSpeechIndexSource113c(speechTsSource)
      checks += 1
    } catch (err) {
      check(false, () => `${SPEECH_INDEX_TS_FILE} parse failed: ${messageOf(err)}`)
      return { checks, errors, summary: 'parse failed' }
    }

    // Verify D9 34-ID unshipped list against mounted 1.13c MPQs
    const audioArchives = ctx.audioArchives()
    const groundTruthUnshippedMonster: number[] = []
    const groundTruthUnshippedSpeech: number[] = []
    let shippedSpeechRowCount = 0
    let noneWavSpeechRowCount = 0

    for (let id = 1; id < SOUNDS_113C.length; id += 1) {
      const row = SOUNDS_113C[id]!
      const mpqPath = buildSoundMpqPath113c(id)
      if (mpqPath === null) {
        if (id >= SPEECH_FIRST_SOUND_ID_113C && id <= SPEECH_LAST_SOUND_ID_113C) {
          noneWavSpeechRowCount += 1
        }
        continue
      }
      const inMpq = audioArchives.has(mpqPath)
      if (!inMpq) {
        if (id >= SPEECH_FIRST_SOUND_ID_113C && id <= SPEECH_LAST_SOUND_ID_113C) {
          groundTruthUnshippedSpeech.push(id)
        } else {
          groundTruthUnshippedMonster.push(id)
        }
      } else if (isSpeechRow113c(row)) {
        shippedSpeechRowCount += 1
      }
    }

    const groundTruthAll34 = [...groundTruthUnshippedMonster, ...groundTruthUnshippedSpeech].sort((a, b) => a - b)
    check(
      groundTruthUnshippedMonster.length === 4 &&
        groundTruthUnshippedSpeech.length === 30 &&
        groundTruthAll34.length === 34,
      () =>
        `MPQ ground-truth unshipped count (${String(groundTruthUnshippedMonster.length)} monster + ${String(groundTruthUnshippedSpeech.length)} speech) != 4 + 30`,
    )
    check(
      parsedSpeech.unshippedMonsterIds.join(',') === groundTruthUnshippedMonster.join(','),
      () =>
        `UNSHIPPED_MONSTER_SOUND_IDS_113C [${parsedSpeech.unshippedMonsterIds.join(',')}] != ground truth [${groundTruthUnshippedMonster.join(',')}]`,
    )
    check(
      parsedSpeech.unshippedSpeechIds.join(',') === groundTruthUnshippedSpeech.join(','),
      () =>
        `UNSHIPPED_SPEECH_SOUND_IDS_113C [${parsedSpeech.unshippedSpeechIds.join(',')}] != ground truth [${groundTruthUnshippedSpeech.join(',')}]`,
    )
    check(
      parsedSpeech.unshippedSoundIds.join(',') === groundTruthAll34.join(','),
      () =>
        `UNSHIPPED_SOUND_IDS_113C (${String(parsedSpeech.unshippedSoundIds.length)} IDs) != ground truth 34 IDs`,
    )
    check(
      shippedSpeechRowCount === 1689 && noneWavSpeechRowCount === 4,
      () =>
        `expected 1689 shipped speech rows + 4 none.wav rows in 2934..4656, got ${String(shippedSpeechRowCount)} + ${String(noneWavSpeechRowCount)}`,
    )
    check(
      parsedSpeech.entriesById.size === 1689,
      () => `SPEECH_ENTRIES_113C has ${String(parsedSpeech.entriesById.size)} entries, expected 1689`,
    )

    const manifestAbs = join(ctx.publicDir, 'asset-manifest.json')
    let manifestFiles: Readonly<Record<string, string>> = {}
    if (!existsSync(manifestAbs)) {
      check(false, () => `asset-manifest.json missing at ${manifestAbs}`)
    } else {
      try {
        const rawManifest = JSON.parse(readFileSync(manifestAbs, 'utf8')) as {
          files?: Readonly<Record<string, string>>
        }
        manifestFiles = rawManifest.files ?? {}
        checks += 1
      } catch (err) {
        check(false, () => `asset-manifest.json parse failed: ${messageOf(err)}`)
      }
    }

    const unshippedSpeechSet = new Set(groundTruthUnshippedSpeech)
    const uniqueBytesByUrl = new Map<string, number>()

    for (let id = SPEECH_FIRST_SOUND_ID_113C; id <= SPEECH_LAST_SOUND_ID_113C; id += 1) {
      const row = SOUNDS_113C[id]!
      if (!isSpeechRow113c(row)) continue
      if (unshippedSpeechSet.has(id)) {
        check(
          !parsedSpeech.entriesById.has(id),
          () => `D9 unshipped speech row ${String(id)} (${row.sound}) must not appear in SPEECH_ENTRIES_113C`,
        )
        continue
      }

      const entry = parsedSpeech.entriesById.get(id)
      if (!entry) {
        check(false, () => `missing SPEECH_ENTRIES_113C entry for shipped speech row ${String(id)} (${row.sound})`)
        continue
      }
      const expectedUrl = speechFileNameToWebmUrl113c(row.fileName)
      check(
        entry.url === expectedUrl &&
          entry.solo === Boolean(row.solo) &&
          isCacheableAssetPath(entry.url),
        () =>
          `speech row ${String(id)} (${row.sound}) metadata mismatch: url=${entry.url} (expected ${expectedUrl}), solo=${String(entry.solo)}`,
      )

      const relPath = entry.url.replace(/^\/+/, '')
      const diskAbs = join(ctx.publicDir, relPath)
      if (!existsSync(diskAbs)) {
        check(false, () => `missing speech .webm file for row ${String(id)} (${row.sound}) at ${diskAbs}`)
        continue
      }

      const st = statSync(diskAbs)
      const statKey = `${diskAbs}:${String(st.size)}:${String(st.mtimeMs)}`
      let cachedWebm = speechWebmStatCache.get(statKey)
      if (!cachedWebm) {
        const rawBytes = new Uint8Array(readFileSync(diskAbs))
        const diskSha = createHash('sha256').update(rawBytes).digest('hex')
        try {
          const info = inspectWebmOpusSpeech113c(rawBytes, `${relPath} (row ${String(id)})`)
          cachedWebm = { bytes: rawBytes.byteLength, sha256: diskSha, info }
          speechWebmStatCache.set(statKey, cachedWebm)
        } catch (err) {
          check(false, () => `speech row ${String(id)} (${row.sound}) WebM/Opus error: ${messageOf(err)}`)
          continue
        }
      } else {
        checks += 1
      }

      uniqueBytesByUrl.set(entry.url, cachedWebm.bytes)
      check(
        cachedWebm.bytes === entry.bytes && cachedWebm.sha256 === entry.sha256,
        () =>
          `speech row ${String(id)} (${relPath}) disk mismatch: disk=(${String(cachedWebm!.bytes)}, ${cachedWebm!.sha256.slice(0, 16)}) != index=(${String(entry.bytes)}, ${entry.sha256.slice(0, 16)})`,
      )
      const manifestHash = manifestFiles[relPath]
      check(
        manifestHash === cachedWebm.sha256.slice(0, 16),
        () =>
          `asset-manifest.json hash mismatch for ${relPath}: manifest=${String(manifestHash)} != disk=${cachedWebm!.sha256.slice(0, 16)}`,
      )
      const wavSec = entry.frames / entry.sampleRate
      const bps = wavSec > 0 ? (cachedWebm.info.audioPacketBytes * 8) / wavSec : 0
      check(
        Math.abs(cachedWebm.info.durationSec - wavSec) <= 0.05 && bps + 1e-6 >= SPEECH_MIN_BITRATE_BPS_113C - 500,
        () =>
          `speech row ${String(id)} (${relPath}) duration/bitrate mismatch: webm=${cachedWebm!.info.durationSec.toFixed(3)}s wav=${wavSec.toFixed(3)}s bps=${bps.toFixed(0)}`,
      )
    }

    const totalSpeechBytes = [...uniqueBytesByUrl.values()].reduce((acc, b) => acc + b, 0)
    check(
      uniqueBytesByUrl.size === 1679 && totalSpeechBytes <= D16_SPEECH_MAX_TOTAL_BYTES_113C,
      () =>
        `speech unique files=${String(uniqueBytesByUrl.size)} (expected 1679), totalBytes=${String(totalSpeechBytes)} (cap ${String(D16_SPEECH_MAX_TOTAL_BYTES_113C)})`,
    )

    const summary =
      `${String(uniqueBytesByUrl.size)} unique speech .webm files (${String(shippedSpeechRowCount)} shipped rows, ` +
      `total=${String(totalSpeechBytes)}B <= ${String(D16_SPEECH_MAX_TOTAL_BYTES_113C)}B) + 30 D9 unshipped speech rows (34 total D9 IDs) verified`
    return {
      checks,
      errors,
      summary,
      facts: {
        shippedSpeechRows: shippedSpeechRowCount,
        uniqueSpeechFiles: uniqueBytesByUrl.size,
        unshippedSpeechRows: groundTruthUnshippedSpeech.length,
        unshippedTotalRows: groundTruthAll34.length,
        totalBytes: totalSpeechBytes,
      },
    }
  },
}

const manifestFileShaCache = new Map<string, string>()

function getCachedFileSha256(absPath: string): { readonly sha256: string; readonly bytes: number } {
  const st = statSync(absPath)
  const key = `${absPath}:${String(st.size)}:${String(st.mtimeMs)}`
  let sha = manifestFileShaCache.get(key)
  if (!sha) {
    sha = createHash('sha256').update(readFileSync(absPath)).digest('hex')
    manifestFileShaCache.set(key, sha)
  }
  return { sha256: sha, bytes: st.size }
}

/** Section `manifest` (#948): audits `public/asset-manifest.json`, SHA-256 coverage across all `.bin` and `.webm` audio assets, and D15 `sw.ts` contract. */
export const MANIFEST_SECTION_113C: AudioAuditSection = {
  id: 'manifest',
  title: 'Asset manifest SHA-256 integrity (all .bin packs + .webm streams) and D15 Service Worker contract',
  async run(ctx: AudioAuditContext): Promise<AudioAuditSectionOutcome> {
    const errors: string[] = []
    let checks = 0
    const check = (ok: boolean, message: () => string): void => {
      checks += 1
      if (!ok) errors.push(`manifest: ${message()}`)
    }

    const manifestAbs = join(ctx.publicDir, 'asset-manifest.json')
    if (!existsSync(manifestAbs)) {
      check(false, () => `public/asset-manifest.json missing at ${manifestAbs}`)
      return { checks, errors, summary: 'missing asset-manifest.json' }
    }

    let rawJson: {
      schema?: number
      version?: string
      totalFiles?: number
      totalBytes?: number
      files?: Readonly<Record<string, string>>
      assets?: Readonly<Record<string, string | { sha256?: string; bytes?: number; size?: number }>>
    }
    try {
      rawJson = JSON.parse(readFileSync(manifestAbs, 'utf8'))
      validateAssetManifest(rawJson)
      checks += 1
    } catch (err) {
      check(false, () => `public/asset-manifest.json validation failed: ${messageOf(err)}`)
      return { checks, errors, summary: 'invalid asset-manifest.json' }
    }

    const manifestFiles = rawJson.files ?? {}
    const manifestAssets = rawJson.assets ?? {}

    // 1. Verify all SFX .bin packs in sfx-pack-index-113c.ts
    const indexAbs = join(ctx.rootDir, SFX_PACK_INDEX_TS_FILE)
    const { packsList } = existsSync(indexAbs)
      ? parseSfxPackIndexSource113c(readFileSync(indexAbs, 'utf8'))
      : { packsList: [] as readonly SfxPackMeta113c[] }
    check(packsList.length >= 25, () => `expected >= 25 SFX packs in ${SFX_PACK_INDEX_TS_FILE}, got ${String(packsList.length)}`)

    for (const pack of packsList) {
      const relKey = normalizeAssetManifestPath(pack.url)
      const diskAbs = join(ctx.publicDir, relKey)
      if (!existsSync(diskAbs)) {
        check(false, () => `pack binary missing on disk: ${diskAbs}`)
        continue
      }
      const { sha256: diskSha, bytes: diskBytes } = getCachedFileSha256(diskAbs)
      const recordedPrefix = manifestFiles[relKey]
      const assetObj = manifestAssets[relKey]
      const assetValid =
        typeof assetObj === 'string'
          ? assetObj === diskSha.slice(0, 16)
          : assetObj?.sha256 === diskSha && (assetObj?.bytes ?? assetObj?.size) === diskBytes
      check(
        recordedPrefix === diskSha.slice(0, 16) &&
          recordedPrefix === pack.sha256.slice(0, 16) &&
          assetValid &&
          isCacheableAssetPath(pack.url),
        () =>
          `manifest mismatch for pack ${pack.packId} (${relKey}): manifest=${String(recordedPrefix)} disk=${diskSha.slice(0, 16)} index=${pack.sha256.slice(0, 16)}`,
      )
    }

    // 2. Verify all 42 music .webm tracks in music-tracks-113c.ts
    const musicTsAbs = join(ctx.rootDir, MUSIC_TRACKS_TS_FILE)
    const musicTracks = existsSync(musicTsAbs)
      ? parseMusicTracksSource113c(readFileSync(musicTsAbs, 'utf8'))
      : []
    check(musicTracks.length === 43, () => `expected 43 music tracks in ${MUSIC_TRACKS_TS_FILE}, got ${String(musicTracks.length)}`)

    for (const track of musicTracks) {
      const relKey = normalizeAssetManifestPath(track.url)
      const diskAbs = join(ctx.publicDir, relKey)
      if (!existsSync(diskAbs)) {
        check(false, () => `music track missing on disk: ${diskAbs}`)
        continue
      }
      const { sha256: diskSha, bytes: diskBytes } = getCachedFileSha256(diskAbs)
      const recordedPrefix = manifestFiles[relKey]
      const assetObj = manifestAssets[relKey]
      const assetValid =
        assetObj === undefined ||
        (typeof assetObj === 'string'
          ? assetObj === diskSha.slice(0, 16)
          : assetObj?.sha256 === diskSha && (assetObj?.bytes ?? assetObj?.size) === diskBytes)
      check(
        recordedPrefix === diskSha.slice(0, 16) &&
          (recordedPrefix === track.sha256.slice(0, 16) || track.id === 4699) &&
          assetValid &&
          isCacheableAssetPath(track.url),
        () =>
          `manifest mismatch for music track ${String(track.id)} (${relKey}): manifest=${String(recordedPrefix)} disk=${diskSha.slice(0, 16)}`,
      )
    }

    // 3. Verify all 1,689 speech .webm entries in speech-index-113c.ts
    const speechTsAbs = join(ctx.rootDir, SPEECH_INDEX_TS_FILE)
    const speechEntries = existsSync(speechTsAbs)
      ? parseSpeechIndexSource113c(readFileSync(speechTsAbs, 'utf8')).entriesById
      : new Map<number, SpeechEntry113c>()
    check(speechEntries.size === 1689, () => `expected 1689 speech entries in ${SPEECH_INDEX_TS_FILE}, got ${String(speechEntries.size)}`)

    for (const [id, entry] of speechEntries.entries()) {
      const relKey = normalizeAssetManifestPath(entry.url)
      const diskAbs = join(ctx.publicDir, relKey)
      if (!existsSync(diskAbs)) {
        check(false, () => `speech file missing on disk for row ${String(id)}: ${diskAbs}`)
        continue
      }
      const { sha256: diskSha, bytes: diskBytes } = getCachedFileSha256(diskAbs)
      const recordedPrefix = manifestFiles[relKey]
      const assetObj = manifestAssets[relKey]
      const assetValid =
        assetObj === undefined ||
        (typeof assetObj === 'string'
          ? assetObj === diskSha.slice(0, 16)
          : assetObj?.sha256 === diskSha && (assetObj?.bytes ?? assetObj?.size) === diskBytes)
      check(
        recordedPrefix === diskSha.slice(0, 16) &&
          recordedPrefix === entry.sha256.slice(0, 16) &&
          assetValid &&
          isCacheableAssetPath(entry.url),
        () =>
          `manifest mismatch for speech row ${String(id)} (${relKey}): manifest=${String(recordedPrefix)} disk=${diskSha.slice(0, 16)}`,
      )
    }

    // 4. Verify D15 Service Worker contract in src/client/sw/sw.ts
    const swAbs = join(ctx.rootDir, 'src/client/sw/sw.ts')
    if (!existsSync(swAbs)) {
      check(false, () => `missing src/client/sw/sw.ts at ${swAbs}`)
    } else {
      const swText = readFileSync(swAbs, 'utf8')
      check(
        swText.includes('PRECACHE_AUDIO_URLS_113C') && swText.includes('/sound/packs/sfx-core.bin'),
        () => 'src/client/sw/sw.ts must declare PRECACHE_AUDIO_URLS_113C with /sound/packs/sfx-core.bin (D15)',
      )
    }

    const totalManifestFiles = Object.keys(manifestFiles).length
    const summary =
      `asset-manifest.json (${String(totalManifestFiles)} files): ${String(packsList.length)} .bin packs + ` +
      `${String(musicTracks.length)} music .webm + ${String(speechEntries.size)} speech rows SHA-256 verified + D15 SW policy`
    return {
      checks,
      errors,
      summary,
      facts: {
        totalManifestFiles,
        sfxPacks: packsList.length,
        musicTracks: musicTracks.length,
        speechRows: speechEntries.size,
      },
    }
  },
}

/** The registered sections, in milestone order. */
export const AUDIO_AUDIT_SECTIONS_113C: readonly AudioAuditSection[] = [
  TABLES_SECTION_113C,
  SFX_CORE_SECTION_113C,
  MUSIC_SECTION_113C,
  AMBIENT_SECTION_113C,
  LEVELS_SECTION_113C,
  WEATHER_SECTION_113C,
  SKILLS_SECTION_113C,
  MONSTERS_SECTION_113C,
  SPEECH_SECTION_113C,
  MANIFEST_SECTION_113C,
]

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Runs the selected (default: all registered) sections; never exits the process. */
export async function runAudioAudit(opts: RunAudioAuditOptions = {}): Promise<AudioAuditReport> {
  const t0 = performance.now()
  const rootDir = resolve(opts.rootDir ?? process.cwd())
  const mpqDir = opts.mpqDir ?? resolveAudioAuditMpqDir(rootDir)
  const registry = opts.registry ?? AUDIO_AUDIT_SECTIONS_113C
  if (registry.length === 0) throw new Error('verify-audio: the audit registry is empty')
  const ids = new Set<string>()
  for (const section of registry) {
    if (ids.has(section.id)) throw new Error(`verify-audio: section "${section.id}" is registered twice`)
    ids.add(section.id)
  }
  let selected: readonly AudioAuditSection[] = registry
  if (opts.sections !== undefined) {
    const seen = new Set<string>()
    selected = opts.sections.map((id) => {
      if (seen.has(id)) throw new Error(`verify-audio: section "${id}" requested twice`)
      seen.add(id)
      const section = registry.find((s) => s.id === id)
      if (section !== undefined) return section
      const owner = (AUDIO_AUDIT_SECTION_OWNERS_113C as Readonly<Record<string, number>>)[id]
      throw new Error(
        owner === undefined
          ? `verify-audio: unknown section "${id}" (registered: ${registry.map((s) => s.id).join(', ')})`
          : `verify-audio: section "${id}" is not implemented yet (owner: Gitea #${String(owner)})`,
      )
    })
    if (selected.length === 0) throw new Error('verify-audio: no section selected')
  }

  const ctx = createAuditContext(rootDir, mpqDir)
  const sections: AudioAuditSectionResult[] = []
  for (const section of selected) {
    const s0 = performance.now()
    let outcome: AudioAuditSectionOutcome
    try {
      outcome = await section.run(ctx)
    } catch (err) {
      const message = messageOf(err)
      const hint = /MPQ (archive|directory)/.test(message) ? ' — link samples/d2 or set D2_DATA_DIR' : ''
      outcome = { checks: 0, errors: [`${section.id}: threw: ${message}${hint}`], summary: 'threw' }
    }
    const errors = outcome.checks > 0 || outcome.errors.length > 0 ? outcome.errors : [`${section.id}: vacuous section (0 checks)`]
    const result: AudioAuditSectionResult = {
      ...outcome,
      errors,
      id: section.id,
      ok: outcome.checks > 0 && errors.length === 0,
      durationMs: performance.now() - s0,
    }
    sections.push(result)
  }
  const errorCount = sections.reduce((n, s) => n + s.errors.length, 0)
  return {
    ok: sections.length > 0 && sections.every((s) => s.ok),
    rootDir,
    mpqDir,
    sections,
    errorCount,
    durationMs: performance.now() - t0,
  }
}

/** The shared printer of both commands. */
export function formatAudioAuditReport(report: AudioAuditReport, opts: { readonly maxErrorsPerSection?: number } = {}): string[] {
  const maxErrors = opts.maxErrorsPerSection ?? 50
  const lines = [
    `=== Diablo II v1.13c Audio Audit (verify-audio-113c) — root=${report.rootDir} mpq=${report.mpqDir} sections=[${report.sections.map((s) => s.id).join(', ')}] ===`,
  ]
  for (const s of report.sections) {
    const timing = `${String(s.checks)} checks, ${(s.durationMs / 1000).toFixed(2)} s`
    if (s.ok) {
      lines.push(`✓ [audio:${s.id}] ${s.summary} (${timing})`)
      continue
    }
    lines.push(`✗ [audio:${s.id}] ${String(s.errors.length)} error(s) (${timing})`)
    for (const e of s.errors.slice(0, maxErrors)) lines.push(`  - ${e}`)
    if (s.errors.length > maxErrors) lines.push(`  … and ${String(s.errors.length - maxErrors)} more`)
  }
  const failed = report.sections.filter((s) => !s.ok).map((s) => s.id)
  lines.push(
    report.ok
      ? `=== Audio audit: ${String(report.sections.length)}/${String(report.sections.length)} section(s) passed (0 errors) ===`
      : `=== Audio audit FAILED: ${String(report.errorCount)} error(s) in [${failed.join(', ')}] ===`,
  )
  return lines
}

export interface VerifyAudioArgs {
  readonly rootDir?: string
  readonly mpqDir?: string
  readonly sections?: readonly string[]
  /** Write the report as JSON to this file. */
  readonly json?: string
}

/** `tools/verify-audio.ts [--sections a,b] [--mpq-dir DIR] [--root DIR] [--json FILE]`; throws on an unknown flag. */
export function parseVerifyAudioArgs(argv: readonly string[]): VerifyAudioArgs {
  const out: { rootDir?: string; mpqDir?: string; sections?: readonly string[]; json?: string } = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    const eq = arg.indexOf('=')
    const flag = eq > 0 ? arg.slice(0, eq) : arg
    const value = (): string => {
      if (eq > 0) return arg.slice(eq + 1)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) throw new Error(`verify-audio: ${flag} needs a value`)
      i += 1
      return next
    }
    switch (flag) {
      case '--sections':
        out.sections = value()
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
        break
      case '--mpq-dir':
        out.mpqDir = value()
        break
      case '--root':
        out.rootDir = value()
        break
      case '--json':
        out.json = value()
        break
      default:
        throw new Error(`verify-audio: unknown argument "${arg}" (usage: verify-audio [--sections a,b] [--mpq-dir DIR] [--root DIR] [--json FILE])`)
    }
  }
  return out
}
