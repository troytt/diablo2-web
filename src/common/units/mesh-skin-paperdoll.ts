/**
 * Diablo II equipment -> mesh skin paper-doll selection (`src/common/units/mesh-skin-paperdoll.ts`).
 *
 * A mesh skin with a paper-doll (see `MeshSkinPaperdoll`) exposes named options per slot. This
 * module maps the items a player wears to the generic slot vocabulary below, using the 1.13c
 * `Armor.txt` / `Weapons.txt` rows (`type`, `normcode` / `ubercode` / `ultracode`, `2handed`) of each
 * base item. A skin that lacks a
 * slot or an option simply keeps its default for that slot.
 *
 * Pure deterministic module (zero DOM globals, zero `node:*` imports).
 */

import { getEmbeddedDropTables } from '../items/embedded-drop-tables.ts'

/** Weapon families a paper-doll skin can show (one model per family). */
export type MeshPaperdollWeapon =
  | 'none' | 'axe' | 'pick' | 'axe2h' | 'club' | 'mace' | 'hammer' | 'hammer2h' | 'scepter'
  | 'sword' | 'saber' | 'sword2h' | 'dagger' | 'spear' | 'trident' | 'polearm' | 'scythe' | 'claw'
  | 'staff' | 'wand' | 'orb' | 'bow' | 'crossbow' | 'javelin' | 'tknife' | 'taxe' | 'tpotion'
  /** A two-handed sword held in one hand because the other hand is occupied (Barbarian). */
  | 'sword2h1'

/**
 * Off-hand families: shield shapes, paladin shields and necromancer heads, or the second weapon of
 * a dual wielder (`w-<weapon family>`, Barbarian and Assassin).
 */
export type MeshPaperdollOffhand =
  | 'none' | 'buckler' | 'shield' | 'kite' | 'tower' | 'spiked' | 'paladin' | 'head'
  | `w-${Exclude<MeshPaperdollWeapon, 'none' | 'sword2h1'>}`

/** Item quality tiers that tint an item's glow (`none`: no glow). */
export type MeshPaperdollGlow = 'none' | 'magic' | 'set' | 'rare' | 'unique' | 'crafted'

/** Helmet families (one model per family). */
export type MeshPaperdollHelm =
  | 'none' | 'cap' | 'skullcap' | 'helm' | 'fullhelm' | 'greathelm' | 'crown' | 'mask' | 'bone'
  | 'circlet' | 'pelt' | 'barbarian'

/** Body armour families; each has one look per tier (1 normal, 2 exceptional, 3 elite). */
export type MeshPaperdollArmorFamily = 'quilted' | 'leather' | 'studded' | 'ring' | 'scale' | 'breast' | 'plate' | 'gothic'
export type MeshPaperdollArmor = 'none' | `${MeshPaperdollArmorFamily}${1 | 2 | 3}`

/**
 * Slot vocabulary shared by every paper-doll mesh skin. Boots, belts and gloves are not slots:
 * they never change the model.
 */
export interface MeshPaperdollSelection {
  readonly weapon: MeshPaperdollWeapon
  readonly offhand: MeshPaperdollOffhand
  readonly helm: MeshPaperdollHelm
  readonly armor: MeshPaperdollArmor
  /** Quality glow of the weapon / off-hand item (`none` when the slot is empty). */
  readonly weaponGlow: MeshPaperdollGlow
  readonly offhandGlow: MeshPaperdollGlow
  /**
   * `UniqueItems.txt` row id of a unique weapon in the main / off hand. When the skin's weapon pack
   * has a model for that id it is shown instead of the family model, see
   * {@link applyMeshPaperdollUniqueLooks}.
   */
  readonly weaponUnique?: number | undefined
  readonly offhandUnique?: number | undefined
}

