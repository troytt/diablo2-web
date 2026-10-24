import { describe, it, expect } from 'vitest'
import type { D2Table } from '../src/common/world/acts.ts'
import { ACT_TOWNS, townLevelForAct, actOfLevel } from '../src/common/world/acts.ts'
import {
  parseLevelRows,
  buildWorldGraph,
  PRESET_SEAM_SIDES,
  seamlessPairs,
  reachableFrom,
  edgesFrom,
  oppositeSide,
  parseWarpGeometry,
  findWarpGeometry,
  isClickableWarp,
  SIDES,
  SEAMLESS_ADJACENCY,
  DROPPED_VIS_EDGES,
} from '../src/common/world/world-graph.ts'
import type { Side } from '../src/common/world/world-graph.ts'
import {
  seamArrivalSpot,
  SEAM_TRIGGER_SUBTILES,
  type LinkGrid,
} from '../src/common/world/level-links.ts'

/**
 * Build a `Levels.txt`-shaped table from sparse overrides.
 *
 * Hand-written rather than read out of the MPQs so these tests exercise the
 * graph logic on cases the shipped data does not contain — an asymmetric edge,
 * a slot that repeats, a level with no connections at all.
 */
function levelsTable(
  rows: readonly Partial<Record<string, string | number>>[],
): D2Table {
  const header = [
    'Name',
    'Id',
    'Act',
    'LevelType',
    'DrlgType',
    'SizeX',
    'SizeY',
    'OffsetX',
    'OffsetY',
    'Depend',
    'Waypoint',
    'Portal',
    'Position',
    ...Array.from({ length: 8 }, (_unused, slot) => `Vis${String(slot)}`),
    ...Array.from({ length: 8 }, (_unused, slot) => `Warp${String(slot)}`),
  ]
  const defaults: Record<string, string> = {
    Name: '',
    Id: '0',
    Act: '0',
    LevelType: '0',
    DrlgType: '3',
    SizeX: '80',
    SizeY: '80',
    OffsetX: '-1',
    OffsetY: '-1',
    Depend: '0',
    Waypoint: '255',
    Portal: '0',
    Position: '0',
  }
  for (let slot = 0; slot < 8; slot += 1) {
    defaults[`Vis${String(slot)}`] = '0'
    defaults[`Warp${String(slot)}`] = '-1'
  }
  return {
    header,
    rows: rows.map(row =>
      header.map(column => {
        const value = row[column]
        return value === undefined ? (defaults[column] ?? '') : String(value)
      }),
    ),
  }
}

describe('parseLevelRows', () => {
  it('drops the Null placeholder row', () => {
    const rows = parseLevelRows(levelsTable([{ Id: 0, Name: 'Null' }, { Id: 1, Name: 'Town' }]))
    expect(rows.map(row => row.id)).toEqual([1])
  })

  it('reads all eight Vis and Warp slots', () => {
    const rows = parseLevelRows(levelsTable([{ Id: 2, Vis3: 8, Warp3: 0, Vis6: 8, Warp6: 3 }]))
    expect(rows[0]?.vis).toEqual([0, 0, 0, 8, 0, 0, 8, 0])
    expect(rows[0]?.warp).toEqual([-1, -1, -1, 0, -1, -1, 3, -1])
  })

  it('defaults a missing waypoint to 255 rather than 0', () => {
    // Zero is a real waypoint id (the Rogue Encampment), so a sloppy default
    // would invent a second waypoint 0 on every level in the game.
    const rows = parseLevelRows(levelsTable([{ Id: 5 }]))
    expect(rows[0]?.waypoint).toBe(255)
  })
})

