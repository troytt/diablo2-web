/**
 * Diablo II v1.13c Music & Quest Stinger Baker (`src/baker/packers/pack-music.ts` — Milestone M21 Phase P3, F12).
 *
 * Extracts all 42 music rows (`Sounds.txt` IDs `4657..4698`: 28 looping BGM tracks `4657..4684` +
 * 14 one-shot quest stingers `4685..4698`) from `d2music.mpq` and `D2xMusic.mpq`, validates their
 * RIFF PCM16 WAV headers (`22,050 Hz`), transcodes each track via system `/usr/bin/ffmpeg` (`libopus`,
 * hard CBR `64,000 bps` stereo `-vbr off -compression_level 10 -frame_duration 20 -application audio -ac 2 -f webm -bitexact`),
 * writes `public/sound/music/<subpath>.webm`, and emits the pure-TS track metadata table
 * `src/common/audio/music-tracks-113c.ts`.
 */

import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SOUNDS_113C,
  buildSoundMpqPath113c,
  type SoundsRow113c,
} from '../../common/audio/sounds-113c.ts'
import { parseWavPcm16 } from '../../common/formats/wav.ts'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { syncNodeFileSource } from '../mpq-archive-source.ts'
import {
  parsePackSfxCliArgs113c,
  probeFfmpegOpus113c,
  resolveFfmpegPath113c,
} from './pack-sfx.ts'

/** Minimum target & effective bitrate (`64,000 bps` = 64 kbps stereo Opus). */
export const MUSIC_MIN_BITRATE_BPS_113C = 64_000
/** Maximum size of any single `.webm` music asset (`4.5 MB` = `4,500,000 B`). */
export const MUSIC_MAX_TRACK_BYTES_113C = 4_500_000
/** Maximum aggregate size across all 42 `.webm` music assets (`72 MB` = `72,000,000 B`). */
export const MUSIC_MAX_TOTAL_BYTES_113C = 72_000_000

export const BGM_MIN_BITRATE_BPS_113C = MUSIC_MIN_BITRATE_BPS_113C
export const BGM_MAX_TRACK_BYTES_113C = MUSIC_MAX_TRACK_BYTES_113C
export const BGM_MAX_TOTAL_BYTES_113C = MUSIC_MAX_TOTAL_BYTES_113C

/** Canonical inclusive `Sounds.txt` index bounds for the 42 music rows. */
export const MUSIC_FIRST_SOUND_ID_113C = 4657
export const MUSIC_LAST_SOUND_ID_113C = 4698
export const MUSIC_EXPECTED_TRACK_COUNT_113C = 43

export const MUSIC_LOD_INTRO_SOUND_ID_113C = 4699

export interface MusicTrackInputRow113c {
  readonly id: number
  readonly sound: string
  readonly fileName: string
  readonly loop: boolean
  readonly musicVol: boolean
  readonly volume: number
  readonly fadeIn: number
  readonly fadeOut: number
  readonly block1: number
  readonly block2: number
  readonly block3: number
  readonly mpqInternalPath?: string | undefined
}

export const LOD_INTRO_EDIT_TRACK_ROW_113C: MusicTrackInputRow113c = Object.freeze({
  id: MUSIC_LOD_INTRO_SOUND_ID_113C,
  sound: 'music_lod_introedit',
  fileName: 'introedit.wav',
  mpqInternalPath: 'data\\global\\music\\introedit.wav',
  loop: true,
  musicVol: true,
  volume: 255,
  fadeIn: 0,
  fadeOut: 125,
  block1: 330529,
  block2: 1189156,
  block3: -1,
})

export type MusicArchiveName113c = 'd2music.mpq' | 'D2xMusic.mpq'

export interface BakedMusicTrackRecord113c {
  readonly id: number
  readonly sound: string
  readonly fileName: string
  readonly archive: MusicArchiveName113c
  readonly url: string
  readonly bytes: number
  readonly sha256: string
  readonly sampleRate: number
  readonly frames: number
  readonly channels: number
  readonly durationSeconds: number
  readonly loop: boolean
  readonly musicVol: boolean
  readonly volume: number
  readonly fadeIn: number
  readonly fadeOut: number
  readonly block1: number
  readonly block2: number
  readonly block3: number
  readonly nBlocks: number
  readonly block1Seconds: number
  readonly block2Seconds: number
  readonly block3Seconds: number
}

