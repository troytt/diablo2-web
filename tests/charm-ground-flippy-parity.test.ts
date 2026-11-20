/**
 * tests/charm-ground-flippy-parity.test.ts
 *
 * Regression test for Issue #452:
 * Grand Charm (cm3 / 超大护身符) ground sprite must resolve to flpchm3 (21x6 px),
 * NOT flpmss (Annihilus / Soulstone, 9x4 px).
 *
 * Authentic 1.13c Charm Ground Flippy Parity:
 * - cm1 (Small Charm): flpchm1 (13x5 px)
 * - Annihilus (anni / Annihilus): flpmss (9x4 px)
 * - cm2 (Large Charm): flpchm2 (13x6 px)
 * - Hellfire Torch (torch / Hellfire Torch): flptrch
 * - cm3 (Grand Charm): flpchm3 (21x6 px)
 * - Gheed's Fortune (gheeds / Gheed's Fortune): flpchm3
 */

import { describe, expect, it } from 'vitest'
import { resolveGroundItemSpriteRect } from '../src/client/ui/inventory.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'

describe('Charm Ground Flippy Sprite Resolution Parity (Issue #452)', () => {
  const flippyRects = BAKED_UI_MANIFEST.flippyRects
  const flpchm1 = flippyRects['flpchm1']
  const flpchm2 = flippyRects['flpchm2']
  const flpchm3 = flippyRects['flpchm3']
  const flpmss = flippyRects['flpmss']
  const flptrch = flippyRects['flptrch']

  it('verifies flippy sprite assets exist in manifest', () => {
    expect(flpchm1).toBeDefined()
    expect(flpchm2).toBeDefined()
    expect(flpchm3).toBeDefined()
    expect(flpmss).toBeDefined()
    expect(flpchm3?.w).toBe(21)
    expect(flpchm3?.h).toBe(6)
  })

  it('resolves normal Grand Charm (cm3) to flpchm3 and NOT flpmss', () => {
    const item = { code: 'cm3', name: 'Grand Charm', quality: 'magic' }
    const rect = resolveGroundItemSpriteRect(item)
    expect(rect).toEqual(flpchm3)
    expect(rect).not.toEqual(flpmss)
  })

  it("resolves Gheed's Fortune unique Grand Charm to flpchm3 and NOT flpmss", () => {
    const item = {
      code: 'cm3',
      name: "Gheed's Fortune",
      nameZh: "基德的运气 (Gheed's Fortune)",
      baseNameZh: '超大型护身符 (Grand Charm)',
      quality: 'unique',
    }
    const rect = resolveGroundItemSpriteRect(item)
    expect(rect).toEqual(flpchm3)
    expect(rect).not.toEqual(flpmss)
  })

  it('resolves normal Small Charm (cm1) to flpchm1 and NOT flpmss', () => {
    const item = { code: 'cm1', name: 'Small Charm', quality: 'magic' }
    const rect = resolveGroundItemSpriteRect(item)
    expect(rect).toEqual(flpchm1)
    expect(rect).not.toEqual(flpmss)
  })

  it('resolves Annihilus unique Small Charm to flpmss', () => {
    const item = {
      code: 'cm1',
      name: 'Annihilus',
      nameZh: '毁灭 (Annihilus)',
      quality: 'unique',
    }
    const rect = resolveGroundItemSpriteRect(item)
    expect(rect).toEqual(flpmss)
  })

  it('resolves normal Large Charm (cm2) to flpchm2', () => {
    const item = { code: 'cm2', name: 'Large Charm', quality: 'magic' }
    const rect = resolveGroundItemSpriteRect(item)
    expect(rect).toEqual(flpchm2)
  })

  it('resolves Hellfire Torch unique Large Charm to flptrch', () => {
    const item = {
      code: 'cm2',
      name: 'Hellfire Torch',
      nameZh: '地狱火炬 (Hellfire Torch)',
      quality: 'unique',
    }
    const rect = resolveGroundItemSpriteRect(item)
    expect(rect).toEqual(flptrch)
  })

  it('resolves charms with Chinese names via canonical code and rejects unmapped items without code', () => {
    expect(resolveGroundItemSpriteRect({ code: 'cm3', name: '超大护身符' })).toEqual(flpchm3)
    expect(resolveGroundItemSpriteRect({ code: 'cm3', nameZh: '超大型护身符' })).toEqual(flpchm3)
    expect(resolveGroundItemSpriteRect({ code: 'cm2', name: '大型护身符' })).toEqual(flpchm2)
    expect(resolveGroundItemSpriteRect({ code: 'cm1', name: '小型护身符' })).toEqual(flpchm1)
    expect(resolveGroundItemSpriteRect({ name: '未知神秘物品' })).toBeNull()
  })
})
