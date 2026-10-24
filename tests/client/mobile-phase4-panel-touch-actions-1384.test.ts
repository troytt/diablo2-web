import { describe, expect, it, vi } from 'vitest'
import {
  allocateStatPointsBatch,
  buildTouchContextActions,
  computeTouchActionBarLayout,
  hitTestTouchActionBar,
  resolveEquippedComparisonCounterpart,
  type TouchSelectedPanelItem,
} from '../../src/client/ui/touch-controls.ts'
import { executeTouchContextAction } from '../../src/client/ui/hud-input-router.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import type { UiInventoryItem } from '../../src/client/ui/inventory.ts'
import type { BaseStatKey } from '../../src/client/ui/character-sheet.ts'

function createSampleHelm(id: string, nameZh: string): UiInventoryItem {
  return {
    id,
    code: 'uap',
    name: 'Shako',
    nameZh,
    baseNameZh: '军帽',
    invFile: 'invcap',
    quality: 'unique',
    identified: true,
    invWidth: 2,
    invHeight: 2,
    allowedSlots: ['helm'],
    stats: [{ text: '+2 所有技能' }, { text: '物理伤害减少 10%' }],
  }
}

function createSamplePotion(id: string): UiInventoryItem {
  return {
    id,
    code: 'hp5',
    name: 'Super Healing Potion',
    nameZh: '超级治疗药水',
    baseNameZh: '超级治疗药水',
    invFile: 'invpotr',
    quality: 'normal',
    identified: true,
    invWidth: 1,
    invHeight: 1,
    allowedSlots: [],
    stats: [{ text: '恢复 320 生命' }],
  }
}

function createMockHudCanvas(width = 800, height = 600): HTMLCanvasElement {
  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    style: {},
    getContext: () => ({
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      drawImage: vi.fn(),
      setLineDash: vi.fn(),
      measureText: (t: string) => ({ width: t.length * 8 }),
    }),
  } as unknown as HTMLCanvasElement
}

describe('Mobile Phase 4 (#1384): Panel Tap-to-Select, Equipped Comparison & Context Action Bar', () => {
  it('resolves currently equipped counterpart for side-by-side [已穿戴] vs [选中] comparison', () => {
    const equippedHelm = createSampleHelm('helm-eq', '粗野之冠 (已穿戴)')
    const selectedHelm = createSampleHelm('helm-bag', '谐角之冠军帽')

    const counterpart = resolveEquippedComparisonCounterpart(selectedHelm, {
      helm: equippedHelm,
    })
    expect(counterpart?.id).toBe('helm-eq')
    expect(counterpart?.nameZh).toBe('粗野之冠 (已穿戴)')

    // Non-equippable item has no counterpart
    expect(
      resolveEquippedComparisonCounterpart(createSamplePotion('pot-1'), { helm: equippedHelm }),
    ).toBeNull()
  })

  it('builds context-sensitive one-tap actions across Inventory, Stash, Cube, Vendor, and Mercenary panels', () => {
    const bagHelm: TouchSelectedPanelItem = {
      source: 'inv',
      item: createSampleHelm('h1', '军帽'),
      col: 0,
      row: 0,
      anchorX: 500,
      anchorY: 320,
    }

    // 1. In Inventory with Stash open -> [穿戴/替换], [存入箱子], [丢弃]
    const stashActions = buildTouchContextActions(bagHelm, {
      leftPanel: 'stash',
      rightPanel: 'inv',
    }).map((a) => a.action)
    expect(stashActions).toEqual(['equip', 'toStash', 'drop'])

    // 2. In Inventory with Cube open -> [穿戴/替换], [放入方块], [丢弃]
    const cubeActions = buildTouchContextActions(bagHelm, {
      leftPanel: 'cube',
      rightPanel: 'inv',
    }).map((a) => a.action)
    expect(cubeActions).toEqual(['equip', 'toCube', 'drop'])

    // 3. Potion in Inventory -> [使用/鉴定], [装入腰带], [丢弃]
    const bagPotion: TouchSelectedPanelItem = {
      source: 'inv',
      item: createSamplePotion('p1'),
      col: 2,
      row: 0,
      anchorX: 540,
      anchorY: 320,
    }
    const potActions = buildTouchContextActions(bagPotion, {
      leftPanel: 'none',
      rightPanel: 'inv',
    }).map((a) => a.action)
    expect(potActions).toEqual(['use', 'putBelt', 'drop'])

    // 4. Vendor item -> [购买] / [赌博购买]
    const vendorItem: TouchSelectedPanelItem = {
      source: 'vendor',
      item: createSampleHelm('v1', '商店军帽'),
      anchorX: 160,
      anchorY: 220,
    }
    expect(
      buildTouchContextActions(vendorItem, {
        leftPanel: 'vendor',
        rightPanel: 'inv',
        vendorMode: 'gamble',
      }),
    ).toEqual([{ action: 'buy', labelZh: '赌博购买', labelEn: 'Gamble' }])
  })

  it('computes non-overlapping action bar layout, hit-tests buttons, and executes zero-drag equip & belt actions', () => {
    const hud = new HudManager(createMockHudCanvas(800, 600))
    hud.touchControls.enabled = true
    hud.rightPanel = 'inv'

    const bagHelm = createSampleHelm('helm-1', '谐角之冠军帽')
    hud.inventory.gridItems.push({ item: bagHelm, col: 0, row: 0 })

    const selected: TouchSelectedPanelItem = {
      source: 'inv',
      item: bagHelm,
      col: 0,
      row: 0,
      anchorX: 460,
      anchorY: 340,
    }
    hud.touchControls.selectPanelItem(selected)

    const actions = buildTouchContextActions(selected, {
      leftPanel: 'none',
      rightPanel: 'inv',
    })
    const layout = computeTouchActionBarLayout(selected, actions, null, 800, 600)
    expect(layout.buttons.length).toBeGreaterThanOrEqual(2)

    const equipBtn = layout.buttons.find((b) => b.action === 'equip')!
    expect(hitTestTouchActionBar(equipBtn.x + 10, equipBtn.y + 10, layout)).toBe('equip')

    // Execute one-tap equip action: moves helm from bag to equipped.helm and clears selection
    expect(executeTouchContextAction(hud, 'equip')).toBe(true)
    expect(hud.inventory.equipped.helm?.id).toBe('helm-1')
    expect(hud.inventory.gridItems).toHaveLength(0)
    expect(hud.touchControls.selectedPanelItem).toBeNull()

    // Execute one-tap putBelt action on a potion
    const pot = createSamplePotion('pot-99')
    hud.inventory.gridItems.push({ item: pot, col: 1, row: 0 })
    hud.touchControls.selectPanelItem({
      source: 'inv',
      item: pot,
      col: 1,
      row: 0,
      anchorX: 490,
      anchorY: 340,
    })
    expect(executeTouchContextAction(hud, 'putBelt')).toBe(true)
    expect(hud.belt.getSlot(0, 0)?.id).toBe('pot-99')
    expect(hud.inventory.gridItems).toHaveLength(0)
  })

  it('allocates +1 or +5 stat points in a single batch tap (clamped to unspent stat points)', () => {
    const allocated: BaseStatKey[] = []
    const count5 = allocateStatPointsBatch('vit', 5, 12, (s) => allocated.push(s))
    expect(count5).toBe(5)
    expect(allocated).toEqual(['vit', 'vit', 'vit', 'vit', 'vit'])

    const clamped = allocateStatPointsBatch('str', 5, 3, (s) => allocated.push(s))
    expect(clamped).toBe(3)
    expect(allocated).toHaveLength(8)
  })
})
