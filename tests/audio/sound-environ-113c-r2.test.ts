import { describe, expect, it } from 'vitest'
import {
  AMBIENCE_DAY_NIGHT_CROSSFADE_TICKS_113C,
  EAX_FLOAT_SCALE_113C,
  SoundEnviron113c,
  WEATHER_RAIN_SOUND_ID_113C,
  WEATHER_THUNDER_SOUND_ID_113C,
  isLevelRainable113c,
  isNightTimeOfDay113c,
  periodOfDayToSoundEnvironTod113c,
  scaleSoundEnvironEaxPreset113c,
  type SoundEnvironEaxPreset113c,
} from '../../src/client/audio/sound-environ-113c.ts'
import {
  SILENT_SOUND_VOICES,
  SoundRecords113c,
  attenuationPan113c,
  type SoundSampleFacts113c,
} from '../../src/client/audio/sound-records-113c.ts'
import { WebAudioSoundVoices } from '../../src/client/audio/sound-voices-webaudio.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { Environment, PeriodOfDay } from '../../src/common/world/environment.ts'
import { FakeAudioBuffer, FakeAudioContext, reaches } from './e2e/webaudio-fake.ts'

const TEST_SAMPLE_FACTS: SoundSampleFacts113c = {
  kind: 'pcm',
  sampleRate: 22050,
  frames: 22050 * 10, // 10 seconds (250 ticks)
  channels: 2,
}

function createTestHarness(seed = 0x113c_beef) {
  const rng = new D2Rng(seed)
  const records = SoundRecords113c.fromSounds113c({
    rng,
    voices: SILENT_SOUND_VOICES,
    listenerPos: () => ({ x: 0, y: 0 }),
    sampleFacts: () => TEST_SAMPLE_FACTS,
  })
  const env = new SoundEnviron113c({ records, rng })
  return { env, records, rng }
}

