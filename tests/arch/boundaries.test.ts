import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import viteConfig from '../../vite.config.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '../..')
const SRC_DIR = resolve(ROOT_DIR, 'src')
const PLUGINS_DIR = resolve(ROOT_DIR, 'plugins')
const TOOLS_DIR = resolve(ROOT_DIR, 'tools')

const CANONICAL_MODULES = ['baker', 'client', 'common', 'netproto', 'server'] as const
const LEGACY_HTML_FILES = ['acts.html', 'acts-zh.html', 'acts-en.html', 'bnet.html', 'stats.html'] as const
const RETIRED_SERVER_SUBPATHS = [
  'engine/engine.ts',
  'engine/combat.ts',
  'scene/skill-caster.ts',
  'scene/weapon-combat.ts',
  'scene',
] as const

const ALLOWED_MODULE_TARGETS: Record<string, ReadonlySet<string>> = {
  common: new Set(['common']),
  netproto: new Set(['netproto']),
  server: new Set(['common', 'netproto', 'server']),
  client: new Set(['common', 'netproto', 'client']),
  baker: new Set(['common', 'baker']),
}

function collectTsFiles(dir: string): string[] {
  const results: string[] = []
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const name of entries) {
    const full = resolve(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      results.push(...collectTsFiles(full))
    } else if (name.endsWith('.ts')) {
      results.push(full)
    }
  }
  return results
}

function collectAllFiles(dir: string): string[] {
  const results: string[] = []
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const name of entries) {
    const full = resolve(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      results.push(...collectAllFiles(full))
    } else {
      results.push(full)
    }
  }
  return results
}

function listPluginIds(): string[] {
  if (!existsSync(PLUGINS_DIR)) return []
  return readdirSync(PLUGINS_DIR)
    .filter((name) => statSync(resolve(PLUGINS_DIR, name)).isDirectory())
    .sort()
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '')
}

function stripCommentsAndStrings(source: string): string {
  return stripComments(source).replace(
    /"(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*'/g,
    '""',
  )
}

function extractImportSpecifiers(source: string): string[] {
  const stripped = stripComments(source)
  const specs: string[] = []
  const fromRe = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g
  const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(stripped)) !== null) {
    if (m[1]) specs.push(m[1])
  }
  while ((m = dynRe.exec(stripped)) !== null) {
    if (m[1]) specs.push(m[1])
  }
  return specs
}

