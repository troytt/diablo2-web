/**
 * 1:1 port of the 1.13c item creation path used by `D2GAME_EquipMonsterItem` (`D2Game.dll` `0x6FCCFCE0`)
 * for `MonEquip.txt` items (Valkyrie and friends) on the DRLG oracle path:
 *
 *   `0x6FCCFCE0` -> `ITEMS_CreateItemForOwner` `0x6FC31980` (stack `D2ItemDropStrc`, flags `0xA`)
 *   -> `ITEMS_CreateItem` `0x6FC31490` (`SUNIT_AllocUnitData` 2 game-seed draws, `#10377` ilvl, `#10503` version)
 *   -> `ITEMS_InitItemStats` `0x6FC31070` (base stats on the UNIT seed `pItem+0x20`)
 *   -> `ITEMS_ResolveSpecialQuality` `0x6FC30A20` (quality dispatch; affixes on the ITEM-DATA seed `pItemData+0x04`)
 *      - rare `0x6FC30BDE` -> `0x6FC354F0` -> `ITEMS_RollRareAffixes` `0x6FC35240`
 *        (`0x6FC34210` rare names, `ITEMS_RollAffix` `0x6FC344D0`, `D2Common #10996` properties)
 *      - magic `0x6FC30CE1` -> `ITEMS_RollMagicAffixes` `0x6FC303C0`
 *
 * Pseudocode, RNG tables and record offsets: `kb/items/d2game-monster-item-create-113c.md`.
 *
 * Only the branches reached by weapon/armor bases with forced quality magic (4) or rare (6) in an
 * expansion game are ported; every other branch throws {@link MonsterItemNotPortedError113c}.
 */

import {
  RAW_ARMOR,
  RAW_ITEM_TYPES,
  RAW_MAGIC_PREFIX,
  RAW_MAGIC_SUFFIX,
  RAW_RARE_PREFIX,
  RAW_RARE_SUFFIX,
  RAW_WEAPONS,
} from '../../common/data/canonical-drop-data.ts'
import { RAW_ITEM_STAT_COST, RAW_PROPERTIES } from '../../common/data/canonical-vendor-data.ts'
import { D2SEED_AdvanceInline, type D2SeedStrc } from '../../common/rng/d2-rng.ts'

/** A branch of the item creation path that has no 1:1 port yet. */
export class MonsterItemNotPortedError113c extends Error {
  constructor(branch: string) {
    super(`monster item creation branch not ported: ${branch}`)
    this.name = 'MonsterItemNotPortedError113c'
  }
}

// ---------------------------------------------------------------------------------------------
// Seed helpers (D2Game.dll inline LCG steps)
// ---------------------------------------------------------------------------------------------

/** One inline `D2SeedStrc` step returning the new low word (`lo * 0x6AC690C5 + hi`, e.g. `0x6FC352C6`). */
function stepLow(seed: D2SeedStrc): number {
  D2SEED_AdvanceInline(seed)
  return seed.lo >>> 0
}

/**
 * `D2Game 0x6FC21180` / `0x6FC211D0` / `D2Common 0x6FD51180` bounded draw: `n <= 0` returns 0 without a
 * draw; power-of-two `n` masks `lo & (n - 1)`, otherwise `lo % n` (both equal `lo % n` for `uint32`).
 */
function rollLimited(seed: D2SeedStrc, n: number): number {
  if (n <= 0) return 0
  return stepLow(seed) % n
}

/** `D2Common 0x6FD51180` / `0x6FD965B0`: `min == max` -> `min` (no draw), else `min + rollLimited(max - min + 1)`. */
function rollMinMax(seed: D2SeedStrc, a: number, b: number): number {
  if (a === b) return a
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return lo + rollLimited(seed, hi - lo + 1)
}

// ---------------------------------------------------------------------------------------------
// Tables (txt columns -> the compiled record fields read by the code, see kb section 2)
// ---------------------------------------------------------------------------------------------

interface Tsv {
  readonly col: (name: string) => number
  readonly rows: readonly string[][]
}

function parseTsv(raw: string, file: string): Tsv {
  const lines = raw.split(/\r?\n/)
  const header = lines[0]!.split('\t')
  const rows: string[][] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    if (line.length === 0) continue
    rows.push(line.split('\t'))
  }
  return {
    rows,
    col: (name: string) => {
      const idx = header.indexOf(name)
      if (idx < 0) throw new Error(`${file}: no column '${name}'`)
      return idx
    },
  }
}

/** Empty txt cell -> 0 (the txt compiler's default for numeric columns); anything else must be an integer. */
function intCell(row: readonly string[], idx: number, what: string): number {
  const s = (row[idx] ?? '').trim()
  if (s === '') return 0
  const n = Number(s)
  if (!Number.isInteger(n)) throw new Error(`${what}: '${s}' is not an integer`)
  return n
}

interface ItemTypeRec113c {
  readonly id: number
  readonly code: string
  readonly equiv: readonly string[]
  /** `+0x10` Throwable (`0x6FD74C30`). */
  readonly throwable: number
  /** `+0x14` Magic (`#10710`). */
  readonly magic: number
  /** `+0x15` Rare (`#11036`). */
  readonly rare: number
  /** `+0x16` Normal (`#10556`). */
  readonly normal: number
  /** `+0x1A..0x1C` MaxSock1 / MaxSock25 / MaxSock40 (`0x6FD74610`). */
  readonly maxSock: readonly [number, number, number]
  /** `+0x1F` StaffMods class (`#10957`); blank = 7 (none). */
  readonly staffMods: string
  /** `+0x21` Class (`#10822`); blank = 7 (none). */
  readonly classCode: string
  /** `+0x23` VarInvGfx (`#10208`). */
  readonly varInvGfx: number
}

