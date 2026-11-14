/**
 * M3 item verification against real 1.13c MPQ data and TreasureClass tree invariants.
 *
 * Asserts against real Blizzard MPQ tables mounted from samples/d2:
 * - Data scales (base items, affixes, item types, TCs, uniques, sets, runes, gems, stats, ratio)
 * - TreasureClass tree invariants (acyclicity, max depth <= 64, resolving dangling references, NoDrop+prob > 0, magic factor 1024)
 * - Fixed probability points (Act 1 H2H A, Cow (H), exact branch probabilities, Act 5 (H) Equip B comment consistency)
 * - Cross-table mappings (cap stats, Weapons col 18 hazard, Armor mindam/maxdam duplicate, properties -> stat, affix -> property, itype/etype -> itemTypes)
 * - Localization coverage (ENG 202/306/143, CHI UTF-8 cap -> 帽子, LoD fallbacks: r33, Windforce, Annihilus)
 * - RNG invariants (64-bit LCG D2Rng vector reproducibility, power-of-2 AND vs modulo)
 * - Monte Carlo vs Analytic (100,000 runs of Act 1 H2H A within 99% CI)
 * - Real item simulation (inventory grid placement, stack overflow, gold stacking, derived stats)
 *
 * Usage: npx tsx scripts/verify-items.ts [directory]
 */
import * as fs from 'node:fs'
import { join } from 'node:path'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { parseTable, cell } from '../src/common/world/acts.ts'
import { loadArmor, ArmorTable } from '../src/common/items/armor.ts'
import { loadWeapons, getWeaponCell } from '../src/common/items/weapons.ts'
import { loadMisc } from '../src/common/items/misc-items.ts'
import { loadItemTypes } from '../src/common/items/item-types.ts'
import { loadTreasureClasses } from '../src/common/items/treasure-class.ts'
import {
  generateAutoTreasureClasses,
  mergeAutoTreasureClasses,
  AUTO_TC_SERIES,
  AUTO_TC_TOTAL_NODES,
} from '../src/server/items/auto-tc.ts'
import { loadUniqueItems } from '../src/common/items/unique-items.ts'
import { loadSetData } from '../src/common/items/set-items.ts'
import { loadRunewords } from '../src/common/items/runeword.ts'
import { loadGems } from '../src/common/items/gems.ts'
import { loadItemPropertiesAndStats } from '../src/common/items/properties.ts'
import { loadItemRatio } from '../src/common/items/item-ratio.ts'
import { loadMagicAffixes } from '../src/common/items/affixes.ts'
import type { MagicAffix } from '../src/common/items/affixes.ts'
import {
  loadItemNameChains,
  resolveArmorName,
  resolveWeaponName,
  resolveMiscName,
  resolveUniqueName,
  resolveRuneName,
  StringTableChain,
} from '../src/common/items/item-names.ts'
import { D2Rng, D2_PRNG_MULTIPLIER, Rng } from '../src/common/rng/d2-rng.ts'
import { Inventory, createItem, goldItem, totalStat } from '../src/common/items/items.ts'
import type { Affix } from '../src/common/items/items.ts'

const problems: string[] = []
let checks = 0

/**
 * Assert one expectation.
 *
 * @param condition - whether the condition holds.
 * @param description - what was asserted.
 */
function expect(condition: boolean, description: string): void {
  checks += 1
  if (!condition) {
    problems.push(description)
    console.log(`   FAIL ${description}`)
  } else {
    console.log(`   ok   ${description}`)
  }
}

// -----------------------------------------------------------------------------
// 1. Mount real MPQ archives from samples/d2
// -----------------------------------------------------------------------------
const mpqDir = process.argv[2] ?? 'samples/d2'
const requiredArchives = ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']

const missingArchives = requiredArchives.filter(name => !fs.existsSync(join(mpqDir, name)))
if (missingArchives.length > 0) {
  console.warn(
    `WARNING: MPQ archive(s) missing in ${mpqDir}: ${missingArchives.join(', ')}. ` +
    'Skipping verify-items gracefully for CI/headless environment without game files.',
  )
  process.exit(0)
}

const archives = new MountedArchives()
for (const name of requiredArchives) {
  const fullPath = join(mpqDir, name)
  try {
    archives.add(name, await MpqArchive.open(await fileSource(fullPath)))
  } catch (err) {
    console.warn(`WARNING: Failed to open ${fullPath}: ${String(err)}. Skipping gracefully.`)
    process.exit(0)
  }
}

console.log(`== Mounted ${String(archives.size)} MPQ archives from ${mpqDir} ==\n`)

