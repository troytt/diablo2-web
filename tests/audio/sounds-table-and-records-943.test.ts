/**
 * #943 (M21-P1) unit tests: the generated 1.13c sound tables and the product `SoundRecords113c` record layer.
 * Every record-layer expectation cites the D2Client.dll 1.13c code it encodes (see kb/audio/sound-records-113c.md).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildSoundTablesPack,
  mountSoundTableArchives,
  renderSoundEnvironModule,
  renderSoundsModule,
} from '../../src/baker/packers/pack-sound-tables.ts'
import {
  LOCAL_PLAYER_PRIORITY_BOOST_113C,
  LOCAL_SPEECH_SOUND_RANGE_113C,
  SOUND_MAX_CHANNELS,
  SOUND_RECORD_POOL_SIZE,
  SOUND_STEREO_CHANNELS_113C,
  SoundRecords113c,
  channelOutput113c,
  unitClientCoords113c,
  unitSoundPosition113c,
  type SoundRecordRowInput113c,
  type SoundUnitRef113c,
} from '../../src/client/audio/sound-records-113c.ts'
import {
  LEVEL_SOUND_ENV_113C,
  SOUND_ENVIRON_113C,
  SOUND_ENVIRON_ROW_COUNT_113C,
  getSoundEnvironForLevel113c,
} from '../../src/common/audio/sound-environ-113c.ts'
import {
  MUSIC_SOUND_RANGE_113C,
  SOUNDS_113C,
  SOUNDS_BY_NAME_113C,
  SOUNDS_ROW_COUNT_113C,
  buildSoundMpqPath113c,
  getSoundIdByName113c,
  getSoundRow113c,
} from '../../src/common/audio/sounds-113c.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { mpqSampleFacts113c } from './mpq-sample-facts.ts'
import { createVoiceLogger, makeTestRow, pcm, step } from './sound-records-test-helpers.ts'

/** A records layer over test rows, every row given `ticks` of PCM. */
function rig(rows: readonly SoundRecordRowInput113c[], ticks = 100, extra: Partial<Parameters<typeof SoundRecords113c.fromSounds113c>[0]> = {}) {
  const log = createVoiceLogger()
  const facts = new Map(rows.map((r) => [r.id, pcm(ticks)]))
  const rec = new SoundRecords113c({
    rows,
    voices: log.backend,
    rng: new D2Rng(0x12345678, 666),
    listenerPos: () => ({ x: 0, y: 0 }),
    sampleFacts: (id) => facts.get(id),
    ...extra,
  })
  return { rec, log, facts }
}

const unit = (unitType: string, id: number, x = 0, y = 0): SoundUnitRef113c => ({ unitType, id, x, y })
const localPlayer = (): SoundUnitRef113c => ({ unitType: 'player', id: 1, isLocalPlayer: true, x: 0, y: 0 })

