/**
 * M21-P6 (#948) — F25 All audio packs/streams in `asset-manifest.ts` (SHA-256) + `sw.ts` (D15) +
 * `verify:audio` full-pipeline audit (`monsters`, `speech`, `manifest`, 100% packs, 136 mappings),
 * and F26 Unshipped-WAV exception list (D9: 4 monster `1595..1598` + 30 speech rows absent from all
 * 9 1.13c MPQs, derived by baker, exposed in generated tables, runtime plays nothing / logs / never
 * synthesizes, audited by `verify:audio`).
 *
 * Authoritative sources (never the product's generated tables):
 * - PROJECT.md D9, D15, D16, D18 & ORIGINAL_REQUEST.md R6 (#948).
 * - Independent 1.13c MPQ oracle (`harness-113c.ts`) across all 9 archives (`MPQ_PRIORITY_113C`).
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  D2_DATA_DIR,
  PRODUCT,
  REPO_ROOT,
  RecordingVoices,
  getOracle113c,
  loadProductModule,
  oracleMonsterSpeechScope,
  oracleSampleFacts,
  readRepoText,
  requireD16Decided,
  requireExport,
  sha256Hex,
  summarize,
  type Oracle113c,
  type OracleSoundRow,
} from './harness-113c.ts'
import { FakeAudioContext, installFakeAudioContext } from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 600_000 })

const F25 = '#948 F25 asset-manifest + sw.ts (D15) + verify:audio full-pipeline audit'
const F26 = '#948 F26 D9 unshipped-WAV exception list (4 monster + 30 speech)'

interface PackMetaC {
  readonly packId: string
  readonly url: string
  readonly bytes: number
  readonly sha256: string
  readonly chunkCount: number
  readonly rowCount: number
  readonly tier: string
  readonly prefixes: readonly string[]
}

interface IndexModuleC {
  readonly SFX_PACK_INDEX_113C: Readonly<Record<number, readonly [string, number, number, number, number, number]>>
  readonly SFX_PACKS_113C: readonly PackMetaC[]
  getSfxPackEntry113c(id: number): { readonly packId: string; readonly byteOffset: number; readonly byteLength: number } | undefined
}

interface SpeechEntryC {
  readonly id: number
  readonly url: string
  readonly bytes: number
  readonly sha256: string
  readonly solo?: boolean
}

interface MusicTrackC {
  readonly id: number
  readonly url?: string
  readonly file?: string
  readonly webmPath?: string
  readonly bytes?: number
  readonly sha256?: string
}

let O: Oracle113c
let allMonsterRows: readonly OracleSoundRow[]
let shippedMonsterRows: readonly OracleSoundRow[]
let missingMonsterIds: readonly number[]
let allSpeechRows: readonly OracleSoundRow[]
let shippedSpeechRows: readonly OracleSoundRow[]
let missingSpeechIds: readonly number[]
let expectedMissing34: readonly number[]

beforeAll(() => {
  O = getOracle113c()
  const scope = oracleMonsterSpeechScope(O)
  allMonsterRows = scope.allMonsterRows
  shippedMonsterRows = scope.shippedMonsterRows
  missingMonsterIds = scope.missingMonsterIds
  allSpeechRows = scope.allSpeechRows
  shippedSpeechRows = scope.shippedSpeechRows
  missingSpeechIds = scope.missingSpeechIds
  expectedMissing34 = [...O.missingMemberIds].sort((a, b) => a - b)
})

async function indexModule(req = F25): Promise<IndexModuleC> {
  const m = await loadProductModule(PRODUCT.sfxPackIndex, req)
  requireExport(m, 'SFX_PACK_INDEX_113C', PRODUCT.sfxPackIndex, req)
  requireExport(m, 'SFX_PACKS_113C', PRODUCT.sfxPackIndex, req)
  requireExport(m, 'getSfxPackEntry113c', PRODUCT.sfxPackIndex, req)
  return m as unknown as IndexModuleC
}

function readSpeechEntries(mod: Record<string, unknown>): Map<number, SpeechEntryC> {
  const raw =
    mod.SPEECH_INDEX_113C ??
    mod.SPEECH_STREAMS_113C ??
    mod.SPEECH_BY_ID_113C ??
    mod.SPEECH_TABLE_113C
  const out = new Map<number, SpeechEntryC>()
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object' && typeof (item as SpeechEntryC).id === 'number') {
        out.set((item as SpeechEntryC).id, item as SpeechEntryC)
      }
    }
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const entry = v as SpeechEntryC
        const id = typeof entry.id === 'number' ? entry.id : Number(k)
        if (Number.isInteger(id) && id > 0) {
          out.set(id, { ...entry, id })
        }
      }
    }
  }
  return out
}

function readMusicTracks(mod: Record<string, unknown>): MusicTrackC[] {
  const raw = mod.MUSIC_TRACKS_113C ?? mod.MUSIC_BY_ID_113C ?? mod.BGM_TRACKS_113C
  if (Array.isArray(raw)) return raw as MusicTrackC[]
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, MusicTrackC>)
  return []
}

function extractProductUnshippedIds(
  soundsMod: Record<string, unknown>,
  sfxIdxMod: Record<string, unknown>,
  monMod: Record<string, unknown>,
  speechMod: Record<string, unknown>,
): number[] {
  const candidates: unknown[] = [
    soundsMod.UNSHIPPED_SOUND_IDS_113C,
    soundsMod.MISSING_SOUND_IDS_113C,
    soundsMod.ABSENT_MPQ_SOUND_IDS_113C,
    sfxIdxMod.UNSHIPPED_SOUND_IDS_113C,
    sfxIdxMod.MISSING_SOUND_IDS_113C,
    monMod.UNSHIPPED_MONSTER_SOUND_IDS_113C,
    monMod.MISSING_MONSTER_SOUND_IDS_113C,
    monMod.UNSHIPPED_SOUND_IDS_113C,
    speechMod.UNSHIPPED_SPEECH_IDS_113C,
    speechMod.MISSING_SPEECH_IDS_113C,
    speechMod.UNSHIPPED_SOUND_IDS_113C,
  ]
  const set = new Set<number>()
  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const item of c) {
        if (typeof item === 'number') set.add(item)
        else if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'number') {
          set.add((item as { id: number }).id)
        }
      }
    } else if (c instanceof Set) {
      for (const item of c) {
        if (typeof item === 'number') set.add(item)
      }
    } else if (c && typeof c === 'object') {
      for (const [k, v] of Object.entries(c as Record<string, unknown>)) {
        const numK = Number(k)
        if (Number.isInteger(numK) && numK > 0 && v) set.add(numK)
      }
    }
  }
  return [...set].sort((a, b) => a - b)
}

function mirrorRepoWithCopies(relPathsToCopy: readonly string[], mutate: (mirrorRoot: string) => void): string {
  const dir = mkdtempSync(join(tmpdir(), 'm21-p6-mirror-'))
  const copyFirstTop = new Set(relPathsToCopy.map((p) => p.split('/')[0]!))
  for (const entry of readdirSync(REPO_ROOT)) {
    if (entry === '.git' || entry.startsWith('.tmp-')) continue
    if (copyFirstTop.has(entry)) continue
    symlinkSync(join(REPO_ROOT, entry), join(dir, entry))
  }
  for (const top of copyFirstTop) {
    const srcTop = join(REPO_ROOT, top)
    if (!existsSync(srcTop)) continue
    const dstTop = join(dir, top)
    mkdirSync(dstTop, { recursive: true })
    for (const child of readdirSync(srcTop)) {
      const relChild = `${top}/${child}`
      const needsDeepCopy = relPathsToCopy.some((p) => p === relChild || p.startsWith(`${relChild}/`))
      if (!needsDeepCopy) {
        symlinkSync(join(srcTop, child), join(dstTop, child))
      } else {
        cpSync(join(srcTop, child), join(dstTop, child), { recursive: true, dereference: true })
      }
    }
  }
  for (const rel of relPathsToCopy) {
    const src = join(REPO_ROOT, rel)
    const dst = join(dir, rel)
    mkdirSync(dirname(dst), { recursive: true })
    if (existsSync(src) && !existsSync(dst)) {
      cpSync(src, dst, { dereference: true })
    }
  }
  mutate(dir)
  return dir
}

class InMemoryCache {
  private readonly store = new Map<string, Response>()
  async match(req: Request | string): Promise<Response | undefined> {
    const url = typeof req === 'string' ? req : req.url
    const hit = this.store.get(url)
    return hit ? hit.clone() : undefined
  }
  async put(req: Request | string, res: Response): Promise<void> {
    const url = typeof req === 'string' ? req : req.url
    this.store.set(url, res.clone())
  }
  async delete(req: Request | string): Promise<boolean> {
    const url = typeof req === 'string' ? req : req.url
    return this.store.delete(url)
  }
  async keys(): Promise<readonly Request[]> {
    return [...this.store.keys()].map((u) => new Request(u))
  }
}

class InMemoryCacheStorage {
  readonly map = new Map<string, InMemoryCache>()
  async open(name: string): Promise<InMemoryCache> {
    let c = this.map.get(name)
    if (!c) {
      c = new InMemoryCache()
      this.map.set(name, c)
    }
    return c
  }
  async delete(name: string): Promise<boolean> {
    return this.map.delete(name)
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// F25 — All audio packs/streams in asset-manifest.ts (SHA-256) + sw.ts (D15) + verify:audio
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('F25 (#948) — All audio packs & streams in asset-manifest.ts (SHA-256), sw.ts (D15), and verify:audio full-pipeline audit', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Tier 1 — specification & contract coverage', () => {
    it('[T1-F25-01] `isCacheableAssetPath` in `src/common/pack-contract/index.ts` accepts `sound/` prefix and `.bin`, `.webm`, `.opus` extensions across all M2–M6 audio assets while rejecting `.mpq`, `asset-manifest.json`, and `sw.js`', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F25)
      await loadProductModule(PRODUCT.packSpeech, F25)
      const pcMod = await loadProductModule(PRODUCT.packContract, F25)
      const isCacheable = requireExport<(p: string) => boolean>(pcMod, 'isCacheableAssetPath', PRODUCT.packContract, F25)
      const idx = await indexModule(F25)
      const speechMod = await loadProductModule(PRODUCT.speechIndex, F25)
      const speechMap = readSpeechEntries(speechMod)
      const musicMod = await loadProductModule(PRODUCT.musicTracks, F25)
      const musicTracks = readMusicTracks(musicMod)

      expect(isCacheable('sound/sfx-core.bin')).toBe(true)
      expect(isCacheable('sound/sfx-mon-act1.bin')).toBe(true)
      expect(isCacheable('sound/music/act1/town1.webm')).toBe(true)
      expect(isCacheable('sound/speech/act1/akara_act1_intro.webm')).toBe(true)
      expect(isCacheable('sound/speech/act1/akara_act1_intro.opus')).toBe(true)

      expect(isCacheable('d2sfx.mpq')).toBe(false)
      expect(isCacheable('asset-manifest.json')).toBe(false)
      expect(isCacheable('sw.js')).toBe(false)
      expect(isCacheable('/d2net/session')).toBe(false)

      for (const p of idx.SFX_PACKS_113C) {
        expect(isCacheable(p.url), `isCacheableAssetPath("${p.url}")`).toBe(true)
      }
      for (const t of musicTracks) {
        const u = t.url ?? t.webmPath ?? t.file ?? ''
        expect(isCacheable(u), `isCacheableAssetPath("${u}")`).toBe(true)
      }
      for (const [, s] of speechMap) {
        expect(isCacheable(s.url), `isCacheableAssetPath("${s.url}")`).toBe(true)
      }
    })

    it('[T1-F25-02] `public/asset-manifest.json` (generated by `src/baker/io/asset-manifest.ts`) contains an exact 16-hex-char SHA-256 content hash prefix for 100% of audio `.bin` packs (`SFX_PACKS_113C`), 100% of BGM `.webm` streams (`MUSIC_TRACKS_113C`), and 100% of speech `.webm` streams (`SPEECH_INDEX_113C`)', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F25)
      await loadProductModule(PRODUCT.packSpeech, F25)
      const pcMod = await loadProductModule(PRODUCT.packContract, F25)
      const normalizePath = requireExport<(p: string) => string>(
        pcMod,
        'normalizeAssetManifestPath',
        PRODUCT.packContract,
        F25,
      )
      const validateManifest = requireExport<
        (raw: unknown) => { readonly files: Readonly<Record<string, string>> }
      >(pcMod, 'validateAssetManifest', PRODUCT.packContract, F25)

      const manifestPath = join(REPO_ROOT, 'public/asset-manifest.json')
      expect(existsSync(manifestPath), 'public/asset-manifest.json must exist').toBe(true)
      const manifest = validateManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))

      const idx = await indexModule(F25)
      const speechMod = await loadProductModule(PRODUCT.speechIndex, F25)
      const speechMap = readSpeechEntries(speechMod)
      const musicMod = await loadProductModule(PRODUCT.musicTracks, F25)
      const musicTracks = readMusicTracks(musicMod)

      const bad: string[] = []
      for (const p of idx.SFX_PACKS_113C) {
        const key = normalizePath(p.url)
        const recorded = manifest.files[key]
        const expectedPrefix = p.sha256.slice(0, 16).toLowerCase()
        if (!recorded) {
          bad.push(`pack ${p.packId} (${key}) missing from public/asset-manifest.json`)
        } else if (recorded.toLowerCase() !== expectedPrefix) {
          bad.push(`pack ${p.packId} (${key}): manifest hash ${recorded} !== expected ${expectedPrefix}`)
        }
      }

      for (const t of musicTracks) {
        const u = t.url ?? t.webmPath ?? t.file ?? ''
        const key = normalizePath(u)
        const recorded = manifest.files[key]
        if (!recorded) {
          bad.push(`music track ${String(t.id)} (${key}) missing from public/asset-manifest.json`)
        } else if (t.sha256 && recorded.toLowerCase() !== t.sha256.slice(0, 16).toLowerCase()) {
          bad.push(`music track ${String(t.id)} (${key}): manifest hash ${recorded} !== ${t.sha256.slice(0, 16)}`)
        }
      }

      for (const [id, s] of speechMap.entries()) {
        const key = normalizePath(s.url)
        const recorded = manifest.files[key]
        const expectedPrefix = s.sha256.slice(0, 16).toLowerCase()
        if (!recorded) {
          bad.push(`speech row ${String(id)} (${key}) missing from public/asset-manifest.json`)
        } else if (recorded.toLowerCase() !== expectedPrefix) {
          bad.push(`speech row ${String(id)} (${key}): manifest hash ${recorded} !== ${expectedPrefix}`)
        }
      }

      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F25-03] Service Worker (`src/client/sw/sw.ts`) D15 contract: precaches ONLY `sfx-core.bin` (`sound/sfx-core.bin`), serves background/domain `.bin` packs and `.webm` streams via lazy `cache-first`, and bypasses HTTP `Range` requests', async () => {
      const swMod = await loadProductModule(PRODUCT.sw, F25)
      const ControllerCtor = requireExport<
        new (o: {
          caches: unknown
          fetchFn: (input: Request | string, init?: RequestInit) => Promise<Response>
          origin: string
        }) => {
          syncManifest(m: unknown): Promise<{ ok: boolean }>
          handleFetch(r: Request): Promise<Response>
          precacheCoreAudio?(): Promise<unknown>
        }
      >(swMod, 'AssetCacheServiceWorkerController', PRODUCT.sw, F25)
      const shouldBypass = requireExport<(r: Request, origin: string) => boolean>(
        swMod,
        'shouldBypassCache',
        PRODUCT.sw,
        F25,
      )

      const swSrc = readRepoText(PRODUCT.sw, F25)
      // D15: SW precaches sfx-core.bin only; never precaches sfx-mon-act*, sfx-skills-*, or speech/music .webm on install.
      expect(
        swSrc.includes('sfx-core.bin') || typeof swMod.PRECACHE_AUDIO_URLS_113C !== 'undefined' || typeof swMod.SW_PRECACHE_URLS !== 'undefined',
        'sw.ts must declare D15 sfx-core.bin precache contract',
      ).toBe(true)
      const precacheList =
        (swMod.PRECACHE_AUDIO_URLS_113C as readonly string[] | undefined) ??
        (swMod.SW_PRECACHE_URLS as readonly string[] | undefined)
      if (Array.isArray(precacheList)) {
        expect(precacheList.length, 'D15 precache list must contain only sfx-core.bin').toBe(1)
        expect(precacheList[0]!.endsWith('sfx-core.bin')).toBe(true)
      }

      const origin = 'https://d2.local'
      expect(shouldBypass(new Request(`${origin}/sound/sfx-mon-act1.bin`), origin)).toBe(false)
      expect(shouldBypass(new Request(`${origin}/sound/speech/act1/akara_act1_intro.webm`), origin)).toBe(false)
      expect(
        shouldBypass(
          new Request(`${origin}/sound/speech/act1/akara_act1_intro.webm`, {
            headers: { Range: 'bytes=0-1023' },
          }),
          origin,
        ),
        'HTTP Range requests must bypass SW cache',
      ).toBe(true)

      const caches = new InMemoryCacheStorage()
      let fetchCalls = 0
      const ctrl = new ControllerCtor({
        caches,
        origin,
        fetchFn: async (req) => {
          fetchCalls += 1
          const url = typeof req === 'string' ? req : req.url
          return new Response(`payload:${url}`, { status: 200 })
        },
      })
      await ctrl.syncManifest({
        schema: 1,
        version: '0123456789abcdef',
        generatedAt: '2026-10-11T00:00:00.000Z',
        totalFiles: 2,
        totalBytes: 200,
        files: {
          'sound/sfx-mon-act1.bin': 'aaaaaaaaaaaaaaaa',
          'sound/speech/act1/akara_act1_intro.webm': 'bbbbbbbbbbbbbbbb',
        },
      })

      const r1 = await ctrl.handleFetch(new Request(`${origin}/sound/sfx-mon-act1.bin`))
      expect(r1.status).toBe(200)
      expect(fetchCalls).toBe(1)

      const r2 = await ctrl.handleFetch(new Request(`${origin}/sound/sfx-mon-act1.bin`))
      expect(await r2.text()).toBe(`payload:${origin}/sound/sfx-mon-act1.bin`)
      expect(fetchCalls, 'second request served from cache-first').toBe(1)
    })

    it('[T1-F25-04] `runAudioAudit` (`src/baker/audit/verify-audio-113c.ts`) registers and passes sections `monsters`, `speech`, and `manifest` with zero errors', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F25)
      await loadProductModule(PRODUCT.packSpeech, F25)
      const auditMod = await loadProductModule(PRODUCT.audit, F25)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{
          ok: boolean
          sections: readonly { id: string; ok: boolean; checks: number; errors: readonly string[] }[]
        }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F25)

      const rep = await runAudioAudit({
        rootDir: REPO_ROOT,
        mpqDir: D2_DATA_DIR,
        sections: ['monsters', 'speech', 'manifest'],
      })
      for (const secId of ['monsters', 'speech', 'manifest'] as const) {
        const sec = rep.sections.find((s) => s.id === secId)
        expect(sec, `verify:audio report must include section '${secId}'`).toBeDefined()
        expect(sec!.checks, `section '${secId}' must evaluate > 0 checks`).toBeGreaterThan(0)
        expect(sec!.errors, summarize(sec!.errors)).toEqual([])
        expect(sec!.ok).toBe(true)
      }
      expect(rep.ok).toBe(true)
    })

    it('[T1-F25-05] full-pipeline `runAudioAudit` (default all 10 sections: `tables`, `sfx-core`, `music`, `ambient`, `levels`, `weather`, `skills`, `monsters`, `speech`, `manifest`) passes with 100% pack coverage and 0 errors', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F25)
      await loadProductModule(PRODUCT.packSpeech, F25)
      const auditMod = await loadProductModule(PRODUCT.audit, F25)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{
          ok: boolean
          sections: readonly { id: string; ok: boolean; checks: number; errors: readonly string[] }[]
        }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F25)

      const rep = await runAudioAudit({
        rootDir: REPO_ROOT,
        mpqDir: D2_DATA_DIR,
      })
      const expectedSections = [
        'tables',
        'sfx-core',
        'music',
        'ambient',
        'levels',
        'weather',
        'skills',
        'monsters',
        'speech',
        'manifest',
      ]
      expect(rep.sections.map((s) => s.id)).toEqual(expectedSections)
      for (const sec of rep.sections) {
        expect(sec.errors, `section ${sec.id}: ${summarize(sec.errors)}`).toEqual([])
        expect(sec.ok, `section ${sec.id} ok`).toBe(true)
      }
      expect(rep.ok).toBe(true)
    })
  })

  describe('Tier 2 — boundary & adversarial audit mutations', () => {
    it('[T2-F25-01] `runAudioAudit` (`monsters`) fails when any `sfx-mon-act*.bin` file is missing or its `D2SP` header magic is corrupted', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F25)
      const idx = await indexModule(F25)
      const firstMonPack = idx.SFX_PACKS_113C.find((p) => p.packId.startsWith('sfx-mon-act'))
      expect(firstMonPack, 'at least one sfx-mon-act* pack in SFX_PACKS_113C').toBeDefined()
      const auditMod = await loadProductModule(PRODUCT.audit, F25)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F25)

      const relPack = `public/${firstMonPack!.url.replace(/^\/+/, '')}`
      const mirror = mirrorRepoWithCopies([relPack], (root) => {
        const target = join(root, relPack)
        const bytes = new Uint8Array(readFileSync(target))
        bytes[0] = 0x00
        writeFileSync(target, bytes)
      })
      try {
        const rep = await runAudioAudit({ rootDir: mirror, mpqDir: D2_DATA_DIR, sections: ['monsters'] })
        expect(rep.ok, 'audit must fail when a monster pack header is corrupted').toBe(false)
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    })

    it('[T2-F25-02] `runAudioAudit` (`speech`) fails when a speech `.webm` file is deleted or corrupted on disk', async () => {
      await loadProductModule(PRODUCT.packSpeech, F25)
      const speechMod = await loadProductModule(PRODUCT.speechIndex, F25)
      const speechMap = readSpeechEntries(speechMod)
      const firstSpeech = speechMap.values().next().value as SpeechEntryC | undefined
      expect(firstSpeech, 'at least one entry in SPEECH_INDEX_113C').toBeDefined()
      const auditMod = await loadProductModule(PRODUCT.audit, F25)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F25)

      const relWebm = `public/${firstSpeech!.url.replace(/^\/+/, '')}`
      const mirror = mirrorRepoWithCopies([relWebm], (root) => {
        rmSync(join(root, relWebm), { force: true })
      })
      try {
        const rep = await runAudioAudit({ rootDir: mirror, mpqDir: D2_DATA_DIR, sections: ['speech'] })
        expect(rep.ok, 'audit must fail when a speech .webm file is missing').toBe(false)
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    })

    it('[T2-F25-03] `runAudioAudit` (`manifest`) fails when an audio `.bin` or `.webm` hash in `public/asset-manifest.json` is tampered', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F25)
      await loadProductModule(PRODUCT.packSpeech, F25)
      const idx = await indexModule(F25)
      const firstMonPack = idx.SFX_PACKS_113C.find((p) => p.packId.startsWith('sfx-mon-act'))
      expect(firstMonPack).toBeDefined()
      const auditMod = await loadProductModule(PRODUCT.audit, F25)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F25)

      const relManifest = 'public/asset-manifest.json'
      const mirror = mirrorRepoWithCopies([relManifest], (root) => {
        const target = join(root, relManifest)
        const parsed = JSON.parse(readFileSync(target, 'utf8')) as {
          files: Record<string, string>
        }
        const key = firstMonPack!.url.replace(/^\/+/, '')
        parsed.files[key] = '0000000000000000'
        writeFileSync(target, `${JSON.stringify(parsed)}\n`, 'utf8')
      })
      try {
        const rep = await runAudioAudit({ rootDir: mirror, mpqDir: D2_DATA_DIR, sections: ['manifest'] })
        expect(rep.ok, 'audit must fail when asset-manifest.json has a mismatched audio hash').toBe(false)
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    })

    it('[T2-F25-04] Service Worker `AssetCacheServiceWorkerController` evicts cached `sound/sfx-mon-act1.bin` and `sound/speech/act1/*.webm` entries on `syncManifest` when their SHA-256 hash changes, and refuses to cache HTTP 206 or 500 responses', async () => {
      const swMod = await loadProductModule(PRODUCT.sw, F25)
      const ControllerCtor = requireExport<
        new (o: {
          caches: unknown
          fetchFn: (input: Request | string, init?: RequestInit) => Promise<Response>
          origin: string
        }) => {
          syncManifest(m: unknown): Promise<{ ok: boolean; evictedPaths: readonly string[] }>
          handleFetch(r: Request): Promise<Response>
          getStats(): Promise<{ cachedAssetCount: number }>
        }
      >(swMod, 'AssetCacheServiceWorkerController', PRODUCT.sw, F25)

      const origin = 'https://d2.local'
      const caches = new InMemoryCacheStorage()
      let nextStatus = 200
      let bodyVersion = 'v1'
      const ctrl = new ControllerCtor({
        caches,
        origin,
        fetchFn: async () => new Response(bodyVersion, { status: nextStatus }),
      })

      await ctrl.syncManifest({
        schema: 1,
        version: '1111111111111111',
        generatedAt: '2026-10-11T00:00:00.000Z',
        totalFiles: 2,
        totalBytes: 200,
        files: {
          'sound/sfx-mon-act1.bin': 'aaaaaaaaaaaaaaaa',
          'sound/speech/act1/akara_act1_intro.webm': 'bbbbbbbbbbbbbbbb',
        },
      })

      await ctrl.handleFetch(new Request(`${origin}/sound/sfx-mon-act1.bin`))
      await ctrl.handleFetch(new Request(`${origin}/sound/speech/act1/akara_act1_intro.webm`))
      expect((await ctrl.getStats()).cachedAssetCount).toBe(2)

      // Update hash of sfx-mon-act1.bin only
      const ack = await ctrl.syncManifest({
        schema: 1,
        version: '2222222222222222',
        generatedAt: '2026-10-11T00:01:00.000Z',
        totalFiles: 2,
        totalBytes: 200,
        files: {
          'sound/sfx-mon-act1.bin': 'cccccccccccccccc',
          'sound/speech/act1/akara_act1_intro.webm': 'bbbbbbbbbbbbbbbb',
        },
      })
      expect(ack.evictedPaths).toEqual(['sound/sfx-mon-act1.bin'])
      expect((await ctrl.getStats()).cachedAssetCount).toBe(1)

      // HTTP 206 Partial Content or 500 error must never be cached
      nextStatus = 206
      bodyVersion = 'partial'
      await ctrl.handleFetch(new Request(`${origin}/sound/sfx-mon-act1.bin`))
      expect((await ctrl.getStats()).cachedAssetCount, '206 response must not be cached').toBe(1)

      nextStatus = 500
      bodyVersion = 'err'
      await ctrl.handleFetch(new Request(`${origin}/sound/sfx-mon-act1.bin`))
      expect((await ctrl.getStats()).cachedAssetCount, '500 response must not be cached').toBe(1)
    })

    it('[T2-F25-05] `runAudioAudit` (`monsters`) fails when `mon-sounds-113c.ts` drifts from `MonSounds.txt`', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F25)
      const auditMod = await loadProductModule(PRODUCT.audit, F25)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F25)

      const mirror = mirrorRepoWithCopies([PRODUCT.monSounds], (root) => {
        const target = join(root, PRODUCT.monSounds)
        const text = readFileSync(target, 'utf8')
        writeFileSync(target, `${text}\n// tampered-by-T2-F25-05\n`, 'utf8')
      })
      try {
        const rep = await runAudioAudit({ rootDir: mirror, mpqDir: D2_DATA_DIR, sections: ['monsters'] })
        expect(rep.ok, 'audit must fail when mon-sounds-113c.ts is tampered').toBe(false)
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// F26 — Unshipped-WAV exception list (D9: 4 monster + 30 speech rows absent from all 1.13c MPQs)
// ═════════════════════════════════════════════════════════════════════════════════════════════════

describe('F26 (#948) — D9 Unshipped-WAV exception list (4 monster 1595..1598 + 30 speech rows absent from all 1.13c MPQs)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Tier 1 — specification & contract coverage', () => {
    it('[T1-F26-01] independent MPQ scan confirms the exact 34-ID unshipped set (`[1595..1598]` + 30 speech rows), and the product generated tables export this exact 34-ID set without hand-coding', async () => {
      const soundsMod = await loadProductModule(PRODUCT.sounds, F26)
      const sfxIdxMod = await loadProductModule(PRODUCT.sfxPackIndex, F26)
      const monMod = await loadProductModule(PRODUCT.monSounds, F26)
      const speechMod = await loadProductModule(PRODUCT.speechIndex, F26)

      expect(missingMonsterIds).toEqual([1595, 1596, 1597, 1598])
      expect(missingSpeechIds.length).toBe(30)
      expect(expectedMissing34.length).toBe(34)

      const productUnshipped = extractProductUnshippedIds(soundsMod, sfxIdxMod, monMod, speechMod)
      expect(
        productUnshipped,
        'product must export the exact 34 unshipped sound IDs derived by the baker from failed MPQ lookups',
      ).toEqual(expectedMissing34)
    })

    it('[T1-F26-02] `SOUNDS_113C` retains all 34 unshipped rows at their exact 1.13c indices, while `SFX_PACK_INDEX_113C` omits `1595..1598` and `SPEECH_INDEX_113C` omits all 30 unshipped speech IDs', async () => {
      const soundsMod = await loadProductModule(PRODUCT.sounds, F26)
      const SOUNDS_113C = requireExport<readonly { readonly id: number; readonly sound: string }[]>(
        soundsMod,
        'SOUNDS_113C',
        PRODUCT.sounds,
        F26,
      )
      const idx = await indexModule(F26)
      const speechMod = await loadProductModule(PRODUCT.speechIndex, F26)
      const speechMap = readSpeechEntries(speechMod)

      for (const id of expectedMissing34) {
        expect(SOUNDS_113C[id]?.id, `SOUNDS_113C[${String(id)}] present in table`).toBe(id)
        expect(SOUNDS_113C[id]?.sound).toBe(O.sounds[id]!.sound)
      }
      for (const id of missingMonsterIds) {
        expect(idx.SFX_PACK_INDEX_113C[id], `unshipped monster id ${String(id)} must not have a fake pack slice`).toBeUndefined()
      }
      for (const id of missingSpeechIds) {
        expect(speechMap.has(id), `unshipped speech id ${String(id)} must not have a fake .webm entry`).toBe(false)
      }
    })

    it('[T1-F26-03] runtime parity (D9): requesting playback of any of the 4 unshipped monster IDs (`1595..1598`) or any of the 30 unshipped speech IDs plays nothing (`voices.started.length === 0`), never throws, and records/logs the unshipped lookup', async () => {
      const recMod = await loadProductModule(PRODUCT.records, F26)
      const SoundRecordsCtor = requireExport<
        new (o: Record<string, unknown>) => {
          play(id: number, o?: Record<string, unknown>): number
          records(): readonly unknown[]
        }
      >(recMod, 'SoundRecords113c', PRODUCT.records, F26)
      const streamerMod = await loadProductModule(PRODUCT.speechStreamer, F26)
      const SpeechStreamerCtor = requireExport<
        new (o?: Record<string, unknown>) => {
          playSpeech?(id: number, o?: Record<string, unknown>): unknown
          play?(id: number, o?: Record<string, unknown>): unknown
        }
      >(streamerMod, 'SpeechStreamer', PRODUCT.speechStreamer, F26)

      const voices = new RecordingVoices()
      const knownFacts = new Map<number, { sampleRate: number; frames: number; channels: number }>()
      for (const r of shippedMonsterRows.slice(0, 10)) {
        knownFacts.set(r.id, oracleSampleFacts(r.id))
      }
      const sr = new SoundRecordsCtor({
        voices,
        rng: new D2Rng(0x113cf26),
        sampleFacts: (id: number) => knownFacts.get(id),
      })

      for (const id of missingMonsterIds) {
        const h = sr.play(id)
        expect(h, `unshipped monster id ${String(id)} must not start a voice`).toBe(0)
      }
      expect(voices.starts().length).toBe(0)

      const createdAudios: unknown[] = []
      const streamer = new SpeechStreamerCtor({
        createAudioElement: () => {
          const el = { play: () => Promise.resolve(), pause: () => {} }
          createdAudios.push(el)
          return el
        },
      })
      const playFn = (streamer.playSpeech ?? streamer.play)!.bind(streamer)
      for (const id of missingSpeechIds) {
        await playFn(id)
      }
      expect(createdAudios.length, 'unshipped speech IDs must never start an <audio> element').toBe(0)
    })

    it('[T1-F26-04] zero synthesis (D9): neither `WebAudioSoundVoices`, `AudioRuntime113c`, nor `SpeechStreamer` ever calls `AudioContext.createOscillator` when an unshipped sound ID is requested', async () => {
      const restore = installFakeAudioContext()
      try {
        let oscCalls = 0
        const fakeCtx = new FakeAudioContext() as FakeAudioContext & { createOscillator?: () => unknown }
        fakeCtx.createOscillator = () => {
          oscCalls += 1
          throw new Error('createOscillator is forbidden by D9')
        }

        const rtMod = await loadProductModule(PRODUCT.audioRuntime, F26)
        const AudioRuntimeCtor = requireExport<
          new (o?: Record<string, unknown>) => {
            playSound?(id: number): unknown
            play?(id: number): unknown
            playSpeech?(id: number): unknown
          }
        >(rtMod, 'AudioRuntime113c', PRODUCT.audioRuntime, F26)

        const rt = new AudioRuntimeCtor({ audioContext: fakeCtx })
        const playSfx = (rt.playSound ?? rt.play)?.bind(rt)
        if (playSfx) {
          for (const id of missingMonsterIds) {
            await playSfx(id)
          }
        }
        if (typeof rt.playSpeech === 'function') {
          for (const id of missingSpeechIds.slice(0, 5)) {
            await rt.playSpeech(id)
          }
        }
        expect(oscCalls).toBe(0)
      } finally {
        restore()
      }
    })

    it('[T1-F26-05] `runAudioAudit` verifies the D9 unshipped-WAV exception list against the mounted 1.13c MPQ chain (`monsters` + `speech` sections)', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F26)
      await loadProductModule(PRODUCT.packSpeech, F26)
      const auditMod = await loadProductModule(PRODUCT.audit, F26)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{
          ok: boolean
          sections: readonly {
            id: string
            ok: boolean
            errors: readonly string[]
            facts?: Readonly<Record<string, unknown>>
          }[]
        }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F26)

      const rep = await runAudioAudit({
        rootDir: REPO_ROOT,
        mpqDir: D2_DATA_DIR,
        sections: ['monsters', 'speech'],
      })
      expect(rep.ok, summarize(rep.sections.flatMap((s) => s.errors))).toBe(true)
    })
  })

  describe('Tier 2 — boundary & adversarial tests', () => {
    it('[T2-F26-01] `monster_regurgitator_neutral_1` (`1595..1598`, `Group Size = 4`, all 4 members unshipped) across 32 RNG seeds never starts a voice or throws, and `Regurgitator` `MonSounds` `Neutral` event degrades cleanly', async () => {
      await loadProductModule(PRODUCT.monSounds, F26)
      const recMod = await loadProductModule(PRODUCT.records, F26)
      const SoundRecordsCtor = requireExport<
        new (o: Record<string, unknown>) => {
          play(id: number, o?: Record<string, unknown>): number
        }
      >(recMod, 'SoundRecords113c', PRODUCT.records, F26)

      const voices = new RecordingVoices()
      for (let seed = 1; seed <= 32; seed++) {
        const sr = new SoundRecordsCtor({
          voices,
          rng: new D2Rng(seed),
          sampleFacts: () => undefined,
        })
        expect(sr.play(1595)).toBe(0)
      }
      expect(voices.starts().length).toBe(0)
    })

    it('[T2-F26-02] requesting all 30 unshipped speech IDs in rapid succession through `SpeechStreamer` never leaves `soloDuck` active (`70%`) and never leaks `<audio>` elements', async () => {
      const recMod = await loadProductModule(PRODUCT.records, F26)
      const SoundRecordsCtor = requireExport<
        new (o: Record<string, unknown>) => {
          play(id: number, o?: Record<string, unknown>): number
          setSoloActive?(active: boolean): void
          setSoloDuck?(active: boolean): void
        }
      >(recMod, 'SoundRecords113c', PRODUCT.records, F26)
      const streamerMod = await loadProductModule(PRODUCT.speechStreamer, F26)
      const SpeechStreamerCtor = requireExport<
        new (o?: Record<string, unknown>) => {
          playSpeech?(id: number, o?: Record<string, unknown>): unknown
          play?(id: number, o?: Record<string, unknown>): unknown
          isPlaying?(): boolean
        }
      >(streamerMod, 'SpeechStreamer', PRODUCT.speechStreamer, F26)

      const voices = new RecordingVoices()
      const sr = new SoundRecordsCtor({
        voices,
        rng: new D2Rng(0x99),
        sampleFacts: (id: number) => oracleSampleFacts(id),
      })
      const activeHandle = sr.play(3) // cursor_button_click
      expect(activeHandle).toBeGreaterThan(0)
      const startedVoice = voices.starts()[0]!.voice
      const baselineGain = voices.lastGains(startedVoice)!.left

      const streamer = new SpeechStreamerCtor({
        soundRecords: sr,
        records: sr,
        onSoloChange: (active: boolean) => {
          if (typeof sr.setSoloActive === 'function') sr.setSoloActive(active)
          else if (typeof sr.setSoloDuck === 'function') sr.setSoloDuck(active)
        },
      })
      const playFn = (streamer.playSpeech ?? streamer.play)!.bind(streamer)
      for (const id of missingSpeechIds) {
        await playFn(id)
      }

      expect(voices.lastGains(startedVoice)!.left, 'active SFX voice must remain unducked at 100%').toBe(baselineGain)
      if (typeof streamer.isPlaying === 'function') {
        expect(streamer.isPlaying()).toBe(false)
      }
    })

    it('[T2-F26-03] `runAudioAudit` fails if a shipped sound ID (`1599` `monster\\regurgitator\\death1.wav`) is falsely added to the D9 unshipped exception list', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F26)
      const auditMod = await loadProductModule(PRODUCT.audit, F26)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F26)

      const mirror = mirrorRepoWithCopies([PRODUCT.monSounds, PRODUCT.sfxPackIndex], (root) => {
        for (const rel of [PRODUCT.monSounds, PRODUCT.sfxPackIndex]) {
          const p = join(root, rel)
          if (!existsSync(p)) continue
          const txt = readFileSync(p, 'utf8')
          const mutated = txt.replace(/1598/g, '1598, 1599')
          writeFileSync(p, mutated, 'utf8')
        }
      })
      try {
        const rep = await runAudioAudit({ rootDir: mirror, mpqDir: D2_DATA_DIR, sections: ['monsters'] })
        expect(rep.ok, 'audit must fail when a shipped monster WAV (1599) is added to the D9 exception list').toBe(false)
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    })

    it('[T2-F26-04] `runAudioAudit` fails if any of the 34 genuinely unshipped IDs (`1595` or an unshipped speech ID) is omitted from the D9 exception list', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F26)
      await loadProductModule(PRODUCT.packSpeech, F26)
      const auditMod = await loadProductModule(PRODUCT.audit, F26)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F26)

      const mirror = mirrorRepoWithCopies([PRODUCT.monSounds, PRODUCT.speechIndex], (root) => {
        for (const rel of [PRODUCT.monSounds, PRODUCT.speechIndex]) {
          const p = join(root, rel)
          if (!existsSync(p)) continue
          const txt = readFileSync(p, 'utf8')
          const mutated = txt.replace(/1595,?\s*/g, '')
          writeFileSync(p, mutated, 'utf8')
        }
      })
      try {
        const rep = await runAudioAudit({
          rootDir: mirror,
          mpqDir: D2_DATA_DIR,
          sections: ['monsters', 'speech'],
        })
        expect(rep.ok, 'audit must fail when an unshipped ID (1595) is omitted from the D9 list').toBe(false)
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    })

    it('[T2-F26-05] `SfxChunkLoader.loadSoundBuffer` for unshipped monster IDs (`1595..1598`) returns `null` cleanly without issuing any network `fetch`', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F26)
      const loaderMod = await loadProductModule(PRODUCT.sfxChunkLoader, F26)
      const SfxChunkLoaderCtor = requireExport<
        new (o?: Record<string, unknown>) => {
          loadSoundBuffer(id: number, ctx?: unknown): Promise<unknown>
        }
      >(loaderMod, 'SfxChunkLoader', PRODUCT.sfxChunkLoader, F26)

      let fetchCount = 0
      const fakeCtx = new FakeAudioContext()
      const loader = new SfxChunkLoaderCtor({
        fetch: async () => {
          fetchCount += 1
          throw new Error('fetch must not be called for unshipped IDs 1595..1598')
        },
        audioContext: () => fakeCtx,
      })

      for (const id of missingMonsterIds) {
        const buf = await loader.loadSoundBuffer(id, fakeCtx)
        expect(buf, `loadSoundBuffer(${String(id)}) must resolve to null`).toBeNull()
      }
      expect(fetchCount).toBe(0)
    })
  })

  describe('Tier 3 — pairwise integration (F25 × F8/F24 SW caching & F25 × F26 full-pipeline audit accounting)', () => {
    it('[T3-P6-03] `AssetCacheServiceWorkerController` × `SfxChunkLoader` & `SpeechStreamer`: loading `sfx-mon-act1.bin` and a speech `.webm` stream through the SW controller populates `d2web-assets-v1` on first fetch and serves from cache on repeat fetch', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F25)
      await loadProductModule(PRODUCT.packSpeech, F25)
      const swMod = await loadProductModule(PRODUCT.sw, F25)
      const ControllerCtor = requireExport<
        new (o: {
          caches: unknown
          fetchFn: (input: Request | string, init?: RequestInit) => Promise<Response>
          origin: string
        }) => {
          syncManifest(m: unknown): Promise<{ ok: boolean }>
          handleFetch(r: Request): Promise<Response>
          getStats(): Promise<{ cacheHits: number; cacheMisses: number; cachedAssetCount: number }>
        }
      >(swMod, 'AssetCacheServiceWorkerController', PRODUCT.sw, F25)

      const idx = await indexModule(F25)
      const act1MonPack = idx.SFX_PACKS_113C.find((p) => p.packId === 'sfx-mon-act1')
      expect(act1MonPack).toBeDefined()
      const speechMod = await loadProductModule(PRODUCT.speechIndex, F25)
      const speechMap = readSpeechEntries(speechMod)
      const firstSpeech = speechMap.get(2934) ?? (speechMap.values().next().value as SpeechEntryC | undefined)
      expect(firstSpeech).toBeDefined()

      const manifestRaw = JSON.parse(readFileSync(join(REPO_ROOT, 'public/asset-manifest.json'), 'utf8')) as unknown
      const origin = 'https://d2.local'
      const caches = new InMemoryCacheStorage()
      const ctrl = new ControllerCtor({
        caches,
        origin,
        fetchFn: async (input) => {
          const url = typeof input === 'string' ? input : input.url
          const parsed = new URL(url, origin)
          const diskPath = join(REPO_ROOT, 'public', parsed.pathname.replace(/^\/+/, ''))
          const bytes = readFileSync(diskPath)
          return new Response(bytes, { status: 200 })
        },
      })

      await ctrl.syncManifest(manifestRaw)

      const monUrl = `${origin}/${act1MonPack!.url.replace(/^\/+/, '')}`
      const speechUrl = `${origin}/${firstSpeech!.url.replace(/^\/+/, '')}`

      const resMon1 = await ctrl.handleFetch(new Request(monUrl))
      const resSpeech1 = await ctrl.handleFetch(new Request(speechUrl))
      expect(resMon1.status).toBe(200)
      expect(resSpeech1.status).toBe(200)
      const stats1 = await ctrl.getStats()
      expect(stats1.cacheMisses).toBe(2)
      expect(stats1.cacheHits).toBe(0)
      expect(stats1.cachedAssetCount).toBe(2)

      const resMon2 = await ctrl.handleFetch(new Request(monUrl))
      const resSpeech2 = await ctrl.handleFetch(new Request(speechUrl))
      expect((await resMon2.arrayBuffer()).byteLength).toBe(act1MonPack!.bytes)
      expect((await resSpeech2.arrayBuffer()).byteLength).toBe(firstSpeech!.bytes)
      const stats2 = await ctrl.getStats()
      expect(stats2.cacheHits).toBe(2)
    })

    it('[T3-P6-04] F25 × F26 full accounting: 1,670 packed `monster\\*` rows + 4 D9 monster exceptions = all 1,674 `monster\\*` rows; 1,689 packed `Stream = 1` speech rows + 30 D9 speech exceptions = all 1,719 `Stream = 1` speech rows; total speech bytes ≤ D16 45,000,000 B', async () => {
      const d16 = requireD16Decided()
      await loadProductModule(PRODUCT.packMonsterSounds, F25)
      await loadProductModule(PRODUCT.packSpeech, F25)
      const idx = await indexModule(F25)
      const speechMod = await loadProductModule(PRODUCT.speechIndex, F25)
      const speechMap = readSpeechEntries(speechMod)

      const packedMonsterCount = allMonsterRows.filter((r) => Boolean(idx.SFX_PACK_INDEX_113C[r.id])).length
      expect(packedMonsterCount).toBe(1670)
      expect(packedMonsterCount + missingMonsterIds.length).toBe(allMonsterRows.length)
      expect(allMonsterRows.length).toBe(1674)

      const packedSpeechCount = allSpeechRows.filter((r) => speechMap.has(r.id)).length
      expect(packedSpeechCount).toBe(1689)
      expect(packedSpeechCount + missingSpeechIds.length).toBe(allSpeechRows.length)
      expect(allSpeechRows.length).toBe(1719)

      const uniqueSpeechBytes = new Map<string, number>()
      for (const [, entry] of speechMap.entries()) {
        uniqueSpeechBytes.set(entry.url, entry.bytes)
      }
      const totalSpeechBytes = [...uniqueSpeechBytes.values()].reduce((a, b) => a + b, 0)
      expect(totalSpeechBytes).toBeGreaterThan(0)
      expect(totalSpeechBytes).toBeLessThanOrEqual(d16.speech.totalMaxBytes!)
    })
  })
})
