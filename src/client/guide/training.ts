import { getLevelMonsterLevel113c, LEVELS_MONLVL_113C } from '../../common/world/levels-monlvl-113c.ts'
import { ACT_TOWNS, actOfLevel, levelName, shortestRoute } from './route.ts'
import TRAINING from './data/training.json'

export interface Readiness {
  readonly level: number
  readonly gold: number
  readonly why: string
}

export interface Trainee {
  readonly level: number
  readonly gold: number
  readonly difficulty: 0 | 1 | 2
}

const AVOID = new Set(Object.values(TRAINING.avoid))
const TOWNS = new Set<number>(ACT_TOWNS)

export const monsterLevel = (level: number, difficulty: 0 | 1 | 2) => getLevelMonsterLevel113c(level, difficulty)

export function readiness(me: Trainee, questLevel: number, setbacks: number): Readiness | null {
  const act = actOfLevel(questLevel)
  const fightable = TOWNS.has(questLevel) ? 0 : monsterLevel(questLevel, me.difficulty) - TRAINING.safety
  const level = Math.max(fightable, setbacks >= TRAINING.setbacks ? me.level + TRAINING.levelsPerSetback * Math.floor(setbacks / TRAINING.setbacks) : 0)
  const gold = TRAINING.goldPerAct[act] ?? 0
  if (me.level < level) return { level, gold: 0, why: setbacks >= TRAINING.setbacks ? `Too strong for now, training to level ${level}` : `Training to level ${level} for ${levelName(questLevel)}` }
  return me.gold < gold / 4 ? { level: me.level, gold, why: `Gathering gold for supplies` } : null
}

export function trainingGround(from: number, me: Trainee, waypointLevels: ReadonlySet<number>, skip: ReadonlySet<number>): number | null {
  const maxAct = actOfLevel(from)
  const ceiling = me.level - TRAINING.belowGoal
  const hops = (level: number) => shortestRoute(from, level, waypointLevels)?.length ?? Infinity
  const candidates = LEVELS_MONLVL_113C.map((_, id) => id).filter((id) => id > 0 && !TOWNS.has(id) && !AVOID.has(id) && !skip.has(id) && actOfLevel(id) <= maxAct && monsterLevel(id, me.difficulty) <= ceiling)
  const scored = candidates.map((id) => ({ id, mon: monsterLevel(id, me.difficulty), hops: hops(id) })).filter((c) => Number.isFinite(c.hops))
  const best = Math.max(...scored.map((c) => c.mon))
  return scored.filter((c) => c.mon >= Math.max(1, best - TRAINING.spread / 3)).sort((a, b) => a.hops - b.hops || b.mon - a.mon)[0]?.id ?? null
}
