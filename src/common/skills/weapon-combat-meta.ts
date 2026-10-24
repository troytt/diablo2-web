import { RAW_MISC } from '../data/canonical-drop-data.ts'
import { parseMiscTable, type MiscBase, type MiscTable } from '../items/misc-items.ts'
import {
  getCanonicalWeaponsTable,
  resolveWeaponBase113c,
} from '../units/char-anim-speed.ts'
import {
  CANONICAL_113C_MISSILES,
  getBatch1SkillDef,
  getMissileTxtData,
  getSkillManaCost,
  isBatch1Skill,
} from './missiles-data.ts'

let cachedMiscTable: MiscTable | null = null

function getCanonicalMiscTable(): MiscTable {
  if (!cachedMiscTable) {
    cachedMiscTable = parseMiscTable(RAW_MISC)
  }
  return cachedMiscTable
}

function resolveMiscBase113c(code: string | undefined | null): MiscBase | undefined {
  if (!code) return undefined
  const trimmed = code.trim()
  if (!trimmed) return undefined
  return getCanonicalMiscTable().get(trimmed)
}

export const PASSIVE_SKILL_IDS = new Set<number>([
  37, // Warmth
  61, // Fire Mastery
  63, // Lightning Mastery
  65, // Cold Mastery
  69, // Skeleton Mastery
  79, // Golem Mastery
  127, 128, 129, 134, 135, 136, 141, 145, 148, 153, // Barbarian masteries & passives
  224, // Lycanthropy
  252, // Claw Mastery
])

export function isPassiveSkill(skillId: number): boolean {
  if (skillId === 0) return false
  if (PASSIVE_SKILL_IDS.has(skillId)) return true
  const def = getBatch1SkillDef(skillId)
  return def?.type === 'passive'
}

export type AttackWeaponKind = 'unarmed' | 'melee' | 'ranged'
export type AttackWeaponSubtype =
  | 'fist'
  | 'sword'
  | 'axe'
  | 'mace'
  | 'dagger'
  | 'staff'
  | 'polearm'
  | 'spear'
  | 'bow'
  | 'crossbow'
  | 'other'

export interface AttackWeaponInfo {
  readonly kind: AttackWeaponKind
  readonly subtype: AttackWeaponSubtype
  readonly isRanged: boolean
  readonly ammoType?: 'arrow' | 'bolt' | undefined
  readonly damageMin: number
  readonly damageMax: number
  readonly reach: number
  readonly cooldown: number
  readonly swingTicks: number
}

const BOW_CODES = new Set([
  'sbw', 'hbw', 'lbw', 'cbw', 'sbb', 'lbb', 'swb', 'lwb',
  'am1', 'am2', 'am6', 'am7', 'amb',
  '8sb', '8hb', '8lb', '8cb', '8s8', '8l8', '8sw', '8lw',
  '6sb', '6hb', '6lb', '6cb', '6s7', '6l7', '6sw', '6lw',
  'amc', 'amd', 'ame', 'amj', 'amk',
])

const XBOW_CODES = new Set([
  'lxb', 'mxb', 'hxb', 'rxb',
  '8lx', '8mx', '8hx', '8rx',
  '6lx', '6mx', '6hx', '6rx',
])

const DAGGER_CODES = new Set([
  'dgr', 'dir', 'kri', 'bld',
  '9dg', '9di', '9kr', '9bl',
  '7dg', '7di', '7kr', '7bl',
])

export interface AttackWeaponInputItem {
  code?: string | undefined
  type?: string | undefined
  wclass?: string | undefined
  name?: string | undefined
  nameZh?: string | undefined
  damage?: string | undefined
  slot?: number | undefined
  bodyLoc?: number | undefined
  equipSlot?: number | undefined
  equippedSlot?: number | undefined
}

