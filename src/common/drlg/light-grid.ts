/**
 * Diablo II v1.13c D2Client light grid (`dLightMap.cpp`, string at 0x6fb84104; D2Client.dll ImageBase 0x6fab0000,
 * code 0x6fb58210–0x6fb59ef7). Issue #830; full write-up: `docs/lighting_grid_113c.md`.
 *
 * - The grid has 48×48 cells (0x6fbb5208, 8 bytes each: +0 dword obstacle flag 0/1, +4 I, +5 R, +6 G, +7 B).
 *   One cell is one sub-tile CORNER: cell (gx, gy) is the corner at sub-tile (oX + gx, oY + gy). The origin is the
 *   local player's path sub-tile − 24 (0x6fb59e8e), whatever the viewport size (no larger grid exists in 1.13c).
 * - Light coordinates are x8 = 1/8 sub-tile: `x8 = (precise16.16 >> 13) + 4` (0x6fb59b9d / 0x6fb58c9a); `x8 >> 3`
 *   is the sub-tile (cell) and `+8` is one sub-tile.
 * - Lights are 0x34-byte records in a singly linked list, newest first (CreateLight 0x6fb58c20 inserts at the
 *   head). LIGHTMAP_Build 0x6fb59e30 rebuilds the whole grid at most once per new client game frame (0x6fb3b1ac):
 *   ambient prefill, obstacle flags, mode selection, then LightUpdate for every record.
 * - All arithmetic is 32-bit integer and bit-exact against the golden vectors of `ref_lightgrid.py`
 *   (`golden_830.json`, checked by `tests/light-grid-113c.test.ts`); no product here can overflow 32 bits.
 */

import { COLLIDE_BLANK, COLLIDE_VISIBLE } from '../world/d2map.ts'

/** Cells per grid side (0x6fb58a57 `cmp eax,0x30`; GetLightAt clamp 0x2f at 0x6fb4f144). */
export const LIGHT_GRID_SIZE = 48
/** The origin is the player's sub-tile minus this (0x6fb59e8e / 0x6fb59e91 `add -0x18`). */
export const LIGHT_GRID_HALF = 24
/** Cells in the grid (0x6fb58933 `cmp eax,0x900`). */
export const LIGHT_GRID_CELL_COUNT = LIGHT_GRID_SIZE * LIGHT_GRID_SIZE
/** Radius clamp in sub-tiles (CreateLight 0x6fb58c2d, SetRadius, SetTargetRadius: `cmp 0x12`). */
export const LIGHT_MAX_RADIUS = 18
/** Radius ramp per light build in x8 units, i.e. one sub-tile (0x6fb59bec / 0x6fb59bf1). */
export const LIGHT_RADIUS_STEP = 8
/**
 * Collision bits that make a grid point an obstacle (0x6fb58880 → D2Common #10482 mask 0x22): COLLIDE_VISIBLE
 * (0x02) | COLLIDE_BLANK (0x20). COLLIDE_WALL (0x01) and COLLIDE_DOOR (0x0800) are NOT in the mask.
 */
export const LIGHT_OBSTACLE_MASK = COLLIDE_VISIBLE | COLLIDE_BLANK
/** Light record `unitType` of a light without an owner unit (LightUpdate 0x6fb59b5a `cmp 6`). */
export const LIGHT_UNIT_NONE = 6
/** Radius of a player light before stat 89 (local player 0x6fac92f3 `push 0xd`; other players use the same 13). */
export const PLAYER_LIGHT_RADIUS = 13
/**
 * High dword of the port's stand-in for a unit's `unit+0x20` light seed: `{ lo: unitId, hi: 666 }` mimics
 * SEED_InitLowSeed's constant high part (SPEC #830 §11 Q8, UNVERIFIED: the real seed comes from the unit's spawn).
 */
export const LIGHT_SEED_HI = 666

/** recip[256] at 0x6fbb4e00 (built by 0x6fb599e0): recip[0] = 0, recip[i] = 65536 / i (floor). */
export const LIGHT_RECIP: Uint32Array = Uint32Array.from({ length: 256 }, (_, i) =>
  i === 0 ? 0 : Math.floor(0x10000 / i),
)

/**
 * Light position in x8 units from a continuous D2 precise coordinate in sub-tiles (precise16.16 / 65536):
 * `(precise >> 13) + 4` (0x6fb59b9d, 0x6fb58c9a). Never `Math.round`.
 */
export function lightPos8(preciseSub: number): number {
  return Math.floor(preciseSub * 8) + 4
}

/**
 * Precomputed 256×256 LUT for `fastDistanceApprox(dx, dy)` when `|dx| < 256` and `|dy| < 256`
 * (#1032: covers all light windows since `r < 0x100`).
 */
const FAST_DISTANCE_LUT: Uint16Array = (() => {
  const lut = new Uint16Array(256 * 256)
  for (let ax = 0; ax < 256; ax += 1) {
    const row = ax << 8
    for (let ay = 0; ay < 256; ay += 1) {
      lut[row | ay] = ax >= ay ? (ax * 0x3d7 + ay * 0x197) >> 10 : (ay * 0x3d7 + ax * 0x197) >> 10
    }
  }
  return lut
})()

/**
 * Distance approximation `(983 * max + 407 * min) >> 10` of the absolute deltas (0x6fb58760, 0x6fb587b0 and the
 * inline copy at 0x6fb597b4).
 */
export function fastDistanceApprox(dx: number, dy: number): number {
  const ax = dx < 0 ? -dx : dx
  const ay = dy < 0 ? -dy : dy
  if (ax < 256 && ay < 256) {
    return FAST_DISTANCE_LUT[(ax << 8) | ay]!
  }
  return ax >= ay ? (ax * 0x3d7 + ay * 0x197) >> 10 : (ay * 0x3d7 + ax * 0x197) >> 10
}

/** An ambient light as the grid prefill uses it (0x6fb59a20 output; every channel 0..255). */
export interface LightAmbient {
  readonly intensity: number
  readonly red: number
  readonly green: number
  readonly blue: number
}

/** One near room of the player's room for the prefill: its sub-tile rectangle (#10561) and ambient light. */
export interface LightAmbientRoom {
  readonly subX: number
  readonly subY: number
  readonly subW: number
  readonly subH: number
  readonly ambient: LightAmbient
}

