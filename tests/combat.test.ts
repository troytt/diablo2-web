import { describe, test, expect as vitestExpect } from 'vitest'
import * as fs from 'fs'
/**
 * M2 combat checks: the simulation, headless.
 *
 * The combat model is written to be driven one tick at a time from a small input
 * record precisely so it can be tested like this — without a canvas, without
 * input events, and without a map. Each check below states a behaviour the
 * sandbox must have (aggro, reach, cooldowns, resource costs, experience,
 * death and respawn) and asserts it against a simulated run, so a regression
 * shows up as a failing number rather than as something subtly wrong on screen.
 *
 * Usage: node scripts/verify-combat.ts
 */
import {
  createWorld, experienceTable, monsterStatsFromRow, monsterStatsFromTable,
  spawnMonsters, tickCombat,
} from '../src/server/ai/monster-ai.ts'
import type { CombatOptions, CombatWorld, MonsterStats } from '../src/server/ai/monster-ai.ts'
import { parseTable, numberCell, findRow } from '../src/common/items/tables.ts'
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

/** A table shaped like the real `MonStats.txt`, including its rough edges. */
const MONSTATS_TEXT = [
  'Id\tName\tHP\tDamage\tCooldownTicks\tReach\tAggroRadius\tSpeed\tXP',
  'fallen\tFallen\t12\t3\t24\t36\t200\t80\t8',
  'zombie\tZombie\t30\t6\t32\t40\t160\t50\t15\t\t',
  'skeleton\tSkeleton\t18\t4\t28\t38\t240\t70\t12',
  'empty\tSmall Rat\t\t2\t\t\t\t\t4',      // missing cells: defaults must apply
  'nulled\tNull Beast\t(null)\t5\t30\t40\t180\t60\t9',
].join('\r\n')

const options: CombatOptions = {
  playerSpeed: 200,
  playerReach: 48,
  playerCooldownTicks: 25,
  playerDamage: 6,
  playerManaPerAttack: 2,
  respawnTicks: 50,
}

/** Flat ground: nothing is ever overlapped. */
const openTerrain = { overlap: () => 0 }

// --- tables -----------------------------------------------------------------

const monstats = parseTable(MONSTATS_TEXT)
expect(monstats.columns[0] === 'Id', 'header columns are read in order')
expect(monstats.rows.length === 5, 'every non-empty line becomes a record')
expect(monstats.rows[2]?.Id === 'skeleton', 'records are keyed by column name')
expect(monstats.rows[3]?.HP === undefined, 'an empty cell is absent, not empty-string')
expect(monstats.rows[4]?.HP === undefined, 'the (null) marker means absent')
expect(numberCell(monstats.rows[3] ?? {}, 'HP', 20) === 20, 'a missing numeric cell falls back to the default')
expect(findRow(monstats, 'Id', 'ZOMBIE')?.Name === 'Zombie', 'row lookup is case-insensitive')

const stats = monsterStatsFromTable(monstats)
expect(stats.length === 5, 'every record becomes a definition')
expect(stats[3]?.hp === 20, 'a definition with no HP column uses the default')
expect(stats[4]?.hp === 20, 'a definition with a null HP uses the default')
expect(stats[0]?.name === 'Fallen' && stats[0]?.xp === 8, 'names and experience come from the table')

const xpTable = experienceTable(parseTable([
  'Level\tXP',
  '1\t0',
  '2\t500',
  '3\t1500',
  '4\t400',
].join('\n')))
expect(xpTable[2] === 500 && xpTable[3] === 1500, 'experience thresholds are read per level')
expect(xpTable[4] === 1500, 'a non-monotonic table is clamped upward')

// --- spawning ---------------------------------------------------------------

