/**
 * JSON dumps of the DRLG port in the exact schema the native D2MOO oracle writes
 * (tools/d2moo-oracle/src/main.cpp, schema 3; documented in tools/d2moo-oracle/README.md), plus the
 * TypeScript twin of the oracle driver (`runAct1`, the single generation code path; `dumpAct1` builds the
 * dump from its hooks). Diffing the two dumps stage by stage is the acceptance gate of the port
 * (scripts/drlg-diff.ts, tests/drlg-act1-oracle.test.ts).
 *
 * Integer signedness follows the C field types, independent of how the port stores the value:
 * uint32 fields are printed with `>>> 0`, int32 fields with `| 0`.
 */

import {
  SEED_RollRandomNumber,
  setD2SeedTraceSink,
  type D2SeedStrc,
  type D2SeedTraceSink,
} from '../rng/d2-rng.ts'
import type { D2TileLibraryEntryStrc } from './drlg-d2cmp.ts'
import {
  ACT_I,
  DRLGROOMFLAG_HAS_ROOM,
  DRLGROOMFLAG_PRESET_UNITS_ADDED,
  DRLGROOMFLAG_TILELIB_LOADED,
  DRLGTYPE_MAZE,
  DRLGTYPE_OUTDOOR,
  DRLGTYPE_PRESET,
  LEVEL_HARROGATH,
  LEVEL_KURASTDOCKTOWN,
  LEVEL_LUTGHOLEIN,
  LEVEL_ROGUEENCAMPMENT,
  LEVEL_THEPANDEMONIUMFORTRESS,
  outdoorCoord,
  type D2DrlgCoordStrc,
  type D2DrlgGridStrc,
  type D2DrlgLevelStrc,
  type D2DrlgLogicalRoomInfoStrc,
  type D2DrlgMapStrc,
  type D2DrlgOrthStrc,
  type D2DrlgRoomStrc,
  type D2DrlgStrc,
  type D2DrlgTileDataStrc,
  type D2DrlgVertexStrc,
  type D2PresetUnitStrc,
  type D2RoomCoordListStrc,
  type DrlgEnv,
} from './drlg-types.ts'
import { DRLG_AllocDrlg, DRLG_GetActNoFromLevelId, DRLG_GetLevel, DRLG_InitLevel } from './drlg-drlg.ts'
import { setLevelGridHook } from './drlg-hooks.ts'
import { DRLGPRESET_SpawnHardcodedPresetUnits } from './drlg-preset.ts'
import { sub_6FD77BB0 } from './drlg-room.ts'
import { DRLGROOMTILE_AddRoomMapTiles, DRLGROOMTILE_InitRoomGrids, DRLGROOMTILE_LoadDT1FilesForRoom } from './drlg-roomtile.ts'
import { DATATBLS_GetLvlPrestTxtRecord } from './drlg-tables.ts'

const u32 = (v: number): number => v >>> 0
const s32 = (v: number): number => v | 0
const u8 = (v: number): number => v & 0xff

export type DumpSeed = [number, number]
export type DumpCoord = [number, number, number, number]
export interface DumpGrid { w: number; h: number; cells: number[] }
export type DumpUnit = [number, number, number, number, number, number]
export interface DumpOrth { level: number; dir: number; preset: number; init: number; box: DumpCoord | null }
export interface DumpMap { prest: number; picked: number; coord: DumpCoord; file: string; hasInfo: number; units: DumpUnit[] }

export interface DumpActLevel {
  id: number
  drlgType: number
  levelType: number
  coord: DumpCoord
  flags: number
  seed: DumpSeed
  outdoor?: { flags: number; roomData: DumpOrth[] }
  preset?: { direction: number; map: DumpMap | null }
}

/** [x, y, dir, flags, next]; next: -1 null, 0..23 pVertices[i], 100 + k the k-th ring vertex. */
export type DumpVertex = [number, number, number, number, number]
export type DumpPathVertex = [number, number, number, number]

export interface DumpLevelGrid {
  flags: number
  coord: DumpCoord
  grids: (DumpGrid | null)[]
  ring: DumpVertex[]
  nVertices: number
  vertices: DumpVertex[]
  pathStarts: (DumpPathVertex[] | null)[]
  roomData: DumpOrth[]
  seed: DumpSeed
}

export interface DumpRoom {
  type: number
  coord: DumpCoord
  flags: number
  otherFlags: number
  dt1Mask: number
  initSeed: number
  seed: DumpSeed
  outdoor?: { flags: number; flagsEx: number; subType: number; subTheme: number; subThemePicked: number }
  preset?: { prest: number; picked: number; flags: number; map: number }
}

// ---- activation stage (schema 3: + seedAfterTiles, mapTiles) ----

/**
 * `D2DrlgTileDataStrc*`: [levelId, room index in pFirstRoomEx order, array, element index] into that room's
 * `pTileGrid.pTiles` array: 'w' pWallTiles, 'f' pFloorTiles, 'r' pRoofTiles. The index may exceed the
 * dumped element count (it addresses the allocation). Rooms of any level of the act can be referenced.
 */
export type DumpTileRef = [number, number, 'w' | 'f' | 'r', number]
/** `D2RoomCoordListStrc*`: [levelId, room, 'c', index in that room's `pLogicalRoomInfo.pCoordList` chain]. */
export type DumpCoordListRef = [number, number, 'c', number]
/** `D2TileLibraryEntryStrc*`: [DT1 path (lower case, '/'-separated, e.g. "data/global/tiles/act1/outdoors/blank.dt1"), tile index in that DT1]. */
export type DumpTileEntry = [string, number]
/** Every D2DrlgTileDataStrc field in struct order (D2DrlgDrlg.h:333); pointers as references. */
export type DumpTile = [
  nWidth: number,
  nHeight: number,
  nPosX: number,
  nPosY: number,
  unk0x10: number | DumpCoordListRef,
  dwFlags: number,
  pTile: DumpTileEntry | null,
  nTileType: number,
  unk0x20: DumpTileRef | null,
  unk0x24: number,
  nRed: number,
  nGreen: number,
  nBlue: number,
  nIntensity: number,
  unk0x2C: number,
]
/** D2DrlgTileLinkStrc (pTileGrid.pMapLinks chain order). */
export type DumpTileLink = [bFloor: number, pMapTile: DumpTileRef | null]
/** D2RoomTileStrc (pRoomTiles chain order); the LvlWarp.txt record as its row index, -1 for NULL. */
export type DumpRoomTile = [
  pDrlgRoom: [levelId: number, room: number] | null,
  nLvlWarpTxtRecord: number,
  bEnabled: number,
  unk0x0C: DumpTileRef | null,
  unk0x10: DumpTileRef | null,
]
/** D2RoomCoordListStrc. */
export type DumpCoordList = [nIndex: number, bNode: number, bRoomActive: number, box0: DumpCoord, box1: DumpCoord]
/** D2DrlgLogicalRoomInfoStrc. */
export interface DumpLogicalRoomInfo {
  flags: number
  nLists: number
  indexX: DumpGrid | null
  /** pIndexY cells (`(int)D2RoomCoordListStrc*`) as 1 + the index of the list in `lists`, 0 for NULL. */
  indexY: DumpGrid | null
  /** The pCoordList chain in order. */
  lists: DumpCoordList[]
}
/**
 * The room's D2DrlgTileGridStrc after every requested room has been activated (final state: a room
 * activated later rewrites tiles of the near rooms activated before it, across level seams too).
 */
export interface DumpMapTiles {
  /** pTileGrid counters. */
  nWalls: number
  nFloors: number
  nShadows: number
  /** pTileGrid.pTiles counters (what D2Common hands on with the room); walls/floors/roofs hold exactly these many entries. */
  pTiles: { nWalls: number; nFloors: number; nRoofs: number }
  walls: DumpTile[]
  floors: DumpTile[]
  /** Shadow tiles (DRLGROOMTILE_InitShadowTileData stores them in pRoofTiles). */
  roofs: DumpTile[]
  links: DumpTileLink[]
  warps: DumpRoomTile[]
  /** pPresetUnits in the final state (incl. the UNIT_TILE units of DRLGROOMTILE_AddWarp and door units). */
  units: DumpUnit[]
  logical: DumpLogicalRoomInfo | null
}