/**
 * Collision word at a sub-tile, or `undefined` when there is no room / no collision data there (D2Common #10482
 * then returns 0x27 unmasked, i.e. blocked).
 */
export type LightCollisionAt = (subX: number, subY: number) => number | undefined

function isLightObstacle(mask: number | undefined): boolean {
  return mask === undefined || (mask & LIGHT_OBSTACLE_MASK) !== 0
}

function assertByte(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(`${what} must be an integer 0..255, got ${String(value)}`)
  }
}

function assertAmbient(light: LightAmbient, what: string): void {
  assertByte(light.intensity, `${what} intensity`)
  assertByte(light.red, `${what} red`)
  assertByte(light.green, `${what} green`)
  assertByte(light.blue, `${what} blue`)
}

/** The 48×48 grid at 0x6fbb5208 plus its origin (0x6fbb4df0 / 0x6fbb4df4). */
export class LightGrid {
  /** oX: sub-tile of cell column 0 (0x6fbb4df0). */
  originSubX = 0
  /** oY: sub-tile of cell row 0 (0x6fbb4df4). */
  originSubY = 0
  /** +0 dword obstacle flag (0 or 1), written by 0x6fb58880 and cleared by Fill 0x6fb58560. */
  readonly blocked: Uint8Array = new Uint8Array(LIGHT_GRID_CELL_COUNT)
  /** +4 intensity I. */
  readonly intensity: Uint8Array = new Uint8Array(LIGHT_GRID_CELL_COUNT)
  /** +5 red. */
  readonly red: Uint8Array = new Uint8Array(LIGHT_GRID_CELL_COUNT)
  /** +6 green. */
  readonly green: Uint8Array = new Uint8Array(LIGHT_GRID_CELL_COUNT)
  /** +7 blue. */
  readonly blue: Uint8Array = new Uint8Array(LIGHT_GRID_CELL_COUNT)

  private readonly textureBuffer: Uint8Array = new Uint8Array(LIGHT_GRID_CELL_COUNT * 4)

  /**
   * LIGHTMAP_Build 0x6fb59e30..0x6fb59ead: oX = player path sub-tile − 24, oY likewise. The path sub-tile is an
   * integer (D2Common #10867 / #10750 for dynamic units, the static path x/y otherwise).
   */
  setOrigin(pathSubX: number, pathSubY: number): void {
    if (!Number.isInteger(pathSubX) || !Number.isInteger(pathSubY)) {
      throw new RangeError(`light grid origin needs integer path sub-tiles, got (${String(pathSubX)}, ${String(pathSubY)})`)
    }
    this.originSubX = pathSubX - LIGHT_GRID_HALF
    this.originSubY = pathSubY - LIGHT_GRID_HALF
  }

  /**
   * Fill 0x6fb58560: the inclusive cell rectangle rows y0..y1, columns x0..x1 gets the colour dword and a zero
   * obstacle flag. An empty range writes nothing.
   */
  fill(x0: number, y0: number, x1: number, y1: number, intensity: number, red: number, green: number, blue: number): void {
    for (let gy = y0; gy <= y1; gy += 1) {
      const row = gy * LIGHT_GRID_SIZE
      for (let gx = x0; gx <= x1; gx += 1) {
        const k = row + gx
        this.blocked[k] = 0
        this.intensity[k] = intensity
        this.red[k] = red
        this.green[k] = green
        this.blue[k] = blue
      }
    }
  }

  /**
   * Ambient prefill 0x6fb59c90(0): every cell gets the player room's ambient light, then each near room (list
   * order, the player's room excluded, later rooms overwrite) fills its inclusive cell rectangle
   * `[x - oX, x - oX + w]` × `[y - oY, y - oY + h]`. A room is skipped when `x0 > 48 || x1 < 0 || y0 > 48 ||
   * y1 < 0` (note 48, not 47); the start is clamped only at 0 and the end at 47. `player === null` (no player or no
   * room) fills the whole grid with zeros (0x6fb59e13).
   */
  fillAmbient(player: LightAmbient | null, nearRooms: readonly LightAmbientRoom[]): void {
    const last = LIGHT_GRID_SIZE - 1
    if (player === null) {
      this.fill(0, 0, last, last, 0, 0, 0, 0)
      return
    }
    assertAmbient(player, 'player room ambient')
    this.fill(0, 0, last, last, player.intensity, player.red, player.green, player.blue)
    for (const room of nearRooms) {
      assertAmbient(room.ambient, 'near room ambient')
      let x0 = room.subX - this.originSubX
      let x1 = x0 + room.subW
      let y0 = room.subY - this.originSubY
      let y1 = y0 + room.subH
      if (x0 > LIGHT_GRID_SIZE || x1 < 0 || y0 > LIGHT_GRID_SIZE || y1 < 0) continue
      if (x0 < 0) x0 = 0
      if (x1 >= LIGHT_GRID_SIZE) x1 = last
      if (y0 < 0) y0 = 0
      if (y1 >= LIGHT_GRID_SIZE) y1 = last
      this.fill(x0, y0, x1, y1, room.ambient.intensity, room.ambient.red, room.ambient.green, room.ambient.blue)
    }
  }

  /**
   * Obstacle flags 0x6fb58880: the flag of cell (gx, gy) is `(collision(oX+gx, oY+gy) & 0x22) != 0`, with a
   * missing room / collision word counting as blocked (#10482 returns 0x27).
   */
  buildObstacles(collisionAt: LightCollisionAt): void {
    for (let gy = 0; gy < LIGHT_GRID_SIZE; gy += 1) {
      const wy = this.originSubY + gy
      const row = gy * LIGHT_GRID_SIZE
      for (let gx = 0; gx < LIGHT_GRID_SIZE; gx += 1) {
        this.blocked[row + gx] = isLightObstacle(collisionAt(this.originSubX + gx, wy)) ? 1 : 0
      }
    }
  }

  /** Obstacle flag at a sub-tile as 0x6fb58950 reads it: outside the grid counts as 1. */
  flagAt(subX: number, subY: number): number {
    const gx = subX - this.originSubX
    const gy = subY - this.originSubY
    if (gx < 0 || gx >= LIGHT_GRID_SIZE || gy < 0 || gy >= LIGHT_GRID_SIZE) return 1
    return this.blocked[gy * LIGHT_GRID_SIZE + gx]!
  }

