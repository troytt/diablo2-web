/**
 * Diablo II v1.13c Monster Sound Baker & `MonSounds.txt` Generator (`src/baker/packers/pack-monster-sounds.ts`, #948 F23 / F26).
 *
 * Responsibilities:
 * 1. Parse `data\global\excel\MonSounds.txt` (140 named rows, skipping empty separator row 30) and resolve
 *    every sound name column (`Attack1`, `Weapon1`, `Attack2`, `Weapon2`, `HitSound`, `DeathSound`,
 *    `Skill1..4`, `Footstep`, `FootstepLayer`, `Neutral`, `Init`, `Taunt`, `Flee`) to its numeric `Sounds.txt` ID.
 * 2. Scan all `Stream = 0` `monster\*` rows in `SOUNDS_113C` (1,674 rows) against the mounted 1.13c MPQ chain:
 *    - 1,670 rows resolve to shipped WAVs (1,652 unique WAVs across 102 monster subfolders).
 *    - 4 rows (`1595..1598`, `regurgitator_neutral_1..4`) are absent from all 1.13c MPQs (Decision D9 / F26).
 * 3. Emit `src/common/audio/mon-sounds-113c.ts` with `MON_SOUNDS_113C`, `UNSHIPPED_MONSTER_SOUND_IDS_113C`,
 *    and lookup / playback helpers (zero `node:*`, zero DOM/WebAudio globals, zero `Math.random`/`Date.now`).
 * 4. Partition the 102 monster subfolders deterministically across Acts 1..5 (`Levels.txt` + `MonStats.txt`
 *    + `MonSounds.txt` earliest Normal-difficulty Act plus preset Act mapping for bosses/SuperUniques/traps/summons),
 *    transcode unique WAVs to 48 kHz Ogg Opus (`24 kbps` mono / `40 kbps` stereo hard CBR, 20 ms frames),
 *    split into `D2SP` v2 `.bin` parts (`sfx-mon-act{1..5}*.bin`, `<= 700,000 B`), and merge into
 *    `src/common/audio/sfx-pack-index-113c.ts`.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { SfxPackMeta113c, SfxPackTuple113c } from '../../common/audio/sfx-pack-index-113c.ts'
import {
  SOUNDS_113C,
  buildSoundMpqPath113c,
  getSoundIdByName113c,
  type SoundsRow113c as SoundRow113c,
} from '../../common/audio/sounds-113c.ts'
import { parseWavPcm16 } from '../../common/formats/wav.ts'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { generateAssetManifest } from '../io/asset-manifest.ts'
import { DEFAULT_NODE_MPQ_DIR, MPQ_LOAD_ORDER, syncNodeFileSource } from '../mpq-archive-source.ts'
import {
  SFX_MONO_BITRATE_113C,
  SFX_PACK_HEADER_BYTES_113C,
  SFX_PACK_INDEX_TS_FILE,
  SFX_STEREO_BITRATE_113C,
  encodeSfxPackBinary113c,
  inspectOggOpusChunk113c,
  mergeSfxPackIndex113c,
  normalizeSoundFileName113c,
  patchOpusHeadInputSampleRate,
  probeFfmpegOpus113c,
  readExistingSfxPackIndex113c,
  renderSfxPackIndexModule113c,
  transcodeWavToOpusOggAsync,
  type IndexedSfxRow113c,
} from './pack-sfx.ts'
import { packSkillSounds113c } from './pack-skill-sounds.ts'
import { mountSoundTableArchives } from './pack-sound-tables.ts'

export const MON_SOUNDS_TS_FILE = 'src/common/audio/mon-sounds-113c.ts'
export const D3_MONSTER_PART_MAX_BYTES_113C = 700_000
export const D3_MONSTER_PART_MAX_BYTES = D3_MONSTER_PART_MAX_BYTES_113C
export const MONSTER_ACT_NUMBERS_113C = [1, 2, 3, 4, 5] as const
export const MONSTER_ACT_BUCKETS_113C = MONSTER_ACT_NUMBERS_113C
export type MonsterActNumber113c = (typeof MONSTER_ACT_NUMBERS_113C)[number]
export type MonsterActBucket113c = MonsterActNumber113c

export function isStrictMonsterSoundRow113c(row: SoundRow113c): boolean {
  return row.id > 0 && !row.stream && normalizeSoundFileName113c(row.fileName).startsWith('monster\\')
}

const MONSTER_AUDIO_ARCHIVE_ORDER_113C = [
  'd2music.mpq',
  'D2xMusic.mpq',
  'd2speech.mpq',
  'd2xtalk.mpq',
  'd2sfx.mpq',
  ...MPQ_LOAD_ORDER,
] as const

export interface MonSoundRow113c {
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
  readonly cvtMo1: string
  readonly cvtSk1: string
  readonly cvtTgt1: string
  readonly cvtMo2: string
  readonly cvtSk2: string
  readonly cvtTgt2: string
  readonly cvtMo3: string
  readonly cvtSk3: string
  readonly cvtTgt3: string
}

/**
 * Deterministic Act assignment for the 48 `monster\<subfolder>\*` directories that belong to
 * DS1-preset bosses, SuperUniques, town NPCs, player summons/traps, or unused monsters
 * not listed in `Levels.txt` `mon1..mon10`.
 */
export const PRESET_MONSTER_SUBFOLDER_ACT_113C: Readonly<Record<string, MonsterActNumber113c>> = {
  // Act 1 bosses, SuperUniques, town NPCs
  andariel: 1,
  bloodraven: 1,
  charsi: 1,
  countess: 1,
  npc: 1,
  smith: 1,
  druidpod: 1,
  oaksage: 1,
  druidraven: 1,
  werebear: 1,
  werewolf: 1,
  hydra: 1,
  lightningsentry: 1,
  corruptrogue: 1,
  griswold: 1,
  moo: 1,
  trap: 1,
  assassin: 1,
  blob: 1,
  darkhunter: 1,
  druidfenris: 1,
  druidhawk: 1,
  druidspirit: 1,
  druidtotem: 1,
  druidvine: 1,
  gargoyle: 1,
  // Act 2 bosses, SuperUniques, tavern NPCs, traps, and lair features
  barpatrons: 2,
  duriel: 2,
  gargoyletrap: 2,
  lightningorb: 2,
  sandmaggotmama: 2,
  scimitar: 2,
  summoner: 2,
  turret: 2,
  radament: 2,
  cat: 2,
  firetower: 2,
  flyingscimitar: 2,
  // Act 3 bosses, quest objects, and Kurast monsters
  compellingorb: 3,
  darkwanderer: 3,
  mephisto: 3,
  tentacle: 3,
  tentaclehead: 3,
  zakarumhighpriest: 3,
  cantor: 3,
  // Act 4 bosses, quest souls, and Chaos Sanctuary / Hell monsters
  bladecreeper: 4,
  diablo: 4,
  diabloboneprison: 4,
  izual: 4,
  trappedsoul: 4,
  doomknight: 4,
  // Act 5 bosses, siege weapons, and Harrogath fortifications
  baal: 5,
  baalminion: 5,
  baaltentacle: 5,
  barricadedoor: 5,
  catapult: 5,
  guardtower: 5,
}

export function extractMonsterSubfolder113c(fileName: string): string | null {
  const norm = normalizeSoundFileName113c(fileName)
  if (!norm.startsWith('monster\\')) return null
  const parts = norm.split('\\')
  return parts.length >= 3 && parts[1] ? parts[1].toLowerCase() : null
}

function resolveSoundRef113c(raw: string, context: string): number {
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.toLowerCase() === 'none') return 0
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed)
    if (n <= 0 || n >= SOUNDS_113C.length) return 0
    return n
  }
  const id = getSoundIdByName113c(trimmed)
  if (id === undefined) {
    throw new Error(`pack-monster-sounds: unknown sound handle ${JSON.stringify(trimmed)} at ${context}`)
  }
  return id
}

