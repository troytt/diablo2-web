/**
 * In-Memory Single-Player `LocalLoopbackAdapter` & `LocalLobbyProvider` (`src/server/loopback-adapter.ts`).
 *
 * Implements `GameServerAdapter` and `LobbyProvider` from `src/netproto/index.ts` directly over
 * `GameInstance` (`SINGLE_PLAYER_POLICY`) without network socket overhead.
 * Strictly isomorphic: zero DOM globals, zero Node built-ins, zero `Math.random()` or wall-clock calls.
 */

import { D2Rng } from '../common/rng/d2-rng.ts'
import { CANONICAL_CHARSTATS, type CharacterClassCode } from '../common/units/classes.ts'
import {
  TypedEmitter,
  registerLocalLobbyProvider,
  registerLocalServerFactory,
  type CharClassId,
  type CharCreateSpec,
  type CharSummary,
  type CharacterManageResult,
  type ChatEvent,
  type ClientCommand,
  type CloseReason,
  type GameCreateSpec,
  type GameDifficulty,
  type GameInfoDetail,
  type GameServerAdapter,
  type GameServerStats,
  type GameSummary,
  type JoinGameForm,
  type ListGamesOptions,
  type LobbyEnterGameTarget,
  type LobbyProvider,
  type LocalAreaBootstrap,
  type LocalAreaBootstrapResolver,
  type LocalServerOptions,
  type LocalServerSessionHandle,
  type LocalServerSessionRequest,
  type ServerEvent,
} from '../netproto/index.ts'
import {
  GameInstance,
  SINGLE_PLAYER_POLICY,
  type GameModePolicy,
} from './engine/game-instance.ts'
import { FIXED_ONE } from './engine/stat-list.ts'
import { createAreaBootstrapResolver } from './world/area-bootstrap.ts'
import {
  extractCharSummaryFromD2s,
  getServerItemDataTables,
  readD2sSave113c,
} from './save/d2s-reader.ts'
import {
  createDefaultNpcIntroData,
  createDefaultQuestData,
  createDefaultWaypointData,
  writeD2sSave113c,
} from './save/d2s-writer.ts'

export const SERVER_FRAME_MS = 40
export const MAX_CATCHUP_FRAMES = 5

const CLASS_CODE_TO_ID: Record<string, CharClassId> = {
  ama: 0,
  amazon: 0,
  sor: 1,
  sorceress: 1,
  nec: 2,
  necromancer: 2,
  pal: 3,
  paladin: 3,
  bar: 4,
  barbarian: 4,
  dru: 5,
  druid: 5,
  ass: 6,
  asn: 6,
  assassin: 6,
}

const CLASS_ID_TO_CODE: Record<number, CharacterClassCode> = {
  0: 'ama',
  1: 'sor',
  2: 'nec',
  3: 'pal',
  4: 'bar',
  5: 'dru',
  6: 'ass',
}

function resolveClassId(raw: CharClassId | CharacterClassCode | number | string | undefined): CharClassId {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 6) {
    return raw as CharClassId
  }
  if (typeof raw === 'string') {
    const mapped = CLASS_CODE_TO_ID[raw.trim().toLowerCase()]
    if (mapped !== undefined) return mapped
    const num = Number(raw)
    if (Number.isInteger(num) && num >= 0 && num <= 6) return num as CharClassId
  }
  return 0
}

function resolveDifficultyNum(diff: GameDifficulty | number | undefined): 0 | 1 | 2 {
  if (diff === 'hell' || diff === 2) return 2
  if (diff === 'nightmare' || diff === 1) return 1
  return 0
}

const ACT_TOWN_AREA: Record<number, number> = {
  0: 1,
  1: 40,
  2: 75,
  3: 103,
  4: 109,
}

function areaToAct(areaId: number): number {
  if (areaId >= 109) return 4
  if (areaId >= 103) return 3
  if (areaId >= 75) return 2
  if (areaId >= 40) return 1
  return 0
}

