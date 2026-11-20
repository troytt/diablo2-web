/**
 * Diablo II v1.13c Core SFX Opus Pack Baker (`src/baker/packers/pack-sfx.ts`, #944 F7).
 *
 * Extracts the 653 core `Stream = 0` `Sounds.txt` rows (627 unique WAVs) from the 1.13c MPQ
 * chain (`AUDIO_ARCHIVE_LOAD_ORDER_113C`), parses source PCM16 facts via `parseWavPcm16`,
 * transcodes each unique WAV to hard-CBR Ogg Opus (`-vbr off -frame_duration 20 -bitexact`,
 * 24 kbps mono / 40 kbps stereo), packs them into `D2SP` v2 binary containers under
 * `public/sound/packs/sfx-core{,-2,-3}.bin`, and emits `src/common/audio/sfx-pack-index-113c.ts`.
 */

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  SOUNDS_113C,
  buildSoundMpqPath113c,
  type SoundsRow113c,
} from '../../common/audio/sounds-113c.ts'
import type {
  SfxPackEntry113c,
  SfxPackMeta113c,
  SfxPackTier113c,
  SfxPackTuple113c,
} from '../../common/audio/sfx-pack-index-113c.ts'
import { parseWavPcm16, type WavPcm16 } from '../../common/formats/wav.ts'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { AUDIO_ARCHIVE_LOAD_ORDER_113C, resolveAudioAuditMpqDir } from '../audit/verify-audio-113c.ts'
import { syncNodeFileSource } from '../mpq-archive-source.ts'

export const SFX_PACK_HEADER_MAGIC_113C = 'D2SP'
export const SFX_PACK_HEADER_VERSION_113C = 2
export const SFX_PACK_HEADER_BYTES_113C = 12

export const SFX_MONO_BITRATE_113C = 24_000
export const SFX_STEREO_BITRATE_113C = 40_000
export const SFX_OPUS_FRAME_DURATION_MS_113C = 20

export const SFX_PACK_INDEX_TS_FILE = 'src/common/audio/sfx-pack-index-113c.ts'

export interface CoreSfxPackSpec113c {
  readonly packId: 'sfx-core' | 'sfx-core-2' | 'sfx-core-3'
  readonly tier: SfxPackTier113c
  readonly relPath: string
  readonly url: string
  readonly maxBytes: number
  readonly prefixes: readonly string[]
}

export const SFX_PACK_LAYOUT_113C: readonly CoreSfxPackSpec113c[] = [
  {
    packId: 'sfx-core',
    tier: 'first-screen',
    relPath: 'sound/packs/sfx-core.bin',
    url: '/sound/packs/sfx-core.bin',
    maxBytes: 800_000,
    prefixes: ['cursor\\', 'item\\', 'combat\\', 'ambient\\footstep\\'],
  },
  {
    packId: 'sfx-core-2',
    tier: 'background',
    relPath: 'sound/packs/sfx-core-2.bin',
    url: '/sound/packs/sfx-core-2.bin',
    maxBytes: 890_000,
    prefixes: ['object\\'],
  },
  {
    packId: 'sfx-core-3',
    tier: 'background',
    relPath: 'sound/packs/sfx-core-3.bin',
    url: '/sound/packs/sfx-core-3.bin',
    maxBytes: 890_000,
    prefixes: ['quest\\', 'ambient\\creature\\'],
  },
] as const

export const CORE_SFX_PACK_SPECS_113C = SFX_PACK_LAYOUT_113C

export const DEFAULT_FFMPEG_PATH_113C = '/usr/bin/ffmpeg'
export const FFMPEG_ENV_VAR_113C = 'FFMPEG_PATH'
export const MIN_RECOMMENDED_FFMPEG_MAJOR_113C = 7
export const SFX_FFMPEG_OPUS_ARGS_SUMMARY_113C =
  '-c:a libopus -b:a <24000|40000> -vbr off -compression_level 10 -frame_duration 20 -application audio -f ogg -bitexact'

export interface TranscodeWavToOpusOptions {
  readonly bitrate?: number | undefined
  readonly vbr?: 'off' | 'on' | 'constrained' | undefined
  readonly frameDuration?: 2.5 | 5 | 10 | 20 | 40 | 60 | undefined
  readonly compressionLevel?: number | undefined
  readonly ffmpegPath?: string | undefined
}

export interface FfmpegProbeResult113c {
  readonly ffmpegPath: string
  readonly versionLine: string
  readonly majorVersion: number | null
  readonly hasLibopus: boolean
}

/**
 * Resolves the `ffmpeg` binary path with priority:
 * 1. Explicit code/CLI `ffmpegPath` option
 * 2. `FFMPEG_PATH` environment variable
 * 3. Default `/usr/bin/ffmpeg`
 */
export function resolveFfmpegPath113c(
  explicitPath?: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (typeof explicitPath === 'string' && explicitPath.trim().length > 0) {
    return explicitPath.trim()
  }
  const envVal = env[FFMPEG_ENV_VAR_113C]
  if (typeof envVal === 'string' && envVal.trim().length > 0) {
    return envVal.trim()
  }
  return DEFAULT_FFMPEG_PATH_113C
}

/**
 * Parses `--ffmpeg <path>` / `--ffmpeg=<path>` (or `--ffmpeg-path`) from CLI arguments.
 */
