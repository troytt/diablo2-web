/**
 * Issue #830: bit-exact tests of the 1.13c D2Client light grid (dLightMap.cpp) against the golden vectors of the
 * reference model `ref_lightgrid.py` (tests/fixtures/lighting/golden_830.json, V1..V8), plus the light record API
 * (CreateLight / SetRadius / SetTargetRadius / Kill / Free / LightUpdate), the light mode hysteresis, the FPS
 * counter and RAND.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LIGHT_GRID_CELL_COUNT,
  LIGHT_GRID_SIZE,
  LightFpsCounter,
  LightGrid,
  LightList,
  LightRecord,
  WALL_LIGHT_OFFSETS_DEFAULT_113C,
  WALL_LIGHT_OFFSETS_FADED_113C,
  WALL_LIGHT_SAMPLE_COUNTS_113C,
  applyLightShadowed,
  applyLightUnshadowed,
  createLightModeState,
  createLightShadowScratch,
  d2Rand,
  fastDistanceApprox,
  lightPos8,
  selectLightMode,
  tileDrawEntryPos8,
  tileTypeToLightDirection113c,
  unitDrawEntryPos8,
  wallColumnIndexForBlockPosX113c,
  wallLightSamplePoints113c,
  type LightBuildEnv,
  type LightCollisionAt,
} from '../src/common/drlg/light-grid.ts'
import { COLLIDE_BLANK, COLLIDE_DOOR, COLLIDE_VISIBLE, COLLIDE_WALL } from '../src/common/world/d2map.ts'

interface Golden {
  V1_addlight: { Iold: number; Cold: number; v: number; C: number; Inew: number; Cnew: number }[]
  V2_player_r13_open: {
    origin: [number, number]
    light_x8: number
    light_y8: number
    r8: number
    row_gy25_I_gx10_40: number[]
    diag_I_gx_eq_gy_10_40: number[]
    cell_25_25: [number, number]
    sha1: string
    I: number[]
    R: number[]
  }
  V2b_unshadowed_equal: boolean
  V3_player_r13_wall_gx29: {
    row_gy25_I_gx20_40: number[]
    row_gy19_I_gx20_40: number[]
    window_I_gx26_38_gy16_34: number[][]
    sha1: string
    I: number[]
    flag: number[]
  }
  V4_ambient_plus_colored: {
    light_x8: number
    light_y8: number
    cell_gx28_gy22_IRGB: number[]
    row_gy22_IRGB_gx22_35: number[][]
    sha1: string
  }
  V5_mode0: Record<string, { row_gy25_I_gx20_30: number[]; lit_cells: number }>
  V6_near_room: {
    room: { subX: number; subY: number; subW: number; subH: number }
    cols: [number, number]
    rows: [number, number]
    filled_cells: number
  }
  V7_getlight: Record<string, number>
  V8_ramp_r8_per_build: number[]
}

const golden = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/lighting/golden_830.json'), 'utf8'),
) as Golden

const N = LIGHT_GRID_SIZE

function digest(g: LightGrid): string {
  const h = createHash('sha1')
  for (const arr of [g.blocked, g.intensity, g.red, g.green, g.blue]) h.update(arr)
  return h.digest('hex')
}

/** Common setup of the reference: local player at sub-tile (1000, 1000), precise (1000 << 16) | 0x8000. */
const PLAYER_SUB = 1000
const PLAYER_X8 = lightPos8(PLAYER_SUB + 0.5)

function playerGrid(): LightGrid {
  const g = new LightGrid()
  g.setOrigin(PLAYER_SUB, PLAYER_SUB)
  g.fill(0, 0, N - 1, N - 1, 0, 0, 0, 0)
  return g
}

function playerLight(radius: number, unitType: number, unitId: number, type: 0 | 1 | 2 = 0): LightRecord {
  return new LightRecord({ unitType, unitId }, type, radius, 255, 255, 255, 255, PLAYER_X8, PLAYER_X8)
}

const openCollision: LightCollisionAt = () => 0

function env(over: Partial<LightBuildEnv> = {}): LightBuildEnv {
  return { collisionAt: openCollision, localPlayerId: 1, scratch: createLightShadowScratch(), ...over }
}