export interface LocalLoopbackAdapterOptions {
  readonly game?: GameInstance | undefined
  readonly engine?: GameInstance | undefined
  readonly gameInstance?: GameInstance | undefined
  readonly playerId?: number | undefined
  readonly playerUnitId?: number | undefined
  readonly charName?: string | undefined
  readonly playerName?: string | undefined
  readonly name?: string | undefined
  readonly classId?: CharClassId | CharacterClassCode | number | string | undefined
  readonly charClass?: CharClassId | CharacterClassCode | number | string | undefined
  readonly level?: number | undefined
  readonly difficulty?: 0 | 1 | 2 | undefined
  readonly mapSeed?: number | undefined
  readonly seed?: number | undefined
  readonly areaId?: number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly playersX?: number | undefined
  readonly onPlayersXChange?: ((playersX: number) => void) | undefined
  readonly policy?: Partial<GameModePolicy> | undefined
  readonly registry?: unknown
  readonly d2s?: Uint8Array | undefined
  readonly d2sBytes?: Uint8Array | undefined
  readonly onAutoSave?: ((d2sBytes: Uint8Array) => void) | undefined
  readonly resolveAreaBootstrap?: LocalAreaBootstrapResolver | undefined
}

export class LocalLoopbackAdapter implements GameServerAdapter {
  readonly kind = 'ts' as const
  readonly game: GameInstance
  readonly gameInstance: GameInstance
  readonly playerUnitId: number

  private readonly eventEmitter = new TypedEmitter<ServerEvent>()
  private readonly closeEmitter = new TypedEmitter<CloseReason>()
  private readonly onAutoSave: ((d2sBytes: Uint8Array) => void) | undefined
  private readonly earlyEvents: ServerEvent[] = []
  private hasListener = false
  private closed = false
  private accumMs = 0
  private packetsInCount = 0
  private packetsOutCount = 0
  private savedD2sBytes: Uint8Array | undefined

  constructor(
    optionsOrGame?: LocalLoopbackAdapterOptions | GameInstance,
    maybeOptions?: LocalLoopbackAdapterOptions,
  ) {
    const isInstance = optionsOrGame instanceof GameInstance
    const opts: LocalLoopbackAdapterOptions = isInstance
      ? (maybeOptions ?? {})
      : (optionsOrGame ?? {})

    const instance = isInstance
      ? optionsOrGame
      : (opts.game ??
        opts.engine ??
        opts.gameInstance ??
        new GameInstance({
          mode: 'singlePlayer',
          policy: opts.policy ? { ...SINGLE_PLAYER_POLICY, ...opts.policy } : SINGLE_PLAYER_POLICY,
          difficulty: opts.difficulty ?? 0,
          mapSeed: opts.mapSeed ?? opts.seed,
          areaId: opts.areaId,
          playersX: opts.playersX,
          onPlayersXChange: opts.onPlayersXChange,
          registry: opts.registry,
        }))

    this.game = instance
    this.gameInstance = instance
    this.onAutoSave = opts.onAutoSave
    if (opts.playersX !== undefined && (isInstance || opts.game || opts.engine || opts.gameInstance)) {
      this.gameInstance.setPlayersX(opts.playersX)
    }

    if (opts.resolveAreaBootstrap) {
      // #1325: area bootstrap runs inside the game server (entry area + on-demand transitions).
      this.gameInstance.setAreaBootstrapResolver(opts.resolveAreaBootstrap)
    }

    const existingPlayerId = opts.playerUnitId ?? opts.playerId
    if (existingPlayerId !== undefined) {
      this.playerUnitId = existingPlayerId
    } else {
      const d2sRaw = opts.d2s ?? opts.d2sBytes
      this.playerUnitId = this.gameInstance.connectPlayer({
        charName: opts.charName ?? opts.playerName ?? opts.name,
        classId: opts.classId ?? opts.charClass,
        level: opts.level,
        areaId: opts.areaId,
        x: opts.x,
        y: opts.y,
        d2s: d2sRaw,
      })
    }

    // Buffer initial handshake events until connect(), stepFrame(), or tick() flushes them
    for (const ev of this.gameInstance.drainEvents(this.playerUnitId)) {
      this.earlyEvents.push(ev)
    }
  }

  get playerId(): number {
    return this.playerUnitId
  }

  get state(): 'loading' | 'ingame' | 'inGame' | 'closed' {
    return this.closed ? 'closed' : 'inGame'
  }

  get lastSavedD2s(): Uint8Array | undefined {
    return this.savedD2sBytes
  }

