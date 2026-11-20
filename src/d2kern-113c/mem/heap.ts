/**
 * Route-2 pilot heap: one linear little-endian memory per game whose structures sit at the 1.13c field
 * offsets (`layout.generated.ts`). Pointers are 32-bit offsets into the heap; 0 is NULL. Addresses of a
 * recorded oracle call can be mapped 1:1 (see `loadBlock`), so a replayed function reads exactly the bytes
 * the original read. Design: docs/oracle/route2-pilot.md §2.
 */
import type { FieldLayout113c } from './layout.generated.ts'
import type { Memory113c } from './sparse-memory.ts'

export type Ptr113c = number

export class Heap113c implements Memory113c {
  private buf: ArrayBuffer
  private view: DataView
  private bytes: Uint8Array
  private top: number

  constructor(initialSize = 1 << 20) {
    this.buf = new ArrayBuffer(initialSize)
    this.view = new DataView(this.buf)
    this.bytes = new Uint8Array(this.buf)
    // Offset 0 stays unused so that 0 can mean NULL.
    this.top = 16
  }

  get size(): number {
    return this.buf.byteLength
  }

  /** Zeroed allocation, 4-byte aligned. */
  alloc(size: number): Ptr113c {
    const p = (this.top + 3) & ~3
    this.ensure(p + size)
    this.bytes.fill(0, p, p + size)
    this.top = p + size
    return p
  }

  /** Copy raw bytes (e.g. an oracle memdump block) to `addr`, growing the heap when needed. */
  loadBlock(addr: Ptr113c, data: Uint8Array): void {
    this.ensure(addr + data.length)
    this.bytes.set(data, addr)
    if (addr + data.length > this.top) this.top = addr + data.length
  }

  readBytes(addr: Ptr113c, len: number): Uint8Array {
    this.check(addr, len)
    return this.bytes.slice(addr, addr + len)
  }

  u8(p: Ptr113c): number {
    this.check(p, 1)
    return this.view.getUint8(p)
  }
  u16(p: Ptr113c): number {
    this.check(p, 2)
    return this.view.getUint16(p, true)
  }
  u32(p: Ptr113c): number {
    this.check(p, 4)
    return this.view.getUint32(p, true)
  }
  setU8(p: Ptr113c, v: number): void {
    this.check(p, 1)
    this.view.setUint8(p, v)
  }
  setU16(p: Ptr113c, v: number): void {
    this.check(p, 2)
    this.view.setUint16(p, v, true)
  }
  setU32(p: Ptr113c, v: number): void {
    this.check(p, 4)
    this.view.setUint32(p, v >>> 0, true)
  }
  fill(p: Ptr113c, len: number, v: number): void {
    if (len === 0) return
    this.check(p, len)
    this.bytes.fill(v & 0xff, p, p + len)
  }

  /** Read `base.field[index]`. */
  get(base: Ptr113c, f: FieldLayout113c, index = 0): number {
    if (base === 0) throw new Error('Heap113c.get: NULL base')
    if (index < 0 || index >= f.count) throw new Error(`Heap113c.get: index ${index} outside 0..${f.count - 1}`)
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = base + f.off + index * width
    return width === 1 ? this.u8(p) : width === 2 ? this.u16(p) : this.u32(p)
  }

  /** Write `base.field[index] = v`. */
  set(base: Ptr113c, f: FieldLayout113c, v: number, index = 0): void {
    if (base === 0) throw new Error('Heap113c.set: NULL base')
    if (index < 0 || index >= f.count) throw new Error(`Heap113c.set: index ${index} outside 0..${f.count - 1}`)
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = base + f.off + index * width
    if (width === 1) this.setU8(p, v)
    else if (width === 2) this.setU16(p, v)
    else this.setU32(p, v)
  }

  private check(p: Ptr113c, len: number): void {
    if (!Number.isInteger(p) || p <= 0 || p + len > this.buf.byteLength) {
      throw new Error(`Heap113c: access ${p}+${len} outside the heap (size ${this.buf.byteLength})`)
    }
  }

  private ensure(end: number): void {
    if (end <= this.buf.byteLength) return
    let size = this.buf.byteLength
    while (size < end) size *= 2
    const next = new ArrayBuffer(size)
    new Uint8Array(next).set(this.bytes)
    this.buf = next
    this.view = new DataView(next)
    this.bytes = new Uint8Array(next)
  }
}
