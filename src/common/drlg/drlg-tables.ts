/**
 * Compiled 1.13c data tables consumed by the DRLG port, parsed from the game's `.bin` files with
 * the exact record layouts of D2MOO (source/D2Common/include/DataTbls/*.h, commit 5596f5c,
 * `#pragma pack(1)`, 32-bit pointers). These are the files D2Common itself loads, and the same
 * files the native oracle (tools/d2moo-oracle) loads, so both sides consume identical data.
 *
 * A `.bin` file is an int32 record count followed by `count * sizeof(record)` bytes. Every loader
 * checks the body size against the record size (a layout mismatch is a hard error).
 *
 * The D2MOO post-processing that matters for generation is reproduced:
 *   - LvlPrest/LvlSub/LvlTypes file names: '/' -> '\\', prefixed with DATA\GLOBAL\TILES\ when the
 *     name is longer than one character (DATATBLS_LoadLvlPrestTxt / LoadLvlSubTxt / LoadLevelTypesTxt).
 *   - LvlSub type start ids (DATATBLS_LoadLvlSubTxt).
 *   - MonPreset act sections (DATATBLS_LoadMonPresetTxt).
 */

export type DrlgTableName =
  | 'levels'
  | 'leveldefs'
  | 'lvlprest'
  | 'lvltypes'
  | 'lvlwarp'
  | 'lvlmaze'
  | 'lvlsub'
  | 'objects'
  | 'monpreset'
  | 'monstats'
  | 'superuniques'

/** Game data access for the DRLG: compiled tables and archive files (DS1/DT1). */
export interface DrlgDataSource {
  /** Bytes of data\global\excel\<name>.bin. Must throw when missing. */
  readTable(name: DrlgTableName): Uint8Array
  /** Bytes of an archive file, e.g. `DATA\GLOBAL\TILES\Act1\Town\TownS1.ds1`. Must throw when missing. */
  readFile(path: string): Uint8Array
}

/** sizeof() of every record, 1.13c layout (D2MOO headers). */
const RECORD_SIZE: Record<DrlgTableName, number> = {
  levels: 0x220, // D2LevelsTxt
  leveldefs: 0x9c, // D2LevelDefBin
  lvlprest: 0x1b0, // D2LvlPrestTxt
  lvltypes: 0x788, // D2LvlTypesTxt
  lvlwarp: 0x30, // D2LvlWarpTxt
  lvlmaze: 0x1c, // D2LvlMazeTxt
  lvlsub: 0x15c, // D2LvlSubTxt
  objects: 0x1c0, // D2ObjectsTxt
  monpreset: 0x4, // D2MonPresetTxt
  monstats: 0x1a8, // D2MonStatsTxt
  superuniques: 0x34, // D2SuperUniquesTxt
}

interface BinTable {
  readonly count: number
  readonly view: DataView
  readonly recordSize: number
}

function loadBin(source: DrlgDataSource, name: DrlgTableName): BinTable {
  const bytes = source.readTable(name)
  if (bytes.byteLength < 4) throw new Error(`${name}.bin is truncated (${bytes.byteLength} bytes)`)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = view.getInt32(0, true)
  const recordSize = RECORD_SIZE[name]
  const body = bytes.byteLength - 4
  if (count <= 0 || body !== count * recordSize) {
    throw new Error(`${name}.bin: ${count} records x ${recordSize} bytes != ${body} body bytes (layout mismatch)`)
  }
  return { count, view: new DataView(bytes.buffer, bytes.byteOffset + 4, body), recordSize }
}

function cString(view: DataView, offset: number, size: number): string {
  let s = ''
  for (let i = 0; i < size; i += 1) {
    const c = view.getUint8(offset + i)
    if (c === 0) return s
    s += String.fromCharCode(c)
  }
  throw new Error(`unterminated string at offset ${offset}`)
}

/**
 * `'/' -> '\\'` then `wsprintfA(buf, "%s\\%s", "DATA\\GLOBAL\\TILES", name)` when strlen > 1.
 * The C++ destination is a char[60]; longer results would overflow, so they are rejected.
 */