export function parsePackSfxCliArgs113c(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): { readonly ffmpegPath?: string | undefined } {
  let explicit: string | undefined
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    if (arg === '--ffmpeg' || arg === '--ffmpeg-path') {
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--') || next.trim().length === 0) {
        throw new Error(`pack-sfx: ${arg} requires a non-empty path argument`)
      }
      explicit = next.trim()
      i += 1
      continue
    }
    if (arg.startsWith('--ffmpeg=') || arg.startsWith('--ffmpeg-path=')) {
      const eq = arg.indexOf('=')
      const val = arg.slice(eq + 1).trim()
      if (val.length === 0) {
        throw new Error(`pack-sfx: ${arg.slice(0, eq)} requires a non-empty path argument`)
      }
      explicit = val
    }
  }
  const resolved = resolveFfmpegPath113c(explicit, env)
  return explicit !== undefined || env[FFMPEG_ENV_VAR_113C]?.trim()
    ? { ffmpegPath: resolved }
    : {}
}

function formatMissingFfmpegError(ffmpegBin: string, reason: string, targetName = 'sfx'): string {
  return (
    `${targetName} 目标需要 ffmpeg（含 libopus 编码器，建议版本 >= ${String(MIN_RECOMMENDED_FFMPEG_MAJOR_113C)}.0）：` +
    `未找到或无法执行 ${ffmpegBin}（${reason}）。` +
    `请安装 ffmpeg（如 sudo apt-get install -y ffmpeg）或设置环境变量 ${FFMPEG_ENV_VAR_113C}=/path/to/ffmpeg` +
    `（或传入 CLI 参数 --ffmpeg <path>），详见 README.md / src/baker/README.md。` +
    ` (ffmpeg spawn failed: ${reason})`
  )
}

/**
 * Probes `ffmpeg` up front to verify the binary exists, executes cleanly, and includes `libopus`.
 * Throws an actionable error message when `ffmpeg` is missing or lacks `libopus`.
 */
export function probeFfmpegOpus113c(
  explicitPath?: string | undefined,
  targetName = 'sfx',
  env: NodeJS.ProcessEnv = process.env,
): FfmpegProbeResult113c {
  const ffmpegPath = resolveFfmpegPath113c(explicitPath, env)
  const res = spawnSync(ffmpegPath, ['-version'], {
    encoding: 'utf8',
    timeout: 10_000,
  })
  if (res.error) {
    throw new Error(formatMissingFfmpegError(ffmpegPath, res.error.message, targetName))
  }
  if (res.status !== 0) {
    const stderr = (res.stderr ?? '').trim()
    throw new Error(
      formatMissingFfmpegError(
        ffmpegPath,
        `exit code ${String(res.status)}${stderr ? `: ${stderr}` : ''}`,
        targetName,
      ),
    )
  }
  const stdout = res.stdout ?? ''
  const versionLine = stdout.split(/\r?\n/)[0]?.trim() || 'ffmpeg (unknown version)'
  const versionMatch = /ffmpeg version\s+[nN]?(\d+)\.(\d+)/.exec(versionLine)
  const majorVersion = versionMatch ? Number(versionMatch[1]) : null

  let hasLibopus = /--enable-libopus\b/.test(stdout)
  if (!hasLibopus) {
    const encRes = spawnSync(ffmpegPath, ['-hide_banner', '-encoders'], {
      encoding: 'utf8',
      timeout: 10_000,
    })
    hasLibopus = encRes.status === 0 && /^\s*A\S+\s+libopus\b/m.test(encRes.stdout ?? '')
  }
  if (!hasLibopus) {
    throw new Error(
      `${targetName} 目标需要 ffmpeg（含 libopus 编码器）：当前 ${ffmpegPath}（${versionLine}）未启用 libopus。` +
        `请安装支持 libopus 的 ffmpeg（建议 >= ${String(MIN_RECOMMENDED_FFMPEG_MAJOR_113C)}.0）或通过 ${FFMPEG_ENV_VAR_113C} / --ffmpeg 指定路径，详见 README.md / src/baker/README.md。`,
    )
  }

  return {
    ffmpegPath,
    versionLine,
    majorVersion,
    hasLibopus,
  }
}

/**
 * Safely returns a single-line summary of the active `ffmpeg` binary and its `-version` header
 * for audit diagnostic messages (`verify-audio-113c.ts`). Never throws.
 */
export function getFfmpegVersionSummary113c(
  explicitPath?: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const ffmpegPath = resolveFfmpegPath113c(explicitPath, env)
  try {
    const res = spawnSync(ffmpegPath, ['-version'], {
      encoding: 'utf8',
      timeout: 5_000,
    })
    if (res.error) {
      return `ffmpeg=${JSON.stringify(ffmpegPath)} (unavailable: ${res.error.message})`
    }
    if (res.status !== 0) {
      return `ffmpeg=${JSON.stringify(ffmpegPath)} (exit ${String(res.status)})`
    }
    const firstLine = (res.stdout ?? '').split(/\r?\n/)[0]?.trim() || 'unknown version'
    return `ffmpeg=${JSON.stringify(ffmpegPath)} (${firstLine})`
  } catch (err) {
    return `ffmpeg=${JSON.stringify(ffmpegPath)} (${err instanceof Error ? err.message : String(err)})`
  }
}

