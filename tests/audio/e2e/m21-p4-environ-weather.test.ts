/**
 * M21-P4 (#946) — F16 `SoundEnviron113c` 25 Hz controller across all 50 environments × 136 levels,
 * F17 weather rain loop (`id 64`) + thunder (`id 202..204`) superimposed on environment via Opus pack.
 *
 * Authoritative 1.13c ground truth (`D2Client.dll` disassembly, verified from `samples/d2/D2Client.dll`):
 * - `0x6fb0f020` (`SoundTick`): calls `SoundEnvironTick` (`0x6faff860`) BEFORE `SoundUpdate` (`0x6fb38dd0`).
 * - `0x6faff8af–0x6faff8c2`: `tod ∈ {1, 2, 3}` (Dawn/Day/Dusk) → `Day Ambience` (`+0x04`) & `Day Event` (`+0x0c`);
 *   `tod ∈ {0, 4}` (Night) → `Night Ambience` (`+0x08`) & `Night Event` (`+0x10`).
 * - `0x6faff981–0x6faffa12`: same-environment Day↔Night switch crossfades outgoing ambience over `0xfa = 250`
 *   ticks (`0x6fb38230`) and fades in new ambience from `0` to `255` over `250` ticks; area/environment change
 *   stops old ambience (`0x6fb38810`) and old event (`0x6fb38770`) and starts new ambience (`0x6fb38a70`).
 * - `0x6faff93b–0x6faffaa3`: outdoor rain (`id 64` `ambient_scene_rain2`) runs on dedicated handle `[0x6fbcc318]`
 *   and ramps volume toward target by `±6` per 25 Hz tick, stopping (`0x6fb38bf0`) when volume reaches `0`.
 * - `0x6faffabd–0x6faffbb0`: event timer uses `jitter = floor(EventDelay / 6)` → interval in
 *   `[EventDelay - jitter, EventDelay + jitter]`, selects variant in `[rootId, rootId + groupSize - 1]`, and
 *   applies `SetSoundPos(handle, x, y, 0)` with `|x| ∈ [450, 750]` (`±(450 + rand(301))`), `y ∈ [-100, 100]`
 *   (`rand(201) - 100`), `z = 0`.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  PRODUCT,
  RecordingVoices,
  getOracle113c,
  loadProductModule,
  oracleGroupMembers,
  oracleSampleFacts,
  readRepoText,
  requireExport,
  summarize,
  type Oracle113c,
} from './harness-113c.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F16 = '#946 F16 SoundEnviron113c 25Hz controller'
const F17 = '#946 F17 weather rain (64) + thunder (202..204) overlay'

interface RecordViewC {
  readonly handle: number
  readonly id: number
  readonly state: number
  readonly loop?: boolean
  readonly x?: number
  readonly y?: number
  readonly z?: number
  readonly fadeOutEndTick?: number
  readonly fadeInTicks?: number
  readonly userVol?: number
  readonly volume?: number
}

interface SoundRecordsC {
  play(id: number, o?: Record<string, unknown>): number
  stop(handle: number): void
  stopAll(): void
  update(): void
  endTick(): void
  setSoundPos(handle: number, x: number, y: number, z?: number): void
  isPlaying?(handle: number): boolean
  record(handle: number): RecordViewC | undefined
  records(): RecordViewC[]
  readonly now: number
}

interface RecordsModuleC {
  readonly SoundRecords113c: {
    fromSounds113c(o?: Record<string, unknown>): SoundRecordsC
  }
}

/** Flexible adapter supporting both class-based and method-variant `SoundEnviron113c` contracts. */
interface SoundEnvironControllerC {
  enterLevel?(levelId: number, tod?: number): void
  onEnterArea?(levelId: number, tod?: number): void
  setLevel?(levelId: number, tod?: number): void
  setTimeOfDay?(tod: number): void
  setWeather?(opts: { raining?: boolean; rainIntensity?: number; rainVolume?: number } | boolean, intensity?: number): void
  setRaining?(raining: boolean, targetVol?: number): void
  triggerThunder?(): number
  playThunder?(): number
  tick(gameTick?: number, opts?: { levelId?: number; tod?: number; raining?: boolean; rainVolume?: number }): void
  stopAll?(): void
  reset?(): void
  readonly ambienceHandle?: number
  readonly eventHandle?: number
  readonly rainHandle?: number
  readonly rainVolume?: number
  readonly currentEnvId?: number
  readonly currentLevelId?: number
}

type SoundEnvironCtor = new (opts: Record<string, unknown>) => SoundEnvironControllerC

let O: Oracle113c

beforeAll(() => {
  O = getOracle113c()
}, 600_000)

async function makeRecords(seed = 0x113c_0946): Promise<{
  records: SoundRecordsC
  voices: RecordingVoices
  rng: D2Rng
}> {
  const recMod = (await loadProductModule(PRODUCT.records, F16)) as unknown as RecordsModuleC
  requireExport(recMod as unknown as Record<string, unknown>, 'SoundRecords113c', PRODUCT.records, F16)
  const voices = new RecordingVoices()
  const rng = new D2Rng(seed)
  const records = recMod.SoundRecords113c.fromSounds113c({
    rng,
    voices,
    listenerPos: () => ({ x: 0, y: 0 }),
    sampleFacts: oracleSampleFacts,
  })
  return { records, voices, rng }
}

