/**
 * M21-P4 (#946) — Tier 4 end-to-end user-journey scenarios (`T4-P4-01..04`) exercising F15–F18
 * (`pack-ambient-sounds`, `sfx-ambient-act{1..5}.bin`, `SoundEnviron113c` 25 Hz controller,
 * weather rain `id 64` + thunder `202..204`, and `verify:audio` §ambient/§levels/§weather) together.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  D2_DATA_DIR,
  PRODUCT,
  REPO_ROOT,
  RecordingVoices,
  getOracle113c,
  loadProductModule,
  oracleAmbientScope,
  oracleGroupMembers,
  oracleSampleFacts,
  requireExport,
  summarize,
  type Oracle113c,
} from './harness-113c.ts'
import { FakeAudioContext } from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const S4 = '#946 Tier 4 E2E scenarios'

interface RecordViewC {
  readonly handle: number
  readonly id: number
  readonly state: number
  readonly x?: number
  readonly y?: number
}

interface SoundRecordsC {
  play(id: number, o?: Record<string, unknown>): number
  stop(handle: number): void
  stopAll(): void
  update(): void
  endTick(): void
  records(): RecordViewC[]
}

interface SoundEnvironControllerC {
  enterLevel?(levelId: number, tod?: number): void
  onEnterArea?(levelId: number, tod?: number): void
  setLevel?(levelId: number, tod?: number): void
  setTimeOfDay?(tod: number): void
  setWeather?(opts: Record<string, unknown> | boolean, intensity?: number): void
  setRaining?(raining: boolean, targetVol?: number): void
  triggerThunder?(): number
  playThunder?(): number
  tick(gameTick?: number, opts?: Record<string, unknown>): void
  stopAll?(): void
}

type SoundEnvironCtor = new (opts: Record<string, unknown>) => SoundEnvironControllerC

let O: Oracle113c

beforeAll(() => {
  O = getOracle113c()
}, 600_000)

function setArea(env: SoundEnvironControllerC, levelId: number, tod = 2): void {
  if (typeof env.enterLevel === 'function') env.enterLevel(levelId, tod)
  else if (typeof env.onEnterArea === 'function') env.onEnterArea(levelId, tod)
  else if (typeof env.setLevel === 'function') env.setLevel(levelId, tod)
  else throw new Error(`[${S4}] SoundEnviron113c missing enterLevel / onEnterArea / setLevel`)
}

function setTod(env: SoundEnvironControllerC, tod: number): void {
  if (typeof env.setTimeOfDay === 'function') env.setTimeOfDay(tod)
}

function setRain(env: SoundEnvironControllerC, raining: boolean, volume = 255): void {
  if (typeof env.setRaining === 'function') env.setRaining(raining, volume)
  else if (typeof env.setWeather === 'function') {
    env.setWeather({ raining, rainVolume: volume, rainIntensity: raining ? volume / 255 : 0 }, volume)
  } else throw new Error(`[${S4}] SoundEnviron113c missing setRaining / setWeather`)
}

function fireThunder(env: SoundEnvironControllerC): number {
  if (typeof env.triggerThunder === 'function') return env.triggerThunder()
  if (typeof env.playThunder === 'function') return env.playThunder()
  throw new Error(`[${S4}] SoundEnviron113c missing triggerThunder / playThunder`)
}

async function createHarness(seed: number): Promise<{
  env: SoundEnvironControllerC
  records: SoundRecordsC
  voices: RecordingVoices
  preloadedActs: number[]
}> {
  const recMod = (await loadProductModule(PRODUCT.records, S4)) as {
    SoundRecords113c: { fromSounds113c(o?: Record<string, unknown>): SoundRecordsC }
  }
  const envMod = await loadProductModule(PRODUCT.soundEnvironClient, S4)
  const Ctor = requireExport<SoundEnvironCtor>(envMod, 'SoundEnviron113c', PRODUCT.soundEnvironClient, S4)
  const voices = new RecordingVoices()
  const rng = new D2Rng(seed)
  const records = recMod.SoundRecords113c.fromSounds113c({
    rng,
    voices,
    listenerPos: () => ({ x: 0, y: 0 }),
    sampleFacts: oracleSampleFacts,
  })
  const preloadedActs: number[] = []
  const env = new Ctor({
    records,
    rng,
    preloadAct: (act: number) => preloadedActs.push(act),
    onEnterAct: (act: number) => preloadedActs.push(act),
    preloadPack: (packId: string) => {
      const m = /^sfx-ambient-act([1-5])/.exec(packId)
      if (m) preloadedActs.push(Number(m[1]))
    },
  })
  return { env, records, voices, preloadedActs }
}

describe('M21-P4 #946 — Tier 4 end-to-end scenarios (F15–F18)', () => {
  it('[T4-P4-01] 5-Act progression journey (`1 → 2 → 3 → 40 → 50 → 75 → 83 → 103 → 108 → 109 → 136`): preloads `sfx-ambient-act1..5`, switches ambience & events per level, and leaves zero zombie loops', async () => {
    const { env, records, voices, preloadedActs } = await createHarness(0x4101)
    const waypoints = [1, 2, 3, 40, 50, 75, 83, 103, 108, 109, 136]
    let tick = 1

    for (const lvlId of waypoints) {
      const oracleLvl = O.levels.get(lvlId)!
      const oracleEnv = O.soundEnviron[oracleLvl.soundEnv]!
      const expectedAmb = new Set(oracleGroupMembers(oracleEnv.dayAmbience))

      setArea(env, lvlId, 2)
      for (let step = 0; step < 30; step += 1, tick += 1) {
        env.tick(tick, { levelId: lvlId, tod: 2 })
        records.update()
        records.endTick()
      }

      if (expectedAmb.size > 0) {
        const activeAmb = records.records().filter((r) => expectedAmb.has(r.id))
        expect(activeAmb.length, `level ${String(lvlId)} (${oracleLvl.name}) active Day Ambience`).toBe(1)
      }
      // Ensure no ambience from earlier acts/environments remains alive:
      const allAmbIds = new Set<number>()
      for (const e of O.soundEnviron) {
        if (e.dayAmbience > 0) for (const m of oracleGroupMembers(e.dayAmbience)) allAmbIds.add(m)
        if (e.nightAmbience > 0) for (const m of oracleGroupMembers(e.nightAmbience)) allAmbIds.add(m)
      }
      const foreignAmb = records
        .records()
        .filter((r) => allAmbIds.has(r.id) && !expectedAmb.has(r.id))
      expect(foreignAmb, `level ${String(lvlId)}: zero zombie ambience from prior levels`).toEqual([])
    }

    expect([...new Set(preloadedActs)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
    expect(voices.starts().length).toBeGreaterThanOrEqual(waypoints.length)
  })

  it('[T4-P4-02] full Day → Dusk → Night → Dawn → Day cycle in Blood Moor (`levelId 2`) with thunderstorm overlay: 250-tick crossfades + spatialized events + rain ramp + thunder', async () => {
    const { env, records, voices } = await createHarness(0x4102)
    const env1 = O.soundEnviron[O.levels.get(2)!.soundEnv]!
    const dayAmb = new Set(oracleGroupMembers(env1.dayAmbience))
    const nightAmb = new Set(oracleGroupMembers(env1.nightAmbience))
    const dayEv = new Set(oracleGroupMembers(env1.dayEvent))
    const nightEv = new Set(oracleGroupMembers(env1.nightEvent))

    let tick = 1
    // Phase 1: Day (tod=2) with rain starting
    setArea(env, 2, 2)
    setRain(env, true, 180)
    for (; tick <= 200; tick += 1) {
      env.tick(tick, { levelId: 2, tod: 2, raining: true, rainVolume: 180 })
      records.update()
      records.endTick()
    }
    expect(records.records().some((r) => dayAmb.has(r.id))).toBe(true)
    expect(records.records().some((r) => r.id === 64)).toBe(true)

    // Phase 2: Transition to Night (tod=0) + fire thunder
    setTod(env, 0)
    fireThunder(env)
    env.tick(tick, { levelId: 2, tod: 0, raining: true, rainVolume: 180 })
    records.update()
    records.endTick()
    tick += 1
    expect(records.records().some((r) => r.id >= 202 && r.id <= 204), 'thunder plays during storm').toBe(true)
    expect(records.records().some((r) => dayAmb.has(r.id)), 'Day Ambience crossfading out').toBe(true)
    expect(records.records().some((r) => nightAmb.has(r.id)), 'Night Ambience crossfading in').toBe(true)

    // Advance past 250-tick crossfade:
    for (let i = 0; i < 260; i += 1, tick += 1) {
      env.tick(tick, { levelId: 2, tod: 0, raining: true, rainVolume: 180 })
      records.update()
      records.endTick()
    }
    expect(records.records().some((r) => dayAmb.has(r.id)), 'Day Ambience finished fade-out').toBe(false)
    expect(records.records().some((r) => nightAmb.has(r.id)), 'Night Ambience steady').toBe(true)

    // Phase 3: Dawn (tod=1) + rain clearing
    setTod(env, 1)
    setRain(env, false, 0)
    for (let i = 0; i < 260; i += 1, tick += 1) {
      env.tick(tick, { levelId: 2, tod: 1, raining: false, rainVolume: 0 })
      records.update()
      records.endTick()
    }
    expect(records.records().some((r) => dayAmb.has(r.id)), 'Dawn restores Day Ambience').toBe(true)
    expect(records.records().some((r) => nightAmb.has(r.id)), 'Night Ambience faded out').toBe(false)
    expect(records.records().some((r) => r.id === 64), 'rain ramped down and stopped').toBe(false)

    // At least one Day Event or Night Event fired with spatial offset during the 720-tick cycle:
    expect(
      voices.starts().some((s) => dayEv.has(s.soundId) || nightEv.has(s.soundId)),
      'at least one Day/Night Event fired during cycle',
    ).toBe(true)
  })

  it('[T4-P4-03] outdoor storm (`Cold Plains levelId 3`) → indoor cave (`Cave Level 1 levelId 9`, `Indoors=1`) → outdoor (`Stony Field levelId 4`) suppresses weather indoors and resumes outdoors', async () => {
    const { env, records } = await createHarness(0x4103)
    const coldPlainsAmb = new Set(oracleGroupMembers(O.soundEnviron[O.levels.get(3)!.soundEnv]!.dayAmbience))
    const caveAmb = new Set(oracleGroupMembers(O.soundEnviron[O.levels.get(9)!.soundEnv]!.dayAmbience))
    const stonyFieldAmb = new Set(oracleGroupMembers(O.soundEnviron[O.levels.get(4)!.soundEnv]!.dayAmbience))

    let tick = 1
    // 1. Outdoor Cold Plains in rain:
    setArea(env, 3, 2)
    setRain(env, true, 210)
    for (; tick <= 40; tick += 1) {
      env.tick(tick, { levelId: 3, tod: 2, raining: true, rainVolume: 210 })
      records.update()
      records.endTick()
    }
    expect(records.records().some((r) => coldPlainsAmb.has(r.id))).toBe(true)
    expect(records.records().some((r) => r.id === 64)).toBe(true)

    // 2. Enter Cave Level 1 (Indoors=1):
    setArea(env, 9, 2)
    for (; tick <= 90; tick += 1) {
      env.tick(tick, { levelId: 9, tod: 2, raining: true, rainVolume: 210 })
      records.update()
      records.endTick()
    }
    expect(records.records().some((r) => caveAmb.has(r.id)), 'cave ambience plays indoors').toBe(true)
    expect(records.records().some((r) => r.id === 64), 'rain suppressed indoors').toBe(false)

    // 3. Exit to Stony Field (Indoors=0):
    setArea(env, 4, 2)
    for (; tick <= 120; tick += 1) {
      env.tick(tick, { levelId: 4, tod: 2, raining: true, rainVolume: 210 })
      records.update()
      records.endTick()
    }
    expect(records.records().some((r) => stonyFieldAmb.has(r.id)), 'outdoor ambience resumes').toBe(true)
    expect(records.records().some((r) => r.id === 64), 'rain loop resumes outdoors').toBe(true)
  })

  it('[T4-P4-04] end-to-end pack-to-voice pipeline + cumulative `verify:audio` (`tables`, `sfx-core`, `music`, `ambient`, `levels`, `weather`)', async () => {
    await loadProductModule(PRODUCT.packAmbientSounds, S4)
    const idxMod = (await loadProductModule(PRODUCT.sfxPackIndex, S4)) as {
      SFX_PACK_INDEX_113C: Readonly<Record<number, readonly [string, number, number, number, number, number]>>
    }
    const loaderMod = await loadProductModule(PRODUCT.sfxChunkLoader, S4)
    const SfxChunkLoaderCtor = requireExport<
      new (o?: Record<string, unknown>) => {
        loadSoundBuffer(id: number, ctx?: unknown): Promise<unknown>
      }
    >(loaderMod, 'SfxChunkLoader', PRODUCT.sfxChunkLoader, S4)

    const fakeCtx = new FakeAudioContext()
    const loader = new SfxChunkLoaderCtor({
      fetch: async (url: string) => {
        const rel = url.replace(/^\/+/, '')
        const bytes = new Uint8Array(readFileSync(join(REPO_ROOT, 'public', rel)))
        return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer }
      },
      audioContext: () => fakeCtx,
    })

    // Decode rain (64), thunder (202), and one ambient sound from each Act 1..5:
    const scope = oracleAmbientScope(O)
    const testIds = [64, 202]
    for (let act = 1; act <= 5; act += 1) {
      const firstId = [...(scope.actSoundIds.get(act) ?? [])][0]
      if (firstId !== undefined) testIds.push(firstId)
    }
    for (const id of testIds) {
      expect(idxMod.SFX_PACK_INDEX_113C[id], `tuple for id ${String(id)}`).toBeDefined()
      const buf = await loader.loadSoundBuffer(id, fakeCtx)
      expect(buf, `decoded AudioBuffer for id ${String(id)}`).toBeTruthy()
    }

    const auditMod = await loadProductModule(PRODUCT.audit, S4)
    const runAudioAudit = requireExport<
      (opts?: {
        rootDir?: string
        mpqDir?: string
        sections?: readonly string[]
      }) => Promise<{ ok: boolean; sections: readonly { id: string; errors: readonly string[] }[] }>
    >(auditMod, 'runAudioAudit', PRODUCT.audit, S4)

    const rep = await runAudioAudit({
      rootDir: REPO_ROOT,
      mpqDir: D2_DATA_DIR,
      sections: ['tables', 'sfx-core', 'music', 'ambient', 'levels', 'weather'],
    })
    const allErrors = rep.sections.flatMap((s) => s.errors.map((e) => `[${s.id}] ${e}`))
    expect(allErrors, summarize(allErrors)).toEqual([])
    expect(rep.ok).toBe(true)
  })
})