export function normalizeSoundFileName113c(fileName: string): string {
  return fileName.trim().toLowerCase().replace(/\//g, '\\')
}

export function resolveCoreSfxPackSpec113c(fileName: string): CoreSfxPackSpec113c | undefined {
  const norm = normalizeSoundFileName113c(fileName)
  if (norm === '' || norm === 'none.wav') return undefined
  for (const spec of SFX_PACK_LAYOUT_113C) {
    if (spec.prefixes.some((prefix) => norm.startsWith(prefix))) {
      return spec
    }
  }
  return undefined
}

function buildFfmpegOpusArgs(bitrate: number, options?: TranscodeWavToOpusOptions): string[] {
  const vbr = options?.vbr ?? 'off'
  const frameDuration = options?.frameDuration ?? SFX_OPUS_FRAME_DURATION_MS_113C
  const compressionLevel = options?.compressionLevel ?? 10
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    'pipe:0',
    '-c:a',
    'libopus',
    '-b:a',
    String(bitrate),
    '-vbr',
    vbr,
    '-compression_level',
    String(compressionLevel),
    '-frame_duration',
    String(frameDuration),
    '-application',
    'audio',
    '-f',
    'ogg',
    '-bitexact',
    'pipe:1',
  ]
}

export function patchOpusHeadInputSampleRate(oggBytes: Uint8Array, inputSampleRate: number): Uint8Array {
  const out = new Uint8Array(oggBytes)
  if (out.byteLength < 47) return out
  const nseg = out[26]!
  const bodyStart = 27 + nseg
  if (bodyStart + 19 > out.byteLength) return out
  let bodyLen = 0
  for (let i = 0; i < nseg; i += 1) bodyLen += out[27 + i]!
  const pageEnd = bodyStart + bodyLen
  if (pageEnd > out.byteLength) return out
  const headMagic = String.fromCharCode(...out.subarray(bodyStart, bodyStart + 8))
  if (headMagic !== 'OpusHead') return out
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength)
  if (dv.getUint32(bodyStart + 12, true) === inputSampleRate) return out
  dv.setUint32(bodyStart + 12, inputSampleRate >>> 0, true)
  const crc = oggCrc32(out.subarray(0, pageEnd))
  dv.setUint32(22, crc, true)
  return out
}

/**
 * Transcodes a 16-bit PCM WAV buffer into a deterministic hard-CBR Ogg Opus stream.
 */
export function transcodeWavToOpusOgg(
  wavBytes: Uint8Array,
  options?: TranscodeWavToOpusOptions,
): Uint8Array {
  if (!(wavBytes instanceof Uint8Array) || wavBytes.byteLength === 0) {
    throw new Error('transcodeWavToOpusOgg: wavBytes must be a non-empty Uint8Array')
  }
  if (options?.vbr !== undefined && options.vbr !== 'off') {
    throw new Error(`transcodeWavToOpusOgg: vbr must be "off" (hard CBR is required), got ${JSON.stringify(options.vbr)}`)
  }
  const wavInfo = parseWavPcm16(wavBytes, 'transcodeWavToOpusOgg input')
  const defaultBitrate = wavInfo.channels === 2 ? SFX_STEREO_BITRATE_113C : SFX_MONO_BITRATE_113C
  const bitrate = options?.bitrate ?? defaultBitrate
  if (!Number.isInteger(bitrate) || bitrate <= 0) {
    throw new Error(`transcodeWavToOpusOgg: invalid bitrate ${String(bitrate)}`)
  }
  const ffmpegBin = resolveFfmpegPath113c(options?.ffmpegPath)
  const args = buildFfmpegOpusArgs(bitrate, options)
  const res = spawnSync(ffmpegBin, args, {
    input: wavBytes,
    maxBuffer: 32 * 1024 * 1024,
  })
  if (res.error) {
    throw new Error(`transcodeWavToOpusOgg: ${formatMissingFfmpegError(ffmpegBin, res.error.message, 'sfx')}`)
  }
  if (res.status !== 0) {
    const stderr = res.stderr ? Buffer.from(res.stderr).toString('utf8').trim() : ''
    throw new Error(`transcodeWavToOpusOgg: ffmpeg exited with ${String(res.status)}: ${stderr}`)
  }
  const out = new Uint8Array(res.stdout.buffer, res.stdout.byteOffset, res.stdout.byteLength)
  if (out.byteLength < 4 || out[0] !== 0x4f || out[1] !== 0x67 || out[2] !== 0x67 || out[3] !== 0x53) {
    throw new Error('transcodeWavToOpusOgg: output does not start with OggS capture pattern')
  }
  return new Uint8Array(out)
}

export function transcodeWavToOpusOggAsync(
  wavBytes: Uint8Array,
  bitrate: number,
  ffmpegBin = resolveFfmpegPath113c(),
): Promise<Uint8Array> {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = buildFfmpegOpusArgs(bitrate)
    const child = spawn(ffmpegBin, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
    child.on('error', (err) => rejectPromise(new Error(formatMissingFfmpegError(ffmpegBin, err.message, 'sfx'))))
    child.on('close', (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trim()
        rejectPromise(new Error(`ffmpeg exited with ${String(code)}: ${stderr}`))
        return
      }
      const buf = Buffer.concat(stdoutChunks)
      resolvePromise(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength))
    })
    child.stdin.on('error', () => {
      // Handled by close/stderr if ffmpeg exits early
    })
    child.stdin.end(wavBytes)
  })
}

/**
 * Packs an ordered list of unique Ogg Opus chunks into a `D2SP` v2 binary container (12-byte header).
 */
export function encodeSfxPackBinary113c(chunks: readonly Uint8Array[]): {
  readonly bytes: Uint8Array
  readonly offsets: readonly number[]
} {
  let payloadBytes = 0
  const offsets: number[] = []
  for (const chunk of chunks) {
    offsets.push(SFX_PACK_HEADER_BYTES_113C + payloadBytes)
    payloadBytes += chunk.byteLength
  }
  const out = new Uint8Array(SFX_PACK_HEADER_BYTES_113C + payloadBytes)
  out[0] = 0x44 // 'D'
  out[1] = 0x32 // '2'
  out[2] = 0x53 // 'S'
  out[3] = 0x50 // 'P'
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength)
  dv.setUint32(4, SFX_PACK_HEADER_VERSION_113C, true)
  dv.setUint32(8, chunks.length, true)
  for (let i = 0; i < chunks.length; i += 1) {
    out.set(chunks[i]!, offsets[i]!)
  }
  return { bytes: out, offsets }
}