function tilesPath(raw: string): string {
  const name = raw.replace(/\//g, '\\')
  if (name.length <= 1) return name
  const full = `DATA\\GLOBAL\\TILES\\${name}`
  if (full.length > 59) throw new Error(`tile path longer than 59 characters: ${full}`)
  return full
}

export interface LevelDefRecord {
  readonly dwQuestFlag: number
  readonly dwQuestFlagEx: number
  readonly dwLayer: number
  readonly dwSizeX: readonly [number, number, number]
  readonly dwSizeY: readonly [number, number, number]
  readonly dwOffsetX: number
  readonly dwOffsetY: number
  readonly dwDepend: number
  readonly dwDrlgType: number
  readonly dwLevelType: number
  readonly dwSubType: number
  readonly dwSubTheme: number
  readonly dwSubWaypoint: number
  readonly dwSubShrine: number
  readonly dwVis: readonly number[]
  /** uint32 in the .bin, read as int32 like D2DrlgWarpStrc::nWarp (-1 = none). */
  readonly dwWarp: readonly number[]
  readonly nIntensity: number
  readonly nRed: number
  readonly nGreen: number
  readonly nBlue: number
  readonly dwPortal: number
  readonly dwPosition: number
  readonly dwSaveMonsters: number
  readonly dwLOSDraw: number
}

export interface LvlPrestRecord {
  readonly dwDef: number
  readonly dwLevelId: number
  readonly dwPopulate: number
  readonly dwLogicals: number
  readonly dwOutdoors: number
  readonly dwAnimate: number
  readonly dwKillEdge: number
  readonly dwFillBlanks: number
  readonly dwExpansion: number
  readonly nAnimSpeed: number
  readonly nSizeX: number
  readonly nSizeY: number
  readonly dwAutoMap: number
  readonly dwScan: number
  readonly dwPops: number
  readonly dwPopPad: number
  readonly dwFiles: number
  /** Six names, already converted by DATATBLS_LoadLvlPrestTxt. */
  readonly szFile: readonly string[]
  readonly dwDt1Mask: number
}

export interface LvlTypesRecord {
  /** 32 names, already converted by DATATBLS_LoadLevelTypesTxt. */
  readonly szFile: readonly string[]
  readonly nAct: number
  readonly dwExpansion: number
}

export interface LvlWarpRecord {
  readonly dwLevelId: number
  readonly dwSelectX: number
  readonly dwSelectY: number
  readonly dwSelectDX: number
  readonly dwSelectDY: number
  readonly dwExitWalkX: number
  readonly dwExitWalkY: number
  readonly dwOffsetX: number
  readonly dwOffsetY: number
  readonly dwLitVersion: number
  readonly dwTiles: number
  readonly szDirection: string
}

export interface LvlMazeRecord {
  readonly dwLevelId: number
  readonly dwRooms: readonly [number, number, number]
  readonly dwSizeX: number
  readonly dwSizeY: number
  readonly dwMerge: number
}

export interface LvlSubRecord {
  /** Index in LvlSub.bin. */
  readonly index: number
  readonly dwType: number
  /** Already converted by DATATBLS_LoadLvlSubTxt. */
  readonly szFile: string
  readonly dwCheckAll: number
  readonly dwBordType: number
  readonly dwDt1Mask: number
  readonly dwGridSize: number
  readonly nProb: readonly number[]
  readonly nTrials: readonly number[]
  readonly nMax: readonly number[]
  readonly dwExpansion: number
}

export interface MonPresetRecord {
  readonly nAct: number
  readonly nType: number
  readonly wPlace: number
}

export interface LevelMonsterPoolRecord {
  readonly levelId: number
  readonly act: number
  readonly normalMonsters: readonly number[]
  readonly nightmareHellMonsters: readonly number[]
  readonly uniqueMonsters: readonly number[]
  readonly critterMonsters: readonly number[]
}

export interface DrlgTables {
  /** sgptDataTables->nLevelsTxtRecordCount (bounds DATATBLS_GetLevelDefRecord). */
  readonly nLevelsTxtRecordCount: number
  readonly levelDefs: readonly LevelDefRecord[]
  readonly lvlPrest: readonly LvlPrestRecord[]
  readonly lvlTypes: readonly LvlTypesRecord[]
  readonly lvlWarp: readonly LvlWarpRecord[]
  readonly lvlMaze: readonly LvlMazeRecord[]
  readonly lvlSub: readonly LvlSubRecord[]
  /** sgptDataTables->pLvlSubTypeStartIds (index = LvlSub type). */
  readonly lvlSubTypeStartIds: readonly number[]
  /** D2ObjectsTxt::nSubClass per object id. */
  readonly objectSubClass: Uint8Array
  readonly monPreset: readonly MonPresetRecord[]
  /** DATATBLS_LoadMonPresetTxt act sections: start index and record count per act 0..4. */
  readonly monPresetActStart: readonly number[]
  readonly monPresetActCount: readonly number[]
  readonly nMonStatsTxtRecordCount: number
  readonly nSuperUniquesTxtRecordCount: number
  /** D2LevelsTxt monster spawn pools (`wNormalMonsters`, `wNightmareHellMonsters`, `wUniqueMonsters`, `wCMon`) per level id (#1025). */
  readonly levelMonsters?: readonly LevelMonsterPoolRecord[]
  /** For each MonStats.txt hcIdx, related hcIdx values (`self`, `wMinion[0..1]`, `wSpawn`) (#1025). */
  readonly monStatsRelatedHcIdx?: readonly (readonly number[])[]
  /** For each SuperUniques.txt record index, its `dwClass` MonStats.txt hcIdx (#1025). */
  readonly superUniqueClassIds?: readonly number[]
}

function i32s(view: DataView, offset: number, n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i += 1) out.push(view.getInt32(offset + 4 * i, true))
  return out
}