  /**
   * AddToCell 0x6fb58a40(x8, y8, v, R, G, B): cells outside the grid are ignored; `In = min(I + v, 255)` and each
   * colour becomes `min(((C * I + Cl * v) * recip[In]) >> 16, 255)`. The coloured branch is always taken (flag
   * 0x6fb8e830 is statically 1), including when I is 0.
   */
  addToCell(x8: number, y8: number, v: number, red: number, green: number, blue: number): void {
    const gx = (x8 >> 3) - this.originSubX
    if (gx < 0 || gx >= LIGHT_GRID_SIZE) return
    const gy = (y8 >> 3) - this.originSubY
    if (gy < 0 || gy >= LIGHT_GRID_SIZE) return
    const k = gy * LIGHT_GRID_SIZE + gx
    const i0 = this.intensity[k]!
    const iN = i0 + v > 0xff ? 0xff : i0 + v
    const rc = LIGHT_RECIP[iN]!
    const r = ((this.red[k]! * i0 + red * v) * rc) >>> 16
    const g = ((this.green[k]! * i0 + green * v) * rc) >>> 16
    const b = ((this.blue[k]! * i0 + blue * v) * rc) >>> 16
    this.red[k] = r > 0xff ? 0xff : r
    this.green[k] = g > 0xff ? 0xff : g
    this.blue[k] = b > 0xff ? 0xff : b
    this.intensity[k] = iN
  }

  /** Cell index GetLightAt 0x6fb58230 reads for (x8, y8): nearest cell, clamped to the grid edge. */
  cellIndexAt(x8: number, y8: number): number {
    let gx = (x8 >> 3) - this.originSubX
    let gy = (y8 >> 3) - this.originSubY
    if (gx < 0) gx = 0
    else if (gx >= LIGHT_GRID_SIZE) gx = LIGHT_GRID_SIZE - 1
    if (gy < 0) gy = 0
    else if (gy >= LIGHT_GRID_SIZE) gy = LIGHT_GRID_SIZE - 1
    return gy * LIGHT_GRID_SIZE + gx
  }

  /** GetLightAt 0x6fb58230(x8, y8): the [I, R, G, B] of the nearest cell (edge clamp, no interpolation). */
  getLightAt(x8: number, y8: number): readonly [number, number, number, number] {
    const k = this.cellIndexAt(x8, y8)
    return [this.intensity[k]!, this.red[k]!, this.green[k]!, this.blue[k]!]
  }

  /**
   * RGBA8 texture of the grid for the 3D-renderer floor path (0x6fac35e0 / 0x6fac37a0): RGB = T[I][C] =
   * floor(I·C/255) (the vertex colour the Glide/D3D backends modulate the texel with), A = I. Texel (gx, gy) is the
   * corner at sub-tile (oX + gx, oY + gy).
   */
  exportTextureBuffer(): Uint8Array {
    const out = this.textureBuffer
    for (let k = 0; k < LIGHT_GRID_CELL_COUNT; k += 1) {
      const i = this.intensity[k]!
      const o = k * 4
      out[o] = Math.floor((i * this.red[k]!) / 255)
      out[o + 1] = Math.floor((i * this.green[k]!) / 255)
      out[o + 2] = Math.floor((i * this.blue[k]!) / 255)
      out[o + 3] = i
    }
    return out
  }

  /**
   * Wall light array builder (`0x6fb4e940` lower wall Low, `0x6fb4e970` upper wall High, `0x6fb4ec10` lower wall High,
   * `0x6fb4ee90` upper wall Low): samples `WALL_LIGHT_SAMPLE_COUNTS_113C[lightDirection]` points from the grid via
   * `getLightAt(entryX + dx, entryY + dy)` using `0x6fb8ed18` (`!faded`) or `0x6fb8eef8` (`faded`, `[tile+0x24] & 1`).
   */
  sampleWallLights(
    cellX: number,
    cellY: number,
    lightDirection: number,
    faded = false,
  ): readonly (readonly [number, number, number, number])[] {
    const points = wallLightSamplePoints113c(cellX, cellY, lightDirection, faded)
    return points.map(([x8, y8]) => this.getLightAt(x8, y8))
  }
}

// ------------------------------------------------------------------------- draw entries & wall light tables (1.13c)

/**
 * Tile draw-entry coordinates `(entry+0x4, entry+0x8)` written by `0x6fb29c80` (floor), `0x6fb29d30` (roof),
 * `0x6fb29e20` (lower wall), and `0x6fb2a340` (upper wall): `D2Common.#10561(pRoom1)` (`roomSubX`, `roomSubY`) plus
 * `tile.nPosX * 5`, `tile.nPosY * 5`, shifted left by 3 (`x8 = subtile << 3 = cell * 40`).
 */
export function tileDrawEntryPos8(cellX: number, cellY: number): readonly [number, number] {
  if (!Number.isInteger(cellX) || !Number.isInteger(cellY)) {
    throw new RangeError(`tileDrawEntryPos8 requires integer tile cells, got (${String(cellX)}, ${String(cellY)})`)
  }
  return [(cellX * 5) << 3, (cellY * 5) << 3]
}

/**
 * Unit draw-entry coordinates `(entry+0x4, entry+0x8)` written by `0x6fb2a180`, `0x6fb2a260`, and `0x6fb2a500`:
 * integer path sub-tile (`D2Common.#10867` / `#10750` `wPosX` / `wPosY` for dynamic units, `pStaticPath->dwPosX` /
 * `dwPosY` for static units) shifted left by 3 (`x8 = Math.floor(sub) << 3`).
 */
export function unitDrawEntryPos8(subX: number, subY: number, dynamic = false): readonly [number, number] {
  if (!Number.isFinite(subX) || !Number.isFinite(subY)) {
    throw new RangeError(`unitDrawEntryPos8 requires finite sub-tiles, got (${String(subX)}, ${String(subY)})`)
  }
  const px = Math.floor(dynamic ? subX + 0.5 : subX)
  const py = Math.floor(dynamic ? subY + 0.5 : subY)
  return [px << 3, py << 3]
}

/**
 * Sample count per `pTileGfx->nLightDirection` (`[[tile+0x18] + 0x0]`, `0..9`) at `0x6fb80a70`.
 * Every wall, door, exit, column, tree, and lower wall has `nLightDirection` in `{1, 2, 3, 4, 6, 7, 8, 9}`, all with
 * count = 6. `0` (special floor) and `5` (`ROOF`, `nType = 15`) have count = 0.
 */
