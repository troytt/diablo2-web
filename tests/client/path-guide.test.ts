import { describe, expect, it } from 'vitest'
import { FlowField } from '../../src/client/guide/flow-field.ts'
import { planGuide, type PathGuideHost } from '../../src/client/guide/path-guide.ts'
import { actOfLevel, currentGoal, nextStep, shortestRoute } from '../../src/client/guide/route.ts'
import { ChevronFlow } from '../../src/client/guide/chevron-flow.ts'
import { fromNearest, rounded } from '../../src/client/guide/ribbon-trail.ts'
import { outlinePixels } from '../../src/client/guide/sprite-outline.ts'
import { WaypointMemory } from '../../src/client/guide/waypoint-memory.ts'
import type { LevelView } from '../../src/client/map/level-view.ts'
import type { ClientUnit } from '../../src/client/world/client-unit.ts'

const quests = (done: Record<number, number> = {}, status: Record<number, number> = {}) => ({
  words: Object.assign(new Array(41).fill(0), done),
  status: Object.assign(new Array(41).fill(0), status),
})
const goalOf = (level: number, progress = quests(), mode: 'story' | 'required' = 'story', carries?: (code: string) => boolean) => {
  const goal = currentGoal(level, progress, mode, carries)
  return goal && [goal.level, goal.title, goal.hint]
}

describe('path guide route', () => {
  it('follows the quest log in story order and skips side quests when asked', () => {
    expect(goalOf(1)).toEqual([8, 'Den of Evil', 'Find the Den of Evil'])
    expect(goalOf(2, quests({ 1: 1 }))).toEqual([17, "Sisters' Burial Grounds", 'Find Blood Raven'])
    expect(goalOf(1, quests(), 'required')).toEqual([37, 'Sisters to the Slaughter', "Find Andariel's lair"])
    expect(goalOf(37, quests({ 6: 1 }), 'required')).toEqual([40, 'Travel to Act II', undefined])
    expect(actOfLevel(108)).toBe(3)
  })

  it('walks the Search for Cain one quest-log stage at a time', () => {
    const cain = (status: number) => goalOf(4, quests({ 1: 1, 2: 1 }, { 4: status }))
    expect(cain(0)).toEqual([1, 'The Search for Cain', 'Talk to Akara'])
    expect(cain(1)).toEqual([5, 'The Search for Cain', 'Click the Tree of Inifuss'])
    expect(cain(2)).toEqual([1, 'The Search for Cain', 'Bring the scroll to Akara'])
    expect(cain(3)).toEqual([38, 'The Search for Cain', "Find Cain's cage in Tristram"])
    expect(nextStep(4, 38)).toMatchObject({ kind: 'portal', hint: 'Touch the Cairn Stones, then take the portal' })
  })

  it('sends you for the Horadric Staff parts you do not have yet', () => {
    const staff = (carried: readonly string[]) => goalOf(40, quests({ 9: 1 }, { 10: 2 }), 'story', (code) => carried.includes(code))?.[0]
    expect([staff([]), staff(['box']), staff(['box', 'msf']), staff(['box', 'msf', 'vip'])]).toEqual([60, 64, 61, 40])
  })

  it('takes a finished Horadric Staff to the true tomb the quest log marks', () => {
    const goal = currentGoal(40, { ...quests({ 9: 1 }, { 10: 2 }), tomb: 3 }, 'story', (code) => ['box', 'hst'].includes(code))
    expect([goal?.level, goal?.bring, goal?.find]).toEqual([69, 'hst', [152]])
  })

  it('walks level by level, and takes a waypoint you own when it is shorter', () => {
    expect(shortestRoute(1, 8)?.map((hop) => hop.to)).toEqual([2, 8])
    expect(nextStep(1, 8)).toEqual({ kind: 'exit', level: 2 })
    expect(nextStep(8, 8)).toEqual({ kind: 'arrived', level: 8 })
    expect(nextStep(1, 40)).toMatchObject({ kind: 'portal', level: 40, hint: 'Talk to Warriv' })
    expect(nextStep(1, 25, new Set([3]))).toEqual({ kind: 'waypoint', level: 5 })
    expect(nextStep(1, 25)).toEqual({ kind: 'exit', level: 2 })
    expect(nextStep(2, 25, new Set([0, 3]))).toEqual({ kind: 'exit', level: 1 })
  })

  it('remembers the waypoints a character has seen, alongside the towns already reached', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    new WaypointMemory(storage).known('Hero:0', 40, new Set([0, 3, 9]))
    expect([...new WaypointMemory(storage).known('Hero:0', 40, new Set())].sort((a, b) => a - b)).toEqual([0, 3, 9])
    expect([...new WaypointMemory(storage).known('Other:0', 1, new Set())]).toEqual([0])
    expect([new WaypointMemory(storage).hasMenu('Hero:0'), new WaypointMemory(storage).hasMenu('Other:0')]).toEqual([true, false])
  })
})

