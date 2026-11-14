/**
 * Fog.dll fixed-capacity record pools as the 1.13c client weather uses them
 * (create #10060/#10062, destroy #10061, clear-all #10063, alloc #10064, free #10065).
 *
 * The semantics matter for parity because they decide slot reuse and the processing / draw order:
 * - alloc returns the LOWEST free index (or -1 when full), zeroes the record and stamps a non-zero
 *   serial into its first word;
 * - free clears the serial, decrements `count`, lowers the search start and shrinks `maxIndex`
 *   down to the highest live record (-1 when empty);
 * - every walker in the client iterates `for (i = 0; i <= maxIndex; i++) if (e[i].serial) …`,
 *   re-reading `maxIndex` each iteration.
 */

/** A pool record. `serial === 0` marks a free slot (Fog's `word0`). */
export interface FogPoolRecord {
  serial: number
}

export class FogPool<T extends FogPoolRecord> {
  readonly capacity: number
  /** Records in index order; free slots keep their object with `serial === 0`. */
  readonly records: readonly T[]
  private readonly zero: (record: T) => void
  private liveCount = 0
  private highest = -1
  private searchStart = 0
  private nextSerial = 1

  /**
   * @param capacity - record count (0x100 particles, 0x200 splashes, 0x80 bubbles).
   * @param create - builds one zeroed record.
   * @param zero - resets every field of a record to 0 (the alloc memset).
   */
  constructor(capacity: number, create: () => T, zero: (record: T) => void) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error(`FogPool: bad capacity ${capacity}`)
    this.capacity = capacity
    this.zero = zero
    const records: T[] = []
    for (let i = 0; i < capacity; i += 1) {
      const record = create()
      zero(record)
      record.serial = 0
      records.push(record)
    }
    this.records = records
  }

  /** Live record count (Fog pool +0x114). */
  get count(): number {
    return this.liveCount
  }

  /** Highest live index, or -1 when empty (Fog pool +0x110). */
  get maxIndex(): number {
    return this.highest
  }

  /**
   * Fog #10064: take the lowest free slot.
   *
   * @returns the slot index, or -1 when the pool is full.
   */
  alloc(): number {
    for (let i = this.searchStart; i < this.capacity; i += 1) {
      const record = this.records[i]!
      if (record.serial !== 0) continue
      this.zero(record)
      record.serial = this.nextSerial
      this.nextSerial = this.nextSerial === 0xffff ? 1 : this.nextSerial + 1
      this.liveCount += 1
      this.searchStart = i + 1
      if (i > this.highest) this.highest = i
      return i
    }
    this.searchStart = this.capacity
    return -1
  }

  /** Fog #10065: release slot `index`. */
  free(index: number): void {
    const record = this.records[index]
    if (record === undefined || record.serial === 0) {
      throw new Error(`FogPool.free: slot ${index} is not live`)
    }
    record.serial = 0
    this.liveCount -= 1
    if (index < this.searchStart) this.searchStart = index
    if (index === this.highest) {
      let i = index - 1
      while (i >= 0 && this.records[i]!.serial === 0) i -= 1
      this.highest = i
    }
  }

  /** Fog #10063: release every slot. */
  clearAll(): void {
    for (const record of this.records) record.serial = 0
    this.liveCount = 0
    this.highest = -1
    this.searchStart = 0
  }
}