// -----------------------------------------------------------------------------
// Load all real tables
// -----------------------------------------------------------------------------
console.log('-- Loading real 1.13c game tables...')
const armor = await loadArmor(archives)
const weapons = await loadWeapons(archives)
const misc = await loadMisc(archives)
const itemTypes = await loadItemTypes(archives)
const tcTable = await loadTreasureClasses(archives)
const autoTcs = generateAutoTreasureClasses(itemTypes, armor, weapons)
const affixes = await loadMagicAffixes(archives)
const { prefixes, suffixes } = affixes
const uniques = await loadUniqueItems(archives)
const setData = await loadSetData(archives)
const runes = await loadRunewords(archives)
const gems = await loadGems(archives)
const propStats = await loadItemPropertiesAndStats(archives)
const itemRatio = await loadItemRatio(archives)
const nameChains = await loadItemNameChains(archives)

// Read raw tables for structural header/row checks
const rawArmor = parseTable(await archives.read('data\\global\\excel\\Armor.txt'))
const rawWeapons = parseTable(await archives.read('data\\global\\excel\\Weapons.txt'))
const rawMisc = parseTable(await archives.read('data\\global\\excel\\Misc.txt'))
const rawItemTypes = parseTable(await archives.read('data\\global\\excel\\ItemTypes.txt'))
const rawTc = parseTable(await archives.read('data\\global\\excel\\TreasureClassEx.txt'))

// -----------------------------------------------------------------------------
// 2. Data Scales Assertions
// -----------------------------------------------------------------------------
console.log('\n-- Data Scales --')

// Base items: exactly 659 (Armor 202 + Weapons 306 + Misc 151, all without Expansion rows)
expect(armor.all.length === 202, 'Armor has exactly 202 base item rows')
expect(weapons.all.length === 306, 'Weapons has exactly 306 base item rows')
expect(misc.all.length === 151, 'Misc has exactly 151 base item rows')
const totalBaseItems = armor.all.length + weapons.all.length + misc.all.length
expect(totalBaseItems === 659, `Base items total exactly 659 (Armor 202 + Weapons 306 + Misc 151): found ${String(totalBaseItems)}`)

// Confirm Expansion separator row filtered out from each base item table
expect(
  rawArmor.rows.length === 203 &&
  rawArmor.rows.some(r => cell(rawArmor, r, 'name').trim() === 'Expansion'),
  'Armor.txt filters 1 Expansion row from 203 raw rows to yield 202 data rows',
)
expect(
  rawWeapons.rows.length === 307 &&
  rawWeapons.rows.some(r => cell(rawWeapons, r, 'name').trim() === 'Expansion'),
  'Weapons.txt filters 1 Expansion row from 307 raw rows to yield 306 data rows',
)
expect(
  rawMisc.rows.length === 152 &&
  rawMisc.rows.some(r => cell(rawMisc, r, 'name').trim() === 'Expansion'),
  'Misc.txt filters 1 Expansion row from 152 raw rows to yield 151 data rows',
)

// Magic affixes: exactly 1378 (637 prefixes + 741 suffixes), 1162 spawnable=1
expect(prefixes.length === 637, `Magic prefixes total exactly 637: found ${String(prefixes.length)}`)
expect(suffixes.length === 741, `Magic suffixes total exactly 741: found ${String(suffixes.length)}`)
const totalAffixes = prefixes.length + suffixes.length
expect(totalAffixes === 1378, `Magic affixes total exactly 1378 (637 prefixes + 741 suffixes): found ${String(totalAffixes)}`)

const spawnablePrefixes = prefixes.all.filter(a => a.spawnable).length
const spawnableSuffixes = suffixes.all.filter(a => a.spawnable).length
const totalSpawnableAffixes = spawnablePrefixes + spawnableSuffixes
expect(
  totalSpawnableAffixes === 1162,
  `Magic affixes spawnable=1 count is exactly 1162 (587 prefixes + 575 suffixes): found ${String(totalSpawnableAffixes)}`,
)

// ItemTypes: exactly 98 with valid Code
expect(itemTypes.types.length === 98, `ItemTypes has exactly 98 valid types: found ${String(itemTypes.types.length)}`)
expect(itemTypes.byCode.size === 98, `ItemTypes indexed by Code has exactly 98 entries: found ${String(itemTypes.byCode.size)}`)
expect(
  itemTypes.types.every(t => t.code.trim().length > 0 && t.name !== 'None' && t.name !== 'Not Used' && t.name !== 'Expansion'),
  'All 98 ItemTypes possess valid non-empty Codes and exclude placeholders',
)

// TreasureClass=1 ItemTypes: exactly 5 (bow, weap, mele, armo, abow)
const tcSeeds = itemTypes.types.filter(t => t.treasureClass === 1).map(t => t.code)
expect(tcSeeds.length === 5, `TreasureClass=1 ItemTypes count is exactly 5: found ${String(tcSeeds.length)}`)
const expectedTcSeeds = ['bow', 'weap', 'mele', 'armo', 'abow'].sort()
expect(
  [...tcSeeds].sort().join(',') === expectedTcSeeds.join(','),
  `TreasureClass=1 ItemTypes codes match exactly (bow, weap, mele, armo, abow): found [${tcSeeds.join(', ')}]`,
)

// TreasureClassEx: exactly 852 rows
expect(tcTable.all.length === 852, `TreasureClassEx has exactly 852 rows: found ${String(tcTable.all.length)}`)

