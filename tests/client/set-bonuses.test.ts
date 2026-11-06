/**
 * Diablo II v1.13c set bonuses (#752, PROJECT.md rules 18 and 23).
 *
 *  - Decoded item-specific set lists keep their 5-bit mask index (D2MOO `Items.cpp` set-list
 *    decode/encode), so `add func` gating can be evaluated.
 *  - `computeSetBonusStats` gates the decoded lists per SetItems.txt `add func` (D2MOO `Items.cpp`
 *    `sub_6FDA4380`) and adds the Sets.txt partial/full bonuses (`ItemMods.cpp`
 *    `ITEMMODS_UpdateFullSetBoni`). Only body locations 1..10 count (rule 23).
 *
 * Fixture rows are the embedded 1.13c SetItems.txt / Sets.txt rows (ids = SetItems.txt row index):
 *  - Civerb's Vestments: 0 Ward lrg (add func 1), 1 Icon amu (add func 2), 2 Cudgel gsc (add func 0);
 *    PCode2a res-fire 15; FCode str 15, dmg-undead 200, res-ltng 25.
 *  - Death's Disguise: 47 Hand lgl (1a swing3 30), 48 Guard lbl, 49 Touch wsd (all add func 2);
 *    PCode2a lifesteal 8; FCode att% 40, dmg-min 10, res-all 25.
 *  - Hsarus' Defense: 3 mbt, 4 buc, 5 mbl; PCode2a thorns 5; FCode dmg-max 5, nofreeze 1, res-ltng 25.
 *  - Orphan's Call: 104 xhm, 105 ztb, 106 xvg, 107 xml; PCode2a hp 35, 3a thorns 5, 4a ac 100;
 *    FCode hp 50, dex 10, str 20, ac 100, res-all 15, mag% 80.
 *  - Aldur's Watchtower: 66 dr8, 67 uul, 68 9mt, 69 xtb; PCode2a att% 150, 3a mag% 50, 4a lifesteal 10;
 *    FCode res-all 50, dru 3, ac 150, manasteal 10, mana 150, dmg% 350, state fullsetgeneric.
 *  - Cow King's Leathers: 117 xap, 118 stu, 119 vbt (add func 0); PCode2a res-pois 25;
 *    FCode stam 100, str 20, gold% 100, mag% 100, gethit-skill 42 (25/5), swing3 30.
 *  - Arcanna's Tricks: 58 amu, 59 wst, 60 skp, 61 ltp; PCode2a mana 25, 3a hp 50;
 *    FCode cast3 20, manasteal 5, mana 25.
 *  - Trang-Oul's Avatar: 85 uh9, 86 xul (add func 2; aprop2a res-ltng 50, aprop4a red-dmg% 25), 87 ne9,
 *    88 xmg, 89 utc; PCode2b/3b/4b oskill Fire Ball 18 / Fire Wall 13 / Meteor 10; FCode7 oskill
 *    Fire Mastery 3.
 */
import { describe, expect, it, vi } from 'vitest'
import { AURA_FANATIC_OVERLAY_META, OVERLAY_METAS } from '../../src/client/render/overlays-meta.ts'
import { drawSceneUnitDrawable } from '../../src/client/scene/world-renderer.ts'
import { computeSetBonusStats, SET_BONUS_EXCLUDED_PROPERTY_FUNCS } from '../../src/client/ui-model/set-bonuses.ts'
import { buildSceneDrawables } from '../../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { CANONICAL_113C_OVERLAYS } from '../../src/common/skills/missiles-data.ts'
import { getCanonicalItemDataTables } from '../../src/client/world/item-tables-provider.ts'
import { RAW_SET_ITEMS } from '../../src/common/data/canonical-drop-data.ts'
import { RAW_ITEM_STAT_COST } from '../../src/common/data/canonical-vendor-data.ts'
import { parseItemStatCostTable } from '../../src/common/items/properties.ts'
import { parseSetItemsTable } from '../../src/common/items/set-items.ts'
import { resolveCharacterAnimSpeedParams } from '../../src/common/units/char-anim-speed.ts'
import { parseTable } from '../../src/common/world/acts.ts'
import { ProtocolError } from '../../src/netproto/core/errors.ts'
import { decodeD2gsItemPacket, encodeD2gsItemPacket } from '../../src/netproto/d2gs/items/item-bitstream.ts'
import { ITEM_FLAG_EQUIPPED, ITEM_FLAG_IDENTIFIED } from '../../src/netproto/d2gs/items/item-types.ts'
import type { ItemData, ItemStat, SetBonusStatList } from '../../src/netproto/domain/ids.ts'

const isc = parseItemStatCostTable(parseTable(new TextEncoder().encode(RAW_ITEM_STAT_COST)))

function statId(name: string): number {
  const rec = isc.getByStat(name)
  if (!rec) throw new Error(`test: ItemStatCost.txt has no stat '${name}'`)
  return rec.id
}

/** Expected stat in internal units (`value` already includes the ItemStatCost ValShift). */
function st(name: string, value: number, param = 0): ItemStat {
  return { statId: statId(name), param, value }
}

/** Shifted value for a ValShift-8 stat (maxhp / maxmana / maxstamina). */
const shift8 = (v: number): number => v << 8

let nextUnitId = 5000

function makeSetItem(
  setItemId: number,
  code: string,
  bodyLoc: number,
  setBonusStats: readonly SetBonusStatList[] = [],
  overrides: Partial<ItemData> = {},
): ItemData {
  const id = nextUnitId++
  const flags = ITEM_FLAG_IDENTIFIED | ITEM_FLAG_EQUIPPED
  return {
    id,
    itemId: id,
    opcode: 0x9c,
    action: 0,
    category: 0,
    flags,
    rawFlags: flags,
    version: 101,
    location: 1,
    container: 'equipment',
    bodyLoc,
    equippedSlot: bodyLoc,
    gridX: 0,
    gridY: 0,
    storePage: 0,
    storagePage: 0,
    worldX: 0,
    worldY: 0,
    x: 0,
    y: 0,
    code,
    rawCode: code.padEnd(4, ' '),
    compact: false,
    simple: false,
    identified: true,
    socketed: false,
    ethereal: false,
    runeword: false,
    personalized: false,
    isEar: false,
    newItem: false,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: true,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    ilvl: 60,
    quality: 5,
    setItemId,
    invWidth: 1,
    invHeight: 1,
    stats: [],
    setBonusStats,
    runewordStats: [],
    ...overrides,
  }
}

