/**
 * @file src/server/net/local-kernel-d2gs-adapter-113c.ts
 * `[K5]` Single-Player `d2kern-113c` runtime `GameServerAdapter` (`LocalKernelD2gsAdapter113c`).
 *
 * Bridges the live Single-Player client (`OnlineSession` / `play.html`) directly to `src/d2kern-113c/`
 * through `D2gsKernelBridge113c` + a real `D2gsSession` + `D2gsAdapter` over an in-memory `ByteStream`
 * (`MemoryStream` pair) using 1.13c `[0xAF, 0x01]` + `Fog.#10223` Huffman wire framing.
 *
 * Strictly isomorphic & deterministic:
 * - Zero DOM globals, zero Node built-ins, zero `Math.random()` or wall-clock calls.
 * - Imports `src/netproto/index.ts` and `src/d2kern-113c/**` one-way (leaving `src/d2kern-113c/**` 100% pure).
 */

import { CANONICAL_CHARSTATS, type CharacterClassCode } from '../../common/units/classes.ts'
import { hasMonStats2Flag, MONSTATS2_FLAGINDEX } from '../../common/units/monstats2-flags.ts'
import { WAYPOINT_CLASS_IDS_113C } from '../../common/world/objects-meta.ts'
import {
  SKILLS_GetLeftSkillFromSkillList113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillLevel113c,
} from '../../d2kern-113c/common/skills.ts'
import { STATLIST_GetUnitStat113c } from '../../d2kern-113c/common/statlist.ts'
import { D2SkillListStrc, D2UnitStrc } from '../../d2kern-113c/mem/layout.generated.ts'
import {
  TypedEmitter,
  type CharClassId,
  type ClientCommand,
  type CloseReason,
  type D2gsAdapter,
  type D2gsSession,
  type GameServerAdapter,
  type GameServerStats,
  type ItemDataTables,
  type LocalAreaBootstrap,
  type LocalAreaBootstrapResolver,
  type LocalAreaLevelSource,
  type MemoryStream,
  type ServerEvent,
} from '../../netproto/index.ts'
import {
  getServerItemDataTables,
  readD2sSave113c,
  type D2sCharacterData,
} from '../save/d2s-reader.ts'
import {
  createDefaultNpcIntroData,
  createDefaultQuestData,
  createDefaultWaypointData,
  writeD2sSave113c,
} from '../save/d2s-writer.ts'
import { createAreaBootstrapResolver } from '../world/area-bootstrap.ts'
import {
  D2GS_KERNEL_FRAME_MS_113C,
  D2gsKernelBridge113c,
  SERVER_ONLY_NPC_SPAWNER_OBJECT_IDS_113C,
  WAYPOINT_AREA_IDS_113C,
  areaIdToActIdx113c,
  requireCharClassCode113c,
  requireClassSkillBase113c,
  requireTownAreaForAct113c,
  requireValidCharClassId113c,
  requireValidDifficulty113c,
  type D2gsBridgeClientHandle113c,
} from './d2gs-kernel-bridge-113c.ts'

const MAX_KERNEL_CATCHUP_FRAMES = 5
const FIXED_ONE_113C = 256

