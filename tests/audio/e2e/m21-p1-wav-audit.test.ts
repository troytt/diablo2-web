/**
 * M21-P1 (#943) — F4 shared WAV/PCM parser, F5 `npm run verify:audio` + shared audit module +
 * `bake:verify` audio step, F6 green full-suite baseline (D17) and no legacy reintroduction.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  D2_DATA_DIR,
  PRODUCT,
  REPO_ROOT,
  getOracle113c,
  loadProductModule,
  oracleBuildSoundPath,
  oracleWavBytes,
  oracleWavFacts,
  readRepoText,
  requireExport,
  runRepoCommand,
  summarize,
  tail,
  type Oracle113c,
} from './harness-113c.ts'

// The gates run on hosts at load average 60+: give oracle/MPQ-heavy tests head-room (per-test overrides still apply).
vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F4 = '#943 F4 src/common/formats/wav.ts'
const F5 = '#943 F5 verify:audio / audit'
const F6 = '#943 F6 green baseline (D17)'

interface WavPcm16C {
  readonly channels: 1 | 2
  readonly sampleRate: number
  readonly frames: number
  readonly dataOffset: number
  readonly dataBytes: number
}
type ParseWav = (bytes: Uint8Array, what: string) => WavPcm16C

interface AuditReportC {
  readonly ok: boolean
  readonly sections: readonly { readonly id: string; readonly errors: readonly string[]; readonly summary: string }[]
}
type RunAudit = (opts?: { rootDir?: string; mpqDir?: string; sections?: readonly string[] }) => Promise<AuditReportC>

async function parseWav(): Promise<ParseWav> {
  const m = await loadProductModule(PRODUCT.wav, F4)
  return requireExport<ParseWav>(m, 'parseWavPcm16', PRODUCT.wav, F4)
}

async function runAudit(): Promise<RunAudit> {
  const m = await loadProductModule(PRODUCT.audit, F5)
  return requireExport<RunAudit>(m, 'runAudioAudit', PRODUCT.audit, F5)
}

// ── Synthetic RIFF builder (test INPUT data for the parser's boundary cases) ────────────────────
interface Chunk {
  readonly id: string
  readonly body: Uint8Array
  readonly declaredSize?: number
}
function fmtBody(o: { tag?: number; channels?: number; rate?: number; bits?: number; blockAlign?: number; byteRate?: number } = {}): Uint8Array {
  const tag = o.tag ?? 1
  const ch = o.channels ?? 1
  const rate = o.rate ?? 22050
  const bits = o.bits ?? 16
  const ba = o.blockAlign ?? (ch * bits) / 8
  const br = o.byteRate ?? rate * ba
  const b = new Uint8Array(16)
  const dv = new DataView(b.buffer)
  dv.setUint16(0, tag, true)
  dv.setUint16(2, ch, true)
  dv.setUint32(4, rate, true)
  dv.setUint32(8, br, true)
  dv.setUint16(12, ba, true)
  dv.setUint16(14, bits, true)
  return b
}
function riff(chunks: readonly Chunk[], opts: { riffSizeDelta?: number; magic?: string } = {}): Uint8Array {
  const parts: Uint8Array[] = []
  for (const c of chunks) {
    const head = new Uint8Array(8)
    for (let i = 0; i < 4; i += 1) head[i] = c.id.charCodeAt(i)
    new DataView(head.buffer).setUint32(4, c.declaredSize ?? c.body.length, true)
    parts.push(head, c.body)
    if (c.body.length & 1) parts.push(new Uint8Array(1))
  }
  const payload = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(12 + payload)
  const magic = opts.magic ?? 'RIFF'
  for (let i = 0; i < 4; i += 1) out[i] = magic.charCodeAt(i)
  new DataView(out.buffer).setUint32(4, 4 + payload + (opts.riffSizeDelta ?? 0), true)
  out.set([0x57, 0x41, 0x56, 0x45], 8) // WAVE
  let at = 12
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
const pcm = (frames: number, channels = 1): Uint8Array => {
  const b = new Uint8Array(frames * channels * 2)
  for (let i = 0; i < b.length; i += 2) b[i] = (i * 7) & 0xff
  return b
}

let O: Oracle113c

beforeAll(() => {
  O = getOracle113c()
}, 120_000)

describe('M21-P1 #943 — F4 shared WAV/PCM parser parseWavPcm16 (product)', () => {
  const sameAsOracle = async (id: number): Promise<void> => {
    const parse = await parseWav()
    const o = oracleWavFacts(id)
    const p = parse(oracleWavBytes(id), o.member)
    expect({ channels: p.channels, sampleRate: p.sampleRate, frames: p.frames, dataOffset: p.dataOffset, dataBytes: p.dataBytes }, `row ${String(id)} ${o.member}`).toEqual({
      channels: o.channels,
      sampleRate: o.sampleRate,
      frames: o.frames,
      dataOffset: o.dataOffset,
      dataBytes: o.dataBytes,
    })
  }

  describe('Tier 1 — feature', () => {
    it('[T1-F4-01] parses a mono 1.13c SFX (cursor\\button.wav, row 4) exactly like the independent RIFF walk', async () => {
      await sameAsOracle(4)
    })

    it('[T1-F4-02] parses a stereo ambient loop (row 52 scene_catacombs) exactly', async () => {
      expect(oracleWavFacts(52).channels).toBe(2)
      await sameAsOracle(52)
    })

    it('[T1-F4-03] skips non-fmt/data chunks (rain2.wav row 64 carries a smpl chunk): 51,246 stereo frames', async () => {
      expect(oracleWavFacts(64).frames).toBe(51_246)
      await sameAsOracle(64)
    })

    it('[T1-F4-04] parses a speech line served by d2speech.mpq (row 2961) exactly', async () => {
      expect(oracleWavFacts(2961).archive).toBe('d2speech.mpq')
      await sameAsOracle(2961)
    })

    it('[T1-F4-05] parses a deterministic 60-file sample across SFX / expansion / speech archives exactly', async () => {
      const parse = await parseWav()
      const missing = new Set(O.missingMemberIds)
      const ids: number[] = []
      for (let id = 1; id < 4657 && ids.length < 60; id += 77) {
        let j = id
        while (j < 4657 && (oracleBuildSoundPath(j, O.sounds[j]!.fileName) === null || missing.has(j))) j += 1
        if (j < 4657) ids.push(j)
      }
      expect(ids.length).toBe(60)
      const archives = new Set(ids.map((id) => oracleWavFacts(id).archive))
      expect(archives.size, 'sample spans several archives').toBeGreaterThanOrEqual(3)
      const bad: string[] = []
      for (const id of ids) {
        const o = oracleWavFacts(id)
        const p = parse(oracleWavBytes(id), o.member)
        if (p.frames !== o.frames || p.channels !== o.channels || p.sampleRate !== o.sampleRate || p.dataOffset !== o.dataOffset || p.dataBytes !== o.dataBytes) {
          bad.push(`${String(id)} ${o.member}: product=${JSON.stringify(p)} oracle frames=${String(o.frames)} ch=${String(o.channels)}`)
        }
      }
      expect(bad, summarize(bad)).toEqual([])
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F4-01] rejects a non-RIFF/WAVE file and names the input in the error', async () => {
      const parse = await parseWav()
      expect(() => parse(riff([{ id: 'fmt ', body: fmtBody() }, { id: 'data', body: pcm(4) }], { magic: 'RIFX' }), 'probe-magic.wav')).toThrow(/probe-magic\.wav/)
      expect(() => parse(new Uint8Array(8), 'tiny.wav')).toThrow()
    })

    it('[T2-F4-02] rejects non-PCM format tags (2 = MS-ADPCM, 0x11 = IMA-ADPCM)', async () => {
      const parse = await parseWav()
      for (const tag of [2, 0x11]) {
        expect(() => parse(riff([{ id: 'fmt ', body: fmtBody({ tag }) }, { id: 'data', body: pcm(4) }]), `tag-${String(tag)}.wav`)).toThrow()
      }
    })

    it('[T2-F4-03] rejects 8-bit PCM and 3-channel layouts', async () => {
      const parse = await parseWav()
      expect(() => parse(riff([{ id: 'fmt ', body: fmtBody({ bits: 8 }) }, { id: 'data', body: new Uint8Array(8) }]), 'u8.wav')).toThrow()
      expect(() => parse(riff([{ id: 'fmt ', body: fmtBody({ channels: 3 }) }, { id: 'data', body: pcm(4, 3) }]), 'ch3.wav')).toThrow()
    })

    it('[T2-F4-04] rejects a data chunk that runs past the end of the file and a missing data chunk', async () => {
      const parse = await parseWav()
      expect(() => parse(riff([{ id: 'fmt ', body: fmtBody() }, { id: 'data', body: pcm(4), declaredSize: 4000 }]), 'overrun.wav')).toThrow()
      expect(() => parse(riff([{ id: 'fmt ', body: fmtBody() }]), 'nodata.wav')).toThrow()
    })

    it('[T2-F4-05] rejects a data size that is not a whole number of frames', async () => {
      const parse = await parseWav()
      expect(() => parse(riff([{ id: 'fmt ', body: fmtBody({ channels: 2 }) }, { id: 'data', body: new Uint8Array(6) }]), 'partial.wav')).toThrow()
    })

    it('[T2-F4-06] skips an odd-sized foreign chunk (with RIFF pad byte) before fmt and reports the right data offset', async () => {
      const parse = await parseWav()
      const bytes = riff([{ id: 'LIST', body: new Uint8Array(5) }, { id: 'fmt ', body: fmtBody({ channels: 2 }) }, { id: 'data', body: pcm(10, 2) }])
      const p = parse(bytes, 'odd-list.wav')
      expect(p).toMatchObject({ channels: 2, sampleRate: 22050, frames: 10, dataBytes: 40 })
      expect(p.dataOffset).toBe(12 + 8 + 6 + 8 + 16 + 8)
    })

    it('[T2-F4-07] accepts a Uint8Array view with a non-zero byteOffset (MPQ sector buffers)', async () => {
      const parse = await parseWav()
      const inner = oracleWavBytes(4)
      const big = new Uint8Array(inner.length + 33)
      big.set(inner, 33)
      const view = big.subarray(33)
      const o = oracleWavFacts(4)
      expect(parse(view, 'offset-view.wav')).toMatchObject({ channels: o.channels, frames: o.frames, dataOffset: o.dataOffset })
    })
  })
})

// ── Mirror of the repo with a private copy of src/common/audio (for audit mutation tests) ───────
function mirrorRepo(tamper: (audioDir: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), 'm21r1-audit-mirror-'))
  const link = (src: string, dst: string): void => symlinkSync(src, dst)
  for (const e of readdirSync(REPO_ROOT)) if (e !== 'src') link(join(REPO_ROOT, e), join(root, e))
  mkdirSync(join(root, 'src'))
  for (const e of readdirSync(join(REPO_ROOT, 'src'))) if (e !== 'common') link(join(REPO_ROOT, 'src', e), join(root, 'src', e))
  mkdirSync(join(root, 'src', 'common'))
  for (const e of readdirSync(join(REPO_ROOT, 'src', 'common'))) if (e !== 'audio') link(join(REPO_ROOT, 'src', 'common', e), join(root, 'src', 'common', e))
  const audio = join(root, 'src', 'common', 'audio')
  mkdirSync(audio)
  for (const e of readdirSync(join(REPO_ROOT, 'src', 'common', 'audio'))) copyFileSync(join(REPO_ROOT, 'src', 'common', 'audio', e), join(audio, e))
  tamper(audio)
  return root
}

/** Loads the product audit FIRST (missing module ⇒ test failure), then audits a tampered mirror. */
async function auditOn(tamper: (audioDir: string) => void): Promise<AuditReportC> {
  const run = await runAudit()
  const rootDir = mirrorRepo(tamper)
  try {
    return await run({ rootDir, mpqDir: D2_DATA_DIR, sections: ['tables'] })
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
}

function errorsOf(r: AuditReportC): string {
  return r.sections.flatMap((s) => s.errors.map((e) => `[${s.id}] ${e}`)).join('\n')
}

describe('M21-P1 #943 — F5 npm run verify:audio, shared audit module, bake:verify audio step', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F5-01] package.json wires verify:audio → tools/verify-audio.ts and pack:sound-tables; baker CLI has the sound-tables target', () => {
      const pkg = JSON.parse(readRepoText(PRODUCT.packageJson, F5)) as { scripts: Record<string, string> }
      expect(pkg.scripts['verify:audio'], 'npm run verify:audio').toMatch(/tools\/verify-audio\.ts/)
      expect(pkg.scripts['pack:sound-tables'], 'npm run pack:sound-tables').toMatch(/sound-tables/)
      const cli = readRepoText(PRODUCT.bakerCli, F5)
      expect(cli).toMatch(/['"]sound-tables['"]\s*:\s*['"]src\/baker\/packers\/pack-sound-tables\.ts['"]/)
      expect(cli).not.toMatch(/['"]weather-sounds['"]/)
      readRepoText(PRODUCT.verifyAudioCli, F5)
    })

    it('[T1-F5-02] runAudioAudit({sections:["tables"]}) passes on this tree with a zero-error "tables" section', async () => {
      const run = await runAudit()
      const report = await run({ sections: ['tables'] })
      expect(report.sections.map((s) => s.id)).toContain('tables')
      expect(errorsOf(report)).toBe('')
      expect(report.ok).toBe(true)
    }, 300_000)

    it('[T1-F5-03] the tables audit detects a tampered generated sounds-113c.ts (byte-identical re-bake check)', async () => {
      const clean = await auditOn(() => {})
      expect(clean.ok, `untampered mirror must pass:\n${errorsOf(clean)}`).toBe(true)
      const tampered = await auditOn((dir) => {
        const f = join(dir, 'sounds-113c.ts')
        const src = readFileSync(f, 'utf8')
        const next = src.replace(/thunder_norm_5\.wav/, 'thunder_norm_4.wav')
        if (next === src) throw new Error('mutation anchor not found in sounds-113c.ts')
        writeFileSync(f, next)
      })
      expect(tampered.ok).toBe(false)
      expect(errorsOf(tampered)).toMatch(/sounds-113c/)
    }, 600_000)

    it('[T1-F5-04] npm run verify:audio exits 0 on this tree (the single CLI contract test of the suite)', () => {
      const r = runRepoCommand('npm', ['run', '-s', 'verify:audio'], 1_800_000)
      expect(r.status, tail(r)).toBe(0)
      expect(`${r.stdout}${r.stderr}`.trim().length).toBeGreaterThan(0)
    }, 1_810_000)

    it('[T1-F5-05] bake:verify runs the shared audio audit: runBakerVerify() in src/baker/cli.ts calls runAudioAudit from verify-audio-113c', () => {
      const cli = readRepoText(PRODUCT.bakerCli, F5)
      expect(cli, 'cli.ts imports the shared audit module').toMatch(/import\s*\{[^}]*\brunAudioAudit\b[^}]*\}\s*from\s*['"][^'"]*audit\/verify-audio-113c(\.ts)?['"]/)
      const start = cli.search(/(?:async\s+)?function\s+runBakerVerify\s*\(/)
      expect(start, 'runBakerVerify() exists').toBeGreaterThanOrEqual(0)
      const rest = cli.slice(start)
      const next = rest.slice(1).search(/\n(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/)
      const body = next < 0 ? rest : rest.slice(0, next + 1)
      expect(body, 'runBakerVerify() body calls runAudioAudit(').toMatch(/\brunAudioAudit\s*\(/)
    })
  })

  describe('Tier 2 — boundary & corner cases', () => {
    it('[T2-F5-01] the tables audit detects a tampered level → SoundEnv mapping in sound-environ-113c.ts', async () => {
      const tampered = await auditOn((dir) => {
        const f = join(dir, 'sound-environ-113c.ts')
        const src = readFileSync(f, 'utf8')
        const lvl = O.levels.get(1)!
        const re = new RegExp(`(\\b1\\s*:\\s*)${String(lvl.soundEnv)}\\b`)
        const next = src.replace(re, `$1${String((lvl.soundEnv + 1) % 50)}`)
        if (next === src) throw new Error('mutation anchor (level 1 mapping) not found in sound-environ-113c.ts')
        writeFileSync(f, next)
      })
      expect(tampered.ok).toBe(false)
      expect(errorsOf(tampered)).toMatch(/sound-environ/)
    }, 600_000)

    it('[T2-F5-02] a missing generated table fails the audit (no silent pass)', async () => {
      const run = await runAudit() // a missing audit module must FAIL this test, not count as "audit failed"
      const root = mirrorRepo((dir) => rmSync(join(dir, 'sound-environ-113c.ts')))
      let r: AuditReportC
      try {
        r = await run({ rootDir: root, mpqDir: D2_DATA_DIR, sections: ['tables'] })
      } catch (err) {
        r = { ok: false, sections: [{ id: 'tables', errors: [String(err)], summary: 'threw' }] }
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
      expect(r.ok).toBe(false)
    }, 600_000)

    it('[T2-F5-03] a wrong MPQ directory fails the audit (throws or reports not ok)', async () => {
      const run = await runAudit()
      const bogus = mkdtempSync(join(tmpdir(), 'm21r1-nompq-'))
      try {
        const r = await run({ mpqDir: bogus, sections: ['tables'] }).catch((err: unknown) => ({ ok: false, sections: [], thrown: String(err) }) as AuditReportC)
        expect(r.ok).toBe(false)
      } finally {
        rmSync(bogus, { recursive: true, force: true })
      }
    }, 300_000)

    it('[T2-F5-04] the audit module is baker-side and pure of client code; the CLI is a thin wrapper around it', () => {
      const audit = readRepoText(PRODUCT.audit, F5)
      expect(audit).not.toMatch(/from\s+['"][^'"]*\/client\//)
      expect(audit).toMatch(/export\s+(async\s+)?function\s+runAudioAudit/)
      const cli = readRepoText(PRODUCT.verifyAudioCli, F5)
      expect(cli).toMatch(/runAudioAudit/)
      expect(cli).toMatch(/verify-audio-113c/)
      expect(cli).not.toMatch(/AudioManager|client\/audio\/manager/)
    })

    it('[T2-F5-05] the tables audit detects a tampered post-processed field (nested-leader groupBase quirk of record 134)', async () => {
      const tampered = await auditOn((dir) => {
        const f = join(dir, 'sounds-113c.ts')
        const src = readFileSync(f, 'utf8')
        const o = O.sounds[134]!
        expect(o.groupBase, 'oracle: record 134 keeps the outer leader').toBe(133)
        const re = new RegExp(`(\\[134,"${o.rawSound.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}",)`)
        const at = src.search(re)
        if (at < 0) throw new Error('mutation anchor (record 134 tuple) not found in sounds-113c.ts')
        const lineEnd = src.indexOf('\n', at)
        const line = src.slice(at, lineEnd)
        const mutated = line.replace(/,133,/, ',134,')
        if (mutated === line) throw new Error('record 134 tuple does not carry groupBase 133')
        writeFileSync(f, src.slice(0, at) + mutated + src.slice(lineEnd))
      })
      expect(tampered.ok).toBe(false)
      expect(errorsOf(tampered)).toMatch(/sounds-113c/)
    }, 600_000)
  })
})

// ── F6: green baseline (D17) — the full-suite and typecheck gates verify it directly; here only
// cheap static checks (orchestrator 14:31Z: no nested vitest, no in-test tsc). ───────────────────
const DELETED_AUDIO_MODULES = [
  'client/audio/manager',
  'client/audio/sound-service',
  'client/audio/weather-sound-113c',
  'client/audio/weather-sound-assets',
  'common/audio/weather-sounds-113c',
  'baker/packers/pack-weather-sounds',
]

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(ts|tsx|mts|js)$/.test(e.name)) out.push(p)
  }
  return out
}

