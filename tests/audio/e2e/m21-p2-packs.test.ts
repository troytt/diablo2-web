/**
 * M21-P2 (#944) — F7 core SFX indexed Opus chunk packs + generated index, F11 `verify:audio`
 * §sfx-core / asset manifest / cacheable prefix / `.gitignore`.
 *
 * Authoritative sources (no product table is used as an oracle):
 * - Request R2 + PROJECT.md D1–D4, D18, override (i)–(iii): pack split, ≤ 800,000 B first-screen cap,
 *   ≥ 24 kbps mono / ≥ 40 kbps stereo MEASURED per chunk, hard CBR, Ogg Opus, `D2SP` v2 format.
 * - The 1.13c MPQs (harness oracle): which Sounds.txt rows belong in each tier and every source
 *   WAV's sample rate / frame count / channel count (independent RIFF walk).
 * - RFC 3533 / 7845 / 6716 (independent Ogg + Opus TOC reader in the harness) to MEASURE chunks.
 * Packs are read from `public/` exactly as the client would fetch them (D18: baked locally, gitignored).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  D2_DATA_DIR,
  D3_BACKGROUND_PART_MAX_BYTES,
  E2_SFX_PACK_FORMAT,
  PRODUCT,
  R2_BACKGROUND_PREFIXES_113C,
  R2_FIRST_SCREEN_PREFIXES_113C,
  REPO_ROOT,
  SFX_CORE_MAX_BYTES,
  SFX_FLOOR_BPS_113C,
  getOracle113c,
  loadProductModule,
  mirrorRepoWithCopies,
  normSoundFile,
  oggOpusFacts,
  oracleStream0Rows,
  oracleWavBytes,
  oracleWavFacts,
  readRepoText,
  requireExport,
  sha256Hex,
  soundFileDir,
  summarize,
  type OggOpusFacts,
  type OracleSoundRow,
  type OracleWavFacts,
} from './harness-113c.ts'

// The gates run on hosts at load average 60+: give MPQ/pack-heavy tests head-room.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F7 = '#944 F7 pack-sfx + sfx-pack-index-113c'
const F11 = '#944 F11 verify:audio §sfx-core / manifest / cacheable / .gitignore'

// ── Contract (reland_plan §E.2 + PROJECT.md overrides i–iii) ────────────────────────────────────
type TupleC = readonly [packId: string, byteOffset: number, byteLength: number, sampleRate: number, frames: number, channels: number]
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
  validateSfxPackHeader113c(bytes: Uint8Array, expect: PackMetaC): { readonly version: number; readonly chunkCount: number }
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

interface LayoutC {
  readonly packId: string
  readonly tier: string
  readonly prefixes: readonly string[]
  readonly maxBytes?: number
}
type Transcode = (wav: Uint8Array, opts: { bitrate: number; vbr: 'off' }) => Promise<Uint8Array>

interface AuditReportC {
  readonly ok: boolean
  readonly sections: readonly { readonly id: string; readonly errors: readonly string[]; readonly summary: string }[]
}
type RunAudit = (opts?: { rootDir?: string; mpqDir?: string; sections?: readonly string[] }) => Promise<AuditReportC>

async function indexModule(): Promise<IndexModuleC> {
  const m = await loadProductModule(PRODUCT.sfxPackIndex, F7)
  for (const n of INDEX_EXPORTS) requireExport(m, n, PRODUCT.sfxPackIndex, F7)
  return m as unknown as IndexModuleC
}

async function runAudit(): Promise<RunAudit> {
  const m = await loadProductModule(PRODUCT.audit, F11)
  return requireExport<RunAudit>(m, 'runAudioAudit', PRODUCT.audit, F11)
}

const CORE_TIERS = new Set(['first-screen', 'background'])
const isCorePackId = (id: string): boolean => /^sfx-core(-\d+)?$/.test(id)

/** `public/`-relative path of a pack URL ('/sound/packs/x.bin' or 'sound/packs/x.bin'). */
function packRel(meta: PackMetaC): string {
  const rel = meta.url.replace(/^\/+/, '')
  if (rel !== `sound/packs/${meta.packId}.bin`) throw new Error(`[${F7}] pack ${meta.packId}: url '${meta.url}' is not /sound/packs/${meta.packId}.bin`)
  return rel
}

interface CorePack {
  readonly meta: PackMetaC
  readonly bytes: Uint8Array
}

let corePacksP: Promise<CorePack[]> | null = null
/** The #944 packs (tiers first-screen/background) exactly as served from `public/`. */
function corePacks(): Promise<CorePack[]> {
  corePacksP ??= (async () => {
    const idx = await indexModule()
    const metas = idx.SFX_PACKS_113C.filter((p) => CORE_TIERS.has(p.tier))
    if (metas.length === 0) throw new Error(`[${F7}] SFX_PACKS_113C lists no first-screen/background pack`)
    return metas.map((meta) => {
      const abs = join(REPO_ROOT, 'public', packRel(meta))
      let bytes: Uint8Array
      try {
        bytes = new Uint8Array(readFileSync(abs))
      } catch {
        throw new Error(`[${F7}] baked pack missing: public/${packRel(meta)} (run the sfx bake; D18)`)
      }
      return { meta, bytes }
    })
  })()
  return corePacksP
}

/** Index entries of the core packs: id → tuple. */
async function coreEntries(): Promise<Map<number, TupleC>> {
  const idx = await indexModule()
  const packs = new Set((await corePacks()).map((p) => p.meta.packId))
  const out = new Map<number, TupleC>()
  for (const [k, t] of Object.entries(idx.SFX_PACK_INDEX_113C)) if (packs.has(t[0])) out.set(Number(k), t)
  return out
}

