/**
 * Unit & Parity Tests for Diablo II v1.13c Tome / Scroll of Town Portal & Town Portal Lifecycle (Issue #394).
 */

import { describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  TownPortalSlot,
} from '../src/common/world/portal.ts'
import { InventoryPanel, INV_GRID_ORIGIN, getTomeQuantity, withTomeQuantity } from '../src/client/ui/inventory.ts'
import { createStarterBagForClass } from '../src/common/units/class-starter-profiles.ts'
import { OVERLAY_METAS } from '../src/client/render/overlays-meta.ts'
import type { AtlasFrame } from '../src/client/render/atlas.ts'
import type { AtlasHandle, DrawOptions, SpriteRenderer } from '../src/client/render/renderer.ts'
import type { LoadedOverlayArt } from '../src/client/scene/missile-overlay-renderer.ts'
import {
  clearMissingArtEntries,
  drawSceneUnitDrawable,
  type SceneSourceRenderContext,
} from '../src/client/scene/world-renderer.ts'
import type { SceneUnitDrawable } from '../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { createDemoInventory } from './fixtures/hud-demo-state.ts'
import { DEMO_BAG_ITEMS } from './fixtures/demo-profile-data.ts'

describe('Issue #394: Diablo II v1.13c Town Portal & Tome/Scroll of Town Portal', () => {

  it('manages TownPortalSlot two-way lifecycle (wilderness -> town keeps portal open; town -> wilderness closes portal per ObjMode.cpp:3245)', () => {
    const slot = new TownPortalSlot()
    expect(slot.current()).toBeNull()
    expect(slot.mouthInLevel(2)).toBeNull()
    expect(slot.mouthInLevel(1)).toBeNull()

    slot.cast({
      fromLevelId: 2,
      fromX: 80,
      fromY: 95,
      townLevelId: 1,
      townX: 153,
      townY: 158,
      createdAtMs: 1234,
    })

    // Both wilderness (2) and town (1) mouths are visible
    expect(slot.mouthInLevel(2)).toEqual({
      x: 80,
      y: 95,
      toLevelId: 1,
      isTownMouth: false,
      createdAtMs: 1234,
    })
    expect(slot.mouthInLevel(1)).toEqual({
      x: 153,
      y: 158,
      toLevelId: 2,
      isTownMouth: true,
      createdAtMs: 1234,
    })
    expect(slot.mouthInLevel(3)).toBeNull()

    // 1. Entering from wilderness (level 2) transports to town (level 1) and keeps the portal open
    const toTown = slot.enterFrom(2)
    expect(toTown).toEqual({ levelId: 1, x: 153, y: 158 })
    expect(slot.current()).not.toBeNull()
    expect(slot.mouthInLevel(1)).not.toBeNull()

    // 2. Entering from town (level 1) transports back to wilderness (level 2) and closes the portal
    const backToField = slot.enterFrom(1)
    expect(backToField).toEqual({ levelId: 2, x: 80, y: 95 })
    expect(slot.current()).toBeNull()
    expect(slot.mouthInLevel(1)).toBeNull()
    expect(slot.mouthInLevel(2)).toBeNull()
  })

  it('initializes starter Tome of Town Portal (tbk) and Tome of Identify (ibk) with 20 charges across all classes', () => {
    const starterTbk = DEMO_BAG_ITEMS.find(p => p.item.code === 'tbk')
    const starterIbk = DEMO_BAG_ITEMS.find(p => p.item.code === 'ibk')
    expect(starterTbk?.item.quantity).toBe(20)
    expect(starterIbk?.item.quantity).toBe(20)
    expect(getTomeQuantity(starterTbk!.item)).toBe(20)

    for (const cls of ['sor', 'nec', 'pal', 'bar', 'ama', 'dru', 'ass'] as const) {
      const bag = createStarterBagForClass(cls)
      const tbk = bag.find(p => p.item.code === 'tbk')
      const ibk = bag.find(p => p.item.code === 'ibk')
      expect(tbk?.item.quantity).toBe(20)
      expect(ibk?.item.quantity).toBe(20)
    }
  })

  it('handles right-clicking tbk / tsc to cast Town Portal and left-clicking tsc onto tbk to refill charges', () => {
    const inv = createDemoInventory() // seeded starter bag (tbk / tsc)
    inv.visible = true
    const tbkPlacement = inv.gridItems.find(p => p.item.code === 'tbk')!
    expect(tbkPlacement).toBeDefined()
    expect(getTomeQuantity(tbkPlacement.item)).toBe(20)

    // Compute pixel coordinates inside the tbk cell at (col=6, row=2)
    const tbkClickX = INV_GRID_ORIGIN.x + tbkPlacement.col * INV_GRID_ORIGIN.cellPx + 10
    const tbkClickY = INV_GRID_ORIGIN.y + tbkPlacement.row * INV_GRID_ORIGIN.cellPx + 10

    // 1. Right-click tbk in town (onCastTownPortal returns false) -> does NOT decrement quantity
    const castBlocked = vi.fn(() => false)
    expect(
      inv.handleClick(
        tbkClickX,
        tbkClickY,
        { onOpenCube: () => {}, onCastTownPortal: castBlocked },
        2,
      ),
    ).toBe(true)
    expect(castBlocked).toHaveBeenCalledTimes(1)
    expect(getTomeQuantity(inv.gridItems.find(p => p.item.code === 'tbk')!.item)).toBe(20)

    // 2. Right-click tbk in wilderness (onCastTownPortal returns true) -> decrements quantity from 20 to 19
    const castOk = vi.fn(() => true)
    expect(
      inv.handleClick(
        tbkClickX,
        tbkClickY,
        { onOpenCube: () => {}, onCastTownPortal: castOk },
        2,
      ),
    ).toBe(true)
    expect(castOk).toHaveBeenCalledWith('tbk', expect.objectContaining({ code: 'tbk' }))
    expect(getTomeQuantity(inv.gridItems.find(p => p.item.code === 'tbk')!.item)).toBe(19)

    // 3. Left-click a Scroll of Town Portal (tsc) onto tbk -> refills quantity from 19 back to 20
    inv.cursorItem = {
      id: 'scroll_tp_1',
      code: 'tsc',
      name: 'Scroll of Town Portal',
      nameZh: '回城卷轴',
      baseNameZh: '回城卷轴',
      quality: 'normal',
      invFile: 'invscrl',
      invWidth: 1,
      invHeight: 1,
      allowedSlots: [],
      stats: [],
    }
    expect(inv.clickGridCell(tbkPlacement.col, tbkPlacement.row)).toBe(true)
    expect(inv.cursorItem).toBeNull()
    expect(getTomeQuantity(inv.gridItems.find(p => p.item.code === 'tbk')!.item)).toBe(20)

    // 4. Place a standalone Scroll of Town Portal (tsc) into free cell (7, 0) and right-click it
    inv.gridItems.push({
      col: 7,
      row: 0,
      item: {
        id: 'scroll_tp_2',
        code: 'tsc',
        name: 'Scroll of Town Portal',
        nameZh: '回城卷轴',
        baseNameZh: '回城卷轴',
        quality: 'normal',
        invFile: 'invscrl',
        invWidth: 1,
        invHeight: 1,
        allowedSlots: [],
        stats: [],
      },
    })
    const tscClickX = INV_GRID_ORIGIN.x + 7 * INV_GRID_ORIGIN.cellPx + 10
    const tscClickY = INV_GRID_ORIGIN.y + 0 * INV_GRID_ORIGIN.cellPx + 10

    // Right-click tsc when blocked (in town) -> scroll stays in inventory
    expect(
      inv.handleClick(
        tscClickX,
        tscClickY,
        { onOpenCube: () => {}, onCastTownPortal: () => false },
        2,
      ),
    ).toBe(true)
    expect(inv.gridItems.some(p => p.item.id === 'scroll_tp_2')).toBe(true)

    // Right-click tsc in wilderness -> scroll is consumed and removed from inventory
    expect(
      inv.handleClick(
        tscClickX,
        tscClickY,
        { onOpenCube: () => {}, onCastTownPortal: () => true },
        2,
      ),
    ).toBe(true)
    expect(inv.gridItems.some(p => p.item.id === 'scroll_tp_2')).toBe(false)

    // 5. Empty tome (0 charges) cannot cast Town Portal, but stays in inventory
    const tbkIdx = inv.gridItems.findIndex(p => p.item.code === 'tbk')
    inv.gridItems[tbkIdx] = {
      ...inv.gridItems[tbkIdx]!,
      item: withTomeQuantity(inv.gridItems[tbkIdx]!.item, 0),
    }
    const castWhenEmpty = vi.fn(() => true)
    expect(
      inv.handleClick(
        tbkClickX,
        tbkClickY,
        { onOpenCube: () => {}, onCastTownPortal: castWhenEmpty },
        2,
      ),
    ).toBe(false)
    expect(castWhenEmpty).not.toHaveBeenCalled()
    expect(inv.gridItems.some(p => p.item.code === 'tbk')).toBe(true)
  })

  it('bakes authentic Town Portal DCC overlays (OP 15-frame opening + ON 15-frame loop, TR + HD layers)', () => {
    for (const key of ['town_portal_op_tr', 'town_portal_op_hd', 'town_portal_on_tr', 'town_portal_on_hd'] as const) {
      const meta = OVERLAY_METAS[key]
      expect(meta, `Missing OVERLAY_METAS[${key}]`).toBeDefined()
      expect(meta!.framesPerDirection).toBe(15)
      expect(existsSync(join(process.cwd(), 'public', 'overlays', `${key}.png`))).toBe(true)
      expect(existsSync(join(process.cwd(), 'public', 'overlays', `${key}.json`))).toBe(true)
    }
    expect(OVERLAY_METAS.town_portal_op_tr!.trans).toBe(0)
    expect(OVERLAY_METAS.town_portal_op_hd!.trans).toBe(3)
    expect(OVERLAY_METAS.town_portal_on_tr!.trans).toBe(0)
    expect(OVERLAY_METAS.town_portal_on_hd!.trans).toBe(3)
  })

  it('plays the 15-frame Town Portal opening animation (OP) only once across the 1 -> 2 mode transition and loops ON immediately when spawned in mode 2', () => {
    clearMissingArtEntries()
    const opFrames = new Set<AtlasFrame>()
    const onFrames = new Set<AtlasFrame>()
    const makeOverlay = (key: string, yBase: number, bucket: Set<AtlasFrame>): LoadedOverlayArt => {
      const frames: AtlasFrame[] = Array.from({ length: 15 }, (_, idx) => {
        const f: AtlasFrame = {
          x: idx * 100,
          y: yBase,
          width: 96,
          height: 128,
          anchorX: -48,
          anchorY: -96,
        }
        bucket.add(f)
        return f
      })
      return {
        handle: { texture: { key }, width: 1500, height: 256 } as unknown as AtlasHandle,
        frames: [frames],
        meta: {
          filename: key,
          frames: 15,
          animRate: 8,
          trans: key.endsWith('_hd') ? 3 : 0,
        } as any,
      }
    }
    const overlayArtMap = new Map<string, LoadedOverlayArt>([
      ['town_portal_op_tr', makeOverlay('town_portal_op_tr', 10000, opFrames)],
      ['town_portal_op_hd', makeOverlay('town_portal_op_hd', 11000, opFrames)],
      ['town_portal_on_tr', makeOverlay('town_portal_on_tr', 12000, onFrames)],
      ['town_portal_on_hd', makeOverlay('town_portal_on_hd', 13000, onFrames)],
    ])
    const ctx: SceneSourceRenderContext = {
      source: {} as any,
      lightingPreset: 'auto',
      overlayArtMap,
    }
    const makeDrawable = (unitId: number, mode: number, animStartedAtMs?: number): SceneUnitDrawable => ({
      drawableKind: 'unit',
      unitKind: 'object',
      id: unitId,
      unitId,
      classId: 59,
      token: 'TP',
      mode,
      direction: 0,
      frame: 0,
      subX: 150,
      subY: 110,
      worldX: 400,
      worldY: 300,
      sortY: 300,
      blendMode: 'normal',
      lifePct: 128,
      name: 'Town Portal',
      isHovered: false,
      isCorpse: false,
      tintColor: null,
      overlays: [],
      ...(animStartedAtMs !== undefined ? { animStartedAtMs } : {}),
    })
    const sampleDraws = (drawable: SceneUnitDrawable, nowMs: number) => {
      const drawCalls: Array<{ frame: AtlasFrame; options: DrawOptions }> = []
      const renderer = {
        draw: vi.fn((frame: AtlasFrame, _x: number, _y: number, options: DrawOptions = {}) => {
          drawCalls.push({ frame, options })
        }),
        setBlendMode: vi.fn(),
      } as unknown as SpriteRenderer
      drawSceneUnitDrawable(renderer, drawable, ctx, nowMs, 1)
      return drawCalls
    }

    // 1. Wilderness portal spawned in mode = 1 (OP) and ticked through 25Hz ClientWorld simulation
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId: 2 })
    world.apply(
      {
        type: 'UnitAssign',
        unit: { unitType: 2, id: 590, classId: 59, name: 'Town Portal', x: 150, y: 110, mode: 1 },
      },
      1000,
    )
    const tp = world.getUnit('object', 590)!
    expect(tp.mode).toBe(1)
    expect(tp.animStartedAtMs).toBe(1000)

    let transitionedToOn = false
    let sawOnFrames = false
    for (let step = 0; step <= 40; step++) {
      const nowMs = 1000 + step * 40
      if (step > 0) {
        world.tick(40, nowMs)
      }
      if (tp.mode === 2) {
        transitionedToOn = true
      }
      const calls = sampleDraws(makeDrawable(tp.id, tp.mode, tp.animStartedAtMs), nowMs)
      expect(calls).toHaveLength(2)
      const isOp = opFrames.has(calls[0]!.frame) && opFrames.has(calls[1]!.frame)
      const isOn = onFrames.has(calls[0]!.frame) && onFrames.has(calls[1]!.frame)
      expect(isOp || isOn).toBe(true)

      if (nowMs - 1000 < 768) {
        expect(isOp, `expected OP before 768ms at elapsed=${nowMs - 1000}ms (mode=${tp.mode})`).toBe(true)
      } else {
        // Once the 768ms OP sequence finishes, it must stay in ON and NEVER replay OP even after mode 1 -> 2 resets animStartedAtMs
        expect(isOn, `expected ON at/after 768ms at elapsed=${nowMs - 1000}ms (mode=${tp.mode})`).toBe(true)
        sawOnFrames = true
      }
    }
    expect(transitionedToOn).toBe(true)
    expect(sawOnFrames).toBe(true)

    // 2. Town link portal spawned directly in mode = 2 (ON) immediately loops ON and never plays OP
    const townCallsAtZero = sampleDraws(makeDrawable(591, 2, 2000), 2000)
    expect(townCallsAtZero).toHaveLength(2)
    expect(onFrames.has(townCallsAtZero[0]!.frame)).toBe(true)
    expect(onFrames.has(townCallsAtZero[1]!.frame)).toBe(true)
  })
})
