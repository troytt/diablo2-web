/**
 * #943 (M21-P1) generic coverage of the product `SoundRecords113c` record layer and of the UpdateChannel 0x6fb0d1d0 /
 * D2sound output math it drives (ported from the generic part of the removed weather-sound test; the weather-specific
 * cases belong to #946). The facts of rows 64 / 202–204 come from the 1.13c MPQs through `parseWavPcm16`
 * (`mpq-sample-facts.ts`); every other sample is an explicit test input. See kb/audio/sound-records-113c.md.
 */
import { describe, expect, it } from 'vitest'
import {
  SILENT_SOUND_VOICES,
  SOUND_TICKS_PER_SECOND,
  SoundRecords113c,
  attenuationPan113c,
  channelOutput113c,
  isPauseDuckExempt113c,
  type ChannelInput113c,
  type SoundSampleFacts113c,
  type SoundVoiceBackend,
} from '../../src/client/audio/sound-records-113c.ts'
import { getSoundRow113c } from '../../src/common/audio/sounds-113c.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { mpqSampleFacts113c } from './mpq-sample-facts.ts'
import { CountingRng, RecordingVoices, createVoiceLogger, makeTestRow, pcm, step } from './sound-records-test-helpers.ts'

/** scene_rain (rain2.wav): Volume 200, Loop, Fade In / Out 12, Falloff 1, no unit → pos (0, 0, 320). */
const RAIN = 64
/** event_thunder_1..3 (202 leads the group of 3): Volume 180, Falloff 3 (minDist 400 / maxDist 1500), Async Only. */
const THUNDER = 202

let mpqFacts: Map<number, SoundSampleFacts113c> | undefined
/** Facts of the original WAVs of rows 64 / 202–204 (read once from the MPQs). */
function facts(id: number): SoundSampleFacts113c | undefined {
  mpqFacts ??= mpqSampleFacts113c([RAIN, 202, 203, 204])
  return mpqFacts.get(id)
}

function rainInput(vol: number, master = 100): ChannelInput113c {
  return {
    vol,
    volume: 200,
    master,
    pauseDuck: 100,
    soloDuck: 100,
    pauseExempt: true,
    soloRow: false,
    x: 0,
    y: 0,
    z: 320,
    minDist: 60,
    maxDist: 700,
  }
}

function thunderInput(x: number, y: number, pauseDuck = 100): ChannelInput113c {
  return {
    vol: 255,
    volume: 180,
    master: 100,
    pauseDuck,
    soloDuck: 100,
    pauseExempt: false,
    soloRow: false,
    x,
    y,
    z: 640,
    minDist: 400,
    maxDist: 1500,
  }
}