function parseIntCell113c(raw: string, fallback = 0): number {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return fallback
  const n = Number(trimmed)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export type MonStatsSoundTuple113c = readonly [id: string, monSound: string, uMonSound: string]

export interface SuperUniqueSoundRow113c {
  readonly hcIdx: number
  readonly id: string
  readonly monSound: string
}

export interface MonSoundRowList113c extends ReadonlyArray<MonSoundRow113c> {
  readonly __monStatsSoundRows?: readonly MonStatsSoundTuple113c[]
  readonly __superUniqueSoundRows?: readonly SuperUniqueSoundRow113c[]
}

export async function extractMonStatsSoundRows113c(
  dataArchives: MountedArchives,
): Promise<readonly MonStatsSoundTuple113c[]> {
  const text = await dataArchives.readText('data\\global\\excel\\MonStats.txt')
  const lines = text.split(/\r?\n/).filter((l: string) => l.trim().length > 0)
  if (lines.length < 2) {
    throw new Error('pack-monster-sounds: MonStats.txt is empty')
  }
  const headers = lines[0]!.split('\t').map((h: string) => h.trim().toLowerCase())
  const cId = headers.indexOf('id')
  const cHcIdx = headers.indexOf('hcidx')
  const cMonSound = headers.indexOf('monsound')
  const cUMonSound = headers.indexOf('umonsound')
  if (cId < 0 || cHcIdx < 0 || cMonSound < 0 || cUMonSound < 0) {
    throw new Error('pack-monster-sounds: missing Id/hcIdx/MonSound/UMonSound in MonStats.txt')
  }
  const byHcIdx = new Map<number, MonStatsSoundTuple113c>()
  for (const line of lines.slice(1)) {
    const cells = line.split('\t')
    const id = (cells[cId] ?? '').trim()
    const hcRaw = (cells[cHcIdx] ?? '').trim()
    if (!id || !hcRaw) continue
    const hcIdx = Number(hcRaw)
    if (!Number.isInteger(hcIdx) || hcIdx < 0) continue
    const monSound = (cells[cMonSound] ?? '').trim()
    const uMonSound = (cells[cUMonSound] ?? '').trim()
    byHcIdx.set(hcIdx, [id, monSound, uMonSound])
  }
  const out: MonStatsSoundTuple113c[] = []
  for (let i = 0; i < byHcIdx.size; i += 1) {
    const tuple = byHcIdx.get(i)
    if (!tuple) {
      throw new Error(`pack-monster-sounds: missing MonStats.txt row at hcIdx=${String(i)}`)
    }
    out.push(tuple)
  }
  return out
}

export async function extractSuperUniqueSoundRows113c(
  dataArchives: MountedArchives,
): Promise<readonly SuperUniqueSoundRow113c[]> {
  const text = await dataArchives.readText('data\\global\\excel\\SuperUniques.txt')
  const lines = text.split(/\r?\n/).filter((l: string) => l.trim().length > 0)
  if (lines.length < 2) {
    throw new Error('pack-monster-sounds: SuperUniques.txt is empty')
  }
  const headers = lines[0]!.split('\t').map((h: string) => h.trim().toLowerCase())
  const cId = headers.indexOf('superunique')
  const cHcIdx = headers.indexOf('hcidx')
  const cMonSound = headers.indexOf('monsound')
  if (cId < 0 || cHcIdx < 0 || cMonSound < 0) {
    throw new Error('pack-monster-sounds: missing Superunique/hcIdx/MonSound in SuperUniques.txt')
  }
  const out: SuperUniqueSoundRow113c[] = []
  for (const line of lines.slice(1)) {
    const cells = line.split('\t')
    const id = (cells[cId] ?? '').trim()
    const hcRaw = (cells[cHcIdx] ?? '').trim()
    const monSound = (cells[cMonSound] ?? '').trim()
    if (!id || !hcRaw || !monSound) continue
    const hcIdx = Number(hcRaw)
    if (!Number.isInteger(hcIdx) || hcIdx < 0) continue
    out.push({ hcIdx, id, monSound })
  }
  out.sort((a, b) => a.hcIdx - b.hcIdx)
  return out
}

export async function extractMonSoundRows113c(
  dataArchives: MountedArchives,
): Promise<MonSoundRowList113c> {
  const text = await dataArchives.readText('data\\global\\excel\\MonSounds.txt')
  const lines = text.split(/\r?\n/).filter((l: string) => l.length > 0)
  if (lines.length < 2) {
    throw new Error('pack-monster-sounds: MonSounds.txt is empty')
  }
  const headers = lines[0]!.split('\t').map((h: string) => h.trim())
  const colIdx = (name: string): number => {
    const idx = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase())
    if (idx < 0) {
      throw new Error(`pack-monster-sounds: missing column ${JSON.stringify(name)} in MonSounds.txt`)
    }
    return idx
  }

  const cId = colIdx('Id')
  const cAttack1 = colIdx('Attack1')
  const cWeapon1 = colIdx('Weapon1')
  const cAtt1Del = colIdx('Att1Del')
  const cWea1Del = colIdx('Wea1Del')
  const cAtt1Prb = colIdx('Att1Prb')
  const cWea1Vol = colIdx('Wea1Vol')
  const cAttack2 = colIdx('Attack2')
  const cWeapon2 = colIdx('Weapon2')
  const cAtt2Del = colIdx('Att2Del')
  const cWea2Del = colIdx('Wea2Del')
  const cAtt2Prb = colIdx('Att2Prb')
  const cWea2Vol = colIdx('Wea2Vol')
  const cHitSound = colIdx('HitSound')
  const cDeathSound = colIdx('DeathSound')
  const cHitDelay = colIdx('HitDelay')
  const cDeaDelay = colIdx('DeaDelay')
  const cSkill1 = colIdx('Skill1')
  const cSkill2 = colIdx('Skill2')
  const cSkill3 = colIdx('Skill3')
  const cSkill4 = colIdx('Skill4')
  const cFootstep = colIdx('Footstep')
  const cFootstepLayer = colIdx('FootstepLayer')
  const cFsCnt = colIdx('FsCnt')
  const cFsOff = colIdx('FsOff')
  const cFsPrb = colIdx('FsPrb')
  const cNeutral = colIdx('Neutral')
  const cNeuTime = colIdx('NeuTime')
  const cInit = colIdx('Init')
  const cTaunt = colIdx('Taunt')
  const cFlee = colIdx('Flee')
  const cCvtMo1 = colIdx('CvtMo1')
  const cCvtSk1 = colIdx('CvtSk1')
  const cCvtTgt1 = colIdx('CvtTgt1')
  const cCvtMo2 = colIdx('CvtMo2')
  const cCvtSk2 = colIdx('CvtSk2')
  const cCvtTgt2 = colIdx('CvtTgt2')
  const cCvtMo3 = colIdx('CvtMo3')
  const cCvtSk3 = colIdx('CvtSk3')
  const cCvtTgt3 = colIdx('CvtTgt3')

  const rows: MonSoundRow113c[] = []
  const dataLines = lines.slice(1)
  for (let idx = 0; idx < dataLines.length; idx += 1) {
    const cells = dataLines[idx]!.split('\t')
    const id = (cells[cId] ?? '').trim()
    if (id.length === 0) continue

    const ctx = `MonSounds.txt[${String(idx)}:${id}]`
    rows.push({
      index: idx,
      id,
      attack1: resolveSoundRef113c(cells[cAttack1] ?? '', `${ctx}.Attack1`),
      weapon1: resolveSoundRef113c(cells[cWeapon1] ?? '', `${ctx}.Weapon1`),
      att1Del: parseIntCell113c(cells[cAtt1Del] ?? ''),
      wea1Del: parseIntCell113c(cells[cWea1Del] ?? ''),
      att1Prb: parseIntCell113c(cells[cAtt1Prb] ?? ''),
      wea1Vol: parseIntCell113c(cells[cWea1Vol] ?? ''),
      attack2: resolveSoundRef113c(cells[cAttack2] ?? '', `${ctx}.Attack2`),
      weapon2: resolveSoundRef113c(cells[cWeapon2] ?? '', `${ctx}.Weapon2`),
      att2Del: parseIntCell113c(cells[cAtt2Del] ?? ''),
      wea2Del: parseIntCell113c(cells[cWea2Del] ?? ''),
      att2Prb: parseIntCell113c(cells[cAtt2Prb] ?? ''),
      wea2Vol: parseIntCell113c(cells[cWea2Vol] ?? ''),
      hitSound: resolveSoundRef113c(cells[cHitSound] ?? '', `${ctx}.HitSound`),
      deathSound: resolveSoundRef113c(cells[cDeathSound] ?? '', `${ctx}.DeathSound`),
      hitDelay: parseIntCell113c(cells[cHitDelay] ?? ''),
      deaDelay: parseIntCell113c(cells[cDeaDelay] ?? ''),
      skill1: resolveSoundRef113c(cells[cSkill1] ?? '', `${ctx}.Skill1`),
      skill2: resolveSoundRef113c(cells[cSkill2] ?? '', `${ctx}.Skill2`),
      skill3: resolveSoundRef113c(cells[cSkill3] ?? '', `${ctx}.Skill3`),
      skill4: resolveSoundRef113c(cells[cSkill4] ?? '', `${ctx}.Skill4`),
      footstep: resolveSoundRef113c(cells[cFootstep] ?? '', `${ctx}.Footstep`),
      footstepLayer: resolveSoundRef113c(cells[cFootstepLayer] ?? '', `${ctx}.FootstepLayer`),
      fsCnt: parseIntCell113c(cells[cFsCnt] ?? ''),
      fsOff: parseIntCell113c(cells[cFsOff] ?? ''),
      fsPrb: parseIntCell113c(cells[cFsPrb] ?? ''),
      neutral: resolveSoundRef113c(cells[cNeutral] ?? '', `${ctx}.Neutral`),
      neuTime: parseIntCell113c(cells[cNeuTime] ?? ''),
      init: resolveSoundRef113c(cells[cInit] ?? '', `${ctx}.Init`),
      taunt: resolveSoundRef113c(cells[cTaunt] ?? '', `${ctx}.Taunt`),
      flee: resolveSoundRef113c(cells[cFlee] ?? '', `${ctx}.Flee`),
      cvtMo1: (cells[cCvtMo1] ?? '').trim(),
      cvtSk1: (cells[cCvtSk1] ?? '').trim(),
      cvtTgt1: (cells[cCvtTgt1] ?? '').trim(),
      cvtMo2: (cells[cCvtMo2] ?? '').trim(),
      cvtSk2: (cells[cCvtSk2] ?? '').trim(),
      cvtTgt2: (cells[cCvtTgt2] ?? '').trim(),
      cvtMo3: (cells[cCvtMo3] ?? '').trim(),
      cvtSk3: (cells[cCvtSk3] ?? '').trim(),
      cvtTgt3: (cells[cCvtTgt3] ?? '').trim(),
    })
  }

  if (rows.length !== 140) {
    throw new Error(`pack-monster-sounds: expected 140 MonSounds.txt rows, got ${String(rows.length)}`)
  }
  const [monStatsSoundRows, superUniqueSoundRows] = await Promise.all([
    extractMonStatsSoundRows113c(dataArchives),
    extractSuperUniqueSoundRows113c(dataArchives),
  ])
  Object.defineProperty(rows, '__monStatsSoundRows', {
    value: monStatsSoundRows,
    enumerable: false,
  })
  Object.defineProperty(rows, '__superUniqueSoundRows', {
    value: superUniqueSoundRows,
    enumerable: false,
  })
  return rows as MonSoundRowList113c
}

