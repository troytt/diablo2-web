/**
 * Shared browser types for `showcase/k2/` (pure browser TypeScript — zero Node imports).
 * Mirrors the payloads of `tools/oracle/k2-showcase-server.ts`; the showcase test assigns the
 * server payloads to these types so the two stay structurally aligned.
 */

export const K2_SCENARIOS = [
  'a1-town-walk',
  'a1c-bloodmoor-fallen',
  'a1-bloodmoor-melee',
  'p52-dot-ticks',
  'p52-item-defense',
] as const
export type K2ScenarioId = (typeof K2_SCENARIOS)[number]

export interface K2FieldDivergence {
  readonly frame: number
  readonly key: string
  readonly id: number | null
  readonly field: string
  readonly expected: unknown
  readonly actual: unknown
}

// ------------------------------------------------------------------ Zone 1

/** `[type, id, classId, mode, x, y, hp, maxHp]` */
export type K2ReplayUnitTuple = readonly [number, number, number, number, number, number, number, number]

export type K2ChannelKey = 't0' | 't1' | 't3' | 't4' | 'gs' | 's2c'

/** `0` = channel not recorded in the golden frame, `1` = match, `2` = diverged. */
export type K2ChannelStatus = 0 | 1 | 2

export const K2_CHANNEL_LABELS: Readonly<Record<K2ChannelKey, string>> = {
  t0: 't0 玩家单位',
  t1: 't1 怪物单位',
  t3: 't3 投射物',
  t4: 't4 物品',
  gs: 'gs 游戏种子',
  s2c: 's2c 下行封包',
}

export interface K2ReplayFrame {
  readonly frame: number
  readonly c2s: readonly string[]
  readonly gsWine: readonly [number, number] | null
  readonly gsTs: readonly [number, number] | null
  readonly ch: readonly K2ChannelStatus[]
  readonly nWine: readonly number[]
  readonly nTs: readonly number[]
  readonly diff: K2FieldDivergence | null
  readonly wine: readonly K2ReplayUnitTuple[]
  readonly ts: readonly K2ReplayUnitTuple[]
}

export interface K2ReplayRoom {
  readonly key: string
  readonly levelId: number
  readonly subtileX: number
  readonly subtileY: number
  readonly subtileW: number
  readonly subtileH: number
  readonly mapBase64: string
}

export interface K2ReplayPayload {
  readonly ok: true
  readonly scenario: K2ScenarioId
  readonly bootFrame: number
  readonly lastGoldenFrame: number
  readonly scenarioFrames: number
  readonly strictHorizon: number
  readonly firstStrictDivergence: K2FieldDivergence | null
  readonly unportedHit: string | null
  readonly framesCompared: number
  readonly divergedFrames: number
  readonly channelKeys: readonly K2ChannelKey[]
  readonly channelTotals: readonly { readonly key: K2ChannelKey; readonly recorded: number; readonly matched: number }[]
  readonly inputCount: number
  readonly computeMs: number
  readonly header: {
    readonly unitFields: readonly string[]
    readonly statIds: readonly number[]
    readonly s2c: boolean
    readonly items: boolean
  }
  readonly rooms: readonly K2ReplayRoom[]
  readonly frames: readonly K2ReplayFrame[]
}

// ------------------------------------------------------------------ Zone 2

export interface K2GapScenarioMeasure {
  readonly scenario: string
  readonly error: string | null
  readonly dllExecuted: number
  readonly tsExecutedInDll: number
  readonly gap: number
  readonly strictHorizon: number
  readonly lastGoldenFrame: number
  readonly zeroDivergence: boolean
}

export interface K2GapMeasure {
  readonly scenarios: readonly K2GapScenarioMeasure[]
  readonly dllUnion: number
  readonly tsUnionInDll: number
  readonly unionGap: number
  readonly unionOfScenarioGaps: number
  readonly unionGapVas: readonly string[]
  readonly framesReplayed: number
  readonly allZeroDivergence: boolean
}

export interface K2ManifestTally {
  readonly d2GameTotal: number
  readonly d2GameDiffVerified: number
  readonly d2GamePorted: number
  readonly d2GameUnported: number
  readonly d2CommonTotal: number
  readonly d2CommonDiffVerified: number
}

export interface K2GapHistoryPoint {
  readonly sha: string
  readonly shortSha: string
  readonly committedAt: string
  readonly subject: string
  readonly measured: K2GapMeasure | null
  readonly measureError: string | null
  readonly reportMd: {
    readonly perScenario: Readonly<Record<string, number | null>>
    readonly unionOfScenarioGaps: number | null
  }
  readonly ratchetCeiling: number | null
  readonly manifest: K2ManifestTally | null
}

