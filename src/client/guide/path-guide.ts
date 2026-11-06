import { MONSTER_PATH_IDS } from '../../common/path/monster-path-data.ts'
import { WAYPOINT_CLASS_IDS_113C } from '../../common/world/objects-meta.ts'
import { isClosedDoor } from '../input/play-assists.ts'
import type { LevelView } from '../map/level-view.ts'
import type { SubTilePoint } from '../motion/pathfind.ts'
import type { D2FontRenderer } from '../ui/font.ts'
import type { D2ColorCode } from '../../common/skills/skills-meta.ts'
import type { AutomapHudFootprint, AutomapViewportMetrics } from '../ui/minimap.ts'
import type { ClientUnit } from '../world/client-unit.ts'
import { FlowField } from './flow-field.ts'
import { ChevronFlow, type Chevron } from './chevron-flow.ts'
import { fromNearest, rounded } from './ribbon-trail.ts'
import type { Find, FindKey } from './quest-stages.ts'
import { currentGoal, levelName, nextStep, type Goal, type GuideMode, type QuestProgress, type Step } from './route.ts'
import { spriteOutlines, type OutlineTint } from './sprite-outline.ts'
import { WaypointMemory } from './waypoint-memory.ts'
import { WAYPOINT_LEVELS } from './level-links.ts'

export interface PathGuideHost {
  readonly areaId: () => number
  readonly self: () => { readonly x: number; readonly y: number; readonly isDead: boolean }
  readonly character?: () => string
  readonly quests: () => QuestProgress
  readonly carries?: (code: string) => boolean
  readonly waypoints: () => ReadonlySet<number>
  readonly levelView: () => LevelView | null
  readonly walkable?: (view: LevelView) => Uint8Array
  readonly objects: () => readonly ClientUnit[]
  readonly monsters?: () => readonly ClientUnit[]
  readonly toScreen: (subX: number, subY: number) => { readonly x: number; readonly y: number }
  readonly coveredByHud?: (x: number, y: number) => boolean
  readonly automap: () => { readonly visible: boolean; readonly viewport: AutomapViewportMetrics } | null
}

export type FieldSource = (view: LevelView, target: GuideTarget) => FlowField

export interface GuideTarget {
  readonly x: number
  readonly y: number
  readonly label: string
  readonly unit?: { readonly id: number; readonly kind: 'object' | 'npc' }
}

export interface GuidePlan {
  readonly goal: Goal
  readonly step: Step | null
  readonly hint: string
  readonly target: GuideTarget | null
  readonly path: readonly SubTilePoint[]
  readonly route: readonly SubTilePoint[]
  readonly doors: readonly number[]
  readonly highlights: readonly number[]
}

const GOLD = '#f2c46b'
const GOLD_RGB = '242, 196, 107'
const SHADE = 'rgba(0, 0, 0, 0.55)'
const TRAIL_RGB = '110, 226, 255'
const GOLD_TINT: OutlineTint = [1, 0.8, 0.45]
const DOOR_TINT: OutlineTint = [0.6, 0.85, 1]
const REPLAN_MS = 400
const FOCUS_MS = 1500
const FOCUS_SAME = 4
const FOCUS_CELL = 2
const REPLAN_IDLE_MS = 3000
const REPLAN_MOVE = 3
const DOOR_NEAR_PATH = 3
const TEXT_LINE = 13
const GAP_DEPTH = 10
const CORNER_RADIUS = 18
const TRAIL_STEPS = 40
const TRAIL_ROUNDS = 3
const PORTAL_CLASSES = new Set([59, 60, 298, 342])
const WAYPOINT_NEAR = 45
const LEARN_WAYPOINTS = 'Touch the waypoint so the guide knows yours'

const hintFor = (step: Step | null, goal: Goal, target: GuideTarget | null): string => {
  if (step === null) return 'No known route from here'
  if (step.kind === 'portal') return step.hint
  if (step.kind === 'waypoint') return `Take the waypoint to ${levelName(step.level)}`
  if (step.kind === 'exit') return `${step.level === goal.level ? 'Enter' : 'Head to'} ${levelName(step.level)}`
  return goal.hint ?? (target ? `Find ${target.label}` : `Explore ${levelName(step.level)}`)
}

