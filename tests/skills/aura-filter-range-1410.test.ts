/**
 * Issue #1410 — 1.13c aura target selection: sub-tile Euclidean radius from `aurarangecalc` and
 * the `Skills.txt` `aurafilter` bit predicate.
 *
 * Ground truth (`samples/d2/D2Game.dll`, image base 0x6FC20000; `samples/d2/D2Common.dll`,
 * image base 0x6FD50000), see `kb/skills/aura-target-filter-113c.md`:
 * - radial scan 0x6FCC0C70: `6fcc0d00: imul ebp,ebx` (range²), D2Common ord 10769 (0x6FD84580)
 *   sub-tile `dx² + dy²`, `6fcc0e07: cmp ebp,eax; jl skip`; radius `<= 0` scans nothing; filter
 *   `0x2000` skips every town room (D2Common ord 10057 IsTown); filter `0` -> `0x583`.
 * - per-unit predicate 0x6FCC0370: `0x1` players, `0x2` monsters, `0x4` undead, `0x100` not in town,
 *   `0x200` line of sight (D2Common ord 11076), `0x1000` dead only, `0x4000` not MonStats `boss`,
 *   `0x8000` enemy (0x6FD00A60), `0x10000` ally (0x6FD00570), `0x40000` not `primeevil`.
 * - `samples/d2/excel/Skills.txt`: Might/Prayer/... `aurafilter = 73731` (0x12003), Meditation
 *   73729 (0x12001), spirit auras 296-298 65795 (0x10103), Holy Fire/Holy Shock 42883 (0xA783),
 *   Conviction 42371 (0xA583), Holy Freeze 303747 (0x4A283), Sanctuary 59270 (0xE786),
 *   Redemption 4354 (0x1102), Blade Shield 33667 (0x8383) with `aurarangecalc = par4` = 6.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { AuraScanner, type CorpseContext } from '../../src/server/engine/aura-scanner.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import type { CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'
import type { D2DataRegistry } from '../../src/common/data/data-registry.ts'
import {
  AURA_FILTER,
  AURA_FILTER_DEFAULT,
  isWithinAuraRange,
  passesAuraFilter,
} from '../../src/common/skills/aura-filter.ts'

function makeUnit(
  registry: D2DataRegistry,
  id: string,
  unitType: NonNullable<CombatUnitContext['unitType']>,
  extra: Partial<CombatUnitContext> = {},
): CombatUnitContext {
  const statList = new UnitStatList(registry, { maxhp: 5000 * FIXED_ONE, hitpoints: 5000 * FIXED_ONE })
  return { id, name: id, statList, stateBus: new StateBus(statList, registry), unitType, ...extra }
}

const ORIGIN = { x: 100, y: 100 }

describe('Issue #1410: aura radius is sub-tile dx²+dy² <= r²', () => {
  it('pure range test (D2Common ord 10769 + 0x6FCC0E07)', () => {
    expect(isWithinAuraRange(16, 0, 16)).toBe(true)
    expect(isWithinAuraRange(12, 12, 16)).toBe(false) // 288 > 256
    expect(isWithinAuraRange(11, 11, 16)).toBe(true) // 242 <= 256
    expect(isWithinAuraRange(0, 16, 16)).toBe(true) // circular, not 2:1 elliptic
    expect(isWithinAuraRange(0, 0, 0)).toBe(false) // `test ebx,ebx; jle` -> no scan
  })

  it('Might slvl 1 (ln12 = 16): (16,0) hit, (12,12) and position-less allies miss', async () => {
    const registry = await getSharedDataRegistry()
    const might = registry.getSkillById(98)!
    expect(might.auraFilter).toBe(73731)
    const tgtState = might.auraTgtState || might.auraState
    const scanner = new AuraScanner(registry)
    const caster = makeUnit(registry, 'pal', 'player', { ...ORIGIN })
    const near = makeUnit(registry, 'near', 'party', { x: 116, y: 100 })
    const vert = makeUnit(registry, 'vert', 'party', { x: 100, y: 116 })
    const diag = makeUnit(registry, 'diag', 'party', { x: 112, y: 112 })
    const nowhere = makeUnit(registry, 'nowhere', 'party')
    const out = scanner.pulseAura(scanner.setActiveAura(caster, 98, 1)!, 0, [caster, near, vert, diag, nowhere], [])
    expect(near.stateBus.hasState(tgtState)).toBe(true)
    expect(vert.stateBus.hasState(tgtState)).toBe(true)
    expect(diag.stateBus.hasState(tgtState)).toBe(false)
    expect(nowhere.stateBus.hasState(tgtState)).toBe(false)
    expect(out.alliesBuffed).toBe(3)
  })

  it('Blade Shield (277) radius is aurarangecalc par4 = 6', async () => {
    const registry = await getSharedDataRegistry()
    const bs = registry.getSkillById(277)!
    expect(bs.auraRangeCalc).toBe('par4')
    expect(bs.param4).toBe(6)
    const scanner = new AuraScanner(registry)
    const caster = makeUnit(registry, 'asn', 'player', { ...ORIGIN })
    const at6 = makeUnit(registry, 'at6', 'monster', { x: 106, y: 100 })
    const at54 = makeUnit(registry, 'at54', 'monster', { x: 105, y: 104 }) // 41 > 36
    const at7 = makeUnit(registry, 'at7', 'monster', { x: 107, y: 100 })
    const out = scanner.pulseAura(scanner.setActiveAura(caster, 277, 1)!, 0, [caster], [at6, at54, at7])
    expect(out.enemiesAffected).toBe(1)
  })
})

describe('Issue #1410: aurafilter bits', () => {
  it('pure predicate decodes 0x6FCC0370', () => {
    const base = { kind: 'monster' as const, relation: 'enemy' as const, dead: false, inTown: false }
    expect(AURA_FILTER_DEFAULT).toBe(0x583)
    // Holy Freeze 0x4A283 rejects prime evils
    expect(passesAuraFilter(303747, { ...base, isPrimeEvil: true })).toBe(false)
    expect(passesAuraFilter(303747, { ...base })).toBe(true)
    // Sanctuary 0xE786: undead, non-boss monsters, never players
    expect(passesAuraFilter(59270, { ...base, isUndead: true })).toBe(true)
    expect(passesAuraFilter(59270, { ...base, isUndead: false })).toBe(false)
    expect(passesAuraFilter(59270, { ...base, isUndead: true, isBoss: true })).toBe(false)
    expect(passesAuraFilter(59270, { ...base, kind: 'player', isUndead: true })).toBe(false)
    // LOS bit 0x200: Holy Fire 0xA783 has it, Conviction 0xA583 does not
    expect(42883 & AURA_FILTER.LINE_OF_SIGHT).toBeTruthy()
    expect(42371 & AURA_FILTER.LINE_OF_SIGHT).toBe(0)
    expect(passesAuraFilter(42883, { ...base, lineOfSightClear: false })).toBe(false)
    expect(passesAuraFilter(42371, { ...base, lineOfSightClear: false })).toBe(true)
    // Enemy vs ally relation
    expect(passesAuraFilter(42371, { ...base, relation: 'ally' })).toBe(false)
    expect(passesAuraFilter(73731, { ...base, relation: 'enemy' })).toBe(false)
    expect(passesAuraFilter(73731, { ...base, relation: 'ally' })).toBe(true)
    // Town: 0x2000 room skip (Might) and 0x100 target reject (spirit auras)
    expect(passesAuraFilter(73731, { ...base, relation: 'ally', inTown: true })).toBe(false)
    expect(passesAuraFilter(65795, { ...base, relation: 'ally', inTown: true })).toBe(false)
    expect(passesAuraFilter(65795, { ...base, relation: 'ally', inTown: false })).toBe(true)
    // Dead: Redemption 0x1102 wants corpses, everything else rejects them
    expect(passesAuraFilter(4354, { ...base, relation: 'neutral', dead: true })).toBe(true)
    expect(passesAuraFilter(4354, { ...base, relation: 'neutral', dead: false })).toBe(false)
    expect(passesAuraFilter(73731, { ...base, relation: 'ally', dead: true })).toBe(false)
  })

  it('sweep: every friendly / offensive aura row skips town (0x2000 or 0x100)', async () => {
    const registry = await getSharedDataRegistry()
    for (const id of [98, 99, 100, 102, 103, 104, 105, 108, 109, 110, 113, 114, 115, 118, 119, 120, 122, 123, 124, 125, 296, 297, 298]) {
      const f = registry.getSkillById(id)!.auraFilter
      expect(f & (AURA_FILTER.SKIP_TOWN_ROOMS | AURA_FILTER.NOT_IN_TOWN), String(id)).not.toBe(0)
    }
  })

  it('town: Might / Oak Sage reach no ally (0x2000 / 0x100), caster keeps its aurastate', async () => {
    const registry = await getSharedDataRegistry()
    for (const [id, town, expectAlly] of [
      [98, true, false],
      [98, false, true],
      [298, true, false],
      [298, false, true],
    ] as const) {
      const skill = registry.getSkillById(id)!
      const tgtState = skill.auraTgtState || skill.auraState
      const scanner = new AuraScanner(registry)
      const caster = makeUnit(registry, 'src', id === 298 ? 'minion' : 'player', { ...ORIGIN })
      const ally = makeUnit(registry, 'ally', 'party', { x: 103, y: 100 })
      scanner.pulseAura(scanner.setActiveAura(caster, id, 1)!, 0, [caster, ally], [], [], { isTown: town })
      expect(ally.stateBus.hasState(tgtState), `${String(id)} town=${String(town)}`).toBe(expectAlly)
      expect(caster.stateBus.hasState(skill.auraState || tgtState)).toBe(true)
    }
  })

  it('Meditation (0x12001) reaches players only, not mercenaries', async () => {
    const registry = await getSharedDataRegistry()
    const skill = registry.getSkillById(120)!
    const tgtState = skill.auraTgtState || skill.auraState
    const scanner = new AuraScanner(registry)
    const caster = makeUnit(registry, 'pal', 'player', { ...ORIGIN })
    const party = makeUnit(registry, 'p2', 'party', { x: 102, y: 100 })
    const merc = makeUnit(registry, 'merc', 'mercenary', { x: 101, y: 100 })
    scanner.pulseAura(scanner.setActiveAura(caster, 120, 1)!, 0, [caster, party, merc], [])
    expect(party.stateBus.hasState(tgtState)).toBe(true)
    expect(merc.stateBus.hasState(tgtState)).toBe(false)
  })

  it('Holy Fire is blocked by walls (0x200); Conviction is not', async () => {
    const registry = await getSharedDataRegistry()
    const blocked = { hasLineOfSight: () => false, rollChanceFn: () => false }
    const hf = new AuraScanner(registry)
    const c1 = makeUnit(registry, 'pal', 'player', { ...ORIGIN })
    const m1 = makeUnit(registry, 'm1', 'monster', { x: 102, y: 100 })
    expect(hf.pulseAura(hf.setActiveAura(c1, 102, 1)!, 0, [c1], [m1], [], blocked).enemiesAffected).toBe(0)
    expect(hf.pulseAura(hf.setActiveAura(c1, 102, 1)!, 0, [c1], [m1], [], { rollChanceFn: () => false }).enemiesAffected).toBe(1)
    const cv = new AuraScanner(registry)
    const m2 = makeUnit(registry, 'm2', 'monster', { x: 102, y: 100 })
    expect(cv.pulseAura(cv.setActiveAura(c1, 123, 1)!, 0, [c1], [m2], [], blocked).enemiesAffected).toBe(1)
  })

  it('Sanctuary / Holy Freeze use MonStats boss / primeevil bits', async () => {
    const registry = await getSharedDataRegistry()
    const caster = makeUnit(registry, 'pal', 'player', { ...ORIGIN })
    const opts = { rollChanceFn: () => false }
    const sanc = new AuraScanner(registry)
    const undead = makeUnit(registry, 'u', 'monster', { x: 101, y: 100, isUndead: true })
    const boss = makeUnit(registry, 'b', 'monster', { x: 101, y: 101, isUndead: true, isBoss: true })
    const beast = makeUnit(registry, 'n', 'monster', { x: 100, y: 101 })
    expect(sanc.pulseAura(sanc.setActiveAura(caster, 119, 1)!, 0, [caster], [undead, boss, beast], [], opts).enemiesAffected).toBe(1)
    const hfz = new AuraScanner(registry)
    const prime = makeUnit(registry, 'd', 'monster', { x: 101, y: 100, isPrimeEvil: true, coldEffect: -50 })
    const zombie = makeUnit(registry, 'z', 'monster', { x: 100, y: 101, coldEffect: -50 })
    expect(hfz.pulseAura(hfz.setActiveAura(caster, 114, 1)!, 0, [caster], [prime, zombie], [], opts).enemiesAffected).toBe(1)
  })

  it('Redemption: ln12 = 16 sub-tile radius, corpses only outside town', async () => {
    const registry = await getSharedDataRegistry()
    const run = (corpses: CorpseContext[], isTown: boolean) => {
      const scanner = new AuraScanner(registry)
      const caster = makeUnit(registry, 'pal', 'player', { ...ORIGIN })
      return scanner.pulseAura(scanner.setActiveAura(caster, 124, 1)!, 0, [caster], [], corpses, {
        isTown,
        rollChanceFn: () => true,
      }).corpsesRedeemed
    }
    expect(run([{ id: 'a', consumed: false, x: 116, y: 100 }], false)).toBe(1)
    expect(run([{ id: 'b', consumed: false, x: 117, y: 100 }], false)).toBe(0)
    expect(run([{ id: 'c', consumed: false }], false)).toBe(0)
    expect(run([{ id: 'd', consumed: false, x: 101, y: 100 }], true)).toBe(0)
  })
})
