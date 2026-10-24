/**
 * Diablo II v1.13c Drop Item to UiInventoryItem Bridge.
 *
 * Implements authoritative bridging from concrete `Item` (produced by drop pipeline)
 * to `UiInventoryItem` (consumed by UI Inventory Paperdoll and Canvas rendering):
 * - 1.13c invFile resolution hierarchy matching BAKED_UI_MANIFEST.itemRects 100%
 * - BodyLoc1/BodyLoc2 equipment slot mapping with category inheritance
 * - Bilingual item names (nameZh, baseNameZh) across all quality tiers
 * - Quality tier normalization ('normal' | 'magic' | 'rare' | 'set' | 'unique' | 'craft' | 'rune')
 * - Rich tooltip attributes & rolled property formatting with D2ColorCode lines
 */

import type { Item, ItemBase, RolledItemProp } from './items.ts'
import { ItemQuality } from './items.ts'
import {
  type DropTables,
  computeCharsiImbueIlvl,
  isEligibleForCharsiImbue113c,
  imbueItem113c,
  type CharsiImbueOptions,
} from './drop-tables.ts'
import { getEmbeddedDropTables } from './embedded-drop-tables.ts'
import { CANONICAL_RUNES_TABLE, type RunewordDefinition } from './runeword.ts'
import {
  type UiInventoryItem,
  type EquipSlotId,
  type UiItemQuality,
} from './inventory-model.ts'
import { BAKED_UI_MANIFEST } from './baked-ui-meta.ts'
import {
  formatItemTooltip,
  CANONICAL_ISC_DESC_TABLE,
  CANONICAL_ENG_TBL_DICT,
  resolveBaseItemNameEn,
  resolveRareNameEn,
  resolveSkillMeta,
} from './item-tooltip.ts'
import { decodeSkillTabParam, encodeSkillTabParam } from '../skills/skills-data.ts'
import { translateItemName, translateRareName, translateMagicName, resolveMagicNameEn } from '../i18n/tooltip-i18n.ts'
import { isRuneCode, getGemColorTransform, COLOR_CODES } from './gems-data.ts'
import { CANONICAL_AUTOMAGIC_TABLE } from './automagic.ts'
import type { D2ColorCode } from '../skills/skills-meta.ts'
import { isA } from './item-types.ts'
import { inferItemClassFromType } from './affixes.ts'
import { CHARACTER_CLASS_CODES, type CharacterClassCode } from '../units/classes.ts'

interface ItemStat {
  readonly statId?: number
  readonly id?: number
  readonly param?: number
  readonly value: number
}

export type ItemData = Record<string, any> & {
  readonly stats?: readonly ItemStat[]
  readonly runewordStats?: readonly ItemStat[]
}

export { COLOR_CODES, getGemColorTransform }

const VALID_CLASS_CODES = new Set<string>(CHARACTER_CLASS_CODES)
let itemBridgeSeqCounter = 0

/**
 * Ground Truth (`Weapons.txt` `1or2handed === 1` & `2handed === 1` in Diablo II v1.13c):
 * The 18 two-handed swords (`type = swor`) that a Barbarian (`bar`) can wield in one hand
 * (allowing dual-wielding or pairing with a shield) while all other classes must wield them two-handed.
 */
export const BARBARIAN_ONE_OR_TWO_HANDED_SWORD_CODES: ReadonlySet<string> = new Set([
  '2hs', 'clm', 'gis', 'bsw', 'flb', 'gsd',
  '92h', '9cm', '9gs', '9b9', '9fb', '9gd',
  '72h', '7cm', '7gs', '7b7', '7fb', '7gd',
])

/**
 * Ground Truth (`Weapons.txt` `type = h2h` / `h2h2` in Diablo II v1.13c):
 * All 21 Assassin hand-to-hand claw codes (`ktr`..`7qr`) that an Assassin (`ass`) can dual-wield
 * in both `weapon1` and `weapon2`.
 */
export const ASSASSIN_HAND_TO_HAND_CLAW_CODES: ReadonlySet<string> = new Set([
  'ktr', 'wrb', 'axf', 'ces', 'clw', 'btl', 'skr',
  '9ar', '9wb', '9xf', '9cs', '9lw', '9tw', '9qr',
  '7ar', '7wb', '7xf', '7cs', '7lw', '7tw', '7qr',
])

/**
 * Ground Truth (`Weapons.txt` `2handed === 1` & `1or2handed !== 1` in Diablo II v1.13c):
 * All 119 strict two-handed weapons (2H axes, mauls, spears, polearms, staves, bows, crossbows,
 * Amazon bows, Amazon spears) that require both hands for ALL classes including Barbarian.
 */
export const STRICT_TWO_HANDED_WEAPON_CODES: ReadonlySet<string> = new Set([
  'lax', 'bax', 'btx', 'gax', 'gix', 'mau', 'gma', 'spr', 'tri', 'brn', 'spt', 'pik',
  'bar', 'vou', 'scy', 'pax', 'hal', 'wsc', 'sst', 'lst', 'cst', 'bst', 'wst', 'sbw',
  'hbw', 'lbw', 'cbw', 'sbb', 'lbb', 'swb', 'lwb', 'lxb', 'mxb', 'hxb', 'rxb', 'hst',
  'msf', '9la', '9ba', '9bt', '9ga', '9gi', '9m9', '9gm', '9sr', '9tr', '9br', '9st',
  '9p9', '9b7', '9vo', '9s8', '9pa', '9h9', '9wc', '8ss', '8ls', '8cs', '8bs', '8ws',
  '8sb', '8hb', '8lb', '8cb', '8s8', '8l8', '8sw', '8lw', '8lx', '8mx', '8hx', '8rx',
  '7la', '7ba', '7bt', '7ga', '7gi', '7m7', '7gm', '7sr', '7tr', '7br', '7st', '7p7',
  '7o7', '7vo', '7s8', '7pa', '7h7', '7wc', '6ss', '6ls', '6cs', '6bs', '6ws', '6sb',
  '6hb', '6lb', '6cb', '6s7', '6l7', '6sw', '6lw', '6lx', '6mx', '6hx', '6rx', 'am1',
  'am2', 'am3', 'am4', 'am6', 'am7', 'am8', 'am9', 'amb', 'amc', 'amd', 'ame',
])

/**
 * Ground Truth (`Weapons.txt` `type = bow` / `abow`, `ItemTypes.txt` `Shoots = bowq` in Diablo II v1.13c):
 * All 30 canonical Bow and Amazon Bow weapon codes (`sbw`..`6lw`, `am1`..`amc`) that shoot Arrow Quivers (`bowq` / `aqv`).
 */
export const CANONICAL_BOW_WEAPON_CODES: ReadonlySet<string> = new Set([
  'sbw', 'hbw', 'lbw', 'cbw', 'sbb', 'lbb', 'swb', 'lwb',
  '8sb', '8hb', '8lb', '8cb', '8s8', '8l8', '8sw', '8lw',
  '6sb', '6hb', '6lb', '6cb', '6s7', '6l7', '6sw', '6lw',
  'am1', 'am2', 'am6', 'am7', 'amb', 'amc',
])

/**
 * Ground Truth (`Weapons.txt` `type = xbow`, `ItemTypes.txt` `Shoots = xboq` in Diablo II v1.13c):
 * All 12 canonical Crossbow weapon codes (`lxb`..`6rx`) that shoot Bolt Quivers (`xboq` / `cqv`).
 */
export const CANONICAL_CROSSBOW_WEAPON_CODES: ReadonlySet<string> = new Set([
  'lxb', 'mxb', 'hxb', 'rxb',
  '8lx', '8mx', '8hx', '8rx',
  '6lx', '6mx', '6hx', '6rx',
])

/**
 * Ground Truth (`Weapons.txt` `2handed !== 1` in Diablo II v1.13c):
 * All 169 one-handed weapons across normal, exceptional, elite, and class/quest tiers.
 */
export const CANONICAL_ONE_HANDED_WEAPON_CODES: ReadonlySet<string> = new Set([
  'hax', 'axe', '2ax', 'mpi', 'wax', 'wnd', 'ywn', 'bwn', 'gwn', 'clb', 'scp', 'gsc',
  'wsp', 'spc', 'mac', 'mst', 'fla', 'whm', 'ssd', 'scm', 'sbr', 'flc', 'crs', 'bsd',
  'lsd', 'wsd', 'dgr', 'dir', 'kri', 'bld', 'tkf', 'tax', 'bkf', 'bal', 'jav', 'pil',
  'ssp', 'glv', 'tsp', 'gps', 'ops', 'gpm', 'opm', 'gpl', 'opl', 'd33', 'g33', 'leg',
  'hdm', 'hfh', '9ha', '9ax', '92a', '9mp', '9wa', '9wn', '9yw', '9bw', '9gw', '9cl',
  '9sc', '9qs', '9ws', '9sp', '9ma', '9mt', '9fl', '9wh', '9ss', '9sm', '9sb', '9fc',
  '9cr', '9bs', '9ls', '9wd', '9dg', '9di', '9kr', '9bl', '9tk', '9ta', '9bk', '9b8',
  '9ja', '9pi', '9s9', '9gl', '9ts', 'qf1', 'qf2', 'ktr', 'wrb', 'axf', 'ces', 'clw',
  'btl', 'skr', '9ar', '9wb', '9xf', '9cs', '9lw', '9tw', '9qr', '7ar', '7wb', '7xf',
  '7cs', '7lw', '7tw', '7qr', '7ha', '7ax', '72a', '7mp', '7wa', '7wn', '7yw', '7bw',
  '7gw', '7cl', '7sc', '7qs', '7ws', '7sp', '7ma', '7mt', '7fl', '7wh', '7ss', '7sm',
  '7sb', '7fc', '7cr', '7bs', '7ls', '7wd', '7dg', '7di', '7kr', '7bl', '7tk', '7ta',
  '7bk', '7b8', '7ja', '7pi', '7s7', '7gl', '7ts', 'ob1', 'ob2', 'ob3', 'ob4', 'ob5',
  'am5', 'ob6', 'ob7', 'ob8', 'ob9', 'oba', 'ama', 'obb', 'obc', 'obd', 'obe', 'obf',
  'amf',
])

/**
 * Ground Truth (`Armor.txt` `shie` / `ashd` / `head` + `Misc.txt` `bowq` / `xboq` in Diablo II v1.13c):
 * All 54 shield, paladin shield, necromancer shrunken head, and quiver codes.
 */
export const CANONICAL_SHIELD_AND_OFFHAND_CODES: ReadonlySet<string> = new Set([
  'buc', 'sml', 'lrg', 'kit', 'tow', 'gts', 'bsh', 'spk',
  'xuc', 'xml', 'xrg', 'xit', 'xow', 'xts', 'xsh', 'xpk',
  'uuc', 'uml', 'urg', 'uit', 'uow', 'uts', 'ush', 'upk',
  'pa1', 'pa2', 'pa3', 'pa4', 'pa5', 'pa6', 'pa7', 'pa8', 'pa9', 'paa', 'pab', 'pac', 'pad', 'pae', 'paf',
  'ne1', 'ne2', 'ne3', 'ne4', 'ne5', 'ne6', 'ne7', 'ne8', 'ne9', 'nea', 'neb', 'neg', 'ned', 'nee', 'nef',
  'aqv', 'cqv',
])

/**
 * Ground Truth (`ItemTypes.txt` `Class` column + `Weapons.txt` / `Armor.txt` in Diablo II v1.13c):
 * All 111 class-specific item codes mapped to their required playable class.
 */
export const CANONICAL_CLASS_SPECIFIC_ITEM_CODES: Readonly<Record<string, CharacterClassCode>> = {
  ktr: 'ass', wrb: 'ass', axf: 'ass', ces: 'ass', clw: 'ass', btl: 'ass', skr: 'ass',
  '9ar': 'ass', '9wb': 'ass', '9xf': 'ass', '9cs': 'ass', '9lw': 'ass', '9tw': 'ass', '9qr': 'ass',
  '7ar': 'ass', '7wb': 'ass', '7xf': 'ass', '7cs': 'ass', '7lw': 'ass', '7tw': 'ass', '7qr': 'ass',
  ob1: 'sor', ob2: 'sor', ob3: 'sor', ob4: 'sor', ob5: 'sor',
  ob6: 'sor', ob7: 'sor', ob8: 'sor', ob9: 'sor', oba: 'sor',
  obb: 'sor', obc: 'sor', obd: 'sor', obe: 'sor', obf: 'sor',
  am1: 'ama', am2: 'ama', am3: 'ama', am4: 'ama', am5: 'ama',
  am6: 'ama', am7: 'ama', am8: 'ama', am9: 'ama', ama: 'ama',
  amb: 'ama', amc: 'ama', amd: 'ama', ame: 'ama', amf: 'ama',
  dr1: 'dru', dr2: 'dru', dr3: 'dru', dr4: 'dru', dr5: 'dru',
  dr6: 'dru', dr7: 'dru', dr8: 'dru', dr9: 'dru', dra: 'dru',
  drb: 'dru', drc: 'dru', drd: 'dru', dre: 'dru', drf: 'dru',
  ba1: 'bar', ba2: 'bar', ba3: 'bar', ba4: 'bar', ba5: 'bar',
  ba6: 'bar', ba7: 'bar', ba8: 'bar', ba9: 'bar', baa: 'bar',
  bab: 'bar', bac: 'bar', bad: 'bar', bae: 'bar', baf: 'bar',
  pa1: 'pal', pa2: 'pal', pa3: 'pal', pa4: 'pal', pa5: 'pal',
  pa6: 'pal', pa7: 'pal', pa8: 'pal', pa9: 'pal', paa: 'pal',
  pab: 'pal', pac: 'pal', pad: 'pal', pae: 'pal', paf: 'pal',
  ne1: 'nec', ne2: 'nec', ne3: 'nec', ne4: 'nec', ne5: 'nec',
  ne6: 'nec', ne7: 'nec', ne8: 'nec', ne9: 'nec', nea: 'nec',
  neb: 'nec', neg: 'nec', ned: 'nec', nee: 'nec', nef: 'nec',
}

/**
 * Resolves the effective class restriction (`reqClass`) for a UI item, checking explicit
 * `item.reqClass` first and falling back to `CANONICAL_CLASS_SPECIFIC_ITEM_CODES[code]`.
 */
export function getEffectiveItemReqClass(item: {
  readonly reqClass?: CharacterClassCode | undefined
  readonly code?: string | undefined
}): CharacterClassCode | undefined {
  if (item.reqClass !== undefined && VALID_CLASS_CODES.has(item.reqClass)) {
    return item.reqClass
  }
  const code = (item.code ?? '').trim().toLowerCase()
  return code ? CANONICAL_CLASS_SPECIFIC_ITEM_CODES[code] : undefined
}

/**
 * Ground Truth (D2Common.dll 1.13c @ 0x6fd74280 `ITEMS_GetClassOfClassSpecificItem` #10202):
 * Resolves the required playable class (`'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass'`)
 * for class-specific items from `ItemTypes.txt` `Class` column and type hierarchy (`Equiv1`/`Equiv2`),
 * or `undefined` if any class can equip/use the item.
 */
export function resolveItemRequiredClass(
  base: {
    readonly id?: string | undefined
    readonly code?: string | undefined
    readonly type?: string | undefined
    readonly type2?: string | undefined
    readonly tags?: readonly string[] | undefined
    readonly class?: string | undefined
    readonly reqClass?: string | undefined
    readonly itemClass?: string | undefined
  },
  rawItem?: {
    readonly code?: string | undefined
    readonly reqClass?: string | undefined
    readonly itemClass?: string | undefined
  },
  dropTables?: DropTables,
): CharacterClassCode | undefined {
  const explicit =
    rawItem?.reqClass ?? rawItem?.itemClass ?? base.reqClass ?? base.itemClass ?? base.class
  if (typeof explicit === 'string') {
    const norm = explicit.trim().toLowerCase()
    if (VALID_CLASS_CODES.has(norm)) return norm as CharacterClassCode
  }

  const isAPred = (type: string, target: string): boolean => {
    const t = type.trim().toLowerCase()
    if (!t) return false
    if (t === target) return true
    if (dropTables?.isA && dropTables.isA(t, target)) {
      return true
    }
    if (
      dropTables?.itemTypes &&
      dropTables.itemTypes.byCode.has(t) &&
      dropTables.itemTypes.byCode.has(target) &&
      isA(t, target, dropTables.itemTypes)
    ) {
      return true
    }
    return false
  }

  const candidateTypes: string[] = []
  if (base.type) candidateTypes.push(base.type)
  if (base.type2) candidateTypes.push(base.type2)
  if (base.tags) candidateTypes.push(...base.tags)

  for (const rawType of candidateTypes) {
    const typeCode = rawType.trim().toLowerCase()
    if (!typeCode) continue
    if (dropTables?.itemTypes) {
      const def = dropTables.itemTypes.byCode.get(typeCode)
      const defClass = def?.class?.trim().toLowerCase()
      if (defClass && VALID_CLASS_CODES.has(defClass)) {
        return defClass as CharacterClassCode
      }
    }
    const inferred = inferItemClassFromType(typeCode, isAPred)
    if (inferred && VALID_CLASS_CODES.has(inferred)) {
      return inferred as CharacterClassCode
    }
  }

  const rawCode = (rawItem?.code ?? base.code ?? base.id ?? '').trim().toLowerCase()
  if (rawCode && CANONICAL_CLASS_SPECIFIC_ITEM_CODES[rawCode]) {
    return CANONICAL_CLASS_SPECIFIC_ITEM_CODES[rawCode]
  }

  return undefined
}

/**
 * Resolves the allowable paperdoll equipment slot(s) for an item base based on
 * Diablo II v1.13c `ItemTypes.txt` body locations and category inheritance.
 */
