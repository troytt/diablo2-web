/**
 * Diablo II: Lord of Destruction v1.13c Unit `StatList` (`D2StatListStrc` / `D2StatListExStrc` Parity).
 *
 * Enforces:
 * - 256-fixed-point (`<< 8`, `HIT_SHIFT = 8`) integer arithmetic for life (`hitpoints`/`maxhp`),
 *   mana (`mana`/`maxmana`), stamina (`stamina`/`maxstamina`), and per-frame poison/burn bitrates.
 * - Strict separation of base allocated skill points (`STAT_SKILLPTS` -> `getBaseSkillLevel(skillId)`)
 *   from item/buff `+skills` and item charges (`STAT_ITEM_CHARGED_SKILL`), enforcing the 1.13c
 *   Marrowwalk / charge synergy fix (`blvl` never includes `+skills` or charges).
 * - Data-driven `ItemStatCost.txt` `op 1..13` (`op`, `op param`, `op base`, `op stat1..3`) dispatch
 *   matching `D2Common.dll` `0x6FD89530` (`EvalStatWithOps`) & jump table `0x6FD89AF0`.
 * - Layered `baseStats` (`BaseStats`) vs attached item/modifier statlists (`pMyLastList` / `FullStats`),
 *   separating `item_armor_percent` (ID 16, `op = 13` on item base `armorclass`) from
 *   `skill_armor_percent` (ID 171, `op = ''`, summed in `UNITS_GetDefense` `0x6FD82890`).
 * - Strict canonical `ItemStatCost.txt` stat key validation (rejects any fabricated stat name).
 */
import type { D2DataRegistry, SkillRecord } from '../../common/data/data-registry.ts'
import { evaluateCalc } from '../../common/data/calc-ast.ts'
import { mulDiv113c } from '../../common/data/mul-div-113c.ts'
import { RAW_ITEM_STAT_COST } from '../../common/data/canonical-vendor-data.ts'
import { SKILLS_BY_ID } from '../../common/data/skills-catalog.ts'

const ELEM_TYPE_BY_PARAM_113C: Readonly<Record<number, string>> = {
  0: 'fire',
  1: 'fire',
  2: 'ltng',
  3: 'mag',
  4: 'cold',
  5: 'pois',
} as const

export type UnitStatListOwnerType = 'player' | 'monster' | 'item'

export interface UnitStatListOptions {
  readonly ownerType?: UnitStatListOwnerType
  readonly charClass?: string
  readonly periodOfDay?: number
  readonly timeInPeriod?: number
}

export interface CanonicalItemStatCostDef {
  readonly id: number
  readonly stat: string
  readonly valShift: number
  readonly bMin: boolean
  readonly minAccr: number
  readonly op: number
  readonly opParam: number
  readonly opBase: string
  readonly opStats: readonly string[]
  readonly direct: boolean
  readonly maxStat: string
  readonly damageRelated: boolean
}

export interface ItemStatCostOpRule {
  readonly sourceStatId: number
  readonly sourceStat: string
  readonly op: number
  readonly opParam: number
  readonly opBase: string
  readonly targetStat: string
}

const PARSED_ITEM_STAT_COST = (() => {
  const byId = new Map<number, CanonicalItemStatCostDef>()
  const byName = new Map<string, CanonicalItemStatCostDef>()
  const opRulesByTarget = new Map<string, ItemStatCostOpRule[]>()

  const lines = RAW_ITEM_STAT_COST.split(/\r?\n/)
  const header = (lines[0] ?? '').split('\t').map(h => h.trim().toLowerCase())
  const idxStat = header.indexOf('stat')
  const idxId = header.indexOf('id')
  const idxFMin = header.indexOf('fmin')
  const idxMinAccr = header.indexOf('minaccr')
  const idxValShift = header.indexOf('valshift')
  const idxOp = header.indexOf('op')
  const idxOpParam = header.indexOf('op param')
  const idxOpBase = header.indexOf('op base')
  const idxOpStat1 = header.indexOf('op stat1')
  const idxOpStat2 = header.indexOf('op stat2')
  const idxOpStat3 = header.indexOf('op stat3')
  const idxDirect = header.indexOf('direct')
  const idxMaxStat = header.indexOf('maxstat')
  const idxDamageRelated = header.indexOf('damagerelated')

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const cols = line.split('\t')
    const stat = (cols[idxStat] ?? '').trim().toLowerCase()
    const idStr = (cols[idxId] ?? '').trim()
    if (!stat || !idStr) continue
    const id = Number(idStr)
    if (!Number.isInteger(id) || id < 0) continue

    const valShift = Number((cols[idxValShift] ?? '').trim() || '0') || 0
    const bMin = ((cols[idxFMin] ?? '').trim() || '0') !== '0' && (cols[idxFMin] ?? '').trim() !== ''
    const minAccr = Number((cols[idxMinAccr] ?? '').trim() || '0') || 0
    const op = Number((cols[idxOp] ?? '').trim() || '0') || 0
    const opParam = Number((cols[idxOpParam] ?? '').trim() || '0') || 0
    const opBase = (cols[idxOpBase] ?? '').trim().toLowerCase()
    const opStat1 = (cols[idxOpStat1] ?? '').trim().toLowerCase()
    const opStat2 = (cols[idxOpStat2] ?? '').trim().toLowerCase()
    const opStat3 = (cols[idxOpStat3] ?? '').trim().toLowerCase()
    const opStats = [opStat1, opStat2, opStat3].filter(Boolean)
    const direct = ((cols[idxDirect] ?? '').trim() || '0') !== '0' && (cols[idxDirect] ?? '').trim() !== ''
    const maxStat = (cols[idxMaxStat] ?? '').trim().toLowerCase()
    const damageRelated =
      ((cols[idxDamageRelated] ?? '').trim() || '0') !== '0' && (cols[idxDamageRelated] ?? '').trim() !== ''

    const def: CanonicalItemStatCostDef = {
      id,
      stat,
      valShift,
      bMin,
      minAccr,
      op,
      opParam,
      opBase,
      opStats,
      direct,
      maxStat,
      damageRelated,
    }
    byId.set(id, def)
    byName.set(stat, def)

    if (op >= 1 && op <= 13 && opStats.length > 0) {
      for (const targetStat of opStats) {
        let list = opRulesByTarget.get(targetStat)
        if (!list) {
          list = []
          opRulesByTarget.set(targetStat, list)
        }
        list.push({
          sourceStatId: id,
          sourceStat: stat,
          op,
          opParam,
          opBase,
          targetStat,
        })
      }
    }
  }

  return { byId, byName, opRulesByTarget }
})()

export const CANONICAL_ITEM_STAT_COST_BY_ID: ReadonlyMap<number, CanonicalItemStatCostDef> =
  PARSED_ITEM_STAT_COST.byId
export const CANONICAL_ITEM_STAT_COST_BY_NAME: ReadonlyMap<string, CanonicalItemStatCostDef> =
  PARSED_ITEM_STAT_COST.byName
export const OP_RULES_BY_TARGET: ReadonlyMap<string, readonly ItemStatCostOpRule[]> =
  PARSED_ITEM_STAT_COST.opRulesByTarget

/**
 * Canonical 1.13c `CharStats.txt` per-vitality / per-energy scaling factors (in quarter-points;
 * `D2Common.dll` `0x6FD89947` / `0x6FD899C3` shifts `(diff * factor) << 6` to produce 256-fixed-point).
 */
export const CHAR_STATS_SCALING_113C: Readonly<
  Record<
    string,
    {
      readonly lifePerVitality: number
      readonly staminaPerVitality: number
      readonly manaPerMagic: number
      readonly toHitFactor: number
    }
  >
> = {
  ama: { lifePerVitality: 12, staminaPerVitality: 4, manaPerMagic: 6, toHitFactor: 5 },
  sor: { lifePerVitality: 8, staminaPerVitality: 4, manaPerMagic: 8, toHitFactor: -15 },
  nec: { lifePerVitality: 8, staminaPerVitality: 4, manaPerMagic: 8, toHitFactor: -10 },
  pal: { lifePerVitality: 12, staminaPerVitality: 4, manaPerMagic: 6, toHitFactor: 20 },
  bar: { lifePerVitality: 16, staminaPerVitality: 4, manaPerMagic: 4, toHitFactor: 20 },
  dru: { lifePerVitality: 8, staminaPerVitality: 4, manaPerMagic: 8, toHitFactor: 5 },
  ass: { lifePerVitality: 12, staminaPerVitality: 5, manaPerMagic: 7, toHitFactor: 15 },
}

/**
 * Pack a 1.13c `bytime` (`op = 6` / `op = 7`, `Encode = 4`) 22-bit parameter:
 * - bits `0..1`: `period` (`0` = Day, `1` = Dusk, `2` = Night, `3` = Dawn)
 * - bits `2..11`: biased `min` (`min + 0x100`, 10-bit unsigned)
 * - bits `12..21`: biased `max` (`max + 0x100`, 10-bit unsigned)
 */
