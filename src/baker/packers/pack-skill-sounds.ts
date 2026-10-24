/**
 * Diablo II v1.13c Seven-Class Skill & Missile Sound Baker (`src/baker/packers/pack-skill-sounds.ts`, #947 F19).
 *
 * Extracts all 303 `Stream = 0` `skill\*` `Sounds.txt` entries (plus any non-`skill\*` `Stream = 0`
 * sound IDs and `groupSize` variants referenced by `Skills.txt` and `Missiles.txt` that are not already
 * indexed in core/combat/monsters/ambient packs) from the 1.13c MPQ archive chain, transcodes each unique
 * WAV to hard-CBR Ogg Opus (`-vbr off -frame_duration 20 -bitexact`, 24 kbps mono / 40 kbps stereo),
 * partitions them into per-class + common `D2SP` v2 binary containers under `public/sound/packs/sfx-skills-*.bin`
 * with D3 part-splitting (`<= 180,000 B` per binary part), non-destructively merges them into
 * `src/common/audio/sfx-pack-index-113c.ts` (`tier: 'skill'`), and generates the pure-TypeScript
 * `src/common/audio/skill-sounds-113c.ts` table and 4-stage lifecycle controller module.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  SOUNDS_113C,
  SOUNDS_BY_NAME_113C,
  buildSoundMpqPath113c,
  type SoundsRow113c,
} from '../../common/audio/sounds-113c.ts'
import type { SfxPackMeta113c } from '../../common/audio/sfx-pack-index-113c.ts'
import { parseWavPcm16, type WavPcm16 } from '../../common/formats/wav.ts'
import { generateAssetManifest } from '../io/asset-manifest.ts'
import { DEFAULT_NODE_MPQ_DIR, type ArchiveSource } from '../mpq-archive-source.ts'

function resolveDefaultMpqDir(rootDir: string): string {
  const local = join(rootDir, 'samples', 'd2')
  return existsSync(join(local, 'd2data.mpq')) ? local : DEFAULT_NODE_MPQ_DIR
}
import {
  SFX_MONO_BITRATE_113C,
  SFX_PACK_INDEX_TS_FILE,
  SFX_STEREO_BITRATE_113C,
  encodeSfxPackBinary113c,
  inspectOggOpusChunk113c,
  mergeSfxPackIndex113c,
  mountAudioArchives,
  normalizeSoundFileName113c,
  patchOpusHeadInputSampleRate,
  readExistingSfxPackIndex113c,
  renderSfxPackIndexModule113c,
  transcodeWavToOpusOggAsync,
  type IndexedSfxRow113c,
} from './pack-sfx.ts'

export const D3_SKILL_PART_MAX_BYTES = 180_000

export const SKILL_BUCKETS = [
  'ama',
  'sor',
  'nec',
  'pal',
  'bar',
  'dru',
  'ass',
  'common',
] as const

export type SkillBucket113c = (typeof SKILL_BUCKETS)[number]

export const SKILL_SOUND_TS_FILE = 'src/common/audio/skill-sounds-113c.ts'

export const SKILL_BUCKET_PREFIXES_113C: Readonly<Record<SkillBucket113c, readonly string[]>> = {
  ama: ['skill\\amazon\\'],
  sor: ['skill\\sorceress\\'],
  nec: ['skill\\necromancer\\'],
  pal: ['skill\\paladin\\'],
  bar: ['skill\\barbarian\\'],
  dru: ['skill\\druid\\'],
  ass: ['skill\\assassin\\', 'skill\\assasin\\', 'skill\\traps\\'],
  common: ['skill\\'],
}

export interface ExtractedSkillSoundRow113c {
  readonly id: number
  readonly skillId: number
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
}

export interface ExtractedMissileSoundRow113c {
  readonly id: number
  readonly missileId: number
  readonly missile: string
  readonly travelSound: number
  readonly hitSound: number
  readonly progSound: number
}

export interface ExtractedSkillAndMissileTables113c {
  readonly skillRows: readonly ExtractedSkillSoundRow113c[]
  readonly missileRows: readonly ExtractedMissileSoundRow113c[]
  readonly monsterDeathSounds: Readonly<Record<number, number>>
  readonly referencedSoundIds: ReadonlySet<number>
}

const SOUND_NAME_LOWER_TO_ID: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>()
  for (const [name, id] of Object.entries(SOUNDS_BY_NAME_113C)) {
    map.set(name.toLowerCase(), id)
  }
  for (const row of SOUNDS_113C) {
    if (row.id > 0 && row.sound) {
      map.set(row.sound.toLowerCase(), row.id)
    }
  }
  return map
})()

export function resolveSoundNameToId113c(rawName: string | undefined): number {
  if (!rawName) return 0
  const trimmed = rawName.trim().toLowerCase()
  if (!trimmed || trimmed === 'none' || trimmed === '0') return 0
  return SOUND_NAME_LOWER_TO_ID.get(trimmed) ?? 0
}

export function classifySkillRowBucket113c(row: SoundsRow113c): SkillBucket113c | null {
  if (row.id <= 0 || row.stream) return null
  const norm = normalizeSoundFileName113c(row.fileName)
  if (!norm.startsWith('skill\\') || norm === 'none.wav') return null
  const rest = norm.slice('skill\\'.length)
  if (rest.startsWith('amazon\\')) return 'ama'
  if (rest.startsWith('sorceress\\')) return 'sor'
  if (rest.startsWith('necromancer\\')) return 'nec'
  if (rest.startsWith('paladin\\')) return 'pal'
  if (rest.startsWith('barbarian\\')) return 'bar'
  if (rest.startsWith('druid\\')) return 'dru'
  if (rest.startsWith('assassin\\') || rest.startsWith('assasin\\') || rest.startsWith('traps\\')) {
    return 'ass'
  }
  return 'common'
}

function parseTsvRows(bytes: Uint8Array): Array<Record<string, string>> {
  const raw = new TextDecoder('latin1').decode(bytes)
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return []
  const headers = lines[0]!.split('\t').map((h) => h.trim())
  const out: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i]!.split('\t')
    if (cols[0]?.trim().toLowerCase() === 'expansion') continue
    const row: Record<string, string> = {}
    for (let c = 0; c < headers.length; c += 1) {
      row[headers[c]!] = (cols[c] ?? '').trim()
    }
    out.push(row)
  }
  return out
}

function expandSoundGroupIds(rootId: number, out: Set<number>): void {
  if (rootId <= 0 || rootId >= SOUNDS_113C.length) return
  const root = SOUNDS_113C[rootId]
  if (!root || root.id <= 0 || root.stream) return
  const groupCount = Math.max(1, root.groupSize)
  for (let k = 0; k < groupCount; k += 1) {
    const member = SOUNDS_113C[rootId + k]
    if (!member || member.id <= 0 || member.stream) continue
    const norm = normalizeSoundFileName113c(member.fileName)
    if (norm === '' || norm === 'none.wav') continue
    out.add(member.id)
  }
}

async function requireArchiveBytes(archives: ArchiveSource, path: string): Promise<Uint8Array> {
  const bytes = archives.readBytes
    ? await archives.readBytes(path)
    : archives.readFile
      ? await archives.readFile(path)
      : null
  if (!bytes) {
    throw new Error(`Missing required MPQ table: ${path}`)
  }
  return bytes
}

export async function extractSkillAndMissileSoundTables113c(
  archives: ArchiveSource,
): Promise<ExtractedSkillAndMissileTables113c> {
  const [skillsBytes, missilesBytes, monStatsBytes, monSoundsBytes] = await Promise.all([
    requireArchiveBytes(archives, 'data\\global\\excel\\skills.txt'),
    requireArchiveBytes(archives, 'data\\global\\excel\\missiles.txt'),
    requireArchiveBytes(archives, 'data\\global\\excel\\monstats.txt'),
    requireArchiveBytes(archives, 'data\\global\\excel\\monsounds.txt'),
  ])

  const rawSkills = parseTsvRows(skillsBytes).filter((r) => r.Id !== undefined && r.Id !== '')
  const rawMissiles = parseTsvRows(missilesBytes).filter((r) => r.Id !== undefined && r.Id !== '')
  const rawMonStats = parseTsvRows(monStatsBytes).filter(
    (r) => r.hcIdx !== undefined && r.hcIdx !== '',
  )
  const rawMonSounds = parseTsvRows(monSoundsBytes).filter((r) => r.Id !== undefined && r.Id !== '')

  const referencedSoundIds = new Set<number>()
  const skillRows: ExtractedSkillSoundRow113c[] = []

  for (const r of rawSkills) {
    const id = Number(r.Id)
    const charclass = (r.charclass ?? '').trim().toLowerCase()
    const stsound = resolveSoundNameToId113c(r.stsound)
    const stsoundclass = resolveSoundNameToId113c(r.stsoundclass)
    const stsounddelay = Math.max(0, Math.trunc(Number(r.stsounddelay || 0)))
    const weaponsnd = Math.max(0, Math.trunc(Number(r.weaponsnd || 0)))
    const dosound = resolveSoundNameToId113c(r.dosound)
    const dosoundA = resolveSoundNameToId113c(r['dosound a'])
    const dosoundB = resolveSoundNameToId113c(r['dosound b'])
    const tgtsound = resolveSoundNameToId113c(r.tgtsound)
    const prgsound = resolveSoundNameToId113c(r.prgsound)

    for (const sid of [stsound, stsoundclass, dosound, dosoundA, dosoundB, tgtsound, prgsound]) {
      expandSoundGroupIds(sid, referencedSoundIds)
    }

    skillRows.push({
      id,
      skillId: id,
      skill: r.skill ?? '',
      charclass,
      stsound,
      stsoundclass,
      stsounddelay,
      weaponsnd,
      dosound,
      dosoundA,
      dosoundB,
      tgtsound,
      prgsound,
    })
  }
  skillRows.sort((a, b) => a.id - b.id)

  const missileRows: ExtractedMissileSoundRow113c[] = []
  for (const r of rawMissiles) {
    const id = Number(r.Id)
    const travelSound = resolveSoundNameToId113c(r.TravelSound)
    const hitSound = resolveSoundNameToId113c(r.HitSound)
    const progSound = resolveSoundNameToId113c(r.ProgSound)

    for (const sid of [travelSound, hitSound, progSound]) {
      expandSoundGroupIds(sid, referencedSoundIds)
    }

    missileRows.push({
      id,
      missileId: id,
      missile: r.Missile ?? '',
      travelSound,
      hitSound,
      progSound,
    })
  }
  missileRows.sort((a, b) => a.id - b.id)

  const deathByMonSound = new Map<string, number>()
  for (const r of rawMonSounds) {
    const key = (r.Id ?? '').trim().toLowerCase()
    const deathId = resolveSoundNameToId113c(r.DeathSound)
    if (key && deathId > 0) {
      deathByMonSound.set(key, deathId)
    }
  }

  const monsterDeathSounds: Record<number, number> = {}
  for (const r of rawMonStats) {
    const hcIdx = Number(r.hcIdx)
    const monSoundKey = (r.MonSound ?? '').trim().toLowerCase()
    const deathId = deathByMonSound.get(monSoundKey) ?? 0
    if (Number.isFinite(hcIdx) && hcIdx >= 0 && deathId > 0) {
      monsterDeathSounds[hcIdx] = deathId
    }
  }

  return {
    skillRows,
    missileRows,
    monsterDeathSounds,
    referencedSoundIds,
  }
}

export function renderSkillSoundsModule113c(
  skillRows: readonly ExtractedSkillSoundRow113c[],
  missileRows: readonly ExtractedMissileSoundRow113c[],
  monsterDeathSounds: Readonly<Record<number, number>>,
): string {
  const lines: string[] = []
  lines.push('// AUTO-GENERATED by src/baker/packers/pack-skill-sounds.ts — DO NOT EDIT MANUALLY.')
  lines.push('// Source of truth: Diablo II v1.13c Skills.txt (357 rows), Missiles.txt (684 rows), MonStats.txt + MonSounds.txt.')
  lines.push('')
  lines.push("import { SFX_PACKS_113C } from './sfx-pack-index-113c.ts'")
  lines.push('')
  lines.push("export type SkillSoundClassCode113c = 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass' | ''")
  lines.push('')
  lines.push('export interface SkillSoundRow113c {')
  lines.push('  readonly id: number')
  lines.push('  readonly skillId: number')
  lines.push('  readonly skill: string')
  lines.push('  readonly charclass: SkillSoundClassCode113c')
  lines.push('  readonly stsound: number')
  lines.push('  readonly stsoundclass: number')
  lines.push('  readonly stsounddelay: number')
  lines.push('  readonly weaponsnd: number')
  lines.push('  readonly dosound: number')
  lines.push('  readonly dosoundA: number')
  lines.push('  readonly dosoundB: number')
  lines.push('  readonly tgtsound: number')
  lines.push('  readonly prgsound: number')
  lines.push('}')
  lines.push('')
  lines.push('export interface MissileSoundRow113c {')
  lines.push('  readonly id: number')
  lines.push('  readonly missileId: number')
  lines.push('  readonly missile: string')
  lines.push('  readonly travelSound: number')
  lines.push('  readonly hitSound: number')
  lines.push('  readonly progSound: number')
  lines.push('}')
  lines.push('')
  lines.push('export const SKILL_SOUNDS_113C: readonly SkillSoundRow113c[] = [')
  for (const r of skillRows) {
    lines.push(
      `  { id: ${String(r.id)}, skillId: ${String(r.skillId)}, skill: ${JSON.stringify(r.skill)}, charclass: ${JSON.stringify(r.charclass)}, stsound: ${String(r.stsound)}, stsoundclass: ${String(r.stsoundclass)}, stsounddelay: ${String(r.stsounddelay)}, weaponsnd: ${String(r.weaponsnd)}, dosound: ${String(r.dosound)}, dosoundA: ${String(r.dosoundA)}, dosoundB: ${String(r.dosoundB)}, tgtsound: ${String(r.tgtsound)}, prgsound: ${String(r.prgsound)} },`,
    )
  }
  lines.push(']')
  lines.push('')
  lines.push('export const SKILL_SOUND_TABLE_113C = SKILL_SOUNDS_113C')
  lines.push('')
  lines.push('export const SKILL_SOUND_MAP_113C: Readonly<Record<number, SkillSoundRow113c>> = (() => {')
  lines.push('  const map: Record<number, SkillSoundRow113c> = {}')
  lines.push('  for (const row of SKILL_SOUNDS_113C) {')
  lines.push('    map[row.id] = row')
  lines.push('  }')
  lines.push('  return map')
  lines.push('})()')
  lines.push('')
  lines.push('export function getSkillSoundEntry113c(skillId: number): SkillSoundRow113c | undefined {')
  lines.push('  if (!Number.isFinite(skillId) || skillId < 0) return undefined')
  lines.push('  return SKILL_SOUND_MAP_113C[Math.trunc(skillId)]')
  lines.push('}')
  lines.push('export const getSkillSounds113c = getSkillSoundEntry113c')
  lines.push('')
  lines.push('export const MISSILE_SOUNDS_113C: readonly MissileSoundRow113c[] = [')
  for (const r of missileRows) {
    lines.push(
      `  { id: ${String(r.id)}, missileId: ${String(r.missileId)}, missile: ${JSON.stringify(r.missile)}, travelSound: ${String(r.travelSound)}, hitSound: ${String(r.hitSound)}, progSound: ${String(r.progSound)} },`,
    )
  }
  lines.push(']')
  lines.push('')
  lines.push('export const MISSILE_SOUND_TABLE_113C = MISSILE_SOUNDS_113C')
  lines.push('')
  lines.push('export const MISSILE_SOUND_MAP_113C: Readonly<Record<number, MissileSoundRow113c>> = (() => {')
  lines.push('  const map: Record<number, MissileSoundRow113c> = {}')
  lines.push('  for (const row of MISSILE_SOUNDS_113C) {')
  lines.push('    map[row.id] = row')
  lines.push('  }')
  lines.push('  return map')
  lines.push('})()')
  lines.push('')
  lines.push('export const MISSILE_SOUNDS_BY_NAME_113C: Readonly<Record<string, MissileSoundRow113c>> = (() => {')
  lines.push('  const map: Record<string, MissileSoundRow113c> = {}')
  lines.push('  for (const row of MISSILE_SOUNDS_113C) {')
  lines.push('    if (row.missile) {')
  lines.push('      map[row.missile.toLowerCase()] = row')
  lines.push('    }')
  lines.push('  }')
  lines.push('  return map')
  lines.push('})()')
  lines.push('')
  lines.push('export function getMissileSoundEntry113c(missileIdOrName: number | string): MissileSoundRow113c | undefined {')
  lines.push("  if (typeof missileIdOrName === 'number') {")
  lines.push('    if (!Number.isFinite(missileIdOrName) || missileIdOrName < 0) return undefined')
  lines.push('    return MISSILE_SOUND_MAP_113C[Math.trunc(missileIdOrName)]')
  lines.push('  }')
  lines.push("  if (typeof missileIdOrName === 'string') {")
  lines.push('    const key = missileIdOrName.trim().toLowerCase()')
  lines.push('    return MISSILE_SOUNDS_BY_NAME_113C[key]')
  lines.push('  }')
  lines.push('  return undefined')
  lines.push('}')
  lines.push('export const getMissileSounds113c = getMissileSoundEntry113c')
  lines.push('')
  lines.push('export const MONSTER_DEATH_SOUNDS_113C: Readonly<Record<number, number>> = {')
  const sortedHcIdx = Object.keys(monsterDeathSounds)
    .map(Number)
    .sort((a, b) => a - b)
  for (const hcIdx of sortedHcIdx) {
    lines.push(`  ${String(hcIdx)}: ${String(monsterDeathSounds[hcIdx]!)},`)
  }
  lines.push('}')
  lines.push('')
  lines.push('export function getMonsterDeathSound113c(classId: number): number {')
  lines.push('  if (!Number.isFinite(classId) || classId < 0) return 0')
  lines.push('  return MONSTER_DEATH_SOUNDS_113C[Math.trunc(classId)] ?? 0')
  lines.push('}')
  lines.push('')
  lines.push("const CLASS_INDEX_TO_BUCKET_113C: readonly SkillSoundClassCode113c[] = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass']")
  lines.push('')
  lines.push('export function normalizePlayerClassCode113c(raw: unknown): SkillSoundClassCode113c {')
  lines.push("  if (typeof raw === 'number' && Number.isFinite(raw)) {")
  lines.push('    const idx = Math.trunc(raw)')
  lines.push("    return CLASS_INDEX_TO_BUCKET_113C[idx] ?? ''")
  lines.push('  }')
  lines.push("  if (typeof raw === 'string') {")
  lines.push('    const s = raw.trim().toLowerCase()')
  lines.push("    if (s === 'ama' || s === 'amazon' || s === '0') return 'ama'")
  lines.push("    if (s === 'sor' || s === 'sorc' || s === 'sorceress' || s === '1') return 'sor'")
  lines.push("    if (s === 'nec' || s === 'necro' || s === 'necromancer' || s === '2') return 'nec'")
  lines.push("    if (s === 'pal' || s === 'pally' || s === 'paladin' || s === '3') return 'pal'")
  lines.push("    if (s === 'bar' || s === 'barb' || s === 'barbarian' || s === '4') return 'bar'")
  lines.push("    if (s === 'dru' || s === 'druid' || s === '5') return 'dru'")
  lines.push("    if (s === 'ass' || s === 'asn' || s === 'assassin' || s === 'assasin' || s === '6') return 'ass'")
  lines.push('  }')
  lines.push("  return ''")
  lines.push('}')
  lines.push('')
  lines.push('export function getSkillPackIdsForClasses113c(classes: readonly unknown[]): string[] {')
  lines.push('  if (!Array.isArray(classes) || classes.length === 0) return []')
  lines.push('  const buckets = new Set<string>()')
  lines.push('  for (const item of classes) {')
  lines.push("    if (typeof item === 'string' && item.trim().toLowerCase() === 'common') {")
  lines.push("      buckets.add('common')")
  lines.push('      continue')
  lines.push('    }')
  lines.push('    const code = normalizePlayerClassCode113c(item)')
  lines.push('    if (code) buckets.add(code)')
  lines.push('  }')
  lines.push('  if (buckets.size === 0) return []')
  lines.push("  buckets.add('common')")
  lines.push('  const out: string[] = []')
  lines.push('  for (const pack of SFX_PACKS_113C) {')
  lines.push('    const packId = pack.packId')
  lines.push("    if (!packId.startsWith('sfx-skills-')) continue")
  lines.push('    for (const bucket of buckets) {')
  lines.push('      if (packId === `sfx-skills-${bucket}` || packId.startsWith(`sfx-skills-${bucket}-`)) {')
  lines.push('        out.push(packId)')
  lines.push('        break')
  lines.push('      }')
  lines.push('    }')
  lines.push('  }')
  lines.push('  return out')
  lines.push('}')
  lines.push('export const skillPacksForActiveClasses113c = getSkillPackIdsForClasses113c')
  lines.push('')
  lines.push('export interface SkillSoundPlayOptions113c {')
  lines.push('  readonly worldX?: number | undefined')
  lines.push('  readonly worldY?: number | undefined')
  lines.push('  readonly x?: number | undefined')
  lines.push('  readonly y?: number | undefined')
  lines.push('  readonly local?: boolean | undefined')
  lines.push('  readonly delayTicks?: number | undefined')
  lines.push('  readonly listenerX?: number | undefined')
  lines.push('  readonly listenerY?: number | undefined')
  lines.push('  readonly unitId?: number | undefined')
  lines.push('  readonly unit?:')
  lines.push('    | {')
  lines.push("        readonly unitType: 'player' | 'monster' | 'object' | 'missile' | 'item'")
  lines.push('        readonly id: number')
  lines.push('        readonly x?: number | undefined')
  lines.push('        readonly y?: number | undefined')
  lines.push('        readonly isLocalPlayer?: boolean | undefined')
  lines.push('      }')
  lines.push('    | undefined')
  lines.push('}')
  lines.push('')
  lines.push('export interface SkillSoundRuntimeLike113c {')
  lines.push('  playSoundById?(soundId: number, options?: SkillSoundPlayOptions113c): number | null')
  lines.push('  stopSound?(handle: number): void')
  lines.push('  updateSoundPosition?(handle: number, worldX: number, worldY: number, listenerX?: number, listenerY?: number): void')
  lines.push('  getSoundRecords?(): SkillSoundRecordsLike113c')
  lines.push('}')
  lines.push('')
  lines.push('export interface SkillSoundRecordsLike113c {')
  lines.push('  play?(soundId: number, options?: SkillSoundPlayOptions113c): number')
  lines.push('  allocate?(soundId: number, options?: SkillSoundPlayOptions113c): number | null')
  lines.push('  stop(handle: number): void')
  lines.push('  stopImmediate?(handle: number): void')
  lines.push('  stopUnitSound?(')
  lines.push("    unit: { readonly unitType: 'player' | 'monster' | 'object' | 'missile' | 'item'; readonly id: number },")
  lines.push('    soundId: number,')
  lines.push('  ): number')
  lines.push('  setSoundPos?(handle: number, x: number, y: number, z?: number): boolean')
  lines.push('  updatePosition?(handle: number, worldX: number, worldY: number, listenerX?: number, listenerY?: number): void')
  lines.push('}')
  lines.push('')
  lines.push('export interface SkillSoundControllerOptions113c {')
  lines.push('  readonly runtime?: SkillSoundRuntimeLike113c | undefined')
  lines.push('  readonly records?: SkillSoundRecordsLike113c | undefined')
  lines.push('  readonly rng?: unknown')
  lines.push('  readonly playSoundById?: ((soundId: number, options?: SkillSoundPlayOptions113c) => number | null) | undefined')
  lines.push('  readonly stopHandle?: ((handle: number) => void) | undefined')
  lines.push('  readonly updatePosition?: ((handle: number, x: number, y: number) => void) | undefined')
  lines.push('}')
  lines.push('')
  lines.push('interface ActiveMissileEmitterState113c {')
  lines.push('  readonly handle: number')
  lines.push('  readonly missileId: number')
  lines.push('  worldX: number | undefined')
  lines.push('  worldY: number | undefined')
  lines.push('}')
  lines.push('')
  lines.push('function toFiniteNumber(val: unknown): number | undefined {')
  lines.push("  if (typeof val === 'number' && Number.isFinite(val)) return val")
  lines.push('  return undefined')
  lines.push('}')
  lines.push('')
  lines.push('export class SkillSoundController113c {')
  lines.push('  private readonly runtime: SkillSoundRuntimeLike113c | undefined')
  lines.push('  private readonly records: SkillSoundRecordsLike113c | undefined')
  lines.push('  private readonly playSoundFn: ((soundId: number, options?: SkillSoundPlayOptions113c) => number | null) | undefined')
  lines.push('  private readonly stopHandleFn: ((handle: number) => void) | undefined')
  lines.push('  private readonly updatePosFn: ((handle: number, x: number, y: number) => void) | undefined')
  lines.push('  private readonly activeMissiles = new Map<number, ActiveMissileEmitterState113c>()')
  lines.push('  private readonly activeCastSounds = new Map<string, { readonly handle: number; readonly soundId: number; readonly unitId: number }>()')
  lines.push('')
  lines.push('  constructor(arg?: SkillSoundControllerOptions113c | SkillSoundRuntimeLike113c) {')
  lines.push("    if (arg && typeof arg === 'object' && ('runtime' in arg || 'records' in arg || ('playSoundById' in arg && !('getSoundRecords' in arg)))) {")
  lines.push('      const opts = arg as SkillSoundControllerOptions113c')
  lines.push('      this.runtime = opts.runtime')
  lines.push('      this.records = opts.records ?? opts.runtime?.getSoundRecords?.()')
  lines.push('      this.playSoundFn = opts.playSoundById')
  lines.push('      this.stopHandleFn = opts.stopHandle')
  lines.push('      this.updatePosFn = opts.updatePosition')
  lines.push("    } else if (arg && typeof arg === 'object') {")
  lines.push('      const rt = arg as SkillSoundRuntimeLike113c')
  lines.push('      this.runtime = rt')
  lines.push('      this.records = rt.getSoundRecords?.()')
  lines.push('    }')
  lines.push('  }')
  lines.push('')
  lines.push('  private emitSound(soundId: number, opts?: SkillSoundPlayOptions113c): number {')
  lines.push('    if (!Number.isFinite(soundId) || soundId <= 0) return 0')
  lines.push('    const sid = Math.trunc(soundId)')
  lines.push('    const wx = opts?.worldX ?? opts?.x')
  lines.push('    const wy = opts?.worldY ?? opts?.y')
  lines.push('    const normalizedOpts: SkillSoundPlayOptions113c = {')
  lines.push('      ...opts,')
  lines.push('      worldX: wx,')
  lines.push('      worldY: wy,')
  lines.push('      x: wx !== undefined ? Math.round(wx) : undefined,')
  lines.push('      y: wy !== undefined ? Math.round(wy) : undefined,')
  lines.push('    }')
  lines.push('    if (this.records?.play) {')
  lines.push('      return this.records.play(sid, normalizedOpts) || 0')
  lines.push('    }')
  lines.push('    if (this.runtime?.playSoundById) {')
  lines.push('      return this.runtime.playSoundById(sid, normalizedOpts) ?? 0')
  lines.push('    }')
  lines.push('    if (this.playSoundFn) {')
  lines.push('      return this.playSoundFn(sid, normalizedOpts) ?? 0')
  lines.push('    }')
  lines.push('    if (this.records?.allocate) {')
  lines.push('      return this.records.allocate(sid, normalizedOpts) ?? 0')
  lines.push('    }')
  lines.push('    return 0')
  lines.push('  }')
  lines.push('')
  lines.push('  private stopHandleImmediate(handle: number): void {')
  lines.push('    if (!Number.isFinite(handle) || handle <= 0) return')
  lines.push('    const recs = this.records ?? this.runtime?.getSoundRecords?.()')
  lines.push("    if (recs && typeof recs.stopImmediate === 'function') {")
  lines.push('      recs.stopImmediate(handle)')
  lines.push('      return')
  lines.push('    }')
  lines.push('    if (recs) {')
  lines.push('      recs.stop(handle)')
  lines.push('      return')
  lines.push('    }')
  lines.push('    if (this.stopHandleFn) {')
  lines.push('      this.stopHandleFn(handle)')
  lines.push('      return')
  lines.push('    }')
  lines.push('    this.runtime?.stopSound?.(handle)')
  lines.push('  }')
  lines.push('')
  lines.push('  private moveHandle(handle: number, worldX: number, worldY: number, listenerX?: number, listenerY?: number): void {')
  lines.push('    if (!Number.isFinite(handle) || handle <= 0) return')
  lines.push('    const recs = this.records ?? this.runtime?.getSoundRecords?.()')
  lines.push("    if (recs && typeof recs.setSoundPos === 'function') {")
  lines.push('      recs.setSoundPos(handle, Math.round(worldX), Math.round(worldY), 0)')
  lines.push('      return')
  lines.push('    }')
  lines.push("    if (recs && typeof recs.updatePosition === 'function') {")
  lines.push('      recs.updatePosition(handle, worldX, worldY, listenerX, listenerY)')
  lines.push('      return')
  lines.push('    }')
  lines.push('    if (this.runtime?.updateSoundPosition) {')
  lines.push('      this.runtime.updateSoundPosition(handle, worldX, worldY, listenerX, listenerY)')
  lines.push('      return')
  lines.push('    }')
  lines.push('    this.updatePosFn?.(handle, worldX, worldY)')
  lines.push('  }')
  lines.push('')
  lines.push('  onSkillCastStart(ev: unknown): number {')
  lines.push("    if (!ev || typeof ev !== 'object') return 0")
  lines.push('    const rec = ev as Record<string, unknown>')
  lines.push('    const skillId = toFiniteNumber(rec.skillId ?? rec.id)')
  lines.push('    if (skillId === undefined || skillId <= 0 || skillId >= SKILL_SOUNDS_113C.length) {')
  lines.push('      return 0')
  lines.push('    }')
  lines.push('    const row = getSkillSoundEntry113c(skillId)')
  lines.push('    if (!row) return 0')
  lines.push('    const worldX = toFiniteNumber(rec.worldX ?? rec.x)')
  lines.push('    const worldY = toFiniteNumber(rec.worldY ?? rec.y)')
  lines.push('    const listenerX = toFiniteNumber(rec.listenerX)')
  lines.push('    const listenerY = toFiniteNumber(rec.listenerY)')
  lines.push('    const unitId = toFiniteNumber(rec.unitId ?? rec.casterId)')
  lines.push('    const local = typeof rec.local === "boolean" ? rec.local : undefined')
  lines.push('    const delayTicks = row.stsounddelay > 0 ? row.stsounddelay : undefined')
  lines.push('    const resolvedUnit =')
  lines.push("      (rec.unit as SkillSoundPlayOptions113c['unit']) ??")
  lines.push('      (unitId !== undefined')
  lines.push('        ? {')
  lines.push("            unitType: 'player' as const,")
  lines.push('            id: unitId,')
  lines.push('            ...(worldX !== undefined ? { x: Math.round(worldX) } : {}),')
  lines.push('            ...(worldY !== undefined ? { y: Math.round(worldY) } : {}),')
  lines.push('            ...(local !== undefined ? { isLocalPlayer: local } : {}),')
  lines.push('          }')
  lines.push('        : undefined)')
  lines.push('    const playOpts: SkillSoundPlayOptions113c = {')
  lines.push('      worldX,')
  lines.push('      worldY,')
  lines.push('      local,')
  lines.push('      delayTicks,')
  lines.push('      listenerX,')
  lines.push('      listenerY,')
  lines.push('      unitId,')
  lines.push('      ...(resolvedUnit !== undefined ? { unit: resolvedUnit } : {}),')
  lines.push('    }')
  lines.push('    const rawClass = rec.charclass ?? rec.charClass ?? rec.classCode ?? rec.casterClass')
  lines.push('    const normClass = rawClass !== undefined ? normalizePlayerClassCode113c(rawClass) : row.charclass')
  lines.push('    const useClassSound = row.stsoundclass > 0 && (!row.charclass || !normClass || normClass === row.charclass)')
  lines.push('    const soundId = useClassSound ? row.stsoundclass : row.stsound')
  lines.push('    if (soundId <= 0) return 0')
  lines.push('    if (skillId === 151) {')
  lines.push('      this.stopSkillCastSound(unitId ?? 1, 151)')
  lines.push('    }')
  lines.push('    const handle = this.emitSound(soundId, playOpts)')
  lines.push('    if (handle > 0 && skillId === 151) {')
  lines.push('      const effUnitId = unitId ?? 1')
  lines.push('      this.activeCastSounds.set(`${effUnitId}:${skillId}`, {')
  lines.push('        handle,')
  lines.push('        soundId,')
  lines.push('        unitId: effUnitId,')
  lines.push('      })')
  lines.push('    }')
  lines.push('    return handle')
  lines.push('  }')
  lines.push('')
  lines.push('  /**')
  lines.push('   * 1.13c `SKILLS_CltDo45_Whirlwind` (`0x6FB76472` / `0x6FB7655D` -> `0x6FAD25D0(pUnit, 2531)` -> `StopSound` `0x6FB38BF0`):')
  lines.push('   * stops/fades the active tracked cast sound (`barbarian_whirlwind` `2531`, `FadeOut = 6`) for `unitId`')
  lines.push('   * when Whirlwind ends or is recast so multiple Whirlwind casts never stack or linger past cast end.')
  lines.push('   */')
  lines.push('  stopSkillCastSound(unitId = 1, skillId = 151): boolean {')
  lines.push('    const key = `${unitId}:${skillId}`')
  lines.push('    const prev = this.activeCastSounds.get(key)')
  lines.push('    this.activeCastSounds.delete(key)')
  lines.push('    const recs = this.records ?? this.runtime?.getSoundRecords?.()')
  lines.push('    let stopped = false')
  lines.push("    if (recs && typeof recs.stopUnitSound === 'function') {")
  lines.push('      const targetSid = prev?.soundId ?? (skillId === 151 ? 2531 : 0)')
  lines.push("      if (targetSid > 0 && recs.stopUnitSound({ unitType: 'player', id: unitId }, targetSid) > 0) {")
  lines.push('        stopped = true')
  lines.push('      }')
  lines.push('    }')
  lines.push('    if (prev && prev.handle > 0) {')
  lines.push('      if (recs) {')
  lines.push('        recs.stop(prev.handle)')
  lines.push('        stopped = true')
  lines.push('      } else if (this.stopHandleFn) {')
  lines.push('        this.stopHandleFn(prev.handle)')
  lines.push('        stopped = true')
  lines.push('      } else if (this.runtime?.stopSound) {')
  lines.push('        this.runtime.stopSound(prev.handle)')
  lines.push('        stopped = true')
  lines.push('      }')
  lines.push('    }')
  lines.push('    return stopped')
  lines.push('  }')
  lines.push('')
  lines.push('  onSkillCastStop(ev: unknown): boolean {')
  lines.push("    if (typeof ev === 'number') {")
  lines.push('      return this.stopSkillCastSound(ev, 151)')
  lines.push('    }')
  lines.push("    if (!ev || typeof ev !== 'object') return false")
  lines.push('    const rec = ev as Record<string, unknown>')
  lines.push('    const unitObj = rec.unit as { id?: unknown } | undefined')
  lines.push('    const unitId = toFiniteNumber(rec.unitId ?? rec.casterId ?? unitObj?.id) ?? 1')
  lines.push('    const skillId = toFiniteNumber(rec.skillId ?? rec.id) ?? 151')
  lines.push('    return this.stopSkillCastSound(unitId, skillId)')
  lines.push('  }')
  lines.push('')
  lines.push('  playSkillCastStart(ev: unknown): number {')
  lines.push('    return this.onSkillCastStart(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  emitSkillCastStart(ev: unknown): number {')
  lines.push('    return this.onSkillCastStart(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  triggerSkillStart(ev: unknown): number {')
  lines.push('    return this.onSkillCastStart(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  onAnimKeyframe(ev: unknown): number {')
  lines.push("    if (!ev || typeof ev !== 'object') return 0")
  lines.push('    const rec = ev as Record<string, unknown>')
  lines.push('    const skillId = toFiniteNumber(rec.skillId ?? rec.id)')
  lines.push('    if (skillId === undefined || skillId < 0 || skillId >= SKILL_SOUNDS_113C.length) {')
  lines.push('      return 0')
  lines.push('    }')
  lines.push('    const rawFlag = rec.flag ?? rec.eventCode ?? rec.frameEvent ?? rec.event ?? rec.code')
  lines.push('    let flag = 1')
  lines.push('    if (rawFlag !== undefined) {')
  lines.push('      flag = Number(rawFlag)')
  lines.push('      if (!Number.isFinite(flag) || (flag !== 1 && flag !== 2)) {')
  lines.push('        return 0')
  lines.push('      }')
  lines.push('    }')
  lines.push('    const row = getSkillSoundEntry113c(skillId)')
  lines.push('    if (!row) return 0')
  lines.push('    const worldX = toFiniteNumber(rec.worldX ?? rec.x)')
  lines.push('    const worldY = toFiniteNumber(rec.worldY ?? rec.y)')
  lines.push('    const listenerX = toFiniteNumber(rec.listenerX)')
  lines.push('    const listenerY = toFiniteNumber(rec.listenerY)')
  lines.push('    const unitId = toFiniteNumber(rec.unitId ?? rec.casterId)')
  lines.push('    const local = typeof rec.local === "boolean" ? rec.local : undefined')
  lines.push('    const playOpts: SkillSoundPlayOptions113c = {')
  lines.push('      worldX,')
  lines.push('      worldY,')
  lines.push('      local,')
  lines.push('      listenerX,')
  lines.push('      listenerY,')
  lines.push('      unitId,')
  lines.push('    }')
  lines.push('    let handle = 0')
  lines.push('    if (flag === 1) {')
  lines.push('      if (row.dosound > 0) {')
  lines.push('        handle = this.emitSound(row.dosound, playOpts) || handle')
  lines.push('      } else if (row.dosoundA > 0) {')
  lines.push('        handle = this.emitSound(row.dosoundA, playOpts) || handle')
  lines.push('      }')
  lines.push("      if (rec.variant === 'a' && row.dosoundA > 0 && row.dosound > 0) {")
  lines.push('        handle = this.emitSound(row.dosoundA, playOpts) || handle')
  lines.push("      } else if (rec.variant === 'b' && row.dosoundB > 0) {")
  lines.push('        handle = this.emitSound(row.dosoundB, playOpts) || handle')
  lines.push('      }')
  lines.push('    } else if (flag === 2) {')
  lines.push('      if (row.dosound > 0) {')
  lines.push('        handle = this.emitSound(row.dosound, playOpts) || handle')
  lines.push('      }')
  lines.push('      if (row.dosoundA > 0) {')
  lines.push('        handle = this.emitSound(row.dosoundA, playOpts) || handle')
  lines.push('      }')
  lines.push('      if (row.dosoundB > 0) {')
  lines.push('        handle = this.emitSound(row.dosoundB, playOpts) || handle')
  lines.push('      }')
  lines.push('    }')
  lines.push('    const weaponSoundId = toFiniteNumber(rec.weaponSoundId ?? rec.weaponSound)')
  lines.push('    if (')
  lines.push('      (row.weaponsnd > 0 || skillId === 0 || skillId === 2 || skillId === 4 || skillId === 5 || skillId === 6 || skillId === 7 || skillId === 10 || skillId === 11 || skillId === 12 || skillId === 22) &&')
  lines.push('      weaponSoundId !== undefined &&')
  lines.push('      weaponSoundId > 0')
  lines.push('    ) {')
  lines.push('      handle = this.emitSound(weaponSoundId, playOpts) || handle')
  lines.push('    }')
  lines.push('    if (rec.target === true && row.tgtsound > 0) {')
  lines.push('      handle = this.emitSound(row.tgtsound, playOpts) || handle')
  lines.push('    }')
  lines.push('    return handle')
  lines.push('  }')
  lines.push('')
  lines.push('  playSkillAnimKeyframe(ev: unknown): number {')
  lines.push('    return this.onAnimKeyframe(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  onSkillDoSound(ev: unknown): number {')
  lines.push('    return this.onAnimKeyframe(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  triggerSkillDoSound(ev: unknown): number {')
  lines.push('    return this.onAnimKeyframe(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  onMissileSpawn(ev: unknown): number {')
  lines.push("    if (!ev || typeof ev !== 'object') return 0")
  lines.push('    const rec = ev as Record<string, unknown>')
  lines.push('    const rawMissile = rec.missileId ?? rec.typeId ?? rec.classId ?? (rec.entityId === undefined && rec.missileUid === undefined && rec.uid === undefined ? rec.id : undefined)')
  lines.push("    if (rawMissile === undefined || (typeof rawMissile !== 'number' && typeof rawMissile !== 'string')) {")
  lines.push('      return 0')
  lines.push('    }')
  lines.push('    const mRow = getMissileSoundEntry113c(rawMissile)')
  lines.push('    if (!mRow || mRow.travelSound <= 0) return 0')
  lines.push('    const missileUid = toFiniteNumber(rec.entityId ?? rec.missileUid ?? rec.uid ?? rec.id) ?? mRow.id')
  lines.push('    const existing = this.activeMissiles.get(missileUid)')
  lines.push('    if (existing) {')
  lines.push('      this.stopHandleImmediate(existing.handle)')
  lines.push('      this.activeMissiles.delete(missileUid)')
  lines.push('    }')
  lines.push('    const worldX = toFiniteNumber(rec.worldX ?? rec.x)')
  lines.push('    const worldY = toFiniteNumber(rec.worldY ?? rec.y)')
  lines.push('    const listenerX = toFiniteNumber(rec.listenerX)')
  lines.push('    const listenerY = toFiniteNumber(rec.listenerY)')
  lines.push('    const handle = this.emitSound(mRow.travelSound, {')
  lines.push('      worldX,')
  lines.push('      worldY,')
  lines.push('      listenerX,')
  lines.push('      listenerY,')
  lines.push('      unitId: missileUid,')
  lines.push('    })')
  lines.push('    if (handle > 0) {')
  lines.push('      this.activeMissiles.set(missileUid, {')
  lines.push('        handle,')
  lines.push('        missileId: mRow.id,')
  lines.push('        worldX,')
  lines.push('        worldY,')
  lines.push('      })')
  lines.push('    }')
  lines.push('    return handle')
  lines.push('  }')
  lines.push('')
  lines.push('  spawnMissileEmitter(ev: unknown): number {')
  lines.push('    return this.onMissileSpawn(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  startMissileTravelSound(ev: unknown): number {')
  lines.push('    return this.onMissileSpawn(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  onMissileCreate(ev: unknown): number {')
  lines.push('    return this.onMissileSpawn(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  onMissileTick(evOrId: unknown, maybeX?: number, maybeY?: number): boolean {')
  lines.push('    let missileUid: number | undefined')
  lines.push('    let worldX: number | undefined')
  lines.push('    let worldY: number | undefined')
  lines.push('    let listenerX: number | undefined')
  lines.push('    let listenerY: number | undefined')
  lines.push("    if (typeof evOrId === 'number') {")
  lines.push('      missileUid = toFiniteNumber(evOrId)')
  lines.push('      worldX = toFiniteNumber(maybeX)')
  lines.push('      worldY = toFiniteNumber(maybeY)')
  lines.push("    } else if (evOrId && typeof evOrId === 'object') {")
  lines.push('      const rec = evOrId as Record<string, unknown>')
  lines.push('      missileUid = toFiniteNumber(rec.entityId ?? rec.missileUid ?? rec.uid ?? rec.id)')
  lines.push('      worldX = toFiniteNumber(rec.worldX ?? rec.x)')
  lines.push('      worldY = toFiniteNumber(rec.worldY ?? rec.y)')
  lines.push('      listenerX = toFiniteNumber(rec.listenerX)')
  lines.push('      listenerY = toFiniteNumber(rec.listenerY)')
  lines.push('    }')
  lines.push('    if (missileUid === undefined) return false')
  lines.push('    const state = this.activeMissiles.get(missileUid)')
  lines.push('    if (!state) return false')
  lines.push('    if (worldX === undefined || worldY === undefined) return false')
  lines.push('    state.worldX = worldX')
  lines.push('    state.worldY = worldY')
  lines.push('    this.moveHandle(state.handle, worldX, worldY, listenerX, listenerY)')
  lines.push('    return true')
  lines.push('  }')
  lines.push('')
  lines.push('  updateMissilePosition(evOrId: unknown, maybeX?: number, maybeY?: number): boolean {')
  lines.push('    return this.onMissileTick(evOrId, maybeX, maybeY)')
  lines.push('  }')
  lines.push('')
  lines.push('  tickMissileEmitter(evOrId: unknown, maybeX?: number, maybeY?: number): boolean {')
  lines.push('    return this.onMissileTick(evOrId, maybeX, maybeY)')
  lines.push('  }')
  lines.push('')
  lines.push('  onMissileMove(evOrId: unknown, maybeX?: number, maybeY?: number): boolean {')
  lines.push('    return this.onMissileTick(evOrId, maybeX, maybeY)')
  lines.push('  }')
  lines.push('')
  lines.push('  onMissileDestroy(ev: unknown): boolean {')
  lines.push("    const missileUid = typeof ev === 'number' ? toFiniteNumber(ev) : (ev && typeof ev === 'object' ? toFiniteNumber((ev as Record<string, unknown>).entityId ?? (ev as Record<string, unknown>).missileUid ?? (ev as Record<string, unknown>).uid ?? (ev as Record<string, unknown>).id) : undefined)")
  lines.push('    if (missileUid === undefined) return false')
  lines.push('    const state = this.activeMissiles.get(missileUid)')
  lines.push('    this.activeMissiles.delete(missileUid)')
  lines.push('    if (!state) return false')
  lines.push('    this.stopHandleImmediate(state.handle)')
  lines.push('    return true')
  lines.push('  }')
  lines.push('')
  lines.push('  destroyMissileEmitter(ev: unknown): boolean {')
  lines.push('    return this.onMissileDestroy(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  stopMissileTravelSound(ev: unknown): boolean {')
  lines.push('    return this.onMissileDestroy(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  onMissileRemove(ev: unknown): boolean {')
  lines.push('    return this.onMissileDestroy(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  onMissileImpact(ev: unknown): number {')
  lines.push("    if (!ev || typeof ev !== 'object') return 0")
  lines.push('    const rec = ev as Record<string, unknown>')
  lines.push('    const maybeUid = toFiniteNumber(rec.entityId ?? rec.missileUid ?? rec.uid)')
  lines.push('    if (maybeUid !== undefined && this.activeMissiles.has(maybeUid)) {')
  lines.push('      this.onMissileDestroy(maybeUid)')
  lines.push('    }')
  lines.push('    const rawMissile = rec.missileId ?? rec.typeId ?? rec.classId ?? rec.id')
  lines.push("    if (rawMissile === undefined || (typeof rawMissile !== 'number' && typeof rawMissile !== 'string')) {")
  lines.push('      return 0')
  lines.push('    }')
  lines.push('    const mRow = getMissileSoundEntry113c(rawMissile)')
  lines.push('    if (!mRow) return 0')
  lines.push('    const worldX = toFiniteNumber(rec.worldX ?? rec.x)')
  lines.push('    const worldY = toFiniteNumber(rec.worldY ?? rec.y)')
  lines.push('    const listenerX = toFiniteNumber(rec.listenerX)')
  lines.push('    const listenerY = toFiniteNumber(rec.listenerY)')
  lines.push('    const unitId = toFiniteNumber(rec.unitId ?? rec.entityId ?? rec.missileUid ?? rec.uid)')
  lines.push('    const playOpts: SkillSoundPlayOptions113c = {')
  lines.push('      worldX,')
  lines.push('      worldY,')
  lines.push('      listenerX,')
  lines.push('      listenerY,')
  lines.push('      unitId,')
  lines.push('    }')
  lines.push('    let hitHandle = 0')
  lines.push('    let progHandle = 0')
  lines.push('    if (rec.prog === true) {')
  lines.push('      if (mRow.progSound > 0) {')
  lines.push('        progHandle = this.emitSound(mRow.progSound, playOpts)')
  lines.push('      }')
  lines.push('    } else if (rec.prog === false) {')
  lines.push('      if (mRow.hitSound > 0) {')
  lines.push('        hitHandle = this.emitSound(mRow.hitSound, playOpts)')
  lines.push('      }')
  lines.push('    } else {')
  lines.push('      if (mRow.hitSound > 0) {')
  lines.push('        hitHandle = this.emitSound(mRow.hitSound, playOpts)')
  lines.push('      }')
  lines.push('      if (mRow.progSound > 0) {')
  lines.push('        progHandle = this.emitSound(mRow.progSound, playOpts)')
  lines.push('      }')
  lines.push('    }')
  lines.push('    return hitHandle || progHandle')
  lines.push('  }')
  lines.push('')
  lines.push('  playMissileImpact(ev: unknown): number {')
  lines.push('    return this.onMissileImpact(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  emitMissileImpact(ev: unknown): number {')
  lines.push('    return this.onMissileImpact(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  triggerMissileHit(ev: unknown): number {')
  lines.push('    return this.onMissileImpact(ev)')
  lines.push('  }')
  lines.push('')
  lines.push('  stopAll(): void {')
  lines.push('    for (const state of this.activeMissiles.values()) {')
  lines.push('      this.stopHandleImmediate(state.handle)')
  lines.push('    }')
  lines.push('    this.activeMissiles.clear()')
  lines.push('    for (const cs of this.activeCastSounds.values()) {')
  lines.push('      this.stopHandleImmediate(cs.handle)')
  lines.push('    }')
  lines.push('    this.activeCastSounds.clear()')
  lines.push('  }')
  lines.push('')
  lines.push('  reset(): void {')
  lines.push('    this.stopAll()')
  lines.push('  }')
  lines.push('}')
  lines.push('')
  lines.push('export const SkillAudioController113c = SkillSoundController113c')
  lines.push('export function createSkillSoundController113c(opts?: SkillSoundControllerOptions113c | SkillSoundRuntimeLike113c): SkillSoundController113c {')
  lines.push('  return new SkillSoundController113c(opts)')
  lines.push('}')
  lines.push('')

  const src = lines.join('\n')
  if (/from\s+['"]node:|require\(['"]node:/.test(src)) {
    throw new Error('renderSkillSoundsModule113c: purity violation (node:* import)')
  }
  if (new RegExp('\\\\b(?:window|document|AudioContext|HTMLAudioElement|fetch)\\\\b').test(src)) {
    throw new Error('renderSkillSoundsModule113c: purity violation (DOM/WebAudio identifier)')
  }
  if (/\bMath\.random\b|\bDate\.now\b/.test(src)) {
    throw new Error('renderSkillSoundsModule113c: purity violation (non-deterministic call)')
  }
  return src
}

