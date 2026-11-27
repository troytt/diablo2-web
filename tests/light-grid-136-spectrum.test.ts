/**
 * Issue #830: the 1.13c light grid pass over every level id 1..136.
 *
 * Each level's room ambient (CLIENT_GetAmbientLight 0x6fb59a20, fresh ENVIRONMENT_Alloc clock) prefills the 48×48
 * grid (0x6fb59c90) around origin = path sub-tile − 24 (0x6fb59e8e), then the local player's radius-13 light
 * (0x6fac92f3) is added through AddToCell (0x6fb58a40). The collision is a synthetic open level (no real map is
 * generated here; the headless browser audit `tools/verify-environment-browser.ts` covers the real maps). For every
 * level: the pass builds without throwing (all ambient bytes valid), out-of-reach corners keep the ambient exactly,
 * the light's own corner is the AddToCell mix of the ambient, the texture is T[I][C] = floor(I·C/255) with A = I, and
 * corners outside the collision data are blocked (#10482 reports 0x27 for a missing room).
 */

import { describe, expect, it } from 'vitest'
import {
  fastDistanceApprox,
  LIGHT_GRID_SIZE,
  LIGHT_RECIP,
  LightGrid,
  lightPos8,
  PLAYER_LIGHT_RADIUS,
} from '../src/common/drlg/light-grid.ts'
import { resolveLevelAmbient } from '../src/common/world/ambient-light.ts'
import { Environment } from '../src/common/world/environment.ts'
import type { CollisionGrid } from '../src/common/world/d2map.ts'
import { applyLightingInputs, getLightingPassState } from '../src/client/scene/lighting-presets.ts'

const LEVEL_IDS = Array.from({ length: 136 }, (_, i) => i + 1)
const WIDTH = 120

/** A WIDTH×WIDTH sub-tile level without obstacles. */
function openGrid(): CollisionGrid {
  return {
    cellsX: WIDTH / 5,
    cellsY: WIDTH / 5,
    originX: 0,
    originY: 0,
    gridWidth: WIDTH,
    blocked: new Uint8Array(WIDTH * WIDTH),
    collisionMasks: new Uint16Array(WIDTH * WIDTH),
  }
}

function runPass(levelId: number, player: { x: number; y: number }): LightGrid {
  const playerRoom = resolveLevelAmbient(levelId, Environment.alloc())
  const grid = new LightGrid()
  const lit = applyLightingInputs(
    {
      preset: 'auto',
      levelId,
      collisionGrid: openGrid(),
      playerSubTile: player,
      playerUnitId: 1,
      lightEmitters: [],
      tick: 1,
      ambient: { playerRoom, nearRooms: [] },
    },
    { lightGrid: grid, renderer: { setLighting: () => {} }, lightQuality: 2, nowMs: 0 },
  )
  expect(lit).toBe(true)
  return grid
}

describe('issue #830 light grid over the 136 levels (synthetic open collision)', () => {
  it.each(LEVEL_IDS)('level %i: ambient prefill, player light, texture and void corners', (levelId) => {
    const amb = resolveLevelAmbient(levelId, Environment.alloc())
    const grid = runPass(levelId, { x: 60, y: 60 })
    expect(getLightingPassState(grid).lastMode).toBe(2)
    // Path sub-tile floor(60 + 0.5) = 60 → origin 36; the light sits at x8 = floor(60.5 * 8) + 4 = 488 (cell 25).
    expect([grid.originSubX, grid.originSubY]).toEqual([36, 36])
    const l8 = lightPos8(60.5)
    expect(l8).toBe(488)
    const r8 = PLAYER_LIGHT_RADIUS * 8
    const tex = grid.exportTextureBuffer()
    const ambient = [amb.intensity, amb.red, amb.green, amb.blue]
    const bad: string[] = []
    let outOfReach = 0
    for (let gy = 0; gy < LIGHT_GRID_SIZE; gy += 1) {
      for (let gx = 0; gx < LIGHT_GRID_SIZE; gx += 1) {
        const k = gy * LIGHT_GRID_SIZE + gx
        const cellLight = [grid.intensity[k]!, grid.red[k]!, grid.green[k]!, grid.blue[k]!]
        const [i, r, g, b] = cellLight as [number, number, number, number]
        const texel = [tex[k * 4]!, tex[k * 4 + 1]!, tex[k * 4 + 2]!, tex[k * 4 + 3]!]
        const want = [Math.floor((i * r) / 255), Math.floor((i * g) / 255), Math.floor((i * b) / 255), i]
        if (texel.join() !== want.join()) bad.push(`texel ${String(gx)},${String(gy)}: ${texel.join()} != ${want.join()}`)
        if (grid.blocked[k] !== 0) bad.push(`blocked ${String(gx)},${String(gy)}`)
        const d = fastDistanceApprox(l8 - (36 + gx) * 8, l8 - (36 + gy) * 8)
        if (d >= r8) {
          outOfReach += 1
          if (cellLight.join() !== ambient.join()) bad.push(`out of reach ${String(gx)},${String(gy)}: ${cellLight.join()}`)
        } else if (i < amb.intensity) {
          bad.push(`in reach ${String(gx)},${String(gy)}: intensity ${String(i)} < ambient ${String(amb.intensity)}`)
        }
      }
    }
    expect(bad).toEqual([])
    expect(outOfReach).toBeGreaterThan(0)

    // The light's own corner (d = 0): v = (104 * floor(255·65536 / 104)) >> 16 = 254 mixed into the ambient.
    const iN = Math.min(amb.intensity + 254, 255)
    const mix = (c: number): number => Math.min(((c * amb.intensity + 255 * 254) * LIGHT_RECIP[iN]!) >>> 16, 255)
    const k = 25 * LIGHT_GRID_SIZE + 25
    expect([grid.intensity[k], grid.red[k], grid.green[k], grid.blue[k]]).toEqual([iN, mix(amb.red), mix(amb.green), mix(amb.blue)])

    // Near the west edge of the collision data: corners at sub-tile x < 0 have no room and are blocked.
    const edge = runPass(levelId, { x: 5, y: 60 })
    expect(edge.originSubX).toBe(-19)
    const blockedColumns: number[] = []
    for (let gx = 0; gx < LIGHT_GRID_SIZE; gx += 1) {
      let column = 0
      for (let gy = 0; gy < LIGHT_GRID_SIZE; gy += 1) column += edge.blocked[gy * LIGHT_GRID_SIZE + gx]!
      if (column !== 0 && column !== LIGHT_GRID_SIZE) throw new Error(`column ${String(gx)} is partly blocked`)
      if (column === LIGHT_GRID_SIZE) blockedColumns.push(gx)
    }
    expect(blockedColumns).toEqual(Array.from({ length: 19 }, (_, gx) => gx))
  })
})
