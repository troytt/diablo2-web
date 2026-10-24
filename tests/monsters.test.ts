/**
 * Monster table reading and level population.
 *
 * These tests use hand-built tables rather than the archives: the point is to
 * pin the *logic* — which column feeds which field, how a budget becomes packs,
 * that the same seed gives the same level — where a synthetic table can state
 * the expected answer exactly. `scripts/verify-monsters.ts` covers the other
 * half, that the column names match the real 255-column file.
 */
import { describe, expect, it, vi } from 'vitest'
import type { D2Table } from '../src/common/world/acts.ts'
import {
  DEFAULT_REACH_PX,
  ELITE_HEALTH_MULTIPLIER,
  MONUMOD_CONSTANTS,
  monsterBudget,
  monsterStatsOf,
  planMonsterGroups,
  readEliteModifiers,
  readLevelMonsterPlan,
  readMonUModConstants,
  planLevelMonsters,
  monsterLevelFor, monsterScaleFor,
  monsterScaleLookup,
  setMonsterScalingStrict,
  readMonsterArt,
  readMonsterKinds,
  readMonsterScaling,
  readSuperUniques,
  selectLevelTypes,
  applyEliteModifiers,
  monsterColumns,
  UNSCALED,
} from '../src/common/units/monsters-data.ts'
import type { MonsterKind } from '../src/common/units/monsters-data.ts'
import { Rng } from '../src/common/rng/d2-rng.ts'

/**
 * Build a table from a header and rows.
 *
 * @param header - the column names.
 * @param rows - the rows, each the same length as the header.
 * @returns the table.
 */
function table(header: readonly string[], rows: readonly (readonly string[])[]): D2Table {
  return { header: [...header], rows: rows.map(row => [...row]) }
}

/** A `MonStats.txt` with only the columns the reader names. */
const MONSTATS = table(
  [
    'Id', 'BaseId', 'NameStr', 'Code', 'MonType', 'AI', 'enabled', 'isSpawn', 'isMelee',
    'rangedtype', 'npc', 'interact', 'inTown', 'boss', 'killable', 'Rarity', 'MinGrp', 'MaxGrp',
    'Level', 'Level(N)', 'Level(H)', 'Velocity', 'Run', 'threat', 'aidist',
    'minHP', 'maxHP', 'MinHP(N)', 'MaxHP(N)', 'AC', 'Exp', 'Exp(N)',
    'A1MinD', 'A1MaxD', 'A1TH', 'A2MinD', 'A2MaxD', 'A2TH',
    'ResDm', 'ResMa', 'ResFi', 'ResLi', 'ResCo', 'ResPo',
    'TreasureClass1', 'TreasureClass2', 'TreasureClass3', 'TreasureClass4',
    'minion1', 'minion2', 'SetBoss',
  ],
  [
    // A Fallen: common, comes in small packs, brings its own kind as minions.
    ['fallen1', 'fallen1', 'Fallen', 'FA', 'fallen', 'Fallen', '1', '1', '1',
      '', '', '', '', '', '1', '2', '2', '3',
      '1', '36', '67', '5', '5', '10', '',
      '21', '61', '25', '55', '84', '61', '65',
      '51', '101', '101', '51', '101', '101',
      '', '', '', '', '', '',
      'Act 1 H2H A', 'Act 1 Champ A', 'Act 1 Unique A', '',
      'fallen1', '', '1'],
    // A Zombie: slow, rarely grouped, poison resistant.
    ['zombie1', 'zombie1', 'Zombie', 'ZM', 'zombie', 'Zombie', '1', '1', '1',
      '', '', '', '', '', '1', '2', '1', '2',
      '1', '36', '67', '1', '3', '10', '',
      '101', '181', '', '', '90', '111', '',
      '30', '60', '80', '', '', '',
      '', '', '', '', '', '50',
      'Act 1 H2H A', '', '', '',
      '', '', ''],
    // A ranged monster with no melee flag.
    ['quillrat1', 'quillrat1', 'QuillRat', 'SI', 'quillrat', 'QuillRat', '1', '1', '',
      '1', '', '', '', '', '1', '2', '1', '2',
      '1', '36', '67', '3', '3', '10', '12',
      '21', '81', '', '', '70', '71', '',
      '20', '40', '70', '', '', '',
      '', '', '', '', '', '',
      'Act 1 H2H A', '', '', '',
      '', '', ''],
    // A variant with no art row of its own.
    ['quillrat6', 'quillrat1', 'QuillRat', 'SI', 'quillrat', 'QuillRat', '1', '1', '',
      '1', '', '', '', '', '1', '2', '1', '2',
      '30', '50', '80', '3', '3', '10', '',
      '400', '600', '', '', '300', '900', '',
      '90', '120', '400', '', '', '',
      '', '', '', '', '', '',
      'Act 5 H2H A', '', '', '',
      '', '', ''],
    // A town NPC: enabled, but never a wild spawn.
    ['charsi', 'charsi', 'Charsi', 'CA', 'human', 'Npc', '1', '', '',
      '', '1', '1', '1', '', '', '1', '1', '1',
      '1', '1', '1', '3', '3', '0', '',
      '50', '50', '', '', '0', '0', '',
      '0', '0', '0', '', '', '',
      '', '', '', '', '', '',
      '', '', '', '',
      '', '', ''],
    // A disabled development leftover.
    ['unused1', 'unused1', 'Unused', 'XX', 'none', 'Idle', '', '1', '1',
      '', '', '', '', '', '1', '1', '1', '1',
      '1', '1', '1', '1', '1', '0', '',
      '1', '1', '', '', '0', '0', '',
      '0', '0', '0', '', '', '',
      '', '', '', '', '', '',
      '', '', '', '',
      '', '', ''],
    // A blank row, as the real files contain.
    ['', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '',
      '', '', '', '', '', '', '',
      '', '', '', '', '', '',
      '', '', '', '', '', '',
      '', '', '', '',
      '', '', ''],
  ],
)

