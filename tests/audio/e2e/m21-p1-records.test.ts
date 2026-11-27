/**
 * M21-P1 (#943) — F3 product record layer `SoundRecords113c` (src/client/audio/sound-records-113c.ts).
 *
 * Every expectation below is a D2Client.dll 1.13c fact (image base 0x6fab0000; verified with
 * `objdump -d` on samples/d2/D2Client.dll, cross-checked with
 * PROJECT.md D22/D23 and explorer_m21r1_943_2/reland_design.md §3). Sample facts injected into the
 * product come from the shipped MPQ WAV headers (independent RIFF walk in the harness).
 *
 * The product is driven through its public API only; the injected `voices` backend merely records
 * what the product emits (it is the product's own output injection point, not a re-implementation).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  PRODUCT,
  RecordingVoices,
  getOracle113c,
  isPlainOneShot,
  loadProductModule,
  oracleBuildSoundPath,
  oracleGroupMembers,
  oracleSampleFacts,
  oracleWavFacts,
  pickRows,
  requireExport,
  type Oracle113c,
  type OracleSoundRow,
} from './harness-113c.ts'

// The gates run on hosts at load average 60+: give oracle/MPQ-heavy tests head-room (per-test overrides still apply).
vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F3 = '#943 F3 SoundRecords113c'

// ── Contract (reland_plan §E.1 + PROJECT.md override iv) ────────────────────────────────────────
interface UnitRefC {
  readonly unitType?: string | number
  readonly id: number
  readonly isLocalPlayer?: boolean
  x?: number
  y?: number
  alive?: boolean
}
interface PlayOptsC {
  readonly unit?: UnitRefC | null
  readonly delayTicks?: number
  readonly a2?: number
  readonly asyncPending?: boolean
}
interface RecordViewC {
  readonly handle: number
  readonly id: number
  readonly state: 0 | 1 | 2
  readonly vol: number
  readonly voice: number
  readonly x: number
  readonly y: number
  readonly z: number
  readonly dist2: number
  readonly priority: number
  readonly start: number
}
interface SoundRecordsC {
  play(id: number, o?: PlayOptsC): number
  setSoundPos(h: number, x: number, y: number, z?: number): boolean
  setAsyncReady(h: number): void
  stop(h: number): void
  update(): void
  endTick(): void
  stopAll(): void
  records(): RecordViewC[]
  record(h: number): RecordViewC | undefined
  readonly now: number
  readonly pauseDuck: number
  readonly soloDuck: number
  activeChannelCount(): number
}
interface RecordsModuleC {
  readonly SoundRecords113c: { fromSounds113c(o?: Record<string, unknown>): SoundRecordsC }
  readonly SOUND_RECORD_POOL_SIZE: number
  readonly SOUND_MAX_CHANNELS: number
  readonly SOUND_TICKS_PER_SECOND: number
  readonly LOCAL_SPEECH_SOUND_RANGE_113C: readonly [number, number]
  readonly LOCAL_PLAYER_PRIORITY_BOOST_113C: number
}
const RECORDS_EXPORTS = ['SoundRecords113c', 'SOUND_RECORD_POOL_SIZE', 'SOUND_MAX_CHANNELS', 'SOUND_TICKS_PER_SECOND', 'LOCAL_SPEECH_SOUND_RANGE_113C', 'LOCAL_PLAYER_PRIORITY_BOOST_113C'] as const

async function recordsModule(): Promise<RecordsModuleC> {
  const m = await loadProductModule(PRODUCT.records, F3)
  for (const n of RECORDS_EXPORTS) requireExport(m, n, PRODUCT.records, F3)
  return m as unknown as RecordsModuleC
}

/** Facts in both accepted shapes: E.1 `{sampleRate, frames, channels}` + reland_design `kind: 'pcm'`. */
type Facts = { readonly kind: 'pcm'; readonly sampleRate: number; readonly frames: number; readonly channels: 1 | 2 }

interface Rig {
  readonly rec: SoundRecordsC
  readonly voices: RecordingVoices
  readonly env: { master: number; paused: boolean; listener: { x: number; y: number } }
}

let O: Oracle113c
const FACTS = new Map<number, Facts>()

function factsFor(ids: readonly number[]): void {
  for (const id of ids) {
    for (const m of oracleGroupMembers(id)) {
      if (FACTS.has(m)) continue
      const row = O.sounds[m]!
      if (oracleBuildSoundPath(m, row.fileName) === null || O.missingMemberIds.includes(m)) continue
      FACTS.set(m, { kind: 'pcm', ...oracleSampleFacts(m) })
    }
  }
}

async function rig(seedLo = 0x12345678, seedHi = 666): Promise<Rig> {
  const R = await recordsModule()
  const voices = new RecordingVoices()
  const env = { master: 100, paused: false, listener: { x: 0, y: 0 } }
  const rec = R.SoundRecords113c.fromSounds113c({
    rng: new D2Rng(seedLo, seedHi),
    master: () => env.master,
    paused: () => env.paused,
    listenerPos: () => env.listener,
    voices,
    sampleFacts: (id: number) => FACTS.get(id),
  })
  return { rec, voices, env }
}