export const WALL_LIGHT_SAMPLE_COUNTS_113C: readonly number[] = [0, 6, 6, 6, 6, 0, 6, 6, 6, 6]

/**
 * Default 6-point wall light offset table `0x6fb8ed18..0x6fb8eef8` (`10 * 48 = 0x1e0` bytes), indexed by
 * `pTileGfx->nLightDirection` (`0..9`), used when `([tile+0x24] & 1) == 0` (wall not occluded/faded).
 * Each entry has 6 `[dx, dy]` pairs in x8 units (`subtile * 8`), ordered from left column edge (`col 0`) to right
 * column edge (`col 5`).
 */
export const WALL_LIGHT_OFFSETS_DEFAULT_113C: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
  [
    [16, 40],
    [24, 32],
    [32, 24],
    [40, 16],
    [48, 8],
    [56, 0],
  ],
  [
    [0, 56],
    [8, 48],
    [16, 40],
    [24, 32],
    [32, 24],
    [40, 16],
  ],
  [
    [0, 56],
    [8, 48],
    [16, 40],
    [32, 24],
    [40, 16],
    [48, 8],
  ],
  [
    [32, 56],
    [40, 56],
    [40, 56],
    [56, 40],
    [56, 40],
    [56, 32],
  ],
  [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
  [
    [0, 32],
    [8, 32],
    [16, 24],
    [24, 16],
    [32, 8],
    [40, 0],
  ],
  [
    [0, 40],
    [8, 32],
    [16, 24],
    [24, 16],
    [32, 8],
    [32, 0],
  ],
  [
    [0, 40],
    [8, 32],
    [16, 24],
    [24, 16],
    [32, 8],
    [40, 0],
  ],
  [
    [16, 24],
    [24, 24],
    [24, 24],
    [24, 24],
    [24, 24],
    [24, 16],
  ],
]

/**
 * Faded/occluded 6-point wall light offset table `0x6fb8eef8..0x6fb8f0d8` (`10 * 48 = 0x1e0` bytes), indexed by
 * `pTileGfx->nLightDirection` (`0..9`), used when `([tile+0x24] & 1) != 0` (player-occlusion fade flag set by
 * `0x6fb29f20`). Shifts upper-wall (`nLightDirection` 1..4) sample points by 2 sub-tiles (`16` in x8) to the back
 * (player-facing) side of the wall.
 */
export const WALL_LIGHT_OFFSETS_FADED_113C: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
  [
    [0, 24],
    [8, 16],
    [16, 8],
    [24, 0],
    [32, -8],
    [40, -16],
  ],
  [
    [-16, 40],
    [-8, 32],
    [0, 24],
    [8, 16],
    [16, 8],
    [24, 0],
  ],
  [
    [-16, 40],
    [-8, 32],
    [0, 24],
    [16, 8],
    [24, 0],
    [32, -8],
  ],
  [
    [0, 32],
    [8, 24],
    [8, 24],
    [24, 8],
    [24, 8],
    [32, 0],
  ],
  [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
  [
    [0, 40],
    [8, 32],
    [16, 24],
    [24, 16],
    [32, 8],
    [40, 0],
  ],
  [
    [0, 40],
    [8, 32],
    [16, 24],
    [24, 16],
    [32, 8],
    [40, 0],
  ],
  [
    [0, 40],
    [8, 32],
    [16, 24],
    [24, 16],
    [32, 8],
    [40, 0],
  ],
  [
    [16, 24],
    [24, 24],
    [24, 24],
    [24, 24],
    [24, 24],
    [24, 16],
  ],
]

/**
 * Deterministic mapping from DT1 tile orientation (`nType` at `[pTileGfx+0x14]` / `[tile+0x1c]`, `0..19`) to
 * `pTileGfx->nLightDirection` (`[pTileGfx+0x00]`, `0..9`), verified across all 42,944 DT1 tile headers in MPQ data.
 */
export function tileTypeToLightDirection113c(tileType: number): number {
  switch (tileType) {
    case 1:
    case 5:
    case 8:
    case 10:
      return 1
    case 2:
    case 6:
    case 9:
    case 11:
      return 2
    case 0:
    case 3:
    case 4:
    case 12:
    case 13:
    case 14:
      return 3
    case 7:
      return 4
    case 15:
      return 5
    case 16:
      return 6
    case 17:
      return 7
    case 18:
      return 8
    case 19:
      return 9
    default:
      throw new RangeError(`Unsupported DT1 tile orientation nType=${String(tileType)}`)
  }
}

/**
 * Computes the `N = WALL_LIGHT_SAMPLE_COUNTS_113C[lightDirection]` world x8 coordinates `(entry.x + dx, entry.y + dy)`
 * passed to `LIGHTMAP_GetLightAt` (`0x6fb58230`) by `0x6fb4e940` / `0x6fb4e970` / `0x6fb4ec10` / `0x6fb4ee90`.
 */
export function wallLightSamplePoints113c(
  cellX: number,
  cellY: number,
  lightDirection: number,
  faded = false,
): readonly (readonly [number, number])[] {
  if (!Number.isInteger(lightDirection) || lightDirection < 0 || lightDirection >= WALL_LIGHT_SAMPLE_COUNTS_113C.length) {
    throw new RangeError(`lightDirection must be an integer 0..9, got ${String(lightDirection)}`)
  }
  const [entryX, entryY] = tileDrawEntryPos8(cellX, cellY)
  const count = WALL_LIGHT_SAMPLE_COUNTS_113C[lightDirection]!
  if (count === 0) return []
  const table = faded ? WALL_LIGHT_OFFSETS_FADED_113C : WALL_LIGHT_OFFSETS_DEFAULT_113C
  const offsets = table[lightDirection]!
  const out: (readonly [number, number])[] = []
  for (let i = 0; i < count; i += 1) {
    const [dx, dy] = offsets[i]!
    out.push([entryX + dx, entryY + dy])
  }
  return out
}

/**
 * Column index `0..4` into the 6-point wall light array for a DT1 32×32 wall block at horizontal offset `blockPosX`
 * (`0, 32, 64, 96, 128`), matching `col = blockPosX >> 5` (`sar eax, 5`) in `D2Gdi.dll` (`0x6f875f0c`, `0x6f87602c`),
 * `D2DDraw.dll` (`0x6f8c73dc`, `0x6f8c74fc`), `D2Direct3D.dll` (`0x6f88e643–0x6f88e793`), and `D2Glide.dll`
 * (`0x6f85690c–0x6f856a45`). Left vertices use `lightDwords[col]` and right vertices use `lightDwords[col + 1]`.
 */