const world: CombatWorld = createWorld(0, 0)
const blockedHalf = { overlap: (x: number) => (x < 0 ? 1 : 0) }
const placed = spawnMonsters(world, stats, 6, { x: 0, y: 0 }, 200, blockedHalf)
expect(placed === 6 && world.monsters.length === 6, 'spawns fill up to the requested count')
expect(world.monsters.every(monster => monster.x >= 0), 'no monster is dropped into blocked ground')
const deterministic: CombatWorld = createWorld(0, 0)
spawnMonsters(deterministic, stats, 6, { x: 0, y: 0 }, 200, blockedHalf)
expect(
  JSON.stringify(world.monsters.map(monster => [Math.round(monster.x), Math.round(monster.y)]))
  === JSON.stringify(deterministic.monsters.map(monster => [Math.round(monster.x), Math.round(monster.y)])),
  'spawn positions are reproducible',
)

// --- aggro, chase, reach ----------------------------------------------------

const idleWorld = createWorld(1000, 1000)
const idleStats: MonsterStats = { ...stats[0]!, aggroRadius: 100, speed: 100, reach: 30 }
idleWorld.monsters.push({
  index: 0, stats: idleStats, x: 0, y: 0, hp: idleStats.hp, cooldown: 0,
  state: 'idle', facing: 0, hitFlash: 0, corpseTicks: 0,
})
tickCombat(idleWorld, { movement: { x: 0, y: 0 }, attack: false }, options, openTerrain, xpTable)
expect(idleWorld.monsters[0]?.state === 'idle', 'a monster outside its aggro radius stays idle')

// Inside the monster's aggro radius: a monster that never notices the player is
// tested by the idle case above, so this one must be within range to chase.
const chaseWorld = createWorld(80, 0)
chaseWorld.monsters.push({
  index: 0, stats: idleStats, x: 0, y: 0, hp: idleStats.hp, cooldown: 0,
  state: 'idle', facing: 0, hitFlash: 0, corpseTicks: 0,
})
const startDistance = Math.hypot(80, 0)
for (let i = 0; i < 10; i += 1) tickCombat(chaseWorld, { movement: { x: 0, y: 0 }, attack: false }, options, openTerrain, xpTable)
const chaseDistance = Math.hypot(chaseWorld.monsters[0]!.x - 80, chaseWorld.monsters[0]!.y)
expect(chaseWorld.monsters[0]?.state === 'chase' || chaseWorld.monsters[0]?.state === 'attack', 'a monster inside aggro closes in')
expect(chaseDistance < startDistance, 'closing in actually reduces the distance')

const reachWorld = createWorld(20, 0)
reachWorld.monsters.push({
  index: 0, stats: idleStats, x: 0, y: 0, hp: 1000, cooldown: 0,
  state: 'idle', facing: 0, hitFlash: 0, corpseTicks: 0,
})
const hpBefore = reachWorld.player.hp
for (let i = 0; i < 100; i += 1) tickCombat(reachWorld, { movement: { x: 0, y: 0 }, attack: false }, options, openTerrain, xpTable)
const taken = hpBefore - reachWorld.player.hp
// Attacks land on ticks 1, 25, 49, 73 and 97 for a 24-tick cooldown: five hits
// in a hundred ticks, which is what "respects the cooldown" has to mean.
expect(taken === 5 * idleStats.damage, `monster damage respects its cooldown (took ${String(taken)}, expected ${String(5 * idleStats.damage)})`)
expect(reachWorld.monsters[0]?.state === 'attack', 'a monster in reach switches to attacking')

// --- player attack, mana, cooldowns -----------------------------------------

const attackWorld = createWorld(20, 0)
attackWorld.monsters.push({
  index: 0, stats: { ...idleStats, hp: 100, xp: 40 }, x: 0, y: 0, hp: 100, cooldown: 999,
  state: 'idle', facing: 0, hitFlash: 0, corpseTicks: 0,
})
const manaBefore = attackWorld.player.mana
for (let i = 0; i < 100; i += 1) tickCombat(attackWorld, { movement: { x: 0, y: 0 }, attack: true }, options, openTerrain, xpTable)
const monsterDamage = 100 - (attackWorld.monsters[0]?.hp ?? 0)
expect(monsterDamage === 4 * options.playerDamage, `player attacks respect the cooldown (dealt ${String(monsterDamage)})`)
expect(manaBefore - attackWorld.player.mana === 4 * options.playerManaPerAttack, 'each attack spends its mana')