/** One SoundTick of the record layer: SoundUpdate (0x6fb38dd0) then Fn_6fb0d080 + clock++. */
function step(r: Rig, n = 1): void {
  for (let i = 0; i < n; i += 1) {
    r.voices.tick = r.rec.now
    r.rec.update()
    r.rec.endTick()
  }
}

function voiceOf(r: Rig, soundIds: readonly number[], nth = 0): number {
  const s = r.voices.starts(soundIds)[nth]
  if (s === undefined) throw new Error(`no voice started for ${soundIds.join('/')} (#${String(nth)})`)
  return s.voice
}

const ticksOf = (id: number): number => {
  const f = oracleWavFacts(id)
  return Math.ceil((f.frames * 25) / f.sampleRate)
}

// Rows chosen deterministically from the 1.13c tables (first matches by id).
let PLAIN: OracleSoundRow[] // ≥ 13 equal-priority plain mono one-shots, ≥ 1.2 s
let PLAIN_PRIO = 0
let LOW: OracleSoundRow // plain mono one-shot with lower priority
let P255: OracleSoundRow // plain one-shot with Priority 255
let DEFER: OracleSoundRow
let STOP: OracleSoundRow
let COMPOUND: OracleSoundRow
let COMPOUND_NEG: OracleSoundRow
let COMPOUND_GROUP: OracleSoundRow // leader of a Compound variant group
let SOLO: OracleSoundRow
let LOOP_EXEMPT: OracleSoundRow // loop inside the pause-duck exempt range 52..71
let LOOP_DUCKED: OracleSoundRow // loop outside every exempt range, Fade In 0
let TRACK: OracleSoundRow // plain Tracking one-shot
let NOTRACK: OracleSoundRow // plain non-Tracking one-shot
let STEREO_ROWS: OracleSoundRow[] // Stereo=1 rows (stereo channel partition)
let NONE_WAV: OracleSoundRow // Volume > 0 none.wav row
let VOL0: OracleSoundRow
let GROUP4: OracleSoundRow // variant group leader with Group Size >= 4

const PAUSE_EXEMPT = (id: number): boolean => (id >= 1 && id <= 15) || (id >= 52 && id <= 71) || (id >= 4657 && id <= 4698)
const standalone = (r: OracleSoundRow): boolean => r.groupSize === 1 && r.groupBase === r.id && !r.stream && r.volume > 0 && r.duration === 0