export interface ItemBaseRec113c {
  readonly code: string
  readonly kind: 'weapon' | 'armor'
  readonly type: string
  readonly type2: string
  /** `ItemsTxt+0x112` (byte). */
  readonly durability: number
  /** `ItemsTxt+0xCC` / `+0xD0`. */
  readonly minac: number
  readonly maxac: number
  /** `ItemsTxt+0x111` (byte): armor `block`. */
  readonly block: number
  /** `ItemsTxt+0xD8`: `speed`. */
  readonly speed: number
  /** `ItemsTxt+0xFD` (`#10395`): `level` (qlvl). */
  readonly level: number
  /** `ItemsTxt+0x140`: `magic lvl`. */
  readonly magicLvl: number
  /** `ItemsTxt+0xF8`: `auto prefix`. */
  readonly autoPrefix: number
  readonly stackable: number
  readonly gemsockets: number
  /** `ItemsTxt+0x129` (`#10119`): `unique`. */
  readonly unique: number
  /** Weapon damage bytes read by `0x6FC2E860` (`+0xFE`/`+0xFF`/`+0x102`/`+0x103`/`+0x100`/`+0x101`). */
  readonly mindam: number
  readonly maxdam: number
  readonly twoHandMindam: number
  readonly twoHandMaxdam: number
  readonly minmisdam: number
  readonly maxmisdam: number
}

interface PropertySub113c {
  readonly set: number
  readonly val: number
  readonly func: number
  /** ItemStatCost id, -1 when blank. */
  readonly stat: number
}

interface MagicAffixRec113c {
  /** Index in the compiled table (MagicSuffix rows first, then MagicPrefix: `#10492` `+0x08` / `+0x0C`). */
  readonly index: number
  readonly name: string
  readonly version: number
  readonly spawnable: number
  readonly rare: number
  readonly level: number
  readonly maxlevel: number
  /** `classspecific` code; '' = 0xFF. */
  readonly classSpecific: string
  readonly frequency: number
  readonly group: number
  /** `pProperties[3]` at `+0x24` (prop index -1 = end). */
  readonly mods: readonly { readonly prop: number; readonly param: number; readonly min: number; readonly max: number }[]
  readonly itypes: readonly number[]
  readonly etypes: readonly number[]
}

interface RareAffixRec113c {
  readonly index: number
  readonly name: string
  readonly version: number
  readonly itypes: readonly number[]
  readonly etypes: readonly number[]
}

interface Tables113c {
  readonly itemTypes: readonly ItemTypeRec113c[]
  readonly itemTypeByCode: ReadonlyMap<string, ItemTypeRec113c>
  /** Transitive Equiv1/Equiv2 closure (the bitmask `D2Common 0x6FD74430` tests), type id -> ancestor ids. */
  readonly ancestors: readonly ReadonlySet<number>[]
  readonly items: ReadonlyMap<string, ItemBaseRec113c>
  readonly magic: readonly MagicAffixRec113c[]
  readonly magicSuffixRange: readonly [number, number]
  readonly magicPrefixRange: readonly [number, number]
  readonly rare: readonly RareAffixRec113c[]
  readonly rareSuffixRange: readonly [number, number]
  readonly rarePrefixRange: readonly [number, number]
  readonly properties: readonly (readonly PropertySub113c[])[]
  readonly propertyByCode: ReadonlyMap<string, number>
  readonly statValShift: readonly number[]
  readonly statNameById: readonly string[]
}

let tablesCache: Tables113c | undefined

function typeIdOf(byCode: ReadonlyMap<string, ItemTypeRec113c>, code: string, what: string): number {
  if (code === '') return 0
  const t = byCode.get(code)
  if (t === undefined) throw new Error(`${what}: unknown ItemTypes code '${code}'`)
  return t.id
}

/**
 * Affix `itype`/`etype` link: blank -> 0; a code that is not in ItemTypes.txt (1.13c MagicPrefix rows
 * use `staff` for `staf`) fails the txt compiler's link lookup and is stored as -1. The readers
 * (`0x6FD95F30`/`0x6FD95F54`, `0x6FD95DF2`/`0x6FD95E16`) stop at the first word `<= 0`, so both
 * values end the list.
 */
function affixTypeIdOf(byCode: ReadonlyMap<string, ItemTypeRec113c>, code: string): number {
  if (code === '') return 0
  return byCode.get(code)?.id ?? -1
}