export function wallColumnIndexForBlockPosX113c(blockPosX: number): number {
  const col = blockPosX >> 5
  if (col < 0 || col > 4) {
    throw new RangeError(`DT1 wall blockPosX ${String(blockPosX)} maps to out-of-range column ${String(col)} (expected 0..4)`)
  }
  return col
}

// ------------------------------------------------------------------------------------------------- shadows

/** Shadow arrays A (0x6fbacde8, propagated shade) and B (0x6fbb0de8, obstacles 0/16): 64×64 int32, row*64+col. */
export interface LightShadowScratch {
  readonly a: Int32Array
  readonly b: Int32Array
}

/** A fresh pair of shadow arrays (one shared pair per light list mirrors the 1.13c globals). */
export function createLightShadowScratch(): LightShadowScratch {
  return { a: new Int32Array(64 * 64), b: new Int32Array(64 * 64) }
}

/**
 * SetupStep 0x6fb58470 (from the light to the CENTRE of the cell, `+4`) followed by Propagate 0x6fb58310 (jump
 * table 0x6fb58458) for A[row][col]. `val(p) = B[p] ? B[p] : A[p]`; mode 1: val(r, c+xs); mode 4: val(r+ys, c);
 * mode 2: ((256-f)·val(r, c+xs) + f·val(r+ys, c+xs)) >> 8; mode 3: ((256-f)·val(r+ys, c) + f·val(r+ys, c+xs)) >> 8.
 * Mode 0 (the cell centre is the light itself) writes nothing.
 */
function propagateShade(
  sh: LightShadowScratch,
  lightX8: number,
  lightY8: number,
  cellX8: number,
  cellY8: number,
  row: number,
  col: number,
): void {
  let dx = lightX8 - cellX8
  let dy = lightY8 - cellY8
  if (dx === 0 && dy === 0) return
  const xs = dx < 0 ? -1 : 1
  const ys = dy < 0 ? -1 : 1
  if (dx < 0) dx = -dx
  if (dy < 0) dy = -dy
  const { a, b } = sh
  let out: number
  if (dx === 0) {
    const k = (row + ys) * 64 + col
    out = b[k] !== 0 ? b[k]! : a[k]!
  } else if (dy === 0) {
    const k = row * 64 + col + xs
    out = b[k] !== 0 ? b[k]! : a[k]!
  } else if (dx >= dy) {
    const f = Math.floor((dy << 8) / dx)
    const k1 = row * 64 + col + xs
    const k2 = (row + ys) * 64 + col + xs
    out = ((0x100 - f) * (b[k1] !== 0 ? b[k1]! : a[k1]!) + f * (b[k2] !== 0 ? b[k2]! : a[k2]!)) >> 8
  } else {
    const f = Math.floor((dx << 8) / dy)
    const k1 = (row + ys) * 64 + col
    const k2 = (row + ys) * 64 + col + xs
    out = ((0x100 - f) * (b[k1] !== 0 ? b[k1]! : a[k1]!) + f * (b[k2] !== 0 ? b[k2]! : a[k2]!)) >> 8
  }
  a[row * 64 + col] = out
}

/**
 * Ring walk 0x6fb59548..0x6fb5971e (also used by the type-2 cache build 0x6fb59100): for k = 2..rs, j = 0..k, the
 * eight SetupStep/Propagate pairs in this exact order. Ring 0-1 is never written (stays 0); every ring k cell is
 * written before it is read.
 */
function walkShadowRings(sh: LightShadowScratch, lightX8: number, lightY8: number, rs: number): void {
  const cx = (lightX8 >> 3) * 8 + 4
  const cy = (lightY8 >> 3) * 8 + 4
  for (let k = 2; k <= rs; k += 1) {
    const ym = cy - 8 * k
    const yp = cy + 8 * k
    const xm = cx - 8 * k
    const xp = cx + 8 * k
    for (let j = 0; j <= k; j += 1) {
      const xjm = cx - 8 * j
      const xjp = cx + 8 * j
      const yjm = cy - 8 * j
      const yjp = cy + 8 * j
      propagateShade(sh, lightX8, lightY8, xjm, ym, 32 - k, 32 - j)
      propagateShade(sh, lightX8, lightY8, xjp, ym, 32 - k, 32 + j)
      propagateShade(sh, lightX8, lightY8, xjm, yp, 32 + k, 32 - j)
      propagateShade(sh, lightX8, lightY8, xjp, yp, 32 + k, 32 + j)
      propagateShade(sh, lightX8, lightY8, xp, yjm, 32 - j, 32 + k)
      propagateShade(sh, lightX8, lightY8, xp, yjp, 32 + j, 32 + k)
      propagateShade(sh, lightX8, lightY8, xm, yjm, 32 - j, 32 - k)
      propagateShade(sh, lightX8, lightY8, xm, yjp, 32 + j, 32 - k)
    }
  }
}

// ------------------------------------------------------------------------------------------------- records

/** The owner of a light record: 1.13c unit type (0 player, 1 monster, 2 object, 3 missile) and unit id. */
export interface LightOwner {
  readonly unitType: number
  readonly unitId: number
}

/** One 0x34-byte light record (allocated by 0x6fb58c56). */
export class LightRecord {
  /** +0x00 owner unit type (6 = none). */
  unitType: number
  /** +0x04 owner unit id (−1 when there is no unit). */
  unitId: number
  /** +0x0c light type: 0 (shadowed in mode 2), 1 (never shadowed), 2 (cached occlusion). */
  readonly type: 0 | 1 | 2
  /** +0x10 / +0x14 position in x8 units. */
  x8: number
  y8: number
  /** +0x18 current radius in x8 units (r >> 3 sub-tiles). */
  r: number
  /** +0x1c target radius in x8 units. */
  target: number
  /** +0x20 dying (Kill 0x6fb585f0): fades 8 per build at the last position, then frees itself. */
  dying = false
  /** +0x24..+0x27 intensity and colour. */
  intensity: number
  red: number
  green: number
  blue: number
  /** +0x2c type-2 cache valid. */
  cacheValid = false
  /** +0x30 type-2 cache: the A window `(2·rs+1)²` of the last cache build. */
  cache: Int32Array | null = null
  /** +0x28 next (older) record. */
  next: LightRecord | null = null
  /** False once Free 0x6fb58630 unlinked it. */
  linked = true