export function scanMonsterSoundRows113c(audioArchives: MountedArchives): {
  readonly shippedRows: readonly SoundRow113c[]
  readonly unshippedIds: readonly number[]
} {
  const shippedRows: SoundRow113c[] = []
  const unshippedIds: number[] = []
  for (const row of SOUNDS_113C) {
    if (row.id <= 0 || row.stream) continue
    const norm = normalizeSoundFileName113c(row.fileName)
    if (!norm.startsWith('monster\\')) continue
    const mpqPath = buildSoundMpqPath113c(row.id)
    if (!mpqPath || !audioArchives.has(mpqPath)) {
      unshippedIds.push(row.id)
    } else {
      shippedRows.push(row)
    }
  }
  return { shippedRows, unshippedIds }
}

export async function extractMonsterSoundTables113c(
  dataArchives: MountedArchives,
  audioArchives: MountedArchives,
): Promise<{
  readonly monSoundRows: MonSoundRowList113c
  readonly unshippedMonsterIds: readonly number[]
  readonly shippedRows: readonly SoundRow113c[]
}> {
  const monSoundRows = await extractMonSoundRows113c(dataArchives)
  const { shippedRows, unshippedIds } = scanMonsterSoundRows113c(audioArchives)
  return {
    monSoundRows,
    unshippedMonsterIds: unshippedIds,
    shippedRows,
  }
}

export async function deriveMonsterSubfolderActs113c(
  dataArchives: MountedArchives,
  monSoundRows: readonly MonSoundRow113c[],
): Promise<ReadonlyMap<string, MonsterActNumber113c>> {
  const levelsText = await dataArchives.readText('data\\global\\excel\\Levels.txt')
  const monStatsText = await dataArchives.readText('data\\global\\excel\\MonStats.txt')

  const levelLines = levelsText.split(/\r?\n/).filter((l: string) => l.trim().length > 0)
  const levelHeaders = levelLines[0]!.split('\t').map((h: string) => h.trim())
  const lIdx = (col: string): number => levelHeaders.findIndex((h) => h.toLowerCase() === col.toLowerCase())
  const lIdIdx = lIdx('Id')
  const lActIdx = lIdx('Act')
  const monColIndices: number[] = []
  for (let i = 1; i <= 10; i += 1) {
    const cMon = lIdx(`mon${String(i)}`)
    if (cMon >= 0) monColIndices.push(cMon)
    const cUmon = lIdx(`umon${String(i)}`)
    if (cUmon >= 0) monColIndices.push(cUmon)
  }
  for (let i = 1; i <= 4; i += 1) {
    const cCmon = lIdx(`cmon${String(i)}`)
    if (cCmon >= 0) monColIndices.push(cCmon)
  }

  const earliestActByMonId = new Map<string, MonsterActNumber113c>()
  for (const line of levelLines.slice(1)) {
    const cells = line.split('\t')
    const levelId = Number((cells[lIdIdx] ?? '').trim())
    const actRaw = Number((cells[lActIdx] ?? '').trim())
    if (!Number.isInteger(levelId) || levelId < 1 || levelId > 136) continue
    if (!Number.isInteger(actRaw) || actRaw < 0 || actRaw > 4) continue
    const actNum = (actRaw + 1) as MonsterActNumber113c
    for (const c of monColIndices) {
      const mId = (cells[c] ?? '').trim().toLowerCase()
      if (!mId) continue
      const prev = earliestActByMonId.get(mId)
      if (prev === undefined || actNum < prev) {
        earliestActByMonId.set(mId, actNum)
      }
    }
  }

  const msLines = monStatsText.split(/\r?\n/).filter((l: string) => l.trim().length > 0)
  const msHeaders = msLines[0]!.split('\t').map((h: string) => h.trim())
  const mIdx = (col: string): number => msHeaders.findIndex((h) => h.toLowerCase() === col.toLowerCase())
  const mIdIdx = mIdx('Id')
  const mBaseIdIdx = mIdx('BaseId')
  const mMinion1Idx = mIdx('minion1')
  const mMinion2Idx = mIdx('minion2')
  const mSpawnIdx = mIdx('spawn')
  const mMonSoundIdx = mIdx('MonSound')
  const mUMonSoundIdx = mIdx('UMonSound')

  interface MonStatsMeta {
    readonly id: string
    readonly baseId: string
    readonly minion1: string
    readonly minion2: string
    readonly spawn: string
    readonly monSound: string
    readonly uMonSound: string
  }
  const monStatsList: MonStatsMeta[] = []
  for (const line of msLines.slice(1)) {
    const cells = line.split('\t')
    const id = (cells[mIdIdx] ?? '').trim().toLowerCase()
    if (!id) continue
    monStatsList.push({
      id,
      baseId: (cells[mBaseIdIdx] ?? '').trim().toLowerCase(),
      minion1: (cells[mMinion1Idx] ?? '').trim().toLowerCase(),
      minion2: (cells[mMinion2Idx] ?? '').trim().toLowerCase(),
      spawn: (cells[mSpawnIdx] ?? '').trim().toLowerCase(),
      monSound: (cells[mMonSoundIdx] ?? '').trim().toLowerCase(),
      uMonSound: mUMonSoundIdx >= 0 ? (cells[mUMonSoundIdx] ?? '').trim().toLowerCase() : '',
    })
  }

  // 4-pass propagation across BaseId / minion1 / minion2 / spawn
  for (let pass = 0; pass < 4; pass += 1) {
    for (const m of monStatsList) {
      const act = earliestActByMonId.get(m.id)
      const baseAct = m.baseId ? earliestActByMonId.get(m.baseId) : undefined
      const effAct =
        act !== undefined && baseAct !== undefined
          ? (Math.min(act, baseAct) as MonsterActNumber113c)
          : (act ?? baseAct)
      if (effAct === undefined) continue
      for (const rel of [m.id, m.baseId, m.minion1, m.minion2, m.spawn]) {
        if (!rel) continue
        const prev = earliestActByMonId.get(rel)
        if (prev === undefined || effAct < prev) {
          earliestActByMonId.set(rel, effAct)
        }
      }
    }
  }

  const earliestActByMonSoundId = new Map<string, MonsterActNumber113c>()
  for (const m of monStatsList) {
    const act = earliestActByMonId.get(m.id)
    if (act === undefined) continue
    for (const msId of [m.monSound, m.uMonSound]) {
      if (!msId) continue
      const prev = earliestActByMonSoundId.get(msId)
      if (prev === undefined || act < prev) {
        earliestActByMonSoundId.set(msId, act)
      }
    }
  }

  const soundFields: readonly (keyof MonSoundRow113c)[] = [
    'attack1',
    'weapon1',
    'attack2',
    'weapon2',
    'hitSound',
    'deathSound',
    'skill1',
    'skill2',
    'skill3',
    'skill4',
    'footstep',
    'footstepLayer',
    'neutral',
    'init',
    'taunt',
    'flee',
  ]

  const actBySubfolder = new Map<string, MonsterActNumber113c>()
  for (const row of monSoundRows) {
    const act = earliestActByMonSoundId.get(row.id.toLowerCase())
    if (act === undefined) continue
    for (const f of soundFields) {
      const sid = row[f] as number
      if (sid <= 0) continue
      const sRow = SOUNDS_113C[sid]
      if (!sRow) continue
      const count = Math.max(1, sRow.groupSize)
      for (let g = 0; g < count; g += 1) {
        const memberRow = SOUNDS_113C[sid + g]
        if (!memberRow) continue
        const sub = extractMonsterSubfolder113c(memberRow.fileName)
        if (!sub) continue
        const prev = actBySubfolder.get(sub)
        if (prev === undefined || act < prev) {
          actBySubfolder.set(sub, act)
        }
      }
    }
  }

  for (const [sub, act] of Object.entries(PRESET_MONSTER_SUBFOLDER_ACT_113C)) {
    const key = sub.toLowerCase()
    if (!actBySubfolder.has(key)) {
      actBySubfolder.set(key, act)
    }
  }

  return actBySubfolder
}

