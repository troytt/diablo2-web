/**
 * Shared backend primitives for the [K0]–[K6] Interactive Visual Showcases
 * (`tools/oracle/showcase-common.ts`).
 *
 * Strictly zero-mock: every metric, frame diff, disassembly block, and TypeScript snippet is
 * computed directly from repo files, live `src/d2kern-113c` executions, and local 1.13c DLLs.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import * as ts from 'typescript'
import { DUNGEON_GetLevelIdFromRoom113c } from '../../src/d2kern-113c/common/dungeon.ts'
import {
  D2ActStrc,
  D2ActiveRoomStrc,
  D2GameStrc,
  D2RoomCollisionGridStrc,
} from '../../src/d2kern-113c/mem/layout.generated.ts'
import type { SparseMemory113c } from '../../src/d2kern-113c/mem/sparse-memory.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../src/d2kern-113c/va-trace-113c.ts'
import type { Coverage113c } from './kern-replay/gap-report.ts'
import {
  UnportedFunction113c,
  bootFromSnapshot113c,
  diffFrame113c,
  loadSnapshotFile113c,
  manifestKey113c,
  sampleFrame113c,
  stepFrame113c,
  type FieldDivergence113c,
  type ReplayScenario113c,
} from './kern-replay/replay-113c.ts'
import { parseTrace, type Trace, type TraceFrame, type TraceHeader, type UnitRow } from './lib/trace-diff.ts'

export const DEFAULT_REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
export const MANIFEST_REL_PATH = 'tools/oracle/callgraph/manifest-113c.json'

export function resolveD2DataDir(rootDir: string = DEFAULT_REPO_ROOT): string {
  const candidates = [
    ...(process.env.D2_DATA_DIR ? [resolve(process.env.D2_DATA_DIR)] : []),
    resolve(rootDir, 'samples/d2'),
    join(homedir(), 'd2-data'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'D2Common.dll')) || existsSync(join(dir, 'd2data.mpq'))) {
      return dir
    }
  }
  return join(homedir(), 'd2-data')
}

export function sha256Buffer(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex')
}

export function sha256File(absPath: string): string {
  return sha256Buffer(readFileSync(absPath))
}

export function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(`${JSON.stringify(body)}\n`)
}

export function parseShowcaseRequest(
  req: IncomingMessage,
  apiPrefix: string,
): { subRoute: string; params: URLSearchParams; normPath: string } | null {
  if (!req.url) return null
  const qIdx = req.url.indexOf('?')
  const rawPath = qIdx >= 0 ? req.url.slice(0, qIdx) : req.url
  const queryStr = qIdx >= 0 ? req.url.slice(qIdx + 1) : ''
  const normPath = rawPath.startsWith('/diablo2/') ? rawPath.slice('/diablo2'.length) : rawPath
  if (!normPath.startsWith(apiPrefix)) return null
  return {
    subRoute: normPath.slice(apiPrefix.length),
    params: new URLSearchParams(queryStr),
    normPath,
  }
}

// ---------------------------------------------------------------------------
// Manifest & Subsystem Classification
// ---------------------------------------------------------------------------

export interface RawManifestFunction {
  readonly module: 'D2Common' | 'D2Game'
  readonly va: string
  readonly name: string
  readonly status: string
  readonly size: number
  readonly topoLevel?: number
  readonly sccId?: number
  readonly tsSymbol?: string | null
  readonly tsReference?: string | null
  readonly kernFile?: string | null
  readonly diffEvidence?: string | null
  readonly callers?: readonly string[]
  readonly callees?: readonly string[]
  readonly externalDeps?: readonly string[]
}

export interface ManifestModuleTotals {
  readonly module: string
  readonly total: number
  readonly diffVerified: number
  readonly ported: number
  readonly unported: number
}

export interface ManifestCacheEntry {
  readonly version: string
  readonly generatedAt: string
  readonly list: readonly RawManifestFunction[]
  readonly byKey: ReadonlyMap<string, RawManifestFunction>
  readonly byModNum: {
    readonly D2Common: ReadonlyMap<number, RawManifestFunction>
    readonly D2Game: ReadonlyMap<number, RawManifestFunction>
  }
  readonly sccCount: number
  readonly maxTopoLevel: number
}

const manifestCacheByRoot = new Map<string, ManifestCacheEntry>()

export function canonVa(va: string | number): string {
  const n =
    typeof va === 'number'
      ? va >>> 0
      : Number.parseInt(va.trim().toLowerCase().replace(/^0x/, ''), 16) >>> 0
  return `0x${n.toString(16).toUpperCase().padStart(8, '0')}`
}

export function parseVaNum(va: string): number {
  return Number.parseInt(va.trim().toLowerCase().replace(/^d2(?:common|game):/i, '').replace(/^0x/, ''), 16) >>> 0
}

export function canonEdgeKey(edge: string, defaultModule: 'D2Common' | 'D2Game' = 'D2Game'): string {
  const idx = edge.indexOf(':')
  if (idx < 0) return `${defaultModule}:${canonVa(edge)}`
  return `${edge.slice(0, idx)}:${canonVa(edge.slice(idx + 1))}`
}

export const D2GAME_SUBSYSTEM_ORDER = [
  'C2S',
  'Skills',
  'Missiles',
  'MonAI',
  'Combat/SUnitDmg',
  'Items/Cube/Trade',
  'Quests',
  'DRLG/Room/SUnit',
  'Party/Player/Client',
] as const

export type D2GameSubsystemName = (typeof D2GAME_SUBSYSTEM_ORDER)[number]

/** Exact TypeScript mirror of `tools/oracle/k6/audit-dll-coverage.py::classify_d2game_subsystem`. */
export function classifyD2GameSubsystem(name: string): D2GameSubsystemName {
  const pfx = name.split('_')[0] ?? ''
  const upper = name.toUpperCase()

  if (pfx === 'C2S') return 'C2S'
  if (
    pfx === 'SKILLS' ||
    pfx === 'SrvDoFunc' ||
    pfx === 'AURA' ||
    pfx === 'AURAS' ||
    pfx === 'CURSES' ||
    pfx === 'PALADIN' ||
    pfx === 'PETS' ||
    pfx === 'SUMMON' ||
    pfx === 'PETTYPE'
  ) {
    return 'Skills'
  }
  if (pfx === 'MISSILE' || pfx === 'MISSILES' || upper.startsWith('MISSMODE_')) return 'Missiles'
  if (
    pfx === 'AI' ||
    pfx === 'MONAI' ||
    pfx === 'AIGENERAL' ||
    pfx === 'AIBAAL' ||
    pfx === 'AITARGET' ||
    pfx === 'AITHINK' ||
    pfx === 'AIINIT' ||
    pfx === 'AiFallen' ||
    pfx === 'AiZombie' ||
    pfx === 'SUNITPROXY'
  ) {
    return 'MonAI'
  }
  if (
    pfx === 'SUNITDMG' ||
    pfx === 'MONUMOD' ||
    pfx === 'MONSTER' ||
    pfx === 'MONMODE' ||
    pfx === 'MONSTATS' ||
    pfx === 'MONSTATS2' ||
    pfx === 'MONPROP' ||
    pfx === 'MONLVL' ||
    pfx === 'MONSEQ' ||
    pfx === 'MONTYPE' ||
    pfx === 'STATES' ||
    pfx === 'STATLIST' ||
    pfx === 'HIRELING'
  ) {
    return 'Combat/SUnitDmg'
  }
  if (
    pfx === 'ITEMS' ||
    pfx === 'ITEMMODS' ||
    pfx === 'ITEMEVENT' ||
    pfx === 'ITEMMODE' ||
    pfx === 'CUBE' ||
    pfx === 'PLRTRADE' ||
    pfx === 'NPCS' ||
    pfx === 'NPC' ||
    pfx === 'NPCTRADE' ||
    pfx === 'STASH' ||
    pfx === 'INVENTORY' ||
    pfx === 'UNIQUEITEMS'
  ) {
    return 'Items/Cube/Trade'
  }
  if (
    pfx === 'QUESTS' ||
    pfx === 'QUEST' ||
    pfx === 'QUEST0D' ||
    pfx === 'ACT2Intro' ||
    pfx === 'ACT4Prologue' ||
    pfx === 'ACT5Intro' ||
    /^(ACT[1-5](Q\d+)?|A5Q\d+)$/.test(pfx)
  ) {
    return 'Quests'
  }
  if (
    pfx === 'DRLG' ||
    pfx === 'DUNGEON' ||
    pfx === 'ROOM' ||
    pfx === 'REGPOP' ||
    pfx === 'REGIONS' ||
    pfx === 'MONREG' ||
    pfx === 'OBJRGN' ||
    pfx === 'OBJECTS' ||
    pfx === 'OBJ' ||
    pfx === 'OBJECT' ||
    pfx === 'SHRINES' ||
    pfx === 'PORTAL' ||
    pfx === 'SUNIT' ||
    pfx === 'UNIT' ||
    pfx === 'UNITS' ||
    pfx === 'UNITROOM' ||
    pfx === 'UNITMSG' ||
    pfx === 'SUNITMSG' ||
    pfx === 'UNITEVENT' ||
    pfx === 'EVENT' ||
    pfx === 'SEED' ||
    pfx === 'DATATBLS' ||
    pfx === 'OVERLAY' ||
    pfx === 'VECTOR' ||
    pfx === 'STORM' ||
    pfx === 'ACT'
  ) {
    return 'DRLG/Room/SUnit'
  }
  if (pfx === 'D2GAME') {
    if (upper.includes('C2S_') || upper.includes('PACKET_SRV')) return 'C2S'
    if (
      upper.includes('SKILL') ||
      upper.includes('SUMMON') ||
      upper.includes('PET') ||
      upper.includes('AURA') ||
      upper.includes('CURSE')
    ) {
      return 'Skills'
    }
    if (upper.includes('MISSILE')) return 'Missiles'
    if (
      upper.includes('ITEM') ||
      upper.includes('CUBE') ||
      upper.includes('TRADE') ||
      upper.includes('SHOP') ||
      upper.includes('GAMBLE') ||
      upper.includes('NPC') ||
      upper.includes('STASH') ||
      upper.includes('DROP')
    ) {
      return 'Items/Cube/Trade'
    }
    if (
      upper.includes('DMG') ||
      upper.includes('DAMAGE') ||
      upper.includes('MONSTER') ||
      upper.includes('MERC') ||
      upper.includes('UMOD') ||
      upper.includes('STAT')
    ) {
      return 'Combat/SUnitDmg'
    }
    if (upper.includes('QUEST')) return 'Quests'
    if (
      upper.includes('ROOM') ||
      upper.includes('DRLG') ||
      upper.includes('SUNIT') ||
      upper.includes('OBJECT') ||
      upper.includes('EVENT') ||
      upper.includes('SHRINE') ||
      upper.includes('PORTAL')
    ) {
      return 'DRLG/Room/SUnit'
    }
    return 'Party/Player/Client'
  }
  return 'Party/Player/Client'
}