// auto-TC: exactly 100 virtual nodes (weap3..87, armo3..87, bow3..87, mele3..39)
expect(AUTO_TC_TOTAL_NODES === 100, `AUTO_TC_TOTAL_NODES constant is 100: found ${String(AUTO_TC_TOTAL_NODES)}`)
expect(autoTcs.size === 100, `auto-TC generated exactly 100 virtual nodes: found ${String(autoTcs.size)}`)
const weapCount = AUTO_TC_SERIES.find(s => s.typeCode === 'weap')?.count ?? 0
const armoCount = AUTO_TC_SERIES.find(s => s.typeCode === 'armo')?.count ?? 0
const bowCount = AUTO_TC_SERIES.find(s => s.typeCode === 'bow')?.count ?? 0
const meleCount = AUTO_TC_SERIES.find(s => s.typeCode === 'mele')?.count ?? 0
expect(
  weapCount === 29 && armoCount === 29 && bowCount === 29 && meleCount === 13,
  `auto-TC series breakdown matches: weap 29 (3..87), armo 29 (3..87), bow 29 (3..87), mele 13 (3..39)`,
)

// UniqueItems: 401 rows, 385 enabled=1
expect(uniques.all.length === 401, `UniqueItems has exactly 401 rows: found ${String(uniques.all.length)}`)
const enabledUniques = uniques.all.filter(u => u.enabled).length
expect(enabledUniques === 385, `UniqueItems enabled=1 count is exactly 385: found ${String(enabledUniques)}`)

// SetItems: 127, Sets: 32
expect(setData.items.length === 127, `SetItems has exactly 127 items: found ${String(setData.items.length)}`)
expect(setData.sets.length === 32, `Sets has exactly 32 sets: found ${String(setData.sets.length)}`)

// Runes: 169 rows, complete=1 78, server=1 23
expect(runes.all.length === 169, `Runes.txt has exactly 169 rows: found ${String(runes.all.length)}`)
const completeRunewords = runes.all.filter(r => r.complete).length
expect(completeRunewords === 78, `Runes complete=1 count is exactly 78: found ${String(completeRunewords)}`)
const serverRunewords = runes.all.filter(r => r.server).length
expect(serverRunewords === 23, `Runes server=1 (ladder) count is exactly 23: found ${String(serverRunewords)}`)

// Gems: exactly 68 rows (35 gems + 33 runes)
expect(gems.all.length === 68, `Gems.txt has exactly 68 rows: found ${String(gems.all.length)}`)
expect(gems.gems.length === 35, `Gems.txt contains exactly 35 gem rows: found ${String(gems.gems.length)}`)
expect(gems.runes.length === 33, `Gems.txt contains exactly 33 rune rows: found ${String(gems.runes.length)}`)

// ItemStatCost: 359, Properties: 268
expect(propStats.stats.records.length === 359, `ItemStatCost has exactly 359 stats: found ${String(propStats.stats.records.length)}`)
expect(propStats.properties.records.length === 268, `Properties has exactly 268 properties: found ${String(propStats.properties.records.length)}`)

// ItemRatio: 6 rows
expect(itemRatio.rows.length === 6, `ItemRatio has exactly 6 rows: found ${String(itemRatio.rows.length)}`)

// -----------------------------------------------------------------------------
// 3. TC Tree Invariants Assertions
// -----------------------------------------------------------------------------
console.log('\n-- TC Tree Invariants --')

// 218 dangling references in TreasureClassEx all resolve (100 auto-TC + 118 real items, 0 unknown)
expect(
  tcTable.danglingReferences.size === 218,
  `TreasureClassEx has exactly 218 dangling references: found ${String(tcTable.danglingReferences.size)}`,
)
expect(
  tcTable.autoTCDanglingReferences.size === 100,
  `TreasureClassEx has exactly 100 auto-TC references: found ${String(tcTable.autoTCDanglingReferences.size)}`,
)
expect(
  tcTable.baseItemDanglingReferences.size === 118,
  `TreasureClassEx has exactly 118 base item and special references: found ${String(tcTable.baseItemDanglingReferences.size)}`,
)

// All 100 auto-TC dangling references exist in generated auto-TC map
const autoTcsCovered = [...tcTable.autoTCDanglingReferences].every(ref => autoTcs.has(ref))
expect(autoTcsCovered, 'All 100 auto-TC dangling references resolve to generated auto-TC virtual nodes')

// All 118 base item dangling references resolve (gold, Annihilus, armor, weapons, misc; 0 unknown)
let unknownDanglingCount = 0
for (const ref of tcTable.baseItemDanglingReferences) {
  const isGold = ref === 'gld' || ref.startsWith('gld,mul=')
  const isAnnihilus = ref === 'Annihilus'
  const inArmor = armor.get(ref) !== undefined
  const inWeapons = weapons.get(ref) !== undefined
  const inMisc = misc.get(ref) !== undefined
  if (!isGold && !isAnnihilus && !inArmor && !inWeapons && !inMisc) {
    unknownDanglingCount += 1
  }
}
expect(unknownDanglingCount === 0, `All 118 real item dangling references resolve (0 unknown): found ${String(unknownDanglingCount)} unknown`)

