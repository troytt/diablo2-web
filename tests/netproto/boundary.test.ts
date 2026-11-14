import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '../..')
const SRC_DIR = resolve(ROOT_DIR, 'src')
const NETPROTO_DIR = resolve(SRC_DIR, 'netproto')

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

function extractImportSpecifiers(source: string): string[] {
  const specs: string[] = []
  // Match static import/export ... from '...' and dynamic import('...')
  const fromRe = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g
  const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(source)) !== null) {
    if (m[1]) specs.push(m[1])
  }
  while ((m = dynRe.exec(source)) !== null) {
    if (m[1]) specs.push(m[1])
  }
  return specs
}

describe('src/netproto architectural boundary enforcement (F1)', () => {
  it('configures tsconfig.netproto.json with ES2022 lib and empty types', () => {
    const tsconfigPath = resolve(ROOT_DIR, 'tsconfig.netproto.json')
    const cfg = JSON.parse(readFileSync(tsconfigPath, 'utf8'))
    expect(cfg.compilerOptions.lib).toEqual(['ES2022'])
    expect(cfg.compilerOptions.types).toEqual([])
    expect(cfg.include).toContain('src/netproto/**/*.ts')
  })

  it('ensures src/netproto/** never imports files outside src/netproto/**', () => {
    const netprotoFiles = collectTsFiles(NETPROTO_DIR)
    expect(netprotoFiles.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const file of netprotoFiles) {
      const relFile = relative(ROOT_DIR, file)
      const content = readFileSync(file, 'utf8')
      const specs = extractImportSpecifiers(content)

      for (const spec of specs) {
        if (spec.startsWith('.')) {
          const target = resolve(dirname(file), spec)
          const relToNetproto = relative(NETPROTO_DIR, target)
          if (relToNetproto.startsWith('..') || relToNetproto.startsWith('/')) {
            violations.push(`${relFile} imports outside netproto: ${spec}`)
          }
        } else if (spec.startsWith('node:')) {
          violations.push(`${relFile} imports node builtin "${spec}"`)
        } else {
          violations.push(`${relFile} imports external specifier "${spec}"`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('ensures no file outside src/netproto/** imports protocol internals (must import via src/netproto/index.ts)', () => {
    const allSrcFiles = collectTsFiles(SRC_DIR).filter(f => !f.startsWith(NETPROTO_DIR + '/'))
    const netprotoIndex = resolve(NETPROTO_DIR, 'index.ts')

    const violations: string[] = []
    for (const file of allSrcFiles) {
      const relFile = relative(ROOT_DIR, file)
      const content = readFileSync(file, 'utf8')
      const specs = extractImportSpecifiers(content)

      for (const spec of specs) {
        if (!spec.startsWith('.')) continue
        const target = resolve(dirname(file), spec)
        if (target === NETPROTO_DIR || target.startsWith(NETPROTO_DIR + '/')) {
          const resolvedTarget = target.endsWith('.ts') ? target : `${target}.ts`
          if (resolvedTarget !== netprotoIndex && target !== NETPROTO_DIR) {
            violations.push(`${relFile} imports forbidden netproto internal: ${spec}`)
          }
        }
      }
    }

    expect(violations).toEqual([])
  })
})