describe('#830 light grid: golden vectors of ref_lightgrid.py', () => {
  it('V1: AddToCell blends with recip[I + v] and the coloured branch even at I = 0', () => {
    for (const c of golden.V1_addlight) {
      const g = new LightGrid()
      g.fill(0, 0, 0, 0, c.Iold, c.Cold, c.Cold, c.Cold)
      g.addToCell(0, 0, c.v, c.C, c.C, c.C)
      expect([g.intensity[0], g.red[0], g.green[0], g.blue[0]]).toEqual([c.Inew, c.Cnew, c.Cnew, c.Cnew])
    }
  })

  it('V2: radius-13 player light, shadowed path, no obstacles (full grid bit-exact)', () => {
    const v = golden.V2_player_r13_open
    const g = playerGrid()
    expect([g.originSubX, g.originSubY]).toEqual(v.origin)
    const l = playerLight(13, 0, 1)
    expect([l.x8, l.y8, l.r]).toEqual([v.light_x8, v.light_y8, v.r8])
    applyLightShadowed(g, l, createLightShadowScratch())
    expect(Array.from(g.intensity)).toEqual(v.I)
    expect(Array.from(g.red)).toEqual(v.R)
    expect(Array.from(g.intensity.subarray(25 * N + 10, 25 * N + 41))).toEqual(v.row_gy25_I_gx10_40)
    expect(Array.from({ length: 31 }, (_, i) => g.intensity[(10 + i) * N + 10 + i])).toEqual(v.diag_I_gx_eq_gy_10_40)
    expect([g.intensity[25 * N + 25], g.red[25 * N + 25]]).toEqual(v.cell_25_25)
    expect(digest(g)).toBe(v.sha1)
  })

  it('V2b: the unshadowed path gives the same bytes when nothing blocks', () => {
    const g = playerGrid()
    applyLightUnshadowed(g, playerLight(13, 0, 1), 2, 1)
    expect(golden.V2b_unshadowed_equal).toBe(true)
    expect(digest(g)).toBe(golden.V2_player_r13_open.sha1)
  })

  it('V3: a wall column at gx 29 (gy 18..32) shades the cells behind it (full grid bit-exact)', () => {
    const v = golden.V3_player_r13_wall_gx29
    const g = playerGrid()
    for (let gy = 18; gy <= 32; gy += 1) g.blocked[gy * N + 29] = 1
    applyLightShadowed(g, playerLight(13, 0, 1), createLightShadowScratch())
    expect(Array.from(g.intensity)).toEqual(v.I)
    expect(Array.from(g.blocked)).toEqual(v.flag)
    expect(Array.from(g.intensity.subarray(25 * N + 20, 25 * N + 41))).toEqual(v.row_gy25_I_gx20_40)
    expect(Array.from(g.intensity.subarray(19 * N + 20, 19 * N + 41))).toEqual(v.row_gy19_I_gx20_40)
    const window = Array.from({ length: 19 }, (_, j) =>
      Array.from(g.intensity.subarray((16 + j) * N + 26, (16 + j) * N + 39)),
    )
    expect(window).toEqual(v.window_I_gx26_38_gy16_34)
    expect(digest(g)).toBe(v.sha1)
  })

  it('V4: ambient prefill plus a coloured type-1 light at a static sub-tile', () => {
    const v = golden.V4_ambient_plus_colored
    const g = new LightGrid()
    g.setOrigin(PLAYER_SUB, PLAYER_SUB)
    g.fill(0, 0, N - 1, N - 1, 60, 80, 90, 255)
    const x8 = 1004 * 8 + 4
    const y8 = 998 * 8 + 4
    expect([x8, y8]).toEqual([v.light_x8, v.light_y8])
    const l = new LightRecord({ unitType: 2, unitId: 5 }, 1, 6, 255, 255, 160, 64, x8, y8)
    applyLightUnshadowed(g, l, 2, -1)
    const k = 22 * N + 28
    expect([g.intensity[k], g.red[k], g.green[k], g.blue[k]]).toEqual(v.cell_gx28_gy22_IRGB)
    const row = Array.from({ length: 14 }, (_, i) => {
      const c = 22 * N + 22 + i
      return [g.intensity[c], g.red[c], g.green[c], g.blue[c]]
    })
    expect(row).toEqual(v.row_gy22_IRGB_gx22_35)
    expect(digest(g)).toBe(v.sha1)
  })

  it('V5: mode-0 clamps (monster r = 8, other player r <= 16, local player full, missile skipped)', () => {
    const cases: [string, number, number, number, 0 | 1][] = [
      ['monster_r10', 1, 7, 10, 0],
      ['other_player_r13', 0, 2, 13, 0],
      ['local_player_r13', 0, 1, 13, 0],
      ['missile_r5', 3, 9, 5, 1],
    ]
    for (const [name, unitType, unitId, radius, type] of cases) {
      const g = playerGrid()
      applyLightUnshadowed(g, playerLight(radius, unitType, unitId, type), 0, 1)
      const want = golden.V5_mode0[name]!
      expect(Array.from(g.intensity.subarray(25 * N + 20, 25 * N + 31)), name).toEqual(want.row_gy25_I_gx20_30)
      expect(g.intensity.reduce((n, x) => n + (x !== 0 ? 1 : 0), 0), name).toBe(want.lit_cells)
    }
  })

  it('V6: the near-room prefill rectangle is inclusive and clamped at 47', () => {
    const v = golden.V6_near_room
    const g = new LightGrid()
    g.setOrigin(PLAYER_SUB, PLAYER_SUB)
    g.fillAmbient({ intensity: 10, red: 1, green: 2, blue: 3 }, [
      { ...v.room, ambient: { intensity: 99, red: 4, green: 5, blue: 6 } },
    ])
    expect(g.intensity.reduce((n, x) => n + (x === 99 ? 1 : 0), 0)).toBe(v.filled_cells)
    for (let gy = 0; gy < N; gy += 1) {
      for (let gx = 0; gx < N; gx += 1) {
        const inside = gx >= v.cols[0] && gx <= v.cols[1] && gy >= v.rows[0] && gy <= v.rows[1]
        const k = gy * N + gx
        expect([g.intensity[k], g.red[k], g.green[k], g.blue[k]]).toEqual(inside ? [99, 4, 5, 6] : [10, 1, 2, 3])
      }
    }
  })

  it('V7: GetLightAt reads the nearest cell and clamps to the grid edge', () => {
    const v = golden.V7_getlight
    const g = new LightGrid()
    g.setOrigin(PLAYER_SUB, PLAYER_SUB)
    for (let k = 0; k < LIGHT_GRID_CELL_COUNT; k += 1) g.intensity[k] = k % 251
    expect(g.getLightAt(1000 * 8, 1000 * 8)[0]).toBe(v['inside_(1000*8,1000*8)'])
    expect(g.getLightAt(900 * 8, 1000 * 8)[0]).toBe(v['left_of_grid_(900*8,1000*8)'])
    expect(v.expected_left).toBe(v['left_of_grid_(900*8,1000*8)'])
  })

  it('V8: a light ramps 8 (one sub-tile) per build towards its target radius', () => {
    const list = new LightList()
    const l = list.create({ unitType: 0, unitId: 1 }, 1, 1, 255, 255, 255, 255, PLAYER_X8, PLAYER_X8)!
    list.setTargetRadius(l, 8)
    const grid = playerGrid()
    const ramp: number[] = []
    for (let i = 0; i < 9; i += 1) {
      ramp.push(l.r)
      list.build(grid, 2, env())
    }
    expect(ramp).toEqual(golden.V8_ramp_r8_per_build)
  })
})

