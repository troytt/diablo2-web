/**
 * Regression & 1.13c Parity Tests for Stony Field Cairn Stones (Issue #857).
 *
 * Ground truth (Diablo II v1.13c `Objects.txt` rows 17..21 `StoneAlpha..StoneEpsilon`, Tokens `S1..S5`,
 * and `D2Client.dll` `0x6fad4920` object light emission):
 * - `Start0 = 0, FrameCnt0 = 1, CycleAnim0 = 0, Lit0 = 0` (`NU` mode 0: static frame 0, unlit)
 * - `Start1 = 0, FrameCnt1 = 3, FrameDelta1 = 256, CycleAnim1 = 0, Lit1 = 0` (`OP` mode 1: frames 0..2 over 120ms, unlit)
 * - `Start2 = 3, FrameCnt2 = 1, FrameDelta2 = 256, CycleAnim2 = 0, Lit2 = 17` (`ON` mode 2: static frame 3 glowing rune,
 *   persistent white point light `radius = min(17 >> 1, 18) = 8`, `intensity = 255`, `RGB(255, 255, 255)`).
 */

import { describe, expect, it, vi } from 'vitest'
import {
  EntityArtCache,
  loadObjectArt,
  type LoadedObjectArt,
  type ObjectIndexEntry,
  type PackedEntityCatalogIndex,
} from '../../src/client/scene/entity-art-loader.ts'
import { drawSceneUnitDrawable, type SceneSourceRenderContext } from '../../src/client/scene/world-renderer.ts'
import { buildSceneDrawables, type SceneUnitDrawable } from '../../src/client/view/unit-drawables.ts'
import { CANONICAL_113C_OBJECTS } from '../../src/common/world/objects-meta.ts'
import type { AtlasFrame } from '../../src/client/render/atlas.ts'
import type { AtlasHandle, SpriteRenderer } from '../../src/client/render/renderer.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { objectLightRenderInput } from '../../src/client/world/object-light.ts'
import { getObjectsTxtRecord113c } from '../../src/common/world/objects-txt-113c.ts'

const CAIRN_STONE_CLASS_IDS = [17, 18, 19, 20, 21] as const
const CAIRN_STONE_TOKENS = ['S1', 'S2', 'S3', 'S4', 'S5'] as const

function createMockCairnStoneArt(token: string, includeStart = true): LoadedObjectArt {
  const makeGroup = (groupIdx: number): AtlasFrame[] => [
    { x: groupIdx * 100 + 0, y: 0, width: 60, height: 153, anchorX: -44, anchorY: -106 },
    { x: groupIdx * 100 + 10, y: 0, width: 60, height: 153, anchorX: -44, anchorY: -106 },
    { x: groupIdx * 100 + 20, y: 0, width: 60, height: 153, anchorX: -44, anchorY: -106 },
    { x: groupIdx * 100 + 30, y: 0, width: 60, height: 153, anchorX: -44, anchorY: -106 },
  ]
  return {
    token,
    slug: token.toLowerCase(),
    handle: 1 as unknown as AtlasHandle,
    groups: [makeGroup(0), makeGroup(1), makeGroup(2)],
    blendMode: 'normal',
    directions: 1,
    standOffset: 0,
    standFrames: 4,
    clips: {
      nu: { group: 0, directions: 1, frames: 4, speed: 256, loop: false, events: [] },
      op: { group: 1, directions: 1, frames: 4, speed: 256, loop: false, events: [] },
      on: { group: 2, directions: 1, frames: 4, speed: 256, loop: false, events: [] },
    },
    ...(includeStart ? { start: [0, 0, 3, 0, 0, 0, 0, 0] } : {}),
    frameCnt: [1, 3, 1, 0, 0, 0, 0, 0],
    frameDelta: [256, 256, 256, 0, 0, 0, 0, 0],
    cycleAnim: [false, false, false, false, false, false, false, false],
  }
}

function createMockSpriteRenderer() {
  const drawnFrames: AtlasFrame[] = []
  const renderer = {
    addAtlas: vi.fn(() => 1 as unknown as AtlasHandle),
    addIndexedAtlas: vi.fn(() => 1 as unknown as AtlasHandle),
    draw: vi.fn((frame: AtlasFrame) => {
      drawnFrames.push(frame)
    }),
    setBlendMode: vi.fn(),
  } as unknown as SpriteRenderer
  return { renderer, drawnFrames }
}

