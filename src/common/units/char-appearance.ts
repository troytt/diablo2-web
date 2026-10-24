/**
 * Dynamic Sorceress (`so`) paperdoll appearance resolver and runtime layer compositor.
 *
 * Implements the 1.13c composite layer, weapon class, and palette shift pipeline:
 * - Resolves equipped `helm`, `armor`, `weapon1`, and `weapon2` into the 10 active
 *   character composite layers (`hd`, `tr`, `lg`, `ra`, `la`, `rh`, `lh`, `sh`, `s1`, `s2`)
 *   and active weapon animation class (`hth`, `1hs`, `1ht`, `stf`, `bow`, `xbw`, `2hs`, `2ht`).
 * - Resolves per-item color shifts (`Transform` 1..8 x `Colors.txt` 0..20) across Unique, Set,
 *   Magic/Rare/Crafted (suffixes before prefixes), Socketed Gem, and AutoMagic items.
 * - Composites multi-mode DCC layers in COF priority order with 256-byte palette remap tables
 *   and packs all 11 animation modes into an R8 indexed atlas page.
 */

import { decodeCof, cofLayerOrder, type CofFile } from '../formats/cof.ts'
import { decodeDcc, type DccFile } from '../formats/dcc.ts'
import type { SpriteFrame, SpriteSheet } from '../formats/sprite.ts'
import type { AnimClipMeta } from './unit-types.ts'
import { COMPONENTS, dir64ToDcc } from './character.ts'
import type { DropTables } from '../items/drop-tables.ts'
import { getEmbeddedDropTables } from '../items/embedded-drop-tables.ts'
import { COLOR_CODES } from '../items/gems-data.ts'
import type { Item } from '../items/items.ts'
import { onlineItemDataToUiInventoryItem, resolveItemColorTransform, type ItemData } from '../items/item-bridge.ts'
import type { EquipSlotId, UiItemQuality } from '../items/inventory-model.ts'

/** All 7 canonical 1.13c player class 2-letter tokens (`classId` 0..6). */
export const PLAYER_CLASS_TOKENS = ['am', 'so', 'ne', 'pa', 'ba', 'dz', 'ai'] as const

export type PlayerClassToken = (typeof PLAYER_CLASS_TOKENS)[number]

/** All 10 active paperdoll component layers used by character animations. */
export const SORCERESS_COMPONENTS = [
  'hd',
  'tr',
  'lg',
  'ra',
  'la',
  'rh',
  'lh',
  'sh',
  's1',
  's2',
] as const

export type SorceressComponent = (typeof SORCERESS_COMPONENTS)[number]
export type CharacterComponent = SorceressComponent

/** Standard player animation modes in pack order (includes BL, KK, S1..S4 skill clips, and Throw TH). */
export const SORCERESS_PLAYER_MODES = [
  'wl',
  'nu',
  'rn',
  'a1',
  'a2',
  'bl',
  'sc',
  's1',
  's2',
  's3',
  's4',
  'kk',
  'gh',
  'dt',
  'dd',
  'tn',
  'tw',
  // PlrMode TH=11: inherent throw skills (2 Throw / 4 Left Hand Throw) —
  // without this clip the renderer drops the whole actor for the animation
  // duration (world-renderer returns early when clips['th'] is missing).
  'th',
] as const

const LOOPING_PLAYER_MODES = new Set<string>(['nu', 'wl', 'rn', 'tn', 'tw'])

const ARMOR_TIERS: readonly ('lit' | 'med' | 'hvy')[] = ['lit', 'med', 'hvy']

const VALID_HEAD_VARIANTS = new Set<string>([
  'lit',
  'bhm',
  'cap',
  'crn',
  'fhl',
  'ghm',
  'hlm',
  'msk',
  'skp',
  'ba1',
  'ba2',
  'ba3',
  'ba4',
  'ba5',
  'dr1',
  'dr2',
  'dr3',
  'dr4',
  'dr5',
  'jaw',
  'urn',
  'ci0',
  'ci1',
  'ci2',
  'ci3',
  'cir',
])

/** Visual specification for a single paperdoll layer. */
export interface LayerAppearance {
  /** 3-letter DCC variant code (e.g. `'lit'`, `'cap'`, `'hvy'`, `'ob4'`, `'kit'`), or `null` if unequipped. */
  readonly variant: string | null
  /** Palette shift table index from `Armor.txt` / `Weapons.txt` `Transform` column (`0..8`). */
  readonly transform: number
  /** `Colors.txt` 4-letter code (e.g. `'cgrn'`, `'dpur'`, `'whit'`), or `null` if unshifted. */
  readonly color: string | null
}

/**Per-layer tint shift descriptor (`transform` 1..8 and `Colors.txt` `color` code). */
export interface LayerTintSpec {
  readonly transform: number
  readonly color: string
}

/** Complete resolved visual state of a character paperdoll across all layers and weapon class. */
export interface SorceressAppearanceSpec {
  /** Canonical 2-letter class token (`'am'`, `'so'`, `'ne'`, `'pa'`, `'ba'`, `'dz'`, `'ai'`). */
  readonly classToken?: PlayerClassToken | undefined
  /** Canonical numeric class ID (`0..6`). */
  readonly classId?: number | undefined
  /** Active animation weapon class (`'hth'`, `'1hs'`, `'1ht'`, `'stf'`, `'bow'`, `'xbw'`, `'2hs'`, `'2ht'`, `'ht1'`, `'ht2'`, `'1ss'`, `'1st'`, `'1js'`, `'1jt'`). */
  readonly wclass: string
  /** Per-component visual variant and dye configuration. */
  readonly layers: Readonly<Record<SorceressComponent, LayerAppearance>>
  /** Per-slot tint for `hd` (`null` if untinted). */
  readonly helmTint: LayerTintSpec | null
  /** Per-slot tint for `tr`, `lg`, `ra`, `la`, `s1`, `s2` (`null` if untinted). */
  readonly armorTint: LayerTintSpec | null
  /** Per-slot tint for `sh` (`null` if untinted). */
  readonly shieldTint: LayerTintSpec | null
  /** Per-slot tint for `rh` / `lh` (`null` if untinted). */
  readonly weaponTint: LayerTintSpec | null
}

export type CharacterAppearanceSpec = SorceressAppearanceSpec

/** Minimal item interface required to resolve equipped paperdoll appearance. */
export interface ResolvableEquippedItem {
  readonly code?: string | undefined
  readonly itemCode?: string | undefined
  readonly name?: string | undefined
  readonly quality?: UiItemQuality | undefined
  readonly chrtransform?: string | undefined
  readonly invtransform?: string | undefined
  readonly tint?: string | null | undefined
  readonly color?: string | null | undefined
  readonly magicColor?: string | null | undefined
  readonly identified?: boolean | undefined
  readonly isGambleMystery?: boolean | undefined
  readonly rawItem?: Item | undefined
}

export type EquippedAppearanceInput = Partial<
  Record<EquipSlotId, ResolvableEquippedItem | string | null | undefined>
> & {
  readonly shield?: ResolvableEquippedItem | string | null | undefined
  readonly rightHand?: ResolvableEquippedItem | string | null | undefined
  readonly leftHand?: ResolvableEquippedItem | string | null | undefined
  readonly helmTint?: LayerTintSpec | string | null | undefined
  readonly armorTint?: LayerTintSpec | string | null | undefined
  readonly shieldTint?: LayerTintSpec | string | null | undefined
  readonly weaponTint?: LayerTintSpec | string | null | undefined
  readonly hasHolyShield?: boolean | undefined
}

export type EquipmentAppearanceInput = EquippedAppearanceInput

/** Manifest structure for `samples/d2-packs/chars/so/manifest.json`. */
export interface SorceressLayerPackManifest {
  readonly schema: 1
  readonly metaFile: string
  readonly cofs: Readonly<Record<string, readonly [number, number]>>
  readonly palettes: Readonly<Record<number, readonly [number, number]>>
  readonly animClips: Readonly<
    Record<string, { readonly speed: number; readonly events: readonly (readonly [number, number])[] }>
  >
  readonly layers: Readonly<
    Record<
      string,
      {
        readonly file: string
        readonly dccs: Readonly<Record<string, readonly [number, number]>>
      }
    >
  >
}

/** Result of compositing and shelf-packing all 11 Sorceress animation modes into an R8 atlas. */
export interface CompositedSorceressR8 {
  readonly key: string
  readonly spec: SorceressAppearanceSpec
  readonly r8: Uint8Array
  readonly width: number
  readonly height: number
  readonly directions: number
  readonly walk: number
  readonly stand: number
  readonly members: number
  readonly clips: Readonly<Record<string, AnimClipMeta>>
  readonly groups: readonly (readonly [number, number, number, number, number, number])[][]
}

/** Optional composite filters. Char select only needs direction 0 and skips the other 15. */
export interface CompositeOptions {
  readonly directions?: readonly number[]
}

/** Pluggable resource loader for browser `fetch` or Node test runners. */
export interface CharLayerAssetLoader {
  loadJson(relPath: string): Promise<unknown>
  loadBin(relPath: string): Promise<Uint8Array>
}

function tierCode(value: number | undefined): 'lit' | 'med' | 'hvy' {
  const idx = Math.max(0, Math.min(2, Math.trunc(value ?? 0)))
  return ARMOR_TIERS[idx] ?? 'lit'
}

function isItemUnidentified(item: ResolvableEquippedItem): boolean {
  return Boolean(
    item.identified === false ||
      item.isGambleMystery === true ||
      item.rawItem?.identified === false ||
      item.rawItem?.isGambleMystery === true ||
      (item.rawItem?.flags !== undefined && item.rawItem.flags.identified === false),
  )
}

