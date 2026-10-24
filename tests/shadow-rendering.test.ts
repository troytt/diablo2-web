/**
 * @file tests/shadow-rendering.test.ts
 *
 * Tests for the Shadow Layer (DT1 Type 13) rendering and placement parity with
 * Diablo II v1.13c.
 *
 * Ground Truth Invariants:
 * 1. DT1 tiles with `type === 13` are shadow tiles.
 * 2. Shadows are ground-aligned: screen anchor uses (orthoX - 80, orthoY) identical
 *    to floor tiles, without wall vertical block adjustment (`minBlockY + 80`).
 * 3. `IsoMapScene` exposes `shadows: readonly IsoDraw[]`, sorted by isometric depth.
 * 4. Sub-tile collision flags of shadow layers are unioned into `collisionMasks` and `blocked`.
 * 5. Real Act 1 presets (Ruin2.ds1) carry shadow tiles that resolve to DT1 type 13.
 */

import { describe, it, expect } from 'vitest'
import {
  buildIsoMapScene,
  ORTHO_CELL_HEIGHT,
  ORTHO_CELL_WIDTH,
} from '../src/common/world/d2map.ts'
import type { Ds1 } from '../src/common/formats/ds1.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { decodeDs1 } from '../src/common/formats/ds1.ts'
import { decodeDt1, subTileFlagsOf, type Dt1, type Dt1Tile } from '../src/common/formats/dt1.ts'
import { loadActTables, resolveLevelLibraries } from '../src/common/world/acts.ts'
import { existsSync } from 'node:fs'
import {
  SHADOW_TINT,
  computeUnitShadowQuad,
  drawUnitPerspectiveShadow,
  drawSceneUnitDrawable,
  type SceneSourceRenderContext,
} from '../src/client/scene/world-renderer.ts'

type SpriteRenderer = Parameters<typeof drawSceneUnitDrawable>[0]
type SceneUnitDrawable = Parameters<typeof drawSceneUnitDrawable>[1]

