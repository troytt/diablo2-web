/**
 * CI HARD GATE — the shipped bundle must not be *able* to fetch a game archive.
 *
 * WHY A STRING GREP IS NOT ENOUGH (and what this does instead)
 * ------------------------------------------------------------
 * The obvious gate is "grep `dist-game/` for `d2char.mpq`". That gate is a trap.
 * It proves only that *one particular spelling* is absent, and every one of
 * these evades it while leaving the capability fully intact:
 *
 *     const a = 'd2char' + '.mpq'
 *     const b = `${name}.mpq`
 *     const c = ['d2','char','.mpq'].join('')
 *
 * So the moment someone removes the literal — by an innocent refactor, by a
 * minifier transformation, or by deliberately routing around the gate — it goes
 * green, convincingly, while the bundle can still stream an archive. A false
 * green is worse than no gate, because it terminates scrutiny.
 *
 * This gate therefore asserts a **capability**, not a spelling:
 *
 *   1. CAPABILITY_NOT_REACHABLE  (primary)
 *        Reconstruct the chunk dependency graph from the emitted artifact
 *        itself — follow `import("./x.js")` and `from"./x.js"` out of every
 *        HTML entry — and assert that no reachable chunk contains the
 *        *behavioural* fingerprints of the MPQ machinery: the HTTP-Range
 *        archive reader and the MPQ header decoder. Those fingerprints are
 *        error-message string literals inside the functions themselves, which
 *        survive minification and have nothing to do with any archive filename.
 *        Renaming or concatenating `d2char.mpq` does not move them.
 *
 *   2. NO_ARCHIVE_LITERALS       (secondary, retained)
 *        The original literal scan. Still useful: it catches a new archive name
 *        that no fingerprint covers.
 *
 *   3. FRAGMENT_SCAN             (informational)
 *        Fragmented forms — a bare `.mpq`, a standalone `mpq`/`dll` token —
 *        listed for human review, since a concatenation gate cannot be made
 *        reliable automatically.
 *
 * Both `*.mpq` AND `*.dll` are covered; the acceptance criterion names both.
 *
 * KNOWN-RED ON `main` (2026-09-21) — the expected, desired result
 * ---------------------------------------------------------------
 * `src/scene/act-scene.ts` has an unguarded production path:
 *
 *     loadCharacterArt        L2384
 *       -> getMountedCharArchives  L2013
 *       -> getCachedMpqArchive     L1968
 *       -> httpRangeSource(base + '/d2char.mpq')   L1974
 *
 * Measured consequence in the artifact: `acts-*.js` dynamically imports
 * `source-*.js` (the HTTP-Range reader) and `archive-*.js` (the MPQ decoder),
 * and carries `DATA_ARCHIVES` / `CHARACTER_ARCHIVE` through minification.
 *
 * ⚠ BINDING NOTE FOR THE MILESTONE THAT FIXES THIS (M4):
 * the fix must be **STRUCTURAL** — remove the live-MPQ path from the production
 * entry graph, or isolate it behind a dev-only entry point, so the chunks are
 * not emitted/reachable at all. It must NOT be renaming the constants, and it
 * must NOT be splitting them into concatenation to evade the literal scan.
 * Assertion 1 exists precisely so that evasion cannot produce a green gate.
 *
 * SOURCE MAPS
 * -----------
 * A `.map` embeds `sourcesContent`, i.e. the entire original source text, so a
 * literal survives in the map even after the code using it is perfectly
 * dead-code-eliminated. Hard-failing on maps would make the gate unsatisfiable
 * without deleting the string from the source tree — exactly the pressure that
 * gets a gate weakened instead of a bug fixed. Maps are therefore
 * INFORMATIONAL, and are classified **by content** (parsed as a source map with
 * `version` + `sources`), not by filename, so renaming an executable asset to
 * `*.map` cannot launder it into the exempt bucket.
 *
 * VACUITY GUARD
 * -------------
 * A gate that passes because it examined nothing is the same failure class it
 * is meant to prevent. The run fails unless it actually scanned at least one
 * emitted `.js` asset and resolved at least one HTML entry into a chunk graph.
 *
 * Usage:
 *   npm run verify:bundle-no-mpq
 *   npm run verify:bundle-no-mpq -- --dir=dist-game --report=<path>
 */