function resolveEquippedChrColor(
  item: ResolvableEquippedItem,
  code: string,
  dropTables: DropTables,
  slotTintOverride?: LayerTintSpec | string | null,
): string | null {
  if (isItemUnidentified(item)) {
    return null
  }
  const explicitColor =
    item.chrtransform ??
    item.tint ??
    item.color ??
    item.magicColor ??
    (typeof slotTintOverride === 'string' ? slotTintOverride : slotTintOverride?.color)
  if (explicitColor && COLOR_CODES.includes(explicitColor as any)) {
    return explicitColor
  }
  const resolved = resolveItemColorTransform(
    item.rawItem ?? ({
      code,
      name: item.name,
      quality: item.quality,
      identified: item.identified,
      runewordRunes: (item as any).runewordRunes,
    } as any),
    item.quality ?? 'normal',
    code,
    dropTables,
  )
  if (resolved.chrtransform && COLOR_CODES.includes(resolved.chrtransform as any)) {
    return resolved.chrtransform
  }
  return null
}

function normalizeEquippedSlotItem(
  slot: ResolvableEquippedItem | string | null | undefined,
): ResolvableEquippedItem | undefined {
  if (!slot) return undefined
  if (typeof slot === 'string') {
    return { code: slot }
  }
  if (!slot.code && slot.itemCode) {
    return { ...slot, code: slot.itemCode }
  }
  return slot
}

function normalizeTintSpec(
  tint: LayerTintSpec | string | null | undefined,
  fallbackTransform: number,
): LayerTintSpec | null {
  if (!tint) return null
  if (typeof tint === 'string') {
    return { transform: fallbackTransform > 0 ? fallbackTransform : 1, color: tint }
  }
  return tint.transform > 0 && tint.color ? tint : null
}

const CLASS_NAME_TO_ID: Readonly<Record<string, number>> = {
  am: 0,
  ama: 0,
  amazon: 0,
  so: 1,
  sor: 1,
  sorc: 1,
  sorceress: 1,
  ne: 2,
  nec: 2,
  necro: 2,
  necromancer: 2,
  pa: 3,
  pal: 3,
  paladin: 3,
  ba: 4,
  bar: 4,
  barb: 4,
  barbarian: 4,
  dz: 5,
  dr: 5,
  dru: 5,
  druid: 5,
  ai: 6,
  as: 6,
  ass: 6,
  asn: 6,
  assassin: 6,
}

/**
 * Normalize a character class identifier (numeric `0..6` or token/name like `'so'`, `'ba'`, `'dz'`, `'ai'`)
 * into canonical `{ classId, classToken }`. Fails fast on invalid class identifiers.
 */
export function normalizeCharacterClass(classTokenOrId: string | number): {
  readonly classId: number
  readonly classToken: PlayerClassToken
} {
  if (typeof classTokenOrId === 'number') {
    const id = Math.trunc(classTokenOrId)
    const token = PLAYER_CLASS_TOKENS[id]
    if (!token) {
      throw new Error(`Invalid character classId ${String(classTokenOrId)}`)
    }
    return { classId: id, classToken: token }
  }
  const key = classTokenOrId.trim().toLowerCase()
  const id = CLASS_NAME_TO_ID[key]
  if (id === undefined) {
    throw new Error(`Invalid character class token "${classTokenOrId}"`)
  }
  return { classId: id, classToken: PLAYER_CLASS_TOKENS[id]! }
}

export interface LayerTintInputSpec {
  readonly layers: Readonly<Record<SorceressComponent, LayerAppearance>>
  readonly helmTint?: LayerTintSpec | string | null | undefined
  readonly armorTint?: LayerTintSpec | string | null | undefined
  readonly shieldTint?: LayerTintSpec | string | null | undefined
  readonly weaponTint?: LayerTintSpec | string | null | undefined
}

/**
 * Resolve the effective palette tint (`{ transform, color }`) for a specific paperdoll component layer.
 * Enforces strict per-slot isolation so helm, armor, shield, and weapon tints never bleed across layers.
 */
export function getLayerTint(
  spec: LayerTintInputSpec,
  comp: SorceressComponent,
): LayerTintSpec | null {
  const layer = spec.layers[comp]
  if (!layer || !layer.variant) return null

  if (comp === 'hd') {
    if (spec.helmTint !== undefined) return normalizeTintSpec(spec.helmTint, layer.transform || 5)
    return layer.transform > 0 && layer.color ? { transform: layer.transform, color: layer.color } : null
  }
  if (comp === 'tr' || comp === 'lg' || comp === 'ra' || comp === 'la' || comp === 's1' || comp === 's2') {
    if (spec.armorTint !== undefined) return normalizeTintSpec(spec.armorTint, layer.transform || 7)
    return layer.transform > 0 && layer.color ? { transform: layer.transform, color: layer.color } : null
  }
  if (comp === 'sh') {
    if (spec.shieldTint !== undefined) return normalizeTintSpec(spec.shieldTint, layer.transform || 1)
    return layer.transform > 0 && layer.color ? { transform: layer.transform, color: layer.color } : null
  }
  if (comp === 'rh' || comp === 'lh') {
    if (layer.transform > 0 && layer.color) {
      return { transform: layer.transform, color: layer.color }
    }
    const isDualWield = Boolean(spec.layers?.rh?.variant) && Boolean(spec.layers?.lh?.variant)
    if (isDualWield && layer.color === null) {
      return null
    }
    if (spec.weaponTint !== undefined) return normalizeTintSpec(spec.weaponTint, layer.transform || 1)
    return null
  }
  return null
}

/**
 * Produce a deterministic string key uniquely identifying a character appearance state.
 */
export function appearanceKey(spec: SorceressAppearanceSpec): string {
  const parts: string[] = []
  if (spec.classToken && spec.classToken !== 'so') {
    parts.push(`cls=${spec.classToken}`)
  }
  parts.push(`wc=${spec.wclass}`)
  for (const comp of SORCERESS_COMPONENTS) {
    const layer = spec.layers[comp]
    const v = layer.variant ?? '-'
    const tint = getLayerTint(spec, comp)
    const t = tint && tint.transform > 0 && tint.color ? String(tint.transform) : '0'
    const c = tint && tint.transform > 0 && tint.color ? tint.color : '-'
    parts.push(`${comp}=${v}:${t}:${c}`)
  }
  return parts.join('|')
}

/**
 * Check whether the resolved appearance is the baseline unarmed `lit` state
 * (matching the static pre-baked `char-<token>.r8`).
 */
export function isDefaultUnarmedAppearance(spec: SorceressAppearanceSpec): boolean {
  if (spec.wclass !== 'hth') return false
  for (const comp of ['hd', 'tr', 'lg', 'ra', 'la'] as const) {
    const l = spec.layers[comp]
    if (l.variant !== 'lit') return false
    const tint = getLayerTint(spec, comp)
    if (tint && tint.transform > 0 && tint.color) return false
  }
  for (const comp of ['rh', 'lh', 'sh', 's1', 's2'] as const) {
    if (spec.layers[comp].variant !== null) return false
  }
  return true
}

/**
 * Baseline unarmed Amazon (`am`, `classId = 0`) paperdoll appearance (`States.txt` row 63 `dopplezon` fallback).
 */
export const DEFAULT_AMAZON_APPEARANCE: SorceressAppearanceSpec = Object.freeze({
  classToken: 'am',
  classId: 0,
  wclass: 'hth',
  layers: Object.freeze({
    hd: Object.freeze({ variant: 'lit', transform: 0, color: null }),
    tr: Object.freeze({ variant: 'lit', transform: 0, color: null }),
    lg: Object.freeze({ variant: 'lit', transform: 0, color: null }),
    ra: Object.freeze({ variant: 'lit', transform: 0, color: null }),
    la: Object.freeze({ variant: 'lit', transform: 0, color: null }),
    rh: Object.freeze({ variant: null, transform: 0, color: null }),
    lh: Object.freeze({ variant: null, transform: 0, color: null }),
    sh: Object.freeze({ variant: null, transform: 0, color: null }),
    s1: Object.freeze({ variant: null, transform: 0, color: null }),
    s2: Object.freeze({ variant: null, transform: 0, color: null }),
  }),
  helmTint: null,
  armorTint: null,
  shieldTint: null,
  weaponTint: null,
})

/**
 * Canonical 1.13c Valkyrie (`classId = 357`) paperdoll disguise appearance:
 * Full Plate Mail (`hvy` across `tr/lg/ra/la/s1/s2`) + Pike (`rh = 'pik'`, `wclass = '2ht'`)
 * with Light Gold (`'lgld'`) tint (`States.txt` row 93 `valkyrie`: `disguise=1, gfxtype=2, gfxclass=0`).
 */
export const VALKYRIE_113C_APPEARANCE: SorceressAppearanceSpec = Object.freeze({
  classToken: 'am',
  classId: 0,
  wclass: '2ht',
  layers: Object.freeze({
    hd: Object.freeze({ variant: 'lit', transform: 0, color: null }),
    tr: Object.freeze({ variant: 'hvy', transform: 7, color: 'lgld' }),
    lg: Object.freeze({ variant: 'hvy', transform: 7, color: 'lgld' }),
    ra: Object.freeze({ variant: 'hvy', transform: 7, color: 'lgld' }),
    la: Object.freeze({ variant: 'hvy', transform: 7, color: 'lgld' }),
    rh: Object.freeze({ variant: 'pik', transform: 1, color: 'lgld' }),
    lh: Object.freeze({ variant: null, transform: 0, color: null }),
    sh: Object.freeze({ variant: null, transform: 0, color: null }),
    s1: Object.freeze({ variant: 'hvy', transform: 7, color: 'lgld' }),
    s2: Object.freeze({ variant: 'hvy', transform: 7, color: 'lgld' }),
  }),
  helmTint: null,
  armorTint: Object.freeze({ transform: 7, color: 'lgld' }),
  shieldTint: null,
  weaponTint: Object.freeze({ transform: 1, color: 'lgld' }),
})

export interface EquipmentSlotArrayEntry {
  readonly slot?: number | undefined
  readonly bodyLoc?: number | undefined
  readonly id?: number | undefined
  readonly code?: string | undefined
  readonly itemCode?: string | undefined
  readonly name?: string | undefined
  readonly quality?: UiItemQuality | number | undefined
  readonly chrtransform?: string | undefined
  readonly tint?: string | null | undefined
  readonly color?: string | null | undefined
  readonly magicColor?: string | null | undefined
  readonly identified?: boolean | undefined
}

