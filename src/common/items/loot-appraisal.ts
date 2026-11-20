import type { LootItem } from './loot-item.ts'
import { SKILLS_CATALOG } from '../data/skills-catalog.ts'
import { CHARACTER_CLASS_CODES } from '../units/classes.ts'
import { className, type CharacterBuild } from './character-build.ts'
import { isEligibleForCharsiImbue113c } from './drop-tables.ts'
import { getEmbeddedDropTables } from './embedded-drop-tables.ts'
import { GEM_INFO, RUNE_INFO } from './gems-data.ts'
import { CANONICAL_GEMS_TABLE } from './gems.ts'
import { CANONICAL_ORANGE_SPECIAL_ITEM_CODES, CANONICAL_QUEST_ITEM_CODES } from './ground-items.ts'
import type { EquipSlotId, UiInventoryItem } from './inventory-model.ts'
import { onlineItemDataToUiInventoryItem } from './item-bridge.ts'
import { baseGearScore, fitScore, itemStats, propStats, scoreStats, setRecord, uniqueRecord, weaponFit } from './item-score.ts'
import KNOWLEDGE from './data/loot-knowledge.json'
import { runewordsFor, type RunewordPick } from './runeword-advice.ts'

export type LootTier = 'junk' | 'keep' | 'good' | 'great'
export type LootKind = 'gold' | 'consumable' | 'quest' | 'rune' | 'gem' | 'charm' | 'jewel' | 'unique' | 'set' | 'rare' | 'magic' | 'base' | 'normal'

export interface Appraisal {
  readonly tier: LootTier
  readonly kind: LootKind
  readonly score: number
  readonly reason: string
  readonly locked: boolean
  readonly upgradeSlot?: EquipSlotId | undefined
}

export interface AppraisalContext {
  readonly build: CharacterBuild
  readonly equipped: readonly LootItem[]
  readonly owned: readonly LootItem[]
  readonly carried?: readonly LootItem[] | undefined
  readonly imbueReady?: boolean | undefined
}

type CharmSize = keyof typeof KNOWLEDGE.charmScore

export const TIER_RANK: Readonly<Record<LootTier, number>> = { junk: 0, keep: 1, good: 2, great: 3 }

const [MAGIC, SET, RARE, UNIQUE, CRAFTED] = [4, 5, 6, 7, 8]
const SUPPLIES = new Set(KNOWLEDGE.supplies)
const JEWELRY = new Set(KNOWLEDGE.jewelry)
const CHARMS = KNOWLEDGE.charms as Readonly<Record<string, CharmSize>>
const BODY_LOC_SLOT = KNOWLEDGE.slotsByBodyLocation as Readonly<Record<string, EquipSlotId>>
const SLOT_LABEL = KNOWLEDGE.slotNames as Readonly<Record<EquipSlotId, string>>
const SOUGHT_UNIQUES = new Set(KNOWLEDGE.soughtUniques)
const SOUGHT_SETS = new Set(KNOWLEDGE.soughtSets)
const HIGH_RUNE = 21
const TRADE_RUNE = 13
const MID_RUNE = 8
const LOW_RUNE_JUNK_LEVEL = 40
const LOW_GEM_JUNK_LEVEL = 25
const FLAWLESS_JUNK_LEVEL = 60
const GEM_HELPS = 15
const MUCH_BETTER = 1.4
const BETTER = 1.1
const MIN_GAIN = 5
const SOON_LEVELS = 3
const BASE_HEADROOM = 6

const IMBUE_TYPES = KNOWLEDGE.imbue.alwaysWorthTypes

const isImbueBase = (item: LootItem, build: CharacterBuild): boolean => {
  const { getBase, isA } = getEmbeddedDropTables()
  const base = getBase(codeOf(item))
  const type = base?.type ?? ''
  const upperTier = base?.normcode !== undefined && base.normcode !== base.id
  return isEligibleForCharsiImbue113c(item) && (IMBUE_TYPES.some((t) => isA(type, t)) || upperTier) && weaponFit(type, build) !== 'none'
}