  get stats(): GameServerStats {
    return {
      rttMs: 0,
      bytesIn: this.packetsInCount * 16,
      bytesOut: this.packetsOutCount * 12,
      packetsIn: this.packetsInCount,
      packetsOut: this.packetsOutCount,
      unknownPackets: 0,
      opaquePackets: 0,
      protocolErrors: 0,
    }
  }

  getStats(): GameServerStats {
    return this.stats
  }

  connect(): void {
    if (this.closed) return
    this.flushEvents()
  }

  onEvent(cb: (ev: ServerEvent) => void): () => void {
    const unsub = this.eventEmitter.on(cb)
    this.hasListener = true
    return unsub
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    return this.closeEmitter.on(cb)
  }

  getGameInstance(): GameInstance {
    return this.gameInstance
  }

  send(cmd: ClientCommand): void {
    if (this.closed) return
    this.packetsOutCount++
    if (cmd.type === 'LeaveGame') {
      this.leave()
      return
    }
    this.gameInstance.enqueueCommand(this.playerUnitId, cmd)
  }

  sendCommand(cmd: ClientCommand): void {
    this.send(cmd)
  }

  stepFrame(): number {
    if (this.closed) return this.gameInstance.tickCount
    this.flushEvents()
    this.gameInstance.stepFrame()
    this.flushEvents()
    return this.gameInstance.tickCount
  }

  stepFrames(count: number): number {
    if (this.closed || !Number.isFinite(count) || count <= 0) {
      return this.gameInstance.tickCount
    }
    const n = Math.floor(count)
    for (let i = 0; i < n; i++) {
      this.stepFrame()
    }
    return this.gameInstance.tickCount
  }

  tick(dtMs: number = SERVER_FRAME_MS): number {
    if (this.closed) return 0

    this.flushEvents()

    if (dtMs > 0 && dtMs <= 10 && Number.isInteger(dtMs)) {
      this.stepFrames(dtMs)
      return dtMs
    }

    const clampedDt = Math.max(
      0,
      Math.min(Number.isFinite(dtMs) ? dtMs : SERVER_FRAME_MS, MAX_CATCHUP_FRAMES * SERVER_FRAME_MS),
    )
    if (this.gameInstance.isPaused()) {
      this.accumMs = 0
      this.gameInstance.stepFrame()
      this.flushEvents()
      return 0
    }

    this.accumMs += clampedDt
    let steps = 0
    while (this.accumMs >= SERVER_FRAME_MS && steps < MAX_CATCHUP_FRAMES) {
      this.accumMs -= SERVER_FRAME_MS
      this.gameInstance.stepFrame()
      steps++
      this.flushEvents()
    }
    return steps
  }

  setPaused(paused: boolean): void {
    this.gameInstance.setPaused(paused)
  }

  isPaused(): boolean {
    return this.gameInstance.isPaused()
  }

  getPlayersX(): number {
    return this.gameInstance.getPlayersX()
  }

  computeFrameLockstepHash(): number {
    return this.gameInstance.computeFrameLockstepHash()
  }

  getLastLockstepHash(): number {
    return this.gameInstance.computeFrameLockstepHash()
  }

  private flushEvents(): void {
    const drained = this.gameInstance.drainEvents(this.playerUnitId)
    for (const ev of drained) {
      this.earlyEvents.push(ev)
    }
    if (!this.hasListener || this.earlyEvents.length === 0) return
    const batch = this.earlyEvents.splice(0, this.earlyEvents.length)
    for (const ev of batch) {
      this.packetsInCount++
      this.eventEmitter.emit(ev)
    }
  }

  exportD2s(): Uint8Array {
    if (this.savedD2sBytes && this.closed) {
      return this.savedD2sBytes
    }
    const bytes = this.gameInstance.exportPlayerD2s(this.playerUnitId)
    this.savedD2sBytes = bytes
    return bytes
  }

  leave(): void {
    if (this.closed) return
    try {
      this.savedD2sBytes = this.gameInstance.exportPlayerD2s(this.playerUnitId)
      this.onAutoSave?.(this.savedD2sBytes)
    } catch {
      // Ignore export error if player was already removed
    }
    this.gameInstance.disconnectPlayer(this.playerUnitId)
    this.closed = true
    this.accumMs = 0
    this.closeEmitter.emit({ kind: 'local' })
  }

