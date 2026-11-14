/**
 * Deterministic headless replica runner core (oracle differential testing, phase P2).
 *
 * Runs the authoritative TS game server (`GameInstance`, never the legacy `GameEngine`) on a fixed
 * frame step with no wall clock, applies frame-stamped D2GS C2S packets through the same decode path
 * a real client connection uses (`decodeD2gsC2sPacketToCommand`, `src/server/net/session.ts`), and
 * samples a `d2oracle/1` trace (`docs/oracle/trace-schema.md`) after every frame.
 *
 * Scenario format: `docs/oracle/scenario-schema.md`.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { D2DataRegistry } from '../../../src/common/data/data-registry.ts'
import type { MapService } from '../../../src/client/map/map-service.ts'
import { createMapServiceAreaLevelSource } from '../../../src/client/map/map-service-area-source.ts'
import { hexToBytes } from '../../../src/netproto/index.ts'
import { GameInstance } from '../../../src/server/engine/game-instance.ts'
import {
  setDotTraceObserver113c,
  setSUnitDmgTraceObserver113c,
  type SUnitDmgTraceEvent113c,
} from '../../../src/server/engine/combat-pipeline.ts'
import { SINGLE_PLAYER_POLICY } from '../../../src/server/engine/game-instance/constants-and-helpers.ts'
import type { GameInstanceHost } from '../../../src/server/engine/game-instance/host.ts'
import type {
  InternalMonsterRecord,
  InternalPlayerRecord,
} from '../../../src/server/engine/game-instance/types.ts'
import type { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { decodeD2gsC2sPacketToCommand } from '../../../src/server/net/session.ts'
import {
  isD2sNewCharacterHeader113c,
  readD2sNewCharacterHeader113c,
} from '../../../src/server/save/d2s-reader.ts'
import { createAreaBootstrapResolver } from '../../../src/server/world/area-bootstrap.ts'

export const TRACE_SCHEMA = 'd2oracle/1'
export const UNIT_FIELDS = ['id', 'class', 'mode', 'x', 'y', 'seedLo', 'seedHi', 'level'] as const
/** Same default stat set as the oracle hook (`tools/oracle/hook/d2oracle.c` `g_stat_ids`). */
export const DEFAULT_STAT_IDS: readonly number[] = [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

/** ItemStatCost ids the player record holds outside the `UnitStatList` (see `sampleStat`). */
const STAT_EXPERIENCE = 13
const STAT_GOLD = 14
const STAT_GOLDBANK = 15

export interface ReplicaScenarioInput {
  /** Frame whose update the packet is delivered before (oracle `on_pre_frame`: `dwGameFrame == F-1`). */
  readonly frame: number
  /** Raw D2GS C2S packet (opcode first), hex. */
  readonly c2s: string
}

export interface ReplicaScenario {
  readonly name: string
  /** Game init seed (`pGame->dwInitSeed`, oracle `-seed N`); also the DRLG map seed. */
  readonly seed: number
  /** Repo-relative (or absolute) path of the 1.13c `.d2s` to load as the single player. */
  readonly save: string
  readonly difficulty: 0 | 1 | 2
  /** Number of frames to simulate (trace frames `1..frames`). */
  readonly frames: number
  readonly inputs: readonly ReplicaScenarioInput[]
  /** Optional stat id override (oracle `stats` scenario line); defaults to `DEFAULT_STAT_IDS`. */
  readonly statIds?: readonly number[] | undefined
}

export interface ReplicaEnvironment {
  readonly registry: D2DataRegistry
  readonly mapService: MapService
}

function fail(msg: string): never {
  throw new Error(`replica scenario: ${msg}`)
}

function isU32(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffffff
}

/** Validates a parsed scenario object (strict: unknown keys and malformed fields are errors). */
export function parseScenario(raw: unknown): ReplicaScenario {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) fail('expected a JSON object')
  const o = raw as Record<string, unknown>
  const known = new Set(['name', 'description', 'seed', 'save', 'difficulty', 'frames', 'inputs', 'statIds'])
  for (const k of Object.keys(o)) if (!known.has(k)) fail(`unknown key "${k}"`)
  if (typeof o.name !== 'string' || o.name === '') fail('"name" must be a non-empty string')
  if (o.description !== undefined && typeof o.description !== 'string') fail('"description" must be a string')
  if (!isU32(o.seed) || o.seed === 0) fail('"seed" must be a non-zero uint32')
  if (typeof o.save !== 'string' || o.save === '') fail('"save" must be a path string')
  if (o.difficulty !== 0 && o.difficulty !== 1 && o.difficulty !== 2) fail('"difficulty" must be 0, 1 or 2')
  if (typeof o.frames !== 'number' || !Number.isInteger(o.frames) || o.frames < 1) {
    fail('"frames" must be a positive integer')
  }
  const inputsRaw = o.inputs ?? []
  if (!Array.isArray(inputsRaw)) fail('"inputs" must be an array')
  const inputs: ReplicaScenarioInput[] = []
  let prevFrame = 0
  for (const [i, inp] of inputsRaw.entries()) {
    if (inp === null || typeof inp !== 'object') fail(`inputs[${i}] must be an object`)
    const { frame, c2s, note, ...rest } = inp as Record<string, unknown>
    for (const k of Object.keys(rest)) fail(`inputs[${i}]: unknown key "${k}"`)
    if (note !== undefined && typeof note !== 'string') fail(`inputs[${i}].note must be a string`)
    if (typeof frame !== 'number' || !Number.isInteger(frame) || frame < 1) {
      fail(`inputs[${i}].frame must be an integer >= 1`)
    }
    if (frame < prevFrame) fail(`inputs[${i}].frame ${frame} is not in ascending order`)
    if (typeof c2s !== 'string' || !/^([0-9a-fA-F]{2})+$/.test(c2s)) {
      fail(`inputs[${i}].c2s must be a non-empty hex string`)
    }
    prevFrame = frame
    inputs.push({ frame, c2s: c2s.toLowerCase() })
  }
  let statIds: number[] | undefined
  if (o.statIds !== undefined) {
    if (!Array.isArray(o.statIds) || o.statIds.some((s) => !Number.isInteger(s) || (s as number) < 0)) {
      fail('"statIds" must be an array of non-negative integers')
    }
    statIds = o.statIds as number[]
  }
  return {
    name: o.name,
    seed: o.seed >>> 0,
    save: o.save,
    difficulty: o.difficulty,
    frames: o.frames,
    inputs,
    statIds,
  }
}