  constructor(
    owner: LightOwner | null,
    type: 0 | 1 | 2,
    radius: number,
    intensity: number,
    red: number,
    green: number,
    blue: number,
    x8: number,
    y8: number,
  ) {
    this.unitType = owner === null ? LIGHT_UNIT_NONE : owner.unitType
    this.unitId = owner === null ? -1 : owner.unitId
    this.type = type
    this.x8 = x8
    this.y8 = y8
    this.r = radius * 8
    this.target = radius * 8
    this.intensity = intensity
    this.red = red
    this.green = green
    this.blue = blue
  }
}

function lightWindow(l: LightRecord, r: number): { startX: number; startY: number; diam: number } {
  return { startX: (l.x8 & ~7) - r, startY: (l.y8 & ~7) - r, diam: (2 * r) >> 3 }
}

/** Shared cull test of 0x6fb59480 / 0x6fb59860 / 0x6fb58f60 (0x6fb598bb–0x6fb5990d). */
function lightCulled(grid: LightGrid, startX: number, startY: number, diam: number): boolean {
  const sx = startX >> 3
  const sy = startY >> 3
  return (
    sx > grid.originSubX + LIGHT_GRID_SIZE ||
    sx + diam + 1 < grid.originSubX ||
    sy > grid.originSubY + LIGHT_GRID_SIZE ||
    sy + diam + 1 < grid.originSubY
  )
}

/**
 * Unshadowed apply 0x6fb59860(light, mode). In mode 0 the owner type changes the radius first: a player light
 * that is not the local player's is clamped to 16 (2 sub-tiles), a monster light becomes 8 (1 sub-tile) and a
 * missile light is skipped. Then every window point gets `v = ((r - d) * slope) >> 16` if positive.
 */
export function applyLightUnshadowed(grid: LightGrid, l: LightRecord, mode: number, localPlayerId: number): void {
  let r = l.r
  if (r <= 0 || r >= 0x100) return
  if (mode === 0) {
    if (l.unitType === 0) {
      if (l.unitId !== localPlayerId && r >= 0x10) r = 0x10
    } else if (l.unitType === 1) {
      r = 8
    } else if (l.unitType === 3) {
      return
    }
  }
  const { startX, startY, diam } = lightWindow(l, r)
  if (lightCulled(grid, startX, startY, diam)) return
  const slope = Math.floor((l.intensity << 16) / r)
  for (let j = 0; j <= diam; j += 1) {
    const cy = startY + 8 * j
    const ady = l.y8 - cy
    for (let i = 0; i <= diam; i += 1) {
      const cx = startX + 8 * i
      const v = ((r - fastDistanceApprox(l.x8 - cx, ady)) * slope) >> 16
      if (v > 0) grid.addToCell(cx, cy, v, l.red, l.green, l.blue)
    }
  }
}

/** Shared shadowed falloff loop (0x6fb59728.. and 0x6fb58f60): reads `shadeBuf[shadeBase + row * shadeStride + col]`. */
function applyShadedWindow(
  grid: LightGrid,
  l: LightRecord,
  r: number,
  startX: number,
  startY: number,
  diam: number,
  shadeBuf: Int32Array,
  shadeBase: number,
  shadeStride: number,
): void {
  const slope = Math.floor((l.intensity << 16) / r)
  for (let row = 0; row <= diam; row += 1) {
    const cy = startY + 8 * row
    const ady = l.y8 - cy
    const rowOffset = shadeBase + row * shadeStride
    for (let col = 0; col <= diam; col += 1) {
      const s = shadeBuf[rowOffset + col]!
      if (s >= 0x10) continue
      const cx = startX + 8 * col
      const falloff = ((r - fastDistanceApprox(l.x8 - cx, ady)) * slope) >> 16
      const v = (falloff * (8 - (s >> 1))) >> 3
      if (v > 0) grid.addToCell(cx, cy, v, l.red, l.green, l.blue)
    }
  }
}

/**
 * Shadowed apply 0x6fb59480 (type 0 in mode 2): B over the window from the grid obstacle flags (0x6fb58950,
 * `flag << 4`, outside the grid → 16), the ring walk, then `v = (falloff * (8 - (s >> 1))) >> 3` for every point
 * whose shade s < 16. A blocked point itself stays lit (its shade comes from the points in front of it).
 */
export function applyLightShadowed(grid: LightGrid, l: LightRecord, sh: LightShadowScratch): void {
  const r = l.r
  if (r <= 0 || r >= 0x100) return
  const { startX, startY, diam } = lightWindow(l, r)
  if (lightCulled(grid, startX, startY, diam)) return
  sh.a.fill(0, 0, 0x400) // rep stos clears A[0..0x3ff] only; rings 0-1 are never written, rings >= 2 always are
  const rs = r >> 3
  const base = 32 - rs
  const wx0 = startX >> 3
  const wy0 = startY >> 3
  for (let row = 0; row <= diam; row += 1) {
    for (let col = 0; col <= diam; col += 1) {
      sh.b[(base + row) * 64 + base + col] = grid.flagAt(wx0 + col, wy0 + row) << 4
    }
  }
  if (rs >= 2) walkShadowRings(sh, l.x8, l.y8, rs)
  applyShadedWindow(grid, l, r, startX, startY, diam, sh.a, base * 64 + base, 64)
}

/**
 * Type-2 cache build 0x6fb59100: B from direct collision reads (#10482 mask 0x22, missing → blocked) over the
 * 64×64 window starting at (unitSubX − 32, unitSubY − 32) (0x6fb59191 / 0x6fb5919f) — the grid flags are not
 * used — then the ring walk; the A window `(2·rs+1)²` is copied into the record's cache (+0x30).
 */