const codeOf = (item: Pick<LootItem, 'code'>) => item.code.trim().toLowerCase()
const isRune = (code: string) => RUNE_INFO[code] !== undefined

const result = (tier: LootTier, kind: LootKind, score: number, reason: string, extra: Partial<Appraisal> = {}): Appraisal => ({ tier, kind, score: Math.round(score), reason, locked: false, ...extra })

const uiCache = new WeakMap<object, UiInventoryItem>()
const uiOf = (item: LootItem): UiInventoryItem => uiCache.get(item) ?? (uiCache.set(item, onlineItemDataToUiInventoryItem(item)), uiCache.get(item)!)

const tabName = (classIndex: number, tab: number) => SKILLS_CATALOG.find((skill) => skill.classCode === CHARACTER_CLASS_CODES[classIndex] && skill.tabIndex === tab)?.tabName

function runeAppraisal(code: string, { build, owned }: AppraisalContext): Appraisal {
  const num = RUNE_INFO[code]?.num ?? 0
  const have = new Set(owned.map(codeOf).filter(isRune))
  const progress = (rw: RunewordPick) => new Set(rw.runes.filter((rune) => rune === code || have.has(rune))).size
  const wanted = runewordsFor(build)
    .filter((rw) => rw.runes.includes(code))
    .map((rw) => ({ rw, progress: progress(rw), needed: new Set(rw.runes).size }))
    .sort((a, b) => b.progress / b.needed - a.progress / a.needed || Number(a.rw.forMerc) - Number(b.rw.forMerc) || b.rw.score - a.rw.score)[0]
  const forText = wanted ? `For ${wanted.rw.name}${wanted.rw.forMerc ? ' (mercenary)' : ''} · ${wanted.progress}/${wanted.needed} runes` : ''
  if (num >= HIGH_RUNE) return result('great', 'rune', 100 + num, forText || 'High rune')
  if (wanted) return result(wanted.progress === wanted.needed ? 'great' : 'good', 'rune', 40 + num + wanted.progress * 10, forText)
  if (num >= TRADE_RUNE) return result('good', 'rune', 30 + num, 'Worth trading')
  if (num >= MID_RUNE) return result('keep', 'rune', 10 + num, 'Useful for runewords')
  return result(build.level >= LOW_RUNE_JUNK_LEVEL ? 'junk' : 'keep', 'rune', num, 'Low rune')
}

const GEM_SLOTS = KNOWLEDGE.gemSlots as readonly { readonly slot: string; readonly mods: 'weaponMods' | 'helmMods' | 'shieldMods'; readonly text: 'weaponsEn' | 'helmsEn' | 'shieldsEn' }[]

function gemAppraisal(code: string, { build }: AppraisalContext): Appraisal {
  const gem = CANONICAL_GEMS_TABLE.get(code)
  const info = GEM_INFO[code]
  const best = GEM_SLOTS.map((use) => ({ ...use, score: scoreStats(propStats(gem?.[use.mods] ?? []), build) })).sort((a, b) => b.score - a.score)[0]!
  const tier = info?.tier ?? 1
  const reason = `In your ${best.slot}: ${info?.[best.text] ?? ''}`
  const helps = best.score >= GEM_HELPS
  const verdict: LootTier =
    tier >= 5 ? (helps ? 'good' : 'keep') : tier === 4 ? (helps && build.level < FLAWLESS_JUNK_LEVEL ? 'keep' : 'junk') : build.level < LOW_GEM_JUNK_LEVEL && helps ? 'keep' : 'junk'
  return result(verdict, 'gem', best.score + tier * 5, reason)
}

function skillerReason(item: LootItem, build: CharacterBuild): string | null {
  const tab = item.stats.find((stat) => stat.statId === 188 && stat.param >> 3 === build.classIndex && build.investedTabs.has(stat.param & 7))
  return tab ? `+${tab.value} to your ${tabName(build.classIndex, tab.param & 7) ?? 'skills'}` : null
}