export function resolveAllowedSlots(
  base: {
    readonly id?: string | undefined
    readonly type?: string | undefined
    readonly kind?: string | undefined
    readonly tags?: readonly string[] | undefined
    readonly twoHanded?: boolean | undefined
    readonly oneOrTwoHanded?: boolean | undefined
  },
  dropTables?: DropTables,
): readonly EquipSlotId[] {
  const code = (base.id ?? '').trim().toLowerCase()
  const typeCode = (base.type ?? '').trim().toLowerCase()
  const tags = base.tags ?? []

  // Check ItemTypes definition if dropTables is provided
  if (dropTables?.itemTypes && typeCode) {
    const def = dropTables.itemTypes.byCode.get(typeCode)
    if (def && !def.body) {
      return []
    }
    if (def && def.bodyLoc1 && def.bodyLoc1 === def.bodyLoc2) {
      switch (def.bodyLoc1) {
        case 'head': return ['helm']
        case 'neck': return ['amulet']
        case 'tors': return ['armor']
        case 'glov': return ['gloves']
        case 'feet': return ['boots']
        case 'belt': return ['belt']
      }
    }
    if (def && def.bodyLoc1 === 'rrin' && def.bodyLoc2 === 'lrin') {
      return ['ring1', 'ring2']
    }
  }

  const isAPred = (target: string): boolean => {
    if (!typeCode) return false
    if (typeCode === target) return true
    if (dropTables?.isA && dropTables.isA(typeCode, target)) {
      return true
    }
    if (
      dropTables?.itemTypes &&
      dropTables.itemTypes.byCode.has(typeCode) &&
      dropTables.itemTypes.byCode.has(target) &&
      isA(typeCode, target, dropTables.itemTypes)
    ) {
      return true
    }
    return false
  }

  // Helm
  if (
    tags.some(t => ['helm', 'phlm', 'circ', 'pelt'].includes(t)) ||
    ['helm', 'circ', 'phlm', 'pelt', 'cap', 'hlm', 'skp', 'ghm', 'crn', 'msk'].includes(typeCode) ||
    isAPred('helm')
  ) {
    return ['helm']
  }

  // Amulet
  if (tags.includes('amul') || typeCode === 'amul' || code === 'amu' || isAPred('amul')) {
    return ['amulet']
  }

  // Ring
  if (tags.includes('ring') || typeCode === 'ring' || code === 'rin' || isAPred('ring')) {
    return ['ring1', 'ring2']
  }

  // Gloves
  if (tags.includes('glov') || typeCode === 'glov' || isAPred('glov') || ['lgl', 'vgl', 'mgl', 'tgl', 'hgl'].includes(code)) {
    return ['gloves']
  }

  // Boots
  if (tags.includes('boot') || typeCode === 'boot' || isAPred('boot') || ['lbt', 'vbt', 'mbt', 'tbt', 'hbt'].includes(code)) {
    return ['boots']
  }

  // Belt
  if (tags.includes('belt') || typeCode === 'belt' || isAPred('belt') || ['lbl', 'vbl', 'mbl', 'tbl', 'hbl'].includes(code)) {
    return ['belt']
  }

  // Shields & Off-hand (`ItemTypes.txt` BodyLoc1 = rarm, BodyLoc2 = larm -> weapon1 or weapon2)
  if (
    CANONICAL_SHIELD_AND_OFFHAND_CODES.has(code) ||
    tags.some(t => ['shld', 'ashd', 'head', 'seco'].includes(t)) ||
    ['shie', 'ashd', 'head', 'shld'].includes(typeCode) ||
    isAPred('shld') ||
    isAPred('seco')
  ) {
    return ['weapon1', 'weapon2']
  }

  // Quivers (`ItemTypes.txt` BodyLoc1 = rarm, BodyLoc2 = larm -> weapon1 or weapon2)
  if (
    tags.some(t => ['bowq', 'xboq', 'mboq', 'mxbq'].includes(t)) ||
    ['bowq', 'xboq', 'mboq', 'mxbq'].includes(typeCode) ||
    isAPred('bowq') ||
    isAPred('xboq')
  ) {
    return ['weapon1', 'weapon2']
  }

  // Armor / Torso
  if (
    base.kind === 'armor' ||
    tags.some(t => ['tors', 'cloa'].includes(t)) ||
    ['tors', 'cloa'].includes(typeCode) ||
    isAPred('tors')
  ) {
    return ['armor']
  }

  // Weapons
  if (
    base.kind === 'weapon' ||
    tags.includes('weap') ||
    isAPred('weap') ||
    BARBARIAN_ONE_OR_TWO_HANDED_SWORD_CODES.has(code) ||
    STRICT_TWO_HANDED_WEAPON_CODES.has(code) ||
    CANONICAL_ONE_HANDED_WEAPON_CODES.has(code)
  ) {
    const isOneOrTwoHanded = Boolean(
      base.oneOrTwoHanded ||
        BARBARIAN_ONE_OR_TWO_HANDED_SWORD_CODES.has(code) ||
        (dropTables?.weapons?.get?.(code) as any)?.['1or2handed'] === '1',
    )
    const isStrictTwoHanded =
      !isOneOrTwoHanded &&
      Boolean(
        base.twoHanded ||
          STRICT_TWO_HANDED_WEAPON_CODES.has(code) ||
          tags.some(t => ['bow', 'xbow', 'staf', 'pole', 'spea', '2h'].includes(t)) ||
          ['bow', 'xbow', 'staf', 'pole', 'spea', '2h'].includes(typeCode) ||
          (dropTables?.weapons?.get?.(code) as any)?.twohanded === '1',
      )
    if (isStrictTwoHanded) {
      return ['weapon1']
    }
    return ['weapon1', 'weapon2']
  }

  return []
}

/**
 * Ground Truth (`D2Common.dll` 1.13c `ITEMS_GetColor` @ `0x6fd99750`, `D2Common/src/Items/Items.cpp:3651-3836`):
 * Resolves the 2D inventory palette shift (`invtransform`) and 3D character paperdoll palette shift (`chrtransform`)
 * for an item across all quality tiers:
 * - Unidentified / gamble mystery items have no color transform (`undefined`).
 * - Unique (`ITEMQUAL_UNIQUE`): `uniqueItemDef.invtransform` / `uniqueItemDef.chrtransform` (or lookup in `dropTables.uniques`).
 * - Set (`ITEMQUAL_SET`): `setItemDef.invtransform` / `setItemDef.chrtransform` (or lookup in `dropTables.sets.items`).
 * - Magic / Rare / Crafted (`ITEMQUAL_MAGIC` | `ITEMQUAL_RARE` | `ITEMQUAL_CRAFT` | `ITEMQUAL_TEMPERED`):
 *   checks rolled **suffixes** first (`MagicSuffix.txt`), first suffix with `transform === true && transformColor` wins;
 *   if none, checks rolled **prefixes** (`MagicPrefix.txt`), first prefix with `transform === true && transformColor` wins.
 * - Low / Normal / Superior (and non-runeword socketed items):
 *   checks `socketedItems` in socket order; the first socketed gem (`Gems.txt` `isGem`) maps `gem.transform` (`0..20`)
 *   to `COLOR_CODES[gem.transform]`.
 * - AutoMagic fallback (`item.autoAffixId`): checks `CANONICAL_AUTOMAGIC_TABLE` for `transform && transformColor`.
 */
function lookupPacketAffix(
  tableOrList: { readonly getById?: (id: number) => any; readonly all?: readonly any[] } | readonly any[] | undefined,
  id: number | undefined,
): any {
  if (typeof id !== 'number' || id <= 0 || !tableOrList) return undefined
  if ('getById' in tableOrList && typeof tableOrList.getById === 'function') {
    return tableOrList.getById(id)
  }
  const list: readonly any[] = Array.isArray(tableOrList)
    ? tableOrList
    : 'all' in tableOrList && Array.isArray(tableOrList.all)
      ? tableOrList.all
      : []
  const byId = list.find((a: any) => a?.id === id)
  if (byId) return byId
  if (list.length > 0 && list[0]?.id === undefined) {
    return list[id - 1]
  }
  return undefined
}

export function resolveItemColorTransform(
  item: Item,
  quality: UiItemQuality,
  code: string,
  dropTables?: DropTables,
): { invtransform?: string | undefined; chrtransform?: string | undefined } {
  const isUnidentified = Boolean(
    item.isGambleMystery ||
    item.identified === false ||
    (item.flags !== undefined && item.flags.identified === false),
  )
  if (isUnidentified || (item as any).runewordRunes || item.flags?.runeword) {
    return { invtransform: undefined, chrtransform: undefined }
  }

  let invtransform: string | undefined =
    (item as any).invtransform ?? item.uniqueItemDef?.invtransform ?? item.setItemDef?.invtransform
  let chrtransform: string | undefined =
    (item as any).chrtransform ?? item.uniqueItemDef?.chrtransform ?? item.setItemDef?.chrtransform

  if (quality === 'unique' && (!invtransform || !chrtransform) && dropTables?.uniques) {
    const targetName = (item.name ?? '').trim()
    let match =
      (targetName ? dropTables.uniques.get?.(targetName) : undefined) ??
      (targetName
        ? dropTables.uniques.all?.find(
            u => u.enabled && u.index.trim().toLowerCase() === targetName.toLowerCase(),
          )
        : undefined)
    if (!match && code) {
      const byCode = dropTables.uniques.getEnabledByCode?.(code.trim())
      if (byCode && byCode.length === 1) {
        match = byCode[0]
      }
    }
    if (match) {
      if (!invtransform && match.invtransform) invtransform = match.invtransform.trim().toLowerCase()
      if (!chrtransform && match.chrtransform) chrtransform = match.chrtransform.trim().toLowerCase()
    }
  } else if (quality === 'set' && (!invtransform || !chrtransform) && dropTables?.sets?.items) {
    const targetName = (item.name ?? '').trim()
    let match =
      (targetName ? dropTables.sets.items.getByIndex?.(targetName) : undefined) ??
      (targetName
        ? dropTables.sets.items.entries?.find(
            s => s.index.trim().toLowerCase() === targetName.toLowerCase(),
          )
        : undefined)
    if (!match && code) {
      const lowerCode = code.trim().toLowerCase()
      const byCode = dropTables.sets.items.entries?.filter(
        s => s.item.trim().toLowerCase() === lowerCode,
      )
      if (byCode && byCode.length === 1) {
        match = byCode[0]
      }
    }
    if (match) {
      if (!invtransform && match.invtransform) invtransform = match.invtransform.trim().toLowerCase()
      if (!chrtransform && match.chrtransform) chrtransform = match.chrtransform.trim().toLowerCase()
    }
  } else if (quality === 'magic' || quality === 'rare' || quality === 'craft') {
    if (!invtransform && !chrtransform) {
      let affixColor: string | undefined
      const suffixes =
        item.rolledMagicAffixes?.suffixes ??
        item.rolledRareAffixes?.suffixes ??
        (item.rolledMagicAffixes?.suffix ? [item.rolledMagicAffixes.suffix] : [])
      for (const suf of suffixes) {
        if (suf && suf.transform && suf.transformColor) {
          affixColor = suf.transformColor.trim().toLowerCase()
          break
        }
      }
      if (!affixColor && dropTables?.magicAffixes?.suffixes) {
        const sufTable = dropTables.magicAffixes.suffixes
        const sufIds = (item as any).magicSuffixIds ?? (item.magicSuffixId !== undefined ? [item.magicSuffixId] : [])
        for (const id of sufIds) {
          if (typeof id === 'number' && id > 0) {
            const suf = lookupPacketAffix(sufTable, id)
            if (suf && suf.transform && suf.transformColor) {
              affixColor = suf.transformColor.trim().toLowerCase()
              break
            }
          }
        }
      }
      if (!affixColor) {
        const prefixes =
          item.rolledMagicAffixes?.prefixes ??
          item.rolledRareAffixes?.prefixes ??
          (item.rolledMagicAffixes?.prefix ? [item.rolledMagicAffixes.prefix] : [])
        for (const pre of prefixes) {
          if (pre && pre.transform && pre.transformColor) {
            affixColor = pre.transformColor.trim().toLowerCase()
            break
          }
        }
      }
      if (!affixColor && dropTables?.magicAffixes?.prefixes) {
        const preTable = dropTables.magicAffixes.prefixes
        const preIds = (item as any).magicPrefixIds ?? (item.magicPrefixId !== undefined ? [item.magicPrefixId] : [])
        for (const id of preIds) {
          if (typeof id === 'number' && id > 0) {
            const pre = lookupPacketAffix(preTable, id)
            if (pre && pre.transform && pre.transformColor) {
              affixColor = pre.transformColor.trim().toLowerCase()
              break
            }
          }
        }
      }
      if (affixColor) {
        invtransform = affixColor
        chrtransform = affixColor
      }
    }
  } else if (quality === 'normal' && !(item as any).runewordRunes && !item.flags?.runeword) {
    if (!invtransform && !chrtransform && Array.isArray(item.socketedItems)) {
      for (const sock of item.socketedItems) {
        const sockCode = (sock?.code ?? sock?.base?.id ?? '').trim().toLowerCase()
        const gemColor = getGemColorTransform(sockCode)
        if (gemColor) {
          invtransform = gemColor
          chrtransform = gemColor
          break
        }
      }
    }
  }

  // Fallback: AutoMagic (`Items.cpp:3816-3827`)
  if (!invtransform && !chrtransform) {
    const directAuto = (item as any).autoAffix
    if (directAuto && directAuto.transform && directAuto.transformColor) {
      const autoColor = String(directAuto.transformColor).trim().toLowerCase()
      invtransform = autoColor
      chrtransform = autoColor
    } else if (typeof item.autoAffixId === 'number' && item.autoAffixId > 0) {
      const autoTable = dropTables?.autoMagic ?? CANONICAL_AUTOMAGIC_TABLE
      const autoEntry =
        autoTable.entries[item.autoAffixId - 1] ??
        autoTable.entries.find(e => e.id === item.autoAffixId)
      if (autoEntry && autoEntry.transform && autoEntry.transformColor) {
        const autoColor = autoEntry.transformColor.trim().toLowerCase()
        invtransform = autoColor
        chrtransform = autoColor
      }
    }
  }

  return {
    invtransform: invtransform ? invtransform.trim().toLowerCase() : undefined,
    chrtransform: chrtransform ? chrtransform.trim().toLowerCase() : undefined,
  }
}

/**
 * Ground Truth (`data\global\excel\ItemTypes.txt` `VarInvGfx` + `InvGfx1..6` in Diablo II v1.13c):
 * Maps item codes and item type codes with variable inventory graphics (`VarInvGfx > 0`)
 * to their exact 0-indexed `InvGfx1..6` sprite keys (`graphicIndex = 0..N-1`).
 */
export const CANONICAL_VAR_INV_GFX: Readonly<Record<string, readonly string[]>> = {
  rin: ['invrin1', 'invrin2', 'invrin3', 'invrin4', 'invrin5'],
  ring: ['invrin1', 'invrin2', 'invrin3', 'invrin4', 'invrin5'],
  amu: ['invamu1', 'invamu2', 'invamu3'],
  amul: ['invamu1', 'invamu2', 'invamu3'],
  jew: ['invjw1', 'invjw2', 'invjw3', 'invjw4', 'invjw5', 'invjw6'],
  jewl: ['invjw1', 'invjw2', 'invjw3', 'invjw4', 'invjw5', 'invjw6'],
  cm1: ['invch1', 'invch4', 'invch7'],
  scha: ['invch1', 'invch4', 'invch7'],
  char: ['invch1', 'invch4', 'invch7'],
  cm2: ['invch2', 'invch5', 'invch8'],
  mcha: ['invch2', 'invch5', 'invch8'],
  cm3: ['invch3', 'invch6', 'invch9'],
  lcha: ['invch3', 'invch6', 'invch9'],
}

/**
 * Resolves the DC6 inventory graphic sprite key (`invFile`) following
 * the authentic Diablo II 1.13c resolution hierarchy and guaranteeing
 * 100% resolution against `BAKED_UI_MANIFEST.itemRects`.
 */
