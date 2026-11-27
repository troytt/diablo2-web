/**
 * Static Asset Sidecar Compression & Content-Negotiation Middleware (`src/baker/io/sidecar-compression.ts`).
 *
 * Implements zero-code-change bandwidth reduction across two axes:
 * 1. Image WebP negotiation (`.png`, `.jpg`, `.jpeg` -> `<file>.webp` sidecar when `Accept: image/webp` is present).
 * 2. Binary & JSON pre-compressed sidecar negotiation (`.r8`, `.bin`, `.json` -> `<file>.br` / `<file>.gz` when
 *    `Accept-Encoding` includes `br` or `gzip`), plus canonical `application/octet-stream` MIME headers for `.r8`.
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { availableParallelism } from 'node:os'
import { extname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib'

export interface SidecarMiddlewareOptions {
  readonly publicDir?: string | undefined
  readonly stripUrlPrefixes?: readonly string[] | undefined
}

type NextFunction = (err?: unknown) => void

/**
 * Default `public/<subdir>` asset directories scanned by {@link bakeSidecarCompression}.
 * Covers all canonical 1.13c and optional UI/pack asset directories under `public/`.
 */
export const DEFAULT_SIDECAR_SUBDIRS: readonly string[] = Object.freeze([
  'act-packs',
  'packs',
  'entities',
  'characters',
  'chars',
  'ui',
  'ui-pd2',
  'items-pd2',
  'cursor-pd2',
  'missiles',
  'missiles-pd2',
  'overlays',
  'overlays-pd2',
  'skills',
  'anim',
  'backdrop',
  'weather',
  'tiles',
  'assets',
  'sound',
])

export const CWEBP_ENV_VAR = 'CWEBP_PATH'

function resolveCandidatePaths(baseFilePath: string): readonly string[] {
  const out = [baseFilePath]
  try {
    const real = realpathSync(baseFilePath)
    if (real !== baseFilePath) {
      out.push(real)
    }
  } catch {
    // Ignore broken symlinks
  }
  return out
}

function findExistingSidecar(
  baseCandidates: readonly string[],
  suffix: '.webp' | '.br' | '.gz',
): { readonly path: string; readonly size: number } | undefined {
  for (const base of baseCandidates) {
    const candidate = `${base}${suffix}`
    try {
      if (!existsSync(candidate)) continue
      const st = statSync(candidate)
      if (st.isFile() && st.size > 0) {
        return { path: candidate, size: st.size }
      }
    } catch {
      continue
    }
  }
  return undefined
}

function parseAcceptTokens(headerVal: string | string[] | undefined): string {
  if (!headerVal) return ''
  return (Array.isArray(headerVal) ? headerVal.join(',') : headerVal).toLowerCase()
}

function acceptsNegotiatedToken(acceptHeader: string, token: string): boolean {
  if (!acceptHeader) return false
  const target = token.toLowerCase()
  for (const rawPart of acceptHeader.split(',')) {
    const segments = rawPart
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    if (segments.length === 0) continue
    if (segments[0] !== target) continue
    let rejectedByZeroQ = false
    for (let i = 1; i < segments.length; i += 1) {
      const param = segments[i]!
      const eqIdx = param.indexOf('=')
      if (eqIdx < 0) continue
      const key = param.slice(0, eqIdx).trim()
      const val = param.slice(eqIdx + 1).trim()
      if (key === 'q') {
        const q = Number(val)
        if (Number.isFinite(q) && q <= 0) {
          rejectedByZeroQ = true
        }
      }
    }
    if (!rejectedByZeroQ) return true
  }
  return false
}

function appendVaryHeader(res: ServerResponse, token: string): void {
  const existing = res.getHeader('Vary')
  if (!existing) {
    res.setHeader('Vary', token)
    return
  }
  const existingStr = Array.isArray(existing) ? existing.join(', ') : String(existing)
  const parts = existingStr.split(',').map((p) => p.trim().toLowerCase())
  if (!parts.includes(token.toLowerCase())) {
    res.setHeader('Vary', `${existingStr}, ${token}`)
  }
}

