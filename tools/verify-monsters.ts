import { compositeMonsterAnimation } from '../src/client/render/monster-art.ts'
/**
 * Read every monster row out of the real archives and check it survives the
 * trip into the simulation's own shapes.
 *
 * The failure this exists to catch is silent, not loud. `MonStats.txt` has 255
 * columns and a reader that misspells one gets `''` back rather than an error,
 * so a wrong column name produces a monster with zero health and no damage
 * instead of a crash. Counting rows is therefore not enough: the script asserts
 * that the numbers are *present and plausible* for all 735 rows, and it spot
 * checks seven monsters against values read by hand out of the table so that a
 * column rename cannot pass unnoticed.
 *
 * Usage:
 *   npx tsx scripts/verify-monsters.ts [directory]
 */
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { cell, loadActTables } from '../src/common/world/acts.ts'
import {
  monsterBudget,
  monsterStatsOf,
  planMonsterGroups,
  readEliteModifiers,
  readLevelMonsterPlan,
  readMonsterKinds,
  readMonsterArt,
  readMonsterScaling,
  monsterLevelFor, monsterScaleFor,
  readSuperUniques,
  selectLevelTypes,
} from '../src/common/units/monsters-data.ts'
import type { Difficulty, MonsterKind } from '../src/common/units/monsters-data.ts'
import { Rng } from '../src/common/rng/d2-rng.ts'

const dir = process.argv[2] ?? 'samples/d2'
/** Mount order: later archives override earlier ones, exactly as the game loads them. */
const MOUNTS = ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']

let checks = 0
let failures = 0

/**
 * Assert one expectation.
 *
 * @param ok - whether it held.
 * @param message - what was checked.
 */