beforeAll(() => {
  O = getOracle113c()
  const plain = pickRows(60, (r) => isPlainOneShot(r) && r.stereo === 0, { minSeconds: 1.2, toId: 2933 })
  const byPrio = new Map<number, OracleSoundRow[]>()
  for (const r of plain) byPrio.set(r.priority, [...(byPrio.get(r.priority) ?? []), r])
  const best = [...byPrio.entries()].filter(([, rows]) => rows.length >= 14).sort((a, b) => b[0] - a[0])[0]
  if (best === undefined) throw new Error('oracle: fewer than 14 equal-priority plain one-shots ≥ 1.2 s')
  PLAIN_PRIO = best[0]
  PLAIN = best[1]
  // Lower-priority single-variant row (groupSize 1 ⇒ pickVariant 0x6fb0eea4 returns the id itself; it may sit inside a group).
  LOW = pickRows(1, (r) => r.id < 2934 && !r.stream && r.groupSize === 1 && !r.loop && !r.deferInst && !r.stopInst && r.compound === 0 && r.volume > 0 && r.duration === 0 && r.stereo === 0 && r.priority < PLAIN_PRIO, { minSeconds: 0.3, toId: 2933 })[0]!
  P255 = pickRows(1, (r) => isPlainOneShot(r) && r.priority === 255, { minSeconds: 1.2, toId: 2933 })[0]!
  DEFER = pickRows(1, (r) => standalone(r) && r.id < 2934 && r.deferInst && !r.loop && r.compound === 0, { minSeconds: 1.0 })[0]!
  STOP = pickRows(1, (r) => standalone(r) && r.id < 2934 && r.stopInst && !r.loop && r.compound === 0, { minSeconds: 1.0 })[0]!
  COMPOUND = pickRows(1, (r) => standalone(r) && r.id < 2934 && r.compound >= 4 && r.compound <= 12 && !r.loop && !r.deferInst && !r.stopInst, { minSeconds: 1.0 })[0]!
  COMPOUND_NEG = pickRows(1, (r) => standalone(r) && r.id < 2934 && r.compound < 0 && !r.loop && !r.deferInst && !r.stopInst, { minSeconds: 3.0 })[0]!
  COMPOUND_GROUP = pickRows(1, (r) => r.id < 2934 && r.groupSize >= 3 && r.groupBase === r.id && r.compound > 0 && !r.loop && !r.stream && !r.deferInst && !r.stopInst && r.volume > 0)[0]!
  SOLO = pickRows(1, (r) => r.solo && r.groupSize === 1 && r.groupBase === r.id && !r.loop && r.volume > 0 && r.fadeIn === 0 && r.stereo === 0, { minSeconds: 3.0, fromId: 2934 })[0]!
  LOOP_EXEMPT = pickRows(1, (r) => standalone(r) && r.loop && r.id >= 52 && r.id <= 71 && !r.deferInst && !r.stopInst && r.compound === 0)[0]!
  LOOP_DUCKED = pickRows(1, (r) => standalone(r) && r.loop && !PAUSE_EXEMPT(r.id) && r.fadeIn === 0 && !r.deferInst && !r.stopInst && r.compound === 0 && r.stereo === 0, { toId: 2933 })[0]!
  TRACK = pickRows(1, (r) => isPlainOneShot(r) && r.tracking && r.stereo === 0, { minSeconds: 1.2, toId: 2933 })[0]!
  NOTRACK = pickRows(1, (r) => isPlainOneShot(r) && !r.tracking && r.stereo === 0, { minSeconds: 1.2, toId: 2933 })[0]!
  // Only two Stereo=1 rows are SFX-range records outside music (4378/4379, both long speech lines).
  STEREO_ROWS = pickRows(2, (r) => r.stereo !== 0 && r.groupSize === 1 && r.groupBase === r.id && !r.loop && r.volume > 0 && r.compound === 0 && !r.deferInst, { minSeconds: 5, fromId: 2934, toId: 4656 })
  NONE_WAV = O.sounds.find((r) => r.id > 0 && r.id < 2934 && r.fileName.trim().toLowerCase() === 'none.wav' && r.volume > 0 && r.groupSize === 1 && r.groupBase === r.id && !r.loop && r.compound === 0 && !r.deferInst && !r.stopInst)!
  VOL0 = O.sounds.find((r) => r.id > 0 && r.volume === 0 && r.fileName.trim().toLowerCase() !== 'none.wav')!
  GROUP4 = pickRows(1, (r) => r.id < 2934 && r.groupSize >= 4 && r.groupBase === r.id && !r.loop && !r.stream && !r.deferInst && !r.stopInst && r.compound === 0 && r.volume > 0)[0]!
  for (const r of [NONE_WAV, VOL0]) if (r === undefined) throw new Error('oracle: row category missing')
  factsFor([
    ...PLAIN.map((r) => r.id),
    LOW.id, P255.id, DEFER.id, STOP.id, COMPOUND.id, COMPOUND_NEG.id, COMPOUND_GROUP.id, SOLO.id, LOOP_EXEMPT.id,
    LOOP_DUCKED.id, TRACK.id, NOTRACK.id, ...STEREO_ROWS.map((r) => r.id), GROUP4.id, 202,
  ])
}, 300_000)

const MONSTER_A: UnitRefC = { unitType: 'monster', id: 101, x: 0, y: 0 }
const MONSTER_B: UnitRefC = { unitType: 'monster', id: 102, x: 0, y: 0 }
const localPlayer = (): UnitRefC => ({ unitType: 'player', id: 1, isLocalPlayer: true, x: 0, y: 0 })

