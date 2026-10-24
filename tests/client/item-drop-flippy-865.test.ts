/**
 * Issue #865 — 1.13c Parity:
 * - S2C 0x9C (`WorldItemAction` / `ItemEvent`) Drop/Flippy Modes (`5 -> 3`):
 *   - `action = 0x02` (`DropToGround`) -> `mode = 5` (`ITEMMODE_DROPPING`)
 *   - `action = 0x00` (`AddToGround`) with `IFLAG_NEWITEM = 0x2000` -> `mode = 5`, else `mode = 3` (`ITEMMODE_ON_GROUND`)
 *   - `action = 0x03` (`OnGround` room reveal) -> `mode = 3` (static, no flippy/drop SFX)
 *   (`D2Client.dll` `0x6fb34bb0`, `0x6fb34990`, `0x6fb36810`)
 * - 25fps (`40ms`/frame) flippy progression and `5 -> 3` expiry in `expireCastStates` (`D2Client.dll` `0x6fb327c0`)
 * - Immediate `item_flippy` (`soundId = 2`) and scheduled `dropSound` at `dropSfxFrame * 40ms` (`D2Client.dll` `0x6fb3286a`)
 * - 4-Tier Gold Pile Flippy DC6 (`flpgld_0..3` at `< 100`, `100..499`, `500..4999`, `>= 5000`) (`D2Game.dll` `0x6fcad3d0`)
 * - Custom unique/set `flippyFile` and `invtransform` dyed flippy DC6 resolution in `mode === 5`
 * - Non-targetability (`isSelectableCandidate`) and ground hover/Alt label suppression while `mode === 5` (`D2Client.dll` `0x6fb32820`, `0x6fb328a5`)
 * - `OnlineSession` `buildRenderableUnits` (`animStartedAtMs`, `flippyFile`, `invFile`, `invtransform`) and `tick()` sound draining
 */
import { describe, expect, it, vi } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  getGoldFlippyKey,
  getGoldFlippyRect,
  resolveGroundItemFlippyKey,
  resolveGroundItemSpriteRect,
} from '../../src/client/ui/inventory.ts'
import { BAKED_UI_MANIFEST } from '../../src/common/items/baked-ui-meta.ts'
import {
  drawSceneUnitDrawable,
  renderSceneSourceFrame,
  type SceneSourceRenderContext,
} from '../../src/client/scene/world-renderer.ts'
import { buildSceneDrawables, type SceneUnitDrawable } from '../../src/client/view/unit-drawables.ts'
import type { AtlasFrame } from '../../src/client/render/atlas.ts'
import type { AtlasHandle, SpriteRenderer } from '../../src/client/render/renderer.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

function createMockSpriteRenderer() {
  const drawnFrames: AtlasFrame[] = []
  const drawnCalls: { frame: AtlasFrame; x: number; y: number }[] = []
  const renderer = {
    addAtlas: vi.fn(() => 1 as unknown as AtlasHandle),
    addIndexedAtlas: vi.fn(() => 1 as unknown as AtlasHandle),
    draw: vi.fn((frame: AtlasFrame, x: number, y: number) => {
      drawnFrames.push(frame)
      drawnCalls.push({ frame, x, y })
    }),
    setBlendMode: vi.fn(),
    flush: vi.fn(),
  } as unknown as SpriteRenderer
  return { renderer, drawnFrames, drawnCalls }
}

function makeItemDrawable(
  overrides: Partial<SceneUnitDrawable> & { unitId: number; code: string; mode: number },
): SceneUnitDrawable {
  return {
    drawableKind: 'unit',
    unitKind: 'item',
    id: overrides.unitId,
    unitId: overrides.unitId,
    classId: overrides.classId ?? 0,
    token: overrides.token ?? overrides.code,
    code: overrides.code,
    itemCode: overrides.code,
    mode: overrides.mode,
    direction: 0,
    frame: overrides.frame ?? 0,
    subX: overrides.subX ?? 5000,
    subY: overrides.subY ?? 5000,
    worldX: overrides.worldX ?? 0,
    worldY: overrides.worldY ?? 0,
    sortY: overrides.sortY ?? 0,
    blendMode: 'normal',
    lifePct: 128,
    name: overrides.name ?? overrides.code,
    isHovered: overrides.isHovered ?? false,
    isCorpse: false,
    tintColor: null,
    overlays: [],
    ...(overrides.goldAmount !== undefined ? { goldAmount: overrides.goldAmount } : {}),
    ...(overrides.animStartedAtMs !== undefined ? { animStartedAtMs: overrides.animStartedAtMs } : {}),
    ...(overrides.flippyFile !== undefined ? { flippyFile: overrides.flippyFile } : {}),
    ...(overrides.invFile !== undefined ? { invFile: overrides.invFile } : {}),
    ...(overrides.invtransform !== undefined ? { invtransform: overrides.invtransform } : {}),
  }
}

