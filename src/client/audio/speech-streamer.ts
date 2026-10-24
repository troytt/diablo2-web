import {
  D9_UNSHIPPED_SOUND_IDS_SET_113C,
  SPEECH_INDEX_113C,
  SPEECH_NONE_WAV_IDS_113C,
  resolveSpeechEntry113c,
  type SpeechEntry113c,
} from '../../common/audio/speech-index-113c.ts';
import { SOUNDS_113C } from '../../common/audio/sounds-113c.ts';

export interface SpeechAudioElementLike {
  src: string;
  loop?: boolean;
  volume: number;
  currentTime: number;
  paused?: boolean;
  muted?: boolean;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener?(
    type: 'ended' | 'error',
    listener: () => void,
    options?: { once?: boolean },
  ): void;
  removeEventListener?(type: 'ended' | 'error', listener: () => void): void;
  onended?: ((ev: never) => unknown) | null;
  onerror?: ((ev: never) => unknown) | null;
}

export interface SpeechDuckableTarget {
  setSoloActive?(active: boolean): void;
  setSoloDuck?(active: boolean): void;
}

export interface SpeechStreamerOptions {
  readonly createAudioElement?: (url: string) => SpeechAudioElementLike;
  readonly records?: SpeechDuckableTarget | null;
  readonly soundRecords?: SpeechDuckableTarget | null;
  readonly musicStreamer?: SpeechDuckableTarget | null;
  readonly onDuckChange?: (active: boolean) => void;
  readonly onSoloChange?: (active: boolean) => void;
  readonly onUnavailable?: (soundId: number, reason: 'unshipped') => void;
  readonly masterVolume?: number;
  readonly speechVolume?: number;
  readonly getMasterVolume?: () => number;
  readonly isMuted?: () => boolean;
  readonly audioContext?: unknown;
  readonly rng?: () => number;
}

export interface SpeechPlayOptions {
  readonly volume?: number;
  readonly rng?: () => number;
}

const NONE_WAV_SET = new Set<number>(SPEECH_NONE_WAV_IDS_113C);

function defaultCreateAudioElement(url: string): SpeechAudioElementLike {
  if (typeof Audio === 'function') {
    const audio = new Audio(url);
    audio.preload = 'auto';
    return audio;
  }
  if (
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function'
  ) {
    const el = document.createElement('audio');
    el.src = url;
    el.preload = 'auto';
    return el;
  }
  let paused = true;
  const fallback: SpeechAudioElementLike = {
    src: url,
    loop: false,
    volume: 1,
    currentTime: 0,
    get paused() {
      return paused;
    },
    play() {
      paused = false;
      return Promise.resolve();
    },
    pause() {
      paused = true;
    },
    onended: null,
    onerror: null,
  };
  return fallback;
}

export class SpeechStreamer {
  private readonly createAudioElement: (url: string) => SpeechAudioElementLike;
  private records: SpeechDuckableTarget | null;
  private musicStreamer: SpeechDuckableTarget | null;
  private readonly onDuckChange?: (active: boolean) => void;
  private readonly onSoloChange?: (active: boolean) => void;
  private readonly onUnavailable?: (soundId: number, reason: 'unshipped') => void;
  private readonly getMasterVolume?: () => number;
  private readonly isMuted?: () => boolean;
  private readonly rng: () => number;
  private masterVolume: number;
  private speechVolume: number;

  private activeElement: SpeechAudioElementLike | null = null;
  private activeEntry: SpeechEntry113c | null = null;
  private activeCleanup: (() => void) | null = null;
  private duckActive = false;

  constructor(options: SpeechStreamerOptions = {}) {
    this.createAudioElement =
      options.createAudioElement ?? defaultCreateAudioElement;
    this.records = options.records ?? options.soundRecords ?? null;
    this.musicStreamer = options.musicStreamer ?? null;
    if (options.onDuckChange !== undefined) {
      this.onDuckChange = options.onDuckChange;
    }
    if (options.onSoloChange !== undefined) {
      this.onSoloChange = options.onSoloChange;
    }
    if (options.onUnavailable !== undefined) {
      this.onUnavailable = options.onUnavailable;
    }
    if (options.getMasterVolume !== undefined) {
      this.getMasterVolume = options.getMasterVolume;
    }
    if (options.isMuted !== undefined) {
      this.isMuted = options.isMuted;
    }
    this.rng = options.rng ?? (() => 0);
    this.masterVolume = Math.max(0, Math.min(255, options.masterVolume ?? 255));
    this.speechVolume = Math.max(0, Math.min(255, options.speechVolume ?? 255));
  }

