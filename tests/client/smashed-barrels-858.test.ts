/**
 * Regression & 1.13c Parity Tests for Smashed Barrels ON Mode Frame 9 (Issue #858).
 *
 * Ground truth (Diablo II v1.13c `Objects.txt` rows 7 `Barrel` `B1` and 11 `Barrel Exploding` `BX`):
 * - `classId = 7` (`Token = B1`):
 *   - `Start = [0, 0, 9, 0, 0, 0, 0, 0]`
 *   - `FrameCnt = [1, 10, 1, 0, 0, 0, 0, 0]`
 *   - `FrameDelta = [210, 160, 0, 256, 256, 256, 256, 256]`
 *   - `CycleAnim = [false, false, false, false, false, false, false, false]`
 * - `classId = 11` (`Token = BX`):
 *   - `Start = [0, 0, 9, 0, 0, 0, 0, 0]`
 *   - `FrameCnt = [1, 9, 1, 0, 0, 0, 0, 0]`
 *   - `FrameDelta = [210, 160, 0, 256, 256, 256, 256, 256]`
 *   - `CycleAnim = [false, false, false, false, false, false, false, false]`
 * - Both barrels pack 10 frames (`0..9`) per mode COF (`NU`, `OP`, `ON`):
 *   - `Mode 0 (NU)`: `Start0 = 0, FrameCnt0 = 1` -> static frame `0` (intact barrel).
 *   - `Mode 1 (OP)`: `Start1 = 0, FrameCnt1 = 10` (`B1`) or `9` (`BX`) at `FrameDelta1 = 160` (`Sync`) -> splintering
 *     animation; the 25 Hz object animation tick (`D2Client.dll` `0x6fad5660`) switches to ON on the tick that reaches the
 *     last frame: the 16th (640ms) for `B1`, the 14th (560ms) for `BX`.
 *   - `Mode 2 (ON)`: `Start2 = 9, FrameCnt2 = 1` -> permanently holds static frame `9` (broken wood splinters).
 */

import { describe, expect, it, vi } from 'vitest'
import {
  EntityArtCache,
  loadObjectArt,
  type LoadedObjectArt,
  type ObjectIndexEntry,
  type PackedEntityCatalogIndex,
} from '../../src/client/scene/entity-art-loader.ts'
import {
  drawSceneUnitDrawable,
  type SceneSourceRenderContext,
} from '../../src/client/scene/world-renderer.ts'
import type { SceneUnitDrawable } from '../../src/client/view/unit-drawables.ts'
import {
  CANONICAL_113C_OBJECTS,
  isObjectSelectableInMode,
} from '../../src/common/world/objects-meta.ts'
import type { AtlasFrame } from '../../src/client/render/atlas.ts'
import type { AtlasHandle, SpriteRenderer } from '../../src/client/render/renderer.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

