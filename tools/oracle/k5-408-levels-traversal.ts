/**
 * Milestone 36 [K5]: Deterministic 136 Levels x 3 Difficulties (= 408 level instances)
 * full-spectrum traversal harness over pure `src/d2kern-113c/`.
 *
 * Initializes `sgptDataTables` (`Levels.bin`, `LvlPrest.bin`, `LvlTypes.bin`, `LvlMaze.bin`,
 * `LvlSub.bin`, `LvlWarp.bin`, `Objects.bin`, `LevelDefs.bin`) from the pinned 1.13c page image
 * plus `.ds1` / `.dt1` MPQ tile metadata (`$D2_DATA_DIR` or `$HOME/d2-data`), then executes:
 * - `DUNGEON_AllocAct113c` (`0x6FD8CB30`)
 * - `DRLG_AllocAndInitLevel113c` (`0x6FD7D9B0`)
 * - `DRLG_InitLevelRooms113c` (`0x6FD7E360`)
 * - `DRLGROOM_EnsureRoomAndGetRoom1_113c` (`0x6FDCC270`)
 * - `DRLGROOMTILE_GetWarpLevelsArray113c` (`0x6FD69950`)
 * - `DRLG_FindWarpTargetRoom113c` (`0x6FD6A0D0`)
 * - `DUNGEON_FindFreeSpawnPositionInLevel113c` (`0x6FD8CDF0`)
 * - `COLLISION_GetCombinedMaskForBoxRecursively113c` (`0x6FD9B3F0`)
 * - `ROOM_SpawnPresetUnits113c` (`0x6FD01430`)
 */

import { existsSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { MpqArchive } from '../../src/common/mpq/archive.ts'
import type { MpqSource } from '../../src/common/mpq/source.ts'
import {
  COLLISION_CheckMaskWithPattern1_113c,
  COLLISION_GetCombinedMaskForBoxRecursively113c,
} from '../../src/d2kern-113c/common/collision.ts'
import {
  DRLG_AllocAndInitLevel113c,
  DRLG_GetActNoFromLevelId113c,
} from '../../src/d2kern-113c/common/drlg/drlg.ts'
import {
  DRLGROOM_EnsureRoomAndGetRoom1_113c,
  DRLG_InitLevelRooms113c,
} from '../../src/d2kern-113c/common/drlg/drlg-room.ts'
import { DRLGROOMTILE_GetWarpLevelsArray113c } from '../../src/d2kern-113c/common/drlg/room-tile.ts'
import {
  DRLG_FindWarpTargetRoom113c,
  DUNGEON_AllocAct113c,
  DUNGEON_FindFreeSpawnPositionInLevel113c,
} from '../../src/d2kern-113c/common/dungeon.ts'
import {
  ROOM_SpawnPresetUnits113c,
  type RoomPresetCallees113c,
} from '../../src/d2kern-113c/game/room-presets-113c.ts'
import { SparseMemory113c, type Memory113c } from '../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  DRLG_LEVEL_HEADER_MARKER,
  type DrlgLevelHeaderRecord,
  type DrlgRoomRecord,
  computeDrlgLevelLayoutHash,
  sha256Low64LE,
} from './vectors/drlg-vector.ts'
import { D2TV_MAGIC, parseVectorHeader } from './vectors/vector-format.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../..')
const FIXTURES_DIR = resolve(REPO_ROOT, 'tests/fixtures/oracle/vectors')

export const K5_DATATBLS_IMG_PATH = resolve(FIXTURES_DIR, 'drlg-datatbls-113c.img.gz')
export const K5_DIGEST_VECTORS_PATH = resolve(FIXTURES_DIR, 'drlg-digest-113c.d2tv.gz')

export const K5_ACT_LEVEL_RANGES: ReadonlyArray<{
  readonly act: number
  readonly townLevelId: number
  readonly minLevelId: number
  readonly maxLevelId: number
}> = [
  { act: 0, townLevelId: 1, minLevelId: 1, maxLevelId: 39 },
  { act: 1, townLevelId: 40, minLevelId: 40, maxLevelId: 74 },
  { act: 2, townLevelId: 75, minLevelId: 75, maxLevelId: 102 },
  { act: 3, townLevelId: 103, minLevelId: 103, maxLevelId: 108 },
  { act: 4, townLevelId: 109, minLevelId: 109, maxLevelId: 136 },
]

export const K5_COLLIDE_BLOCK_PLAYER = 0x0001
export const K5_COLLIDE_BLANK = 0x0020
export const K5_COLLIDE_VOID_SENTINEL = 0x0027
export const K5_COLLIDE_SPAWN_WALK_MASK = 0x1c09