describe('#830 light grid: geometry, obstacles and texture', () => {
  it('fastDistanceApprox is (983 max + 407 min) >> 10', () => {
    expect(fastDistanceApprox(100, 0)).toBe((983 * 100) >> 10)
    expect(fastDistanceApprox(-3, 100)).toBe((983 * 100 + 407 * 3) >> 10)
    expect(fastDistanceApprox(100, 100)).toBe(135)
  })

  it('lightPos8 is floor(precise * 8) + 4 (never rounded)', () => {
    expect(lightPos8(1000.5)).toBe(8008)
    expect(lightPos8(1004)).toBe(8036)
    expect(lightPos8(10.999)).toBe(91)
  })

  it('setOrigin puts the path sub-tile at cell 24 and rejects fractional sub-tiles', () => {
    const g = new LightGrid()
    g.setOrigin(1000, 2000)
    expect([g.originSubX, g.originSubY]).toEqual([976, 1976])
    expect(() => g.setOrigin(1000.5, 2000)).toThrow(RangeError)
  })

  it('obstacles use mask 0x22 (visible | blank); walls and doors alone do not block; no data blocks', () => {
    const g = new LightGrid()
    g.setOrigin(24, 24)
    const masks = new Map<string, number>([
      ['1,0', COLLIDE_VISIBLE],
      ['2,0', COLLIDE_BLANK],
      ['3,0', COLLIDE_WALL],
      ['4,0', COLLIDE_DOOR],
    ])
    g.buildObstacles((x, y) => (x >= 10 ? undefined : (masks.get(`${String(x)},${String(y)}`) ?? 0)))
    expect(Array.from(g.blocked.subarray(0, 12))).toEqual([0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1])
    expect(g.flagAt(-1, 0)).toBe(1)
    expect(g.flagAt(48, 0)).toBe(1)
    expect(g.flagAt(1, 0)).toBe(1)
    expect(g.flagAt(3, 0)).toBe(0)
  })

  it('fillAmbient(null) zeroes the grid; bad ambient bytes throw', () => {
    const g = new LightGrid()
    g.fill(0, 0, N - 1, N - 1, 9, 9, 9, 9)
    g.fillAmbient(null, [])
    expect(g.intensity.every((x) => x === 0)).toBe(true)
    expect(() => g.fillAmbient({ intensity: 256, red: 0, green: 0, blue: 0 }, [])).toThrow(RangeError)
  })

  it('a near room just outside the grid edge (x0 = 48) is skipped, x0 = 47 fills one column', () => {
    const g = new LightGrid()
    g.setOrigin(24, 24)
    const amb = { intensity: 7, red: 7, green: 7, blue: 7 }
    g.fillAmbient({ intensity: 1, red: 1, green: 1, blue: 1 }, [
      { subX: 48, subY: 0, subW: 3, subH: 0, ambient: amb },
    ])
    expect(g.intensity.reduce((n, x) => n + (x === 7 ? 1 : 0), 0)).toBe(0)
    g.fillAmbient({ intensity: 1, red: 1, green: 1, blue: 1 }, [
      { subX: 47, subY: 0, subW: 3, subH: 0, ambient: amb },
    ])
    expect(g.intensity.reduce((n, x) => n + (x === 7 ? 1 : 0), 0)).toBe(1)
  })

  it('exportTextureBuffer stores floor(I*C/255) and A = I', () => {
    const g = new LightGrid()
    g.fill(0, 0, 0, 0, 200, 60, 255, 0)
    const tex = g.exportTextureBuffer()
    expect(Array.from(tex.subarray(0, 4))).toEqual([Math.floor((200 * 60) / 255), 200, 0, 200])
  })
})