describe('Shadow Layer (DT1 Type 13) Rendering & Parity', () => {
  const makeFloorTile = (style = 1, sequence = 1): Dt1Tile => ({
    direction: 1,
    roofHeight: 0,
    materialFlags: 0,
    animated: 0,
    height: -80,
    width: 160,
    type: 0, // floor
    style,
    sequence,
    rarityFrameIndex: 0,
    subTileFlags: Array.from({ length: 25 }, () => subTileFlagsOf(0)),
    blocks: [],
    minBlockY: 0,
    bitmapHeight: 80,
  })

  const makeShadowTile = (style = 2, sequence = 1, animated = 0, blockWalk = false): Dt1Tile => ({
    direction: 1,
    roofHeight: 0,
    materialFlags: 0,
    animated,
    height: -80,
    width: 160,
    type: 13, // shadow
    style,
    sequence,
    rarityFrameIndex: 0,
    subTileFlags: Array.from({ length: 25 }, (_, i) =>
      subTileFlagsOf(blockWalk && i === 12 ? 0x0001 : 0),
    ),
    blocks: [],
    minBlockY: 0,
    bitmapHeight: 80,
  })

  it('buildIsoMapScene parses and outputs shadows array with exact type 13', () => {
    const floorTile = makeFloorTile(1, 1)
    const shadowTile = makeShadowTile(2, 1)

    const dt1: Dt1 = {
      versionMajor: 7,
      versionMinor: 6,
      tiles: [floorTile, shadowTile],
      warnings: [],
    }

    const ds1: Ds1 = {
      version: 18,
      width: 2,
      height: 2,
      act: 1,
      substitutionType: 0,
      wallLayers: 1,
      floorLayers: 1,
      cells: [
        [
          {
            floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [{ style: 2, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            substitutions: [],
          },
          {
            floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [],
            substitutions: [],
          },
        ],
        [
          {
            floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [],
            substitutions: [],
          },
          {
            floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [{ style: 2, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            substitutions: [],
          },
        ],
      ],
      objects: [],
      npcPathOffset: null,
    }

    const scene = buildIsoMapScene(ds1, [dt1])

    expect(scene.shadows).toBeDefined()
    expect(scene.shadows.length).toBe(2)

    // Check first shadow draw at cell(0, 0)
    const s0 = scene.shadows[0]!
    expect(s0.cellX).toBe(0)
    expect(s0.cellY).toBe(0)
    expect(s0.x).toBe(scene.originX - 80)
    expect(s0.y).toBeCloseTo(scene.originY)

    // Check second shadow draw at cell(1, 1)
    const s1 = scene.shadows[1]!
    expect(s1.cellX).toBe(1)
    expect(s1.cellY).toBe(1)
    expect(s1.x).toBe(scene.originX - 80)
    expect(s1.y).toBeCloseTo(scene.originY + 2 * ORTHO_CELL_HEIGHT)

    // Both must point to the shadow tile (index 1)
    expect(s0.tile).toBe(1)
    expect(s1.tile).toBe(1)
  })

  it('shadows are ground-anchored and do NOT inherit wall minBlockY offset', () => {
    // If a shadow tile has minBlockY = -40 (like some trees), it must STILL be drawn
    // on the floor ground plane (draw.y === originY + (cx + cy) * 40).
    const floorTile = makeFloorTile(1, 1)
    const shadowTile: Dt1Tile = {
      ...makeShadowTile(2, 1),
      minBlockY: -64,
    }

    const dt1: Dt1 = {
      versionMajor: 7,
      versionMinor: 6,
      tiles: [floorTile, shadowTile],
      warnings: [],
    }

    const ds1: Ds1 = {
      version: 18,
      width: 1,
      height: 1,
      act: 1,
      substitutionType: 0,
      wallLayers: 1,
      floorLayers: 1,
      cells: [
        [
          {
            floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [{ style: 2, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            substitutions: [],
          },
        ],
      ],
      objects: [],
      npcPathOffset: null,
    }

    const scene = buildIsoMapScene(ds1, [dt1])
    const floor = scene.floors[0]!
    const shadow = scene.shadows[0]!

    // Floor and shadow must have identical screen origins
    expect(shadow.x).toBe(floor.x)
    expect(shadow.y).toBe(floor.y)
    expect(shadow.y - scene.originY).toBe(0)
  })

  it('shadows fold blocking flags into collisionMasks and blocked array', () => {
    const floorTile = makeFloorTile(1, 1)
    const shadowTile = makeShadowTile(2, 1, 0, true) // sub-tile 12 blocks walk

    const dt1: Dt1 = {
      versionMajor: 7,
      versionMinor: 6,
      tiles: [floorTile, shadowTile],
      warnings: [],
    }

    const ds1: Ds1 = {
      version: 18,
      width: 1,
      height: 1,
      act: 1,
      substitutionType: 0,
      wallLayers: 1,
      floorLayers: 1,
      cells: [
        [
          {
            floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [{ style: 2, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            substitutions: [],
          },
        ],
      ],
      objects: [],
      npcPathOffset: null,
    }

    const scene = buildIsoMapScene(ds1, [dt1])
    expect(scene.shadowBlockedSubtiles).toBe(1)
    expect(scene.blocked[12]).toBe(1)
    expect(scene.collisionMasks[12]! & 0x0001).toBe(0x0001)
  })

  it('shadows sort by isometric depth order (cellX + cellY)', () => {
    const floorTile = makeFloorTile(1, 1)
    const shadowTile = makeShadowTile(2, 1)

    const dt1: Dt1 = {
      versionMajor: 7,
      versionMinor: 6,
      tiles: [floorTile, shadowTile],
      warnings: [],
    }

    const ds1: Ds1 = {
      version: 18,
      width: 3,
      height: 3,
      act: 1,
      substitutionType: 0,
      wallLayers: 1,
      floorLayers: 1,
      cells: [
        [
          { floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], walls: [], shadows: [{ style: 2, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], substitutions: [] },
          { floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], walls: [], shadows: [], substitutions: [] },
          { floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], walls: [], shadows: [{ style: 2, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], substitutions: [] },
        ],
        [
          { floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], walls: [], shadows: [], substitutions: [] },
          { floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], walls: [], shadows: [{ style: 2, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], substitutions: [] },
          { floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], walls: [], shadows: [], substitutions: [] },
        ],
        [
          { floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], walls: [], shadows: [{ style: 2, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], substitutions: [] },
          { floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], walls: [], shadows: [], substitutions: [] },
          { floors: [{ style: 1, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], walls: [], shadows: [{ style: 2, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }], substitutions: [] },
        ],
      ],
      objects: [],
      npcPathOffset: null,
    }

    const scene = buildIsoMapScene(ds1, [dt1])
    expect(scene.shadows.length).toBe(5)

    for (let i = 0; i < scene.shadows.length - 1; i += 1) {
      const a = scene.shadows[i]!
      const b = scene.shadows[i + 1]!
      const depthA = a.cellX + a.cellY
      const depthB = b.cellX + b.cellY
      expect(depthA <= depthB).toBe(true)
    }
  })

  const mpqDir = existsSync('samples/d2/d2data.mpq')
    ? 'samples/d2'
    : process.env.D2_DATA_DIR && existsSync(`${process.env.D2_DATA_DIR}/d2data.mpq`)
      ? process.env.D2_DATA_DIR
      : null
  const hasMpq = mpqDir !== null

  it.skipIf(!hasMpq)('real MPQ: verifies shadow resolution and DT1 Type 13 in Act 1 Trees & Ruin', async () => {
    const archives = new MountedArchives()
    for (const name of ['d2exp.mpq', 'd2data.mpq', 'Patch_D2.mpq']) {
      try {
        archives.add(name, await MpqArchive.open(await fileSource(`${mpqDir}/${name}`)))
      } catch {}
    }

    const tables = await loadActTables(archives)
    const { dt1Names } = resolveLevelLibraries(tables, 2)
    const libraries: Dt1[] = []
    for (const name of dt1Names) {
      try {
        libraries.push(decodeDt1(await archives.read(name)))
      } catch {}
    }
    expect(libraries.length).toBeGreaterThan(0)

    // Load Ruin2.ds1 (contains ruins and shadow layer)
    const ruinBuf = await archives.read('data/global/tiles/ACT1/OUTDOORS/Ruin2.ds1')
    const ds1 = decodeDs1(ruinBuf)
    const scene = buildIsoMapScene(ds1, libraries, 42)

    // Verify shadows were found and extracted
    expect(scene.shadows.length).toBeGreaterThan(0)

    for (const shadowDraw of scene.shadows) {
      const tile = libraries[shadowDraw.library]!.tiles[shadowDraw.tile]!
      // Must be DT1 Type 13
      expect(tile.type).toBe(13)

      // Must be on the floor isometric plane
      const expectedY = scene.originY + (shadowDraw.cellX + shadowDraw.cellY) * ORTHO_CELL_HEIGHT
      expect(shadowDraw.y).toBe(expectedY)

      const expectedX = scene.originX + (shadowDraw.cellX - shadowDraw.cellY) * ORTHO_CELL_WIDTH - 80
      expect(shadowDraw.x).toBe(expectedX)
    }
  }, 30000)

  describe('Unit Perspective Ground Shadows (D2Client.dll 0x6fb6d480 -> D2Gfx_10072, #804)', () => {
    const sampleFrame = {
      x: 0,
      y: 0,
      u0: 0,
      v0: 0,
      u1: 0.5,
      v1: 0.5,
      width: 64,
      height: 80,
      anchorX: -32,
      anchorY: -72,
    }
    const sampleAtlas = { id: 7 } as any

    const makeMockRenderer = () => {
      const callOrder: string[] = []
      const drawQuadCalls: any[] = []
      const drawCalls: any[] = []
      const renderer = {
        drawQuad: (...args: any[]) => {
          callOrder.push('drawQuad')
          drawQuadCalls.push(args)
        },
        draw: (...args: any[]) => {
          callOrder.push('draw')
          drawCalls.push(args)
        },
      } as unknown as SpriteRenderer
      return { renderer, callOrder, drawQuadCalls, drawCalls }
    }

    const makeMockCtx = (): SceneSourceRenderContext => {
      const charArt = {
        handle: sampleAtlas,
        directions: 8,
        groups: [[sampleFrame]],
        clips: {
          nu: { group: 0, directions: 1, speed: 16, loop: true },
          dt: { group: 0, directions: 1, speed: 16, loop: false },
          dd: { group: 0, directions: 1, speed: 16, loop: false },
        },
      } as any
      const normalMonsterArt = {
        handle: sampleAtlas,
        token: 'SK',
        directions: 8,
        standOffset: 0,
        blendMode: 'normal',
        groups: [[sampleFrame]],
        clips: {
          nu: { group: 0, directions: 1, speed: 16, loop: true },
          dt: { group: 0, directions: 1, speed: 16, loop: false },
          dd: { group: 0, directions: 1, speed: 16, loop: false },
        },
      } as any
      const additiveMonsterArt = {
        ...normalMonsterArt,
        token: 'WILLOWISP',
        blendMode: 'additive',
      } as any
      return {
        source: {} as any,
        lightingPreset: 'outdoor-day' as any,
        characterArt: charArt,
        characterArtByToken: new Map([
          ['so', charArt],
          ['am', charArt],
          ['ai', charArt],
        ]),
        monsterArtMap: new Map([
          ['hcidx:0', normalMonsterArt],
          ['hcidx:357', normalMonsterArt],
          ['hcidx:430', normalMonsterArt],
          ['hcidx:118', additiveMonsterArt],
        ]),
      }
    }

    const makeBaseUnit = (overrides: Partial<SceneUnitDrawable>): SceneUnitDrawable => ({
      drawableKind: 'unit',
      unitKind: 'player',
      id: 1,
      unitId: 1,
      classId: 1,
      token: 'so',
      mode: 1,
      direction: 0,
      frame: 0,
      worldX: 200,
      worldY: 300,
      sortY: 300,
      subX: 100,
      subY: 100,
      blendMode: 'normal',
      lifePct: 100,
      name: undefined,
      isHovered: false,
      isCorpse: false,
      tintColor: null,
      overlays: [],
      ...overrides,
    })

    it('computeUnitShadowQuad projects a 0.5-scaled, -0.5-sheared quad in Z-order (TL, TR, BL, BR) anchored at the sprite foot baseline', () => {
      const q = computeUnitShadowQuad(168, 228, 64, 80)
      // bottomY = 228 + 80 = 308; shadowHeight = 40; topY = 268; shearX = -40
      expect(q).toEqual({
        x0: 128,
        y0: 268,
        x1: 192,
        y1: 268,
        x2: 168,
        y2: 308,
        x3: 232,
        y3: 308,
        tlX: 128,
        tlY: 268,
        trX: 192,
        trY: 268,
        blX: 168,
        blY: 308,
        brX: 232,
        brY: 308,
      })
      expect(q.x2).toBeLessThan(q.x3)
    })

    it('draws perspective ground shadow before sprite body with exact Z-order vertex coordinates for all 4 living unit branches', () => {
      const ctx = makeMockCtx()
      // worldX=200, worldY=300, anchorX=-32, anchorY=-72 -> drawX=168, drawY=228
      const expectedQuad = computeUnitShadowQuad(168, 228, 64, 80)
      const expectedVertices = [
        expectedQuad.x0,
        expectedQuad.y0,
        expectedQuad.x1,
        expectedQuad.y1,
        expectedQuad.x2,
        expectedQuad.y2,
        expectedQuad.x3,
        expectedQuad.y3,
      ]

      // 1. Living standard player
      const m1 = makeMockRenderer()
      drawSceneUnitDrawable(m1.renderer, makeBaseUnit({ unitKind: 'player', token: 'so', mode: 1 }), ctx, 0, 1)
      expect(m1.callOrder).toEqual(['drawQuad', 'draw'])
      const shadowCall1 = m1.drawQuadCalls[0]!
      expect(shadowCall1.slice(1, 9)).toEqual(expectedVertices)
      expect(shadowCall1[5]).toBe(168) // x2 = blX = drawX
      expect(shadowCall1[7]).toBe(232) // x3 = brX = drawX + width
      expect(shadowCall1[9]).toEqual({
        atlas: sampleAtlas,
        tint: SHADOW_TINT,
        blendMode: 'normal',
        elevationY: 0,
      })

      // 2. Living Druid Werewolf morph player (token '40' -> classId 430)
      const m2 = makeMockRenderer()
      drawSceneUnitDrawable(m2.renderer, makeBaseUnit({ unitKind: 'player', token: '40', mode: 1 }), ctx, 0, 1)
      expect(m2.callOrder).toEqual(['drawQuad', 'draw'])
      expect(m2.drawQuadCalls[0]!.slice(1, 9)).toEqual(expectedVertices)

      // 3. Living disguised summon monster (Valkyrie classId 357)
      const m3 = makeMockRenderer()
      drawSceneUnitDrawable(
        m3.renderer,
        makeBaseUnit({ unitKind: 'monster', classId: 357, token: 'VK', mode: 1 }),
        ctx,
        0,
        1,
      )
      expect(m3.callOrder).toEqual(['drawQuad', 'draw'])
      expect(m3.drawQuadCalls[0]!.slice(1, 9)).toEqual(expectedVertices)

      // 4. Living standard monster (Skeleton classId 0)
      const m4 = makeMockRenderer()
      drawSceneUnitDrawable(
        m4.renderer,
        makeBaseUnit({ unitKind: 'monster', classId: 0, token: 'SK', mode: 1 }),
        ctx,
        0,
        1,
      )
      expect(m4.callOrder).toEqual(['drawQuad', 'draw'])
      expect(m4.drawQuadCalls[0]!.slice(1, 9)).toEqual(expectedVertices)
    })

    it('omits perspective ground shadow for dying/dead/corpse units, additive monsters, and degenerate frames', () => {
      const ctx = makeMockCtx()

      // Player corpse (isCorpse: true or mode 17 DD)
      const pCorpse = makeMockRenderer()
      drawSceneUnitDrawable(
        pCorpse.renderer,
        makeBaseUnit({ unitKind: 'player', token: 'so', mode: 17, isCorpse: true }),
        ctx,
        0,
        1,
      )
      expect(pCorpse.callOrder).toEqual(['draw'])
      expect(pCorpse.drawQuadCalls).toHaveLength(0)

      // Monster corpse (mode 12 DD)
      const mCorpse = makeMockRenderer()
      drawSceneUnitDrawable(
        mCorpse.renderer,
        makeBaseUnit({ unitKind: 'monster', classId: 0, token: 'SK', mode: 12, isCorpse: true }),
        ctx,
        0,
        1,
      )
      expect(mCorpse.callOrder).toEqual(['draw'])
      expect(mCorpse.drawQuadCalls).toHaveLength(0)

      // Standard monster dying (mode: 0, isCorpse: false) and dead flag (dead: true, isCorpse: false)
      const mDyingStd = makeMockRenderer()
      drawSceneUnitDrawable(
        mDyingStd.renderer,
        makeBaseUnit({ unitKind: 'monster', classId: 0, token: 'SK', mode: 0, isCorpse: false }),
        ctx,
        0,
        1,
      )
      expect(mDyingStd.callOrder).toEqual(['draw'])
      expect(mDyingStd.drawQuadCalls).toHaveLength(0)

      const mDeadStd = makeMockRenderer()
      drawSceneUnitDrawable(
        mDeadStd.renderer,
        makeBaseUnit({
          unitKind: 'monster',
          classId: 0,
          token: 'SK',
          mode: 1,
          isCorpse: false,
          ...({ dead: true } as any),
        }),
        ctx,
        0,
        1,
      )
      expect(mDeadStd.callOrder).toEqual(['draw'])
      expect(mDeadStd.drawQuadCalls).toHaveLength(0)

      // Disguised summon monster dying (mode: 0, isCorpse: false) and dead flag (dead: true, isCorpse: false)
      const mDyingSummon = makeMockRenderer()
      drawSceneUnitDrawable(
        mDyingSummon.renderer,
        makeBaseUnit({ unitKind: 'monster', classId: 357, token: 'VK', mode: 0, isCorpse: false }),
        ctx,
        0,
        1,
      )
      expect(mDyingSummon.callOrder).toEqual(['draw'])
      expect(mDyingSummon.drawQuadCalls).toHaveLength(0)

      const mDeadSummon = makeMockRenderer()
      drawSceneUnitDrawable(
        mDeadSummon.renderer,
        makeBaseUnit({
          unitKind: 'monster',
          classId: 357,
          token: 'VK',
          mode: 1,
          isCorpse: false,
          ...({ dead: true } as any),
        }),
        ctx,
        0,
        1,
      )
      expect(mDeadSummon.callOrder).toEqual(['draw'])
      expect(mDeadSummon.drawQuadCalls).toHaveLength(0)

      // Additive monster (Gloam/Willowisp classId 118)
      const mAdditive = makeMockRenderer()
      drawSceneUnitDrawable(
        mAdditive.renderer,
        makeBaseUnit({ unitKind: 'monster', classId: 118, token: 'WILLOWISP', mode: 1 }),
        ctx,
        0,
        1,
      )
      expect(mAdditive.callOrder).toEqual(['draw'])
      expect(mAdditive.drawQuadCalls).toHaveLength(0)

      // Degenerate frame dimensions (width <= 0 or height <= 0 or 1x1)
      const mDegen = makeMockRenderer()
      drawUnitPerspectiveShadow(mDegen.renderer, { ...sampleFrame, width: 0, height: 80 }, 100, 100, sampleAtlas)
      drawUnitPerspectiveShadow(mDegen.renderer, { ...sampleFrame, width: 64, height: 0 }, 100, 100, sampleAtlas)
      drawUnitPerspectiveShadow(mDegen.renderer, { ...sampleFrame, width: 1, height: 1 }, 100, 100, sampleAtlas)
      expect(mDegen.drawQuadCalls).toHaveLength(0)
    })
  })
})