function charmAppraisal(item: LootItem, size: CharmSize, { build }: AppraisalContext): Appraisal {
  const { good, great, unidentified } = KNOWLEDGE.charmScore[size]
  if (!item.identified) return result(unidentified as LootTier, 'charm', good, `Unidentified ${size} charm`, { locked: true })
  const skiller = skillerReason(item, build)
  const score = scoreStats(itemStats(item), build)
  const tier: LootTier = skiller || score >= great ? 'great' : score >= good ? 'good' : score >= good / 3 ? 'keep' : 'junk'
  return result(tier, 'charm', score, skiller ?? `Worth ${Math.round(score)} to your build`, { locked: tier !== 'junk' })
}

function jewelAppraisal(item: LootItem, { build }: AppraisalContext): Appraisal {
  if (!item.identified) return result('good', 'jewel', 20, 'Unidentified jewel')
  const score = scoreStats(itemStats(item), build)
  return result(score >= 50 ? 'great' : score >= 20 ? 'good' : score >= 6 ? 'keep' : 'junk', 'jewel', score, `Worth ${Math.round(score)} to your build`)
}

export const slotOf = (item: LootItem): EquipSlotId | undefined => BODY_LOC_SLOT[String(item.bodyLoc || item.equippedSlot)]
const equippedBySlot = (equipped: readonly LootItem[]) => new Map(equipped.flatMap((item) => (slotOf(item) ? [[slotOf(item)!, item] as const] : [])))

const baseTypeOf = (code: string) => getEmbeddedDropTables().getBase(code)?.type ?? ''

export const isTwoHanded = (item: LootItem): boolean => uiOf(item).twoHanded === true

export const equipSlotsOf = (item: LootItem): readonly EquipSlotId[] => uiOf(item).allowedSlots

const damageOf = (ui: UiInventoryItem) => ui.twoHanded ? ui.twoHandDamage : ui.oneHandDamage ?? ui.twoHandDamage

export function gearScore(item: LootItem, build: CharacterBuild): number {
  const ui = uiOf(item)
  const fit = weaponFit(baseTypeOf(codeOf(item)), build)
  return fitScore(itemStats(item), build, fit) + baseGearScore(damageOf(ui), ui.defense ?? item.defense ?? 0, build, fit)
}

const requiredLevel = (item: LootItem, ui: UiInventoryItem) => Math.max(ui.reqLevel ?? 0, uniqueRecord(item)?.levelreq ?? 0, setRecord(item)?.levelreq ?? 0)

const usableBy = (ui: UiInventoryItem, build: CharacterBuild, levelSlack = 0) =>
  (ui.reqClass === undefined || ui.reqClass === CHARACTER_CLASS_CODES[build.classIndex]) && (ui.reqStr ?? 0) <= build.strength + levelSlack * 5 && (ui.reqDex ?? 0) <= build.dexterity + levelSlack * 5

interface Upgrade {
  readonly slot: EquipSlotId
  readonly score: number
  readonly current: number
}

function slotUpgrades(item: LootItem, { build, equipped }: AppraisalContext): Upgrade[] {
  const ui = uiOf(item)
  const worn = equippedBySlot(equipped)
  const score = gearScore(item, build)
  const twoHanding = worn.get('weapon1') !== undefined && isTwoHanded(worn.get('weapon1')!)
  const wornScore = (slot: EquipSlotId) => (worn.get(slot) ? gearScore(worn.get(slot)!, build) : 0)
  return ui.allowedSlots
    .map((slot) => ({ slot, score, current: wornScore(slot) + (ui.twoHanded && slot === 'weapon1' ? wornScore('weapon2') : 0) }))
    .filter((u) => !(u.slot === 'weapon2' && (ui.twoHanded === true || twoHanding)) && worn.get(u.slot)?.id !== item.id)
    .sort((a, b) => a.current - b.current)
}

const gainOf = ({ score, current }: Upgrade) => (current <= 0 ? (score > MIN_GAIN ? Infinity : 0) : score / current)

const isGain = (upgrade: Upgrade) => upgrade.score - upgrade.current >= MIN_GAIN && gainOf(upgrade) >= BETTER