export function loadManifestCached(rootDir: string = DEFAULT_REPO_ROOT): ManifestCacheEntry {
  const hit = manifestCacheByRoot.get(rootDir)
  if (hit) return hit
  const raw = JSON.parse(readFileSync(resolve(rootDir, MANIFEST_REL_PATH), 'utf8')) as {
    version?: string
    generatedAt?: string
    functions: RawManifestFunction[]
  }
  const byKey = new Map<string, RawManifestFunction>()
  const d2c = new Map<number, RawManifestFunction>()
  const d2g = new Map<number, RawManifestFunction>()
  const sccs = new Set<number>()
  let maxTopoLevel = 0
  for (const fn of raw.functions) {
    const vaHex = canonVa(fn.va)
    const vaNum = parseVaNum(vaHex)
    byKey.set(`${fn.module}:${vaHex}`, fn)
    if (fn.module === 'D2Common') d2c.set(vaNum, fn)
    else if (fn.module === 'D2Game') d2g.set(vaNum, fn)
    if (typeof fn.sccId === 'number') sccs.add(fn.sccId)
    if (typeof fn.topoLevel === 'number' && fn.topoLevel > maxTopoLevel) {
      maxTopoLevel = fn.topoLevel
    }
  }
  const entry: ManifestCacheEntry = {
    version: raw.version ?? '',
    generatedAt: raw.generatedAt ?? '',
    list: raw.functions,
    byKey,
    byModNum: { D2Common: d2c, D2Game: d2g },
    sccCount: sccs.size,
    maxTopoLevel,
  }
  manifestCacheByRoot.set(rootDir, entry)
  return entry
}

