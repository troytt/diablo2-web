/**
 * Diablo II v1.13c Session Audio Runtime (`src/client/audio/audio-runtime-113c.ts`, #944 F9).
 *
 * Owns:
 * - Lazy Web Audio graph (`voices -> sfxGain -> masterGain -> destination`, `musicGain -> masterGain`)
 *   created on first user gesture (`unlock()`).
 * - Exactly ONE session `SoundRecords113c` record layer (`records`, override v).
 * - Monotonic 25 Hz `soundTick(gameTick)` driver (`update() + endTick()` once per new game tick,
 *   no catch-up loop on tick jumps, throws on tick regression).
 * - Settings bridge: `masterVolume` (0..1) -> `Math.round(v * 100)` in `SoundRecords113c`;
 *   `muted` -> `masterGain.gain.value = 0 | 1` ONLY (record layer, timers, and RNG unaffected).
 * - Background pack prefetch (`prefetchBackground()`, D4).
 */

import {
  MonsterSoundController113c,
  getMonsterPackIdsForAct113c,
  resolveMonsterEventSoundId113c,
  type MonsterSoundEvent113c,
  type PlayMonsterSoundOptions113c,
} from '../../common/audio/mon-sounds-113c.ts'
import {
  SFX_PACKS_113C,
  getSfxPackEntry113c,
} from '../../common/audio/sfx-pack-index-113c.ts'
import {
  SkillSoundController113c,
  getSkillPackIdsForClasses113c,
} from '../../common/audio/skill-sounds-113c.ts'
import { SOUNDS_113C } from '../../common/audio/sounds-113c.ts'
import { isUnshippedSoundId113c } from '../../common/audio/speech-index-113c.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import { MUSIC_QUEST_STINGER_RANGE_113C, MusicStreamer } from './music-streamer.ts'
import { SfxChunkLoader } from './sfx-chunk-loader.ts'
import {
  SoundEnviron113c,
  type WeatherAudioStateInput113c,
} from './sound-environ-113c.ts'
import {
  SoundRecords113c,
  type PlaySoundOptions,
  type SoundSampleFacts113c,
  type SoundUnitRef113c,
  type SoundVoiceBackend,
} from './sound-records-113c.ts'
import { WebAudioSoundVoices, type ResolvedVoiceBuffer113c, type WebAudioOutputBus113c } from './sound-voices-webaudio.ts'
import { SpeechStreamer } from './speech-streamer.ts'

export interface AudioRuntimeSettingsSource113c {
  masterVolume(): number
  muted(): boolean
}

export interface AudioRuntime113cOptions {
  readonly rng?: D2Rng | undefined
  readonly listenerPos?: (() => { readonly x: number; readonly y: number }) | undefined
  readonly loader?: SfxChunkLoader | undefined
  readonly settings?: AudioRuntimeSettingsSource113c | undefined
  readonly paused?: (() => boolean) | undefined
  readonly records?: SoundRecords113c | undefined
  readonly voices?: SoundVoiceBackend | undefined
  readonly sampleFacts?: ((id: number) => SoundSampleFacts113c | undefined) | undefined
}

export interface AudioRuntimePlayOptions113c extends PlaySoundOptions {
  readonly volume?: number | undefined
  readonly unitType?: SoundUnitRef113c['unitType'] | undefined
  readonly unitId?: number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly isLocalPlayer?: boolean | undefined
}

export interface WorldSoundRequest113c {
  readonly kind?: string | undefined
  readonly soundId?: number | undefined
  readonly speechSoundId?: number | undefined
  readonly stingerSoundId?: number | undefined
  readonly eventCode?: number | undefined
  readonly skillId?: number | undefined
  readonly missileId?: number | string | undefined
  readonly entityId?: number | undefined
  readonly charclass?: string | number | undefined
  readonly flag?: number | undefined
  readonly prog?: boolean | undefined
  readonly local?: boolean | undefined
  readonly isLocalPlayer?: boolean | undefined
  readonly unit?: SoundUnitRef113c | null | undefined
  readonly unitId?: number | undefined
  readonly unitType?: SoundUnitRef113c['unitType'] | string | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly volume?: number | undefined
  readonly volumeOverride?: number | undefined
  readonly delayTicks?: number | undefined
  readonly a2?: number | undefined
  readonly a3?: number | undefined
}

