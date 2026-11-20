/**
 * TypeScript binary parsers and SparseMemory113c world-image loader for the
 * [K1-6] PATH D2TV vector fixtures:
 *   - `PATHVEC` (460 B per record) — `tests/fixtures/oracle/vectors/path-vectors-113c.d2tv.gz`
 *   - `PAGEIMG` (4,100 B per record) — `tests/fixtures/oracle/vectors/path-world-town-s12345.img.gz`
 */

import { parseVectorHeader, type VectorHeader } from './vector-format.ts'

export const PATHVEC_RECORD_SIZE = 460
export const PAGEIMG_RECORD_SIZE = 4100
export const PATH_META_PAGE_VA = 0x1ffff000
export const PATH_META_MAGIC = 0x57485450 // 'PTHW'

export const PATH_PREFLAG_SET_PREV_TYPE = 1 << 0
export const PATH_PREFLAG_SET_TARGET_UNIT = 1 << 1
export const PATH_PREFLAG_SET_VELOCITY = 1 << 2
export const PATH_PREFLAG_SKIP_SET_TYPE = 1 << 3

export interface PathPoint {
  x: number
  y: number
}

export interface PathVectorRecord {
  /* Input specification (32 bytes) */
  pathType: number
  unitType: number
  classId: number
  a2: number
  bAllocFlag: number
  nDistMax: number
  nStepNum: number
  preFlags: number
  startX: number
  startY: number
  targetX: number
  targetY: number
  velOverride: number
  prevPathType: number
  targetDx: number
  targetDy: number
  reservedIn: number
  unitSeedLo: number

  /* Output observation (428 bytes) */
  ret: number
  faultKind: number // 0=none, 1=exception, 2=fogAssert
  faultStage: number // 0=none, 1=alloc, 2=setType, 3=setTarget, 4=recalc
  wCollidedWithMask: number
  faultCode: number
  faultEipVa: number
  faultLine: number
  dwPathType: number
  dwPrevPathType: number
  dwFlags: number
  nDirection: number
  nNewDirection: number
  outDistMax: number
  outInitFScore: number
  curRoomIdx: number
  outTargetX: number
  outTargetY: number
  dwCurrentPointIdx: number
  dwPathPoints: number
  dwUnitSize: number
  dwCollisionPattern: number
  nFootprintCollisionMask: number
  nMoveTestCollisionMask: number
  pathPoints: PathPoint[] // 78 (x,y) pairs from wPathPoints[156]
  nSavedStepsCount: number
  savedSteps: PathPoint[] // 10 (x,y) pairs from wSavedSteps[20]
}

export interface PageImageRecord {
  va: number
  data: Uint8Array // 4096 bytes
}

export interface PathWorldMetaHeader {
  magic: number
  version: number
  seed: number
  diff: number
  pActVa: number
  pDrlgVa: number
  pLevelVa: number
  pUnitVa: number
  pTargetUnitVa: number
  pPathVa: number
  nActiveRooms: number
  activeRoomVas: number[]
}