describe('decoded set lists keep their 5-bit mask index (D2MOO Items.cpp set-list decode/encode)', () => {
  const tables = getCanonicalItemDataTables()

  it('round-trips sparse indices, including an announced empty list, byte-stably', () => {
    const lists: SetBonusStatList[] = [
      { index: 1, stats: [] },
      { index: 2, stats: [st('coldresist', 25)] },
      { index: 4, stats: [st('armorclass', 25)] },
    ]
    const icon = makeSetItem(1, 'amu', 2, lists)
    const bytes = encodeD2gsItemPacket(icon, tables, { saveFormat: false })
    const decoded = decodeD2gsItemPacket(bytes, tables, { saveFormat: false })
    expect(decoded.quality).toBe(5)
    expect(decoded.setItemId).toBe(1)
    expect(decoded.setBonusStats).toEqual(lists)
    expect(encodeD2gsItemPacket(decoded, tables, { saveFormat: false })).toEqual(bytes)
  })

  it('writes the lists in ascending mask-bit order whatever the input order', () => {
    const icon = makeSetItem(1, 'amu', 2, [
      { index: 3, stats: [st('armorclass', 25)] },
      { index: 0, stats: [st('coldresist', 25)] },
    ])
    const decoded = decodeD2gsItemPacket(encodeD2gsItemPacket(icon, tables, { saveFormat: false }), tables, {
      saveFormat: false,
    })
    expect(decoded.setBonusStats.map((l) => l.index)).toEqual([0, 3])
    expect(decoded.setBonusStats[0]!.stats).toEqual([st('coldresist', 25)])
    expect(decoded.setBonusStats[1]!.stats).toEqual([st('armorclass', 25)])
  })

  it('rejects a list index outside the 5-bit mask and duplicate indices', () => {
    const outOfRange = makeSetItem(1, 'amu', 2, [{ index: 5, stats: [st('coldresist', 25)] }])
    expect(() => encodeD2gsItemPacket(outOfRange, tables, { saveFormat: false })).toThrow(ProtocolError)
    const duplicate = makeSetItem(1, 'amu', 2, [
      { index: 2, stats: [st('coldresist', 25)] },
      { index: 2, stats: [st('armorclass', 25)] },
    ])
    expect(() => encodeD2gsItemPacket(duplicate, tables, { saveFormat: false })).toThrow(ProtocolError)
  })
})

describe('computeSetBonusStats: SetItems.txt add func gating (D2MOO Items.cpp sub_6FDA4380)', () => {
  const wardLists: SetBonusStatList[] = [
    { index: 0, stats: [st('maxmana', shift8(21))] },
    { index: 1, stats: [st('poisonresist', 25)] },
  ]
  const iconLists: SetBonusStatList[] = [
    { index: 0, stats: [st('coldresist', 25)] },
    { index: 1, stats: [st('armorclass', 25)] },
  ]

  it('add func 1 (Civerb\'s Ward): list k is enabled by one specific partner position', () => {
    const ward = makeSetItem(0, 'lrg', 5, wardLists)
    const icon = makeSetItem(1, 'amu', 2, iconLists)
    const cudgel = makeSetItem(2, 'gsc', 4)
    // Ward (position 0): list 0 <-> position 1 (Icon), list 1 <-> position 2 (Cudgel).
    // Icon is add func 2: with 2 pieces only its list 0 is enabled. Sets.txt PCode2a res-fire 15.
    expect(computeSetBonusStats([ward, icon])).toEqual([
      st('maxmana', shift8(21)),
      st('coldresist', 25),
      st('fireresist', 15),
    ])
    expect(computeSetBonusStats([ward, cudgel])).toEqual([st('poisonresist', 25), st('fireresist', 15)])
  })

  it('add func 2: list k needs k + 2 equipped pieces of the set', () => {
    const ward = makeSetItem(0, 'lrg', 5)
    const icon = makeSetItem(1, 'amu', 2, iconLists)
    const cudgel = makeSetItem(2, 'gsc', 4)
    expect(computeSetBonusStats([icon])).toEqual([])
    expect(computeSetBonusStats([icon, ward])).toEqual([st('coldresist', 25), st('fireresist', 15)])
    const full = computeSetBonusStats([icon, ward, cudgel])
    expect(full.slice(0, 2)).toEqual([st('coldresist', 25), st('armorclass', 25)])
  })

  it('add func 2 with sparse lists (Trang-Oul\'s Scales lists 1 and 3 need 3 and 5 pieces)', () => {
    // SetItems.txt Trang-Oul's Scales: aprop2a res-ltng 50 (list 1), aprop4a red-dmg% 25 (list 3).
    const scalesLists: SetBonusStatList[] = [
      { index: 1, stats: [st('lightresist', 50)] },
      { index: 3, stats: [st('damageresist', 25)] },
    ]
    const guise = makeSetItem(85, 'uh9', 1)
    const wing = makeSetItem(87, 'ne9', 5)
    const claws = makeSetItem(88, 'xmg', 10)
    const girth = makeSetItem(89, 'utc', 8)
    const withLists = (others: ItemData[]): ItemStat[] =>
      computeSetBonusStats([makeSetItem(86, 'xul', 3, scalesLists), ...others])
    const withoutLists = (others: ItemData[]): ItemStat[] => computeSetBonusStats([makeSetItem(86, 'xul', 3), ...others])

    expect(withLists([guise])).toEqual(withoutLists([guise]))
    const three = withLists([guise, wing])
    expect(three[0]).toEqual(st('lightresist', 50))
    expect(three.slice(1)).toEqual(withoutLists([guise, wing]))
    const five = withLists([guise, wing, claws, girth])
    expect(five.slice(0, 2)).toEqual([st('lightresist', 50), st('damageresist', 25)])
    expect(five.slice(2)).toEqual(withoutLists([guise, wing, claws, girth]))
  })

  it('Trang-Oul\'s oskills resolve the Skills.txt name to the skill id (func 22)', () => {
    const items = [
      makeSetItem(85, 'uh9', 1),
      makeSetItem(86, 'xul', 3),
      makeSetItem(87, 'ne9', 5),
      makeSetItem(88, 'xmg', 10),
      makeSetItem(89, 'utc', 8),
    ]
    const oskills = (out: ItemStat[]): ItemStat[] => out.filter((s) => s.statId === statId('item_nonclassskill'))
    // Skills.txt: Fire Ball = 47, Fire Wall = 51, Meteor = 56, Fire Mastery = 61.
    // PCode2b/3b/4b: Fire Ball 18 / Fire Wall 13 / Meteor 10; FCode7: oskill Fire Mastery 3.
    expect(oskills(computeSetBonusStats(items.slice(0, 2)))).toEqual([st('item_nonclassskill', 18, 47)])
    expect(oskills(computeSetBonusStats(items.slice(0, 3)))).toEqual([
      st('item_nonclassskill', 18, 47),
      st('item_nonclassskill', 13, 51),
    ])
    expect(oskills(computeSetBonusStats(items.slice(0, 4)))).toEqual([
      st('item_nonclassskill', 18, 47),
      st('item_nonclassskill', 13, 51),
      st('item_nonclassskill', 10, 56),
    ])
    expect(oskills(computeSetBonusStats(items))).toEqual([
      st('item_nonclassskill', 18, 47),
      st('item_nonclassskill', 13, 51),
      st('item_nonclassskill', 10, 56),
      st('item_nonclassskill', 3, 61),
    ])
  })

  it('add func 0 (Civerb\'s Cudgel): its lists are never enabled, even with the full set', () => {
    const ward = makeSetItem(0, 'lrg', 5)
    const icon = makeSetItem(1, 'amu', 2)
    const cudgel = makeSetItem(2, 'gsc', 4, [{ index: 0, stats: [st('strength', 7)] }])
    const out = computeSetBonusStats([ward, icon, cudgel])
    expect(out).not.toContainEqual(st('strength', 7))
  })
})

