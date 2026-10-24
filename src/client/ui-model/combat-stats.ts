/**
 * Character-sheet combat stats: attack rating and damage for each hand (Diablo II v1.13c parity).
 *
 * Gitea #756 (per-hand attack rating) and #757 (per-hand damage + damage colours); PROJECT.md rules
 * 16, 17, 21, 23 (`.agents/teamwork/teamwork_preview_orchestrator_char_sheet/PROJECT.md`).
 *
 * This module is a PURE core: plain typed inputs → numbers / strings, no ClientWorld access. Every
 * number that comes from a game table (Weapons.txt, Armor.txt, ItemTypes.txt, Skills.txt,
 * CharStats.txt, ItemStatCost.txt, States.txt) arrives through `CombatInput`; this file only encodes
 * the D2 code paths. D2MOO (the 1.10f decompilation, `D2MOO/source/...`) is the code-path stand-in
 * for 1.13c. Code paths used:
 *  - AR:            D2Common `UNITS_GetAttackRate` (Units.cpp:2394-2418) and the attacker side of the
 *                   D2Game hit check (SUnitDmg.cpp:2495-2541).
 *  - Physical:      D2Game `SUNITDMG_ApplyDamageBonuses` (SUnitDmg.cpp:146-246).
 *  - Element adds:  D2Game `SUNITDMG_FillDamageValues` (SUnitDmg.cpp:249-629).
 *  - Kick:          D2Common `SKILLS_CalculateKickDamage` (D2Skills.cpp:3540-3630), D2Game
 *                   SkillAss.cpp:1192-1240, kick base D2Skills.cpp:2501-2517 / 2567-2584.
 *  - Hand / stat-list selection: D2Game `sub_6FC7C7B0` / `sub_6FC7C900` (Player.cpp:824-967);
 *                   D2Common `INVENTORY_GetEquippedWeapon` (D2Inventory.cpp:1923-1970),
 *                   `INVENTORY_GetCompositItem` (D2Inventory.cpp:1448-1491),
 *                   `INVENTORY_GetLeftHandWeapon` / `INVENTORY_GetSecondaryWeapon`
 *                   (D2Inventory.cpp:1388-1446), `INVENTORY_GetWieldType` (D2Inventory.cpp:2390-2466).
 *  - Stat lists:    D2Common `sub_6FDB5830` (D2StatList.cpp:168-436: damagerelated exclusion of
 *                   STATLIST_DYNAMIC lists, op 2 unit-level, op 4 / 5 / 13 item-level),
 *                   `ComputeStatPercentage` (D2StatList.cpp:157-166).
 *  - Item base:     ItemMods.cpp:925-955 (base damage stats), `ITEMMODS_ApplyEthereality`
 *                   (ItemMods.cpp:2531-2546).
 *  - Masteries:     `SKILLS_GetWeaponMasteryBonus` / `D2Common_11024` (D2Skills.cpp:3014-3110).
 *  - Skill AR %:    `SKILLS_GetToHitFactor` (D2Skills.cpp:2405-2425).
 *  - Colours:       PROJECT.md rule 16 — States.txt attblue / damblue / attred / damred of the active
 *                   states; red beats blue; there is no green (green_evidence.md).
 *
 * Units: like D2, damage is computed in 1/256 units ("<< 8") and displayed with ">> 8". Poison stats
 * are in the internal per-frame 1/256 unit and are displayed as floor(rate · length / 256).
 */

import type { CharacterClassCode } from '../../common/units/classes.ts'

// ─── ItemStatCost.txt row ids (1.13c, repo RAW_ITEM_STAT_COST; D2MOO STAT_* enum) ─────────────────

/** ItemStatCost.txt `ID` of every stat this module reads. Verified against the table in the tests. */
export const COMBAT_STAT = {
  ITEM_MAXDAMAGE_PERCENT: 17,
  ITEM_MINDAMAGE_PERCENT: 18,
  TOHIT: 19,
  TOBLOCK: 20,
  MINDAMAGE: 21,
  MAXDAMAGE: 22,
  SECONDARY_MINDAMAGE: 23,
  SECONDARY_MAXDAMAGE: 24,
  DAMAGEPERCENT: 25,
  FIREMINDAM: 48,
  FIREMAXDAM: 49,
  LIGHTMINDAM: 50,
  LIGHTMAXDAM: 51,
  MAGICMINDAM: 52,
  MAGICMAXDAM: 53,
  COLDMINDAM: 54,
  COLDMAXDAM: 55,
  POISONMINDAM: 57,
  POISONMAXDAM: 58,
  POISONLENGTH: 59,
  SKILL_POISON_OVERRIDE_LENGTH: 101,
  ITEM_NORMALDAMAGE: 111,
  ITEM_TOHIT_PERCENT: 119,
  ITEM_KICKDAMAGE: 137,
  ITEM_THROW_MINDAMAGE: 159,
  ITEM_THROW_MAXDAMAGE: 160,
  ITEM_MAXDAMAGE_PERLEVEL: 218,
  ITEM_MAXDAMAGE_PERCENT_PERLEVEL: 219,
  ITEM_TOHIT_PERLEVEL: 224,
  ITEM_TOHITPERCENT_PERLEVEL: 225,
  ITEM_COLD_DAMAGEMAX_PERLEVEL: 226,
  ITEM_FIRE_DAMAGEMAX_PERLEVEL: 227,
  ITEM_LTNG_DAMAGEMAX_PERLEVEL: 228,
  ITEM_POIS_DAMAGEMAX_PERLEVEL: 229,
  ITEM_KICK_DAMAGE_PERLEVEL: 249,
  POISON_COUNT: 326,
  PASSIVE_FIRE_MASTERY: 329,
  PASSIVE_LTNG_MASTERY: 330,
  PASSIVE_COLD_MASTERY: 331,
  PASSIVE_POIS_MASTERY: 332,
  PASSIVE_MASTERY_MELEE_TH: 342,
  PASSIVE_MASTERY_MELEE_DMG: 343,
  PASSIVE_MASTERY_MELEE_CRIT: 344,
  PASSIVE_MASTERY_THROW_TH: 345,
  PASSIVE_MASTERY_THROW_DMG: 346,
  PASSIVE_MASTERY_THROW_CRIT: 347,
  PASSIVE_WEAPONBLOCK: 348,
  PASSIVE_MAG_MASTERY: 357,
} as const

const S = COMBAT_STAT

/**
 * Unit-level per-level ops: ItemStatCost.txt rows with `op` = 2, `op base` = level
 * (D2StatList.cpp:229-255: applied on the PLAYER list to the aggregated source stat —
 * `target += (clvl · Σsource) >> op param`). Only the rows whose target this module reads; the tests
 * check every entry (and that no other op-2 row targets a stat read here) against ItemStatCost.txt.
 */
export const UNIT_PER_LEVEL_OPS: readonly { readonly source: number; readonly target: number; readonly shift: number }[] = [
  { source: S.ITEM_TOHIT_PERLEVEL, target: S.TOHIT, shift: 1 },
  { source: S.ITEM_TOHITPERCENT_PERLEVEL, target: S.ITEM_TOHIT_PERCENT, shift: 1 },
  { source: S.ITEM_COLD_DAMAGEMAX_PERLEVEL, target: S.COLDMAXDAM, shift: 3 },
  { source: S.ITEM_FIRE_DAMAGEMAX_PERLEVEL, target: S.FIREMAXDAM, shift: 3 },
  { source: S.ITEM_LTNG_DAMAGEMAX_PERLEVEL, target: S.LIGHTMAXDAM, shift: 3 },
  { source: S.ITEM_POIS_DAMAGEMAX_PERLEVEL, target: S.POISONMAXDAM, shift: 3 },
  { source: S.ITEM_KICK_DAMAGE_PERLEVEL, target: S.ITEM_KICKDAMAGE, shift: 3 },
]

/** ItemStatCost.txt `op param` of 218 (op 4) and 219 (op 5): `(clvl · v) >> 3`. */
const ITEM_PER_LEVEL_SHIFT = 3

/** Item-level op stats of a weapon (ops 13 / 4 / 5): consumed inside the weapon's own stat list. */
const WEAPON_LOCAL_OP_STATS: ReadonlySet<number> = new Set([
  S.ITEM_MAXDAMAGE_PERCENT,
  S.ITEM_MINDAMAGE_PERCENT,
  S.ITEM_MAXDAMAGE_PERLEVEL,
  S.ITEM_MAXDAMAGE_PERCENT_PERLEVEL,
])

/** The six item damage stats whose base value comes from Weapons.txt (ItemMods.cpp:925-955). */
const WEAPON_DAMAGE_STATS: ReadonlySet<number> = new Set([
  S.MINDAMAGE,
  S.MAXDAMAGE,
  S.SECONDARY_MINDAMAGE,
  S.SECONDARY_MAXDAMAGE,
  S.ITEM_THROW_MINDAMAGE,
  S.ITEM_THROW_MAXDAMAGE,
])
const MAX_DAMAGE_STATS: ReadonlySet<number> = new Set([S.MAXDAMAGE, S.SECONDARY_MAXDAMAGE, S.ITEM_THROW_MAXDAMAGE])

// ─── Integer helpers (C/C++ int32 semantics) ──────────────────────────────────────────────────────

/** `a / b` on int32 operands (truncates toward zero). */
function idiv(a: number, b: number): number {
  if (b === 0) throw new Error('combat-stats: integer division by zero')
  return Math.trunc(a / b)
}

function assertInt(value: number, what: string): number {
  if (!Number.isInteger(value)) throw new Error(`combat-stats: ${what} must be an integer, got ${value}`)
  return value
}