/** Base item codes worn in the visual slots (`undefined` / empty for an empty slot). */
export interface MeshPaperdollEquipment {
  readonly helm?: string | undefined
  readonly armor?: string | undefined
  /** The two hands of the active weapon set, in either order. */
  readonly hand1?: string | undefined
  readonly hand2?: string | undefined
  /** 1.13c item quality (1..9) of the items in `hand1` / `hand2`. */
  readonly hand1Quality?: number | undefined
  readonly hand2Quality?: number | undefined
  /** `UniqueItems.txt` row id of the items in `hand1` / `hand2` (only read for quality 7). */
  readonly hand1Unique?: number | undefined
  readonly hand2Unique?: number | undefined
}

export const EMPTY_MESH_PAPERDOLL_SELECTION: MeshPaperdollSelection = Object.freeze({
  weapon: 'none',
  offhand: 'none',
  helm: 'none',
  armor: 'none',
  weaponGlow: 'none',
  offhandGlow: 'none',
})

/**
 * Glow tint per quality tier (linear RGB, already scaled by the tier's strength), following the
 * 1.13c item name colours: magic blue, set green, rare yellow, unique gold, crafted orange.
 * Magic, rare and crafted items are common, so their glow is half as strong as set and unique.
 */
export const MESH_PAPERDOLL_GLOW_RGB: Readonly<Record<Exclude<MeshPaperdollGlow, 'none'>, readonly [number, number, number]>> =
  Object.freeze({
    magic: [0.155, 0.235, 0.5],
    set: [0.1, 0.95, 0.1],
    rare: [0.5, 0.46, 0.175],
    unique: [0.78, 0.6, 0.3],
    crafted: [0.5, 0.275, 0.04],
  })

/** 1.13c quality id -> glow tier: 4 magic, 5 set, 6 rare, 7 unique, 8 crafted; the rest do not glow. */
export function meshPaperdollGlowForQuality(quality: number | undefined): MeshPaperdollGlow {
  switch (quality) {
    case 4: return 'magic'
    case 5: return 'set'
    case 6: return 'rare'
    case 7: return 'unique'
    case 8: return 'crafted'
    default: return 'none'
  }
}

/** Body armour family by normal-tier code (`Armor.txt` `normcode`). */
const ARMOR_BY_FAMILY: Readonly<Record<string, MeshPaperdollArmorFamily>> = {
  qui: 'quilted', // Quilted Armor
  lea: 'leather', hla: 'leather', // Leather Armor, Hard Leather Armor
  stu: 'studded', // Studded Leather
  rng: 'ring', chn: 'ring', // Ring Mail, Chain Mail
  scl: 'scale', spl: 'scale', // Scale Mail, Splint Mail
  brs: 'breast', ltp: 'breast', // Breast Plate, Light Plate
  plt: 'plate', fld: 'plate', // Plate Mail, Field Plate
  gth: 'gothic', ful: 'gothic', aar: 'gothic', // Gothic Plate, Full Plate Mail, Ancient Armor
}
/** Helmet family by normal-tier code; circlets, druid pelts and barbarian helms go by item type. */
const HELM_BY_FAMILY: Readonly<Record<string, MeshPaperdollHelm>> = {
  cap: 'cap', skp: 'skullcap', hlm: 'helm', fhl: 'fullhelm', ghm: 'greathelm', crn: 'crown', msk: 'mask', bhm: 'bone',
}
const HELM_BY_TYPE: Readonly<Record<string, MeshPaperdollHelm>> = { circ: 'circlet', pelt: 'pelt', phlm: 'barbarian' }

