import { CANONICAL_POTION_SPECS } from '../../common/items/misc-items.ts'

const BELT_COLUMNS = 4
const FRAME_MS = 40
const DRINK_GAP_MS = 1_000
const LOW_STOCK = 4

export interface AutoPotionThresholds {
  readonly life: number
  readonly mana: number
  readonly rejuv: number
  readonly merc: number
}

export type Potion = { readonly code: string } & ({ readonly column: number } | { readonly itemId: number })

export interface PotionVitals {
  readonly life: number
  readonly maxLife: number
  readonly mana: number
  readonly maxMana: number
  readonly mercLifePct: number | null
  readonly healingActive?: boolean
  readonly manaActive?: boolean
  readonly charClass?: number | null
}

export type PotionKind = 'life' | 'mana' | 'merc'

export type PotionDrink = Potion & { readonly kind: PotionKind }

export type PotionShortage = 'life' | 'mana' | null

const spec = (code: string) => CANONICAL_POTION_SPECS[code]
const isRejuv = (p: Potion) => /^rv[sl]$/.test(p.code)
const isHealing = (p: Potion) => /^hp[1-5]$/.test(p.code)
const isMana = (p: Potion) => /^mp[1-5]$/.test(p.code)
const inBelt = (p: Potion) => 'column' in p
const HEALING_POTION_PCT_BY_CLASS: readonly number[] = [150, 100, 100, 150, 200, 100, 150]
const MANA_POTION_PCT_BY_CLASS: readonly number[] = [150, 200, 200, 150, 100, 200, 150]
const classFactor = (table: readonly number[], charClass: number | null | undefined) => (table[charClass ?? -1] ?? 100) / 100
const percent = (value: number, max: number) => (max > 0 ? (value * 100) / max : 100)
const normalizeCode = (code: string) => code.trim().toLowerCase()
const hpAmount = (p: Potion) => spec(p.code)?.hpAmount ?? 0

export const inventoryPotions = (items: Iterable<{ readonly id: number; readonly code: string }>): Potion[] =>
  [...items].map((item) => ({ itemId: item.id, code: normalizeCode(item.code) })).filter((p) => isHealing(p) || isMana(p) || isRejuv(p))

export const bottomBeltPotions = (items: Iterable<{ readonly code: string; readonly gridX?: number; readonly x?: number }>): Potion[] =>
  [...items]
    .map((item) => ({ slot: item.gridX ?? item.x ?? 0, code: normalizeCode(item.code) }))
    .filter(({ slot }) => slot >= 0 && slot < BELT_COLUMNS * BELT_COLUMNS)
    .sort((a, b) => a.slot - b.slot)
    .filter((item, index, sorted) => sorted.findIndex((other) => other.slot % BELT_COLUMNS === item.slot % BELT_COLUMNS) === index)
    .map(({ slot, code }) => ({ column: slot % BELT_COLUMNS, code }))

const smallestCovering = (potions: readonly Potion[], amountOf: (p: Potion) => number, deficit: number): Potion | undefined => {
  const sorted = [...potions].sort((a, b) => amountOf(a) - amountOf(b))
  return sorted.find((p) => amountOf(p) >= deficit) ?? sorted.at(-1)
}

export const potionShortage = (potions: readonly Potion[], thresholds: AutoPotionThresholds, vitals: PotionVitals): PotionShortage =>
  thresholds.life > 0 && !potions.some((p) => isHealing(p) || isRejuv(p)) ? 'life' : percent(vitals.mana, vitals.maxMana) < thresholds.mana && !potions.some((p) => isMana(p) || isRejuv(p)) ? 'mana' : null

export const wantedPotionPickup = (stock: readonly Potion[], thresholds: AutoPotionThresholds): ((code: string) => boolean) => {
  const low = (enabled: boolean, matches: (p: Potion) => boolean) => enabled && stock.filter((p) => matches(p) || isRejuv(p)).length < LOW_STOCK
  const [lowLife, lowMana] = [low(thresholds.life > 0, isHealing), low(thresholds.mana > 0, isMana)]
  return (code) => {
    const potion = { code: normalizeCode(code), itemId: 0 }
    return isRejuv(potion) ? lowLife || lowMana : (isHealing(potion) && lowLife) || (isMana(potion) && lowMana)
  }
}

