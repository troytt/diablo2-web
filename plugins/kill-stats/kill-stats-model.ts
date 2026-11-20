/**
 * Pure data model, key normalization, G-counter merge, export builder, and strict import
 * validation for per-account, per-character monster kill statistics.
 */

import type { CharClassId } from '../../src/netproto/index.ts'
import {
  isCountableBossClass,
  isCountableKillClass,
} from './monster-kill-classes.ts'

export const KILL_STATS_FORMAT = 'd2web-kill-stats' as const
export const KILL_STATS_VERSION = 1 as const
export const KILL_STATS_DB_NAME = 'd2web-kill-stats' as const
export const KILL_STATS_DB_VERSION = 1 as const
export const KILL_STATS_CHANNEL_NAME = 'd2web-kill-stats' as const
export const SUPERUNIQUE_COUNT = 66 as const

export type KillDifficulty = 0 | 1 | 2
export type KillTallyKind = 'monster' | 'boss' | 'superunique'

export interface KillCharacterProfile {
  readonly charKey: string
  readonly host: string
  readonly realm: string
  readonly account: string
  readonly charName: string
  readonly charClass: CharClassId
  readonly level: number
  readonly hardcore: boolean
  readonly expansion: boolean
  readonly ladder: boolean
}

export interface KillCharacterRecord extends KillCharacterProfile {
  readonly firstSeenAt: number
  readonly lastSeenAt: number
}

export interface KillTallyDelta {
  readonly charKey: string
  readonly kind: KillTallyKind
  readonly difficulty: KillDifficulty
  readonly subject: number
  readonly count: number
  readonly soloCount: number
  readonly firstAt: number
  readonly lastAt: number
}

export interface KillTallyRecord extends KillTallyDelta {
  readonly id: string
  readonly replicaId: string
}

export interface KillStatsSnapshot {
  readonly replicaId: string
  readonly characters: readonly KillCharacterRecord[]
  readonly tallies: readonly KillTallyRecord[]
}

export interface KillStatsExportPayload {
  readonly format: typeof KILL_STATS_FORMAT
  readonly version: typeof KILL_STATS_VERSION
  readonly exportedAt: number
  readonly replicaId: string
  readonly characters: readonly KillCharacterRecord[]
  readonly tallies: readonly KillTallyRecord[]
}

export interface KillStatsImportSummary {
  readonly addedCharacters: number
  readonly updatedCharacters: number
  readonly addedTallies: number
  readonly updatedTallies: number
  readonly unchangedTallies: number
}

export interface KillStatsBroadcastMessage {
  readonly type: 'updated'
  readonly at: number
}