export interface PackSkillSoundsOptions {
  readonly rootDir?: string | undefined
  readonly mpqDir?: string | undefined
  readonly publicDir?: string | undefined
  readonly outDir?: string | undefined
  readonly writeFiles?: boolean | undefined
  readonly concurrency?: number | undefined
  readonly forceTranscode?: boolean | undefined
}

export interface PackSkillSoundsResult {
  readonly packs: readonly SfxPackMeta113c[]
  readonly entries: readonly IndexedSfxRow113c[]
  readonly binaries: Readonly<Record<string, Uint8Array>>
  readonly indexModuleSource: string
  readonly skillSoundsModuleSource: string
}

function tryLoadReusableSkillOpusMap(
  repoRoot: string,
): ReadonlyMap<number, { chunk: Uint8Array; sampleRate: number; frames: number; channels: 1 | 2 }> {
  const out = new Map<
    number,
    { chunk: Uint8Array; sampleRate: number; frames: number; channels: 1 | 2 }
  >()
  try {
    const existing = readExistingSfxPackIndex113c(repoRoot)
    const publicDir = join(repoRoot, 'public')
    const binByPackId = new Map<string, Uint8Array>()
    for (const meta of existing.packs) {
      if (!meta.packId.startsWith('sfx-skills-')) continue
      const rel = meta.url.replace(/^\/+/, '')
      const binPath = join(publicDir, rel)
      if (!existsSync(binPath)) continue
      const bytes = new Uint8Array(readFileSync(binPath))
      if (bytes.byteLength !== meta.bytes) continue
      const sha = createHash('sha256').update(bytes).digest('hex')
      if (sha !== meta.sha256) continue
      binByPackId.set(meta.packId, bytes)
    }
    for (const entry of existing.entries) {
      if (!entry.packId.startsWith('sfx-skills-')) continue
      const bin = binByPackId.get(entry.packId)
      if (!bin) continue
      if (
        entry.byteOffset < 12 ||
        entry.byteLength <= 0 ||
        entry.byteOffset + entry.byteLength > bin.byteLength
      ) {
        continue
      }
      const chunk = bin.slice(entry.byteOffset, entry.byteOffset + entry.byteLength)
      out.set(entry.soundId, {
        chunk,
        sampleRate: entry.sampleRate,
        frames: entry.frames,
        channels: entry.channels,
      })
    }
  } catch {
    // Ignore cache read failures and transcode fresh via ffmpeg.
  }
  return out
}

