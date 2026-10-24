import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CANONICAL_OBJECT_AUTOMAP_BY_ID,
} from '../src/common/formats/automap-canonical-data.ts'
import {
  resolveObjectAutomapCellId,
} from '../src/common/formats/automap-table.ts'
import type { Ds1 } from '../src/common/formats/ds1.ts'
import {
  buildLevelAutomap,
  type BuildLevelAutomapOptions,
} from '../src/common/world/d2map.ts'
import {
  computeAutomapObjectPixelCoords,
  computeAutomapTilePixelCoords,
} from '../src/common/formats/automap-table.ts'
import {
  Minimap,
  type MinimapLevel,
  resolveAutomapSheetName,
} from '../src/client/ui/minimap.ts'
import { AUTOMAP_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import type { AtlasFrame } from '../src/client/render/atlas.ts'
import type { AtlasHandle, SpriteRenderer } from '../src/client/render/renderer.ts'

const FLOOR_TILE_TYPE = 0

interface RecordedSpriteDraw {
  readonly frame: AtlasFrame
  readonly x: number
  readonly y: number
}

function createMockRenderer(): { renderer: SpriteRenderer; draws: RecordedSpriteDraw[] } {
  const draws: RecordedSpriteDraw[] = []
  const mockGl = {
    SCISSOR_TEST: 0x0c11,
    enable() {},
    scissor() {},
    disable() {},
  }
  const renderer = {
    gl: mockGl,
    flush() {},
    draw(frame: AtlasFrame, x: number, y: number) {
      draws.push({ frame, x, y })
    },
    drawSolid() {},
    drawSolidQuad() {},
  } as unknown as SpriteRenderer
  return { renderer, draws }
}

function registerSyntheticAtlases(minimap: Minimap): void {
  const keys = ['MaxiMap', 'MaxiMapS', 'Act2Map', 'Act2MapS', 'Act4Map', 'Act4MapS', 'ExTnMap', 'ExTnMapS'] as const
  for (const key of keys) {
    const meta = minimap.getSheetMeta(key)
    minimap.setAtlasHandle(key, {
      texture: key as unknown as WebGLTexture,
      width: meta.atlasWidth,
      height: meta.atlasHeight,
    } as AtlasHandle)
  }
}

describe('Automap Waypoint Parity (Issue #867 — Diablo II v1.13c Ground Truth)', () => {
  describe('1. Object Automap Resolution & Objects.txt Parity (D2Client.dll 0x6fb11d00..0x6fb11e60)', () => {
    it('ensures Act 1-4 and Act 5 town waypoints have AutoMap == 0 and resolve to -1', () => {
      // Waypoint objects where base is drawn via floor tiles (or extras):
      // Rogue Encampment (119), Act 1/2 waypoints (145, 156, 157, 237, 238, 288, 323, 324, 398), Harrogath (429)
      const floorWaypointClassIds = [119, 145, 156, 157, 237, 238, 288, 323, 324, 398, 429]
      for (const classId of floorWaypointClassIds) {
        expect(CANONICAL_OBJECT_AUTOMAP_BY_ID[classId], `Object ${classId} AutoMap in Objects.txt`).toBeUndefined()
        expect(resolveObjectAutomapCellId({ objectClassId: classId, autoMapCol: 0 })).toBe(-1)
      }
    })

    it('resolves Arcane Sanctuary (objectClassId 402, Level 74) to 307 (never 318) and skips in Level 46', () => {
      expect(CANONICAL_OBJECT_AUTOMAP_BY_ID[402]).toBe(307)
      // Level 74 (Arcane Sanctuary): dwAutomap = 307
      expect(resolveObjectAutomapCellId({ objectClassId: 402, autoMapCol: 307, levelId: 74 })).toBe(307)
      expect(resolveObjectAutomapCellId({ objectClassId: 402, autoMapCol: 0, levelId: 74 })).toBe(307)
      // Level 46 (Canyon of the Magi): 0x6fb11db5 skips object 402 because waypoints are floor tiles 617..619
      expect(resolveObjectAutomapCellId({ objectClassId: 402, autoMapCol: 307, levelId: 46 })).toBe(-1)
      // Any other level: skipped
      expect(resolveObjectAutomapCellId({ objectClassId: 402, autoMapCol: 307, levelId: 1 })).toBe(-1)
    })

    it('resolves Act 5 outdoor, cave, and temple waypoints (494, 496, 511, 539) to 307', () => {
      const act5ObjectWaypoints = [494, 496, 511, 539]
      for (const classId of act5ObjectWaypoints) {
        expect(CANONICAL_OBJECT_AUTOMAP_BY_ID[classId]).toBe(307)
        expect(resolveObjectAutomapCellId({ objectClassId: classId, autoMapCol: 307 })).toBe(307)
      }
    })
  })

  describe('2. buildLevelAutomap Single-Waypoint Invariant & Anti-Duplication Guard', () => {
    const emptyCell = () => ({ floors: [], walls: [], shadows: [] })
    const makeTestDs1 = (options: {
      width: number
      height: number
      cells: any
      objects: any[]
    }): Ds1 => ({
      version: 18,
      width: options.width,
      height: options.height,
      act: 1,
      substitutionType: 0,
      wallLayers: 1,
      floorLayers: 1,
      npcPathOffset: null,
      cells: options.cells,
      objects: options.objects,
    } as unknown as Ds1)

    it('Level 1 (Rogue Encampment): floor tile (style 0 seq 54) produces single 307 in floors, none in objects', () => {
      const lvl1 = makeTestDs1({
        width: 10,
        height: 10,
        cells: Array.from({ length: 10 }, (_, y) =>
          Array.from({ length: 10 }, (_, x) => {
            if (x === 5 && y === 5) {
              return {
                floors: [{ type: 0, style: 0, sequence: 54, subX: 0, subY: 0, hidden: false, prop1: 1 }],
                walls: [],
                shadows: [],
              }
            }
            return emptyCell()
          }),
        ),
        objects: [{ type: 2, id: 119 + 150, x: 26, y: 26, flags: 0 }],
      })

      // Even if external waypoints array is passed, it must not duplicate or shift the waypoint
      const automap = buildLevelAutomap(lvl1, {
        levelId: 1,
        layerId: 1,
        levelTypeId: 1,
        act: 1,
        waypoints: [{ x: 26, y: 26 }],
      })

      expect(automap.floors.filter(c => c.cellNo === 307)).toHaveLength(1)
      expect(automap.objects.filter(c => c.cellNo === 307 || c.cellNo === 318)).toHaveLength(0)
    })

    it('Level 74 (Arcane Sanctuary): object 402 produces single 307 in objects, never 318', () => {
      const lvl74 = makeTestDs1({
        width: 10,
        height: 10,
        cells: Array.from({ length: 10 }, () => Array.from({ length: 10 }, emptyCell)),
        objects: [{ type: 2, id: 402 + 150, x: 25, y: 25, flags: 0 }],
      })

      const automap = buildLevelAutomap(lvl74, {
        levelId: 74,
        layerId: 1,
        levelTypeId: 11,
        act: 2,
        waypoints: [{ x: 25, y: 25 }],
      })

      expect(automap.floors.filter(c => c.cellNo === 307)).toHaveLength(0)
      const objWps = automap.objects.filter(c => c.cellNo === 307)
      expect(objWps).toHaveLength(1)
      expect(automap.objects.filter(c => c.cellNo === 318)).toHaveLength(0)
    })

    it('Level 40 (Lut Gholein): town base map in extras, zero duplicate in objects', () => {
      const lvl40 = makeTestDs1({
        width: 20,
        height: 20,
        cells: Array.from({ length: 20 }, () => Array.from({ length: 20 }, emptyCell)),
        objects: [{ type: 2, id: 156 + 150, x: 50, y: 50, flags: 0 }],
      })

      const automap = buildLevelAutomap(lvl40, {
        levelId: 40,
        layerId: 1,
        levelTypeId: 8,
        act: 2,
        waypoints: [{ x: 50, y: 50 }],
      })

      expect(automap.objects.filter(c => c.cellNo === 307 || c.cellNo === 318)).toHaveLength(0)
      expect(automap.extras.length).toBeGreaterThan(0)
    })

    it('Level 46 (Canyon of the Magi): object 402 skipped, no object 307 or 318 added', () => {
      const lvl46 = makeTestDs1({
        width: 20,
        height: 20,
        cells: Array.from({ length: 20 }, () => Array.from({ length: 20 }, emptyCell)),
        objects: [{ type: 2, id: 402 + 150, x: 50, y: 50, flags: 0 }],
      })

      const automap = buildLevelAutomap(lvl46, {
        levelId: 46,
        layerId: 1,
        levelTypeId: 13,
        act: 2,
        waypoints: [{ x: 50, y: 50 }],
      })

      expect(automap.objects.filter(c => c.cellNo === 307 || c.cellNo === 318)).toHaveLength(0)
    })

    it('Level 111 (Frigid Highlands): object 494 produces single 307 in objects', () => {
      const lvl111 = makeTestDs1({
        width: 10,
        height: 10,
        cells: Array.from({ length: 10 }, () => Array.from({ length: 10 }, emptyCell)),
        objects: [{ type: 2, id: 494 + 150, x: 25, y: 25, flags: 0 }],
      })

      const automap = buildLevelAutomap(lvl111, {
        levelId: 111,
        layerId: 1,
        levelTypeId: 26,
        act: 5,
        waypoints: [{ x: 25, y: 25 }],
      })

      expect(automap.objects.filter(c => c.cellNo === 307)).toHaveLength(1)
      expect(automap.floors.filter(c => c.cellNo === 307)).toHaveLength(0)
    })
  })

  describe('3. Full 39-Waypoint Level Pack Audit (public/packs)', () => {
    it('verifies all 39 waypoint levels have non-overlapping, authentic waypoint representation', () => {
      const packDir = path.resolve(process.cwd(), 'public/packs')
      const indexPath = path.join(packDir, 'index.json')
      if (!fs.existsSync(indexPath)) return

      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {
        levels: { levelId: number; slug: string; path: string }[]
      }

      const wpLevels = [
        1, 3, 4, 5, 6, 27, 29, 32, 35, // Act 1
        40, 42, 43, 44, 46, 48, 52, 57, 74, // Act 2
        75, 76, 77, 78, 79, 80, 81, 83, 101, // Act 3
        103, 106, 107, // Act 4
        109, 111, 112, 113, 115, 117, 118, 123, 129, // Act 5
      ]

      for (const levelId of wpLevels) {
        const entry = index.levels.find(l => l.levelId === levelId)
        expect(entry, `Entry for level ${levelId}`).toBeDefined()
        if (!entry) continue

        const scenePath = path.join(packDir, entry.path, 'scene.json')
        const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'))
        const automap = scene.automap

        const floors307 = automap.floors.filter((c: any) => c.cellNo === 307)
        const objs307 = automap.objects.filter((c: any) => c.cellNo === 307)
        const objs318 = automap.objects.filter((c: any) => c.cellNo === 318)
        const fl617 = automap.floors.filter((c: any) => c.cellNo >= 617 && c.cellNo <= 619)

        // Never any 318 (glittery quest chest) on waypoint objects
        expect(objs318, `Level ${levelId} must not have cell 318`).toHaveLength(0)

        // Never duplicate 307 across floors and objects
        if (floors307.length > 0) {
          expect(objs307, `Level ${levelId} has floor 307, must have 0 object 307`).toHaveLength(0)
        }

        if (levelId === 74 || levelId >= 111) {
          // Object-layer waypoints (Level 74 and Act 5 outdoor/caves/temples)
          expect(objs307, `Level ${levelId} must have exactly 1 object 307`).toHaveLength(1)
          expect(floors307, `Level ${levelId} must have 0 floor 307`).toHaveLength(0)
        } else if (levelId === 40 || levelId === 103 || levelId === 109) {
          // Saved town maps
          expect(floors307).toHaveLength(0)
          expect(objs307).toHaveLength(0)
          expect(automap.extras.length).toBeGreaterThan(0)
        } else if (levelId === 46) {
          // Canyon of the Magi
          expect(floors307).toHaveLength(0)
          expect(objs307).toHaveLength(0)
          expect(fl617.length).toBeGreaterThan(0)
        } else {
          // All other Act 1-4 waypoint levels are floor-rule waypoints
          expect(floors307, `Level ${levelId} must have 1 floor 307`).toHaveLength(1)
          expect(objs307, `Level ${levelId} must have 0 object 307`).toHaveLength(0)
        }
      }
    })

    it('verifies runtime MapService / buildLevelView across all 39 waypoint levels', async () => {
      const packedDir = path.resolve(process.cwd(), 'public/act-packs/tiles')
      if (!fs.existsSync(path.join(packedDir, 'drlg-bundle.json'))) return

      await import('../tools/lib/node-map-loader.ts')
      const { MapService } = await import('../src/client/map/map-service.ts')
      const { DRLG_GetActNoFromLevelId } = await import('../src/common/drlg/drlg-drlg.ts')
      const svc = await MapService.fromPackedDir('public/act-packs/tiles')

      const wpLevels = [
        1, 3, 4, 5, 6, 27, 29, 32, 35, // Act 1
        40, 42, 43, 44, 46, 48, 52, 57, 74, // Act 2
        75, 76, 77, 78, 79, 80, 81, 83, 101, // Act 3
        103, 106, 107, // Act 4
        109, 111, 112, 113, 115, 117, 118, 123, 129, // Act 5
      ]

      let currentAct = -1
      for (const levelId of wpLevels) {
        const act = DRLG_GetActNoFromLevelId(levelId)
        if (act !== currentAct) {
          svc.loadAct({ act, seed: 0x12345678, difficulty: 0, areaId: levelId, revealMode: 'all' })
          currentAct = act
        }
        const view = svc.getLevelView(levelId, 'all')
        const automap = view.automap
        const floors307 = automap.floors.filter(c => c.cellNo === 307)
        const objs307 = automap.objects.filter(c => c.cellNo === 307)
        const objs318 = automap.objects.filter(c => c.cellNo === 318)
        const fl617 = automap.floors.filter(c => c.cellNo >= 617 && c.cellNo <= 619)

        expect(objs318, `Runtime Level ${levelId} must not have cell 318`).toHaveLength(0)
        if (levelId === 74 || levelId >= 111) {
          expect(objs307, `Runtime Level ${levelId} must have 1 object 307`).toHaveLength(1)
          expect(floors307, `Runtime Level ${levelId} must have 0 floor 307`).toHaveLength(0)
        } else if (levelId === 40 || levelId === 103 || levelId === 109) {
          expect(floors307).toHaveLength(0)
          expect(objs307).toHaveLength(0)
          expect(automap.extras.length).toBeGreaterThan(0)
        } else if (levelId === 46) {
          expect(floors307).toHaveLength(0)
          expect(objs307).toHaveLength(0)
          expect(fl617.length).toBeGreaterThan(0)
        } else {
          expect(floors307, `Runtime Level ${levelId} must have 1 floor 307`).toHaveLength(1)
          expect(objs307, `Runtime Level ${levelId} must have 0 object 307`).toHaveLength(0)
        }
      }
    }, 30000)
  })

  describe('4. Minimap Rendering Parity (Corner Minimap & Full Automap)', () => {
    it('renders single waypoint sprite in both minimap (bMinimap=true) and full automap (bMinimap=false) without distortion', () => {
      const minimap = new Minimap()
      registerSyntheticAtlases(minimap)
      const { renderer, draws } = createMockRenderer()

      const level: MinimapLevel = {
        key: 'level-1',
        levelId: 1,
        cellsX: 100,
        cellsY: 100,
        gridWidth: 500,
        blocked: new Uint8Array(500 * 500),
        markers: [],
        originX: 0,
        originY: 0,
        automap: {
          layerId: 1,
          levelTypeId: 1,
          floors: [
            {
              cellNo: 307,
              xPixel: 200,
              yPixel: 180,
              cellX: 35,
              cellY: 10,
              fSaved: 0,
            },
          ],
          walls: [],
          objects: [],
          extras: [],
        },
      }

      minimap.revealAllCurrentLevel(level)

      const miniWpFrame = minimap.getSheetMeta('MaxiMapS').frames[307]
      const maxiWpFrame = minimap.getSheetMeta('MaxiMap').frames[307]

      // Test 1: Corner Minimap (bMinimap = true)
      minimap.bMinimap = true
      minimap.visible = true
      draws.length = 0
      minimap.draw(renderer, level, 35, 10, { x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })

      expect(minimap.lastRenderStats.spritesDrawn.floors).toBe(1)
      expect(minimap.lastRenderStats.spritesDrawn.objects).toBe(0)
      expect(minimap.lastRenderStats.spritesDrawn.total).toBe(1)
      const miniWpDraws = draws.filter(d => d.frame === miniWpFrame)
      expect(miniWpDraws, 'Corner Minimap must draw exactly 1 waypoint sprite').toHaveLength(1)

      // Test 2: Full Automap (bMinimap = false)
      minimap.bMinimap = false
      draws.length = 0
      minimap.draw(renderer, level, 35, 10, { x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })

      expect(minimap.lastRenderStats.spritesDrawn.floors).toBe(1)
      expect(minimap.lastRenderStats.spritesDrawn.objects).toBe(0)
      expect(minimap.lastRenderStats.spritesDrawn.total).toBe(1)
      const fullWpDraws = draws.filter(d => d.frame === maxiWpFrame)
      expect(fullWpDraws, 'Full Automap must draw exactly 1 waypoint sprite').toHaveLength(1)
    })
  })

  describe('5. Topological 1-Hop Level-Graph Preloading (#1025)', () => {
    it('computes current level preset NPCs/objects/tiles and 1-hop neighbor tiles/monsters without building neighbor LevelViews', async () => {
      const packedDir = path.resolve(process.cwd(), 'public/act-packs/tiles')
      if (!fs.existsSync(path.join(packedDir, 'drlg-bundle.json'))) return

      await import('../tools/lib/node-map-loader.ts')
      const { MapService } = await import('../src/client/map/map-service.ts')
      const svc = await MapService.fromPackedDir('public/act-packs/tiles')

      svc.loadAct({ act: 0, seed: 0x12345678, difficulty: 0, areaId: 1, revealMode: 'all' })
      expect(svc.getLoadedAreaIds()).toEqual([1])

      const townPlan = svc.getLevelPreloadPlan(1)
      expect(townPlan).not.toBeNull()
      expect(townPlan!.actId).toBe(1)
      expect(townPlan!.currentTilePages.length).toBeGreaterThan(0)
      // Rogue Encampment preset NPCs (Gheed 147, Akara 148, Kashya 150, Charsi 154, Warriv 155)
      expect(townPlan!.currentMonsterHcIndices).toEqual(
        expect.arrayContaining([147, 148, 150, 154, 155]),
      )
      // Rogue Encampment preset objects (Stash 267, Waypoint 119, Rogue Fire 39)
      expect(townPlan!.currentObjectClassIds).toEqual(expect.arrayContaining([39, 119, 267]))
      // 1-hop neighbor of Rogue Encampment (1) is Blood Moor (2)
      expect(townPlan!.neighborAreaIds).toContain(2)
      expect(townPlan!.neighborTilePages.length).toBeGreaterThan(0)
      // Blood Moor monster spawn pool (Levels.txt Mon1..3: zombie1=5, fallen1=19, quillrat1=63)
      expect(townPlan!.neighborMonsterHcIndices).toEqual(expect.arrayContaining([5, 19, 63]))
      // Must NOT have built or cached Blood Moor's LevelView
      expect(svc.getLoadedAreaIds()).toEqual([1])

      // Step into Blood Moor (2): 1-hop neighbors include Rogue Encampment (1), Cold Plains (3), Den of Evil (8)
      svc.getLevelView(2, 'all')
      const moorPlan = svc.getLevelPreloadPlan(2)
      expect(moorPlan).not.toBeNull()
      expect(moorPlan!.neighborAreaIds).toEqual(expect.arrayContaining([1, 3, 8]))
      // Cold Plains & Den of Evil monsters include Gargantuan Beast (28), Dark Hunter (43), Fallen Shaman (58), Dark Spearwoman (159), Skeleton Archer (165)
      expect(moorPlan!.neighborMonsterHcIndices).toEqual(
        expect.arrayContaining([28, 43, 58, 159, 165]),
      )
    }, 30000)
  })
})