/** `Weapons.txt` item type -> weapon family, before the per-family refinements below. */
const WEAPON_BY_TYPE: Readonly<Record<string, MeshPaperdollWeapon>> = {
  axe: 'axe', club: 'club', mace: 'mace', hamm: 'hammer', scep: 'scepter', swor: 'sword', knif: 'dagger',
  spea: 'spear', aspe: 'spear', pole: 'polearm', h2h: 'claw', h2h2: 'claw', staf: 'staff', wand: 'wand',
  orb: 'orb', bow: 'bow', abow: 'bow', xbow: 'crossbow', jave: 'javelin', ajav: 'javelin', tkni: 'tknife',
  taxe: 'taxe', tpot: 'tpotion',
}
/** Families (normal-tier codes) that get their own model inside a type. */
const WEAPON_BY_FAMILY: Readonly<Record<string, MeshPaperdollWeapon>> = {
  mpi: 'pick', // Military Pick
  scm: 'saber', sbr: 'saber', flc: 'saber', // Scimitar, Saber, Falchion
  tri: 'trident',
  scy: 'scythe', wsc: 'scythe', // Scythe, War Scythe
}
/** Two-handed variants of a one-handed family. */
const TWO_HANDED_WEAPON: Readonly<Partial<Record<MeshPaperdollWeapon, MeshPaperdollWeapon>>> = {
  axe: 'axe2h', hammer: 'hammer2h', sword: 'sword2h',
}
/** Shield families (normal-tier codes) by shape; paladin shields and necromancer heads go by type. */
const OFFHAND_BY_FAMILY: Readonly<Record<string, MeshPaperdollOffhand>> = {
  buc: 'buckler', sml: 'shield', lrg: 'shield', kit: 'kite', gts: 'kite', tow: 'tower', bsh: 'spiked', spk: 'spiked',
}

interface BaseRow {
  readonly code: string
  readonly type: string
  readonly normcode?: string | undefined
  readonly ubercode?: string | undefined
  readonly ultracode?: string | undefined
  readonly twoHanded?: boolean | number | undefined
}

let baseRows: ReadonlyMap<string, BaseRow> | null = null

function baseRow(code: string | undefined): BaseRow | undefined {
  if (code === undefined) return undefined
  const key = code.trim().toLowerCase()
  if (key.length === 0) return undefined
  if (baseRows === null) {
    const tables = getEmbeddedDropTables()
    const rows = new Map<string, BaseRow>()
    for (const table of [tables.armor, tables.weapons]) {
      for (const row of (table as unknown as { readonly all: readonly BaseRow[] }).all) {
        rows.set(row.code.trim().toLowerCase(), row)
      }
    }
    baseRows = rows
  }
  return baseRows.get(key)
}

/** Family (normal-tier code) of a base item; rows without a `normcode` are their own family. */
function family(row: BaseRow): string {
  const norm = row.normcode?.trim().toLowerCase()
  return norm !== undefined && norm.length > 0 ? norm : row.code.trim().toLowerCase()
}

/** 1 normal, 2 exceptional, 3 elite (`normcode` / `ubercode` / `ultracode` of the row). */
function tier(row: BaseRow): 1 | 2 | 3 {
  const code = row.code.trim().toLowerCase()
  if (row.ultracode?.trim().toLowerCase() === code) return 3
  if (row.ubercode?.trim().toLowerCase() === code) return 2
  return 1
}

function helmOf(row: BaseRow): MeshPaperdollHelm {
  const byType = HELM_BY_TYPE[row.type]
  if (byType !== undefined) return byType
  return row.type === 'helm' ? (HELM_BY_FAMILY[family(row)] ?? 'none') : 'none'
}

function armorOf(row: BaseRow): MeshPaperdollArmor {
  if (row.type !== 'tors') return 'none'
  const fam = ARMOR_BY_FAMILY[family(row)]
  return fam === undefined ? 'none' : `${fam}${tier(row)}`
}

function weaponOf(row: BaseRow): MeshPaperdollWeapon {
  const byType = WEAPON_BY_TYPE[row.type]
  if (byType === undefined) return 'none'
  const refined = WEAPON_BY_FAMILY[family(row)] ?? byType
  return (row.twoHanded ? TWO_HANDED_WEAPON[refined] : undefined) ?? refined
}

function offhandOf(row: BaseRow): MeshPaperdollOffhand {
  if (row.type === 'ashd') return 'paladin'
  if (row.type === 'head') return 'head'
  if (row.type !== 'shie') return 'none'
  // Every 1.13c `shie` row belongs to one of the eight families; an unknown one reads as a plain shield.
  return OFFHAND_BY_FAMILY[family(row)] ?? 'shield'
}