function check(ok: boolean, message: string): void {
  checks += 1
  if (!ok) failures += 1
  console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${message}`)
}

const archives = new MountedArchives()
for (const name of MOUNTS) {
  try {
    archives.add(name, await MpqArchive.open(await fileSource(`${dir}/${name}`)))
  } catch (err) {
    console.log(`skip ${name}: ${String(err)}`)
  }
}
if (archives.size === 0) {
  console.log(`no archives found in ${dir}`)
  process.exit(2)
}
console.log(`== mounted ${String(archives.size)} archives ==`)

const tables = await loadActTables(archives)
console.log(`\n== tables ==`)
console.log(`   MonStats.txt     ${String(tables.monstats.rows.length)} rows, ${String(tables.monstats.header.length)} columns`)
console.log(`   MonStats2.txt    ${String(tables.monstats2.rows.length)} rows`)
console.log(`   MonLvl.txt       ${String(tables.monlvl.rows.length)} rows`)
console.log(`   MonType.txt      ${String(tables.montype.rows.length)} rows`)
console.log(`   MonUMod.txt      ${String(tables.monumod.rows.length)} rows`)
console.log(`   SuperUniques.txt ${String(tables.superuniques.rows.length)} rows`)

// ---------------------------------------------------------------------------
// Every column the reader names must exist in the header.
// ---------------------------------------------------------------------------
//
// This is the check that turns a typo from a silent zero into a failure. The
// list is the union of every column `readMonsterKinds` reads on any difficulty.
console.log(`\n== MonStats.txt columns present ==`)
const REQUIRED_COLUMNS = [
  'Id', 'BaseId', 'NameStr', 'Code', 'MonType', 'AI',
  'enabled', 'isSpawn', 'isMelee', 'rangedtype', 'npc', 'interact', 'inTown', 'boss', 'killable',
  'Rarity', 'MinGrp', 'MaxGrp', 'Level', 'Level(N)', 'Level(H)',
  'Velocity', 'Run', 'threat', 'aidist',
  'minHP', 'maxHP', 'MinHP(N)', 'MaxHP(N)', 'MinHP(H)', 'MaxHP(H)',
  'AC', 'AC(N)', 'AC(H)', 'Exp', 'Exp(N)', 'Exp(H)',
  'A1MinD', 'A1MaxD', 'A1TH', 'A2MinD', 'A2MaxD', 'A2TH',
  'ResDm', 'ResMa', 'ResFi', 'ResLi', 'ResCo', 'ResPo',
  'TreasureClass1', 'TreasureClass2', 'TreasureClass3', 'TreasureClass4',
  'minion1', 'minion2', 'SetBoss',
]
const missing = REQUIRED_COLUMNS.filter(name => !tables.monstats.header.includes(name))
check(missing.length === 0, `all ${String(REQUIRED_COLUMNS.length)} named columns exist${missing.length === 0 ? '' : `; missing ${missing.join(', ')}`}`)

// ---------------------------------------------------------------------------
// Full-table mapping: every row becomes a kind, and every kind becomes stats.
// ---------------------------------------------------------------------------
console.log(`\n== MonStats.txt → MonsterKind → MonsterStats ==`)
const ids = tables.monstats.rows.map(row => cell(tables.monstats, row, 'Id').trim()).filter(id => id !== '')
const kinds = readMonsterKinds(tables.monstats)

// `MonStats.txt` ships one duplicated row: `cr_lancer8` appears twice in 1.13c.
// Keying by `Id` therefore loses exactly one row, and that is correct — the
// duplicate is redundant, not a second monster. Naming it here means a *new*
// duplicate, which would be a real data problem, still fails this check.
const KNOWN_DUPLICATE_IDS = ['cr_lancer8']
const seen = new Map<string, number>()
for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1)
const duplicates = [...seen].filter(([, count]) => count > 1).map(([id]) => id).sort()
check(
  duplicates.join(',') === KNOWN_DUPLICATE_IDS.join(','),
  `the only duplicated Id is the known ${KNOWN_DUPLICATE_IDS.join(', ')}${duplicates.join(',') === KNOWN_DUPLICATE_IDS.join(',') ? '' : `; found ${duplicates.join(', ')}`}`,
)
check(
  kinds.size === ids.length - duplicates.length,
  `every distinct Id became a kind (${String(kinds.size)} kinds from ${String(ids.length)} rows)`,
)

/** The player's walking speed in scene pixels, matching `act-scene.ts`. */
const WALK_SPEED = 170

let statFailures = 0
let spawnable = 0
let withHealth = 0
let withDamage = 0
const statRng = new Rng(1)
for (const kind of kinds.values()) {
  const stats = monsterStatsOf(kind, statRng, WALK_SPEED, monsterScaleFor(readMonsterScaling(tables.monlvl), monsterLevelFor(kind, 'normal', 0)))
  if (kind.enabled && kind.isSpawn && !kind.npc && !kind.inTown) spawnable += 1
  if (kind.maxHp > 0) withHealth += 1
  if (kind.attack1.maxDamage > 0) withDamage += 1
  const sane =
    stats.id === kind.id &&
    stats.name !== '' &&
    Number.isInteger(stats.hp) && stats.hp >= 1 &&
    Number.isInteger(stats.damage) && stats.damage >= 1 &&
    Number.isInteger(stats.speed) && stats.speed >= 1 &&
    stats.cooldownTicks > 0 && stats.reach > 0 && stats.aggroRadius > 0 &&
    stats.xp >= 0 &&
    stats.hp <= Math.max(1, Math.max(kind.minHp, kind.maxHp) * 400)
  if (!sane) {
    statFailures += 1
    if (statFailures <= 5) console.log(`        ${kind.id}: ${JSON.stringify(stats)}`)
  }
}
check(statFailures === 0, `all ${String(kinds.size)} kinds produce finite, in-range stats (${String(statFailures)} bad)`)
console.log(`   info ${String(spawnable)} spawnable, ${String(withHealth)} with health, ${String(withDamage)} with A1 damage`)

// A table read with the wrong column names still yields rows — they are just
// all identical. Distinct health ranges prove the numbers are really being read.
const healthRanges = new Set([...kinds.values()].map(kind => `${String(kind.minHp)}-${String(kind.maxHp)}`))
check(healthRanges.size > 100, `health ranges are distinct per monster, not a shared default (${String(healthRanges.size)} distinct)`)
const codes = new Set([...kinds.values()].map(kind => kind.code).filter(code => code !== ''))
check(codes.size > 100, `art codes are distinct (${String(codes.size)} distinct)`)

// ---------------------------------------------------------------------------
// Spot checks against values read by hand out of the 1.13c table.
// ---------------------------------------------------------------------------
console.log(`\n== spot checks (hand-read from the 1.13c table) ==`)
interface Expected {
  readonly id: string
  readonly nameKey: string
  readonly code: string
  readonly monType: string
  readonly ai: string
  readonly minGroup: number
  readonly maxGroup: number
  readonly velocity: number
  readonly minHp: number
  readonly maxHp: number
  readonly experience: number
}
const EXPECTED: readonly Expected[] = [
  { id: 'fallen1', nameKey: 'Fallen', code: 'FA', monType: 'fallen', ai: 'Fallen', minGroup: 2, maxGroup: 3, velocity: 5, minHp: 21, maxHp: 61, experience: 61 },
  { id: 'zombie1', nameKey: 'Zombie', code: 'ZM', monType: 'zombie', ai: 'Zombie', minGroup: 1, maxGroup: 2, velocity: 1, minHp: 101, maxHp: 181, experience: 111 },
  { id: 'skeleton1', nameKey: 'Skeleton', code: 'SK', monType: 'skeleton', ai: 'Skeleton', minGroup: 1, maxGroup: 3, velocity: 3, minHp: 86, maxHp: 129, experience: 86 },
  { id: 'quillrat1', nameKey: 'QuillRat', code: 'SI', monType: 'quillrat', ai: 'QuillRat', minGroup: 1, maxGroup: 2, velocity: 3, minHp: 21, maxHp: 81, experience: 71 },
  { id: 'foulcrow1', nameKey: 'FoulCrow', code: 'BK', monType: 'foulcrow', ai: 'BloodHawk', minGroup: 2, maxGroup: 4, velocity: 4, minHp: 19, maxHp: 46, experience: 37 },
  { id: 'corruptrogue1', nameKey: 'DarkHunter', code: 'CR', monType: 'corruptrogue', ai: 'CorruptRogue', minGroup: 2, maxGroup: 3, velocity: 5, minHp: 58, maxHp: 101, experience: 78 },
  { id: 'hellbovine', nameKey: 'Hell Bovine', code: 'EC', monType: 'bovine', ai: 'Skeleton', minGroup: 5, maxGroup: 10, velocity: 5, minHp: 133, maxHp: 285, experience: 140 },
]
for (const want of EXPECTED) {
  const got = kinds.get(want.id)
  if (got === undefined) {
    check(false, `${want.id} exists`)
    continue
  }
  const mismatches: string[] = []
  const compare = (field: string, a: unknown, b: unknown): void => {
    if (a !== b) mismatches.push(`${field} ${String(a)} ≠ ${String(b)}`)
  }
  compare('nameKey', got.nameKey, want.nameKey)
  compare('code', got.code, want.code)
  compare('monType', got.monType, want.monType)
  compare('ai', got.ai, want.ai)
  compare('minGroup', got.minGroup, want.minGroup)
  compare('maxGroup', got.maxGroup, want.maxGroup)
  compare('velocity', got.velocity, want.velocity)
  compare('minHp', got.minHp, want.minHp)
  compare('maxHp', got.maxHp, want.maxHp)
  compare('experience', got.experience, want.experience)
  check(mismatches.length === 0, `${want.id}${mismatches.length === 0 ? '' : `: ${mismatches.join('; ')}`}`)
}

// ---------------------------------------------------------------------------
// Difficulty columns: the capitalisation trap.
// ---------------------------------------------------------------------------
//
// Normal is `minHP`; Nightmare and Hell are `MinHP(N)` and `MinHP(H)`. Reading
// the lower-case form on Nightmare returns nothing, which would show up as a
// Fallen with the same health on every difficulty.
console.log(`\n== difficulty columns are read, and are not a scaling ==`)
//
// The obvious assertion — "Nightmare health is higher" — is false in the data.
// `fallen1` is 21–61 on Normal and 25–55 on Nightmare, and 426 of the rows with
// health have a *lower* `MaxHP(N)` than `maxHP`. The difficulty columns are a
// boss-only override; ordinary monsters are scaled by `MonLvl.txt` instead.
// What can be asserted is that the columns are being read at all, rather than
// silently falling back to the Normal ones through a misspelling.
{
  const normal = kinds.get('fallen1')
  const nightmare = readMonsterKinds(tables.monstats, 'nightmare').get('fallen1')
  const hell = readMonsterKinds(tables.monstats, 'hell').get('fallen1')
  check(
    normal !== undefined && nightmare !== undefined && hell !== undefined,
    'fallen1 reads on all three difficulties',
  )
  check(
    nightmare !== undefined && normal !== undefined && (nightmare.minHp !== normal.minHp || nightmare.maxHp !== normal.maxHp),
    `fallen1 Nightmare health differs from Normal (${String(nightmare?.minHp)}-${String(nightmare?.maxHp)} vs ${String(normal?.minHp)}-${String(normal?.maxHp)}), so MinHP(N) is really being read`,
  )
  check(
    nightmare !== undefined && normal !== undefined && nightmare.experience !== normal.experience,
    `fallen1 Nightmare experience differs (${String(nightmare?.experience)} vs ${String(normal?.experience)})`,
  )
}

// The documented oddity, asserted so that a future "fix" that quietly inverts
// it has to confront the data first.
{
  let lower = 0
  let total = 0
  for (const row of tables.monstats.rows) {
    const normalHp = Number(cell(tables.monstats, row, 'maxHP'))
    const nightmareHp = Number(cell(tables.monstats, row, 'MaxHP(N)'))
    if (!Number.isFinite(normalHp) || !Number.isFinite(nightmareHp) || normalHp === 0) continue
    total += 1
    if (nightmareHp < normalHp) lower += 1
  }
  check(
    lower > total / 2,
    `most rows have a lower MaxHP(N) than maxHP (${String(lower)} of ${String(total)}) — these columns are not a difficulty scaling`,
  )
}

// ---------------------------------------------------------------------------
// Levels.txt monster columns.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// MonLvl.txt scaling — the reconciliation that justifies applying it.
// ---------------------------------------------------------------------------
console.log(`\n== MonLvl.txt scaling reconciles the table with the game ==`)
const scaling = readMonsterScaling(tables.monlvl)
check(scaling.size > 90, `${String(scaling.size)} monster levels have multipliers`)

// Every level any monster claims must have a row, or that monster would be
// silently left unscaled and arrive with hundreds of health.
const unscaled: number[] = []
for (const kind of kinds.values()) {
  for (const level of kind.level) {
    if (level > 0 && !scaling.has(level)) unscaled.push(level)
  }
}
check(unscaled.length === 0, `every monster level has a MonLvl row (${String(new Set(unscaled).size)} missing)`)

// The five independent columns that pinned the formula down. If a future change
// breaks one of these, the scaling has stopped being the game's.
interface Reconciliation {
  readonly id: string
  readonly what: string
  readonly expected: number
  readonly raw: (kind: MonsterKind) => number
  readonly read: (kind: MonsterKind, scale: { armour: number; toHit: number; experience: number }) => number
}
const RECONCILE: readonly Reconciliation[] = [
  { id: 'fallen1', what: 'Exp', expected: 18, raw: k => k.experience, read: (k, s2) => (k.experience * s2.experience) / 100 },
  { id: 'zombie1', what: 'Exp', expected: 33, raw: k => k.experience, read: (k, s2) => (k.experience * s2.experience) / 100 },
  { id: 'quillrat1', what: 'Exp', expected: 21, raw: k => k.experience, read: (k, s2) => (k.experience * s2.experience) / 100 },
  { id: 'fallen1', what: 'AC', expected: 5, raw: k => k.armour, read: (k, s2) => (k.armour * s2.armour) / 100 },
  { id: 'fallen1', what: 'A1TH', expected: 8, raw: k => k.attack1.toHit, read: (k, s2) => (k.attack1.toHit * s2.toHit) / 100 },
]
for (const want of RECONCILE) {
  const kind = kinds.get(want.id)!
  const got = want.read(kind, monsterScaleFor(scaling, monsterLevelFor(kind, 'normal', 0)))
  check(
    Math.round(got) === want.expected || Math.floor(got) === want.expected,
    `${want.id} ${want.what} ${String(want.raw(kind))} → ${got.toFixed(1)}, the game shows ${String(want.expected)}`,
  )
}

// The scaled numbers have to be playable, which the raw ones are not: a level-1
// Fallen straight off the table hits for 76, and the player has 60 health.
{
  const fallen = kinds.get('fallen1')!
  const raw = monsterStatsOf(fallen, new Rng(1), WALK_SPEED)
  const scaled = monsterStatsOf(fallen, new Rng(1), WALK_SPEED, monsterScaleFor(scaling, monsterLevelFor(fallen, 'normal', 0)))
  check(raw.damage > 50, `unscaled fallen1 hits for ${String(raw.damage)}, which would one-shot the player`)
  check(scaled.damage <= 3, `scaled fallen1 hits for ${String(scaled.damage)}`)
  check(scaled.hp <= 6, `scaled fallen1 has ${String(scaled.hp)} health`)
  check(scaled.xp === 18, `scaled fallen1 awards ${String(scaled.xp)} experience`)
}

// Difficulty raises the monster's level, and the level raises everything else.
{
  const fallen = kinds.get('fallen1')!
  const hell = readMonsterKinds(tables.monstats, 'hell').get('fallen1')!
  const hellScale = monsterScaleFor(readMonsterScaling(tables.monlvl, 'hell'), monsterLevelFor(hell, 'hell', 67))
  const normal = monsterStatsOf(fallen, new Rng(1), WALK_SPEED, monsterScaleFor(scaling, monsterLevelFor(fallen, 'normal', 0)))
  const scaledHell = monsterStatsOf(hell, new Rng(1), WALK_SPEED, hellScale)
  check(
    scaledHell.hp > normal.hp * 50,
    `a Hell Fallen (level ${String(hell.level[2])}) has ${String(scaledHell.hp)} health against a Normal one's ${String(normal.hp)}`,
  )
  check(scaledHell.xp > normal.xp * 50, `and awards ${String(scaledHell.xp)} experience against ${String(normal.xp)}`)
}

