import { describe, expect, it } from 'vitest'
import { applyLightingInputs, type LightingInputs } from '../../src/client/scene/lighting-presets.ts'
import { LightGrid } from '../../src/common/drlg/light-grid.ts'

const SIZE = 100
const WALL_X = 60
const masks = Uint16Array.from({ length: SIZE * SIZE }, (_, i) => (i % SIZE === WALL_X ? 0x02 : 0))
const collisionGrid = { originX: 0, originY: 0, cellsX: SIZE / 5, cellsY: SIZE / 5, blocked: new Uint8Array(SIZE * SIZE), gridWidth: SIZE, collisionMasks: masks }
const dark = { intensity: 0, red: 0, green: 0, blue: 0, source: 'levels' as const }

const behindWall = (grid: LightGrid) => grid.intensity[(50 - grid.originSubY) * 48 + WALL_X + 3 - grid.originSubX]!

describe('dungeon light shadows', () => {
  it('keep walls casting shadows on every frame while the player walks within one sub-tile', () => {
    const grid = new LightGrid()
    const lit = [52, 52.1, 52.2, 52.3, 52.4].map((x, i) => {
      const inputs: LightingInputs = { preset: 'auto', levelId: 8, collisionGrid, playerSubTile: { x, y: 50 }, playerUnitId: 1, lightEmitters: [], tick: i + 1, ambient: { playerRoom: dark, nearRooms: [] } }
      applyLightingInputs(inputs, { lightGrid: grid, renderer: { setLighting: () => undefined }, lightQuality: 2, nowMs: (i + 1) * 40 })
      return behindWall(grid)
    })
    expect(lit).toEqual([0, 0, 0, 0, 0])
  })
})
