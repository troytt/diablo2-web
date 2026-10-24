/**
 * M21-P1 (#943) — F1 generated `sounds-113c.ts` and F2 generated `sound-environ-113c.ts`.
 *
 * Oracle: `harness-113c.ts` (1.13c MPQ tables parsed independently + D2Client.dll post-processing
 * re-derived from the disassembly). Product: the generated contracts under `src/common/audio/`
 * (PROJECT.md Interface Contracts → reland_plan §E.1).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  PRODUCT,
  getOracle113c,
  loadProductModule,
  oracleBuildSoundPath,
  readRepoText,
  requireExport,
  summarize,
  type Oracle113c,
  type OracleSoundEnvironRow,
} from './harness-113c.ts'

// The gates run on hosts at load average 60+: give oracle/MPQ-heavy tests head-room (per-test overrides still apply).
vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F1 = '#943 F1 sounds-113c.ts'
const F2 = '#943 F2 sound-environ-113c.ts'

interface SoundsRowC {
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

interface SoundsModuleC {
  readonly SOUNDS_ROW_COUNT_113C: number
  readonly MUSIC_SOUND_RANGE_113C: readonly [number, number]
  readonly SOUNDS_113C: readonly SoundsRowC[]
  readonly SOUNDS_BY_NAME_113C: Readonly<Record<string, number>>
  getSoundRow113c(id: number): SoundsRowC | undefined
  getSoundIdByName113c(name: string): number | undefined
  buildSoundMpqPath113c(id: number, fileName?: string): string | null
}

type SoundEnvironRowC = OracleSoundEnvironRow

interface SoundEnvironModuleC {
  readonly SOUND_ENVIRON_ROW_COUNT_113C: number
  readonly SOUND_ENVIRON_113C: readonly SoundEnvironRowC[]
  readonly LEVEL_SOUND_ENV_113C: Readonly<Record<number, number>>
  getSoundEnvironForLevel113c(levelId: number): SoundEnvironRowC
}

const SOUNDS_EXPORTS = ['SOUNDS_ROW_COUNT_113C', 'MUSIC_SOUND_RANGE_113C', 'SOUNDS_113C', 'SOUNDS_BY_NAME_113C', 'getSoundRow113c', 'getSoundIdByName113c', 'buildSoundMpqPath113c'] as const
const ENV_EXPORTS = ['SOUND_ENVIRON_ROW_COUNT_113C', 'SOUND_ENVIRON_113C', 'LEVEL_SOUND_ENV_113C', 'getSoundEnvironForLevel113c'] as const

async function soundsModule(): Promise<SoundsModuleC> {
  const m = await loadProductModule(PRODUCT.sounds, F1)
  for (const name of SOUNDS_EXPORTS) requireExport(m, name, PRODUCT.sounds, F1)
  return m as unknown as SoundsModuleC
}

async function environModule(): Promise<SoundEnvironModuleC> {
  const m = await loadProductModule(PRODUCT.soundEnviron, F2)
  for (const name of ENV_EXPORTS) requireExport(m, name, PRODUCT.soundEnviron, F2)
  return m as unknown as SoundEnvironModuleC
}

const RAW_FIELDS = [
  'sound', 'rawSound', 'fileName', 'volume', 'rawGroupSize', 'loop', 'fadeIn', 'fadeOut', 'deferInst', 'stopInst',
  'duration', 'compound', 'reverb', 'falloff', 'cache', 'asyncOnly', 'priority', 'stream', 'stereo', 'tracking',
  'solo', 'musicVol', 'block1', 'block2', 'block3',
] as const satisfies readonly (keyof SoundsRowC)[]

const ENV_FIELDS = [
  'index', 'handle', 'song', 'dayAmbience', 'nightAmbience', 'dayEvent', 'nightEvent', 'eventDelay', 'indoors',
  'material1', 'material2', 'eaxEnviron', 'eaxEnvSize', 'eaxEnvDiff', 'eaxRoomVol', 'eaxRoomHF', 'eaxDecayTime',
  'eaxDecayHF', 'eaxReflect', 'eaxReflectDelay', 'eaxReverb', 'eaxRevDelay', 'eaxRoomRoll', 'eaxAirAbsorb',
] as const satisfies readonly (keyof OracleSoundEnvironRow)[]

function envDiff(product: SoundEnvironRowC | undefined, oracle: OracleSoundEnvironRow, where: string): string[] {
  if (product === undefined) return [`${where}: missing`]
  const out: string[] = []
  for (const f of ENV_FIELDS) {
    if (product[f] !== oracle[f]) out.push(`${where}.${f}: product=${JSON.stringify(product[f])} oracle=${JSON.stringify(oracle[f])}`)
  }
  return out
}

/** MPQ member names are case-insensitive; compare paths the way the archive does. */
function samePath(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b
  return a.replace(/\//g, '\\').toLowerCase() === b.replace(/\//g, '\\').toLowerCase()
}

let O: Oracle113c

beforeAll(() => {
  O = getOracle113c()
}, 120_000)

describe('M21-P1 #943 — F1 generated Sounds.txt contract (src/common/audio/sounds-113c.ts)', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F1-01] exposes all 4,699 Sounds.txt records with id === index (SOUNDS_ROW_COUNT_113C, SOUNDS_113C, getSoundRow113c)', async () => {
      const s = await soundsModule()
      expect(O.sounds.length, 'oracle Sounds.txt record count').toBe(4699)
      expect(s.SOUNDS_ROW_COUNT_113C).toBe(O.sounds.length)
      expect(s.SOUNDS_113C.length).toBe(O.sounds.length)
      const bad: string[] = []
      for (let id = 0; id < O.sounds.length; id += 1) {
        if (s.SOUNDS_113C[id]?.id !== id) bad.push(`SOUNDS_113C[${String(id)}].id=${String(s.SOUNDS_113C[id]?.id)}`)
        if (s.getSoundRow113c(id)?.id !== id) bad.push(`getSoundRow113c(${String(id)})`)
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F1-02] every raw Sounds.txt column of every record equals the 1.13c MPQ table (Patch_D2 > d2exp > d2data)', async () => {
      const s = await soundsModule()
      const bad: string[] = []
      for (const o of O.sounds) {
        const p = s.SOUNDS_113C[o.id]
        if (p === undefined) {
          bad.push(`row ${String(o.id)} missing`)
          continue
        }
        for (const f of RAW_FIELDS) {
          if (p[f] !== o[f]) bad.push(`row ${String(o.id)} (${o.sound}).${f}: product=${JSON.stringify(p[f])} oracle=${JSON.stringify(o[f])}`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F1-03] Group Size / groupBase / nBlocks equal D2Client 0x6fb0e8e1–0x6fb0e952 post-processing for all records', async () => {
      const s = await soundsModule()
      const bad: string[] = []
      for (const o of O.sounds) {
        const p = s.SOUNDS_113C[o.id]!
        for (const f of ['groupSize', 'groupBase', 'nBlocks'] as const) {
          if (p[f] !== o[f]) bad.push(`row ${String(o.id)} (${o.sound}).${f}: product=${String(p[f])} oracle=${String(o[f])}`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
      // Post-processed invariants that hold for records 1..4698.
      for (let id = 1; id < O.sounds.length; id += 1) {
        expect(s.SOUNDS_113C[id]!.groupSize).toBeGreaterThanOrEqual(1)
        expect(s.SOUNDS_113C[id]!.groupBase).toBeLessThanOrEqual(id)
      }
    })

    it('[T1-F1-04] MUSIC_SOUND_RANGE_113C equals min/max SoundEnviron Song > 0 (0x6fb0e954–0x6fb0e990, [0x6fbcc25c]..[0x6fbcc260])', async () => {
      const s = await soundsModule()
      expect(O.musicRange).toEqual([4657, 4684])
      expect([...s.MUSIC_SOUND_RANGE_113C]).toEqual([...O.musicRange])
    })

    it('[T1-F1-05] SOUNDS_BY_NAME_113C / getSoundIdByName113c map every named record (lower-case trimmed) to its id', async () => {
      const s = await soundsModule()
      const bad: string[] = []
      for (const [name, id] of O.soundsByName) {
        if (s.SOUNDS_BY_NAME_113C[name] !== id) bad.push(`SOUNDS_BY_NAME_113C['${name}']=${String(s.SOUNDS_BY_NAME_113C[name])} expected ${String(id)}`)
        if (s.getSoundIdByName113c(name) !== id) bad.push(`getSoundIdByName113c('${name}')=${String(s.getSoundIdByName113c(name))} expected ${String(id)}`)
      }
      expect(bad, summarize(bad)).toEqual([])
      expect(Object.keys(s.SOUNDS_BY_NAME_113C).length).toBe(O.soundsByName.size)
    })

    it('[T1-F1-06] buildSoundMpqPath113c(id) equals BuildSoundPath 0x6fb0db30 (DATA\\LOCAL|GLOBAL + \\SFX|\\MUSIC\\ + FileName) for every record', async () => {
      const s = await soundsModule()
      const bad: string[] = []
      for (const o of O.sounds) {
        const expected = oracleBuildSoundPath(o.id, o.fileName)
        const got = s.buildSoundMpqPath113c(o.id)
        if (!samePath(got, expected)) bad.push(`id ${String(o.id)} (${o.sound}): product=${String(got)} oracle=${String(expected)}`)
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F1-07] every playable record resolves through the product path to a shipped MPQ member, except exactly the data-derived unshipped set', async () => {
      const s = await soundsModule()
      const unresolved: number[] = []
      for (let id = 1; id < O.sounds.length; id += 1) {
        const p = s.buildSoundMpqPath113c(id)
        if (p !== null && O.archives.find(p) === undefined) unresolved.push(id)
      }
      expect(O.missingMemberIds.length, 'oracle: 4 monster + 30 speech members are absent from every 1.13c MPQ').toBe(34)
      expect(unresolved).toEqual([...O.missingMemberIds])
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F1-01] variant-group edges: thunder 202..204 (groupBase 202, Group Size 3/1/1), first record 1, last record 4698, sentinel record 0', async () => {
      const s = await soundsModule()
      for (const id of [0, 1, 202, 203, 204, 4698]) {
        const o = O.sounds[id]!
        const p = s.SOUNDS_113C[id]!
        expect({ id, groupSize: p.groupSize, groupBase: p.groupBase, nBlocks: p.nBlocks, sound: p.sound }).toEqual({
          id,
          groupSize: o.groupSize,
          groupBase: o.groupBase,
          nBlocks: o.nBlocks,
          sound: o.sound,
        })
      }
      expect([202, 203, 204].map((id) => s.SOUNDS_113C[id]!.groupBase)).toEqual([202, 202, 202])
      expect([202, 203, 204].map((id) => s.SOUNDS_113C[id]!.groupSize)).toEqual([3, 1, 1])
      // Record 0 is not visited by the loop (it starts at ebp = 1): no rewrite of Group Size 0 → 1.
      expect(s.SOUNDS_113C[0]!.groupSize).toBe(O.sounds[0]!.rawGroupSize)
      expect(s.SOUNDS_113C[0]!.groupBase).toBe(0)
    })

    it('[T2-F1-02] nested group leaders (non-zero Group Size inside an open group) keep the outer leader as groupBase and open a new group', async () => {
      const s = await soundsModule()
      const nested = O.sounds.filter((o) => o.id > 0 && o.rawGroupSize !== 0 && o.groupBase !== o.id)
      expect(nested.length, 'oracle nested leaders (data-derived)').toBe(7)
      const bad: string[] = []
      for (const o of nested) {
        const p = s.SOUNDS_113C[o.id]!
        if (p.groupBase !== o.groupBase) bad.push(`nested leader ${String(o.id)}: groupBase product=${String(p.groupBase)} oracle=${String(o.groupBase)}`)
        // Its own members (id+1 .. id+groupSize-1, if not cut by a later leader) point at it.
        for (let k = 1; k < o.rawGroupSize; k += 1) {
          const m = O.sounds[o.id + k]!
          if (m.rawGroupSize !== 0) break
          if (s.SOUNDS_113C[m.id]!.groupBase !== o.id) bad.push(`member ${String(m.id)} of nested leader ${String(o.id)}: groupBase=${String(s.SOUNDS_113C[m.id]!.groupBase)}`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T2-F1-03] nBlocks counts LEADING Block 1..3 != -1 only (0..3) in every category present in the data', async () => {
      const s = await soundsModule()
      const byCount = new Map<number, number[]>()
      for (const o of O.sounds) {
        if (o.id === 0) continue
        const list = byCount.get(o.nBlocks) ?? []
        list.push(o.id)
        byCount.set(o.nBlocks, list)
      }
      expect(byCount.get(0)?.length ?? 0, 'records without blocks').toBeGreaterThan(4000)
      expect(byCount.get(1)?.length ?? 0, 'records with exactly Block 1 (music loops)').toBeGreaterThan(0)
      const bad: string[] = []
      for (const [n, ids] of byCount) {
        for (const id of ids) if (s.SOUNDS_113C[id]!.nBlocks !== n) bad.push(`id ${String(id)}: nBlocks=${String(s.SOUNDS_113C[id]!.nBlocks)} expected ${String(n)}`)
      }
      // Records where Block 1 is -1 but a later block is set must still count 0 (leading run stops at -1).
      for (const o of O.sounds) {
        if (o.id > 0 && o.block1 === -1 && s.SOUNDS_113C[o.id]!.nBlocks !== 0) bad.push(`id ${String(o.id)}: Block 1 = -1 but nBlocks=${String(s.SOUNDS_113C[o.id]!.nBlocks)}`)
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T2-F1-04] BuildSoundPath range edges: 2933 global SFX, 2934/4656 local speech, 4657/4698 music; out-of-range ids → null', async () => {
      const s = await soundsModule()
      for (const id of [1, 2933, 2934, 4656, 4657, 4684, 4698]) {
        expect(samePath(s.buildSoundMpqPath113c(id), oracleBuildSoundPath(id, O.sounds[id]!.fileName)), `id ${String(id)}`).toBe(true)
      }
      expect(s.buildSoundMpqPath113c(2933)!.toUpperCase().startsWith('DATA\\GLOBAL\\SFX\\')).toBe(true)
      expect(s.buildSoundMpqPath113c(2934)!.toUpperCase().startsWith('DATA\\LOCAL\\SFX\\')).toBe(true)
      expect(s.buildSoundMpqPath113c(4656)!.toUpperCase().startsWith('DATA\\LOCAL\\SFX\\')).toBe(true)
      expect(s.buildSoundMpqPath113c(4657)!.toUpperCase().startsWith('DATA\\GLOBAL\\MUSIC\\')).toBe(true)
      expect(s.buildSoundMpqPath113c(4698)!.toUpperCase().startsWith('DATA\\GLOBAL\\MUSIC\\')).toBe(true)
      for (const id of [0, -1, 4699, 1.5, Number.NaN]) expect(s.buildSoundMpqPath113c(id), `id ${String(id)}`).toBeNull()
    })

    it('[T2-F1-05] none.wav records (157 incl. record 0) never resolve to an MPQ path', async () => {
      const s = await soundsModule()
      const none = O.sounds.filter((o) => o.fileName.trim().toLowerCase() === 'none.wav')
      expect(none.length).toBe(157)
      const bad = none.filter((o) => s.buildSoundMpqPath113c(o.id) !== null).map((o) => `id ${String(o.id)} → ${String(s.buildSoundMpqPath113c(o.id))}`)
      expect(bad, summarize(bad)).toEqual([])
      expect(s.SOUNDS_113C[0]!.fileName.toLowerCase()).toBe('none.wav')
    })

    it('[T2-F1-06] name lookups: trailing-space name 4601 keeps rawSound but trims sound; lookups are case/whitespace-insensitive; unknown/empty → undefined', async () => {
      const s = await soundsModule()
      const ws = O.sounds.filter((o) => o.rawSound !== o.sound)
      expect(ws.map((o) => o.id)).toEqual([4601])
      expect(s.SOUNDS_113C[4601]!.rawSound).toBe(O.sounds[4601]!.rawSound)
      expect(s.SOUNDS_113C[4601]!.sound).toBe(O.sounds[4601]!.sound)
      expect(s.getSoundIdByName113c(`  ${O.sounds[4601]!.sound.toUpperCase()}  `)).toBe(4601)
      expect(s.getSoundIdByName113c('Event_Thunder_1')).toBe(202)
      expect(s.getSoundIdByName113c('')).toBeUndefined()
      expect(s.getSoundIdByName113c('   ')).toBeUndefined()
      expect(s.getSoundIdByName113c('item_drop')).toBeUndefined() // legacy fake name: not a 1.13c row
      expect(s.getSoundIdByName113c('cursor_imbue')).toBeUndefined() // legacy fake name: not a 1.13c row
    })

    it('[T2-F1-07] getSoundRow113c rejects ids outside 0..4698 and non-integers', async () => {
      const s = await soundsModule()
      for (const id of [-1, 4699, 10_000, 1.5, Number.NaN]) expect(s.getSoundRow113c(id), `id ${String(id)}`).toBeUndefined()
      expect(s.getSoundRow113c(4698)?.sound).toBe(O.sounds[4698]!.sound)
    })

    it('[T2-F1-08] the module is a generated, import-free contract with no handwritten fake table identifiers (D21)', async () => {
      await soundsModule()
      const src = readRepoText(PRODUCT.sounds, F1)
      expect(src).toMatch(/GENERATED/)
      expect(src).not.toMatch(/^\s*import\s/m)
      expect(src).not.toMatch(/SOUNDS_TXT_BY_ID/)
      expect(src).not.toMatch(/Math\.random|Date\.now/)
    })
  })
})

describe('M21-P1 #943 — F2 generated SoundEnviron.txt + 136-level SoundEnv contract (src/common/audio/sound-environ-113c.ts)', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F2-01] exposes all 50 SoundEnviron.txt rows with index === position', async () => {
      const e = await environModule()
      expect(O.soundEnviron.length).toBe(50)
      expect(e.SOUND_ENVIRON_ROW_COUNT_113C).toBe(50)
      expect(e.SOUND_ENVIRON_113C.length).toBe(50)
      e.SOUND_ENVIRON_113C.forEach((row, i) => expect(row.index, `row ${String(i)}`).toBe(i))
    })

    it('[T1-F2-02] every column of every SoundEnviron row equals the 1.13c MPQ table', async () => {
      const e = await environModule()
      const bad = O.soundEnviron.flatMap((o, i) => envDiff(e.SOUND_ENVIRON_113C[i], o, `env ${String(i)} (${o.handle})`))
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F2-03] LEVEL_SOUND_ENV_113C maps exactly levels 1..136 to Levels.txt SoundEnv', async () => {
      const e = await environModule()
      const keys = Object.keys(e.LEVEL_SOUND_ENV_113C).map(Number).sort((a, b) => a - b)
      expect(keys).toEqual(Array.from({ length: 136 }, (_, i) => i + 1))
      const bad: string[] = []
      for (const [id, lvl] of O.levels) {
        if (e.LEVEL_SOUND_ENV_113C[id] !== lvl.soundEnv) bad.push(`level ${String(id)} (${lvl.name}): product=${String(e.LEVEL_SOUND_ENV_113C[id])} oracle=${String(lvl.soundEnv)}`)
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F2-04] getSoundEnvironForLevel113c(level) returns the full environment row of each of the 136 levels', async () => {
      const e = await environModule()
      const bad: string[] = []
      for (const [id, lvl] of O.levels) {
        let row: SoundEnvironRowC | undefined
        try {
          row = e.getSoundEnvironForLevel113c(id)
        } catch (err) {
          bad.push(`level ${String(id)} threw ${String(err)}`)
          continue
        }
        bad.push(...envDiff(row, O.soundEnviron[lvl.soundEnv]!, `level ${String(id)} (${lvl.name})`))
      }
      expect(bad, summarize(bad)).toEqual([])
    })

    it('[T1-F2-05] songs come from Patch_D2.mpq (every Song shifted +1 vs d2exp.mpq) — mount precedence is honoured', async () => {
      const e = await environModule()
      const shifted = O.soundEnviron.filter((row, i) => row.song !== O.soundEnvironD2expOnly[i]!.song)
      expect(shifted.length, 'oracle: Patch_D2 rewrites the Song column').toBeGreaterThan(40)
      for (const row of shifted) {
        expect(e.SOUND_ENVIRON_113C[row.index]!.song, `env ${String(row.index)} ${row.handle}`).toBe(row.song)
        expect(e.SOUND_ENVIRON_113C[row.index]!.song).not.toBe(O.soundEnvironD2expOnly[row.index]!.song)
      }
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F2-01] getSoundEnvironForLevel113c fails fast on unknown levels (0, 137, -1, 1.5, NaN)', async () => {
      const e = await environModule()
      for (const id of [0, 137, -1, 1.5, Number.NaN]) {
        expect(() => e.getSoundEnvironForLevel113c(id), `level ${String(id)}`).toThrow()
      }
    })

    it('[T2-F2-02] first, last and act-boundary levels (1, 39, 40, 75, 103, 108, 109, 136) map to their oracle environments', async () => {
      const e = await environModule()
      for (const id of [1, 39, 40, 75, 103, 108, 109, 136]) {
        const lvl = O.levels.get(id)!
        expect(e.LEVEL_SOUND_ENV_113C[id], `level ${String(id)} ${lvl.name}`).toBe(lvl.soundEnv)
        expect(e.getSoundEnvironForLevel113c(id).handle).toBe(O.soundEnviron[lvl.soundEnv]!.handle)
      }
    })

    it('[T2-F2-03] environment 0 (no song, no ambience) is preserved verbatim and every song-less environment keeps Song = 0', async () => {
      const e = await environModule()
      expect(envDiff(e.SOUND_ENVIRON_113C[0], O.soundEnviron[0]!, 'env 0')).toEqual([])
      const songless = O.soundEnviron.filter((o) => o.song === 0).map((o) => o.index)
      expect(songless).toContain(0)
      for (const i of songless) expect(e.SOUND_ENVIRON_113C[i]!.song, `env ${String(i)}`).toBe(0)
    })

    it('[T2-F2-04] environments shared by levels of different acts map identically for every such level', async () => {
      const e = await environModule()
      const acts = new Map<number, Set<number>>()
      for (const lvl of O.levels.values()) {
        const s = acts.get(lvl.soundEnv) ?? new Set<number>()
        s.add(lvl.act)
        acts.set(lvl.soundEnv, s)
      }
      const shared = [...acts.entries()].filter(([, s]) => s.size > 1).map(([env]) => env)
      expect(shared.length, 'oracle: environments used in more than one act').toBeGreaterThan(0)
      for (const lvl of O.levels.values()) {
        if (shared.includes(lvl.soundEnv)) expect(e.LEVEL_SOUND_ENV_113C[lvl.id], `level ${String(lvl.id)}`).toBe(lvl.soundEnv)
      }
    })

    it('[T2-F2-05] negative EAX values and zero Event Delay rows are preserved exactly', async () => {
      const e = await environModule()
      const negative = O.soundEnviron.filter((o) => o.eaxRoomVol < 0 || o.eaxRoomHF < 0 || o.eaxReflect < 0 || o.eaxReverb < 0)
      expect(negative.length, 'oracle rows with negative EAX values').toBeGreaterThan(0)
      for (const o of negative) expect(envDiff(e.SOUND_ENVIRON_113C[o.index], o, `env ${String(o.index)}`)).toEqual([])
      for (const o of O.soundEnviron.filter((r) => r.eventDelay === 0)) expect(e.SOUND_ENVIRON_113C[o.index]!.eventDelay).toBe(0)
    })

    it('[T2-F2-06] the module is generated and pure (no imports of client/baker code, no Math.random/Date.now)', async () => {
      await environModule()
      const src = readRepoText(PRODUCT.soundEnviron, F2)
      expect(src).toMatch(/GENERATED/)
      expect(src).not.toMatch(/from\s+['"][^'"]*(client|baker)\//)
      expect(src).not.toMatch(/Math\.random|Date\.now/)
    })
  })
})