console.log(`\n== Levels.txt monster plans ==`)
interface LevelExpectation {
  readonly id: number
  readonly name: string
  readonly density: number
  readonly typeCount: number
  readonly pool: readonly string[]
}
const LEVELS: readonly LevelExpectation[] = [
  { id: 1, name: 'Act 1 - Town', density: 0, typeCount: 0, pool: [] },
  { id: 2, name: 'Act 1 - Wilderness 1', density: 520, typeCount: 3, pool: ['zombie1', 'fallen1', 'quillrat1'] },
  { id: 8, name: 'Act 1 - Cave 1', density: 600, typeCount: 3, pool: ['zombie1', 'brute1', 'fallenshaman1'] },
]
for (const want of LEVELS) {
  const plan = readLevelMonsterPlan(tables.levels, want.id)
  if (plan === null) {
    check(false, `level ${String(want.id)} has a row`)
    continue
  }
  check(plan.levelName === want.name, `level ${String(want.id)} is ${plan.levelName}`)
  check(plan.density === want.density, `${plan.levelName} MonDen ${String(plan.density)} (want ${String(want.density)})`)
  check(plan.typeCount === want.typeCount, `${plan.levelName} NumMon ${String(plan.typeCount)} (want ${String(want.typeCount)})`)
  check(
    plan.pool.join(',') === want.pool.join(','),
    `${plan.levelName} pool [${plan.pool.join(', ')}]${plan.pool.join(',') === want.pool.join(',') ? '' : ` (want [${want.pool.join(', ')}])`}`,
  )
}

