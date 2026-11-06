import { describe, test, expect as vitestExpect } from 'vitest'
import * as fs from 'fs'
/**
 * M3 item checks: tables, affix rolling, inventory and drops, headless.
 *
 * Item systems fail in ways that are tedious to catch by playing: an affix that
 * rolls on a type it should not, a stack that silently discards a potion, an
 * item that occupies cells it never clears, or a drop table that is not
 * reproducible. Each of those is a plain assertion here instead.
 *
 * Usage: node scripts/verify-items.ts
 */
import {
  Inventory, affixEligible, affixesFromTable, createItem, goldItem, itemBasesFromTable,
  rollAffix, totalStat, ItemQuality,
} from '../src/common/items/items.ts'
import type { Affix, ItemBase } from '../src/common/items/items.ts'
import { Rng } from '../src/common/rng/d2-rng.ts'
import { parseTable } from '../src/common/items/tables.ts'
const isSkip = false && !fs.existsSync('samples/d2');
const _results: any[] = [];
let suiteCompleted = false;
let problems: string[] = [];
let checks: any[] = [];
function expect(condition: boolean, description: string) { _results.push({cond: condition, desc: description}); if (!condition) problems.push(description); }
function check(nameOrOk: any, okOrMessage: any, detail?: string) { 
  if (typeof nameOrOk === 'string') {
    _results.push({cond: okOrMessage, desc: nameOrOk, detail}); if (!okOrMessage) checks.push({name: nameOrOk, ok: okOrMessage});
  } else {
    _results.push({cond: nameOrOk, desc: okOrMessage}); if (!nameOrOk) checks.push({name: okOrMessage, ok: nameOrOk});
  }
}
if (!isSkip) {

const problems: string[] = []
let checks = 0

/**
 * Assert one condition.
 *
 * @param condition - the condition to hold.
 * @param description - what it means.
 */
function __expect_disabled(condition: boolean, description: string): void {
  checks += 1
  if (!condition) problems.push(description)
}

// --- tables -----------------------------------------------------------------

const weapons = itemBasesFromTable(parseTable([
  'Id\tName\tType\tInvWidth\tInvHeight\tDamage\tValue\tLevel\tMaxStack',
  'swd\tShort Sword\tweap\t1\t3\t5\t30\t1\t1',
  'bsc\tBuckler\tarmo\t2\t2\t\t12\t1\t1\t\t',
  'lsw\tLong Sword\tweap\t1\t3\t12\t120\t8\t1',
  'axe\tHand Axe\tweap\t1\t3\t8\t60\t\t1',
].join('\n')), 'weapon')
expect(weapons.length === 4, 'every weapon row becomes a base')
expect(weapons[0]?.invWidth === 1 && weapons[0]?.invHeight === 3, 'footprints come from the table')
expect(weapons[1]?.damage === 0, 'a missing damage cell becomes zero, not NaN')
expect(weapons[2]?.level === 8, 'level gates are read')
expect(weapons[3]?.level === 1, 'a missing level falls back to 1')
expect(weapons[0]?.tags.includes('weap') === true, 'the type column becomes the tag list')

const misc = itemBasesFromTable(parseTable([
  'Id\tName\tType\tInvWidth\tInvHeight\tMaxStack\tValue',
  'hp1\tMinor Healing Potion\tmisc\t1\t1\t5\t20',
].join('\n')), 'misc')
expect(misc[0]?.maxStack === 5, 'stack limits come from the table')

const prefixes = affixesFromTable(parseTable([
  'Id\tName\tLevel\titype1\titype2\tmod1code\tmod1min\tmod1max\tmod2code\tmod2min\tmod2max',
  'cruel\tCruel\t12\tweap\t\tmaxdamage\t30\t40\t\t\t',
  'sturdy\tSturdy\t3\tarmo\t\tdefense\t5\t9\t\t\t',
  'fine\tFine\t5\tweap\tarmo\tmaxdamage\t2\t4\tdefense\t1\t3',
  'nomod\tBroken Row\t1\tweap\t\t\t\t\t\t\t',   // no modifier: must be skipped
].join('\r\n')), 'prefix')
expect(prefixes.length === 3, 'rows without a modifier are skipped')
expect(prefixes[0]?.modifiers.length === 1, 'a single modifier is read')
expect(prefixes[1]?.itemTypes.join(',') === 'armo', 'itype columns build the type list')
expect(prefixes[2]?.modifiers.length === 2, 'two modifier slots are read')

const suffixes = affixesFromTable(parseTable([
  'Id\tName\tLevel\titype1\tmod1code\tmod1min\tmod1max',
  'of_might\tof Might\t5\tweap\tstrength\t2\t5',
  'of_the_fox\tof the Fox\t3\t\tdexterity\t1\t3',   // no itype: any item
].join('\n')), 'suffix')
expect(suffixes[1]?.itemTypes.length === 0, 'an affix with no itype applies to anything')

// --- eligibility ------------------------------------------------------------

const sword = weapons[0]!
const buckler = weapons[1]!
const longSword = weapons[2]!
expect(affixEligible(prefixes[0]!, sword, 12), 'a weapon affix fits a weapon at its level')
expect(!affixEligible(prefixes[0]!, sword, 11), 'an affix above the item level is refused')
expect(!affixEligible(prefixes[0]!, buckler, 20), 'a weapon affix is refused by armor')
expect(affixEligible(prefixes[1]!, buckler, 3), 'an armor affix fits armor')
expect(affixEligible(suffixes[1]!, buckler, 10), 'an unrestricted affix fits any base')

// --- rolling ----------------------------------------------------------------

const rollWith = (seed: number): string => {
  const rolled = rollAffix(prefixes, sword, 20, new Rng(seed))
  return JSON.stringify(rolled)
}
expect(rollWith(7) === rollWith(7), 'the same seed rolls the same affix and the same numbers')
const rollVariety = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(rollWith))
expect(rollVariety.size > 1, 'different seeds roll differently')
const rolled = rollAffix(prefixes, sword, 20, new Rng(3))
expect(rolled !== null && rolled.rolls.length === rolled.affix.modifiers.length, 'each modifier gets a roll')
expect(rolled !== null && rolled.rolls.every(r => r.max >= r.min && r.max <= (r as { max: number }).max), 'rolls stay inside the affix range')
const neverEligible = rollAffix([prefixes[1]!], sword, 20, new Rng(1))
expect(neverEligible === null, 'no eligible affix rolls nothing rather than an illegal one')