describe('computeSetBonusStats: Sets.txt partial and full bonuses (ItemMods.cpp ITEMMODS_UpdateFullSetBoni)', () => {
  it('Civerb\'s Vestments: 2 pieces give PCode2a only, 3 pieces add the FCodes', () => {
    const ward = makeSetItem(0, 'lrg', 5)
    const icon = makeSetItem(1, 'amu', 2)
    const cudgel = makeSetItem(2, 'gsc', 4)
    expect(computeSetBonusStats([ward])).toEqual([])
    expect(computeSetBonusStats([ward, icon])).toEqual([st('fireresist', 15)])
    expect(computeSetBonusStats([ward, icon, cudgel])).toEqual([
      st('fireresist', 15),
      st('strength', 15),
      st('item_undeaddamage_percent', 200),
      st('lightresist', 25),
    ])
  })

  it('Orphan\'s Call: values are in internal units and PCode4a of a 4-piece set never applies', () => {
    const face = makeSetItem(104, 'xhm', 1)
    const pride = makeSetItem(105, 'ztb', 8)
    const skin = makeSetItem(106, 'xvg', 10)
    const guard = makeSetItem(107, 'xml', 5)
    expect(computeSetBonusStats([face, pride])).toEqual([st('maxhp', shift8(35))])
    expect(computeSetBonusStats([face, pride, skin])).toEqual([
      st('maxhp', shift8(35)),
      st('item_attackertakesdamage', 5),
    ])
    // nItems is capped at nSetItems - 1 = 3 for the partial loop, so PCode4a (ac 100) is skipped;
    // the armorclass 100 below is FCode4.
    expect(computeSetBonusStats([face, pride, skin, guard])).toEqual([
      st('maxhp', shift8(35)),
      st('item_attackertakesdamage', 5),
      st('maxhp', shift8(50)),
      st('dexterity', 10),
      st('strength', 20),
      st('armorclass', 100),
      st('fireresist', 15),
      st('lightresist', 15),
      st('coldresist', 15),
      st('poisonresist', 15),
      st('item_magicbonus', 80),
    ])
  })

  it('Hsarus\' Defense: dmg-max (func 6) on a non-weapon trigger feeds all three max-damage stats', () => {
    const out = computeSetBonusStats([makeSetItem(3, 'mbt', 9), makeSetItem(4, 'buc', 5), makeSetItem(5, 'mbl', 8)])
    expect(out).toEqual([
      st('item_attackertakesdamage', 5),
      st('maxdamage', 5),
      st('secondary_maxdamage', 5),
      st('item_throw_maxdamage', 5),
      st('item_cannotbefrozen', 1),
      st('lightresist', 25),
    ])
  })

  it('Death\'s Disguise: dmg-min (func 5) on a one-hand weapon trigger only raises mindamage', () => {
    const out = computeSetBonusStats([makeSetItem(47, 'lgl', 10), makeSetItem(48, 'lbl', 8), makeSetItem(49, 'wsd', 4)])
    expect(out).toEqual([
      st('lifedrainmindam', 8),
      st('item_tohit_percent', 40),
      st('mindamage', 10),
      st('fireresist', 25),
      st('lightresist', 25),
      st('coldresist', 25),
      st('poisonresist', 25),
    ])
  })

  it('Aldur\'s Watchtower: class skills (func 21), dmg% (func 7), state fullsetgeneric (func 24, state 175)', () => {
    const out = computeSetBonusStats([
      makeSetItem(66, 'dr8', 1),
      makeSetItem(67, 'uul', 3),
      makeSetItem(68, '9mt', 4),
      makeSetItem(69, 'xtb', 9),
    ])
    expect(SET_BONUS_EXCLUDED_PROPERTY_FUNCS.has(24)).toBe(false)
    expect(out).toEqual([
      st('item_tohit_percent', 150),
      st('item_magicbonus', 50),
      st('fireresist', 50),
      st('lightresist', 50),
      st('coldresist', 50),
      st('poisonresist', 50),
      st('item_addclassskills', 3, 5),
      st('armorclass', 150),
      st('manadrainmindam', 10),
      st('maxmana', shift8(150)),
      st('item_mindamage_percent', 350),
      st('item_maxdamage_percent', 350),
      st('state', 1, 175),
    ])
  })

  it('Cow King\'s Leathers: gethit-skill (func 11) packs level and skill into the param', () => {
    const out = computeSetBonusStats([makeSetItem(117, 'xap', 1), makeSetItem(118, 'stu', 3), makeSetItem(119, 'vbt', 9)])
    // Static Field = skill 42, level 5 (FMax), chance 25 (FMin): param = (5 & 63) + (42 << 6).
    expect(out).toEqual([
      st('poisonresist', 25),
      st('maxstamina', shift8(100)),
      st('strength', 20),
      st('item_goldbonus', 100),
      st('item_magicbonus', 100),
      st('item_skillongethit', 25, 5 + (42 << 6)),
      st('item_fasterattackrate', 30),
    ])
  })
})