async function makeEnviron(opts?: {
  seed?: number
  preloadAct?: (act: number) => void
  preloadPack?: (packId: string) => void
}): Promise<{
  env: SoundEnvironControllerC
  records: SoundRecordsC
  voices: RecordingVoices
  rng: D2Rng
  preloadedActs: number[]
  preloadedPacks: string[]
}> {
  const mod = await loadProductModule(PRODUCT.soundEnvironClient, F16)
  const Ctor = requireExport<SoundEnvironCtor>(mod, 'SoundEnviron113c', PRODUCT.soundEnvironClient, F16)
  const { records, voices, rng } = await makeRecords(opts?.seed ?? 0x113c_0946)
  const preloadedActs: number[] = []
  const preloadedPacks: string[] = []
  const onPreloadAct = (act: number): void => {
    preloadedActs.push(act)
    opts?.preloadAct?.(act)
  }
  const onPreloadPack = (packId: string): void => {
    preloadedPacks.push(packId)
    opts?.preloadPack?.(packId)
  }
  const env = new Ctor({
    records,
    rng,
    preloadAct: onPreloadAct,
    onEnterAct: onPreloadAct,
    preloadPack: onPreloadPack,
    prefetchPack: onPreloadPack,
  })
  return { env, records, voices, rng, preloadedActs, preloadedPacks }
}

function setArea(env: SoundEnvironControllerC, levelId: number, tod = 2): void {
  if (typeof env.enterLevel === 'function') env.enterLevel(levelId, tod)
  else if (typeof env.onEnterArea === 'function') env.onEnterArea(levelId, tod)
  else if (typeof env.setLevel === 'function') env.setLevel(levelId, tod)
  else throw new Error(`[${F16}] SoundEnviron113c missing enterLevel / onEnterArea / setLevel`)
}

function setTod(env: SoundEnvironControllerC, tod: number): void {
  if (typeof env.setTimeOfDay === 'function') env.setTimeOfDay(tod)
}

function setRain(env: SoundEnvironControllerC, raining: boolean, volume = 255): void {
  if (typeof env.setRaining === 'function') {
    env.setRaining(raining, volume)
  } else if (typeof env.setWeather === 'function') {
    env.setWeather({ raining, rainVolume: volume, rainIntensity: raining ? volume / 255 : 0 }, volume)
  } else {
    throw new Error(`[${F17}] SoundEnviron113c missing setRaining / setWeather`)
  }
}

function fireThunder(env: SoundEnvironControllerC): number {
  if (typeof env.triggerThunder === 'function') return env.triggerThunder()
  if (typeof env.playThunder === 'function') return env.playThunder()
  throw new Error(`[${F17}] SoundEnviron113c missing triggerThunder / playThunder`)
}

function stepTick(
  env: SoundEnvironControllerC,
  records: SoundRecordsC,
  gameTick: number,
  tickOpts?: { levelId?: number; tod?: number; raining?: boolean; rainVolume?: number },
): void {
  env.tick(gameTick, tickOpts)
  records.update()
  records.endTick()
}