export function encodeByTimeStat113c(period: number, min: number, max: number): number {
  const p = period & 0x3
  const minBiased = (Math.trunc(min) + 0x100) & 0x3ff
  const maxBiased = (Math.trunc(max) + 0x100) & 0x3ff
  return p | (minBiased << 2) | (maxBiased << 12)
}

/**
 * 1.13c `D2Common.dll` `0x6FD96330` (`ITEMS_EvaluateByTime` / `D2Common_10953`):
 * Unpacks a 22-bit `bytime` stat value and interpolates across the 4 periods of day
 * (`0` = Day, `1` = Dusk, `2` = Night, `3` = Dawn; each period is `1200` ticks).
 */
export function evaluateByTime113c(
  rawPacked: number,
  periodOfDay: number = 0,
  timeInPeriod: number = 0,
): number {
  const raw = Math.trunc(rawPacked)
  if (raw === 0) return 0
  const targetPeriod = raw & 0x3
  const minVal = ((raw >> 2) & 0x3ff) - 0x100
  const maxVal = ((raw >> 12) & 0x3ff) - 0x100
  const curPeriod = ((Math.trunc(periodOfDay) % 4) + 4) % 4
  if (curPeriod === targetPeriod) {
    return maxVal
  }
  const oppositePeriod = (targetPeriod + 2) & 0x3
  if (curPeriod === oppositePeriod) {
    return minVal
  }
  const clampedTime = Math.max(0, Math.min(1200, Math.trunc(timeInPeriod)))
  const nextPeriod = (curPeriod + 1) & 0x3
  const fraction = nextPeriod === targetPeriod ? clampedTime : 1200 - clampedTime
  return minVal + Math.trunc(((maxVal - minVal) * fraction) / 1200)
}

export const HIT_SHIFT = 8
export const FIXED_ONE = 1 << HIT_SHIFT // 256

export interface SkillStatModifier {
  readonly id: string
  readonly stateName: string
  readonly stateId: number
  readonly sourceUnitId: string
  readonly sourceSkillId: number
  readonly slvl: number
  /** Frame (`tick`) at which this modifier expires (`0` = permanent/passive/toggle). */
  expireFrame: number
  readonly isAura?: boolean
  readonly isCurse?: boolean
  readonly curseType?: number
  readonly stats: Readonly<Record<string, number>>
}

interface PassiveSkillTableRow {
  readonly id: number
  readonly name: string
  readonly passiveState: string
  readonly stateId: number
  readonly passiveItype?: string
  readonly blvlOnly?: boolean
  readonly passiveStat1: string
  readonly passiveCalc1: string
  readonly passiveStat2?: string
  readonly passiveCalc2?: string
  readonly passiveStat3?: string
  readonly passiveCalc3?: string
  readonly passiveStat4?: string
  readonly passiveCalc4?: string
  readonly passiveStat5?: string
  readonly passiveCalc5?: string
  readonly param1?: number
  readonly param2?: number
  readonly param3?: number
  readonly param4?: number
  readonly param5?: number
  readonly param6?: number
  readonly param7?: number
  readonly param8?: number
}

/**
 * Canonical 1.13c `Skills.txt` rows with `passivestate != ''` (`D2Game.dll` `0x6FCBA1A0` `SKILLS_RefreshPassiveSkills`).
 * Used directly when `UnitStatList` is instantiated without `D2DataRegistry`, or cross-referenced with `registry.getSkillById(id)`.
 */
const PASSIVE_SKILL_TABLE_113C: readonly PassiveSkillTableRow[] = [
  { id: 9, name: 'Critical Strike', passiveState: 'criticalstrike', stateId: 64, passiveStat1: 'passive_critical_strike', passiveCalc1: 'dm12', param1: 5, param2: 80 },
  { id: 13, name: 'Dodge', passiveState: 'dodge', stateId: 65, passiveStat1: 'passive_dodge', passiveCalc1: 'dm12', param1: 10, param2: 65 },
  { id: 18, name: 'Avoid', passiveState: 'avoid', stateId: 66, passiveStat1: 'passive_avoid', passiveCalc1: 'dm12', param1: 15, param2: 75 },
  { id: 23, name: 'Penetrate', passiveState: 'penetrate', stateId: 67, passiveStat1: 'item_tohit_percent', passiveCalc1: 'ln12', param1: 35, param2: 10 },
  { id: 29, name: 'Evade', passiveState: 'evade', stateId: 68, passiveStat1: 'passive_evade', passiveCalc1: 'dm12', param1: 10, param2: 65 },
  { id: 33, name: 'Pierce', passiveState: 'pierce', stateId: 69, passiveStat1: 'skill_pierce', passiveCalc1: 'dm12', param1: 10, param2: 100 },
  { id: 37, name: 'Warmth', passiveState: 'warmth', stateId: 70, passiveStat1: 'manarecoverybonus', passiveCalc1: 'ln12', param1: 30, param2: 12 },
  { id: 61, name: 'Fire Mastery', passiveState: 'firemastery', stateId: 71, passiveStat1: 'passive_fire_mastery', passiveCalc1: 'ln12', param1: 30, param2: 7 },
  { id: 63, name: 'Lightning Mastery', passiveState: 'lightningmastery', stateId: 72, passiveStat1: 'passive_ltng_mastery', passiveCalc1: 'ln12', param1: 50, param2: 12 },
  { id: 65, name: 'Cold Mastery', passiveState: 'coldmastery', stateId: 73, passiveStat1: 'passive_cold_pierce', passiveCalc1: 'ln12', param1: 20, param2: 5 },
  { id: 69, name: 'Skeleton Mastery', passiveState: 'skel_mastery', stateId: 97, passiveStat1: '', passiveCalc1: '' },
  { id: 79, name: 'Golem Mastery', passiveState: 'golem_mastery', stateId: 111, passiveStat1: '', passiveCalc1: '' },
  { id: 89, name: 'Summon Resist', passiveState: 'summonresist', stateId: 160, passiveStat1: 'passive_summon_resist', passiveCalc1: 'dm12', param1: 20, param2: 75 },
  { id: 100, name: 'Resist Fire', passiveState: 'passive_resistfire', stateId: 181, blvlOnly: true, passiveStat1: 'maxfireresist', passiveCalc1: "skill('Resist Fire'.blvl)/2" },
  { id: 105, name: 'Resist Cold', passiveState: 'passive_resistcold', stateId: 182, blvlOnly: true, passiveStat1: 'maxcoldresist', passiveCalc1: "skill('Resist Cold'.blvl)/2" },
  { id: 108, name: 'Blessed Aim', passiveState: 'penetrate', stateId: 67, blvlOnly: true, passiveStat1: 'item_tohit_percent', passiveCalc1: "skill('Blessed Aim'.blvl) * par8", param8: 5 },
  { id: 110, name: 'Resist Lightning', passiveState: 'passive_resistltng', stateId: 183, blvlOnly: true, passiveStat1: 'maxlightresist', passiveCalc1: "skill('Resist Lightning'.blvl)/2" },
  {
    id: 127,
    name: 'Sword Mastery',
    passiveState: 'swordmastery',
    stateId: 74,
    passiveItype: 'swor',
    passiveStat1: 'passive_mastery_melee_th',
    passiveCalc1: 'ln12',
    passiveStat2: 'passive_mastery_melee_dmg',
    passiveCalc2: 'ln34',
    passiveStat3: 'passive_mastery_melee_crit',
    passiveCalc3: 'dm56',
    param1: 28,
    param2: 8,
    param3: 28,
    param4: 5,
    param5: 0,
    param6: 35,
  },
  {
    id: 128,
    name: 'Axe Mastery',
    passiveState: 'axemastery',
    stateId: 75,
    passiveItype: 'axe',
    passiveStat1: 'passive_mastery_melee_th',
    passiveCalc1: 'ln12',
    passiveStat2: 'passive_mastery_melee_dmg',
    passiveCalc2: 'ln34',
    passiveStat3: 'passive_mastery_melee_crit',
    passiveCalc3: 'dm56',
    param1: 28,
    param2: 8,
    param3: 28,
    param4: 5,
    param5: 0,
    param6: 35,
  },
  {
    id: 129,
    name: 'Mace Mastery',
    passiveState: 'macemastery',
    stateId: 76,
    passiveItype: 'blun',
    passiveStat1: 'passive_mastery_melee_th',
    passiveCalc1: 'ln12',
    passiveStat2: 'passive_mastery_melee_dmg',
    passiveCalc2: 'ln34',
    passiveStat3: 'passive_mastery_melee_crit',
    passiveCalc3: 'dm56',
    param1: 28,
    param2: 8,
    param3: 28,
    param4: 5,
    param5: 0,
    param6: 35,
  },
  {
    id: 134,
    name: 'Pole Arm Mastery',
    passiveState: 'polearmmastery',
    stateId: 77,
    passiveItype: 'pole',
    passiveStat1: 'passive_mastery_melee_th',
    passiveCalc1: 'ln12',
    passiveStat2: 'passive_mastery_melee_dmg',
    passiveCalc2: 'ln34',
    passiveStat3: 'passive_mastery_melee_crit',
    passiveCalc3: 'dm56',
    param1: 30,
    param2: 8,
    param3: 28,
    param4: 5,
    param5: 0,
    param6: 35,
  },
  {
    id: 135,
    name: 'Throwing Mastery',
    passiveState: 'throwingmastery',
    stateId: 78,
    passiveItype: 'thro',
    passiveStat1: 'passive_mastery_throw_th',
    passiveCalc1: 'ln12',
    passiveStat2: 'passive_mastery_throw_dmg',
    passiveCalc2: 'ln34',
    passiveStat3: 'passive_mastery_throw_crit',
    passiveCalc3: 'dm56',
    param1: 30,
    param2: 8,
    param3: 28,
    param4: 5,
    param5: 0,
    param6: 35,
  },
  {
    id: 136,
    name: 'Spear Mastery',
    passiveState: 'spearmastery',
    stateId: 79,
    passiveItype: 'spea',
    passiveStat1: 'passive_mastery_melee_th',
    passiveCalc1: 'ln12',
    passiveStat2: 'passive_mastery_melee_dmg',
    passiveCalc2: 'ln34',
    passiveStat3: 'passive_mastery_melee_crit',
    passiveCalc3: 'dm56',
    param1: 30,
    param2: 8,
    param3: 28,
    param4: 5,
    param5: 0,
    param6: 35,
  },
  { id: 141, name: 'Increased Stamina', passiveState: 'increasedstamina', stateId: 80, passiveStat1: 'skill_passive_staminapercent', passiveCalc1: 'ln12', param1: 30, param2: 15 },
  { id: 145, name: 'Iron Skin', passiveState: 'ironskin', stateId: 81, passiveStat1: 'skill_armor_percent', passiveCalc1: 'ln12', param1: 30, param2: 10 },
  { id: 148, name: 'Increased Speed', passiveState: 'increasedspeed', stateId: 82, passiveStat1: 'velocitypercent', passiveCalc1: 'dm12', param1: 7, param2: 50 },
  {
    id: 153,
    name: 'Natural Resistance',
    passiveState: 'naturalresistance',
    stateId: 83,
    passiveStat1: 'fireresist',
    passiveCalc1: 'dm12',
    passiveStat2: 'lightresist',
    passiveCalc2: 'dm12',
    passiveStat3: 'coldresist',
    passiveCalc3: 'dm12',
    // 1.13c `Skills.txt` row 153 `passivestat4 = poisonresist` (`dm12`, `0..80`, #1803).
    passiveStat4: 'poisonresist',
    passiveCalc4: 'dm12',
    param1: 0,
    param2: 80,
  },
  {
    id: 252,
    name: 'Claw Mastery',
    passiveState: 'clawmastery',
    stateId: 152,
    passiveItype: 'h2h',
    passiveStat1: 'passive_mastery_melee_th',
    passiveCalc1: 'ln12',
    passiveStat2: 'passive_mastery_melee_dmg',
    passiveCalc2: 'ln34',
    passiveStat3: 'passive_mastery_melee_crit',
    passiveCalc3: 'dm56',
    param1: 30,
    param2: 10,
    param3: 35,
    param4: 4,
    param5: 0,
    param6: 25,
  },
  { id: 263, name: 'Weapon Block', passiveState: 'weaponblock', stateId: 155, passiveItype: 'h2h', passiveStat1: 'passive_weaponblock', passiveCalc1: 'dm12', param1: 20, param2: 65 },
]