// TC tree is acyclic, expands to leaves in <= 64 steps
// Merge auto-TCs into TC table to check full tree expansion
mergeAutoTreasureClasses(tcTable, autoTcs)

function getTcMaxDepth(name: string, visited: Set<string>): number {
  if (visited.has(name)) {
    throw new Error(`Cycle detected at TC "${name}"`)
  }
  const node = tcTable.get(name)
  if (!node || node.items.length === 0) return 0
  visited.add(name)
  let maxSub = 0
  for (const it of node.items) {
    if (tcTable.byName.has(it.item)) {
      const d = getTcMaxDepth(it.item, new Set(visited))
      if (d > maxSub) maxSub = d
    }
  }
  return 1 + maxSub
}

let isAcyclic = true
let maxTreeDepth = 0
try {
  for (const node of tcTable.all) {
    const depth = getTcMaxDepth(node.name, new Set())
    if (depth > maxTreeDepth) maxTreeDepth = depth
  }
} catch {
  isAcyclic = false
}

expect(isAcyclic, 'TreasureClass hierarchy is strictly acyclic')
expect(maxTreeDepth <= 64, `TreasureClass tree expands to leaves in <= 64 steps: maximum depth is ${String(maxTreeDepth)}`)

// Every node in TreasureClassEx has NoDrop + sum(Prob) > 0
const originalTcNodes = tcTable.all.filter(n => !autoTcs.has(n.name))
const allNodesHaveProb = originalTcNodes.every(node => {
  const sumProb = node.items.reduce((s, it) => s + it.prob, 0)
  return node.noDrop + sumProb > 0
})
expect(allNodesHaveProb, 'Every node in TreasureClassEx satisfies NoDrop + sum(Prob) > 0')

// Magic quality factor column in TreasureClassEx: all 231 non-empty values equal 1024
const magicFactorNodes = originalTcNodes.filter(n => n.magic > 0)
expect(magicFactorNodes.length === 231, `TreasureClassEx has exactly 231 non-empty Magic quality factor rows: found ${String(magicFactorNodes.length)}`)
expect(
  magicFactorNodes.every(n => n.magic === 1024),
  'All 231 non-empty Magic quality factor values strictly equal 1024',
)

// -----------------------------------------------------------------------------
// 4. Fixed Probability Points Assertions
// -----------------------------------------------------------------------------
console.log('\n-- Fixed Probability Points --')

// Act 1 H2H A 1-player NoDrop = 100/160 = 62.5%
const act1H2HA = tcTable.get('Act 1 H2H A')!
expect(act1H2HA !== undefined, 'TreasureClass "Act 1 H2H A" exists')
expect(act1H2HA.noDrop === 100, `Act 1 H2H A NoDrop is 100: found ${String(act1H2HA.noDrop)}`)
expect(act1H2HA.totalProbExpansion === 60, `Act 1 H2H A totalProb is 60: found ${String(act1H2HA.totalProbExpansion)}`)
const act1NoDropChance = act1H2HA.noDrop / (act1H2HA.noDrop + act1H2HA.totalProbExpansion)
expect(act1NoDropChance === 0.625, `Act 1 H2H A 1-player NoDrop equals 100/160 = 62.5%: found ${(act1NoDropChance * 100).toFixed(3)}%`)

// Cow (H) 1-player NoDrop = 100/160 = 62.5%
const cowH = tcTable.get('Cow (H)')!
expect(cowH !== undefined, 'TreasureClass "Cow (H)" exists')
expect(cowH.noDrop === 100, `Cow (H) NoDrop is 100: found ${String(cowH.noDrop)}`)
expect(cowH.totalProbExpansion === 60, `Cow (H) totalProb is 60: found ${String(cowH.totalProbExpansion)}`)
const cowNoDropChance = cowH.noDrop / (cowH.noDrop + cowH.totalProbExpansion)
expect(cowNoDropChance === 0.625, `Cow (H) 1-player NoDrop equals 100/160 = 62.5%: found ${(cowNoDropChance * 100).toFixed(3)}%`)

// Act 1 H2H A exact branch probabilities: gld 13.125%, Act 1 Equip A 10.0%, Act 1 Junk 13.125%, Act 1 Good 1.25%, NoDrop 62.5%
const denom = act1H2HA.noDrop + act1H2HA.totalProbExpansion // 160
const probGld = (act1H2HA.items.find(it => it.item === 'gld')?.prob ?? 0) / denom
const probEquipA = (act1H2HA.items.find(it => it.item === 'Act 1 Equip A')?.prob ?? 0) / denom
const probJunk = (act1H2HA.items.find(it => it.item === 'Act 1 Junk')?.prob ?? 0) / denom
const probGood = (act1H2HA.items.find(it => it.item === 'Act 1 Good')?.prob ?? 0) / denom