/** Map worn base item codes to the paper-doll selection. Unknown codes count as an empty slot. */
export function resolveMeshPaperdollSelection(equipment: MeshPaperdollEquipment): MeshPaperdollSelection {
  const helmRow = baseRow(equipment.helm)
  const armorRow = baseRow(equipment.armor)
  const hands = [
    { row: baseRow(equipment.hand1), quality: equipment.hand1Quality, unique: equipment.hand1Unique },
    { row: baseRow(equipment.hand2), quality: equipment.hand2Quality, unique: equipment.hand2Unique },
  ]
  let weaponUnique: number | undefined
  let offhandUnique: number | undefined

  let weapon: MeshPaperdollWeapon = 'none'
  let offhand: MeshPaperdollOffhand = 'none'
  let weaponGlow: MeshPaperdollGlow = 'none'
  let offhandGlow: MeshPaperdollGlow = 'none'
  for (const { row, quality, unique } of hands) {
    if (!row) continue
    const asOffhand = offhandOf(row)
    if (asOffhand !== 'none') {
      if (offhand === 'none') {
        offhand = asOffhand
        offhandGlow = meshPaperdollGlowForQuality(quality)
      }
      continue
    }
    const asWeapon = weaponOf(row)
    if (asWeapon === 'none') continue
    // 12-bit wire field; 0xfff marks "no row".
    const uniqueId = quality === 7 && unique !== undefined && unique >= 0 && unique < 0xfff ? unique : undefined
    if (weapon === 'none') {
      weapon = asWeapon
      weaponGlow = meshPaperdollGlowForQuality(quality)
      weaponUnique = uniqueId
    } else if (offhand === 'none') {
      // Dual wielding: the second weapon goes to the off hand.
      // `weaponOf` never yields the one-handed greatsword variant (it is decided below).
      offhand = `w-${asWeapon as Exclude<MeshPaperdollWeapon, 'none' | 'sword2h1'>}`
      offhandGlow = meshPaperdollGlowForQuality(quality)
      offhandUnique = uniqueId
    }
  }
  // 1.13c lets a Barbarian hold a two-handed sword in one hand whenever the other hand is occupied.
  if (weapon === 'sword2h' && offhand !== 'none') weapon = 'sword2h1'
  const helm = helmRow ? helmOf(helmRow) : 'none'
  const armor = armorRow ? armorOf(armorRow) : 'none'
  return {
    weapon, offhand, helm, armor, weaponGlow, offhandGlow,
    ...(weaponUnique !== undefined ? { weaponUnique } : {}),
    ...(offhandUnique !== undefined ? { offhandUnique } : {}),
  }
}

const SLOT_ORDER = ['armor', 'helm', 'offhand', 'weapon'] as const

/**
 * Compact stable key of a selection (`armor=quilted1,helm=none,...`), safe to carry on a drawable.
 * Glowing items append `offhandGlow=<tier>` / `weaponGlow=<tier>`.
 */
export function encodeMeshPaperdollSelection(selection: MeshPaperdollSelection): string {
  const parts = SLOT_ORDER.map((slot) => `${slot}=${selection[slot]}`)
  if (selection.offhandGlow !== 'none') parts.push(`offhandGlow=${selection.offhandGlow}`)
  if (selection.weaponGlow !== 'none') parts.push(`weaponGlow=${selection.weaponGlow}`)
  if (selection.offhandUnique !== undefined) parts.push(`offhandUnique=${String(selection.offhandUnique)}`)
  if (selection.weaponUnique !== undefined) parts.push(`weaponUnique=${String(selection.weaponUnique)}`)
  return parts.join(',')
}

