/**
 * Shared browser types, binary D2TV parsers, and Diablo II v1.13c metadata helpers
 * for `plugins/k1-showcase/` (pure browser TypeScript — zero Node imports).
 */

export type ReplayScenarioId = 'a1-town-walk' | 'a1c-bloodmoor-fallen'

export interface ShowcaseReplayUnit {
  readonly type: number
  readonly id: number
  readonly classId: number
  readonly mode: number
  readonly x: number
  readonly y: number
  readonly seedLo: number
  readonly seedHi: number
  readonly level: number
  readonly hp: number
  readonly maxHp: number
  readonly mana: number
  readonly maxMana: number
  readonly xp: number
  readonly charLevel: number
}

export interface ShowcaseReplayRoom {
  readonly key: string
  readonly levelId: number
  readonly subtileX: number
  readonly subtileY: number
  readonly subtileW: number
  readonly subtileH: number
  readonly mapBase64: string
}

export interface ShowcaseReplayFrame {
  readonly frame: number
  readonly gsWine: readonly [number, number] | null
  readonly gsTs: readonly [number, number] | null
  readonly c2s: readonly string[]
  readonly diff: {
    readonly frame: number
    readonly key: string
    readonly id: number | null
    readonly field: string
    readonly expected: unknown
    readonly actual: unknown
  } | null
  readonly wineUnits: readonly ShowcaseReplayUnit[]
  readonly tsUnits: readonly ShowcaseReplayUnit[]
}

export interface ShowcaseReplayPayload {
  readonly ok: true
  readonly scenario: ReplayScenarioId
  readonly bootFrame: number
  readonly lastGoldenFrame: number
  readonly strictHorizon: number
  readonly posHorizon: number
  readonly firstStrictDivergence: ShowcaseReplayFrame['diff']
  readonly firstPosDivergence: ShowcaseReplayFrame['diff']
  readonly totalFramesCompared: number
  readonly computeMs: number
  readonly initSeed: number
  readonly inputCount: number
  readonly rooms: readonly ShowcaseReplayRoom[]
  readonly frames: readonly ShowcaseReplayFrame[]
}

export interface ShowcaseDrlgLevelMeta {
  readonly id: number
  readonly act: number
  readonly nameEn: string
  readonly nameZh: string
  readonly internalName: string
  readonly isInside: boolean
  readonly drlgType: number
  readonly isTown: boolean
  readonly defaultRoomsD0: number
  readonly defaultRoomsD2: number
}

export interface ShowcaseDrlgCatalogResponse {
  readonly ok: true
  readonly totalRecords: number
  readonly seedCount: number
  readonly diffCount: number
  readonly levelCount: number
  readonly digestSha256: string
  readonly frozenSeeds: readonly number[]
  readonly townLevelIds: readonly number[]
  readonly diffSensitiveLevels: readonly number[]
  readonly actSummary: ReadonlyArray<{
    readonly act: number
    readonly levelCount: number
    readonly vectorCount: number
  }>
  readonly levels: readonly ShowcaseDrlgLevelMeta[]
}

export interface DrlgRoomRecordBrowser {
  readonly levelId: number
  readonly idx: number
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly nType: number
  readonly dwFlags: number
  readonly presetId: number
  readonly presetSub: number
  readonly dwInitSeed: number
  readonly seedLo: number
  readonly seedHi: number
}

export interface ShowcaseDrlgPresetPoint {
  readonly roomIdx: number
  readonly unitType: number
  readonly txtId: number
  readonly mode: number
  readonly subtileX: number
  readonly subtileY: number
}

export interface ShowcaseDrlgCollRoom {
  readonly roomIdx: number
  readonly subtileX: number
  readonly subtileY: number
  readonly subtileW: number
  readonly subtileH: number
  readonly mapBase64: string
}

export interface ShowcaseDrlgLevelRunResponse {
  readonly ok: true
  readonly seed: number
  readonly diff: number
  readonly levelId: number
  readonly act: number
  readonly nameEn: string
  readonly nameZh: string
  readonly drlgType: number
  readonly computeMs: number
  readonly header: {
    readonly levelId: number
    readonly act: number
    readonly diff: number
    readonly flags: number
    readonly drlgType: number
    readonly dwFlags: number
    readonly nRooms: number
    readonly posX: number
    readonly posY: number
    readonly sizeX: number
    readonly sizeY: number
    readonly nLevelType: number
    readonly seedLo: number
    readonly seedHi: number
  }
  readonly rooms: readonly DrlgRoomRecordBrowser[]
  readonly presets: readonly ShowcaseDrlgPresetPoint[]
  readonly collRooms: readonly ShowcaseDrlgCollRoom[]
  readonly totalSubtiles: number
  readonly parity: {
    readonly isFrozenSeed: boolean
    readonly computedLayoutHash: string
    readonly computedCollHash: string
    readonly oracleLayoutHash: string | null
    readonly oracleCollHash: string | null
    readonly layoutXor: string | null
    readonly collXor: string | null
    readonly roomsD2tvMatch: boolean | null
    readonly townCollD2tvMatch: boolean | null
    readonly exactMatch: boolean | null
  }
}