function loadTables(): Tables113c {
  if (tablesCache !== undefined) return tablesCache

  const it = parseTsv(RAW_ITEM_TYPES, 'ItemTypes.txt')
  const itemTypes: ItemTypeRec113c[] = it.rows.map((r, id) => ({
    id,
    code: (r[it.col('Code')] ?? '').trim(),
    equiv: [(r[it.col('Equiv1')] ?? '').trim(), (r[it.col('Equiv2')] ?? '').trim()].filter((c) => c !== ''),
    throwable: intCell(r, it.col('Throwable'), 'ItemTypes.Throwable'),
    magic: intCell(r, it.col('Magic'), 'ItemTypes.Magic'),
    rare: intCell(r, it.col('Rare'), 'ItemTypes.Rare'),
    normal: intCell(r, it.col('Normal'), 'ItemTypes.Normal'),
    maxSock: [
      intCell(r, it.col('MaxSock1'), 'ItemTypes.MaxSock1'),
      intCell(r, it.col('MaxSock25'), 'ItemTypes.MaxSock25'),
      intCell(r, it.col('MaxSock40'), 'ItemTypes.MaxSock40'),
    ],
    staffMods: (r[it.col('StaffMods')] ?? '').trim(),
    classCode: (r[it.col('Class')] ?? '').trim(),
    varInvGfx: intCell(r, it.col('VarInvGfx'), 'ItemTypes.VarInvGfx'),
  }))
  const itemTypeByCode = new Map<string, ItemTypeRec113c>()
  for (const t of itemTypes) if (t.code !== '' && !itemTypeByCode.has(t.code)) itemTypeByCode.set(t.code, t)
  const ancestors: Set<number>[] = itemTypes.map((t) => {
    const out = new Set<number>([t.id])
    const stack = [...t.equiv]
    while (stack.length > 0) {
      const c = stack.pop()!
      const e = itemTypeByCode.get(c)
      if (e === undefined) throw new Error(`ItemTypes.txt: '${t.code}' Equiv '${c}' unknown`)
      if (out.has(e.id)) continue
      out.add(e.id)
      stack.push(...e.equiv)
    }
    return out
  })

  const items = new Map<string, ItemBaseRec113c>()
  const w = parseTsv(RAW_WEAPONS, 'Weapons.txt')
  for (const r of w.rows) {
    const code = (r[w.col('code')] ?? '').trim()
    if (code === '') continue
    items.set(code, {
      code,
      kind: 'weapon',
      type: (r[w.col('type')] ?? '').trim(),
      type2: (r[w.col('type2')] ?? '').trim(),
      durability: intCell(r, w.col('durability'), `Weapons.${code}.durability`),
      minac: 0,
      maxac: 0,
      block: 0,
      speed: intCell(r, w.col('speed'), `Weapons.${code}.speed`),
      level: intCell(r, w.col('level'), `Weapons.${code}.level`),
      magicLvl: intCell(r, w.col('magic lvl'), `Weapons.${code}.magic lvl`),
      autoPrefix: intCell(r, w.col('auto prefix'), `Weapons.${code}.auto prefix`),
      stackable: intCell(r, w.col('stackable'), `Weapons.${code}.stackable`),
      gemsockets: intCell(r, w.col('gemsockets'), `Weapons.${code}.gemsockets`),
      unique: intCell(r, w.col('unique'), `Weapons.${code}.unique`),
      mindam: intCell(r, w.col('mindam'), `Weapons.${code}.mindam`),
      maxdam: intCell(r, w.col('maxdam'), `Weapons.${code}.maxdam`),
      twoHandMindam: intCell(r, w.col('2handmindam'), `Weapons.${code}.2handmindam`),
      twoHandMaxdam: intCell(r, w.col('2handmaxdam'), `Weapons.${code}.2handmaxdam`),
      minmisdam: intCell(r, w.col('minmisdam'), `Weapons.${code}.minmisdam`),
      maxmisdam: intCell(r, w.col('maxmisdam'), `Weapons.${code}.maxmisdam`),
    })
  }
  const a = parseTsv(RAW_ARMOR, 'Armor.txt')
  for (const r of a.rows) {
    const code = (r[a.col('code')] ?? '').trim()
    if (code === '') continue
    items.set(code, {
      code,
      kind: 'armor',
      type: (r[a.col('type')] ?? '').trim(),
      type2: (r[a.col('type2')] ?? '').trim(),
      durability: intCell(r, a.col('durability'), `Armor.${code}.durability`),
      minac: intCell(r, a.col('minac'), `Armor.${code}.minac`),
      maxac: intCell(r, a.col('maxac'), `Armor.${code}.maxac`),
      block: intCell(r, a.col('block'), `Armor.${code}.block`),
      speed: intCell(r, a.col('speed'), `Armor.${code}.speed`),
      level: intCell(r, a.col('level'), `Armor.${code}.level`),
      magicLvl: intCell(r, a.col('magic lvl'), `Armor.${code}.magic lvl`),
      autoPrefix: intCell(r, a.col('auto prefix'), `Armor.${code}.auto prefix`),
      stackable: intCell(r, a.col('stackable'), `Armor.${code}.stackable`),
      gemsockets: intCell(r, a.col('gemsockets'), `Armor.${code}.gemsockets`),
      unique: intCell(r, a.col('unique'), `Armor.${code}.unique`),
      mindam: 0,
      maxdam: 0,
      twoHandMindam: 0,
      twoHandMaxdam: 0,
      minmisdam: 0,
      maxmisdam: 0,
    })
  }

  const isc = parseTsv(RAW_ITEM_STAT_COST, 'ItemStatCost.txt')
  const statIdByName = new Map<string, number>()
  const statValShift: number[] = []
  const statNameById: string[] = []
  for (const r of isc.rows) {
    const name = (r[isc.col('Stat')] ?? '').trim()
    if (name === '') continue
    const id = intCell(r, isc.col('ID'), `ItemStatCost.${name}.ID`)
    statIdByName.set(name, id)
    statValShift[id] = intCell(r, isc.col('ValShift'), `ItemStatCost.${name}.ValShift`)
    statNameById[id] = name
  }

  const pr = parseTsv(RAW_PROPERTIES, 'Properties.txt')
  const properties: PropertySub113c[][] = []
  const propertyByCode = new Map<string, number>()
  for (const r of pr.rows) {
    const code = (r[pr.col('code')] ?? '').trim()
    const subs: PropertySub113c[] = []
    for (let i = 1; i <= 7; i++) {
      const statName = (r[pr.col(`stat${i}`)] ?? '').trim()
      let stat = -1
      if (statName !== '') {
        const sid = statIdByName.get(statName)
        if (sid === undefined) throw new Error(`Properties.${code}.stat${i}: unknown stat '${statName}'`)
        stat = sid
      }
      subs.push({
        set: intCell(r, pr.col(`set${i}`), `Properties.${code}.set${i}`),
        val: intCell(r, pr.col(`val${i}`), `Properties.${code}.val${i}`),
        func: intCell(r, pr.col(`func${i}`), `Properties.${code}.func${i}`),
        stat,
      })
    }
    if (code !== '' && !propertyByCode.has(code)) propertyByCode.set(code, properties.length)
    properties.push(subs)
  }

  const magic: MagicAffixRec113c[] = []
  const loadMagic = (raw: string, file: string, etypeCount: number): void => {
    const t = parseTsv(raw, file)
    for (const r of t.rows) {
      const name = (r[t.col('Name')] ?? '').trim()
      const mods: MagicAffixRec113c['mods'][number][] = []
      for (let m = 1; m <= 3; m++) {
        const code = (r[t.col(`mod${m}code`)] ?? '').trim()
        let prop = -1
        if (code !== '') {
          const pi = propertyByCode.get(code)
          if (pi === undefined) throw new Error(`${file}.${name}.mod${m}code: unknown property '${code}'`)
          prop = pi
        }
        mods.push({
          prop,
          param: intCell(r, t.col(`mod${m}param`), `${file}.${name}.mod${m}param`),
          min: intCell(r, t.col(`mod${m}min`), `${file}.${name}.mod${m}min`),
          max: intCell(r, t.col(`mod${m}max`), `${file}.${name}.mod${m}max`),
        })
      }
      const itypes: number[] = []
      for (let i = 1; i <= 7; i++) itypes.push(affixTypeIdOf(itemTypeByCode, (r[t.col(`itype${i}`)] ?? '').trim()))
      const etypes: number[] = []
      for (let i = 1; i <= 5; i++) {
        etypes.push(i <= etypeCount ? affixTypeIdOf(itemTypeByCode, (r[t.col(`etype${i}`)] ?? '').trim()) : 0)
      }
      magic.push({
        index: magic.length,
        name,
        version: intCell(r, t.col('version'), `${file}.${name}.version`),
        spawnable: intCell(r, t.col('spawnable'), `${file}.${name}.spawnable`),
        rare: intCell(r, t.col('rare'), `${file}.${name}.rare`),
        level: intCell(r, t.col('level'), `${file}.${name}.level`),
        maxlevel: intCell(r, t.col('maxlevel'), `${file}.${name}.maxlevel`),
        classSpecific: (r[t.col('classspecific')] ?? '').trim(),
        frequency: intCell(r, t.col('frequency'), `${file}.${name}.frequency`),
        group: intCell(r, t.col('group'), `${file}.${name}.group`),
        mods,
        itypes,
        etypes,
      })
    }
  }
  loadMagic(RAW_MAGIC_SUFFIX, 'MagicSuffix.txt', 3)
  const nSuffix = magic.length
  loadMagic(RAW_MAGIC_PREFIX, 'MagicPrefix.txt', 5)

  const rare: RareAffixRec113c[] = []
  const loadRare = (raw: string, file: string): void => {
    const t = parseTsv(raw, file)
    for (const r of t.rows) {
      const name = (r[t.col('name')] ?? '').trim()
      const itypes: number[] = []
      for (let i = 1; i <= 7; i++) itypes.push(affixTypeIdOf(itemTypeByCode, (r[t.col(`itype${i}`)] ?? '').trim()))
      const etypes: number[] = []
      for (let i = 1; i <= 4; i++) etypes.push(affixTypeIdOf(itemTypeByCode, (r[t.col(`etype${i}`)] ?? '').trim()))
      rare.push({ index: rare.length, name, version: intCell(r, t.col('version'), `${file}.${name}.version`), itypes, etypes })
    }
  }
  loadRare(RAW_RARE_SUFFIX, 'RareSuffix.txt')
  const nRareSuffix = rare.length
  loadRare(RAW_RARE_PREFIX, 'RarePrefix.txt')

  tablesCache = {
    itemTypes,
    itemTypeByCode,
    ancestors,
    items,
    magic,
    magicSuffixRange: [0, nSuffix],
    magicPrefixRange: [nSuffix, magic.length],
    rare,
    rareSuffixRange: [0, nRareSuffix],
    rarePrefixRange: [nRareSuffix, rare.length],
    properties,
    propertyByCode,
    statValShift,
    statNameById,
  }
  return tablesCache
}