describe('1.13c Sounds.txt & SoundEnviron.txt baked contracts (#943)', () => {
  it('bakes all 4,699 Sounds.txt rows (0..4698) and 50 SoundEnviron.txt rows (0..49); the MPQ re-bake is byte-identical to the committed modules', async () => {
    expect(SOUNDS_ROW_COUNT_113C).toBe(4699)
    expect(SOUNDS_113C).toHaveLength(4699)
    expect(MUSIC_SOUND_RANGE_113C).toEqual([4657, 4684])
    expect(SOUND_ENVIRON_ROW_COUNT_113C).toBe(50)
    expect(SOUND_ENVIRON_113C).toHaveLength(50)

    const pack = await buildSoundTablesPack(mountSoundTableArchives())
    expect([pack.soundsArchive, pack.soundEnvironArchive, pack.levelsArchive]).toEqual(['Patch_D2.mpq', 'Patch_D2.mpq', 'Patch_D2.mpq'])
    const committedSounds = readFileSync(new URL('../../src/common/audio/sounds-113c.ts', import.meta.url), 'utf8')
    const committedEnviron = readFileSync(new URL('../../src/common/audio/sound-environ-113c.ts', import.meta.url), 'utf8')
    expect(renderSoundsModule(pack)).toBe(committedSounds)
    expect(renderSoundEnvironModule(pack)).toBe(committedEnviron)
    // Deterministic: a second render of the same pack is identical, and the generated modules import nothing.
    expect(renderSoundsModule(pack)).toBe(renderSoundsModule(pack))
    expect(renderSoundEnvironModule(pack)).toBe(renderSoundEnvironModule(pack))
    expect(committedSounds).not.toMatch(/^import /m)
    expect(committedEnviron).not.toMatch(/^import /m)
  })

  it('applies D2Client.dll 0x6fb0e8e1–0x6fb0e952 Group Size 0 → 1, groupBase (leader recurrence) and nBlocks post-processing', () => {
    // Row 0 is the sentinel (`""` / `none.wav`); the post-processing loop runs over ids 1..rowCount-1.
    expect(SOUNDS_113C[0]).toMatchObject({ id: 0, sound: '', fileName: 'none.wav', rawGroupSize: 0, groupSize: 0, groupBase: 0, nBlocks: 0 })
    const nBlocks = [0, 0, 0, 0]
    for (let id = 1; id < SOUNDS_113C.length; id += 1) {
      const row = SOUNDS_113C[id]!
      expect(row.id).toBe(id)
      expect(row.groupSize).toBe(row.rawGroupSize === 0 ? 1 : row.rawGroupSize)
      expect(row.groupBase).toBeLessThanOrEqual(id)
      const blocks = [row.block1, row.block2, row.block3]
      let expectedBlocks = 0
      while (expectedBlocks < 3 && blocks[expectedBlocks] !== -1) expectedBlocks += 1
      expect(row.nBlocks).toBe(expectedBlocks)
      nBlocks[row.nBlocks]! += 1
    }
    expect(nBlocks).toEqual([4608, 86, 4, 0])

    // event_thunder_1 (202) leads a group of 3: 202..204 share groupBase 202.
    expect(getSoundRow113c(202)).toMatchObject({ sound: 'event_thunder_1', groupSize: 3, groupBase: 202 })
    expect([203, 204].map((id) => [getSoundRow113c(id)!.groupSize, getSoundRow113c(id)!.groupBase])).toEqual([[1, 202], [1, 202]])
    // groupBase is assigned BEFORE the row's own Group Size is read (0x6fb0e900–0x6fb0e914, then 0x6fb0e91d):
    // a leader nested inside the previous group keeps that group's leader as groupBase but leads its own group.
    for (const [id, base] of [[134, 133], [138, 134], [991, 986], [1139, 1136], [1201, 1198], [1288, 1284], [2065, 2061]] as const) {
      const row = getSoundRow113c(id)!
      expect(row.rawGroupSize, `row ${String(id)} leads its own group`).toBeGreaterThan(0)
      expect(row.groupSize).toBe(row.rawGroupSize)
      expect(row.groupBase, `row ${String(id)} groupBase`).toBe(base)
    }
    expect(getSoundRow113c(139)!.groupBase).toBe(138)
    // Row 4 is cursor_button_click (Stop Inst), the UI click.
    expect(getSoundRow113c(4)).toMatchObject({ sound: 'cursor_button_click', fileName: 'cursor\\button.wav', stopInst: true })
    // Gitea #943: 590 rows use Compound.
    expect(SOUNDS_113C.filter((r) => r.compound !== 0)).toHaveLength(590)

    // Trailing whitespace of row 4601 is kept raw and trimmed for lookups.
    const qualkehk = getSoundRow113c(4601)!
    expect(qualkehk.rawSound).toBe('qualkehk_act5_q6_early ')
    expect(qualkehk.sound).toBe('qualkehk_act5_q6_early')
    expect(getSoundIdByName113c('  QUALKEHK_ACT5_Q6_EARLY  ')).toBe(4601)
    expect(SOUNDS_BY_NAME_113C['qualkehk_act5_q6_early']).toBe(4601)
  })

  it('maps all 136 levels (1..136) to SoundEnviron.txt rows (0..49) and fails fast on unknown levels', () => {
    const levelIds = Object.keys(LEVEL_SOUND_ENV_113C).map(Number).sort((a, b) => a - b)
    expect(levelIds).toEqual(Array.from({ length: 136 }, (_, i) => i + 1))
    for (const levelId of levelIds) {
      const env = getSoundEnvironForLevel113c(levelId)
      expect(env.index).toBe(LEVEL_SOUND_ENV_113C[levelId])
      expect(env.index).toBeGreaterThanOrEqual(0)
      expect(env.index).toBeLessThan(50)
    }
    for (const bad of [0, 137, -1, 1.5, Number.NaN]) expect(() => getSoundEnvironForLevel113c(bad)).toThrow(/unknown levelId/)
    // musicRange 0x6fb0e954–0x6fb0e990 = [min, max] of SoundEnviron Song > 0.
    const songs = SOUND_ENVIRON_113C.map((e) => e.song).filter((s) => s > 0)
    expect([Math.min(...songs), Math.max(...songs)]).toEqual([...MUSIC_SOUND_RANGE_113C])
  })

  it('builds the 1.13c MPQ paths with BuildSoundPath (0x6fb0db30): DATA\\LOCAL for 2934..4656, \\MUSIC\\ for 4657..4698, paths < 0x50', () => {
    expect(buildSoundMpqPath113c(0)).toBeNull()
    expect(buildSoundMpqPath113c(332)).toBeNull() // none.wav
    expect(buildSoundMpqPath113c(4699)).toBeNull()
    expect(buildSoundMpqPath113c(1)).toBe('DATA\\GLOBAL\\SFX\\cursor\\pass.wav')
    expect(buildSoundMpqPath113c(2933)).toBe(`DATA\\GLOBAL\\SFX\\${SOUNDS_113C[2933]!.fileName}`)
    expect(buildSoundMpqPath113c(2934)).toBe('DATA\\LOCAL\\SFX\\common\\amazon\\ama_cantcarry.wav')
    expect(buildSoundMpqPath113c(4656)).toBe(`DATA\\LOCAL\\SFX\\${SOUNDS_113C[4656]!.fileName}`)
    expect(buildSoundMpqPath113c(4657)).toBe('DATA\\GLOBAL\\MUSIC\\act1\\caves.wav')
    expect(buildSoundMpqPath113c(4698)).toBe(`DATA\\GLOBAL\\MUSIC\\${SOUNDS_113C[4698]!.fileName}`)
    let playable = 0
    for (const row of SOUNDS_113C) {
      const path = buildSoundMpqPath113c(row.id)
      if (path === null) continue
      playable += 1
      expect(path.length, path).toBeLessThan(0x50) // strlen assert 0x6fb0dc1e
    }
    expect(playable).toBe(4699 - SOUNDS_113C.filter((r) => r.fileName.toLowerCase() === 'none.wav').length)
  })
})