describe('M21-P1 #943 — F3 SoundRecords113c record layer (product)', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F3-01] 200-record pool (AllocRec 0x6fb37d80 scans 0x6fbbf2f8..0x6fbc3880 step 0x59): the 201st PlaySound returns 0', async () => {
      const R = await recordsModule()
      const r = await rig()
      expect(R.SOUND_RECORD_POOL_SIZE).toBe(200)
      const handles = Array.from({ length: 200 }, () => r.rec.play(PLAIN[0]!.id))
      expect(handles.every((h) => Number.isInteger(h) && h > 0)).toBe(true)
      expect(new Set(handles).size).toBe(200)
      expect(r.rec.play(PLAIN[0]!.id)).toBe(0)
      expect(r.rec.records().length).toBe(200)
    })

    it('[T1-F3-02] same-id debounce 0x6fb0d7e4–0x6fb0d808: dt 0 and dt 1 are dropped, dt 2 starts', async () => {
      const r = await rig()
      const X = PLAIN[0]!.id
      r.rec.play(X)
      r.rec.play(X)
      step(r) // tick 0: two equal requests → exactly one voice
      expect(r.voices.starts([X]).length, 'dt 0').toBe(1)
      const h1 = r.rec.play(X)
      step(r) // tick 1
      expect(r.voices.starts([X]).length, 'dt 1 must be dropped').toBe(1)
      expect(r.rec.record(h1), 'a dropped one-shot is freed in the same SoundUpdate').toBeUndefined()
      r.rec.play(X)
      step(r) // tick 2
      expect(r.voices.starts([X]).length, 'dt 2 must start').toBe(2)
    })

    it('[T1-F3-03] Defer Inst (0x6fb3929e–0x6fb392ac): a unit-attached request conflicting with a playing same-group record on that unit is dropped, never deferred', async () => {
      const r = await rig()
      const D = DEFER.id
      r.rec.play(D, { unit: MONSTER_A })
      step(r)
      expect(r.voices.starts([D]).length).toBe(1)
      step(r, 2) // tick 3: outside the 2-tick debounce window
      const h2 = r.rec.play(D, { unit: MONSTER_A })
      expect(h2).toBeGreaterThan(0)
      r.voices.tick = r.rec.now
      r.rec.update()
      expect(r.rec.record(h2), 'the new record is flagged stop and freed in this SoundUpdate').toBeUndefined()
      r.rec.endTick()
      step(r, ticksOf(D) + 10) // well past the end of the first instance
      expect(r.voices.starts([D]).length, 'the dropped request must never start later').toBe(1)
    })

    it('[T1-F3-04] Stop Inst (0x6fb3926d–0x6fb39274): the conflicting same-group record is stopped and freed, then the new one starts', async () => {
      const r = await rig()
      const S = STOP.id
      const h1 = r.rec.play(S)
      step(r)
      const v1 = voiceOf(r, [S])
      step(r, 2)
      const h2 = r.rec.play(S)
      r.voices.tick = r.rec.now
      r.rec.update()
      expect(r.voices.stops(v1).length, 'first instance stopped').toBeGreaterThanOrEqual(1)
      expect(r.voices.starts([S]).length, 'second instance started').toBe(2)
      expect(r.rec.record(h1)).toBeUndefined()
      expect(r.rec.record(h2)?.state).toBe(1)
      r.rec.endTick()
    })

    it('[T1-F3-05] Compound (PlaySound 0x6fb38ac8 → 0x6fb37fe0): within Compound ticks the active same-group record is reused; one tick later a new record is made', async () => {
      const r = await rig()
      const C = COMPOUND.id
      const k = COMPOUND.compound
      const h1 = r.rec.play(C)
      step(r) // started at tick 0
      step(r, k - 1) // now === k → age k ≤ Compound
      expect(r.rec.now).toBe(k)
      expect(r.rec.play(C), `age ${String(k)} ≤ Compound ${String(k)}: same handle`).toBe(h1)
      expect(r.rec.records().length).toBe(1)
      step(r) // now === k + 1 → age k + 1 > Compound
      const h3 = r.rec.play(C)
      expect(h3).toBeGreaterThan(0)
      expect(h3).not.toBe(h1)
      expect(r.rec.records().length).toBe(2)
    })

    it('[T1-F3-06] SetSoundPos 0x6fb38ba0: position = (x, y, z + 640), dist² from x/y clamped to ±2000 (SetPos 0x6fb38350); unknown handle → false', async () => {
      const r = await rig()
      const h = r.rec.play(PLAIN[0]!.id)
      expect(r.rec.setSoundPos(h, 300, -200, 0)).toBe(true)
      let v = r.rec.record(h)!
      expect([v.x, v.y, v.z]).toEqual([300, -200, 640])
      expect(v.dist2).toBe(300 * 300 + 200 * 200)
      step(r)
      expect(r.rec.record(h)!.state).toBe(1)
      expect(r.rec.setSoundPos(h, 5000, -7000, 10)).toBe(true)
      v = r.rec.record(h)!
      expect([v.x, v.y, v.z]).toEqual([5000, -7000, 650])
      expect(v.dist2).toBe(2000 * 2000 + 2000 * 2000)
      expect(r.rec.setSoundPos(987_654, 1, 2, 3)).toBe(false)
    })

    it('[T1-F3-07] 16 channels = 12 mono + 4 stereo (D22, 0x6fb0d577): the mono partition saturates at 12 and an equal-priority 13th steals the farthest mono voice', async () => {
      const R = await recordsModule()
      const r = await rig()
      expect(R.SOUND_MAX_CHANNELS).toBe(16)
      const mono = PLAIN.slice(0, 13)
      const handles = mono.slice(0, 12).map((row, i) => {
        const h = r.rec.play(row.id)
        r.rec.setSoundPos(h, 10 * (i + 1), 0, 0) // distinct dist²; farthest = index 11
        return h
      })
      step(r)
      expect(r.voices.starts(mono.slice(0, 12).map((x) => x.id)).length).toBe(12)
      expect(r.rec.activeChannelCount()).toBe(12)
      const farthest = r.rec.record(handles[11]!)!.voice
      expect(farthest).not.toBe(0)
      r.rec.play(mono[12]!.id) // at (0, 0, 320): nearest, equal priority, higher slot
      step(r)
      expect(r.voices.starts([mono[12]!.id]).length, '13th mono request starts').toBe(1)
      const stopped = r.voices.stops().map((e) => e.voice)
      expect(stopped, 'exactly the farthest equal-priority mono voice is stolen').toEqual([farthest])
      expect(r.rec.activeChannelCount()).toBe(12)
    })

    it('[T1-F3-08] soloDuck 0x6fb39449–0x6fb3957e: −2 per tick to 70 while a Solo row is active, +2 per tick back to 100; non-solo output scaled ×0.70, solo output untouched', async () => {
      const r = await rig()
      r.rec.play(LOOP_DUCKED.id)
      step(r, 3)
      const vLoop = voiceOf(r, [LOOP_DUCKED.id])
      const g0 = r.voices.lastGains(vLoop)!
      expect(r.rec.soloDuck).toBe(100)
      const hS = r.rec.play(SOLO.id)
      const down: number[] = []
      for (let i = 0; i < 20; i += 1) {
        step(r)
        down.push(r.rec.soloDuck)
      }
      expect(down).toEqual([98, 96, 94, 92, 90, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70, 70, 70, 70, 70, 70])
      const g1 = r.voices.lastGains(vLoop)!
      const ratio = (g1.left + g1.right) / (g0.left + g0.right)
      expect(ratio, 'non-solo loop scaled by soloDuck/100 (UpdateChannel 0x6fb0d2eb)').toBeGreaterThan(0.66)
      expect(ratio).toBeLessThan(0.73)
      const vSolo = voiceOf(r, [SOLO.id])
      const soloGains = r.voices.events.filter((e) => e.kind === 'gains' && e.voice === vSolo)
      expect(soloGains.length).toBeGreaterThan(10)
      const first = soloGains[1]!
      const last = soloGains[soloGains.length - 1]!
      expect(last, 'Solo=1 rows are exempt from soloDuck').toEqual({ ...first, tick: last.tick })
      r.rec.stop(hS)
      const up: number[] = []
      for (let i = 0; i < 17; i += 1) {
        step(r)
        up.push(r.rec.soloDuck)
      }
      expect(up).toEqual([72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 100, 100])
    })

    it('[T1-F3-09] +80 local-player boost (PlaySound 0x6fb38b72): local player record priority = row priority + 80; other units unchanged', async () => {
      const R = await recordsModule()
      const r = await rig()
      expect(R.LOCAL_PLAYER_PRIORITY_BOOST_113C).toBe(80)
      const X = LOW.id // priority < 176: no byte wrap
      const h0 = r.rec.play(X)
      const h1 = r.rec.play(X, { unit: localPlayer() })
      const h2 = r.rec.play(X, { unit: MONSTER_A })
      expect(r.rec.record(h0)!.priority).toBe(LOW.priority)
      expect(r.rec.record(h1)!.priority).toBe(LOW.priority + 80)
      expect(r.rec.record(h2)!.priority).toBe(LOW.priority)
    })

    it('[T1-F3-10] injected MPQ sample facts drive end of buffer: a one-shot is retired after ceil(frames·25/sampleRate) ticks, a loop never is', async () => {
      const r = await rig()
      const X = PLAIN[1]!.id
      const n = ticksOf(X)
      const h = r.rec.play(X)
      r.rec.play(LOOP_EXEMPT.id)
      step(r)
      const v = voiceOf(r, [X])
      const vLoop = voiceOf(r, [LOOP_EXEMPT.id])
      let stoppedAfter = -1
      for (let i = 1; i <= n + 4; i += 1) {
        step(r)
        if (stoppedAfter < 0 && r.voices.stops(v).length > 0) stoppedAfter = i
      }
      expect(stoppedAfter, `one-shot ${String(X)} lasts ${String(n)} ticks`).toBeGreaterThanOrEqual(n - 1)
      expect(stoppedAfter).toBeLessThanOrEqual(n + 1)
      step(r)
      expect(r.rec.record(h)).toBeUndefined()
      step(r, 3 * ticksOf(LOOP_EXEMPT.id))
      expect(r.voices.stops(vLoop), 'loop voice must keep playing').toEqual([])
    })

    it('[T1-F3-11] no synthesized durations: starting a row without injected sample facts fails fast (PROJECT.md override iv)', async () => {
      const R = await recordsModule()
      const X = PLAIN[2]!.id
      expect(() => {
        const rec = R.SoundRecords113c.fromSounds113c({ rng: new D2Rng(1, 666), voices: new RecordingVoices(), sampleFacts: () => undefined })
        rec.play(X)
        rec.update()
      }).toThrow()
      expect(() => {
        const rec = R.SoundRecords113c.fromSounds113c({ rng: new D2Rng(1, 666), voices: new RecordingVoices() })
        rec.play(X)
        rec.update()
      }).toThrow()
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F3-01] debounce priority tie-break (0x6fb0d802: blocked iff playing.prio ≥ request.prio): higher-priority duplicate passes at dt 1, lower one is dropped', async () => {
      const X = LOW.id
      const a = await rig()
      a.rec.play(X)
      step(a)
      a.rec.play(X, { unit: localPlayer() }) // +80 → higher priority
      step(a)
      expect(a.voices.starts([X]).length).toBe(2)
      const b = await rig()
      b.rec.play(X, { unit: localPlayer() })
      step(b)
      b.rec.play(X) // lower priority than the playing voice
      step(b)
      expect(b.voices.starts([X]).length).toBe(1)
    })

    it('[T2-F3-02] debounce compares SCHEDULED start ticks, unsigned (D23): an older pending record that becomes ready one tick after a same-id voice started is not debounced', async () => {
      const r = await rig()
      const X = PLAIN[3]!.id
      const hOld = r.rec.play(X, { asyncPending: true }) // scheduled start = tick 0, held pending
      step(r, 5)
      expect(r.voices.starts([X]).length).toBe(0)
      r.rec.play(X) // scheduled & started at tick 5
      step(r)
      expect(r.voices.starts([X]).length).toBe(1)
      r.rec.setAsyncReady(hOld) // due at tick 6: (0 − 5) as u32 ≥ 2 → not debounced
      step(r)
      expect(r.voices.starts([X]).length).toBe(2)
    })

    it('[T2-F3-03] debounce is bypassed once the playing duplicate is flagged stop (0x6fb0d7f0: stop field ≠ 0)', async () => {
      const r = await rig()
      const X = PLAIN[4]!.id
      const h1 = r.rec.play(X)
      step(r)
      r.rec.stop(h1)
      r.rec.play(X)
      step(r)
      expect(r.voices.starts([X]).length).toBe(2)
    })

    it('[T2-F3-04] PlaySound returns 0 only for id ≤ 0 and Volume 0 (0x6fb38a81 / 0x6fb38ab7); a Volume>0 none.wav row allocates a record whose start then fails (D23)', async () => {
      const r = await rig()
      expect(r.rec.play(0)).toBe(0)
      expect(r.rec.play(-3)).toBe(0)
      expect(r.rec.play(VOL0.id)).toBe(0)
      expect(r.rec.records().length).toBe(0)
      const h = r.rec.play(NONE_WAV.id)
      expect(h, `none.wav row ${String(NONE_WAV.id)} (${NONE_WAV.sound}) still gets a record`).toBeGreaterThan(0)
      step(r)
      expect(r.voices.starts().length, 'nothing is synthesized for none.wav').toBe(0)
      expect(r.rec.record(h), 'the failed one-shot is freed').toBeUndefined()
    })

    it('[T2-F3-05] Compound reuse covers the whole variant group and negative Compound reuses without an age limit', async () => {
      const r = await rig()
      const g = oracleGroupMembers(COMPOUND_GROUP.id)
      const h = r.rec.play(g[0]!)
      step(r)
      expect(r.rec.play(g[1]!), 'other member of the same groupBase').toBe(h)
      expect(r.rec.play(g[g.length - 1]!)).toBe(h)
      const n = await rig()
      const hn = n.rec.play(COMPOUND_NEG.id)
      step(n, Math.min(60, ticksOf(COMPOUND_NEG.id) - 5))
      expect(n.rec.play(COMPOUND_NEG.id), `Compound ${String(COMPOUND_NEG.compound)} < 0`).toBe(hn)
    })

    it('[T2-F3-06] mono partition: a lower-priority 13th request is dropped without stealing; equal priority & distance steals the oldest start', async () => {
      const r = await rig()
      for (const row of PLAIN.slice(0, 12)) r.rec.play(row.id)
      step(r)
      r.rec.play(LOW.id)
      step(r)
      expect(r.voices.starts([LOW.id]).length).toBe(0)
      expect(r.voices.stops()).toEqual([])
      const o = await rig()
      const first = PLAIN.slice(0, 12)
      for (const row of first) {
        o.rec.play(row.id)
        step(o) // one start per tick: start ticks 0..11, all at (0, 0, 320)
      }
      const oldest = voiceOf(o, [first[0]!.id])
      o.rec.play(PLAIN[12]!.id)
      step(o)
      expect(o.voices.starts([PLAIN[12]!.id]).length).toBe(1)
      expect(o.voices.stops().map((e) => e.voice)).toEqual([oldest])
    })

    it('[T2-F3-07] stereo partition: Stereo=1 rows use only the 4 stereo channels (flags 1); a 5th steals the oldest stereo voice and no mono voice is touched', async () => {
      const r = await rig()
      const [S1, S2] = STEREO_ROWS as [OracleSoundRow, OracleSoundRow]
      // Both Stereo=1 speech rows carry Stop Inst; one voice per distinct unit avoids group/speech conflicts (0x6fb37c30 / 0x6fb37bd0 filter by unit).
      const unit = (id: number): UnitRefC => ({ unitType: 'player', id, x: 0, y: 0 })
      for (const row of PLAIN.slice(0, 12)) r.rec.play(row.id)
      r.rec.play(S1.id, { unit: unit(201) })
      r.rec.play(S2.id, { unit: unit(202) })
      step(r, 2) // ticks 0..1: 12 mono + 2 stereo voices
      r.rec.play(S1.id, { unit: unit(203) })
      r.rec.play(S2.id, { unit: unit(204) })
      step(r, 2) // tick 2 (dt 2 ≥ debounce): stereo partition full (4)
      expect(r.voices.starts().length).toBe(16)
      expect(r.rec.activeChannelCount()).toBe(16)
      const monoVoices = r.voices.starts(PLAIN.slice(0, 12).map((x) => x.id)).map((e) => e.voice)
      const oldestStereo = r.voices.starts([S1.id])[0]!.voice // start tick 0, lowest record slot of the stereo set
      r.rec.play(S1.id, { unit: unit(205) }) // tick 4: equal priority, higher slot → steals inside the stereo partition
      step(r)
      expect(r.voices.starts([S1.id]).length, 'the 5th stereo request starts').toBe(3)
      const stopped = r.voices.stops().map((e) => e.voice)
      expect(stopped.filter((v) => monoVoices.includes(v)), 'mono voices untouched').toEqual([])
      expect(stopped).toEqual([oldestStereo])
      expect(r.rec.activeChannelCount()).toBe(16)
    })

    it('[T2-F3-08] +80 is a byte add (0x6fb38b72 `add byte [esi+0x3c],0x50`): Priority 255 + local player → 79; a Compound reuse by the local player adds +80 again', async () => {
      const r = await rig()
      const h = r.rec.play(P255.id, { unit: localPlayer() })
      expect(r.rec.record(h)!.priority).toBe((255 + 80) & 0xff)
      const c = await rig()
      const hc = c.rec.play(COMPOUND.id, { unit: localPlayer() })
      const p1 = c.rec.record(hc)!.priority
      expect(p1).toBe((COMPOUND.priority + 80) & 0xff)
      expect(c.rec.play(COMPOUND.id, { unit: localPlayer() })).toBe(hc)
      expect(c.rec.record(hc)!.priority).toBe((p1 + 80) & 0xff)
    })

    it('[T2-F3-09] Defer Inst is not consulted for a unit-less record at a non-zero position (0x6fb3924c–0x6fb3925c): a second 2D request starts', async () => {
      const r = await rig()
      const D = DEFER.id
      r.rec.play(D)
      step(r, 3)
      r.rec.play(D)
      step(r)
      expect(r.voices.starts([D]).length).toBe(2)
    })

    it('[T2-F3-10] Stop Inst stops ONE conflict (earliest start, 0x6fb37c93) and a unit-scoped request ignores records without that unit (D23)', async () => {
      const r = await rig()
      const S = STOP.id
      r.rec.play(S, { unit: MONSTER_A }) // tick 0
      step(r, 3)
      r.rec.play(S, { unit: MONSTER_B }) // tick 3: no conflict (other unit)
      step(r, 3)
      expect(r.voices.starts([S]).length).toBe(2)
      const [vA, vB] = r.voices.starts([S]).map((e) => e.voice)
      r.rec.play(S) // tick 6, no unit: conflicts with any playing record of the group → earliest only
      step(r)
      expect(r.voices.starts([S]).length).toBe(3)
      expect(r.voices.stops(vA).length).toBe(1)
      expect(r.voices.stops(vB), 'only one conflicting record is stopped').toEqual([])
      const u = await rig()
      u.rec.play(S) // unit-less record playing
      step(u, 3)
      u.rec.play(S, { unit: MONSTER_A })
      step(u)
      expect(u.voices.starts([S]).length).toBe(2)
      expect(u.voices.stops(), 'the unit-less record is not a conflict for a unit-scoped request').toEqual([])
    })

    it('[T2-F3-11] unit positions use screen coordinates (D23, 0x6fb37f30 via D2Common #10628): Δsubtile (5,0) → (80, 80, 640); (3,3) → x = 0 with centred gains', async () => {
      const r = await rig()
      const unit: UnitRefC = { unitType: 'monster', id: 7, x: 5, y: 0 }
      const h = r.rec.play(TRACK.id, { unit })
      const v = r.rec.record(h)!
      expect([v.x, v.y, v.z]).toEqual([80, 80, 640])
      expect(v.dist2).toBe(12_800)
      unit.x = 3
      unit.y = 3
      step(r) // Tracking row: position re-synced from the unit every SoundUpdate (0x6fb38f6f)
      const w = r.rec.record(h)!
      expect(w.x).toBe(0)
      expect(w.y).toBe(96)
      const g = r.voices.lastGains(voiceOf(r, [TRACK.id]))!
      expect(g.left).toBeCloseTo(g.right, 9)
    })

    it('[T2-F3-12] SetSoundPos has no unit check (D23): it moves a unit-attached non-Tracking record and the position persists', async () => {
      const r = await rig()
      const h = r.rec.play(NOTRACK.id, { unit: MONSTER_A })
      expect(r.rec.setSoundPos(h, 120, -40, 0)).toBe(true)
      step(r)
      const v = r.rec.record(h)!
      expect([v.x, v.y, v.z]).toEqual([120, -40, 640])
    })

    it('[T2-F3-13] pauseDuck: −5 per tick to 0 while paused, +5 back to 100; ids 1–15/52–71/4657–4698 are exempt (UpdateChannel 0x6fb0d293–0x6fb0d2b8)', async () => {
      const r = await rig()
      r.rec.play(LOOP_DUCKED.id)
      r.rec.play(LOOP_EXEMPT.id)
      step(r, 15)
      const vD = voiceOf(r, [LOOP_DUCKED.id])
      const vE = voiceOf(r, [LOOP_EXEMPT.id])
      const e0 = r.voices.lastGains(vE)!
      r.env.paused = true
      const seq: number[] = []
      for (let i = 0; i < 21; i += 1) {
        step(r)
        seq.push(r.rec.pauseDuck)
      }
      expect(seq).toEqual([95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0, 0])
      const d1 = r.voices.lastGains(vD)!
      expect(d1.left + d1.right, 'non-exempt loop silenced at pauseDuck 0').toBe(0)
      const e1 = r.voices.lastGains(vE)!
      expect(e1.left + e1.right, `id ${String(LOOP_EXEMPT.id)} is pause-exempt`).toBeCloseTo(e0.left + e0.right, 9)
      r.env.paused = false
      step(r, 3)
      expect(r.rec.pauseDuck).toBe(15)
    })

    it('[T2-F3-14] Async pending: a record held with asyncPending stays in state 0 until setAsyncReady, then starts on the next SoundTick', async () => {
      const r = await rig()
      const X = PLAIN[5]!.id
      const h = r.rec.play(X, { asyncPending: true })
      step(r, 4)
      expect(r.rec.record(h)?.state).toBe(0)
      expect(r.voices.starts([X]).length).toBe(0)
      r.rec.setAsyncReady(h)
      step(r)
      expect(r.voices.starts([X]).length).toBe(1)
      expect(r.rec.record(h)?.state).toBe(1)
    })

    it('[T2-F3-15] pool recovery: after stopAll() every record is freed and PlaySound allocates again', async () => {
      const r = await rig()
      for (let i = 0; i < 200; i += 1) r.rec.play(PLAIN[0]!.id)
      expect(r.rec.play(PLAIN[0]!.id)).toBe(0)
      r.rec.stopAll()
      expect(r.rec.records().length).toBe(0)
      expect(r.rec.play(PLAIN[0]!.id)).toBeGreaterThan(0)
    })
  })
})