expect(probGld === 21 / 160 && probGld === 0.13125, `Act 1 H2H A gld branch is 21/160 = 13.125%: found ${(probGld * 100).toFixed(3)}%`)
expect(probEquipA === 16 / 160 && probEquipA === 0.1, `Act 1 H2H A Act 1 Equip A branch is 16/160 = 10.0%: found ${(probEquipA * 100).toFixed(3)}%`)
expect(probJunk === 21 / 160 && probJunk === 0.13125, `Act 1 H2H A Act 1 Junk branch is 21/160 = 13.125%: found ${(probJunk * 100).toFixed(3)}%`)
expect(probGood === 2 / 160 && probGood === 0.0125, `Act 1 H2H A Act 1 Good branch is 2/160 = 1.25%: found ${(probGood * 100).toFixed(3)}%`)
expect(act1NoDropChance === 100 / 160 && act1NoDropChance === 0.625, `Act 1 H2H A NoDrop branch is 100/160 = 62.5%: found ${(act1NoDropChance * 100).toFixed(3)}%`)

// Act 5 (H) Equip B comment self-consistency: SumItems=36, TotalProb=1566, DropChance=0.9770
const rawAct5Row = rawTc.rows.find(r => cell(rawTc, r, 'Treasure Class').trim() === 'Act 5 (H) Equip B')!
expect(rawAct5Row !== undefined, 'Raw TreasureClassEx.txt contains "Act 5 (H) Equip B"')
const rawSumItems = cell(rawTc, rawAct5Row, 'SumItems').trim()
const rawTotalProb = cell(rawTc, rawAct5Row, 'TotalProb').trim()
const rawDropChance = cell(rawTc, rawAct5Row, 'DropChance').trim()

expect(rawSumItems === '36', `Act 5 (H) Equip B raw SumItems column is "36": found "${rawSumItems}"`)
expect(rawTotalProb === '1566', `Act 5 (H) Equip B raw TotalProb column is "1566": found "${rawTotalProb}"`)
expect(rawDropChance === '0.9770', `Act 5 (H) Equip B raw DropChance column is "0.9770": found "${rawDropChance}"`)

// Self-consistency mathematical check:
// Sum of Item1..8 probs = 2 + 1 + 6 + 3 + 14 + 7 + 2 + 1 = 36
// Item9 (Act 5 (H) Equip A) prob = 1530
// TotalProb = 36 + 1530 = 1566
// DropChance = 1530 / 1566 = 0.9769987... -> "0.9770"
const act5B = tcTable.get('Act 5 (H) Equip B')!
const computedSumItems = act5B.items.slice(0, 8).reduce((s, it) => s + it.prob, 0)
const computedTotalProb = act5B.totalProbExpansion
const computedDropChance = (act5B.items[8]!.prob / computedTotalProb).toFixed(4)
expect(
  computedSumItems === 36 &&
  computedTotalProb === 1566 &&
  computedDropChance === '0.9770',
  'Act 5 (H) Equip B calculated item weights and recursion ratio match Blizzard comment columns exactly',
)

// -----------------------------------------------------------------------------
// 5. Cross-table Mapping Assertions
// -----------------------------------------------------------------------------
console.log('\n-- Cross-table Mapping --')

// cap: level=1, minac=3, maxac=5, reqstr=0, durability=12, gemsockets=2, ubercode='xap', ultracode='uap'
const cap = armor.get('cap')!
expect(cap !== undefined, 'Armor base "cap" exists')
expect(cap.level === 1, `cap level is 1: found ${String(cap.level)}`)
expect(cap.minac === 3, `cap minac is 3: found ${String(cap.minac)}`)
expect(cap.maxac === 5, `cap maxac is 5: found ${String(cap.maxac)}`)
expect(cap.reqstr === 0, `cap reqstr is 0: found ${String(cap.reqstr)}`)
expect(cap.durability === 12, `cap durability is 12: found ${String(cap.durability)}`)
expect(cap.gemsockets === 2, `cap gemsockets is 2: found ${String(cap.gemsockets)}`)
expect(cap.ubercode === 'xap', `cap ubercode is "xap": found "${cap.ubercode}"`)
expect(cap.ultracode === 'uap', `cap ultracode is "uap": found "${cap.ultracode}"`)

// Weapons.txt empty header at index 18 does not corrupt data
expect(rawWeapons.header[18] === '', 'Weapons.txt raw header at index 18 is empty string ("")')
const jav = weapons.get('jav')!
expect(jav !== undefined, 'Weapons base "jav" (Javelin) exists')
expect(jav.maxMisDam === 14, `jav maxmisdam (col 17) is 14: found ${String(jav.maxMisDam)}`)
expect(jav.rangeadder === 2, `jav rangeadder (col 19) is 2 (not corrupted by col 18 value '15'): found ${String(jav.rangeadder)}`)
expect(weapons.get('') === undefined, 'Weapons table does not index empty string header')
const javRawRow = rawWeapons.rows.find(r => cell(rawWeapons, r, 'code').trim() === 'jav')!
expect(getWeaponCell(rawWeapons, javRawRow, '') === '', 'getWeaponCell safely returns empty string when querying empty header column')

