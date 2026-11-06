/**
 * Bake `AnimData.D2` and the animation columns of `MonStats2.txt` into static JSON.
 *
 * The runtime is not allowed to touch an MPQ, so every animation's frame count,
 * speed and frame-event list has to be extracted here, on a developer machine,
 * and written to `samples/d2-packs/anim/`. This script is the only place those
 * numbers come from; nothing downstream is permitted to invent one.
 *
 * Outputs:
 * - `anim/animdata.json` — every clip by upper-case COF name, plus the
 *   integrity facts (byte count, record count, duplicate and conflict lists) so
 *   a verifier can re-assert them without re-reading the archive.
 * - `anim/monstats2.json` — per-monster animation columns: the `m*` mode
 *   presence bits, the `d*` direction counts of the modes that are present, the
 *   in-animation movement flags, the hit box, and the art-token join.
 *
 * Three policies are enforced here rather than left to the caller:
 *
 * 1. **`AnimData.D2` only.** `EAnimData.D2` decodes with the same decoder but
 *    its name set is a strict subset — zero names are unique to it — so merging
 *    it would add no clips while reintroducing ambiguity. It is read purely as a
 *    cross-check and the comparison is written into the artefact.
 * 2. **A speed-0 clip inside the bake scope is a hard failure.** Four shipped
 *    records store `animationSpeed === 0`; an 8.8 accumulator fed zero never
 *    advances, so such a clip would ship as an actor frozen mid-animation with
 *    no error anywhere. If one is ever pulled into scope the bake stops and
 *    names it. Out-of-scope ones are reported, not tolerated silently.
 * 3. **Monster modes are filtered on `m*` and never on `d*`.** `skeleton1`
 *    stores `dSC=8` and `dRN=8` while `mSC`/`mRN` are empty: the direction
 *    columns are populated for modes the monster does not have. Filtering on
 *    `d*` would bake skeleton run and cast animations that do not exist.
 *
 * Every table is read with `archives.read()`, never `listFiles()`:
 * `MonStats2.txt` is one of nine excel tables that are present in the archive
 * but absent from its `(listfile)`, so a listing-based lookup reports it
 * missing.
 *
 * Usage:
 *   npm run pack:animdata [-- <archiveDir> <outDir>]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { decodeAnimDataFile, ANIMDATA_FLAG_COUNT, ANIM_EVENT_ATTACK, ANIM_EVENT_MISSILE } from '../../common/formats/animdata.ts'
import type { AnimDataFile, AnimDataRecord } from '../../common/formats/animdata.ts'
import { decodeCof } from '../../common/formats/cof.ts'
import { cell, parseTable } from '../../common/world/acts.ts'
import type { D2Table } from '../../common/world/acts.ts'
import { ACT_MONSTER_SPECS, resolveMonsterArtSpec } from '../../common/units/monster-mapping.ts'
import {
  CANONICAL_SUPER_UNIQUE_LANDMARKS,
  CANONICAL_SUPERUNIQUES_TABLE,
  readSuperUniques,
} from '../../common/units/monsters-data.ts'

/** Archives to mount, in load order; the last one to hold a member wins. */
const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
/** The timing table. Served by `d2exp.mpq`, not `d2data.mpq`. */
const ANIMDATA_MEMBER = 'data\\global\\AnimData.D2'
/** The expansion table, read only as a cross-check. */
const EANIMDATA_MEMBER = 'data\\global\\EAnimData.D2'
/** Monster animation columns. Present in the archive, absent from `(listfile)`. */
const MONSTATS2_MEMBER = 'data\\global\\excel\\MonStats2.txt'
/** Monster records; carries the `Code` art token and the `MonStatsEx` join key. */
const MONSTATS_MEMBER = 'data\\global\\excel\\MonStats.txt'

/**
 * Class art tokens, in `CharStats.txt` row order.
 *
 * `CharStats.txt` names the classes but stores no two-letter art token — the
 * token lives in the executable and in the `data\global\chars\<token>` layout —
 * so the mapping is spelled out here and then *verified against the archive*:
 * `assertPlayerTokens` requires `<token>nuhth.cof` to exist for each one, so a
 * wrong token fails the bake instead of silently baking nothing.
 */