import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(process.cwd())

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * Whole archive/library filenames.
 *
 * The named entries mirror `src/scene/act-scene.ts` L80-82 (`DATA_ARCHIVES`,
 * `CHARACTER_ARCHIVE`); the two catch-alls mean a newly introduced archive name
 * cannot slip past just because this list was not updated.
 */
const FORBIDDEN_PATTERNS: readonly { readonly label: string; readonly re: RegExp }[] = [
  { label: 'd2char.mpq', re: /d2char\.mpq/gi },
  { label: 'd2data.mpq', re: /d2data\.mpq/gi },
  { label: 'd2exp.mpq', re: /d2exp\.mpq/gi },
  { label: 'Patch_D2.mpq', re: /patch_d2\.mpq/gi },
  { label: '<any>.mpq', re: /[\w-]+\.mpq/gi },
  { label: '<any>.dll', re: /[\w-]+\.dll/gi },
]

/**
 * Fragmented spellings a literal scan cannot reason about.
 *
 * Reported, never auto-failed: `'mpq'` appears in plenty of innocent contexts
 * (a directory name, a comment that survived, a decoder's own identity string).
 * Automatic failure here would produce noise that trains people to ignore the
 * gate. Assertion 1 is what actually closes the concatenation hole; this exists
 * so a human can see the fragments while reviewing.
 */