const seamGap = (view: LevelView, entrance: LevelView['entrances'][number]): readonly [number, number] | null => {
  const [inX, inY] = [Math.sign(entrance.interiorX - entrance.x), Math.sign(entrance.interiorY - entrance.y)]
  if (!entrance.span || (inX === 0) === (inY === 0)) return null
  const edge = (tile: number, inward: number) => (inward > 0 ? tile * 5 : tile * 5 + 4)
  const along = Array.from({ length: (entrance.span.to - entrance.span.from) * 5 }, (_, i) => entrance.span!.from * 5 + i)
  const walkable = (x: number, y: number) => x >= 0 && y >= 0 && x < view.subWidth && y < view.subHeight && view.walkable[y * view.subWidth + x] !== 0
  for (let depth = 0; depth < GAP_DEPTH; depth++) {
    const cells = along
      .map((a): readonly [number, number] => (inX !== 0 ? [edge(entrance.x, inX) + inX * depth, a] : [a, edge(entrance.y, inY) + inY * depth]))
      .filter(([x, y]) => walkable(x, y))
    if (cells.length > 0) return cells[Math.floor(cells.length / 2)]!
  }
  return null
}

const entranceTarget = (view: LevelView, level: number): GuideTarget | null => {
  const entrance = view.entrances.find((e) => e.toLevelId === level)
  if (!entrance) return null
  const [x, y] = entrance.warp ? [entrance.warp.subX, entrance.warp.subY] : (seamGap(view, entrance) ?? [entrance.x * 5 + 2, entrance.y * 5 + 2])
  return { x: view.originX + x, y: view.originY + y, label: levelName(level) }
}

const landmarkTarget = (view: LevelView): GuideTarget | null => {
  const landmark = view.landmarks[0]
  return landmark ? { x: view.originX + landmark.subX, y: view.originY + landmark.subY, label: landmark.id } : null
}

const isSpent = (unit: ClientUnit) => !PORTAL_CLASSES.has(unit.classId) && !WAYPOINT_CLASS_IDS_113C.has(unit.classId) && unit.mode !== 0

const candidatesFor = (keys: readonly FindKey[], view: LevelView, objects: readonly ClientUnit[], monsters: readonly ClientUnit[]): GuideTarget[] => {
  const ids = (kind: 'object' | 'npc') => new Set(keys.map((key) => (kind === 'object' ? (typeof key === 'number' ? key : -1) : typeof key === 'string' ? MONSTER_PATH_IDS.indexOf(key) : -1)).filter((id) => id >= 0))
  const [objectIds, npcIds] = [ids('object'), ids('npc')]
  const live = [
    ...objects.filter((o) => objectIds.has(o.classId) && !o.hidden && !isSpent(o)).map((o) => ({ x: o.x, y: o.y, label: o.name ?? 'Objective', unit: { id: o.id, kind: 'object' as const } })),
    ...monsters.filter((m) => npcIds.has(m.classId) && !m.dead).map((m) => ({ x: m.x, y: m.y, label: m.name ?? 'Objective', unit: { id: m.id, kind: 'npc' as const } })),
  ]
  const known = (type: number, index: number) => (type === 2 && objectIds.has(index)) || (type === 1 && npcIds.has(index))
  const anySpent = objects.some((o) => objectIds.has(o.classId) && isSpent(o))
  return live.length > 0 || anySpent ? live : view.presetUnits.filter((u) => known(u.type, u.index)).map((u) => ({ x: view.originX + u.subX, y: view.originY + u.subY, label: 'Objective' }))
}

const findTargets = (find: readonly Find[], view: LevelView, objects: readonly ClientUnit[], monsters: readonly ClientUnit[], from: SubTilePoint): GuideTarget[] => {
  const distance = (t: GuideTarget) => Math.hypot(t.x - from.x, t.y - from.y)
  for (const entry of find) {
    const found = candidatesFor(typeof entry === 'object' ? entry : [entry], view, objects, monsters)
    if (found.length > 0) return found.sort((a, b) => distance(a) - distance(b))
  }
  return []
}

const freshField = (host: PathGuideHost): FieldSource => (view, target) => new FlowField({ ...view, walkable: host.walkable?.(view) ?? view.walkable }, target.x, target.y)

