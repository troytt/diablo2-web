import { describe, expect, it } from 'vitest'
import { monsterLevel, readiness, trainingGround } from '../../src/client/guide/training.ts'

const BLOOD_MOOR = 2
const COLD_PLAINS = 3
const CATACOMBS_4 = 37
const ARCANE = 74
const me = (level: number, gold = 50_000) => ({ level, gold, difficulty: 0 as const })

describe('training before a hard goal', () => {
  it('trains when the goal area outlevels the character, and after repeated setbacks', () => {
    expect(readiness(me(5), CATACOMBS_4, 0)).toMatchObject({ level: monsterLevel(CATACOMBS_4, 0) - 2 })
    expect(readiness(me(20), ARCANE, 0)).toBeNull()
    expect(readiness(me(20), ARCANE, 2)).toMatchObject({ level: 22, why: 'Too strong for now, training to level 22' })
    expect(readiness(me(20, 100), ARCANE, 0)).toMatchObject({ why: 'Gathering gold for supplies' })
  })

  it('picks a nearby area with monsters just below the character', () => {
    const ground = trainingGround(COLD_PLAINS, me(4), new Set([1, 3]), new Set())!
    expect(monsterLevel(ground, 0)).toBeLessThanOrEqual(3)
    expect(ground).not.toBe(1)
    expect(trainingGround(COLD_PLAINS, me(4), new Set([1, 3]), new Set([ground]))).not.toBe(ground)
    expect(trainingGround(BLOOD_MOOR, me(1), new Set(), new Set())).toBeNull()
  })
})