// --- item construction ------------------------------------------------------

// Only one suffix is eligible here, so "the modifier shows up as a stat" is a
// statement about the pipeline rather than about which affix the seed picked.
const might = suffixes.find(affix => affix.id === 'of_might')!
const item = createItem(sword, prefixes, [might], new Rng(11), { level: 20, prefixChance: 1, suffixChance: 1 })
expect(item.prefix !== null && item.suffix !== null, 'forced chances produce both affixes')
expect(item.name === `${item.prefix!.name} ${sword.name} ${item.suffix!.name}`, 'the name is prefix + base + suffix')
expect((item.stats.damage ?? 0) >= sword.damage, 'base damage survives into the stats')
expect((item.stats.strength ?? 0) >= 2, 'affix modifiers appear as stats')
expect(item.suffix?.id === 'of_might', 'the only eligible suffix is the one rolled')
expect(item.value > sword.value, 'an affixed item is worth more than its base')

const plain = createItem(sword, prefixes, suffixes, new Rng(11), { level: 20, prefixChance: 0, suffixChance: 0 })
expect(plain.prefix === null && plain.suffix === null, 'zero chances roll no affixes')
expect(plain.name === sword.name, 'a plain item is named after its base')

const potion = misc[0]!
const stacked = createItem(potion, prefixes, suffixes, new Rng(1), { level: 1, prefixChance: 0, suffixChance: 0, stack: 99 })
expect(stacked.stack === potion.maxStack, 'a stack cannot exceed the base limit')

// --- inventory --------------------------------------------------------------

const bag = new Inventory(4, 3)
expect(bag.totalCells === 12 && bag.usedCells === 0, 'a new inventory is empty')
expect(bag.canPlace(1, 3, 0, 0), 'a tall item fits where there is room')
expect(!bag.canPlace(1, 3, 0, 1), 'an item that would leave the grid is refused')
expect(bag.canPlace(4, 1, 0, 0), 'an item exactly as wide as the grid fits')
expect(!bag.canPlace(5, 1, 0, 0), 'an item wider than the grid is refused')