const wearableBy = (item: LootItem, build: CharacterBuild, levels: number) => usableBy(uiOf(item), build, levels) && requiredLevel(item, uiOf(item)) <= build.level + levels

function outrankedBy(item: LootItem, score: number, slots: readonly EquipSlotId[], { build, carried = [] }: AppraisalContext, levels: number): number {
  return carried.filter((other) => {
    if (other.id === item.id || !equipSlotsOf(other).some((slot) => slots.includes(slot)) || !wearableBy(other, build, levels)) return false
    const rival = gearScore(other, build)
    return rival > score || (rival === score && other.id < item.id)
  }).length
}

function upgradeAppraisal(item: LootItem, kind: LootKind, ctx: AppraisalContext): Appraisal | null {
  const ui = uiOf(item)
  if (ui.allowedSlots.length === 0 || !usableBy(ui, ctx.build, SOON_LEVELS)) return null
  const gains = slotUpgrades(item, ctx).filter(isGain)
  const upgrade = gains[0]
  if (upgrade === undefined) return null
  const gain = gainOf(upgrade)
  const reqLevel = requiredLevel(item, ui)
  const wearableNow = reqLevel <= ctx.build.level && usableBy(ui, ctx.build)
  if (outrankedBy(item, upgrade.score, gains.map((u) => u.slot), ctx, wearableNow ? 0 : SOON_LEVELS) >= gains.length) return null
  const slot = SLOT_LABEL[upgrade.slot]
  const pct = Number.isFinite(gain) ? ` (+${Math.round((gain - 1) * 100)}%)` : ''
  if (!wearableNow) return reqLevel <= ctx.build.level + SOON_LEVELS ? result('keep', kind, upgrade.score, `Better ${slot} at level ${Math.max(reqLevel, ctx.build.level + 1)}`) : null
  return result(gain >= MUCH_BETTER ? 'great' : 'good', kind, upgrade.score, `Upgrade for your ${slot}${pct}`, { upgradeSlot: upgrade.slot })
}

function namedAppraisal(item: LootItem, kind: 'unique' | 'set', ctx: AppraisalContext): Appraisal {
  const unique = kind === 'unique' ? uniqueRecord(item) : undefined
  const setItem = kind === 'set' ? setRecord(item) : undefined
  const upgrade = upgradeAppraisal(item, kind, ctx)
  if (upgrade?.tier === 'great') return upgrade
  if ((unique && SOUGHT_UNIQUES.has(unique.index)) || (setItem && SOUGHT_SETS.has(setItem.set))) return result('great', kind, 200, 'Sought-after find')
  if (upgrade) return upgrade
  const score = gearScore(item, ctx.build)
  const levelreq = unique?.levelreq ?? setItem?.levelreq ?? 0
  const outgrown = ctx.build.level >= 30 && levelreq < ctx.build.level - 25
  const tier: LootTier = score >= 120 ? 'good' : outgrown && score < 40 ? 'junk' : 'keep'
  return result(tier, kind, score, tier === 'junk' ? 'Outgrown' : `Worth ${Math.round(score)} to your build`)
}

const ownClassItem = (ui: UiInventoryItem, build: CharacterBuild) => ui.reqClass !== undefined && ui.reqClass === CHARACTER_CLASS_CODES[build.classIndex]

function unknownAffixAppraisal(item: LootItem, kind: 'rare' | 'magic', ctx: AppraisalContext): Appraisal {
  const ui = uiOf(item)
  const code = codeOf(item)
  const jewelry = JEWELRY.has(code)
  const classItem = ownClassItem(ui, ctx.build)
  const foreign = ui.reqClass !== undefined && !classItem
  if (foreign) return result('junk', kind, 0, 'Made for another class')
  if (kind === 'rare') return result(jewelry || classItem ? 'good' : 'keep', kind, jewelry || classItem ? 25 : 8, jewelry ? 'Unidentified rare jewelry' : classItem ? `Unidentified ${className(ctx.build.classIndex)} item` : 'Unidentified rare')
  return result(jewelry || classItem ? 'keep' : 'junk', kind, jewelry || classItem ? 10 : 1, classItem ? `Could roll ${className(ctx.build.classIndex)} skills` : jewelry ? 'Unidentified magic jewelry' : 'Plain magic item')
}