describe('#830 light records (CreateLight / SetRadius / Kill / Free / LightUpdate)', () => {
  it('CreateLight: radius <= 0 makes no light, radius clamps to 18, new records go to the head', () => {
    const list = new LightList()
    expect(list.create(null, 1, 0, 255, 1, 2, 3, 0, 0)).toBeNull()
    const a = list.create(null, 1, 30, 255, 1, 2, 3, 0, 0)!
    const b = list.create({ unitType: 1, unitId: 4 }, 0, 5, 255, 1, 2, 3, 0, 0)!
    expect(a.r).toBe(18 * 8)
    expect(a.unitType).toBe(6)
    expect(list.head).toBe(b)
    expect([...list]).toEqual([b, a])
    expect(() => list.create(null, 1, 2.5, 255, 1, 2, 3, 0, 0)).toThrow(RangeError)
    expect(() => list.create(null, 1, 2, 255, 300, 2, 3, 0, 0)).toThrow(RangeError)
  })

  it('SetRadius is immediate (<= 0 ignored); SetTargetRadius ramps; GetRadius is r >> 3', () => {
    const list = new LightList()
    const l = list.create(null, 1, 4, 255, 255, 255, 255, 0, 0)!
    list.setRadius(l, 0)
    expect(l.r).toBe(32)
    list.setRadius(l, 9)
    expect([l.r, l.target, list.getRadius(l)]).toEqual([72, 72, 9])
    list.setTargetRadius(l, 7)
    list.build(playerGrid(), 2, env())
    expect(l.r).toBe(64)
  })

  it('Kill fades 8 per build at the last position and frees the record at r <= 0', () => {
    const list = new LightList()
    const l = list.create({ unitType: 3, unitId: 9 }, 1, 2, 255, 255, 255, 255, PLAYER_X8, PLAYER_X8)!
    list.kill(l)
    const grid = playerGrid()
    const pos = (): { x8: number; y8: number } => ({ x8: 0, y8: 0 })
    list.build(grid, 2, env({ ownerPos8: pos }))
    expect([l.r, l.x8, list.size]).toEqual([8, PLAYER_X8, 1])
    list.build(grid, 2, env({ ownerPos8: pos }))
    expect([l.linked, list.size]).toEqual([false, 0])
  })

  it('LightUpdate follows the owner position and keeps the last one when the owner is gone', () => {
    const list = new LightList()
    const l = list.create({ unitType: 1, unitId: 3 }, 1, 2, 255, 255, 255, 255, 0, 0)!
    const grid = playerGrid()
    list.build(grid, 2, env({ ownerPos8: () => ({ x8: 8100, y8: 8020 }) }))
    expect([l.x8, l.y8]).toEqual([8100, 8020])
    list.build(grid, 2, env({ ownerPos8: () => null }))
    expect([l.x8, l.y8]).toEqual([8100, 8020])
  })

  it('a type-2 light builds its occlusion cache once from direct collision reads and rebuilds after a resize', () => {
    const list = new LightList()
    const x8 = 1004 * 8 + 4
    const y8 = 1000 * 8 + 4
    const l = list.create({ unitType: 2, unitId: 11 }, 2, 6, 255, 255, 200, 100, x8, y8)!
    let reads = 0
    const collisionAt: LightCollisionAt = (x) => {
      reads += 1
      return x === 1007 ? COLLIDE_VISIBLE : 0
    }
    const grid = playerGrid()
    list.build(grid, 2, env({ collisionAt }))
    expect(l.cacheValid).toBe(true)
    expect(reads).toBe(64 * 64)
    const behindWall = grid.intensity[(1000 - 976) * N + (1009 - 976)]!
    const inFront = grid.intensity[(1000 - 976) * N + (1001 - 976)]!
    expect(behindWall).toBe(0)
    expect(inFront).toBeGreaterThan(0)
    list.build(playerGrid(), 2, env({ collisionAt }))
    expect(reads).toBe(64 * 64)
    list.setRadius(l, 4)
    expect(l.cacheValid).toBe(false)
    list.build(playerGrid(), 2, env({ collisionAt }))
    expect(reads).toBe(2 * 64 * 64)
  })

  it('type-0 lights are shadowed only in mode 2', () => {
    const wall = (g: LightGrid): void => {
      for (let gy = 18; gy <= 32; gy += 1) g.blocked[gy * N + 29] = 1
    }
    const lit = (mode: 0 | 1 | 2): number => {
      const list = new LightList()
      list.create({ unitType: 0, unitId: 1 }, 0, 13, 255, 255, 255, 255, PLAYER_X8, PLAYER_X8)
      const g = playerGrid()
      wall(g)
      list.build(g, mode, env())
      return g.intensity[25 * N + 31]!
    }
    expect(lit(2)).toBe(0)
    expect(lit(1)).toBeGreaterThan(0)
  })
})