export function getAttackWeaponInfo(item?: AttackWeaponInputItem | null | undefined): AttackWeaponInfo {
  if (!item || !item.code) {
    return {
      kind: 'unarmed',
      subtype: 'fist',
      isRanged: false,
      damageMin: 1,
      damageMax: 2,
      reach: 52,
      cooldown: 12,
      swingTicks: 6,
    }
  }

  const code = item.code.trim().toLowerCase()
  const wb = resolveWeaponBase113c(code)
  const type = (item.type ?? wb?.type ?? '').trim().toLowerCase()
  const wclass = (item.wclass ?? wb?.wclass ?? '').trim().toLowerCase()
  const name = (item.name ?? wb?.name ?? '').toLowerCase()
  const nameZh = (item.nameZh ?? '').toLowerCase()

  let dMin = 3
  let dMax = 8
  let parsedExplicitDamage = false
  if (item.damage) {
    const m = item.damage.match(/(\d+)\s*(?:to|-)\s*(\d+)/)
    if (m) {
      dMin = parseInt(m[1]!, 10)
      dMax = parseInt(m[2]!, 10)
      parsedExplicitDamage = true
    }
  }
  if (!parsedExplicitDamage && wb) {
    if (wb.twoHanded && wb.twoHandedMindam !== undefined && wb.twoHandedMaxdam !== undefined && wb.twoHandedMaxdam > 0) {
      dMin = wb.twoHandedMindam
      dMax = wb.twoHandedMaxdam
    } else if (wb.maxdam > 0) {
      dMin = wb.mindam
      dMax = wb.maxdam
    } else if (wb.minMisDam !== undefined && wb.maxMisDam !== undefined && wb.maxMisDam > 0) {
      dMin = wb.minMisDam
      dMax = wb.maxMisDam
    }
  }

  // Canonical 1.13c Weapons.txt lookup takes priority over heuristic regexes
  if (wb) {
    const wbType = wb.type.trim().toLowerCase()
    const wbWclass = wb.wclass.trim().toLowerCase()
    if (wbType === 'xbow' || wbWclass === 'xbw') {
      return {
        kind: 'ranged',
        subtype: 'crossbow',
        isRanged: true,
        ammoType: 'bolt',
        damageMin: dMin,
        damageMax: dMax,
        reach: 450,
        cooldown: 16,
        swingTicks: 8,
      }
    }
    if (wbType === 'bow' || wbType === 'abow' || wbWclass === 'bow') {
      return {
        kind: 'ranged',
        subtype: 'bow',
        isRanged: true,
        ammoType: 'arrow',
        damageMin: dMin,
        damageMax: dMax,
        reach: 450,
        cooldown: 14,
        swingTicks: 7,
      }
    }

    let wbSubtype: AttackWeaponSubtype | null = null
    let reach = 52
    if (wbType === 'knif' || wbType === 'tkni') {
      wbSubtype = 'dagger'
      reach = 48
    } else if (wbType === 'swor') {
      wbSubtype = 'sword'
      reach = 52
    } else if (wbType === 'axe' || wbType === 'taxe') {
      wbSubtype = 'axe'
      reach = 52
    } else if (wbType === 'mace' || wbType === 'club' || wbType === 'hamm' || wbType === 'scep') {
      wbSubtype = 'mace'
      reach = 52
    } else if (wbType === 'staf') {
      wbSubtype = 'staff'
      reach = 52
    } else if (wbType === 'pole') {
      wbSubtype = 'polearm'
      reach = 60
    } else if (wbType === 'spea' || wbType === 'aspe' || wbType === 'jave' || wbType === 'ajav') {
      wbSubtype = 'spear'
      reach = 60
    } else if (wbType === 'h2h' || wbType === 'h2h2') {
      wbSubtype = 'fist'
      reach = 52
    }

    if (wbSubtype !== null) {
      return {
        kind: 'melee',
        subtype: wbSubtype,
        isRanged: false,
        damageMin: dMin,
        damageMax: dMax,
        reach,
        cooldown: 14,
        swingTicks: 7,
      }
    }
  }

  // Fallback for synthetic/non-canonical test items:
  // 1. Crossbow (checked before bow because 'crossbow' contains 'bow')
  if (type === 'xbow' || wclass === 'xbw' || XBOW_CODES.has(code) || /crossbow|xbow|十字弓|弩/i.test(name) || /十字弓|弩/i.test(nameZh)) {
    return {
      kind: 'ranged',
      subtype: 'crossbow',
      isRanged: true,
      ammoType: 'bolt',
      damageMin: dMin,
      damageMax: dMax,
      reach: 450,
      cooldown: 16,
      swingTicks: 8,
    }
  }

  // 2. Bow
  if (type === 'bow' || type === 'abow' || wclass === 'bow' || BOW_CODES.has(code) || /\bbow\b|弓/i.test(name) || /弓/i.test(nameZh)) {
    return {
      kind: 'ranged',
      subtype: 'bow',
      isRanged: true,
      ammoType: 'arrow',
      damageMin: dMin,
      damageMax: dMax,
      reach: 450,
      cooldown: 14,
      swingTicks: 7,
    }
  }

  // 3. Melee Weapon Subtypes: sword, axe, mace, dagger, staff, polearm, spear
  let subtype: AttackWeaponSubtype | null = null
  let reach = 52

  if (
    type === 'knif' ||
    type === 'tkni' ||
    DAGGER_CODES.has(code) ||
    ((/dagger|dirk|kris|knife|匕首|短刀/i.test(name) || /匕首|短刀/i.test(nameZh)) && type !== 'swor')
  ) {
    subtype = 'dagger'
    reach = 48
  } else if (type === 'swor' || /sword|blade|scimitar|saber|falchion|claymore|broadsword|crystal sword|剑/i.test(name) || /剑/i.test(nameZh)) {
    subtype = 'sword'
    reach = 52
  } else if (type === 'axe' || type === 'taxe' || /axe|hache|cleaver|斧/i.test(name) || /斧/i.test(nameZh)) {
    subtype = 'axe'
    reach = 52
  } else if (type === 'mace' || type === 'club' || type === 'hamm' || type === 'scep' || /mace|club|hammer|scepter|flail|morning star|maul|锤|棍|杖|锏/i.test(name) || /锤|锏/i.test(nameZh)) {
    subtype = 'mace'
    reach = 52
  } else if (type === 'staf' || /staff|长杖|法杖/i.test(name) || /长杖|法杖/i.test(nameZh)) {
    subtype = 'staff'
    reach = 52
  } else if (type === 'pole' || /polearm|bardiche|voulge|scythe|halberd|war scythe|长柄|长镰/i.test(name) || /长柄|长镰/i.test(nameZh)) {
    subtype = 'polearm'
    reach = 60
  } else if (type === 'spea' || type === 'aspe' || type === 'jave' || type === 'ajav' || /spear|trident|brandistock|spetum|pike|javelin|长矛|标枪/i.test(name) || /长矛|标枪/i.test(nameZh)) {
    subtype = 'spear'
    reach = 60
  }

  if (subtype !== null) {
    return {
      kind: 'melee',
      subtype,
      isRanged: false,
      damageMin: dMin,
      damageMax: dMax,
      reach,
      cooldown: 14,
      swingTicks: 7,
    }
  }

  // Non-melee item (e.g. orb, wand) or unarmed fallback timing: cooldown 12, swingTicks 6
  return {
    kind: 'unarmed',
    subtype: 'fist',
    isRanged: false,
    damageMin: dMin > 3 ? dMin : 1,
    damageMax: dMax > 8 ? dMax : 2,
    reach: 52,
    cooldown: 12,
    swingTicks: 6,
  }
}