export class KillStatsImportError extends Error {
  readonly path: string

  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'KillStatsImportError'
    this.path = path
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

/**
 * Generates a RFC 4122 v4 UUID using `crypto.getRandomValues` so it works in insecure `http://`
 * contexts where `crypto.randomUUID` is unavailable.
 */
export function generateReplicaId(
  getRandomValues?: (array: Uint8Array) => Uint8Array,
): string {
  const bytes = new Uint8Array(16)
  if (getRandomValues) {
    getRandomValues(bytes)
  } else if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    throw new Error('crypto.getRandomValues is required to generate replicaId')
  }

  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  const hex: string[] = []
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i]!.toString(16).padStart(2, '0'))
  }
  return (
    `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-` +
    `${hex[4]}${hex[5]}-` +
    `${hex[6]}${hex[7]}-` +
    `${hex[8]}${hex[9]}-` +
    `${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
  )
}

/**
 * Computes canonical character key:
 * `JSON.stringify([host, realm, account, charName].map(s => s.trim().toLowerCase()))`
 */
export function computeCharKey(
  host: string,
  realm: string,
  account: string,
  charName: string,
): string {
  return JSON.stringify([host, realm, account, charName].map((s) => s.trim().toLowerCase()))
}

/**
 * Computes canonical per-replica G-counter tally key:
 * `JSON.stringify([replicaId, charKey, kind, difficulty, subject])`
 */
export function computeTallyId(
  replicaId: string,
  charKey: string,
  kind: KillTallyKind,
  difficulty: KillDifficulty,
  subject: number,
): string {
  return JSON.stringify([replicaId, charKey, kind, difficulty, subject])
}

/**
 * Computes replica-independent delta aggregation key:
 * `JSON.stringify([charKey, kind, difficulty, subject])`
 */
export function computeDeltaKey(
  charKey: string,
  kind: KillTallyKind,
  difficulty: KillDifficulty,
  subject: number,
): string {
  return JSON.stringify([charKey, kind, difficulty, subject])
}

/**
 * G-counter merge of two tally records with the same `id`:
 * - `count`: `Math.max(a.count, b.count)`
 * - `soloCount`: `Math.max(a.soloCount, b.soloCount)`
 * - `firstAt`: `Math.min(a.firstAt, b.firstAt)`
 * - `lastAt`: `Math.max(a.lastAt, b.lastAt)`
 */
export function mergeTallyRecords(a: KillTallyRecord, b: KillTallyRecord): KillTallyRecord {
  if (a.id !== b.id) {
    throw new Error(`Cannot merge tally records with different ids: ${a.id} vs ${b.id}`)
  }
  const count = Math.max(a.count, b.count)
  const soloCount = Math.min(count, Math.max(a.soloCount, b.soloCount))
  return {
    id: a.id,
    replicaId: a.replicaId,
    charKey: a.charKey,
    kind: a.kind,
    difficulty: a.difficulty,
    subject: a.subject,
    count,
    soloCount,
    firstAt: Math.min(a.firstAt, b.firstAt),
    lastAt: Math.max(a.lastAt, b.lastAt),
  }
}

function characterTieBreakKey(c: KillCharacterRecord): string {
  return JSON.stringify([
    c.level,
    c.charClass,
    c.hardcore ? 1 : 0,
    c.expansion ? 1 : 0,
    c.ladder ? 1 : 0,
    c.host,
    c.realm,
    c.account,
    c.charName,
  ])
}

/**
 * Last-writer-wins (LWW) merge of two character records with the same `charKey` by `lastSeenAt`
 * (with deterministic tie-breaking on equal `lastSeenAt` and `Math.min` on `firstSeenAt`).
 */
export function mergeCharacterRecords(
  a: KillCharacterRecord,
  b: KillCharacterRecord,
): KillCharacterRecord {
  if (a.charKey !== b.charKey) {
    throw new Error(
      `Cannot merge character records with different charKeys: ${a.charKey} vs ${b.charKey}`,
    )
  }
  let winner: KillCharacterRecord
  if (b.lastSeenAt > a.lastSeenAt) {
    winner = b
  } else if (a.lastSeenAt > b.lastSeenAt) {
    winner = a
  } else {
    winner = characterTieBreakKey(b) > characterTieBreakKey(a) ? b : a
  }
  return {
    charKey: winner.charKey,
    host: winner.host,
    realm: winner.realm,
    account: winner.account,
    charName: winner.charName,
    charClass: winner.charClass,
    level: winner.level,
    hardcore: winner.hardcore,
    expansion: winner.expansion,
    ladder: winner.ladder,
    firstSeenAt: Math.min(a.firstSeenAt, b.firstSeenAt),
    lastSeenAt: Math.max(a.lastSeenAt, b.lastSeenAt),
  }
}

export function upsertCharacterRecord(
  existing: KillCharacterRecord | undefined,
  profile: KillCharacterProfile,
  at: number,
): KillCharacterRecord {
  const incoming: KillCharacterRecord = {
    ...profile,
    firstSeenAt: at,
    lastSeenAt: at,
  }
  if (!existing) return incoming
  if (at >= existing.lastSeenAt) {
    return {
      ...profile,
      firstSeenAt: Math.min(existing.firstSeenAt, at),
      lastSeenAt: Math.max(existing.lastSeenAt, at),
    }
  }
  return mergeCharacterRecords(existing, incoming)
}

export function applyDeltaToTallyRecord(
  existing: KillTallyRecord | undefined,
  replicaId: string,
  delta: KillTallyDelta,
): KillTallyRecord {
  const id = computeTallyId(
    replicaId,
    delta.charKey,
    delta.kind,
    delta.difficulty,
    delta.subject,
  )
  if (!existing) {
    return {
      id,
      replicaId,
      charKey: delta.charKey,
      kind: delta.kind,
      difficulty: delta.difficulty,
      subject: delta.subject,
      count: delta.count,
      soloCount: delta.soloCount,
      firstAt: delta.firstAt,
      lastAt: delta.lastAt,
    }
  }
  const count = existing.count + delta.count
  const soloCount = Math.min(count, existing.soloCount + delta.soloCount)
  return {
    id,
    replicaId,
    charKey: delta.charKey,
    kind: delta.kind,
    difficulty: delta.difficulty,
    subject: delta.subject,
    count,
    soloCount,
    firstAt: Math.min(existing.firstAt, delta.firstAt),
    lastAt: Math.max(existing.lastAt, delta.lastAt),
  }
}

/**
 * Pure state transition applying a batch of in-game kill deltas for `character` onto `state`.
 */
export function applyDeltasToState(
  state: KillStatsSnapshot,
  character: KillCharacterProfile,
  deltas: readonly KillTallyDelta[],
  at?: number,
): KillStatsSnapshot {
  const charMap = new Map<string, KillCharacterRecord>()
  for (const c of state.characters) {
    charMap.set(c.charKey, c)
  }

  let latestDeltaAt = at ?? 0
  for (const d of deltas) {
    if (d.lastAt > latestDeltaAt) latestDeltaAt = d.lastAt
  }
  const effectiveAt =
    at !== undefined ? at : latestDeltaAt > 0 ? latestDeltaAt : 0

  charMap.set(
    character.charKey,
    upsertCharacterRecord(charMap.get(character.charKey), character, effectiveAt),
  )

  const tallyMap = new Map<string, KillTallyRecord>()
  for (const t of state.tallies) {
    tallyMap.set(t.id, t)
  }

  for (const delta of deltas) {
    if (delta.count <= 0) continue
    const id = computeTallyId(
      state.replicaId,
      delta.charKey,
      delta.kind,
      delta.difficulty,
      delta.subject,
    )
    const next = applyDeltaToTallyRecord(tallyMap.get(id), state.replicaId, delta)
    tallyMap.set(id, next)
  }

  return {
    replicaId: state.replicaId,
    characters: [...charMap.values()].sort((a, b) =>
      a.charKey < b.charKey ? -1 : a.charKey > b.charKey ? 1 : 0,
    ),
    tallies: [...tallyMap.values()].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
  }
}

/**
 * Builds a deterministically sorted export payload (`characters` by `charKey`, `tallies` by `id`).
 */
export function buildExportPayload(
  snapshot: KillStatsSnapshot,
  exportedAt: number,
): KillStatsExportPayload {
  const characters = [...snapshot.characters].sort((a, b) =>
    a.charKey < b.charKey ? -1 : a.charKey > b.charKey ? 1 : 0,
  )
  const tallies = [...snapshot.tallies].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )
  return {
    format: KILL_STATS_FORMAT,
    version: KILL_STATS_VERSION,
    exportedAt,
    replicaId: snapshot.replicaId,
    characters,
    tallies,
  }
}

function isRecordObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function isValidCharClass(val: unknown): val is CharClassId {
  return (
    typeof val === 'number' &&
    Number.isInteger(val) &&
    val >= 0 &&
    val <= 6
  )
}

function isValidDifficulty(val: unknown): val is KillDifficulty {
  return val === 0 || val === 1 || val === 2
}

function isValidTallyKind(val: unknown): val is KillTallyKind {
  return val === 'monster' || val === 'boss' || val === 'superunique'
}

/**
 * Strictly validates an entire import payload before any state mutation occurs.
 * Throws `KillStatsImportError` with the exact offending field path on any violation.
 */
export function validateImportPayload(rawInput: unknown): KillStatsExportPayload {
  let raw: unknown = rawInput
  if (typeof rawInput === 'string') {
    try {
      raw = JSON.parse(rawInput)
    } catch {
      throw new KillStatsImportError('$', 'Invalid JSON syntax')
    }
  }

  if (!isRecordObject(raw)) {
    throw new KillStatsImportError('$', 'Import payload must be a JSON object')
  }

  if (raw.format !== KILL_STATS_FORMAT) {
    throw new KillStatsImportError(
      'format',
      `Expected format "${KILL_STATS_FORMAT}", got ${JSON.stringify(raw.format)}`,
    )
  }

  if (raw.version !== KILL_STATS_VERSION) {
    throw new KillStatsImportError(
      'version',
      `Expected version ${KILL_STATS_VERSION}, got ${JSON.stringify(raw.version)}`,
    )
  }

  if (
    typeof raw.exportedAt !== 'number' ||
    !Number.isFinite(raw.exportedAt) ||
    raw.exportedAt < 0
  ) {
    throw new KillStatsImportError(
      'exportedAt',
      'exportedAt must be a non-negative finite number',
    )
  }

  if (!isValidUuid(raw.replicaId)) {
    throw new KillStatsImportError(
      'replicaId',
      'replicaId must be a valid UUID string',
    )
  }

  if (!Array.isArray(raw.characters)) {
    throw new KillStatsImportError('characters', 'characters must be an array')
  }

  if (!Array.isArray(raw.tallies)) {
    throw new KillStatsImportError('tallies', 'tallies must be an array')
  }

  const seenCharKeys = new Set<string>()
  const validatedCharacters: KillCharacterRecord[] = []

  for (let i = 0; i < raw.characters.length; i++) {
    const c = raw.characters[i]
    const basePath = `characters[${i}]`
    if (!isRecordObject(c)) {
      throw new KillStatsImportError(basePath, 'Character entry must be an object')
    }

    if (typeof c.host !== 'string' || c.host.trim().length === 0) {
      throw new KillStatsImportError(`${basePath}.host`, 'host must be a non-empty string')
    }
    if (typeof c.realm !== 'string' || c.realm.trim().length === 0) {
      throw new KillStatsImportError(`${basePath}.realm`, 'realm must be a non-empty string')
    }
    if (typeof c.account !== 'string' || c.account.trim().length === 0) {
      throw new KillStatsImportError(`${basePath}.account`, 'account must be a non-empty string')
    }
    if (typeof c.charName !== 'string' || c.charName.trim().length === 0) {
      throw new KillStatsImportError(`${basePath}.charName`, 'charName must be a non-empty string')
    }

    const expectedCharKey = computeCharKey(c.host, c.realm, c.account, c.charName)
    if (typeof c.charKey !== 'string' || c.charKey !== expectedCharKey) {
      throw new KillStatsImportError(
        `${basePath}.charKey`,
        `charKey mismatch: expected ${expectedCharKey}, got ${JSON.stringify(c.charKey)}`,
      )
    }
    if (seenCharKeys.has(c.charKey)) {
      throw new KillStatsImportError(
        `${basePath}.charKey`,
        `Duplicate charKey ${c.charKey}`,
      )
    }
    seenCharKeys.add(c.charKey)

    if (!isValidCharClass(c.charClass)) {
      throw new KillStatsImportError(
        `${basePath}.charClass`,
        'charClass must be an integer in 0..6',
      )
    }

    if (
      typeof c.level !== 'number' ||
      !Number.isInteger(c.level) ||
      c.level < 1 ||
      c.level > 99
    ) {
      throw new KillStatsImportError(
        `${basePath}.level`,
        'level must be an integer in 1..99',
      )
    }

    if (typeof c.hardcore !== 'boolean') {
      throw new KillStatsImportError(`${basePath}.hardcore`, 'hardcore must be a boolean')
    }
    if (typeof c.expansion !== 'boolean') {
      throw new KillStatsImportError(`${basePath}.expansion`, 'expansion must be a boolean')
    }
    if (typeof c.ladder !== 'boolean') {
      throw new KillStatsImportError(`${basePath}.ladder`, 'ladder must be a boolean')
    }

    if (
      typeof c.firstSeenAt !== 'number' ||
      !Number.isFinite(c.firstSeenAt) ||
      c.firstSeenAt < 0
    ) {
      throw new KillStatsImportError(
        `${basePath}.firstSeenAt`,
        'firstSeenAt must be a non-negative finite number',
      )
    }
    if (
      typeof c.lastSeenAt !== 'number' ||
      !Number.isFinite(c.lastSeenAt) ||
      c.lastSeenAt < 0
    ) {
      throw new KillStatsImportError(
        `${basePath}.lastSeenAt`,
        'lastSeenAt must be a non-negative finite number',
      )
    }
    if (c.firstSeenAt > c.lastSeenAt) {
      throw new KillStatsImportError(
        `${basePath}.firstSeenAt`,
        'firstSeenAt cannot be greater than lastSeenAt',
      )
    }

    validatedCharacters.push({
      charKey: c.charKey,
      host: c.host.trim(),
      realm: c.realm.trim(),
      account: c.account.trim(),
      charName: c.charName.trim(),
      charClass: c.charClass,
      level: c.level,
      hardcore: c.hardcore,
      expansion: c.expansion,
      ladder: c.ladder,
      firstSeenAt: c.firstSeenAt,
      lastSeenAt: c.lastSeenAt,
    })
  }

  const seenTallyIds = new Set<string>()
  const validatedTallies: KillTallyRecord[] = []

  for (let i = 0; i < raw.tallies.length; i++) {
    const t = raw.tallies[i]
    const basePath = `tallies[${i}]`
    if (!isRecordObject(t)) {
      throw new KillStatsImportError(basePath, 'Tally entry must be an object')
    }

    if (!isValidUuid(t.replicaId)) {
      throw new KillStatsImportError(
        `${basePath}.replicaId`,
        'replicaId must be a valid UUID string',
      )
    }

    if (typeof t.charKey !== 'string' || !seenCharKeys.has(t.charKey)) {
      throw new KillStatsImportError(
        `${basePath}.charKey`,
        `charKey ${JSON.stringify(t.charKey)} does not reference a character in characters[]`,
      )
    }

    if (!isValidTallyKind(t.kind)) {
      throw new KillStatsImportError(
        `${basePath}.kind`,
        'kind must be "monster", "boss", or "superunique"',
      )
    }

    if (!isValidDifficulty(t.difficulty)) {
      throw new KillStatsImportError(
        `${basePath}.difficulty`,
        'difficulty must be 0, 1, or 2',
      )
    }

    if (typeof t.subject !== 'number' || !Number.isInteger(t.subject)) {
      throw new KillStatsImportError(
        `${basePath}.subject`,
        'subject must be an integer',
      )
    }

    if (t.kind === 'monster') {
      if (!isCountableKillClass(t.subject)) {
        throw new KillStatsImportError(
          `${basePath}.subject`,
          `hcIdx ${t.subject} is not a countable monster class`,
        )
      }
    } else if (t.kind === 'boss') {
      if (!isCountableBossClass(t.subject)) {
        throw new KillStatsImportError(
          `${basePath}.subject`,
          `hcIdx ${t.subject} is not a countable boss class`,
        )
      }
    } else if (t.kind === 'superunique') {
      if (t.subject < 0 || t.subject >= SUPERUNIQUE_COUNT) {
        throw new KillStatsImportError(
          `${basePath}.subject`,
          `superUniqueId ${t.subject} is out of range 0..65`,
        )
      }
    }

    const expectedId = computeTallyId(
      t.replicaId,
      t.charKey,
      t.kind,
      t.difficulty,
      t.subject,
    )
    if (typeof t.id !== 'string' || t.id !== expectedId) {
      throw new KillStatsImportError(
        `${basePath}.id`,
        `id mismatch: expected ${expectedId}, got ${JSON.stringify(t.id)}`,
      )
    }
    if (seenTallyIds.has(t.id)) {
      throw new KillStatsImportError(`${basePath}.id`, `Duplicate tally id ${t.id}`)
    }
    seenTallyIds.add(t.id)

    if (typeof t.count !== 'number' || !Number.isInteger(t.count) || t.count < 1) {
      throw new KillStatsImportError(
        `${basePath}.count`,
        'count must be an integer >= 1',
      )
    }

    if (
      typeof t.soloCount !== 'number' ||
      !Number.isInteger(t.soloCount) ||
      t.soloCount < 0 ||
      t.soloCount > t.count
    ) {
      throw new KillStatsImportError(
        `${basePath}.soloCount`,
        'soloCount must be an integer in 0..count',
      )
    }

    if (
      typeof t.firstAt !== 'number' ||
      !Number.isFinite(t.firstAt) ||
      t.firstAt < 0
    ) {
      throw new KillStatsImportError(
        `${basePath}.firstAt`,
        'firstAt must be a non-negative finite number',
      )
    }
    if (
      typeof t.lastAt !== 'number' ||
      !Number.isFinite(t.lastAt) ||
      t.lastAt < 0
    ) {
      throw new KillStatsImportError(
        `${basePath}.lastAt`,
        'lastAt must be a non-negative finite number',
      )
    }
    if (t.firstAt > t.lastAt) {
      throw new KillStatsImportError(
        `${basePath}.firstAt`,
        'firstAt cannot be greater than lastAt',
      )
    }

    validatedTallies.push({
      id: t.id,
      replicaId: t.replicaId,
      charKey: t.charKey,
      kind: t.kind,
      difficulty: t.difficulty,
      subject: t.subject,
      count: t.count,
      soloCount: t.soloCount,
      firstAt: t.firstAt,
      lastAt: t.lastAt,
    })
  }

  return {
    format: KILL_STATS_FORMAT,
    version: KILL_STATS_VERSION,
    exportedAt: raw.exportedAt,
    replicaId: raw.replicaId,
    characters: validatedCharacters,
    tallies: validatedTallies,
  }
}

function areCharacterRecordsEqual(a: KillCharacterRecord, b: KillCharacterRecord): boolean {
  return (
    a.charKey === b.charKey &&
    a.host === b.host &&
    a.realm === b.realm &&
    a.account === b.account &&
    a.charName === b.charName &&
    a.charClass === b.charClass &&
    a.level === b.level &&
    a.hardcore === b.hardcore &&
    a.expansion === b.expansion &&
    a.ladder === b.ladder &&
    a.firstSeenAt === b.firstSeenAt &&
    a.lastSeenAt === b.lastSeenAt
  )
}

function areTallyRecordsEqual(a: KillTallyRecord, b: KillTallyRecord): boolean {
  return (
    a.id === b.id &&
    a.count === b.count &&
    a.soloCount === b.soloCount &&
    a.firstAt === b.firstAt &&
    a.lastAt === b.lastAt
  )
}

/**
 * Merges a validated `KillStatsExportPayload` into `current` state using G-counter and LWW rules.
 */
export function mergeImportPayload(
  current: KillStatsSnapshot,
  payload: KillStatsExportPayload,
): {
  readonly next: KillStatsSnapshot
  readonly summary: KillStatsImportSummary
} {
  const charMap = new Map<string, KillCharacterRecord>()
  for (const c of current.characters) {
    charMap.set(c.charKey, c)
  }

  let addedCharacters = 0
  let updatedCharacters = 0
  for (const incoming of payload.characters) {
    const existing = charMap.get(incoming.charKey)
    if (!existing) {
      charMap.set(incoming.charKey, incoming)
      addedCharacters++
    } else {
      const merged = mergeCharacterRecords(existing, incoming)
      charMap.set(incoming.charKey, merged)
      if (!areCharacterRecordsEqual(existing, merged)) {
        updatedCharacters++
      }
    }
  }

  const tallyMap = new Map<string, KillTallyRecord>()
  for (const t of current.tallies) {
    tallyMap.set(t.id, t)
  }

  let addedTallies = 0
  let updatedTallies = 0
  let unchangedTallies = 0
  for (const incoming of payload.tallies) {
    const existing = tallyMap.get(incoming.id)
    if (!existing) {
      tallyMap.set(incoming.id, incoming)
      addedTallies++
    } else {
      const merged = mergeTallyRecords(existing, incoming)
      tallyMap.set(incoming.id, merged)
      if (areTallyRecordsEqual(existing, merged)) {
        unchangedTallies++
      } else {
        updatedTallies++
      }
    }
  }

  const next: KillStatsSnapshot = {
    replicaId: current.replicaId,
    characters: [...charMap.values()].sort((a, b) =>
      a.charKey < b.charKey ? -1 : a.charKey > b.charKey ? 1 : 0,
    ),
    tallies: [...tallyMap.values()].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
  }

  return {
    next,
    summary: {
      addedCharacters,
      updatedCharacters,
      addedTallies,
      updatedTallies,
      unchangedTallies,
    },
  }
}