const CLASS_CODE_TO_ID_113C: Readonly<Record<string, CharClassId>> = {
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

function resolveCharClassId113c(
  raw: CharClassId | CharacterClassCode | number | string | undefined,
): CharClassId {
  if (raw === undefined) return 0
  if (typeof raw === 'number') {
    return requireValidCharClassId113c(raw)
  }
  const trimmed = raw.trim().toLowerCase()
  const mapped = CLASS_CODE_TO_ID_113C[trimmed]
  if (mapped !== undefined) return mapped
  if (/^[0-6]$/.test(trimmed)) {
    return Number(trimmed) as CharClassId
  }
  throw new RangeError(`Invalid 1.13c character class specifier: "${raw}"`)
}

function isWaypointUnlockedInRawD2s(
  waypointsRaw: Uint8Array | undefined,
  difficulty: 0 | 1 | 2,
  areaId: number,
): boolean {
  const wpIdx = WAYPOINT_AREA_IDS_113C.indexOf(areaId)
  if (wpIdx < 0) return false
  if (waypointsRaw === undefined || waypointsRaw.byteLength < 80) {
    return wpIdx === 0
  }
  const byteIdx = 8 + difficulty * 24 + 2 + (wpIdx >> 3)
  const bitMask = 1 << (wpIdx & 7)
  return byteIdx < waypointsRaw.byteLength && (waypointsRaw[byteIdx]! & bitMask) !== 0
}

export interface LocalKernelD2gsAdapterOptions113c {
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
  readonly allowPause?: boolean | undefined
  readonly d2s?: Uint8Array | undefined
  readonly d2sBytes?: Uint8Array | undefined
  readonly onAutoSave?: ((d2sBytes: Uint8Array) => void) | undefined
  readonly areaLevelSource?: LocalAreaLevelSource | undefined
  readonly resolveAreaBootstrap?: LocalAreaBootstrapResolver | undefined
  readonly tables?: ItemDataTables | undefined
}

/**
 * Single-Player `GameServerAdapter` backed by `D2gsKernelBridge113c` (`src/d2kern-113c/`) +
 * `D2gsSession` + `D2gsAdapter` over an in-memory `ByteStream` (`MemoryStream` pair).
 */
export class LocalKernelD2gsAdapter113c implements GameServerAdapter {
  readonly kind = 'd2kern-113c' as const
  readonly bridge: D2gsKernelBridge113c
  readonly d2gsAdapter: D2gsAdapter
  readonly session: D2gsSession
  readonly clientStream: MemoryStream
  readonly serverStream: MemoryStream
  readonly handle: D2gsBridgeClientHandle113c
  readonly playerUnitId: number

  private readonly closeEmitter = new TypedEmitter<CloseReason>()
  private readonly onAutoSave: ((d2sBytes: Uint8Array) => void) | undefined
  private readonly onPlayersXChange: ((playersX: number) => void) | undefined
  private readonly allowPause: boolean
  private readonly baseD2sParsed: D2sCharacterData | null
  private readonly charName: string
  private readonly charClass: CharClassId
  private readonly difficulty: 0 | 1 | 2
  readonly mapSeed: number
  private activeAct: 0 | 1 | 2 | 3 | 4

  private closed = false
  private paused = false
  private playersXValue: number
  private accumMs = 0
  private savedD2sBytes: Uint8Array | undefined

  constructor(options: LocalKernelD2gsAdapterOptions113c = {}) {
    const rawD2s = options.d2s !== undefined ? options.d2s : options.d2sBytes
    const parsedD2s = rawD2s !== undefined ? readD2sSave113c(rawD2s) : null
    this.baseD2sParsed = parsedD2s
    this.onAutoSave = options.onAutoSave
    this.onPlayersXChange = options.onPlayersXChange
    this.allowPause = options.allowPause !== false

    const resolvedName =
      options.charName !== undefined
        ? options.charName
        : options.playerName !== undefined
          ? options.playerName
          : options.name !== undefined
            ? options.name
            : parsedD2s !== null
              ? parsedD2s.name
              : 'Hero'
    this.charName = resolvedName

    const rawClass =
      options.classId !== undefined
        ? options.classId
        : options.charClass !== undefined
          ? options.charClass
          : parsedD2s !== null
            ? parsedD2s.charClass
            : 0
    this.charClass = resolveCharClassId113c(rawClass)

    const diff: 0 | 1 | 2 = requireValidDifficulty113c(
      options.difficulty !== undefined
        ? options.difficulty
        : parsedD2s !== null
          ? parsedD2s.activeDifficulty
          : 0,
    )
    this.difficulty = diff

    const rawSeed =
      options.mapSeed !== undefined
        ? options.mapSeed
        : options.seed !== undefined
          ? options.seed
          : parsedD2s !== null && parsedD2s.mapSeed !== 0
            ? parsedD2s.mapSeed
            : 0x12345678
    this.mapSeed = (rawSeed >>> 0) || 1

    const initialPlayersX =
      options.playersX !== undefined
        ? Math.max(1, Math.min(8, Math.floor(Number(options.playersX) || 1)))
        : 1
    this.playersXValue = initialPlayersX

    const defaultAct = parsedD2s !== null ? parsedD2s.activeAct : 0
    const defaultTownArea = requireTownAreaForAct113c(defaultAct)
    const targetAreaId = options.areaId !== undefined ? options.areaId : defaultTownArea
    const actIdx = areaIdToActIdx113c(targetAreaId)
    this.activeAct = actIdx

    const resolver =
      options.resolveAreaBootstrap !== undefined
        ? options.resolveAreaBootstrap
        : options.areaLevelSource !== undefined
          ? createAreaBootstrapResolver(options.areaLevelSource)
          : undefined

    const rawBootstrap =
      resolver !== undefined
        ? resolver({
            act: actIdx + 1,
            areaId: targetAreaId,
            mapSeed: this.mapSeed,
            difficulty: this.difficulty,
          })
        : null
    const bootstrap: LocalAreaBootstrap | null =
      rawBootstrap !== undefined && rawBootstrap !== null ? rawBootstrap : null

    const roomSubW =
      bootstrap !== null && bootstrap.subWidth !== undefined && bootstrap.subWidth > 0
        ? bootstrap.subWidth
        : 80
    const roomSubH =
      bootstrap !== null && bootstrap.subHeight !== undefined && bootstrap.subHeight > 0
        ? bootstrap.subHeight
        : 80
    const roomSubX =
      bootstrap !== null
        ? bootstrap.originX !== undefined
          ? bootstrap.originX
          : Math.max(0, bootstrap.spawnX - (roomSubW >> 1))
        : 5520
    const roomSubY =
      bootstrap !== null
        ? bootstrap.originY !== undefined
          ? bootstrap.originY
          : Math.max(0, bootstrap.spawnY - (roomSubH >> 1))
        : 5880
    const spawnX =
      options.x !== undefined
        ? options.x
        : bootstrap !== null
          ? bootstrap.spawnX
          : roomSubX + (roomSubW >> 1)
    const spawnY =
      options.y !== undefined
        ? options.y
        : bootstrap !== null
          ? bootstrap.spawnY
          : roomSubY + (roomSubH >> 1)

    const collisionMaskAt =
      bootstrap !== null
        ? (sx: number, sy: number): number => {
            const lx = (sx | 0) - roomSubX
            const ly = (sy | 0) - roomSubY
            if (lx < 0 || ly < 0 || lx >= roomSubW || ly >= roomSubH) {
              return 0x0001
            }
            if (
              bootstrap.collision !== undefined &&
              bootstrap.originX !== undefined &&
              bootstrap.originY !== undefined
            ) {
              return bootstrap.collision[ly * roomSubW + lx]! & 0xffff
            }
            return bootstrap.isWalkable(targetAreaId, sx, sy) ? 0x0000 : 0x0001
          }
        : undefined

    const statusFlags = parsedD2s !== null ? parsedD2s.statusFlags : 0x20
    const isExpansion = (statusFlags & 0x20) !== 0
    const isHardcore = (statusFlags & 0x04) !== 0
    const isLadder = (statusFlags & 0x40) !== 0

    let initialPlayerStats: Record<number, number> | undefined
    if (parsedD2s !== null) {
      const a = parsedD2s.attributes
      initialPlayerStats = {
        0: a.strength,
        1: a.energy,
        2: a.dexterity,
        3: a.vitality,
        4: a.statPts,
        5: a.skillPts,
        6: a.hitpointsFixed,
        7: a.maxHpFixed,
        8: a.manaFixed,
        9: a.maxManaFixed,
        10: a.staminaFixed,
        11: a.maxStaminaFixed,
        12: options.level !== undefined ? options.level : a.level,
        13: a.experience,
        14: a.gold,
        15: a.goldBank,
      }
    } else if (options.level !== undefined) {
      initialPlayerStats = { 12: options.level }
    }

    const leftSkill =
      parsedD2s !== null && parsedD2s.leftSkill !== undefined ? parsedD2s.leftSkill : 0
    const rightSkill =
      parsedD2s !== null && parsedD2s.rightSkill !== undefined ? parsedD2s.rightSkill : 0

    let initialSkillLevels: Record<number, number> | undefined
    if (parsedD2s !== null) {
      const classBase = requireClassSkillBase113c(this.charClass)
      initialSkillLevels = {}
      const count = Math.min(30, parsedD2s.skillLevels.length)
      for (let i = 0; i < count; i++) {
        initialSkillLevels[classBase + i] = parsedD2s.skillLevels[i]!
      }
    }

    this.bridge = new D2gsKernelBridge113c({
      initSeed: this.mapSeed,
      objectSeed: ((this.mapSeed ^ 0x9e3779b9) >>> 0) || 1,
      difficulty: this.difficulty,
      expansion: isExpansion,
      hardcore: isHardcore,
      ladder: isLadder,
      act: actIdx,
      areaId: targetAreaId,
      roomSubtileX: roomSubX,
      roomSubtileY: roomSubY,
      roomSubtileWidth: roomSubW,
      roomSubtileHeight: roomSubH,
      spawnX,
      spawnY,
      collisionMaskAt,
      ...(bootstrap !== null ? { extraRevealedRooms: bootstrap.rooms } : {}),
      ...(initialPlayerStats !== undefined ? { initialPlayerStats } : {}),
      ...(initialSkillLevels !== undefined ? { initialSkillLevels } : {}),
      ...(parsedD2s !== null ? { initialHotkeys: parsedD2s.hotkeys } : {}),
      ...(parsedD2s !== null ? { initialItems: parsedD2s.items } : {}),
      ...(parsedD2s !== null && parsedD2s.questsRaw !== undefined
        ? { initialQuestData: parsedD2s.questsRaw }
        : {}),
      ...(parsedD2s !== null && parsedD2s.waypointsRaw !== undefined
        ? { initialWaypointData: parsedD2s.waypointsRaw }
        : {}),
      ...(resolver !== undefined ? { resolveAreaBootstrap: resolver } : {}),
      onAreaChange: (_nextAreaId, nextAct) => {
        this.activeAct = nextAct
      },
      initialPlayersX,
      onPlayersXChange: (next) => {
        this.playersXValue = next
        if (this.onPlayersXChange !== undefined) {
          this.onPlayersXChange(next)
        }
      },
      initialLeftSkill: leftSkill,
      initialRightSkill: rightSkill,
      ...(parsedD2s !== null
        ? {
            initialWeaponSet: parsedD2s.activeWeapon === 1 ? (1 as const) : (0 as const),
            initialAltLeftSkill: parsedD2s.altLeftSkill ?? 0,
            initialAltRightSkill: parsedD2s.altRightSkill ?? 0,
          }
        : {}),
      tables: options.tables !== undefined ? options.tables : getServerItemDataTables(),
    })

    // Populate DRLG preset NPCs/monsters & town objects into SparseMemory113c prior to client handshake
    // so D2gsKernelBridge113c.enterGameAndSyncWorld streams them over the compressed ByteStream.
    if (bootstrap !== null) {
      for (let i = 0; i < bootstrap.monsters.length; i++) {
        const mon = bootstrap.monsters[i]!
        if (hasMonStats2Flag(mon.classId, MONSTATS2_FLAGINDEX.CRITTER)) continue
        this.bridge.spawnMonsterInRoom({
          classId: mon.classId,
          x: mon.x,
          y: mon.y,
          animMode: 1,
        })
      }
      const isInitialWpUnlocked = isWaypointUnlockedInRawD2s(
        parsedD2s?.waypointsRaw,
        this.difficulty,
        targetAreaId,
      )
      for (let i = 0; i < bootstrap.objects.length; i++) {
        const obj = bootstrap.objects[i]!
        if (SERVER_ONLY_NPC_SPAWNER_OBJECT_IDS_113C.has(obj.classId)) continue
        const isWp = obj.isWaypoint === true || WAYPOINT_CLASS_IDS_113C.has(obj.classId)
        const mode = isWp
          ? isInitialWpUnlocked
            ? 2
            : 0
          : obj.mode !== undefined
            ? obj.mode
            : 0
        this.bridge.spawnObjectInRoom({
          classId: obj.classId,
          x: obj.x,
          y: obj.y,
          mode,
        })
      }
    }

    const connected = this.bridge.connectD2gsAdapter({
      logon: {
        gameHash: this.mapSeed,
        gameToken: 1,
        charClass: this.charClass,
        versionByte: 0x0d,
        charName: this.charName,
      },
      tables: this.bridge.tables,
    })

    this.d2gsAdapter = connected.adapter
    this.session = connected.session
    this.clientStream = connected.clientStream
    this.serverStream = connected.serverStream
    this.handle = connected.handle
    this.playerUnitId = connected.handle.getPlayerUnitId()

    this.d2gsAdapter.onClose((reason) => {
      if (!this.closed) {
        this.closed = true
        this.closeEmitter.emit(reason)
      }
    })
  }

  get playerId(): number {
    return this.playerUnitId
  }

  get tickCount(): number {
    return this.bridge.frame
  }

  connect(): void {
    // Handshake already completed during construction; early S2C events flush on first onEvent().
  }

  get state(): 'loading' | 'ingame' | 'inGame' | 'closed' {
    if (this.closed) return 'closed'
    return this.d2gsAdapter.state
  }

  get lastSavedD2s(): Uint8Array | undefined {
    return this.savedD2sBytes
  }

  get stats(): GameServerStats {
    return this.d2gsAdapter.stats
  }

  getStats(): GameServerStats {
    return this.d2gsAdapter.stats
  }

  onEvent(cb: (ev: ServerEvent) => void): () => void {
    return this.d2gsAdapter.onEvent(cb)
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    return this.closeEmitter.on(cb)
  }

  send(cmd: ClientCommand): void {
    if (this.closed) return
    if (cmd.type === 'LeaveGame') {
      this.leave()
      return
    }
    if (cmd.type === 'PauseGame') {
      this.setPaused(cmd.paused)
      return
    }
    this.d2gsAdapter.send(cmd)
  }

  sendCommand(cmd: ClientCommand): void {
    this.send(cmd)
  }

  stepFrame(): number {
    if (this.closed) return this.bridge.frame
    if (this.paused) {
      this.bridge.pumpInboundQueues()
      return this.bridge.frame
    }
    return this.bridge.stepFrame()
  }

  stepFrames(count: number): number {
    if (this.closed || !Number.isFinite(count) || count <= 0) {
      return this.bridge.frame
    }
    const n = Math.floor(count)
    for (let i = 0; i < n; i++) {
      this.stepFrame()
    }
    return this.bridge.frame
  }

  tick(dtMs: number = D2GS_KERNEL_FRAME_MS_113C): number {
    if (this.closed) return 0
    if (dtMs > 0 && dtMs <= 10 && Number.isInteger(dtMs)) {
      this.stepFrames(dtMs)
      return dtMs
    }
    if (this.paused) {
      this.accumMs = 0
      this.bridge.pumpInboundQueues()
      return 0
    }
    const clampedDt = Math.max(
      0,
      Math.min(
        Number.isFinite(dtMs) ? dtMs : D2GS_KERNEL_FRAME_MS_113C,
        MAX_KERNEL_CATCHUP_FRAMES * D2GS_KERNEL_FRAME_MS_113C,
      ),
    )
    this.accumMs += clampedDt
    let steps = 0
    while (this.accumMs >= D2GS_KERNEL_FRAME_MS_113C && steps < MAX_KERNEL_CATCHUP_FRAMES) {
      this.accumMs -= D2GS_KERNEL_FRAME_MS_113C
      this.bridge.stepFrame()
      steps++
    }
    return steps
  }

  setPaused(paused: boolean): void {
    if (!this.allowPause) return
    this.paused = Boolean(paused)
    if (this.paused) {
      this.accumMs = 0
    }
  }

  isPaused(): boolean {
    return this.paused
  }

  getPlayersX(): number {
    return this.bridge.getPlayersX()
  }

  setPlayersX(value: number): number {
    return this.bridge.setPlayersX(value)
  }

  exportD2s(): Uint8Array {
    if (this.savedD2sBytes !== undefined && this.closed) {
      return this.savedD2sBytes
    }
    const pPlayer = this.handle.getPlayerPtr()
    const pClient = this.handle.pClient >>> 0
    const m = this.bridge.m
    const classCode = requireCharClassCode113c(this.charClass)
    const fallbackBase = CANONICAL_CHARSTATS[classCode]

    const readStat = (statId: number, fallback: number): number =>
      pPlayer !== 0 ? STATLIST_GetUnitStat113c(m, pPlayer, statId, 0) | 0 : fallback

    const base = this.baseD2sParsed

    let liveLeftSkill = base !== null && base.leftSkill !== undefined ? base.leftSkill : 0
    let liveRightSkill = base !== null && base.rightSkill !== undefined ? base.rightSkill : 0
    if (pPlayer !== 0) {
      const pSkillsList = m.get(pPlayer, D2UnitStrc.pSkills) >>> 0
      if (pSkillsList !== 0) {
        const pLeft = SKILLS_GetLeftSkillFromSkillList113c(m, pSkillsList) >>> 0
        if (pLeft !== 0) {
          const skId = SKILLS_GetSkillIdFromSkill113c(m, pLeft, 0, 0) | 0
          if (skId >= 0) liveLeftSkill = skId
        }
        const pRight = m.get(pSkillsList, D2SkillListStrc.pRightSkill) >>> 0
        if (pRight !== 0) {
          const skId = SKILLS_GetSkillIdFromSkill113c(m, pRight, 0, 0) | 0
          if (skId >= 0) liveRightSkill = skId
        }
      }
    }

    const classSkillBase = requireClassSkillBase113c(this.charClass)
    const liveSkills = new Uint8Array(30)
    for (let i = 0; i < 30; i++) {
      if (pPlayer !== 0) {
        const pSk = SKILLS_GetSkillById113c(m, pPlayer, classSkillBase + i, -1) >>> 0
        liveSkills[i] =
          pSk !== 0
            ? Math.max(0, Math.min(255, SKILLS_GetSkillLevel113c(m, pPlayer, pSk, 0) | 0))
            : 0
      } else if (base !== null && i < base.skillLevels.length) {
        liveSkills[i] = base.skillLevels[i]!
      }
    }

    const liveHotkeys: number[] = []
    for (let slot = 0; slot < 16; slot++) {
      if (pClient !== 0) {
        const slotAddr = (pClient + slot * 8) >>> 0
        const wSkillId = m.u16((slotAddr + 0x3dc) >>> 0) & 0xffff
        const bLeft = m.u8((slotAddr + 0x3de) >>> 0) & 0x01
        liveHotkeys.push(
          wSkillId === 0xffff
            ? 0xffff
            : (((wSkillId & 0x7fff) | (bLeft !== 0 ? 0x8000 : 0)) >>> 0),
        )
      } else {
        liveHotkeys.push(
          base !== null && slot < base.hotkeys.length ? base.hotkeys[slot]! >>> 0 : 0xffff,
        )
      }
    }

    const liveAct = this.bridge.currentAct
    this.activeAct = liveAct

    const baseQuests =
      base !== null && base.questsRaw !== undefined && base.questsRaw.byteLength >= 298
        ? base.questsRaw
        : createDefaultQuestData()
    const liveQuestsRaw = new Uint8Array(298)
    liveQuestsRaw.set(baseQuests.subarray(0, 298))
    if (pPlayer !== 0) {
      const liveQuestSlice = this.bridge.getPlayerQuestDataBytes(
        this.handle.clientId,
        this.difficulty,
      )
      liveQuestsRaw.set(liveQuestSlice, 10 + this.difficulty * 96)
    }

    const baseWaypoints =
      base !== null && base.waypointsRaw !== undefined && base.waypointsRaw.byteLength >= 80
        ? base.waypointsRaw
        : createDefaultWaypointData()
    const liveWaypointsRaw = new Uint8Array(80)
    liveWaypointsRaw.set(baseWaypoints.subarray(0, 80))
    if (pPlayer !== 0) {
      const liveWpSlice = this.bridge.getPlayerWaypointDataBytes(
        this.handle.clientId,
        this.difficulty,
      )
      liveWaypointsRaw.set(liveWpSlice, 8 + this.difficulty * 24)
    }

    let liveDifficultyLocation: Uint8Array | undefined
    if (base !== null && base.difficultyLocation !== undefined && base.difficultyLocation.byteLength >= 3) {
      liveDifficultyLocation = new Uint8Array(3)
      for (let d = 0; d < 3; d++) {
        liveDifficultyLocation[d] = base.difficultyLocation[d]! & 0x7f
      }
      liveDifficultyLocation[this.difficulty] = 0x80 | (liveAct & 0x07)
    }

    const swapState = this.bridge.getPlayerWeaponSwapState(this.handle.clientId)
    const liveItems =
      pPlayer !== 0
        ? this.bridge.getPlayerOwnedItems(this.handle.clientId)
        : base !== null
          ? base.items
          : []

    const bytes = writeD2sSave113c(
      {
        name: this.charName,
        classId: this.charClass,
        level: Math.max(1, readStat(12, base !== null ? base.level : 1)),
        statusFlags: base !== null ? base.statusFlags : 0x20,
        progression: base !== null ? base.progression : 0,
        activeWeapon: pPlayer !== 0 ? swapState.activeWeapon : (base !== null ? base.activeWeapon : 0),
        timestampSec: base !== null ? base.timestampSec : 0,
        ...(base !== null ? { createdTimestamp: base.createdTimestamp } : {}),
        ...(base !== null ? { lastPlayedTimestamp: base.lastPlayedTimestamp } : {}),
        hotkeys: liveHotkeys,
        leftSkill: liveLeftSkill,
        rightSkill: liveRightSkill,
        altLeftSkill:
          pPlayer !== 0
            ? swapState.altLeftSkill
            : base !== null && base.altLeftSkill !== undefined
              ? base.altLeftSkill
              : 0,
        altRightSkill:
          pPlayer !== 0
            ? swapState.altRightSkill
            : base !== null && base.altRightSkill !== undefined
              ? base.altRightSkill
              : 0,
        ...(base !== null ? { appearance: base.appearance } : {}),
        ...(liveDifficultyLocation !== undefined ? { difficultyLocation: liveDifficultyLocation } : {}),
        activeDifficulty: this.difficulty,
        activeAct: liveAct,
        mapSeed: this.mapSeed,
        ...(base !== null ? { merc: base.merc, mercItems: base.mercItems } : {}),
        questsRaw: liveQuestsRaw,
        waypointsRaw: liveWaypointsRaw,
        npcIntro:
          base !== null && base.npcIntro !== undefined
            ? base.npcIntro
            : createDefaultNpcIntroData(),
        attributes: {
          strength: readStat(0, fallbackBase.baseAttributes.strength),
          energy: readStat(1, fallbackBase.baseAttributes.energy),
          dexterity: readStat(2, fallbackBase.baseAttributes.dexterity),
          vitality: readStat(3, fallbackBase.baseAttributes.vitality),
          statPts: Math.max(0, readStat(4, 0)),
          newSkills: Math.max(0, readStat(5, 0)),
          hitpointsFixed: Math.max(
            FIXED_ONE_113C,
            readStat(6, fallbackBase.baseVitals.life * FIXED_ONE_113C),
          ),
          maxHpFixed: Math.max(
            FIXED_ONE_113C,
            readStat(7, fallbackBase.baseVitals.life * FIXED_ONE_113C),
          ),
          manaFixed: Math.max(0, readStat(8, fallbackBase.baseVitals.mana * FIXED_ONE_113C)),
          maxManaFixed: Math.max(0, readStat(9, fallbackBase.baseVitals.mana * FIXED_ONE_113C)),
          staminaFixed: Math.max(
            0,
            readStat(10, fallbackBase.baseVitals.stamina * FIXED_ONE_113C),
          ),
          maxStaminaFixed: Math.max(
            0,
            readStat(11, fallbackBase.baseVitals.stamina * FIXED_ONE_113C),
          ),
          level: Math.max(1, readStat(12, 1)),
          experience: Math.max(0, readStat(13, 0)),
          gold: Math.max(0, readStat(14, 0)),
          goldBank: Math.max(0, readStat(15, 0)),
        },
        skills: liveSkills,
        items: liveItems,
        corpseItems: base !== null && base.corpseItems !== undefined ? base.corpseItems : [],
        ...(base !== null && base.corpseX !== undefined ? { corpseX: base.corpseX } : {}),
        ...(base !== null && base.corpseY !== undefined ? { corpseY: base.corpseY } : {}),
        ironGolem: base !== null && base.ironGolem !== undefined ? base.ironGolem : null,
      },
      getServerItemDataTables(),
    )
    this.savedD2sBytes = bytes
    return bytes
  }

  leave(): void {
    if (this.closed) return
    try {
      const saved = this.exportD2s()
      if (this.onAutoSave !== undefined) {
        this.onAutoSave(saved)
      }
    } finally {
      this.closed = true
      this.accumMs = 0
      this.d2gsAdapter.leave()
      this.handle.close()
      this.closeEmitter.emit({ kind: 'local' })
    }
  }

  close(): void {
    this.leave()
  }
}