/**
 * Connect/Vite HTTP middleware that transparently serves `.webp`, `.br`, and `.gz` sidecar
 * files from `public/` when supported by the client's `Accept` / `Accept-Encoding` headers.
 */
export function createSidecarAssetHttpMiddleware(
  options?: SidecarMiddlewareOptions,
): (req: IncomingMessage, res: ServerResponse, next: NextFunction) => void {
  const publicDir = resolve(options?.publicDir ?? join(process.cwd(), 'public'))
  const stripPrefixes = options?.stripUrlPrefixes ?? ['/diablo2/', '/pd2/']

  return (req: IncomingMessage, res: ServerResponse, next: NextFunction): void => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    const rawUrl = req.url
    if (!rawUrl) {
      next()
      return
    }

    const qIdx = rawUrl.indexOf('?')
    let pathname = qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl
    try {
      pathname = decodeURIComponent(pathname)
    } catch {
      next()
      return
    }

    for (const prefix of stripPrefixes) {
      if (pathname.startsWith(prefix)) {
        pathname = `/${pathname.slice(prefix.length)}`
        break
      }
    }

    // Do not intercept dynamic asset-manifest.json refresh endpoint
    if (pathname === '/asset-manifest.json') {
      next()
      return
    }

    const ext = extname(pathname).toLowerCase()
    const isImage = ext === '.png' || ext === '.jpg' || ext === '.jpeg'
    const isCompressibleData = ext === '.r8' || ext === '.bin' || ext === '.json'
    if (!isImage && !isCompressibleData) {
      next()
      return
    }

    const relPath = pathname.replace(/^\/+/, '')
    if (!relPath || relPath.includes('\0')) {
      next()
      return
    }

    const targetPath = resolve(publicDir, relPath)
    const relCheck = relative(publicDir, targetPath)
    if (relCheck.startsWith('..') || relCheck.startsWith('/')) {
      next()
      return
    }

    let baseStat
    try {
      if (!existsSync(targetPath)) {
        next()
        return
      }
      baseStat = statSync(targetPath)
      if (!baseStat.isFile()) {
        next()
        return
      }
    } catch {
      next()
      return
    }

    const baseCandidates = resolveCandidatePaths(targetPath)

    if (isImage) {
      appendVaryHeader(res, 'Accept')
      if (!req.headers['range']) {
        const accept = parseAcceptTokens(req.headers['accept'])
        if (acceptsNegotiatedToken(accept, 'image/webp')) {
          const webpSidecar = findExistingSidecar(baseCandidates, '.webp')
          if (webpSidecar) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'image/webp')
            res.setHeader('Content-Length', String(webpSidecar.size))
            res.setHeader('X-Asset-Sidecar', 'webp')
            if (req.method === 'HEAD') {
              res.end()
              return
            }
            createReadStream(webpSidecar.path).pipe(res)
            return
          }
        }
      }
      next()
      return
    }

    // .r8, .bin, or .json
    const mimeType = ext === '.json' ? 'application/json; charset=utf-8' : 'application/octet-stream'
    appendVaryHeader(res, 'Accept-Encoding')
    const acceptEncoding = parseAcceptTokens(req.headers['accept-encoding'])

    // Do not serve pre-compressed sidecar if client sent a Range header
    if (!req.headers['range']) {
      if (acceptsNegotiatedToken(acceptEncoding, 'br')) {
        const brSidecar = findExistingSidecar(baseCandidates, '.br')
        if (brSidecar) {
          res.statusCode = 200
          res.setHeader('Content-Type', mimeType)
          res.setHeader('Content-Encoding', 'br')
          res.setHeader('Content-Length', String(brSidecar.size))
          res.setHeader('X-Asset-Sidecar', 'br')
          if (req.method === 'HEAD') {
            res.end()
            return
          }
          createReadStream(brSidecar.path).pipe(res)
          return
        }
      }
      if (acceptsNegotiatedToken(acceptEncoding, 'gzip')) {
        const gzSidecar = findExistingSidecar(baseCandidates, '.gz')
        if (gzSidecar) {
          res.statusCode = 200
          res.setHeader('Content-Type', mimeType)
          res.setHeader('Content-Encoding', 'gzip')
          res.setHeader('Content-Length', String(gzSidecar.size))
          res.setHeader('X-Asset-Sidecar', 'gzip')
          if (req.method === 'HEAD') {
            res.end()
            return
          }
          createReadStream(gzSidecar.path).pipe(res)
          return
        }
      }
    }

    // Ensure .r8 and .bin always have a deterministic Content-Type even without a sidecar
    if (ext === '.r8' || ext === '.bin') {
      res.setHeader('Content-Type', 'application/octet-stream')
    }
    next()
  }
}

