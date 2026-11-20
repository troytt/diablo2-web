import { describe, expect, test } from 'vitest'
import * as fs from 'node:fs'
import {
  CANONICAL_SET_ITEMS_TABLE,
  CANONICAL_SET_ITEMS_TSV,
  CANONICAL_SETS_TABLE,
  CANONICAL_SETS_TSV,
  parseSetItemsTable,
  parseSetsTable,
  resolveActiveSetBonuses,
  loadSetData,
  parseParam,
  type SetItem,
  type SetDefinition,
} from '../src/common/items/set-items.ts'
import { parseTable } from '../src/common/world/acts.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { fileSource } from '../src/baker/io/file-source.ts'

const MPQ_DIR = 'samples/d2'
const hasMpqs = fs.existsSync(`${MPQ_DIR}/d2data.mpq`) && fs.existsSync(`${MPQ_DIR}/d2exp.mpq`)

describe('SetItems.txt & Sets.txt Table Structure & Parsing (Issue #98)', () => {
  test('CANONICAL_SET_ITEMS_TABLE loads exactly 127 rows', () => {
    expect(CANONICAL_SET_ITEMS_TABLE.length).toBe(127)
    expect(CANONICAL_SET_ITEMS_TABLE.entries.length).toBe(127)
    expect(CANONICAL_SET_ITEMS_TABLE.rows.length).toBe(127)
  })

  test('CANONICAL_SETS_TABLE loads exactly 32 rows', () => {
    expect(CANONICAL_SETS_TABLE.length).toBe(32)
    expect(CANONICAL_SETS_TABLE.entries.length).toBe(32)
    expect(CANONICAL_SETS_TABLE.rows.length).toBe(32)
  })

  test('Preservation of row indices 0..126 matches .d2s setId specification', () => {
    for (let index = 0; index < 127; index++) {
      const entry = CANONICAL_SET_ITEMS_TABLE.entries[index]!
      expect(entry.id).toBe(index)
      expect(CANONICAL_SET_ITEMS_TABLE.get(index)?.id).toBe(index)
      expect(CANONICAL_SET_ITEMS_TABLE.getById(index)?.id).toBe(index)
      expect(CANONICAL_SET_ITEMS_TABLE[index]?.id).toBe(index)
    }
  })

  test('All SetItems reference valid sets in Sets.txt (0 dangling references)', () => {
    const validSetKeys = new Set(CANONICAL_SETS_TABLE.entries.map(s => s.index.trim().toLowerCase()))
    expect(validSetKeys.size).toBe(32)

    for (const item of CANONICAL_SET_ITEMS_TABLE.entries) {
      const setRef = item.set.trim().toLowerCase()
      expect(validSetKeys.has(setRef), `SetItem "${item.index}" references unknown set "${item.set}"`).toBe(true)
      const setDef = CANONICAL_SETS_TABLE.get(item.set)
      expect(setDef, `Lookup for set "${item.set}" returned undefined`).toBeDefined()
    }
  })

  test('Case-insensitive and trimmed lookups work on both tables', () => {
    const civerbWard = CANONICAL_SET_ITEMS_TABLE.get("civerb's ward")
    expect(civerbWard).toBeDefined()
    expect(civerbWard?.index).toBe("Civerb's Ward")

    const civerbVest = CANONICAL_SETS_TABLE.get("civerb's vestments")
    expect(civerbVest).toBeDefined()
    expect(civerbVest?.index).toBe("Civerb's Vestments")

    // Handling trailing space on Immortal King's Soul Cage
    const ikCageWithSpace = CANONICAL_SET_ITEMS_TABLE.get("Immortal King's Soul Cage ")
    const ikCageWithoutSpace = CANONICAL_SET_ITEMS_TABLE.get("Immortal King's Soul Cage")
    expect(ikCageWithSpace).toBeDefined()
    expect(ikCageWithoutSpace).toBeDefined()
    expect(ikCageWithSpace).toBe(ikCageWithoutSpace)
  })

  test('Table iterable protocol works correctly', () => {
    let itemCount = 0
    for (const item of CANONICAL_SET_ITEMS_TABLE) {
      expect(item.id).toBe(itemCount)
      itemCount++
    }
    expect(itemCount).toBe(127)

    let setCount = 0
    for (const setDef of CANONICAL_SETS_TABLE) {
      expect(setDef.index).toBeDefined()
      setCount++
    }
    expect(setCount).toBe(32)
  })

  test('Table getBySet returns all member items for a set', () => {
    const civerbItems = CANONICAL_SET_ITEMS_TABLE.getBySet("Civerb's Vestments")
    expect(civerbItems.length).toBe(3)
    const names = civerbItems.map(i => i.index)
    expect(names).toEqual(["Civerb's Ward", "Civerb's Icon", "Civerb's Cudgel"])

    const sigonItems = CANONICAL_SET_ITEMS_TABLE.getBySet("Sigon's Complete Steel")
    expect(sigonItems.length).toBe(6)
  })

  test('Sets.txt items are correctly linked to SetItems', () => {
    const civerb = CANONICAL_SETS_TABLE.get("Civerb's Vestments")!
    expect(civerb.items).toBeDefined()
    expect(civerb.items?.length).toBe(3)
    expect(civerb.items).toEqual(["Civerb's Ward", "Civerb's Icon", "Civerb's Cudgel"])

    const sigon = CANONICAL_SETS_TABLE.get("Sigon's Complete Steel")!
    expect(sigon.items?.length).toBe(6)
  })
})

