/**
 * Locate a headless Chrome/Chromium binary for the browser-driven verifiers.
 *
 * Playwright stores every browser build under a versioned directory (`chromium-1228`
 * and so on) whose number changes with each Playwright release, so nothing here may
 * hard-code a build number or a machine-specific home directory. The cache root comes
 * from `PLAYWRIGHT_BROWSERS_PATH` or `$HOME`, and the newest build found wins so a
 * machine carrying several installs resolves deterministically.
 *
 * @module
 */

import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Chromium binary locations relative to one Playwright browser build directory. */
const PLAYWRIGHT_BUILD_BINARIES = [
  'chrome-linux64/chrome',
  'chrome-linux/chrome',
  'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  'chrome-win/chrome.exe',
] as const

/** System Chromium/Chrome installations, tried after the Playwright cache. */
const SYSTEM_BINARIES = [
  '/usr/bin/x-www-browser',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
] as const

/** Prefix Playwright uses for its Chromium build directories. */
const PLAYWRIGHT_CHROMIUM_PREFIX = 'chromium-'

/**
 * Collect the Playwright Chromium build directories that exist on this machine.
 *
 * @returns absolute build directory paths, newest build first.
 */
function playwrightBuildDirs(): string[] {
  const roots = [
    process.env['PLAYWRIGHT_BROWSERS_PATH'],
    join(process.env['HOME'] ?? homedir(), '.cache', 'ms-playwright'),
  ].filter((root): root is string => Boolean(root))

  const found: { readonly dir: string; readonly build: number }[] = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith(PLAYWRIGHT_CHROMIUM_PREFIX)) continue
      const build = Number.parseInt(entry.slice(PLAYWRIGHT_CHROMIUM_PREFIX.length), 10)
      if (Number.isNaN(build)) continue
      const dir = join(root, entry)
      if (!existsSync(dir)) continue
      found.push({ dir, build })
    }
  }
  return found.sort((a, b) => b.build - a.build).map(entry => entry.dir)
}

/**
 * Every Chrome binary candidate, in the order they should be tried.
 *
 * @returns absolute paths; `CHROME_PATH` always wins when it is set.
 */
export function chromeCandidates(): string[] {
  const candidates: string[] = []
  const explicit = process.env['CHROME_PATH']
  if (explicit) candidates.push(explicit)
  for (const dir of playwrightBuildDirs()) {
    for (const relative of PLAYWRIGHT_BUILD_BINARIES) candidates.push(join(dir, relative))
  }
  candidates.push(...SYSTEM_BINARIES)
  return candidates
}

/**
 * Find the first Chrome/Chromium binary that exists.
 *
 * @returns the absolute path of the binary.
 * @throws when none of the candidates exists.
 */
export function findChromeBinary(): string {
  const candidates = chromeCandidates()
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`No headless Chrome binary found in candidates: ${candidates.join(', ')}`)
}
