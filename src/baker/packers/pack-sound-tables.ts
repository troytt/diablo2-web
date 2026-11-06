/**
 * Bake the authoritative 1.13c sound metadata tables from the MPQ mount chain:
 * - `data\global\excel\Sounds.txt` (4,699 rows, Index 0..4698) -> `src/common/audio/sounds-113c.ts`
 * - `data\global\excel\SoundEnviron.txt` (50 rows, Index 0..49) + `data\global\excel\Levels.txt` (136 levels)
 *   -> `src/common/audio/sound-environ-113c.ts`
 *
 * Applies the exact D2Client.dll 0x6fb0e8e1–0x6fb0e990 load-time post-processing:
 * - Row 1..4698: `groupBase` is set to the active variant group leader when `id < leader + leaderSize`,
 *   otherwise `id`; `Group Size == 0` is rewritten to `1` while non-zero starts a new group;
 *   `nBlocks` counts leading `Block 1..3 != -1` (`0..3`).
 * - Scans `SoundEnviron.txt` `Song > 0` to derive `MUSIC_SOUND_RANGE_113C = [4657, 4684]` (`[0x6fbcc25c]..[0x6fbcc260]`).
 *
 * Usage:
 *   npm run bake -- sound-tables
 *   npm run pack:sound-tables
 */
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { cell, parseTable, type D2Table } from '../../common/world/acts.ts'
import { DEFAULT_NODE_MPQ_DIR, MPQ_LOAD_ORDER, syncNodeFileSource } from '../mpq-archive-source.ts'

export const SOUNDS_MEMBER = 'data\\global\\excel\\Sounds.txt'
export const SOUND_ENVIRON_MEMBER = 'data\\global\\excel\\SoundEnviron.txt'
export const LEVELS_MEMBER = 'data\\global\\excel\\Levels.txt'

export const SOUNDS_TS_FILE = 'src/common/audio/sounds-113c.ts'
export const SOUND_ENVIRON_TS_FILE = 'src/common/audio/sound-environ-113c.ts'

const SOUNDS_INT_COLUMNS = [
  'Index',
  'Volume',
  'Group Size',
  'Loop',
  'Fade In',
  'Fade Out',
  'Defer Inst',
  'Stop Inst',
  'Duration',
  'Compound',
  'Reverb',
  'Falloff',
  'Cache',
  'Async Only',
  'Priority',
  'Stream',
  'Stereo',
  'Tracking',
  'Solo',
  'Music Vol',
  'Block 1',
  'Block 2',
  'Block 3',
] as const

const SOUND_ENVIRON_INT_COLUMNS = [
  'Index',
  'Song',
  'Day Ambience',
  'Night Ambience',
  'Day Event',
  'Night Event',
  'Event Delay',
  'Indoors',
  'Material 1',
  'Material 2',
  'EAX Environ',
  'EAX Env Size',
  'EAX Env Diff',
  'EAX Room Vol',
  'EAX Room HF',
  'EAX Decay Time',
  'EAX Decay HF',
  'EAX Reflect',
  'EAX Reflect Delay',
  'EAX Reverb',
  'EAX Rev Delay',
  'EAX Room Roll',
  'EAX Air Absorb',
] as const

export interface PackedFullSoundsRow {
  readonly id: number
  readonly sound: string
  readonly rawSound: string
  readonly fileName: string
  readonly volume: number
  readonly rawGroupSize: number
  readonly groupSize: number
  readonly groupBase: number
  readonly loop: boolean
  readonly fadeIn: number
  readonly fadeOut: number
  readonly deferInst: boolean
  readonly stopInst: boolean
  readonly duration: number
  readonly compound: number
  readonly reverb: boolean
  readonly falloff: number
  readonly cache: boolean
  readonly asyncOnly: boolean
  readonly priority: number
  readonly stream: boolean
  readonly stereo: number
  readonly tracking: boolean
  readonly solo: boolean
  readonly musicVol: boolean
  readonly block1: number
  readonly block2: number
  readonly block3: number
  readonly nBlocks: number
}

