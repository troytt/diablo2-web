import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NODE_MPQ_DIR, getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import {
  applyResist113c,
  computeBlockRate113c,
  computeToHitChance,
  executeSUnitDmg,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { chiSquareHomogeneity, chiSquareSurvival, ksTwoSample } from '../../tools/oracle/lib/stat-tests.ts'

const HAVE_DATA = existsSync(DEFAULT_NODE_MPQ_DIR)

function sample(seed: number, n: number, f: (r: D2Rng) => number): number[] {
  const r = new D2Rng(seed)
  return Array.from({ length: n }, () => f(r))
}

describe('oracle statistical fallback (P5.5)', () => {
  it('chi-square survival matches known quantiles', () => {
    expect(chiSquareSurvival(3.841, 1)).toBeCloseTo(0.05, 3)
    expect(chiSquareSurvival(11.07, 5)).toBeCloseTo(0.05, 3)
    expect(chiSquareSurvival(0, 3)).toBe(1)
  })

  it('KS accepts two samples from the same roll distribution and rejects a shifted one', () => {
    const roll = (r: D2Rng): number => 3 + r.rand(8) // min + rand(max - min + 1)
    const a = sample(1, 20000, roll)
    const b = sample(2, 20000, roll)
    expect(ksTwoSample(a, b).pValue).toBeGreaterThan(0.01)
    const shifted = sample(3, 20000, (r) => 4 + r.rand(8))
    expect(ksTwoSample(a, shifted).pValue).toBeLessThan(1e-6)
  })

  it('chi-square detects a different crit rate (10% vs 12%) at 1e5 samples', () => {
    const tally = (seed: number, pct: number): Map<string, number> => {
      const m = new Map<string, number>()
      for (const v of sample(seed, 100000, (r) => (r.rand(100) < pct ? 1 : 0))) {
        m.set(String(v), (m.get(String(v)) ?? 0) + 1)
      }
      return m
    }
    expect(chiSquareHomogeneity(tally(5, 10), tally(6, 10)).pValue).toBeGreaterThan(0.01)
    expect(chiSquareHomogeneity(tally(5, 10), tally(7, 12)).pValue).toBeLessThan(1e-6)
  })

  it.skipIf(!HAVE_DATA)(
    'SUnitDmg melee physical damage distribution matches 1.13c reference stream at N = 100,000 (KS p >= 0.001)',
    () => {
      const N = 100_000
      const reg = getSharedDataRegistry()

      const atkStats = new UnitStatList(reg, undefined, { ownerType: 'player', charClass: 'bar' })
      atkStats.setBaseStat('level', 6)
      atkStats.setBaseStat('strength', 30)
      atkStats.setBaseStat('dexterity', 20)
      atkStats.setBaseStat('tohit', 45)
      atkStats.setBaseStat('item_deadlystrike', 15)
      atkStats.setBaseStat('passive_critical_strike', 10)
      atkStats.setBaseStat('maxhp', 500 * FIXED_ONE)
      atkStats.setHp256(500 * FIXED_ONE)

      const defStats = new UnitStatList(reg, undefined, { ownerType: 'monster' })
      defStats.setBaseStat('level', 4)
      defStats.setBaseStat('armorclass', 18)
      defStats.setBaseStat('damageresist', 20)
      defStats.setBaseStat('maxhp', 0x3fffff00)
      defStats.setHp256(0x3fffff00)

      const attacker: CombatUnitContext = {
        id: 'player-1',
        name: 'Barbarian',
        charClass: 'bar',
        unitType: 'player',
        statList: atkStats,
        stateBus: new StateBus(atkStats),
        weaponCode: 'hax',
        weaponItemType: 'axe',
        weaponMinPhys: 3,
        weaponMaxPhys: 6,
        weaponStrBonus: 100,
      }
      const defender: CombatUnitContext = {
        id: 'mon-9',
        name: 'Zombie',
        unitType: 'monster',
        statList: defStats,
        stateBus: new StateBus(defStats),
      }

      const replicaRng = new D2Rng(0x113c_0001)
      const replicaSamples = new Array<number>(N)
      for (let i = 0; i < N; i++) {
        defender.statList.setHp256(0x3fffff00)
        const out = executeSUnitDmg(
          attacker,
          defender,
          { skillId: 0, attackKind: 'melee', srcDam: 128, noHitRecovery: true },
          replicaRng,
        )
        replicaSamples[i] = out.physDamage256
      }

      // Direct 1.13c D2Game.dll SUnitDmg reference model (0x6FCFE011 -> 0x6FCFD5C2 -> 0x6FCFD51A -> 0x6FCFB3C0)
      // evaluated on an independent seed so KS tests true distribution equivalence rather than trivial identity.
      const toHitChance = computeToHitChance({
        attackerAr: atkStats.getRawToHit113c(),
        defenderDef: 18,
        attackerLvl: 6,
        defenderLvl: 4,
        attackKind: 'melee',
      })
      const oracleRng = new D2Rng(0x113c_9999)
      const oracleSamples = new Array<number>(N)
      for (let i = 0; i < N; i++) {
        if (oracleRng.rand(100) >= toHitChance) {
          oracleSamples[i] = 0
          continue
        }
        const weapRoll256 = (3 + oracleRng.rand(4)) * FIXED_ONE
        let rawPhys256 = Math.trunc((weapRoll256 * (100 + 30)) / 100)
        const crit = oracleRng.rand(100) < 10 || oracleRng.rand(100) < 15
        if (crit) rawPhys256 *= 2
        oracleSamples[i] = applyResist113c(rawPhys256, 20)
      }

      const ks = ksTwoSample(oracleSamples, replicaSamples)
      expect(ks.n).toBe(N)
      expect(ks.m).toBe(N)
      expect(ks.pValue).toBeGreaterThanOrEqual(0.001)
    },
    60_000,
  )

  it.skipIf(!HAVE_DATA)(
    'SUnitDmg melee categorical outcomes (miss / block / normal / crit) match 1.13c reference at N = 100,000 (chi-square p >= 0.001)',
    () => {
      const N = 100_000
      const reg = getSharedDataRegistry()

      const atkStats = new UnitStatList(reg, undefined, { ownerType: 'player', charClass: 'bar' })
      atkStats.setBaseStat('level', 12)
      atkStats.setBaseStat('strength', 50)
      atkStats.setBaseStat('dexterity', 30)
      atkStats.setBaseStat('tohit', 80)
      atkStats.setBaseStat('item_deadlystrike', 20)
      atkStats.setBaseStat('maxhp', 500 * FIXED_ONE)
      atkStats.setHp256(500 * FIXED_ONE)

      const defStats = new UnitStatList(reg, undefined, { ownerType: 'player', charClass: 'pal' })
      defStats.setBaseStat('level', 12)
      defStats.setBaseStat('dexterity', 35)
      defStats.setBaseStat('armorclass', 40)
      defStats.setBaseStat('toblock', 30)
      defStats.setBaseStat('maxhp', 0x3fffff00)
      defStats.setHp256(0x3fffff00)

      const attacker: CombatUnitContext = {
        id: 'player-1',
        name: 'Barbarian',
        charClass: 'bar',
        unitType: 'player',
        statList: atkStats,
        stateBus: new StateBus(atkStats),
        weaponCode: 'hax',
        weaponItemType: 'axe',
        weaponMinPhys: 10,
        weaponMaxPhys: 10,
        weaponStrBonus: 100,
      }
      const defender: CombatUnitContext = {
        id: 'player-2',
        name: 'Paladin',
        charClass: 'pal',
        unitType: 'player',
        hasShield: true,
        statList: defStats,
        stateBus: new StateBus(defStats),
      }

      // PvP melee scaling in 1.13c D2Game.dll (0x6FCFC46A): MulDiv(phys256, 17, 100)
      const prePvpNormal256 = Math.trunc((10 * FIXED_ONE * 150) / 100)
      const normalHitPhys256 = Math.trunc((prePvpNormal256 * 17) / 100)
      const replicaCounts = new Map<string, number>([
        ['miss', 0],
        ['block', 0],
        ['normal', 0],
        ['crit', 0],
      ])
      const replicaRng = new D2Rng(0x224d_0001)
      for (let i = 0; i < N; i++) {
        defender.statList.setHp256(0x3fffff00)
        const out = executeSUnitDmg(
          attacker,
          defender,
          { skillId: 0, attackKind: 'melee', srcDam: 128, isExpansion: true, noHitRecovery: true },
          replicaRng,
        )
        const bucket = !out.hit
          ? out.avoidedReason === 'block'
            ? 'block'
            : 'miss'
          : out.physDamage256 > normalHitPhys256
            ? 'crit'
            : 'normal'
        replicaCounts.set(bucket, (replicaCounts.get(bucket) ?? 0) + 1)
      }

      const toHitChance = computeToHitChance({
        attackerAr: atkStats.getRawToHit113c(),
        defenderDef: defStats.getDefense(),
        attackerLvl: 12,
        defenderLvl: 12,
        attackKind: 'melee',
      })
      const effBlock = computeBlockRate113c(defender, true)
      const oracleCounts = new Map<string, number>([
        ['miss', 0],
        ['block', 0],
        ['normal', 0],
        ['crit', 0],
      ])
      const oracleRng = new D2Rng(0x224d_8888)
      for (let i = 0; i < N; i++) {
        if (oracleRng.rand(100) >= toHitChance) {
          oracleCounts.set('miss', (oracleCounts.get('miss') ?? 0) + 1)
        } else if (oracleRng.rand(100) < effBlock) {
          oracleCounts.set('block', (oracleCounts.get('block') ?? 0) + 1)
        } else if (oracleRng.rand(100) < 20) {
          oracleCounts.set('crit', (oracleCounts.get('crit') ?? 0) + 1)
        } else {
          oracleCounts.set('normal', (oracleCounts.get('normal') ?? 0) + 1)
        }
      }

      const chi = chiSquareHomogeneity(oracleCounts, replicaCounts)
      expect(chi.dof).toBe(3)
      expect(chi.pValue).toBeGreaterThanOrEqual(0.001)
    },
    60_000,
  )
})
