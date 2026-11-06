import { describe, expect, it } from 'vitest'
import { SKILLS_CATALOG } from '../../src/common/data/skills-catalog.ts'
import { buildOf, CLASS_NAMES, nextSkill, nextStat } from '../../src/client/guide/build-plan.ts'
import BUILDS from '../../src/client/guide/data/builds.json'

const CLASS_CODES = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass']
const id = (name: string) => SKILLS_CATALOG.find((skill) => skill.name === name)!.id

describe('build plans', () => {
  it('only names skills of their own class', () => {
    CLASS_NAMES.forEach((name, charClass) => {
      const strangers = (BUILDS as unknown as Record<string, { skills: [string, number][] }>)[name]!.skills.filter(([skill]) => SKILLS_CATALOG.find((entry) => entry.name === skill)?.classCode !== CLASS_CODES[charClass])
      expect(strangers, name).toEqual([])
    })
  })

  it('learns the prerequisites on the way to a skill, and saves the point while the next one is locked', () => {
    const sorc = buildOf(1)!
    const hard = (points: Record<string, number>) => (skillId: number) => Object.entries(points).find(([name]) => id(name) === skillId)?.[1] ?? 0
    const early = { 'Fire Bolt': 5, Warmth: 1, 'Frozen Armor': 1 }
    expect(nextSkill(sorc, hard(early), () => true)).toBe(id('Charged Bolt'))
    const teleportReady = { 'Fire Bolt': 20, Warmth: 1, 'Frozen Armor': 1, 'Charged Bolt': 1, Telekinesis: 1, 'Static Field': 1, 'Fire Ball': 20 }
    expect(nextSkill(sorc, hard(teleportReady), () => true)).toBe(id('Teleport'))
    expect(nextSkill(sorc, hard(early), (skillId) => skillId !== id('Charged Bolt'))).toBeNull()
  })

  it('spreads stat points by weight until each stat reaches its target', () => {
    const sorc = buildOf(1)!
    expect(nextStat(sorc, { str: 10, dex: 25, vit: 10, ene: 35 })).toBe('str')
    expect(nextStat(sorc, { str: 11, dex: 25, vit: 12, ene: 35 })).toBe('vit')
    expect(nextStat(sorc, { str: 35, dex: 25, vit: 12, ene: 35 })).toBe('vit')
    expect(buildOf(null)).toBeNull()
  })
})