  close(): void {
    this.leave()
  }
}

export interface LocalLobbyProviderOptions {
  readonly initialSaves?: Readonly<Record<string, Uint8Array>> | ReadonlyMap<string, Uint8Array> | undefined
  readonly defaultMapSeed?: number | undefined
  readonly seed?: number | undefined
  readonly registry?: unknown
}

export class LocalLobbyProvider implements LobbyProvider {
  readonly mode = 'single' as const
  private readonly saves = new Map<string, Uint8Array>()
  private readonly gamesList: GameSummary[] = []
  private readonly chatEmitter = new TypedEmitter<ChatEvent>()
  private readonly defaultMapSeed: number
  private readonly registry: unknown
  private selectedCharName: string | undefined
  private persistedPlayersX: number | undefined = undefined

  getPersistedPlayersX(): number | undefined {
    return this.persistedPlayersX
  }

  setPersistedPlayersX(value: number | undefined): void {
    if (value === undefined) {
      this.persistedPlayersX = undefined
      return
    }
    this.persistedPlayersX = Math.max(1, Math.min(8, Math.floor(Number(value) || 1)))
  }

  constructor(options: LocalLobbyProviderOptions = {}) {
    this.defaultMapSeed = ((options.defaultMapSeed ?? options.seed ?? 0x12345678) >>> 0) || 1
    this.registry = options.registry
    if (options.initialSaves) {
      const entries =
        options.initialSaves instanceof Map
          ? options.initialSaves.entries()
          : Object.entries(options.initialSaves)
      for (const [name, bytes] of entries) {
        if (bytes instanceof Uint8Array) {
          this.saves.set(name, new Uint8Array(bytes))
        }
      }
    }
  }

  private findCanonicalKey(name: string): string | undefined {
    const target = name.trim().toLowerCase()
    for (const key of this.saves.keys()) {
      if (key.toLowerCase() === target) return key
    }
    return undefined
  }

  private toLobbyCharSummary(bytes: Uint8Array, canonicalName?: string): CharSummary {
    const summary = extractCharSummaryFromD2s(bytes)
    return {
      ...summary,
      ...(canonicalName ? { name: canonicalName } : {}),
      classId: CLASS_ID_TO_CODE[summary.charClass] ?? 'ama',
    }
  }

  async listCharacters(): Promise<readonly CharSummary[]> {
    const out: CharSummary[] = []
    for (const [name, bytes] of this.saves.entries()) {
      out.push(this.toLobbyCharSummary(bytes, name))
    }
    return out
  }

  async createCharacter(
    spec:
      | CharCreateSpec
      | {
          readonly name: string
          readonly classId?: CharClassId | CharacterClassCode | number | string | undefined
          readonly charClass?: CharClassId | CharacterClassCode | number | string | undefined
          readonly hardcore?: boolean | undefined
          readonly expansion?: boolean | undefined
          readonly ladder?: boolean | undefined
        },
  ): Promise<CharSummary> {
    const trimmed = spec.name.trim()
    if (!trimmed) {
      throw new Error('LocalLobbyProvider.createCharacter: character name must not be empty')
    }
    if (this.findCanonicalKey(trimmed) !== undefined) {
      throw new Error(`LocalLobbyProvider.createCharacter: character "${trimmed}" already exists`)
    }

    const classId = resolveClassId(
      'classId' in spec && spec.classId !== undefined ? spec.classId : spec.charClass,
    )
    const classCode = CLASS_ID_TO_CODE[classId] ?? 'ama'
    const base = CANONICAL_CHARSTATS[classCode]
    const statusFlags =
      (spec.expansion === false ? 0x00 : 0x20) |
      (spec.hardcore ? 0x04 : 0x00) |
      (spec.ladder ? 0x40 : 0x00)

    const d2sBytes = writeD2sSave113c(
      {
        name: trimmed,
        classId,
        level: 1,
        statusFlags,
        progression: 0,
        activeWeapon: 0,
        timestampSec: 0,
        leftSkill: 0,
        rightSkill: 0,
        altLeftSkill: 0,
        altRightSkill: 0,
        activeDifficulty: 0,
        activeAct: 0,
        mapSeed: this.defaultMapSeed,
        questsRaw: createDefaultQuestData(),
        waypointsRaw: createDefaultWaypointData(),
        npcIntro: createDefaultNpcIntroData(),
        attributes: {
          strength: base.baseAttributes.strength,
          energy: base.baseAttributes.energy,
          dexterity: base.baseAttributes.dexterity,
          vitality: base.baseAttributes.vitality,
          statPts: 0,
          newSkills: 0,
          hitpointsFixed: base.baseVitals.life * FIXED_ONE,
          maxHpFixed: base.baseVitals.life * FIXED_ONE,
          manaFixed: base.baseVitals.mana * FIXED_ONE,
          maxManaFixed: base.baseVitals.mana * FIXED_ONE,
          staminaFixed: base.baseVitals.stamina * FIXED_ONE,
          maxStaminaFixed: base.baseVitals.stamina * FIXED_ONE,
          level: 1,
          experience: 0,
          gold: 0,
          goldBank: 0,
        },
        skills: new Uint8Array(30),
        items: [],
        corpseItems: [],
        ironGolem: null,
      },
      getServerItemDataTables(),
    )

    this.saves.set(trimmed, d2sBytes)
    this.selectedCharName = trimmed
    return this.toLobbyCharSummary(d2sBytes)
  }