export function loadScenarioFile(path: string): ReplicaScenario {
  return parseScenario(JSON.parse(readFileSync(path, 'utf8')))
}

/**
 * Loads the pinned data sources: the MPQ-built `D2DataRegistry` (`D2_DATA_DIR`, else `samples/d2`) and
 * the Node `MapService` over the packed DRLG bundle (`D2_ACT_PACKS_DIR`, else `public/act-packs/tiles`).
 * No embedded/test-grid fallback: a missing source is an error.
 */
export async function loadReplicaEnvironment(opts: {
  readonly mpqDir?: string | undefined
  readonly packsDir?: string | undefined
} = {}): Promise<ReplicaEnvironment> {
  const { getSharedDataRegistry, DEFAULT_NODE_MPQ_DIR } = await import(
    '../../../src/baker/mpq-archive-source.ts'
  )
  await import('../../lib/node-map-loader.ts')
  const { MapService } = await import('../../../src/client/map/map-service.ts')
  const registry = getSharedDataRegistry(opts.mpqDir ?? DEFAULT_NODE_MPQ_DIR)
  const mapService = await MapService.fromPackedDir(
    opts.packsDir ?? process.env.D2_ACT_PACKS_DIR ?? 'public/act-packs/tiles',
  )
  return { registry, mapService }
}