describe('#830 light mode, FPS counter and RAND', () => {
  it('selectLightMode: quality 0 forces mode 0; FPS bands 9 / 12 / 15 with 2000 ms hysteresis', () => {
    const s = createLightModeState()
    expect(selectLightMode(2, 25, 0, s)).toBe(2)
    expect(selectLightMode(2, 8, 1000, s)).toBe(2) // change refused within 2000 ms
    expect(selectLightMode(2, 8, 2001, s)).toBe(0)
    expect(selectLightMode(2, 14, 5000, s)).toBe(1) // 13..15 keeps a mode >= 1, else 1
    expect(selectLightMode(2, 14, 9000, s)).toBe(1)
    expect(selectLightMode(2, 11, 9100, s)).toBe(1)
    expect(selectLightMode(0, 60, 20000, s)).toBe(0)
    expect(selectLightMode(1, 60, 30000, s)).toBe(2)
  })

  it('the FPS counter starts at 25 and reports frames / 3 after a window longer than 3000 ms', () => {
    const f = new LightFpsCounter()
    expect(f.fps).toBe(25)
    for (let t = 0; t <= 3000; t += 100) f.onFrameRendered(t)
    expect(f.fps).toBe(25)
    f.onFrameRendered(3001)
    expect(f.fps).toBe(Math.floor(32 / 3))
  })

  it('d2Rand advances the 64-bit LCG lo * 0x6ac690c5 + hi', () => {
    const seed = { lo: 1, hi: 0 }
    expect(d2Rand(seed, 10)).toBe(0x6ac690c5 % 10)
    expect(seed).toEqual({ lo: 0x6ac690c5, hi: 0 })
    const next = BigInt(0x6ac690c5) * 0x6ac690c5n
    expect(d2Rand(seed, 8)).toBe(Number(next & 0xffffffffn) & 7)
    expect(seed.hi).toBe(Number(next >> 32n))
    expect(d2Rand(seed, 0)).toBe(0)
  })
})