export function loadDrlgTables(source: DrlgDataSource): DrlgTables {
  const levels = loadBin(source, 'levels')

  const ld = loadBin(source, 'leveldefs')
  const levelDefs: LevelDefRecord[] = []
  for (let i = 0; i < ld.count; i += 1) {
    const v = ld.view
    const o = i * ld.recordSize
    const g = (off: number): number => v.getInt32(o + off, true)
    levelDefs.push({
      dwQuestFlag: g(0x00),
      dwQuestFlagEx: g(0x04),
      dwLayer: g(0x08),
      dwSizeX: [g(0x0c), g(0x10), g(0x14)],
      dwSizeY: [g(0x18), g(0x1c), g(0x20)],
      dwOffsetX: g(0x24),
      dwOffsetY: g(0x28),
      dwDepend: g(0x2c),
      dwDrlgType: g(0x30),
      dwLevelType: g(0x34),
      dwSubType: g(0x38),
      dwSubTheme: g(0x3c),
      dwSubWaypoint: g(0x40),
      dwSubShrine: g(0x44),
      dwVis: i32s(v, o + 0x48, 8),
      dwWarp: i32s(v, o + 0x68, 8),
      nIntensity: v.getUint8(o + 0x88),
      nRed: v.getUint8(o + 0x89),
      nGreen: v.getUint8(o + 0x8a),
      nBlue: v.getUint8(o + 0x8b),
      dwPortal: g(0x8c),
      dwPosition: g(0x90),
      dwSaveMonsters: g(0x94),
      dwLOSDraw: g(0x98),
    })
  }

  const lp = loadBin(source, 'lvlprest')
  const lvlPrest: LvlPrestRecord[] = []
  for (let i = 0; i < lp.count; i += 1) {
    const v = lp.view
    const o = i * lp.recordSize
    const g = (off: number): number => v.getInt32(o + off, true)
    const szFile: string[] = []
    for (let j = 0; j < 6; j += 1) szFile.push(tilesPath(cString(v, o + 0x44 + 60 * j, 60)))
    lvlPrest.push({
      dwDef: g(0x00),
      dwLevelId: g(0x04),
      dwPopulate: g(0x08),
      dwLogicals: g(0x0c),
      dwOutdoors: g(0x10),
      dwAnimate: g(0x14),
      dwKillEdge: g(0x18),
      dwFillBlanks: g(0x1c),
      dwExpansion: g(0x20),
      nAnimSpeed: g(0x24),
      nSizeX: g(0x28),
      nSizeY: g(0x2c),
      dwAutoMap: g(0x30),
      dwScan: g(0x34),
      dwPops: g(0x38),
      dwPopPad: g(0x3c),
      dwFiles: g(0x40),
      szFile,
      dwDt1Mask: v.getUint32(o + 0x1ac, true),
    })
  }

  const lt = loadBin(source, 'lvltypes')
  const lvlTypes: LvlTypesRecord[] = []
  for (let i = 0; i < lt.count; i += 1) {
    const v = lt.view
    const o = i * lt.recordSize
    const szFile: string[] = []
    for (let j = 0; j < 32; j += 1) szFile.push(tilesPath(cString(v, o + 60 * j, 60)))
    lvlTypes.push({ szFile, nAct: v.getUint8(o + 0x780), dwExpansion: v.getInt32(o + 0x784, true) })
  }

  const lw = loadBin(source, 'lvlwarp')
  const lvlWarp: LvlWarpRecord[] = []
  for (let i = 0; i < lw.count; i += 1) {
    const v = lw.view
    const o = i * lw.recordSize
    const g = (off: number): number => v.getInt32(o + off, true)
    lvlWarp.push({
      dwLevelId: g(0x00),
      dwSelectX: g(0x04),
      dwSelectY: g(0x08),
      dwSelectDX: g(0x0c),
      dwSelectDY: g(0x10),
      dwExitWalkX: g(0x14),
      dwExitWalkY: g(0x18),
      dwOffsetX: g(0x1c),
      dwOffsetY: g(0x20),
      dwLitVersion: g(0x24),
      dwTiles: g(0x28),
      szDirection: cString(v, o + 0x2c, 4),
    })
  }

  const lm = loadBin(source, 'lvlmaze')
  const lvlMaze: LvlMazeRecord[] = []
  for (let i = 0; i < lm.count; i += 1) {
    const v = lm.view
    const o = i * lm.recordSize
    const g = (off: number): number => v.getInt32(o + off, true)
    lvlMaze.push({
      dwLevelId: g(0x00),
      dwRooms: [g(0x04), g(0x08), g(0x0c)],
      dwSizeX: g(0x10),
      dwSizeY: g(0x14),
      dwMerge: g(0x18),
    })
  }

  const ls = loadBin(source, 'lvlsub')
  const lvlSub: LvlSubRecord[] = []
  for (let i = 0; i < ls.count; i += 1) {
    const v = ls.view
    const o = i * ls.recordSize
    const g = (off: number): number => v.getInt32(o + off, true)
    lvlSub.push({
      index: i,
      dwType: v.getUint32(o + 0x00, true),
      szFile: tilesPath(cString(v, o + 0x04, 60)),
      dwCheckAll: g(0x40),
      dwBordType: g(0x44),
      dwDt1Mask: v.getUint32(o + 0x48, true),
      dwGridSize: g(0x4c),
      nProb: i32s(v, o + 0x11c, 5),
      nTrials: i32s(v, o + 0x130, 5),
      nMax: i32s(v, o + 0x144, 5),
      dwExpansion: g(0x158),
    })
  }
  // DATATBLS_LoadLvlSubTxt: pLvlSubTypeStartIds[type] = first record of each run of equal types.
  let maxType = 0
  for (const rec of lvlSub) if (rec.dwType > maxType) maxType = rec.dwType
  const lvlSubTypeStartIds = new Array<number>(maxType + 1).fill(0)
  {
    let dwType = 0
    for (let i = 0; i < lvlSub.length; i += 1) {
      if (lvlSub[i]!.dwType !== dwType) {
        dwType = lvlSub[i]!.dwType
        lvlSubTypeStartIds[dwType] = i
      }
    }
  }

  const ob = loadBin(source, 'objects')
  const objectSubClass = new Uint8Array(ob.count)
  for (let i = 0; i < ob.count; i += 1) objectSubClass[i] = ob.view.getUint8(i * ob.recordSize + 0x167)

  const mp = loadBin(source, 'monpreset')
  const monPreset: MonPresetRecord[] = []
  for (let i = 0; i < mp.count; i += 1) {
    const o = i * mp.recordSize
    monPreset.push({ nAct: mp.view.getUint8(o), nType: mp.view.getUint8(o + 1), wPlace: mp.view.getUint16(o + 2, true) })
  }
  // DATATBLS_LoadMonPresetTxt (MonsterTbls.cpp:2524-2557) act sectioning.
  const monPresetActStart = [0, 0, 0, 0, 0]
  const monPresetActCount = [0, 0, 0, 0, 0]
  {
    let nActRecords = 0
    let nAct = 0
    for (let i = 0; i < monPreset.length; i += 1) {
      for (let j = nAct + 1; j < monPreset[i]!.nAct; j += 1) {
        monPresetActCount[nAct] = nActRecords
        nAct += 1
        nActRecords = 0
        monPresetActStart[nAct] = i
      }
      nActRecords += 1
    }
    monPresetActCount[nAct] = nActRecords
  }

  const ms = loadBin(source, 'monstats')
  const su = loadBin(source, 'superuniques')

  // D2MonStatsTxt (MonsterTbls.h): wSpawn (+0x20), wMinion[0..1] (+0x26, +0x28).
  const monStatsRelatedHcIdx: number[][] = []
  for (let i = 0; i < ms.count; i += 1) {
    const o = i * ms.recordSize
    const wSpawn = ms.view.getInt16(o + 0x20, true)
    const wMinion0 = ms.view.getInt16(o + 0x26, true)
    const wMinion1 = ms.view.getInt16(o + 0x28, true)
    const related = [i]
    for (const rel of [wMinion0, wMinion1, wSpawn]) {
      if (rel >= 0 && rel < ms.count && !related.includes(rel)) {
        related.push(rel)
      }
    }
    monStatsRelatedHcIdx.push(related)
  }

  // D2SuperUniquesTxt (MonsterTbls.h): dwClass (+0x04).
  const superUniqueClassIds: number[] = []
  for (let i = 0; i < su.count; i += 1) {
    const dwClass = su.view.getInt32(i * su.recordSize + 0x04, true)
    superUniqueClassIds.push(dwClass >= 0 && dwClass < ms.count ? dwClass : -1)
  }

  const expandMonsters = (rawIds: readonly number[]): number[] => {
    const seen = new Set<number>()
    const out: number[] = []
    for (const id of rawIds) {
      if (id < 0 || id >= ms.count) continue
      const rels = monStatsRelatedHcIdx[id] ?? [id]
      for (const r of rels) {
        if (!seen.has(r)) {
          seen.add(r)
          out.push(r)
        }
      }
    }
    return out
  }

  // D2LevelsTxt (LevelsTbls.h / DATATBLS_LoadLevelsTxt):
  //   +0x00 uint16 wLevelNo
  //   +0x03 uint8  nAct
  //   +0x36 int16  wNormalMonsters[25]        (first < 0 terminates)
  //   +0x68 int16  wNightmareHellMonsters[25] (first < 0 terminates)
  //   +0x9A int16  wUniqueMonsters[25]        (first < 0 terminates)
  //   +0xCC uint16 wCMon[4]                   (int16 < 0 when none)
  const levelMonsters: LevelMonsterPoolRecord[] = []
  for (let i = 0; i < levels.count; i += 1) {
    const o = i * levels.recordSize
    const levelId = levels.view.getUint16(o + 0x00, true)
    const act = levels.view.getUint8(o + 0x03)
    const rawNormal: number[] = []
    for (let k = 0; k < 25; k += 1) {
      const id = levels.view.getInt16(o + 0x36 + 2 * k, true)
      if (id < 0) break
      rawNormal.push(id)
    }
    const rawNightmareHell: number[] = []
    for (let k = 0; k < 25; k += 1) {
      const id = levels.view.getInt16(o + 0x68 + 2 * k, true)
      if (id < 0) break
      rawNightmareHell.push(id)
    }
    const rawUnique: number[] = []
    for (let k = 0; k < 25; k += 1) {
      const id = levels.view.getInt16(o + 0x9a + 2 * k, true)
      if (id < 0) break
      rawUnique.push(id)
    }
    const rawCritter: number[] = []
    for (let k = 0; k < 4; k += 1) {
      const id = levels.view.getInt16(o + 0xcc + 2 * k, true)
      if (id >= 0) rawCritter.push(id)
    }
    levelMonsters.push({
      levelId,
      act,
      normalMonsters: expandMonsters(rawNormal),
      nightmareHellMonsters: expandMonsters(rawNightmareHell),
      uniqueMonsters: expandMonsters(rawUnique),
      critterMonsters: expandMonsters(rawCritter),
    })
  }

  return {
    nLevelsTxtRecordCount: levels.count,
    levelDefs,
    lvlPrest,
    lvlTypes,
    lvlWarp,
    lvlMaze,
    lvlSub,
    lvlSubTypeStartIds,
    objectSubClass,
    monPreset,
    monPresetActStart,
    monPresetActCount,
    nMonStatsTxtRecordCount: ms.count,
    nSuperUniquesTxtRecordCount: su.count,
    levelMonsters,
    monStatsRelatedHcIdx,
    superUniqueClassIds,
  }
}

