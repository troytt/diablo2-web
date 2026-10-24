/**
 * 1.13c life / mana steal parity (issue #1413).
 *
 * Ground truth: `samples/d2/D2Game.dll` 0x6FCFBA40 (steal on the damage record: +0x08 physical,
 * +0x38 / +0x3C lifedrainmindam / manadrainmindam %), 0x6FC214D0 (MulDiv), 0x6FCFB570 /
 * 0x6FCFAE70 (life / mana add clamped to max), `DifficultyLevels.txt` `LifeStealDivisor` /
 * `ManaStealDivisor` (Patch_D2.mpq: 1 / 2 / 3, record +0x28 / +0x2C) and `MonStats.txt`
 * `Drain` / `Drain(N)` / `Drain(H)` (`MonStatsTxt + 0xA0 + difficulty`).
 * See `kb/combat/d2game-life-mana-steal-113c.md`.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import {
  computeLifeManaSteal113c,
  executeSUnitDmg,
  isMonsterClassUnit113c,
  mulDiv113c,
  stealAttackerClass113c,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import {
  difficultyLifeStealDivisor,
  difficultyManaStealDivisor,
} from '../../src/server/engine/difficulty-resist-penalty.ts'
import { MONSTATS_113C_ROWS } from '../../src/common/units/monstats-113c-data.ts'
import { getCanonicalMonsterKinds } from '../../src/common/units/monsters-data.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

type UnitType = NonNullable<CombatUnitContext['unitType']>

function unit(unitType: UnitType, stats: Record<string, number>, extra: Partial<CombatUnitContext> = {}): CombatUnitContext {
  const statList = new UnitStatList()
  statList.setBaseStat('level', 50)
  statList.setBaseStat('maxhp', 1000 * FIXED_ONE)
  statList.setHp256(500 * FIXED_ONE)
  statList.setBaseStat('maxmana', 1000 * FIXED_ONE)
  statList.setMana256(500 * FIXED_ONE)
  for (const [k, v] of Object.entries(stats)) statList.setBaseStat(k, v)
  return { id: `${unitType}_1`, name: unitType, unitType, statList, stateBus: new StateBus(statList), ...extra }
}

function physHit(attacker: CombatUnitContext, defender: CombatUnitContext, phys: number) {
  return executeSUnitDmg(attacker, defender, {
    skillId: 0,
    attackKind: 'melee',
    autoHit: true,
    unblockable: true,
    srcDam: 0,
    flatPhysMin256: phys * FIXED_ONE,
    flatPhysMax256: phys * FIXED_ONE,
  }, { rand: () => 50 })
}

describe('DifficultyLevels.txt steal divisors (server loader)', () => {
  it('reads LifeStealDivisor / ManaStealDivisor 1 / 2 / 3 from the baked table', () => {
    expect([0, 1, 2].map(difficultyLifeStealDivisor)).toEqual([1, 2, 3])
    expect([0, 1, 2].map(difficultyManaStealDivisor)).toEqual([1, 2, 3])
    expect(() => difficultyLifeStealDivisor(3)).toThrow()
  })
})

describe('MonStats.txt Drain reaches the runtime monster record (all 734 rows x 3 difficulties)', () => {
  it('baked MONSTATS_113C_ROWS.drain equals samples/d2/excel/MonStats.txt Drain / Drain(N) / Drain(H)', () => {
    const lines = readFileSync('samples/d2/excel/MonStats.txt', 'latin1').split(/\r?\n/).filter((l) => l.length > 0)
    const header = lines[0]!.split('\t')
    const idCol = header.indexOf('Id')
    const cols = ['Drain', 'Drain(N)', 'Drain(H)'].map((c) => header.indexOf(c))
    expect(cols.every((c) => c >= 0)).toBe(true)
    const byId = new Map<string, number[]>()
    for (const line of lines.slice(1)) {
      const cells = line.split('\t')
      const id = cells[idCol] ?? ''
      if (id === '' || id === 'Expansion') continue
      byId.set(id, cols.map((c) => Number(cells[c] ?? '') || 0))
    }
    expect(MONSTATS_113C_ROWS.length).toBe(734)
    let checked = 0
    for (const row of MONSTATS_113C_ROWS) {
      const expected = byId.get(row.id)
      expect(expected, row.id).toBeDefined()
      expect([...row.drain], row.id).toEqual(expected)
      checked++
    }
    expect(checked).toBe(734)
    expect([...MONSTATS_113C_ROWS.find((r) => r.id === 'zombie1')!.drain]).toEqual([100, 75, 50])
    expect([...MONSTATS_113C_ROWS.find((r) => r.id === 'bighead1')!.drain]).toEqual([100, 85, 75])
    expect([...MONSTATS_113C_ROWS.find((r) => r.id === 'skeleton1')!.drain]).toEqual([0, 0, 0])
  })

  it('per-difficulty canonical monster kinds carry the matching Drain column', () => {
    ;(['normal', 'nightmare', 'hell'] as const).forEach((diff, tier) => {
      const kinds = getCanonicalMonsterKinds(diff)
      for (const row of MONSTATS_113C_ROWS) {
        const kind = kinds.get(row.id.toLowerCase()) ?? kinds.get(row.id)
        if (kind === undefined) continue
        expect(kind.drain, `${row.id} ${diff}`).toBe(row.drain[tier])
      }
    })
  })
})

describe('D2Game 0x6FC214D0 MulDiv', () => {
  it('follows the small / large-a / large-b branches', () => {
    expect(mulDiv113c(640, 25600, 0)).toBe(0)
    expect(mulDiv113c(640, 25600, 100)).toBe(163840) // 32-bit a*b/c
    // b > 0x100000 and c <= b >> 4: (b / c) * a
    expect(mulDiv113c(640, 1_280_000, 100)).toBe(12800 * 640)
    expect(mulDiv113c(7, 1_280_050, 100)).toBe(12800 * 7)
    // b > 0x100000 and c > b >> 4: 64-bit product
    expect(mulDiv113c(3, 0x100001, 0x20000)).toBe(Math.trunc((3 * 0x100001) / 0x20000))
    // a > 0x10000 and c <= a >> 4: (a / c) * b
    expect(mulDiv113c(0x20000, 1000, 100)).toBe(Math.trunc(0x20000 / 100) * 1000)
  })
})

describe('D2Game 0x6FCFBA40 steal formula', () => {
  const base = {
    phys256: 100 * FIXED_ONE,
    lifeStealPct: 10,
    manaStealPct: 0,
    attackerIsPlayer: true,
    defenderIsMonster: true,
  }

  it('10% life steal, Normal, zombie1 (Drain 100), 100 physical -> exactly 10 life', () => {
    const r = computeLifeManaSteal113c({ ...base, lifeStealDivisor: 1, manaStealDivisor: 1, defenderDrain: 100 })
    expect(r.life256).toBe(10 * FIXED_ONE)
  })

  it('Hell zombie1: (10 << 6) / 3 = 213, MulDiv(213, 25600, 100) = 54528, x50/100 = 27264, >> 6 = 426', () => {
    const r = computeLifeManaSteal113c({ ...base, lifeStealDivisor: 3, manaStealDivisor: 3, defenderDrain: 50 })
    expect(r.life256).toBe(426)
  })

  it('Nightmare zombie1 mana: (10 << 6) / 2 = 320 -> 81920 -> x75/100 = 61440 -> 960', () => {
    const r = computeLifeManaSteal113c({
      ...base,
      lifeStealPct: 0,
      manaStealPct: 10,
      lifeStealDivisor: 2,
      manaStealDivisor: 2,
      defenderDrain: 75,
    })
    expect(r).toEqual({ life256: 0, mana256: 960 })
  })

  it('Drain 0 (skeleton1) blocks steal entirely; missing Drain on a monster defender throws', () => {
    expect(computeLifeManaSteal113c({ ...base, lifeStealDivisor: 1, manaStealDivisor: 1, defenderDrain: 0 })).toEqual({
      life256: 0,
      mana256: 0,
    })
    expect(() =>
      computeLifeManaSteal113c({ ...base, lifeStealDivisor: 1, manaStealDivisor: 1, defenderDrain: undefined }),
    ).toThrow()
  })

  it('only UNIT_PLAYER attackers are divided; non-monster defenders use drain 100', () => {
    const owned = computeLifeManaSteal113c({
      ...base,
      attackerIsPlayer: false,
      lifeStealDivisor: 3,
      manaStealDivisor: 3,
      defenderDrain: 50,
    })
    expect(owned.life256).toBe(5 * FIXED_ONE) // 10% * 100 * 50/100, no divisor
    const vsPlayer = computeLifeManaSteal113c({
      ...base,
      defenderIsMonster: false,
      lifeStealDivisor: 1,
      manaStealDivisor: 1,
      defenderDrain: undefined,
    })
    expect(vsPlayer.life256).toBe(10 * FIXED_ONE)
  })

  it('classifies attackers and defenders by unit type', () => {
    expect(stealAttackerClass113c({ unitType: 'player' })).toBe('player')
    expect(stealAttackerClass113c({ unitType: 'mercenary' })).toBe('owned')
    expect(stealAttackerClass113c({ unitType: 'minion' })).toBe('owned')
    expect(stealAttackerClass113c({ unitType: 'monster' })).toBeUndefined()
    expect(isMonsterClassUnit113c({ unitType: 'monster' })).toBe(true)
    expect(isMonsterClassUnit113c({ unitType: 'mercenary' })).toBe(true)
    expect(isMonsterClassUnit113c({ unitType: 'player' })).toBe(false)
  })
})

describe('executeSUnitDmg steal integration', () => {
  it('reads ItemStatCost lifedrainmindam / manadrainmindam (60 / 62), not MagicSuffix codes', () => {
    const attacker = unit('player', { lifedrainmindam: 10, manadrainmindam: 10 })
    const out = physHit(attacker, unit('monster', {}, { drain: 100 }), 100)
    expect(out.attackerHealed256).toBe(10 * FIXED_ONE)
    expect(out.attackerManaLeeched256).toBe(10 * FIXED_ONE)
    expect(attacker.statList.getHp256()).toBe(510 * FIXED_ONE)
    expect(attacker.statList.getMana256()).toBe(510 * FIXED_ONE)

    const legacy = unit('player', { lifesteal: 10, manasteal: 10, life_leech: 10, item_parasite: 10 })
    const legacyOut = physHit(legacy, unit('monster', {}, { drain: 100 }), 100)
    expect(legacyOut.attackerHealed256 ?? 0).toBe(0)
    expect(legacyOut.attackerManaLeeched256 ?? 0).toBe(0)
  })

  it('applies the Hell divisor and Drain, and never steals from Drain 0 monsters', () => {
    const hell = unit('player', { lifedrainmindam: 10 }, { lifeStealDivisor: 3, manaStealDivisor: 3 })
    expect(physHit(hell, unit('monster', {}, { drain: 50 }), 100).attackerHealed256).toBe(426)
    const skel = unit('player', { lifedrainmindam: 10 })
    expect(physHit(skel, unit('monster', {}, { drain: 0 }), 100).attackerHealed256 ?? 0).toBe(0)
  })

  it('heal is clamped to max life (0x6FCFB570) and reported as the real gain', () => {
    const attacker = unit('player', { lifedrainmindam: 50 })
    attacker.statList.setHp256(995 * FIXED_ONE)
    const out = physHit(attacker, unit('monster', {}, { drain: 100 }), 100)
    expect(attacker.statList.getHp256()).toBe(1000 * FIXED_ONE)
    expect(out.attackerHealed256).toBe(5 * FIXED_ONE)
  })

  it('plain monster attackers do not use the percentage steal branch', () => {
    const mon = unit('monster', { lifedrainmindam: 50 })
    expect(physHit(mon, unit('player', {}), 100).attackerHealed256 ?? 0).toBe(0)
  })
})

describe('GameInstance player hit feeds equipped stat 60 / 62 and writes the steal back', () => {
  function setup(difficulty: 0 | 1 | 2, defId: string, stats: [number, number][]) {
    const game = new GameInstance({ seed: 1413 + difficulty, areaId: 1, difficulty })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'Hero', x: 10, y: 10, areaId: 1 })
    const internal = game as unknown as {
      players: Map<number, { items: unknown[]; hpFixed: number; maxHpFixed: number; manaFixed: number; maxManaFixed: number }>
      monsters: Map<number, { hp: number }>
    }
    const player = internal.players.get(playerId)!
    player.items.push({
      unitId: 9901,
      code: 'rin',
      name: 'Ring',
      quality: 4,
      level: 1,
      location: 'equipped',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      areaId: 1,
      ownerId: playerId,
      bodyLoc: 6,
      storePage: 0,
      cost: 0,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 0,
      maxDurability: 0,
      quantity: 1,
      stats: new Map(stats),
      socketedItems: [],
    })
    player.hpFixed = Math.trunc(player.maxHpFixed / 2)
    player.manaFixed = 0
    const monsterId = game.spawnMonster({ defId, x: 12, y: 10, areaId: 1, hp: 100000, maxHp: 100000 })
    return { game, player, playerId, monsterId }
  }

  it('Normal zombie1: 10% life steal on 100 physical heals exactly 10 life', () => {
    const { game, player, playerId, monsterId } = setup(0, 'zombie1', [[60, 10]])
    const before = player.hpFixed
    game.applyDamageToMonster(monsterId, 100, playerId, 0, 'phys')
    expect(player.hpFixed - before).toBe(10 * FIXED_ONE)
  })

  it('Hell zombie1 (ResDm(H) 50 -> 50 physical lands): 213 / 256 life; Nightmare mana 960 / 256', () => {
    const hell = setup(2, 'zombie1', [[60, 10]])
    const before = hell.player.hpFixed
    hell.game.applyDamageToMonster(hell.monsterId, 100, hell.playerId, 0, 'phys')
    // 50 phys: MulDiv(213, 12800, 100) = 27264, x50/100 = 13632, >> 6 = 213
    expect(hell.player.hpFixed - before).toBe(213)

    const nm = setup(1, 'zombie1', [[62, 10]])
    nm.game.applyDamageToMonster(nm.monsterId, 100, nm.playerId, 0, 'phys')
    expect(nm.player.manaFixed).toBe(960)
  })

  it('skeleton1 (Drain 0) never gives life; hireling-routed hits never steal for the owner', () => {
    const skel = setup(0, 'skeleton1', [[60, 10]])
    const before = skel.player.hpFixed
    skel.game.applyDamageToMonster(skel.monsterId, 100, skel.playerId, 0, 'phys')
    expect(skel.player.hpFixed).toBe(before)

    const merc = setup(0, 'zombie1', [[60, 10]])
    const mercBefore = merc.player.hpFixed
    const internal = merc.game as unknown as {
      players: Map<number, unknown>
      monsters: Map<number, unknown>
      applyDamageToMonster: (...args: unknown[]) => void
    }
    internal.applyDamageToMonster(
      internal.players.get(merc.playerId),
      internal.monsters.get(merc.monsterId),
      100,
      0,
      'phys',
      'merc',
    )
    expect(merc.player.hpFixed).toBe(mercBefore)
  })
})