interface DumpActivationTail {
  /** Room seed right after DRLGROOMTILE_InitRoomGrids. */
  seed: DumpSeed
  /** pPresetUnits right after DRLGROOMTILE_InitRoomGrids. */
  units: DumpUnit[]
  /** Room seed right after the room's own DRLGROOMTILE_AddRoomMapTiles. */
  seedAfterTiles: DumpSeed
  mapTiles: DumpMapTiles
}
export interface DumpOutdoorActivation extends DumpActivationTail {
  tile: DumpGrid | null
  wall: DumpGrid | null
  floor: DumpGrid | null
  dirt: DumpGrid | null
}
export interface DumpPresetActivation extends DumpActivationTail {
  walls: (DumpGrid | null)[]
  tiles: (DumpGrid | null)[]
  floors: (DumpGrid | null)[]
  shadow: DumpGrid | null
}
export type DumpActivation = DumpOutdoorActivation | DumpPresetActivation

export interface DumpLevel {
  id: number
  levelGrid: DumpLevelGrid
  nRooms: number
  rooms: DumpRoom[]
  maps: DumpMap[]
  levelSeedAfterRooms: DumpSeed
  warp: { n: number; xy: [number, number][] }
  /** One entry per room in pFirstRoomEx order (empty when activation is skipped). */
  activation: DumpActivation[]
}

export interface DrlgDump {
  schema: 3
  oracle?: { d2moo: string; arch: string }
  gameSeed: number
  difficulty: number
  isolated: boolean
  drlg: { startSeed: number; seed: DumpSeed }
  act: DumpActLevel[]
  levels: DumpLevel[]
}

export function dumpSeed(s: D2SeedStrc): DumpSeed {
  return [u32(s.lo), u32(s.hi)]
}

export function dumpCoord(c: D2DrlgCoordStrc): DumpCoord {
  return [s32(c.nPosX), s32(c.nPosY), s32(c.nWidth), s32(c.nHeight)]
}

/** `{w, h, cells}` (row-major int32) or null when the grid was never allocated. */
export function dumpGrid(g: D2DrlgGridStrc): DumpGrid | null {
  if (!g.pCellsFlags || !g.pCellsRowOffsets) return null
  const cells: number[] = []
  for (let y = 0; y < g.nHeight; y += 1) {
    for (let x = 0; x < g.nWidth; x += 1) {
      const idx = g.nCellsBase + x + g.pCellsRowOffsets[y]!
      if (idx < 0 || idx >= g.pCellsFlags.length) throw new RangeError(`dumpGrid: cell (${x}, ${y}) outside the backing array`)
      cells.push(s32(g.pCellsFlags[idx]!))
    }
  }
  return { w: s32(g.nWidth), h: s32(g.nHeight), cells }
}

export function dumpPresetUnits(pUnit: D2PresetUnitStrc | null): DumpUnit[] {
  const out: DumpUnit[] = []
  for (let p = pUnit; p; p = p.pNext) {
    out.push([s32(p.nUnitType), s32(p.nIndex), s32(p.nMode), s32(p.nXpos), s32(p.nYpos), s32(p.bSpawned)])
  }
  return out
}

export function dumpOrths(pOrth: D2DrlgOrthStrc | null): DumpOrth[] {
  const out: DumpOrth[] = []
  for (let p = pOrth; p; p = p.pNext) {
    out.push({
      // Level-to-level orths store the neighbour level in the union.
      level: p.pLevel ? p.pLevel.nLevelId : -1,
      dir: u8(p.nDirection),
      preset: s32(p.bPreset),
      init: s32(p.bInit),
      box: p.pBox ? dumpCoord(p.pBox) : null,
    })
  }
  return out
}

function prestFile(env: DrlgEnv, pMap: D2DrlgMapStrc): string {
  if (pMap.nPickedFile < 0 || pMap.nPickedFile >= 6) return ''
  return DATATBLS_GetLvlPrestTxtRecord(env.tables, pMap.nLevelPrest).szFile[pMap.nPickedFile]!.replace(/\\/g, '/')
}

export function dumpMap(env: DrlgEnv, pMap: D2DrlgMapStrc): DumpMap {
  return {
    prest: s32(pMap.nLevelPrest),
    picked: s32(pMap.nPickedFile),
    coord: dumpCoord(pMap.pDrlgCoord),
    file: prestFile(env, pMap),
    hasInfo: s32(pMap.bHasInfo),
    units: dumpPresetUnits(pMap.pPresetUnit),
  }
}

// ---- act stage ----
export function dumpActLevel(pLevel: D2DrlgLevelStrc): DumpActLevel {
  const o: DumpActLevel = {
    id: pLevel.nLevelId,
    drlgType: pLevel.nDrlgType,
    levelType: pLevel.nLevelType,
    coord: dumpCoord(pLevel.pLevelCoords),
    flags: u32(pLevel.dwFlags),
    seed: dumpSeed(pLevel.pSeed),
  }
  if (pLevel.nDrlgType === DRLGTYPE_OUTDOOR && pLevel.pOutdoors) {
    o.outdoor = { flags: u32(pLevel.pOutdoors.dwFlags), roomData: dumpOrths(pLevel.pOutdoors.pRoomData) }
  }
  if (pLevel.nDrlgType === DRLGTYPE_PRESET && pLevel.pPreset) {
    o.preset = {
      direction: s32(pLevel.pPreset.nDirection),
      map: pLevel.pPreset.pDrlgMap ? dumpMap(pLevel.pDrlg.env, pLevel.pPreset.pDrlgMap) : null,
    }
  }
  return o
}

export function dumpAct(pDrlg: D2DrlgStrc): DumpActLevel[] {
  const levels: D2DrlgLevelStrc[] = []
  for (let p = pDrlg.pLevel; p; p = p.pNextLevel) levels.push(p)
  levels.sort((a, b) => a.nLevelId - b.nLevelId)
  return levels.map(dumpActLevel)
}

// ---- levelGrid stage (after DRLGOUTWILD_InitAct1OutdoorLevel, before any room exists) ----
export function dumpLevelGrid(pLevel: D2DrlgLevelStrc): DumpLevelGrid {
  const pOut = pLevel.pOutdoors
  if (!pOut) throw new Error(`level ${pLevel.nLevelId}: no pOutdoors`)
  const ring: D2DrlgVertexStrc[] = []
  if (pOut.pVertex) {
    const pStart = pOut.pVertex
    let p: D2DrlgVertexStrc | null = pStart
    do {
      ring.push(p)
      p = p.pNext
    } while (p && p !== pStart && ring.length < 4096)
  }
  const ref = (p: D2DrlgVertexStrc | null): number => {
    if (!p) return -1
    const i = pOut.pVertices.indexOf(p)
    if (i >= 0) return i
    const k = ring.indexOf(p)
    if (k >= 0) return 100 + k
    throw new Error(`level ${pLevel.nLevelId}: vertex pointer outside pVertices and the ring`)
  }
  const vertex = (v: D2DrlgVertexStrc): DumpVertex => [s32(v.nPosX), s32(v.nPosY), u8(v.nDirection), s32(v.dwFlags), ref(v.pNext)]

  const pathStarts: (DumpPathVertex[] | null)[] = []
  for (let i = 0; i < 6; i += 1) {
    const start = pOut.pPathStarts[i] ?? null
    if (!start) {
      pathStarts.push(null)
      continue
    }
    const chain: DumpPathVertex[] = []
    for (let p: D2DrlgVertexStrc | null = start; p; p = p.pNext) {
      if (chain.length >= 4096) throw new Error(`level ${pLevel.nLevelId}: path ${i} does not terminate`)
      chain.push([s32(p.nPosX), s32(p.nPosY), u8(p.nDirection), s32(p.dwFlags)])
    }
    pathStarts.push(chain)
  }

  return {
    flags: u32(pOut.dwFlags),
    coord: dumpCoord(outdoorCoord(pOut)),
    grids: pOut.pGrid.map(dumpGrid),
    ring: ring.map(vertex),
    nVertices: s32(pOut.nVertices),
    vertices: pOut.pVertices.map(vertex),
    pathStarts,
    roomData: dumpOrths(pOut.pRoomData),
    seed: dumpSeed(pLevel.pSeed),
  }
}