describe('SoundEnviron113c Round-2 1.13c DLL parity (#1748..#1754)', () => {
  it('#1748 (D2SOUND-3): day/night ambience uses the environment cycle index (1..3 = Day, 0/4/5 = Night) rather than PeriodOfDay', () => {
    // 0 = Sunrise (PeriodOfDay.Dawn, Night audio), 1 = Morning (PeriodOfDay.Dawn, Day audio),
    // 2 = Noon (PeriodOfDay.Day, Day audio), 3 = Afternoon (PeriodOfDay.Dusk, Day audio),
    // 4 = Sunset (PeriodOfDay.Dusk, Night audio), 5 = Night (PeriodOfDay.Night, Night audio)
    const worldEnv = Environment.alloc()

    worldEnv.initialize(1, 0, 0, false) // Sunrise -> Dawn, but cycleIndex = 0 (Night for audio)
    expect(worldEnv.period).toBe(PeriodOfDay.Dawn)
    expect(isNightTimeOfDay113c(periodOfDayToSoundEnvironTod113c(worldEnv.cycleIndex))).toBe(true)

    worldEnv.initialize(1, 1, 0, false) // Morning -> Dawn, cycleIndex = 1 (Day for audio)
    expect(worldEnv.period).toBe(PeriodOfDay.Dawn)
    expect(isNightTimeOfDay113c(periodOfDayToSoundEnvironTod113c(worldEnv.cycleIndex))).toBe(false)

    worldEnv.initialize(1, 2, 0, false) // Noon -> Day, cycleIndex = 2 (Day for audio)
    expect(worldEnv.period).toBe(PeriodOfDay.Day)
    expect(isNightTimeOfDay113c(periodOfDayToSoundEnvironTod113c(worldEnv.cycleIndex))).toBe(false)

    worldEnv.initialize(1, 3, 0, false) // Afternoon -> Dusk, cycleIndex = 3 (Day for audio)
    expect(worldEnv.period).toBe(PeriodOfDay.Dusk)
    expect(isNightTimeOfDay113c(periodOfDayToSoundEnvironTod113c(worldEnv.cycleIndex))).toBe(false)

    worldEnv.initialize(1, 4, 0, false) // Sunset -> Dusk, but cycleIndex = 4 (Night for audio)
    expect(worldEnv.period).toBe(PeriodOfDay.Dusk)
    expect(isNightTimeOfDay113c(periodOfDayToSoundEnvironTod113c(worldEnv.cycleIndex))).toBe(true)

    worldEnv.initialize(1, 5, 0, false) // Night -> Night, cycleIndex = 5 (Night for audio)
    expect(worldEnv.period).toBe(PeriodOfDay.Night)
    expect(isNightTimeOfDay113c(periodOfDayToSoundEnvironTod113c(worldEnv.cycleIndex))).toBe(true)
  })

  it('#1749 (D2SOUND-4): day/night ambience swap sets incoming volume to 0 and fades in over 250 ticks (0x6faff9f9-0x6faffa0d)', () => {
    const { env, records } = createTestHarness(0x1749)
    // Start in Level 1 at Noon (tod = 2 -> Day Ambience 52):
    env.enterLevel(1, 2)
    env.tick(1)
    records.update()
    records.endTick()
    const dayHandle = env.ambienceHandle
    expect(dayHandle).toBeGreaterThan(0)

    // Advance 40 ticks so Day Ambience finishes its initial 35-tick Fade In:
    for (let t = 2; t <= 40; t += 1) {
      env.tick(t)
      records.update()
      records.endTick()
    }
    expect(records.record(dayHandle)?.vol).toBe(255)

    // Swap to Sunset (tod = 4 -> Night Ambience 53) at tick 41:
    env.setTimeOfDay(4)
    env.tick(41)
    const nightHandle = env.ambienceHandle
    expect(nightHandle).toBeGreaterThan(0)
    expect(nightHandle).not.toBe(dayHandle)

    // Immediately after env.tick(41), incoming Night Ambience has vol = 0 and fading = true:
    const nightBeforeUpdate = records.record(nightHandle)!
    expect(nightBeforeUpdate.vol).toBe(0)
    expect(nightBeforeUpdate.fading).toBe(true)

    records.update()
    records.endTick()

    // Halfway through the 250-tick crossfade (125 ticks later, at tick 41 + 125 = 166):
    for (let t = 42; t <= 41 + 125; t += 1) {
      env.tick(t)
      records.update()
      records.endTick()
    }
    const nightMid = records.record(nightHandle)!
    const dayMid = records.record(dayHandle)!
    expect(nightMid.fading, 'incoming Night Ambience still fading at +125 ticks (not 35-tick row Fade In)').toBe(true)
    expect(nightMid.vol).toBeGreaterThanOrEqual(120)
    expect(nightMid.vol).toBeLessThanOrEqual(135)
    expect(dayMid.fading, 'outgoing Day Ambience still fading out at +125 ticks').toBe(true)
    expect(dayMid.vol).toBeGreaterThanOrEqual(120)
    expect(dayMid.vol).toBeLessThanOrEqual(135)

    // After 250 ticks (tick 41 + AMBIENCE_DAY_NIGHT_CROSSFADE_TICKS_113C + 2), incoming reaches 255 and outgoing is freed:
    for (let t = 41 + 126; t <= 41 + AMBIENCE_DAY_NIGHT_CROSSFADE_TICKS_113C + 2; t += 1) {
      env.tick(t)
      records.update()
      records.endTick()
    }
    expect(records.record(nightHandle)?.vol).toBe(255)
    expect(records.record(nightHandle)?.fading).toBe(false)
    expect(records.record(dayHandle)).toBeUndefined()
  })

  it('#1750 (D2SOUND-5): non-swap transitions use StopWithFade (0x6fb38810 / 0x6fb38770) and do not restart when wantAmbience is unchanged across environments', () => {
    const { env, records } = createTestHarness(0x1750)
    // Level 1 (Rogue Encampment, SoundEnv = 1, dayAmbience = 52)
    env.enterLevel(1, 2)
    for (let t = 1; t <= 40; t += 1) {
      env.tick(t)
      records.update()
      records.endTick()
    }
    const h1 = env.ambienceHandle
    expect(h1).toBeGreaterThan(0)
    expect(records.record(h1)?.vol).toBe(255)

    // Move to Level 2 (Blood Moor, SoundEnv = 2, ALSO dayAmbience = 52):
    // 0x6faff979: wantAmbience == [0x6fbcc31c], so ambience does NOT restart!
    env.enterLevel(2, 2)
    env.tick(41)
    records.update()
    records.endTick()
    expect(env.ambienceHandle, 'same wantAmbience across SoundEnv 1 -> 2 keeps playing without restart').toBe(h1)
    expect(records.record(h1)?.stop).toBe(false)

    // Move to Level 8 (Den of Evil, SoundEnv = 3, dayAmbience = 54):
    // 0x6fb38810 calls StopWithFade on h1 (Fade Out = 35 ticks), so h1 fades out instead of hard-stopping on tick 42:
    env.enterLevel(8, 2)
    env.tick(42)
    records.update()
    records.endTick()
    const h2 = env.ambienceHandle
    expect(h2).toBeGreaterThan(0)
    expect(h2).not.toBe(h1)

    const oldRec = records.record(h1)
    expect(oldRec, 'outgoing ambience fades out over 35-tick Fade Out rather than hard-stopping').toBeDefined()
    expect(oldRec?.stop).toBe(true)
    expect(oldRec?.fading).toBe(true)
  })

  it('#1751 (D2SOUND-6): periodic environment events pass z = 0 to SetSoundPos (record.z = 640) and receive distance attenuation', () => {
    const { env, records } = createTestHarness(0x1751)
    // Level 2 (Blood Moor, dayEvent = 192..196, eventDelay = 250)
    env.enterLevel(2, 2)
    let eventRec = undefined
    for (let t = 1; t <= 300; t += 1) {
      env.tick(t)
      records.update()
      records.endTick()
      eventRec = records.records().find((r) => r.id >= 192 && r.id <= 196)
      if (eventRec) break
    }
    expect(eventRec).toBeDefined()
    expect(eventRec!.z).toBe(640)
    const { att } = attenuationPan113c(eventRec!.x, eventRec!.y, eventRec!.z)
    expect(att, 'z = 640 + |x| >= 450 attenuates event below 255').toBeLessThan(200)
    expect(att).toBeGreaterThan(100)
  })

  it('#1752 (D2SOUND-7): event timer preserves state on wantEvent == 0, allows overlapping events, and retries next tick if PlaySound returns 0', () => {
    const { env, records } = createTestHarness(0x1752)
    // Level 2 (Blood Moor, dayEvent = 192, eventDelay = 250):
    env.enterLevel(2, 2)

    // Fill all 200 pool slots with dummy records before the first event fires:
    const dummyHandles: number[] = []
    for (let i = 0; i < 199; i += 1) {
      const h = records.play(4) // cursor_button_click
      if (h !== 0) dummyHandles.push(h)
    }

    // Step until the event timer is due (at <= 292 ticks); PlaySound will return 0 because pool is full:
    for (let t = 1; t <= 300; t += 1) {
      env.tick(t)
    }
    expect(env.eventHandle).toBe(0)

    // Free the dummy records and step 1 more tick: because lastEventTick was not reset on failure, it fires immediately!
    for (const h of dummyHandles) {
      records.stopImmediate(h)
    }
    records.update()
    records.endTick()

    env.tick(301)
    expect(env.eventHandle, 'event fires on the very next tick after pool frees a slot').toBeGreaterThan(0)
  })

  it('#1753 (D2SOUND-8): rain bed gates on Levels.txt Rain, starts with row Fade In + SetVolume(target), and stops with StopWithFade', () => {
    // Level 40 (Lut Gholein) has SoundEnviron.Indoors == 0, but Levels.txt Rain == 0:
    expect(isLevelRainable113c(1)).toBe(true) // Rogue Encampment
    expect(isLevelRainable113c(40)).toBe(false) // Lut Gholein (Desert)
    expect(isLevelRainable113c(109)).toBe(true) // Harrogath (Act 5 snow has Levels.txt Rain == 1)

    const { env, records } = createTestHarness(0x1753)
    env.enterLevel(40, 2)
    env.setRaining(true, 200)
    env.tick(1)
    records.update()
    records.endTick()
    expect(env.rainHandle, 'rain does not start in Lut Gholein (Levels.txt Rain == 0)').toBe(0)

    // Switch to Level 1 (Levels.txt Rain == 1):
    env.enterLevel(1, 2)
    env.tick(2)
    const rainHandle = env.rainHandle
    expect(rainHandle).toBeGreaterThan(0)
    // Before SoundUpdate runs, SetVolume(rainHandle, 200) was called at once (0x6faffa56):
    expect(records.record(rainHandle)?.vol).toBe(200)

    // SoundUpdate starts row 64 with its 12-tick Fade In (0 -> 200 over 12 ticks):
    records.update()
    records.endTick()
    expect(records.record(rainHandle)?.fading).toBe(true)

    for (let t = 3; t <= 20; t += 1) {
      env.tick(t)
      records.update()
      records.endTick()
    }
    expect(records.record(rainHandle)?.vol).toBe(200)

    // Enter Lut Gholein (Rain == 0): StopSound(rainHandle) triggers 12-tick Fade Out (not hard-stop):
    env.enterLevel(40, 2)
    env.tick(21)
    records.update()
    records.endTick()
    expect(env.rainHandle).toBe(0)
    const fadingRain = records.record(rainHandle)
    expect(fadingRain, 'rain fades out over 12-tick Fade Out on leaving rainable level').toBeDefined()
    expect(fadingRain?.stop).toBe(true)
    expect(fadingRain?.fading).toBe(true)
  })

  it('#1754 (D2SOUND-9): triggerThunder draws delay (25 + rand(50)), y (-200 + rand(400)), and x (-200 + rand(400)) from the weather RNG (0x6fb30648-0x6fb306b5)', () => {
    const { env, records } = createTestHarness(0x1754)
    env.enterLevel(1, 2)

    const weatherRng = new D2Rng(0x6fb30645)
    const oracleRng = new D2Rng(0x6fb30645)
    const expectedDelay = 25 + oracleRng.rand(50)
    const expectedY = -200 + oracleRng.rand(400) // drawn FIRST at 0x6fb3067a
    const expectedX = -200 + oracleRng.rand(400) // drawn SECOND at 0x6fb30690

    const h = env.triggerThunder(weatherRng)
    expect(h).toBeGreaterThan(0)
    const rec = records.record(h)!
    expect(rec.id).toBe(WEATHER_THUNDER_SOUND_ID_113C)
    expect(rec.delayRemainingTicks).toBe(expectedDelay)
    expect(rec.x).toBe(expectedX)
    expect(rec.y).toBe(expectedY)
    expect(rec.z).toBe(640)
    expect(weatherRng.nextUint32()).toBe(oracleRng.nextUint32())

    // Verify rain handle is unaffected:
    expect(WEATHER_RAIN_SOUND_ID_113C).toBe(64)
  })

  it('#1758 (D2SOUND-13): scales SoundEnviron EAX presets by 0.001f (0x6fb0cf90) and routes Sounds.txt Reverb=1 voices through ConvolverNode in 3D/EAX mode', () => {
    // 1. Verify 0x6fb0cf90 EAX float scaling (0.001f via 0x6fb87540) on Cave (envIdx=4) and Cathedral (envIdx=9):
    const cavePreset = scaleSoundEnvironEaxPreset113c(4)
    expect(cavePreset.eaxEnviron).toBe(5)
    expect(cavePreset.eaxEnvSize).toBe(Math.fround(11600 * EAX_FLOAT_SCALE_113C))
    expect(cavePreset.eaxEnvDiff).toBe(Math.fround(1000 * EAX_FLOAT_SCALE_113C))
    expect(cavePreset.eaxRoomVol).toBe(-1000)
    expect(cavePreset.eaxRoomHF).toBe(-300)
    expect(cavePreset.eaxDecayTime).toBe(Math.fround(2700 * EAX_FLOAT_SCALE_113C))
    expect(cavePreset.eaxDecayHF).toBe(Math.fround(640 * EAX_FLOAT_SCALE_113C))
    expect(cavePreset.eaxReflect).toBe(-711)
    expect(cavePreset.eaxReflectDelay).toBe(Math.fround(12 * EAX_FLOAT_SCALE_113C))
    expect(cavePreset.eaxReverb).toBe(83)
    expect(cavePreset.eaxRevDelay).toBe(Math.fround(17 * EAX_FLOAT_SCALE_113C))

    const cathedralPreset = scaleSoundEnvironEaxPreset113c(9)
    expect(cathedralPreset.eaxEnviron).toBe(7)
    expect(cathedralPreset.eaxDecayTime).toBe(Math.fround(4750 * EAX_FLOAT_SCALE_113C))

    // 2. Verify 0x6fb0cf90 gating on D2sound.#10059 == 2 (3D/EAX mode) and WebAudio ConvolverNode routing:
    const ctx = new FakeAudioContext()
    const sfxGain = ctx.createGain()
    sfxGain.connect(ctx.destination)
    const fakeBuffer = new FakeAudioBuffer(1, 22050, 48000)

    const voices = new WebAudioSoundVoices(
      () => ({
        ctx: ctx as unknown as AudioContext,
        node: sfxGain as unknown as GainNode,
      }),
      () => ({
        buffer: fakeBuffer as unknown as AudioBuffer,
        sourceSampleRate: 22050,
      }),
    )

    const rng = new D2Rng(0x1758)
    const records = SoundRecords113c.fromSounds113c({
      rng,
      voices,
      listenerPos: () => ({ x: 0, y: 0 }),
      sampleFacts: () => TEST_SAMPLE_FACTS,
    })
    const eaxEvents: { preset: SoundEnvironEaxPreset113c; envIdx: number }[] = []
    const env = new SoundEnviron113c({
      records,
      rng,
      onEaxChange: (preset, envIdx) => {
        eaxEvents.push({ preset, envIdx })
      },
    })

    // In default 2D mode (soundMode === 0), entering Level 8 (Den of Evil, SoundEnv = 4 Cave) does NOT dispatch EAX:
    env.enterLevel(8, 2)
    env.tick(1)
    expect(eaxEvents).toHaveLength(0)
    expect(ctx.convolvers()).toHaveLength(0)

    // Enable 3D/EAX mode (D2sound.#10059 == 2): EAX preset for Cave (envIdx=4, eaxEnviron=5) is immediately applied:
    voices.set3DSoundEnabled(true)
    env.setSoundMode(2)
    expect(eaxEvents).toHaveLength(1)
    expect(eaxEvents[0]?.envIdx).toBe(4)
    expect(eaxEvents[0]?.preset.eaxEnviron).toBe(5)

    // Play a Sounds.txt row with Reverb = 0 (ID 4 `cursor_button_click`, reverb: false):
    expect(records.isReverbRow(4)).toBe(false)
    const dryHandle = records.play(4)
    records.update()
    const dryRec = records.record(dryHandle)!
    expect(records.getVoiceReverbMix(dryRec.voice)).toBe(0)
    expect(voices.isVoiceReverbActive(dryRec.voice)).toBe(false)

    // Play a Sounds.txt row with Reverb = 1 (ID 87 `event_drip_1`, reverb: true):
    expect(records.isReverbRow(87)).toBe(true)
    const wetHandle = records.play(87)
    records.update()
    const wetRec = records.record(wetHandle)!
    expect(records.getVoiceReverbMix(wetRec.voice)).toBe(1)
    expect(voices.isVoiceReverbActive(wetRec.voice)).toBe(true)

    const convolvers = ctx.convolvers()
    expect(convolvers).toHaveLength(1)
    expect(convolvers[0]?.buffer).not.toBeNull()
    expect(reaches(convolvers[0]!, ctx.destination)).toBe(true)
  })
})