export function planGuide(host: PathGuideHost, mode: GuideMode, fieldFor: FieldSource = freshField(host), waypoints: ReadonlySet<number> = host.waypoints(), askForWaypoints = false, skipped: ReadonlySet<number> = new Set(), detour: Goal | null = null): GuidePlan | null {
  const level = host.areaId()
  const view = host.levelView()
  const self = host.self()
  const goal = level > 0 ? (detour ?? currentGoal(level, host.quests(), mode, host.carries, skipped)) : null
  if (!goal || !view || self.isDead) return null
  const step = nextStep(level, goal.level, waypoints)
  const objects = host.objects()
  const monsters = host.monsters?.() ?? []
  const find = step?.kind === 'arrived' ? (goal.find ?? []) : step?.kind === 'portal' ? step.find : step?.kind === 'waypoint' ? [[...WAYPOINT_CLASS_IDS_113C]] : []
  const asking = askForWaypoints && step !== null && step.kind !== 'arrived' && step.kind !== 'waypoint'
  const nearWaypoint = asking ? findTargets([[...WAYPOINT_CLASS_IDS_113C]], view, objects, monsters, self).filter((t) => Math.hypot(t.x - self.x, t.y - self.y) <= WAYPOINT_NEAR).slice(0, 1) : []
  const marked = nearWaypoint.length > 0 ? nearWaypoint : findTargets(find, view, objects, monsters, self)
  const target = marked[0] ?? (step?.kind === 'arrived' && goal.spot ? { ...goal.spot, label: goal.title } : null) ?? (step?.kind === 'exit' ? entranceTarget(view, step.level) : step?.kind === 'arrived' && find.length === 0 && !goal.inTown ? landmarkTarget(view) : null)
  const field = target ? fieldFor(view, target) : null
  const path = field?.pathFrom(self.x, self.y, 1) ?? []
  const route = field?.corners(path, self) ?? []
  const doors = objects.filter((door) => isClosedDoor(door) && path.some((p) => Math.hypot(p.x - door.x, p.y - door.y) <= DOOR_NEAR_PATH)).map((door) => door.id)
  const highlights = marked.flatMap((t) => (t.unit?.kind === 'object' ? [t.unit.id] : []))
  return { goal, step, hint: nearWaypoint.length > 0 ? LEARN_WAYPOINTS : hintFor(step, goal, target), target, path, route, doors, highlights }
}

interface ScreenPoint { readonly x: number; readonly y: number }

const traceRounded = (ctx: CanvasRenderingContext2D, points: readonly ScreenPoint[]) => {
  ctx.beginPath()
  points.forEach((p, i) => {
    const next = points[i + 1]
    const prev = points[i - 1]
    if (!prev) ctx.moveTo(p.x, p.y)
    else if (!next) ctx.lineTo(p.x, p.y)
    else ctx.arcTo(p.x, p.y, next.x, next.y, Math.min(CORNER_RADIUS, Math.hypot(p.x - prev.x, p.y - prev.y) / 2, Math.hypot(next.x - p.x, next.y - p.y) / 2))
  })
}

const stroke = (ctx: CanvasRenderingContext2D, style: string | CanvasGradient, width: number, dash: readonly number[] = [], offset = 0) => {
  Object.assign(ctx, { strokeStyle: style, lineWidth: width, lineDashOffset: offset })
  ctx.setLineDash(dash as number[])
  ctx.stroke()
}

const ribbon = (ctx: CanvasRenderingContext2D, points: readonly ScreenPoint[], scale: number, nowMs: number) => {
  traceRounded(ctx, points)
  stroke(ctx, `rgba(${GOLD_RGB}, 0.12)`, 11 * scale)
  stroke(ctx, SHADE, 4 * scale)
  stroke(ctx, `rgba(${GOLD_RGB}, 0.3)`, 5 * scale)
  stroke(ctx, GOLD, 1.8 * scale)
  stroke(ctx, 'rgb(255, 244, 214)', 3.2 * scale, [0.1, 18 * scale], -nowMs / (36 / scale))
}