/**
 * D2Game `MONSTERUNIQUE_CalculatePercentage(a1, a2, a3)` (MonsterUnique.cpp:233-262): `a1 · a2 / a3`
 * with D2's overflow guards; int32 products wrap like the x86 build, int64 branch is exact.
 */
export function calculatePercentage(a1: number, a2: number, a3: number): number {
  if (a3 === 0) return 0
  if (a1 <= 1048576) {
    if (a2 <= 65536) return idiv(Math.imul(a2, a1), a3) | 0
    if (a3 <= a2 >> 4) return Math.imul(a1, idiv(a2, a3))
  } else if (a3 <= a1 >> 4) {
    return Math.imul(a2, idiv(a1, a3))
  }
  return Number(BigInt.asIntN(32, (BigInt(a2) * BigInt(a1)) / BigInt(a3)))
}

/** D2Common `ComputeStatPercentage` (D2StatList.cpp:157-166): `(int)(nValue * (pct / 100.0))`. */
export function computeStatPercentage(value: number, pct: number): number {
  if (pct === 0) return 0
  return Math.trunc(value * (pct / 100))
}

// ─── Inputs ───────────────────────────────────────────────────────────────────────────────────────

/** Stat getter: D2 `STATLIST_GetUnitStat` semantics — absent stats read 0. */
export type StatReader = (statId: number, param?: number) => number

/** States.txt colour columns that drive the AR / damage colour (PROJECT.md rule 16). */
export type CombatStateColorFlag = 'attblue' | 'damblue' | 'attred' | 'damred'

/** AR / damage colours (rule 16: no green in 1.13c). */
export type CombatColor = 'white' | 'blue' | 'red'

/** Skills.txt `range` codes (SkillsTbls.cpp:717-721 linker order none=0, h2h=1, rng=2, both=3, loc=4). */
export type SkillRangeCode = 'none' | 'h2h' | 'rng' | 'both' | 'loc'

/** Weapons.txt row data of a weapon item (all values straight from the 1.13c table). */
export interface CombatWeaponRow {
  readonly code: string
  /** `mindam` / `maxdam` (blank → 0). */
  readonly minDam: number
  readonly maxDam: number
  /** `2handmindam` / `2handmaxdam` (blank → 0). */
  readonly twoHandMinDam: number
  readonly twoHandMaxDam: number
  /** `minmisdam` / `maxmisdam` (blank → 0). */
  readonly minMisDam: number
  readonly maxMisDam: number
  /** `StrBonus` / `DexBonus` (ITEMS_GetStrengthBonus / ITEMS_GetDexBonus). */
  readonly strBonus: number
  readonly dexBonus: number
  /** `2handed` (ITEMS_CheckWeaponIfTwoHanded). */
  readonly twoHanded: boolean
  /** `1or2handed` (ITEMS_Is1Or2Handed, barbarian only). */
  readonly oneOrTwoHanded: boolean
  /** ItemTypes.txt `Throwable` of the row's `type` (ITEMS_CheckIfThrowable, Items.cpp:1487-1516). */
  readonly throwable: boolean
  /** `wclass` (ITEMS_GetWeaponClassId), e.g. '1hs', '1ht', 'ht1', '2hs', 'bow'. */
  readonly weaponClass: string
}

/** An item in an arm slot (body loc 4 = right arm, 5 = left arm; rule 23 — never 11/12). */
export interface CombatArmItem {
  /** Weapons.txt row when the item is-a `weap` (ITEMTYPE_WEAPON); null for shields, quivers, … */
  readonly weapon: CombatWeaponRow | null
  /** Items.txt `component` (ITEMS_GetComponent; 5 = right hand, 6 = left hand, 7 = shield). */
  readonly component: number
  /** IFLAG_ETHEREAL. */
  readonly ethereal: boolean
  /** ITEMS_CanBeEquipped (Items.cpp:4493-4505): not IFLAG_BROKEN / IFLAG_NOEQUIP. */
  readonly canBeEquipped: boolean
  /** ItemTypes.txt ancestry test of the item (ITEMS_CheckItemTypeId). */
  readonly isType: (itemTypeCode: string) => boolean
  /**
   * Pre-op stat values of the item's own lists (affixes, runeword, item set bonuses, socket fillers).
   * The Weapons.txt base damage is NOT included (it is added here from `weapon`).
   */
  readonly localRaw: StatReader
}

/** A stat list of the unit other than the two arm items (rule 15 sources). */
export interface CombatStatList {
  /**
   * `item`: a non-arm item (armour, jewellery, charm; incl. its socket fillers) — item-level op 4
   * (218) applies to it. `state`: a state list (aura, curse, buff; 0xA8 deltas) — excluded from the
   * `base*` values. `other`: base stats, passives, player-level set bonuses.
   */
  readonly kind: 'item' | 'state' | 'other'
  /** Pre-op stat values of the list. */
  readonly get: StatReader
}

/** A weapon-mastery passive stat entry (D2 stat layer = ItemTypes code of the skill's `passiveitype`). */
export interface CombatMastery {
  readonly statId: 342 | 343 | 344 | 345 | 346 | 347
  readonly itemType: string
  readonly value: number
}

/** Armor.txt data of the boots for the kick formula (D2Skills.cpp:3540-3630). */
export interface CombatBoots {
  /** Armor.txt `mindam` / `maxdam` (kick damage of the boots). */
  readonly minDam: number
  readonly maxDam: number
  /** Armor.txt `StrBonus` / `DexBonus`. */
  readonly strBonus: number
  readonly dexBonus: number
}

/** The left or right skill. */
export interface CombatSkillInput {
  /** Skills.txt `Id`. */
  readonly id: number
  /** Effective skill level (hard points + bonuses); 0 = not usable → '--'. */
  readonly level: number
  /** Skills.txt `weapsel` (blank → 0). */
  readonly weapSel: number
  /** Skills.txt `Kick`. */
  readonly kick: boolean
  /** Skills.txt `SrcDam` (blank → 0; SUNITDMG_FillDamageValues treats 0 as 128, SUnitDmg.cpp:256-259). */
  readonly srcDam: number
  /** Skills.txt `itypea1` ('' when blank). */
  readonly itypeA1: string
  /** ITEMS_CheckType(itypea1, ITEMTYPE_THROWN_WEAPON): itypea1 is-a `thro` (false when blank). */
  readonly itypeA1IsThrown: boolean
  /** Skills.txt `range`. */
  readonly range: SkillRangeCode
  /** SKILLS_GetToHitFactor value (see `skillToHitPercent`). */
  readonly toHitPercent: number
  /** D2DamageStrc::dwEnDmgPct set by the skill (its "+x% damage"), 0 for skills without one. */
  readonly damagePercent: number
  /** D2DamageStrc::dwPhysDamage set by the skill before the weapon roll, in 1/256 units. */
  readonly skillPhysical256: { readonly min: number; readonly max: number }
  /**
   * Damage of a non-weapon skill (spell) from the shared skill-calc engine; null when the skill has
   * no damage. Ignored for weapon skills.
   */
  readonly spellDamage: { readonly min: number; readonly max: number } | null
  /**
   * Optional detailed spell breakdown (base, synergy, mastery, equipment +spell damage %, aura bonus)
   * for character-sheet hover formula tooltips.
   */
  readonly spellBreakdown?: CombatSpellDamageBreakdown | null | undefined
  /**
   * Percentage (0..100) of physical weapon damage converted to magic damage
   * (e.g. #152 Berserk = 100%, #144 Concentrate / #147 Frenzy = 1% per Berserk hard point).
   */
  readonly magicConversionPct?: number | undefined
  /**
   * Skill flat physical bonus damage in display units (e.g. #6 Magic Arrow +lvl);
   * used when skillPhysical256 is 0.
   */
  readonly flatPhysMin?: number | undefined
  readonly flatPhysMax?: number | undefined
  /**
   * Skill elemental/poison/magic bonus damage added to weapon attack
   * (e.g. #14 Power Strike, #7 Fire Arrow, #11 Cold Arrow, #238 Rabies, #239 Fire Claws, #259..#280).
   */
  readonly skillElemMin?: number | undefined
  readonly skillElemMax?: number | undefined
  readonly skillElemType?: string | undefined
}

export interface CombatInput {
  readonly charClass: CharacterClassCode
  /** Unit level (ItemStatCost `level`), the op base of every per-level stat. */
  readonly clvl: number
  /** CharStats.txt `ToHitFactor`. */
  readonly toHitFactor: number
  /** Full strength / dexterity (STATLIST_UnitGetStatValue incl. ops); non-damagerelated stats. */
  readonly strength: number
  readonly dexterity: number
  /** Dexterity with all state contributions excluded (for `baseAttackRating`, rule 16). */
  readonly dexterityWithoutStates: number
  /** Every unit stat list except the two arm items. */
  readonly lists: readonly CombatStatList[]
  /** Body loc 4 (right arm) / 5 (left arm). */
  readonly rightArm: CombatArmItem | null
  readonly leftArm: CombatArmItem | null
  /**
   * The arm holding the inventory's primary weapon (D2InventoryStrc::dwLeftItemGUID — the first
   * weapon inserted into either arm, INVENTORY_UpdateWeaponGUIDOnInsert/OnRemoval,
   * D2Inventory.cpp:2325-2389). Required whenever an arm holds a weapon; null otherwise.
   */
  readonly primaryArm: 'right' | 'left' | null
  /** Boots (body loc 9), for kick skills. */
  readonly boots: CombatBoots | null
  /** Weapon-mastery passive stats of the unit. */
  readonly masteries: readonly CombatMastery[]
  /** ItemStatCost.txt `damagerelated`. */
  readonly isDamageRelated: (statId: number) => boolean
  /** True when an active state of the unit has the States.txt column set. */
  readonly hasStateColorFlag: (flag: CombatStateColorFlag) => boolean
  readonly leftSkill: CombatSkillInput
  readonly rightSkill: CombatSkillInput
}