export function tallyManifestModules(list: readonly RawManifestFunction[]): ManifestModuleTotals[] {
  const map = new Map<string, { total: number; diffVerified: number; ported: number; unported: number }>()
  for (const fn of list) {
    let t = map.get(fn.module)
    if (!t) {
      t = { total: 0, diffVerified: 0, ported: 0, unported: 0 }
      map.set(fn.module, t)
    }
    t.total++
    if (fn.status === 'diff-verified') t.diffVerified++
    else if (fn.status === 'ported') t.ported++
    else t.unported++
  }
  return [...map.entries()]
    .map(([module, t]) => ({ module, ...t }))
    .sort((a, b) => a.module.localeCompare(b.module))
}

// ---------------------------------------------------------------------------
// Live x86 Intel Disassembly & TypeScript AST Extraction
// ---------------------------------------------------------------------------

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

const tsAstFileCache = new Map<string, { text: string; sf: ts.SourceFile }>()
const disasmCache = new Map<string, SharedFnDetailResponse['disassembly']>()

export function extractTsSymbolSourceCached(
  rootDir: string,
  kernFile: string | null,
  tsSymbol: string | null,
): SharedFnDetailResponse['tsSource'] {
  if (!kernFile || !tsSymbol) {
    return { kernFile, tsSymbol, startLine: null, endLine: null, code: null }
  }
  const absPath = resolve(rootDir, kernFile)
  if (!existsSync(absPath)) {
    return { kernFile, tsSymbol, startLine: null, endLine: null, code: null }
  }
  let parsed = tsAstFileCache.get(absPath)
  if (!parsed) {
    const text = readFileSync(absPath, 'utf8')
    const sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true)
    parsed = { text, sf }
    tsAstFileCache.set(absPath, parsed)
  }
  const { text, sf } = parsed

  let matchedNode: ts.Node | null = null
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === tsSymbol) {
      matchedNode = stmt
      break
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === tsSymbol) {
          matchedNode = stmt
          break
        }
      }
      if (matchedNode) break
    }
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) {
        if (el.name.text === tsSymbol) {
          if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
            const targetName = el.propertyName?.text ?? el.name.text
            const subRel = resolve(absPath, '..', stmt.moduleSpecifier.text)
            const relFromRoot = subRel.startsWith(rootDir)
              ? subRel.slice(rootDir.length).replace(/^\/+/, '')
              : null
            if (relFromRoot) {
              return extractTsSymbolSourceCached(rootDir, relFromRoot, targetName)
            }
          }
          matchedNode = stmt
          break
        }
      }
      if (matchedNode) break
    }
  }

  if (!matchedNode) {
    return { kernFile, tsSymbol, startLine: null, endLine: null, code: null }
  }

  const fullStart = matchedNode.getFullStart()
  const codeStart = matchedNode.getStart(sf)
  const leadingComments = ts.getLeadingCommentRanges(text, fullStart)
  let sliceStart = codeStart
  if (leadingComments && leadingComments.length > 0) {
    const lastComment = leadingComments[leadingComments.length - 1]!
    const between = text.slice(lastComment.end, codeStart)
    if (!between.includes('\n\n')) {
      sliceStart = lastComment.pos
    }
  }
  const sliceEnd = matchedNode.getEnd()
  const startLine = sf.getLineAndCharacterOfPosition(sliceStart).line + 1
  const endLine = sf.getLineAndCharacterOfPosition(sliceEnd).line + 1
  const code = text.slice(sliceStart, sliceEnd).trim()
  return { kernFile, tsSymbol, startLine, endLine, code }
}

