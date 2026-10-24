/**
 * #1341 single-source guard: the 148-row MonAi table and `aip1..aip8` layout
 * live only in `src/common/units/monai-113c.ts`; both `GameInstance` and the
 * legacy `GameEngine` harness resolve rows through it.
 */
import { describe, expect, it } from 'vitest'
import {
  MONAI_113C_ROWS,
} from '../../src/common/units/monstats-113c-data.ts'
import {
  MONAI_AIP_113C,
  MONAI_PROFILES_113C,
  findMonaiProfile113c,
  monaiParam113c,
  monaiProfile113c,
} from '../../src/common/units/monai-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('#1341 MonAi single source', () => {
  it('covers every 1.13c MonAi.txt row exactly once', () => {
    expect(MONAI_113C_ROWS).toHaveLength(148)
    const indices = new Set(MONAI_113C_ROWS.map((row) => row.index))
    expect(indices.size).toBe(148)
    for (let index = 0; index < 148; index++) expect(indices.has(index)).toBe(true)
    expect(Object.keys(MONAI_PROFILES_113C)).toHaveLength(148)
  })

  it('resolves every row to the same index and name', () => {
    for (const row of MONAI_113C_ROWS) {
      const profile = findMonaiProfile113c(row.ai)
      expect(profile, row.ai).toBeDefined()
      expect(profile!.index).toBe(row.index)
      expect(profile!.name).toBe(row.ai)
    }
  })

  it('reads aip1..aip8 by their canonical 0-based slots', () => {
    const profile = monaiProfile113c('Fallen')
    const params = [11, 22, 33, 44, 55, 66, 77, 88]
    expect(monaiParam113c(profile, params, MONAI_AIP_113C.aip1, -1)).toBe(11)
    expect(monaiParam113c(profile, params, MONAI_AIP_113C.aip8, -1)).toBe(88)
    expect(monaiParam113c(profile, params, undefined, -1)).toBe(-1)
    expect(monaiParam113c(profile, [], MONAI_AIP_113C.aip1, -1)).toBe(-1)
  })

  it('keeps the reverse-engineered family mapping for the reviewed rows', () => {
    expect(findMonaiProfile113c('Overseer')).toMatchObject({ family: 'melee', whip: true })
    expect(findMonaiProfile113c('HighPriest')).toMatchObject({
      family: 'ranged',
      ranged: true,
      healRangeParam: 5,
    })
    expect(findMonaiProfile113c('Succubus')).toMatchObject({ family: 'kiter' })
    expect(findMonaiProfile113c('FallenShaman')).toMatchObject({
      family: 'resurrector',
      resurrect: true,
    })
    expect(findMonaiProfile113c('MaggotEgg')).toMatchObject({ family: 'stationary' })
  })

  it('makes GameInstance resolve the same profile for a spawned monster', () => {
    const game = new GameInstance({ seed: 4001, areaId: 1 })
    const monsterId = game.spawnMonster({ defId: 'succubus1', x: 20, y: 10, areaId: 1 })
    const monster = (game as unknown as { monsters: Map<number, { ai: string }> }).monsters.get(
      monsterId,
    )!
    expect(monaiProfile113c(monster.ai).family).toBe('kiter')
  })
})