describe('Sample SetItem & Set Definitions (Issue #98)', () => {
  test("Civerb's Ward (addFunc=1) field values", () => {
    const ward = CANONICAL_SET_ITEMS_TABLE.get("Civerb's Ward")!
    expect(ward).toBeDefined()
    expect(ward.id).toBe(0)
    expect(ward.index).toBe("Civerb's Ward")
    expect(ward.set).toBe("Civerb's Vestments")
    expect(ward.item).toBe('lrg')
    expect(ward.rarity).toBe(7)
    expect(ward.lvl).toBe(13)
    expect(ward.levelreq).toBe(9)
    expect(ward.chrtransform).toBe('lyel')
    expect(ward.invtransform).toBe('lyel')
    expect(ward.costMult).toBe(5)
    expect(ward.costAdd).toBe(2500)
    expect(ward.addFunc).toBe(1)

    // Base props: ac=15, block=15
    expect(ward.props.length).toBe(2)
    expect(ward.props[0]).toEqual({ code: 'ac', min: 15, max: 15 })
    expect(ward.props[1]).toEqual({ code: 'block', min: 15, max: 15 })

    // Partial aprops: aprop1a=mana (21..22), aprop2a=res-pois (25..26)
    expect(ward.aprops.length).toBe(2)
    expect(ward.aprops[0]).toEqual({ threshold: 1, slot: 'a', code: 'mana', min: 21, max: 22 })
    expect(ward.aprops[1]).toEqual({ threshold: 2, slot: 'a', code: 'res-pois', min: 25, max: 26 })
  })

  test("Civerb's Icon (addFunc=2) field values", () => {
    const icon = CANONICAL_SET_ITEMS_TABLE.get("Civerb's Icon")!
    expect(icon).toBeDefined()
    expect(icon.id).toBe(1)
    expect(icon.index).toBe("Civerb's Icon")
    expect(icon.set).toBe("Civerb's Vestments")
    expect(icon.item).toBe('amu')
    expect(icon.rarity).toBe(7)
    expect(icon.lvl).toBe(13)
    expect(icon.levelreq).toBe(9)
    expect(icon.addFunc).toBe(2)

    // Base props: regen-mana=40, regen=4
    expect(icon.props.length).toBe(2)
    expect(icon.props[0]).toEqual({ code: 'regen-mana', min: 40, max: 40 })
    expect(icon.props[1]).toEqual({ code: 'regen', min: 4, max: 4 })

    // Partial aprops: aprop1a=res-cold (25..25), aprop2a=ac (25..25)
    expect(icon.aprops.length).toBe(2)
    expect(icon.aprops[0]).toEqual({ threshold: 1, slot: 'a', code: 'res-cold', min: 25, max: 25 })
    expect(icon.aprops[1]).toEqual({ threshold: 2, slot: 'a', code: 'ac', min: 25, max: 25 })
  })

  test("Civerb's Vestments set definition values", () => {
    const vestments = CANONICAL_SETS_TABLE.get("Civerb's Vestments")!
    expect(vestments).toBeDefined()
    expect(vestments.index).toBe("Civerb's Vestments")
    expect(vestments.name).toBe("Civerb's Vestments")
    expect(vestments.version).toBe(0)
    expect(vestments.level).toBe(13)

    // Partial set codes: PCode2a = res-fire (15..15)
    expect(vestments.pCodes.length).toBe(1)
    expect(vestments.pCodes[0]).toEqual({ threshold: 2, slot: 'a', code: 'res-fire', min: 15, max: 15 })

    // Full set codes: FCode1=str(15), FCode2=dmg-undead(200), FCode3=res-ltng(25)
    expect(vestments.fCodes.length).toBe(3)
    expect(vestments.fCodes[0]).toEqual({ code: 'str', par: 0, min: 15, max: 15 })
    expect(vestments.fCodes[1]).toEqual({ code: 'dmg-undead', par: 0, min: 200, max: 200 })
    expect(vestments.fCodes[2]).toEqual({ code: 'res-ltng', par: 0, min: 25, max: 25 })
  })
})

