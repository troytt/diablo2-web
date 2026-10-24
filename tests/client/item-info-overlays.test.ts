import { describe, expect, it, vi } from 'vitest'
import type { D2FontRenderer } from '../../src/client/ui/font.ts'
import type { ItemInfoConfig } from '../../src/client/ui/ground-item-info.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { buildMonsterHoverSubtext, type MonsterTargetHudInfo } from '../../src/client/ui/panels/escape-monster-tooltip.ts'
import { WorldPanelsHud } from '../../src/client/ui/world-panels.ts'
import { onlineItemDataToUiInventoryItem } from '../../src/common/items/item-bridge.ts'
import type { ItemData } from '../../src/netproto/index.ts'

const mockCtx = () => ({ save: vi.fn(), restore: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), fillStyle: '' }) as unknown as CanvasRenderingContext2D
const mockFont = () => ({ drawText: vi.fn(), measureText: vi.fn((text: string) => text.length * 6) }) as unknown as D2FontRenderer & { drawText: ReturnType<typeof vi.fn> }

const tooltipLines = (item: ReturnType<typeof onlineItemDataToUiInventoryItem>, showItemLevel: boolean) => {
  const panels = Object.assign(new WorldPanelsHud(), { lang: 'ENG', showItemLevel })
  const font = mockFont()
  panels.drawItemTooltip(mockCtx(), { item, x: 200, y: 200 }, font)
  return font.drawText.mock.calls.map((call) => call[1] as string)
}

describe('item level in tooltips', () => {
  const sword = onlineItemDataToUiInventoryItem({ code: 'lsd', quality: 4, identified: true, ilvl: 38 })

  it('shows the item level only while switched on', () => {
    expect(tooltipLines(sword, true)).toContain('Item Level: 38')
    expect(tooltipLines(sword, false).some((line) => line.startsWith('Item Level'))).toBe(false)
  })

  it('skips simple items, which carry no item level on the wire', () => {
    const potion = onlineItemDataToUiInventoryItem({ code: 'hp5', quality: 2, identified: true, simple: true, compact: true })
    expect(tooltipLines(potion, true).some((line) => line.startsWith('Item Level'))).toBe(false)
  })
})

describe('monster resists under the health bar', () => {
  const monster: MonsterTargetHudInfo = {
    name: 'Fallen',
    hp: 10,
    maxHp: 10,
    rank: 'normal',
    resistances: { physical: 0, magic: 0, fire: 100, lightning: 25, cold: -20, poison: 0 },
  }

  it('keeps vanilla immunities only when switched off', () => {
    expect(buildMonsterHoverSubtext(monster, 'en').line2).toBe('Immune to Fire')
  })

  it('lists every non-zero resist in canonical order with immunities kept as labels', () => {
    const subtext = buildMonsterHoverSubtext(monster, 'en', true)
    expect(subtext.line2).toBe('Immune to Fire, Lightning 25%, Cold -20%')
    expect(subtext.line2Colored).toBe('ÿc1Immune to Fireÿc0, ÿc9Lightning 25%ÿc0, ÿc3Cold -20%')
    expect(buildMonsterHoverSubtext(monster, 'zh', true).line2).toContain('闪电 25%')
  })
})

describe('ground labels', () => {
  const config: ItemInfoConfig = { itemLevel: true, labelDetails: true, alwaysShow: false, lootFilter: 'off' }
  const wire = (fields: Record<string, unknown>) => ({ quality: 2, totalSockets: 0, ethereal: false, simple: false, ...fields }) as unknown as ItemData
  const ground: Record<number, ItemData> = {
    1: wire({ code: 'crs', ilvl: 26, totalSockets: 5, ethereal: true }),
    2: wire({ code: 'lsd', ilvl: 12 }),
    3: wire({ code: 'r08', simple: true }),
    4: wire({ code: 'hp2', simple: true }),
    5: wire({ code: 'lsd', ilvl: 30, quality: 4 }),
    6: wire({ code: 'gcv', simple: true }),
    7: wire({ code: 'leg', ilvl: 1 }),
    8: wire({ code: 'gld', simple: true }),
    9: wire({ code: 'cm1', ilvl: 40, quality: 4 }),
  }
  const hudWith = (patch: Partial<ItemInfoConfig>) => {
    const hud = new HudManager()
    hud.resolveGroundItem = (id) => ground[id]
    hud.setItemInfo({ ...config, ...patch })
    return hud
  }
  const hidden = (filter: ItemInfoConfig['lootFilter']) => Object.keys(ground).map(Number).filter((id) => hudWith({ lootFilter: filter }).hidesGroundItem(id))

  it('badges gear with sockets, ethereal and item level and skips simple items', () => {
    const hud = hudWith({})
    expect([1, 2, 3].map((id) => hud.groundLabelBadges(id))).toEqual([[{ kind: 'sockets', count: 5 }, { kind: 'ethereal' }, { kind: 'level', level: 26 }], [{ kind: 'level', level: 12 }], []])
    expect(hudWith({ labelDetails: false }).groundLabelBadges(1)).toEqual([])
  })

  it('hides junk, or everything but valuables, while keeping quest items, gold, runes and charms', () => {
    expect(hidden('off')).toEqual([])
    expect(hidden('junk')).toEqual([2, 4])
    expect(hidden('strict')).toEqual([2, 4, 5, 6])
  })

  it('keeps ground labels up without Alt while always-show is on', () => {
    const hud = hudWith({ alwaysShow: true })
    hud.showGroundLabels = false
    expect(hud.showGroundLabels).toBe(true)
    hud.setItemInfo(null)
    expect([hud.showGroundLabels, hud.worldPanels.showItemLevel]).toEqual([false, false])
    hud.showGroundLabels = true
    expect(hud.showGroundLabels).toBe(true)
  })
})