const MELEE_MASTERY_SKILL_IDS = new Set([127, 128, 129, 134, 136, 252])

/**
 * Stats whose `op = 13` modifies only the item's own base stat (`D2Common.dll` `0x6FD89A87`)
 * and therefore do not propagate directly from an attached item `UnitStatList` to its wearer.
 */
const ITEM_LOCAL_OP13_SOURCE_STATS = new Set<string>([
  'item_armor_percent',
  'item_maxdamage_percent',
  'item_mindamage_percent',
  'item_maxdurability_percent',
  'item_levelreqpct',
])

function toFallbackSkillRecord(row: PassiveSkillTableRow): SkillRecord {
  return {
    id: row.id,
    name: row.name,
    passiveState: row.passiveState,
    passiveItype: row.passiveItype ?? '',
    passiveStat1: row.passiveStat1,
    passiveCalc1: row.passiveCalc1,
    passiveStat2: row.passiveStat2 ?? '',
    passiveCalc2: row.passiveCalc2 ?? '',
    passiveStat3: row.passiveStat3 ?? '',
    passiveCalc3: row.passiveCalc3 ?? '',
    passiveStat4: row.passiveStat4 ?? '',
    passiveCalc4: row.passiveCalc4 ?? '',
    passiveStat5: row.passiveStat5 ?? '',
    passiveCalc5: row.passiveCalc5 ?? '',
    param1: row.param1 ?? 0,
    param2: row.param2 ?? 0,
    param3: row.param3 ?? 0,
    param4: row.param4 ?? 0,
    param5: row.param5 ?? 0,
    param6: row.param6 ?? 0,
    param7: row.param7 ?? 0,
    param8: row.param8 ?? 0,
  } as unknown as SkillRecord
}

const FALLBACK_PASSIVE_RECORDS_BY_ID = new Map<number, SkillRecord>(
  PASSIVE_SKILL_TABLE_113C.map(r => [r.id, toFallbackSkillRecord(r)]),
)
const FALLBACK_PASSIVE_RECORDS_BY_NAME = new Map<string, SkillRecord>(
  PASSIVE_SKILL_TABLE_113C.map(r => [r.name.toLowerCase(), toFallbackSkillRecord(r)]),
)
const FALLBACK_REGISTRY = {
  getSkillById: (id: number) => FALLBACK_PASSIVE_RECORDS_BY_ID.get(id),
  getSkillByName: (name: string) => FALLBACK_PASSIVE_RECORDS_BY_NAME.get(name.trim().toLowerCase()),
} as unknown as D2DataRegistry

export class UnitStatList {
  readonly registry: D2DataRegistry | undefined
  private ownerType: UnitStatListOwnerType
  private charClass: string
  private periodOfDay: number
  private timeInPeriod: number
  private parentStatList: UnitStatList | undefined
  private readonly attachedStatLists: UnitStatList[] = []
  private readonly baseStats = new Map<string, number>()
  private readonly baseSkillLevels = new Map<number, number>()
  private readonly bonusSkillLevels = new Map<number, number>()
  private readonly chargedSkillLevels = new Map<number, number>()
  private readonly elemSkillBonuses = new Map<string, number>()
  private allSkillsBonus = 0
  private classSkillsBonus = 0
  private readonly modifiers: SkillStatModifier[] = []

  constructor(
    registry?: D2DataRegistry,
    initialStats?: Readonly<Record<string, number>>,
    options?: UnitStatListOptions,
  ) {
    this.registry = registry
    this.ownerType = options?.ownerType ?? 'player'
    this.charClass = (options?.charClass ?? 'ama').trim().toLowerCase()
    this.periodOfDay = options?.periodOfDay ?? 0
    this.timeInPeriod = options?.timeInPeriod ?? 0
    // 1.13c D2Common_11013 (STATLIST_AllocStatList, 0x6FD88100) /
    // D2Common_11166 (STATLIST_AllocStatListEx, 0x6FD8AF00):
    // Newly allocated stat lists zero-initialize all fields (wStatCount = 0);
    // D2Common_10973 (STATLIST_UnitGetStatValue, 0x6FD88B70) returns 0 for any unset stat.
    if (initialStats) {
      for (const [k, v] of Object.entries(initialStats)) {
        this.setBaseStat(k, v)
      }
    }
  }

  getOwnerType(): UnitStatListOwnerType {
    return this.ownerType
  }

  setOwnerType(ownerType: UnitStatListOwnerType): void {
    this.ownerType = ownerType
  }

  getCharClass(): string {
    return this.charClass
  }

  setCharClass(charClass: string): void {
    this.charClass = charClass.trim().toLowerCase()
  }

  setEnvironmentTime(periodOfDay: number, timeInPeriod: number = 0): void {
    this.periodOfDay = ((Math.trunc(periodOfDay) % 4) + 4) % 4
    this.timeInPeriod = Math.max(0, Math.min(1200, Math.trunc(timeInPeriod)))
  }

  /**
   * Attach a child statlist (e.g., an equipped item's `UnitStatList` with `ownerType = 'item'`)
   * into `D2StatListExStrc.pMyLastList`.
   */
  attachStatList(child: UnitStatList): void {
    if (child === this) return
    if (!this.attachedStatLists.includes(child)) {
      child.parentStatList = this
      this.attachedStatLists.push(child)
    }
  }

  detachStatList(child: UnitStatList): boolean {
    const idx = this.attachedStatLists.indexOf(child)
    if (idx === -1) return false
    child.parentStatList = undefined
    this.attachedStatLists.splice(idx, 1)
    return true
  }

  getAttachedStatLists(): readonly UnitStatList[] {
    return this.attachedStatLists
  }