export function parsePathVectors(buf: Uint8Array): {
  header: VectorHeader
  records: PathVectorRecord[]
} {
  const header = parseVectorHeader(buf)
  if (header.kind !== 'PATHVEC') {
    throw new Error(`Expected kind 'PATHVEC', got '${header.kind}'`)
  }
  if (header.recordSize !== PATHVEC_RECORD_SIZE) {
    throw new Error(`Expected recordSize ${PATHVEC_RECORD_SIZE}, got ${header.recordSize}`)
  }
  const view = new DataView(buf.buffer, buf.byteOffset + 32, header.recordCount * PATHVEC_RECORD_SIZE)
  const records: PathVectorRecord[] = new Array(header.recordCount)

  for (let r = 0; r < header.recordCount; r++) {
    const byteOffset = r * PATHVEC_RECORD_SIZE
    const pathPoints: PathPoint[] = new Array(78)
    for (let i = 0; i < 78; i++) {
      const off = byteOffset + 0x68 + i * 4
      pathPoints[i] = {
        x: view.getUint16(off, true),
        y: view.getUint16(off + 2, true),
      }
    }
    const savedSteps: PathPoint[] = new Array(10)
    for (let i = 0; i < 10; i++) {
      const off = byteOffset + 0x1a4 + i * 4
      savedSteps[i] = {
        x: view.getUint16(off, true),
        y: view.getUint16(off + 2, true),
      }
    }

    records[r] = {
      pathType: view.getUint8(byteOffset + 0x00),
      unitType: view.getUint8(byteOffset + 0x01),
      classId: view.getUint16(byteOffset + 0x02, true),
      a2: view.getUint8(byteOffset + 0x04),
      bAllocFlag: view.getUint8(byteOffset + 0x05),
      nDistMax: view.getUint8(byteOffset + 0x06),
      nStepNum: view.getUint8(byteOffset + 0x07),
      preFlags: view.getUint32(byteOffset + 0x08, true),
      startX: view.getUint16(byteOffset + 0x0c, true),
      startY: view.getUint16(byteOffset + 0x0e, true),
      targetX: view.getUint16(byteOffset + 0x10, true),
      targetY: view.getUint16(byteOffset + 0x12, true),
      velOverride: view.getInt32(byteOffset + 0x14, true),
      prevPathType: view.getUint8(byteOffset + 0x18),
      targetDx: view.getInt8(byteOffset + 0x19),
      targetDy: view.getInt8(byteOffset + 0x1a),
      reservedIn: view.getUint8(byteOffset + 0x1b),
      unitSeedLo: view.getUint32(byteOffset + 0x1c, true),

      ret: view.getInt32(byteOffset + 0x20, true),
      faultKind: view.getUint8(byteOffset + 0x24),
      faultStage: view.getUint8(byteOffset + 0x25),
      wCollidedWithMask: view.getUint16(byteOffset + 0x26, true),
      faultCode: view.getUint32(byteOffset + 0x28, true),
      faultEipVa: view.getUint32(byteOffset + 0x2c, true),
      faultLine: view.getUint32(byteOffset + 0x30, true),
      dwPathType: view.getUint32(byteOffset + 0x34, true),
      dwPrevPathType: view.getUint32(byteOffset + 0x38, true),
      dwFlags: view.getUint32(byteOffset + 0x3c, true),
      nDirection: view.getUint8(byteOffset + 0x40),
      nNewDirection: view.getUint8(byteOffset + 0x41),
      outDistMax: view.getUint8(byteOffset + 0x42),
      outInitFScore: view.getUint8(byteOffset + 0x43),
      curRoomIdx: view.getInt32(byteOffset + 0x44, true),
      outTargetX: view.getInt32(byteOffset + 0x48, true),
      outTargetY: view.getInt32(byteOffset + 0x4c, true),
      dwCurrentPointIdx: view.getUint32(byteOffset + 0x50, true),
      dwPathPoints: view.getUint32(byteOffset + 0x54, true),
      dwUnitSize: view.getUint32(byteOffset + 0x58, true),
      dwCollisionPattern: view.getUint32(byteOffset + 0x5c, true),
      nFootprintCollisionMask: view.getUint32(byteOffset + 0x60, true),
      nMoveTestCollisionMask: view.getUint32(byteOffset + 0x64, true),
      pathPoints,
      nSavedStepsCount: view.getUint32(byteOffset + 0x1a0, true),
      savedSteps,
    }
  }

  return { header, records }
}

export function parsePathWorldMetaHeader(data: Uint8Array): PathWorldMetaHeader {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const magic = view.getUint32(0x00, true)
  if (magic !== PATH_META_MAGIC) {
    throw new Error(
      `Invalid PathWorldMetaHeader magic: 0x${magic.toString(16)} (expected 0x${PATH_META_MAGIC.toString(16)})`,
    )
  }
  const nActiveRooms = view.getUint32(0x28, true)
  const activeRoomVas: number[] = []
  for (let i = 0; i < nActiveRooms && i < 64; i++) {
    activeRoomVas.push(view.getUint32(0x2c + i * 4, true))
  }
  return {
    magic,
    version: view.getUint32(0x04, true),
    seed: view.getUint32(0x08, true),
    diff: view.getUint32(0x0c, true),
    pActVa: view.getUint32(0x10, true),
    pDrlgVa: view.getUint32(0x14, true),
    pLevelVa: view.getUint32(0x18, true),
    pUnitVa: view.getUint32(0x1c, true),
    pTargetUnitVa: view.getUint32(0x20, true),
    pPathVa: view.getUint32(0x24, true),
    nActiveRooms,
    activeRoomVas,
  }
}

export function parsePathWorldImage(buf: Uint8Array): {
  header: VectorHeader
  meta: PathWorldMetaHeader
  pages: PageImageRecord[]
} {
  const header = parseVectorHeader(buf)
  if (header.kind !== 'PAGEIMG') {
    throw new Error(`Expected kind 'PAGEIMG', got '${header.kind}'`)
  }
  if (header.recordSize !== PAGEIMG_RECORD_SIZE) {
    throw new Error(`Expected recordSize ${PAGEIMG_RECORD_SIZE}, got ${header.recordSize}`)
  }
  const view = new DataView(buf.buffer, buf.byteOffset + 32, header.recordCount * PAGEIMG_RECORD_SIZE)
  const records: PageImageRecord[] = new Array(header.recordCount)
  for (let i = 0; i < header.recordCount; i++) {
    const off = i * PAGEIMG_RECORD_SIZE
    const va = view.getUint32(off, true)
    const data = buf.subarray(32 + off + 4, 32 + off + 4 + 4096).slice()
    records[i] = { va, data }
  }

  const metaPage = records.find((p) => p.va === PATH_META_PAGE_VA)
  if (!metaPage) {
    throw new Error(`PAGEIMG missing metadata page at VA 0x${PATH_META_PAGE_VA.toString(16)}`)
  }
  const meta = parsePathWorldMetaHeader(metaPage.data)
  const pages = records.filter((p) => p.va !== PATH_META_PAGE_VA)
  return {
    header,
    meta,
    pages,
  }
}

export function loadPathWorldIntoMemory(
  mem: { loadBlock(addr: number, data: Uint8Array): void },
  pages: readonly PageImageRecord[],
): void {
  for (const page of pages) {
    mem.loadBlock(page.va, page.data)
  }
}
