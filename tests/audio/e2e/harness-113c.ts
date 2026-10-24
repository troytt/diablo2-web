/**
 * M21 (Gitea Milestone #15, issues #943–#948) strict E2E harness — independent Diablo II LoD v1.13c
 * ground-truth oracle + product loaders.
 *
 * Rules this harness follows (see `.agents/teamwork/test_writer_m21r1_e2e/TEST_INFRA.md`):
 * - Every expected value is derived from the authoritative 1.13c MPQ archives
 *   (`samples/d2`, read through the repo's own MPQ reader:
 *   `MpqArchive` + `MountedArchives`) or from D2Client.dll facts cited by address. The product's
 *   generated tables are NEVER used as the oracle.
 * - The text tables are parsed by this file's own TSV reader and the D2Client post-processing is
 *   re-derived here from the disassembly (not copied from the product packer).
 * - Product modules are loaded dynamically and a missing module / export / artifact makes the
 *   calling test FAIL with an explicit message. There are no skip guards and no "return null when
 *   absent" loaders.
 * - The only test doubles are output sinks the product itself defines as injection points
 *   (`SoundVoiceBackend`): they record what the product emits, they never stand in for product logic.
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MpqArchive } from '../../../src/common/mpq/archive.ts'
import { MountedArchives } from '../../../src/common/mpq/mount.ts'
import { syncNodeFileSource } from '../../../src/baker/mpq-archive-source.ts'

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Repository (worktree) root: `tests/audio/e2e/` → three levels up. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/** Authoritative 1.13c data directory (MPQs + DLLs). Override with `M21_D2_DATA_DIR`. */
export const D2_DATA_DIR = process.env.M21_D2_DATA_DIR ?? join(homedir(), 'd2-data')

/**
 * 1.13c archive priority, highest first (PROJECT.md § Architecture: Patch_D2 > d2exp > d2char >
 * d2data > d2sfx > d2xtalk > d2speech > D2xMusic > d2music). `MountedArchives.find` searches the
 * most recently added archive first, so they are mounted in reverse.
 */
export const MPQ_PRIORITY_113C = [
  'Patch_D2.mpq',
  'd2exp.mpq',
  'd2char.mpq',
  'd2data.mpq',
  'd2sfx.mpq',
  'd2xtalk.mpq',
  'd2speech.mpq',
  'D2xMusic.mpq',
  'd2music.mpq',
] as const