const chevron = (ctx: CanvasRenderingContext2D, { at, heading, alpha, glow }: Chevron, toScreen: PathGuideHost['toScreen']) => {
  const size = 1 + glow * 0.16
  const corner = (along: number, side: number) => toScreen(at.x + heading.x * along * size - heading.y * side * size, at.y + heading.y * along * size + heading.x * side * size)
  const [left, tip, right] = [corner(-0.4, 0.58), corner(0.42, 0), corner(-0.4, -0.58)]
  ctx.beginPath()
  ctx.moveTo(left.x, left.y)
  ctx.lineTo(tip.x, tip.y)
  ctx.lineTo(right.x, right.y)
  stroke(ctx, `rgba(${TRAIL_RGB}, ${alpha * (0.1 + glow * 0.14)})`, 8)
  stroke(ctx, `rgba(0, 16, 26, ${alpha * 0.38})`, 3.8)
  stroke(ctx, `rgba(${TRAIL_RGB}, ${alpha * (0.62 + glow * 0.3)})`, 2)
  stroke(ctx, `rgba(236, 252, 255, ${alpha * glow * 0.85})`, 1)
}

export class PathGuide {
  enabled = false
  mode: GuideMode = 'story'
  pilotStatus: string | null = null
  readonly skipped = new Set<number>()
  private detourGoal: Goal | null = null
  private focusPoint: { readonly x: number; readonly y: number; readonly at: number } | null = null
  private focusField: { readonly key: string; readonly field: FlowField } | null = null
  private knownWaypoints: ReadonlySet<number> = new Set()
  private plan: GuidePlan | null = null
  private plannedAt = { ms: Number.NEGATIVE_INFINITY, x: 0, y: 0, level: 0 }
  private field: { readonly view: LevelView; readonly field: FlowField } | null = null
  private readonly memory = new WaypointMemory()
  private readonly flow = new ChevronFlow()
  private readonly fieldFor: FieldSource = (view, target) => {
    const cached = this.field
    if (cached?.view === view && cached.field.targetX === target.x && cached.field.targetY === target.y) return cached.field
    return (this.field = { view, field: freshField(this.host)(view, target) }).field
  }

  constructor(private readonly host: PathGuideHost) {}

  get currentPlan(): GuidePlan | null {
    return this.plan
  }

  set detour(goal: Goal | null) {
    if (goal?.level === this.detourGoal?.level && goal?.spot?.x === this.detourGoal?.spot?.x) return
    this.detourGoal = goal
    this.plannedAt = { ...this.plannedAt, ms: Number.NEGATIVE_INFINITY }
  }

  get detour(): Goal | null {
    return this.detourGoal
  }

  focus(point: SubTilePoint, nowMs: number): void {
    this.focusPoint = { x: point.x, y: point.y, at: nowMs }
  }

  private shown(plan: GuidePlan | null, nowMs: number): GuidePlan | null {
    const focus = this.focusPoint
    const view = this.host.levelView()
    if (!plan || !focus || !view || this.pilotStatus === null || nowMs - focus.at > FOCUS_MS) return plan
    if (plan.target && Math.hypot(plan.target.x - focus.x, plan.target.y - focus.y) <= FOCUS_SAME) return plan
    const key = `${view.id}:${Math.round(focus.x / FOCUS_CELL)}:${Math.round(focus.y / FOCUS_CELL)}`
    if (this.focusField?.key !== key) this.focusField = { key, field: freshField(this.host)(view, { x: focus.x, y: focus.y, label: this.pilotStatus }) }
    const self = this.host.self()
    const { field } = this.focusField
    const path = field.pathFrom(self.x, self.y, 1)
    return { ...plan, target: { x: focus.x, y: focus.y, label: this.pilotStatus }, path, route: field.corners(path, self), doors: [], highlights: [] }
  }

  skip(row: number): void {
    this.skipped.add(row)
    this.plannedAt = { ...this.plannedAt, ms: Number.NEGATIVE_INFINITY }
  }

  update(nowMs: number): GuidePlan | null {
    if (!this.enabled) return this.publish(null)
    const { x, y } = this.host.self()
    const level = this.host.areaId()
    const since = nowMs - this.plannedAt.ms
    const moved = Math.hypot(x - this.plannedAt.x, y - this.plannedAt.y) >= REPLAN_MOVE
    if (since >= REPLAN_IDLE_MS || level !== this.plannedAt.level || (since >= REPLAN_MS && moved)) {
      const character = this.host.character?.() ?? ''
      const fromMenu = this.host.waypoints()
      const waypoints = this.memory.known(character, level, fromMenu)
      this.knownWaypoints = waypoints
      this.publish(planGuide(this.host, this.mode, this.fieldFor, waypoints, fromMenu.size === 0 && !this.memory.hasMenu(character), this.skipped, this.detourGoal))
      this.plannedAt = { ms: nowMs, x, y, level }
    }
    return this.plan
  }