export function resolveItemInvFile(
  item: Item,
  quality: UiItemQuality,
  code: string,
  dropTables?: DropTables,
): { invFile: string; invtransform?: string | undefined; chrtransform?: string | undefined } {
  let invFile: string | undefined = undefined
  const resolvedColors = resolveItemColorTransform(item, quality, code, dropTables)
  let invtransform: string | undefined = resolvedColors.invtransform
  const chrtransform: string | undefined = resolvedColors.chrtransform

  const rawVariant =
    typeof (item as any).variant === 'number' && Number.isFinite((item as any).variant) && (item as any).variant >= 0
      ? Math.trunc((item as any).variant)
      : typeof (item as any).graphicIndex === 'number' && Number.isFinite((item as any).graphicIndex) && (item as any).graphicIndex >= 0
        ? Math.trunc((item as any).graphicIndex)
        : undefined
  const varGfxList =
    CANONICAL_VAR_INV_GFX[code] ??
    (typeof (item.base as any)?.type === 'string'
      ? CANONICAL_VAR_INV_GFX[(item.base as any).type.trim().toLowerCase()]
      : undefined)

  // 1. Explicit Unique / Set Table Graphics
  if (quality === 'unique') {
    if (item.uniqueItemDef?.invfile) {
      invFile = item.uniqueItemDef.invfile
    } else if (dropTables) {
      const b = dropTables.weapons.get(code) ?? dropTables.armor.get(code) ?? dropTables.misc.get(code)
      if ((b as any)?.uniqueinvfile) {
        invFile = (b as any).uniqueinvfile
      }
    }
  } else if (quality === 'set') {
    if (item.setItemDef?.invfile) {
      invFile = item.setItemDef.invfile
    } else if (dropTables) {
      const b = dropTables.weapons.get(code) ?? dropTables.armor.get(code) ?? dropTables.misc.get(code)
      if ((b as any)?.setinvfile) {
        invFile = (b as any).setinvfile
      }
    }
  }

  // 1.5 Variable Inventory Graphics (`ItemTypes.txt` `VarInvGfx` + `InvGfx1..6`)
  // Unless a unique/set/quest item has an explicit dedicated `invfile` in UniqueItems.txt / Misc.txt
  // (e.g. invmss, invtrch, invvip), rings, amulets, jewels, and charms select their sprite from `InvGfx1..6` via `graphicIndex` (`variant`).
  if (!invFile && varGfxList) {
    const explicitInv = ((item as any).invFile ?? (item.base as any)?.invfile ?? (item.base as any)?.invFile ?? '')
      .toString()
      .trim()
      .toLowerCase()
    if (explicitInv === 'invmss' || explicitInv === 'invtrch' || explicitInv === 'invvip' || code === 'vip') {
      invFile = explicitInv || 'invvip'
    } else if (rawVariant !== undefined) {
      invFile = varGfxList[rawVariant % varGfxList.length]
    } else if (explicitInv && varGfxList.includes(explicitInv)) {
      invFile = explicitInv
    } else {
      invFile = varGfxList[0]
    }
  }

  // 2. Pre-baked Manifest Lookup by Item Display Name (handles dyed unique/set sprites e.g. "invcap_cgrn")
  if (!invFile && item.name && BAKED_UI_MANIFEST.codeToInvFile[item.name]) {
    const manifestInv = BAKED_UI_MANIFEST.codeToInvFile[item.name]
    if (manifestInv.includes('_')) {
      const [baseKey, dyeKey] = manifestInv.split('_')
      invFile = baseKey
      if (!invtransform) invtransform = dyeKey
    } else {
      invFile = manifestInv
    }
  }

  // 3. Base Item Definition Graphic
  if (!invFile) {
    const baseInv = (item.base as any)?.invfile ?? (item.base as any)?.invFile
    if (baseInv) {
      invFile = baseInv
    } else if (dropTables) {
      const b = dropTables.weapons.get(code) ?? dropTables.armor.get(code) ?? dropTables.misc.get(code)
      if ((b as any)?.invfile) {
        invFile = (b as any).invfile
      }
    }
  }

  // 4. Base Code Lookup in Manifest
  if (!invFile && BAKED_UI_MANIFEST.codeToInvFile[code]) {
    invFile = BAKED_UI_MANIFEST.codeToInvFile[code]
  }

  // 5. Direct Prefix Fallback
  if (!invFile) {
    invFile = 'inv' + code
  }

  // 6. Authentic Charms, Rings, Amulets, Jewels & Quest Item Overrides
  if (code === 'cm1' && (!invFile || invFile === 'invchm')) invFile = 'invch1'
  if (code === 'cm2' && (!invFile || invFile === 'invwnd')) invFile = 'invch2'
  if (code === 'cm3' && (!invFile || invFile === 'invsst')) invFile = 'invch3'
  if ((code === 'rin' || code === 'ring') && (!invFile || invFile === 'invrin')) invFile = 'invrin1'
  if ((code === 'amu' || code === 'amul') && (!invFile || invFile === 'invamu')) invFile = 'invamu1'
  if ((code === 'jew' || code === 'jewl') && (!invFile || invFile === 'invjew' || invFile === 'invjw' || invFile === 'invgswe')) invFile = 'invjw1'
  if (code === 'tbk') invFile = 'invbbk'
  if (code === 'ibk') invFile = 'invrbk'
  if (code === 'box') invFile = 'invbox'

  // 7. Verify 100% Atlas Matching Against BAKED_UI_MANIFEST.itemRects
  if (invFile && BAKED_UI_MANIFEST.itemRects[invFile]) {
    // verified exact match
  } else if (invFile && BAKED_UI_MANIFEST.itemRects[invFile.toLowerCase()]) {
    invFile = invFile.toLowerCase()
  } else {
    // Find closest valid atlas rect
    if (item.name && BAKED_UI_MANIFEST.codeToInvFile[item.name] && BAKED_UI_MANIFEST.itemRects[BAKED_UI_MANIFEST.codeToInvFile[item.name]]) {
      invFile = BAKED_UI_MANIFEST.codeToInvFile[item.name]
    } else if (BAKED_UI_MANIFEST.codeToInvFile[code] && BAKED_UI_MANIFEST.itemRects[BAKED_UI_MANIFEST.codeToInvFile[code]]) {
      invFile = BAKED_UI_MANIFEST.codeToInvFile[code]
    } else {
      const w = item.invWidth ?? item.base?.invWidth ?? 1
      const h = item.invHeight ?? item.base?.invHeight ?? 1
      if (item.base?.kind === 'weapon') {
        invFile = 'invhax'
      } else if (item.base?.kind === 'armor') {
        invFile = 'invcap'
      } else if (w === 1 && h === 1) {
        invFile = 'invch1'
      } else if (w === 1 && h === 2) {
        invFile = 'invch2'
      } else if (w === 1 && h === 3) {
        invFile = 'invch3'
      } else {
        invFile = 'invcap'
      }
    }
  }

  return { invFile, invtransform, chrtransform }
}

/**
 * Converts a game engine `Item` instance into a `UiInventoryItem` instance
 * suitable for the UI Inventory grid, paperdoll slots, and hover tooltips.
 *
 * Guarantees Diablo II v1.13c parity:
 * - 100% valid `invFile` resolving to `BAKED_UI_MANIFEST.itemRects`
 * - Accurate `allowedSlots` for equipment placement
 * - Bilingual names `nameZh` and `baseNameZh`
 * - Standardized `UiItemQuality`
 * - Formatted stats and requirement lines with authentic D2ColorCode colors
 */
