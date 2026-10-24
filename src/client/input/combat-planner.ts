import { SKILLS_BY_ID, SKILLS_CATALOG } from '../../common/data/skills-catalog.ts'
import { MONSTER_PATH_IDS } from '../../common/path/monster-path-data.ts'
import { getSkillTableMeta } from '../../common/skills/skills-meta.ts'
import { STATE_OVERLAY_ROWS_113C } from '../../common/skills/skill-state-overlays-113c.ts'
import COMBAT from '../../common/skills/data/combat-skills.json'

export type Reach = 'melee' | 'ranged' | 'close'
export type Hand = 'left' | 'right'
export type Element = 'physical' | 'magic' | 'fire' | 'lightning' | 'cold' | 'poison'
export type Resists = Partial<Record<Element, number | undefined>>

export interface SkillUse {
  readonly skillId: number
  readonly hand: Hand
  readonly reach: Reach
  readonly on: 'target' | 'self'
}

export interface CombatSelf {
  readonly skills: ReadonlyMap<number, number>
  readonly mainSkills: readonly number[]
  readonly states: { has(stateId: number): boolean }
  readonly petClasses: readonly number[]
  readonly lifeFraction: number
  readonly manaFraction: number
  readonly corpsesNear: number
}

export interface CombatTarget {
  readonly distance: number
  readonly resists: Resists
  readonly states: { has(stateId: number): boolean }
  readonly trapsNear: number
  readonly tough: boolean
  readonly packSize: number
  readonly lifeFraction: number
}

export type CanCast = (skillId: number) => boolean

export const CLOSE_REACH = 5
export const TRAP_REACH = 14
const MAIN_SKILL_WEIGHT = 2
const RECOVER_BELOW = 0.45
const SAVE_MANA_BELOW = 0.35
const WEAK_LIFE = 0.35
const ELEMENTS: Readonly<Record<string, Element>> = { fire: 'fire', cold: 'cold', ltng: 'lightning', pois: 'poison', mag: 'magic' }

const SKILL_ID = new Map(SKILLS_CATALOG.map((skill) => [skill.name, skill.id]))
const STATE_ID = new Map(STATE_OVERLAY_ROWS_113C.map((row) => [row.state, row.id]))
const idOf = (name: string) => SKILL_ID.get(name) ?? -1
const monsterIds = (names: readonly string[]) => names.map((name) => MONSTER_PATH_IDS.indexOf(name))

const ATTACKS = new Map(Object.entries(COMBAT.attacks as Record<string, Reach>).map(([name, reach]) => [idOf(name), reach]))
const TRAPS = new Map(Object.entries(COMBAT.traps).map(([name, monster]) => [idOf(name), monsterIds([monster])[0]!]))
const BUFFS = Object.entries(COMBAT.buffs).map(([name, state]) => ({ skillId: idOf(name), stateId: STATE_ID.get(state) ?? -1 }))
const CURSES = Object.entries(COMBAT.curses).map(([name, state]) => ({ skillId: idOf(name), stateId: STATE_ID.get(state) ?? -1 }))
const SUMMONS = Object.entries(COMBAT.summons).map(([name, monsters]) => ({ skillId: idOf(name), classes: new Set(monsterIds(monsters)) }))
const RAISES = Object.entries(COMBAT.raises).map(([name, monster]) => ({ skillId: idOf(name), classId: monsterIds([monster])[0]! }))
const GROUPS = COMBAT.oneOf.map((names) => names.map(idOf))
const AURAS = { fight: COMBAT.auras.fight.map(idOf), travel: COMBAT.auras.travel.map(idOf), recover: COMBAT.auras.recover.map(idOf) }
export const TRAP_CLASSES: ReadonlySet<number> = new Set(TRAPS.values())
export const CURSE_SKILLS: ReadonlySet<number> = new Set(CURSES.map(({ skillId }) => skillId))
export const BOSS_CLASSES: ReadonlySet<number> = new Set(monsterIds(COMBAT.bosses))
export const CORPSE_EXPLOSION = idOf(COMBAT.corpseExplosion)
export const CURSE_PACK = 3
const PRIORITY_PREFIXES: readonly string[] = COMBAT.priorityTargets
export const isPriorityClass = (classId: number): boolean => PRIORITY_PREFIXES.some((prefix) => MONSTER_PATH_IDS[classId]?.startsWith(prefix) === true)
export const TELEPORT = idOf(COMBAT.mobility)
export const BASIC_ATTACK = COMBAT.basicAttack

const handOf = (skillId: number): Hand => (getSkillTableMeta(skillId)?.leftskill === 1 ? 'left' : 'right')