export function parseSfxPackHeader113c(
  bytes: Uint8Array,
  what = 'sfx-pack',
): { readonly magic: string; readonly version: number; readonly chunkCount: number } {
  if (bytes.byteLength < SFX_PACK_HEADER_BYTES_113C) {
    throw new Error(`${what}: truncated D2SP header (${String(bytes.byteLength)} < ${String(SFX_PACK_HEADER_BYTES_113C)} bytes)`)
  }
  const magic = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)
  if (magic !== SFX_PACK_HEADER_MAGIC_113C) {
    throw new Error(`${what}: bad magic ${JSON.stringify(magic)}, expected ${JSON.stringify(SFX_PACK_HEADER_MAGIC_113C)}`)
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const version = dv.getUint32(4, true)
  if (version !== SFX_PACK_HEADER_VERSION_113C) {
    throw new Error(`${what}: unsupported D2SP version ${String(version)}, expected ${String(SFX_PACK_HEADER_VERSION_113C)}`)
  }
  const chunkCount = dv.getUint32(8, true)
  return { magic, version, chunkCount }
}

// ── Ogg Opus verifier (CRC-32, OpusHead, OpusTags, packet sizes, 48k sample counts) ─────────────

const OGG_CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let r = i << 24
    for (let b = 0; b < 8; b += 1) {
      r = (r & 0x80000000) !== 0 ? ((r << 1) ^ 0x04c11db7) >>> 0 : (r << 1) >>> 0
    }
    t[i] = r >>> 0
  }
  return t
})()

function oggCrc32(page: Uint8Array): number {
  let crc = 0
  for (let i = 0; i < page.length; i += 1) {
    const byte = i >= 22 && i < 26 ? 0 : page[i]!
    crc = (((crc << 8) >>> 0) ^ OGG_CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]!) >>> 0
  }
  return crc >>> 0
}

const OPUS_FRAME_TENTHS_MS: readonly number[] = [
  100, 200, 400, 600, 100, 200, 400, 600, 100, 200, 400, 600,
  100, 200, 100, 200,
  25, 50, 100, 200, 25, 50, 100, 200, 25, 50, 100, 200, 25, 50, 100, 200,
]

export function opusPacketSamples48k113c(p: Uint8Array, what: string): number {
  if (p.length < 1) throw new Error(`${what}: empty Opus packet`)
  const toc = p[0]!
  const tenths = OPUS_FRAME_TENTHS_MS[toc >> 3]!
  const code = toc & 3
  let frames: number
  if (code === 0) frames = 1
  else if (code === 1 || code === 2) frames = 2
  else {
    if (p.length < 2) throw new Error(`${what}: code-3 Opus packet without a frame-count byte`)
    frames = p[1]! & 0x3f
    if (frames === 0) throw new Error(`${what}: code-3 Opus packet with 0 frames`)
  }
  if (frames * tenths > 1200) throw new Error(`${what}: Opus packet longer than 120 ms`)
  return (frames * tenths * 48) / 10
}

export interface OggOpusChunkFacts113c {
  readonly pages: number
  readonly channels: number
  readonly preSkip: number
  readonly inputSampleRate: number
  readonly audioPackets: number
  readonly audioPacketBytes: number
  readonly audioPacketSizes: readonly number[]
  readonly audioPacketSamples48k: readonly number[]
  readonly finalGranule: number
  readonly decodedSeconds: number
  readonly eos: boolean
}