// ---------------------------------------------------------------------------------------------
// The item under construction (`D2UnitStrc` + `D2ItemDataStrc` fields the port reads/writes)
// ---------------------------------------------------------------------------------------------

/** Item version (`#10503`, `pGame+0x78`): `bExpansion ? 101 : 2` (`0x6FC4C3F8..0x6FC4C40F`). */
export const ITEM_VERSION_EXPANSION_113C = 101

export interface MonsterItemStat113c {
  readonly stat: number
  readonly name: string
  readonly layer: number
  /** Stored value (already `<< ValShift`, as `STATLIST_AddStat` receives it at `0x6FD97664`). */
  readonly value: number
}

export interface CreatedMonsterItem113c {
  readonly code: string
  readonly quality: number
  readonly ilvl: number
  /** `pItemData+0x32` / `+0x34` rare name ids (1-based compiled index, 0 = none). */
  readonly rarePrefix: number
  readonly rareSuffix: number
  /** `pItemData+0x38` (prefix slots, `#10312`) / `+0x3E` (suffix slots, `#10525`), 1-based compiled index. */
  readonly prefixes: readonly number[]
  readonly suffixes: readonly number[]
  readonly prefixNames: readonly string[]
  readonly suffixNames: readonly string[]
  /** Item stat list in insertion order (base stats from `0x6FC31070` + affix properties). */
  readonly stats: readonly MonsterItemStat113c[]
}

interface ItemUnit {
  readonly base: ItemBaseRec113c
  readonly typeId: number
  readonly type2Id: number
  readonly version: number
  readonly ilvl: number
  quality: number
  readonly unitSeed: D2SeedStrc
  readonly itemSeed: D2SeedStrc
  rarePrefix: number
  rareSuffix: number
  readonly prefixes: number[]
  readonly suffixes: number[]
  readonly stats: MonsterItemStat113c[]
}

function setStat(item: ItemUnit, stat: number, value: number, layer = 0): void {
  const t = loadTables()
  const name = t.statNameById[stat]
  if (name === undefined) throw new Error(`setStat: unknown stat ${stat}`)
  const idx = item.stats.findIndex((s) => s.stat === stat && s.layer === layer)
  const rec = { stat, name, layer, value }
  if (idx >= 0) item.stats[idx] = rec
  else item.stats.push(rec)
}

function addStat(item: ItemUnit, stat: number, value: number, layer: number): void {
  const t = loadTables()
  const name = t.statNameById[stat]
  if (name === undefined) throw new Error(`addStat: unknown stat ${stat}`)
  const idx = item.stats.findIndex((s) => s.stat === stat && s.layer === layer)
  if (idx >= 0) item.stats[idx] = { stat, name, layer, value: item.stats[idx]!.value + value }
  else item.stats.push({ stat, name, layer, value })
}

/** `D2Common 0x6FD74430` (`#10744`): `type[0]` or `type[1]` is `typeId` or descends from it. */
function itemIsOfType(item: ItemUnit, typeId: number): boolean {
  const t = loadTables()
  if (typeId <= 0) return false
  if (t.ancestors[item.typeId]!.has(typeId)) return true
  return item.type2Id > 0 && t.ancestors[item.type2Id]!.has(typeId)
}

