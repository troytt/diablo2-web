/**
 * Diablo II: Lord of Destruction v1.13c — Aura `perdelay` Clamp & Frame-Aligned State Duration (#1443)
 *
 * Ground Truth References (`samples/d2/D2Game.dll`, image base `0x6FC20000`, `samples/d2/excel/Skills.txt`):
 * 1. `SKILLS_SrvDo065` (`0x6FCBA8D0`, at `0x6FCBA955..0x6FCBA988`):
 *    - Evaluates `SkillsTxt.dwPerDelay` (`[esi+0x128]`) via `SKILLS_EvaluateSkillFormula` (`0x6FCBB190`).
 *    - Clamps pulse period `d = max(5, perdelay)` (`cmp ecx, 0x5; jg ...; mov ecx, 0x5`).
 *    - Reads global game frame `F = pGame->dwGameFrame` (`[eax+0xA8]`).
 *    - Computes state duration: `d * trunc((F + d - 1) / d) - F + 2` (`d * ceil(F / d) - F + 2` for `F >= 1`).
 * 2. `SKILLS_GetNextPerDelayFrame` (`0x6FCBE970`) & `SKILLS_SrvDo066` (`0x6FCBAF50`) /
 *    `SKILLS_SrvDo081` (`0x6FCBABC0`) / `SKILLS_SrvDo082` (`0x6FCBA400`):
 *    - `0x6FCBE970` evaluates `perdelay` (`+0x128`), clamps `d = max(5, perdelay)`, and returns
 *      `nextFrame = d * trunc((F + d - 1) / d) + 1`.
 *    - `SrvDo066` (`0x6FCBAFF8..0x6FCBB008`), `SrvDo081` (`0x6FCBAC5D..0x6FCBAC6B`), and
 *      `SrvDo082` (`0x6FCBA46C..0x6FCBA47E`) compute `duration = nextFrame + 1 - F`, yielding the
 *      exact same formula `d * trunc((F + d - 1) / d) - F + 2`.
 * 3. `Skills.txt` `perdelay` values:
 *    - Paladin auras (`#98..#125`, 20 skills): `perdelay = 50`.
 *    - `#277 Blade Shield` (`SrvDo054` `0x6FCB34A0`): `perdelay = par3` (`Param3 = 25`), evaluated dynamically.
 *    - `#296 Barbs Aura`, `#297 Wolverine Aura`, `#298 Oak Sage Aura`: `perdelay = ""` -> clamped to `5`.
 *    - `#57 Thunder Storm`: `perdelay = "(100 - dm34)"` (`Param3 = 25, Param4 = 100`).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import {
  AuraScanner,
  computeAuraPerDelayFrames,
  computeAuraStateDurationFrames,
} from '../../src/server/engine/aura-scanner.ts'
import { UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import type { CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'

function makeUnit(
  id: string,
  unitType: 'player' | 'monster' = 'player',
  x = 100,
  y = 100,
): CombatUnitContext {
  const registry = getSharedDataRegistry()
  const statList = new UnitStatList(registry, {
    level: 20,
    maxhp: 1000 << 8,
    hitpoints: 1000 << 8,
  })
  const stateBus = new StateBus(statList, registry)
  return {
    id,
    name: id,
    unitType,
    x,
    y,
    statList,
    stateBus,
  }
}

describe('Issue #1443 — 1.13c Aura perdelay Clamp (>= 5) & Frame-Aligned State Duration', () => {
  const registry = getSharedDataRegistry()

  it('computes exact 1.13c frame-aligned durations: F=103, d=50 -> 49 and F=100, d=50 -> 2', () => {
    // 0x6FCBA979: lea eax,[edi+ecx-1]; cdq; idiv ecx; imul eax,ecx; sub eax,edi; add eax,0x2
    expect(computeAuraStateDurationFrames(103, 50)).toBe(49)
    expect(computeAuraStateDurationFrames(100, 50)).toBe(2)
    expect(computeAuraStateDurationFrames(101, 50)).toBe(51)
    expect(computeAuraStateDurationFrames(50, 50)).toBe(2)
    expect(computeAuraStateDurationFrames(1, 50)).toBe(51)

    const scanner = new AuraScanner(registry, 0x1443)
    const caster = makeUnit('paladin')
    const ally = makeUnit('ally', 'player', 102, 100)
    const aura = scanner.setActiveAura(caster, 98, 5, 10)!
    expect(aura.pulseIntervalTicks).toBe(50)

    // Pulse at F=103 -> durationFrames = 49, expireFrame = 152
    scanner.pulseAura(aura, 103, [caster, ally], [])
    const casterState103 = caster.stateBus.getActiveEntries().find((e) => e.stateName === 'might')
    const allyState103 = ally.stateBus.getActiveEntries().find((e) => e.stateName === 'might')
    expect(casterState103?.durationFrames).toBe(49)
    expect(casterState103?.expireFrame).toBe(152)
    expect(allyState103?.durationFrames).toBe(49)
    expect(allyState103?.expireFrame).toBe(152)

    // Pulse at F=100 -> durationFrames = 2, expireFrame = 102
    scanner.pulseAura(aura, 100, [caster, ally], [])
    const casterState100 = caster.stateBus.getActiveEntries().find((e) => e.stateName === 'might')
    const allyState100 = ally.stateBus.getActiveEntries().find((e) => e.stateName === 'might')
    expect(casterState100?.durationFrames).toBe(2)
    expect(casterState100?.expireFrame).toBe(102)
    expect(allyState100?.durationFrames).toBe(2)
    expect(allyState100?.expireFrame).toBe(102)
  })

  it('clamps empty perdelay on Druid spirit totem auras (#296 Barbs, #297 Wolverine, #298 Oak Sage) to 5 frames', () => {
    const scanner = new AuraScanner(registry, 0x1443)
    const totem = makeUnit('spirit-totem', 'monster', 100, 100)
    const owner = makeUnit('druid-owner', 'player', 102, 100)

    for (const skillId of [296, 297, 298]) {
      const skillRec = registry.getSkillById(skillId)!
      expect(skillRec.perDelay).toBe('')

      const aura = scanner.setActiveAura(totem, skillId, 5, 0)!
      expect(aura.pulseIntervalTicks).toBe(5)

      // At F=7, d=5: 5 * ceil(7/5) - 7 + 2 = 10 - 7 + 2 = 5 (expireFrame = 12)
      scanner.pulseAura(aura, 7, [totem, owner], [])
      const ownerEntry7 = owner.stateBus.getActiveEntries().find((e) => e.sourceSkillId === skillId)
      expect(ownerEntry7?.durationFrames).toBe(5)
      expect(ownerEntry7?.expireFrame).toBe(12)

      // At F=10, d=5: 5 * ceil(10/5) - 10 + 2 = 10 - 10 + 2 = 2 (expireFrame = 12)
      scanner.pulseAura(aura, 10, [totem, owner], [])
      const ownerEntry10 = owner.stateBus.getActiveEntries().find((e) => e.sourceSkillId === skillId)
      expect(ownerEntry10?.durationFrames).toBe(2)
      expect(ownerEntry10?.expireFrame).toBe(12)
    }
  })

  it('evaluates #277 Blade Shield perdelay via formula (par3 = 25) instead of hardcoding and clamps perdelay >= 5', () => {
    const skill277 = registry.getSkillById(277)!
    expect(skill277.perDelay).toBe('par3')
    expect(skill277.param3).toBe(25)

    const scanner = new AuraScanner(registry, 0x1443)
    const assassin = makeUnit('assassin')
    const aura277 = scanner.setActiveAura(assassin, 277, 1, 0)!
    expect(aura277.pulseIntervalTicks).toBe(25)

    // Verify dynamic evaluation of par3 and lower-bound clamp at 5 (not 10)
    const baseCtx = {
      registry,
      activeSkill: skill277,
      slvl: 1,
      blvl: 1,
      getBaseSkillLevel: () => 1,
      getEffectiveSkillLevel: () => 1,
    }
    expect(computeAuraPerDelayFrames('par3', { ...baseCtx, activeSkill: { ...skill277, param3: 15 } })).toBe(15)
    expect(computeAuraPerDelayFrames('par3', { ...baseCtx, activeSkill: { ...skill277, param3: 7 } })).toBe(7)
    expect(computeAuraPerDelayFrames('par3', { ...baseCtx, activeSkill: { ...skill277, param3: 3 } })).toBe(5)
    expect(computeAuraPerDelayFrames('', baseCtx)).toBe(5)
  })

  it('sweeps SrvDo065 / SrvDo066 / SrvDo081 / SrvDo082 / SrvDo054 and #57 Thunder Storm perdelay & duration parity', () => {
    const scanner = new AuraScanner(registry, 0x1443)
    const caster = makeUnit('paladin', 'player', 100, 100)
    const ally = makeUnit('ally', 'player', 102, 100)
    const enemy = makeUnit('undead-enemy', 'monster', 103, 100)
    ;(enemy as { isUndead?: boolean }).isUndead = true

    // All 20 Paladin auras (SrvDo065 friendly, SrvDo066 Holy Fire/Shock/Sanctuary/Conviction,
    // SrvDo081 Holy Freeze, SrvDo082 Redemption)
    const paladinAuraIds = [
      98, 99, 100, 102, 103, 104, 105, 108, 109, 110,
      113, 114, 115, 118, 119, 120, 122, 123, 124, 125,
    ]
    for (const id of paladinAuraIds) {
      caster.statList.setBaseSkillLevel(id, 5)
      enemy.statList.setHp256(1000 << 8)
      const aura = scanner.setActiveAura(caster, id, 5, 17)!
      expect(aura.pulseIntervalTicks).toBe(50)

      scanner.pulseAura(aura, 103, [caster, ally], [enemy])
      const selfEntry103 = caster.stateBus.getActiveEntries().find((e) => e.sourceSkillId === id)
      expect(selfEntry103?.durationFrames).toBe(49)
      expect(selfEntry103?.expireFrame).toBe(152)

      if (id === 114 || id === 123) {
        const enemyEntry103 = enemy.stateBus.getActiveEntries().find((e) => e.sourceSkillId === id)
        expect(enemyEntry103?.durationFrames).toBe(49)
        expect(enemyEntry103?.expireFrame).toBe(152)
      }

      scanner.pulseAura(aura, 100, [caster, ally], [enemy])
      const selfEntry100 = caster.stateBus.getActiveEntries().find((e) => e.sourceSkillId === id)
      expect(selfEntry100?.durationFrames).toBe(2)
      expect(selfEntry100?.expireFrame).toBe(102)
    }

    // #57 Thunder Storm: perdelay = '(100 - dm34)' with Param3=25, Param4=100
    const tsAura1 = scanner.setActiveAura(caster, 57, 1, 0)!
    expect(tsAura1.pulseIntervalTicks).toBe(110)
    const tsAura20 = scanner.setActiveAura(caster, 57, 20, 0)!
    expect(tsAura20.pulseIntervalTicks).toBe(41)
  })

  it('aligns AuraScanner.tick pulses to global frame multiples rather than startTick', () => {
    const scanner = new AuraScanner(registry, 0x1443)
    const caster = makeUnit('paladin', 'player', 100, 100)
    const ally = makeUnit('ally', 'player', 102, 100)

    // Activated at startTick = 13 (non-zero, non-multiple of 50)
    scanner.setActiveAura(caster, 98, 5, 13)

    // At frame 63 (13 + 50), no pulse because 63 % 50 !== 0
    expect(scanner.tick(63, [caster, ally], []).length).toBe(0)
    expect(scanner.tick(99, [caster, ally], []).length).toBe(0)

    // At global frame 50 and 100, pulse fires
    const out50 = scanner.tick(50, [caster, ally], [])
    expect(out50.length).toBe(1)
    expect(out50[0]!.auraSkillId).toBe(98)

    const out100 = scanner.tick(100, [caster, ally], [])
    expect(out100.length).toBe(1)
    expect(ally.stateBus.getActiveEntries().find((e) => e.stateName === 'might')?.durationFrames).toBe(2)
  })
})