  private normalizeStatKey(statNameOrId: string | number): string {
    if (typeof statNameOrId === 'number') {
      if (!Number.isInteger(statNameOrId) || statNameOrId < 0) {
        throw new Error(`UnitStatList: invalid ItemStatCost statId ${statNameOrId}`)
      }
      const rec = this.registry?.getStatById(statNameOrId)
      if (rec) return rec.stat.toLowerCase()
      const canonical = CANONICAL_ITEM_STAT_COST_BY_ID.get(statNameOrId)
      if (canonical !== undefined) return canonical.stat
      throw new Error(`UnitStatList: unknown ItemStatCost statId ${statNameOrId}`)
    }
    const key = statNameOrId.trim().toLowerCase()
    if (CANONICAL_ITEM_STAT_COST_BY_NAME.has(key) || this.registry?.getStatByName(key)) {
      return key
    }
    throw new Error(`UnitStatList: unknown ItemStatCost stat '${statNameOrId}'`)
  }

  setBaseStat(statNameOrId: string | number, value: number): void {
    const key = this.normalizeStatKey(statNameOrId)
    const truncVal = Math.trunc(value)
    if (key === 'item_allskills') {
      const prev = this.baseStats.get(key) ?? 0
      this.allSkillsBonus += truncVal - prev
    }
    // D2Common.dll STATLIST_SetStat (0x6FD8A280..0x6FD8A324):
    // BaseStats stores only non-zero entries; setting 0 never inserts an entry and removes
    // any existing entry so 0-HP town NPCs do not trigger ItemStatCost minAccr = 1 on maxhp.
    if (truncVal === 0) {
      this.baseStats.delete(key)
    } else {
      this.baseStats.set(key, truncVal)
    }
    if (key === 'item_allskills') {
      this.syncPassiveSkillModifiers()
    }
  }

  addStat(statNameOrId: string | number, delta: number): void {
    const key = this.normalizeStatKey(statNameOrId)
    const truncDelta = Math.trunc(delta)
    if (key === 'item_allskills') {
      this.allSkillsBonus += truncDelta
    }
    const next = (this.baseStats.get(key) ?? 0) + truncDelta
    if (next === 0) {
      this.baseStats.delete(key)
    } else {
      this.baseStats.set(key, next)
    }
    if (key === 'item_allskills') {
      this.syncPassiveSkillModifiers()
    }
  }

  getBaseStat(statNameOrId: string | number): number {
    const key = this.normalizeStatKey(statNameOrId)
    return this.baseStats.get(key) ?? 0
  }

  /**
   * Set hard-invested `STAT_SKILLPTS` (`blvl`) for a skill.
   */
  setBaseSkillLevel(skillId: number, blvl: number): void {
    this.baseSkillLevels.set(skillId, Math.max(0, Math.trunc(blvl)))
    this.syncPassiveSkillModifiers()
  }

  /**
   * 1.13c Ground Truth (`D2Common`): returns strictly hard-allocated `STAT_SKILLPTS` (`blvl`).
   * Never includes `bonusSkillLevels`, `allSkillsBonus`, or `chargedSkillLevels` (`Marrowwalk` fix).
   */
  getBaseSkillLevel(skillId: number): number {
    return Math.min(99, Math.max(0, this.baseSkillLevels.get(skillId) ?? 0))
  }

  /** Per-skill bonus levels (`+single skill` / `oskill` / sync offsets) excluding hard points. */
  getBonusSkillLevel(skillId: number): number {
    return this.bonusSkillLevels.get(skillId) ?? 0
  }

  setBonusSkillLevel(skillId: number, bonus: number): void {
    this.bonusSkillLevels.set(skillId, Math.trunc(bonus))
    this.syncPassiveSkillModifiers()
  }

  /**
   * Replaces the whole hard-point (`blvl`) and per-skill bonus tables in one pass and refreshes the
   * passive statlists once (`SKILLS_RefreshPassiveSkills` `0x6FCBA1A0`), so unlearned / unequipped
   * skills drop their passive modifiers (#1798).
   */
  replaceSkillLevels(
    baseLevels: ReadonlyMap<number, number>,
    bonusLevels: ReadonlyMap<number, number>,
  ): void {
    this.baseSkillLevels.clear()
    for (const [id, lvl] of baseLevels) this.baseSkillLevels.set(id, Math.max(0, Math.trunc(lvl)))
    this.bonusSkillLevels.clear()
    for (const [id, lvl] of bonusLevels) {
      if (Math.trunc(lvl) !== 0) this.bonusSkillLevels.set(id, Math.trunc(lvl))
    }
    this.syncPassiveSkillModifiers()
  }

  setAllSkillsBonus(bonus: number): void {
    this.allSkillsBonus = Math.trunc(bonus)
    this.syncPassiveSkillModifiers()
  }

  setClassSkillsBonus(bonus: number): void {
    this.classSkillsBonus = Math.trunc(bonus)
    this.syncPassiveSkillModifiers()
  }

  /**
   * 1.13c `D2Common.dll` `0x6FD9FCB0` (`0x6FD9FD85..0x6FD9FDA0`):
   * Set `+N to <Element> Skills` (`stat 126 item_elemskill`, `param`: 1=fire, 2=ltng, 3=mag, 4=cold, 5=pois).
   */
  setElemSkillsBonus(eTypeOrParam: string | number, bonus: number): void {
    const key =
      typeof eTypeOrParam === 'number'
        ? (ELEM_TYPE_BY_PARAM_113C[eTypeOrParam] ?? '')
        : eTypeOrParam.trim().toLowerCase()
    if (!key) return
    this.elemSkillBonuses.set(key, Math.trunc(bonus))
    this.syncPassiveSkillModifiers()
  }

  getElemSkillsBonus(eTypeOrParam: string | number): number {
    const key =
      typeof eTypeOrParam === 'number'
        ? (ELEM_TYPE_BY_PARAM_113C[eTypeOrParam] ?? '')
        : eTypeOrParam.trim().toLowerCase()
    if (!key) return 0
    return this.elemSkillBonuses.get(key) ?? 0
  }

  /**
   * Set item skill charges (`STAT_ITEM_CHARGED_SKILL`, e.g. Level 33 Bone Prison on Marrowwalk boots).
   * Stored in `chargedSkillLevels` and strictly excluded from `getBaseSkillLevel(skillId)` in 1.13c!
   */
  setChargedSkillLevel(skillId: number, chargeSlvl: number): void {
    this.chargedSkillLevels.set(skillId, Math.max(0, Math.trunc(chargeSlvl)))
  }

  getChargedSkillLevel(skillId: number): number {
    return this.chargedSkillLevels.get(skillId) ?? 0
  }

  /**
   * Effective skill level (`lvl = clamp(blvl + bonusSkill + allSkills + classSkills + elemSkills + modAllSkills, 0, 99)`).
   * Matches `D2Common.dll` `SKILLS_GetSkillLevel` (`0x6FDA05D0`) & `0x6FD9FCB0` (#1679, #1688).
   */
  getEffectiveSkillLevel(skillId: number): number {
    const base = this.getBaseSkillLevel(skillId)
    const singleBonus = this.bonusSkillLevels.get(skillId) ?? 0
    let attachedAllSkills = 0
    for (const child of this.attachedStatLists) {
      attachedAllSkills += child.getAccruedStat('item_allskills')
    }
    const modAllSkills = this.getModifierBonus('item_allskills') + attachedAllSkills
    const skillRec =
      (this.registry ?? FALLBACK_REGISTRY).getSkillById?.(skillId) ?? SKILLS_BY_ID[skillId]
    const eType = (skillRec?.eType ?? '').trim().toLowerCase()
    let elemBonus = 0
    if (eType !== '') {
      elemBonus += this.getElemSkillsBonus(eType)
      for (const child of this.attachedStatLists) {
        elemBonus += child.getElemSkillsBonus(eType)
        if (eType === 'fire') {
          elemBonus += child.getAccruedStat('item_elemskill')
        }
      }
      if (eType === 'fire') {
        elemBonus += (this.baseStats.get('item_elemskill') ?? 0) + this.getModifierBonus('item_elemskill')
      }
    }
    const total =
      base + singleBonus + this.allSkillsBonus + this.classSkillsBonus + modAllSkills + elemBonus
    return Math.min(99, Math.max(0, total))
  }