  async deleteCharacter(name: string): Promise<boolean> {
    const key = this.findCanonicalKey(name)
    if (key !== undefined) {
      this.saves.delete(key)
      if (this.selectedCharName?.toLowerCase() === key.toLowerCase()) {
        this.selectedCharName = undefined
      }
      return true
    }
    return false
  }

  async convertCharacterToExpansion(name: string): Promise<readonly CharSummary[]> {
    const key = this.findCanonicalKey(name)
    if (key !== undefined) {
      const bytes = this.saves.get(key)
      if (bytes) {
        const parsed = readD2sSave113c(bytes)
        const updated = writeD2sSave113c(
          {
            ...parsed,
            statusFlags: (parsed.statusFlags | 0x20) & 0xff,
          },
          getServerItemDataTables(),
        )
        this.saves.set(key, updated)
      }
    }
    return this.listCharacters()
  }

  async selectCharacter(name: string): Promise<void> {
    const key = this.findCanonicalKey(name)
    if (key === undefined) {
      throw new Error(`LocalLobbyProvider.selectCharacter: unknown character "${name}"`)
    }
    this.selectedCharName = key
  }

  getCharacterD2s(name: string): Uint8Array | undefined {
    const key = this.findCanonicalKey(name)
    if (key === undefined) return undefined
    const bytes = this.saves.get(key)
    return bytes ? new Uint8Array(bytes) : undefined
  }

  async exportCharacterD2s(name: string): Promise<Uint8Array | null> {
    return this.getCharacterD2s(name) ?? null
  }

  /**
   * Persist a game-completion progression (D2Client `0x6faf52fd`, packed save flags bits 8..12 = `.d2s`
   * header byte `+0x25`) into the stored save of `name`. Synchronous so `OnlineSession.leaveGame` can
   * finish the write before the frontend re-reads the character list.
   */
  writeCharacterProgression(name: string, progression: number): CharSummary {
    if (!Number.isInteger(progression) || progression < 0 || progression > 0x1f) {
      throw new Error(
        `LocalLobbyProvider.writeCharacterProgression: progression ${progression} is not a 5-bit value`,
      )
    }
    const key = this.findCanonicalKey(name)
    if (key === undefined) {
      throw new Error(`LocalLobbyProvider.writeCharacterProgression: unknown character "${name}"`)
    }
    const parsed = readD2sSave113c(this.saves.get(key)!)
    const bytes = writeD2sSave113c({ ...parsed, progression }, getServerItemDataTables())
    this.saves.set(key, new Uint8Array(bytes))
    return this.toLobbyCharSummary(bytes, key)
  }

  putCharacterD2s(name: string, d2sBytes: Uint8Array): CharSummary {
    const parsed = readD2sSave113c(d2sBytes)
    const canonicalName = name.trim() || parsed.name
    const existingKey = this.findCanonicalKey(canonicalName) ?? canonicalName
    this.saves.set(existingKey, new Uint8Array(d2sBytes))
    this.selectedCharName = existingKey
    return this.toLobbyCharSummary(d2sBytes)
  }