export function dumpRooms(pLevel: D2DrlgLevelStrc, maps: D2DrlgMapStrc[]): DumpRoom[] {
  const mapIndex = (pMap: D2DrlgMapStrc): number => {
    const i = maps.indexOf(pMap)
    if (i >= 0) return i
    maps.push(pMap)
    return maps.length - 1
  }
  const out: DumpRoom[] = []
  let i = 0
  for (let pRoom = pLevel.pFirstRoomEx; pRoom; pRoom = pRoom.pDrlgRoomNext, i += 1) {
    const r: DumpRoom = {
      type: pRoom.nType,
      coord: dumpCoord(pRoom.pDrlgCoord),
      flags: u32(pRoom.dwFlags),
      otherFlags: u32(pRoom.dwOtherFlags),
      dt1Mask: u32(pRoom.dwDT1Mask),
      initSeed: u32(pRoom.dwInitSeed),
      seed: dumpSeed(pRoom.pSeed),
    }
    if (pRoom.nType === DRLGTYPE_MAZE) {
      const p = pRoom.pOutdoor
      if (!p) throw new Error(`level ${pLevel.nLevelId} room ${i}: maze room without pOutdoor`)
      r.outdoor = { flags: s32(p.dwFlags), flagsEx: s32(p.dwFlagsEx), subType: s32(p.nSubType), subTheme: s32(p.nSubTheme), subThemePicked: s32(p.nSubThemePicked) }
    } else if (pRoom.nType === DRLGTYPE_PRESET) {
      const p = pRoom.pMaze
      if (!p || !p.pMap) throw new Error(`level ${pLevel.nLevelId} room ${i}: preset room without map`)
      r.preset = { prest: s32(p.nLevelPrest), picked: s32(p.nPickedFile), flags: u32(p.dwFlags), map: mapIndex(p.pMap) }
    } else {
      throw new Error(`level ${pLevel.nLevelId} room ${i}: unexpected room type ${pRoom.nType}`)
    }
    out.push(r)
  }
  return out
}

// ---- RNG trace (same line format as tools/d2moo-oracle/src/seed_traced.cpp) ----

const hex8 = (v: number): string => (v >>> 0).toString(16).padStart(8, '0')

/** Collects the RNG trace lines; `context()` mirrors D2ORACLE_SetTraceContext. */
export class DrlgTraceWriter implements D2SeedTraceSink {
  readonly lines: string[] = []
  private ctx = 'init'
  private readonly counters = new Map<string, number>()

  context(name: string): void {
    this.ctx = name
    this.lines.push(`# ${name}`)
  }

  init(seed: D2SeedStrc, kind: 'I' | 'S'): void {
    const n = this.counters.get(this.ctx) ?? 0
    this.counters.set(this.ctx, n + 1)
    seed.label = `${this.ctx}#${n}`
    this.lines.push(kind === 'I' ? `I ${seed.label} ${u32(seed.lo)}` : `S ${seed.label} ${u32(seed.lo)} ${u32(seed.hi)}`)
  }

  roll(seed: D2SeedStrc, kind: 'R' | 'L' | 'P', arg: number, result: number): void {
    const label = seed.label ?? '?'
    if (kind === 'R') this.lines.push(`R ${label} 0 ${hex8(seed.lo)}:${hex8(seed.hi)}`)
    else this.lines.push(`${kind} ${label} ${s32(arg)} ${u32(result)}`)
  }

  /** `T <type> <style> <seq> <n> <raritySum>` (D2CMP_10088_GetTiles lookups). */
  tile(nType: number, nStyle: number, nSequence: number, n: number, nRaritySum: number): void {
    this.lines.push(`T ${nType} ${nStyle} ${nSequence} ${n} ${nRaritySum}`)
  }
}

// ---- mapTiles (schema 3) ----

/** Pointer -> reference tables over every room of one act (pDrlg->pLevel chain, pFirstRoomEx order). */
interface DumpRefIndex {
  readonly tiles: Map<D2DrlgTileDataStrc, DumpTileRef>
  readonly coordLists: Map<D2RoomCoordListStrc, DumpCoordListRef>
  readonly rooms: Map<D2DrlgRoomStrc, [number, number]>
}

/** Chains longer than this cannot come from D2Common (C would loop forever on a cycle). */
const MAX_DUMP_CHAIN = 1 << 20

function buildRefIndex(pDrlg: D2DrlgStrc): DumpRefIndex {
  const index: DumpRefIndex = { tiles: new Map(), coordLists: new Map(), rooms: new Map() }
  for (let pLevel = pDrlg.pLevel; pLevel; pLevel = pLevel.pNextLevel) {
    const nLevelId = pLevel.nLevelId
    let nRoom = 0
    for (let pRoom = pLevel.pFirstRoomEx; pRoom; pRoom = pRoom.pDrlgRoomNext, nRoom += 1) {
      index.rooms.set(pRoom, [nLevelId, nRoom])
      const pTileGrid = pRoom.pTileGrid
      if (pTileGrid) {
        const add = (pArray: D2DrlgTileDataStrc[] | null, cArray: 'w' | 'f' | 'r'): void => {
          if (!pArray) return
          for (let i = 0; i < pArray.length; i += 1) {
            const pTileData = pArray[i]!
            if (index.tiles.has(pTileData)) throw new Error(`level ${nLevelId} room ${nRoom}: a tile data element belongs to two arrays`)
            index.tiles.set(pTileData, [nLevelId, nRoom, cArray, i])
          }
        }
        add(pTileGrid.pTiles.pWallTiles, 'w')
        add(pTileGrid.pTiles.pFloorTiles, 'f')
        add(pTileGrid.pTiles.pRoofTiles, 'r')
      }
      const pInfo = pRoom.pLogicalRoomInfo
      if (pInfo) {
        let k = 0
        for (let p = pInfo.pCoordList; p; p = p.pNext, k += 1) {
          if (k >= MAX_DUMP_CHAIN) throw new Error(`level ${nLevelId} room ${nRoom}: pCoordList chain does not terminate`)
          index.coordLists.set(p, [nLevelId, nRoom, 'c', k])
        }
      }
    }
  }
  return index
}

function dumpTileRef(index: DumpRefIndex, p: D2DrlgTileDataStrc | null): DumpTileRef | null {
  if (!p) return null
  const ref = index.tiles.get(p)
  if (!ref) throw new Error('tile data pointer outside every tile array of the act (dangling?)')
  return ref
}

function dumpTileEntry(pTile: D2TileLibraryEntryStrc | null): DumpTileEntry | null {
  return pTile ? [pTile.szLibrary.replace(/\\/g, '/'), pTile.nIndex] : null
}

function dumpTileData(index: DumpRefIndex, t: D2DrlgTileDataStrc): DumpTile {
  let unk0x10: number | DumpCoordListRef
  if (typeof t.unk0x10 === 'number') {
    unk0x10 = s32(t.unk0x10)
  } else {
    const ref = index.coordLists.get(t.unk0x10)
    if (!ref) throw new Error('D2DrlgTileDataStrc::unk0x10 holds a coord list outside every pCoordList chain of the act')
    unk0x10 = ref
  }
  return [
    s32(t.nWidth),
    s32(t.nHeight),
    s32(t.nPosX),
    s32(t.nPosY),
    unk0x10,
    u32(t.dwFlags),
    dumpTileEntry(t.pTile),
    s32(t.nTileType),
    dumpTileRef(index, t.unk0x20),
    s32(t.unk0x24),
    u8(t.nRed),
    u8(t.nGreen),
    u8(t.nBlue),
    u8(t.nIntensity),
    s32(t.unk0x2C),
  ]
}

function dumpTileDataArray(index: DumpRefIndex, pArray: D2DrlgTileDataStrc[] | null, nTiles: number, szWhat: string): DumpTile[] {
  if (nTiles < 0 || (nTiles > 0 && !pArray)) throw new Error(`${nTiles} ${szWhat} without an array`)
  if (pArray && nTiles > pArray.length) throw new Error(`${nTiles} ${szWhat} exceed their ${pArray.length}-element allocation`)
  const out: DumpTile[] = []
  for (let i = 0; i < nTiles; i += 1) out.push(dumpTileData(index, pArray![i]!))
  return out
}

function dumpLogicalRoomInfo(pInfo: D2DrlgLogicalRoomInfoStrc | null): DumpLogicalRoomInfo | null {
  if (!pInfo) return null
  const chain = new Map<D2RoomCoordListStrc, number>()
  const lists: DumpCoordList[] = []
  for (let p = pInfo.pCoordList; p; p = p.pNext) {
    if (lists.length >= MAX_DUMP_CHAIN) throw new Error('pCoordList chain does not terminate')
    chain.set(p, lists.length)
    lists.push([s32(p.nIndex), s32(p.bNode), s32(p.bRoomActive), dumpCoord(p.pBox[0]), dumpCoord(p.pBox[1])])
  }
  // pIndexY cells hold `(int)D2RoomCoordListStrc*` in C and a 1-based handle into ppCoordListHandles here.
  let indexY: DumpGrid | null = null
  const g = pInfo.pIndexY
  if (g.pCellsFlags && g.pCellsRowOffsets) {
    const cells: number[] = []
    for (let y = 0; y < g.nHeight; y += 1) {
      for (let x = 0; x < g.nWidth; x += 1) {
        const idx = g.nCellsBase + x + g.pCellsRowOffsets[y]!
        if (idx < 0 || idx >= g.pCellsFlags.length) throw new RangeError(`pIndexY cell (${x}, ${y}) outside the backing array`)
        const hCell = g.pCellsFlags[idx]!
        if (hCell === 0) {
          cells.push(0)
          continue
        }
        const pList = hCell > 0 ? pInfo.ppCoordListHandles[hCell - 1] : undefined
        const k = pList ? chain.get(pList) : undefined
        if (k === undefined) throw new Error(`pIndexY cell (${x}, ${y}) is not a list of the room's chain`)
        cells.push(k + 1)
      }
    }
    indexY = { w: s32(g.nWidth), h: s32(g.nHeight), cells }
  }
  return { flags: s32(pInfo.dwFlags), nLists: s32(pInfo.nLists), indexX: dumpGrid(pInfo.pIndexX), indexY, lists }
}