export function inspectOggOpusChunk113c(bytes: Uint8Array, what: string): OggOpusChunkFacts113c {
  if (bytes.length < 47) throw new Error(`${what}: too short for Ogg Opus (${String(bytes.length)} bytes)`)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 0
  let pages = 0
  const serials = new Set<number>()
  const packets: number[] = []
  const samples: number[] = []
  let open = false
  let firstPacket: Uint8Array | null = null
  let secondPacket: Uint8Array | null = null
  let packetBuf: number[] = []
  let finalGranule = 0
  let eos = false

  while (at < bytes.length) {
    if (at + 27 > bytes.length) throw new Error(`${what}: truncated Ogg page header at ${String(at)}`)
    const magic = String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!)
    if (magic !== 'OggS') throw new Error(`${what}: expected OggS at ${String(at)}, got ${JSON.stringify(magic)}`)
    if (bytes[at + 4] !== 0) throw new Error(`${what}: unsupported Ogg version ${String(bytes[at + 4])}`)
    const flags = bytes[at + 5]!
    if (pages === 0 && (flags & 0x02) === 0) throw new Error(`${what}: first Ogg page is missing BOS flag`)
    if (pages > 0 && (flags & 0x02) !== 0) throw new Error(`${what}: unexpected BOS flag on page ${String(pages)}`)
    if (eos) throw new Error(`${what}: trailing page after EOS`)
    if ((flags & 0x04) !== 0) eos = true
    const gLo = dv.getUint32(at + 6, true)
    const gHi = dv.getInt32(at + 10, true)
    const serial = dv.getUint32(at + 14, true)
    serials.add(serial)
    const storedCrc = dv.getUint32(at + 22, true)
    const segCount = bytes[at + 26]!
    const segEnd = at + 27 + segCount
    if (segEnd > bytes.length) throw new Error(`${what}: truncated Ogg segment table at ${String(at)}`)
    let bodyLen = 0
    for (let i = 0; i < segCount; i += 1) bodyLen += bytes[at + 27 + i]!
    const pageEnd = segEnd + bodyLen
    if (pageEnd > bytes.length) throw new Error(`${what}: truncated Ogg page body at ${String(at)}`)
    const computedCrc = oggCrc32(bytes.subarray(at, pageEnd))
    if (computedCrc !== storedCrc) {
      throw new Error(`${what}: Ogg page ${String(pages)} CRC mismatch (stored 0x${storedCrc.toString(16)}, computed 0x${computedCrc.toString(16)})`)
    }
    let bodyAt = segEnd
    for (let i = 0; i < segCount; i += 1) {
      const lace = bytes[at + 27 + i]!
      for (let b = 0; b < lace; b += 1) packetBuf.push(bytes[bodyAt + b]!)
      bodyAt += lace
      open = lace === 255
      if (!open) {
        const p = Uint8Array.from(packetBuf)
        if (firstPacket === null) firstPacket = p
        else if (secondPacket === null) secondPacket = p
        else {
          packets.push(p.length)
          samples.push(opusPacketSamples48k113c(p, `${what} packet ${String(packets.length)}`))
        }
        packetBuf = []
      }
    }
    if (!(gLo === 0xffffffff && gHi === -1)) finalGranule = gHi * 0x1_0000_0000 + gLo
    pages += 1
    at = pageEnd
  }

  if (open) throw new Error(`${what}: unterminated Ogg packet at end of stream`)
  if (!eos) throw new Error(`${what}: Ogg stream missing EOS flag`)
  if (serials.size !== 1) throw new Error(`${what}: expected 1 logical Ogg bitstream, found ${String(serials.size)}`)
  if (firstPacket === null || firstPacket.length < 19) throw new Error(`${what}: missing or short OpusHead`)
  const headMagic = String.fromCharCode(...firstPacket.subarray(0, 8))
  if (headMagic !== 'OpusHead') throw new Error(`${what}: first packet is ${JSON.stringify(headMagic)}, expected OpusHead`)
  if (firstPacket[8] !== 1) throw new Error(`${what}: unsupported OpusHead version ${String(firstPacket[8])}`)
  if (secondPacket === null || secondPacket.length < 8) throw new Error(`${what}: missing or short OpusTags`)
  const tagsMagic = String.fromCharCode(...secondPacket.subarray(0, 8))
  if (tagsMagic !== 'OpusTags') throw new Error(`${what}: second packet is ${JSON.stringify(tagsMagic)}, expected OpusTags`)
  if (packets.length === 0) throw new Error(`${what}: Ogg Opus stream has 0 audio packets`)

  const head = new DataView(firstPacket.buffer, firstPacket.byteOffset, firstPacket.byteLength)
  const channels = firstPacket[9]!
  const preSkip = head.getUint16(10, true)
  const inputSampleRate = head.getUint32(12, true)
  return {
    pages,
    channels,
    preSkip,
    inputSampleRate,
    audioPackets: packets.length,
    audioPacketBytes: packets.reduce((a, b) => a + b, 0),
    audioPacketSizes: packets,
    audioPacketSamples48k: samples,
    finalGranule,
    decodedSeconds: (finalGranule - preSkip) / 48_000,
    eos,
  }
}

export interface IndexedSfxRow113c extends SfxPackEntry113c {
  readonly soundId: number
}