  draw(ctx: CanvasRenderingContext2D, font: D2FontRenderer, nowMs: number, drawAutomapText: () => AutomapHudFootprint | null, width: number): AutomapHudFootprint | null {
    const plan = this.shown(this.update(nowMs), nowMs)
    if (plan) this.drawWorld(ctx, plan, nowMs)
    if (plan) this.drawAutomapPath(ctx, plan, nowMs, width)
    const footprint = drawAutomapText()
    return plan ? this.drawObjective(ctx, font, plan, footprint, width) : footprint
  }

  private publish(plan: GuidePlan | null): GuidePlan | null {
    spriteOutlines.mark(new Map<number, OutlineTint>([...(plan?.doors ?? []).map((id) => [id, DOOR_TINT] as const), ...(plan?.highlights ?? []).map((id) => [id, GOLD_TINT] as const)]))
    return (this.plan = plan)
  }

  private drawWorld(ctx: CanvasRenderingContext2D, plan: GuidePlan, nowMs: number): void {
    const { toScreen, self } = this.host
    const covered = this.host.coveredByHud ?? (() => false)
    ctx.save()
    Object.assign(ctx, { lineCap: 'round', lineJoin: 'round' })
    this.flow
      .place(this.trailFrom(plan, self()), nowMs)
      .filter(({ at }) => {
        const p = toScreen(at.x, at.y)
        return !covered(p.x, p.y)
      })
      .forEach((c) => chevron(ctx, c, toScreen))
    if (plan.target && plan.target.unit?.kind !== 'object') this.drawMarker(ctx, plan.target, nowMs)
    ctx.restore()
  }

  private trailFrom(plan: GuidePlan, me: SubTilePoint): SubTilePoint[] {
    return rounded(this.routeFrom(me, plan), TRAIL_ROUNDS)
  }

  knowsWaypointIn(level: number): boolean {
    return [...this.knownWaypoints].some((id) => WAYPOINT_LEVELS.get(id) === level)
  }

  reaches(me: SubTilePoint, plan: GuidePlan | null = this.plan): boolean {
    const field = this.fieldOf(plan)
    if (field === null) return true
    return field.distanceFrom(me.x, me.y) !== null || field.pathFrom(me.x, me.y, 1, 1).length > 0
  }

  private fieldOf(plan: GuidePlan | null): FlowField | null {
    return plan && this.field?.view === this.host.levelView() && this.field.field.targetX === plan.target?.x && this.field.field.targetY === plan.target.y ? this.field.field : null
  }

  routeFrom(me: SubTilePoint, plan: GuidePlan | null = this.plan, steps = TRAIL_STEPS): SubTilePoint[] {
    if (!plan || plan.route.length === 0) return []
    const field = this.fieldOf(plan)
    const path = field?.pathFrom(me.x, me.y, 1, steps) ?? []
    return path.length > 0 ? [me, ...field!.corners(path, me)] : fromNearest([plan.path[0] ?? me, ...plan.route], me)
  }

  private drawMarker(ctx: CanvasRenderingContext2D, target: GuideTarget, nowMs: number): void {
    const { x, y } = this.host.toScreen(target.x, target.y)
    const pulse = (nowMs % 1800) / 1800
    if (target.unit?.kind === 'npc') {
      const top = y - 112 + Math.sin(nowMs / 280) * 4
      ctx.beginPath()
      ctx.moveTo(x - 7, top - 6)
      ctx.lineTo(x, top + 3)
      ctx.lineTo(x + 7, top - 6)
      stroke(ctx, SHADE, 5)
      stroke(ctx, GOLD, 2.2)
      return
    }
    const diamond = (r: number) => {
      ctx.beginPath()
      ;[[0, -r / 2], [r, 0], [0, r / 2], [-r, 0]].forEach(([dx, dy], i) => (i === 0 ? ctx.moveTo(x + dx!, y + dy!) : ctx.lineTo(x + dx!, y + dy!)))
      ctx.closePath()
    }
    diamond(14 + pulse * 18)
    stroke(ctx, `rgba(${GOLD_RGB}, ${0.5 * (1 - pulse)})`, 1.5)
    diamond(14)
    Object.assign(ctx, { fillStyle: `rgba(${GOLD_RGB}, 0.12)` }).fill()
    stroke(ctx, SHADE, 3.5)
    stroke(ctx, GOLD, 1.4)
  }