  /**
   * 1.13c `SKILLS_RefreshPassiveSkills` (`D2Game.dll` `0x6FCBA1A0..0x6FCBA325`):
   * Evaluates `passivestat1..5` / `passivecalc1..5` for all active passive skills on the unit
   * and attaches/updates a `SkillStatModifier` with `stateName = passivestate`.
   */
  private syncPassiveSkillModifiers(): void {
    const reg = this.registry ?? FALLBACK_REGISTRY
    const hasExternalActiveAura = (auraState: string, auraSkillId: number, autoId: string): boolean =>
      this.modifiers.some(
        m =>
          m.id !== autoId &&
          (m.stateName.toLowerCase() === auraState || m.sourceSkillId === auraSkillId),
      )

    for (const def of PASSIVE_SKILL_TABLE_113C) {
      const autoId = `passive_skill_${def.id}`
      const blvl = this.getBaseSkillLevel(def.id)
      const singleBonus = this.bonusSkillLevels.get(def.id) ?? 0
      const isLearnedOrGranted = def.blvlOnly ? blvl > 0 : blvl > 0 || singleBonus > 0

      // 1.13c `D2Game.dll` `0x6FCBA2EA..0x6FCBA308`:
      // Active Resist Fire / Resist Cold / Resist Lightning / Blessed Aim aura suppresses the passive statlist.
      const suppressedByActiveAura =
        (def.id === 100 && hasExternalActiveAura('resistfire', 100, autoId)) ||
        (def.id === 105 && hasExternalActiveAura('resistcold', 105, autoId)) ||
        (def.id === 108 && hasExternalActiveAura('blessedaim', 108, autoId)) ||
        (def.id === 110 && hasExternalActiveAura('resistlight', 110, autoId))

      const effLvl = isLearnedOrGranted ? this.getEffectiveSkillLevel(def.id) : 0
      const existingAutoIdx = this.modifiers.findIndex(m => m.id === autoId)

      if (!isLearnedOrGranted || effLvl <= 0 || suppressedByActiveAura) {
        if (existingAutoIdx !== -1) {
          this.modifiers.splice(existingAutoIdx, 1)
        }
        continue
      }

      // If an external modifier was explicitly applied for this exact skill ID (`executeSkill113c`),
      // keep the external modifier instead of duplicating it.
      const hasExternalForSameSkill = this.modifiers.some(
        m => m.id !== autoId && m.sourceSkillId === def.id && Object.keys(m.stats).length > 0,
      )
      if (hasExternalForSameSkill) {
        if (existingAutoIdx !== -1) {
          this.modifiers.splice(existingAutoIdx, 1)
        }
        continue
      }

      const skillRec = this.registry?.getSkillById(def.id) ?? toFallbackSkillRecord(def)
      const calcCtx = {
        registry: reg,
        activeSkill: skillRec,
        slvl: effLvl,
        blvl,
        getBaseSkillLevel: (id: number) => this.getBaseSkillLevel(id),
        getEffectiveSkillLevel: (id: number) => this.getEffectiveSkillLevel(id),
      }

      const stats: Record<string, number> = {}
      const pairs: readonly [string, string][] = [
        [skillRec.passiveStat1 || def.passiveStat1, skillRec.passiveCalc1 || def.passiveCalc1],
        [skillRec.passiveStat2 || def.passiveStat2 || '', skillRec.passiveCalc2 || def.passiveCalc2 || ''],
        [skillRec.passiveStat3 || def.passiveStat3 || '', skillRec.passiveCalc3 || def.passiveCalc3 || ''],
        [skillRec.passiveStat4 || def.passiveStat4 || '', skillRec.passiveCalc4 || def.passiveCalc4 || ''],
        [skillRec.passiveStat5 || def.passiveStat5 || '', skillRec.passiveCalc5 || def.passiveCalc5 || ''],
      ]
      for (const [st, clc] of pairs) {
        if (!st || !clc) continue
        const normSt = this.normalizeStatKey(st)
        // Issues #1445/#1678: every dmXY (e.g. Weapon Block #263 dm12 20..65: slvl 1 = 26, slvl 20 = 57) goes through
        // the shared D2Common 0x6FD9DC30 port inside evaluateCalc (two-step integer division, capped at Param[Y]).
        const val = evaluateCalc(clc, calcCtx)
        if (val !== 0) {
          stats[normSt] = val
        }
      }

      const stateName = (skillRec.passiveState || def.passiveState).trim().toLowerCase()
      const stateId = this.registry?.getStateByName(stateName)?.id ?? def.stateId
      const mod: SkillStatModifier = {
        id: autoId,
        stateName,
        stateId,
        sourceUnitId: 'self',
        sourceSkillId: def.id,
        slvl: effLvl,
        expireFrame: 0,
        stats,
      }

      if (existingAutoIdx !== -1) {
        this.modifiers[existingAutoIdx] = mod
      } else {
        this.modifiers.push(mod)
      }
    }
  }

  /**
   * Sum dynamic modifier bonuses for a given stat.
   * For duplicate aura states (`isAura === true` with same `stateId`), only the highest `slvl`
   * active modifier contributes its stats (`1.13c` aura stacking/level override rule).
   */
  getModifierBonus(statNameOrId: string | number): number {
    const key = this.normalizeStatKey(statNameOrId)
    const readModStat = (mod: SkillStatModifier): number => mod.stats[key] ?? 0

    const isMeleeMasteryKey =
      key === 'passive_mastery_melee_th' ||
      key === 'passive_mastery_melee_dmg' ||
      key === 'passive_mastery_melee_crit'
    const isOffensivePoisonKey =
      key === 'poisonmindam' || key === 'poisonmaxdam' || key === 'poisonlength'

    const bestAuraByState = new Map<number, SkillStatModifier>()
    let sum = 0
    let bestAutoMeleeMastery = 0

    for (const mod of this.modifiers) {
      if (isOffensivePoisonKey && (mod.stateId === 2 || mod.stateName === 'poison')) {
        continue
      }
      if (mod.isAura && mod.stateId > 0) {
        const prev = bestAuraByState.get(mod.stateId)
        if (!prev || mod.slvl >= prev.slvl) {
          bestAuraByState.set(mod.stateId, mod)
        }
      } else if (
        isMeleeMasteryKey &&
        mod.id.startsWith('passive_skill_') &&
        MELEE_MASTERY_SKILL_IDS.has(mod.sourceSkillId)
      ) {
        bestAutoMeleeMastery = Math.max(bestAutoMeleeMastery, readModStat(mod))
      } else {
        sum += readModStat(mod)
      }
    }

    sum += bestAutoMeleeMastery

    for (const auraMod of bestAuraByState.values()) {
      sum += readModStat(auraMod)
    }

    return Math.trunc(sum)
  }

  /**
   * Sum attached child `UnitStatList` contributions (`D2StatListExStrc.pMyLastList`) for `key`.
   * For attached `'item'` statlists, `op = 13` local item percentage stats (`item_armor_percent`, etc.)
   * are applied to the item's own base stats (`armorclass`, `maxdamage`, `mindamage`, `maxdurability`, `item_levelreq`)
   * rather than leaking into the wearer's statlist.
   */
  private getAttachedStatBonus(key: string): number {
    if (this.attachedStatLists.length === 0) return 0
    let sum = 0
    for (const child of this.attachedStatLists) {
      if (child.ownerType === 'item' && ITEM_LOCAL_OP13_SOURCE_STATS.has(key)) {
        continue
      }
      if (child.ownerType === 'item' && OP_RULES_BY_TARGET.has(key)) {
        // Item's local op 4/5/6/7/13 (e.g. armorclass, maxdamage, mindamage, maxdurability, item_levelreq)
        sum += child.evalItemLocalStat(key)
      } else {
        sum += child.getBaseStat(key) + child.getModifierBonus(key) + child.getAttachedStatBonus(key)
      }
    }
    return Math.trunc(sum)
  }

  /**
   * Evaluate an item statlist's own stat with item-applicable `op` rules (`op 1, 4, 5, 6, 7, 13`).
   */
  private evalItemLocalStat(key: string): number {
    const base = this.getBaseStat(key)
    const modBonus = this.getModifierBonus(key)
    let acc = base + modBonus
    let prev = acc
    const rules = OP_RULES_BY_TARGET.get(key)
    if (rules) {
      for (const rule of rules) {
        acc = this.applyOpRule(rule, acc, prev, () => {
          prev = base
          return prev
        })
      }
    }
    return Math.trunc(acc)
  }

  private resolveOpBaseShifted(opBaseName: string): number {
    if (!opBaseName) return 0
    const baseOwner = this.ownerType === 'item' && this.parentStatList ? this.parentStatList : this
    const rawVal = baseOwner.getAccruedStat(opBaseName)
    const def = CANONICAL_ITEM_STAT_COST_BY_NAME.get(opBaseName)
    const shift = def?.valShift ?? 0
    return shift > 0 ? rawVal >> shift : rawVal
  }

  private resolveCharScaling(): {
    readonly lifePerVitality: number
    readonly staminaPerVitality: number
    readonly manaPerMagic: number
    readonly toHitFactor: number
  } {
    const rec = this.registry?.getCharStats(this.charClass as 'ama')
    if (rec) {
      return {
        lifePerVitality: rec.lifePerVitality,
        staminaPerVitality: rec.staminaPerVitality,
        manaPerMagic: rec.manaPerMagic,
        toHitFactor: rec.toHitFactor,
      }
    }
    return CHAR_STATS_SCALING_113C[this.charClass] ?? CHAR_STATS_SCALING_113C['ama']!
  }