//D2Common.0x6FD60D90 (#10010) DATATBLS_GetLevelDefRecord. D2MOO returns NULL out of range; every
// DRLG caller dereferences the result, so an out-of-range id is a hard error here.
export function DATATBLS_GetLevelDefRecord(t: DrlgTables, nLevelId: number): LevelDefRecord {
  if (nLevelId >= 0 && nLevelId < t.nLevelsTxtRecordCount) {
    const rec = t.levelDefs[nLevelId]
    if (rec) return rec
  }
  throw new Error(`DATATBLS_GetLevelDefRecord(${nLevelId}): no record`)
}

//D2Common.0x6FD61B50 (#10024) DATATBLS_GetLvlPrestTxtRecord
export function DATATBLS_GetLvlPrestTxtRecord(t: DrlgTables, nId: number): LvlPrestRecord {
  const rec = nId >= 0 ? t.lvlPrest[nId] : undefined
  if (!rec) throw new Error(`DATATBLS_GetLvlPrestTxtRecord(${nId}): no record`)
  return rec
}

//D2Common.0x6FD61B80 DATATBLS_GetLvlPrestTxtRecordFromLevelId (first record claiming the level)
export function DATATBLS_GetLvlPrestTxtRecordFromLevelId(t: DrlgTables, nLevelId: number): LvlPrestRecord | null {
  for (const rec of t.lvlPrest) {
    if (rec.dwLevelId === nLevelId) return rec
  }
  return null
}