describe('UpdateChannel 0x6fb0d1d0 → D2sound #10008 / #10047 / #10028 output (gold tables)', () => {
  // [vol, v2, volume mB, linear amplitude] for Volume 200 at (0, 0, 320): att 255, pan 128.
  const RAIN_TABLE: readonly (readonly [number, number, number, number])[] = [
    [2, 1, -4813, 0.00392],
    [6, 4, -3608, 0.0157],
    [31, 24, -2052, 0.09419],
    [63, 49, -1432, 0.19231],
    [127, 99, -821, 0.3886],
    [128, 100, -813, 0.39219],
    [199, 156, -426, 0.61235],
    [254, 199, -215, 0.78073],
  ]

  it('a Volume 200 row without a unit (pos (0, 0, 320), Falloff 1) matches the gold table', () => {
    for (const vol of [0, 1]) {
      const out = channelOutput113c(rainInput(vol))
      expect([out.v2, out.volMb, out.left, out.right]).toEqual([0, -10000, 0, 0])
    }
    for (const [vol, v2, mb, amp] of RAIN_TABLE) {
      const out = channelOutput113c(rainInput(vol))
      expect([out.att, out.pan, out.v2, out.volMb, out.panMb]).toEqual([255, 128, v2, mb, 0])
      expect(out.left).toBeCloseTo(amp, 5)
      expect(out.right).toBe(out.left)
    }
    // master × vol / 100 first (0x6fb0d269–0x6fb0d288).
    const half = channelOutput113c(rainInput(254, 50))
    expect([half.v, half.v2, half.volMb]).toEqual([127, 99, -821])
    expect(channelOutput113c(rainInput(254, 0)).left).toBe(0)
    expect(attenuationPan113c(0, 0, 320)).toEqual({ att: 255, pan: 128 })
  })

  it('the record layer pushes exactly that output: SetVolume 0x6fb37ed0, then SoundUpdate → UpdateChannel', () => {
    const voices = new RecordingVoices()
    const rec = SoundRecords113c.fromSounds113c({ voices, sampleFacts: facts })
    const h = rec.play(RAIN, { a2: 2 }) // a2 bit 1 skips the Fade In (0x6fb392bd)
    step(rec)
    for (const [vol, , mb] of RAIN_TABLE) {
      rec.setVolume(h, vol)
      expect(rec.getVolume(h)).toBe(vol)
      step(rec)
      const [left, right] = voices.gainsOf(RAIN)
      expect(left).toBeCloseTo(10 ** (mb / 2000), 9)
      expect(right).toBe(left)
    }
    // Stereo = 0 → a 2D mono channel (4..15), although rain2.wav itself is a stereo file; non-streamed: offset 0.
    expect(rec.record(h)!.channel).toBeGreaterThanOrEqual(4)
    expect([...voices.playing.values()]).toEqual([{ soundId: RAIN, loop: true, offset: 0, loopStart: 0 }])
    expect(rec.getVolume(987_654)).toBe(0) // GetVolume 0x6fb37f00: unknown handle → 0
  })

  // (x, y) → att / pan / v2 / volume mB / pan mB / L / R
  const THUNDER_TABLE: readonly (readonly [number, number, number, number, number, number, number, number, number])[] = [
    [0, 0, 255, 128, 180, -302, 0, 0.70632, 0.70632],
    [-200, -200, 233, 64, 164, -383, -595, 0.64343, 0.32434],
    [199, 199, 233, 191, 164, -383, 595, 0.32434, 0.64343],
    [-200, 0, 243, 64, 171, -347, -595, 0.67066, 0.33806],
    [199, 0, 243, 191, 171, -347, 595, 0.33806, 0.67066],
    [0, -200, 243, 128, 171, -347, 0, 0.67066, 0.67066],
    [100, -37, 251, 159, 177, -317, 243, 0.52481, 0.69422],
    [-100, 150, 245, 96, 172, -342, -243, 0.67453, 0.50992],
    [50, 50, 253, 143, 178, -312, 109, 0.61589, 0.69823],
    [-1, 0, 254, 127, 179, -307, 0, 0.70226, 0.70226],
    [1, 0, 254, 128, 179, -307, 0, 0.70226, 0.70226],
  ]

  it('a Volume 180 row at z 640 inside minDist 400 (Falloff 3) matches the gold table', () => {
    for (const [x, y, att, pan, v2, volMb, panMb, left, right] of THUNDER_TABLE) {
      const out = channelOutput113c(thunderInput(x, y))
      expect([out.att, out.pan, out.v2, out.volMb, out.panMb]).toEqual([att, pan, v2, volMb, panMb])
      expect(out.left).toBeCloseTo(left, 5)
      expect(out.right).toBeCloseTo(right, 5)
    }
  })

  it('reaches the output at the SetSoundPos position (z + 640, 0x6fb38ba0)', () => {
    for (const [x, y, , , , , , left, right] of THUNDER_TABLE) {
      const voices = new RecordingVoices()
      const rec = SoundRecords113c.fromSounds113c({ voices, sampleFacts: facts })
      const h = rec.play(THUNDER, { a2: 1 }) // a2 bit 0: no variant pick (0x6fb0d7d1)
      expect(rec.setSoundPos(h, x, y, 0)).toBe(true)
      expect(rec.record(h)).toMatchObject({ x, y, z: 640 })
      rec.update()
      const [l, r] = voices.gainsOf(THUNDER)
      expect(l).toBeCloseTo(left, 5)
      expect(r).toBeCloseTo(right, 5)
    }
  })

  it('pause duck at (0, 0): gold table', () => {
    // [duck, v2, mB]
    for (const [duck, v2, mb] of [[95, 170, -352], [50, 89, -914], [5, 8, -3006], [0, 0, -10000]] as const) {
      const out = channelOutput113c(thunderInput(0, 0, duck))
      expect([out.v2, out.volMb]).toEqual([v2, mb])
    }
    expect(channelOutput113c(thunderInput(0, 0, 0)).left).toBe(0)
  })

  it('distance falloff past minDist (0x6fb0d428–0x6fb0d450) scales v linearly down to 0 at maxDist', () => {
    const at = (x: number) => channelOutput113c(thunderInput(x, 0))
    expect(at(400).v).toBe(255) // d == minDist: no falloff
    expect(at(1000).v).toBe(Math.trunc(((1500 - 1000) * 255) / (1500 - 400)))
    expect(at(1500).v).toBe(0)
    expect(at(1500).left).toBe(0)
  })

  it('a stereo channel (flags 1) skips #10047 / #10028 (0x6fb0d4a5): no attenuation, centred pan, falloff still applies', () => {
    const centre = channelOutput113c(thunderInput(0, 0))
    const side = channelOutput113c({ ...thunderInput(-200, 0), stereoChannel: true })
    expect([side.att, side.pan, side.panMb, side.v2, side.volMb]).toEqual([255, 128, 0, centre.v2, centre.volMb])
    expect([side.left, side.right]).toEqual([centre.left, centre.left])
    const far = channelOutput113c({ ...thunderInput(1000, 0), stereoChannel: true })
    expect(far.v).toBe(Math.trunc(((1500 - 1000) * 255) / (1500 - 400)))
    expect(far.v2).toBe(Math.trunc((180 * far.v) / 255))
    expect(far.left).toBe(far.right)

    // Through the record layer: a Stereo = 1 row plays on channels 0..3 and its gains ignore the position.
    const log = createVoiceLogger()
    const rec = new SoundRecords113c({
      rows: [makeTestRow({ id: 7, volume: 180, falloff: 3, stereo: 1 })],
      voices: log.backend,
      sampleFacts: () => pcm(50, 2),
    })
    const h = rec.play(7)
    rec.setSoundPos(h, -200, 0, 0)
    step(rec)
    expect(rec.record(h)!.channel).toBeLessThan(4)
    expect(log.gains.at(-1)).toEqual({ voice: rec.record(h)!.voice, left: centre.left, right: centre.left })
  })
})