export interface K5LevelTraversalRecord {
  readonly seed: number
  readonly difficulty: number
  readonly act: number
  readonly levelId: number
  readonly drlgType: number
  readonly levelType: number
  readonly posX: number
  readonly posY: number
  readonly sizeX: number
  readonly sizeY: number
  readonly nRoomsHeader: number
  readonly nRoomsGraph: number
  readonly nActiveRooms: number
  readonly nCollGrids: number
  readonly totalSubtiles: number
  readonly walkableSubtiles: number
  readonly universalDt1Violations: number
  readonly voidProbeMask: number
  readonly roomBoundsViolations: number
  readonly nearRoomViolations: number
  readonly crossLevelNearLinks: number
  readonly presetUnitsTotal: number
  readonly presetMonsters: number
  readonly presetObjects: number
  readonly presetWarps: number
  readonly presetBoundsViolations: number
  readonly spawnedNonMonsters: number
  readonly spawnedMonsters: number
  readonly warpTileNodes: number
  readonly warpBidirectionalLinked: number
  readonly warpViolations: number
  readonly warpArrayValidSlots: number
  readonly spawnRoomPtr: number
  readonly spawnSubtileX: number
  readonly spawnSubtileY: number
  readonly spawnFootprintClear: boolean
  readonly layoutHash: bigint
  readonly collHash: bigint
}

export interface K5DifficultyTraversalSummary {
  readonly seed: number
  readonly difficulty: number
  readonly levels: ReadonlyArray<K5LevelTraversalRecord>
  readonly totalRooms: number
  readonly totalSubtiles: number
  readonly totalPresetUnits: number
  readonly totalWarpNodes: number
}

export function resolveK5D2DataDir(): string {
  const envDir = process.env.D2_DATA_DIR
  if (envDir !== undefined && envDir.length > 0) {
    return envDir
  }
  return join(homedir(), 'd2-data')
}

export function isK5TraversalEnvReady(dataDir = resolveK5D2DataDir()): boolean {
  return (
    existsSync(K5_DATATBLS_IMG_PATH) &&
    existsSync(join(dataDir, 'Patch_D2.mpq')) &&
    existsSync(join(dataDir, 'd2exp.mpq')) &&
    existsSync(join(dataDir, 'd2data.mpq'))
  )
}

function openSyncMpqSource(filePath: string): MpqSource {
  const fd = openSync(filePath, 'r')
  const size = fstatSync(fd).size
  return {
    size,
    label: filePath,
    read: async (offset, length) => {
      const buf = new Uint8Array(length)
      readSync(fd, buf, 0, length, offset)
      return buf
    },
    readSync: (offset, length) => {
      const buf = new Uint8Array(length)
      readSync(fd, buf, 0, length, offset)
      return buf
    },
  }
}

function loadBaseDataTablesPages(raw: Uint8Array): Map<number, Uint8Array> {
  const hdr = parseVectorHeader(raw)
  if (hdr.magic !== D2TV_MAGIC || hdr.kind !== 'PAGEIMG' || hdr.recordSize !== 4100) {
    throw new Error(`Invalid PAGEIMG header in drlg-datatbls-113c.img.gz: kind=${hdr.kind}`)
  }
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const pages = new Map<number, Uint8Array>()
  for (let i = 0; i < hdr.recordCount; i++) {
    const off = 32 + i * 4100
    const va = dv.getUint32(off, true) >>> 0
    const page = new Uint8Array(4096)
    page.set(raw.subarray(off + 4, off + 4100))
    pages.set(va >>> 12, page)
  }

  const iatPage = pages.get(0x6fdd9000 >>> 12)
  if (iatPage !== undefined) {
    const pDv = new DataView(iatPage.buffer, iatPage.byteOffset, iatPage.byteLength)
    pDv.setUint32(0x1fc, 0x00010000, true)
    const bitMasksVa = pDv.getUint32(0x0b0, true) >>> 0
    const invBitMasksVa = pDv.getUint32(0x078, true) >>> 0
    const writeByte = (addr: number, val: number): void => {
      const a = addr >>> 0
      const pg = a >>> 12
      let page = pages.get(pg)
      if (page === undefined) {
        page = new Uint8Array(4096)
        pages.set(pg, page)
      }
      page[a & 0xfff] = val & 0xff
    }
    const writeU32 = (addr: number, val: number): void => {
      const v = val >>> 0
      writeByte(addr, v & 0xff)
      writeByte(addr + 1, (v >>> 8) & 0xff)
      writeByte(addr + 2, (v >>> 16) & 0xff)
      writeByte(addr + 3, (v >>> 24) & 0xff)
    }
    if (bitMasksVa !== 0) {
      for (let i = 0; i < 32; i++) {
        writeU32((bitMasksVa + i * 4) >>> 0, (1 << i) >>> 0)
      }
    }
    if (invBitMasksVa !== 0) {
      for (let i = 0; i < 32; i++) {
        writeU32((invBitMasksVa + i * 4) >>> 0, ~(1 << i) >>> 0)
      }
    }
  }
  return pages
}

interface SyncedMemory extends SparseMemory113c {
  syncDt1Pages: (pages: readonly number[]) => void
}

interface K5RuntimeEnv {
  createMemory: () => SyncedMemory
  bindActiveMemory: (m: SyncedMemory | null) => void
}

let cachedK5Env: K5RuntimeEnv | null = null

