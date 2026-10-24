import type { SubTilePoint, SubTileWalkabilityGrid } from '../motion/pathfind.ts'
import { erodeToPlayerSize } from './flow-field.ts'

export interface Pad extends SubTilePoint {
  readonly classId: number
}

const NEAR = 6
const distance = (a: SubTilePoint, b: SubTilePoint) => Math.hypot(a.x - b.x, a.y - b.y)

export class Regions {
  private readonly label: Int32Array
  private readonly ox: number
  private readonly oy: number
  private readonly width: number
  private readonly height: number

  constructor(grid: SubTileWalkabilityGrid) {
    const walkable = erodeToPlayerSize(grid)
    const [w, h] = [grid.subWidth, grid.subHeight]
    this.ox = grid.subOriginX ?? 0
    this.oy = grid.subOriginY ?? 0
    this.width = w
    this.height = h
    this.label = new Int32Array(w * h).fill(-1)
    const queue = new Int32Array(w * h)
    for (let seed = 0, next = 0; seed < w * h; seed++) {
      if (walkable[seed] === 0 || this.label[seed] !== -1) continue
      let [head, tail] = [0, 0]
      this.label[seed] = next
      queue[tail++] = seed
      while (head < tail) {
        const cell = queue[head++]!
        const [x, y] = [cell % w, Math.floor(cell / w)]
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const [nx, ny] = [x + dx, y + dy]
            const n = ny * w + nx
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && walkable[n] !== 0 && this.label[n] === -1) {
              this.label[n] = next
              queue[tail++] = n
            }
          }
      }
      next++
    }
  }

  at(point: SubTilePoint): number {
    const [x, y] = [Math.round(point.x) - this.ox, Math.round(point.y) - this.oy]
    for (let r = 0; r <= NEAR; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const [cx, cy] = [x + dx, y + dy]
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && cx >= 0 && cy >= 0 && cx < this.width && cy < this.height && this.label[cy * this.width + cx]! >= 0) return this.label[cy * this.width + cx]!
        }
    return -1
  }
}

export const guessPartner = <P extends Pad>(pad: P, pads: readonly P[], regions: Regions): P | undefined =>
  pads.filter((other) => other.classId === pad.classId && regions.at(other) !== regions.at(pad)).sort((a, b) => distance(a, pad) - distance(b, pad))[0]

export function firstPad<P extends Pad>(regions: Regions, pads: readonly P[], from: SubTilePoint, to: SubTilePoint, partnerOf: (pad: P) => P | undefined, usable: (pad: P) => boolean = () => true): P | null {
  const [start, goal] = [regions.at(from), regions.at(to)]
  if (start < 0 || goal < 0 || start === goal) return null
  const first = new Map<number, P>([[start, undefined as unknown as P]])
  const queue = [start]
  while (queue.length > 0) {
    const region = queue.shift()!
    const exits = pads.filter((pad) => regions.at(pad) === region && (region !== start || usable(pad))).sort((a, b) => distance(a, to) - distance(b, to))
    for (const pad of exits) {
      const landing = partnerOf(pad)
      const next = landing ? regions.at(landing) : -1
      if (next < 0 || first.has(next)) continue
      first.set(next, region === start ? pad : first.get(region)!)
      if (next === goal) return first.get(next)!
      queue.push(next)
    }
  }
  return null
}
