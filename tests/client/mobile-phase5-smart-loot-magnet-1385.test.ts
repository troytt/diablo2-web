import { describe, expect, it, vi } from 'vitest'
import {
  TOUCH_GROUND_LABEL_MIN_HEIGHT,
  buildFootLootQueue,
  collectAutoPickupCandidates,
  computeCompactD2rHudMetrics,
  hitTestTouchGroundLabels,
  layoutTouchGroundLabels,
  resolveLootPriorityTier,
  type GroundLootCandidateInput,
} from '../../src/client/ui/touch-controls.ts'
import { handleCompactD2rHudClick } from '../../src/client/ui/hud-input-router.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { sanitizeClientSettings } from '../../src/client/settings/client-settings.ts'

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

describe('Mobile Phase 5 (#1385): Spring-Repulsion Ground Label Magnet & Sequential Loot Pickup', () => {
  it('separates overlapping ground item labels with spring repulsion and enforces >= 28px touch height', () => {
    const denseDropPile: GroundLootCandidateInput[] = [
      { id: 1, code: 'gld', label: '1250 金币', quality: 'normal', screenX: 400, screenY: 320 },
      { id: 2, code: 'hp5', label: '超级治疗药剂', quality: 'normal', screenX: 402, screenY: 320 },
      { id: 3, code: 'uap', label: '谐角之冠军帽', quality: 'unique', screenX: 398, screenY: 320 },
      { id: 4, code: 'r30', label: '贝 (Ber) 符文', quality: 'unique', screenX: 400, screenY: 320 },
    ]

    const boxes = layoutTouchGroundLabels(denseDropPile, 800, 600)
    expect(boxes).toHaveLength(4)
    for (const box of boxes) {
      expect(box.boxHeight).toBeGreaterThanOrEqual(TOUCH_GROUND_LABEL_MIN_HEIGHT)
      // True world anchor coordinate is preserved for leader line rendering
      expect(box.anchorY).toBe(320)
    }

    // Verify no pair of boxes overlaps vertically
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!
        const b = boxes[j]!
        const verticalOverlap =
          a.boxY < b.boxY + b.boxHeight && a.boxY + a.boxHeight > b.boxY
        expect(verticalOverlap).toBe(false)
      }
    }

    // Hit-test each displaced label box accurately
    for (const box of boxes) {
      const hit = hitTestTouchGroundLabels(box.boxX + 10, box.boxY + 10, boxes)
      expect(hit?.id).toBe(box.id)
    }
  })

  it('orders foot-proximity loot queue by quality tier (Unique/High Rune > Rare > Magic > Potion > Gold) and pops sequentially on [拾取 A]', () => {
    expect(resolveLootPriorityTier({ code: 'r31', quality: 'normal' })).toBe(6)
    expect(resolveLootPriorityTier({ code: 'uap', quality: 'unique' })).toBe(6)
    expect(resolveLootPriorityTier({ code: 'rin', quality: 'rare' })).toBe(5)
    expect(resolveLootPriorityTier({ code: 'cm1', quality: 'magic' })).toBe(4)
    expect(resolveLootPriorityTier({ code: 'hp5', quality: 'normal' })).toBe(2)
    expect(resolveLootPriorityTier({ code: 'gld', quality: 'normal' })).toBe(1)

    const groundItems: GroundLootCandidateInput[] = [
      { id: 10, code: 'gld', label: '500 金币', quality: 'normal', screenX: 405, screenY: 302 },
      { id: 11, code: 'hp5', label: '超级治疗药剂', quality: 'normal', screenX: 410, screenY: 305 },
      { id: 12, code: 'rin', label: '亮金戒指', quality: 'rare', screenX: 420, screenY: 310 },
      { id: 13, code: 'uap', label: '谐角之冠军帽', quality: 'unique', screenX: 430, screenY: 315 },
      { id: 99, code: 'uap', label: '远处暗金', quality: 'unique', screenX: 720, screenY: 540 },
    ]

    const queue = buildFootLootQueue(400, 300, groundItems)
    expect(queue.map((q) => q.id)).toEqual([13, 12, 11, 10])

    // Tapping [拾取 A] button on the Compact D2R HUD pops items in priority order (13 -> 12 -> 11 -> 10)
    const hud = new HudManager(createMockHudCanvas(800, 600))
    hud.touchControls.enabled = true
    hud.touchControls.hudLayoutMode = 'compact-d2r'
    hud.touchControls.updateFootLootQueue(400, 300, groundItems)

    const pickedIds: number[] = []
    ;(hud as any).onTouchLootInteract = (id: number) => pickedIds.push(id)

    const m = computeCompactD2rHudMetrics(800, 600)
    handleCompactD2rHudClick(hud, m.lootBtn.cx, m.lootBtn.cy)
    handleCompactD2rHudClick(hud, m.lootBtn.cx, m.lootBtn.cy)
    handleCompactD2rHudClick(hud, m.lootBtn.cx, m.lootBtn.cy)
    handleCompactD2rHudClick(hud, m.lootBtn.cx, m.lootBtn.cy)

    expect(pickedIds).toEqual([13, 12, 11, 10])
  })

  it('collects walk-over auto-pickup gold and beltable potions when mobileAutoPickupGoldAndPotions is enabled', () => {
    const settings = sanitizeClientSettings({ mobileAutoPickupGoldAndPotions: true })
    expect(settings.mobileAutoPickupGoldAndPotions).toBe(true)

    const nearbyItems: GroundLootCandidateInput[] = [
      { id: 1, code: 'gld', label: '800 金币', screenX: 412, screenY: 308 },
      { id: 2, code: 'rvl', label: '全面回复活力药剂', screenX: 418, screenY: 310 },
      { id: 3, code: 'uap', label: '暗金军帽', quality: 'unique', screenX: 410, screenY: 305 },
      { id: 4, code: 'gld', label: '远处金币', screenX: 520, screenY: 420 },
    ]

    // With beltHasSpace = true: picks up nearby gold (1) and potion (2), never equipment (3) or far gold (4)
    const pickedWithBeltSpace = collectAutoPickupCandidates(400, 300, nearbyItems, {
      enabled: true,
      beltHasSpace: true,
    })
    expect(pickedWithBeltSpace.map((i) => i.id)).toEqual([1, 2])

    // With beltHasSpace = false: picks up only nearby gold (1)
    const pickedFullBelt = collectAutoPickupCandidates(400, 300, nearbyItems, {
      enabled: true,
      beltHasSpace: false,
    })
    expect(pickedFullBelt.map((i) => i.id)).toEqual([1])
  })
})