export function renderSfxPackIndexModule113c(
  packs: readonly SfxPackMeta113c[],
  entries: readonly IndexedSfxRow113c[],
): string {
  const sortedPacks = [...packs]
  const sortedEntries = [...entries].sort((a, b) => a.soundId - b.soundId)
  const lines: string[] = [
    '/**',
    ' * Authoritative Diablo II v1.13c Core SFX Opus Pack Index (`src/common/audio/sfx-pack-index-113c.ts`).',
    ' *',
    ' * Generated by `src/baker/packers/pack-sfx.ts` (`npm run pack:sfx`). Do not edit by hand.',
    ' */',
    '',
    "export type SfxPackTier113c = 'first-screen' | 'background' | 'ambient' | 'skill' | 'monster' | 'on-demand'",
    '',
    'export type SfxPackTuple113c = readonly [',
    '  packId: string,',
    '  byteOffset: number,',
    '  byteLength: number,',
    '  sampleRate: number,',
    '  frames: number,',
    '  channels: 1 | 2,',
    ']',
    '',
    'export interface SfxPackMeta113c {',
    '  readonly packId: string',
    '  readonly url: string',
    '  readonly bytes: number',
    '  readonly sha256: string',
    '  readonly chunkCount: number',
    '  readonly rowCount: number',
    '  readonly tier: SfxPackTier113c',
    '  readonly prefixes: readonly string[]',
    '  readonly targetBitrateMono: number',
    '  readonly targetBitrateStereo: number',
    '}',
    '',
    'export interface SfxPackEntry113c {',
    '  readonly packId: string',
    '  readonly byteOffset: number',
    '  readonly byteLength: number',
    '  readonly sampleRate: number',
    '  readonly frames: number',
    '  readonly channels: 1 | 2',
    '}',
    '',
    "export const SFX_PACK_HEADER_MAGIC_113C = 'D2SP' as const",
    'export const SFX_PACK_HEADER_VERSION_113C = 2 as const',
    'export const SFX_PACK_HEADER_BYTES_113C = 12 as const',
    '',
    'export const SFX_PACKS_113C: readonly SfxPackMeta113c[] = [',
  ]
  for (const p of sortedPacks) {
    lines.push(
      `  { packId: ${JSON.stringify(p.packId)}, url: ${JSON.stringify(p.url)}, bytes: ${String(p.bytes)}, sha256: ${JSON.stringify(p.sha256)}, chunkCount: ${String(p.chunkCount)}, rowCount: ${String(p.rowCount)}, tier: ${JSON.stringify(p.tier)}, prefixes: ${JSON.stringify(p.prefixes)}, targetBitrateMono: ${String(p.targetBitrateMono)}, targetBitrateStereo: ${String(p.targetBitrateStereo)} },`,
    )
  }
  lines.push('] as const')
  lines.push('')
  lines.push('export const SFX_PACK_INDEX_113C: Readonly<Record<number, SfxPackTuple113c>> = {')
  for (const e of sortedEntries) {
    lines.push(
      `  ${String(e.soundId)}: [${JSON.stringify(e.packId)}, ${String(e.byteOffset)}, ${String(e.byteLength)}, ${String(e.sampleRate)}, ${String(e.frames)}, ${String(e.channels)}],`,
    )
  }
  lines.push('}')
  lines.push('')
  lines.push('export function getSfxPackEntry113c(id: number): SfxPackEntry113c | undefined {')
  lines.push('  if (!Number.isInteger(id) || id <= 0) return undefined')
  lines.push('  const tuple = SFX_PACK_INDEX_113C[id]')
  lines.push('  if (tuple === undefined) return undefined')
  lines.push('  return {')
  lines.push('    packId: tuple[0],')
  lines.push('    byteOffset: tuple[1],')
  lines.push('    byteLength: tuple[2],')
  lines.push('    sampleRate: tuple[3],')
  lines.push('    frames: tuple[4],')
  lines.push('    channels: tuple[5],')
  lines.push('  }')
  lines.push('}')
  lines.push('')
  lines.push('export function getSfxPackMeta113c(packId: string): SfxPackMeta113c | undefined {')
  lines.push('  return SFX_PACKS_113C.find((p) => p.packId === packId)')
  lines.push('}')
  lines.push('')
  lines.push('export function validateSfxPackHeader113c(')
  lines.push('  bytes: Uint8Array,')
  lines.push('  expect: { readonly bytes: number; readonly chunkCount: number },')
  lines.push('): { readonly version: number; readonly chunkCount: number } {')
  lines.push('  if (!(bytes instanceof Uint8Array)) {')
  lines.push("    throw new Error('validateSfxPackHeader113c: bytes must be a Uint8Array')")
  lines.push('  }')
  lines.push('  if (bytes.byteLength < SFX_PACK_HEADER_BYTES_113C) {')
  lines.push('    throw new Error(`validateSfxPackHeader113c: pack shorter than ${String(SFX_PACK_HEADER_BYTES_113C)}-byte D2SP header (${String(bytes.byteLength)} B)`)')
  lines.push('  }')
  lines.push('  if (bytes.byteLength !== expect.bytes) {')
  lines.push('    throw new Error(`validateSfxPackHeader113c: pack byteLength ${String(bytes.byteLength)} != expected ${String(expect.bytes)}`)')
  lines.push('  }')
  lines.push('  const magic = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)')
  lines.push('  if (magic !== SFX_PACK_HEADER_MAGIC_113C) {')
  lines.push('    throw new Error(`validateSfxPackHeader113c: bad magic ${JSON.stringify(magic)}, expected ${JSON.stringify(SFX_PACK_HEADER_MAGIC_113C)}`)')
  lines.push('  }')
  lines.push('  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)')
  lines.push('  const version = dv.getUint32(4, true)')
  lines.push('  if (version !== SFX_PACK_HEADER_VERSION_113C) {')
  lines.push('    throw new Error(`validateSfxPackHeader113c: unsupported version ${String(version)}, expected ${String(SFX_PACK_HEADER_VERSION_113C)}`)')
  lines.push('  }')
  lines.push('  const chunkCount = dv.getUint32(8, true)')
  lines.push('  if (chunkCount !== expect.chunkCount) {')
  lines.push('    throw new Error(`validateSfxPackHeader113c: header chunkCount ${String(chunkCount)} != expected ${String(expect.chunkCount)}`)')
  lines.push('  }')
  lines.push('  return { version, chunkCount }')
  lines.push('}')
  lines.push('')
  lines.push('export function validateSfxChunkSlice113c(')
  lines.push('  byteOffset: number,')
  lines.push('  byteLength: number,')
  lines.push('  packByteLength: number,')
  lines.push('): boolean {')
  lines.push('  if (!Number.isInteger(byteOffset) || !Number.isInteger(byteLength) || !Number.isInteger(packByteLength)) {')
  lines.push('    return false')
  lines.push('  }')
  lines.push('  if (byteOffset < SFX_PACK_HEADER_BYTES_113C || (byteOffset > SFX_PACK_HEADER_BYTES_113C && byteOffset < 16) || byteLength <= 0) {')
  lines.push('    return false')
  lines.push('  }')
  lines.push('  return byteOffset + byteLength <= packByteLength')
  lines.push('}')
  lines.push('')
  return lines.join('\n')
}

