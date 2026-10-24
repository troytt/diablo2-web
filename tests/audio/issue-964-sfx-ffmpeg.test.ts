/**
 * Issue #964 regression suite:
 * - ffmpeg path resolution (`FFMPEG_PATH`, `--ffmpeg`, `/usr/bin/ffmpeg` default)
 * - Fail-fast preflight check (`probeFfmpegOpus113c`) for missing binary / missing `libopus`
 * - Actionable `sfx-core` duration mismatch diagnostics in `verify-audio-113c.ts` (delta in ms,
 *   `ffmpeg -version`, Opus flags, and `ffmpeg >= 7.0` resampling hint)
 * - `runBakerCli` (`all`) best-effort `asset-manifest.json` fallback when an intermediate target fails
 * - `README.md` and `src/baker/README.md` documentation coverage for `ffmpeg`, `libopus`, `FFMPEG_PATH`,
 *   `pack:sfx`, and `pack:music`
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { runAudioAudit } from '../../src/baker/audit/verify-audio-113c.ts'
import { ALL_BAKE_TARGETS, runBakerCli } from '../../src/baker/cli.ts'
import { generateAssetManifest } from '../../src/baker/io/asset-manifest.ts'
import { DEFAULT_NODE_MPQ_DIR } from '../../src/baker/mpq-archive-source.ts'
import {
  CORE_SFX_PACK_SPECS_113C,
  DEFAULT_FFMPEG_PATH_113C,
  FFMPEG_ENV_VAR_113C,
  MIN_RECOMMENDED_FFMPEG_MAJOR_113C,
  SFX_FFMPEG_OPUS_ARGS_SUMMARY_113C,
  SFX_PACK_INDEX_TS_FILE,
  getFfmpegVersionSummary113c,
  parsePackSfxCliArgs113c,
  probeFfmpegOpus113c,
  resolveFfmpegPath113c,
  transcodeWavToOpusOgg,
} from '../../src/baker/packers/pack-sfx.ts'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')
const scratch = mkdtempSync(join(tmpdir(), 'issue-964-sfx-ffmpeg-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

let seq = 0
function makeScratchDir(label: string): string {
  seq += 1
  const dir = join(scratch, `${String(seq)}-${label}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('Issue #964 — ffmpeg path resolution & CLI argument parsing', () => {
  it('resolves ffmpeg path in priority order: explicit option > FFMPEG_PATH env > /usr/bin/ffmpeg', () => {
    expect(DEFAULT_FFMPEG_PATH_113C).toBe('/usr/bin/ffmpeg')
    expect(FFMPEG_ENV_VAR_113C).toBe('FFMPEG_PATH')
    expect(MIN_RECOMMENDED_FFMPEG_MAJOR_113C).toBe(7)

    expect(resolveFfmpegPath113c(undefined, {})).toBe('/usr/bin/ffmpeg')
    expect(resolveFfmpegPath113c('   ', { FFMPEG_PATH: '  ' })).toBe('/usr/bin/ffmpeg')
    expect(resolveFfmpegPath113c(undefined, { FFMPEG_PATH: '/opt/homebrew/bin/ffmpeg' })).toBe('/opt/homebrew/bin/ffmpeg')
    expect(resolveFfmpegPath113c('/custom/bin/ffmpeg', { FFMPEG_PATH: '/opt/homebrew/bin/ffmpeg' })).toBe('/custom/bin/ffmpeg')
  })

  it('parses --ffmpeg and --ffmpeg-path flags (both space-separated and =-joined) and falls back to FFMPEG_PATH', () => {
    expect(parsePackSfxCliArgs113c([], {})).toEqual({})
    expect(parsePackSfxCliArgs113c([], { FFMPEG_PATH: '/env/ffmpeg' })).toEqual({ ffmpegPath: '/env/ffmpeg' })
    expect(parsePackSfxCliArgs113c(['--ffmpeg', '/cli/ffmpeg'], { FFMPEG_PATH: '/env/ffmpeg' })).toEqual({
      ffmpegPath: '/cli/ffmpeg',
    })
    expect(parsePackSfxCliArgs113c(['--ffmpeg=/eq/ffmpeg'], {})).toEqual({ ffmpegPath: '/eq/ffmpeg' })
    expect(parsePackSfxCliArgs113c(['--ffmpeg-path', '/path/ffmpeg'], {})).toEqual({ ffmpegPath: '/path/ffmpeg' })
    expect(parsePackSfxCliArgs113c(['--ffmpeg-path=/path-eq/ffmpeg'], {})).toEqual({ ffmpegPath: '/path-eq/ffmpeg' })

    expect(() => parsePackSfxCliArgs113c(['--ffmpeg'], {})).toThrow(/requires a non-empty path argument/)
    expect(() => parsePackSfxCliArgs113c(['--ffmpeg', '--other'], {})).toThrow(/requires a non-empty path argument/)
    expect(() => parsePackSfxCliArgs113c(['--ffmpeg='], {})).toThrow(/requires a non-empty path argument/)
  })
})

describe('Issue #964 — fail-fast ffmpeg + libopus preflight check (probeFfmpegOpus113c)', () => {
  it('succeeds against the system /usr/bin/ffmpeg with libopus', () => {
    const probe = probeFfmpegOpus113c('/usr/bin/ffmpeg', 'sfx', {})
    expect(probe.ffmpegPath).toBe('/usr/bin/ffmpeg')
    expect(probe.hasLibopus).toBe(true)
    expect(probe.versionLine).toMatch(/ffmpeg version/i)
    expect(probe.majorVersion).toBeGreaterThanOrEqual(MIN_RECOMMENDED_FFMPEG_MAJOR_113C)
    expect(getFfmpegVersionSummary113c('/usr/bin/ffmpeg', {})).toContain('/usr/bin/ffmpeg')
  })

  it('throws an actionable error with FFMPEG_PATH and --ffmpeg instructions when ffmpeg is missing', () => {
    const missingBin = join(scratch, 'nonexistent-ffmpeg-binary')
    expect(() => probeFfmpegOpus113c(missingBin, 'sfx', {})).toThrowError(
      new RegExp(
        `sfx 目标需要 ffmpeg.*${missingBin}.*FFMPEG_PATH=/path/to/ffmpeg.*--ffmpeg <path>.*README\\.md`,
        's',
      ),
    )
    expect(getFfmpegVersionSummary113c(missingBin, {})).toContain('unavailable:')
  })

  it('throws an actionable error when the binary lacks libopus support or exits non-zero', () => {
    const fakeDir = makeScratchDir('fake-ffmpeg')
    const noOpusBin = join(fakeDir, 'ffmpeg-no-opus')
    writeFileSync(
      noOpusBin,
      '#!/usr/bin/env bash\necho "ffmpeg version 6.1.1 Copyright (c) 2000-2023"\necho "configuration: --enable-gpl --disable-libopus"\nexit 0\n',
      'utf8',
    )
    chmodSync(noOpusBin, 0o755)

    expect(() => probeFfmpegOpus113c(noOpusBin, 'sfx', {})).toThrowError(
      /未启用 libopus.*FFMPEG_PATH \/ --ffmpeg/s,
    )

    const brokenBin = join(fakeDir, 'ffmpeg-broken')
    writeFileSync(brokenBin, '#!/usr/bin/env bash\necho "segfault" >&2\nexit 127\n', 'utf8')
    chmodSync(brokenBin, 0o755)
    expect(() => probeFfmpegOpus113c(brokenBin, 'music', {})).toThrowError(
      /music 目标需要 ffmpeg.*exit code 127: segfault/s,
    )
  })
})

describe('Issue #964 — verify-audio-113c sfx-core duration mismatch diagnostics', () => {
  it('includes ms delta, ±2.00ms tolerance, ffmpeg version, Opus flags, and >= 7.0 upgrade hint when an Opus chunk has resampling tail drift', async () => {
    const fakeRoot = makeScratchDir('tampered-sfx-root')
    mkdirSync(join(fakeRoot, 'src', 'common', 'audio'), { recursive: true })
    mkdirSync(join(fakeRoot, 'public', 'sound', 'packs'), { recursive: true })

    for (const spec of CORE_SFX_PACK_SPECS_113C) {
      copyFileSync(join(REPO_ROOT, 'public', spec.relPath), join(fakeRoot, 'public', spec.relPath))
    }
    copyFileSync(join(REPO_ROOT, 'public', 'asset-manifest.json'), join(fakeRoot, 'public', 'asset-manifest.json'))

    // Tamper the first chunk in sfx-core.bin by replacing its bytes with a valid 48 kHz Ogg Opus stream
    // whose duration is longer than the original WAV (simulating legacy 2018 ffmpeg N-47683 +3.3ms resampling drift).
    const indexSrc = readFileSync(join(REPO_ROOT, SFX_PACK_INDEX_TS_FILE), 'utf8')
    // Find the first tuple mapped to sfx-core: `<id>: ["sfx-core", <offset>, <length>, <sampleRate>, <frames>, <channels>],`
    const tupleMatch = /(\d+):\s*\["sfx-core",\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\],/.exec(indexSrc)
    expect(tupleMatch).not.toBeNull()
    const [, rowIdStr, , , sampleRateStr, framesStr, channelsStr] = tupleMatch!
    const sampleRate = Number(sampleRateStr)
    const frames = Number(framesStr)
    const channels = Number(channelsStr)

    // Build a valid PCM16 WAV with +160 extra frames (~+7.2ms at 22050 Hz, well above the ±2.00ms tolerance)
    const extraFrames = frames + 160
    const dataBytes = extraFrames * channels * 2
    const wavBuf = Buffer.alloc(44 + dataBytes)
    wavBuf.write('RIFF', 0, 'ascii')
    wavBuf.writeUInt32LE(36 + dataBytes, 4)
    wavBuf.write('WAVEfmt ', 8, 'ascii')
    wavBuf.writeUInt32LE(16, 16)
    wavBuf.writeUInt16LE(1, 20)
    wavBuf.writeUInt16LE(channels, 22)
    wavBuf.writeUInt32LE(sampleRate, 24)
    wavBuf.writeUInt32LE(sampleRate * channels * 2, 28)
    wavBuf.writeUInt16LE(channels * 2, 32)
    wavBuf.writeUInt16LE(16, 34)
    wavBuf.write('data', 36, 'ascii')
    wavBuf.writeUInt32LE(dataBytes, 40)
    for (let i = 0; i < extraFrames * channels; i += 1) {
      wavBuf.writeInt16LE(Math.round(Math.sin(i * 0.25) * 6000), 44 + i * 2)
    }

    const driftedOpus = transcodeWavToOpusOgg(wavBuf, {
      bitrate: channels === 2 ? 40_000 : 24_000,
    })

    const coreBinPath = join(fakeRoot, 'public', 'sound', 'packs', 'sfx-core.bin')
    const oldBin = readFileSync(coreBinPath)
    const newOffset = oldBin.byteLength
    const newBin = Buffer.concat([oldBin, driftedOpus])
    writeFileSync(coreBinPath, newBin)

    const patchedIndexSrc = indexSrc.replace(
      tupleMatch![0],
      `${rowIdStr}: ["sfx-core", ${String(newOffset)}, ${String(driftedOpus.byteLength)}, ${String(sampleRate)}, ${String(frames)}, ${String(channels)}],`,
    )
    writeFileSync(join(fakeRoot, SFX_PACK_INDEX_TS_FILE), patchedIndexSrc, 'utf8')

    const report = await runAudioAudit({
      rootDir: fakeRoot,
      mpqDir: DEFAULT_NODE_MPQ_DIR,
      sections: ['sfx-core'],
    })
    const outcome = report.sections[0]!

    const durationErrors = outcome.errors.filter((e) => e.includes('duration=') && e.includes('tolerance=±2.00ms'))
    expect(durationErrors.length).toBeGreaterThanOrEqual(1)
    const msg = durationErrors[0]!
    expect(msg).toContain('delta=')
    expect(msg).toContain('tolerance=±2.00ms')
    expect(msg).toContain('ffmpeg=')
    expect(msg).toContain(`args=[${SFX_FFMPEG_OPUS_ARGS_SUMMARY_113C}]`)
    expect(msg).toContain('ffmpeg >= 7.0')
    expect(msg).toContain('npm run pack:sfx && npm run pack:manifest')
  }, 60_000)
})

describe('Issue #964 — Baker CLI ffmpeg preflight & asset-manifest fallback on mid-bake failure', () => {
  it('includes all 24 targets in ALL_BAKE_TARGETS including sfx, music, and manifest', () => {
    expect(ALL_BAKE_TARGETS).toHaveLength(24)
    expect(ALL_BAKE_TARGETS.slice(-4)).toEqual(['monster-sounds', 'speech', 'skill-sounds', 'manifest'])
  })

  it('fails fast before spawning pack-sfx when --ffmpeg points to a missing binary', async () => {
    const spawned: string[] = []
    const missingBin = join(scratch, 'missing-ffmpeg-cli')
    await expect(
      runBakerCli(['sfx', '--ffmpeg', missingBin], {
        rootDir: REPO_ROOT,
        env: {},
        runTarget: (_target, scriptRelPath) => {
          spawned.push(scriptRelPath)
        },
      }),
    ).rejects.toThrow(/sfx 目标需要 ffmpeg/)
    expect(spawned).toEqual([])
  })

  it('runs manifest in finally as a best-effort fallback when bake -- all aborts mid-pipeline (e.g. on sfx)', async () => {
    const fakeRoot = makeScratchDir('bake-all-fallback')
    const publicDir = join(fakeRoot, 'public')
    mkdirSync(join(publicDir, 'ui'), { recursive: true })
    writeFileSync(join(publicDir, 'ui', 'dummy.bin'), 'hello-d2')
    mkdirSync(join(fakeRoot, 'samples'), { recursive: true })
    symlinkSync(DEFAULT_NODE_MPQ_DIR, join(fakeRoot, 'samples', 'd2'))

    const executedTargets: string[] = []
    const missingBin = join(scratch, 'missing-ffmpeg-in-all')

    await expect(
      runBakerCli(['all', `--ffmpeg=${missingBin}`], {
        rootDir: fakeRoot,
        env: {},
        runTarget: (target, _scriptRelPath, _extraArgs, root) => {
          executedTargets.push(target)
          if (target === 'manifest') {
            generateAssetManifest({ rootDir: root })
          }
        },
      }),
    ).rejects.toThrow(/sfx 目标需要 ffmpeg/)

    // Verify all targets prior to sfx ran, sfx aborted before runTarget('sfx'), and manifest still ran in finally!
    expect(executedTargets).not.toContain('sfx')
    expect(executedTargets.at(-1)).toBe('manifest')
    const manifestPath = join(publicDir, 'asset-manifest.json')
    expect(existsSync(manifestPath)).toBe(true)
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { totalFiles: number; files: Record<string, unknown> }
    expect(manifest.totalFiles).toBe(1)
    expect(manifest.files['ui/dummy.bin']).toBeDefined()
  })
})

describe('Issue #964 — README.md and src/baker/README.md documentation parity', () => {
  it('documents ffmpeg, libopus, FFMPEG_PATH, --ffmpeg, pack:sfx, pack:music, and >= 7.0 version note in both READMEs', () => {
    const rootReadme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8')
    const bakerReadme = readFileSync(join(REPO_ROOT, 'src', 'baker', 'README.md'), 'utf8')

    for (const doc of [rootReadme, bakerReadme]) {
      expect(doc).toContain('ffmpeg')
      expect(doc).toContain('libopus')
      expect(doc).toContain('FFMPEG_PATH')
      expect(doc).toContain('--ffmpeg')
      expect(doc).toContain('pack:sfx')
      expect(doc).toContain('pack:music')
      expect(doc).toContain('>= 7.0')
    }
  })
})