  /**
   * 1.13c `D2Common.dll` `0x6FD89530` (`EvalStatWithOps`) single `op` rule evaluation (`op 1..13`, jump table `0x6FD89AF0`).
   */
  private applyOpRule(
    rule: ItemStatCostOpRule,
    acc: number,
    prev: number,
    useBaseAsPrev: () => number,
  ): number {
    const timeOwner = this.ownerType === 'item' && this.parentStatList ? this.parentStatList : this
    switch (rule.op) {
      case 1: {
        // 0x6FD895D0: op = 1 (skill_staminapercent 162, skill_passive_staminapercent 163 -> maxstamina)
        const baseForPct = this.ownerType === 'item' ? useBaseAsPrev() : prev
        if (baseForPct === 0) return acc
        const opVal = this.getAccruedStat(rule.sourceStat)
        if (opVal === 0) return acc
        return acc + Math.trunc((baseForPct * opVal) / 100)
      }
      case 2: {
        // 0x6FD8960D: op = 2 (perlevel flat on player/monster: (opVal * (opBase >> valShift)) >> opParam)
        if (this.ownerType !== 'player' && this.ownerType !== 'monster') return acc
        const opVal = this.getAccruedStat(rule.sourceStat)
        if (opVal === 0) return acc
        const shiftedBase = this.resolveOpBaseShifted(rule.opBase)
        if (shiftedBase === 0) return acc
        return acc + ((opVal * shiftedBase) >> rule.opParam)
      }
      case 3: {
        // 0x6FD896AA: op = 3 (perlevel percent on player/monster)
        if (this.ownerType !== 'player' && this.ownerType !== 'monster') return acc
        if (prev === 0) return acc
        const opVal = this.getAccruedStat(rule.sourceStat)
        if (opVal === 0) return acc
        const shiftedBase = this.resolveOpBaseShifted(rule.opBase)
        if (shiftedBase === 0) return acc
        const pct = (opVal * shiftedBase) >> rule.opParam
        if (pct === 0) return acc
        return acc + Math.trunc((prev * pct) / 100)
      }
      case 4: {
        // 0x6FD8974B: op = 4 (item_armor_perlevel 214, item_maxdamage_perlevel 218 -> evaluated on item or wearer)
        const opVal =
          this.ownerType === 'item'
            ? this.getBaseStat(rule.sourceStat) + this.getModifierBonus(rule.sourceStat)
            : this.getBaseStat(rule.sourceStat) + this.getModifierBonus(rule.sourceStat)
        if (opVal === 0) return acc
        const shiftedBase = this.resolveOpBaseShifted(rule.opBase)
        if (shiftedBase === 0) return acc
        return acc + ((opVal * shiftedBase) >> rule.opParam)
      }
      case 5: {
        // 0x6FD897DD: op = 5 (item_armorpercent_perlevel 215, item_maxdamage_percent_perlevel 219)
        if (prev === 0) return acc
        const opVal =
          this.ownerType === 'item'
            ? this.getBaseStat(rule.sourceStat) + this.getModifierBonus(rule.sourceStat)
            : this.getBaseStat(rule.sourceStat) + this.getModifierBonus(rule.sourceStat)
        if (opVal === 0) return acc
        const shiftedBase = this.resolveOpBaseShifted(rule.opBase)
        if (shiftedBase === 0) return acc
        const pct = (opVal * shiftedBase) >> rule.opParam
        if (pct === 0) return acc
        return acc + Math.trunc((prev * pct) / 100)
      }
      case 6: {
        // 0x6FD89873: op = 6 (*_bytime flat)
        const rawByTime =
          this.ownerType === 'item'
            ? this.getBaseStat(rule.sourceStat) + this.getModifierBonus(rule.sourceStat)
            : this.getAccruedStat(rule.sourceStat)
        if (rawByTime === 0) return acc
        return acc + evaluateByTime113c(rawByTime, timeOwner.periodOfDay, timeOwner.timeInPeriod)
      }
      case 7: {
        // 0x6FD898D2: op = 7 (item_armorpercent_bytime 269, item_maxdamage_percent_bytime 273)
        if (prev === 0) return acc
        const rawByTime =
          this.ownerType === 'item'
            ? this.getBaseStat(rule.sourceStat) + this.getModifierBonus(rule.sourceStat)
            : this.getAccruedStat(rule.sourceStat)
        if (rawByTime === 0) return acc
        const pct = evaluateByTime113c(rawByTime, timeOwner.periodOfDay, timeOwner.timeInPeriod)
        if (pct === 0) return acc
        return acc + Math.trunc((prev * pct) / 100)
      }
      case 8: {
        // 0x6FD89947: op = 8 (energy 1 -> maxmana on player: ((FullStats[energy] - BaseStats[energy]) * ManaPerMagic) << 6)
        if (this.ownerType !== 'player') return acc
        const diff = this.getAccruedStat(rule.sourceStat) - this.getBaseStat(rule.sourceStat)
        if (diff === 0) return acc
        const { manaPerMagic } = this.resolveCharScaling()
        return acc + ((diff * manaPerMagic) << 6)
      }
      case 9: {
        // 0x6FD899C3: op = 9 (vitality 3 -> maxhp, maxstamina on player: ((FullStats[vit] - BaseStats[vit]) * factor) << 6)
        if (this.ownerType !== 'player') return acc
        const diff = this.getAccruedStat(rule.sourceStat) - this.getBaseStat(rule.sourceStat)
        if (diff === 0) return acc
        const { lifePerVitality, staminaPerVitality } = this.resolveCharScaling()
        const factor = rule.targetStat === 'maxstamina' ? staminaPerVitality : lifePerVitality
        return acc + ((diff * factor) << 6)
      }
      case 10:
      case 12:
        // 0x6FD89ACF: no-op in 1.13c
        return acc
      case 11: {
        // 0x6FD89A5C: op = 11 (item_maxhp_percent 76 -> maxhp, item_maxmana_percent 77 -> maxmana)
        if (this.ownerType !== 'player' && this.ownerType !== 'monster') return acc
        if (prev === 0) return acc
        const pct = this.getAccruedStat(rule.sourceStat)
        if (pct === 0) return acc
        return acc + Math.trunc((prev * pct) / 100)
      }
      case 13: {
        // 0x6FD89A87: op = 13 (item_armor_percent 16, item_maxdamage_percent 17, item_mindamage_percent 18,
        // item_maxdurability_percent 75, item_levelreqpct 94): runs ONLY on UNIT_ITEM (dwUnitType == 4)
        // and scales ONLY BaseStats[targetStat] on the item!
        if (this.ownerType !== 'item') return acc
        const baseTarget = useBaseAsPrev()
        if (baseTarget === 0) return acc
        const pct = this.getBaseStat(rule.sourceStat) + this.getModifierBonus(rule.sourceStat)
        if (pct === 0) return acc
        return acc + Math.trunc((baseTarget * pct) / 100)
      }
      default:
        return acc
    }
  }

  /**
   * Get accrued stat value (`D2Common_10973` / `STATLIST_UnitGetStatValue` `0x6FD88B70` -> `EvalStatWithOps` `0x6FD89530`).
   * Evaluates `ItemStatCost.txt` `op 1..13` in canonical table order and applies unit defense/attack-rating scaling.
   */
  getAccruedStat(statNameOrId: string | number, baseOnly = false): number {
    const key = this.normalizeStatKey(statNameOrId)
    const base = this.getBaseStat(key)
    if (baseOnly) return base

    if (this.ownerType === 'item') {
      return this.evalItemLocalStat(key)
    }

    const modBonus = this.getModifierBonus(key)
    const attachedBonus = this.getAttachedStatBonus(key)
    let acc = base + attachedBonus + modBonus
    let prev = acc

    const rules = OP_RULES_BY_TARGET.get(key)
    if (rules) {
      for (const rule of rules) {
        acc = this.applyOpRule(rule, acc, prev, () => {
          prev = base
          return prev
        })
      }
    }

    if (key === 'armorclass') {
      // 1.13c `UNITS_GetDefense` (`0x6FD82890` / `0x6FD82A14..0x6FD82AE9`):
      // 1) `armor_override_percent` (ID 182): if <= -100 (e.g. Berserk), defense is 0; if > -100 and != 0, `acc += trunc(acc * overridePct / 100)`.
      // 2) Unit-level `item_armor_percent` (ID 16) + `skill_armor_percent` (ID 171) + Holy Shield (`state 101` / `350`/`351`) scale defense in one additive pool.
      const overridePct = this.getAccruedStat('armor_override_percent')
      if (overridePct <= -100) {
        return 0
      }
      if (overridePct !== 0) {
        acc += Math.trunc((acc * overridePct) / 100)
      }
      const unitItemArmorPct = this.getBaseStat('item_armor_percent') + this.getModifierBonus('item_armor_percent')
      const skillArmorPct = this.getAccruedStat('skill_armor_percent')
      const hsPct = this.getHolyShieldDefensePct113c()
      const totalArmorPct = unitItemArmorPct + skillArmorPct + hsPct
      if (totalArmorPct !== 0) {
        acc += Math.trunc((acc * totalArmorPct) / 100)
      }
      if (acc < 0) {
        acc = 0
      }
    } else if (key === 'tohit') {
      // Standalone callers reading `getAccruedStat('tohit')` include `item_tohit_percent` (119);
      // `executeSUnitDmg` (`0x6FCFDE90`) calls `getRawToHit113c()` and folds `item_tohit_percent` into
      // the single additive `%AR` pool (#1625).
      const tohitPct = this.getAccruedStat('item_tohit_percent')
      if (tohitPct !== 0) {
        acc = Math.trunc((acc * (100 + tohitPct)) / 100)
      }
    } else if (key === 'maxfireresist') {
      const blvlResistFire = this.getBaseSkillLevel(100)
      const hasActiveResistFire = this.modifiers.some(
        m => m.id !== 'passive_skill_100' && (m.sourceSkillId === 100 || m.stateName === 'resistfire'),
      )
      if (hasActiveResistFire && modBonus === 0 && blvlResistFire > 0) {
        acc += blvlResistFire
      }
    } else if (key === 'maxcoldresist') {
      const blvlResistCold = this.getBaseSkillLevel(105)
      const hasActiveResistCold = this.modifiers.some(
        m => m.id !== 'passive_skill_105' && (m.sourceSkillId === 105 || m.stateName === 'resistcold'),
      )
      if (hasActiveResistCold && modBonus === 0 && blvlResistCold > 0) {
        acc += blvlResistCold
      }
    } else if (key === 'maxlightresist') {
      const blvlResistLight = this.getBaseSkillLevel(110)
      const hasActiveResistLight = this.modifiers.some(
        m => m.id !== 'passive_skill_110' && (m.sourceSkillId === 110 || m.stateName === 'resistlight'),
      )
      if (hasActiveResistLight && modBonus === 0 && blvlResistLight > 0) {
        acc += blvlResistLight
      }
    }

    const statDef = CANONICAL_ITEM_STAT_COST_BY_NAME.get(key)
    if (statDef?.bMin && acc < statDef.minAccr && (acc < 0 || this.baseStats.has(key))) {
      acc = statDef.minAccr
    }

    return Math.trunc(acc)
  }

