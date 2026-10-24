import type { SkillDef } from '../skills/missiles-data.ts'
import type { NpcDef, QuestDef } from '../world/quests'

// `DEMO_MONSTERS` used to live here: three hand-written monsters the act scene
// dropped into any level whose plan came back empty. They stood in for missing
// data, carried invented stats, and — having no `MonStats.txt` ids — rendered as
// red boxes, so a data failure looked like content. A level that plans nothing
// is now empty and says so (issue #58 item 5).

/** Fallback experience thresholds, index 1 = level 1. */
export const DEMO_EXPERIENCE: readonly number[] = [0, 0, 20, 60, 140, 280]

/** Fallback skills, used when an archive ships no skill table. */
export const DEMO_SKILLS: readonly SkillDef[] = [
  { id: 'attack', name: 'Attack', manaCost: 0, cooldownTicks: 10, range: 48, projectile: false, speed: 0, baseMinDamage: 4, baseMaxDamage: 6, damagePerLevel: 1, radius: 20 },
  { id: 'firebolt', name: 'Fire Bolt', manaCost: 6, cooldownTicks: 20, range: 1000, projectile: true, speed: 500, baseMinDamage: 7, baseMaxDamage: 10, damagePerLevel: 3, radius: 20, castOverlay: 'fire_cast_1' },
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