export function dumpRoomTiles(indexOrRoom: DumpRefIndex | D2DrlgRoomStrc, maybeRoom?: D2DrlgRoomStrc): DumpRoomTile[] {
  const index = maybeRoom !== undefined ? (indexOrRoom as DumpRefIndex) : buildRefIndex((indexOrRoom as D2DrlgRoomStrc).pLevel.pDrlg)
  const pRoom = maybeRoom ?? (indexOrRoom as D2DrlgRoomStrc)
  const lvlWarp = pRoom.pLevel.pDrlg.env.tables.lvlWarp
  const out: DumpRoomTile[] = []
  for (let p = pRoom.pRoomTiles; p; p = p.pNext) {
    if (out.length >= MAX_DUMP_CHAIN) throw new Error('pRoomTiles chain does not terminate')
    let room: [number, number] | null = null
    if (p.pDrlgRoom) {
      const r = index.rooms.get(p.pDrlgRoom)
      if (!r) throw new Error(`warp ${out.length} leads to a room outside the act`)
      room = [r[0], r[1]]
    }
    let nWarp = -1
    if (p.pLvlWarpTxtRecord) {
      nWarp = lvlWarp.indexOf(p.pLvlWarpTxtRecord)
      if (nWarp < 0) throw new Error(`warp ${out.length} has a record outside LvlWarp.txt`)
    }
    out.push([room, nWarp, s32(p.bEnabled), dumpTileRef(index, p.unk0x0C), dumpTileRef(index, p.unk0x10)])
  }
  return out
}

