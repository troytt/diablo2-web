/**
 * Fog.dll record pools (src/client/weather/fog-pool.ts): Fog #10063 clear-all, #10064 alloc,
 * #10065 free, as the 1.13c client weather uses them. Slot choice decides the walk and draw order.
 */

import { describe, expect, it } from 'vitest'
import { FogPool } from '../../src/client/weather/fog-pool.ts'

interface Rec {
  serial: number
  value: number
}

function newPool(capacity: number): { pool: FogPool<Rec>; zeroed: number[] } {
  const zeroed: number[] = []
  const pool = new FogPool<Rec>(
    capacity,
    () => ({ serial: 0, value: 0 }),
    (r) => {
      r.serial = 0
      r.value = 0
      zeroed.push(1)
    },
  )
  return { pool, zeroed }
}

describe('FogPool', () => {
  it('allocates the lowest free slot and zeroes the record', () => {
    const { pool } = newPool(4)
    expect([pool.alloc(), pool.alloc(), pool.alloc()]).toEqual([0, 1, 2])
    pool.records[1]!.value = 99
    pool.free(1)
    expect(pool.count).toBe(2)
    expect(pool.alloc()).toBe(1)
    expect(pool.records[1]!.value).toBe(0)
    expect(pool.alloc()).toBe(3)
    expect(pool.alloc()).toBe(-1)
    expect(pool.count).toBe(4)
    pool.free(0)
    expect(pool.alloc()).toBe(0)
  })

  it('stamps serials 1..0xFFFF and wraps back to 1, never 0', () => {
    const { pool } = newPool(1)
    const seen: number[] = []
    for (let i = 0; i < 0xffff + 2; i += 1) {
      expect(pool.alloc()).toBe(0)
      seen.push(pool.records[0]!.serial)
      pool.free(0)
    }
    expect(seen[0]).toBe(1)
    expect(seen[0xfffe]).toBe(0xffff)
    expect(seen[0xffff]).toBe(1)
    expect(seen[0x10000]).toBe(2)
    expect(seen.includes(0)).toBe(false)
  })

  it('shrinks maxIndex to the highest live record (-1 when empty)', () => {
    const { pool } = newPool(8)
    expect(pool.maxIndex).toBe(-1)
    for (let i = 0; i < 5; i += 1) pool.alloc()
    expect(pool.maxIndex).toBe(4)
    pool.free(2)
    expect(pool.maxIndex).toBe(4)
    pool.free(3)
    pool.free(4)
    expect(pool.maxIndex).toBe(1)
    pool.free(0)
    expect(pool.maxIndex).toBe(1)
    pool.free(1)
    expect(pool.maxIndex).toBe(-1)
    expect(pool.count).toBe(0)
  })

  it('refuses to free a slot that is not live', () => {
    const { pool } = newPool(2)
    expect(() => pool.free(0)).toThrow(/not live/)
    pool.alloc()
    pool.free(0)
    expect(() => pool.free(0)).toThrow(/not live/)
    expect(() => pool.free(5)).toThrow(/not live/)
    expect(() => pool.free(-1)).toThrow(/not live/)
  })

  it('clearAll releases everything and restarts the search at slot 0', () => {
    const { pool } = newPool(3)
    pool.alloc()
    pool.alloc()
    pool.alloc()
    expect(pool.alloc()).toBe(-1)
    pool.clearAll()
    expect(pool.count).toBe(0)
    expect(pool.maxIndex).toBe(-1)
    expect(pool.records.every((r) => r.serial === 0)).toBe(true)
    expect(pool.alloc()).toBe(0)
  })

  it('rejects a bad capacity', () => {
    expect(() => newPool(0)).toThrow(/bad capacity/)
    expect(() => newPool(1.5)).toThrow(/bad capacity/)
  })
})
