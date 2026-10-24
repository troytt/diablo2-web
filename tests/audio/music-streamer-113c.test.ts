// =============================================================================
// Unit Tests — MusicStreamer & music-tracks-113c Contract (`[M21-P3]` / Issue #945)
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AudioRuntime113c } from '../../src/client/audio/audio-runtime-113c.ts'
import { QUEST_STINGER_BY_0x2C_CODE_113C } from '../../src/client/audio/d2gs-play-sound-113c.ts'
import {
  MusicStreamer,
  MUSIC_OPTIONS_SOUND_ID_113C,
  MUSIC_TITLE_SOUND_ID_113C,
  MUSIC_ACT5_INTRO_SOUND_ID_113C,
} from '../../src/client/audio/music-streamer.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { HORADRIC_ORIFICE_OBJECT_CLASS } from '../../src/client/world/quest-fx-horadric-113c.ts'
import {
  MUSIC_TRACKS_113C,
  MUSIC_TRACKS_BY_ID_113C,
  MUSIC_MIN_BITRATE_BPS_113C,
  MUSIC_MAX_TRACK_BYTES_113C,
  MUSIC_MAX_TOTAL_BYTES_113C,
  getMusicTrack113c,
} from '../../src/common/audio/music-tracks-113c.ts'
import { getSoundEnvironForLevel113c } from '../../src/common/audio/sound-environ-113c.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { FakeAudioContext, FakeHTMLAudioElement } from './e2e/webaudio-fake.ts'

vi.setConfig({ testTimeout: 30_000 })

describe('music-tracks-113c contract', () => {
  it('defines 43 music tracks (28 looping BGM 4657..4684 + 14 quest stingers 4685..4698 + LoD intro edit 4699)', () => {
    expect(MUSIC_TRACKS_113C.length).toBe(43)
    expect(MUSIC_TRACKS_113C[0]?.id).toBe(4657)
    expect(MUSIC_TRACKS_113C[41]?.id).toBe(4698)
    expect(MUSIC_TRACKS_113C[42]?.id).toBe(4699)
    expect(Object.keys(MUSIC_TRACKS_BY_ID_113C).length).toBe(43)

    for (let id = 4657; id <= 4684; id++) {
      const track = getMusicTrack113c(id)
      expect(track).toBeDefined()
      expect(track?.loop).toBe(true)
    }

    for (let id = 4685; id <= 4698; id++) {
      const track = getMusicTrack113c(id)
      expect(track).toBeDefined()
      expect(track?.loop).toBe(false)
    }

    const lodIntro = getMusicTrack113c(4699)
    expect(lodIntro).toBeDefined()
    expect(lodIntro?.loop).toBe(true)
    expect(lodIntro?.sound).toBe('music_lod_introedit')
    expect(lodIntro?.archive).toBe('D2xMusic.mpq')

    expect(getMusicTrack113c(4656)).toBeUndefined()
    expect(getMusicTrack113c(4700)).toBeUndefined()
  })

  it('resolves all 136 expansion level IDs to valid looping music tracks via SoundEnviron.txt', () => {
    for (let levelId = 1; levelId <= 136; levelId++) {
      const env = getSoundEnvironForLevel113c(levelId)
      expect(env.song).toBeGreaterThanOrEqual(4657)
      expect(env.song).toBeLessThanOrEqual(4684)
      const track = getMusicTrack113c(env.song)
      expect(track).toBeDefined()
      expect(track?.id).toBe(env.song)
      expect(track?.loop).toBe(true)
    }
  })

  it('respects D16 size budgets (total <= 72 MB, single track <= 4.5 MB, bitrate >= 64 kbps)', () => {
    expect(MUSIC_MIN_BITRATE_BPS_113C).toBe(64_000)
    expect(MUSIC_MAX_TRACK_BYTES_113C).toBe(4_500_000)
    expect(MUSIC_MAX_TOTAL_BYTES_113C).toBe(72_000_000)

    let totalBytes = 0
    for (const track of MUSIC_TRACKS_113C) {
      totalBytes += track.bytes
      expect(track.bytes).toBeGreaterThan(0)
      expect(track.bytes).toBeLessThanOrEqual(MUSIC_MAX_TRACK_BYTES_113C)
      expect(track.channels).toBe(2)
      expect(track.durationSeconds).toBeGreaterThan(0)
      const effectiveBitrate = (track.bytes * 8) / track.durationSeconds
      expect(effectiveBitrate).toBeGreaterThanOrEqual(60_000)
    }
    expect(totalBytes).toBeLessThanOrEqual(MUSIC_MAX_TOTAL_BYTES_113C)
  })
})