export type EquipmentSlotInput = (
  | ReadonlyMap<number, ItemData>
  | readonly EquipmentSlotArrayEntry[]
) & {
  readonly hasHolyShield?: boolean | undefined
}

/**
 * Convert a player's `equipmentBySlot` map (indexed by D2GS `bodyLoc` 1..12) or array of slot entries
 * and active `weaponSet` (`0 | 1`) into the `Partial<Record<EquipSlotId, ResolvableEquippedItem>>`
 * expected by `resolveCharacterAppearance`.
 *
 * Non-visual slots (`amulet` = 2, `ring` = 6/7, `belt` = 8, `boots` = 9, `gloves` = 10) have
 * `component = 16` (`COMP_NONE` in 1.13c `Armor.txt` / `Misc.txt`) and do not affect paperdoll layers.
 */
export function resolveEquipmentSlotsToAppearanceInput(
  equipmentBySlot: EquipmentSlotInput,
  weaponSet: 0 | 1 = 0,
  sockets?: ReadonlyMap<number, readonly ItemData[]>,
  dropTables?: DropTables,
  hasHolyShield?: boolean,
): EquippedAppearanceInput {
  const tables = dropTables ?? getEmbeddedDropTables()
  const effectiveHolyShield =
    hasHolyShield ?? (equipmentBySlot as { readonly hasHolyShield?: boolean | undefined })?.hasHolyShield
  const toResolvable = (item: ItemData | EquipmentSlotArrayEntry | undefined): ResolvableEquippedItem | undefined => {
    if (!item) return undefined
    if ('container' in item && typeof item.id === 'number') {
      const children = sockets?.get(item.id)
      return onlineItemDataToUiInventoryItem(item as ItemData, children, tables)
    }
    const entry = item as EquipmentSlotArrayEntry
    const code = entry.code ?? entry.itemCode
    if (!code) return undefined
    const chrtransform = entry.chrtransform ?? entry.tint ?? entry.color ?? entry.magicColor ?? undefined
    return {
      code,
      name: entry.name,
      quality: typeof entry.quality === 'string' ? entry.quality : 'normal',
      chrtransform,
      identified: entry.identified ?? true,
    }
  }

  if (Array.isArray(equipmentBySlot)) {
    const bySlot = new Map<number, EquipmentSlotArrayEntry>()
    for (const entry of equipmentBySlot) {
      const s = entry.slot ?? entry.bodyLoc
      if (typeof s === 'number') {
        bySlot.set(s, entry)
      }
    }
    const useSwapSlots =
      weaponSet === 1 &&
      bySlot.get(4) === undefined &&
      bySlot.get(5) === undefined &&
      (bySlot.get(11) !== undefined || bySlot.get(12) !== undefined)
    const handSlot1 = useSwapSlots ? 11 : 4
    const handSlot2 = useSwapSlots ? 12 : 5
    return {
      helm: toResolvable(bySlot.get(1)),
      armor: toResolvable(bySlot.get(3)),
      weapon1: toResolvable(bySlot.get(handSlot1)),
      weapon2: toResolvable(bySlot.get(handSlot2)),
      ...(effectiveHolyShield !== undefined ? { hasHolyShield: effectiveHolyShield } : {}),
    }
  }

  const map = equipmentBySlot as ReadonlyMap<number, ItemData>
  const useSwapSlots =
    weaponSet === 1 &&
    map.get(4) === undefined &&
    map.get(5) === undefined &&
    (map.get(11) !== undefined || map.get(12) !== undefined)
  const handSlot1 = useSwapSlots ? 11 : 4
  const handSlot2 = useSwapSlots ? 12 : 5
  return {
    helm: toResolvable(map.get(1)),
    armor: toResolvable(map.get(3)),
    weapon1: toResolvable(map.get(handSlot1)),
    weapon2: toResolvable(map.get(handSlot2)),
    ...(effectiveHolyShield !== undefined ? { hasHolyShield: effectiveHolyShield } : {}),
  }
}

/**
 * Canonical 1.13c `States.txt` rows with non-empty `itemtype` + `itemtrans` columns:
 * - State 16 (`enchant`): `itemtype = 'weap'`, `itemtrans = 'cred'` (Crystal Red)
 * - State 31 (`venomclaws`): `itemtype = 'mele'`, `itemtrans = 'cgrn'` (Crystal Green)
 */
export const STATE_ITEM_TRANS_113C: Readonly<
  Record<number, { readonly itemType: 'weap' | 'mele'; readonly itemTrans: string }>
> = Object.freeze({
  16: { itemType: 'weap', itemTrans: 'cred' },
  31: { itemType: 'mele', itemTrans: 'cgrn' },
})

/**
 * Apply 1.13c `States.txt` `itemtype` / `itemtrans` weapon palette overrides (e.g. State 16 `enchant` ->
 * `itemtype=weap, itemtrans=cred`) to a resolved character paperdoll appearance.
 */
export function applyStateItemTransToAppearance(
  spec: SorceressAppearanceSpec,
  states: Iterable<number> | null | undefined,
): SorceressAppearanceSpec {
  if (!states) return spec
  let hasEnchant = false
  let hasVenom = false
  let hasHolyShield = false
  for (const s of states) {
    if (s === 16) hasEnchant = true
    else if (s === 31) hasVenom = true
    else if (s === 101) hasHolyShield = true
  }
  let nextSpec = spec
  const isTwoHandedWClass =
    spec.wclass === 'bow' ||
    spec.wclass === 'xbw' ||
    spec.wclass === 'stf' ||
    spec.wclass === '2hs' ||
    spec.wclass === '2ht' ||
    spec.wclass === '1ss' ||
    spec.wclass === '1st' ||
    spec.wclass === '1js' ||
    spec.wclass === '1jt' ||
    spec.wclass === 'ht2'
  if (hasHolyShield && !isTwoHandedWClass && spec.layers.sh.variant !== 'hsh') {
    nextSpec = {
      ...nextSpec,
      layers: {
        ...nextSpec.layers,
        sh: { variant: 'hsh', transform: 0, color: null },
      },
      shieldTint: null,
    }
  }
  const isRangedWeaponClass = nextSpec.wclass === 'bow' || nextSpec.wclass === 'xbw'
  const itemTrans = hasEnchant ? 'cred' : hasVenom && !isRangedWeaponClass ? 'cgrn' : null
  if (!itemTrans) return nextSpec

  const rh = nextSpec.layers.rh
  const lh = nextSpec.layers.lh
  if (!rh.variant && !lh.variant) return nextSpec

  const nextRh: LayerAppearance = rh.variant
    ? { variant: rh.variant, transform: rh.transform > 0 ? rh.transform : 1, color: itemTrans }
    : rh
  const nextLh: LayerAppearance = lh.variant
    ? { variant: lh.variant, transform: lh.transform > 0 ? lh.transform : 1, color: itemTrans }
    : lh
  const effTransform = (nextRh.variant ? nextRh.transform : nextLh.transform) || 1
  return {
    ...nextSpec,
    layers: {
      ...nextSpec.layers,
      rh: nextRh,
      lh: nextLh,
    },
    weaponTint: { transform: effTransform, color: itemTrans },
  }
}

/**
 * Resolve any of the 7 player classes' 10 paperdoll layers, weapon class, and per-slot color shifts
 * from the currently equipped items per 1.13c `D2Composit` & `ITEMS_GetColor`.
 */