function matchesAmmoItem(
  ammoType: 'arrow' | 'bolt',
  item: { code?: string | undefined; type?: string | undefined; name?: string | undefined; nameZh?: string | undefined } | null | undefined,
): boolean {
  if (!item || !item.code) return false
  const code = String(item.code).toLowerCase().trim()
  if (!code) return false

  // 1. Canonical 1.13c Misc.txt / quiver code check first
  const expectedType = ammoType === 'arrow' ? 'bowq' : 'xboq'
  if (ammoType === 'arrow' && (code === 'aqv' || code === '0qv')) return true
  if (ammoType === 'bolt' && (code === 'cqv' || code === '1qv')) return true
  if (ammoType === 'arrow' && (code === 'cqv' || code === '1qv')) return false
  if (ammoType === 'bolt' && (code === 'aqv' || code === '0qv')) return false

  const itemType = String(item.type ?? '').toLowerCase().trim()
  if (itemType === 'bowq' || itemType === 'xboq') {
    return itemType === expectedType
  }

  const miscBase = resolveMiscBase113c(code)
  if (miscBase) {
    return miscBase.type.toLowerCase() === expectedType
  }
  if (getCanonicalWeaponsTable().get(code)) {
    return false
  }

  // 2. Fallback to display name matching only for non-canonical item codes
  const name = String(item.name ?? '').toLowerCase()
  const nameZh = String(item.nameZh ?? '').toLowerCase()
  if (ammoType === 'arrow') {
    return /arrow/i.test(name) || /箭矢|箭/i.test(nameZh)
  }
  return /bolt/i.test(name) || /十字弓弹|弩箭/i.test(nameZh)
}

export function checkAmmunition(
  ammoType: 'arrow' | 'bolt',
  offhandItem?: { code?: string | undefined; type?: string | undefined; name?: string | undefined; nameZh?: string | undefined } | null | undefined,
  inventory?: { items?: readonly any[] | undefined; grid?: readonly any[] | undefined; gridItems?: readonly any[] | undefined } | null | undefined,
): boolean {
  // 1. Check offhand equipment (weapon2)
  if (matchesAmmoItem(ammoType, offhandItem)) {
    return true
  }

  // 2. Check inventory grid / items
  if (inventory) {
    const invAny = inventory as any
    const list: any[] = invAny.gridItems
      ? invAny.gridItems.map((g: any) => g.item ?? g)
      : invAny.grid
        ? invAny.grid.map((g: any) => g.item ?? g)
        : (invAny.items ?? [])
    for (const it of list) {
      if (matchesAmmoItem(ammoType, it)) return true
    }
  }

  return false
}

export interface HudCombatStateLike {
  mana: number
  maxMana?: number
  lang?: string
  leftPanel?: string
  toggleLeftPanel?: (panel: any) => void
  syncPublishedState?: () => void
  getSkillLevel?: (skillId: number) => number
  hotkeys?: {
    readonly availableSkills?: ReadonlyArray<{ readonly skillId: number; readonly manaCost: number }>
  }
  inventory?: {
    playerLevel?: number
    gold: number
    readonly equipped?: {
      readonly weapon1?: AttackWeaponInputItem | null
      readonly weapon2?: any
    }
    autoPlaceInGrid: (item: any) => boolean
    readonly items?: readonly any[]
    readonly grid?: readonly any[]
    readonly gridItems?: readonly any[]
  }
  belt?: {
    autoPlacePotion?: (item: any) => boolean
  }
  worldPanels?: {
    selectedActTab: number
    setCurrentWaypoint: (waypointId: number | null, levelId: number | null) => void
  }
}

