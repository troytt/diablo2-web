import { describe, expect, it } from 'vitest';
import { D9_UNSHIPPED_SOUND_IDS_113C } from '../../src/common/audio/speech-index-113c.ts';
import { D2Rng } from '../../src/common/rng/d2-rng.ts';
import { AudioRuntime113c } from '../../src/client/audio/audio-runtime-113c.ts';
import { SoundRecords113c } from '../../src/client/audio/sound-records-113c.ts';
import {
  SpeechStreamer,
  type SpeechAudioElementLike,
} from '../../src/client/audio/speech-streamer.ts';

describe('SpeechStreamer 1.13c parity (#1747 / D2SOUND-2)', () => {
  it('should explicitly return early and not fetch nor soloDuck on D9 unshipped IDs', () => {
    const unavailableCalls: Array<{ id: number; reason: string }> = [];
    let soloDuckState = false;
    const mockRecords = {
      setSoloDuck(active: boolean | number) {
        soloDuckState = typeof active === 'boolean' ? active : active < 100;
      },
    };

    const createdUrls: string[] = [];
    const streamer = new SpeechStreamer({
      records: mockRecords,
      onUnavailable: (id, reason) => unavailableCalls.push({ id, reason }),
      createAudioElement: (url: string): SpeechAudioElementLike => {
        createdUrls.push(url);
        return {
          src: url,
          volume: 1,
          currentTime: 0,
          play: () => Promise.resolve(),
          pause: () => {},
        };
      },
    });

    for (const unshippedId of D9_UNSHIPPED_SOUND_IDS_113C) {
      const ok = streamer.play(unshippedId);
      expect(ok).toBe(false);
    }

    expect(createdUrls.length).toBe(0);
    expect(soloDuckState).toBe(false);
    expect(unavailableCalls.length).toBe(D9_UNSHIPPED_SOUND_IDS_113C.length);
  });

  it('Defers (0x6fb3929e) when Defer Inst = 1, Stop Inst = 0 conflicts, and stops (0x6fb3926d) when Stop Inst = 1', () => {
    const elements: Array<{ src: string; paused: boolean }> = [];
    const streamer = new SpeechStreamer({
      createAudioElement: (url: string): SpeechAudioElementLike => {
        const state = { src: url, paused: true };
        elements.push(state);
        return {
          get src() {
            return state.src;
          },
          set src(v: string) {
            state.src = v;
          },
          get paused() {
            return state.paused;
          },
          volume: 1,
          currentTime: 0,
          play() {
            state.paused = false;
            return Promise.resolve();
          },
          pause() {
            state.paused = true;
          },
        };
      },
    });

    // 2934 (`amazon_cantcarry_1`) and 2935 (`amazon_cantcarry_2`) share groupBase = 2934 with Defer Inst = 1, Stop Inst = 0.
    expect(streamer.play(2934)).toBe(true);
    expect(elements.length).toBe(1);
    expect(elements[0]!.paused).toBe(false);

    // Requesting another speech in the same Defer Inst = 1 group while playing is dropped (0x6fb3929e).
    expect(streamer.play(2935)).toBe(false);
    expect(elements.length).toBe(1);
    expect(elements[0]!.paused).toBe(false);

    // Same-unit speech conflict (FindSpeechConflict 0x6fb37bd0): different group on the same unit with Defer Inst = 1 is also dropped.
    streamer.stop();
    const unit = { unitType: 'player' as const, id: 1, isLocalPlayer: true };
    expect(streamer.play(2934, { unit })).toBe(true);
    expect(streamer.play(2937, { unit })).toBe(false);
    expect(elements.length).toBe(2);
    expect(elements[1]!.paused).toBe(false);

    // Stop Inst = 1 rows (e.g. 3499 `akara_act1_intro` and 3488 `akara_act1_gossip_1`) stop the active speech and start the new line (0x6fb3926d).
    expect(streamer.play(3499)).toBe(true);
    expect(elements[1]!.paused).toBe(true);
    expect(elements[2]!.paused).toBe(false);
    expect(streamer.play(3488)).toBe(true);
    expect(elements[2]!.paused).toBe(true);
    expect(elements[3]!.paused).toBe(false);
  });

  it('runs 1.13c pickVariant (0x6fb0ee70) with 2-slot recent history (+0x64 / +0x68) on Group Size > 1 speech groups', () => {
    const rng = new D2Rng(0x12345678, 0x9abcdef0);
    const records = SoundRecords113c.fromSounds113c({ rng });
    const pickedIds: number[] = [];
    const streamer = new SpeechStreamer({
      records,
      rng,
      createAudioElement: (url: string): SpeechAudioElementLike => ({
        src: url,
        volume: 1,
        currentTime: 0,
        play: () => Promise.resolve(),
        pause: () => {},
      }),
    });

    // 4290 (`rogue_confirm_a_1`) has Group Size = 4 (4290..4293), where avoid = min(4 - 1, 2) = 2 (no 3-in-a-row or 2-in-a-row repeats).
    for (let i = 0; i < 12; i += 1) {
      expect(streamer.play(4290)).toBe(true);
      const activeId = streamer.getCurrentSoundId();
      expect(activeId).toBeGreaterThanOrEqual(4290);
      expect(activeId).toBeLessThanOrEqual(4293);
      if (pickedIds.length >= 1) {
        expect(activeId).not.toBe(pickedIds[pickedIds.length - 1]);
      }
      if (pickedIds.length >= 2) {
        expect(activeId).not.toBe(pickedIds[pickedIds.length - 2]);
      }
      pickedIds.push(activeId);
      streamer.stop();
    }
    expect(new Set(pickedIds).size).toBeGreaterThan(1);
    expect(records.recentOf(4290)).toEqual([
      pickedIds[pickedIds.length - 1]!,
      pickedIds[pickedIds.length - 2]!,
    ]);
  });

  it('computes unit-relative position (0x6fb37f30 -> #10047 0x6f9b8b50), updates every tick when Tracking = 1, and enforces Falloff maxDist', () => {
    let npcPos = { x: 105, y: 100 };
    const listenerPos = () => ({ x: 100, y: 100 });
    const streamer = new SpeechStreamer({
      listenerPos,
      createAudioElement: (url: string): SpeechAudioElementLike => ({
        src: url,
        volume: 1,
        currentTime: 0,
        play: () => Promise.resolve(),
        pause: () => {},
      }),
    });

    const npcUnit = {
      unitType: 'monster' as const,
      id: 42,
      isLocalPlayer: false,
      getPos: () => npcPos,
    };

    // Play positioned speech line (3499 `akara_act1_intro`, Tracking = 1, Stereo = 0, Falloff = 4)
    expect(streamer.play(3499, { unit: npcUnit, local: false })).toBe(true);
    const pos0 = streamer.getActivePosition();
    const out0 = streamer.getActiveChannelOutput()!;
    expect(pos0.z).toBe(640);
    expect(pos0.x).toBeGreaterThan(0);
    expect(out0.pan).toBeGreaterThan(128);
    expect(out0.att).toBeLessThan(255);

    // Move NPC further away; Tracking = 1 updates position & attenuation on tick()
    npcPos = { x: 120, y: 100 };
    streamer.tick(1);
    const out1 = streamer.getActiveChannelOutput()!;
    expect(out1.att).toBeLessThan(out0.att);

    // Move NPC beyond Falloff = 4 maxDist (1500); tick() stops the stream (0x6fb39382)
    npcPos = { x: 300, y: 100 };
    streamer.tick(1);
    expect(streamer.isPlaying()).toBe(false);
  });

  it('ramps Solo = 1 ducking [0x6fb91378] at ±2 per tick (100 -> 70 in 15 ticks, 70 -> 100 in 15 ticks, 0x6fb39449..0x6fb3957e)', () => {
    const rt = new AudioRuntime113c({
      rng: new D2Rng(0x777),
    });
    // Advance past initial clock=0 so SoundRecords113c.update() sees (now >>> 0) > (lastDuckNow >>> 0)
    rt.soundTick(0);

    // 3499 (`akara_act1_intro`) has Solo = 1
    expect(rt.playSound(3499)).toBe(1);
    expect(rt.records.soloDuck).toBe(100);
    expect(rt.speech.soloDuck).toBe(100);

    const downSteps: number[] = [];
    for (let t = 1; t <= 16; t += 1) {
      rt.soundTick(t);
      downSteps.push(rt.records.soloDuck);
    }
    expect(downSteps.slice(0, 15)).toEqual([
      98, 96, 94, 92, 90, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70,
    ]);
    expect(downSteps[15]).toBe(70);
    expect(rt.music.soloDuck).toBe(70);

    rt.stopSpeech();
    const upSteps: number[] = [];
    for (let t = 17; t <= 32; t += 1) {
      rt.soundTick(t);
      upSteps.push(rt.records.soloDuck);
    }
    expect(upSteps.slice(0, 15)).toEqual([
      72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100,
    ]);
    expect(upSteps[15]).toBe(100);
    expect(rt.music.soloDuck).toBe(100);
  });
});
