import { describe, expect, it } from 'vitest'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import {
  evaluateAvoidanceAndBlock,
  executeSUnitDmg,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'

function makeCombatUnit(
  id: string,
  unitType: 'player' | 'monster',
  hp = 1000,
  extra?: Partial<CombatUnitContext>,
): CombatUnitContext {
  const statList = new UnitStatList()
  statList.setBaseStat('level', 20)
  statList.setBaseStat('maxhp', hp * FIXED_ONE)
  statList.setHp256(hp * FIXED_ONE)
  statList.setBaseStat('tohit', 500)
  statList.setBaseStat('armorclass', 50)
  const stateBus = new StateBus(statList)
  return {
    id,
    name: id,
    unitType,
    statList,
    stateBus,
    ...extra,
  }
}

describe('Issue #1414: executeSUnitDmg & evaluateAvoidanceAndBlock 1.13c RNG parity', () => {
  it('rolls physical damage uniformly across [10, 20] with mean ~15 (D2Game.dll 0x6FCFCD80 -> 0x6FCFBED0, 0x6FCFD5C2)', () => {
    const rng = new D2Rng(0x1414_0001)
    const attacker = makeCombatUnit('mon_a1', 'monster', 1000)
    const seen = new Set<number>()
    let sum = 0
    const samples = 10_000

    for (let i = 0; i < samples; i += 1) {
      const defender = makeCombatUnit('target', 'player', 1000)
      const out = executeSUnitDmg(
        attacker,
        defender,
        {
          skillId: 0,
          attackKind: 'melee',
          srcDam: 0,
          flatPhysMin256: 10 * FIXED_ONE,
          flatPhysMax256: 20 * FIXED_ONE,
          autoHit: true,
          unblockable: true,
        },
        rng,
      )
      expect(out.totalDamage).toBeGreaterThanOrEqual(10)
      expect(out.totalDamage).toBeLessThanOrEqual(20)
      seen.add(out.totalDamage)
      sum += out.totalDamage
    }

    // Every integer value 10..20 must be covered
    for (let v = 10; v <= 20; v += 1) {
      expect(seen.has(v)).toBe(true)
    }
    const mean = sum / samples
    expect(mean).toBeGreaterThan(14.8)
    expect(mean).toBeLessThan(15.2)
  })

  it('uses 1.13c unarmed 1-2 damage instead of fabricated 25-45 when weaponMinPhys/weaponMaxPhys are omitted (0x6FCFC5A2..0x6FCFC5C8)', () => {
    const rng = new D2Rng(0x1414_0002)
    const attacker = makeCombatUnit('unarmed_player', 'player', 1000)
    const seen = new Set<number>()

    for (let i = 0; i < 200; i += 1) {
      const defender = makeCombatUnit('dummy', 'monster', 1000)
      const out = executeSUnitDmg(
        attacker,
        defender,
        {
          skillId: 0,
          attackKind: 'melee',
          srcDam: 128,
          autoHit: true,
          unblockable: true,
        },
        rng,
      )
      expect(out.totalDamage).toBeGreaterThanOrEqual(1)
      expect(out.totalDamage).toBeLessThanOrEqual(2)
      seen.add(out.totalDamage)
    }

    expect(seen.has(1)).toBe(true)
    expect(seen.has(2)).toBe(true)
  })

  it('draws independent RNG rolls for To-Hit (0x6FCFE011) and Critical Strike (0x6FCFD573) without reusing the hit roll', () => {
    const rng = new D2Rng(0x1414_0003)
    const attacker = makeCombatUnit('ama', 'player', 1000, {
      weaponMinPhys: 10,
      weaponMaxPhys: 10,
    })
    // Set high AR vs low AC so hit chance is clamped at 95%, and CS = 30%
    attacker.statList.setBaseStat('tohit', 50_000)
    attacker.statList.setBaseStat('passive_critical_strike', 30)

    let hits = 0
    let crits = 0
    const trials = 10_000

    for (let i = 0; i < trials; i += 1) {
      const defender = makeCombatUnit('mob', 'monster', 1000)
      defender.statList.setBaseStat('armorclass', 10)
      const out = executeSUnitDmg(
        attacker,
        defender,
        {
          skillId: 0,
          attackKind: 'melee',
          srcDam: 128,
          unblockable: true,
        },
        rng,
      )
      if (out.hit) {
        hits += 1
        if (out.isCritical) {
          crits += 1
        }
      }
    }

    const hitRate = hits / trials
    const critGivenHitRate = crits / hits
    expect(hitRate).toBeGreaterThan(0.935)
    expect(hitRate).toBeLessThan(0.965)
    expect(critGivenHitRate).toBeGreaterThan(0.28)
    expect(critGivenHitRate).toBeLessThan(0.32)

    // Explicit proof that hit roll 80 (which hits at 95% to-hit) can still crit when RNG draws < 30 for CS:
    const defender = makeCombatUnit('mob_explicit', 'monster', 1000)
    defender.statList.setBaseStat('armorclass', 10)
    const seqRolls = [80, 15] // 1st roll: hit=80 (<95), 2nd roll: CS=15 (<30)
    let idx = 0
    const mockRng = {
      rand(_max: number): number {
        return seqRolls[idx++] ?? 0
      },
    }
    const explicitOut = executeSUnitDmg(
      attacker,
      defender,
      {
        skillId: 0,
        attackKind: 'melee',
        srcDam: 128,
        unblockable: true,
      },
      mockRng,
    )
    expect(explicitOut.hit).toBe(true)
    expect(explicitOut.isCritical).toBe(true)
    expect(explicitOut.totalDamage).toBe(20)
  })

  it('enforces compile-time RNG requirement on executeSUnitDmg and evaluateAvoidanceAndBlock', () => {
    const attacker = makeCombatUnit('a', 'player', 100)
    const defender = makeCombatUnit('b', 'monster', 100, { hasShield: true })
    defender.statList.setBaseStat('toblock', 50)
    const rng = new D2Rng(0x1414_0004)

    expect(() => {
      // @ts-expect-error executeSUnitDmg must reject calls that omit both packet.rng and the 4th rng argument
      executeSUnitDmg(attacker, defender, {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
      })
    }).toThrow(/rng is required/)

    expect(() => {
      // @ts-expect-error evaluateAvoidanceAndBlock must reject calls that omit rng
      evaluateAvoidanceAndBlock({
        defender,
        attackKind: 'melee',
      })
    }).toThrow(/rng is required/)

    const validBlock = evaluateAvoidanceAndBlock({
      defender,
      attackKind: 'melee',
      rng,
    })
    expect(typeof validBlock.avoided).toBe('boolean')
  })
})
