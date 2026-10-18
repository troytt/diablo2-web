import { describe, expect, it } from 'vitest'
import { D2FontRenderer } from '../../src/client/ui/font.ts'
import { upgradeSuffix } from '../../src/client/ui/upgrade-marker.ts'
import { WorldPanelsHud } from '../../src/client/ui/world-panels.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import type { UpgradeVerdict } from '../../src/common/items/item-comparison.ts'
import type { UiInventoryItem } from '../../src/common/items/inventory-model.ts'

const recordingCtx = () => {
  const texts: string[] = []
  let strokes = 0
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, key) =>
      key in target ? target[key as string] : key === 'fillText' ? (t: string) => void texts.push(t) : key === 'stroke' ? () => void strokes++ : key === 'measureText' ? (t: string) => ({ width: t.length * 7 }) : () => {},
    set: (target, key, value) => ((target[key as string] = value), true),
  }) as unknown as CanvasRenderingContext2D
  return { ctx, texts, strokes: () => strokes }
}

const tooltipFor = (verdict: UpgradeVerdict | null) => {
  const panels = new WorldPanelsHud()
  panels.upgradeVerdictFor = () => verdict
  const { ctx, texts, strokes } = recordingCtx()
  const item = { id: '1', code: 'cap', name: 'Cap', nameZh: 'Cap', baseNameZh: 'Cap', quality: 'normal', allowedSlots: ['helm'], stats: [], invWidth: 2, invHeight: 2, invFile: '' } as unknown as UiInventoryItem
  panels.drawItemTooltip(ctx, { item, x: 200, y: 200 }, new D2FontRenderer())
  return { header: texts[0], strokes: strokes() }
}

describe('upgrade markers', () => {
  it('reserves room after the name for one or two crosses and spells the unsure mark', () => {
    expect([upgradeSuffix('better'), upgradeSuffix('much-better'), upgradeSuffix('unsure'), upgradeSuffix(null)]).toEqual(['  ', '   ', ' ÿc;?', ''])
  })

  it('draws crosses after the tooltip title only for upgrades', () => {
    expect(tooltipFor('much-better').strokes).toBe(4)
    expect(tooltipFor('better').strokes).toBe(2)
    expect(tooltipFor(null)).toMatchObject({ header: 'Cap', strokes: 0 })
  })

  it('marks an unidentified item you could wear as unsure instead of hiding it', () => {
    const hud = new HudManager()
    hud.upgradeHints = true
    const cap = (fields: Partial<UiInventoryItem>) => ({ id: String(Math.random()), code: 'cap', allowedSlots: ['helm'], stats: [], ...fields }) as unknown as UiInventoryItem
    expect(hud.upgradeVerdictFor(cap({ identified: false }))).toBe('unsure')
    expect(hud.upgradeVerdictFor(cap({ identified: false, reqLevel: 90 }))).toBeNull()
    hud.upgradeHints = false
    expect(hud.upgradeVerdictFor(cap({ identified: false }))).toBeNull()
  })
})