export function getSkillRange(
  skillId: number,
  hudLike?: HudCombatStateLike | null | undefined,
  equippedWeapon?: AttackWeaponInputItem | null | undefined,
): number {
  if (skillId === 0) {
    const hud = hudLike ?? ((globalThis as Record<string, any>).__d2webHudInstance as HudCombatStateLike | null | undefined)
    const weapon = equippedWeapon ?? hud?.inventory?.equipped?.weapon1
    const info = getAttackWeaponInfo(weapon)
    return info.reach
  }
  const missileSkillMap: Record<number, string> = {
    36: 'firebolt',
    39: 'icebolt',
    45: 'iceblast',
    55: 'glacialspike',
    38: 'chargedbolt',
    67: 'teeth',
    84: 'bonespear',
    93: 'bonespirit',
    92: 'poisonnova',
    101: 'holybolt',
    112: 'blessedhammer',
    6: 'magicarrow',
    7: 'firearrow',
    11: 'coldarrow',
    21: 'icearrow',
    12: 'multipleshotarrow',
    16: 'explodingarrow',
    20: 'lightningjavelin',
    22: 'guidedarrow',
    26: 'strafearrow',
    27: 'immolationarrow',
    31: 'freezingarrow',
    229: 'moltenboulder',
    230: 'arcticblast1',
    240: 'twister',
    245: 'tornado',
  }
  if (skillId in missileSkillMap) {
    const missile = getMissileTxtData(missileSkillMap[skillId]!)
    return missile.distancePx || 1000
  }
  const def = getBatch1SkillDef(skillId)
  if (def !== undefined) {
    if (def.type === 'melee') return 52
    if (def.range !== undefined) return def.range
  }
  switch (skillId) {
    case 40: return 0
    case 42: return 160
    case 44: return 240
    case 54: return 450
    case 56: return 450
    case 57: return 340
    case 58: return 0
    case 59: return 450
    case 62: return 450
    case 63: return 0
    case 64: return 480
    case 219:
    case 220: return 0
    case 225: return 320
    case 234: return 450
    case 235: return 0
    case 244: return 450
    case 249: return 0
    case 250: return 0
    case 254:
    case 255:
    case 259:
    case 260:
    case 265:
    case 269:
    case 270:
    case 274:
    case 280: return 52
    case 275: return 450
    default: return 450
  }
}

export function getSkillMana(skillId: number, hudLike?: HudCombatStateLike | null): number {
  if (skillId === 0 || skillId === 219 || skillId === 220 || isPassiveSkill(skillId)) return 0
  if (hudLike !== null && hudLike !== undefined) {
    const entry = hudLike.hotkeys?.availableSkills?.find(s => s.skillId === skillId)
    if (entry !== undefined) return entry.manaCost
  }
  const slvl = Math.max(1, (hudLike as any)?.getSkillLevel?.(skillId) ?? 1)
  const cost = getSkillManaCost(skillId, slvl)
  if (cost > 0) return cost
  if (isBatch1Skill(skillId)) {
    return getSkillManaCost(skillId, 1)
  }
  return 10
}

export interface SkillCastOutcome {
  readonly casted: boolean
  readonly animMode: 'a1' | 'sc' | null
  readonly statusMessage: string | null
}

// ─── Canonical 1.13c Skill Range & Melee Range (`D2Common_11016`, `D2Common_10399`, `UNITS_IsInMeleeRange`) ───

/**
 * Canonical 1.13c `Skills.txt` `range` column values (`D2Common/src/DataTbls/SkillsTbls.cpp:717-721`):
 * - `'none'` (`SKRANGE_NONE = 0`)
 * - `'h2h'` (`SKRANGE_H2H = 1`)
 * - `'rng'` (`SKRANGE_RNG = 2`)
 * - `'both'` (`SKRANGE_BOTH = 3`)
 */
export type SkillRangeType113c = 'none' | 'h2h' | 'rng' | 'both'

export const MAX_SKILL_ID_113C = 356

/**
 * Canonical 1.13c `Skills.txt` `range = "both"` (`SKRANGE_BOTH = 3`):
 * `0` (`Attack`), `5` (`Left Hand Swing`).
 */
export const SKILL_BOTH_IDS_113C: ReadonlySet<number> = new Set<number>([0, 5])

/**
 * Canonical 1.13c `Skills.txt` `range = "h2h"` (`SKRANGE_H2H = 1`, 43 skills across `0..356`).
 */
export const SKILL_H2H_IDS_113C: ReadonlySet<number> = new Set<number>([
  1, 10, 13, 14, 18, 19, 24, 29, 30, 34, 73, 96, 97, 106, 111, 116, 126, 131, 133, 139, 142,
  144, 147, 150, 152, 232, 233, 238, 239, 242, 248, 254, 255, 259, 260, 265, 269, 270, 274, 280,
  326, 344, 347,
])

/**
 * Canonical 1.13c `Skills.txt` `range = "rng"` (`SKRANGE_RNG = 2`, 41 skills across `0..356`).
 */
