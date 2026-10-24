/**
 * 1.13c missile pierce: the `pierce_idx` mechanism (Issue #1420).
 *
 * Ground truth (`samples/d2/D2Game.dll`, image base 0x6FC20000; `samples/d2/D2Common.dll`, base 0x6FD50000):
 *
 * - Creation roll `0x6FC8F660` (called from the missile-creation routine at `0x6FC8FE59`):
 *   - only when the missile (unit type 3) has an owner of unit type 0 (player) or 1 (monster), and the
 *     Missiles.txt `Pierce` flag is set (`test [MissilesTxt+4], mask` @ `0x6FC8F6A3`);
 *   - `total = item_pierce (#156, 0x9C) + skill_pierce (#166, 0xA6)` read from the OWNER (`0x6FC8F6AF..0x6FC8F6C9`);
 *     no roll at all when `total == 0`;
 *   - `SEED_InitLowSeed(&seed, GetUnitBaseStat(owner, pierce_idx #328))` (D2Common #10587 + #10614 => `{ lo, hi: 666 }`);
 *   - `for (n = 0; n < 4 && SEED_Rand(seed) % 100 < total; ++n) {}` (`0x6FC8F6F1..0x6FC8F717`, signed compare);
 *   - `SetUnitStat(missile, pierce_idx #328, n)` (`0x6FC8F720`, D2Common #10887).
 * - The owner's BASE `pierce_idx` is an attack counter: the attack-sequence starters (`0x6FCEE520`, `0x6FCEE5A0` and
 *   their siblings up to `0x6FCEEA20`) do `SetUnitStat(unit, pierce_idx, GetUnitBaseStat(unit, pierce_idx) + 1)` before
 *   every attack, so every missile of one attack shares one seed and consecutive attacks roll differently.
 * - Hit consumption `0x6FC58F40` (called from the unit-collision handler `0x6FC5EDE0` at `0x6FC5EF2A`):
 *   - the handler only calls it when the missile row has `Pierce` AND the owner currently has `skill_pierce` or
 *     `item_pierce` (`0x6FC5EEF9..0x6FC5EF26`);
 *   - `pierce_idx > 0` => `pierce_idx -= 1`, return 2 (missile keeps flying); otherwise return 3 (CollideKill decides).
 * - `skill_pierce` is not an engine formula: Skills.txt `Pierce` (#33) `passivestat1 = skill_pierce`,
 *   `passivecalc1 = dm12` (`Param1 = 10`, `Param2 = 100`).
 * - `CollideKill = 0` rows (lightningbolt, bonespear, blessedhammer, shockwave, ...) are simply never removed by a unit
 *   collision; that is unrelated to `Pierce` and never reads the pierce stats.
 */
import { evaluateCalc } from '../../common/data/calc-ast.ts'
import type { D2DataRegistry, MissileRecord, SkillRecord } from '../../common/data/data-registry.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import type { CombatUnitContext } from './combat-pipeline.ts'

/** Hard cap of the creation roll loop (`cmp ebx, 4` @ `0x6FC8F6F1`). */
export const MISSILE_PIERCE_ROLL_CAP = 4
/** `SEED_InitLowSeed` high register (D2Common #10614 @ `0x6FD86740`: `mov [ecx+4], 0x29A`). */
export const PIERCE_SEED_HI = 666

type PierceStatUnit = Pick<CombatUnitContext, 'statList'>
type LooseStatList = Partial<CombatUnitContext['statList']> | undefined

interface PassivePierceCalc {
  readonly skill: SkillRecord
  readonly calc: string
}

const passivePierceCache = new WeakMap<D2DataRegistry, readonly PassivePierceCalc[]>()

/** Skills.txt rows whose `passivestatN = skill_pierce` (1.13c: only `Pierce` #33, `passivecalc1 = dm12`). */
function skillPiercePassives(registry: D2DataRegistry): readonly PassivePierceCalc[] {
  const cached = passivePierceCache.get(registry)
  if (cached) return cached
  const out: PassivePierceCalc[] = []
  for (const skill of registry.getAllPlayerSkills()) {
    const pairs: readonly (readonly [string, string])[] = [
      [skill.passiveStat1, skill.passiveCalc1],
      [skill.passiveStat2, skill.passiveCalc2],
      [skill.passiveStat3, skill.passiveCalc3],
      [skill.passiveStat4, skill.passiveCalc4],
      [skill.passiveStat5, skill.passiveCalc5],
    ]
    for (const [stat, calc] of pairs) {
      if ((stat ?? '').trim().toLowerCase() === 'skill_pierce' && (calc ?? '').trim() !== '') {
        out.push({ skill, calc })
      }
    }
  }
  passivePierceCache.set(registry, out)
  return out
}