describe('Set Bonus Resolution: resolveActiveSetBonuses (Issue #98)', () => {
  const ward = CANONICAL_SET_ITEMS_TABLE.get("Civerb's Ward")!
  const vestments = CANONICAL_SETS_TABLE.get("Civerb's Vestments")!

  test('0 pieces worn returns empty resolved bonuses', () => {
    const resolved = resolveActiveSetBonuses(ward, vestments, 0)
    expect(resolved.props.length).toBe(0)
    expect(resolved.aprops.length).toBe(0)
    expect(resolved.pCodes.length).toBe(0)
    expect(resolved.fCodes.length).toBe(0)
    expect(resolved.all.length).toBe(0)
    expect(resolved.isFullSet).toBe(false)
  })

  test('1 piece worn: only individual base item props active', () => {
    const resolved = resolveActiveSetBonuses(ward, vestments, 1)
    expect(resolved.isFullSet).toBe(false)
    expect(resolved.props.length).toBe(2)
    expect(resolved.props.map(p => p.code)).toEqual(['ac', 'block'])
    expect(resolved.aprops.length).toBe(0)
    expect(resolved.pCodes.length).toBe(0)
    expect(resolved.fCodes.length).toBe(0)
    expect(resolved.all.length).toBe(2)
  })

  test('2 pieces worn: base props + aprop1 + PCode2 active', () => {
    const resolved = resolveActiveSetBonuses(ward, vestments, 2)
    expect(resolved.isFullSet).toBe(false)
    expect(resolved.props.length).toBe(2)
    // aprop1 (threshold 1) is active
    expect(resolved.aprops.length).toBe(1)
    expect(resolved.aprops[0]?.code).toBe('mana')
    expect(resolved.aprops[0]?.threshold).toBe(1)

    // PCode2 (threshold 2) is active
    expect(resolved.pCodes.length).toBe(1)
    expect(resolved.pCodes[0]?.code).toBe('res-fire')
    expect(resolved.pCodes[0]?.threshold).toBe(2)

    // Full set not yet active
    expect(resolved.fCodes.length).toBe(0)
    expect(resolved.all.length).toBe(4) // 2 props + 1 aprop + 1 pCode
  })

  test('3 pieces worn (Full Set): base props + all aprops + all PCodes + all FCodes active', () => {
    const resolved = resolveActiveSetBonuses(ward, vestments, 3)
    expect(resolved.isFullSet).toBe(true)
    expect(resolved.props.length).toBe(2)

    // Both aprop1 and aprop2 are active
    expect(resolved.aprops.length).toBe(2)
    expect(resolved.aprops.map(a => a.code)).toEqual(['mana', 'res-pois'])

    // PCode2 is active
    expect(resolved.pCodes.length).toBe(1)
    expect(resolved.pCodes[0]?.code).toBe('res-fire')

    // Full set bonuses (3 FCodes) are active
    expect(resolved.fCodes.length).toBe(3)
    expect(resolved.fCodes.map(f => f.code)).toEqual(['str', 'dmg-undead', 'res-ltng'])

    // Total active: 2 + 2 + 1 + 3 = 8
    expect(resolved.all.length).toBe(8)
  })

  test("6-piece set progression: Sigon's Complete Steel", () => {
    const gage = CANONICAL_SET_ITEMS_TABLE.get("Sigon's Gage")!
    const sigonSet = CANONICAL_SETS_TABLE.get("Sigon's Complete Steel")!
    expect(sigonSet.items?.length).toBe(6)

    // 1 piece: props only
    const res1 = resolveActiveSetBonuses(gage, sigonSet, 1)
    expect(res1.isFullSet).toBe(false)
    expect(res1.props.map(p => p.code)).toEqual(['str', 'att'])
    expect(res1.aprops.length).toBe(0)
    expect(res1.pCodes.length).toBe(0)
    expect(res1.fCodes.length).toBe(0)

    // 2 pieces: props + aprop1 (swing3) + PCode2 (lifesteal)
    const res2 = resolveActiveSetBonuses(gage, sigonSet, 2)
    expect(res2.isFullSet).toBe(false)
    expect(res2.aprops.map(a => a.code)).toEqual(['swing3'])
    expect(res2.pCodes.map(p => p.code)).toEqual(['lifesteal'])
    expect(res2.fCodes.length).toBe(0)

    // 3 pieces: props + aprop1 + PCode2 + PCode3 (ac)
    const res3 = resolveActiveSetBonuses(gage, sigonSet, 3)
    expect(res3.isFullSet).toBe(false)
    expect(res3.aprops.map(a => a.code)).toEqual(['swing3'])
    expect(res3.pCodes.map(p => p.code)).toEqual(['lifesteal', 'ac'])
    expect(res3.fCodes.length).toBe(0)

    // 4 pieces: same partials, not full set
    const res4 = resolveActiveSetBonuses(gage, sigonSet, 4)
    expect(res4.isFullSet).toBe(false)
    expect(res4.fCodes.length).toBe(0)

    // 5 pieces: same partials, not full set
    const res5 = resolveActiveSetBonuses(gage, sigonSet, 5)
    expect(res5.isFullSet).toBe(false)
    expect(res5.fCodes.length).toBe(0)

    // 6 pieces (Full Set): props + aprop1 + PCode2 + PCode3 + 5 FCodes
    const res6 = resolveActiveSetBonuses(gage, sigonSet, 6)
    expect(res6.isFullSet).toBe(true)
    expect(res6.aprops.map(a => a.code)).toEqual(['swing3'])
    expect(res6.pCodes.map(p => p.code)).toEqual(['lifesteal', 'ac'])
    expect(res6.fCodes.map(f => f.code)).toEqual(['res-fire', 'thorns', 'red-dmg', 'fire-max', 'mana'])
    expect(res6.all.length).toBe(2 + 1 + 2 + 5) // 10
  })
})

