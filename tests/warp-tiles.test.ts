/**
 * The warp-tile scanner.
 *
 * The important behaviour is not "finds a tile" but "groups a multi-tile
 * staircase into one warp and keeps slots apart", because getting either wrong
 * puts a level's exit in the wrong place without failing anything else.
 */
import { describe, expect, it } from 'vitest'
import { findWarpTiles } from '../src/common/world/warp-tiles.ts'
import type { Ds1, Ds1Cell, Ds1Wall } from '../src/common/formats/ds1.ts'

/**
 * A wall entry.
 *
 * @param type - DS1 wall type; 10 and 11 are the special markers.
 * @param style - the marker's style, which for a warp is the `Warp0..7` slot.
 * @param sequence - the tile index within a multi-tile marker.
 * @returns the wall.
 */
function wall(type: number, style: number, sequence = 0): Ds1Wall {
  return { prop1: 0, sequence, style, type, unknown1: 0, unknown2: 0, hidden: false }
}

/**
 * An empty map with walls placed at the given cells.
 *
 * @param width - map width in cells.
 * @param height - map height in cells.
 * @param placements - what to put where.
 * @returns the map.
 */
function mapWith(
  width: number,
  height: number,
  placements: readonly { x: number; y: number; wall: Ds1Wall }[],
): Ds1 {
  const cells: Ds1Cell[][] = []
  for (let y = 0; y < height; y += 1) {
    const row: Ds1Cell[] = []
    for (let x = 0; x < width; x += 1) {
      row.push({ walls: [], floors: [], shadows: [], substitutions: [] })
    }
    cells.push(row)
  }
  for (const placement of placements) {
    const cell = cells[placement.y]![placement.x]!
    ;(cell.walls as Ds1Wall[]).push(placement.wall)
  }
  return {
    version: 18,
    width,
    height,
    act: 1,
    substitutionType: 0,
    wallLayers: 1,
    floorLayers: 1,
    cells,
    objects: [],
    groups: [],
    files: [],
  } as unknown as Ds1
}

describe('findWarpTiles', () => {
  it('finds nothing in a map with no markers', () => {
    expect(findWarpTiles(mapWith(4, 4, [{ x: 1, y: 1, wall: wall(1, 0) }]))).toEqual([])
  })

  it('reads the slot from the style, for both special wall types', () => {
    const found = findWarpTiles(mapWith(8, 8, [
      { x: 1, y: 1, wall: wall(10, 3) },
      { x: 5, y: 5, wall: wall(11, 6) },
    ]))
    expect(found.map(tile => tile.slot)).toEqual([3, 6])
  })

  it('collapses a two-tile staircase into one warp at its centre', () => {
    // This is the shape almost every warp in the game has: `LvlWarp.Tiles` is 2
    // and the DS1 marks both cells with a rising sequence.
    const found = findWarpTiles(mapWith(8, 8, [
      { x: 3, y: 4, wall: wall(11, 1, 0) },
      { x: 4, y: 4, wall: wall(11, 1, 1) },
    ]))
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ slot: 1, cellX: 3, cellY: 4, tiles: 2, minCellX: 3, minCellY: 4 })
  })

  it('collapses a four-tile staircase too', () => {
    const found = findWarpTiles(mapWith(8, 8, [
      { x: 2, y: 2, wall: wall(10, 0, 0) },
      { x: 3, y: 2, wall: wall(10, 0, 1) },
      { x: 2, y: 3, wall: wall(10, 0, 2) },
      { x: 3, y: 3, wall: wall(10, 0, 3) },
    ]))
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ slot: 0, tiles: 4, cellX: 2, cellY: 2 })
  })

  it('keeps two staircases of the same slot apart when they are far apart', () => {
    // A generator can stamp the same stair piece twice; the caller needs both
    // so it can choose, rather than silently averaging them into a wall.
    const found = findWarpTiles(mapWith(20, 20, [
      { x: 1, y: 1, wall: wall(10, 2) },
      { x: 15, y: 15, wall: wall(10, 2) },
    ]))
    expect(found).toHaveLength(2)
    expect(found.map(tile => [tile.cellX, tile.cellY])).toEqual([[1, 1], [15, 15]])
  })

  it('ignores markers outside the eight warp slots', () => {
    // Styles 30..34 are town entry points and player start positions; there is
    // no `Warp30`, so treating them as warps would invent destinations.
    const found = findWarpTiles(mapWith(8, 8, [
      { x: 1, y: 1, wall: wall(10, 30) },
      { x: 2, y: 2, wall: wall(10, 8) },
      { x: 3, y: 3, wall: wall(10, 7) },
    ]))
    expect(found.map(tile => tile.slot)).toEqual([7])
  })

  it('sorts by slot then position, so a bake is reproducible', () => {
    const found = findWarpTiles(mapWith(20, 20, [
      { x: 10, y: 10, wall: wall(10, 4) },
      { x: 1, y: 1, wall: wall(10, 4) },
      { x: 5, y: 5, wall: wall(11, 0) },
    ]))
    expect(found.map(tile => [tile.slot, tile.cellX, tile.cellY]))
      .toEqual([[0, 5, 5], [4, 1, 1], [4, 10, 10]])
  })
})
