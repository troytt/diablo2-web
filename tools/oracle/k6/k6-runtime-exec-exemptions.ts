/**
 * Loads and validates the real-DLL-proven F1..F2 pre-boot exemption registry
 * (`docs/oracle/k6-coverage/preboot-f1-f2-exemptions.json`) for all 23 [K6] scenarios.
 *
 * Invariant enforced at runtime:
 * - Every exempted VA for a scenario MUST exist in `<scenario>.coverage.ndjson.gz` with
 *   `firstFrame <= bootFrame` (2), proving it ran only during pre-boot F1..F2 setup before
 *   `snap-f002.ndjson.gz` was captured and never during stepped frames F3..lastGoldenFrame.
 * - Zero stepped F3+ runtime gaps (`d2CommonUnexemptedGap === 0 && d2GameUnexemptedGap === 0`)
 *   are permitted across all 23 scenarios.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Coverage113c } from '../kern-replay/gap-report.ts'
import { REPO_ROOT_113C, manifestKey113c } from '../kern-replay/replay-113c.ts'

export interface K6PrebootScenarioEntry113c {
  readonly suite: 'k6' | 'k6-s2' | 'k6-s3'
  readonly frames: number
  readonly d2CommonPrebootOnlyVas: readonly string[]
  readonly d2GamePrebootOnlyVas: readonly string[]
}

export interface K6PrebootExemptionsFile113c {
  readonly schema: 'd2kern-113c-k6-preboot-exemptions-v1'
  readonly bootFrame: number
  readonly policy: string
  readonly scenarios: Readonly<Record<string, K6PrebootScenarioEntry113c>>
  readonly vaMetadata: Readonly<Record<string, { readonly symbol: string; readonly reason: string }>>
}

export interface K6SteppedRuntimeExecSummary113c {
  readonly d2CommonDll: number
  readonly d2GameDll: number
  readonly d2CommonSteppedDll: number
  readonly d2GameSteppedDll: number
  readonly d2CommonTs: number
  readonly d2GameTs: number
  readonly d2CommonRawGap: number
  readonly d2GameRawGap: number
  readonly d2CommonUnexemptedGap: number
  readonly d2GameUnexemptedGap: number
  readonly d2CommonPrebootExemptedGap: number
  readonly d2GamePrebootExemptedGap: number
  readonly missingSteppedD2CommonVas: readonly string[]
  readonly missingSteppedD2GameVas: readonly string[]
  readonly missingPrebootD2CommonVas: readonly string[]
  readonly missingPrebootD2GameVas: readonly string[]
}

export const K6_PREBOOT_EXEMPTIONS_PATH_113C = join(
  REPO_ROOT_113C,
  'docs/oracle/k6-coverage/preboot-f1-f2-exemptions.json',
)

let cachedExemptions113c: K6PrebootExemptionsFile113c | null = null

export function loadK6PrebootExemptions113c(): K6PrebootExemptionsFile113c {
  if (cachedExemptions113c === null) {
    cachedExemptions113c = JSON.parse(
      readFileSync(K6_PREBOOT_EXEMPTIONS_PATH_113C, 'utf8'),
    ) as K6PrebootExemptionsFile113c
  }
  return cachedExemptions113c
}

export function computeK6SteppedRuntimeExecSummary113c(
  scenarioName: string,
  cov: Coverage113c,
  tsExecutedVas: readonly string[],
  bootFrame = 2,
): K6SteppedRuntimeExecSummary113c {
  const reg = loadK6PrebootExemptions113c()
  const entry = reg.scenarios[scenarioName]
  if (entry === undefined) {
    throw new Error(`Missing scenario '${scenarioName}' in ${K6_PREBOOT_EXEMPTIONS_PATH_113C}`)
  }
  if (reg.bootFrame !== bootFrame) {
    throw new Error(`Exemption bootFrame mismatch: file=${reg.bootFrame}, caller=${bootFrame}`)
  }

  const firstFrameByKey = new Map<string, number>()
  let d2CommonDll = 0
  let d2GameDll = 0
  for (const h of cov.hits) {
    const key = manifestKey113c(h.module, h.va)
    firstFrameByKey.set(key, h.firstFrame)
    if (h.module === 'D2Common') d2CommonDll++
    else if (h.module === 'D2Game') d2GameDll++
  }

  const exemptCommon = new Set<string>()
  for (const va of entry.d2CommonPrebootOnlyVas) {
    const ff = firstFrameByKey.get(va)
    if (ff === undefined) {
      throw new Error(`${scenarioName}: exempted preboot VA ${va} not found in coverage`)
    }
    if (ff > bootFrame) {
      throw new Error(`${scenarioName}: illegal exemption for stepped VA ${va} (firstFrame=${ff} > ${bootFrame})`)
    }
    if (reg.vaMetadata[va] === undefined) {
      throw new Error(`${scenarioName}: exempted VA ${va} missing vaMetadata reason`)
    }
    exemptCommon.add(va)
  }

  const exemptGame = new Set<string>()
  for (const va of entry.d2GamePrebootOnlyVas) {
    const ff = firstFrameByKey.get(va)
    if (ff === undefined) {
      throw new Error(`${scenarioName}: exempted preboot VA ${va} not found in coverage`)
    }
    if (ff > bootFrame) {
      throw new Error(`${scenarioName}: illegal exemption for stepped VA ${va} (firstFrame=${ff} > ${bootFrame})`)
    }
    if (reg.vaMetadata[va] === undefined) {
      throw new Error(`${scenarioName}: exempted VA ${va} missing vaMetadata reason`)
    }
    exemptGame.add(va)
  }

  const tsSet = new Set(tsExecutedVas)
  let d2CommonTs = 0
  let d2GameTs = 0
  for (const k of tsSet) {
    if (k.startsWith('D2Common:')) d2CommonTs++
    else if (k.startsWith('D2Game:')) d2GameTs++
  }

  const missingSteppedD2CommonVas: string[] = []
  const missingSteppedD2GameVas: string[] = []
  const missingPrebootD2CommonVas: string[] = []
  const missingPrebootD2GameVas: string[] = []

  for (const h of cov.hits) {
    const key = manifestKey113c(h.module, h.va)
    if (tsSet.has(key)) continue
    if (h.module === 'D2Common') {
      if (exemptCommon.has(key)) missingPrebootD2CommonVas.push(key)
      else missingSteppedD2CommonVas.push(key)
    } else if (h.module === 'D2Game') {
      if (exemptGame.has(key)) missingPrebootD2GameVas.push(key)
      else missingSteppedD2GameVas.push(key)
    }
  }

  missingSteppedD2CommonVas.sort()
  missingSteppedD2GameVas.sort()
  missingPrebootD2CommonVas.sort()
  missingPrebootD2GameVas.sort()

  return {
    d2CommonDll,
    d2GameDll,
    d2CommonSteppedDll: d2CommonDll - exemptCommon.size,
    d2GameSteppedDll: d2GameDll - exemptGame.size,
    d2CommonTs,
    d2GameTs,
    d2CommonRawGap: missingSteppedD2CommonVas.length + missingPrebootD2CommonVas.length,
    d2GameRawGap: missingSteppedD2GameVas.length + missingPrebootD2GameVas.length,
    d2CommonUnexemptedGap: missingSteppedD2CommonVas.length,
    d2GameUnexemptedGap: missingSteppedD2GameVas.length,
    d2CommonPrebootExemptedGap: missingPrebootD2CommonVas.length,
    d2GamePrebootExemptedGap: missingPrebootD2GameVas.length,
    missingSteppedD2CommonVas,
    missingSteppedD2GameVas,
    missingPrebootD2CommonVas,
    missingPrebootD2GameVas,
  }
}
