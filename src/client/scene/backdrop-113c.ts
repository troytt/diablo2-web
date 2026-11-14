/**
 * Diablo II v1.13c level backdrops drawn by the scene renderer before the floors (D2Client.dll 0x6fb3b110:
 * `levelId == 0x4A` → 0x6fb3ae00, then `levelId == 0x78` → 0x6fb3a6c0, else 0x6fb3a140 frees the Arreat cels).
 * Issues #1537 (Arreat Summit sky) and #1538 (Arcane Sanctuary starfield).
 *
 * Arcane Sanctuary (level 74) starfield, 0x6fb3ae00 / respawn 0x6fb3ac40:
 * - Once per process (`[0x6fbcbf24]`): the seed `[0x6fb91304]` is SEED_InitSeed'ed and InitLowSeed'ed with D2Common
 *   #10995 (a time-based value). 8 colours: for i in 0..7, `base = trunc(i * 128 / 7) + 128`, each of R, G, B =
 *   `min(base + (roll & 63) - 32, 255)` (rolls R, G, B in that order), colour = D2Win #10190 nearest palette index.
 *   Then 256 stars: x = RAND(width), y = RAND(height) (0 when height <= 0), speed = -1 - roll % 5,
 *   colour = colours[roll & 7].
 * - Every frame each star is drawn as a one-pixel D2gfx #10010 line (x, y, x, y, colour, 0xFF).
 * - When more than 40 ms passed since the last step (GetTickCount, `cmp eax, 0x28; jbe`), every star moves
 *   `x += speed`; a star with x < 0 respawns at x = width - 1 + (roll & 7) with a new y, speed and colour.
 *
 * Arreat Summit (level 120) sky, 0x6fb3a6c0 (skipped while `[0x6fbcc3a4]` is set):
 * - summit01: d = player client X (#10651, `(x - y) * 16` pixels) − 0x274F (`[0x6fbd3704]`, fixed on the first call);
 *   q = trunc(d / 8); `offset = -(q rem 256)` (C remainder); `column = (trunc(q / 256)) mod 4` (non-negative).
 *   Row r (frames 4r..4r+3) at y = 256 (r + 1) (DrawCelContext y = frame bottom): columns k = 0..3 at
 *   x = offset + 256 k with frame `4 r + (column + k) mod 4`, plus k = -1 when offset > 0. Rows 0 and 1 always,
 *   row 2 only when D2gfx #10031 reports the 800x600 mode (2). Draw mode 5 (opaque), colour 0xFFFFFFFF.
 * - cloud01: once per process (`[0x6fbcbf28]`) the seed `[0x6fb91308]` is initialised like the stars; 10 clouds:
 *   x16 = RAND(width * 16), y = roll % 250, speed = (roll & 15) + 8. Every drawn frame x16 += speed; past
 *   (width + 0x170) * 16 a cloud wraps to x16 = -0x1700 with y = roll % 300. Each cloud draws frame 0 at
 *   (trunc(x16 / 16), y) and frame 1 at x + 256, draw mode 3, colour 0xDDDDDDDD.
 *
 * Port notes: the screen is the viewport (the 1.13c code knows 640/800 wide screens); summit columns are extended
 * with the same `(column + k) mod 4` rule and rows down to the viewport bottom so widescreen viewports are covered.
 * The clouds step once per 25 Hz game frame (1.13c steps once per drawn frame at 25 fps).
 */

import { SEED_RollLimitedRandomNumber, SEED_RollRandomNumber, type D2SeedStrc } from '../../common/rng/d2-rng.ts'
import { nearestPaletteIndex } from '../../common/formats/palette-nearest.ts'

export const ARCANE_SANCTUARY_LEVEL_ID = 0x4a
export const ARREAT_SUMMIT_LEVEL_ID = 0x78
export const STARFIELD_STAR_COUNT = 0x100
export const STARFIELD_STEP_MS = 0x28
export const SUMMIT_ANCHOR_CLIENT_X = 0x274f
export const CLOUD_COUNT = 10
/** Draw colour of the clouds (`push 0xdddddddd`). */
export const CLOUD_COLOR = 0xdddddddd

function roll(seed: D2SeedStrc): number {
  return SEED_RollRandomNumber(seed) >>> 0
}

export interface Star113c {
  x: number
  y: number
  speed: number
  /** Palette index. */
  color: number
}

export class ArcaneStarfield113c {
  readonly stars: Star113c[] = []
  readonly colors: number[] = []
  private lastStepMs = 0