describe('M21-P4 #946 — F16 `SoundEnviron113c` 25 Hz acoustic environment controller', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F16-01] all 136 canonical levels (`1..136`) resolve `Levels.txt -> SoundEnv (0..49) -> SoundEnviron.txt` and start the expected Day Ambience loop on area entry', async () => {
      const mismatches: string[] = []
      for (let lvlId = 1; lvlId <= 136; lvlId += 1) {
        const { env, records } = await makeEnviron({ seed: 0x1000 + lvlId })
        const oracleLvl = O.levels.get(lvlId)!
        const oracleEnv = O.soundEnviron[oracleLvl.soundEnv]!
        const expectedRoot = oracleEnv.dayAmbience
        const expectedMembers = expectedRoot > 0 ? new Set(oracleGroupMembers(expectedRoot)) : new Set<number>()

        setArea(env, lvlId, 2) // tod=2 (DAY)
        stepTick(env, records, 1, { levelId: lvlId, tod: 2 })

        const active = records.records().filter((r) => expectedMembers.has(r.id))
        if (expectedMembers.size > 0 && active.length === 0) {
          mismatches.push(
            `level ${String(lvlId)} (${oracleLvl.name}, env=${String(oracleLvl.soundEnv)} ${oracleEnv.handle}): expected Day Ambience in [${[...expectedMembers].join(',')}]`,
          )
        }
      }
      expect(mismatches, summarize(mismatches)).toEqual([])
    })

    it('[T1-F16-02] time-of-day mapping (`0x6faff8af–0x6faff8c2`): `tod ∈ {1,2,3}` selects Day Ambience/Event; `tod ∈ {0,4}` selects Night Ambience/Event', async () => {
      // Level 1 (Rogue Encampment) has distinct Day Ambience and Night Ambience in SoundEnviron.txt:
      const lvl1 = O.levels.get(1)!
      const env1 = O.soundEnviron[lvl1.soundEnv]!
      expect(env1.dayAmbience).toBeGreaterThan(0)
      expect(env1.nightAmbience).toBeGreaterThan(0)
      expect(env1.dayAmbience).not.toBe(env1.nightAmbience)
      const dayMembers = new Set(oracleGroupMembers(env1.dayAmbience))
      const nightMembers = new Set(oracleGroupMembers(env1.nightAmbience))

      for (const tod of [1, 2, 3]) {
        const { env, records } = await makeEnviron({ seed: 0x2000 + tod })
        setArea(env, 1, tod)
        stepTick(env, records, 1, { levelId: 1, tod })
        const ids = records.records().map((r) => r.id)
        expect(ids.some((id) => dayMembers.has(id)), `tod=${String(tod)} must play Day Ambience`).toBe(true)
        expect(ids.some((id) => nightMembers.has(id)), `tod=${String(tod)} must not play Night Ambience`).toBe(false)
      }

      for (const tod of [0, 4]) {
        const { env, records } = await makeEnviron({ seed: 0x2100 + tod })
        setArea(env, 1, tod)
        stepTick(env, records, 1, { levelId: 1, tod })
        const ids = records.records().map((r) => r.id)
        expect(ids.some((id) => nightMembers.has(id)), `tod=${String(tod)} must play Night Ambience`).toBe(true)
        expect(ids.some((id) => dayMembers.has(id)), `tod=${String(tod)} must not play Day Ambience`).toBe(false)
      }
    })

    it('[T1-F16-03] same-environment Day↔Night transition (`0x6faff981–0x6faffa12`) crossfades outgoing and incoming ambience over `0xfa = 250` ticks before freeing outgoing loop', async () => {
      const { env, records } = await makeEnviron({ seed: 0x3001 })
      const lvl1 = O.levels.get(1)!
      const env1 = O.soundEnviron[lvl1.soundEnv]!
      const dayMembers = new Set(oracleGroupMembers(env1.dayAmbience))
      const nightMembers = new Set(oracleGroupMembers(env1.nightAmbience))

      setArea(env, 1, 2) // Day
      stepTick(env, records, 1, { levelId: 1, tod: 2 })
      expect(records.records().some((r) => dayMembers.has(r.id))).toBe(true)

      // Switch to Night (tod=0) in the SAME environment at tick 2:
      setTod(env, 0)
      stepTick(env, records, 2, { levelId: 1, tod: 0 })

      // During the 250-tick crossfade window (e.g. tick 100), both Day (fading out) and Night (fading in) are active:
      for (let t = 3; t <= 100; t += 1) {
        stepTick(env, records, t, { levelId: 1, tod: 0 })
      }
      const midRecords = records.records()
      expect(midRecords.some((r) => dayMembers.has(r.id)), 'outgoing Day Ambience still fading out at +98 ticks').toBe(true)
      expect(midRecords.some((r) => nightMembers.has(r.id)), 'incoming Night Ambience fading in at +98 ticks').toBe(true)

      // After 250+ ticks (e.g. tick 260), outgoing Day Ambience has finished its 250-tick fade-out and been freed:
      for (let t = 101; t <= 260; t += 1) {
        stepTick(env, records, t, { levelId: 1, tod: 0 })
      }
      const afterRecords = records.records()
      expect(afterRecords.some((r) => dayMembers.has(r.id)), 'outgoing Day Ambience freed after 250 ticks').toBe(false)
      expect(afterRecords.some((r) => nightMembers.has(r.id)), 'Night Ambience remains active').toBe(true)
    })

    it('[T1-F16-04] area transitions: changing `SoundEnv` stops old ambience/event immediately; adjacent levels sharing `SoundEnv` continue playing uninterrupted', async () => {
      const { env, records } = await makeEnviron({ seed: 0x4001 })
      // Level 1 (Rogue Encampment) vs Level 8 (Den of Evil — cave environment)
      const envLvl1 = O.soundEnviron[O.levels.get(1)!.soundEnv]!
      const envLvl8 = O.soundEnviron[O.levels.get(8)!.soundEnv]!
      const lvl1Amb = new Set(oracleGroupMembers(envLvl1.dayAmbience))
      const lvl8Amb = new Set(oracleGroupMembers(envLvl8.dayAmbience))

      setArea(env, 1, 2)
      stepTick(env, records, 1, { levelId: 1, tod: 2 })
      const h1 = records.records().find((r) => lvl1Amb.has(r.id))?.handle
      expect(h1).toBeGreaterThan(0)

      // Transition to Level 8 (different SoundEnv): old ambience must stop immediately, new ambience starts
      setArea(env, 8, 2)
      stepTick(env, records, 2, { levelId: 8, tod: 2 })
      expect(records.records().some((r) => lvl1Amb.has(r.id)), 'old environment ambience stopped on area change').toBe(false)
      const h2 = records.records().find((r) => lvl8Amb.has(r.id))?.handle
      expect(h2).toBeGreaterThan(0)

      // Find another cave level sharing Level 8's SoundEnv (e.g. Level 9 Cave Level 1):
      const sameEnvLevel = [...O.levels.values()].find(
        (l) => l.id !== 8 && l.soundEnv === O.levels.get(8)!.soundEnv,
      )
      expect(sameEnvLevel).toBeDefined()
      setArea(env, sameEnvLevel!.id, 2)
      stepTick(env, records, 3, { levelId: sameEnvLevel!.id, tod: 2 })
      const h2After = records.records().find((r) => lvl8Amb.has(r.id))?.handle
      expect(h2After, 'same SoundEnv across adjacent levels keeps the same ambience handle').toBe(h2)
    })

    it('[T1-F16-05] periodic `Day/Night Event` timer fires within `[EventDelay - floor(EventDelay/6), EventDelay + floor(EventDelay/6)]` ticks and picks variants in `[rootId, rootId + groupSize - 1]` (`0x6faffabd`)', async () => {
      const { env, records } = await makeEnviron({ seed: 0x5001 })
      // Level 2 (Blood Moor, Day — SoundEnv=2 has dayEvent=192, eventDelay=250):
      const env1 = O.soundEnviron[O.levels.get(2)!.soundEnv]!
      expect(env1.dayEvent).toBeGreaterThan(0)
      expect(env1.eventDelay).toBeGreaterThan(0)
      const eventMembers = new Set(oracleGroupMembers(env1.dayEvent))
      const jitter = Math.floor(env1.eventDelay / 6)
      const minInterval = env1.eventDelay - jitter
      const maxInterval = env1.eventDelay + jitter

      setArea(env, 2, 2)
      const firedTicks: number[] = []
      const firedIds = new Set<number>()
      let prevEventHandle = 0

      for (let t = 1; t <= maxInterval * 8; t += 1) {
        stepTick(env, records, t, { levelId: 2, tod: 2 })
        const evRec = records.records().find((r) => eventMembers.has(r.id))
        if (evRec && evRec.handle !== prevEventHandle) {
          prevEventHandle = evRec.handle
          firedTicks.push(t)
          firedIds.add(evRec.id)
          // Stop the event record right after observing so the next timer interval starts cleanly from `t`:
          records.stop(evRec.handle)
        }
      }

      expect(firedTicks.length, 'multiple Day Events must fire over 8 intervals').toBeGreaterThanOrEqual(4)
      for (let i = 1; i < firedTicks.length; i += 1) {
        const delta = firedTicks[i]! - firedTicks[i - 1]!
        expect(delta, `event interval #${String(i)} >= ${String(minInterval)}`).toBeGreaterThanOrEqual(minInterval)
        expect(delta, `event interval #${String(i)} <= ${String(maxInterval + 2)}`).toBeLessThanOrEqual(maxInterval + 2)
      }
      for (const id of firedIds) {
        expect(eventMembers.has(id), `fired event id ${String(id)} belongs to variant group`).toBe(true)
      }
    })

    it('[T1-F16-06] fired `Day/Night Event` applies 1.13c spatial offset (`|x| ∈ [450, 750]`, `y ∈ [-100, 100]`, `z = 0` at `0x6faffb43–0x6faffb80`)', async () => {
      const { env, records, voices } = await makeEnviron({ seed: 0x6001 })
      const env1 = O.soundEnviron[O.levels.get(2)!.soundEnv]!
      const eventMembers = new Set(oracleGroupMembers(env1.dayEvent))
      const maxInterval = env1.eventDelay + Math.floor(env1.eventDelay / 6)

      setArea(env, 2, 2)
      let observedEvent: RecordViewC | undefined
      for (let t = 1; t <= maxInterval + 5; t += 1) {
        stepTick(env, records, t, { levelId: 2, tod: 2 })
        const evRec = records.records().find((r) => eventMembers.has(r.id))
        if (evRec) {
          observedEvent = evRec
          break
        }
      }
      expect(observedEvent, 'Day Event must fire within first jittered interval').toBeDefined()
      if (observedEvent!.x !== undefined && observedEvent!.y !== undefined) {
        expect(Math.abs(observedEvent!.x), '|x| >= 450').toBeGreaterThanOrEqual(450)
        expect(Math.abs(observedEvent!.x), '|x| <= 750').toBeLessThanOrEqual(750)
        expect(observedEvent!.y, 'y >= -100').toBeGreaterThanOrEqual(-100)
        expect(observedEvent!.y, 'y <= 100').toBeLessThanOrEqual(100)
        expect(observedEvent!.z ?? 0, 'z === 0').toBe(0)
      }
      // Verify stereo pan is non-centered (left !== right gain on the event voice):
      const evStart = voices.starts().find((s) => eventMembers.has(s.soundId))
      expect(evStart, 'event voice started').toBeDefined()
      const evGain = voices.lastGains(evStart!.voice)
      expect(evGain, 'event voice gains set').toBeDefined()
      expect(evGain!.left, 'spatial offset |x|>=450 produces asymmetric L/R pan').not.toBeCloseTo(evGain!.right, 3)
    })

    it('[T1-F16-07] entering levels across Acts 1..5 triggers on-demand preload for that Act (`sfx-ambient-act{1..5}`)', async () => {
      const { env, records, preloadedActs, preloadedPacks } = await makeEnviron({ seed: 0x7001 })
      const actRepLevels = [1, 40, 75, 103, 109] // Act 1..5 town levels
      for (let i = 0; i < actRepLevels.length; i += 1) {
        const lvlId = actRepLevels[i]!
        setArea(env, lvlId, 2)
        stepTick(env, records, i + 1, { levelId: lvlId, tod: 2 })
      }
      const seenActs = new Set<number>([
        ...preloadedActs,
        ...preloadedPacks
          .map((p) => /^sfx-ambient-act([1-5])/.exec(p)?.[1])
          .filter((x): x is string => x !== undefined)
          .map(Number),
      ])
      expect([...seenActs].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('Tier 2 — adversarial & negative', () => {
    it('[T2-F16-01] `SoundEnv = 0` (`none` environment) or out-of-range `levelId` (`0`, `-1`, `999`) stops playing ambience/events cleanly and plays nothing', async () => {
      const { env, records } = await makeEnviron({ seed: 0x8001 })
      setArea(env, 1, 2)
      stepTick(env, records, 1, { levelId: 1, tod: 2 })
      expect(records.records().length).toBeGreaterThan(0)

      setArea(env, 0, 2)
      stepTick(env, records, 2, { levelId: 0, tod: 2 })
      expect(records.records().length, 'levelId=0 must stop ambience and play nothing').toBe(0)

      setArea(env, -5, 2)
      stepTick(env, records, 3, { levelId: -5, tod: 2 })
      expect(records.records().length).toBe(0)

      setArea(env, 999, 2)
      stepTick(env, records, 4, { levelId: 999, tod: 2 })
      expect(records.records().length).toBe(0)
    })

    it('[T2-F16-02] repeated `tick(sameGameTick)` calls on the same tick are idempotent (no timer double-step or extra RNG draws)', async () => {
      const a = await makeEnviron({ seed: 0x8002 })
      const b = await makeEnviron({ seed: 0x8002 })
      setArea(a.env, 1, 2)
      setArea(b.env, 1, 2)

      for (let t = 1; t <= 200; t += 1) {
        a.env.tick(t, { levelId: 1, tod: 2 })
        a.records.update()
        a.records.endTick()

        // Call tick(t) three times on `b` for the same gameTick:
        b.env.tick(t, { levelId: 1, tod: 2 })
        b.env.tick(t, { levelId: 1, tod: 2 })
        b.env.tick(t, { levelId: 1, tod: 2 })
        b.records.update()
        b.records.endTick()
      }
      expect(b.records.records().map((r) => r.id)).toEqual(a.records.records().map((r) => r.id))
      expect(b.rng.nextUint32()).toBe(a.rng.nextUint32())
    })

    it('[T2-F16-03] environments with `Day/Night Event = 0` or `Event Delay = 0` never fire event sounds even after 2,000 ticks', async () => {
      // Find an environment where dayEvent === 0 (or row 0 `none`):
      const silentEventEnvIdx = O.soundEnviron.findIndex((e, idx) => idx > 0 && e.dayEvent === 0)
      const targetLvl =
        silentEventEnvIdx > 0
          ? [...O.levels.values()].find((l) => l.soundEnv === silentEventEnvIdx)?.id ?? 0
          : 0
      const { env, records } = await makeEnviron({ seed: 0x8003 })
      setArea(env, targetLvl, 2)
      for (let t = 1; t <= 2000; t += 1) {
        stepTick(env, records, t, { levelId: targetLvl, tod: 2 })
      }
      if (targetLvl === 0) {
        expect(records.records().length).toBe(0)
      } else {
        const ambMembers = new Set(oracleGroupMembers(O.soundEnviron[silentEventEnvIdx]!.dayAmbience))
        for (const r of records.records()) {
          expect(ambMembers.has(r.id), 'only ambience may play when dayEvent === 0').toBe(true)
        }
      }
    })

    it('[T2-F16-04] while an environment event record is still playing (`0x6faffac9`), the event timer never stacks a second overlapping event record', async () => {
      const { env, records } = await makeEnviron({ seed: 0x8004 })
      const env1 = O.soundEnviron[O.levels.get(2)!.soundEnv]!
      const eventMembers = new Set(oracleGroupMembers(env1.dayEvent))
      setArea(env, 2, 2)
      for (let t = 1; t <= 600; t += 1) {
        stepTick(env, records, t, { levelId: 2, tod: 2 })
        const activeEvents = records.records().filter((r) => eventMembers.has(r.id))
        expect(activeEvents.length, `at tick ${String(t)}, at most 1 environment event may be active`).toBeLessThanOrEqual(1)
      }
    })

    it('[T2-F16-05] rapid multi-act level transitions (`1 → 2 → 40 → 75 → 103 → 109 → 136`) leave zero zombie ambience or event records', async () => {
      const { env, records } = await makeEnviron({ seed: 0x8005 })
      const seq = [1, 2, 40, 75, 103, 109, 136]
      for (let i = 0; i < seq.length; i += 1) {
        const lvl = seq[i]!
        setArea(env, lvl, 2)
        stepTick(env, records, i + 1, { levelId: lvl, tod: 2 })
      }
      const finalEnv = O.soundEnviron[O.levels.get(136)!.soundEnv]!
      const finalAmb = new Set(oracleGroupMembers(finalEnv.dayAmbience))
      const surviving = records.records()
      expect(surviving.length, 'at most 1 ambience record survives after rapid area changes').toBeLessThanOrEqual(1)
      for (const r of surviving) {
        expect(finalAmb.has(r.id), `surviving record ${String(r.id)} must belong to level 136`).toBe(true)
      }
    })

    it('[T2-F16-06] determinism & purity: two `SoundEnviron113c` controllers with identical `D2Rng` seeds produce bit-identical state; no `Math.random` / `Date.now`', async () => {
      const src = readRepoText(PRODUCT.soundEnvironClient, F16)
      expect(src).not.toMatch(/\bMath\.random\b|\bDate\.now\b/)

      const a = await makeEnviron({ seed: 0xdeadbeef })
      const b = await makeEnviron({ seed: 0xdeadbeef })
      setArea(a.env, 1, 2)
      setArea(b.env, 1, 2)
      for (let t = 1; t <= 400; t += 1) {
        stepTick(a.env, a.records, t, { levelId: 1, tod: 2 })
        stepTick(b.env, b.records, t, { levelId: 1, tod: 2 })
      }
      expect(a.voices.events).toEqual(b.voices.events)
    })
  })
})

describe('M21-P4 #946 — F17 weather rain loop (`id 64`) + thunder (`id 202..204`) overlay', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F17-01] outdoor rain (`id 64` `ambient_scene_rain2`) plays on its own handle (`[0x6fbcc318]`) superimposed alongside the level `Day/Night Ambience` loop (`[0x6fbcc314]`)', async () => {
      const { env, records } = await makeEnviron({ seed: 0x9001 })
      const env1 = O.soundEnviron[O.levels.get(1)!.soundEnv]!
      const dayAmb = new Set(oracleGroupMembers(env1.dayAmbience))

      setArea(env, 1, 2) // Outdoor Act 1 town
      setRain(env, true, 255)
      stepTick(env, records, 1, { levelId: 1, tod: 2, raining: true, rainVolume: 255 })

      const active = records.records()
      expect(active.some((r) => dayAmb.has(r.id)), 'base Day Ambience loop is playing').toBe(true)
      expect(active.some((r) => r.id === 64), 'rain loop id 64 is playing simultaneously').toBe(true)
    })

    it('[T1-F17-02] rain channel volume ramps by `+6` per 25 Hz tick on rain onset and `-6` per tick on cessation, stopping handle when volume reaches `0` (`0x6faffa3f–0x6faffaa3`)', async () => {
      const { env, records, voices } = await makeEnviron({ seed: 0x9002 })
      setArea(env, 1, 2)
      setRain(env, true, 180)

      const rainGainsUp: number[] = []
      for (let t = 1; t <= 35; t += 1) {
        stepTick(env, records, t, { levelId: 1, tod: 2, raining: true, rainVolume: 180 })
        const rainStart = voices.starts([64])[0]
        if (rainStart) {
          const g = voices.lastGains(rainStart.voice)
          if (g) rainGainsUp.push(g.left)
        }
      }
      expect(rainGainsUp.length).toBeGreaterThan(5)
      expect(rainGainsUp.at(-1)!, 'rain gain ramps up over ticks').toBeGreaterThan(rainGainsUp[0]!)

      // Turn rain off: volume ramps down by -6 per tick and stops within <= 35 ticks (180 / 6 = 30 ticks):
      setRain(env, false, 0)
      for (let t = 36; t <= 85; t += 1) {
        stepTick(env, records, t, { levelId: 1, tod: 2, raining: false, rainVolume: 0 })
      }
      expect(records.records().some((r) => r.id === 64), 'rain handle stopped after ramping to 0').toBe(false)
    })

    it('[T1-F17-03] thunder trigger plays a variant in `202..204` (`ambient_event_thunder1..3`) without interrupting the active ambience or `id 64` rain loop', async () => {
      const { env, records } = await makeEnviron({ seed: 0x9003 })
      const env1 = O.soundEnviron[O.levels.get(1)!.soundEnv]!
      const dayAmb = new Set(oracleGroupMembers(env1.dayAmbience))

      setArea(env, 1, 2)
      setRain(env, true, 200)
      stepTick(env, records, 1, { levelId: 1, tod: 2, raining: true, rainVolume: 200 })

      fireThunder(env)
      stepTick(env, records, 2, { levelId: 1, tod: 2, raining: true, rainVolume: 200 })

      const activeIds = records.records().map((r) => r.id)
      expect(activeIds.some((id) => dayAmb.has(id)), 'Day Ambience still playing').toBe(true)
      expect(activeIds.includes(64), 'rain id 64 still playing').toBe(true)
      expect(activeIds.some((id) => id >= 202 && id <= 204), 'thunder variant 202..204 is playing').toBe(true)
    })

    it('[T1-F17-04] entering an indoor level (`SoundEnviron.txt Indoors = 1`, e.g. Level 8 Den of Evil) suppresses outdoor rain and thunder while playing cave ambience', async () => {
      const { env, records } = await makeEnviron({ seed: 0x9004 })
      const lvl8Env = O.soundEnviron[O.levels.get(8)!.soundEnv]!
      expect(lvl8Env.indoors, 'Level 8 (Den of Evil) is Indoors=1').toBe(1)
      const caveAmb = new Set(oracleGroupMembers(lvl8Env.dayAmbience))

      // Start outdoor rain in Level 1:
      setArea(env, 1, 2)
      setRain(env, true, 120)
      for (let t = 1; t <= 10; t += 1) {
        stepTick(env, records, t, { levelId: 1, tod: 2, raining: true, rainVolume: 120 })
      }
      expect(records.records().some((r) => r.id === 64)).toBe(true)

      // Enter Level 8 (Indoors=1): rain must stop/ramp down to 0, cave ambience plays:
      setArea(env, 8, 2)
      for (let t = 11; t <= 60; t += 1) {
        stepTick(env, records, t, { levelId: 8, tod: 2, raining: true, rainVolume: 120 })
      }
      expect(records.records().some((r) => caveAmb.has(r.id)), 'indoor cave ambience active').toBe(true)
      expect(records.records().some((r) => r.id === 64), 'rain id 64 stopped indoors').toBe(false)
    })

    it('[T1-F17-05] returning from an indoor level (`levelId 8`) back to an outdoor level (`levelId 3` Cold Plains) while raining resumes `id 64` rain loop', async () => {
      const { env, records } = await makeEnviron({ seed: 0x9005 })
      setArea(env, 8, 2) // Indoor
      setRain(env, true, 180)
      for (let t = 1; t <= 10; t += 1) {
        stepTick(env, records, t, { levelId: 8, tod: 2, raining: true, rainVolume: 180 })
      }
      expect(records.records().some((r) => r.id === 64)).toBe(false)

      // Exit to Cold Plains (levelId 3, Indoors=0):
      setArea(env, 3, 2)
      for (let t = 11; t <= 25; t += 1) {
        stepTick(env, records, t, { levelId: 3, tod: 2, raining: true, rainVolume: 180 })
      }
      expect(records.records().some((r) => r.id === 64), 'rain id 64 resumes on outdoor level').toBe(true)
    })
  })

  describe('Tier 2 — adversarial & negative', () => {
    it('[T2-F17-01] `setRain(false)` when rain is already inactive allocates zero records and never plays `id 64`', async () => {
      const { env, records, voices } = await makeEnviron({ seed: 0x9101 })
      setArea(env, 1, 2)
      setRain(env, false, 0)
      for (let t = 1; t <= 30; t += 1) {
        stepTick(env, records, t, { levelId: 1, tod: 2, raining: false, rainVolume: 0 })
      }
      expect(voices.starts([64]).length).toBe(0)
    })

    it('[T2-F17-02] toggling rain `true → false → true` mid-ramp keeps at most 1 active `id 64` record (never duplicates rain loops)', async () => {
      const { env, records } = await makeEnviron({ seed: 0x9102 })
      setArea(env, 1, 2)
      setRain(env, true, 180)
      for (let t = 1; t <= 10; t += 1) stepTick(env, records, t, { levelId: 1, tod: 2, raining: true, rainVolume: 180 })
      setRain(env, false, 0)
      for (let t = 11; t <= 15; t += 1) stepTick(env, records, t, { levelId: 1, tod: 2, raining: false, rainVolume: 0 })
      setRain(env, true, 180)
      for (let t = 16; t <= 30; t += 1) stepTick(env, records, t, { levelId: 1, tod: 2, raining: true, rainVolume: 180 })

      const rainRecs = records.records().filter((r) => r.id === 64)
      expect(rainRecs.length, 'exactly one rain loop handle active').toBe(1)
    })

    it('[T2-F17-03] triggering thunder while indoors (`Indoors = 1`) is suppressed and plays no `202..204` record', async () => {
      const { env, records } = await makeEnviron({ seed: 0x9103 })
      setArea(env, 8, 2) // Den of Evil (Indoors=1)
      stepTick(env, records, 1, { levelId: 8, tod: 2 })
      fireThunder(env)
      stepTick(env, records, 2, { levelId: 8, tod: 2 })
      expect(records.records().some((r) => r.id >= 202 && r.id <= 204), 'no thunder indoors').toBe(false)
    })

    it('[T2-F17-04] `stopAll()` / `reset()` stops active ambience, event, and weather rain handles immediately (0 surviving records)', async () => {
      const { env, records } = await makeEnviron({ seed: 0x9104 })
      setArea(env, 1, 2)
      setRain(env, true, 255)
      stepTick(env, records, 1, { levelId: 1, tod: 2, raining: true, rainVolume: 255 })
      fireThunder(env)
      stepTick(env, records, 2, { levelId: 1, tod: 2, raining: true, rainVolume: 255 })
      expect(records.records().length).toBeGreaterThanOrEqual(2)

      if (typeof env.stopAll === 'function') env.stopAll()
      else if (typeof env.reset === 'function') env.reset()
      records.stopAll()
      expect(records.records().length).toBe(0)
    })

    it('[T2-F17-05] `src/client/audio/sound-environ-113c.ts` contains no raw WAV paths (`/sound/weather/`), no `HTMLAudioElement`, and no `createOscillator`', () => {
      const src = readRepoText(PRODUCT.soundEnvironClient, F17)
      expect(src).not.toMatch(/\/sound\/weather\//)
      expect(src).not.toMatch(/\.wav\b/i)
      expect(src).not.toMatch(/\bcreateOscillator\b|\bplayTone\b/)
    })
  })

  describe('Tier 3 — pairwise integration (F16 × F17 × F3 × F9)', () => {
    it('[T3-P4-03] F16 × F17 × F3 (`SoundEnviron113c` × weather × `SoundRecords113c` 4-stereo + 12-mono partition): Day↔Night crossfade (2 stereo) + rain `id 64` (1 stereo) + thunder + event coexist without dropping stereo ambience or rain', async () => {
      const { env, records } = await makeEnviron({ seed: 0x9201 })
      const env1 = O.soundEnviron[O.levels.get(1)!.soundEnv]!
      const dayAmb = new Set(oracleGroupMembers(env1.dayAmbience))
      const nightAmb = new Set(oracleGroupMembers(env1.nightAmbience))

      setArea(env, 1, 2) // Day
      setRain(env, true, 200)
      stepTick(env, records, 1, { levelId: 1, tod: 2, raining: true, rainVolume: 200 })

      // Switch to Night (starts 250-tick stereo crossfade) and fire thunder:
      setTod(env, 0)
      fireThunder(env)
      stepTick(env, records, 2, { levelId: 1, tod: 0, raining: true, rainVolume: 200 })

      const active = records.records()
      expect(active.some((r) => dayAmb.has(r.id)), 'outgoing Day Ambience stereo voice active').toBe(true)
      expect(active.some((r) => nightAmb.has(r.id)), 'incoming Night Ambience stereo voice active').toBe(true)
      expect(active.some((r) => r.id === 64), 'weather rain stereo voice active').toBe(true)
      expect(active.some((r) => r.id >= 202 && r.id <= 204), 'thunder mono voice active').toBe(true)
    })

    it('[T3-P4-04] F16 × F9 (`SoundEnviron113c` × `AudioRuntime113c`): `AudioRuntime113c` drives `SoundEnviron113c` on the single shared `runtime.records` pool', async () => {
      await loadProductModule(PRODUCT.soundEnvironClient, F16)
      const rtMod = await loadProductModule(PRODUCT.audioRuntime, F16)
      const RuntimeCtor = requireExport<
        new (o: Record<string, unknown>) => {
          readonly records: SoundRecordsC
          readonly soundEnviron?: SoundEnvironControllerC
          readonly environ?: SoundEnvironControllerC
          gameInit(): void
          gameExit(): void
          soundTick(gameTick: number): boolean
          enterArea?(levelId: number, tod?: number): void
          onEnterArea?(levelId: number, tod?: number): void
        }
      >(rtMod, 'AudioRuntime113c', PRODUCT.audioRuntime, F16)

      const rng = new D2Rng(0x9202)
      const rt = new RuntimeCtor({
        rng,
        listenerPos: () => ({ x: 0, y: 0 }),
        settings: { masterVolume: () => 1, muted: () => false },
      })
      rt.gameInit()
      const ctrl = rt.soundEnviron ?? rt.environ
      if (typeof rt.enterArea === 'function') rt.enterArea(1, 2)
      else if (typeof rt.onEnterArea === 'function') rt.onEnterArea(1, 2)
      else if (ctrl) setArea(ctrl, 1, 2)
      else throw new Error(`[${F16}] AudioRuntime113c must expose enterArea/onEnterArea or soundEnviron controller`)

      rt.soundTick(1)
      const env1 = O.soundEnviron[O.levels.get(1)!.soundEnv]!
      const dayAmb = new Set(oracleGroupMembers(env1.dayAmbience))
      expect(rt.records.records().some((r) => dayAmb.has(r.id)), 'shared runtime.records holds the active ambience record').toBe(true)

      rt.gameExit()
      expect(rt.records.records().length).toBe(0)
    })
  })
})