describe('M21-P1 #943 — Tier 3 pairwise F1 × F2', () => {
  it('[T3-P1-01] every level song is 0 or a Stream/Music Vol record inside MUSIC_SOUND_RANGE_113C that resolves under DATA\\GLOBAL\\MUSIC\\', async () => {
    const s = await soundsModule()
    const e = await environModule()
    const [lo, hi] = s.MUSIC_SOUND_RANGE_113C
    const bad: string[] = []
    for (let level = 1; level <= 136; level += 1) {
      const song = e.getSoundEnvironForLevel113c(level).song
      if (song === 0) continue
      const row = s.getSoundRow113c(song)
      if (song < lo || song > hi) bad.push(`level ${String(level)} song ${String(song)} outside [${String(lo)}, ${String(hi)}]`)
      if (row === undefined || !row.stream || !row.musicVol) bad.push(`level ${String(level)} song ${String(song)} is not a Stream=1 Music Vol=1 row`)
      const p = s.buildSoundMpqPath113c(song)
      if (p === null || !p.toUpperCase().startsWith('DATA\\GLOBAL\\MUSIC\\')) bad.push(`level ${String(level)} song ${String(song)} path ${String(p)}`)
      if (O.archives.find(p ?? '') === undefined) bad.push(`level ${String(level)} song ${String(song)} member not shipped`)
    }
    expect(bad, summarize(bad)).toEqual([])
  })

  it('[T3-P1-02] every Day/Night Ambience and Event id of every environment is 0 or a shipped Stream=0 record whose group matches the oracle', async () => {
    const s = await soundsModule()
    const e = await environModule()
    const bad: string[] = []
    for (const env of e.SOUND_ENVIRON_113C) {
      for (const f of ['dayAmbience', 'nightAmbience', 'dayEvent', 'nightEvent'] as const) {
        const id = env[f]
        if (id === 0) continue
        const row = s.getSoundRow113c(id)
        const o = O.sounds[id]
        if (row === undefined || o === undefined) {
          bad.push(`env ${String(env.index)}.${f}=${String(id)}: no row`)
          continue
        }
        if (row.stream) bad.push(`env ${String(env.index)}.${f}=${String(id)} is a streamed row`)
        if (row.groupBase !== o.groupBase || row.groupSize !== o.groupSize) bad.push(`env ${String(env.index)}.${f}=${String(id)} group mismatch`)
        const p = s.buildSoundMpqPath113c(id)
        if (p === null || O.archives.find(p) === undefined) bad.push(`env ${String(env.index)}.${f}=${String(id)} unresolvable (${String(p)})`)
      }
    }
    expect(bad, summarize(bad)).toEqual([])
  })
})
