import { describe, expect, test } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
import {
  isWaypointObjectsTxtId,
  isWaypointDs1Object,
  WAYPOINT_OBJECTS_TXT_IDS,
  WAYPOINT_TOKENS,
} from '../src/common/units/object-lookup.ts'

describe('Waypoint Fidelity & Act-Aware DS1 Resolution (Issue #409)', () => {
  test('WAYPOINT_OBJECTS_TXT_IDS contains all 16 canonical waypoint rows', () => {
    expect(WAYPOINT_OBJECTS_TXT_IDS.size).toBe(16)
    const expectedRows = [119, 145, 156, 157, 237, 238, 288, 323, 324, 398, 402, 429, 494, 496, 511, 539]
    for (const row of expectedRows) {
      expect(isWaypointObjectsTxtId(row)).toBe(true)
    }
    expect(isWaypointObjectsTxtId(38)).toBe(false)
    expect(isWaypointObjectsTxtId(0)).toBe(false)
    expect(isWaypointObjectsTxtId(1)).toBe(false)
    expect(isWaypointObjectsTxtId(null)).toBe(false)
    expect(isWaypointObjectsTxtId(undefined)).toBe(false)
  })

  test('isWaypointDs1Object resolves act-scoped DS1 object IDs accurately without cross-act collisions', () => {
    // Act 1: id=1 is Torch (NOT waypoint); id=37 / 52 is Waypoint
    expect(isWaypointDs1Object(1, 2, 1)).toBe(false)
    expect(isWaypointDs1Object(1, 2, 37)).toBe(true)
    expect(isWaypointDs1Object(1, 2, 52)).toBe(true)

    // Act 2: id=0 is Trapdoor, id=1 is Torch (NOT waypoint); id=10 is Waypoint (Desert)
    expect(isWaypointDs1Object(2, 2, 0)).toBe(false)
    expect(isWaypointDs1Object(2, 2, 1)).toBe(false)
    expect(isWaypointDs1Object(2, 2, 10)).toBe(true)
    // Act 2 Arcane: id=134 (objectsTxtId=402, YI) is Waypoint
    expect(isWaypointDs1Object(2, 2, 134)).toBe(true)

    // Act 3: id=0 is Tree, id=12 is Weapon Rack (NOT waypoint); id=1 is Waypoint
    expect(isWaypointDs1Object(3, 2, 0)).toBe(false)
    expect(isWaypointDs1Object(3, 2, 12)).toBe(false)
    expect(isWaypointDs1Object(3, 2, 1)).toBe(true)

    // Act 4: id=0 is Mesa Waypoint
    expect(isWaypointDs1Object(4, 2, 0)).toBe(true)

    // Act 5: id=12 (Objects.txt row 38, WT) is Wall Torch (NOT waypoint); id=103 (row 511, 5O) is Ice Cave Waypoint
    expect(isWaypointDs1Object(5, 2, 12)).toBe(false)
    expect(isWaypointDs1Object(5, 2, 103)).toBe(true)
    // Act 5 Temple: id=120 (Objects.txt row 496, 5A) is Temple Waypoint
    expect(isWaypointDs1Object(5, 2, 120)).toBe(true)
  })

  test('All 39 waypoint levels in public/packs render waypoints with source="object"', async () => {
    const packDir = 'public/packs'
    const graphPath = join(packDir, 'world-graph.json')
    if (!existsSync(graphPath)) {
      return
    }

    const graph = JSON.parse(await readFile(graphPath, 'utf8')) as {
      waypoints: { id: number; levelId: number }[]
    }

    const wpLevelIds = new Set(graph.waypoints.map(w => w.levelId))
    expect(wpLevelIds.size).toBe(39)

    let totalVariantsAudited = 0

    for (const levelId of wpLevelIds) {
      // Find matching level folders in all acts
      let levelVariantCount = 0
      for (const act of [1, 2, 3, 4, 5]) {
        const actDir = join(packDir, `act${act}`)
        if (!existsSync(actDir)) continue
        const entries = readdirSync(actDir)
        for (const entry of entries) {
          if (entry.startsWith(`${levelId}-`)) {
            const scenePath = join(actDir, entry, 'scene.json')
            if (!existsSync(scenePath)) continue

            const scene = JSON.parse(await readFile(scenePath, 'utf8'))
            levelVariantCount += 1
            totalVariantsAudited += 1

            // 1. SceneWaypoint must be present
            expect(scene.waypoints, `${entry}: missing waypoints array`).toBeDefined()
            expect(scene.waypoints.length, `${entry}: waypoints array must have >= 1 item`).toBeGreaterThanOrEqual(1)

            const wp = scene.waypoints[0]
            // 2. Source must be 'object' (no placed fallback)
            expect(wp.source, `${entry}: waypoint source must be 'object'`).toBe('object')

            // 3. Rendered object list must contain a matching Waypoint object
            const wpObjs = (scene.objects ?? []).filter((o: any) =>
              o.type === 2 && (
                isWaypointObjectsTxtId(o.objectsTxtId) ||
                WAYPOINT_TOKENS.has(String(o.token).toUpperCase()) ||
                o.name === 'Waypoint'
              ),
            )
            expect(wpObjs.length, `${entry}: scene.objects must contain at least 1 waypoint object`).toBeGreaterThanOrEqual(1)
          }
        }
      }
      expect(levelVariantCount, `Level ${levelId} should have at least 1 variant`).toBeGreaterThanOrEqual(1)
    }

    expect(totalVariantsAudited).toBe(39)
  })
})