function getOrCreateK5Env(): K5RuntimeEnv {
  if (cachedK5Env !== null) {
    return cachedK5Env
  }
  const dataDir = resolveK5D2DataDir()
  const mpqs = [
    MpqArchive.openSync(openSyncMpqSource(join(dataDir, 'Patch_D2.mpq'))),
    MpqArchive.openSync(openSyncMpqSource(join(dataDir, 'd2exp.mpq'))),
    MpqArchive.openSync(openSyncMpqSource(join(dataDir, 'd2data.mpq'))),
  ]

  const readMpqFileSync = (name: string): Uint8Array | undefined => {
    for (const ar of mpqs) {
      const entry = ar.find(name)
      if (entry !== undefined) {
        return ar.readSync(entry)
      }
    }
    return undefined
  }

  const rawImg = new Uint8Array(gunzipSync(readFileSync(K5_DATATBLS_IMG_PATH)))
  const basePages = loadBaseDataTablesPages(rawImg)

  const dt1Pages = new Map<number, Uint8Array>()
  let dt1AllocTop = 0x30000000
  const dt1HashCache = new Map<string, number>()
  const ds1BytesCache = new Map<string, Uint8Array>()

  const dt1WriteByte = (addr: number, val: number): void => {
    const a = addr >>> 0
    const pg = a >>> 12
    let buf = dt1Pages.get(pg)
    if (buf === undefined) {
      buf = new Uint8Array(4096)
      dt1Pages.set(pg, buf)
    }
    buf[a & 0xfff] = val & 0xff
  }
  const dt1ReadByte = (addr: number): number => {
    const a = addr >>> 0
    const buf = dt1Pages.get(a >>> 12)
    return buf !== undefined ? buf[a & 0xfff]! : 0
  }
  const dt1U32 = (addr: number): number =>
    (dt1ReadByte(addr) |
      (dt1ReadByte(addr + 1) << 8) |
      (dt1ReadByte(addr + 2) << 16) |
      ((dt1ReadByte(addr + 3) << 24) >>> 0)) >>>
    0
  const dt1SetU32 = (addr: number, val: number): void => {
    const v = val >>> 0
    dt1WriteByte(addr, v & 0xff)
    dt1WriteByte(addr + 1, (v >>> 8) & 0xff)
    dt1WriteByte(addr + 2, (v >>> 16) & 0xff)
    dt1WriteByte(addr + 3, (v >>> 24) & 0xff)
  }
  const dt1Alloc = (size: number): number => {
    const p = ((dt1AllocTop + 3) & ~3) >>> 0
    for (let i = 0; i < size; i++) {
      dt1WriteByte(p + i, 0)
    }
    dt1AllocTop = (p + size) >>> 0
    return p
  }

  const getOrBuildDt1Hash = (path: string): { pHash: number; touchedPages: number[] } => {
    if (path.length === 0 || path === '0') {
      return { pHash: 0, touchedPages: [] }
    }
    const normPath = path.replace(/\//g, '\\')
    const key = normPath.toLowerCase()
    const cached = dt1HashCache.get(key)
    if (cached !== undefined) {
      return { pHash: cached, touchedPages: [] }
    }
    const bytes = readMpqFileSync(normPath)
    if (bytes === undefined || bytes.length < 0x114) {
      dt1HashCache.set(key, 0)
      return { pHash: 0, touchedPages: [] }
    }
    const beforePages = new Set(dt1Pages.keys())
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const nTiles = dv.getInt32(0x10c, true)
    const hdrOff = dv.getUint32(0x110, true)
    if (nTiles < 0 || hdrOff < 0x114 || hdrOff > bytes.length) {
      dt1HashCache.set(key, 0)
      return { pHash: 0, touchedPages: [] }
    }
    const hdrBytes = hdrOff + nTiles * 0x60
    const pLib = dt1Alloc(hdrBytes)
    const copyLen = Math.min(bytes.length, hdrBytes)
    for (let i = 0; i < copyLen; i++) {
      dt1WriteByte(pLib + i, bytes[i]!)
    }
    for (let i = 0; i < normPath.length && i < 259; i++) {
      dt1WriteByte(pLib + 0x08 + i, normPath.charCodeAt(i) & 0xff)
    }
    dt1WriteByte(pLib + 0x08 + Math.min(normPath.length, 259), 0)
    const pTilesBase = (pLib + hdrOff) >>> 0
    dt1SetU32(pLib + 0x110, pTilesBase)
    for (let i = 0; i < nTiles; i++) {
      const pTile = (pTilesBase + i * 0x60) >>> 0
      dt1SetU32(pTile + 0x58, (pLib + 0x08) >>> 0)
    }
    const pHash = dt1Alloc(0x200)
    for (let i = 0; i < nTiles; i++) {
      const pTile = (pTilesBase + i * 0x60) >>> 0
      const orient = dt1U32(pTile + 0x14) | 0
      const style = dt1U32(pTile + 0x18) | 0
      const seq = dt1U32(pTile + 0x1c) | 0
      const bucket = ((((seq & 0xff) << 1) - (orient & 0xff) + (style & 0xff)) & 0x7f) >>> 0
      const bucketAddr = (pHash + bucket * 4) >>> 0
      let pNode = dt1U32(bucketAddr)
      let foundNode = 0
      while (pNode !== 0) {
        if (
          (dt1U32(pNode) | 0) === style &&
          (dt1U32(pNode + 0x04) | 0) === seq &&
          (dt1U32(pNode + 0x08) | 0) === orient
        ) {
          foundNode = pNode
          break
        }
        pNode = dt1U32(pNode + 0x10)
      }
      if (foundNode === 0) {
        const pNewNode = dt1Alloc(0x14)
        dt1SetU32(pNewNode + 0x00, style >>> 0)
        dt1SetU32(pNewNode + 0x04, seq >>> 0)
        dt1SetU32(pNewNode + 0x08, orient >>> 0)
        dt1SetU32(pNewNode + 0x10, dt1U32(bucketAddr))
        dt1SetU32(bucketAddr, pNewNode)
        const pBlock = dt1Alloc(0x08)
        dt1SetU32(pBlock + 0x00, pTile)
        dt1SetU32(pBlock + 0x04, 0)
        dt1SetU32(pNewNode + 0x0c, pBlock)
      } else {
        let pCurBlock = dt1U32(foundNode + 0x0c)
        let dup = false
        while (pCurBlock !== 0) {
          if (dt1U32(pCurBlock) === pTile) {
            dup = true
            break
          }
          pCurBlock = dt1U32(pCurBlock + 0x04)
        }
        if (!dup) {
          const pBlock = dt1Alloc(0x08)
          dt1SetU32(pBlock + 0x00, pTile)
          dt1SetU32(pBlock + 0x04, dt1U32(foundNode + 0x0c))
          dt1SetU32(foundNode + 0x0c, pBlock)
        }
      }
    }
    dt1HashCache.set(key, pHash)
    const touchedPages: number[] = []
    for (const pg of dt1Pages.keys()) {
      if (!beforePages.has(pg)) {
        touchedPages.push(pg)
      }
    }
    for (const pg of beforePages) {
      touchedPages.push(pg)
    }
    return { pHash, touchedPages }
  }

  let activeMem: SyncedMemory | null = null

  const globals = globalThis as unknown as {
    __d2LoadMpqDs1: (m: Memory113c, relPath: string) => Uint8Array | null
    __d2LoadMpqDt1Hash: (m: Memory113c, path: string) => number
  }

  globals.__d2LoadMpqDs1 = (_m: Memory113c, relPath: string) => {
    const norm = relPath.replace(/\//g, '\\').replace(/^\\+/, '')
    const fullPath = /^data\\global\\tiles\\/i.test(norm)
      ? norm
      : `DATA\\GLOBAL\\TILES\\${norm}`
    const key = fullPath.toLowerCase()
    let bytes = ds1BytesCache.get(key)
    if (bytes === undefined) {
      bytes = readMpqFileSync(fullPath)
      if (bytes === undefined) {
        throw new Error(`Missing DS1 in MPQ archives: ${fullPath}`)
      }
      ds1BytesCache.set(key, bytes)
    }
    return bytes
  }

  globals.__d2LoadMpqDt1Hash = (_m: Memory113c, path: string) => {
    const { pHash, touchedPages } = getOrBuildDt1Hash(path)
    if (touchedPages.length > 0 && activeMem !== null) {
      activeMem.syncDt1Pages(touchedPages)
    }
    return pHash
  }

  const fullKnownPage = new Uint8Array(4096).fill(1)

  const createMemory = (): SyncedMemory => {
    const m = new SparseMemory113c() as SyncedMemory
    const internal = m as unknown as {
      pages: Map<number, Uint8Array>
      known: Map<number, Uint8Array>
    }
    for (const [pg, data] of basePages) {
      const copy = new Uint8Array(4096)
      copy.set(data)
      internal.pages.set(pg, copy)
      internal.known.set(pg, fullKnownPage)
    }
    for (const [pg, data] of dt1Pages) {
      internal.pages.set(pg, data)
      internal.known.set(pg, fullKnownPage)
    }
    m.syncDt1Pages = (pages: readonly number[]) => {
      for (const pg of pages) {
        const data = dt1Pages.get(pg)
        if (data !== undefined) {
          internal.pages.set(pg, data)
          internal.known.set(pg, fullKnownPage)
        }
      }
    }
    return m
  }

  cachedK5Env = {
    createMemory,
    bindActiveMemory: (m: SyncedMemory | null) => {
      activeMem = m
    },
  }
  return cachedK5Env
}

/**
 * Traverses all 136 levels (`1..136`, Acts 1-5 + Pandemonium/Uber levels `133..136`)
 * for a single `(seed, difficulty)` pair in pure `src/d2kern-113c/`.
 */
export function traverseDifficultyLevels113c(
  seed: number,
  difficulty: number,
): K5DifficultyTraversalSummary {
  const env = getOrCreateK5Env()
  const m = env.createMemory()
  env.bindActiveMemory(m)

  try {
    const records = new Array<K5LevelTraversalRecord>(136)
    const pGame = m.alloc(0x2000)
    m.setU32((pGame + 0x7c) >>> 0, seed >>> 0)
    m.setU8((pGame + 0x6d) >>> 0, difficulty & 0xff)

    // Reusable scratch unit/monster/AI structs for `ROOM_SpawnPresetUnits113c` verification
    const pScratchUnit = m.alloc(0xf4)
    const pScratchMonData = m.alloc(0x60)
    const pScratchAi = m.alloc(0x40)
    const pWarpX = m.alloc(0x20)
    const pWarpY = (pWarpX + 4) >>> 0
    const pSpawnX = (pWarpX + 8) >>> 0
    const pSpawnY = (pWarpX + 12) >>> 0
    const pVoidBox = (pWarpX + 16) >>> 0
    m.setU32(pVoidBox, (-120) >>> 0)
    m.setU32((pVoidBox + 4) >>> 0, (-120) >>> 0)
    m.setU32((pVoidBox + 8) >>> 0, (-119) >>> 0)
    m.setU32((pVoidBox + 12) >>> 0, (-119) >>> 0)

    let totalRooms = 0
    let totalSubtiles = 0
    let totalPresetUnits = 0
    let totalWarpNodes = 0

    for (const actRange of K5_ACT_LEVEL_RANGES) {
      const { act, townLevelId, minLevelId, maxLevelId } = actRange
      const pAct = DUNGEON_AllocAct113c(
        m,
        act,
        seed >>> 0,
        0,
        pGame,
        difficulty & 0xff,
        0,
        townLevelId,
        0,
        0,
      )
      const pDrlg = m.u32((pAct + 0x48) >>> 0)
      const levelPtrs = new Uint32Array(137)
      const layoutHashes = new Array<bigint>(137)

      // Phase 1: Allocate & initialize room graphs (`D2DrlgLevelStrc` + `D2RoomExStrc`) across the Act
      for (let levelId = minLevelId; levelId <= maxLevelId; levelId++) {
        let pLevel = m.u32((pDrlg + 0x47c) >>> 0)
        while (pLevel !== 0 && (m.u32((pLevel + 0x1d0) >>> 0) | 0) !== levelId) {
          pLevel = m.u32((pLevel + 0x1ac) >>> 0)
        }
        const preAlloc = pLevel !== 0 ? 1 : 0
        if (pLevel === 0) {
          pLevel = DRLG_AllocAndInitLevel113c(m, pDrlg, levelId)
        }
        const wasInit = m.u32((pLevel + 0x10) >>> 0) !== 0 ? 1 : 0
        if (wasInit === 0) {
          DRLG_InitLevelRooms113c(m, pLevel)
        }
        levelPtrs[levelId] = pLevel

        const lvlHdr: DrlgLevelHeaderRecord = {
          marker: DRLG_LEVEL_HEADER_MARKER,
          levelId,
          act,
          diff: difficulty & 0xff,
          flags: preAlloc | (wasInit << 1),
          reserved: 0,
          drlgType: m.u32(pLevel),
          dwFlags: m.u32((pLevel + 0x04) >>> 0),
          nRooms: m.u32((pLevel + 0x08) >>> 0),
          posX: m.u32((pLevel + 0x1c) >>> 0) | 0,
          posY: m.u32((pLevel + 0x20) >>> 0) | 0,
          sizeX: m.u32((pLevel + 0x24) >>> 0) | 0,
          sizeY: m.u32((pLevel + 0x28) >>> 0) | 0,
          nLevelType: m.u32((pLevel + 0x1c0) >>> 0),
          seedLo: m.u32((pLevel + 0x1c4) >>> 0),
          seedHi: m.u32((pLevel + 0x1c8) >>> 0),
        }

        const roomRecs: DrlgRoomRecord[] = []
        let roomIdx = 0
        for (let r = m.u32((pLevel + 0x10) >>> 0); r !== 0; r = m.u32((r + 0x24) >>> 0)) {
          const nType = m.u32((r + 0x48) >>> 0)
          const pTypeData = m.u32((r + 0x20) >>> 0)
          let presetId = -1
          let presetSub = -1
          if (nType === 2 && pTypeData !== 0) {
            presetId = m.u32(pTypeData) | 0
            presetSub = m.u32((pTypeData + 0x04) >>> 0) | 0
          }
          roomRecs.push({
            levelId,
            idx: roomIdx++,
            x: m.u32((r + 0x34) >>> 0) | 0,
            y: m.u32((r + 0x38) >>> 0) | 0,
            w: m.u32((r + 0x3c) >>> 0) | 0,
            h: m.u32((r + 0x40) >>> 0) | 0,
            nType,
            dwFlags: m.u32((r + 0x28) >>> 0),
            presetId,
            presetSub,
            dwInitSeed: m.u32((r + 0x04) >>> 0),
            seedLo: m.u32((r + 0x14) >>> 0),
            seedHi: m.u32((r + 0x18) >>> 0),
          })
        }
        layoutHashes[levelId] = computeDrlgLevelLayoutHash(lvlHdr, roomRecs)
      }

      // Phase 2: Activate every `D2RoomExStrc` -> `D2ActiveRoomStrc` + `D2RoomCollisionGridStrc`,
      // and verify room graph, collision grid, universal DT1 void protection, presets, and warps
      const partialByLevel = new Map<
        number,
        Omit<
          K5LevelTraversalRecord,
          | 'spawnRoomPtr'
          | 'spawnSubtileX'
          | 'spawnSubtileY'
          | 'spawnFootprintClear'
          | 'spawnedNonMonsters'
          | 'spawnedMonsters'
        > & { roomPtrs: number[]; activeRoomPtrs: number[] }
      >()

      for (let levelId = minLevelId; levelId <= maxLevelId; levelId++) {
        const pLevel = levelPtrs[levelId]!
        const drlgType = m.u32(pLevel) | 0
        const levelType = m.u32((pLevel + 0x1c0) >>> 0) | 0
        const posX = m.u32((pLevel + 0x1c) >>> 0) | 0
        const posY = m.u32((pLevel + 0x20) >>> 0) | 0
        const sizeX = m.u32((pLevel + 0x24) >>> 0) | 0
        const sizeY = m.u32((pLevel + 0x28) >>> 0) | 0
        const nRoomsHeader = m.u32((pLevel + 0x08) >>> 0) | 0

        const seenRoomEx = new Set<number>()
        const roomPtrs: number[] = []
        for (let r = m.u32((pLevel + 0x10) >>> 0); r !== 0; r = m.u32((r + 0x24) >>> 0)) {
          if (seenRoomEx.has(r)) {
            throw new Error(`Cycle in D2RoomExStrc list on level=${levelId} diff=${difficulty}`)
          }
          seenRoomEx.add(r)
          roomPtrs.push(r)
        }

        const activeRoomPtrs: number[] = []
        const collChunks: Uint8Array[] = []
        let nActiveRooms = 0
        let nCollGrids = 0
        let lvlSubtiles = 0
        let walkableSubtiles = 0
        let universalDt1Violations = 0
        let roomBoundsViolations = 0
        let nearRoomViolations = 0
        let crossLevelNearLinks = 0
        let presetUnitsTotal = 0
        let presetMonsters = 0
        let presetObjects = 0
        let presetWarps = 0
        let presetBoundsViolations = 0
        let warpTileNodes = 0
        let warpBidirectionalLinked = 0
        let warpViolations = 0

        for (const r of roomPtrs) {
          const parentLvl = m.u32((r + 0x58) >>> 0)
          const rx = m.u32((r + 0x34) >>> 0) | 0
          const ry = m.u32((r + 0x38) >>> 0) | 0
          const rw = m.u32((r + 0x3c) >>> 0) | 0
          const rh = m.u32((r + 0x40) >>> 0) | 0
          const rType = m.u32((r + 0x48) >>> 0) | 0
          const rTypeData = m.u32((r + 0x20) >>> 0)
          if (
            parentLvl !== pLevel ||
            rw <= 0 ||
            rh <= 0 ||
            rx < posX ||
            ry < posY ||
            rx + rw > posX + sizeX ||
            ry + rh > posY + sizeY ||
            (rType !== 1 && rType !== 2) ||
            (rType === 2 && rTypeData === 0)
          ) {
            roomBoundsViolations++
          }

          const activeRoom = DRLGROOM_EnsureRoomAndGetRoom1_113c(m, r)
          if (activeRoom !== 0) {
            nActiveRooms++
            activeRoomPtrs.push(activeRoom)
            if (
              m.u32((r + 0x30) >>> 0) !== activeRoom ||
              m.u32((activeRoom + 0x10) >>> 0) !== r ||
              m.u32((activeRoom + 0x2c) >>> 0) !== pAct ||
              (m.u32((activeRoom + 0x5c) >>> 0) | 0) !== rx ||
              (m.u32((activeRoom + 0x60) >>> 0) | 0) !== ry ||
              (m.u32((activeRoom + 0x64) >>> 0) | 0) !== rw ||
              (m.u32((activeRoom + 0x68) >>> 0) | 0) !== rh ||
              (m.u32((activeRoom + 0x4c) >>> 0) | 0) !== rx * 5 ||
              (m.u32((activeRoom + 0x50) >>> 0) | 0) !== ry * 5 ||
              (m.u32((activeRoom + 0x54) >>> 0) | 0) !== rw * 5 ||
              (m.u32((activeRoom + 0x58) >>> 0) | 0) !== rh * 5
            ) {
              roomBoundsViolations++
            }
          }

          // RoomEx adjacency graph (`ppRoomsNear` at `+0x08`, `nRoomsNear` at `+0x2c`)
          const nNear = m.u32((r + 0x2c) >>> 0) | 0
          const ppNear = m.u32((r + 0x08) >>> 0)
          let hasSelfInNear = false
          if (nNear <= 0 || ppNear === 0) {
            nearRoomViolations++
          } else {
            for (let ni = 0; ni < nNear; ni++) {
              const nr = m.u32((ppNear + ni * 4) >>> 0)
              if (nr === 0) {
                nearRoomViolations++
                continue
              }
              if (nr === r) {
                hasSelfInNear = true
              }
              const nrLvl = m.u32((nr + 0x58) >>> 0)
              const nrLvlId = nrLvl !== 0 ? (m.u32((nrLvl + 0x1d0) >>> 0) | 0) : 0
              if (nrLvlId < 1 || nrLvlId > 136) {
                nearRoomViolations++
              } else if (nrLvlId !== levelId) {
                crossLevelNearLinks++
              }
            }
            if (!hasSelfInNear) {
              nearRoomViolations++
            }
          }

          // Collision grid (`pColl` at `activeRoom + 0x20`) & universal DT1s (`r + 0x68`)
          if (activeRoom !== 0) {
            let loadedDt1Count = 0
            for (let ti = 0; ti < 32; ti++) {
              if (m.u32((r + 0x68 + ti * 4) >>> 0) !== 0) {
                loadedDt1Count++
              }
            }
            if ((m.u32((r + 0x28) >>> 0) & 0x1000000) === 0 || loadedDt1Count < 3) {
              universalDt1Violations++
            }

            const cg = m.u32((activeRoom + 0x20) >>> 0)
            if (cg !== 0) {
              const subW = m.u32((cg + 0x08) >>> 0) | 0
              const subH = m.u32((cg + 0x0c) >>> 0) | 0
              const cells = subW * subH
              const mapPtr = m.u32((cg + 0x20) >>> 0)
              if (
                (m.u32(cg) | 0) !== rx * 5 ||
                (m.u32((cg + 0x04) >>> 0) | 0) !== ry * 5 ||
                subW !== rw * 5 ||
                subH !== rh * 5 ||
                mapPtr === 0 ||
                cells <= 0
              ) {
                roomBoundsViolations++
              }
              const hdrBytes = m.readBytes(cg, 32)
              collChunks.push(hdrBytes)
              if (mapPtr !== 0 && cells > 0) {
                const mapBytes = m.readBytes(mapPtr, cells * 2)
                collChunks.push(mapBytes)
                const dv = new DataView(mapBytes.buffer, mapBytes.byteOffset, mapBytes.byteLength)
                for (let ci = 0; ci < cells; ci++) {
                  const mask = dv.getUint16(ci * 2, true)
                  if ((mask & K5_COLLIDE_SPAWN_WALK_MASK) === 0) {
                    walkableSubtiles++
                  }
                }
              }
              nCollGrids++
              lvlSubtiles += cells
            }
          }

          // Preset units (`pPresetUnits` at `r + 0x5c`)
          const maxSubX = rw * 5
          const maxSubY = rh * 5
          for (let p = m.u32((r + 0x5c) >>> 0); p !== 0; p = m.u32((p + 0x0c) >>> 0)) {
            presetUnitsTotal++
            const unitType = m.u32((p + 0x14) >>> 0) | 0
            const clsId = m.u32((p + 0x04) >>> 0) | 0
            const px = m.u32((p + 0x08) >>> 0) | 0
            const py = m.u32((p + 0x18) >>> 0) | 0
            if (unitType === 1) presetMonsters++
            else if (unitType === 2) presetObjects++
            else if (unitType === 5) presetWarps++
            else presetBoundsViolations++

            if (clsId < 0 || px < 0 || py < 0 || px >= maxSubX || py >= maxSubY) {
              presetBoundsViolations++
            }
          }

          // RoomTile warp linkage (`pRoomTiles` at `r + 0x4c`)
          for (let w = m.u32((r + 0x4c) >>> 0); w !== 0; w = m.u32((w + 0x04) >>> 0)) {
            warpTileNodes++
            const targetRx = m.u32(w) >>> 0
            const pLvlWarpTxt = m.u32((w + 0x10) >>> 0) >>> 0
            const targetLvl = targetRx !== 0 ? m.u32((targetRx + 0x58) >>> 0) : 0
            const targetLvlId = targetLvl !== 0 ? (m.u32((targetLvl + 0x1d0) >>> 0) | 0) : 0
            if (
              targetRx === 0 ||
              pLvlWarpTxt === 0 ||
              targetLvlId < minLevelId ||
              targetLvlId > maxLevelId
            ) {
              warpViolations++
            }
          }
        }

        const pWarpArr = DRLGROOMTILE_GetWarpLevelsArray113c(m, pDrlg, levelId)
        let warpArrayValidSlots = 0
        if (pWarpArr !== 0 && pWarpArr !== 0x68) {
          for (let wi = 0; wi < 8; wi++) {
            const destLvl = m.u32((pWarpArr + wi * 4) >>> 0) | 0
            if (destLvl >= -1 && destLvl <= 136) {
              warpArrayValidSlots++
            }
          }
        }

        const firstActiveRoom = activeRoomPtrs.length > 0 ? activeRoomPtrs[0]! : 0
        const voidProbeMask =
          firstActiveRoom !== 0
            ? COLLISION_GetCombinedMaskForBoxRecursively113c(m, firstActiveRoom, pVoidBox, 0xffff)
            : 0

        totalRooms += roomPtrs.length
        totalSubtiles += lvlSubtiles
        totalPresetUnits += presetUnitsTotal
        totalWarpNodes += warpTileNodes

        partialByLevel.set(levelId, {
          seed: seed >>> 0,
          difficulty: difficulty & 0xff,
          act,
          levelId,
          drlgType,
          levelType,
          posX,
          posY,
          sizeX,
          sizeY,
          nRoomsHeader,
          nRoomsGraph: roomPtrs.length,
          nActiveRooms,
          nCollGrids,
          totalSubtiles: lvlSubtiles,
          walkableSubtiles,
          universalDt1Violations,
          voidProbeMask,
          roomBoundsViolations,
          nearRoomViolations,
          crossLevelNearLinks,
          presetUnitsTotal,
          presetMonsters,
          presetObjects,
          presetWarps,
          presetBoundsViolations,
          warpTileNodes,
          warpBidirectionalLinked,
          warpViolations,
          warpArrayValidSlots,
          layoutHash: layoutHashes[levelId]!,
          collHash: sha256Low64LE(collChunks),
          roomPtrs,
          activeRoomPtrs,
        })
      }

      // Phase 3: After golden `layoutHash` + `collHash` are captured cleanly, verify:
      // 1) Bidirectional warp resolution (`DRLG_FindWarpTargetRoom113c`) across all `D2RoomTileStrc` edges
      // 2) Grounded walkable spawn discovery (`DUNGEON_FindFreeSpawnPositionInLevel113c` + `0x1c09` footprint check)
      // 3) `ROOM_SpawnPresetUnits113c` preset unit dispatch across every active room (including Uber 133..136 filters)
      for (let levelId = minLevelId; levelId <= maxLevelId; levelId++) {
        const part = partialByLevel.get(levelId)!
        let warpBidirectionalLinked = 0
        let warpViolations = part.warpViolations

        for (const r of part.roomPtrs) {
          for (let w = m.u32((r + 0x4c) >>> 0); w !== 0; w = m.u32((w + 0x04) >>> 0)) {
            const pLvlWarpTxt = m.u32((w + 0x10) >>> 0) >>> 0
            if (pLvlWarpTxt === 0) continue
            const warpKey = m.u32(pLvlWarpTxt) | 0
            const resolvedActiveRoom = DRLG_FindWarpTargetRoom113c(m, warpKey, r, pWarpX, pWarpY)
            if (resolvedActiveRoom !== 0) {
              warpBidirectionalLinked++
            } else {
              warpViolations++
            }
          }
        }

        const spawnRoomPtr = DUNGEON_FindFreeSpawnPositionInLevel113c(
          m,
          pAct,
          levelId,
          0,
          pSpawnX,
          pSpawnY,
          2,
        )
        const spawnSubtileX = m.u32(pSpawnX) | 0
        const spawnSubtileY = m.u32(pSpawnY) | 0
        const spawnFootprintClear =
          spawnRoomPtr !== 0 &&
          (COLLISION_CheckMaskWithPattern1_113c(
            m,
            spawnRoomPtr,
            spawnSubtileX,
            spawnSubtileY,
            2,
            K5_COLLIDE_SPAWN_WALK_MASK,
          ) &
            0xffff) ===
            0

        let spawnedNonMonsters = 0
        let spawnedMonsters = 0
        m.setU32((pGame + 0x1de4) >>> 0, 0)

        const initScratchUnit = (unitType: number, clsId: number): number => {
          m.fill(pScratchUnit, 0xf4, 0)
          m.setU32(pScratchUnit, unitType >>> 0)
          m.setU32((pScratchUnit + 0x04) >>> 0, clsId >>> 0)
          if (unitType === 1) {
            m.fill(pScratchMonData, 0x60, 0)
            m.fill(pScratchAi, 0x40, 0)
            m.setU32((pScratchUnit + 0x14) >>> 0, pScratchMonData)
            m.setU32((pScratchMonData + 0x28) >>> 0, pScratchAi)
          }
          return pScratchUnit
        }

        const callees: RoomPresetCallees113c = {
          spawnMonsterPreset: (_mem, _room, clsId) => {
            spawnedMonsters++
            return initScratchUnit(1, clsId)
          },
          spawnSpecialObject: (_mem, clsId) => {
            spawnedNonMonsters++
            return initScratchUnit(2, clsId)
          },
          allocUnitData: (_mem, unitType, clsId) => {
            if (unitType === 1) spawnedMonsters++
            else spawnedNonMonsters++
            return initScratchUnit(unitType, clsId)
          },
          placePresetItem: () => 1,
          freeUnit: () => {},
          initQuestObject1CB: () => {},
          initQuestObject1CD: () => {},
          initQuestObject21F: () => {},
        }

        for (const ar of part.activeRoomPtrs) {
          ROOM_SpawnPresetUnits113c(m, pGame, ar, callees)
        }

        records[levelId - 1] = {
          seed: part.seed,
          difficulty: part.difficulty,
          act: part.act,
          levelId: part.levelId,
          drlgType: part.drlgType,
          levelType: part.levelType,
          posX: part.posX,
          posY: part.posY,
          sizeX: part.sizeX,
          sizeY: part.sizeY,
          nRoomsHeader: part.nRoomsHeader,
          nRoomsGraph: part.nRoomsGraph,
          nActiveRooms: part.nActiveRooms,
          nCollGrids: part.nCollGrids,
          totalSubtiles: part.totalSubtiles,
          walkableSubtiles: part.walkableSubtiles,
          universalDt1Violations: part.universalDt1Violations,
          voidProbeMask: part.voidProbeMask,
          roomBoundsViolations: part.roomBoundsViolations,
          nearRoomViolations: part.nearRoomViolations,
          crossLevelNearLinks: part.crossLevelNearLinks,
          presetUnitsTotal: part.presetUnitsTotal,
          presetMonsters: part.presetMonsters,
          presetObjects: part.presetObjects,
          presetWarps: part.presetWarps,
          presetBoundsViolations: part.presetBoundsViolations,
          spawnedNonMonsters,
          spawnedMonsters,
          warpTileNodes: part.warpTileNodes,
          warpBidirectionalLinked,
          warpViolations,
          warpArrayValidSlots: part.warpArrayValidSlots,
          spawnRoomPtr,
          spawnSubtileX,
          spawnSubtileY,
          spawnFootprintClear,
          layoutHash: part.layoutHash,
          collHash: part.collHash,
        }
      }
    }

    return {
      seed: seed >>> 0,
      difficulty: difficulty & 0xff,
      levels: records,
      totalRooms,
      totalSubtiles,
      totalPresetUnits,
      totalWarpNodes,
    }
  } finally {
    env.bindActiveMemory(null)
  }
}