/** `UniqueItems.txt` row ids a decoded selection asks a weapon pack model for, per hand. */
export function meshPaperdollUniqueWeapons(
  decodedSelection: Readonly<Record<string, string>>,
): { readonly weapon: number | null; readonly offhand: number | null } {
  const id = (raw: string | undefined): number | null => {
    if (raw === undefined || !/^\d{1,4}$/.test(raw)) return null
    return Number(raw)
  }
  return {
    weapon: id(decodedSelection.weaponUnique),
    // Only a dual wielder's second weapon: shields and heads have no pack models.
    offhand: decodedSelection.offhand?.startsWith('w-') ? id(decodedSelection.offhandUnique) : null,
  }
}

/**
 * The selection to wear when weapon pack models stand in for the hands marked in `attached`: that
 * hand's family model is taken off (option `none`) and, the pack model being its own mark of
 * quality, so is its quality glow. A hand that is not attached keeps the family model and the glow.
 * The caller still reads the weapon family from the original selection to pick the stance clips.
 */
export function applyMeshPaperdollUniqueLooks(
  decodedSelection: Readonly<Record<string, string>>,
  attached: { readonly weapon: boolean; readonly offhand: boolean },
): Readonly<Record<string, string>> {
  if (!attached.weapon && !attached.offhand) return decodedSelection
  const out: Record<string, string> = { ...decodedSelection }
  if (attached.weapon) {
    out.weapon = 'none'
    delete out.weaponGlow
  }
  if (attached.offhand) {
    out.offhand = 'none'
    delete out.offhandGlow
  }
  return out
}

/** Glow tint per slot (`{ weapon: rgb, offhand: rgb }`) of a decoded selection record. */
export function meshPaperdollGlowBySlot(
  decodedSelection: Readonly<Record<string, string>>,
): Readonly<Record<string, readonly [number, number, number]>> {
  const out: Record<string, readonly [number, number, number]> = {}
  for (const slot of ['weapon', 'offhand'] as const) {
    const tier = decodedSelection[`${slot}Glow`]
    const rgb = tier === undefined ? undefined : (MESH_PAPERDOLL_GLOW_RGB as Record<string, readonly [number, number, number]>)[tier]
    if (rgb) out[slot] = rgb
  }
  return out
}

const decoded = new Map<string, Readonly<Record<string, string>>>()

/** Inverse of {@link encodeMeshPaperdollSelection} as a generic slot -> option record (memoised). */
export function decodeMeshPaperdollSelection(key: string): Readonly<Record<string, string>> {
  let out = decoded.get(key)
  if (!out) {
    const record: Record<string, string> = {}
    for (const part of key.split(',')) {
      const eq = part.indexOf('=')
      if (eq > 0 && eq < part.length - 1) record[part.slice(0, eq)] = part.slice(eq + 1)
    }
    out = Object.freeze(record)
    if (decoded.size > 4096) decoded.clear()
    decoded.set(key, out)
  }
  return out
}

/**
 * Selection key for a player's equipment map (`bodyLoc` -> item code), honouring the active weapon
 * set exactly like `resolveEquipmentSlotsToAppearanceInput` (swap slots 11/12 when set 1 is active
 * and slots 4/5 are empty).
 */
export function resolveMeshPaperdollKeyFromSlots(
  codeAt: (bodyLoc: number) => string | undefined,
  weaponSet: number,
  qualityAt: (bodyLoc: number) => number | undefined = () => undefined,
  uniqueAt: (bodyLoc: number) => number | undefined = () => undefined,
): string {
  const useSwap =
    weaponSet === 1 && codeAt(4) === undefined && codeAt(5) === undefined &&
    (codeAt(11) !== undefined || codeAt(12) !== undefined)
  return encodeMeshPaperdollSelection(
    resolveMeshPaperdollSelection({
      helm: codeAt(1),
      armor: codeAt(3),
      hand1: codeAt(useSwap ? 11 : 4),
      hand2: codeAt(useSwap ? 12 : 5),
      hand1Quality: qualityAt(useSwap ? 11 : 4),
      hand2Quality: qualityAt(useSwap ? 12 : 5),
      hand1Unique: uniqueAt(useSwap ? 11 : 4),
      hand2Unique: uniqueAt(useSwap ? 12 : 5),
    }),
  )
}