export type ImageSidecarSourceExt = '.png' | '.jpg' | '.jpeg'

export interface WebpEncodeContext {
  readonly inputPath: string
  readonly outputPath: string
  readonly ext: ImageSidecarSourceExt
  readonly lossless: boolean
  readonly losslessLevel: number
  readonly quality: number
}

/**
 * Pluggable WebP encoder hook. Implementations may either return encoded WebP bytes
 * (`Uint8Array` / `Buffer`) or write directly to `ctx.outputPath` and return `void`.
 */
export type WebpEncoderFn = (
  ctx: WebpEncodeContext,
) => Promise<Uint8Array | void> | Uint8Array | void

export interface SidecarCompressionOptions {
  readonly publicDir?: string | undefined
  readonly subdirs?: readonly string[] | undefined
  readonly enableWebp?: boolean | undefined
  readonly enableBrotli?: boolean | undefined
  readonly enableGzip?: boolean | undefined
  readonly webpLosslessLevel?: number | undefined
  readonly webpQuality?: number | undefined
  readonly brotliQuality?: number | undefined
  readonly gzipLevel?: number | undefined
  readonly minBytes?: number | undefined
  readonly maxSidecarRatio?: number | undefined
  readonly concurrency?: number | undefined
  readonly force?: boolean | undefined
  readonly cwebpBin?: string | undefined
  readonly webpEncoder?: WebpEncoderFn | undefined
  readonly env?: NodeJS.ProcessEnv | undefined
  readonly onWarn?: ((message: string) => void) | undefined
}

export type BakeSidecarOptions = SidecarCompressionOptions

export interface BakeSidecarSummary {
  readonly processedFiles: number
  readonly originalBytes: number
  readonly compressedBytes: number
  readonly encodedFiles: number
  readonly skippedFreshFiles: number
  readonly webpEncodedFiles: number
  readonly webpSkippedFreshFiles: number
  readonly webpPrunedFiles: number
  readonly gzipEncodedFiles: number
  readonly brotliEncodedFiles: number
  readonly warnings: readonly string[]
  readonly webpSkippedReason?: string | undefined
}

function classifyImageExt(fileName: string): ImageSidecarSourceExt | undefined {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return '.png'
  if (lower.endsWith('.jpg')) return '.jpg'
  if (lower.endsWith('.jpeg')) return '.jpeg'
  return undefined
}

function shouldCompressDataFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  if (lower === 'asset-manifest.json') return false
  if (lower.endsWith('.r8') || lower.endsWith('.json')) return true
  if (
    lower.endsWith('.bin') &&
    (lower.includes('drlg-bundle') || lower.includes('palette') || lower === 'meta.bin')
  ) {
    return true
  }
  return false
}

let tempCounter = 0

function makeTempSidecarPath(targetPath: string): string {
  tempCounter += 1
  return `${targetPath}.tmp.${process.pid}.${tempCounter}`
}

function removeIfExists(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true })
    }
  } catch {
    // Ignore concurrent cleanup races
  }
}