function itemTypeRec(item: ItemUnit): ItemTypeRec113c {
  return loadTables().itemTypes[item.typeId]!
}

// ---------------------------------------------------------------------------------------------
// 0x6FC31070 ITEMS_InitItemStats (weapon / armor bases)
// ---------------------------------------------------------------------------------------------

const STAT_TOBLOCK = 20
const STAT_ARMORCLASS = 31
const STAT_MINDAMAGE = 21
const STAT_MAXDAMAGE = 22
const STAT_SECONDARY_MINDAMAGE = 23
const STAT_SECONDARY_MAXDAMAGE = 24
const STAT_ARMOR_SPEED = 67
const STAT_WEAPON_SPEED = 68
const STAT_DURABILITY = 72
const STAT_MAXDURABILITY = 73
const STAT_ITEM_THROW_MINDAMAGE = 159
const STAT_ITEM_THROW_MAXDAMAGE = 160

const ITEMTYPE_GOLD = 4
const ITEMTYPE_WEAPON = 45
const ITEMTYPE_ARMOR = 50
const ITEMTYPE_JEWEL = 58

/** Durability roll `0x6FC311D2..0x6FC31217` / `0x6FC312A2..0x6FC312E7` on the unit seed. */
function rollDurability(item: ItemUnit): void {
  const dur = item.base.durability & 0xff
  const half = dur >>> 1
  let cur = rollLimited(item.unitSeed, half) + half
  if (cur >= 0xff) cur = 0xff
  setStat(item, STAT_DURABILITY, cur)
  setStat(item, STAT_MAXDURABILITY, dur >= 0xff ? 0xff : dur)
}

function initItemStats(item: ItemUnit): void {
  if (item.typeId === ITEMTYPE_GOLD) throw new MonsterItemNotPortedError113c('0x6FC31085 gold stack')
  if (item.base.stackable !== 0) throw new MonsterItemNotPortedError113c('0x6FC31113 stackable quantity (#11144)')
  if (itemIsOfType(item, ITEMTYPE_ARMOR)) {
    // 0x6FC311AB..0x6FC31224
    setStat(item, STAT_TOBLOCK, item.base.block & 0xff)
    setStat(item, STAT_ARMOR_SPEED, -item.base.speed)
    rollDurability(item)
    // 0x6FC2F700: armorclass = minac + rollLimited(maxac - minac + 1) (0x6FC21480 on pItem+0x20)
    const span = item.base.maxac - item.base.minac + 1
    const ac = span > 0 ? item.base.minac + rollLimited(item.unitSeed, span) : item.base.minac
    if (ac > item.base.maxac) throw new Error(`0x6FC2F745: rolled AC ${ac} > maxac ${item.base.maxac}`)
    setStat(item, STAT_ARMORCLASS, ac)
  } else if (itemIsOfType(item, ITEMTYPE_WEAPON)) {
    // 0x6FC3123C: #10048 throwing/quantity weapons are not ported (stackable handled above)
    rollDurability(item)
    // 0x6FC2E860: base damage bytes, no RNG
    if (item.base.maxdam & 0xff) setStat(item, STAT_MAXDAMAGE, item.base.maxdam & 0xff)
    if (item.base.mindam & 0xff) setStat(item, STAT_MINDAMAGE, item.base.mindam & 0xff)
    if (item.base.twoHandMindam & 0xff) setStat(item, STAT_SECONDARY_MINDAMAGE, item.base.twoHandMindam & 0xff)
    if (item.base.twoHandMaxdam & 0xff) setStat(item, STAT_SECONDARY_MAXDAMAGE, item.base.twoHandMaxdam & 0xff)
    if (item.base.maxmisdam & 0xff) {
      setStat(item, STAT_ITEM_THROW_MINDAMAGE, item.base.minmisdam & 0xff)
      setStat(item, STAT_ITEM_THROW_MAXDAMAGE, item.base.maxmisdam & 0xff)
    }
    setStat(item, STAT_WEAPON_SPEED, -item.base.speed)
  } else {
    throw new MonsterItemNotPortedError113c(`0x6FC3130D misc base '${item.base.code}'`)
  }
  // 0x6FC3139D..0x6FC313C6: #10208 VarInvGfx -> rollLimited(n) on the unit seed -> #11019
  const gfx = itemTypeRec(item).varInvGfx & 0xff
  if (gfx > 0) rollLimited(item.unitSeed, gfx)
}

// ---------------------------------------------------------------------------------------------
// D2Common #10996 (mode 0) -> 0x6FD95AA0 -> 0x6FD95990: affix properties on the item-data seed
// ---------------------------------------------------------------------------------------------