export function renderMonSoundsModule113c(
  rows: MonSoundRowList113c,
  unshippedMonsterIds: readonly number[],
  monStatsRowsArg?: readonly MonStatsSoundTuple113c[],
  superUniqueRowsArg?: readonly SuperUniqueSoundRow113c[],
): string {
  const monStatsRows = monStatsRowsArg ?? rows.__monStatsSoundRows ?? []
  const superUniqueRows = superUniqueRowsArg ?? rows.__superUniqueSoundRows ?? []
  const lines: string[] = [
    '// AUTO-GENERATED by src/baker/packers/pack-monster-sounds.ts — DO NOT EDIT.',
    '// Source: 1.13c Patch_D2.mpq / d2exp.mpq / d2data.mpq (MonSounds.txt, MonStats.txt, SuperUniques.txt, Sounds.txt).',
    '',
    'export interface MonSoundRow113c {',
    '  readonly index: number',
    '  readonly id: string',
    '  readonly attack1: number',
    '  readonly weapon1: number',
    '  readonly att1Del: number',
    '  readonly wea1Del: number',
    '  readonly att1Prb: number',
    '  readonly wea1Vol: number',
    '  readonly attack2: number',
    '  readonly weapon2: number',
    '  readonly att2Del: number',
    '  readonly wea2Del: number',
    '  readonly att2Prb: number',
    '  readonly wea2Vol: number',
    '  readonly hitSound: number',
    '  readonly deathSound: number',
    '  readonly hitDelay: number',
    '  readonly deaDelay: number',
    '  readonly skill1: number',
    '  readonly skill2: number',
    '  readonly skill3: number',
    '  readonly skill4: number',
    '  readonly footstep: number',
    '  readonly footstepLayer: number',
    '  readonly fsCnt: number',
    '  readonly fsOff: number',
    '  readonly fsPrb: number',
    '  readonly neutral: number',
    '  readonly neuTime: number',
    '  readonly init: number',
    '  readonly taunt: number',
    '  readonly flee: number',
    '  readonly cvtMo1: string',
    '  readonly cvtSk1: string',
    '  readonly cvtTgt1: string',
    '  readonly cvtMo2: string',
    '  readonly cvtSk2: string',
    '  readonly cvtTgt2: string',
    '  readonly cvtMo3: string',
    '  readonly cvtSk3: string',
    '  readonly cvtTgt3: string',
    '}',
    '',
    `export const MON_SOUNDS_ROW_COUNT_113C = ${String(rows.length)} as const`,
    '',
    `export const UNSHIPPED_MONSTER_SOUND_IDS_113C: readonly number[] = [${unshippedMonsterIds.join(', ')}] as const`,
    'export const MISSING_MONSTER_SOUND_IDS_113C = UNSHIPPED_MONSTER_SOUND_IDS_113C',
    '',
    'const UNSHIPPED_MONSTER_SOUND_ID_SET_113C: ReadonlySet<number> = new Set<number>(UNSHIPPED_MONSTER_SOUND_IDS_113C)',
    '',
    'export function isUnshippedMonsterSoundId113c(soundId: number): boolean {',
    '  return UNSHIPPED_MONSTER_SOUND_ID_SET_113C.has(soundId)',
    '}',
    '',
    'export const MON_SOUNDS_113C: readonly MonSoundRow113c[] = [',
  ]

  for (const r of rows) {
    lines.push(
      `  { index: ${String(r.index)}, id: ${JSON.stringify(r.id)}, attack1: ${String(r.attack1)}, weapon1: ${String(r.weapon1)}, att1Del: ${String(r.att1Del)}, wea1Del: ${String(r.wea1Del)}, att1Prb: ${String(r.att1Prb)}, wea1Vol: ${String(r.wea1Vol)}, attack2: ${String(r.attack2)}, weapon2: ${String(r.weapon2)}, att2Del: ${String(r.att2Del)}, wea2Del: ${String(r.wea2Del)}, att2Prb: ${String(r.att2Prb)}, wea2Vol: ${String(r.wea2Vol)}, hitSound: ${String(r.hitSound)}, deathSound: ${String(r.deathSound)}, hitDelay: ${String(r.hitDelay)}, deaDelay: ${String(r.deaDelay)}, skill1: ${String(r.skill1)}, skill2: ${String(r.skill2)}, skill3: ${String(r.skill3)}, skill4: ${String(r.skill4)}, footstep: ${String(r.footstep)}, footstepLayer: ${String(r.footstepLayer)}, fsCnt: ${String(r.fsCnt)}, fsOff: ${String(r.fsOff)}, fsPrb: ${String(r.fsPrb)}, neutral: ${String(r.neutral)}, neuTime: ${String(r.neuTime)}, init: ${String(r.init)}, taunt: ${String(r.taunt)}, flee: ${String(r.flee)}, cvtMo1: ${JSON.stringify(r.cvtMo1)}, cvtSk1: ${JSON.stringify(r.cvtSk1)}, cvtTgt1: ${JSON.stringify(r.cvtTgt1)}, cvtMo2: ${JSON.stringify(r.cvtMo2)}, cvtSk2: ${JSON.stringify(r.cvtSk2)}, cvtTgt2: ${JSON.stringify(r.cvtTgt2)}, cvtMo3: ${JSON.stringify(r.cvtMo3)}, cvtSk3: ${JSON.stringify(r.cvtSk3)}, cvtTgt3: ${JSON.stringify(r.cvtTgt3)} },`,
    )
  }

  lines.push(
    '] as const',
    '',
    'export type MonStatsSoundTuple113c = readonly [id: string, monSound: string, uMonSound: string]',
    '',
    'export const MON_STATS_SOUND_BY_HCIDX_113C: readonly MonStatsSoundTuple113c[] = [',
  )

  for (const [id, monSound, uMonSound] of monStatsRows) {
    lines.push(`  [${JSON.stringify(id)}, ${JSON.stringify(monSound)}, ${JSON.stringify(uMonSound)}],`)
  }

  lines.push(
    '] as const',
    '',
    'export const SUPER_UNIQUE_MON_SOUND_BY_ID_113C: Readonly<Record<number, string>> = Object.freeze({',
  )

  for (const su of superUniqueRows) {
    lines.push(`  ${String(su.hcIdx)}: ${JSON.stringify(su.monSound)},`)
  }

  lines.push(
    '})',
    '',
    'export const SUPER_UNIQUE_MON_SOUND_BY_NAME_113C: Readonly<Record<string, string>> = Object.freeze({',
  )

  for (const su of superUniqueRows) {
    lines.push(`  ${JSON.stringify(su.id.toLowerCase())}: ${JSON.stringify(su.monSound)},`)
    if (su.id.toLowerCase() === 'the feature creep') {
      lines.push(`  "hephasto the armorer": ${JSON.stringify(su.monSound)},`)
    }
  }

  lines.push(
    '})',
    '',
    'const MON_SOUNDS_BY_ID_RECORD_113C: Record<string, MonSoundRow113c> = {}',
    'const MON_SOUNDS_BY_ID_MAP_113C = new Map<string, MonSoundRow113c>()',
    'const MON_SOUNDS_BY_INDEX_MAP_113C = new Map<number, MonSoundRow113c>()',
    'for (const row of MON_SOUNDS_113C) {',
    '  MON_SOUNDS_BY_ID_RECORD_113C[row.id] = row',
    '  MON_SOUNDS_BY_ID_RECORD_113C[row.id.toLowerCase()] = row',
    '  MON_SOUNDS_BY_ID_MAP_113C.set(row.id.toLowerCase(), row)',
    '  MON_SOUNDS_BY_INDEX_MAP_113C.set(row.index, row)',
    '}',
    'export const MON_SOUNDS_BY_ID_113C: Readonly<Record<string, MonSoundRow113c>> = Object.freeze(MON_SOUNDS_BY_ID_RECORD_113C)',
    '',
    'export function getMonSoundRow113c(idOrIndex: string | number | MonSoundRow113c): MonSoundRow113c | undefined {',
    '  if (typeof idOrIndex === "object" && idOrIndex !== null) return idOrIndex',
    '  if (typeof idOrIndex === "number") {',
    '    return MON_SOUNDS_BY_INDEX_MAP_113C.get(idOrIndex) ?? MON_SOUNDS_113C[idOrIndex]',
    '  }',
    '  return MON_SOUNDS_BY_ID_MAP_113C.get(String(idOrIndex).trim().toLowerCase())',
    '}',
    '',
    'export const getMonSound113c = getMonSoundRow113c',
    'export const getMonSoundById113c = getMonSoundRow113c',
    '',
    'export interface MonsterSoundUnitRef113c {',
    '  readonly classId: number',
    '  readonly isUnique?: boolean | undefined',
    '  readonly isChampion?: boolean | undefined',
    '  readonly isSuperUnique?: boolean | undefined',
    '  readonly superUniqueId?: number | undefined',
    '  readonly name?: string | undefined',
    '}',
    '',
    '/**',
    ' * 1.13c `D2Client.dll` `0x6fad2a70` (`GetUnitMonSoundTxtRecord`):',
    ' * Resolves a monster unit (`MonStats.txt` `hcIdx` + `SuperUniques.txt` + unique/champion flags)',
    ' * to its `MonSounds.txt` profile ID (`MonSound` / `UMonSound`).',
    ' */',
    'export function resolveMonsterSoundProfileId113c(unit: MonsterSoundUnitRef113c): string {',
    '  if (unit.isSuperUnique) {',
    '    if (unit.superUniqueId !== undefined) {',
    '      const suSound = SUPER_UNIQUE_MON_SOUND_BY_ID_113C[unit.superUniqueId]',
    '      if (suSound) return suSound',
    '    }',
    '    if (unit.name) {',
    '      const suSound = SUPER_UNIQUE_MON_SOUND_BY_NAME_113C[unit.name.trim().toLowerCase()]',
    '      if (suSound) return suSound',
    '    }',
    '  }',
    '  const tuple = MON_STATS_SOUND_BY_HCIDX_113C[unit.classId]',
    '  if (!tuple) return ""',
    '  const [, monSound, uMonSound] = tuple',
    '  if ((unit.isUnique || unit.isChampion || unit.isSuperUnique) && uMonSound.length > 0) {',
    '    return uMonSound',
    '  }',
    '  return monSound',
    '}',
    '',
    'export function resolveUnitMonSoundRow113c(unit: MonsterSoundUnitRef113c): MonSoundRow113c | undefined {',
    '  const profileId = resolveMonsterSoundProfileId113c(unit)',
    '  return profileId.length > 0 ? getMonSoundRow113c(profileId) : undefined',
    '}',
    '',
    'const MONSTER_MODE_CODE_TO_ID_113C: Readonly<Record<string, number>> = Object.freeze({',
    '  DT: 0,',
    '  NU: 1,',
    '  WL: 2,',
    '  GH: 3,',
    '  A1: 4,',
    '  A2: 5,',
    '  BL: 6,',
    '  SC: 7,',
    '  S1: 8,',
    '  S2: 9,',
    '  S3: 10,',
    '  S4: 11,',
    '  DD: 12,',
    '  KB: 13,',
    '  XX: 14,',
    '  RN: 15,',
    '})',
    '',
    'const MONSTER_CVT_SKILL_NAME_TO_ID_113C: Readonly<Record<string, number>> = Object.freeze({',
    '  charge: 107,',
    '  resurrect: 181,',
    '  mosquito: 206,',
    '  unholybolt: 157,',
    '  bestow: 182,',
    '  leap: 132,',
    '})',
    '',
    '/**',
    ' * 1.13c `D2Client.dll` `0x6fad2c35..0x6fad2d05` / `0x6fad4583..0x6fad45d0`:',
    ' * Applies `CvtMo1..3` / `CvtSk1..3` / `CvtTgt1..3` mode conversion for a monster sound row.',
    ' */',
    'export function convertMonsterSoundMode113c(row: MonSoundRow113c, mode: number, skillId?: number): number {',
    '  const slots: readonly [string, string, string][] = [',
    '    [row.cvtMo1, row.cvtSk1, row.cvtTgt1],',
    '    [row.cvtMo2, row.cvtSk2, row.cvtTgt2],',
    '    [row.cvtMo3, row.cvtSk3, row.cvtTgt3],',
    '  ]',
    '  for (const [cvtMo, cvtSk, cvtTgt] of slots) {',
    '    if (!cvtMo || !cvtTgt) continue',
    '    const srcMode = MONSTER_MODE_CODE_TO_ID_113C[cvtMo.toUpperCase()]',
    '    const dstMode = MONSTER_MODE_CODE_TO_ID_113C[cvtTgt.toUpperCase()]',
    '    if (srcMode === undefined || dstMode === undefined) continue',
    '    if (!cvtSk) {',
    '      if (mode === srcMode) return dstMode',
    '      continue',
    '    }',
    '    const reqSkillId = MONSTER_CVT_SKILL_NAME_TO_ID_113C[cvtSk.toLowerCase()]',
    '    if (reqSkillId !== undefined && skillId === reqSkillId && (mode === srcMode || mode === 7)) {',
    '      return dstMode',
    '    }',
    '  }',
    '  return mode',
    '}',
    '',
    'export type MonsterSoundEvent113c =',
    '  | "attack1"',
    '  | "weapon1"',
    '  | "attack2"',
    '  | "weapon2"',
    '  | "hit"',
    '  | "hitSound"',
    '  | "gethit"',
    '  | "death"',
    '  | "deathSound"',
    '  | "die"',
    '  | "skill1"',
    '  | "skill2"',
    '  | "skill3"',
    '  | "skill4"',
    '  | "footstep"',
    '  | "footstepLayer"',
    '  | "neutral"',
    '  | "init"',
    '  | "taunt"',
    '  | "flee"',
    '',
    'export interface MonsterSoundRecordsPlayer113c {',
    '  play(id: number, options?: {',
    '    readonly volume?: number',
    '    readonly delayTicks?: number',
    '    readonly x?: number',
    '    readonly y?: number',
    '    readonly local?: boolean',
    '    readonly unit?: { readonly id: number; readonly unitType?: string | number; x?: number; y?: number } | null',
    '  }): number',
    '  update?(): void',
    '  getRecordSoundId?(handle: number): number',
    '}',
    '',
    'export interface PlayMonsterSoundOptions113c {',
    '  readonly records?: MonsterSoundRecordsPlayer113c | null | undefined',
    '  readonly rng?: { rand?(n: number): number; nextUint32?(): number } | (() => number) | undefined',
    '  readonly profileId?: string | number | MonSoundRow113c | undefined',
    '  readonly monSound?: string | number | MonSoundRow113c | undefined',
    '  readonly id?: string | number | undefined',
    '  readonly uhcIdx?: string | number | undefined',
    '  readonly event?: MonsterSoundEvent113c | undefined',
    '  readonly x?: number | undefined',
    '  readonly y?: number | undefined',
    '  readonly local?: boolean | undefined',
    '  readonly delayTicks?: number | undefined',
    '  readonly volume?: number | undefined',
    '  readonly unit?: { readonly id: number; readonly unitType?: string | number; x?: number; y?: number } | null | undefined',
    '}',
    '',
    'export function resolveMonsterSoundId113c(',
    '  idOrRow: string | number | MonSoundRow113c,',
    '  event: MonsterSoundEvent113c,',
    '  _uhcIdx?: string | number,',
    '): number {',
    '  const row = getMonSoundRow113c(idOrRow)',
    '  if (!row) return 0',
    '  switch (event) {',
    '    case "attack1":',
    '      return row.attack1',
    '    case "weapon1":',
    '      return row.weapon1',
    '    case "attack2":',
    '      return row.attack2',
    '    case "weapon2":',
    '      return row.weapon2',
    '    case "hit":',
    '    case "hitSound":',
    '    case "gethit":',
    '      return row.hitSound',
    '    case "death":',
    '    case "deathSound":',
    '    case "die":',
    '      return row.deathSound',
    '    case "skill1":',
    '      return row.skill1',
    '    case "skill2":',
    '      return row.skill2',
    '    case "skill3":',
    '      return row.skill3',
    '    case "skill4":',
    '      return row.skill4',
    '    case "footstep":',
    '      return row.footstep',
    '    case "footstepLayer":',
    '      return row.footstepLayer',
    '    case "neutral":',
    '      return row.neutral',
    '    case "init":',
    '      return row.init',
    '    case "taunt":',
    '      return row.taunt || row.init || row.skill4 || row.attack1',
    '    case "flee":',
    '      return row.flee',
    '    default:',
    '      return 0',
    '  }',
    '}',
    '',
    'export const resolveMonsterEventSoundId113c = resolveMonsterSoundId113c',
    '',
    'export function getMonsterEventDelayTicks113c(',
    '  idOrRow: string | number | MonSoundRow113c,',
    '  event: MonsterSoundEvent113c,',
    '): number {',
    '  const row = getMonSoundRow113c(idOrRow)',
    '  if (!row) return 0',
    '  switch (event) {',
    '    case "attack1":',
    '      return row.att1Del',
    '    case "weapon1":',
    '      return row.wea1Del',
    '    case "attack2":',
    '      return row.att2Del',
    '    case "weapon2":',
    '      return row.wea2Del',
    '    case "hit":',
    '    case "hitSound":',
    '    case "gethit":',
    '      return row.hitDelay',
    '    case "death":',
    '    case "deathSound":',
    '    case "die":',
    '      return row.deaDelay',
    '    default:',
    '      return 0',
    '  }',
    '}',
    '',
    'export function resolveMonsterSound113c(',
    '  arg0: string | number | MonSoundRow113c | PlayMonsterSoundOptions113c,',
    '  eventArg?: MonsterSoundEvent113c,',
    '  recordsArg?: MonsterSoundRecordsPlayer113c | null,',
    '): number {',
    '  let target: string | number | MonSoundRow113c',
    '  let event: MonsterSoundEvent113c',
    '  let records: MonsterSoundRecordsPlayer113c | null | undefined',
    '  let opts: PlayMonsterSoundOptions113c | undefined',
    '  if (',
    '    typeof arg0 === "object" &&',
    '    arg0 !== null &&',
    '    !("attack1" in arg0)',
    '  ) {',
    '    opts = arg0',
    '    target = arg0.profileId ?? arg0.monSound ?? arg0.id ?? ""',
    '    event = arg0.event ?? eventArg ?? "attack1"',
    '    records = arg0.records ?? recordsArg',
    '  } else {',
    '    target = arg0 as string | number | MonSoundRow113c',
    '    event = eventArg ?? "attack1"',
    '    records = recordsArg',
    '  }',
    '  const row = getMonSoundRow113c(target)',
    '  const baseId = resolveMonsterSoundId113c(row ?? target, event)',
    '  if (baseId <= 0 || isUnshippedMonsterSoundId113c(baseId)) return 0',
    '  if (records && typeof records.play === "function") {',
    '    const delay = opts?.delayTicks ?? (row ? getMonsterEventDelayTicks113c(row, event) : 0)',
    '    const handle = records.play(baseId, {',
    '      ...(opts?.x !== undefined ? { x: opts.x } : {}),',
    '      ...(opts?.y !== undefined ? { y: opts.y } : {}),',
    '      ...(opts?.local !== undefined ? { local: opts.local } : {}),',
    '      ...(opts?.unit !== undefined ? { unit: opts.unit } : {}),',
    '      ...(opts?.volume !== undefined ? { volume: opts.volume } : {}),',
    '      ...(delay > 0 ? { delayTicks: delay } : {}),',
    '    })',
    '    if (handle <= 0) return 0',
    '    if (delay <= 0 && typeof records.update === "function") {',
    '      records.update()',
    '    }',
    '    if (typeof records.getRecordSoundId === "function") {',
    '      const playedId = records.getRecordSoundId(handle)',
    '      if (playedId > 0) return playedId',
    '    }',
    '    return baseId',
    '  }',
    '  return baseId',
    '}',
    '',
    'export const playMonsterSound113c = resolveMonsterSound113c',
    'export const playMonsterSoundEvent113c = resolveMonsterSound113c',
    'export const emitMonsterSound113c = resolveMonsterSound113c',
    '',
    'export const MONSTER_PACK_IDS_BY_ACT_113C: Readonly<Record<number, readonly string[]>> = Object.freeze({',
    '  1: Object.freeze(["sfx-mon-act1", "sfx-mon-act1-2", "sfx-mon-act1-3"]),',
    '  2: Object.freeze(["sfx-mon-act2", "sfx-mon-act2-2"]),',
    '  3: Object.freeze(["sfx-mon-act3"]),',
    '  4: Object.freeze(["sfx-mon-act4"]),',
    '  5: Object.freeze(["sfx-mon-act5", "sfx-mon-act5-2"]),',
    '})',
    '',
    'export function getMonsterPackIdsForAct113c(act: number): readonly string[] {',
    '  return MONSTER_PACK_IDS_BY_ACT_113C[act] ?? []',
    '}',
    '',
    'export class MonsterSoundController113c {',
    '  private readonly records: MonsterSoundRecordsPlayer113c | null',
    '  private readonly rng: PlayMonsterSoundOptions113c["rng"]',
    '',
    '  constructor(opts: { readonly records?: MonsterSoundRecordsPlayer113c | null; readonly rng?: PlayMonsterSoundOptions113c["rng"] } = {}) {',
    '    this.records = opts.records ?? null',
    '    this.rng = opts.rng',
    '  }',
    '',
    '  play(optsOrTarget: string | number | MonSoundRow113c | PlayMonsterSoundOptions113c, event?: MonsterSoundEvent113c, opts?: PlayMonsterSoundOptions113c): number {',
    '    if (typeof optsOrTarget === "object" && optsOrTarget !== null && !("attack1" in optsOrTarget)) {',
    '      return resolveMonsterSound113c({ records: this.records, rng: this.rng, ...optsOrTarget })',
    '    }',
    '    return resolveMonsterSound113c({',
    '      records: this.records,',
    '      rng: this.rng,',
    '      profileId: optsOrTarget as string | number | MonSoundRow113c,',
    '      ...(event !== undefined ? { event } : {}),',
    '      ...(opts ?? {}),',
    '    })',
    '  }',
    '}',
    '',
  )

  return lines.join('\n')
}

