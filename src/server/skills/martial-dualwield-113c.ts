/**
 * Diablo II: Lord of Destruction v1.13c — Telekinesis, Smite, Barbarian dual-wield and Assassin
 * Martial Arts runtime rules (#1806, #1808, #1812, #1813, #1815, #1816).
 *
 * Pure, deterministic helpers consumed by `GameInstance` (no RNG, no clocks, no I/O).
 *
 * Ground truth:
 * - `D2Game.dll` `SKILLS_SrvSt12` (`0x6FC62360`) / `SKILLS_SrvDo021_Telekinesis` (`0x6FC631C0`):
 *   target dispatch by unit type (1 monster / 2 object / 4 item), `dx*dx + dy*dy <= 25*25`,
 *   pickup whitelist through `ITEMS_CheckItemTypeId` (`scro`, `gold`, `tpot`, `bowq`/`xboq`,
 *   `poti`, `key`), `Param1 = 35%` knockback on monsters.
 * - `D2Game.dll` `OBJECTS_OperateHandler` (`0x6FC8A330`): Stash (`OperateFn 32`), Horadric Orifice
 *   (152), Hellforge (376), Compelling Orb (404), Ancients' Altar (546), 121/122/22 refuse TK.
 * - `D2Game.dll` `SKILLS_SrvDo150_Smite` (`0x6FD13220`): `Skills.txt` `itypea1 = shld`.
 * - `D2Game.dll` `SrvDo070` Double Swing / `SrvDo074` Double Throw / `SrvDo009` Frenzy (`0x6FC493C0`):
 *   both hands must carry a melee (resp. throwing) weapon; one independent strike per hand;
 *   Frenzy counter +1 per landed strike (cap `slvl`), `dm(20,200,n)` FRW / `dm(0,50,n)` IAS, 150 frames.
 * - `Skills.txt` progressive skills (`prgstack`, `aurastate`): Tiger Strike -> `progressive_damage`
 *   (state 122), Cobra Strike -> `progressive_steal` (123), Phoenix Strike -> `progressive_other` (124),
 *   Fists of Fire -> `progressive_fire` (125), Blades of Ice -> `progressive_cold` (126),
 *   Claws of Thunder -> `progressive_lightning` (127); 375-frame charges (`Param3`), max 3.
 *   (The issue text quotes states 147..152 / Frenzy state 9; the 1.13c `States.txt` rows are
 *   122..127 and `frenzy` = 94, verified against the shipped registry.)
 * - `D2Game.dll` kick damage (`0x6FC42F10`, `kb/skills/player/skills-ass-martial-arts.md`):
 *   `Armor.txt` boot `mindam..maxdam` (first `mindam`/`maxdam` columns) with `(Str + Dex - 20) / 4|3`.
 */

import { computeDiminishingReturns } from '../../common/data/calc-ast.ts'
import { getItemBaseEquipMeta113c } from '../../common/items/equip-req-113c.ts'
import { itemTypeIsA } from '../../common/items/item-types.ts'

// ---------------------------------------------------------------------------------------------
// Target unit type normalisation (C2S 0x06/0x07/0x0D/0x0E unit casts carry the clicked unit type)
// ---------------------------------------------------------------------------------------------

/** `UnitType` of a unit-target cast: 0 player, 1 monster, 2 object, 3 missile, 4 item, 5 tile. */
export type SkillTargetUnitType113c = 0 | 1 | 2 | 3 | 4 | 5