export interface PackedSoundEnvironRow {
  readonly index: number
  readonly handle: string
  readonly song: number
  readonly dayAmbience: number
  readonly nightAmbience: number
  readonly dayEvent: number
  readonly nightEvent: number
  readonly eventDelay: number
  readonly indoors: number
  readonly material1: number
  readonly material2: number
  readonly eaxEnviron: number
  readonly eaxEnvSize: number
  readonly eaxEnvDiff: number
  readonly eaxRoomVol: number
  readonly eaxRoomHF: number
  readonly eaxDecayTime: number
  readonly eaxDecayHF: number
  readonly eaxReflect: number
  readonly eaxReflectDelay: number
  readonly eaxReverb: number
  readonly eaxRevDelay: number
  readonly eaxRoomRoll: number
  readonly eaxAirAbsorb: number
}

export interface SoundTablesPack {
  readonly soundsArchive: string
  readonly soundEnvironArchive: string
  readonly levelsArchive: string
  readonly musicRange: readonly [number, number]
  readonly sounds: readonly PackedFullSoundsRow[]
  readonly soundEnvironments: readonly PackedSoundEnvironRow[]
  readonly levelSoundEnv: Readonly<Record<number, number>>
}

/** Mounts the four 1.13c data archives in `MPQ_LOAD_ORDER` (`d2data.mpq < d2char.mpq < d2exp.mpq < Patch_D2.mpq`; the last mounted wins). */
export function mountSoundTableArchives(mpqDir = DEFAULT_NODE_MPQ_DIR): MountedArchives {
  const mounted = new MountedArchives()
  for (const name of MPQ_LOAD_ORDER) {
    mounted.add(name, MpqArchive.openSync(syncNodeFileSource(join(mpqDir, name))))
  }
  return mounted
}

function intCell(table: D2Table, row: readonly string[], column: string, what: string): number {
  const raw = cell(table, row, column).trim()
  if (!/^-?\d+$/.test(raw)) {
    throw new Error(`${what}: column '${column}' = '${raw}' is not an integer`)
  }
  return Number(raw)
}

async function readMember(archives: MountedArchives, member: string): Promise<{ bytes: Uint8Array; archive: string }> {
  const hit = archives.find(member)
  if (hit === undefined) {
    throw new Error(`pack-sound-tables: ${member} is in no mounted archive`)
  }
  return { bytes: await archives.read(member), archive: hit.entry.label }
}