export function resolveCharacterAppearance(
  classTokenOrId: string | number,
  equipped: EquippedAppearanceInput,
  dropTables: DropTables = getEmbeddedDropTables(),
  states?: Iterable<number> | null | undefined,
): CharacterAppearanceSpec {
  const { classId, classToken } = normalizeCharacterClass(classTokenOrId)
  const layers: Record<SorceressComponent, LayerAppearance> = {
    hd: { variant: 'lit', transform: 0, color: null },
    tr: { variant: 'lit', transform: 0, color: null },
    lg: { variant: 'lit', transform: 0, color: null },
    ra: { variant: 'lit', transform: 0, color: null },
    la: { variant: 'lit', transform: 0, color: null },
    rh: { variant: null, transform: 0, color: null },
    lh: { variant: null, transform: 0, color: null },
    sh: { variant: null, transform: 0, color: null },
    s1: { variant: null, transform: 0, color: null },
    s2: { variant: null, transform: 0, color: null },
  }

  let helmTint: LayerTintSpec | null = null
  let armorTint: LayerTintSpec | null = null
  let shieldTint: LayerTintSpec | null = null
  let weaponTint: LayerTintSpec | null = null

  // 1. Helm -> HD (Circlets keep default 'lit' head and do not dye hair/skin via helmTint)
  const helmItem = normalizeEquippedSlotItem(equipped.helm)
  const helmCode = helmItem?.code?.trim()
  if (helmItem && helmCode) {
    if (!/^[a-z0-9]{3}$/i.test(helmCode)) {
      throw new Error(`Unknown helm item code "${helmCode}" in resolveCharacterAppearance`)
    }
    const helmBase = dropTables.armor.get(helmCode)
    if (helmBase) {
      const isCirclet =
        helmBase.type === 'circ' ||
        helmBase.alternategfx === 'cir' ||
        helmBase.alternategfx === 'lit' ||
        dropTables.isA(helmBase.type, 'circ')
      if (isCirclet) {
        const transform = helmBase.transform || 5
        const color = resolveEquippedChrColor(helmItem, helmCode, dropTables, equipped.helmTint)
        layers.hd = { variant: 'lit', transform: color ? transform : 0, color }
      } else {
        const rawVar = (helmBase.alternategfx || helmBase.code).toLowerCase()
        if (!VALID_HEAD_VARIANTS.has(rawVar)) {
          throw new Error(`Invalid head layer variant "${rawVar}" for helm "${helmCode}"`)
        }
        const transform = helmBase.transform ?? 0
        const color = transform > 0 ? resolveEquippedChrColor(helmItem, helmCode, dropTables, equipped.helmTint) : null
        layers.hd = { variant: rawVar, transform, color }
        if (transform > 0 && color) {
          helmTint = { transform, color }
        }
      }
    }
  }

  // 2. Body Armor -> TR, LG, RA, LA, S1, S2
  const armorItem = normalizeEquippedSlotItem(equipped.armor)
  const armorCode = armorItem?.code?.trim()
  if (armorItem && armorCode) {
    if (!/^[a-z0-9]{3}$/i.test(armorCode)) {
      throw new Error(`Unknown armor item code "${armorCode}" in resolveCharacterAppearance`)
    }
    const armorBase = dropTables.armor.get(armorCode)
    if (armorBase) {
      const transform = armorBase.transform ?? 0
      const color = transform > 0 ? resolveEquippedChrColor(armorItem, armorCode, dropTables, equipped.armorTint) : null
      layers.tr = { variant: tierCode(armorBase.torso), transform, color }
      layers.lg = { variant: tierCode(armorBase.legs), transform, color }
      layers.ra = { variant: tierCode(armorBase.rArm), transform, color }
      layers.la = { variant: tierCode(armorBase.lArm), transform, color }
      layers.s1 = { variant: tierCode(armorBase.rSPad), transform, color }
      layers.s2 = { variant: tierCode(armorBase.lSPad), transform, color }
      if (transform > 0 && color) {
        armorTint = { transform, color }
      }
    }
  }

  // 3. Weapon1 & Weapon2 / Shield -> wclass, RH (weapons/orbs/staves/crossbows), LH (bows/off-hand weapon), SH (shields)
  let wclass = 'hth'
  let hasTwoHandedWeapon = false
  const handSlot1Item = normalizeEquippedSlotItem(equipped.weapon1 ?? equipped.rightHand)
  const handSlot2Item = normalizeEquippedSlotItem(equipped.weapon2 ?? equipped.shield ?? equipped.leftHand)
  const handSlots = [handSlot1Item, handSlot2Item]

  // Check if a shield is equipped in either hand slot
  let equippedShield: { item: ResolvableEquippedItem; code: string; base: NonNullable<ReturnType<DropTables['armor']['get']>> } | null = null
  const equippedWeapons: { item: ResolvableEquippedItem; code: string; base: NonNullable<ReturnType<DropTables['weapons']['get']>> }[] = []

  for (const handItem of handSlots) {
    const rawCode = handItem?.code?.trim()
    if (!handItem || !rawCode) continue
    if (!/^[a-z0-9]{3}$/i.test(rawCode)) {
      throw new Error(`Unknown hand item code "${rawCode}" in resolveCharacterAppearance`)
    }
    const code = rawCode === '7wa' && handItem.name === 'Colossus Blade' ? '7gd' : rawCode
    const weapBase = dropTables.weapons.get(code)
    if (weapBase) {
      equippedWeapons.push({ item: handItem, code, base: weapBase })
      continue
    }
    const shieldBase = dropTables.armor.get(code)
    if (shieldBase && (shieldBase.component === 7 || shieldBase.type === 'shie' || dropTables.isA(shieldBase.type, 'shie'))) {
      if (!equippedShield) {
        equippedShield = { item: handItem, code, base: shieldBase }
      }
      continue
    }
    const miscBase = dropTables.misc?.get(code)
    if (miscBase) {
      continue
    }
  }

  if (equippedWeapons.length >= 2) {
    // Dual-wielding two weapons (D2Composit.cpp COMPOSIT_GetWeaponClassCode: 1ss, 1st, 1js, 1jt, ht2)
    const primary = equippedWeapons[0]!
    const secondary = equippedWeapons[1]!
    const wc1 = (primary.base.wclass || '1hs').toLowerCase()
    const wc2 = (secondary.base.wclass || '1hs').toLowerCase()
    if (wc1 === 'ht1' && wc2 === 'ht1') {
      wclass = 'ht2'
    } else if (wc1 === '1hs' && wc2 === '1hs') {
      wclass = '1ss'
    } else if (wc1 === '1ht' && wc2 === '1ht') {
      wclass = '1st'
    } else if (wc1 === '1hs' && wc2 === '1ht') {
      wclass = '1js'
    } else if (wc1 === '1ht' && wc2 === '1hs') {
      wclass = '1jt'
    } else {
      wclass = wc1
    }
    const var1 = (primary.base.alternateGfx || primary.base.code).toLowerCase()
    const tf1 = primary.base.transform ?? 0
    const col1 = tf1 > 0 ? resolveEquippedChrColor(primary.item, primary.code, dropTables, equipped.weaponTint) : null
    layers.rh = { variant: var1, transform: tf1, color: col1 }
    if (tf1 > 0 && col1) {
      weaponTint = { transform: tf1, color: col1 }
    }

    const var2 = (secondary.base.alternateGfx || secondary.base.code).toLowerCase()
    const tf2 = secondary.base.transform ?? 0
    const col2 = tf2 > 0 ? resolveEquippedChrColor(secondary.item, secondary.code, dropTables) : null
    layers.lh = { variant: var2, transform: tf2, color: col2 }
    if (!weaponTint && tf2 > 0 && col2) {
      weaponTint = { transform: tf2, color: col2 }
    }
    hasTwoHandedWeapon = true
  } else if (equippedWeapons.length === 1) {
    const primary = equippedWeapons[0]!
    const weapBase = primary.base
    // 1or2handed weapons (e.g. Barbarian wielding a two-handed sword with a shield) use 1-handed wclass when paired with a shield
    const useOneHandedStance = Boolean(weapBase.oneOrTwoHanded && equippedShield !== null)
    const activeWc =
      weapBase.twoHanded && !useOneHandedStance
        ? (weapBase.twoHandedWClass || weapBase.wclass)
        : weapBase.wclass
    if (activeWc) {
      wclass = activeWc.toLowerCase()
    }
    if (
      (weapBase.twoHanded && !useOneHandedStance) ||
      wclass === 'bow' ||
      wclass === 'xbw' ||
      wclass === 'stf' ||
      wclass === '2hs' ||
      wclass === '2ht'
    ) {
      hasTwoHandedWeapon = true
    }
    const rawVar = (weapBase.alternateGfx || weapBase.code).toLowerCase()
    const transform = weapBase.transform ?? 0
    const color = transform > 0 ? resolveEquippedChrColor(primary.item, primary.code, dropTables, equipped.weaponTint) : null
    if (weapBase.component === 6 || wclass === 'bow') {
      layers.lh = { variant: rawVar, transform, color }
    } else if (weapBase.component === 5) {
      layers.rh = { variant: rawVar, transform, color }
    }
    if (transform > 0 && color) {
      weaponTint = { transform, color }
    }
  }

  // Check shield in either hand slot when not wielding a two-handed weapon
  if (!hasTwoHandedWeapon && equipped.hasHolyShield) {
    // 1.13c States.txt #101 (holyshield) setfunc=11 (StateSetFunc[11] at D2Client.dll 0x6FB1E289..0x6FB1E2AD):
    // overrides the paperdoll shield component (COMP_SHIELD) to 0x00687368 ('hsh') with no dye shift.
    layers.sh = { variant: 'hsh', transform: 0, color: null }
    shieldTint = null
  } else if (!hasTwoHandedWeapon && equippedShield) {
    const { item: handItem, code, base: shieldBase } = equippedShield
    const rawVar = (shieldBase.alternategfx || shieldBase.code).toLowerCase()
    const transform = shieldBase.transform ?? 0
    const color = transform > 0 ? resolveEquippedChrColor(handItem, code, dropTables, equipped.shieldTint) : null
    layers.sh = { variant: rawVar, transform, color }
    if (transform > 0 && color) {
      shieldTint = { transform, color }
    }
  }

  const baseSpec: CharacterAppearanceSpec = {
    classToken,
    classId,
    wclass,
    layers,
    helmTint,
    armorTint,
    shieldTint,
    weaponTint,
  }
  return states ? applyStateItemTransToAppearance(baseSpec, states) : baseSpec
}

/**
 * Resolve the Sorceress's 10 paperdoll layers, weapon class, and color shifts
 * from the currently equipped items.
 */
export function resolveSorceressAppearance(
  equipped: EquippedAppearanceInput,
  dropTables: DropTables = getEmbeddedDropTables(),
): SorceressAppearanceSpec {
  return resolveCharacterAppearance('so', equipped, dropTables)
}

/**
 * Blit one DCC layer frame onto a destination canvas, optionally applying a 256-byte palette remap table.
 * When `skipShadowIndex` is true (for COF layers with `transparent=true` and `drawEffect <= 3`),
 * near-black/shadow index `172` (`0xAC`) and index `0` are skipped so additive/translucent COF layers
 * do not bake black fringes into the flattened R8 paperdoll sheet.
 */
export function blitWithRemap(
  target: { indices: Uint8Array; mask: Uint8Array; width: number; height: number },
  source: SpriteFrame,
  atX: number,
  atY: number,
  remap: Uint8Array | null,
  skipShadowIndex = false,
): void {
  for (let y = 0; y < source.height; y += 1) {
    const ty = atY + y
    if (ty < 0 || ty >= target.height) continue
    for (let x = 0; x < source.width; x += 1) {
      const at = y * source.width + x
      if (source.mask[at] === 0) continue
      const tx = atX + x
      if (tx < 0 || tx >= target.width) continue
      const to = ty * target.width + tx
      const rawIdx = source.indices[at]!
      if (skipShadowIndex && (rawIdx === 0 || rawIdx === 172)) continue
      const mappedIdx = remap !== null ? (remap[rawIdx] ?? rawIdx) : rawIdx
      if (skipShadowIndex && (mappedIdx === 0 || mappedIdx === 172)) continue
      target.indices[to] = mappedIdx
      target.mask[to] = 1
    }
  }
}

const MAX_ATLAS_PAGE_SIZE = 4096

/**
 * Shelf-pack all frames of a SpriteSheet into a single raw 8-bit index buffer (`gl.R8`).
 * Index 0 represents transparency; opaque pixels with index 0 are remapped to `opaqueBlack` (172).
 */