export const SKILL_RNG_IDS_113C: ReadonlySet<number> = new Set<number>([
  2, 3, 4, 6, 7, 9, 11, 12, 15, 16, 20, 21, 22, 23, 25, 26, 27, 31, 33, 35, 41, 140, 251, 253,
  256, 257, 261, 262, 263, 266, 271, 272, 273, 275, 276, 339, 340, 341, 342, 343, 345,
])

/**
 * Look up the canonical 1.13c `Skills.txt` `range` classification for `skillId` (`0..356`).
 * Fails fast with `RangeError` if `skillId` is outside `0..356`.
 */
export function getSkillRangeType113c(skillId: number): SkillRangeType113c {
  if (!Number.isInteger(skillId) || skillId < 0 || skillId > MAX_SKILL_ID_113C) {
    throw new RangeError(
      `getSkillRangeType113c: invalid skillId ${String(skillId)} (expected integer in 0..${String(MAX_SKILL_ID_113C)})`,
    )
  }
  if (SKILL_BOTH_IDS_113C.has(skillId)) return 'both'
  if (SKILL_H2H_IDS_113C.has(skillId)) return 'h2h'
  if (SKILL_RNG_IDS_113C.has(skillId)) return 'rng'
  return 'none'
}

export type WeaponOrEquipmentInput =
  | AttackWeaponInputItem
  | ReadonlyMap<number, AttackWeaponInputItem>
  | Iterable<AttackWeaponInputItem>
  | readonly AttackWeaponInputItem[]
  | {
      readonly equipped?: Iterable<AttackWeaponInputItem> | null | undefined
      readonly equipment?: Iterable<AttackWeaponInputItem> | null | undefined
    }
  | Readonly<Record<number, AttackWeaponInputItem | undefined>>
  | null
  | undefined

/**
 * Missile keys for the weapon-dependent inherent throw skills (2 Throw, 4 Left
 * Hand Throw, 140 Double Throw). `Skills.txt` leaves srvmissilea/cltmissilea
 * empty for these skills (srvdofunc 3/5/74); D2Game picks the missile from the
 * equipped weapon's `Weapons.txt` `type`:
 * - `tkni` (throwing knives tkf/bkf/7tk/7bk) → `throwknife` (id 36, MissileDagger)
 * - `taxe` (throwing axes tax/bal/7ta/7b8)   → `throwaxe`  (id 35, MissileHandAxe)
 * - `jave`/`ajav` (javelins jav/pil/.../am5) → `javelin`   (id 1, Javelin)
 * Throwing potions (`tpot`) differ per item code, not per type, so they get a
 * code-level map (Missiles.txt ids 44..49; `chokinggaspoition` keeps the
 * authentic vanilla spelling):
 * - ops/opm/opl → oilpotion / explosivepotion / fulminatingpotion
 * - gps/gpm/gpl → rancidgasepotion / chokinggaspoition / stranglinggaspotion
 */
export type ThrowMissileKey =
  | 'throwknife'
  | 'throwaxe'
  | 'javelin'
  | 'pilum'
  | 'glaive'
  | 'oilpotion'
  | 'explosivepotion'
  | 'fulminatingpotion'
  | 'rancidgasepotion'
  | 'chokinggaspoition'
  | 'stranglinggaspotion'

const THROWABLE_ITEM_TYPES = new Set<string>(['tkni', 'taxe', 'jave', 'ajav', 'tpot'])

let cachedMissileNameById: Map<number, string> | null = null

function resolveMissileNameById113c(id: number): string | null {
  if (!cachedMissileNameById) {
    cachedMissileNameById = new Map<number, string>()
    for (const row of Object.values(CANONICAL_113C_MISSILES)) {
      if (row.id > 0 && !cachedMissileNameById.has(row.id)) {
        cachedMissileNameById.set(row.id, row.name)
      }
    }
  }
  return cachedMissileNameById.get(id) ?? null
}

/**
 * Resolve the 1.13c throw missile for an item `code` via the canonical
 * `Weapons.txt` / `Misc.txt` `missiletype` column (`Missiles.txt` Id).
 * Returns `null` when the code is empty, unknown, or not a throwing weapon —
 * callers must then fall back to their documented default instead of guessing.
 */
export function resolveThrowMissileForItemCode(
  code: string | undefined | null,
): ThrowMissileKey | null {
  const normalized = (code ?? '').trim().toLowerCase()
  if (!normalized) return null
  const item =
    getCanonicalWeaponsTable().get(normalized) ??
    getCanonicalMiscTable().get(normalized)
  if (!item || !item.stackable) return null
  const type = (item.type ?? '').trim().toLowerCase()
  if (!THROWABLE_ITEM_TYPES.has(type)) return null
  const missileTypeId = item.missiletype ?? 0
  if (!(missileTypeId > 0)) return null
  const missileName = resolveMissileNameById113c(missileTypeId)
  return (missileName as ThrowMissileKey | null) ?? null
}