// ─── Outputs ──────────────────────────────────────────────────────────────────────────────────────

/** Displayed damage components of one skill (integers, D2 display units). */
export interface CombatDamageComponents {
  /** 'weapon' = weapon / kick attack; 'spell' = skill-calc engine damage; 'none' = no damage. */
  readonly kind: 'weapon' | 'spell' | 'none'
  readonly physMin: number
  readonly physMax: number
  readonly fireMin: number
  readonly fireMax: number
  readonly coldMin: number
  readonly coldMax: number
  readonly lightMin: number
  readonly lightMax: number
  readonly magicMin: number
  readonly magicMax: number
  /** Poison over its duration: floor(rate · length / 256). */
  readonly poisonMin: number
  readonly poisonMax: number
}

export interface CombatSpellDamageBreakdown {
  readonly spellType: string
  readonly baseMin: number
  readonly baseMax: number
  readonly synergyBonusPct: number
  readonly withSynergyMin: number
  readonly withSynergyMax: number
  readonly masteryBonusPct: number
  readonly equipSpellDamagePct: number
  readonly auraBonusPct: number
  readonly finalMin: number
  readonly finalMax: number
}

export interface CombatDamageFormulaBreakdown {
  readonly kind: 'weapon' | 'kick' | 'spell' | 'none'
  readonly skillId?: number | undefined
  /** Active weapon's own displayed damage (weaponLocalDamage), or 1~2 when unarmed. */
  readonly weaponMin: number
  readonly weaponMax: number
  /** Off-weapon flat damage from charms/jewelry/armor + ITEM_NORMALDAMAGE. */
  readonly offWeaponFlatMin: number
  readonly offWeaponFlatMax: number
  /** Pre-%ED physical base damage (weaponMin + offWeaponFlatMin .. weaponMax + offWeaponFlatMax). */
  readonly physBaseMin: number
  readonly physBaseMax: number
  /** Physical %ED breakdown components. */
  readonly strEdPct: number
  readonly dexEdPct: number
  readonly masteryEdPct: number
  readonly skillEdPct: number
  /** Off-weapon equipment/charm %ED (e.g. Fortitude +300%, +ED jewels in helm/shield). */
  readonly gearEdPct: number
  /** Self / party / mercenary aura & state %ED (e.g. Might, Concentration, Fanaticism, Heart of Wolverine). */
  readonly auraEdPct: number
  /** Total %ED applied to min and max physical damage. */
  readonly totalMinEdPct: number
  readonly totalMaxEdPct: number
  /** Skill flat physical damage added before SrcDam (e.g. Bash, Smite + Holy Shield). */
  readonly skillPhysMin: number
  readonly skillPhysMax: number
  /** Skills.txt SrcDam (128 = 100%). */
  readonly srcDam: number
  /** Percentage of physical damage converted to magic damage (0..100, e.g. Berserk = 100%). */
  readonly magicConversionPct: number
  /** Post-%ED / post-SrcDam / post-conversion physical damage. */
  readonly physMin: number
  readonly physMax: number
  /** Elemental / magic / poison damage components. */
  readonly fireMin: number
  readonly fireMax: number
  readonly coldMin: number
  readonly coldMax: number
  readonly lightMin: number
  readonly lightMax: number
  readonly magicMin: number
  readonly magicMax: number
  readonly poisonMin: number
  readonly poisonMax: number
  /** Skill elemental/poison/magic bonus damage on weapon attacks (e.g. Power Strike #14). */
  readonly skillElemMin?: number | undefined
  readonly skillElemMax?: number | undefined
  readonly skillElemType?: string | undefined
  /** Optional spell damage breakdown when kind === 'spell'. */
  readonly spellBreakdown?: CombatSpellDamageBreakdown | undefined
  /** Total displayed damage on character sheet. */
  readonly finalMin: number
  readonly finalMax: number
}

export type DamageFormulaBreakdown = CombatDamageFormulaBreakdown

export interface CombatHandStats {
  readonly attackRating: number
  readonly baseAttackRating: number
  readonly attackRatingColor: CombatColor
  readonly damage: CombatDamageComponents
  readonly damageText: string
  readonly damageColor: CombatColor
  /** Arm whose weapon the skill uses (sub_6FC7C7B0), null = unarmed / kick. */
  readonly weaponArm: 'right' | 'left' | null
  /** Detailed 1.13c damage formula breakdown for character-sheet hover tooltip. */
  readonly formulaBreakdown: CombatDamageFormulaBreakdown
}

export interface CombatStats {
  /** Left skill (rule 22 names). */
  readonly attackRating: number
  readonly baseAttackRating: number
  readonly attackRatingColor: CombatColor
  /** Right skill. */
  readonly rightAttackRating: number
  readonly baseRightAttackRating: number
  readonly rightAttackRatingColor: CombatColor
  readonly leftSkillDmg: string
  readonly rightSkillDmg: string
  readonly leftSkillDmgColor: CombatColor
  readonly rightSkillDmgColor: CombatColor
  readonly left: CombatHandStats
  readonly right: CombatHandStats
}

// ─── Hand selection ───────────────────────────────────────────────────────────────────────────────

type Side = 'right' | 'left'

/** UNITS_CanDualWield (Units.cpp:3541): barbarian and assassin only. */
function canDualWield(cls: CharacterClassCode | number): boolean {
  return cls === 'bar' || cls === 'ass' || cls === 4 || cls === 6
}

function arm(input: CombatInput, side: Side): CombatArmItem | null {
  return side === 'right' ? input.rightArm : input.leftArm
}

function isWeaponItem(item: CombatArmItem | null): item is CombatArmItem & { readonly weapon: CombatWeaponRow } {
  return item !== null && item.weapon !== null
}

/** ITEMS_Is1Or2Handed (Items.cpp:3670-3690): Items.txt `1or2handed`, barbarians only. */
function is1Or2Handed(cls: CharacterClassCode | number, item: CombatArmItem): boolean {
  return (cls === 'bar' || cls === 4) && item.weapon !== null && item.weapon.oneOrTwoHanded
}

function isClawItem(item: CombatArmItem): boolean {
  if (item.weapon === null) return false
  const wc = item.weapon.weaponClass
  if (wc === 'ht1' || wc === 'ht2' || wc === 'h2h' || wc === 'h2h2') return true
  return typeof item.isType === 'function' && (item.isType('h2h') || item.isType('h2h2'))
}

function isAssassinDualClaw(cls: CharacterClassCode | number, left: CombatArmItem, right: CombatArmItem): boolean {
  return (cls === 'ass' || cls === 6) && isClawItem(left) && isClawItem(right)
}

/** ITEMS_CheckWeaponIfTwoHanded (Items.cpp:1573-1581): Items.txt `2handed`. */
function isTwoHanded(item: CombatArmItem): boolean {
  return item.weapon !== null && item.weapon.twoHanded
}

/** INVENTORY_GetWieldType (D2Inventory.cpp:2390-2466): -1, 1 (barbarian 1-or-2-handed pair or assassin dual-claw) or 2. */
export function wieldType(input: CombatInput): -1 | 1 | 2 {
  const right = input.rightArm
  const left = input.leftArm
  if (!left) {
    if (!right) return -1
    return isTwoHanded(right) || is1Or2Handed(input.charClass, right) ? 2 : -1
  }
  if (!right) return isTwoHanded(left) || is1Or2Handed(input.charClass, left) ? 2 : -1
  if (is1Or2Handed(input.charClass, left) || is1Or2Handed(input.charClass, right)) return 1
  if (isAssassinDualClaw(input.charClass, left, right)) return 1
  if (isTwoHanded(left)) return 2
  return isTwoHanded(right) ? 2 : -1
}

/** INVENTORY_GetLeftHandWeapon (D2Inventory.cpp:1388-1411): the primary weapon if it is a weapon. */
function primaryWeaponSide(input: CombatInput): Side | null {
  const anyWeapon = isWeaponItem(input.rightArm) || isWeaponItem(input.leftArm)
  if (input.primaryArm === null) {
    if (anyWeapon) throw new Error('combat-stats: primaryArm is required when an arm holds a weapon')
    return null
  }
  if (!isWeaponItem(arm(input, input.primaryArm))) {
    throw new Error(`combat-stats: primaryArm '${input.primaryArm}' does not hold a weapon`)
  }
  return input.primaryArm
}

/** INVENTORY_GetSecondaryWeapon (D2Inventory.cpp:1413-1446): the other arm's weapon. */
function secondaryWeaponSide(input: CombatInput, primary: Side | null): Side | null {
  if (primary === null) return null
  const other: Side = primary === 'right' ? 'left' : 'right'
  return isWeaponItem(arm(input, other)) ? other : null
}

/** One-handed weapon classes mapped through the primary weapon (D2Inventory.cpp:1466). */
const ONE_HAND_CLASSES: ReadonlySet<string> = new Set(['1hs', '1ht', 'ht1', 'ht2', 'h2h', 'h2h2'])

/** INVENTORY_GetCompositItem for COMPOSIT_RIGHTHAND (5) / COMPOSIT_LEFTHAND (6), D2Inventory.cpp:1448-1491. */
function compositItem(input: CombatInput, component: 5 | 6, primary: Side | null): Side | null {
  // Body locs are scanned in order (i < 11): 4 (right arm) before 5 (left arm).
  for (const side of ['right', 'left'] as const) {
    const item = arm(input, side)
    if (!item) continue
    if (item.weapon !== null && ONE_HAND_CLASSES.has(item.weapon.weaponClass)) {
      if (component === 6) {
        if (side !== primary) return side
      } else if (side === primary) {
        return side
      }
    } else if (item.component === component) {
      return side
    }
  }
  return null
}

