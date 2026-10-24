/**
 * Diablo II SetItems.txt and Sets.txt loader, set definition mapping,
 * and set bonus resolution.
 *
 * Gold standard reference 1.13c:
 * - SetItems.txt: 128 raw lines - 1 'Expansion' separator = 127 data rows × 94 columns.
 *   Key is `index` (references string.tbl / expansionstring.tbl).
 * - Sets.txt: 33 raw lines - 1 'Expansion' separator = 32 data rows × 69 columns.
 *   Key is `index` (primary key referenced by SetItems.set).
 */

import type { D2Table } from '../world/acts.ts'
import { parseTable } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import { CANONICAL_ENG_TBL_DICT } from '../data/canonical-tbl-strings.ts'

/** Single bonus modifier with property code, optional parameter, and min/max range. */
export interface SetBonusProp {
  readonly code: string
  readonly par?: string | number
  readonly min: number
  readonly max: number
}

/** Individual item base property (blue modifier). */
export interface SetItemProp extends SetBonusProp {}

/** Partial set property on an individual item (green modifier). */
export interface SetItemAprop extends SetBonusProp {
  /** Partial bonus threshold (1..5, matching aprop1..aprop5; activated when wornPieceCount >= 2). */
  readonly threshold: number
  /** Slot 'a' or 'b'. */
  readonly slot: 'a' | 'b'
}

/** Partial set property for the whole set (gold modifier). */
export interface SetPartialCode extends SetBonusProp {
  /** Piece count threshold (2..5, matching PCode2..PCode5; activated when wornPieceCount >= threshold). */
  readonly threshold: number
  /** Slot 'a' or 'b'. */
  readonly slot: 'a' | 'b'
}

/** Full set property for the whole set (gold modifier). */
export interface SetFullCode extends SetBonusProp {}

/** One record from SetItems.txt. */
export interface SetItem {
  /** 0-based data row id matching .d2s setId (0..126). */
  readonly id: number
  /** Primary key / string.tbl key (e.g. "Civerb's Ward"). */
  readonly index: string
  /** Reference to Sets.index (e.g. "Civerb's Vestments"). */
  readonly set: string
  /** Base item code (e.g. 'lrg', 'amu', 'gsc'). */
  readonly item: string
  /** Droprate rarity weight. */
  readonly rarity: number
  /** Item quality level. */
  readonly lvl: number
  /** Character level requirement (lvl req). */
  readonly levelreq: number
  /** Palette transform on character model (e.g. 'lyel'). */
  readonly chrtransform?: string
  /** Palette transform on inventory icon (e.g. 'lyel'). */
  readonly invtransform?: string
  /** Inventory icon file override (.dc6 name without extension). */
  readonly invfile?: string
  /** Flippy animation file override. */
  readonly flippyfile?: string
  /** Drop sound override. */
  readonly dropsound?: string
  /** Drop sfx frame offset. */
  readonly dropsfxframe?: number
  /** Use sound override. */
  readonly usesound?: string
  /** Vendor cost multiplier. */
  readonly costMult: number
  /** Vendor cost addition. */
  readonly costAdd: number
  /** Property mode: 1 = specific item pairs, 2 = count of other items equipped. */
  readonly addFunc: number
  /** Individual item properties (up to 9 props). */
  readonly props: readonly SetItemProp[]
  /** Partial set properties on this item (up to 5 pairs of aprop1a/1b..5a/5b). */
  readonly aprops: readonly SetItemAprop[]
}

/** One record from Sets.txt. */
export interface SetDefinition {
  /** Primary key referenced by SetItems.set. */
  readonly index: string
  /** String.tbl key for set name. */
  readonly name: string
  /** Version: 0 for Classic/LoD, 100 for LoD expansion only. */
  readonly version: number
  /** Set level. */
  readonly level: number
  /** Partial set bonuses for the set (PCode2a/2b..5a/5b). */
  readonly pCodes: readonly SetPartialCode[]
  /** Full set bonuses for the set (FCode1..8). */
  readonly fCodes: readonly SetFullCode[]
  /** Associated set item indices (e.g. ["Civerb's Ward", "Civerb's Icon", "Civerb's Cudgel"]). */
  items?: readonly string[]
}

/** Active set bonuses computed for a specific worn item. */
export interface ResolvedBonusProps {
  /** Individual item properties (active if wornPieceCount >= 1). */
  readonly props: readonly SetItemProp[]
  /** Active item partial set bonuses (green). */
  readonly aprops: readonly SetItemAprop[]
  /** Active set partial bonuses (gold). */
  readonly pCodes: readonly SetPartialCode[]
  /** Active full set bonuses (gold). */
  readonly fCodes: readonly SetFullCode[]
  /** All active properties combined. */
  readonly all: readonly SetBonusProp[]
  /** Whether all pieces of the set are worn. */
  readonly isFullSet: boolean
}

/** Collection of parsed SetItem records with lookup helpers. */
export interface SetItemTable {
  readonly entries: readonly SetItem[]
  readonly rows: readonly SetItem[]
  readonly byIndex: ReadonlyMap<string, SetItem>
  readonly byId: ReadonlyMap<number, SetItem>
  readonly table?: D2Table
  get(key: string | number): SetItem | undefined
  getByIndex(index: string): SetItem | undefined
  getById(id: number): SetItem | undefined
  getBySet(setName: string): readonly SetItem[]
  readonly length: number
  [Symbol.iterator](): IterableIterator<SetItem>
  readonly [index: number]: SetItem | undefined
}

/** Collection of parsed SetDefinition records with lookup helpers. */
export interface SetTable {
  readonly entries: readonly SetDefinition[]
  readonly rows: readonly SetDefinition[]
  readonly byIndex: ReadonlyMap<string, SetDefinition>
  readonly table?: D2Table
  get(index: string): SetDefinition | undefined
  getByIndex(index: string): SetDefinition | undefined
  linkItems(items: SetItemTable): void
  readonly length: number
  [Symbol.iterator](): IterableIterator<SetDefinition>
  readonly [index: number]: SetDefinition | undefined
}

/** Parse a param string into number (if integer/float) or string. */
export function parseParam(raw: string | undefined): string | number | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  const num = Number(trimmed)
  return Number.isNaN(num) ? trimmed : num
}

function createSetItemTable(entries: SetItem[], table?: D2Table): SetItemTable {
  const byIndex = new Map<string, SetItem>()
  const byDisplayName = new Map<string, SetItem>()
  const byId = new Map<number, SetItem>()
  const bySet = new Map<string, SetItem[]>()

  for (const entry of entries) {
    byId.set(entry.id, entry)
    byIndex.set(entry.index, entry)
    byIndex.set(entry.index.trim(), entry)
    byIndex.set(entry.index.toLowerCase(), entry)
    byIndex.set(entry.index.trim().toLowerCase(), entry)
    const tblEn = CANONICAL_ENG_TBL_DICT[entry.index] ?? CANONICAL_ENG_TBL_DICT[entry.index.trim()]
    if (tblEn) {
      byDisplayName.set(tblEn, entry)
      byDisplayName.set(tblEn.trim(), entry)
      byDisplayName.set(tblEn.toLowerCase(), entry)
      byDisplayName.set(tblEn.trim().toLowerCase(), entry)
    }

    const setKey = entry.set.trim().toLowerCase()
    let setList = bySet.get(setKey)
    if (!setList) {
      setList = []
      bySet.set(setKey, setList)
    }
    setList.push(entry)
  }

  const result: any = {
    entries,
    rows: entries,
    byIndex,
    byId,
    table,
    get: (key: string | number) => {
      if (typeof key === 'number') return byId.get(key)
      const norm = typeof key === 'string' ? key.trim().toLowerCase() : key
      return byIndex.get(norm) ?? byDisplayName.get(norm)
    },
    getByIndex: (index: string) =>
      byIndex.get(index) ??
      byIndex.get(index.trim().toLowerCase()) ??
      byDisplayName.get(index) ??
      byDisplayName.get(index.trim().toLowerCase()),
    getById: (id: number) => byId.get(id),
    getBySet: (setName: string) => bySet.get(setName.trim().toLowerCase()) ?? [],
    [Symbol.iterator]: () => entries[Symbol.iterator](),
  }

  Object.defineProperty(result, 'length', {
    get: () => entries.length,
    enumerable: true,
  })

  for (let i = 0; i < entries.length; i++) {
    result[i] = entries[i]
  }

  return result as SetItemTable
}

function createSetTable(entries: SetDefinition[], table?: D2Table): SetTable {
  const byIndex = new Map<string, SetDefinition>()

  for (const entry of entries) {
    byIndex.set(entry.index, entry)
    byIndex.set(entry.index.trim(), entry)
    byIndex.set(entry.index.toLowerCase(), entry)
    byIndex.set(entry.index.trim().toLowerCase(), entry)
  }

  const result: any = {
    entries,
    rows: entries,
    byIndex,
    table,
    get: (index: string) => byIndex.get(index) ?? byIndex.get(index.trim().toLowerCase()),
    getByIndex: (index: string) => byIndex.get(index) ?? byIndex.get(index.trim().toLowerCase()),
    linkItems: (items: SetItemTable) => {
      for (const entry of entries) {
        entry.items = items.getBySet(entry.index).map(i => i.index)
      }
    },
    [Symbol.iterator]: () => entries[Symbol.iterator](),
  }

  Object.defineProperty(result, 'length', {
    get: () => entries.length,
    enumerable: true,
  })

  for (let i = 0; i < entries.length; i++) {
    result[i] = entries[i]
  }

  return result as SetTable
}

/**
 * Parse SetItems.txt into a SetItemTable.
 * Filters out comment headers and the 'Expansion' separator row.
 * Produces exactly 127 data records from canonical 1.13c data.
 */