function getWeaponItemSlot(item: AttackWeaponInputItem | undefined | null): number | undefined {
  if (!item) return undefined
  return item.bodyLoc ?? item.slot ?? item.equippedSlot ?? item.equipSlot
}

function isSwapWeaponSlot(slot: number | undefined): boolean {
  return slot === 11 || slot === 12
}

function isSingleWeaponItemInput(val: unknown): val is AttackWeaponInputItem {
  if (!val || typeof val !== 'object') return false
  const rec = val as Record<string, unknown>
  return (
    typeof rec.code === 'string' ||
    typeof rec.type === 'string' ||
    typeof rec.wclass === 'string' ||
    typeof rec.name === 'string' ||
    typeof rec.nameZh === 'string' ||
    typeof rec.damage === 'string'
  )
}

function extractEquippedWeaponCandidates(
  weaponOrEquipment: WeaponOrEquipmentInput,
): AttackWeaponInputItem[] {
  if (!weaponOrEquipment) return []
  if (
    weaponOrEquipment instanceof Map ||
    typeof (weaponOrEquipment as ReadonlyMap<number, AttackWeaponInputItem>).get === 'function'
  ) {
    const map = weaponOrEquipment as ReadonlyMap<number, AttackWeaponInputItem>
    const out: AttackWeaponInputItem[] = []
    const rArm = map.get(4)
    const lArm = map.get(5)
    if (rArm && !isSwapWeaponSlot(getWeaponItemSlot(rArm))) out.push(rArm)
    if (lArm && !isSwapWeaponSlot(getWeaponItemSlot(lArm))) out.push(lArm)
    if (out.length === 0 && typeof map.entries === 'function') {
      const slot4Items: AttackWeaponInputItem[] = []
      const slot5Items: AttackWeaponInputItem[] = []
      for (const [key, item] of map.entries()) {
        if (isSwapWeaponSlot(key)) continue
        const itemSlot = getWeaponItemSlot(item)
        if (isSwapWeaponSlot(itemSlot)) continue
        if (itemSlot === 4) {
          slot4Items.push(item)
        } else if (itemSlot === 5) {
          slot5Items.push(item)
        }
      }
      out.push(...slot4Items, ...slot5Items)
    }
    return out
  }
  if (
    Array.isArray(weaponOrEquipment) ||
    typeof (weaponOrEquipment as Iterable<AttackWeaponInputItem>)[Symbol.iterator] === 'function'
  ) {
    const slot4Items: AttackWeaponInputItem[] = []
    const slot5Items: AttackWeaponInputItem[] = []
    const unslottedItems: AttackWeaponInputItem[] = []
    for (const item of weaponOrEquipment as Iterable<AttackWeaponInputItem>) {
      if (!item) continue
      const itemSlot = getWeaponItemSlot(item)
      if (isSwapWeaponSlot(itemSlot)) continue
      if (itemSlot === 4) {
        slot4Items.push(item)
      } else if (itemSlot === 5) {
        slot5Items.push(item)
      } else if (itemSlot === undefined || itemSlot === 0) {
        unslottedItems.push(item)
      }
    }
    return [...slot4Items, ...slot5Items, ...unslottedItems]
  }
  if (!isSingleWeaponItemInput(weaponOrEquipment)) {
    const rec = weaponOrEquipment as {
      readonly equipped?: Iterable<AttackWeaponInputItem> | null | undefined
      readonly equipment?: Iterable<AttackWeaponInputItem> | null | undefined
      readonly [slot: number]: AttackWeaponInputItem | undefined
    }
    if (rec.equipped) return extractEquippedWeaponCandidates(rec.equipped)
    if (rec.equipment) return extractEquippedWeaponCandidates(rec.equipment)
    const out: AttackWeaponInputItem[] = []
    const rArm = rec[4]
    const lArm = rec[5]
    if (rArm && !isSwapWeaponSlot(getWeaponItemSlot(rArm))) out.push(rArm)
    if (lArm && !isSwapWeaponSlot(getWeaponItemSlot(lArm))) out.push(lArm)
    return out
  }
  const single = weaponOrEquipment as AttackWeaponInputItem
  const singleSlot = getWeaponItemSlot(single)
  if (isSwapWeaponSlot(singleSlot)) return []
  return [single]
}

/**
 * Returns true if the equipped weapon (in slot 4 or 5, or direct item) is a Bow or Crossbow
 * (`ITEMTYPE_BOW`, `ITEMTYPE_CROSSBOW`, `ITEMTYPE_AMAZON_BOW` in `D2Common_11016`).
 */
export function isEquippedWeaponBowOrCrossbow(
  weaponOrEquipment?: WeaponOrEquipmentInput,
): boolean {
  const candidates = extractEquippedWeaponCandidates(weaponOrEquipment)
  const weaponsTable = getCanonicalWeaponsTable()
  for (const item of candidates) {
    const code = (item.code ?? '').trim().toLowerCase()
    if (code) {
      const wb = weaponsTable.get(code)
      if (wb) {
        if (
          wb.type === 'bow' ||
          wb.type === 'abow' ||
          wb.type === 'xbow' ||
          wb.wclass === 'bow' ||
          wb.wclass === 'xbw'
        ) {
          return true
        }
        return false
      }
      if (BOW_CODES.has(code) || XBOW_CODES.has(code)) {
        return true
      }
    }
    const info = getAttackWeaponInfo(item)
    if (info.isRanged) return true
  }
  return false
}