function clampMasterVolume100(volume01: number): number {
  if (!Number.isFinite(volume01)) return 80
  const clamped = Math.max(0, Math.min(1, volume01))
  return Math.round(clamped * 100)
}

function normalizeUnitRef(options?: AudioRuntimePlayOptions113c): SoundUnitRef113c | null | undefined {
  if (options === undefined) return undefined
  if (options.unit !== undefined) {
    if (options.unit === null) return null
    const u = options.unit
    if (u.getPos !== undefined || (u.x !== undefined && u.y !== undefined)) {
      if (options.isLocalPlayer !== undefined && u.isLocalPlayer === undefined) {
        return { ...u, isLocalPlayer: options.isLocalPlayer }
      }
      return u
    }
    return {
      ...u,
      x: u.x ?? options.x ?? 0,
      y: u.y ?? options.y ?? 0,
      ...(u.isLocalPlayer !== undefined
        ? { isLocalPlayer: u.isLocalPlayer }
        : options.isLocalPlayer !== undefined
          ? { isLocalPlayer: options.isLocalPlayer }
          : {}),
    }
  }
  if (options.unitType !== undefined && options.unitId !== undefined) {
    return {
      unitType: options.unitType,
      id: options.unitId,
      x: options.x ?? 0,
      y: options.y ?? 0,
      ...(options.isLocalPlayer !== undefined ? { isLocalPlayer: options.isLocalPlayer } : {}),
    }
  }
  return undefined
}

function levelIdToAct113c(levelId: number): number {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > 136) return 0
  if (levelId <= 39) return 1
  if (levelId <= 74) return 2
  if (levelId <= 102) return 3
  if (levelId <= 108) return 4
  return 5
}

export class AudioRuntime113c {
  readonly records: SoundRecords113c
  readonly loader: SfxChunkLoader
  readonly musicStreamer: MusicStreamer
  readonly speechStreamer: SpeechStreamer
  readonly soundEnviron: SoundEnviron113c
  readonly skillSounds: SkillSoundController113c
  readonly monsterSounds: MonsterSoundController113c
  private readonly voices: WebAudioSoundVoices
  private readonly settings: AudioRuntimeSettingsSource113c

  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private focusMuted = false
  private lastGameTick: number | null = null
  private sessionEpoch = 0
  private readonly inFlightHandles = new Set<number>()
  private readonly decodedPendingQueue: {
    readonly handle: number
    readonly priority: number
  }[] = []
  private inFlightAsyncCount = 0