export function parseSetItemsTable(table: D2Table): SetItemTable
export function parseSetItemsTable(bytes: Uint8Array): SetItemTable
export function parseSetItemsTable(tsv: string): SetItemTable
export function parseSetItemsTable(input?: D2Table | Uint8Array | string): SetItemTable {
  let table: D2Table
  if (!input) {
    table = parseTable(new TextEncoder().encode(CANONICAL_SET_ITEMS_TSV.trim()))
  } else if (typeof input === 'string') {
    table = parseTable(new TextEncoder().encode(input.trim()))
  } else if (input instanceof Uint8Array) {
    table = parseTable(input)
  } else {
    table = input
  }

  const headerMap = new Map<string, number>()
  table.header.forEach((h, idx) => {
    headerMap.set(h.trim().toLowerCase(), idx)
  })

  const getCell = (row: readonly string[], col: string): string => {
    const idx = headerMap.get(col.trim().toLowerCase())
    if (idx === undefined) return ''
    return row[idx] ?? ''
  }

  const entries: SetItem[] = []
  let rowId = 0

  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r]!
    const index = getCell(row, 'index')
    // Filter empty rows and the 'Expansion' separator row
    if (!index || index === 'Expansion') continue

    const set = getCell(row, 'set').trim()
    const item = getCell(row, 'item').trim()
    const rawRarity = getCell(row, 'rarity').trim()
    const rarity = rawRarity ? Number.parseInt(rawRarity, 10) : 0
    const rawLvl = getCell(row, 'lvl').trim()
    const lvl = rawLvl ? Number.parseInt(rawLvl, 10) : 0
    const rawLevelReq = getCell(row, 'lvl req').trim()
    const levelreq = rawLevelReq ? Number.parseInt(rawLevelReq, 10) : 0

    const chrtransform = getCell(row, 'chrtransform').trim() || undefined
    const invtransform = getCell(row, 'invtransform').trim() || undefined
    const invfile = getCell(row, 'invfile').trim() || undefined
    const flippyfile = getCell(row, 'flippyfile').trim() || undefined
    const dropsound = getCell(row, 'dropsound').trim() || undefined
    const rawDropsfxframe = getCell(row, 'dropsfxframe').trim()
    const dropsfxframe = rawDropsfxframe ? Number.parseInt(rawDropsfxframe, 10) : undefined
    const usesound = getCell(row, 'usesound').trim() || undefined

    const rawCostMult = getCell(row, 'cost mult').trim()
    const costMult = rawCostMult ? Number.parseInt(rawCostMult, 10) : 0
    const rawCostAdd = getCell(row, 'cost add').trim()
    const costAdd = rawCostAdd ? Number.parseInt(rawCostAdd, 10) : 0
    const rawAddFunc = getCell(row, 'add func').trim()
    const addFunc = rawAddFunc ? Number.parseInt(rawAddFunc, 10) : 0

    const props: SetItemProp[] = []
    for (let slot = 1; slot <= 9; slot++) {
      const code = getCell(row, `prop${slot}`).trim()
      if (code) {
        const par = parseParam(getCell(row, `par${slot}`))
        const rawMin = getCell(row, `min${slot}`).trim()
        const rawMax = getCell(row, `max${slot}`).trim()
        const min = rawMin !== '' ? Number.parseInt(rawMin, 10) : 0
        const max = rawMax !== '' ? Number.parseInt(rawMax, 10) : min
        props.push({
          code,
          ...(par !== undefined ? { par } : {}),
          min,
          max,
        })
      }
    }

    const aprops: SetItemAprop[] = []
    for (let i = 1; i <= 5; i++) {
      for (const slot of ['a', 'b'] as const) {
        const code = getCell(row, `aprop${i}${slot}`).trim()
        if (code) {
          const par = parseParam(getCell(row, `apar${i}${slot}`))
          const rawMin = getCell(row, `amin${i}${slot}`).trim()
          const rawMax = getCell(row, `amax${i}${slot}`).trim()
          const min = rawMin !== '' ? Number.parseInt(rawMin, 10) : 0
          const max = rawMax !== '' ? Number.parseInt(rawMax, 10) : min
          aprops.push({
            threshold: i,
            slot,
            code,
            ...(par !== undefined ? { par } : {}),
            min,
            max,
          })
        }
      }
    }

    entries.push({
      id: rowId++,
      index,
      set,
      item,
      rarity,
      lvl,
      levelreq,
      ...(chrtransform !== undefined ? { chrtransform } : {}),
      ...(invtransform !== undefined ? { invtransform } : {}),
      ...(invfile !== undefined ? { invfile } : {}),
      ...(flippyfile !== undefined ? { flippyfile } : {}),
      ...(dropsound !== undefined ? { dropsound } : {}),
      ...(dropsfxframe !== undefined ? { dropsfxframe } : {}),
      ...(usesound !== undefined ? { usesound } : {}),
      costMult,
      costAdd,
      addFunc,
      props,
      aprops,
    })
  }

  return createSetItemTable(entries, table)
}

/**
 * Parse Sets.txt into a SetTable.
 * Filters out comment headers and the 'Expansion' separator row.
 * Produces exactly 32 data records from canonical 1.13c data.
 */
export function parseSetsTable(table: D2Table, setItems?: SetItemTable): SetTable
export function parseSetsTable(bytes: Uint8Array, setItems?: SetItemTable): SetTable
export function parseSetsTable(tsv: string, setItems?: SetItemTable): SetTable
export function parseSetsTable(input?: D2Table | Uint8Array | string, setItems?: SetItemTable): SetTable {
  let table: D2Table
  if (!input) {
    table = parseTable(new TextEncoder().encode(CANONICAL_SETS_TSV.trim()))
  } else if (typeof input === 'string') {
    table = parseTable(new TextEncoder().encode(input.trim()))
  } else if (input instanceof Uint8Array) {
    table = parseTable(input)
  } else {
    table = input
  }

  const headerMap = new Map<string, number>()
  table.header.forEach((h, idx) => {
    headerMap.set(h.trim().toLowerCase(), idx)
  })

  const getCell = (row: readonly string[], col: string): string => {
    const idx = headerMap.get(col.trim().toLowerCase())
    if (idx === undefined) return ''
    return row[idx] ?? ''
  }

  const entries: SetDefinition[] = []

  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r]!
    const index = getCell(row, 'index')
    // Filter empty rows and the 'Expansion' separator row
    if (!index || index === 'Expansion') continue

    const name = getCell(row, 'name').trim()
    const rawVersion = getCell(row, 'version').trim()
    const version = rawVersion ? Number.parseInt(rawVersion, 10) : 0
    const rawLevel = getCell(row, 'level').trim()
    const level = rawLevel ? Number.parseInt(rawLevel, 10) : 0

    const pCodes: SetPartialCode[] = []
    for (let i = 2; i <= 5; i++) {
      for (const slot of ['a', 'b'] as const) {
        const code = getCell(row, `pcode${i}${slot}`).trim()
        if (code) {
          const par = parseParam(getCell(row, `pparam${i}${slot}`))
          const rawMin = getCell(row, `pmin${i}${slot}`).trim()
          const rawMax = getCell(row, `pmax${i}${slot}`).trim()
          const min = rawMin !== '' ? Number.parseInt(rawMin, 10) : 0
          const max = rawMax !== '' ? Number.parseInt(rawMax, 10) : min
          pCodes.push({
            threshold: i,
            slot,
            code,
            ...(par !== undefined ? { par } : {}),
            min,
            max,
          })
        }
      }
    }

    const fCodes: SetFullCode[] = []
    for (let i = 1; i <= 8; i++) {
      const code = getCell(row, `fcode${i}`).trim()
      if (code) {
        const par = parseParam(getCell(row, `fparam${i}`))
        const rawMin = getCell(row, `fmin${i}`).trim()
        const rawMax = getCell(row, `fmax${i}`).trim()
        const min = rawMin !== '' ? Number.parseInt(rawMin, 10) : 0
        const max = rawMax !== '' ? Number.parseInt(rawMax, 10) : min
        fCodes.push({
          code,
          ...(par !== undefined ? { par } : {}),
          min,
          max,
        })
      }
    }

    entries.push({
      index,
      name,
      version,
      level,
      pCodes,
      fCodes,
    })
  }

  const setTable = createSetTable(entries, table)
  if (setItems) {
    setTable.linkItems(setItems)
  }
  return setTable
}

/**
 * Resolve active bonus properties granted by wearing a set item with a given
 * number of worn pieces from its set.
 *
 * Rules:
 * - 1 piece: Only individual base item properties (`setItem.props`).
 * - 2 pieces: Base item properties + item partial bonus (`aprop1`) + set partial bonus (`PCode2`).
 * - 3+ pieces: Subsequent `aprop` and `PCode` bonuses activate as wornPieceCount increases.
 * - Full set: All item `aprops` + all set `pCodes` + full set `fCodes`.
 *
 * @param setItem - The equipped set item.
 * @param setDef - The corresponding set definition from Sets.txt.
 * @param wornPieceCount - Total number of items worn from this set (e.g. 1, 2, 3...).
 * @returns Resolved bonus properties categorized by source and combined.
 */
