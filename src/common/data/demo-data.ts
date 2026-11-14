import { computeSkillManaCost256 } from './calc-ast.ts'
import { getSharedDataRegistry } from './data-registry.ts'
import type { SkillDef } from '../skills/missiles-data.ts'
import type { NpcDef, QuestDef } from '../world/quests'

// `DEMO_MONSTERS` used to live here: three hand-written monsters the act scene
// dropped into any level whose plan came back empty. They stood in for missing
// data, carried invented stats, and — having no `MonStats.txt` ids — rendered as
// red boxes, so a data failure looked like content. A level that plans nothing
// is now empty and says so (issue #58 item 5).

/** Fallback experience thresholds, index 1 = level 1. */
export const DEMO_EXPERIENCE: readonly number[] = [0, 0, 20, 60, 140, 280]

function buildSkillDefFrom113c(id: string, skillId: number, fallbackRangePx: number): SkillDef {
  const registry = getSharedDataRegistry()
  const skill = registry.getSkill(skillId)
  if (!skill) {
    throw new Error(`Missing canonical 1.13c Skills.txt row #${String(skillId)}`)
  }
  const missileName = skill.srvMissile || skill.srvMissileA
  const missile = missileName ? registry.getMissileByName(missileName) : undefined
  const manaCost = computeSkillManaCost256(skill, 1).manaCost256 / 256
  const speed = missile ? missile.vel * 25 : 0
  const range =
    missile && missile.vel > 0 && missile.range > 0
      ? missile.vel * missile.range
      : fallbackRangePx
  const baseMinDamage =
    skill.eMin > 0 || skill.minDam > 0
      ? ((skill.eMin + skill.minDam) * (1 << skill.hitShift)) / 256
      : 1
  const baseMaxDamage =
    skill.eMax > 0 || skill.maxDam > 0
      ? ((skill.eMax + skill.maxDam) * (1 << skill.hitShift)) / 256
      : 2
  return {
    id,
    name: skill.skill,
    manaCost,
    cooldownTicks: Number(skill.delay) || 0,
    range,
    projectile: Boolean(missile),
    speed,
    baseMinDamage,
    baseMaxDamage,
    radius: 20,
    ...(skill.castOverlay ? { castOverlay: skill.castOverlay } : {}),
  }
}

/** Canonical 1.13c starter skills derived directly from `Skills.txt` + `Missiles.txt` (#0 Attack, #36 Fire Bolt). */
export const DEMO_SKILLS: readonly SkillDef[] = [
  buildSkillDefFrom113c('attack', 0, 48),
  buildSkillDefFrom113c('firebolt', 36, 800),
]

/** Fallback NPC, used when an archive ships no NPC table. */
export const DEMO_NPCS: readonly NpcDef[] = [{
  id: 'elder', name: 'Elder', questId: 'demo',
  offerLines: ['The moor is crawling with vermin.', 'Will you thin them out?'],
  progressLines: ['Still at it?'], doneLines: ['The moor is quieter. Thank you.'],
}]

/** Fallback quest, used when an archive ships no quest table. */
export const DEMO_QUESTS: readonly QuestDef[] = [{
  id: 'demo', name: 'Clear the Moor', description: 'Slay three monsters',
  monsterId: '*', killCount: 3, rewardXp: 40, rewardGold: 80,
}]