describe('ducks 0x6fb39449–0x6fb3957e', () => {
  it('pause duck: the pause-exempt ids are 1–15, 52–71 and 0x1231–0x125a (0x6fb0d293–0x6fb0d2b8)', () => {
    const exempt = [1, 15, 52, 64, 71, 0x1231, 0x125a]
    const ducked = [0, 16, 51, 72, 202, 203, 204, 0x1230, 0x125b]
    expect(exempt.every(isPauseDuckExempt113c)).toBe(true)
    expect(ducked.some(isPauseDuckExempt113c)).toBe(false)
  })

  it('pause duck: −5 per update whose clock moved; rain (64) keeps its gains, thunder is ducked with the previous value', () => {
    const run = (paused: boolean) => {
      const voices = new RecordingVoices()
      const rec = SoundRecords113c.fromSounds113c({ rng: new D2Rng(1, 666), paused: () => paused, voices, sampleFacts: facts })
      rec.play(RAIN, { a2: 2 })
      rec.play(THUNDER, { a2: 1 })
      const ducks: number[] = []
      for (let i = 0; i < 4; i += 1) {
        rec.update()
        ducks.push(rec.pauseDuck)
        rec.endTick()
      }
      return { voices, ducks }
    }
    const paused = run(true)
    const running = run(false)
    // The duck moves only when the clock moved since the last update (none at now 0).
    expect(paused.ducks).toEqual([100, 95, 90, 85])
    expect(running.ducks).toEqual([100, 100, 100, 100])
    expect(paused.voices.gainsOf(RAIN)).toEqual(running.voices.gainsOf(RAIN))
    // The update at now 3 pushed the duck of the previous update (90); the unit-less thunder is at (0, 0, 320).
    const ducked = channelOutput113c({ ...thunderInput(0, 0, 90), z: 320 })
    expect(paused.voices.gainsOf(THUNDER)).toEqual([ducked.left, ducked.right])
    expect(paused.voices.gainsOf(THUNDER)[0]).toBeLessThan(running.voices.gainsOf(THUNDER)[0])
  })
})