function makeObjectDrawable(
  classId: number,
  token: string,
  mode: number,
  unitId = 100 + classId,
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
    subX: 120,
    subY: 80,
    worldX: 0,
    worldY: 0,
    sortY: 0,
    blendMode: 'normal',
    lifePct: 128,
    name: 'Cairn Stone',
    isHovered: false,
    isCorpse: false,
    tintColor: null,
    overlays: [],
    ...(animStartedAtMs !== undefined ? { animStartedAtMs } : {}),
  }
}

describe('Issue #857: Stony Field Cairn Stones (classId 17..21, S1..S5) ON mode frame & point light', () => {
  it('1. CANONICAL_113C_OBJECTS[17..21] defines authentic 1.13c Start0..Start7 and FrameCnt0..FrameCnt7 metadata', () => {
    for (let i = 0; i < CAIRN_STONE_CLASS_IDS.length; i++) {
      const classId = CAIRN_STONE_CLASS_IDS[i]!
      const token = CAIRN_STONE_TOKENS[i]!
      const meta = CANONICAL_113C_OBJECTS[classId]
      expect(meta, `Cairn Stone classId=${classId}`).toBeDefined()
      expect(meta?.token).toBe(token)
      expect(meta?.start).toEqual([0, 0, 3, 0, 0, 0, 0, 0])
      expect(meta?.frameCnt).toEqual([1, 3, 1, 0, 0, 0, 0, 0])
      expect(meta?.frameDelta).toEqual([256, 256, 256, 0, 0, 0, 0, 0])
      expect(meta?.cycleAnim).toEqual([false, false, false, false, false, false, false, false])
    }
  })

  it('2. loadObjectArt and EntityArtCache propagate Objects.txt start[] metadata onto LoadedObjectArt', async () => {
    const { renderer } = createMockSpriteRenderer()
    const indexEntry: ObjectIndexEntry = {
      id: 17,
      classId: 17,
      name: 'StoneAlpha',
      description: 'Cairn Stone',
      token: 'S1',
      slug: 's1',
      file: 'object-s1.r8',
      metaFile: 'object-s1.json',
      packPath: 'entities/object-s1.r8',
      actTokens: {},
      actSlugs: {},
      baseIsMonsters: false,
      draw: true,
      isDoor: false,
      subClass: 0,
      sizeX: 3,
      sizeY: 3,
      xOffset: 0,
      yOffset: 0,
      operateRange: 2,
      selectable: [true, false, false, false, false, false, false, false],
      frameCnt: [1, 3, 1, 0, 0, 0, 0, 0],
      frameCounts: [1, 3, 1, 0, 0, 0, 0, 0],
      frameDelta: [256, 256, 256, 0, 0, 0, 0, 0],
      frameDeltas: [256, 256, 256, 0, 0, 0, 0, 0],
      cycleAnim: [false, false, false, false, false, false, false, false],
      start: [0, 0, 3, 0, 0, 0, 0, 0],
      directions: 1,
      dirCount: 1,
      modes: ['nu', 'op', 'on'],
    }

    const mockFetch: typeof fetch = vi.fn(async (url: RequestInfo | URL) => {
      const urlStr = String(url)
      if (urlStr.endsWith('object-s1.json')) {
        return new Response(
          JSON.stringify({
            schema: 2,
            token: 'S1',
            width: 8,
            height: 8,
            directions: 1,
            standOffset: 0,
            standFrames: 4,
            clips: {
              nu: { group: 0, directions: 1, frames: 4, speed: 256, loop: false },
              op: { group: 1, directions: 1, frames: 4, speed: 256, loop: false },
              on: { group: 2, directions: 1, frames: 4, speed: 256, loop: false },
            },
            groups: [
              [
                [0, 0, 2, 2, 0, 0],
                [2, 0, 2, 2, 0, 0],
                [4, 0, 2, 2, 0, 0],
                [6, 0, 2, 2, 0, 0],
              ],
            ],
          }),
          { status: 200 },
        )
      }
      if (urlStr.endsWith('object-s1.r8')) {
        return new Response(new Uint8Array(64), { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    const loaded = await loadObjectArt(renderer, 's1', '/packs', 1, indexEntry, mockFetch)
    expect(loaded).not.toBeNull()
    expect(loaded?.start).toEqual([0, 0, 3, 0, 0, 0, 0, 0])
    expect(loaded?.frameCnt).toEqual([1, 3, 1, 0, 0, 0, 0, 0])

    const catalog: PackedEntityCatalogIndex = {
      schema: 1,
      character: 'so',
      entities: [],
      objectByClassId: {
        '17': indexEntry,
      },
    }
    const cache = new EntityArtCache({
      renderer,
      packBase: '/packs',
      fetchFn: mockFetch,
      initialCatalog: catalog,
    })
    expect(cache.getObjectArt(17, 1)).toBe('loading')
    await cache.waitForInflight()
    const cachedArt = cache.getObjectArt(17, 1)
    expect(typeof cachedArt).toBe('object')
    expect((cachedArt as LoadedObjectArt).start).toEqual([0, 0, 3, 0, 0, 0, 0, 0])
  })

  it('3. drawSceneUnitDrawable renders Cairn Stones (17..21) at frame 0 in NU, frames 0..2 in OP, and static frame 3 in ON', () => {
    for (let i = 0; i < CAIRN_STONE_CLASS_IDS.length; i++) {
      const classId = CAIRN_STONE_CLASS_IDS[i]!
      const token = CAIRN_STONE_TOKENS[i]!
      const art = createMockCairnStoneArt(token, true)
      const objectArtMap = new Map<string, LoadedObjectArt>([
        [token.toLowerCase(), art],
      ])
      const ctx = {
        source: {} as any,
        lightingPreset: 'auto',
        objectArtMap,
      } satisfies SceneSourceRenderContext

      // Mode 0 (NU): Start0=0, FrameCnt0=1 -> always frame 0 of group 0
      for (const nowMs of [0, 120, 5000]) {
        const { renderer, drawnFrames } = createMockSpriteRenderer()
        drawSceneUnitDrawable(renderer, makeObjectDrawable(classId, token, 0), ctx, nowMs, 1)
        expect(drawnFrames).toHaveLength(1)
        expect(drawnFrames[0]).toBe(art.groups[0]![0])
      }

      // Mode 1 (OP): Start1=0, FrameCnt1=3, speed=256 (3 ticks = 120ms) -> frames 0, 1, 2 in group 1, then transitions to ON (group 2, frame 3)
      const opStartedAtMs = 1000
      const expectedOpSequence: ReadonlyArray<{ nowMs: number; groupIdx: number; frameIdx: number }> = [
        { nowMs: 1000, groupIdx: 1, frameIdx: 0 },
        { nowMs: 1040, groupIdx: 1, frameIdx: 1 },
        { nowMs: 1080, groupIdx: 1, frameIdx: 2 },
        { nowMs: 1120, groupIdx: 2, frameIdx: 3 },
        { nowMs: 3000, groupIdx: 2, frameIdx: 3 },
      ]
      for (const step of expectedOpSequence) {
        const { renderer, drawnFrames } = createMockSpriteRenderer()
        drawSceneUnitDrawable(
          renderer,
          makeObjectDrawable(classId, token, 1, 200 + classId, opStartedAtMs),
          ctx,
          step.nowMs,
          1,
        )
        expect(drawnFrames).toHaveLength(1)
        expect(drawnFrames[0], `classId=${classId} nowMs=${step.nowMs}`).toBe(
          art.groups[step.groupIdx]![step.frameIdx],
        )
      }

      // Mode 2 (ON): Start2=3, FrameCnt2=1 -> permanently stays on static frame 3 (glowing blue rune) of group 2
      for (const nowMs of [0, 80, 1000, 15000]) {
        const { renderer, drawnFrames } = createMockSpriteRenderer()
        drawSceneUnitDrawable(renderer, makeObjectDrawable(classId, token, 2, 300 + classId), ctx, nowMs, 1)
        expect(drawnFrames).toHaveLength(1)
        expect(drawnFrames[0], `classId=${classId} ON mode nowMs=${nowMs}`).toBe(art.groups[2]![3])
      }

      // Fallback when objArt lacks start[] (resolves from CANONICAL_113C_OBJECTS[classId].start)
      const artWithoutStart = createMockCairnStoneArt(token, false)
      const fallbackCtx = {
        source: {} as any,
        lightingPreset: 'auto',
        objectArtMap: new Map([[token.toLowerCase(), artWithoutStart]]),
      } satisfies SceneSourceRenderContext
      const { renderer, drawnFrames } = createMockSpriteRenderer()
      drawSceneUnitDrawable(
        renderer,
        makeObjectDrawable(classId, token, 2, 400 + classId),
        fallbackCtx,
        2000,
        1,
      )
      expect(drawnFrames).toHaveLength(1)
      expect(drawnFrames[0]).toBe(artWithoutStart.groups[2]![3])
    }
  })

  it('4. the SetObjectLight lifecycle gives each Cairn Stone a persistent white light (Lit2 = 17 -> radius 8, RGB 255/255/255) in ON, after the OP auto transition and on an explicit ON', () => {
    for (let i = 0; i < CAIRN_STONE_CLASS_IDS.length; i++) {
      const classId = CAIRN_STONE_CLASS_IDS[i]!
      const token = CAIRN_STONE_TOKENS[i]!
      const record = getObjectsTxtRecord113c(classId)
      expect(record.lit).toEqual([0, 0, 17, 0, 0, 0, 0, 0])
      expect([record.red, record.green, record.blue]).toEqual([255, 255, 255])

      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId: 4 })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 2, id: 500 + classId, classId, name: 'Cairn Stone', x: 140, y: 90, mode: 0 },
      })
      const stone = world.getUnit('object', 500 + classId)!
      const lightsOf = () =>
        buildSceneDrawables([
          {
            id: stone.id,
            kind: 'object',
            classId,
            token,
            x: 140,
            y: 90,
            mode: stone.mode,
            objectPointLight: objectLightRenderInput(stone.objectLight),
          },
        ]).pointLights
      const whiteRadius8 = [{ subTileX: 140, subTileY: 90, radius: 8, intensity: 255, r: 255, g: 255, b: 255 }]

      // Mode 0 (NU): Lit0 = 0 -> no light.
      expect(lightsOf()).toEqual([])

      // S2C 0x0E event 3, mode 1 (OP): queued on unit+0xd8 (0x6fb5c630) until the end of the next 25 Hz tick
      // (0x6fb5bc20 -> 0x6fad59f0), where SetObjectLight(Lit1 = 0) runs at 0x6fad5af9 -> no light.
      world.apply({ type: 'UnitMode', unitType: 2, id: stone.id, mode: 1, eventCode: 3, eventFlag: 0 })
      expect(stone.mode).toBe(0)
      expect(stone.queuedPackets).toHaveLength(1)
      world.tick(40)
      expect(stone.queuedPackets).toHaveLength(0)
      expect(stone.mode).toBe(1)
      expect(lightsOf()).toEqual([])

      // One-shot OP (Start1 0, FrameCnt1 3, FrameDelta1 256, Sync): still OP and unlit after the 1st animation tick.
      world.tick(40)
      expect(stone.mode).toBe(1)
      expect(lightsOf()).toEqual([])

      // The 3rd animation tick of mode 1 (0x6fad5660) switches to ON and calls SetObjectLight(Lit2 = 17) at 0x6fad57c5
      // -> radius min(17 >> 1, 18) = 8.
      world.tick(80)
      expect(stone.mode).toBe(2)
      expect(lightsOf()).toEqual(whiteRadius8)

      // S2C 0x0E event 3, mode 2 (ON): queued and drained on the next 25 Hz tick; Lit2 = 17 -> radius 8.
      world.apply({ type: 'UnitMode', unitType: 2, id: stone.id, mode: 2, eventCode: 3, eventFlag: 0 })
      world.tick(40)
      expect(stone.mode).toBe(2)
      expect(lightsOf()).toEqual(whiteRadius8)
    }
  })

  it('5. ClientWorld advances a Cairn Stone from OP (mode 1) to ON (mode 2) on the 3rd 25 Hz animation tick (120ms) and lights it', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x1234, areaId: 4 })
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: 501,
        classId: 17,
        name: 'Cairn Stone',
        x: 5000,
        y: 5000,
        mode: 0,
      },
    })

    // Trigger OP mode (mode = 1) via UnitMode update at t = 1000ms (no S2C 0x0E event code: the light is untouched)
    world.apply(
      {
        type: 'UnitMode',
        unitType: 2,
        id: 501,
        mode: 1,
      },
      1000,
    )
    const unit = world.getUnit('object', 501)
    expect(unit?.mode).toBe(1)
    // The mode-1 duration heuristic only applies to doors now: the client animation tick (0x6fad5660) ends OP.
    expect(unit?.modeDurationMs).toBeUndefined()
    expect(unit?.objectLight).toBeNull()

    // Tick at t = 1080ms -> still in OP (mode 1)
    world.tick(80, 1080)
    expect(unit?.mode).toBe(1)
    expect(unit?.objectLight).toBeNull()

    // Tick at t = 1120ms -> permanently transitions to ON (mode 2) with the Lit2 = 17 light (radius 8 = 64 / 8)
    world.tick(40, 1120)
    expect(unit?.mode).toBe(2)
    expect(unit?.objectLight).toEqual({ targetR8: 64, currentR8: 64, red: 255, green: 255, blue: 255 })
  })
})