describe('Issue #865: S2C 0x9C WorldItemAction Drop/Flippy Modes (5 -> 3) & flpgld_0..3 Gold Tiers', () => {
  describe('1. S2C 0x9C WorldItemAction Action-to-Mode Mapping (D2Client.dll 0x6fb34bb0 / 0x6fb34990 / 0x6fb36810)', () => {
    it('action 0x02 (DropToGround) enters mode 5 and transitions 5 -> 3 on expiry', () => {
      const world = new ClientWorld()
      const startMs = 10_000
      const ssdFlippyFrames = BAKED_UI_MANIFEST.flippyFrames['flpssd']
      expect(ssdFlippyFrames).toBeDefined()
      const frameCount = ssdFlippyFrames!.length

      world.apply(
        {
          type: 'WorldItemAction',
          action: 0x02,
          container: 'ground',
          item: {
            id: 501,
            code: 'ssd',
            quality: 2,
            x: 5004,
            y: 5002,
            worldX: 5004,
            worldY: 5002,
          },
        } as any,
        startMs,
      )

      const itemUnit = world.getUnit('item', 501)
      expect(itemUnit).toBeDefined()
      expect(itemUnit!.mode).toBe(5)
      expect(itemUnit!.animStartedAtMs).toBe(startMs)
      expect(itemUnit!.modeUntilMs).toBe(startMs + frameCount * 40)

      // Before modeUntilMs: still mode 5
      world.expireCastStates(startMs + frameCount * 40 - 1)
      expect(itemUnit!.mode).toBe(5)

      // At modeUntilMs: transitions mode 5 -> 3 (ITEMMODE_ON_GROUND) and clears dropping timers
      world.expireCastStates(startMs + frameCount * 40)
      expect(itemUnit!.mode).toBe(3)
      expect(itemUnit!.animStartedAtMs).toBeUndefined()
      expect(itemUnit!.modeUntilMs).toBeUndefined()
    })

    it('action 0x00 (AddToGround) with IFLAG_NEWITEM (0x2000) enters mode 5 with flippy', () => {
      const world = new ClientWorld()
      const startMs = 20_000
      const gldFrames = BAKED_UI_MANIFEST.flippyFrames['flpgld_2']!

      world.apply(
        {
          type: 'ItemEvent',
          action: 0x00,
          container: 'ground',
          item: {
            id: 601,
            code: 'gld',
            goldAmount: 1200,
            rawFlags: 0x2000, // IFLAG_NEWITEM
            x: 5010,
            y: 5010,
          },
        } as any,
        startMs,
      )

      const unit = world.getUnit('item', 601)
      expect(unit).toBeDefined()
      expect(unit!.mode).toBe(5)
      expect(unit!.animStartedAtMs).toBe(startMs)
      expect(unit!.modeUntilMs).toBe(startMs + gldFrames.length * 40)

      // At end of flippy (17 * 40ms = 680ms): transitions to mode 3
      world.expireCastStates(startMs + gldFrames.length * 40)
      expect(unit!.mode).toBe(3)
    })

    it('action 0x00 without IFLAG_NEWITEM and action 0x03 (OnGround room reveal) enter mode 3 directly with NO flippy', () => {
      const world = new ClientWorld()
      const startMs = 30_000

      // Action 0x00 without 0x2000
      world.apply(
        {
          type: 'ItemEvent',
          action: 0x00,
          container: 'ground',
          item: {
            id: 701,
            code: 'cap',
            rawFlags: 0x0010, // identified, but NOT IFLAG_NEWITEM (0x2000)
            x: 5002,
            y: 5002,
          },
        } as any,
        startMs,
      )

      // Action 0x03 (OnGround static room reveal)
      world.apply(
        {
          type: 'WorldItemAction',
          action: 0x03,
          container: 'ground',
          item: {
            id: 702,
            code: 'gld',
            goldAmount: 5500,
            rawFlags: 0x2000, // Even if flags carry 0x2000, action 0x03 is static OnGround
            x: 5006,
            y: 5006,
          },
        } as any,
        startMs,
      )

      const u701 = world.getUnit('item', 701)
      const u702 = world.getUnit('item', 702)
      expect(u701?.mode).toBe(3)
      expect(u701?.animStartedAtMs).toBeUndefined()
      expect(u701?.modeUntilMs).toBeUndefined()

      expect(u702?.mode).toBe(3)
      expect(u702?.animStartedAtMs).toBeUndefined()
      expect(u702?.modeUntilMs).toBeUndefined()

      world.expireCastStates(startMs + 2000)
    })
  })

  describe('2. 4-Tier Gold Pile Flippy Resolution (flpgld_0..3) & Animated Mode 5 Frame Progression (D2Game.dll 0x6fcad3d0)', () => {
    it('unifies 4-tier gold thresholds (<100, 100..499, 500..4999, >=5000) across getGoldFlippyKey, getGoldFlippyRect, resolveGroundItemFlippyKey, and resolveGroundItemSpriteRect', () => {
      const tierCases = [
        { amounts: [1, 50, 99], expectedKey: 'flpgld_0', w: 24, h: 7 },
        { amounts: [100, 250, 499], expectedKey: 'flpgld_1', w: 26, h: 13 },
        { amounts: [500, 1500, 4999], expectedKey: 'flpgld_2', w: 32, h: 20 },
        { amounts: [5000, 10000, 50000], expectedKey: 'flpgld_3', w: 46, h: 23 },
      ] as const

      for (const tier of tierCases) {
        for (const amt of tier.amounts) {
          expect(getGoldFlippyKey(amt)).toBe(tier.expectedKey)
          expect(
            resolveGroundItemFlippyKey(
              { isGold: true, amount: amt, code: 'gld' },
              BAKED_UI_MANIFEST.flippyFrames,
              BAKED_UI_MANIFEST.codeToFlippyFile,
            ),
          ).toBe(tier.expectedKey)

          const rect = getGoldFlippyRect(amt, BAKED_UI_MANIFEST.flippyRects)
          expect(rect).toEqual(BAKED_UI_MANIFEST.flippyRects[tier.expectedKey])
          expect(rect?.w).toBe(tier.w)
          expect(rect?.h).toBe(tier.h)

          const spriteRect = resolveGroundItemSpriteRect({ isGold: true, amount: amt, code: 'gld' })
          expect(spriteRect).toEqual(BAKED_UI_MANIFEST.flippyRects[tier.expectedKey])
        }
      }
    })

    it('drawSceneUnitDrawable advances mode 5 flippy frames at 25fps (40ms/frame) from animStartedAtMs for all 4 gold tiers and renders resting rect in mode 3', () => {
      const tiers = [
        { amount: 50, key: 'flpgld_0' },
        { amount: 250, key: 'flpgld_1' },
        { amount: 1500, key: 'flpgld_2' },
        { amount: 10000, key: 'flpgld_3' },
      ] as const

      for (const { amount, key } of tiers) {
        const expectedFrames = BAKED_UI_MANIFEST.flippyFrames[key]!
        expect(expectedFrames.length).toBe(17)
        const startMs = 5_000
        const { renderer, drawnFrames } = createMockSpriteRenderer()
        const ctx = {
          itemsAtlasHandle: 99 as unknown as AtlasHandle,
        } as unknown as SceneSourceRenderContext

        const droppingUnit = makeItemDrawable({
          unitId: 800 + amount,
          code: 'gld',
          mode: 5,
          goldAmount: amount,
          animStartedAtMs: startMs,
        })

        // Verify frame 0, frame 8 (mid-air), and frame 16 (final flippy frame) at 40ms steps
        for (const frameIdx of [0, 8, 16]) {
          drawnFrames.length = 0
          drawSceneUnitDrawable(renderer, droppingUnit, ctx, startMs + frameIdx * 40, 0)
          expect(drawnFrames).toHaveLength(1)
          const expectedSr = expectedFrames[frameIdx]!
          expect(drawnFrames[0]).toEqual({
            x: expectedSr.x,
            y: expectedSr.y,
            width: expectedSr.w,
            height: expectedSr.h,
          })
        }

        // Verify resting mode 3 uses resting flippyRects[key]
        drawnFrames.length = 0
        const restingUnit = makeItemDrawable({
          unitId: 800 + amount,
          code: 'gld',
          mode: 3,
          goldAmount: amount,
        })
        drawSceneUnitDrawable(renderer, restingUnit, ctx, startMs + 1000, 0)
        const restingSr = BAKED_UI_MANIFEST.flippyRects[key]!
        expect(drawnFrames[0]).toEqual({
          x: restingSr.x,
          y: restingSr.y,
          width: restingSr.w,
          height: restingSr.h,
        })
      }
    })

    it('drawSceneUnitDrawable resolves unique/set custom flippyFile and invtransform dyed flippy frames during mode 5', () => {
      const { renderer, drawnFrames } = createMockSpriteRenderer()
      const ctx = {
        itemsAtlasHandle: 99 as unknown as AtlasHandle,
      } as unknown as SceneSourceRenderContext
      const startMs = 8_000

      // 1. Dyed Harlequin Crest (invFile = invcap, invtransform = cgrn -> flpcap_cgrn)
      const dyedFrames = BAKED_UI_MANIFEST.flippyFrames['flpcap_cgrn']!
      expect(dyedFrames).toBeDefined()
      const shakoDrawables = buildSceneDrawables([
        {
          id: 901,
          kind: 'item',
          classId: 0,
          code: 'uap',
          name: 'Harlequin Crest',
          invFile: 'invcap',
          invtransform: 'cgrn',
          x: 5000,
          y: 5000,
          mode: 5,
          direction: 0,
          hpRatio: 1,
          animStartedAtMs: startMs,
        },
      ])
      expect(shakoDrawables.unitDrawables).toHaveLength(1)
      drawSceneUnitDrawable(renderer, shakoDrawables.unitDrawables[0]!, ctx, startMs + 3 * 40, 0)
      expect(drawnFrames[0]).toEqual({
        x: dyedFrames[3]!.x,
        y: dyedFrames[3]!.y,
        width: dyedFrames[3]!.w,
        height: dyedFrames[3]!.h,
      })

      // 2. Unique charm Annihilus (cm1 + name Annihilus -> flpmss)
      drawnFrames.length = 0
      const anniFrames = BAKED_UI_MANIFEST.flippyFrames['flpmss']!
      expect(anniFrames).toBeDefined()
      const anniDrawable = makeItemDrawable({
        unitId: 902,
        code: 'cm1',
        name: 'Annihilus',
        mode: 5,
        animStartedAtMs: startMs,
      })
      drawSceneUnitDrawable(renderer, anniDrawable, ctx, startMs + 5 * 40, 0)
      expect(drawnFrames[0]).toEqual({
        x: anniFrames[5]!.x,
        y: anniFrames[5]!.y,
        width: anniFrames[5]!.w,
        height: anniFrames[5]!.h,
      })
    })
  })

  describe('3. Non-Targetability & Ground Label Suppression While Airborne (D2Client.dll 0x6fb32820 / 0x6fb328a5)', () => {
    it('CommandMapper.findUnitAtScreenPoint ignores items in mode 5 (both normal and Alt-held) and selects them once transitioned to mode 3', () => {
      const world = new ClientWorld()
      const hudManager = new HudManager()
      hudManager.resize(800, 600)
      const sent: ClientCommand[] = []
      const hudModel = new HudModel({
        world,
        hudManager,
        onCommand: (cmd) => sent.push(cmd),
      })
      hudManager.commandSink = hudModel

      const mockCamera = {
        subtileToScreen(x: number, y: number) {
          return { x: (x - 5000) * 16 + 400, y: (y - 5000) * 8 + 300 }
        },
        screenToSubtile(x: number, y: number) {
          return { x: (x - 400) / 16 + 5000, y: (y - 300) / 8 + 5000 }
        },
        update() {},
      }

      const mapper = new CommandMapper({
        world,
        hudManager,
        hudModel,
        camera: mockCamera as any,
        sendCommand: (cmd) => sent.push(cmd),
      })

      world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 2 })
      world.apply({
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 0,
          id: 1,
          classId: 1,
          name: 'Hero',
          x: 5000,
          y: 5000,
          mode: 1,
          lifePct: 128,
        },
      })

      const startMs = 40_000
      world.apply(
        {
          type: 'WorldItemAction',
          action: 0x02,
          container: 'ground',
          item: {
            id: 950,
            code: 'ssd',
            quality: 2,
            x: 5002,
            y: 5000,
            worldX: 5002,
            worldY: 5000,
          },
        } as any,
        startMs,
      )

      const itemUnit = world.getUnit('item', 950)!
      expect(itemUnit.mode).toBe(5)
      const screenPos = mockCamera.subtileToScreen(5002, 5000)

      // Airborne (mode 5): non-targetable both normally and with Alt held
      expect(mapper.findUnitAtScreenPoint(screenPos.x, screenPos.y - 8)).toBeNull()
      ;(mapper as any).altHeld = true
      expect(mapper.findUnitAtScreenPoint(screenPos.x, screenPos.y - 8)).toBeNull()
      ;(mapper as any).altHeld = false

      // Even if a 1-frame stale groundItemLabelBoxes entry exists, resolvePointerTarget ignores mode 5
      hudManager.groundItemLabelBoxes = [
        {
          id: 950,
          text: 'Short Sword',
          label: 'Short Sword',
          color: '#ffffff',
          x: screenPos.x - 30,
          y: screenPos.y - 24,
          width: 60,
          height: 18,
        },
      ]
      expect(mapper.resolvePointerTarget(screenPos.x, screenPos.y - 12).hoveredUnit).toBeNull()

      // Once flippy expires -> mode 3: immediately targetable via both screen hit-test and label box
      world.expireCastStates(itemUnit.modeUntilMs!)
      expect(itemUnit.mode).toBe(3)
      expect(mapper.findUnitAtScreenPoint(screenPos.x, screenPos.y - 8)?.id).toBe(950)
      expect(mapper.resolvePointerTarget(screenPos.x, screenPos.y - 12).hoveredUnit?.id).toBe(950)
    })

    it('renderSceneSourceFrame suppresses ground item label boxes while item is in mode 5 and displays them in mode 3', () => {
      const hudManager = new HudManager()
      hudManager.resize(800, 600)
      hudManager.showGroundLabels = true
      vi.spyOn(hudManager, 'render').mockImplementation(() => {})
      vi.spyOn(hudManager.font, 'measureText').mockReturnValue(64)

      const droppingItem = makeItemDrawable({
        unitId: 960,
        code: 'ssd',
        name: 'Short Sword',
        mode: 5,
        isHovered: true,
        worldX: 0,
        worldY: 0,
      })

      const baseSnapshot = {
        tick: 1,
        worldReady: true,
        actId: 1,
        levelId: 1,
        viewportProfile: { width: 800, height: 600, hudHeight: 48 },
        playerWorld: { x: 0, y: 0 },
        playerSubTile: { x: 0, y: 0 },
        playerLocalSubTile: { x: 0, y: 0 },
        cameraTopLeft: { x: 0, y: 0 },
        floorQuads: [],
        shadowQuads: [],
        lowerWallQuads: [],
        upperWallQuads: [],
        roofQuads: [],
        entities: {
          unitDrawables: [droppingItem],
          missileDrawables: [],
          overlayDrawables: [],
          sortedDrawables: [droppingItem],
          pointLights: [],
        },
      }

      const ctx = {
        hudManager,
        nowMs: 1000,
        source: {
          buildFrameSnapshot: () => baseSnapshot,
          getLevelView: () => null,
        },
      } as unknown as SceneSourceRenderContext

      renderSceneSourceFrame(ctx)
      expect(hudManager.groundItemLabelBoxes).toHaveLength(0)

      // Transition to mode 3 -> label is emitted
      const landedItem = makeItemDrawable({
        unitId: 960,
        code: 'ssd',
        name: 'Short Sword',
        mode: 3,
        isHovered: true,
        worldX: 0,
        worldY: 0,
      })
      ;(baseSnapshot.entities as any).unitDrawables = [landedItem]
      ;(baseSnapshot.entities as any).sortedDrawables = [landedItem]
      ;(ctx as any).nowMs = 2000

      renderSceneSourceFrame(ctx)
      expect(hudManager.groundItemLabelBoxes).toHaveLength(1)
      expect(hudManager.groundItemLabelBoxes[0]!.id).toBe(960)
    })
  })

  describe('4. OnlineSession Integration: buildRenderableUnits & tick() Mode Expiry', () => {
    it('OnlineSession propagates animStartedAtMs/flippyFile/invFile/invtransform in buildRenderableUnits and expires mode 5 -> 3 on tick()', () => {
      const session = new OnlineSession()

      session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
      session.handleServerEvent({
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 0,
          id: 1,
          classId: 1,
          name: 'Hero',
          x: 5000,
          y: 5000,
        },
      })

      session.handleServerEvent({
        type: 'WorldItemAction',
        action: 0x02,
        container: 'ground',
        item: {
          id: 990,
          code: 'gld',
          goldAmount: 750,
          x: 5002,
          y: 5002,
          worldX: 5002,
          worldY: 5002,
        },
      } as any)

      const worldItem = session.world.getUnit('item', 990)!
      expect(worldItem.mode).toBe(5)
      expect(worldItem.animStartedAtMs).toBeDefined()
      const startMs = worldItem.animStartedAtMs!

      const unitsWhileAirborne = session.buildRenderableUnits(startMs + 80)
      const renderItemAirborne = unitsWhileAirborne.find((u) => u.kind === 'item' && u.id === 990)
      expect(renderItemAirborne).toBeDefined()
      expect(renderItemAirborne!.mode).toBe(5)
      expect(renderItemAirborne!.animStartedAtMs).toBe(startMs)
      expect(renderItemAirborne!.goldAmount).toBe(750)

      session.tick(40, startMs + 480)
      expect(worldItem.mode).toBe(5)

      // Advance session.tick() past modeUntilMs (17 * 40 = 680ms)
      session.tick(40, startMs + 680)
      expect(worldItem.mode).toBe(3)
      const unitsAfterLanding = session.buildRenderableUnits(startMs + 680)
      const renderItemLanded = unitsAfterLanding.find((u) => u.kind === 'item' && u.id === 990)
      expect(renderItemLanded!.mode).toBe(3)
      expect(renderItemLanded!.animStartedAtMs).toBeUndefined()
    })
  })

  describe('5. Issue #928 — Authentic DC6 Frame Offset (offsetX/offsetY) Parabolic Airborne Trajectory', () => {
    it('renders gold pile (flpgld_0) along its DC6 offsetY parabolic airborne arc (-63 -> -114 apex -> -3 ground) instead of pinning bottom to worldY', () => {
      const { renderer, drawnCalls } = createMockSpriteRenderer()
      const ctx = {
        itemsAtlasHandle: 99 as unknown as AtlasHandle,
      } as unknown as SceneSourceRenderContext
      const startMs = 10_000
      const worldX = 400
      const worldY = 300

      const goldFrames = BAKED_UI_MANIFEST.flippyFrames['flpgld_0']!
      expect(goldFrames.length).toBe(17)

      const droppingGold = makeItemDrawable({
        unitId: 928,
        code: 'gld',
        goldAmount: 50,
        mode: 5,
        worldX,
        worldY,
        animStartedAtMs: startMs,
      })

      const bottomYByFrame: number[] = []
      const topYByFrame: number[] = []

      for (let i = 0; i < goldFrames.length; i++) {
        drawnCalls.length = 0
        drawSceneUnitDrawable(renderer, droppingGold, ctx, startMs + i * 40, 0)
        expect(drawnCalls).toHaveLength(1)
        const call = drawnCalls[0]!
        const sr = goldFrames[i]!
        expect(sr.offsetX).toBeDefined()
        expect(sr.offsetY).toBeDefined()

        // Verify exact DC6 anchor formula: drawX = worldX + offsetX, drawY = worldY - h + offsetY
        expect(call.x).toBe(Math.round(worldX + sr.offsetX!))
        expect(call.y).toBe(Math.round(worldY - sr.h + sr.offsetY!))

        topYByFrame.push(call.y)
        bottomYByFrame.push(call.y + sr.h)
      }

      // Frame 0 starts 63px above ground (bottomY = 300 - 63 = 237), NOT pinned to ground (300)
      expect(bottomYByFrame[0]).toBe(worldY - 63)
      // Frame 3 reaches airborne apex 114px above ground (bottomY = 300 - 114 = 186, topY = 186 - 21 = 165)
      expect(bottomYByFrame[3]).toBe(worldY - 114)
      expect(topYByFrame[3]).toBe(worldY - 114 - 21)
      // Frame 3 is strictly higher in the air (smaller Y) than Frame 0 and Frame 8
      expect(topYByFrame[3]!).toBeLessThan(topYByFrame[0]!)
      expect(topYByFrame[3]!).toBeLessThan(topYByFrame[8]!)
      // Frame 16 settles on ground at offsetY = -3 (bottomY = 297, topY = 290)
      expect(bottomYByFrame[16]).toBe(worldY - 3)
      expect(topYByFrame[16]).toBe(worldY - 3 - 7)

      // Transition to mode 3 (ITEMMODE_ON_GROUND) must match final frame 16 with zero positional jump
      drawnCalls.length = 0
      const restingGold = makeItemDrawable({
        unitId: 928,
        code: 'gld',
        goldAmount: 50,
        mode: 3,
        worldX,
        worldY,
      })
      drawSceneUnitDrawable(renderer, restingGold, ctx, startMs + 1000, 0)
      expect(drawnCalls).toHaveLength(1)
      expect(drawnCalls[0]!.x).toBe(Math.round(worldX + goldFrames[16]!.offsetX!))
      expect(drawnCalls[0]!.y).toBe(Math.round(worldY - goldFrames[16]!.h + goldFrames[16]!.offsetY!))
    })

    it('applies both horizontal (offsetX) and vertical (offsetY) DC6 trajectory offsets for potions (flprps), weapons (flpssd), and dyed items (flpcap_cgrn)', () => {
      const { renderer, drawnCalls } = createMockSpriteRenderer()
      const ctx = {
        itemsAtlasHandle: 99 as unknown as AtlasHandle,
      } as unknown as SceneSourceRenderContext
      const startMs = 20_000
      const worldX = 500
      const worldY = 400

      const cases = [
        { unitId: 929, code: 'hp1', key: 'flprps', name: 'Minor Healing Potion' },
        { unitId: 930, code: 'ssd', key: 'flpssd', name: 'Short Sword' },
        {
          unitId: 931,
          code: 'uap',
          key: 'flpcap_cgrn',
          name: 'Harlequin Crest',
          invFile: 'invcap',
          invtransform: 'cgrn',
        },
      ] as const

      for (const c of cases) {
        const frames = BAKED_UI_MANIFEST.flippyFrames[c.key]!
        expect(frames.length).toBeGreaterThan(5)
        const unit = makeItemDrawable({
          unitId: c.unitId,
          code: c.code,
          name: c.name,
          mode: 5,
          worldX,
          worldY,
          animStartedAtMs: startMs,
          ...('invFile' in c ? { invFile: c.invFile, invtransform: c.invtransform } : {}),
        })

        for (let i = 0; i < frames.length; i++) {
          drawnCalls.length = 0
          drawSceneUnitDrawable(renderer, unit, ctx, startMs + i * 40, 0)
          expect(drawnCalls).toHaveLength(1)
          const sr = frames[i]!
          expect(drawnCalls[0]!.x).toBe(Math.round(worldX + sr.offsetX!))
          expect(drawnCalls[0]!.y).toBe(Math.round(worldY - sr.h + sr.offsetY!))
        }
      }
    })
  })
})
