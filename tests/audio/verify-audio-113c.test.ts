/**
 * #943 F5: the shared 1.13c audio audit behind `npm run verify:audio` and the audio step of `npm run bake:verify`
 * (`src/baker/audit/verify-audio-113c.ts`): fail-closed runner semantics through the registry seam, the `tables`
 * section on the real MPQs and on tampered mirrors, argument parsing, the report printer and the CLI exit code.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  AUDIO_ARCHIVE_LOAD_ORDER_113C,
  AUDIO_AUDIT_SECTIONS_113C,
  AUDIO_AUDIT_SECTION_OWNERS_113C,
  formatAudioAuditReport,
  parseVerifyAudioArgs,
  resolveAudioAuditMpqDir,
  runAudioAudit,
  type AudioAuditReport,
  type AudioAuditSection,
} from '../../src/baker/audit/verify-audio-113c.ts'
import { DEFAULT_NODE_MPQ_DIR, MPQ_LOAD_ORDER } from '../../src/baker/mpq-archive-source.ts'
import { SOUND_ENVIRON_TS_FILE, SOUNDS_TS_FILE } from '../../src/baker/packers/pack-sound-tables.ts'
import { SOUNDS_113C } from '../../src/common/audio/sounds-113c.ts'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')
const scratch = mkdtempSync(join(tmpdir(), 'verify-audio-113c-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

let dirCount = 0
function scratchDir(name: string): string {
  dirCount += 1
  const dir = join(scratch, `${String(dirCount)}-${name}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** A root holding copies of the two committed generated modules, `edit` applied to their texts. */
function mirrorRoot(edit: (rel: string, text: string) => string | null): string {
  const root = scratchDir('mirror')
  mkdirSync(join(root, 'src', 'common', 'audio'), { recursive: true })
  for (const rel of [SOUNDS_TS_FILE, SOUND_ENVIRON_TS_FILE]) {
    const text = edit(rel, readFileSync(join(REPO_ROOT, rel), 'utf8'))
    if (text !== null) writeFileSync(join(root, rel), text)
  }
  return root
}

const section = (id: AudioAuditSection['id'], run: AudioAuditSection['run']): AudioAuditSection => ({ id, title: id, run })
const passing = (id: AudioAuditSection['id']) => section(id, async () => ({ checks: 3, errors: [], summary: `${id} fine` }))

describe('runAudioAudit — fail-closed runner', () => {
  it('registers the #943 tables, #944 sfx-core, #945 music, #946 ambient/levels/weather, and #947 skills sections; every M21 section id has an owner; the audio chain mounts music, speech, SFX, then data', () => {
    expect(AUDIO_AUDIT_SECTIONS_113C.map((s) => s.id)).toEqual(['tables', 'sfx-core', 'music', 'ambient', 'levels', 'weather', 'skills', 'monsters', 'speech', 'manifest'])
    expect(AUDIO_AUDIT_SECTION_OWNERS_113C).toEqual({
      tables: 943,
      'sfx-core': 944,
      music: 945,
      ambient: 946,
      levels: 946,
      weather: 946,
      skills: 947,
      monsters: 948,
      speech: 948,
      manifest: 948,
    })
    expect(AUDIO_ARCHIVE_LOAD_ORDER_113C).toEqual(['d2music.mpq', 'D2xMusic.mpq', 'd2speech.mpq', 'd2xtalk.mpq', 'd2sfx.mpq', ...MPQ_LOAD_ORDER])
  })

  it('a section with 0 checks fails as vacuous, one with errors fails, a throwing one is recorded and the next still runs', async () => {
    const report = await runAudioAudit({
      rootDir: REPO_ROOT,
      mpqDir: join(scratch, 'unused'),
      registry: [
        section('sfx-core', async () => {
          throw new Error('boom')
        }),
        section('music', async () => ({ checks: 0, errors: [], summary: 'nothing' })),
        section('ambient', async () => ({ checks: 2, errors: ['ambient: wrong'], summary: 'bad' })),
        passing('weather'),
      ],
    })
    expect(report.ok).toBe(false)
    expect(report.sections.map((s) => [s.id, s.ok])).toEqual([
      ['sfx-core', false],
      ['music', false],
      ['ambient', false],
      ['weather', true],
    ])
    expect(report.sections.map((s) => s.errors)).toEqual([['sfx-core: threw: boom'], ['music: vacuous section (0 checks)'], ['ambient: wrong'], []])
    expect(report.errorCount).toBe(3)
    const all = await runAudioAudit({ rootDir: REPO_ROOT, registry: [passing('weather'), passing('skills')], sections: ['skills'] })
    expect([all.ok, all.sections.map((s) => s.id)]).toEqual([true, ['skills']])
  })

  it('rejects an empty or duplicated registry and unknown, unimplemented, repeated or empty selections', async () => {
    await expect(runAudioAudit({ registry: [] })).rejects.toThrow(/the audit registry is empty/)
    await expect(runAudioAudit({ registry: [passing('weather'), passing('weather')] })).rejects.toThrow(/section "weather" is registered twice/)
    await expect(runAudioAudit({ sections: ['bogus'] })).rejects.toThrow(/unknown section "bogus" \(registered: tables, sfx-core, music, ambient, levels, weather, skills, monsters, speech, manifest\)/)
    await expect(runAudioAudit({ sections: ['tables', 'tables'] })).rejects.toThrow(/section "tables" requested twice/)
    await expect(runAudioAudit({ sections: [] })).rejects.toThrow(/no section selected/)
  })

  it('a missing MPQ directory or archive fails the tables section with the samples/d2 hint', async () => {
    const absent = join(scratch, 'absent')
    const missingDir = await runAudioAudit({ rootDir: REPO_ROOT, mpqDir: absent, sections: ['tables'] })
    expect(missingDir.ok).toBe(false)
    expect(missingDir.sections[0]!.errors).toEqual([`tables: threw: MPQ directory does not exist: ${absent} — link samples/d2 or set D2_DATA_DIR`])
    const empty = scratchDir('empty-mpq')
    const missingArchive = await runAudioAudit({ rootDir: REPO_ROOT, mpqDir: empty, sections: ['tables'] })
    expect(missingArchive.ok).toBe(false)
    expect(missingArchive.sections[0]!.errors).toEqual([
      `tables: threw: MPQ archive not found at ${join(empty, MPQ_LOAD_ORDER[0])} — link samples/d2 or set D2_DATA_DIR`,
    ])
  })
})

