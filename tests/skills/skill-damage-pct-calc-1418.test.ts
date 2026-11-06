import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../src/server/engine/stat-list.ts'
import {
  evaluateSkillCore113c,
  resolveSkillDamagePctCalc,
} from '../../src/server/skills/registry.ts'

/**
 * Issue #1418: the weapon-damage % of a `SrcDam` attack skill comes from the calc column read by
 * its 1.13c srvstfunc/srvdofunc (`samples/d2/D2Game.dll`, skill record `+0x138..+0x144` = calc1..4),
 * not unconditionally from calc1. See `kb/skills/skill-damage-pct-calc-113c.md`.
 */
describe('Issue #1418: physDamagePct calc column per srvstfunc/srvdofunc', () => {
  const registry = getSharedDataRegistry()

  function physPct(skillId: number, slvl: number, baseSkills: Record<number, number> = {}): number {
    const skill = registry.getSkillById(skillId)
    if (!skill) throw new Error(`missing skill ${String(skillId)}`)
    const statList = new UnitStatList()
    statList.setBaseStat('level', 30)
    for (const [id, lvl] of Object.entries(baseSkills)) statList.setBaseSkillLevel(Number(id), lvl)
    return evaluateSkillCore113c({ registry, skill, slvl, blvl: slvl, statList }).physDamagePct
  }

  it('Strafe (26, SrvDo012 0x6FC6DCD0 reads calc2 @ 0x6FC6DE0B): ln12 = 5 + 5*(lvl-1)', () => {
    expect(resolveSkillDamagePctCalc(registry.getSkillById(26)!)).toBe('calc2')
    expect(physPct(26, 1)).toBe(5)
    expect(physPct(26, 20)).toBe(100)
  })

  it('Zeal (106, SrvDo013 0x6FC6DAC0 reads calc2 @ 0x6FC6DBC7): (lvl-4)*par4 + Sacrifice*par8', () => {
    expect(resolveSkillDamagePctCalc(registry.getSkillById(106)!)).toBe('calc2')
    expect(physPct(106, 1)).toBe(0)
    expect(physPct(106, 10)).toBe(36)
    expect(physPct(106, 20)).toBe(96)
    // Sacrifice (96) blvl 5 * par8 (12)
    expect(physPct(106, 10, { 96: 5 })).toBe(96)
  })

  it('Fury (248) / Fend (30) use calc2 = ln34 via SrvDo013', () => {
    expect(resolveSkillDamagePctCalc(registry.getSkillById(248)!)).toBe('calc2')
    expect(physPct(248, 1)).toBe(100)
    expect(physPct(248, 20)).toBe(100 + 19 * 17)
    expect(resolveSkillDamagePctCalc(registry.getSkillById(30)!)).toBe('calc2')
  })

  it('Multiple Shot / Immolation Arrow / Freezing Arrow add no calc damage %', () => {
    // SrvDo008 0x6FC6D420: calc1 = # missiles, calc2 = activation frame.
    expect(resolveSkillDamagePctCalc(registry.getSkillById(12)!)).toBe('none')
    expect(physPct(12, 20)).toBe(0)
    // SrvSt004 arrows without a damage srvdofunc: calc1 is a radius.
    expect(physPct(27, 20)).toBe(0)
    expect(physPct(31, 20)).toBe(0)
  })

  it('Vengeance (111, SrvSt035) and charge-ups (SrvDo034/035) add no calc damage %', () => {
    expect(physPct(111, 10)).toBe(0)
    expect(physPct(259, 10)).toBe(0)
    expect(physPct(254, 10)).toBe(0)
    expect(physPct(280, 10)).toBe(0)
  })

  it('calc1 skills keep calc1 (Jab SrvDo007, Bash/Conversion SrvSt032, Guided Arrow SrvDo010, Hunger SrvDo122)', () => {
    expect(resolveSkillDamagePctCalc(registry.getSkillById(10)!)).toBe('calc1')
    expect(physPct(10, 1)).toBe(-15)
    expect(resolveSkillDamagePctCalc(registry.getSkillById(242)!)).toBe('calc1')
    expect(physPct(242, 1)).toBe(-75)
    for (const id of [14, 19, 22, 73, 96, 107, 116, 126, 133, 139, 140, 143, 144, 147, 151, 152, 232, 242, 260]) {
      expect(resolveSkillDamagePctCalc(registry.getSkillById(id)!), `skill ${String(id)}`).toBe('calc1')
    }
  })

  it('every player SrcDam skill with a non-empty calc1/calc2 has a reverse-engineered mapping', () => {
    const unmapped: number[] = []
    for (let id = 0; id < 400; id++) {
      const s = registry.getSkillById(id)
      if (!s || !s.charClass || s.srcDam <= 0) continue
      if (!s.calc1 && !s.calc2) continue
      if (resolveSkillDamagePctCalc(s) === 'unknown') unmapped.push(id)
    }
    expect(unmapped).toEqual([])
  })
})