describe('buildWorldGraph', () => {
  it('collapses repeated slots into one edge that keeps every warp id', () => {
    // A cave mouth occupies four slots, one per orientation.
    const graph = buildWorldGraph(
      parseLevelRows(
        levelsTable([
          { Id: 2, Vis3: 8, Warp3: 0, Vis4: 8, Warp4: 1, Vis5: 8, Warp5: 2, Vis6: 8, Warp6: 3 },
          { Id: 8, Vis0: 2, Warp0: 4 },
        ]),
      ),
    )
    const out = edgesFrom(graph, 2)
    expect(out).toHaveLength(1)
    expect(out[0]?.to).toBe(8)
    expect(out[0]?.warps).toEqual([0, 1, 2, 3])
  })

  it('classifies a Vis with no Warp tile as a seamless walk-through', () => {
    // The monastery gate, the barracks gateway, the cathedral steps and the
    // Chaos Sanctuary entrance are all openings inside a preset: no click, no
    // loading screen.
    const graph = buildWorldGraph(
      parseLevelRows(levelsTable([{ Id: 26, Vis1: 27 }, { Id: 27, Vis0: 26 }])),
    )
    expect(edgesFrom(graph, 26)[0]?.kind).toBe('seamless')
    expect(edgesFrom(graph, 27)[0]?.kind).toBe('seamless')
  })

  it('classifies a Vis with a Warp tile as a warp', () => {
    const graph = buildWorldGraph(
      parseLevelRows(levelsTable([{ Id: 2, Vis3: 8, Warp3: 0 }, { Id: 8, Vis0: 2, Warp0: 4 }])),
    )
    expect(edgesFrom(graph, 2)[0]?.kind).toBe('warp')
  })

  it('ignores a Vis pointing at a level that does not exist', () => {
    const graph = buildWorldGraph(parseLevelRows(levelsTable([{ Id: 2, Vis0: 999, Warp0: 4 }])))
    expect(graph.edges).toHaveLength(0)
  })

  it('never emits an edge to or from the Null row', () => {
    const graph = buildWorldGraph(parseLevelRows(levelsTable([{ Id: 0 }, { Id: 2, Vis0: 0 }])))
    expect(graph.edges).toHaveLength(0)
  })

  it('collects waypoints and skips the 255 sentinel', () => {
    const graph = buildWorldGraph(
      parseLevelRows(levelsTable([{ Id: 1, Waypoint: 0 }, { Id: 2 }, { Id: 3, Waypoint: 1 }])),
    )
    expect(graph.waypoints.get(0)).toBe(1)
    expect(graph.waypoints.get(1)).toBe(3)
    expect(graph.waypoints.size).toBe(2)
  })
})

describe('the hard-coded adjacency table', () => {
  it('supplies the connections Levels.txt omits', () => {
    // Act 1 town really does have every Vis at 0 and every Warp at -1: built
    // from the table alone, the player could never leave the Rogue Encampment.
    const table = levelsTable([{ Id: 1, Name: 'Act 1 - Town' }, { Id: 2, Name: 'Act 1 - Wilderness 1' }])
    const rows = parseLevelRows(table)
    expect(rows.every(row => row.vis.every(value => value === 0))).toBe(true)

    const graph = buildWorldGraph(rows)
    expect(edgesFrom(graph, 1).map(edge => edge.to)).toEqual([2])
    expect(edgesFrom(graph, 2).map(edge => edge.to)).toEqual([1])
    expect(edgesFrom(graph, 1)[0]?.kind).toBe('seamless')
  })

  it('lists every pair only once and never as a self-loop', () => {
    const seen = new Set<string>()
    for (const [a, b] of SEAMLESS_ADJACENCY) {
      const key = a < b ? `${String(a)}:${String(b)}` : `${String(b)}:${String(a)}`
      expect(seen.has(key)).toBe(false)
      expect(a).not.toBe(b)
      seen.add(key)
    }
  })

  it('outranks a Vis edge describing the same pair', () => {
    const graph = buildWorldGraph(
      parseLevelRows(levelsTable([{ Id: 1, Vis0: 2, Warp0: 7 }, { Id: 2, Vis0: 1, Warp0: 7 }])),
    )
    expect(edgesFrom(graph, 1)[0]?.kind).toBe('seamless')
    expect(edgesFrom(graph, 1)[0]?.source).toBe('adjacency')
  })
})