function writeAtomicSidecar(targetPath: string, data: Uint8Array): void {
  const tmpPath = makeTempSidecarPath(targetPath)
  try {
    writeFileSync(tmpPath, data)
    renameSync(tmpPath, targetPath)
  } finally {
    removeIfExists(tmpPath)
  }
}

function getFreshSidecarSize(
  sidecarPath: string,
  srcMtimeMs: number,
  srcBytes: number,
  maxSidecarRatio: number,
): number | undefined {
  try {
    if (!existsSync(sidecarPath)) return undefined
    const st = statSync(sidecarPath)
    if (st.isFile() && st.size > 0 && st.mtimeMs >= srcMtimeMs && st.size < srcBytes * maxSidecarRatio) {
      return st.size
    }
  } catch {
    return undefined
  }
  return undefined
}

/**
 * Builds the `cwebp` CLI argument list for lossless `.png` or lossy `.jpg`/`.jpeg` sidecars.
 */
export function buildCwebpArgs(ctx: WebpEncodeContext): readonly string[] {
  if (ctx.lossless) {
    return ['-quiet', '-lossless', '-z', String(ctx.losslessLevel), ctx.inputPath, '-o', ctx.outputPath]
  }
  return ['-quiet', '-q', String(ctx.quality), ctx.inputPath, '-o', ctx.outputPath]
}

/**
 * Probes whether `cwebp` is available and executable. Returns the resolved command string
 * when `cwebp -version` exits 0, or `null` otherwise.
 */
export function probeCwebpBinary(
  cwebpBin?: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const candidate = (cwebpBin ?? env[CWEBP_ENV_VAR] ?? 'cwebp').trim()
  if (!candidate) return null
  try {
    const res = spawnSync(candidate, ['-version'], {
      env,
      stdio: 'ignore',
    })
    if (!res.error && res.status === 0) {
      return candidate
    }
  } catch {
    return null
  }
  return null
}

function createCliCwebpEncoder(cwebpBin: string, env: NodeJS.ProcessEnv): WebpEncoderFn {
  return (ctx: WebpEncodeContext): Promise<void> =>
    new Promise((resolvePromise, rejectPromise) => {
      const args = buildCwebpArgs(ctx)
      const child = spawn(cwebpBin, args, {
        env,
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      const stderrChunks: Buffer[] = []
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrChunks.push(Buffer.from(chunk))
      })
      child.on('error', (err) => {
        rejectPromise(new Error(`Failed to execute cwebp ("${cwebpBin}") on ${ctx.inputPath}: ${err.message}`))
      })
      child.on('close', (code) => {
        if (code === 0) {
          resolvePromise()
          return
        }
        const stderrText = Buffer.concat(stderrChunks).toString('utf8').trim()
        rejectPromise(
          new Error(
            `cwebp exited with code ${String(code)} for ${ctx.inputPath}${stderrText ? `: ${stderrText}` : ''}`,
          ),
        )
      })
    })
}