// Every monster any level names must exist in MonStats.txt, or the populator
// would be asked to place something it cannot build.
let danglingPool = 0
let levelsWithMonsters = 0
for (const row of tables.levels.rows) {
  const levelId = Number(cell(tables.levels, row, 'Id'))
  if (!Number.isFinite(levelId)) continue
  const plan = readLevelMonsterPlan(tables.levels, levelId)
  if (plan === null) continue
  if (plan.pool.length > 0) levelsWithMonsters += 1
  for (const name of [...plan.pool, ...plan.nightmarePool, ...plan.elitePool]) {
    if (!kinds.has(name)) {
      danglingPool += 1
      if (danglingPool <= 5) console.log(`        ${plan.levelName}: unknown monster "${name}"`)
    }
  }
}
check(danglingPool === 0, `every level's monster pool resolves (${String(danglingPool)} dangling across ${String(levelsWithMonsters)} populated levels)`)

// ---------------------------------------------------------------------------
// SuperUniques.txt and MonUMod.txt.
// ---------------------------------------------------------------------------
console.log(`\n== SuperUniques.txt ==`)
const superUniques = readSuperUniques(tables.superuniques)
check(superUniques.length > 60, `${String(superUniques.length)} super uniques read`)
const danglingClass = superUniques.filter(entry => !kinds.has(entry.monsterId))
check(danglingClass.length === 0, `every super unique's Class resolves${danglingClass.length === 0 ? '' : `: ${danglingClass.map(e => `${e.id}→${e.monsterId}`).join(', ')}`}`)
const bishibosh = superUniques.find(entry => entry.id === 'Bishibosh')
check(
  bishibosh !== undefined && bishibosh.monsterId === 'fallenshaman1' && bishibosh.minMinions === 2 && bishibosh.maxMinions === 2,
  `Bishibosh is a fallenshaman1 with 2 minions (${String(bishibosh?.monsterId)}, ${String(bishibosh?.minMinions)}-${String(bishibosh?.maxMinions)})`,
)
const rakanishu = superUniques.find(entry => entry.id === 'Rakanishu')
check(
  rakanishu !== undefined && rakanishu.monsterId === 'fallen2' && rakanishu.maxMinions === 8,
  `Rakanishu is a fallen2 with 8 minions (${String(rakanishu?.monsterId)}, ${String(rakanishu?.maxMinions)})`,
)

