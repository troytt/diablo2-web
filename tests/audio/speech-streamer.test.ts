import { describe, expect, it, vi } from 'vitest';
import { SpeechStreamer } from '../../src/client/audio/speech-streamer.ts';
import { D9_UNSHIPPED_SOUND_IDS_SET_113C } from '../../src/common/audio/speech-index-113c.ts';
import { SOUNDS_113C } from '../../src/common/audio/sounds-113c.ts';

describe('SpeechStreamer', () => {
  it('should explicitly return early and not fetch nor soloDuck on D9 unshipped IDs', () => {
    let duckChangeCount = 0;
    let onUnavailableCount = 0;
    const records = {
      setSoloDuck(active: boolean) {
        duckChangeCount++;
      }
    };
    const streamer = new SpeechStreamer({
      records,
      onUnavailable: (id, reason) => {
        onUnavailableCount++;
      }
    });

    const d9Id = Array.from(D9_UNSHIPPED_SOUND_IDS_SET_113C)[0];
    expect(d9Id).toBeDefined();
    expect(d9Id).toBeGreaterThan(0);

    const result = streamer.playSpeech(d9Id!);
    expect(result).toBe(false);
    expect(duckChangeCount).toBe(0);
    expect(onUnavailableCount).toBe(1);
  });
});
