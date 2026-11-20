import type { LootItem, LootStat } from './loot-item.ts'
import { SKILLS_CATALOG } from '../data/skills-catalog.ts'
import type { CharacterBuild, Element, PlayStyle } from './character-build.ts'
import VALUATION from './data/item-valuation.json'
import { getEmbeddedDropTables } from './embedded-drop-tables.ts'

export interface ItemProp {
  readonly code: string
  readonly par?: string | number | undefined
  readonly param?: string | number | undefined
  readonly min: number
  readonly max: number
}

const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '')
const SKILL_ID_BY_NAME = new Map(SKILLS_CATALOG.map((skill) => [normalizeName(skill.name), skill.id]))
const skillId = (name: string): number => SKILL_ID_BY_NAME.get(normalizeName(name)) ?? -1

const STAT_ID_BY_NAME: ReadonlyMap<string, number> = (() => {
  const table = getEmbeddedDropTables().itemStatCost as unknown as { readonly records?: readonly { readonly id: number; readonly stat?: string; readonly name?: string }[] } | undefined
  return new Map((table?.records ?? []).map((record) => [record.stat ?? record.name ?? '', record.id]))
})()

const statId = (name: string): number => {
  const id = STAT_ID_BY_NAME.get(name)
  if (id === undefined) throw new Error(`item valuation names unknown stat "${name}"`)
  return id
}

const byStatId = <V>(record: Readonly<Record<string, V>>): ReadonlyMap<number, V> => new Map(Object.entries(record).map(([name, value]) => [statId(name), value]))

const STAT = {
  allSkills: statId('item_allskills'),
  classSkills: statId('item_addclassskills'),
  skillTab: statId('item_addskill_tab'),
  singleSkill: statId('item_singleskill'),
  oskill: statId('item_nonclassskill'),
  charged: statId('item_charged_skill'),
  aura: statId('item_aura'),
  elementSkill: statId('item_elemskill'),
}

const PER_LEVEL = new Map([...byStatId(VALUATION.perLevelStats)].map(([id, target]) => [id, statId(target)]))
const MASTERY = byStatId(VALUATION.elementMastery as Readonly<Record<string, Element>>)
const PIERCE = byStatId(VALUATION.elementPierce as Readonly<Record<string, Element>>)
const ELEMENT_SKILL_PARAM = VALUATION.elementSkillParams as Readonly<Record<string, Element>>
const AURA_VALUE = new Map(Object.entries(VALUATION.auras).map(([name, value]) => [skillId(name), value]))
const PRIZED_SKILLS = new Map(Object.entries(VALUATION.prizedSkills).map(([name, value]) => [skillId(name), value]))
const SPELL_STATS = new Set(VALUATION.spellStats.map(statId))
const FIGHTER_STYLES = new Set<string>(VALUATION.fighterStyles)
const PER_LEVEL_DIVISOR = 8
const CHARGED_SKILL_SHIFT = 6
const SKILL_TAB_SHIFT = 3
const SKILL_TAB_MASK = 7

const { base, fighter, ...styleExtras } = VALUATION.styleWeights
const STYLE_WEIGHTS = Object.fromEntries(
  (Object.keys(styleExtras) as PlayStyle[]).map((style) => [style, byStatId({ ...base, ...(FIGHTER_STYLES.has(style) ? fighter : {}), ...styleExtras[style] })]),
) as Record<PlayStyle, ReadonlyMap<number, number>>

const paramOf = (prop: ItemProp): number | undefined => {
  const raw = prop.par ?? prop.param
  if (raw === undefined || raw === '') return undefined
  const asNumber = Number(raw)
  return Number.isFinite(asNumber) ? asNumber : skillId(String(raw))
}

export function propStats(props: readonly ItemProp[]): LootStat[] {
  const { properties, itemStatCost } = getEmbeddedDropTables()
  if (!properties) return []
  return props.flatMap((prop) => {
    try {
      return properties
        .resolveProperty(prop.code, paramOf(prop), prop.min, prop.max, itemStatCost)
        .map((stat) =>
          PER_LEVEL.has(stat.statId) && stat.param !== undefined
            ? { statId: stat.statId, param: 0, value: stat.param }
            : { statId: stat.statId, param: stat.param ?? 0, value: Math.round((stat.min + stat.max) / 2) },
        )
    } catch {
      return []
    }
  })
}

export const isFighter = (build: CharacterBuild): boolean => FIGHTER_STYLES.has(build.style)