/** Apply one `D2PropertyStrc` (`0x6FD95990`): Properties.txt sub-entries until `func` 0. */
function applyProperty(item: ItemUnit, mod: MagicAffixRec113c['mods'][number]): void {
  const t = loadTables()
  const subs = t.properties[mod.prop]
  if (subs === undefined) throw new Error(`0x6FD959C5: property ${mod.prop} out of range`)
  let first = 0
  for (let i = 0; i < 7; i++) {
    const sub = subs[i]!
    if (sub.func === 0) break
    let value: number
    switch (sub.func) {
      case 1: // 0x6FD98AE0: min..max on pItemData+4, STATLIST_AddStat(stat, value << ValShift, param)
      case 2: // 0x6FD98A40: same roll; 0x6FD96E50 only rewrites base AC/damage (no RNG)
        value = rollMinMax(item.itemSeed, mod.min, mod.max)
        break
      case 3: // 0x6FD989D0: reuse the first sub-entry's value; roll only when that value is 0
      case 8: // 0x6FD985D0 (FHR / IAS / FRW ...): same contract as func 3
        value = first !== 0 ? first : rollMinMax(item.itemSeed, mod.min, mod.max)
        break
      case 7: {
        // 0x6FD99340 (dmg%): value = passed first-entry value or a roll; item_mindamage_percent (18) then
        // item_maxdamage_percent (17); the item branch (0x6FD993D9) only rewrites base damage (no RNG)
        const v = first !== 0 ? first : rollMinMax(item.itemSeed, mod.min, mod.max)
        addStat(item, 18, v << (t.statValShift[18] ?? 0), 0)
        addStat(item, 17, v << (t.statValShift[17] ?? 0), 0)
        if (i === 0) first = 1 // 0x6FD993CD returns 1
        continue
      }
      case 5: // 0x6FD987C0 (dmg-min)
      case 6: {
        // 0x6FD98630 (dmg-max): value = passed first-entry value or a roll, then the 1H / 2H / throw stats
        const v = first !== 0 ? first : rollMinMax(item.itemSeed, mod.min, mod.max)
        applyDamageBonus(item, v, sub.func === 5)
        if (i === 0) first = v
        continue
      }
      case 17: {
        // 0x6FD991C0 (per-level stats): value = mod param, or a roll when the param is 0 (0 -> nothing)
        const v = mod.param !== 0 ? mod.param : rollMinMax(item.itemSeed, mod.min, mod.max)
        if (i === 0) first = v
        if (v === 0) continue
        if (sub.stat === STAT_MAXDAMAGE) throw new MonsterItemNotPortedError113c('0x6FD99213 func 17 maxdamage (func 6 path)')
        addStat(item, sub.stat, v << (t.statValShift[sub.stat] ?? 0), 0)
        continue
      }
      default:
        throw new MonsterItemNotPortedError113c(`Properties func ${sub.func} (0x6FDEB0C8[${sub.func}])`)
    }
    if (sub.stat < 0) throw new Error(`0x6FD975E0: property ${mod.prop} sub ${i} has no stat`)
    const shift = t.statValShift[sub.stat] ?? 0
    addStat(item, sub.stat, value << shift, mod.param)
    if (i === 0) first = value
  }
}

/**
 * Stat writes of Properties func 5 / 6 (`0x6FD98826..0x6FD98945` / `0x6FD98696..0x6FD987AC`): for each of
 * the one-hand, two-hand and throw damage stats, skip it on a weapon whose base has the other hand's
 * damage only (throw: skip on a non-throwable weapon, ItemTypes `Throwable` `0x6FD74C30`); a negative
 * bonus is clamped to `-base`.
 */
function applyDamageBonus(item: ItemUnit, v: number, isMin: boolean): void {
  const b = item.base
  const oneH = (isMin ? b.mindam : b.maxdam) & 0xff
  const twoH = (isMin ? b.twoHandMindam : b.twoHandMaxdam) & 0xff
  const thr = (isMin ? b.minmisdam : b.maxmisdam) & 0xff
  const isWeapon = itemIsOfType(item, ITEMTYPE_WEAPON)
  const clamp = (base: number): number => (base > 0 && base + v <= 0 ? -base : v)
  const put = (stat: number, value: number): void => {
    if (value !== 0) addStat(item, stat, value << (loadTables().statValShift[stat] ?? 0), 0)
  }
  if (!(isWeapon && oneH === 0 && twoH !== 0)) put(isMin ? STAT_MINDAMAGE : STAT_MAXDAMAGE, clamp(oneH))
  if (!(isWeapon && twoH === 0 && oneH !== 0)) put(isMin ? STAT_SECONDARY_MINDAMAGE : STAT_SECONDARY_MAXDAMAGE, clamp(twoH))
  if (!isWeapon || itemTypeRec(item).throwable !== 0) put(isMin ? STAT_ITEM_THROW_MINDAMAGE : STAT_ITEM_THROW_MAXDAMAGE, clamp(thr))
}

/** `#10996(0, 0, pItem, pAffix, 0, 0)` (`0x6FD960CB` -> `0x6FD96249` loop): up to 3 mods, stop at prop < 0. */
function applyAffixMods(item: ItemUnit, affixId: number): void {
  const rec = loadTables().magic[affixId - 1]
  if (rec === undefined) throw new Error(`#10248: affix id ${affixId} out of range`)
  for (const mod of rec.mods) {
    if (mod.prop < 0) break
    applyProperty(item, mod)
  }
}

// ---------------------------------------------------------------------------------------------
// 0x6FC344D0 ITEMS_RollAffix
// ---------------------------------------------------------------------------------------------

/** `#10461` (`D2Common 0x6FD95E50`) for an expansion item (`wVersion >= 100`). */
function magicAffixAllowed(item: ItemUnit, rec: MagicAffixRec113c): boolean {
  const t = loadTables()
  // 0x6FD95ED9..0x6FD95F21: a socket affix (mod1 stat1 == 194) needs MaxSock (0x6FD74610) > 0
  const maxSock = maxSockets(item)
  if (!(maxSock > 0)) {
    const p = rec.mods[0]!.prop
    if (p >= 0 && t.properties[p]![0]!.stat === 194) return false
  }
  for (const e of rec.etypes) {
    if (e <= 0) break
    if (itemIsOfType(item, e)) return false
  }
  for (const i of rec.itypes) {
    if (i <= 0) return false
    if (itemIsOfType(item, i)) return true
  }
  return false
}

/** `D2Common 0x6FD74610`: `min(Items.gemsockets, ItemTypes.MaxSock{1,25,40}[ilvl])`. */
function maxSockets(item: ItemUnit): number {
  const tr = itemTypeRec(item)
  const capByLvl = item.ilvl <= 25 ? tr.maxSock[0] : item.ilvl <= 40 ? tr.maxSock[1] : tr.maxSock[2]
  return Math.min(item.base.gemsockets & 0xff, capByLvl)
}

/** `0x6FC331E0`: an affix of `group` already sits in a prefix slot or a suffix slot. */
function groupTaken(item: ItemUnit, group: number): boolean {
  const t = loadTables()
  for (const ids of [item.prefixes, item.suffixes]) {
    for (let s = 0; s < 3; s++) {
      const id = ids[s] ?? 0
      const rec = id > 0 ? t.magic[id - 1] : undefined
      if (rec === undefined) break
      if (rec.group === group) return true
    }
  }
  return false
}