describe('M21-P1 #943 — Tier 3 pairwise F1 × F3 (generated table drives the record layer)', () => {
  it('[T3-P1-03] pickVariant 0x6fb0ee70 over a Group Size ≥ 4 group: every start is a member and never repeats either of the two previous picks', async () => {
    const r = await rig(0x2468ace0, 1357)
    const members = oracleGroupMembers(GROUP4.id)
    expect(members.length).toBeGreaterThanOrEqual(4)
    const spacing = Math.max(...members.map(ticksOf)) + 2 // no overlap, no debounce
    for (let i = 0; i < 30; i += 1) {
      r.rec.play(GROUP4.id)
      step(r, spacing)
    }
    const picks = r.voices.starts(members).map((e) => e.soundId)
    expect(picks.length).toBe(30)
    for (let i = 0; i < picks.length; i += 1) {
      expect(members).toContain(picks[i])
      if (i >= 1) expect(picks[i], `pick ${String(i)} repeats the previous pick`).not.toBe(picks[i - 1])
      if (i >= 2) expect(picks[i], `pick ${String(i)} repeats the pick before last`).not.toBe(picks[i - 2])
    }
    expect(new Set(picks).size).toBeGreaterThanOrEqual(3)
  })

  it('[T3-P1-04] thunder group 202..204 (Group Size 3): consecutive picks always differ; a2 bit 1 (0x6fb0d7d1) skips the pick', async () => {
    const r = await rig(0x0badf00d, 42)
    const spacing = Math.max(ticksOf(202), ticksOf(203), ticksOf(204)) + 2
    for (let i = 0; i < 20; i += 1) {
      r.rec.play(202)
      step(r, spacing)
    }
    const picks = r.voices.starts([202, 203, 204]).map((e) => e.soundId)
    expect(picks.length).toBe(20)
    for (let i = 1; i < picks.length; i += 1) expect(picks[i]).not.toBe(picks[i - 1])
    const s = await rig(0x0badf00d, 42)
    for (let i = 0; i < 5; i += 1) {
      s.rec.play(202, { a2: 1 })
      step(s, spacing)
    }
    expect(s.voices.starts([202, 203, 204]).map((e) => e.soundId)).toEqual([202, 202, 202, 202, 202])
  })

  it('[T3-P1-05] LOCAL_SPEECH_SOUND_RANGE_113C equals exactly the ids BuildSoundPath roots under DATA\\LOCAL (0x6fb0db5b–0x6fb0db69)', async () => {
    const R = await recordsModule()
    const local = O.sounds.filter((s) => (oracleBuildSoundPath(s.id, s.fileName) ?? '').startsWith('DATA\\LOCAL')).map((s) => s.id)
    expect([...R.LOCAL_SPEECH_SOUND_RANGE_113C]).toEqual([2934, 4656])
    expect(Math.min(...local)).toBeGreaterThanOrEqual(R.LOCAL_SPEECH_SOUND_RANGE_113C[0])
    expect(Math.max(...local)).toBeLessThanOrEqual(R.LOCAL_SPEECH_SOUND_RANGE_113C[1])
  })
})
