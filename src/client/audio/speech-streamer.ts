import {
  D9_UNSHIPPED_SOUND_IDS_SET_113C,
  SPEECH_INDEX_113C,
  SPEECH_NONE_WAV_IDS_113C,
  resolveSpeechEntry113c,
  type SpeechEntry113c,
} from '../../common/audio/speech-index-113c.ts';
import { SOUNDS_113C } from '../../common/audio/sounds-113c.ts';
import { D2Rng } from '../../common/rng/d2-rng.ts';
import {
  FALLOFF_MAX_DIST,
  FALLOFF_MAX_DIST_DEFAULT,
  FALLOFF_MIN_DIST,
  FALLOFF_MIN_DIST_DEFAULT,
  channelOutput113c,
  unitSoundPosition113c,
  type ChannelOutput113c,
  type SoundUnitRef113c,
} from './sound-records-113c.ts';

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
  setExternalSoloActive?(active: boolean): void;
  setSoloActive?(active: boolean): void;
  setSoloDuck?(active: boolean | number): void;
  recentOf?(id: number): [number, number];
  getListenerPosition?(): { x: number; y: number };
  readonly pauseDuck?: number;
  readonly soloDuck?: number;
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
  readonly listenerPos?: (() => { readonly x: number; readonly y: number }) | undefined;
  readonly audioContext?: unknown;
  readonly rng?: D2Rng | (() => number);
}

export interface SpeechPlayOptions {
  readonly volume?: number | undefined;
  readonly rng?: D2Rng | (() => number) | undefined;
  readonly unit?: SoundUnitRef113c | null | undefined;
  readonly x?: number | undefined;
  readonly y?: number | undefined;
  readonly local?: boolean | undefined;
  readonly isLocalPlayer?: boolean | undefined;
  readonly listenerPos?: { readonly x: number; readonly y: number } | undefined;
  readonly delayTicks?: number | undefined;
  readonly a2?: number | undefined;
  readonly forceStop?: boolean | undefined;
}

const NONE_WAV_SET = new Set<number>(SPEECH_NONE_WAV_IDS_113C);
const NO_UNIT_Z_113C = 320;
const SOUND_POS_Z_113C = 640;
const DIST_CLAMP_113C = 2000;

function falloffMaxDist113c(falloff: number): number {
  return FALLOFF_MAX_DIST[falloff] ?? FALLOFF_MAX_DIST_DEFAULT;
}

function falloffMinDist113c(falloff: number): number {
  return FALLOFF_MIN_DIST[falloff] ?? FALLOFF_MIN_DIST_DEFAULT;
}

function normalizeUnitType(t: SoundUnitRef113c['unitType']): string {
  if (typeof t === 'number') {
    const names = ['player', 'monster', 'object', 'missile', 'item', 'tile'];
    return names[t] ?? `type${String(t)}`;
  }
  return t ?? '';
}

function sameUnit113c(a: SoundUnitRef113c, b: SoundUnitRef113c): boolean {
  return (
    a === b ||
    (a.id === b.id &&
      normalizeUnitType(a.unitType) === normalizeUnitType(b.unitType))
  );
}