function createMockBarrelArt(
  token: 'B1' | 'BX',
  options?: { includeStart?: boolean; includeGlow?: boolean },
): LoadedObjectArt {
  const includeStart = options?.includeStart ?? true
  const includeGlow = options?.includeGlow ?? token === 'BX'
  const frameCnt1 = token === 'B1' ? 10 : 9

  const makeGroup = (groupIdx: number): AtlasFrame[] =>
    Array.from({ length: 10 }, (_, frameIdx) => ({
      x: groupIdx * 1000 + frameIdx * 100,
      y: groupIdx * 100,
      width: groupIdx === 0 ? 76 : 94,
      height: groupIdx === 0 ? 88 : 76,
      anchorX: groupIdx === 0 ? -59 : -64,
      anchorY: groupIdx === 0 ? -23 : -34,
    }))

  const makeGlowGroup = (groupIdx: number): AtlasFrame[] =>
    Array.from({ length: 10 }, (_, frameIdx) => ({
      x: 5000 + groupIdx * 1000 + frameIdx * 100,
      y: 500 + groupIdx * 100,
      // In object-bx.json, NU glow frames are 1x1 dummy placeholders; OP/ON frames are 131x166 / 113x166
      width: groupIdx === 0 ? 1 : groupIdx === 1 ? 131 : 113,
      height: groupIdx === 0 ? 1 : 166,
      anchorX: groupIdx === 0 ? -59 : groupIdx === 1 ? -81 : -70,
      anchorY: groupIdx === 0 ? -23 : -105,
    }))

  return {
    token,
    slug: token.toLowerCase(),
    handle: 1 as unknown as AtlasHandle,
    groups: [makeGroup(0), makeGroup(1), makeGroup(2)],
    ...(includeGlow
      ? {
          glowGroups: [makeGlowGroup(0), makeGlowGroup(1), makeGlowGroup(2)],
          glowClips: {
            nu: { group: 1, directions: 1, frames: 10, speed: 256, loop: false, events: [] },
            op: { group: 1, directions: 1, frames: 10, speed: 256, loop: false, events: [] },
            on: { group: 2, directions: 1, frames: 10, speed: 256, loop: false, events: [] },
          },
        }
      : {}),
    blendMode: 'normal',
    directions: 1,
    standOffset: 0,
    standFrames: 10,
    clips: {
      nu: { group: 0, directions: 1, frames: 10, speed: 256, loop: false, events: [] },
      op: { group: 1, directions: 1, frames: 10, speed: 256, loop: false, events: [] },
      on: { group: 2, directions: 1, frames: 10, speed: 256, loop: false, events: [] },
    },
    ...(includeStart ? { start: [0, 0, 9, 0, 0, 0, 0, 0] } : {}),
    frameCnt: [1, frameCnt1, 1, 0, 0, 0, 0, 0],
    frameDelta: [210, 160, 0, 256, 256, 256, 256, 256],
    cycleAnim: [false, false, false, false, false, false, false, false],
  }
}

function createMockSpriteRenderer() {
  const drawnCalls: Array<{ frame: AtlasFrame; blendMode: string | undefined }> = []
  const renderer = {
    addAtlas: vi.fn(() => 1 as unknown as AtlasHandle),
    addIndexedAtlas: vi.fn(() => 1 as unknown as AtlasHandle),
    draw: vi.fn((frame: AtlasFrame, _x: number, _y: number, opts?: { blendMode?: string }) => {
      drawnCalls.push({ frame, blendMode: opts?.blendMode })
    }),
    setBlendMode: vi.fn(),
  } as unknown as SpriteRenderer
  return { renderer, drawnCalls }
}

function makeBarrelDrawable(
  classId: 7 | 11,
  token: 'B1' | 'BX',
  mode: number,
  unitId = 700 + classId,
  animStartedAtMs?: number,
): SceneUnitDrawable {
  return {
    drawableKind: 'unit',
    unitKind: 'object',
    id: unitId,
    unitId,
    classId,
    token,
    mode,
    direction: 0,
    frame: 0,
    subX: 100,
    subY: 100,
    worldX: 0,
    worldY: 0,
    sortY: 0,
    blendMode: 'normal',
    lifePct: 128,
    name: 'Barrel',
    isHovered: false,
    isCorpse: false,
    tintColor: null,
    overlays: [],
    ...(animStartedAtMs !== undefined ? { animStartedAtMs } : {}),
  }
}

