/**
 * Route-2 pilot: sparse 32-bit memory for replaying recorded 1.13c calls at their original addresses.
 * Same accessor contract as `Heap113c`, backed by 4 KiB pages created on first write. Reading a byte
 * that was never loaded or written throws, so a port that touches memory outside the recorded read set
 * fails loudly instead of reading zeros.
 */
import type { FieldLayout113c } from './layout.generated.ts'

const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS

export interface Memory113c {
  alloc(size: number): number
  u8(p: number): number
  u16(p: number): number
  u32(p: number): number
  setU8(p: number, v: number): void
  setU16(p: number, v: number): void
  setU32(p: number, v: number): void
  get(base: number, f: FieldLayout113c, index?: number): number
  set(base: number, f: FieldLayout113c, v: number, index?: number): void
  fill(p: number, len: number, v: number): void
}

export class SparseMemory113c implements Memory113c {
  private readonly pages = new Map<number, Uint8Array>()
  private readonly known = new Map<number, Uint8Array>()
  private allocTop = 0x40000000

  alloc(size: number): number {
    const p = ((this.allocTop + 3) & ~3) >>> 0
    this.fill(p, size, 0)
    this.allocTop = (p + size) >>> 0
    return p
  }

  loadBlock(addr: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) this.writeByte(addr + i, data[i]!)
  }

  readBytes(addr: number, len: number): Uint8Array {
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) out[i] = this.readByte(addr + i)
    return out
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
    if (base === 0) throw new Error('SparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) throw new Error(`SparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    return { p: (base + f.off + index * width) >>> 0, width }
  }

  private readByte(a: number): number {
    const addr = a >>> 0
    const page = addr >>> PAGE_BITS
    const k = this.known.get(page)
    if (k === undefined || k[addr & (PAGE_SIZE - 1)] === 0) {
      throw new Error(`SparseMemory113c: read of unloaded byte 0x${addr.toString(16)}`)
    }
    return this.pages.get(page)![addr & (PAGE_SIZE - 1)]!
  }

  private writeByte(a: number, v: number): void {
    const addr = a >>> 0
    const page = addr >>> PAGE_BITS
    let data = this.pages.get(page)
    let k = this.known.get(page)
    if (data === undefined || k === undefined) {
      data = new Uint8Array(PAGE_SIZE)
      k = new Uint8Array(PAGE_SIZE)
      this.pages.set(page, data)
      this.known.set(page, k)
    }
    data[addr & (PAGE_SIZE - 1)] = v
    k[addr & (PAGE_SIZE - 1)] = 1
  }
}