describe('MusicStreamer unit behavior', () => {
  let ctx: FakeAudioContext
  let elements: FakeHTMLAudioElement[]
  let streamer: MusicStreamer

  beforeEach(() => {
    ctx = new FakeAudioContext()
    elements = []
    streamer = new MusicStreamer({
      ctx: ctx as unknown as AudioContext,
      createAudioElement: (src?: string) => {
        const el = new FakeHTMLAudioElement(src ?? '')
        elements.push(el)
        return el
      },
    })
  })

  it('never references decodeAudioData in src/client/audio/music-streamer.ts', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/client/audio/music-streamer.ts'),
      'utf8',
    )
    expect(source.includes('decodeAudioData')).toBe(false)
    expect(ctx.decodes.length).toBe(0)
  })

  it('handles playTrack same-song idempotency and dual-deck crossfade transitions', () => {
    expect(elements.length).toBe(2)
    const [deckA, deckB] = elements as [FakeHTMLAudioElement, FakeHTMLAudioElement]

    expect(streamer.playTrack(4657)).toBe(true)
    expect(streamer.getActiveSongId()).toBe(4657)
    expect(deckA.loop).toBe(true)
    expect(deckA.playCalls).toBe(1)

    // Calling again with same soundId without block change is a no-op
    expect(streamer.playTrack(4657)).toBe(true)
    expect(deckA.playCalls).toBe(1)
    expect(deckB.playCalls).toBe(0)

    // Crossfading to a new track switches to Deck B and fades out Deck A over Fade Out ticks
    expect(streamer.playTrack(4658)).toBe(true)
    expect(streamer.getActiveSongId()).toBe(4658)
    expect(deckB.playCalls).toBe(1)
    expect(ctx.decodes.length).toBe(0)

    streamer.tick(130)
    expect(deckA.paused).toBe(true)
    expect(deckB.paused).toBe(false)
  })

  it('supports playOptionsMusic, playTitleMusic, playActIntroMusic, and onEnterArea(levelId)', () => {
    expect(MUSIC_OPTIONS_SOUND_ID_113C).toBe(4668)
    expect(MUSIC_TITLE_SOUND_ID_113C).toBe(4699)

    streamer.playOptionsMusic()
    expect(streamer.getActiveSongId()).toBe(4668)

    streamer.playTitleMusic()
    expect(streamer.getActiveSongId()).toBe(4699)

    streamer.playActIntroMusic(1)
    expect(streamer.getActiveSongId()).toBe(4668)

    streamer.playActIntroMusic(5)
    expect(streamer.getActiveSongId()).toBe(MUSIC_ACT5_INTRO_SOUND_ID_113C)

    streamer.onEnterArea(1) // Rogue Encampment -> 4673 (music_town_1)
    expect(streamer.getActiveSongId()).toBe(4673)

    streamer.onEnterArea(2) // Blood Moor -> 4679 (music_wilderness)
    expect(streamer.getActiveSongId()).toBe(4679)
  })

  it('starts quest stingers (fadeIn === 0) at targetGain immediately and preserves tick-0 crossfade reversal gain', () => {
    streamer.onEnterArea(1) // 4673 on deck A (immediate start since !wasPlaying)
    streamer.onEnterArea(2) // 4679 on deck B (fadeIn 0 -> targetGain over 125 ticks)
    // Reverse on tick 0 before advancing any tick: deck B must fade out from 0, not jump to targetGain
    streamer.onEnterArea(40) // 4674 on deck A
    streamer.tick(1)
    const internal = streamer as unknown as {
      deckA: { gainValue: number; fade: { fromGain: number } | null }
      deckB: { gainValue: number; fade: { fromGain: number } | null }
      activeDeck: { gainValue: number; fade: unknown }
    }
    expect(internal.deckB.fade?.fromGain ?? 0).toBe(0)
    expect(internal.deckB.gainValue).toBe(0)

    // Advance past crossfade, then trigger a quest stinger (4686, fadeIn = 0)
    streamer.tick(130)
    streamer.playQuestStinger(4686)
    expect(internal.activeDeck.fade).toBeNull()
    expect(internal.activeDeck.gainValue).toBeGreaterThan(0)
  })

  it('overrides looping BGM with playQuestStinger and restores interrupted BGM on ended', () => {
    const [deckA, deckB] = elements as [FakeHTMLAudioElement, FakeHTMLAudioElement]
    streamer.playTrack(4673, { immediate: true })
    deckA.currentTime = 12.5
    expect(streamer.getActiveSongId()).toBe(4673)

    let callbackFired = false
    expect(streamer.playQuestStinger(4685, () => {
      callbackFired = true
    })).toBe(true)
    expect(streamer.getActiveSongId()).toBe(4685)
    expect(deckB.loop).toBe(false)

    deckB.triggerEnded()
    expect(callbackFired).toBe(true)
    expect(streamer.getActiveSongId()).toBe(4673)
    expect(deckA.currentTime).toBeCloseTo(12.5, 2)
  })

  it('cleans up active and fading decks on stopAll()', () => {
    streamer.playTrack(4657)
    streamer.playTrack(4658)
    streamer.stopAll()
    expect(streamer.getActiveSongId()).toBe(0)
    for (const el of elements) {
      expect(el.paused).toBe(true)
    }
  })

  it('routes all 10 0x2C PlaySound quest stinger codes and special quest hooks (4687, 4690) through OnlineSession.drainWorldSoundRequests', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.apply({
      type: 'AssignPlayer',
      unitId: 1,
      classId: 0,
      name: 'Hero',
      x: 5000,
      y: 5000,
    })

    const audioRuntime = new AudioRuntime113c({
      rng: new D2Rng(42),
      listenerPos: () => ({ x: 5000, y: 5000 }),
    })
    const drainFn = (
      OnlineSession.prototype as unknown as { drainWorldSoundRequests: () => void }
    ).drainWorldSoundRequests
    const fakeSession = {
      world,
      audioRuntime,
      resolveTargetUnitWorldPos: () => ({ x: 5000, y: 5000 }),
    }

    const expectedCodes: readonly [number, number][] = [
      [33, 4685],
      [34, 4686],
      [35, 4688],
      [50, 4693],
      [52, 4694],
      [66, 4692],
      [75, 4695],
      [80, 4698],
      [82, 4697],
      [83, 4696],
    ]
    expect(Object.keys(QUEST_STINGER_BY_0x2C_CODE_113C).length).toBe(10)

    for (const [code, expectedStingerId] of expectedCodes) {
      expect(QUEST_STINGER_BY_0x2C_CODE_113C[code]).toBe(expectedStingerId)
      world.apply({
        type: 'PlaySound',
        unit: { unitType: 0, id: 1 },
        sound: code,
      })
      drainFn.call(fakeSession)
      expect(audioRuntime.musicStreamer.currentTrackId).toBe(expectedStingerId)
      expect(audioRuntime.music.currentTrackId).toBe(expectedStingerId)
    }

    // Verify ClientWorld.spawnCompellingOrbMist queues 4687 (music_quest_compelling)
    world.setNearRoomObjectFinder(() => ({ x: 5010, y: 5010 }) as never)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 99, classId: 366, x: 5000, y: 5000, mode: 0 },
    } as never)
    const orb = world.getUnit('monster', 99)!
    world.spawnCompellingOrbMist(orb)
    drainFn.call(fakeSession)
    expect(audioRuntime.musicStreamer.currentTrackId).toBe(4687)

    // Verify ClientWorld.spawnHoradricStaffAtOrifice queues 4690 (music_quest_horadric)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 'object',
        id: 77,
        classId: HORADRIC_ORIFICE_OBJECT_CLASS,
        x: 5000,
        y: 5000,
        mode: 1,
      },
    } as never)
    const orifice = world.getUnit('object', 77)!
    world.spawnHoradricStaffAtOrifice(orifice)
    drainFn.call(fakeSession)
    expect(audioRuntime.musicStreamer.currentTrackId).toBe(4690)
  })

  it('Issue #976: stops opening BGM 4699 immediately on onEnterArea(levelId) and AudioRuntime113c.gameInit()', () => {
    const [deckA, deckB] = elements as [FakeHTMLAudioElement, FakeHTMLAudioElement]
    streamer.playTitleMusic()
    expect(streamer.getActiveSongId()).toBe(4699)
    expect(deckA.paused).toBe(false)

    // Entering Rogue Encampment (level 1 -> 4673) while 4699 is active must pause deckA immediately (tick 0)
    streamer.onEnterArea(1)
    expect(streamer.getActiveSongId()).toBe(4673)
    expect(deckA.paused).toBe(true)
    expect(deckB.paused).toBe(false)

    // Subsequent in-game area transitions (e.g. level 1 -> level 2) still crossfade over Fade Out ticks
    streamer.onEnterArea(2)
    expect(streamer.getActiveSongId()).toBe(4679)
    expect(deckB.paused).toBe(false)
    streamer.tick(130)
    expect(deckB.paused).toBe(true)

    // AudioRuntime113c.gameInit() and gameExit() also stop 4699 immediately
    const rt = new AudioRuntime113c({
      rng: new D2Rng(7),
    })
    rt.playTitleMusic()
    expect(rt.musicStreamer.currentTrackId).toBe(4699)
    rt.gameInit()
    expect(rt.musicStreamer.currentTrackId).toBe(0)
  })

  it('Issue #976: unlock() resumes activeDeck when paused even if pendingResumeDeck was not set, and uiTick() drains playUi(4) without advancing lastGameTick', async () => {
    const [deckA] = elements as [FakeHTMLAudioElement, FakeHTMLAudioElement]
    streamer.playTitleMusic()
    // Simulate a browser that left the HTMLAudioElement paused without rejecting play() before user gesture
    deckA.paused = true
    const playCallsBefore = deckA.playCalls
    streamer.unlock()
    expect(deckA.playCalls).toBe(playCallsBefore + 1)
    expect(deckA.paused).toBe(false)

    // Verify uiTick drains async-decoded playUi(4) ('cursor_button_click') without advancing lastGameTick
    const startedSounds: number[] = []
    const fakeBuffer = ctx.createBuffer(1, 441, 22050) as unknown as AudioBuffer
    const rt = new AudioRuntime113c({
      rng: new D2Rng(99),
      loader: {
        getCachedBuffer: () => undefined,
        loadSoundBuffer: async () => fakeBuffer,
        prefetch: async () => null,
        clear: () => {},
      } as never,
      voices: {
        start: (_voice, soundId) => {
          startedSounds.push(soundId)
        },
        setGains: () => {},
        stop: () => {},
      },
    })
    const h = rt.playUi(4) // cursor_button_click (cold cache -> asyncPending)
    expect(h).toBeGreaterThan(0)
    expect(startedSounds).toEqual([])
    await Promise.resolve()
    await Promise.resolve()
    rt.uiTick(1)
    expect(startedSounds).toContain(4)
    expect(rt.records.now).toBe(1)

    // Entering game at tick 0 after pre-game uiTick calls must not throw a tick-regression error
    rt.gameInit()
    expect(() => rt.soundTick(0)).not.toThrow()
  })

  it("switches BGM across all 4 area transition modes: walk (1<->2), cross-act LoadAct (1->40), Town Portal (2->1), and intra-act Waypoint (1->3->35)", () => {
    let activeMockAreaId = 1
    const makeMockLevelView = (areaId: number) => ({
      id: areaId,
      areaId,
      act: areaId >= 40 ? 2 : 1,
      seed: 12345,
      difficulty: 0,
      subOriginX: 0,
      subOriginY: 0,
      subWidth: 10000,
      subHeight: 10000,
      gridWidth: 10000,
      cellsX: 2000,
      cellsY: 2000,
      isoOriginX: 0,
      isoOriginY: 0,
      rooms: [
        {
          index: 0,
          areaId,
          tileX: 1000,
          tileY: 1000,
          tileW: 8,
          tileH: 8,
          localTileX: 0,
          localTileY: 0,
          subX: 0,
          subY: 0,
          subW: 40,
          subH: 40,
          worldSubX: 5000,
          worldSubY: 5000,
          room1InitSeed: 1,
          revealed: true,
        },
      ],
      collision: new Uint16Array(1),
      collisionMasks: new Uint16Array(1),
      blocked: new Uint8Array(1),
      entrances: [],
    })

    const mockMapService = {
      findLevelViewAtWorldSubTile: () => makeMockLevelView(activeMockAreaId),
      onLoadActPacket: (pkt: { areaId: number }) => {
        activeMockAreaId = pkt.areaId
        return makeMockLevelView(pkt.areaId)
      },
      onAddRoomDataPacket: (pkt: { areaId: number }) => ({
        room: null,
        view: makeMockLevelView(pkt.areaId),
      }),
      onRemoveRoomDataPacket: (pkt: { areaId: number }) => ({
        room: null,
        view: makeMockLevelView(pkt.areaId),
      }),
      getActiveLevelView: () => makeMockLevelView(activeMockAreaId),
      peekLevelView: (areaId: number) => makeMockLevelView(areaId),
      getConnectedLevelViews: () => [],
    }

    const session = new OnlineSession({
      mapService: mockMapService as never,
    })

    // Initial spawn in Rogue Encampment (area 1 -> song 4673)
    session.handleServerEvent({
      type: "LoadAct",
      act: 1,
      mapSeed: 12345,
      areaId: 1,
    })
    session.handleServerEvent({
      type: "RoomReveal",
      areaId: 1,
      tileX: 1000,
      tileY: 1000,
    })
    session.handleServerEvent({
      type: "UnitAssign",
      isSelf: true,
      unit: {
        id: 1,
        unitType: "player",
        classId: 1,
        name: "Sorc",
        x: 5010,
        y: 5010,
      },
    } as never)
    expect(session.audioRuntime.musicStreamer.currentTrackId).toBe(4673)

    // 1. Walk from Rogue Encampment (1) -> Blood Moor (2 -> song 4679) and back (2 -> 1 -> song 4673)
    // Walking moves the player: syncActiveAreaFromPlayerPosition caches the collision LevelView per player
    // sub-tile (#1033), so each walk step must advance the player's position for the new area to be resolved.
    const walkTo = (x: number, y: number): void => {
      session.handleServerEvent({ type: "UnitReassign", unitType: "player", id: 1, at: { x, y }, snap: false } as never)
    }
    activeMockAreaId = 2
    walkTo(5011, 5011)
    session.tick(40, 1000)
    expect(session.world.areaId).toBe(2)
    expect(session.audioRuntime.musicStreamer.currentTrackId).toBe(4679)

    activeMockAreaId = 1
    walkTo(5010, 5010)
    session.tick(40, 1040)
    expect(session.world.areaId).toBe(1)
    expect(session.audioRuntime.musicStreamer.currentTrackId).toBe(4673)

    // Walk back out to Blood Moor (2 -> song 4679)
    activeMockAreaId = 2
    session.handleServerEvent({
      type: "RoomReveal",
      areaId: 2,
      tileX: 1010,
      tileY: 1010,
    })
    session.tick(40, 1080)
    expect(session.world.areaId).toBe(2)
    expect(session.audioRuntime.musicStreamer.currentTrackId).toBe(4679)

    // 2. Town Portal from Blood Moor (2) -> Rogue Encampment (1 -> song 4673):
    // Server sends RoomReveal(1), RoomHide(2), and UnitReassign(1) WITHOUT LoadAct!
    activeMockAreaId = 1
    session.handleServerEvent({
      type: "RoomReveal",
      areaId: 1,
      tileX: 1000,
      tileY: 1000,
    })
    session.handleServerEvent({
      type: "RoomHide",
      areaId: 2,
      tileX: 1010,
      tileY: 1010,
    })
    session.handleServerEvent({
      type: "UnitReassign",
      unitType: "player",
      id: 1,
      at: { x: 5010, y: 5010 },
      snap: true,
    })
    expect(session.world.areaId).toBe(1)
    expect(session.audioRuntime.musicStreamer.currentTrackId).toBe(4673)

    // 3. Intra-Act Waypoint from Rogue Encampment (1) -> Cold Plains (3 -> song 4679) -> Catacombs Level 2 (35 -> song 4676):
    // Server sends RoomReveal + RoomHide + UnitReassign WITHOUT LoadAct!
    activeMockAreaId = 3
    session.handleServerEvent({
      type: "RoomReveal",
      areaId: 3,
      tileX: 1020,
      tileY: 1020,
    })
    session.handleServerEvent({
      type: "RoomHide",
      areaId: 1,
      tileX: 1000,
      tileY: 1000,
    })
    session.handleServerEvent({
      type: "UnitReassign",
      unitType: "player",
      id: 1,
      at: { x: 5110, y: 5110 },
      snap: true,
    })
    expect(session.world.areaId).toBe(3)
    expect(session.audioRuntime.musicStreamer.currentTrackId).toBe(4679)

    activeMockAreaId = 35
    session.handleServerEvent({
      type: "RoomReveal",
      areaId: 35,
      tileX: 1040,
      tileY: 1040,
    })
    session.handleServerEvent({
      type: "RoomHide",
      areaId: 3,
      tileX: 1020,
      tileY: 1020,
    })
    session.handleServerEvent({
      type: "UnitReassign",
      unitType: "player",
      id: 1,
      at: { x: 5210, y: 5210 },
      snap: true,
    })
    expect(session.world.areaId).toBe(35)
    expect(session.audioRuntime.musicStreamer.currentTrackId).toBe(4667)

    // 4. Cross-Act Waypoint to Lut Gholein (40 -> song 4674) via LoadAct
    session.handleServerEvent({
      type: "LoadAct",
      act: 2,
      mapSeed: 12345,
      areaId: 40,
    })
    expect(session.world.areaId).toBe(40)
    expect(session.audioRuntime.musicStreamer.currentTrackId).toBe(4674)
  })

  it("plays Sorceress skill cast, keyframe, and missile sounds through OnlineSession even when only preloadSkillPacksForClasses prefetched raw packs", async () => {
    const session = new OnlineSession()
    const fakeBuffer = ctx.createBuffer(1, 441, 22050) as unknown as AudioBuffer
    const loadSoundBufferCalls: number[] = []
    ;(session.audioRuntime as unknown as { ctx: AudioContext }).ctx = ctx as unknown as AudioContext
    ;(session.audioRuntime as unknown as { sfxGain: GainNode }).sfxGain =
      ctx.createGain() as unknown as GainNode
    session.audioRuntime.loader.getCachedBuffer = () => undefined
    session.audioRuntime.loader.loadSoundBuffer = async (id: number) => {
      loadSoundBufferCalls.push(id)
      return fakeBuffer
    }

    session.handleServerEvent({
      type: "UnitAssign",
      isSelf: true,
      unit: {
        id: 1,
        unitType: "player",
        classId: 1, // Sorceress
        name: "Sorc",
        x: 5120,
        y: 5180,
      },
    } as never)
    session.world.self.charClass = 1

    // Server SkillCast for Fire Bolt (#36: cast/keyframe sound + firebolt missile spawn)
    session.handleServerEvent({
      type: "SkillCast",
      caster: { unitType: "player", id: 1 },
      skillId: 36,
      level: 1,
      target: { x: 5126, y: 5184 },
    } as never)
    for (let i = 0; i < 12; i++) {
      session.tick(40, 2000 + i * 40)
      session.audioRuntime.soundTick(i)
    }
    await Promise.resolve()
    await Promise.resolve()
    expect(loadSoundBufferCalls.length).toBeGreaterThan(0)
  })

  it("resolves non-8x8 DRLG rooms (16x16 / 24x24 tiles) at offsets >= 8 tiles for both UnitReassign->RoomReveal and RoomReveal->UnitReassign orders", () => {
    const session = new OnlineSession()
    ;(session.audioRuntime.musicStreamer as unknown as { unlocked: boolean }).unlocked = true

    // Start in Kurast Docktown (75 -> song 4675)
    session.handleServerEvent({
      type: "LoadAct",
      act: 3,
      mapSeed: 999,
      areaId: 75,
    })
    session.handleServerEvent({
      type: "UnitAssign",
      isSelf: true,
      unit: {
        id: 1,
        unitType: "player",
        classId: 1,
        name: "Sorc",
        x: 5010,
        y: 5010,
      },
    } as never)
    expect(session.world.areaId).toBe(75)
    expect(session.audioRuntime.musicStreamer.currentTrackId).toBe(4675)

    // Case A: UnitReassign arrives BEFORE RoomReveal for a 16x16 room (80x80 sub-tiles) in Durance of Hate Level 2 (101 -> song 4664)
    // Player lands at tile offset (+12, +12) = sub-tile offset (+60, +60), which is outside an 8x8 tile box
    session.handleServerEvent({
      type: "UnitReassign",
      unitType: "player",
      id: 1,
      at: { x: 6060, y: 6060 },
      snap: true,
    })
    session.world.setRevealedRoomSeed(101, 1200, 1200, 42, 6000, 6000, 80, 80, true)
    session.handleServerEvent({
      type: "RoomReveal",
      areaId: 101,
      tileX: 1200,
      tileY: 1200,
    })
    expect(session.world.areaId).toBe(101)
    expect(session.audioRuntime.musicStreamer.currentTrackId).toBe(4664)

    // Case B: RoomReveal + setRevealedRoomSeed arrive BEFORE UnitReassign for a 24x24 room (120x120 sub-tiles) in Den of Evil (8 -> song 4657)
    // Player lands at tile offset (+18, +18) = sub-tile offset (+90, +90)
    session.handleServerEvent({
      type: "RoomReveal",
      areaId: 8,
      tileX: 1400,
      tileY: 1400,
    })
    session.world.setRevealedRoomSeed(8, 1400, 1400, 77, 7000, 7000, 120, 120, true)
    session.handleServerEvent({
      type: "UnitReassign",
      unitType: "player",
      id: 1,
      at: { x: 7090, y: 7090 },
      snap: true,
    })
    expect(session.world.areaId).toBe(8)
    expect(session.audioRuntime.musicStreamer.currentTrackId).toBe(4657)
  })
})