describe('Parser Overloads & Helpers (Issue #98)', () => {
  test('parseParam helper handles numbers and strings', () => {
    expect(parseParam(undefined)).toBeUndefined()
    expect(parseParam('')).toBeUndefined()
    expect(parseParam('   ')).toBeUndefined()
    expect(parseParam('10')).toBe(10)
    expect(parseParam('-5')).toBe(-5)
    expect(parseParam('Nova')).toBe('Nova')
    expect(parseParam('Fire Mastery')).toBe('Fire Mastery')
  })

  test('parseSetItemsTable accepts string, Uint8Array, and D2Table', () => {
    const fromString = parseSetItemsTable(CANONICAL_SET_ITEMS_TSV)
    expect(fromString.length).toBe(127)

    const fromBytes = parseSetItemsTable(new TextEncoder().encode(CANONICAL_SET_ITEMS_TSV.trim()))
    expect(fromBytes.length).toBe(127)

    const fromTable = parseSetItemsTable(parseTable(new TextEncoder().encode(CANONICAL_SET_ITEMS_TSV.trim())))
    expect(fromTable.length).toBe(127)
  })

  test('parseSetsTable accepts string, Uint8Array, and D2Table', () => {
    const fromString = parseSetsTable(CANONICAL_SETS_TSV)
    expect(fromString.length).toBe(32)

    const fromBytes = parseSetsTable(new TextEncoder().encode(CANONICAL_SETS_TSV.trim()))
    expect(fromBytes.length).toBe(32)

    const fromTable = parseSetsTable(parseTable(new TextEncoder().encode(CANONICAL_SETS_TSV.trim())))
    expect(fromTable.length).toBe(32)
  })
})

describe('Integration: loadSetData from Mounted MPQ Archives (Issue #98)', () => {
  test('loads SetItems.txt and Sets.txt directly from 1.13c MPQs if available', async () => {
    if (!hasMpqs) {
      console.log('Skipping MPQ integration test: samples/d2 MPQ files not present in worktree')
      return
    }

    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      const p = `${MPQ_DIR}/${name}`
      if (fs.existsSync(p)) {
        archives.add(name, await MpqArchive.open(await fileSource(p)))
      }
    }

    const { items, sets } = await loadSetData(archives)

    expect(items.length).toBe(127)
    expect(sets.length).toBe(32)

    // Check 0 dangling references
    for (const item of items) {
      expect(sets.get(item.set), `SetItem "${item.index}" references missing set "${item.set}"`).toBeDefined()
    }

    // Check linkItems
    const civerb = sets.get("Civerb's Vestments")!
    expect(civerb.items).toEqual(["Civerb's Ward", "Civerb's Icon", "Civerb's Cudgel"])

    const sigon = sets.get("Sigon's Complete Steel")!
    expect(sigon.items?.length).toBe(6)

    // Check bonus resolution with MPQ data
    const ward = items.get("Civerb's Ward")!
    const fullBonus = resolveActiveSetBonuses(ward, civerb, 3)
    expect(fullBonus.isFullSet).toBe(true)
    expect(fullBonus.fCodes.length).toBe(3)
  })
})