  async importCharacterD2s(d2sBytes: Uint8Array): Promise<CharacterManageResult> {
    const parsed = readD2sSave113c(d2sBytes)
    const summary = this.putCharacterD2s(parsed.name, d2sBytes)
    const allChars: CharSummary[] = []
    for (const b of this.saves.values()) {
      allChars.push(this.toLobbyCharSummary(b))
    }
    return {
      ok: true,
      character: summary,
      characters: allChars,
    }
  }

  async enterGame(
    target?:
      | { readonly mode: 'create'; readonly spec: GameCreateSpec }
      | { readonly mode: 'join'; readonly name: string; readonly password?: string | undefined }
      | { readonly mode: 'single'; readonly difficulty?: 0 | 1 | 2 | undefined }
      | LobbyEnterGameTarget,
  ): Promise<LocalLoopbackAdapter> {
    if (target && 'd2sBytes' in target && target.d2sBytes instanceof Uint8Array) {
      const parsed = readD2sSave113c(target.d2sBytes)
      this.putCharacterD2s(parsed.name, target.d2sBytes)
    }

    const rawName =
      (target && 'charName' in target && target.charName) ||
      (target && 'charSummary' in target && target.charSummary?.name) ||
      this.selectedCharName
    if (!rawName) {
      throw new Error('LocalLobbyProvider.enterGame: no character specified or selected')
    }

    let key = this.findCanonicalKey(rawName)
    if (key === undefined) {
      await this.createCharacter({ name: rawName, classId: 0 })
      key = this.findCanonicalKey(rawName)!
    }

    let d2sBytes = this.saves.get(key)!
    const parsed = readD2sSave113c(d2sBytes)

    const rawDifficulty =
      target && 'difficulty' in target && target.difficulty !== undefined
        ? target.difficulty
        : target && 'spec' in target && target.spec?.difficulty !== undefined
          ? target.spec.difficulty
          : parsed.activeDifficulty
    const requestedDifficulty = resolveDifficultyNum(rawDifficulty)

    let effectiveSeed =
      target && 'mapSeed' in target && target.mapSeed !== undefined && target.mapSeed !== 0
        ? (target.mapSeed >>> 0)
        : (parsed.mapSeed >>> 0)

    if (
      (target === undefined || !('mapSeed' in target) || target.mapSeed === undefined) &&
      (requestedDifficulty !== parsed.activeDifficulty || effectiveSeed === 0)
    ) {
      const baseSeed = ((parsed.mapSeed >>> 0) ^ ((requestedDifficulty + 1) * 0x9e3779b9)) >>> 0
      const rng = new D2Rng(baseSeed || 1)
      effectiveSeed = (rng.nextUint32() >>> 0) || 1
      if (effectiveSeed === (parsed.mapSeed >>> 0)) {
        effectiveSeed = ((effectiveSeed + 0x13579bdf) >>> 0) || 1
      }
    }

    if (
      requestedDifficulty !== parsed.activeDifficulty ||
      effectiveSeed !== (parsed.mapSeed >>> 0)
    ) {
      d2sBytes = writeD2sSave113c(
        {
          ...parsed,
          activeDifficulty: requestedDifficulty,
          mapSeed: effectiveSeed,
        },
        getServerItemDataTables(),
      )
      this.saves.set(key, new Uint8Array(d2sBytes))
    }

    const areaLevelSource =
      target && 'areaLevelSource' in target ? target.areaLevelSource : undefined

    return new LocalLoopbackAdapter({
      charName: key,
      d2s: d2sBytes,
      difficulty: requestedDifficulty,
      mapSeed: effectiveSeed,
      playersX: this.persistedPlayersX,
      onPlayersXChange: (nextPlayersX) => {
        this.persistedPlayersX = nextPlayersX
      },
      registry: this.registry,
      resolveAreaBootstrap: areaLevelSource ? createAreaBootstrapResolver(areaLevelSource) : undefined,
      onAutoSave: (updatedBytes) => {
        this.saves.set(key!, new Uint8Array(updatedBytes))
      },
    })
  }

  async enterSinglePlayerGame(
    charNameOrOptions?:
      | string
      | {
          readonly charName?: string | undefined
          readonly difficulty?: 0 | 1 | 2 | undefined
          readonly mapSeed?: number | undefined
        },
  ): Promise<LocalLoopbackAdapter> {
    if (typeof charNameOrOptions === 'string') {
      return this.enterGame({ charName: charNameOrOptions })
    }
    return this.enterGame(charNameOrOptions)
  }