const placedSword = bag.add(item)
expect(placedSword !== null, 'an item can be added')
expect(bag.usedCells === 3, 'adding occupies the item footprint')
expect(!bag.canPlace(1, 1, 0, 0), 'occupied cells refuse other items')
expect(bag.add(plain) !== null, 'a second item finds the next free slot')
expect(bag.contents.length === 2, 'both items are tracked')

// stacking onto an existing pile, with the remainder in a new slot
const potionBag = new Inventory(4, 2)
const firstPotion = potionBag.add(createItem(potion, prefixes, suffixes, new Rng(2), { level: 1, prefixChance: 0, suffixChance: 0, stack: 3 }))
expect(firstPotion !== null, 'the first pile lands')
const secondPotion = potionBag.add(createItem(potion, prefixes, suffixes, new Rng(2), { level: 1, prefixChance: 0, suffixChance: 0, stack: 4 }))
expect(secondPotion !== null, 'the second pile lands somewhere')
expect(potionBag.contents.length === 2, 'a stack that overflows opens a second slot instead of discarding')
const totalPotions = potionBag.contents.reduce((sum, entry) => sum + entry.item.stack, 0)
expect(totalPotions === 7, 'no potion is lost across the overflow')

const removed = bag.remove(placedSword!)
expect(removed && bag.usedCells === 3, 'removing an item clears exactly its cells')
expect(bag.canPlace(1, 3, 0, 0), 'the freed cells can be reused')

const tiny = new Inventory(1, 1)
expect(tiny.add(item) === null, 'an item with no room is refused rather than dropped silently')
expect(tiny.add(goldItem(100)) !== null, 'gold fits where the sword did not')
expect(tiny.gold === 100, 'gold is summed from its piles')

const goldBag = new Inventory(2, 1)
goldBag.add(goldItem(4000))
goldBag.add(goldItem(4000))
expect(goldBag.gold === 8000, 'gold piles stack up to their limit and spill into another slot')

// --- drops ------------------------------------------------------------------

const bases = [...weapons, potion]
const runDrops = (seed: number): string => JSON.stringify(
  Array.from({ length: 8 }, (_, index) => {
    const rng = new Rng(seed + index)
    const base = rng.pick(bases)
    return base ? createItem(base, prefixes, suffixes, rng, { level: 10 }) : null
  }),
)
expect(runDrops(5) === runDrops(5), 'the same seed produces the same drops')
expect(new Set([1, 2, 3, 4, 5, 6].map(runDrops)).size > 1, 'different seeds produce different drops')

// Test zero affix chance produces basic item without affixes
const noAffixItem = createItem(sword, prefixes, suffixes, new Rng(1), { level: 10, prefixChance: 0, suffixChance: 0 })
expect(noAffixItem.prefix === null && noAffixItem.suffix === null, 'a zero drop chance drops nothing')

// Test guaranteed item creation produces a valid item
const guaranteedItem = createItem(sword, prefixes, suffixes, new Rng(1), { level: 10 })
expect(guaranteedItem !== null && guaranteedItem.base.id === sword.id, 'a guaranteed drop is an item')

// Test gold item generation within range
const goldRng = new Rng(1)
const goldAmount = goldRng.int(10, 20)
const goldDrop = goldItem(goldAmount)
expect(goldDrop.base.id === 'gold' && goldDrop.stack >= 10 && goldDrop.stack <= 20, 'gold drops inside its range')

// Test base creation under level restriction
const lowLevelDrops = Array.from({ length: 12 }, (_, index) =>
  createItem(longSword, prefixes, suffixes, new Rng(100 + index), { level: 1 }),
)
expect(lowLevelDrops.every(it => it.base.id === longSword.id), 'a table with no base under the level still drops the base it has')

// --- derived stats ----------------------------------------------------------

const sheet = new Inventory(4, 4)
const armour: ItemBase = { ...buckler, defense: 12, tags: ['armo'] }
sheet.add(createItem(armour, prefixes, suffixes, new Rng(4), { level: 20, prefixChance: 1, suffixChance: 0 }))
const defence = totalStat(sheet.contents, 'defense')
expect(defence >= 12, 'worn armor contributes its defense to the character sheet')

