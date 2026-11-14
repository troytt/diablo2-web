import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateAssetManifest } from '../../src/baker/io/asset-manifest.ts'
import { encodeRgbaPng } from '../../src/baker/io/png.ts'
import {
  DEFAULT_SIDECAR_SUBDIRS,
  bakeSidecarCompression,
  buildCwebpArgs,
  createSidecarAssetHttpMiddleware,
  parseSidecarCliArgs,
  type WebpEncodeContext,
} from '../../src/baker/io/sidecar-compression.ts'
import { CACHEABLE_PREFIXES } from '../../src/common/pack-contract/index.ts'
import { resolveArtByCelFile } from '../../src/client/render/cel-file-key.ts'
import type { SpriteRenderer } from '../../src/client/render/renderer.ts'
import {
  loadMissileArtMap,
  loadOverlayArtMap,
} from '../../src/client/scene/missile-overlay-renderer.ts'

function createMockRenderer(): SpriteRenderer {
  let id = 0
  return {
    addAtlas: () => ({ id: ++id }),
  } as unknown as SpriteRenderer
}

/** Minimal valid 1x1 lossless VP8L WebP container (`RIFF....WEBPVP8L`). */
function buildMinimalValidWebp(extraPadBytes = 0): Buffer {
  const vp8lPayload = Buffer.from([
    0x2f, 0x00, 0x00, 0x00, 0x10, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07, 0x00,
  ])
  const padLen = Math.max(0, extraPadBytes)
  const junkChunkSize = padLen > 0 ? 8 + padLen + (padLen % 2) : 0
  const riffPayloadSize = 4 + (8 + vp8lPayload.byteLength) + junkChunkSize
  const buf = Buffer.alloc(8 + riffPayloadSize)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(riffPayloadSize, 4)
  buf.write('WEBP', 8, 'ascii')
  buf.write('VP8L', 12, 'ascii')
  buf.writeUInt32LE(vp8lPayload.byteLength, 16)
  vp8lPayload.copy(buf, 20)
  if (junkChunkSize > 0) {
    const offset = 20 + vp8lPayload.byteLength
    buf.write('JUNK', offset, 'ascii')
    buf.writeUInt32LE(padLen, offset + 4)
  }
  return buf
}

function hasCommand(cmd: string, args: readonly string[] = ['-version']): boolean {
  const res = spawnSync(cmd, args, { stdio: 'ignore' })
  return !res.error && res.status === 0
}

function invokeMiddleware(
  middleware: (req: IncomingMessage, res: ServerResponse, next: () => void) => void,
  url: string,
  headers: Record<string, string>,
  method = 'GET',
): Promise<{
  nextCalled: boolean
  statusCode: number
  headers: Record<string, string>
  body: Buffer
}> {
  return new Promise((resolvePromise) => {
    const req = {
      method,
      url,
      headers,
    } as unknown as IncomingMessage

    const resHeaders: Record<string, string> = {}
    const stream = new PassThrough()
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))

    const res = Object.assign(stream, {
      statusCode: 200,
      getHeader(name: string) {
        return resHeaders[name.toLowerCase()]
      },
      setHeader(name: string, value: string) {
        resHeaders[name.toLowerCase()] = value
      },
    }) as unknown as ServerResponse

    let nextCalled = false
    stream.on('finish', () => {
      resolvePromise({
        nextCalled,
        statusCode: res.statusCode,
        headers: resHeaders,
        body: Buffer.concat(chunks),
      })
    })

    middleware(req, res, () => {
      nextCalled = true
      resolvePromise({
        nextCalled: true,
        statusCode: res.statusCode,
        headers: resHeaders,
        body: Buffer.alloc(0),
      })
    })
  })
}

