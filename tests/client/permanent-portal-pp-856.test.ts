/**
 * Regression & 1.13c Parity Tests for Permanent Town Portal (Id=60, Token=PP) (Issue #856).
 *
 * Ground truth (Diablo II v1.13c `Objects.txt` row 60 `Portal` / `Permanent Town Portal`, Token `PP`,
 * and `D2Client.dll` `0x6fad4920` object light emission):
 * - Uses native `data\global\objects\PP\TR\pptrlit{nu,op,on}hth.dcc` (normal blend `groups`)
 *   and `data\global\objects\PP\HD\pphdlit{nu,op,on}hth.dcc` (additive red flame `glowGroups`),
 *   NEVER blue `TP` (`town_portal_*`) textures with a purple/magenta multiplicative tint.
 * - `FrameCnt1 = 15, FrameDelta1 = 200, CycleAnim1 = 0` (`OP` mode 1: 15 frames `0..14` over 768ms one-shot)
 * - `FrameCnt2 = 15, FrameDelta2 = 200, CycleAnim2 = 1` (`ON` mode 2: 15 frames `0..14` looping)
 * - `Lit0 = 0, Lit1 = 18, Lit2 = 19, Red = 255, Green = 120, Blue = 120, Flicker = 1`
 *   (`0x6fad4920` `radius = min(Lit >> 1, 18) = 9` in both `OP` and `ON`, `0` in `NU`; the raw `Flicker` column has
 *   no binfield in the 1.13c Objects.txt loader, so the light never flickers).
 */

import { describe, expect, it, vi } from 'vitest'
import {
  EntityArtCache,
  type LoadedObjectArt,
  type ObjectIndexEntry,
  type PackedEntityCatalogIndex,
} from '../../src/client/scene/entity-art-loader.ts'
import {
  drawSceneUnitDrawable,
  type SceneSourceRenderContext,
} from '../../src/client/scene/world-renderer.ts'
import type { LoadedOverlayArt } from '../../src/client/scene/missile-overlay-renderer.ts'
import { buildSceneDrawables, type SceneUnitDrawable } from '../../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { objectLightRenderInput } from '../../src/client/world/object-light.ts'
import { CANONICAL_113C_OBJECTS } from '../../src/common/world/objects-meta.ts'
import { getObjectsTxtRecord113c } from '../../src/common/world/objects-txt-113c.ts'
import type { AtlasFrame } from '../../src/client/render/atlas.ts'
import type { AtlasHandle, DrawOptions, SpriteRenderer } from '../../src/client/render/renderer.ts'

const PP_INDEX_ENTRY: ObjectIndexEntry = {
  id: 60,
  classId: 60,
  name: 'Portal',
  description: 'Portal',
  token: 'PP',
  slug: 'pp',
  file: 'object-pp.r8',
  metaFile: 'object-pp.json',
  packPath: 'object-pp',
  actTokens: {},
  actSlugs: {},
  baseIsMonsters: false,
  draw: true,
  isDoor: false,
  subClass: 4,
  sizeX: 1,
  sizeY: 1,
  xOffset: 0,
  yOffset: 0,
  operateRange: 2,
  selectable: [false, false, true, false, false, false, false, false],
  frameCnt: [0, 15, 15, 15, 0, 0, 0, 0],
  frameCounts: [0, 15, 15, 15, 0, 0, 0, 0],
  frameDelta: [200, 200, 200, 200, 0, 0, 0, 0],
  frameDeltas: [200, 200, 200, 200, 0, 0, 0, 0],
  cycleAnim: [false, false, true, false, false, false, false, false],
  start: [0, 0, 0, 0, 0, 0, 0, 0],
  directions: 1,
  dirCount: 1,
  modes: ['nu', 'op', 'on', 's1'],
  blendMode: 'normal',
  trans: 0,
}

function makeRawFrames(baseY: number, w: number, h: number, ax: number, ay: number, count = 15) {
  return Array.from({ length: count }, (_, idx) => [idx * (w + 1), baseY, w, h, ax, ay] as const)
}