export function resolveActiveSetBonuses(
  setItem: SetItem,
  setDef: SetDefinition,
  wornPieceCount: number,
): ResolvedBonusProps {
  if (wornPieceCount < 1) {
    return {
      props: [],
      aprops: [],
      pCodes: [],
      fCodes: [],
      all: [],
      isFullSet: false,
    }
  }

  const props = setItem.props

  // aprops activate when 2 or more pieces of the set are equipped.
  // Pair 1 (threshold 1) activates at 2 pieces; pair 2 (threshold 2) at 3 pieces, etc.
  const aprops = wornPieceCount >= 2
    ? setItem.aprops.filter(a => a.threshold <= (wornPieceCount - 1))
    : []

  // pCodes activate when 2 or more pieces of the set are equipped.
  // PCode2 (threshold 2) activates at 2 pieces; PCode3 (threshold 3) at 3 pieces, etc.
  const pCodes = wornPieceCount >= 2
    ? setDef.pCodes.filter(p => p.threshold <= wornPieceCount)
    : []

  // Determine if full set is equipped
  const itemCount = setDef.items && setDef.items.length > 0
    ? setDef.items.length
    : setDef.pCodes.length > 0
      ? Math.max(2, ...setDef.pCodes.map(p => p.threshold)) + 1
      : 2

  const isFullSet = wornPieceCount >= itemCount
  const fCodes = isFullSet ? setDef.fCodes : []

  const all: SetBonusProp[] = [
    ...props,
    ...aprops,
    ...pCodes,
    ...fCodes,
  ]

  return {
    props,
    aprops,
    pCodes,
    fCodes,
    all,
    isFullSet,
  }
}

/**
 * Load SetItems.txt and Sets.txt from mounted MPQ archives and cross-link them.
 *
 * @param archives - Mounted MPQ archives.
 * @returns Parsed items and sets tables.
 */
export async function loadSetData(
  archives: MountedArchives,
): Promise<{ items: SetItemTable; sets: SetTable }> {
  const candidateSetItemPaths = [
    'data/global/excel/SetItems.txt',
    'data\\global\\excel\\SetItems.txt',
    'data/global/excel/setitems.txt',
    'data\\global\\excel\\setitems.txt',
  ]
  let itemBytes: Uint8Array | undefined
  for (const p of candidateSetItemPaths) {
    if (archives.has(p)) {
      itemBytes = await archives.read(p)
      break
    }
  }
  if (!itemBytes) {
    itemBytes = await archives.read('data/global/excel/SetItems.txt')
  }

  const candidateSetPaths = [
    'data/global/excel/Sets.txt',
    'data\\global\\excel\\Sets.txt',
    'data/global/excel/sets.txt',
    'data\\global\\excel\\sets.txt',
  ]
  let setBytes: Uint8Array | undefined
  for (const p of candidateSetPaths) {
    if (archives.has(p)) {
      setBytes = await archives.read(p)
      break
    }
  }
  if (!setBytes) {
    setBytes = await archives.read('data/global/excel/Sets.txt')
  }

  const items = parseSetItemsTable(parseTable(itemBytes))
  const sets = parseSetsTable(parseTable(setBytes), items)

  return { items, sets }
}