function checkNoDynamicImportBypasses(files: readonly string[]): string[] {
  const dynamicViolations: string[] = []
  for (const file of files) {
    const relFile = relative(ROOT_DIR, file).replace(/\\/g, '/')
    const text = readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const arg = node.arguments[0]
        if (!arg || !ts.isStringLiteral(arg)) {
          dynamicViolations.push(`${relFile}: non-literal dynamic import(${arg?.getText(sf) ?? ''})`)
        }
      }
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'Function'
      ) {
        const callText = node.getText(sf)
        if (callText.includes('import(')) {
          dynamicViolations.push(`${relFile}: new Function dynamic import bypass (${callText})`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return dynamicViolations
}

describe('Architectural Boundaries & 5-Module + Plugin Isolation (Rules 1–10 — Zero Whitelist Exceptions)', () => {
  it('Rule 1: src/ contains ONLY the 5 canonical module directories (common, netproto, server, client, baker)', () => {
    const entries = readdirSync(SRC_DIR).sort()
    expect(entries).toEqual([...CANONICAL_MODULES].sort())
    for (const entry of entries) {
      expect(statSync(resolve(SRC_DIR, entry)).isDirectory()).toBe(true)
    }
  })

  it('Rule 2: enforces strict acyclic module dependency DAG across common, netproto, server, client, and baker (0 exceptions)', () => {
    const violations: string[] = []
    for (const modName of CANONICAL_MODULES) {
      const files = collectTsFiles(resolve(SRC_DIR, modName))
      expect(files.length).toBeGreaterThan(0)
      for (const file of files) {
        const relFile = relative(ROOT_DIR, file)
        const specs = extractImportSpecifiers(readFileSync(file, 'utf8'))
        for (const spec of specs) {
          if (!spec.startsWith('.')) continue
          const targetAbs = resolve(dirname(file), spec)
          const targetRel = relative(ROOT_DIR, targetAbs).replace(/\\/g, '/')
          if (targetRel.startsWith('src/')) {
            const targetMod = targetRel.split('/')[1] ?? ''
            if (!ALLOWED_MODULE_TARGETS[modName]?.has(targetMod)) {
              violations.push(`${relFile} (${modName}) -> ${targetRel} (${targetMod})`)
            }
          } else {
            violations.push(`${relFile} (${modName}) imports outside src/: ${targetRel}`)
          }
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('Rule 3: common, netproto, server, and client never import node:* builtins or Node globals (0 exceptions)', () => {
    const browserAndSimModules = ['common', 'netproto', 'server', 'client'] as const
    const violations: string[] = []
    for (const modName of browserAndSimModules) {
      for (const file of collectTsFiles(resolve(SRC_DIR, modName))) {
        const relFile = relative(ROOT_DIR, file)
        const source = readFileSync(file, 'utf8')
        for (const spec of extractImportSpecifiers(source)) {
          if (spec.startsWith('node:') || spec === 'fs' || spec === 'path' || spec === 'child_process') {
            violations.push(`${relFile}: forbidden Node import '${spec}'`)
          }
        }
        const stripped = stripComments(source)
        if (/\bnode:(?:fs|path|url|crypto|zlib|child_process|net|os|http|https)\b/.test(stripped)) {
          violations.push(`${relFile}: contains node:* string literal`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('Rule 4: common, netproto, and server are strictly deterministic (zero Math.random, Date.now, performance.now) and zero DOM globals (0 exceptions)', () => {
    const pureModules = ['common', 'netproto', 'server'] as const
    const violations: string[] = []
    for (const modName of pureModules) {
      for (const file of collectTsFiles(resolve(SRC_DIR, modName))) {
        const relFile = relative(ROOT_DIR, file)
        const stripped = stripCommentsAndStrings(readFileSync(file, 'utf8'))
        if (/\bMath\.random\s*\(/.test(stripped)) {
          violations.push(`${relFile}: forbidden Math.random()`)
        }
        if (modName !== 'netproto' && /\b(?:Date\.now|performance\.now)\s*\(/.test(stripped)) {
          violations.push(`${relFile}: forbidden wall-clock call Date.now()/performance.now()`)
        }
        if (
          /\b(?:window|document|localStorage|HTMLCanvasElement|WebGL2RenderingContext|WebGLRenderingContext|AudioContext)\b/.test(stripped)
        ) {
          violations.push(`${relFile}: forbidden DOM global reference`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('Rule 5: baker never references DOM globals and never imports client, server, or netproto (0 exceptions)', () => {
    const violations: string[] = []
    for (const file of collectTsFiles(resolve(SRC_DIR, 'baker'))) {
      const relFile = relative(ROOT_DIR, file)
      const stripped = stripCommentsAndStrings(readFileSync(file, 'utf8'))
      if (/\b(?:window|document|localStorage|HTMLCanvasElement|WebGL2RenderingContext|AudioContext)\b/.test(stripped)) {
        violations.push(`${relFile}: forbidden DOM global in baker`)
      }
    }
    expect(violations).toEqual([])
  })

  it('Rule 6: every import from src/{common,server,client,baker}/** and tools/** into src/netproto/ resolves specifically to src/netproto/index.ts', () => {
    const netprotoDir = resolve(SRC_DIR, 'netproto')
    const netprotoIndex = resolve(netprotoDir, 'index.ts')
    const violations: string[] = []
    const filesToCheck = [
      ...(['common', 'server', 'client', 'baker'] as const).flatMap((m) =>
        collectTsFiles(resolve(SRC_DIR, m)),
      ),
      ...collectTsFiles(TOOLS_DIR),
    ]
    for (const file of filesToCheck) {
      const relFile = relative(ROOT_DIR, file)
      for (const spec of extractImportSpecifiers(readFileSync(file, 'utf8'))) {
        if (!spec.startsWith('.')) continue
        const target = resolve(dirname(file), spec)
        if (target === netprotoDir || target.startsWith(netprotoDir + '/')) {
          const resolvedTarget = target.endsWith('.ts') ? target : `${target}.ts`
          if (resolvedTarget !== netprotoIndex && target !== netprotoDir) {
            violations.push(`${relFile}: imports netproto internal '${spec}' (must import src/netproto/index.ts)`)
          }
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('Rule 7: root HTML entry files are solely index.html (Sanctuary homepage) and play.html (game client composing /src/client/main.ts + /plugins/index.ts), and all 5 legacy prototype HTML files remain deleted', () => {
    const rootHtmlFiles = readdirSync(ROOT_DIR)
      .filter((f) => f.endsWith('.html'))
      .sort()
    expect(rootHtmlFiles).toEqual(['index.html', 'play.html'])
    expect(existsSync(resolve(ROOT_DIR, 'public/home.html'))).toBe(false)

    // 1. index.html is the lightweight Sanctuary Web Portal homepage (no WebGL game engine imports)
    const indexHtml = readFileSync(resolve(ROOT_DIR, 'index.html'), 'utf8')
    expect(indexHtml).toContain('D2Exocet')
    expect(indexHtml).toContain('D2Formal436')
    expect(indexHtml).toContain('href="/play.html"')
    expect(indexHtml).toContain('href="/musicbox.html"')
    expect(indexHtml).not.toContain('/src/client/main.ts')
    expect(indexHtml).not.toContain('/plugins/index.ts')

    // 2. play.html is the game client entry composing /src/client/main.ts and /plugins/index.ts
    expect(existsSync(resolve(ROOT_DIR, 'play.html'))).toBe(true)
    const playHtml = readFileSync(resolve(ROOT_DIR, 'play.html'), 'utf8')
    expect(playHtml).toContain('/src/client/main.ts')
    expect(playHtml).toContain('/plugins/index.ts')
    expect(playHtml).toContain('D2Exocet')
    expect(playHtml).toContain('D2Formal436')

    const moduleScriptBlocks = [...playHtml.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => m[1] ?? '')
    const inlineImports = moduleScriptBlocks.flatMap((block) => extractImportSpecifiers(block))
    expect(inlineImports).toEqual(['/src/client/main.ts', '/plugins/index.ts'])

    const viteCfg = readFileSync(resolve(ROOT_DIR, 'vite.config.ts'), 'utf8')
    expect(viteCfg).toContain('index.html')
    expect(viteCfg).toContain('play.html')

    for (const legacyHtml of LEGACY_HTML_FILES) {
      expect(existsSync(resolve(ROOT_DIR, legacyHtml))).toBe(false)
      expect(viteCfg).not.toContain(legacyHtml)
    }
  })

  it('Rule 8: src/** contains zero .test.ts/.spec.ts files, zero non-literal dynamic import(...) calls, and zero new Function("...import(...") bypasses', () => {
    const allSrcFiles = collectTsFiles(SRC_DIR)
    const testFilesInSrc = allSrcFiles
      .map((f) => relative(ROOT_DIR, f))
      .filter((f) => f.endsWith('.test.ts') || f.endsWith('.spec.ts') || f.includes('__tests__'))
    expect(testFilesInSrc).toEqual([])

    expect(checkNoDynamicImportBypasses(allSrcFiles)).toEqual([])
  })

  it('Rule 9: plugins/ isolation & core agnosticism (strict import whitelist, zero node:*/tests/dynamic-import in plugins/**, zero plugins/ or kill-stats references in src/**)', () => {
    const pluginIds = listPluginIds()
    expect(pluginIds.length).toBeGreaterThan(0)
    expect(pluginIds).toContain('kill-stats')

    const pluginsIndexFile = resolve(PLUGINS_DIR, 'index.ts')
    expect(existsSync(pluginsIndexFile)).toBe(true)

    const importViolations: string[] = []

    // 1. plugins/index.ts may only import ./<id>/index.ts and src/client/plugin-host/api.ts
    const allowedIndexTargets = new Set<string>([
      'src/client/plugin-host/api.ts',
      ...pluginIds.map((id) => `plugins/${id}/index.ts`),
    ])
    for (const spec of extractImportSpecifiers(readFileSync(pluginsIndexFile, 'utf8'))) {
      if (!spec.startsWith('.')) {
        importViolations.push(`plugins/index.ts: non-relative import '${spec}'`)
        continue
      }
      const targetAbs = resolve(PLUGINS_DIR, spec)
      const targetRel = relative(ROOT_DIR, targetAbs).replace(/\\/g, '/')
      const resolvedRel = targetRel.endsWith('.ts') ? targetRel : `${targetRel}.ts`
      if (!allowedIndexTargets.has(resolvedRel)) {
        importViolations.push(
          `plugins/index.ts: forbidden import '${spec}' -> '${resolvedRel}' (allowed: ./<id>/index.ts or src/client/plugin-host/api.ts)`,
        )
      }
    }

    // 2. plugins/<id>/** may only import within plugins/<id>/**, src/common/**, src/netproto/index.ts, and src/client/plugin-host/api.ts
    for (const pluginId of pluginIds) {
      const pluginDir = resolve(PLUGINS_DIR, pluginId)
      const pluginTsFiles = collectTsFiles(pluginDir)
      expect(pluginTsFiles.length, `plugins/${pluginId} must contain .ts files`).toBeGreaterThan(0)

      for (const file of pluginTsFiles) {
        const relFile = relative(ROOT_DIR, file).replace(/\\/g, '/')
        for (const spec of extractImportSpecifiers(readFileSync(file, 'utf8'))) {
          if (!spec.startsWith('.')) {
            importViolations.push(`${relFile}: non-relative or package import '${spec}'`)
            continue
          }
          const targetAbs = resolve(dirname(file), spec)
          const targetRel = relative(ROOT_DIR, targetAbs).replace(/\\/g, '/')
          const resolvedRel = targetRel.endsWith('.ts') ? targetRel : `${targetRel}.ts`

          const isSamePlugin = resolvedRel.startsWith(`plugins/${pluginId}/`)
          const isCommon = resolvedRel.startsWith('src/common/')
          const isNetprotoIndex = resolvedRel === 'src/netproto/index.ts'
          const isPluginHostApi = resolvedRel === 'src/client/plugin-host/api.ts'

          if (!isSamePlugin && !isCommon && !isNetprotoIndex && !isPluginHostApi) {
            importViolations.push(`${relFile}: forbidden import '${spec}' -> '${resolvedRel}'`)
          }
        }
      }
    }
    expect(importViolations).toEqual([])

    // 3. plugins/** contains zero node:* imports, zero .test.ts/.spec.ts files, and zero non-literal dynamic import(...) calls
    const allPluginFiles = collectAllFiles(PLUGINS_DIR)
    const testFilesInPlugins = allPluginFiles
      .map((f) => relative(ROOT_DIR, f).replace(/\\/g, '/'))
      .filter((f) => f.endsWith('.test.ts') || f.endsWith('.spec.ts') || f.includes('__tests__'))
    expect(testFilesInPlugins).toEqual([])

    const allPluginTsFiles = collectTsFiles(PLUGINS_DIR)
    const nodeViolations: string[] = []
    for (const file of allPluginTsFiles) {
      const relFile = relative(ROOT_DIR, file).replace(/\\/g, '/')
      const source = readFileSync(file, 'utf8')
      for (const spec of extractImportSpecifiers(source)) {
        if (
          spec.startsWith('node:') ||
          spec === 'fs' ||
          spec === 'path' ||
          spec === 'child_process' ||
          spec === 'url' ||
          spec === 'crypto'
        ) {
          nodeViolations.push(`${relFile}: forbidden Node import '${spec}'`)
        }
      }
      const stripped = stripComments(source)
      if (/\bnode:(?:fs|path|url|crypto|zlib|child_process|net|os|http|https)\b/.test(stripped)) {
        nodeViolations.push(`${relFile}: contains node:* string literal`)
      }
      if (stripped.includes('d2web.settings.v1')) {
        nodeViolations.push(
          `${relFile}: forbidden direct access to 'd2web.settings.v1' (use ctx.lang or bootPluginPage instead)`,
        )
      }
    }
    expect(nodeViolations).toEqual([])
    expect(checkNoDynamicImportBypasses(allPluginTsFiles)).toEqual([])

    // 4. src/** contains zero imports or string literal references to plugins/ or 'kill-stats' (or any specific plugin ID)
    const pluginIdSet = new Set(pluginIds)
    const coreAgnosticismViolations: string[] = []
    for (const file of collectTsFiles(SRC_DIR)) {
      const relFile = relative(ROOT_DIR, file).replace(/\\/g, '/')
      const text = readFileSync(file, 'utf8')
      for (const spec of extractImportSpecifiers(text)) {
        if (spec.includes('plugins') || spec.includes('kill-stats')) {
          coreAgnosticismViolations.push(`${relFile}: forbidden import specifier '${spec}'`)
        }
      }
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
      const checkLiteral = (val: string) => {
        if (val.includes('plugins/') || val.includes('kill-stats') || pluginIdSet.has(val)) {
          coreAgnosticismViolations.push(
            `${relFile}: forbidden plugin reference in string literal ${JSON.stringify(val)}`,
          )
        }
      }
      const visit = (node: ts.Node) => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          checkLiteral(node.text)
        } else if (ts.isTemplateExpression(node)) {
          checkLiteral(node.head.text)
          for (const span of node.templateSpans) {
            checkLiteral(span.literal.text)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
    expect(coreAgnosticismViolations).toEqual([])
  })

  it('Rule 10: every plugins/<id>/index.html declares local D2Exocet & D2Formal436 @font-face rules, contains zero http(s):// URLs, references only /plugins/<id>/... module scripts, and is auto-included in vite.config.ts build inputs', () => {
    const pluginIds = listPluginIds()
    const rawInput = (viteConfig.build?.rollupOptions?.input ?? {}) as Record<string, string>
    expect(rawInput.index).toBe(resolve(ROOT_DIR, 'index.html'))
    expect(rawInput.play).toBe(resolve(ROOT_DIR, 'play.html'))
    expect('stats' in rawInput).toBe(false)

    const discoveredHtmlPages: string[] = []
    for (const pluginId of pluginIds) {
      const htmlPath = resolve(PLUGINS_DIR, pluginId, 'index.html')
      if (!existsSync(htmlPath)) continue
      discoveredHtmlPages.push(pluginId)

      const relHtml = relative(ROOT_DIR, htmlPath).replace(/\\/g, '/')
      const html = readFileSync(htmlPath, 'utf8')

      // Local D2Exocet & D2Formal436 @font-face declarations
      expect(html, `${relHtml} must declare D2Exocet @font-face`).toMatch(
        /font-family:\s*['"]D2Exocet['"]/,
      )
      expect(html, `${relHtml} must reference /ui/fonts/D2Exocet.ttf`).toMatch(
        /url\(['"]\/ui\/fonts\/D2Exocet\.ttf['"]\)/,
      )
      expect(html, `${relHtml} must declare D2Formal436 @font-face`).toMatch(
        /font-family:\s*['"]D2Formal436['"]/,
      )
      expect(html, `${relHtml} must reference /ui/fonts/D2Formal436\.ttf`).toMatch(
        /url\(['"]\/ui\/fonts\/D2Formal436\.ttf['"]\)/,
      )

      // Zero external http:// or https:// URLs
      expect(html, `${relHtml} must not contain http://`).not.toContain('http://')
      expect(html, `${relHtml} must not contain https://`).not.toContain('https://')

      // References only /plugins/<id>/... module scripts
      const scriptTags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      expect(scriptTags.length, `${relHtml} must contain at least one <script> tag`).toBeGreaterThan(0)
      for (const [, attrs = '', body = ''] of scriptTags) {
        expect(attrs, `${relHtml} script must be type="module"`).toMatch(/\btype=["']module["']/)
        const srcMatch = /\bsrc=["']([^"']+)["']/.exec(attrs)
        expect(srcMatch, `${relHtml} module script must have a src attribute`).not.toBeNull()
        const srcAttr = srcMatch![1]!
        expect(
          srcAttr.startsWith(`/plugins/${pluginId}/`),
          `${relHtml} script src '${srcAttr}' must start with '/plugins/${pluginId}/'`,
        ).toBe(true)
        expect(
          existsSync(resolve(ROOT_DIR, srcAttr.slice(1))),
          `${relHtml} script target '${srcAttr}' must exist on disk`,
        ).toBe(true)
        expect(body.trim(), `${relHtml} external module script must have empty body`).toBe('')
      }

      // Automatically included in vite.config.ts rollupOptions.input as plugin-<id>
      expect(rawInput[`plugin-${pluginId}`]).toBe(htmlPath)
    }

    expect(discoveredHtmlPages.length).toBeGreaterThan(0)
    expect(discoveredHtmlPages).toContain('kill-stats')
  })

  it('Rule 11: legacy split-track prototype files (engine/engine.ts, engine/combat.ts, scene/skill-caster.ts, scene/weapon-combat.ts) and src/server/scene/ remain permanently deleted', () => {
    for (const subpath of RETIRED_SERVER_SUBPATHS) {
      const targetPath = resolve(SRC_DIR, 'server', subpath)
      expect(existsSync(targetPath), `src/server/${subpath} must remain deleted`).toBe(false)
      expect(existsSync(`${targetPath}.bak`)).toBe(false)
      expect(existsSync(`${targetPath}.old`)).toBe(false)
    }
  })
})