describe('M21-P1 #943 — F6 green baseline (static signals; gates run the full suite + typecheck)', () => {
  it('[T1-F6-01] src/netproto/d2gs/s2c/chat.ts no longer imports src/common (the Rule 2 / netproto-boundary violation is fixed in code)', () => {
    const chat = readRepoText('src/netproto/d2gs/s2c/chat.ts', F6)
    expect(chat).not.toMatch(/from\s+['"](\.\.\/)+common\//)
  })

  it('[T1-F6-02] the re-land restores #943 without legacy pieces: no SOUNDS_TXT_BY_ID, no oscillator synthesis, no raw weather WAVs or weather table', async () => {
    await loadProductModule(PRODUCT.records, F6) // the re-land must exist for this guard to be meaningful
    const src = walk(resolve(REPO_ROOT, 'src'))
    const bad: string[] = []
    for (const f of src) {
      const t = readFileSync(f, 'utf8')
      if (/SOUNDS_TXT_BY_ID/.test(t)) bad.push(`${f}: SOUNDS_TXT_BY_ID`)
      if (/createOscillator\s*\(|\bplayTone\b/.test(t)) bad.push(`${f}: oscillator synthesis`)
    }
    expect(bad, summarize(bad)).toEqual([])
    expect(existsSync(resolve(REPO_ROOT, 'src/common/audio/weather-sounds-113c.ts'))).toBe(false)
    expect(existsSync(resolve(REPO_ROOT, 'src/baker/packers/pack-weather-sounds.ts'))).toBe(false)
    expect(existsSync(resolve(REPO_ROOT, 'public/sound/weather'))).toBe(false)
  })

  it('[T1-F6-03] the restored #943 unit test exists and exercises the product record layer (not a test-side engine)', () => {
    const dir = resolve(REPO_ROOT, 'tests/audio')
    const files = readdirSync(dir).filter((f) => f.endsWith('.test.ts')).map((f) => readFileSync(join(dir, f), 'utf8'))
    expect(files.some((t) => /sound-records-113c/.test(t) && /SoundRecords113c/.test(t)), 'a tests/audio/*.test.ts imports the product SoundRecords113c').toBe(true)
    expect(files.some((t) => /OracleSoundRecordsEngine113c/.test(t)), 'no test-side record-layer re-implementation').toBe(false)
  })

  it('[T2-F6-01][G] the boundary tests keep their zero-exception rules and the scene-lighting regression keeps its assertion (fix code, never weaken tests)', () => {
    const arch = readRepoText('tests/arch/boundaries.test.ts', F6)
    const net = readRepoText('tests/netproto/boundary.test.ts', F6)
    expect(arch).not.toMatch(/chat\.ts/)
    expect(net).not.toMatch(/chat\.ts/)
    expect(arch).toMatch(/expect\(violations\)\.toEqual\(\[\]\)/)
    const light = readRepoText('tests/scene-lighting.test.ts', F6)
    expect(light).toMatch(/resolvePlayerLightRadiusBonus\(\)\)\.toBe\(5\)/)
    expect(light).not.toMatch(/\bit\.skip\(|\bdescribe\.skip\(|\bit\.todo\(/)
  })

  it('[T2-F6-02][G] no source, tool or test imports a module deleted by the cleanup (incl. the §A.6 gaps mpq-audio / drop-sfx-parity)', () => {
    const files = [...walk(resolve(REPO_ROOT, 'src')), ...walk(resolve(REPO_ROOT, 'tests')), ...walk(resolve(REPO_ROOT, 'tools'))]
    const bad: string[] = []
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      for (const m of DELETED_AUDIO_MODULES) {
        if (new RegExp(`from\\s+['"][^'"]*${m.replace(/\//g, '\\/')}(\\.ts|\\.js)?['"]`).test(text)) bad.push(`${f.slice(REPO_ROOT.length + 1)} imports ${m}`)
      }
    }
    expect(bad, summarize(bad)).toEqual([])
    for (const f of ['tests/mpq-audio.test.ts', 'tests/drop-sfx-parity.test.ts']) expect(readRepoText(f, F6), f).not.toMatch(/AudioManager/)
  })
})