export function packAppearanceSheetToR8(
  sheet: SpriteSheet,
  opaqueBlack = 172,
): {
  readonly r8: Uint8Array
  readonly width: number
  readonly height: number
  readonly groups: [number, number, number, number, number, number][][]
} {
  const frames = sheet.groups.flatMap(g => g.frames)
  const widest = Math.max(1, ...frames.map(f => f.width))
  const area = frames.reduce((sum, f) => sum + (f.width + 1) * (f.height + 1), 0)
  let pageWidth = Math.min(MAX_ATLAS_PAGE_SIZE, Math.max(widest + 2, 512))
  while (pageWidth < MAX_ATLAS_PAGE_SIZE && pageWidth * pageWidth < area * 1.15) {
    pageWidth *= 2
  }
  pageWidth = Math.min(MAX_ATLAS_PAGE_SIZE, pageWidth)

  let cursorX = 0
  let shelfY = 0
  let shelfHeight = 0
  const placements: { x: number; y: number; width: number; height: number }[] = []

  for (const frame of frames) {
    const w = Math.max(1, Math.min(frame.width, pageWidth))
    const h = Math.max(1, Math.min(frame.height, MAX_ATLAS_PAGE_SIZE))
    if (cursorX + w > pageWidth) {
      shelfY += shelfHeight + 1
      shelfHeight = 0
      cursorX = 0
    }
    placements.push({ x: cursorX, y: shelfY, width: w, height: h })
    cursorX += w + 1
    shelfHeight = Math.max(shelfHeight, h)
  }

  const pageHeight = Math.max(1, shelfY + shelfHeight)
  const r8 = new Uint8Array(pageWidth * pageHeight)

  let idx = 0
  for (const frame of frames) {
    const place = placements[idx]!
    idx += 1
    for (let row = 0; row < place.height; row += 1) {
      const fromRow = row * frame.width
      const toRow = (place.y + row) * pageWidth + place.x
      for (let col = 0; col < place.width; col += 1) {
        const srcAt = fromRow + col
        if (frame.mask[srcAt] === 0) {
          r8[toRow + col] = 0
        } else {
          const val = frame.indices[srcAt]!
          r8[toRow + col] = val === 0 ? opaqueBlack : val
        }
      }
    }
  }

  const groups: [number, number, number, number, number, number][][] = []
  let consumed = 0
  for (const group of sheet.groups) {
    const gList: [number, number, number, number, number, number][] = []
    for (let i = 0; i < group.frames.length; i += 1) {
      const p = placements[consumed]!
      const f = group.frames[i]!
      consumed += 1
      gList.push([p.x, p.y, p.width, p.height, f.anchorX ?? 0, f.anchorY ?? 0])
    }
    groups.push(gList)
  }

  return { r8, width: pageWidth, height: pageHeight, groups }
}

function createFetchLoader(packBaseUrl: string, classToken: PlayerClassToken = 'so'): CharLayerAssetLoader {
  const token = classToken.toLowerCase()
  const base = packBaseUrl.replace(/\/+$/, '').replace(/\/chars\/[a-z0-9]+$/i, '')
  const candidatePrefixes = [
    ...(base ? [`${base}/chars/${token}`] : []),
    `/chars/${token}`,
  ].filter((p, idx, arr) => arr.indexOf(p) === idx)
  const fetchFn = (
    globalThis as {
      fetch?: (
        url: string,
      ) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }>
    }
  ).fetch
  return {
    async loadJson(relPath: string): Promise<unknown> {
      if (!fetchFn) throw new Error('fetch is not available in this environment')
      let lastStatus = 0
      for (const prefix of candidatePrefixes) {
        try {
          const resp = await fetchFn(`${prefix}/${relPath}`)
          lastStatus = resp.status
          if (resp.ok) {
            return resp.json()
          }
        } catch {
          // try next candidate prefix
        }
      }
      throw new Error(`Failed to fetch character (${token}) layer JSON ${relPath}: HTTP ${String(lastStatus)}`)
    },
    async loadBin(relPath: string): Promise<Uint8Array> {
      if (!fetchFn) throw new Error('fetch is not available in this environment')
      let lastStatus = 0
      for (const prefix of candidatePrefixes) {
        try {
          const resp = await fetchFn(`${prefix}/${relPath}`)
          lastStatus = resp.status
          if (resp.ok) {
            return new Uint8Array(await resp.arrayBuffer())
          }
        } catch {
          // try next candidate prefix
        }
      }
      throw new Error(`Failed to fetch character (${token}) layer binary ${relPath}: HTTP ${String(lastStatus)}`)
    },
  }
}

/**
 * On-demand character paperdoll layer compositor with in-memory COF, Palette, and DCC caching.
 *
 * The DCC and layer-bin caches are LRU-bounded (#954): a long session that
 * composites many appearance specs (char-select dolls for every class, weapon
 * switches, mercs) otherwise accumulates every decoded frame set forever —
 * measured 24,511 `dccCache` entries / 24.7MB on one sorceress. A full-spec
 * composite needs only a few hundred entries, so the caps below keep the
 * working set resident while bounding the retained ceiling.
 */
export class SorceressLayerCompositor {
  /** Decoded `<comp>-<variant>:<MODE><WCLASS>` DCC frame sets; ~0.6-2KB each. */
  private static readonly DCC_CACHE_MAX_ENTRIES = 4096
  /** Raw `<comp>-<variant>.bin` layer files (multi-MB each; re-fetched on demand). */
  private static readonly LAYER_BIN_CACHE_MAX_ENTRIES = 32

  private readonly loader: CharLayerAssetLoader
  private readonly classToken: PlayerClassToken
  private initPromise: Promise<void> | null = null
  private manifest: SorceressLayerPackManifest | null = null
  private metaBin: Uint8Array | null = null
  private readonly cofCache = new Map<string, CofFile>()
  private readonly layerBinCache = new Map<string, Promise<Uint8Array>>()
  private readonly dccCache = new Map<string, DccFile>()

