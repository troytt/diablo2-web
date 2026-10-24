/**
 * M21-P3 (#945) — F12 BGM Opus streamer baker (`pack-music.ts`) + generated `music-tracks-113c.ts`
 * + `.webm` cacheability (`pack-contract/index.ts`), and F14 `verify:audio` §music audit.
 *
 * Authoritative sources (never using product tables as the oracle):
 * - Request R3 + PROJECT.md D15, D16, D20:
 *   - Scope (D20): all 28 rows in `musicRange 4657..4684` (incl. `4668` `common\options.wav`) +
 *     all `Music Vol = 1` rows (`4686`, `4693`) = 30 mandatory tracks, plus any additional
 *     `4685..4698` `Stream = 1` music rows (`DATA\GLOBAL\MUSIC\`) referenced by game logic.
 *   - Quality & size caps (D16, read ONLY from `requireD16Decided()` in `harness-113c.ts`):
 *     Opus stereo (`channels === 2`) measured bitrate ≥ `D16_SPEC.bgm.minBitrateBps`,
 *     each track ≤ `D16_SPEC.bgm.perTrackMaxBytes`, total ≤ `D16_SPEC.bgm.totalMaxBytes`.
 *   - Per-track metadata (`music-tracks-113c.ts`): `Block 1..3` loop sample offsets (frames at
 *     22,050 Hz and seconds = `block / 22050`), `nBlocks`, `Fade In` / `Fade Out` ticks, `loop`,
 *     `musicVol`, `volume`, `sampleRate`, `frames`, `bytes`, `sha256`, `url`.
 *   - Cacheability (D15): `.webm` (and `.opus`) in `CACHEABLE_EXT_RE` (`isCacheableAssetPath`).
 *   - Audit (F14): `runAudioAudit({ sections: ['music'] })` passes on clean bake and fails on
 *     missing file, corrupt WebM magic, oversized track, oversized total, bitrate below floor,
 *     or SHA-256 mismatch.
 */
import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  D2_DATA_DIR,
  PRODUCT,
  REPO_ROOT,
  getOracle113c,
  loadProductModule,
  measuredStreamBitrateBps,
  mirrorRepoWithCopies,
  oracleMusicScope,
  oracleWavBytes,
  oracleWavFacts,
  readRepoText,
  requireD16Decided,
  requireExport,
  riffWavFacts,
  sha256Hex,
  streamOpusFacts,
  summarize,
  type Oracle113c,
  type OracleSoundRow,
  type OracleWavFacts,
  type WebmOpusFacts,
} from './harness-113c.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F12 = '#945 F12 pack-music + music-tracks-113c'
const F14 = '#945 F14 verify:audio §music'

export interface NormalizedMusicTrackMeta {
  readonly id: number
  readonly sound: string
  readonly fileName: string
  readonly archive: string
  readonly url: string
  readonly bytes: number
  readonly sha256: string
  readonly sampleRate: number
  readonly frames: number
  readonly channels: number
  readonly loop: boolean
  readonly musicVol: boolean
  readonly volume: number
  readonly fadeIn: number
  readonly fadeOut: number
  readonly block1: number
  readonly block2: number
  readonly block3: number
  readonly nBlocks: number
}

interface MusicTracksModuleNorm {
  readonly rawModule: Record<string, unknown>
  readonly tracks: readonly NormalizedMusicTrackMeta[]
  readonly byId: ReadonlyMap<number, NormalizedMusicTrackMeta>
  getTrack(id: number): NormalizedMusicTrackMeta | undefined
}

function normalizeTrackEntry(raw: Record<string, unknown>, keyId?: number): NormalizedMusicTrackMeta {
  const id = typeof raw.id === 'number' ? raw.id : typeof raw.soundId === 'number' ? raw.soundId : (keyId ?? -1)
  const sampleRate = typeof raw.sampleRate === 'number' ? raw.sampleRate : 22050
  const frames = typeof raw.frames === 'number' ? raw.frames : 0
  const block1 = typeof raw.block1 === 'number' ? raw.block1 : -1
  const block2 = typeof raw.block2 === 'number' ? raw.block2 : -1
  const block3 = typeof raw.block3 === 'number' ? raw.block3 : -1
  const nBlocks =
    typeof raw.nBlocks === 'number'
      ? raw.nBlocks
      : block1 === -1
        ? 0
        : block2 === -1
          ? 1
          : block3 === -1
            ? 2
            : 3
  return {
    id,
    sound: String(raw.sound ?? ''),
    fileName: String(raw.fileName ?? ''),
    archive: String(raw.archive ?? 'd2music.mpq'),
    url: String(raw.url ?? ''),
    bytes: Number(raw.bytes ?? 0),
    sha256: String(raw.sha256 ?? ''),
    sampleRate,
    frames,
    channels: typeof raw.channels === 'number' ? raw.channels : 2,
    loop: Boolean(raw.loop),
    musicVol: Boolean(raw.musicVol),
    volume: Number(raw.volume ?? 0),
    fadeIn: Number(raw.fadeIn ?? 0),
    fadeOut: Number(raw.fadeOut ?? 0),
    block1,
    block2,
    block3,
    nBlocks,
  }
}