export async function packSkillSounds(
  options?: PackSkillSoundsOptions,
): Promise<PackSkillSoundsResult> {
  const repoRoot = resolve(process.cwd())
  const rootDir = resolve(options?.rootDir ?? repoRoot)
  const mpqDir = resolve(options?.mpqDir ?? resolveDefaultMpqDir(repoRoot))
  const publicDir = resolve(
    options?.publicDir ?? (options?.outDir ? resolve(options.outDir) : join(rootDir, 'public')),
  )
  const writeFiles = options?.writeFiles ?? true
  const concurrency = Math.max(1, options?.concurrency ?? 16)
  const forceTranscode = options?.forceTranscode ?? false

  const archives = mountAudioArchives(mpqDir)
  const { skillRows, missileRows, monsterDeathSounds, referencedSoundIds } =
    await extractSkillAndMissileSoundTables113c(archives)

  const existingIndexRoot = existsSync(join(rootDir, SFX_PACK_INDEX_TS_FILE)) ? rootDir : repoRoot
  const existing = readExistingSfxPackIndex113c(existingIndexRoot)
  const nonSkillIndexedIds = new Set<number>()
  for (const entry of existing.entries) {
    if (!entry.packId.startsWith('sfx-skills-')) {
      nonSkillIndexedIds.add(entry.soundId)
    }
  }

  const rowsByBucket = new Map<SkillBucket113c, SoundsRow113c[]>()
  for (const b of SKILL_BUCKETS) {
    rowsByBucket.set(b, [])
  }

  const assignedSkillIds = new Set<number>()
  let strictSkillRowCount = 0
  for (const row of SOUNDS_113C) {
    if (row.id <= 0 || row.stream) continue
    const bucket = classifySkillRowBucket113c(row)
    if (bucket === null) continue
    rowsByBucket.get(bucket)!.push(row)
    assignedSkillIds.add(row.id)
    strictSkillRowCount += 1
  }
  if (strictSkillRowCount !== 303) {
    throw new Error(
      `packSkillSounds: expected 303 skill\\* Stream=0 rows in Sounds.txt, got ${String(strictSkillRowCount)}`,
    )
  }

  // Append any Stream=0 sound IDs (and groupSize members) referenced by Skills.txt or Missiles.txt
  // that are not already in skill\* or in non-skill packs (sfx-core, sfx-combat, sfx-monsters, sfx-ambient-act*).
  const sortedRefIds = [...referencedSoundIds].sort((a, b) => a - b)
  for (const soundId of sortedRefIds) {
    if (assignedSkillIds.has(soundId) || nonSkillIndexedIds.has(soundId)) continue
    const row = SOUNDS_113C[soundId]
    if (!row || row.id <= 0 || row.stream) continue
    const norm = normalizeSoundFileName113c(row.fileName)
    if (norm === '' || norm === 'none.wav') continue
    rowsByBucket.get('common')!.push(row)
    assignedSkillIds.add(row.id)
  }

  for (const rows of rowsByBucket.values()) {
    rows.sort((a, b) => a.id - b.id)
  }

  interface UniqueWavJob {
    readonly normFile: string
    readonly firstSoundId: number
    readonly mpqPath: string
    readonly wavBytes: Uint8Array
    readonly wavInfo: WavPcm16
    readonly bitrate: number
  }

  const uniqueJobs = new Map<string, UniqueWavJob>()
  for (const bucket of SKILL_BUCKETS) {
    for (const row of rowsByBucket.get(bucket)!) {
      const normFile = normalizeSoundFileName113c(row.fileName)
      if (uniqueJobs.has(normFile)) continue
      const mpqPath = buildSoundMpqPath113c(row.id)
      if (!mpqPath) {
        throw new Error(
          `packSkillSounds: row ${String(row.id)} (${row.fileName}) returned null MPQ path`,
        )
      }
      const wavBytes = await archives.readBytes(mpqPath)
      const wavInfo = parseWavPcm16(wavBytes, `${mpqPath} (row ${String(row.id)})`)
      const bitrate = wavInfo.channels === 2 ? SFX_STEREO_BITRATE_113C : SFX_MONO_BITRATE_113C
      uniqueJobs.set(normFile, {
        normFile,
        firstSoundId: row.id,
        mpqPath,
        wavBytes,
        wavInfo,
        bitrate,
      })
    }
  }

  const reusableBySoundId = forceTranscode ? new Map() : tryLoadReusableSkillOpusMap(repoRoot)
  const jobList = [...uniqueJobs.values()]
  const encodedByNormFile = new Map<string, Uint8Array>()
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, jobList.length) }, async () => {
    while (cursor < jobList.length) {
      const idx = cursor
      cursor += 1
      const job = jobList[idx]!
      const cached = reusableBySoundId.get(job.firstSoundId)
      let opusBytes: Uint8Array | undefined
      if (
        cached &&
        cached.sampleRate === job.wavInfo.sampleRate &&
        cached.frames === job.wavInfo.frames &&
        cached.channels === job.wavInfo.channels
      ) {
        try {
          const facts = inspectOggOpusChunk113c(
            cached.chunk,
            `${job.mpqPath} (row ${String(job.firstSoundId)})`,
          )
          const wavSec = job.wavInfo.frames / job.wavInfo.sampleRate
          const decodedSec = (facts.finalGranule - facts.preSkip) / 48_000
          const bpsWav = (facts.audioPacketBytes * 8) / wavSec
          const bpsDecoded = decodedSec > 0 ? (facts.audioPacketBytes * 8) / decodedSec : 0
          if (bpsWav >= job.bitrate && bpsDecoded >= job.bitrate) {
            opusBytes = cached.chunk
          }
        } catch {
          opusBytes = undefined
        }
      }
      if (!opusBytes) {
        const candidateBitrates = [
          job.bitrate,
          job.bitrate + 8_000,
          job.bitrate + 16_000,
          job.bitrate + 32_000,
        ]
        let lastBps = 0
        for (const targetBps of candidateBitrates) {
          const rawOpusBytes = await transcodeWavToOpusOggAsync(job.wavBytes, targetBps)
          const patched = patchOpusHeadInputSampleRate(rawOpusBytes, job.wavInfo.sampleRate)
          const facts = inspectOggOpusChunk113c(
            patched,
            `${job.mpqPath} (row ${String(job.firstSoundId)})`,
          )
          const wavSec = job.wavInfo.frames / job.wavInfo.sampleRate
          const decodedSec = (facts.finalGranule - facts.preSkip) / 48_000
          const bpsWav = (facts.audioPacketBytes * 8) / wavSec
          const bpsDecoded = decodedSec > 0 ? (facts.audioPacketBytes * 8) / decodedSec : 0
          lastBps = Math.min(bpsWav, bpsDecoded)
          if (bpsWav >= job.bitrate && bpsDecoded >= job.bitrate) {
            opusBytes = patched
            break
          }
        }
        if (!opusBytes) {
          throw new Error(
            `packSkillSounds: bitrate floor violation on ${job.mpqPath} (row ${String(job.firstSoundId)}): ${lastBps.toFixed(1)} bps < ${String(job.bitrate)} bps`,
          )
        }
      }
      encodedByNormFile.set(job.normFile, opusBytes)
    }
  })
  await Promise.all(workers)

  const packs: SfxPackMeta113c[] = []
  const entries: IndexedSfxRow113c[] = []
  const binaries: Record<string, Uint8Array> = {}

  interface FileGroup {
    readonly normFile: string
    readonly rows: SoundsRow113c[]
    readonly chunkBytes: Uint8Array
    readonly wavInfo: WavPcm16
  }

  for (const bucket of SKILL_BUCKETS) {
    const bucketRows = rowsByBucket.get(bucket)!
    if (bucketRows.length === 0) {
      throw new Error(`packSkillSounds: bucket "${bucket}" has 0 assigned rows`)
    }

    const groups: FileGroup[] = []
    const groupByFile = new Map<string, FileGroup>()
    for (const row of bucketRows) {
      const normFile = normalizeSoundFileName113c(row.fileName)
      let g = groupByFile.get(normFile)
      if (!g) {
        const chunkBytes = encodedByNormFile.get(normFile)!
        const job = uniqueJobs.get(normFile)!
        if (12 + chunkBytes.byteLength > D3_SKILL_PART_MAX_BYTES) {
          throw new Error(
            `packSkillSounds: single chunk ${normFile} (${String(chunkBytes.byteLength)} B) exceeds D3 cap ${String(D3_SKILL_PART_MAX_BYTES)} B`,
          )
        }
        g = {
          normFile,
          rows: [],
          chunkBytes,
          wavInfo: job.wavInfo,
        }
        groupByFile.set(normFile, g)
        groups.push(g)
      }
      g.rows.push(row)
    }

    const parts: FileGroup[][] = []
    let currentPart: FileGroup[] = []
    let currentBytes = 12
    for (const g of groups) {
      if (
        currentPart.length > 0 &&
        currentBytes + g.chunkBytes.byteLength > D3_SKILL_PART_MAX_BYTES
      ) {
        parts.push(currentPart)
        currentPart = [g]
        currentBytes = 12 + g.chunkBytes.byteLength
      } else {
        currentPart.push(g)
        currentBytes += g.chunkBytes.byteLength
      }
    }
    if (currentPart.length > 0) {
      parts.push(currentPart)
    }

    for (let pIdx = 0; pIdx < parts.length; pIdx += 1) {
      const partNumber = pIdx + 1
      const partGroups = parts[pIdx]!
      const packId =
        partNumber === 1
          ? `sfx-skills-${bucket}`
          : `sfx-skills-${bucket}-${String(partNumber)}`
      const relPath = `sound/packs/${packId}.bin`
      const url = `/sound/packs/${packId}.bin`

      const chunks = partGroups.map((g) => g.chunkBytes)
      const { bytes, offsets } = encodeSfxPackBinary113c(chunks)
      if (bytes.byteLength > D3_SKILL_PART_MAX_BYTES) {
        throw new Error(
          `packSkillSounds: ${packId} (${relPath}) size ${String(bytes.byteLength)} B exceeds D3 cap ${String(D3_SKILL_PART_MAX_BYTES)} B`,
        )
      }

      let partRowCount = 0
      const partEntries: IndexedSfxRow113c[] = []
      for (let uIdx = 0; uIdx < partGroups.length; uIdx += 1) {
        const g = partGroups[uIdx]!
        const byteOffset = offsets[uIdx]!
        const byteLength = g.chunkBytes.byteLength
        for (const row of g.rows) {
          partRowCount += 1
          partEntries.push({
            soundId: row.id,
            packId,
            byteOffset,
            byteLength,
            sampleRate: g.wavInfo.sampleRate,
            frames: g.wavInfo.frames,
            channels: g.wavInfo.channels,
          })
        }
      }
      partEntries.sort((a, b) => a.soundId - b.soundId)
      entries.push(...partEntries)

      const sha256 = createHash('sha256').update(bytes).digest('hex')
      const meta: SfxPackMeta113c = {
        packId,
        url,
        bytes: bytes.byteLength,
        sha256,
        chunkCount: chunks.length,
        rowCount: partRowCount,
        tier: 'skill',
        prefixes: SKILL_BUCKET_PREFIXES_113C[bucket],
        targetBitrateMono: SFX_MONO_BITRATE_113C,
        targetBitrateStereo: SFX_STEREO_BITRATE_113C,
      }
      packs.push(meta)
      binaries[packId] = bytes

      if (writeFiles) {
        const outBinPath = join(publicDir, relPath)
        mkdirSync(dirname(outBinPath), { recursive: true })
        writeFileSync(outBinPath, bytes)
      }
    }
  }

  // Filter out any old sfx-skills-* packs/entries before merging our freshly baked skill packs
  const filteredExisting = {
    packs: existing.packs.filter((p) => !p.packId.startsWith('sfx-skills-')),
    entries: existing.entries.filter((e) => !e.packId.startsWith('sfx-skills-')),
  }
  const merged = mergeSfxPackIndex113c(filteredExisting, packs, entries)
  const indexModuleSource = renderSfxPackIndexModule113c(merged.packs, merged.entries)
  const skillSoundsModuleSource = renderSkillSoundsModule113c(
    skillRows,
    missileRows,
    monsterDeathSounds,
  )

  if (writeFiles) {
    const tsRootDir = options?.rootDir ?? (options?.outDir ? resolve(options.outDir) : rootDir)
    const outIndexTsPath = join(tsRootDir, SFX_PACK_INDEX_TS_FILE)
    mkdirSync(dirname(outIndexTsPath), { recursive: true })
    writeFileSync(outIndexTsPath, indexModuleSource, 'utf8')

    const outSkillTsPath = join(tsRootDir, SKILL_SOUND_TS_FILE)
    mkdirSync(dirname(outSkillTsPath), { recursive: true })
    writeFileSync(outSkillTsPath, skillSoundsModuleSource, 'utf8')

    if (existsSync(join(publicDir, 'asset-manifest.json'))) {
      generateAssetManifest({ publicDir })
    }
  }

  return {
    packs,
    entries,
    binaries,
    indexModuleSource,
    skillSoundsModuleSource,
  }
}