export class AutoPotionPlanner {
  private readonly effectUntil: Record<PotionKind, number> = { life: Number.NEGATIVE_INFINITY, mana: Number.NEGATIVE_INFINITY, merc: Number.NEGATIVE_INFINITY }
  private readonly confirmed: Record<PotionKind, boolean> = { life: false, mana: false, merc: false }
  private lastDrinkMs = Number.NEGATIVE_INFINITY

  plan(potions: readonly Potion[], vitals: PotionVitals, thresholds: AutoPotionThresholds, nowMs: number): PotionDrink | null {
    const serverActive = { life: Boolean(vitals.healingActive), mana: Boolean(vitals.manaActive), merc: false }
    this.confirmed.life ||= serverActive.life
    this.confirmed.mana ||= serverActive.mana
    if (nowMs - this.lastDrinkMs < DRINK_GAP_MS || vitals.maxLife <= 0 || vitals.life <= 0) return null
    const lifePct = percent(vitals.life, vitals.maxLife)
    const manaPct = percent(vitals.mana, vitals.maxMana)
    const free = (kind: PotionKind) => !serverActive[kind] && (this.confirmed[kind] || nowMs >= this.effectUntil[kind])
    const drink = (potion: Potion | undefined, kind: PotionKind): PotionDrink | null => (potion ? { ...potion, kind } : null)
    const pick = (stock: readonly Potion[], matches: (p: Potion) => boolean, amountOf: (p: Potion) => number, deficit: number) =>
      smallestCovering(stock.filter((p) => matches(p) && !inBelt(p)), amountOf, deficit) ?? smallestCovering(stock.filter((p) => matches(p) && inBelt(p)), amountOf, deficit)
    const healFactor = classFactor(HEALING_POTION_PCT_BY_CLASS, vitals.charClass)
    const manaFactor = classFactor(MANA_POTION_PCT_BY_CLASS, vitals.charClass)
    const rejuvFor = (pct: number, stock = potions) => pick(stock, isRejuv, hpAmount, thresholds.life - pct)
    const healing = (deficit: number, stock = potions) => pick(stock, isHealing, (p) => hpAmount(p) * healFactor, deficit)
    const mana = (deficit: number) => pick(potions, isMana, (p) => (spec(p.code)?.manaAmount ?? 0) * manaFactor, deficit)
    const anyRejuv = () => pick(potions, isRejuv, hpAmount, 0)
    const lowMana = manaPct < thresholds.mana && vitals.maxMana > 0
    const belt = potions.filter(inBelt)
    const critical = lifePct < thresholds.rejuv
    const merc = vitals.mercLifePct
    return (
      (critical ? drink(rejuvFor(lifePct) ?? healing(vitals.maxLife - vitals.life), 'life') : null) ??
      (lifePct < thresholds.life && lowMana ? drink(anyRejuv(), 'life') : null) ??
      (lifePct < thresholds.life && free('life') ? drink(healing(vitals.maxLife - vitals.life) ?? rejuvFor(lifePct), 'life') : null) ??
      (lowMana && free('mana') ? drink(mana(vitals.maxMana - vitals.mana) ?? anyRejuv(), 'mana') : null) ??
      (merc !== null && merc > 0 && merc < thresholds.merc && free('merc') ? drink(healing(Number.POSITIVE_INFINITY, belt) ?? (merc < thresholds.rejuv ? rejuvFor(merc, belt) : undefined), 'merc') : null)
    )
  }

  record(drink: PotionDrink, nowMs: number): void {
    this.lastDrinkMs = nowMs
    this.confirmed[drink.kind] = false
    this.effectUntil[drink.kind] = nowMs + (spec(drink.code)?.durationTicks ?? 0) * FRAME_MS
  }
}