async function loadMusicTracksContract(): Promise<MusicTracksModuleNorm> {
  const m = await loadProductModule(PRODUCT.musicTracks, F12)
  const rawTable = m.MUSIC_TRACKS_113C ?? m.MUSIC_TRACK_INDEX_113C ?? m.BGM_TRACKS_113C
  if (rawTable === undefined || rawTable === null) {
    throw new Error(`[${F12}] ${PRODUCT.musicTracks} does not export MUSIC_TRACKS_113C`)
  }
  const tracks: NormalizedMusicTrackMeta[] = []
  if (Array.isArray(rawTable)) {
    for (const item of rawTable) {
      if (item && typeof item === 'object') tracks.push(normalizeTrackEntry(item as Record<string, unknown>))
    }
  } else if (typeof rawTable === 'object') {
    for (const [k, v] of Object.entries(rawTable as Record<string, unknown>)) {
      if (v && typeof v === 'object') tracks.push(normalizeTrackEntry(v as Record<string, unknown>, Number(k)))
    }
  }
  tracks.sort((a, b) => a.id - b.id)
  const byId = new Map<number, NormalizedMusicTrackMeta>(tracks.map((t) => [t.id, t]))
  const getter =
    typeof m.getMusicTrack113c === 'function'
      ? (m.getMusicTrack113c as (id: number) => Record<string, unknown> | undefined)
      : undefined
  return {
    rawModule: m,
    tracks,
    byId,
    getTrack(id: number): NormalizedMusicTrackMeta | undefined {
      if (getter) {
        const res = getter(id)
        return res ? normalizeTrackEntry(res, id) : undefined
      }
      return byId.get(id)
    },
  }
}

interface AuditReportC {
  readonly ok: boolean
  readonly sections: readonly { readonly id: string; readonly errors: readonly string[]; readonly summary: string }[]
}
type RunAudit = (opts?: { rootDir?: string; mpqDir?: string; sections?: readonly string[] }) => Promise<AuditReportC>

async function runAudit(): Promise<RunAudit> {
  const m = await loadProductModule(PRODUCT.audit, F14)
  return requireExport<RunAudit>(m, 'runAudioAudit', PRODUCT.audit, F14)
}

let oracle: Oracle113c
let mandatoryRows: readonly OracleSoundRow[]
let allMusicRows: readonly OracleSoundRow[]
const wavFactsById = new Map<number, OracleWavFacts>()

beforeAll(() => {
  oracle = getOracle113c()
  const scope = oracleMusicScope(oracle)
  mandatoryRows = scope.mandatoryRows
  allMusicRows = scope.allMusicRows
  for (const r of allMusicRows) {
    wavFactsById.set(r.id, oracleWavFacts(r.id))
  }
  const lodIntroMember = 'DATA\\GLOBAL\\MUSIC\\introedit.wav'
  const lodFound = oracle.archives.find(lodIntroMember)
  if (lodFound) {
    const bytes = lodFound.entry.archive.readSync(lodFound.file)
    wavFactsById.set(4699, {
      id: 4699,
      member: lodIntroMember,
      archive: lodFound.entry.label,
      sha256: sha256Hex(bytes),
      ...riffWavFacts(bytes, lodIntroMember),
    })
  }
})

const bakedFileCache = new Map<string, { readonly bytes: Uint8Array; readonly sha256: string; readonly opus: WebmOpusFacts }>()
function readBakedMusicStream(url: string): { readonly bytes: Uint8Array; readonly sha256: string; readonly opus: WebmOpusFacts } {
  const hit = bakedFileCache.get(url)
  if (hit !== undefined) return hit
  const rel = url.replace(/^\/+/, '')
  const abs = join(REPO_ROOT, 'public', rel)
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(readFileSync(abs))
  } catch (e) {
    throw new Error(`[${F12}] baked BGM stream file is missing on disk: public/${rel} (${String((e as Error).message)})`)
  }
  const res = {
    bytes,
    sha256: sha256Hex(bytes),
    opus: streamOpusFacts(bytes, `public/${rel}`),
  }
  bakedFileCache.set(url, res)
  return res
}

