/**
 * Static ES-module import graph walker for the K1 kernel replay purity guard.
 *
 * Follows every relative `import ... from '...'`, `export ... from '...'` and `import('...')`
 * specifier (type-only imports included: a type import still couples the replay path to a legacy
 * module's API) starting from one or more entry files, and returns the set of repository-relative
 * files reached. Bare package specifiers (`node:fs`, `vitest`) are recorded separately.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

export interface ImportGraph {
  /** Repository-relative POSIX paths of every reached source file (entries included). */
  readonly files: ReadonlySet<string>
  /** `importer -> imported` edges (repository-relative). */
  readonly edges: ReadonlyArray<readonly [string, string]>
  /** Non-relative specifiers seen (packages, `node:` builtins). */
  readonly packages: ReadonlySet<string>
}

const SPECIFIER_RE =
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm

function stripComments(src: string): string {
  // Block comments, then line comments that start a line or follow whitespace (keeps `://` in strings).
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
}

function resolveSpecifier(fromFile: string, spec: string): string {
  const base = resolve(dirname(fromFile), spec)
  // TS sources may import './x.js' meaning './x.ts'.
  const tsTwin = base.endsWith('.js') ? `${base.slice(0, -3)}.ts` : base
  for (const c of [base, tsTwin, `${base}.ts`, `${base}.mts`, join(base, 'index.ts')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  throw new Error(`import-graph: cannot resolve '${spec}' from ${fromFile}`)
}

export function collectImportGraph(repoRoot: string, entries: readonly string[]): ImportGraph {
  const files = new Set<string>()
  const edges: Array<readonly [string, string]> = []
  const packages = new Set<string>()
  const queue = entries.map((e) => resolve(repoRoot, e))
  const rel = (abs: string): string => relative(repoRoot, abs).split('\\').join('/')
  while (queue.length > 0) {
    const abs = queue.pop() as string
    const r = rel(abs)
    if (files.has(r)) continue
    files.add(r)
    const src = stripComments(readFileSync(abs, 'utf8'))
    for (const m of src.matchAll(SPECIFIER_RE)) {
      const spec = m[1] !== undefined ? m[1] : m[2]
      if (spec === undefined) continue
      if (!spec.startsWith('.')) {
        packages.add(spec)
        continue
      }
      const target = resolveSpecifier(abs, spec)
      edges.push([r, rel(target)])
      queue.push(target)
    }
  }
  return { files, edges, packages }
}

/** Legacy trees the kernel replay path must never reach. */
export const LEGACY_PREFIXES_113C: readonly string[] = ['src/server/', 'src/common/']

/** Files of `graph` under a legacy prefix, each with its shortest importer chain from an entry. */
export function legacyReachable(
  graph: ImportGraph,
  entries: readonly string[],
  prefixes: readonly string[] = LEGACY_PREFIXES_113C,
): string[] {
  const adj = new Map<string, string[]>()
  for (const [from, to] of graph.edges) {
    const list = adj.get(from)
    if (list) list.push(to)
    else adj.set(from, [to])
  }
  const parent = new Map<string, string | null>()
  const queue: string[] = []
  for (const e of entries) {
    const r = e.split('\\').join('/')
    if (!parent.has(r)) {
      parent.set(r, null)
      queue.push(r)
    }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi] as string
    const nexts = adj.get(cur)
    if (nexts === undefined) continue
    for (const next of nexts) {
      if (parent.has(next)) continue
      parent.set(next, cur)
      queue.push(next)
    }
  }
  const out: string[] = []
  for (const f of queue) {
    if (!prefixes.some((p) => f.startsWith(p))) continue
    const chain: string[] = []
    let cur: string | null | undefined = f
    while (typeof cur === 'string') {
      chain.push(cur)
      cur = parent.get(cur)
    }
    out.push(chain.reverse().join(' -> '))
  }
  return out
}