const PLAYER_TOKENS: readonly { readonly token: string; readonly charStatsClass: string }[] = [
  { token: 'am', charStatsClass: 'Amazon' },
  { token: 'so', charStatsClass: 'Sorceress' },
  { token: 'ne', charStatsClass: 'Necromancer' },
  { token: 'pa', charStatsClass: 'Paladin' },
  { token: 'ba', charStatsClass: 'Barbarian' },
  { token: 'dz', charStatsClass: 'Druid' },
  { token: 'ai', charStatsClass: 'Assassin' },
]

/**
 * Player modes in this bake's scope (`PROJECT.md` R2; Issue #143 / #759).
 */
const PLAYER_MODES: readonly string[] = [
  'NU', 'WL', 'RN', 'A1', 'A2', 'BL', 'SC', 'TH', 'KK', 'S1', 'S2', 'S3', 'S4', 'GH', 'DT', 'DD', 'TN', 'TW',
]

/**
 * Monster modes in this bake's scope, before the per-monster `m*` filter.
 */
const MONSTER_MODES: readonly string[] = ['NU', 'WL', 'RN', 'A1', 'A2', 'SC', 'GH', 'DT', 'DD']

/** Mode columns of `MonStats2.txt`, in table order. */
const MONSTATS2_MODES: readonly string[] = [
  'DT', 'NU', 'WL', 'GH', 'A1', 'A2', 'BL', 'SC', 'S1', 'S2', 'S3', 'S4', 'DD', 'KB', 'SQ', 'RN',
]

/** In-animation movement flag columns of `MonStats2.txt`. */
const MONSTATS2_MOVE_MODES: readonly string[] = ['A1', 'A2', 'SC', 'S1', 'S2', 'S3', 'S4']

/** A clip as written to `animdata.json`. */
interface PackedClip {
  /** Frames in one direction. */
  readonly fpd: number
  /** 8.8 fixed-point speed as stored; 256 = 1x. */
  readonly speed: number
  /** Frame events as `[frame, code]` pairs, ascending. */
  readonly events: readonly (readonly [number, number])[]
  /** Present and true only when `speed` is 0, so the runtime cannot miss it. */
  readonly noSpeed?: true
}

/**
 * Convert a decoded record into its baked form.
 *
 * @param record - the decoded record.
 * @returns the JSON-shaped clip.
 */
function toPackedClip(record: AnimDataRecord): PackedClip {
  const events = record.events.map(event => [event.frame, event.code] as const)
  const base = { fpd: record.framesPerDirection, speed: record.animationSpeed, events }
  return record.hasSpeed ? base : { ...base, noSpeed: true }
}

/**
 * Mount the game archives, failing on the first one that cannot be opened.
 *
 * A missing archive is not survivable here: `AnimData.D2` lives in `d2exp.mpq`
 * and the character COFs used to verify the class tokens live in `d2char.mpq`,
 * so skipping a mount would turn a setup mistake into a half-empty artefact.
 *
 * @param archiveDir - directory holding the `.mpq` files.
 * @returns the mounted stack.
 */
async function mountArchives(archiveDir: string): Promise<MountedArchives> {
  const archives = new MountedArchives()
  for (const name of MOUNTS) {
    const path = join(archiveDir, name)
    try {
      archives.add(name, await MpqArchive.open(await fileSource(path)))
    } catch (error) {
      throw new Error(`pack-animdata: cannot mount ${path}: ${(error as Error).message}`)
    }
  }
  return archives
}

/**
 * Confirm every class token names a real character COF directory.
 *
 * @param archives - the mounted stack.
 * @throws when a token has no `<token>nuhth.cof`, which would mean the token
 *   list has drifted from the archive.
 */
function assertPlayerTokens(archives: MountedArchives): void {
  for (const entry of PLAYER_TOKENS) {
    const member = `data\\global\\chars\\${entry.token}\\cof\\${entry.token}nuhth.cof`
    if (!archives.has(member)) {
      throw new Error(`pack-animdata: class token '${entry.token}' (${entry.charStatsClass}) has no ${member}`)
    }
  }
}