/**
 * Sub-tile coordinate as the 1.13c dynamic path reports it (`wPosX` = integer part of the 16.16
 * precise position). 1.13c places a unit at the sub-tile centre (`PATH_AllocDynamicPath` 0x6FD86030:
 * precise = `(n << 16) + 0x8000`), while TS logical `N.0` is the centre of sub-tile N
 * (`movement-predictor.ts`; the server's wire position is `Math.round`, `playerWirePosition`), so
 * `wPosX = floor(x_ts + 0.5)`.
 */
function subtile(v: number): number {
  return Math.floor(v + 0.5)
}

/**
 * Accrued stat read without leaving side effects in the engine: the combat context is the server's
 * own re-sync of the stat list from the authoritative record (the same call the engine makes every
 * time it needs accrued stats); if the unit had no context yet, the temporary one is discarded again.
 */
function withPlayerStatList<T>(host: GameInstanceHost, p: InternalPlayerRecord, fn: (st: UnitStatList) => T): T {
  const had = host.playerCombat.has(p.unitId)
  try {
    return fn(host.playerCombatContext(p).statList)
  } finally {
    if (!had) host.playerCombat.delete(p.unitId)
  }
}

function withMonsterStatList<T>(host: GameInstanceHost, m: InternalMonsterRecord, fn: (st: UnitStatList) => T): T {
  const had = host.monsterCombat.has(m.unitId)
  try {
    return fn(host.monsterCombatContext(m).statList)
  } finally {
    if (!had) host.monsterCombat.delete(m.unitId)
  }
}

function withMercStatList<T>(
  host: GameInstanceHost,
  m: Parameters<GameInstanceHost['mercCombatContext']>[0],
  fn: (st: UnitStatList) => T,
): T {
  const had = host.mercCombat.has(m.unitId)
  try {
    return fn(host.mercCombatContext(m).statList)
  } finally {
    if (!had) host.mercCombat.delete(m.unitId)
  }
}

/**
 * Player stat value in raw 1.13c storage (`STATLIST_GetUnitStat(unit, id, 0)`): the `UnitStatList`
 * already keeps hitpoints/maxhp/mana/maxmana/stamina/maxstamina in `<<8` fixed point (`FIXED_ONE`).
 * experience/gold/goldbank are not mirrored into the stat list by `playerCombatContext`; the player
 * record is their authoritative store (no modifiers apply to them).
 */
function samplePlayerStats(st: UnitStatList, p: InternalPlayerRecord, statIds: readonly number[]): number[] {
  return statIds.map((id) => {
    if (id === STAT_EXPERIENCE) return p.experience
    if (id === STAT_GOLD) return p.gold
    if (id === STAT_GOLDBANK) return p.goldBank
    return Math.trunc(st.getAccruedStat(id))
  })
}

function sampleMonsterStats(st: UnitStatList, statIds: readonly number[]): number[] {
  return statIds.map((id) => Math.trunc(st.getAccruedStat(id)))
}

/** `States.txt` row 105 `alignment` (`SUNIT_SetAlignment` `0x6FD004B0`), active on every player & monster. */
const STATE_ALIGNMENT_113C = 105

type Row = (number | null)[]

/** `[seedLo, seedHi]` of a unit's `D2SeedStrc` (`D2UnitStrc+0x20/+0x24`), or nulls when it has none. */
function unitSeed(host: GameInstanceHost, unitType: number, unitId: number): [number | null, number | null] {
  const seed = host.unitSeeds.get(`${unitType}:${unitId}`)
  return seed === undefined ? [null, null] : [seed.lo >>> 0, seed.hi >>> 0]
}