function unitPresent113c(u: SoundUnitRef113c): boolean {
  return u.alive !== false && (u.getPos === undefined || u.getPos() !== null);
}

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
  private readonly listenerPosOf?: () => { readonly x: number; readonly y: number };
  private readonly defaultRng: D2Rng | (() => number);
  private readonly recent = new Map<number, [number, number]>();
  private masterVolume: number;
  private speechVolume: number;

  private activeElement: SpeechAudioElementLike | null = null;
  private activeEntry: SpeechEntry113c | null = null;
  private activeCleanup: (() => void) | null = null;
  private activeUnit: SoundUnitRef113c | null = null;
  private activeLocal = true;
  private activeVol255 = 255;
  private activePosition: { x: number; y: number; z: number } = {
    x: 0,
    y: 0,
    z: NO_UNIT_Z_113C,
  };
  private activeChannelOutput: ChannelOutput113c | null = null;
  private duckActive = false;
  /** `[0x6fb91378]` Solo duck percentage (`70..100`), stepping ±2 per tick (`0x6fb39449..0x6fb3957e`). */
  private soloDuckPercent = 100;

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
    if (options.listenerPos !== undefined) {
      this.listenerPosOf = options.listenerPos;
    }
    this.defaultRng = options.rng ?? new D2Rng(0x6fb0e8e1, 0x00000113);
    this.masterVolume = Math.max(0, Math.min(255, options.masterVolume ?? 255));
    this.speechVolume = Math.max(0, Math.min(255, options.speechVolume ?? 255));
  }

  get activeSoundId(): number | null {
    return this.activeEntry ? this.activeEntry.id : null;
  }

  get soloDuck(): number {
    return this.soloDuckPercent;
  }

  getSoloDuck(): number {
    return this.soloDuckPercent;
  }

  getActivePosition(): { readonly x: number; readonly y: number; readonly z: number } {
    return { ...this.activePosition };
  }

  getActiveChannelOutput(): ChannelOutput113c | null {
    return this.activeChannelOutput;
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

  /**
   * 25 Hz SoundUpdate tick (`0x6fb39070`):
   * - Updates unit-tracked speech position (`Tracking = 1`, `0x6fb3909b..0x6fb390c4`) and stops if beyond `Falloff` maxDist (`0x6fb39382`).
   * - Steps `[0x6fb91378]` Solo duck ramp by ±2 per tick (`100 -> 70` while `Solo = 1` is active, `70 -> 100` when inactive, `0x6fb39449..0x6fb3957e`).
   */
  tick(ticks = 1): void {
    const count =
      Number.isFinite(ticks) && ticks > 0 ? Math.max(1, Math.round(ticks)) : 1;
    for (let i = 0; i < count; i += 1) {
      if (this.activeElement !== null && this.activeEntry !== null) {
        const row = SOUNDS_113C[this.activeEntry.id];
        if (
          row !== undefined &&
          row.tracking &&
          this.activeUnit !== null &&
          !this.activeLocal
        ) {
          if (unitPresent113c(this.activeUnit)) {
            const uPos = this.resolveUnitPos(this.activeUnit);
            if (uPos !== null) {
              const listener = this.resolveListenerPos();
              this.activePosition = unitSoundPosition113c(
                uPos,
                listener,
                this.activeEntry.id,
              );
            }
          }
          const maxDist = falloffMaxDist113c(row.falloff);
          const cx = Math.max(
            -DIST_CLAMP_113C,
            Math.min(DIST_CLAMP_113C, this.activePosition.x),
          );
          const cy = Math.max(
            -DIST_CLAMP_113C,
            Math.min(DIST_CLAMP_113C, this.activePosition.y),
          );
          const dist2 = Math.fround(cx * cx + cy * cy);
          if (dist2 > Math.fround(maxDist * maxDist)) {
            this.stopInternal(true);
          } else {
            this.refreshActiveVolume();
          }
        }
      }

      // 0x6fb39449..0x6fb3957e: ±2 per tick between 100 and 70
      const prevDuck = this.soloDuckPercent;
      this.soloDuckPercent = this.duckActive
        ? Math.max(70, this.soloDuckPercent - 2)
        : Math.min(100, this.soloDuckPercent + 2);
      if (this.soloDuckPercent !== prevDuck) {
        if (this.musicStreamer && typeof this.musicStreamer.setSoloDuck === 'function') {
          this.musicStreamer.setSoloDuck(this.soloDuckPercent);
        }
      }
    }
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

  recentOf(id: number): [number, number] {
    if (this.records && typeof this.records.recentOf === 'function') {
      return this.records.recentOf(id);
    }
    let rec = this.recent.get(id);
    if (rec === undefined) {
      rec = [0, 0];
      this.recent.set(id, rec);
    }
    return rec;
  }

  private randInt(rng: D2Rng | (() => number), n: number): number {
    if (n <= 1) return 0;
    if (typeof rng === 'function') {
      const f = rng();
      if (!Number.isFinite(f)) return 0;
      if (f >= 1 && Number.isInteger(f)) {
        return ((f >>> 0) % (n >>> 0)) >>> 0;
      }
      return Math.min(n - 1, Math.max(0, Math.floor(f * n)));
    }
    return rng.rand(n);
  }

  /**
   * 1.13c `pickVariant` (`0x6fb0ee70`):
   * - `avoid = min(g - 1, 2)`
   * - `if (g <= 3 && rand(g + 1) == 0) avoid -= 1`
   * - Rejection-samples `baseId + rand(g)` against `recent.slice(0, avoid)`.
   */
  private pickVariant113c(
    baseId: number,
    groupSize: number,
    rng: D2Rng | (() => number),
  ): number {
    if (groupSize <= 1) return baseId;
    let avoid = Math.min(groupSize - 1, 2);
    if (groupSize <= 3 && this.randInt(rng, groupSize + 1) === 0) {
      avoid -= 1;
    }
    const recent = this.recentOf(baseId);
    let pick = baseId;
    let guard = 0;
    do {
      pick = baseId + this.randInt(rng, groupSize);
      guard += 1;
    } while (guard < 64 && recent.slice(0, avoid).includes(pick));
    return pick;
  }

  private resolveRequestedSoundId(idOrName: number | string): number {
    if (typeof idOrName === 'number') {
      return Number.isInteger(idOrName) ? idOrName : -1;
    }
    const trimmed = String(idOrName).trim().toLowerCase();
    if (!trimmed) return -1;
    const asNum = Number(trimmed);
    if (Number.isInteger(asNum) && asNum > 0) {
      return asNum;
    }
    const entry = resolveSpeechEntry113c(trimmed);
    if (entry) return entry.id;
    const found = SOUNDS_113C.find((r) => r.sound.toLowerCase() === trimmed);
    return found ? found.id : -1;
  }

  private resolveListenerPos(
    override?: { readonly x: number; readonly y: number },
  ): { x: number; y: number } {
    if (override !== undefined) {
      return { x: override.x, y: override.y };
    }
    if (this.listenerPosOf !== undefined) {
      const p = this.listenerPosOf();
      return { x: p.x, y: p.y };
    }
    if (this.records && typeof this.records.getListenerPosition === 'function') {
      return this.records.getListenerPosition();
    }
    return { x: 0, y: 0 };
  }

  private resolveUnitPos(
    unit: SoundUnitRef113c,
  ): { x: number; y: number } | null {
    if (unit.getPos !== undefined) {
      return unit.getPos();
    }
    if (
      unit.x !== undefined &&
      unit.y !== undefined &&
      Number.isFinite(unit.x) &&
      Number.isFinite(unit.y)
    ) {
      return { x: unit.x, y: unit.y };
    }
    return null;
  }

  play(idOrName: number | string, options: SpeechPlayOptions = {}): boolean {
    const requestedId = this.resolveRequestedSoundId(idOrName);
    if (requestedId <= 0 || requestedId >= SOUNDS_113C.length) {
      return false;
    }

    if (D9_UNSHIPPED_SOUND_IDS_SET_113C.has(requestedId)) {
      this.onUnavailable?.(requestedId, 'unshipped');
      return false;
    }
    if (NONE_WAV_SET.has(requestedId)) {
      return false;
    }

    const reqRow = SOUNDS_113C[requestedId];
    if (!reqRow || reqRow.volume === 0) {
      return false;
    }

    // 1.13c Positioning & MaxDist check (0x6fb38b26..0x6fb38b65, 0x6fb39136..0x6fb39174)
    const unit = options.unit ?? null;
    const isLocal = Boolean(
      options.local ?? options.isLocalPlayer ?? unit?.isLocalPlayer ?? (unit === null && options.x === undefined && options.y === undefined),
    );
    let pos = { x: 0, y: 0, z: NO_UNIT_Z_113C };
    if (!isLocal && unit !== null) {
      const uPos = this.resolveUnitPos(unit);
      if (uPos !== null) {
        pos = unitSoundPosition113c(
          uPos,
          this.resolveListenerPos(options.listenerPos),
          requestedId,
        );
      }
    } else if (
      !isLocal &&
      options.x !== undefined &&
      options.y !== undefined &&
      Number.isFinite(options.x) &&
      Number.isFinite(options.y)
    ) {
      const listener = this.resolveListenerPos(options.listenerPos);
      pos = {
        x: Math.trunc(options.x - listener.x),
        y: Math.trunc(options.y - listener.y),
        z: SOUND_POS_Z_113C,
      };
    }

    const maxDist = falloffMaxDist113c(reqRow.falloff);
    const cx = Math.max(-DIST_CLAMP_113C, Math.min(DIST_CLAMP_113C, pos.x));
    const cy = Math.max(-DIST_CLAMP_113C, Math.min(DIST_CLAMP_113C, pos.y));
    const dist2 = Math.fround(cx * cx + cy * cy);
    if (dist2 > Math.fround(maxDist * maxDist)) {
      return false;
    }

    // 1.13c Defer Inst / Stop Inst & Speech Conflict check (0x6fb391bd..0x6fb392ac)
    // Note: 0x6fb0e99c clears Defer Inst when Stop Inst = 1.
    const stopInst = Boolean(reqRow.stopInst) || options.forceStop === true;
    const deferInst = Boolean(reqRow.deferInst && !reqRow.stopInst);
    if (this.activeElement !== null && this.activeEntry !== null) {
      const activeRow = SOUNDS_113C[this.activeEntry.id];
      const positioned =
        !isLocal && (pos.x !== 0 || pos.y !== 0 || pos.z !== NO_UNIT_Z_113C);
      let hasConflict = false;
      if (deferInst || stopInst) {
        if (activeRow && activeRow.groupBase === reqRow.groupBase) {
          if (
            unit === null ||
            (this.activeUnit !== null && sameUnit113c(this.activeUnit, unit))
          ) {
            hasConflict = true;
          }
        }
      }
      if (
        unit !== null &&
        this.activeUnit !== null &&
        sameUnit113c(this.activeUnit, unit)
      ) {
        // FindSpeechConflict 0x6fb37bd0: any active speech in 2934..4656 on the same unit conflicts.
        hasConflict = true;
      }
      const unchecked = deferInst && unit === null && positioned;
      if (!unchecked && hasConflict && !stopInst) {
        // 0x6fb3929e: Defer Inst = 1, Stop Inst = 0 drops the new speech and keeps the current one playing.
        return false;
      }
    }

    // 1.13c StartSound (0x6fb0d7a0): variant pick (`0x6fb0ee70`) & 2-slot recent history (`0x6fb0d82e..0x6fb0d837`)
    const a2 = options.a2 ?? 0;
    const rng = options.rng ?? this.defaultRng;
    const pickedId =
      (a2 & 1) === 0 && reqRow.groupSize > 1
        ? this.pickVariant113c(requestedId, reqRow.groupSize, rng)
        : requestedId;

    const recent = this.recentOf(requestedId);
    recent[1] = recent[0];
    recent[0] = pickedId;

    if (D9_UNSHIPPED_SOUND_IDS_SET_113C.has(pickedId)) {
      this.onUnavailable?.(pickedId, 'unshipped');
      return false;
    }
    if (NONE_WAV_SET.has(pickedId)) {
      return false;
    }

    const entry = SPEECH_INDEX_113C[pickedId] ?? resolveSpeechEntry113c(pickedId);
    if (!entry) {
      return false;
    }

    // Stop any currently playing speech stream before starting the new line
    this.stopInternal(false);

    const elem = this.createAudioElement(entry.url);
    elem.src = entry.url;
    elem.loop = false;
    elem.currentTime = 0;

    this.activeElement = elem;
    this.activeEntry = entry;
    this.activeUnit = unit;
    this.activeLocal = isLocal;
    this.activePosition = pos;
    this.activeVol255 =
      options.volume !== undefined && Number.isFinite(options.volume)
        ? Math.max(0, Math.min(255, Math.trunc(options.volume)))
        : 255;

    if (entry.solo) {
      this.applyDuck(true);
    } else {
      this.applyDuck(false);
    }

    this.refreshActiveVolume();

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
    return this.play(idOrName, { ...options, forceStop: true });
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
    this.activeUnit = null;
    this.activeLocal = true;
    this.activePosition = { x: 0, y: 0, z: NO_UNIT_Z_113C };
    this.activeChannelOutput = null;

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
      if (typeof this.records.setExternalSoloActive === 'function') {
        this.records.setExternalSoloActive(active);
      } else if (typeof this.records.setSoloActive === 'function') {
        this.records.setSoloActive(active);
      } else if (typeof this.records.setSoloDuck === 'function') {
        this.records.setSoloDuck(active);
      }
    }
    if (
      this.musicStreamer &&
      this.records === null &&
      this.onSoloChange === undefined &&
      this.onDuckChange === undefined
    ) {
      // When used standalone without SoundRecords113c or tick driver, keep musicStreamer notified on state change
      if (typeof this.musicStreamer.setSoloDuck === 'function') {
        this.musicStreamer.setSoloDuck(this.soloDuckPercent);
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
    const speechScale = this.speechVolume / 255;

    const out = channelOutput113c({
      vol: this.activeVol255,
      volume: rowVol,
      master: Math.round(masterGain * 100),
      pauseDuck: this.records?.pauseDuck ?? 100,
      soloDuck: this.soloDuckPercent,
      pauseExempt: false,
      soloRow: Boolean(soundRow?.solo ?? this.activeEntry.solo),
      x: this.activePosition.x,
      y: this.activePosition.y,
      z: this.activePosition.z,
      minDist: falloffMinDist113c(soundRow?.falloff ?? 4),
      maxDist: falloffMaxDist113c(soundRow?.falloff ?? 4),
      stereoChannel: (soundRow?.stereo ?? 0) !== 0,
    });
    this.activeChannelOutput = out;

    if (muted) {
      this.activeElement.volume = 0;
    } else if (
      this.activeLocal ||
      (this.activePosition.x === 0 &&
        this.activePosition.y === 0 &&
        this.activePosition.z === NO_UNIT_Z_113C)
    ) {
      this.activeElement.volume = Math.max(
        0,
        Math.min(
          1,
          (rowVol / 255) *
            (this.activeVol255 / 255) *
            masterGain *
            speechScale,
        ),
      );
    } else {
      const peakGain = Math.max(out.left, out.right);
      this.activeElement.volume = Math.max(
        0,
        Math.min(1, peakGain * speechScale),
      );
    }
  }
}