  /** Map- insertion-order LRU helpers: refresh on hit, evict oldest on insert. */
  private static refreshLru<V>(cache: Map<string, V>, key: string, value: V, maxEntries: number): void {
    cache.delete(key)
    cache.set(key, value)
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next()
      if (oldest.done === true) break
      cache.delete(oldest.value)
    }
  }

  constructor(
    packBaseOrLoader: string | CharLayerAssetLoader = '',
    classToken: PlayerClassToken = 'so',
  ) {
    this.classToken = classToken
    this.loader =
      typeof packBaseOrLoader === 'string'
        ? createFetchLoader(packBaseOrLoader, classToken)
        : packBaseOrLoader
  }

  private async ensureInitialized(): Promise<void> {
    if (this.manifest !== null && this.metaBin !== null) return
    if (this.initPromise === null) {
      this.initPromise = (async () => {
        const [manifestRaw, metaBytes] = await Promise.all([
          this.loader.loadJson('manifest.json'),
          this.loader.loadBin('meta.bin'),
        ])
        this.manifest = manifestRaw as SorceressLayerPackManifest
        this.metaBin = metaBytes
      })()
    }
    await this.initPromise
  }

  private getCof(cofToken: string): CofFile | null {
    const upper = cofToken.toUpperCase()
    const cached = this.cofCache.get(upper)
    if (cached !== undefined) return cached
    if (!this.manifest || !this.metaBin) return null
    const range = this.manifest.cofs[upper]
    if (!range) return null
    const [offset, length] = range
    const decoded = decodeCof(this.metaBin.subarray(offset, offset + length))
    this.cofCache.set(upper, decoded)
    return decoded
  }

  /**
   * Look up the 256-byte palette remap table for `(transform, colorCode)`.
   */
  getPaletteRemap(transform: number, colorCode: string | null): Uint8Array | null {
    if (transform <= 0 || !colorCode || !this.manifest || !this.metaBin) return null
    const colorIdx = COLOR_CODES.indexOf(colorCode as any)
    if (colorIdx < 0 || colorIdx >= 21) return null
    const range = this.manifest.palettes[transform]
    if (!range) return null
    const [palOffset, palLen] = range
    if (palLen < (colorIdx + 1) * 256) return null
    const start = palOffset + colorIdx * 256
    return this.metaBin.subarray(start, start + 256)
  }

  private async getLayerBin(compVariantKey: string): Promise<Uint8Array | null> {
    if (!this.manifest) return null
    const entry = this.manifest.layers[compVariantKey]
    if (!entry) return null
    let p = this.layerBinCache.get(compVariantKey)
    if (p) {
      SorceressLayerCompositor.refreshLru(this.layerBinCache, compVariantKey, p, SorceressLayerCompositor.LAYER_BIN_CACHE_MAX_ENTRIES)
      return p
    }
    p = this.loader.loadBin(entry.file)
    // Stored as the raw promise: a caller awaiting an entry that a concurrent
    // LRU eviction dropped still resolves from its own reference.
    SorceressLayerCompositor.refreshLru(this.layerBinCache, compVariantKey, p, SorceressLayerCompositor.LAYER_BIN_CACHE_MAX_ENTRIES)
    return p
  }

  private async getDcc(
    comp: SorceressComponent,
    variant: string,
    mode: string,
    wclass: string,
  ): Promise<DccFile | null> {
    if (!this.manifest) return null
    let compVariantKey = `${comp}-${variant.toLowerCase()}`
    let layerEntry = this.manifest.layers[compVariantKey]
    if (!layerEntry && (comp === 'hd' || comp === 'tr' || comp === 'lg' || comp === 'ra' || comp === 'la')) {
      compVariantKey = `${comp}-lit`
      layerEntry = this.manifest.layers[compVariantKey]
    }
    if (!layerEntry) return null

    const modeWclass = `${mode.toUpperCase()}${wclass.toUpperCase()}`
    const range = layerEntry.dccs[modeWclass]
    if (!range) return null

    const cacheKey = `${compVariantKey}:${modeWclass}`
    const cached = this.dccCache.get(cacheKey)
    if (cached !== undefined) {
      SorceressLayerCompositor.refreshLru(this.dccCache, cacheKey, cached, SorceressLayerCompositor.DCC_CACHE_MAX_ENTRIES)
      return cached
    }

    const bin = await this.getLayerBin(compVariantKey)
    if (!bin) return null
    const [offset, length] = range
    const decoded = decodeDcc(bin.subarray(offset, offset + length))
    SorceressLayerCompositor.refreshLru(this.dccCache, cacheKey, decoded, SorceressLayerCompositor.DCC_CACHE_MAX_ENTRIES)
    return decoded
  }

  /**
   * Composite the requested player animation modes (defaults to all 12) for the
   * given `SorceressAppearanceSpec` and pack them into a single R8 indexed
   * atlas buffer. Menus pass a subset (e.g. `['tn']`) so the char-select
   * paperdoll doesn't pay for the full in-game clip set.
   */
  async composite(
    spec: SorceressAppearanceSpec,
    modes: readonly string[] = SORCERESS_PLAYER_MODES,
    options: CompositeOptions = {},
  ): Promise<CompositedSorceressR8> {
    await this.ensureInitialized()
    const manifest = this.manifest!
    const classPrefix = (spec.classToken ?? this.classToken).toUpperCase()

    // Pre-fetch all required <comp>-<variant>.bin files in parallel with graceful per-layer fallback
    const neededLayerKeys = new Set<string>()
    for (const comp of SORCERESS_COMPONENTS) {
      const v = spec.layers[comp].variant
      if (v) {
        const key = `${comp}-${v.toLowerCase()}`
        if (manifest.layers[key]) {
          neededLayerKeys.add(key)
        } else if (
          (comp === 'hd' || comp === 'tr' || comp === 'lg' || comp === 'ra' || comp === 'la') &&
          manifest.layers[`${comp}-lit`]
        ) {
          neededLayerKeys.add(`${comp}-lit`)
        }
      }
    }
    await Promise.all([...neededLayerKeys].map(k => this.getLayerBin(k)))

    const allGroups: { frames: SpriteFrame[] }[] = []
    const clips: Record<string, AnimClipMeta> = {}
    const compositedClipByCofToken = new Map<string, AnimClipMeta>()
    let groupOffset = 0
    let totalMembers = 0

    for (const mode of modes) {
      // Per D2Composit.cpp:68-75, death (dt) and corpse (dd) always use 'hth'
      const requestedWc = mode === 'dt' || mode === 'dd' ? 'hth' : spec.wclass
      let activeWc = requestedWc
      let effectiveMode: string = mode
      const resolveCofByModeWc = (m: string, wc: string): { token: string; cof: CofFile } | null => {
        const modeUpper = m.toUpperCase()
        const wcUpper = wc.toUpperCase()
        const candidates = [
          `${classPrefix}${modeUpper}${wcUpper}`,
          `${classPrefix}${modeUpper}HTH`,
          `${classPrefix}${modeUpper}1HS`,
          `${classPrefix}${modeUpper}1HT`,
          `${classPrefix}${modeUpper}HT1`,
          `${classPrefix}${modeUpper}1SS`,
          `${classPrefix}S1${wcUpper}`,
          `${classPrefix}S1HTH`,
          `${classPrefix}NU${wcUpper}`,
          `${classPrefix}NUHTH`,
        ]
        for (const candidate of candidates) {
          const cof = this.getCof(candidate)
          if (cof) return { token: candidate, cof }
        }
        return null
      }

      if (mode === 'a2' && (activeWc === 'hth' || !this.getCof(`${classPrefix}A2${activeWc.toUpperCase()}`))) {
        effectiveMode = 'a1'
      }
      const resolvedCof = resolveCofByModeWc(effectiveMode, activeWc)
      if (!resolvedCof) {
        throw new Error(`Missing character COF descriptor for ${classPrefix}${effectiveMode.toUpperCase()}${activeWc.toUpperCase()}`)
      }
      const { token: cofToken, cof } = resolvedCof
      effectiveMode = cofToken.slice(2, 4).toLowerCase()
      activeWc = cofToken.slice(4).toLowerCase()
      const existingClip = compositedClipByCofToken.get(cofToken)
      if (existingClip) {
        clips[mode] = {
          ...existingClip,
          loop: LOOPING_PLAYER_MODES.has(mode),
        }
        continue
      }

      // Resolve DCC + per-layer palette remap for each layer in the COF
      const layerEntries = await Promise.all(
        cof.layers.map(async (cofLayer) => {
          const compName = COMPONENTS[cofLayer.type] as SorceressComponent | undefined
          if (!compName || !SORCERESS_COMPONENTS.includes(compName)) {
            return { dcc: null, remap: null }
          }
          // In dt/dd modes, weapons and shields are dropped (unarmed death animation)
          if ((mode === 'dt' || mode === 'dd') && (compName === 'rh' || compName === 'lh' || compName === 'sh')) {
            return { dcc: null, remap: null }
          }
          const layerSpec = spec.layers[compName]
          if (!layerSpec || !layerSpec.variant) {
            return { dcc: null, remap: null }
          }

          const layerWc =
            cofLayer.weaponClass && cofLayer.weaponClass.trim().length > 0
              ? cofLayer.weaponClass.trim().toLowerCase()
              : activeWc

          let dcc = await this.getDcc(compName, layerSpec.variant, effectiveMode, layerWc)
          if (!dcc && layerWc !== activeWc) {
            dcc = await this.getDcc(compName, layerSpec.variant, effectiveMode, activeWc)
          }
          if (!dcc && requestedWc !== activeWc && requestedWc !== layerWc) {
            dcc = await this.getDcc(compName, layerSpec.variant, effectiveMode, requestedWc)
          }
          if (!dcc && activeWc !== 'hth') {
            dcc = await this.getDcc(compName, layerSpec.variant, effectiveMode, 'hth')
          }
          if (!dcc) {
            return { dcc: null, remap: null }
          }
          const tint = getLayerTint(spec, compName)
          const remap = tint ? this.getPaletteRemap(tint.transform, tint.color) : null
          return { dcc, remap }
        }),
      )

      for (const entry of layerEntries) {
        if (entry.dcc !== null) totalMembers += 1
      }

      const requestedDirections = options.directions;
      const directionsToRender = requestedDirections
        ? [...new Set(requestedDirections)]
            .filter(d => Number.isInteger(d) && d >= 0 && d < cof.numberOfDirections)
            .sort((a, b) => a - b)
        : Array.from({ length: cof.numberOfDirections }, (_, i) => i)
      if (directionsToRender.length === 0) {
        throw new Error(`No valid directions for ${cofToken}: requested ${String(requestedDirections)} of ${String(cof.numberOfDirections)}`)
      }

      for (const direction of directionsToRender) {
        const dir64 = Math.round((direction * 64) / cof.numberOfDirections)
        const frames: SpriteFrame[] = []

        for (let frameIdx = 0; frameIdx < cof.framesPerDirection; frameIdx += 1) {
          let left = Number.POSITIVE_INFINITY
          let top = Number.POSITIVE_INFINITY
          let right = Number.NEGATIVE_INFINITY
          let bottom = Number.NEGATIVE_INFINITY
          let placedCount = 0

          for (let l = 0; l < cof.layers.length; l += 1) {
            const sprite = layerEntries[l]?.dcc
            if (!sprite) continue
            const dccDir = dir64ToDcc(dir64, sprite.directions.length)
            const layerDir = sprite.directions[dccDir]
            const frame = layerDir?.frames[frameIdx]
            if (!frame) continue
            left = Math.min(left, layerDir!.box.left)
            top = Math.min(top, layerDir!.box.top)
            right = Math.max(right, layerDir!.box.left + layerDir!.box.width)
            bottom = Math.max(bottom, layerDir!.box.top + layerDir!.box.height)
            placedCount += 1
          }

          if (placedCount === 0) {
            frames.push({
              width: 1,
              height: 1,
              indices: new Uint8Array(1),
              mask: new Uint8Array(1),
              anchorX: 0,
              anchorY: 0,
            })
            continue
          }

          const boxLeft = Math.round(left)
          const boxTop = Math.round(top)
          const width = Math.max(1, Math.round(right) - boxLeft)
          const height = Math.max(1, Math.round(bottom) - boxTop)
          const composed: SpriteFrame = {
            width,
            height,
            indices: new Uint8Array(width * height),
            mask: new Uint8Array(width * height),
            anchorX: boxLeft,
            anchorY: boxTop,
          }

          const order = cofLayerOrder(cof, direction, frameIdx)
          for (const layerIndex of order) {
            const entry = layerEntries[layerIndex]
            if (!entry || !entry.dcc) continue
            const cofLayer = cof.layers[layerIndex]
            const skipShadowIndex = Boolean(cofLayer?.transparent && cofLayer.drawEffect <= 3)
            const dccDir = dir64ToDcc(dir64, entry.dcc.directions.length)
            const layerDir = entry.dcc.directions[dccDir]
            const frame = layerDir?.frames[frameIdx]
            if (!frame) continue
            blitWithRemap(
              composed,
              frame.frame,
              Math.round(layerDir!.box.left) - boxLeft,
              Math.round(layerDir!.box.top) - boxTop,
              entry.remap,
              skipShadowIndex,
            )
          }
          frames.push(composed)
        }
        allGroups.push({ frames })
      }

      const animRecord = manifest.animClips[cofToken]
      const speed = animRecord?.speed ?? 256
      const events = (animRecord?.events ?? []).map(([f, c]) => ({ f, c }))
      const clipMeta: AnimClipMeta = {
        group: groupOffset,
        directions: directionsToRender.length,
        frames: cof.framesPerDirection,
        speed,
        loop: LOOPING_PLAYER_MODES.has(mode),
        events,
      }
      clips[mode] = clipMeta
      compositedClipByCofToken.set(cofToken, clipMeta)
      groupOffset += directionsToRender.length
    }

    const packed = packAppearanceSheetToR8({ groups: allGroups, width: null }, 172)
    return {
      key: appearanceKey(spec),
      spec,
      r8: packed.r8,
      width: packed.width,
      height: packed.height,
      directions: clips.wl?.directions ?? 16,
      walk: clips.wl?.group ?? 0,
      stand: clips.nu?.group ?? 16,
      members: totalMembers,
      clips,
      groups: packed.groups,
    }
  }
}

export { SorceressLayerCompositor as CharacterLayerCompositor }

export const AVATAR_COMPONENT_NAMES = [
  'HD',
  'TR',
  'LG',
  'RA',
  'LA',
  'RH',
  'LH',
  'SH',
  'S1',
  'S2',
  'S3',
] as const

export type AvatarComponentName = (typeof AVATAR_COMPONENT_NAMES)[number]