/** Derives the full 1.13c sound tables pack from the mounted MPQ archives. */
export async function buildSoundTablesPack(archives: MountedArchives): Promise<SoundTablesPack> {
  const soundsMember = await readMember(archives, SOUNDS_MEMBER)
  const soundsTable = parseTable(soundsMember.bytes)
  for (const column of ['Sound', 'FileName', ...SOUNDS_INT_COLUMNS]) {
    if (!soundsTable.header.includes(column)) {
      throw new Error(`Sounds.txt: missing column '${column}'`)
    }
  }

  interface RawSoundEntry {
    readonly rawSound: string
    readonly sound: string
    readonly fileName: string
    readonly ints: Readonly<Record<(typeof SOUNDS_INT_COLUMNS)[number], number>>
  }

  const rawSounds: RawSoundEntry[] = soundsTable.rows.map((row, position) => {
    const what = `Sounds.txt record ${String(position)}`
    const ints = {} as Record<(typeof SOUNDS_INT_COLUMNS)[number], number>
    for (const column of SOUNDS_INT_COLUMNS) {
      ints[column] = intCell(soundsTable, row, column, what)
    }
    if (ints.Index !== position) {
      throw new Error(`${what}: Index ${String(ints.Index)} != position ${String(position)}`)
    }
    const rawSound = cell(soundsTable, row, 'Sound')
    const sound = rawSound.trim()
    const fileName = cell(soundsTable, row, 'FileName').trim()
    return { rawSound, sound, fileName, ints }
  })

  if (rawSounds.length !== 4699) {
    throw new Error(`Sounds.txt: expected 4699 rows, got ${String(rawSounds.length)}`)
  }

  // D2Client.dll 0x6fb0e8e1–0x6fb0e952 load post-processing over records 1..rowCount-1.
  const groupSize = rawSounds.map((r) => r.ints['Group Size'])
  const groupBase = rawSounds.map(() => 0)
  const nBlocks = rawSounds.map(() => 0)
  let leader = 0
  let leaderSize = 1
  for (let id = 1; id < rawSounds.length; id += 1) {
    groupBase[id] = leader !== 0 && id >= leader && id < leader + leaderSize ? leader : id
    if (groupSize[id] !== 0) {
      leader = id
      leaderSize = groupSize[id]!
    } else {
      groupSize[id] = 1
    }
    const blocks = [rawSounds[id]!.ints['Block 1'], rawSounds[id]!.ints['Block 2'], rawSounds[id]!.ints['Block 3']]
    let count = 0
    while (count < 3 && blocks[count] !== -1) count += 1
    nBlocks[id] = count
  }

  const sounds: PackedFullSoundsRow[] = rawSounds.map((r, id) => {
    const i = r.ints
    return {
      id,
      sound: r.sound,
      rawSound: r.rawSound,
      fileName: r.fileName,
      volume: i.Volume,
      rawGroupSize: i['Group Size'],
      groupSize: groupSize[id]!,
      groupBase: groupBase[id]!,
      loop: i.Loop !== 0,
      fadeIn: i['Fade In'],
      fadeOut: i['Fade Out'],
      deferInst: i['Defer Inst'] !== 0,
      stopInst: i['Stop Inst'] !== 0,
      duration: i.Duration,
      compound: i.Compound,
      reverb: i.Reverb !== 0,
      falloff: i.Falloff,
      cache: i.Cache !== 0,
      asyncOnly: i['Async Only'] !== 0,
      priority: i.Priority,
      stream: i.Stream !== 0,
      stereo: i.Stereo,
      tracking: i.Tracking !== 0,
      solo: i.Solo !== 0,
      musicVol: i['Music Vol'] !== 0,
      block1: i['Block 1'],
      block2: i['Block 2'],
      block3: i['Block 3'],
      nBlocks: nBlocks[id]!,
    }
  })

  // SoundEnviron.txt (50 rows, Index 0..49) & D2Client.dll 0x6fb0e954–0x6fb0e990 musicRange.
  const environMember = await readMember(archives, SOUND_ENVIRON_MEMBER)
  const environTable = parseTable(environMember.bytes)
  for (const column of ['Handle', ...SOUND_ENVIRON_INT_COLUMNS]) {
    if (!environTable.header.includes(column)) {
      throw new Error(`SoundEnviron.txt: missing column '${column}'`)
    }
  }

  let musicMin = rawSounds.length
  let musicMax = 0
  const soundEnvironments: PackedSoundEnvironRow[] = environTable.rows.map((row, position) => {
    const handle = cell(environTable, row, 'Handle').trim()
    const what = `SoundEnviron.txt record ${String(position)} (${handle})`
    const ints = {} as Record<(typeof SOUND_ENVIRON_INT_COLUMNS)[number], number>
    for (const column of SOUND_ENVIRON_INT_COLUMNS) {
      ints[column] = intCell(environTable, row, column, what)
    }
    if (ints.Index !== position) {
      throw new Error(`${what}: Index ${String(ints.Index)} != position ${String(position)}`)
    }
    if (ints.Song > 0) {
      musicMin = Math.min(musicMin, ints.Song)
      musicMax = Math.max(musicMax, ints.Song)
    }
    return {
      index: ints.Index,
      handle,
      song: ints.Song,
      dayAmbience: ints['Day Ambience'],
      nightAmbience: ints['Night Ambience'],
      dayEvent: ints['Day Event'],
      nightEvent: ints['Night Event'],
      eventDelay: ints['Event Delay'],
      indoors: ints.Indoors,
      material1: ints['Material 1'],
      material2: ints['Material 2'],
      eaxEnviron: ints['EAX Environ'],
      eaxEnvSize: ints['EAX Env Size'],
      eaxEnvDiff: ints['EAX Env Diff'],
      eaxRoomVol: ints['EAX Room Vol'],
      eaxRoomHF: ints['EAX Room HF'],
      eaxDecayTime: ints['EAX Decay Time'],
      eaxDecayHF: ints['EAX Decay HF'],
      eaxReflect: ints['EAX Reflect'],
      eaxReflectDelay: ints['EAX Reflect Delay'],
      eaxReverb: ints['EAX Reverb'],
      eaxRevDelay: ints['EAX Rev Delay'],
      eaxRoomRoll: ints['EAX Room Roll'],
      eaxAirAbsorb: ints['EAX Air Absorb'],
    }
  })

  if (soundEnvironments.length !== 50) {
    throw new Error(`SoundEnviron.txt: expected 50 rows, got ${String(soundEnvironments.length)}`)
  }

  // Levels.txt (136 levels, Id 1..136 -> SoundEnv 0..49).
  const levelsMember = await readMember(archives, LEVELS_MEMBER)
  const levelsTable = parseTable(levelsMember.bytes)
  for (const column of ['Id', 'SoundEnv']) {
    if (!levelsTable.header.includes(column)) {
      throw new Error(`Levels.txt: missing column '${column}'`)
    }
  }

  const levelSoundEnv: Record<number, number> = {}
  for (const row of levelsTable.rows) {
    const rawId = cell(levelsTable, row, 'Id').trim()
    if (rawId.length === 0 || !/^-?\d+$/.test(rawId)) continue
    const levelId = Number(rawId)
    if (levelId < 1 || levelId > 136) continue
    const envIdx = intCell(levelsTable, row, 'SoundEnv', `Levels.txt Id=${String(levelId)}`)
    if (envIdx < 0 || envIdx >= soundEnvironments.length) {
      throw new Error(`Levels.txt Id=${String(levelId)}: SoundEnv ${String(envIdx)} out of range 0..${String(soundEnvironments.length - 1)}`)
    }
    levelSoundEnv[levelId] = envIdx
  }

  for (let levelId = 1; levelId <= 136; levelId += 1) {
    if (levelSoundEnv[levelId] === undefined) {
      throw new Error(`Levels.txt: missing SoundEnv mapping for level Id=${String(levelId)}`)
    }
  }

  return {
    soundsArchive: soundsMember.archive,
    soundEnvironArchive: environMember.archive,
    levelsArchive: levelsMember.archive,
    musicRange: [musicMin, musicMax],
    sounds,
    soundEnvironments,
    levelSoundEnv,
  }
}