/**
 * `0x6FC344D0(pItem, bCheckSpawnable, bForce, bApplyMods, bPrefix, nForced, nAutoGroup)` (expansion
 * path). Returns the 1-based compiled affix id or 0.
 */
function rollAffix(
  item: ItemUnit,
  checkSpawnable: boolean,
  force: boolean,
  applyMods: boolean,
  prefix: boolean,
  forced: number,
): number {
  const t = loadTables()
  const [start, end] = prefix ? t.magicPrefixRange : t.magicSuffixRange
  // 0x6FC3458A: one draw on pItemData+4, always taken
  const coin = stepLow(item.itemSeed) & 1
  if (coin === 0 && !force) return 0
  // 0x6FC345DB..0x6FC3465F: alvl
  let i = Math.max(item.ilvl, item.base.level & 0xff)
  const qlvl = item.base.level & 0xff
  if (item.base.magicLvl !== 0) i += item.base.magicLvl
  else {
    const half = Math.trunc(qlvl / 2)
    if (i < 99 - half) i -= half
    else i = 2 * i - half - (99 - half)
  }
  const alvl = i <= 1 ? 1 : i >= 99 ? 99 : i
  const cands: MagicAffixRec113c[] = []
  let total = 0
  let forcedPick: MagicAffixRec113c | undefined
  for (let k = 0; k < end - start; k++) {
    const rec = t.magic[start + k]!
    if (checkSpawnable && rec.spawnable === 0) continue // 0x6FC34686 (+0x54)
    if (rec.version >= 100 && item.version < 100) continue // 0x6FC34691
    let isForced = false
    if (forced > 0 && forced - 1 === k) isForced = true // 0x6FC346A7
    else {
      if (rec.level > alvl) continue // 0x6FC346C7
      if (rec.maxlevel !== 0 && rec.maxlevel < alvl) continue // 0x6FC346CF
    }
    if (rec.rare === 0) {
      // 0x6FC346E4: non-rare affix never on rare / crafted / tempered items
      if (item.quality === 6 || (item.quality > 7 && item.quality <= 9)) continue
    }
    if (!magicAffixAllowed(item, rec)) continue // #10461
    if (rec.frequency === 0) continue // 0x6FC34724 (+0x82)
    if (rec.classSpecific !== '') {
      // 0x6FC3472F: #10822 item class must be 7 (none) or equal
      const cls = itemTypeRec(item).classCode
      if (cls !== '') throw new MonsterItemNotPortedError113c(`0x6FC34735 class-specific affix on class item '${cls}'`)
    }
    if (groupTaken(item, rec.group)) continue // 0x6FC331E0
    if (isForced) {
      forcedPick = rec
      break
    }
    if (cands.length < 0x1ff) cands.push(rec)
    total += item.base.magicLvl !== 0 ? rec.frequency * rec.level : rec.frequency
  }
  let pick: MagicAffixRec113c | undefined = forcedPick
  if (pick === undefined) {
    if (cands.length <= 0) return 0
    // 0x6FC347FC..0x6FC34853: roll = rollLimited(total + 1); walk until roll < 0; falls through to the last
    let roll = rollLimited(item.itemSeed, total + 1)
    for (const c of cands) {
      pick = c
      roll -= item.base.magicLvl !== 0 ? c.frequency * c.level : c.frequency
      if (roll < 0) break
    }
  }
  const id = pick!.index + 1
  if (applyMods) applyAffixMods(item, id)
  return id
}

// ---------------------------------------------------------------------------------------------
// 0x6FC34210 rare name, 0x6FC35240 rare affixes, 0x6FC303C0 magic affixes
// ---------------------------------------------------------------------------------------------

/** `D2Common #10110` (`0x6FD95D30`) for an expansion item. */
function rareAffixAllowed(item: ItemUnit, rec: RareAffixRec113c): boolean {
  if (rec.version >= 100 && item.version < 100) return false
  for (const e of rec.etypes) {
    if (e <= 0) break
    if (itemIsOfType(item, e)) return false
  }
  for (const i of rec.itypes) {
    if (i <= 0) return false
    if (itemIsOfType(item, i)) return true
  }
  return false
}

function rollRareName(item: ItemUnit, prefix: boolean): number {
  const t = loadTables()
  const [start, end] = prefix ? t.rarePrefixRange : t.rareSuffixRange
  const cands: number[] = []
  for (let k = start; k < end; k++) if (rareAffixAllowed(item, t.rare[k]!) && cands.length < 0x1ff) cands.push(k)
  if (cands.length === 0) return 0
  const r = rollLimited(item.itemSeed, cands.length)
  return cands[r]! + 1
}

const RARE_AFFIX_COUNT_TABLE_113C: readonly number[] = [3, 4, 4, 5, 5, 5, 6, 6] // 0x6FD1D058

/** `0x6FC35240` (expansion). Returns false when no affix could be placed (the caller then falls back). */
function rollRareAffixes(item: ItemUnit): boolean {
  item.rarePrefix = rollRareName(item, true)
  item.rareSuffix = rollRareName(item, false)
  if (item.rarePrefix === 0 || item.rareSuffix === 0) return false
  const count =
    item.typeId === ITEMTYPE_JEWEL ? 3 + (stepLow(item.itemSeed) & 1) : RARE_AFFIX_COUNT_TABLE_113C[stepLow(item.itemSeed) & 7]!
  let nSuf = 0 // ebp, slots +0x3E
  let nPre = 0 // ebx, slots +0x38
  let sufFull = false // [esp+0x14]
  let preFull = false // [esp+0x1C]
  for (let i = 0; i < count; i++) {
    let doSuffix: boolean
    if (preFull) {
      if (sufFull) break
      doSuffix = true
    } else if (sufFull) doSuffix = false
    else doSuffix = (stepLow(item.itemSeed) & 1) !== 0 // 0x6FC3539F: 1 -> MagicSuffix side
    if (doSuffix) {
      if (nSuf >= 3) throw new Error('0x6FC354BD: suffix slots overflow')
      const id = rollAffix(item, true, true, false, false, 0)
      if (id > 0) {
        item.suffixes[nSuf] = id
        nSuf++
        if (nSuf >= 3) sufFull = true
      } else {
        sufFull = true
        i--
      }
    } else {
      if (nPre >= 3) throw new Error('0x6FC354B6: prefix slots overflow')
      const id = rollAffix(item, true, true, false, true, 0)
      if (id > 0) {
        item.prefixes[nPre] = id
        nPre++
        if (nPre >= 3) preFull = true
      } else {
        preFull = true
        i--
      }
    }
  }
  if (nPre === 0 && nSuf === 0) return false
  // 0x6FC3544C..0x6FC3549A: for slot 0..2: prefix slot mods, then suffix slot mods
  for (let s = 0; s < 3; s++) {
    const p = item.prefixes[s] ?? 0
    if (p > 0) applyAffixMods(item, p)
    const q = item.suffixes[s] ?? 0
    if (q > 0) applyAffixMods(item, q)
  }
  staffModsGate(item)
  return true
}