export interface PackMonsterSoundsOptions113c {
  readonly rootDir?: string
  readonly mpqDir?: string
  readonly publicDir?: string
  readonly writeFiles?: boolean
  readonly concurrency?: number
}

export interface PackMonsterSoundsResult113c {
  readonly monSoundRows: readonly MonSoundRow113c[]
  readonly unshippedMonsterIds: readonly number[]
  readonly packs: readonly SfxPackMeta113c[]
  readonly entries: Readonly<Record<number, SfxPackTuple113c>>
  readonly monSoundsTsText: string
  readonly sfxPackIndexTsText: string
}

function mountMonsterAudioArchives(mpqDir: string): MountedArchives {
  const mounted = new MountedArchives()
  for (const name of MONSTER_AUDIO_ARCHIVE_ORDER_113C) {
    mounted.add(name, MpqArchive.openSync(syncNodeFileSource(join(mpqDir, name))))
  }
  return mounted
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIdx = 0
  const runners = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (true) {
      const idx = nextIdx
      nextIdx += 1
      if (idx >= items.length) break
      results[idx] = await worker(items[idx]!, idx)
    }
  })
  await Promise.all(runners)
  return results
}


export async function deriveGlobalMonsterSoundIds113c(
  dataArchives: import('../../common/mpq/mount.ts').MountedArchives,
  monSoundRows: readonly MonSoundRow113c[]
): Promise<ReadonlySet<number>> {
  const [skillsText, hirelingText, monStatsText] = await Promise.all([
    dataArchives.readText('data\\global\\excel\\skills.txt'),
    dataArchives.readText('data\\global\\excel\\hireling.txt'),
    dataArchives.readText('data\\global\\excel\\monstats.txt')
  ])

  const summonMonStatsIds = new Set<string>()

  const skLines = skillsText.split(/\r?\n/).filter((l: string) => l.trim().length > 0)
  const skHeaders = skLines[0].split('\t').map((h: string) => h.trim().toLowerCase())
  const skSummon = skHeaders.indexOf('summon')
  for (const line of skLines.slice(1)) {
    const cells = line.split('\t')
    const sum = cells[skSummon]?.trim().toLowerCase()
    if (sum && sum !== 'none' && sum !== '') {
      summonMonStatsIds.add(sum)
    }
  }

  const hireLines = hirelingText.split(/\r?\n/).filter((l: string) => l.trim().length > 0)
  const hireHeaders = hireLines[0].split('\t').map((h: string) => h.trim().toLowerCase())
  const hireClass = hireHeaders.indexOf('class') // The prompt says: "PLUS every mercenary from Hireling.txt (Class)"
  for (const line of hireLines.slice(1)) {
    const cells = line.split('\t')
    const cls = cells[hireClass]?.trim().toLowerCase()
    if (cls && cls !== 'none' && cls !== '') {
      summonMonStatsIds.add(cls)
    }
  }

  const msLines = monStatsText.split(/\r?\n/).filter((l: string) => l.trim().length > 0)
  const msHeaders = msLines[0].split('\t').map((h: string) => h.trim().toLowerCase())
  const mIdIdx = msHeaders.indexOf('id')
  const mHcIdx = msHeaders.indexOf('hcidx')
  const mMonSoundIdx = msHeaders.indexOf('monsound')
  const mUMonSoundIdx = msHeaders.indexOf('umonsound')
  const mBaseIdIdx = msHeaders.indexOf('baseid')
  
  const msDict = new Map<string, { monSound: string, uMonSound: string, baseId: string }>()
  for (const line of msLines.slice(1)) {
    const cells = line.split('\t')
    const id = cells[mIdIdx]?.trim().toLowerCase()
    const hcIdx = cells[mHcIdx]?.trim().toLowerCase()
    if (id) {
       const info = {
         monSound: cells[mMonSoundIdx]?.trim().toLowerCase() || '',
         uMonSound: cells[mUMonSoundIdx]?.trim().toLowerCase() || '',
         baseId: cells[mBaseIdIdx]?.trim().toLowerCase() || '',
       }
       msDict.set(id, info)
       if (hcIdx && hcIdx !== '') msDict.set(hcIdx, info)
    }
  }

  const resolveSoundKeys = (id: string): string[] => {
    let curr = id
    let attempts = 0
    while (curr && attempts < 10) {
      attempts++
      const ms = msDict.get(curr)
      if (!ms) break
      if (ms.monSound || ms.uMonSound) {
        const out = []
        if (ms.monSound && ms.monSound !== 'none') out.push(ms.monSound)
        if (ms.uMonSound && ms.uMonSound !== 'none') out.push(ms.uMonSound)
        return out
      }
      curr = ms.baseId
    }
    return []
  }

  const monSoundKeys = new Set<string>()
  for (const monId of summonMonStatsIds) {
    for (const key of resolveSoundKeys(monId)) {
      monSoundKeys.add(key)
    }
  }

  const soundFields: readonly (keyof MonSoundRow113c)[] = [
    'attack1', 'weapon1', 'attack2', 'weapon2', 'hitSound', 'deathSound',
    'skill1', 'skill2', 'skill3', 'skill4', 'footstep', 'footstepLayer',
    'neutral', 'init', 'taunt', 'flee', 'cvtMo1', 'cvtSk1', 'cvtTgt1', 
    'cvtMo2', 'cvtSk2', 'cvtTgt2', 'cvtMo3', 'cvtSk3', 'cvtTgt3'
  ]
  const globalSoundIds = new Set<number>()
  for (const row of monSoundRows) {
    if (monSoundKeys.has(row.id.toLowerCase())) {
      for (const f of soundFields) {
        const sid = row[f]
        if (typeof sid === 'number' && sid > 0) {
           globalSoundIds.add(sid)
           const sRow = SOUNDS_113C[sid]
           if (sRow) {
             for (let g = 0; g < Math.max(1, sRow.groupSize); g++) {
               if (SOUNDS_113C[sid + g]) {
                 globalSoundIds.add(sid + g)
               }
             }
           }
        }
      }
    }
  }
  return globalSoundIds
}