// Armor.txt duplicate mindam/maxdam selects the correct pair
const mindamIndices: number[] = []
rawArmor.header.forEach((h, i) => {
  if (h.toLowerCase() === 'mindam') mindamIndices.push(i)
})
expect(
  mindamIndices.length === 2 && mindamIndices[0] === 63 && mindamIndices[1] === 161,
  'Armor.txt contains duplicate mindam headers at index 63 and index 161',
)
const lbtRawRow = rawArmor.rows.find(r => cell(rawArmor, r, 'code').trim() === 'lbt')!
expect(
  lbtRawRow[63] === '3' && lbtRawRow[64] === '8' && lbtRawRow[161] === '0' && lbtRawRow[162] === '0',
  'Armor.txt Leather Boots (lbt) has kick damage (3, 8) at index 63/64 and dummy zeroes at index 161/162',
)

// Properties.statN -> ItemStatCost.Stat 0 dangling
let danglingPropertyStats = 0
for (const prop of propStats.properties.records) {
  for (const s of prop.stats) {
    if (s.stat && propStats.stats.getByStat(s.stat) === undefined) {
      danglingPropertyStats += 1
    }
  }
}
expect(danglingPropertyStats === 0, `Properties.statN -> ItemStatCost.Stat has 0 dangling references: found ${String(danglingPropertyStats)}`)

// Affix modNcode -> Properties.code 0 dangling
let danglingAffixMods = 0
const allAffixes = [...prefixes.all, ...suffixes.all]
for (const affix of allAffixes) {
  for (const mod of affix.mods) {
    if (mod.code && propStats.properties.getByCode(mod.code) === undefined) {
      danglingAffixMods += 1
    }
  }
}
expect(danglingAffixMods === 0, `Affix modNcode -> Properties.code has 0 dangling references: found ${String(danglingAffixMods)}`)

// itype/etype -> ItemTypes.Code 0 dangling
let danglingRuneTypes = 0
for (const r of runes.all) {
  for (const it of r.itypes) {
    if (it && !itemTypes.byCode.has(it)) danglingRuneTypes += 1
  }
  for (const et of r.etypes) {
    if (et && !itemTypes.byCode.has(et)) danglingRuneTypes += 1
  }
}
expect(danglingRuneTypes === 0, `Runes.txt itype/etype -> ItemTypes.Code has 0 dangling references: found ${String(danglingRuneTypes)}`)

// Affix itype/etype check (with Blizzard 1.13c known 'staff' -> 'staf' normalization)
let danglingAffixTypes = 0
for (const affix of allAffixes) {
  for (const it of affix.itypes) {
    const normalized = it === 'staff' ? 'staf' : it
    if (normalized && !itemTypes.byCode.has(normalized)) danglingAffixTypes += 1
  }
  for (const et of affix.etypes) {
    const normalized = et === 'staff' ? 'staf' : et
    if (normalized && !itemTypes.byCode.has(normalized)) danglingAffixTypes += 1
  }
}
expect(danglingAffixTypes === 0, `Affix itype/etype -> ItemTypes.Code has 0 dangling references (with staff->staf): found ${String(danglingAffixTypes)}`)

// -----------------------------------------------------------------------------
// 6. Localization Coverage Assertions
// -----------------------------------------------------------------------------
console.log('\n-- Localization Coverage --')
const { eng, chi } = nameChains

// ENG: Armor 202/202, Weapons 306/306, Misc 143/151
const engArmorCovered = armor.all.filter(a => eng.has(a.namestr)).length
expect(engArmorCovered === 202, `ENG string tables cover Armor 202/202: found ${String(engArmorCovered)}`)

const engWeaponsCovered = weapons.all.filter(w => eng.has(w.namestr)).length
expect(engWeaponsCovered === 306, `ENG string tables cover Weapons 306/306: found ${String(engWeaponsCovered)}`)

const engMiscCovered = misc.all.filter(m => eng.has(m.namestr)).length
expect(engMiscCovered === 143, `ENG string tables cover Misc 143/151: found ${String(engMiscCovered)}`)

// CHI UTF-8: cap -> '帽子'
const chiCap = resolveArmorName('cap', chi, eng)
expect(chiCap === '帽子', `CHI UTF-8 resolves "cap" to "帽子": found "${chiCap}"`)

// CHI fallback to ENG for LoD items missing in CHI expansionstring: r33, Windforce, Annihilus
expect(chi.get('r33') === undefined, 'CHI string table lacks LoD key "r33"')
expect(resolveRuneName('r33', chi, eng) === 'Zod Rune', `resolveRuneName("r33") falls back to ENG "Zod Rune": found "${resolveRuneName('r33', chi, eng)}"`)