/** `0x6FC303C0` with no forced affixes (`pDrop+0x68 = pDrop+0x74 = 0`). */
function rollMagicAffixes(item: ItemUnit): boolean {
  const pre = rollAffix(item, true, false, true, true, 0)
  item.prefixes[0] = pre
  const suf = rollAffix(item, true, pre === 0, true, false, 0)
  item.suffixes[0] = suf
  if (pre === 0 && suf === 0) return false
  staffModsGate(item)
  return true
}

/** `0x6FC33DE0`: class staff mods (`#10957` StaffMods in 0..6) are not ported. */
function staffModsGate(item: ItemUnit): void {
  const sm = itemTypeRec(item).staffMods
  if (sm !== '') throw new MonsterItemNotPortedError113c(`0x6FC33DFA staff mods '${sm}'`)
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

export interface CreateMonsterItemInput113c {
  readonly itemCode: string
  /** `MonEquip.txt` `mod` (forced quality, `pDrop+0x30`). */
  readonly quality: number
  /** `pDrop+0x0C` (`#10377`). */
  readonly ilvl: number
  readonly itemVersion: number
  /** `pItem+0x20` (`SEED_InitLowSeed(game draw 1)`), advanced in place. */
  readonly unitSeed: D2SeedStrc
  /** `pItemData+0x04` (`SEED_InitLowSeed(game draw 2)`), advanced in place. */
  readonly itemDataSeed: D2SeedStrc
}

/**
 * `0x6FC31490` from `#10377` on (the unit / item-data seeds are allocated by the caller): base stats
 * (`0x6FC31070`) and the forced-quality dispatch (`0x6FC30A20`).
 */
export function createMonsterItem113c(input: CreateMonsterItemInput113c): CreatedMonsterItem113c {
  const t = loadTables()
  const base = t.items.get(input.itemCode)
  if (base === undefined) throw new Error(`createMonsterItem113c: no Weapons/Armor row '${input.itemCode}'`)
  const typeRec = t.itemTypeByCode.get(base.type)
  if (typeRec === undefined) throw new Error(`createMonsterItem113c: '${base.code}' type '${base.type}' unknown`)
  const item: ItemUnit = {
    base,
    typeId: typeRec.id,
    type2Id: typeIdOf(t.itemTypeByCode, base.type2, `${base.code}.type2`),
    version: input.itemVersion,
    ilvl: input.ilvl > 0 ? input.ilvl : 1, // 0x6FC315A0
    quality: 0,
    unitSeed: input.unitSeed,
    itemSeed: input.itemDataSeed,
    rarePrefix: 0,
    rareSuffix: 0,
    prefixes: [0, 0, 0],
    suffixes: [0, 0, 0],
    stats: [],
  }
  if (item.version < 100) throw new MonsterItemNotPortedError113c('classic item version (< 100)')
  initItemStats(item)

  // 0x6FC30A20: 0x6FC2EE90 returns pDrop+0x30 unchanged for wVersion >= 1 and a forced quality
  let quality = input.quality
  const tr = t.itemTypes[item.typeId]!
  if (tr.magic !== 0) throw new MonsterItemNotPortedError113c('0x6FC30AC3 ItemTypes.Magic (#10710) quality override')
  if (quality === 6 && tr.rare === 0) quality = 4 // 0x6FC30AF0 (#11036)
  if (base.unique !== 0) throw new MonsterItemNotPortedError113c('0x6FC30B23 Items.unique (#10119) -> quality 7')
  if (tr.normal !== 0) throw new MonsterItemNotPortedError113c('0x6FC30B3B ItemTypes.Normal (#10556) -> quality 2')
  item.quality = quality
  switch (quality) {
    case 6: // 0x6FC30BDE
      if (!rollRareAffixes(item)) throw new MonsterItemNotPortedError113c('0x6FC30C14 rare fallback (0x6FC304F0)')
      break
    case 4: // 0x6FC30CE1
      if (!rollMagicAffixes(item)) throw new MonsterItemNotPortedError113c('0x6FC30D04 magic fallback (0x6FC301E0)')
      break
    default:
      throw new MonsterItemNotPortedError113c(`0x6FC30B5A quality ${quality}`)
  }
  // 0x6FC30C73: ethereal 0x6FC2EBB0 is skipped (pDrop+0x80 & 2); sockets 0x6FC2EC90 only for q 1..3.
  // 0x6FC30CC0: rare/magic -> 0x6FC30FCB automagic when ItemsTxt+0xF8 != 0
  if (base.autoPrefix !== 0) throw new MonsterItemNotPortedError113c(`0x6FC30FDA automagic group ${base.autoPrefix}`)

  return {
    code: base.code,
    quality: item.quality,
    ilvl: item.ilvl,
    rarePrefix: item.rarePrefix,
    rareSuffix: item.rareSuffix,
    prefixes: item.prefixes.filter((x) => x > 0),
    suffixes: item.suffixes.filter((x) => x > 0),
    prefixNames: item.prefixes.filter((x) => x > 0).map((x) => t.magic[x - 1]!.name),
    suffixNames: item.suffixes.filter((x) => x > 0).map((x) => t.magic[x - 1]!.name),
    stats: item.stats,
  }
}