const MONSTATS2 = table(
  ['Id', 'SizeX', 'SizeY', 'pixHeight', 'MeleeRng', 'BaseW', 'TotalPieces', 'dDT'],
  [
    ['fallen1', '2', '2', '64', '0', 'hth', '6', '8'],
    ['zombie1', '2', '2', '80', '0', 'hth', '1', '8'],
    ['quillrat1', '2', '2', '48', '2', 'hth', '1', '8'],
    ['charsi', '2', '2', '90', '0', 'hth', '5', '8'],
    ['unused1', '1', '1', '32', '0', 'hth', '1', '8'],
  ],
)

/** `MonLvl.txt`, with the real 1.13c rows for the levels the fixtures use. */
const MONLVL = table(
  ['Level', 'AC', 'AC(N)', 'TH', 'TH(N)', 'HP', 'HP(N)', 'DM', 'DM(N)', 'XP', 'XP(N)'],
  [
    ['1', '6', '61', '8', '73', '7', '107', '2', '30', '30', '78'],
    ['2', '12', '64', '12', '79', '9', '113', '3', '31', '40', '104'],
    ['30', '180', '190', '309', '320', '133', '300', '19', '52', '660', '1600'],
    ['36', '216', '216', '375', '375', '182', '525', '23', '60', '990', '2568'],
    ['50', '300', '300', '540', '540', '300', '900', '31', '80', '2000', '6000'],
  ],
)

const LEVELS = table(
  [
    'Id', 'Name', 'MonDen', 'MonDen(N)', 'MonUMin', 'MonUMax', 'MonUMin(N)', 'MonUMax(N)',
    'NumMon', 'MonLvl1', 'MonLvl1Ex', 'MonWndr',
    'mon1', 'mon2', 'mon3', 'mon4', 'mon5', 'mon6', 'mon7', 'mon8', 'mon9', 'mon10',
    'nmon1', 'nmon2', 'nmon3', 'nmon4', 'nmon5', 'nmon6', 'nmon7', 'nmon8', 'nmon9', 'nmon10',
    'umon1', 'umon2', 'umon3', 'umon4', 'umon5', 'umon6', 'umon7', 'umon8', 'umon9', 'umon10',
  ],
  [
    ['1', 'Town', '0', '0', '', '', '', '',
      '0', '0', '0', '',
      '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', ''],
    ['2', 'Blood Moor', '520', '520', '', '', '4', '5',
      '3', '1', '1', '1',
      'zombie1', 'fallen1', 'quillrat1', '', '', '', '', '', '', '',
      'quillrat6', 'fallen1', '', '', '', '', '', '', '', '',
      'fallen1', '', '', '', '', '', '', '', '', ''],
    ['3', 'Cold Plains', '600', '600', '1', '2', '2', '3',
      '2', '2', '2', '1',
      'zombie1', 'fallen1', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '',
      'zombie1', 'fallen1', '', '', '', '', '', '', '', ''],
  ],
)