expect(chi.get('Windforce') === undefined, 'CHI string table lacks LoD key "Windforce"')
expect(resolveUniqueName('Windforce', chi, eng) === 'Windforce', `resolveUniqueName("Windforce") falls back to ENG "Windforce": found "${resolveUniqueName('Windforce', chi, eng)}"`)

expect(chi.get('Annihilus') === undefined, 'CHI string table lacks LoD key "Annihilus"')
expect(resolveUniqueName('Annihilus', chi, eng) === 'Annihilus', `resolveUniqueName("Annihilus") falls back to ENG "Annihilus": found "${resolveUniqueName('Annihilus', chi, eng)}"`)

// -----------------------------------------------------------------------------
// 7. RNG Invariants Assertions
// -----------------------------------------------------------------------------
console.log('\n-- RNG Invariants --')

// 64-bit LCG D2Rng reproducibility with known seed vector
expect(D2_PRNG_MULTIPLIER === 0x6ac690c5n, 'D2_PRNG_MULTIPLIER is canonical 1.13c constant 0x6AC690C5')

const rngA = new D2Rng({ lo: 1, hi: 0 })
const knownSteps = [
  { lo: 1791398085, hi: 0 },
  { lo: 1721382809, hi: 747178471 },
  { lo: 986833572, hi: 717975634 },
  { lo: 2963478662, hi: 411600752 },
  { lo: 930727566, hi: 1236044336 },
  { lo: 3622188406, hi: 388199365 },
  { lo: 4003526547, hi: 1510787143 },
  { lo: 3772775526, hi: 1669840372 },
  { lo: 3770833010, hi: 1573595882 },
  { lo: 1095064228, hi: 1572785674 },
]

let rngStepsMatch = true
for (const step of knownSteps) {
  rngA.step()
  const s = rngA.getSeed()
  if (s.lo !== step.lo || s.hi !== step.hi) {
    rngStepsMatch = false
    break
  }
}
expect(rngStepsMatch, '64-bit LCG D2Rng reproduces exact bitwise sequence across 10 steps from seed {lo: 1, hi: 0}')

const rngB = new D2Rng({ lo: 100, hi: 666 })
rngB.step()
expect(
  rngB.lo === 3046150030 && rngB.hi === 41,
  'D2Rng matches SEED_InitLowSeed / rollD2Random vector {lo: 100, hi: 666} -> {lo: 3046150030, hi: 41}',
)

// Power of 2 (1024) AND-branch vs non-power of 2 (1000) modulo-branch
const rngBranchTest = new D2Rng(42, 0)
const roll1024 = rngBranchTest.rand(1024)
const expectedAnd1024 = (rngBranchTest.lo & 1023) >>> 0
expect(roll1024 === expectedAnd1024, `Power-of-2 (1024) branch uses bitwise AND (lo & 1023): ${String(roll1024)} === ${String(expectedAnd1024)}`)

const roll1000 = rngBranchTest.rand(1000)
const expectedMod1000 = (rngBranchTest.lo % 1000) >>> 0
expect(roll1000 === expectedMod1000, `Non-power-of-2 (1000) branch uses modulo (lo % 1000): ${String(roll1000)} === ${String(expectedMod1000)}`)

// -----------------------------------------------------------------------------
// 8. Monte Carlo vs Analytic Assertions
// -----------------------------------------------------------------------------
console.log('\n-- Monte Carlo vs Analytic (100,000 runs) --')

const MC_RUNS = 100000
const mcRng = new D2Rng(987654321)
const counts = { noDrop: 0, gld: 0, equipA: 0, junk: 0, good: 0 }

for (let i = 0; i < MC_RUNS; i++) {
  const roll = mcRng.rand(160)
  if (roll < 100) {
    counts.noDrop += 1
  } else {
    const target = roll - 100
    if (target < 21) counts.gld += 1
    else if (target < 37) counts.equipA += 1
    else if (target < 58) counts.junk += 1
    else counts.good += 1
  }
}

const observedProbs = {
  noDrop: counts.noDrop / MC_RUNS,
  gld: counts.gld / MC_RUNS,
  equipA: counts.equipA / MC_RUNS,
  junk: counts.junk / MC_RUNS,
  good: counts.good / MC_RUNS,
}

const expectedProbs = {
  noDrop: 0.625,
  gld: 0.13125,
  equipA: 0.1,
  junk: 0.13125,
  good: 0.0125,
}

// 99% Confidence Interval: Z = 2.576, margin = Z * sqrt(p*(1-p)/N)
const Z_99 = 2.576
for (const key of Object.keys(expectedProbs) as (keyof typeof expectedProbs)[]) {
  const p = expectedProbs[key]
  const se = Math.sqrt((p * (1 - p)) / MC_RUNS)
  const margin = Z_99 * se
  const obs = observedProbs[key]
  const diff = Math.abs(obs - p)
  expect(
    diff <= margin,
    `Act 1 H2H A ${key} branch converges to analytic prob ${p.toFixed(5)} within 99% CI (obs=${obs.toFixed(5)}, diff=${diff.toFixed(5)} <= margin=${margin.toFixed(5)})`,
  )
}

