/**
 * Milestone 36 [K5] Unified `D2TV` Binary Vector Exit-Gate Regression Suite.
 *
 * Validates all 9 merged `D2TV` 1.13c DLL vector suites in a single fast CI gate:
 *   1. `PRNG`       (`prng-10k.d2tv` — 10,000 LCG / `SEED_Roll` records)
 *   2. `EVENTWHEEL` (`eventwheel-113c.d2tv` — 256 multi-frame timer scenarios, 45,101 fired events)
 *   3. `DRLG`       (`drlg-digest-113c.d2tv.gz` 20,400 + `drlg-rooms-s12345.d2tv.gz` 20,807 + `drlg-coll-towns-s12345-d0.d2tv.gz` 169 + live s12345 d0 136-level sweep)
 *   4. `PATH`       (`path-vectors-113c.d2tv.gz` 6,924 Stage 1..4 `PATHTYPE 0..17` records + 65-page `PAGEIMG`)
 *   5. `MONSPAWN`   (`monspawn-113c.d2tv.gz` — 2,448 all-136-level / Act 1..5 / Diff 0..2 pack & boss spawn records)
 *   6. `TCDROP`     (`tcdrop-113c.d2tv.gz` — 1,200 TreasureClassEx tree evaluation records)
 *   7. `ITEMGEN`    (`itemgen-113c.d2tv.gz` — 2,400 all-8-quality item generation + #10987 bitstream records)
 *   8. `SKILLCALC`  (`skillcalc-113c.d2tv.gz` — 12,600 7-class / 210-skill × slvl 1..60 / 73-field-code records)
 *   9. `S2C`        (`s2c-113c.d2tv.gz` — 1,440 S2C payload, Fog Huffman & D2Net framing records)
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { FOG_SIN_TABLE } from '../../../src/client/weather/fog-sin-table.ts'
import {
  D2CommonAssertError,
  PATH_AllocDynamicPath113c,
  PATH_Compute113c,
  PATH_SetTargetPos113c,
  PATH_SetType113c,
  type FieldLayout113c,
  type Memory113c,
} from '../../../src/d2kern-113c/index.ts'
import {
  DRLG_DATATBLS_IMG_PATH,
  DRLG_DATATBLS_RAW_SHA256,
  isDrlgLiveRunnerReady,
  runLiveDrlgCombo,
} from '../../../tools/oracle/vectors/drlg-ts-runner.ts'
import {
  computeDrlgLevelCollHash,
  computeDrlgLevelLayoutHash,
  parseDrlgCollFile,
  parseDrlgDigestFile,
  parseDrlgRoomsFile,
} from '../../../tools/oracle/vectors/drlg-vector.ts'
import {
  EVTWHEEL_RECORD_SIZE,
  verifyEventWheelVectors,
} from '../../../tools/oracle/vectors/eventwheel-vector.ts'
import {
  ITEMGEN_RECORD_SIZE,
  parseItemGenVectors,
  verifyItemGenVectors,
} from '../../../tools/oracle/vectors/itemgen-vector.ts'
import {
  MONSPAWN_RECORD_SIZE,
  parseMonSpawnVectors,
  verifyMonSpawnVectors,
} from '../../../tools/oracle/vectors/monspawn-vector.ts'
import {
  PATH_PREFLAG_SET_PREV_TYPE,
  PATH_PREFLAG_SET_TARGET_UNIT,
  PATH_PREFLAG_SET_VELOCITY,
  PATH_PREFLAG_SKIP_SET_TYPE,
  PATHVEC_RECORD_SIZE,
  type PageImageRecord,
  type PathVectorRecord,
  type PathWorldMetaHeader,
  parsePathVectors,
  parsePathWorldImage,
} from '../../../tools/oracle/vectors/path-vector.ts'
import {
  PRNG_RECORD_SIZE,
  verifyPrngVectors,
} from '../../../tools/oracle/vectors/prng-vector.ts'
import {
  parseS2CVectors,
  S2C_RECORD_SIZE,
  verifyS2CVectors,
} from '../../../tools/oracle/vectors/s2c-vector.ts'
import {
  parseSkillCalcVectors,
  SKILLCALC_RECORD_SIZE,
  verifySkillCalcVectors,
} from '../../../tools/oracle/vectors/skillcalc-vector.ts'
import {
  parseTcDropVectors,
  TCDROP_RECORD_SIZE,
  verifyTcDropVectors,
} from '../../../tools/oracle/vectors/tcdrop-vector.ts'
import {
  D2TV_KIND_SKILLCALC,
  D2TV_MAGIC,
} from '../../../tools/oracle/vectors/vector-format.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const VEC_DIR = resolve(REPO_ROOT, 'tests/fixtures/oracle/vectors')
const K2_DIR = resolve(REPO_ROOT, 'tests/fixtures/oracle/k2')
const K3_DIR = resolve(REPO_ROOT, 'tests/fixtures/oracle/k3')
const K4_DIR = resolve(REPO_ROOT, 'tests/fixtures/oracle/k4')

const PINNED_DIGESTS = {
  prng: '257e65050dd758de0cdd1f808c456910b29a933f7da3f1d1d6b25650d4df599e',
  eventwheel: '716404b144a4fbd0d5b7c3cd13622a9ce7b759e303650b7895eddc8c90ea7993',
  drlgDigest: '2bdf75938c7e55904b354f7463c0f35334d3f130ef580681bf5d58399eeced28',
  drlgRooms: 'dc625a2bf9a4ee24c117a11fde8891d97d926c6edbae56d282edfa0690f49ee9',
  drlgColl: 'a7fc68ead57379c285df1e45c92a833d9a1213dc7357099a96f298939dfee120',
  drlgDataTbls: DRLG_DATATBLS_RAW_SHA256,
  pathVectors: 'eb59554dc7b5d0bb4e79211c8042fa24ca1a5a6e61e56fd3a919c9ec7d9068dc',
  pathWorldImg: '7938797317be1ce51e911a6788ceb886fa8437d5c59bb0230a2b18520546123b',
  monspawn: '7d35dcb158a1748828a953ad5eb19972e881eca4503793761a775ec5c93a653f',
  tcdrop: 'bf091c145fad1d71dba1aa2d8794a09d3ba1746477f5ed7d4f257f3c9368c0e5',
  itemgen: '10c61d8fc4b1b4f97fcfc98a380df690d84caa31c21102dd636018afd3812ce9',
  skillcalc: '336145e033b11206340f76113f34794e7631c6dc93c9e237f1bdec57d801d6c1',
  s2c: '330ed2d430ae232a3b204c17dd83e0890abfafcf8d03d69cbc76104c8a31ebb2',
} as const

function sha256Hex(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex')
}

class FastDirtyResetMemory113c implements Memory113c {
  private static readonly PAGE_BITS = 12
  private static readonly PAGE_SIZE = 1 << 12
  private readonly basePages = new Map<number, Uint8Array>()
  private readonly baseKnown = new Map<number, Uint8Array>()
  private readonly pages = new Map<number, Uint8Array>()
  private readonly known = new Map<number, Uint8Array>()
  private readonly dirty = new Set<number>()
  private allocTop = 0x40000000

  loadBasePage(va: number, data: Uint8Array): void {
    const page = (va >>> 0) >>> FastDirtyResetMemory113c.PAGE_BITS
    const pCopy = data.slice()
    const kCopy = new Uint8Array(FastDirtyResetMemory113c.PAGE_SIZE)
    kCopy.fill(1)
    this.basePages.set(page, pCopy)
    this.baseKnown.set(page, kCopy)
    this.pages.set(page, pCopy.slice())
    this.known.set(page, kCopy.slice())
  }

  writeBaseU32(addr: number, v: number): void {
    this.setU32(addr, v)
    const a = addr >>> 0
    for (let i = 0; i < 4; i++) {
      const byteAddr = (a + i) >>> 0
      const page = byteAddr >>> FastDirtyResetMemory113c.PAGE_BITS
      let bp = this.basePages.get(page)
      let bk = this.baseKnown.get(page)
      if (!bp || !bk) {
        bp = new Uint8Array(FastDirtyResetMemory113c.PAGE_SIZE)
        bk = new Uint8Array(FastDirtyResetMemory113c.PAGE_SIZE)
        this.basePages.set(page, bp)
        this.baseKnown.set(page, bk)
      }
      bp[byteAddr & 0xfff] = (v >>> (i * 8)) & 0xff
      bk[byteAddr & 0xfff] = 1
    }
    this.dirty.clear()
  }

  reset(): void {
    for (const page of this.dirty) {
      const bp = this.basePages.get(page)
      const bk = this.baseKnown.get(page)
      if (bp && bk) {
        this.pages.get(page)!.set(bp)
        this.known.get(page)!.set(bk)
      } else {
        this.pages.delete(page)
        this.known.delete(page)
      }
    }
    this.dirty.clear()
    this.allocTop = 0x40000000
  }

  alloc(size: number): number {
    if ((size >>> 0) === 0) return 0
    const p = ((this.allocTop + 3) & ~3) >>> 0
    this.fill(p, size, 0)
    this.allocTop = (p + size) >>> 0
    return p
  }

  private readByte(a: number): number {
    const addr = a >>> 0
    const page = addr >>> FastDirtyResetMemory113c.PAGE_BITS
    const k = this.known.get(page)
    if (k === undefined || k[addr & 0xfff] === 0) {
      throw new Error(`FastDirtyResetMemory113c: unloaded byte 0x${addr.toString(16)}`)
    }
    return this.pages.get(page)![addr & 0xfff]!
  }

  private writeByte(a: number, v: number): void {
    const addr = a >>> 0
    const page = addr >>> FastDirtyResetMemory113c.PAGE_BITS
    let data = this.pages.get(page)
    let k = this.known.get(page)
    if (data === undefined || k === undefined) {
      data = new Uint8Array(FastDirtyResetMemory113c.PAGE_SIZE)
      k = new Uint8Array(FastDirtyResetMemory113c.PAGE_SIZE)
      this.pages.set(page, data)
      this.known.set(page, k)
    }
    this.dirty.add(page)
    data[addr & 0xfff] = v
    k[addr & 0xfff] = 1
  }

  u8(p: number): number {
    return this.readByte(p)
  }
  u16(p: number): number {
    return this.readByte(p) | (this.readByte(p + 1) << 8)
  }
  u32(p: number): number {
    return (this.u16(p) | (this.u16(p + 2) << 16)) >>> 0
  }
  setU8(p: number, v: number): void {
    this.writeByte(p, v & 0xff)
  }
  setU16(p: number, v: number): void {
    this.writeByte(p, v & 0xff)
    this.writeByte(p + 1, (v >>> 8) & 0xff)
  }
  setU32(p: number, v: number): void {
    this.setU16(p, v & 0xffff)
    this.setU16(p + 2, (v >>> 16) & 0xffff)
  }
  fill(p: number, len: number, v: number): void {
    for (let i = 0; i < len; i++) this.writeByte(p + i, v & 0xff)
  }
  get(base: number, f: FieldLayout113c, index = 0): number {
    const { p, width } = this.addr(base, f, index)
    return width === 1 ? this.u8(p) : width === 2 ? this.u16(p) : this.u32(p)
  }
  set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    const { p, width } = this.addr(base, f, index)
    if (width === 1) this.setU8(p, v)
    else if (width === 2) this.setU16(p, v)
    else this.setU32(p, v)
  }
  private addr(base: number, f: FieldLayout113c, index: number): { p: number; width: number } {
    if (base === 0) throw new Error('FastDirtyResetMemory113c: NULL base')
    if (index < 0 || index >= f.count) throw new Error(`Index ${index} out of bounds`)
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    return { p: (base + f.off + index * width) >>> 0, width }
  }
}

function runPathVectorsFullReplay(
  records: readonly PathVectorRecord[],
  meta: PathWorldMetaHeader,
  pages: readonly PageImageRecord[],
): { matched: number; mismatches: string[] } {
  const mem = new FastDirtyResetMemory113c()
  for (const page of pages) {
    mem.loadBasePage(page.va, page.data)
  }
  const pBitMasks = mem.u32(0x6fdd90b0)
  for (let i = 0; i < 32; i++) {
    mem.writeBaseU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  const fogDllCandidates = [
    ...(process.env.D2_DATA_DIR ? [resolve(process.env.D2_DATA_DIR, 'Fog.dll')] : []),
    resolve(REPO_ROOT, 'samples/d2/Fog.dll'),
    resolve(homedir(), 'd2-data/Fog.dll'),
  ]
  const fogDllPath = fogDllCandidates.find((p) => existsSync(p))
  if (fogDllPath) {
    const fogDll = readFileSync(fogDllPath)
    for (let i = 0; i < 512; i++) {
      mem.writeBaseU32((0x6ff7f470 + i * 4) >>> 0, fogDll.readUInt32LE(0x2f470 + i * 4))
    }
  } else {
    const dv = new DataView(new ArrayBuffer(4))
    for (let i = 0; i < 512; i++) {
      dv.setFloat32(0, FOG_SIN_TABLE[i]!, true)
      mem.writeBaseU32((0x6ff7f470 + i * 4) >>> 0, dv.getUint32(0, true))
    }
  }

  const findRoomForPos = (x: number, y: number): number => {
    for (const r of meta.activeRoomVas) {
      const rx = mem.u32(r + 0x4c) | 0
      const ry = mem.u32(r + 0x50) | 0
      const rw = mem.u32(r + 0x54) | 0
      const rh = mem.u32(r + 0x58) | 0
      if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return r
    }
    return meta.activeRoomVas[0]!
  }

  let matched = 0
  const mismatches: string[] = []

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]!
    mem.reset()
    const startRoom = findRoomForPos(rec.startX, rec.startY)
    const pUnit = meta.pUnitVa
    const pTargetUnit = meta.pTargetUnitVa
    mem.fill(pUnit, 0x100, 0)
    mem.setU32(pUnit + 0x00, rec.unitType)
    mem.setU32(pUnit + 0x04, rec.classId)
    mem.setU32(pUnit + 0x0c, 1)
    mem.setU32(pUnit + 0x10, 1)
    mem.setU32(pUnit + 0x20, rec.unitSeedLo)
    mem.setU32(pUnit + 0x24, 666)

    mem.fill(pTargetUnit, 0x200, 0)
    const pTgtPath = (pTargetUnit + 0x100) >>> 0
    if (rec.preFlags & PATH_PREFLAG_SET_TARGET_UNIT) {
      const tx = (rec.startX + rec.targetDx) & 0xffff
      const ty = (rec.startY + rec.targetDy) & 0xffff
      mem.setU32(pTargetUnit + 0x00, 1)
      mem.setU32(pTargetUnit + 0x04, 1)
      mem.setU32(pTargetUnit + 0x0c, 2)
      mem.setU32(pTargetUnit + 0x10, 1)
      mem.setU32(pTargetUnit + 0x2c, pTgtPath)
      mem.setU16(pTgtPath + 0x02, tx)
      mem.setU16(pTgtPath + 0x06, ty)
      mem.setU32(pTgtPath + 0x1c, startRoom)
    }

    let tsRet = -1
    let tsFaultKind = 0
    let tsFaultStage = 0
    let tsFaultLine = 0

    PATH_AllocDynamicPath113c(mem, 0, startRoom, rec.startX, rec.startY, pUnit, rec.bAllocFlag)
    const pPath = mem.u32(pUnit + 0x2c)
    if (!pPath) {
      tsFaultStage = 1
    } else {
      if (rec.nDistMax !== 0xff) mem.setU8(pPath + 0x91, rec.nDistMax)
      if (rec.nStepNum !== 0) mem.setU8(pPath + 0x90, rec.nStepNum)
      if (rec.preFlags & PATH_PREFLAG_SET_PREV_TYPE) mem.setU32(pPath + 0x3c, rec.prevPathType)
      if (rec.preFlags & PATH_PREFLAG_SET_TARGET_UNIT) mem.setU32(pPath + 0x58, pTargetUnit)
      if (rec.preFlags & PATH_PREFLAG_SET_VELOCITY) mem.setU32(pPath + 0x7c, rec.velOverride >>> 0)

      if (!(rec.preFlags & PATH_PREFLAG_SKIP_SET_TYPE)) {
        try {
          PATH_SetType113c(mem, pPath, rec.pathType)
        } catch (e) {
          if (e instanceof D2CommonAssertError) {
            tsFaultKind = 2
            tsFaultStage = 2
            tsFaultLine = e.line
          } else {
            throw e
          }
        }
      }
      if (tsFaultKind === 0) {
        if (rec.nStepNum !== 0) mem.setU8(pPath + 0x90, rec.nStepNum)
        if (rec.nDistMax !== 0xff) mem.setU8(pPath + 0x91, rec.nDistMax)
        try {
          PATH_SetTargetPos113c(mem, pPath, rec.targetX, rec.targetY)
        } catch (e) {
          if (e instanceof D2CommonAssertError) {
            tsFaultKind = 2
            tsFaultStage = 3
            tsFaultLine = e.line
          } else {
            throw e
          }
        }
      }
      if (tsFaultKind === 0) {
        try {
          tsRet = PATH_Compute113c(mem, pPath, pUnit, rec.a2) | 0
        } catch (e) {
          if (e instanceof D2CommonAssertError) {
            tsFaultKind = 2
            tsFaultStage = 4
            tsFaultLine = e.line
          } else {
            throw e
          }
        }
      }
    }

    if (
      tsFaultKind !== rec.faultKind ||
      tsFaultStage !== rec.faultStage ||
      (tsFaultKind === 2 && tsFaultLine !== rec.faultLine)
    ) {
      mismatches.push(`rec#${i} fault mismatch`)
      continue
    }
    if (tsFaultKind === 2) {
      matched++
      continue
    }

    const tsPathPoints = mem.u32(pPath + 0x28)
    let ptsMatch = tsPathPoints === rec.dwPathPoints
    if (ptsMatch) {
      for (let j = 0; j < tsPathPoints && j < 78; j++) {
        if (
          mem.u16(pPath + 0x9c + j * 4) !== rec.pathPoints[j]!.x ||
          mem.u16(pPath + 0x9c + j * 4 + 2) !== rec.pathPoints[j]!.y
        ) {
          ptsMatch = false
          break
        }
      }
    }
    if (
      tsRet !== rec.ret ||
      !ptsMatch ||
      mem.u32(pPath + 0x34) !== rec.dwFlags ||
      mem.u32(pPath + 0x3c) !== rec.dwPathType ||
      mem.u32(pPath + 0x40) !== rec.dwPrevPathType ||
      (mem.u32(pPath + 0x10) | 0) !== rec.outTargetX ||
      (mem.u32(pPath + 0x14) | 0) !== rec.outTargetY ||
      mem.u32(pPath + 0x24) !== rec.dwCurrentPointIdx ||
      mem.u8(pPath + 0x64) !== rec.nDirection ||
      mem.u8(pPath + 0x65) !== rec.nNewDirection
    ) {
      mismatches.push(`rec#${i} output mismatch`)
      continue
    }
    matched++
  }

  return { matched, mismatches }
}

describe('[K5] Unified D2TV Binary Vector Regression Gate (PRNG, EVENTWHEEL, DRLG, PATH, MONSPAWN, TCDROP, ITEMGEN, SKILLCALC, S2C)', () => {
  it('1. PRNG (prng-10k.d2tv): 10,000/10,000 bit-exact records', () => {
    const raw = new Uint8Array(readFileSync(resolve(VEC_DIR, 'prng-10k.d2tv')))
    expect(sha256Hex(raw)).toBe(PINNED_DIGESTS.prng)
    expect(raw.byteLength).toBe(32 + 10_000 * PRNG_RECORD_SIZE)
    const res = verifyPrngVectors(raw)
    expect(res.errors).toEqual([])
    expect(res.passed).toBe(10_000)
  })

  it('2. EVENTWHEEL (eventwheel-113c.d2tv): 256/256 scenarios & 45,101 fired events', () => {
    const raw = new Uint8Array(readFileSync(resolve(VEC_DIR, 'eventwheel-113c.d2tv')))
    expect(sha256Hex(raw)).toBe(PINNED_DIGESTS.eventwheel)
    expect(raw.byteLength).toBe(32 + 256 * EVTWHEEL_RECORD_SIZE)
    const res = verifyEventWheelVectors(raw)
    expect(res.errors).toEqual([])
    expect(res.passed).toBe(256)
    expect(res.totalFired).toBe(45_101)
  })

  it('3. DRLG (DRLGDIG 20,400 + DRLGROOM 20,807 + DRLGCOLL 169 + live s12345 d0 136-level sweep)', () => {
    const digRaw = new Uint8Array(gunzipSync(readFileSync(resolve(VEC_DIR, 'drlg-digest-113c.d2tv.gz'))))
    const roomsRaw = new Uint8Array(gunzipSync(readFileSync(resolve(VEC_DIR, 'drlg-rooms-s12345.d2tv.gz'))))
    const collRaw = new Uint8Array(gunzipSync(readFileSync(resolve(VEC_DIR, 'drlg-coll-towns-s12345-d0.d2tv.gz'))))
    const tblImgRaw = new Uint8Array(gunzipSync(readFileSync(DRLG_DATATBLS_IMG_PATH)))

    expect(sha256Hex(digRaw)).toBe(PINNED_DIGESTS.drlgDigest)
    expect(sha256Hex(roomsRaw)).toBe(PINNED_DIGESTS.drlgRooms)
    expect(sha256Hex(collRaw)).toBe(PINNED_DIGESTS.drlgColl)
    expect(sha256Hex(tblImgRaw)).toBe(PINNED_DIGESTS.drlgDataTbls)

    const parsedDig = parseDrlgDigestFile(digRaw)
    const parsedRooms = parseDrlgRoomsFile(roomsRaw)
    const parsedColl = parseDrlgCollFile(collRaw)
    expect(parsedDig.header.magic).toBe(D2TV_MAGIC)
    expect(parsedDig.records.length).toBe(20_400)
    expect(parsedRooms.header.recordCount).toBe(20_807)
    expect(parsedColl.records.length).toBe(169)

    const expectedDiv = JSON.parse(
      readFileSync(resolve(VEC_DIR, 'drlg-expected-divergence.json'), 'utf8'),
    ) as { items: Record<string, unknown>; closures: Record<string, { unportedFunctions: number }> }
    expect(Object.keys(expectedDiv.items).length).toBe(0)
    expect(expectedDiv.closures.layout?.unportedFunctions).toBe(0)
    expect(expectedDiv.closures.collision?.unportedFunctions).toBe(0)

    const digByKey = new Map(parsedDig.records.map((r) => [`${r.seed}:${r.diff}:${r.levelId}`, r]))
    for (const grp of parsedRooms.levels) {
      const exp = digByKey.get(`12345:${grp.header.diff}:${grp.header.levelId}`)!
      expect(computeDrlgLevelLayoutHash(grp.header, grp.rooms)).toBe(exp.layoutHash)
    }
    let collCursor = 0
    for (const townId of [1, 40, 75, 103, 109]) {
      const exp = digByKey.get(`12345:0:${townId}`)!
      const townRooms = parsedColl.records.slice(collCursor, collCursor + exp.nCollRooms)
      expect(townRooms.length).toBe(exp.nCollRooms)
      expect(computeDrlgLevelCollHash(townRooms)).toBe(exp.collHash)
      collCursor += exp.nCollRooms
    }
    expect(collCursor).toBe(169)

    if (isDrlgLiveRunnerReady()) {
      const live = runLiveDrlgCombo(12345, 0, { captureRooms: true, captureTownColl: true })
      expect(live.digests.length).toBe(136)
      expect(live.townColls.length).toBe(169)
      for (const d of live.digests) {
        const exp = digByKey.get(`12345:0:${d.levelId}`)!
        expect(d.layoutHash).toBe(exp.layoutHash)
        expect(d.collHash).toBe(exp.collHash)
      }
      for (let i = 0; i < 169; i++) {
        expect(live.townColls[i]!.mapWords).toEqual(parsedColl.records[i]!.mapWords)
      }
    }
  })

  it('4. PATH (path-vectors-113c.d2tv.gz): 6,924/6,924 Stage 1..4 PATHTYPE 0..17 records', () => {
    const vecRaw = new Uint8Array(gunzipSync(readFileSync(resolve(VEC_DIR, 'path-vectors-113c.d2tv.gz'))))
    const imgRaw = new Uint8Array(gunzipSync(readFileSync(resolve(VEC_DIR, 'path-world-town-s12345.img.gz'))))
    expect(sha256Hex(vecRaw)).toBe(PINNED_DIGESTS.pathVectors)
    expect(sha256Hex(imgRaw)).toBe(PINNED_DIGESTS.pathWorldImg)

    const parsedVec = parsePathVectors(vecRaw)
    const parsedImg = parsePathWorldImage(imgRaw)
    expect(parsedVec.header.magic).toBe(D2TV_MAGIC)
    expect(parsedVec.header.recordSize).toBe(PATHVEC_RECORD_SIZE)
    expect(parsedVec.records.length).toBe(6924)
    expect(parsedImg.header.recordCount).toBe(66)
    expect(parsedImg.pages.length).toBe(65)

    const expectedDiv = JSON.parse(
      readFileSync(resolve(VEC_DIR, 'path-expected-divergence.json'), 'utf8'),
    ) as { items: Record<string, unknown>; closures: Record<string, { unportedFunctions: number }> }
    expect(Object.keys(expectedDiv.items).length).toBe(0)
    expect(expectedDiv.closures.path?.unportedFunctions).toBe(0)

    const replay = runPathVectorsFullReplay(parsedVec.records, parsedImg.meta, parsedImg.pages)
    expect(replay.mismatches).toEqual([])
    expect(replay.matched).toBe(6924)
  })

  it('5. MONSPAWN (monspawn-113c.d2tv.gz): 2,448/2,448 bit-exact records across all 136 levels + PRNG seed parity', () => {
    const raw = new Uint8Array(gunzipSync(readFileSync(resolve(K2_DIR, 'monspawn-113c.d2tv.gz'))))
    expect(sha256Hex(raw)).toBe(PINNED_DIGESTS.monspawn)
    const parsed = parseMonSpawnVectors(raw)
    expect(parsed.header.magic).toBe(D2TV_MAGIC)
    expect(parsed.header.recordSize).toBe(MONSPAWN_RECORD_SIZE)
    expect(parsed.records.length).toBe(2448)
    const res = verifyMonSpawnVectors(raw)
    expect(res.mismatches).toEqual([])
    expect(res.totalRecords).toBe(2448)
  })

  it('6. TCDROP (tcdrop-113c.d2tv.gz): 1,200/1,200 bit-exact records + PRNG seed parity', () => {
    const raw = new Uint8Array(gunzipSync(readFileSync(resolve(K2_DIR, 'tcdrop-113c.d2tv.gz'))))
    expect(sha256Hex(raw)).toBe(PINNED_DIGESTS.tcdrop)
    const parsed = parseTcDropVectors(raw)
    expect(parsed.header.magic).toBe(D2TV_MAGIC)
    expect(parsed.header.recordSize).toBe(TCDROP_RECORD_SIZE)
    expect(parsed.records.length).toBe(1200)
    const res = verifyTcDropVectors(raw)
    expect(res.mismatches).toEqual([])
    expect(res.totalRecords).toBe(1200)
  })

  it('7. ITEMGEN (itemgen-113c.d2tv.gz): 2,400/2,400 bit-exact all-8-quality + #10987 bitstream SHA-256 + PRNG seed parity', () => {
    const raw = new Uint8Array(gunzipSync(readFileSync(resolve(K2_DIR, 'itemgen-113c.d2tv.gz'))))
    expect(sha256Hex(raw)).toBe(PINNED_DIGESTS.itemgen)
    const parsed = parseItemGenVectors(raw)
    expect(parsed.header.magic).toBe(D2TV_MAGIC)
    expect(parsed.header.recordSize).toBe(ITEMGEN_RECORD_SIZE)
    expect(parsed.records.length).toBe(2400)
    const res = verifyItemGenVectors(raw)
    expect(res.mismatches).toEqual([])
    expect(res.totalRecords).toBe(2400)
  })

  it('8. SKILLCALC (skillcalc-113c.d2tv.gz): 12,600/12,600 bit-exact 210-skill x slvl 1..60 records + negative-control tamper rejection', () => {
    const raw = new Uint8Array(gunzipSync(readFileSync(resolve(K3_DIR, 'skillcalc-113c.d2tv.gz'))))
    expect(sha256Hex(raw)).toBe(PINNED_DIGESTS.skillcalc)
    const parsed = parseSkillCalcVectors(raw)
    expect(parsed.header.magic).toBe(D2TV_MAGIC)
    expect(parsed.header.kind).toBe(D2TV_KIND_SKILLCALC)
    expect(parsed.header.recordSize).toBe(SKILLCALC_RECORD_SIZE)
    expect(parsed.records.length).toBe(12_600)
    const res = verifySkillCalcVectors(raw)
    expect(res.mismatches).toEqual([])
    expect(res.totalRecords).toBe(12_600)

    const corrupted = new Uint8Array(raw)
    corrupted[32 + 100 * SKILLCALC_RECORD_SIZE + 32] ^= 0x01
    expect(verifySkillCalcVectors(corrupted).mismatches.length).toBeGreaterThan(0)
  })

  it('9. S2C (s2c-113c.d2tv.gz): 1,440/1,440 bit-exact S2C payload, Fog Huffman & D2Net framing records', () => {
    const raw = new Uint8Array(gunzipSync(readFileSync(resolve(K4_DIR, 's2c-113c.d2tv.gz'))))
    expect(sha256Hex(raw)).toBe(PINNED_DIGESTS.s2c)
    const parsed = parseS2CVectors(raw)
    expect(parsed.header.magic).toBe(D2TV_MAGIC)
    expect(parsed.header.kind).toBe('S2C')
    expect(parsed.header.recordSize).toBe(S2C_RECORD_SIZE)
    expect(parsed.records.length).toBe(1440)
    const res = verifyS2CVectors(raw)
    expect(res.mismatches).toEqual([])
    expect(res.totalRecords).toBe(1440)
  })
})