describe('the tables, sfx-core, and music sections on the 1.13c MPQs', () => {
  it('passes on this tree; its facts and hashes match the committed modules and baked SFX/music packs', async () => {
    const report = await runAudioAudit({ rootDir: REPO_ROOT, mpqDir: DEFAULT_NODE_MPQ_DIR })
    const lines = formatAudioAuditReport(report)
    expect(report.ok, lines.join('\n')).toBe(true)
    expect(report.sections.map((s) => s.id)).toEqual(['tables', 'sfx-core', 'music', 'ambient', 'levels', 'weather', 'skills', 'monsters', 'speech', 'manifest'])
    const tables = report.sections[0]!
    expect(tables.checks).toBeGreaterThan(3 * 4698)
    const noneWav = SOUNDS_113C.filter((r) => r.fileName.trim().toLowerCase() === 'none.wav').length
    expect(tables.facts).toMatchObject({
      soundsRows: 4699,
      soundEnvironRows: 50,
      levels: 136,
      musicRange: '4657..4684',
      nBlocks: '4608/86/4/0',
      compoundRows: 590,
      noneWavRows: noneWav,
      playableRows: 4699 - noneWav,
    })
    for (const rel of [SOUNDS_TS_FILE, SOUND_ENVIRON_TS_FILE]) {
      const hash = createHash('sha256').update(readFileSync(join(REPO_ROOT, rel), 'utf8'), 'utf8').digest('hex')
      expect(tables.facts?.[`sha256:${rel}`], rel).toBe(hash)
    }
    const sfxCore = report.sections[1]!
    expect(sfxCore.ok).toBe(true)
    expect(sfxCore.checks).toBeGreaterThan(5000)
    expect(sfxCore.facts).toMatchObject({
      packs: 3,
      coreRows: 653,
      uniqueChunks: 627,
    })
    const music = report.sections[2]!
    expect(music.ok).toBe(true)
    expect(music.facts).toMatchObject({
      tracks: 43,
      loopingTracks: 29,
      stingerTracks: 14,
    })
    expect(lines[0]).toMatch(/^=== Diablo II v1\.13c Audio Audit \(verify-audio-113c\) — root=.* sections=\[tables, sfx-core, music, ambient, levels, weather, skills, monsters, speech, manifest\] ===$/)
    expect(lines[1]).toMatch(/^✓ \[audio:tables\] Sounds\.txt 4699 rows \+ SoundEnviron\.txt 50 rows \+ Levels\.txt 136\/136 SoundEnv \(Patch_D2\.mpq\); re-bake byte-identical/)
    expect(lines[2]).toMatch(/^✓ \[audio:sfx-core\] 3 core packs .* 653 rows \/ 627 unique hard-CBR Ogg Opus chunks verified/)
    expect(lines[3]).toMatch(/^✓ \[audio:music\] 43 tracks \(29 looping BGM \+ 14 quest stingers/)
    expect(lines.at(-1)).toBe('=== Audio audit: 10/10 section(s) passed (0 errors) ===')
  }, 60_000)

  it('a tampered or missing generated module fails the determinism check, naming the file and the first differing line', async () => {
    const tampered = mirrorRoot((rel, text) => (rel === SOUND_ENVIRON_TS_FILE ? text.replace('\n', '\n// tampered\n') : text))
    const report = await runAudioAudit({ rootDir: tampered, mpqDir: DEFAULT_NODE_MPQ_DIR, sections: ['tables'] })
    expect(report.ok).toBe(false)
    const errors = report.sections[0]!.errors
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(
      /^tables: determinism: src\/common\/audio\/sound-environ-113c\.ts differs from the MPQ re-bake at line 2: committed "\/\/ tampered" \/ rebaked " \* Authoritative/,
    )

    const missing = mirrorRoot((rel, text) => (rel === SOUNDS_TS_FILE ? null : text))
    const report2 = await runAudioAudit({ rootDir: missing, mpqDir: DEFAULT_NODE_MPQ_DIR, sections: ['tables'] })
    expect(report2.ok).toBe(false)
    expect(report2.sections[0]!.errors).toEqual([
      `tables: committed ${SOUNDS_TS_FILE} missing at ${join(missing, SOUNDS_TS_FILE)} (run npm run bake -- sound-tables)`,
    ])

    const clean = await runAudioAudit({ rootDir: mirrorRoot((_rel, text) => text), mpqDir: DEFAULT_NODE_MPQ_DIR, sections: ['tables'] })
    expect(clean.ok, formatAudioAuditReport(clean).join('\n')).toBe(true)
  }, 60_000)
})

describe('MPQ directory rule, CLI arguments and the report printer', () => {
  it('resolveAudioAuditMpqDir uses <root>/samples/d2 only when it holds d2data.mpq', () => {
    const bare = scratchDir('bare-root')
    expect(resolveAudioAuditMpqDir(bare)).toBe(DEFAULT_NODE_MPQ_DIR)
    const linked = scratchDir('linked-root')
    mkdirSync(join(linked, 'samples', 'd2'), { recursive: true })
    expect(resolveAudioAuditMpqDir(linked)).toBe(DEFAULT_NODE_MPQ_DIR)
    writeFileSync(join(linked, 'samples', 'd2', 'd2data.mpq'), '')
    expect(resolveAudioAuditMpqDir(linked)).toBe(join(linked, 'samples', 'd2'))
  })

  it('parseVerifyAudioArgs accepts --sections / --mpq-dir / --root / --json (space or =) and throws on anything else', () => {
    expect(parseVerifyAudioArgs([])).toEqual({})
    expect(parseVerifyAudioArgs(['--sections', 'tables, music,', '--mpq-dir=/m', '--root', '/r', '--json=out.json'])).toEqual({
      sections: ['tables', 'music'],
      mpqDir: '/m',
      rootDir: '/r',
      json: 'out.json',
    })
    expect(() => parseVerifyAudioArgs(['--bogus'])).toThrow(/unknown argument "--bogus"/)
    expect(() => parseVerifyAudioArgs(['tables'])).toThrow(/unknown argument "tables"/)
    expect(() => parseVerifyAudioArgs(['--mpq-dir'])).toThrow(/--mpq-dir needs a value/)
    expect(() => parseVerifyAudioArgs(['--sections', '--root', '/r'])).toThrow(/--sections needs a value/)
  })

  it('formatAudioAuditReport lists every error of a failed section up to the cap and ends with the failure line', () => {
    const report: AudioAuditReport = {
      ok: false,
      rootDir: '/root',
      mpqDir: '/mpq',
      errorCount: 3,
      durationMs: 12,
      sections: [{ id: 'tables', ok: false, checks: 5, errors: ['tables: a', 'tables: b', 'tables: c'], summary: 'x', durationMs: 4 }],
    }
    expect(formatAudioAuditReport(report, { maxErrorsPerSection: 2 })).toEqual([
      '=== Diablo II v1.13c Audio Audit (verify-audio-113c) — root=/root mpq=/mpq sections=[tables] ===',
      '✗ [audio:tables] 3 error(s) (5 checks, 0.00 s)',
      '  - tables: a',
      '  - tables: b',
      '  … and 1 more',
      '=== Audio audit FAILED: 3 error(s) in [tables] ===',
    ])
  })
})

describe('tools/verify-audio.ts', () => {
  it('exits 1 (fail closed) and prints the failed report when the MPQs are missing', () => {
    const empty = scratchDir('cli-empty-mpq')
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'tools/verify-audio.ts', '--sections', 'tables', '--mpq-dir', empty], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(1)
    expect(r.stdout).toMatch(/✗ \[audio:tables\] 1 error\(s\)/)
    expect(r.stdout).toMatch(/MPQ archive not found at .*d2data\.mpq — link samples\/d2 or set D2_DATA_DIR/)
    expect(r.stdout).toMatch(/=== Audio audit FAILED: 1 error\(s\) in \[tables\] ===/)
  }, 60_000)
})