  /**
   * Flat part of 1.13c `D2Common.dll` `UNITS_GetAttackRate` #10621 @ `0x6FD81EA0`:
   * Returns accrued flat `tohit` (`STAT_TOHIT`, ID 19, including `op = 6` `item_tohit_perlevel` 224)
   * WITHOUT multiplying by `item_tohit_percent` (`119`), so `executeSUnitDmg` (`0x6FCFDE90`) can combine
   * `item_tohit_percent` into a single additive `%AR` pool with skill/mastery/charge-up `%AR` (#1625).
   */
  getRawToHit113c(): number {
    if (this.ownerType === 'item') {
      return this.evalItemLocalStat('tohit')
    }
    const base = this.getBaseStat('tohit')
    const modBonus = this.getModifierBonus('tohit')
    const attachedBonus = this.getAttachedStatBonus('tohit')
    let acc = base + attachedBonus + modBonus
    let prev = acc
    const rules = OP_RULES_BY_TARGET.get('tohit')
    if (rules) {
      for (const rule of rules) {
        acc = this.applyOpRule(rule, acc, prev, () => {
          prev = base
          return prev
        })
      }
    }
    return Math.trunc(acc)
  }

  /**
   * 1.13c `D2Common.dll` `0x6FD82890` (`D2Common_10672` / `UNITS_GetDefense`):
   * - Never zeroes defense for `PLRMODE_RUN` (`0x6FD82890` does not inspect unit mode; running bypasses `RollToHit` at `0x6FCFE006`, #1634).
   * - If `armor_override_percent <= -100` (e.g. Berserk), returns `0`; if `> -100 && != 0`, applies `d += trunc(d * overridePct / 100)`.
   * - Starts from accrued `armorclass` (`STAT_ARMORCLASS`, ID 31) + `Math.floor(dexterity / 4)` (for players/monsters with dexterity).
   * - Scales by `100 + item_armor_percent + skill_armor_percent + holyShieldPct` (clamped at `>= 0`).
   */
  getDefense(options?: { isRunningPlayer?: boolean; includeDexterityBonus?: boolean }): number {
    const overridePct = this.getAccruedStat('armor_override_percent')
    if (overridePct <= -100) {
      return 0
    }
    const baseAndItemsArmor =
      this.getBaseStat('armorclass') +
      this.getAttachedStatBonus('armorclass') +
      this.getModifierBonus('armorclass')
    let armorWithItemOps = baseAndItemsArmor
    let prev = baseAndItemsArmor
    const rules = OP_RULES_BY_TARGET.get('armorclass')
    if (rules) {
      for (const rule of rules) {
        armorWithItemOps = this.applyOpRule(rule, armorWithItemOps, prev, () => {
          prev = this.getBaseStat('armorclass')
          return prev
        })
      }
    }
    const includeDex = options?.includeDexterityBonus ?? (this.ownerType === 'player')
    const dexBonus = includeDex ? this.getAccruedStat('dexterity') >> 2 : 0
    let rawDef = armorWithItemOps + dexBonus
    if (overridePct !== 0) {
      rawDef += Math.trunc((rawDef * overridePct) / 100)
    }
    const unitItemArmorPct = this.getBaseStat('item_armor_percent') + this.getModifierBonus('item_armor_percent')
    const skillPct = this.getAccruedStat('skill_armor_percent')
    const hsPct = this.getHolyShieldDefensePct113c()
    const totalArmorPct = unitItemArmorPct + skillPct + hsPct
    const scaled = totalArmorPct !== 0 ? rawDef + Math.trunc((rawDef * totalArmorPct) / 100) : rawDef
    return Math.max(0, Math.trunc(scaled))
  }

  /**
   * 1.13c `D2Common.dll` `0x6FD82890` (`UNITS_GetDefense`):
   * Evaluates active `STATE_HOLYSHIELD` (`state 101`) / `modifierlist_skill = 117` (`stat 350`) + `modifierlist_level` (`stat 351`)
   * using `Skills.txt` `#117` `calc1 = ln34 + skill('Defiance'.blvl) * par8` (`25 + 15 * (slvl - 1) + 15 * blvl(104)`).
   * Never reads `item_skillonhit` (`201`) or `item_skillongethit` (`202`).
   */
  private getHolyShieldDefensePct113c(): number {
    const hsMod = this.modifiers.find(
      m => m.stateId === 101 || m.stateName === 'holyshield' || m.stats['modifierlist_skill'] === 117,
    )
    const modSkill = this.getBaseStat('modifierlist_skill')
    const baseHsLvl = modSkill === 117 ? this.getBaseStat('modifierlist_level') : 0
    const hsLvl = hsMod
      ? Math.max(0, Math.trunc(hsMod.stats['modifierlist_level'] ?? hsMod.slvl ?? 0))
      : Math.max(0, Math.trunc(baseHsLvl))
    if (hsLvl <= 0) return 0
    const skillRec = this.registry?.getSkillById(117)
    const p3 = skillRec ? skillRec.param3 : 25
    const p4 = skillRec ? skillRec.param4 : 15
    const p8 = skillRec ? skillRec.param8 : 15
    const calcPct = p3 + p4 * (hsLvl - 1) + p8 * this.getBaseSkillLevel(104)
    const alreadyInSkillArmorPct = hsMod ? Math.trunc(hsMod.stats['skill_armor_percent'] ?? 0) : 0
    return Math.max(0, calcPct - alreadyInSkillArmorPct)
  }

  /**
   * Player/hireling resistance cap for a channel with a max stat.
   * 1.13c `D2Game.dll` 0x6FCFB457..0x6FCFB46B: `min(95, 75 + stat(max))` where the max stat is
   * `maxfireresist` (40) / `maxlightresist` (42) / `maxcoldresist` (44) / `maxpoisonresist` (46) /
   * `maxmagicresist` (38). There is no lower clamp on the cap.
   */
  getEffectiveMaxResistance(elemType: 'fire' | 'cold' | 'ltng' | 'pois' | 'mag'): number {
    const statKey =
      elemType === 'fire'
        ? 'maxfireresist'
        : elemType === 'cold'
          ? 'maxcoldresist'
          : elemType === 'ltng'
            ? 'maxlightresist'
            : elemType === 'pois'
              ? 'maxpoisonresist'
              : 'maxmagicresist'
    const bonus = Math.trunc(this.getAccruedStat(statKey))
    return Math.min(95, 75 + bonus)
  }

  /**
   * Attach or update a `SkillStatModifier`.
   */
  addOrUpdateModifier(mod: SkillStatModifier): void {
    const normStats: Record<string, number> = {}
    for (const [k, v] of Object.entries(mod.stats)) {
      normStats[this.normalizeStatKey(k)] = Math.trunc(v)
    }
    const normalizedMod: SkillStatModifier = {
      ...mod,
      stats: normStats,
    }

    const existingIdx = this.modifiers.findIndex(
      m =>
        m.id === normalizedMod.id ||
        (!normalizedMod.isAura &&
          !m.id.startsWith('passive_skill_') &&
          m.stateName.toLowerCase() === normalizedMod.stateName.toLowerCase()),
    )
    if (existingIdx !== -1) {
      this.modifiers[existingIdx] = normalizedMod
    } else {
      this.modifiers.push(normalizedMod)
    }
    this.syncPassiveSkillModifiers()
  }