export function readExistingSfxPackIndex113c(rootDir: string): {
  readonly packs: SfxPackMeta113c[]
  readonly entries: IndexedSfxRow113c[]
} {
  const indexPath = join(rootDir, SFX_PACK_INDEX_TS_FILE)
  if (!existsSync(indexPath)) {
    return { packs: [], entries: [] }
  }
  const src = readFileSync(indexPath, 'utf8')
  const packs: SfxPackMeta113c[] = []
  const entries: IndexedSfxRow113c[] = []
  for (const rawLine of src.split(/\r?\n/)) {
    const trimmed = rawLine.trim()
    if (trimmed.startsWith('{ packId:')) {
      const jsonLine = trimmed
        .replace(/,\s*$/, '')
        .replace(
          /\b(packId|url|bytes|sha256|chunkCount|rowCount|tier|prefixes|targetBitrateMono|targetBitrateStereo):/g,
          '"$1":',
        )
      packs.push(JSON.parse(jsonLine) as SfxPackMeta113c)
      continue
    }
    const entryMatch = /^(\d+):\s*(\[.+\]),?\s*$/.exec(trimmed)
    if (entryMatch) {
      const soundId = Number(entryMatch[1])
      const tuple = JSON.parse(entryMatch[2]!) as SfxPackTuple113c
      entries.push({
        soundId,
        packId: tuple[0],
        byteOffset: tuple[1],
        byteLength: tuple[2],
        sampleRate: tuple[3],
        frames: tuple[4],
        channels: tuple[5],
      })
    }
  }
  return { packs, entries }
}

function sfxPackSortOrder(packId: string): [number, string] {
  if (packId === 'sfx-core') return [0, packId]
  if (packId.startsWith('sfx-core-')) return [1, packId]
  if (packId.startsWith('sfx-ambient-')) return [2, packId]
  if (packId.startsWith('sfx-skills-')) return [3, packId]
  if (packId.startsWith('sfx-mon-')) return [4, packId]
  return [5, packId]
}

export function mergeSfxPackIndex113c(
  existing: { readonly packs: readonly SfxPackMeta113c[]; readonly entries: readonly IndexedSfxRow113c[] },
  nextPacks: readonly SfxPackMeta113c[],
  nextEntries: readonly IndexedSfxRow113c[],
): { readonly packs: SfxPackMeta113c[]; readonly entries: IndexedSfxRow113c[] } {
  const replacedPackIds = new Set(nextPacks.map((p) => p.packId))
  const replacedSoundIds = new Set(nextEntries.map((e) => e.soundId))
  const mergedPacks = [
    ...existing.packs.filter((p) => !replacedPackIds.has(p.packId)),
    ...nextPacks,
  ].sort((a, b) => {
    const [ga, ka] = sfxPackSortOrder(a.packId)
    const [gb, kb] = sfxPackSortOrder(b.packId)
    return ga !== gb ? ga - gb : ka.localeCompare(kb)
  })
  const mergedEntries = [
    ...existing.entries.filter(
      (e) => !replacedPackIds.has(e.packId) && !replacedSoundIds.has(e.soundId),
    ),
    ...nextEntries,
  ].sort((a, b) => a.soundId - b.soundId)
  return { packs: mergedPacks, entries: mergedEntries }
}

export interface PackCoreSfxOptions {
  readonly rootDir?: string | undefined
  readonly mpqDir?: string | undefined
  readonly publicDir?: string | undefined
  readonly writeFiles?: boolean | undefined
  readonly concurrency?: number | undefined
  readonly ffmpegPath?: string | undefined
}

export interface PackCoreSfxResult {
  readonly packs: readonly SfxPackMeta113c[]
  readonly entries: readonly IndexedSfxRow113c[]
  readonly binaries: Readonly<Record<string, Uint8Array>>
  readonly indexModuleSource: string
}

export function mountAudioArchives(mpqDir: string): MountedArchives {
  if (!existsSync(mpqDir)) {
    throw new Error(`MPQ directory does not exist: ${mpqDir}`)
  }
  const mounted = new MountedArchives()
  for (const name of AUDIO_ARCHIVE_LOAD_ORDER_113C) {
    mounted.add(name, MpqArchive.openSync(syncNodeFileSource(join(mpqDir, name))))
  }
  return mounted
}