const chunkFactsCache = new Map<string, OggOpusFacts>()
function chunkOf(p: CorePack, t: TupleC): Uint8Array {
  return p.bytes.subarray(t[1], t[1] + t[2])
}
function chunkFacts(p: CorePack, t: TupleC): OggOpusFacts {
  const key = `${p.meta.packId}@${String(t[1])}`
  let f = chunkFactsCache.get(key)
  if (f === undefined) {
    f = oggOpusFacts(chunkOf(p, t), `${p.meta.packId}[${String(t[1])}+${String(t[2])}]`)
    chunkFactsCache.set(key, f)
  }
  return f
}

let FIRST: OracleSoundRow[] = []
let BACKGROUND: OracleSoundRow[] = []
const WAV = new Map<number, OracleWavFacts>()

beforeAll(() => {
  getOracle113c()
  FIRST = oracleStream0Rows(R2_FIRST_SCREEN_PREFIXES_113C)
  BACKGROUND = oracleStream0Rows(R2_BACKGROUND_PREFIXES_113C)
  for (const r of [...FIRST, ...BACKGROUND]) WAV.set(r.id, oracleWavFacts(r.id))
}, 600_000)

const sortNum = (a: number, b: number): number => a - b
const idsOf = (rows: readonly OracleSoundRow[]): number[] => rows.map((r) => r.id).sort(sortNum)
const uniqueFiles = (rows: readonly OracleSoundRow[]): number => new Set(rows.map((r) => normSoundFile(r.fileName))).size

