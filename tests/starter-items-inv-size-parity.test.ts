/**
 * tests/starter-items-inv-size-parity.test.ts
 *
 * Regression guard: every hand-authored starter item (equipped gear, bag, stash, for all 7
 * classes, plus the legacy demo gear/bag fixtures in `tests/fixtures/demo-profile-data.ts`) must
 * declare exactly the `InvWidth` x `InvHeight` recorded in the canonical 1.13c
 * weapons.txt / armor.txt / misc.txt tables (embedded in `canonical-drop-data.ts`).
 *
 * Origin: Swirling Crystal (`oba`, The Oculus / Tal Rasha's Lidless Eye) was hardcoded as 2x3
 * while weapons.txt says 1x3, and The Oculus pointed at `invbst` (a 1x4 Battle Staff icon).
 */

import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { CHARACTER_CLASS_CODES } from '../src/common/units/classes.ts'
import {
  CLASS_EXCLUSIVE_SETS,
  STARTER_STASH_ITEMS,
  createStarterBagForClass,
} from '../src/common/units/class-starter-profiles.ts'
import type { UiInventoryItem } from '../src/client/ui/inventory.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import { DEMO_BAG_ITEMS, DEMO_EQUIPPED_GEAR } from './fixtures/demo-profile-data.ts'

interface CanonSize {
  readonly w: number
  readonly h: number
  readonly name: string
}

function canonicalSize(code: string): CanonSize | undefined {
  const tables = getEmbeddedDropTables()
  const key = code.trim().toLowerCase()
  const w = tables.weapons.byCode.get(key)
  if (w) return { w: w.invWidth, h: w.invHeight, name: w.name }
  const a = tables.armor.byCode.get(key)
  if (a) return { w: a.invWidth, h: a.invHeight, name: a.name }
  const m = tables.misc.byCode.get(key)
  if (m) return { w: m.invWidth, h: m.invHeight, name: m.name }
  return undefined
}

function collectAllStarterItems(): ReadonlyArray<{ readonly source: string; readonly item: UiInventoryItem }> {
  const out: Array<{ source: string; item: UiInventoryItem }> = []
  for (const [slot, item] of Object.entries(DEMO_EQUIPPED_GEAR)) {
    if (item) out.push({ source: `DEMO_EQUIPPED_GEAR.${slot}`, item })
  }
  DEMO_BAG_ITEMS.forEach((p, i) => out.push({ source: `DEMO_BAG_ITEMS[${i}]`, item: p.item }))
  STARTER_STASH_ITEMS.forEach((p, i) => out.push({ source: `STARTER_STASH_ITEMS[${i}]`, item: p.item }))
  for (const cls of CHARACTER_CLASS_CODES) {
    for (const [slot, item] of Object.entries(CLASS_EXCLUSIVE_SETS[cls])) {
      if (item) out.push({ source: `CLASS_EXCLUSIVE_SETS.${cls}.${slot}`, item })
    }
    createStarterBagForClass(cls).forEach((p, i) => out.push({ source: `bag(${cls})[${i}]`, item: p.item }))
  }
  return out
}

describe('Starter item inventory sizes match canonical 1.13c InvWidth/InvHeight', () => {
  const all = collectAllStarterItems()

  it('covers a meaningful number of hand-authored items', () => {
    expect(all.length).toBeGreaterThan(50)
  })

  it('every starter item code exists in weapons/armor/misc.txt', () => {
    const unknown = all.filter(({ item }) => !canonicalSize(item.code)).map(({ source, item }) => `${source}:${item.code}`)
    expect(unknown, `Unknown item codes: ${unknown.join(', ')}`).toEqual([])
  })

  it('every starter item invWidth/invHeight equals the canonical table value', () => {
    const mismatches: string[] = []
    for (const { source, item } of all) {
      const canon = canonicalSize(item.code)
      if (!canon) continue
      if (item.invWidth !== canon.w || item.invHeight !== canon.h) {
        mismatches.push(
          `${source} code=${item.code} (${canon.name}) declared ${item.invWidth}x${item.invHeight}, canonical ${canon.w}x${canon.h}`,
        )
      }
    }
    expect(mismatches, mismatches.join('\n')).toEqual([])
  })

  it('Swirling Crystal (oba) is 1x3 per weapons.txt (The Oculus / Tal Rasha\'s Lidless Eye)', () => {
    const canon = canonicalSize('oba')
    expect(canon).toEqual({ w: 1, h: 3, name: 'Swirling Crystal' })
    const oculus = DEMO_EQUIPPED_GEAR.weapon1!
    expect(oculus.code).toBe('oba')
    expect([oculus.invWidth, oculus.invHeight]).toEqual([1, 3])
    const talOrb = CLASS_EXCLUSIVE_SETS.sor.weapon1!
    expect(talOrb.code).toBe('oba')
    expect([talOrb.invWidth, talOrb.invHeight]).toEqual([1, 3])
  })

  it('starter item invFile sprites have pixel dimensions consistent with the declared grid size', () => {
    // Each inventory cell is 28x28 px in the 1.13c inventory panel.
    const rects = BAKED_UI_MANIFEST.itemRects
    const bad: string[] = []
    for (const { source, item } of all) {
      const rect = rects[item.invFile]
      if (!rect) continue // Some icons are resolved via fallback tiers; only validate direct hits.
      const expectW = item.invWidth * 28
      const expectH = item.invHeight * 28
      if (rect.w !== expectW || rect.h !== expectH) {
        bad.push(`${source} code=${item.code} invFile=${item.invFile} sprite ${rect.w}x${rect.h} vs grid ${expectW}x${expectH}`)
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})