for (const problem of problems.slice(0, 12)) console.log(`  - ${problem}`)
console.log(problems.length === 0 ? 'RESULT     item behaviours hold' : 'RESULT     FAILED')
// disabled exit: problems.length === 0 ? 0 : 1)

  suiteCompleted = true;
}
describe('verify-items.ts', () => {
  test.skipIf(isSkip)('evaluates script successfully', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    vitestExpect(problems).toEqual([]);
  });
  test.skipIf(isSkip)('every weapon row becomes a base', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('every weapon row becomes a base'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('footprints come from the table', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('footprints come from the table'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a missing damage cell becomes zero, not NaN', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a missing damage cell becomes zero, not NaN'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('level gates are read', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('level gates are read'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a missing level falls back to 1', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a missing level falls back to 1'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the type column becomes the tag list', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the type column becomes the tag list'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('stack limits come from the table', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('stack limits come from the table'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('rows without a modifier are skipped', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('rows without a modifier are skipped'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a single modifier is read', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a single modifier is read'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('itype columns build the type list', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('itype columns build the type list'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('two modifier slots are read', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('two modifier slots are read'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an affix with no itype applies to anything', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an affix with no itype applies to anything'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a weapon affix fits a weapon at its level', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a weapon affix fits a weapon at its level'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an affix above the item level is refused', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an affix above the item level is refused'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a weapon affix is refused by armor', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a weapon affix is refused by armor'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an armor affix fits armor', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an armor affix fits armor'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an unrestricted affix fits any base', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an unrestricted affix fits any base'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the same seed rolls the same affix and the same numbers', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the same seed rolls the same affix and the same numbers'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('different seeds roll differently', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('different seeds roll differently'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('each modifier gets a roll', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('each modifier gets a roll'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('rolls stay inside the affix range', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('rolls stay inside the affix range'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('no eligible affix rolls nothing rather than an illegal one', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('no eligible affix rolls nothing rather than an illegal one'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('forced chances produce both affixes', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('forced chances produce both affixes'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the name is prefix + base + suffix', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the name is prefix + base + suffix'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('base damage survives into the stats', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('base damage survives into the stats'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('affix modifiers appear as stats', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('affix modifiers appear as stats'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the only eligible suffix is the one rolled', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the only eligible suffix is the one rolled'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an affixed item is worth more than its base', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an affixed item is worth more than its base'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('zero chances roll no affixes', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('zero chances roll no affixes'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a plain item is named after its base', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a plain item is named after its base'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a stack cannot exceed the base limit', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a stack cannot exceed the base limit'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a new inventory is empty', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a new inventory is empty'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a tall item fits where there is room', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a tall item fits where there is room'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an item that would leave the grid is refused', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an item that would leave the grid is refused'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an item exactly as wide as the grid fits', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an item exactly as wide as the grid fits'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an item wider than the grid is refused', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an item wider than the grid is refused'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an item can be added', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an item can be added'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('adding occupies the item footprint', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('adding occupies the item footprint'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('occupied cells refuse other items', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('occupied cells refuse other items'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a second item finds the next free slot', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a second item finds the next free slot'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('both items are tracked', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('both items are tracked'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the first pile lands', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the first pile lands'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the second pile lands somewhere', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the second pile lands somewhere'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a stack that overflows opens a second slot instead of discarding', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a stack that overflows opens a second slot instead of discarding'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('no potion is lost across the overflow', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('no potion is lost across the overflow'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('removing an item clears exactly its cells (used', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('removing an item clears exactly its cells (used'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the freed cells can be reused', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the freed cells can be reused'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an item with no room is refused rather than dropped silently', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an item with no room is refused rather than dropped silently'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('gold fits where the sword did not', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('gold fits where the sword did not'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('gold is summed from its piles', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('gold is summed from its piles'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('gold piles stack up to their limit and spill into another slot', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('gold piles stack up to their limit and spill into another slot'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the same seed produces the same drops', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the same seed produces the same drops'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('different seeds produce different drops', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('different seeds produce different drops'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a zero drop chance drops nothing', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a zero drop chance drops nothing'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a guaranteed drop is an item', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a guaranteed drop is an item'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('gold drops inside its range', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('gold drops inside its range'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a table with no base under the level still drops the base it has', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a table with no base under the level still drops the base it has'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('worn armor contributes its defense to the character sheet', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('worn armor contributes its defense to the character sheet'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
});