describe('variant pick 0x6fb0ee70 on the local player seed (RNG 0x6fb39640)', () => {
  function picks(lo: number, hi: number): [number, number][] {
    const rng = new CountingRng(lo, hi)
    const rec = SoundRecords113c.fromSounds113c({ rng, sampleFacts: facts })
    const out: [number, number][] = []
    for (let i = 0; i < 12; i += 1) {
      const h = rec.play(THUNDER)
      rng.draws.length = 0
      rec.update()
      // RNG(Group Size + 1) decides whether the second-last pick may repeat, then RNG(Group Size) until the pick
      // avoids the recent ones.
      expect(rng.draws[0]!.max).toBe(4)
      expect(rng.draws.length).toBeGreaterThanOrEqual(2)
      expect(rng.draws.slice(1).every((d) => d.max === 3)).toBe(true)
      const view = rec.record(h)!
      expect(view.state).toBe(1)
      out.push([view.id, rng.draws[0]!.value === 0 ? 1 : 2])
      expect(rec.recentOf(THUNDER)[0]).toBe(view.id)
      rec.endTick()
    }
    return out
  }

  it('seed lo=0x12345678, hi=666', () => {
    expect(picks(0x12345678, 666)).toEqual([
      [202, 2], [203, 2], [204, 2], [202, 2], [203, 1], [204, 1], [202, 2], [204, 1], [203, 2], [202, 2], [204, 2], [203, 2],
    ])
  })

  it('seed lo=1, hi=666', () => {
    expect(picks(1, 666)).toEqual([
      [202, 2], [204, 1], [203, 2], [202, 2], [204, 2], [203, 2], [202, 2], [204, 2], [203, 2], [202, 2], [204, 1], [203, 2],
    ])
  })

  it('a2 bit 0 keeps the requested id without a draw; a group pick without the RNG fails fast', () => {
    const rng = new CountingRng(1, 666)
    const rec = SoundRecords113c.fromSounds113c({ rng, sampleFacts: facts })
    const h = rec.play(THUNDER, { a2: 1 })
    rec.update()
    expect(rng.draws).toEqual([])
    expect(rec.record(h)).toMatchObject({ id: THUNDER, state: 1 })
    expect(rec.recentOf(THUNDER)).toEqual([THUNDER, 0])

    const noRng = SoundRecords113c.fromSounds113c({ sampleFacts: facts })
    noRng.play(THUNDER)
    expect(() => noRng.update()).toThrow(/needs the local player's RNG/)
    // Group Size 1 rows never draw.
    const single = SoundRecords113c.fromSounds113c({ sampleFacts: facts })
    single.play(RAIN)
    expect(() => single.update()).not.toThrow()
  })
})

describe('end of buffer, master volume, ids and lifecycle', () => {
  it('a one-shot ends with its buffer: Fn_6fb0d080 stops it at s + ⌈frames · 25 / rate⌉, the next SoundUpdate frees it', () => {
    const lengths: number[] = []
    for (const id of [202, 203, 204]) {
      const f = facts(id)
      if (f?.kind !== 'pcm') throw new Error(`row ${String(id)} has PCM facts`)
      const ticks = Math.ceil((f.frames * SOUND_TICKS_PER_SECOND) / f.sampleRate)
      lengths.push(ticks)
      const voices = new RecordingVoices()
      const rec = SoundRecords113c.fromSounds113c({ voices, sampleFacts: facts })
      const h = rec.play(id, { a2: 1 })
      const s = rec.now
      rec.update()
      expect(rec.record(h)).toMatchObject({ id, state: 1 })
      while (rec.now < s + ticks) {
        rec.endTick()
        rec.update()
        expect(rec.record(h)!.state).toBe(1)
      }
      rec.endTick()
      expect(rec.record(h)).toMatchObject({ state: 2, voice: 0, channel: -1 })
      expect(voices.playing.size).toBe(0)
      rec.update()
      expect(rec.record(h)).toBeUndefined()
    }
    // thunder_norm_1 / _2 / _5: 136,448 / 179,968 / 260,096 frames at 22,050 Hz.
    expect(lengths).toEqual([155, 205, 295])
  })

  it('a looped buffer never ends by itself (D2sound #10044 keeps reporting it as playing)', () => {
    const voices = new RecordingVoices()
    const rec = SoundRecords113c.fromSounds113c({ voices, sampleFacts: facts })
    const h = rec.play(RAIN, { a2: 2 })
    step(rec, 200) // rain2.wav is 51,246 frames ≈ 58.1 ticks
    expect(rec.record(h)).toMatchObject({ state: 1 })
    expect(voices.playing.size).toBe(1)
  })

  it('master volume 0 drops a due one-shot without a variant draw (0x6fb39194); a loop waits pending and starts when the volume returns', () => {
    let master = 100
    const rng = new CountingRng(1, 666)
    const voices = new RecordingVoices()
    const rec = SoundRecords113c.fromSounds113c({ rng, master: () => master, voices, sampleFacts: facts })
    const hRain = rec.play(RAIN, { a2: 2 })
    step(rec, 5)
    expect(rec.record(hRain)!.state).toBe(1)
    master = 0
    const hThunder = rec.play(THUNDER)
    rng.draws.length = 0
    step(rec)
    // The playing loop is stopped (0x6fb393f5) and goes back to pending in the next update (0x6fb38f28).
    expect(rec.record(hThunder)).toBeUndefined()
    expect(rng.draws).toEqual([])
    expect(voices.playing.size).toBe(0)
    step(rec, 20)
    expect(rec.record(hRain)).toMatchObject({ state: 0, voice: 0, vol: 255, savedPos: 0 })
    master = 100
    step(rec)
    expect(rec.record(hRain)!.state).toBe(1)
    // Non-streamed: the restart is at position 0 (#10032 saved nothing).
    expect([...voices.playing.values()]).toEqual([{ soundId: RAIN, loop: true, offset: 0, loopStart: 0 }])
  })

  it('rejects a master volume outside 0..100, unknown / unbaked / non-integer ids and bad PlaySound arguments', () => {
    for (const bad of [101, -1, 1.5, Number.NaN]) {
      const rec = SoundRecords113c.fromSounds113c({ master: () => bad })
      expect(() => rec.update()).toThrow(/master volume/)
    }
    const ok = SoundRecords113c.fromSounds113c()
    expect(ok.play(0)).toBe(0)
    expect(() => ok.play(4699)).toThrow(/NULL row/)
    expect(() => ok.play(1.5)).toThrow(/id 1\.5/)
    expect(() => ok.play(4, { delayTicks: -1 })).toThrow(/delay/)
    expect(() => ok.play(4, { a2: 0.5 })).toThrow(/a2/)
    const subset = new SoundRecords113c({ rows: [makeTestRow({ id: 5 })] })
    expect(() => subset.play(1)).toThrow(/not baked/)
  })

  it('records, timers and RNG draws do not depend on the output backend', () => {
    const run = (voices: SoundVoiceBackend) => {
      const rng = new D2Rng(0x12345678, 666)
      const rec = SoundRecords113c.fromSounds113c({ rng, voices, sampleFacts: facts })
      const snaps: unknown[] = []
      let rain = 0
      for (let now = 0; now < 500; now += 1) {
        if (now === 1) rain = rec.play(RAIN)
        if (now === 200) rec.fade(rain, 12, 0)
        if (now % 37 === 5) {
          const h = rec.play(THUNDER, { delayTicks: 25 + rng.rand(50) })
          rec.setSoundPos(h, -200 + rng.rand(400), -200 + rng.rand(400), 0)
        }
        rec.update()
        snaps.push(rec.records())
        rec.endTick()
      }
      return { snaps, seed: rng.getSeed() }
    }
    const voices = new RecordingVoices()
    expect(run(voices)).toEqual(run(SILENT_SOUND_VOICES))
    expect(voices.log.filter((l) => l.startsWith('start')).length).toBeGreaterThan(10)
  })

  it('StopAll 0x6fb38d20 frees every record and stops every channel; game init 0x6fb0ef90 also resets handles, recent picks and the clock', () => {
    const voices = new RecordingVoices()
    const rec = SoundRecords113c.fromSounds113c({ rng: new D2Rng(1, 666), voices, sampleFacts: facts })
    rec.play(RAIN, { a2: 2 })
    step(rec, 3)
    const hThunder = rec.play(THUNDER)
    step(rec)
    expect(rec.records()).toHaveLength(2)
    expect(voices.playing.size).toBe(2)
    expect(rec.recentOf(THUNDER)[0]).not.toBe(0)
    const now = rec.now
    rec.stopAll()
    expect(rec.records()).toEqual([])
    expect(voices.playing.size).toBe(0)
    expect(rec.activeChannelCount()).toBe(0)
    expect(rec.now).toBe(now)
    expect(rec.play(4)).toBe(hThunder + 1) // the handle counter keeps counting until the next game init
    rec.gameInit()
    expect(rec.records()).toEqual([])
    expect(rec.now).toBe(0)
    expect(rec.recentOf(THUNDER)).toEqual([0, 0])
    expect(rec.play(4)).toBe(1)
  })
})

describe('steals and restarts (AllocChannel 0x6fb0ce70, StopChannel 0x6fb380e0, SoundUpdate 0x6fb39279–0x6fb392cd)', () => {
  /**
   * 12 mono channels: a streamed loop (slot 0) at x = 300, 11 one-shots at x = 10..110, all Priority 100.
   * At tick 10 a one-shot at x = 500 (slot 12) steals the loop (equal priority, victim address lower): the loop
   * sorts before it (dist² asc, 0x6fb38e00) so it was already updated in that SoundUpdate.
   */
  function stealScenario(stealerTicks: number) {
    const rows = [
      makeTestRow({ id: 40, loop: true, stream: true, falloff: 4 }),
      ...Array.from({ length: 11 }, (_, i) => makeTestRow({ id: i + 1, falloff: 4 })),
      makeTestRow({ id: 99, falloff: 4 }),
    ]
    const factsById = new Map<number, SoundSampleFacts113c>([[40, pcm(100)], [99, pcm(stealerTicks)]])
    for (let id = 1; id <= 11; id += 1) factsById.set(id, pcm(500))
    const voices = new RecordingVoices()
    const rec = new SoundRecords113c({ rows, voices, sampleFacts: (id) => factsById.get(id) })
    const hLoop = rec.play(40)
    rec.setSoundPos(hLoop, 300, 0, 0)
    for (let id = 1; id <= 11; id += 1) rec.setSoundPos(rec.play(id), 10 * id, 0, 0)
    step(rec, 10)
    expect(rec.activeChannelCount()).toBe(12)
    const hSteal = rec.play(99)
    rec.setSoundPos(hSteal, 500, 0, 0)
    rec.update() // tick 10
    // The victim is stopped, its stream position saved (10 ticks · 22,050 / 25 = 8,820 frames), and left in state 2.
    expect(rec.record(hLoop)).toMatchObject({ state: 2, channel: -1, savedPos: 8820 })
    expect(rec.record(hSteal)!.state).toBe(1)
    rec.endTick()
    rec.update() // tick 11: the stopped loop goes back to pending (0x6fb38f28–0x6fb38f6a)
    expect(rec.record(hLoop)).toMatchObject({ state: 0, savedPos: 8820 })
    rec.endTick()
    const starts = () => voices.log.filter((l) => / 40 @/.test(l))
    return { rec, voices, hLoop, starts }
  }

  it('a stolen streamed loop resumes at its saved position with a 3-tick fade once a channel is free', () => {
    const { rec, hLoop, starts } = stealScenario(1) // the stealer's buffer ends at the end of tick 11
    const vols: number[] = []
    for (let i = 0; i < 5; i += 1) {
      rec.update() // ticks 12..16
      vols.push(rec.record(hLoop)!.vol)
      rec.endTick()
    }
    expect(starts().map((l) => l.split('@')[1])).toEqual(['0', '8820'])
    expect(vols).toEqual([0, 85, 170, 255, 255])
    expect(rec.record(hLoop)).toMatchObject({ state: 1, savedPos: 0 })
  })

  it('binary quirk: a loop whose fade-in restart fails keeps vol 0 (0x6fb392c6–0x6fb392c9 zero it before StartSound) and is never started again (0x6fb39189)', () => {
    const { rec, voices, hLoop, starts } = stealScenario(2) // the stealer still holds the channel at tick 12
    rec.update() // tick 12: StartSound fails (no free channel; the loop cannot steal the farther stealer of a higher address)
    expect(rec.record(hLoop)).toMatchObject({ state: 0, vol: 0, savedPos: 0, channel: -1 })
    rec.endTick()
    step(rec, 30)
    expect(rec.activeChannelCount()).toBe(11) // a channel is free, but a pending record with vol 0 is skipped
    expect(starts()).toHaveLength(1)
    expect(rec.record(hLoop)).toMatchObject({ state: 0, vol: 0 })
    // Only StopSound releases it: stop pass → state 2 → freed (0x6fb38e6e, 0x6fb38f28).
    rec.stop(hLoop)
    step(rec)
    expect(rec.record(hLoop)).toBeUndefined()
    expect(voices.playing.size).toBe(11)
  })
})

describe('Sounds.txt rows used above', () => {
  it('are the 1.13c rows the gold tables were derived for', () => {
    expect(getSoundRow113c(RAIN)).toMatchObject({ sound: 'scene_rain', volume: 200, loop: true, fadeIn: 12, fadeOut: 12, falloff: 1, stereo: 0, stream: false })
    for (const id of [202, 203, 204]) {
      expect(getSoundRow113c(id)).toMatchObject({ volume: 180, falloff: 3, groupBase: 202, asyncOnly: true, loop: false })
    }
    expect(getSoundRow113c(THUNDER)!.groupSize).toBe(3)
  })
})
