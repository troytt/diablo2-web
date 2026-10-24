/**
 * Issue #1357 follow-up — continuous gamble fill and Failed Set/Unique rolls.
 */
import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import {
  generateGambleInventory,
  resolveGambledItem,
} from '../src/common/items/vendor-generator.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { VendorNpcId } from '../src/common/units/npc-table.ts'

describe('issue #1357 gamble fill and failed-quality rules', () => {
  it('fills the gamble grid until 12 consecutive placement failures, not a fixed 14', () => {
    const counts = new Set<number>()
    for (let seed = 1; seed <= 8; seed++) {
      const grid = generateGambleInventory({
        vendorId: 2 as VendorNpcId,
        cLvl: 30,
        tables: getEmbeddedDropTables(),
        rng: new D2Rng(seed),
      })
      counts.add(grid.list().length)
    }
    expect(counts.size).toBeGreaterThan(1)
  })

  it('downgrades a failed Set to magic with 2x durability', () => {
    const tables = getEmbeddedDropTables()
    const setCodes = new Set(
      tables.sets.items.entries.map((s) => s.item.toLowerCase()),
    )
    const base = (tables.gambleCodes ?? [])
      .map((code) => tables.getBase(code))
      .find(
        (candidate): candidate is NonNullable<typeof candidate> =>
          candidate !== undefined &&
          !setCodes.has(candidate.id.toLowerCase()) &&
          Number((candidate as { durability?: number }).durability ?? 0) > 0,
      )!
    expect(base).toBeDefined()
    let i = 0
    const seq = [9999, 100, 12345]
    const rng = { rand: () => seq[i++] ?? 0 } as unknown as D2Rng
    const item = resolveGambledItem({
      mysteryItem: {
        base,
        level: 30,
        ilvl: 30,
        code: base.id,
        stats: {},
        invWidth: base.invWidth,
        invHeight: base.invHeight,
        stack: 1,
        value: 0,
        rawFlags: 0,
        flags: {},
        version: 0x65,
        quality: 2,
        rarity: 'magic',
        uniqueId: 1,
        isGambleMystery: true,
        identified: false,
      } as never,
      cLvl: 30,
      tables,
      rng,
    })
    expect(String(item.rarity).toLowerCase()).toBe('magic')
    expect(item.maxDurability).toBe((base as { durability?: number }).durability! * 2)
  })

  it('downgrades a failed Unique to rare with 3x durability', () => {
    const tables = getEmbeddedDropTables()
    const base = (tables.gambleCodes ?? [])
      .map((code) => tables.getBase(code))
      .find(
        (candidate): candidate is NonNullable<typeof candidate> =>
          candidate !== undefined &&
          (tables.uniques.byCode.get(candidate.id) ?? []).length === 0 &&
          Number((candidate as { durability?: number }).durability ?? 0) > 0,
      )!
    expect(base).toBeDefined()
    let i = 0
    const seq = [9999, 0, 12345]
    const rng = { rand: () => seq[i++] ?? 0 } as unknown as D2Rng
    const item = resolveGambledItem({
      mysteryItem: {
        base, level: 30, ilvl: 30, code: base.id, stats: {},
        invWidth: base.invWidth, invHeight: base.invHeight, stack: 1, value: 0,
        rawFlags: 0, flags: {}, version: 0x65, quality: 2, rarity: 'magic',
        uniqueId: 1, isGambleMystery: true, identified: false,
      } as never,
      cLvl: 30,
      tables,
      rng,
    })
    expect(String(item.rarity).toLowerCase()).toBe('rare')
    expect(item.maxDurability).toBe((base as { durability?: number }).durability! * 3)
  })
})
