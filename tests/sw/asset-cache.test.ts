import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  CACHEABLE_PREFIXES,
  INTENTIONALLY_UNCACHED_PUBLIC_DIRS,
  INTENTIONALLY_UNCACHED_PUBLIC_FILES,
  diffAssetManifests,
  isCacheableAssetPath,
  normalizeAssetManifestPath,
  validateAssetManifest,
  type AssetManifest,
} from '../../src/common/pack-contract/index.ts'
import {
  generateAssetManifest,
  hashFileSha256Prefix,
  validatePublicAssetRoots,
} from '../../src/baker/io/asset-manifest.ts'
import {
  ASSET_CACHE_NAME,
  type CacheLike,
  type CacheStorageLike,
} from '../../src/client/sw/protocol.ts'
import {
  AssetCacheServiceWorkerController,
  isCacheableResponse,
  isImmutableHashedAsset,
  shouldBypassCache,
} from '../../src/client/sw/sw.ts'
import {
  formatCacheBytesMb,
  shouldEnableAssetCacheSw,
} from '../../src/client/sw/register.ts'
import { Toolbar } from '../../src/client/toolbar/toolbar.ts'
import { createSettingsStore } from '../../src/client/settings/settings-store.ts'

class MockCache implements CacheLike {
  readonly store = new Map<string, { request: Request; response: Response }>()
  throwQuotaOnPut = false

  private keyOf(req: Request | string): string {
    return typeof req === 'string' ? req : req.url
  }

  async match(request: Request | string): Promise<Response | undefined> {
    const entry = this.store.get(this.keyOf(request))
    return entry ? entry.response.clone() : undefined
  }

  async put(request: Request | string, response: Response): Promise<void> {
    if (this.throwQuotaOnPut) {
      const err = new Error('QuotaExceededError: storage full')
      err.name = 'QuotaExceededError'
      throw err
    }
    const reqObj = typeof request === 'string' ? new Request(request) : request
    this.store.set(this.keyOf(request), {
      request: reqObj,
      response: response.clone(),
    })
  }

  async delete(request: Request | string): Promise<boolean> {
    return this.store.delete(this.keyOf(request))
  }

  async keys(): Promise<readonly Request[]> {
    return [...this.store.values()].map((v) => v.request)
  }
}

class MockCacheStorage implements CacheStorageLike {
  readonly buckets = new Map<string, MockCache>()
  throwOnOpen = false

  async open(cacheName: string): Promise<MockCache> {
    if (this.throwOnOpen) {
      throw new Error('SecurityError: The operation is insecure.')
    }
    let bucket = this.buckets.get(cacheName)
    if (!bucket) {
      bucket = new MockCache()
      this.buckets.set(cacheName, bucket)
    }
    return bucket
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.buckets.delete(cacheName)
  }

  async keys(): Promise<readonly string[]> {
    return [...this.buckets.keys()]
  }
}

const SAMPLE_MANIFEST_V1: AssetManifest = {
  schema: 1,
  version: '1111222233334444',
  generatedAt: '2026-10-01T00:00:00.000Z',
  totalFiles: 4,
  totalBytes: 4096,
  files: {
    'act-packs/tiles/index.json': 'aaaa1111bbbb2222',
    'missiles/arrow.json': 'cccc3333dddd4444',
    'missiles/arrow.png': 'eeee5555ffff6666',
    'packs/entities/char-so.r8': '1234567890abcdef',
  },
}

