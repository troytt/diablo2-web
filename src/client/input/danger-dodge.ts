import type { SubTilePoint } from '../motion/pathfind.ts'
import HAZARDS from '../../common/skills/data/hostile-hazards.json'

export interface FlyingMissile {
  readonly name: string
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly ticksLeft: number
}

export interface Threat extends FlyingMissile {
  readonly radius: number
}

const HAZARD_RADIUS = HAZARDS.hazards as Readonly<Record<string, number>>
const BLAST_RADIUS = HAZARDS.blasts as Readonly<Record<string, number>>
const HARMLESS = new Set(HAZARDS.harmless)
const BOLT_RADIUS = 1.5
const BODY = 1
const HORIZON_TICKS = 14
const SAFETY = 1
const RINGS = [3, 5, 7]
const ANGLES = 16

export function threatOf(missile: FlyingMissile): Threat | null {
  if (HARMLESS.has(missile.name)) return null
  const moving = Math.hypot(missile.vx, missile.vy) > 1e-3
  const radius = moving ? (BLAST_RADIUS[missile.name] ?? BOLT_RADIUS) : HAZARD_RADIUS[missile.name]
  return radius === undefined ? null : { ...missile, ticksLeft: moving ? Math.min(HORIZON_TICKS, Math.max(0, missile.ticksLeft)) : 0, radius }
}

export function hits(threat: Threat, at: SubTilePoint, margin = 0): boolean {
  const [px, py] = [at.x - threat.x, at.y - threat.y]
  const speed2 = threat.vx * threat.vx + threat.vy * threat.vy
  const ticks = speed2 > 0 ? Math.max(0, Math.min(threat.ticksLeft, (px * threat.vx + py * threat.vy) / speed2)) : 0
  return Math.hypot(px - threat.vx * ticks, py - threat.vy * ticks) <= threat.radius + BODY + margin
}

export function dodgeSpot(me: SubTilePoint, threats: readonly Threat[], open: (spot: SubTilePoint) => boolean, preference: (spot: SubTilePoint) => number): SubTilePoint | null {
  const candidates = RINGS.flatMap((ring) => Array.from({ length: ANGLES }, (_, i) => ({ x: Math.round(me.x + Math.cos((i * 2 * Math.PI) / ANGLES) * ring), y: Math.round(me.y + Math.sin((i * 2 * Math.PI) / ANGLES) * ring) })))
  return candidates.filter((spot) => threats.every((threat) => !hits(threat, spot, SAFETY)) && open(spot)).sort((a, b) => preference(b) - preference(a))[0] ?? null
}