export function disassembleDllFunctionCached(
  rootDir: string,
  module: 'D2Common' | 'D2Game',
  vaNum: number,
  size: number,
): SharedFnDetailResponse['disassembly'] {
  const binaryName = module === 'D2Game' ? 'D2Game.dll' : 'D2Common.dll'
  const span = Math.max(1, Math.min(0x8000, size > 0 ? size : 64))
  const startVa = canonVa(vaNum)
  const stopVa = canonVa((vaNum + span) >>> 0)
  const cacheKey = `${rootDir}|${binaryName}|${startVa}|${span}`
  const hit = disasmCache.get(cacheKey)
  if (hit) return hit

  const dllPath = join(resolveD2DataDir(rootDir), binaryName)
  if (!existsSync(dllPath)) {
    const res = {
      binaryName,
      startVa,
      stopVa,
      instructionCount: 0,
      text: `; ${binaryName} not found in configured D2_DATA_DIR`,
    }
    disasmCache.set(cacheKey, res)
    return res
  }

  let rawOut = ''
  try {
    rawOut = execFileSync(
      'objdump',
      [
        '-d',
        '-M',
        'intel',
        `--start-address=${startVa.toLowerCase()}`,
        `--stop-address=${stopVa.toLowerCase()}`,
        dllPath,
      ],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
    )
  } catch (e) {
    const res = {
      binaryName,
      startVa,
      stopVa,
      instructionCount: 0,
      text: `; objdump failed: ${e instanceof Error ? e.message : String(e)}`,
    }
    disasmCache.set(cacheKey, res)
    return res
  }

  const lines: string[] = []
  let instructionCount = 0
  for (const rawLine of rawOut.split(/\r?\n/)) {
    if (!rawLine.trim()) continue
    if (rawLine.includes('file format')) {
      lines.push(`; ${binaryName} (PE32 i386) [${startVa} .. ${stopVa}, ${span} bytes]`)
      continue
    }
    if (rawLine.startsWith('Disassembly of section')) continue
    if (/^[0-9a-fA-F]{8}\s+<[^>]+>:$/.test(rawLine.trim())) continue
    if (/^\s*[0-9a-fA-F]{8}:\s+/.test(rawLine)) {
      instructionCount++
      lines.push(rawLine.replace(/^\s+/, ''))
    }
  }
  const res = {
    binaryName,
    startVa,
    stopVa,
    instructionCount,
    text: lines.join('\n'),
  }
  disasmCache.set(cacheKey, res)
  return res
}