/**
 * Canonical 1.13c melee skill check matching `D2Common_11016(pUnit, pSkill) == SKRANGE_H2H (1)`
 * (`D2Common/src/D2Skills.cpp:2945-2966`) and `sub_6FC836D0` (`D2Game/src/PLAYER/PlrMsg.cpp:1018`):
 * - `'h2h'` skills are always melee (`true`).
 * - `'both'` skills (`Attack = 0`, `Left Hand Swing = 5`) are melee (`true`) when the equipped
 *   weapon is NOT a bow or crossbow (`!isEquippedWeaponBowOrCrossbow`), and ranged (`false`) when
 *   holding a bow or crossbow.
 * - `'rng'` and `'none'` skills are not melee (`false`).
 */
export function isMeleeSkill113c(
  skillId: number,
  weaponOrEquipment?: WeaponOrEquipmentInput,
): boolean {
  const rangeType = getSkillRangeType113c(skillId)
  if (rangeType === 'h2h') return true
  if (rangeType === 'both') return !isEquippedWeaponBowOrCrossbow(weaponOrEquipment)
  return false
}

export const isMeleeSkill = isMeleeSkill113c

/**
 * Resolve the equipped weapon's canonical `rangeadder` from 1.13c `Weapons.txt`, matching
 * `UNITS_GetMeleeRange` (`D2Common/src/Units/Units.cpp:2733-2765`) & `ITEMS_GetMeleeRange`
 * (`D2Common/src/Items/Items.cpp:1531-1539`):
 * - Checks right-arm (`bodyLoc = 4`) then left-arm (`bodyLoc = 5`) for a weapon in `Weapons.txt`.
 * - Returns `0` when unarmed (or only a shield/quiver is equipped).
 * - Fails fast via `resolveWeaponBase113c` if an explicit single weapon item has an unknown `code`.
 */
export function resolveEquippedWeaponRangeAdder(
  weaponOrEquipment?: WeaponOrEquipmentInput,
): number {
  if (!weaponOrEquipment) return 0
  const weaponsTable = getCanonicalWeaponsTable()
  if (
    weaponOrEquipment instanceof Map ||
    typeof (weaponOrEquipment as ReadonlyMap<number, AttackWeaponInputItem>).get === 'function' ||
    Array.isArray(weaponOrEquipment) ||
    typeof (weaponOrEquipment as Iterable<AttackWeaponInputItem>)[Symbol.iterator] === 'function' ||
    !isSingleWeaponItemInput(weaponOrEquipment)
  ) {
    const candidates = extractEquippedWeaponCandidates(weaponOrEquipment)
    for (const item of candidates) {
      const code = (item?.code ?? '').trim().toLowerCase()
      if (!code) continue
      const wb = weaponsTable.get(code)
      if (wb) {
        return wb.rangeadder
      }
    }
    return 0
  }
  const single = weaponOrEquipment as AttackWeaponInputItem
  if (isSwapWeaponSlot(getWeaponItemSlot(single))) return 0
  const code = (single.code ?? '').trim().toLowerCase()
  if (!code) return 0
  const wb = resolveWeaponBase113c(code)
  if (!wb) {
    throw new RangeError(
      `resolveEquippedWeaponRangeAdder: unknown 1.13c weapon code "${code}"`,
    )
  }
  return wb.rangeadder
}

/**
 * Canonical 1.13c 8×8 lookup table `byte_6FDD3200[dy][dx]` used by `D2Common_10399`
 * (`D2Common/src/Units/Units.cpp:3688-3785`) when `dx < 8 && dy < 8`.
 */
export const DIST_TABLE_6FDD3200: readonly (readonly number[])[] = [
  [0, 0, 0, 1, 2, 3, 4, 5],
  [0, 0, 1, 1, 2, 3, 4, 5],
  [0, 1, 1, 2, 2, 3, 4, 5],
  [1, 1, 2, 2, 3, 4, 4, 5],
  [2, 2, 2, 3, 4, 4, 5, 6],
  [3, 3, 3, 4, 4, 5, 6, 7],
  [4, 4, 4, 4, 5, 6, 7, 7],
  [5, 5, 5, 5, 6, 7, 7, 8],
]

/**
 * Canonical 1.13c `D2Common_10399` (`D2Common/src/Units/Units.cpp:3688-3785`):
 * Computes the unit-size-adjusted sub-tile distance between two units at `(x1, y1)` with `size1`
 * and `(x2, y2)` with `size2`.
 */