function createMockObjectPpJson() {
  return {
    schema: 2,
    token: 'PP',
    baseIsMonsters: false,
    file: 'object-pp.r8',
    format: 'r8',
    blendMode: 'normal',
    width: 2048,
    height: 1494,
    directions: 1,
    clips: {
      nu: { group: 0, directions: 1, frames: 15, speed: 256, loop: false, events: [] },
      op: { group: 1, directions: 1, frames: 15, speed: 256, loop: false, events: [] },
      on: { group: 2, directions: 1, frames: 15, speed: 256, loop: true, events: [] },
      s1: { group: 3, directions: 1, frames: 16, speed: 256, loop: false, events: [] },
    },
    modes: {
      nu: { group: 0, directions: 1, frames: 15, speed: 256, loop: false, events: [] },
      op: { group: 1, directions: 1, frames: 15, speed: 256, loop: false, events: [] },
      on: { group: 2, directions: 1, frames: 15, speed: 256, loop: true, events: [] },
      s1: { group: 3, directions: 1, frames: 16, speed: 256, loop: false, events: [] },
    },
    glowClips: {
      nu: { group: 0, directions: 1, frames: 15, speed: 256, loop: false, events: [] },
      op: { group: 1, directions: 1, frames: 15, speed: 256, loop: false, events: [] },
      on: { group: 2, directions: 1, frames: 15, speed: 256, loop: true, events: [] },
    },
    standOffset: 0,
    standFrames: 15,
    groups: [
      makeRawFrames(0, 119, 159, -75, -103, 15),
      makeRawFrames(205, 204, 204, -117, -123, 15),
      makeRawFrames(410, 115, 154, -73, -99, 15),
      makeRawFrames(615, 134, 145, -60, -44, 16),
    ],
    glowGroups: [
      makeRawFrames(770, 119, 159, -75, -103, 15),
      makeRawFrames(930, 204, 204, -117, -123, 15),
      makeRawFrames(1135, 115, 154, -73, -99, 15),
      makeRawFrames(1340, 1, 1, -60, -44, 16),
    ],
  }
}

interface RecordedDrawCall {
  readonly frame: AtlasFrame
  readonly x: number
  readonly y: number
  readonly options: DrawOptions
}

function createMockSpriteRenderer() {
  const drawCalls: RecordedDrawCall[] = []
  const renderer = {
    addAtlas: vi.fn(() => ({ texture: {}, width: 2048, height: 1494 }) as unknown as AtlasHandle),
    addIndexedAtlas: vi.fn(
      () => ({ texture: {}, width: 2048, height: 1494, indexed: true }) as unknown as AtlasHandle,
    ),
    draw: vi.fn((frame: AtlasFrame, x: number, y: number, options: DrawOptions = {}) => {
      drawCalls.push({ frame, x, y, options })
    }),
    setBlendMode: vi.fn(),
  } as unknown as SpriteRenderer
  return { renderer, drawCalls }
}

function createBlueTpOverlayArtMap(): {
  overlayArtMap: Map<string, LoadedOverlayArt>
  tpFrames: Set<AtlasFrame>
} {
  const tpFrames = new Set<AtlasFrame>()
  const makeOverlay = (key: string, yBase: number): LoadedOverlayArt => {
    const frames: AtlasFrame[] = Array.from({ length: 15 }, (_, idx) => {
      const f: AtlasFrame = {
        x: idx * 100,
        y: yBase,
        width: 96,
        height: 128,
        anchorX: -48,
        anchorY: -96,
      }
      tpFrames.add(f)
      return f
    })
    return {
      handle: { texture: { key }, width: 1500, height: 256 } as unknown as AtlasHandle,
      frames: [frames],
      meta: {
        filename: key,
        frames: 15,
        animRate: 8,
        trans: key.endsWith('_hd') ? 1 : 5,
      } as any,
    }
  }
  const overlayArtMap = new Map<string, LoadedOverlayArt>([
    ['town_portal_op_tr', makeOverlay('town_portal_op_tr', 10000)],
    ['town_portal_op_hd', makeOverlay('town_portal_op_hd', 11000)],
    ['town_portal_on_tr', makeOverlay('town_portal_on_tr', 12000)],
    ['town_portal_on_hd', makeOverlay('town_portal_on_hd', 13000)],
  ])
  return { overlayArtMap, tpFrames }
}