function collectActiveStateIds(rawStates: ReadonlySet<number>, st: UnitStatList): number[] {
  const set = new Set<number>([STATE_ALIGNMENT_113C])
  for (const id of rawStates) {
    if (Number.isInteger(id) && id > 0) set.add(id)
  }
  for (const mod of st.getActiveModifiers()) {
    if (Number.isInteger(mod.stateId) && mod.stateId > 0) set.add(mod.stateId)
  }
  return [...set].sort((a, b) => a - b)
}

function byId(a: Row, b: Row): number {
  return (a[0] as number) - (b[0] as number)
}

/** Samples one trace frame line (`t0` players, `t1` monsters/NPCs, `t3` missiles, `gs`, `st`, `dmg`), rows sorted by id. */
export function sampleFrame(
  game: GameInstance,
  statIds: readonly number[],
  injected: readonly (readonly [number, string])[],
  dmgEvents: readonly SUnitDmgTraceEvent113c[] = [],
  dotEvents: readonly (readonly [number, number, number, number])[] = [],
): string {
  const host = game as unknown as GameInstanceHost
  const t0: Row[] = []
  const st0: number[][] = []
  for (const p of host.players.values()) {
    const { stats, states } = withPlayerStatList(host, p, (st) => ({
      stats: samplePlayerStats(st, p, statIds),
      states: collectActiveStateIds(p.states, st),
    }))
    t0.push([p.unitId, p.classId, p.mode, subtile(p.x), subtile(p.y), ...unitSeed(host, 0, p.unitId), p.areaId, ...stats])
    if (states.length > 0) st0.push([0, p.unitId, ...states])
  }
  const t1: Row[] = []
  const st1: number[][] = []
  for (const m of host.monsters.values()) {
    const { stats, states } = withMonsterStatList(host, m, (st) => ({
      stats: sampleMonsterStats(st, statIds),
      states: collectActiveStateIds(m.states, st),
    }))
    t1.push([m.unitId, m.classId, m.mode, subtile(m.x), subtile(m.y), ...unitSeed(host, 1, m.unitId), m.areaId, ...stats])
    if (states.length > 0) st1.push([1, m.unitId, ...states])
  }
  for (const m of host.mercenaries.values()) {
    const { stats, states } = withMercStatList(host, m, (st) => ({
      stats: sampleMonsterStats(st, statIds),
      states: collectActiveStateIds(m.states, st),
    }))
    const mercMode = !m.alive
      ? 12
      : m.mode ?? (m.state === 'attack' ? 4 : m.state === 'follow' || m.state === 'chase' ? 2 : 1)
    t1.push([m.unitId, m.classId, mercMode, subtile(m.x), subtile(m.y), ...unitSeed(host, 1, m.unitId), m.areaId, ...stats])
    if (states.length > 0) st1.push([1, m.unitId, ...states])
  }
  for (const [petUnitId, vis] of host.petVisualStates.entries()) {
    if (vis.pet.alive === false || vis.pet.hp <= 0) continue
    const stats = sampleMonsterStats(vis.pet.statList, statIds)
    const states = collectActiveStateIds(vis.states, vis.pet.statList)
    const petMode = (vis.pet as unknown as { mode?: number }).mode ?? 1
    t1.push([petUnitId, vis.pet.classId ?? 363, petMode, subtile(vis.pet.x), subtile(vis.pet.y), ...unitSeed(host, 1, petUnitId), vis.areaId, ...stats])
    if (states.length > 0) st1.push([1, petUnitId, ...states])
  }
  const t3: Row[] = []
  for (const ms of host.missiles.values()) {
    // InternalMissileRecord has no dwMode equivalent -> null (consumers skip null columns).
    t3.push([ms.unitId, ms.missileId, null, subtile(ms.x), subtile(ms.y), ...unitSeed(host, 3, ms.unitId), ms.areaId])
  }
  t0.sort(byId)
  t1.sort(byId)
  t3.sort(byId)
  st0.sort((a, b) => a[1]! - b[1]!)
  st1.sort((a, b) => a[1]! - b[1]!)
  const stAll = [...st0, ...st1]
  const line: Record<string, unknown> = {
    frame: game.tickCount,
    t0,
    t1,
    t3,
    gs: [host.gameSeed.lo >>> 0, host.gameSeed.hi >>> 0],
    st: stAll,
  }
  if (dmgEvents.length > 0) line.dmg = dmgEvents
  if (dotEvents.length > 0) line.dot = dotEvents
  if (injected.length > 0) line.in = injected.map(([pid, hex]) => [pid, hex])
  return JSON.stringify(line)
}