export async function packCoreSfx(options?: PackCoreSfxOptions): Promise<PackCoreSfxResult> {
  const probe = probeFfmpegOpus113c(options?.ffmpegPath, 'sfx')
  const rootDir = resolve(options?.rootDir ?? process.cwd())
  const mpqDir = resolve(options?.mpqDir ?? resolveAudioAuditMpqDir(rootDir))
  const publicDir = resolve(options?.publicDir ?? join(rootDir, 'public'))
  const writeFiles = options?.writeFiles ?? true
  const concurrency = Math.max(1, options?.concurrency ?? 16)

  const archives = mountAudioArchives(mpqDir)

  // Group candidate Stream = 0 rows by pack spec
  const rowsByPack = new Map<CoreSfxPackSpec113c['packId'], SoundsRow113c[]>()
  for (const spec of SFX_PACK_LAYOUT_113C) {
    rowsByPack.set(spec.packId, [])
  }
  for (const row of SOUNDS_113C) {
    if (row.id <= 0 || row.stream) continue
    const spec = resolveCoreSfxPackSpec113c(row.fileName)
    if (!spec) continue
    rowsByPack.get(spec.packId)!.push(row)
  }

  // Collect all unique WAV files across all 3 core packs and transcode in parallel
  interface UniqueWavJob {
    readonly normFile: string
    readonly firstSoundId: number
    readonly mpqPath: string
    readonly wavBytes: Uint8Array
    readonly wavInfo: WavPcm16
    readonly bitrate: number
  }
  const uniqueJobs = new Map<string, UniqueWavJob>()
  for (const spec of SFX_PACK_LAYOUT_113C) {
    for (const row of rowsByPack.get(spec.packId)!) {
      const normFile = normalizeSoundFileName113c(row.fileName)
      if (uniqueJobs.has(normFile)) continue
      const mpqPath = buildSoundMpqPath113c(row.id)
      if (!mpqPath) {
        throw new Error(`packCoreSfx: row ${String(row.id)} (${row.fileName}) returned null MPQ path`)
      }
      const wavBytes = await archives.readBytes(mpqPath)
      const wavInfo = parseWavPcm16(wavBytes, `${mpqPath} (row ${String(row.id)})`)
      const bitrate = wavInfo.channels === 2 ? SFX_STEREO_BITRATE_113C : SFX_MONO_BITRATE_113C
      uniqueJobs.set(normFile, {
        normFile,
        firstSoundId: row.id,
        mpqPath,
        wavBytes,
        wavInfo,
        bitrate,
      })
    }
  }

  const jobList = [...uniqueJobs.values()]
  const encodedByNormFile = new Map<string, Uint8Array>()
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, jobList.length) }, async () => {
    while (cursor < jobList.length) {
      const idx = cursor
      cursor += 1
      const job = jobList[idx]!
      const opusBytes = await transcodeWavToOpusOggAsync(job.wavBytes, job.bitrate, probe.ffmpegPath)
      const facts = inspectOggOpusChunk113c(opusBytes, `${job.mpqPath} (row ${String(job.firstSoundId)})`)
      const wavSec = job.wavInfo.frames / job.wavInfo.sampleRate
      const bps = (facts.audioPacketBytes * 8) / wavSec
      if (bps < job.bitrate) {
        throw new Error(
          `packCoreSfx: bitrate floor violation on ${job.mpqPath} (row ${String(job.firstSoundId)}): ${bps.toFixed(1)} bps < ${String(job.bitrate)} bps`,
        )
      }
      encodedByNormFile.set(job.normFile, opusBytes)
    }
  })
  await Promise.all(workers)

  const packs: SfxPackMeta113c[] = []
  const entries: IndexedSfxRow113c[] = []
  const binaries: Record<string, Uint8Array> = {}

  for (const spec of SFX_PACK_LAYOUT_113C) {
    const packRows = rowsByPack.get(spec.packId)!
    const uniqueOrder: string[] = []
    const uniqueIndexByFile = new Map<string, number>()
    for (const row of packRows) {
      const normFile = normalizeSoundFileName113c(row.fileName)
      if (!uniqueIndexByFile.has(normFile)) {
        uniqueIndexByFile.set(normFile, uniqueOrder.length)
        uniqueOrder.push(normFile)
      }
    }

    const chunks = uniqueOrder.map((normFile) => encodedByNormFile.get(normFile)!)
    const { bytes, offsets } = encodeSfxPackBinary113c(chunks)
    if (bytes.byteLength > spec.maxBytes) {
      throw new Error(
        `packCoreSfx: ${spec.packId} (${spec.relPath}) size ${String(bytes.byteLength)} B exceeds cap ${String(spec.maxBytes)} B`,
      )
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const meta: SfxPackMeta113c = {
      packId: spec.packId,
      url: spec.url,
      bytes: bytes.byteLength,
      sha256,
      chunkCount: chunks.length,
      rowCount: packRows.length,
      tier: spec.tier,
      prefixes: spec.prefixes,
      targetBitrateMono: SFX_MONO_BITRATE_113C,
      targetBitrateStereo: SFX_STEREO_BITRATE_113C,
    }
    packs.push(meta)
    binaries[spec.packId] = bytes

    for (const row of packRows) {
      const normFile = normalizeSoundFileName113c(row.fileName)
      const uIdx = uniqueIndexByFile.get(normFile)!
      const chunk = chunks[uIdx]!
      const job = uniqueJobs.get(normFile)!
      entries.push({
        soundId: row.id,
        packId: spec.packId,
        byteOffset: offsets[uIdx]!,
        byteLength: chunk.byteLength,
        sampleRate: job.wavInfo.sampleRate,
        frames: job.wavInfo.frames,
        channels: job.wavInfo.channels,
      })
    }

    if (writeFiles) {
      const outBinPath = join(publicDir, spec.relPath)
      mkdirSync(dirname(outBinPath), { recursive: true })
      writeFileSync(outBinPath, bytes)
    }
  }

  const existing = readExistingSfxPackIndex113c(rootDir)
  const merged = mergeSfxPackIndex113c(existing, packs, entries)
  const indexModuleSource = renderSfxPackIndexModule113c(merged.packs, merged.entries)
  if (writeFiles) {
    const outTsPath = join(rootDir, SFX_PACK_INDEX_TS_FILE)
    mkdirSync(dirname(outTsPath), { recursive: true })
    writeFileSync(outTsPath, indexModuleSource, 'utf8')
  }

  return {
    packs,
    entries,
    binaries,
    indexModuleSource,
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMain) {
  Promise.resolve()
    .then(() => packCoreSfx(parsePackSfxCliArgs113c(process.argv.slice(2))))
    .then((res) => {
      for (const p of res.packs) {
        console.log(
          `✓ Baked ${p.packId} -> public${p.url} (${String(p.bytes)} B, sha256=${p.sha256.slice(0, 16)}, ${String(p.rowCount)} rows / ${String(p.chunkCount)} unique chunks)`,
        )
      }
      console.log(`✓ Generated ${SFX_PACK_INDEX_TS_FILE} (${String(res.entries.length)} entries)`)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
