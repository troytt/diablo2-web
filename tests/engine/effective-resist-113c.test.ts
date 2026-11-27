/**
 * 1.13c effective-resistance resolver parity (issue #1412).
 *
 * Ground truth: `samples/d2/D2Game.dll` 0x6FCFB3C0 (descriptor table 0x6FD22AB0, context
 * flag `[ctx+0x14]` set at 0x6FCFC10A..0x6FCFC121 only for non-hireling monsters) and
 * `DifficultyLevels.txt` `ResistPenalty` (Patch_D2.mpq: 0 / -40 / -100).
 * See `kb/combat/d2game-effective-resist-113c.md`.
 */
import { describe, expect, it } from 'vitest'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import {
  computeEffectiveResistance,
  defenderResistParams113c,
  executeSUnitDmg,
  playerResistCap113c,
  usesPlayerResistBranch113c,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { difficultyResistPenalty } from '../../src/server/engine/difficulty-resist-penalty.ts'

type UnitType = NonNullable<CombatUnitContext['unitType']>

function unit(
  unitType: UnitType,
  stats: Record<string, number>,
  resistPenalty?: number,
): CombatUnitContext {
  const statList = new UnitStatList()
  statList.setBaseStat('level', 50)
  statList.setBaseStat('maxhp', 1000 * FIXED_ONE)
  statList.setHp256(1000 * FIXED_ONE)
  for (const [k, v] of Object.entries(stats)) statList.setBaseStat(k, v)
  return {
    id: `${unitType}_1`,
    name: unitType,
    unitType,
    statList,
    stateBus: new StateBus(statList),
    x: 10,
    y: 10,
    ...(resistPenalty !== undefined ? { resistPenalty } : {}),
  }
}

function fireHit(defender: CombatUnitContext, attackerStats: Record<string, number> = {}): number {
  const attacker = unit('monster', attackerStats)
  const out = executeSUnitDmg(attacker, defender, {
    skillId: 0,
    attackKind: 'spell',
    autoHit: true,
    srcDam: 0,
    elemType: 'fire',
    elemMin256: 100 * FIXED_ONE,
    elemMax256: 100 * FIXED_ONE,
  }, { rand: () => 50 })
  return Math.round(out.elemDamage256 / FIXED_ONE)
}

describe('DifficultyLevels.txt ResistPenalty (server loader)', () => {
  it('reads Normal 0 / Nightmare -40 / Hell -100 from the baked table', () => {
    expect(difficultyResistPenalty(0)).toBe(0)
    expect(difficultyResistPenalty(1)).toBe(-40)
    expect(difficultyResistPenalty(2)).toBe(-100)
    expect(() => difficultyResistPenalty(3)).toThrow()
  })
})

describe('D2Game 0x6FCFB3C0 branch selection', () => {
  it('players and hirelings take the player branch; monsters and minions do not', () => {
    expect(usesPlayerResistBranch113c({ unitType: 'player' })).toBe(true)
    expect(usesPlayerResistBranch113c({ unitType: 'mercenary' })).toBe(true)
    expect(usesPlayerResistBranch113c({ unitType: 'monster' })).toBe(false)
    expect(usesPlayerResistBranch113c({ unitType: 'minion' })).toBe(false)
  })

  it('isDefenderPlayer=true without a cap throws instead of silently defaulting', () => {
    expect(() => computeEffectiveResistance({ baseRes: 50, isDefenderPlayer: true })).toThrow()
  })
})

describe('player caps (0x6FCFB44A..0x6FCFB4B3)', () => {
  it('damageresist caps at 50; magicresist at 75 + maxmagicresist; elements at min(95, 75 + max)', () => {
    const p = unit('player', { maxfireresist: 10, maxcoldresist: 30, maxmagicresist: 5 })
    expect(playerResistCap113c(p.statList, 'phys')).toBe(50)
    expect(playerResistCap113c(p.statList, 'mag')).toBe(80)
    expect(playerResistCap113c(p.statList, 'fire')).toBe(85)
    expect(playerResistCap113c(p.statList, 'cold')).toBe(95)
    expect(playerResistCap113c(p.statList, 'ltng')).toBe(75)
  })

  it('player damageresist 80 -> 50%; magicresist 90 -> 75%', () => {
    const p = unit('player', {})
    expect(computeEffectiveResistance({ baseRes: 80, ...defenderResistParams113c(p, 'phys') }).effectiveRes).toBe(50)
    expect(computeEffectiveResistance({ baseRes: 90, ...defenderResistParams113c(p, 'mag') }).effectiveRes).toBe(75)
  })

  it('player damageresist >= 100 is never physical immunity', () => {
    const p = unit('player', {})
    const r = computeEffectiveResistance({ baseRes: 120, ...defenderResistParams113c(p, 'phys') })
    expect(r.isImmune).toBe(false)
    expect(r.effectiveRes).toBe(50)
  })
})

describe('difficulty penalty (0x6FCFB405..0x6FCFB420)', () => {
  it('fire 75 on Normal -> 75; on Hell -> 75 - 100 = -25', () => {
    const normal = unit('player', {}, difficultyResistPenalty(0))
    const hell = unit('player', {}, difficultyResistPenalty(2))
    expect(computeEffectiveResistance({ baseRes: 75, ...defenderResistParams113c(normal, 'fire') }).effectiveRes).toBe(75)
    expect(computeEffectiveResistance({ baseRes: 75, ...defenderResistParams113c(hell, 'fire') }).effectiveRes).toBe(-25)
  })

  it('penalty is applied before the cap: fire 175 on Hell -> 75', () => {
    const hell = unit('player', {}, difficultyResistPenalty(2))
    expect(computeEffectiveResistance({ baseRes: 175, ...defenderResistParams113c(hell, 'fire') }).effectiveRes).toBe(75)
  })

  it('damageresist / magicresist never take the penalty', () => {
    const hell = unit('player', {}, difficultyResistPenalty(2))
    expect(computeEffectiveResistance({ baseRes: 30, ...defenderResistParams113c(hell, 'phys') }).effectiveRes).toBe(30)
    expect(computeEffectiveResistance({ baseRes: 30, ...defenderResistParams113c(hell, 'mag') }).effectiveRes).toBe(30)
  })

  it('hirelings take the penalty; monsters and minions do not', () => {
    const merc = unit('mercenary', {}, difficultyResistPenalty(1))
    const mon = unit('monster', {}, difficultyResistPenalty(1))
    const minion = unit('minion', {}, difficultyResistPenalty(1))
    expect(computeEffectiveResistance({ baseRes: 60, ...defenderResistParams113c(merc, 'cold') }).effectiveRes).toBe(20)
    expect(computeEffectiveResistance({ baseRes: 60, ...defenderResistParams113c(mon, 'cold') }).effectiveRes).toBe(60)
    expect(computeEffectiveResistance({ baseRes: 60, ...defenderResistParams113c(minion, 'cold') }).effectiveRes).toBe(60)
  })

  it('lower bound is -100', () => {
    const hell = unit('player', {}, difficultyResistPenalty(2))
    expect(computeEffectiveResistance({ baseRes: -30, ...defenderResistParams113c(hell, 'ltng') }).effectiveRes).toBe(-100)
  })
})

describe('-enemy resist (passive_*_pierce, Properties.txt pierce-* -> stat 333..336)', () => {
  it('player fire 40 vs attacker -20% -> 20 (Normal)', () => {
    const p = unit('player', {}, 0)
    expect(
      computeEffectiveResistance({ baseRes: 40, passiveEnemyPierce: 20, ...defenderResistParams113c(p, 'fire') }).effectiveRes,
    ).toBe(20)
  })

  it('monster res >= 100 skips -enemy res (0x6FCFB3E0..0x6FCFB3EA); monsters keep res above 75', () => {
    const mon = unit('monster', {})
    expect(computeEffectiveResistance({ baseRes: 110, passiveEnemyPierce: 50, ...defenderResistParams113c(mon, 'fire') }).isImmune).toBe(true)
    expect(computeEffectiveResistance({ baseRes: 80, ...defenderResistParams113c(mon, 'fire') }).effectiveRes).toBe(80)
  })
})

describe('executeSUnitDmg end-to-end (100 fire spell damage)', () => {
  it('player with fire 75: Normal takes 25, Hell takes 125', () => {
    expect(fireHit(unit('player', { fireresist: 75 }, difficultyResistPenalty(0)))).toBe(25)
    expect(fireHit(unit('player', { fireresist: 75 }, difficultyResistPenalty(2)))).toBe(125)
  })

  it('+max fire resist raises the cap: fire 90 with maxfireresist 10 -> 85% -> 15 damage', () => {
    expect(fireHit(unit('player', { fireresist: 90, maxfireresist: 10 }, 0))).toBe(15)
    expect(fireHit(unit('player', { fireresist: 90 }, 0))).toBe(25)
  })

  it('attacker passive_fire_pierce 20 vs player fire 40 -> 20% -> 80 damage', () => {
    expect(fireHit(unit('player', { fireresist: 40 }, 0), { passive_fire_pierce: 20 })).toBe(80)
  })
})