export const packSkillSounds113c = packSkillSounds
export const bakeSkillSounds = packSkillSounds
export const runPackSkillSounds = packSkillSounds
export default packSkillSounds

function ensureAssetManifestHasSkillPacks(): void {
  try {
    const publicDir = resolve(process.cwd(), 'public')
    const manifestPath = join(publicDir, 'asset-manifest.json')
    if (!existsSync(manifestPath)) return
    const raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      assets?: Record<string, { bytes?: number; sha256?: string } | string>
    }
    const amaEntry = raw.assets?.['sound/packs/sfx-skills-ama.bin']
    if (
      !amaEntry ||
      typeof amaEntry !== 'object' ||
      typeof amaEntry.sha256 !== 'string' ||
      amaEntry.sha256.length !== 64
    ) {
      generateAssetManifest({ publicDir })
    }
  } catch {
    // Ignore read/write race in readonly environments.
  }
}

ensureAssetManifestHasSkillPacks()

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMain) {
  packSkillSounds()
    .then((res) => {
      const summary = res.packs
        .map(
          (p) =>
            `${p.packId}: ${String(p.rowCount)} rows (${String(p.chunkCount)} unique WAVs), ${String(p.bytes)} B`,
        )
        .join('; ')
      console.log(`[pack-skill-sounds] Baked ${String(res.packs.length)} skill packs (${summary})`)
    })
    .catch((err: unknown) => {
      console.error(err)
      process.exit(1)
    })
}
