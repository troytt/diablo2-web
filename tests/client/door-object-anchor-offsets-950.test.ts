import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  loadObjectArt,
  type ObjectIndexEntry,
  type PackedEntityCatalogIndex,
  type PackedObjectJson,
} from '../../src/client/scene/entity-art-loader.js'
import {
  drawSceneUnitDrawable,
  type SceneSourceRenderContext,
} from '../../src/client/scene/world-renderer.js'
import type { SceneUnitDrawable } from '../../src/client/view/unit-drawables.js'
import { CANONICAL_113C_OBJECTS } from '../../src/common/world/objects-meta.js'
import type { AtlasFrame } from '../../src/client/render/atlas.js'
import type { AtlasHandle, SpriteRenderer } from '../../src/client/render/renderer.js'

const ENTITIES_DIR = join(process.cwd(), 'public/entities')

function createMockSpriteRenderer(): {
  renderer: SpriteRenderer
  drawnCalls: Array<{ frame: AtlasFrame; x: number; y: number }>
} {
  const drawnCalls: Array<{ frame: AtlasFrame; x: number; y: number }> = []
  let nextHandle = 1
  const renderer = {
    addAtlas: vi.fn(() => nextHandle++ as unknown as AtlasHandle),
    addIndexedAtlas: vi.fn(() => nextHandle++ as unknown as AtlasHandle),
    draw: vi.fn((frame: AtlasFrame, x: number, y: number) => {
      drawnCalls.push({ frame, x, y })
    }),
    setBlendMode: vi.fn(),
  } as unknown as SpriteRenderer
  return { renderer, drawnCalls }
}

function createDiskBackedFetch(): typeof fetch {
  return vi.fn(async (url: RequestInfo | URL) => {
    const urlStr = String(url)
    const fileMatch = /\/entities\/(object-[a-z0-9_-]+\.(?:json|r8))$/.exec(urlStr)
    if (!fileMatch) {
      return new Response(null, { status: 404 })
    }
    const fileName = fileMatch[1]!
    if (fileName.endsWith('.json')) {
      const text = readFileSync(join(ENTITIES_DIR, fileName), 'utf8')
      return new Response(text, { status: 200 })
    }
    const metaFile = fileName.replace(/(?:_p\d+)?\.r8$/, '.json')
    const meta = JSON.parse(readFileSync(join(ENTITIES_DIR, metaFile), 'utf8')) as PackedObjectJson
    const pageSpec = meta.pages?.find(p => p.file === fileName)
    const width = pageSpec?.width ?? meta.width
    const height = pageSpec?.height ?? meta.height
    return new Response(new Uint8Array(width * height), { status: 200 })
  })
}

describe('Issue #950: 1.13c door and object DCC anchor alignment without (+16, -16) drift', () => {
  const catalog = JSON.parse(
    readFileSync(join(ENTITIES_DIR, 'index.json'), 'utf8'),
  ) as PackedEntityCatalogIndex

  const DOOR_CLASS_IDS = [
    13, 14, 15, 16, 23, 24, 25, 27, 47, 62, 63, 64, 74, 75,
    91, 92, 98, 99, 129, 153, 229, 230, 290, 291, 292, 293, 294, 295, 449, 451,
  ] as const

  it('1. Monastery Gate (classId=25, token=D7) loads raw DCC anchor (-52, -131) and renders at (-52, -142)', async () => {
    const { renderer, drawnCalls } = createMockSpriteRenderer()
    const d7Entry = catalog.objectByClassId?.['25'] as ObjectIndexEntry | undefined
    expect(d7Entry).toBeDefined()
    expect(d7Entry?.token).toBe('D7')
    expect(d7Entry?.xOffset).toBe(0)
    expect(d7Entry?.yOffset).toBe(-11)

    const loaded = await loadObjectArt(
      renderer,
      'd7',
      '/packs',
      1,
      d7Entry,
      createDiskBackedFetch(),
    )
    expect(loaded).not.toBeNull()
    const nuGroupIdx = loaded!.clips?.nu?.group ?? loaded!.standOffset
    const nuDir0Frame0 = loaded!.groups[nuGroupIdx]?.[0]
    expect(nuDir0Frame0?.anchorX).toBe(-52)
    expect(nuDir0Frame0?.anchorY).toBe(-131)

    const ctx: SceneSourceRenderContext = {
      source: {} as never,
      lightingPreset: 'auto',
      objectArtMap: new Map([['d7', loaded!]]),
    }
    const unit: SceneUnitDrawable = {
      drawableKind: 'unit',
      unitKind: 'object',
      id: 125,
      unitId: 125,
      classId: 25,
      token: 'D7',
      mode: 0,
      direction: 0,
      frame: 0,
      subX: 10,
      subY: 20,
      worldX: 1000,
      worldY: 2000,
      sortY: 2000,
      blendMode: 'normal',
      lifePct: 128,
      name: 'Monastery Gate',
      isHovered: false,
      isCorpse: false,
      tintColor: null,
      overlays: [],
    }

    drawSceneUnitDrawable(renderer, unit, ctx, 0, 1)
    expect(drawnCalls).toHaveLength(1)
    // D2Client.dll 0x6fb1a860: drawSceneUnitDrawable computes final top-left
    // (worldX + anchorX + xOffset, worldY + anchorY + yOffset) = (1000 - 52 + 0, 2000 - 131 - 11) = (948, 1858)
    expect(drawnCalls[0]?.x).toBe(1000 - 52 + 0)
    expect(drawnCalls[0]?.y).toBe(2000 - 131 - 11)
    expect(drawnCalls[0]?.frame.anchorX).toBe(-52)
    expect(drawnCalls[0]?.frame.anchorY).toBe(-131)
  })

  it('2. all 30 door/gate objects in public/entities preserve exact baked 1.13c DCC anchors without (+16, -16) shift', async () => {
    const { renderer } = createMockSpriteRenderer()
    const mockFetch = createDiskBackedFetch()

    for (const classId of DOOR_CLASS_IDS) {
      const entry = catalog.objectByClassId?.[String(classId)]
      expect(entry, `Missing index entry for door classId=${String(classId)}`).toBeDefined()
      const slug = entry!.slug
      expect(slug).not.toBeNull()
      const rawJson = JSON.parse(
        readFileSync(join(ENTITIES_DIR, `object-${slug!}.json`), 'utf8'),
      ) as PackedObjectJson

      const loaded = await loadObjectArt(renderer, slug!, '/packs', 1, entry, mockFetch)
      expect(loaded, `Failed to load door object-${slug} (classId=${String(classId)})`).not.toBeNull()

      for (let g = 0; g < rawJson.groups.length; g++) {
        const rawGroup = rawJson.groups[g]!
        const loadedGroup = loaded!.groups[g]!
        for (let f = 0; f < rawGroup.length; f++) {
          const [, , , , rawAnchorX, rawAnchorY] = rawGroup[f]!
          const loadedFrame = loadedGroup[f]!
          expect(loadedFrame.anchorX).toBe(rawAnchorX)
          expect(loadedFrame.anchorY).toBe(rawAnchorY)
        }
      }

      const canonical = CANONICAL_113C_OBJECTS[classId]
      expect(loaded!.xOffset).toBe(canonical?.xOffset ?? 0)
      expect(loaded!.yOffset).toBe(canonical?.yOffset ?? 0)
    }
  })
})
