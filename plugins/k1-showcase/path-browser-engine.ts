/**
 * Real in-browser Diablo II v1.13c `#10342` (`PATH_Compute113c` `0x6FD86230`) engine
 * (`plugins/k1-showcase/path-browser-engine.ts`).
 *
 * Imports directly from `../../src/d2kern-113c/index.ts` and runs inside Chromium against
 * the hydrated `path-world-town-s12345.img.gz` memory image + `Fog.dll` trigonometric table!
 */

import {
  D2CommonAssertError,
  D2DynamicPathStrc,
  PATH_AllocDynamicPath113c,
  PATH_Compute113c,
  PATH_SetTargetPos113c,
  PATH_SetType113c,
  type FieldLayout113c,
  type Memory113c,
} from '../../src/d2kern-113c/index.ts'
import {
  decodeBase64Bytes,
  decodeBase64Uint16LE,
  type BrowserPathVectorRecord,
  type ShowcasePathWorldResponse,
} from './types.ts'

export const PATH_PREFLAG_SET_PREV_TYPE = 1 << 0
export const PATH_PREFLAG_SET_TARGET_UNIT = 1 << 1
export const PATH_PREFLAG_SET_VELOCITY = 1 << 2
export const PATH_PREFLAG_SKIP_SET_TYPE = 1 << 3

export class BrowserPageMemory113c implements Memory113c {
  private static readonly PAGE_BITS = 12
  private static readonly PAGE_SIZE = 1 << BrowserPageMemory113c.PAGE_BITS

  private readonly basePages = new Map<number, Uint8Array>()
  private readonly baseKnown = new Map<number, Uint8Array>()
  private readonly pages = new Map<number, Uint8Array>()
  private readonly known = new Map<number, Uint8Array>()
  private readonly dirty = new Set<number>()
  private allocTop = 0x40000000

  loadBasePage(va: number, data: Uint8Array): void {
    const page = (va >>> 0) >>> BrowserPageMemory113c.PAGE_BITS
    const pCopy = data.slice()
    const kCopy = new Uint8Array(BrowserPageMemory113c.PAGE_SIZE)
    kCopy.fill(1)
    this.basePages.set(page, pCopy)
    this.baseKnown.set(page, kCopy)
    this.pages.set(page, pCopy.slice())
    this.known.set(page, kCopy.slice())
  }

  writeBaseByteIfUnloaded(addr: number, val: number): void {
    const a = addr >>> 0
    const page = a >>> BrowserPageMemory113c.PAGE_BITS
    const off = a & (BrowserPageMemory113c.PAGE_SIZE - 1)
    let bp = this.basePages.get(page)
    let bk = this.baseKnown.get(page)
    if (!bp || !bk) {
      bp = new Uint8Array(BrowserPageMemory113c.PAGE_SIZE)
      bk = new Uint8Array(BrowserPageMemory113c.PAGE_SIZE)
      this.basePages.set(page, bp)
      this.baseKnown.set(page, bk)
      this.pages.set(page, new Uint8Array(BrowserPageMemory113c.PAGE_SIZE))
      this.known.set(page, new Uint8Array(BrowserPageMemory113c.PAGE_SIZE))
    }
    if (bk[off] === 0) {
      bp[off] = val & 0xff
      bk[off] = 1
      this.pages.get(page)![off] = val & 0xff
      this.known.get(page)![off] = 1
    }
  }