function makePortalDrawable(
  classId: 59 | 60,
  mode: number,
  unitId = 600 + classId,
  animStartedAtMs?: number,
): SceneUnitDrawable {
  return {
    drawableKind: 'unit',
    unitKind: 'object',
    id: unitId,
    unitId,
    classId,
    token: classId === 60 ? 'PP' : 'TP',
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
    name: 'Portal',
    isHovered: false,
    isCorpse: false,
    tintColor: null,
    overlays: [],
    ...(animStartedAtMs !== undefined ? { animStartedAtMs } : {}),
  }
}

async function createLoadedPpCache() {
  const { renderer } = createMockSpriteRenderer()
  const ppJson = createMockObjectPpJson()
  const mockFetch: typeof fetch = vi.fn(async (url: RequestInfo | URL) => {
    const urlStr = String(url)
    if (urlStr.endsWith('object-pp.json')) {
      return new Response(JSON.stringify(ppJson), { status: 200 })
    }
    if (urlStr.endsWith('object-pp.r8')) {
      return new Response(new Uint8Array(256), { status: 200 })
    }
    return new Response(null, { status: 404 })
  })
  const catalog: PackedEntityCatalogIndex = {
    schema: 1,
    character: 'so',
    entities: [],
    objectByClassId: {
      '60': PP_INDEX_ENTRY,
    },
  }
  const cache = new EntityArtCache({
    renderer,
    packBase: '/packs',
    fetchFn: mockFetch,
    initialCatalog: catalog,
  })
  expect(cache.getObjectArt(60, 1)).toBe('loading')
  await cache.waitForInflight()
  return { cache, mockFetch }
}