describe('dropped Vis edges', () => {
  it('discards the Pandemonium-to-Graveyard copy-paste artifact', () => {
    // Row 133 is LevelType 4 — the Act 1 crypt type — and its whole Vis/Warp
    // block is a duplicate of row 18. Level 17 does not point back.
    expect(DROPPED_VIS_EDGES).toContainEqual([133, 17])
    const graph = buildWorldGraph(
      parseLevelRows(levelsTable([{ Id: 133, Vis0: 17, Warp0: 8 }, { Id: 17 }])),
    )
    expect(graph.edges).toHaveLength(0)
  })
})

describe('oppositeSide', () => {
  it('pairs the four sides', () => {
    expect(oppositeSide('north')).toBe('south')
    expect(oppositeSide('south')).toBe('north')
    expect(oppositeSide('east')).toBe('west')
    expect(oppositeSide('west')).toBe('east')
  })

  it('is an involution on every side', () => {
    for (const side of SIDES) expect(oppositeSide(oppositeSide(side))).toBe(side)
  })
})

describe('PRESET_SEAM_SIDES', () => {
  const allPresetAndSampleLevels = [1, 2, 3, 7, 26, 27, 28, 32, 33, 40, 41, 75, 76, 77, 78, 79, 103, 104, 107, 108, 109, 110]
  const graph = buildWorldGraph(
    parseLevelRows(
      levelsTable(
        allPresetAndSampleLevels.map(Id => {
          if (Id === 26) return { Id, Vis1: 27 }
          if (Id === 27) return { Id, Vis0: 26, Vis1: 28 }
          if (Id === 28) return { Id, Vis0: 27 }
          if (Id === 32) return { Id, Vis1: 33 }
          if (Id === 33) return { Id, Vis0: 32 }
          if (Id === 107) return { Id, Vis1: 108 }
          if (Id === 108) return { Id, Vis0: 107 }
          return { Id }
        }),
      ),
    ),
  )

  it('populates opposite sides for every preset-anchored seam', () => {
    expect(PRESET_SEAM_SIDES.size).toBe(10)
    for (const [key, expectedSide] of PRESET_SEAM_SIDES.entries()) {
      const [aStr, bStr] = key.split(':')
      const a = Number(aStr)
      const b = Number(bStr)
      const forward = graph.edges.find(edge => edge.from === a && edge.to === b)
      const backward = graph.edges.find(edge => edge.from === b && edge.to === a)
      expect(forward?.sideFrom).toBe(expectedSide)
      expect(forward?.sideTo).toBe(oppositeSide(expectedSide))
      expect(backward?.sideFrom).toBe(oppositeSide(expectedSide))
      expect(backward?.sideTo).toBe(expectedSide)
    }
  })

  it('leaves DRLG outdoor-to-outdoor seams without a static side', () => {
    const outdoorEdge = graph.edges.find(edge => edge.from === 2 && edge.to === 3)
    expect(outdoorEdge?.kind).toBe('seamless')
    expect(outdoorEdge?.sideFrom).toBeNull()
    expect(outdoorEdge?.sideTo).toBeNull()
  })

  it('never puts two of a level\u2019s preset seams on the same side', () => {
    const used = new Map<number, Set<Side>>()
    for (const edge of graph.edges) {
      if (edge.kind !== 'seamless' || edge.sideFrom === null) continue
      let sides = used.get(edge.from)
      if (sides === undefined) {
        sides = new Set<Side>()
        used.set(edge.from, sides)
      }
      expect(sides.has(edge.sideFrom)).toBe(false)
      sides.add(edge.sideFrom)
    }
  })

  it('includes the Act 3 Jungle 76<->78 alternate branch in SEAMLESS_ADJACENCY', () => {
    const branch = graph.edges.find(edge => edge.from === 76 && edge.to === 78)
    expect(branch).toBeDefined()
    expect(branch?.kind).toBe('seamless')
  })

  it('leaves warp edges without a side', () => {
    const warpGraph = buildWorldGraph(
      parseLevelRows(levelsTable([{ Id: 2, Vis3: 8, Warp3: 0 }, { Id: 8, Vis0: 2, Warp0: 4 }])),
    )
    const warp = warpGraph.edges.find(edge => edge.kind === 'warp')
    expect(warp?.sideFrom).toBeNull()
  })
})