export interface PathWorldMetaBrowser {
  readonly magic: number
  readonly version: number
  readonly seed: number
  readonly diff: number
  readonly pActVa: number
  readonly pDrlgVa: number
  readonly pLevelVa: number
  readonly pUnitVa: number
  readonly pTargetUnitVa: number
  readonly pPathVa: number
  readonly nActiveRooms: number
  readonly activeRoomVas: readonly number[]
}

export interface ShowcasePathWorldResponse {
  readonly ok: true
  readonly worldSha256: string
  readonly meta: PathWorldMetaBrowser
  readonly fogSinTableU32: readonly number[]
  readonly pages: ReadonlyArray<{ readonly va: number; readonly dataBase64: string }>
  readonly rooms: ReadonlyArray<{
    readonly idx: number
    readonly roomVa: number
    readonly pMapVa: number
    readonly subtileX: number
    readonly subtileY: number
    readonly subtileW: number
    readonly subtileH: number
    readonly touchedInImg: boolean
    readonly mapBase64: string
  }>
}

export interface PathTypeSummaryEntry {
  readonly pathType: number
  readonly name: string
  readonly handlerVa: string
  readonly description: string
  readonly total: number
  readonly nonFault: number
  readonly posRet: number
  readonly fogAssert: number
  readonly maxPoints: number
}

export interface BrowserPathVectorRecord {
  readonly idx: number
  readonly pathType: number
  readonly unitType: number
  readonly classId: number
  readonly a2: number
  readonly bAllocFlag: number
  readonly nDistMax: number
  readonly nStepNum: number
  readonly preFlags: number
  readonly startX: number
  readonly startY: number
  readonly targetX: number
  readonly targetY: number
  readonly velOverride: number
  readonly prevPathType: number
  readonly targetDx: number
  readonly targetDy: number
  readonly unitSeedLo: number
  readonly ret: number
  readonly faultKind: number
  readonly faultStage: number
  readonly faultLine: number
  readonly dwPathType: number
  readonly dwPrevPathType: number
  readonly dwFlags: number
  readonly nDirection: number
  readonly nNewDirection: number
  readonly outTargetX: number
  readonly outTargetY: number
  readonly dwCurrentPointIdx: number
  readonly dwPathPoints: number
  readonly dwUnitSize: number
  readonly pathPoints: ReadonlyArray<{ readonly x: number; readonly y: number }>
}

export interface ShowcasePathVectorsJsonResponse {
  readonly ok: true
  readonly totalCount: number
  readonly vectorsSha256: string
  readonly filteredCount: number
  readonly offset: number
  readonly limit: number
  readonly byPathType: readonly PathTypeSummaryEntry[]
  readonly records: readonly BrowserPathVectorRecord[]
}

export type CallgraphSubsystem =
  | 'drlg'
  | 'path'
  | 'collision'
  | 'statlist'
  | 'unit'
  | 'items'
  | 'missile'
  | 'datatbls'
  | 'skills'
  | 'monsters'
  | 'inventory'
  | 'prng'
  | 'combat'
  | 'ai'
  | 'quest'
  | 'other'

export interface ShowcaseModuleStats {
  readonly total: number
  readonly diffVerified: number
  readonly ported: number
  readonly unported: number
  readonly totalBytes: number
  readonly portedBytes: number
  readonly minVa: string
  readonly maxVa: string
  readonly completionPct: number
}

export interface ShowcaseCallgraphNode {
  readonly key: string
  readonly module: 'D2Common' | 'D2Game'
  readonly va: string
  readonly vaNum: number
  readonly name: string
  readonly size: number
  readonly sccId: number
  readonly topoLevel: number
  readonly status: 'diff-verified' | 'ported' | 'unported'
  readonly subsystem: CallgraphSubsystem
  readonly kernFile: string | null
  readonly tsSymbol: string | null
  readonly callerCount: number
  readonly calleeCount: number
  readonly hasEvidence: boolean
}

