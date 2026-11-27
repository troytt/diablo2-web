import { SKILLS_BY_ID, type SkillCatalogEntry } from '../data/skills-catalog.ts'
import { CHARACTER_CLASS_CODES, CHARACTER_CLASS_NAMES } from '../units/classes.ts'
import PLAY_STYLES from './data/play-styles.json'

export type PlayStyle = 'caster' | 'melee' | 'ranged' | 'summoner'
export type Element = keyof typeof PLAY_STYLES.elementNames
export type WeaponKind = 'bow' | 'javelin' | 'melee' | 'spell'

export interface CharacterSheet {
  readonly classIndex: number
  readonly level: number
  readonly strength: number
  readonly dexterity: number
  readonly skillPoints: ReadonlyMap<number, number>
}

export interface CharacterBuild extends CharacterSheet {
  readonly style: PlayStyle
  readonly elements: ReadonlySet<Element>
  readonly investedTabs: ReadonlySet<number>
  readonly mainSkills: readonly number[]
  readonly weaponKind: WeaponKind
}

const DEFAULT_STYLE = PLAY_STYLES.defaultStyle as Readonly<Record<string, PlayStyle>>
const RANGED_TABS = new Set(PLAY_STYLES.rangedTabs)
const ELEMENTS = new Set(Object.keys(PLAY_STYLES.elementNames))

export const className = (classIndex: number): string => CHARACTER_CLASS_NAMES[classIndex] ?? 'Character'

const isElement = (eType: string): eType is Element => ELEMENTS.has(eType)
const isSummon = (skill: SkillCatalogEntry) => skill.tabName.startsWith(PLAY_STYLES.summonTabPrefix) && (skill.minionStats !== undefined || skill.classCode === 'nec')
const isWeaponSkill = (skill: SkillCatalogEntry) => skill.srcDamage > 0
const isSpell = (skill: SkillCatalogEntry) => isElement(skill.eType) || skill.minDam > 0

const styleOf = (skill: SkillCatalogEntry): PlayStyle | null =>
  isSummon(skill) ? 'summoner' : RANGED_TABS.has(skill.tabName) && (isWeaponSkill(skill) || isSpell(skill)) ? 'ranged' : isWeaponSkill(skill) ? 'melee' : isSpell(skill) ? 'caster' : null

const tally = <K>(entries: readonly (readonly [K, number])[]): Map<K, number> => entries.reduce((acc, [key, points]) => acc.set(key, (acc.get(key) ?? 0) + points), new Map<K, number>())

export function characterBuild(sheet: CharacterSheet): CharacterBuild {
  const ownCode = CHARACTER_CLASS_CODES[sheet.classIndex]
  const invested = [...sheet.skillPoints]
    .map(([id, points]) => ({ skill: SKILLS_BY_ID[id], points }))
    .filter((entry): entry is { skill: SkillCatalogEntry; points: number } => entry.skill !== undefined && entry.points > 0 && entry.skill.classCode === ownCode)
  const pointsByStyle = tally(invested.flatMap(({ skill, points }) => (styleOf(skill) ? [[styleOf(skill)!, points] as const] : [])))
  const style = [...pointsByStyle].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (ownCode ? DEFAULT_STYLE[ownCode] : undefined) ?? 'melee'
  const mainSkills = invested.filter(({ skill }) => styleOf(skill) === style).sort((a, b) => b.points - a.points)
  const elementPoints = tally(mainSkills.flatMap(({ skill, points }) => (isElement(skill.eType) ? [[skill.eType, points] as const] : [])))
  const elementTotal = mainSkills.reduce((sum, { points }) => sum + points, 0)
  const topTab = mainSkills[0]?.skill.tabName
  return {
    ...sheet,
    style,
    elements: new Set([...elementPoints].filter(([, points]) => points >= elementTotal * PLAY_STYLES.mainElementShare).map(([element]) => element)),
    investedTabs: new Set(invested.map(({ skill }) => skill.tabIndex)),
    mainSkills: mainSkills.map(({ skill }) => skill.id),
    weaponKind: style === 'ranged' ? (topTab === PLAY_STYLES.javelinTab ? 'javelin' : 'bow') : style === 'melee' ? 'melee' : 'spell',
  }
}

export const describeBuild = (build: CharacterBuild): string =>
  [[...build.elements].map((element) => PLAY_STYLES.elementNames[element]).join('/'), build.style, className(build.classIndex)].filter(Boolean).join(' ')