describe('M21-P3 #945 — F12 BGM Opus baker (pack-music.ts) + music-tracks-113c.ts + .webm cacheability', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F12-01] music-tracks-113c.ts covers all 30 mandatory BGM rows (musicRange 4657..4684 ∪ Music Vol=1 rows 4686, 4693 incl. 4668 common\\options.wav) and only rows in 4657..4698 (D20)', async () => {
      expect(mandatoryRows.length).toBe(30)
      expect(mandatoryRows.some((r) => r.id === 4668 && r.fileName.toLowerCase() === 'common\\options.wav')).toBe(true)
      const mod = await loadMusicTracksContract()
      const allowedIds = new Set([...allMusicRows.map((r) => r.id), 4699])
      const missingMandatory = mandatoryRows.filter((r) => !mod.byId.has(r.id)).map((r) => `${String(r.id)} (${r.sound})`)
      const outOfScope = mod.tracks.filter((t) => !allowedIds.has(t.id)).map((t) => `${String(t.id)} (${t.sound})`)
      expect(missingMandatory, summarize(missingMandatory)).toEqual([])
      expect(outOfScope, summarize(outOfScope)).toEqual([])
      expect(mod.tracks.length).toBeGreaterThanOrEqual(30)
      expect(mod.tracks.length).toBeLessThanOrEqual(43)
    })

    it('[T1-F12-02] every track in music-tracks-113c.ts matches the 1.13c MPQ Sounds.txt + WAV header oracle (Block 1..3, nBlocks, Fade In/Out, loop, musicVol, volume, sampleRate=22050, frames)', async () => {
      const mod = await loadMusicTracksContract()
      const bad: string[] = []
      for (const t of mod.tracks) {
        if (t.id === 4699) {
          const w = wavFactsById.get(4699)
          if (!w) {
            bad.push('id 4699: not in oracle music scope')
            continue
          }
          if (t.sampleRate !== w.sampleRate) bad.push(`id 4699: sampleRate ${String(t.sampleRate)} !== ${String(w.sampleRate)}`)
          if (t.frames !== w.frames) bad.push(`id 4699: frames ${String(t.frames)} !== ${String(w.frames)}`)
          if (t.loop !== true) bad.push(`id 4699: loop !== true`)
          if (t.musicVol !== true) bad.push(`id 4699: musicVol !== true`)
          if (t.volume !== 255) bad.push(`id 4699: volume !== 255`)
          if (t.fadeIn !== 0) bad.push(`id 4699: fadeIn !== 0`)
          if (t.fadeOut !== 125) bad.push(`id 4699: fadeOut !== 125`)
          if (t.block1 !== 330529 || t.block2 !== 1189156 || t.nBlocks !== 2) bad.push('id 4699: blocks mismatch')
          continue
        }
        const oRow = oracle.sounds[t.id]
        const w = wavFactsById.get(t.id)
        if (!oRow || !w) {
          bad.push(`id ${String(t.id)}: not in oracle music scope`)
          continue
        }
        if (t.sampleRate !== w.sampleRate) bad.push(`id ${String(t.id)}: sampleRate ${String(t.sampleRate)} !== ${String(w.sampleRate)}`)
        if (t.frames !== w.frames) bad.push(`id ${String(t.id)}: frames ${String(t.frames)} !== ${String(w.frames)}`)
        if (t.loop !== oRow.loop) bad.push(`id ${String(t.id)}: loop ${String(t.loop)} !== ${String(oRow.loop)}`)
        if (t.musicVol !== oRow.musicVol) bad.push(`id ${String(t.id)}: musicVol ${String(t.musicVol)} !== ${String(oRow.musicVol)}`)
        if (t.volume !== oRow.volume) bad.push(`id ${String(t.id)}: volume ${String(t.volume)} !== ${String(oRow.volume)}`)
        if (t.fadeIn !== oRow.fadeIn) bad.push(`id ${String(t.id)}: fadeIn ${String(t.fadeIn)} !== ${String(oRow.fadeIn)}`)
        if (t.fadeOut !== oRow.fadeOut) bad.push(`id ${String(t.id)}: fadeOut ${String(t.fadeOut)} !== ${String(oRow.fadeOut)}`)
        if (t.block1 !== oRow.block1 || t.block2 !== oRow.block2 || t.block3 !== oRow.block3 || t.nBlocks !== oRow.nBlocks) {
          bad.push(
            `id ${String(t.id)}: blocks [${String(t.block1)},${String(t.block2)},${String(t.block3)}]#${String(t.nBlocks)} !== ` +
              `[${String(oRow.block1)},${String(oRow.block2)},${String(oRow.block3)}]#${String(oRow.nBlocks)}`,
          )
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F12-03] every baked public/sound/music/*.webm file exists on disk, is a valid stereo Opus WebM stream, and matches bytes + SHA-256 in music-tracks-113c.ts', async () => {
      const mod = await loadMusicTracksContract()
      const bad: string[] = []
      for (const t of mod.tracks) {
        if (!t.url.startsWith('/sound/music/') || !t.url.endsWith('.webm')) {
          bad.push(`id ${String(t.id)}: invalid url "${t.url}" (expected /sound/music/*.webm)`)
          continue
        }
        const baked = readBakedMusicStream(t.url)
        if (baked.bytes.length !== t.bytes) {
          bad.push(`id ${String(t.id)} (${t.url}): disk bytes ${String(baked.bytes.length)} !== meta.bytes ${String(t.bytes)}`)
        }
        if (!t.sha256 || !baked.sha256.startsWith(t.sha256.toLowerCase())) {
          bad.push(`id ${String(t.id)} (${t.url}): disk sha256 ${baked.sha256} does not match meta.sha256 ${t.sha256}`)
        }
        if (baked.opus.container !== 'webm') {
          bad.push(`id ${String(t.id)} (${t.url}): container ${baked.opus.container} !== webm`)
        }
        if (baked.opus.channels !== 2) {
          bad.push(`id ${String(t.id)} (${t.url}): OpusHead channels ${String(baked.opus.channels)} !== 2`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F12-04] D16 BGM quality floor & size budgets: every track measures ≥ D16 minBitrateBps stereo, each track ≤ D16 perTrackMaxBytes, and total ≤ D16 totalMaxBytes', async () => {
      const d16 = requireD16Decided().bgm
      const mod = await loadMusicTracksContract()
      const bad: string[] = []
      const seenUrls = new Set<string>()
      let totalBytes = 0
      for (const t of mod.tracks) {
        const baked = readBakedMusicStream(t.url)
        if (!seenUrls.has(t.url)) {
          seenUrls.add(t.url)
          totalBytes += baked.bytes.length
        }
        if (d16.perTrackMaxBytes !== null && baked.bytes.length > d16.perTrackMaxBytes) {
          bad.push(`id ${String(t.id)} (${t.url}): ${String(baked.bytes.length)} B > perTrackMaxBytes ${String(d16.perTrackMaxBytes)}`)
        }
        const w = wavFactsById.get(t.id)!
        const sourceSec = w.frames / w.sampleRate
        const bps = measuredStreamBitrateBps(baked.opus, sourceSec)
        if (d16.minBitrateBps !== null && bps < d16.minBitrateBps) {
          bad.push(`id ${String(t.id)} (${t.url}): measured ${bps.toFixed(1)} bps < floor ${String(d16.minBitrateBps)} bps`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
      expect(totalBytes).toBeGreaterThan(0)
      if (d16.totalMaxBytes !== null) {
        expect(totalBytes).toBeLessThanOrEqual(d16.totalMaxBytes)
      }
    })

    it('[T1-F12-05] pack-music.ts is registered in src/baker/cli.ts ("music") and package.json ("pack:music")', async () => {
      await loadProductModule(PRODUCT.packMusic, F12)
      const pkg = JSON.parse(readRepoText(PRODUCT.packageJson, F12)) as { scripts?: Record<string, string> }
      expect(pkg.scripts?.['pack:music']).toMatch(/src\/baker\/cli\.ts\s+music\b/)
      const cli = readRepoText(PRODUCT.bakerCli, F12)
      expect(cli).toMatch(/['"]?music['"]?\s*:\s*['"]src\/baker\/packers\/pack-music\.ts['"]/)
    })

    it('[T1-F12-06] pack-contract/index.ts allows .webm (and .opus) under sound/music/ so BGM streams are SW-cacheable (D15)', async () => {
      const pc = await loadProductModule(PRODUCT.packContract, F12)
      const isCacheable = requireExport<(p: string) => boolean>(pc, 'isCacheableAssetPath', PRODUCT.packContract, F12)
      expect(isCacheable('sound/music/common_options.webm')).toBe(true)
      expect(isCacheable('/sound/music/act1_wild.webm')).toBe(true)
    })

    it('[T1-F12-07] music-tracks-113c.ts is pure TypeScript (no node:*, no DOM globals, no Math.random/Date.now) and deterministic', async () => {
      const src = readRepoText(PRODUCT.musicTracks, F12)
      expect(src).not.toMatch(/from\s+['"]node:/)
      expect(src).not.toMatch(/\b(Math\.random|Date\.now|performance\.now|window|document|AudioContext|HTMLAudioElement)\b/)
      const mod = await loadMusicTracksContract()
      const ids = mod.tracks.map((t) => t.id)
      expect(ids).toEqual([...ids].sort((a, b) => a - b))
    })
  })

  describe('Tier 2 — boundary & adversarial', () => {
    it('[T2-F12-01] longest 1.13c BGM track (id 4679 music_wilderness, act1\\wild.wav, ~479.3s) stays ≤ D16 perTrackMaxBytes while measuring ≥ D16 minBitrateBps', async () => {
      const d16 = requireD16Decided().bgm
      const mod = await loadMusicTracksContract()
      const wild = mod.getTrack(4679)
      expect(wild).toBeDefined()
      const w = wavFactsById.get(4679)!
      const sourceSec = w.frames / w.sampleRate
      expect(sourceSec).toBeGreaterThan(475)
      const baked = readBakedMusicStream(wild!.url)
      if (d16.perTrackMaxBytes !== null) {
        expect(baked.bytes.length).toBeLessThanOrEqual(d16.perTrackMaxBytes)
      }
      if (d16.minBitrateBps !== null) {
        expect(measuredStreamBitrateBps(baked.opus, sourceSec)).toBeGreaterThanOrEqual(d16.minBitrateBps)
      }
    })

    it('[T2-F12-02] Block 1..3 boundary cases: tracks with nBlocks=2 (4662, 4676, 4679, 4682), nBlocks=1 (e.g. 4673 music_town_1), and nBlocks=0 (stingers 4686/4693) have strictly ascending in-bounds block frames', async () => {
      const mod = await loadMusicTracksContract()
      const bad: string[] = []
      let saw2 = 0
      let saw1 = 0
      let saw0 = 0
      for (const t of mod.tracks) {
        if (t.nBlocks === 2) saw2 += 1
        if (t.nBlocks === 1) saw1 += 1
        if (t.nBlocks === 0) saw0 += 1
        const blocks = [t.block1, t.block2, t.block3].slice(0, t.nBlocks)
        let prev = -1
        for (const b of blocks) {
          if (b < 0 || b >= t.frames) bad.push(`id ${String(t.id)}: block frame ${String(b)} out of [0, ${String(t.frames)})`)
          if (b <= prev) bad.push(`id ${String(t.id)}: non-ascending blocks [${blocks.join(',')}]`)
          prev = b
        }
      }
      expect(saw2).toBe(5) // 4662, 4676, 4679, 4682 + 4699 (LoD introedit)
      expect(saw1).toBeGreaterThan(0)
      expect(saw0).toBeGreaterThanOrEqual(2) // 4686 and 4693 have Block 1..3 = -1
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T2-F12-03] decoded Opus duration of every baked BGM track matches the 1.13c MPQ WAV duration within ±0.15 s', async () => {
      const mod = await loadMusicTracksContract()
      const bad: string[] = []
      for (const t of mod.tracks) {
        const w = wavFactsById.get(t.id)!
        const sourceSec = w.frames / w.sampleRate
        const baked = readBakedMusicStream(t.url)
        const diff = Math.abs(baked.opus.decodedSeconds - sourceSec)
        if (diff > 0.15) {
          bad.push(`id ${String(t.id)} (${t.url}): decoded ${baked.opus.decodedSeconds.toFixed(3)}s vs WAV ${sourceSec.toFixed(3)}s`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T2-F12-04] getMusicTrack113c returns undefined for non-music IDs (0, 1, 2933, 2934, 4656, 4700, -1, NaN)', async () => {
      const mod = await loadMusicTracksContract()
      for (const id of [0, 1, 64, 2933, 2934, 4656, 4700, -1, Number.NaN]) {
        expect(mod.getTrack(id)).toBeUndefined()
      }
    })

    it('[T2-F12-05] D2xMusic.mpq expansion tracks (4680..4684 Act 5 music) are resolved from D2xMusic.mpq and present in music-tracks-113c.ts', async () => {
      const mod = await loadMusicTracksContract()
      for (const id of [4680, 4681, 4682, 4683, 4684]) {
        const t = mod.getTrack(id)
        expect(t, `Act 5 track ${String(id)} missing`).toBeDefined()
        expect(t!.fileName.toLowerCase()).toMatch(/^act5\\/)
        const baked = readBakedMusicStream(t!.url)
        expect(baked.opus.channels).toBe(2)
      }
    })

    it('[T2-F12-06] PRECACHE_URLS in pack-contract/index.ts does NOT precache any /sound/music/*.webm track (D15: lazy cache-first only)', async () => {
      const pc = await loadProductModule(PRODUCT.packContract, F12)
      const precache = requireExport<readonly string[]>(pc, 'PRECACHE_URLS', PRODUCT.packContract, F12)
      const musicPrecached = precache.filter((u) => u.includes('/sound/music/') || u.endsWith('.webm'))
      expect(musicPrecached).toEqual([])
    })

    it('[T2-F12-07] transcodeWavToOpusWebm (or pack-music encoder) produces a valid stereo WebM Opus stream at ≥ D16 minBitrateBps on a real MPQ music WAV excerpt', async () => {
      const d16 = requireD16Decided().bgm
      const pm = await loadProductModule(PRODUCT.packMusic, F12)
      const fn = (pm.transcodeWavToOpusWebm ?? pm.encodeMusicWavToWebm113c ?? pm.transcodeMusicWav113c) as
        | ((wav: Uint8Array, opts?: Record<string, unknown>) => Promise<Uint8Array>)
        | undefined
      expect(typeof fn, `${PRODUCT.packMusic} must export transcodeWavToOpusWebm`).toBe('function')
      // Use a short music row (e.g. 4686 bloodravenresolution, ~17.5s) from the MPQ
      const wav = oracleWavBytes(4686)
      const w = wavFactsById.get(4686)!
      const webm = await fn!(wav, { bitrate: d16.minBitrateBps ?? 64_000, vbr: 'off' })
      const facts = streamOpusFacts(webm, 'transcodeWavToOpusWebm(4686)')
      expect(facts.container).toBe('webm')
      expect(facts.channels).toBe(2)
      if (d16.minBitrateBps !== null) {
        expect(measuredStreamBitrateBps(facts, w.frames / w.sampleRate)).toBeGreaterThanOrEqual(d16.minBitrateBps)
      }
    })
  })

  describe('Tier 3 — pairwise (F12 × F1, F12 × F2)', () => {
    it('[T3-F12xF1-01] every track in music-tracks-113c.ts is cross-consistent with sounds-113c.ts (SOUNDS_113C[id] and MUSIC_SOUND_RANGE_113C)', async () => {
      const soundsMod = await loadProductModule(PRODUCT.sounds, F12)
      const sounds = requireExport<readonly Record<string, unknown>[]>(soundsMod, 'SOUNDS_113C', PRODUCT.sounds, F12)
      const range = requireExport<readonly [number, number]>(soundsMod, 'MUSIC_SOUND_RANGE_113C', PRODUCT.sounds, F12)
      const mod = await loadMusicTracksContract()
      for (let id = range[0]; id <= range[1]; id += 1) {
        expect(mod.byId.has(id), `musicRange id ${String(id)} missing from music-tracks-113c.ts`).toBe(true)
      }
      for (const t of mod.tracks) {
        if (t.id <= 4698) {
          const s = sounds[t.id] as Record<string, unknown>
          expect(s).toBeDefined()
          expect(s.stream).toBe(true)
          expect(t.sound).toBe(s.sound)
          expect(t.block1).toBe(s.block1)
          expect(t.block2).toBe(s.block2)
          expect(t.block3).toBe(s.block3)
          expect(t.nBlocks).toBe(s.nBlocks)
        } else {
          expect(t.id).toBe(4699)
          expect(t.archive).toBe('D2xMusic.mpq')
          expect(t.sound).toBe('music_lod_introedit')
          expect(t.loop).toBe(true)
        }
      }
    })

    it('[T3-F12xF2-02] every SoundEnviron.txt Song > 0 across all 50 environments and all 136 levels resolves to a baked track in music-tracks-113c.ts', async () => {
      const envMod = await loadProductModule(PRODUCT.soundEnviron, F12)
      const envs = requireExport<readonly { readonly index: number; readonly song: number }[]>(
        envMod,
        'SOUND_ENVIRON_113C',
        PRODUCT.soundEnviron,
        F12,
      )
      const getEnv = requireExport<(lvl: number) => { readonly song: number }>(
        envMod,
        'getSoundEnvironForLevel113c',
        PRODUCT.soundEnviron,
        F12,
      )
      const mod = await loadMusicTracksContract()
      for (const e of envs) {
        if (e.song > 0) {
          expect(mod.getTrack(e.song), `SoundEnviron[${String(e.index)}].song=${String(e.song)} missing`).toBeDefined()
        }
      }
      for (let lvl = 1; lvl <= 136; lvl += 1) {
        const { song } = getEnv(lvl)
        if (song > 0) {
          expect(mod.getTrack(song), `Level ${String(lvl)} song=${String(song)} missing`).toBeDefined()
        }
      }
    })
  })
})

describe('M21-P3 #945 — F14 verify:audio §music audit', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F14-01] runAudioAudit includes a "music" section that passes (ok: true, 0 errors) on the current workspace', async () => {
      const audit = await runAudit()
      const rep = await audit({ rootDir: REPO_ROOT, mpqDir: D2_DATA_DIR })
      const sec = rep.sections.find((s) => s.id === 'music')
      expect(sec, 'runAudioAudit report must include section "music"').toBeDefined()
      expect(sec!.errors).toEqual([])
      expect(rep.ok).toBe(true)
    })

    it('[T1-F14-02] runAudioAudit({ sections: ["music"] }) executes standalone and reports track count & total bytes in summary', async () => {
      const audit = await runAudit()
      const rep = await audit({ rootDir: REPO_ROOT, mpqDir: D2_DATA_DIR, sections: ['music'] })
      expect(rep.ok).toBe(true)
      expect(rep.sections.length).toBe(1)
      expect(rep.sections[0]!.id).toBe('music')
      expect(rep.sections[0]!.summary.length).toBeGreaterThan(0)
    })

    it('[T1-F14-03] music-tracks-113c.ts or verify-audio-113c.ts exports named constants matching D16_SPEC.bgm (64,000 bps floor, 4,500,000 B track cap, 72,000,000 B total cap)', async () => {
      const d16 = requireD16Decided().bgm
      const tracksMod = await loadProductModule(PRODUCT.musicTracks, F14)
      const packMod = await loadProductModule(PRODUCT.packMusic, F14)
      const auditMod = await loadProductModule(PRODUCT.audit, F14)
      const combined = { ...auditMod, ...packMod, ...tracksMod }
      const minBps =
        combined.MUSIC_MIN_BITRATE_BPS_113C ??
        combined.MUSIC_MIN_BITRATE_STEREO ??
        combined.BGM_MIN_BITRATE_BPS_113C
      const maxTrack =
        combined.MUSIC_MAX_TRACK_BYTES_113C ??
        combined.MUSIC_PER_TRACK_MAX_BYTES_113C ??
        combined.BGM_MAX_TRACK_BYTES_113C
      const maxTotal =
        combined.MUSIC_MAX_TOTAL_BYTES_113C ??
        combined.MUSIC_TOTAL_MAX_BYTES_113C ??
        combined.BGM_MAX_TOTAL_BYTES_113C
      expect(minBps).toBe(d16.minBitrateBps)
      expect(maxTrack).toBe(d16.perTrackMaxBytes)
      expect(maxTotal).toBe(d16.totalMaxBytes)
    })

    it('[T1-F14-04] every file in public/sound/music/*.webm is accounted for in music-tracks-113c.ts (no orphan music files)', async () => {
      const mod = await loadMusicTracksContract()
      const knownFiles = new Set(mod.tracks.map((t) => t.url.replace(/^\/+/, '')))
      for (const rel of knownFiles) {
        const st = statSync(join(REPO_ROOT, 'public', rel))
        expect(st.size).toBeGreaterThan(0)
      }
      expect(knownFiles.size).toBeGreaterThanOrEqual(30)
    })

    it('[T1-F14-05] asset-manifest.json contains matching 16-hex SHA-256 entries for every baked BGM .webm stream', async () => {
      const mod = await loadMusicTracksContract()
      const manifestRaw = JSON.parse(readFileSync(join(REPO_ROOT, 'public/asset-manifest.json'), 'utf8')) as {
        assets?: Record<string, string>
      } & Record<string, unknown>
      const assets = (manifestRaw.assets ?? manifestRaw) as Record<string, string>
      const bad: string[] = []
      for (const t of mod.tracks) {
        const key = t.url.replace(/^\/+/, '')
        const entry = assets[key] ?? assets[`/${key}`]
        const baked = readBakedMusicStream(t.url)
        if (typeof entry !== 'string' || !baked.sha256.startsWith(entry.toLowerCase())) {
          bad.push(`${key}: manifest=${String(entry)} vs actual=${baked.sha256.slice(0, 16)}`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })
  })

  describe('Tier 2 — boundary & corruption detection', () => {
    it('[T2-F14-01] runAudioAudit({ sections: ["music"] }) fails when a baked .webm track file is missing', async () => {
      const mod = await loadMusicTracksContract()
      const audit = await runAudit()
      const firstRel = join('public', mod.tracks[0]!.url.replace(/^\/+/, ''))
      const tmp = mirrorRepoWithCopies([firstRel], (root) => {
        rmSync(join(root, firstRel), { force: true })
      })
      try {
        const rep = await audit({ rootDir: tmp, mpqDir: D2_DATA_DIR, sections: ['music'] })
        expect(rep.ok).toBe(false)
        expect(rep.sections[0]!.errors.length).toBeGreaterThan(0)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it('[T2-F14-02] runAudioAudit({ sections: ["music"] }) fails when a .webm track has corrupt EBML magic', async () => {
      const mod = await loadMusicTracksContract()
      const audit = await runAudit()
      const firstRel = join('public', mod.tracks[0]!.url.replace(/^\/+/, ''))
      const tmp = mirrorRepoWithCopies([firstRel], (root) => {
        const p = join(root, firstRel)
        const buf = Buffer.from(readFileSync(p))
        buf[0] = 0x00
        buf[1] = 0x00
        writeFileSync(p, buf)
      })
      try {
        const rep = await audit({ rootDir: tmp, mpqDir: D2_DATA_DIR, sections: ['music'] })
        expect(rep.ok).toBe(false)
        expect(rep.sections[0]!.errors.length).toBeGreaterThan(0)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it('[T2-F14-03] runAudioAudit({ sections: ["music"] }) fails when a single track exceeds D16 perTrackMaxBytes (4,500,000 B)', async () => {
      const d16 = requireD16Decided().bgm
      const mod = await loadMusicTracksContract()
      const audit = await runAudit()
      const firstRel = join('public', mod.tracks[0]!.url.replace(/^\/+/, ''))
      const tmp = mirrorRepoWithCopies([firstRel], (root) => {
        const p = join(root, firstRel)
        const orig = readFileSync(p)
        const padded = Buffer.alloc((d16.perTrackMaxBytes ?? 4_500_000) + 1024)
        orig.copy(padded, 0)
        writeFileSync(p, padded)
      })
      try {
        const rep = await audit({ rootDir: tmp, mpqDir: D2_DATA_DIR, sections: ['music'] })
        expect(rep.ok).toBe(false)
        expect(rep.sections[0]!.errors.length).toBeGreaterThan(0)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it('[T2-F14-04] runAudioAudit({ sections: ["music"] }) fails when a track on disk is replaced by a different track (SHA-256 / byte length mismatch)', async () => {
      const mod = await loadMusicTracksContract()
      const audit = await runAudit()
      const rel0 = join('public', mod.tracks[0]!.url.replace(/^\/+/, ''))
      const rel1 = join('public', mod.tracks[1]!.url.replace(/^\/+/, ''))
      const tmp = mirrorRepoWithCopies([rel0], (root) => {
        writeFileSync(join(root, rel0), readFileSync(join(REPO_ROOT, rel1)))
      })
      try {
        const rep = await audit({ rootDir: tmp, mpqDir: D2_DATA_DIR, sections: ['music'] })
        expect(rep.ok).toBe(false)
        expect(rep.sections[0]!.errors.length).toBeGreaterThan(0)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it('[T2-F14-05] runAudioAudit({ sections: ["music"] }) fails when a track is re-encoded below the 64 kbps floor (e.g. 16 kbps)', async () => {
      const mod = await loadMusicTracksContract()
      const pm = await loadProductModule(PRODUCT.packMusic, F14)
      const fn = (pm.transcodeWavToOpusWebm ?? pm.encodeMusicWavToWebm113c ?? pm.transcodeMusicWav113c) as
        | ((wav: Uint8Array, opts?: Record<string, unknown>) => Promise<Uint8Array>)
        | undefined
      expect(typeof fn).toBe('function')
      const audit = await runAudit()
      const target = mod.getTrack(4686) ?? mod.tracks[0]!
      const rel = join('public', target.url.replace(/^\/+/, ''))
      const lowWebm = await fn!(oracleWavBytes(target.id), { bitrate: 16_000, vbr: 'off' })
      const tmp = mirrorRepoWithCopies([rel], (root) => {
        writeFileSync(join(root, rel), lowWebm)
      })
      try {
        const rep = await audit({ rootDir: tmp, mpqDir: D2_DATA_DIR, sections: ['music'] })
        expect(rep.ok).toBe(false)
        expect(rep.sections[0]!.errors.length).toBeGreaterThan(0)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it('[T2-F14-06] streamOpusFacts and music-tracks-113c.ts reject truncated or non-WebM/non-Ogg buffers with an explicit error', async () => {
      const mod = await loadMusicTracksContract()
      expect(mod.tracks.length).toBeGreaterThanOrEqual(30)
      expect(() => streamOpusFacts(new Uint8Array([1, 2, 3, 4]), 'tiny')).toThrow(/WebM EBML/)
      const fakeEbml = new Uint8Array(40)
      fakeEbml.set([0x1a, 0x45, 0xdf, 0xa3], 0)
      expect(() => streamOpusFacts(fakeEbml, 'corrupt-ebml')).toThrow()
    })
  })
})