/**
 * Delivers one C2S packet to the player exactly like `RoomClientSession` (in-game state) +
 * `MultiClientRoomHost.handleClientCommand`: `0x6D` ping and decoded `Ping` are answered outside the
 * frame (no simulation effect); everything else is decoded and enqueued for the next `stepFrame`.
 */
function deliverC2s(game: GameInstance, playerUnitId: number, hex: string): void {
  const pkt = hexToBytes(hex)
  const op = pkt[0]!
  if (op === 0x6d) return
  if (op === 0x68 || op === 0x6b) {
    throw new Error(`replica: C2S 0x${op.toString(16)} is a handshake packet, not an in-game input`)
  }
  const cmd = decodeD2gsC2sPacketToCommand(pkt)
  if (cmd === null) throw new Error(`replica: C2S packet ${hex} is not decodable by the D2GS server path`)
  if (cmd.type === 'Ping') return
  if (cmd.type === 'LeaveGame') throw new Error('replica: LeaveGame inputs are not supported')
  game.enqueueCommand(playerUnitId, cmd)
}

/**
 * Connects the scenario's single player.
 *
 * - Full v96 save: `connectPlayer({ d2s })` exactly like `LocalLoopbackAdapter` (merc restored).
 * - Header-only save (335 bytes, written by the original front end at character creation, never
 *   entered a game): `GameInstance.connectPlayer` only parses full saves, so the header's name /
 *   class / level / status flags are passed to its fresh-character path, which is what the original
 *   does on first entry (character built from `CharStats.txt`; see docs/oracle/scenario-schema.md).
 *
 * Map seed rule (docs/oracle/scenario-schema.md §Seeds): the scenario seed is the game init seed
 * (`-seed N` on the oracle) and is always passed explicitly. A save whose header map seed is non-zero
 * and differs from it is rejected, because how 1.13c reconciles the two is not established.
 */
function connectScenarioPlayer(game: GameInstance, d2s: Uint8Array, seed: number): number {
  const headerSeed = d2s.byteLength >= 0xaf ? new DataView(d2s.buffer, d2s.byteOffset).getUint32(0xab, true) >>> 0 : 0
  if (headerSeed !== 0 && headerSeed !== seed) {
    throw new Error(
      `replica: save header map seed ${headerSeed} != scenario seed ${seed}; set "seed" to the save's map seed`,
    )
  }
  if (isD2sNewCharacterHeader113c(d2s)) {
    const h = readD2sNewCharacterHeader113c(d2s)
    return game.connectPlayer({
      charName: h.name,
      classId: h.classId,
      level: h.level,
      statusFlags: h.statusFlags,
      startingItems: 'charstats',
    })
  }
  return game.connectPlayer({ d2s, restoreMercenary: true })
}

export interface ReplicaRunResult {
  readonly lines: readonly string[]
  readonly playerUnitId: number
  readonly mapSeed: number
  /** `GameInstance.computeFrameLockstepHash()` after the last frame. */
  readonly lockstepHash: number
}

/**
 * Runs a scenario to completion and returns the trace lines (header first). Pure function of
 * (scenario, save bytes, environment data): fixed-step `GameInstance.stepFrame()`, no clock reads.
 */
