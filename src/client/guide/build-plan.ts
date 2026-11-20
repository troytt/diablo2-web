import { SKILLS_CATALOG } from '../../common/data/skills-catalog.ts'
import type { BaseStatKey } from '../../common/units/unit-types.ts'
import BUILDS from './data/builds.json'

export const CLASS_NAMES = ['Amazon', 'Sorceress', 'Necromancer', 'Paladin', 'Barbarian', 'Druid', 'Assassin'] as const

type Attribute = keyof (typeof BUILDS)['Amazon']['start']

interface Build {
  readonly start: Readonly<Record<Attribute, number>>
  readonly stats: Readonly<Partial<Record<Attribute, { readonly weight: number; readonly upTo?: number }>>>
  readonly skills: readonly (readonly [string, number])[]
}

const STAT_KEYS: Readonly<Record<Attribute, BaseStatKey>> = { strength: 'str', dexterity: 'dex', vitality: 'vit', energy: 'ene' }
const SKILL_IDS = new Map(SKILLS_CATALOG.map((skill) => [skill.name, skill.id]))
const PREREQS = new Map(SKILLS_CATALOG.map((skill) => [skill.id, skill.reqskills]))

export const buildOf = (charClass: number | null): Build | null => (BUILDS as unknown as Readonly<Record<string, Build>>)[CLASS_NAMES[charClass ?? -1] ?? ''] ?? null

const withPrereqs = (skillId: number, hard: (id: number) => number): readonly number[] => [...(PREREQS.get(skillId) ?? []).filter((id) => hard(id) === 0).flatMap((id) => withPrereqs(id, hard)), skillId]

export function nextSkill(build: Build, hard: (skillId: number) => number, canAllocate: (skillId: number) => boolean): number | null {
  const goal = build.skills.map(([name, level]) => ({ id: SKILL_IDS.get(name)!, level })).find(({ id, level }) => hard(id) < level)
  return goal ? (withPrereqs(goal.id, hard).find(canAllocate) ?? null) : null
}

export function nextStat(build: Build, base: Readonly<Record<BaseStatKey, number>>): BaseStatKey | null {
  const share = (attribute: Attribute) => (base[STAT_KEYS[attribute]] - build.start[attribute]) / build.stats[attribute]!.weight
  const open = (Object.keys(build.stats) as Attribute[]).filter((attribute) => base[STAT_KEYS[attribute]] < (build.stats[attribute]!.upTo ?? Infinity))
  const pick = open.sort((a, b) => share(a) - share(b))[0]
  return pick ? STAT_KEYS[pick] : null
}