describe('seamlessPairs', () => {
  it('returns each seam once, low id first, in a stable order', () => {
    const graph = buildWorldGraph(parseLevelRows(levelsTable([{ Id: 1 }, { Id: 2 }, { Id: 3 }])))
    const pairs = seamlessPairs(graph)
    expect(pairs).toEqual([
      [1, 2],
      [2, 3],
    ])
  })
})

describe('reachableFrom', () => {
  it('walks the chain', () => {
    const graph = buildWorldGraph(parseLevelRows(levelsTable([{ Id: 1 }, { Id: 2 }, { Id: 3 }, { Id: 4 }])))
    expect([...reachableFrom(graph, 1)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('reports an island as unreachable', () => {
    const graph = buildWorldGraph(parseLevelRows(levelsTable([{ Id: 1 }, { Id: 2 }, { Id: 46 }])))
    expect(reachableFrom(graph, 1).has(46)).toBe(false)
  })
})

describe('parseWarpGeometry', () => {
  const lvlwarp: D2Table = {
    header: [
      'Name',
      'Id',
      'SelectX',
      'SelectY',
      'SelectDX',
      'SelectDY',
      'ExitWalkX',
      'ExitWalkY',
      'OffsetX',
      'OffsetY',
      'LitVersion',
      'Tiles',
      'Direction',
      'Beta',
    ],
    rows: [
      ['Act 1 Wilderness', '0', '-90', '-100', '90', '110', '5', '0', '1', '-1', '1', '2', 'b', '1'],
      ['Act 5 Barricade L', '71', '-50', '-110', '110', '150', '0', '5', '5', '1', '1', '4', 'l', '0'],
      ['Act 5 Barricade R', '71', '-40', '-80', '210', '110', '0', '5', '-1', '3', '1', '4', 'r', '0'],
      ['Walk in', '19', '0', '0', '0', '0', '0', '0', '0', '0', '0', '2', 'b', '1'],
      ['Expansion', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ],
  }

  it('keys duplicate ids on their direction', () => {
    // Ids 71, 73, 74, 81 and 82 each appear twice for the Act 5 barricades;
    // keying on the id alone silently loses one of each pair.
    const geometry = parseWarpGeometry(lvlwarp)
    expect(findWarpGeometry(geometry, 71, 'l')?.selectDX).toBe(110)
    expect(findWarpGeometry(geometry, 71, 'r')?.selectDX).toBe(210)
  })

  it('skips the Expansion separator row', () => {
    expect(parseWarpGeometry(lvlwarp).size).toBe(4)
  })

  it('keeps a negative arrival offset', () => {
    // Negative is deliberate: landing on the warp tile would re-trigger it.
    expect(findWarpGeometry(parseWarpGeometry(lvlwarp), 0)?.offsetY).toBe(-1)
  })

  it('treats a zero-area hitbox as not clickable', () => {
    const geometry = parseWarpGeometry(lvlwarp)
    const walkIn = findWarpGeometry(geometry, 19)
    const clickable = findWarpGeometry(geometry, 0)
    expect(walkIn === undefined ? null : isClickableWarp(walkIn)).toBe(false)
    expect(clickable === undefined ? null : isClickableWarp(clickable)).toBe(true)
  })

  it('falls back to any direction when none is asked for', () => {
    expect(findWarpGeometry(parseWarpGeometry(lvlwarp), 71)?.id).toBe(71)
  })
})

describe('seamArrivalSpot', () => {
  function makeGrid(width: number, height: number, blockedIndices: Set<number> = new Set()): LinkGrid {
    const blocked = new Uint8Array(width * height)
    for (const idx of blockedIndices) {
      blocked[idx] = 1
    }
    return {
      cellsX: Math.ceil(width / 5),
      cellsY: Math.ceil(height / 5),
      gridWidth: width,
      gridHeight: height,
      blocked,
    }
  }

  it('places arrival strictly outside trigger box on all 4 sides', () => {
    const grid = makeGrid(50, 50)
    const sides: Side[] = ['north', 'south', 'east', 'west']
    const x = 25
    const y = 25

    for (const side of sides) {
      const spot = seamArrivalSpot(grid, x, y, side)
      const insideTriggerBox =
        Math.abs(spot.x - x) <= SEAM_TRIGGER_SUBTILES &&
        Math.abs(spot.y - y) <= SEAM_TRIGGER_SUBTILES
      expect(insideTriggerBox).toBe(false)
      expect(spot).not.toEqual({ x, y })
    }
  })

  it('never bounces back to trigger tile (x, y) even when completely blocked', () => {
    // A grid where every single tile is impassable
    const blockedSet = new Set<number>()
    for (let i = 0; i < 50 * 50; i++) blockedSet.add(i)
    const grid = makeGrid(50, 50, blockedSet)

    const spot = seamArrivalSpot(grid, 20, 0, 'north')
    // Must never fall back to trigger tile (20, 0)
    expect(spot).not.toEqual({ x: 20, y: 0 })
    const insideTriggerBox =
      Math.abs(spot.x - 20) <= SEAM_TRIGGER_SUBTILES &&
      Math.abs(spot.y - 0) <= SEAM_TRIGGER_SUBTILES
    expect(insideTriggerBox).toBe(false)
  })

  it('ignores walkable tiles inside trigger radius and finds the nearest valid tile outside', () => {
    // Only the trigger tile itself and its immediate neighbors (radius 2) are walkable
    const blockedSet = new Set<number>()
    for (let i = 0; i < 50 * 50; i++) blockedSet.add(i)
    // Clear trigger tile and one tile far inward
    blockedSet.delete(0 * 50 + 20) // trigger (20, 0)
    blockedSet.delete(1 * 50 + 20) // (20, 1) inside trigger box
    blockedSet.delete(10 * 50 + 20) // (20, 10) valid outside trigger box

    const grid = makeGrid(50, 50, blockedSet)
    const spot = seamArrivalSpot(grid, 20, 0, 'north')

    expect(spot).toEqual({ x: 20, y: 10 })
    expect(Math.abs(spot.y - 0)).toBeGreaterThan(SEAM_TRIGGER_SUBTILES)
  })
})

describe('ACT_TOWNS and townLevelForAct single source of truth', () => {
  it('defines the correct canonical town level IDs for Acts 1..5', () => {
    expect(ACT_TOWNS).toEqual([1, 40, 75, 103, 109])
  })

  it('resolves townLevelForAct for all 5 acts correctly', () => {
    expect(townLevelForAct(1)).toBe(1)
    expect(townLevelForAct(2)).toBe(40)
    expect(townLevelForAct(3)).toBe(75)
    expect(townLevelForAct(4)).toBe(103)
    expect(townLevelForAct(5)).toBe(109)
  })

  it('handles boundary / out-of-range acts gracefully', () => {
    expect(townLevelForAct(0)).toBe(1)
    expect(townLevelForAct(-5)).toBe(1)
    expect(townLevelForAct(6)).toBe(109)
    expect(townLevelForAct(99)).toBe(109)
  })

  it('actOfLevel correctly partitions level IDs matching ACT_TOWNS', () => {
    expect(actOfLevel(1)).toBe(1)
    expect(actOfLevel(39)).toBe(1)
    expect(actOfLevel(40)).toBe(2)
    expect(actOfLevel(74)).toBe(2)
    expect(actOfLevel(75)).toBe(3)
    expect(actOfLevel(102)).toBe(3)
    expect(actOfLevel(103)).toBe(4)
    expect(actOfLevel(108)).toBe(4)
    expect(actOfLevel(109)).toBe(5)
    expect(actOfLevel(136)).toBe(5)
  })
})