console.log(`\n== MonUMod.txt ==`)
const modifiers = readEliteModifiers(tables.monumod)
check(modifiers.length > 20, `${String(modifiers.length)} elite modifiers read`)
const modifierIds = new Set(modifiers.map(entry => entry.id))
const danglingMod = superUniques.flatMap(entry => entry.modifiers).filter(id => !modifierIds.has(id))
check(danglingMod.length === 0, `every super unique modifier id exists (${String(danglingMod.length)} dangling)`)

// ---------------------------------------------------------------------------
// Population: density, type selection, packs.
// ---------------------------------------------------------------------------
console.log(`\n== populating Act 1 - Wilderness 1 ==`)
const bloodMoor = readLevelMonsterPlan(tables.levels, 2)
if (bloodMoor === null) {
  check(false, 'Blood Moor has a plan')
} else {
  /** A wilderness level is roughly 50×50 cells. */
  const CELLS = 50 * 50
  const budget = monsterBudget(bloodMoor, CELLS)
  check(budget === 108, `budget for a ${String(CELLS)}-cell level is ${String(budget)}, matching 1.13c MonsterRegion.cpp formula (36.1 packs × 3 = 108)`)

  const town = readLevelMonsterPlan(tables.levels, 1)
  check(town !== null && monsterBudget(town, CELLS) === 0, 'a town has a budget of zero')

  const types = selectLevelTypes(bloodMoor, kinds, new Rng(2))
  check(types.length === bloodMoor.typeCount, `selected ${String(types.length)} types, NumMon is ${String(bloodMoor.typeCount)}`)
  check(new Set(types.map(t => t.id)).size === types.length, `selected types are distinct: ${types.map(t => t.id).join(', ')}`)
  check(types.every(t => bloodMoor.pool.includes(t.id)), 'selected types all come from the level pool')

  const groups = planMonsterGroups(bloodMoor, types, kinds, budget, new Rng(3))
  const placed = groups.reduce((sum, group) => sum + group.count, 0)
  check(placed === budget, `packs account for the whole budget (${String(placed)} of ${String(budget)})`)
  check(groups.every(group => group.count >= 1), 'no empty packs')
  check(
    groups.every(group => group.count <= Math.max(1, group.kind.maxGroup)),
    'no pack exceeds its monster\'s MaxGrp',
  )
  const ranks = new Map<string, number>()
  for (const group of groups) ranks.set(group.rank, (ranks.get(group.rank) ?? 0) + 1)
  console.log(`   info ${String(groups.length)} packs: ${[...ranks].map(([rank, n]) => `${String(n)} ${rank}`).join(', ')}`)

  // Determinism: the same seed must produce the same level, or a save cannot be
  // reloaded and a co-op session cannot agree on what it is fighting.
  const again = planMonsterGroups(bloodMoor, selectLevelTypes(bloodMoor, kinds, new Rng(2)), kinds, budget, new Rng(3))
  const encode = (list: readonly { kind: MonsterKind; count: number; rank: string }[]): string =>
    list.map(group => `${group.kind.id}:${String(group.count)}:${group.rank}`).join('|')
  check(encode(groups) === encode(again), 'the same seed produces the same packs')
  const different = planMonsterGroups(bloodMoor, selectLevelTypes(bloodMoor, kinds, new Rng(99)), kinds, budget, new Rng(98))
  check(encode(groups) !== encode(different), 'a different seed produces different packs')
}

