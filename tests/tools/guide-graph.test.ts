import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NODE_MPQ_DIR } from '../../src/baker/mpq-archive-source.ts'
import { GUIDE_GRAPH_PATH, guideGraph, readLevelsTxt, renderGuideGraph } from '../../tools/gen-guide-graph.ts'

describe('generated guide graph', () => {
  it.skipIf(!existsSync(join(DEFAULT_NODE_MPQ_DIR, 'd2data.mpq')))('matches Levels.txt (rerun tools/gen-guide-graph.ts if this fails)', async () => {
    expect(readFileSync(GUIDE_GRAPH_PATH, 'utf8')).toBe(renderGuideGraph(guideGraph(await readLevelsTxt())))
  })
})