export interface ShowcaseCallgraphResponse {
  readonly ok: true
  readonly summary: {
    readonly totalReachable: number
    readonly d2Common: ShowcaseModuleStats
    readonly d2Game: ShowcaseModuleStats
  }
  readonly subsystems: ReadonlyArray<{
    readonly subsystem: CallgraphSubsystem
    readonly d2CommonCount: number
    readonly d2GameCount: number
    readonly diffVerifiedCount: number
    readonly portedCount: number
    readonly unportedCount: number
  }>
  readonly functions: readonly ShowcaseCallgraphNode[]
}

export interface ShowcaseFunctionDetailResponse {
  readonly ok: true
  readonly fn: ShowcaseCallgraphNode
  readonly diffEvidence: string | null
  readonly tsReference: string | null
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
  readonly callers: readonly ShowcaseCallgraphNode[]
  readonly callees: readonly ShowcaseCallgraphNode[]
}

export interface ShowcaseOverviewResponse {
  readonly ok: true
  readonly d2Common: ShowcaseModuleStats
  readonly d2Game: ShowcaseModuleStats
  readonly drlg: {
    readonly totalVectors: number
    readonly seedCount: number
    readonly diffCount: number
    readonly levelCount: number
    readonly digestSha256: string
  }
  readonly path: {
    readonly totalVectors: number
    readonly pathTypeCount: number
    readonly activeRooms: number
    readonly vectorsSha256: string
    readonly worldSha256: string
  }
  readonly replays: ReadonlyArray<{
    readonly scenario: ReplayScenarioId
    readonly bootFrame: number
    readonly frames: number
  }>
}

// ---------------------------------------------------------------------------
// Binary & Base64 Helpers (Browser-Safe)
// ---------------------------------------------------------------------------

export function decodeBase64Bytes(b64: string): Uint8Array {
  const binStr = atob(b64)
  const out = new Uint8Array(binStr.length)
  for (let i = 0; i < binStr.length; i++) {
    out[i] = binStr.charCodeAt(i) & 0xff
  }
  return out
}

export function decodeBase64Uint16LE(b64: string): Uint16Array {
  const bytes = decodeBase64Bytes(b64)
  const count = bytes.byteLength >>> 1
  const out = new Uint16Array(count)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = 0; i < count; i++) {
    out[i] = dv.getUint16(i * 2, true)
  }
  return out
}

const PATHVEC_RECORD_SIZE = 460
const D2TV_MAGIC = 0x56543244