describe('Issue #858: Smashed Barrels (classId 7 B1 & classId 11 BX) ON mode frame 9 parity', () => {
  it('1. CANONICAL_113C_OBJECTS[7] (B1), [11] (BX), and Start2 > 0 breakables define authentic 1.13c Start & FrameCnt metadata', () => {
    const b1 = CANONICAL_113C_OBJECTS[7]
    expect(b1).toBeDefined()
    expect(b1?.token).toBe('B1')
    expect(b1?.start).toEqual([0, 0, 9, 0, 0, 0, 0, 0])
    expect(b1?.frameCnt).toEqual([1, 10, 1, 0, 0, 0, 0, 0])
    expect(b1?.frameDelta).toEqual([210, 160, 0, 256, 256, 256, 256, 256])
    expect(b1?.cycleAnim).toEqual([false, false, false, false, false, false, false, false])
    expect(isObjectSelectableInMode(7, 0)).toBe(true)
    expect(isObjectSelectableInMode(7, 1)).toBe(false)
    expect(isObjectSelectableInMode(7, 2)).toBe(false)

    const bx = CANONICAL_113C_OBJECTS[11]
    expect(bx).toBeDefined()
    expect(bx?.token).toBe('BX')
    expect(bx?.start).toEqual([0, 0, 9, 0, 0, 0, 0, 0])
    expect(bx?.frameCnt).toEqual([1, 9, 1, 0, 0, 0, 0, 0])
    expect(bx?.frameDelta).toEqual([210, 160, 0, 256, 256, 256, 256, 256])
    expect(bx?.cycleAnim).toEqual([false, false, false, false, false, false, false, false])
    expect(isObjectSelectableInMode(11, 0)).toBe(true)
    expect(isObjectSelectableInMode(11, 1)).toBe(false)
    expect(isObjectSelectableInMode(11, 2)).toBe(false)

    // Verify other Start2 > 0 breakables in CANONICAL_113C_OBJECTS (Urns, Crates, Caskets, Chests)
    expect(CANONICAL_113C_OBJECTS[4]?.start?.[2]).toBe(8) // U1 LargeUrn
    expect(CANONICAL_113C_OBJECTS[9]?.start?.[2]).toBe(8) // U2 Urn
    expect(CANONICAL_113C_OBJECTS[52]?.start?.[2]).toBe(8) // U3 Urn
    expect(CANONICAL_113C_OBJECTS[46]?.start?.[2]).toBe(8) // CT Crate
    expect(CANONICAL_113C_OBJECTS[5]?.start?.[2]).toBe(1) // L1 Chest
    expect(CANONICAL_113C_OBJECTS[6]?.start?.[2]).toBe(1) // L2 Chest
    expect(CANONICAL_113C_OBJECTS[50]?.start?.[2]).toBe(4) // C1 Casket
    expect(CANONICAL_113C_OBJECTS[79]?.start?.[2]).toBe(6) // C3 Casket
  })

  it('2. loadObjectArt and EntityArtCache preserve start=[0,0,9,0,0,0,0,0] metadata for object-b1 and object-bx', async () => {
    const { renderer } = createMockSpriteRenderer()
    const makeIndexEntry = (classId: 7 | 11, token: 'B1' | 'BX', opFrames: number): ObjectIndexEntry => ({
      id: classId,
      classId,
      name: 'Barrel',
      description: 'Barrel',
      token,
      slug: token.toLowerCase(),
      file: `object-${token.toLowerCase()}.r8`,
      metaFile: `object-${token.toLowerCase()}.json`,
      packPath: `object-${token.toLowerCase()}`,
      actTokens: { '1': token },
      actSlugs: { '1': token.toLowerCase() },
      baseIsMonsters: false,
      draw: true,
      isDoor: false,
      subClass: 0,
      sizeX: 1,
      sizeY: 1,
      xOffset: 0,
      yOffset: 0,
      operateRange: 2,
      selectable: [true, false, false, true, true, true, true, true],
      frameCnt: [1, opFrames, 1, 0, 0, 0, 0, 0],
      frameCounts: [1, opFrames, 1, 0, 0, 0, 0, 0],
      frameDelta: [210, 160, 0, 256, 256, 256, 256, 256],
      frameDeltas: [210, 160, 0, 256, 256, 256, 256, 256],
      cycleAnim: [false, false, false, false, false, false, false, false],
      start: [0, 0, 9, 0, 0, 0, 0, 0],
      directions: 1,
      dirCount: 1,
      modes: ['nu', 'op', 'on'],
    })

    const b1Entry = makeIndexEntry(7, 'B1', 10)
    const bxEntry = makeIndexEntry(11, 'BX', 9)

    const tenRects = Array.from({ length: 10 }, (_, i) => [i * 2, 0, 2, 2, 0, 0])
    const mockFetch: typeof fetch = vi.fn(async (url: RequestInfo | URL) => {
      const urlStr = String(url)
      if (urlStr.endsWith('object-b1.json') || urlStr.endsWith('object-bx.json')) {
        const token = urlStr.endsWith('object-b1.json') ? 'B1' : 'BX'
        return new Response(
          JSON.stringify({
            schema: 2,
            token,
            width: 32,
            height: 8,
            directions: 1,
            standOffset: 0,
            standFrames: 10,
            clips: {
              nu: { group: 0, directions: 1, frames: 10, speed: 256, loop: false },
              op: { group: 1, directions: 1, frames: 10, speed: 256, loop: false },
              on: { group: 2, directions: 1, frames: 10, speed: 256, loop: false },
            },
            groups: [tenRects, tenRects, tenRects],
          }),
          { status: 200 },
        )
      }
      if (urlStr.endsWith('.r8')) {
        return new Response(new Uint8Array(256), { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    const loadedB1 = await loadObjectArt(renderer, 'b1', '/packs', 1, b1Entry, mockFetch)
    expect(loadedB1?.start).toEqual([0, 0, 9, 0, 0, 0, 0, 0])
    expect(loadedB1?.frameCnt).toEqual([1, 10, 1, 0, 0, 0, 0, 0])
    expect(loadedB1?.frameDelta).toEqual([210, 160, 0, 256, 256, 256, 256, 256])

    const loadedBx = await loadObjectArt(renderer, 'bx', '/packs', 1, bxEntry, mockFetch)
    expect(loadedBx?.start).toEqual([0, 0, 9, 0, 0, 0, 0, 0])
    expect(loadedBx?.frameCnt).toEqual([1, 9, 1, 0, 0, 0, 0, 0])
    expect(loadedBx?.frameDelta).toEqual([210, 160, 0, 256, 256, 256, 256, 256])

    const catalog: PackedEntityCatalogIndex = {
      schema: 1,
      character: 'so',
      entities: [],
      objectByClassId: {
        '7': b1Entry,
        '11': bxEntry,
      },
    }
    const cache = new EntityArtCache({
      renderer,
      packBase: '/packs',
      fetchFn: mockFetch,
      initialCatalog: catalog,
    })
    expect(cache.getObjectArt(7, 1)).toBe('loading')
    expect(cache.getObjectArt(11, 1)).toBe('loading')
    await cache.waitForInflight()

    const cachedB1 = cache.getObjectArt(7, 1) as LoadedObjectArt
    const cachedBx = cache.getObjectArt(11, 1) as LoadedObjectArt
    expect(cachedB1.start).toEqual([0, 0, 9, 0, 0, 0, 0, 0])
    expect(cachedB1.frameCnt).toEqual([1, 10, 1, 0, 0, 0, 0, 0])
    expect(cachedBx.start).toEqual([0, 0, 9, 0, 0, 0, 0, 0])
    expect(cachedBx.frameCnt).toEqual([1, 9, 1, 0, 0, 0, 0, 0])
  })

  it('3. drawSceneUnitDrawable renders Barrel B1 (classId=7) at frame 0 in NU, frames 0..9 in OP (FrameDelta1=160), and static frame 9 in ON (post-OP and pre-opened)', () => {
    const art = createMockBarrelArt('B1', { includeStart: true })
    const ctx = {
      source: {} as any,
      lightingPreset: 'auto',
      objectArtMap: new Map([['b1', art]]),
    } satisfies SceneSourceRenderContext

    // Mode 0 (NU): Start0=0, FrameCnt0=1 -> always frame 0 of group 0 (intact barrel)
    for (const nowMs of [0, 80, 1000, 10000]) {
      const { renderer, drawnCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(renderer, makeBarrelDrawable(7, 'B1', 0, 701), ctx, nowMs, 1)
      expect(drawnCalls).toHaveLength(1)
      expect(drawnCalls[0]!.frame).toBe(art.groups[0]![0])
    }

    // Mode 1 (OP): Start1=0, FrameCnt1=10, FrameDelta1=160 (duration = 10 * 256 / 160 * 40ms = 640ms = 16 ticks)
    // Progress = floor(ticks * 160 / 256)
    const opStartMs = 2000
    const expectedB1OpSteps: ReadonlyArray<{ nowMs: number; groupIdx: number; frameIdx: number }> = [
      { nowMs: 2000, groupIdx: 1, frameIdx: 0 }, // tick 0 -> floor(0) = 0
      { nowMs: 2080, groupIdx: 1, frameIdx: 1 }, // tick 2 -> floor(320/256) = 1
      { nowMs: 2160, groupIdx: 1, frameIdx: 2 }, // tick 4 -> floor(640/256) = 2
      { nowMs: 2200, groupIdx: 1, frameIdx: 3 }, // tick 5 -> floor(800/256) = 3
      { nowMs: 2280, groupIdx: 1, frameIdx: 4 }, // tick 7 -> floor(1120/256) = 4
      { nowMs: 2320, groupIdx: 1, frameIdx: 5 }, // tick 8 -> floor(1280/256) = 5
      { nowMs: 2400, groupIdx: 1, frameIdx: 6 }, // tick 10 -> floor(1600/256) = 6
      { nowMs: 2480, groupIdx: 1, frameIdx: 7 }, // tick 12 -> floor(1920/256) = 7
      { nowMs: 2520, groupIdx: 1, frameIdx: 8 }, // tick 13 -> floor(2080/256) = 8
      { nowMs: 2600, groupIdx: 1, frameIdx: 9 }, // tick 15 -> floor(2400/256) = 9
      { nowMs: 2640, groupIdx: 2, frameIdx: 9 }, // >= 640ms -> auto-transitions to ON (group 2, frame 9)
      { nowMs: 5000, groupIdx: 2, frameIdx: 9 }, // holds ON frame 9 permanently
    ]
    for (const step of expectedB1OpSteps) {
      const { renderer, drawnCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(
        renderer,
        makeBarrelDrawable(7, 'B1', 1, 702, opStartMs),
        ctx,
        step.nowMs,
        1,
      )
      expect(drawnCalls).toHaveLength(1)
      expect(drawnCalls[0]!.frame, `B1 OP at nowMs=${step.nowMs}`).toBe(
        art.groups[step.groupIdx]![step.frameIdx],
      )
    }

    // Mode 2 (ON) after OP transition (animStartedAtMs present): permanently stays on frame 9 (broken wood splinters)
    for (const nowMs of [2640, 2680, 4000, 30000]) {
      const { renderer, drawnCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(
        renderer,
        makeBarrelDrawable(7, 'B1', 2, 703, 2640),
        ctx,
        nowMs,
        1,
      )
      expect(drawnCalls).toHaveLength(1)
      expect(drawnCalls[0]!.frame, `B1 post-OP ON at nowMs=${nowMs}`).toBe(art.groups[2]![9])
    }

    // Mode 2 (ON) pre-opened static (animStartedAtMs === undefined): permanently stays on frame 9
    for (const nowMs of [0, 40, 1000, 20000]) {
      const { renderer, drawnCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(renderer, makeBarrelDrawable(7, 'B1', 2, 704), ctx, nowMs, 1)
      expect(drawnCalls).toHaveLength(1)
      expect(drawnCalls[0]!.frame, `B1 pre-opened ON at nowMs=${nowMs}`).toBe(art.groups[2]![9])
    }

    // Fallback when LoadedObjectArt lacks start[] (resolves from CANONICAL_113C_OBJECTS[7].start)
    const artNoStart = createMockBarrelArt('B1', { includeStart: false })
    const fallbackCtx = {
      source: {} as any,
      lightingPreset: 'auto',
      objectArtMap: new Map([['b1', artNoStart]]),
    } satisfies SceneSourceRenderContext
    const { renderer, drawnCalls } = createMockSpriteRenderer()
    drawSceneUnitDrawable(renderer, makeBarrelDrawable(7, 'B1', 2, 705), fallbackCtx, 3000, 1)
    expect(drawnCalls).toHaveLength(1)
    expect(drawnCalls[0]!.frame).toBe(artNoStart.groups[2]![9])
  })

  it('4. drawSceneUnitDrawable renders Barrel Exploding BX (classId=11) at frame 0 in NU, frames 0..8 in OP (FrameCnt1=9, FrameDelta1=160), and static frame 9 in ON with additive glowGroups', () => {
    const art = createMockBarrelArt('BX', { includeStart: true, includeGlow: true })
    const ctx = {
      source: {} as any,
      lightingPreset: 'auto',
      objectArtMap: new Map([['bx', art]]),
    } satisfies SceneSourceRenderContext

    // Mode 0 (NU): frame 0 of group 0; glowGroup[0][0] is 1x1 dummy so no additive draw
    {
      const { renderer, drawnCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(renderer, makeBarrelDrawable(11, 'BX', 0, 801), ctx, 500, 1)
      expect(drawnCalls).toHaveLength(1)
      expect(drawnCalls[0]!.frame).toBe(art.groups[0]![0])
    }

    // Mode 1 (OP): Start1=0, FrameCnt1=9, FrameDelta1=160 (duration = 9 * 256 / 160 * 40ms = 576ms)
    // Plays frames 0..8 in group 1 (+ glowGroups[1][0..8]), then transitions to ON (group 2 frame 9 + glowGroups[2][9])
    const opStartMs = 1000
    const expectedBxOpSteps: ReadonlyArray<{ nowMs: number; groupIdx: number; frameIdx: number }> = [
      { nowMs: 1000, groupIdx: 1, frameIdx: 0 },
      { nowMs: 1080, groupIdx: 1, frameIdx: 1 },
      { nowMs: 1200, groupIdx: 1, frameIdx: 3 },
      { nowMs: 1400, groupIdx: 1, frameIdx: 6 },
      { nowMs: 1520, groupIdx: 1, frameIdx: 8 }, // tick 13 -> floor(2080/256) = 8 (clamped to endFrame=8)
      { nowMs: 1560, groupIdx: 1, frameIdx: 8 }, // tick 14 -> 560ms < 576ms, clamped to endFrame=8
      { nowMs: 1576, groupIdx: 2, frameIdx: 9 }, // >= 576ms -> auto-transitions to ON (group 2, frame 9)
      { nowMs: 3000, groupIdx: 2, frameIdx: 9 },
    ]
    for (const step of expectedBxOpSteps) {
      const { renderer, drawnCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(
        renderer,
        makeBarrelDrawable(11, 'BX', 1, 802, opStartMs),
        ctx,
        step.nowMs,
        1,
      )
      expect(drawnCalls).toHaveLength(2)
      expect(drawnCalls[0]!.frame, `BX OP base at nowMs=${step.nowMs}`).toBe(
        art.groups[step.groupIdx]![step.frameIdx],
      )
      expect(drawnCalls[0]!.blendMode).toBe('normal')
      expect(drawnCalls[1]!.frame, `BX OP glow at nowMs=${step.nowMs}`).toBe(
        art.glowGroups![step.groupIdx]![step.frameIdx],
      )
      expect(drawnCalls[1]!.blendMode).toBe('additive')
    }

    // Mode 2 (ON): both post-OP (animStartedAtMs present) and pre-opened (animStartedAtMs undefined) hold frame 9
    for (const animStartedAtMs of [1576, undefined]) {
      for (const nowMs of [1576, 2000, 15000]) {
        const { renderer, drawnCalls } = createMockSpriteRenderer()
        drawSceneUnitDrawable(
          renderer,
          makeBarrelDrawable(11, 'BX', 2, animStartedAtMs ? 803 : 804, animStartedAtMs),
          ctx,
          nowMs,
          1,
        )
        expect(drawnCalls).toHaveLength(2)
        expect(drawnCalls[0]!.frame).toBe(art.groups[2]![9])
        expect(drawnCalls[1]!.frame).toBe(art.glowGroups![2]![9])
      }
    }
  })

  it('5. ClientWorld advances B1 (16th 25 Hz tick, 640ms) and BX (14th tick, 560ms) from OP (mode 1) to ON (mode 2) and clears collision in OP/ON', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId: 2 })

    // Spawn B1 (id=901, classId=7) at (5000, 5000) and BX (id=902, classId=11) at (5010, 5010) in NU (mode 0)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 2, id: 901, classId: 7, name: 'Barrel', x: 5000, y: 5000, mode: 0 },
    })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 2, id: 902, classId: 11, name: 'Barrel', x: 5010, y: 5010, mode: 0 },
    })
    expect(world.isSubTileBlocked(5000, 5000)).toBe(true)
    expect(world.isSubTileBlocked(5010, 5010)).toBe(true)

    // Kick both barrels into OP (mode 1) at t = 1000ms
    world.apply({ type: 'UnitMode', unitType: 2, id: 901, mode: 1 }, 1000)
    world.apply({ type: 'UnitMode', unitType: 2, id: 902, mode: 1 }, 1000)

    const b1Unit = world.getUnit('object', 901)
    const bxUnit = world.getUnit('object', 902)
    // No duration timer for non-door objects: the 25 Hz object animation tick (0x6fad5660, Sync speed 160) ends a
    // one-shot OP on tick 1 + ceil((FrameCnt1 - 1) * 256 / 160): B1 16 (640ms), BX 14 (560ms).
    expect(b1Unit?.mode).toBe(1)
    expect(b1Unit?.modeDurationMs).toBeUndefined()
    expect(bxUnit?.mode).toBe(1)
    expect(bxUnit?.modeDurationMs).toBeUndefined()

    // HasCollision1 = 0 -> smashed barrels immediately stop blocking player movement
    expect(world.isSubTileBlocked(5000, 5000)).toBe(false)
    expect(world.isSubTileBlocked(5010, 5010)).toBe(false)

    // Step in 140ms ticks up to t = 1420ms (+420ms, 10 game ticks): both still in OP (mode 1)
    world.tick(140, 1140)
    world.tick(140, 1280)
    world.tick(140, 1420)
    expect(b1Unit?.mode).toBe(1)
    expect(bxUnit?.mode).toBe(1)

    // t = 1560ms (+560ms, 14th tick): BX transitions to ON (mode 2); B1 still in OP (mode 1)
    world.tick(140, 1560)
    expect(bxUnit?.mode).toBe(2)
    expect(b1Unit?.mode).toBe(1)

    // t = 1600ms (+600ms, 15th tick): B1 still in OP (mode 1)
    world.tick(40, 1600)
    expect(bxUnit?.mode).toBe(2)
    expect(b1Unit?.mode).toBe(1)

    // Tick at t = 1640ms (+640ms, 16th tick): B1 transitions to ON (mode 2)
    world.tick(40, 1640)
    expect(b1Unit?.mode).toBe(2)
    expect(bxUnit?.mode).toBe(2)
    expect(world.isSubTileBlocked(5000, 5000)).toBe(false)
    expect(world.isSubTileBlocked(5010, 5010)).toBe(false)
  })
})
