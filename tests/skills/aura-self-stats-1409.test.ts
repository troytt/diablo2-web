/**
 * Issue #1409 — 1.13c aura caster-vs-target stat routing (class sweep over every `aura=1`
 * row with an offensive server aura function in `samples/d2/excel/Skills.txt`).
 *
 * Ground truth (`samples/d2/D2Game.dll`, image base 0x6FC20000):
 * - `SKILLS_SrvDo065` 0x6FCBA8D0 (friendly stat auras): `aurastat1..6` (+0x54/+0x68) are applied
 *   to the caster under `aurastate` (call 0x6FCBA1A0) and to scanned allies under `auratargetstate`.
 * - `SKILLS_SrvDo066` 0x6FCBAF50 (Holy Fire 102, Holy Shock 118, Sanctuary 119, Conviction 123) and
 *   `SKILLS_SrvDo081` 0x6FCBABC0 (Holy Freeze 114): the caster's `aurastate` gets only
 *   `passivestat1..5` (+0x98/+0xA4, loop `cmp edi,5`); `aurastat1..6` feed the radial scan
 *   0x6FCC0C70 and only land on hit targets under `auratargetstate`.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { AuraScanner } from '../../src/server/engine/aura-scanner.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import type { CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'
import { evaluateCalc } from '../../src/common/data/calc-ast.ts'
import {
  calculateHolyFireStats,
  calculateHolyFreezeStats,
  calculateHolyShockStats,
} from '../../src/common/skills/paladin-auras.ts'
import type { D2DataRegistry, SkillRecord } from '../../src/common/data/data-registry.ts'

function makeUnit(
  registry: D2DataRegistry,
  id: string,
  unitType: 'player' | 'monster',
  extra: Partial<CombatUnitContext> = {},
): CombatUnitContext {
  const statList = new UnitStatList(registry, { maxhp: 5000 * FIXED_ONE, hitpoints: 5000 * FIXED_ONE })
  return { id, name: id, statList, stateBus: new StateBus(statList, registry), unitType, ...extra }
}

function evalPairs(
  registry: D2DataRegistry,
  skill: SkillRecord,
  slvl: number,
  pairs: [string, string][],
): Record<string, number> {
  const ctx = {
    registry,
    activeSkill: skill,
    slvl,
    blvl: 0,
    getBaseSkillLevel: () => 0,
    getEffectiveSkillLevel: () => 0,
  }
  const out: Record<string, number> = {}
  for (const [stat, calc] of pairs) {
    if (stat && calc) out[stat.toLowerCase()] = evaluateCalc(calc, ctx)
  }
  return out
}

// Skills.txt aura=1 rows with srvdofunc 66 (102/118/119/123), 81 (114), 82 (124).
const OFFENSIVE_AURAS = [102, 114, 118, 119, 123, 124]

describe('Issue #1409: offensive aura caster gets passivestat, not aurastat', () => {
  it('sweep: every srvdofunc 66/81/82 aura puts only passivestat1..5 on the caster', async () => {
    const registry = await getSharedDataRegistry()
    for (const id of OFFENSIVE_AURAS) {
      const skill = registry.getSkillById(id)!
      expect([66, 81, 82]).toContain(skill.srvDoFunc)
      const scanner = new AuraScanner(registry)
      const caster = makeUnit(registry, `pal-${String(id)}`, 'player', { x: 0, y: 0 })
      const src = scanner.setActiveAura(caster, id, 10)!
      scanner.pulseAura(src, 0, [caster], [], [], { rollChanceFn: () => false })
      const expected = evalPairs(registry, skill, 10, [
        [skill.passiveStat1, skill.passiveCalc1],
        [skill.passiveStat2, skill.passiveCalc2],
        [skill.passiveStat3, skill.passiveCalc3],
        [skill.passiveStat4, skill.passiveCalc4],
        [skill.passiveStat5, skill.passiveCalc5],
      ])
      const state = caster.stateBus.getState(skill.auraState)
      expect(state, skill.name).toBeDefined()
      expect(state?.stats ?? {}, skill.name).toEqual(expected)
      // No aurastat leaks onto the caster (Holy Freeze slow, Conviction -res/-def, Sanctuary undead stats).
      for (const stat of [
        skill.auraStat1,
        skill.auraStat2,
        skill.auraStat3,
        skill.auraStat4,
        skill.auraStat5,
        skill.auraStat6,
      ]) {
        if (stat && !(stat.toLowerCase() in expected)) {
          expect(caster.statList.getModifierBonus(stat.toLowerCase()), `${skill.name}.${stat}`).toBe(0)
        }
      }
    }
  })

  it('Holy Fire / Holy Freeze / Holy Shock caster passive elemental damage = enms|exms*par5/256', async () => {
    const registry = await getSharedDataRegistry()
    const cases: Array<[number, string, string, number, number]> = [
      [102, 'firemindam', 'firemaxdam', calculateHolyFireStats(10).weaponFireMin, calculateHolyFireStats(10).weaponFireMax],
      [114, 'coldmindam', 'coldmaxdam', calculateHolyFreezeStats(10).weaponColdMin, calculateHolyFreezeStats(10).weaponColdMax],
      // Holy Shock passivecalc1 = 1 (lightmindam is a flat 1).
      [118, 'lightmindam', 'lightmaxdam', 1, calculateHolyShockStats(10).weaponLightningMax],
    ]
    for (const [id, minStat, maxStat, min, max] of cases) {
      const scanner = new AuraScanner(registry)
      const caster = makeUnit(registry, `pal-${String(id)}`, 'player')
      scanner.pulseAura(scanner.setActiveAura(caster, id, 10)!, 0, [caster], [], [], { isTown: true })
      expect(caster.statList.getModifierBonus(minStat), `${String(id)} ${minStat}`).toBe(min)
      expect(caster.statList.getModifierBonus(maxStat), `${String(id)} ${maxStat}`).toBe(max)
    }
  })

  it('Holy Freeze: caster velocity unchanged; enemy gets aurastat1..3 = -dm34(25,60) and no item_slow', async () => {
    const registry = await getSharedDataRegistry()
    const scanner = new AuraScanner(registry)
    const caster = makeUnit(registry, 'pal', 'player', { x: 0, y: 0 })
    // #1410: Holy Freeze slvl 1 radius = ln12 = 6 sub-tiles.
    const enemy = makeUnit(registry, 'zombie', 'monster', { x: 5, y: 0, coldEffect: -50 })
    scanner.pulseAura(scanner.setActiveAura(caster, 114, 1)!, 0, [caster], [enemy], [], { rollChanceFn: () => false })
    expect(caster.statList.getModifierBonus('velocitypercent')).toBe(0)
    expect(caster.statList.getModifierBonus('attackrate')).toBe(0)
    expect(caster.statList.getModifierBonus('other_animrate')).toBe(0)
    // dm34 at slvl 1 with Skills.txt row 114 Param3/Param4 = 25/60 -> 30
    expect(enemy.stateBus.getState('holywindcold')?.stats).toEqual({
      velocitypercent: -30,
      attackrate: -30,
      other_animrate: -30,
    })
    expect(enemy.statList.getModifierBonus('item_slow')).toBe(0)
  })

  it('friendly srvdofunc 65 auras still apply aurastat to the caster', async () => {
    const registry = await getSharedDataRegistry()
    const scanner = new AuraScanner(registry)
    const caster = makeUnit(registry, 'pal', 'player')
    scanner.pulseAura(scanner.setActiveAura(caster, 98, 1)!, 0, [caster], [], [], { isTown: true })
    const might = registry.getSkillById(98)!
    const expected = evalPairs(registry, might, 1, [[might.auraStat1, might.auraStatCalc1]])
    expect(caster.stateBus.getState('might')?.stats['damagepercent']).toBe(expected['damagepercent'])
    expect(expected['damagepercent']).toBeGreaterThan(0)
  })
})