function dumpMapTiles(index: DumpRefIndex, pRoom: D2DrlgRoomStrc, nLevelId: number, nRoom: number): DumpMapTiles {
  const where = `level ${nLevelId} room ${nRoom}`
  const pTileGrid = pRoom.pTileGrid
  if (!pTileGrid) throw new Error(`${where}: no pTileGrid after DRLGROOMTILE_AddRoomMapTiles`)
  try {
    const t = pTileGrid.pTiles
    const links: DumpTileLink[] = []
    for (let p = pTileGrid.pMapLinks; p; p = p.pNext) {
      if (links.length >= MAX_DUMP_CHAIN) throw new Error('pMapLinks chain does not terminate')
      links.push([s32(p.bFloor), dumpTileRef(index, p.pMapTile)])
    }
    return {
      nWalls: s32(pTileGrid.nWalls),
      nFloors: s32(pTileGrid.nFloors),
      nShadows: s32(pTileGrid.nShadows),
      pTiles: { nWalls: s32(t.nWalls), nFloors: s32(t.nFloors), nRoofs: s32(t.nRoofs) },
      walls: dumpTileDataArray(index, t.pWallTiles, t.nWalls, 'walls'),
      floors: dumpTileDataArray(index, t.pFloorTiles, t.nFloors, 'floors'),
      roofs: dumpTileDataArray(index, t.pRoofTiles, t.nRoofs, 'roofs'),
      links,
      warps: dumpRoomTiles(index, pRoom),
      units: dumpPresetUnits(pRoom.pPresetUnits),
      logical: dumpLogicalRoomInfo(pRoom.pLogicalRoomInfo),
    }
  } catch (e) {
    throw new Error(`${where}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ---- driver (TypeScript twin of tools/d2moo-oracle/src/main.cpp) ----

export interface Act1RunOptions {
  readonly act?: number
  readonly difficulty?: number
  /** A fresh act per requested level (proves a level does not depend on the others). */
  readonly isolated?: boolean
  /** Receives the RNG trace; installed as the global seed trace sink for the duration of the run. */
  readonly trace?: DrlgTraceWriter
  /** Generate the levels but do not activate their rooms. */
  readonly skipActivation?: boolean
}

/**
 * Observation points of runAct1, in execution order. The structures are live: later steps keep mutating
 * them (a room activated later rewrites tiles of the near rooms activated before it and rolls their
 * seeds, also across level seams), so a hook must copy what it needs at that moment.
 */
export interface Act1RunHooks {
  /** After DRLG_AllocDrlg. `index` 0 is Act1Run.pDrlg; isolated runs allocate one more act per further level. */
  onDrlgAllocated?(pDrlg: D2DrlgStrc, index: number): void
  /** After DRLG_InitLevel of a requested level. */
  onLevelGenerated?(pLevel: D2DrlgLevelStrc): void
  /** After DRLGROOMTILE_InitRoomGrids of a room, before DRLGROOMTILE_AddRoomMapTiles (`index`: pFirstRoomEx order). */
  onRoomGridsInitialized?(pRoom: D2DrlgRoomStrc, index: number): void
  /** After DRLGROOMTILE_AddRoomMapTiles of that room. */
  onRoomActivated?(pRoom: D2DrlgRoomStrc, index: number): void
}

export interface Act1Run {
  /** The act allocated first (the only one unless `isolated`). */
  readonly pDrlg: D2DrlgStrc
  /** The requested levels in request order; each level's own act is `pLevel.pDrlg`. */
  readonly levels: readonly D2DrlgLevelStrc[]
}

const TOWN_LEVEL_IDS = [
  LEVEL_ROGUEENCAMPMENT,
  LEVEL_LUTGHOLEIN,
  LEVEL_KURASTDOCKTOWN,
  LEVEL_THEPANDEMONIUMFORTRESS,
  LEVEL_HARROGATH,
] as const

function allocActByNo(env: DrlgEnv, nAct: number, nSeed: number, nDifficulty: number, trace: DrlgTraceWriter | undefined): D2DrlgStrc {
  trace?.context('drlg')
  // D2Game allocates the act with the town level id; DRLG_AllocDrlg lays out the whole act
  // (DRLGOUTPLACE_CreateLevelConnections) and generates the town.
  return DRLG_AllocDrlg(env, nAct, nSeed, TOWN_LEVEL_IDS[nAct]!, 0, nDifficulty)
}

/** Generation stage of one level: DRLG_InitLevel, everything that exists before any room is activated. */
function initLevel(pDrlg: D2DrlgStrc, nLevelId: number, nAct: number, trace: DrlgTraceWriter | undefined): D2DrlgLevelStrc {
  trace?.context(`L${nLevelId}`)
  const pLevel = DRLG_GetLevel(pDrlg, nLevelId)
  if (DRLG_GetActNoFromLevelId(nLevelId) !== nAct) {
    throw new Error(`level ${nLevelId} does not belong to Act ${nAct + 1}`)
  }
  if (!pLevel.pFirstRoomEx) {
    DRLG_InitLevel(pLevel)
  }
  return pLevel
}

/**
 * Mirrors DRLGACTIVATE_InitializeRoomEx (DrlgActivate.cpp:317-331) followed by
 * DRLGACTIVATE_RoomEx_EnsureHasRoom (DrlgActivate.cpp:95-115) up to DRLGROOMTILE_AddRoomMapTiles, for every
 * room in pFirstRoomEx order. DRLG_CreateRoomForRoomEx (D2Game's D2ActiveRoomStrc) is not run, so pRoom
 * stays NULL (D2Common_COLLISION_FirstFn_6FD41000 is a no-op).
 */
function activateLevel(pLevel: D2DrlgLevelStrc, trace: DrlgTraceWriter | undefined, hooks: Act1RunHooks): void {
  let i = 0
  for (let pRoom = pLevel.pFirstRoomEx; pRoom; pRoom = pRoom.pDrlgRoomNext, i += 1) {
    trace?.context(`L${pLevel.nLevelId}/a${i}`)
    if (!(pRoom.dwFlags & DRLGROOMFLAG_TILELIB_LOADED)) {
      DRLGROOMTILE_LoadDT1FilesForRoom(pRoom)
    }
    if (!(pRoom.dwFlags & DRLGROOMFLAG_PRESET_UNITS_ADDED) && pRoom.nType === DRLGTYPE_PRESET) {
      DRLGPRESET_SpawnHardcodedPresetUnits(pRoom)
    }
    if (pRoom.pRoom || pRoom.dwFlags & DRLGROOMFLAG_HAS_ROOM) {
      throw new Error(`level ${pLevel.nLevelId} room ${i}: already has an active room`)
    }
    if (!pRoom.nRoomsNear) {
      sub_6FD77BB0(pRoom)
    }
    DRLGROOMTILE_InitRoomGrids(pRoom)
    hooks.onRoomGridsInitialized?.(pRoom, i)
    DRLGROOMTILE_AddRoomMapTiles(pRoom)
    hooks.onRoomActivated?.(pRoom, i)
  }
}

/**
 * Runs the act generation exactly like the oracle driver: DRLG_AllocDrlg (layout, links, town), then
 * DRLG_InitLevel of every requested level, then the activation of every room of those levels (see
 * activateLevel). A non-isolated run generates every requested level before activating any room, because
 * activating a room initialises the levels behind its warps (sub_6FD77BB0 -> DRLG_InitLevel); an isolated
 * run allocates a fresh act per level and activates it right away.
 */
export function runAct1(
  env: DrlgEnv,
  nSeed: number,
  levels: readonly number[],
  opts: Act1RunOptions = {},
  hooks: Act1RunHooks = {},
): Act1Run {
  const nDifficulty = opts.difficulty ?? 0
  let nAct: number = ACT_I
  if (opts.act !== undefined) {
    if (opts.act < 0 || opts.act > 4) throw new Error('act must be 0..4')
    nAct = opts.act
  } else if (levels.length > 0) {
    nAct = DRLG_GetActNoFromLevelId(levels[0]!)
  }
  for (const id of levels) {
    if (DRLG_GetActNoFromLevelId(id) !== nAct) {
      throw new Error(`level ${id} belongs to act ${DRLG_GetActNoFromLevelId(id)}, not act ${nAct}`)
    }
  }
  const trace = opts.trace
  if (trace) setD2SeedTraceSink(trace)
  try {
    let nActs = 0
    const allocAct = (): D2DrlgStrc => {
      const pDrlg = allocActByNo(env, nAct, nSeed >>> 0, nDifficulty, trace)
      hooks.onDrlgAllocated?.(pDrlg, nActs)
      nActs += 1
      return pDrlg
    }
    const generate = (pDrlg: D2DrlgStrc, nLevelId: number): D2DrlgLevelStrc => {
      const pLevel = initLevel(pDrlg, nLevelId, nAct, trace)
      hooks.onLevelGenerated?.(pLevel)
      return pLevel
    }
    const pFirstDrlg = allocAct()
    const generated: D2DrlgLevelStrc[] = []
    if (opts.isolated) {
      for (let i = 0; i < levels.length; i += 1) {
        const pLevel = generate(i > 0 ? allocAct() : pFirstDrlg, levels[i]!)
        generated.push(pLevel)
        if (!opts.skipActivation) activateLevel(pLevel, trace, hooks)
      }
    } else {
      for (let i = 0; i < levels.length; i += 1) generated.push(generate(pFirstDrlg, levels[i]!))
      if (!opts.skipActivation) {
        for (const pLevel of generated) activateLevel(pLevel, trace, hooks)
      }
    }
    return { pDrlg: pFirstDrlg, levels: generated }
  } finally {
    if (trace) setD2SeedTraceSink(null)
  }
}

export interface DumpAct1Options extends Act1RunOptions {
  /** Stop after the act stage (the `levels` array stays empty). */
  readonly actOnly?: boolean
  /**
   * Generate the levels but do not activate their rooms: every `activation` array stays empty.
   * Only valid for comparisons that exclude the activation stage (drlg-diff --no-activation).
   */
  readonly skipActivation?: boolean
}

function dumpLevelHead(pLevel: D2DrlgLevelStrc, levelGrid: DumpLevelGrid): Omit<DumpLevel, 'activation'> {
  const maps: D2DrlgMapStrc[] = []
  const rooms = dumpRooms(pLevel, maps)
  const xy: [number, number][] = []
  for (let i = 0; i < pLevel.nRoomCoords; i += 1) xy.push([pLevel.nRoom_Center_Warp_X[i]!, pLevel.nRoom_Center_Warp_Y[i]!])
  return {
    id: pLevel.nLevelId,
    levelGrid,
    nRooms: pLevel.nRooms,
    rooms,
    maps: maps.map(m => dumpMap(pLevel.pDrlg.env, m)),
    levelSeedAfterRooms: dumpSeed(pLevel.pSeed),
    warp: { n: pLevel.nRoomCoords, xy },
  }
}

/** Schema-2 activation fields of a room, right after DRLGROOMTILE_InitRoomGrids. */
function dumpRoomGrids(pRoom: D2DrlgRoomStrc): Omit<DumpOutdoorActivation, 'seedAfterTiles' | 'mapTiles'> | Omit<DumpPresetActivation, 'seedAfterTiles' | 'mapTiles'> {
  if (pRoom.nType === DRLGTYPE_MAZE) {
    const p = pRoom.pOutdoor!
    return {
      seed: dumpSeed(pRoom.pSeed),
      tile: dumpGrid(p.pTileTypeGrid),
      wall: dumpGrid(p.pWallGrid),
      floor: dumpGrid(p.pFloorGrid),
      dirt: dumpGrid(p.pDirtPathGrid),
      units: dumpPresetUnits(pRoom.pPresetUnits),
    }
  }
  const p = pRoom.pMaze!
  const pFile = p.pMap!.pFile!
  const walls: (DumpGrid | null)[] = []
  const tiles: (DumpGrid | null)[] = []
  const floors: (DumpGrid | null)[] = []
  for (let l = 0; l < pFile.nWallLayers; l += 1) {
    walls.push(dumpGrid(p.pWallGrid[l]!))
    tiles.push(dumpGrid(p.pTileTypeGrid[l]!))
  }
  for (let l = 0; l < pFile.nFloorLayers; l += 1) {
    floors.push(dumpGrid(p.pFloorGrid[l]!))
  }
  return { seed: dumpSeed(pRoom.pSeed), walls, tiles, floors, shadow: dumpGrid(p.pCellGrid), units: dumpPresetUnits(pRoom.pPresetUnits) }
}

interface RoomActivationRecord {
  readonly pRoom: D2DrlgRoomStrc
  readonly index: number
  readonly grids: ReturnType<typeof dumpRoomGrids>
  seedAfterTiles: DumpSeed | null
}

/** Runs runAct1 and returns the same JSON document as the oracle driver. */
export function dumpAct1(env: DrlgEnv, nSeed: number, levels: readonly number[], opts: DumpAct1Options = {}): DrlgDump {
  const levelGrids = new Map<number, DumpLevelGrid>()
  const heads = new Map<D2DrlgLevelStrc, Omit<DumpLevel, 'activation'>>()
  const activations = new Map<D2DrlgLevelStrc, RoomActivationRecord[]>()
  // Assigned by the hooks (the casts keep TypeScript from narrowing them to `null` for good).
  let drlg = null as DrlgDump['drlg'] | null
  let act = null as DumpActLevel[] | null
  const previousHook = setLevelGridHook(pLevel => {
    levelGrids.set(pLevel.nLevelId, dumpLevelGrid(pLevel))
  })
  let run: Act1Run
  const runOpts: DumpAct1Options =
    opts.act === undefined && levels.length > 0
      ? { ...opts, act: DRLG_GetActNoFromLevelId(levels[0]!) }
      : opts
  try {
    run = runAct1(env, nSeed, opts.actOnly ? [] : levels, runOpts, {
      onDrlgAllocated(pDrlg, index) {
        if (index !== 0) return
        drlg = { startSeed: u32(pDrlg.dwStartSeed), seed: dumpSeed(pDrlg.pSeed) }
        act = dumpAct(pDrlg)
      },
      onLevelGenerated(pLevel) {
        let levelGrid = levelGrids.get(pLevel.nLevelId)
        if (!levelGrid) {
          if (pLevel.nDrlgType === DRLGTYPE_OUTDOOR) {
            throw new Error(`level ${pLevel.nLevelId}: outdoor levelGrid hook did not fire`)
          }
          levelGrid = {
            flags: 0,
            coord: dumpCoord(pLevel.pLevelCoords),
            grids: [null, null, null, null],
            ring: [],
            nVertices: 0,
            vertices: [],
            pathStarts: [],
            roomData: [],
            seed: dumpSeed(pLevel.pSeed),
          }
        }
        heads.set(pLevel, dumpLevelHead(pLevel, levelGrid))
        activations.set(pLevel, [])
      },
      onRoomGridsInitialized(pRoom, index) {
        const records = activations.get(pRoom.pLevel)
        if (!records) throw new Error(`level ${pRoom.pLevel.nLevelId}: room ${index} activated before its level was generated`)
        records.push({ pRoom, index, grids: dumpRoomGrids(pRoom), seedAfterTiles: null })
      },
      onRoomActivated(pRoom, index) {
        const records = activations.get(pRoom.pLevel)
        const record = records ? records[records.length - 1] : undefined
        if (!record || record.pRoom !== pRoom || record.index !== index) throw new Error(`level ${pRoom.pLevel.nLevelId} room ${index}: activation hooks out of order`)
        record.seedAfterTiles = dumpSeed(pRoom.pSeed)
      },
    })
  } finally {
    setLevelGridHook(previousHook)
  }
  if (!drlg || !act) throw new Error('runAct1 did not report the act allocation')
  const actById = new Map(act.map(a => [a.id, a]))
  for (const p of run.levels) {
    const existing = actById.get(p.nLevelId)
    if (!existing) {
      act.push(dumpActLevel(p))
    } else if (p.nDrlgType === DRLGTYPE_PRESET && existing.preset && !existing.preset.map && p.pPreset?.pDrlgMap) {
      existing.preset.map = dumpMap(p.pDrlg.env, p.pPreset.pDrlgMap)
    }
  }
  act.sort((a, b) => a.id - b.id)
  const doc: DrlgDump = {
    schema: 3,
    gameSeed: nSeed >>> 0,
    difficulty: opts.difficulty ?? 0,
    isolated: opts.isolated ?? false,
    drlg,
    act,
    levels: [],
  }
  // mapTiles is serialised only now: the tile data are the final state (see DumpMapTiles).
  const refIndices = new Map<D2DrlgStrc, DumpRefIndex>()
  for (const pLevel of run.levels) {
    let index = refIndices.get(pLevel.pDrlg)
    if (!index) {
      index = buildRefIndex(pLevel.pDrlg)
      refIndices.set(pLevel.pDrlg, index)
    }
    const activation: DumpActivation[] = []
    for (const record of activations.get(pLevel)!) {
      if (!record.seedAfterTiles) throw new Error(`level ${pLevel.nLevelId} room ${record.index}: DRLGROOMTILE_AddRoomMapTiles did not complete`)
      activation.push({ ...record.grids, seedAfterTiles: record.seedAfterTiles, mapTiles: dumpMapTiles(index, record.pRoom, pLevel.nLevelId, record.index) })
    }
    doc.levels.push({ ...heads.get(pLevel)!, activation })
  }
  return doc
}

// ---- Runtime DRLG Room Collision & Act Session (Milestone M3 / Phase N4) ----

const COLLIDE_WALL_BIT = 0x0001
const COLLIDE_DOOR_BIT = 0x0008
const COLLIDE_PLAYER_WALK_BIT = 0x0008
/** Combined D2MOO (0x1c09) and d2map (0x0027) invalid/void collision mask. */
export const DRLG_COLLIDE_MASK_INVALID = 0x1c2f

export interface DrlgRoomCollisionGrid {
  readonly tileX: number
  readonly tileY: number
  readonly tileW: number
  readonly tileH: number
  readonly subOriginX: number
  readonly subOriginY: number
  readonly width: number
  readonly height: number
  readonly collision: Uint16Array
  readonly blocked: Uint8Array
}

/**
 * Extracts the 5x5 sub-tile collision mask and walkability grid directly from an activated
 * `D2DrlgRoomStrc` (`pRoom.pTileGrid`), stamping void cells with `DRLG_COLLIDE_MASK_INVALID`.
 */
export function extractRoomCollisionGrid(pRoom: D2DrlgRoomStrc): DrlgRoomCollisionGrid {
  const tileX = s32(pRoom.pDrlgCoord.nPosX)
  const tileY = s32(pRoom.pDrlgCoord.nPosY)
  const tileW = Math.max(0, s32(pRoom.pDrlgCoord.nWidth))
  const tileH = Math.max(0, s32(pRoom.pDrlgCoord.nHeight))
  const subOriginX = tileX * 5
  const subOriginY = tileY * 5
  const width = tileW * 5
  const height = tileH * 5
  const collision = new Uint16Array(width * height)
  const blocked = new Uint8Array(width * height)
  if (tileW === 0 || tileH === 0) {
    return { tileX, tileY, tileW, tileH, subOriginX, subOriginY, width, height, collision, blocked }
  }

  const pTileGrid = pRoom.pTileGrid
  const hasWalkableFloor = new Uint8Array(tileW * tileH)
  const isMissingFallback = (pTileData: D2DrlgTileDataStrc): boolean => {
    if (!pTileData.pTile) return true
    const lib = pTileData.pTile.szLibrary.toLowerCase().replace(/\\/g, '/')
    return lib === 'data/global/tiles/act1/barracks/warp.dt1' && pTileData.nTileType !== 10
  }

  const allRoomTiles: { readonly cx: number; readonly cy: number; readonly data: D2DrlgTileDataStrc }[] = []
  if (pTileGrid) {
    const pushOwn = (arr: D2DrlgTileDataStrc[] | null, count: number): void => {
      if (!arr) return
      const limit = Math.min(count, arr.length)
      for (let i = 0; i < limit; i += 1) {
        const td = arr[i]!
        allRoomTiles.push({ cx: s32(td.nPosX), cy: s32(td.nPosY), data: td })
      }
    }
    pushOwn(pTileGrid.pTiles.pFloorTiles, pTileGrid.nFloors)
    pushOwn(pTileGrid.pTiles.pRoofTiles, pTileGrid.nShadows)
    pushOwn(pTileGrid.pTiles.pWallTiles, pTileGrid.nWalls)
  }

  const hasWalkBlockedOnlyFloor = new Uint8Array(tileW * tileH)
  const hasHiddenCollisionFloor = new Uint8Array(tileW * tileH)
  for (const item of allRoomTiles) {
    if (item.cx < 0 || item.cx >= tileW || item.cy < 0 || item.cy >= tileH) continue
    const td = item.data
    if (isMissingFallback(td)) continue
    if (td.nTileType === 0 && td.pTile?.nStyle === 30 && td.pTile?.nSequence === 1) {
      hasWalkBlockedOnlyFloor[item.cy * tileW + item.cx] = 1
      continue
    }
    if ((td.dwFlags & 0x8) !== 0) {
      if (td.nTileType === 0 && td.pTile?.nSubtileFlags.some(f => f !== 0)) {
        hasHiddenCollisionFloor[item.cy * tileW + item.cx] = 1
      }
      continue
    }
    if (td.nTileType === 0) {
      if ((td.dwFlags & 0x40) === 0) {
        hasWalkableFloor[item.cy * tileW + item.cx] = 1
      } else {
        hasWalkBlockedOnlyFloor[item.cy * tileW + item.cx] = (td.dwFlags & 0x80) !== 0 ? 2 : 1
      }
    }
  }

  // Mark void cells (cells with no active walkable floor) with COLLIDE_MASK_INVALID,
  // COLLIDE_WALL | COLLIDE_BLANK for Arcane Sanctuary Blank.dt1 (style=30, seq=1) / MAPTILE_UNWALKABLE floors,
  // or COLLIDE_WALL for hidden collision floor tiles (e.g. tomb.dt1 / maggot/floor.dt1 style=50, Blank.dt1 style=30 seq=0)
  // whose exact DT1 nSubtileFlags are stamped below per 1.13c sub_6FD413E0 (0x6FD413E0).
  for (let cy = 0; cy < tileH; cy += 1) {
    for (let cx = 0; cx < tileW; cx += 1) {
      const cellIdx = cy * tileW + cx
      if (hasWalkableFloor[cellIdx] !== 0) continue
      const walkOnlyKind = hasWalkBlockedOnlyFloor[cellIdx] ?? 0
      const fillMask =
        walkOnlyKind === 1
          ? COLLIDE_WALL_BIT | 0x0020
          : walkOnlyKind === 2
            ? COLLIDE_WALL_BIT | 0x0020 | 0x0004
            : hasHiddenCollisionFloor[cellIdx] !== 0
              ? COLLIDE_WALL_BIT
              : DRLG_COLLIDE_MASK_INVALID
      for (let sy = 0; sy < 5; sy += 1) {
        const rowBase = (cy * 5 + sy) * width + cx * 5
        for (let sx = 0; sx < 5; sx += 1) {
          const idx = rowBase + sx
          blocked[idx] = 1
          collision[idx] = (collision[idx] ?? 0) | fillMask
        }
      }
    }
  }

  // Stamp DT1 5x5 sub-tile block flags (stored bottom-to-top in DT1 header bytes 40..64).
  // Per 1.13c D2Common.dll sub_6FD413E0 (0x6FD413E0), hidden floor tiles (MAPTILE_HIDDEN, dwFlags & 0x08)
  // still stamp their non-zero DT1 nSubtileFlags into pCollisionMask.
  for (const item of allRoomTiles) {
    if (item.cx < 0 || item.cx >= tileW || item.cy < 0 || item.cy >= tileH) continue
    const td = item.data
    if (isMissingFallback(td) || !td.pTile) continue
    if ((td.dwFlags & 0x8) !== 0 && td.nTileType !== 0) continue
    const blockFlags = td.pTile.nSubtileFlags
    const isDoor = td.nTileType === 8 || td.nTileType === 9
    for (let sy = 0; sy < 5; sy += 1) {
      const rowBase = (item.cy * 5 + sy) * width + item.cx * 5
      const fileRow = (4 - sy) * 5
      for (let sx = 0; sx < 5; sx += 1) {
        const raw = blockFlags[fileRow + sx] ?? 0
        if (raw === 0) continue
        const idx = rowBase + sx
        let mask = raw & 0xffff
        const walkBlocked = (raw & (COLLIDE_WALL_BIT | COLLIDE_PLAYER_WALK_BIT)) !== 0
        if (isDoor && walkBlocked) {
          mask |= COLLIDE_DOOR_BIT
        }
        collision[idx] = (collision[idx] ?? 0) | mask
        if (walkBlocked) {
          blocked[idx] = 1
        }
      }
    }
  }

  return { tileX, tileY, tileW, tileH, subOriginX, subOriginY, width, height, collision, blocked }
}

export interface DrlgSessionRoom {
  readonly index: number
  readonly areaId: number
  readonly tileX: number
  readonly tileY: number
  readonly tileW: number
  readonly tileH: number
  readonly localTileX: number
  readonly localTileY: number
  readonly subX: number
  readonly subY: number
  readonly subW: number
  readonly subH: number
  readonly worldSubX: number
  readonly worldSubY: number
  /**
   * 1.13c `DRLGROOM_AllocRoom1` (`0x6fd7e1f0` @ `0x6fd7e27c`):
   * `dwSeed = SEED_RollRandomNumber(&pRoomEx->pSeed)` immediately after
   * `DRLGROOMTILE_AddRoomMapTiles`, passed to `DUNGEON_AllocRoom1` (`0x6fd8c720`)
   * which initializes `pRoom1->pSeed` via `SEED_InitLowSeed(&pRoom1->pSeed, dwSeed)`.
   */
  readonly room1InitSeed: number
  revealed: boolean
  readonly pRoom: D2DrlgRoomStrc
}

export interface DrlgActivatedLevel {
  readonly areaId: number
  readonly act: number
  readonly pLevel: D2DrlgLevelStrc
  readonly dumpLevel: DumpLevel
  readonly actLevel: DumpActLevel
  readonly rooms: readonly DrlgSessionRoom[]
  readonly dump: DrlgDump
}

export interface DrlgActSessionOptions {
  readonly act?: number
  readonly seed: number
  readonly difficulty?: number
}

export interface DrlgActSession {
  readonly act: number
  readonly seed: number
  readonly difficulty: number
  readonly env: DrlgEnv
  ensureLevelActivated(areaId: number): DrlgActivatedLevel
  revealRoom(areaId: number, roomTileX: number, roomTileY: number): DrlgSessionRoom | null
  hideRoom(areaId: number, roomTileX: number, roomTileY: number): DrlgSessionRoom | null
  revealAllRoomsInLevel(areaId: number): readonly DrlgSessionRoom[]
  getAllLevelRooms(areaId: number): readonly DrlgSessionRoom[]
  getAllActLevels(act?: number): readonly number[]
  getDump(act?: number): DrlgDump
  getRoomCollisionGrid(areaId: number, roomIndex: number): DrlgRoomCollisionGrid
}

function levelIdsForAct(env: DrlgEnv, nAct: number): number[] {
  const out: number[] = []
  for (let id = 1; id < env.tables.nLevelsTxtRecordCount; id += 1) {
    if (DRLG_GetActNoFromLevelId(id) === nAct) {
      out.push(id)
    }
  }
  return out
}

interface InternalActState {
  readonly nAct: number
  readonly levelIds: readonly number[]
  readonly dump: DrlgDump
  readonly pLevelsById: ReadonlyMap<number, D2DrlgLevelStrc>
  readonly dumpLevelsById: ReadonlyMap<number, DumpLevel>
  readonly actLevelsById: ReadonlyMap<number, DumpActLevel>
  readonly roomsByLevel: ReadonlyMap<number, DrlgSessionRoom[]>
}

/**
 * Creates a stateful runtime DRLG session for `(act, seed, difficulty)` that supports
 * level activation, room reveal/hide (`AddRoomData` / `RemoveRoomData`), and full-level/full-act
 * queries while preserving 100% deterministic 1.13c PRNG and cross-level seam parity.
 */
export function createDrlgActSession(env: DrlgEnv, options: DrlgActSessionOptions): DrlgActSession {
  const seed = options.seed >>> 0
  const difficulty = options.difficulty ?? 0
  let currentAct = options.act === undefined ? 0 : options.act === 5 ? 4 : Math.max(0, Math.min(4, options.act | 0))
  const actStates = new Map<number, InternalActState>()

  const getOrBuildActState = (nAct: number): InternalActState => {
    if (nAct < 0 || nAct > 4) throw new Error(`Invalid act number ${String(nAct)} (expected 0..4)`)
    const existing = actStates.get(nAct)
    if (existing !== undefined) return existing

    const levelIds = levelIdsForAct(env, nAct)
    const levelGrids = new Map<number, DumpLevelGrid>()
    const heads = new Map<D2DrlgLevelStrc, Omit<DumpLevel, 'activation'>>()
    const activations = new Map<D2DrlgLevelStrc, RoomActivationRecord[]>()
    let drlg = null as DrlgDump['drlg'] | null
    let act = null as DumpActLevel[] | null

    const previousHook = setLevelGridHook(pLevel => {
      levelGrids.set(pLevel.nLevelId, dumpLevelGrid(pLevel))
    })
    let run: Act1Run
    try {
      run = runAct1(env, seed, levelIds, { act: nAct, difficulty }, {
        onDrlgAllocated(pDrlg, index) {
          if (index !== 0) return
          drlg = { startSeed: u32(pDrlg.dwStartSeed), seed: dumpSeed(pDrlg.pSeed) }
          act = dumpAct(pDrlg)
        },
        onLevelGenerated(pLevel) {
          let levelGrid = levelGrids.get(pLevel.nLevelId)
          if (!levelGrid) {
            if (pLevel.nDrlgType === DRLGTYPE_OUTDOOR) {
              throw new Error(`level ${pLevel.nLevelId}: outdoor levelGrid hook did not fire`)
            }
            levelGrid = {
              flags: 0,
              coord: dumpCoord(pLevel.pLevelCoords),
              grids: [null, null, null, null],
              ring: [],
              nVertices: 0,
              vertices: [],
              pathStarts: [],
              roomData: [],
              seed: dumpSeed(pLevel.pSeed),
            }
          }
          heads.set(pLevel, dumpLevelHead(pLevel, levelGrid))
          activations.set(pLevel, [])
        },
        onRoomGridsInitialized(pRoom, index) {
          const records = activations.get(pRoom.pLevel)
          if (!records) throw new Error(`level ${pRoom.pLevel.nLevelId}: room ${index} activated before its level was generated`)
          records.push({ pRoom, index, grids: dumpRoomGrids(pRoom), seedAfterTiles: null })
        },
        onRoomActivated(pRoom, index) {
          const records = activations.get(pRoom.pLevel)
          const record = records ? records[records.length - 1] : undefined
          if (!record || record.pRoom !== pRoom || record.index !== index) {
            throw new Error(`level ${pRoom.pLevel.nLevelId} room ${index}: activation hooks out of order`)
          }
          record.seedAfterTiles = dumpSeed(pRoom.pSeed)
        },
      })
    } finally {
      setLevelGridHook(previousHook)
    }

    if (!drlg || !act) throw new Error('createDrlgActSession: act allocation hook did not fire')
    const actById = new Map(act.map(a => [a.id, a]))
    for (const p of run.levels) {
      const ex = actById.get(p.nLevelId)
      if (!ex) {
        const added = dumpActLevel(p)
        act.push(added)
        actById.set(p.nLevelId, added)
      } else if (p.nDrlgType === DRLGTYPE_PRESET && ex.preset && !ex.preset.map && p.pPreset?.pDrlgMap) {
        ex.preset.map = dumpMap(p.pDrlg.env, p.pPreset.pDrlgMap)
      }
    }
    act.sort((a, b) => a.id - b.id)

    const dump: DrlgDump = {
      schema: 3,
      gameSeed: seed,
      difficulty,
      isolated: false,
      drlg,
      act,
      levels: [],
    }

    const refIndex = buildRefIndex(run.pDrlg)
    const pLevelsById = new Map<number, D2DrlgLevelStrc>()
    const dumpLevelsById = new Map<number, DumpLevel>()
    const actLevelsById = new Map<number, DumpActLevel>(act.map(a => [a.id, a]))
    const roomsByLevel = new Map<number, DrlgSessionRoom[]>()

    for (const pLevel of run.levels) {
      pLevelsById.set(pLevel.nLevelId, pLevel)
      const activation: DumpActivation[] = []
      const records = activations.get(pLevel) ?? []
      for (const record of records) {
        if (!record.seedAfterTiles) {
          throw new Error(`level ${pLevel.nLevelId} room ${record.index}: DRLGROOMTILE_AddRoomMapTiles did not complete`)
        }
        activation.push({
          ...record.grids,
          seedAfterTiles: record.seedAfterTiles,
          mapTiles: dumpMapTiles(refIndex, record.pRoom, pLevel.nLevelId, record.index),
        })
      }
      const dumpLevel: DumpLevel = { ...heads.get(pLevel)!, activation }
      dump.levels.push(dumpLevel)
      dumpLevelsById.set(pLevel.nLevelId, dumpLevel)

      const actEntry = actLevelsById.get(pLevel.nLevelId)!
      let levelX = actEntry.coord[0]
      let levelY = actEntry.coord[1]
      if (actEntry.drlgType === DRLGTYPE_MAZE && dumpLevel.rooms.length > 0) {
        let minX = Infinity
        let minY = Infinity
        for (const r of dumpLevel.rooms) {
          if (r.coord[0] < minX) minX = r.coord[0]
          if (r.coord[1] < minY) minY = r.coord[1]
        }
        levelX = minX
        levelY = minY
      }

      const sessionRooms: DrlgSessionRoom[] = []
      let rIdx = 0
      for (let pRoom = pLevel.pFirstRoomEx; pRoom; pRoom = pRoom.pDrlgRoomNext, rIdx += 1) {
        const actRecord = records[rIdx]
        if (!actRecord || actRecord.pRoom !== pRoom || !actRecord.seedAfterTiles) {
          throw new Error(`level ${pLevel.nLevelId} room ${rIdx}: missing activation seedAfterTiles`)
        }
        const roomExSeedAfterTiles: D2SeedStrc = {
          lo: actRecord.seedAfterTiles[0],
          hi: actRecord.seedAfterTiles[1],
        }
        const room1InitSeed = u32(SEED_RollRandomNumber(roomExSeedAfterTiles))
        const tileX = s32(pRoom.pDrlgCoord.nPosX)
        const tileY = s32(pRoom.pDrlgCoord.nPosY)
        const tileW = s32(pRoom.pDrlgCoord.nWidth)
        const tileH = s32(pRoom.pDrlgCoord.nHeight)
        const localTileX = tileX - levelX
        const localTileY = tileY - levelY
        sessionRooms.push({
          index: rIdx,
          areaId: pLevel.nLevelId,
          tileX,
          tileY,
          tileW,
          tileH,
          localTileX,
          localTileY,
          subX: localTileX * 5,
          subY: localTileY * 5,
          subW: tileW * 5,
          subH: tileH * 5,
          worldSubX: tileX * 5,
          worldSubY: tileY * 5,
          room1InitSeed,
          revealed: false,
          pRoom,
        })
      }
      roomsByLevel.set(pLevel.nLevelId, sessionRooms)
    }

    const state: InternalActState = {
      nAct,
      levelIds,
      dump,
      pLevelsById,
      dumpLevelsById,
      actLevelsById,
      roomsByLevel,
    }
    actStates.set(nAct, state)
    return state
  }

  const findMatchingRoom = (rooms: DrlgSessionRoom[], x: number, y: number): DrlgSessionRoom | null => {
    // 1. Exact world tile origin match (D2GS 0x07 AddRoomData / 0x08 RemoveRoomData)
    for (const r of rooms) {
      if (r.tileX === x && r.tileY === y) return r
    }
    // 2. Exact level-local tile origin match
    for (const r of rooms) {
      if (r.localTileX === x && r.localTileY === y) return r
    }
    // 3. Exact world sub-tile or local sub-tile origin match
    for (const r of rooms) {
      if ((r.worldSubX === x && r.worldSubY === y) || (r.subX === x && r.subY === y)) return r
    }
    // 4. World tile bounding box containment
    for (const r of rooms) {
      if (x >= r.tileX && x < r.tileX + r.tileW && y >= r.tileY && y < r.tileY + r.tileH) return r
    }
    // 5. Local tile bounding box containment
    for (const r of rooms) {
      if (x >= r.localTileX && x < r.localTileX + r.tileW && y >= r.localTileY && y < r.localTileY + r.tileH) return r
    }
    // 6. World sub-tile bounding box containment
    for (const r of rooms) {
      if (x >= r.worldSubX && x < r.worldSubX + r.subW && y >= r.worldSubY && y < r.worldSubY + r.subH) return r
    }
    return null
  }

  return {
    get act(): number {
      return currentAct
    },
    seed,
    difficulty,
    env,
    ensureLevelActivated(areaId: number): DrlgActivatedLevel {
      if (areaId <= 0 || areaId >= env.tables.nLevelsTxtRecordCount) {
        throw new Error(`Invalid areaId ${String(areaId)} (expected 1..${String(env.tables.nLevelsTxtRecordCount - 1)})`)
      }
      const nAct = DRLG_GetActNoFromLevelId(areaId)
      currentAct = nAct
      const state = getOrBuildActState(nAct)
      const pLevel = state.pLevelsById.get(areaId)
      const dumpLevel = state.dumpLevelsById.get(areaId)
      const actLevel = state.actLevelsById.get(areaId)
      const rooms = state.roomsByLevel.get(areaId)
      if (!pLevel || !dumpLevel || !actLevel || !rooms) {
        throw new Error(`Area ${String(areaId)} not found in Act ${String(nAct + 1)} DRLG state`)
      }
      return {
        areaId,
        act: nAct,
        pLevel,
        dumpLevel,
        actLevel,
        rooms,
        dump: state.dump,
      }
    },
    revealRoom(areaId: number, roomTileX: number, roomTileY: number): DrlgSessionRoom | null {
      const level = this.ensureLevelActivated(areaId)
      const room = findMatchingRoom(level.rooms as DrlgSessionRoom[], roomTileX, roomTileY)
      if (room !== null) {
        room.revealed = true
      }
      return room
    },
    hideRoom(areaId: number, roomTileX: number, roomTileY: number): DrlgSessionRoom | null {
      const level = this.ensureLevelActivated(areaId)
      const room = findMatchingRoom(level.rooms as DrlgSessionRoom[], roomTileX, roomTileY)
      if (room !== null) {
        room.revealed = false
      }
      return room
    },
    revealAllRoomsInLevel(areaId: number): readonly DrlgSessionRoom[] {
      const level = this.ensureLevelActivated(areaId)
      for (const r of level.rooms) {
        r.revealed = true
      }
      return level.rooms
    },
    getAllLevelRooms(areaId: number): readonly DrlgSessionRoom[] {
      return this.ensureLevelActivated(areaId).rooms
    },
    getAllActLevels(act?: number): readonly number[] {
      const nAct = act === undefined ? currentAct : act === 5 ? 4 : Math.max(0, Math.min(4, act | 0))
      const state = getOrBuildActState(nAct)
      return state.levelIds
    },
    getDump(act?: number): DrlgDump {
      const nAct = act === undefined ? currentAct : act === 5 ? 4 : Math.max(0, Math.min(4, act | 0))
      return getOrBuildActState(nAct).dump
    },
    getRoomCollisionGrid(areaId: number, roomIndex: number): DrlgRoomCollisionGrid {
      const level = this.ensureLevelActivated(areaId)
      const room = level.rooms[roomIndex]
      if (!room) {
        throw new RangeError(`Area ${String(areaId)} has no room at index ${String(roomIndex)} (total ${String(level.rooms.length)})`)
      }
      return extractRoomCollisionGrid(room.pRoom)
    },
  }
}