describe('M21-P2 #944 — F7 core SFX packs + generated index (baked artifacts vs 1.13c MPQ oracle)', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F7-01] pack set: one first-screen `sfx-core` + background `sfx-core-2..N` (contiguous, D3), URLs under /sound/packs/', async () => {
      const packs = (await corePacks()).map((p) => p.meta)
      const first = packs.filter((p) => p.tier === 'first-screen')
      const bg = packs.filter((p) => p.tier === 'background')
      expect(first.map((p) => p.packId), 'exactly one first-screen pack named sfx-core (R2/D2)').toEqual(['sfx-core'])
      expect(bg.length, 'at least one background core pack (R2 second pack)').toBeGreaterThanOrEqual(1)
      const want = bg.map((_, i) => `sfx-core-${String(i + 2)}`)
      expect(bg.map((p) => p.packId).sort((a, b) => Number(a.split('-')[2]) - Number(b.split('-')[2])), 'background parts named sfx-core-2, sfx-core-3, … with no gap (D3)').toEqual(want)
      for (const p of packs) expect(packRel(p)).toBe(`sound/packs/${p.packId}.bin`)
      const firstPrefixes = new Set(first[0]!.prefixes.map(normSoundFile))
      expect(firstPrefixes, 'first-screen meta prefixes = R2 folders').toEqual(new Set(R2_FIRST_SCREEN_PREFIXES_113C))
      for (const p of bg) {
        for (const pre of p.prefixes.map(normSoundFile)) {
          expect(R2_BACKGROUND_PREFIXES_113C.some((r) => pre.startsWith(r)), `${p.packId} prefix ${pre} lies under an R2 background folder`).toBe(true)
        }
      }
      const idx = await indexModule()
      const others = idx.SFX_PACKS_113C.filter((p) => !CORE_TIERS.has(p.tier))
      expect(others.filter((p) => isCorePackId(p.packId)).map((p) => p.packId), 'no sfx-core* pack outside the first-screen/background tiers').toEqual([])
    })

    it('[T1-F7-02] every pack file: size = meta.bytes, SHA-256 = meta.sha256, `D2SP` v2 header with chunkCount = meta.chunkCount (E.2)', async () => {
      const idx = await indexModule()
      expect([idx.SFX_PACK_HEADER_MAGIC_113C, idx.SFX_PACK_HEADER_VERSION_113C, idx.SFX_PACK_HEADER_BYTES_113C]).toEqual([
        E2_SFX_PACK_FORMAT.magic,
        E2_SFX_PACK_FORMAT.version,
        E2_SFX_PACK_FORMAT.headerBytes,
      ])
      const bad: string[] = []
      for (const { meta, bytes } of await corePacks()) {
        if (bytes.length !== meta.bytes) bad.push(`${meta.packId}: file ${String(bytes.length)} B != meta ${String(meta.bytes)} B`)
        if (sha256Hex(bytes) !== meta.sha256.toLowerCase()) bad.push(`${meta.packId}: sha256 mismatch (stale pack?)`)
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        const magic = String.fromCharCode(...bytes.subarray(0, 4))
        if (magic !== 'D2SP' || dv.getUint32(4, true) !== 2) bad.push(`${meta.packId}: header ${magic} v${String(dv.getUint32(4, true))}`)
        if (dv.getUint32(8, true) !== meta.chunkCount) bad.push(`${meta.packId}: header chunkCount ${String(dv.getUint32(8, true))} != meta ${String(meta.chunkCount)}`)
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F7-03] content partition = oracle: sfx-core holds exactly the 448 Stream=0 cursor/item/combat/ambient\\footstep rows, the background parts exactly the 205 object/quest/ambient\\creature rows', async () => {
      expect([FIRST.length, uniqueFiles(FIRST), BACKGROUND.length, uniqueFiles(BACKGROUND)], 'oracle sizes (R2/D2/D3)').toEqual([448, 429, 205, 198])
      const entries = await coreEntries()
      const packs = await corePacks()
      const tierOf = new Map(packs.map((p) => [p.meta.packId, p.meta.tier]))
      const got = { first: [] as number[], bg: [] as number[] }
      for (const [id, t] of entries) (tierOf.get(t[0]) === 'first-screen' ? got.first : got.bg).push(id)
      const diff = (a: number[], b: number[]): string => {
        const A = new Set(a)
        const B = new Set(b)
        return `missing ${JSON.stringify(a.filter((x) => !B.has(x)).slice(0, 20))} extra ${JSON.stringify(b.filter((x) => !A.has(x)).slice(0, 20))}`
      }
      expect(got.first.sort(sortNum), `first-screen ids: ${diff(idsOf(FIRST), got.first)}`).toEqual(idsOf(FIRST))
      expect(got.bg.sort(sortNum), `background ids: ${diff(idsOf(BACKGROUND), got.bg)}`).toEqual(idsOf(BACKGROUND))
      const bad: string[] = []
      for (const { meta } of packs) {
        const ids = [...entries].filter(([, t]) => t[0] === meta.packId).map(([id]) => id)
        const files = new Set(ids.map((id) => normSoundFile(getOracle113c().sounds[id]!.fileName)))
        if (meta.rowCount !== ids.length) bad.push(`${meta.packId}: rowCount ${String(meta.rowCount)} != ${String(ids.length)} indexed rows`)
        if (meta.chunkCount !== files.size) bad.push(`${meta.packId}: chunkCount ${String(meta.chunkCount)} != ${String(files.size)} unique FileNames`)
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F7-04] every tuple carries the source WAV facts from the MPQ (sampleRate 22050, frames, channels) and getSfxPackEntry113c agrees', async () => {
      const idx = await indexModule()
      const bad: string[] = []
      for (const [id, t] of await coreEntries()) {
        const w = WAV.get(id)!
        if (t[3] !== w.sampleRate || t[4] !== w.frames || t[5] !== w.channels) bad.push(`row ${String(id)} ${w.member}: tuple (${String(t[3])}, ${String(t[4])}, ${String(t[5])}) != WAV (${String(w.sampleRate)}, ${String(w.frames)}, ${String(w.channels)})`)
        const e = idx.getSfxPackEntry113c(id)
        if (e === undefined || e.packId !== t[0] || e.byteOffset !== t[1] || e.byteLength !== t[2] || e.sampleRate !== t[3] || e.frames !== t[4] || e.channels !== t[5]) bad.push(`row ${String(id)}: getSfxPackEntry113c ${JSON.stringify(e)} != tuple ${JSON.stringify(t)}`)
      }
      expect(bad, summarize(bad)).toEqual([])
      expect(new Set([...WAV.values()].map((w) => w.sampleRate))).toEqual(new Set([22_050]))
    })

    it('[T1-F7-05] slices tile each pack from offset 12 to EOF with no gap/overlap; one slice per unique FileName; shared FileNames share it; validateSfxChunkSlice113c accepts all', async () => {
      const idx = await indexModule()
      const entries = await coreEntries()
      const bad: string[] = []
      for (const p of await corePacks()) {
        const slices = new Map<number, { len: number; files: Set<string> }>()
        for (const [id, t] of entries) {
          if (t[0] !== p.meta.packId) continue
          const f = normSoundFile(getOracle113c().sounds[id]!.fileName)
          const s = slices.get(t[1])
          if (s === undefined) slices.set(t[1], { len: t[2], files: new Set([f]) })
          else {
            if (s.len !== t[2]) bad.push(`${p.meta.packId}@${String(t[1])}: two lengths ${String(s.len)}/${String(t[2])}`)
            s.files.add(f)
          }
          if (!idx.validateSfxChunkSlice113c(t[1], t[2], p.bytes.length)) bad.push(`row ${String(id)}: validateSfxChunkSlice113c rejected [${String(t[1])}, +${String(t[2])}]`)
        }
        for (const [off, s] of slices) if (s.files.size !== 1) bad.push(`${p.meta.packId}@${String(off)} shared by different files ${[...s.files].join(', ')}`)
        const fileToOff = new Map<string, number>()
        for (const [off, s] of slices) {
          const f = [...s.files][0]!
          if (fileToOff.has(f)) bad.push(`${p.meta.packId}: file ${f} stored twice (@${String(fileToOff.get(f))} and @${String(off)})`)
          fileToOff.set(f, off)
        }
        let at = E2_SFX_PACK_FORMAT.headerBytes
        for (const off of [...slices.keys()].sort(sortNum)) {
          if (off !== at) bad.push(`${p.meta.packId}: ${off > at ? 'gap' : 'overlap'} at ${String(at)} (next slice @${String(off)})`)
          at = off + slices.get(off)!.len
        }
        if (at !== p.bytes.length) bad.push(`${p.meta.packId}: slices end at ${String(at)}, file has ${String(p.bytes.length)} B`)
        if (slices.size !== p.meta.chunkCount) bad.push(`${p.meta.packId}: ${String(slices.size)} distinct slices != chunkCount ${String(p.meta.chunkCount)}`)
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F7-06] every chunk is ONE complete Ogg Opus stream (CRC, OpusHead/OpusTags, EOS); OpusHead channels = source channels; decoded length = WAV length (±2 ms)', async () => {
      const entries = await coreEntries()
      const bad: string[] = []
      for (const p of await corePacks()) {
        for (const [id, t] of entries) {
          if (t[0] !== p.meta.packId) continue
          let f: OggOpusFacts
          try {
            f = chunkFacts(p, t)
          } catch (e) {
            bad.push(`row ${String(id)}: ${String((e as Error).message)}`)
            continue
          }
          const w = WAV.get(id)!
          if (f.channels !== w.channels) bad.push(`row ${String(id)}: OpusHead ${String(f.channels)} ch, WAV ${String(w.channels)} ch`)
          const src = w.frames / w.sampleRate
          if (Math.abs(f.decodedSeconds - src) > 0.002) bad.push(`row ${String(id)} ${w.member}: decoded ${f.decodedSeconds.toFixed(4)} s vs WAV ${src.toFixed(4)} s`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F7-07] D1 floor per chunk: hard CBR (one packet size per chunk), per-packet nominal ≥ 24k mono / 40k stereo, measured payload bits ÷ decoded seconds ≥ floor; meta targets ≥ floor', async () => {
      const entries = await coreEntries()
      const bad: string[] = []
      let checked = 0
      for (const p of await corePacks()) {
        if (!(p.meta.targetBitrateMono >= SFX_FLOOR_BPS_113C.mono)) bad.push(`${p.meta.packId}: targetBitrateMono ${String(p.meta.targetBitrateMono)}`)
        if (!(p.meta.targetBitrateStereo >= SFX_FLOOR_BPS_113C.stereo)) bad.push(`${p.meta.packId}: targetBitrateStereo ${String(p.meta.targetBitrateStereo)}`)
        const seen = new Set<number>()
        for (const [id, t] of entries) {
          if (t[0] !== p.meta.packId || seen.has(t[1])) continue
          seen.add(t[1])
          const f = chunkFacts(p, t)
          const floor = f.channels === 2 ? SFX_FLOOR_BPS_113C.stereo : SFX_FLOOR_BPS_113C.mono
          const sizes = new Set(f.audioPacketSizes)
          const durs = new Set(f.audioPacketSamples48k)
          if (sizes.size !== 1 || durs.size !== 1) bad.push(`row ${String(id)}: not hard CBR (packet sizes ${[...sizes].slice(0, 6).join('/')}, durations ${[...durs].join('/')})`)
          for (let i = 0; i < f.audioPacketSizes.length; i += 1) {
            const nominal = (f.audioPacketSizes[i]! * 8 * 48_000) / f.audioPacketSamples48k[i]!
            if (nominal < floor) {
              bad.push(`row ${String(id)}: packet ${String(i)} nominal ${nominal.toFixed(0)} b/s < ${String(floor)}`)
              break
            }
          }
          const measured = (f.audioPacketBytes * 8) / f.decodedSeconds
          if (!(measured >= floor)) bad.push(`row ${String(id)}: measured ${measured.toFixed(0)} b/s < ${String(floor)} (D1)`)
          checked += 1
        }
      }
      expect(checked, 'chunks measured (429 + 198 unique WAVs)').toBe(627)
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F7-08] sizes: sfx-core.bin ≤ 800,000 B (D2); every background part ≤ 890,000 B and split along whole subfolders (D3)', async () => {
      const packs = await corePacks()
      const core = packs.find((p) => p.meta.packId === 'sfx-core')!
      expect(core.bytes.length, 'sfx-core.bin bytes').toBeLessThanOrEqual(SFX_CORE_MAX_BYTES)
      const bad: string[] = []
      for (const p of packs.filter((x) => x.meta.tier === 'background')) {
        if (p.bytes.length > D3_BACKGROUND_PART_MAX_BYTES) bad.push(`${p.meta.packId}: ${String(p.bytes.length)} B > ${String(D3_BACKGROUND_PART_MAX_BYTES)} B`)
      }
      const dirPack = new Map<string, Set<string>>()
      for (const [id, t] of await coreEntries()) {
        const d = soundFileDir(getOracle113c().sounds[id]!.fileName)
        const s = dirPack.get(d) ?? new Set<string>()
        s.add(t[0])
        dirPack.set(d, s)
      }
      for (const [d, s] of dirPack) if (s.size !== 1) bad.push(`subfolder ${d} is split across ${[...s].join(', ')}`)
      expect(bad, summarize(bad)).toEqual([])
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F7-01] nothing outside R2 leaks into the core packs: no Stream=1, none.wav, id 0 or foreign-folder row; invalid ids have no entry', async () => {
      const idx = await indexModule()
      const O = getOracle113c()
      const bad: string[] = []
      for (const [id, t] of await coreEntries()) {
        const r = O.sounds[id]
        if (r === undefined || id <= 0) {
          bad.push(`id ${String(id)} is not a Sounds.txt row`)
          continue
        }
        const f = normSoundFile(r.fileName)
        const pre = t[0] === 'sfx-core' ? R2_FIRST_SCREEN_PREFIXES_113C : R2_BACKGROUND_PREFIXES_113C
        if (r.stream) bad.push(`row ${String(id)} is Stream=1`)
        if (f === 'none.wav') bad.push(`row ${String(id)} is none.wav`)
        if (!pre.some((p) => f.startsWith(p))) bad.push(`row ${String(id)} (${f}) is outside ${t[0]}'s R2 folders`)
      }
      expect(bad, summarize(bad)).toEqual([])
      for (const id of [0, -1, 4699, 65536, Number.NaN, 2.5]) expect(idx.getSfxPackEntry113c(id), `getSfxPackEntry113c(${String(id)})`).toBeUndefined()
      // Streamed rows (speech / music) are never SFX-pack entries, in any milestone.
      for (const id of [2961, 4379, 4657, 4686]) expect(idx.getSfxPackEntry113c(id), `Stream=1 row ${String(id)}`).toBeUndefined()
    })

    it('[T2-F7-02] the shortest core sound (row 235 item_pickup → cursor\\pickup.wav, 0.037 s) survives encoding: exact length and floor', async () => {
      const shortest = [...FIRST, ...BACKGROUND].reduce((a, b) => (WAV.get(a.id)!.frames < WAV.get(b.id)!.frames ? a : b))
      expect(shortest.id, 'oracle: shortest core WAV').toBe(235)
      const t = (await coreEntries()).get(235)
      expect(t, 'row 235 is indexed').toBeDefined()
      const p = (await corePacks()).find((x) => x.meta.packId === t![0])!
      const f = chunkFacts(p, t!)
      const src = WAV.get(235)!.frames / 22_050
      expect(Math.abs(f.decodedSeconds - src)).toBeLessThanOrEqual(0.002)
      expect((f.audioPacketBytes * 8) / f.decodedSeconds).toBeGreaterThanOrEqual(SFX_FLOOR_BPS_113C.mono)
    })

    it('[T2-F7-03] Volume-0 rows that still name a shipped WAV (396, 397, 2572, 2698–2701) are packed: R2 covers ALL Stream=0 rows of the folders', async () => {
      const vol0 = [...FIRST, ...BACKGROUND].filter((r) => r.volume === 0).map((r) => r.id).sort(sortNum)
      expect(vol0, 'oracle').toEqual([396, 397, 2572, 2698, 2699, 2700, 2701])
      const entries = await coreEntries()
      expect(vol0.filter((id) => !entries.has(id)), 'unpacked Volume-0 rows').toEqual([])
    })

    it('[T2-F7-04] rows that share a FileName (19 first-screen + 7 background groups) resolve to one identical slice', async () => {
      const entries = await coreEntries()
      const groups = new Map<string, number[]>()
      for (const r of [...FIRST, ...BACKGROUND]) {
        const k = normSoundFile(r.fileName)
        groups.set(k, [...(groups.get(k) ?? []), r.id])
      }
      const shared = [...groups].filter(([, ids]) => ids.length > 1)
      expect(shared.length, 'oracle shared-file groups').toBe(26)
      const bad: string[] = []
      for (const [f, ids] of shared) {
        const ts = ids.map((id) => entries.get(id))
        if (ts.some((t) => t === undefined)) {
          bad.push(`${f}: unindexed row among ${ids.join('/')}`)
          continue
        }
        const keys = new Set(ts.map((t) => `${t![0]}@${String(t![1])}+${String(t![2])}`))
        if (keys.size !== 1) bad.push(`${f}: rows ${ids.join('/')} → ${[...keys].join(' | ')}`)
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T2-F7-05] validateSfxPackHeader113c accepts the real packs and rejects other magics (incl. legacy DSPK/D2SC), versions 1/3, wrong chunkCount and wrong size; validateSfxChunkSlice113c rejects bad slices', async () => {
      const idx = await indexModule()
      const p = (await corePacks()).find((x) => x.meta.packId === 'sfx-core')!
      expect(idx.validateSfxPackHeader113c(p.bytes, p.meta)).toMatchObject({ version: 2, chunkCount: p.meta.chunkCount })
      const mutate = (fn: (b: Uint8Array) => Uint8Array): Uint8Array => fn(p.bytes.slice())
      const cases: [string, Uint8Array][] = [
        ['magic DSPK', mutate((b) => (b.set([0x44, 0x53, 0x50, 0x4b], 0), b))],
        ['magic D2SC', mutate((b) => (b.set([0x44, 0x32, 0x53, 0x43], 0), b))],
        ['magic d2sp', mutate((b) => (b.set([0x64, 0x32, 0x73, 0x70], 0), b))],
        ['version 1', mutate((b) => (new DataView(b.buffer).setUint32(4, 1, true), b))],
        ['version 3', mutate((b) => (new DataView(b.buffer).setUint32(4, 3, true), b))],
        ['chunkCount + 1', mutate((b) => (new DataView(b.buffer).setUint32(8, p.meta.chunkCount + 1, true), b))],
        ['truncated by 1 byte', p.bytes.slice(0, p.bytes.length - 1)],
        ['1 trailing byte', (() => { const b = new Uint8Array(p.bytes.length + 1); b.set(p.bytes); return b })()],
        ['11-byte file', p.bytes.slice(0, 11)],
      ]
      for (const [name, bytes] of cases) expect(() => idx.validateSfxPackHeader113c(bytes, p.meta), name).toThrow()
      const L = p.bytes.length
      expect(idx.validateSfxChunkSlice113c(12, L - 12, L)).toBe(true)
      for (const [off, len] of [[11, 10], [12, 0], [12, -1], [-1, 5], [L - 4, 5], [12.5, 10], [12, 10.5], [Number.NaN, 10], [12, Number.POSITIVE_INFINITY]] as const) {
        expect(idx.validateSfxChunkSlice113c(off, len, L), `slice [${String(off)}, +${String(len)}]`).toBe(false)
      }
    })

    it('[T2-F7-06] the 10 stereo first-screen WAVs (cursor\\intro\\*) stay stereo (tuple + OpusHead) at ≥ 40 kbps; mono WAVs are never up-mixed', async () => {
      const entries = await coreEntries()
      const packs = new Map((await corePacks()).map((p) => [p.meta.packId, p]))
      const stereo = [...FIRST, ...BACKGROUND].filter((r) => WAV.get(r.id)!.channels === 2)
      expect(stereo.length, 'oracle stereo rows').toBe(10)
      expect(stereo.every((r) => normSoundFile(r.fileName).startsWith('cursor\\intro\\'))).toBe(true)
      const bad: string[] = []
      for (const [id, t] of entries) {
        const f = chunkFacts(packs.get(t[0])!, t)
        const ch = WAV.get(id)!.channels
        if (t[5] !== ch || f.channels !== ch) bad.push(`row ${String(id)}: WAV ${String(ch)} ch, tuple ${String(t[5])}, OpusHead ${String(f.channels)}`)
        if (ch === 2 && (f.audioPacketBytes * 8) / f.decodedSeconds < SFX_FLOOR_BPS_113C.stereo) bad.push(`stereo row ${String(id)} below 40 kbps`)
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T2-F7-07] provenance + determinism: transcodeWavToOpusOgg(MPQ WAV, hard CBR at the pack target) reproduces the baked chunk byte-for-byte; SFX_PACK_LAYOUT_113C matches R2/D2', async () => {
      const m = await loadProductModule(PRODUCT.packSfx, F7)
      const transcode = requireExport<Transcode>(m, 'transcodeWavToOpusOgg', PRODUCT.packSfx, F7)
      const layout = requireExport<readonly LayoutC[]>(m, 'SFX_PACK_LAYOUT_113C', PRODUCT.packSfx, F7)
      const core = layout.find((l) => l.packId === 'sfx-core')
      expect(core, 'layout has sfx-core').toBeDefined()
      expect(core!.tier).toBe('first-screen')
      expect(core!.maxBytes, 'override (i): sfx-core maxBytes').toBe(SFX_CORE_MAX_BYTES)
      expect(new Set(core!.prefixes.map(normSoundFile))).toEqual(new Set(R2_FIRST_SCREEN_PREFIXES_113C))
      const bgPrefixes = new Set(layout.filter((l) => l.tier === 'background').flatMap((l) => l.prefixes.map(normSoundFile)))
      for (const pre of R2_BACKGROUND_PREFIXES_113C) expect([...bgPrefixes].some((b) => b === pre || b.startsWith(pre)), `background layout covers ${pre}`).toBe(true)
      const entries = await coreEntries()
      const packs = new Map((await corePacks()).map((p) => [p.meta.packId, p]))
      const sample = [4 /* cursor\button.wav */, 17 /* cursor\intro stereo */, 2548 /* object\chestspecial1.wav */]
      for (const id of sample) {
        const t = entries.get(id)
        expect(t, `row ${String(id)} is indexed in a core pack`).toBeDefined()
        if (t === undefined) return
        const p = packs.get(t[0])!
        const bitrate = WAV.get(id)!.channels === 2 ? p.meta.targetBitrateStereo : p.meta.targetBitrateMono
        const a = await transcode(oracleWavBytes(id), { bitrate, vbr: 'off' })
        const b = await transcode(oracleWavBytes(id), { bitrate, vbr: 'off' })
        expect(sha256Hex(a), `row ${String(id)}: transcoder is deterministic`).toBe(sha256Hex(b))
        expect(sha256Hex(a), `row ${String(id)}: baked chunk = transcode(1.13c MPQ WAV)`).toBe(sha256Hex(chunkOf(p, t)))
      }
    })
  })

  describe('Tier 3 — pairwise', () => {
    it('[T3-P2-01] tier × channel layout: first-screen×mono, first-screen×stereo and background×mono chunks all meet their own floor; background×stereo does not exist (oracle)', async () => {
      const entries = await coreEntries()
      const packs = new Map((await corePacks()).map((p) => [p.meta.packId, p]))
      const cells = new Map<string, { n: number; minBps: number }>()
      for (const [, t] of entries) {
        const p = packs.get(t[0])!
        const f = chunkFacts(p, t)
        const key = `${p.meta.tier}×${f.channels === 2 ? 'stereo' : 'mono'}`
        const bps = (f.audioPacketBytes * 8) / f.decodedSeconds
        const c = cells.get(key) ?? { n: 0, minBps: Number.POSITIVE_INFINITY }
        cells.set(key, { n: c.n + 1, minBps: Math.min(c.minBps, bps) })
      }
      expect([...cells.keys()].sort()).toEqual(['background×mono', 'first-screen×mono', 'first-screen×stereo'])
      expect(cells.get('first-screen×mono')!.minBps).toBeGreaterThanOrEqual(SFX_FLOOR_BPS_113C.mono)
      expect(cells.get('background×mono')!.minBps).toBeGreaterThanOrEqual(SFX_FLOOR_BPS_113C.mono)
      expect(cells.get('first-screen×stereo')!.minBps).toBeGreaterThanOrEqual(SFX_FLOOR_BPS_113C.stereo)
    })

    it('[T3-P2-02] tier × FileName: no WAV is stored in both tiers, and every subfolder maps to exactly one tier (oracle and product agree)', async () => {
      const fFiles = new Set(FIRST.map((r) => normSoundFile(r.fileName)))
      expect(BACKGROUND.filter((r) => fFiles.has(normSoundFile(r.fileName))).map((r) => r.id), 'oracle: tiers share no WAV').toEqual([])
      const entries = await coreEntries()
      const packs = new Map((await corePacks()).map((p) => [p.meta.packId, p.meta.tier]))
      const fileTier = new Map<string, Set<string>>()
      for (const [id, t] of entries) {
        const k = normSoundFile(getOracle113c().sounds[id]!.fileName)
        const s = fileTier.get(k) ?? new Set<string>()
        s.add(packs.get(t[0])!)
        fileTier.set(k, s)
      }
      expect([...fileTier].filter(([, s]) => s.size > 1).map(([k]) => k)).toEqual([])
    })
  })
})