  removeModifiersByState(stateNameOrId: string | number): SkillStatModifier[] {
    const removed: SkillStatModifier[] = []
    for (let i = this.modifiers.length - 1; i >= 0; i -= 1) {
      const m = this.modifiers[i]!
      const match =
        typeof stateNameOrId === 'number'
          ? m.stateId === stateNameOrId
          : m.stateName.toLowerCase() === stateNameOrId.trim().toLowerCase()
      if (match) {
        removed.push(m)
        this.modifiers.splice(i, 1)
      }
    }
    this.syncPassiveSkillModifiers()
    return removed
  }

  removeModifiersByFilter(predicate: (mod: SkillStatModifier) => boolean): SkillStatModifier[] {
    const removed: SkillStatModifier[] = []
    for (let i = this.modifiers.length - 1; i >= 0; i -= 1) {
      const m = this.modifiers[i]!
      if (predicate(m)) {
        removed.push(m)
        this.modifiers.splice(i, 1)
      }
    }
    this.syncPassiveSkillModifiers()
    return removed
  }

  /**
   * Expire any modifier whose `expireFrame > 0 && expireFrame <= currentFrame`.
   */
  expireAtFrame(currentFrame: number): SkillStatModifier[] {
    return this.removeModifiersByFilter(m => m.expireFrame > 0 && m.expireFrame <= currentFrame)
  }

  getActiveModifiers(): readonly SkillStatModifier[] {
    return this.modifiers
  }

  /**
   * Convenience helpers for 256-fixed-point (`<< 8`) HP and Mana access.
   */
  getHp256(): number {
    return this.getBaseStat('hitpoints')
  }

  getHp(): number {
    return Math.ceil(this.getHp256() / FIXED_ONE)
  }

  getMaxHp256(): number {
    return this.getAccruedStat('maxhp')
  }

  getMaxHp(): number {
    return Math.ceil(this.getMaxHp256() / FIXED_ONE)
  }

  setHp256(hp256: number): void {
    const truncHp = Math.trunc(hp256)
    const maxHp256 = this.getMaxHp256()
    const upper = maxHp256 > 0 || this.baseStats.has('maxhp') ? maxHp256 : Math.max(0, truncHp)
    const clamped = Math.max(0, Math.min(upper, truncHp))
    this.setBaseStat('hitpoints', clamped)
  }

  getMana256(): number {
    return this.getBaseStat('mana')
  }

  getMana(): number {
    return Math.floor(this.getMana256() / FIXED_ONE)
  }

  getMaxMana256(): number {
    return this.getAccruedStat('maxmana')
  }

  setMana256(mana256: number): void {
    const truncMana = Math.trunc(mana256)
    const maxMana256 = this.getMaxMana256()
    const upper = maxMana256 > 0 || this.baseStats.has('maxmana') ? maxMana256 : Math.max(0, truncMana)
    const clamped = Math.max(0, Math.min(upper, truncMana))
    this.setBaseStat('mana', clamped)
  }

  /**
   * 1.13c multi-source weapon/charm poison accumulator (`poison_count` `stat 326`,
   * `D2Game.dll` `0x6FCF5EE0..0x6FCF5FD0` / Issue `#1871`):
   * - Bitrates (`poisonmindam` `57`, `poisonmaxdam` `58`, in `1/256` HP/frame) sum across sources.
   * - Total durations (`poisonlength` `59`, in frames) sum across sources and are averaged by
   *   `Math.floor(totalFrames / poisonCount)` when `poisonCount > 1` on melee/non-ranged resolution;
   *   callers that need raw summed length or ranged behavior can also inspect `rawFrames` and `count`.
   */
  getEffectiveWeaponPoison113c(): {
    readonly minBitrate256: number
    readonly maxBitrate256: number
    readonly frames: number
    readonly rawFrames: number
    readonly count: number
  } {
    const minBitrate256 = Math.max(0, Math.trunc(this.getAccruedStat('poisonmindam')))
    const maxBitrate256 = Math.max(minBitrate256, Math.trunc(this.getAccruedStat('poisonmaxdam')))
    const rawFrames = Math.max(0, Math.trunc(this.getAccruedStat('poisonlength')))
    const rawCount = Math.max(0, Math.trunc(this.getAccruedStat('poison_count')))
    const count =
      rawCount > 0 ? rawCount : (minBitrate256 > 0 || maxBitrate256 > 0) && rawFrames > 0 ? 1 : 0
    const frames = count > 1 ? Math.floor(rawFrames / count) : rawFrames
    return { minBitrate256, maxBitrate256, frames, rawFrames, count }
  }

  /**
   * 1.13c SUNITDMG_DrainItemDurability: Drains durability from equipped weapon upon contact hits (e.g. Blade Shield).
   */
  drainEquippedWeaponDurability(amount: number = 1): number {
    const cur = this.getBaseStat('durability')
    if (cur > 0) {
      const updated = Math.max(0, cur - amount)
      this.setBaseStat('durability', updated)
      return updated
    }
    return 0
  }
}

export type WeaponPoisonSourceInput113c =
  | { readonly bitrate256: number; readonly frames: number }
  | { readonly minBitrate256: number; readonly maxBitrate256: number; readonly lengthFrames: number }

/**
 * 1.13c multi-source weapon/charm poison + `#278 Venom` (`STATE_VENOM` = 31, `10`-frame clamp)
 * aggregator (`D2Game.dll` `0x6FCF5EE0` / `0x6FCF6140`, `#1871`).
 *
 * - Sums per-frame `bitrate256` across all positive poison sources.
 * - Without Venom: averages `lengthFrames = floor(totalFrames / count)` when `count > 1`.
 * - With Venom (`venomActive = true`): clamps all item/charm poison duration to `10` frames (`0.4s`)
 *   and adds Venom's rolled `[venomMinBitrate256..venomMaxBitrate256]` per-frame bitrate.
 */
export function getEffectiveWeaponPoison113c(
  sources: readonly WeaponPoisonSourceInput113c[],
  venomActive: boolean,
  venomMinBitrate256: number,
  venomMaxBitrate256: number,
  rng?: { rand(max: number): number },
): { bitrate256: number; lengthFrames: number } {
  const roll = (lo: number, hi: number): number => {
    const minV = Math.max(0, Math.trunc(lo))
    const maxV = Math.max(minV, Math.trunc(hi))
    if (maxV <= minV) return minV
    return rng ? minV + rng.rand(maxV - minV + 1) : Math.floor((minV + maxV) / 2)
  }

  let sumRate256 = 0
  let sumFrames = 0
  let count = 0
  for (const src of sources) {
    const rate = 'bitrate256' in src ? Math.trunc(src.bitrate256) : roll(src.minBitrate256, src.maxBitrate256)
    const frames = 'frames' in src ? Math.trunc(src.frames) : Math.trunc(src.lengthFrames)
    if (rate > 0 && frames > 0) {
      sumRate256 += rate
      sumFrames += frames
      count += 1
    }
  }

  if (venomActive) {
    const venomRate = roll(venomMinBitrate256, venomMaxBitrate256)
    const totalRate = sumRate256 + venomRate
    return {
      bitrate256: totalRate,
      lengthFrames: totalRate > 0 ? 10 : 0,
    }
  }

  if (count === 0) return { bitrate256: 0, lengthFrames: 0 }
  return {
    bitrate256: sumRate256,
    lengthFrames: count > 1 ? Math.floor(sumFrames / count) : sumFrames,
  }
}

/**
 * Unclamped 1.13c `D2Common #10672` (`UNITS_GetDefense` @ `0x6FD82890..0x6FD82C01`):
 * 1. `esi = armorclass + trunc(dex / 4)` (`cdq; and edx, 3; add eax, edx; sar eax, 2`).
 * 2. `ecx = imul(esi, skillArmorPct + itemArmorPct)`; if `esi > 0`, `esi += trunc(ecx / 100)`,
 *    else `esi += trunc((-ecx) / 100)` (`0x6FD82AE0..0x6FD82B0C` magic `0x51EB851F` / `-0x51EB851F`).
 * 3. If `overridePct != 0`, `esi += mulDiv113c(overridePct, esi, 100)` (`0x6FD82B50..0x6FD82BF8`), with no `>= 0` clamp.
 */
export function computeRawDefense113c(params: {
  readonly dex: number
  readonly armorclass: number
  readonly skillArmorPct: number
  readonly itemArmorPct: number
  readonly overridePct: number
}): number {
  const dex = params.dex | 0
  let esi = ((params.armorclass | 0) + (Math.trunc(dex / 4) | 0)) | 0
  const pct = ((params.skillArmorPct | 0) + (params.itemArmorPct | 0)) | 0
  const ecx = Math.imul(esi, pct)
  const magic = esi > 0 ? 0x51eb851fn : -0x51eb851fn
  const edx = Number((BigInt(ecx) * magic) >> 32n) | 0
  const q = ((edx >> 5) + (edx >>> 31)) | 0
  esi = (esi + q) | 0
  const ovr = params.overridePct | 0
  if (ovr !== 0) {
    esi = (esi + mulDiv113c(ovr, esi, 100)) | 0
  }
  return esi
}