const q = (s: string): string => JSON.stringify(s)
const b = (v: boolean): number => (v ? 1 : 0)

/** Renders `src/common/audio/sounds-113c.ts`. */
export function renderSoundsModule(pack: SoundTablesPack): string {
  const lines: string[] = [
    '/**',
    ' * Authoritative Diablo II: Lord of Destruction v1.13c Sounds.txt table (4,699 records, Index 0..4698)',
    ' * after D2Client.dll 0x6fb0e8e1–0x6fb0e990 load post-processing (`Group Size` 0 -> 1, `groupBase` leader',
    ' * propagation, `nBlocks` leading Block 1..3 != -1 count, and `MUSIC_SOUND_RANGE_113C = [4657, 4684]`).',
    ' *',
    ` * Source: ${pack.soundsArchive} (\`${SOUNDS_MEMBER}\`, ${String(pack.sounds.length)} records).`,
    ' * GENERATED by `src/baker/packers/pack-sound-tables.ts` (`npm run bake -- sound-tables`). Do not edit by hand.',
    ' */',
    '',
    '/** One 1.13c Sounds.txt record after D2Client 0x6fb0e8e1–0x6fb0e952 load post-processing (stride 0x8e). */',
    'export interface SoundsRow113c {',
    '  readonly id: number',
    '  readonly sound: string',
    '  readonly rawSound: string',
    '  readonly fileName: string',
    '  readonly volume: number',
    '  readonly rawGroupSize: number',
    '  readonly groupSize: number',
    '  readonly groupBase: number',
    '  readonly loop: boolean',
    '  readonly fadeIn: number',
    '  readonly fadeOut: number',
    '  readonly deferInst: boolean',
    '  readonly stopInst: boolean',
    '  readonly duration: number',
    '  readonly compound: number',
    '  readonly reverb: boolean',
    '  readonly falloff: number',
    '  readonly cache: boolean',
    '  readonly asyncOnly: boolean',
    '  readonly priority: number',
    '  readonly stream: boolean',
    '  readonly stereo: number',
    '  readonly tracking: boolean',
    '  readonly solo: boolean',
    '  readonly musicVol: boolean',
    '  readonly block1: number',
    '  readonly block2: number',
    '  readonly block3: number',
    '  readonly nBlocks: number',
    '}',
    '',
    '/** Sounds.txt record count (`[0x6fbcc250]`). */',
    `export const SOUNDS_ROW_COUNT_113C = ${String(pack.sounds.length)}`,
    '',
    '/** Min / max `SoundEnviron.txt` `Song > 0` (`[0x6fbcc25c]..[0x6fbcc260]`). */',
    `export const MUSIC_SOUND_RANGE_113C: readonly [number, number] = [${String(pack.musicRange[0])}, ${String(pack.musicRange[1])}] as const`,
    '',
    'type RawSoundTuple113c = readonly [',
    '  id: number,',
    '  rawSound: string,',
    '  fileName: string,',
    '  volume: number,',
    '  rawGroupSize: number,',
    '  groupSize: number,',
    '  groupBase: number,',
    '  loop: 0 | 1,',
    '  fadeIn: number,',
    '  fadeOut: number,',
    '  deferInst: 0 | 1,',
    '  stopInst: 0 | 1,',
    '  duration: number,',
    '  compound: number,',
    '  reverb: 0 | 1,',
    '  falloff: number,',
    '  cache: 0 | 1,',
    '  asyncOnly: 0 | 1,',
    '  priority: number,',
    '  stream: 0 | 1,',
    '  stereo: number,',
    '  tracking: 0 | 1,',
    '  solo: 0 | 1,',
    '  musicVol: 0 | 1,',
    '  block1: number,',
    '  block2: number,',
    '  block3: number,',
    '  nBlocks: number,',
    ']',
    '',
    'const RAW_SOUNDS_113C: readonly RawSoundTuple113c[] = [',
  ]

  for (const r of pack.sounds) {
    lines.push(
      `  [${String(r.id)},${q(r.rawSound)},${q(r.fileName)},${String(r.volume)},${String(r.rawGroupSize)},${String(r.groupSize)},${String(r.groupBase)},${String(b(r.loop))},${String(r.fadeIn)},${String(r.fadeOut)},${String(b(r.deferInst))},${String(b(r.stopInst))},${String(r.duration)},${String(r.compound)},${String(b(r.reverb))},${String(r.falloff)},${String(b(r.cache))},${String(b(r.asyncOnly))},${String(r.priority)},${String(b(r.stream))},${String(r.stereo)},${String(b(r.tracking))},${String(b(r.solo))},${String(b(r.musicVol))},${String(r.block1)},${String(r.block2)},${String(r.block3)},${String(r.nBlocks)}],`,
    )
  }

  lines.push(
    ']',
    '',
    '/** All 4,699 Sounds.txt rows indexed by `id` (`0..4698`). */',
    'export const SOUNDS_113C: readonly SoundsRow113c[] = RAW_SOUNDS_113C.map((t) => ({',
    '  id: t[0],',
    '  sound: t[1].trim(),',
    '  rawSound: t[1],',
    '  fileName: t[2],',
    '  volume: t[3],',
    '  rawGroupSize: t[4],',
    '  groupSize: t[5],',
    '  groupBase: t[6],',
    '  loop: t[7] !== 0,',
    '  fadeIn: t[8],',
    '  fadeOut: t[9],',
    '  deferInst: t[10] !== 0,',
    '  stopInst: t[11] !== 0,',
    '  duration: t[12],',
    '  compound: t[13],',
    '  reverb: t[14] !== 0,',
    '  falloff: t[15],',
    '  cache: t[16] !== 0,',
    '  asyncOnly: t[17] !== 0,',
    '  priority: t[18],',
    '  stream: t[19] !== 0,',
    '  stereo: t[20],',
    '  tracking: t[21] !== 0,',
    '  solo: t[22] !== 0,',
    '  musicVol: t[23] !== 0,',
    '  block1: t[24],',
    '  block2: t[25],',
    '  block3: t[26],',
    '  nBlocks: t[27],',
    '}))',
    '',
    '/** Lowercase trimmed `Sound` name -> numeric `id` (`1..4698`). */',
    'export const SOUNDS_BY_NAME_113C: Readonly<Record<string, number>> = (() => {',
    '  const map: Record<string, number> = {}',
    '  for (const row of SOUNDS_113C) {',
    '    if (row.sound.length > 0) {',
    '      map[row.sound.toLowerCase()] = row.id',
    '    }',
    '  }',
    '  return map',
    '})()',
    '',
    '/** Returns the `SoundsRow113c` for `id`, or `undefined` if out of range. */',
    'export function getSoundRow113c(id: number): SoundsRow113c | undefined {',
    '  if (!Number.isInteger(id) || id < 0 || id >= SOUNDS_113C.length) return undefined',
    '  return SOUNDS_113C[id]',
    '}',
    '',
    '/** Looks up a numeric sound `id` by case-insensitive trimmed `Sound` name. */',
    'export function getSoundIdByName113c(name: string): number | undefined {',
    '  const key = name.trim().toLowerCase()',
    '  if (key.length === 0) return undefined',
    '  return SOUNDS_BY_NAME_113C[key]',
    '}',
    '',
    '/**',
    ' * Resolves the canonical 1.13c MPQ member path per `BuildSoundPath` (`D2Client.dll` `0x6fb0db30`):',
    ' * - `2934 <= id <= 4656`: `DATA\\LOCAL\\SFX\\<FileName>`',
    ' * - `4657 <= id <= 4698`: `DATA\\GLOBAL\\MUSIC\\<FileName>`',
    ' * - `1 <= id <= 2933`: `DATA\\GLOBAL\\SFX\\<FileName>`',
    ' * - Returns `null` when `id <= 0` or `fileName` is `"none.wav"`.',
    ' */',
    'export function buildSoundMpqPath113c(id: number, fileName?: string): string | null {',
    '  if (!Number.isInteger(id) || id <= 0 || id >= SOUNDS_ROW_COUNT_113C) return null',
    '  const fn = (fileName ?? SOUNDS_113C[id]?.fileName ?? "").trim()',
    '  if (fn.length === 0 || fn.toLowerCase() === "none.wav") return null',
    '  const root = id >= 2934 && id <= 4656 ? "DATA\\\\LOCAL" : "DATA\\\\GLOBAL"',
    '  const sub = id >= 4657 && id <= 4698 ? "\\\\MUSIC\\\\" : "\\\\SFX\\\\"',
    '  return `${root}${sub}${fn}`',
    '}',
    '',
  )

  return lines.join('\n')
}

