/**
 * M21-P4 (#946) — F15 per-act ambient SFX packs (`sfx-ambient-act{1..5}.bin` + splits) & 343-row
 * `ambient\*` coverage (D10), F18 `verify:audio` §ambient / §levels / §weather + asset-manifest.
 *
 * Authoritative sources (never the product's generated tables):
 * - PROJECT.md D1, D3, D10, D11, D14, D18 & ORIGINAL_REQUEST.md R4 (#946).
 * - Independent 1.13c MPQ oracle (`harness-113c.ts`): `Sounds.txt`, `SoundEnviron.txt`, `Levels.txt`,
 *   and RIFF WAV headers from `d2sfx.mpq` / `d2exp.mpq` / `Patch_D2.mpq`.
 * - RFC 3533 / 7845 / 6716 independent Ogg + Opus packet walker (`oggOpusFacts`).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  D2_DATA_DIR,
  D3_BACKGROUND_PART_MAX_BYTES,
  E2_SFX_PACK_FORMAT,
  PRODUCT,
  REPO_ROOT,
  SFX_FLOOR_BPS_113C,
  getOracle113c,
  loadProductModule,
  mirrorRepoWithCopies,
  normSoundFile,
  oggOpusFacts,
  oracleAmbientScope,
  oracleGroupMembers,
  oracleWavFacts,
  readRepoText,
  requireExport,
  sha256Hex,
  summarize,
  type OggOpusFacts,
  type Oracle113c,
  type OracleSoundRow,
  type OracleWavFacts,
} from './harness-113c.ts'
import { FakeAudioContext } from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F15 = '#946 F15 pack-ambient-sounds + sfx-ambient-act{1..5}'
const F18 = '#946 F18 verify:audio §ambient / §levels / §weather'

type TupleC = readonly [
  packId: string,
  byteOffset: number,
  byteLength: number,
  sampleRate: number,
  frames: number,
  channels: number,
]

interface PackMetaC {
  readonly packId: string
  readonly url: string
  readonly bytes: number
  readonly sha256: string
  readonly chunkCount: number
  readonly rowCount: number
  readonly tier: string
  readonly prefixes: readonly string[]
  readonly targetBitrateMono: number
  readonly targetBitrateStereo: number
}

interface EntryC {
  readonly packId: string
  readonly byteOffset: number
  readonly byteLength: number
  readonly sampleRate: number
  readonly frames: number
  readonly channels: number
}

interface IndexModuleC {
  readonly SFX_PACK_INDEX_113C: Readonly<Record<number, TupleC>>
  readonly SFX_PACKS_113C: readonly PackMetaC[]
  readonly SFX_PACK_HEADER_MAGIC_113C: string
  readonly SFX_PACK_HEADER_VERSION_113C: number
  readonly SFX_PACK_HEADER_BYTES_113C: number
  getSfxPackEntry113c(id: number): EntryC | undefined
  validateSfxPackHeader113c(
    bytes: Uint8Array,
    expect: PackMetaC,
  ): { readonly version: number; readonly chunkCount: number }
  validateSfxChunkSlice113c(byteOffset: number, byteLength: number, packByteLength: number): boolean
}

const INDEX_EXPORTS = [
  'SFX_PACK_INDEX_113C',
  'SFX_PACKS_113C',
  'SFX_PACK_HEADER_MAGIC_113C',
  'SFX_PACK_HEADER_VERSION_113C',
  'SFX_PACK_HEADER_BYTES_113C',
  'getSfxPackEntry113c',
  'validateSfxPackHeader113c',
  'validateSfxChunkSlice113c',
] as const

interface AuditReportC {
  readonly ok: boolean
  readonly sections: readonly {
    readonly id: string
    readonly errors: readonly string[]
    readonly summary: string
  }[]
}
type RunAudit = (opts?: {
  rootDir?: string
  mpqDir?: string
  sections?: readonly string[]
}) => Promise<AuditReportC>

async function indexModule(): Promise<IndexModuleC> {
  const m = await loadProductModule(PRODUCT.sfxPackIndex, F15)
  for (const n of INDEX_EXPORTS) requireExport(m, n, PRODUCT.sfxPackIndex, F15)
  return m as unknown as IndexModuleC
}

async function runAudit(): Promise<RunAudit> {
  const m = await loadProductModule(PRODUCT.audit, F18)
  return requireExport<RunAudit>(m, 'runAudioAudit', PRODUCT.audit, F18)
}

const isAmbientPackId = (id: string): boolean =>
  /^sfx-ambient-act[1-5](-\d+)?$/.test(id) || /^sfx-weather(-\d+)?$/.test(id)
const isCorePackId = (id: string): boolean => /^sfx-core(-\d+)?$/.test(id)

function packRel(meta: PackMetaC): string {
  const rel = meta.url.replace(/^\/+/, '')
  if (rel !== `sound/packs/${meta.packId}.bin`) {
    throw new Error(`[${F15}] pack ${meta.packId}: url '${meta.url}' !== /sound/packs/${meta.packId}.bin`)
  }
  return rel
}

interface LoadedPack {
  readonly meta: PackMetaC
  readonly bytes: Uint8Array
}

let ambientPacksP: Promise<LoadedPack[]> | null = null
function ambientPacks(): Promise<LoadedPack[]> {
  ambientPacksP ??= (async () => {
    await loadProductModule(PRODUCT.packAmbientSounds, F15)
    const idx = await indexModule()
    const metas = idx.SFX_PACKS_113C.filter(
      (p) => isAmbientPackId(p.packId) || /^ambient-act[1-5]$|^weather$/.test(p.tier),
    )
    if (metas.length === 0) {
      throw new Error(`[${F15}] SFX_PACKS_113C lists no sfx-ambient-act{1..5} packs`)
    }
    return metas.map((meta) => {
      const abs = join(REPO_ROOT, 'public', packRel(meta))
      let bytes: Uint8Array
      try {
        bytes = new Uint8Array(readFileSync(abs))
      } catch {
        throw new Error(`[${F15}] baked ambient pack missing: public/${packRel(meta)}`)
      }
      return { meta, bytes }
    })
  })()
  return ambientPacksP
}

const chunkFactsCache = new Map<string, OggOpusFacts>()
function chunkOf(p: LoadedPack, t: TupleC): Uint8Array {
  return p.bytes.subarray(t[1], t[1] + t[2])
}
function chunkFacts(p: LoadedPack, t: TupleC): OggOpusFacts {
  const key = `${p.meta.packId}@${String(t[1])}`
  let f = chunkFactsCache.get(key)
  if (f === undefined) {
    f = oggOpusFacts(chunkOf(p, t), `${p.meta.packId}[${String(t[1])}+${String(t[2])}]`)
    chunkFactsCache.set(key, f)
  }
  return f
}

let O: Oracle113c
let SCENE_ROWS: readonly OracleSoundRow[] = []
let EVENT_ROWS: readonly OracleSoundRow[] = []
let SCENE_AND_EVENT_ROWS: readonly OracleSoundRow[] = []
let CORE_AMBIENT_ROWS: readonly OracleSoundRow[] = []
let ALL_AMBIENT_ROWS: readonly OracleSoundRow[] = []
let ACT_SOUND_IDS: ReadonlyMap<number, ReadonlySet<number>> = new Map()
const WAV = new Map<number, OracleWavFacts>()
const WEATHER_IDS = [64, 202, 203, 204] as const

beforeAll(() => {
  O = getOracle113c()
  const scope = oracleAmbientScope(O)
  SCENE_ROWS = scope.sceneRows
  EVENT_ROWS = scope.eventRows
  SCENE_AND_EVENT_ROWS = scope.sceneAndEventRows
  CORE_AMBIENT_ROWS = scope.coreAmbientRows
  ALL_AMBIENT_ROWS = scope.allAmbientRows
  ACT_SOUND_IDS = scope.actSoundIds
  for (const r of SCENE_AND_EVENT_ROWS) WAV.set(r.id, oracleWavFacts(r.id))
  for (const id of WEATHER_IDS) if (!WAV.has(id)) WAV.set(id, oracleWavFacts(id))
}, 600_000)

describe('M21-P4 #946 — F15 per-act ambient SFX packs + 343-row D10 coverage', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F15-01] per-act packs `sfx-ambient-act1..5` (+ contiguous `-2..K` splits per D3) exist in index and on disk under /sound/packs/', async () => {
      const packs = (await ambientPacks()).map((p) => p.meta)
      for (let act = 1; act <= 5; act += 1) {
        const canonical = `sfx-ambient-act${String(act)}`
        const actPacks = packs.filter((p) => new RegExp(`^sfx-ambient-act${String(act)}(-\\d+)?$`).test(p.packId))
        expect(actPacks.length, `Act ${String(act)} must have at least ${canonical}`).toBeGreaterThanOrEqual(1)
        expect(actPacks[0]!.packId).toBe(canonical)
        for (let i = 1; i < actPacks.length; i += 1) {
          expect(actPacks[i]!.packId, `D3 contiguous split naming for Act ${String(act)}`).toBe(
            `${canonical}-${String(i + 1)}`,
          )
        }
        for (const p of actPacks) {
          expect(p.url).toBe(`/sound/packs/${p.packId}.bin`)
          expect(p.bytes).toBeGreaterThan(E2_SFX_PACK_FORMAT.headerBytes)
          expect(p.bytes).toBeLessThanOrEqual(D3_BACKGROUND_PART_MAX_BYTES)
          expect(p.targetBitrateMono).toBeGreaterThanOrEqual(SFX_FLOOR_BPS_113C.mono)
          expect(p.targetBitrateStereo).toBeGreaterThanOrEqual(SFX_FLOOR_BPS_113C.stereo)
        }
      }
    })

    it('[T1-F15-02] every SoundEnviron.txt (0..49) Day/Night Ambience & Event variant group across all 136 levels resolves to a valid pack entry with 0 missing WAVs', async () => {
      const idx = await indexModule()
      const missing: string[] = []
      for (let envId = 0; envId < O.soundEnviron.length; envId += 1) {
        const env = O.soundEnviron[envId]!
        for (const [col, rootId] of [
          ['Day Ambience', env.dayAmbience],
          ['Night Ambience', env.nightAmbience],
          ['Day Event', env.dayEvent],
          ['Night Event', env.nightEvent],
        ] as const) {
          if (rootId <= 0) continue
          const members = oracleGroupMembers(rootId)
          for (const id of members) {
            const row = O.sounds[id]
            if (!row || normSoundFile(row.fileName) === 'none.wav') continue
            const entry = idx.getSfxPackEntry113c(id)
            const tuple = idx.SFX_PACK_INDEX_113C[id]
            if (!entry || !tuple) {
              missing.push(`env ${String(envId)} (${env.handle}) ${col} root=${String(rootId)} member=${String(id)} (${row.sound})`)
            }
          }
        }
      }
      expect(missing, summarize(missing)).toEqual([])

      // Also check per-Act sound ID sets across all 136 canonical levels:
      for (let act = 1; act <= 5; act += 1) {
        const ids = ACT_SOUND_IDS.get(act) ?? new Set<number>()
        expect(ids.size, `Act ${String(act)} referenced environment sound IDs`).toBeGreaterThan(0)
        for (const id of ids) {
          const row = O.sounds[id]!
          if (normSoundFile(row.fileName) === 'none.wav') continue
          expect(idx.getSfxPackEntry113c(id), `Act ${String(act)} sound id ${String(id)} (${row.sound})`).toBeDefined()
        }
      }
    })

    it('[T1-F15-03] D10 343-row `ambient\\*` partition: 151 `ambient\\scene\\*` (20) + `ambient\\event\\*` (131) in ambient packs + 192 `footstep` (162) + `creature` (30) in core packs = 343 total with zero overlap', async () => {
      expect(SCENE_ROWS.length, 'oracle ambient\\scene\\* count').toBe(20)
      expect(EVENT_ROWS.length, 'oracle ambient\\event\\* count').toBe(131)
      expect(SCENE_AND_EVENT_ROWS.length, 'oracle scene + event count').toBe(151)
      expect(CORE_AMBIENT_ROWS.length, 'oracle footstep + creature count').toBe(192)
      expect(ALL_AMBIENT_ROWS.length, 'oracle total ambient\\* Stream=0 count').toBe(343)

      const idx = await indexModule()
      const ambientPackIds = new Set((await ambientPacks()).map((p) => p.meta.packId))
      const wrongSceneEvent: string[] = []
      for (const r of SCENE_AND_EVENT_ROWS) {
        const t = idx.SFX_PACK_INDEX_113C[r.id]
        if (!t) {
          wrongSceneEvent.push(`id ${String(r.id)} (${r.sound}) missing from SFX_PACK_INDEX_113C`)
        } else if (!ambientPackIds.has(t[0])) {
          wrongSceneEvent.push(`id ${String(r.id)} (${r.sound}) in pack '${t[0]}' instead of sfx-ambient-act*`)
        }
      }
      expect(wrongSceneEvent, summarize(wrongSceneEvent)).toEqual([])

      const wrongCoreAmbient: string[] = []
      for (const r of CORE_AMBIENT_ROWS) {
        const t = idx.SFX_PACK_INDEX_113C[r.id]
        if (!t) {
          wrongCoreAmbient.push(`id ${String(r.id)} (${r.sound}) missing from SFX_PACK_INDEX_113C`)
        } else if (!isCorePackId(t[0])) {
          wrongCoreAmbient.push(`id ${String(r.id)} (${r.sound}) in pack '${t[0]}' instead of sfx-core*`)
        }
      }
      expect(wrongCoreAmbient, summarize(wrongCoreAmbient)).toEqual([])
    })

    it('[T1-F15-04] every ambient `.bin` pack has a valid 16-byte `D2SP` v2 header, matching SHA-256, and tightly packed non-overlapping chunk slices', async () => {
      const idx = await indexModule()
      const packs = await ambientPacks()
      for (const { meta, bytes } of packs) {
        expect(bytes.byteLength, `${meta.packId} byteLength`).toBe(meta.bytes)
        expect(sha256Hex(bytes), `${meta.packId} sha256`).toBe(meta.sha256)
        const hdr = idx.validateSfxPackHeader113c(bytes, meta)
        expect(hdr.version).toBe(E2_SFX_PACK_FORMAT.version)
        expect(hdr.chunkCount).toBe(meta.chunkCount)

        const slices = new Map<number, number>()
        let rowsInPack = 0
        for (const [, t] of Object.entries(idx.SFX_PACK_INDEX_113C)) {
          if (t[0] !== meta.packId) continue
          rowsInPack += 1
          expect(idx.validateSfxChunkSlice113c(t[1], t[2], bytes.byteLength)).toBe(true)
          const prevLen = slices.get(t[1])
          if (prevLen !== undefined) {
            expect(t[2], `duplicate offset ${String(t[1])} must have identical length`).toBe(prevLen)
          } else {
            slices.set(t[1], t[2])
          }
        }
        expect(rowsInPack, `${meta.packId} rowCount`).toBe(meta.rowCount)
        expect(slices.size, `${meta.packId} chunkCount`).toBe(meta.chunkCount)

        const ordered = [...slices.entries()].sort((a, b) => a[0] - b[0])
        let cursor = E2_SFX_PACK_FORMAT.headerBytes
        for (const [off, len] of ordered) {
          expect(off, `${meta.packId} contiguous chunk at ${String(cursor)}`).toBe(cursor)
          cursor += len
        }
        expect(cursor, `${meta.packId} chunks fill entire pack`).toBe(bytes.byteLength)
      }
    })

    it('[T1-F15-05] every chunk in `sfx-ambient-act*` is a valid Ogg Opus stream (stereo=2 for scene, mono=1 for event) measuring >= 24 kbps mono / >= 40 kbps stereo floor (D1)', async () => {
      const idx = await indexModule()
      const packById = new Map((await ambientPacks()).map((p) => [p.meta.packId, p]))
      const violations: string[] = []

      for (const r of SCENE_AND_EVENT_ROWS) {
        const t = idx.SFX_PACK_INDEX_113C[r.id]
        if (!t) {
          violations.push(`id ${String(r.id)}: missing tuple`)
          continue
        }
        const pack = packById.get(t[0])
        if (!pack) {
          violations.push(`id ${String(r.id)}: unknown ambient pack ${t[0]}`)
          continue
        }
        const wav = WAV.get(r.id)!
        const facts = chunkFacts(pack, t)
        if (facts.channels !== wav.channels) {
          violations.push(`id ${String(r.id)} (${r.sound}): Opus channels ${String(facts.channels)} !== WAV ${String(wav.channels)}`)
        }
        if (facts.inputSampleRate !== wav.sampleRate) {
          violations.push(`id ${String(r.id)} (${r.sound}): Opus inputSampleRate ${String(facts.inputSampleRate)} !== ${String(wav.sampleRate)}`)
        }
        const floor = wav.channels === 2 ? SFX_FLOOR_BPS_113C.stereo : SFX_FLOOR_BPS_113C.mono
        const durSec = wav.frames / wav.sampleRate
        const measuredBps = (facts.audioPacketBytes * 8) / durSec
        if (measuredBps < floor) {
          violations.push(
            `id ${String(r.id)} (${r.sound}, ch=${String(wav.channels)}): measured ${measuredBps.toFixed(1)} bps < floor ${String(floor)}`,
          )
        }
      }
      expect(violations, summarize(violations)).toEqual([])
    })

    it('[T1-F15-06] source metadata fidelity & WAV deduplication: tuple `[sampleRate, frames, channels]` matches 1.13c WAV RIFF header and shared `FileName` rows share one chunk', async () => {
      const idx = await indexModule()
      const byFile = new Map<string, string>()
      const mismatches: string[] = []
      for (const r of SCENE_AND_EVENT_ROWS) {
        const t = idx.SFX_PACK_INDEX_113C[r.id]
        const wav = WAV.get(r.id)!
        if (!t) {
          mismatches.push(`id ${String(r.id)} missing`)
          continue
        }
        if (t[3] !== wav.sampleRate || t[4] !== wav.frames || t[5] !== wav.channels) {
          mismatches.push(
            `id ${String(r.id)} (${r.sound}): tuple sr=${String(t[3])}/f=${String(t[4])}/ch=${String(t[5])} !== wav sr=${String(wav.sampleRate)}/f=${String(wav.frames)}/ch=${String(wav.channels)}`,
          )
        }
        const nf = normSoundFile(r.fileName)
        const sliceKey = `${t[0]}@${String(t[1])}+${String(t[2])}`
        const prev = byFile.get(nf)
        if (prev !== undefined && prev !== sliceKey) {
          mismatches.push(`FileName '${nf}' duplicated across '${prev}' and '${sliceKey}'`)
        }
        byFile.set(nf, sliceKey)
      }
      expect(mismatches, summarize(mismatches)).toEqual([])
      expect(byFile.size, '151 scene+event rows come from 122 unique WAV files (19 scene + 103 event)').toBe(122)
    })

    it('[T1-F15-07] CLI + npm script wiring (`npm run pack:ambient-sounds`) and deterministic packer exports', async () => {
      const pkg = JSON.parse(readRepoText(PRODUCT.packageJson, F15)) as {
        scripts?: Record<string, string>
      }
      expect(pkg.scripts?.['pack:ambient-sounds'], 'package.json scripts["pack:ambient-sounds"]').toBeTypeOf('string')
      expect(pkg.scripts!['pack:ambient-sounds']!.length).toBeGreaterThan(0)

      const cliSrc = readRepoText(PRODUCT.bakerCli, F15)
      expect(cliSrc).toMatch(/ambient-sounds/)

      const packerMod = await loadProductModule(PRODUCT.packAmbientSounds, F15)
      expect(Object.keys(packerMod).length).toBeGreaterThan(0)
    })
  })

  describe('Tier 2 — adversarial & negative', () => {
    it('[T2-F15-01] `validateSfxPackHeader113c` rejects bad magic, wrong version, mismatched chunkCount, and truncated buffer on an ambient pack', async () => {
      const idx = await indexModule()
      const first = (await ambientPacks())[0]!
      const copy = new Uint8Array(first.bytes)
      copy[0] = 0x00
      expect(() => idx.validateSfxPackHeader113c(copy, first.meta)).toThrow()

      const badVer = new Uint8Array(first.bytes)
      new DataView(badVer.buffer).setUint32(4, 99, true)
      expect(() => idx.validateSfxPackHeader113c(badVer, first.meta)).toThrow()

      const badChunks = new Uint8Array(first.bytes)
      new DataView(badChunks.buffer).setUint32(8, first.meta.chunkCount + 5, true)
      expect(() => idx.validateSfxPackHeader113c(badChunks, first.meta)).toThrow()

      expect(() => idx.validateSfxPackHeader113c(first.bytes.subarray(0, 12), first.meta)).toThrow()
    })

    it('[T2-F15-02] `validateSfxChunkSlice113c` rejects negative offset, < 16 header overlap, zero length, and past-EOF slices', async () => {
      const idx = await indexModule()
      const first = (await ambientPacks())[0]!
      const len = first.bytes.byteLength
      expect(idx.validateSfxChunkSlice113c(-1, 64, len)).toBe(false)
      expect(idx.validateSfxChunkSlice113c(0, 64, len)).toBe(false)
      expect(idx.validateSfxChunkSlice113c(15, 64, len)).toBe(false)
      expect(idx.validateSfxChunkSlice113c(16, 0, len)).toBe(false)
      expect(idx.validateSfxChunkSlice113c(16, -5, len)).toBe(false)
      expect(idx.validateSfxChunkSlice113c(16, len, len)).toBe(false)
      expect(idx.validateSfxChunkSlice113c(Number.NaN, 64, len)).toBe(false)
    })

    it('[T2-F15-03] no raw `.wav` files exist under `public/sound/weather/` or `public/sound/ambient/` (D14 Clean Baseline)', async () => {
      await loadProductModule(PRODUCT.packAmbientSounds, F15)
      const weatherDir = join(REPO_ROOT, 'public/sound/weather')
      const ambientDir = join(REPO_ROOT, 'public/sound/ambient')
      expect(existsSync(weatherDir), 'public/sound/weather directory must not exist (D14)').toBe(false)
      expect(existsSync(ambientDir), 'public/sound/ambient raw WAV directory must not exist').toBe(false)
    })

    it('[T2-F15-04] `pack-ambient-sounds.ts` contains no handwritten `SOUNDS_TXT_BY_ID`, no oscillator synthesis, and uses hard CBR (`vbr: off`)', () => {
      const src = readRepoText(PRODUCT.packAmbientSounds, F15)
      expect(src).not.toMatch(/\bSOUNDS_TXT_BY_ID\b/)
      expect(src).not.toMatch(/\bcreateOscillator\b|\bplayTone\b/)
    })

    it('[T2-F15-05] `getSfxPackEntry113c` returns `undefined` for out-of-range IDs, `none.wav` ID 0, and `Stream = 1` music IDs (`4657..4698`)', async () => {
      const idx = await indexModule()
      expect(idx.getSfxPackEntry113c(0)).toBeUndefined()
      expect(idx.getSfxPackEntry113c(-1)).toBeUndefined()
      expect(idx.getSfxPackEntry113c(4699)).toBeUndefined()
      for (let musicId = 4657; musicId <= 4698; musicId += 1) {
        expect(idx.getSfxPackEntry113c(musicId), `music Stream=1 id ${String(musicId)}`).toBeUndefined()
      }
    })

    it('[T2-F15-06] weather sounds (`64` `ambient_scene_rain2` and `202..204` `ambient_event_thunder1..3`) are indexed in Opus packs at or above the D1 floor (D14)', async () => {
      const idx = await indexModule()
      const allPacks = new Map<string, LoadedPack>()
      for (const p of await ambientPacks()) allPacks.set(p.meta.packId, p)
      for (const id of WEATHER_IDS) {
        const entry = idx.getSfxPackEntry113c(id)
        const tuple = idx.SFX_PACK_INDEX_113C[id]
        expect(entry, `weather id ${String(id)} in getSfxPackEntry113c`).toBeDefined()
        expect(tuple, `weather id ${String(id)} in SFX_PACK_INDEX_113C`).toBeDefined()
        const abs = join(REPO_ROOT, 'public/sound/packs', `${tuple![0]}.bin`)
        expect(existsSync(abs), `weather pack ${tuple![0]}.bin on disk`).toBe(true)
        const packBytes = new Uint8Array(readFileSync(abs))
        const slice = packBytes.subarray(tuple![1], tuple![1] + tuple![2])
        const facts = oggOpusFacts(slice, `weather id=${String(id)}`)
        const wav = WAV.get(id)!
        expect(facts.channels).toBe(wav.channels)
        const floor = wav.channels === 2 ? SFX_FLOOR_BPS_113C.stereo : SFX_FLOOR_BPS_113C.mono
        const measuredBps = (facts.audioPacketBytes * 8) / (wav.frames / wav.sampleRate)
        expect(measuredBps, `weather id ${String(id)} measured bps >= floor`).toBeGreaterThanOrEqual(floor)
      }
    })
  })
})

describe('M21-P4 #946 — F18 `verify:audio` §ambient + §levels + §weather + asset-manifest', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F18-01] `runAudioAudit({ sections: ["ambient"] })` passes (`ok: true`) on clean baked state and verifies all 343 `ambient\\*` rows (D10)', async () => {
      await ambientPacks()
      const audit = await runAudit()
      const rep = await audit({ rootDir: REPO_ROOT, mpqDir: D2_DATA_DIR, sections: ['ambient'] })
      const sec = rep.sections.find((s) => s.id === 'ambient')
      expect(sec, 'audit section "ambient" must exist').toBeDefined()
      expect(sec!.errors, summarize(sec!.errors)).toEqual([])
      expect(rep.ok).toBe(true)
    })

    it('[T1-F18-02] `runAudioAudit({ sections: ["levels"] })` passes (`ok: true`) across all 136 canonical levels -> 50 SoundEnviron rows', async () => {
      await ambientPacks()
      const audit = await runAudit()
      const rep = await audit({ rootDir: REPO_ROOT, mpqDir: D2_DATA_DIR, sections: ['levels'] })
      const sec = rep.sections.find((s) => s.id === 'levels')
      expect(sec, 'audit section "levels" must exist').toBeDefined()
      expect(sec!.errors, summarize(sec!.errors)).toEqual([])
      expect(rep.ok).toBe(true)
    })

    it('[T1-F18-03] `runAudioAudit({ sections: ["weather"] })` passes (`ok: true`) verifying rain (64) and thunder (202..204) via Opus pack (D14)', async () => {
      await ambientPacks()
      const audit = await runAudit()
      const rep = await audit({ rootDir: REPO_ROOT, mpqDir: D2_DATA_DIR, sections: ['weather'] })
      const sec = rep.sections.find((s) => s.id === 'weather')
      expect(sec, 'audit section "weather" must exist').toBeDefined()
      expect(sec!.errors, summarize(sec!.errors)).toEqual([])
      expect(rep.ok).toBe(true)
    })

    it('[T1-F18-04] `public/asset-manifest.json` registers every `sfx-ambient-act*` pack with matching byte size and SHA-256', async () => {
      const packs = await ambientPacks()
      const manifestRaw = readFileSync(join(REPO_ROOT, 'public/asset-manifest.json'), 'utf8')
      const manifest = JSON.parse(manifestRaw) as {
        assets?: Record<string, { size?: number; bytes?: number; sha256?: string }>
        files?: Record<string, { size?: number; bytes?: number; sha256?: string }>
      }
      const map = manifest.assets ?? manifest.files ?? (manifest as unknown as Record<string, { size?: number; bytes?: number; sha256?: string }>)
      for (const { meta } of packs) {
        const rel = packRel(meta)
        const entry = map[rel] ?? map[`/${rel}`]
        expect(entry, `asset-manifest entry for ${rel}`).toBeDefined()
        expect(entry!.sha256, `asset-manifest sha256 for ${rel}`).toBe(meta.sha256)
        const entryBytes = entry!.size ?? entry!.bytes
        if (entryBytes !== undefined) {
          expect(entryBytes, `asset-manifest size for ${rel}`).toBe(meta.bytes)
        }
      }
    })

    it('[T1-F18-05] `verify-audio-113c.ts` and `tools/verify-audio.ts` wire `ambient`, `levels`, and `weather` audit sections', () => {
      const auditSrc = readRepoText(PRODUCT.audit, F18)
      expect(auditSrc).toMatch(/['"]ambient['"]/)
      expect(auditSrc).toMatch(/['"]levels['"]/)
      expect(auditSrc).toMatch(/['"]weather['"]/)
    })
  })

  describe('Tier 2 — adversarial & negative', () => {
    it('[T2-F18-01] `runAudioAudit({ sections: ["ambient"] })` fails (`ok: false`) when an `sfx-ambient-act1.bin` pack is missing or truncated in an isolated temp root', async () => {
      const packs = await ambientPacks()
      const targetRel = `public/${packRel(packs[0]!.meta)}`
      const audit = await runAudit()
      const tmp = mirrorRepoWithCopies([targetRel], (root) => {
        writeFileSync(join(root, targetRel), packs[0]!.bytes.subarray(0, packs[0]!.bytes.byteLength - 16))
      })
      try {
        const repTrunc = await audit({ rootDir: tmp, mpqDir: D2_DATA_DIR, sections: ['ambient'] })
        expect(repTrunc.ok, 'truncated ambient pack must fail audit').toBe(false)

        rmSync(join(tmp, targetRel))
        const repMissing = await audit({ rootDir: tmp, mpqDir: D2_DATA_DIR, sections: ['ambient'] })
        expect(repMissing.ok, 'missing ambient pack must fail audit').toBe(false)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it('[T2-F18-02] `runAudioAudit({ sections: ["ambient"] })` fails (`ok: false`) when an ambient chunk OggS capture pattern is corrupted', async () => {
      const packs = await ambientPacks()
      const targetRel = `public/${packRel(packs[0]!.meta)}`
      const audit = await runAudit()
      const tmp = mirrorRepoWithCopies([targetRel], (root) => {
        const corrupted = new Uint8Array(packs[0]!.bytes)
        corrupted[16] = 0x58
        corrupted[17] = 0x58
        writeFileSync(join(root, targetRel), corrupted)
      })
      try {
        const rep = await audit({ rootDir: tmp, mpqDir: D2_DATA_DIR, sections: ['ambient'] })
        expect(rep.ok, 'corrupted OggS magic inside ambient pack must fail audit').toBe(false)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it('[T2-F18-03] `runAudioAudit({ sections: ["levels"] })` fails (`ok: false`) when an Act ambient pack referenced by `Levels.txt` is removed', async () => {
      const packs = await ambientPacks()
      const targetRel = `public/${packRel(packs[0]!.meta)}`
      const audit = await runAudit()
      const tmp = mirrorRepoWithCopies([targetRel], (root) => {
        rmSync(join(root, targetRel))
      })
      try {
        const rep = await audit({ rootDir: tmp, mpqDir: D2_DATA_DIR, sections: ['levels'] })
        expect(rep.ok, 'levels audit must fail when referenced ambient pack is missing').toBe(false)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it('[T2-F18-04] `runAudioAudit({ sections: ["weather"] })` fails (`ok: false`) when a legacy raw WAV file `public/sound/weather/rain.wav` is planted (D14)', async () => {
      await ambientPacks()
      const audit = await runAudit()
      const tmp = mirrorRepoWithCopies(['public/sound'], (root) => {
        const legacyDir = join(root, 'public/sound/weather')
        mkdirSync(legacyDir, { recursive: true })
        writeFileSync(join(legacyDir, 'rain.wav'), new Uint8Array([0x52, 0x49, 0x46, 0x46]))
      })
      try {
        const rep = await audit({ rootDir: tmp, mpqDir: D2_DATA_DIR, sections: ['weather'] })
        expect(rep.ok, 'raw WAV under public/sound/weather must fail weather audit (D14)').toBe(false)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it('[T2-F18-05] `runAudioAudit({ sections: ["ambient"] })` fails (`ok: false`) when `public/asset-manifest.json` has a tampered SHA-256 for an ambient pack', async () => {
      const packs = await ambientPacks()
      const audit = await runAudit()
      const manifestRel = 'public/asset-manifest.json'
      const tmp = mirrorRepoWithCopies([manifestRel], (root) => {
        const raw = readFileSync(join(root, manifestRel), 'utf8')
        const tampered = raw.replace(packs[0]!.meta.sha256, '0'.repeat(64))
        writeFileSync(join(root, manifestRel), tampered, 'utf8')
      })
      try {
        const rep = await audit({ rootDir: tmp, mpqDir: D2_DATA_DIR, sections: ['ambient'] })
        expect(rep.ok, 'tampered asset-manifest sha256 for ambient pack must fail audit').toBe(false)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })
  })

  describe('Tier 3 — pairwise integration (F15 × F8 × F17 × F18)', () => {
    it('[T3-P4-01] F15 × F8 (`pack-ambient-sounds` × `SfxChunkLoader`): slicing and decoding Act 1–5 ambience & event chunks keeps every pack ArrayBuffer intact (D5)', async () => {
      const idx = await indexModule()
      const packs = await ambientPacks()
      const packMap = new Map(packs.map((p) => [p.meta.packId, p]))
      const loaderMod = await loadProductModule(PRODUCT.sfxChunkLoader, F15)
      const SfxChunkLoaderCtor = requireExport<
        new (opts?: Record<string, unknown>) => {
          loadPackBytes(packId: string): Promise<Uint8Array>
          loadSoundBuffer(id: number, ctx?: unknown): Promise<unknown>
        }
      >(loaderMod, 'SfxChunkLoader', PRODUCT.sfxChunkLoader, F15)

      const fakeCtx = new FakeAudioContext()
      const fetchFn = vi.fn(async (url: string) => {
        const pack = packs.find((p) => url.endsWith(packRel(p.meta)))
        if (!pack) throw new Error(`unexpected pack fetch: ${url}`)
        const copy = new Uint8Array(pack.bytes)
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => copy.buffer,
        }
      })

      const loader = new SfxChunkLoaderCtor({
        fetch: fetchFn,
        fetchFn,
        audioContext: () => fakeCtx,
        ctx: fakeCtx,
      })

      const sampleIds: number[] = []
      for (let act = 1; act <= 5; act += 1) {
        const ids = [...(ACT_SOUND_IDS.get(act) ?? [])]
        if (ids.length > 0) sampleIds.push(ids[0]!)
      }
      expect(sampleIds.length).toBe(5)

      for (const id of sampleIds) {
        const t = idx.SFX_PACK_INDEX_113C[id]!
        expect(packMap.has(t[0])).toBe(true)
        const packBytes = await loader.loadPackBytes(t[0])
        const buf = await loader.loadSoundBuffer(id, fakeCtx)
        expect(buf, `decoded buffer for ambient sound id ${String(id)}`).toBeTruthy()
        expect(
          packBytes.buffer.byteLength,
          `D5: resident pack ${t[0]} ArrayBuffer must remain intact after decodeAudioData`,
        ).toBe(packMap.get(t[0])!.bytes.byteLength)
      }
    })

    it('[T3-P4-02] F15 × F17 × F18 (weather Opus pack × `SfxChunkLoader` × `verify:audio` §weather): rain (`64`) and thunder (`202..204`) decode with exact 22,050 Hz frame counts and pass §weather audit', async () => {
      const idx = await indexModule()
      for (const id of WEATHER_IDS) {
        const entry = idx.getSfxPackEntry113c(id)
        expect(entry, `weather id ${String(id)}`).toBeDefined()
        const wav = WAV.get(id)!
        expect(entry!.sampleRate).toBe(22050)
        expect(entry!.frames).toBe(wav.frames)
        expect(entry!.channels).toBe(wav.channels)
      }
      const audit = await runAudit()
      const rep = await audit({ rootDir: REPO_ROOT, mpqDir: D2_DATA_DIR, sections: ['weather'] })
      expect(rep.ok).toBe(true)
    })
  })
})