export function normalizeSkillTargetUnitType113c(raw: unknown): SkillTargetUnitType113c | undefined {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 5) {
    return raw as SkillTargetUnitType113c
  }
  if (typeof raw !== 'string') return undefined
  switch (raw.trim().toLowerCase()) {
    case 'player':
      return 0
    case 'monster':
    case 'npc':
      return 1
    case 'object':
      return 2
    case 'missile':
      return 3
    case 'item':
      return 4
    case 'tile':
    case 'warp':
      return 5
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------------------------
// #1806 Telekinesis (#43)
// ---------------------------------------------------------------------------------------------

export const TELEKINESIS_SKILL_ID = 43
/** `SKILLS_SrvSt12` range check: `dx*dx + dy*dy <= 25*25` sub-tiles. */
export const TELEKINESIS_MAX_RANGE_SUBTILES = 25
/** `Skills.txt` #43 `Param1`: knockback chance on monsters. */
export const TELEKINESIS_KNOCKBACK_CHANCE_PCT = 35

/** `ItemTypes.txt` codes `SrvDo021` lets Telekinesis pick up (`0x6FC63383..0x6FC633C7`). */
export const TELEKINESIS_PICKUP_ITEM_TYPES_113C: readonly string[] = Object.freeze([
  'scro',
  'gold',
  'tpot',
  'bowq',
  'xboq',
  'poti',
  'key',
])

export function isWithinTelekinesisRange113c(fromX: number, fromY: number, toX: number, toY: number): boolean {
  const dx = toX - fromX
  const dy = toY - fromY
  return dx * dx + dy * dy <= TELEKINESIS_MAX_RANGE_SUBTILES * TELEKINESIS_MAX_RANGE_SUBTILES
}

/** Item base `type` of an item code (`Armor.txt` / `Weapons.txt` / `Misc.txt`), `''` when unknown. */
export function resolveItemTypeCode113c(itemCode: string): string {
  const code = itemCode.trim()
  if (code === 'gld') return 'gold'
  return getItemBaseEquipMeta113c(code)?.type ?? ''
}

export function isTelekinesisPickupEligible113c(itemCode: string): boolean {
  const type = resolveItemTypeCode113c(itemCode)
  if (type === '') return false
  return TELEKINESIS_PICKUP_ITEM_TYPES_113C.some((t) => itemTypeIsA(type, t))
}

/** Objects `OBJECTS_OperateHandler` (`0x6FC8A3B4..0x6FC8A3C1`) refuses to operate by Telekinesis. */
export const TELEKINESIS_BLOCKED_OBJECT_CLASS_IDS_113C: ReadonlySet<number> = new Set([
  22, 121, 122, 152, 267, 376, 404, 546,
])
/** `Objects.txt` `OperateFn 32` = Personal Stash. */
export const OPERATE_FN_STASH_113C = 32

export interface TelekinesisObjectFacts113c {
  readonly classId: number
  readonly operateFn: number
  readonly isWaypoint: boolean
  readonly isShrine: boolean
  readonly destAreaId: number | undefined
}

export function isTelekinesisObjectEligible113c(obj: TelekinesisObjectFacts113c): boolean {
  if (TELEKINESIS_BLOCKED_OBJECT_CLASS_IDS_113C.has(obj.classId)) return false
  if (obj.operateFn === OPERATE_FN_STASH_113C) return false
  if (obj.isWaypoint || obj.isShrine || obj.destAreaId !== undefined) return true
  // Inert props (`OperateFn 0`) have no operate handler to run.
  return obj.operateFn !== 0
}

// ---------------------------------------------------------------------------------------------
// Hand-slot classification shared by Smite / Barbarian / Assassin validators
// ---------------------------------------------------------------------------------------------

export interface HandItemFacts113c {
  readonly code: string
}

export type HandKind113c = 'empty' | 'shield' | 'claw' | 'throw' | 'melee' | 'ranged' | 'other'

/** Classify an equipped hand item by its `ItemTypes.txt` ancestry. */
export function classifyHandItem113c(item: HandItemFacts113c | undefined): HandKind113c {
  if (item === undefined) return 'empty'
  const type = resolveItemTypeCode113c(item.code)
  if (type === '') return 'other'
  if (itemTypeIsA(type, 'shld')) return 'shield'
  if (itemTypeIsA(type, 'h2h')) return 'claw'
  if (itemTypeIsA(type, 'thro')) return 'throw'
  if (itemTypeIsA(type, 'miss') || itemTypeIsA(type, 'bow') || itemTypeIsA(type, 'xbow')) return 'ranged'
  if (itemTypeIsA(type, 'mele')) return 'melee'
  return 'other'
}

/** Throwing weapons (`thro`) are melee-capable too (javelins/axes/knives swing in melee). */
function isMeleeCapable(kind: HandKind113c): boolean {
  return kind === 'melee' || kind === 'claw' || kind === 'throw'
}

export type WeaponRequirementReason113c =
  | 'requires_shield'
  | 'requires_dual_melee'
  | 'requires_dual_throw'
  | 'requires_melee'
  | 'requires_claw'
  | 'requires_dual_claw'
  | 'requires_claw_or_unarmed'

export interface WeaponRequirementResult113c {
  readonly valid: boolean
  readonly reason?: WeaponRequirementReason113c | undefined
}

/**
 * Pre-cast hand-equipment requirement of the Wave 2 melee skills. `right`/`left` are the active
 * (non-swap) `bodyLoc 4` / `bodyLoc 5` items. `throwQuantity` reports `STAT_QUANTITY` per hand.
 *
 * Synthetic rigs without any hand item (`right === left === undefined`) keep the registry-sweep
 * convention used by `resolvePlayerSkillCast` for Smite (#1800): requirements apply once the
 * character holds equipment in either hand.
 */
export function validateWave2SkillHands113c(
  skillId: number,
  right: HandItemFacts113c | undefined,
  left: HandItemFacts113c | undefined,
  throwQuantity: { readonly right: number; readonly left: number } = { right: 1, left: 1 },
): WeaponRequirementResult113c {
  if (right === undefined && left === undefined) return { valid: true }
  const r = classifyHandItem113c(right)
  const l = classifyHandItem113c(left)
  switch (skillId) {
    case 97:
      return r === 'shield' || l === 'shield' ? { valid: true } : { valid: false, reason: 'requires_shield' }
    case 133:
    case 147:
      return isMeleeCapable(r) && isMeleeCapable(l) && r !== 'claw' && l !== 'claw'
        ? { valid: true }
        : { valid: false, reason: 'requires_dual_melee' }
    case 140:
      return r === 'throw' && l === 'throw' && throwQuantity.right > 0 && throwQuantity.left > 0
        ? { valid: true }
        : { valid: false, reason: 'requires_dual_throw' }
    case 269:
    case 274:
      return r === 'claw' || l === 'claw' ? { valid: true } : { valid: false, reason: 'requires_claw' }
    case 259:
      if (r === 'claw' || l === 'claw') return { valid: true }
      return (r === 'empty' || r === 'shield') && (l === 'empty' || l === 'shield')
        ? { valid: true }
        : { valid: false, reason: 'requires_claw_or_unarmed' }
    case 260:
      return r === 'claw' && l === 'claw' ? { valid: true } : { valid: false, reason: 'requires_dual_claw' }
    case 254:
    case 265:
    case 280:
      return r === 'ranged' || l === 'ranged' ? { valid: false, reason: 'requires_melee' } : { valid: true }
    default:
      return { valid: true }
  }
}

// ---------------------------------------------------------------------------------------------
// #1808 Smite (#97)
// ---------------------------------------------------------------------------------------------

/** `SKILLS_SrvDo150_Smite` stun: `min(250, 15 + 5 * (slvl - 1))` frames. */
export function computeSmiteStunFrames113c(slvl: number): number {
  const lvl = Math.max(1, Math.trunc(slvl))
  return Math.min(250, 15 + 5 * (lvl - 1))
}

// ---------------------------------------------------------------------------------------------
// #1812 / #1813 Barbarian dual-wield
// ---------------------------------------------------------------------------------------------

export const FRENZY_SKILL_ID = 147
export const FRENZY_STATE_ID_113C = 94
export const FRENZY_DURATION_FRAMES_113C = 150

export interface FrenzyStack113c {
  readonly stacks: number
  readonly expireFrame: number
}

export interface FrenzyStackStep113c extends FrenzyStack113c {
  readonly velocityPct: number
  readonly attackRatePct: number
  readonly refreshed: boolean
}

/**
 * One Frenzy strike (`SrvDo009`): a landed strike raises the counter (cap `slvl`) and refreshes the
 * 150-frame duration; a missed strike keeps the counter and does not refresh it.
 */
export function stepFrenzyStack113c(
  prev: FrenzyStack113c | undefined,
  currentFrame: number,
  slvl: number,
  landed: boolean,
): FrenzyStackStep113c {
  const lvl = Math.max(1, Math.trunc(slvl))
  const active = prev !== undefined && currentFrame < prev.expireFrame ? prev.stacks : 0
  const stacks = landed ? Math.min(lvl, active + 1) : active
  const expireFrame = landed
    ? currentFrame + FRENZY_DURATION_FRAMES_113C
    : prev !== undefined && active > 0
      ? prev.expireFrame
      : currentFrame
  return {
    stacks,
    expireFrame,
    velocityPct: stacks > 0 ? computeDiminishingReturns(20, 200, stacks) : 0,
    attackRatePct: stacks > 0 ? computeDiminishingReturns(0, 50, stacks) : 0,
    refreshed: landed,
  }
}

// ---------------------------------------------------------------------------------------------
// #1815 / #1816 Assassin Martial Arts
// ---------------------------------------------------------------------------------------------

export const MARTIAL_CHARGE_DURATION_FRAMES_113C = 375
export const MARTIAL_MAX_CHARGES_113C = 3

export interface ProgressiveSkillSpec113c {
  readonly skillId: number
  readonly stateId: number
  readonly stateName: string
  /** `ItemStatCost.txt` progressive counter read by the client orb renderer (`stats[0]`). */
  readonly countStatName: string
  /** `Skills.txt` `EType` of the charge-up strike (`''` = physical). */
  readonly element: '' | 'fire' | 'ltng' | 'cold'
}

export const PROGRESSIVE_SKILLS_113C: readonly ProgressiveSkillSpec113c[] = Object.freeze([
  { skillId: 254, stateId: 122, stateName: 'progressive_damage', countStatName: 'progressive_damage', element: '' },
  { skillId: 265, stateId: 123, stateName: 'progressive_steal', countStatName: 'progressive_steal', element: '' },
  { skillId: 280, stateId: 124, stateName: 'progressive_other', countStatName: 'progressive_other', element: '' },
  { skillId: 259, stateId: 125, stateName: 'progressive_fire', countStatName: 'progressive_fire', element: 'fire' },
  { skillId: 274, stateId: 126, stateName: 'progressive_cold', countStatName: 'progressive_cold', element: 'cold' },
  { skillId: 269, stateId: 127, stateName: 'progressive_lightning', countStatName: 'progressive_lightning', element: 'ltng' },
] as const)

export function getProgressiveSkillSpec113c(skillId: number): ProgressiveSkillSpec113c | undefined {
  return PROGRESSIVE_SKILLS_113C.find((s) => s.skillId === skillId)
}

/** Finishers that release every stacked charge on hit (`0x6FCB1D21`): Attack + the four kicks/claws. */
export const MARTIAL_FINISHER_SKILL_IDS_113C: ReadonlySet<number> = new Set([0, 255, 260, 270, 275])
export const KICK_SKILL_IDS_113C: ReadonlySet<number> = new Set([255, 270, 275])

export interface MartialCharge113c {
  readonly skillId: number
  readonly stateId: number
  readonly count: number
  readonly slvl: number
}

export interface MartialChargeState113c {
  readonly charges: readonly MartialCharge113c[]
  readonly expireFrame: number
}

/**
 * A landed charge-up strike adds one charge (max 3) to its own progressive state and refreshes
 * every held charge to `currentFrame + 375`. Expired charges are dropped first.
 */
export function addMartialCharge113c(
  prev: MartialChargeState113c | undefined,
  skillId: number,
  slvl: number,
  currentFrame: number,
): MartialChargeState113c {
  const spec = getProgressiveSkillSpec113c(skillId)
  const live = prev !== undefined && currentFrame < prev.expireFrame ? prev.charges : []
  if (spec === undefined) return { charges: live, expireFrame: prev?.expireFrame ?? currentFrame }
  const existing = live.find((c) => c.skillId === skillId)
  const nextCount = Math.min(MARTIAL_MAX_CHARGES_113C, (existing?.count ?? 0) + 1)
  const charges = [
    ...live.filter((c) => c.skillId !== skillId),
    { skillId, stateId: spec.stateId, count: nextCount, slvl: Math.max(1, Math.trunc(slvl)) },
  ]
  return { charges, expireFrame: currentFrame + MARTIAL_CHARGE_DURATION_FRAMES_113C }
}

export function liveMartialCharges113c(
  state: MartialChargeState113c | undefined,
  currentFrame: number,
): readonly MartialCharge113c[] {
  return state !== undefined && currentFrame < state.expireFrame ? state.charges : []
}

/** Boot (`bodyLoc 9`) kick damage band from `Armor.txt` `mindam..maxdam`, `0..0` barefoot. */
export interface BootKickDamage113c {
  readonly min: number
  readonly max: number
}

/**
 * 1.13c kick damage (`0x6FC42F10`):
 * `min = trunc(max(1, (Str+Dex-20)/4) * (100+skillEd)/100) + trunc(bootMin * (100 + Str*1.2 + skillEd + offWeaponEd)/100)`,
 * `max` uses `/3` (floor 2). Dragon Tail passes `skillEdPct = 0`. No Deadly Strike, no `stat 111`.
 */
export function computeKickDamageRange113c(params: {
  readonly strength: number
  readonly dexterity: number
  readonly boot: BootKickDamage113c
  readonly skillEdPct: number
  readonly offWeaponEdPct: number
}): { min: number; max: number } {
  const str = Math.max(0, Math.trunc(params.strength))
  const dex = Math.max(0, Math.trunc(params.dexterity))
  const attr = Math.max(0, dex + str - 20)
  const attrMin = Math.max(1, Math.floor(attr / 4))
  const attrMax = Math.max(2, Math.floor(attr / 3))
  const strBoot = Math.floor((str * 120) / 100)
  const ed = params.skillEdPct
  const bootPct = 100 + strBoot + params.offWeaponEdPct + ed
  const min = Math.floor((attrMin * (100 + ed)) / 100) + Math.floor((Math.max(0, params.boot.min) * bootPct) / 100)
  const max = Math.floor((attrMax * (100 + ed)) / 100) + Math.floor((Math.max(0, params.boot.max) * bootPct) / 100)
  return { min: Math.max(1, min), max: Math.max(Math.max(1, min), max) }
}

/** Dragon Talon kick count lives in `evaluateDragonTalonStats` (`Skills.txt` #255 `Calc1 = lvl / Param1 + 1`). */

/** Dragon Tail fire explosion: `dealtPhys * (50 + 10*(slvl-1)) / 100`, 0 when no physical damage landed. */
export function computeDragonTailExplosionDamage113c(dealtPhys: number, slvl: number): number {
  if (dealtPhys <= 0) return 0
  const lvl = Math.max(1, Math.trunc(slvl))
  return Math.floor((dealtPhys * (50 + 10 * (lvl - 1))) / 100)
}

export const DRAGON_TAIL_EXPLOSION_RADIUS_SUBTILES = 6
export const DRAGON_FLIGHT_RANGE_SUBTILES = 27

/** Fists of Fire physical-to-fire conversion `min(100, 3 * slvl)%`. */
export function computeFistsOfFireConversionPct113c(slvl: number): number {
  return Math.min(100, 3 * Math.max(1, Math.trunc(slvl)))
}