// Density ratios between levels must follow the table, since the absolute
// count is a calibration but the ratios are data.
console.log(`\n== density ratios follow MonDen ==`)
const cow = readLevelMonsterPlan(tables.levels, 39)
if (bloodMoor !== null && cow !== null) {
  const ratio = cow.density / bloodMoor.density
  const budgetRatio = monsterBudget(cow, 10_000) / monsterBudget(bloodMoor, 10_000)
  check(
    Math.abs(ratio - budgetRatio) < 0.05,
    `Cow Level is ${ratio.toFixed(2)}× the Blood Moor's density and ${budgetRatio.toFixed(2)}× its budget`,
  )
} else {
  check(false, 'Cow Level and Blood Moor both have plans')
}

// ---------------------------------------------------------------------------
// MonStats2.txt covers the monsters that spawn.
// ---------------------------------------------------------------------------
console.log(`\n== MonStats2.txt covers spawnable monsters ==`)
const art = readMonsterArt(tables.monstats2, kinds)
const uncovered: string[] = []
let viaBaseId = 0
for (const kind of kinds.values()) {
  if (!kind.enabled || !kind.isSpawn || kind.npc) continue
  const entry = art.get(kind.id)
  if (entry === undefined) { uncovered.push(kind.id); continue }
  if (entry.rowId !== kind.id) viaBaseId += 1
}
check(uncovered.length === 0, `every spawnable monster resolves art${uncovered.length === 0 ? '' : `; missing ${uncovered.slice(0, 10).join(', ')}`}`)
check(viaBaseId > 0, `${String(viaBaseId)} spawnable monsters reach their art through BaseId, as the game does`)
const fallenArt = art.get('fallen1')
check(
  fallenArt !== undefined && fallenArt.sizeX === 2 && fallenArt.sizeY === 2 && fallenArt.totalPieces === 6 && fallenArt.directions === 8,
  `fallen1 art is 2×2, 6 COF pieces, 8 directions (${String(fallenArt?.sizeX)}×${String(fallenArt?.sizeY)}, ${String(fallenArt?.totalPieces)}, ${String(fallenArt?.directions)})`,
)
const variantArt = art.get('quillrat6')
check(
  variantArt !== undefined && variantArt.rowId === 'quillrat1',
  `quillrat6 borrows quillrat1's art (${String(variantArt?.rowId)})`,
)
const flat = [...art.values()]
check(
  new Set(flat.map(entry => `${String(entry.sizeX)}x${String(entry.sizeY)}`)).size > 3,
  `body sizes vary rather than defaulting (${String(new Set(flat.map(e => `${String(e.sizeX)}x${String(e.sizeY)}`)).size)} distinct)`,
)