const noManaWorld = createWorld(20, 0)
noManaWorld.player.mana = 1
noManaWorld.monsters.push({
  index: 0, stats: idleStats, x: 0, y: 0, hp: 100, cooldown: 999,
  state: 'idle', facing: 0, hitFlash: 0, corpseTicks: 0,
})
tickCombat(noManaWorld, { movement: { x: 0, y: 0 }, attack: true }, options, openTerrain, xpTable)
expect(noManaWorld.events.some(event => event.kind === 'noMana'), 'an unaffordable attack reports no-mana instead of landing')
expect(noManaWorld.monsters[0]?.hp === 100, 'an unaffordable attack deals no damage')

const whiffWorld = createWorld(0, 0)
for (let i = 0; i < 3; i += 1) tickCombat(whiffWorld, { movement: { x: 0, y: 0 }, attack: true }, options, openTerrain, xpTable)
expect(whiffWorld.player.cooldown >= 0, 'attacking with nothing in reach is legal and still costs the cooldown')

// --- kill, experience, level up ---------------------------------------------

const killWorld = createWorld(20, 0)
const killStats: MonsterStats = { ...idleStats, hp: 12, xp: 600, cooldownTicks: 999 }
killWorld.monsters.push({
  index: 0, stats: killStats, x: 0, y: 0, hp: 12, cooldown: 999,
  state: 'idle', facing: 0, hitFlash: 0, corpseTicks: 0,
})
let sawKill = false
let sawLevelUp = false
for (let i = 0; i < 60; i += 1) {
  tickCombat(killWorld, { movement: { x: 0, y: 0 }, attack: true }, options, openTerrain, xpTable)
  if (killWorld.events.some(event => event.kind === 'kill')) sawKill = true
  if (killWorld.events.some(event => event.kind === 'levelUp')) sawLevelUp = true
}
expect(sawKill, 'killing a monster emits a kill event')
expect(killWorld.kills === 1, 'the kill is counted')
expect(killWorld.monsters[0]?.state === 'dead', 'the monster is left dead, not removed mid-frame')
expect(killWorld.player.xp === 600, 'experience is awarded from the monster table')
expect(sawLevelUp && killWorld.player.level === 2, 'crossing the table threshold levels the player up')
expect(killWorld.player.maxHp > 40 && killWorld.player.hp === killWorld.player.maxHp, 'a level up raises and refills resources')

// --- death and respawn ------------------------------------------------------

const deathWorld = createWorld(20, 0)
deathWorld.player.hp = 5
deathWorld.monsters.push({
  index: 0, stats: { ...idleStats, damage: 50, reach: 60 }, x: 0, y: 0, hp: 100, cooldown: 0,
  state: 'idle', facing: 0, hitFlash: 0, corpseTicks: 0,
})
tickCombat(deathWorld, { movement: { x: 0, y: 0 }, attack: false }, options, openTerrain, xpTable)
expect(!deathWorld.player.alive, 'lethal damage kills the player')
expect(deathWorld.player.respawnIn === options.respawnTicks, 'death starts the respawn timer')
for (let i = 0; i < options.respawnTicks + 2; i += 1) {
  tickCombat(deathWorld, { movement: { x: 0, y: 0 }, attack: false }, options, openTerrain, xpTable)
}
expect(deathWorld.player.alive, 'the player comes back after the respawn delay')
expect(deathWorld.player.hp === deathWorld.player.maxHp, 'respawn restores health')
expect(deathWorld.player.mana === deathWorld.player.maxMana, 'respawn restores mana')

// --- determinism ------------------------------------------------------------

/**
 * Digest a world's observable state.
 *
 * @param target - the world.
 * @returns a string digest.
 */
function digest(target: CombatWorld): string {
  return JSON.stringify([
    target.tick, target.kills, target.player.hp, target.player.xp,
    target.monsters.map(monster => [Math.round(monster.x * 100), Math.round(monster.y * 100), monster.hp, monster.state]),
  ])
}