  constructor(
    private readonly seed: D2SeedStrc,
    private readonly width: number,
    private readonly height: number,
    palette: Uint8Array,
  ) {
    for (let i = 0; i < 8; i += 1) {
      const base = Math.trunc((i * 0x80) / 7) + 0x80
      const r = Math.min(base + (roll(seed) & 0x3f) - 0x20, 0xff)
      const g = Math.min(base + (roll(seed) & 0x3f) - 0x20, 0xff)
      const b = Math.min(base + (roll(seed) & 0x3f) - 0x20, 0xff)
      this.colors.push(nearestPaletteIndex(palette, r, g, b))
    }
    for (let i = 0; i < STARFIELD_STAR_COUNT; i += 1) {
      const star = { x: 0, y: 0, speed: 0, color: 0 }
      this.stars.push(star)
      this.respawn(star, false)
    }
  }

  /** 0x6fb3ac40. */
  private respawn(star: Star113c, atEdge: boolean): void {
    star.x = atEdge ? this.width - 1 + (roll(this.seed) & 7) : SEED_RollLimitedRandomNumber(this.seed, this.width)
    star.y = this.height > 0 ? SEED_RollLimitedRandomNumber(this.seed, this.height) : 0
    star.speed = -1 - (roll(this.seed) % 5)
    star.color = this.colors[roll(this.seed) & 7]!
  }

  /** The step part of 0x6fb3ae00 (after the draw): moves the stars when more than 40 ms passed. */
  step(nowMs: number): void {
    if (!(nowMs - this.lastStepMs > STARFIELD_STEP_MS)) return
    for (const star of this.stars) {
      star.x += star.speed
      if (star.x < 0) this.respawn(star, true)
    }
    this.lastStepMs = nowMs
  }
}

export interface SummitTile113c {
  readonly frame: number
  /** Screen x of the frame's left edge. */
  readonly x: number
  /** Screen y of the frame's bottom edge (DrawCelContext). */
  readonly y: number
}

/**
 * summit01 tiles for one frame. `rows1132` is how many rows 1.13c draws (2, or 3 in the 800x600 mode); the port
 * keeps adding rows / columns until `screenWidth` x `screenHeight` is covered.
 */
export function summitTiles113c(playerClientX: number, screenWidth: number, screenHeight: number, rows1132: number): SummitTile113c[] {
  const q = Math.trunc((playerClientX - SUMMIT_ANCHOR_CLIENT_X) / 8)
  const offset = -(q % 256)
  const column = ((Math.trunc(q / 256) % 4) + 4) % 4
  const rows = Math.max(rows1132, Math.ceil(screenHeight / 256))
  const out: SummitTile113c[] = []
  for (let r = 0; r < Math.min(rows, 3); r += 1) {
    const y = 256 * (r + 1)
    const firstK = offset > 0 ? -1 : 0
    for (let k = firstK; offset + 256 * k < screenWidth; k += 1) {
      out.push({ frame: 4 * r + ((((column + k) % 4) + 4) % 4), x: offset + 256 * k, y })
    }
  }
  return out
}

export interface Cloud113c {
  x16: number
  y: number
  speed: number
}

export class ArreatClouds113c {
  readonly clouds: Cloud113c[] = []

  constructor(
    private readonly seed: D2SeedStrc,
    private readonly width: number,
  ) {
    for (let i = 0; i < CLOUD_COUNT; i += 1) {
      const x16 = SEED_RollLimitedRandomNumber(seed, width * 16)
      const y = roll(seed) % 0xfa
      const speed = (roll(seed) & 0xf) + 8
      this.clouds.push({ x16, y, speed })
    }
  }

  /** One frame of movement (0x6fb3ab50..0x6fb3ab9d). */
  step(): void {
    const limit = (this.width + 0x170) * 16
    for (const c of this.clouds) {
      c.x16 += c.speed
      if (c.x16 > limit) {
        c.x16 = -0x1700
        c.y = roll(this.seed) % 0x12c
      }
    }
  }

  /** Screen x of the cloud's frame 0 (`(x16 + (x16 < 0 ? 15 : 0)) >> 4`). */
  static screenX(c: Cloud113c): number {
    return Math.trunc(c.x16 / 16)
  }
}

/** D2Common #10995: `(time + tick + arg)` through three LCG steps (0x19660d, 0x3c6ef35f), masked to 31 bits. */
export function timeSeed113c(timeSec: number, tickMs: number, arg: number): number {
  let v = (timeSec + arg + tickMs) >>> 0
  for (let i = 0; i < 3; i += 1) v = (Math.imul(v, 0x19660d) + 0x3c6ef35f) >>> 0
  return v & 0x7fffffff
}
