/**
 * Regression: monster drops rendered with the wrong ground sprite.
 *
 * Simulation items produced by executeDropPipeline carry `code` as the 4-byte
 * space-padded .d2s field ('dr3 '). The ground resolver looked that up verbatim
 * in codeToFlippyFile, missed, and fell through to the inventory-size guess, so
 * every 2x2 drop (Antlers 'dr3', caps, ...) rendered as the Horadric Cube
 * (invbox). Picking the item up rebuilt it through itemToUiInventoryItem, which
 * is why re-dropping it looked correct.
 */
import { describe, it, expect } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { createDroppedItem, executeDropPipeline } from '../src/common/items/drop-tables.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import { normalizeItemCode, resolveGroundItemSpriteRect, resolveItemSpriteRect } from '../src/client/ui/inventory.ts'
import { itemToUiInventoryItem } from '../src/common/items/item-bridge.ts'

const VARIANT_INV_CODES = new Set(['amu', 'rin', 'jew'])

describe('monster drop ground sprite resolution', () => {
  const tables = getEmbeddedDropTables()
  const flippyRects = BAKED_UI_MANIFEST.flippyRects
  const codeToFlippy = BAKED_UI_MANIFEST.codeToFlippyFile

  it('normalizes padded .d2s codes and falls back to base.id', () => {
    expect(normalizeItemCode({ code: 'dr3 ' })).toBe('dr3')
    expect(normalizeItemCode({ code: 'hp1 ' })).toBe('hp1')
    expect(normalizeItemCode({ base: { id: 'cap' } } as any)).toBe('cap')
    expect(normalizeItemCode({})).toBeUndefined()
  })

  it('renders a pipeline-built Antlers (dr3) with flpdr3, not the Horadric Cube', () => {
    const base = tables.getBase('dr3')!
    expect(base).toBeDefined()
    const item = createDroppedItem(base, 'normal', { ilvl: 5, dwInitSeed: 1 } as any)
    expect(item.code).toBe('dr3 ')
    const rect = resolveGroundItemSpriteRect(item as any)
    expect(rect).toBe(flippyRects[codeToFlippy['dr3']!])
    expect(rect).not.toBe(flippyRects['flpbox'])
    expect(rect).not.toBe(BAKED_UI_MANIFEST.itemRects['invbox'])
  })

  it('ground sprite of a raw drop equals the sprite after the pickup→UI round trip', () => {
    const rng = new D2Rng(7)
    let checked = 0
    for (let i = 0; i < 400; i++) {
      for (const drop of executeDropPipeline(tables, { tcName: 'Act 1 Champ A', nLevel: 5, monsterType: 2, monsterRng: rng } as any)) {
        if (drop.base.id === 'gold') continue
        const raw = resolveGroundItemSpriteRect(drop as any)
        const ui = resolveGroundItemSpriteRect(itemToUiInventoryItem(drop, tables) as any)
        expect(raw, `${drop.base.id} ${drop.name}`).toBe(ui)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('every droppable weapon/armor/misc base with a baked flippy resolves to it directly', () => {
    const missing: string[] = []
    let checked = 0
    for (const [code, flp] of Object.entries(codeToFlippy)) {
      const base = tables.getBase(code)
      if (!base || !flippyRects[flp]) continue
      {
        checked++
        const item = createDroppedItem(base, 'normal', { ilvl: 1, dwInitSeed: 1 } as any)
        if (resolveGroundItemSpriteRect(item as any) !== flippyRects[flp]) missing.push(code)
        const inv = BAKED_UI_MANIFEST.codeToInvFile[code]
        // amu/rin/jew pick one of several invfile variants (invamu1..3 etc.) per item seed.
        if (!VARIANT_INV_CODES.has(code) && inv && BAKED_UI_MANIFEST.itemRects[inv] && resolveItemSpriteRect(item as any) !== BAKED_UI_MANIFEST.itemRects[inv]) {
          missing.push(`inv:${code}`)
        }
      }
    }
    expect(checked).toBeGreaterThan(300)
    expect(missing).toEqual([])
  })
})