//D2Common.0x6FD61FA0 DATATBLS_GetLvlMazeTxtRecordFromLevelId (D2_UNREACHABLE when missing)
export function DATATBLS_GetLvlMazeTxtRecordFromLevelId(t: DrlgTables, nLevelId: number): LvlMazeRecord {
  for (const rec of t.lvlMaze) {
    if (rec.dwLevelId === nLevelId) return rec
  }
  throw new Error(`DATATBLS_GetLvlMazeTxtRecordFromLevelId(${nLevelId}): no record`)
}

//D2Common.0x6FD626F0 DATATBLS_GetLvlSubTxtRecord (index of the first record of the type)
export function DATATBLS_GetLvlSubTxtRecordIndex(t: DrlgTables, nSubType: number): number {
  if (nSubType < 0 || nSubType >= t.lvlSubTypeStartIds.length) {
    throw new Error(`DATATBLS_GetLvlSubTxtRecord(${nSubType}): no such LvlSub type`)
  }
  return t.lvlSubTypeStartIds[nSubType]!
}

//D2Common.0x6FD6EF30 (#11256) DATATBLS_GetMonPresetTxtActSection
export function DATATBLS_GetMonPresetTxtActSection(t: DrlgTables, nAct: number): { start: number; count: number } | null {
  if (nAct >= 0 && nAct < 5) return { start: t.monPresetActStart[nAct]!, count: t.monPresetActCount[nAct]! }
  return null
}

