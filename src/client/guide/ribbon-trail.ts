import type { SubTilePoint } from '../motion/pathfind.ts'

const mix = (a: SubTilePoint, b: SubTilePoint, t: number): SubTilePoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

export function fromNearest(points: readonly SubTilePoint[], me: SubTilePoint): SubTilePoint[] {
  const nearest = points.slice(1).reduce(
    (best, b, i) => {
      const a = points[i]!
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      const t = length > 0 ? Math.max(0, Math.min(1, ((me.x - a.x) * (b.x - a.x) + (me.y - a.y) * (b.y - a.y)) / (length * length))) : 0
      const at = mix(a, b, t)
      const distance = Math.hypot(at.x - me.x, at.y - me.y)
      return distance < best.distance ? { distance, next: i + 1 } : best
    },
    { distance: Number.POSITIVE_INFINITY, next: 1 },
  )
  return [me, ...points.slice(nearest.next)]
}

export function rounded(points: readonly SubTilePoint[], rounds = 2): SubTilePoint[] {
  if (rounds === 0 || points.length < 3) return [...points]
  const cut = points.slice(1).flatMap((b, i) => [mix(points[i]!, b, 0.25), mix(points[i]!, b, 0.75)])
  return rounded([points[0]!, ...cut.slice(1, -1), points.at(-1)!], rounds - 1)
}
