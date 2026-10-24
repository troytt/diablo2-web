import { describe, expect, it } from 'vitest'
import { D2FontRenderer } from '../../src/client/ui/font.ts'
import { badgesWidth, drawBadges, upgradeSuffix } from '../../src/client/ui/item-badges.ts'
import { WorldPanelsHud } from '../../src/client/ui/world-panels.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import type { UpgradeVerdict } from '../../src/common/items/item-comparison.ts'
import type { UiInventoryItem } from '../../src/common/items/inventory-model.ts'

const recordingCtx = () => {
  const texts: string[] = []
  let strokes = 0
  const fakes: Record<string, unknown> = {
    fillText: (t: string) => texts.push(t),
    stroke: () => (strokes += 1),
    measureText: (t: string) => ({ width: t.length * 7 }),
  }
  const ctx = new Proxy<Record<string, unknown>>({}, {
    get: (target, key) => (typeof key !== 'string' ? undefined : key in target ? target[key] : (fakes[key] ?? (() => undefined))),
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

describe('item badges', () => {
  it('reserves room after the tooltip title for one or two arrows', () => {
    expect([upgradeSuffix('better'), upgradeSuffix('much-better'), upgradeSuffix('unsure'), upgradeSuffix(null)]).toEqual(['  ', '   ', '  ', ''])
  })

  it('draws arrows after the tooltip title only for upgrades', () => {
    expect(tooltipFor('much-better').strokes).toBe(4)
    expect(tooltipFor('better').strokes).toBe(2)
    expect(tooltipFor(null)).toMatchObject({ header: 'Cap', strokes: 0 })
  })

  it('lays badges out left to right with a gap before each', () => {
    const font = new D2FontRenderer()
    const badges = [{ kind: 'upgrade', verdict: 'much-better' }, { kind: 'sockets', count: 3 }, { kind: 'ethereal' }] as const
    expect(badgesWidth(badges, font)).toBe(4 + 6 + 17 + 6 + 19 + 6 + 8)
    expect(badgesWidth([], font)).toBe(0)
    const { ctx, strokes } = recordingCtx()
    drawBadges(ctx, font, badges, 0, 10)
    expect(strokes()).toBe(4 + 3 + 1)
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

