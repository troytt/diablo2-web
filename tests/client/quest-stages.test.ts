import { describe, expect, it } from 'vitest'
import { CANONICAL_QUEST_STATE_TABLES } from '../../src/common/data/canonical-quest-data.ts'
import { MONSTER_PATH_IDS } from '../../src/common/path/monster-path-data.ts'
import { CANONICAL_113C_OBJECTS } from '../../src/common/world/objects-meta.ts'
import { LEVEL_LINKS } from '../../src/client/guide/level-links.ts'
import { OBJECTIVES, STAGES, type Find } from '../../src/client/guide/quest-stages.ts'
import { shortestRoute } from '../../src/client/guide/route.ts'

const NOT_A_STEP = /^(qstsnull|NONE|qstsprevious|qstsother|qstsComplete|qstsThankYouComeAgain(Multi)?|Qstsyouarenot8|WarrivAct1IntroGossip1|qsts.*x|qstsa5q24|qstsa3q6|A\d.*)$/
const keys = (find: readonly Find[]) => find.flatMap((entry) => (typeof entry === 'object' ? entry : [entry]))
const stages = Object.entries(STAGES).flatMap(([key, options]) => options.map((stage) => ({ key, stage })))

describe('quest stages', () => {
  it('cover every step the quest log can show for the quests we guide', () => {
    const missing = OBJECTIVES.flat().flatMap(({ row }) =>
      [...new Set(CANONICAL_QUEST_STATE_TABLES[row]!.map((slot) => slot.text))].filter((key) => !NOT_A_STEP.test(key) && !(key in STAGES)).map((key) => `${row}:${key}`),
    )
    expect(missing).toEqual([])
  })

  it('start every quest on a known stage', () => {
    expect(OBJECTIVES.flat().filter((o) => o.start !== undefined && !(o.start in STAGES))).toEqual([])
  })

  it('only name objects and monsters that exist in 1.13c', () => {
    const unknown = stages.flatMap(({ key, stage }) => keys(stage.find).filter((id) => (typeof id === 'number' ? !CANONICAL_113C_OBJECTS[id] : !MONSTER_PATH_IDS.includes(id))).map((id) => `${key}:${id}`))
    expect(unknown).toEqual([])
  })

  it('point at levels the guide can reach from the act town', () => {
    const towns = [1, 40, 75, 103, 109]
    const unreachable = stages.flatMap(({ key, stage }) => (stage.level === 'town' || towns.some((town) => shortestRoute(town, stage.level === 'tomb' ? 66 : (stage.level as number)) !== null) ? [] : [`${key}:${stage.level}`]))
    expect(unreachable).toEqual([])
    expect(LEVEL_LINKS.size).toBeGreaterThan(100)
  })
})