export type CampfireAvatarClassId = 'am' | 'as' | 'ne' | 'ba' | 'pa' | 'so' | 'dz'

export const D2_COLORS_TXT_PALETTE: ReadonlyArray<{
  readonly code: string
  readonly name: string
  readonly rgb: readonly [number, number, number]
}> = [
  { code: 'whit', name: 'White', rgb: [240, 240, 240] },
  { code: 'lgry', name: 'Light Grey', rgb: [192, 192, 192] },
  { code: 'dgry', name: 'Dark Grey', rgb: [104, 104, 104] },
  { code: 'blac', name: 'Black', rgb: [44, 44, 48] },
  { code: 'lblu', name: 'Light Blue', rgb: [116, 156, 232] },
  { code: 'dblu', name: 'Dark Blue', rgb: [48, 76, 164] },
  { code: 'cblu', name: 'Crystal Blue', rgb: [88, 196, 244] },
  { code: 'lred', name: 'Light Red', rgb: [228, 104, 104] },
  { code: 'dred', name: 'Dark Red', rgb: [148, 36, 36] },
  { code: 'cred', name: 'Crystal Red', rgb: [240, 64, 76] },
  { code: 'lgrn', name: 'Light Green', rgb: [116, 216, 116] },
  { code: 'dgrn', name: 'Dark Green', rgb: [40, 128, 48] },
  { code: 'cgrn', name: 'Crystal Green', rgb: [80, 240, 120] },
  { code: 'lyel', name: 'Light Yellow', rgb: [244, 228, 120] },
  { code: 'dyel', name: 'Dark Yellow', rgb: [180, 152, 48] },
  { code: 'lgld', name: 'Light Gold', rgb: [228, 196, 116] },
  { code: 'dgld', name: 'Dark Gold', rgb: [164, 128, 56] },
  { code: 'lpur', name: 'Light Purple', rgb: [196, 124, 236] },
  { code: 'dpur', name: 'Dark Purple', rgb: [116, 48, 164] },
  { code: 'oran', name: 'Orange', rgb: [232, 140, 52] },
  { code: 'bwht', name: 'Bright White', rgb: [255, 255, 255] },
]

export interface D2WinComponentEntry {
  readonly token: string
  readonly wclass?: string
  readonly twoHandedWclass?: string
}

export const D2WIN_COMPONENT_TABLE: Readonly<Record<number, D2WinComponentEntry>> = {
  1: { token: 'lit' },
  2: { token: 'med' },
  3: { token: 'hvy' },
  4: { token: 'hax', wclass: '1hs' },
  5: { token: 'axe', wclass: '1hs' },
  6: { token: 'lax', wclass: 'stf', twoHandedWclass: 'stf' },
  7: { token: 'btx', wclass: 'stf', twoHandedWclass: 'stf' },
  8: { token: 'gix', wclass: 'stf', twoHandedWclass: 'stf' },
  9: { token: 'wnd', wclass: '1hs' },
  10: { token: 'ywn', wclass: '1hs' },
  11: { token: 'bwn', wclass: '1hs' },
  12: { token: 'clb', wclass: '1hs' },
  13: { token: 'mac', wclass: '1hs' },
  14: { token: 'whm', wclass: '1hs' },
  15: { token: 'fla', wclass: '1hs' },
  16: { token: 'mau', wclass: 'stf', twoHandedWclass: 'stf' },
  17: { token: 'ssd', wclass: '1hs' },
  18: { token: 'scm', wclass: '1hs' },
  19: { token: 'flc', wclass: '1hs' },
  20: { token: 'crs', wclass: '1hs' },
  21: { token: 'bsd', wclass: '1hs' },
  22: { token: 'lsd', wclass: '1hs' },
  23: { token: 'clm', wclass: '1hs', twoHandedWclass: '2hs' },
  24: { token: 'gsd', wclass: '1hs', twoHandedWclass: '2hs' },
  25: { token: 'dgr', wclass: '1ht' },
  26: { token: 'dir', wclass: '1ht' },
  27: { token: 'jav', wclass: '1ht' },
  28: { token: 'pil', wclass: '1ht' },
  29: { token: 'glv', wclass: '1ht' },
  30: { token: 'spr', wclass: '2ht', twoHandedWclass: '2ht' },
  31: { token: 'tri', wclass: '2ht', twoHandedWclass: '2ht' },
  32: { token: 'brn', wclass: '2ht', twoHandedWclass: '2ht' },
  33: { token: 'pik', wclass: '2ht', twoHandedWclass: '2ht' },
  34: { token: 'hal', wclass: 'stf', twoHandedWclass: 'stf' },
  35: { token: 'scy', wclass: 'stf', twoHandedWclass: 'stf' },
  36: { token: 'pax', wclass: 'stf', twoHandedWclass: 'stf' },
  37: { token: 'bst', wclass: 'stf', twoHandedWclass: 'stf' },
  38: { token: 'sst', wclass: 'stf', twoHandedWclass: 'stf' },
  39: { token: 'cst', wclass: 'stf', twoHandedWclass: 'stf' },
  40: { token: 'lst', wclass: 'stf', twoHandedWclass: 'stf' },
  41: { token: 'sbw', wclass: 'bow', twoHandedWclass: 'bow' },
  42: { token: 'lbw', wclass: 'bow', twoHandedWclass: 'bow' },
  43: { token: 'clw', wclass: 'ht1' },
  44: { token: 'skr', wclass: 'ht1' },
  45: { token: 'ktr', wclass: 'ht1' },
  46: { token: 'axf', wclass: 'ht1' },
  47: { token: 'sbb', wclass: 'bow', twoHandedWclass: 'bow' },
  48: { token: 'lbb', wclass: 'bow', twoHandedWclass: 'bow' },
  49: { token: 'lxb', wclass: 'xbw', twoHandedWclass: 'xbw' },
  50: { token: 'hxb', wclass: 'xbw', twoHandedWclass: 'xbw' },
  51: { token: 'ob1', wclass: '1hs' },
  52: { token: 'ob3', wclass: '1hs' },
  53: { token: 'ob4', wclass: '1hs' },
  54: { token: 'am1', wclass: 'bow', twoHandedWclass: 'bow' },
  55: { token: 'am2', wclass: 'bow', twoHandedWclass: 'bow' },
  56: { token: 'am3', wclass: '2ht', twoHandedWclass: '2ht' },
  57: { token: 'cap' },
  58: { token: 'skp' },
  59: { token: 'hlm' },
  60: { token: 'fhl' },
  61: { token: 'ghm' },
  62: { token: 'crn' },
  63: { token: 'msk' },
  64: { token: 'qlt' },
  65: { token: 'lea' },
  66: { token: 'hla' },
  67: { token: 'stu' },
  68: { token: 'rng' },
  69: { token: 'scl' },
  70: { token: 'chn' },
  71: { token: 'brs' },
  72: { token: 'spl' },
  73: { token: 'plt' },
  74: { token: 'fld' },
  75: { token: 'gth' },
  76: { token: 'ful' },
  77: { token: 'aar' },
  78: { token: 'ltp' },
  79: { token: 'buc' },
  80: { token: 'lrg' },
  81: { token: 'kit' },
  82: { token: 'tow' },
  83: { token: 'bhm' },
  84: { token: 'bsh' },
  85: { token: 'spk' },
  86: { token: 'dr1' },
  87: { token: 'dr4' },
  88: { token: 'dr3' },
  89: { token: 'ba1' },
  90: { token: 'ba3' },
  91: { token: 'ba5' },
  92: { token: 'pa1' },
  93: { token: 'pa3' },
  94: { token: 'pa5' },
  95: { token: 'ne1' },
  96: { token: 'ne2' },
  97: { token: 'ne3' },
  117: { token: 'sbb', wclass: 'bow', twoHandedWclass: 'bow' },
  118: { token: 'lbb', wclass: 'bow', twoHandedWclass: 'bow' },
  119: { token: 'sbb', wclass: 'bow', twoHandedWclass: 'bow' },
  120: { token: 'lbb', wclass: 'bow', twoHandedWclass: 'bow' },
  121: { token: 'lxb', wclass: 'xbw', twoHandedWclass: 'xbw' },
  122: { token: 'lxb', wclass: 'xbw', twoHandedWclass: 'xbw' },
  123: { token: 'hxb', wclass: 'xbw', twoHandedWclass: 'xbw' },
  124: { token: 'hxb', wclass: 'xbw', twoHandedWclass: 'xbw' },
  125: { token: 'gpl', wclass: '1ht' },
  126: { token: 'opl', wclass: '1ht' },
  127: { token: 'gps', wclass: '1ht' },
  128: { token: 'opl', wclass: '1ht' },
  129: { token: 'gps', wclass: '1ht' },
  134: { token: 'ops', wclass: '1ht' },
  235: { token: 'sbb', wclass: 'bow', twoHandedWclass: 'bow' },
  236: { token: 'lbb', wclass: 'bow', twoHandedWclass: 'bow' },
  237: { token: 'sbb', wclass: 'bow', twoHandedWclass: 'bow' },
  238: { token: 'lbb', wclass: 'bow', twoHandedWclass: 'bow' },
  239: { token: 'lxb', wclass: 'xbw', twoHandedWclass: 'xbw' },
  240: { token: 'lxb', wclass: 'xbw', twoHandedWclass: 'xbw' },
  241: { token: 'hxb', wclass: 'xbw', twoHandedWclass: 'xbw' },
  242: { token: 'hxb', wclass: 'xbw', twoHandedWclass: 'xbw' },
  243: { token: 'ktr', wclass: 'ht1' },
  244: { token: 'ktr', wclass: 'ht1' },
  245: { token: 'axf', wclass: 'ht1' },
  246: { token: 'axf', wclass: 'ht1' },
  247: { token: 'clw', wclass: 'ht1' },
  248: { token: 'clw', wclass: 'ht1' },
  249: { token: 'skr', wclass: 'ht1' },
  250: { token: 'ktr', wclass: 'ht1' },
  251: { token: 'ktr', wclass: 'ht1' },
  252: { token: 'axf', wclass: 'ht1' },
  253: { token: 'axf', wclass: 'ht1' },
  254: { token: 'clw', wclass: 'ht1' },
}

