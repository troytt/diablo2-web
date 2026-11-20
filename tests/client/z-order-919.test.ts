/**
 * Issue #919 — 1.13c tile layer order and wall occlusion fade.
 *
 * Ground truth (D2Client.dll 1.13c, ImageBase 0x6fab0000):
 * - `0x6fb2a72e` routes a room wall tile by `nTileType`: 15 -> roof list (`0x6fb29d30`), 16..19 -> lower-wall list
 *   (`0x6fb29e20`), everything else (incl. the exit walls 10/11) -> upper-wall list (`0x6fb2a340`).
 * - The frame callback `0x6fb3b110` paints: lower walls (`0x6fb4ec10`) -> floor pass (`0x6fac4050`) -> weather
 *   (`0x6fb2fc70`) -> walls + units (`0x6fb4ee90`) -> roofs (`0x6fac3a00`).
 * - `0x6fb29f20` / `0x6fb2a340` / `0x6fb4ee90`: upper-wall occlusion fade 0xff <-> 0x80 over 500 ms.
 */
import { describe, expect, it, vi } from 'vitest'
import { isLowerWallType } from '../../src/common/world/d2map.ts'
import {
  WALL_ALPHA_FADED,
  WALL_ALPHA_OPAQUE,
  WallFadeTracker113c,
  wallOccludesPlayer113c,
} from '../../src/client/scene/wall-fade-113c.ts'
import { renderSceneSourceFrame, type SceneSourceRenderContext } from '../../src/client/scene/world-renderer.ts'
import type { SceneTileQuad } from '../../src/client/view/scene-source.ts'

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

describe('#919 wall routing by nTileType (D2Client 0x6fb2a72e)', () => {
  it('only orientations 16..19 are lower walls; exit walls 10/11 and roofs are not', () => {
    for (const t of [16, 17, 18, 19]) expect(isLowerWallType(t)).toBe(true)
    for (const t of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20]) expect(isLowerWallType(t)).toBe(false)
    expect(isLowerWallType(undefined)).toBe(false)
  })
})

describe('#919 occlusion fade test (D2Client 0x6fb29f20)', () => {
  const box = { index: 7, x: 10, y: 20 }
  it('never fades a wall without a coord list (unk0x10 == NULL)', () => {
    expect(wallOccludesPlayer113c(undefined, { cellX: 0, cellY: 0, logicalIndex: 1 })).toBe(false)
  })
  it('never fades a wall of the logical room the player stands in', () => {
    expect(wallOccludesPlayer113c(box, { cellX: 0, cellY: 0, logicalIndex: 7 })).toBe(false)
  })
  it('fades when the player is above the box on either axis (x < nPosX || y < nPosY)', () => {
    expect(wallOccludesPlayer113c(box, { cellX: 9, cellY: 30, logicalIndex: 1 })).toBe(true)
    expect(wallOccludesPlayer113c(box, { cellX: 30, cellY: 19, logicalIndex: 1 })).toBe(true)
    expect(wallOccludesPlayer113c(box, { cellX: 10, cellY: 20, logicalIndex: 1 })).toBe(false)
    expect(wallOccludesPlayer113c(box, { cellX: 40, cellY: 40, logicalIndex: 1 })).toBe(false)
  })
})

describe('#919 fade ramp (0x6fb2a340 / 0x6fb4ef21)', () => {
  it('ramps 0xff -> 0x80 in 500 ms and back', () => {
    const t = new WallFadeTracker113c()
    expect(t.sample('w', 0)).toEqual({ alpha: WALL_ALPHA_OPAQUE, faded: false })
    t.update('w', true, 0)
    // 255 + trunc(-127 * 250 / 500) = 255 - 63
    expect(t.sample('w', 250)).toEqual({ alpha: 192, faded: true })
    t.update('w', true, 260) // already fading: unchanged
    expect(t.sample('w', 500)).toEqual({ alpha: WALL_ALPHA_FADED, faded: true })
    t.update('w', false, 1000)
    expect(t.sample('w', 1250)).toEqual({ alpha: 128 + 63, faded: false })
    expect(t.sample('w', 1500)).toEqual({ alpha: WALL_ALPHA_OPAQUE, faded: false })
  })

  it('reversing mid-ramp shortens the ramp by (0x80 - alpha) * 500 / 127', () => {
    const t = new WallFadeTracker113c()
    t.update('w', true, 0)
    expect(t.sample('w', 250).alpha).toBe(192)
    t.update('w', false, 250)
    // end = trunc((128 - 192) * 500 / 127) + 750 = -251 + 750 = 499
    expect(t.peek('w')?.endMs).toBe(499)
    expect(t.sample('w', 300).alpha).toBe(128 + Math.trunc((127 * (300 - 499 + 500)) / 500))
    expect(t.sample('w', 499).alpha).toBe(WALL_ALPHA_OPAQUE)
  })

  it('applies the target at once outside the 3D renderers', () => {
    const t = new WallFadeTracker113c()
    t.update('w', true, 0)
    expect(t.sample('w', 1, false)).toEqual({ alpha: WALL_ALPHA_FADED, faded: true })
  })
})