async function runWithConcurrency(
  tasks: readonly (() => Promise<void>)[],
  concurrency: number,
): Promise<void> {
  if (tasks.length === 0) return
  const limit = Math.max(1, Math.trunc(concurrency))
  let nextIndex = 0
  const runWorker = async (): Promise<void> => {
    while (true) {
      const idx = nextIndex
      nextIndex += 1
      if (idx >= tasks.length) return
      await tasks[idx]!()
    }
  }
  const workerCount = Math.min(limit, tasks.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
}

/**
 * Generates `.webp` sidecar files for `.png`/`.jpg`/`.jpeg` images and `.gz` (plus optional `.br`)
 * pre-compressed sidecar files for `.r8`, `.bin`, and `.json` assets under `public/`.
 */
export async function bakeSidecarCompression(
  options?: SidecarCompressionOptions,
): Promise<BakeSidecarSummary> {
  const env = options?.env ?? process.env
  const publicDir = resolve(options?.publicDir ?? join(process.cwd(), 'public'))
  const subdirs = options?.subdirs ?? DEFAULT_SIDECAR_SUBDIRS
  const enableWebp = options?.enableWebp ?? true
  const enableGzip = options?.enableGzip ?? true
  const enableBrotli = options?.enableBrotli ?? false
  const webpLosslessLevel = Math.max(0, Math.min(9, Math.trunc(options?.webpLosslessLevel ?? 3)))
  const webpQuality = Math.max(0, Math.min(100, Math.trunc(options?.webpQuality ?? 82)))
  const gzipLevel = options?.gzipLevel ?? 6
  const brotliQuality = options?.brotliQuality ?? 6
  const minBytes = options?.minBytes ?? 512
  const maxSidecarRatio = options?.maxSidecarRatio ?? 0.95
  const defaultParallelism = Math.max(1, Math.min(availableParallelism(), 8))
  const concurrency = Math.max(1, Math.trunc(options?.concurrency ?? defaultParallelism))
  const force = options?.force ?? false
  const warn =
    options?.onWarn ??
    ((message: string): void => {
      console.warn(`⚠ [sidecar-compression] ${message}`)
    })

  const warnings: string[] = []
  let webpSkippedReason: string | undefined
  let activeWebpEncoder: WebpEncoderFn | undefined

  if (enableWebp) {
    if (options?.webpEncoder) {
      activeWebpEncoder = options.webpEncoder
    } else {
      const requestedBin = (options?.cwebpBin ?? env[CWEBP_ENV_VAR] ?? 'cwebp').trim() || 'cwebp'
      const resolvedCwebp = probeCwebpBinary(requestedBin, env)
      if (resolvedCwebp) {
        activeWebpEncoder = createCliCwebpEncoder(resolvedCwebp, env)
      } else {
        const message =
          requestedBin === 'cwebp'
            ? 'cwebp not found on PATH; skipping .webp sidecars (install webp package, e.g. apt-get install -y webp)'
            : `cwebp binary "${requestedBin}" not found or not executable; skipping .webp sidecars (install webp package, e.g. apt-get install -y webp, or check ${CWEBP_ENV_VAR} / --cwebp)`
        warnings.push(message)
        webpSkippedReason = message
        warn(message)
      }
    }
  }

  let processedFiles = 0
  let originalBytes = 0
  let compressedBytes = 0
  let encodedFiles = 0
  let skippedFreshFiles = 0
  let webpEncodedFiles = 0
  let webpSkippedFreshFiles = 0
  let webpPrunedFiles = 0
  let gzipEncodedFiles = 0
  let brotliEncodedFiles = 0

  const imageFiles: Array<{ readonly fullPath: string; readonly ext: ImageSidecarSourceExt }> = []
  const dataFiles: string[] = []

  const walk = (dir: string): void => {
    if (!existsSync(dir)) return
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink() || entry.name.includes('.tmp.')) {
        continue
      }
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (!entry.isFile()) continue

      const imageExt = classifyImageExt(entry.name)
      if (imageExt !== undefined) {
        imageFiles.push({ fullPath, ext: imageExt })
      } else if (shouldCompressDataFile(entry.name)) {
        dataFiles.push(fullPath)
      }
    }
  }

  const visitedSubdirs = new Set<string>()
  for (const sub of subdirs) {
    const dirPath = resolve(publicDir, sub)
    if (visitedSubdirs.has(dirPath)) continue
    visitedSubdirs.add(dirPath)
    walk(dirPath)
  }

  if (enableGzip || enableBrotli) {
    for (const fullPath of dataFiles) {
      let srcStat
      try {
        srcStat = statSync(fullPath)
      } catch {
        continue
      }
      if (!srcStat.isFile() || srcStat.size < minBytes) continue

      const gzPath = `${fullPath}.gz`
      const brPath = `${fullPath}.br`
      const gzFreshSize =
        enableGzip && !force
          ? getFreshSidecarSize(gzPath, srcStat.mtimeMs, srcStat.size, maxSidecarRatio)
          : undefined
      const brFreshSize =
        enableBrotli && !force
          ? getFreshSidecarSize(brPath, srcStat.mtimeMs, srcStat.size, maxSidecarRatio)
          : undefined
      const needGzip = enableGzip && gzFreshSize === undefined
      const needBrotli = enableBrotli && brFreshSize === undefined

      if (!needGzip && !needBrotli) {
        processedFiles += 1
        skippedFreshFiles += 1
        originalBytes += srcStat.size
        let bestBytes = srcStat.size
        if (gzFreshSize !== undefined) bestBytes = Math.min(bestBytes, gzFreshSize)
        if (brFreshSize !== undefined) bestBytes = Math.min(bestBytes, brFreshSize)
        compressedBytes += bestBytes
        continue
      }

      const raw = readFileSync(fullPath)
      if (raw.byteLength < minBytes) continue
      processedFiles += 1
      originalBytes += raw.byteLength
      let bestBytes = raw.byteLength
      let didEncode = false

      if (gzFreshSize !== undefined) {
        bestBytes = Math.min(bestBytes, gzFreshSize)
      } else if (needGzip) {
        const gz = gzipSync(raw, { level: gzipLevel })
        if (gz.byteLength > 0 && gz.byteLength < raw.byteLength * maxSidecarRatio) {
          writeAtomicSidecar(gzPath, gz)
          bestBytes = Math.min(bestBytes, gz.byteLength)
          gzipEncodedFiles += 1
          didEncode = true
        } else {
          removeIfExists(gzPath)
        }
      }

      if (brFreshSize !== undefined) {
        bestBytes = Math.min(bestBytes, brFreshSize)
      } else if (needBrotli) {
        const br = brotliCompressSync(raw, {
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: brotliQuality,
          },
        })
        if (br.byteLength > 0 && br.byteLength < raw.byteLength * maxSidecarRatio) {
          writeAtomicSidecar(brPath, br)
          bestBytes = Math.min(bestBytes, br.byteLength)
          brotliEncodedFiles += 1
          didEncode = true
        } else {
          removeIfExists(brPath)
        }
      }

      if (didEncode) {
        encodedFiles += 1
      }
      compressedBytes += bestBytes
    }
  }

  if (enableWebp && activeWebpEncoder) {
    const encoder = activeWebpEncoder
    const webpTasks: Array<() => Promise<void>> = []

    for (const { fullPath, ext } of imageFiles) {
      let srcStat
      try {
        srcStat = statSync(fullPath)
      } catch {
        continue
      }
      if (!srcStat.isFile() || srcStat.size < minBytes) continue

      const srcSize = srcStat.size
      const webpPath = `${fullPath}.webp`
      const freshSize = force
        ? undefined
        : getFreshSidecarSize(webpPath, srcStat.mtimeMs, srcSize, maxSidecarRatio)

      if (freshSize !== undefined) {
        processedFiles += 1
        skippedFreshFiles += 1
        webpSkippedFreshFiles += 1
        originalBytes += srcSize
        compressedBytes += freshSize
        continue
      }

      webpTasks.push(async () => {
        const tmpPath = makeTempSidecarPath(webpPath)
        try {
          const maybeBytes = await encoder({
            inputPath: fullPath,
            outputPath: tmpPath,
            ext,
            lossless: ext === '.png',
            losslessLevel: webpLosslessLevel,
            quality: webpQuality,
          })

          let outBytes = 0
          if (maybeBytes instanceof Uint8Array) {
            outBytes = maybeBytes.byteLength
            if (outBytes > 0 && outBytes < srcSize * maxSidecarRatio) {
              writeAtomicSidecar(webpPath, maybeBytes)
              webpEncodedFiles += 1
              encodedFiles += 1
              compressedBytes += outBytes
            } else {
              removeIfExists(webpPath)
              webpPrunedFiles += 1
              compressedBytes += srcSize
            }
          } else {
            if (existsSync(tmpPath)) {
              outBytes = statSync(tmpPath).size
            }
            if (outBytes > 0 && outBytes < srcSize * maxSidecarRatio) {
              renameSync(tmpPath, webpPath)
              webpEncodedFiles += 1
              encodedFiles += 1
              compressedBytes += outBytes
            } else {
              removeIfExists(tmpPath)
              removeIfExists(webpPath)
              webpPrunedFiles += 1
              compressedBytes += srcSize
            }
          }

          processedFiles += 1
          originalBytes += srcSize
        } finally {
          removeIfExists(tmpPath)
        }
      })
    }

    await runWithConcurrency(webpTasks, concurrency)
  }

  return {
    processedFiles,
    originalBytes,
    compressedBytes,
    encodedFiles,
    skippedFreshFiles,
    webpEncodedFiles,
    webpSkippedFreshFiles,
    webpPrunedFiles,
    gzipEncodedFiles,
    brotliEncodedFiles,
    warnings,
    ...(webpSkippedReason !== undefined ? { webpSkippedReason } : {}),
  }
}

