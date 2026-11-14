/**
 * Diablo II v1.13c Per-Act Ambient & Weather Opus Pack Baker (`src/baker/packers/pack-ambient-sounds.ts`, #946 F15).
 *
 * Extracts all 151 `Stream = 0` `ambient\scene\*` (20 rows) and `ambient\event\*` (131 rows)
 * `Sounds.txt` entries (122 unique WAVs, including `id 64` `ambient_scene_rain` and `id 202..204`
 * `ambient_event_thunder1..3`) from the 1.13c MPQ archive chain, transcodes each unique WAV to
 * hard-CBR Ogg Opus (`-vbr off -frame_duration 20 -bitexact`, 24 kbps mono / 40 kbps stereo),
 * partitions them into 5 disjoint per-Act `D2SP` v2 binary containers
 * `public/sound/packs/sfx-ambient-act{1..5}.bin` (`<= 890,000 B` each), verifies 100% D10
 * coverage across all 343 `ambient\*` rows (`192` core + `151` scene/event = `343`, 0 overlap),
 * and non-destructively merges them into `src/common/audio/sfx-pack-index-113c.ts`.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  SOUNDS_113C,
  buildSoundMpqPath113c,
  type SoundsRow113c,
} from '../../common/audio/sounds-113c.ts'
import {
  LEVEL_SOUND_ENV_113C,
  SOUND_ENVIRON_113C,
} from '../../common/audio/sound-environ-113c.ts'
import type { SfxPackMeta113c, SfxPackTier113c } from '../../common/audio/sfx-pack-index-113c.ts'
import { parseWavPcm16, type WavPcm16 } from '../../common/formats/wav.ts'
import { resolveAudioAuditMpqDir } from '../audit/verify-audio-113c.ts'
import { generateAssetManifest } from '../io/asset-manifest.ts'
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

export const AMBIENT_PACK_MAX_BYTES_113C = 890_000

export const AMBIENT_SCENE_EVENT_PREFIXES_113C = [
  'ambient\\scene\\',
  'ambient\\event\\',
] as const

export const CORE_AMBIENT_PREFIXES_113C = [
  'ambient\\footstep\\',
  'ambient\\creature\\',
] as const

export interface AmbientSfxPackSpec113c {
  readonly act: 1 | 2 | 3 | 4 | 5
  readonly packId:
    | 'sfx-ambient-act1'
    | 'sfx-ambient-act2'
    | 'sfx-ambient-act3'
    | 'sfx-ambient-act4'
    | 'sfx-ambient-act5'
  readonly tier: SfxPackTier113c
  readonly relPath: string
  readonly url: string
  readonly maxBytes: number
  readonly prefixes: readonly string[]
}

export const AMBIENT_SFX_PACK_SPECS_113C: readonly AmbientSfxPackSpec113c[] = [
  {
    act: 1,
    packId: 'sfx-ambient-act1',
    tier: 'ambient',
    relPath: 'sound/packs/sfx-ambient-act1.bin',
    url: '/sound/packs/sfx-ambient-act1.bin',
    maxBytes: AMBIENT_PACK_MAX_BYTES_113C,
    prefixes: AMBIENT_SCENE_EVENT_PREFIXES_113C,
  },
  {
    act: 2,
    packId: 'sfx-ambient-act2',
    tier: 'ambient',
    relPath: 'sound/packs/sfx-ambient-act2.bin',
    url: '/sound/packs/sfx-ambient-act2.bin',
    maxBytes: AMBIENT_PACK_MAX_BYTES_113C,
    prefixes: AMBIENT_SCENE_EVENT_PREFIXES_113C,
  },
  {
    act: 3,
    packId: 'sfx-ambient-act3',
    tier: 'ambient',
    relPath: 'sound/packs/sfx-ambient-act3.bin',
    url: '/sound/packs/sfx-ambient-act3.bin',
    maxBytes: AMBIENT_PACK_MAX_BYTES_113C,
    prefixes: AMBIENT_SCENE_EVENT_PREFIXES_113C,
  },
  {
    act: 4,
    packId: 'sfx-ambient-act4',
    tier: 'ambient',
    relPath: 'sound/packs/sfx-ambient-act4.bin',
    url: '/sound/packs/sfx-ambient-act4.bin',
    maxBytes: AMBIENT_PACK_MAX_BYTES_113C,
    prefixes: AMBIENT_SCENE_EVENT_PREFIXES_113C,
  },
  {
    act: 5,
    packId: 'sfx-ambient-act5',
    tier: 'ambient',
    relPath: 'sound/packs/sfx-ambient-act5.bin',
    url: '/sound/packs/sfx-ambient-act5.bin',
    maxBytes: AMBIENT_PACK_MAX_BYTES_113C,
    prefixes: AMBIENT_SCENE_EVENT_PREFIXES_113C,
  },
] as const

export function isAmbientSceneOrEventRow113c(row: SoundsRow113c): boolean {
  if (row.id <= 0 || row.stream) return false
  const norm = normalizeSoundFileName113c(row.fileName)
  if (norm === '' || norm === 'none.wav') return false
  return AMBIENT_SCENE_EVENT_PREFIXES_113C.some((prefix) => norm.startsWith(prefix))
}

export function isCoreAmbientRow113c(row: SoundsRow113c): boolean {
  if (row.id <= 0 || row.stream) return false
  const norm = normalizeSoundFileName113c(row.fileName)
  if (norm === '' || norm === 'none.wav') return false
  return CORE_AMBIENT_PREFIXES_113C.some((prefix) => norm.startsWith(prefix))
}

function getSoundGroupMemberIds113c(rootId: number): number[] {
  const root = SOUNDS_113C[rootId]
  if (!root || root.id <= 0) return []
  const count = Math.max(1, root.groupSize)
  const out: number[] = []
  for (let i = 0; i < count; i += 1) {
    const id = rootId + i
    if (id < SOUNDS_113C.length) out.push(id)
  }
  return out
}

export function levelIdToAct113c(levelId: number): 1 | 2 | 3 | 4 | 5 {
  if (levelId >= 109) return 5
  if (levelId >= 103) return 4
  if (levelId >= 75) return 3
  if (levelId >= 40) return 2
  return 1
}

function buildSoundIdToActs1To3Map(): ReadonlyMap<number, ReadonlySet<1 | 2 | 3>> {
  const map = new Map<number, Set<1 | 2 | 3>>()
  for (let levelId = 1; levelId <= 136; levelId += 1) {
    const soundEnv = LEVEL_SOUND_ENV_113C[levelId]
    if (soundEnv === undefined) continue
    const actNum = levelIdToAct113c(levelId)
    if (actNum !== 1 && actNum !== 2 && actNum !== 3) continue
    const env = SOUND_ENVIRON_113C[soundEnv]
    if (!env) continue
    const rootIds = [env.dayAmbience, env.nightAmbience, env.dayEvent, env.nightEvent]
    for (const rootId of rootIds) {
      if (rootId <= 0) continue
      for (const memberId of getSoundGroupMemberIds113c(rootId)) {
        let set = map.get(memberId)
        if (!set) {
          set = new Set<1 | 2 | 3>()
          map.set(memberId, set)
        }
        set.add(actNum)
      }
    }
  }
  return map
}

const SOUND_ID_TO_ACTS_1_TO_3 = buildSoundIdToActs1To3Map()

/**
 * Deterministic 5-Act assignment for a group of `SCENE_AND_EVENT_ROWS` sharing a normalized `fileName`.
 * Keeps all rows sharing a WAV file inside a single `sfx-ambient-act{1..5}` pack (`byFile.size === 122`).
 */
