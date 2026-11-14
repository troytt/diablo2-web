/**
 * Issue #1446 — `UnitStatList` 1.13c zero-initialization & `ItemStatCost` ID normalization parity.
 *
 * Ground truth (`samples/d2/D2Common.dll`, base `0x6FD50000`, `samples/d2/D2Game.dll`, base `0x6FC20000`):
 * - `D2Common_11013` (`STATLIST_AllocStatList`, `0x6FD88100`): allocates `0x3C` bytes and zeroes all
 *   15 dwords (`rep stosd` at `0x6FD88120..0x6FD88129`). `wStatCount = 0`.
 * - `D2Common_11166` (`STATLIST_AllocStatListEx`, `0x6FD8AF00`): allocates `0x64` bytes and zeroes all
 *   25 dwords (`rep stosd` at `0x6FD8AF41..0x6FD8AF4A`). Both `BaseStats` and `FullStats` start empty.
 * - `D2Common_10973` (`STATLIST_UnitGetStatValue`, `0x6FD88B70` -> `0x6FD88A80`): validates
 *   `0 <= nStatId < sgptDataTables->nItemStatCostTxtRecordCount` (359 in 1.13c) and returns `0`
 *   when the stat is absent from the array.
 * - `SKILLS_CalculateKickDamage` (`0x6FC9AE10`): reads `STAT_STRENGTH` (0) and `STAT_DEXTERITY` (2)
 *   directly via `D2Common_10973` without any `|| 20` fallback.
 */
import { describe, expect, it } from 'vitest'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { executeSUnitDmg, type CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'

describe('Issue #1446: UnitStatList 1.13c zero-initialization and statId normalization', () => {
  it('initializes all unset base and accrued stats to 0 per STATLIST_AllocStatList (0x6FD88100)', () => {
    const stats = new UnitStatList()
    expect(stats.getAccruedStat('tohit')).toBe(0)
    expect(stats.getBaseStat('tohit')).toBe(0)

    const formerlyFabricatedKeys = [
      'level',
      'strength',
      'dexterity',
      'vitality',
      'energy',
      'maxhp',
      'hitpoints',
      'maxmana',
      'mana',
      'maxstamina',
      'stamina',
      'tohit',
      'armorclass',
    ]
    for (const key of formerlyFabricatedKeys) {
      expect(stats.getBaseStat(key), `baseStat(${key})`).toBe(0)
      expect(stats.getAccruedStat(key), `accruedStat(${key})`).toBe(0)
    }
    expect(stats.getHp256()).toBe(0)
    expect(stats.getMaxHp256()).toBe(0)
    expect(stats.getMana256()).toBe(0)
    expect(stats.getMaxMana256()).toBe(0)
  })

  it('normalizes numeric ItemStatCost IDs (0..358) to canonical stat names even without registry', () => {
    const stats = new UnitStatList()
    // STAT_STRENGTH = 0, STAT_LEVEL = 12, STAT_TOHIT = 19, STAT_ARMORCLASS = 31
    stats.setBaseStat(0, 45)
    stats.setBaseStat(12, 24)
    stats.setBaseStat(19, 380)
    stats.setBaseStat('armorclass', 120)

    expect(stats.getBaseStat('strength')).toBe(45)
    expect(stats.getAccruedStat(0)).toBe(45)
    expect(stats.getBaseStat('level')).toBe(24)
    expect(stats.getAccruedStat(12)).toBe(24)
    expect(stats.getAccruedStat('tohit')).toBe(380)
    expect(stats.getBaseStat(19)).toBe(380)
    expect(stats.getBaseStat(31)).toBe(120)
    expect(stats.getAccruedStat(31)).toBe(120)

    stats.addStat(19, 20)
    expect(stats.getAccruedStat('tohit')).toBe(400)
  })

  it('throws on unknown or out-of-range numeric statId instead of falling back to String(id)', () => {
    const stats = new UnitStatList()
    expect(() => stats.getBaseStat(-1)).toThrow(/statId/)
    expect(() => stats.getBaseStat(359)).toThrow(/statId/)
    expect(() => stats.getAccruedStat(999)).toThrow(/statId/)
    expect(() => stats.setBaseStat(9999, 10)).toThrow(/statId/)
    expect(() => stats.addStat(Number.NaN, 5)).toThrow(/statId/)
  })

  it('does not inject fabricated str=20/dex=20 fallback in SKILLS_CalculateKickDamage (0x6FC9AE10)', () => {
    // With str=0, dex=0, bootDmg=10..20:
    // attrMin = max(1, floor(max(0, 0+0-20)/4)) = 1
    // attrMax = max(2, floor(max(0, 0+0-20)/3)) = 2
    // strBootBonus = floor(0 * 120 / 100) = 0 -> kickMin = 1 + 10 = 11, kickMax = 2 + 20 = 22
    // (Whereas a fabricated str=20, dex=20 fallback would yield attrMin=5, attrMax=6, strBootBonus=24 -> 17..30)
    const attackerStats = new UnitStatList(undefined, {
      level: 10,
      strength: 0,
      dexterity: 0,
      tohit: 1000,
      maxhp: 100 * FIXED_ONE,
      hitpoints: 100 * FIXED_ONE,
    })
    const defenderStats = new UnitStatList(undefined, {
      level: 1,
      armorclass: 0,
      maxhp: 100 * FIXED_ONE,
      hitpoints: 100 * FIXED_ONE,
    })
    const attacker: CombatUnitContext = {
      id: 'attacker',
      name: 'Assassin',
      unitType: 'player',
      statList: attackerStats,
      stateBus: new StateBus(attackerStats),
      bootMinDam: 10,
      bootMaxDam: 10,
    }
    const defender: CombatUnitContext = {
      id: 'defender',
      name: 'Target',
      unitType: 'monster',
      statList: defenderStats,
      stateBus: new StateBus(defenderStats),
    }
    const out = executeSUnitDmg(
      attacker,
      defender,
      {
        skillId: 1, // Kick
        attackKind: 'melee',
        autoHit: true,
        srcDam: 128,
      },
      { rand: () => 0 },
    )
    expect(out.hit).toBe(true)
    expect(out.physDamage256).toBe(11 * FIXED_ONE)
  })
})