describe('path guide drawing helpers', () => {
  it('outlines a sprite just outside its silhouette and leaves the inside clear', () => {
    const mask = new Uint8Array(4 * 4).fill(1)
    const out = outlinePixels(mask, 4, 4, 3)
    const alpha = (x: number, y: number) => out[(y * 10 + x) * 4]!
    expect([alpha(5, 5), alpha(2, 5), alpha(1, 5), alpha(0, 0)]).toEqual([0, 255, alpha(1, 5), 0])
    expect(alpha(1, 5)).toBeGreaterThan(0)
    expect(alpha(1, 5)).toBeLessThan(255)
  })

  it('straightens the route to the corners it has to turn at', () => {
    const size = 30
    const walkable = new Uint8Array(size * size).fill(1)
    for (let y = 0; y < 25; y++) walkable[y * size + 15] = 0
    const field = new FlowField({ subWidth: size, subHeight: size, walkable }, 25, 3)
    const corners = field.corners(field.pathFrom(5, 3, 1), { x: 5, y: 3 })
    expect(corners.length).toBeLessThanOrEqual(4)
    expect(corners.some((p) => p.y >= 24)).toBe(true)
    expect(corners.at(-1)).toEqual(field.pathFrom(5, 3, 1).at(-1))
  })
})

describe('path guide plan', () => {
  const size = 40
  const walkable = new Uint8Array(size * size).fill(1)
  for (let y = 0; y < 30; y++) walkable[y * size + 20] = 0
  const view = {
    originX: 1000, originY: 2000, subOriginX: 1000, subOriginY: 2000, subWidth: size, subHeight: size, walkable,
    entrances: [{ x: 7, y: 1, interiorX: 7, interiorY: 2, toLevelId: 3, side: null, kind: 'gate' }],
    landmarks: [], presetUnits: [],
  } as unknown as LevelView
  const door = { id: 9, unitType: 'object', classId: 13, mode: 0, x: 1020, y: 2031, hidden: false, dead: false, objectMeta: { isDoor: true, hasCollisionMask: 1 } } as unknown as ClientUnit
  const host: PathGuideHost = {
    areaId: () => 2,
    self: () => ({ x: 1005, y: 2035, isDead: false }),
    quests: () => quests({ 1: 1, 2: 1 }, { 4: 1 }),
    waypoints: () => new Set(),
    levelView: () => view,
    objects: () => [door],
    toScreen: (x, y) => ({ x, y }),
    automap: () => null,
  }

  it('routes around walls to the exit and outlines the closed doors on the way', () => {
    const plan = planGuide(host, 'story')!
    expect([plan.goal.title, plan.hint, plan.target]).toEqual(['The Search for Cain', 'Head to Cold Plains', { x: 1037, y: 2007, label: 'Cold Plains' }])
    expect(plan.path.some((p) => p.y >= 2030 && Math.abs(p.x - 1020) <= 1)).toBe(true)
    expect(plan.path.at(-1)).toEqual({ x: 1037, y: 2007 })
    expect(plan.doors).toEqual([9])
  })

  it('aims a seam exit at the open gap in the fence, not at the anchor tile', () => {
    const fenced = new Uint8Array(size * size).fill(1)
    for (let x = 0; x < size; x++) if (x < 24 || x > 28) fenced[x] = fenced[size + x] = fenced[2 * size + x] = 0
    const seam = { ...view, walkable: fenced, entrances: [{ x: 2, y: 0, interiorX: 2, interiorY: 1, toLevelId: 3, side: 'north', kind: 'gate', span: { from: 0, to: 8 } }] } as unknown as LevelView
    expect(planGuide({ ...host, levelView: () => seam }, 'story')!.target).toEqual({ x: 1026, y: 2000, label: 'Cold Plains' })
  })

  it('asks you to touch a nearby waypoint before routing when it does not know yours yet', () => {
    const waypointAt = (x: number, y: number) => ({ id: 41, unitType: 'object', classId: 119, mode: 0, x, y, hidden: false, dead: false, name: 'Waypoint' }) as unknown as ClientUnit
    const [near, far] = [waypointAt(1012, 2030), waypointAt(1039, 2000)]
    const asked = planGuide({ ...host, objects: () => [door, near] }, 'story', undefined, new Set(), true)!
    expect([asked.hint, asked.target?.unit, asked.highlights]).toEqual(['Touch the waypoint so the guide knows yours', { id: 41, kind: 'object' }, [41]])
    expect(planGuide({ ...host, objects: () => [door, far] }, 'story', undefined, new Set(), true)!.hint).toBe('Head to Cold Plains')
    expect(planGuide({ ...host, objects: () => [door, near] }, 'story')!.hint).toBe('Head to Cold Plains')
  })

  it('stays quiet while dead', () => {
    expect(planGuide({ ...host, self: () => ({ x: 1005, y: 2035, isDead: true }) }, 'story')).toBeNull()
  })

  it('targets and outlines the quest object once you are in its level, and marks the NPC to talk to in town', () => {
    const tree = { id: 31, unitType: 'object', classId: 30, mode: 0, x: 1030, y: 2010, hidden: false, dead: false, name: 'Tree of Inifuss' } as unknown as ClientUnit
    const atTree = planGuide({ ...host, areaId: () => 5, objects: () => [door, tree] }, 'story')!
    expect([atTree.hint, atTree.target?.unit, atTree.highlights]).toEqual(['Click the Tree of Inifuss', { id: 31, kind: 'object' }, [31]])
    const akara = { id: 77, unitType: 'monster', classId: 148, x: 1010, y: 2030, dead: false, name: 'Akara' } as unknown as ClientUnit
    const inTown = planGuide({ ...host, areaId: () => 1, quests: () => quests({ 1: 1, 2: 1 }, { 4: 2 }), monsters: () => [akara] }, 'story')!
    expect([inTown.hint, inTown.target?.unit]).toEqual(['Bring the scroll to Akara', { id: 77, kind: 'npc' }])
  })
})