const SUPERUNIQUES = table(
  ['Superunique', 'Name', 'Class', 'Mod1', 'Mod2', 'Mod3', 'MinGrp', 'MaxGrp', 'EClass', 'AutoPos', 'Stacks', 'Replaceable', 'TC'],
  [
    ['Bishibosh', 'Bishibosh', 'fallen1', '8', '9', '0', '2', '2', '0', '1', '', '', 'Act 1 Super A'],
    // The section divider that ships in the real file.
    ['Expansion', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Rakanishu', 'Rakanishu', 'fallen1', '17', '6', '', '8', '8', '1', '', '', '1', 'Act 1 Super A'],
  ],
)

const MONUMOD = table(
  ['uniquemod', 'id', 'enabled', 'champion', 'exclude1', 'exclude2'],
  [
    ['none', '0', '', '', '', ''],
    ['strong', '5', '1', '1', '', ''],
    ['fast', '6', '1', '1', 'slow', ''],
    ['cursed', '7', '1', '', '', ''],
    ['', '', '', '', '', ''],
  ],
)

describe('readMonsterKinds', () => {
  const kinds = readMonsterKinds(MONSTATS)

  it('reads one kind per non-blank Id', () => {
    expect([...kinds.keys()].sort()).toEqual(['charsi', 'fallen1', 'quillrat1', 'quillrat6', 'unused1', 'zombie1'])
  })

  it('reads every field of a row from its own column', () => {
    expect(kinds.get('fallen1')).toEqual({
      id: 'fallen1',
      baseId: 'fallen1',
      nameKey: 'Fallen',
      descKey: '',
      code: 'FA',
      monType: 'fallen',
      ai: 'Fallen',
      enabled: true,
      isSpawn: true,
      isMelee: true,
      ranged: false,
      npc: false,
      interact: false,
      inTown: false,
      isUndead: false,
      isDemon: false,
      boss: false,
      isBoss: false,
      killable: true,
      rarity: 2,
      minGroup: 2,
      maxGroup: 3,
      level: [1, 36, 67],
      velocity: 5,
      runVelocity: 5,
      threat: 10,
      aiDistance: 0,
      minHp: 21,
      maxHp: 61,
      armour: 84,
      experience: 61,
      attack1: { minDamage: 51, maxDamage: 101, toHit: 101 },
      attack2: { minDamage: 51, maxDamage: 101, toHit: 101 },
      resistances: { physical: 0, magic: 0, fire: 0, lightning: 0, cold: 0, poison: 0 },
      treasureClasses: ['Act 1 H2H A', 'Act 1 Champ A', 'Act 1 Unique A'],
      minions: ['fallen1'],
      setBoss: true,
      sparsePopulate: 100,
    })
  })

  it('parses DescStr (filtering out "dummy" sentinel per 0x6fb70c0b) and race/boss flags (lUndead, hUndead, demon, boss)', () => {
    const customTable = table(
      ['Id', 'BaseId', 'NameStr', 'DescStr', 'lUndead', 'hUndead', 'demon', 'boss', 'enabled', 'killable'],
      [
        ['fallenshaman1', 'fallenshaman1', 'Fallen Shaman', 'FallenShamanDesc', '', '', '1', '', '1', '1'],
        ['skeleton1', 'skeleton1', 'Skeleton', 'dummy', '1', '', '', '', '1', '1'],
        ['lich1', 'lich1', 'Lich', 'Dummy', '', '1', '', '1', '1', '1'],
      ],
    )
    const parsed = readMonsterKinds(customTable)
    expect(parsed.get('fallenshaman1')).toMatchObject({
      descKey: 'FallenShamanDesc',
      isDemon: true,
      isUndead: false,
      isBoss: false,
    })
    expect(parsed.get('skeleton1')).toMatchObject({
      descKey: '',
      isUndead: true,
      isDemon: false,
      isBoss: false,
    })
    expect(parsed.get('lich1')).toMatchObject({
      descKey: '',
      isUndead: true,
      isDemon: false,
      isBoss: true,
    })
  })

  it('treats a blank flag as false and a "1" as true', () => {
    expect(kinds.get('quillrat1')?.isMelee).toBe(false)
    expect(kinds.get('quillrat1')?.ranged).toBe(true)
    expect(kinds.get('unused1')?.enabled).toBe(false)
    expect(kinds.get('charsi')?.npc).toBe(true)
  })

  it('keeps resistances that are set and zeroes the rest', () => {
    expect(kinds.get('zombie1')?.resistances.poison).toBe(50)
    expect(kinds.get('zombie1')?.resistances.fire).toBe(0)
  })

  it('reads the difficulty columns rather than falling back to Normal', () => {
    // The real table capitalises these differently per difficulty: `minHP` on
    // Normal, `MinHP(N)` afterwards. A reader that keeps the lower-case form
    // reads nothing and silently reports the Normal numbers.
    const nightmare = readMonsterKinds(MONSTATS, 'nightmare')
    expect(nightmare.get('fallen1')?.minHp).toBe(25)
    expect(nightmare.get('fallen1')?.maxHp).toBe(55)
    expect(nightmare.get('fallen1')?.experience).toBe(65)
    expect(kinds.get('fallen1')?.minHp).toBe(21)
  })

  it('reports a missing difficulty column as zero rather than as the Normal value', () => {
    // `zombie1` has no `MinHP(N)`. Silently substituting the Normal health
    // would hide the gap; reporting zero makes it visible to M9.
    expect(readMonsterKinds(MONSTATS, 'nightmare').get('zombie1')?.minHp).toBe(0)
  })
})

describe('readMonsterArt', () => {
  const kinds = readMonsterKinds(MONSTATS)
  const art = readMonsterArt(MONSTATS2, kinds)

  it('reads a monster with its own row', () => {
    expect(art.get('fallen1')).toEqual({
      rowId: 'fallen1',
      sizeX: 2,
      sizeY: 2,
      pixelHeight: 64,
      meleeRange: 0,
      weaponClass: 'hth',
      totalPieces: 6,
      directions: 8,
    })
  })

  it('falls back to BaseId for a variant with no row', () => {
    // `quillrat6` is in MonStats but not MonStats2; the game draws it with
    // `quillrat1`'s art. Without the fallback it would be invisible.
    expect(art.get('quillrat6')?.rowId).toBe('quillrat1')
    expect(art.get('quillrat6')?.pixelHeight).toBe(48)
  })

  it('omits a monster whose base has no row either', () => {
    const orphan = readMonsterArt(table(['Id', 'SizeX'], [['fallen1', '2']]), kinds)
    expect(orphan.has('zombie1')).toBe(false)
  })
})

describe('readLevelMonsterPlan', () => {
  it('reads the pools, dropping blanks', () => {
    const plan = readLevelMonsterPlan(LEVELS, 2)
    expect(plan?.levelName).toBe('Blood Moor')
    expect(plan?.density).toBe(520)
    expect(plan?.typeCount).toBe(3)
    expect(plan?.pool).toEqual(['zombie1', 'fallen1', 'quillrat1'])
    expect(plan?.nightmarePool).toEqual(['quillrat6', 'fallen1'])
    expect(plan?.elitePool).toEqual(['fallen1'])
    expect(plan?.wander).toBe(true)
  })

  it('reads a blank elite count as zero', () => {
    expect(readLevelMonsterPlan(LEVELS, 2)?.eliteMin).toBe(0)
    expect(readLevelMonsterPlan(LEVELS, 2)?.eliteMax).toBe(0)
  })

  it('reads the difficulty-specific density and elite counts', () => {
    const nightmare = readLevelMonsterPlan(LEVELS, 2, 'nightmare')
    expect(nightmare?.eliteMin).toBe(4)
    expect(nightmare?.eliteMax).toBe(5)
  })

  it('returns null for a level with no row', () => {
    expect(readLevelMonsterPlan(LEVELS, 999)).toBeNull()
  })
})

describe('readSuperUniques', () => {
  const entries = readSuperUniques(SUPERUNIQUES)

  it('skips the section divider that has a name but no class', () => {
    expect(entries.map(entry => entry.id)).toEqual(['Bishibosh', 'Rakanishu'])
  })

  it('drops zero and blank modifier slots', () => {
    expect(entries[0]?.modifiers).toEqual([8, 9])
    expect(entries[1]?.modifiers).toEqual([17, 6])
  })

  it('reads the minion group and the placement flags', () => {
    expect(entries[1]).toMatchObject({
      monsterId: 'fallen1',
      minMinions: 8,
      maxMinions: 8,
      enhancementClass: 1,
      autoPosition: false,
      replaceable: true,
    })
  })
})

describe('readEliteModifiers', () => {
  it('drops the blank and the "none" rows', () => {
    expect(readEliteModifiers(MONUMOD).map(entry => entry.name)).toEqual(['strong', 'fast', 'cursed'])
  })

  it('reads the champion flag and the exclusions', () => {
    const fast = readEliteModifiers(MONUMOD).find(entry => entry.name === 'fast')
    expect(fast).toMatchObject({ id: 6, enabled: true, champion: true, excludes: ['slow'] })
    expect(readEliteModifiers(MONUMOD).find(entry => entry.name === 'cursed')?.champion).toBe(false)
  })
})

describe('monsterBudget', () => {
  it('gives a town no monsters', () => {
    const town = readLevelMonsterPlan(LEVELS, 1)!
    expect(monsterBudget(town, 10_000)).toBe(0)
  })

  it('scales with area', () => {
    const plan = readLevelMonsterPlan(LEVELS, 2)!
    expect(monsterBudget(plan, 18_000)).toBe(2 * monsterBudget(plan, 9000))
  })

  it('keeps the ratio the table asks for between two levels', () => {
    // The ratio between two levels is data, and it must survive the conversion.
    const moor = readLevelMonsterPlan(LEVELS, 2)!
    const plains = readLevelMonsterPlan(LEVELS, 3)!
    const cells = 100_000
    expect(monsterBudget(plains, cells) / monsterBudget(moor, cells))
      .toBeCloseTo(plains.density / moor.density, 2)
  })

  it('never returns zero for a level that has any density', () => {
    const plan = readLevelMonsterPlan(LEVELS, 2)!
    expect(monsterBudget(plan, 1)).toBe(1)
  })

  it('uses the authentic 1.13c room density formula', () => {
    const plan = readLevelMonsterPlan(LEVELS, 2)!
    // 9000 cells, density 520:
    // attempts = Math.floor((9000 * 25) / 9) = 25000
    // expectedPacks = 25000 * (520 / 100000) = 130
    // monsterBudget = Math.max(1, Math.round(130 * 3)) = 390
    expect(monsterBudget(plan, 9000)).toBe(390)
    expect(monsterBudget(9000, 520)).toBe(390)
  })
})

describe('selectLevelTypes', () => {
  const kinds = readMonsterKinds(MONSTATS)

  it('picks exactly NumMon distinct types from the pool', () => {
    const plan = readLevelMonsterPlan(LEVELS, 2)!
    const chosen = selectLevelTypes(plan, kinds, new Rng(1))
    expect(chosen).toHaveLength(3)
    expect(new Set(chosen.map(kind => kind.id)).size).toBe(3)
    expect(chosen.every(kind => plan.pool.includes(kind.id))).toBe(true)
  })

  it('picks the same types for the same seed', () => {
    const plan = readLevelMonsterPlan(LEVELS, 2)!
    const first = selectLevelTypes(plan, kinds, new Rng(7)).map(kind => kind.id)
    const second = selectLevelTypes(plan, kinds, new Rng(7)).map(kind => kind.id)
    expect(second).toEqual(first)
  })

  it('draws from the nightmare pool on nightmare', () => {
    const plan = readLevelMonsterPlan(LEVELS, 2, 'nightmare')!
    const chosen = selectLevelTypes(plan, readMonsterKinds(MONSTATS, 'nightmare'), new Rng(1), 'nightmare')
    expect(chosen.every(kind => plan.nightmarePool.includes(kind.id))).toBe(true)
  })

  it('never picks a disabled or unspawnable monster', () => {
    const plan = readLevelMonsterPlan(
      table(['Id', 'Name', 'MonDen', 'NumMon', 'mon1', 'mon2', 'mon3'], [['9', 'Odd', '500', '3', 'unused1', 'charsi', 'fallen1']]),
      9,
    )!
    expect(selectLevelTypes(plan, kinds, new Rng(1)).map(kind => kind.id)).toEqual(['fallen1'])
  })

  it('returns nothing for a town', () => {
    expect(selectLevelTypes(readLevelMonsterPlan(LEVELS, 1)!, kinds, new Rng(1))).toEqual([])
  })
})

describe('planMonsterGroups', () => {
  const kinds = readMonsterKinds(MONSTATS)
  const plan = readLevelMonsterPlan(LEVELS, 3)!
  const types = selectLevelTypes(plan, kinds, new Rng(4))

  it('spends the whole budget', () => {
    for (const budget of [1, 5, 20, 57]) {
      const groups = planMonsterGroups(plan, types, kinds, budget, new Rng(5))
      expect(groups.reduce((sum, group) => sum + group.count, 0)).toBe(budget)
    }
  })

  it('never builds a normal pack larger than the monster\'s MaxGrp and sizes elites per 1.13c', () => {
    const groups = planMonsterGroups(plan, types, kinds, 40, new Rng(6))
    const normal = groups.filter(group => group.rank === 'normal')
    expect(normal.every(group => group.count >= 1 && group.count <= group.kind.maxGroup)).toBe(true)
    const champions = groups.filter(group => group.rank === 'champion')
    expect(champions.every(group => group.count >= 2 && group.count <= 4)).toBe(true)
    const uniques = groups.filter(group => group.rank === 'unique')
    expect(uniques.every(group => group.count >= 4 && group.count <= 7)).toBe(true)
  })

  it('draws elite packs from umon, not from the ordinary pool', () => {
    const groups = planMonsterGroups(plan, types, kinds, 30, new Rng(8))
    const elites = groups.filter(group => group.rank !== 'normal')
    expect(elites.length).toBeGreaterThan(0)
    expect(elites.every(group => plan.elitePool.includes(group.kind.id))).toBe(true)
  })

  it('places no elites on a level whose MonUMax is blank', () => {
    const moor = readLevelMonsterPlan(LEVELS, 2)!
    const groups = planMonsterGroups(moor, selectLevelTypes(moor, kinds, new Rng(4)), kinds, 30, new Rng(8))
    expect(groups.every(group => group.rank === 'normal')).toBe(true)
  })

  it('is deterministic for a seed and different across seeds', () => {
    const encode = (seed: number): string =>
      planMonsterGroups(plan, types, kinds, 40, new Rng(seed))
        .map(group => `${group.kind.id}:${String(group.count)}:${group.rank}`)
        .join('|')
    expect(encode(11)).toBe(encode(11))
    expect(encode(11)).not.toBe(encode(12))
  })

  it('returns nothing when there is no budget or no types', () => {
    expect(planMonsterGroups(plan, types, kinds, 0, new Rng(1))).toEqual([])
    expect(planMonsterGroups(plan, [], kinds, 10, new Rng(1))).toEqual([])
  })

  it('weights normal pack type selection using kind.rarity', () => {
    const rareKind: MonsterKind = { ...types[0]!, id: 'rare', rarity: 1, minGroup: 1, maxGroup: 1 }
    const commonKind: MonsterKind = { ...types[0]!, id: 'common', rarity: 100, minGroup: 1, maxGroup: 1 }
    const customTypes = [rareKind, commonKind]
    const customPlan = { ...plan, eliteMin: 0, eliteMax: 0 }
    let commonCount = 0
    let rareCount = 0
    const rng = new Rng(42)
    for (let i = 0; i < 200; i += 1) {
      const groups = planMonsterGroups(customPlan, customTypes, kinds, 1, rng)
      if (groups[0]?.kind.id === 'common') commonCount += 1
      if (groups[0]?.kind.id === 'rare') rareCount += 1
    }
    expect(commonCount).toBeGreaterThan(rareCount * 10)
  })
})

describe('monsterStatsOf', () => {
  const kinds = readMonsterKinds(MONSTATS)
  const WALK = 170

  it('rolls health inside the table\'s range', () => {
    const fallen = kinds.get('fallen1')!
    for (let seed = 0; seed < 50; seed += 1) {
      const stats = monsterStatsOf(fallen, new Rng(seed), WALK)
      expect(stats.hp).toBeGreaterThanOrEqual(21)
      expect(stats.hp).toBeLessThanOrEqual(61)
    }
  })

  it('rolls a different health for different monsters in a pack', () => {
    const fallen = kinds.get('fallen1')!
    const rng = new Rng(3)
    const rolls = new Set(Array.from({ length: 20 }, () => monsterStatsOf(fallen, rng, WALK).hp))
    expect(rolls.size).toBeGreaterThan(1)
  })

  it('scales speed off the player rather than off a magic number', () => {
    // Velocity 6 is the player's own walking speed, so a monster at 6 must
    // match the player exactly; the rest follow that ratio.
    const fallen = kinds.get('fallen1')!
    const zombie = kinds.get('zombie1')!
    expect(monsterStatsOf(fallen, new Rng(1), WALK).speed).toBe(Math.round((5 / 6) * WALK))
    expect(monsterStatsOf(zombie, new Rng(1), WALK).speed).toBe(Math.round((1 / 6) * WALK))
    expect(monsterStatsOf(zombie, new Rng(1), WALK).speed)
      .toBeLessThan(monsterStatsOf(fallen, new Rng(1), WALK).speed)
  })

  it('turns aidist into a pixel radius and falls back when it is blank', () => {
    expect(monsterStatsOf(kinds.get('quillrat1')!, new Rng(1), WALK).aggroRadius).toBe(12 * 16)
    expect(monsterStatsOf(kinds.get('fallen1')!, new Rng(1), WALK).aggroRadius).toBe(35 * 16)
  })

  it('carries the experience through unchanged', () => {
    expect(monsterStatsOf(kinds.get('fallen1')!, new Rng(1), WALK).xp).toBe(61)
    expect(monsterStatsOf(kinds.get('zombie1')!, new Rng(1), WALK).xp).toBe(111)
  })

  it('never produces a monster that cannot be hit or cannot hit back', () => {
    for (const kind of kinds.values()) {
      const stats = monsterStatsOf(kind, new Rng(2), WALK)
      expect(stats.hp).toBeGreaterThanOrEqual(1)
      expect(stats.damage).toBeGreaterThanOrEqual(1)
      expect(stats.speed).toBeGreaterThanOrEqual(1)
      expect(stats.reach).toBeGreaterThan(0)
    }
  })

  it('uses the id when the name key is blank', () => {
    const nameless: MonsterKind = { ...kinds.get('fallen1')!, nameKey: '' }
    expect(monsterStatsOf(nameless, new Rng(1), WALK).name).toBe('fallen1')
  })

  it('calculates reach from art meleeRange with DEFAULT_REACH_PX floor', () => {
    const fallen = kinds.get('fallen1')!
    expect(monsterStatsOf(fallen, new Rng(1), WALK, undefined, { meleeRange: 0 }).reach).toBe(DEFAULT_REACH_PX)
    expect(monsterStatsOf(fallen, new Rng(1), WALK, undefined, { meleeRange: 1 }).reach).toBe(DEFAULT_REACH_PX)
    expect(monsterStatsOf(fallen, new Rng(1), WALK, undefined, { meleeRange: 4 }).reach).toBe(64)
  })

  it('falls back to kind.meleeRange when art is omitted', () => {
    const withReach: MonsterKind = { ...kinds.get('fallen1')!, meleeRange: 5 }
    expect(monsterStatsOf(withReach, new Rng(1), WALK).reach).toBe(80)
    const base = kinds.get('fallen1')!
    expect(monsterStatsOf(base, new Rng(1), WALK).reach).toBe(DEFAULT_REACH_PX)
  })
})

describe('readMonUModConstants and MonUMod constants', () => {
  it('reads constant desc and numeric constant values from MonUMod table', () => {
    const tableData = table(
      ['uniquemod', 'id', 'constants', '*constant desc'],
      [
        ['', '', '20', 'champion chance'],
        ['', '', '100', 'minion +hp%'],
        ['', '', '200', 'champion +hp%'],
        ['', '', '300', 'unique +hp%'],
        ['', '', '150', 'unique +dmg% (strong)'],
        ['', '', '', 'empty row'],
      ],
    )
    const constants = readMonUModConstants(tableData)
    expect(constants.get('champion chance')).toBe(20)
    expect(constants.get('minion +hp%')).toBe(100)
    expect(constants.get('champion +hp%')).toBe(200)
    expect(constants.get('unique +hp%')).toBe(300)
    expect(constants.get('unique +dmg% (strong)')).toBe(150)
    expect(constants.has('empty row')).toBe(false)
  })

  it('provides canonical MONUMOD_CONSTANTS with expected values', () => {
    expect(MONUMOD_CONSTANTS.championChance).toBe(20)
    expect(MONUMOD_CONSTANTS.minionHpPct).toBe(100)
    expect(MONUMOD_CONSTANTS.championHpPct).toBe(200)
    expect(MONUMOD_CONSTANTS.uniqueHpPct).toBe(300)
    expect(MONUMOD_CONSTANTS.uniqueDmgPctStrong).toBe(150)
  })

  it('calculates ELITE_HEALTH_MULTIPLIER using MonUMod constants', () => {
    expect(ELITE_HEALTH_MULTIPLIER.normal).toBe(1)
    expect(ELITE_HEALTH_MULTIPLIER.champion).toBe(1 + MONUMOD_CONSTANTS.championHpPct / 100)
    expect(ELITE_HEALTH_MULTIPLIER.unique).toBe(1 + MONUMOD_CONSTANTS.uniqueHpPct / 100)
    expect(ELITE_HEALTH_MULTIPLIER.champion).toBe(3)
    expect(ELITE_HEALTH_MULTIPLIER.unique).toBe(4)
  })
})

describe('readMonsterScaling', () => {
  const scaling = readMonsterScaling(MONLVL)

  it('reads the five multipliers for a level', () => {
    expect(scaling.get(1)).toEqual({ armour: 6, toHit: 8, health: 7, damage: 2, experience: 30 })
  })

  it('reads the difficulty columns', () => {
    expect(readMonsterScaling(MONLVL, 'nightmare').get(1)).toEqual({
      armour: 61, toHit: 73, health: 107, damage: 30, experience: 78,
    })
  })

  it('has no entry for a level the table does not list', () => {
    expect(scaling.get(7)).toBeUndefined()
  })
})

describe('monsterScaleFor', () => {
  const kinds = readMonsterKinds(MONSTATS)
  const scaling = readMonsterScaling(MONLVL)

  it('looks up by monsterLevelFor (respecting boss and difficulty rules)', () => {
    const fallen = kinds.get('fallen1')!
    expect(monsterLevelFor(fallen, 'normal', 0)).toBe(1)
    expect(monsterScaleFor(scaling, monsterLevelFor(fallen, 'normal', 0))).toEqual(scaling.get(1))

    // On Nightmare/Hell, non-boss takes areaLevel (KB 360)
    expect(monsterLevelFor(fallen, 'nightmare', 36)).toBe(36)
    const nightmare = readMonsterScaling(MONLVL, 'nightmare')
    expect(monsterScaleFor(nightmare, monsterLevelFor(fallen, 'nightmare', 36))).toEqual(nightmare.get(36))

    // Boss takes monster's own level on all difficulties
    const bossKind: MonsterKind = { ...fallen, boss: true, level: [10, 40, 70] }
    expect(monsterLevelFor(bossKind, 'hell', 85)).toBe(70)
  })

  it('falls back to no scaling rather than to zero when the level is missing', () => {
    // Zero multipliers would silently produce a monster with one health and one
    // damage, which looks like a working monster rather than like a gap.
    const offTable: MonsterKind = { ...kinds.get('fallen1')!, level: [7, 7, 7] }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(monsterScaleFor(scaling, offTable.level[0])).toBe(UNSCALED)
    } finally {
      warn.mockRestore()
    }
  })

  it('warns instead of silently substituting UNSCALED', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // 4242 has never been warned about, so the once-per-level guard cannot
      // swallow this one.
      monsterScaleFor(scaling, 4242)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toContain('MonLvl.txt has no row for level 4242')
      // Once per level, not once per monster rolled at that level.
      monsterScaleFor(scaling, 4242)
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  it('throws in strict mode', () => {
    setMonsterScalingStrict(true)
    try {
      expect(() => monsterScaleFor(scaling, 4243)).toThrow(/MonLvl\.txt has no row for level 4243/)
      // A level the table does carry is still fine.
      expect(monsterScaleFor(scaling, 1)).toEqual(scaling.get(1))
    } finally {
      setMonsterScalingStrict(false)
    }
  })

  it('reports the miss to a caller that asks, without touching the console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(monsterScaleLookup(scaling, 1)).toEqual({ scale: scaling.get(1), missing: false })
      expect(monsterScaleLookup(scaling, 4244)).toEqual({ scale: UNSCALED, missing: true })
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})


describe('planLevelMonsters reports missing MonLvl rows', () => {
  const tables = { levels: LEVELS, monstats: MONSTATS, monlvl: MONLVL }

  it('reports nothing when every rolled level has a row', () => {
    const plan = planLevelMonsters(tables, 2, 6400, 1234, 170)
    expect(plan.packs.length).toBeGreaterThan(0)
    expect(plan.missingScalingLevels).toEqual([])
  })

  it('names the level whose row is missing instead of pretending it scaled', () => {
    // Same table with the level-1 and level-2 rows taken out: the Blood Moor's
    // monsters are all `Level` 1, so every one of them now rolls unscaled.
    const thin = table(
      ['Level', 'AC', 'AC(N)', 'TH', 'TH(N)', 'HP', 'HP(N)', 'DM', 'DM(N)', 'XP', 'XP(N)'],
      [['30', '180', '190', '309', '320', '133', '300', '19', '52', '660', '1600']],
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const plan = planLevelMonsters({ ...tables, monlvl: thin }, 2, 6400, 1234, 170)
      expect(plan.packs.length).toBeGreaterThan(0)
      expect(plan.missingScalingLevels).toEqual([1])
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})

describe('planLevelMonsters with monstats2 table', () => {
  it('wires monster art into monster stats reach', () => {
    const monstats2WithReach = table(
      ['Id', 'SizeX', 'SizeY', 'pixHeight', 'MeleeRng', 'BaseW', 'TotalPieces', 'dDT'],
      [
        ['fallen1', '2', '2', '64', '4', 'hth', '6', '8'],
        ['zombie1', '2', '2', '80', '0', 'hth', '1', '8'],
        ['quillrat1', '2', '2', '48', '1', 'hth', '1', '8'],
        ['quillrat6', '2', '2', '48', '1', 'hth', '1', '8'],
      ],
    )
    const tables = { levels: LEVELS, monstats: MONSTATS, monlvl: MONLVL, monstats2: monstats2WithReach }
    const plan = planLevelMonsters(tables, 2, 6400, 1234, 170)
    const fallenMember = plan.packs.flatMap(p => p.members).find(m => m.id === 'fallen1')
    expect(fallenMember).toBeDefined()
    expect(fallenMember?.reach).toBe(64)
  })
})

describe('monsterStatsOf with MonLvl scaling', () => {
  const kinds = readMonsterKinds(MONSTATS)
  const scaling = readMonsterScaling(MONLVL)
  const WALK = 170

  it('turns the table\'s numbers into the game\'s', () => {
    // The five reconciliations that pinned the formula down, as a test.
    const fallen = kinds.get('fallen1')!
    const scaled = monsterStatsOf(fallen, new Rng(1), WALK, monsterScaleFor(scaling, monsterLevelFor(fallen, 'normal', 0)))
    expect(scaled.xp).toBe(18)
    expect(scaled.damage).toBeLessThanOrEqual(3)
    expect(scaled.hp).toBeLessThanOrEqual(6)

    const zombie = kinds.get('zombie1')!
    expect(monsterStatsOf(zombie, new Rng(1), WALK, monsterScaleFor(scaling, monsterLevelFor(zombie, 'normal', 0))).xp).toBe(33)
    const quillrat = kinds.get('quillrat1')!
    expect(monsterStatsOf(quillrat, new Rng(1), WALK, monsterScaleFor(scaling, monsterLevelFor(quillrat, 'normal', 0))).xp).toBe(21)
  })

  it('leaves the raw numbers unplayable, which is why scaling is not optional', () => {
    // A guard against someone dropping the scale argument at a call site: the
    // unscaled Fallen hits for 76 and the player has 60 health.
    const fallen = kinds.get('fallen1')!
    expect(monsterStatsOf(fallen, new Rng(1), WALK).damage).toBeGreaterThan(50)
  })

  it('never scales a monster out of existence', () => {
    for (const kind of kinds.values()) {
      const stats = monsterStatsOf(kind, new Rng(2), WALK, monsterScaleFor(scaling, monsterLevelFor(kind, 'normal', 0)))
      expect(stats.hp).toBeGreaterThanOrEqual(1)
      expect(stats.damage).toBeGreaterThanOrEqual(1)
    }
  })

  it('rolls before scaling so the range does not collapse', () => {
    // At level 1 the health multiplier is 7%, turning 21..61 into about 1..4.
    // Scaling the bounds first and rolling between the rounded ends would give
    // the same handful of values every time; rolling first keeps the spread.
    const fallen = kinds.get('fallen1')!
    const scale = monsterScaleFor(scaling, monsterLevelFor(fallen, 'normal', 0))
    const rng = new Rng(9)
    const rolls = new Set(Array.from({ length: 60 }, () => monsterStatsOf(fallen, rng, WALK, scale).hp))
    expect(rolls.size).toBeGreaterThan(2)
  })

  it('makes a Hell monster dangerous through its level, not its difficulty columns', () => {
    const normal = kinds.get('fallen1')!
    const hellKinds = readMonsterKinds(MONSTATS, 'hell')
    // The fixture has no Hell health columns for fallen1, exactly as many real
    // rows do not; the danger has to come from the level lookup regardless.
    const hell = hellKinds.get('fallen1')!
    expect(hell.level[2]).toBe(67)
    const scaledNormal = monsterStatsOf(normal, new Rng(1), WALK, monsterScaleFor(scaling, monsterLevelFor(normal, 'normal', 0)))
    const withLevel50 = monsterStatsOf(normal, new Rng(1), WALK, readMonsterScaling(MONLVL).get(50)!)
    expect(withLevel50.hp).toBeGreaterThan(scaledNormal.hp * 20)
    expect(withLevel50.xp).toBeGreaterThan(scaledNormal.xp * 20)
  })
})

describe('monsterColumns', () => {
  it('reads columns up to slot 25 and stops when column is missing in header', () => {
    const header = ['Id', 'mon1', 'mon2', 'mon3', 'mon4', 'mon5']
    const row = ['1', 'fallen', 'zombie', '', 'skeleton', '']
    const cols = monsterColumns({ header, rows: [row] }, row, 'mon')
    expect(cols).toEqual(['fallen', 'zombie', 'skeleton'])
  })

  it('supports up to mon25 when present in header', () => {
    const header = ['Id', ...Array.from({ length: 25 }, (_, i) => `mon${String(i + 1)}`)]
    const row = ['1', ...Array.from({ length: 25 }, (_, i) => (i === 24 ? 'hellbovine' : ''))]
    const cols = monsterColumns({ header, rows: [row] }, row, 'mon')
    expect(cols).toEqual(['hellbovine'])
  })
})

describe('applyEliteModifiers stat scaling', () => {
  const baseStats = {
    id: 'zombie',
    name: 'Zombie',
    hp: 100,
    damage: 10,
    speed: 10,
    reach: 40,
    aggroRadius: 200,
    cooldownTicks: 25,
    xp: 50,
  }

  it('applies stoneskin hp scaling (2x)', () => {
    const res = applyEliteModifiers(baseStats, 'unique', ['stoneskin'])
    expect(res.hp).toBe(200)
  })

  it('applies cursed damage scaling (1.2x)', () => {
    const res = applyEliteModifiers(baseStats, 'unique', ['cursed'])
    expect(res.damage).toBe(12)
  })

  it('applies elemental and spectralhit damage scaling (1.2x)', () => {
    expect(applyEliteModifiers(baseStats, 'unique', ['coldenchant']).damage).toBe(12)
    expect(applyEliteModifiers(baseStats, 'unique', ['fireenchant']).damage).toBe(12)
    expect(applyEliteModifiers(baseStats, 'unique', ['lightenchant']).damage).toBe(12)
    expect(applyEliteModifiers(baseStats, 'unique', ['spectralhit']).damage).toBe(12)
  })

  it('applies teleport speed scaling (1.2x)', () => {
    const res = applyEliteModifiers(baseStats, 'unique', ['teleport'])
    expect(res.speed).toBe(12)
  })

  it('applies magicresistant hp scaling (1.2x)', () => {
    const res = applyEliteModifiers(baseStats, 'unique', ['magicresistant'])
    expect(res.hp).toBe(120)
  })

  it('applies aura damage (1.2x) and speed (1.1x) scaling', () => {
    const res = applyEliteModifiers(baseStats, 'unique', ['aura'])
    expect(res.damage).toBe(12)
    expect(res.speed).toBe(11)
  })
})
