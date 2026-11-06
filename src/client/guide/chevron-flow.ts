import type { SubTilePoint } from '../motion/pathfind.ts'

export interface Chevron {
  readonly at: SubTilePoint
  readonly heading: SubTilePoint
  readonly alpha: number
  readonly glow: number
}

export interface ChevronStyle {
  readonly from: number
  readonly length: number
  readonly gap: number
  readonly speed: number
  readonly pulseSpeed: number
  readonly pulseWidth: number
}

export const CHEVRON_STYLE: ChevronStyle = { from: 1.6, length: 24, gap: 2.4, speed: 2.2, pulseSpeed: 10, pulseWidth: 2.4 }

const TELEPORT_DISTANCE = 6
const HEADING_SPAN = 0.7
const FADE_IN = 1.8
const FADE_OUT = 6

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

interface Walker {
  readonly total: number
  pointAt(s: number): SubTilePoint
}

function walker(line: readonly SubTilePoint[]): Walker {
  const lengths = line.slice(1).map((b, i) => Math.hypot(b.x - line[i]!.x, b.y - line[i]!.y))
  let run = 0
  const starts = [0, ...lengths.map((length) => (run += length))]
  const total = run
  return {
    total,
    pointAt: (s) => {
      const clamped = Math.max(0, Math.min(total, s))
      const i = Math.min(lengths.length - 1, starts.reduce((found, start, k) => (start <= clamped ? k : found), 0))
      const [a, b, length] = [line[i]!, line[i + 1] ?? line[i]!, lengths[i] ?? 0]
      const t = length > 0 ? (clamped - starts[i]!) / length : 0
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    },
  }
}

export const alongLine = (line: readonly SubTilePoint[], distance: number): SubTilePoint => walker(line).pointAt(distance)

const unit = (from: SubTilePoint, to: SubTilePoint): SubTilePoint => {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  return length > 1e-6 ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length } : { x: 0, y: 0 }
}

export class ChevronFlow {
  private phase = 0
  private last: { readonly ms: number; readonly me: SubTilePoint } | null = null

  constructor(private readonly style: ChevronStyle = CHEVRON_STYLE) {}

  place(line: readonly SubTilePoint[], nowMs: number): Chevron[] {
    const me = line[0]
    if (!me || line.length < 2) {
      this.last = null
      return []
    }
    this.advance(me, unit(me, line[1]!), nowMs)
    const path = walker(line)
    const { from, gap, pulseSpeed, pulseWidth } = this.style
    const end = Math.min(path.total, this.style.length)
    const wave = ((nowMs / 1000) * pulseSpeed) % (this.style.length + pulseWidth * 4)
    const first = from + ((((this.phase - from) % gap) + gap) % gap)
    return Array.from({ length: Math.max(0, Math.ceil((end - first) / gap)) }, (_, k) => first + k * gap)
      .filter((s) => s < end - 0.4)
      .map((s) => ({
        at: path.pointAt(s),
        heading: unit(path.pointAt(s - HEADING_SPAN), path.pointAt(s + HEADING_SPAN)),
        alpha: smooth((s - from) / FADE_IN) * smooth((end - s) / FADE_OUT),
        glow: Math.exp(-(((s - wave) / pulseWidth) ** 2)),
      }))
  }

  private advance(me: SubTilePoint, heading: SubTilePoint, nowMs: number): void {
    const last = this.last
    this.last = { ms: nowMs, me }
    if (!last) return
    const moved = { x: me.x - last.me.x, y: me.y - last.me.y }
    const progress = Math.hypot(moved.x, moved.y) > TELEPORT_DISTANCE ? 0 : moved.x * heading.x + moved.y * heading.y
    this.phase = (this.phase + (Math.max(0, nowMs - last.ms) / 1000) * this.style.speed - progress) % (this.style.gap * 1000)
  }
}