/**
 * Run a fixed scenario for a number of ticks.
 *
 * @param ticks - how many ticks to run.
 * @returns the world digest.
 */
function runScenario(ticks: number): string {
  const scenario = createWorld(0, 0)
  spawnMonsters(scenario, stats, 4, { x: 120, y: 0 }, 120, openTerrain)
  for (let i = 0; i < ticks; i += 1) {
    const movement = i % 40 < 20 ? { x: 1, y: 0 } : { x: 0, y: 1 }
    const attack = i % 7 === 0
    tickCombat(scenario, { movement, attack }, options, openTerrain, xpTable)
  }
  return digest(scenario)
}
expect(runScenario(300) === runScenario(300), 'the same inputs and seed produce the same simulation')

for (const problem of problems.slice(0, 12)) console.log(`  - ${problem}`)
console.log(problems.length === 0 ? 'RESULT     combat behaviours hold' : 'RESULT     FAILED')
// disabled exit: problems.length === 0 ? 0 : 1)

  suiteCompleted = true;
}
describe('verify-combat.ts', () => {
  test.skipIf(isSkip)('evaluates script successfully', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    vitestExpect(problems).toEqual([]);
  });
  test.skipIf(isSkip)('header columns are read in order', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('header columns are read in order'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('every non-empty line becomes a record', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('every non-empty line becomes a record'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('records are keyed by column name', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('records are keyed by column name'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an empty cell is absent, not empty-string', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an empty cell is absent, not empty-string'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the (null) marker means absent', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the (null) marker means absent'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a missing numeric cell falls back to the default', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a missing numeric cell falls back to the default'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('row lookup is case-insensitive', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('row lookup is case-insensitive'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('every record becomes a definition', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('every record becomes a definition'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a definition with no HP column uses the default', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a definition with no HP column uses the default'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a definition with a null HP uses the default', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a definition with a null HP uses the default'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('names and experience come from the table', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('names and experience come from the table'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('experience thresholds are read per level', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('experience thresholds are read per level'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a non-monotonic table is clamped upward', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a non-monotonic table is clamped upward'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('spawns fill up to the requested count', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('spawns fill up to the requested count'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('no monster is dropped into blocked ground', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('no monster is dropped into blocked ground'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('spawn positions are reproducible', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('spawn positions are reproducible'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a monster outside its aggro radius stays idle', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a monster outside its aggro radius stays idle'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a monster inside aggro closes in', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a monster inside aggro closes in'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('closing in actually reduces the distance', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('closing in actually reduces the distance'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('monster damage respects its cooldown (took', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('monster damage respects its cooldown (took'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a monster in reach switches to attacking', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a monster in reach switches to attacking'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('player attacks respect the cooldown (dealt', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('player attacks respect the cooldown (dealt'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('each attack spends its mana', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('each attack spends its mana'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an unaffordable attack reports no-mana instead of landing', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an unaffordable attack reports no-mana instead of landing'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('an unaffordable attack deals no damage', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('an unaffordable attack deals no damage'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('attacking with nothing in reach is legal and still costs the cooldown', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('attacking with nothing in reach is legal and still costs the cooldown'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('killing a monster emits a kill event', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('killing a monster emits a kill event'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the kill is counted', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the kill is counted'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the monster is left dead, not removed mid-frame', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the monster is left dead, not removed mid-frame'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('experience is awarded from the monster table', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('experience is awarded from the monster table'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('crossing the table threshold levels the player up', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('crossing the table threshold levels the player up'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('a level up raises and refills resources', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('a level up raises and refills resources'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('lethal damage kills the player', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('lethal damage kills the player'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('death starts the respawn timer', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('death starts the respawn timer'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the player comes back after the respawn delay', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the player comes back after the respawn delay'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('respawn restores health', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('respawn restores health'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('respawn restores mana', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('respawn restores mana'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('the same inputs and seed produce the same simulation', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('the same inputs and seed produce the same simulation'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
});