describe('computeSetBonusStats: what counts (ITEMS_GetSetItemsMask, PROJECT.md rule 23)', () => {
  const handLists: SetBonusStatList[] = [{ index: 0, stats: [st('item_fasterattackrate', 30)] }]

  it('items at the weapon-switch body locations 11/12 never count, whatever weaponSet says', () => {
    const hand = makeSetItem(47, 'lgl', 10, handLists)
    expect(computeSetBonusStats([hand, makeSetItem(49, 'wsd', 11)])).toEqual([])
    expect(computeSetBonusStats([hand, makeSetItem(49, 'wsd', 12)])).toEqual([])
    expect(computeSetBonusStats([hand, makeSetItem(49, 'wsd', 4)])).toEqual([
      st('item_fasterattackrate', 30),
      st('lifedrainmindam', 8),
    ])
  })

  it('broken, unequipped (bodyLoc 0) and non-set items do not count', () => {
    const hand = makeSetItem(47, 'lgl', 10, handLists)
    expect(computeSetBonusStats([hand, makeSetItem(48, 'lbl', 8, [], { broken: true })])).toEqual([])
    expect(computeSetBonusStats([hand, makeSetItem(48, 'lbl', 0)])).toEqual([])
    expect(computeSetBonusStats([hand, makeSetItem(48, 'lbl', 8, [], { quality: 7 })])).toEqual([])
    expect(computeSetBonusStats([hand, makeSetItem(48, 'lbl', 8, [], { setItemId: undefined })])).toEqual([])
    // A broken set item contributes nothing itself either.
    expect(
      computeSetBonusStats([makeSetItem(47, 'lgl', 10, handLists, { broken: true }), makeSetItem(48, 'lbl', 8)]),
    ).toEqual([])
  })

  it('fails fast on unknown SetItems.txt ids, duplicate items and invalid list indices', () => {
    expect(() => computeSetBonusStats([makeSetItem(9999, 'lgl', 10)])).toThrow(/unknown SetItems\.txt id/)
    const hand = makeSetItem(47, 'lgl', 10)
    expect(() => computeSetBonusStats([hand, hand])).toThrow(/passed twice/)
    expect(() =>
      computeSetBonusStats([makeSetItem(47, 'lgl', 10, [{ index: 5, stats: [st('item_fasterattackrate', 30)] }])]),
    ).toThrow(/invalid set list index/)
  })
})

describe('computeSetBonusStats: every embedded 1.13c set evaluates without unsupported data', () => {
  it('equips 1..n pieces of each of the 32 sets (SetItems.txt file order)', () => {
    const setItems = parseSetItemsTable(parseTable(new TextEncoder().encode(RAW_SET_ITEMS)))
    const bySet = new Map<string, { id: number; code: string }[]>()
    for (const si of setItems.entries) {
      bySet.set(si.set, [...(bySet.get(si.set) ?? []), { id: si.id, code: si.item }])
    }
    expect(bySet.size).toBe(32)
    for (const [setName, rows] of bySet) {
      const items = rows.map((r, i) => makeSetItem(r.id, r.code, i + 1))
      expect(computeSetBonusStats(items.slice(0, 1)), setName).toEqual([])
      for (let n = 2; n < items.length; n++) {
        expect(() => computeSetBonusStats(items.slice(0, n)), `${setName} x${n}`).not.toThrow()
      }
      const full = computeSetBonusStats(items)
      const missingOne = computeSetBonusStats(items.slice(0, items.length - 1))
      expect(full.length, setName).toBeGreaterThan(missingOne.length)
      expect(full.slice(0, missingOne.length), setName).toEqual(missingOne)
    }
  })
})

describe('char-anim-speed: gated set IAS/FCR only counts when the set bonus is active', () => {
  const AMAZON = 0

  it('item-specific set IAS (Death\'s Hand list 0, add func 2) needs a second counted piece', () => {
    const handLists: SetBonusStatList[] = [{ index: 0, stats: [st('item_fasterattackrate', 30)] }]
    const iasFor = (equipment: ItemData[]): number =>
      resolveCharacterAnimSpeedParams(AMAZON, 'a1', { equipment, setBonusStats: computeSetBonusStats(equipment) })
        .itemIas
    const hand = (): ItemData => makeSetItem(47, 'lgl', 10, handLists)
    expect(iasFor([hand()])).toBe(0)
    expect(iasFor([hand(), makeSetItem(49, 'wsd', 4)])).toBe(30)
    // Rule 23: the same sword on the inactive weapon set (body loc 11) does not activate the list.
    expect(iasFor([hand(), makeSetItem(49, 'wsd', 11)])).toBe(0)
    // The raw decoded lists on the items are never summed without the gated source.
    expect(resolveCharacterAnimSpeedParams(AMAZON, 'a1', { equipment: [hand(), makeSetItem(49, 'wsd', 4)] }).itemIas).toBe(0)
  })

  it('Sets.txt full-set IAS (Cow King\'s swing3 30) and FCR (Arcanna\'s cast3 20)', () => {
    const cow = [makeSetItem(117, 'xap', 1), makeSetItem(118, 'stu', 3), makeSetItem(119, 'vbt', 9)]
    const ias = (equipment: ItemData[]): number =>
      resolveCharacterAnimSpeedParams(AMAZON, 'a1', { equipment, setBonusStats: computeSetBonusStats(equipment) })
        .itemIas
    expect(ias(cow.slice(0, 2))).toBe(0)
    expect(ias(cow)).toBe(30)

    const arcanna = [
      makeSetItem(58, 'amu', 2),
      makeSetItem(59, 'wst', 4),
      makeSetItem(60, 'skp', 1),
      makeSetItem(61, 'ltp', 3),
    ]
    const cast = (equipment: ItemData[]) =>
      resolveCharacterAnimSpeedParams(AMAZON, 'sc', { equipment, setBonusStats: computeSetBonusStats(equipment) })
    const partial = cast(arcanna.slice(0, 3))
    const full = cast(arcanna)
    expect(partial.fcr).toBe(0)
    expect(full.fcr).toBe(20)
    expect(full.effRate).toBeGreaterThan(partial.effRate)
  })
})