describe('#877 draw-entry x8 units (Q1), roof branch (Q6) and 6-point wall light tables (0x6fb80a70 / 0x6fb8ed18 / 0x6fb8eef8)', () => {
  it('tileDrawEntryPos8 and unitDrawEntryPos8 produce exact x8 coordinates (subtile << 3)', () => {
    // Tiles (0x6fb29c80, 0x6fb29d30, 0x6fb29e20, 0x6fb2a340): (roomSub + nPos * 5) << 3 = cell * 40
    expect(tileDrawEntryPos8(0, 0)).toEqual([0, 0])
    expect(tileDrawEntryPos8(10, 20)).toEqual([400, 800])
    expect(() => tileDrawEntryPos8(1.5, 2)).toThrow(RangeError)

    // Static units (0x6fb2a180, 0x6fb2a260, 0x6fb2a500): pStaticPath->dwPos << 3
    expect(unitDrawEntryPos8(101, 102, false)).toEqual([808, 816])
    expect(unitDrawEntryPos8(100.9, 102.1, false)).toEqual([800, 816])

    // Dynamic units: D2Common.#10867 / #10750 wPos << 3 (port sub + 0.5 floored, << 3)
    expect(unitDrawEntryPos8(100.6, 100.4, true)).toEqual([808, 800])
  })

  it('WALL_LIGHT_SAMPLE_COUNTS_113C (0x6fb80a70) and the two 10-entry offset tables (0x6fb8ed18 / 0x6fb8eef8) match D2Client.dll bytes', () => {
    expect(WALL_LIGHT_SAMPLE_COUNTS_113C).toEqual([0, 6, 6, 6, 6, 0, 6, 6, 6, 6])
    expect(WALL_LIGHT_OFFSETS_DEFAULT_113C).toHaveLength(10)
    expect(WALL_LIGHT_OFFSETS_FADED_113C).toHaveLength(10)

    // Entry 0 (floor) and entry 5 (roof, routed to 0x6fb29d30 / 0x6fac3a00) have sample count 0
    expect(wallLightSamplePoints113c(10, 20, 0, false)).toEqual([])
    expect(wallLightSamplePoints113c(10, 20, 5, false)).toEqual([])
    expect(wallLightSamplePoints113c(10, 20, 5, true)).toEqual([])

    // Golden sample coordinates at cell (10, 20) -> entry = (400, 800) for all 8 wall/shadow lightDirections
    expect(wallLightSamplePoints113c(10, 20, 1, false)).toEqual([
      [416, 840],
      [424, 832],
      [432, 824],
      [440, 816],
      [448, 808],
      [456, 800],
    ])
    expect(wallLightSamplePoints113c(10, 20, 1, true)).toEqual([
      [400, 824],
      [408, 816],
      [416, 808],
      [424, 800],
      [432, 792],
      [440, 784],
    ])
    expect(wallLightSamplePoints113c(10, 20, 2, false)).toEqual([
      [400, 856],
      [408, 848],
      [416, 840],
      [424, 832],
      [432, 824],
      [440, 816],
    ])
    expect(wallLightSamplePoints113c(10, 20, 2, true)).toEqual([
      [384, 840],
      [392, 832],
      [400, 824],
      [408, 816],
      [416, 808],
      [424, 800],
    ])
    expect(wallLightSamplePoints113c(10, 20, 3, false)).toEqual([
      [400, 856],
      [408, 848],
      [416, 840],
      [432, 824],
      [440, 816],
      [448, 808],
    ])
    expect(wallLightSamplePoints113c(10, 20, 3, true)).toEqual([
      [384, 840],
      [392, 832],
      [400, 824],
      [416, 808],
      [424, 800],
      [432, 792],
    ])
    expect(wallLightSamplePoints113c(10, 20, 4, false)).toEqual([
      [432, 856],
      [440, 856],
      [440, 856],
      [456, 840],
      [456, 840],
      [456, 832],
    ])
    expect(wallLightSamplePoints113c(10, 20, 4, true)).toEqual([
      [400, 832],
      [408, 824],
      [408, 824],
      [424, 808],
      [424, 808],
      [432, 800],
    ])
    expect(wallLightSamplePoints113c(10, 20, 6, false)).toEqual([
      [400, 832],
      [408, 832],
      [416, 824],
      [424, 816],
      [432, 808],
      [440, 800],
    ])
    expect(wallLightSamplePoints113c(10, 20, 6, true)).toEqual([
      [400, 840],
      [408, 832],
      [416, 824],
      [424, 816],
      [432, 808],
      [440, 800],
    ])
    expect(wallLightSamplePoints113c(10, 20, 7, false)).toEqual([
      [400, 840],
      [408, 832],
      [416, 824],
      [424, 816],
      [432, 808],
      [432, 800],
    ])
    expect(wallLightSamplePoints113c(10, 20, 8, false)).toEqual([
      [400, 840],
      [408, 832],
      [416, 824],
      [424, 816],
      [432, 808],
      [440, 800],
    ])
    expect(wallLightSamplePoints113c(10, 20, 9, false)).toEqual([
      [416, 824],
      [424, 824],
      [424, 824],
      [424, 824],
      [424, 824],
      [424, 816],
    ])
    expect(() => wallLightSamplePoints113c(0, 0, -1)).toThrow(RangeError)
    expect(() => wallLightSamplePoints113c(0, 0, 10)).toThrow(RangeError)
  })

  it('tileTypeToLightDirection113c maps all DT1 orientations 0..19 to pTileGfx->nLightDirection 1..9', () => {
    const mapping = Array.from({ length: 20 }, (_, t) => tileTypeToLightDirection113c(t))
    expect(mapping).toEqual([
      3, // 0: floor
      1, // 1: left wall
      2, // 2: right wall
      3, // 3: right part of north corner wall
      3, // 4: left part of north corner wall
      1, // 5: left end wall
      2, // 6: right end wall
      4, // 7: south corner wall
      1, // 8: left wall with door
      2, // 9: right wall with door
      1, // 10: special tile 1
      2, // 11: special tile 2
      3, // 12: pillars / columns
      3, // 13: shadow
      3, // 14: tree
      5, // 15: roof
      6, // 16: lower wall equivalent to 1
      7, // 17: lower wall equivalent to 2
      8, // 18: lower wall equivalent to 3/4
      9, // 19: lower wall equivalent to 7
    ])
    expect(() => tileTypeToLightDirection113c(20)).toThrow(RangeError)
  })

  it('wallColumnIndexForBlockPosX113c maps 32px DT1 block columns (posX >> 5) to 0..4 (Q11)', () => {
    expect([0, 32, 64, 96, 128].map((x) => wallColumnIndexForBlockPosX113c(x))).toEqual([0, 1, 2, 3, 4])
    expect(() => wallColumnIndexForBlockPosX113c(-32)).toThrow(RangeError)
    expect(() => wallColumnIndexForBlockPosX113c(160)).toThrow(RangeError)
  })

  it('LightGrid.sampleWallLights samples getLightAt at the 6 offset points of the tile', () => {
    const g = new LightGrid()
    g.setOrigin(200, 200) // originSub = (176, 176)
    for (let k = 0; k < LIGHT_GRID_CELL_COUNT; k += 1) {
      g.intensity[k] = (k * 7) & 0xff
      g.red[k] = (k * 13) & 0xff
      g.green[k] = (k * 17) & 0xff
      g.blue[k] = (k * 23) & 0xff
    }
    // Cell (40, 40) -> sub (200, 200) -> entry (1600, 1600)
    const dir = tileTypeToLightDirection113c(1)
    const pts = wallLightSamplePoints113c(40, 40, dir, false)
    const expected = pts.map(([x8, y8]) => g.getLightAt(x8, y8))
    expect(g.sampleWallLights(40, 40, dir, false)).toEqual(expected)
  })
})