/** Product files the suite exercises (PROJECT.md § Code Layout / Interface Contracts). */
export const PRODUCT = {
  sounds: 'src/common/audio/sounds-113c.ts',
  soundEnviron: 'src/common/audio/sound-environ-113c.ts',
  wav: 'src/common/formats/wav.ts',
  records: 'src/client/audio/sound-records-113c.ts',
  audit: 'src/baker/audit/verify-audio-113c.ts',
  verifyAudioCli: 'tools/verify-audio.ts',
  packSoundTables: 'src/baker/packers/pack-sound-tables.ts',
  bakerCli: 'src/baker/cli.ts',
  packageJson: 'package.json',
  // M2 (#944) — PROJECT.md § Code Layout / reland_plan §E.2
  sfxPackIndex: 'src/common/audio/sfx-pack-index-113c.ts',
  packSfx: 'src/baker/packers/pack-sfx.ts',
  sfxChunkLoader: 'src/client/audio/sfx-chunk-loader.ts',
  soundVoices: 'src/client/audio/sound-voices-webaudio.ts',
  audioRuntime: 'src/client/audio/audio-runtime-113c.ts',
  clientSettings: 'src/client/settings/client-settings.ts',
  settingsStore: 'src/client/settings/settings-store.ts',
  clientWorld: 'src/client/world/client-world.ts',
  packContract: 'src/common/pack-contract/index.ts',
  assetManifest: 'src/baker/io/asset-manifest.ts',
  netprotoMisc: 'src/netproto/d2gs/s2c/misc.ts',
  netprotoRegistry: 'src/netproto/d2gs/registry.ts',
  gitignore: '.gitignore',
  // M3 (#945) — PROJECT.md § Code Layout
  packMusic: 'src/baker/packers/pack-music.ts',
  musicTracks: 'src/common/audio/music-tracks-113c.ts',
  musicStreamer: 'src/client/audio/music-streamer.ts',
  // M4 (#946) — PROJECT.md § Code Layout
  packAmbientSounds: 'src/baker/packers/pack-ambient-sounds.ts',
  soundEnvironClient: 'src/client/audio/sound-environ-113c.ts',
  // M5 (#947) — PROJECT.md § Code Layout
  packSkillSounds: 'src/baker/packers/pack-skill-sounds.ts',
  skillSounds: 'src/common/audio/skill-sounds-113c.ts',
  // M6 (#948) — PROJECT.md § Code Layout
  packMonsterSounds: 'src/baker/packers/pack-monster-sounds.ts',
  packSpeech: 'src/baker/packers/pack-speech.ts',
  monSounds: 'src/common/audio/mon-sounds-113c.ts',
  speechIndex: 'src/common/audio/speech-index-113c.ts',
  speechStreamer: 'src/client/audio/speech-streamer.ts',
  sw: 'src/client/sw/sw.ts',
} as const

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// D16 SPEC-CONSTANT BLOCK (the ONLY place BGM / speech caps live in this suite)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * ╔════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║ SPEC CONSTANTS — PROJECT.md decision D16 (BGM & speech bitrate vs size caps)                 ║
 * ║ STATUS: DECIDED by the user 2026-10-10 22:24 Beijing (14:24Z), verbatim in                   ║
 * ║ `sentinel_m21_1_gen2/ORIGINAL_REQUEST.md` "Follow-up (User Decision D16)".                    ║
 * ║ Only the orchestrator (`orchestrator_m21_1_gen2`) edits this block.                           ║
 * ║                                                                                              ║
 * ║ BGM (#945): Opus 64 kbps stereo is the FLOOR (measured, never below); total ≤ 72,000,000 B,  ║
 * ║ each track ≤ 4,500,000 B (decimal reading).                                                  ║
 * ║ Speech (#948): Opus 24 kbps mono is the FLOOR (measured, never below); total ≤ 45,000,000 B. ║
 * ║ P3/P6 assert that the product's NAMED constants equal these values and that the baked        ║
 * ║ artifacts respect them — the numbers are never repeated anywhere else in the suite.          ║
 * ╚════════════════════════════════════════════════════════════════════════════════════════════╝
 */
export interface D16SpecConstants {
  readonly status: 'PENDING' | 'DECIDED'
  readonly decidedOption: string | null
  readonly bgm: {
    /** Measured floor (never below); there is no upper bitrate bound in the decision. */
    readonly minBitrateBps: number | null
    readonly totalMaxBytes: number | null
    readonly perTrackMaxBytes: number | null
    readonly channels: 2
  }
  readonly speech: {
    /** Measured floor (never below). */
    readonly minBitrateBps: number | null
    readonly totalMaxBytes: number | null
    readonly channels: 1
  }
}

export const D16_SPEC: D16SpecConstants = {
  status: 'DECIDED',
  decidedOption: 'BGM: option A; speech: user compromise (24 kbps floor, 45 MB total)',
  bgm: { minBitrateBps: 64_000, totalMaxBytes: 72_000_000, perTrackMaxBytes: 4_500_000, channels: 2 },
  speech: { minBitrateBps: 24_000, totalMaxBytes: 45_000_000, channels: 1 },
}

/** Returns the decided D16 constants (throws a clear "D16 pending" error if ever reset to PENDING). */
export function requireD16Decided(): D16SpecConstants {
  if (D16_SPEC.status !== 'DECIDED') {
    throw new Error(
      'D16 PENDING: BGM/speech bitrate-vs-cap decision has not been recorded in tests/audio/e2e/harness-113c.ts ' +
        '(D16_SPEC). The orchestrator must fill the decided values before #945/#948 caps can be gated.',
    )
  }
  return D16_SPEC
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Short-SFX quality floor (request R2, PROJECT.md D1) — authoritative, not pending.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Request R2: ≥ 24 kbps mono, ≥ 40 kbps stereo, measured per chunk (D1: payload bits ÷ decoded duration). */
export const SFX_FLOOR_BPS_113C = { mono: 24_000, stereo: 40_000 } as const
/** Request R2 / D2: hard cap of the first-screen pack. */
export const SFX_CORE_MAX_BYTES = 800_000

/**
 * Request R2 + PROJECT.md D2/D3: content of the two core tiers = ALL `Stream = 0` Sounds.txt rows
 * whose FileName starts with one of these folders (Sounds.txt spelling, case-insensitive).
 */
export const R2_FIRST_SCREEN_PREFIXES_113C = ['cursor\\', 'item\\', 'combat\\', 'ambient\\footstep\\'] as const
export const R2_BACKGROUND_PREFIXES_113C = ['object\\', 'quest\\', 'ambient\\creature\\'] as const
/**
 * D3: #944's own size estimate for the second core pack is "~890 KB"; read as a decimal upper bound,
 * every background part must fit (otherwise it is split along whole subfolders into `-2`, `-3`, …).
 */
export const D3_BACKGROUND_PART_MAX_BYTES = 890_000
/** reland_plan §E.2 (PROJECT.md M2 baseline): `D2SP` magic, u32 version 2, u32 chunkCount, chunks from offset 12. */
export const E2_SFX_PACK_FORMAT = { magic: 'D2SP', version: 2, headerBytes: 12 } as const

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Independent TSV reader (the product's packer uses its own parser; this one is separate on purpose)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface Txt113c {
  readonly header: readonly string[]
  readonly rows: readonly (readonly string[])[]
  col(name: string): number
}

/** Parses a 1.13c tab-separated excel table (Latin-1, CRLF), keeping raw cell text. */
export function parseTxt113c(bytes: Uint8Array, what: string): Txt113c {
  const text = new TextDecoder('latin1').decode(bytes)
  const lines = text.split(/\r?\n/)
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (lines.length === 0) throw new Error(`${what}: empty table`)
  const header = lines[0]!.split('\t')
  const rows = lines.slice(1).map((l) => l.split('\t'))
  const index = new Map<string, number>()
  header.forEach((h, i) => {
    if (!index.has(h)) index.set(h, i)
  })
  return {
    header,
    rows,
    col(name: string): number {
      const i = index.get(name)
      if (i === undefined) throw new Error(`${what}: no column '${name}'`)
      return i
    },
  }
}

function strictInt(raw: string, what: string): number {
  const t = raw.trim()
  if (!/^-?\d+$/.test(t)) throw new Error(`${what}: '${raw}' is not an integer`)
  return Number(t)
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Oracle types
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** One Sounds.txt record after the D2Client.dll load post-processing (oracle view). */
export interface OracleSoundRow {
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

export interface OracleSoundEnvironRow {
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

export interface OracleLevel {
  readonly id: number
  readonly name: string
  /** 1..5 (`Levels.txt` `Act` is 0-based). */
  readonly act: number
  readonly soundEnv: number
}

/** Independent RIFF/WAVE header facts of an MPQ member. */
export interface OracleWavFacts {
  readonly id: number
  readonly member: string
  readonly archive: string
  readonly fileBytes: number
  readonly formatTag: number
  readonly channels: number
  readonly sampleRate: number
  readonly bitsPerSample: number
  readonly blockAlign: number
  readonly frames: number
  readonly dataOffset: number
  readonly dataBytes: number
  readonly sha256: string
}

export interface Oracle113c {
  readonly archives: MountedArchives
  readonly sounds: readonly OracleSoundRow[]
  readonly soundsByName: ReadonlyMap<string, number>
  readonly musicRange: readonly [number, number]
  readonly soundEnviron: readonly OracleSoundEnvironRow[]
  /** SoundEnviron.txt as shipped in d2exp.mpq alone (before Patch_D2) — evidence for mount order. */
  readonly soundEnvironD2expOnly: readonly OracleSoundEnvironRow[]
  readonly levels: ReadonlyMap<number, OracleLevel>
  /** Archive that serves each excel member (diagnostics). */
  readonly excelArchive: Readonly<Record<string, string>>
  /** Playable rows (id 1..4698, real FileName) whose BuildSoundPath member is in no mounted archive. */
  readonly missingMemberIds: readonly number[]
  /** Raw excel tables (for later P-files). */
  table(member: string): Txt113c
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// D2Client.dll facts used by the oracle (each verified with `objdump -d` on the shipped 1.13c DLL;
// image base 0x6fab0000)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * BuildSoundPath `0x6fb0db30`: prefix `DATA\LOCAL` (string @0x6fb8349c) when `0xb76 ≤ id ≤ 0x1230`
 * (2934..4656) else `DATA\GLOBAL` (@0x6fb8357c); then `\MUSIC\` (@0x6fb853ec) when
 * `0x1231 ≤ id ≤ 0x125a` (4657..4698) else `\SFX\` (@0x6fb853e4); then the row's FileName; the
 * whole path must stay below 0x50 bytes (assert at 0x6fb0dc1e). Returns null for rows the game
 * never resolves (id outside 1..4698 or a `none.wav` / empty FileName).
 */
export function oracleBuildSoundPath(id: number, fileName: string): string | null {
  if (!Number.isInteger(id) || id <= 0 || id >= 4699) return null
  const fn = fileName.trim()
  if (fn.length === 0 || fn.toLowerCase() === 'none.wav') return null
  const root = id >= 0xb76 && id <= 0x1230 ? 'DATA\\LOCAL' : 'DATA\\GLOBAL'
  const sub = id >= 0x1231 && id <= 0x125a ? '\\MUSIC\\' : '\\SFX\\'
  const path = `${root}${sub}${fn}`
  if (path.length >= 0x50) throw new Error(`BuildSoundPath 0x6fb0dc1e: '${path}' is >= 0x50 bytes`)
  return path
}

/**
 * Load post-processing `0x6fb0e8e1–0x6fb0e952` (records 1..count-1, stride 0x8e; `esi` = record
 * + 0x3d = `Group Size` byte):
 *   groupBase(+0x60) = (leader != 0 && id >= leader && id < leader + leaderSize) ? leader : id
 *   if (GroupSize != 0) { leader = id; leaderSize = GroupSize } else GroupSize = 1
 *   nBlocks(+0x80) = count of leading Block1..3 (+0x54/+0x58/+0x5c) that are != -1
 * Record 0 is not visited (stays zero-initialised by the `rep stos` at 0x6fb0e8bb, except the
 * fields the txt loader fills). musicRange `0x6fb0e954–0x6fb0e990`: min/max of SoundEnviron
 * `Song > 0`, min initialised to the record count, max to 0, stored at [0x6fbcc25c]/[0x6fbcc260].
 */
function postProcessSounds(raw: { groupSize: number; blocks: readonly [number, number, number] }[]): {
  groupSize: number[]
  groupBase: number[]
  nBlocks: number[]
} {
  const groupSize = raw.map((r) => r.groupSize)
  const groupBase = raw.map(() => 0)
  const nBlocks = raw.map(() => 0)
  let leader = 0
  let leaderSize = 1
  for (let id = 1; id < raw.length; id += 1) {
    groupBase[id] = leader !== 0 && id >= leader && id < leader + leaderSize ? leader : id
    if (raw[id]!.groupSize !== 0) {
      leader = id
      leaderSize = raw[id]!.groupSize
    } else {
      groupSize[id] = 1
    }
    let n = 0
    while (n < 3 && raw[id]!.blocks[n] !== -1) n += 1
    nBlocks[id] = n
  }
  return { groupSize, groupBase, nBlocks }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Oracle construction
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export const SOUNDS_MEMBER = 'data\\global\\excel\\Sounds.txt'
export const SOUND_ENVIRON_MEMBER = 'data\\global\\excel\\SoundEnviron.txt'
export const LEVELS_MEMBER = 'data\\global\\excel\\Levels.txt'

let cachedOracle: Oracle113c | null = null
const archiveByLabel = new Map<string, MpqArchive>()

function requireDataDir(): void {
  for (const name of MPQ_PRIORITY_113C) {
    if (!existsSync(join(D2_DATA_DIR, name))) {
      throw new Error(`M21 oracle: authoritative 1.13c archive missing: ${join(D2_DATA_DIR, name)}`)
    }
  }
}

function parseSoundEnviron(t: Txt113c, what: string): OracleSoundEnvironRow[] {
  const n = (r: readonly string[], c: string, i: number): number => strictInt(r[t.col(c)] ?? '', `${what} row ${String(i)} '${c}'`)
  return t.rows.map((r, i) => ({
    index: n(r, 'Index', i),
    handle: (r[t.col('Handle')] ?? '').trim(),
    song: n(r, 'Song', i),
    dayAmbience: n(r, 'Day Ambience', i),
    nightAmbience: n(r, 'Night Ambience', i),
    dayEvent: n(r, 'Day Event', i),
    nightEvent: n(r, 'Night Event', i),
    eventDelay: n(r, 'Event Delay', i),
    indoors: n(r, 'Indoors', i),
    material1: n(r, 'Material 1', i),
    material2: n(r, 'Material 2', i),
    eaxEnviron: n(r, 'EAX Environ', i),
    eaxEnvSize: n(r, 'EAX Env Size', i),
    eaxEnvDiff: n(r, 'EAX Env Diff', i),
    eaxRoomVol: n(r, 'EAX Room Vol', i),
    eaxRoomHF: n(r, 'EAX Room HF', i),
    eaxDecayTime: n(r, 'EAX Decay Time', i),
    eaxDecayHF: n(r, 'EAX Decay HF', i),
    eaxReflect: n(r, 'EAX Reflect', i),
    eaxReflectDelay: n(r, 'EAX Reflect Delay', i),
    eaxReverb: n(r, 'EAX Reverb', i),
    eaxRevDelay: n(r, 'EAX Rev Delay', i),
    eaxRoomRoll: n(r, 'EAX Room Roll', i),
    eaxAirAbsorb: n(r, 'EAX Air Absorb', i),
  }))
}

/** Builds (once per worker) the oracle from the MPQs. Throws — never skips — when data is missing. */
export function getOracle113c(): Oracle113c {
  if (cachedOracle !== null) return cachedOracle
  requireDataDir()
  const archives = new MountedArchives()
  for (const name of [...MPQ_PRIORITY_113C].reverse()) {
    const archive = MpqArchive.openSync(syncNodeFileSource(join(D2_DATA_DIR, name)))
    archives.add(name, archive)
    archiveByLabel.set(name, archive)
  }
  const tables = new Map<string, Txt113c>()
  const excelArchive: Record<string, string> = {}
  const table = (member: string): Txt113c => {
    const hit = tables.get(member)
    if (hit !== undefined) return hit
    const found = archives.find(member)
    if (found === undefined) throw new Error(`M21 oracle: ${member} is in no mounted 1.13c archive`)
    excelArchive[member] = found.entry.label
    const parsed = parseTxt113c(found.entry.archive.readSync(found.file), member)
    tables.set(member, parsed)
    return parsed
  }

  // Sounds.txt
  const st = table(SOUNDS_MEMBER)
  const raw = st.rows.map((r, i) => {
    const n = (c: string): number => strictInt(r[st.col(c)] ?? '', `Sounds.txt row ${String(i)} '${c}'`)
    if (n('Index') !== i) throw new Error(`Sounds.txt row ${String(i)}: Index ${String(n('Index'))} != position`)
    return {
      rawSound: r[st.col('Sound')] ?? '',
      fileName: r[st.col('FileName')] ?? '',
      volume: n('Volume'),
      groupSize: n('Group Size'),
      loop: n('Loop'),
      fadeIn: n('Fade In'),
      fadeOut: n('Fade Out'),
      deferInst: n('Defer Inst'),
      stopInst: n('Stop Inst'),
      duration: n('Duration'),
      compound: n('Compound'),
      reverb: n('Reverb'),
      falloff: n('Falloff'),
      cache: n('Cache'),
      asyncOnly: n('Async Only'),
      priority: n('Priority'),
      stream: n('Stream'),
      stereo: n('Stereo'),
      tracking: n('Tracking'),
      solo: n('Solo'),
      musicVol: n('Music Vol'),
      blocks: [n('Block 1'), n('Block 2'), n('Block 3')] as const,
    }
  })
  const pp = postProcessSounds(raw)
  const sounds: OracleSoundRow[] = raw.map((r, id) => ({
    id,
    sound: r.rawSound.trim(),
    rawSound: r.rawSound,
    fileName: r.fileName,
    volume: r.volume,
    rawGroupSize: r.groupSize,
    groupSize: pp.groupSize[id]!,
    groupBase: pp.groupBase[id]!,
    loop: r.loop !== 0,
    fadeIn: r.fadeIn,
    fadeOut: r.fadeOut,
    deferInst: r.deferInst !== 0,
    stopInst: r.stopInst !== 0,
    duration: r.duration,
    compound: r.compound,
    reverb: r.reverb !== 0,
    falloff: r.falloff,
    cache: r.cache !== 0,
    asyncOnly: r.asyncOnly !== 0,
    priority: r.priority,
    stream: r.stream !== 0,
    stereo: r.stereo,
    tracking: r.tracking !== 0,
    solo: r.solo !== 0,
    musicVol: r.musicVol !== 0,
    block1: r.blocks[0],
    block2: r.blocks[1],
    block3: r.blocks[2],
    nBlocks: pp.nBlocks[id]!,
  }))
  const soundsByName = new Map<string, number>()
  for (const s of sounds) if (s.sound.length > 0) soundsByName.set(s.sound.toLowerCase(), s.id)

  // SoundEnviron.txt (mounted chain = Patch_D2 wins) and d2exp-only copy.
  const soundEnviron = parseSoundEnviron(table(SOUND_ENVIRON_MEMBER), 'SoundEnviron.txt')
  const d2exp = archiveByLabel.get('d2exp.mpq')!
  const envExpFile = d2exp.find(SOUND_ENVIRON_MEMBER)
  if (envExpFile === undefined) throw new Error('M21 oracle: d2exp.mpq has no SoundEnviron.txt')
  const soundEnvironD2expOnly = parseSoundEnviron(parseTxt113c(d2exp.readSync(envExpFile), 'd2exp SoundEnviron.txt'), 'd2exp SoundEnviron.txt')
  let musicMin = sounds.length
  let musicMax = 0
  for (const e of soundEnviron) {
    if (e.song > 0) {
      if (e.song < musicMin) musicMin = e.song
      if (e.song > musicMax) musicMax = e.song
    }
  }

  // Levels.txt (Id 1..136; the 'Expansion' separator row has no Id).
  const lt = table(LEVELS_MEMBER)
  const levels = new Map<number, OracleLevel>()
  for (const r of lt.rows) {
    const rawId = (r[lt.col('Id')] ?? '').trim()
    if (!/^\d+$/.test(rawId)) continue
    const id = Number(rawId)
    if (id < 1 || id > 136) continue
    levels.set(id, {
      id,
      name: (r[lt.col('Name')] ?? '').trim(),
      act: strictInt(r[lt.col('Act')] ?? '', `Levels.txt Id=${rawId} Act`) + 1,
      soundEnv: strictInt(r[lt.col('SoundEnv')] ?? '', `Levels.txt Id=${rawId} SoundEnv`),
    })
  }
  if (levels.size !== 136) throw new Error(`M21 oracle: Levels.txt yielded ${String(levels.size)} levels in 1..136`)

  const missingMemberIds: number[] = []
  for (const s of sounds) {
    const p = oracleBuildSoundPath(s.id, s.fileName)
    if (p !== null && archives.find(p) === undefined) missingMemberIds.push(s.id)
  }

  cachedOracle = {
    archives,
    sounds,
    soundsByName,
    musicRange: [musicMin, musicMax],
    soundEnviron,
    soundEnvironD2expOnly,
    levels,
    excelArchive,
    missingMemberIds,
    table,
  }
  return cachedOracle
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// WAV facts (independent RIFF walk; the product parser is NOT used here)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

function fourCc(b: Uint8Array, at: number): string {
  return String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!)
}

/** Minimal independent RIFF/WAVE walker (fmt + data chunks; other chunks skipped with pad byte). */
export function riffWavFacts(bytes: Uint8Array, what: string): Omit<OracleWavFacts, 'id' | 'member' | 'archive' | 'sha256'> {
  if (bytes.length < 12 || fourCc(bytes, 0) !== 'RIFF' || fourCc(bytes, 8) !== 'WAVE') throw new Error(`${what}: not RIFF/WAVE`)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 12
  let fmt: { tag: number; ch: number; sr: number; ba: number; bits: number } | null = null
  let data: { off: number; len: number } | null = null
  while (at + 8 <= bytes.length) {
    const id = fourCc(bytes, at)
    const size = dv.getUint32(at + 4, true)
    if (id === 'fmt ') {
      fmt = { tag: dv.getUint16(at + 8, true), ch: dv.getUint16(at + 10, true), sr: dv.getUint32(at + 12, true), ba: dv.getUint16(at + 20, true), bits: dv.getUint16(at + 22, true) }
    } else if (id === 'data') {
      data = { off: at + 8, len: size }
    }
    at += 8 + size + (size & 1)
  }
  if (fmt === null || data === null) throw new Error(`${what}: missing fmt/data`)
  return {
    fileBytes: bytes.length,
    formatTag: fmt.tag,
    channels: fmt.ch,
    sampleRate: fmt.sr,
    bitsPerSample: fmt.bits,
    blockAlign: fmt.ba,
    frames: Math.floor(data.len / fmt.ba),
    dataOffset: data.off,
    dataBytes: data.len,
  }
}

const wavCache = new Map<number, OracleWavFacts>()
const wavBytesCache = new Map<number, Uint8Array>()

/** Raw MPQ bytes of the WAV that BuildSoundPath resolves for `id` (throws when unshipped). */
export function oracleWavBytes(id: number): Uint8Array {
  const hit = wavBytesCache.get(id)
  if (hit !== undefined) return hit
  const o = getOracle113c()
  const row = o.sounds[id]
  if (row === undefined) throw new Error(`oracleWavBytes: no Sounds.txt row ${String(id)}`)
  const path = oracleBuildSoundPath(id, row.fileName)
  if (path === null) throw new Error(`oracleWavBytes: row ${String(id)} (${row.sound}) has no MPQ member`)
  const found = o.archives.find(path)
  if (found === undefined) throw new Error(`oracleWavBytes: ${path} (row ${String(id)}) is unshipped in 1.13c`)
  const bytes = found.entry.archive.readSync(found.file)
  if (id < 4657) wavBytesCache.set(id, bytes) // never cache music (tens of MB)
  return bytes
}

/** Independent WAV header facts of Sounds.txt row `id`'s MPQ member. */
export function oracleWavFacts(id: number): OracleWavFacts {
  const hit = wavCache.get(id)
  if (hit !== undefined) return hit
  const o = getOracle113c()
  const row = o.sounds[id]!
  const path = oracleBuildSoundPath(id, row.fileName)!
  const found = o.archives.find(path)!
  const bytes = oracleWavBytes(id)
  const facts: OracleWavFacts = {
    id,
    member: path,
    archive: found.entry.label,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    ...riffWavFacts(bytes, path),
  }
  wavCache.set(id, facts)
  return facts
}

/** `SoundSampleFacts113c`-shaped facts for injection into the product record layer. */
export function oracleSampleFacts(id: number): { readonly sampleRate: number; readonly frames: number; readonly channels: 1 | 2 } {
  const f = oracleWavFacts(id)
  if (f.channels !== 1 && f.channels !== 2) throw new Error(`row ${String(id)}: ${String(f.channels)} channels`)
  return { sampleRate: f.sampleRate, frames: f.frames, channels: f.channels }
}

/**
 * The variant ids D2Client `PickVariant 0x6fb0ee70` can return for a request of `id`
 * (re-verified with `objdump -d` on the shipped D2Client.dll, orchestrator arbitration 14:51Z):
 * - `ebp` = the requested id (`0x6fb0ee79`, re-read at `0x6fb0ef24`), `ebx` = row(id) = table +
 *   id·0x8e (`0x6fb0ee93`), `g` = Group Size byte `[ebx+0x3d]` of the REQUESTED row
 *   (`0x6fb0eea1` / `0x6fb0eee1`); `g ≤ 1` returns `id` unchanged (`0x6fb0eeab`);
 * - the pick is `id + rand(g)` (`0x6fb0ef2c`); the recent-pick history lives at row(id)+0x64
 *   (`0x6fb0ef35`);
 * - groupBase (+0x60) is never read here — it only matters to the Defer/Stop Inst and Compound
 *   conflict scans. A nested leader therefore picks from its OWN range (play(138) → 138..142, not
 *   the enclosing leader 134's range); members (post-processed Group Size 1) return themselves.
 */
export function oracleGroupMembers(id: number): number[] {
  const o = getOracle113c()
  const size = Math.max(1, o.sounds[id]!.groupSize)
  const out: number[] = []
  for (let k = 0; k < size; k += 1) out.push(id + k)
  return out
}

export interface RowPick {
  readonly maxRows?: number
  readonly minSeconds?: number
  readonly maxSeconds?: number
  readonly exclude?: ReadonlySet<number>
  readonly fromId?: number
  readonly toId?: number
}

/**
 * Deterministically picks the first rows (by id) that satisfy `pred` and whose shipped WAV lasts at
 * least `minSeconds` (WAV headers read from the MPQ). Throws when fewer than `count` exist.
 */
export function pickRows(count: number, pred: (r: OracleSoundRow) => boolean, opts: RowPick = {}): OracleSoundRow[] {
  const o = getOracle113c()
  const out: OracleSoundRow[] = []
  const missing = new Set(o.missingMemberIds)
  const from = opts.fromId ?? 1
  const to = opts.toId ?? 4656
  for (let id = from; id <= to && out.length < count; id += 1) {
    const r = o.sounds[id]!
    if (opts.exclude?.has(id) === true || missing.has(id) || oracleBuildSoundPath(id, r.fileName) === null || !pred(r)) continue
    if (opts.minSeconds !== undefined || opts.maxSeconds !== undefined) {
      const f = oracleWavFacts(id)
      const sec = f.frames / f.sampleRate
      if (opts.minSeconds !== undefined && sec < opts.minSeconds) continue
      if (opts.maxSeconds !== undefined && sec > opts.maxSeconds) continue
    }
    out.push(r)
  }
  if (out.length < count) throw new Error(`pickRows: only ${String(out.length)}/${String(count)} rows satisfy the predicate`)
  return out
}

/** A standalone one-shot SFX: own group of 1, not inside another group, no Defer/Stop/Compound. */
export function isPlainOneShot(r: OracleSoundRow): boolean {
  return (
    r.id > 0 &&
    r.id < 2934 &&
    !r.stream &&
    r.groupSize === 1 &&
    r.groupBase === r.id &&
    !r.loop &&
    !r.deferInst &&
    !r.stopInst &&
    r.compound === 0 &&
    r.volume > 0 &&
    r.duration === 0
  )
}

/** Sounds.txt FileName as an MPQ-style key: trimmed, lower-case, backslash separators. */
export function normSoundFile(fileName: string): string {
  return fileName.trim().toLowerCase().replace(/\//g, '\\')
}

/** Directory part (with trailing backslash) of a Sounds.txt FileName, e.g. `object\shrine\`. */
export function soundFileDir(fileName: string): string {
  const n = normSoundFile(fileName)
  return n.slice(0, n.lastIndexOf('\\') + 1)
}

/**
 * Request R2 pack content: every `Stream = 0` Sounds.txt row (id ≥ 1, FileName ≠ none.wav) whose
 * FileName starts with one of `prefixes`. Throws when such a row has no shipped WAV in the 1.13c
 * MPQ chain (the core folders have none missing — D9 lists only monster/speech files).
 */
export function oracleStream0Rows(prefixes: readonly string[]): OracleSoundRow[] {
  const o = getOracle113c()
  const missing = new Set(o.missingMemberIds)
  const out: OracleSoundRow[] = []
  for (const r of o.sounds) {
    if (r.id <= 0 || r.stream) continue
    const f = normSoundFile(r.fileName)
    if (f === 'none.wav' || !prefixes.some((p) => f.startsWith(p))) continue
    if (missing.has(r.id) || oracleBuildSoundPath(r.id, r.fileName) === null) {
      throw new Error(`oracleStream0Rows: row ${String(r.id)} (${r.fileName}) has no shipped WAV`)
    }
    out.push(r)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Product loading (fail loudly, never skip)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const moduleCache = new Map<string, Promise<Record<string, unknown>>>()

/**
 * Dynamically imports a product module. A missing file or a module that fails to evaluate makes
 * the calling test fail with `[feature] …` in the message.
 */
export function loadProductModule(rel: string, feature: string): Promise<Record<string, unknown>> {
  const cached = moduleCache.get(rel)
  if (cached !== undefined) return cached
  const abs = resolve(REPO_ROOT, rel)
  const p = (async () => {
    if (!existsSync(abs)) {
      throw new Error(`[${feature}] required product module is missing: ${rel} (feature not implemented on this tree)`)
    }
    try {
      return (await import(/* @vite-ignore */ pathToFileURL(abs).href)) as Record<string, unknown>
    } catch (err) {
      throw new Error(`[${feature}] product module ${rel} failed to load: ${String((err as Error)?.stack ?? err)}`)
    }
  })()
  moduleCache.set(rel, p)
  return p
}

/** Reads a named export, failing with a contract message when absent. */
export function requireExport<T>(mod: Record<string, unknown>, name: string, rel: string, feature: string): T {
  if (!(name in mod) || mod[name] === undefined) {
    throw new Error(`[${feature}] ${rel} does not export '${name}' (PROJECT.md interface contract)`)
  }
  return mod[name] as T
}

/** Reads a product/repo file as UTF-8 (fails clearly when missing). */
export function readRepoText(rel: string, feature: string): string {
  const abs = resolve(REPO_ROOT, rel)
  if (!existsSync(abs)) throw new Error(`[${feature}] required repo file is missing: ${rel}`)
  return readFileSync(abs, 'utf8')
}

export function readRepoBytes(rel: string, feature: string): Uint8Array {
  const abs = resolve(REPO_ROOT, rel)
  if (!existsSync(abs)) throw new Error(`[${feature}] required artifact is missing: ${rel}`)
  return new Uint8Array(readFileSync(abs))
}

/**
 * Throw-away mirror of the repository for audit mutation tests. Every repo-relative path in
 * `copies` ('/'-separated; a file or a directory) becomes a PRIVATE copy (directories copied
 * recursively, symlinks dereferenced); its ancestors become real directories whose other children
 * are symlinks into the real tree (symlinked inputs such as `public/` are followed); everything
 * else is a symlink. `tamper(root)` then edits the private copies. A missing `copies` path throws
 * (the artifact under test does not exist). The caller removes the mirror.
 */
export function mirrorRepoWithCopies(copies: readonly string[], tamper: (root: string) => void): string {
  const wanted = copies.map((c) => c.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
  for (const c of wanted) {
    if (c === '' || c.split('/').includes('..')) throw new Error(`mirrorRepoWithCopies: bad path '${c}'`)
    if (!existsSync(join(REPO_ROOT, c))) throw new Error(`mirrorRepoWithCopies: '${c}' does not exist in ${REPO_ROOT}`)
  }
  const ancestors = new Set<string>()
  for (const c of wanted) {
    const parts = c.split('/')
    for (let i = 1; i < parts.length; i += 1) ancestors.add(parts.slice(0, i).join('/'))
  }
  const root = mkdtempSync(join(tmpdir(), 'm21-mirror-'))
  const build = (rel: string): void => {
    const src = rel === '' ? REPO_ROOT : join(REPO_ROOT, rel)
    const dst = rel === '' ? root : join(root, rel)
    if (rel !== '') mkdirSync(dst)
    for (const name of readdirSync(src)) {
      const childRel = rel === '' ? name : `${rel}/${name}`
      if (wanted.includes(childRel)) cpSync(join(src, name), join(dst, name), { recursive: true, dereference: true })
      else if (ancestors.has(childRel)) build(childRel)
      else symlinkSync(join(src, name), join(dst, name))
    }
  }
  build('')
  tamper(root)
  return root
}

export interface CommandResult {
  readonly status: number | null
  readonly signal: NodeJS.Signals | null
  readonly stdout: string
  readonly stderr: string
  readonly ms: number
}

/** Runs a command at the repo root (used for `npm run verify:audio`, `bake:verify`, child vitest). */
export function runRepoCommand(cmd: string, args: readonly string[], timeoutMs: number, env: NodeJS.ProcessEnv = {}): CommandResult {
  const t0 = Date.now()
  const r: SpawnSyncReturns<string> = spawnSync(cmd, [...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', ...env },
  })
  return { status: r.status, signal: r.signal, stdout: r.stdout ?? '', stderr: r.stderr ?? '', ms: Date.now() - t0 }
}

/** Last `n` lines of a command's combined output (for assertion messages). */
export function tail(r: CommandResult, n = 40): string {
  return `${r.stdout}\n${r.stderr}`.split('\n').slice(-n).join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Output sink for the product record layer (`SoundVoiceBackend` injection point)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export type VoiceEvent =
  | { readonly kind: 'start'; readonly tick: number; readonly voice: number; readonly soundId: number; readonly loop: boolean; readonly offsetFrames: number }
  | { readonly kind: 'gains'; readonly tick: number; readonly voice: number; readonly left: number; readonly right: number }
  | { readonly kind: 'stop'; readonly tick: number; readonly voice: number }

/** Records everything the product sends to its voice backend. Holds no sound logic of its own. */
export class RecordingVoices {
  readonly events: VoiceEvent[] = []
  tick = 0
  start(voice: number, soundId: number, loop: boolean, offsetFrames: number): void {
    this.events.push({ kind: 'start', tick: this.tick, voice, soundId, loop, offsetFrames })
  }
  setGains(voice: number, left: number, right: number): void {
    this.events.push({ kind: 'gains', tick: this.tick, voice, left, right })
  }
  stop(voice: number): void {
    this.events.push({ kind: 'stop', tick: this.tick, voice })
  }
  stopAll(): void {
    /* optional backend method; records layer may call it on teardown */
  }
  starts(soundIds?: readonly number[]): Extract<VoiceEvent, { kind: 'start' }>[] {
    return this.events.filter((e): e is Extract<VoiceEvent, { kind: 'start' }> => e.kind === 'start' && (soundIds === undefined || soundIds.includes(e.soundId)))
  }
  stops(voice?: number): Extract<VoiceEvent, { kind: 'stop' }>[] {
    return this.events.filter((e): e is Extract<VoiceEvent, { kind: 'stop' }> => e.kind === 'stop' && (voice === undefined || e.voice === voice))
  }
  lastGains(voice: number): Extract<VoiceEvent, { kind: 'gains' }> | undefined {
    for (let i = this.events.length - 1; i >= 0; i -= 1) {
      const e = this.events[i]!
      if (e.kind === 'gains' && e.voice === voice) return e
    }
    return undefined
  }
  /** Voices started and not yet stopped. */
  liveVoices(): number[] {
    const live = new Set<number>()
    for (const e of this.events) {
      if (e.kind === 'start') live.add(e.voice)
      else if (e.kind === 'stop') live.delete(e.voice)
    }
    return [...live]
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Formats up to `max` mismatch lines for an assertion message. */
export function summarize(lines: readonly string[], max = 25): string {
  if (lines.length === 0) return '(none)'
  return `${String(lines.length)} mismatch(es):\n  ${lines.slice(0, max).join('\n  ')}${lines.length > max ? `\n  … ${String(lines.length - max)} more` : ''}`
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Independent Ogg / Opus container reader (RFC 3533 + RFC 7845) — used to MEASURE chunk bitrates
// (PROJECT.md D1: Opus audio-packet bits ÷ duration, per OpusHead channel count) and durations.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const OGG_CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let r = i << 24
    for (let k = 0; k < 8; k += 1) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1
    t[i] = r >>> 0
  }
  return t
})()

function oggCrc(bytes: Uint8Array, start: number, end: number, crcAt: number): number {
  let crc = 0
  for (let i = start; i < end; i += 1) {
    const b = i >= crcAt && i < crcAt + 4 ? 0 : bytes[i]!
    crc = ((crc << 8) ^ OGG_CRC_TABLE[((crc >>> 24) ^ b) & 0xff]!) >>> 0
  }
  return crc >>> 0
}

export interface OggOpusFacts {
  readonly bytes: number
  readonly pages: number
  readonly serials: number
  readonly channels: number
  readonly preSkip: number
  readonly inputSampleRate: number
  readonly audioPackets: number
  /** Sum of Opus audio packet sizes (OpusHead / OpusTags and Ogg framing excluded). */
  readonly audioPacketBytes: number
  /** Size of every Opus audio packet, in stream order. */
  readonly audioPacketSizes: readonly number[]
  /** 48 kHz samples carried by every audio packet (RFC 6716 §3.1 TOC + frame count). */
  readonly audioPacketSamples48k: readonly number[]
  readonly finalGranule: number
  /** (final granule − pre-skip) / 48000. */
  readonly decodedSeconds: number
  readonly eos: boolean
}

/** Frame duration in 1/10 ms for TOC configs 0..31 (RFC 6716 §3.1 Table 2). */
const OPUS_FRAME_TENTHS_MS: readonly number[] = [
  100, 200, 400, 600, 100, 200, 400, 600, 100, 200, 400, 600, // SILK NB / MB / WB
  100, 200, 100, 200, // Hybrid SWB / FB
  25, 50, 100, 200, 25, 50, 100, 200, 25, 50, 100, 200, 25, 50, 100, 200, // CELT NB / WB / SWB / FB
]

/** Samples at 48 kHz carried by ONE Opus packet (RFC 6716 §3.1: TOC config + code 0/1/2/3). Throws on malformed packets. */
export function opusPacketSamples48k(p: Uint8Array, what: string): number {
  if (p.length < 1) throw new Error(`${what}: empty Opus packet`)
  const toc = p[0]!
  const tenths = OPUS_FRAME_TENTHS_MS[toc >> 3]!
  const code = toc & 3
  let frames: number
  if (code === 0) frames = 1
  else if (code === 1 || code === 2) frames = 2
  else {
    if (p.length < 2) throw new Error(`${what}: code-3 Opus packet without a frame-count byte`)
    frames = p[1]! & 0x3f
    if (frames === 0) throw new Error(`${what}: code-3 Opus packet with 0 frames`)
  }
  if (frames * tenths > 1200) throw new Error(`${what}: Opus packet longer than 120 ms`)
  return (frames * tenths * 48) / 10
}

/**
 * Strictly parses ONE complete Ogg Opus logical stream occupying all of `bytes`: every page has
 * the `OggS` capture pattern, version 0, a valid CRC-32 and the same serial; first packet is
 * `OpusHead` (version 1), second `OpusTags`; the last page has the EOS flag. Throws on any violation.
 */
export function oggOpusFacts(bytes: Uint8Array, what: string): OggOpusFacts {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 0
  let pages = 0
  const serials = new Set<number>()
  const packets: number[] = []
  const samples: number[] = []
  let current = 0
  let open = false
  let firstPacket: Uint8Array | null = null
  let secondPacket: Uint8Array | null = null
  let packetBuf: number[] = []
  let finalGranule = 0
  let eos = false
  while (at < bytes.length) {
    if (at + 27 > bytes.length || fourCc(bytes, at) !== 'OggS') throw new Error(`${what}: no OggS page at ${String(at)}`)
    if (bytes[at + 4] !== 0) throw new Error(`${what}: Ogg version ${String(bytes[at + 4])}`)
    if (eos) throw new Error(`${what}: data after the EOS page`)
    const headerType = bytes[at + 5]!
    const granuleLo = dv.getUint32(at + 6, true)
    const granuleHi = dv.getInt32(at + 10, true)
    const serial = dv.getUint32(at + 14, true)
    const nseg = bytes[at + 26]!
    const bodyStart = at + 27 + nseg
    if (bodyStart > bytes.length) throw new Error(`${what}: truncated segment table at ${String(at)}`)
    let bodyLen = 0
    for (let i = 0; i < nseg; i += 1) bodyLen += bytes[at + 27 + i]!
    const end = bodyStart + bodyLen
    if (end > bytes.length) throw new Error(`${what}: truncated page body at ${String(at)}`)
    const crc = dv.getUint32(at + 22, true)
    if (oggCrc(bytes, at, end, at + 22) !== crc) throw new Error(`${what}: bad Ogg CRC on page ${String(pages)}`)
    serials.add(serial)
    if ((headerType & 1) === 0 && open && packetBuf.length > 0) throw new Error(`${what}: missing continuation flag`)
    let off = bodyStart
    for (let i = 0; i < nseg; i += 1) {
      const lace = bytes[at + 27 + i]!
      for (let k = 0; k < lace; k += 1) packetBuf.push(bytes[off + k]!)
      off += lace
      current += lace
      open = true
      if (lace < 255) {
        const p = Uint8Array.from(packetBuf)
        if (firstPacket === null) firstPacket = p
        else if (secondPacket === null) secondPacket = p
        else {
          packets.push(p.length)
          samples.push(opusPacketSamples48k(p, `${what} packet ${String(packets.length)}`))
        }
        packetBuf = []
        current = 0
        open = false
      }
    }
    if (granuleHi !== -1 || granuleLo !== 0xffffffff) finalGranule = granuleHi * 0x1_0000_0000 + granuleLo
    if (headerType & 4) eos = true
    pages += 1
    at = end
  }
  if (serials.size !== 1) throw new Error(`${what}: ${String(serials.size)} logical streams (expected exactly 1)`)
  if (firstPacket === null || firstPacket.length < 19 || String.fromCharCode(...firstPacket.subarray(0, 8)) !== 'OpusHead') throw new Error(`${what}: first packet is not OpusHead`)
  if (firstPacket[8] !== 1) throw new Error(`${what}: OpusHead version ${String(firstPacket[8])}`)
  if (secondPacket === null || String.fromCharCode(...secondPacket.subarray(0, 8)) !== 'OpusTags') throw new Error(`${what}: second packet is not OpusTags`)
  if (!eos) throw new Error(`${what}: last page lacks the EOS flag`)
  if (current !== 0 || open) throw new Error(`${what}: unterminated packet at end of stream`)
  const head = new DataView(firstPacket.buffer, firstPacket.byteOffset, firstPacket.byteLength)
  const preSkip = head.getUint16(10, true)
  return {
    bytes: bytes.length,
    pages,
    serials: serials.size,
    channels: firstPacket[9]!,
    preSkip,
    inputSampleRate: head.getUint32(12, true),
    audioPackets: packets.length,
    audioPacketBytes: packets.reduce((a, b) => a + b, 0),
    audioPacketSizes: packets,
    audioPacketSamples48k: samples,
    finalGranule,
    decodedSeconds: (finalGranule - preSkip) / 48_000,
    eos,
  }
}

/** D1 measured bitrate of a chunk: audio-packet bits ÷ source duration (source WAV frames / rate). */
export function measuredBitrateBps(facts: OggOpusFacts, sourceSeconds: number): number {
  if (!(sourceSeconds > 0)) throw new Error('measuredBitrateBps: non-positive duration')
  return (facts.audioPacketBytes * 8) / sourceSeconds
}

/** Header of a `D2SP` indexed chunk pack (reland_plan §E.2): magic, u32 version, u32 chunkCount. */
export function d2spHeader(bytes: Uint8Array, what: string): { magic: string; version: number; chunkCount: number } {
  if (bytes.length < 12) throw new Error(`${what}: shorter than the 12-byte D2SP header`)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { magic: fourCc(bytes, 0), version: dv.getUint32(4, true), chunkCount: dv.getUint32(8, true) }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Independent WebM / EBML Opus reader (RFC 8794 EBML + Matroska/WebM + RFC 6716 Opus TOC)
// Used by P3 (#945 BGM `.webm`) and P6 (#948 Speech `.webm`) to validate container + measure bitrate
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface WebmOpusFacts {
  readonly container: 'webm' | 'ogg'
  readonly bytes: number
  readonly docType: string
  readonly codecId: string
  readonly channels: number
  readonly preSkip: number
  readonly inputSampleRate: number
  readonly audioPackets: number
  readonly audioPacketBytes: number
  readonly audioPacketSizes: readonly number[]
  readonly audioPacketSamples48k: readonly number[]
  readonly decodedSeconds: number
}

function readEbmlVint(bytes: Uint8Array, at: number, keepMarker: boolean, what: string): { value: number; next: number; unknownSize: boolean } {
  if (at >= bytes.length) throw new Error(`${what}: unexpected EOF reading VINT at ${String(at)}`)
  const b0 = bytes[at]!
  if (b0 === 0) throw new Error(`${what}: invalid 0x00 VINT leading byte at ${String(at)}`)
  let width = 1
  let mask = 0x80
  while ((b0 & mask) === 0) {
    width += 1
    mask >>= 1
  }
  if (at + width > bytes.length) throw new Error(`${what}: truncated ${String(width)}-byte VINT at ${String(at)}`)
  let val = keepMarker ? b0 : b0 & (mask - 1)
  let allOnes = (b0 & (mask - 1)) === mask - 1
  for (let i = 1; i < width; i += 1) {
    const bi = bytes[at + i]!
    val = val * 256 + bi
    if (bi !== 0xff) allOnes = false
  }
  return { value: val, next: at + width, unknownSize: !keepMarker && allOnes }
}

function parseMatroskaBlockFrames(block: Uint8Array, what: string, packets: number[], samples: number[]): void {
  const trackVint = readEbmlVint(block, 0, false, `${what} block track`)
  const headerEnd = trackVint.next + 3 // 2-byte int16BE timecode + 1-byte flags
  if (headerEnd > block.length) throw new Error(`${what}: truncated Block header`)
  const flags = block[trackVint.next + 2]!
  const lacing = (flags >> 1) & 0x03
  const payload = block.subarray(headerEnd)
  if (lacing === 0) {
    packets.push(payload.length)
    samples.push(opusPacketSamples48k(payload, `${what} packet ${String(packets.length)}`))
    return
  }
  if (payload.length < 1) throw new Error(`${what}: laced block missing frame count`)
  const frameCount = payload[0]! + 1
  let pos = 1
  const frameSizes: number[] = []
  if (lacing === 2) {
    // Fixed-size lacing
    const rem = payload.length - 1
    if (rem % frameCount !== 0) throw new Error(`${what}: fixed-size lacing remainder`)
    const sz = rem / frameCount
    for (let i = 0; i < frameCount; i += 1) frameSizes.push(sz)
  } else if (lacing === 1) {
    // Xiph lacing
    let sum = 0
    for (let i = 0; i < frameCount - 1; i += 1) {
      let sz = 0
      while (pos < payload.length) {
        const b = payload[pos++]!
        sz += b
        if (b < 255) break
      }
      frameSizes.push(sz)
      sum += sz
    }
    frameSizes.push(payload.length - pos - sum)
  } else {
    // EBML lacing
    let sum = 0
    let prev = 0
    for (let i = 0; i < frameCount - 1; i += 1) {
      const v = readEbmlVint(payload, pos, false, `${what} ebml lace`)
      pos = v.next
      if (i === 0) prev = v.value
      else {
        const widthBytes = v.next - (pos - (v.next - pos))
        const bias = Math.pow(2, 7 * widthBytes - 1) - 1
        prev += v.value - bias
      }
      frameSizes.push(prev)
      sum += prev
    }
    frameSizes.push(payload.length - pos - sum)
  }
  for (const sz of frameSizes) {
    if (sz <= 0 || pos + sz > payload.length) throw new Error(`${what}: invalid laced frame size ${String(sz)}`)
    const frame = payload.subarray(pos, pos + sz)
    pos += sz
    packets.push(frame.length)
    samples.push(opusPacketSamples48k(frame, `${what} packet ${String(packets.length)}`))
  }
}

/**
 * Strictly parses a WebM Opus stream (`.webm`, EBML magic `0x1A 0x45 0xDF 0xA3`), verifying
 * `DocType = "webm"`, `CodecID = "A_OPUS"`, `OpusHead` (`version = 1`), and every `SimpleBlock` /
 * `Block` Opus packet via `opusPacketSamples48k`.
 */
export function webmOpusFacts(bytes: Uint8Array, what: string): WebmOpusFacts {
  if (bytes.length < 32 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
    throw new Error(`${what}: missing WebM EBML header magic (0x1A45DFA3)`)
  }
  let docType = ''
  let codecId = ''
  let opusHead: Uint8Array | null = null
  const packets: number[] = []
  const samples: number[] = []

  // Master element IDs we descend into:
  // 0x1A45DFA3 EBML, 0x18538067 Segment, 0x1654AE6B Tracks, 0xAE TrackEntry, 0xE1 Audio,
  // 0x1F43B675 Cluster, 0xA0 BlockGroup
  const MASTER_IDS = new Set([0x1a45dfa3, 0x18538067, 0x1654ae6b, 0xae, 0xe1, 0x1f43b675, 0xa0])

  function walk(start: number, end: number): void {
    let at = start
    while (at < end) {
      const id = readEbmlVint(bytes, at, true, `${what} id`)
      const sz = readEbmlVint(bytes, id.next, false, `${what} size`)
      const bodyStart = sz.next
      const bodyEnd = sz.unknownSize ? end : bodyStart + sz.value
      if (bodyEnd > end) throw new Error(`${what}: element 0x${id.value.toString(16)} at ${String(at)} extends past ${String(end)}`)
      if (MASTER_IDS.has(id.value)) {
        walk(bodyStart, bodyEnd)
      } else if (id.value === 0x4282) {
        docType = Buffer.from(bytes.subarray(bodyStart, bodyEnd)).toString('ascii').replace(/\0+$/, '')
      } else if (id.value === 0x86) {
        codecId = Buffer.from(bytes.subarray(bodyStart, bodyEnd)).toString('ascii').replace(/\0+$/, '')
      } else if (id.value === 0x63a2) {
        opusHead = bytes.subarray(bodyStart, bodyEnd)
      } else if (id.value === 0xa3 || id.value === 0xa1) {
        parseMatroskaBlockFrames(bytes.subarray(bodyStart, bodyEnd), what, packets, samples)
      }
      at = bodyEnd
    }
  }

  walk(0, bytes.length)
  if (docType !== 'webm' && docType !== 'matroska') {
    throw new Error(`${what}: unexpected EBML DocType "${docType}" (expected "webm")`)
  }
  if (codecId !== 'A_OPUS') {
    throw new Error(`${what}: unexpected Track CodecID "${codecId}" (expected "A_OPUS")`)
  }
  if (opusHead === null) {
    throw new Error(`${what}: missing CodecPrivate OpusHead`)
  }
  const headBytes: Uint8Array = opusHead
  if (headBytes.length < 19 || String.fromCharCode(...headBytes.subarray(0, 8)) !== 'OpusHead') {
    throw new Error(`${what}: invalid CodecPrivate OpusHead`)
  }
  if (headBytes[8] !== 1) {
    throw new Error(`${what}: OpusHead version ${String(headBytes[8])} (expected 1)`)
  }
  if (packets.length === 0) {
    throw new Error(`${what}: WebM stream contains 0 Opus audio packets`)
  }
  const headDv = new DataView(headBytes.buffer, headBytes.byteOffset, headBytes.byteLength)
  const channels = headBytes[9]!
  const preSkip = headDv.getUint16(10, true)
  const inputSampleRate = headDv.getUint32(12, true)
  const totalSamples48k = samples.reduce((a, b) => a + b, 0)
  return {
    container: 'webm',
    bytes: bytes.length,
    docType,
    codecId,
    channels,
    preSkip,
    inputSampleRate,
    audioPackets: packets.length,
    audioPacketBytes: packets.reduce((a, b) => a + b, 0),
    audioPacketSizes: packets,
    audioPacketSamples48k: samples,
    decodedSeconds: Math.max(0, (totalSamples48k - preSkip) / 48_000),
  }
}

/** Parses a `.webm` (or `.ogg`) Opus stream and returns unified Opus stream facts. */
export function streamOpusFacts(bytes: Uint8Array, what: string): WebmOpusFacts {
  if (bytes.length >= 4 && fourCc(bytes, 0) === 'OggS') {
    const f = oggOpusFacts(bytes, what)
    return {
      container: 'ogg',
      bytes: f.bytes,
      docType: 'ogg',
      codecId: 'A_OPUS',
      channels: f.channels,
      preSkip: f.preSkip,
      inputSampleRate: f.inputSampleRate,
      audioPackets: f.audioPackets,
      audioPacketBytes: f.audioPacketBytes,
      audioPacketSizes: f.audioPacketSizes,
      audioPacketSamples48k: f.audioPacketSamples48k,
      decodedSeconds: f.decodedSeconds,
    }
  }
  return webmOpusFacts(bytes, what)
}

/** Measured Opus audio-packet bitrate (bps) of a `.webm`/`.ogg` stream against source WAV duration. */
export function measuredStreamBitrateBps(facts: WebmOpusFacts, sourceSeconds: number): number {
  if (!(sourceSeconds > 0)) throw new Error('measuredStreamBitrateBps: non-positive duration')
  return (facts.audioPacketBytes * 8) / sourceSeconds
}

/**
 * Authoritative 1.13c BGM scope (PROJECT.md D20 + R3):
 * - `mandatoryRows`: all rows in `musicRange 4657..4684` (28 looping tracks incl. 4668 `common\options.wav`)
 *   ∪ all `Music Vol = 1` rows (`4686`, `4693`) = 30 rows.
 * - `allMusicRows`: all `Stream = 1` music rows `4657..4698` (`DATA\GLOBAL\MUSIC\`, 42 rows).
 */
export function oracleMusicScope(o: Oracle113c): {
  readonly mandatoryRows: readonly OracleSoundRow[]
  readonly allMusicRows: readonly OracleSoundRow[]
} {
  const [lo, hi] = o.musicRange
  const mandatoryRows = o.sounds.filter((r) => r.id > 0 && ((r.id >= lo && r.id <= hi) || r.musicVol))
  const allMusicRows = o.sounds.filter((r) => r.id >= 4657 && r.id <= 4698)
  return { mandatoryRows, allMusicRows }
}

/**
 * Authoritative 1.13c ambient scope (PROJECT.md D10 + R4 / #946):
 * - `sceneRows`: `ambient\scene\*` (20 rows)
 * - `eventRows`: `ambient\event\*` (131 rows)
 * - `sceneAndEventRows`: 151 rows (20 + 131)
 * - `coreAmbientRows`: `ambient\footstep\*` (162) + `ambient\creature\*` (30) = 192 rows
 * - `allAmbientRows`: all `ambient\*` `Stream = 0` rows = 343 rows
 * - `actSoundIds`: for each Act `1..5`, the set of all `Day/Night Ambience` and `Day/Night Event`
 *   variant group member IDs referenced by any canonical level (`1..136`) in that Act.
 */
export function oracleAmbientScope(o: Oracle113c): {
  readonly sceneRows: readonly OracleSoundRow[]
  readonly eventRows: readonly OracleSoundRow[]
  readonly sceneAndEventRows: readonly OracleSoundRow[]
  readonly coreAmbientRows: readonly OracleSoundRow[]
  readonly allAmbientRows: readonly OracleSoundRow[]
  readonly actSoundIds: ReadonlyMap<number, ReadonlySet<number>>
} {
  const sceneRows = oracleStream0Rows(['ambient\\scene\\'])
  const eventRows = oracleStream0Rows(['ambient\\event\\'])
  const sceneAndEventRows = oracleStream0Rows(['ambient\\scene\\', 'ambient\\event\\'])
  const coreAmbientRows = oracleStream0Rows(['ambient\\footstep\\', 'ambient\\creature\\'])
  const allAmbientRows = oracleStream0Rows(['ambient\\'])
  const actSoundIds = new Map<number, Set<number>>()
  for (let act = 1; act <= 5; act += 1) actSoundIds.set(act, new Set<number>())
  for (let lvlId = 1; lvlId <= 136; lvlId += 1) {
    const lvl = o.levels.get(lvlId)
    if (!lvl) continue
    const env = o.soundEnviron[lvl.soundEnv]
    if (!env) continue
    const target = actSoundIds.get(lvl.act)
    if (!target) continue
    for (const rootId of [env.dayAmbience, env.nightAmbience, env.dayEvent, env.nightEvent]) {
      if (rootId > 0) {
        for (const m of oracleGroupMembers(rootId)) target.add(m)
      }
    }
  }
  return { sceneRows, eventRows, sceneAndEventRows, coreAmbientRows, allAmbientRows, actSoundIds }
}

export interface OracleSkillRow113c {
  readonly id: number
  readonly skill: string
  readonly charclass: string
  readonly stsound: number
  readonly stsoundclass: number
  readonly stsounddelay: number
  readonly weaponsnd: number
  readonly dosound: number
  readonly dosoundA: number
  readonly dosoundB: number
  readonly tgtsound: number
  readonly prgsound: number
  readonly srvmissile: string
  readonly srvmissileA: string
  readonly srvmissileB: string
  readonly srvmissileC: string
  readonly cltmissile: string
  readonly cltmissileA: string
  readonly cltmissileB: string
  readonly cltmissileC: string
  readonly cltmissileD: string
}

export interface OracleMissileRow113c {
  readonly id: number
  readonly missile: string
  readonly travelSound: number
  readonly hitSound: number
  readonly progSound: number
  readonly explosionMissile: string
  readonly pCltHitFunc: number
}

export const SKILL_CLASS_CODES_113C = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'] as const
export type SkillClassCode113c = (typeof SKILL_CLASS_CODES_113C)[number]

export const SKILL_FOLDER_TO_CLASS_113C: Readonly<Record<string, SkillClassCode113c | 'common'>> = {
  'skill\\amazon\\': 'ama',
  'skill\\sorceress\\': 'sor',
  'skill\\necromancer\\': 'nec',
  'skill\\paladin\\': 'pal',
  'skill\\barbarian\\': 'bar',
  'skill\\druid\\': 'dru',
  'skill\\assassin\\': 'ass',
  'skill\\misc\\': 'common',
}

/**
 * Authoritative 1.13c skill & missile audio scope (PROJECT.md F19–F22 / #947):
 * - `skillFolderRows`: all 303 `skill\*` `Stream = 0` rows in `Sounds.txt`
 * - `rowsByBucket`: partitioned across `ama` (45), `sor` (68), `nec` (46), `pal` (43), `bar` (48),
 *   `dru` (16), `ass` (35), and `common` (`skill\misc\*`, 2)
 * - `skills`: parsed `data\global\excel\skills.txt` rows with resolved sound IDs
 * - `missiles`: parsed `data\global\excel\missiles.txt` rows with resolved `TravelSound`, `HitSound`, `ProgSound` IDs
 * - `allMissileSoundIds`: every `Stream = 0` variant group member ID referenced by `Missiles.txt`
 */
export function oracleSkillScope(o: Oracle113c): {
  readonly skillFolderRows: readonly OracleSoundRow[]
  readonly rowsByBucket: Readonly<Record<SkillClassCode113c | 'common', readonly OracleSoundRow[]>>
  readonly skills: readonly OracleSkillRow113c[]
  readonly missiles: readonly OracleMissileRow113c[]
  readonly allSkillTableSoundIds: ReadonlySet<number>
  readonly allMissileSoundIds: ReadonlySet<number>
} {
  const skillFolderRows = oracleStream0Rows(['skill\\'])
  const buckets: Record<SkillClassCode113c | 'common', OracleSoundRow[]> = {
    ama: [],
    sor: [],
    nec: [],
    pal: [],
    bar: [],
    dru: [],
    ass: [],
    common: [],
  }
  for (const r of skillFolderRows) {
    const dir = soundFileDir(r.fileName)
    const bucket = SKILL_FOLDER_TO_CLASS_113C[dir]
    if (!bucket) throw new Error(`oracleSkillScope: unexpected skill folder '${dir}' on row ${String(r.id)}`)
    buckets[bucket].push(r)
  }

  const resolveSound = (name: string): number => {
    const clean = name.trim().toLowerCase()
    if (clean.length === 0 || clean === 'none') return 0
    return o.soundsByName.get(clean) ?? 0
  }
  const optInt = (raw: string): number => {
    const clean = raw.trim()
    return /^-?\d+$/.test(clean) ? Number(clean) : 0
  }

  const missingSet = new Set(o.missingMemberIds)
  const isShippedStream0 = (m: number): boolean => {
    const mr = o.sounds[m]
    if (!mr || mr.id <= 0 || mr.stream || missingSet.has(m)) return false
    const nf = normSoundFile(mr.fileName)
    return nf.length > 0 && nf !== 'none.wav'
  }

  const st = o.table('data\\global\\excel\\skills.txt')
  const skills: OracleSkillRow113c[] = []
  const allSkillTableSoundIds = new Set<number>()
  for (const r of st.rows) {
    const rawId = (r[st.col('Id')] ?? '').trim()
    if (!/^\d+$/.test(rawId)) continue
    const row: OracleSkillRow113c = {
      id: Number(rawId),
      skill: (r[st.col('skill')] ?? '').trim(),
      charclass: (r[st.col('charclass')] ?? '').trim().toLowerCase(),
      stsound: resolveSound(r[st.col('stsound')] ?? ''),
      stsoundclass: resolveSound(r[st.col('stsoundclass')] ?? ''),
      stsounddelay: optInt(r[st.col('stsounddelay')] ?? ''),
      weaponsnd: optInt(r[st.col('weaponsnd')] ?? ''),
      dosound: resolveSound(r[st.col('dosound')] ?? ''),
      dosoundA: resolveSound(r[st.col('dosound a')] ?? ''),
      dosoundB: resolveSound(r[st.col('dosound b')] ?? ''),
      tgtsound: resolveSound(r[st.col('tgtsound')] ?? ''),
      prgsound: resolveSound(r[st.col('prgsound')] ?? ''),
      srvmissile: (r[st.col('srvmissile')] ?? '').trim(),
      srvmissileA: (r[st.col('srvmissilea')] ?? '').trim(),
      srvmissileB: (r[st.col('srvmissileb')] ?? '').trim(),
      srvmissileC: (r[st.col('srvmissilec')] ?? '').trim(),
      cltmissile: (r[st.col('cltmissile')] ?? '').trim(),
      cltmissileA: (r[st.col('cltmissilea')] ?? '').trim(),
      cltmissileB: (r[st.col('cltmissileb')] ?? '').trim(),
      cltmissileC: (r[st.col('cltmissilec')] ?? '').trim(),
      cltmissileD: (r[st.col('cltmissiled')] ?? '').trim(),
    }
    skills.push(row)
    for (const sid of [row.stsound, row.stsoundclass, row.dosound, row.dosoundA, row.dosoundB, row.tgtsound, row.prgsound]) {
      if (sid > 0) {
        for (const m of oracleGroupMembers(sid)) {
          if (isShippedStream0(m)) allSkillTableSoundIds.add(m)
        }
      }
    }
  }

  const mt = o.table('data\\global\\excel\\missiles.txt')
  const missiles: OracleMissileRow113c[] = []
  const allMissileSoundIds = new Set<number>()
  for (const r of mt.rows) {
    const rawId = (r[mt.col('Id')] ?? '').trim()
    if (!/^\d+$/.test(rawId)) continue
    const row: OracleMissileRow113c = {
      id: Number(rawId),
      missile: (r[mt.col('Missile')] ?? '').trim(),
      travelSound: resolveSound(r[mt.col('TravelSound')] ?? ''),
      hitSound: resolveSound(r[mt.col('HitSound')] ?? ''),
      progSound: resolveSound(r[mt.col('ProgSound')] ?? ''),
      explosionMissile: (r[mt.col('ExplosionMissile')] ?? '').trim(),
      pCltHitFunc: optInt(r[mt.col('pCltHitFunc')] ?? ''),
    }
    missiles.push(row)
    for (const sid of [row.travelSound, row.hitSound, row.progSound]) {
      if (sid > 0) {
        for (const m of oracleGroupMembers(sid)) {
          if (isShippedStream0(m)) allMissileSoundIds.add(m)
        }
      }
    }
  }

  return {
    skillFolderRows,
    rowsByBucket: buckets,
    skills,
    missiles,
    allSkillTableSoundIds,
    allMissileSoundIds,
  }
}

export interface OracleMonSoundRow113c {
  readonly index: number
  readonly id: string
  readonly attack1: number
  readonly weapon1: number
  readonly att1Del: number
  readonly wea1Del: number
  readonly att1Prb: number
  readonly wea1Vol: number
  readonly attack2: number
  readonly weapon2: number
  readonly att2Del: number
  readonly wea2Del: number
  readonly att2Prb: number
  readonly wea2Vol: number
  readonly hitSound: number
  readonly deathSound: number
  readonly hitDelay: number
  readonly deaDelay: number
  readonly skill1: number
  readonly skill2: number
  readonly skill3: number
  readonly skill4: number
  readonly footstep: number
  readonly footstepLayer: number
  readonly fsCnt: number
  readonly fsOff: number
  readonly fsPrb: number
  readonly neutral: number
  readonly neuTime: number
  readonly init: number
  readonly taunt: number
  readonly flee: number
}

/**
 * Authoritative 1.13c monster & speech audio scope (PROJECT.md F23–F26, D9, D16 / #948):
 * - `allMonsterRows`: all 1,674 `monster\*` `Stream = 0` rows in `Sounds.txt` (1,670 shipped + 4 missing `1595..1598`)
 * - `shippedMonsterRows`: 1,670 shipped `monster\*` rows
 * - `missingMonsterIds`: `[1595, 1596, 1597, 1598]` (`monster\regurgitator\neutral1..4.wav`)
 * - `monSounds`: 140 named `MonSounds.txt` rows (141 raw rows minus 1 separator row)
 * - `allSpeechRows`: all 1,719 `Stream = 1` local speech rows (`2934..4656`) with non-`none.wav` `FileName`
 * - `shippedSpeechRows`: 1,689 shipped rows (1,679 unique WAVs)
 * - `npcSpeechRows`: 1,530 non-player-class `act1..act5` + `common` NPC/quest speech rows (1,500 shipped + 30 missing)
 * - `missingSpeechIds`: the 30 speech row IDs absent from all 9 1.13c MPQs (D9)
 */
export function oracleMonsterSpeechScope(o: Oracle113c): {
  readonly allMonsterRows: readonly OracleSoundRow[]
  readonly shippedMonsterRows: readonly OracleSoundRow[]
  readonly missingMonsterIds: readonly number[]
  readonly monSounds: readonly OracleMonSoundRow113c[]
  readonly allSpeechRows: readonly OracleSoundRow[]
  readonly shippedSpeechRows: readonly OracleSoundRow[]
  readonly npcSpeechRows: readonly OracleSoundRow[]
  readonly missingSpeechIds: readonly number[]
} {
  const missingSet = new Set(o.missingMemberIds)
  const allMonsterRows = o.sounds.filter(
    (r) => r.id > 0 && !r.stream && normSoundFile(r.fileName).startsWith('monster\\'),
  )
  const shippedMonsterRows = allMonsterRows.filter((r) => !missingSet.has(r.id))
  const missingMonsterIds = o.missingMemberIds.filter((id) => id < 2934)
  const missingSpeechIds = o.missingMemberIds.filter((id) => id >= 2934 && id <= 4656)

  const resolveSound = (name: string): number => {
    const clean = name.trim().toLowerCase()
    if (clean.length === 0 || clean === 'none') return 0
    return o.soundsByName.get(clean) ?? 0
  }
  const optInt = (raw: string): number => {
    const clean = raw.trim()
    return /^-?\d+$/.test(clean) ? Number(clean) : 0
  }

  const mst = o.table('data\\global\\excel\\MonSounds.txt')
  const monSounds: OracleMonSoundRow113c[] = []
  mst.rows.forEach((r, idx) => {
    const id = (r[mst.col('Id')] ?? '').trim()
    if (id.length === 0) return
    monSounds.push({
      index: idx,
      id,
      attack1: resolveSound(r[mst.col('Attack1')] ?? ''),
      weapon1: resolveSound(r[mst.col('Weapon1')] ?? ''),
      att1Del: optInt(r[mst.col('Att1Del')] ?? ''),
      wea1Del: optInt(r[mst.col('Wea1Del')] ?? ''),
      att1Prb: optInt(r[mst.col('Att1Prb')] ?? ''),
      wea1Vol: optInt(r[mst.col('Wea1Vol')] ?? ''),
      attack2: resolveSound(r[mst.col('Attack2')] ?? ''),
      weapon2: resolveSound(r[mst.col('Weapon2')] ?? ''),
      att2Del: optInt(r[mst.col('Att2Del')] ?? ''),
      wea2Del: optInt(r[mst.col('Wea2Del')] ?? ''),
      att2Prb: optInt(r[mst.col('Att2Prb')] ?? ''),
      wea2Vol: optInt(r[mst.col('Wea2Vol')] ?? ''),
      hitSound: resolveSound(r[mst.col('HitSound')] ?? ''),
      deathSound: resolveSound(r[mst.col('DeathSound')] ?? ''),
      hitDelay: optInt(r[mst.col('HitDelay')] ?? ''),
      deaDelay: optInt(r[mst.col('DeaDelay')] ?? ''),
      skill1: resolveSound(r[mst.col('Skill1')] ?? ''),
      skill2: resolveSound(r[mst.col('Skill2')] ?? ''),
      skill3: resolveSound(r[mst.col('Skill3')] ?? ''),
      skill4: resolveSound(r[mst.col('Skill4')] ?? ''),
      footstep: resolveSound(r[mst.col('Footstep')] ?? ''),
      footstepLayer: resolveSound(r[mst.col('FootstepLayer')] ?? ''),
      fsCnt: optInt(r[mst.col('FsCnt')] ?? ''),
      fsOff: optInt(r[mst.col('FsOff')] ?? ''),
      fsPrb: optInt(r[mst.col('FsPrb')] ?? ''),
      neutral: resolveSound(r[mst.col('Neutral')] ?? ''),
      neuTime: optInt(r[mst.col('NeuTime')] ?? ''),
      init: resolveSound(r[mst.col('Init')] ?? ''),
      taunt: resolveSound(r[mst.col('Taunt')] ?? ''),
      flee: resolveSound(r[mst.col('Flee')] ?? ''),
    })
  })

  const playerVoiceSubfolders = [
    'common\\amazon\\',
    'common\\assassin\\',
    'common\\barbarian\\',
    'common\\druid\\',
    'common\\necromancer\\',
    'common\\paladin\\',
    'common\\sorceress\\',
  ]
  const allSpeechRows = o.sounds.filter(
    (r) => r.id >= 2934 && r.id <= 4656 && normSoundFile(r.fileName) !== 'none.wav' && normSoundFile(r.fileName).length > 0,
  )
  const shippedSpeechRows = allSpeechRows.filter((r) => !missingSet.has(r.id))
  const npcSpeechRows = allSpeechRows.filter((r) => {
    const nf = normSoundFile(r.fileName)
    return !playerVoiceSubfolders.some((p) => nf.startsWith(p))
  })

  return {
    allMonsterRows,
    shippedMonsterRows,
    missingMonsterIds,
    monSounds,
    allSpeechRows,
    shippedSpeechRows,
    npcSpeechRows,
    missingSpeechIds,
  }
}