export function statValue({ statId: id, param, value }: LootStat, build: CharacterBuild): number {
  const perLevel = PER_LEVEL.get(id)
  if (perLevel !== undefined) return statValue({ statId: perLevel, param: 0, value: (value * Math.max(1, build.level)) / PER_LEVEL_DIVISOR }, build)
  const skills = VALUATION.skillBonus[build.style]
  switch (id) {
    case STAT.allSkills:
      return value * skills.all
    case STAT.classSkills:
      return param === build.classIndex ? value * skills.classAll : 0
    case STAT.skillTab:
      return param >> SKILL_TAB_SHIFT === build.classIndex ? value * (build.investedTabs.has(param & SKILL_TAB_MASK) ? skills.tab : skills.otherTab) : 0
    case STAT.singleSkill:
      return value * (build.mainSkills.includes(param) ? skills.mainSkill : build.skillPoints.has(param) ? skills.otherTab : 0)
    case STAT.oskill:
      return PRIZED_SKILLS.get(param)?.oskill ?? value * VALUATION.otherOskill
    case STAT.charged:
      return PRIZED_SKILLS.get(param >> CHARGED_SKILL_SHIFT)?.charges ?? VALUATION.otherCharges
    case STAT.aura:
      return AURA_VALUE.get(param) ?? VALUATION.otherAura
    case STAT.elementSkill: {
      const element = ELEMENT_SKILL_PARAM[String(param)]
      return element !== undefined && build.elements.has(element) ? value * VALUATION.elementSkillWeight : 0
    }
  }
  const element = MASTERY.get(id) ?? PIERCE.get(id)
  if (element !== undefined) return build.style === 'caster' && build.elements.has(element) ? value * (PIERCE.has(id) ? VALUATION.pierceWeight : VALUATION.masteryWeight) : 0
  return value * (STYLE_WEIGHTS[build.style].get(id) ?? 0)
}

export const scoreStats = (stats: readonly LootStat[], build: CharacterBuild): number => stats.reduce((sum, stat) => sum + statValue(stat, build), 0)

type StatSource = Pick<LootItem, 'code' | 'quality' | 'identified' | 'stats' | 'runewordStats'> & Partial<Pick<LootItem, 'uniqueItemId' | 'setItemId' | 'socketedItems'>>

interface NamedRecord {
  readonly index: string
  readonly levelreq: number
  readonly props: readonly ItemProp[]
}

const [SET, UNIQUE] = [5, 7]

export const uniqueRecord = (item: Pick<StatSource, 'quality' | 'uniqueItemId'>): NamedRecord | undefined =>
  item.quality === UNIQUE && item.uniqueItemId !== undefined ? getEmbeddedDropTables().uniques.getById(item.uniqueItemId) : undefined

export const setRecord = (item: Pick<StatSource, 'quality' | 'setItemId'>): (NamedRecord & { readonly set: string }) | undefined => {
  const items = getEmbeddedDropTables().sets.items as unknown as { get(id: number): (NamedRecord & { readonly set: string }) | undefined }
  return item.quality === SET && item.setItemId !== undefined ? items.get(item.setItemId) : undefined
}

export function itemStats(item: StatSource): LootStat[] {
  if (item.identified) return [...item.stats, ...item.runewordStats, ...(item.socketedItems ?? []).flatMap((child) => child.stats)]
  return propStats(uniqueRecord(item)?.props ?? setRecord(item)?.props ?? [])
}

export type WeaponFit = 'full' | 'spell' | 'none'

export function weaponFit(typeCode: string, build: CharacterBuild): WeaponFit {
  const { isA } = getEmbeddedDropTables()
  if (typeCode === 'weap' || !isA(typeCode, 'weap')) return typeCode === 'weap' && build.weaponKind === 'spell' ? 'spell' : 'full'
  const isBow = isA(typeCode, 'miss') && !isA(typeCode, 'thro')
  switch (build.weaponKind) {
    case 'spell':
      return 'spell'
    case 'bow':
      return isBow ? 'full' : 'none'
    case 'javelin':
      return isA(typeCode, 'jave') || isA(typeCode, 'spea') ? 'full' : 'none'
    case 'melee':
      return isBow ? 'none' : 'full'
  }
}

export const fitScore = (stats: readonly LootStat[], build: CharacterBuild, fit: WeaponFit): number =>
  fit === 'none' ? 0 : scoreStats(fit === 'spell' ? stats.filter((stat) => SPELL_STATS.has(stat.statId)) : stats, build)

export const baseGearScore = (damage: { readonly min: number; readonly max: number } | undefined, defense: number, build: CharacterBuild, fit: WeaponFit): number =>
  damage ? (isFighter(build) && fit === 'full' ? ((damage.min + damage.max) / 2) * VALUATION.weaponDamage : 0) : defense * (isFighter(build) ? VALUATION.armorDefense.fighter : VALUATION.armorDefense.other)