export function assignAmbientWavAct113c(
  groupRows: readonly SoundsRow113c[],
  normFile: string,
): 1 | 2 | 3 | 4 | 5 {
  // 1. Act 4 Hell & Pandemonium ambience/events
  if (
    normFile.includes('event_hell_') ||
    normFile.includes('event_lava_') ||
    groupRows.some(
      (r) =>
        r.sound.startsWith('event_hell_') ||
        r.sound.startsWith('event_lava_') ||
        r.id === 61 ||
        r.id === 62,
    )
  ) {
    return 4
  }

  // 2. Act 5 Expansion scenes (`id >= 68` in `ambient\scene\*`), night town events, and thunder (`202..204`)
  if (
    normFile.includes('event_town_night_') ||
    normFile.includes('event_thunder_') ||
    groupRows.some(
      (r) =>
        (r.id >= 68 && normFile.startsWith('ambient\\scene\\')) ||
        r.sound.startsWith('event_town_night_') ||
        r.sound.startsWith('event_thunder_'),
    )
  ) {
    return 5
  }

  // 3. Minimum Act in {1, 2, 3} referencing any row in `groupRows` via `LEVEL_SOUND_ENV_113C -> SOUND_ENVIRON_113C`
  let minAct: 1 | 2 | 3 | undefined
  for (const r of groupRows) {
    const acts = SOUND_ID_TO_ACTS_1_TO_3.get(r.id)
    if (!acts) continue
    for (const a of acts) {
      if (minAct === undefined || a < minAct) {
        minAct = a
      }
    }
  }
  if (minAct !== undefined) {
    return minAct
  }

  // 4. Deterministic fallback for unreferenced / weather rows (`id 64` rain -> Act 1, arcane/sewer -> Act 2, river -> Act 3)
  if (
    normFile.includes('event_arcane_') ||
    normFile.includes('scene_sewer') ||
    groupRows.some(
      (r) => r.sound.startsWith('event_arcane_') || r.sound === 'scene_sewer',
    )
  ) {
    return 2
  }
  if (
    normFile.includes('event_river_') ||
    groupRows.some((r) => r.sound.startsWith('event_river_'))
  ) {
    return 3
  }
  return 1
}

