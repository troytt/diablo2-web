import type { SubTilePoint, SubTileWalkabilityGrid } from '../motion/pathfind.ts'

const UNREACHED = -1
const SEED_RADIUS = 6
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const

export const erodeToPlayerSize = ({ walkable, subWidth: w, subHeight: h }: SubTileWalkabilityGrid): Uint8Array =>
  walkable.map((open, i) => {
    const [x, y] = [i % w, Math.floor(i / w)]
    return open !== 0 && x > 0 && y > 0 && x < w - 1 && y < h - 1 && walkable[i - 1] !== 0 && walkable[i + 1] !== 0 && walkable[i - w] !== 0 && walkable[i + w] !== 0 ? 1 : 0
  })

export class FlowField {
  private readonly distance: Int32Array
  private readonly ox: number
  private readonly oy: number
  private readonly grid: SubTileWalkabilityGrid

  constructor(
    grid: SubTileWalkabilityGrid,
    readonly targetX: number,
    readonly targetY: number,
  ) {
    this.grid = { ...grid, walkable: erodeToPlayerSize(grid) }
    this.ox = grid.subOriginX ?? 0
    this.oy = grid.subOriginY ?? 0
    this.distance = new Int32Array(grid.subWidth * grid.subHeight).fill(UNREACHED)
    const seed = this.nearestWalkable(Math.round(targetX) - this.ox, Math.round(targetY) - this.oy)
    if (seed !== null) this.flood(seed)
  }

  private walkable(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.grid.subWidth && y < this.grid.subHeight && this.grid.walkable[y * this.grid.subWidth + x] !== 0
  }

  private nearestWalkable(x: number, y: number, radius = SEED_RADIUS, usable = (cx: number, cy: number) => this.walkable(cx, cy)): number | null {
    for (let r = 0; r <= radius; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && usable(x + dx, y + dy)) return (y + dy) * this.grid.subWidth + x + dx
    return null
  }

  private reached(x: number, y: number): boolean {
    return this.walkable(x, y) && this.distance[y * this.grid.subWidth + x] !== UNREACHED
  }

  private canStep(x: number, y: number, dx: number, dy: number): boolean {
    return this.walkable(x + dx, y + dy)
  }

  private flood(seed: number): void {
    const width = this.grid.subWidth
    const queue = new Int32Array(this.distance.length)
    let [head, tail] = [0, 0]
    this.distance[seed] = 0
    queue[tail++] = seed
    while (head < tail) {
      const cell = queue[head++]!
      const [x, y] = [cell % width, Math.floor(cell / width)]
      for (const [dx, dy] of NEIGHBOURS) {
        const next = (y + dy) * width + x + dx
        if (this.canStep(x, y, dx, dy) && this.distance[next] === UNREACHED) {
          this.distance[next] = this.distance[cell]! + 1
          queue[tail++] = next
        }
      }
    }
  }

  distanceFrom(x: number, y: number): number | null {
    const [lx, ly] = [Math.round(x) - this.ox, Math.round(y) - this.oy]
    const d = this.walkable(lx, ly) ? this.distance[ly * this.grid.subWidth + lx]! : UNREACHED
    return d === UNREACHED ? null : d
  }

  pathFrom(x: number, y: number, every = 3, limit = Number.POSITIVE_INFINITY): SubTilePoint[] {
    const width = this.grid.subWidth
    const start = this.nearestWalkable(Math.round(x) - this.ox, Math.round(y) - this.oy, SEED_RADIUS * 2, (cx, cy) => this.reached(cx, cy))
    if (start === null) return []
    const path: SubTilePoint[] = []
    let [cx, cy] = [start % width, Math.floor(start / width)]
    for (let step = 0; step < limit && this.distance[cy * width + cx]! > 0; step++) {
      const here = this.distance[cy * width + cx]!
      const toTarget = ([dx, dy]: readonly [number, number]) => Math.hypot(cx + dx + this.ox - this.targetX, cy + dy + this.oy - this.targetY)
      const best = NEIGHBOURS.filter(([dx, dy]) => this.canStep(cx, cy, dx, dy) && here - 1 === this.distance[(cy + dy) * width + cx + dx]).sort((a, b) => toTarget(a) - toTarget(b))[0]
      if (!best) break
      ;[cx, cy] = [cx + best[0], cy + best[1]]
      if (step % every === every - 1 || this.distance[cy * width + cx] === 0) path.push({ x: cx + this.ox, y: cy + this.oy })
    }
    return path
  }

  lineOfSight(a: SubTilePoint, b: SubTilePoint): boolean {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2)
    return Array.from({ length: steps + 1 }, (_, i) => i / Math.max(1, steps)).every((t) => this.walkable(Math.round(a.x + (b.x - a.x) * t) - this.ox, Math.round(a.y + (b.y - a.y) * t) - this.oy))
  }

  corners(path: readonly SubTilePoint[], from: SubTilePoint): SubTilePoint[] {
    const corners: SubTilePoint[] = []
    for (let i = 0, anchor = from; i < path.length; i++) {
      while (i + 1 < path.length && this.lineOfSight(anchor, path[i + 1]!)) i++
      corners.push((anchor = path[i]!))
    }
    return corners
  }
}