  get activeSoundId(): number | null {
    return this.activeEntry ? this.activeEntry.id : null;
  }

  setRecords(records: SpeechDuckableTarget | null): void {
    this.records = records;
  }

  setMusicStreamer(musicStreamer: SpeechDuckableTarget | null): void {
    this.musicStreamer = musicStreamer;
  }

  setMasterVolume(vol255: number): void {
    this.masterVolume = Math.max(0, Math.min(255, vol255));
    this.refreshActiveVolume();
  }

  setSpeechVolume(vol255: number): void {
    this.speechVolume = Math.max(0, Math.min(255, vol255));
    this.refreshActiveVolume();
  }

  applySettings(): void {
    if (this.getMasterVolume !== undefined) {
      const v01 = Math.max(0, Math.min(1, this.getMasterVolume()));
      this.masterVolume = Math.round(v01 * 255);
    }
    this.refreshActiveVolume();
  }

  tick(_ticks = 1): void {
    // Ducking state is synchronous via SoundRecords113c.setSoloActive / MusicStreamer.setSoloDuck
  }

  isPlaying(): boolean {
    return this.activeElement !== null;
  }

  isDuckActive(): boolean {
    return this.duckActive;
  }

  getCurrentSoundId(): number {
    return this.activeEntry ? this.activeEntry.id : 0;
  }

  getCurrentUrl(): string | null {
    return this.activeEntry ? this.activeEntry.url : null;
  }

  getCurrentElement(): SpeechAudioElementLike | null {
    return this.activeElement;
  }

  private resolveTargetSpeechEntry(
    idOrName: number | string,
    rng: () => number,
  ): SpeechEntry113c | null {
    let baseEntry = resolveSpeechEntry113c(idOrName) ?? null;
    let baseId = baseEntry ? baseEntry.id : -1;

    if (!baseEntry) {
      if (typeof idOrName === 'number') {
        baseId = idOrName;
      } else {
        const trimmed = String(idOrName).trim().toLowerCase();
        const asNum = Number(trimmed);
        if (Number.isInteger(asNum) && asNum > 0) {
          baseId = asNum;
        } else {
          const found = SOUNDS_113C.find(
            (r) => r.sound.toLowerCase() === trimmed,
          );
          if (found) baseId = found.id;
        }
      }
    }

    if (baseId > 0 && D9_UNSHIPPED_SOUND_IDS_SET_113C.has(baseId)) {
      this.onUnavailable?.(baseId, 'unshipped');
      return null;
    }

    if (!baseEntry) {

      if (baseId > 0) {
        if (NONE_WAV_SET.has(baseId)) {
          return null;
        }
        const row = SOUNDS_113C[baseId];
        if (row && row.groupSize > 1) {
          const shippedMembers: SpeechEntry113c[] = [];
          for (let i = 0; i < row.groupSize; i++) {
            const member = SPEECH_INDEX_113C[baseId + i];
            if (member) shippedMembers.push(member);
          }
          if (shippedMembers.length > 0) {
            const pickIdx = Math.min(
              shippedMembers.length - 1,
              Math.max(0, Math.floor(rng() * shippedMembers.length)),
            );
            return shippedMembers[pickIdx]!;
          }
        }
      }
      return null;
    }

    const baseRow = SOUNDS_113C[baseEntry.id];
    const groupSize = baseRow ? baseRow.groupSize : 1;
    if (groupSize > 1) {
      const shippedMembers: SpeechEntry113c[] = [];
      for (let i = 0; i < groupSize; i++) {
        const member = SPEECH_INDEX_113C[baseEntry.id + i];
        if (member) shippedMembers.push(member);
      }
      if (shippedMembers.length > 1) {
        const pickIdx = Math.min(
          shippedMembers.length - 1,
          Math.max(0, Math.floor(rng() * shippedMembers.length)),
        );
        baseEntry = shippedMembers[pickIdx]!;
      }
    }

    return baseEntry;
  }

