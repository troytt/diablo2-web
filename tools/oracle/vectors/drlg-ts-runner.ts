import { spawn } from 'node:child_process'
import { existsSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs'
import { cpus, homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { MpqArchive } from '../../../src/common/mpq/archive.ts'
import type { MpqSource } from '../../../src/common/mpq/source.ts'
import * as d2kern from '../../../src/d2kern-113c/index.ts'
import type { Memory113c, SparseMemory113c } from '../../../src/d2kern-113c/index.ts'
import {
  DRLG_LEVEL_HEADER_MARKER,
  DRLG_TOWN_LEVEL_IDS,
  type DrlgCollRecord,
  type DrlgDigestRecord,
  type DrlgLevelHeaderRecord,
  type DrlgLevelRoomsGroup,
  type DrlgRoomRecord,
  computeDrlgLevelLayoutHash,
  parseDrlgCollFile,
  parseDrlgDigestFile,
  parseDrlgRoomsFile,
  sha256Low64LE,
} from './drlg-vector.ts'
import { D2TV_MAGIC, type VectorHeader, parseVectorHeader } from './vector-format.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const FIXTURES_DIR = resolve(REPO_ROOT, 'tests/fixtures/oracle/vectors')

export const DRLG_DATATBLS_IMG_PATH = resolve(FIXTURES_DIR, 'drlg-datatbls-113c.img.gz')
export const DRLG_DATATBLS_RAW_SHA256 =
  '20d0c81868b9296a56b70a1273ac25fc1af4399d6afb612ac502cf3e746d7bf2'

type AllocActFn = (
  m: Memory113c,
  nAct: number,
  nSeed: number,
  bClient: number,
  pGame: number,
  nDifficulty: number,
  pMemPool: number,
  nTownLevelId: number,
  pfAutoMap: number,
  pfTownAutoMap: number,
) => number
type AllocLevelFn = (m: Memory113c, pDrlg: number, nLevelId: number) => number
type InitLevelRoomsFn = (m: Memory113c, pLevel: number) => void
type ActivateRoomExFn = (m: Memory113c, pRoomEx: number) => number

interface KernelEntrypoints {
  allocAct: AllocActFn
  allocLevel: AllocLevelFn
  initLevelRooms: InitLevelRoomsFn
  activateRoomEx: ActivateRoomExFn
}

function resolveKernelEntrypoints(): KernelEntrypoints | null {
  const k = d2kern as Record<string, unknown>
  const allocAct = k['DUNGEON_AllocAct113c']
  const allocLevel = k['DRLG_AllocAndInitLevel113c']
  const initLevelRooms = k['DRLG_InitLevelRooms113c']
  const activateRoomEx = k['DRLGROOM_EnsureRoomAndGetRoom1_113c']
  if (
    typeof allocAct !== 'function' ||
    typeof allocLevel !== 'function' ||
    typeof initLevelRooms !== 'function' ||
    typeof activateRoomEx !== 'function'
  ) {
    return null
  }
  return {
    allocAct: allocAct as AllocActFn,
    allocLevel: allocLevel as AllocLevelFn,
    initLevelRooms: initLevelRooms as InitLevelRoomsFn,
    activateRoomEx: activateRoomEx as ActivateRoomExFn,
  }
}

export function getDrlgDataDir(): string {
  return process.env.D2_DATA_DIR ?? join(homedir(), 'd2-data')
}

export function hasDrlgMpqFiles(dataDir = getDrlgDataDir()): boolean {
  return (
    existsSync(join(dataDir, 'Patch_D2.mpq')) &&
    existsSync(join(dataDir, 'd2exp.mpq')) &&
    existsSync(join(dataDir, 'd2data.mpq'))
  )
}

export function isDrlgLiveRunnerReady(): boolean {
  return (
    resolveKernelEntrypoints() !== null &&
    existsSync(DRLG_DATATBLS_IMG_PATH) &&
    hasDrlgMpqFiles()
  )
}

export function parseDrlgDataTablesImage(raw: Uint8Array): {
  header: VectorHeader
  pageCount: number
  pages: Map<number, Uint8Array>
} {
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
  // Patch KERNEL32.GetTickCount IAT slot at 0x6FDD91FC to 0x00010000 (matching drlg-emitter.c)
  const iatPage = pages.get(0x6fdd9000 >>> 12)
  if (iatPage) {
    const pDv = new DataView(iatPage.buffer, iatPage.byteOffset, iatPage.byteLength)
    pDv.setUint32(0x1fc, 0x00010000, true)
  }
  return { header: hdr, pageCount: hdr.recordCount, pages }
}

function syncFileSource(path: string): MpqSource {
  const fd = openSync(path, 'r')
  const size = fstatSync(fd).size
  return {
    size,
    label: path,
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

interface RunnerEnv {
  entrypoints: KernelEntrypoints
  basePages: Map<number, Uint8Array>
  dt1Pages: Map<number, Uint8Array>
  createMemory: () => SparseMemory113c & { syncDt1Pages: (pages: number[]) => void }
  setCurrentMemory: (m: { syncDt1Pages?: (pages: number[]) => void } | null) => void
}

let cachedEnv: RunnerEnv | null = null

function getOrInitRunnerEnv(): RunnerEnv {
  if (cachedEnv) return cachedEnv
  const entrypoints = resolveKernelEntrypoints()
  if (!entrypoints) {
    throw new Error(
      'DRLG entrypoints (DUNGEON_AllocAct113c / DRLG_AllocAndInitLevel113c / DRLG_InitLevelRooms113c / DRLGROOM_EnsureRoomAndGetRoom1_113c) are not yet exported by src/d2kern-113c/index.ts',
    )
  }
  const dataDir = getDrlgDataDir()
  const mpqs = [
    MpqArchive.openSync(syncFileSource(join(dataDir, 'Patch_D2.mpq'))),
    MpqArchive.openSync(syncFileSource(join(dataDir, 'd2exp.mpq'))),
    MpqArchive.openSync(syncFileSource(join(dataDir, 'd2data.mpq'))),
  ]

  function readMpqFileSync(name: string): Uint8Array | undefined {
    for (const ar of mpqs) {
      const f = ar.find(name)
      if (f !== undefined) {
        return ar.readSync(f)
      }
    }
    return undefined
  }

  const imgRaw = new Uint8Array(gunzipSync(readFileSync(DRLG_DATATBLS_IMG_PATH)))
  const { pages: basePages } = parseDrlgDataTablesImage(imgRaw)

  // Populate Fog.dll gdwBitMasks (IAT 0x6FDD90B0) & gdwInvBitMasks (IAT 0x6FDD9078) target pages
  const iatPage = basePages.get(0x6fdd9000 >>> 12)
  if (iatPage) {
    const iatDv = new DataView(iatPage.buffer, iatPage.byteOffset, iatPage.byteLength)
    const bitMasksVa = iatDv.getUint32(0x0b0, true) >>> 0
    const invBitMasksVa = iatDv.getUint32(0x078, true) >>> 0
    const writeBaseByte = (addr: number, val: number): void => {
      const a = addr >>> 0
      const pg = a >>> 12
      let page = basePages.get(pg)
      if (!page) {
        page = new Uint8Array(4096)
        basePages.set(pg, page)
      }
      page[a & 0xfff] = val & 0xff
    }
    const writeBaseU32 = (addr: number, val: number): void => {
      const v = val >>> 0
      writeBaseByte(addr, v & 0xff)
      writeBaseByte(addr + 1, (v >>> 8) & 0xff)
      writeBaseByte(addr + 2, (v >>> 16) & 0xff)
      writeBaseByte(addr + 3, (v >>> 24) & 0xff)
    }
    if (bitMasksVa !== 0) {
      for (let i = 0; i < 32; i++) {
        writeBaseU32((bitMasksVa + i * 4) >>> 0, (1 << i) >>> 0)
      }
    }
    if (invBitMasksVa !== 0) {
      for (let i = 0; i < 32; i++) {
        writeBaseU32((invBitMasksVa + i * 4) >>> 0, ~(1 << i) >>> 0)
      }
    }
  }

  const dt1Pages = new Map<number, Uint8Array>()
  let dt1AllocTop = 0x30000000
  const dt1HashCache = new Map<string, number>()
  const ds1BytesCache = new Map<string, Uint8Array>()

  function dt1WriteByte(addr: number, val: number): void {
    const a = addr >>> 0
    const pg = a >>> 12
    let buf = dt1Pages.get(pg)
    if (!buf) {
      buf = new Uint8Array(4096)
      dt1Pages.set(pg, buf)
    }
    buf[a & 0xfff] = val & 0xff
  }
  function dt1ReadByte(addr: number): number {
    const a = addr >>> 0
    const buf = dt1Pages.get(a >>> 12)
    return buf ? buf[a & 0xfff]! : 0
  }
  function dt1U32(addr: number): number {
    return (
      dt1ReadByte(addr) |
      (dt1ReadByte(addr + 1) << 8) |
      (dt1ReadByte(addr + 2) << 16) |
      ((dt1ReadByte(addr + 3) << 24) >>> 0)
    ) >>> 0
  }
  function dt1SetU32(addr: number, val: number): void {
    const v = val >>> 0
    dt1WriteByte(addr, v & 0xff)
    dt1WriteByte(addr + 1, (v >>> 8) & 0xff)
    dt1WriteByte(addr + 2, (v >>> 16) & 0xff)
    dt1WriteByte(addr + 3, (v >>> 24) & 0xff)
  }
  function dt1Alloc(size: number): number {
    const p = ((dt1AllocTop + 3) & ~3) >>> 0
    for (let i = 0; i < size; i++) dt1WriteByte(p + i, 0)
    dt1AllocTop = (p + size) >>> 0
    return p
  }

  function getOrBuildDt1Hash(path: string): { pHash: number; newPages: number[] } {
    if (!path || path === '0') {
      return { pHash: 0, newPages: [] }
    }
    const normPath = path.replace(/\//g, '\\')
    const key = normPath.toLowerCase()
    const cached = dt1HashCache.get(key)
    if (cached !== undefined) {
      return { pHash: cached, newPages: [] }
    }
    const bytes = readMpqFileSync(normPath)
    if (!bytes || bytes.length < 0x114) {
      dt1HashCache.set(key, 0)
      return { pHash: 0, newPages: [] }
    }
    const beforePages = new Set(dt1Pages.keys())
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const nTiles = dv.getInt32(0x10c, true)
    const hdrOff = dv.getUint32(0x110, true)
    if (nTiles < 0 || hdrOff < 0x114 || hdrOff > bytes.length) {
      dt1HashCache.set(key, 0)
      return { pHash: 0, newPages: [] }
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
      if (!beforePages.has(pg)) touchedPages.push(pg)
    }
    if (beforePages.size > 0) {
      for (const pg of beforePages) touchedPages.push(pg)
    }
    return { pHash, newPages: touchedPages }
  }

  let currentMemInstance: { syncDt1Pages?: (pages: number[]) => void } | null = null

  ;(
    globalThis as unknown as {
      __d2LoadMpqDs1: (m: Memory113c, relPath: string) => Uint8Array | null
      __d2LoadMpqDt1Hash: (m: Memory113c, path: string) => number
    }
  ).__d2LoadMpqDs1 = (_m: Memory113c, relPath: string) => {
    const norm = relPath.replace(/\//g, '\\').replace(/^\\+/, '')
    const fullPath = /^data\\global\\tiles\\/i.test(norm)
      ? norm
      : `DATA\\GLOBAL\\TILES\\${norm}`
    const key = fullPath.toLowerCase()
    let bytes = ds1BytesCache.get(key)
    if (!bytes) {
      bytes = readMpqFileSync(fullPath)
      if (!bytes) {
        throw new Error(`Failed to find DS1 in MPQ: ${fullPath}`)
      }
      ds1BytesCache.set(key, bytes)
    }
    return bytes
  }

  ;(
    globalThis as unknown as {
      __d2LoadMpqDt1Hash: (m: Memory113c, path: string) => number
    }
  ).__d2LoadMpqDt1Hash = (_m: Memory113c, path: string) => {
    const { pHash, newPages } = getOrBuildDt1Hash(path)
    if (newPages.length > 0 && currentMemInstance?.syncDt1Pages) {
      currentMemInstance.syncDt1Pages(newPages)
    }
    return pHash
  }

  const fullKnownPage = new Uint8Array(4096).fill(1)

  function createMemory(): SparseMemory113c & { syncDt1Pages: (pages: number[]) => void } {
    const m = new d2kern.SparseMemory113c() as SparseMemory113c & {
      syncDt1Pages: (pages: number[]) => void
    }
    const mPriv = m as unknown as {
      pages: Map<number, Uint8Array>
      known: Map<number, Uint8Array>
    }
    for (const [pg, data] of basePages) {
      const copy = new Uint8Array(4096)
      copy.set(data)
      mPriv.pages.set(pg, copy)
      mPriv.known.set(pg, fullKnownPage)
    }
    for (const [pg, data] of dt1Pages) {
      mPriv.pages.set(pg, data)
      mPriv.known.set(pg, fullKnownPage)
    }
    m.syncDt1Pages = (pages: number[]) => {
      for (const pg of pages) {
        const data = dt1Pages.get(pg)
        if (data) {
          mPriv.pages.set(pg, data)
          mPriv.known.set(pg, fullKnownPage)
        }
      }
    }
    return m
  }

  cachedEnv = {
    entrypoints,
    basePages,
    dt1Pages,
    createMemory,
    setCurrentMemory: (m) => {
      currentMemInstance = m
    },
  }
  return cachedEnv
}

const kActLo = [1, 40, 75, 103, 109] as const
const kActHi = [39, 74, 102, 108, 136] as const
const townSet = new Set<number>(DRLG_TOWN_LEVEL_IDS)

export interface LiveDrlgComboResult {
  digests: DrlgDigestRecord[]
  roomGroups: DrlgLevelRoomsGroup[]
  townColls: DrlgCollRecord[]
}

export function runLiveDrlgCombo(
  seed: number,
  diff: number,
  opts?: { captureRooms?: boolean; captureTownColl?: boolean },
): LiveDrlgComboResult {
  const env = getOrInitRunnerEnv()
  const { allocAct, allocLevel, initLevelRooms, activateRoomEx } = env.entrypoints
  const m = env.createMemory()
  env.setCurrentMemory(m)

  const captureRooms = opts?.captureRooms ?? false
  const captureTownColl = opts?.captureTownColl ?? false
  const digests: DrlgDigestRecord[] = new Array<DrlgDigestRecord>(136)
  const roomGroups: DrlgLevelRoomsGroup[] = []
  const townColls: DrlgCollRecord[] = []

  for (let act = 0; act < 5; act++) {
    const actLo = kActLo[act]!
    const actHi = kActHi[act]!
    const pAct = allocAct(m, act, seed >>> 0, 0, 0x7f000000, diff & 0xff, 0, actLo, 0, 0)
    const pDrlg = m.u32((pAct + 0x48) >>> 0)
    const levels = new Uint32Array(137)

    for (let L = actLo; L <= actHi; L++) {
      let pLevel = m.u32((pDrlg + 0x47c) >>> 0)
      while (pLevel !== 0 && (m.u32((pLevel + 0x1d0) >>> 0) | 0) !== L) {
        pLevel = m.u32((pLevel + 0x1ac) >>> 0)
      }
      const preAlloc = pLevel !== 0 ? 1 : 0
      if (pLevel === 0) {
        pLevel = allocLevel(m, pDrlg, L)
      }
      const wasInit = m.u32((pLevel + 0x10) >>> 0) !== 0 ? 1 : 0
      if (!wasInit) {
        initLevelRooms(m, pLevel)
      }
      const flags = preAlloc | (wasInit << 1)
      levels[L] = pLevel

      const lvlHdr: DrlgLevelHeaderRecord = {
        marker: DRLG_LEVEL_HEADER_MARKER,
        levelId: L,
        act,
        diff,
        flags,
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

      const rooms: DrlgRoomRecord[] = []
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
        rooms.push({
          levelId: L,
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

      if (captureRooms) {
        roomGroups.push({ header: lvlHdr, rooms })
      }

      const layoutHash = computeDrlgLevelLayoutHash(lvlHdr, rooms)
      digests[L - 1] = {
        seed: seed >>> 0,
        diff: diff & 0xff,
        act,
        levelId: L,
        drlgType: lvlHdr.drlgType & 0xff,
        flags,
        preAllocated: (flags & 1) !== 0,
        wasInit: (flags & 2) !== 0,
        nRoomList: roomIdx,
        posX: lvlHdr.posX,
        posY: lvlHdr.posY,
        sizeX: lvlHdr.sizeX,
        sizeY: lvlHdr.sizeY,
        nRoomsField: lvlHdr.nRooms,
        layoutHash,
        collHash: 0n,
        nCollRooms: 0,
        totalSubtiles: 0,
      }
    }

    for (let L = actLo; L <= actHi; L++) {
      const pLevel = levels[L]!
      const roomPtrs: number[] = []
      for (
        let r = m.u32((pLevel + 0x10) >>> 0);
        r !== 0 && roomPtrs.length < 4096;
        r = m.u32((r + 0x24) >>> 0)
      ) {
        roomPtrs.push(r)
      }
      const chunks: Uint8Array[] = []
      let nCollRooms = 0
      let totalSubtiles = 0
      const recordTown = captureTownColl && townSet.has(L)

      for (const r of roomPtrs) {
        const activeRoom = activateRoomEx(m, r)
        if (activeRoom === 0) continue
        const cg = m.u32((activeRoom + 0x20) >>> 0)
        if (cg === 0) continue
        const w = m.u32((cg + 0x08) >>> 0)
        const h = m.u32((cg + 0x0c) >>> 0)
        const cells = (w * h) >>> 0
        const mapPtr = m.u32((cg + 0x20) >>> 0)
        const hdrBytes = m.readBytes(cg, 32)
        chunks.push(hdrBytes)
        let mapBytes: Uint8Array = new Uint8Array(0)
        if (mapPtr !== 0 && cells > 0) {
          mapBytes = m.readBytes(mapPtr, cells * 2)
          chunks.push(mapBytes)
        }
        nCollRooms++
        totalSubtiles += cells

        if (recordTown) {
          const mapWords = new Uint16Array(cells)
          if (mapBytes.byteLength > 0) {
            const dv = new DataView(mapBytes.buffer, mapBytes.byteOffset, mapBytes.byteLength)
            for (let ci = 0; ci < cells; ci++) {
              mapWords[ci] = dv.getUint16(ci * 2, true)
            }
          }
          const hDv = new DataView(hdrBytes.buffer, hdrBytes.byteOffset, hdrBytes.byteLength)
          townColls.push({
            nSubtileX: hDv.getInt32(0x00, true),
            nSubtileY: hDv.getInt32(0x04, true),
            nSubtileWidth: hDv.getInt32(0x08, true),
            nSubtileHeight: hDv.getInt32(0x0c, true),
            nTileX: hDv.getInt32(0x10, true),
            nTileY: hDv.getInt32(0x14, true),
            nTileWidth: hDv.getInt32(0x18, true),
            nTileHeight: hDv.getInt32(0x1c, true),
            headerBytes: hdrBytes,
            mapWords,
            activeMapBytes: mapBytes,
          })
        }
      }

      const dig = digests[L - 1]!
      dig.collHash = sha256Low64LE(chunks)
      dig.nCollRooms = nCollRooms
      dig.totalSubtiles = totalSubtiles
    }
  }

  env.setCurrentMemory(null)
  return { digests, roomGroups, townColls }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const digGzPath = resolve(FIXTURES_DIR, 'drlg-digest-113c.d2tv.gz')
  const roomsGzPath = resolve(FIXTURES_DIR, 'drlg-rooms-s12345.d2tv.gz')
  const collGzPath = resolve(FIXTURES_DIR, 'drlg-coll-towns-s12345-d0.d2tv.gz')

  const parsedDig = parseDrlgDigestFile(new Uint8Array(gunzipSync(readFileSync(digGzPath))))
  const parsedRooms = parseDrlgRoomsFile(new Uint8Array(gunzipSync(readFileSync(roomsGzPath))))
  const parsedColl = parseDrlgCollFile(new Uint8Array(gunzipSync(readFileSync(collGzPath))))

  if (resolveKernelEntrypoints() === null) {
    const hasImg = existsSync(DRLG_DATATBLS_IMG_PATH)
    const hasMpqs = hasDrlgMpqFiles()
    console.log(
      `[drlg-ts-runner] Blocked pending DRLG root entrypoint export in src/d2kern-113c/index.ts ` +
        `(datatblsImg=${hasImg}, mpqs=${hasMpqs}): 0/${parsedDig.records.length} matched, ` +
        `${parsedDig.records.length}/${parsedDig.records.length} blocked.`,
    )
    process.exit(0)
  }

  const expectedByKey = new Map<string, DrlgDigestRecord>()
  const combos: { seed: number; diff: number }[] = []
  const seenCombo = new Set<string>()
  for (const rec of parsedDig.records) {
    expectedByKey.set(`${rec.seed}:${rec.diff}:${rec.levelId}`, rec)
    const ck = `${rec.seed}:${rec.diff}`
    if (!seenCombo.has(ck)) {
      seenCombo.add(ck)
      combos.push({ seed: rec.seed, diff: rec.diff })
    }
  }

  const expectedRoomsByKey = new Map<string, DrlgLevelRoomsGroup>()
  for (const grp of parsedRooms.levels) {
    expectedRoomsByKey.set(`${grp.header.diff}:${grp.header.levelId}`, grp)
  }

  function verifySingleCombo(seed: number, diff: number, quiet = false): {
    layoutMatches: number
    layoutMismatches: number
    collMatches: number
    collMismatches: number
    roomRecMatches: number
    townCollMatches: number
  } {
    const capRooms = seed === 12345
    const capColl = seed === 12345 && diff === 0
    const res = runLiveDrlgCombo(seed, diff, {
      captureRooms: capRooms,
      captureTownColl: capColl,
    })

    let layoutMatches = 0
    let layoutMismatches = 0
    let collMatches = 0
    let collMismatches = 0
    let roomRecMatches = 0
    let townCollMatches = 0

    for (const d of res.digests) {
      const exp = expectedByKey.get(`${seed}:${diff}:${d.levelId}`)!
      if (
        d.layoutHash === exp.layoutHash &&
        d.drlgType === exp.drlgType &&
        d.flags === exp.flags &&
        d.nRoomList === exp.nRoomList &&
        d.posX === exp.posX &&
        d.posY === exp.posY &&
        d.sizeX === exp.sizeX &&
        d.sizeY === exp.sizeY &&
        d.nRoomsField === exp.nRoomsField
      ) {
        layoutMatches++
      } else {
        layoutMismatches++
        console.log(
          `  [LAYOUT MISMATCH] seed=${seed} diff=${diff} L=${d.levelId}: got=${d.layoutHash.toString(16)} exp=${exp.layoutHash.toString(16)}`,
        )
      }

      if (
        d.collHash === exp.collHash &&
        d.nCollRooms === exp.nCollRooms &&
        d.totalSubtiles === exp.totalSubtiles
      ) {
        collMatches++
      } else {
        collMismatches++
        console.log(
          `  [COLL MISMATCH] seed=${seed} diff=${diff} L=${d.levelId}: got=${d.collHash.toString(16)} exp=${exp.collHash.toString(16)}`,
        )
      }
    }

    if (capRooms) {
      for (const grp of res.roomGroups) {
        const expGrp = expectedRoomsByKey.get(`${diff}:${grp.header.levelId}`)!
        if (
          JSON.stringify(grp.header) === JSON.stringify(expGrp.header) &&
          JSON.stringify(grp.rooms) === JSON.stringify(expGrp.rooms)
        ) {
          roomRecMatches += 1 + grp.rooms.length
        } else {
          console.log(`  [DRLGROOM MISMATCH] seed=${seed} diff=${diff} L=${grp.header.levelId}`)
        }
      }
    }

    if (capColl) {
      for (let i = 0; i < res.townColls.length; i++) {
        const gotC = res.townColls[i]!
        const expC = parsedColl.records[i]!
        let mapOk = gotC.mapWords.length === expC.mapWords.length
        if (mapOk) {
          for (let k = 0; k < expC.mapWords.length; k++) {
            if (gotC.mapWords[k] !== expC.mapWords[k]) {
              mapOk = false
              break
            }
          }
        }
        if (
          mapOk &&
          gotC.nSubtileX === expC.nSubtileX &&
          gotC.nSubtileY === expC.nSubtileY &&
          gotC.nSubtileWidth === expC.nSubtileWidth &&
          gotC.nSubtileHeight === expC.nSubtileHeight &&
          gotC.nTileX === expC.nTileX &&
          gotC.nTileY === expC.nTileY &&
          gotC.nTileWidth === expC.nTileWidth &&
          gotC.nTileHeight === expC.nTileHeight
        ) {
          townCollMatches++
        } else {
          console.log(`  [DRLGCOLL MISMATCH] town room idx=${i}`)
        }
      }
    }

    if (!quiet) {
      console.log(
        `Summary (seed=${seed}, diff=${diff}): layout=${layoutMatches}/136 (mismatches=${layoutMismatches}), coll=${collMatches}/136 (mismatches=${collMismatches})` +
          (capRooms ? `, roomRecs=${roomRecMatches}` : '') +
          (capColl ? `, townColl=${townCollMatches}/169` : ''),
      )
    }

    return {
      layoutMatches,
      layoutMismatches,
      collMatches,
      collMismatches,
      roomRecMatches,
      townCollMatches,
    }
  }

  if (process.argv[2] === '--worker') {
    const workerId = Number(process.argv[3])
    const numWorkers = Number(process.argv[4])
    let lMatch = 0
    let lMis = 0
    let cMatch = 0
    let cMis = 0
    let rMatch = 0
    let tcMatch = 0
    for (let idx = workerId; idx < combos.length; idx += numWorkers) {
      const { seed, diff } = combos[idx]!
      const res = verifySingleCombo(seed, diff, true)
      lMatch += res.layoutMatches
      lMis += res.layoutMismatches
      cMatch += res.collMatches
      cMis += res.collMismatches
      rMatch += res.roomRecMatches
      tcMatch += res.townCollMatches
    }
    console.log(`WORKER_RESULT:${workerId}:${lMatch}:${lMis}:${cMatch}:${cMis}:${rMatch}:${tcMatch}`)
  } else if (process.argv[2] === '--all') {
    void (async () => {
      const numWorkers =
        process.argv[3] !== undefined ? Number(process.argv[3]) : Math.min(cpus().length, 16)
      const scriptPath = fileURLToPath(import.meta.url)
      console.log(
        `Launching ${numWorkers} parallel workers across ${combos.length} (seed, diff) combos (${parsedDig.records.length} vectors)...`,
      )
      const t0 = Date.now()
      const layoutMismatchKeys: string[] = []
      const collMismatchKeys: string[] = []
      const roomMismatchKeys: string[] = []
      const townCollMismatchIdx: number[] = []
      const promises = Array.from({ length: numWorkers }, (_, w) =>
        new Promise<{
          lMatch: number
          lMis: number
          cMatch: number
          cMis: number
          rMatch: number
          tcMatch: number
        }>((resolveP, rejectP) => {
          const child = spawn(
            process.execPath,
            [...process.execArgv, scriptPath, '--worker', String(w), String(numWorkers)],
            { stdio: ['ignore', 'pipe', 'pipe'] },
          )
          let out = ''
          let pending = ''
          child.stdout.on('data', (chunk: Buffer) => {
            const s = chunk.toString()
            out += s
            pending += s
            const lines = pending.split('\n')
            pending = lines.pop() as string
            for (const line of lines) {
              const mm = line.match(
                /\[(LAYOUT|COLL|DRLGROOM|DRLGCOLL) MISMATCH\] (?:seed=(\d+) diff=(\d+) L=(\d+)|town room idx=(\d+))/,
              )
              if (mm) {
                if (mm[1] === 'LAYOUT') layoutMismatchKeys.push(`${mm[2]}:${mm[3]}:${mm[4]}`)
                else if (mm[1] === 'COLL') collMismatchKeys.push(`${mm[2]}:${mm[3]}:${mm[4]}`)
                else if (mm[1] === 'DRLGROOM') roomMismatchKeys.push(`${mm[2]}:${mm[3]}:${mm[4]}`)
                else townCollMismatchIdx.push(Number(mm[5]))
              }
              if (line.includes('MISMATCH') || line.includes('ERROR')) {
                console.log(`[W${w}] ${line}`)
              }
            }
          })
          child.stderr.on('data', (chunk: Buffer) => {
            process.stderr.write(`[W${w}] ${chunk.toString()}`)
          })
          child.on('exit', (code) => {
            if (code !== 0) {
              rejectP(new Error(`Worker ${w} exited with code ${code}`))
              return
            }
            const m = out.match(/WORKER_RESULT:\d+:(\d+):(\d+):(\d+):(\d+):(\d+):(\d+)/)
            if (!m) {
              rejectP(new Error(`Worker ${w} missing WORKER_RESULT`))
              return
            }
            resolveP({
              lMatch: Number(m[1]),
              lMis: Number(m[2]),
              cMatch: Number(m[3]),
              cMis: Number(m[4]),
              rMatch: Number(m[5]),
              tcMatch: Number(m[6]),
            })
          })
        }),
      )
      const results = await Promise.all(promises)
      let totalLMatch = 0
      let totalLMis = 0
      let totalCMatch = 0
      let totalCMis = 0
      let totalRMatch = 0
      let totalTCMatch = 0
      for (const r of results) {
        totalLMatch += r.lMatch
        totalLMis += r.lMis
        totalCMatch += r.cMatch
        totalCMis += r.cMis
        totalRMatch += r.rMatch
        totalTCMatch += r.tcMatch
      }
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2)
      console.log(
        `\n=== FULL 20,400-VECTOR SWEEP (${elapsed}s, ${numWorkers} workers) ===\n` +
          `DRLGDIG Layout:    ${totalLMatch}/${parsedDig.records.length} (mismatches=${totalLMis})\n` +
          `DRLGDIG Collision: ${totalCMatch}/${parsedDig.records.length} (mismatches=${totalCMis})\n` +
          `DRLGROOM (s12345): ${totalRMatch}/${parsedRooms.header.recordCount}\n` +
          `DRLGCOLL (towns):  ${totalTCMatch}/${parsedColl.header.recordCount}`,
      )
      if (process.argv.includes('--json')) {
        console.log(
          `DRLG_STATUS_JSON:${JSON.stringify({
            records: parsedDig.records.length,
            layoutMatches: totalLMatch,
            collMatches: totalCMatch,
            roomRecMatches: totalRMatch,
            roomRecTotal: parsedRooms.header.recordCount,
            townCollMatches: totalTCMatch,
            townCollTotal: parsedColl.header.recordCount,
            layoutMismatchKeys,
            collMismatchKeys,
            roomMismatchKeys,
            townCollMismatchIdx,
          })}`,
        )
      }
      if (
        totalLMis > 0 ||
        totalCMis > 0 ||
        totalRMatch !== parsedRooms.header.recordCount ||
        totalTCMatch !== parsedColl.header.recordCount
      ) {
        process.exit(1)
      }
    })().catch((err: unknown) => {
      console.error(err)
      process.exit(1)
    })
  } else {
    const seed = process.argv[2] !== undefined ? Number(process.argv[2]) >>> 0 : 12345
    const diff = process.argv[3] !== undefined ? Number(process.argv[3]) & 0xff : 0
    const res = verifySingleCombo(seed, diff, false)
    if (res.layoutMismatches > 0 || res.collMismatches > 0) {
      process.exit(1)
    }
  }
}
