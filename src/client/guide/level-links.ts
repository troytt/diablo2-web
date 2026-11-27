import { LEVEL_EDGES, WAYPOINT_LEVEL_PAIRS } from './level-graph.gen.ts'

export type LinkKind = 'walk' | 'portal'

export interface LevelLink {
  readonly to: number
  readonly kind: LinkKind
}

export const LEVEL_LINKS: ReadonlyMap<number, readonly LevelLink[]> = LEVEL_EDGES.reduce(
  (graph, [from, to, kind]) => graph.set(from, [...(graph.get(from) ?? []), { to, kind }]),
  new Map<number, LevelLink[]>(),
)

export const WAYPOINT_LEVELS: ReadonlyMap<number, number> = new Map(WAYPOINT_LEVEL_PAIRS)