export const elementOf = (skillId: number): Element => ELEMENTS[SKILLS_BY_ID[skillId]?.eType ?? ''] ?? 'physical'

const levelOf = (self: CombatSelf, skillId: number) => self.skills.get(skillId) ?? 0
const outranked = (self: CombatSelf, skillId: number) => GROUPS.some((group) => group.includes(skillId) && group.some((other) => other !== skillId && levelOf(self, other) > levelOf(self, skillId)))
const best = (self: CombatSelf, ids: readonly number[], canCast: CanCast) => ids.filter((id) => levelOf(self, id) > 0 && canCast(id)).sort((a, b) => levelOf(self, b) - levelOf(self, a))[0] ?? null

export function attackSkill(self: CombatSelf, target: CombatTarget, canCast: CanCast): SkillUse {
  const damage = (skillId: number) => Math.max(0, 1 - (target.resists[elementOf(skillId)] ?? 0) / 100)
  const tier = (skillId: number) => ((SKILLS_BY_ID[skillId]?.delay ?? 0) > 0 ? 0 : (SKILLS_BY_ID[skillId]?.reqlevel ?? 0) / 100)
  const score = (skillId: number) => (levelOf(self, skillId) * (self.mainSkills.includes(skillId) ? MAIN_SKILL_WEIGHT : 1) + tier(skillId)) * damage(skillId)
  const thrifty = !target.tough && (self.manaFraction < SAVE_MANA_BELOW || (target.lifeFraction < WEAK_LIFE && target.distance <= CLOSE_REACH))
  const costly = (skillId: number) => thrifty && (SKILLS_BY_ID[skillId]?.mana ?? 0) > 0
  const chosen = [...ATTACKS.keys()].filter((id) => levelOf(self, id) > 0 && score(id) > 0 && !costly(id) && canCast(id)).sort((a, b) => score(b) - score(a))[0]
  return chosen === undefined ? { skillId: BASIC_ATTACK, hand: 'left', reach: 'melee', on: 'target' } : { skillId: chosen, hand: handOf(chosen), reach: ATTACKS.get(chosen)!, on: 'target' }
}

const raiseLimit = (level: number) => (level < 3 ? level : 2 + Math.floor(level / 3))

export function raiseSkill(self: CombatSelf, canCast: CanCast): SkillUse | null {
  const short = (classId: number, skillId: number) => self.petClasses.filter((pet) => pet === classId).length < raiseLimit(levelOf(self, skillId))
  const raise = self.corpsesNear === 0 ? undefined : RAISES.filter(({ skillId, classId }) => levelOf(self, skillId) > 0 && short(classId, skillId) && canCast(skillId)).sort((a, b) => levelOf(self, b.skillId) - levelOf(self, a.skillId))[0]
  return raise ? { skillId: raise.skillId, hand: 'right', reach: 'ranged', on: 'self' } : null
}

export function supportSkill(self: CombatSelf, target: CombatTarget | null, canCast: CanCast): SkillUse | null {
  const ready = (skillId: number) => levelOf(self, skillId) > 0 && !outranked(self, skillId) && canCast(skillId)
  const buff = BUFFS.find(({ skillId, stateId }) => ready(skillId) && !self.states.has(stateId))
  if (buff) return { skillId: buff.skillId, hand: 'right', reach: 'ranged', on: 'self' }
  const summon = SUMMONS.filter(({ skillId }) => ready(skillId)).sort((a, b) => levelOf(self, b.skillId) - levelOf(self, a.skillId))[0]
  if (summon && !self.petClasses.some((classId) => summon.classes.has(classId))) return { skillId: summon.skillId, hand: 'right', reach: 'ranged', on: 'self' }
  if (!target) return null
  const curse = CURSES.filter(({ skillId }) => ready(skillId)).sort((a, b) => levelOf(self, b.skillId) - levelOf(self, a.skillId))[0]
  if (curse && (target.tough || target.packSize >= CURSE_PACK) && !target.states.has(curse.stateId)) return { skillId: curse.skillId, hand: 'right', reach: 'ranged', on: 'target' }
  const trap = best(self, [...TRAPS.keys()], canCast)
  return trap !== null && target.distance <= TRAP_REACH && target.trapsNear < COMBAT.maxTraps ? { skillId: trap, hand: 'right', reach: 'ranged', on: 'target' } : null
}

export function auraSkill(self: CombatSelf, fighting: boolean, canCast: CanCast): number | null {
  const recover = self.lifeFraction < RECOVER_BELOW ? best(self, AURAS.recover, canCast) : null
  return recover ?? best(self, fighting ? AURAS.fight : AURAS.travel, canCast) ?? (fighting ? null : best(self, AURAS.fight, canCast))
}