export function runReplica(
  scenario: ReplicaScenario,
  env: ReplicaEnvironment,
  opts: {
    readonly repoRoot?: string | undefined
    readonly onLine?: ((line: string) => void) | undefined
    /** `false` skips per-frame sampling (used to prove sampling does not perturb the simulation). */
    readonly observe?: boolean | undefined
    /** Diagnostics: called before frame `f` is simulated (after its inputs are enqueued). */
    readonly beforeFrame?: ((frame: number, game: GameInstance) => void) | undefined
    /** Diagnostics: called after frame `f` is simulated and sampled. */
    readonly afterFrame?: ((frame: number, game: GameInstance) => void) | undefined
  } = {},
): ReplicaRunResult {
  const savePath = resolve(opts.repoRoot ?? process.cwd(), scenario.save)
  const d2s = new Uint8Array(readFileSync(savePath))
  const statIds = scenario.statIds ?? DEFAULT_STAT_IDS

  // Mirrors LocalLoopbackAdapter's single-player construction (src/server/loopback-adapter.ts),
  // but with an explicit map seed (never the lobby's crypto/singleton seed) and the Node MapService
  // level source pinned through the server-side area bootstrap.
  const game = new GameInstance({
    mode: 'singlePlayer',
    policy: SINGLE_PLAYER_POLICY,
    difficulty: scenario.difficulty,
    mapSeed: scenario.seed,
    animActionWindup: true,
    registry: env.registry,
    drlgEnv: env.mapService.getDrlgEnv(),
    resolveAreaBootstrap: createAreaBootstrapResolver(createMapServiceAreaLevelSource(env.mapService)),
  })
  if (game.mapSeed !== scenario.seed) {
    throw new Error(`replica: game map seed ${game.mapSeed} != scenario seed ${scenario.seed}`)
  }
  const playerUnitId = connectScenarioPlayer(game, d2s, scenario.seed)
  if (game.mapSeed !== scenario.seed) {
    throw new Error(`replica: .d2s re-seeded the game (${game.mapSeed}); explicit seed must win`)
  }
  game.drainEvents(playerUnitId)

  const lines: string[] = []
  const emit = (line: string): void => {
    lines.push(line)
    opts.onLine?.(line)
  }
  emit(
    JSON.stringify({
      schema: TRACE_SCHEMA,
      source: 'replica',
      initSeed: scenario.seed,
      dot: true,
      unitFields: UNIT_FIELDS,
      statIds,
      scenario: scenario.name,
    }),
  )

  let nextInput = 0
  for (let f = 1; f <= scenario.frames; f++) {
    const injected: [number, string][] = []
    while (nextInput < scenario.inputs.length && scenario.inputs[nextInput]!.frame <= f) {
      const inp = scenario.inputs[nextInput++]!
      deliverC2s(game, playerUnitId, inp.c2s)
      injected.push([playerUnitId, inp.c2s])
    }
    const frameDmg: SUnitDmgTraceEvent113c[] = []
    const frameDot: [number, number, number, number][] = []
    if (opts.observe !== false) {
      setSUnitDmgTraceObserver113c((ev) => {
        frameDmg.push(ev)
      })
      setDotTraceObserver113c((ev) => {
        frameDot.push([ev.unitType, ev.unitId, ev.hp0, ev.hp1])
      })
    }
    opts.beforeFrame?.(f, game)
    try {
      game.stepFrame()
    } finally {
      if (opts.observe !== false) {
        setSUnitDmgTraceObserver113c(null)
        setDotTraceObserver113c(null)
      }
    }
    // Outbox is only copied by stepFrame; drain so per-player event queues do not grow unbounded.
    game.drainEvents(playerUnitId)
    if (game.tickCount !== f) {
      throw new Error(`replica: frame counter ${game.tickCount} != expected ${f} (paused game?)`)
    }
    if (opts.observe !== false) emit(sampleFrame(game, statIds, injected, frameDmg, frameDot))
    opts.afterFrame?.(f, game)
  }
  return { lines, playerUnitId, mapSeed: game.mapSeed, lockstepHash: game.computeFrameLockstepHash() }
}