  constructor(options: AudioRuntime113cOptions = {}) {
    const rng = options.rng ?? new D2Rng(0x6fb0e8e1, 0x00000113)
    this.settings = options.settings ?? {
      masterVolume: () => 0.8,
      muted: () => false,
    }
    this.loader =
      options.loader ??
      new SfxChunkLoader({
        getContext: () => this.ctx,
      })
    this.musicStreamer = new MusicStreamer({
      getContext: () => this.ctx,
      getOutput: () => {
        if (this.ctx === null || this.musicGain === null) return null
        return { ctx: this.ctx, node: this.musicGain }
      },
      getMasterVolume: () => this.settings.masterVolume(),
      isMuted: () => this.isEffectiveMuted(),
    })
    this.voices = new WebAudioSoundVoices(
      (): WebAudioOutputBus113c | null => {
        if (this.ctx === null || this.sfxGain === null) return null
        return { ctx: this.ctx, node: this.sfxGain }
      },
      (id: number): ResolvedVoiceBuffer113c | undefined => {
        const buffer = this.loader.getCachedBuffer(id)
        if (buffer === undefined) return undefined
        const entry = getSfxPackEntry113c(id)
        return {
          buffer,
          sourceSampleRate: entry?.sampleRate ?? 22_050,
        }
      },
      async (id: number): Promise<ResolvedVoiceBuffer113c | undefined> => {
        const buffer = await this.loader.loadSoundBuffer(id, this.ctx)
        if (buffer === null) return undefined
        const entry = getSfxPackEntry113c(id)
        return {
          buffer,
          sourceSampleRate: entry?.sampleRate ?? 22_050,
        }
      },
    )
    this.records =
      options.records ??
      SoundRecords113c.fromSounds113c({
        rng,
        master: () => clampMasterVolume100(this.settings.masterVolume()),
        paused: options.paused ?? (() => false),
        listenerPos: options.listenerPos ?? (() => ({ x: 0, y: 0 })),
        voices: options.voices ?? this.voices,
        sampleFacts:
          options.sampleFacts ??
          ((id: number): SoundSampleFacts113c | undefined => {
            if (isUnshippedSoundId113c(id)) {
              return { kind: 'unavailable', reason: 'unshipped' }
            }
            const entry = getSfxPackEntry113c(id)
            if (entry !== undefined) {
              return {
                kind: 'pcm',
                sampleRate: entry.sampleRate,
                frames: entry.frames,
                channels: entry.channels,
              }
            }
            const row = SOUNDS_113C[id]
            if (row === undefined) return undefined
            if (row.stream) return { kind: 'unavailable', reason: 'streamed' }
            return { kind: 'unavailable', reason: 'unshipped' }
          }),
      })
    this.speechStreamer = new SpeechStreamer({
      records: this.records,
      musicStreamer: this.musicStreamer,
      getMasterVolume: () => this.settings.masterVolume(),
      isMuted: () => this.isEffectiveMuted(),
    })
    this.soundEnviron = new SoundEnviron113c({
      records: this.records,
      rng,
      preloadAct: (act: number) => {
        this.preloadAmbientAct(act)
      },
      preloadPack: (packId: string) => {
        this.loader.prefetch(packId)
      },
    })
    this.skillSounds = new SkillSoundController113c({
      records: this.records,
      rng,
    })
    this.monsterSounds = new MonsterSoundController113c({
      records: this.records,
      rng,
    })
  }

  get music(): MusicStreamer {
    return this.musicStreamer
  }

  get speech(): SpeechStreamer {
    return this.speechStreamer
  }

  get environ(): SoundEnviron113c {
    return this.soundEnviron
  }

  get monsters(): MonsterSoundController113c {
    return this.monsterSounds
  }

  getContext(): AudioContext | null {
    return this.ctx
  }

