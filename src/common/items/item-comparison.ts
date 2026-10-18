import { SKILLS_BY_ID } from '../data/skills-catalog.ts'
import type { EquipSlotId, UiInventoryItem } from './inventory-model.ts'

export type UpgradeVerdict = 'much-better' | 'better' | 'unsure'

const FOLDED_OR_NOISE_STATS = new Set([16, 17, 18, 21, 22, 23, 24, 31, 70, 72, 73, 75, 91, 92, 159, 160, 194])
const MUCH_BETTER_RATIO = 1.5
const MUCH_BETTER_GAINS = 3
const RANK: Record<UpgradeVerdict, number> = { unsure: 1, better: 2, 'much-better': 3 }
const CLASS_CODES = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'] as const
const WEAPON_ONLY_STATS = new Set([19, 60, 62, 93, 119, 135, 136, 141])
const STAT_CLASS_SKILLS = 83
const STAT_SKILL_TAB = 188
const STAT_SINGLE_SKILLS = new Set([97, 107])

export interface BuildProfile {
  readonly classIndex: number
  readonly skillPoints: ReadonlyMap<number, number>
}

interface BuildView {
  readonly classIndex: number
  readonly weaponBased: boolean
  readonly pointsInSkill: (skillId: number) => number
  readonly pointsInTab: (classIndex: number, tab: number) => number
}

const viewOf = ({ classIndex, skillPoints }: BuildProfile): BuildView => {
  const invested = [...skillPoints].filter(([, points]) => points > 0).map(([id, points]) => ({ skill: SKILLS_BY_ID[id], points }))
  const pointsWhere = (matches: (skill: (typeof invested)[number]['skill']) => boolean): number =>
    invested.filter(({ skill }) => matches(skill)).reduce((sum, { points }) => sum + points, 0)
  return {
    classIndex,
    weaponBased: CLASS_CODES[classIndex] === 'bar' || invested.length === 0 || pointsWhere((skill) => (skill?.srcDamage ?? 0) > 0) > 0,
    pointsInSkill: (skillId) => skillPoints.get(skillId) ?? 0,
    pointsInTab: (cls, tab) => pointsWhere((skill) => skill?.classCode === CLASS_CODES[cls] && skill.tabIndex === tab),
  }
}

const helpsBuild = (statId: number, param: number, build: BuildView): boolean =>
  statId === STAT_CLASS_SKILLS
    ? param === build.classIndex
    : statId === STAT_SKILL_TAB
      ? param >> 3 === build.classIndex && build.pointsInTab(param >> 3, param & 7) > 0
      : STAT_SINGLE_SKILLS.has(statId)
        ? build.pointsInSkill(param) > 0
        : build.weaponBased || !WEAPON_ONLY_STATS.has(statId)

type EquippedSlots = Partial<Record<EquipSlotId, UiInventoryItem | null | undefined>>

const damageOf = (item: UiInventoryItem) => (item.twoHanded ? item.twoHandDamage : item.oneHandDamage ?? item.twoHandDamage)

const isWeapon = (item: UiInventoryItem): boolean => damageOf(item) !== undefined

const primaryOf = (item: UiInventoryItem, build: BuildView): number => {
  const damage = damageOf(item)
  return damage ? (build.weaponBased ? (damage.min + damage.max) / 2 : 0) : item.defense ?? 0
}

interface StatEntry {
  readonly statId: number
  readonly param: number
  readonly value: number
}

const statEntries = (stats: unknown, build: BuildView): [string, number][] =>
  Array.isArray(stats)
    ? (stats as StatEntry[])
        .filter((s) => !FOLDED_OR_NOISE_STATS.has(s.statId) && helpsBuild(s.statId, s.param, build))
        .map((s) => [`${s.statId}:${s.param}`, s.value])
    : Object.entries((stats ?? {}) as Record<string, number>)

const statsOf = (item: UiInventoryItem, build: BuildView): Map<string, number> =>
  [item, ...(item.socketedItems ?? [])]
    .flatMap((part) => {
      const raw = part.rawItem as { readonly stats?: unknown; readonly runewordStats?: unknown } | undefined
      return [...statEntries(raw?.stats, build), ...statEntries(raw?.runewordStats, build)]
    })
    .reduce((acc, [key, value]) => acc.set(key, (acc.get(key) ?? 0) + value), new Map<string, number>())

const NO_BUILD: BuildProfile = { classIndex: -1, skillPoints: new Map() }

export function compareItems(candidate: UiInventoryItem, current: UiInventoryItem | null, profile: BuildProfile = NO_BUILD): UpgradeVerdict | null {
  if (current === null) return 'much-better'
  const build = viewOf(profile)
  const [mine, theirs] = [statsOf(candidate, build), statsOf(current, build)]
  const [primary, rivalPrimary] = [primaryOf(candidate, build), primaryOf(current, build)]
  const diffs = [primary - rivalPrimary, ...[...new Set([...mine.keys(), ...theirs.keys()])].map((key) => (mine.get(key) ?? 0) - (theirs.get(key) ?? 0))]
  const gains = diffs.filter((d) => d > 0).length
  if (gains === 0) return null
  if (diffs.some((d) => d < 0)) return 'unsure'
  return (rivalPrimary > 0 ? primary >= rivalPrimary * MUCH_BETTER_RATIO : gains >= MUCH_BETTER_GAINS) ? 'much-better' : 'better'
}

export function upgradeVerdict(
  candidate: UiInventoryItem,
  equipped: EquippedSlots,
  { canUse, unidentified, build = NO_BUILD }: { readonly canUse: boolean; readonly unidentified: boolean; readonly build?: BuildProfile },
): UpgradeVerdict | null {
  const [primarySlot] = candidate.allowedSlots
  if (!canUse || primarySlot === undefined) return null
  if (unidentified) return 'unsure'
  const best =
    candidate.allowedSlots
      .map((slot) => ({ slot, current: equipped[slot] ?? null }))
      .filter(({ slot, current }) => (current ? current !== candidate && isWeapon(current) === isWeapon(candidate) : slot === primarySlot || slot.startsWith('ring')))
      .map(({ current }) => compareItems(candidate, current, build))
      .filter((v): v is UpgradeVerdict => v !== null)
      .sort((a, b) => RANK[b] - RANK[a])[0] ?? null
  return best !== null && candidate.twoHanded && equipped.weapon2 ? 'unsure' : best
}