export function parseSidecarCliArgs(argv: readonly string[]): SidecarCompressionOptions {
  let enableBrotli: boolean | undefined
  let enableGzip: boolean | undefined
  let enableWebp: boolean | undefined
  let force: boolean | undefined
  let cwebpBin: string | undefined
  let publicDir: string | undefined
  let concurrency: number | undefined

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    if (arg === '--brotli') {
      enableBrotli = true
    } else if (arg === '--no-gzip') {
      enableGzip = false
    } else if (arg === '--no-webp') {
      enableWebp = false
    } else if (arg === '--force') {
      force = true
    } else if (arg === '--cwebp') {
      const next = argv[i + 1]
      if (!next) throw new Error('Missing value for --cwebp <path>')
      cwebpBin = next
      i += 1
    } else if (arg.startsWith('--cwebp=')) {
      cwebpBin = arg.slice('--cwebp='.length)
    } else if (arg === '--public-dir') {
      const next = argv[i + 1]
      if (!next) throw new Error('Missing value for --public-dir <path>')
      publicDir = next
      i += 1
    } else if (arg.startsWith('--public-dir=')) {
      publicDir = arg.slice('--public-dir='.length)
    } else if (arg === '--concurrency') {
      const next = argv[i + 1]
      const parsed = Number(next)
      if (!next || !Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`Invalid value for --concurrency: ${String(next)}`)
      }
      concurrency = parsed
      i += 1
    } else if (arg.startsWith('--concurrency=')) {
      const raw = arg.slice('--concurrency='.length)
      const parsed = Number(raw)
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`Invalid value for --concurrency: ${raw}`)
      }
      concurrency = parsed
    }
  }

  return {
    ...(enableBrotli !== undefined ? { enableBrotli } : {}),
    ...(enableGzip !== undefined ? { enableGzip } : {}),
    ...(enableWebp !== undefined ? { enableWebp } : {}),
    ...(force !== undefined ? { force } : {}),
    ...(cwebpBin !== undefined ? { cwebpBin } : {}),
    ...(publicDir !== undefined ? { publicDir } : {}),
    ...(concurrency !== undefined ? { concurrency } : {}),
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMain) {
  const cliOptions = parseSidecarCliArgs(process.argv.slice(2))
  bakeSidecarCompression(cliOptions)
    .then((summary) => {
      const webpDetail = summary.webpSkippedReason
        ? 'webp skipped (cwebp unavailable)'
        : `webp=${summary.webpEncodedFiles} encoded / ${summary.webpSkippedFreshFiles} fresh / ${summary.webpPrunedFiles} >=95%`
      console.log(
        `✓ Baked sidecar compression for ${summary.processedFiles} files: ${(summary.originalBytes / (1024 * 1024)).toFixed(2)} MB -> ${(summary.compressedBytes / (1024 * 1024)).toFixed(2)} MB (${webpDetail}, gzip=${summary.gzipEncodedFiles}, brotli=${summary.brotliEncodedFiles}, fresh=${summary.skippedFreshFiles})`,
      )
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`✗ Sidecar compression failed: ${msg}`)
      process.exitCode = 1
    })
}