  play(idOrName: number | string, options: SpeechPlayOptions = {}): boolean {
    const entry = this.resolveTargetSpeechEntry(
      idOrName,
      options.rng ?? this.rng,
    );
    if (!entry) {
      return false;
    }

    // Stop any currently playing speech stream before starting the new line
    this.stopInternal(false);

    const elem = this.createAudioElement(entry.url);
    elem.src = entry.url;
    elem.loop = false;
    elem.currentTime = 0;

    const soundRow = SOUNDS_113C[entry.id];
    const rowVol = options.volume ?? soundRow?.volume ?? 255;
    const muted = this.isMuted?.() ?? false;
    if (elem.muted !== undefined) {
      elem.muted = muted;
    }
    const masterGain =
      this.getMasterVolume !== undefined
        ? Math.max(0, Math.min(1, this.getMasterVolume()))
        : this.masterVolume / 255;
    elem.volume = muted
      ? 0
      : Math.max(
          0,
          Math.min(1, (rowVol / 255) * masterGain * (this.speechVolume / 255)),
        );

    const handleEndedOrError = (): void => {
      if (this.activeElement === elem) {
        this.stopInternal(true);
      }
    };

    if (typeof elem.addEventListener === 'function') {
      elem.addEventListener('ended', handleEndedOrError, { once: true });
      elem.addEventListener('error', handleEndedOrError, { once: true });
      this.activeCleanup = () => {
        elem.removeEventListener?.('ended', handleEndedOrError);
        elem.removeEventListener?.('error', handleEndedOrError);
      };
    } else {
      elem.onended = handleEndedOrError;
      elem.onerror = handleEndedOrError;
      this.activeCleanup = () => {
        elem.onended = null;
        elem.onerror = null;
      };
    }

    this.activeElement = elem;
    this.activeEntry = entry;

    if (entry.solo) {
      this.applyDuck(true);
    } else {
      this.applyDuck(false);
    }

    try {
      const playRes = elem.play();
      if (playRes && typeof playRes.catch === 'function') {
        playRes.catch(() => {
          if (this.activeElement === elem) {
            this.stopInternal(true);
          }
        });
      }
    } catch {
      if (this.activeElement === elem) {
        this.stopInternal(true);
      }
      return false;
    }

    return true;
  }

  playSpeech(idOrName: number | string, options?: SpeechPlayOptions): boolean {
    return this.play(idOrName, options);
  }

  openDialog(idOrName: number | string, options?: SpeechPlayOptions): boolean {
    return this.play(idOrName, options);
  }

  start(idOrName: number | string, options?: SpeechPlayOptions): boolean {
    return this.play(idOrName, options);
  }

  stop(): void {
    this.stopInternal(true);
  }

  stopSpeech(): void {
    this.stopInternal(true);
  }

  cancel(): void {
    this.stopInternal(true);
  }

  closeDialog(): void {
    this.stopInternal(true);
  }

  onDialogClose(): void {
    this.stopInternal(true);
  }

  onNpcDialogClose(): void {
    this.stopInternal(true);
  }

  onEscCancel(): void {
    this.stopInternal(true);
  }

  private stopInternal(restoreDuck: boolean): void {
    const prevElem = this.activeElement;
    const prevCleanup = this.activeCleanup;
    this.activeElement = null;
    this.activeEntry = null;
    this.activeCleanup = null;

    if (prevCleanup) {
      try {
        prevCleanup();
      } catch {
        // ignore listener cleanup errors
      }
    }

    if (prevElem) {
      try {
        prevElem.pause();
        prevElem.currentTime = 0;
      } catch {
        // ignore element pause errors
      }
    }

    if (restoreDuck) {
      this.applyDuck(false);
    }
  }

  private applyDuck(active: boolean): void {
    this.duckActive = active;
    if (this.records) {
      if (typeof this.records.setSoloActive === 'function') {
        this.records.setSoloActive(active);
      } else if (typeof this.records.setSoloDuck === 'function') {
        this.records.setSoloDuck(active);
      }
    }
    if (this.musicStreamer) {
      if (typeof this.musicStreamer.setSoloDuck === 'function') {
        this.musicStreamer.setSoloDuck(active);
      } else if (typeof this.musicStreamer.setSoloActive === 'function') {
        this.musicStreamer.setSoloActive(active);
      }
    }
    this.onDuckChange?.(active);
    this.onSoloChange?.(active);
  }

  private refreshActiveVolume(): void {
    if (!this.activeElement || !this.activeEntry) return;
    const soundRow = SOUNDS_113C[this.activeEntry.id];
    const rowVol = soundRow?.volume ?? 255;
    const muted = this.isMuted?.() ?? false;
    if (this.activeElement.muted !== undefined) {
      this.activeElement.muted = muted;
    }
    const masterGain =
      this.getMasterVolume !== undefined
        ? Math.max(0, Math.min(1, this.getMasterVolume()))
        : this.masterVolume / 255;
    this.activeElement.volume = muted
      ? 0
      : Math.max(
          0,
          Math.min(1, (rowVol / 255) * masterGain * (this.speechVolume / 255)),
        );
  }
}