export function parsePathVectorsBinaryInBrowser(buf: ArrayBuffer): BrowserPathVectorRecord[] {
  const hdrDv = new DataView(buf, 0, 32)
  const magic = hdrDv.getUint32(0, true)
  if (magic !== D2TV_MAGIC) {
    throw new Error(`Invalid D2TV magic 0x${magic.toString(16)}`)
  }
  const recSize = hdrDv.getUint32(16, true)
  const recCount = hdrDv.getUint32(20, true)
  if (recSize !== PATHVEC_RECORD_SIZE) {
    throw new Error(`Unexpected PATHVEC recordSize ${recSize}`)
  }

  const dv = new DataView(buf, 32, recCount * PATHVEC_RECORD_SIZE)
  const out: BrowserPathVectorRecord[] = new Array<BrowserPathVectorRecord>(recCount)
  for (let r = 0; r < recCount; r++) {
    const off = r * PATHVEC_RECORD_SIZE
    const dwPathPoints = dv.getUint32(off + 0x54, true)
    const ptCount = Math.min(78, dwPathPoints)
    const pts: Array<{ x: number; y: number }> = new Array(ptCount)
    for (let i = 0; i < ptCount; i++) {
      const pOff = off + 0x68 + i * 4
      pts[i] = {
        x: dv.getUint16(pOff, true),
        y: dv.getUint16(pOff + 2, true),
      }
    }
    out[r] = {
      idx: r,
      pathType: dv.getUint8(off + 0x00),
      unitType: dv.getUint8(off + 0x01),
      classId: dv.getUint16(off + 0x02, true),
      a2: dv.getUint8(off + 0x04),
      bAllocFlag: dv.getUint8(off + 0x05),
      nDistMax: dv.getUint8(off + 0x06),
      nStepNum: dv.getUint8(off + 0x07),
      preFlags: dv.getUint32(off + 0x08, true),
      startX: dv.getUint16(off + 0x0c, true),
      startY: dv.getUint16(off + 0x0e, true),
      targetX: dv.getUint16(off + 0x10, true),
      targetY: dv.getUint16(off + 0x12, true),
      velOverride: dv.getInt32(off + 0x14, true),
      prevPathType: dv.getUint8(off + 0x18),
      targetDx: dv.getInt8(off + 0x19),
      targetDy: dv.getInt8(off + 0x1a),
      unitSeedLo: dv.getUint32(off + 0x1c, true),
      ret: dv.getInt32(off + 0x20, true),
      faultKind: dv.getUint8(off + 0x24),
      faultStage: dv.getUint8(off + 0x25),
      faultLine: dv.getUint32(off + 0x30, true),
      dwPathType: dv.getUint32(off + 0x34, true),
      dwPrevPathType: dv.getUint32(off + 0x38, true),
      dwFlags: dv.getUint32(off + 0x3c, true),
      nDirection: dv.getUint8(off + 0x40),
      nNewDirection: dv.getUint8(off + 0x41),
      outTargetX: dv.getInt32(off + 0x48, true),
      outTargetY: dv.getInt32(off + 0x4c, true),
      dwCurrentPointIdx: dv.getUint32(off + 0x50, true),
      dwPathPoints,
      dwUnitSize: dv.getUint32(off + 0x58, true),
      pathPoints: pts,
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Diablo II v1.13c Labels & Palettes
// ---------------------------------------------------------------------------

const PLAYER_CLASS_NAMES: Readonly<Record<number, string>> = {
  0: 'Amazon',
  1: 'Sorceress',
  2: 'Necromancer',
  3: 'Paladin',
  4: 'Barbarian',
  5: 'Druid',
  6: 'Assassin',
}

const MONSTER_CLASS_NAMES: Readonly<Record<number, string>> = {
  0: 'Skeleton',
  1: 'Returned',
  5: 'Zombie',
  6: 'Hungry Dead',
  19: 'Fallen',
  20: 'Carver',
  58: 'Fallen Shaman',
  63: 'Quill Rat',
  146: 'Deckard Cain',
  147: 'Gheed',
  148: 'Akara',
  149: 'Chicken',
  150: 'Kashya',
  151: 'Rat',
  152: 'Rogue',
  153: 'Hell Meteor',
  154: 'Charsi',
  155: 'Warriv',
  188: 'Cow',
  206: 'Foul Crow',
  359: 'Fire',
}

const PLAYER_MODES: Readonly<Record<number, string>> = {
  0: 'DT (Death)',
  1: 'NU (Neutral)',
  2: 'WL (Walk)',
  3: 'RN (Run)',
  4: 'GH (GetHit)',
  5: 'TN (TownNeutral)',
  6: 'TW (TownWalk)',
  7: 'A1 (Attack1)',
  8: 'A2 (Attack2)',
  9: 'BL (Block)',
  10: 'SC (Cast)',
  17: 'DD (Dead)',
}

const MONSTER_MODES: Readonly<Record<number, string>> = {
  0: 'DT (Death)',
  1: 'NU (Neutral)',
  2: 'WL (Walk)',
  3: 'GH (GetHit)',
  4: 'A1 (Attack1)',
  5: 'A2 (Attack2)',
  6: 'BL (Block)',
  7: 'SC (Cast)',
  8: 'S1 (Skill1)',
  12: 'DD (Corpse)',
  14: 'RN (Run)',
}

export function formatUnitLabel(type: number, classId: number, id: number): string {
  if (type === 0) {
    return `${PLAYER_CLASS_NAMES[classId] ?? `Player#${classId}`} (#${id})`
  }
  if (type === 1) {
    return `${MONSTER_CLASS_NAMES[classId] ?? `Mon#${classId}`} (#${id})`
  }
  if (type === 3) {
    return `Missile#${classId} (#${id})`
  }
  return `Type${type}:${classId} (#${id})`
}

export function formatUnitMode(type: number, mode: number): string {
  if (type === 0) return PLAYER_MODES[mode] ?? `M${mode}`
  if (type === 1) return MONSTER_MODES[mode] ?? `M${mode}`
  return `M${mode}`
}

export function formatHex32(v: number): string {
  return `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

export const SUBSYSTEM_COLORS: Readonly<Record<CallgraphSubsystem, string>> = {
  drlg: '#e8b954',
  path: '#38d9a9',
  collision: '#4dabf7',
  statlist: '#da77f2',
  unit: '#69db7c',
  items: '#ffa94d',
  missile: '#ff6b6b',
  datatbls: '#74c0fc',
  skills: '#f783ac',
  monsters: '#e599f7',
  inventory: '#ffd43b',
  prng: '#63e6be',
  combat: '#ff8787',
  ai: '#91a7ff',
  quest: '#ffe066',
  other: '#938873',
}