export interface MusicTranscodeOptions {
  readonly bitrate?: number | undefined
  readonly vbr?: 'off' | 'on' | 'constrained' | undefined
  readonly frameDurationMs?: 20 | 40 | 60 | undefined
  readonly ffmpegBin?: string | undefined
  readonly ffmpegPath?: string | undefined
}

export interface PackMusicOptions {
  readonly rootDir?: string | undefined
  readonly mpqDir?: string | undefined
  readonly outDir?: string | undefined
  readonly outTsPath?: string | undefined
  readonly ffmpegBin?: string | undefined
  readonly ffmpegPath?: string | undefined
  readonly bitrateBps?: number | undefined
  readonly concurrency?: number | undefined
}

export interface PackMusicSummary {
  readonly trackCount: number
  readonly loopingCount: number
  readonly stingerCount: number
  readonly totalBytes: number
  readonly maxTrackBytes: number
  readonly outDir: string
  readonly outTsPath: string
  readonly tracks: readonly BakedMusicTrackRecord113c[]
}

/**
 * Resolve the relative `.webm` path under `public/sound/music/` from a `Sounds.txt` `FileName`.
 * E.g. `Act1\town1.wav` -> `act1/town1.webm`.
 */
export function musicFileNameToRelWebmPath(fileName: string): string {
  const norm = fileName
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/\.wav$/i, '.webm')
  if (!norm.endsWith('.webm') || norm.length <= 5) {
    throw new Error(`Invalid music FileName "${fileName}"`)
  }
  return norm
}

/**
 * Deterministically transcode a raw RIFF PCM16 WAV buffer into an Opus-in-WebM stereo stream
 * via `/usr/bin/ffmpeg` (`libopus`, CBR `-vbr off`, `-bitexact`, `-ac 2`).
 */
export async function transcodeWavToOpusWebm(
  wav: Uint8Array,
  opts?: MusicTranscodeOptions,
): Promise<Uint8Array> {
  if (!(wav instanceof Uint8Array) || wav.byteLength < 44) {
    throw new Error(
      `transcodeWavToOpusWebm: invalid WAV buffer (byteLength=${wav instanceof Uint8Array ? wav.byteLength : 'not Uint8Array'})`,
    )
  }
  // Validate RIFF WAVE PCM16 header up front so corrupt / zeroed buffers fail fast before spawning ffmpeg.
  const wavHeader = parseWavPcm16(wav, 'transcodeWavToOpusWebm')
  if (wavHeader.frames <= 0 || wavHeader.sampleRate <= 0) {
    throw new Error(
      `transcodeWavToOpusWebm: WAV has non-positive frames (${wavHeader.frames}) or sampleRate (${wavHeader.sampleRate})`,
    )
  }

  const bitrate = opts?.bitrate ?? MUSIC_MIN_BITRATE_BPS_113C
  if (!Number.isFinite(bitrate) || bitrate < 6_000 || bitrate > 510_000) {
    throw new RangeError(
      `transcodeWavToOpusWebm: bitrate ${String(bitrate)} out of valid Opus range [6000, 510000]`,
    )
  }
  const vbr = opts?.vbr ?? 'off'
  const frameDuration = opts?.frameDurationMs ?? 20
  const ffmpegBin = resolveFfmpegPath113c(opts?.ffmpegBin ?? opts?.ffmpegPath)

  const args = [
    '-v',
    'error',
    '-nostdin',
    '-f',
    'wav',
    '-i',
    'pipe:0',
    '-map_metadata',
    '-1',
    '-vn',
    '-sn',
    '-dn',
    '-fflags',
    '+bitexact',
    '-flags:a',
    '+bitexact',
    '-c:a',
    'libopus',
    '-b:a',
    String(Math.floor(bitrate)),
    '-vbr',
    vbr,
    '-compression_level',
    '10',
    '-frame_duration',
    String(frameDuration),
    '-application',
    'audio',
    '-ac',
    '2',
    '-f',
    'webm',
    '-bitexact',
    'pipe:1',
  ]

  return await new Promise<Uint8Array>((resolve, reject) => {
    const proc = spawn(ffmpegBin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH ?? '/usr/bin:/bin',
        LC_ALL: 'C',
        TZ: 'UTC',
      },
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk)
    })
    proc.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk)
    })
    proc.on('error', (err) => {
      reject(new Error(`ffmpeg spawn failed (${ffmpegBin}): ${err.message}`))
    })
    proc.stdin.on('error', () => {
      // Handled by process close/stderr
    })
    proc.on('close', (code) => {
      if (code !== 0) {
        const stderrText = Buffer.concat(stderrChunks).toString('utf8').trim()
        reject(
          new Error(
            `ffmpeg exited with code ${String(code)}${stderrText ? `: ${stderrText}` : ''}`,
          ),
        )
        return
      }
      const outBuf = Buffer.concat(stdoutChunks)
      if (outBuf.byteLength < 64) {
        reject(new Error(`ffmpeg produced truncated WebM output (${outBuf.byteLength} bytes)`))
        return
      }
      // Verify EBML magic 0x1A 0x45 0xDF 0xA3
      if (
        outBuf[0] !== 0x1a ||
        outBuf[1] !== 0x45 ||
        outBuf[2] !== 0xdf ||
        outBuf[3] !== 0xa3
      ) {
        reject(new Error('ffmpeg output does not start with EBML magic 0x1A45DFA3'))
        return
      }
      resolve(new Uint8Array(outBuf.buffer, outBuf.byteOffset, outBuf.byteLength))
    })

    proc.stdin.end(Buffer.from(wav.buffer, wav.byteOffset, wav.byteLength))
  })
}