export function getManifestFunctionDetail(
  rootDir: string,
  vaSpec: string,
  moduleHint?: string | null,
): SharedFnDetailResponse {
  const manifest = loadManifestCached(rootDir)
  let mod: 'D2Common' | 'D2Game' = moduleHint === 'D2Common' ? 'D2Common' : 'D2Game'
  const raw = vaSpec.trim()
  let hexPart = raw
  if (/^d2common:/i.test(raw)) {
    mod = 'D2Common'
    hexPart = raw.slice('d2common:'.length)
  } else if (/^d2game:/i.test(raw)) {
    mod = 'D2Game'
    hexPart = raw.slice('d2game:'.length)
  }
  const vaNum = parseVaNum(hexPart)
  if (!Number.isFinite(vaNum) || vaNum === 0) {
    throw new Error(`Invalid VA specifier: '${vaSpec}'`)
  }
  // Auto-detect module from VA range if hint omitted
  if (!moduleHint && !raw.includes(':')) {
    if (vaNum >= 0x6fd50000 && vaNum < 0x6fe00000) mod = 'D2Common'
    else mod = 'D2Game'
  }
  const vaHex = canonVa(vaNum)
  const key = `${mod}:${vaHex}`
  const fn = manifest.byKey.get(key)
  if (!fn) {
    throw new Error(`Function '${key}' not found in ${MANIFEST_REL_PATH}`)
  }

  const edge = (e: string): { key: string; name: string; status: string } => {
    const k = canonEdgeKey(e, fn.module)
    const target = manifest.byKey.get(k)
    return { key: k, name: target?.name ?? '(outside manifest)', status: target?.status ?? 'external' }
  }

  return {
    ok: true,
    key,
    module: fn.module,
    va: vaHex,
    name: fn.name,
    status: fn.status,
    size: fn.size,
    topoLevel: fn.topoLevel ?? 0,
    sccId: fn.sccId ?? 0,
    subsystem: fn.module === 'D2Game' ? classifyD2GameSubsystem(fn.name) : 'D2Common',
    tsSymbol: fn.tsSymbol ?? null,
    tsReference: fn.tsReference ?? null,
    kernFile: fn.kernFile ?? null,
    diffEvidence: fn.diffEvidence ?? null,
    externalDeps: fn.externalDeps ?? [],
    disassembly: disassembleDllFunctionCached(rootDir, fn.module, vaNum, fn.size),
    tsSource: extractTsSymbolSourceCached(rootDir, fn.kernFile ?? null, fn.tsSymbol ?? null),
    callers: (fn.callers ?? []).map(edge),
    callees: (fn.callees ?? []).map(edge),
  }
}

// ---------------------------------------------------------------------------
// Coverage Loader
// ---------------------------------------------------------------------------

export function loadCoverageGzFile(absPath: string): Coverage113c {
  const lines = gunzipSync(readFileSync(absPath))
    .toString('utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
  const hdr = JSON.parse(lines[0]!) as {
    k: string
    from: number
    to: number
    entries: number
    hit: number
    otherThreadHits: number
  }
  if (hdr.k !== 'hdr') throw new Error(`${absPath}: coverage missing hdr`)
  const hits = lines.slice(1).map((l) => {
    const o = JSON.parse(l) as { m: string; va: string; f: number }
    return { module: o.m, va: parseInt(o.va, 16) >>> 0, firstFrame: o.f }
  })
  return {
    from: hdr.from,
    to: hdr.to,
    entries: hdr.entries,
    hit: hdr.hit,
    otherThreadHits: hdr.otherThreadHits,
    hits,
  }
}

// ---------------------------------------------------------------------------
// Generalized Live Lockstep Replay Serializer
// ---------------------------------------------------------------------------

/** `[type, id, classId, mode, x, y, hp, maxHp]` */
export type SharedReplayUnitTuple = readonly [number, number, number, number, number, number, number, number]
export type SharedChannelKey = 't0' | 't1' | 't3' | 't4' | 'gs' | 's2c'
export const SHARED_CHANNEL_KEYS: readonly SharedChannelKey[] = ['t0', 't1', 't3', 't4', 'gs', 's2c']
/** `0` = absent in golden, `1` = strict match, `2` = diverged */
export type SharedChannelStatus = 0 | 1 | 2

export interface SharedReplayFrame {
  readonly frame: number
  readonly c2s: readonly string[]
  readonly gsWine: readonly [number, number] | null
  readonly gsTs: readonly [number, number] | null
  readonly ch: readonly SharedChannelStatus[]
  readonly nWine: readonly number[]
  readonly nTs: readonly number[]
  readonly diff: FieldDivergence113c | null
  readonly wine: readonly SharedReplayUnitTuple[]
  readonly ts: readonly SharedReplayUnitTuple[]
  /** Optional player tracked stats `{ [statId]: value }` when present in header. */
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
  readonly firstStrictDivergence: FieldDivergence113c | null
  readonly unportedHit: string | null
  readonly framesCompared: number
  readonly divergedFrames: number
  readonly channelKeys: readonly SharedChannelKey[]
  readonly channelTotals: readonly { readonly key: SharedChannelKey; readonly recorded: number; readonly matched: number }[]
  readonly inputCount: number
  readonly computeMs: number
  readonly header: { readonly unitFields: readonly string[]; readonly statIds: readonly number[]; readonly s2c: boolean; readonly items: boolean }
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

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex.replace(/\s+/g, ''), 'hex'))
}