const VALID_HD_TOKENS = new Set<string>([
  'lit',
  'cap',
  'skp',
  'hlm',
  'fhl',
  'ghm',
  'crn',
  'msk',
  'bhm',
  'dr1',
  'dr3',
  'dr4',
  'ba1',
  'ba3',
  'ba5',
])

const VALID_ARMOR_TIER_TOKENS = new Set<string>([
  'lit',
  'med',
  'hvy',
  'qlt',
  'lea',
  'hla',
  'stu',
  'rng',
  'scl',
  'chn',
  'brs',
  'spl',
  'plt',
  'fld',
  'gth',
  'ful',
  'aar',
  'ltp',
])

const VALID_SHIELD_TOKENS = new Set<string>([
  'buc',
  'lrg',
  'kit',
  'tow',
  'bsh',
  'spk',
  'pa1',
  'pa3',
  'pa5',
  'ne1',
  'ne2',
  'ne3',
])

const VALID_S3_TOKENS = new Set<string>(['lit', 'med', 'hvy', 'ne1', 'ne2', 'ne3'])

export interface AvatarComponentLayerSpec {
  readonly component: AvatarComponentName
  readonly rawCode: number
  readonly token: string
  readonly colorIndex: number
  readonly colorCode: string | null
  readonly rgb: readonly [number, number, number] | null
}

export interface ParsedMcpAvatarStatstring {
  readonly classToken: string
  readonly mode: 'TN'
  readonly weaponClass: string
  readonly hasEquippedComponents: boolean
  readonly rawComponentCodes: Uint8Array
  readonly rawComponentColors: Uint8Array
  readonly components: Readonly<Record<AvatarComponentName, string>>
  readonly componentTokens: Readonly<Record<AvatarComponentName, string>>
  readonly componentColors: Readonly<Record<AvatarComponentName, number>>
  readonly equippedLayers: readonly AvatarComponentLayerSpec[]
  readonly cofSignature: string
}

const AVATAR_CLASS_ID_TO_TOKEN: Readonly<Record<string, string>> = {
  am: 'am',
  as: 'ai',
  ai: 'ai',
  ne: 'ne',
  ba: 'ba',
  pa: 'pa',
  so: 'so',
  dz: 'dz',
}

function resolveAvatarComponentToken(component: AvatarComponentName, rawCode: number): string {
  if (rawCode === 0xff || rawCode === 0) {
    if (
      component === 'HD' ||
      component === 'TR' ||
      component === 'LG' ||
      component === 'RA' ||
      component === 'LA'
    ) {
      return 'lit'
    }
    return 'nil'
  }
  const entry = D2WIN_COMPONENT_TABLE[rawCode]
  if (!entry) {
    throw new Error(
      `Out-of-range 1.13c component code ${rawCode} for slot ${component} (not in D2Win stru_6F8C1520)`,
    )
  }
  switch (component) {
    case 'HD':
      if (!VALID_HD_TOKENS.has(entry.token)) {
        throw new Error(
          `Invalid HD component token "${entry.token}" (rawCode=${rawCode}): 1.13c HD slot only accepts lit or helm tokens`,
        )
      }
      return entry.token
    case 'TR':
    case 'LG':
    case 'RA':
    case 'LA':
    case 'S1':
    case 'S2':
      if (!VALID_ARMOR_TIER_TOKENS.has(entry.token)) {
        throw new Error(
          `Invalid ${component} component token "${entry.token}" (rawCode=${rawCode}): expected armor tier token`,
        )
      }
      return entry.token
    case 'S3':
      if (!VALID_S3_TOKENS.has(entry.token)) {
        throw new Error(
          `Invalid S3 component token "${entry.token}" (rawCode=${rawCode}): expected S3/head token`,
        )
      }
      return entry.token
    case 'RH':
    case 'LH':
      if (!entry.wclass) {
        throw new Error(
          `Invalid ${component} weapon component token "${entry.token}" (rawCode=${rawCode}): not a weapon entry`,
        )
      }
      return entry.token
    case 'SH':
      if (!VALID_SHIELD_TOKENS.has(entry.token)) {
        throw new Error(
          `Invalid SH shield component token "${entry.token}" (rawCode=${rawCode}): not a shield entry`,
        )
      }
      return entry.token
  }
}

function resolveAvatarWeaponClass(rhCode: number, lhCode: number, shToken: string): string {
  const rh = rhCode !== 0xff && rhCode !== 0 ? D2WIN_COMPONENT_TABLE[rhCode] : undefined
  const lh = lhCode !== 0xff && lhCode !== 0 ? D2WIN_COMPONENT_TABLE[lhCode] : undefined
  if (!rh && !lh) return 'hth'
  if (rh && lh) {
    const rhW = rh.wclass
    const lhW = lh.wclass
    if (rhW === 'ht1' && lhW === 'ht1') return 'ht2'
    if (rhW === '1hs' && lhW === '1hs') return '1ss'
    if (rhW === '1hs' && lhW === '1ht') return '1js'
    if (rhW === '1ht' && lhW === '1hs') return '1jt'
    if (rhW === '1ht' && lhW === '1ht') return '1st'
    return rhW ?? '1hs'
  }
  const single = (rh ?? lh)!
  if (single.twoHandedWclass && shToken === 'nil') {
    return single.twoHandedWclass
  }
  if (!single.wclass) {
    throw new Error(`Weapon component "${single.token}" is missing wclass`)
  }
  return single.wclass
}

function toStatstringBytes(
  statstring: Uint8Array | string | undefined,
  equipmentGraphics?: Uint8Array,
): Uint8Array {
  if (statstring instanceof Uint8Array && statstring.length > 0) {
    return statstring
  }
  if (typeof statstring === 'string' && statstring.length > 0) {
    const out = new Uint8Array(statstring.length)
    for (let i = 0; i < statstring.length; i++) {
      out[i] = statstring.charCodeAt(i) & 0xff
    }
    return out
  }
  if (equipmentGraphics instanceof Uint8Array && equipmentGraphics.length > 0) {
    const synthetic = new Uint8Array(33)
    synthetic.fill(0xff)
    synthetic[0] = 0x84
    synthetic[1] = 0x80
    for (let i = 0; i < Math.min(11, equipmentGraphics.length); i++) {
      synthetic[2 + i] = equipmentGraphics[i]!
    }
    return synthetic
  }
  return new Uint8Array(0)
}

/**
 * Parses the MCP `0x19` (`MCP_CHARLIST2`) / BNCS `0x0F` 33-byte statstring into a
 * `TN` avatar descriptor (`D2Launch.dll` `0x6fa4a440`, `D2Multi.dll` `0x6f9d2940`, `D2Win_10144`).
 */
export function parseMcpAvatarStatstring(
  statstring: Uint8Array | string | undefined,
  classId: CampfireAvatarClassId = 'ba',
  equipmentGraphics?: Uint8Array,
): ParsedMcpAvatarStatstring {
  const classToken = AVATAR_CLASS_ID_TO_TOKEN[classId]
  if (!classToken) {
    throw new Error(`Invalid character classId "${String(classId)}" in parseMcpAvatarStatstring`)
  }

  const bytes = toStatstringBytes(statstring, equipmentGraphics)
  const rawComponentCodes = new Uint8Array(11)
  rawComponentCodes.fill(0xff)
  const rawComponentColors = new Uint8Array(11)
  rawComponentColors.fill(0xff)

  const hasHeader = bytes.length >= 2 && bytes[1] === 0x80
  const compOffset = hasHeader ? 2 : 0
  for (let i = 0; i < 11; i++) {
    if (compOffset + i < bytes.length) {
      rawComponentCodes[i] = bytes[compOffset + i]!
    } else if (equipmentGraphics && i < equipmentGraphics.length) {
      rawComponentCodes[i] = equipmentGraphics[i]!
    }
  }

  const colorOffset = hasHeader ? 14 : 12
  if (bytes.length >= colorOffset + 11) {
    for (let i = 0; i < 11; i++) {
      rawComponentColors[i] = bytes[colorOffset + i]!
    }
  }

  let hasEquippedComponents = false
  const componentTokens = {} as Record<AvatarComponentName, string>
  const componentColors = {} as Record<AvatarComponentName, number>
  const equippedLayers: AvatarComponentLayerSpec[] = []

  for (let i = 0; i < AVATAR_COMPONENT_NAMES.length; i++) {
    const comp = AVATAR_COMPONENT_NAMES[i]!
    const code = rawComponentCodes[i]!
    const rawColor = rawComponentColors[i]!
    const hasDyeColor = rawColor !== 0xff && rawColor !== 0
    const colorIdx = hasDyeColor ? (rawColor - 1) & 0x1f : 0
    const token = resolveAvatarComponentToken(comp, code)
    componentTokens[comp] = token
    componentColors[comp] = colorIdx

    const isEquippedCode = code !== 0xff && code !== 0
    if (isEquippedCode) {
      hasEquippedComponents = true
      const paletteEntry =
        hasDyeColor && colorIdx >= 0 && colorIdx < D2_COLORS_TXT_PALETTE.length
          ? D2_COLORS_TXT_PALETTE[colorIdx]!
          : null
      equippedLayers.push({
        component: comp,
        rawCode: code,
        token,
        colorIndex: colorIdx,
        colorCode: paletteEntry ? paletteEntry.code : null,
        rgb: paletteEntry ? paletteEntry.rgb : null,
      })
    }
  }

  const weaponClass = resolveAvatarWeaponClass(
    rawComponentCodes[5]!,
    rawComponentCodes[6]!,
    componentTokens.SH,
  )
  const cofSignature = `${classToken}:TN:${weaponClass}:${AVATAR_COMPONENT_NAMES.map(
    (c) => `${c}=${componentTokens[c]}@${componentColors[c]!.toString(16)}`,
  ).join(',')}`

  return {
    classToken,
    mode: 'TN',
    weaponClass,
    hasEquippedComponents,
    rawComponentCodes,
    rawComponentColors,
    components: componentTokens,
    componentTokens,
    componentColors,
    equippedLayers,
    cofSignature,
  }
}