export const encodeMusicWavToWebm113c = transcodeWavToOpusWebm
export const transcodeMusicWav113c = transcodeWavToOpusWebm

async function resolveMusicArchive(
  mpqPath: string,
  classicMpq: MpqArchive,
  expansionMpq: MpqArchive,
): Promise<{ readonly archive: MusicArchiveName113c; readonly bytes: Uint8Array }> {
  const expFile = expansionMpq.find(mpqPath)
  if (expFile !== undefined) {
    return { archive: 'D2xMusic.mpq', bytes: await expansionMpq.read(expFile) }
  }
  const classicFile = classicMpq.find(mpqPath)
  if (classicFile !== undefined) {
    return { archive: 'd2music.mpq', bytes: await classicMpq.read(classicFile) }
  }
  throw new Error(
    `Music WAV "${mpqPath}" not found in D2xMusic.mpq or d2music.mpq`,
  )
}

function renderMusicTracksTsModule(tracks: readonly BakedMusicTrackRecord113c[]): string {
  const lines: string[] = [
    '/**',
    ' * Generated Diablo II v1.13c Music & Quest Stinger Track Metadata (`src/common/audio/music-tracks-113c.ts`).',
    ' *',
    ' * DO NOT EDIT BY HAND — regenerated deterministically by `npm run pack:music` (`src/baker/packers/pack-music.ts`).',
    ' * Ground truth: `Sounds.txt` rows `4657..4698` (`4657..4684` looping BGM + `4685..4698` quest stingers) + `D2xMusic.mpq` LoD intro edit (`4699`) + `d2music.mpq` / `D2xMusic.mpq` RIFF WAV headers.',
    ' */',
    '',
    '/** Minimum target & effective bitrate (`64,000 bps` = 64 kbps stereo Opus). */',
    'export const MUSIC_MIN_BITRATE_BPS_113C = 64000',
    '/** Maximum size of any single `.webm` music asset (`4.5 MB` = `4,500,000 B`). */',
    'export const MUSIC_MAX_TRACK_BYTES_113C = 4500000',
    '/** Maximum aggregate size across all 43 `.webm` music assets (`72 MB` = `72,000,000 B`). */',
    'export const MUSIC_MAX_TOTAL_BYTES_113C = 72000000',
    '',
    'export const BGM_MIN_BITRATE_BPS_113C = MUSIC_MIN_BITRATE_BPS_113C',
    'export const BGM_MAX_TRACK_BYTES_113C = MUSIC_MAX_TRACK_BYTES_113C',
    'export const BGM_MAX_TOTAL_BYTES_113C = MUSIC_MAX_TOTAL_BYTES_113C',
    '',
    "export type MusicArchiveName113c = 'd2music.mpq' | 'D2xMusic.mpq'",
    '',
    'export interface MusicTrackMeta113c {',
    '  readonly id: number',
    '  readonly sound: string',
    '  readonly fileName: string',
    '  readonly archive: MusicArchiveName113c',
    '  readonly url: string',
    '  readonly bytes: number',
    '  readonly sha256: string',
    '  readonly sampleRate: number',
    '  readonly frames: number',
    '  readonly channels: number',
    '  readonly durationSeconds: number',
    '  readonly loop: boolean',
    '  readonly musicVol: boolean',
    '  readonly volume: number',
    '  readonly fadeIn: number',
    '  readonly fadeOut: number',
    '  readonly block1: number',
    '  readonly block2: number',
    '  readonly block3: number',
    '  readonly nBlocks: number',
    '  readonly block1Seconds: number',
    '  readonly block2Seconds: number',
    '  readonly block3Seconds: number',
    '}',
    '',
    'export const MUSIC_TRACKS_113C: readonly MusicTrackMeta113c[] = Object.freeze([',
  ]

  for (const t of tracks) {
    lines.push('  Object.freeze({')
    lines.push(`    id: ${t.id},`)
    lines.push(`    sound: ${JSON.stringify(t.sound)},`)
    lines.push(`    fileName: ${JSON.stringify(t.fileName)},`)
    lines.push(`    archive: ${JSON.stringify(t.archive)},`)
    lines.push(`    url: ${JSON.stringify(t.url)},`)
    lines.push(`    bytes: ${t.bytes},`)
    lines.push(`    sha256: ${JSON.stringify(t.sha256)},`)
    lines.push(`    sampleRate: ${t.sampleRate},`)
    lines.push(`    frames: ${t.frames},`)
    lines.push(`    channels: ${t.channels},`)
    lines.push(`    durationSeconds: ${Number(t.durationSeconds.toFixed(6))},`)
    lines.push(`    loop: ${t.loop},`)
    lines.push(`    musicVol: ${t.musicVol},`)
    lines.push(`    volume: ${t.volume},`)
    lines.push(`    fadeIn: ${t.fadeIn},`)
    lines.push(`    fadeOut: ${t.fadeOut},`)
    lines.push(`    block1: ${t.block1},`)
    lines.push(`    block2: ${t.block2},`)
    lines.push(`    block3: ${t.block3},`)
    lines.push(`    nBlocks: ${t.nBlocks},`)
    lines.push(`    block1Seconds: ${t.block1Seconds < 0 ? -1 : Number(t.block1Seconds.toFixed(6))},`)
    lines.push(`    block2Seconds: ${t.block2Seconds < 0 ? -1 : Number(t.block2Seconds.toFixed(6))},`)
    lines.push(`    block3Seconds: ${t.block3Seconds < 0 ? -1 : Number(t.block3Seconds.toFixed(6))},`)
    lines.push('  }),')
  }

  lines.push('])')
  lines.push('')
  lines.push('export const MUSIC_TRACKS_BY_ID_113C: Readonly<Record<number, MusicTrackMeta113c>> = Object.freeze(')
  lines.push('  Object.fromEntries(MUSIC_TRACKS_113C.map((t) => [t.id, t])),')
  lines.push(')')
  lines.push('')
  lines.push('export function getMusicTrack113c(id: number): MusicTrackMeta113c | undefined {')
  lines.push('  return MUSIC_TRACKS_BY_ID_113C[id]')
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

/**
 * Bake all 42 `Sounds.txt` music rows (`4657..4698`) into `public/sound/music/<subpath>.webm`
 * and write `src/common/audio/music-tracks-113c.ts`.
 */
export async function packMusicTracks113c(opts?: PackMusicOptions): Promise<PackMusicSummary> {
  const probe = probeFfmpegOpus113c(opts?.ffmpegBin ?? opts?.ffmpegPath, 'music')
  const rootDir = path.resolve(opts?.rootDir ?? process.cwd())
  const mpqDir = path.resolve(rootDir, opts?.mpqDir ?? process.env.D2_DATA_DIR ?? 'samples/d2')
  const outDir = path.resolve(rootDir, opts?.outDir ?? 'public/sound/music')
  const outTsPath = path.resolve(rootDir, opts?.outTsPath ?? 'src/common/audio/music-tracks-113c.ts')
  const bitrateBps = opts?.bitrateBps ?? MUSIC_MIN_BITRATE_BPS_113C
  if (!Number.isFinite(bitrateBps) || bitrateBps < MUSIC_MIN_BITRATE_BPS_113C) {
    throw new Error(
      `packMusicTracks113c: bitrateBps ${String(bitrateBps)} is below minimum ${MUSIC_MIN_BITRATE_BPS_113C} bps`,
    )
  }

  const classicMpqPath = path.join(mpqDir, 'd2music.mpq')
  const expansionMpqPath = path.join(mpqDir, 'D2xMusic.mpq')
  if (!fs.existsSync(classicMpqPath)) {
    throw new Error(`Missing required MPQ archive: ${classicMpqPath}`)
  }
  if (!fs.existsSync(expansionMpqPath)) {
    throw new Error(`Missing required MPQ archive: ${expansionMpqPath}`)
  }

  const classicMpq = MpqArchive.openSync(syncNodeFileSource(classicMpqPath))
  const expansionMpq = MpqArchive.openSync(syncNodeFileSource(expansionMpqPath))

  const musicRows: MusicTrackInputRow113c[] = [
    ...SOUNDS_113C.filter(
      (r) => r.id >= MUSIC_FIRST_SOUND_ID_113C && r.id <= MUSIC_LAST_SOUND_ID_113C,
    ).sort((a, b) => a.id - b.id),
    LOD_INTRO_EDIT_TRACK_ROW_113C,
  ]
  if (musicRows.length !== MUSIC_EXPECTED_TRACK_COUNT_113C) {
    throw new Error(
      `Expected ${MUSIC_EXPECTED_TRACK_COUNT_113C} music rows, got ${musicRows.length}`,
    )
  }

  fs.mkdirSync(outDir, { recursive: true })
  fs.mkdirSync(path.dirname(outTsPath), { recursive: true })

  const concurrency = Math.max(1, Math.min(8, opts?.concurrency ?? 4))
  const results = new Array<BakedMusicTrackRecord113c>(musicRows.length)
  let nextIdx = 0

  const worker = async (): Promise<void> => {
    while (true) {
      const idx = nextIdx++
      if (idx >= musicRows.length) return
      const row = musicRows[idx]!
      const mpqPath = row.mpqInternalPath ?? buildSoundMpqPath113c(row.id)
      if (!mpqPath) {
        throw new Error(`Music row ${row.id} (${row.sound}) returned null MPQ path`)
      }
      const { archive, bytes: wavBytes } = await resolveMusicArchive(
        mpqPath,
        classicMpq,
        expansionMpq,
      )
      const wavHeader = parseWavPcm16(wavBytes, `${mpqPath} (row ${row.id})`)
      if (wavHeader.sampleRate !== 22_050) {
        throw new Error(
          `Music row ${row.id} (${row.sound}): expected 22050 Hz WAV, got ${wavHeader.sampleRate} Hz`,
        )
      }
      if (wavHeader.frames <= 0) {
        throw new Error(
          `Music row ${row.id} (${row.sound}): non-positive frame count ${wavHeader.frames}`,
        )
      }
      for (const [bName, bVal] of [
        ['block1', row.block1],
        ['block2', row.block2],
        ['block3', row.block3],
      ] as const) {
        if (bVal >= 0 && bVal >= wavHeader.frames) {
          throw new Error(
            `Music row ${row.id} (${row.sound}): ${bName}=${bVal} >= frames=${wavHeader.frames}`,
          )
        }
      }

      const webmBytes = await transcodeWavToOpusWebm(wavBytes, {
        bitrate: bitrateBps,
        vbr: 'off',
        frameDurationMs: 20,
        ffmpegBin: probe.ffmpegPath,
      })

      if (webmBytes.byteLength > MUSIC_MAX_TRACK_BYTES_113C) {
        throw new Error(
          `Music row ${row.id} (${row.sound}) size ${webmBytes.byteLength} B exceeds per-track cap ${MUSIC_MAX_TRACK_BYTES_113C} B`,
        )
      }

      const relWebm = musicFileNameToRelWebmPath(row.fileName)
      const diskPath = path.join(outDir, relWebm)
      fs.mkdirSync(path.dirname(diskPath), { recursive: true })
      fs.writeFileSync(diskPath, webmBytes)

      const sha256 = crypto.createHash('sha256').update(webmBytes).digest('hex')
      const durationSeconds = wavHeader.frames / wavHeader.sampleRate
      const validBlocks = [row.block1, row.block2, row.block3].filter(
        (b) => b >= 0 && b < wavHeader.frames,
      )

      results[idx] = {
        id: row.id,
        sound: row.sound,
        fileName: row.fileName,
        archive,
        url: `/sound/music/${relWebm}`,
        bytes: webmBytes.byteLength,
        sha256,
        sampleRate: wavHeader.sampleRate,
        frames: wavHeader.frames,
        channels: 2,
        durationSeconds,
        loop: row.loop,
        musicVol: row.musicVol,
        volume: row.volume,
        fadeIn: row.fadeIn,
        fadeOut: row.fadeOut,
        block1: row.block1,
        block2: row.block2,
        block3: row.block3,
        nBlocks: validBlocks.length,
        block1Seconds: row.block1 >= 0 ? row.block1 / wavHeader.sampleRate : -1,
        block2Seconds: row.block2 >= 0 ? row.block2 / wavHeader.sampleRate : -1,
        block3Seconds: row.block3 >= 0 ? row.block3 / wavHeader.sampleRate : -1,
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  let totalBytes = 0
  let maxTrackBytes = 0
  let loopingCount = 0
  let stingerCount = 0
  for (const r of results) {
    totalBytes += r.bytes
    if (r.bytes > maxTrackBytes) maxTrackBytes = r.bytes
    if (r.loop) loopingCount += 1
    else stingerCount += 1
  }

  if (totalBytes > MUSIC_MAX_TOTAL_BYTES_113C) {
    throw new Error(
      `Total music size ${totalBytes} B exceeds aggregate cap ${MUSIC_MAX_TOTAL_BYTES_113C} B`,
    )
  }

  const tsContent = renderMusicTracksTsModule(results)
  fs.writeFileSync(outTsPath, tsContent, 'utf8')

  return {
    trackCount: results.length,
    loopingCount,
    stingerCount,
    totalBytes,
    maxTrackBytes,
    outDir,
    outTsPath,
    tracks: results,
  }
}

export const packMusic = packMusicTracks113c
export const bakeMusic = packMusicTracks113c

async function main(): Promise<void> {
  const t0 = performance.now()
  const cliOpts = parsePackSfxCliArgs113c(process.argv.slice(2))
  const summary = await packMusicTracks113c({ ffmpegBin: cliOpts.ffmpegPath })
  const elapsedSec = ((performance.now() - t0) / 1000).toFixed(2)
  console.log(
    `[pack-music] Baked ${summary.trackCount} tracks (${summary.loopingCount} looping BGM + ${summary.stingerCount} quest stingers), ` +
      `total=${(summary.totalBytes / (1024 * 1024)).toFixed(2)} MB, maxTrack=${(summary.maxTrackBytes / (1024 * 1024)).toFixed(2)} MB in ${elapsedSec}s`,
  )
}

const isDirectEntry =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isDirectEntry) {
  main().catch((err) => {
    console.error('[pack-music] Fatal error:', err)
    process.exit(1)
  })
}
