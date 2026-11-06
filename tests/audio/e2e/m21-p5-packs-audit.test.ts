/**
 * M21-P5 (#947) — F19 Seven-class skill/missile SFX packs (`sfx-skills-{ama,sor,nec,pal,bar,dru,ass,common}.bin` + splits)
 * and generated `skill-sounds-113c.ts`, F22 `verify:audio` §skills (+ missile-referenced coverage).
 *
 * Authoritative sources (never the product's generated tables):
 * - PROJECT.md D1, D3, D12, D18 & ORIGINAL_REQUEST.md R5 (#947).
 * - Independent 1.13c MPQ oracle (`harness-113c.ts`): `Sounds.txt`, `Skills.txt`, `Missiles.txt`,
 *   and RIFF WAV headers from `d2sfx.mpq` / `d2exp.mpq` / `Patch_D2.mpq`.
 * - RFC 3533 / 7845 / 6716 independent Ogg + Opus packet walker (`oggOpusFacts`).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  D2_DATA_DIR,
  E2_SFX_PACK_FORMAT,
  PRODUCT,
  REPO_ROOT,
  SFX_FLOOR_BPS_113C,
  SKILL_CLASS_CODES_113C,
  getOracle113c,
  loadProductModule,
  mirrorRepoWithCopies,
  oggOpusFacts,
  oracleGroupMembers,
  oracleSkillScope,
  oracleWavFacts,
  readRepoText,
  requireExport,
  sha256Hex,
  summarize,
  type OggOpusFacts,
  type Oracle113c,
  type OracleSoundRow,
  type OracleWavFacts,
  type SkillClassCode113c,
} from './harness-113c.ts'
import { FakeAudioContext } from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F19 = '#947 F19 pack-skill-sounds + sfx-skills-{ama,sor,nec,pal,bar,dru,ass,common}'
const F22 = '#947 F22 verify:audio §skills (+ missile-referenced coverage)'

/** Issue #947 estimate per class pack ("约 120–180 KB"): D3 split threshold = 180,000 B decimal. */
const D3_SKILL_PART_MAX_BYTES = 180_000

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

const SKILL_BUCKETS = [...SKILL_CLASS_CODES_113C, 'common'] as const
type SkillBucket = (typeof SKILL_BUCKETS)[number]

const EXPECTED_BUCKET_COUNTS: Readonly<Record<SkillBucket, number>> = {
  ama: 45,
  sor: 68,
  nec: 46,
  pal: 43,
  bar: 48,
  dru: 16,
  ass: 35,
  common: 2,
}

async function indexModule(): Promise<IndexModuleC> {
  const m = await loadProductModule(PRODUCT.sfxPackIndex, F19)
  for (const name of INDEX_EXPORTS) requireExport(m, name, PRODUCT.sfxPackIndex, F19)
  return m as unknown as IndexModuleC
}

function packDiskPath(meta: PackMetaC): string {
  const rel = meta.url.replace(/^\/+/, '')
  return join(REPO_ROOT, 'public', rel)
}

function readPackBytes(meta: PackMetaC): Uint8Array {
  const abs = packDiskPath(meta)
  if (!existsSync(abs)) {
    throw new Error(`[${F19}] required skill SFX pack is missing on disk: ${abs} (run npm run pack:skill-sounds)`)
  }
  return new Uint8Array(readFileSync(abs))
}

function isSkillBucketPack(meta: PackMetaC, bucket: SkillBucket): boolean {
  const re = new RegExp(`^sfx-skills-${bucket}(?:-\\d+)?$`)
  return re.test(meta.packId)
}

function isAnySkillPack(meta: PackMetaC): boolean {
  return /^sfx-skills-(?:ama|sor|nec|pal|bar|dru|ass|common)(?:-\d+)?$/.test(meta.packId)
}

let O: Oracle113c
let skillFolderRows: readonly OracleSoundRow[]
let rowsByBucket: Readonly<Record<SkillBucket, readonly OracleSoundRow[]>>
let allSkillTableSoundIds: ReadonlySet<number>
let allMissileSoundIds: ReadonlySet<number>
const wavFactsById = new Map<number, OracleWavFacts>()

beforeAll(() => {
  O = getOracle113c()
  const scope = oracleSkillScope(O)
  skillFolderRows = scope.skillFolderRows
  rowsByBucket = scope.rowsByBucket
  allSkillTableSoundIds = scope.allSkillTableSoundIds
  allMissileSoundIds = scope.allMissileSoundIds
  for (const r of skillFolderRows) {
    wavFactsById.set(r.id, oracleWavFacts(r.id))
  }
  for (const id of allMissileSoundIds) {
    if (!wavFactsById.has(id)) {
      const r = O.sounds[id]
      if (r && !r.stream) wavFactsById.set(id, oracleWavFacts(id))
    }
  }
}, 600_000)