/** Renders `src/common/audio/sound-environ-113c.ts`. */
export function renderSoundEnvironModule(pack: SoundTablesPack): string {
  const lines: string[] = [
    '/**',
    ' * Authoritative Diablo II: Lord of Destruction v1.13c SoundEnviron.txt table (50 records, Index 0..49)',
    ' * and Levels.txt SoundEnv mappings for all 136 levels (Id 1..136 -> SoundEnv 0..49).',
    ' *',
    ` * Sources: ${pack.soundEnvironArchive} (\`${SOUND_ENVIRON_MEMBER}\`, 50 records); ${pack.levelsArchive} (\`${LEVELS_MEMBER}\`, 136 levels).`,
    ' * GENERATED by `src/baker/packers/pack-sound-tables.ts` (`npm run bake -- sound-tables`). Do not edit by hand.',
    ' */',
    '',
    '/** One 1.13c SoundEnviron.txt record (D2Client table `[0x6fbcc254]`, stride 0x58). */',
    'export interface SoundEnvironRow113c {',
    '  readonly index: number',
    '  readonly handle: string',
    '  readonly song: number',
    '  readonly dayAmbience: number',
    '  readonly nightAmbience: number',
    '  readonly dayEvent: number',
    '  readonly nightEvent: number',
    '  readonly eventDelay: number',
    '  readonly indoors: number',
    '  readonly material1: number',
    '  readonly material2: number',
    '  readonly eaxEnviron: number',
    '  readonly eaxEnvSize: number',
    '  readonly eaxEnvDiff: number',
    '  readonly eaxRoomVol: number',
    '  readonly eaxRoomHF: number',
    '  readonly eaxDecayTime: number',
    '  readonly eaxDecayHF: number',
    '  readonly eaxReflect: number',
    '  readonly eaxReflectDelay: number',
    '  readonly eaxReverb: number',
    '  readonly eaxRevDelay: number',
    '  readonly eaxRoomRoll: number',
    '  readonly eaxAirAbsorb: number',
    '}',
    '',
    '/** SoundEnviron.txt record count (`[0x6fbcc258]`). */',
    `export const SOUND_ENVIRON_ROW_COUNT_113C = ${String(pack.soundEnvironments.length)}`,
    '',
    '/** All 50 SoundEnviron.txt records indexed by `index` (`0..49`). */',
    'export const SOUND_ENVIRON_113C: readonly SoundEnvironRow113c[] = [',
  ]

  for (const e of pack.soundEnvironments) {
    lines.push(
      '  {',
      `    index: ${String(e.index)}, handle: ${q(e.handle)}, song: ${String(e.song)},`,
      `    dayAmbience: ${String(e.dayAmbience)}, nightAmbience: ${String(e.nightAmbience)}, dayEvent: ${String(e.dayEvent)}, nightEvent: ${String(e.nightEvent)},`,
      `    eventDelay: ${String(e.eventDelay)}, indoors: ${String(e.indoors)}, material1: ${String(e.material1)}, material2: ${String(e.material2)},`,
      `    eaxEnviron: ${String(e.eaxEnviron)}, eaxEnvSize: ${String(e.eaxEnvSize)}, eaxEnvDiff: ${String(e.eaxEnvDiff)}, eaxRoomVol: ${String(e.eaxRoomVol)},`,
      `    eaxRoomHF: ${String(e.eaxRoomHF)}, eaxDecayTime: ${String(e.eaxDecayTime)}, eaxDecayHF: ${String(e.eaxDecayHF)}, eaxReflect: ${String(e.eaxReflect)},`,
      `    eaxReflectDelay: ${String(e.eaxReflectDelay)}, eaxReverb: ${String(e.eaxReverb)}, eaxRevDelay: ${String(e.eaxRevDelay)}, eaxRoomRoll: ${String(e.eaxRoomRoll)}, eaxAirAbsorb: ${String(e.eaxAirAbsorb)},`,
      '  },',
    )
  }

  lines.push(
    ']',
    '',
    '/** Levels.txt SoundEnv mapping for all 136 levels (`levelId 1..136` -> `SoundEnviron.txt` `index 0..49`). */',
    'export const LEVEL_SOUND_ENV_113C: Readonly<Record<number, number>> = {',
  )

  for (let levelId = 1; levelId <= 136; levelId += 1) {
    const envIdx = pack.levelSoundEnv[levelId]!
    lines.push(`  ${String(levelId)}: ${String(envIdx)},`)
  }

  lines.push(
    '}',
    '',
    '/** Resolves the `SoundEnvironRow113c` for a level (`1..136`). Throws if `levelId` is outside `1..136`. */',
    'export function getSoundEnvironForLevel113c(levelId: number): SoundEnvironRow113c {',
    '  const envIdx = LEVEL_SOUND_ENV_113C[levelId]',
    '  if (envIdx === undefined) {',
    '    throw new Error(`getSoundEnvironForLevel113c: unknown levelId ${String(levelId)}`)',
    '  }',
    '  const env = SOUND_ENVIRON_113C[envIdx]',
    '  if (env === undefined) {',
    '    throw new Error(`getSoundEnvironForLevel113c: invalid SoundEnv index ${String(envIdx)} for levelId ${String(levelId)}`)',
    '  }',
    '  return env',
    '}',
    '',
  )

  return lines.join('\n')
}

async function main(): Promise<void> {
  const mpqDir = process.argv[2] ?? DEFAULT_NODE_MPQ_DIR
  const pack = await buildSoundTablesPack(mountSoundTableArchives(mpqDir))
  const soundsOut = resolve(SOUNDS_TS_FILE)
  const environOut = resolve(SOUND_ENVIRON_TS_FILE)
  writeFileSync(soundsOut, renderSoundsModule(pack))
  writeFileSync(environOut, renderSoundEnvironModule(pack))
  console.log(
    `pack-sound-tables: ${String(pack.sounds.length)} Sounds.txt rows -> ${soundsOut}; ${String(pack.soundEnvironments.length)} SoundEnviron.txt rows + 136 level SoundEnv mappings -> ${environOut}`,
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