export function buildLightType2Cache(
  l: LightRecord,
  sh: LightShadowScratch,
  collisionAt: LightCollisionAt,
  unitSubX: number,
  unitSubY: number,
): void {
  const r = l.r
  if (l.type !== 2) throw new Error(`light type ${String(l.type)} has no occlusion cache`)
  if (r <= 0 || r >= 0x100) return
  if ((r & 7) !== 0) throw new RangeError(`type-2 light radius ${String(r)} is not a whole number of sub-tiles`)
  sh.a.fill(0, 0, 0x400)
  const x0 = unitSubX - 32
  const y0 = unitSubY - 32
  for (let row = 0; row < 64; row += 1) {
    for (let col = 0; col < 64; col += 1) {
      sh.b[row * 64 + col] = isLightObstacle(collisionAt(x0 + col, y0 + row)) ? 0x10 : 0
    }
  }
  const rs = r >> 3
  if (rs >= 2) walkShadowRings(sh, l.x8, l.y8, rs)
  const side = 2 * rs + 1
  const cache = l.cache !== null && l.cache.length === side * side ? l.cache : new Int32Array(side * side)
  const base = 32 - rs
  for (let row = 0; row < side; row += 1) {
    for (let col = 0; col < side; col += 1) cache[row * side + col] = sh.a[(base + row) * 64 + base + col]!
  }
  l.cache = cache
  l.cacheValid = true
}

/** Cached apply 0x6fb58f60: the shadowed formula reading the record's type-2 cache. */
export function applyLightCached(grid: LightGrid, l: LightRecord): void {
  const r = l.r
  if (r <= 0 || r >= 0x100) return
  const cache = l.cache
  const side = 2 * (r >> 3) + 1
  if (!l.cacheValid || cache === null || cache.length !== side * side) {
    throw new Error(`type-2 light of unit ${String(l.unitType)}:${String(l.unitId)} has no valid cache for radius ${String(r)}`)
  }
  const { startX, startY, diam } = lightWindow(l, r)
  if (lightCulled(grid, startX, startY, diam)) return
  applyShadedWindow(grid, l, r, startX, startY, diam, cache, 0, side)
}

/** Inputs of one LIGHTMAP_Build pass over the records. */
export interface LightBuildEnv {
  /**
   * LightUpdate's owner lookup (HashFind + D2Common #11080 / #11168): the owner's light position, or `null` when
   * the owner is not found (the record keeps its last position). Omit it when the caller already positioned the
   * records for this build.
   */
  readonly ownerPos8?: ((unitType: number, unitId: number) => { readonly x8: number; readonly y8: number } | null) | undefined
  /** Collision words for type-2 cache builds. */
  readonly collisionAt: LightCollisionAt
  /** `g_player->dwUnitId` for the mode-0 player clamp (−1 without a player). */
  readonly localPlayerId: number
  readonly scratch: LightShadowScratch
}

/** The light list at 0x6fbcbbec with the record API of §5 (CreateLight, SetRadius, …, Free). */
export class LightList {
  private first: LightRecord | null = null
  private count = 0

  /** Newest record (the list head). */
  get head(): LightRecord | null {
    return this.first
  }

  get size(): number {
    return this.count
  }

  /** Records newest first (build order). */
  *[Symbol.iterator](): IterableIterator<LightRecord> {
    for (let l = this.first; l !== null; l = l.next) yield l
  }

  /**
   * CreateLight 0x6fb58c20(unit, type, radius, I, R, G, B): radius ≤ 0 → no light (`null`); radius clamped to 18;
   * r = target = radius·8; the record is inserted at the head. `x8`/`y8` = `(precise >> 13) + 4` of the owner.
   */
  create(
    owner: LightOwner | null,
    type: 0 | 1 | 2,
    radius: number,
    intensity: number,
    red: number,
    green: number,
    blue: number,
    x8: number,
    y8: number,
  ): LightRecord | null {
    if (!Number.isInteger(radius)) throw new RangeError(`light radius must be an integer, got ${String(radius)}`)
    if (!Number.isInteger(x8) || !Number.isInteger(y8)) {
      throw new RangeError(`light position must be integer x8 units, got (${String(x8)}, ${String(y8)})`)
    }
    assertByte(intensity, 'light intensity')
    assertByte(red, 'light red')
    assertByte(green, 'light green')
    assertByte(blue, 'light blue')
    if (radius <= 0) return null
    const rec = new LightRecord(owner, type, Math.min(radius, LIGHT_MAX_RADIUS), intensity, red, green, blue, x8, y8)
    rec.next = this.first
    this.first = rec
    this.count += 1
    return rec
  }

  /** SetRadius 0x6fb58b60: ≤ 0 → no change; clamp 18; r = target (immediate); type 2 invalidates its cache. */
  setRadius(l: LightRecord, radius: number): void {
    if (!Number.isInteger(radius)) throw new RangeError(`light radius must be an integer, got ${String(radius)}`)
    if (radius <= 0) return
    const r8 = Math.min(radius, LIGHT_MAX_RADIUS) * 8
    l.r = r8
    l.target = r8
    if (l.type === 2) {
      l.cacheValid = false
      l.cache = null
    }
  }

  /** SetTargetRadius 0x6fb58be0: ≤ 0 ignored; clamp 18; LightUpdate ramps ±8 per build. */
  setTargetRadius(l: LightRecord, radius: number): void {
    if (!Number.isInteger(radius)) throw new RangeError(`light radius must be an integer, got ${String(radius)}`)
    if (radius <= 0) return
    l.target = Math.min(radius, LIGHT_MAX_RADIUS) * 8
  }

  /** SetColor 0x6fb586c0. */
  setColor(l: LightRecord, red: number, green: number, blue: number): void {
    assertByte(red, 'light red')
    assertByte(green, 'light green')
    assertByte(blue, 'light blue')
    l.red = red
    l.green = green
    l.blue = blue
  }

  /** GetRadius 0x6fb58710: `r >> 3` sub-tiles. */
  getRadius(l: LightRecord): number {
    return l.r >> 3
  }

  /** Kill 0x6fb585f0: dying = 1, target = 0; the record fades 8 per build at its last position, then frees itself. */
  kill(l: LightRecord): void {
    l.dying = true
    l.target = 0
  }

  /** Free 0x6fb58630: immediate unlink. */
  free(l: LightRecord): void {
    if (!l.linked) return
    if (this.first === l) {
      this.first = l.next
    } else {
      let p = this.first
      while (p !== null && p.next !== l) p = p.next
      if (p === null) throw new Error('light record is not in this list')
      p.next = l.next
    }
    l.next = null
    l.linked = false
    l.cache = null
    l.cacheValid = false
    this.count -= 1
  }

  /** Frees every record. */
  clear(): void {
    while (this.first !== null) this.free(this.first)
  }