/** INVENTORY_GetEquippedWeapon (D2Inventory.cpp:1923-1970). */
function equippedWeaponSide(input: CombatInput): Side | null {
  for (const side of ['right', 'left'] as const) {
    const item = arm(input, side)
    if (item && item.canBeEquipped && item.weapon !== null) return side
  }
  return null
}

/**
 * D2Game `sub_6FC7C7B0` (Player.cpp:824-904): the weapon a skill uses. Runtime-only inputs are taken
 * at rest: skill flag 0x2000 (weapsel 2) clear, sequence frame 0 (weapsel 3 → right-hand composit).
 */
export function selectSkillWeapon(input: CombatInput, skill: CombatSkillInput): Side | null {
  const equipped = equippedWeaponSide(input)
  if (!canDualWield(input.charClass)) return equipped
  const primary = primaryWeaponSide(input)
  let candidate: Side | null
  switch (skill.weapSel) {
    case 2: {
      candidate = compositItem(input, 5, primary)
      const other = compositItem(input, 6, primary)
      if (candidate === null || !isWeaponItem(arm(input, candidate))) candidate = other
      break
    }
    case 3:
      candidate = compositItem(input, 5, primary)
      break
    case 4:
      return null
    case 1:
      candidate = compositItem(input, 6, primary)
      break
    default:
      candidate = compositItem(input, 5, primary)
      if (candidate === null || !isWeaponItem(arm(input, candidate))) candidate = compositItem(input, 6, primary)
      break
  }
  if (candidate !== null) {
    const item = arm(input, candidate)
    if (isWeaponItem(item) && item.canBeEquipped) return candidate
  }
  return equipped
}

/**
 * D2Game `sub_6FC7C900` (Player.cpp:906-967): which arm weapons stay merged (damagerelated stats
 * count) for the attack. `a2` = 1 for kicks (SkillAss.cpp:1240), 0 otherwise. For a weapon-less
 * dual-wield selection the secondary keeps its previous state; the sheet takes it as un-merged.
 */
function mergedArms(input: CombatInput, skill: CombatSkillInput, selected: Side | null): Record<Side, boolean> {
  const merged: Record<Side, boolean> = { right: true, left: true }
  const primary = primaryWeaponSide(input)
  const secondary = secondaryWeaponSide(input, primary)
  if (skill.kick) {
    if (primary !== null) merged[primary] = false
    if (secondary !== null) merged[secondary] = false
  }
  if (canDualWield(input.charClass)) {
    if (selected !== null) {
      merged[selected] = true
      if (selected === primary) {
        if (secondary !== null) merged[secondary] = false
      } else if (primary !== null) {
        merged[primary] = false
      }
    } else if (primary !== null) {
      merged[primary] = true
      if (secondary !== null) merged[secondary] = false
    }
  }
  return merged
}

// ─── Stat views ───────────────────────────────────────────────────────────────────────────────────

/** Weapons.txt base value of a damage stat (ItemMods.cpp:925-955 + ethereal ItemMods.cpp:2531-2546). */
function weaponBaseDamage(item: CombatArmItem & { readonly weapon: CombatWeaponRow }, stat: number): number {
  const row = item.weapon
  let base: number
  switch (stat) {
    case S.MINDAMAGE: base = row.minDam; break
    case S.MAXDAMAGE: base = row.maxDam; break
    case S.SECONDARY_MINDAMAGE: base = row.twoHandMinDam; break
    case S.SECONDARY_MAXDAMAGE: base = row.twoHandMaxDam; break
    // Throw damage is only set on throwable items (ITEMS_CheckIfThrowable, ItemMods.cpp:927/948).
    case S.ITEM_THROW_MINDAMAGE: base = row.throwable ? row.minMisDam : 0; break
    case S.ITEM_THROW_MAXDAMAGE: base = row.throwable ? row.maxMisDam : 0; break
    default: throw new Error(`combat-stats: stat ${stat} has no Weapons.txt base`)
  }
  return item.ethereal ? idiv(3 * base, 2) : base
}

/**
 * Value of a damage stat inside a weapon's own stat list (sub_6FDB5830 on the item list): base +
 * local flats, then the ops in ItemStatCost row order — 17/18 op 13 (% of the base), 218 op 4
 * (`(clvl·v) >> 3`, max only), 219 op 5 (`base · ((clvl·v) >> 3) / 100.0`, max only).
 */
function weaponLocalDamage(item: CombatArmItem & { readonly weapon: CombatWeaponRow }, stat: number, clvl: number): number {
  const base = weaponBaseDamage(item, stat)
  const local = item.localRaw
  let localFlat = local(stat)
  if (localFlat === 0) {
    if (
      (stat === S.SECONDARY_MINDAMAGE && (item.weapon.twoHandMinDam !== 0 || item.weapon.minDam === 0)) ||
      (stat === S.ITEM_THROW_MINDAMAGE && item.weapon.throwable)
    ) {
      localFlat = local(S.MINDAMAGE)
    } else if (
      (stat === S.SECONDARY_MAXDAMAGE && (item.weapon.twoHandMaxDam !== 0 || item.weapon.maxDam === 0)) ||
      (stat === S.ITEM_THROW_MAXDAMAGE && item.weapon.throwable)
    ) {
      localFlat = local(S.MAXDAMAGE)
    }
  }
  let value = base + localFlat
  const isMax = MAX_DAMAGE_STATS.has(stat)
  // op 13 (D2StatList.cpp:414-428): previous-op value = the item's base stat.
  // Server wire items encode `dmg%` as statId 17 (`ITEM_MAXDAMAGE_PERCENT`), so fall back to 17 when 18 is 0.
  const edPct = isMax
    ? local(S.ITEM_MAXDAMAGE_PERCENT)
    : (local(S.ITEM_MINDAMAGE_PERCENT) || local(S.ITEM_MAXDAMAGE_PERCENT))
  if (base !== 0) value += computeStatPercentage(base, edPct)
  if (isMax && clvl > 0) {
    // op 4 (D2StatList.cpp:286-307).
    const perLevel = local(S.ITEM_MAXDAMAGE_PERLEVEL)
    if (perLevel !== 0) value += Math.imul(clvl, perLevel) >> ITEM_PER_LEVEL_SHIFT
    // op 5 (D2StatList.cpp:309-331): `nAccumulatedValue += nPreviousOpStatValue * nTemp / 100.0`.
    const pctPerLevel = local(S.ITEM_MAXDAMAGE_PERCENT_PERLEVEL)
    if (pctPerLevel !== 0) {
      const t = Math.imul(clvl, pctPerLevel) >> ITEM_PER_LEVEL_SHIFT
      value = Math.trunc(value + (base * t) / 100)
    }
  }
  return value
}

/** Item-level op 4 of 218 on a NON-weapon list (adds to its 22/24/160; D2StatList.cpp:286-307). */
function listStat(get: StatReader, stat: number, clvl: number): number {
  let value = get(stat)
  if (value === 0) {
    if (stat === S.SECONDARY_MINDAMAGE || stat === S.ITEM_THROW_MINDAMAGE) {
      value = get(S.MINDAMAGE)
    } else if (stat === S.SECONDARY_MAXDAMAGE || stat === S.ITEM_THROW_MAXDAMAGE) {
      value = get(S.MAXDAMAGE)
    }
  }
  if (MAX_DAMAGE_STATS.has(stat) && clvl > 0) {
    const perLevel = get(S.ITEM_MAXDAMAGE_PERLEVEL)
    if (perLevel !== 0) value += Math.imul(clvl, perLevel) >> ITEM_PER_LEVEL_SHIFT
  }
  return value
}

/**
 * The unit's total of a stat for one attack (STATLIST_UnitGetStatValue after `sub_6FC7C900`): Σ of
 * the non-arm lists + arm items, where an un-merged weapon (STATLIST_DYNAMIC) contributes no
 * damagerelated stat (D2StatList.cpp:183-191), then the unit-level op 2 per-level stats.
 */
function makeUnitView(input: CombatInput, merged: Record<Side, boolean>, withStates: boolean): StatReader {
  const cache = new Map<number, number>()
  const preOp = (stat: number): number => {
    let total = 0
    for (const list of input.lists) {
      if (!withStates && list.kind === 'state') continue
      total += listStat(list.get, stat, input.clvl)
    }
    for (const side of ['right', 'left'] as const) {
      const item = arm(input, side)
      // Broken / unequippable items contribute nothing (rule 15).
      if (!item || !item.canBeEquipped) continue
      if (!isWeaponItem(item)) {
        total += listStat(item.localRaw, stat, input.clvl)
        continue
      }
      if (WEAPON_LOCAL_OP_STATS.has(stat)) continue
      if (!merged[side] && input.isDamageRelated(stat)) continue
      total += WEAPON_DAMAGE_STATS.has(stat) ? weaponLocalDamage(item, stat, input.clvl) : item.localRaw(stat)
    }
    return assertInt(total, `stat ${stat}`)
  }
  return (stat: number): number => {
    const hit = cache.get(stat)
    if (hit !== undefined) return hit
    let value = preOp(stat)
    if (input.clvl > 0) {
      for (const op of UNIT_PER_LEVEL_OPS) {
        if (op.target !== stat) continue
        const source = preOp(op.source)
        if (source !== 0) value += Math.imul(input.clvl, source) >> op.shift
      }
    }
    cache.set(stat, value)
    return value
  }
}

// ─── Masteries ────────────────────────────────────────────────────────────────────────────────────