function quad(kind: string, worldX: number, extra: Partial<SceneTileQuad> = {}): SceneTileQuad {
  return {
    cellX: 0,
    cellY: 0,
    worldX,
    worldY: 0,
    sortY: 0,
    act: 1,
    library: 0,
    tile: worldX,
    dt1Path: kind,
    placement: { page: 0, x: 0, y: 0, width: 8, height: 8, act: 1 } as SceneTileQuad['placement'],
    ...extra,
  }
}

function renderOnce(snapshotExtra: Record<string, unknown>, nowMs: number, source: object): { x: number; alpha: number }[] {
  const draws: { x: number; alpha: number }[] = []
  const renderer = {
    begin: vi.fn(),
    flush: vi.fn(),
    setLighting: vi.fn(),
    setUnitLight: vi.fn(),
    setBlendMode: vi.fn(),
    draw: vi.fn((_f: unknown, x: number, _y: number, o?: { tint?: readonly number[] }) => {
      draws.push({ x, alpha: o?.tint?.[3] ?? 1 })
    }),
  }
  const snapshot = {
    tick: 1,
    worldReady: true,
    actId: 1,
    levelId: 28,
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
    entities: { unitDrawables: [], missileDrawables: [], overlayDrawables: [], sortedDrawables: [], pointLights: [] },
    ...snapshotExtra,
  }
  Object.assign(source, { buildFrameSnapshot: () => snapshot, getLevelView: () => null })
  const ctx = {
    nowMs,
    renderer,
    tileGpuCache: { ensureActPalette: vi.fn(), getPageHandle: () => ({ texture: {}, width: 64, height: 64 }) },
    source,
  } as unknown as SceneSourceRenderContext
  renderSceneSourceFrame(ctx)
  return draws
}

describe('#919 frame layer order (D2Client 0x6fb3b110)', () => {
  it('paints lower walls before floors, then shadows, upper walls, roofs; roofs are never hidden', () => {
    const draws = renderOnce(
      {
        lowerWallQuads: [quad('lower', 1, { type: 17 })],
        floorQuads: [quad('floor', 2)],
        shadowQuads: [quad('shadow', 3, { type: 13 })],
        upperWallQuads: [quad('upper', 4, { type: 1 })],
        // The player stands in this roof's cell (0, 0): 1.13c still draws it (no roof fade target is ever written).
        roofQuads: [quad('roof', 5, { type: 15 })],
      },
      0,
      {},
    )
    expect(draws.map(d => d.x)).toEqual([1, 2, 3, 4, 5])
    expect(draws[4]!.alpha).toBe(1)
  })

  it('fades an occluding upper wall to 0x80 over 500 ms and leaves MAPTILE_TREES walls opaque', () => {
    const source = {}
    const extra = {
      wallFadePlayer: { cellX: 0, cellY: 0, logicalIndex: 1 },
      upperWallQuads: [
        quad('wall', 10, { type: 1, fadeBox: { index: 2, x: 5, y: 5 } }),
        quad('tree', 11, { type: 14, fadeBox: { index: 2, x: 5, y: 5 }, noFade: true }),
        quad('own-room', 12, { type: 2, fadeBox: { index: 1, x: 5, y: 5 } }),
        quad('outdoor', 13, { type: 2 }),
      ],
    }
    renderOnce(extra, 1000, source)
    const later = renderOnce(extra, 1600, source)
    const alphaOf = (x: number): number => later.find(d => d.x === x)!.alpha
    expect(alphaOf(10)).toBeCloseTo(WALL_ALPHA_FADED / 255, 6)
    expect(alphaOf(11)).toBe(1)
    expect(alphaOf(12)).toBe(1)
    expect(alphaOf(13)).toBe(1)
  })
})