describe('Issue #798 (R11): Set Item Tooltip Display & 1.13c showitems.cpp Parity', async () => {
  const { InventoryPanel } = await import('../../src/client/ui/inventory.ts')
  const { WorldPanelsHud } = await import('../../src/client/ui/world-panels.ts')
  const { D2FontRenderer } = await import('../../src/client/ui/font.ts')
  const { onlineItemDataToUiInventoryItem, itemToUiInventoryItem } = await import('../../src/common/items/item-bridge.ts')
  const { formatItemTooltip } = await import('../../src/common/items/item-tooltip.ts')
  const { getEmbeddedDropTables } = await import('../../src/common/items/embedded-drop-tables.ts')
  const { ClientWorld } = await import('../../src/client/world/client-world.ts')
  const { HudModel } = await import('../../src/client/ui-model/hud-model.ts')
  const { HudManager } = await import('../../src/client/ui/hud-manager.ts')

  const { CANONICAL_SET_ITEMS_TABLE } = await import('../../src/common/items/set-items.ts')

  function renderSetTooltip(item: any, lang: 'ENG' | 'CHI' = 'ENG') {
    const inv = new InventoryPanel()
    inv.setPlayerContext({ level: 80, str: 200, dex: 200, classCode: 'sor' })
    const hud = new WorldPanelsHud()
    hud.activePlayerInventory = inv
    hud.lang = lang
    let currentFillStyle = ''
    const ctx = {
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      drawImage: () => {},
      beginPath: () => {},
      closePath: () => {},
      arc: () => {},
      fill: () => {},
      clip: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fillText: () => {},
      measureText: (t: string) => ({ width: t.length * 8 }),
      get fillStyle() {
        return currentFillStyle
      },
      set fillStyle(val: string) {
        currentFillStyle = val
      },
    } as unknown as CanvasRenderingContext2D

    const font = new D2FontRenderer()
    const drawnLines: Array<{ text: string; color: string; x: number; y: number }> = []
    font.drawText = (_c, text, x, y, opts) => {
      drawnLines.push({
        text,
        color: opts?.color ?? 'white',
        x,
        y,
      })
    }
    hud.drawItemTooltip(ctx, { item, x: 400, y: 300 }, font, false)
    return drawnLines
  }

  it('1. Tal Rasha\'s Howling Wind resolves to "Tal Rasha\'s Guardianship" (EN) and "塔·拉夏的守护" (ZH) without · [SetName] on baseNameZh/baseNameEn', () => {
    const tables = getEmbeddedDropTables()
    const talArmorDef = CANONICAL_SET_ITEMS_TABLE.get("Tal Rasha's Howling Wind")!
    expect(talArmorDef).toBeDefined()
    const talArmor = makeSetItem(talArmorDef.id, 'uth', 3, [], {
      stats: [
        st('armorclass', 500),
        st('coldresist', 40),
        st('lightresist', 40),
        st('fireresist', 40),
      ],
    })
    const uiItem = onlineItemDataToUiInventoryItem(talArmor, undefined, tables, undefined, [talArmor])
    expect(uiItem.nameEn).toBe("Tal Rasha's Guardianship")
    expect(uiItem.nameZh).toBe('塔·拉夏的守护')
    expect(uiItem.baseNameZh).not.toContain('·')
    expect(uiItem.baseNameZh).not.toContain('[')
    expect(uiItem.baseNameEn).toBe('Lacquered Plate')
    expect(uiItem.baseNameZh).toBe('漆甲')

    const linesZh = renderSetTooltip(uiItem, 'CHI')
    expect(linesZh[0]).toMatchObject({ text: '塔·拉夏的守护', color: 'green' })
    expect(linesZh[1]).toMatchObject({ text: '漆甲', color: 'green' })

    const linesEn = renderSetTooltip(uiItem, 'ENG')
    expect(linesEn[0]).toMatchObject({ text: "Tal Rasha's Guardianship", color: 'green' })
    expect(linesEn[1]).toMatchObject({ text: 'Lacquered Plate', color: 'green' })
  })

  it('2. offline formatItemTooltip and itemToUiInventoryItem omit · [SetName] from subTitle/baseName and populate setName, setPieces, setPieceColors, and setBonuses', () => {
    const tables = getEmbeddedDropTables()
    const domainWard: any = {
      name: "Civerb's Ward",
      code: 'lrg',
      quality: 'set',
      identified: true,
      base: tables.armor.get('lrg'),
      prefix: null,
      suffix: null,
      level: 13,
      ilvl: 13,
      stats: { ac: 15, block: 15 },
      invWidth: 2,
      invHeight: 3,
      stack: 1,
      value: 2500,
      equippedSetIds: ["Civerb's Ward", "Civerb's Icon"],
    }

    const ttEn = formatItemTooltip(domainWard, 'en')
    expect(ttEn.subTitle).toBe('Large Shield')
    expect(ttEn.subTitle).not.toContain('·')
    expect(ttEn.setName).toBe("Civerb's Vestments")
    expect(ttEn.setPieces).toEqual(["Civerb's Ward", "Civerb's Icon", "Civerb's Cudgel"])
    expect(ttEn.setPieceColors).toEqual(['green', 'green', 'red'])
    expect(ttEn.setBonuses?.some((b) => b.text.includes('Fire Resist'))).toBe(true)

    const uiWard = itemToUiInventoryItem(domainWard, tables)
    expect(uiWard.baseNameEn).toBe('Large Shield')
    expect(uiWard.baseNameZh).not.toContain('·')
    expect(uiWard.setNameEn).toBe("Civerb's Vestments")
    expect(uiWard.setPieceColors).toEqual(['green', 'green', 'red'])
  })

  it('3. WorldPanelsHud.drawItemTooltip renders 1.13c showitems.cpp set item sections in exact order and color (1, 2, and 3 pieces)', () => {
    const tables = getEmbeddedDropTables()
    const wardLists: SetBonusStatList[] = [
      { index: 0, stats: [st('maxmana', shift8(22))] },
      { index: 1, stats: [st('poisonresist', 26)] },
    ]
    const ward = makeSetItem(0, 'lrg', 5, wardLists, {
      stats: [st('armorclass', 42), st('toblock', 15)],
    })
    const icon = makeSetItem(1, 'amu', 2)
    const cudgel = makeSetItem(2, 'gsc', 4)

    // Case A: 1 piece worn (only Ward)
    const ui1 = onlineItemDataToUiInventoryItem(ward, undefined, tables, undefined, [ward])
    const lines1 = renderSetTooltip(ui1, 'ENG')
    // 1. Item Name (green) & 2. Base Type (green)
    expect(lines1[0]).toMatchObject({ text: "Civerb's Ward", color: 'green' })
    expect(lines1[1]).toMatchObject({ text: 'Large Shield', color: 'green' })
    // Blue magic properties present, no green item-specific set bonus yet, no gold set bonus yet
    expect(lines1.some((l) => l.color === 'blue' && l.text.includes('15% Increased Chance of Blocking'))).toBe(true)
    expect(lines1.some((l) => l.color === 'green' && l.text.includes('Mana'))).toBe(false)
    // Set Name header (gold) + 3 pieces (Ward=green, Icon=red, Cudgel=red)
    const setHeaderIdx1 = lines1.findIndex((l) => l.text === "Civerb's Vestments" && l.color === 'gold')
    expect(setHeaderIdx1).toBeGreaterThan(2)
    expect(lines1.slice(setHeaderIdx1 + 1).map((l) => ({ text: l.text, color: l.color }))).toEqual([
      { text: "Civerb's Ward", color: 'green' },
      { text: "Civerb's Icon", color: 'red' },
      { text: "Civerb's Cudgel", color: 'red' },
    ])

    // Case B: 2 pieces worn (Ward + Icon) -> unlocks Ward's list 0 (+22 to Mana in green) and PCode2a (Fire Resist +15% in gold)
    const ui2 = onlineItemDataToUiInventoryItem(ward, undefined, tables, undefined, [ward, icon])
    const lines2 = renderSetTooltip(ui2, 'ENG')
    const blueBlockIdx = lines2.findIndex((l) => l.color === 'blue' && l.text.includes('Increased Chance of Blocking'))
    const greenManaIdx = lines2.findIndex((l) => l.color === 'green' && l.text.includes('+22 to Mana'))
    const goldFireIdx = lines2.findIndex((l) => l.color === 'gold' && l.text.includes('Fire Resist +15%'))
    const setHeaderIdx2 = lines2.findIndex((l) => l.color === 'gold' && l.text === "Civerb's Vestments")

    expect(blueBlockIdx).toBeGreaterThan(1)
    expect(greenManaIdx).toBeGreaterThan(blueBlockIdx)
    expect(goldFireIdx).toBeGreaterThan(greenManaIdx)
    expect(setHeaderIdx2).toBeGreaterThan(goldFireIdx)
    expect(lines2.slice(setHeaderIdx2 + 1).map((l) => ({ text: l.text, color: l.color }))).toEqual([
      { text: "Civerb's Ward", color: 'green' },
      { text: "Civerb's Icon", color: 'green' },
      { text: "Civerb's Cudgel", color: 'red' },
    ])

    // Case C: 3 pieces worn (Full Set: Ward + Icon + Cudgel) -> unlocks both green aprops on Ward + gold PCode/FCodes + all 3 pieces green
    const ui3 = onlineItemDataToUiInventoryItem(ward, undefined, tables, undefined, [ward, icon, cudgel])
    const lines3 = renderSetTooltip(ui3, 'ENG')
    expect(lines3.some((l) => l.color === 'green' && l.text.includes('+22 to Mana'))).toBe(true)
    expect(lines3.some((l) => l.color === 'green' && l.text.includes('Poison Resist +26%'))).toBe(true)
    expect(lines3.some((l) => l.color === 'gold' && l.text.includes('Fire Resist +15%'))).toBe(true)
    expect(lines3.some((l) => l.color === 'gold' && l.text.includes('+15 to Strength'))).toBe(true)
    expect(lines3.some((l) => l.color === 'gold' && l.text.includes('Lightning Resist +25%'))).toBe(true)
    const setHeaderIdx3 = lines3.findIndex((l) => l.color === 'gold' && l.text === "Civerb's Vestments")
    expect(lines3.slice(setHeaderIdx3 + 1).map((l) => ({ text: l.text, color: l.color }))).toEqual([
      { text: "Civerb's Ward", color: 'green' },
      { text: "Civerb's Icon", color: 'green' },
      { text: "Civerb's Cudgel", color: 'green' },
    ])
  })

  it('4. HudModel.syncFromWorld passes world.containers.equipment to onlineItemDataToUiInventoryItem', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const hud = new HudManager()
    const model = new HudModel({ world, hudManager: hud })

    const wardLists: SetBonusStatList[] = [{ index: 0, stats: [st('maxmana', shift8(22))] }]
    const ward = makeSetItem(0, 'lrg', 5, wardLists, {
      id: 7001,
      itemId: 7001,
      stats: [st('armorclass', 42)],
    })
    const icon = makeSetItem(1, 'amu', 2, [], {
      id: 7002,
      itemId: 7002,
    })

    ;(world.containers.equipment as Map<number, ItemData>).set(5, ward)
    ;(world.containers.equipment as Map<number, ItemData>).set(2, icon)
    model.syncFromWorld()

    const equippedShield = hud.inventory.equipped.weapon2
    expect(equippedShield).toBeDefined()
    expect(equippedShield!.setPieceColors).toEqual(['green', 'green', 'red'])
    expect(equippedShield!.setBonusesEn?.some((b) => b.color === 'green' && b.text.includes('+22 to Mana'))).toBe(true)
    expect(equippedShield!.setBonusesEn?.some((b) => b.color === 'gold' && b.text.includes('Fire Resist +15%'))).toBe(true)
  })

  it('5. handles bare ItemData in equippedItems, excludes broken set items (0 durability), falls back to setItemDef.aprops, and caps partial pCodes at memberItems.length - 1', () => {
    const tables = getEmbeddedDropTables()
    // Bare ItemData without bodyLoc, equipped, or setBonusStats
    // Tal Rasha's Wrappings in SetItems.txt order: 76=zmb (Belt), 77=amu (Amulet), 78=oba (Orb), 79=uth (Armor), 80=xsk (Helm)
    const bareTalBelt = { id: 1, code: 'zmb', quality: 5, identified: true, setItemId: 76, stats: [] } as unknown as ItemData
    const bareTalOrb = { id: 2, code: 'oba', quality: 5, identified: true, setItemId: 78, stats: [] } as unknown as ItemData
    const bareTalHelm = { id: 3, code: 'xsk', quality: 5, identified: true, setItemId: 80, stats: [] } as unknown as ItemData
    const brokenTalArmor = {
      id: 4,
      code: 'uth',
      quality: 5,
      identified: true,
      setItemId: 79,
      durability: 0,
      maxDurability: 55,
      stats: [],
    } as unknown as ItemData

    const uiBelt = onlineItemDataToUiInventoryItem(
      bareTalBelt,
      undefined,
      tables,
      undefined,
      [bareTalBelt, bareTalOrb, bareTalHelm, brokenTalArmor],
    )
    // Belt (idx 0), Orb (idx 2), Helm (idx 4) are green; Amulet (idx 1, missing) and Armor (idx 3, broken) are red
    expect(uiBelt.setPieceColors).toEqual(['green', 'red', 'green', 'red', 'green'])
    // Belt aprops[0] (+60 Defense at 2 pieces) and aprops[1] (10% FCR at 3 pieces) are synthesized via setItemDef.aprops fallback
    expect(uiBelt.setBonusesEn?.some((b) => b.color === 'green' && b.text.includes('+60 Defense'))).toBe(true)
    expect(uiBelt.setBonusesEn?.some((b) => b.color === 'green' && b.text.includes('10% Faster Cast Rate'))).toBe(true)

    // Civerb's Ward (id=0, addFunc=1: aprops[0] Mana requires Icon idx 1, aprops[1] Poison Resist requires Cudgel idx 2)
    // Civerb's Icon (id=1, addFunc=2: aprops[0] Cold Resist at 2 pieces, aprops[1] Defense at 3 pieces)
    const bareIcon = { id: 10, code: 'amu', quality: 5, identified: true, setItemId: 1, stats: [] } as unknown as ItemData
    const bareWard = { id: 11, code: 'lrg', quality: 5, identified: true, setItemId: 0, stats: [] } as unknown as ItemData
    const uiWard = onlineItemDataToUiInventoryItem(bareWard, undefined, tables, undefined, [bareWard, bareIcon])
    expect(uiWard.setBonusesEn?.some((b) => b.color === 'green' && b.text.includes('Mana'))).toBe(true)
    expect(uiWard.setBonusesEn?.some((b) => b.color === 'green' && b.text.includes('Poison Resist'))).toBe(false)
    const uiIcon = onlineItemDataToUiInventoryItem(bareIcon, undefined, tables, undefined, [bareIcon, bareWard])
    expect(uiIcon.setBonusesEn?.some((b) => b.color === 'green' && b.text.includes('Cold Resist'))).toBe(true)
    expect(uiIcon.setBonusesEn?.some((b) => b.color === 'green' && b.text.includes('Defense'))).toBe(false)

    // Orphan's Call 4/4: PCode4a (+100 Defense) is skipped, only FCode4 (+100 Defense) is emitted once
    const orphanItems = [104, 105, 106, 107].map((id, idx) => ({
      id: 100 + idx,
      code: ['xhm', 'ztb', 'xvg', 'xml'][idx]!,
      quality: 5,
      identified: true,
      setItemId: id,
      stats: [],
    })) as unknown as ItemData[]
    const uiOrphan = onlineItemDataToUiInventoryItem(orphanItems[0]!, undefined, tables, undefined, orphanItems)
    const def100Count = (uiOrphan.setBonusesEn ?? []).filter((b) => b.text === '+100 Defense').length
    expect(def100Count).toBe(1)
  })
})