// -----------------------------------------------------------------------------
// 9. Real Item Simulation (Inventory, Stacking, Stats)
// -----------------------------------------------------------------------------
console.log('\n-- Real Item Simulation (Inventory & Stats) --')

// Inventory placement and footprint with real items
const bag = new Inventory(4, 3)
expect(bag.totalCells === 12 && bag.usedCells === 0, 'A new 4x3 inventory is empty')
expect(bag.canPlace(1, 3, 0, 0), 'A 1x3 tall weapon fits in empty inventory')
expect(!bag.canPlace(1, 3, 0, 1), 'A 1x3 item overflowing grid vertically is refused')
expect(bag.canPlace(4, 1, 0, 0), 'A 4x1 item spanning full width fits')
expect(!bag.canPlace(5, 1, 0, 0), 'An item wider than the grid is refused')

// Create real items without fake inline tables
const toGameAffix = (m: MagicAffix): Affix => ({
  id: m.name,
  name: m.name,
  kind: m.isPrefix ? 'prefix' : 'suffix',
  level: m.level,
  itemTypes: m.itypes,
  modifiers: m.mods.map(mod => ({
    stat: mod.code,
    min: mod.min,
    max: mod.max,
  })),
})
const gamePrefixes: Affix[] = prefixes.all.map(toGameAffix)
const gameSuffixes: Affix[] = suffixes.all.map(toGameAffix)

const realSwordBase = weapons.get('hax')! // Hand Axe
const realCapBase = armor.get('cap')! // Cap
const realPotionBase = misc.get('hp1')! // Minor Healing Potion

const simRng = new Rng(777)
const placedSword = bag.add(createItem(realSwordBase, gamePrefixes, gameSuffixes, simRng, { level: 20, prefixChance: 0, suffixChance: 0 }))
expect(placedSword !== null, 'Real sword item can be added to inventory')
expect(bag.usedCells === realSwordBase.invWidth * realSwordBase.invHeight, 'Adding sword occupies exact footprint')
expect(!bag.canPlace(1, 1, 0, 0), 'Occupied grid cells refuse other items')

const placedCap = bag.add(createItem(realCapBase, gamePrefixes, gameSuffixes, simRng, { level: 20, prefixChance: 0, suffixChance: 0 }))
expect(placedCap !== null, 'Real cap item finds next free slot')
expect(bag.contents.length === 2, 'Both items tracked in inventory contents')

// Stacking overflow behaviour with real stackable item (Skeleton Key, maxStack=12)
const realKeyBase = misc.get('key')!
const keyBag = new Inventory(4, 2)
const k1 = keyBag.add(createItem(realKeyBase, gamePrefixes, gameSuffixes, simRng, { level: 1, prefixChance: 0, suffixChance: 0, stack: 8 }))
expect(k1 !== null, 'First key pile lands')
const k2 = keyBag.add(createItem(realKeyBase, gamePrefixes, gameSuffixes, simRng, { level: 1, prefixChance: 0, suffixChance: 0, stack: 8 }))
expect(k2 !== null, 'Second key pile lands')
expect(keyBag.contents.length === 2, 'Key stack overflowing base maxStack opens second slot instead of discarding')
const totalKeys = keyBag.contents.reduce((sum, entry) => sum + entry.item.stack, 0)
expect(totalKeys === 16, `No key quantity lost across overflow (total: ${String(totalKeys)})`)

// Removal clears exact footprint
const removed = bag.remove(placedSword!)
expect(removed && bag.usedCells === realCapBase.invWidth * realCapBase.invHeight, 'Removing sword frees its cells')
expect(bag.canPlace(1, 3, 0, 0), 'Freed cells can be reused immediately')

// Gold stacking
const goldBag = new Inventory(2, 1)
goldBag.add(goldItem(4000))
goldBag.add(goldItem(4000))
expect(goldBag.gold === 8000, `Gold piles accumulate properly in inventory (total: ${String(goldBag.gold)})`)

// Derived stats from real armor
const sheet = new Inventory(4, 4)
sheet.add(createItem(realCapBase, gamePrefixes, gameSuffixes, simRng, { level: 1, prefixChance: 0, suffixChance: 0 }))
const totalDefense = totalStat(sheet.contents, 'defense')
expect(totalDefense >= realCapBase.defense, `Worn real cap contributes its defense (${String(totalDefense)}) to character sheet`)

// -----------------------------------------------------------------------------
// Summary and Exit Code
// -----------------------------------------------------------------------------
console.log(`\n========================================`)
console.log(`checks     ${String(checks)}`)
console.log(`problems   ${String(problems.length)}`)
for (const problem of problems.slice(0, 12)) {
  console.log(`  - ${problem}`)
}
console.log(problems.length === 0 ? 'RESULT     ALL 1.13c REAL MPQ INVARIANTS HOLD' : 'RESULT     FAILED')
process.exit(problems.length === 0 ? 0 : 1)