describe('Issue #856: Permanent Town Portal (Id=60, Token=PP) 1.13c Sprite & Point Light Parity', () => {
  it('1. entityArtCache.getObjectArt(60, 1) loads object-pp (token: PP) with 15 frames in nu/op/on and glowGroups (HD additive layer)', async () => {
    const { cache } = await createLoadedPpCache()
    const art = cache.getObjectArt(60, 1)
    expect(typeof art).toBe('object')
    const ppArt = art as LoadedObjectArt

    expect(ppArt.token).toBe('PP')
    expect(ppArt.slug).toBe('pp')
    expect(ppArt.blendMode).toBe('normal')
    expect(ppArt.clips.nu?.frames).toBe(15)
    expect(ppArt.clips.op?.frames).toBe(15)
    expect(ppArt.clips.on?.frames).toBe(15)
    expect(ppArt.clips.on?.loop).toBe(true)

    // TR normal base layer: 15 frames in nu (group 0), op (group 1), and on (group 2)
    expect(ppArt.groups[0]).toHaveLength(15)
    expect(ppArt.groups[1]).toHaveLength(15)
    expect(ppArt.groups[2]).toHaveLength(15)

    // HD additive red flame layer: 15 frames in nu (group 0), op (group 1), and on (group 2)
    expect(ppArt.glowGroups).toBeDefined()
    expect(ppArt.glowGroups?.[0]).toHaveLength(15)
    expect(ppArt.glowGroups?.[1]).toHaveLength(15)
    expect(ppArt.glowGroups?.[2]).toHaveLength(15)
    expect(ppArt.glowClips?.op?.group).toBe(1)
    expect(ppArt.glowClips?.on?.group).toBe(2)

    // Canonical metadata alignment (FrameDelta1=200, FrameDelta2=200, CycleAnim2=true)
    expect(CANONICAL_113C_OBJECTS[60]?.token).toBe('PP')
    expect(ppArt.frameCnt?.slice(0, 3)).toEqual([0, 15, 15])
    expect(ppArt.frameDelta?.slice(0, 3)).toEqual([200, 200, 200])
    expect(ppArt.cycleAnim?.slice(0, 3)).toEqual([false, false, true])
  })

  it('2. drawSceneUnitDrawable for classId === 60 renders native object-pp groups (normal, untinted) + glowGroups (additive) across OP (0..14 over 768ms) and ON (looping 0..14), never touching blue town_portal_* overlays', async () => {
    const { cache } = await createLoadedPpCache()
    const ppArt = cache.getObjectArt(60, 1) as LoadedObjectArt
    const { overlayArtMap, tpFrames } = createBlueTpOverlayArtMap()

    const ctx: SceneSourceRenderContext = {
      source: {} as any,
      lightingPreset: 'auto',
      entityArtCache: cache,
      overlayArtMap,
    }

    const opStartMs = 1000
    // FrameDelta1 = 200 -> 1 frame every (256 * 40) / 200 = 51.2ms; 15 frames = 768ms total OP duration
    for (let frameIdx = 0; frameIdx < 15; frameIdx++) {
      const nowMs = opStartMs + frameIdx * 51.2 + 1
      const { renderer, drawCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(
        renderer,
        makePortalDrawable(60, 1, 660, opStartMs),
        ctx,
        nowMs,
        1,
      )

      expect(drawCalls, `OP frame ${frameIdx} at nowMs=${nowMs}`).toHaveLength(2)
      // 1st draw: TR normal layer from object-pp groups[1][frameIdx], untinted
      expect(drawCalls[0]!.frame).toBe(ppArt.groups[1]![frameIdx])
      expect(drawCalls[0]!.options.blendMode).toBe('normal')
      expect(drawCalls[0]!.options.tint).toBeUndefined()
      expect(tpFrames.has(drawCalls[0]!.frame)).toBe(false)

      // 2nd draw: HD additive red flame layer from object-pp glowGroups[1][frameIdx], untinted
      expect(drawCalls[1]!.frame).toBe(ppArt.glowGroups![1]![frameIdx])
      expect(drawCalls[1]!.options.blendMode).toBe('additive')
      expect(drawCalls[1]!.options.tint).toBeUndefined()
      expect(tpFrames.has(drawCalls[1]!.frame)).toBe(false)
    }

    // Post-OP auto-transition into looping ON mode (nowMs >= opStartMs + 768ms)
    for (const loopStep of [0, 1, 7, 14, 15, 16]) {
      const nowMs = opStartMs + 768 + loopStep * 51.2 + 1
      const expectedFrameIdx = loopStep % 15
      const { renderer, drawCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(
        renderer,
        makePortalDrawable(60, 1, 660, opStartMs),
        ctx,
        nowMs,
        1,
      )

      expect(drawCalls, `ON loopStep=${loopStep}`).toHaveLength(2)
      expect(drawCalls[0]!.frame).toBe(ppArt.groups[2]![expectedFrameIdx])
      expect(drawCalls[0]!.options.blendMode).toBe('normal')
      expect(drawCalls[0]!.options.tint).toBeUndefined()
      expect(drawCalls[1]!.frame).toBe(ppArt.glowGroups![2]![expectedFrameIdx])
      expect(drawCalls[1]!.options.blendMode).toBe('additive')
      expect(drawCalls[1]!.options.tint).toBeUndefined()
    }

    // Explicit mode = 2 (ON) also renders native object-pp groups[2] + glowGroups[2] and never touches town_portal_*
    {
      const { renderer, drawCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(renderer, makePortalDrawable(60, 2, 661), ctx, 2500, 1)
      expect(drawCalls).toHaveLength(2)
      expect(ppArt.groups[2]).toContain(drawCalls[0]!.frame)
      expect(drawCalls[0]!.options.blendMode).toBe('normal')
      expect(drawCalls[0]!.options.tint).toBeUndefined()
      expect(ppArt.glowGroups![2]).toContain(drawCalls[1]!.frame)
      expect(drawCalls[1]!.options.blendMode).toBe('additive')
      expect(drawCalls[1]!.options.tint).toBeUndefined()
      for (const call of drawCalls) {
        expect(tpFrames.has(call.frame)).toBe(false)
      }
    }

    // Meanwhile, standard blue Town Portal (classId === 59) continues to render from town_portal_* overlays
    {
      const { renderer, drawCalls } = createMockSpriteRenderer()
      drawSceneUnitDrawable(renderer, makePortalDrawable(59, 2, 659, 1000), ctx, 2500, 1)
      expect(drawCalls.length).toBeGreaterThanOrEqual(2)
      for (const call of drawCalls) {
        expect(tpFrames.has(call.frame)).toBe(true)
        expect(call.options.tint).toBeUndefined()
      }
    }
  })

  it('3. the SetObjectLight lifecycle gives the PP its Objects.txt red light (radius 9, intensity 255, RGB 255/120/120) in OP and ON, and none in NU', () => {
    // Objects.txt row 60: Lit0..2 = 0/18/19, Red/Green/Blue = 255/120/120 (the Flicker column is not loaded by 1.13c).
    const record = getObjectsTxtRecord113c(60)
    expect(record.lit).toEqual([0, 18, 19, 0, 0, 0, 0, 0])
    expect([record.red, record.green, record.blue]).toEqual([255, 120, 120])

    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId: 1 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 2, id: 600, classId: 60, name: 'Portal', x: 150, y: 110, mode: 0 },
    })
    const pp = world.getUnit('object', 600)!
    const lightsOf = () =>
      buildSceneDrawables([
        {
          id: 600,
          kind: 'object',
          classId: 60,
          token: 'PP',
          x: 150,
          y: 110,
          mode: pp.mode,
          objectPointLight: objectLightRenderInput(pp.objectLight),
        },
      ]).pointLights
    const redRadius9 = [{ subTileX: 150, subTileY: 110, radius: 9, intensity: 255, r: 255, g: 120, b: 120 }]

    // Mode 0 (NU): Lit0 = 0 -> no light.
    expect(pp.mode).toBe(0)
    expect(lightsOf()).toEqual([])

    // S2C 0x0E event 3, mode 1 (OP): queued on unit+0xd8 (0x6fb5c630) and drained at the end of the next 25 Hz tick
    // (0x6fb5bc20 -> 0x6fad59f0), where SetObjectLight(Lit1 = 18) runs at 0x6fad5af9 -> radius min(18 >> 1, 18) = 9.
    world.apply({ type: 'UnitMode', unitType: 2, id: 600, mode: 1, eventCode: 3, eventFlag: 0 })
    expect(pp.mode).toBe(0)
    expect(pp.queuedPackets).toHaveLength(1)
    world.tick(40)
    expect(pp.queuedPackets).toHaveLength(0)
    expect(pp.mode).toBe(1)
    expect(lightsOf()).toEqual(redRadius9)

    // One-shot OP (Start1 0, FrameCnt1 15, FrameDelta1 200, Sync): the 19th 25 Hz animation tick (0x6fad5660) switches
    // to ON and calls SetObjectLight(Lit2 = 19) at 0x6fad57c5 -> radius min(19 >> 1, 18) = 9.
    for (let i = 0; i < 18; i++) world.tick(40)
    expect(pp.mode).toBe(1)
    world.tick(40)
    expect(pp.mode).toBe(2)
    expect(lightsOf()).toEqual(redRadius9)

    // S2C 0x0E event 3, mode 2 (ON): SetObjectLight runs on the drain tick even though the mode is unchanged; Lit2 = 19 -> radius 9.
    world.apply({ type: 'UnitMode', unitType: 2, id: 600, mode: 2, eventCode: 3, eventFlag: 0 })
    world.tick(40)
    expect(pp.mode).toBe(2)
    expect(lightsOf()).toEqual(redRadius9)

    // The town torch (row 37, Lit1 = 19, RGB 255/236/176) is lit by the same lifecycle. The scene no longer derives a
    // light from the class id, so an object drawable without `objectPointLight` emits none.
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 2, id: 370, classId: 37, name: 'Dummy', x: 100, y: 100, mode: 0 },
    })
    world.apply({ type: 'UnitMode', unitType: 2, id: 370, mode: 1, eventCode: 3, eventFlag: 0 })
    world.tick(40)
    expect(objectLightRenderInput(world.getUnit('object', 370)!.objectLight)).toEqual({
      radius: 9,
      r: 255,
      g: 236,
      b: 176,
    })
    const torchResult = buildSceneDrawables([
      { id: 370, kind: 'object', classId: 37, token: 'TO', x: 100, y: 100, mode: 1 },
    ])
    expect(torchResult.pointLights).toEqual([])
  })
})