export function computeUnitSizeAdjustedDistance(
  x1: number,
  y1: number,
  size1: number,
  x2: number,
  y2: number,
  size2: number,
): number {
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
    throw new RangeError(
      `computeUnitSizeAdjustedDistance: coordinates must be finite numbers, got (${String(x1)}, ${String(y1)}) -> (${String(x2)}, ${String(y2)})`,
    )
  }
  if (!Number.isInteger(size1) || size1 < 0 || !Number.isInteger(size2) || size2 < 0) {
    throw new RangeError(
      `computeUnitSizeAdjustedDistance: unit sizes must be non-negative integers, got size1=${String(size1)}, size2=${String(size2)}`,
    )
  }
  const dx = Math.ceil(Math.max(0, Math.abs(x2 - x1) - 1e-6))
  const dy = Math.ceil(Math.max(0, Math.abs(y2 - y1) - 1e-6))
  if (dx < 8 && dy < 8 && size1 < 4 && size2 < 4) {
    let dist = DIST_TABLE_6FDD3200[dy]![dx]!
    if (size1 === 3 || size2 === 3) {
      dist--
      if (dist < 0) dist = 0
    }
    if (size1 <= 1 || size2 <= 1) {
      dist++
    }
    return dist
  }
  const maxDelta = dx <= dy ? dy : dx
  const minDelta = dx < dy ? dx : dy
  const approxDist = ((minDelta + 2 * maxDelta) >> 1) - 1
  const sizeSum = size1 + size2
  if (approxDist < sizeSum) {
    return 0
  }
  return approxDist - sizeSum + 1
}

/**
 * Canonical 1.13c `UNITS_TestCollision` (`D2Common/src/Units/Units.cpp:2833-2948`):
 * Shrinks the ray endpoints between `(x1, y1)` and `(x2, y2)` by `min(2, size1)` and `min(2, size2)`
 * when `|x1 - x2| + |y1 - y2| >= min(2, size1) + min(2, size2)`, then tests if any sub-tile along
 * the segment is blocked by wall/combat collision.
 */
export function hasMeleeLineOfSight113c(
  x1: number,
  y1: number,
  size1: number,
  x2: number,
  y2: number,
  size2: number,
  isSubTileBlocked?: ((x: number, y: number) => boolean) | null,
): boolean {
  if (!isSubTileBlocked) return true
  let sx1 = Math.round(x1)
  let sy1 = Math.round(y1)
  let sx2 = Math.round(x2)
  let sy2 = Math.round(y2)
  const cap1 = Math.min(2, size1)
  const cap2 = Math.min(2, size2)
  if (Math.abs(sx1 - sx2) + Math.abs(sy1 - sy2) >= cap1 + cap2) {
    if (sx1 <= sx2) {
      if (sx1 < sx2) {
        sx1 += cap1
        sx2 -= cap2
      }
    } else {
      sx1 -= cap1
      sx2 += cap2
    }
    if (sy1 <= sy2) {
      if (sy1 < sy2) {
        sy1 += cap1
        sy2 -= cap2
      }
    } else {
      sy1 -= cap1
      sy2 += cap2
    }
  }
  const steps = Math.max(Math.abs(sx2 - sx1), Math.abs(sy2 - sy1))
  if (steps <= 0) {
    return !isSubTileBlocked(sx1, sy1)
  }
  for (let i = 0; i <= steps; i++) {
    const cx = Math.round(sx1 + ((sx2 - sx1) * i) / steps)
    const cy = Math.round(sy1 + ((sy2 - sy1) * i) / steps)
    if (isSubTileBlocked(cx, cy)) {
      return false
    }
  }
  return true
}

/**
 * Canonical 1.13c `UNITS_IsInMeleeRange` (`D2Common/src/Units/Units.cpp:2951-2985`):
 * Returns true iff `computeUnitSizeAdjustedDistance(x1, y1, size1, x2, y2, size2) <= weaponRangeAdder + 1 + (isTargetMoving ? 1 : 0)`
 * and `UNITS_TestCollision` (`hasMeleeLineOfSight113c`) passes.
 */
export function isInMeleeRange113c(
  attackerX: number,
  attackerY: number,
  attackerSizeX: number,
  targetX: number,
  targetY: number,
  targetSizeX: number,
  weaponRangeAdder = 0,
  isTargetMoving = false,
  isSubTileBlocked?: ((x: number, y: number) => boolean) | null,
): boolean {
  if (!Number.isInteger(weaponRangeAdder) || weaponRangeAdder < 0) {
    throw new RangeError(
      `isInMeleeRange113c: weaponRangeAdder must be a non-negative integer, got ${String(weaponRangeAdder)}`,
    )
  }
  const rangeBonus = isTargetMoving ? 1 : 0
  const maxDist = weaponRangeAdder + 1 + rangeBonus
  const dist = computeUnitSizeAdjustedDistance(
    attackerX,
    attackerY,
    attackerSizeX,
    targetX,
    targetY,
    targetSizeX,
  )
  if (dist > maxDist) {
    return false
  }
  return hasMeleeLineOfSight113c(
    attackerX,
    attackerY,
    attackerSizeX,
    targetX,
    targetY,
    targetSizeX,
    isSubTileBlocked,
  )
}