/** D2Common_11024 predicate (D2Skills.cpp:3036-3037): throwable item + thrown-type skill + range rng. */
function isThrowAttack(item: CombatArmItem & { readonly weapon: CombatWeaponRow }, skill: CombatSkillInput): boolean {
  return item.weapon.throwable && skill.itypeA1IsThrown && skill.range === 'rng'
}

/** SKILLS_GetWeaponMasteryBonus (D2Skills.cpp:3073-3110): max matching layer value, floor 0. */
export function weaponMasteryBonus(
  input: Pick<CombatInput, 'masteries'>,
  item: CombatArmItem & { readonly weapon: CombatWeaponRow },
  skill: CombatSkillInput,
  kind: 'tohit' | 'damage' | 'crit',
): number {
  const thrown = isThrowAttack(item, skill)
  const statId = thrown
    ? kind === 'tohit'
      ? S.PASSIVE_MASTERY_THROW_TH
      : kind === 'damage'
        ? S.PASSIVE_MASTERY_THROW_DMG
        : S.PASSIVE_MASTERY_THROW_CRIT
    : kind === 'tohit'
      ? S.PASSIVE_MASTERY_MELEE_TH
      : kind === 'damage'
        ? S.PASSIVE_MASTERY_MELEE_DMG
        : S.PASSIVE_MASTERY_MELEE_CRIT
  let best = 0
  for (const m of input.masteries) {
    if (m.statId === statId && item.isType(m.itemType) && m.value > best) best = m.value
  }
  return best
}

export interface CombatBlockInput {
  readonly charClass?: CharacterClassCode | undefined
  readonly clvl?: number | undefined
  readonly dexterity?: number | undefined
  readonly rightArm?: CombatArmItem | null | undefined
  readonly leftArm?: CombatArmItem | null | undefined
  readonly lists?: readonly CombatStatList[] | undefined
  readonly isDualClaw?: boolean | undefined
  readonly hasShield?: boolean | undefined
  readonly shieldBlock?: number | undefined
  readonly toBlock?: number | undefined
  readonly passiveWeaponBlock?: number | undefined
  readonly weaponBlockSlvl?: number | undefined
  readonly isWalking?: boolean | undefined
  readonly isRunning?: boolean | undefined
  readonly isMoving?: boolean | undefined
}

/**
 * 1.13c Chance to Block (`UNITS_GetBlockRate` / `SUNITDMG_ApplyDodge` + `SUNITDMG_GetWeaponBlock`):
 * - When dual-wielding claws (`h2h` / `h2h2` x2) without a shield, returns `passive_weaponblock`
 *   (stat `348`, `#263 Weapon Block`; not scaled by Dexterity, and `0%` while walking or running).
 * - When equipping a shield, returns `clamp(floor((shieldBlock + toblock) * (dex - 15) / (2 * clvl)), 0, 75)`
 *   (reduced to 1/3 while running).
 */
export function chanceToBlock(
  input: CombatBlockInput,
  options?: { isWalking?: boolean; isRunning?: boolean; isMoving?: boolean },
): number {
  const isWalking = Boolean(options?.isWalking ?? input.isWalking)
  const isRunning = Boolean(options?.isRunning ?? input.isRunning)
  const isMoving = Boolean(options?.isMoving ?? input.isMoving)

  const right = input.rightArm ?? null
  const left = input.leftArm ?? null
  const isClawArm = (item: CombatArmItem | null): boolean =>
    Boolean(item && item.canBeEquipped !== false && item.weapon !== null && (item.isType('h2h') || item.isType('h2h2')))
  const isShieldArm = (item: CombatArmItem | null): boolean =>
    Boolean(item && item.canBeEquipped !== false && item.weapon === null && (item.component === 7 || item.isType('shie') || item.isType('shld') || item.isType('ashd') || item.isType('pala') || item.isType('head')))

  const hasShield = input.hasShield ?? (isShieldArm(right) || isShieldArm(left) || (input.shieldBlock ?? 0) > 0)
  const dualClaw = input.isDualClaw ?? (!hasShield && isClawArm(right) && isClawArm(left))

  let listWeaponBlock = 0
  let listToBlock = 0
  if (input.lists) {
    for (const l of input.lists) {
      listWeaponBlock += l.get(S.PASSIVE_WEAPONBLOCK)
      listToBlock += l.get(S.TOBLOCK)
    }
  }

  if (dualClaw && !hasShield) {
    if (isWalking || isRunning || isMoving) return 0
    let wb = (input.passiveWeaponBlock ?? 0) + listWeaponBlock
    if (wb <= 0 && (input.weaponBlockSlvl ?? 0) > 0) {
      const slvl = input.weaponBlockSlvl!
      wb = Math.min(65, 20 + Math.trunc(Math.trunc((45 * 110 * slvl) / (slvl + 6)) / 100))
    }
    if (wb <= 0) return 0
    const totalWb = wb + (input.toBlock ?? 0) + listToBlock
    return Math.min(75, Math.max(0, totalWb))
  }

  if (!hasShield) return 0
  const shieldArm = isShieldArm(left) ? left : isShieldArm(right) ? right : null
  const shieldBaseBlock = input.shieldBlock ?? (shieldArm ? shieldArm.localRaw(S.TOBLOCK) : 0)
  const totalBlock = shieldBaseBlock + (input.toBlock ?? 0) + listToBlock
  if (totalBlock <= 0) return 0
  const dex = input.dexterity ?? 15
  const clvl = Math.max(1, input.clvl ?? 1)
  const raw = Math.min(75, Math.max(0, idiv(totalBlock * Math.max(0, dex - 15), 2 * clvl)))
  return isRunning ? idiv(raw, 3) : raw
}

// ─── Attack rating ────────────────────────────────────────────────────────────────────────────────

function attackRatingFor(
  input: CombatInput,
  skill: CombatSkillInput,
  selected: Side | null,
  unit: StatReader,
  dexterity: number,
): number {
  // UNITS_GetAttackRate (Units.cpp:2394-2418).
  const base = unit(S.TOHIT) + 5 * (dexterity - 7) + input.toHitFactor
  // SUnitDmg.cpp:2507-2516: mastery (selected weapon) + skill ToHit + item_tohit_percent.
  const item = selected === null ? null : arm(input, selected)
  const mastery = isWeaponItem(item) ? weaponMasteryBonus(input, item, skill, 'tohit') : 0
  const pct = mastery + skill.toHitPercent + unit(S.ITEM_TOHIT_PERCENT)
  return base + calculatePercentage(base, pct, 100)
}

// ─── Damage ───────────────────────────────────────────────────────────────────────────────────────

/** Weapon attack vs spell: Skills.txt `Kick`, `SrcDam` or `itypea1` set (damage goes through SUNITDMG). */
function isWeaponSkill(skill: CombatSkillInput): boolean {
  return (
    skill.kick ||
    skill.srcDam > 0 ||
    skill.itypeA1 !== '' ||
    (skill.flatPhysMax ?? 0) > 0 ||
    (skill.skillElemMax ?? 0) > 0
  )
}

/** SUnitDmg.cpp:256-259. */
function effectiveSrcDam(skill: CombatSkillInput): number {
  return skill.srcDam === 0 ? 128 : skill.srcDam
}

function effectiveSkillPhys256(skill: CombatSkillInput): { min: number; max: number } {
  const min256 =
    skill.skillPhysical256.min !== 0
      ? skill.skillPhysical256.min
      : Math.max(0, Math.trunc(skill.flatPhysMin ?? 0)) << 8
  const max256 =
    skill.skillPhysical256.max !== 0
      ? skill.skillPhysical256.max
      : Math.max(0, Math.trunc(skill.flatPhysMax ?? 0)) << 8
  return { min: min256, max: max256 }
}

function resolveSkillElemChannel(
  type: string | undefined,
): 'fire' | 'cold' | 'light' | 'magic' | 'poison' {
  switch ((type ?? '').toLowerCase()) {
    case 'fire':
      return 'fire'
    case 'cold':
      return 'cold'
    case 'pois':
    case 'poison':
      return 'poison'
    case 'mag':
    case 'magic':
      return 'magic'
    case 'ltng':
    case 'light':
    case 'lightning':
    default:
      return 'light'
  }
}

/** SUNITDMG_ApplyDamageBonuses (SUnitDmg.cpp:146-246) bounds, before srcdam; 1/256 units. */
function physicalRange256(
  input: CombatInput,
  skill: CombatSkillInput,
  selected: Side | null,
  unit: StatReader,
): { min: number; max: number } {
  const item = selected === null ? null : arm(input, selected)
  let min: number
  let max: number
  let pct = skill.damagePercent + unit(S.DAMAGEPERCENT)
  if (isWeaponItem(item)) {
    if (isThrowAttack(item, skill)) {
      // Thrown weapons: STATLIST_GetMin/MaxThrowDamageFromUnit (D2StatList.cpp:2121-2134), rule 17.
      min = unit(S.ITEM_THROW_MINDAMAGE) << 8
      max = unit(S.ITEM_THROW_MAXDAMAGE) << 8
    } else if (wieldType(input) === 2) {
      min = unit(S.SECONDARY_MINDAMAGE) << 8
      max = unit(S.SECONDARY_MAXDAMAGE) << 8
    } else {
      min = unit(S.MINDAMAGE) << 8
      max = unit(S.MAXDAMAGE) << 8
    }
    if (item.weapon.strBonus !== 0) pct += idiv(item.weapon.strBonus * input.strength, 100)
    if (item.weapon.dexBonus !== 0) pct += idiv(item.weapon.dexBonus * input.dexterity, 100)
    pct += weaponMasteryBonus(input, item, skill, 'damage')
  } else {
    // Unarmed (SUnitDmg.cpp:172-179, 219-222): at least 1-2, + strength %.
    min = Math.max(unit(S.MINDAMAGE), 1) << 8
    max = Math.max(unit(S.MAXDAMAGE), 2) << 8
    pct += input.strength
  }
  const normal = unit(S.ITEM_NORMALDAMAGE) << 8
  let totalMin = normal + min
  let totalMax = normal + max
  if (totalMin < 1) totalMin = 256
  if (totalMax <= totalMin) totalMax = totalMin + 256
  pct = Math.max(pct, -90)
  if (totalMax > 0) {
    const unitMinPct = unit(S.ITEM_MINDAMAGE_PERCENT) || unit(S.ITEM_MAXDAMAGE_PERCENT)
    totalMin += calculatePercentage(totalMin, pct + unitMinPct, 100)
    totalMax += calculatePercentage(totalMax, pct + unit(S.ITEM_MAXDAMAGE_PERCENT), 100)
  }
  return { min: totalMin, max: totalMax }
}