export function itemToUiInventoryItem(
  item: Item,
  dropTables?: DropTables,
  playerLevel?: number,
): UiInventoryItem & { readonly variant?: number | undefined; readonly graphicIndex?: number | undefined } {
  // Defensive passthrough: already a complete UiInventoryItem
  if (
    item &&
    Array.isArray((item as any).allowedSlots) &&
    typeof (item as any).invFile === 'string' &&
    typeof (item as any).nameZh === 'string'
  ) {
    return item as unknown as UiInventoryItem
  }

  // Handle case where ground entity was passed instead of ground entity.item
  const rawItem: Item = (item as any)?.item && typeof (item as any)?.item === 'object' ? (item as any).item : item
  const base = rawItem.base ?? { id: 'unknown', name: rawItem.name ?? 'Item', kind: 'misc', invWidth: 1, invHeight: 1, maxStack: 1, value: 0, damage: 0, defense: 0, tags: [], level: 1 }
  const code = (rawItem.code ?? base.id ?? '').trim().toLowerCase()

  // 1. Quality Mapping
  let quality: UiItemQuality = 'normal'
  const rawQ = rawItem.quality
  const rawRarity = String(rawItem.rarity ?? '').toLowerCase()

  if (
    isRuneCode(code) ||
    (base as any)?.isRune ||
    (rawItem as any)?.isRune ||
    rawRarity === 'rune' ||
    rawRarity === 'runeword' ||
    Boolean(rawItem.runeword || rawItem.flags?.runeword || (rawItem as any).isRuneword)
  ) {
    quality = 'rune'
  } else if (rawQ === ItemQuality.UNIQUE || rawQ === 7 || rawRarity === 'unique' || Boolean(rawItem.uniqueItemDef)) {
    quality = 'unique'
  } else if (rawQ === ItemQuality.SET || rawQ === 5 || rawRarity === 'set' || Boolean(rawItem.setItemDef)) {
    quality = 'set'
  } else if (rawQ === ItemQuality.RARE || rawQ === 6 || rawRarity === 'rare' || Boolean(rawItem.rolledRareAffixes)) {
    quality = 'rare'
  } else if (rawQ === ItemQuality.MAGIC || rawQ === 4 || rawRarity === 'magic' || Boolean(rawItem.rolledMagicAffixes)) {
    quality = 'magic'
  } else if (rawQ === ItemQuality.CRAFTED || rawQ === 8 || rawRarity === 'crafted' || rawRarity === 'craft') {
    quality = 'craft'
  } else if (typeof rawQ === 'string' && ['normal', 'magic', 'rare', 'set', 'unique', 'craft', 'rune'].includes(rawQ)) {
    quality = rawQ as UiItemQuality
  }

  // 2. Pure Chinese & Pure English Name & Subtitle Construction
  let nameZh: string
  let baseNameZh: string
  let baseNameEn: string

  const baseEn = resolveBaseItemNameEn(base.name || rawItem.name || 'Item', code)
  const rawBaseZh = translateItemName(baseEn)
  const formattedBaseZh = rawBaseZh && rawBaseZh !== baseEn ? rawBaseZh : baseEn

  let resolvedItemNameEn: string | undefined
  if (quality === 'unique' && rawItem.uniqueItemDef) {
    const rawUniqueKey = (rawItem.uniqueItemDef.index || rawItem.name || '').trim()
    const uEn = resolveBaseItemNameEn(rawUniqueKey, code) || rawUniqueKey
    resolvedItemNameEn = uEn
    const uZh =
      translateItemName(rawUniqueKey) !== rawUniqueKey
        ? translateItemName(rawUniqueKey)
        : translateItemName(uEn)
    nameZh = uZh && uZh !== uEn ? uZh : uEn
    baseNameZh = formattedBaseZh
    baseNameEn = baseEn
  } else if (quality === 'set' && rawItem.setItemDef) {
    const rawSetKey = rawItem.setItemDef.index || rawItem.name
    const sEn = resolveBaseItemNameEn(rawSetKey) || rawSetKey.trim()
    resolvedItemNameEn = sEn
    const sZh = translateItemName(rawSetKey.trim())
    nameZh = sZh && sZh !== rawSetKey.trim() ? sZh : sEn
    baseNameZh = formattedBaseZh
    baseNameEn = baseEn
  } else if (quality === 'rare' && rawItem.rolledRareAffixes) {
    const rRaw = rawItem.rolledRareAffixes.name || rawItem.name
    const rPre = (rawItem.rolledRareAffixes as any).rarePrefix?.name ?? (rawItem.rolledRareAffixes as any).prefix1?.name
    const rSuf = (rawItem.rolledRareAffixes as any).rareSuffix?.name ?? (rawItem.rolledRareAffixes as any).suffix1?.name
    const rEn = resolveRareNameEn(rRaw, rPre, rSuf)
    resolvedItemNameEn = rEn
    const rZh = translateRareName(rRaw, rPre, rSuf)
    nameZh = rZh && rZh !== rEn ? rZh : rEn
    baseNameZh = formattedBaseZh
    baseNameEn = baseEn
  } else if (quality === 'magic' && rawItem.rolledMagicAffixes) {
    const mRaw = rawItem.rolledMagicAffixes.name || rawItem.name
    const mPre = (rawItem.rolledMagicAffixes as any).prefix?.name ?? (rawItem as any).prefix?.name
    const mSuf = (rawItem.rolledMagicAffixes as any).suffix?.name ?? (rawItem as any).suffix?.name
    const mEn = resolveMagicNameEn(mRaw, baseEn, mPre, mSuf, code)
    resolvedItemNameEn = mEn
    const mZh = translateMagicName(mRaw, baseEn, mPre, mSuf, code)
    nameZh = mZh && mZh !== mEn ? mZh : mEn
    baseNameZh = formattedBaseZh
    baseNameEn = baseEn
  } else if (
    (rawItem.runeword || rawItem.flags?.runeword || (rawItem as any).isRuneword) &&
    (rawItem.runeword?.name || (rawItem as any).runewordName || rawItem.name)
  ) {
    const rwKey = String((rawItem.runeword as any)?.key || rawItem.runeword?.name || (rawItem as any).runewordName || rawItem.name)
    const rwEn = String(rawItem.runeword?.name || (rawItem as any).runewordName || rawItem.name)
    const rwZh =
      translateItemName(rwKey) !== rwKey
        ? translateItemName(rwKey)
        : translateItemName(rwEn)
    nameZh = rwZh && rwZh !== rwEn ? rwZh : rwEn
    baseNameZh = formattedBaseZh
    baseNameEn = baseEn
  } else {
    const itemEn = rawItem.name ? resolveBaseItemNameEn(rawItem.name, code) : baseEn
    resolvedItemNameEn = itemEn
    const itemZh = translateItemName(itemEn)
    nameZh = itemZh && itemZh !== itemEn ? itemZh : itemEn
    baseNameZh = formattedBaseZh
    baseNameEn = baseEn
  }

  // Use pre-localized overrides if present (strip any mixed English parentheticals)
  if ((rawItem as any).nameZh) {
    const rawZh = String((rawItem as any).nameZh).replace(/\s*\([A-Za-z0-9' -]+\)$/, '')
    nameZh = rawZh
  }
  if ((rawItem as any).baseNameZh) {
    baseNameZh = String((rawItem as any).baseNameZh).replace(/\s*\([A-Za-z0-9' -]+\)$/, '')
  }
  if ((rawItem as any).baseNameEn) {
    baseNameEn = String((rawItem as any).baseNameEn)
  }

  // 3. invFile & Dye Resolution
  const { invFile, invtransform, chrtransform } = resolveItemInvFile(rawItem, quality, code, dropTables)
  const { invFile: baseInvFile } = resolveItemInvFile(
    { ...rawItem, name: baseEn, uniqueItemDef: undefined, setItemDef: undefined } as Item,
    'normal',
    code,
    dropTables,
  )

  // 4. Allowed Equipment Slots
  const allowedSlots = resolveAllowedSlots(
    {
      id: code,
      type: (base as any).type,
      kind: base.kind,
      tags: base.tags,
      twoHanded: (base as any).twoHanded,
      oneOrTwoHanded: (base as any).oneOrTwoHanded,
    },
    dropTables,
  )

  // 5. Tooltip & Formatted Stats (both CHI and ENG)
  const isGambleMystery = Boolean(rawItem.isGambleMystery || rawItem.flags?.gamble)
  const explicitCharLevel =
    playerLevel !== undefined && Number.isFinite(playerLevel) && playerLevel > 0
      ? Math.max(1, Math.trunc(playerLevel))
      : undefined
  const itemWithCharLevel = {
    ...rawItem,
    base,
    ...(explicitCharLevel !== undefined ? { charLevel: explicitCharLevel } : {}),
  } as Item
  const tt = formatItemTooltip(itemWithCharLevel, 'zh')
  const ttEn = formatItemTooltip(itemWithCharLevel, 'en')
  let stats: { text: string; color?: D2ColorCode }[] = isGambleMystery
    ? [{ text: '未辨识', color: 'red' }]
    : (tt.lines || []).map(l => ({
        text: l.text,
        color: (l.color === 'instruction' ? 'white' : l.color) as D2ColorCode,
      }))
  let statsEn: { text: string; color?: D2ColorCode }[] = isGambleMystery
    ? [{ text: 'Unidentified', color: 'red' }]
    : (ttEn.lines || []).map(l => ({
        text: l.text,
        color: (l.color === 'instruction' ? 'white' : l.color) as D2ColorCode,
      }))

  // Fallback for items with flat stats dictionary but no rolled props
  if (!isGambleMystery && stats.length === 0 && rawItem.stats && typeof rawItem.stats === 'object') {
    const fallbackStats = Object.entries(rawItem.stats)
      .filter(([k, v]) => typeof v === 'number' && v !== 0 && k !== 'gold' && k !== 'value')
      .map(([k, v]) => ({
        text: `+${v} ${k}`,
        color: 'blue' as D2ColorCode,
      }))
    if (fallbackStats.length > 0) {
      stats = fallbackStats
      if (statsEn.length === 0) statsEn = fallbackStats
    }
  }

  // Damage evaluation
  let damage: string | undefined = undefined
  let damageEn: string | undefined = undefined
  if (!isGambleMystery) {
    if (tt.oneHandDamage && tt.twoHandDamage) {
      damage = `${tt.oneHandDamage.min} - ${tt.oneHandDamage.max} / 双手: ${tt.twoHandDamage.min} - ${tt.twoHandDamage.max}`
      damageEn = `One-Hand Damage: ${tt.oneHandDamage.min} to ${tt.oneHandDamage.max} / Two-Hand Damage: ${tt.twoHandDamage.min} to ${tt.twoHandDamage.max}`
    } else if (tt.twoHandDamage) {
      damage = `双手伤害: ${tt.twoHandDamage.min} - ${tt.twoHandDamage.max}`
      damageEn = `Two-Hand Damage: ${tt.twoHandDamage.min} to ${tt.twoHandDamage.max}`
    } else if (tt.oneHandDamage) {
      damage = `${tt.oneHandDamage.min} - ${tt.oneHandDamage.max}`
      damageEn = `${tt.oneHandDamage.min} to ${tt.oneHandDamage.max}`
    } else if (tt.throwDamage) {
      damage = `投掷伤害: ${tt.throwDamage.min} - ${tt.throwDamage.max}`
      damageEn = `Throw Damage: ${tt.throwDamage.min} to ${tt.throwDamage.max}`
    } else if ((base as any).minMisDam && (base as any).maxMisDam) {
      damage = `投掷伤害: ${(base as any).minMisDam} - ${(base as any).maxMisDam}`
      damageEn = `Throw Damage: ${(base as any).minMisDam} to ${(base as any).maxMisDam}`
    } else if (base.kind === 'weapon' && (base as any).damage !== undefined && (base as any).damage > 0) {
      damage = String((base as any).damage)
      damageEn = String((base as any).damage)
    }
  }

  // Durability evaluation
  const durability = isGambleMystery
    ? undefined
    : tt.durability
    ? { current: tt.durability.current, max: tt.durability.max }
    : rawItem.durability !== undefined && rawItem.maxDurability !== undefined
    ? { current: rawItem.durability, max: rawItem.maxDurability }
    : undefined

  const rolledSockProp = Array.isArray(rawItem.rolledProps)
    ? rawItem.rolledProps.reduce((sum, p) => ((p.code || '').trim().toLowerCase() === 'sock' ? sum + p.value : sum), 0)
    : 0
  const sockets = isGambleMystery
    ? undefined
    : (rawItem as any).sockets ??
      rawItem.totalSockets ??
      rawItem.socketedCount ??
      (rolledSockProp > 0 ? rolledSockProp : undefined)
  const socketedItems =
    !isGambleMystery && Array.isArray(rawItem.socketedItems) && rawItem.socketedItems.length > 0
      ? rawItem.socketedItems.map(s => itemToUiInventoryItem(s, dropTables))
      : undefined
  const ethereal = !isGambleMystery && Boolean((tt as any).ethereal || (rawItem as any).ethereal || rawItem.flags?.ethereal)

  const isUnidentified = Boolean(
    isGambleMystery ||
    rawItem.identified === false ||
    (rawItem.flags !== undefined && rawItem.flags.identified === false),
  )
  if (
    isUnidentified &&
    !isGambleMystery &&
    !stats.some(s => s.text.includes('未鉴定') || s.text.includes('未辨识') || s.text.includes('Unidentified'))
  ) {
    stats = [{ text: '未辨识', color: 'red' }, ...stats]
  }
  if (
    isUnidentified &&
    !isGambleMystery &&
    !statsEn.some(s => s.text.includes('Unidentified'))
  ) {
    statsEn = [{ text: 'Unidentified', color: 'red' }, ...statsEn]
  }

  const isTome = code === 'tbk' || code === 'ibk'
  const rawQty =
    typeof rawItem.quantity === 'number'
      ? rawItem.quantity
      : isTome && typeof rawItem.stack === 'number'
      ? rawItem.stack
      : isTome
      ? 20
      : undefined
  const maxQuantity = isTome ? 20 : base.maxStack > 1 ? base.maxStack : undefined
  if (isTome && rawQty !== undefined && !baseNameZh.includes('数量:') && !stats.some(s => s.text.includes('数量:'))) {
    stats = [...stats, { text: `数量: ${rawQty}`, color: 'white' }]
  }
  if (isTome && rawQty !== undefined && !baseNameEn.includes('Quantity:') && !statsEn.some(s => s.text.includes('Quantity:'))) {
    statsEn = [...statsEn, { text: `Quantity: ${rawQty}`, color: 'white' }]
  }

  const id = String(
    rawItem.uniqueId
      ? `item-${code}-${rawItem.uniqueId}`
      : (rawItem as any).id ?? `item-${code}-${++itemBridgeSeqCounter}`,
  )

  let flippyFile: string | undefined = (rawItem as any).flippyFile ?? (rawItem as any).flippyfile
  if (!flippyFile && quality === 'unique') {
    flippyFile = rawItem.uniqueItemDef?.flippyfile
    if (!flippyFile && dropTables?.uniques) {
      const targetName = (rawItem.name ?? '').trim()
      let match =
        (targetName ? dropTables.uniques.get?.(targetName) : undefined) ??
        (targetName
          ? dropTables.uniques.all?.find(
              u => u.enabled && u.index.trim().toLowerCase() === targetName.toLowerCase(),
            )
          : undefined)
      if (!match && code) {
        const byCode = dropTables.uniques.getEnabledByCode?.(code.trim())
        if (byCode && byCode.length === 1) {
          match = byCode[0]
        }
      }
      if (match?.flippyfile) {
        flippyFile = match.flippyfile
      }
    }
  } else if (!flippyFile && quality === 'set') {
    flippyFile = rawItem.setItemDef?.flippyfile
    if (!flippyFile && dropTables?.sets?.items) {
      const targetName = (rawItem.name ?? '').trim()
      let match =
        (targetName ? dropTables.sets.items.getByIndex?.(targetName) : undefined) ??
        (targetName
          ? dropTables.sets.items.entries?.find(
              s => s.index.trim().toLowerCase() === targetName.toLowerCase(),
            )
          : undefined)
      if (!match && code) {
        const lowerCode = code.trim().toLowerCase()
        const byCode = dropTables.sets.items.entries?.filter(
          s => s.item?.trim().toLowerCase() === lowerCode,
        )
        if (byCode && byCode.length === 1) {
          match = byCode[0]
        }
      }
      if (match?.flippyfile) {
        flippyFile = match.flippyfile
      }
    }
  }
  if (!flippyFile) {
    flippyFile = (base as any).flippyfile
  }
  const dropSound = (rawItem as any).dropSound ?? (rawItem as any).dropsound ?? (base as any).dropsound
  const dropSfxFrame = (rawItem as any).dropSfxFrame ?? (rawItem as any).dropsfxframe ?? (base as any).dropsfxframe
  const permStore = Boolean(rawItem.permStore ?? base.permStoreItem)

  const reqClass = !isGambleMystery
    ? resolveItemRequiredClass(base as any, rawItem as any, dropTables)
    : undefined
  // Ground Truth (D2Common.dll ITEMS_GetRequiredLevel 0x6fd76190 @ 0x6fd761e5):
  // Unidentified items only evaluate base levelreq (test byte ptr [ecx+0x18], 0x10 / IFLAG_IDENTIFIED);
  // unrevealed affix/unique/set reqLevels are not exposed until identified.
  const baseLevelReq = typeof (base as any).levelreq === 'number' ? (base as any).levelreq : 0
  const effectiveReqLevel = !isGambleMystery
    ? isUnidentified
      ? baseLevelReq > 1
        ? baseLevelReq
        : 0
      : Math.max(
          tt.reqLevel ?? 0,
          typeof (rawItem as any).reqLevel === 'number' ? (rawItem as any).reqLevel : 0,
          baseLevelReq > 1 ? baseLevelReq : 0,
        )
    : 0
  const effectiveReqStr = !isGambleMystery
    ? Math.max(
        tt.reqStr ?? 0,
        typeof (rawItem as any).reqStr === 'number' ? (rawItem as any).reqStr : 0,
        typeof (base as any).reqstr === 'number' && tt.reqStr === undefined ? (base as any).reqstr : 0,
      )
    : 0
  const effectiveReqDex = !isGambleMystery
    ? Math.max(
        tt.reqDex ?? 0,
        typeof (rawItem as any).reqDex === 'number' ? (rawItem as any).reqDex : 0,
        typeof (base as any).reqdex === 'number' && tt.reqDex === undefined ? (base as any).reqdex : 0,
      )
    : 0
  const isTwoHandedWeapon =
    !isGambleMystery &&
    Boolean(
      (rawItem as any).twoHanded ||
        base.twoHanded ||
        BARBARIAN_ONE_OR_TWO_HANDED_SWORD_CODES.has(code) ||
        STRICT_TWO_HANDED_WEAPON_CODES.has(code) ||
        (dropTables?.weapons?.get?.(code) as any)?.twoHanded ||
        (dropTables?.weapons?.get?.(code) as any)?.twohanded === '1',
    )
  const isOneOrTwoHandedWeapon =
    !isGambleMystery &&
    Boolean(
      (rawItem as any).oneOrTwoHanded ||
        base.oneOrTwoHanded ||
        BARBARIAN_ONE_OR_TWO_HANDED_SWORD_CODES.has(code) ||
        (dropTables?.weapons?.get?.(code) as any)?.oneOrTwoHanded ||
        (dropTables?.weapons?.get?.(code) as any)?.['1or2handed'] === '1',
    )

  const invWidth = rawItem.invWidth ?? (rawItem as any).invW ?? base.invWidth ?? (base as any).invW ?? 1
  const invHeight = rawItem.invHeight ?? (rawItem as any).invH ?? base.invHeight ?? (base as any).invH ?? 1
  const slotType =
    (rawItem as any).slot ??
    (allowedSlots[0] === 'weapon1' ? 'weapon' : allowedSlots[0] ?? 'none')
  const itemVariant =
    typeof (rawItem as any).variant === 'number' && Number.isFinite((rawItem as any).variant) && (rawItem as any).variant >= 0
      ? Math.trunc((rawItem as any).variant)
      : typeof (rawItem as any).graphicIndex === 'number' && Number.isFinite((rawItem as any).graphicIndex) && (rawItem as any).graphicIndex >= 0
        ? Math.trunc((rawItem as any).graphicIndex)
        : undefined

  return {
    id,
    code,
    invFile,
    spriteCode: invFile,
    baseInvFile,
    name: rawItem.runeword?.name || (rawItem as any).runewordName || resolvedItemNameEn || rawItem.name || baseEn,
    nameZh,
    baseNameZh,
    baseNameEn,
    quality: isGambleMystery ? 'normal' : quality,
    invWidth,
    invHeight,
    gridW: invWidth,
    gridH: invHeight,
    slotType,
    allowedSlots,
    ...(itemVariant !== undefined ? { variant: itemVariant, graphicIndex: itemVariant } : {}),
    ...(isTwoHandedWeapon ? { twoHanded: true } : {}),
    ...(isOneOrTwoHandedWeapon ? { oneOrTwoHanded: true } : {}),
    ...(!isGambleMystery && tt.defense !== undefined
      ? { defense: tt.defense }
      : !isGambleMystery && (rawItem.defense !== undefined || base.defense > 0)
      ? { defense: rawItem.defense ?? base.defense }
      : {}),
    ...(!isGambleMystery && tt.baseDefense !== undefined ? { baseDefense: tt.baseDefense } : {}),
    ...(!isGambleMystery && tt.oneHandDamage !== undefined ? { oneHandDamage: tt.oneHandDamage } : {}),
    ...(!isGambleMystery && tt.twoHandDamage !== undefined ? { twoHandDamage: tt.twoHandDamage } : {}),
    ...(!isGambleMystery && tt.throwDamage !== undefined ? { throwDamage: tt.throwDamage } : {}),
    ...(damage !== undefined ? { damage } : {}),
    ...(damageEn !== undefined ? { damageEn } : {}),
    ...(effectiveReqLevel > 0 ? { reqLevel: effectiveReqLevel } : {}),
    ...(effectiveReqStr > 0 ? { reqStr: effectiveReqStr } : {}),
    ...(effectiveReqDex > 0 ? { reqDex: effectiveReqDex } : {}),
    ...(reqClass !== undefined ? { reqClass } : {}),
    stats,
    statsEn,
    ...(!isGambleMystery && invtransform ? { invtransform } : {}),
    ...(!isGambleMystery && chrtransform ? { chrtransform } : {}),
    ...(durability ? { durability } : {}),
    ...(sockets !== undefined && sockets > 0 ? { sockets } : {}),
    ...(socketedItems !== undefined ? { socketedItems } : {}),
    ...(ethereal ? { ethereal: true } : {}),
    ...(!isGambleMystery && ((rawItem as any).speedText || tt.speedText) ? { speedText: (rawItem as any).speedText || tt.speedText } : {}),
    ...(!isGambleMystery && ((rawItem as any).speedTextEn || ttEn.speedText) ? { speedTextEn: (rawItem as any).speedTextEn || ttEn.speedText } : {}),
    ...(!isGambleMystery && ((rawItem as any).runewordRunes || tt.runewordRunes) ? { runewordRunes: (rawItem as any).runewordRunes || tt.runewordRunes } : {}),
    ...(!isGambleMystery && tt.setName ? { setName: tt.setName } : {}),
    ...(!isGambleMystery && ttEn.setName ? { setNameEn: ttEn.setName } : {}),
    ...(!isGambleMystery && tt.setPieces ? { setPieces: tt.setPieces } : {}),
    ...(!isGambleMystery && ttEn.setPieces ? { setPiecesEn: ttEn.setPieces } : {}),
    ...(!isGambleMystery && tt.setPieceColors ? { setPieceColors: tt.setPieceColors as readonly D2ColorCode[] } : {}),
    ...(!isGambleMystery && tt.setBonuses ? { setBonuses: tt.setBonuses.map(b => ({ text: b.text, color: (b.color ?? 'green') as D2ColorCode })) } : {}),
    ...(!isGambleMystery && ttEn.setBonuses ? { setBonusesEn: ttEn.setBonuses.map(b => ({ text: b.text, color: (b.color ?? 'green') as D2ColorCode })) } : {}),
    ...(typeof flippyFile === 'string' && flippyFile.length > 0 ? { flippyFile } : {}),
    ...(typeof dropSound === 'string' && dropSound.length > 0 ? { dropSound } : {}),
    ...(typeof dropSfxFrame === 'number' && Number.isFinite(dropSfxFrame) ? { dropSfxFrame } : {}),
    rawItem: itemWithCharLevel,
    ...(permStore ? { permStore: true } : {}),
    ...(isGambleMystery ? { isGambleMystery: true } : {}),
    ...(isUnidentified ? { identified: false } : { identified: true }),
    ...(rawQty !== undefined ? { quantity: rawQty } : {}),
    ...(maxQuantity !== undefined ? { maxQuantity } : {}),
    ...((rawItem as any).buyCost !== undefined ? { buyCost: (rawItem as any).buyCost } : {}),
    ...((rawItem as any).sellCost !== undefined ? { sellCost: (rawItem as any).sellCost } : {}),
    ...((rawItem as any).repairCost !== undefined ? { repairCost: (rawItem as any).repairCost } : {}),
  }
}

const STAT_ID_TO_PROP_CODE: Readonly<Record<number, string>> = {
  0: 'str',
  1: 'enr',
  2: 'dex',
  3: 'vit',
  6: 'hp',
  7: 'hp',
  8: 'mana',
  9: 'mana',
  10: 'stam',
  11: 'stam',
  16: 'ac%',
  17: 'dmg%',
  18: 'dmg%',
  19: 'att',
  20: 'block',
  21: 'dmg-min',
  22: 'dmg-max',
  23: 'dmg-min',
  24: 'dmg-max',
  27: 'regen-mana',
  28: 'regen-stam',
  31: 'ac',
  32: 'ac-miss',
  33: 'ac-hth',
  34: 'red-dmg',
  35: 'red-mag',
  36: 'red-dmg%',
  37: 'res-mag',
  38: 'res-mag-max',
  39: 'res-fire',
  40: 'res-fire-max',
  41: 'res-ltng',
  42: 'res-ltng-max',
  43: 'res-cold',
  44: 'res-cold-max',
  45: 'res-pois',
  46: 'res-pois-max',
  48: 'fire-min',
  49: 'fire-max',
  50: 'ltng-min',
  51: 'ltng-max',
  52: 'dmg-mag',
  53: 'dmg-mag',
  54: 'cold-min',
  55: 'cold-max',
  56: 'cold-len',
  57: 'pois-min',
  58: 'pois-max',
  59: 'pois-len',
  60: 'lifesteal',
  62: 'manasteal',
  74: 'regen',
  75: 'dur%',
  76: 'hp%',
  77: 'mana%',
  78: 'thorns',
  79: 'gold%',
  80: 'mag%',
  81: 'knock',
  85: 'addxp',
  86: 'heal-kill',
  87: 'cheap',
  89: 'light',
  91: 'ease',
  93: 'ias',
  96: 'frw',
  97: 'oskill',
  98: 'state',
  99: 'fhr',
  102: 'fbr',
  105: 'fcr',
  107: 'skill',
  108: 'rip',
  110: 'res-pois-len',
  111: 'dmg',
  112: 'howl',
  113: 'stupidity',
  114: 'dmg-to-mana',
  115: 'ignore-ac',
  116: 'reduce-ac',
  117: 'noheal',
  118: 'half-freeze',
  119: 'att%',
  120: 'dmg-ac',
  121: 'dmg-demon',
  122: 'dmg-undead',
  123: 'att-demon',
  124: 'att-undead',
  125: 'throw',
  126: 'fireskill',
  127: 'allskills',
  128: 'light-thorns',
  134: 'freeze',
  135: 'openwounds',
  136: 'crush',
  137: 'kick',
  138: 'mana-kill',
  139: 'demon-heal',
  140: 'bloody',
  141: 'deadly',
  142: 'abs-fire%',
  143: 'abs-fire',
  144: 'abs-ltng%',
  145: 'abs-ltng',
  146: 'abs-mag%',
  147: 'abs-mag',
  148: 'abs-cold%',
  149: 'abs-cold',
  150: 'slow',
  151: 'aura',
  152: 'indestruct',
  153: 'nofreeze',
  154: 'stamdrain',
  155: 'reanimate',
  156: 'pierce',
  157: 'magicarrow',
  158: 'explosivearrow',
  159: 'dmg-min',
  160: 'dmg-max',
  179: 'att-mon%',
  180: 'dmg-mon%',
  181: 'fade',
  188: 'skilltab',
  195: 'att-skill',
  196: 'kill-skill',
  197: 'death-skill',
  198: 'hit-skill',
  199: 'levelup-skill',
  201: 'gethit-skill',
  204: 'charged',
  214: 'ac/lvl',
  215: 'ac%/lvl',
  216: 'hp/lvl',
  217: 'mana/lvl',
  218: 'dmg/lvl',
  219: 'dmg%/lvl',
  220: 'str/lvl',
  221: 'dex/lvl',
  222: 'enr/lvl',
  223: 'vit/lvl',
  224: 'att/lvl',
  225: 'att%/lvl',
  226: 'dmg-cold/lvl',
  227: 'dmg-fire/lvl',
  228: 'dmg-ltng/lvl',
  229: 'dmg-pois/lvl',
  230: 'res-cold/lvl',
  231: 'res-fire/lvl',
  232: 'res-ltng/lvl',
  233: 'res-pois/lvl',
  234: 'abs-cold/lvl',
  235: 'abs-fire/lvl',
  236: 'abs-ltng/lvl',
  237: 'abs-pois/lvl',
  238: 'thorns/lvl',
  239: 'gold%/lvl',
  240: 'mag%/lvl',
  241: 'regen-stam/lvl',
  242: 'stam/lvl',
  243: 'dmg-dem/lvl',
  244: 'dmg-und/lvl',
  245: 'att-dem/lvl',
  246: 'att-und/lvl',
  247: 'crush/lvl',
  248: 'wounds/lvl',
  249: 'kick/lvl',
  250: 'deadly/lvl',
  252: 'rep-dur',
  253: 'rep-quant',
  254: 'stack',
  268: 'ac/time',
  329: 'extra-fire',
  330: 'extra-ltng',
  331: 'extra-cold',
  332: 'extra-pois',
  333: 'pierce-fire',
  334: 'pierce-ltng',
  335: 'pierce-cold',
  336: 'pierce-pois',
  359: 'ethereal',
}

const ISC_STAT_NAME_BY_ID: ReadonlyMap<number, string> = (() => {
  const m = new Map<number, string>()
  for (const entry of Object.values(CANONICAL_ISC_DESC_TABLE)) {
    m.set(entry.id, entry.stat)
  }
  return m
})()

export function convertOnlineItemStatsToRolledProps(stats: readonly ItemStat[]): {
  readonly props: RolledItemProp[]
  readonly reqLevelBonus: number
  readonly socketsStat: number
  readonly curDurStat?: number | undefined
  readonly maxDurStat?: number | undefined
  readonly quantityStat?: number | undefined
} {
  const props: RolledItemProp[] = []
  let reqLevelBonus = 0
  let socketsStat = 0
  let curDurStat: number | undefined
  let maxDurStat: number | undefined
  let quantityStat: number | undefined

  const getStatId = (s: ItemStat | Record<string, any>): number =>
    Number(s.statId ?? (s as any).id ?? -1)
  const has17 = stats.some(s => getStatId(s) === 17)
  const has21 = stats.some(s => getStatId(s) === 21)
  const has22 = stats.some(s => getStatId(s) === 22)
  const has23 = stats.some(s => getStatId(s) === 23)
  const has24 = stats.some(s => getStatId(s) === 24)

  for (let i = 0; i < stats.length; i++) {
    const st = stats[i]!
    const statId = getStatId(st)
    const param = Number(st.param ?? 0)
    const value = Number(st.value ?? 0)

    if (statId === 72) {
      curDurStat = value
      continue
    }
    if (statId === 73) {
      maxDurStat = value
      continue
    }
    if (statId === 194) {
      socketsStat = Math.max(socketsStat, value)
      continue
    }
    if (statId === 70) {
      quantityStat = value
      continue
    }
    if (statId === 92) {
      reqLevelBonus = Math.max(reqLevelBonus, value)
      continue
    }
    if (statId === 14 || statId === 356) {
      continue
    }
    if (statId === 18 && has17) {
      continue
    }
    if (statId === 23 && has21) {
      continue
    }
    if (statId === 24 && has22) {
      continue
    }
    if (statId === 159 && (has21 || has23)) {
      continue
    }
    if (statId === 160 && (has22 || has24)) {
      continue
    }

    if (statId === 52) {
      const next = stats[i + 1]
      if (next && getStatId(next) === 53) {
        props.push({
          code: 'dmg-mag',
          min: value,
          max: Math.max(value, next.value),
          value,
        })
        i++
        continue
      }
      props.push({ code: 'dmg-mag', min: value, max: value, value })
      continue
    }
    if (statId === 53) {
      props.push({ code: 'dmg-mag', min: value, max: value, value })
      continue
    }

    if (statId === 6 || statId === 7 || statId === 8 || statId === 9 || statId === 10 || statId === 11) {
      const poolCode = statId <= 7 ? 'hp' : statId <= 9 ? 'mana' : 'stam'
      const normVal = Math.abs(value) >= 256 && (value & 0xff) === 0 ? value >> 8 : value
      props.push({ code: poolCode, min: normVal, max: normVal, value: normVal })
      continue
    }

    if (statId === 216 || statId === 217) {
      const poolPerLvlCode = statId === 216 ? 'hp/lvl' : 'mana/lvl'
      const normVal = Math.abs(value) >= 256 && (value & 0xff) === 0 ? value >> 8 : value
      props.push({ code: poolPerLvlCode, min: normVal, max: normVal, value: normVal })
      continue
    }

    if (statId === 83) {
      const clsCode = (['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'] as const)[param] ?? 'ama'
      props.push({ code: clsCode, min: value, max: value, value })
      continue
    }

    if (statId === 188) {
      // Wire param is `tab + 8 * class` (D2Common 0x6fd98470); D2Client descfunc 14 (0x6fb052e2) prints nothing
      // for tab >= 3, so an undecodable param yields no line.
      const tabIdx = decodeSkillTabParam(param)
      if (tabIdx !== undefined) {
        props.push({ code: 'skilltab', param: tabIdx, min: value, max: value, value })
      }
      continue
    }

    if (statId === 97 || statId === 107 || statId === 151 || statId === 155) {
      const code = STAT_ID_TO_PROP_CODE[statId]!
      props.push({ code, param, min: value, max: value, value })
      continue
    }

    if (statId >= 195 && statId <= 201 && STAT_ID_TO_PROP_CODE[statId]) {
      const procCode = STAT_ID_TO_PROP_CODE[statId]!
      const skillId = param >= 64 ? param >> 6 : param
      const slvl = param >= 64 ? Math.max(1, param & 0x3f) : 1
      props.push({ code: procCode, param: skillId, min: value, max: slvl, value })
      continue
    }

    if (statId === 204) {
      const skillId = param >= 64 ? param >> 6 : param
      const slvl = param >= 64 ? Math.max(1, param & 0x3f) : 1
      const charges = value > 255 ? (value & 0xff) || ((value >> 8) & 0xff) : Math.max(1, value)
      props.push({ code: 'charged', param: skillId, min: charges, max: slvl, value: charges })
      continue
    }

    if (statId === 252) {
      const rate = value || param || 1
      props.push({ code: 'rep-dur', param: rate, min: rate, max: rate, value: rate })
      continue
    }

    const mappedCode = STAT_ID_TO_PROP_CODE[statId] ?? ISC_STAT_NAME_BY_ID.get(statId)
    if (mappedCode) {
      props.push({
        code: mappedCode,
        ...(param ? { param } : {}),
        min: value,
        max: value,
        value,
      })
    }
  }

  return { props, reqLevelBonus, socketsStat, curDurStat, maxDurStat, quantityStat }
}

function resolveOnlineRunewordDef(
  item: ItemData | Record<string, any>,
  socketChildren?: readonly (ItemData | Record<string, any>)[],
): RunewordDefinition | undefined {
  if (socketChildren && socketChildren.length > 0) {
    const childRuneCodes = socketChildren
      .map(c => String(c.code ?? '').trim().toLowerCase())
      .filter(c => isRuneCode(c))
    if (childRuneCodes.length > 0) {
      for (const rw of CANONICAL_RUNES_TABLE.complete) {
        if (
          rw.runes.length === childRuneCodes.length &&
          rw.runes.every((r, idx) => r.trim().toLowerCase() === childRuneCodes[idx])
        ) {
          return rw
        }
      }
    }
  }
  const rwData = item.runewordData
  if (typeof rwData === 'number' && rwData > 0) {
    const low12 = rwData & 0xfff
    return (
      CANONICAL_RUNES_TABLE.getById(rwData) ??
      (low12 > 27 ? CANONICAL_RUNES_TABLE.getById(low12 - 27) : undefined) ??
      (low12 > 26 ? CANONICAL_RUNES_TABLE.getById(low12 - 26) : undefined) ??
      CANONICAL_RUNES_TABLE.getById(low12) ??
      CANONICAL_RUNES_TABLE.all[rwData]
    )
  }
  return undefined
}

const RUNEWORD_DISPLAY_OVERRIDES_EN: Readonly<Record<string, string>> = {
  Runeword4: 'Beast',
  Runeword14: 'Chains of Honor',
  Runeword26: 'Doom',
  Runeword37: 'Exile',
  Runeword47: 'Grief',
  Runeword99: 'Voice of Reason',
}

const ONLINE_CHARM_CODES: ReadonlySet<string> = new Set([
  'cm1',
  'cm2',
  'cm3',
  'scha',
  'mcha',
  'lcha',
])

const ONLINE_SCROLL_OR_BOOK_CODES: ReadonlySet<string> = new Set([
  'isc',
  'tsc',
  'ibk',
  'tbk',
])

/**
 * Ground Truth (`D2Common.dll` `0x6fd7c0c0`, `0x6fd7a927`, `0x6fd5f7f0` & `0x6fd76190`):
 * Compact items (`IFLAG_COMPACT`) are always `ITEMQUAL_NORMAL` (`2`) and never carry magic affixes.
 * For scrolls and tomes (`tsc`, `isc`, `tbk`, `ibk`), `D2ItemDataStrc.wMagicSuffix[0]` is a reused
 * union slot storing the `Books.txt` spell row index (`0` = Town Portal, `1` = Identify), NOT a
 * `MagicSuffix.txt` ID. Magic affixes only apply to `ITEMQUAL_MAGIC` (`4`), Normal Charms (`quality === 2`
 * & `ITYPE_CHARM`), or synthetic test objects where `quality` is omitted.
 */
function hasOnlineMagicAffixes(
  item: ItemData | Record<string, any>,
  qualityStr: string,
  code: string,
  baseRow?: any,
): boolean {
  if (Boolean(item.compact || (item as any).simple)) return false
  const rawType = String(baseRow?.type ?? '').trim().toLowerCase()
  if (ONLINE_SCROLL_OR_BOOK_CODES.has(code) || rawType === 'scro' || rawType === 'book') {
    return false
  }
  if (qualityStr === 'magic') return true
  const rawQ = item.quality
  if (rawQ !== undefined && rawQ !== null && rawQ !== 4 && rawQ !== 'magic') {
    const isNormalCharm =
      (rawQ === 2 || rawQ === 'normal') &&
      (ONLINE_CHARM_CODES.has(code) || rawType === 'scha' || rawType === 'mcha' || rawType === 'lcha')
    if (!isNormalCharm) return false
  }
  return Boolean(
    item.magicPrefixId ||
      item.magicSuffixId ||
      (item as any).magicPrefix ||
      (item as any).magicSuffix ||
      (item as any).prefixIds?.length ||
      (item as any).suffixIds?.length,
  )
}

/**
 * Canonical 1.13c Online `ItemData` (`0x9C` / `0x9D`) to `UiInventoryItem` Bridge.
 *
 * Converts a decoded D2GS `ItemData` (plus optional socketed children and `DropTables`)
 * into a localized, tooltip-ready `UiInventoryItem` with base item names, quality titles,
 * combat stats (1H/2H damage, defense, durability, requirements), sockets, and formatted
 * 1.13c property lines in both Chinese (`stats`) and English (`statsEn`).
 */
export function onlineItemDataToUiInventoryItem(
  item: ItemData | Record<string, any>,
  socketChildren?: readonly (ItemData | Record<string, any>)[],
  dropTables?: DropTables,
  playerLevel?: number,
  equippedItems?: readonly (ItemData | Record<string, any>)[],
): UiInventoryItem & {
  readonly nameEn: string
  readonly baseName: string
  readonly usedSockets: number
  readonly variant?: number | undefined
  readonly graphicIndex?: number | undefined
  readonly damageRange?: { readonly min: number; readonly max: number } | undefined
  readonly twoHandDamage?: { readonly min: number; readonly max: number } | undefined
} {
  const tables = dropTables ?? getEmbeddedDropTables()
  const code = String(item.code ?? '').trim().toLowerCase()
  if (!code) {
    throw new Error('[item-bridge] Missing item code in onlineItemDataToUiInventoryItem (fail-fast, no silent fallback)')
  }

  const weaponRow = tables.weapons?.get(code)
  const armorRow = !weaponRow ? tables.armor?.get(code) : undefined
  const miscRow = !weaponRow && !armorRow ? tables.misc?.get(code) : undefined
  const baseRow: any = weaponRow ?? armorRow ?? miscRow ?? tables.getBase?.(code)

  const kind: 'weapon' | 'armor' | 'misc' = weaponRow
    ? 'weapon'
    : armorRow
      ? 'armor'
      : ((baseRow?.kind as 'weapon' | 'armor' | 'misc' | undefined) ?? 'misc')

  const baseNameEn = resolveBaseItemNameEn(baseRow?.name || code.toUpperCase(), code)
  const rawBaseZh = translateItemName(baseNameEn)
  const baseNameZh = rawBaseZh && rawBaseZh !== baseNameEn ? rawBaseZh : baseNameEn

  const isInShop =
    item.container === 'shop' ||
    Boolean((item as any).isShop) ||
    (item.container === undefined && (item as any).storePage !== undefined)
  const isGambleMystery =
    item.identified !== true &&
    (item.container === undefined || item.container === 'shop') &&
    Boolean(
      item.isGambleMystery ||
        item.flags?.gamble ||
        (isInShop && (item.identified === false || !item.identified)),
    )
  const isUnidentified = isGambleMystery || item.identified === false
  const isRuneword = Boolean(item.runeword || (item as any).isRuneword)
  const isEthereal = !isGambleMystery && Boolean(item.ethereal)

  const rawQ = item.quality
  let qualityStr: string = 'normal'
  if (rawQ === 1 || rawQ === 'low') qualityStr = 'low'
  else if (rawQ === 3 || rawQ === 'superior') qualityStr = 'superior'
  else if (rawQ === 4 || rawQ === 'magic') qualityStr = 'magic'
  else if (rawQ === 5 || rawQ === 'set') qualityStr = 'set'
  else if (rawQ === 6 || rawQ === 'rare') qualityStr = 'rare'
  else if (rawQ === 7 || rawQ === 'unique') qualityStr = 'unique'
  else if (rawQ === 8 || rawQ === 9 || rawQ === 'crafted' || rawQ === 'craft') qualityStr = 'craft'

  const rawCombinedStats: (ItemStat | Record<string, any>)[] = [
    ...(Array.isArray(item.stats) ? item.stats : []),
    ...(Array.isArray(item.runewordStats) ? item.runewordStats : []),
  ]
  let armorStatDefense: number | undefined
  let consumedArmorStat = false
  const combinedStats = rawCombinedStats.filter(s => {
    const sid = Number(s.statId ?? (s as any).id ?? -1)
    if (
      !consumedArmorStat &&
      kind === 'armor' &&
      sid === 31 &&
      (typeof item.defense !== 'number' || item.defense <= 0 || Number(s.value) === item.defense)
    ) {
      armorStatDefense = Number(s.value)
      consumedArmorStat = true
      return false
    }
    return true
  }) as ItemStat[]
  const converted = convertOnlineItemStatsToRolledProps(combinedStats)
  const rolledProps: RolledItemProp[] = [...converted.props]

  // Resolve quality-specific definitions when identified
  let uniqueItemDef: any
  let setItemDef: any
  let rolledMagicAffixes: any
  let rolledRareAffixes: any
  let runewordObj: { readonly key: string; readonly name: string; readonly levelreq?: number; readonly props?: readonly any[] } | undefined
  let itemDisplayNameEn = baseNameEn
  let extraReqLevel = 0

  if (!isUnidentified) {
    if (isRuneword) {
      const rwDef = resolveOnlineRunewordDef(item, socketChildren)
      if (rwDef) {
        const rwKey = rwDef.name
        const rwEn =
          RUNEWORD_DISPLAY_OVERRIDES_EN[rwKey] ??
          CANONICAL_ENG_TBL_DICT[rwKey] ??
          (rwDef.runeName || rwKey)
        itemDisplayNameEn = rwEn
        runewordObj = {
          key: rwKey,
          name: rwEn,
          props: rwDef.properties,
        }
        if (rolledProps.length === 0 && Array.isArray(rwDef.properties)) {
          for (const p of rwDef.properties) {
            if (p.code) {
              rolledProps.push({
                code: p.code,
                param: p.par,
                min: p.min,
                max: p.max,
                value: p.min,
              })
            }
          }
        }
      } else if ((item as any).runewordName) {
        const rwEn = String((item as any).runewordName)
        itemDisplayNameEn = rwEn
        runewordObj = { key: rwEn, name: rwEn }
      }
    } else if (qualityStr === 'unique') {
      const uid = item.uniqueItemId ?? (item as any).uniqueId
      let uidCandidate: any
      if (typeof uid === 'number' && tables.uniques) {
        uidCandidate =
          tables.uniques.getById?.(uid) ??
          (tables.uniques as any).byId?.get?.(uid) ??
          tables.uniques.all?.[uid]
        if (uidCandidate && (!code || uidCandidate.code?.trim().toLowerCase() === code)) {
          uniqueItemDef = uidCandidate
        }
      }
      if (!uniqueItemDef && tables.uniques) {
        const byCode = tables.uniques.getEnabledByCode?.(code)
        if (byCode && byCode.length > 0) {
          uniqueItemDef = byCode[0]
        }
      }
      if (!uniqueItemDef && uidCandidate) {
        uniqueItemDef = uidCandidate
      }
      if (uniqueItemDef) {
        const rawUniqueKey = (uniqueItemDef.index || baseNameEn).trim()
        itemDisplayNameEn = resolveBaseItemNameEn(rawUniqueKey, code) || rawUniqueKey
        if (uniqueItemDef.levelreq > 0) {
          extraReqLevel = Math.max(extraReqLevel, uniqueItemDef.levelreq)
        }
      }
    } else if (qualityStr === 'set') {
      const sid = item.setItemId ?? (item as any).setId
      let sidCandidate: any
      if (typeof sid === 'number' && tables.sets?.items) {
        sidCandidate =
          (tables.sets.items as any).byId?.get?.(sid) ??
          tables.sets.items.entries?.[sid]
        if (sidCandidate && (!code || sidCandidate.item?.trim().toLowerCase() === code)) {
          setItemDef = sidCandidate
        }
      }
      if (!setItemDef && typeof item.name === 'string' && item.name.trim().length > 0 && tables.sets?.items) {
        const targetSetItemName = item.name.trim().toLowerCase()
        setItemDef =
          tables.sets.items.getByIndex?.(item.name.trim()) ??
          tables.sets.items.entries?.find(
            (s: any) =>
              s.index?.trim().toLowerCase() === targetSetItemName ||
              resolveBaseItemNameEn(s.index ?? '').trim().toLowerCase() === targetSetItemName,
          )
      }
      if (!setItemDef && tables.sets?.items?.entries) {
        setItemDef = tables.sets.items.entries.find(
          (s: any) => s.item?.trim().toLowerCase() === code,
        )
      }
      if (!setItemDef && sidCandidate) {
        setItemDef = sidCandidate
      }
      if (setItemDef) {
        const rawSetKey = (setItemDef.index || baseNameEn).trim()
        itemDisplayNameEn = resolveBaseItemNameEn(rawSetKey) || rawSetKey
        if (setItemDef.levelreq > 0) {
          extraReqLevel = Math.max(extraReqLevel, setItemDef.levelreq)
        }
      }
    } else if (hasOnlineMagicAffixes(item, qualityStr, code, baseRow)) {
      const rawItemType = String(baseRow?.type ?? '').trim().toLowerCase()
      const effectiveItemClass = inferItemClassFromType(rawItemType, tables.isA)
      const rawPlayerClass = String((item as any).charClass ?? (item as any).playerClass ?? '').trim().toLowerCase()
      const getOnlineAffixReqLevel = (aff: any): number => {
        if (!aff) return 0
        const affClass = String(aff.class ?? '').trim().toLowerCase()
        const affClassLevelReq = aff.classlevelreq
        if (
          effectiveItemClass &&
          affClass &&
          affClass === effectiveItemClass &&
          (!rawPlayerClass || rawPlayerClass === affClass) &&
          typeof affClassLevelReq === 'number' &&
          affClassLevelReq > 0
        ) {
          return affClassLevelReq
        }
        return typeof aff.levelreq === 'number' ? aff.levelreq : 0
      }

      const preId =
        item.magicPrefixId ??
        (item as any).magicPrefix ??
        (Array.isArray((item as any).prefixIds) ? (item as any).prefixIds[0] : undefined)
      const sufId =
        item.magicSuffixId ??
        (item as any).magicSuffix ??
        (Array.isArray((item as any).suffixIds) ? (item as any).suffixIds[0] : undefined)
      const preEntry = lookupPacketAffix(tables.magicAffixes?.prefixes, preId)
      const sufEntry = lookupPacketAffix(tables.magicAffixes?.suffixes, sufId)
      const preReq = getOnlineAffixReqLevel(preEntry)
      const sufReq = getOnlineAffixReqLevel(sufEntry)
      if (preReq > 0) extraReqLevel = Math.max(extraReqLevel, preReq)
      if (sufReq > 0) extraReqLevel = Math.max(extraReqLevel, sufReq)
      if (typeof item.autoAffixId === 'number' && item.autoAffixId > 0) {
        const autoTable = tables.autoMagic ?? CANONICAL_AUTOMAGIC_TABLE
        const autoEntry =
          autoTable.entries[item.autoAffixId - 1] ??
          autoTable.entries.find(e => e.id === item.autoAffixId)
        const autoReq = getOnlineAffixReqLevel(autoEntry)
        if (autoReq > 0) {
          extraReqLevel = Math.max(extraReqLevel, autoReq)
        }
      }
      const parts = [preEntry?.name, baseNameEn, sufEntry?.name].filter(Boolean)
      const magicName = parts.join(' ') || baseNameEn
      const resolvedMagicEn = resolveMagicNameEn(magicName, baseNameEn, preEntry?.name, sufEntry?.name, code)
      itemDisplayNameEn = resolvedMagicEn
      rolledMagicAffixes = {
        name: resolvedMagicEn,
        prefix: preEntry ? { ...preEntry, affix: preEntry, mods: [] } : undefined,
        suffix: sufEntry ? { ...sufEntry, affix: sufEntry, mods: [] } : undefined,
        prefixes: preEntry ? [preEntry] : [],
        suffixes: sufEntry ? [sufEntry] : [],
        affixes: [preEntry, sufEntry].filter(Boolean),
      }
    } else if (qualityStr === 'rare' || qualityStr === 'craft') {
      const rawItemType = String(baseRow?.type ?? '').trim().toLowerCase()
      const effectiveItemClass = inferItemClassFromType(rawItemType, tables.isA)
      const rawPlayerClass = String((item as any).charClass ?? (item as any).playerClass ?? '').trim().toLowerCase()
      const getOnlineAffixReqLevel = (aff: any): number => {
        if (!aff) return 0
        const affClass = String(aff.class ?? '').trim().toLowerCase()
        const affClassLevelReq = aff.classlevelreq
        if (
          effectiveItemClass &&
          affClass &&
          affClass === effectiveItemClass &&
          (!rawPlayerClass || rawPlayerClass === affClass) &&
          typeof affClassLevelReq === 'number' &&
          affClassLevelReq > 0
        ) {
          return affClassLevelReq
        }
        return typeof aff.levelreq === 'number' ? aff.levelreq : 0
      }

      const n1 = item.rareName1 ?? (item as any).rareFirstName
      const n2 = item.rareName2 ?? (item as any).rareLastName
      const preTable = tables.rareNames?.prefixes
      const sufTable = tables.rareNames?.suffixes
      const sufCount = sufTable?.length ?? 155
      let preWord: string | undefined
      let sufWord: string | undefined
      if (typeof n1 === 'number' && n1 > 0 && preTable) {
        const entry =
          n1 > sufCount
            ? (preTable.byIndex(n1 - sufCount - 1) ?? preTable.byIndex(n1 - 1) ?? preTable.byIndex(n1))
            : (preTable.byIndex(n1 - 1) ?? preTable.byIndex(n1))
        preWord = entry?.name
      }
      if (typeof n2 === 'number' && n2 > 0 && sufTable) {
        const entry = sufTable.byIndex(n2 - 1) ?? sufTable.byIndex(n2)
        sufWord = entry?.name
      }
      const rareAffixEntries: any[] = []
      const rareSuffixes: any[] = []
      const rarePrefixes: any[] = []
      let craftAffixCount = 0
      if (Array.isArray(item.rareAffixes)) {
        for (let i = 0; i < item.rareAffixes.length; i++) {
          const aid = item.rareAffixes[i]
          if (typeof aid !== 'number' || aid <= 0) continue
          craftAffixCount++
          const isPrefixSlot = i % 2 === 0
          const aff = lookupPacketAffix(
            isPrefixSlot ? tables.magicAffixes?.prefixes : tables.magicAffixes?.suffixes,
            aid,
          )
          if (aff) {
            rareAffixEntries.push({ ...aff, affix: aff, mods: [] })
            if (isPrefixSlot) rarePrefixes.push(aff)
            else rareSuffixes.push(aff)
            const effReq = getOnlineAffixReqLevel(aff)
            if (effReq > 0) extraReqLevel = Math.max(extraReqLevel, effReq)
          }
        }
      }
      if ((qualityStr === 'rare' || qualityStr === 'craft') && typeof item.autoAffixId === 'number' && item.autoAffixId > 0) {
        const autoTable = tables.autoMagic ?? CANONICAL_AUTOMAGIC_TABLE
        const autoEntry =
          autoTable.entries[item.autoAffixId - 1] ??
          autoTable.entries.find(e => e.id === item.autoAffixId)
        const autoReq = getOnlineAffixReqLevel(autoEntry)
        if (autoReq > 0) {
          extraReqLevel = Math.max(extraReqLevel, autoReq)
        }
      }
      if (qualityStr === 'craft') {
        // D2Common.dll ITEMS_GetRequiredLevel (0x6fd7637f..0x6fd76478):
        // Crafted items add +10 + 3 * numAffixes to max(baseLevelReq, maxAffixLevelReq), capped at 98.
        const baseReqLvl = baseRow?.levelreq ?? baseRow?.reqLevel ?? 0
        extraReqLevel = Math.min(98, Math.max(baseReqLvl, extraReqLevel) + 10 + 3 * craftAffixCount)
      }
      const rawRareName = [preWord, sufWord].filter(Boolean).join(' ') || baseNameEn
      const resolvedEn = preWord || sufWord ? resolveRareNameEn(rawRareName, preWord, sufWord) : baseNameEn
      itemDisplayNameEn = resolvedEn
      rolledRareAffixes = {
        name: rawRareName,
        rarePrefix: preWord ? { name: preWord } : undefined,
        rareSuffix: sufWord ? { name: sufWord } : undefined,
        prefixes: rarePrefixes,
        suffixes: rareSuffixes,
        affixes: rareAffixEntries,
      }
    }

    // Ground Truth (D2Common.dll ITEMS_GetRequiredLevel 0x6fd76190 / 0x6fd76584..0x6fd766bd):
    // Apply skill reqlevel for STAT_ITEM_SINGLESKILL ('skill' / 'skill-rand', statId 107)
    // and STAT_ITEM_NONCLASSSKILL ('oskill', statId 97), plus STAT_ITEM_LEVELREQ (statId 92).
    const rawPlayerClass = String((item as any).charClass ?? (item as any).playerClass ?? '').trim().toLowerCase()
    for (const p of rolledProps) {
      const c = (p.code || '').trim().toLowerCase()
      if (c === 'skill') {
        const sk = resolveSkillMeta(p.param)
        if (sk && sk.reqlevel > 1) {
          extraReqLevel = Math.max(extraReqLevel, sk.reqlevel)
        }
      } else if (c === 'skill-rand') {
        const sk = resolveSkillMeta(p.min)
        if (sk && sk.reqlevel > 1) {
          extraReqLevel = Math.max(extraReqLevel, sk.reqlevel)
        }
      } else if (c === 'oskill') {
        const sk = resolveSkillMeta(p.param)
        if (sk && sk.reqlevel > 0) {
          const oskillReq =
            rawPlayerClass && sk.classCode && rawPlayerClass === sk.classCode.toLowerCase()
              ? sk.reqlevel
              : sk.reqlevel + 6
          if (oskillReq > 1) {
            extraReqLevel = Math.max(extraReqLevel, oskillReq)
          }
        }
      }
    }
    if (converted.reqLevelBonus !== 0) {
      const baseReqLvl = baseRow?.levelreq ?? baseRow?.reqLevel ?? 0
      extraReqLevel = Math.max(0, Math.max(baseReqLvl, extraReqLevel) + converted.reqLevelBonus)
    }
  }

  const isIndestructible = combinedStats.some(s => s.statId === 152 && s.value > 0)
  const maxDur =
    item.maxDurability ??
    converted.maxDurStat ??
    (baseRow?.nodurability || baseRow?.noDurability ? 0 : (baseRow?.durability ?? 0))
  const curDur =
    item.curDurability ??
    item.durability ??
    converted.curDurStat ??
    maxDur
  const hasDur =
    !isIndestructible &&
    kind !== 'misc' &&
    !baseRow?.nodurability &&
    !baseRow?.noDurability &&
    maxDur > 0

  const totalSockets =
    item.totalSockets ||
    (item as any).sockets ||
    converted.socketsStat ||
    (socketChildren ? socketChildren.length : 0) ||
    (item.socketed ? Math.max(1, item.usedSockets || item.socketedChildCount || 1) : 0)
  const usedSockets = socketChildren
    ? socketChildren.length
    : (item.usedSockets ?? item.socketedChildCount ?? 0)

  const quantity =
    item.quantity ??
    converted.quantityStat ??
    item.tomeData ??
    (item.goldAmount !== undefined ? item.goldAmount : undefined)

  const effectiveCharLevel =
    typeof playerLevel === 'number' && Number.isFinite(playerLevel) && playerLevel > 0
      ? Math.max(1, Math.trunc(playerLevel))
      : typeof (item as any).charLevel === 'number' &&
          Number.isFinite((item as any).charLevel) &&
          (item as any).charLevel > 0
        ? Math.max(1, Math.trunc((item as any).charLevel))
        : 1

  // Convert socketed children into domain Items for formatItemTooltip & itemToUiInventoryItem
  const childUiItems =
    socketChildren && socketChildren.length > 0
      ? socketChildren.map(ch =>
          onlineItemDataToUiInventoryItem(ch, undefined, tables, effectiveCharLevel),
        )
      : undefined
  const childDomainItems =
    childUiItems && childUiItems.length > 0
      ? childUiItems.map(u => u.rawItem!).filter(Boolean)
      : undefined

  // Base defense: if item.defense or armorStatDefense is explicitly provided on ItemData, use it as base defense
  // (in 1.13c bitstream, item.defense already includes ethereal 1.5x if item is ethereal, whereas
  // if item.defense is omitted we use baseRow.maxac || baseRow.minac).
  const explicitDefense =
    typeof item.defense === 'number' && item.defense > 0 ? item.defense : armorStatDefense
  const hasExplicitDefense = typeof explicitDefense === 'number' && explicitDefense > 0
  const rawBaseAc = hasExplicitDefense
    ? (isEthereal ? Math.max(1, Math.ceil(explicitDefense / 1.5)) : explicitDefense)
    : (baseRow?.maxac ?? baseRow?.minac ?? baseRow?.defense ?? 0)

  const baseObj: ItemBase & Record<string, any> = {
    id: code,
    code,
    name: baseNameEn,
    kind,
    type: baseRow?.type,
    type2: baseRow?.type2,
    tags: baseRow?.tags ?? (baseRow?.type ? [baseRow.type] : []),
    invWidth: Math.max(1, item.invWidth || baseRow?.invWidth || baseRow?.invwidth || 1),
    invHeight: Math.max(1, item.invHeight || baseRow?.invHeight || baseRow?.invheight || 1),
    maxStack: baseRow?.maxStack || baseRow?.maxstack || 1,
    value: baseRow?.value || baseRow?.cost || 0,
    damage: baseRow?.maxdam || baseRow?.damage || 0,
    mindam: baseRow?.mindam || 0,
    maxdam: baseRow?.maxdam || 0,
    twoHandedMindam: baseRow?.twoHandedMindam ?? baseRow?.['2handmindam'] ?? 0,
    twoHandedMaxdam: baseRow?.twoHandedMaxdam ?? baseRow?.['2handmaxdam'] ?? 0,
    minMisDam: baseRow?.minMisDam ?? baseRow?.minmisdam ?? 0,
    maxMisDam: baseRow?.maxMisDam ?? baseRow?.maxmisdam ?? 0,
    defense: rawBaseAc,
    durability: hasDur ? maxDur : 0,
    nodurability: !hasDur,
    reqstr: baseRow?.reqstr ?? baseRow?.reqStr ?? 0,
    reqdex: baseRow?.reqdex ?? baseRow?.reqDex ?? 0,
    levelreq: baseRow?.levelreq ?? baseRow?.reqLevel ?? 0,
    level: baseRow?.level ?? 1,
    invfile: baseRow?.invfile ?? baseRow?.invFile,
    uniqueinvfile: baseRow?.uniqueinvfile,
    setinvfile: baseRow?.setinvfile,
    flippyfile: uniqueItemDef?.flippyfile ?? setItemDef?.flippyfile ?? baseRow?.flippyfile,
    dropsound: baseRow?.dropsound,
    dropsfxframe: baseRow?.dropsfxframe,
    twoHanded: Boolean(baseRow?.twoHanded || baseRow?.twohanded === '1' || baseRow?.['2handed'] === 1),
    oneOrTwoHanded: Boolean(baseRow?.oneOrTwoHanded || baseRow?.['1or2handed'] === '1' || baseRow?.['1or2handed'] === 1),
  }

  const itemVariant =
    typeof (item as any).variant === 'number' && Number.isFinite((item as any).variant) && (item as any).variant >= 0
      ? Math.trunc((item as any).variant)
      : typeof (item as any).graphicIndex === 'number' && Number.isFinite((item as any).graphicIndex) && (item as any).graphicIndex >= 0
        ? Math.trunc((item as any).graphicIndex)
        : undefined

  let equippedSetIds: number[] | undefined
  let wornSetPieceCount: number | undefined
  let activeItemSetProps: RolledItemProp[] | undefined

  if (!isUnidentified && qualityStr === 'set' && setItemDef) {
    const memberItems = tables.sets?.items?.getBySet?.(setItemDef.set) ?? []
    const isItemBroken = (it: ItemData | Record<string, any> | null | undefined): boolean => {
      if (!it || typeof it !== 'object') return false
      if (Boolean((it as any).broken) || Boolean((it as any).flags?.broken)) return true
      const statsArr = Array.isArray((it as any).stats) ? (it as any).stats : undefined
      const stat72 = statsArr?.find((s: any) => s && s.statId === 72)
      const stat73 = statsArr?.find((s: any) => s && s.statId === 73)
      const curDur = (it as any).durability ?? (it as any).curDurability ?? stat72?.value
      const maxDur = (it as any).maxDurability ?? stat73?.value ?? 0
      return curDur === 0 && Number(maxDur) > 0
    }
    const isEquippedEntryActive = (eq: ItemData | Record<string, any>): boolean => {
      if (!eq || isItemBroken(eq)) return false
      if (eq.bodyLoc !== undefined || (eq as any).equippedSlot !== undefined) {
        const bloc = Number(eq.bodyLoc ?? (eq as any).equippedSlot ?? 0)
        return bloc >= 1 && bloc <= 10
      }
      if ((eq as any).equipped !== undefined) {
        return Boolean((eq as any).equipped)
      }
      if (eq.container !== undefined || eq.location !== undefined) {
        return (
          eq.container === 'equipped' ||
          eq.container === 'equipment' ||
          eq.location === 'equipped' ||
          eq.location === 'equipment' ||
          (eq.location as any) === 1
        )
      }
      return true
    }
    const isSelfItemEquipped = (it: ItemData | Record<string, any>): boolean => {
      if (!it || isItemBroken(it)) return false
      if (it.bodyLoc !== undefined || (it as any).equippedSlot !== undefined) {
        const bloc = Number(it.bodyLoc ?? (it as any).equippedSlot ?? 0)
        return bloc >= 1 && bloc <= 10
      }
      if ((it as any).equipped !== undefined) {
        return Boolean((it as any).equipped)
      }
      return false
    }
    const resolveEquipSetDef = (it: ItemData | Record<string, any>): any => {
      const q = it.quality
      if (q !== 5 && q !== 'set' && it.setItemId === undefined && (it as any).setId === undefined) return undefined
      const itCode = String(it.code ?? '').trim().toLowerCase()
      const sid = it.setItemId ?? (it as any).setId
      let sidFound: any
      if (typeof sid === 'number' && tables.sets?.items) {
        sidFound = (tables.sets.items as any).byId?.get?.(sid) ?? tables.sets.items.entries?.[sid]
        if (sidFound && (!itCode || sidFound.item?.trim().toLowerCase() === itCode)) return sidFound
      }
      if (typeof it.name === 'string' && it.name.trim().length > 0) {
        const itNameLower = it.name.trim().toLowerCase()
        const byMemberName = memberItems.find(
          (m: any) =>
            m.index?.trim().toLowerCase() === itNameLower ||
            resolveBaseItemNameEn(m.index ?? '').trim().toLowerCase() === itNameLower,
        )
        if (byMemberName) return byMemberName
        const byTableName =
          tables.sets?.items?.getByIndex?.(it.name.trim()) ??
          tables.sets?.items?.entries?.find(
            (s: any) =>
              s.index?.trim().toLowerCase() === itNameLower ||
              resolveBaseItemNameEn(s.index ?? '').trim().toLowerCase() === itNameLower,
          )
        if (byTableName) return byTableName
      }
      if (itCode && memberItems.length > 0) {
        const byCode = memberItems.find((m: any) => m.item?.trim().toLowerCase() === itCode)
        if (byCode) return byCode
      }
      return sidFound
    }

    const candidateEquipped: (ItemData | Record<string, any>)[] = []
    if (Array.isArray(equippedItems)) {
      for (const eq of equippedItems) {
        if (eq && isEquippedEntryActive(eq)) {
          candidateEquipped.push(eq)
        }
      }
    }
    if (isSelfItemEquipped(item)) {
      const itemUid = item.id ?? item.itemId
      const alreadyIncluded = candidateEquipped.some(eq => {
        const eqUid = eq.id ?? eq.itemId
        return itemUid !== undefined && eqUid !== undefined ? eqUid === itemUid : eq === item
      })
      if (!alreadyIncluded) {
        candidateEquipped.push(item)
      }
    }

    let setMask = 0
    const wornIds = new Set<number>()
    for (const eq of candidateEquipped) {
      const eqSetDef = resolveEquipSetDef(eq)
      if (!eqSetDef || eqSetDef.set.trim().toLowerCase() !== setItemDef.set.trim().toLowerCase()) continue
      wornIds.add(eqSetDef.id)
      const pos = memberItems.findIndex((m: any) => m.id === eqSetDef.id)
      if (pos >= 0) {
        setMask |= 1 << pos
      }
    }
    equippedSetIds = [...wornIds]
    let maskCount = 0
    for (let m = setMask; m !== 0; m &= m - 1) maskCount++
    wornSetPieceCount = maskCount

    const myPos = Math.max(
      0,
      memberItems.findIndex((m: any) => m.id === setItemDef.id),
    )

    // Decode item-specific set bonus lists (item.setBonusStats) per SetItems.txt addFunc (0x6FDA4380)
    const rawSetBonusLists = Array.isArray((item as any).setBonusStats)
      ? ((item as any).setBonusStats as readonly { readonly index: number; readonly stats: readonly ItemStat[] }[])
      : undefined
    if (rawSetBonusLists && rawSetBonusLists.length > 0) {
      activeItemSetProps = []
      for (const list of rawSetBonusLists) {
        const k = Number(list.index)
        if (!Number.isInteger(k) || k < 0 || k >= 5 || !Array.isArray(list.stats) || list.stats.length === 0) {
          continue
        }
        const convList = convertOnlineItemStatsToRolledProps(list.stats)
        if (setItemDef.addFunc === 0) {
          rolledProps.push(...convList.props)
        } else if (setItemDef.addFunc === 1) {
          const partnerPos = k < myPos ? k : k + 1
          if ((setMask & (1 << partnerPos)) !== 0) {
            activeItemSetProps.push(...convList.props)
          }
        } else if (setItemDef.addFunc === 2) {
          if (maskCount >= k + 2) {
            activeItemSetProps.push(...convList.props)
          }
        }
      }
    } else if (Array.isArray(setItemDef.aprops) && setItemDef.aprops.length > 0) {
      activeItemSetProps = []
      for (const ap of setItemDef.aprops) {
        if (!ap.code || ap.code.trim().toLowerCase() === 'state') continue
        const k = ap.threshold - 1
        if (k < 0 || k >= 5) continue
        if (setItemDef.addFunc === 0) {
          if (!rolledProps.some(p => p.code === ap.code)) {
            rolledProps.push({
              code: ap.code,
              param: ap.par,
              min: ap.min,
              max: ap.max,
              value: ap.min,
            })
          }
        } else if (setItemDef.addFunc === 1) {
          const partnerPos = k < myPos ? k : k + 1
          if ((setMask & (1 << partnerPos)) !== 0) {
            activeItemSetProps.push({
              code: ap.code,
              param: ap.par,
              min: ap.min,
              max: ap.max,
              value: ap.min,
            })
          }
        } else if (setItemDef.addFunc === 2) {
          if (maskCount >= k + 2) {
            activeItemSetProps.push({
              code: ap.code,
              param: ap.par,
              min: ap.min,
              max: ap.max,
              value: ap.min,
            })
          }
        }
      }
    }
  }

  const syntheticItem = {
    id: String(item.id ?? item.itemId ?? `item-${code}-${++itemBridgeSeqCounter}`),
    code,
    name: isUnidentified ? baseNameEn : itemDisplayNameEn,
    base: baseObj,
    prefix: [],
    suffix: [],
    invWidth: baseObj.invWidth,
    invHeight: baseObj.invHeight,
    value: baseObj.value || 1,
    quality:
      isGambleMystery
        ? ItemQuality.NORMAL
        : qualityStr === 'low'
          ? ItemQuality.LOW
          : qualityStr === 'superior'
            ? ItemQuality.SUPERIOR
            : qualityStr === 'magic'
              ? ItemQuality.MAGIC
              : qualityStr === 'set'
                ? ItemQuality.SET
                : qualityStr === 'rare'
                  ? ItemQuality.RARE
                  : qualityStr === 'unique'
                    ? ItemQuality.UNIQUE
                    : qualityStr === 'craft'
                      ? ItemQuality.CRAFTED
                      : ItemQuality.NORMAL,
    rarity: isGambleMystery ? 'normal' : isRuneword && !isUnidentified ? 'runeword' : qualityStr,
    level: item.ilvl ?? baseObj.level ?? 1,
    ilvl: item.ilvl ?? baseObj.level ?? 1,
    charLevel: effectiveCharLevel,
    identified: !isUnidentified,
    ethereal: isEthereal,
    flags: {
      identified: !isUnidentified,
      ethereal: isEthereal,
      socketed: Boolean(item.socketed || totalSockets > 0),
      runeword: isRuneword,
      ...(isGambleMystery ? { gamble: true } : {}),
      ...(item.simple ? { simple: true } : {}),
    },
    ...(isGambleMystery ? { isGambleMystery: true } : {}),
    ...(itemVariant !== undefined ? { variant: itemVariant, graphicIndex: itemVariant } : {}),
    ...(hasDur ? { durability: curDur, maxDurability: maxDur } : {}),
    ...(totalSockets > 0 ? { sockets: totalSockets, totalSockets, socketedCount: usedSockets } : {}),
    ...(childDomainItems ? { socketedItems: childDomainItems } : {}),
    ...(uniqueItemDef ? { uniqueItemDef } : {}),
    ...(setItemDef ? { setItemDef } : {}),
    ...(equippedSetIds !== undefined ? { equippedSetIds } : {}),
    ...(wornSetPieceCount !== undefined ? { wornSetPieceCount } : {}),
    ...(activeItemSetProps !== undefined ? { activeItemSetProps } : {}),
    ...(rolledMagicAffixes ? { rolledMagicAffixes } : {}),
    ...(rolledRareAffixes ? { rolledRareAffixes } : {}),
    ...(runewordObj ? { runeword: runewordObj, runewordName: runewordObj.name } : {}),
    ...(extraReqLevel > 1 ? { reqLevel: extraReqLevel } : {}),
    ...(typeof item.autoAffixId === 'number' ? { autoAffixId: item.autoAffixId } : {}),
    ...(rolledMagicAffixes && typeof item.magicPrefixId === 'number' ? { magicPrefixId: item.magicPrefixId } : {}),
    ...(rolledMagicAffixes && typeof item.magicSuffixId === 'number' ? { magicSuffixId: item.magicSuffixId } : {}),
    ...(quantity !== undefined ? { quantity, stack: quantity } : {}),
    rolledProps: isUnidentified ? [] : rolledProps,
    stats: item.goldAmount !== undefined ? { amount: item.goldAmount } : {},
    ...((item as any).buyCost !== undefined ? { buyCost: (item as any).buyCost } : {}),
    ...((item as any).sellCost !== undefined ? { sellCost: (item as any).sellCost } : {}),
  } as unknown as Item & Record<string, any>

  const uiItem = itemToUiInventoryItem(syntheticItem, tables)

  let finalNameEn = isUnidentified ? baseNameEn : uiItem.name
  let finalNameZh = isUnidentified ? baseNameZh : uiItem.nameZh

  if (code === 'gld') {
    const goldAmt =
      item.goldAmount ??
      quantity ??
      combinedStats.find(s => s.statId === 14)?.value
    if (typeof goldAmt === 'number' && goldAmt > 0) {
      finalNameEn = `${goldAmt} Gold`
      finalNameZh = `${goldAmt} 金币`
    }
  }

  if (item.personalized && item.personalizedName) {
    finalNameEn = `${item.personalizedName}'s ${finalNameEn}`
    finalNameZh = `${item.personalizedName}的${finalNameZh}`
  }

  const dmgText = uiItem.damageEn ?? uiItem.damage
  let damageRange: { min: number; max: number } | undefined
  let parsedTwoHandDamage: { min: number; max: number } | undefined
  if (dmgText) {
    const matches = [...dmgText.matchAll(/(\d+)\s*(?:-|to)\s*(\d+)/gi)]
    if (matches.length >= 2) {
      damageRange = { min: Number(matches[0]![1]), max: Number(matches[0]![2]) }
      parsedTwoHandDamage = { min: Number(matches[1]![1]), max: Number(matches[1]![2]) }
    } else if (matches.length === 1) {
      const parsed = { min: Number(matches[0]![1]), max: Number(matches[0]![2]) }
      if (/two-hand|双手/i.test(dmgText)) {
        parsedTwoHandDamage = parsed
      }
      damageRange = parsed
    }
  }
  const twoHandDamage = uiItem.twoHandDamage ?? parsedTwoHandDamage

  const hasSocketAcBonus =
    Boolean(childDomainItems && childDomainItems.length > 0) &&
    typeof uiItem.defense === 'number' &&
    hasExplicitDefense &&
    uiItem.defense > explicitDefense
  const hasAcBonus =
    hasSocketAcBonus ||
    rolledProps.some(
      p => p.code === 'ac' || p.code === 'ac%' || p.code === 'ac/lvl' || p.code === 'ac%/lvl',
    ) ||
    (activeItemSetProps ?? []).some(
      p => p.code === 'ac' || p.code === 'ac%' || p.code === 'ac/lvl' || p.code === 'ac%/lvl',
    )
  const finalDefense =
    kind === 'armor' && hasExplicitDefense && !hasAcBonus ? explicitDefense : uiItem.defense

  return {
    ...uiItem,
    id: String(item.id ?? item.itemId ?? uiItem.id),
    name: finalNameEn,
    nameEn: finalNameEn,
    nameZh: finalNameZh,
    baseName: baseNameEn,
    baseNameZh,
    baseNameEn,
    usedSockets: isGambleMystery ? 0 : usedSockets,
    ...(isGambleMystery ? { isGambleMystery: true, quality: 'normal' as const } : {}),
    ...(itemVariant !== undefined ? { variant: itemVariant, graphicIndex: itemVariant } : {}),
    ...(!isGambleMystery && finalDefense !== undefined ? { defense: finalDefense } : {}),
    ...(!isGambleMystery && totalSockets > 0 ? { sockets: totalSockets } : {}),
    ...(!isGambleMystery && childUiItems
      ? { socketedItems: childUiItems, socketedGems: childUiItems.map(c => c.code) }
      : {}),
    affixes: (uiItem.statsEn ?? uiItem.stats).map(s => s.text),
    ...(!isGambleMystery && damageRange !== undefined ? { damageRange } : {}),
    ...(!isGambleMystery && twoHandDamage !== undefined ? { twoHandDamage } : {}),
    ...((item as any).buyCost !== undefined ? { buyCost: (item as any).buyCost } : {}),
    ...((item as any).sellCost !== undefined ? { sellCost: (item as any).sellCost } : {}),
  }
}

export const itemDataToUiInventoryItem = onlineItemDataToUiInventoryItem

/**
 * Ground Truth (`D2Common.dll` 1.13c `ITEMS_GetRequiredLevel` #11015 @ `0x6fd76190`, wrapper @ `0x6fd76da0`):
 * Computes the effective required character level (`reqLevel`) for an online `ItemData` (`0x9C`/`0x9D`)
 * or domain `Item` without allocating full tooltip structures:
 * - Unidentified items only require their base `levelreq` (affix/unique/set level requirements are ignored
 *   until identified; for charms, `ITEMS_IsCharmUsable` @ `0x6fd77090` additionally gates on `IFLAG_IDENTIFIED`).
 * - Identified items take the maximum of base `levelreq`, magic/rare/craft/automagic affix `levelreq`
 *   (or `classlevelreq` when applicable), `UniqueItems.txt` / `SetItems.txt` `levelreq`, skill modifiers
 *   (`statId 107` single skill, `statId 97` oskill), and socketed child items, then add `statId 92` (`item_levelreq`).
 */
export function resolveOnlineItemReqLevel(
  item: ItemData | Record<string, any> | null | undefined,
  socketChildren?: readonly (ItemData | Record<string, any>)[],
  dropTables?: DropTables,
  playerClass?: CharacterClassCode | string | null,
): number {
  if (!item || typeof item !== 'object') return 0

  const explicitReq =
    typeof (item as any).reqLevel === 'number' && Number.isFinite((item as any).reqLevel)
      ? Math.max(0, Math.trunc((item as any).reqLevel))
      : 0

  const code = String(item.code ?? (item as any).base?.code ?? (item as any).base?.id ?? '')
    .trim()
    .toLowerCase()
  if (!code) return explicitReq

  const tables = dropTables ?? getEmbeddedDropTables()
  const baseRow: any =
    tables.weapons?.get(code) ??
    tables.armor?.get(code) ??
    tables.misc?.get(code) ??
    tables.getBase?.(code) ??
    (item as any).base
  const baseReqLevel = Math.max(0, Number(baseRow?.levelreq ?? baseRow?.reqLevel ?? 0) || 0)

  const isInShop =
    item.container === 'shop' ||
    Boolean((item as any).isShop) ||
    (item.container === undefined && (item as any).storePage !== undefined)
  const isGambleMystery =
    item.identified !== true &&
    (item.container === undefined || item.container === 'shop') &&
    Boolean(
      item.isGambleMystery ||
        item.flags?.gamble ||
        (isInShop && (item.identified === false || !item.identified)),
    )
  const isUnidentified =
    isGambleMystery ||
    item.identified === false ||
    Boolean(item.flags && typeof (item.flags as any).identified === 'boolean' && (item.flags as any).identified === false)

  if (isUnidentified) {
    return isGambleMystery ? 0 : Math.max(explicitReq, baseReqLevel)
  }

  let extraReqLevel = 0
  const rawQ = item.quality
  let qualityStr = 'normal'
  if (rawQ === 1 || rawQ === 'low') qualityStr = 'low'
  else if (rawQ === 3 || rawQ === 'superior') qualityStr = 'superior'
  else if (rawQ === 4 || rawQ === 'magic') qualityStr = 'magic'
  else if (rawQ === 5 || rawQ === 'set') qualityStr = 'set'
  else if (rawQ === 6 || rawQ === 'rare') qualityStr = 'rare'
  else if (rawQ === 7 || rawQ === 'unique') qualityStr = 'unique'
  else if (rawQ === 8 || rawQ === 9 || rawQ === 'crafted' || rawQ === 'craft') qualityStr = 'craft'

  const rawItemType = String(baseRow?.type ?? '').trim().toLowerCase()
  const effectiveItemClass = rawItemType ? inferItemClassFromType(rawItemType, tables.isA) : undefined
  const rawPlayerClass = String(playerClass ?? (item as any).charClass ?? (item as any).playerClass ?? '')
    .trim()
    .toLowerCase()

  const getAffixReqLevel = (aff: any): number => {
    if (!aff) return 0
    const affClass = String(aff.class ?? '').trim().toLowerCase()
    const affClassLevelReq = aff.classlevelreq
    if (
      effectiveItemClass &&
      affClass &&
      affClass === effectiveItemClass &&
      (!rawPlayerClass || rawPlayerClass === affClass) &&
      typeof affClassLevelReq === 'number' &&
      affClassLevelReq > 0
    ) {
      return affClassLevelReq
    }
    return typeof aff.levelreq === 'number' ? aff.levelreq : 0
  }

  if (qualityStr === 'unique') {
    let uniqueItemDef = (item as any).uniqueItemDef
    const uid = item.uniqueItemId ?? (item as any).uniqueId
    if (!uniqueItemDef && typeof uid === 'number' && tables.uniques) {
      uniqueItemDef = (tables.uniques as any).byId?.get?.(uid) ?? tables.uniques.all?.[uid]
    }
    if (!uniqueItemDef && tables.uniques) {
      const byCode = tables.uniques.getEnabledByCode?.(code)
      if (byCode && byCode.length > 0) {
        uniqueItemDef = byCode[0]
      }
    }
    if (uniqueItemDef?.levelreq > 0) {
      extraReqLevel = Math.max(extraReqLevel, uniqueItemDef.levelreq)
    }
  } else if (qualityStr === 'set') {
    let setItemDef = (item as any).setItemDef
    const sid = item.setItemId ?? (item as any).setId
    let sidCandidate: any
    if (!setItemDef && typeof sid === 'number' && tables.sets?.items) {
      sidCandidate =
        (tables.sets.items as any).byId?.get?.(sid) ?? tables.sets.items.entries?.[sid]
      if (sidCandidate && (!code || sidCandidate.item?.trim().toLowerCase() === code)) {
        setItemDef = sidCandidate
      }
    }
    if (!setItemDef && tables.sets?.items?.entries) {
      setItemDef = tables.sets.items.entries.find(
        (s: any) => s.item?.trim().toLowerCase() === code,
      )
    }
    if (!setItemDef && sidCandidate) {
      setItemDef = sidCandidate
    }
    if (setItemDef?.levelreq > 0) {
      extraReqLevel = Math.max(extraReqLevel, setItemDef.levelreq)
    }
  } else if (qualityStr === 'rare' || qualityStr === 'craft') {
    let craftAffixCount = 0
    if (Array.isArray(item.rareAffixes)) {
      for (let i = 0; i < item.rareAffixes.length; i++) {
        const aid = item.rareAffixes[i]
        if (typeof aid !== 'number' || aid <= 0) continue
        craftAffixCount++
        const isPrefixSlot = i % 2 === 0
        const aff = lookupPacketAffix(
          isPrefixSlot ? tables.magicAffixes?.prefixes : tables.magicAffixes?.suffixes,
          aid,
        )
        const effReq = getAffixReqLevel(aff)
        if (effReq > 0) extraReqLevel = Math.max(extraReqLevel, effReq)
      }
    }
    if (Array.isArray((item as any).rolledRareAffixes?.affixes)) {
      for (const aff of (item as any).rolledRareAffixes.affixes) {
        const effReq = getAffixReqLevel(aff?.affix ?? aff)
        if (effReq > 0) extraReqLevel = Math.max(extraReqLevel, effReq)
      }
    }
    if (typeof item.autoAffixId === 'number' && item.autoAffixId > 0) {
      const autoTable = tables.autoMagic ?? CANONICAL_AUTOMAGIC_TABLE
      const autoEntry =
        autoTable.entries[item.autoAffixId - 1] ??
        autoTable.entries.find(e => e.id === item.autoAffixId)
      const autoReq = getAffixReqLevel(autoEntry)
      if (autoReq > 0) extraReqLevel = Math.max(extraReqLevel, autoReq)
    }
    if (qualityStr === 'craft') {
      extraReqLevel = Math.min(98, Math.max(baseReqLevel, extraReqLevel) + 10 + 3 * craftAffixCount)
    }
  } else if (hasOnlineMagicAffixes(item, qualityStr, code, baseRow)) {
    const preId =
      item.magicPrefixId ??
      (item as any).magicPrefix ??
      (Array.isArray((item as any).prefixIds) ? (item as any).prefixIds[0] : undefined)
    const sufId =
      item.magicSuffixId ??
      (item as any).magicSuffix ??
      (Array.isArray((item as any).suffixIds) ? (item as any).suffixIds[0] : undefined)
    const preEntry = lookupPacketAffix(tables.magicAffixes?.prefixes, preId)
    const sufEntry = lookupPacketAffix(tables.magicAffixes?.suffixes, sufId)
    const preReq = getAffixReqLevel(preEntry)
    const sufReq = getAffixReqLevel(sufEntry)
    if (preReq > 0) extraReqLevel = Math.max(extraReqLevel, preReq)
    if (sufReq > 0) extraReqLevel = Math.max(extraReqLevel, sufReq)
    if (Array.isArray((item as any).rolledMagicAffixes?.affixes)) {
      for (const aff of (item as any).rolledMagicAffixes.affixes) {
        const effReq = getAffixReqLevel(aff?.affix ?? aff)
        if (effReq > 0) extraReqLevel = Math.max(extraReqLevel, effReq)
      }
    }
    if (typeof item.autoAffixId === 'number' && item.autoAffixId > 0) {
      const autoTable = tables.autoMagic ?? CANONICAL_AUTOMAGIC_TABLE
      const autoEntry =
        autoTable.entries[item.autoAffixId - 1] ??
        autoTable.entries.find(e => e.id === item.autoAffixId)
      const autoReq = getAffixReqLevel(autoEntry)
      if (autoReq > 0) extraReqLevel = Math.max(extraReqLevel, autoReq)
    }
  } else if (typeof item.autoAffixId === 'number' && item.autoAffixId > 0) {
    const autoTable = tables.autoMagic ?? CANONICAL_AUTOMAGIC_TABLE
    const autoEntry =
      autoTable.entries[item.autoAffixId - 1] ??
      autoTable.entries.find(e => e.id === item.autoAffixId)
    const autoReq = getAffixReqLevel(autoEntry)
    if (autoReq > 0) extraReqLevel = Math.max(extraReqLevel, autoReq)
  }

  let reqLevelBonus = 0
  const rawStats: readonly (ItemStat | Record<string, any>)[] = [
    ...(Array.isArray(item.stats) ? item.stats : []),
    ...(Array.isArray(item.runewordStats) ? item.runewordStats : []),
  ]
  for (const st of rawStats) {
    if (!st || typeof st !== 'object') continue
    const statId = Number(st.statId ?? (st as any).id ?? -1)
    const param = Number(st.param ?? 0)
    const value = Number(st.value ?? 0)
    if (statId === 92) {
      reqLevelBonus = Math.max(reqLevelBonus, value)
    } else if (statId === 107) {
      const sk = resolveSkillMeta(param)
      if (sk && sk.reqlevel > 1) {
        extraReqLevel = Math.max(extraReqLevel, sk.reqlevel)
      }
    } else if (statId === 97) {
      const sk = resolveSkillMeta(param)
      if (sk && sk.reqlevel > 0) {
        const oskillReq =
          rawPlayerClass && sk.classCode && rawPlayerClass === sk.classCode.toLowerCase()
            ? sk.reqlevel
            : sk.reqlevel + 6
        if (oskillReq > 1) {
          extraReqLevel = Math.max(extraReqLevel, oskillReq)
        }
      }
    }
  }

  const children =
    socketChildren ??
    (Array.isArray((item as any).socketedItems) ? (item as any).socketedItems : undefined)
  if (Array.isArray(children) && children.length > 0) {
    for (const child of children) {
      const childReq = resolveOnlineItemReqLevel(child, undefined, tables, rawPlayerClass)
      if (childReq > 0) {
        extraReqLevel = Math.max(extraReqLevel, childReq)
      }
    }
  }

  let finalReq = Math.max(baseReqLevel, extraReqLevel)
  if (reqLevelBonus !== 0) {
    finalReq = Math.max(0, finalReq + reqLevelBonus)
  }
  return Math.max(explicitReq, finalReq)
}

const PROP_CODE_TO_STAT_ID: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>()
  for (const [sidStr, propCode] of Object.entries(STAT_ID_TO_PROP_CODE)) {
    const sid = Number(sidStr)
    const key = propCode.trim().toLowerCase()
    if (!m.has(key)) {
      m.set(key, sid)
    }
  }
  m.set('hp', 6)
  m.set('mana', 8)
  m.set('stam', 10)
  m.set('dmg%', 17)
  m.set('dmg-min', 21)
  m.set('dmg-max', 22)
  m.set('dmg-mag', 52)
  m.set('swing1', 93)
  m.set('swing2', 93)
  m.set('swing3', 93)
  m.set('cast1', 105)
  m.set('cast2', 105)
  m.set('cast3', 105)
  m.set('balance1', 99)
  m.set('balance2', 99)
  m.set('balance3', 99)
  m.set('move1', 96)
  m.set('move2', 96)
  m.set('move3', 96)
  m.set('block1', 102)
  m.set('block2', 102)
  m.set('block3', 102)
  m.set('sock', 194)
  return m
})()

const CLASS_SKILL_PROP_INDEX: Readonly<Record<string, number>> = {
  ama: 0,
  sor: 1,
  nec: 2,
  pal: 3,
  bar: 4,
  dru: 5,
  ass: 6,
}

/**
 * Converts `RolledItemProp[]` into canonical `ItemStat[]` entries (`statId`, `param`, `value`)
 * so that online `ItemData` and `onlineItemDataToUiInventoryItem` preserve all rolled Rare stats.
 */
export function rolledPropsToItemStats(props: readonly RolledItemProp[] | undefined): ItemStat[] {
  if (!props || props.length === 0) return []
  const out: ItemStat[] = []
  for (const p of props) {
    if (!p || !p.code) continue
    const code = p.code.trim().toLowerCase()
    const val = Number(p.value ?? p.min ?? 0)
    const min = Number(p.min ?? val)
    const max = Number(p.max ?? val)
    const rawParam = p.param !== undefined ? Number(p.param) : undefined

    if (code === 'res-all') {
      out.push({ statId: 39, value: val })
      out.push({ statId: 41, value: val })
      out.push({ statId: 43, value: val })
      out.push({ statId: 45, value: val })
      continue
    }
    if (code in CLASS_SKILL_PROP_INDEX) {
      out.push({ statId: 83, param: CLASS_SKILL_PROP_INDEX[code]!, value: val })
      continue
    }
    if (code === 'skilltab') {
      if (rawParam === undefined) throw new Error('rolledPropsToItemStats: skilltab prop without param')
      out.push({ statId: 188, param: encodeSkillTabParam(rawParam), value: val })
      continue
    }
    if (code === 'dmg-fire') {
      out.push({ statId: 48, value: min })
      out.push({ statId: 49, value: Math.max(min, max) })
      continue
    }
    if (code === 'dmg-ltng') {
      out.push({ statId: 50, value: min })
      out.push({ statId: 51, value: Math.max(min, max) })
      continue
    }
    if (code === 'dmg-mag') {
      out.push({ statId: 52, value: min })
      out.push({ statId: 53, value: Math.max(min, max) })
      continue
    }
    if (code === 'dmg-cold') {
      out.push({ statId: 54, value: min })
      out.push({ statId: 55, value: Math.max(min, max) })
      out.push({ statId: 56, value: rawParam && Number.isFinite(rawParam) ? rawParam : 25 })
      continue
    }
    if (code === 'dmg-pois') {
      out.push({ statId: 57, value: min })
      out.push({ statId: 58, value: Math.max(min, max) })
      out.push({ statId: 59, value: rawParam && Number.isFinite(rawParam) ? rawParam : 50 })
      continue
    }
    if (code === 'dmg-norm') {
      out.push({ statId: 21, value: min })
      out.push({ statId: 22, value: Math.max(min, max) })
      continue
    }
    if (code === 'charged') {
      const skillId = rawParam && Number.isFinite(rawParam) ? Math.max(0, Math.trunc(rawParam)) : 0
      const slvl = Math.max(1, Math.trunc(max || 1))
      const charges = Math.max(1, Math.trunc(min || val || 1))
      out.push({
        statId: 204,
        param: (skillId << 6) | (slvl & 0x3f),
        value: charges,
      })
      continue
    }
    if (
      code === 'att-skill' ||
      code === 'kill-skill' ||
      code === 'death-skill' ||
      code === 'hit-skill' ||
      code === 'levelup-skill' ||
      code === 'gethit-skill'
    ) {
      const sid = PROP_CODE_TO_STAT_ID.get(code)!
      const skillId = rawParam && Number.isFinite(rawParam) ? Math.max(0, Math.trunc(rawParam)) : 0
      const slvl = Math.max(1, Math.trunc(max || 1))
      const chance = Math.max(1, Math.trunc(min || val || 5))
      out.push({
        statId: sid,
        param: (skillId << 6) | (slvl & 0x3f),
        value: chance,
      })
      continue
    }

    const sid = PROP_CODE_TO_STAT_ID.get(code)
    if (sid !== undefined) {
      const isPerLvlStat = sid >= 214 && sid <= 250
      const effVal =
        isPerLvlStat && val === 0 && rawParam !== undefined && Number.isFinite(rawParam)
          ? rawParam
          : val
      out.push({
        statId: sid,
        ...(!isPerLvlStat && rawParam !== undefined && Number.isFinite(rawParam) ? { param: rawParam } : {}),
        value: effVal,
      })
    }
  }
  return out
}

/**
 * Imbues an online/world `ItemData` record in-place/immutably using 1.13c Charsi Imbue rules
 * (`D2Game.dll` `QUESTS_Act1Q5_ImbueItem` @ `0x6fce0310`).
 */
export function imbueItemData113c<T extends ItemData = ItemData>(
  itemData: T,
  playerLevel: number,
  optionsOrSeed?: CharsiImbueOptions | number,
): T {
  const options: CharsiImbueOptions | undefined =
    typeof optionsOrSeed === 'number' ? { seed: optionsOrSeed } : optionsOrSeed
  const rolled = imbueItem113c(itemData, playerLevel, options)
  const itemStats = rolledPropsToItemStats(rolled.rolledProps)
  const wasEthereal = Boolean(
    itemData.ethereal ||
      (itemData as any).flags?.ethereal ||
      (typeof itemData.rawFlags === 'number' && (itemData.rawFlags & 0x400000) !== 0),
  )
  const wasPersonalized = Boolean(
    itemData.personalized ||
      (itemData as any).flags?.personalized ||
      (typeof itemData.rawFlags === 'number' && (itemData.rawFlags & 0x01000000) !== 0),
  )
  const personalizedName =
    typeof itemData.personalizedName === 'string' ? itemData.personalizedName : undefined
  const totalSockets = rolled.sockets ?? rolled.totalSockets ?? 0
  const numericContainer = typeof itemData.container === 'number'
  const numericFlags = typeof itemData.flags === 'number'
  const nextRawFlags =
    (((typeof itemData.rawFlags === 'number' ? itemData.rawFlags : 0x10) & ~0x200000) |
      0x10 |
      (wasEthereal ? 0x400000 : 0) |
      (wasPersonalized ? 0x01000000 : 0)) >>>
    0

  return {
    ...itemData,
    code: (rolled.code ?? itemData.code).trim(),
    name: rolled.name,
    nameZh: rolled.nameZh,
    quality: 6,
    rarity: 'rare',
    level: rolled.ilvl ?? computeCharsiImbueIlvl(playerLevel),
    ilvl: rolled.ilvl ?? computeCharsiImbueIlvl(playerLevel),
    compact: false,
    simple: false,
    simpleItem: false,
    identified: true,
    ethereal: wasEthereal,
    socketed: totalSockets > 0,
    sockets: totalSockets,
    totalSockets,
    usedSockets: 0,
    rareName1: rolled.rareName1,
    rareName2: rolled.rareName2,
    rareFirstName: rolled.rareName1,
    rareLastName: rolled.rareName2,
    rareAffixes: rolled.rareAffixIds ? [...rolled.rareAffixIds] : [],
    ...(rolled.autoAffixId !== undefined ? { autoAffixId: rolled.autoAffixId } : {}),
    ...(rolled.durability !== undefined ? { durability: rolled.durability, curDurability: rolled.durability } : {}),
    ...(rolled.maxDurability !== undefined ? { maxDurability: rolled.maxDurability } : {}),
    stats: itemStats,
    rolledProps: rolled.rolledProps ? [...rolled.rolledProps] : [],
    rolledRareAffixes: (rolled as any).rolledRareAffixes,
    location: 4,
    destination: 1,
    container: (numericContainer ? 0 : 'cursor') as any,
    ...(wasPersonalized ? { personalized: true } : {}),
    ...(personalizedName ? { personalizedName } : {}),
    rawFlags: nextRawFlags,
    flags: (numericFlags
      ? (((itemData.flags as unknown as number) & ~0x200000) |
          0x10 |
          (wasEthereal ? 0x400000 : 0) |
          (wasPersonalized ? 0x1000000 : 0))
      : {
          ...(typeof itemData.flags === 'object' && itemData.flags ? itemData.flags : {}),
          compact: false,
          simple: false,
          identified: true,
          ethereal: wasEthereal,
          socketed: totalSockets > 0,
          personalized: wasPersonalized,
        }) as any,
  } as unknown as T
}

/**
 * Imbues a `UiInventoryItem` into a newly rolled 1.13c Rare `UiInventoryItem`,
 * preserving its `id`, `ethereal`, and `personalized` / `personalizedName` attributes.
 */
export function imbueUiInventoryItem113c(
  uiItem: UiInventoryItem,
  playerLevel: number,
  optionsOrSeed?: CharsiImbueOptions | number,
): UiInventoryItem {
  const options: CharsiImbueOptions | undefined =
    typeof optionsOrSeed === 'number' ? { seed: optionsOrSeed } : optionsOrSeed
  const rawItemAny = (uiItem.rawItem ?? {}) as Record<string, any>
  const source: Record<string, any> = {
    ...rawItemAny,
    id: uiItem.id,
    code: uiItem.code ?? rawItemAny.code,
    quality: uiItem.quality ?? rawItemAny.quality ?? 'normal',
    identified: uiItem.identified ?? rawItemAny.identified ?? true,
    ethereal: Boolean(uiItem.ethereal || rawItemAny.ethereal),
    sockets: uiItem.sockets ?? rawItemAny.sockets ?? 0,
    personalized: Boolean((uiItem as any).personalized || rawItemAny.personalized),
    personalizedName: (uiItem as any).personalizedName ?? rawItemAny.personalizedName,
  }
  const imbuedDomain = imbueItem113c(source, playerLevel, options)
  const imbuedUi = itemToUiInventoryItem(imbuedDomain as unknown as Item, options?.dropTables)
  return {
    ...imbuedUi,
    id: uiItem.id,
    identified: true,
    ...(source.ethereal ? { ethereal: true } : {}),
    ...(source.personalized ? { personalized: true } : {}),
    ...(source.personalizedName ? { personalizedName: source.personalizedName } : {}),
  } as UiInventoryItem
}

export {
  computeCharsiImbueIlvl,
  isEligibleForCharsiImbue113c,
  imbueItem113c,
  type CharsiImbueOptions,
}
