/**
 * Shared 1.13c Skill Verification Test Harness (`tests/helpers/skill-test-harness.ts`).
 *
 * Used by both `tests/engine/r1-skill-engine.test.ts` and per-skill isolated worktree
 * suites (`tests/skills/<class>/skill-<id3>-<slug>.test.ts`).
 */
import { getSharedDataRegistry, getSharedMountedArchives, type D2DataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { WorldArena, type ArenaDebugState } from '../../src/server/engine/world-arena.ts'
import { evaluateSkill113c } from '../../src/server/skills/registry.ts'
import type { SkillEvalResult, SkillExecOutcome } from '../../src/server/skills/types.ts'
import { UnitStatList } from '../../src/server/engine/stat-list.ts'

export interface SkillCurveSnapshot {
  readonly skillId: number
  readonly name: string
  readonly charClass: string
  readonly slvl1: SkillEvalResult
  readonly slvl10: SkillEvalResult
  readonly slvl20: SkillEvalResult
  readonly slvl20WithSynergies: SkillEvalResult
  readonly slvl20WithBonusSkillsOnly: SkillEvalResult
}

/**
 * Evaluate a skill at `slvl` 1, 10, and 20 (with and without `blvl` synergies, and verifying
 * that item `+skills` / charges do NOT boost synergies per 1.13c Marrowwalk fix).
 */
export async function evaluateSkillCurve113c(
  skillId: number,
  synergySkillIds: readonly number[] = [],
): Promise<SkillCurveSnapshot> {
  const registry = await getSharedDataRegistry()
  const skill = registry.getSkillById(skillId)
  if (!skill) {
    throw new Error(`Skill ID ${String(skillId)} not found in 1.13c Skills.txt`)
  }

  const evalAt = (slvl: number, blvl: number, synBlvl: number, synBonusOnly: number): SkillEvalResult => {
    const statList = new UnitStatList(registry)
    statList.setBaseSkillLevel(skillId, blvl)
    if (slvl > blvl) {
      statList.setBonusSkillLevel(skillId, slvl - blvl)
    }
    for (const synId of synergySkillIds) {
      statList.setBaseSkillLevel(synId, synBlvl)
      if (synBonusOnly > 0) {
        statList.setBonusSkillLevel(synId, synBonusOnly)
        statList.setChargedSkillLevel(synId, 33) // e.g. Level 33 Marrowwalk charge
      }
    }
    return evaluateSkill113c({
      registry,
      skill,
      slvl,
      blvl,
      statList,
    })
  }

  return {
    skillId,
    name: skill.name,
    charClass: skill.charClass || 'uni',
    slvl1: evalAt(1, 1, 0, 0),
    slvl10: evalAt(10, 10, 0, 0),
    slvl20: evalAt(20, 20, 0, 0),
    slvl20WithSynergies: evalAt(20, 20, 20, 0),
    slvl20WithBonusSkillsOnly: evalAt(20, 20, 0, 20),
  }
}

/**
 * Create a deterministic `WorldArena`, cast `skillId`, and return both the execution outcome
 * and the `ArenaDebugState`.
 */
export async function createAndCastSkillInArena(params: {
  skillId: number
  classCode?: string
  slvl?: number
  blvl?: number
  synergies?: readonly [number, number][]
}): Promise<{
  registry: D2DataRegistry
  arena: WorldArena
  outcome: SkillExecOutcome
  debugState: ArenaDebugState
}> {
  const registry = await getSharedDataRegistry()
  const arena = new WorldArena({
    registry,
    ...(params.classCode !== undefined ? { classCode: params.classCode } : {}),
    skillId: params.skillId,
    slvl: params.slvl ?? 20,
    blvl: params.blvl ?? params.slvl ?? 20,
    ...(params.synergies !== undefined ? { synergies: params.synergies } : {}),
  })
  const outcome = arena.triggerCast()
  const debugState = arena.getDebugState()
  return {
    registry,
    arena,
    outcome,
    debugState,
  }
}

export { getSharedDataRegistry, getSharedMountedArchives }