/** Kick physical damage (D2Skills.cpp:2501-2517/2567-2584, SkillAss.cpp:1192-1210, D2Skills.cpp:3540-3630). */
function kickRange256(input: CombatInput, skill: CombatSkillInput, unit: StatReader): { min: number; max: number } {
  const n = Math.max(input.dexterity + input.strength - 20, 1)
  const baseMin = idiv(n, 4) << 8
  const baseMax = idiv(n, 3) << 8
  let min = baseMin + calculatePercentage(baseMin, skill.damagePercent, 100)
  let max = baseMax + calculatePercentage(baseMax, skill.damagePercent, 100)
  // SKILLS_CalculateKickDamage: kick stats + boots, both weapons un-merged.
  const kick = unit(S.ITEM_KICKDAMAGE)
  let kickMin = kick
  let kickMax = kick
  let pct = skill.damagePercent + unit(S.ITEM_MAXDAMAGE_PERCENT)
  if (input.boots) {
    const b = input.boots
    let nMin = kick + b.minDam
    let nMax = kick + b.maxDam
    let bootsPct = unit(S.DAMAGEPERCENT)
    if (b.strBonus !== 0) bootsPct += idiv(b.strBonus * input.strength, 100)
    if (b.dexBonus !== 0) bootsPct += idiv(b.dexBonus * input.dexterity, 100)
    bootsPct = Math.max(bootsPct, -90)
    if (nMin >= nMax) nMax = nMin
    pct += bootsPct
    // The boots range is added on top of the kick stat already counted above (faithful double count).
    kickMin += nMin
    kickMax += nMax
  }
  min += calculatePercentage(kickMin << 8, pct, 100) + (kickMin << 8)
  max += calculatePercentage(kickMax << 8, pct, 100) + (kickMax << 8)
  return { min, max }
}

/** One element add (SUnitDmg.cpp:351-481): masteries on the 1/256 bounds, srcdam on each bound. */
function elementRange(unit: StatReader, minStat: number, maxStat: number, masteryStat: number, srcDam: number): { min: number; max: number } {
  const max256 = unit(maxStat) << 8
  if (max256 < 8) return { min: 0, max: 0 }
  const min256 = unit(minStat) << 8
  const mastery = unit(masteryStat)
  let lo = Math.max(min256 + calculatePercentage(min256, mastery, 100), 0)
  let hi = Math.max(max256 + calculatePercentage(max256, mastery, 100), 0)
  if (srcDam !== 128) {
    lo = idiv(Math.imul(lo, srcDam), 128)
    hi = idiv(Math.imul(hi, srcDam), 128)
  }
  return { min: lo >> 8, max: hi >> 8 }
}

/** Poison add (SUnitDmg.cpp:593-628) displayed over its duration: floor(rate · length / 256). */
function poisonRange(unit: StatReader, srcDam: number): { min: number; max: number } {
  let lo = unit(S.POISONMINDAM)
  let hi = unit(S.POISONMAXDAM)
  if (hi <= 0) return { min: 0, max: 0 }
  const mastery = unit(S.PASSIVE_POIS_MASTERY)
  lo += calculatePercentage(lo, mastery, 100)
  hi += calculatePercentage(hi, mastery, 100)
  lo = idiv(Math.max(lo, 0) * srcDam, 128)
  hi = idiv(Math.max(hi, 0) * srcDam, 128)
  const override = unit(S.SKILL_POISON_OVERRIDE_LENGTH)
  let length: number
  if (override <= 0) {
    length = unit(S.POISONLENGTH)
    const count = unit(S.POISON_COUNT)
    if (count > 1) length = idiv(length, count)
  } else {
    length = override
  }
  return { min: Math.floor((lo * length) / 256), max: Math.floor((hi * length) / 256) }
}

const NO_DAMAGE: CombatDamageComponents = {
  kind: 'none',
  physMin: 0, physMax: 0, fireMin: 0, fireMax: 0, coldMin: 0, coldMax: 0,
  lightMin: 0, lightMax: 0, magicMin: 0, magicMax: 0, poisonMin: 0, poisonMax: 0,
}

function damageFor(input: CombatInput, skill: CombatSkillInput, selected: Side | null, unit: StatReader): CombatDamageComponents {
  if (skill.level <= 0) return NO_DAMAGE
  if (!isWeaponSkill(skill)) {
    if (skill.spellDamage === null) return NO_DAMAGE
    return {
      ...NO_DAMAGE,
      kind: 'spell',
      physMin: assertInt(skill.spellDamage.min, 'spell min'),
      physMax: assertInt(skill.spellDamage.max, 'spell max'),
    }
  }
  let srcDam = effectiveSrcDam(skill)
  const selectedItem = selected === null ? null : arm(input, selected)
  const isTwoHandedSelected =
    isWeaponItem(selectedItem) && selectedItem.weapon.twoHanded && wieldType(input) === 2
  if (isTwoHandedSelected) {
    if (skill.id === 257 && srcDam === 48) srcDam = 24
    if (skill.id === 266 && srcDam === 96) srcDam = 48
  }
  let phys: { min: number; max: number }
  const skillPhys256 = effectiveSkillPhys256(skill)
  if (skill.kick) {
    // Kicks: the physical part is precomputed (SkillAss.cpp:1192-1240, srcdam 128).
    phys = kickRange256(input, skill, unit)
  } else if (skill.id === 266) {
    // #266 Blade Fury (descdam = 24): weapon damage is scaled by srcDam/128, then skill flat physical added at 100%
    const range = physicalRange256(input, skill, selected, unit)
    let lo = Math.max(range.min, 0)
    let hi = Math.max(range.max, 0)
    if (srcDam !== 128) {
      lo = calculatePercentage(lo, srcDam, 128)
      hi = calculatePercentage(hi, srcDam, 128)
    }
    lo = Math.max(lo + skillPhys256.min, 0)
    hi = Math.max(hi + skillPhys256.max, 0)
    phys = { min: lo, max: hi }
  } else {
    const range = physicalRange256(input, skill, selected, unit)
    // nDamage (the skill's own physical damage) is added to the roll, floored at 0, then srcdam.
    let lo = Math.max(range.min + skillPhys256.min, 0)
    let hi = Math.max(range.max + skillPhys256.max, 0)
    if (srcDam !== 128) {
      lo = calculatePercentage(lo, srcDam, 128)
      hi = calculatePercentage(hi, srcDam, 128)
    }
    phys = { min: lo, max: hi }
  }
  const convPct = Math.max(0, Math.min(100, skill.magicConversionPct ?? 0))
  let convMagicMin = 0
  let convMagicMax = 0
  if (convPct > 0) {
    const convMin256 = calculatePercentage(phys.min, convPct, 100)
    const convMax256 = calculatePercentage(phys.max, convPct, 100)
    phys = {
      min: Math.max(0, phys.min - convMin256),
      max: Math.max(0, phys.max - convMax256),
    }
    convMagicMin = convMin256 >> 8
    convMagicMax = convMax256 >> 8
  }
  const elemSrcDam = skill.kick ? 128 : srcDam
  const fire = elementRange(unit, S.FIREMINDAM, S.FIREMAXDAM, S.PASSIVE_FIRE_MASTERY, elemSrcDam)
  const light = elementRange(unit, S.LIGHTMINDAM, S.LIGHTMAXDAM, S.PASSIVE_LTNG_MASTERY, elemSrcDam)
  const cold = elementRange(unit, S.COLDMINDAM, S.COLDMAXDAM, S.PASSIVE_COLD_MASTERY, elemSrcDam)
  const magic = elementRange(unit, S.MAGICMINDAM, S.MAGICMAXDAM, S.PASSIVE_MAG_MASTERY, elemSrcDam)
  const poison = poisonRange(unit, elemSrcDam)
  const skillElemMin = Math.max(0, Math.trunc(skill.skillElemMin ?? 0))
  const skillElemMax = Math.max(0, Math.trunc(skill.skillElemMax ?? 0))
  const elemChannel = resolveSkillElemChannel(skill.skillElemType)
  return {
    kind: 'weapon',
    physMin: phys.min >> 8,
    physMax: phys.max >> 8,
    fireMin: fire.min + (skillElemMax > 0 && elemChannel === 'fire' ? skillElemMin : 0),
    fireMax: fire.max + (skillElemMax > 0 && elemChannel === 'fire' ? skillElemMax : 0),
    coldMin: cold.min + (skillElemMax > 0 && elemChannel === 'cold' ? skillElemMin : 0),
    coldMax: cold.max + (skillElemMax > 0 && elemChannel === 'cold' ? skillElemMax : 0),
    lightMin: light.min + (skillElemMax > 0 && elemChannel === 'light' ? skillElemMin : 0),
    lightMax: light.max + (skillElemMax > 0 && elemChannel === 'light' ? skillElemMax : 0),
    magicMin: magic.min + convMagicMin + (skillElemMax > 0 && elemChannel === 'magic' ? skillElemMin : 0),
    magicMax: magic.max + convMagicMax + (skillElemMax > 0 && elemChannel === 'magic' ? skillElemMax : 0),
    poisonMin: poison.min + (skillElemMax > 0 && elemChannel === 'poison' ? skillElemMin : 0),
    poisonMax: poison.max + (skillElemMax > 0 && elemChannel === 'poison' ? skillElemMax : 0),
  }
}