describe('#1009 POPS roof & building reveal (D2Common 0x6fd5a6a0 / 0x6fd5a180)', () => {
  it('fades type-15 roofs and subIndex walls 0xff <-> 0x00 and reveals 0x200 cutaway walls when entering/leaving POPS box', () => {
    const source = {}
    const pops = [
      { mapIndex: 0, index: 8, subIndex: 23, pad: 0, box: { x: 10, y: 20, width: 6, height: 6 } },
    ]
    const buildExtra = (subX: number, subY: number) => ({
      pops,
      playerLocalSubTile: { x: subX, y: subY },
      upperWallQuads: [
        // POPS-matched 2nd story wall (style == 23, noFade == true as in Travincal 0x8005) inside expanded box [9..16]x[19..26]
        quad('pop-wall', 20, { cellX: 9, cellY: 19, type: 1, style: 23, noFade: true }),
        // Non-matching 1st story wall (style == 20)
        quad('base-wall', 21, { cellX: 10, cellY: 20, type: 1, style: 20 }),
        // Cutaway wall (0x200 = revealHidden) initially hidden outside POPS box
        quad('cutaway', 22, { cellX: 12, cellY: 22, type: 1, style: 20, revealHidden: true }),
        // Out-of-bounds POPS wall (cellX = 17 > 10 + 6)
        quad('outside-pop-wall', 23, { cellX: 17, cellY: 20, type: 1, style: 23, noFade: true }),
      ],
      roofQuads: [
        // Roof with matching style == subIndex (23) inside expanded box
        quad('roof-matched', 30, { cellX: 16, cellY: 26, type: 15, style: 23 }),
        // Roof with popLinkage (0x100) is excluded by !(dwFlags & 0x300) at 0x6fd5a24d
        quad('roof-linked', 31, { cellX: 12, cellY: 22, type: 15, style: 23, popLinkage: true }),
        // Roof with non-matching style (22 != 23)
        quad('roof-other', 32, { cellX: 12, cellY: 22, type: 15, style: 22 }),
      ],
    })

    // 1. Player outside POPS box (subTile (0, 0)): roofs & pop-wall opaque (1), cutaway hidden (not drawn)
    const outside0 = renderOnce(buildExtra(0, 0), 0, source)
    expect(outside0.find(d => d.x === 20)?.alpha).toBe(1)
    expect(outside0.find(d => d.x === 21)?.alpha).toBe(1)
    expect(outside0.find(d => d.x === 22)).toBeUndefined()
    expect(outside0.find(d => d.x === 23)?.alpha).toBe(1)
    expect(outside0.find(d => d.x === 30)?.alpha).toBe(1)
    expect(outside0.find(d => d.x === 31)?.alpha).toBe(1)
    expect(outside0.find(d => d.x === 32)?.alpha).toBe(1)

    // 2. Player enters POPS box [50..80) x [100..130) at t=1000ms
    const enterMid = renderOnce(buildExtra(55, 105), 1000, source)
    expect(enterMid).toBeDefined()
    const enterHalf = renderOnce(buildExtra(55, 105), 1250, source)
    // At 250ms into 500ms ramp: 255 -> 0 is ~128/255, cutaway is immediately visible at alpha 1 (0x6fd5a23a)
    expect(enterHalf.find(d => d.x === 20)?.alpha).toBeCloseTo(128 / 255, 2)
    expect(enterHalf.find(d => d.x === 22)?.alpha).toBe(1)
    expect(enterHalf.find(d => d.x === 30)?.alpha).toBeCloseTo(128 / 255, 2)
    expect(enterHalf.find(d => d.x === 31)?.alpha).toBe(1)
    expect(enterHalf.find(d => d.x === 32)?.alpha).toBe(1)

    // 3. At t=1600ms (after 500ms ramp completes): pop-wall & matched roof reach alpha 0 (hidden), cutaway stays visible
    const enterDone = renderOnce(buildExtra(55, 105), 1600, source)
    expect(enterDone.find(d => d.x === 20)).toBeUndefined()
    expect(enterDone.find(d => d.x === 21)?.alpha).toBe(1)
    expect(enterDone.find(d => d.x === 22)?.alpha).toBe(1)
    expect(enterDone.find(d => d.x === 23)?.alpha).toBe(1)
    expect(enterDone.find(d => d.x === 30)).toBeUndefined()
    expect(enterDone.find(d => d.x === 31)?.alpha).toBe(1)
    expect(enterDone.find(d => d.x === 32)?.alpha).toBe(1)

    // 4. Player leaves POPS box at t=2000ms; by t=2600ms roof & pop-wall are restored to 1 and cutaway is hidden again
    renderOnce(buildExtra(0, 0), 2000, source)
    const leaveDone = renderOnce(buildExtra(0, 0), 2600, source)
    expect(leaveDone.find(d => d.x === 20)?.alpha).toBe(1)
    expect(leaveDone.find(d => d.x === 22)).toBeUndefined()
    expect(leaveDone.find(d => d.x === 30)?.alpha).toBe(1)
    expect(leaveDone.find(d => d.x === 31)?.alpha).toBe(1)
  })

  it('groups POPS boxes sharing (mapIndex, index) together per DRLGPRESET_UpdatePops (0x6fd5a6a0)', () => {
    const t = new WallFadeTracker113c()
    const pops = [
      { mapIndex: 0, index: 8, subIndex: 20, pad: 0, box: { x: 10, y: 10, width: 4, height: 4 } },
      { mapIndex: 0, index: 8, subIndex: 21, pad: 0, box: { x: 20, y: 20, width: 4, height: 4 } },
    ]
    const roofInBox2 = { cellX: 21, cellY: 21, library: 0, tile: 1, type: 15, style: 21 }
    // Player enters box 1 (subTile 55, 55): box 2 also activates because both share (mapIndex=0, index=8)
    t.updatePops(pops, 55, 55, 1000)
    expect(t.samplePopTile(roofInBox2, pops, 1600)).toEqual({ visible: false, alpha: 0 })
    // Player moves directly from box 1 to box 2 (subTile 105, 105): group stays active without flickering
    t.updatePops(pops, 105, 105, 2000)
    expect(t.samplePopTile(roofInBox2, pops, 2100)).toEqual({ visible: false, alpha: 0 })
  })
})