  writeBaseU32(addr: number, v: number): void {
    this.setU32(addr, v)
    const a = addr >>> 0
    for (let i = 0; i < 4; i++) {
      const byteAddr = (a + i) >>> 0
      const page = byteAddr >>> BrowserPageMemory113c.PAGE_BITS
      let bp = this.basePages.get(page)
      let bk = this.baseKnown.get(page)
      if (!bp || !bk) {
        bp = new Uint8Array(BrowserPageMemory113c.PAGE_SIZE)
        bk = new Uint8Array(BrowserPageMemory113c.PAGE_SIZE)
        this.basePages.set(page, bp)
        this.baseKnown.set(page, bk)
      }
      bp[byteAddr & (BrowserPageMemory113c.PAGE_SIZE - 1)] = (v >>> (i * 8)) & 0xff
      bk[byteAddr & (BrowserPageMemory113c.PAGE_SIZE - 1)] = 1
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
    const page = addr >>> BrowserPageMemory113c.PAGE_BITS
    const k = this.known.get(page)
    if (k === undefined || k[addr & (BrowserPageMemory113c.PAGE_SIZE - 1)] === 0) {
      throw new Error(`BrowserPageMemory113c: unloaded byte 0x${addr.toString(16)}`)
    }
    return this.pages.get(page)![addr & (BrowserPageMemory113c.PAGE_SIZE - 1)]!
  }

  private writeByte(a: number, v: number): void {
    const addr = a >>> 0
    const page = addr >>> BrowserPageMemory113c.PAGE_BITS
    let data = this.pages.get(page)
    let k = this.known.get(page)
    if (data === undefined || k === undefined) {
      data = new Uint8Array(BrowserPageMemory113c.PAGE_SIZE)
      k = new Uint8Array(BrowserPageMemory113c.PAGE_SIZE)
      this.pages.set(page, data)
      this.known.set(page, k)
    }
    this.dirty.add(page)
    data[addr & (BrowserPageMemory113c.PAGE_SIZE - 1)] = v
    k[addr & (BrowserPageMemory113c.PAGE_SIZE - 1)] = 1
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
    if (base === 0) throw new Error('BrowserPageMemory113c: NULL base')
    if (index < 0 || index >= f.count) throw new Error(`BrowserPageMemory113c: index ${index} out of range`)
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    return { p: (base + f.off + index * width) >>> 0, width }
  }
}

export interface HydratedRoomCellGrid {
  readonly idx: number
  readonly roomVa: number
  readonly pMapVa: number
  readonly subtileX: number
  readonly subtileY: number
  readonly subtileW: number
  readonly subtileH: number
  readonly baseWords: Uint16Array
}

export interface InteractivePathComputeOptions {
  readonly pathType: number
  readonly startX: number
  readonly startY: number
  readonly targetX: number
  readonly targetY: number
  readonly unitSize: 1 | 2 | 3
  readonly unitTypeMode: 'auto' | 0 | 1 | 3
  readonly customObstacles: ReadonlySet<string>
}

export interface InteractivePathComputeResult {
  readonly pathType: number
  readonly effectiveUnitType: number
  readonly effectiveUnitSize: number
  readonly ret: number
  readonly faultKind: number
  readonly faultStage: number
  readonly faultLine: number
  readonly faultMessage: string | null
  readonly dwPathPoints: number
  readonly dwFlags: number
  readonly nDirection: number
  readonly nNewDirection: number
  readonly outTargetX: number
  readonly outTargetY: number
  readonly waypoints: ReadonlyArray<{ readonly x: number; readonly y: number }>
  readonly elapsedUs: number
}

export interface BrowserOracleVerifySummary {
  readonly total: number
  readonly matched: number
  readonly diverged: number
  readonly elapsedMs: number
  readonly firstMismatch: string | null
  readonly byPathTypeMatched: readonly number[]
  readonly byPathTypeTotal: readonly number[]
}

export class BrowserPathSandboxEngine {
  readonly worldData: ShowcasePathWorldResponse
  readonly strictMem: BrowserPageMemory113c
  readonly sandboxMem: BrowserPageMemory113c
  readonly rooms: readonly HydratedRoomCellGrid[]
  readonly minSubtileX: number
  readonly minSubtileY: number
  readonly maxSubtileX: number
  readonly maxSubtileY: number