/**
 * Whether a `MonStats2.txt` mode presence cell counts as set.
 *
 * The cells hold `1` or nothing. An empty cell means the monster does not have
 * the mode at all, which is why this must never be read with a non-zero
 * fallback.
 *
 * @param value - the raw cell.
 * @returns true when the mode is present.
 */
function modePresent(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed !== '0'
}

/**
 * Parse an integer cell, treating an empty cell as 0.
 *
 * @param value - the raw cell.
 * @returns the number, or 0 when the cell is empty or not numeric.
 */
function numberCell(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

/** The animation-relevant part of one `MonStats2.txt` row. */
interface PackedMonStats2Row {
  readonly baseW: string
  readonly sizeX: number
  readonly sizeY: number
  readonly pixHeight: number
  readonly meleeRng: number
  /** Only the modes whose `m*` cell is set. */
  readonly modes: Readonly<Record<string, number>>
  /** Direction counts, emitted only for modes present in `modes`. */
  readonly directions: Readonly<Record<string, number>>
  /** `A1mv`-style flags, only for modes present in `modes`. */
  readonly moveInAnim: Readonly<Record<string, number>>
  readonly hitBox: {
    readonly noGfxHitTest: number
    readonly top: number
    readonly left: number
    readonly width: number
    readonly height: number
  }
  readonly compositeDeath: number
}

/**
 * Extract the animation columns of one `MonStats2.txt` row.
 *
 * `directions` and `moveInAnim` are deliberately emitted only for modes the
 * `m*` bits declare: the direction columns are populated for absent modes too,
 * so carrying them forward would let a consumer resurrect a mode that does not
 * exist.
 *
 * @param table - the parsed table.
 * @param row - the row.
 * @returns the packed row.
 */
function packMonStats2Row(table: D2Table, row: readonly string[]): PackedMonStats2Row {
  const modes: Record<string, number> = {}
  const directions: Record<string, number> = {}
  const moveInAnim: Record<string, number> = {}
  for (const mode of MONSTATS2_MODES) {
    const present = cell(table, row, `m${mode}`)
    if (!modePresent(present)) continue
    modes[mode] = numberCell(present) || 1
    directions[mode] = numberCell(cell(table, row, `d${mode}`))
    if (MONSTATS2_MOVE_MODES.includes(mode)) {
      moveInAnim[mode] = numberCell(cell(table, row, `${mode}mv`))
    }
  }
  return {
    baseW: cell(table, row, 'BaseW').trim(),
    sizeX: numberCell(cell(table, row, 'SizeX')),
    sizeY: numberCell(cell(table, row, 'SizeY')),
    pixHeight: numberCell(cell(table, row, 'pixHeight')),
    meleeRng: numberCell(cell(table, row, 'MeleeRng')),
    modes,
    directions,
    moveInAnim,
    hitBox: {
      noGfxHitTest: numberCell(cell(table, row, 'noGfxHitTest')),
      top: numberCell(cell(table, row, 'htTop')),
      left: numberCell(cell(table, row, 'htLeft')),
      width: numberCell(cell(table, row, 'htWidth')),
      height: numberCell(cell(table, row, 'htHeight')),
    },
    compositeDeath: numberCell(cell(table, row, 'compositeDeath')),
  }
}

/**
 * Art token to `MonStats2` row ids, via `MonStats.Code` → `MonStats.MonStatsEx`.
 *
 * The join is many-to-one in both directions: token `SK` covers `skeleton1..5`,
 * and several monsters can share a `MonStatsEx` row. Every contributing id is
 * kept so a consumer can union the `m*` bits and show its work.
 *
 * @param monstats - parsed `MonStats.txt`.
 * @param rows - the packed `MonStats2` rows, keyed by id.
 * @returns token (upper case) to the ids of the rows it covers.
 */
function buildTokenJoin(
  monstats: D2Table,
  rows: ReadonlyMap<string, PackedMonStats2Row>,
): Map<string, string[]> {
  const join = new Map<string, string[]>()
  for (const row of monstats.rows) {
    const token = cell(monstats, row, 'Code').trim().toUpperCase()
    const ex = cell(monstats, row, 'MonStatsEx').trim()
    if (token.length === 0) continue
    if (ex.length === 0 || !rows.has(ex)) continue
    const ids = join.get(token) ?? []
    if (!ids.includes(ex)) ids.push(ex)
    join.set(token, ids)
  }
  return join
}

/**
 * The monster art tokens this project actually bakes art for.
 *
 * Mirrors `scripts/pack-entity-assets.ts`: the Act 1..5 spawn tables plus every
 * SuperUnique and landmark minion. Scope has to match the entity bake, because
 * the speed-0 check below is only meaningful for clips that will really ship.
 *
 * @returns upper-case tokens.
 */
function bakedMonsterTokens(): Set<string> {
  const tokens = new Set<string>()
  for (let act = 1; act <= 5; act += 1) {
    for (const spec of ACT_MONSTER_SPECS[act] ?? []) {
      if (!spec.token) continue
      tokens.add(spec.token.toUpperCase())
    }
  }
  const monsterIds = new Set<string>()
  for (const superUnique of readSuperUniques(CANONICAL_SUPERUNIQUES_TABLE)) {
    monsterIds.add(superUnique.monsterId)
  }
  for (const landmark of CANONICAL_SUPER_UNIQUE_LANDMARKS) {
    if (landmark.minionMonsterId) monsterIds.add(landmark.minionMonsterId)
  }
  for (const id of monsterIds) {
    const spec = resolveMonsterArtSpec(id)
    if (spec && spec.token) tokens.add(spec.token.toUpperCase())
  }
  return tokens
}

/** The set of clips this CL's entity bake will actually need. */
interface BakeScope {
  readonly playerTokens: readonly string[]
  readonly playerModes: readonly string[]
  readonly monsterTokens: readonly string[]
  readonly monsterModes: readonly string[]
  /** Clip names in scope, sorted. Derived from the tables, never hand-listed. */
  readonly clips: readonly string[]
  /** Monster tokens with no `m*` bits found, i.e. no `MonStats2` join. */
  readonly monsterTokensWithoutRows: readonly string[]
}

/**
 * Work out which clips the R2 bake will need.
 *
 * Player clips are every weapon-class variant the table actually stores for an
 * in-scope mode. Monster clips are the same, but a mode only counts when at
 * least one `MonStats2` row behind that token has the mode's `m*` bit set — the
 * union across the rows, so a token covering several monsters never loses a
 * clip one of them needs.
 *
 * @param animdata - the decoded timing table.
 * @param rows - packed `MonStats2` rows by id.
 * @param tokenJoin - token to row ids.
 * @returns the scope.
 */
function computeBakeScope(
  animdata: AnimDataFile,
  rows: ReadonlyMap<string, PackedMonStats2Row>,
  tokenJoin: ReadonlyMap<string, readonly string[]>,
): BakeScope {
  const playerTokens = PLAYER_TOKENS.map(entry => entry.token.toUpperCase())
  const monsterTokens = [...bakedMonsterTokens()].sort()
  const clips = new Set<string>()
  const withoutRows: string[] = []

  for (const record of animdata.all) {
    const token = record.name.slice(0, 2)
    const mode = record.name.slice(2, 4)
    if (playerTokens.includes(token)) {
      if (PLAYER_MODES.includes(mode)) clips.add(record.name)
      continue
    }
    if (!monsterTokens.includes(token)) continue
    if (!MONSTER_MODES.includes(mode)) continue
    const ids = tokenJoin.get(token) ?? []
    if (ids.length === 0) continue
    const present = ids.some(id => rows.get(id)?.modes[mode] !== undefined)
    if (present) clips.add(record.name)
  }

  for (const token of monsterTokens) {
    if ((tokenJoin.get(token) ?? []).length === 0) withoutRows.push(token)
  }

  return {
    playerTokens,
    playerModes: PLAYER_MODES,
    monsterTokens,
    monsterModes: MONSTER_MODES,
    clips: [...clips].sort(),
    monsterTokensWithoutRows: withoutRows,
  }
}

/** Where a COF carrying the same tag as an undocumented AnimData code was found. */
interface CofProvenance {
  readonly member: string
  readonly directions: number
  readonly framesPerDirection: number
  readonly speed: number
  readonly tags: readonly (readonly [number, number])[]
}

/**
 * Locate the COF that belongs to a clip and read its frame tags back.
 *
 * Used to give the undocumented event codes a provenance: if the same code sits
 * at the same frame in the COF's own tag array, the byte is shipped data and not
 * a decode artefact. Nothing is inferred about what the code *means*.
 *
 * @param archives - the mounted stack.
 * @param name - upper-case clip name.
 * @returns the COF facts, or undefined when no COF carries this name.
 */
async function findCof(archives: MountedArchives, name: string): Promise<CofProvenance | undefined> {
  const token = name.slice(0, 2).toLowerCase()
  const lower = name.toLowerCase()
  const candidates = [
    `data\\global\\monsters\\${token}\\cof\\${lower}.cof`,
    `data\\global\\chars\\${token}\\cof\\${lower}.cof`,
    `data\\global\\objects\\${token}\\cof\\${lower}.cof`,
  ]
  for (const member of candidates) {
    if (!archives.has(member)) continue
    const cof = decodeCof(await archives.read(member))
    const tags: (readonly [number, number])[] = []
    for (let frame = 0; frame < cof.animationFrames.length; frame += 1) {
      const tag = cof.animationFrames[frame]!
      if (tag !== 0) tags.push([frame, tag] as const)
    }
    return {
      member,
      directions: cof.numberOfDirections,
      framesPerDirection: cof.framesPerDirection,
      speed: cof.speed,
      tags,
    }
  }
  return undefined
}

/**
 * Bake the animation tables.
 *
 * @param archiveDir - directory holding the `.mpq` files.
 * @param outDir - pack root; files land in `<outDir>/anim/`.
 */
export async function bakeAnimData(archiveDir = 'samples/d2', outDir = 'public'): Promise<void> {
  const archives = await mountArchives(archiveDir)
  assertPlayerTokens(archives)

  const raw = await archives.read(ANIMDATA_MEMBER)
  const animdata = decodeAnimDataFile(raw)
  if (animdata.bytesConsumed !== raw.length) {
    throw new Error(`pack-animdata: consumed ${String(animdata.bytesConsumed)} of ${String(raw.length)} bytes`)
  }
  console.log(
    `AnimData.D2: ${String(raw.length)} bytes, ${String(animdata.all.length)} records, ` +
    `${String(animdata.records.size)} unique, ${String(animdata.duplicates.length)} duplicate names, ` +
    `${String(animdata.conflicts.length)} conflicting`,
  )

  // EAnimData is a cross-check, not a source: measured against 1.13c it collides
  // on all 3,520 of its names and differs on none of them, so merge precedence
  // cannot change a value. That is only true while it stays a value-identical
  // subset, so the property is asserted here instead of assumed.
  const expansion = archives.has(EANIMDATA_MEMBER) ? decodeAnimDataFile(await archives.read(EANIMDATA_MEMBER)) : undefined
  let expansionSummary: Record<string, unknown> | undefined
  if (expansion !== undefined) {
    const onlyInExpansion = [...expansion.records.keys()].filter(name => !animdata.records.has(name))
    const onlyInBase = [...animdata.records.keys()].filter(name => !expansion.records.has(name))
    const collisions: string[] = []
    const disagreeing: string[] = []
    for (const [name, record] of expansion.records) {
      const base = animdata.records.get(name)
      if (base === undefined) continue
      collisions.push(name)
      if (
        base.framesPerDirection !== record.framesPerDirection ||
        base.animationSpeed !== record.animationSpeed ||
        JSON.stringify(base.events) !== JSON.stringify(record.events)
      ) {
        disagreeing.push(name)
      }
    }
    if (onlyInExpansion.length > 0 || disagreeing.length > 0) {
      throw new Error(
        `pack-animdata: EAnimData.D2 is no longer a value-identical subset of AnimData.D2 — ` +
        `${String(onlyInExpansion.length)} name(s) only it has (${onlyInExpansion.slice(0, 10).join(', ')}), ` +
        `${String(disagreeing.length)} shared name(s) disagree (${disagreeing.slice(0, 10).join(', ')}). ` +
        `Baking AnimData.D2 alone would drop or contradict data; the merge policy needs re-deciding.`,
      )
    }
    expansionSummary = {
      member: EANIMDATA_MEMBER,
      records: expansion.all.length,
      uniqueNames: expansion.records.size,
      collidingNames: collisions.length,
      namesOnlyInExpansion: onlyInExpansion,
      namesOnlyInBase: onlyInBase,
      sharedNamesDisagreeing: disagreeing,
      merged: false,
      mergePolicy:
        'AnimData.D2 only. EAnimData.D2 collides on every name it has and differs on none, ' +
        'so cross-file precedence cannot change a value; asserted at bake time.',
    }
    console.log(
      `EAnimData.D2: ${String(expansion.all.length)} records, ${String(collisions.length)} colliding names, ` +
      `${String(disagreeing.length)} of them disagree, ${String(onlyInExpansion.length)} names it alone has, ` +
      `${String(onlyInBase.length)} names only in AnimData.D2`,
    )
  }

  const monstats2Table = parseTable(await archives.read(MONSTATS2_MEMBER))
  const monstatsTable = parseTable(await archives.read(MONSTATS_MEMBER))
  const rows = new Map<string, PackedMonStats2Row>()
  for (const row of monstats2Table.rows) {
    const id = cell(monstats2Table, row, 'Id').trim()
    if (id.length === 0) continue
    rows.set(id, packMonStats2Row(monstats2Table, row))
  }
  const tokenJoin = buildTokenJoin(monstatsTable, rows)
  console.log(`MonStats2.txt: ${String(rows.size)} rows, ${String(tokenJoin.size)} art tokens joined`)

  const scope = computeBakeScope(animdata, rows, tokenJoin)
  console.log(
    `bake scope: ${String(scope.playerTokens.length)} class tokens x ${String(PLAYER_MODES.length)} modes, ` +
    `${String(scope.monsterTokens.length)} monster tokens x <= ${String(MONSTER_MODES.length)} modes ` +
    `-> ${String(scope.clips.length)} clips`,
  )
  if (scope.monsterTokensWithoutRows.length > 0) {
    console.log(`  monster tokens with no MonStats2 join: ${scope.monsterTokensWithoutRows.join(', ')}`)
  }

  // Policy 2: a speed-0 clip inside the scope is a hard failure, named.
  const speedless = animdata.all.filter(record => !record.hasSpeed)
  const inScopeSpeedless = speedless.filter(record => scope.clips.includes(record.name))
  if (inScopeSpeedless.length > 0) {
    const detail = inScopeSpeedless
      .map(record => `${record.name} (fpd=${String(record.framesPerDirection)}, speed=0)`)
      .join(', ')
    throw new Error(
      `pack-animdata: ${String(inScopeSpeedless.length)} in-scope clip(s) have animationSpeed 0 and would never ` +
      `advance in the 8.8 accumulator: ${detail}`,
    )
  }
  console.log(
    `animationSpeed 0: ${String(speedless.length)} record(s) file-wide (${speedless.map(r => r.name).join(', ')}), ` +
    `none in scope`,
  )

  for (const record of animdata.recordsOverFlagCeiling) {
    console.log(
      `  WARNING ${record.name} declares ${String(record.framesPerDirection)} frames but the flag array is ` +
      `${String(ANIMDATA_FLAG_COUNT)} bytes; frames ${String(ANIMDATA_FLAG_COUNT)}..${String(record.framesPerDirection - 1)} cannot carry an event`,
    )
  }
  for (const stray of animdata.strayFlags) {
    console.log(`  WARNING ${stray.name} stores code ${String(stray.code)} at frame ${String(stray.frame)}, past its own frame count`)
  }

  const histogram = new Map<number, number>()
  for (const record of animdata.all) {
    for (const event of record.events) histogram.set(event.code, (histogram.get(event.code) ?? 0) + 1)
  }
  const undocumented: Record<string, unknown>[] = []
  for (const record of animdata.all) {
    const codes = record.events.filter(event => event.code !== ANIM_EVENT_ATTACK && event.code !== ANIM_EVENT_MISSILE)
    if (codes.length === 0) continue
    const cof = await findCof(archives, record.name)
    undocumented.push({
      name: record.name,
      framesPerDirection: record.framesPerDirection,
      animationSpeed: record.animationSpeed,
      events: record.events.map(event => [event.frame, event.code]),
      cof: cof ?? null,
      cofAgrees: cof === undefined
        ? null
        : JSON.stringify(cof.tags) === JSON.stringify(record.events.map(event => [event.frame, event.code])),
    })
  }
  console.log(`event codes: ${[...histogram].sort((a, b) => a[0] - b[0]).map(([code, count]) => `${String(code)}x${String(count)}`).join(' ')}`)
  for (const entry of undocumented) {
    console.log(`  undocumented code on ${String(entry['name'])}: ${JSON.stringify(entry['events'])} cofAgrees=${String(entry['cofAgrees'])}`)
  }

  const clips: Record<string, PackedClip> = {}
  for (const [name, record] of animdata.records) clips[name] = toPackedClip(record)

  const animJson = {
    schema: 1,
    source: {
      member: ANIMDATA_MEMBER,
      bytes: raw.length,
      records: animdata.all.length,
      uniqueNames: animdata.records.size,
      duplicateNames: animdata.duplicates.length,
      conflictingNames: animdata.conflicts.length,
      dedupPolicy: 'first-wins: the engine scans a hash block in order and returns the first match',
      flagCeiling: ANIMDATA_FLAG_COUNT,
      ...(expansionSummary === undefined ? {} : { expansion: expansionSummary }),
    },
    clips,
    conflicts: animdata.conflicts.map(conflict => ({
      name: conflict.name,
      chosen: toPackedClip(conflict.records[0]!),
      candidates: conflict.records.map(toPackedClip),
    })),
    overFlagCeiling: animdata.recordsOverFlagCeiling.map(record => ({
      name: record.name,
      framesPerDirection: record.framesPerDirection,
      flagCeiling: ANIMDATA_FLAG_COUNT,
    })),
    strayFlags: animdata.strayFlags,
    speedZero: speedless.map(record => record.name),
    eventCodeHistogram: Object.fromEntries([...histogram].sort((a, b) => a[0] - b[0]).map(([code, count]) => [String(code), count])),
    undocumentedEventCodes: undocumented,
    bakeScope: scope,
  }

  const monstatsJson = {
    schema: 1,
    source: {
      member: MONSTATS2_MEMBER,
      rows: rows.size,
      columns: monstats2Table.header.length,
      modeFilter: 'm* presence bits only; d* direction counts are populated for absent modes and must not be used',
    },
    rows: Object.fromEntries([...rows].sort((a, b) => a[0].localeCompare(b[0]))),
    tokenToRows: Object.fromEntries([...tokenJoin].sort((a, b) => a[0].localeCompare(b[0]))),
  }

  const animJsonStr = JSON.stringify(animJson)
  const monstatsJsonStr = JSON.stringify(monstatsJson)
  const animDir = join(outDir, 'anim')
  await mkdir(animDir, { recursive: true })
  const animPath = join(animDir, 'animdata.json')
  const monstatsPath = join(animDir, 'monstats2.json')
  await writeFile(animPath, animJsonStr)
  await writeFile(monstatsPath, monstatsJsonStr)
  console.log(`wrote ${animPath} (${String(Object.keys(clips).length)} clips)`)
  console.log(`wrote ${monstatsPath} (${String(rows.size)} rows)`)
}

function parseAnimDataCliArgs(argv: readonly string[]): { archiveDir: string; outDir: string } {
  let archiveDir = 'samples/d2'
  let outDir = 'public'
  const positional: string[] = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    if (arg === '--mpq-dir' && argv[i + 1]) {
      archiveDir = argv[++i]!
    } else if (arg.startsWith('--mpq-dir=')) {
      archiveDir = arg.slice('--mpq-dir='.length)
    } else if (arg === '--out-dir' && argv[i + 1]) {
      outDir = argv[++i]!
    } else if (arg.startsWith('--out-dir=')) {
      outDir = arg.slice('--out-dir='.length)
    } else if (!arg.startsWith('--')) {
      positional.push(arg)
    }
  }
  if (positional[0]) archiveDir = positional[0]
  if (positional[1]) outDir = positional[1]
  return { archiveDir, outDir }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { archiveDir, outDir } = parseAnimDataCliArgs(process.argv.slice(2))
  bakeAnimData(archiveDir, outDir).catch(err => {
    console.error('Failed to bake animdata:', err)
    process.exit(1)
  })
}