/** Canonical 1.13c SetItems.txt embedded TSV data. */
export const CANONICAL_SET_ITEMS_TSV = "index\tset\titem\t*item\trarity\tlvl\tlvl req\tchrtransform\tinvtransform\tinvfile\tflippyfile\tdropsound\tdropsfxframe\tusesound\tcost mult\tcost add\tadd func\tprop1\tpar1\tmin1\tmax1\tprop2\tpar2\tmin2\tmax2\tprop3\tpar3\tmin3\tmax3\tprop4\tpar4\tmin4\tmax4\tprop5\tpar5\tmin5\tmax5\tprop6\tpar6\tmin6\tmax6\tprop7\tpar7\tmin7\tmax7\tprop8\tpar8\tmin8\tmax8\tprop9\tpar9\tmin9\tmax9\taprop1a\tapar1a\tamin1a\tamax1a\taprop1b\tapar1b\tamin1b\tamax1b\taprop2a\tapar2a\tamin2a\tamax2a\taprop2b\tapar2b\tamin2b\tamax2b\taprop3a\tapar3a\tamin3a\tamax3a\taprop3b\tapar3b\tamin3b\tamax3b\taprop4a\tapar4a\tamin4a\tamax4a\taprop4b\tapar4b\tamin4b\tamax4b\taprop5a\tapar5a\tamin5a\tamax5a\taprop5b\tapar5b\tamin5b\tamax5b\t*eol\r\nCiverb's Ward\tCiverb's Vestments\tlrg\tLarge Shield\t7\t13\t9\tlyel\tlyel\t\t\t\t\t\t5\t2500\t1\tac\t\t15\t15\tblock\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tmana\t\t21\t22\t\t\t\t\tres-pois\t\t25\t26\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCiverb's Icon\tCiverb's Vestments\tamu\tAmulet\t7\t13\t9\tlyel\tlyel\t\t\t\t\t\t5\t2500\t2\tregen-mana\t\t40\t40\tregen\t\t4\t4\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-cold\t\t25\t25\t\t\t\t\tac\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCiverb's Cudgel\tCiverb's Vestments\tgsc\tGrand Scepter\t7\t13\t9\tlyel\tlyel\t\t\t\t\t\t5\t2500\t\tatt\t\t75\t75\tdmg-max\t\t17\t23\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdmg/lvl\t8\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nHsarus' Iron Heel\tHsarus' Defense\tmbt\tChain Boots\t7\t4\t3\tdred\tdred\t\t\t\t\t\t5\t2500\t2\tres-fire\t\t25\t25\tmove2\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt/lvl\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nHsarus' Iron Fist\tHsarus' Defense\tbuc\tBuckler\t7\t4\t3\tdred\tdred\t\t\t\t\t\t5\t2500\t2\tred-dmg\t\t2\t2\tstr\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac/lvl\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nHsarus' Iron Stay\tHsarus' Defense\tmbl\tBelt\t7\t4\t3\tdred\tdred\t\t\t\t\t\t5\t2500\t2\tres-cold\t\t20\t20\thp\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac/lvl\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCleglaw's Tooth\tCleglaw's Brace\tlsd\tLong Sword\t7\t6\t4\tlred\tlred\t\t\t\t\t\t5\t2500\t2\tatt%\t\t30\t30\tdeadly\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdmg/lvl\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCleglaw's Claw\tCleglaw's Brace\tsml\tSmall Shield\t7\t6\t4\tlred\tlred\t\t\t\t\t\t5\t2500\t2\tac\t\t17\t17\tres-pois-len\t\t75\t75\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCleglaw's Pincers\tCleglaw's Brace\tmgl\tChain Gloves\t7\t6\t4\tlred\tlred\t\t\t\t\t\t5\t2500\t2\tknock\t\t1\t1\tslow\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt/lvl\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nIratha's Collar\tIratha's Finery\tamu\tAmulet\t7\t21\t15\tlgry\tlgry\t\t\t\t\t\t5\t2500\t2\tres-pois\t\t30\t30\tres-pois-len\t\t75\t75\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nIratha's Cuff\tIratha's Finery\ttgl\tLight Gauntlets\t7\t21\t15\tlgry\tlgry\t\t\t\t\t\t5\t2500\t2\tres-cold\t\t30\t30\thalf-freeze\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tswing2\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nIratha's Coil\tIratha's Finery\tcrn\tCrown\t7\t21\t15\tlgry\tlgry\t\t\t\t\t\t5\t2500\t2\tres-fire\t\t30\t30\tres-ltng\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac/lvl\t16\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nIratha's Cord\tIratha's Finery\ttbl\tHeavy Belt\t7\t21\t15\tlgry\tlgry\t\t\t\t\t\t5\t2500\t2\tac\t\t25\t25\tdmg-min\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdex\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nIsenhart's Lightbrand\tIsenhart's Armory\tbsd\tBroad Sword\t7\t11\t8\tlgld\tlgld\t\t\t\t\t\t5\t2500\t2\tdmg-min\t\t10\t10\tswing2\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt/lvl\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nIsenhart's Parry\tIsenhart's Armory\tgts\tGothic Shield\t7\t11\t8\tlgld\tlgld\t\t\t\t\t\t5\t2500\t2\tac\t\t40\t40\tlight-thorns\t\t4\t4\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t8\t8\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nIsenhart's Case\tIsenhart's Armory\tbrs\tBreast Plate\t7\t11\t8\tlgld\tlgld\t\t\t\t\t\t5\t2500\t2\tac\t\t40\t40\tred-mag\t\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac/lvl\t16\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nIsenhart's Horns\tIsenhart's Armory\tfhl\tFull Helm\t7\t11\t8\tlgld\tlgld\t\t\t\t\t\t5\t2500\t2\tdex\t\t6\t6\tred-dmg\t\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t8\t8\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nVidala's Barb\tVidala's Rig\tlbb\tLong Battle Bow\t7\t19\t14\tblac\tblac\t\t\t\t\t\t5\t2500\t2\tltng-min\t\t1\t1\tltng-max\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt/lvl\t16\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nVidala's Fetlock\tVidala's Rig\ttbt\tLight Plated Boots\t7\t19\t14\tblac\tblac\t\t\t\t\t\t5\t2500\t2\tstam\t\t150\t150\tmove3\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t8\t8\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nVidala's Ambush\tVidala's Rig\tlea\tLeather Armor\t7\t19\t14\tblac\tblac\t\t\t\t\t\t5\t2500\t2\tac\t\t50\t50\tdex\t\t11\t11\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-fire\t\t24\t24\t\t\t\t\tac/lvl\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nVidala's Snare\tVidala's Rig\tamu\tAmulet\t7\t19\t14\tblac\tblac\t\t\t\t\t\t5\t2500\t2\thp\t\t15\t15\tres-cold\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tmag%\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nMilabrega's Orb\tMilabrega's Regalia\tkit\tKite Shield\t7\t23\t17\tdblu\tdblu\t\t\t\t\t\t5\t2500\t2\tmag%\t\t20\t20\tac\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\thp\t\t50\t50\t\t\t\t\tac%\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nMilabrega's Rod\tMilabrega's Regalia\twsp\tWar Scepter\t7\t23\t17\tdblu\tdblu\t\t\t\t\t\t5\t2500\t\tpal\t\t1\t1\tdmg%\t\t50\t50\tlight\t\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nMilabrega's Diadem\tMilabrega's Regalia\tcrn\tCrown\t7\t23\t17\tdblu\tdblu\t\t\t\t\t\t5\t2500\t2\thp\t\t15\t15\tmana\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-cold\t\t40\t40\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nMilabrega's Robe\tMilabrega's Regalia\taar\tAncient Armor\t7\t23\t17\tdblu\tdblu\t\t\t\t\t\t5\t2500\t2\tthorns\t\t3\t3\tred-dmg\t\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac%\t\t100\t100\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCathan's Rule\tCathan's Traps\tbst\tBattle Staff\t7\t15\t11\tdgrn\tdgrn\t\t\t\t\t\t5\t2500\t2\tfireskill\t\t1\t1\tfire-max\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tmana\t\t50\t50\t\t\t\t\tres-all\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCathan's Mesh\tCathan's Traps\tchn\tChain Mail\t7\t15\t11\tdgrn\tdgrn\t\t\t\t\t\t5\t2500\t2\tac\t\t15\t15\tease\t\t-50\t-50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tthorns\t\t5\t5\t\t\t\t\tres-fire\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCathan's Visage\tCathan's Traps\tmsk\tMask\t7\t15\t11\tdgrn\tdgrn\t\t\t\t\t\t5\t2500\t2\tmana\t\t20\t20\tres-cold\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac/lvl\t16\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCathan's Sigil\tCathan's Traps\tamu\tAmulet\t7\t15\t11\tdgrn\tdgrn\t\t\t\t\t\t5\t2500\t2\tbalance1\t\t10\t10\tlight-thorns\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt\t\t50\t50\t\t\t\t\tmag%\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCathan's Seal\tCathan's Traps\trin\tRing\t7\t15\t11\tdgrn\tdgrn\t\t\t\t\t\t5\t2500\t2\tlifesteal\t\t6\t6\tred-dmg\t\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tstr\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTancred's Crowbill\tTancred's Battlegear\tmpi\tMilitary Pick\t7\t27\t20\tdgld\tdgld\t\t\t\t\t\t5\t2500\t2\tatt\t\t75\t75\tdmg%\t\t80\t80\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tmana\t\t20\t20\t\t\t\t\tswing2\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTancred's Spine\tTancred's Battlegear\tful\tFull Plate Mail\t7\t27\t20\tdgld\tdgld\t\t\t\t\t\t5\t2500\t2\thp\t\t40\t40\tstr\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac/lvl\t16\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTancred's Hobnails\tTancred's Battlegear\tlbt\tBoots\t7\t27\t20\tdgld\tdgld\t\t\t\t\t\t5\t2500\t2\tregen-stam\t\t25\t25\tdex\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tmove3\t\t30\t30\t\t\t\t\tstr\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTancred's Weird\tTancred's Battlegear\tamu\tAmulet\t7\t27\t20\tdgld\tdgld\t\t\t\t\t\t5\t2500\t2\tred-dmg\t\t2\t2\tred-mag\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tmag%\t\t78\t78\t\t\t\t\tatt\t\t60\t60\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTancred's Skull\tTancred's Battlegear\tbhm\tBone Helm\t7\t27\t20\tdgld\tdgld\t\t\t\t\t\t5\t2500\t2\tdmg%\t\t10\t10\tatt\t\t40\t40\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSigon's Gage\tSigon's Complete Steel\thgl\tGauntlets\t7\t9\t6\twhit\twhit\t\t\t\t\t\t5\t2500\t2\tstr\t\t10\t10\tatt\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tswing3\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSigon's Visor\tSigon's Complete Steel\tghm\tGreat Helm\t7\t9\t6\twhit\twhit\t\t\t\t\t\t5\t2500\t2\tmana\t\t30\t30\tac\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt/lvl\t16\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSigon's Shelter\tSigon's Complete Steel\tgth\tGothic Plate\t7\t9\t6\twhit\twhit\t\t\t\t\t\t5\t2500\t2\tac%\t\t25\t25\tres-ltng\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tthorns\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSigon's Sabot\tSigon's Complete Steel\thbt\tGreaves\t7\t9\t6\twhit\twhit\t\t\t\t\t\t5\t2500\t2\tmove2\t\t20\t20\tres-cold\t\t40\t40\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt\t\t50\t50\t\t\t\t\tmag%\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSigon's Wrap\tSigon's Complete Steel\thbl\tPlated Belt\t7\t9\t6\twhit\twhit\t\t\t\t\t\t5\t2500\t2\tres-fire\t\t20\t20\thp\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac/lvl\t16\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSigon's Guard\tSigon's Complete Steel\ttow\tTower Shield\t7\t9\t6\twhit\twhit\t\t\t\t\t\t5\t2500\t2\tallskills\t\t1\t1\tblock\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nInfernal Cranium\tInfernal Tools\tcap\tCap\t7\t7\t5\tlyel\tlyel\t\t\t\t\t\t5\t2500\t2\tres-all\t\t10\t10\tdmg-to-mana\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac/lvl\t16\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nInfernal Torch\tInfernal Tools\tgwn\tGrim Wand\t7\t7\t5\tlyel\tlyel\t\t\t\t\t\t5\t2500\t2\tdmg-min\t\t8\t8\tnec\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt/lvl\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nInfernal Sign\tInfernal Tools\ttbl\tHeavy Belt\t7\t7\t5\tlyel\tlyel\t\t\t\t\t\t5\t2500\t2\tac\t\t25\t25\thp\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-pois\t\t25\t25\t\t\t\t\thalf-freeze\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nBerserker's Headgear\tBerserker's Garb\thlm\tHelm\t7\t5\t3\tdred\tdred\t\t\t\t\t\t5\t2500\t2\tac\t\t15\t15\tres-fire\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt/lvl\t16\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nBerserker's Hauberk\tBerserker's Garb\tspl\tSplint Mail\t7\t5\t3\tdred\tdred\t\t\t\t\t\t5\t2500\t2\tred-mag\t\t2\t2\tbar\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac/lvl\t24\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nBerserker's Hatchet\tBerserker's Garb\t2ax\tDouble Axe\t7\t5\t3\tdred\tdred\t\t\t\t\t\t5\t2500\t2\tatt%\t\t30\t30\tmanasteal\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdmg%\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nDeath's Hand\tDeath's Disguise\tlgl\tLeather Gloves\t7\t8\t6\tlred\tlred\t\t\t\t\t\t5\t2500\t2\tres-pois\t\t50\t50\tres-pois-len\t\t75\t75\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tswing3\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nDeath's Guard\tDeath's Disguise\tlbl\tSash\t7\t8\t6\tlred\tlred\t\t\t\t\t\t5\t2500\t2\tac\t\t20\t20\tnofreeze\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nDeath's Touch\tDeath's Disguise\twsd\tWar Sword\t7\t8\t6\tlred\tlred\t\t\t\t\t\t5\t2500\t2\tdmg%\t\t25\t25\tlifesteal\t\t4\t4\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdmg-cold\t75\t25\t75\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nAngelic Sickle\tAngelical Raiment\tsbr\tSabre\t7\t17\t12\tlgry\tlgry\t\t\t\t\t\t5\t2500\t2\tatt\t\t75\t75\tdmg-undead\t\t250\t250\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdmg%\t\t75\t75\t\t\t\t\tswing3\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nAngelic Mantle\tAngelical Raiment\trng\tRing Mail\t7\t17\t12\tlgry\tlgry\t\t\t\t\t\t5\t2500\t2\tred-dmg\t\t3\t3\tac%\t\t40\t40\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac\t\t150\t150\t\t\t\t\tres-fire\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nAngelic Halo\tAngelical Raiment\trin\tRing\t3\t17\t12\tlgry\tlgry\t\t\t\t\t\t5\t2500\t2\tregen\t\t6\t6\thp\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt/lvl\t24\t\t\t\t\t\t\tmag%\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nAngelic Wings\tAngelical Raiment\tamu\tAmulet\t7\t17\t12\tlgry\tlgry\t\t\t\t\t\t5\t2500\t2\tlight\t\t3\t3\tdmg-to-mana\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\thp\t\t75\t75\t\t\t\t\tallskills\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nArctic Horn\tArctic Gear\tswb\tShort War Bow\t7\t3\t2\tlgld\tlgld\t\t\t\t\t\t5\t2500\t2\tatt%\t\t20\t20\tdmg%\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt/lvl\t16\t\t\t\t\t\t\tdmg-cold\t75\t20\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nArctic Furs\tArctic Gear\tqui\tQuilted Armor\t7\t3\t2\tlgld\tlgld\t\t\t\t\t\t5\t2500\t2\tac%\t\t275\t325\tres-all\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac/lvl\t24\t\t\t\t\t\t\tres-cold\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nArctic Binding\tArctic Gear\tvbl\tLight Belt\t7\t3\t2\tlgld\tlgld\t\t\t\t\t\t5\t2500\t2\tres-cold\t\t40\t40\tac\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tmag%\t\t40\t40\t\t\t\t\tres-cold\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nArctic Mitts\tArctic Gear\ttgl\tLight Gauntlets\t7\t3\t2\tlgld\tlgld\t\t\t\t\t\t5\t2500\t2\thp\t\t20\t20\tswing1\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt\t\t50\t50\t\t\t\t\tdex\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nArcanna's Sign\tArcanna's Tricks\tamu\tAmulet\t1\t20\t15\tblac\tblac\t\t\t\t\t\t5\t2500\t2\tmana\t\t15\t15\tregen-mana\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tmag%\t\t50\t50\t\t\t\t\tres-fire\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nArcanna's Deathwand\tArcanna's Tricks\twst\tWar Staff\t7\t20\t15\tblac\tblac\t\t\t\t\t\t5\t2500\t2\tsor\t\t1\t1\tdeadly\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tmana\t\t50\t50\t\t\t\t\tregen-mana\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nArcanna's Head\tArcanna's Tricks\tskp\tSkull Cap\t7\t20\t15\tblac\tblac\t\t\t\t\t\t5\t2500\t2\tregen\t\t4\t4\tthorns\t\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac/lvl\t24\t\t\t\t\t\t\tres-ltng\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nArcanna's Flesh\tArcanna's Tricks\tltp\tLight Plate\t7\t20\t15\tblac\tblac\t\t\t\t\t\t5\t2500\t2\tlight\t\t2\t2\tred-dmg\t\t3\t3\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac\t\t100\t100\t\t\t\t\tenr\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nExpansion\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\r\nNatalya's Totem\tNatalya's Odium\txh9\tGrim Helm\t7\t22\t59\tdgry\tdgry\t\t\t\t\t\t5\t5000\t\tac\t\t135\t175\tdex\t\t20\t30\tstr\t\t10\t20\tres-all\t\t10\t20\tred-mag\t\t3\t3\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nNatalya's Mark\tNatalya's Odium\t7qr\tScissors Suwayyah\t7\t22\t79\tdgry\tdgry\t\t\t\t\t\t5\t5000\t\tswing3\t\t40\t40\tdmg%\t\t200\t200\tignore-ac\t\t1\t1\tdmg-cold\t100\t50\t50\tdmg-fire\t\t12\t17\tdmg-undead\t\t200\t200\tdmg-demon\t\t200\t200\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nNatalya's Shadow\tNatalya's Odium\tucl\tLoricated Mail\t7\t22\t73\tdgry\tdgry\t\t\t\t\t\t5\t5000\t\tac\t\t150\t225\thp/lvl\t8\t\t\tskilltab\t19\t2\t2\tres-pois-len\t\t75\t75\tres-pois\t\t25\t25\tsock\t\t1\t3\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nNatalya's Soul\tNatalya's Odium\txmb\tMesh Boots\t7\t22\t25\tdgry\tdgry\t\t\t\t\t\t5\t5000\t\tac\t\t75\t125\tmove3\t\t40\t40\tregen-stam/lvl\t2\t\t\tdur\t\t50\t50\tres-cold\t\t15\t25\tres-ltng\t\t15\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nAldur's Stony Gaze\tAldur's Watchtower\tdr8\tHunter's Guise\t7\t29\t36\toran\toran\t\t\t\t\t\t5\t5000\t2\tac\t\t90\t90\tregen-mana\t\t17\t17\tlight\t\t5\t5\tbalance3\t\t25\t25\tres-cold\t\t40\t50\tsock\t\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\tenr\t\t15\t15\t\t\t\t\tenr\t\t15\t15\t\t\t\t\tenr\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nAldur's Deception\tAldur's Watchtower\tuul\tShadow Plate\t7\t29\t76\toran\toran\t\t\t\t\t\t5\t5000\t2\tac\t\t300\t300\tskilltab\t16\t1\t1\tstr\t\t20\t20\tdex\t\t15\t15\tres-ltng\t\t40\t50\tease\t\t-50\t-50\tskilltab\t17\t1\t1\t\t\t\t\t\t\t\t\tvit\t\t15\t15\t\t\t\t\tvit\t\t15\t15\t\t\t\t\tvit\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nAldur's Gauntlet\tAldur's Watchtower\t9mt\tJagged Star\t7\t29\t42\toran\toran\t\t\t\t\t\t5\t5000\t2\tdmg-norm\t\t40\t62\tdmg-ltng\t\t50\t75\tlifesteal\t\t10\t10\tswing3\t\t30\t30\tdmg-demon\t\t200\t200\tmanasteal\t\t5\t5\tsock\t\t2\t5\t\t\t\t\t\t\t\t\tstr\t\t15\t15\t\t\t\t\tstr\t\t15\t15\t\t\t\t\tstr\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nAldur's Advance\tAldur's Watchtower\txtb\tBattle Boots\t7\t29\t45\toran\toran\t\t\t\t\t\t5\t5000\t2\tindestruct\t\t1\t1\tregen-stam\t\t32\t32\thp\t\t50\t50\tdmg-to-mana\t\t10\t10\tmove3\t\t40\t40\tstam\t\t180\t180\tres-fire\t\t40\t50\t\t\t\t\t\t\t\t\tdex\t\t15\t15\t\t\t\t\tdex\t\t15\t15\t\t\t\t\tdex\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nImmortal King's Will\tImmortal King\tba5\tAvenger Guard\t7\t37\t47\tlgry\tlgry\t\t\t\t\t\t5\t5000\t\tac\t\t125\t125\tgold%\t\t37\t37\tskilltab\t14\t2\t2\tlight\t\t4\t4\tmag%\t\t25\t40\tsock\t\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nImmortal King's Soul Cage \tImmortal King\tuar\tSacred Armor\t7\t37\t76\tlgry\tlgry\t\t\t\t\t\t5\t5000\t2\tac\t\t400\t400\tgethit-skill\t52\t5\t5\tskilltab\t12\t2\t2\tres-pois\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tbalance2\t\t25\t25\t\t\t\t\tres-cold\t\t40\t40\t\t\t\t\tres-fire\t\t40\t40\t\t\t\t\tres-ltng\t\t40\t40\t\t\t\t\tac%\t\t50\t50\t\t\t\t\t0\r\nImmortal King's Detail\tImmortal King\tzhb\tWar Belt\t7\t37\t29\tlgry\tlgry\t\t\t\t\t\t5\t5000\t2\tac\t\t36\t36\tres-fire\t\t28\t28\tres-ltng\t\t31\t31\tstr\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac\t\t105\t105\t\t\t\t\tbalance2\t\t25\t25\t\t\t\t\tac%\t\t100\t100\t\t\t\t\tred-dmg%\t\t20\t20\t\t\t\t\tskilltab\t13\t2\t2\t\t\t\t\t0\r\nImmortal King's Forge\tImmortal King\txhg\tWar Gauntlets\t7\t37\t30\tlgry\tlgry\t\t\t\t\t\t5\t5000\t2\tac\t\t65\t65\tstr\t\t20\t20\tdex\t\t20\t20\tgethit-skill\t38\t12\t4\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tswing2\t\t25\t25\t\t\t\t\tac\t\t120\t120\t\t\t\t\tlifesteal\t\t10\t10\t\t\t\t\tmanasteal\t\t10\t10\t\t\t\t\tfreeze\t\t2\t2\t\t\t\t\t0\r\nImmortal King's Pillar\tImmortal King\txhb\tWar Boots\t7\t37\t31\tlgry\tlgry\t\t\t\t\t\t5\t5000\t2\tac\t\t75\t75\tmove3\t\t40\t40\tatt\t\t110\t110\thp\t\t44\t44\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tmag%\t\t25\t25\t\t\t\t\tskilltab\t12\t2\t2\t\t\t\t\tac\t\t160\t160\t\t\t\t\thalf-freeze\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nImmortal King's Stone Crusher\tImmortal King\t7m7\tOgre Maul\t7\t37\t76\tlgry\tlgry\t\t\t\t\t\t5\t5000\t2\tindestruct\t\t1\t1\tswing3\t\t40\t40\tdmg-demon\t\t200\t200\tdmg-undead\t\t200\t200\tcrush\t\t35\t40\tdmg%\t\t200\t200\tsock\t\t2\t2\t\t\t\t\t\t\t\t\tdmg-fire\t\t211\t397\t\t\t\t\tdmg-ltng\t\t7\t477\t\t\t\t\tdmg-cold\t150\t127\t364\t\t\t\t\tdmg-pois\t150\t349\t349\t\t\t\t\tdmg-mag\t\t250\t361\t\t\t\t\t0\r\nTal Rasha's Fire-Spun Cloth\tTal Rasha's Wrappings\tzmb\tMesh Belt\t7\t26\t53\tdpur\tdpur\t\t\t\t\t\t5\t5000\t2\tease\t\t-20\t-20\tmana\t\t30\t30\tdex\t\t20\t20\tdmg-to-mana\t\t37\t37\tmag%\t\t10\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac\t\t60\t60\t\t\t\t\tcast2\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTal Rasha's Adjudication\tTal Rasha's Wrappings\tamu\tAmulet\t1\t26\t67\tdpur\tdpur\t\t\t\t\t\t5\t5000\t2\tres-ltng\t\t33\t33\tsor\t\t2\t2\thp\t\t50\t50\tdmg-ltng\t\t3\t32\tmana\t\t42\t42\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tcast2\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTal Rasha's Lidless Eye\tTal Rasha's Wrappings\toba\tSwirling Crystal\t7\t26\t65\tdpur\tdpur\t\t\t\t\t\t5\t5000\t2\thp\t\t57\t57\tmana\t\t77\t77\tenr\t\t10\t10\tcast3\t\t20\t20\tskill\tFire Mastery\t1\t2\tskill\tLightning Mastery\t1\t2\tskill\tCold Mastery\t1\t2\t\t\t\t\t\t\t\t\tsor\t\t1\t1\t\t\t\t\tpierce-fire\t\t15\t15\t\t\t\t\tpierce-ltng\t\t15\t15\t\t\t\t\textra-cold\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTal Rasha's Howling Wind\tTal Rasha's Wrappings\tuth\tLacquered Plate\t7\t26\t71\tdpur\tdpur\t\t\t\t\t\t5\t5000\t2\tease\t\t-60\t-60\tred-mag\t\t15\t15\tmag%\t\t88\t88\tres-cold\t\t40\t40\tres-fire\t\t40\t40\tres-ltng\t\t40\t40\tac\t\t400\t400\t\t\t\t\t\t\t\t\tcast2\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTal Rasha's Horadric Crest\tTal Rasha's Wrappings\txsk\tDeath Mask\t7\t26\t66\tdpur\tdpur\t\t\t\t\t\t5\t5000\t\tmana\t\t30\t30\thp\t\t60\t60\tac\t\t45\t45\tres-all\t\t15\t15\tlifesteal\t\t10\t10\tmanasteal\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nGriswold's Valor\tGriswold's Legacy\turn\tCorona\t7\t44\t69\tdgld\tdgld\t\t\t\t\t\t5\t5000\t2\tac%\t\t50\t75\tabs-cold/lvl\t\t2\t2\tsock\t\t2\t2\tease\t\t-40\t-40\tmag%\t\t20\t30\tres-all\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\tskilltab\t10\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nGriswold's Heart\tGriswold's Legacy\txar\tOrnate Plate\t7\t44\t45\tdgld\tdgld\t\t\t\t\t\t5\t5000\t\tac\t\t500\t500\tskilltab\t11\t2\t2\tsock\t\t3\t3\tstr\t\t20\t20\tease\t\t-40\t-40\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nGriswolds's Redemption\tGriswold's Legacy\t7ws\tCaduceus\t7\t44\t53\tdgld\tdgld\t\t\t\t\t\t5\t5000\t2\tdmg%\t\t200\t240\tswing2\t\t40\t40\tdmg-undead\t\t200\t200\tease\t\t-20\t-20\tsock\t\t3\t4\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tskilltab\t9\t2\t2\t\t\t\t\tdmg-norm\t\t10\t20\t\t\t\t\tdmg-norm\t\t10\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nGriswold's Honor\tGriswold's Legacy\tpaf\tVortex Shield\t7\t44\t68\tdgld\tdgld\t\t\t\t\t\t5\t5000\t\tac\t\t108\t108\tsock\t3\t\t\tblock2\t\t65\t65\tblock\t\t20\t20\tres-all\t\t45\t45\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTrang-Oul's Guise\tTrang-Oul's Avatar\tuh9\tBone Visage\t7\t32\t65\tdgld\tdgld\t\t\t\t\t\t5\t5000\t\tac\t\t80\t100\tbalance2\t\t25\t25\tthorns\t\t20\t20\tmana\t\t150\t150\tregen\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTrang-Oul's Scales\tTrang-Oul's Avatar\txul\tChaos Armor\t7\t32\t49\tdyel\tdyel\t\t\t\t\t\t5\t5000\t2\tease\t\t-40\t-40\tac-miss\t\t100\t100\tres-pois\t\t40\t40\tskilltab\t8\t2\t2\tmove3\t\t40\t40\tac%\t\t150\t150\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-ltng\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\tred-dmg%\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTrang-Oul's Wing\tTrang-Oul's Avatar\tne9\tCantor Trophy\t7\t32\t54\tdyel\tdyel\t\t\t\t\t\t5\t5000\t2\tac\t\t125\t125\tstr\t\t25\t25\tdex\t\t15\t15\tres-fire\t\t38\t45\tblock\t\t30\t30\tres-pois\t\t40\t40\tskilltab\t7\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tpierce-pois\t\t25\t25\t\t\t\t\tregen\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTrang-Oul's Claws\tTrang-Oul's Avatar\txmg\tHeavy Bracers\t7\t32\t45\tdyel\tdyel\t\t\t\t\t\t5\t5000\t\tac\t\t30\t30\tcast3\t\t20\t20\tres-cold\t\t30\t30\tskilltab\t6\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\textra-pois\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTrang-Oul's Girth\tTrang-Oul's Avatar\tutc\tTroll Belt\t7\t32\t47\tdyel\tdyel\t\t\t\t\t\t5\t5000\t2\tac\t\t75\t100\tstam\t\t30\t30\tregen\t\t5\t5\thp\t\t66\t66\tnofreeze\t\t1\t1\tease\t\t-40\t-40\tmana\t\t25\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-cold\t\t40\t40\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nM'avina's True Sight\tM'avina's Battle Hymn\tci3\tDiadem\t7\t21\t59\twhit\twhit\t\t\t\t\t\t5\t5000\t2\tac\t\t150\t150\tregen\t\t10\t10\tswing2\t\t30\t30\tmana\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tallskills\t\t1\t1\t\t\t\t\tatt%\t\t50\t50\t\t\t\t\tres-all\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nM'avina's Embrace\tM'avina's Battle Hymn\tuld\tKraken Shell\t7\t21\t70\twhit\twhit\t\t\t\t\t\t5\t5000\t2\tgethit-skill\t55\t10\t3\tease\t\t-30\t-30\tred-mag\t\t5\t12\tskilltab\t1\t2\t2\tac/lvl\t32\t\t\tac\t\t350\t350\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tbalance2\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nM'avina's Icy Clutch\tM'avina's Battle Hymn\txtg\tBattle Gauntlets\t7\t21\t32\twhit\twhit\t\t\t\t\t\t5\t5000\t2\tac\t\t45\t50\tdmg-cold\t150\t6\t18\thalf-freeze\t\t1\t1\tgold%\t\t56\t56\tstr\t\t10\t10\tdex\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdmg-cold\t100\t131\t252\t\t\t\t\textra-cold\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nM'avina's Tenet\tM'avina's Battle Hymn\tzvb\tSharkskin Belt\t7\t21\t45\twhit\twhit\t\t\t\t\t\t5\t5000\t2\tac\t\t50\t50\tmove2\t\t20\t20\tmanasteal\t\t5\t5\tlight\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nM'avina's Caster\tM'avina's Battle Hymn\tamc\tGrand Matron Bow\t7\t21\t70\twhit\twhit\t\t\t\t\t\t5\t5000\t2\tdmg%\t\t188\t188\tswing3\t\t40\t40\tmagicarrow\t\t1\t1\tatt\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdmg-mag\t\t114\t377\t\t\t\t\thit-skill\tNova\t10\t15\t\t\t\t\tskilltab\t0\t2\t2\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTelling of Beads\tThe Disciple\tamu\tAmulet\t1\t39\t30\tlblu\tlblu\t\t\t\t\t\t5\t5000\t\tres-pois\t\t35\t50\tallskills\t\t1\t1\tres-cold\t\t18\t18\tthorns\t\t8\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nLaying of Hands\tThe Disciple\tulg\tBramble Mitts\t7\t39\t63\tlblu\tlblu\t\t\t\t\t\t5\t5000\t\tac\t\t25\t25\tswing2\t\t20\t20\tres-fire\t\t50\t50\tdmg-demon\t\t350\t350\thit-skill\t101\t10\t3\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nRite of Passage\tThe Disciple\txlb\tDemonhide Boots\t7\t39\t29\tlblu\tlblu\t\t\t\t\t\t5\t5000\t\tac\t\t25\t25\tmove3\t\t30\t30\thalf-freeze\t\t1\t1\tstam\t\t15\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSpiritual Custodian\tThe Disciple\tuui\tDusk Shroud\t7\t39\t43\tlblu\tlblu\t\t\t\t\t\t5\t5000\t\tac\t\t305\t415\tres-fire\t\t24\t24\tgethit-skill\t48\t25\t3\tdmg-pois\t50\t125\t175\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCredendum\tThe Disciple\tumc\tMithril Coil\t7\t39\t65\tlblu\tlblu\t\t\t\t\t\t5\t5000\t\tac\t\t50\t50\tstr\t\t10\t10\tdex\t\t10\t10\tres-all\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nDangoon's Teaching\tHeaven's Brethren\t7ma\tReinforced Mace\t7\t55\t68\t\t\t\t\t\t\t\t5\t5000\t\tdmg/lvl\t12\t\t\tswing3\t\t40\t40\thit-skill\t44\t10\t3\tdmg-fire\t\t20\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nHeaven's Taebaek\tHeaven's Brethren\tuts\tWard\t7\t55\t81\t\t\t\t\t\t\t\t5\t5000\t\tac\t\t50\t50\tmana\t\t100\t100\tres-ltng\t\t30\t30\tthorns\t\t30\t30\tindestruct\t\t1\t1\tblock\t\t25\t25\tblock3\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nHaemosu's Adament\tHeaven's Brethren\txrs\tCuirass\t7\t55\t44\t\t\t\t\t\t\t\t5\t5000\t\tac\t\t500\t500\tac-miss\t\t35\t35\thp\t\t75\t75\tac-hth\t\t40\t40\tease\t\t-20\t-20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nOndal's Almighty\tHeaven's Brethren\tuhm\tSpired Helm\t7\t55\t69\t\t\t\t\t\t\t\t5\t5000\t\tac\t\t50\t50\tease\t\t-40\t-40\thit-skill\t72\t10\t3\tstr\t\t10\t10\tdex\t\t15\t15\tbalance3\t\t24\t24\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nGuillaume's Face\tOrphan's Call\txhm\tWinged Helm\t7\t41\t34\tlgry\tlgry\t\t\t\t\t\t5\t5000\t\tac%\t\t120\t120\tbalance3\t\t30\t30\tcrush\t\t35\t35\tdeadly\t\t15\t15\tstr\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nWilhelm's Pride\tOrphan's Call\tztb\tBattle Belt\t7\t41\t42\tlgry\tlgry\t\t\t\t\t\t5\t5000\t\tac%\t\t75\t75\tmanasteal\t\t5\t5\tres-cold\t\t10\t10\tlifesteal\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nMagnus' Skin\tOrphan's Call\txvg\tSharkskin Gloves\t7\t41\t37\tlgry\tlgry\t\t\t\t\t\t5\t5000\t\tac%\t\t50\t50\tres-fire\t\t15\t15\tswing2\t\t20\t20\tlight\t\t3\t3\tatt\t\t100\t100\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nWihtstan's Guard\tOrphan's Call\txml\tRound Shield\t7\t41\t29\tlgry\tlgry\t\t\t\t\t\t5\t5000\t\tac%\t\t175\t175\tblock3\t\t40\t40\tblock\t\t55\t55\thalf-freeze\t\t1\t1\tlight\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nHwanin's Splendor\tHwanin's Majesty\txrn\tGrand Crown\t7\t28\t45\t\t\t\t\t\t\t\t5\t5000\t\tregen\t\t20\t20\tred-mag\t\t10\t10\tres-cold\t\t37\t37\tac%\t\t100\t100\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nHwanin's Refuge\tHwanin's Majesty\txcl\tTigulated Mail\t7\t28\t30\t\t\t\t\t\t\t\t5\t5000\t\tac\t\t200\t200\tres-pois\t\t27\t27\thp\t\t100\t100\tgethit-skill\t42\t10\t3\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nHwanin's Seal\tHwanin's Majesty\tmbl\tBelt\t7\t28\t35\t\t\t\t\t\t\t\t5\t5000\t\tdmg-ltng\t\t3\t33\tnoheal\t\t1\t1\tac/lvl\t12\t\t\tdmg-to-mana\t\t12\t12\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nHwanin's Justice\tHwanin's Majesty\t9vo\tBill\t7\t28\t28\t\t\t\t\t\t\t\t5\t5000\t\tatt\t\t330\t330\tindestruct\t\t1\t1\thit-skill\t45\t10\t3\tswing3\t\t40\t40\tdmg%\t\t200\t200\tdmg-ltng\t\t5\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSazabi's Cobalt Redeemer\tSazabi's Grand Tribute\t7ls\tCryptic Sword\t7\t34\t73\tdblu\tdblu\t\t\t\t\t\t5\t5000\t\tdmg%\t\t150\t150\tdmg-cold\t50\t25\t35\tswing3\t\t40\t40\tdmg-demon\t\t318\t318\tindestruct\t\t1\t1\tdex\t\t15\t15\tstr\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSazabi's Ghost Liberator\tSazabi's Grand Tribute\tupl\tBalrog Skin\t7\t34\t67\tdblu\tdblu\t\t\t\t\t\t5\t5000\t\tac\t\t400\t400\tbalance3\t\t30\t30\tstr\t\t25\t25\tatt-demon\t\t300\t300\thp\t\t50\t75\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSazabi's Mental Sheath\tSazabi's Grand Tribute\txhl\tBasinet\t7\t34\t43\tdblu\tdblu\t\t\t\t\t\t5\t5000\t\tac\t\t100\t100\tallskills\t\t1\t1\tres-fire\t\t15\t20\tres-ltng\t\t15\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nBul-Kathos' Sacred Charge\tBul-Kathos' Children\t7gd\tColossus Blade\t7\t50\t61\tdgrn\tdgrn\t\t\t\t\t\t5\t5000\t\tcrush\t\t35\t35\tres-all\t\t20\t20\tswing2\t\t20\t20\tknock\t\t1\t1\tdmg%\t\t200\t200\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nBul-Kathos' Tribal Guardian\tBul-Kathos' Children\t7wd\tMythical Sword\t7\t50\t54\tdgrn\tdgrn\t\t\t\t\t\t5\t5000\t\tres-fire\t\t50\t50\tdmg-pois\t50\t255\t255\tswing2\t\t20\t20\tstr\t\t20\t20\tdmg%\t\t200\t200\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCow King's Horns\tCow King's Leathers\txap\tWar Hat\t7\t20\t25\t\t\t\t\t\t\t\t5\t5000\t\tac\t\t75\t75\thalf-freeze\t\t1\t1\tdmg-to-mana\t\t35\t35\tthorns\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCow King's Hide\tCow King's Leathers\tstu\tStudded Leather\t7\t20\t18\t\t\t\t\t\t\t\t5\t5000\t\tres-all\t\t18\t18\tac%\t\t60\t60\thp\t\t30\t30\tgethit-skill\t53\t18\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCow King's Hoofs\tCow King's Leathers\tvbt\tHeavy Boots\t7\t20\t13\t\t\t\t\t\t\t\t5\t5000\t\tac\t\t25\t35\tmove3\t\t30\t30\tmag%\t\t25\t25\tdex\t\t20\t20\tdmg-fire\t\t25\t35\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nNaj's Puzzler\tNaj's Ancient Set\t6cs\tElder Staff\t7\t43\t78\t\t\t\t\t\t\t\t5\t5000\t\tenr\t\t35\t35\tdmg%\t\t150\t150\tcharged\t54\t69\t11\tcast3\t\t30\t30\tdmg-ltng\t\t6\t45\tmana\t\t70\t70\tallskills\t\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nNaj's Light Plate\tNaj's Ancient Set\tult\tHellforge Plate\t7\t43\t71\t\t\t\t\t\t\t\t5\t5000\t\tease\t\t-60\t-60\thp\t\t65\t65\tres-all\t\t25\t25\tdmg-to-mana\t\t45\t45\tallskills\t\t1\t1\tac\t\t300\t300\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nNaj's Circlet\tNaj's Ancient Set\tci0\tCirclet\t7\t43\t28\t\t\t\t\t\t\t\t5\t5000\t\tac\t\t75\t75\tdmg-fire\t\t25\t35\tLight\t\t5\t5\tstr\t\t15\t15\tgethit-skill\t53\t12\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nMcAuley's Paragon\tMcAuley's Folly\tcap\tCap\t3\t20\t25\tlpur\tlpur\t\t\t\t\t\t5\t5000\t\tmag%\t\t35\t35\tthorns\t\t8\t8\tac/lvl\t8\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nMcAuley's Riprap\tMcAuley's Folly\tvbt\tHeavy Boots\t7\t20\t20\tlpur\tlpur\t\t\t\t\t\t5\t5000\t\tmove3\t\t40\t40\tatt\t\t100\t100\tstr\t\t5\t5\tdex\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nMcAuley's Taboo\tMcAuley's Folly\tvgl\tHeavy Gloves\t7\t20\t28\tlpur\tlpur\t\t\t\t\t\t5\t5000\t\tac\t\t20\t25\tswing2\t\t20\t20\thp\t\t40\t40\tdmg-pois\t75\t30\t36\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nMcAuley's Superstition\tMcAuley's Folly\tbwn\tBone Wand\t7\t20\t25\tlpur\tlpur\t\t\t\t\t\t5\t5000\t\tdmg%\t2\t75\t75\tmana\t\t25\t25\tmanasteal\t\t8\t8\tcast3\t\t20\t20\tdmg-cold\t50\t25\t75\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0"