describe('Issue #938: 7 class-specific full-set visual effects (1.13c parity)', () => {
  const setItems = parseSetItemsTable(parseTable(new TextEncoder().encode(RAW_SET_ITEMS)))
  const piecesForSet = (setName: string): ItemData[] => {
    const entries = setItems.entries.filter((e) => e.set === setName)
    return entries.map((e, i) => makeSetItem(e.id, e.item, i + 1))
  }

  it('1. 5 class sets (Amazon, Sorceress, Paladin, Barbarian, Druid) emit state 175 (fullsetgeneric) -> AuraFanatic overlay, and clear on unequip/swap', () => {
    const fullSetGenericSets: readonly [string, number][] = [
      ["M'avina's Battle Hymn", 0],
      ["Tal Rasha's Wrappings", 1],
      ["Griswold's Legacy", 3],
      ['Immortal King', 4],
      ["Aldur's Watchtower", 5],
    ]

    for (const [setName, classId] of fullSetGenericSets) {
      const pieces = piecesForSet(setName)
      const fullStats = computeSetBonusStats(pieces)
      expect(fullStats, `${setName} full set state 175`).toContainEqual(st('state', 1, 175))

      // Partial set (missing last piece) must NOT emit state 175
      const partialStats = computeSetBonusStats(pieces.slice(0, -1))
      expect(partialStats.some((s) => s.statId === statId('state') && s.param === 175)).toBe(false)

      // End-to-end ClientWorld + buildSceneDrawables verification
      const world = new ClientWorld()
      world.applyEvent({
        type: 'UnitAssign',
        isSelf: true,
        unit: { unitType: 'player', id: 1, classId, name: 'Hero', x: 100, y: 100, lifePct: 128, mode: 1 },
      })

      for (const piece of pieces) {
        world.applyEvent({
          type: 'ItemAction',
          action: 0x06,
          container: 'equipment',
          item: piece,
        })
      }

      const unit = world.getUnit('player', 1)!
      expect(unit.states.has(175), `${setName} unit has state 175`).toBe(true)
      expect(world.self.states.has(175), `${setName} self has state 175`).toBe(true)

      const scene = buildSceneDrawables([
        {
          id: 1,
          kind: 'player',
          classId,
          x: 100,
          y: 100,
          mode: 1,
          direction: 0,
          states: Array.from(unit.states.list()),
        },
      ])
      const auraOv = scene.overlayDrawables.find((o) => o.token.toLowerCase() === 'aura_fanatic')
      expect(auraOv, `${setName} emits aura_fanatic overlay`).toBeDefined()
      expect(auraOv?.preDraw).toBe(true)
      expect(auraOv?.blendMode).toBe('additive')
      expect(auraOv?.totalFrames).toBe(20)
      expect(CANONICAL_113C_OVERLAYS.aura_fanatic.filename).toBe('AuraFanatic')
      expect(CANONICAL_113C_OVERLAYS.aura_fanatic.frames).toBe(20)
      expect(AURA_FANATIC_OVERLAY_META.frames).toBe(20)
      expect(AURA_FANATIC_OVERLAY_META.preDraw).toBe(true)
      expect(OVERLAY_METAS.aura_fanatic).toBe(AURA_FANATIC_OVERLAY_META)
      expect(OVERLAY_METAS.aura_fanatic).not.toBe(OVERLAY_METAS.fanaticism_back)

      // Moving the last piece to inactive weapon-switch slot 11 removes state 175 & AuraFanatic
      const lastPiece = pieces[pieces.length - 1]!
      world.applyEvent({
        type: 'ItemAction',
        action: 0x17,
        container: 'equipment',
        item: { ...lastPiece, bodyLoc: 11, equippedSlot: 11 },
      })
      expect(unit.states.has(175), `${setName} state 175 removed on swap to slot 11`).toBe(false)
      expect(world.self.states.has(175)).toBe(false)
    }

    // Also verify set-bonus light radius (e.g. Heaven's Brethren FCode4 = light +5) feeds resolvePlayerLightRadiusBonus
    const hbWorld = new ClientWorld()
    hbWorld.applyEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 3, name: 'Pal', x: 100, y: 100, lifePct: 128, mode: 1 },
    })
    for (const piece of piecesForSet("Heaven's Brethren")) {
      hbWorld.applyEvent({
        type: 'ItemAction',
        action: 0x06,
        container: 'equipment',
        item: piece,
      })
    }
    expect(hbWorld.resolvePlayerLightRadiusBonus(1)).toBe(5)
  })

  it("2. Necromancer Trang-Oul's Avatar (5/5) emits state 176 (monsterset) -> Vampire morph token VA (MonStats 135 vampire5), anim speeds, and monster-va-hth draw", () => {
    const pieces = piecesForSet("Trang-Oul's Avatar")
    expect(pieces).toHaveLength(5)
    const fullStats = computeSetBonusStats(pieces)
    expect(fullStats).toContainEqual(st('state', 1, 176))

    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 2, name: 'Necro', x: 100, y: 100, lifePct: 128, mode: 1 },
    })
    for (const piece of pieces) {
      world.applyEvent({
        type: 'ItemAction',
        action: 0x06,
        container: 'equipment',
        item: piece,
      })
    }

    const unit = world.getUnit('player', 1)!
    expect(unit.states.has(176)).toBe(true)

    // Cast speed in Vampire morph uses VA SC clip (15 frames, baseSpeed 160)
    const castSpeed = world.resolvePlayerAnimSpeed(10, 1)
    expect(castSpeed.frames).toBe(15)
    expect(castSpeed.baseSpeed).toBe(160)

    // Walk/Run locomotion in Vampire morph uses vampire5 (MonStats 135: WalkAnimSpeed=240, RunAnimSpeed=120 -> equal walk/run velocity)
    const walkSpeed = world.resolvePlayerAnimSpeed(2, 1)
    expect(walkSpeed.baseSpeed).toBe(240)
    const runSpeed = world.resolvePlayerAnimSpeed(3, 1)
    expect(runSpeed.baseSpeed).toBe(120)

    const scene = buildSceneDrawables([
      {
        id: 1,
        kind: 'player',
        classId: 2,
        x: 100,
        y: 100,
        mode: 10,
        direction: 0,
        states: Array.from(unit.states.list()),
      },
    ])
    const necroDrawable = scene.unitDrawables[0]!
    expect(necroDrawable.token).toBe('VA')

    // Verify drawSceneUnitDrawable queries EntityArtCache for monsterClassId = 135 (vampire5)
    const drawCalls: Array<{ frame: unknown; opts: unknown }> = []
    const mockRenderer = {
      draw: vi.fn((frame: unknown, _x: number, _y: number, opts?: unknown) => {
        drawCalls.push({ frame, opts })
      }),
    }
    const requestedMonsterIds: number[] = []
    const fakeFrame = { x: 0, y: 0, width: 48, height: 72, anchorX: -24, anchorY: -60 }
    const fakeVampArt = {
      handle: { id: 'va-atlas' },
      directions: 8,
      groups: Array.from({ length: 64 }, () => [fakeFrame]),
      clips: {
        nu: { group: 0, directions: 8, framesPerDir: 10, speed: 176 },
        wl: { group: 8, directions: 8, framesPerDir: 8, speed: 176 },
        sc: { group: 16, directions: 8, framesPerDir: 15, speed: 160 },
      },
    }
    drawSceneUnitDrawable(
      mockRenderer as any,
      necroDrawable,
      {
        entityArtCache: {
          getMonsterArt: (id: number) => {
            requestedMonsterIds.push(id)
            return id === 135 ? (fakeVampArt as any) : 'missing'
          },
        } as any,
      } as any,
      0,
      0,
    )
    expect(requestedMonsterIds).toContain(135)
    expect(drawCalls.length).toBeGreaterThan(0)

    // Unequipping one piece reverts state 176 back to human Necromancer ('NE')
    world.applyEvent({
      type: 'ItemAction',
      action: 0x09,
      container: 'cursor',
      item: { ...pieces[0]!, bodyLoc: 0, equippedSlot: 0, location: 4 },
    })
    expect(unit.states.has(176)).toBe(false)
    const sceneAfter = buildSceneDrawables([
      {
        id: 1,
        kind: 'player',
        classId: 2,
        x: 100,
        y: 100,
        mode: 1,
        direction: 0,
        states: Array.from(unit.states.list()),
      },
    ])
    expect(sceneAfter.unitDrawables[0]!.token).toBe('NE')
  })

  it("3. Assassin Natalya's Odium (4/4) emits fade (statId 181 = 1) -> isPlayerFaded() true and translucent trans50 draw", () => {
    const pieces = piecesForSet("Natalya's Odium")
    expect(pieces).toHaveLength(4)
    const fullStats = computeSetBonusStats(pieces)
    expect(fullStats).toContainEqual(st('fade', 1, 0))

    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 6, name: 'Assassin', x: 100, y: 100, lifePct: 128, mode: 1 },
    })
    expect(world.isPlayerFaded(1)).toBe(false)

    for (const piece of pieces) {
      world.applyEvent({
        type: 'ItemAction',
        action: 0x06,
        container: 'equipment',
        item: piece,
      })
    }
    expect(world.isPlayerFaded(1)).toBe(true)

    const scene = buildSceneDrawables([
      {
        id: 1,
        kind: 'player',
        classId: 6,
        x: 100,
        y: 100,
        mode: 1,
        direction: 0,
        isFaded: world.isPlayerFaded(1),
      },
    ])
    const assnDrawable = scene.unitDrawables[0]!
    expect(assnDrawable.isFaded).toBe(true)
    expect(assnDrawable.blendMode).toBe('trans50')

    const drawOpts: Array<{ blendMode?: string; tint?: readonly number[] }> = []
    const mockRenderer = {
      draw: vi.fn((_frame: unknown, _x: number, _y: number, opts?: { blendMode?: string; tint?: readonly number[] }) => {
        if (opts) drawOpts.push(opts)
      }),
    }
    const fakeFrame = { x: 0, y: 0, width: 48, height: 72, anchorX: -24, anchorY: -60 }
    const fakeCharArt = {
      handle: { id: 'ai-atlas' },
      directions: 8,
      groups: Array.from({ length: 16 }, () => [fakeFrame]),
      clips: {
        nu: { group: 0, directions: 8, framesPerDir: 8, speed: 128, loop: true },
      },
    }
    drawSceneUnitDrawable(
      mockRenderer as any,
      assnDrawable,
      {
        characterArtByToken: new Map([['ai', fakeCharArt as any]]),
      } as any,
      0,
      0,
    )
    const bodyDraw = drawOpts.find((o) => o.blendMode === 'trans50')
    expect(bodyDraw).toBeDefined()
    expect(bodyDraw?.tint?.[3]).toBeCloseTo(0.55, 2)

    // Unequipping one piece removes Fade translucency
    world.applyEvent({
      type: 'ItemAction',
      action: 0x09,
      container: 'cursor',
      item: { ...pieces[0]!, bodyLoc: 0, equippedSlot: 0, location: 4 },
    })
    expect(world.isPlayerFaded(1)).toBe(false)
  })
})