describe('SoundRecords113c — 1.13c record-layer mechanics (#943, D2Client.dll)', () => {
  it('PlaySound 0x6fb38a70 returns 0 only for id ≤ 0, Volume 0 or a full pool; a none.wav row allocates a record whose start fails (explicit, counted)', () => {
    expect(SOUND_RECORD_POOL_SIZE).toBe(200)
    const log = createVoiceLogger()
    const unavailable: Array<[number, string]> = []
    const facts = mpqSampleFacts113c([4])
    const rec = SoundRecords113c.fromSounds113c({
      voices: log.backend,
      sampleFacts: (id) => facts.get(id),
      onUnavailable: (id, reason) => unavailable.push([id, reason]),
    })
    expect(rec.play(0)).toBe(0)
    expect(rec.play(-5)).toBe(0) // 0x6fb38a81
    const vol0 = SOUNDS_113C.find((r) => r.id > 0 && r.volume === 0)!
    expect(rec.play(vol0.id)).toBe(0) // 0x6fb38ab7
    expect(rec.records()).toHaveLength(0)
    expect(() => rec.play(4699)).toThrow(/NULL row/)

    const none = getSoundRow113c(332)! // impact_blunt_4: FileName none.wav, Volume 255
    expect([none.fileName, none.volume]).toEqual(['none.wav', 255])
    const h = rec.play(332)
    expect(h).toBeGreaterThan(0)
    expect(rec.record(h)?.state).toBe(0)
    rec.play(4)
    rec.update()
    expect(rec.record(h), 'the failed one-shot is freed in the same SoundUpdate (0x6fb3932a–0x6fb3934e)').toBeUndefined()
    expect(log.starts.map((s) => s.soundId)).toEqual([4])
    expect(rec.unavailableCounts()).toEqual({ 'none.wav': 1, unshipped: 0, streamed: 0 })
    expect(unavailable).toEqual([[332, 'none.wav']])

    // AllocRec 0x6fb37d80: the 201st concurrent record gets no handle.
    const pool = SoundRecords113c.fromSounds113c({ sampleFacts: (id) => facts.get(id) })
    const handles = Array.from({ length: 200 }, () => pool.play(4))
    expect(new Set(handles).size).toBe(200)
    expect(pool.play(4)).toBe(0)
  })

  it('never synthesizes a duration: a started sound without facts throws; source-declared unavailable samples are counted', () => {
    expect(() => {
      const rec = SoundRecords113c.fromSounds113c()
      rec.play(4)
      rec.update()
    }).toThrow(/no sampleFacts source injected/)
    expect(() => {
      const rec = SoundRecords113c.fromSounds113c({ sampleFacts: () => undefined })
      rec.play(4)
      rec.update()
    }).toThrow(/no sample facts for Sounds\.txt row 4 \(cursor_button_click\)/)
    expect(() => {
      const rec = SoundRecords113c.fromSounds113c({ sampleFacts: () => ({ kind: 'pcm', sampleRate: 22050, frames: 0, channels: 1 }) })
      rec.play(4)
      rec.update()
    }).toThrow(/invalid PCM facts/)
    // Playing never needs facts; only StartSound does.
    expect(SoundRecords113c.fromSounds113c().play(4)).toBeGreaterThan(0)

    const { rec, log } = rig([makeTestRow({ id: 70 }), makeTestRow({ id: 71 })], 10, {
      sampleFacts: (id) => (id === 70 ? { kind: 'unavailable', reason: 'unshipped' } : { kind: 'unavailable', reason: 'streamed' }),
    })
    const h70 = rec.play(70)
    rec.play(71)
    rec.update()
    expect(log.starts).toHaveLength(0)
    expect(rec.record(h70)).toBeUndefined()
    expect(rec.unavailableCounts()).toEqual({ 'none.wav': 0, unshipped: 1, streamed: 1 })
  })

  it('same-id debounce 0x6fb0d7e4–0x6fb0d808: < 2 ticks between scheduled starts blocks unless the request has a higher priority', () => {
    const { rec, log } = rig([makeTestRow({ id: 100, priority: 120 })], 40)
    // Tick 0: equal requests sort by record address desc (0x6fb38e4e), so the second one starts and the first is dropped.
    const h1 = rec.play(100)
    const h2 = rec.play(100)
    rec.update()
    expect(log.starts).toHaveLength(1)
    expect(rec.record(h2)?.state).toBe(1)
    expect(rec.record(h1)).toBeUndefined()
    rec.endTick()
    // Tick 1: (1 − 0) < 2 and 120 ≥ 120 → dropped.
    const h3 = rec.play(100)
    rec.update()
    expect(log.starts).toHaveLength(1)
    expect(rec.record(h3)).toBeUndefined()
    // Tick 1, local player (+80 → 200 > 120) → passes.
    const hBoost = rec.play(100, { unit: localPlayer() })
    rec.update()
    expect(log.starts).toHaveLength(2)
    expect(rec.record(hBoost)).toMatchObject({ state: 1, priority: 200 })
    rec.endTick()
    // Tick 2: a lower-priority duplicate of the boosted voice is still inside its window (earliest start is h2 at 0, (2 − 0) = 2 → passes).
    const hLater = rec.play(100)
    rec.update()
    expect(log.starts).toHaveLength(3)
    expect(rec.record(hLater)?.state).toBe(1)

    // A lower-priority duplicate inside the window of a higher-priority voice is dropped.
    const b = rig([makeTestRow({ id: 100, priority: 120 })], 40)
    b.rec.play(100, { unit: localPlayer() })
    step(b.rec)
    b.rec.play(100)
    step(b.rec)
    expect(b.log.starts).toHaveLength(1)
  })

  it('the debounce compares SCHEDULED start ticks unsigned (D23): an older pending loop that becomes audible after a newer voice started is not debounced', () => {
    // Falloff 0: maxDist 400 (0x6fb39590). The old loop waits out of range (a loop stays pending, 0x6fb39331).
    const { rec, log } = rig([makeTestRow({ id: 300, loop: true, falloff: 0 })], 100)
    const hOld = rec.play(300)
    expect(rec.setSoundPos(hOld, 1000, 0, 0)).toBe(true)
    step(rec, 5)
    expect(log.starts).toHaveLength(0)
    expect(rec.record(hOld)?.state).toBe(0)
    rec.play(300) // scheduled and started at tick 5
    step(rec)
    expect(log.starts).toHaveLength(1)
    rec.setSoundPos(hOld, 0, 0, 0)
    step(rec) // tick 6: (u32)(0 − 5) ≥ 2 → not debounced (a `now − started` rule would block: 6 − 5 = 1)
    expect(log.starts).toHaveLength(2)
    expect(rec.record(hOld)?.state).toBe(1)
  })

  it('the debounce ignores a playing duplicate that is flagged stop (0x6fb0d7f0), e.g. one fading out', () => {
    const { rec, log } = rig([makeTestRow({ id: 110, fadeOut: 10 })], 60)
    const h1 = rec.play(110)
    step(rec)
    rec.stop(h1) // StopWithFade: stop = 1 and a 10-tick fade-out; the channel keeps playing
    expect(rec.record(h1)).toMatchObject({ stop: true, fading: true, state: 1 })
    rec.play(110)
    step(rec) // tick 1: (1 − 0) < 2, equal priority, but the duplicate is flagged stop
    expect(log.starts).toHaveLength(2)
  })

  it('Defer Inst (0x6fb39214–0x6fb392ac): a conflicting request is dropped (never deferred); speech uses FindSpeechConflict whenever the record has one unit', () => {
    expect(LOCAL_SPEECH_SOUND_RANGE_113C).toEqual([2934, 4656])
    expect([getSoundRow113c(2934)!.deferInst, getSoundRow113c(2935)!.deferInst, getSoundRow113c(2935)!.groupBase]).toEqual([true, true, 2934])
    const facts = mpqSampleFacts113c([2934, 2935])
    const speech = () => {
      const log = createVoiceLogger()
      const rec = SoundRecords113c.fromSounds113c({
        rng: new D2Rng(1, 666),
        voices: log.backend,
        listenerPos: () => ({ x: 0, y: 0 }),
        sampleFacts: (id) => facts.get(id),
      })
      return { rec, log }
    }
    // (a) Same unit: FindSpeechConflict 0x6fb37bd0 finds the playing 2934 → 2935 (Defer) is flagged stop and freed.
    const a = speech()
    const amazon = unit('player', 7)
    a.rec.play(2934, { unit: amazon, a2: 1 })
    step(a.rec)
    const h2 = a.rec.play(2935, { unit: amazon, a2: 1 })
    a.rec.update()
    expect(a.rec.record(h2), 'the new record is dropped in this SoundUpdate').toBeUndefined()
    a.rec.endTick()
    step(a.rec, 200)
    expect(a.log.starts.map((s) => s.soundId), 'the dropped request never starts later').toEqual([2934])

    // (b) No unit: no speech check; Defer without units at a non-zero position (z = 320) skips the check (0x6fb3925a).
    const b = speech()
    b.rec.play(2934, { a2: 1 })
    step(b.rec)
    b.rec.play(2935, { a2: 1 })
    step(b.rec)
    expect(b.log.starts.map((s) => s.soundId)).toEqual([2934, 2935])

    // (c) Group Defer row with a unit: FindGroupConflict 0x6fb37c30 is unit-filtered.
    const rows = [makeTestRow({ id: 600, groupSize: 2, deferInst: true }), makeTestRow({ id: 601, groupBase: 600, deferInst: true })]
    const c = rig(rows, 100)
    const monsterA = unit('monster', 41)
    const monsterB = unit('monster', 42)
    c.rec.play(600, { unit: monsterA, a2: 1 })
    step(c.rec)
    const dropped = c.rec.play(601, { unit: monsterA, a2: 1 })
    c.rec.play(601, { unit: monsterB, a2: 1 })
    step(c.rec)
    expect(c.rec.record(dropped)).toBeUndefined()
    expect(c.log.starts.map((s) => s.soundId)).toEqual([600, 601])
  })

  it('Stop Inst (0x6fb3926d–0x6fb39274): exactly one conflicting record (earliest start) is stopped and freed; stopping records still conflict; unit-less records do not conflict with a unit request', () => {
    const rows = [
      makeTestRow({ id: 500, groupSize: 3, stopInst: true }),
      makeTestRow({ id: 501, groupBase: 500, stopInst: true }),
      makeTestRow({ id: 502, groupBase: 500, stopInst: true }),
    ]
    const { rec, log } = rig(rows, 100)
    const hA = rec.play(500, { unit: unit('monster', 1), a2: 1 })
    step(rec)
    const hB = rec.play(501, { unit: unit('monster', 2), a2: 1 }) // other unit → no conflict
    step(rec, 2)
    expect(log.starts).toHaveLength(2)
    const [vA, vB] = log.starts.map((s) => s.voice)
    const hC = rec.play(502, { a2: 1 }) // no unit: every playing record of the group conflicts → only the earliest is stopped
    step(rec)
    expect(log.starts).toHaveLength(3)
    expect(log.stops).toEqual([vA])
    expect(rec.record(hA)).toBeUndefined()
    expect(rec.record(hB)?.state).toBe(1)
    expect(rec.record(hC)?.state).toBe(1)
    expect(log.stops).not.toContain(vB)

    // A record that is fading out (stop = 1, still playing) is a conflict too and is cut.
    const fading = rig([makeTestRow({ id: 510, groupSize: 2, stopInst: true, fadeOut: 20 }), makeTestRow({ id: 511, groupBase: 510, stopInst: true, fadeOut: 20 })], 100)
    const h1 = fading.rec.play(510, { a2: 1 })
    step(fading.rec)
    fading.rec.stop(h1)
    expect(fading.rec.record(h1)).toMatchObject({ fading: true, stop: true, state: 1 })
    fading.rec.play(511, { a2: 1 })
    step(fading.rec)
    expect(fading.rec.record(h1)).toBeUndefined()
    expect(fading.log.stops).toHaveLength(1)

    // A unit-scoped request ignores playing records without units (#10053 never matches an empty list).
    const scoped = rig(rows, 100)
    scoped.rec.play(500, { a2: 1 })
    step(scoped.rec)
    scoped.rec.play(501, { unit: unit('monster', 9), a2: 1 })
    step(scoped.rec)
    expect(scoped.log.starts).toHaveLength(2)
    expect(scoped.log.stops).toEqual([])
  })

  it('Compound (0x6fb38ac8 → 0x6fb37fe0): reuse within Compound ticks (unsigned age) or forever when negative; +80 is a byte add on every local-player reuse', () => {
    const rows = [
      makeTestRow({ id: 10, compound: 3 }),
      makeTestRow({ id: 11, compound: -1 }),
      makeTestRow({ id: 12, compound: 5, priority: 200 }),
      makeTestRow({ id: 13, compound: 4 }),
      makeTestRow({ id: 20, groupSize: 2, compound: 5 }),
      makeTestRow({ id: 21, groupBase: 20, compound: 5 }),
    ]
    const { rec, log } = rig(rows, 200)
    const u1 = unit('monster', 101, 2, 0)
    const u2 = unit('monster', 102, 4, 0)
    const h1 = rec.play(10, { unit: u1 })
    step(rec, 2)
    expect(rec.play(10, { unit: u2 })).toBe(h1) // age 2 ≤ 3
    expect(rec.record(h1)?.units.map((u) => u.id)).toEqual([102, 101]) // #10034 prepends
    step(rec, 2)
    expect(rec.play(10)).not.toBe(h1) // age 4 > 3
    expect(log.starts.filter((s) => s.soundId === 10)).toHaveLength(1)

    const hNeg = rec.play(11)
    step(rec, 150)
    expect(rec.play(11)).toBe(hNeg)

    const hp = rec.play(12, { unit: localPlayer() })
    expect(rec.record(hp)?.priority).toBe((200 + LOCAL_PLAYER_PRIORITY_BOOST_113C) & 0xff) // 24
    expect(rec.play(12, { unit: localPlayer() })).toBe(hp)
    expect(rec.record(hp)?.priority).toBe(104)
    rec.play(12, { unit: localPlayer() })
    rec.play(12, { unit: localPlayer() })
    expect(rec.record(hp)?.priority).toBe((184 + 80) & 0xff) // 8

    // A pending record scheduled in the future has a huge unsigned age and is not reused.
    const hFuture = rec.play(13, { delayTicks: 10 })
    expect(rec.play(13)).not.toBe(hFuture)

    // The whole variant group shares the reuse (groupBase match).
    const g = rec.play(20, { a2: 1 })
    expect(rec.play(21)).toBe(g)
  })

  it('SetSoundPos 0x6fb38ba0 moves any record (no unit check); unit positions are screen coordinates (Δcx, 2·Δcy, 640) via D2Common #10628; Tracking re-syncs; +80 wraps as a byte', () => {
    const rows = [
      makeTestRow({ id: 20, tracking: true, falloff: 2 }),
      makeTestRow({ id: 21, falloff: 2 }),
      makeTestRow({ id: 22, priority: 255 }),
    ]
    let pos: { x: number; y: number } | null = { x: 105, y: 100 }
    const { rec, log } = rig(rows, 200, { listenerPos: () => ({ x: 100, y: 100 }) })
    const tracked: SoundUnitRef113c = { unitType: 'monster', id: 5, getPos: () => pos }
    const hT = rec.play(20, { unit: tracked })
    // Δsubtile (5, 0): cx = 16·5 = 80, cy = 8·5 = 40 → (80, 2·40, 640), dist² 12,800 (not 32 px per sub-tile).
    expect(rec.record(hT)).toMatchObject({ x: 80, y: 80, z: 640, dist2: 12800 })
    pos = { x: 103, y: 103 } // straight down on screen
    step(rec)
    expect(rec.record(hT)).toMatchObject({ x: 0, y: 96, z: 640 })
    const vT = log.starts.find((s) => s.soundId === 20)!.voice
    const g = log.gains.filter((e) => e.voice === vT).at(-1)!
    expect(g.left).toBeCloseTo(g.right, 12)

    // A non-Tracking unit record keeps its play-time position; SetSoundPos still moves it.
    const hN = rec.play(21, { unit: unit('monster', 6, 105, 100) })
    expect(rec.record(hN)).toMatchObject({ x: 80, y: 80, z: 640 })
    expect(rec.setSoundPos(hN, 120, -40, 0)).toBe(true)
    step(rec)
    expect(rec.record(hN)).toMatchObject({ x: 120, y: -40, z: 640 })
    expect(rec.setSoundPos(hN, 5000, -7000, 10)).toBe(true)
    expect(rec.record(hN)).toMatchObject({ x: 5000, y: -7000, z: 650, dist2: 2000 * 2000 * 2 }) // SetPos clamps x / y for dist²
    expect(rec.setSoundPos(0, 1, 2, 3)).toBe(false)
    expect(rec.setSoundPos(987_654, 1, 2, 3)).toBe(false)
    expect(() => rec.setSoundPos(hN, 1.5, 0, 0)).toThrow(/integer/)

    // +80 local-player boost (0x6fb38b72): 100 → 180, 255 → 79.
    const lp = { ...localPlayer(), x: 100, y: 100 }
    expect(rec.record(rec.play(21, { unit: lp }))?.priority).toBe(100 + LOCAL_PLAYER_PRIORITY_BOOST_113C)
    expect(rec.record(rec.play(22, { unit: lp }))?.priority).toBe(79)
    expect(rec.record(rec.play(22, { unit: unit('monster', 8, 100, 100) }))?.priority).toBe(255)

    // A unit-attached sound needs the listener (the local player).
    const noListener = new SoundRecords113c({ rows })
    expect(() => noListener.play(20, { unit: tracked })).toThrow(/listenerPos/)
  })

  it('object_river (2599) gets the 0x6fb37f54–0x6fb37fa2 projection; client coordinates follow D2Common #10628', () => {
    expect(unitClientCoords113c(5, 0)).toEqual({ cx: 80, cy: 40 })
    expect(unitClientCoords113c(5.5, 0)).toEqual({ cx: 88, cy: 44 }) // X32 = ⌊5.5·32⌋ = 176
    expect(unitClientCoords113c(100, 100)).toEqual({ cx: 0, cy: 1600 })
    const listener = { x: 100, y: 100 }
    const river = { x: 110, y: 100 }
    expect(unitSoundPosition113c(river, listener, 21)).toEqual({ x: 160, y: 160, z: 640 })
    // t = −0.4f·(−2·0 − 0.5·160 + 1600 − 1680) = 64.00000095… → cx' = 64; cy' = ⌊2t + 1600⌋ = 1728 → (64, 2·128, 640).
    expect(unitSoundPosition113c(river, listener, 2599)).toEqual({ x: 64, y: 256, z: 640 })
    expect(getSoundRow113c(2599)).toMatchObject({ sound: 'object_river', tracking: true, loop: true })
    const rec = SoundRecords113c.fromSounds113c({ listenerPos: () => listener })
    const h = rec.play(2599, { unit: { unitType: 'object', id: 3, ...river } })
    expect(rec.record(h)).toMatchObject({ x: 64, y: 256, z: 640 })
  })

  it('16 channels = 4 stereo + 12 mono (0x6fb0d577); AllocChannel 0x6fb0ce70 steals only inside the partition: min priority → max dist² → oldest → lowest address, equal priority iff victim.address < request.address', () => {
    expect([SOUND_MAX_CHANNELS, SOUND_STEREO_CHANNELS_113C]).toEqual([16, 4])
    const mono = Array.from({ length: 13 }, (_, i) => makeTestRow({ id: i + 1, priority: 100, falloff: 4 }))
    const rows = [
      ...mono,
      makeTestRow({ id: 50, priority: 50, falloff: 4 }),
      makeTestRow({ id: 150, priority: 150, falloff: 4 }),
      ...Array.from({ length: 6 }, (_, i) => makeTestRow({ id: 31 + i, priority: 100, stereo: 1, falloff: 4 })),
    ]
    const { rec, log } = rig(rows, 500)
    const handles = mono.slice(0, 12).map((row, i) => {
      const h = rec.play(row.id)
      rec.setSoundPos(h, 10 * (i + 1), 0, 0) // distinct dist²; farthest = index 11
      return h
    })
    step(rec)
    expect(rec.activeChannelCount()).toBe(12)
    expect(handles.every((h) => rec.record(h)!.channel >= SOUND_STEREO_CHANNELS_113C)).toBe(true)

    // Lower priority: dropped without stealing (one-shot freed).
    const hLow = rec.play(50)
    step(rec)
    expect(rec.record(hLow)).toBeUndefined()
    expect(log.stops).toEqual([])

    // Higher priority: steals the farthest mono voice.
    const farthest = rec.record(handles[11]!)!.voice
    const hHigh = rec.play(150)
    step(rec)
    expect(log.stops).toEqual([farthest])
    expect(rec.record(hHigh)?.state).toBe(1)
    expect(rec.activeChannelCount()).toBe(12)

    // Stereo rows use channels 0..3 only and never touch a mono voice.
    const stereo = [31, 32, 33, 34].map((id) => rec.play(id))
    step(rec)
    expect(stereo.map((h) => rec.record(h)!.channel).sort()).toEqual([0, 1, 2, 3])
    expect(rec.activeChannelCount()).toBe(16)
    const stopsBefore = log.stops.length
    // Equal priority, higher address than every stereo holder: steals the oldest-start / lowest-address stereo voice.
    const victim = rec.record(stereo[0]!)!.voice
    const h5 = rec.play(35)
    step(rec)
    expect(log.stops.slice(stopsBefore)).toEqual([victim])
    expect(rec.record(h5)!.channel).toBeLessThan(SOUND_STEREO_CHANNELS_113C)
    expect(rec.activeChannelCount()).toBe(16)
  })

  it('equal-priority requests do not steal from a lower record address (0x6fb0cf29): of 13 same-tick requests the lowest-address one is dropped', () => {
    const rows = Array.from({ length: 13 }, (_, i) => makeTestRow({ id: i + 1, priority: 100 }))
    const { rec, log } = rig(rows, 200)
    const handles = rows.map((r) => rec.play(r.id)) // slots 0..12, all at (0, 0, 320), start 0
    step(rec) // processed by address desc: slots 12..1 take the 12 mono channels; slot 0 cannot steal slot 1
    expect(log.starts).toHaveLength(12)
    expect(log.stops).toEqual([])
    expect(rec.record(handles[0]!)).toBeUndefined()
    expect(handles.slice(1).every((h) => rec.record(h)?.state === 1)).toBe(true)
  })

  it('soloDuck 0x6fb39449–0x6fb3957e: −2 per moved tick to 70 while a Solo row plays, +2 back to 100; Solo = 0 output ×0.70; a fading-out solo row does not duck', () => {
    const rows = [makeTestRow({ id: 60, loop: true }), makeTestRow({ id: 61, solo: true, loop: true, fadeOut: 4 })]
    const { rec, log } = rig(rows, 200)
    rec.play(60)
    step(rec, 3)
    const vLoop = log.starts[0]!.voice
    const g0 = log.gains.filter((e) => e.voice === vLoop).at(-1)!
    const hSolo = rec.play(61)
    const down: number[] = []
    for (let i = 0; i < 18; i += 1) {
      step(rec)
      down.push(rec.soloDuck)
    }
    expect(down).toEqual([98, 96, 94, 92, 90, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70, 70, 70, 70])
    rec.update() // the clock did not move: no duck step
    expect(rec.soloDuck).toBe(70)
    rec.endTick()
    const g1 = log.gains.filter((e) => e.voice === vLoop).at(-1)!
    const expected = channelOutput113c({ vol: 255, volume: 200, master: 100, pauseDuck: 100, soloDuck: 70, pauseExempt: false, soloRow: false, x: 0, y: 0, z: 320, minDist: 60, maxDist: 700 })
    expect([g1.left, g1.right]).toEqual([expected.left, expected.right])
    expect(g1.left / g0.left).toBeCloseTo(0.7, 2)
    rec.stop(hSolo) // StopWithFade: fading out (ft = 0) over Fade Out 4 ticks → no longer counts as solo
    const up: number[] = []
    for (let i = 0; i < 18; i += 1) {
      step(rec)
      up.push(rec.soloDuck)
    }
    // The update in which the fade-out ends (now > fe) clears the fading flag (0x6fb390dd–0x6fb390e3) BEFORE the
    // solo scan (0x6fb394dd–0x6fb394fa), and the stopped record is only stopped and freed by the NEXT update's stop
    // pass (0x6fb38e6e) → state 2 → free list: the binary ducks once more (−2) on that update.
    expect(up).toEqual([72, 74, 76, 78, 80, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 100])
    expect(rec.record(hSolo)).toBeUndefined()
  })

  it('Async Only (0x6fb3932a–0x6fb3934e): a loading sample keeps an Async Only record pending and drops any other one-shot; the port hold asyncPending waits for setAsyncReady', () => {
    const rows = [makeTestRow({ id: 80, asyncOnly: true }), makeTestRow({ id: 81 }), makeTestRow({ id: 82 })]
    let loading = true
    const { rec, log } = rig(rows, 20, { sampleState: (id) => (loading && id !== 82 ? 'loading' : 'ready') })
    const hAsync = rec.play(80)
    const hPlain = rec.play(81)
    step(rec, 3)
    expect(rec.record(hAsync)?.state).toBe(0)
    expect(rec.record(hPlain)).toBeUndefined()
    loading = false
    step(rec)
    expect(rec.record(hAsync)?.state).toBe(1)

    const hHeld = rec.play(82, { asyncPending: true })
    step(rec, 4)
    expect(rec.record(hHeld)).toMatchObject({ state: 0, asyncPending: true })
    rec.setAsyncReady(hHeld)
    step(rec)
    expect(rec.record(hHeld)).toMatchObject({ state: 1, asyncPending: false })
    expect(log.starts.map((s) => s.soundId)).toEqual([80, 82])
  })

  it('a non-streamed loop restarts at position 0 with its Fade In (#10032 saves 0 without a stream); a streamed loop resumes at its saved position over 3 ticks (0x6fb39279–0x6fb392c9)', () => {
    const rows = [makeTestRow({ id: 40, loop: true, fadeIn: 5, falloff: 0 }), makeTestRow({ id: 41, loop: true, stream: true, fadeIn: 5, falloff: 0 })]
    const run = (id: number) => {
      const { rec, log } = rig(rows, 50)
      const h = rec.play(id)
      step(rec, 11) // started at tick 0, fade-in done
      rec.setSoundPos(h, 1000, 0, 0) // out of range (maxDist 400): StopChannel at tick 11
      step(rec, 3)
      const saved = rec.record(h)!.savedPos
      rec.setSoundPos(h, 0, 0, 0)
      const vols: number[] = []
      for (let i = 0; i < 7; i += 1) {
        step(rec)
        vols.push(rec.record(h)!.vol)
      }
      return { saved, starts: log.starts, vols }
    }
    const plain = run(40)
    expect(plain.saved).toBe(0)
    expect(plain.starts.map((s) => s.offsetFrames)).toEqual([0, 0])
    expect(plain.vols).toEqual([0, 51, 102, 153, 204, 255, 255]) // Fade In 5
    const streamed = run(41)
    expect(streamed.saved).toBe((11 * 882) % (50 * 882)) // playOffset + ⌊11 ticks · 22,050 / 25⌋
    expect(streamed.starts.map((s) => s.offsetFrames)).toEqual([0, 11 * 882])
    expect(streamed.vols).toEqual([0, 85, 170, 255, 255, 255, 255]) // 3-tick resume fade
  })

  it('nBlocks == 1 rows loop from Block 1 (StartSound 0x6fb0d8d4–0x6fb0d8e4 → #10050(handle, Block1 << 1), a 16-bit PCM byte offset)', () => {
    const rows = [makeTestRow({ id: 90, loop: true, nBlocks: 1, block1: 1000 }), makeTestRow({ id: 91, loop: true, nBlocks: 1, block1: 1000 })]
    const { rec, log } = rig(rows, 50, { sampleFacts: (id) => pcm(50, id === 90 ? 1 : 2) })
    rec.play(90)
    rec.play(91)
    step(rec)
    expect(Object.fromEntries(log.starts.map((s) => [s.soundId, s.loopStartFrames]))).toEqual({ 90: 1000, 91: 500 })

    // monster_chargedbolt_1 (423): loop with Block 1 = 14427 (frames of its mono 16-bit WAV).
    const row = getSoundRow113c(423)!
    expect(row).toMatchObject({ loop: true, nBlocks: 1, block1: 14427, stream: false })
    const facts = mpqSampleFacts113c([423])
    const real = createVoiceLogger()
    const recReal = SoundRecords113c.fromSounds113c({ voices: real.backend, sampleFacts: (id) => facts.get(id), rng: new D2Rng(1, 666) })
    recReal.play(423, { a2: 1 })
    step(recReal)
    const f = facts.get(423)!
    if (f.kind !== 'pcm') throw new Error('423 has PCM facts')
    expect(real.starts[0]).toMatchObject({ soundId: 423, loop: true, offsetFrames: 0, loopStartFrames: Math.floor((14427 * 2) / (2 * f.channels)) })
  })

  it('Fade 0x6fb38230 does nothing for a record with two or more units (0x6fb38266 → 0x6fb37e90): StopSound then stops it at once', () => {
    const rows = [makeTestRow({ id: 95, compound: 10, fadeOut: 8 })]
    const single = rig(rows, 100)
    const h1 = single.rec.play(95, { unit: unit('monster', 1) })
    step(single.rec)
    single.rec.stop(h1)
    expect(single.rec.record(h1)).toMatchObject({ stop: true, fading: true })
    step(single.rec)
    expect(single.rec.record(h1)?.state).toBe(1) // still fading out

    const multi = rig(rows, 100)
    const h2 = multi.rec.play(95, { unit: unit('monster', 1) })
    step(multi.rec)
    expect(multi.rec.play(95, { unit: unit('monster', 2) })).toBe(h2)
    multi.rec.stop(h2)
    expect(multi.rec.record(h2)).toMatchObject({ stop: true, fading: false })
    step(multi.rec)
    expect(multi.rec.record(h2)).toBeUndefined()
    expect(multi.log.stops).toHaveLength(1)
  })

  it('a removed unit leaves its records (0x6fb38c20, flag 0): a one-shot plays out, a fading-out loop keeps fading, an active loop gets StopWithFade', () => {
    const rows = [makeTestRow({ id: 120 }), makeTestRow({ id: 121, loop: true, fadeOut: 6 }), makeTestRow({ id: 122, loop: true })]
    const { rec, log } = rig(rows, 30)
    const oneShotUnit = unit('monster', 1, 3, 0)
    const loopUnit = unit('monster', 2)
    const loop2Unit = unit('monster', 3)
    const hOne = rec.play(120, { unit: oneShotUnit })
    const hLoop = rec.play(121, { unit: loopUnit })
    const hLoop2 = rec.play(122, { unit: loop2Unit })
    step(rec)
    oneShotUnit.alive = false
    loopUnit.alive = false
    loop2Unit.alive = false
    step(rec)
    expect(rec.record(hOne)).toMatchObject({ state: 1, units: [], x: 48, y: 48 }) // keeps its last position
    expect(rec.record(hLoop)).toMatchObject({ state: 1, stop: true, fading: true })
    expect(rec.record(hLoop2), 'no Fade Out: stopped and freed in the same update').toBeUndefined()
    step(rec, 8)
    expect(rec.record(hLoop), 'freed once the fade-out ended').toBeUndefined()
    step(rec, 30)
    expect(rec.record(hOne), 'the one-shot ended with its buffer').toBeUndefined()
    expect(log.starts).toHaveLength(3)
  })
})