export interface K2GapHistoryFile {
  readonly schema: string
  readonly generator: string
  readonly headSha: string
  readonly definitions: { readonly unionGap: string; readonly unionOfScenarioGaps: string }
  readonly scenarios: readonly string[]
  readonly points: readonly K2GapHistoryPoint[]
}

export interface K2LiveGapMeasure extends K2GapMeasure {
  readonly computeMs: number
  readonly dllUnionVas: readonly string[]
  readonly tsUnionVas: readonly string[]
}

export interface K2GapResponse {
  readonly ok: true
  readonly historyPath: string
  readonly history: K2GapHistoryFile | null
  readonly historyError: string | null
  readonly live: K2LiveGapMeasure
  readonly liveHeadSha: string | null
  readonly liveMatchesHistoryHead: boolean
  readonly totalScenarioFrames: number
}

// ------------------------------------------------------------------ Zone 3

export interface K2ModuleTotals {
  readonly module: string
  readonly total: number
  readonly diffVerified: number
  readonly ported: number
  readonly unported: number
}

/** `0` = not executed by the DLL in the 5 scenarios, `1` = DLL∩TS executed, `2` = DLL-only (gap). */
export type K2ReplayExecCode = 0 | 1 | 2

export interface K2CallgraphNode {
  readonly va: string
  readonly name: string
  readonly status: string
  readonly size: number
  readonly topoLevel: number
  readonly tsSymbol: string | null
  readonly kf: number
  readonly exec: K2ReplayExecCode
}

export interface K2CallgraphResponse {
  readonly ok: true
  readonly manifestPath: string
  readonly manifestVersion: string
  readonly manifestGeneratedAt: string
  readonly totals: readonly K2ModuleTotals[]
  readonly kernFiles: readonly string[]
  readonly replay: { readonly dllUnion: number; readonly tsUnionInDll: number; readonly unionGap: number }
  readonly replayClosureByStatus: Readonly<Record<string, number>>
  readonly functions: readonly K2CallgraphNode[]
}

export interface K2FunctionEdge {
  readonly key: string
  readonly name: string
  readonly status: string
}

export interface K2FunctionDetailResponse {
  readonly ok: true
  readonly module: string
  readonly va: string
  readonly name: string
  readonly status: string
  readonly size: number
  readonly topoLevel: number
  readonly sccId: number
  readonly tsSymbol: string | null
  readonly tsReference: string | null
  readonly kernFile: string | null
  readonly diffEvidence: string | null
  readonly exec: K2ReplayExecCode
  readonly externalDeps: readonly string[]
  readonly callers: readonly K2FunctionEdge[]
  readonly callees: readonly K2FunctionEdge[]
}

// ------------------------------------------------------------------ Zone 4

export interface K2CombatExpected {
  readonly phys: number | null
  readonly elem: number | null
  readonly total: number | null
  readonly absorb: number | null
}

export interface K2CombatSettlement {
  /** `[defIsPlayer, difficulty, phys256, channel, elem256, rate54, dr, mdr, physRes, res, maxRes, absPct, absFlat, pierce]` */
  readonly a: readonly number[]
  readonly exp: K2CombatExpected
}

export interface K2CombatChannel {
  readonly off: number
  readonly elemType: string
  readonly res: number
  readonly max: number
  readonly absPct: number
  readonly absFlat: number
  readonly pierce: number
}

export interface K2CombatResponse {
  readonly ok: true
  readonly vectorPath: string
  readonly dllVa: string
  readonly dllName: string
  readonly kernSymbol: string | null
  readonly kernFile: string | null
  readonly kernStatus: string | null
  readonly schema: string
  readonly seed: number
  readonly playerBaseStats: readonly (readonly [number, number])[]
  readonly argNames: readonly string[]
  readonly channels: readonly K2CombatChannel[]
  readonly vectorLines: number
  readonly settlements: readonly K2CombatSettlement[]
  readonly decodeCheck: { readonly impl: string; readonly lines: number; readonly matched: number }
}

// ---------------------------------------------------------------- Overview

export interface K2OverviewResponse {
  readonly ok: true
  readonly scenarios: readonly { readonly name: string; readonly frames: number; readonly inputs: number }[]
  readonly totalScenarioFrames: number
  readonly totals: readonly K2ModuleTotals[]
  readonly combatVectorLines: number
  readonly historyPoints: number | null
}

// ------------------------------------------------------------------ helpers

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US')
}

export function fmtPct(num: number, den: number, digits = 2): string {
  if (den <= 0) return 'n/a'
  return `${((num / den) * 100).toFixed(digits)}%`
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url)
  const body = (await resp.json()) as T & { ok?: boolean; error?: string }
  if (!resp.ok || body.ok === false) {
    throw new Error(body.error ?? `HTTP ${resp.status} for ${url}`)
  }
  return body
}

export interface K2ZoneController {
  activate(): void
  deactivate(): void
}
