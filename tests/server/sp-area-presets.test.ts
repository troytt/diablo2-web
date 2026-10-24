import { describe, expect, it } from 'vitest'
import { buildAreaBootstrap } from '../../src/server/world/area-bootstrap.ts'
import { OBJECTS_TXT_113C } from '../../src/common/world/objects-txt-113c.ts'
import type { LocalAreaLevelGeometry } from '../../src/netproto/index.ts'

const WAYPOINT = 157

const level = (presetUnits: LocalAreaLevelGeometry['presetUnits']): LocalAreaLevelGeometry => ({
  areaId: 3,
  originX: 3000,
  originY: 3000,
  subWidth: 40,
  subHeight: 40,
  blocked: new Uint8Array(40 * 40),
  spawnTileX: 4,
  spawnTileY: 4,
  rooms: [{ areaId: 3, tileX: 600, tileY: 600 }],
  roomRects: [],
  presetUnits,
  warps: [],
})

describe('Single Player area presets', () => {
  it('skips a preset object Objects.txt has no row for instead of failing the whole area', () => {
    const bootstrap = buildAreaBootstrap(level([
      { type: 2, index: OBJECTS_TXT_113C.length + 17, mode: 0, subX: 10, subY: 10 },
      { type: 2, index: WAYPOINT, mode: 0, subX: 20, subY: 20 },
    ]))
    expect(bootstrap.objects.map((object) => object.classId)).toEqual([WAYPOINT])
  })
})
