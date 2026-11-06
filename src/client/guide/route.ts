import { getLevelNames } from '../../common/world/level-names-zh.ts'
import { buildQuestLogPage, type QuestLogPage } from '../world/quest-log-state.ts'
import { LEVEL_LINKS, WAYPOINT_LEVELS, type LevelLink } from './level-links.ts'
import { OBJECTIVES, STAGES, type Find } from './quest-stages.ts'

export type GuideMode = 'story' | 'required'

export interface QuestProgress {
  readonly words: ArrayLike<number>
  readonly gameWords?: ArrayLike<number>
  readonly status?: ArrayLike<number>
  readonly den?: number
  readonly barbs?: number
  readonly tomb?: number
}

export const ACT_TOWNS = [1, 40, 75, 103, 109] as const
const FIRST_TOMB = 66
const TOMB_COUNT = 7
const DURIELS_LAIR = 73
const RED_PORTAL = 60
const ROMAN = ['I', 'II', 'III', 'IV', 'V']
const PORTALS: Readonly<Record<string, { readonly hint: string; readonly find: readonly Find[] }>> = {
  '1>40': { hint: 'Talk to Warriv', find: ['warriv1'] },
  '40>75': { hint: 'Talk to Meshif', find: ['meshif1'] },
  '102>103': { hint: 'Take the red portal', find: [[60, 342]] },
  '103>109': { hint: 'Talk to Tyrael', find: ['tyrael2'] },
  '4>38': { hint: 'Touch the Cairn Stones, then take the portal', find: [60, [17, 18, 19, 20, 21]] },
  '54>74': { hint: 'Take the portal in the Palace Cellar', find: [298] },
  '74>46': { hint: "Take the Summoner's portal", find: [60, 357] },
  '46>73': { hint: 'Enter the true tomb', find: [] },
  ...Object.fromEntries([66, 67, 68, 69, 70, 71, 72].map((tomb) => [`${tomb}>73`, { hint: "Enter Duriel's Lair", find: [100] }])),
  '109>121': { hint: "Take Anya's red portal", find: [60] },
  '111>125': { hint: 'Take the red portal to Abaddon', find: [60] },
  '112>126': { hint: 'Take the red portal to the Pit of Acheron', find: [60] },
  '117>127': { hint: 'Take the red portal to the Infernal Pit', find: [60] },
  '120>128': { hint: 'Enter the Worldstone Keep', find: [547] },
  '131>132': { hint: "Take Baal's portal to the Worldstone Chamber", find: [563] },
}
const REWARD_GRANTED = 0x0001
const COMPLETED_NOW = 0x2000
const WALK_COST = 2
const WAYPOINT_COST = 3

export const levelName = (level: number): string => getLevelNames(level).nameEn
export const actOfLevel = (level: number): number => ACT_TOWNS.filter((town) => level >= town).length - 1
const isDone = (word: number) => (word & (REWARD_GRANTED | COMPLETED_NOW)) !== 0
const withCount = (hint: string, page: QuestLogPage | null) => hint.replace('{n}', String(page && page.text.kind !== 'tbl' ? page.text.count : ''))

export interface Goal {
  readonly level: number
  readonly title: string
  readonly row?: number
  readonly hint?: string
  readonly find?: readonly Find[]
  readonly inTown?: true
  readonly bring?: string
  readonly spot?: { readonly x: number; readonly y: number }
}

export function currentGoal(level: number, progress: QuestProgress, mode: GuideMode = 'story', carries: (code: string) => boolean = () => false, skipped: ReadonlySet<number> = new Set()): Goal | null {
  const act = actOfLevel(level)
  const town = ACT_TOWNS[act]!
  const tomb = FIRST_TOMB + Math.min(TOMB_COUNT - 1, Math.max(0, progress.tomb ?? 0))
  const goal = OBJECTIVES[act]
    ?.filter((o) => (mode === 'story' || o.required) && !isDone(progress.words[o.row] ?? 0) && !skipped.has(o.row))
    .map((o) => {
      const page = buildQuestLogPage({ row: o.row, playerWords: progress.words, gameWords: progress.gameWords, status: progress.status?.[o.row] ?? 0, den: progress.den ?? 0, barbs: progress.barbs ?? 0 })
      const key = page ? page.text.key : o.start
      const stage = key === undefined ? undefined : STAGES[key]?.find((s) => !s.unless?.some(carries))
      return stage && { level: stage.level === 'town' ? town : stage.level === 'tomb' ? tomb : stage.level === DURIELS_LAIR && level !== tomb && level !== DURIELS_LAIR ? tomb : stage.level, title: o.name, row: o.row, hint: withCount(stage.hint, page), find: stage.find, ...(stage.level === 'town' ? { inTown: true as const } : {}), ...(stage.bring ? { bring: stage.bring } : {}) }
    })
    .find((g) => g !== undefined)
  return goal ?? (act < 4 ? { level: ACT_TOWNS[act + 1]!, title: `Travel to Act ${ROMAN[act + 1]}` } : null)
}

export type Step =
  | { readonly kind: 'arrived'; readonly level: number }
  | { readonly kind: 'exit'; readonly level: number }
  | { readonly kind: 'portal'; readonly level: number; readonly hint: string; readonly find: readonly Find[] }
  | { readonly kind: 'waypoint'; readonly level: number }

type Hop = LevelLink | { readonly to: number; readonly kind: 'waypoint' }

export function shortestRoute(from: number, to: number, waypointLevels: ReadonlySet<number> = new Set(), links: ReadonlyMap<number, readonly LevelLink[]> = LEVEL_LINKS): readonly Hop[] | null {
  const hasWaypoint = new Set(WAYPOINT_LEVELS.values())
  const hopsFrom = (level: number): readonly Hop[] => [
    ...(links.get(level) ?? []),
    ...(hasWaypoint.has(level) ? [...waypointLevels].filter((wp) => wp !== level).map((wp) => ({ to: wp, kind: 'waypoint' as const })) : []),
  ]
  const cost = new Map<number, number>([[from, 0]])
  const via = new Map<number, { readonly from: number; readonly hop: Hop }>()
  const open = new Set([from])
  while (open.size > 0) {
    const level = [...open].reduce((a, b) => (cost.get(a)! <= cost.get(b)! ? a : b))
    open.delete(level)
    if (level === to) {
      const route: Hop[] = []
      for (let at = to; at !== from; at = via.get(at)!.from) route.unshift(via.get(at)!.hop)
      return route
    }
    for (const hop of hopsFrom(level)) {
      const next = cost.get(level)! + (hop.kind === 'waypoint' ? WAYPOINT_COST : WALK_COST)
      if (next >= (cost.get(hop.to) ?? Infinity)) continue
      cost.set(hop.to, next)
      via.set(hop.to, { from: level, hop })
      open.add(hop.to)
    }
  }
  return null
}

export function nextStep(from: number, to: number, waypoints: ReadonlySet<number> = new Set()): Step | null {
  if (from === to) return { kind: 'arrived', level: to }
  const levels = new Set([...waypoints].map((id) => WAYPOINT_LEVELS.get(id)).filter((level): level is number => level !== undefined))
  const hop = shortestRoute(from, to, levels)?.[0]
  if (!hop) return null
  if (hop.kind === 'waypoint') return { kind: 'waypoint', level: hop.to }
  const portal = PORTALS[`${from}>${hop.to}`]
  return hop.kind === 'portal' || portal ? { kind: 'portal', level: hop.to, hint: portal?.hint ?? `Take the portal to ${levelName(hop.to)}`, find: portal?.find ?? [RED_PORTAL] } : { kind: 'exit', level: hop.to }
}
