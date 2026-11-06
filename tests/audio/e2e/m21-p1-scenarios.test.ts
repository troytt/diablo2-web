/**
 * M21-P1 (#943) — Tier 4 realistic scenarios across F1 (Sounds table), F2 (SoundEnviron + levels),
 * F3 (record layer) and F4 (WAV parser). Expected values come from the 1.13c MPQs (oracle) and the
 * D2Client facts cited in m21-p1-records.test.ts; the product is exercised end to end.
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
  oracleWavFacts,
  oracleWavBytes,
  requireExport,
  summarize,
  type Oracle113c,
} from './harness-113c.ts'

// The gates run on hosts at load average 60+: give oracle/MPQ-heavy tests head-room (per-test overrides still apply).
vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const TAG = '#943 P1 scenarios'

interface Facts { readonly kind: 'pcm'; readonly sampleRate: number; readonly frames: number; readonly channels: 1 | 2 }
interface RecC {
  play(id: number, o?: Record<string, unknown>): number
  update(): void
  endTick(): void
  stop(h: number): void
  record(h: number): { state: number; voice: number } | undefined
  readonly now: number
  readonly soloDuck: number
  activeChannelCount(): number
}
interface SoundsC {
  getSoundRow113c(id: number): { id: number; loop: boolean; groupBase: number; groupSize: number } | undefined
  buildSoundMpqPath113c(id: number): string | null
}
interface EnvC {
  getSoundEnvironForLevel113c(level: number): { index: number; dayAmbience: number; nightAmbience: number; dayEvent: number; nightEvent: number }
}
type ParseWav = (bytes: Uint8Array, what: string) => { channels: 1 | 2; sampleRate: number; frames: number }

async function modules(): Promise<{ make: (facts: (id: number) => Facts | undefined, seed?: number) => { rec: RecC; voices: RecordingVoices }; S: SoundsC; E: EnvC; parse: ParseWav }> {
  const rm = await loadProductModule(PRODUCT.records, TAG)
  const Ctor = requireExport<{ fromSounds113c(o: Record<string, unknown>): RecC }>(rm, 'SoundRecords113c', PRODUCT.records, TAG)
  const S = (await loadProductModule(PRODUCT.sounds, TAG)) as unknown as SoundsC
  requireExport(S as unknown as Record<string, unknown>, 'buildSoundMpqPath113c', PRODUCT.sounds, TAG)
  const E = (await loadProductModule(PRODUCT.soundEnviron, TAG)) as unknown as EnvC
  requireExport(E as unknown as Record<string, unknown>, 'getSoundEnvironForLevel113c', PRODUCT.soundEnviron, TAG)
  const parse = requireExport<ParseWav>(await loadProductModule(PRODUCT.wav, TAG), 'parseWavPcm16', PRODUCT.wav, TAG)
  const make = (facts: (id: number) => Facts | undefined, seed = 0x5eed): { rec: RecC; voices: RecordingVoices } => {
    const voices = new RecordingVoices()
    const rec = Ctor.fromSounds113c({ rng: new D2Rng(seed, 666), master: () => 100, paused: () => false, listenerPos: () => ({ x: 0, y: 0 }), voices, sampleFacts: facts })
    return { rec, voices }
  }
  return { make, S, E, parse }
}

function tick(rec: RecC, voices: RecordingVoices, n = 1): void {
  for (let i = 0; i < n; i += 1) {
    voices.tick = rec.now
    rec.update()
    rec.endTick()
  }
}

const ticksOf = (id: number): number => Math.ceil((oracleWavFacts(id).frames * 25) / oracleWavFacts(id).sampleRate)

let O: Oracle113c
const FACTS = new Map<number, Facts>()
const factsFor = (id: number): void => {
  for (const m of oracleGroupMembers(id)) if (!FACTS.has(m) && !O.missingMemberIds.includes(m)) FACTS.set(m, { kind: 'pcm', ...oracleSampleFacts(m) })
}

beforeAll(() => {
  O = getOracle113c()
  for (const e of O.soundEnviron) for (const id of [e.dayAmbience, e.nightAmbience, e.dayEvent, e.nightEvent]) if (id > 0) factsFor(id)
  for (const id of [4, 64, 202, 2961]) factsFor(id)
}, 600_000)

describe('M21-P1 #943 — Tier 4 scenarios', () => {
  it('[T4-P1-01] entering each of the 136 levels: its Day and Night Ambience loops start through the record layer and keep looping', async () => {
    const { make, E, S } = await modules()
    const bad: string[] = []
    const checked = new Map<number, string>()
    for (let level = 1; level <= 136; level += 1) {
      const env = E.getSoundEnvironForLevel113c(level)
      const oEnv = O.soundEnviron[O.levels.get(level)!.soundEnv]!
      if (env.index !== oEnv.index) bad.push(`level ${String(level)}: env ${String(env.index)} != oracle ${String(oEnv.index)}`)
      for (const amb of [env.dayAmbience, env.nightAmbience]) {
        if (amb <= 0 || checked.has(amb)) continue
        const { rec, voices } = make((id) => FACTS.get(id))
        const h = rec.play(amb)
        tick(rec, voices)
        const starts = voices.starts()
        const members = oracleGroupMembers(amb)
        const row = S.getSoundRow113c(amb)
        if (h <= 0 || starts.length !== 1) bad.push(`level ${String(level)} ambience ${String(amb)}: ${String(starts.length)} starts`)
        else {
          if (!members.includes(starts[0]!.soundId)) bad.push(`ambience ${String(amb)} started foreign id ${String(starts[0]!.soundId)}`)
          if (starts[0]!.loop !== O.sounds[starts[0]!.soundId]!.loop || row?.loop !== O.sounds[amb]!.loop) bad.push(`ambience ${String(amb)} loop flag`)
          tick(rec, voices, 2 * Math.max(...members.map(ticksOf)) + 2)
          if (O.sounds[amb]!.loop && voices.stops().length > 0) bad.push(`ambience loop ${String(amb)} was retired`)
        }
        checked.set(amb, `level ${String(level)}`)
      }
    }
    expect(checked.size, 'distinct ambience loops exercised').toBeGreaterThan(10)
    expect(bad, summarize(bad)).toEqual([])
  }, 300_000)

  it('[T4-P1-02] town dialog: UI click spam (Stop Inst) never stacks voices; a Solo speech line ducks the ambience to 70% and releases after it ends', async () => {
    const { make, E } = await modules()
    const { rec, voices } = make((id) => FACTS.get(id))
    const amb = E.getSoundEnvironForLevel113c(1).dayAmbience
    expect(amb).toBeGreaterThan(0)
    rec.play(amb)
    tick(rec, voices, 20) // past any Fade In
    const vAmb = voices.starts()[0]!.voice
    const g0 = voices.lastGains(vAmb)!
    for (let i = 0; i < 10; i += 1) {
      rec.play(4) // cursor_button_click: Stop Inst
      tick(rec, voices)
      const liveClicks = voices.starts([4]).filter((s) => !voices.stops(s.voice).length)
      expect(liveClicks.length, `click ${String(i)}: at most one live click voice`).toBeLessThanOrEqual(1)
    }
    expect(voices.starts([4]).length, 'every click is (re)started').toBe(10)
    rec.play(2961) // Solo = 1 speech line
    const speechTicks = ticksOf(2961)
    tick(rec, voices, 16)
    expect(rec.soloDuck).toBe(70)
    const g1 = voices.lastGains(vAmb)!
    const ratio = (g1.left + g1.right) / (g0.left + g0.right)
    expect(ratio).toBeGreaterThan(0.66)
    expect(ratio).toBeLessThan(0.73)
    tick(rec, voices, speechTicks + 4 - 16 + 15) // the line retires at its WAV length (±1), then +2/tick back to 100
    expect(rec.soloDuck).toBe(100)
    expect(voices.stops(vAmb), 'ambience loop survives').toEqual([])
  }, 120_000)

  it('[T4-P1-03] thunderstorm: rain loop 64 + thunder 202..204 on a seeded schedule for 60 s — rain never drops, picks never repeat, ≤ 12 mono voices, each crack ends at its WAV length', async () => {
    const { make } = await modules()
    const { rec, voices } = make((id) => FACTS.get(id), 0xc0ffee)
    const sched = new D2Rng(0x7e57, 666)
    rec.play(64)
    let next = 30
    let maxLive = 0
    for (let t = 0; t < 1500; t += 1) {
      if (t === next) {
        rec.play(202)
        next += 40 + sched.rand(50)
      }
      tick(rec, voices)
      maxLive = Math.max(maxLive, voices.liveVoices().length)
    }
    const rain = voices.starts([64])
    expect(rain.length).toBe(1)
    expect(voices.stops(rain[0]!.voice)).toEqual([])
    const cracks = voices.starts([202, 203, 204])
    expect(cracks.length).toBeGreaterThan(15)
    for (let i = 1; i < cracks.length; i += 1) expect(cracks[i]!.soundId).not.toBe(cracks[i - 1]!.soundId)
    expect(maxLive).toBeLessThanOrEqual(12)
    const bad: string[] = []
    for (const c of cracks) {
      const stop = voices.stops(c.voice)[0]
      if (stop === undefined) continue // still ringing at the end of the run
      const lived = stop.tick - c.tick
      const n = ticksOf(c.soundId)
      if (lived < n - 1 || lived > n + 1) bad.push(`crack ${String(c.soundId)} lived ${String(lived)} ticks, WAV = ${String(n)}`)
    }
    expect(bad, summarize(bad)).toEqual([])
  }, 120_000)

  it('[T4-P1-04] table → MPQ → product parser → record layer: every Day/Night Event group plays members with buffer ends matching the parsed WAV length', async () => {
    const { make, S, parse } = await modules()
    const productFacts = new Map<number, Facts>()
    const groups = [...new Set(O.soundEnviron.flatMap((e) => [e.dayEvent, e.nightEvent]).filter((id) => id > 0))]
    expect(groups.length).toBeGreaterThan(10)
    for (const g of groups) {
      for (const m of oracleGroupMembers(g)) {
        const path = S.buildSoundMpqPath113c(m)
        if (path === null) continue
        const p = parse(oracleWavBytes(m), path)
        productFacts.set(m, { kind: 'pcm', sampleRate: p.sampleRate, frames: p.frames, channels: p.channels })
      }
    }
    const expectedTicks = (id: number): number | null => {
      const r = O.sounds[id]!
      if (r.loop && r.duration === 0) return null
      if (r.loop) return r.duration + 1
      return r.duration > 0 ? Math.min(ticksOf(id), r.duration + 1) : ticksOf(id)
    }
    const bad: string[] = []
    for (const g of groups) {
      const { rec, voices } = make((id) => productFacts.get(id), g)
      const members = oracleGroupMembers(g)
      const span = Math.max(...members.map((m) => expectedTicks(m) ?? ticksOf(m))) + 3
      for (let i = 0; i < 3; i += 1) {
        rec.play(g)
        tick(rec, voices, span)
      }
      const starts = voices.starts()
      if (starts.length !== 3) bad.push(`event group ${String(g)}: ${String(starts.length)}/3 starts`)
      for (const s of starts) {
        if (!members.includes(s.soundId)) bad.push(`event group ${String(g)}: foreign id ${String(s.soundId)}`)
        const stop = voices.stops(s.voice)[0]
        const n = expectedTicks(s.soundId)
        if (n === null) {
          if (stop !== undefined) bad.push(`infinite looping event ${String(s.soundId)} was retired by end-of-buffer`)
          continue
        }
        if (stop === undefined || Math.abs(stop.tick - s.tick - n) > 1) {
          bad.push(`event ${String(s.soundId)}: lived ${String(stop === undefined ? 'forever' : stop.tick - s.tick)} vs ${String(n)} ticks`)
        }
      }
    }
    expect(bad, summarize(bad)).toEqual([])
  }, 300_000)
})