  constructor(worldData: ShowcasePathWorldResponse) {
    this.worldData = worldData
    this.strictMem = new BrowserPageMemory113c()
    this.sandboxMem = new BrowserPageMemory113c()

    for (const p of worldData.pages) {
      const bytes = decodeBase64Bytes(p.dataBase64)
      this.strictMem.loadBasePage(p.va, bytes)
      this.sandboxMem.loadBasePage(p.va, bytes)
    }

    for (const mem of [this.strictMem, this.sandboxMem]) {
      const pBitMasks = mem.u32(0x6fdd90b0)
      for (let i = 0; i < 32; i++) {
        mem.writeBaseU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
      }
      for (let i = 0; i < 512 && i < worldData.fogSinTableU32.length; i++) {
        mem.writeBaseU32((0x6ff7f470 + i * 4) >>> 0, worldData.fogSinTableU32[i]! >>> 0)
      }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    const hydratedRooms: HydratedRoomCellGrid[] = []
    for (const r of worldData.rooms) {
      const rawBytes = decodeBase64Bytes(r.mapBase64)
      const baseWords = decodeBase64Uint16LE(r.mapBase64)
      // Hydrate any untouched L1 room collision bytes in sandboxMem so interactive dragging works everywhere in Rogue Encampment
      for (let b = 0; b < rawBytes.byteLength; b++) {
        this.sandboxMem.writeBaseByteIfUnloaded((r.pMapVa + b) >>> 0, rawBytes[b]!)
      }
      hydratedRooms.push({
        idx: r.idx,
        roomVa: r.roomVa,
        pMapVa: r.pMapVa,
        subtileX: r.subtileX,
        subtileY: r.subtileY,
        subtileW: r.subtileW,
        subtileH: r.subtileH,
        baseWords,
      })
      if (r.subtileX < minX) minX = r.subtileX
      if (r.subtileY < minY) minY = r.subtileY
      if (r.subtileX + r.subtileW > maxX) maxX = r.subtileX + r.subtileW
      if (r.subtileY + r.subtileH > maxY) maxY = r.subtileY + r.subtileH
    }

    this.rooms = hydratedRooms
    this.minSubtileX = minX
    this.minSubtileY = minY
    this.maxSubtileX = maxX
    this.maxSubtileY = maxY
  }

  getSubtileMask(x: number, y: number): number {
    for (const r of this.rooms) {
      if (
        x >= r.subtileX &&
        x < r.subtileX + r.subtileW &&
        y >= r.subtileY &&
        y < r.subtileY + r.subtileH
      ) {
        const idx = (y - r.subtileY) * r.subtileW + (x - r.subtileX)
        return r.baseWords[idx] ?? 0
      }
    }
    return 0x1001
  }

  private findRoomVaForPos(mem: BrowserPageMemory113c, x: number, y: number): number {
    for (const rVa of this.worldData.meta.activeRoomVas) {
      const rx = mem.u32(rVa + 0x4c) | 0
      const ry = mem.u32(rVa + 0x50) | 0
      const rw = mem.u32(rVa + 0x54) | 0
      const rh = mem.u32(rVa + 0x58) | 0
      if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return rVa
    }
    return this.worldData.meta.activeRoomVas[0]!
  }

  private applyCustomObstaclesToMem(mem: BrowserPageMemory113c, customObstacles: ReadonlySet<string>): void {
    if (customObstacles.size === 0) return
    for (const key of customObstacles) {
      const [xs, ys] = key.split(':')
      const sx = Number(xs)
      const sy = Number(ys)
      for (const r of this.rooms) {
        if (
          sx >= r.subtileX &&
          sx < r.subtileX + r.subtileW &&
          sy >= r.subtileY &&
          sy < r.subtileY + r.subtileH
        ) {
          const cellIdx = (sy - r.subtileY) * r.subtileW + (sx - r.subtileX)
          const addr = (r.pMapVa + cellIdx * 2) >>> 0
          mem.setU16(addr, mem.u16(addr) | 0x000f)
          break
        }
      }
    }
  }

  computeInteractive(opts: InteractivePathComputeOptions): InteractivePathComputeResult {
    const t0 = performance.now()
    const mem = this.sandboxMem
    mem.reset()
    this.applyCustomObstaclesToMem(mem, opts.customObstacles)

    const pt = opts.pathType
    let effectiveUnitType: number
    if (opts.unitTypeMode !== 'auto') {
      effectiveUnitType = opts.unitTypeMode
    } else if (pt === 7 || pt === 14 || pt === 16) {
      effectiveUnitType = 3 // missile
    } else if (pt === 2 || pt === 3 || pt === 4 || pt === 5 || pt === 10 || pt === 12) {
      effectiveUnitType = 1 // monster (avoids player-only Fog.#10024 assert on PATHTYPE 2 TOWARD)
    } else {
      effectiveUnitType = 0 // player
    }

    const startRoom = this.findRoomVaForPos(mem, opts.startX, opts.startY)
    const pUnit = this.worldData.meta.pUnitVa
    const pTargetUnit = this.worldData.meta.pTargetUnitVa

    mem.fill(pUnit, 0x100, 0)
    mem.setU32(pUnit + 0x00, effectiveUnitType >>> 0)
    // classId: 0 (Amazon/Skeleton) or 19 (Fallen)
    mem.setU32(pUnit + 0x04, effectiveUnitType === 1 ? 19 : 0)
    mem.setU32(pUnit + 0x0c, 1)
    mem.setU32(pUnit + 0x10, 1)
    mem.setU32(pUnit + 0x20, 0x12345678)
    mem.setU32(pUnit + 0x24, 666)

    mem.fill(pTargetUnit, 0x200, 0)
    const pTgtPath = (pTargetUnit + 0x100) >>> 0
    mem.setU32(pTargetUnit + 0x00, 1)
    mem.setU32(pTargetUnit + 0x04, 1)
    mem.setU32(pTargetUnit + 0x0c, 2)
    mem.setU32(pTargetUnit + 0x10, 1)
    mem.setU32(pTargetUnit + 0x2c, pTgtPath)
    mem.setU16(pTgtPath + 0x02, opts.targetX & 0xffff)
    mem.setU16(pTgtPath + 0x06, opts.targetY & 0xffff)
    mem.setU32(pTgtPath + 0x1c, this.findRoomVaForPos(mem, opts.targetX, opts.targetY))

    let ret = -1
    let faultKind = 0
    let faultStage = 0
    let faultLine = 0
    let faultMessage: string | null = null
    let pPath = 0

    try {
      PATH_AllocDynamicPath113c(mem, 0, startRoom, opts.startX, opts.startY, pUnit, 0)
      pPath = mem.u32(pUnit + 0x2c)
      if (!pPath) {
        faultKind = 1
        faultStage = 1
        faultMessage = 'PATH_AllocDynamicPath113c returned NULL'
      } else {
        // Override unit footprint size (1, 2, or 3) per sandbox selector
        mem.set(pPath, D2DynamicPathStrc.dwUnitSize, opts.unitSize)
        mem.set(pPath, D2DynamicPathStrc.dwCollisionPattern, opts.unitSize >= 2 ? 2 : 1)

        // PATHTYPE 4 (MON_CIRCLE) asserts if nDistMax >= 0x4E; use 24 in interactive mode
        if (pt === 4 || pt === 10) {
          mem.setU8(pPath + 0x91, 24)
          mem.setU32(pPath + 0x58, pTargetUnit)
        }
        if (pt === 8 || pt === 11) {
          mem.setU8(pPath + 0x90, 10)
          mem.setU8(pPath + 0x91, 12)
        }

        try {
          PATH_SetType113c(mem, pPath, pt)
        } catch (e) {
          if (e instanceof D2CommonAssertError) {
            faultKind = 2
            faultStage = 2
            faultLine = e.line
            faultMessage = `Fog.#10024 Assert @ Path.cpp:${e.line} (Stage 2 PATH_SetType)`
          } else {
            throw e
          }
        }

        if (faultKind === 0) {
          if (pt === 4 || pt === 10) mem.setU8(pPath + 0x91, 24)
          if (pt === 8 || pt === 11) {
            mem.setU8(pPath + 0x90, 10)
            mem.setU8(pPath + 0x91, 12)
          }
          try {
            PATH_SetTargetPos113c(mem, pPath, opts.targetX, opts.targetY)
          } catch (e) {
            if (e instanceof D2CommonAssertError) {
              faultKind = 2
              faultStage = 3
              faultLine = e.line
              faultMessage = `Fog.#10024 Assert @ Path.cpp:${e.line} (Stage 3 PATH_SetTargetPos)`
            } else {
              throw e
            }
          }
        }

        if (faultKind === 0) {
          try {
            ret = PATH_Compute113c(mem, pPath, pUnit, 0) | 0
          } catch (e) {
            if (e instanceof D2CommonAssertError) {
              faultKind = 2
              faultStage = 4
              faultLine = e.line
              faultMessage = `Fog.#10024 Assert @ Path.cpp:${e.line} (Stage 4 PATH_Compute)`
            } else {
              throw e
            }
          }
        }
      }
    } catch (e) {
      faultKind = 1
      faultMessage = e instanceof Error ? e.message : String(e)
    }

    const waypoints: Array<{ x: number; y: number }> = []
    let dwPathPoints = 0
    let dwFlags = 0
    let nDirection = 0
    let nNewDirection = 0
    let outTargetX = opts.targetX
    let outTargetY = opts.targetY
    let effectiveUnitSize: number = opts.unitSize

    if (pPath !== 0 && faultKind === 0) {
      dwPathPoints = mem.u32(pPath + 0x28)
      dwFlags = mem.u32(pPath + 0x34) >>> 0
      nDirection = mem.u8(pPath + 0x64)
      nNewDirection = mem.u8(pPath + 0x65)
      outTargetX = mem.u32(pPath + 0x10) & 0xffff
      outTargetY = mem.u32(pPath + 0x12) & 0xffff
      effectiveUnitSize = mem.u32(pPath + 0x44)
      const count = Math.min(78, dwPathPoints)
      for (let i = 0; i < count; i++) {
        waypoints.push({
          x: mem.u16(pPath + 0x9c + i * 4),
          y: mem.u16(pPath + 0x9c + i * 4 + 2),
        })
      }
    }

    const elapsedUs = Math.round((performance.now() - t0) * 1000)
    return {
      pathType: pt,
      effectiveUnitType,
      effectiveUnitSize,
      ret,
      faultKind,
      faultStage,
      faultLine,
      faultMessage,
      dwPathPoints,
      dwFlags,
      nDirection,
      nNewDirection,
      outTargetX,
      outTargetY,
      waypoints,
      elapsedUs,
    }
  }

  replaySingleOracleVector(rec: BrowserPathVectorRecord): {
    matched: boolean
    reason: string | null
    tsRet: number
    tsFaultKind: number
    tsFaultStage: number
    tsFaultLine: number
    tsWaypoints: ReadonlyArray<{ readonly x: number; readonly y: number }>
  } {
    const mem = this.strictMem
    mem.reset()
    const startRoom = this.findRoomVaForPos(mem, rec.startX, rec.startY)
    const pUnit = this.worldData.meta.pUnitVa
    const pTargetUnit = this.worldData.meta.pTargetUnitVa

    mem.fill(pUnit, 0x100, 0)
    mem.setU32(pUnit + 0x00, rec.unitType)
    mem.setU32(pUnit + 0x04, rec.classId)
    mem.setU32(pUnit + 0x0c, 1)
    mem.setU32(pUnit + 0x10, 1)
    mem.setU32(pUnit + 0x20, rec.unitSeedLo >>> 0)
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
    let pPath = 0

    try {
      PATH_AllocDynamicPath113c(mem, 0, startRoom, rec.startX, rec.startY, pUnit, rec.bAllocFlag)
      pPath = mem.u32(pUnit + 0x2c)
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
    } catch (e) {
      return {
        matched: false,
        reason: e instanceof Error ? e.message : String(e),
        tsRet,
        tsFaultKind: 1,
        tsFaultStage,
        tsFaultLine,
        tsWaypoints: [],
      }
    }

    if (
      tsFaultKind !== rec.faultKind ||
      tsFaultStage !== rec.faultStage ||
      (tsFaultKind === 2 && tsFaultLine !== rec.faultLine)
    ) {
      return {
        matched: false,
        reason: `fault mismatch (${tsFaultKind},${tsFaultStage},${tsFaultLine}) != (${rec.faultKind},${rec.faultStage},${rec.faultLine})`,
        tsRet,
        tsFaultKind,
        tsFaultStage,
        tsFaultLine,
        tsWaypoints: [],
      }
    }

    if (tsFaultKind === 2) {
      return {
        matched: true,
        reason: null,
        tsRet,
        tsFaultKind,
        tsFaultStage,
        tsFaultLine,
        tsWaypoints: [],
      }
    }

    const tsPathPoints = mem.u32(pPath + 0x28)
    const tsFlags = mem.u32(pPath + 0x34) >>> 0
    const tsPathType = mem.u32(pPath + 0x3c)
    const tsPrevPathType = mem.u32(pPath + 0x40)
    const tsOutTargetX = mem.u32(pPath + 0x10) | 0
    const tsOutTargetY = mem.u32(pPath + 0x14) | 0
    const tsCurIdx = mem.u32(pPath + 0x24)
    const tsDir = mem.u8(pPath + 0x64)
    const tsNewDir = mem.u8(pPath + 0x65)

    const tsWaypoints: Array<{ x: number; y: number }> = []
    let ptsMatch = tsPathPoints === rec.dwPathPoints
    for (let j = 0; j < Math.min(78, tsPathPoints); j++) {
      const px = mem.u16(pPath + 0x9c + j * 4)
      const py = mem.u16(pPath + 0x9c + j * 4 + 2)
      tsWaypoints.push({ x: px, y: py })
      const expPt = rec.pathPoints[j]
      if (!expPt || px !== expPt.x || py !== expPt.y) {
        ptsMatch = false
      }
    }

    const exact =
      tsRet === rec.ret &&
      ptsMatch &&
      tsFlags === (rec.dwFlags >>> 0) &&
      tsPathType === rec.dwPathType &&
      tsPrevPathType === rec.dwPrevPathType &&
      tsOutTargetX === rec.outTargetX &&
      tsOutTargetY === rec.outTargetY &&
      tsCurIdx === rec.dwCurrentPointIdx &&
      tsDir === rec.nDirection &&
      tsNewDir === rec.nNewDirection

    return {
      matched: exact,
      reason: exact ? null : `ret=${tsRet}/${rec.ret} pts=${tsPathPoints}/${rec.dwPathPoints} ptsMatch=${ptsMatch}`,
      tsRet,
      tsFaultKind,
      tsFaultStage,
      tsFaultLine,
      tsWaypoints,
    }
  }

  verifyAllVectors(records: readonly BrowserPathVectorRecord[]): BrowserOracleVerifySummary {
    const t0 = performance.now()
    let matched = 0
    let diverged = 0
    let firstMismatch: string | null = null
    const byPathTypeMatched = new Array<number>(18).fill(0)
    const byPathTypeTotal = new Array<number>(18).fill(0)

    for (const rec of records) {
      if (rec.pathType >= 0 && rec.pathType < 18) {
        byPathTypeTotal[rec.pathType]!++
      }
      const res = this.replaySingleOracleVector(rec)
      if (res.matched) {
        matched++
        if (rec.pathType >= 0 && rec.pathType < 18) {
          byPathTypeMatched[rec.pathType]!++
        }
      } else {
        diverged++
        if (firstMismatch === null) {
          firstMismatch = `#${rec.idx} (PATHTYPE ${rec.pathType}): ${res.reason ?? 'mismatch'}`
        }
      }
    }

    return {
      total: records.length,
      matched,
      diverged,
      elapsedMs: Math.round(performance.now() - t0),
      firstMismatch,
      byPathTypeMatched,
      byPathTypeTotal,
    }
  }
}