  async leaveGame(): Promise<void> {
    // Handled by adapter.leave() / adapter.close()
  }

  async listGames(_filter?: string | ListGamesOptions, _opts?: ListGamesOptions): Promise<readonly GameSummary[]> {
    return this.gamesList
  }

  async getGames(): Promise<readonly GameSummary[]> {
    return this.gamesList
  }

  async createGame(
    spec: Omit<GameCreateSpec, 'difficulty'> & { readonly difficulty?: GameDifficulty | undefined },
  ): Promise<LobbyEnterGameTarget & { readonly ok: boolean }> {
    const diffNum = resolveDifficultyNum(spec.difficulty)
    this.gamesList.push({
      name: spec.name,
      description: spec.description ?? '',
      playerCount: 1,
      index: this.gamesList.length,
      status: 0,
    })
    return {
      ok: true,
      mode: 'single',
      gameHash: this.defaultMapSeed,
      gameToken: 1,
      gameName: spec.name,
      name: spec.name,
      difficulty: diffNum,
    }
  }

  async joinGame(formOrName: JoinGameForm | string, _password?: string): Promise<LobbyEnterGameTarget> {
    const name = typeof formOrName === 'string' ? formOrName : formOrName.name
    return {
      mode: 'single',
      gameHash: this.defaultMapSeed,
      gameToken: 1,
      gameName: name,
      name,
    }
  }

  async getGameInfo(name: string): Promise<GameInfoDetail> {
    return {
      name,
      status: 0,
      uptimeSec: 0,
      maxPlayers: 1,
      levelDiff: 99,
      players: [],
    }
  }

  async enterChat(): Promise<{ readonly channel: string }> {
    return { channel: 'Single Player' }
  }

  async sendChat(text: string): Promise<void> {
    this.chatEmitter.emit({
      eventId: 0x05,
      kind: 'talk',
      userFlags: 0,
      ping: 0,
      username: this.selectedCharName ?? 'LocalHero',
      text,
    })
  }

  onChatEvent(cb: (ev: ChatEvent) => void): () => void {
    return this.chatEmitter.on(cb)
  }

  async close(): Promise<void> {
    // No external socket to close
  }
}

export function createLocalLoopbackSession(
  req: LocalServerSessionRequest = {},
): LocalServerSessionHandle & { readonly gameAdapter: LocalLoopbackAdapter } {
  const diffNum = resolveDifficultyNum(req.difficulty)
  const adapter = new LocalLoopbackAdapter({
    charName: req.charName,
    classId: req.classId ?? req.charClass ?? req.charClassId ?? 0,
    level: req.charLevel,
    difficulty: diffNum,
    mapSeed: req.mapSeed,
    d2sBytes: req.d2sBytes,
    policy: req.allowPause !== undefined ? { allowPause: req.allowPause } : undefined,
    resolveAreaBootstrap: req.areaLevelSource
      ? createAreaBootstrapResolver(req.areaLevelSource)
      : undefined,
    onAutoSave:
      req.onSaveD2s && req.charName
        ? (bytes) => req.onSaveD2s!(req.charName!, bytes)
        : undefined,
  })
  return {
    adapter,
    gameAdapter: adapter,
    stepFrame(): void {
      adapter.stepFrame()
    },
    stepTick(): void {
      adapter.stepFrame()
    },
    setPaused(paused: boolean): void {
      adapter.setPaused(paused)
    },
    isPaused(): boolean {
      return adapter.isPaused()
    },
    getPlayersX(): number {
      return adapter.getPlayersX()
    },
    exportD2s(): Uint8Array {
      return adapter.exportD2s()
    },
    stop(): void {
      adapter.leave()
    },
  }
}

export function registerDefaultLocalServerHooks(
  options?: LocalLobbyProviderOptions,
): LocalLobbyProvider {
  const provider = new LocalLobbyProvider(options)
  registerLocalLobbyProvider(() => provider)
  registerLocalServerFactory((req) => createLocalLoopbackSession(req))
  return provider
}

// Auto-register default local server hooks on module import
registerDefaultLocalServerHooks()