export async function packMonsterSounds113c(
  opts: PackMonsterSoundsOptions113c = {},
): Promise<PackMonsterSoundsResult113c> {
  const rootDir = resolve(opts.rootDir ?? process.cwd())
  const mpqDir = opts.mpqDir ?? DEFAULT_NODE_MPQ_DIR
  const publicDir = opts.publicDir ?? join(rootDir, 'public')
  const writeFiles = opts.writeFiles ?? true
  const concurrency = opts.concurrency ?? Math.max(4, Math.min(16, cpus().length))

  const probe = probeFfmpegOpus113c(undefined, 'monster-sounds')
  const dataArchives = mountSoundTableArchives(mpqDir)
  const audioArchives = mountMonsterAudioArchives(mpqDir)

  const monSoundRows = await extractMonSoundRows113c(dataArchives)
  const { shippedRows, unshippedIds } = scanMonsterSoundRows113c(audioArchives)

  if (unshippedIds.length !== 4 || unshippedIds.join(',') !== '1595,1596,1597,1598') {
    throw new Error(
      `pack-monster-sounds: expected 4 unshipped monster sound IDs [1595,1596,1597,1598], got [${unshippedIds.join(',')}]`,
    )
  }
  if (shippedRows.length !== 1670) {
    throw new Error(`pack-monster-sounds: expected 1670 shipped monster\\* rows, got ${String(shippedRows.length)}`)
  }

  const globalSoundIds = await deriveGlobalMonsterSoundIds113c(dataArchives, monSoundRows)

  const subfolderActs = await deriveMonsterSubfolderActs113c(dataArchives, monSoundRows)
  const rowsByAct = new Map<MonsterActNumber113c, SoundRow113c[]>()
  for (const act of MONSTER_ACT_NUMBERS_113C) {
    rowsByAct.set(act, [])
  }
  const globalRows: SoundRow113c[] = []

  for (const row of shippedRows) {
    if (globalSoundIds.has(row.id)) {
      globalRows.push(row)
      continue
    }

    const sub = extractMonsterSubfolder113c(row.fileName)
    if (!sub) {
      throw new Error(`pack-monster-sounds: invalid monster fileName ${JSON.stringify(row.fileName)} on row ${String(row.id)}`)
    }
    const act = subfolderActs.get(sub)
    if (act === undefined) {
      throw new Error(`pack-monster-sounds: unassigned monster subfolder ${JSON.stringify(sub)} (row ${String(row.id)})`)
    }
    rowsByAct.get(act)!.push(row)
  }

  interface UniqueWavTask {
    readonly normFile: string
    readonly firstRow: SoundRow113c
    readonly mpqPath: string
  }

  const uniqueTasksMap = new Map<string, UniqueWavTask>()
  const bucketsToPack = [
    { prefix: 'sfx-mon-global', rows: globalRows },
    ...MONSTER_ACT_NUMBERS_113C.map(act => ({ prefix: `sfx-mon-act${String(act)}`, rows: rowsByAct.get(act)! }))
  ]

  for (const { prefix, rows: actRows } of bucketsToPack) {
    actRows.sort((a, b) => a.id - b.id)
    for (const row of actRows) {
      const normFile = normalizeSoundFileName113c(row.fileName)
      if (!uniqueTasksMap.has(normFile)) {
        const mpqPath = buildSoundMpqPath113c(row.id)
        if (!mpqPath) {
          throw new Error(`pack-monster-sounds: null MPQ path for row ${String(row.id)}`)
        }
        uniqueTasksMap.set(normFile, { normFile, firstRow: row, mpqPath })
      }
    }
  }

  const uniqueTasks = [...uniqueTasksMap.values()]
  interface EncodedWavResult {
    readonly normFile: string
    readonly chunkBytes: Uint8Array
    readonly sampleRate: number
    readonly frames: number
    readonly channels: 1 | 2
  }

  const encodedList = await mapConcurrent(uniqueTasks, concurrency, async (task): Promise<EncodedWavResult> => {
    const wavBytes = await audioArchives.readBytes(task.mpqPath)
    const wav = parseWavPcm16(wavBytes, `${task.mpqPath} (row ${String(task.firstRow.id)})`)
    const targetBitrate = wav.channels === 2 ? SFX_STEREO_BITRATE_113C : SFX_MONO_BITRATE_113C
    const candidateBitrates = [
      targetBitrate,
      targetBitrate + 8_000,
      targetBitrate + 16_000,
      targetBitrate + 32_000,
    ]
    let chunkBytes: Uint8Array | undefined
    let lastBps = 0
    for (const targetBps of candidateBitrates) {
      const rawOpusBytes = await transcodeWavToOpusOggAsync(wavBytes, targetBps, probe.ffmpegPath)
      const patched = patchOpusHeadInputSampleRate(rawOpusBytes, wav.sampleRate)
      const opus = inspectOggOpusChunk113c(patched, `${task.mpqPath} (row ${String(task.firstRow.id)})`)
      const wavSec = wav.frames / wav.sampleRate
      const decodedSec = (opus.finalGranule - opus.preSkip) / 48_000
      const bpsWav = wavSec > 0 ? (opus.audioPacketBytes * 8) / wavSec : 0
      const bpsDecoded = decodedSec > 0 ? (opus.audioPacketBytes * 8) / decodedSec : 0
      lastBps = Math.min(bpsWav, bpsDecoded)
      if (bpsWav + 1e-6 >= targetBitrate && bpsDecoded + 1e-6 >= targetBitrate) {
        chunkBytes = patched
        break
      }
    }
    if (!chunkBytes) {
      throw new Error(
        `pack-monster-sounds: row ${String(task.firstRow.id)} (${task.firstRow.fileName}) bitrate ${lastBps.toFixed(1)} < ${String(targetBitrate)}`,
      )
    }
    return {
      normFile: task.normFile,
      chunkBytes,
      sampleRate: wav.sampleRate,
      frames: wav.frames,
      channels: wav.channels,
    }
  })

  const encodedByNormFile = new Map<string, EncodedWavResult>(encodedList.map((e) => [e.normFile, e]))

  const newPacks: SfxPackMeta113c[] = []
  const newEntries: Record<number, SfxPackTuple113c> = {}
  const newEntryList: IndexedSfxRow113c[] = []
  const packedBins: { readonly relPath: string; readonly bytes: Uint8Array }[] = []

  for (const { prefix, rows: actRows } of bucketsToPack) {
    const rowsByNorm = new Map<string, SoundRow113c[]>()
    for (const row of actRows) {
      const normFile = normalizeSoundFileName113c(row.fileName)
      let group = rowsByNorm.get(normFile)
      if (!group) {
        group = []
        rowsByNorm.set(normFile, group)
      }
      group.push(row)
    }

    const orderedNormFiles = [...rowsByNorm.keys()]
    interface PartGroup {
      readonly normFiles: string[]
    }
    const parts: PartGroup[] = []
    let currentNorms: string[] = []
    let currentBytes = SFX_PACK_HEADER_BYTES_113C

    for (const normFile of orderedNormFiles) {
      const enc = encodedByNormFile.get(normFile)!
      const chunkLen = enc.chunkBytes.byteLength
      if (currentNorms.length > 0 && currentBytes + chunkLen > D3_MONSTER_PART_MAX_BYTES_113C) {
        parts.push({ normFiles: currentNorms })
        currentNorms = []
        currentBytes = SFX_PACK_HEADER_BYTES_113C
      }
      currentNorms.push(normFile)
      currentBytes += chunkLen
    }
    if (currentNorms.length > 0) {
      parts.push({ normFiles: currentNorms })
    }

    for (let pIdx = 0; pIdx < parts.length; pIdx += 1) {
      const partNo = pIdx + 1
      const packId = partNo === 1 ? prefix : `${prefix}-${String(partNo)}`
      const relPath = `sound/packs/${packId}.bin`
      const url = `/${relPath}`
      const partNorms = parts[pIdx]!.normFiles

      const chunks = partNorms.map((nf) => encodedByNormFile.get(nf)!.chunkBytes)
      const { bytes: bin, offsets } = encodeSfxPackBinary113c(chunks)
      const sha256 = createHash('sha256').update(bin).digest('hex')

      let partRowCount = 0
      for (let uIdx = 0; uIdx < partNorms.length; uIdx += 1) {
        const nf = partNorms[uIdx]!
        const enc = encodedByNormFile.get(nf)!
        const byteOffset = offsets[uIdx]!
        const byteLength = enc.chunkBytes.byteLength
        const sharingRows = rowsByNorm.get(nf)!
        partRowCount += sharingRows.length
        for (const r of sharingRows) {
          newEntries[r.id] = [packId, byteOffset, byteLength, enc.sampleRate, enc.frames, enc.channels]
          newEntryList.push({
            soundId: r.id,
            packId,
            byteOffset,
            byteLength,
            sampleRate: enc.sampleRate,
            frames: enc.frames,
            channels: enc.channels,
          })
        }
      }

      newPacks.push({
        packId,
        url,
        bytes: bin.byteLength,
        sha256,
        chunkCount: chunks.length,
        rowCount: partRowCount,
        tier: 'monster',
        prefixes: ['monster\\'],
        targetBitrateMono: SFX_MONO_BITRATE_113C,
        targetBitrateStereo: SFX_STEREO_BITRATE_113C,
      })
      packedBins.push({ relPath, bytes: bin })
    }
  }

  newEntryList.sort((a, b) => a.soundId - b.soundId)
  const monSoundsTsText = renderMonSoundsModule113c(monSoundRows, unshippedIds)
  const existing = readExistingSfxPackIndex113c(rootDir)
  const filteredExistingPacks = existing.packs.filter((p) => !p.packId.startsWith('sfx-mon-act') && !p.packId.startsWith('sfx-mon-global'))
  const filteredExistingEntries = existing.entries.filter((e) => !e.packId.startsWith('sfx-mon-act') && !e.packId.startsWith('sfx-mon-global'))

  const merged = mergeSfxPackIndex113c(
    { packs: filteredExistingPacks, entries: filteredExistingEntries },
    newPacks,
    newEntryList,
  )
  let sfxPackIndexTsText = renderSfxPackIndexModule113c(merged.packs, merged.entries)

  if (writeFiles) {
    const monSoundsAbs = join(rootDir, MON_SOUNDS_TS_FILE)
    mkdirSync(dirname(monSoundsAbs), { recursive: true })
    writeFileSync(monSoundsAbs, monSoundsTsText, 'utf8')

    const indexAbs = join(rootDir, SFX_PACK_INDEX_TS_FILE)
    mkdirSync(dirname(indexAbs), { recursive: true })
    writeFileSync(indexAbs, sfxPackIndexTsText, 'utf8')

    const packsDir = join(publicDir, 'sound', 'packs')
    mkdirSync(packsDir, { recursive: true })
    const validMonBins = new Set(packedBins.map((b) => b.relPath.split('/').pop()!))
    for (const f of readdirSync(packsDir)) {
      if ((f.startsWith('sfx-mon-act') || f.startsWith('sfx-mon-global')) && f.endsWith('.bin') && !validMonBins.has(f)) {
        unlinkSync(join(packsDir, f))
      }
    }
    for (const b of packedBins) {
      const abs = join(publicDir, b.relPath)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, b.bytes)
    }

    // Re-bake sfx-skills-* so sfx-skills-common drops the 113 monster\* fallback chunks now owned by sfx-mon-act*
    const skillResult = await packSkillSounds113c({
      rootDir,
      mpqDir,
      publicDir,
      writeFiles: true,
    })
    sfxPackIndexTsText = skillResult.indexModuleSource

    // Remove any stale sfx-skills-common-*.bin parts that are no longer in SFX_PACKS_113C
    const finalIndex = readExistingSfxPackIndex113c(rootDir)
    const activePackFileNames = new Set(finalIndex.packs.map((p) => p.url.split('/').pop()!))
    for (const f of readdirSync(packsDir)) {
      if (f.startsWith('sfx-skills-') && f.endsWith('.bin') && !activePackFileNames.has(f)) {
        unlinkSync(join(packsDir, f))
      }
    }

    generateAssetManifest({ publicDir })
  }

  return {
    monSoundRows,
    unshippedMonsterIds: unshippedIds,
    packs: newPacks,
    entries: newEntries,
    monSoundsTsText,
    sfxPackIndexTsText,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  packMonsterSounds113c()
    .then((res) => {
      const totalBytes = res.packs.reduce((s, p) => s + p.bytes, 0)
      console.log(
        `✓ Packed ${String(res.packs.length)} monster sound packs (${String(Object.keys(res.entries).length)} rows, ${String(totalBytes)} B) and generated ${MON_SOUNDS_TS_FILE} (${String(res.monSoundRows.length)} MonSounds rows, ${String(res.unshippedMonsterIds.length)} D9 unshipped IDs)`,
      )
    })
    .catch((err: unknown) => {
      console.error(err)
      process.exit(1)
    })
}