function knownAffixAppraisal(item: LootItem, kind: LootKind, ctx: AppraisalContext): Appraisal {
  const upgrade = upgradeAppraisal(item, kind, ctx)
  if (upgrade) return upgrade
  const skiller = skillerReason(item, ctx.build)
  const score = gearScore(item, ctx.build)
  if (skiller) return result('good', kind, score, skiller)
  return result(score >= 80 ? 'keep' : 'junk', kind, score, score >= 80 ? `Worth ${Math.round(score)} to your build` : 'Not an upgrade')
}

function baseAppraisal(item: LootItem, ctx: AppraisalContext): Appraisal {
  const { build } = ctx
  const sockets = item.totalSockets
  const { isA } = getEmbeddedDropTables()
  const fitsBase = (base: LootItem, rw: RunewordPick) => base.totalSockets === rw.runes.length && base.usedSockets === 0 && !base.runeword && rw.itypes.some((t) => isA(baseTypeOf(codeOf(base)), t))
  const wieldable = (rw: RunewordPick) => rw.forMerc || usableBy(uiOf(item), build, SOON_LEVELS)
  const owned = ctx.owned.some((other) => other.id === item.id)
  const spare = (rw: RunewordPick) => !ctx.owned.some((other) => other.id !== item.id && (!owned || other.id < item.id) && fitsBase(other, rw))
  const fits = (rw: RunewordPick) => fitsBase(item, rw) && rw.levelreq <= build.level + BASE_HEADROOM && wieldable(rw) && spare(rw)
  const pick = sockets > 0 && item.usedSockets === 0 ? runewordsFor(build).find(fits) : undefined
  if (pick) return result('good', 'base', 30 + pick.score / 10, `Base for ${pick.name}${pick.forMerc ? ' (mercenary)' : ''} · ${sockets} sockets`)
  if (ctx.imbueReady && isImbueBase(item, build)) return result('keep', 'base', 20, "Good base for Charsi's imbue")
  return result('junk', item.runeword ? 'base' : 'normal', 0, sockets > 0 ? `${sockets} sockets, no runeword for you` : 'Plain item')
}

export function appraiseItem(item: LootItem, ctx: AppraisalContext): Appraisal {
  const code = codeOf(item)
  if (code === 'gld') return result('keep', 'gold', 0, 'Gold', { locked: true })
  if (CANONICAL_QUEST_ITEM_CODES.has(code) || CANONICAL_ORANGE_SPECIAL_ITEM_CODES.has(code)) return result('great', 'quest', 300, 'Quest or key item', { locked: true })
  if (SUPPLIES.has(code)) return result('keep', 'consumable', 0, 'Supplies', { locked: true })
  if (isRune(code)) return runeAppraisal(code, ctx)
  if (GEM_INFO[code]) return gemAppraisal(code, ctx)
  const charm = CHARMS[code]
  if (charm) return charmAppraisal(item, charm, ctx)
  if (code === 'jew') return jewelAppraisal(item, ctx)
  if (item.runeword) return knownAffixAppraisal(item, 'base', ctx)
  if (item.quality === UNIQUE) return namedAppraisal(item, 'unique', ctx)
  if (item.quality === SET) return namedAppraisal(item, 'set', ctx)
  if (item.quality === RARE || item.quality === MAGIC || item.quality === CRAFTED) {
    const kind = item.quality === MAGIC ? 'magic' : 'rare'
    return item.identified ? knownAffixAppraisal(item, kind, ctx) : unknownAffixAppraisal(item, kind, ctx)
  }
  const upgrade = upgradeAppraisal(item, 'normal', ctx)
  return upgrade && item.totalSockets === 0 ? upgrade : baseAppraisal(item, ctx)
}