  /**
   * Marks every type-2 occlusion cache invalid, so the next build re-reads the collision words. Port hook for a new
   * collision frame (level change / new collision data); which 1.13c events invalidate the cache through callback
   * 0x6fb58d70 is UNVERIFIED (SPEC §11 Q10).
   */
  invalidateOcclusionCaches(): void {
    for (let l = this.first; l !== null; l = l.next) {
      if (l.type !== 2) continue
      l.cacheValid = false
      l.cache = null
    }
  }

  /**
   * #940 R2 quiescence probe: true when no record animates this game frame —
   * every radius has converged (`target === r`) and none is dying. A caller
   * that also knows its emitter inputs are byte-identical may skip the whole
   * grid rebuild (the grid content would not change).
   */
  isQuiescent(): boolean {
    for (let l = this.first; l !== null; l = l.next) {
      if (l.dying || l.target !== l.r) return false
    }
    return true
  }

  /** The LightUpdate loop of LIGHTMAP_Build (0x6fb59ec3..0x6fb59ee9): every record, newest first. */
  build(grid: LightGrid, mode: 0 | 1 | 2, env: LightBuildEnv): void {
    let l = this.first
    while (l !== null) {
      const next = l.next
      this.update(l, grid, mode, env)
      l = next
    }
  }

  /** LightUpdate 0x6fb59b50(light, mode). */
  private update(l: LightRecord, grid: LightGrid, mode: 0 | 1 | 2, env: LightBuildEnv): void {
    if (!l.dying && l.unitType !== LIGHT_UNIT_NONE && env.ownerPos8 !== undefined) {
      const pos = env.ownerPos8(l.unitType, l.unitId)
      if (pos !== null) {
        l.x8 = pos.x8
        l.y8 = pos.y8
      }
    }
    if (l.target !== l.r) {
      if (l.type === 2) {
        l.cacheValid = false
        l.cache = null
      }
      l.r += l.target > l.r ? LIGHT_RADIUS_STEP : -LIGHT_RADIUS_STEP
    }
    if (l.r >= 0x100) l.r = 0xf8
    if (l.dying && l.r <= 0) {
      this.free(l)
      return
    }
    if (l.type === 0 && mode > 1) {
      applyLightShadowed(grid, l, env.scratch)
    } else if (l.type === 2) {
      if (!l.cacheValid) buildLightType2Cache(l, env.scratch, env.collisionAt, l.x8 >> 3, l.y8 >> 3)
      applyLightCached(grid, l)
    } else {
      applyLightUnshadowed(grid, l, mode, env.localPlayerId)
    }
  }
}

// ------------------------------------------------------------------------------------------------- mode, FPS, RAND

/** The "Light Quality" option (registry string at 0x6fb851f8): 0 low, 1 medium, 2 high. */
export type LightQuality = 0 | 1 | 2

/** Light mode hysteresis state: last mode (0x6fbd341c) and the tick of its last change (0x6fbd3418). */
export interface LightModeState {
  lastMode: 0 | 1 | 2
  lastModeTickMs: number
}

/**
 * Initial hysteresis state. `lastMode` starts at 0 (zero-initialised static, INFERRED). GetTickCount is far above
 * 2000 when a game starts, so the first change is immediate; with the port's page-relative clock that is modelled
 * by a last-change tick of −∞.
 */
export function createLightModeState(): LightModeState {
  return { lastMode: 0, lastModeTickMs: Number.NEGATIVE_INFINITY }
}

/**
 * Mode selection 0x6fb58800. Light Quality 0 → mode 0 (FPS ignored); otherwise FPS ≤ 9 → 0, ≤ 12 → 1, ≤ 15 → keep
 * the last mode if it is ≥ 1 (else 1), above → 2. A change takes effect only if more than 2000 ms passed since the
 * last change.
 */
export function selectLightMode(quality: LightQuality, fps: number, nowMs: number, state: LightModeState): 0 | 1 | 2 {
  let m: 0 | 1 | 2 = 2
  const prev = state.lastMode
  if (quality === 0) {
    m = 0
  } else if (fps <= 9) {
    m = 0
  } else if (fps <= 12) {
    m = 1
  } else if (fps <= 15) {
    if (prev >= 1) return prev
    m = 1
  }
  if (m !== prev) {
    if (nowMs - state.lastModeTickMs <= 2000) return prev
    state.lastModeTickMs = nowMs
    state.lastMode = m
  }
  return m
}

/**
 * FPS counter 0x6fbc9808: rendered frames over a window longer than 3000 ms, divided by 3 (0x6faf23a0–0x6faf23cc);
 * starts at (and is reset to) 25 (0x6faf237c / 0x6faf4cc4). The exact window start is INFERRED.
 */
const LIGHT_FPS_STALL_MS = 500

export class LightFpsCounter {
  fps = 25
  private frames = 0
  private windowStartMs: number | null = null
  private lastFrameMs = Number.NEGATIVE_INFINITY

  reset(): void {
    this.fps = 25
    this.frames = 0
    this.windowStartMs = null
  }

  /** Counts one rendered frame (0x6fbc980c is incremented after each draw, 0x6faf4e7a). */
  onFrameRendered(nowMs: number): void {
    const stalled = nowMs - this.lastFrameMs > LIGHT_FPS_STALL_MS
    this.lastFrameMs = nowMs
    if (this.windowStartMs === null || stalled) {
      this.windowStartMs = nowMs
      this.frames = 0
    }
    this.frames += 1
    if (nowMs - this.windowStartMs > 3000) {
      this.fps = Math.floor(this.frames / 3)
      this.frames = 0
      this.windowStartMs = nowMs
    }
  }
}

/** A D2 64-bit seed (low and high dwords). */
export interface D2Seed {
  lo: number
  hi: number
}

/**
 * RAND 0x6fab1380(seed, n): the 64-bit LCG `seed = lo·0x6ac690c5 + hi`, then `lo & (n−1)` for a power of two n,
 * else `lo % n` (unsigned); n ≤ 0 → 0.
 */
export function d2Rand(seed: D2Seed, n: number): number {
  const next = BigInt(seed.lo >>> 0) * 0x6ac690c5n + BigInt(seed.hi >>> 0)
  seed.lo = Number(next & 0xffffffffn)
  seed.hi = Number((next >> 32n) & 0xffffffffn)
  if (n <= 0) return 0
  return (n & (n - 1)) === 0 ? seed.lo & (n - 1) : seed.lo % n
}