/** D2ObjectsTxt::nSubClass (out-of-range ids are a hard error, as in the oracle). */
export function objectSubClass(t: DrlgTables, nObjectId: number): number {
  if (nObjectId < 0 || nObjectId >= t.objectSubClass.length) {
    throw new Error(`DATATBLS_GetObjectsTxtRecord(${nObjectId}) out of range`)
  }
  return t.objectSubClass[nObjectId]!
}

//D2Common.0x6FD61BF0 (#10025) DATATBLS_GetLevelTypesTxtRecord
export function DATATBLS_GetLvlTypesTxtRecord(t: DrlgTables, nLevelType: number): LvlTypesRecord {
  const rec = nLevelType >= 0 ? t.lvlTypes[nLevelType] : undefined
  if (!rec) throw new Error(`DATATBLS_GetLvlTypesTxtRecord(${nLevelType}): no record`)
  return rec
}

//1.10f:D2Common.0x6FD61DE0
//1.11: D2Common.0x6FD86840
// LevelsTbls.cpp:747. `szDirection` is the C char ('b', 'l', 'r'); records compare their szDirection[0].
export function DATATBLS_GetLvlWarpTxtRecordFromLevelIdAndDirection(
  t: DrlgTables,
  nLevelId: number,
  szDirection: string,
): LvlWarpRecord {
  if (t.lvlWarp.length === 0) throw new Error('D2_ASSERT(sgptDataTables->pLvlWarpTxt)')

  for (let i = 0; i < t.lvlWarp.length; i += 1) {
    const rec = t.lvlWarp[i]!
    // uint32_t dwLevelId == int nLevelId: equal bit patterns.
    if ((rec.dwLevelId | 0) === (nLevelId | 0)) {
      if (szDirection === 'b' || rec.szDirection[0] === 'b' || rec.szDirection[0] === szDirection) {
        return rec
      }
    }
  }

  throw new Error(
    `DATATBLS_GetLvlWarpTxtRecordFromLevelIdAndDirection(${nLevelId}, '${szDirection}'): Error in DRLG related to stairs that connect levels`,
  )
}