/**
 * `skill_pierce` (#166) of a unit. When the passive state is already attached its stat is used; otherwise the passive
 * value is derived from the Skills.txt `passivestatN = skill_pierce` row(s) at the unit's effective skill level, exactly
 * as the passive refresh would write it.
 */
export function resolveUnitSkillPierce(unit: PierceStatUnit, registry?: D2DataRegistry): number {
  const sl = unit.statList as LooseStatList
  const attached = sl?.getAccruedStat?.('skill_pierce') ?? 0
  if (attached !== 0 || !registry) return attached
  let total = 0
  for (const { skill, calc } of skillPiercePassives(registry)) {
    const slvl = sl?.getEffectiveSkillLevel?.(skill.id) ?? 0
    if (slvl <= 0) continue
    total += evaluateCalc(calc, {
      registry,
      activeSkill: skill,
      slvl,
      blvl: sl?.getBaseSkillLevel?.(skill.id) ?? slvl,
      getBaseSkillLevel: (id: number) => sl?.getBaseSkillLevel?.(id) ?? 0,
      getEffectiveSkillLevel: (id: number) => sl?.getEffectiveSkillLevel?.(id) ?? 0,
    })
  }
  return total
}

/** `item_pierce (#156) + skill_pierce (#166)` of the owner (`0x6FC8F6AF..0x6FC8F6C9`). */
export function resolveUnitPierceTotal(unit: PierceStatUnit, registry?: D2DataRegistry): number {
  const sl = unit.statList as LooseStatList
  const itemPierce = sl?.getAccruedStat?.('item_pierce') ?? 0
  return itemPierce + resolveUnitSkillPierce(unit, registry)
}

/**
 * Creation roll (`0x6FC8F6EF..0x6FC8F717`): consecutive `rand % 100 < total` successes, at most 4, from a seed whose low
 * register is `seedLo` and high register is 666.
 */
export function rollMissilePierceIdx(totalPiercePct: number, seedLo: number): number {
  const total = Math.trunc(totalPiercePct)
  if (total === 0) return 0
  const rng = new D2Rng()
  rng.setSeed(seedLo >>> 0, PIERCE_SEED_HI)
  let n = 0
  while (n < MISSILE_PIERCE_ROLL_CAP) {
    // `div ebp` (unsigned rand % 100) then `cmp edx, edi; jge` (signed compare against total).
    if (rng.rand(100) >= total) break
    n += 1
  }
  return n
}

/**
 * Attack-sequence start (`0x6FCEE520` & siblings): `pierce_idx(base) += 1` on the attacker. Call once per attack/cast,
 * before its missiles are created.
 */
export function advanceUnitPierceSeed(unit: PierceStatUnit): void {
  const sl = unit.statList as LooseStatList
  if (!sl?.getBaseStat || !sl.setBaseStat) return
  sl.setBaseStat('pierce_idx', sl.getBaseStat('pierce_idx') + 1)
}

/** Full creation-time `pierce_idx` for a missile row fired by `owner` (`0x6FC8F660`). */
export function resolveMissilePierceIdx(
  record: Pick<MissileRecord, 'pierce'>,
  owner: PierceStatUnit | undefined,
  registry?: D2DataRegistry,
): number {
  if (!record.pierce || !owner) return 0
  const total = resolveUnitPierceTotal(owner, registry)
  if (total === 0) return 0
  const sl = owner.statList as LooseStatList
  const seedLo = sl?.getBaseStat?.('pierce_idx') ?? 0
  return rollMissilePierceIdx(total, seedLo)
}

/**
 * Collision gate (`0x6FC5EEF9..0x6FC5EF26`): the pierce consumer only runs when the row has `Pierce` and the owner
 * currently has a non-zero `skill_pierce` or `item_pierce`.
 */
export function ownerCanConsumePierce(owner: PierceStatUnit | undefined, registry?: D2DataRegistry): boolean {
  if (!owner) return false
  if (resolveUnitSkillPierce(owner, registry) !== 0) return true
  const sl = owner.statList as LooseStatList
  return (sl?.getAccruedStat?.('item_pierce') ?? 0) !== 0
}