  private drawAutomapPath(ctx: CanvasRenderingContext2D, plan: GuidePlan, nowMs: number, width: number): void {
    const automap = this.host.automap()
    if (!automap?.visible) return
    const vp = automap.viewport
    const scale = vp.screenWidth > 0 ? width / vp.screenWidth : 1
    const me = this.host.self()
    const project = (p: SubTilePoint) => ({
      x: (vp.centerX - vp.effectivePanX + ((p.x - p.y - (me.x - me.y)) * 16) / vp.divisor) * scale,
      y: (vp.centerY - vp.effectivePanY + ((p.x + p.y - (me.x + me.y)) * 8) / vp.divisor) * scale,
    })
    const clip = { x: vp.vpX * scale, y: vp.vpY * scale, w: vp.vpW * scale, h: vp.vpH * scale }
    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.x, clip.y, clip.w, clip.h)
    ctx.clip()
    Object.assign(ctx, { lineCap: 'round', lineJoin: 'round' })
    if (plan.route.length > 0) ribbon(ctx, [me, ...plan.route].map(project), 0.6, nowMs)
    ctx.restore()
    if (!plan.target) return
    const goal = project(plan.target)
    const inset = 7
    const inside = goal.x >= clip.x + inset && goal.x <= clip.x + clip.w - inset && goal.y >= clip.y + inset && goal.y <= clip.y + clip.h - inset
    ctx.save()
    if (inside) {
      const pulse = (nowMs % 1400) / 1400
      ctx.beginPath()
      ctx.arc(goal.x, goal.y, 3 + pulse * 6, 0, Math.PI * 2)
      stroke(ctx, `rgba(${GOLD_RGB}, ${0.7 * (1 - pulse)})`, 1.2)
      ctx.beginPath()
      ;[[0, -4], [4, 0], [0, 4], [-4, 0]].forEach(([dx, dy], i) => (i === 0 ? ctx.moveTo(goal.x + dx!, goal.y + dy!) : ctx.lineTo(goal.x + dx!, goal.y + dy!)))
      ctx.closePath()
      Object.assign(ctx, { fillStyle: GOLD }).fill()
      stroke(ctx, SHADE, 1)
    } else {
      const center = { x: clip.x + clip.w / 2, y: clip.y + clip.h / 2 }
      const angle = Math.atan2(goal.y - center.y, goal.x - center.x)
      const reach = Math.min((clip.w / 2 - inset) / Math.abs(Math.cos(angle) || 1e-6), (clip.h / 2 - inset) / Math.abs(Math.sin(angle) || 1e-6))
      ctx.translate(center.x + Math.cos(angle) * reach, center.y + Math.sin(angle) * reach)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.moveTo(5, 0)
      ctx.lineTo(-4, -4.5)
      ctx.lineTo(-2, 0)
      ctx.lineTo(-4, 4.5)
      ctx.closePath()
      Object.assign(ctx, { fillStyle: GOLD }).fill()
      stroke(ctx, SHADE, 1)
    }
    ctx.restore()
  }

  private drawObjective(ctx: CanvasRenderingContext2D, font: D2FontRenderer, plan: GuidePlan, footprint: AutomapHudFootprint | null, width: number): AutomapHudFootprint {
    const right = width - 16
    const top = (footprint?.bottom ?? 4) + TEXT_LINE
    const lines: readonly (readonly [string, D2ColorCode])[] = [[plan.goal.title, 'white'], [plan.hint, 'gold'], ...(this.pilotStatus ? [[`Autopilot: ${this.pilotStatus}`, 'green'] as const] : [])]
    lines.forEach(([text, color], i) => font.drawText(ctx, text, right, top + i * TEXT_LINE, { font: 'font8', color, align: 'right', shadow: true }))
    const left = right - Math.max(...lines.map(([text]) => font.measureText(text, 'font8')))
    return { titleLeft: Math.min(footprint?.titleLeft ?? left, left), bottom: top + (lines.length - 1) * TEXT_LINE + 4 }
  }
}
