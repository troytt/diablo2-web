import { describe, expect, it, vi } from 'vitest'
import {
  AREA_SPEECH_PLAYER_SPAWN_DELAY_TICKS_113C,
  AREA_SPEECH_ROOM_DELAY_TICKS_113C,
  AREA_SPEECH_TABLE_0x6FBA76B0,
  AreaEntrySpeechController113c,
  PLAYER_SOUND_TABLE_0x6FBA7694,
  isAreaSpeechQuestActive113c,
} from '../../src/client/audio/d2gs-play-sound-113c.ts'
import { AudioRuntime113c } from '../../src/client/audio/audio-runtime-113c.ts'
import { questLogRowIndex } from '../../src/client/world/quest-log-state.ts'

describe('1.13c Area-Entry Class Monologues (0x6fad3e20, Issue #1746)', () => {
  it('matches all 14 entries of D2Client.dll .data:0x6fba76b0..0x6fba7920', () => {
    expect(AREA_SPEECH_ROOM_DELAY_TICKS_113C).toBe(62)
    expect(AREA_SPEECH_PLAYER_SPAWN_DELAY_TICKS_113C).toBe(62)
    expect(AREA_SPEECH_TABLE_0x6FBA76B0).toEqual([
      { levels: [17], questId: 2, voiceSlot: 38 },
      { levels: [34, 35, 36, 37], questId: 6, voiceSlot: 40 },
      { levels: [8], questId: 1, voiceSlot: 41 },
      { levels: [29, 30, 31], questId: 6, voiceSlot: 42 },
      { levels: [26, 27], questId: 3, voiceSlot: 43 },
      { levels: [20, 21, 22, 23, 24, 25], questId: 5, voiceSlot: 44 },
      { levels: [38], questId: 6, voiceSlot: 46 },
      { levels: [2, 3, 4, 5, 6, 7], questId: 1, voiceSlot: 47 },
      { levels: [74], questId: 12, voiceSlot: 55 },
      { levels: [58], questId: 13, voiceSlot: 56 },
      { levels: [110], questId: 31, voiceSlot: 76 },
      { levels: [120], questId: 35, voiceSlot: 78 },
      { levels: [121], questId: 34, voiceSlot: 77 },
      { levels: [132], questId: 36, voiceSlot: 79 },
    ])
  })

  it('0x6faf58aa..0x6faf58de + 0x6fad3e20: waits 62 ticks in the room and marks all group levels visited', () => {
    const played: number[] = []
    const ctl = new AreaEntrySpeechController113c({
      getContext: () => ({ charClass: 0, unitId: 1 }),
      onPlaySpeech: (req) => {
        if (req.speechSoundId !== undefined) played.push(req.speechSoundId)
      },
    })

    // Enter Catacombs Level 1 (34) at tick 100 (> 62 ticks after spawn tick 0).
    ctl.enterLevel(34, 100)
    expect(ctl.tick(161)).toBeNull()
    expect(played).toEqual([])

    // At tick 162 (162 - 100 == 62), slot 40 fires for Amazon (questBase 2961 + (40 - 33) = 2968).
    const res = ctl.tick(162)
    expect(res?.speechSoundId).toBe(PLAYER_SOUND_TABLE_0x6FBA7694[0]!.questBase + (40 - 33))
    expect(played).toEqual([2968])

    // All levels in the Catacombs entry (34, 35, 36, 37) are now flagged in [0x6fbca7e8 + 4*lvl].
    for (const lvl of [34, 35, 36, 37]) {
      expect(ctl.isLevelVisited(lvl)).toBe(true)
    }
    ctl.enterLevel(35, 200)
    expect(ctl.tick(270)).toBeNull()
    expect(played).toHaveLength(1)
  })

  it('0x6fad3eff: requires strict (now - playerSpawnTick) > 62 and 0x6fb37b30 == 0', () => {
    const ctl = new AreaEntrySpeechController113c({
      getContext: () => ({ charClass: 1, unitId: 1 }),
    })
    ctl.setPlayerSpawnTick(0)
    ctl.enterLevel(8, 0) // Den of Evil at tick 0
    // At tick 62, room delay is 62 (>= 62), but (62 - 0) <= 62 so 0x6fad3eff suppresses playback.
    expect(ctl.tick(62)).toBeNull()
    expect(ctl.isLevelVisited(8)).toBe(true)

    // When speech is already active (0x6fb37b30 != 0), 0x6fad3e20 suppresses the monologue.
    const ctlBusy = new AreaEntrySpeechController113c({
      getContext: () => ({ charClass: 1, unitId: 1 }),
      isSpeechPlaying: () => true,
    })
    ctlBusy.enterLevel(17, 10)
    expect(ctlBusy.tick(72)).toBeNull()
    expect(ctlBusy.isLevelVisited(17)).toBe(true)
  })

  it('0x6facd740: checks 0x5E availability, game quest bit 13, player quest bits 0/1/14, and Den status < 5', () => {
    const row1 = questLogRowIndex(1)
    const row2 = questLogRowIndex(2)
    expect(row1).toBe(1)
    expect(row2).toBe(2)

    expect(isAreaSpeechQuestActive113c(2, {})).toBe(true)

    const avail = new Uint8Array(37).fill(1)
    avail[2] = 0
    expect(isAreaSpeechQuestActive113c(2, { questAvailability: avail })).toBe(false)

    const gameWords = new Uint16Array(48)
    gameWords[row2] = 0x2000
    expect(isAreaSpeechQuestActive113c(2, { gameWords })).toBe(false)

    for (const bit of [0x0001, 0x0002, 0x4000]) {
      const playerWords = new Uint16Array(48)
      playerWords[row2] = bit
      expect(isAreaSpeechQuestActive113c(2, { playerWords })).toBe(false)
    }

    const statusBytes = new Uint8Array(41)
    statusBytes[row1] = 4
    expect(isAreaSpeechQuestActive113c(1, { statusBytes })).toBe(true)
    statusBytes[row1] = 5
    expect(isAreaSpeechQuestActive113c(1, { statusBytes })).toBe(false)
  })

  it('AudioRuntime113c.enterLevel + soundTick triggers area-entry speech after 62 ticks', () => {
    const runtime = new AudioRuntime113c({
      areaSpeechContext: () => ({ charClass: 2, unitId: 1 }), // Necromancer
    })
    const spy = vi.spyOn(runtime, 'playSpeech').mockReturnValue(true)

    runtime.soundTick(100)
    runtime.enterLevel(74) // Arcane Sanctuary -> slot 55
    runtime.soundTick(161)
    expect(spy).not.toHaveBeenCalled()

    runtime.soundTick(162)
    expect(spy).toHaveBeenCalledWith(
      PLAYER_SOUND_TABLE_0x6FBA7694[2]!.questBase + (55 - 33),
      expect.objectContaining({
        unit: { id: 1, unitType: 'player' },
      }),
    )
  })
})