describe('Client Asset Cache & Per-File Hash Invalidation (Service Worker + Cache Storage)', () => {
  it('normalizes asset paths consistently across /, /diablo2/, and /samples/d2-packs/', () => {
    expect(
      normalizeAssetManifestPath('https://www.laiseek.xyz/diablo2/act-packs/tiles/index.json'),
    ).toBe('act-packs/tiles/index.json')
    expect(
      normalizeAssetManifestPath('/act-packs/tiles/index.json?v=123#top'),
    ).toBe('act-packs/tiles/index.json')
    expect(
      normalizeAssetManifestPath('/samples/d2-packs/entities/char-so.r8'),
    ).toBe('packs/entities/char-so.r8')
    expect(
      normalizeAssetManifestPath('/diablo2/samples/d2-packs/entities/char-so.r8'),
    ).toBe('packs/entities/char-so.r8')
    expect(
      normalizeAssetManifestPath('/diablo2/packs/entities/char-so.r8'),
    ).toBe('packs/entities/char-so.r8')
    expect(normalizeAssetManifestPath('missiles\\arrow.png')).toBe('missiles/arrow.png')
  })

  it('classifies cacheable art/JSON assets while strictly bypassing .mpq, Range, manifest, sw.js, and WebSockets', () => {
    expect(isCacheableAssetPath('/diablo2/packs/act1/town/scene.json')).toBe(true)
    expect(isCacheableAssetPath('/diablo2/packs/act1/town/page0.png')).toBe(true)
    expect(isCacheableAssetPath('/samples/d2-packs/entities/char-so.r8')).toBe(true)
    expect(isCacheableAssetPath('/act-packs/tiles/drlg-bundle.bin')).toBe(true)
    expect(isCacheableAssetPath('/samples/d2-packs/anim/AnimData.d2')).toBe(true)
    expect(isCacheableAssetPath('/samples/d2-packs/anim/HitClass.txt')).toBe(true)
    expect(isCacheableAssetPath('/missiles/arrow.png')).toBe(true)
    expect(isCacheableAssetPath('/overlays/cast.json')).toBe(true)
    expect(isCacheableAssetPath('/skills/icon_36.png')).toBe(true)
    expect(isCacheableAssetPath('/ui/manifest.json')).toBe(true)
    expect(isCacheableAssetPath('/diablo2/assets/play-Zb_JWO5r.js')).toBe(true)
    expect(isCacheableAssetPath('cursor-pd2/manifest.json')).toBe(true)
    expect(isCacheableAssetPath('cursor-pd2/hand.png')).toBe(true)
    expect(isCacheableAssetPath('cursor-pd2/other.png')).toBe(true)
    expect(isCacheableAssetPath('/diablo2/cursor-pd2/hand.png')).toBe(true)

    // Excluded paths
    expect(isCacheableAssetPath('/diablo2/data/d2char.mpq')).toBe(false)
    expect(isCacheableAssetPath('/samples/d2/Patch_D2.mpq')).toBe(false)
    expect(isCacheableAssetPath('/diablo2/asset-manifest.json')).toBe(false)
    expect(isCacheableAssetPath('/asset-manifest.json')).toBe(false)
    expect(isCacheableAssetPath('/diablo2/sw.js')).toBe(false)
    expect(isCacheableAssetPath('/sw.js')).toBe(false)
    expect(isCacheableAssetPath('/d2net/ws')).toBe(false)
    expect(isCacheableAssetPath('/play.html')).toBe(false)

    const origin = 'https://www.laiseek.xyz'
    // Range header must bypass
    const rangeReq = new Request(`${origin}/diablo2/packs/act1/page0.png`, {
      headers: { Range: 'bytes=0-1023' },
    })
    expect(shouldBypassCache(rangeReq, origin)).toBe(true)

    // POST must bypass
    const postReq = new Request(`${origin}/diablo2/packs/index.json`, { method: 'POST' })
    expect(shouldBypassCache(postReq, origin)).toBe(true)

    // Cross-origin must bypass
    const crossReq = new Request('https://other.example.com/missiles/arrow.png')
    expect(shouldBypassCache(crossReq, origin)).toBe(true)

    // Normal GET art/json request does NOT bypass
    const okReq = new Request(`${origin}/diablo2/missiles/arrow.png`)
    expect(shouldBypassCache(okReq, origin)).toBe(false)

    // Immutable Vite bundle detection
    expect(isImmutableHashedAsset('/diablo2/assets/play-Zb_JWO5r.js')).toBe(true)
    expect(isImmutableHashedAsset('/assets/ui/panel.png')).toBe(false)
  })

  it('validates AssetManifest strictly and fails fast on corrupt inputs', () => {
    expect(validateAssetManifest(SAMPLE_MANIFEST_V1)).toEqual(SAMPLE_MANIFEST_V1)

    expect(() => validateAssetManifest(null)).toThrow(/expected JSON object/)
    expect(() => validateAssetManifest({ ...SAMPLE_MANIFEST_V1, schema: 2 })).toThrow(/schema/)
    expect(() => validateAssetManifest({ ...SAMPLE_MANIFEST_V1, version: '' })).toThrow(/version/)
    expect(() =>
      validateAssetManifest({
        ...SAMPLE_MANIFEST_V1,
        files: { '../secret.txt': 'aaaa1111bbbb2222' },
      }),
    ).toThrow(/invalid asset path key/)
    expect(() =>
      validateAssetManifest({
        ...SAMPLE_MANIFEST_V1,
        files: { 'missiles/arrow.png': 'not-a-hex-hash' },
      }),
    ).toThrow(/invalid sha256 hash/)
  })

  it('computes exact per-file incremental diff between two manifests', () => {
    const nextManifest: AssetManifest = {
      schema: 1,
      version: '9999888877776666',
      generatedAt: '2026-10-01T01:00:00.000Z',
      totalFiles: 4,
      totalBytes: 4096,
      files: {
        'act-packs/tiles/index.json': 'aaaa1111bbbb2222', // unchanged
        'missiles/arrow.json': 'ffff0000ffff0000', // hash changed!
        // 'missiles/arrow.png' removed!
        'packs/entities/char-so.r8': '1234567890abcdef', // unchanged
        'ui/cursor.png': '5555666677778888', // newly added
      },
    }

    const diff = diffAssetManifests(SAMPLE_MANIFEST_V1, nextManifest)
    expect(diff.changedOrRemoved).toEqual(['missiles/arrow.json', 'missiles/arrow.png'])
    expect(diff.added).toEqual(['ui/cursor.png'])
    expect(diff.unchangedCount).toBe(2)
  })

  it('serves cached 200 responses with 0 network calls on second load, rejects non-200 responses, and evicts only changed files on manifest update', async () => {
    const origin = 'https://www.laiseek.xyz'
    const caches = new MockCacheStorage()
    const networkCalls: string[] = []
    let arrowJsonPayload = '{"v":1}'

    const fetchFn = vi.fn(async (input: Request | string): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.url
      networkCalls.push(url)
      if (url.endsWith('/missiles/arrow.json')) {
        return new Response(arrowJsonPayload, { status: 200 })
      }
      if (url.endsWith('/missiles/arrow.png')) {
        return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 })
      }
      if (url.endsWith('/samples/d2-packs/entities/char-so.r8')) {
        return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })
      }
      if (url.endsWith('/missiles/missing.json')) {
        return new Response('Not Found', { status: 404 })
      }
      if (url.endsWith('/act-packs/tiles/partial.bin')) {
        return new Response(new Uint8Array([9, 9]), { status: 206 })
      }
      return new Response('OK', { status: 200 })
    })

    const quotaErrors: string[] = []
    const controller = new AssetCacheServiceWorkerController({
      caches,
      fetchFn,
      origin,
      onQuotaError: (url) => quotaErrors.push(url),
    })

    // 1. Before manifest is synced, pack/art requests pass through without caching (Anti-Silent-Failure)
    const preSyncRes = await controller.handleFetch(
      new Request(`${origin}/diablo2/missiles/arrow.json`),
    )
    expect(await preSyncRes.text()).toBe('{"v":1}')
    const preStats = await controller.getStats()
    expect(preStats.manifestReady).toBe(false)
    expect(preStats.cachedAssetCount).toBe(0)
    expect(preStats.networkPassThroughs).toBe(1)

    // 2. Sync V1 manifest
    const syncAck1 = await controller.syncManifest(SAMPLE_MANIFEST_V1)
    expect(syncAck1.ok).toBe(true)
    expect(syncAck1.version).toBe(SAMPLE_MANIFEST_V1.version)

    // 3. First fetch after manifest sync: misses cache, fetches 200 OK from network, stores in Cache Storage
    networkCalls.length = 0
    const r1 = await controller.handleFetch(new Request(`${origin}/diablo2/missiles/arrow.json`))
    const r2 = await controller.handleFetch(new Request(`${origin}/diablo2/missiles/arrow.png`))
    const r3 = await controller.handleFetch(
      new Request(`${origin}/samples/d2-packs/entities/char-so.r8`),
    )
    expect(await r1.text()).toBe('{"v":1}')
    expect((await r2.arrayBuffer()).byteLength).toBe(4)
    expect((await r3.arrayBuffer()).byteLength).toBe(4)
    expect(networkCalls).toHaveLength(3)

    // 4. Second fetch of the same 3 assets: 100% cache hit, 0 network requests!
    networkCalls.length = 0
    const hit1 = await controller.handleFetch(new Request(`${origin}/diablo2/missiles/arrow.json`))
    const hit2 = await controller.handleFetch(new Request(`${origin}/diablo2/missiles/arrow.png`))
    const hit3 = await controller.handleFetch(
      new Request(`${origin}/samples/d2-packs/entities/char-so.r8`),
    )
    expect(await hit1.text()).toBe('{"v":1}')
    expect((await hit2.arrayBuffer()).byteLength).toBe(4)
    expect((await hit3.arrayBuffer()).byteLength).toBe(4)
    expect(networkCalls).toHaveLength(0)

    const statsAfterHits = await controller.getStats()
    expect(statsAfterHits.cacheHits).toBe(3)
    expect(statsAfterHits.cacheMisses).toBe(3)
    expect(statsAfterHits.cachedAssetCount).toBe(3)

    // 5. Non-200 responses (404, 206) are never cached
    const r404 = await controller.handleFetch(new Request(`${origin}/diablo2/missiles/missing.json`))
    expect(r404.status).toBe(404)
    const r206 = await controller.handleFetch(
      new Request(`${origin}/diablo2/act-packs/tiles/partial.bin`),
    )
    expect(r206.status).toBe(206)
    expect((await controller.getStats()).cachedAssetCount).toBe(3)
    expect(isCacheableResponse(r404)).toBe(false)
    expect(isCacheableResponse(r206)).toBe(false)

    // 6. Incremental invalidation: update arrow.json hash, keep arrow.png and char-so.r8 unchanged
    arrowJsonPayload = '{"v":2}'
    const manifestV2: AssetManifest = {
      ...SAMPLE_MANIFEST_V1,
      version: '2222333344445555',
      files: {
        ...SAMPLE_MANIFEST_V1.files,
        'missiles/arrow.json': '9999999999999999', // changed hash!
      },
    }
    const syncAck2 = await controller.syncManifest(manifestV2)
    expect(syncAck2.evictedCount).toBe(1)
    expect(syncAck2.evictedPaths).toEqual(['missiles/arrow.json'])
    expect(syncAck2.unchangedCount).toBe(3)

    // Fetching arrow.png and char-so.r8 still hits cache (0 network calls),
    // while fetching arrow.json re-fetches v2 from network!
    networkCalls.length = 0
    const unchangedPng = await controller.handleFetch(
      new Request(`${origin}/diablo2/missiles/arrow.png`),
    )
    const unchangedR8 = await controller.handleFetch(
      new Request(`${origin}/samples/d2-packs/entities/char-so.r8`),
    )
    expect((await unchangedPng.arrayBuffer()).byteLength).toBe(4)
    expect((await unchangedR8.arrayBuffer()).byteLength).toBe(4)
    expect(networkCalls).toHaveLength(0)

    const updatedJson = await controller.handleFetch(
      new Request(`${origin}/diablo2/missiles/arrow.json`),
    )
    expect(await updatedJson.text()).toBe('{"v":2}')
    expect(networkCalls).toEqual([`${origin}/diablo2/missiles/arrow.json`])

    // 7. QuotaExceededError during cache.put still returns network response and records warning
    const assetBucket = await caches.open(ASSET_CACHE_NAME)
    assetBucket.throwQuotaOnPut = true
    const quotaRes = await controller.handleFetch(
      new Request(`${origin}/diablo2/act-packs/tiles/index.json`),
    )
    expect(quotaRes.status).toBe(200)
    expect(quotaErrors).toEqual([`${origin}/diablo2/act-packs/tiles/index.json`])
    expect((await controller.getStats()).quotaErrors).toBe(1)
    assetBucket.throwQuotaOnPut = false

    // 8. Clear cache wipes all entries
    const clearAck = await controller.clearCache()
    expect(clearAck.ok).toBe(true)
    expect(clearAck.deletedEntries).toBe(3)
    expect((await controller.getStats()).cachedAssetCount).toBe(0)
  })

  it('generates deterministic AssetManifest files offline from public/', () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), 'd2web-manifest-test-'))
    try {
      const pubDir = join(tmpRoot, 'public')
      const packsDir = join(pubDir, 'packs')
      mkdirSync(join(pubDir, 'missiles'), { recursive: true })
      mkdirSync(join(pubDir, 'ui'), { recursive: true })
      mkdirSync(join(packsDir, 'entities'), { recursive: true })

      writeFileSync(join(pubDir, 'missiles', 'arrow.json'), '{"name":"arrow"}\n')
      writeFileSync(join(pubDir, 'ui', 'manifest.json'), '{"version":"1"}\n')
      writeFileSync(join(packsDir, 'entities', 'char-so.r8'), new Uint8Array([10, 20, 30, 40]))
      // Ignored files (sw.js, .mpq)
      writeFileSync(join(pubDir, 'sw.js'), '// sw')
      writeFileSync(join(packsDir, 'd2data.mpq'), new Uint8Array([0, 1, 2]))

      const m1 = generateAssetManifest({
        rootDir: tmpRoot,
        generatedAt: '2026-10-01T00:00:00.000Z',
      })
      const m2 = generateAssetManifest({
        rootDir: tmpRoot,
        generatedAt: '2026-10-01T00:00:00.000Z',
      })

      expect(m1.version).toBe(m2.version)
      expect(m1.totalFiles).toBe(3)
      expect(Object.keys(m1.files)).toEqual([
        'missiles/arrow.json',
        'packs/entities/char-so.r8',
        'ui/manifest.json',
      ])
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  it('respects dev port 5173 vs ?sw=1 and formats cache megabytes cleanly', async () => {
    expect(shouldEnableAssetCacheSw({ port: '5173', search: '' })).toBe(false)
    expect(shouldEnableAssetCacheSw({ port: '5173', search: '?sw=1' })).toBe(true)
    expect(shouldEnableAssetCacheSw({ port: '4173', search: '' })).toBe(true)
    expect(shouldEnableAssetCacheSw({ port: '', search: '?sw=0' })).toBe(false)

    expect(formatCacheBytesMb(0)).toBe('0.0 MB')
    expect(formatCacheBytesMb(25 * 1024)).toBe('0.1 MB')
    expect(formatCacheBytesMb(15.25 * 1024 * 1024)).toBe('15.3 MB')

    let clearCallbackCount = 0
    const toolbar = new Toolbar({
      store: createSettingsStore(),
      callbacks: {
        onClearCache: () => {
          clearCallbackCount += 1
        },
      },
    })
    toolbar.setAssetCacheUsageBytes(12 * 1024 * 1024)
    await toolbar.clearAssetCache()
    expect(clearCallbackCount).toBe(1)
    toolbar.destroy()
  })

  it('refreshes public/ui/** hashes (manifest.json and join-game-bg.png) over stale base manifests in ~15ms (#842)', async () => {
    const { hashFileSha256Prefix, refreshAssetManifestPublicSubdirs } = await import(
      '../../src/baker/io/asset-manifest.ts'
    )
    const publicDir = join(process.cwd(), 'public')
    const frontendManifestDiskHash = hashFileSha256Prefix(
      join(publicDir, 'ui', 'frontend', 'manifest.json'),
    ).hash
    const joinGameBgDiskHash = hashFileSha256Prefix(
      join(publicDir, 'ui', 'frontend', 'join-game-bg.png'),
    ).hash

    // Simulate a stale base manifest with an outdated ui/frontend/manifest.json hash and missing join-game-bg.png
    const staleBase: AssetManifest = {
      schema: 1,
      version: 'a42a5afdc925a78f',
      generatedAt: '2026-10-01T00:00:00.000Z',
      totalFiles: 2,
      totalBytes: 1024,
      files: {
        'packs/entities/char-so.r8': '1234567890abcdef',
        'ui/frontend/manifest.json': 'a42a5afdc925a78f',
      },
    }

    const refreshed = refreshAssetManifestPublicSubdirs({
      baseManifest: staleBase,
      publicDir,
      subdirs: ['ui'],
    })

    // Non-UI entries are preserved untouched, while UI entries reflect exact disk SHA-256 prefixes
    expect(refreshed.files['packs/entities/char-so.r8']).toBe('1234567890abcdef')
    expect(refreshed.files['ui/frontend/manifest.json']).toBe(frontendManifestDiskHash)
    expect(refreshed.files['ui/frontend/join-game-bg.png']).toBe(joinGameBgDiskHash)
    expect(refreshed.version).not.toBe(staleBase.version)

    const diff = diffAssetManifests(staleBase, refreshed)
    expect(diff.changedOrRemoved).toContain('ui/frontend/manifest.json')
    expect(diff.added).toContain('ui/frontend/join-game-bg.png')
  })

  it('deduplicates concurrent cache-miss fetches for the same URL and distinguishes QuotaExceededError from NetworkError (#1023)', async () => {
    const { isQuotaExceededError } = await import('../../src/client/sw/sw.ts')
    expect(isQuotaExceededError({ name: 'QuotaExceededError', message: 'Quota exceeded' })).toBe(true)
    expect(
      isQuotaExceededError({
        name: 'NetworkError',
        message: "Failed to execute 'put' on 'Cache': Cache.put() encountered a network error",
      }),
    ).toBe(false)

    const origin = 'https://d2.laiseek.xyz'
    const caches = new MockCacheStorage()
    const networkCalls: string[] = []
    let releaseFetch!: () => void
    const fetchGate = new Promise<void>((resolve) => {
      releaseFetch = resolve
    })

    const controller = new AssetCacheServiceWorkerController({
      caches,
      origin,
      fetchFn: async (input) => {
        const url = typeof input === 'string' ? input : input.url
        networkCalls.push(url)
        await fetchGate
        return new Response(new Uint8Array([0xba, 0xbe, 0x01, 0x02]), { status: 200 })
      },
    })

    await controller.syncManifest({
      schema: 1,
      version: '1111222233334444',
      generatedAt: '2026-10-01T00:00:00.000Z',
      totalFiles: 1,
      totalBytes: 4,
      files: {
        'chars/ba/layers/rh-mau.bin': 'aaaa1111bbbb2222',
      },
    })

    // Fire two concurrent requests for the same layer bin before the network responds
    const p1 = controller.handleFetch(new Request(`${origin}/chars/ba/layers/rh-mau.bin`))
    const p2 = controller.handleFetch(new Request(`${origin}/chars/ba/layers/rh-mau.bin`))

    // Wait a microtask so both enter handleFetch and coalesce on inFlightFetches
    await Promise.resolve()
    releaseFetch()

    const [r1, r2] = await Promise.all([p1, p2])
    expect(new Uint8Array(await r1.arrayBuffer())).toEqual(new Uint8Array([0xba, 0xbe, 0x01, 0x02]))
    expect(new Uint8Array(await r2.arrayBuffer())).toEqual(new Uint8Array([0xba, 0xbe, 0x01, 0x02]))
    expect(networkCalls).toEqual([`${origin}/chars/ba/layers/rh-mau.bin`])

    const stats = await controller.getStats()
    expect(stats.cacheMisses).toBe(1)
    expect(stats.cacheHits).toBe(1)
    expect(stats.cachedAssetCount).toBe(1)
  })

  it('falls through to network without throwing when CacheStorage encounters an internal error (#1312)', async () => {
    const origin = 'https://d2.laiseek.xyz'
    const caches = new MockCacheStorage()
    caches.throwOnOpen = true
    let networkCalled = false

    const controller = new AssetCacheServiceWorkerController({
      caches,
      origin,
      fetchFn: async (req) => {
        networkCalled = true
        return new Response(JSON.stringify({ ok: true, fallback: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    })

    const res = await controller.handleFetch(new Request(`${origin}/weather/weather.json`))
    expect(res.status).toBe(200)
    expect(networkCalled).toBe(true)
    const json = (await res.json()) as { ok: boolean; fallback: boolean }
    expect(json).toEqual({ ok: true, fallback: true })
    const stats = await controller.getStats().catch(() => null)
    // Cache controller recorded network passthrough
    expect(controller['networkPassThroughs']).toBe(1)
  })

  it('includes cursor-pd2/ assets in public/asset-manifest.json and enforces the public/ top-level root anti-leak gate (#1314)', async () => {
    expect(CACHEABLE_PREFIXES).toContain('cursor-pd2/')
    expect(INTENTIONALLY_UNCACHED_PUBLIC_DIRS).toEqual([])
    expect(INTENTIONALLY_UNCACHED_PUBLIC_FILES).toContain('asset-manifest.json')
    expect(INTENTIONALLY_UNCACHED_PUBLIC_FILES).toContain('musicbox.html')

    const publicDir = join(process.cwd(), 'public')
    const roots = validatePublicAssetRoots(publicDir)
    expect(roots.cacheableDirs).toContain('cursor-pd2/')

    const manifestPath = join(publicDir, 'asset-manifest.json')
    expect(existsSync(manifestPath)).toBe(true)
    const manifest = validateAssetManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))

    for (const rel of ['cursor-pd2/hand.png', 'cursor-pd2/manifest.json', 'cursor-pd2/other.png']) {
      const abs = join(publicDir, rel)
      expect(existsSync(abs)).toBe(true)
      expect(isCacheableAssetPath(rel)).toBe(true)
      expect(manifest.files[rel]).toBe(hashFileSha256Prefix(abs).hash)
    }

    // Verify SW caches cursor-pd2/ assets via cache-first after manifest sync
    const origin = 'https://www.laiseek.xyz'
    const caches = new MockCacheStorage()
    let fetchCount = 0
    const controller = new AssetCacheServiceWorkerController({
      caches,
      origin,
      fetchFn: async () => {
        fetchCount += 1
        return new Response('{"schema":1}', { status: 200 })
      },
    })
    await controller.syncManifest({
      schema: 1,
      version: manifest.version,
      generatedAt: manifest.generatedAt,
      totalFiles: 1,
      totalBytes: 3614,
      files: {
        'cursor-pd2/manifest.json': manifest.files['cursor-pd2/manifest.json']!,
      },
    })
    await controller.handleFetch(new Request(`${origin}/cursor-pd2/manifest.json`))
    await controller.handleFetch(new Request(`${origin}/cursor-pd2/manifest.json`))
    expect(fetchCount).toBe(1)

    // Verify validatePublicAssetRoots fails fast when an unregistered top-level directory is added to public/
    const tmpRoot = mkdtempSync(join(tmpdir(), 'd2web-root-gate-'))
    try {
      const tmpPub = join(tmpRoot, 'public')
      mkdirSync(join(tmpPub, 'unlisted-new-root'), { recursive: true })
      writeFileSync(join(tmpPub, 'unlisted-new-root', 'sprite.png'), new Uint8Array([1, 2, 3]))
      expect(() => validatePublicAssetRoots(tmpPub)).toThrow(
        /Unregistered public\/ top-level directory "unlisted-new-root\/"/,
      )
      expect(() => generateAssetManifest({ rootDir: tmpRoot, outputFile: null })).toThrow(
        /Unregistered public\/ top-level directory "unlisted-new-root\/"/,
      )
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})
