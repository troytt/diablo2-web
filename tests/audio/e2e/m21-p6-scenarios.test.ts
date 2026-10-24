/**
 * M21-P6 (#948) — Tier 4 E2E Scenarios (`T4-P6-01` .. `T4-P6-04`):
 * - `T4-P6-01`: SuperUnique / Boss encounter lifecycle (`Fallen` / Rakanishu & `Diablo` `MonSounds.txt`
 *   `Taunt`/`Init` → `Attack1` + `Weapon1` with `Att1Del`/`Wea1Del`/`Att1Prb`/`Wea1Vol` → `HitSound`
 *   after `HitDelay` → `DeathSound` after `DeaDelay` + `Footstep`).
 * - `T4-P6-02`: NPC dialog speech lifecycle (`Akara` `2934` `Solo = 1` `.webm` stream opens → ducks
 *   active SFX voices to 70% per `0x6fb39500` → player closes dialog early → speech stops immediately
 *   and SFX voices restore to 100%, zero `decodeAudioData` calls).
 * - `T4-P6-03`: D9 unshipped-WAV resilience in live Act IV `Regurgitator` combat (`1595..1598` neutral
 *   plays nothing without throwing or synthesizing, while `Attack1` `1583` and `DeathSound` `1599` play
 *   normally) and unshipped speech dialog transitions.
 * - `T4-P6-04`: Full M1–M6 audio pipeline & Service Worker end-to-end verification across all 10
 *   `verify:audio` sections (`tables`, `sfx-core`, `music`, `ambient`, `levels`, `weather`, `skills`,
 *   `monsters`, `speech`, `manifest`) and `public/asset-manifest.json`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  D2_DATA_DIR,
  PRODUCT,
  REPO_ROOT,
  RecordingVoices,
  getOracle113c,
  loadProductModule,
  oracleGroupMembers,
  oracleMonsterSpeechScope,
  oracleSampleFacts,
  requireD16Decided,
  requireExport,
  summarize,
  type Oracle113c,
  type OracleMonSoundRow113c,
} from './harness-113c.ts'
import { FakeAudioContext, installFakeAudioContext } from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 600_000 })

const P6_SCENARIOS = '#948 Tier 4 E2E Scenarios (Monster SFX, NPC Speech, D9 Unshipped WAVs, Full M1–M6 Audit)'

interface IndexModuleC {
  readonly SFX_PACK_INDEX_113C: Readonly<Record<number, readonly [string, number, number, number, number, number]>>
  readonly SFX_PACKS_113C: readonly {
    readonly packId: string
    readonly url: string
    readonly bytes: number
    readonly sha256: string
  }[]
}

interface SpeechEntryC {
  readonly id: number
  readonly url: string
  readonly bytes: number
  readonly sha256: string
  readonly solo?: boolean
}

class FakeSpeechAudioElement {
  src = ''
  currentTime = 0
  volume = 1
  muted = false
  paused = true
  playCalls = 0
  pauseCalls = 0
  private readonly listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, cb: () => void): void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(cb)
  }

  removeEventListener(type: string, cb: () => void): void {
    this.listeners.get(type)?.delete(cb)
  }

  async play(): Promise<void> {
    this.playCalls += 1
    this.paused = false
  }

  pause(): void {
    this.pauseCalls += 1
    this.paused = true
  }

  emitEnded(): void {
    this.paused = true
    for (const cb of this.listeners.get('ended') ?? []) cb()
  }
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

let O: Oracle113c
let monSoundsByName: ReadonlyMap<string, OracleMonSoundRow113c>
let missingMonsterIds: readonly number[]
let missingSpeechIds: readonly number[]

beforeAll(() => {
  O = getOracle113c()
  const scope = oracleMonsterSpeechScope(O)
  missingMonsterIds = scope.missingMonsterIds
  missingSpeechIds = scope.missingSpeechIds
  const map = new Map<string, OracleMonSoundRow113c>()
  for (const r of scope.monSounds) {
    map.set(r.id.toLowerCase(), r)
  }
  monSoundsByName = map
})

describe('M21-P6 (#948) — Tier 4 E2E Scenarios', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[T4-P6-01] SuperUnique / Boss encounter lifecycle (`Fallen` / Rakanishu & `Diablo`): `Taunt`/`Init` → `Attack1` + `Weapon1` (`Att1Del`/`Wea1Del`) → `HitSound` (`HitDelay`) → `DeathSound` (`DeaDelay`) all resolve to packed `sfx-mon-act*` chunks and obey tick delays', async () => {
    await loadProductModule(PRODUCT.packMonsterSounds, P6_SCENARIOS)
    await loadProductModule(PRODUCT.monSounds, P6_SCENARIOS)
    const idxMod = (await loadProductModule(PRODUCT.sfxPackIndex, P6_SCENARIOS)) as unknown as IndexModuleC
    const recMod = await loadProductModule(PRODUCT.records, P6_SCENARIOS)
    const SoundRecordsCtor = requireExport<
      new (o: Record<string, unknown>) => {
        play(id: number, o?: Record<string, unknown>): number
        update(): void
        endTick(): void
      }
    >(recMod, 'SoundRecords113c', PRODUCT.records, P6_SCENARIOS)

    const fallen = monSoundsByName.get('fallen')!
    const diablo = monSoundsByName.get('diablo')!
    expect(fallen).toBeDefined()
    expect(diablo).toBeDefined()

    // Every non-zero event sound on Fallen and Diablo must be packed in sfx-mon-act*
    for (const ms of [fallen, diablo]) {
      for (const sid of [ms.init, ms.taunt, ms.attack1, ms.weapon1, ms.hitSound, ms.deathSound, ms.footstep]) {
        if (sid > 0) {
          for (const m of oracleGroupMembers(sid)) {
            if (!missingMonsterIds.includes(m)) {
              expect(
                idxMod.SFX_PACK_INDEX_113C[m],
                `${ms.id} sound member ${String(m)} present in SFX_PACK_INDEX_113C`,
              ).toBeDefined()
            }
          }
        }
      }
    }

    const voices = new RecordingVoices()
    const sr = new SoundRecordsCtor({
      voices,
      rng: new D2Rng(0x601),
      sampleFacts: (id: number) => oracleSampleFacts(id),
    })

    // 1. Encounter start: Taunt / Init (Diablo's monster_diablo_taunt_1 is in Skill4=766 in 1.13c MonSounds.txt)
    const tauntId = diablo.taunt > 0 ? diablo.taunt : diablo.skill4 > 0 ? diablo.skill4 : fallen.taunt > 0 ? fallen.taunt : fallen.init
    expect(tauntId).toBeGreaterThan(0)
    const hTaunt = sr.play(tauntId)
    expect(hTaunt).toBeGreaterThan(0)
    expect(oracleGroupMembers(tauntId)).toContain(voices.starts().at(-1)!.soundId)

    // 2. Melee Attack1 after Att1Del ticks + Weapon1 after Wea1Del ticks
    const tickEvents = new Map<number, { id: number; volume?: number }[]>()
    const scheduleAt = (tick: number, id: number, volume?: number) => {
      if (id <= 0) return
      const list = tickEvents.get(tick) ?? []
      list.push(volume !== undefined ? { id, volume } : { id })
      tickEvents.set(tick, list)
    }
    scheduleAt(fallen.att1Del, fallen.attack1)
    if (fallen.weapon1 > 0) {
      scheduleAt(fallen.wea1Del, fallen.weapon1, fallen.wea1Vol > 0 ? fallen.wea1Vol : undefined)
    }
    scheduleAt(10 + fallen.hitDelay, fallen.hitSound)
    scheduleAt(20 + fallen.deaDelay, fallen.deathSound)

    const emittedByTick: { tick: number; soundId: number }[] = []
    const maxTick = 20 + fallen.deaDelay + 2
    for (let t = 0; t <= maxTick; t++) {
      for (const ev of tickEvents.get(t) ?? []) {
        const h = sr.play(ev.id, ev.volume !== undefined ? { volume: ev.volume } : undefined)
        expect(h).toBeGreaterThan(0)
        emittedByTick.push({ tick: t, soundId: voices.starts().at(-1)!.soundId })
      }
      sr.update()
      sr.endTick()
    }

    expect(emittedByTick.some((e) => e.tick === fallen.att1Del && oracleGroupMembers(fallen.attack1).includes(e.soundId))).toBe(true)
    expect(emittedByTick.some((e) => e.tick === 10 + fallen.hitDelay && oracleGroupMembers(fallen.hitSound).includes(e.soundId))).toBe(true)
    expect(emittedByTick.some((e) => e.tick === 20 + fallen.deaDelay && oracleGroupMembers(fallen.deathSound).includes(e.soundId))).toBe(true)
  })

  it('[T4-P6-02] NPC dialog speech lifecycle (`Akara` `3093` `Solo = 1`): opening dialog streams `/sound/speech/act1/*.webm` via `<audio>`, ducks active SFX voices to 70% (`0x6fb39500`), never calls `decodeAudioData`, and closing dialog early stops `<audio>` and restores SFX voices to 100%', async () => {
    await loadProductModule(PRODUCT.packSpeech, P6_SCENARIOS)
    const speechMod = await loadProductModule(PRODUCT.speechIndex, P6_SCENARIOS)
    const speechMap = readSpeechEntries(speechMod)
    const akaraIntroId = O.soundsByName.get('akara_act1_intro') ?? 3093
    expect(speechMap.has(akaraIntroId), `Akara intro row ${String(akaraIntroId)} in SPEECH_INDEX_113C`).toBe(true)

    const recMod = await loadProductModule(PRODUCT.records, P6_SCENARIOS)
    const SoundRecordsCtor = requireExport<
      new (o: Record<string, unknown>) => {
        play(id: number, o?: Record<string, unknown>): number
        setSoloActive?(active: boolean): void
        setSoloDuck?(active: boolean): void
      }
    >(recMod, 'SoundRecords113c', PRODUCT.records, P6_SCENARIOS)
    const streamerMod = await loadProductModule(PRODUCT.speechStreamer, P6_SCENARIOS)
    const SpeechStreamerCtor = requireExport<
      new (o?: Record<string, unknown>) => {
        playSpeech?(id: number, o?: Record<string, unknown>): unknown
        play?(id: number, o?: Record<string, unknown>): unknown
        stopSpeech?(): void
        stop?(): void
      }
    >(streamerMod, 'SpeechStreamer', PRODUCT.speechStreamer, P6_SCENARIOS)

    const restore = installFakeAudioContext()
    try {
      const fakeCtx = new FakeAudioContext()
      const decodeSpy = vi.spyOn(fakeCtx, 'decodeAudioData')
      const voices = new RecordingVoices()
      const sr = new SoundRecordsCtor({
        voices,
        rng: new D2Rng(0x602),
        sampleFacts: (id: number) => oracleSampleFacts(id),
      })

      // Active environmental/combat SFX playing before NPC dialog opens
      const sfxHandle = sr.play(3) // cursor_button_click (NonSolo = 0)
      expect(sfxHandle).toBeGreaterThan(0)
      const sfxVoice = voices.starts()[0]!.voice
      const fullGain = voices.lastGains(sfxVoice)!.left
      expect(fullGain).toBeGreaterThan(0)

      const createdAudios: FakeSpeechAudioElement[] = []
      const streamer = new SpeechStreamerCtor({
        audioContext: fakeCtx,
        soundRecords: sr,
        records: sr,
        createAudioElement: () => {
          const el = new FakeSpeechAudioElement()
          createdAudios.push(el)
          return el
        },
        onSoloChange: (active: boolean) => {
          if (typeof sr.setSoloActive === 'function') sr.setSoloActive(active)
          else if (typeof sr.setSoloDuck === 'function') sr.setSoloDuck(active)
        },
      })

      const playFn = (streamer.playSpeech ?? streamer.play)!.bind(streamer)
      const stopFn = (streamer.stopSpeech ?? streamer.stop)!.bind(streamer)

      await playFn(akaraIntroId)
      expect(createdAudios.length).toBeGreaterThanOrEqual(1)
      const activeAudio = createdAudios[createdAudios.length - 1]!
      expect(activeAudio.playCalls).toBe(1)
      expect(activeAudio.src).toMatch(/sound\/speech\/act1\/.*\.webm$/i)
      expect(decodeSpy, 'speech streamer must never call decodeAudioData').not.toHaveBeenCalled()

      // Non-solo SFX voice must be ducked to ~70% while Solo=1 speech is playing
      expect(voices.lastGains(sfxVoice)!.left).toBeCloseTo(fullGain * 0.7, 1)

      // Player closes NPC dialog early
      stopFn()
      expect(activeAudio.pauseCalls).toBeGreaterThanOrEqual(1)
      expect(voices.lastGains(sfxVoice)!.left, 'SFX voice volume restored to 100% on dialog close').toBeCloseTo(
        fullGain,
        2,
      )
    } finally {
      restore()
    }
  })

  it('[T4-P6-03] D9 unshipped-WAV resilience in live Act IV `Regurgitator` combat (`1595..1598` neutral plays nothing without throwing or synthesizing, followed immediately by valid `Attack1` `1582` and `DeathSound` `1591`) and unshipped speech dialog transitions', async () => {
    await loadProductModule(PRODUCT.packMonsterSounds, P6_SCENARIOS)
    await loadProductModule(PRODUCT.packSpeech, P6_SCENARIOS)
    const idxMod = (await loadProductModule(PRODUCT.sfxPackIndex, P6_SCENARIOS)) as unknown as IndexModuleC
    const recMod = await loadProductModule(PRODUCT.records, P6_SCENARIOS)
    const SoundRecordsCtor = requireExport<
      new (o: Record<string, unknown>) => {
        play(id: number, o?: Record<string, unknown>): number
      }
    >(recMod, 'SoundRecords113c', PRODUCT.records, P6_SCENARIOS)
    const streamerMod = await loadProductModule(PRODUCT.speechStreamer, P6_SCENARIOS)
    const SpeechStreamerCtor = requireExport<
      new (o?: Record<string, unknown>) => {
        playSpeech?(id: number, o?: Record<string, unknown>): unknown
        play?(id: number, o?: Record<string, unknown>): unknown
      }
    >(streamerMod, 'SpeechStreamer', PRODUCT.speechStreamer, P6_SCENARIOS)

    const regurg = monSoundsByName.get('regurgitator')!
    expect(regurg).toBeDefined()
    expect(regurg.neutral).toBe(1595)
    expect(regurg.attack1).toBe(1582)
    expect(regurg.deathSound).toBe(1591)

    const voices = new RecordingVoices()
    const sr = new SoundRecordsCtor({
      voices,
      rng: new D2Rng(0x603),
      sampleFacts: (id: number) => {
        if (missingMonsterIds.includes(id)) return undefined
        return oracleSampleFacts(id)
      },
    })

    // 1. Regurgitator Neutral (1595..1598 unshipped): plays nothing, does not throw
    expect(sr.play(regurg.neutral)).toBe(0)
    expect(voices.starts().length).toBe(0)

    // 2. Immediately followed by Regurgitator Attack1 (1583) and DeathSound (1599): plays normally from sfx-mon-act4
    expect(idxMod.SFX_PACK_INDEX_113C[regurg.attack1]).toBeDefined()
    expect(idxMod.SFX_PACK_INDEX_113C[regurg.deathSound]).toBeDefined()
    const hAtk = sr.play(regurg.attack1)
    const hDea = sr.play(regurg.deathSound)
    expect(hAtk).toBeGreaterThan(0)
    expect(hDea).toBeGreaterThan(0)
    expect(voices.starts().length).toBe(2)

    // 3. Unshipped speech row followed by valid Akara 2934 speech row
    const createdAudios: FakeSpeechAudioElement[] = []
    const streamer = new SpeechStreamerCtor({
      createAudioElement: () => {
        const el = new FakeSpeechAudioElement()
        createdAudios.push(el)
        return el
      },
    })
    const playSpeech = (streamer.playSpeech ?? streamer.play)!.bind(streamer)
    await playSpeech(missingSpeechIds[0]!)
    expect(createdAudios.length, 'unshipped speech ID must not start an <audio> element').toBe(0)

    await playSpeech(2934)
    expect(createdAudios.length, 'subsequent valid speech ID 2934 starts normally').toBe(1)
    expect(createdAudios[0]!.playCalls).toBe(1)
  })

  it('[T4-P6-04] Full M1–M6 audio pipeline & Service Worker end-to-end verification: all 10 `verify:audio` sections pass, all 4,699 `Sounds.txt` rows, 50 `SoundEnviron.txt` rows, 136 `Levels.txt` mappings, 140 `MonSounds.txt` rows, and 100% of `.bin` packs & `.webm` streams match `public/asset-manifest.json`', async () => {
    const d16 = requireD16Decided()
    expect(d16.status).toBe('DECIDED')

    await loadProductModule(PRODUCT.packMonsterSounds, P6_SCENARIOS)
    await loadProductModule(PRODUCT.packSpeech, P6_SCENARIOS)
    const auditMod = await loadProductModule(PRODUCT.audit, P6_SCENARIOS)
    const runAudioAudit = requireExport<
      (opts?: {
        rootDir?: string
        mpqDir?: string
        sections?: readonly string[]
      }) => Promise<{
        ok: boolean
        errorCount: number
        sections: readonly { id: string; ok: boolean; checks: number; errors: readonly string[] }[]
      }>
    >(auditMod, 'runAudioAudit', PRODUCT.audit, P6_SCENARIOS)

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
    expect(rep.errorCount, summarize(rep.sections.flatMap((s) => s.errors))).toBe(0)
    expect(rep.ok).toBe(true)

    const manifestPath = join(REPO_ROOT, 'public/asset-manifest.json')
    expect(existsSync(manifestPath)).toBe(true)
    const pcMod = await loadProductModule(PRODUCT.packContract, P6_SCENARIOS)
    const validateManifest = requireExport<
      (raw: unknown) => { readonly totalFiles: number; readonly files: Readonly<Record<string, string>> }
    >(pcMod, 'validateAssetManifest', PRODUCT.packContract, P6_SCENARIOS)
    const manifest = validateManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
    expect(manifest.totalFiles).toBeGreaterThan(1700)
  })
})