  unlock(): void {
    if (this.ctx === null) {
      const g = globalThis as {
        AudioContext?: new () => AudioContext
        webkitAudioContext?: new () => AudioContext
      }
      const Ctor = g.AudioContext ?? g.webkitAudioContext
      if (Ctor === undefined) return
      const ctx = new Ctor()
      const masterGain = ctx.createGain()
      const sfxGain = ctx.createGain()
      const musicGain = ctx.createGain()
      sfxGain.connect(masterGain)
      musicGain.connect(masterGain)
      masterGain.connect(ctx.destination)
      this.ctx = ctx
      this.masterGain = masterGain
      this.sfxGain = sfxGain
      this.musicGain = musicGain
    }
    this.applySettings()
    this.musicStreamer.unlock()
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
      void this.ctx
        .resume()
        .then(() => {
          this.musicStreamer.unlock()
          this.applySettings()
        })
        .catch(() => {
          /* ignore browser autoplay rejection prior to gesture */
        })
    }
  }

  isFocusMuted(): boolean {
    return this.focusMuted
  }

  setFocusMuted(muted: boolean): void {
    if (this.focusMuted === muted) return
    this.focusMuted = muted
    this.voices.setFocusMuted(muted)
    this.applySettings()
  }

  isEffectiveMuted(): boolean {
    return this.settings.muted() || this.focusMuted
  }

  applySettings(): void {
    if (this.masterGain !== null) {
      this.masterGain.gain.value = this.isEffectiveMuted() ? 0 : 1
    }
    this.musicStreamer.applySettings()
    this.speechStreamer.applySettings()
  }

  /**
   * Plays a high-priority background survival warning cue on this instance
   * when a non-focused multibox character takes damage or drops below 35% HP (#1363).
   * Uses authentic 1.13c `Sounds.txt` UI/warning sound IDs (`cursor_button_click` = 4,
   * `cursor_tone_1` = 14) via `SoundRecords113c`.
   */
  playBackgroundAlertCue(kind: 'damage' | 'hit' | 'low-hp' | 'dead' | 'death' = 'damage'): boolean {
    if (this.settings.muted()) return false
    const vol = Math.max(0, Math.min(1, this.settings.masterVolume()))
    if (vol <= 0) return false
    const prevFocusMuted = this.focusMuted
    if (prevFocusMuted) {
      this.setFocusMuted(false)
    }
    try {
      // 1.13c Sounds.txt ID 14 (`cursor_tone_1`) for low-hp/death, ID 4 (`cursor_button_click`) for damage
      const soundId = kind === 'damage' || kind === 'hit' ? 4 : 14
      return this.playBySoundId(soundId) > 0
    } finally {
      if (prevFocusMuted) {
        this.setFocusMuted(true)
      }
    }
  }

  playBySoundId(soundId: number, options?: AudioRuntimePlayOptions113c): number {
    return this.playSound(soundId, options)
  }

  dispose(): void {
    this.gameExit()
    if (this.ctx !== null) {
      try {
        if (typeof this.ctx.close === 'function') {
          void this.ctx.close().catch(() => {})
        }
      } catch {
        /* ignore */
      }
      this.ctx = null
      this.masterGain = null
      this.sfxGain = null
      this.musicGain = null
    }
  }

  gameInit(): void {
    this.sessionEpoch += 1
    this.lastGameTick = null
    this.decodedPendingQueue.length = 0
    this.inFlightHandles.clear()
    this.inFlightAsyncCount = 0
    this.musicStreamer.stop()
    this.speechStreamer.stop()
    this.skillSounds.stopAll()
    this.soundEnviron.reset()
    this.voices.stopAll()
    this.records.gameInit()
  }

  gameExit(): void {
    this.sessionEpoch += 1
    this.lastGameTick = null
    this.decodedPendingQueue.length = 0
    this.inFlightHandles.clear()
    this.inFlightAsyncCount = 0
    this.musicStreamer.stop()
    this.speechStreamer.stop()
    this.skillSounds.stopAll()
    this.soundEnviron.stopAll()
    this.records.stopAll()
    this.voices.stopAll()
  }

  /**
   * Pre-game / frontend 25 Hz audio tick (`main_menu`, `bnet_login`, `char_select`,
   * `char_create`, `bnet_lobby`, `door_loading`).
   * Drains async-decoded UI SFX (`cursor_button_click`), updates active UI sound records,
   * and advances `MusicStreamer` crossfades without mutating `this.lastGameTick`.
   */
  uiTick(ticks = 1): void {
    const count = Number.isFinite(ticks) && ticks > 0 ? Math.max(1, Math.round(ticks)) : 1
    for (let i = 0; i < count; i += 1) {
      if (this.decodedPendingQueue.length > 0 && this.inFlightAsyncCount === 0) {
        this.decodedPendingQueue.sort((a, b) => a.priority - b.priority || a.handle - b.handle)
        const batch = this.decodedPendingQueue.splice(0, 12)
        for (const item of batch) {
          this.records.setAsyncReady(item.handle)
        }
      }
      this.records.update()
      this.records.endTick()
      this.musicStreamer.soundTick()
    }
  }

  soundTick(gameTick: number): boolean {
    if (!Number.isInteger(gameTick) || gameTick < 0) {
      throw new Error(`AudioRuntime113c.soundTick: invalid gameTick ${String(gameTick)}`)
    }
    if (this.lastGameTick !== null) {
      if (gameTick < this.lastGameTick) {
        throw new Error(
          `AudioRuntime113c.soundTick: tick regression ${String(gameTick)} < ${String(this.lastGameTick)}`,
        )
      }
      if (gameTick === this.lastGameTick) {
        return false
      }
    }
    this.lastGameTick = gameTick
    if (this.decodedPendingQueue.length > 0 && this.inFlightAsyncCount === 0) {
      this.decodedPendingQueue.sort((a, b) => a.priority - b.priority || a.handle - b.handle)
      const batch = this.decodedPendingQueue.splice(0, 12)
      for (const item of batch) {
        this.records.setAsyncReady(item.handle)
      }
    }
    this.soundEnviron.tick(gameTick)
    this.records.update()
    this.records.endTick()
    this.musicStreamer.soundTick(gameTick)
    return true
  }

  playTitleMusic(): boolean {
    return this.musicStreamer.playTitleMusic()
  }

  playOptionsMusic(): boolean {
    return this.musicStreamer.playOptionsMusic()
  }

  playLevelMusic(levelId: number, blockIndex?: number): boolean {
    return this.musicStreamer.playLevelMusic(levelId, blockIndex)
  }

  enterArea(levelId: number, tod?: number): boolean {
    const act = levelIdToAct113c(levelId)
    if (act >= 1 && act <= 5) {
      this.preloadMonsterPacksForAct(act)
    }
    this.soundEnviron.enterLevel(levelId, tod)
    return this.musicStreamer.onEnterArea(levelId)
  }

  onEnterArea(levelId: number, tod?: number): boolean {
    return this.enterArea(levelId, tod)
  }

  enterLevel(levelId: number, tod?: number): void {
    const act = levelIdToAct113c(levelId)
    if (act >= 1 && act <= 5) {
      this.preloadMonsterPacksForAct(act)
    }
    this.soundEnviron.enterLevel(levelId, tod)
  }

  setTimeOfDay(tod: number): void {
    this.soundEnviron.setTimeOfDay(tod)
  }

  setRaining(raining: boolean, targetVolume = 255): void {
    this.soundEnviron.setRaining(raining, targetVolume)
  }

  setWeather(state: WeatherAudioStateInput113c | boolean, targetVolume?: number): void {
    this.soundEnviron.setWeather(state, targetVolume)
  }

  triggerThunder(): number {
    return this.soundEnviron.triggerThunder()
  }

  playThunder(): number {
    return this.soundEnviron.playThunder()
  }

  preloadAmbientAct(act: number): void {
    if (!Number.isInteger(act) || act < 1 || act > 5) return
    const prefix = `sfx-ambient-act${String(act)}`
    for (const pack of SFX_PACKS_113C) {
      if (pack.packId === prefix || pack.packId.startsWith(`${prefix}-`)) {
        this.loader.prefetch(pack.packId)
      }
    }
  }

  preloadMonsterPacksForAct(act: number): void {
    this.loader.prefetch('sfx-mon-global')
    for (const packId of getMonsterPackIdsForAct113c(act)) {
      this.loader.prefetch(packId)
    }
  }

  onActEnter(act: number): void {
    this.preloadMonsterPacksForAct(act)
  }

  setCurrentAct(act: number): void {
    this.preloadMonsterPacksForAct(act)
  }

  playMonsterSound(
    monId: string | number,
    event: MonsterSoundEvent113c,
    opts?: PlayMonsterSoundOptions113c,
  ): number {
    const soundId = resolveMonsterEventSoundId113c(monId, event, opts?.uhcIdx)
    if (soundId <= 0) return 0
    return this.playSound(soundId, {
      ...(opts?.unit !== undefined ? { unit: opts.unit } : {}),
      ...(opts?.x !== undefined ? { x: opts.x } : {}),
      ...(opts?.y !== undefined ? { y: opts.y } : {}),
      ...(opts?.local !== undefined ? { local: opts.local } : {}),
      ...(opts?.delayTicks !== undefined ? { delayTicks: opts.delayTicks } : {}),
    })
  }

  playSpeech(idOrName: number | string): boolean {
    return this.speechStreamer.play(idOrName)
  }

  stopSpeech(): void {
    this.speechStreamer.stop()
  }

  onNpcDialogClose(): void {
    this.speechStreamer.onNpcDialogClose()
  }

  onEscCancel(): void {
    this.speechStreamer.onEscCancel()
  }

  preloadSkillPacksForClasses(classes: readonly unknown[]): void {
    for (const packId of getSkillPackIdsForClasses113c(classes)) {
      this.loader.prefetch(packId)
    }
  }

  setActivePlayerClasses(classes: readonly unknown[]): void {
    this.preloadSkillPacksForClasses(classes)
  }

  onSkillCastStart(ev: unknown): number {
    return this.skillSounds.onSkillCastStart(ev)
  }

  playSkillCastStart(ev: unknown): number {
    return this.skillSounds.playSkillCastStart(ev)
  }

  onAnimKeyframe(ev: unknown): number {
    return this.skillSounds.onAnimKeyframe(ev)
  }

  playSkillAnimKeyframe(ev: unknown): number {
    return this.skillSounds.playSkillAnimKeyframe(ev)
  }

  onMissileSpawn(ev: unknown): number {
    return this.skillSounds.onMissileSpawn(ev)
  }

  spawnMissileEmitter(ev: unknown): number {
    return this.skillSounds.spawnMissileEmitter(ev)
  }

  onMissileTick(evOrId: unknown, maybeX?: number, maybeY?: number): boolean {
    return this.skillSounds.onMissileTick(evOrId, maybeX, maybeY)
  }

  updateMissilePosition(evOrId: unknown, maybeX?: number, maybeY?: number): boolean {
    return this.skillSounds.updateMissilePosition(evOrId, maybeX, maybeY)
  }

  onMissileDestroy(ev: unknown): boolean {
    return this.skillSounds.onMissileDestroy(ev)
  }

  destroyMissileEmitter(ev: unknown): boolean {
    return this.skillSounds.destroyMissileEmitter(ev)
  }

  onMissileImpact(ev: unknown): number {
    return this.skillSounds.onMissileImpact(ev)
  }

  playMissileImpact(ev: unknown): number {
    return this.skillSounds.playMissileImpact(ev)
  }

  tick(gameTick: number): boolean {
    return this.soundTick(gameTick)
  }

  playActIntroMusic(act: number): boolean {
    return this.musicStreamer.playActIntroMusic(act)
  }

  playQuestStinger(soundId: number, onEnded?: () => void): boolean {
    return this.musicStreamer.playQuestStinger(soundId, onEnded)
  }

  stopMusic(): void {
    this.musicStreamer.stop()
  }

  playUi(soundId: number): number {
    return this.playSound(soundId)
  }

  playSound(
    soundId: number,
    options?: AudioRuntimePlayOptions113c,
  ): number {
    if (!Number.isInteger(soundId) || soundId <= 0 || soundId >= SOUNDS_113C.length) {
      return 0
    }
    if (isUnshippedSoundId113c(soundId)) {
      return this.records.play(soundId)
    }
    const row = SOUNDS_113C[soundId]
    if (row === undefined || row.volume === 0) {
      return 0
    }
    if (row.stream && soundId >= 2934 && soundId <= 4656) {
      return this.playSpeech(soundId) ? 1 : 0
    }

    const groupSize = Math.max(1, row.groupSize)
    const variantIds: number[] = []
    let allCached = true
    let anyHasEntry = false
    for (let k = 0; k < groupSize; k += 1) {
      const vid = soundId + k
      if (getSfxPackEntry113c(vid) !== undefined) {
        anyHasEntry = true
        variantIds.push(vid)
        if (this.loader.getCachedBuffer(vid) === undefined) {
          allCached = false
        }
      }
    }

    const resolvedUnit = normalizeUnitRef(options)
    const basePlayOpts: PlaySoundOptions = {
      ...(resolvedUnit !== undefined ? { unit: resolvedUnit } : {}),
      ...(options?.x !== undefined ? { x: options.x } : {}),
      ...(options?.y !== undefined ? { y: options.y } : {}),
      ...(options?.local !== undefined
        ? { local: options.local }
        : options?.isLocalPlayer !== undefined
          ? { local: options.isLocalPlayer }
          : {}),
      ...(options?.delayTicks !== undefined ? { delayTicks: options.delayTicks } : {}),
      ...(options?.a2 !== undefined ? { a2: options.a2 } : {}),
      ...(options?.a3 !== undefined ? { a3: options.a3 } : {}),
    }

    if (!anyHasEntry || allCached) {
      const handle =
        Object.keys(basePlayOpts).length === 0 ? this.records.play(soundId) : this.records.play(soundId, basePlayOpts)
      if (handle > 0) {
        if (!resolvedUnit && !basePlayOpts.local && options?.x !== undefined && options?.y !== undefined) {
          this.records.setSoundPos(handle, Math.trunc(options.x), Math.trunc(options.y))
        }
        if (options?.volume !== undefined) {
          this.records.setVolume(handle, options.volume)
        }
      }
      return handle
    }

    const pendingOpts: PlaySoundOptions = {
      ...basePlayOpts,
      asyncPending: true,
    }
    const handle = this.records.play(soundId, pendingOpts)
    if (handle <= 0) {
      return 0
    }
    if (!resolvedUnit && !basePlayOpts.local && options?.x !== undefined && options?.y !== undefined) {
      this.records.setSoundPos(handle, Math.trunc(options.x), Math.trunc(options.y))
    }
    if (options?.volume !== undefined) {
      this.records.setVolume(handle, options.volume)
    }

    const recView = this.records.record(handle)
    const priority = recView?.priority ?? (row.priority & 0xff)
    const epoch = this.sessionEpoch
    this.inFlightHandles.add(handle)
    this.inFlightAsyncCount += 1
    void (async () => {
      try {
        const buffers = await Promise.all(
          variantIds.map((vid) => this.loader.loadSoundBuffer(vid, this.ctx)),
        )
        if (this.sessionEpoch !== epoch) return
        if (buffers.every((b) => b !== null)) {
          this.decodedPendingQueue.push({ handle, priority })
        } else {
          this.records.stop(handle)
        }
      } catch {
        if (this.sessionEpoch !== epoch) return
        this.records.stop(handle)
      } finally {
        if (this.sessionEpoch === epoch) {
          this.inFlightHandles.delete(handle)
          this.inFlightAsyncCount = Math.max(0, this.inFlightAsyncCount - 1)
        }
      }
    })()
    return handle
  }

  /**
   * 0x6fad387c..0x6fad389e: checks `0x6fad25d0` (`isUnitSoundPlaying`) for `unit` and `soundId`;
   * starts the unit-attached loop sound only if the unit does not already have an active record in that group.
   */
  startUnitLoopSound(
    soundId: number,
    options?: AudioRuntimePlayOptions113c,
  ): number {
    const resolvedUnit = normalizeUnitRef(options)
    if (resolvedUnit && this.records.isUnitSoundPlaying(resolvedUnit, soundId)) {
      return 0
    }
    return this.playSound(soundId, options)
  }

  /**
   * 0x6fad3070 → 0x6fb38c20(handle, unit, 0): detaches `unit` from all active looping sound records
   * and fades/stops any record left without attached units.
   */
  stopUnitLoopSound(unit: SoundUnitRef113c): number {
    return this.records.stopUnitLoopSounds(unit)
  }

  /**
   * 0x6fad25d0 + StopSound 0x6fb38bf0 (used by SKILLS_CltDo45_Whirlwind 0x6fb76472 / 0x6fb7655d for
   * barbarian_whirlwind 2531): detaches `unit` from active records in `soundId`'s variant group and
   * fades/stops any record left without attached units.
   */
  stopUnitSound(unit: SoundUnitRef113c, soundId: number): number {
    return this.records.stopUnitSound(unit, soundId)
  }

  drainWorldRequests(requests: readonly WorldSoundRequest113c[]): number[] {
    const handles: number[] = []
    for (const req of requests) {
      if (req.kind === 'speech-stop' || req.kind === 'npc-cancel') {
        this.stopSpeech()
        continue
      }
      if (req.kind === 'unit-loop-stop') {
        if (req.unit) {
          this.stopUnitLoopSound(req.unit)
        }
        continue
      }
      if (req.kind === 'unit-sound-stop' || req.kind === 'skill-cast-stop') {
        const resolvedUnit: SoundUnitRef113c | undefined =
          req.unit ??
          (req.unitId !== undefined
            ? {
                unitType: (req.unitType as SoundUnitRef113c['unitType']) ?? 'player',
                id: req.unitId,
              }
            : undefined)
        const stopSid =
          req.soundId !== undefined && req.soundId > 0
            ? req.soundId
            : req.skillId === 151
              ? 2531
              : 0
        if (resolvedUnit && stopSid > 0) {
          this.stopUnitSound(resolvedUnit, stopSid)
        }
        this.skillSounds.onSkillCastStop(req)
        continue
      }
      if (req.kind === 'unit-loop-start') {
        if (req.soundId === undefined || req.soundId <= 0) continue
        const h = this.startUnitLoopSound(req.soundId, {
          ...(req.unit !== undefined ? { unit: req.unit } : {}),
          x: req.x,
          y: req.y,
          ...(req.local !== undefined
            ? { local: req.local, isLocalPlayer: req.local }
            : req.isLocalPlayer !== undefined
              ? { local: req.isLocalPlayer, isLocalPlayer: req.isLocalPlayer }
              : {}),
          volume: req.volumeOverride ?? req.volume,
          delayTicks: req.delayTicks,
          a2: req.a2,
          a3: req.a3,
        })
        if (h > 0) handles.push(h)
        continue
      }
      const stingerId =
        req.stingerSoundId !== undefined &&
        req.stingerSoundId >= MUSIC_QUEST_STINGER_RANGE_113C[0] &&
        req.stingerSoundId <= MUSIC_QUEST_STINGER_RANGE_113C[1]
          ? req.stingerSoundId
          : req.soundId !== undefined &&
              req.soundId >= MUSIC_QUEST_STINGER_RANGE_113C[0] &&
              req.soundId <= MUSIC_QUEST_STINGER_RANGE_113C[1]
            ? req.soundId
            : undefined
      if (req.speechSoundId !== undefined && req.speechSoundId > 0) {
        if (stingerId !== undefined) {
          this.playQuestStinger(stingerId)
        }
        const ok = this.playSpeech(req.speechSoundId)
        if (ok) handles.push(1)
        continue
      }
      if (stingerId !== undefined) {
        this.playQuestStinger(stingerId)
        continue
      }
      if (req.kind === 'skill-cast' && (req.soundId === undefined || req.soundId <= 0)) {
        const h = this.onSkillCastStart(req)
        if (h > 0) handles.push(h)
        continue
      }
      if (req.kind === 'skill-keyframe' && (req.soundId === undefined || req.soundId <= 0)) {
        const h = this.onAnimKeyframe(req)
        if (h > 0) handles.push(h)
        continue
      }
      if (req.kind === 'missile-spawn' && (req.soundId === undefined || req.soundId <= 0)) {
        const h = this.onMissileSpawn(req)
        if (h > 0) handles.push(h)
        continue
      }
      if (req.kind === 'missile-impact' && (req.soundId === undefined || req.soundId <= 0)) {
        const h = this.onMissileImpact(req)
        if (h > 0) handles.push(h)
        continue
      }
      if (req.soundId === undefined || req.soundId <= 0) continue
      const resolvedPlayUnit: SoundUnitRef113c | undefined =
        req.unit ??
        (req.unitId !== undefined
          ? {
              unitType: (req.unitType as SoundUnitRef113c['unitType']) ?? 'player',
              id: req.unitId,
              ...(req.x !== undefined ? { x: Math.round(req.x) } : {}),
              ...(req.y !== undefined ? { y: Math.round(req.y) } : {}),
              ...(req.local !== undefined
                ? { isLocalPlayer: req.local }
                : req.isLocalPlayer !== undefined
                  ? { isLocalPlayer: req.isLocalPlayer }
                  : {}),
            }
          : undefined)
      if (
        resolvedPlayUnit &&
        (req.skillId === 151 || (req.soundId >= 2531 && req.soundId <= 2534))
      ) {
        this.stopUnitSound(resolvedPlayUnit, 2531)
      }
      const h = this.playSound(req.soundId, {
        ...(resolvedPlayUnit !== undefined ? { unit: resolvedPlayUnit } : {}),
        x: req.x,
        y: req.y,
        ...(req.local !== undefined
          ? { local: req.local, isLocalPlayer: req.local }
          : req.isLocalPlayer !== undefined
            ? { local: req.isLocalPlayer, isLocalPlayer: req.isLocalPlayer }
            : {}),
        volume: req.volumeOverride ?? req.volume,
        delayTicks: req.delayTicks,
        a2: req.a2,
        a3: req.a3,
      })
      handles.push(h)
    }
    return handles
  }

  prefetchBackground(): void {
    for (const pack of SFX_PACKS_113C) {
      if (pack.tier === 'background') {
        this.loader.prefetch(pack.packId)
      }
    }
  }
}