describe('path guide trail', () => {
  it('starts the trail where you stand, not at corners already behind you', () => {
    expect(fromNearest([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], { x: 10.5, y: 3 })).toEqual([{ x: 10.5, y: 3 }, { x: 10, y: 10 }])
  })

  it('rounds corners but keeps both ends', () => {
    const line = rounded([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])
    expect([line[0], line.at(-1)]).toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }])
    expect(line.some((p) => p.x > 5 && p.x < 10 && p.y > 0 && p.y < 5)).toBe(true)
  })

  const corner = (me = { x: 0, y: 0 }) => [me, { x: 12, y: 0 }, { x: 12, y: 30 }]
  const style = { from: 1, length: 20, gap: 2, speed: 3, pulseSpeed: 10, pulseWidth: 2 }

  it('lays evenly spaced chevrons ahead of you that turn with the path and fade at both ends', () => {
    const shown = new ChevronFlow(style).place(corner(), 0)
    expect(shown.length).toBeGreaterThanOrEqual(8)
    expect(shown.every((c, i) => i === 0 || Math.abs(Math.hypot(c.at.x - shown[i - 1]!.at.x, c.at.y - shown[i - 1]!.at.y) - 2) < 0.01 || c.at.x === 12)).toBe(true)
    expect([shown[0]!.heading, shown.at(-1)!.heading]).toEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }])
    expect(shown[0]!.alpha).toBeLessThan(shown[3]!.alpha)
    expect(shown.at(-1)!.alpha).toBeLessThan(shown[3]!.alpha)
    expect(new ChevronFlow(style).place([{ x: 0, y: 0 }], 0)).toEqual([])
  })

  it('keeps chevrons fixed on the ground while you walk, and lets them drift forward over time', () => {
    const flow = new ChevronFlow(style)
    const before = flow.place(corner(), 0).map((c) => c.at.x)
    const walked = flow.place(corner({ x: 0.5, y: 0 }), 0).map((c) => c.at.x)
    expect(walked.slice(0, 3)).toEqual(before.slice(0, 3))
    const later = flow.place(corner({ x: 0.5, y: 0 }), 100).map((c) => c.at.x)
    expect(later[0]! - walked[0]!).toBeCloseTo(0.3, 5)
  })
})