function extractUnitTuples(frame: TraceFrame, header: TraceHeader): SharedReplayUnitTuple[] {
  const col = (name: string): number => header.unitFields.indexOf(name)
  const idIdx = col('id')
  const clsIdx = col('class')
  const modeIdx = col('mode')
  const xIdx = col('x')
  const yIdx = col('y')
  const statCol = (statId: number): number => {
    const idx = header.statIds.indexOf(statId)
    return idx >= 0 ? header.unitFields.length + idx : -1
  }
  const hpCol = statCol(6)
  const maxHpCol = statCol(7)
  const numAt = (row: UnitRow, c: number): number => {
    if (c < 0 || c >= row.length) return 0
    const v = row[c]
    return typeof v === 'number' ? v : 0
  }
  const out: SharedReplayUnitTuple[] = []
  for (const unitType of [0, 1, 3] as const) {
    const rows = frame[`t${unitType}`] ?? []
    for (const row of rows) {
      const hasStats = unitType !== 3
      out.push([
        unitType,
        numAt(row, idIdx),
        numAt(row, clsIdx),
        numAt(row, modeIdx),
        numAt(row, xIdx),
        numAt(row, yIdx),
        hasStats ? numAt(row, hpCol) : 0,
        hasStats ? numAt(row, maxHpCol) : 0,
      ])
    }
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return out
}

function extractPlayerStats(
  frame: TraceFrame,
  header: TraceHeader,
  trackStatIds?: readonly number[],
): Readonly<Record<string, number>> | undefined {
  if (!trackStatIds || trackStatIds.length === 0) return undefined
  const pRow = frame.t0?.[0]
  if (!pRow) return undefined
  const res: Record<string, number> = {}
  for (const sid of trackStatIds) {
    const idx = header.statIds.indexOf(sid)
    if (idx < 0) continue
    const v = pRow[header.unitFields.length + idx]
    if (typeof v === 'number') res[String(sid)] = v
  }
  return res
}

function collectWorldActiveRooms(
  m: SparseMemory113c,
  pGame: number,
  into: Map<string, SharedReplayRoom>,
): void {
  for (let actIdx = 0; actIdx < 5; actIdx++) {
    let pAct = 0
    try {
      pAct = m.get(pGame, D2GameStrc.pAct, actIdx)
    } catch {
      pAct = 0
    }
    if (pAct === 0) continue
    let r = 0
    try {
      r = m.get(pAct, D2ActStrc.pRoom1)
    } catch {
      r = 0
    }
    let guard = 0
    while (r !== 0 && guard++ < 512) {
      let nextR = 0
      try {
        nextR = m.get(r, D2ActiveRoomStrc.pRoomNext)
        const pColl = m.get(r, D2ActiveRoomStrc.pCollisionGrid)
        if (pColl !== 0) {
          const sx = m.get(pColl, D2RoomCollisionGridStrc.nSubtileX) | 0
          const sy = m.get(pColl, D2RoomCollisionGridStrc.nSubtileY) | 0
          const sw = m.get(pColl, D2RoomCollisionGridStrc.nSubtileWidth) | 0
          const sh = m.get(pColl, D2RoomCollisionGridStrc.nSubtileHeight) | 0
          const key = `${sx}:${sy}`
          if (!into.has(key) && sw > 0 && sh > 0 && sw <= 120 && sh <= 120) {
            const pMap = m.get(pColl, D2RoomCollisionGridStrc.pMapStart)
            if (pMap !== 0) {
              const mapBytes = m.readBytes(pMap, sw * sh * 2)
              let levelId = 0
              try {
                levelId = DUNGEON_GetLevelIdFromRoom113c(m, r)
              } catch {
                levelId = 0
              }
              into.set(key, {
                key,
                levelId,
                subtileX: sx,
                subtileY: sy,
                subtileW: sw,
                subtileH: sh,
                mapBase64: Buffer.from(mapBytes).toString('base64'),
              })
            }
          }
        }
      } catch {
        // Peripheral rooms outside snapshot are skipped cleanly.
      }
      r = nextR
    }
  }
}

function channelStatuses(
  golden: TraceFrame,
  actual: TraceFrame,
  header: TraceHeader,
): { ch: SharedChannelStatus[]; nWine: number[]; nTs: number[] } {
  const ch: SharedChannelStatus[] = []
  const nWine: number[] = []
  const nTs: number[] = []
  for (const key of SHARED_CHANNEL_KEYS) {
    const g = golden[key]
    const a = actual[key]
    nWine.push(Array.isArray(g) ? (key === 'gs' ? 1 : g.length) : -1)
    nTs.push(Array.isArray(a) ? (key === 'gs' ? 1 : a.length) : -1)
    if (g === undefined) {
      ch.push(0)
      continue
    }
    const gOnly = { frame: golden.frame, [key]: g } as TraceFrame
    const aOnly = { frame: actual.frame, ...(a !== undefined ? { [key]: a } : {}) } as TraceFrame
    const d = diffFrame113c(gOnly, aOnly, header, 'strict')
    ch.push(d === null ? 1 : 2)
  }
  return { ch, nWine, nTs }
}

export interface RunLockstepReplayOptions {
  readonly scenarioName: string
  readonly goldenPath: string
  readonly snapshotPath: string
  readonly scenarioPath: string
  readonly coveragePath?: string | null
  readonly rootDir?: string
  readonly bootFrame?: number
  /** Optional inclusive `[startFrame, endFrame]` slice to serialize into `payload.frames` (all frames still stepped & checked!). */
  readonly frameWindow?: readonly [number, number]
  readonly trackPlayerStatIds?: readonly number[]
}

export function runLockstepReplayPayload(
  opts: RunLockstepReplayOptions,
): { payload: SharedReplayPayload; tsExecutedVas: readonly string[] } {
  const t0 = performance.now()
  const rootDir = opts.rootDir ?? DEFAULT_REPO_ROOT
  const bootFrame = opts.bootFrame ?? 2

  const golden: Trace = parseTrace(gunzipSync(readFileSync(opts.goldenPath)).toString('utf8'))
  const scenario = JSON.parse(readFileSync(opts.scenarioPath, 'utf8')) as ReplayScenario113c
  const header = golden.header
  const saveBytes =
    scenario.save !== undefined ? new Uint8Array(readFileSync(join(rootDir, scenario.save))) : undefined
  const snap = loadSnapshotFile113c(opts.snapshotPath)

  const inputsByFrame = new Map<number, string[]>()
  for (const inp of scenario.inputs) {
    let list = inputsByFrame.get(inp.frame)
    if (!list) {
      list = []
      inputsByFrame.set(inp.frame, list)
    }
    list.push(inp.c2s)
  }

  let lastGoldenFrame = 0
  for (const f of golden.frames.keys()) if (f > lastGoldenFrame) lastGoldenFrame = f

  const winStart = opts.frameWindow ? opts.frameWindow[0] : bootFrame
  const winEnd = opts.frameWindow ? Math.min(opts.frameWindow[1], lastGoldenFrame) : lastGoldenFrame
  const stopFrame = opts.frameWindow ? winEnd : lastGoldenFrame

  const roomMap = new Map<string, SharedReplayRoom>()
  const frames: SharedReplayFrame[] = []
  const recorded = SHARED_CHANNEL_KEYS.map(() => 0)
  const matched = SHARED_CHANNEL_KEYS.map(() => 0)
  let strictHorizon = bootFrame - 1
  let firstStrictDivergence: FieldDivergence113c | null = null
  let divergedFrames = 0
  let framesCompared = 0
  let unportedHit: string | null = null
  let tsExecutedVas: string[] = []

  const pushFrame = (f: number, gFrame: TraceFrame, sample: TraceFrame): void => {
    const diff = diffFrame113c(gFrame, sample, header, 'strict')
    const st = channelStatuses(gFrame, sample, header)
    framesCompared++
    for (let i = 0; i < SHARED_CHANNEL_KEYS.length; i++) {
      if (st.ch[i] !== 0) recorded[i]!++
      if (st.ch[i] === 1) matched[i]!++
    }
    if (diff !== null) divergedFrames++
    if (firstStrictDivergence === null) {
      if (diff === null) strictHorizon = f
      else firstStrictDivergence = diff
    }
    if (f >= winStart && f <= winEnd) {
      const pStats = extractPlayerStats(sample, header, opts.trackPlayerStatIds)
      frames.push({
        frame: f,
        c2s: inputsByFrame.get(f) ?? [],
        gsWine: gFrame.gs ? [gFrame.gs[0]! >>> 0, gFrame.gs[1]! >>> 0] : null,
        gsTs: sample.gs ? [sample.gs[0]! >>> 0, sample.gs[1]! >>> 0] : null,
        ch: st.ch,
        nWine: st.nWine,
        nTs: st.nTs,
        diff,
        wine: extractUnitTuples(gFrame, header),
        ts: extractUnitTuples(sample, header),
        ...(pStats ? { playerStats: pStats } : {}),
      })
    }
  }

  beginVaTrace113c()
  try {
    const world = bootFromSnapshot113c(snap, saveBytes)
    collectWorldActiveRooms(world.m, world.pGame, roomMap)
    const bootGolden = golden.frames.get(bootFrame)
    if (!bootGolden) throw new Error(`Golden trace '${opts.scenarioName}' missing boot frame ${bootFrame}`)
    pushFrame(bootFrame, bootGolden, sampleFrame113c(world, header))

    for (let f = bootFrame + 1; f <= stopFrame; f++) {
      const gFrame = golden.frames.get(f)
      if (!gFrame) throw new Error(`Golden trace '${opts.scenarioName}' missing frame ${f}`)
      try {
        stepFrame113c(world, (inputsByFrame.get(f) ?? []).map(hexToBytes))
      } catch (e) {
        if (!(e instanceof UnportedFunction113c)) throw e
        unportedHit = `F${f} ${manifestKey113c(e.module, e.va)} (${e.status})`
        if (firstStrictDivergence === null) {
          firstStrictDivergence = {
            frame: f,
            key: 'step',
            id: null,
            field: `<unported ${manifestKey113c(e.module, e.va)}>`,
            expected: 'frame simulated by the original game',
            actual: e.message,
          }
        }
        break
      }
      if (f % 40 === 0 || f === stopFrame) collectWorldActiveRooms(world.m, world.pGame, roomMap)
      pushFrame(f, gFrame, sampleFrame113c(world, header))
    }
  } finally {
    tsExecutedVas = [...endVaTrace113c()].sort()
  }

  let runtimeExec: SharedReplayPayload['runtimeExec'] | undefined
  if (opts.coveragePath && existsSync(opts.coveragePath)) {
    const cov = loadCoverageGzFile(opts.coveragePath)
    const tsSet = new Set(tsExecutedVas)
    let d2CommonDll = 0
    let d2CommonGap = 0
    let d2GameDll = 0
    let d2GameGap = 0
    for (const h of cov.hits) {
      const k = manifestKey113c(h.module, h.va)
      if (h.module === 'D2Common') {
        d2CommonDll++
        if (!tsSet.has(k)) d2CommonGap++
      } else if (h.module === 'D2Game') {
        d2GameDll++
        if (!tsSet.has(k)) d2GameGap++
      }
    }
    let d2CommonTs = 0
    let d2GameTs = 0
    for (const k of tsSet) {
      if (k.startsWith('D2Common:')) d2CommonTs++
      else if (k.startsWith('D2Game:')) d2GameTs++
    }
    runtimeExec = { d2CommonDll, d2CommonTs, d2CommonGap, d2GameDll, d2GameTs, d2GameGap }
  }

  const payload: SharedReplayPayload = {
    ok: true,
    scenario: opts.scenarioName,
    bootFrame,
    lastGoldenFrame,
    scenarioFrames: scenario.frames,
    windowStartFrame: winStart,
    windowEndFrame: winEnd,
    strictHorizon,
    firstStrictDivergence,
    unportedHit,
    framesCompared,
    divergedFrames,
    channelKeys: SHARED_CHANNEL_KEYS,
    channelTotals: SHARED_CHANNEL_KEYS.map((key, i) => ({
      key,
      recorded: recorded[i]!,
      matched: matched[i]!,
    })),
    inputCount: scenario.inputs.length,
    computeMs: Math.round(performance.now() - t0),
    header: {
      unitFields: header.unitFields,
      statIds: header.statIds,
      s2c: header.s2c === true,
      items: header.itemFields !== undefined,
    },
    rooms: [...roomMap.values()].sort((a, b) => a.subtileY - b.subtileY || a.subtileX - b.subtileX),
    frames,
    ...(runtimeExec ? { runtimeExec } : {}),
  }

  return { payload, tsExecutedVas }
}