/** The one function that composes the displayed damage text from the components (rule 17). */
export function composeDamageText(d: CombatDamageComponents): string {
  if (d.kind === 'none') return '--'
  const min = d.physMin + d.fireMin + d.coldMin + d.lightMin + d.magicMin + d.poisonMin
  const max = d.physMax + d.fireMax + d.coldMax + d.lightMax + d.magicMax + d.poisonMax
  return `${min}-${max}`
}

/** Rule 16: red if any active state has the red column, else blue if any has the blue column. */
function flagColor(input: CombatInput, red: CombatStateColorFlag, blue: CombatStateColorFlag): CombatColor {
  if (input.hasStateColorFlag(red)) return 'red'
  return input.hasStateColorFlag(blue) ? 'blue' : 'white'
}

function buildFormulaBreakdown(
  input: CombatInput,
  skill: CombatSkillInput,
  selected: Side | null,
  unit: StatReader,
  unitWithoutStates: StatReader,
  damage: CombatDamageComponents,
): CombatDamageFormulaBreakdown {
  const finalMin = damage.physMin + damage.fireMin + damage.coldMin + damage.lightMin + damage.magicMin + damage.poisonMin
  const finalMax = damage.physMax + damage.fireMax + damage.coldMax + damage.lightMax + damage.magicMax + damage.poisonMax

  if (damage.kind === 'none') {
    return {
      kind: 'none',
      skillId: skill.id,
      weaponMin: 0,
      weaponMax: 0,
      offWeaponFlatMin: 0,
      offWeaponFlatMax: 0,
      physBaseMin: 0,
      physBaseMax: 0,
      strEdPct: 0,
      dexEdPct: 0,
      masteryEdPct: 0,
      skillEdPct: 0,
      gearEdPct: 0,
      auraEdPct: 0,
      totalMinEdPct: 0,
      totalMaxEdPct: 0,
      skillPhysMin: 0,
      skillPhysMax: 0,
      srcDam: 128,
      magicConversionPct: 0,
      physMin: 0,
      physMax: 0,
      fireMin: 0,
      fireMax: 0,
      coldMin: 0,
      coldMax: 0,
      lightMin: 0,
      lightMax: 0,
      magicMin: 0,
      magicMax: 0,
      poisonMin: 0,
      poisonMax: 0,
      skillElemMin: 0,
      skillElemMax: 0,
      skillElemType: undefined,
      finalMin: 0,
      finalMax: 0,
    }
  }

  if (damage.kind === 'spell') {
    const sb: CombatSpellDamageBreakdown = skill.spellBreakdown ?? {
      spellType: 'magic',
      baseMin: damage.physMin,
      baseMax: damage.physMax,
      synergyBonusPct: 0,
      withSynergyMin: damage.physMin,
      withSynergyMax: damage.physMax,
      masteryBonusPct: 0,
      equipSpellDamagePct: 0,
      auraBonusPct: 0,
      finalMin: damage.physMin,
      finalMax: damage.physMax,
    }
    return {
      kind: 'spell',
      skillId: skill.id,
      weaponMin: 0,
      weaponMax: 0,
      offWeaponFlatMin: 0,
      offWeaponFlatMax: 0,
      physBaseMin: sb.baseMin,
      physBaseMax: sb.baseMax,
      strEdPct: 0,
      dexEdPct: 0,
      masteryEdPct: sb.masteryBonusPct,
      skillEdPct: sb.synergyBonusPct,
      gearEdPct: sb.equipSpellDamagePct,
      auraEdPct: sb.auraBonusPct,
      totalMinEdPct: sb.masteryBonusPct + sb.equipSpellDamagePct + sb.auraBonusPct,
      totalMaxEdPct: sb.masteryBonusPct + sb.equipSpellDamagePct + sb.auraBonusPct,
      skillPhysMin: 0,
      skillPhysMax: 0,
      srcDam: 128,
      magicConversionPct: 0,
      physMin: damage.physMin,
      physMax: damage.physMax,
      fireMin: 0,
      fireMax: 0,
      coldMin: 0,
      coldMax: 0,
      lightMin: 0,
      lightMax: 0,
      magicMin: 0,
      magicMax: 0,
      poisonMin: 0,
      poisonMax: 0,
      skillElemMin: 0,
      skillElemMax: 0,
      skillElemType: undefined,
      spellBreakdown: sb,
      finalMin,
      finalMax,
    }
  }

  const skillPhys256 = effectiveSkillPhys256(skill)
  const skillElemMin = Math.max(0, Math.trunc(skill.skillElemMin ?? 0))
  const skillElemMax = Math.max(0, Math.trunc(skill.skillElemMax ?? 0))
  const skillElemType = skill.skillElemType
  const elemChannel = resolveSkillElemChannel(skillElemType)
  const eqFireMin = Math.max(0, damage.fireMin - (skillElemMax > 0 && elemChannel === 'fire' ? skillElemMin : 0))
  const eqFireMax = Math.max(0, damage.fireMax - (skillElemMax > 0 && elemChannel === 'fire' ? skillElemMax : 0))
  const eqColdMin = Math.max(0, damage.coldMin - (skillElemMax > 0 && elemChannel === 'cold' ? skillElemMin : 0))
  const eqColdMax = Math.max(0, damage.coldMax - (skillElemMax > 0 && elemChannel === 'cold' ? skillElemMax : 0))
  const eqLightMin = Math.max(0, damage.lightMin - (skillElemMax > 0 && elemChannel === 'light' ? skillElemMin : 0))
  const eqLightMax = Math.max(0, damage.lightMax - (skillElemMax > 0 && elemChannel === 'light' ? skillElemMax : 0))
  const eqMagicMin = Math.max(0, damage.magicMin - (skillElemMax > 0 && elemChannel === 'magic' ? skillElemMin : 0))
  const eqMagicMax = Math.max(0, damage.magicMax - (skillElemMax > 0 && elemChannel === 'magic' ? skillElemMax : 0))
  const eqPoisonMin = Math.max(0, damage.poisonMin - (skillElemMax > 0 && elemChannel === 'poison' ? skillElemMin : 0))
  const eqPoisonMax = Math.max(0, damage.poisonMax - (skillElemMax > 0 && elemChannel === 'poison' ? skillElemMax : 0))

  const gearMaxEd = unitWithoutStates(S.DAMAGEPERCENT) + unitWithoutStates(S.ITEM_MAXDAMAGE_PERCENT)
  const auraMaxEd = unit(S.DAMAGEPERCENT) + unit(S.ITEM_MAXDAMAGE_PERCENT) - gearMaxEd

  if (skill.kick) {
    const n = Math.max(input.dexterity + input.strength - 20, 1)
    const kickStat = unit(S.ITEM_KICKDAMAGE)
    const bootsMin = input.boots ? input.boots.minDam + kickStat * 2 : kickStat
    const bootsMax = input.boots ? input.boots.maxDam + kickStat * 2 : kickStat
    const weaponMin = idiv(n, 4) + bootsMin
    const weaponMax = idiv(n, 3) + bootsMax
    const strEdPct = input.boots && input.boots.strBonus !== 0 ? idiv(input.boots.strBonus * input.strength, 100) : 0
    const dexEdPct = input.boots && input.boots.dexBonus !== 0 ? idiv(input.boots.dexBonus * input.dexterity, 100) : 0
    const totalEd = skill.damagePercent + strEdPct + dexEdPct + gearMaxEd + auraMaxEd
    return {
      kind: 'kick',
      skillId: skill.id,
      weaponMin,
      weaponMax,
      offWeaponFlatMin: 0,
      offWeaponFlatMax: 0,
      physBaseMin: weaponMin,
      physBaseMax: weaponMax,
      strEdPct,
      dexEdPct,
      masteryEdPct: 0,
      skillEdPct: skill.damagePercent,
      gearEdPct: gearMaxEd,
      auraEdPct: auraMaxEd,
      totalMinEdPct: totalEd,
      totalMaxEdPct: totalEd,
      skillPhysMin: 0,
      skillPhysMax: 0,
      srcDam: 128,
      magicConversionPct: Math.max(0, Math.min(100, skill.magicConversionPct ?? 0)),
      physMin: damage.physMin,
      physMax: damage.physMax,
      fireMin: eqFireMin,
      fireMax: eqFireMax,
      coldMin: eqColdMin,
      coldMax: eqColdMax,
      lightMin: eqLightMin,
      lightMax: eqLightMax,
      magicMin: eqMagicMin,
      magicMax: eqMagicMax,
      poisonMin: eqPoisonMin,
      poisonMax: eqPoisonMax,
      skillElemMin,
      skillElemMax,
      skillElemType,
      finalMin,
      finalMax,
    }
  }

  const item = selected === null ? null : arm(input, selected)
  const normal = unit(S.ITEM_NORMALDAMAGE)
  let weaponMin: number
  let weaponMax: number
  let rawMin: number
  let rawMax: number
  let strEdPct = 0
  let dexEdPct = 0
  let masteryEdPct = 0

  if (isWeaponItem(item)) {
    let minStat: number = S.MINDAMAGE
    let maxStat: number = S.MAXDAMAGE
    if (isThrowAttack(item, skill)) {
      minStat = S.ITEM_THROW_MINDAMAGE
      maxStat = S.ITEM_THROW_MAXDAMAGE
    } else if (wieldType(input) === 2) {
      minStat = S.SECONDARY_MINDAMAGE
      maxStat = S.SECONDARY_MAXDAMAGE
    }
    weaponMin = weaponLocalDamage(item, minStat, input.clvl)
    weaponMax = weaponLocalDamage(item, maxStat, input.clvl)
    rawMin = unit(minStat)
    rawMax = unit(maxStat)
    if (item.weapon.strBonus !== 0) strEdPct = idiv(item.weapon.strBonus * input.strength, 100)
    if (item.weapon.dexBonus !== 0) dexEdPct = idiv(item.weapon.dexBonus * input.dexterity, 100)
    masteryEdPct = weaponMasteryBonus(input, item, skill, 'damage')
  } else {
    weaponMin = 1
    weaponMax = 2
    rawMin = Math.max(unit(S.MINDAMAGE), 1)
    rawMax = Math.max(unit(S.MAXDAMAGE), 2)
    strEdPct = input.strength
  }

  const physBaseMin = Math.max(1, rawMin + normal)
  const physBaseMax = Math.max(physBaseMin + 1, rawMax + normal)
  const offWeaponFlatMin = physBaseMin - weaponMin
  const offWeaponFlatMax = physBaseMax - weaponMax
  const skillEdPct = skill.damagePercent
  const basePct = Math.max(skillEdPct + unit(S.DAMAGEPERCENT) + strEdPct + dexEdPct + masteryEdPct, -90)
  const unitMinPct = unit(S.ITEM_MINDAMAGE_PERCENT) || unit(S.ITEM_MAXDAMAGE_PERCENT)
  const unitMaxPct = unit(S.ITEM_MAXDAMAGE_PERCENT)

  return {
    kind: 'weapon',
    skillId: skill.id,
    weaponMin,
    weaponMax,
    offWeaponFlatMin,
    offWeaponFlatMax,
    physBaseMin,
    physBaseMax,
    strEdPct,
    dexEdPct,
    masteryEdPct,
    skillEdPct,
    gearEdPct: gearMaxEd,
    auraEdPct: auraMaxEd,
    totalMinEdPct: basePct + unitMinPct,
    totalMaxEdPct: basePct + unitMaxPct,
    skillPhysMin: skillPhys256.min >> 8,
    skillPhysMax: skillPhys256.max >> 8,
    srcDam:
      isWeaponItem(item) && item.weapon.twoHanded && wieldType(input) === 2
        ? skill.id === 257 && effectiveSrcDam(skill) === 48
          ? 24
          : skill.id === 266 && effectiveSrcDam(skill) === 96
            ? 48
            : effectiveSrcDam(skill)
        : effectiveSrcDam(skill),
    magicConversionPct: Math.max(0, Math.min(100, skill.magicConversionPct ?? 0)),
    physMin: damage.physMin,
    physMax: damage.physMax,
    fireMin: eqFireMin,
    fireMax: eqFireMax,
    coldMin: eqColdMin,
    coldMax: eqColdMax,
    lightMin: eqLightMin,
    lightMax: eqLightMax,
    magicMin: eqMagicMin,
    magicMax: eqMagicMax,
    poisonMin: eqPoisonMin,
    poisonMax: eqPoisonMax,
    skillElemMin,
    skillElemMax,
    skillElemType,
    finalMin,
    finalMax,
  }
}