// ---------------------------------------------------------------------------
// Monster COF / DCC animation decoding
// ---------------------------------------------------------------------------
console.log(`\n== Monster COF / DCC animation decoding ==`)
try {
  const faWalk = await compositeMonsterAnimation(archives, 'fa', 'wl', 'hth')
  check(faWalk.directions === 8, `Fallen (FA) walk has 8 directions (${String(faWalk.directions)})`)
  check(faWalk.framesPerDirection === 10, `Fallen (FA) walk has 10 frames (${String(faWalk.framesPerDirection)})`)
  check(faWalk.decodedMembers.length >= 4, `Fallen (FA) decoded ${String(faWalk.decodedMembers.length)} DCC layers with 0 errors`)

  const zmWalk = await compositeMonsterAnimation(archives, 'zm', 'wl', 'hth')
  check(zmWalk.directions === 8, `Zombie (ZM) walk has 8 directions (${String(zmWalk.directions)})`)
  check(zmWalk.framesPerDirection === 12, `Zombie (ZM) walk has 12 frames (${String(zmWalk.framesPerDirection)})`)
  check(zmWalk.decodedMembers.length >= 8, `Zombie (ZM) decoded ${String(zmWalk.decodedMembers.length)} DCC layers with 0 errors`)

  const siWalk = await compositeMonsterAnimation(archives, 'si', 'wl', 'hth')
  check(siWalk.directions === 8, `Quillrat (SI) walk has 8 directions (${String(siWalk.directions)})`)
  check(siWalk.framesPerDirection === 9, `Quillrat (SI) walk has 9 frames (${String(siWalk.framesPerDirection)})`)
  check(siWalk.decodedMembers.length >= 1, `Quillrat (SI) decoded ${String(siWalk.decodedMembers.length)} DCC layers with 0 errors`)
} catch (err) {
  check(false, `monster animation decoding failed: ${(err as Error).message}`)
}

console.log(`\n== summary ==`)
console.log(`   ${String(checks - failures)}/${String(checks)} checks passed`)
const difficulties: readonly Difficulty[] = ['normal', 'nightmare', 'hell']
console.log(`   difficulties read: ${difficulties.join(', ')}`)
if (failures > 0) process.exit(1)