const FRAGMENT_PATTERNS: readonly { readonly label: string; readonly re: RegExp }[] = [
  { label: "bare '.mpq'", re: /["'`]\.mpq["'`]/gi },
  { label: "bare '.dll'", re: /["'`]\.dll["'`]/gi },
  { label: "standalone 'mpq' string", re: /["'`]mpq["'`]/gi },
  { label: "standalone 'dll' string", re: /["'`]dll["'`]/gi },
]

/**
 * Behavioural fingerprints of the MPQ machinery.
 *
 * These are error-message literals from inside the functions that implement the
 * capability, so they identify *the code being present*, independent of any
 * archive filename. Verified to survive Vite/esbuild minification in the
 * current build (they live in `source-*.js` and `archive-*.js`).
 */
const CAPABILITY_FINGERPRINTS: readonly {
  readonly id: string
  readonly needle: string
  readonly origin: string
  readonly why: string
}[] = [
  {
    id: 'HTTP_RANGE_ARCHIVE_READER',
    needle: 'range requests are required to read an archive this large',
    origin: 'src/mpq/source.ts httpRangeSource() L107-114',
    why: 'the function that streams an archive over HTTP Range — the actual download capability',
  },
  {
    id: 'MPQ_HEADER_DECODER',
    needle: 'not an MPQ archive (magic 0x',
    origin: 'src/mpq/archive.ts MpqArchive.open() L136',
    why: 'the MPQ container decoder; present only if archive parsing ships',
  },
  {
    id: 'MPQ_HASH_TABLE_DECODER',
    needle: 'is not a non-zero power of two',
    origin: 'src/mpq/archive.ts L156',
    why: 'MPQ hash-table validation; corroborates the decoder fingerprint',
  },
]

/** Extensions considered emitted/executed output. */
const EXECUTABLE_EXT = new Set(['.js', '.mjs', '.cjs', '.html', '.htm', '.css', '.json'])

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

interface Occurrence {
  readonly file: string
  readonly pattern: string
  readonly count: number
  readonly sample: string
}

interface CapabilityHit {
  readonly fingerprintId: string
  readonly file: string
  readonly reachableFrom: readonly string[]
  readonly origin: string
  readonly why: string
}

export interface BundleScanResult {
  readonly root: string
  readonly filesTotal: number
  readonly emittedJsScanned: number
  readonly entries: readonly string[]
  /** entry html -> emitted chunk files reachable from it. */
  readonly reachable: Readonly<Record<string, readonly string[]>>
  readonly orphanChunks: readonly string[]
  readonly capabilityHits: readonly CapabilityHit[]
  readonly literalHard: readonly Occurrence[]
  readonly literalSourceMapOnly: readonly Occurrence[]
  readonly fragments: readonly Occurrence[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/**
 * Decide whether a file is a genuine source map, by parsing it.
 *
 * Extension alone is not enough: a rename must not be able to move an
 * executable asset into the informational bucket.
 */
function isRealSourceMap(text: string): boolean {
  if (text.length === 0 || !text.trimStart().startsWith('{')) return false
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    return (
      typeof parsed['version'] === 'number' &&
      Array.isArray(parsed['sources']) &&
      (parsed['mappings'] !== undefined || parsed['sourcesContent'] !== undefined)
    )
  } catch {
    // Not parseable as JSON, therefore not a source map. This is a
    // classification answer, not a swallowed error: the caller treats the file
    // as emitted output, which is the conservative direction.
    return false
  }
}

function sampleAround(text: string, re: RegExp): string {
  const probe = new RegExp(re.source, re.flags.replace('g', ''))
  const m = probe.exec(text)
  if (m === null) return '(no sample)'
  const from = Math.max(0, m.index - 90)
  const to = Math.min(text.length, m.index + 90)
  return `...${text.slice(from, to).replace(/\s+/g, ' ')}...`
}

/**
 * Rebuild the chunk dependency graph from the artifact.
 *
 * Reading the artifact rather than a build-time manifest matters: it is the
 * thing that actually ships, and it needs no change to `vite.config.ts` (which
 * this milestone does not own). Static `from"./x.js"` / `import"./x.js"` and
 * dynamic `import("./x.js")` are all followed, so a lazily-imported chunk — the
 * exact shape the MPQ fallback uses — is still counted as reachable.
 */
function buildChunkGraph(root: string, files: readonly string[]): {
  entries: string[]
  reachable: Record<string, string[]>
  orphans: string[]
} {
  const rel = (f: string): string => relative(root, f).split('\\').join('/')
  const byRel = new Map<string, string>()
  for (const f of files) byRel.set(rel(f), f)

  const htmlEntries = files.filter(f => f.toLowerCase().endsWith('.html')).map(rel)

  const refsOf = (relPath: string): string[] => {
    const abs = byRel.get(relPath)
    if (abs === undefined) return []
    let text: string
    try {
      text = readFileSync(abs, 'utf8')
    } catch {
      return []
    }
    const out = new Set<string>()
    const dir = dirname(relPath)
    const add = (spec: string): void => {
      const joined = spec.startsWith('/')
        ? spec.replace(/^\/diablo2\//, '').replace(/^\//, '')
        : join(dir, spec).split('\\').join('/')
      if (byRel.has(joined)) out.add(joined)
    }
    // HTML: <script src=...> and <link href=...>
    for (const m of text.matchAll(/(?:src|href)=["']([^"']+\.(?:js|mjs|css))["']/g)) add(m[1] ?? '')
    // JS: static and dynamic module specifiers.
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+\.(?:js|mjs))["']/g)) add(m[1] ?? '')
    return [...out]
  }

  const reachable: Record<string, string[]> = {}
  const everReached = new Set<string>()
  for (const entry of htmlEntries) {
    const seen = new Set<string>()
    const stack = [entry]
    while (stack.length > 0) {
      const cur = stack.pop()
      if (cur === undefined || seen.has(cur)) continue
      seen.add(cur)
      everReached.add(cur)
      for (const next of refsOf(cur)) if (!seen.has(next)) stack.push(next)
    }
    seen.delete(entry)
    reachable[entry] = [...seen].sort()
  }

  const orphans = files
    .map(rel)
    .filter(f => /\.(js|mjs)$/i.test(f) && !everReached.has(f))
    .sort()

  return { entries: htmlEntries.sort(), reachable, orphans }
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

/** Scan a built output directory. Exported so a unit test can drive it. */
export function scanBundle(root: string): BundleScanResult {
  const files = walk(root)
  const { entries, reachable, orphans } = buildChunkGraph(root, files)

  const literalHard: Occurrence[] = []
  const literalSourceMapOnly: Occurrence[] = []
  const fragments: Occurrence[] = []
  const capabilityHits: CapabilityHit[] = []
  let emittedJsScanned = 0

  const relOf = (f: string): string => relative(root, f).split('\\').join('/')
  const entriesReaching = (chunk: string): string[] =>
    entries.filter(e => (reachable[e] ?? []).includes(chunk))

  for (const file of files) {
    const ext = extname(file).toLowerCase()
    const looksLikeMap = file.toLowerCase().endsWith('.map')
    if (!looksLikeMap && !EXECUTABLE_EXT.has(ext)) continue

    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch (err) {
      // An unreadable file inside the shipped output must not be skipped, or
      // the gate reports green over a directory it never actually read.
      throw new Error(`verify-bundle-no-mpq: cannot read shipped asset ${file}: ${String(err)}`)
    }

    // Classify by content, not by name.
    const isMap = looksLikeMap && isRealSourceMap(text)
    const relPath = relOf(file)
    if (!isMap && /\.(js|mjs|cjs)$/i.test(relPath)) emittedJsScanned += 1

    for (const { label, re } of FORBIDDEN_PATTERNS) {
      const matches = text.match(new RegExp(re.source, re.flags))
      if (matches === null || matches.length === 0) continue
      const occ: Occurrence = { file: relPath, pattern: label, count: matches.length, sample: sampleAround(text, re) }
      if (isMap) literalSourceMapOnly.push(occ)
      else literalHard.push(occ)
    }

    if (!isMap) {
      for (const { label, re } of FRAGMENT_PATTERNS) {
        const matches = text.match(new RegExp(re.source, re.flags))
        if (matches === null || matches.length === 0) continue
        fragments.push({ file: relPath, pattern: label, count: matches.length, sample: sampleAround(text, re) })
      }
      for (const fp of CAPABILITY_FINGERPRINTS) {
        if (!text.includes(fp.needle)) continue
        capabilityHits.push({
          fingerprintId: fp.id,
          file: relPath,
          reachableFrom: entriesReaching(relPath),
          origin: fp.origin,
          why: fp.why,
        })
      }
    }
  }

  return {
    root,
    filesTotal: files.length,
    emittedJsScanned,
    entries,
    reachable,
    orphanChunks: orphans,
    capabilityHits,
    literalHard,
    literalSourceMapOnly,
    fragments,
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function assertWritablePath(candidate: string): string {
  const full = resolve(candidate)
  const rel = relative(ROOT, full)
  if (rel.startsWith('..') || resolve(rel) === rel) {
    throw new Error(`verify-bundle-no-mpq: refusing to write outside the worktree: ${full}`)
  }
  return full
}

function main(): void {
  let dir = 'dist-game'
  let reportPath = join(ROOT, '.agents', 'worker_mv', 'evidence', 'bundle-gate-report.json')
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--dir=')) dir = arg.slice('--dir='.length)
    else if (arg.startsWith('--report=')) reportPath = resolve(arg.slice('--report='.length))
    else if (!arg.startsWith('--')) dir = arg
  }
  const root = resolve(ROOT, dir)

  console.log('======================================================================')
  console.log('GATE: shipped bundle must not be ABLE to fetch a game archive')
  console.log('      (capability assertion + literal scan; covers *.mpq AND *.dll)')
  console.log('======================================================================')
  console.log(`Scanning: ${root}`)

  let stat
  try {
    stat = statSync(root)
  } catch {
    console.error(`\nFAIL: output directory does not exist: ${root}`)
    console.error('      Build it first:  npm run build:game')
    process.exit(1)
  }
  if (!stat.isDirectory()) {
    console.error(`\nFAIL: not a directory: ${root}`)
    process.exit(1)
  }

  const r = scanBundle(root)

  console.log(`Files present     : ${r.filesTotal}`)
  console.log(`Emitted .js scanned: ${r.emittedJsScanned}`)
  console.log(`HTML entries      : ${r.entries.join(', ') || '(none)'}`)
  for (const e of r.entries) console.log(`   ${e} -> ${(r.reachable[e] ?? []).length} reachable chunk(s)`)
  if (r.orphanChunks.length > 0) {
    console.log(`Orphan chunks (emitted but unreachable from any entry): ${r.orphanChunks.join(', ')}`)
  }

  const failures: string[] = []

  // --- Guard: the scan must have actually examined something ---------------
  if (r.emittedJsScanned === 0) {
    failures.push('VACUITY: zero emitted .js assets were scanned — the gate examined nothing.')
  }
  if (r.entries.length === 0) {
    failures.push('VACUITY: no HTML entry found — the chunk reachability graph is empty.')
  }
  const totalReachable = r.entries.reduce((n, e) => n + (r.reachable[e] ?? []).length, 0)
  if (r.entries.length > 0 && totalReachable === 0) {
    failures.push('VACUITY: entries resolved to zero chunks — module-reference parsing is broken.')
  }

  // --- 1. Capability ------------------------------------------------------
  console.log('\n--- 1. CAPABILITY_NOT_REACHABLE (primary)')
  const reachableHits = r.capabilityHits.filter(h => h.reachableFrom.length > 0)
  const unreachableHits = r.capabilityHits.filter(h => h.reachableFrom.length === 0)
  if (r.capabilityHits.length === 0) {
    console.log('    PASS: none of the MPQ capability fingerprints appear in any emitted asset.')
  } else {
    for (const h of reachableHits) {
      console.error(`    HIT  ${h.fingerprintId} in ${h.file}`)
      console.error(`         origin      : ${h.origin}`)
      console.error(`         why it matters: ${h.why}`)
      console.error(`         reachable from: ${h.reachableFrom.join(', ')}`)
    }
    for (const h of unreachableHits) {
      console.log(`    INFO ${h.fingerprintId} in ${h.file} — present but unreachable from any entry (dead chunk).`)
    }
  }
  if (reachableHits.length > 0) {
    failures.push(
      `CAPABILITY: ${reachableHits.length} MPQ fingerprint(s) reachable from a shipped entry — ` +
        'the bundle can stream a game archive regardless of how the filename is spelled.',
    )
  }

  // --- 2. Literals --------------------------------------------------------
  console.log('\n--- 2. NO_ARCHIVE_LITERALS (secondary)')
  if (r.literalSourceMapOnly.length > 0) {
    console.log(`    INFO: ${r.literalSourceMapOnly.length} occurrence group(s) in genuine source maps.`)
    console.log('          A .map embeds the full original source (`sourcesContent`), so a string')
    console.log('          survives there even after its code is eliminated. Classified by parsing')
    console.log('          the file as a source map, not by its extension. Not a failure.')
    for (const o of r.literalSourceMapOnly) console.log(`          - ${o.file}: ${o.pattern} x${o.count}`)
  }
  if (r.literalHard.length === 0) {
    console.log('    PASS: zero *.mpq / *.dll literals in emitted executable assets.')
  } else {
    console.error(`    FAIL: ${r.literalHard.length} occurrence group(s) in EMITTED assets:`)
    for (const o of r.literalHard) {
      console.error(`      ${o.file}`)
      console.error(`          pattern : ${o.pattern}`)
      console.error(`          count   : ${o.count}`)
      console.error(`          context : ${o.sample}`)
    }
    failures.push(`LITERALS: ${r.literalHard.length} archive-name literal group(s) in emitted assets.`)
  }

  // --- 3. Fragments (informational) ---------------------------------------
  console.log('\n--- 3. FRAGMENT_SCAN (informational — concatenation cannot be auto-judged)')
  if (r.fragments.length === 0) {
    console.log('    none')
  } else {
    for (const o of r.fragments) console.log(`    ${o.file}: ${o.pattern} x${o.count}`)
    console.log('    Review these by hand: a fragment is how a literal scan gets evaded.')
    console.log('    Assertion 1 is what actually closes that hole.')
  }

  // --- Report -------------------------------------------------------------
  const outPath = assertWritablePath(reportPath)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        root: relative(ROOT, root),
        filesTotal: r.filesTotal,
        emittedJsScanned: r.emittedJsScanned,
        entries: r.entries,
        reachable: r.reachable,
        orphanChunks: r.orphanChunks,
        capabilityHits: r.capabilityHits,
        literalHard: r.literalHard,
        // Surfaced in the report, not only the console, so the sourcemap
        // exemption is a visible accepted state rather than a silent one.
        literalSourceMapOnly: r.literalSourceMapOnly,
        fragments: r.fragments,
        failures,
        verdict: failures.length === 0 ? 'PASS' : 'FAIL',
      },
      null,
      2,
    ),
  )
  console.log(`\nReport: ${relative(ROOT, outPath)}`)

  console.log('\n======================================================================')
  if (failures.length === 0) {
    console.log('PASS: the shipped bundle cannot fetch a game archive.')
    process.exit(0)
  }
  console.error(`FAIL (${failures.length}):`)
  for (const f of failures) console.error(`  - ${f}`)
  console.error('')
  console.error('  Root cause on main (2026-09-21): unguarded tier-3 fallback')
  console.error('    act-scene.ts loadCharacterArt L2384 -> getMountedCharArchives L2013')
  console.error('    -> getCachedMpqArchive L1968 -> httpRangeSource(base + "/d2char.mpq") L1974')
  console.error('')
  console.error('  THE FIX MUST BE STRUCTURAL: remove the live-MPQ path from the production')
  console.error('  entry graph (or isolate it behind a dev-only entry) so the chunks are not')
  console.error('  reachable. Renaming the constants, or splitting them into concatenation to')
  console.error('  evade the literal scan, will NOT satisfy assertion 1 and will be ruled a')
  console.error('  failure. Do not weaken this gate.')
  process.exit(1)
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