// ── F11: the shared audit's sfx-core section, manifest, cacheability, .gitignore ─────────────────
function errorsOf(r: AuditReportC, section?: string): string[] {
  return r.sections.filter((s) => section === undefined || s.id === section).flatMap((s) => s.errors.map((e) => `[${s.id}] ${e}`))
}

/** Loads the product audit FIRST (missing module ⇒ failure), then audits a mirror with private pack copies. */
async function auditSfxCoreOn(copies: readonly string[], tamper: (root: string) => void): Promise<AuditReportC> {
  const run = await runAudit()
  await corePacks()
  const root = mirrorRepoWithCopies(copies, tamper)
  try {
    return await run({ rootDir: root, mpqDir: D2_DATA_DIR, sections: ['sfx-core'] })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

/** First chunk of `packId` whose payload is long enough to flip a byte in the middle of an audio page. */
async function aChunk(packId: string): Promise<{ id: number; t: TupleC }> {
  for (const [id, t] of await coreEntries()) if (t[0] === packId && t[2] > 600) return { id, t }
  throw new Error(`no chunk in ${packId}`)
}

/**
 * Test INPUT for the audit's floor check: a structurally VALID Ogg Opus stream of exactly the same
 * byte length as an existing chunk of `packId`, but encoded BELOW the floor (16 kbps hard CBR, from
 * the same 1.13c WAV) and padded through an OpusTags comment. Some lengths are unreachable (Ogg
 * lacing adds 2 bytes at multiples of 255), so several chunks are tried.
 */
async function underFloorReplacement(packId: string): Promise<{ id: number; t: TupleC; bytes: Uint8Array }> {
  const dir = mkdtempSync(join(tmpdir(), 'm21p2-underfloor-'))
  try {
    let tried = 0
    for (const [id, t] of await coreEntries()) {
      if (t[0] !== packId || t[2] < 1200 || tried >= 8) continue
      tried += 1
      const inWav = join(dir, `${String(id)}.wav`)
      const outOgg = join(dir, `${String(id)}.ogg`)
      writeFileSync(inWav, oracleWavBytes(id))
      let pad = 0
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', inWav, '-c:a', 'libopus', '-b:a', '16k', '-vbr', 'off', '-metadata', `comment=${'x'.repeat(pad)}`, '-f', 'ogg', '-bitexact', outOgg], { encoding: 'utf8' })
        if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`)
        const b = new Uint8Array(readFileSync(outOgg))
        if (b.length === t[2]) return { id, t, bytes: b }
        const next = pad + (t[2] - b.length)
        if (next < 0 || next === pad) break
        pad = next
      }
    }
    throw new Error(`could not build a same-length under-floor stream for any of ${String(tried)} chunks of ${packId}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('M21-P2 #944 — F11 verify:audio §sfx-core, asset manifest, cacheable prefix, .gitignore', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F11-01] runAudioAudit({sections:["sfx-core"]}) passes on the baked tree with a zero-error "sfx-core" section', async () => {
      const run = await runAudit()
      const report = await run({ sections: ['sfx-core'] })
      expect(report.sections.map((s) => s.id)).toContain('sfx-core')
      expect(errorsOf(report).join('\n')).toBe('')
      expect(report.ok).toBe(true)
    }, 300_000)

    it('[T1-F11-02] the audit detects one flipped byte inside a chunk payload of sfx-core.bin', async () => {
      const { t } = await aChunk('sfx-core')
      const report = await auditSfxCoreOn(['public/sound/packs'], (root) => {
        const f = join(root, 'public/sound/packs/sfx-core.bin')
        const b = new Uint8Array(readFileSync(f))
        const at = t[1] + Math.floor(t[2] * 0.75)
        b[at] = b[at]! ^ 0x5a
        writeFileSync(f, b)
      })
      expect(report.ok).toBe(false)
      expect(errorsOf(report, 'sfx-core').length).toBeGreaterThan(0)
    }, 300_000)

    it('[T1-F11-03] the audit detects a truncated background part (last 100 bytes cut)', async () => {
      const report = await auditSfxCoreOn(['public/sound/packs'], (root) => {
        const f = join(root, 'public/sound/packs/sfx-core-2.bin')
        const b = readFileSync(f)
        writeFileSync(f, b.subarray(0, b.length - 100))
      })
      expect(report.ok).toBe(false)
      expect(errorsOf(report, 'sfx-core').length).toBeGreaterThan(0)
    }, 300_000)

    it('[T1-F11-04] the audit rejects a stale v1 pack header (the rejected 8 kbps generation)', async () => {
      const report = await auditSfxCoreOn(['public/sound/packs'], (root) => {
        const f = join(root, 'public/sound/packs/sfx-core.bin')
        const b = new Uint8Array(readFileSync(f))
        new DataView(b.buffer).setUint32(4, 1, true)
        writeFileSync(f, b)
      })
      expect(report.ok).toBe(false)
      expect(errorsOf(report, 'sfx-core').length).toBeGreaterThan(0)
    }, 300_000)

    it('[T1-F11-05] asset manifest: every core pack is listed under sound/packs/<id>.bin with its SHA-256 prefix, both in public/asset-manifest.json and from generateAssetManifest(); the paths are cacheable', async () => {
      const packs = await corePacks()
      const manifest = JSON.parse(readRepoText('public/asset-manifest.json', F11)) as { files: Record<string, string> }
      const bad: string[] = []
      for (const { meta, bytes } of packs) {
        const key = `sound/packs/${meta.packId}.bin`
        const want = sha256Hex(bytes).slice(0, 16)
        if (manifest.files[key] !== want) bad.push(`public/asset-manifest.json ${key} = ${String(manifest.files[key])}, want ${want}`)
      }
      expect(bad, summarize(bad)).toEqual([])
      const am = await loadProductModule(PRODUCT.assetManifest, F11)
      const generate = requireExport<(o: { publicDir: string; outputFile: null }) => { files: Record<string, string> }>(am, 'generateAssetManifest', PRODUCT.assetManifest, F11)
      const pub = mkdtempSync(join(tmpdir(), 'm21p2-pub-'))
      try {
        mkdirSync(join(pub, 'sound'))
        symlinkSync(join(REPO_ROOT, 'public', 'sound', 'packs'), join(pub, 'sound', 'packs'))
        const gen = generate({ publicDir: pub, outputFile: null })
        for (const { meta, bytes } of packs) expect(gen.files[`sound/packs/${meta.packId}.bin`], `generated manifest lists ${meta.packId}`).toBe(sha256Hex(bytes).slice(0, 16))
      } finally {
        rmSync(pub, { recursive: true, force: true })
      }
      const pc = await loadProductModule(PRODUCT.packContract, F11)
      const cacheable = requireExport<(p: string) => boolean>(pc, 'isCacheableAssetPath', PRODUCT.packContract, F11)
      for (const { meta } of packs) {
        expect(cacheable(`sound/packs/${meta.packId}.bin`), `${meta.packId} cacheable`).toBe(true)
        expect(cacheable(`/diablo2/sound/packs/${meta.packId}.bin?v=1`), `${meta.packId} cacheable via deployment URL`).toBe(true)
      }
    }, 300_000)
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F11-01] the audit flags a manifest entry with the wrong hash and a missing manifest entry for a produced pack', async () => {
      await corePacks()
      const edit = (fn: (files: Record<string, string>) => void) => (root: string): void => {
        const f = join(root, 'public/asset-manifest.json')
        const m = JSON.parse(readFileSync(f, 'utf8')) as { files: Record<string, string> }
        fn(m.files)
        writeFileSync(f, JSON.stringify(m))
      }
      const wrong = await auditSfxCoreOn(['public/asset-manifest.json'], edit((files) => {
        files['sound/packs/sfx-core.bin'] = '0000000000000000'
      }))
      expect(wrong.ok, 'wrong manifest hash').toBe(false)
      const missing = await auditSfxCoreOn(['public/asset-manifest.json'], edit((files) => {
        delete files['sound/packs/sfx-core-2.bin']
      }))
      expect(missing.ok, 'missing manifest entry').toBe(false)
    }, 600_000)

    it('[T2-F11-02] the audit fails when a background part listed in the index is missing from public/sound/packs', async () => {
      const report = await auditSfxCoreOn(['public/sound/packs'], (root) => rmSync(join(root, 'public/sound/packs/sfx-core-2.bin')))
      expect(report.ok).toBe(false)
      expect(errorsOf(report, 'sfx-core').length).toBeGreaterThan(0)
    }, 300_000)

    it('[T2-F11-03] the audit measures every chunk: a same-length, structurally valid 16 kbps chunk is reported (pack hash re-sealed in the mirror index + manifest)', async () => {
      const { t, bytes: evil } = await underFloorReplacement('sfx-core')
      const f = oggOpusFacts(evil, 'test input')
      expect((f.audioPacketBytes * 8) / f.decodedSeconds, 'test input is really under 24 kbps').toBeLessThan(SFX_FLOOR_BPS_113C.mono)
      const core = (await corePacks()).find((p) => p.meta.packId === 'sfx-core')!
      const tampered = core.bytes.slice()
      tampered.set(evil, t[1])
      const newSha = sha256Hex(tampered)
      const report = await auditSfxCoreOn(['public/sound/packs', 'public/asset-manifest.json', PRODUCT.sfxPackIndex], (root) => {
        writeFileSync(join(root, 'public/sound/packs/sfx-core.bin'), tampered)
        // Re-seal the hash wherever this tree records it, so that only the floor is violated.
        const idxFile = join(root, PRODUCT.sfxPackIndex)
        const src = readFileSync(idxFile, 'utf8')
        const resealed = src.replace(new RegExp(core.meta.sha256, 'gi'), newSha)
        if (resealed === src) throw new Error('sfx-core sha256 literal not found in the generated index')
        writeFileSync(idxFile, resealed)
        const mf = join(root, 'public/asset-manifest.json')
        const m = JSON.parse(readFileSync(mf, 'utf8')) as { files: Record<string, string> }
        m.files['sound/packs/sfx-core.bin'] = newSha.slice(0, 16)
        writeFileSync(mf, JSON.stringify(m))
      })
      expect(report.ok, 'audit must reject an under-floor chunk').toBe(false)
      const errs = errorsOf(report, 'sfx-core')
      const floorReported = errs.some((e) => /bit ?rate|kbps|b\/s|bps|floor/i.test(e))
      // An audit that binds packs to its own (static) index sees a hash mismatch instead — also a rejection.
      const staticHashReported = errs.some((e) => /sha|hash|digest/i.test(e))
      expect(floorReported || staticHashReported, `floor (or static-index hash) error expected:\n${errs.join('\n')}`).toBe(true)
    }, 300_000)

    it('[T2-F11-04] the audit rejects an oversized sfx-core.bin (copy padded to 800,001 bytes)', async () => {
      const report = await auditSfxCoreOn(['public/sound/packs'], (root) => {
        const file = join(root, 'public/sound/packs/sfx-core.bin')
        const b = readFileSync(file)
        const grown = new Uint8Array(SFX_CORE_MAX_BYTES + 1)
        grown.set(b.subarray(0, Math.min(b.length, grown.length)))
        writeFileSync(file, grown)
      })
      expect(report.ok).toBe(false)
      expect(errorsOf(report, 'sfx-core').length).toBeGreaterThan(0)
    }, 300_000)

    it('[T2-F11-05] public/sound/ is gitignored (D18) and no baked pack is tracked by git [tracking half is a guard]', () => {
      const lines = readRepoText(PRODUCT.gitignore, F11).split(/\r?\n/).map((l) => l.trim())
      expect(lines.some((l) => /^\/?public\/sound(\/(\*\*?)?)?$/.test(l)), '.gitignore has a public/sound/ line').toBe(true)
      const r = spawnSync('git', ['ls-files', '--', 'public/sound'], { cwd: REPO_ROOT, encoding: 'utf8' })
      expect(r.status).toBe(0)
      expect(r.stdout.trim(), 'tracked files under public/sound').toBe('')
    })

    it('[T2-F11-06] cacheability boundaries: `sound/` packs are cacheable, raw WAV under sound/ is not, unrelated prefixes stay as before', async () => {
      const pc = await loadProductModule(PRODUCT.packContract, F11)
      const cacheable = requireExport<(p: string) => boolean>(pc, 'isCacheableAssetPath', PRODUCT.packContract, F11)
      expect(cacheable('sound/packs/sfx-core.bin')).toBe(true)
      expect(cacheable('https://example.com/diablo2/sound/packs/sfx-core-2.bin#x')).toBe(true)
      expect(cacheable('sound/weather/rain.wav'), 'no raw WAV is ever cached/served (R2: no WAV at runtime)').toBe(false)
      expect(cacheable('soundx/packs/sfx-core.bin'), 'prefix must be exactly sound/').toBe(false)
      expect(cacheable('asset-manifest.json')).toBe(false)
      expect(cacheable('packs/act1/town/scene.json')).toBe(true)
    })
  })
})