function handStats(input: CombatInput, skill: CombatSkillInput): CombatHandStats {
  const selected = isWeaponSkill(skill) && skill.kick ? null : selectSkillWeapon(input, skill)
  const merged = mergedArms(input, skill, skill.kick ? null : selected)
  const unit = makeUnitView(input, merged, true)
  const unitWithoutStates = makeUnitView(input, merged, false)
  const damage = damageFor(input, skill, selected, unit)
  const formulaBreakdown = buildFormulaBreakdown(input, skill, selected, unit, unitWithoutStates, damage)
  return {
    attackRating: attackRatingFor(input, skill, selected, unit, input.dexterity),
    baseAttackRating: attackRatingFor(input, skill, selected, unitWithoutStates, input.dexterityWithoutStates),
    attackRatingColor: flagColor(input, 'attred', 'attblue'),
    damage,
    damageText: composeDamageText(damage),
    damageColor: flagColor(input, 'damred', 'damblue'),
    weaponArm: selected,
    formulaBreakdown,
  }
}

function validateInput(input: CombatInput): void {
  assertInt(input.clvl, 'clvl')
  assertInt(input.toHitFactor, 'toHitFactor')
  assertInt(input.strength, 'strength')
  assertInt(input.dexterity, 'dexterity')
  assertInt(input.dexterityWithoutStates, 'dexterityWithoutStates')
  for (const skill of [input.leftSkill, input.rightSkill]) {
    assertInt(skill.level, `skill ${skill.id} level`)
    assertInt(skill.toHitPercent, `skill ${skill.id} toHitPercent`)
    assertInt(skill.damagePercent, `skill ${skill.id} damagePercent`)
    if (skill.srcDam < 0 || skill.srcDam > 255) throw new Error(`combat-stats: skill ${skill.id} SrcDam ${skill.srcDam} out of byte range`)
  }
  for (const side of ['right', 'left'] as const) {
    const item = arm(input, side)
    if (!item || item.weapon === null) continue
    for (const v of [item.weapon.minDam, item.weapon.maxDam, item.weapon.twoHandMinDam, item.weapon.twoHandMaxDam,
      item.weapon.minMisDam, item.weapon.maxMisDam, item.weapon.strBonus, item.weapon.dexBonus]) {
      assertInt(v, `Weapons.txt value of ${item.weapon.code}`)
    }
  }
  // Fail fast on an inconsistent primary weapon (throws when invalid).
  primaryWeaponSide(input)
}

/** Character-sheet AR / damage / colours for the left and right skill (rule 22 field names). */
export function computeCombatStats(input: CombatInput): CombatStats {
  validateInput(input)
  const left = handStats(input, input.leftSkill)
  const right = handStats(input, input.rightSkill)
  return {
    attackRating: left.attackRating,
    baseAttackRating: left.baseAttackRating,
    attackRatingColor: left.attackRatingColor,
    rightAttackRating: right.attackRating,
    baseRightAttackRating: right.baseAttackRating,
    rightAttackRatingColor: right.attackRatingColor,
    leftSkillDmg: left.damageText,
    rightSkillDmg: right.damageText,
    leftSkillDmgColor: left.damageColor,
    rightSkillDmgColor: right.damageColor,
    left,
    right,
  }
}

export interface ActiveWeaponStatGainInfo {
  readonly strBonus: number
  readonly dexBonus: number
  readonly basePhysMin: number
  readonly basePhysMax: number
  readonly isRanged: boolean
  readonly arPctBonus: number
}

/**
 * Computes the active weapon's 1.13c `StrBonus`, `DexBonus`, base physical damage range
 * (`SUNITDMG_ApplyDamageBonuses` pre-%ED physical range), ranged/thrown weapon flag, and
 * `%AR` bonus (`SKILLS_GetToHitFactor` + `ITEM_TOHIT_PERCENT` + weapon mastery).
 */
export function computeActiveWeaponStatGainInfo(input: CombatInput): ActiveWeaponStatGainInfo {
  validateInput(input)
  const skill = input.leftSkill
  const selected = selectSkillWeapon(input, skill) ?? equippedWeaponSide(input)
  const merged = mergedArms(input, skill, selected)
  const unit = makeUnitView(input, merged, true)
  const normal = unit(S.ITEM_NORMALDAMAGE)
  const item = selected === null ? null : arm(input, selected)
  if (isWeaponItem(item)) {
    const thrown = isThrowAttack(item, skill)
    let rawMin: number
    let rawMax: number
    if (thrown) {
      rawMin = unit(S.ITEM_THROW_MINDAMAGE)
      rawMax = unit(S.ITEM_THROW_MAXDAMAGE)
    } else if (wieldType(input) === 2) {
      rawMin = unit(S.SECONDARY_MINDAMAGE)
      rawMax = unit(S.SECONDARY_MAXDAMAGE)
    } else {
      rawMin = unit(S.MINDAMAGE)
      rawMax = unit(S.MAXDAMAGE)
    }
    const basePhysMin = Math.max(1, rawMin + normal)
    const basePhysMax = Math.max(basePhysMin + 1, rawMax + normal)
    const masteryAr = weaponMasteryBonus(input, item, skill, 'tohit')
    const arPctBonus = masteryAr + skill.toHitPercent + unit(S.ITEM_TOHIT_PERCENT)
    const isRanged =
      thrown ||
      item.weapon.weaponClass === 'bow' ||
      item.weapon.weaponClass === 'xbow' ||
      item.isType('miss')
    return {
      strBonus: item.weapon.strBonus,
      dexBonus: item.weapon.dexBonus,
      basePhysMin,
      basePhysMax,
      isRanged,
      arPctBonus,
    }
  }
  const basePhysMin = Math.max(1, Math.max(unit(S.MINDAMAGE), 1) + normal)
  const basePhysMax = Math.max(basePhysMin + 1, Math.max(unit(S.MAXDAMAGE), 2) + normal)
  const arPctBonus = skill.toHitPercent + unit(S.ITEM_TOHIT_PERCENT)
  return {
    strBonus: 100,
    dexBonus: 0,
    basePhysMin,
    basePhysMax,
    isRanged: false,
    arPctBonus,
  }
}
