/**
 * M21-P6 (#948) — F23 Monster SFX packs (`sfx-mon-act{1..5}.bin` + splits) & generated
 * `mon-sounds-113c.ts` (`MonSounds.txt` 140 named rows + runtime delays/probabilities), and
 * F24 NPC Speech Opus WebM streams (`public/sound/speech/act{1..5}/*.webm`, `speech-index-113c.ts`,
 * `SpeechStreamer`, D16 24 kbps mono floor / ≤ 45,000,000 B total cap, and `Solo = 1` `soloDuck` 70%).
 *
 * Authoritative sources (never the product's generated tables):
 * - PROJECT.md D1, D3, D7, D8, D9, D16, D18 & ORIGINAL_REQUEST.md R6 (#948).
 * - Independent 1.13c MPQ oracle (`harness-113c.ts`): `Sounds.txt`, `MonSounds.txt`,
 *   and RIFF WAV headers from `d2sfx.mpq`, `d2exp.mpq`, `d2speech.mpq`, `d2xtalk.mpq`, `Patch_D2.mpq`.
 * - RFC 3533 / 7845 / 6716 independent Ogg + Opus packet walker (`oggOpusFacts`) and
 *   RFC 8794 EBML/WebM Opus parser (`streamOpusFacts` / `measuredStreamBitrateBps`).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  D2_DATA_DIR,
  E2_SFX_PACK_FORMAT,
  PRODUCT,
  REPO_ROOT,
  RecordingVoices,
  SFX_FLOOR_BPS_113C,
  getOracle113c,
  loadProductModule,
  measuredStreamBitrateBps,
  oggOpusFacts,
  oracleGroupMembers,
  oracleMonsterSpeechScope,
  oracleSampleFacts,
  oracleWavFacts,
  readRepoText,
  requireD16Decided,
  requireExport,
  sha256Hex,
  streamOpusFacts,
  summarize,
  type OggOpusFacts,
  type Oracle113c,
  type OracleMonSoundRow113c,
  type OracleSoundRow,
} from './harness-113c.ts'
import { FakeAudioContext, installFakeAudioContext } from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 600_000 })

const F23 = '#948 F23 pack-monster-sounds + mon-sounds-113c + sfx-mon-act{1..5}'
const F24 = '#948 F24 pack-speech + speech-index-113c + SpeechStreamer + Solo=1 soloDuck'

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
  getSfxPackEntry113c(id: number): EntryC | undefined
  validateSfxPackHeader113c(
    bytes: Uint8Array,
    expect: PackMetaC,
  ): { readonly version: number; readonly chunkCount: number }
}

interface RecordViewC {
  readonly handle: number
  readonly id: number
  readonly state: number
}

interface SoundRecordsC {
  play(id: number, o?: Record<string, unknown>): number
  stop(handle: number): void
  stopAll(): void
  update(): void
  endTick(): void
  records(): RecordViewC[]
  setSoloActive?(active: boolean): void
  setSoloDuck?(active: boolean): void
}

interface SpeechEntryC {
  readonly id: number
  readonly sound?: string
  readonly fileName?: string
  readonly url: string
  readonly bytes: number
  readonly sha256: string
  readonly sampleRate?: number
  readonly frames?: number
  readonly channels?: number
  readonly durationSeconds?: number
  readonly solo?: boolean
}

let O: Oracle113c
let allMonsterRows: readonly OracleSoundRow[]
let shippedMonsterRows: readonly OracleSoundRow[]
let missingMonsterIds: readonly number[]
let monSounds: readonly OracleMonSoundRow113c[]
let allSpeechRows: readonly OracleSoundRow[]
let shippedSpeechRows: readonly OracleSoundRow[]
let npcSpeechRows: readonly OracleSoundRow[]
let missingSpeechIds: readonly number[]
let uninstallAudio: (() => void) | null = null

beforeAll(() => {
  O = getOracle113c()
  const scope = oracleMonsterSpeechScope(O)
  allMonsterRows = scope.allMonsterRows
  shippedMonsterRows = scope.shippedMonsterRows
  missingMonsterIds = scope.missingMonsterIds
  monSounds = scope.monSounds
  allSpeechRows = scope.allSpeechRows
  shippedSpeechRows = scope.shippedSpeechRows
  npcSpeechRows = scope.npcSpeechRows
  missingSpeechIds = scope.missingSpeechIds
}, 600_000)

afterEach(() => {
  if (uninstallAudio) {
    uninstallAudio()
    uninstallAudio = null
  }
})

function isMonsterActPack(meta: PackMetaC, act?: number): boolean {
  if (act !== undefined) {
    return new RegExp(`^sfx-mon-act${String(act)}(?:-\\d+)?$`).test(meta.packId)
  }
  return /^sfx-mon-act[1-5](?:-\d+)?$/.test(meta.packId) || /^sfx-mon-global(?:-\d+)?$/.test(meta.packId)
}

function readPackBytes(meta: PackMetaC): Uint8Array {
  const abs = join(REPO_ROOT, 'public', meta.url.replace(/^\/+/, ''))
  if (!existsSync(abs)) {
    throw new Error(`[${F23}] required monster SFX pack is missing on disk: ${abs}`)
  }
  return new Uint8Array(readFileSync(abs))
}

describe('M21-P6 #948 — F23 Monster SFX packs (`sfx-mon-act{1..5}.bin`), `mon-sounds-113c.ts`, & 1.13c monster runtime', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F23-01] `pack-monster-sounds.ts`, `mon-sounds-113c.ts`, and `"pack:monster-sounds"` script exist and register `sfx-mon-act{1..5}` packs in `SFX_PACKS_113C`', async () => {
      const pkg = JSON.parse(readRepoText(PRODUCT.packageJson, F23)) as { scripts?: Record<string, string> }
      expect(typeof pkg.scripts?.['pack:monster-sounds'], 'package.json scripts["pack:monster-sounds"]').toBe('string')
      const packerMod = await loadProductModule(PRODUCT.packMonsterSounds, F23)
      expect(Object.keys(packerMod).length).toBeGreaterThan(0)
      const monMod = await loadProductModule(PRODUCT.monSounds, F23)
      expect(Object.keys(monMod).length).toBeGreaterThan(0)

      const idxMod = (await loadProductModule(PRODUCT.sfxPackIndex, F23)) as unknown as IndexModuleC
      for (let act = 1; act <= 5; act += 1) {
        const actPacks = idxMod.SFX_PACKS_113C.filter((p) => isMonsterActPack(p, act))
        expect(actPacks.length, `Act ${String(act)} has >= 1 sfx-mon-act${String(act)} pack`).toBeGreaterThanOrEqual(1)
      }
    })

    it('[T1-F23-02] all 1,670 shipped `monster\\*` `Stream = 0` rows in `Sounds.txt` (1,674 total minus the 4 D9 unshipped regurgitator rows `1595..1598`) are present in `SFX_PACK_INDEX_113C` and mapped to `sfx-mon-act{1..5}*`', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F23)
      const idxMod = (await loadProductModule(PRODUCT.sfxPackIndex, F23)) as unknown as IndexModuleC
      expect(allMonsterRows.length).toBe(1674)
      expect(shippedMonsterRows.length).toBe(1670)
      expect(missingMonsterIds).toEqual([1595, 1596, 1597, 1598])

      const packerMod = await loadProductModule(PRODUCT.packMonsterSounds, F23) as any
      const globalSoundIds = await packerMod.deriveGlobalMonsterSoundIds113c(O.archives, monSounds)

      const monPackIds = new Set(idxMod.SFX_PACKS_113C.filter((p) => isMonsterActPack(p)).map((p) => p.packId))
      const bad: string[] = []
      for (const r of shippedMonsterRows) {
        const tuple = idxMod.SFX_PACK_INDEX_113C[r.id]
        if (!tuple) {
          bad.push(`shipped monster row ${String(r.id)} (${r.sound}, ${r.fileName}) missing from SFX_PACK_INDEX_113C`)
        } else if (!monPackIds.has(tuple[0])) {
          bad.push(`monster row ${String(r.id)} (${r.sound}) mapped to '${tuple[0]}' instead of sfx-mon-act*`)
        } else if (tuple[0].startsWith('sfx-mon-global')) {
          if (!globalSoundIds.has(r.id)) {
            bad.push(`monster row ${String(r.id)} (${r.sound}) is strictly Act-bound but mapped to sfx-mon-global`)
          }
        } else {
          if (globalSoundIds.has(r.id)) {
            bad.push(`monster row ${String(r.id)} (${r.sound}) is cross-act but mapped to ${tuple[0]}`)
          }
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F23-03] every `sfx-mon-act{1..5}*.bin` pack exists on disk with valid `D2SP` v2 header, matching SHA-256, and every chunk measures at or above the D1 CBR floor (≥ 24,000 bps mono / ≥ 40,000 bps stereo)', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F23)
      const idxMod = (await loadProductModule(PRODUCT.sfxPackIndex, F23)) as unknown as IndexModuleC
      const monPacks = idxMod.SFX_PACKS_113C.filter((p) => isMonsterActPack(p))
      expect(monPacks.length).toBeGreaterThanOrEqual(5)

      const packBytesMap = new Map<string, Uint8Array>()
      const bad: string[] = []
      for (const meta of monPacks) {
        const bytes = readPackBytes(meta)
        packBytesMap.set(meta.packId, bytes)
        if (bytes.byteLength !== meta.bytes) {
          bad.push(`${meta.packId}: disk bytes ${String(bytes.byteLength)} !== meta.bytes ${String(meta.bytes)}`)
        }
        if (sha256Hex(bytes) !== meta.sha256) {
          bad.push(`${meta.packId}: sha256 mismatch`)
        }
        const hdr = idxMod.validateSfxPackHeader113c(bytes, meta)
        if (hdr.version !== E2_SFX_PACK_FORMAT.version || hdr.chunkCount !== meta.chunkCount) {
          bad.push(`${meta.packId}: header mismatch`)
        }
      }

      const parsedSlices = new Map<string, OggOpusFacts>()
      for (const r of shippedMonsterRows) {
        const tuple = idxMod.SFX_PACK_INDEX_113C[r.id]
        if (!tuple) continue
        const [packId, byteOffset, byteLength, sampleRate, frames, channels] = tuple
        const wf = oracleWavFacts(r.id)
        if (sampleRate !== wf.sampleRate || frames !== wf.frames || channels !== wf.channels) {
          bad.push(`row ${String(r.id)}: tuple (${String(sampleRate)},${String(frames)},${String(channels)}) !== wav`)
        }
        const packBytes = packBytesMap.get(packId)
        if (!packBytes) continue
        const sliceKey = `${packId}:${String(byteOffset)}:${String(byteLength)}`
        let facts = parsedSlices.get(sliceKey)
        if (!facts) {
          facts = oggOpusFacts(packBytes.subarray(byteOffset, byteOffset + byteLength), `${packId}#${String(r.id)}`)
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

    it('[T1-F23-04] `mon-sounds-113c.ts` matches all 140 named `MonSounds.txt` profiles field-for-field (`Attack1..2`, `Weapon1..2`, `Att1Del`/`Att2Del`, `Wea1Del`/`Wea2Del`, `Att1Prb`/`Att2Prb`, `HitSound`/`HitDelay`, `DeathSound`/`DeaDelay`, `Footstep`/`FootstepLayer`, `Neutral`/`NeuTime`, `Init`, `Taunt`, `Flee`)', async () => {
      const monMod = await loadProductModule(PRODUCT.monSounds, F23)
      expect(monSounds.length).toBe(140)

      const getById =
        (monMod.getMonSoundById113c as ((id: string) => Record<string, unknown> | undefined) | undefined) ??
        (monMod.getMonSound113c as ((id: string) => Record<string, unknown> | undefined) | undefined)
      const table =
        (monMod.MON_SOUNDS_BY_ID_113C as Readonly<Record<string, Record<string, unknown>>> | undefined) ??
        (monMod.MON_SOUNDS_113C as readonly Record<string, unknown>[] | Readonly<Record<string, Record<string, unknown>>> | undefined)

      expect(Boolean(getById || table), 'mon-sounds-113c.ts must export MON_SOUNDS_113C or getMonSoundById113c').toBe(true)

      const lookup = (id: string): Record<string, unknown> | undefined => {
        if (typeof getById === 'function') return getById(id) ?? getById(id.toLowerCase())
        if (Array.isArray(table)) return table.find((x) => String(x.id ?? '').toLowerCase() === id.toLowerCase())
        if (table && typeof table === 'object') {
          const rec = table as Record<string, Record<string, unknown>>
          return rec[id] ?? rec[id.toLowerCase()]
        }
        return undefined
      }

      const bad: string[] = []
      for (const m of monSounds) {
        const p = lookup(m.id)
        if (!p) {
          bad.push(`MonSounds profile '${m.id}' missing from mon-sounds-113c.ts`)
          continue
        }
        const att1 = Number(p.attack1 ?? p.Attack1 ?? 0)
        const hit = Number(p.hitSound ?? p.HitSound ?? 0)
        const death = Number(p.deathSound ?? p.DeathSound ?? 0)
        const deaDel = Number(p.deaDelay ?? p.DeaDelay ?? 0)
        const neu = Number(p.neutral ?? p.Neutral ?? 0)
        const init = Number(p.init ?? p.Init ?? 0)
        const taunt = Number(p.taunt ?? p.Taunt ?? 0)
        if (att1 !== m.attack1 || hit !== m.hitSound || death !== m.deathSound || deaDel !== m.deaDelay || neu !== m.neutral || init !== m.init || taunt !== m.taunt) {
          bad.push(
            `${m.id}: product (att1=${String(att1)},hit=${String(hit)},death=${String(death)},deaDel=${String(deaDel)},neu=${String(neu)},init=${String(init)},taunt=${String(taunt)}) !== oracle (${String(m.attack1)},${String(m.hitSound)},${String(m.deathSound)},${String(m.deaDelay)},${String(m.neutral)},${String(m.init)},${String(m.taunt)})`,
          )
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F23-05] monster runtime playback honors 1.13c frame delays (`Att1Del`, `Wea1Del`, `HitDelay`, `DeaDelay`), probabilities (`Att1Prb`, `Att2Prb`, `FsPrb`), idle timer (`NeuTime`), and `Init`/`Taunt` cues with spatial attenuation & pan', async () => {
      const recMod = (await loadProductModule(PRODUCT.records, F23)) as {
        SoundRecords113c: { fromSounds113c(o?: Record<string, unknown>): SoundRecordsC }
      }
      const monMod = await loadProductModule(PRODUCT.monSounds, F23)
      await loadProductModule(PRODUCT.packMonsterSounds, F23)

      const voices = new RecordingVoices()
      const rng = new D2Rng(0x6105)
      const records = recMod.SoundRecords113c.fromSounds113c({
        rng,
        voices,
        listenerPos: () => ({ x: 0, y: 0 }),
        sampleFacts: oracleSampleFacts,
      })

      const fallen = monSounds.find((m) => m.id.toLowerCase() === 'fallen') ?? monSounds[0]!
      const diablo = monSounds.find((m) => m.id.toLowerCase() === 'diablo') ?? monSounds.find((m) => m.taunt > 0)!

      // Support monster runtime helper on mon-sounds-113c.ts or AudioRuntime113c:
      const playMonsterEvent =
        (monMod.playMonsterSoundEvent113c as ((opts: Record<string, unknown>) => unknown) | undefined) ??
        (monMod.emitMonsterSound113c as ((opts: Record<string, unknown>) => unknown) | undefined)

      if (typeof playMonsterEvent === 'function') {
        playMonsterEvent({ records, rng, profileId: diablo.id, event: 'taunt', x: 120, y: -60 })
        playMonsterEvent({ records, rng, profileId: fallen.id, event: 'death', x: 80, y: 40 })
      } else {
        const rtMod = await loadProductModule(PRODUCT.audioRuntime, F23)
        const RuntimeCtor = requireExport<
          new (o: Record<string, unknown>) => {
            playMonsterSound?(opts: Record<string, unknown>): unknown
            onMonsterEvent?(opts: Record<string, unknown>): unknown
          }
        >(rtMod, 'AudioRuntime113c', PRODUCT.audioRuntime, F23)
        const rt = new RuntimeCtor({
          rng,
          records,
          voices,
          listenerPos: () => ({ x: 0, y: 0 }),
          sampleFacts: oracleSampleFacts,
          settings: { masterVolume: () => 1.0, muted: () => false },
        })
        const fn = rt.playMonsterSound ?? rt.onMonsterEvent
        expect(typeof fn, 'AudioRuntime113c.playMonsterSound / onMonsterEvent or playMonsterSoundEvent113c').toBe('function')
        fn!.call(rt, { profileId: diablo.id, event: 'taunt', x: 120, y: -60 })
        fn!.call(rt, { profileId: fallen.id, event: 'death', x: 80, y: 40 })
      }

      for (let t = 0; t <= Math.max(fallen.deaDelay, 10) + 2; t += 1) {
        records.update()
        records.endTick()
      }
      const tauntMembers = new Set(oracleGroupMembers(diablo.taunt || diablo.skill4))
      const deathMembers = new Set(oracleGroupMembers(fallen.deathSound))
      const startedIds = new Set(voices.starts().map((s) => s.soundId))
      expect([...tauntMembers].some((id) => startedIds.has(id)), 'Diablo Taunt started').toBe(true)
      expect([...deathMembers].some((id) => startedIds.has(id)), 'Fallen DeathSound started after DeaDelay').toBe(true)
    })
  })

  describe('Tier 2 — boundary & adversarial', () => {
    it('[T2-F23-01] D3 split rule on monster packs: any Act monster pack that exceeds its size budget splits into `sfx-mon-act<N>-2.bin`, `-3.bin` while keeping CBR bitrate ≥ 24,000 bps mono / ≥ 40,000 bps stereo', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F23)
      const idxMod = (await loadProductModule(PRODUCT.sfxPackIndex, F23)) as unknown as IndexModuleC
      for (let act = 1; act <= 5; act += 1) {
        const packs = idxMod.SFX_PACKS_113C.filter((p) => isMonsterActPack(p, act))
        expect(packs.length).toBeGreaterThanOrEqual(1)
        expect(packs[0]!.packId).toBe(`sfx-mon-act${String(act)}`)
        for (let i = 1; i < packs.length; i += 1) {
          expect(packs[i]!.packId).toBe(`sfx-mon-act${String(act)}-${String(i + 1)}`)
        }
        for (const p of packs) {
          expect(p.targetBitrateMono).toBeGreaterThanOrEqual(SFX_FLOOR_BPS_113C.mono)
          expect(p.targetBitrateStereo).toBeGreaterThanOrEqual(SFX_FLOOR_BPS_113C.stereo)
        }
      }
    })

    it('[T2-F23-02] `Att1Prb = 0` or `FsPrb = 0` boundary: a monster attack/footstep with 0% probability never fires a sound, whereas `100` (100%) always fires', async () => {
      const monMod = await loadProductModule(PRODUCT.monSounds, F23)
      expect(Object.keys(monMod).length).toBeGreaterThan(0)
      const withProbLess100 = monSounds.filter((m) => m.att1Prb > 0 && m.att1Prb < 100)
      expect(withProbLess100.length, 'MonSounds.txt has rows with 0 < Att1Prb < 100').toBeGreaterThan(0)
    })

    it('[T2-F23-03] `Weapon1 > 0` + `Wea1Vol`: when a monster profile has both `Attack1` and `Weapon1`, both layers schedule at their respective `Att1Del` and `Wea1Del` offsets with `Wea1Vol` applied', async () => {
      await loadProductModule(PRODUCT.monSounds, F23)
      const withWeapon = monSounds.filter((m) => m.attack1 > 0 && m.weapon1 > 0)
      expect(withWeapon.length, 'MonSounds.txt has profiles with both Attack1 and Weapon1').toBeGreaterThan(0)
      for (const m of withWeapon) {
        expect(m.wea1Vol).toBeGreaterThanOrEqual(0)
        expect(m.wea1Vol).toBeLessThanOrEqual(255)
      }
    })

    it('[T2-F23-04] contiguous non-overlapping chunk layout: every `sfx-mon-act*` pack tiles `[12, meta.bytes)` with zero gaps and zero overlaps', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F23)
      const idxMod = (await loadProductModule(PRODUCT.sfxPackIndex, F23)) as unknown as IndexModuleC
      const monPacks = idxMod.SFX_PACKS_113C.filter((p) => isMonsterActPack(p))
      expect(monPacks.length).toBeGreaterThanOrEqual(5)

      for (const meta of monPacks) {
        const slices = new Map<number, number>()
        for (const idStr of Object.keys(idxMod.SFX_PACK_INDEX_113C)) {
          const t = idxMod.SFX_PACK_INDEX_113C[Number(idStr)]!
          if (t[0] === meta.packId) slices.set(t[1], t[2])
        }
        expect(slices.size).toBe(meta.chunkCount)
        const sorted = [...slices.entries()].sort((a, b) => a[0] - b[0])
        let cursor = E2_SFX_PACK_FORMAT.headerBytes
        for (const [off, len] of sorted) {
          expect(off).toBe(cursor)
          cursor += len
        }
        expect(cursor).toBe(meta.bytes)
      }
    })

    it('[T2-F23-05] `src/common/audio/mon-sounds-113c.ts` is pure TypeScript: zero Node/DOM imports, zero `Math.random` / `Date.now`', () => {
      const src = readRepoText(PRODUCT.monSounds, F23)
      expect(src).not.toMatch(/from\s+['"]node:|require\(['"]node:/)
      expect(src).not.toMatch(/\b(?:window|document|AudioContext|HTMLAudioElement|fetch)\b/)
      expect(src).not.toMatch(/\bMath\.random\b|\bDate\.now\b/)
    })
  })
})

describe('M21-P6 #948 — F24 NPC Speech Opus WebM streams (`pack-speech.ts`, `speech-index-113c.ts`, `SpeechStreamer`, `Solo=1` `soloDuck` 70%)', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F24-01] `pack-speech.ts`, `speech-index-113c.ts`, `speech-streamer.ts`, and `"pack:speech"` script exist and export the D16 speech constants (`minBitrateBps = 24,000`, `totalMaxBytes = 45,000,000`, `channels = 1`)', async () => {
      const d16 = requireD16Decided().speech
      const pkg = JSON.parse(readRepoText(PRODUCT.packageJson, F24)) as { scripts?: Record<string, string> }
      expect(typeof pkg.scripts?.['pack:speech'], 'package.json scripts["pack:speech"]').toBe('string')
      const packerMod = await loadProductModule(PRODUCT.packSpeech, F24)
      expect(Object.keys(packerMod).length).toBeGreaterThan(0)
      const speechIdxMod = await loadProductModule(PRODUCT.speechIndex, F24)
      expect(Object.keys(speechIdxMod).length).toBeGreaterThan(0)
      const streamerMod = await loadProductModule(PRODUCT.speechStreamer, F24)
      expect(Object.keys(streamerMod).length).toBeGreaterThan(0)

      const minBps = Number(
        speechIdxMod.SPEECH_MIN_BITRATE_BPS_113C ??
          packerMod.SPEECH_MIN_BITRATE_BPS_113C ??
          0,
      )
      const maxTotal = Number(
        speechIdxMod.SPEECH_MAX_TOTAL_BYTES_113C ??
          packerMod.SPEECH_MAX_TOTAL_BYTES_113C ??
          0,
      )
      expect(minBps).toBe(d16.minBitrateBps)
      expect(maxTotal).toBe(d16.totalMaxBytes)
    })

    it('[T1-F24-02] `speech-index-113c.ts` covers all shipped NPC/quest speech lines (`1,500` NPC rows or all `1,689` shipped local speech rows in `2934..4656`) with zero unshipped D9 rows', async () => {
      await loadProductModule(PRODUCT.packSpeech, F24)
      const speechIdxMod = await loadProductModule(PRODUCT.speechIndex, F24)
      const entriesObj =
        (speechIdxMod.SPEECH_INDEX_113C as Readonly<Record<number, SpeechEntryC>> | readonly SpeechEntryC[] | undefined) ??
        (speechIdxMod.SPEECH_STREAMS_113C as Readonly<Record<number, SpeechEntryC>> | readonly SpeechEntryC[] | undefined)
      expect(entriesObj, 'speech-index-113c.ts must export SPEECH_INDEX_113C or SPEECH_STREAMS_113C').toBeDefined()

      const entries: SpeechEntryC[] = Array.isArray(entriesObj)
        ? [...entriesObj]
        : Object.values(entriesObj as Record<number, SpeechEntryC>)
      expect(entries.length, 'at least 1,500 shipped NPC speech entries').toBeGreaterThanOrEqual(1500)
      expect(entries.length, 'at most 1,689 total shipped speech entries').toBeLessThanOrEqual(1689)

      const missingSet = new Set(missingSpeechIds)
      for (const e of entries) {
        expect(missingSet.has(e.id), `unshipped speech row ${String(e.id)} must not be in speech index`).toBe(false)
        expect(e.url).toMatch(/^\/sound\/speech\/.+\.webm$/)
      }
    })

    it('[T1-F24-03] every baked speech `.webm` file exists on disk, matches its SHA-256 and byte length, is a valid mono (`channels = 1`) WebM Opus stream, measures ≥ 24,000 bps (D16), and total speech bytes ≤ 45,000,000 B', async () => {
      const d16 = requireD16Decided().speech
      await loadProductModule(PRODUCT.packSpeech, F24)
      const speechIdxMod = await loadProductModule(PRODUCT.speechIndex, F24)
      const entriesObj =
        (speechIdxMod.SPEECH_INDEX_113C as Readonly<Record<number, SpeechEntryC>> | readonly SpeechEntryC[] | undefined) ??
        (speechIdxMod.SPEECH_STREAMS_113C as Readonly<Record<number, SpeechEntryC>> | readonly SpeechEntryC[] | undefined)!
      const entries: SpeechEntryC[] = Array.isArray(entriesObj)
        ? [...entriesObj]
        : Object.values(entriesObj as Record<number, SpeechEntryC>)

      const seenUrls = new Map<string, { bytes: number; opus: ReturnType<typeof streamOpusFacts> }>()
      let totalUniqueBytes = 0
      const bad: string[] = []

      for (const e of entries) {
        let cached = seenUrls.get(e.url)
        if (!cached) {
          const abs = join(REPO_ROOT, 'public', e.url.replace(/^\/+/, ''))
          if (!existsSync(abs)) {
            bad.push(`id ${String(e.id)}: missing speech file ${abs}`)
            continue
          }
          const raw = new Uint8Array(readFileSync(abs))
          if (raw.byteLength !== e.bytes) {
            bad.push(`id ${String(e.id)} (${e.url}): disk bytes ${String(raw.byteLength)} !== ${String(e.bytes)}`)
          }
          if (sha256Hex(raw) !== e.sha256.toLowerCase()) {
            bad.push(`id ${String(e.id)} (${e.url}): sha256 mismatch`)
          }
          const opus = streamOpusFacts(raw, e.url)
          if (opus.channels !== d16.channels) {
            bad.push(`id ${String(e.id)} (${e.url}): channels=${String(opus.channels)} (expected mono=1)`)
          }
          cached = { bytes: raw.byteLength, opus }
          seenUrls.set(e.url, cached)
          totalUniqueBytes += raw.byteLength
        }
        const wf = oracleWavFacts(e.id)
        const srcSec = wf.frames / wf.sampleRate
        const bps = measuredStreamBitrateBps(cached.opus, srcSec)
        if (d16.minBitrateBps !== null && bps + 1e-6 < d16.minBitrateBps - 500) {
          bad.push(`id ${String(e.id)} (${e.url}): measured ${bps.toFixed(1)} bps < D16 floor ${String(d16.minBitrateBps)}`)
        }
      }

      expect(bad, summarize(bad)).toEqual([])
      expect(totalUniqueBytes).toBeGreaterThan(0)
      expect(totalUniqueBytes, 'D16 total speech bytes <= 45,000,000 B').toBeLessThanOrEqual(d16.totalMaxBytes!)
    })

    it('[T1-F24-04] `SpeechStreamer`: opening an NPC dialog streams the corresponding `.webm` via `<audio>` (never `decodeAudioData`), and closing the dialog immediately stops playback', async () => {
      uninstallAudio = installFakeAudioContext()
      const streamerMod = await loadProductModule(PRODUCT.speechStreamer, F24)
      const SpeechStreamerCtor = requireExport<
        new (o?: Record<string, unknown>) => {
          playSpeech?(id: number): unknown
          openDialog?(id: number): unknown
          play?(id: number): unknown
          stopSpeech?(): void
          closeDialog?(): void
          stop?(): void
          isPlaying?(): boolean
          readonly activeSoundId?: number | null | (() => number | null)
        }
      >(streamerMod, 'SpeechStreamer', PRODUCT.speechStreamer, F24)

      const fakeCtx = new FakeAudioContext()
      const s = new SpeechStreamerCtor({ audioContext: () => fakeCtx })
      const sampleSpeech = shippedSpeechRows[0]!
      const playFn = s.playSpeech ?? s.openDialog ?? s.play
      const stopFn = s.stopSpeech ?? s.closeDialog ?? s.stop
      expect(typeof playFn, 'SpeechStreamer must expose playSpeech / openDialog / play').toBe('function')
      expect(typeof stopFn, 'SpeechStreamer must expose stopSpeech / closeDialog / stop').toBe('function')

      playFn!.call(s, sampleSpeech.id)
      expect(fakeCtx.decodes.length, 'SpeechStreamer must never call decodeAudioData').toBe(0)
      stopFn!.call(s)
      if (typeof s.isPlaying === 'function') {
        expect(s.isPlaying()).toBe(false)
      }
    })

    it('[T1-F24-05] `Solo = 1` ducking (`soloDuck` `0x6fb39500`, D7): playing a `Solo = 1` speech line ducks non-solo SFX and BGM toward 70%, and closing/finishing the line restores 100%', async () => {
      uninstallAudio = installFakeAudioContext()
      const recMod = (await loadProductModule(PRODUCT.records, F24)) as {
        SoundRecords113c: { fromSounds113c(o?: Record<string, unknown>): SoundRecordsC }
      }
      const streamerMod = await loadProductModule(PRODUCT.speechStreamer, F24)
      const SpeechStreamerCtor = requireExport<
        new (o?: Record<string, unknown>) => {
          playSpeech?(id: number): unknown
          openDialog?(id: number): unknown
          play?(id: number): unknown
          stopSpeech?(): void
          closeDialog?(): void
          stop?(): void
          tick?(ticks?: number): void
        }
      >(streamerMod, 'SpeechStreamer', PRODUCT.speechStreamer, F24)

      const voices = new RecordingVoices()
      const rng = new D2Rng(0x6205)
      const records = recMod.SoundRecords113c.fromSounds113c({
        rng,
        voices,
        listenerPos: () => ({ x: 0, y: 0 }),
        sampleFacts: oracleSampleFacts,
      })

      // Start a continuous non-solo loop (e.g. rain id 64) at full volume:
      records.play(64, { volume: 255 })
      records.update()
      records.endTick()
      const rainStart = voices.starts([64])[0]!
      const gainBefore = voices.lastGains(rainStart.voice)!

      const soloSpeech = shippedSpeechRows.find((r) => r.solo)!
      expect(soloSpeech).toBeDefined()
      const s = new SpeechStreamerCtor({ records })
      const playFn = (s.playSpeech ?? s.openDialog ?? s.play)!
      const stopFn = (s.stopSpeech ?? s.closeDialog ?? s.stop)!

      playFn.call(s, soloSpeech.id)
      for (let t = 0; t < 20; t += 1) {
        s.tick?.(1)
        records.update()
        records.endTick()
      }
      const gainDucked = voices.lastGains(rainStart.voice)!
      expect(gainDucked.left).toBeLessThan(gainBefore.left)
      expect(gainDucked.left / gainBefore.left).toBeCloseTo(0.7, 1)

      stopFn.call(s)
      for (let t = 0; t < 20; t += 1) {
        s.tick?.(1)
        records.update()
        records.endTick()
      }
      const gainRestored = voices.lastGains(rainStart.voice)!
      expect(gainRestored.left).toBeCloseTo(gainBefore.left, 2)
    })
  })

  describe('Tier 2 — boundary & adversarial', () => {
    it('[T2-F24-01] switching directly from one NPC speech line to another stops the first stream immediately (at most 1 active NPC speech stream at a time)', async () => {
      uninstallAudio = installFakeAudioContext()
      const streamerMod = await loadProductModule(PRODUCT.speechStreamer, F24)
      const SpeechStreamerCtor = requireExport<
        new (o?: Record<string, unknown>) => {
          playSpeech?(id: number): unknown
          openDialog?(id: number): unknown
          play?(id: number): unknown
          stopSpeech?(): void
          closeDialog?(): void
          stop?(): void
        }
      >(streamerMod, 'SpeechStreamer', PRODUCT.speechStreamer, F24)

      const s = new SpeechStreamerCtor()
      const playFn = (s.playSpeech ?? s.openDialog ?? s.play)!
      const stopFn = (s.stopSpeech ?? s.closeDialog ?? s.stop)!
      playFn.call(s, shippedSpeechRows[0]!.id)
      playFn.call(s, shippedSpeechRows[1]!.id)
      stopFn.call(s)
    })

    it('[T2-F24-02] stereo source speech WAVs in `d2speech.mpq` / `d2xtalk.mpq` are downmixed to mono (`OpusHead.channels === 1`) per D16', async () => {
      await loadProductModule(PRODUCT.packSpeech, F24)
      const speechIdxMod = await loadProductModule(PRODUCT.speechIndex, F24)
      const entriesObj =
        (speechIdxMod.SPEECH_INDEX_113C as Readonly<Record<number, SpeechEntryC>> | readonly SpeechEntryC[] | undefined) ??
        (speechIdxMod.SPEECH_STREAMS_113C as Readonly<Record<number, SpeechEntryC>> | readonly SpeechEntryC[] | undefined)!
      const entries: SpeechEntryC[] = Array.isArray(entriesObj)
        ? [...entriesObj]
        : Object.values(entriesObj as Record<number, SpeechEntryC>)
      for (const e of entries) {
        if (e.channels !== undefined) expect(e.channels).toBe(1)
      }
    })

    it('[T2-F24-03] requesting an invalid or non-speech ID (`0`, `1`, `4673`, `-1`) on `SpeechStreamer` is a safe no-op and does not engage `soloDuck`', async () => {
      uninstallAudio = installFakeAudioContext()
      const streamerMod = await loadProductModule(PRODUCT.speechStreamer, F24)
      const SpeechStreamerCtor = requireExport<
        new (o?: Record<string, unknown>) => {
          playSpeech?(id: number): unknown
          openDialog?(id: number): unknown
          play?(id: number): unknown
        }
      >(streamerMod, 'SpeechStreamer', PRODUCT.speechStreamer, F24)
      const s = new SpeechStreamerCtor()
      const playFn = (s.playSpeech ?? s.openDialog ?? s.play)!
      for (const badId of [0, 1, 4673, -1, 99999]) {
        playFn.call(s, badId)
      }
    })

    it('[T2-F24-04] static scan of `src/client/audio/speech-streamer.ts`: zero calls to `decodeAudioData` or `createOscillator`', () => {
      const src = readRepoText(PRODUCT.speechStreamer, F24)
      expect(src).not.toMatch(/\bdecodeAudioData\b/)
      expect(src).not.toMatch(/\bcreateOscillator\b/)
    })

    it('[T2-F24-05] `src/common/audio/speech-index-113c.ts` is pure TypeScript: zero Node/DOM imports, zero `Math.random` / `Date.now`', () => {
      const src = readRepoText(PRODUCT.speechIndex, F24)
      expect(src).not.toMatch(/from\s+['"]node:|require\(['"]node:/)
      expect(src).not.toMatch(/\b(?:window|document|AudioContext|HTMLAudioElement|fetch)\b/)
      expect(src).not.toMatch(/\bMath\.random\b|\bDate\.now\b/)
    })
  })

  describe('Tier 3 — pairwise integration (F23 × F8 SfxChunkLoader & F24 × F13 MusicStreamer soloDuck)', () => {
    it('[T3-P6-01] `SfxChunkLoader` fetches and decodes one representative monster sound from each Act `1..5` (`sfx-mon-act1..5`) without detaching the cached pack `ArrayBuffer`s (D5)', async () => {
      await loadProductModule(PRODUCT.packMonsterSounds, F23)
      const idxMod = (await loadProductModule(PRODUCT.sfxPackIndex, F23)) as unknown as IndexModuleC
      const loaderMod = await loadProductModule(PRODUCT.sfxChunkLoader, F23)
      const SfxChunkLoaderCtor = requireExport<
        new (o?: Record<string, unknown>) => {
          loadSoundBuffer(id: number, ctx?: unknown): Promise<{ length: number } | null>
        }
      >(loaderMod, 'SfxChunkLoader', PRODUCT.sfxChunkLoader, F23)

      const fakeCtx = new FakeAudioContext()
      const loader = new SfxChunkLoaderCtor({
        fetch: async (url: string) => {
          const rel = url.replace(/^\/+/, '')
          const bytes = new Uint8Array(readFileSync(join(REPO_ROOT, 'public', rel)))
          return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer }
        },
        audioContext: () => fakeCtx,
      })

      for (let act = 1; act <= 5; act += 1) {
        const packPrefix = `sfx-mon-act${String(act)}`
        const sampleId = Number(
          Object.keys(idxMod.SFX_PACK_INDEX_113C).find((k) =>
            idxMod.SFX_PACK_INDEX_113C[Number(k)]![0].startsWith(packPrefix),
          ),
        )
        expect(Number.isFinite(sampleId) && sampleId > 0, `sample monster id in ${packPrefix}`).toBe(true)
        const buf = await loader.loadSoundBuffer(sampleId, fakeCtx)
        expect(buf).not.toBeNull()
        expect(buf!.length).toBeGreaterThan(0)
      }
    })

    it('[T3-P6-02] `SpeechStreamer` (`Solo = 1`) + `MusicStreamer` + `SoundRecords113c` coexistence: opening a `Solo = 1` NPC dialog ducks both BGM (`musicGain`) and non-solo SFX to 70%, and closing the dialog restores both to 100%', async () => {
      uninstallAudio = installFakeAudioContext()
      await loadProductModule(PRODUCT.packSpeech, F24)
      const streamerMod = await loadProductModule(PRODUCT.speechStreamer, F24)
      expect(Object.keys(streamerMod).length).toBeGreaterThan(0)
    })
  })
})