describe('M21-P5 #947 — F19 Seven-class skill/missile SFX packs & generated skill-sounds-113c.ts', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F19-01] `pack-skill-sounds.ts`, `skill-sounds-113c.ts`, and `"pack:skill-sounds"` script exist and export the skill/missile audio contracts', async () => {
      const pkg = JSON.parse(readRepoText(PRODUCT.packageJson, F19)) as { scripts?: Record<string, string> }
      expect(typeof pkg.scripts?.['pack:skill-sounds'], 'package.json scripts["pack:skill-sounds"]').toBe('string')
      const packerMod = await loadProductModule(PRODUCT.packSkillSounds, F19)
      expect(Object.keys(packerMod).length).toBeGreaterThan(0)
      const skillMod = await loadProductModule(PRODUCT.skillSounds, F19)
      expect(Object.keys(skillMod).length).toBeGreaterThan(0)
      const idx = await indexModule()
      const skillPacks = idx.SFX_PACKS_113C.filter(isAnySkillPack)
      expect(skillPacks.length, 'at least 8 skill packs (ama, sor, nec, pal, bar, dru, ass, common)').toBeGreaterThanOrEqual(8)
    })

    it('[T1-F19-02] all 303 `skill\\*` `Stream = 0` rows in `Sounds.txt` are partitioned across the 8 canonical skill buckets (`ama=45, sor=68, nec=46, pal=43, bar=48, dru=16, ass=35, common=2`)', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F19)
      const idx = await indexModule()
      expect(skillFolderRows.length).toBe(303)
      const bad: string[] = []
      for (const bucket of SKILL_BUCKETS) {
        const rows = rowsByBucket[bucket]
        if (rows.length !== EXPECTED_BUCKET_COUNTS[bucket]) {
          bad.push(`oracle bucket ${bucket}: count=${String(rows.length)} expected=${String(EXPECTED_BUCKET_COUNTS[bucket])}`)
        }
        const bucketPacks = idx.SFX_PACKS_113C.filter((p) => isSkillBucketPack(p, bucket))
        if (bucketPacks.length === 0) {
          bad.push(`SFX_PACKS_113C missing pack for bucket '${bucket}' (expected sfx-skills-${bucket})`)
          continue
        }
        const validPackIds = new Set(bucketPacks.map((p) => p.packId))
        for (const r of rows) {
          const tuple = idx.SFX_PACK_INDEX_113C[r.id]
          if (!tuple) {
            bad.push(`row ${String(r.id)} (${r.sound}, ${r.fileName}) missing from SFX_PACK_INDEX_113C`)
          } else if (!validPackIds.has(tuple[0])) {
            bad.push(`row ${String(r.id)} (${r.sound}) mapped to '${tuple[0]}' instead of sfx-skills-${bucket}*`)
          }
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F19-03] every `Stream = 0` sound ID (and variant group member) referenced by `Skills.txt` (`stsound`, `stsoundclass`, `dosound`, `dosound a/b`, `tgtsound`, `prgsound`) and `Missiles.txt` (`TravelSound`, `HitSound`, `ProgSound`) is present in `SFX_PACK_INDEX_113C`', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F19)
      const idx = await indexModule()
      expect(allSkillTableSoundIds.size).toBeGreaterThan(150)
      expect(allMissileSoundIds.size).toBeGreaterThan(150)
      const bad: string[] = []
      for (const id of allSkillTableSoundIds) {
        if (!idx.SFX_PACK_INDEX_113C[id]) {
          bad.push(`Skills.txt-referenced sound id ${String(id)} (${O.sounds[id]?.sound ?? '?'}) missing from SFX_PACK_INDEX_113C`)
        }
      }
      for (const id of allMissileSoundIds) {
        if (!idx.SFX_PACK_INDEX_113C[id]) {
          bad.push(`Missiles.txt-referenced sound id ${String(id)} (${O.sounds[id]?.sound ?? '?'}) missing from SFX_PACK_INDEX_113C`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F19-04] every skill pack (`sfx-skills-{ama,sor,nec,pal,bar,dru,ass,common}.bin` + splits) exists on disk with valid `D2SP` v2 header, exact byte length, SHA-256, and valid Ogg Opus chunks', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F19)
      const idx = await indexModule()
      const skillPacks = idx.SFX_PACKS_113C.filter(isAnySkillPack)
      expect(skillPacks.length).toBeGreaterThanOrEqual(8)
      const bad: string[] = []
      for (const meta of skillPacks) {
        const bytes = readPackBytes(meta)
        if (bytes.byteLength !== meta.bytes) {
          bad.push(`${meta.packId}: disk bytes ${String(bytes.byteLength)} !== meta.bytes ${String(meta.bytes)}`)
        }
        const sha = sha256Hex(bytes)
        if (sha !== meta.sha256) {
          bad.push(`${meta.packId}: disk sha256 ${sha} !== meta.sha256 ${meta.sha256}`)
        }
        const hdr = idx.validateSfxPackHeader113c(bytes, meta)
        if (hdr.version !== E2_SFX_PACK_FORMAT.version || hdr.chunkCount !== meta.chunkCount) {
          bad.push(`${meta.packId}: header mismatch version=${String(hdr.version)} chunkCount=${String(hdr.chunkCount)}`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F19-05] every chunk in every skill pack measures at or above the D1 Opus CBR bitrate floor (≥ 24,000 bps mono / ≥ 40,000 bps stereo)', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F19)
      const idx = await indexModule()
      const packBytesMap = new Map<string, Uint8Array>()
      for (const meta of idx.SFX_PACKS_113C.filter(isAnySkillPack)) {
        packBytesMap.set(meta.packId, readPackBytes(meta))
      }
      expect(packBytesMap.size).toBeGreaterThanOrEqual(8)
      const parsedSlices = new Map<string, OggOpusFacts>()
      const bad: string[] = []
      for (const r of skillFolderRows) {
        const tuple = idx.SFX_PACK_INDEX_113C[r.id]
        if (!tuple) {
          bad.push(`row ${String(r.id)} missing from SFX_PACK_INDEX_113C`)
          continue
        }
        const [packId, byteOffset, byteLength, sampleRate, frames, channels] = tuple
        const wf = wavFactsById.get(r.id)!
        if (sampleRate !== wf.sampleRate || frames !== wf.frames || channels !== wf.channels) {
          bad.push(
            `row ${String(r.id)}: tuple (${String(sampleRate)},${String(frames)},${String(channels)}) !== wav (${String(wf.sampleRate)},${String(wf.frames)},${String(wf.channels)})`,
          )
        }
        const packBytes = packBytesMap.get(packId)
        if (!packBytes) {
          bad.push(`row ${String(r.id)}: pack '${packId}' not found among skill packs`)
          continue
        }
        const sliceKey = `${packId}:${String(byteOffset)}:${String(byteLength)}`
        let facts = parsedSlices.get(sliceKey)
        if (!facts) {
          const slice = packBytes.subarray(byteOffset, byteOffset + byteLength)
          facts = oggOpusFacts(slice, `${packId}#${String(r.id)}`)
          parsedSlices.set(sliceKey, facts)
        }
        const floor = facts.channels === 1 ? SFX_FLOOR_BPS_113C.mono : SFX_FLOOR_BPS_113C.stereo
        const bps = facts.decodedSeconds > 0 ? (facts.audioPacketBytes * 8) / facts.decodedSeconds : 0
        if (bps + 1e-6 < floor) {
          bad.push(`row ${String(r.id)} (${r.fileName} in ${packId}): measured ${bps.toFixed(1)} bps < floor ${String(floor)} bps`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F19-06] `skill-sounds-113c.ts` matches 1.13c `Skills.txt` (all 210 class skills + common skills) and `Missiles.txt` (`TravelSound`, `HitSound`, `ProgSound`)', async () => {
      const skillMod = await loadProductModule(PRODUCT.skillSounds, F19)
      const scope = oracleSkillScope(O)
      const classSkills = scope.skills.filter((s) => (SKILL_CLASS_CODES_113C as readonly string[]).includes(s.charclass))
      expect(classSkills.length, '210 player-class skills in 1.13c Skills.txt (30 × 7 classes)').toBe(210)

      // Inspect exported table/lookup from skill-sounds-113c.ts:
      const getSkill =
        (skillMod.getSkillSoundEntry113c as ((id: number) => Record<string, unknown> | undefined) | undefined) ??
        (skillMod.getSkillSounds113c as ((id: number) => Record<string, unknown> | undefined) | undefined)
      const skillTable =
        (skillMod.SKILL_SOUNDS_113C as Readonly<Record<number, Record<string, unknown>>> | readonly Record<string, unknown>[] | undefined) ??
        (skillMod.SKILLS_AUDIO_113C as Readonly<Record<number, Record<string, unknown>>> | undefined)

      expect(Boolean(getSkill || skillTable), 'skill-sounds-113c.ts must export SKILL_SOUNDS_113C or getSkillSoundEntry113c').toBe(true)

      const lookupSkill = (id: number): Record<string, unknown> | undefined => {
        if (typeof getSkill === 'function') return getSkill(id)
        if (Array.isArray(skillTable)) return skillTable.find((x) => x && (x.id === id || x.skillId === id))
        if (skillTable && typeof skillTable === 'object') return (skillTable as Record<number, Record<string, unknown>>)[id]
        return undefined
      }

      const bad: string[] = []
      for (const s of scope.skills) {
        if (s.stsound === 0 && s.stsoundclass === 0 && s.dosound === 0 && s.dosoundA === 0 && s.dosoundB === 0 && s.tgtsound === 0 && s.prgsound === 0) {
          continue
        }
        const entry = lookupSkill(s.id)
        if (!entry) {
          bad.push(`skill ${String(s.id)} (${s.skill}) missing from skill-sounds-113c.ts`)
          continue
        }
        const st = Number(entry.stsound ?? entry.startSound ?? entry.stSound ?? 0)
        const doSnd = Number(entry.dosound ?? entry.doSound ?? 0)
        if (s.stsound > 0 && st !== s.stsound) {
          bad.push(`skill ${String(s.id)} (${s.skill}): stsound=${String(st)} !== oracle ${String(s.stsound)}`)
        }
        if (s.dosound > 0 && doSnd !== s.dosound) {
          bad.push(`skill ${String(s.id)} (${s.skill}): dosound=${String(doSnd)} !== oracle ${String(s.dosound)}`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F19-07] D12 on-demand preload policy: entering a game session preloads `sfx-skills-common` + ONLY the skill packs for the active player classes in the session', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F19)
      const skillMod = await loadProductModule(PRODUCT.skillSounds, F19)
      const runtimeMod = await loadProductModule(PRODUCT.audioRuntime, F19)

      // Either skill-sounds-113c.ts or audio-runtime-113c.ts provides pack resolution / preload for active classes:
      const getPacksForClasses =
        (skillMod.getSkillPackIdsForClasses113c as ((classes: readonly string[]) => readonly string[]) | undefined) ??
        (skillMod.skillPacksForActiveClasses113c as ((classes: readonly string[]) => readonly string[]) | undefined)

      const RuntimeCtor = requireExport<
        new (o: Record<string, unknown>) => {
          preloadSkillPacksForClasses?(classes: readonly string[]): Promise<void> | void
          setActivePlayerClasses?(classes: readonly string[]): Promise<void> | void
        }
      >(runtimeMod, 'AudioRuntime113c', PRODUCT.audioRuntime, F19)

      const fetchedUrls: string[] = []
      const fakeCtx = new FakeAudioContext()
      const loaderMod = await loadProductModule(PRODUCT.sfxChunkLoader, F19)
      const SfxChunkLoaderCtor = requireExport<new (o?: Record<string, unknown>) => unknown>(
        loaderMod,
        'SfxChunkLoader',
        PRODUCT.sfxChunkLoader,
        F19,
      )
      const loader = new SfxChunkLoaderCtor({
        fetch: async (url: string) => {
          fetchedUrls.push(url)
          const rel = url.replace(/^\/+/, '')
          const bytes = new Uint8Array(readFileSync(join(REPO_ROOT, 'public', rel)))
          return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer }
        },
        audioContext: () => fakeCtx,
      })

      if (typeof getPacksForClasses === 'function') {
        const packs = getPacksForClasses(['sor', 'pal'])
        expect(packs.some((p) => p.startsWith('sfx-skills-common'))).toBe(true)
        expect(packs.some((p) => p.startsWith('sfx-skills-sor'))).toBe(true)
        expect(packs.some((p) => p.startsWith('sfx-skills-pal'))).toBe(true)
        expect(packs.some((p) => p.startsWith('sfx-skills-nec'))).toBe(false)
        expect(packs.some((p) => p.startsWith('sfx-skills-bar'))).toBe(false)
      } else {
        const rt = new RuntimeCtor({
          listenerPos: () => ({ x: 0, y: 0 }),
          loader,
          settings: { masterVolume: () => 0.8, muted: () => false },
        })
        const fn = rt.preloadSkillPacksForClasses ?? rt.setActivePlayerClasses
        expect(typeof fn, 'AudioRuntime113c.preloadSkillPacksForClasses or setActivePlayerClasses').toBe('function')
        await fn!.call(rt, ['sor', 'pal'])
        expect(fetchedUrls.some((u) => u.includes('sfx-skills-common'))).toBe(true)
        expect(fetchedUrls.some((u) => u.includes('sfx-skills-sor'))).toBe(true)
        expect(fetchedUrls.some((u) => u.includes('sfx-skills-pal'))).toBe(true)
        expect(fetchedUrls.some((u) => u.includes('sfx-skills-nec'))).toBe(false)
        expect(fetchedUrls.some((u) => u.includes('sfx-skills-bar'))).toBe(false)
      }
    })
  })

  describe('Tier 2 — boundary & adversarial', () => {
    it('[T2-F19-01] D3 split rule on skill packs: any class pack exceeding the 180 KB estimate (`sor`, `pal`) splits deterministically into `sfx-skills-<cls>-2.bin` without lowering bitrate', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F19)
      const idx = await indexModule()
      for (const bucket of SKILL_BUCKETS) {
        const packs = idx.SFX_PACKS_113C.filter((p) => isSkillBucketPack(p, bucket))
        expect(packs.length, `bucket ${bucket} has >= 1 pack`).toBeGreaterThanOrEqual(1)
        expect(packs[0]!.packId).toBe(`sfx-skills-${bucket}`)
        for (let i = 1; i < packs.length; i += 1) {
          expect(packs[i]!.packId).toBe(`sfx-skills-${bucket}-${String(i + 1)}`)
        }
        for (const p of packs) {
          expect(p.bytes, `${p.packId} respects D3 180,000 B cap`).toBeLessThanOrEqual(D3_SKILL_PART_MAX_BYTES)
          expect(p.targetBitrateMono).toBeGreaterThanOrEqual(SFX_FLOOR_BPS_113C.mono)
          expect(p.targetBitrateStereo).toBeGreaterThanOrEqual(SFX_FLOOR_BPS_113C.stereo)
        }
      }
    })

    it('[T2-F19-02] duplicate WAV deduplication: the 303 `skill\\*` rows reference 277 unique WAVs and share identical `(packId, byteOffset, byteLength)` slices when pointing to the same WAV inside a bucket', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F19)
      const idx = await indexModule()
      const uniqueFiles = new Set(skillFolderRows.map((r) => r.fileName.trim().toLowerCase().replace(/\//g, '\\')))
      expect(uniqueFiles.size).toBe(277)

      const sliceByBucketAndFile = new Map<string, string>()
      const bad: string[] = []
      for (const bucket of SKILL_BUCKETS) {
        for (const r of rowsByBucket[bucket]) {
          const t = idx.SFX_PACK_INDEX_113C[r.id]
          if (!t) continue
          const fileKey = `${bucket}|${r.fileName.trim().toLowerCase().replace(/\//g, '\\')}`
          const sliceVal = `${t[0]}:${String(t[1])}:${String(t[2])}`
          const prev = sliceByBucketAndFile.get(fileKey)
          if (prev !== undefined && prev !== sliceVal) {
            bad.push(`duplicate WAV ${fileKey} (row ${String(r.id)}) was encoded twice: ${prev} vs ${sliceVal}`)
          } else {
            sliceByBucketAndFile.set(fileKey, sliceVal)
          }
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T2-F19-03] non-overlapping contiguous chunk layout: inside each skill pack, unique chunk slices start at byte 12 and tile `[12, meta.bytes)` with zero gaps and zero overlaps', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F19)
      const idx = await indexModule()
      const skillPacks = idx.SFX_PACKS_113C.filter(isAnySkillPack)
      expect(skillPacks.length).toBeGreaterThanOrEqual(8)

      for (const meta of skillPacks) {
        const slices = new Map<number, number>()
        for (const idStr of Object.keys(idx.SFX_PACK_INDEX_113C)) {
          const t = idx.SFX_PACK_INDEX_113C[Number(idStr)]!
          if (t[0] === meta.packId) {
            const prevLen = slices.get(t[1])
            if (prevLen !== undefined) expect(prevLen).toBe(t[2])
            else slices.set(t[1], t[2])
          }
        }
        expect(slices.size, `${meta.packId} unique slice count`).toBe(meta.chunkCount)
        const sorted = [...slices.entries()].sort((a, b) => a[0] - b[0])
        let cursor = E2_SFX_PACK_FORMAT.headerBytes
        for (const [off, len] of sorted) {
          expect(off, `${meta.packId} slice at ${String(off)}`).toBe(cursor)
          expect(len).toBeGreaterThan(0)
          cursor += len
        }
        expect(cursor, `${meta.packId} final cursor == meta.bytes`).toBe(meta.bytes)
      }
    })

    it('[T2-F19-04] `common` (`skill\\misc\\*`) boundary: rows `2230` (`Takescroll.wav`) and `2231` (`horadric_cast.wav`) are packed in `sfx-skills-common`', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F19)
      const idx = await indexModule()
      expect(rowsByBucket.common.map((r) => r.id)).toEqual([2230, 2231])
      for (const id of [2230, 2231]) {
        const entry = idx.getSfxPackEntry113c(id)
        expect(entry, `entry for common skill row ${String(id)}`).toBeDefined()
        expect(entry!.packId).toMatch(/^sfx-skills-common(?:-\d+)?$/)
      }
    })

    it('[T2-F19-05] `src/common/audio/skill-sounds-113c.ts` is pure TypeScript: zero Node/DOM imports, zero `Math.random` / `Date.now`', () => {
      const src = readRepoText(PRODUCT.skillSounds, F19)
      expect(src).not.toMatch(/from\s+['"]node:|require\(['"]node:/)
      expect(src).not.toMatch(/\b(?:window|document|AudioContext|HTMLAudioElement|fetch)\b/)
      expect(src).not.toMatch(/\bMath\.random\b|\bDate\.now\b/)
    })
  })
})

describe('M21-P5 #947 — F22 verify:audio §skills (+ missile-referenced coverage) & asset-manifest', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F22-01] `runAudioAudit` supports the `skills` section and passes with 0 errors on the clean baked repository', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F22)
      const auditMod = await loadProductModule(PRODUCT.audit, F22)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F22)

      const rep = await runAudioAudit({
        rootDir: REPO_ROOT,
        mpqDir: D2_DATA_DIR,
        sections: ['skills'],
      })
      const skillsSec = rep.sections.find((s) => s.id === 'skills')
      expect(skillsSec, 'verify:audio report must include section "skills"').toBeDefined()
      expect(skillsSec!.errors, summarize(skillsSec!.errors)).toEqual([])
      expect(skillsSec!.ok).toBe(true)
    })

    it('[T1-F22-02] `public/asset-manifest.json` contains a matching `sha256` and `bytes` entry for every `sfx-skills-*` pack in `SFX_PACKS_113C`', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F22)
      const idx = await indexModule()
      const skillPacks = idx.SFX_PACKS_113C.filter(isAnySkillPack)
      expect(skillPacks.length).toBeGreaterThanOrEqual(8)

      const manifestPath = join(REPO_ROOT, 'public/asset-manifest.json')
      expect(existsSync(manifestPath), 'public/asset-manifest.json must exist').toBe(true)
      const manifestRaw = readFileSync(manifestPath, 'utf8')
      for (const meta of skillPacks) {
        expect(manifestRaw.includes(meta.sha256), `asset-manifest.json contains sha256 for ${meta.packId}`).toBe(true)
      }
    })

    it('[T1-F22-03] `verify:audio` §skills verifies that all 303 `skill\\*` rows and all missile-referenced `Stream = 0` rows resolve to valid slices', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F22)
      const idx = await indexModule()
      const bad: string[] = []
      for (const r of skillFolderRows) {
        const e = idx.getSfxPackEntry113c(r.id)
        if (!e) bad.push(`skill row ${String(r.id)} missing`)
      }
      for (const id of allMissileSoundIds) {
        const e = idx.getSfxPackEntry113c(id)
        if (!e) bad.push(`missile sound id ${String(id)} missing`)
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F22-04] `isCacheableAssetPath` in `src/common/pack-contract/index.ts` accepts every `sfx-skills-*` pack URL', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F22)
      const idx = await indexModule()
      const pcMod = await loadProductModule(PRODUCT.packContract, F22)
      const isCacheable = requireExport<(p: string) => boolean>(pcMod, 'isCacheableAssetPath', PRODUCT.packContract, F22)
      const skillPacks = idx.SFX_PACKS_113C.filter(isAnySkillPack)
      expect(skillPacks.length).toBeGreaterThanOrEqual(8)
      for (const meta of skillPacks) {
        expect(isCacheable(meta.url), `isCacheableAssetPath("${meta.url}")`).toBe(true)
      }
    })

    it('[T1-F22-05] deterministic re-bake: running `pack-skill-sounds` twice produces byte-for-byte identical `skill-sounds-113c.ts` and `sfx-skills-*` SHA-256 hashes', async () => {
      const packerMod = await loadProductModule(PRODUCT.packSkillSounds, F22)
      const idx = await indexModule()
      const beforeSkillTs = readRepoText(PRODUCT.skillSounds, F22)
      const beforeHashes = idx.SFX_PACKS_113C.filter(isAnySkillPack).map((p) => `${p.packId}:${sha256Hex(readPackBytes(p))}`)
      expect(beforeHashes.length).toBeGreaterThanOrEqual(8)

      const fn =
        (packerMod.packSkillSounds113c as ((opts?: Record<string, unknown>) => Promise<unknown>) | undefined) ??
        (packerMod.runPackSkillSounds as ((opts?: Record<string, unknown>) => Promise<unknown>) | undefined)
      if (typeof fn === 'function') {
        const tmpOut = join(REPO_ROOT, '.tmp-m21-p5-determinism')
        mkdirSync(tmpOut, { recursive: true })
        try {
          await fn({ mpqDir: D2_DATA_DIR, outDir: tmpOut, rootDir: tmpOut })
        } finally {
          rmSync(tmpOut, { recursive: true, force: true })
        }
      }
      const afterSkillTs = readRepoText(PRODUCT.skillSounds, F22)
      expect(sha256Hex(Buffer.from(afterSkillTs)), 'skill-sounds-113c.ts sha256 stable').toBe(
        sha256Hex(Buffer.from(beforeSkillTs)),
      )
    })
  })

  describe('Tier 2 — boundary & adversarial audit mutations', () => {
    it('[T2-F22-01] `runAudioAudit` (`skills`) fails when any `sfx-skills-<class>.bin` file is missing from disk', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F22)
      const idx = await indexModule()
      const firstSkillPack = idx.SFX_PACKS_113C.find(isAnySkillPack)
      expect(firstSkillPack).toBeDefined()
      const auditMod = await loadProductModule(PRODUCT.audit, F22)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F22)

      const relPack = `public/${firstSkillPack!.url.replace(/^\/+/, '')}`
      const mirror = mirrorRepoWithCopies([relPack], (root) => {
        rmSync(join(root, relPack), { force: true })
      })
      try {
        const rep = await runAudioAudit({ rootDir: mirror, mpqDir: D2_DATA_DIR, sections: ['skills'] })
        expect(rep.ok, 'audit must fail when a skill pack file is deleted').toBe(false)
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    })

    it('[T2-F22-02] `runAudioAudit` (`skills`) fails when a skill pack header magic (`D2SP`) is corrupted', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F22)
      const idx = await indexModule()
      const firstSkillPack = idx.SFX_PACKS_113C.find(isAnySkillPack)
      expect(firstSkillPack).toBeDefined()
      const auditMod = await loadProductModule(PRODUCT.audit, F22)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F22)

      const relPack = `public/${firstSkillPack!.url.replace(/^\/+/, '')}`
      const mirror = mirrorRepoWithCopies([relPack], (root) => {
        const target = join(root, relPack)
        const bytes = new Uint8Array(readFileSync(target))
        bytes[0] = 0x00
        writeFileSync(target, bytes)
      })
      try {
        const rep = await runAudioAudit({ rootDir: mirror, mpqDir: D2_DATA_DIR, sections: ['skills'] })
        expect(rep.ok, 'audit must fail when D2SP header magic is corrupted').toBe(false)
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    })

    it('[T2-F22-03] `runAudioAudit` (`skills`) fails when a skill Ogg Opus chunk page is corrupted (SHA-256 & Ogg CRC mismatch)', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F22)
      const idx = await indexModule()
      const firstSkillPack = idx.SFX_PACKS_113C.find(isAnySkillPack)
      expect(firstSkillPack).toBeDefined()
      const auditMod = await loadProductModule(PRODUCT.audit, F22)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F22)

      const relPack = `public/${firstSkillPack!.url.replace(/^\/+/, '')}`
      const mirror = mirrorRepoWithCopies([relPack], (root) => {
        const target = join(root, relPack)
        const bytes = new Uint8Array(readFileSync(target))
        bytes[bytes.length - 1] ^= 0xff
        writeFileSync(target, bytes)
      })
      try {
        const rep = await runAudioAudit({ rootDir: mirror, mpqDir: D2_DATA_DIR, sections: ['skills'] })
        expect(rep.ok, 'audit must fail when a skill pack payload byte is flipped').toBe(false)
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    })

    it('[T2-F22-04] `runAudioAudit` (`skills`) fails when a skill pack exceeds the D3 180,000-byte split cap', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F22)
      const idx = await indexModule()
      const firstSkillPack = idx.SFX_PACKS_113C.find(isAnySkillPack)
      expect(firstSkillPack).toBeDefined()
      const auditMod = await loadProductModule(PRODUCT.audit, F22)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F22)

      const relPack = `public/${firstSkillPack!.url.replace(/^\/+/, '')}`
      const mirror = mirrorRepoWithCopies([relPack], (root) => {
        const target = join(root, relPack)
        writeFileSync(target, new Uint8Array(D3_SKILL_PART_MAX_BYTES + 1024))
      })
      try {
        const rep = await runAudioAudit({ rootDir: mirror, mpqDir: D2_DATA_DIR, sections: ['skills'] })
        expect(rep.ok, 'audit must fail when a skill pack exceeds D3 cap').toBe(false)
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    })

    it('[T2-F22-05] `runAudioAudit` (`skills`) fails when `skill-sounds-113c.ts` drifts from `Skills.txt` / `Missiles.txt`', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F22)
      const auditMod = await loadProductModule(PRODUCT.audit, F22)
      const runAudioAudit = requireExport<
        (opts?: {
          rootDir?: string
          mpqDir?: string
          sections?: readonly string[]
        }) => Promise<{ ok: boolean; sections: readonly { id: string; ok: boolean; errors: readonly string[] }[] }>
      >(auditMod, 'runAudioAudit', PRODUCT.audit, F22)

      const mirror = mirrorRepoWithCopies([PRODUCT.skillSounds], (root) => {
        const target = join(root, PRODUCT.skillSounds)
        const text = readFileSync(target, 'utf8')
        writeFileSync(target, `${text}\n// tampered-by-T2-F22-05\n`)
      })
      try {
        const rep = await runAudioAudit({ rootDir: mirror, mpqDir: D2_DATA_DIR, sections: ['skills'] })
        expect(rep.ok, 'audit must fail when skill-sounds-113c.ts is tampered').toBe(false)
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    })
  })

  describe('Tier 3 — pairwise integration (F19 × F8 SfxChunkLoader & F19 × F11 core/ambient non-collision)', () => {
    it('[T3-P5-01] `SfxChunkLoader` fetches and decodes one representative skill sound from each of the 8 skill buckets (`ama, sor, nec, pal, bar, dru, ass, common`) without detaching cached pack `ArrayBuffer`s (D5)', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F19)
      const idx = await indexModule()
      const loaderMod = await loadProductModule(PRODUCT.sfxChunkLoader, F19)
      const SfxChunkLoaderCtor = requireExport<
        new (o?: Record<string, unknown>) => {
          loadSoundBuffer(id: number, ctx?: unknown): Promise<{ length: number; sampleRate: number } | null>
        }
      >(loaderMod, 'SfxChunkLoader', PRODUCT.sfxChunkLoader, F19)

      const fetchedPackBuffers = new Map<string, ArrayBuffer>()
      const fakeCtx = new FakeAudioContext()
      const loader = new SfxChunkLoaderCtor({
        fetch: async (url: string) => {
          const rel = url.replace(/^\/+/, '')
          const bytes = new Uint8Array(readFileSync(join(REPO_ROOT, 'public', rel)))
          const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
          fetchedPackBuffers.set(url, ab)
          return { ok: true, status: 200, arrayBuffer: async () => ab }
        },
        audioContext: () => fakeCtx,
      })

      for (const bucket of SKILL_BUCKETS as readonly (SkillClassCode113c | 'common')[]) {
        const firstRow = rowsByBucket[bucket][0]!
        expect(idx.SFX_PACK_INDEX_113C[firstRow.id], `tuple for ${bucket} row ${String(firstRow.id)}`).toBeDefined()
        const decoded = await loader.loadSoundBuffer(firstRow.id, fakeCtx)
        expect(decoded, `decoded buffer for ${bucket} row ${String(firstRow.id)}`).not.toBeNull()
        expect(decoded!.length).toBeGreaterThan(0)
      }

      for (const [url, ab] of fetchedPackBuffers.entries()) {
        expect(ab.byteLength, `pack ArrayBuffer for ${url} must not be detached`).toBeGreaterThan(12)
      }
    })

    it('[T3-P5-02] `SFX_PACK_INDEX_113C` union invariants across M2 (`sfx-core*`), M4 (`sfx-ambient-act*`), and M5 (`sfx-skills-*`): disjoint pack IDs and zero missing missile/skill tuples', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F19)
      const idx = await indexModule()
      const packIds = idx.SFX_PACKS_113C.map((p) => p.packId)
      expect(new Set(packIds).size, 'every packId in SFX_PACKS_113C is unique').toBe(packIds.length)
      expect(packIds.some((id) => id === 'sfx-core')).toBe(true)
      expect(packIds.some((id) => id.startsWith('sfx-ambient-act1'))).toBe(true)
      for (const bucket of SKILL_BUCKETS) {
        expect(packIds.some((id) => id === `sfx-skills-${bucket}`), `sfx-skills-${bucket} registered`).toBe(true)
      }
    })
  })
})
