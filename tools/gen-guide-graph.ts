import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DEFAULT_NODE_MPQ_DIR, mountNodeArchives } from '../src/baker/mpq-archive-source.ts'
import { parseTable } from '../src/common/world/acts.ts'
import { buildWorldGraph, parseLevelRows } from '../src/common/world/world-graph.ts'

export const GUIDE_GRAPH_PATH = 'src/client/guide/level-graph.gen.ts'
const LEVELS_MEMBER = 'data\\global\\excel\\levels.txt'
const NO_WAYPOINT = 255

export interface GuideGraph {
  readonly edges: readonly (readonly [number, number, 'walk' | 'portal'])[]
  readonly waypoints: readonly (readonly [number, number])[]
}

export function guideGraph(levelsTxt: Uint8Array): GuideGraph {
  const graph = buildWorldGraph(parseLevelRows(parseTable(levelsTxt)))
  const edges = graph.edges.map((e) => [e.from, e.to, e.kind === 'portal' ? 'portal' : 'walk'] as const)
  const waypoints = [...graph.levels.values()].filter((l) => l.waypoint >= 0 && l.waypoint < NO_WAYPOINT).map((l) => [l.waypoint, l.id] as const)
  const byNumbers = (a: readonly (number | string)[], b: readonly (number | string)[]) => Number(a[0]) - Number(b[0]) || Number(a[1]) - Number(b[1])
  return { edges: [...edges].sort(byNumbers), waypoints: [...waypoints].sort(byNumbers) }
}

export const renderGuideGraph = ({ edges, waypoints }: GuideGraph): string =>
  [
    "import type { LinkKind } from './level-links.ts'",
    '',
    'export const LEVEL_EDGES: readonly (readonly [number, number, LinkKind])[] = [',
    ...edges.map(([from, to, kind]) => `  [${from}, ${to}, '${kind}'],`),
    ']',
    '',
    'export const WAYPOINT_LEVEL_PAIRS: readonly (readonly [number, number])[] = [',
    ...waypoints.map(([id, level]) => `  [${id}, ${level}],`),
    ']',
    '',
  ].join('\n')

export const readLevelsTxt = (mpqDir = DEFAULT_NODE_MPQ_DIR): Promise<Uint8Array> => mountNodeArchives(mpqDir).read(LEVELS_MEMBER)

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const graph = guideGraph(await readLevelsTxt())
  writeFileSync(resolve(GUIDE_GRAPH_PATH), renderGuideGraph(graph))
  console.log(`wrote ${GUIDE_GRAPH_PATH}: ${String(graph.edges.length)} links, ${String(graph.waypoints.length)} waypoints`)
}