/** Canonical 1.13c Sets.txt embedded TSV data. */
export const CANONICAL_SETS_TSV = "index\tname\tversion\tlevel\tPCode2a\tPParam2a\tPMin2a\tPMax2a\tPCode2b\tPParam2b\tPMin2b\tPMax2b\tPCode3a\tPParam3a\tPMin3a\tPMax3a\tPCode3b\tPParam3b\tPMin3b\tPMax3b\tPCode4a\tPParam4a\tPMin4a\tPMax4a\tPCode4b\tPParam4b\tPMin4b\tPMax4b\tPCode5a\tPParam5a\tPMin5a\tPMax5a\tPCode5b\tPParam5b\tPMin5b\tPMax5b\tFCode1\tFParam1\tFMin1\tFMax1\tFCode2\tFParam2\tFMin2\tFMax2\tFCode3\tFParam3\tFMin3\tFMax3\tFCode4\tFParam4\tFMin4\tFMax4\tFCode5\tFParam5\tFMin5\tFMax5\tFCode6\tFParam6\tFMin6\tFMax6\tFCode7\tFParam7\tFMin7\tFMax7\tFCode8\tFParam8\tFMin8\tFMax8\t*eol\r\nCiverb's Vestments\tCiverb's Vestments\t0\t13\tres-fire\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tstr\t0\t15\t15\tdmg-undead\t0\t200\t200\tres-ltng\t0\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nHsarus' Defense\tHsarus' Defense\t0\t4\tthorns\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdmg-max\t0\t5\t5\tnofreeze\t0\t1\t1\tres-ltng\t0\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCleglaw's Brace\tCleglaw's Brace\t0\t6\tac\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tac\t0\t50\t50\tmanasteal\t0\t6\t6\tcrush\t0\t35\t35\tswing2\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nIratha's Finery\tIratha's Finery\t0\t21\tac\t\t50\t50\t\t\t\t\tmove2\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t0\t20\t20\tres-fire-max\t0\t10\t10\tres-cold-max\t0\t10\t10\tres-ltng-max\t0\t10\t10\tres-pois-max\t0\t10\t10\tdex\t0\t15\t15\t\t\t\t\t\t\t\t\t0\r\nIsenhart's Armory\tIsenhart's Armory\t0\t11\tstr\t\t10\t10\t\t\t\t\tdex\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tlifesteal\t0\t5\t5\tres-all\t0\t10\t10\tatt%\t0\t35\t35\tblock\t\t30\t30\tmove2\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nVidala's Rig\tVidala's Rig\t0\t19\tatt\t\t75\t75\t\t\t\t\tdex\t\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdmg-cold\t50\t15\t20\tfreeze\t0\t1\t1\tpierce\t0\t50\t50\tstr\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nMilabrega's Regalia\tMilabrega's Regalia\t0\t23\tatt\t\t75\t75\t\t\t\t\tatt\t\t125\t125\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tlifesteal\t0\t8\t8\tpal\t0\t2\t2\tmanasteal\t0\t10\t10\tres-pois\t0\t15\t15\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nCathan's Traps\tCathan's Traps\t0\t15\tdmg-fire\t\t15\t20\t\t\t\t\tres-ltng\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt\t0\t60\t60\tred-mag\t0\t3\t3\tres-all\t0\t25\t25\tcast1\t0\t10\t10\tmana\t0\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTancred's Battlegear\tTancred's Battlegear\t0\t27\tdmg-ltng\t\t15\t15\t\t\t\t\tlifesteal\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tgold%\t0\t75\t75\tres-all\t0\t10\t10\tslow\t0\t35\t35\tmanasteal\t0\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSigon's Complete Steel\tSigon's Complete Steel\t0\t9\tlifesteal\t\t10\t10\t\t\t\t\tac\t\t100\t100\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-fire\t0\t12\t12\tthorns\t0\t12\t12\tred-dmg\t0\t7\t7\tfire-max\t0\t24\t24\tmana\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nInfernal Tools\tInfernal Tools\t0\t7\tdmg-pois\t80\t25\t25\t\t\t\t\tmana\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt%\t0\t20\t20\tnec\t0\t1\t1\topenwounds\t0\t20\t20\tmanasteal\t\t6\t6\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nBerserker's Garb\tBerserker's Garb\t0\t5\thp\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-pois-len\t0\t75\t75\tpois-min\t0\t16\t16\tpois-max\t0\t32\t32\tpois-len\t0\t75\t75\tac\t\t75\t75\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nDeath's Disguise\tDeath's Disguise\t0\t8\tlifesteal\t\t8\t8\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tatt%\t0\t40\t40\tdmg-min\t0\t10\t10\tres-all\t0\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nAngelical Raiment\tAngelical Raiment\t0\t17\tdex\t\t10\t10\t\t\t\t\tmana\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t0\t25\t25\thalf-freeze\t0\t1\t1\tmag%\t0\t40\t40\tregen-mana\t\t8\t8\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nArctic Gear\tArctic Gear\t0\t3\tstr\t\t5\t5\t\t\t\t\thp\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tcold-min\t0\t6\t6\tcold-max\t0\t14\t14\tcold-len\t0\t100\t100\tnofreeze\t0\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nArcanna's Tricks\tArcanna's Tricks\t0\t20\tmana\t\t25\t25\t\t\t\t\thp\t\t50\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tcast3\t0\t20\t20\tmanasteal\t0\t5\t5\tmana\t0\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nExpansion\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\r\nNatalya's Odium\tNatalya's Odium\t100\t22\tred-mag\t\t15\t15\t\t\t\t\tac\t\t200\t200\t\t\t\t\tres-pois\t\t20\t20\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t50\t50\tass\t\t3\t3\tac\t\t150\t150\tlifesteal\t\t14\t14\tmanasteal\t\t14\t14\tred-dmg%\t\t30\t30\tfade\t\t1\t1\t\t\t\t\t0\r\nAldur's Watchtower\tAldur's Watchtower\t100\t29\tatt%\t\t150\t150\t\t\t\t\tmag%\t\t50\t50\t\t\t\t\tlifesteal\t\t10\t10\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t50\t50\tdru\t\t3\t3\tac\t\t150\t150\tmanasteal\t\t10\t10\tmana\t\t150\t150\tdmg%\t\t350\t350\tstate\tfullsetgeneric\t1\t1\t\t\t\t\t0\r\nImmortal King\tImmortal King\t100\t37\tatt\t\t50\t50\t\t\t\t\tatt\t\t75\t75\t\t\t\t\tatt\t\t125\t125\t\t\t\t\tatt\t\t200\t200\t\t\t\t\tres-all\t\t50\t50\tbar\t\t3\t3\thp\t\t150\t150\tred-mag\t\t10\t10\tstate\tfullsetgeneric\t1\t1\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nTal Rasha's Wrappings\tTal Rasha's Wrappings\t100\t26\tregen\t\t10\t10\t\t\t\t\tmag%\t\t65\t65\t\t\t\t\tbalance2\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t50\t50\tsor\t\t3\t3\tac\t\t150\t150\thp\t\t150\t150\tac-miss\t\t50\t50\tstate\tfullsetgeneric\t1\t1\t\t\t\t\t\t\t\t\t0\r\nGriswold's Legacy\tGriswold's Legacy\t100\t44\tstr\t\t20\t20\t\t\t\t\tdex\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t50\t50\tpal\t\t3\t3\tatt\t\t200\t200\thp\t\t150\t150\tstate\tfullsetgeneric\t1\t1\tbalance2\t\t30\t30\t\t\t\t\t\t\t\t\t0\r\nTrang-Oul's Avatar\tTrang-Oul's Avatar\t100\t32\tregen-mana\t\t15\t15\toskill\tFire Ball\t18\t18\tregen-mana\t\t15\t15\toskill\tFire Wall\t13\t13\tregen-mana\t\t15\t15\toskill\tMeteor\t10\t10\t\t\t\t\t\t\t\t\tres-all\t\t50\t50\tnec\t\t3\t3\tmana\t\t100\t100\tac\t\t200\t200\tstate\tmonsterset\t1\t1\tregen-mana\t\t15\t15\toskill\tFire Mastery\t3\t3\tlifesteal\t\t20\t20\t0\r\nM'avina's Battle Hymn\tM'avina's Battle Hymn\t100\t21\tstr\t\t20\t20\t\t\t\t\tdex\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t50\t50\tama\t\t3\t3\tac\t\t100\t100\tatt\t\t100\t100\tmag%\t\t100\t100\tstate\tfullsetgeneric\t1\t1\t\t\t\t\t\t\t\t\t0\r\nThe Disciple\tThe Disciple\t100\t39\tac\t\t150\t150\t\t\t\t\tdmg-pois\t75\t75\t75\t\t\t\t\tstr\t\t10\t10\t\t\t\t\tdex\t\t10\t10\t\t\t\t\tres-all\t\t50\t50\tallskills\t\t2\t2\tmana\t\t100\t100\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nHeaven's Brethren\tHeaven's Brethren\t100\t55\tregen-stam\t\t50\t50\t\t\t\t\tregen\t\t20\t20\t\t\t\t\tdmg-fire\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t50\t50\tallskills\t\t2\t2\tnofreeze\t\t1\t1\tlight\t\t5\t5\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nOrphan's Call\tOrphan's Call\t100\t41\thp\t\t35\t35\t\t\t\t\tthorns\t\t5\t5\t\t\t\t\tac\t\t100\t100\t\t\t\t\t\t\t\t\t\t\t\t\thp\t\t50\t50\tdex\t\t10\t10\tstr\t\t20\t20\tac\t\t100\t100\tres-all\t\t15\t15\tmag%\t0\t80\t80\t\t\t\t\t\t\t\t\t0\r\nHwanin's Majesty\tHwanin's Majesty\t100\t28\tac\t\t100\t100\t\t\t\t\tac\t\t200\t200\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tallskills\t\t2\t2\tlifesteal\t\t20\t20\tmove3\t\t30\t30\tres-all\t\t30\t30\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nSazabi's Grand Tribute\tSazabi's Grand Tribute\t100\t34\tmove3\t\t40\t40\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tres-all\t\t30\t30\tlifesteal\t\t15\t15\thp%\t\t27\t27\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0\r\nBul-Kathos' Children\tBul-Kathos' Children\t100\t50\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tdmg-fire\t\t20\t20\tallskills\t\t2\t2\tatt\t\t200\t200\tac\t\t25\t25\tdmg-undead\t\t200\t200\tdmg-demon\t\t200\t200\t\t\t\t\t\t\t\t\t0\r\nCow King's Leathers\tCow King's Leathers\t100\t20\tres-pois\t\t25\t25\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tstam\t\t100\t100\tstr\t\t20\t20\tgold%\t\t100\t100\tmag%\t\t100\t100\tgethit-skill\t42\t25\t5\tswing3\t\t30\t30\t\t\t\t\t\t\t\t\t0\r\nNaj's Ancient Set\tNaj's Ancient Set\t100\t43\tac\t\t175\t175\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tallskills\t\t1\t1\tregen\t\t10\t10\tdex\t\t15\t15\tres-all\t\t50\t50\tstr\t\t20\t20\tmana\t\t100\t100\t\t\t\t\t\t\t\t\t0\r\nMcAuley's Folly\tMcAuley's Folly\t100\t20\tac\t\t50\t50\t\t\t\t\tatt\t\t75\t75\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tallskills\t\t1\t1\tmag%\t\t50\t50\tmana\t\t50\t50\tlifesteal\t\t4\t4\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t0"

/** Pre-parsed canonical 1.13c SetItemTable. */
export const CANONICAL_SET_ITEMS_TABLE: SetItemTable = parseSetItemsTable(
  parseTable(new TextEncoder().encode(CANONICAL_SET_ITEMS_TSV.trim())),
)

/** Pre-parsed canonical 1.13c SetTable. */
export const CANONICAL_SETS_TABLE: SetTable = parseSetsTable(
  parseTable(new TextEncoder().encode(CANONICAL_SETS_TSV.trim())),
  CANONICAL_SET_ITEMS_TABLE,
)