export interface PackAmbientSoundsOptions {
  readonly rootDir?: string | undefined
  readonly mpqDir?: string | undefined
  readonly publicDir?: string | undefined
  readonly writeFiles?: boolean | undefined
  readonly concurrency?: number | undefined
}

export interface PackAmbientSoundsResult {
  readonly packs: readonly SfxPackMeta113c[]
  readonly entries: readonly IndexedSfxRow113c[]
  readonly binaries: Readonly<Record<string, Uint8Array>>
  readonly indexModuleSource: string
}

export async function packAmbientSounds(
  options?: PackAmbientSoundsOptions,
): Promise<PackAmbientSoundsResult> {
  const rootDir = resolve(options?.rootDir ?? process.cwd())
  const mpqDir = resolve(options?.mpqDir ?? resolveAudioAuditMpqDir(rootDir))
  const publicDir = resolve(options?.publicDir ?? join(rootDir, 'public'))
  const writeFiles = options?.writeFiles ?? true
  const concurrency = Math.max(1, options?.concurrency ?? 16)

  // Verify D10 343-row partition invariant before transcoding
  const sceneEventRows: SoundsRow113c[] = []
  const coreAmbientRows: SoundsRow113c[] = []
  for (const row of SOUNDS_113C) {
    if (row.id <= 0 || row.stream) continue
    const norm = normalizeSoundFileName113c(row.fileName)
    if (!norm.startsWith('ambient\\') || norm === 'none.wav') continue
    if (isAmbientSceneOrEventRow113c(row)) {
      sceneEventRows.push(row)
    } else if (isCoreAmbientRow113c(row)) {
      coreAmbientRows.push(row)
    } else {
      throw new Error(
        `packAmbientSounds: unclassified ambient row ${String(row.id)} (${row.sound}, ${row.fileName})`,
      )
    }
  }
  if (sceneEventRows.length !== 151 || coreAmbientRows.length !== 192) {
    throw new Error(
      `packAmbientSounds: D10 partition mismatch: sceneEvent=${String(sceneEventRows.length)} (want 151), coreAmbient=${String(coreAmbientRows.length)} (want 192)`,
    )
  }

  // Group scene/event rows by normalized fileName so shared WAVs stay in a single Act pack
  const rowsByNormFile = new Map<string, SoundsRow113c[]>()
  for (const row of sceneEventRows) {
    const norm = normalizeSoundFileName113c(row.fileName)
    let list = rowsByNormFile.get(norm)
    if (!list) {
      list = []
      rowsByNormFile.set(norm, list)
    }
    list.push(row)
  }

  const rowsByAct = new Map<1 | 2 | 3 | 4 | 5, SoundsRow113c[]>([
    [1, []],
    [2, []],
    [3, []],
    [4, []],
    [5, []],
  ])
  for (const [normFile, groupRows] of rowsByNormFile.entries()) {
    const act = assignAmbientWavAct113c(groupRows, normFile)
    rowsByAct.get(act)!.push(...groupRows)
  }
  for (const rows of rowsByAct.values()) {
    rows.sort((a, b) => a.id - b.id)
  }

  const archives = mountAudioArchives(mpqDir)

  interface UniqueWavJob {
    readonly normFile: string
    readonly firstSoundId: number
    readonly mpqPath: string
    readonly wavBytes: Uint8Array
    readonly wavInfo: WavPcm16
    readonly bitrate: number
  }
  const uniqueJobs = new Map<string, UniqueWavJob>()
  for (const spec of AMBIENT_SFX_PACK_SPECS_113C) {
    for (const row of rowsByAct.get(spec.act)!) {
      const normFile = normalizeSoundFileName113c(row.fileName)
      if (uniqueJobs.has(normFile)) continue
      const mpqPath = buildSoundMpqPath113c(row.id)
      if (!mpqPath) {
        throw new Error(
          `packAmbientSounds: row ${String(row.id)} (${row.fileName}) returned null MPQ path`,
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

  const jobList = [...uniqueJobs.values()]
  const encodedByNormFile = new Map<string, Uint8Array>()
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, jobList.length) }, async () => {
    while (cursor < jobList.length) {
      const idx = cursor
      cursor += 1
      const job = jobList[idx]!
      const rawOpusBytes = await transcodeWavToOpusOggAsync(job.wavBytes, job.bitrate)
      const opusBytes = patchOpusHeadInputSampleRate(rawOpusBytes, job.wavInfo.sampleRate)
      const facts = inspectOggOpusChunk113c(
        opusBytes,
        `${job.mpqPath} (row ${String(job.firstSoundId)})`,
      )
      const wavSec = job.wavInfo.frames / job.wavInfo.sampleRate
      const bps = (facts.audioPacketBytes * 8) / wavSec
      if (bps < job.bitrate) {
        throw new Error(
          `packAmbientSounds: bitrate floor violation on ${job.mpqPath} (row ${String(job.firstSoundId)}): ${bps.toFixed(1)} bps < ${String(job.bitrate)} bps`,
        )
      }
      encodedByNormFile.set(job.normFile, opusBytes)
    }
  })
  await Promise.all(workers)

  const packs: SfxPackMeta113c[] = []
  const entries: IndexedSfxRow113c[] = []
  const binaries: Record<string, Uint8Array> = {}

  for (const spec of AMBIENT_SFX_PACK_SPECS_113C) {
    const packRows = rowsByAct.get(spec.act)!
    if (packRows.length === 0) {
      throw new Error(`packAmbientSounds: ${spec.packId} has 0 assigned rows`)
    }
    const uniqueOrder: string[] = []
    const uniqueIndexByFile = new Map<string, number>()
    for (const row of packRows) {
      const normFile = normalizeSoundFileName113c(row.fileName)
      if (!uniqueIndexByFile.has(normFile)) {
        uniqueIndexByFile.set(normFile, uniqueOrder.length)
        uniqueOrder.push(normFile)
      }
    }

    const chunks = uniqueOrder.map((normFile) => encodedByNormFile.get(normFile)!)
    const { bytes, offsets } = encodeSfxPackBinary113c(chunks)
    if (bytes.byteLength > spec.maxBytes) {
      throw new Error(
        `packAmbientSounds: ${spec.packId} (${spec.relPath}) size ${String(bytes.byteLength)} B exceeds cap ${String(spec.maxBytes)} B`,
      )
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const meta: SfxPackMeta113c = {
      packId: spec.packId,
      url: spec.url,
      bytes: bytes.byteLength,
      sha256,
      chunkCount: chunks.length,
      rowCount: packRows.length,
      tier: spec.tier,
      prefixes: spec.prefixes,
      targetBitrateMono: SFX_MONO_BITRATE_113C,
      targetBitrateStereo: SFX_STEREO_BITRATE_113C,
    }
    packs.push(meta)
    binaries[spec.packId] = bytes

    for (const row of packRows) {
      const normFile = normalizeSoundFileName113c(row.fileName)
      const uIdx = uniqueIndexByFile.get(normFile)!
      const chunk = chunks[uIdx]!
      const job = uniqueJobs.get(normFile)!
      entries.push({
        soundId: row.id,
        packId: spec.packId,
        byteOffset: offsets[uIdx]!,
        byteLength: chunk.byteLength,
        sampleRate: job.wavInfo.sampleRate,
        frames: job.wavInfo.frames,
        channels: job.wavInfo.channels,
      })
    }

    if (writeFiles) {
      const outBinPath = join(publicDir, spec.relPath)
      mkdirSync(dirname(outBinPath), { recursive: true })
      writeFileSync(outBinPath, bytes)
    }
  }

  const existing = readExistingSfxPackIndex113c(rootDir)
  const merged = mergeSfxPackIndex113c(existing, packs, entries)
  const indexModuleSource = renderSfxPackIndexModule113c(merged.packs, merged.entries)
  if (writeFiles) {
    const outTsPath = join(rootDir, SFX_PACK_INDEX_TS_FILE)
    mkdirSync(dirname(outTsPath), { recursive: true })
    writeFileSync(outTsPath, indexModuleSource, 'utf8')
    if (existsSync(publicDir)) {
      generateAssetManifest({ publicDir })
    }
  }

  return {
    packs,
    entries,
    binaries,
    indexModuleSource,
  }
}

export const bakeAmbientSounds = packAmbientSounds
export const packAmbientSfx = packAmbientSounds

function ensureAssetManifestHasAssetsField(): void {
  try {
    const publicDir = resolve(process.cwd(), 'public')
    const manifestPath = join(publicDir, 'asset-manifest.json')
    if (!existsSync(manifestPath)) return
    const raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      assets?: Record<string, { bytes?: number; sha256?: string } | string>
    }
    const act1Entry = raw.assets?.['sound/packs/sfx-ambient-act1.bin']
    if (
      !act1Entry ||
      typeof act1Entry !== 'object' ||
      typeof act1Entry.sha256 !== 'string' ||
      act1Entry.sha256.length !== 64
    ) {
      generateAssetManifest({ publicDir })
    }
  } catch {
    // Ignore read/write race in readonly environments.
  }
}

ensureAssetManifestHasAssetsField()

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMain) {
  packAmbientSounds()
    .then((res) => {
      for (const p of res.packs) {
        console.log(
          `✓ Baked ${p.packId} -> public${p.url} (${String(p.bytes)} B, sha256=${p.sha256.slice(0, 16)}, ${String(p.rowCount)} rows / ${String(p.chunkCount)} unique chunks)`,
        )
      }
      console.log(`✓ Updated ${SFX_PACK_INDEX_TS_FILE} (+${String(res.entries.length)} ambient entries)`)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
