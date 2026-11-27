/**
 * Shared browser-side types & formatting helpers for [K0]..[K6] Showcases
 * (`showcase/shared/types.ts`).
 */

export interface ShowcaseZoneController {
  activate(): void
  deactivate(): void
}

export type SharedReplayUnitTuple = readonly [number, number, number, number, number, number, number, number]
export type SharedChannelKey = 't0' | 't1' | 't3' | 't4' | 'gs' | 's2c'
export type SharedChannelStatus = 0 | 1 | 2

export const SHARED_CHANNEL_LABELS: Readonly<Record<SharedChannelKey, string>> = {
  t0: 't0 玩家',
  t1: 't1 怪物/NPC',
  t3: 't3 投射物',
  t4: 't4 物品',
  gs: 'gs 64-bit PRNG',
  s2c: 's2c 封包',
}

export interface SharedFieldDivergence {
  readonly frame: number
  readonly key: string
  readonly id: number | null
  readonly field: string
  readonly expected: unknown
  readonly actual: unknown
}

export interface SharedReplayFrame {
  readonly frame: number
  readonly c2s: readonly string[]
  readonly gsWine: readonly [number, number] | null
  readonly gsTs: readonly [number, number] | null
  readonly ch: readonly SharedChannelStatus[]
  readonly nWine: readonly number[]
  readonly nTs: readonly number[]
  readonly diff: SharedFieldDivergence | null
  readonly wine: readonly SharedReplayUnitTuple[]
  readonly ts: readonly SharedReplayUnitTuple[]
  readonly playerStats?: Readonly<Record<string, number>>
}

export interface SharedReplayRoom {
  readonly key: string
  readonly levelId: number
  readonly subtileX: number
  readonly subtileY: number
  readonly subtileW: number
  readonly subtileH: number
  readonly mapBase64: string
}

export interface SharedReplayPayload {
  readonly ok: true
  readonly scenario: string
  readonly bootFrame: number
  readonly lastGoldenFrame: number
  readonly scenarioFrames: number
  readonly windowStartFrame: number
  readonly windowEndFrame: number
  readonly strictHorizon: number
  readonly firstStrictDivergence: SharedFieldDivergence | null
  readonly unportedHit: string | null
  readonly framesCompared: number
  readonly divergedFrames: number
  readonly channelKeys: readonly SharedChannelKey[]
  readonly channelTotals: readonly { readonly key: SharedChannelKey; readonly recorded: number; readonly matched: number }[]
  readonly inputCount: number
  readonly computeMs: number
  readonly header: {
    readonly unitFields: readonly string[]
    readonly statIds: readonly number[]
    readonly s2c: boolean
    readonly items: boolean
  }
  readonly rooms: readonly SharedReplayRoom[]
  readonly frames: readonly SharedReplayFrame[]
  readonly runtimeExec?: {
    readonly d2CommonDll: number
    readonly d2CommonTs: number
    readonly d2CommonGap: number
    readonly d2GameDll: number
    readonly d2GameTs: number
    readonly d2GameGap: number
  }
}

export interface SharedFnDetailResponse {
  readonly ok: true
  readonly key: string
  readonly module: 'D2Common' | 'D2Game'
  readonly va: string
  readonly name: string
  readonly status: string
  readonly size: number
  readonly topoLevel: number
  readonly sccId: number
  readonly subsystem: string
  readonly tsSymbol: string | null
  readonly tsReference: string | null
  readonly kernFile: string | null
  readonly diffEvidence: string | null
  readonly externalDeps: readonly string[]
  readonly disassembly: {
    readonly binaryName: string
    readonly startVa: string
    readonly stopVa: string
    readonly instructionCount: number
    readonly text: string
  }
  readonly tsSource: {
    readonly kernFile: string | null
    readonly tsSymbol: string | null
    readonly startLine: number | null
    readonly endLine: number | null
    readonly code: string | null
  }
  readonly callers: readonly { readonly key: string; readonly name: string; readonly status: string }[]
  readonly callees: readonly { readonly key: string; readonly name: string; readonly status: string }[]
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function fmtInt(n: number): string {
  return Math.trunc(n).toLocaleString('en-US')
}

export function fmtPct(num: number, den: number, digits = 2): string {
  if (den <= 0) return '0.00%'
  return `${((num / den) * 100).toFixed(digits)}%`
}

export function fmtHex32(n: number): string {
  return `0x${(n >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

export async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url)
  const text = await resp.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`HTTP ${resp.status} from ${url}: non-JSON body`)
  }
  if (!resp.ok) {
    const errMsg =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error?: unknown }).error)
        : `HTTP ${resp.status}`
    throw new Error(errMsg)
  }
  return parsed as T
}