describe('sidecar compression & lazy sprite art loading', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('serves .webp sidecars transparently when Accept includes image/webp and falls back otherwise', async () => {
    const publicDir = mkdtempSync(join(tmpdir(), 'd2-sidecar-webp-'))
    tempDirs.push(publicDir)
    mkdirSync(join(publicDir, 'ui'), { recursive: true })
    writeFileSync(join(publicDir, 'ui', 'items-atlas.png'), Buffer.from('RAW_PNG_BYTES'))
    writeFileSync(join(publicDir, 'ui', 'items-atlas.png.webp'), Buffer.from('WEBP_SIDECAR_BYTES'))

    const middleware = createSidecarAssetHttpMiddleware({ publicDir })

    const webpRes = await invokeMiddleware(middleware, '/ui/items-atlas.png', {
      accept: 'image/avif,image/webp,image/apng,*/*;q=0.8',
    })
    expect(webpRes.nextCalled).toBe(false)
    expect(webpRes.headers['content-type']).toBe('image/webp')
    expect(webpRes.headers['x-asset-sidecar']).toBe('webp')
    expect(webpRes.headers['vary']).toContain('Accept')
    expect(webpRes.body.toString('utf8')).toBe('WEBP_SIDECAR_BYTES')

    const zeroQRes = await invokeMiddleware(middleware, '/ui/items-atlas.png', {
      accept: 'image/webp;q=0,image/png;q=1',
    })
    expect(zeroQRes.nextCalled).toBe(true)

    const fallbackRes = await invokeMiddleware(middleware, '/ui/items-atlas.png', {
      accept: 'image/png,*/*;q=0.8',
    })
    expect(fallbackRes.nextCalled).toBe(true)
  })

  it('bakes .gz and .br sidecars for .r8/.bin/.json and serves them with Content-Encoding and ignored in asset manifest', async () => {
    const publicDir = mkdtempSync(join(tmpdir(), 'd2-sidecar-r8-'))
    tempDirs.push(publicDir)
    mkdirSync(join(publicDir, 'entities'), { recursive: true })
    const rawR8 = Buffer.alloc(8192, 0x2a)
    writeFileSync(join(publicDir, 'entities', 'char-so.r8'), rawR8)

    const summary = await bakeSidecarCompression({
      publicDir,
      enableWebp: false,
      enableGzip: true,
      enableBrotli: true,
    })
    expect(summary.processedFiles).toBe(1)
    expect(summary.gzipEncodedFiles).toBe(1)
    expect(summary.brotliEncodedFiles).toBe(1)
    expect(summary.compressedBytes).toBeLessThan(summary.originalBytes)
    expect(existsSync(join(publicDir, 'entities', 'char-so.r8.gz'))).toBe(true)
    expect(existsSync(join(publicDir, 'entities', 'char-so.r8.br'))).toBe(true)

    const manifest = generateAssetManifest({
      publicDir,
      includePacksDir: false,
      outputFile: null,
    })
    expect(Object.keys(manifest.files)).toEqual(['entities/char-so.r8'])

    const middleware = createSidecarAssetHttpMiddleware({ publicDir })
    const brRes = await invokeMiddleware(middleware, '/entities/char-so.r8', {
      'accept-encoding': 'gzip, deflate, br',
    })
    expect(brRes.nextCalled).toBe(false)
    expect(brRes.headers['content-encoding']).toBe('br')
    expect(brRes.headers['content-type']).toBe('application/octet-stream')
    expect(brRes.headers['x-asset-sidecar']).toBe('br')
    expect(brRes.body.byteLength).toBeLessThan(rawR8.byteLength)

    const gzRes = await invokeMiddleware(middleware, '/entities/char-so.r8', {
      'accept-encoding': 'gzip, deflate',
    })
    expect(gzRes.nextCalled).toBe(false)
    expect(gzRes.headers['content-encoding']).toBe('gzip')
    expect(gzRes.headers['x-asset-sidecar']).toBe('gzip')
  })

  it('covers all CACHEABLE_PREFIXES directories in DEFAULT_SIDECAR_SUBDIRS and gitignores generated sidecars', () => {
    const subdirSet = new Set(DEFAULT_SIDECAR_SUBDIRS)
    for (const prefix of CACHEABLE_PREFIXES) {
      const clean = prefix.replace(/\/+$/, '')
      expect(subdirSet.has(clean), `DEFAULT_SIDECAR_SUBDIRS missing "${clean}"`).toBe(true)
    }
    for (const required of ['overlays', 'missiles', 'skills', 'backdrop', 'weather', 'cursor-pd2', 'ui-pd2']) {
      expect(subdirSet.has(required)).toBe(true)
    }

    const repoRoot = resolve(import.meta.dirname, '..', '..')
    const gitignoreCheck = spawnSync(
      'git',
      [
        'check-ignore',
        'public/missiles/firebolt.png.webp',
        'public/overlays/objsb.png.webp',
        'public/cursor-pd2/hand.png.webp',
        'public/ui-pd2/home/d2-hero-banner.jpg.webp',
        'public/ui-pd2/home/d2-hero-banner.jpg.webp.tmp.123.1',
      ],
      { cwd: repoRoot, encoding: 'utf8' },
    )
    expect(gitignoreCheck.status).toBe(0)
    const ignoredLines = gitignoreCheck.stdout.trim().split('\n').filter(Boolean)
    expect(ignoredLines).toHaveLength(5)
  })

  it('auto-detects cwebp on PATH, passes lossless PNG & lossy JPG flags, covers overlays/missiles/skills/cursor-pd2, and serves via middleware', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'd2-sidecar-cwebp-path-'))
    tempDirs.push(workDir)
    const publicDir = join(workDir, 'public')
    const binDir = join(workDir, 'bin')
    const argsLogFile = join(workDir, 'cwebp-invocations.jsonl')
    mkdirSync(binDir, { recursive: true })

    // Create a portable Node-backed fake `cwebp` on PATH that logs argv and writes valid RIFF..WEBP
    const fakeCwebpPath = join(binDir, 'cwebp')
    const webpPayloadHex = buildMinimalValidWebp(16).toString('hex')
    writeFileSync(
      fakeCwebpPath,
      [
        `#!${process.execPath}`,
        'const fs = require("node:fs");',
        'const args = process.argv.slice(2);',
        'if (args.includes("-version")) { console.log("1.5.0"); process.exit(0); }',
        `fs.appendFileSync(${JSON.stringify(argsLogFile)}, JSON.stringify(args) + "\\n");`,
        'const outIdx = args.indexOf("-o");',
        'if (outIdx < 0 || !args[outIdx + 1]) process.exit(2);',
        `fs.writeFileSync(args[outIdx + 1], Buffer.from(${JSON.stringify(webpPayloadHex)}, "hex"));`,
      ].join('\n'),
      'utf8',
    )
    chmodSync(fakeCwebpPath, 0o755)

    for (const sub of ['overlays', 'missiles', 'skills', 'cursor-pd2', 'ui-pd2/home', 'backdrop', 'weather']) {
      mkdirSync(join(publicDir, sub), { recursive: true })
    }
    const pngPayload = Buffer.alloc(2048, 0xab)
    const jpgPayload = Buffer.alloc(3072, 0xcd)
    writeFileSync(join(publicDir, 'overlays', 'aura.png'), pngPayload)
    writeFileSync(join(publicDir, 'missiles', 'fireball.png'), pngPayload)
    writeFileSync(join(publicDir, 'skills', 'icon_0.png'), pngPayload)
    writeFileSync(join(publicDir, 'cursor-pd2', 'hand.png'), pngPayload)
    writeFileSync(join(publicDir, 'ui-pd2', 'home', 'hero.jpg'), jpgPayload)
    writeFileSync(join(publicDir, 'ui-pd2', 'home', 'crest.jpeg'), jpgPayload)
    writeFileSync(join(publicDir, 'backdrop', 'backdrop.json'), JSON.stringify({ frames: 'x'.repeat(1200) }))
    writeFileSync(join(publicDir, 'weather', 'weather.json'), JSON.stringify({ rain: 'y'.repeat(1200) }))

    const summary = await bakeSidecarCompression({
      publicDir,
      concurrency: 2,
      env: { ...process.env, PATH: binDir },
    })

    expect(summary.warnings).toEqual([])
    expect(summary.webpEncodedFiles).toBe(6)
    expect(summary.gzipEncodedFiles).toBe(2)
    expect(summary.processedFiles).toBe(8)
    expect(summary.compressedBytes).toBeLessThan(summary.originalBytes)

    // Verify zero leftover atomic .tmp files
    for (const sub of ['overlays', 'missiles', 'skills', 'cursor-pd2', 'ui-pd2/home']) {
      const leftoverTmp = readdirSync(join(publicDir, sub)).filter((f) => f.includes('.tmp.'))
      expect(leftoverTmp).toEqual([])
    }

    // Verify exact cwebp CLI arguments for .png vs .jpg/.jpeg
    const loggedCalls = readFileSync(argsLogFile, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as string[])
    expect(loggedCalls).toHaveLength(6)
    for (const argv of loggedCalls) {
      const inputArg = argv[argv.length - 3]!
      const outFlag = argv[argv.length - 2]!
      const outPath = argv[argv.length - 1]!
      expect(outFlag).toBe('-o')
      expect(outPath).toContain('.webp.tmp.')
      if (inputArg.endsWith('.png')) {
        expect(argv.slice(0, 4)).toEqual(['-quiet', '-lossless', '-z', '3'])
      } else {
        expect(argv.slice(0, 3)).toEqual(['-quiet', '-q', '82'])
      }
    }

    // Asset manifest ignores all .webp and .gz sidecars
    const manifest = generateAssetManifest({
      publicDir,
      includePacksDir: false,
      outputFile: null,
    })
    expect(Object.keys(manifest.files).some((k) => k.endsWith('.webp') || k.endsWith('.gz'))).toBe(
      false,
    )

    // Round-trip HTTP middleware serves generated .png.webp, .jpg.webp, .jpeg.webp
    const middleware = createSidecarAssetHttpMiddleware({ publicDir })
    for (const url of [
      '/overlays/aura.png',
      '/missiles/fireball.png',
      '/skills/icon_0.png',
      '/cursor-pd2/hand.png',
      '/ui-pd2/home/hero.jpg',
      '/ui-pd2/home/crest.jpeg',
    ]) {
      const res = await invokeMiddleware(middleware, url, { accept: 'image/webp,*/*;q=0.8' })
      expect(res.nextCalled).toBe(false)
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('image/webp')
      expect(res.headers['x-asset-sidecar']).toBe('webp')
      expect(res.body.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(res.body.subarray(8, 12).toString('ascii')).toBe('WEBP')
    }
  })

  it('enforces <95% savings threshold, prunes stale .webp sidecars when savings drop, and respects minBytes', async () => {
    const publicDir = mkdtempSync(join(tmpdir(), 'd2-sidecar-prune-'))
    tempDirs.push(publicDir)
    mkdirSync(join(publicDir, 'missiles'), { recursive: true })

    // 1) Tiny file (< minBytes=512) must be ignored completely
    const tinyPng = join(publicDir, 'missiles', 'tiny.png')
    writeFileSync(tinyPng, Buffer.alloc(256, 0x11))

    // 2) File whose encoded WebP is >= 95% of source bytes (960 >= 1000 * 0.95) AND has a pre-existing stale .webp
    const bloatedPng = join(publicDir, 'missiles', 'bloated.png')
    const staleWebp = `${bloatedPng}.webp`
    writeFileSync(bloatedPng, Buffer.alloc(1000, 0x22))
    writeFileSync(staleWebp, Buffer.alloc(400, 0x99))
    // Make staleWebp older than bloatedPng so freshness check triggers re-encode
    const past = new Date(Date.now() - 10_000)
    utimesSync(staleWebp, past, past)

    // 3) File whose encoded WebP is < 95% of source bytes (400 < 1000 * 0.95)
    const compactPng = join(publicDir, 'missiles', 'compact.png')
    writeFileSync(compactPng, Buffer.alloc(1000, 0x33))

    const encoderCalls: string[] = []
    const summary = await bakeSidecarCompression({
      publicDir,
      enableGzip: false,
      webpEncoder: (ctx: WebpEncodeContext) => {
        encoderCalls.push(ctx.inputPath)
        if (ctx.inputPath.endsWith('bloated.png')) {
          return Buffer.alloc(960, 0x55) // 96% >= 95% threshold -> must skip & prune stale .webp
        }
        return buildMinimalValidWebp(300) // ~344 bytes < 950 bytes -> keep
      },
    })

    expect(encoderCalls).toHaveLength(2)
    expect(existsSync(`${tinyPng}.webp`)).toBe(false)
    expect(existsSync(staleWebp)).toBe(false)
    expect(existsSync(`${compactPng}.webp`)).toBe(true)
    expect(summary.webpEncodedFiles).toBe(1)
    expect(summary.webpPrunedFiles).toBe(1)
    expect(summary.processedFiles).toBe(2)
  })

  it('skips up-to-date sidecars by mtime, re-encodes when source is newer, and bounds concurrency', async () => {
    const publicDir = mkdtempSync(join(tmpdir(), 'd2-sidecar-mtime-'))
    tempDirs.push(publicDir)
    mkdirSync(join(publicDir, 'skills'), { recursive: true })

    for (let i = 0; i < 8; i += 1) {
      writeFileSync(join(publicDir, 'skills', `icon_${i}.png`), Buffer.alloc(1024, i + 1))
    }
    writeFileSync(join(publicDir, 'skills', 'manifest.json'), JSON.stringify({ icons: 'a'.repeat(1024) }))

    let inFlight = 0
    let maxInFlight = 0
    let encodeCount = 0

    const webpEncoder = async (): Promise<Uint8Array> => {
      encodeCount += 1
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 15))
      inFlight -= 1
      return buildMinimalValidWebp(32)
    }

    const first = await bakeSidecarCompression({
      publicDir,
      concurrency: 3,
      webpEncoder,
    })
    expect(encodeCount).toBe(8)
    expect(maxInFlight).toBeLessThanOrEqual(3)
    expect(maxInFlight).toBeGreaterThanOrEqual(2)
    expect(first.webpEncodedFiles).toBe(8)
    expect(first.gzipEncodedFiles).toBe(1)
    expect(first.skippedFreshFiles).toBe(0)

    // Second run: all 8 .webp + 1 .gz sidecars are fresh -> zero re-encodes
    const second = await bakeSidecarCompression({
      publicDir,
      concurrency: 3,
      webpEncoder,
    })
    expect(encodeCount).toBe(8)
    expect(second.webpEncodedFiles).toBe(0)
    expect(second.webpSkippedFreshFiles).toBe(8)
    expect(second.gzipEncodedFiles).toBe(0)
    expect(second.skippedFreshFiles).toBe(9)
    expect(second.compressedBytes).toBe(first.compressedBytes)

    // Touch icon_2.png mtime forward -> only icon_2.png is re-encoded
    const future = new Date(Date.now() + 10_000)
    utimesSync(join(publicDir, 'skills', 'icon_2.png'), future, future)
    const third = await bakeSidecarCompression({
      publicDir,
      concurrency: 3,
      webpEncoder,
    })
    expect(encodeCount).toBe(9)
    expect(third.webpEncodedFiles).toBe(1)
    expect(third.webpSkippedFreshFiles).toBe(7)
  })

  it('emits an explicit actionable warning when cwebp is missing instead of silently claiming WebP was baked', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'd2-sidecar-nocwebp-'))
    tempDirs.push(workDir)
    const emptyBinDir = join(workDir, 'empty-bin')
    const publicDir = join(workDir, 'public')
    mkdirSync(emptyBinDir, { recursive: true })
    mkdirSync(join(publicDir, 'overlays'), { recursive: true })
    writeFileSync(join(publicDir, 'overlays', 'curse.png'), Buffer.alloc(2048, 0x77))
    writeFileSync(join(publicDir, 'overlays', 'manifest.json'), JSON.stringify({ data: 'z'.repeat(1500) }))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const summary = await bakeSidecarCompression({
      publicDir,
      env: { PATH: emptyBinDir },
    })

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain('cwebp not found on PATH; skipping .webp sidecars')
    expect(warnSpy.mock.calls[0]?.[0]).toContain('apt-get install -y webp')
    expect(summary.webpSkippedReason).toContain('cwebp not found on PATH')
    expect(summary.warnings).toHaveLength(1)
    expect(summary.webpEncodedFiles).toBe(0)
    // Only the compressible .json file was processed; unencoded .png is not falsely counted
    expect(summary.processedFiles).toBe(1)
    expect(summary.gzipEncodedFiles).toBe(1)
    expect(existsSync(join(publicDir, 'overlays', 'curse.png.webp'))).toBe(false)
    expect(existsSync(join(publicDir, 'overlays', 'manifest.json.gz'))).toBe(true)
  })

  it('encodes real RGBA PNG fixtures into valid RIFF....WEBP containers and serves them end-to-end', async () => {
    const publicDir = mkdtempSync(join(tmpdir(), 'd2-sidecar-real-webp-'))
    tempDirs.push(publicDir)
    mkdirSync(join(publicDir, 'missiles'), { recursive: true })

    // Build a genuine 64x64 RGBA PNG sprite via src/baker/io/png.ts
    const width = 64
    const height = 64
    const pixels = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4
        if (x >= 16 && x < 48 && y >= 16 && y < 48) {
          pixels[idx] = 255
          pixels[idx + 1] = 96
          pixels[idx + 2] = 16
          pixels[idx + 3] = 220
        }
      }
    }
    const pngBytes = encodeRgbaPng({ width, height, pixels, compressionLevel: 0 })
    const pngPath = join(publicDir, 'missiles', 'firebolt.png')
    writeFileSync(pngPath, pngBytes)
    expect(pngBytes.byteLength).toBeGreaterThan(512)

    const hasMagick = hasCommand('magick', ['-version'])
    const summary = await bakeSidecarCompression({
      publicDir,
      enableGzip: false,
      webpEncoder: (ctx) => {
        if (hasMagick) {
          const res = spawnSync(
            'magick',
            [ctx.inputPath, '-define', 'webp:lossless=true', `WEBP:${ctx.outputPath}`],
            { stdio: 'pipe' },
          )
          if (res.status !== 0) {
            throw new Error(`magick failed: ${res.stderr.toString('utf8')}`)
          }
          return
        }
        return buildMinimalValidWebp()
      },
    })

    expect(summary.webpEncodedFiles).toBe(1)
    const webpPath = `${pngPath}.webp`
    expect(existsSync(webpPath)).toBe(true)
    const webpBytes = readFileSync(webpPath)
    expect(webpBytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(webpBytes.readUInt32LE(4)).toBe(webpBytes.byteLength - 8)
    expect(webpBytes.subarray(8, 12).toString('ascii')).toBe('WEBP')
    expect(['VP8L', 'VP8 ', 'VP8X']).toContain(webpBytes.subarray(12, 16).toString('ascii'))
    expect(webpBytes.byteLength).toBeLessThan(pngBytes.byteLength * 0.95)

    const middleware = createSidecarAssetHttpMiddleware({ publicDir })
    const headRes = await invokeMiddleware(
      middleware,
      '/diablo2/missiles/firebolt.png',
      { accept: 'image/webp' },
      'HEAD',
    )
    expect(headRes.nextCalled).toBe(false)
    expect(headRes.headers['content-type']).toBe('image/webp')
    expect(headRes.headers['content-length']).toBe(String(webpBytes.byteLength))
    expect(headRes.headers['x-asset-sidecar']).toBe('webp')
  })

  it('parses CLI flags and builds canonical cwebp arguments', () => {
    expect(
      buildCwebpArgs({
        inputPath: '/in/atlas.png',
        outputPath: '/out/atlas.png.webp.tmp',
        ext: '.png',
        lossless: true,
        losslessLevel: 3,
        quality: 82,
      }),
    ).toEqual(['-quiet', '-lossless', '-z', '3', '/in/atlas.png', '-o', '/out/atlas.png.webp.tmp'])

    expect(
      buildCwebpArgs({
        inputPath: '/in/bg.jpg',
        outputPath: '/out/bg.jpg.webp.tmp',
        ext: '.jpg',
        lossless: false,
        losslessLevel: 3,
        quality: 82,
      }),
    ).toEqual(['-quiet', '-q', '82', '/in/bg.jpg', '-o', '/out/bg.jpg.webp.tmp'])

    expect(
      parseSidecarCliArgs([
        '--brotli',
        '--no-gzip',
        '--no-webp',
        '--force',
        '--cwebp',
        '/opt/bin/cwebp',
        '--public-dir=/tmp/pub',
        '--concurrency=4',
      ]),
    ).toEqual({
      enableBrotli: true,
      enableGzip: false,
      enableWebp: false,
      force: true,
      cwebpBin: '/opt/bin/cwebp',
      publicDir: '/tmp/pub',
      concurrency: 4,
    })
  })

  it('skips redundant .json HTTP requests for bundled missile/overlay metas and loads lazily on demand when { lazy: true }', async () => {
    const requestedUrls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      const cleanUrl = decodeURIComponent(url)
      requestedUrls.push(cleanUrl)
      if (cleanUrl.endsWith('/manifest.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ schema: 1, atlases: {}, missiles: {}, overlays: {} }),
        }
      }
      if (cleanUrl.endsWith('.png')) {
        return {
          ok: true,
          status: 200,
          blob: async () => new Blob([new Uint8Array([1, 2, 3, 4])]),
        }
      }
      return { ok: false, status: 404 }
    })
    vi.stubGlobal('createImageBitmap', async () => ({
      width: 64,
      height: 64,
      close: () => undefined,
    }))

    const missileMap = await loadMissileArtMap(createMockRenderer(), undefined, {
      lazy: true,
      preloadStems: ['arrow', 'firebolt'],
    })

    // Zero .json requests for standard missiles because MISSILE_METAS already contains frame tuples
    const jsonFetches = requestedUrls.filter(
      (u) => u.endsWith('.json') && !u.endsWith('/manifest.json'),
    )
    expect(jsonFetches).toEqual([])

    // Only preloaded stems were fetched on boot
    const bootPngFetches = requestedUrls.filter((u) => u.endsWith('.png'))
    expect(bootPngFetches.length).toBe(2)
    expect(missileMap.get('arrow')).toBeDefined()
    expect(missileMap.get('firebolt')).toBeDefined()

    // Non-preloaded stem ('poisonnova') is not yet in memory; first get() triggers background load
    expect(missileMap.get('poisonnova')).toBeUndefined()
    await missileMap.waitForInflight()

    const poisonNovaArt = resolveArtByCelFile(missileMap, 'poisonnova', 'poisonnova')
    expect(poisonNovaArt).toBeDefined()
    expect(requestedUrls.some((u) => u.endsWith('/missiles/poisonnova.png'))).toBe(true)

    const overlayMap = await loadOverlayArtMap(createMockRenderer(), undefined, {
      lazy: true,
      preloadStems: ['town_portal_op_tr'],
    })
    expect(overlayMap.get('town_portal_op_tr')).toBeDefined()
  })
})
