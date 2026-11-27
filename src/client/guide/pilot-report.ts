import type { PlayAssists } from '../input/play-assists.ts'
import type { HudManager } from '../ui/hud-manager.ts'
import type { ClientUnit } from '../world/client-unit.ts'
import type { ClientWorld } from '../world/client-world.ts'
import type { Autopilot } from './autopilot.ts'
import type { PathGuide } from './path-guide.ts'

const NEAR = 15
const QUEST_CODES = new Set(['box', 'msf', 'vip', 'hst', 'qf1', 'qf2', 'qey', 'qbr', 'qhr', 'leg', 'hdm', 'tr1', 'ass', 'bks', 'bkd', 'j34', 'g34', 'bbb', 'xyz', 'g33', 'd33', 'mss', 'ice'])
const round = (value: number) => Math.round(value)
let bagSeen = ''

const bagReport = (world: ClientWorld, assists: PlayAssists) => {
  const key = [...world.containers.inventory.values()].map((item) => `${item.id}${item.identified ? 'i' : ''}`).join()
  if (key === bagSeen) return undefined
  bagSeen = key
  return [...world.containers.inventory.values()].map((item) => ({ item, appraisal: assists.inventoryCare.appraise(item) })).filter(({ appraisal }) => appraisal.kind !== 'consumable').map(({ item, appraisal }) => `${item.code.trim()} ${appraisal.tier} ${appraisal.kind}: ${appraisal.reason}`)
}

export function pilotReport(world: ClientWorld, hudManager: HudManager, assists: PlayAssists, pilot: Autopilot, guide: PathGuide): Readonly<Record<string, unknown>> | null {
  const me = world.self
  if (world.areaId <= 0 || world.selfId <= 0) return null
  const near = (unit: ClientUnit) => Math.hypot(unit.x - me.x, unit.y - me.y) <= NEAR
  const monsters = world.getUnitsByType(1).filter(near)
  const target = assists.currentTargetId === null ? undefined : world.getUnit('monster', assists.currentTargetId)
  const pets = [...world.pets.values()].filter((pet) => pet.ownerId === world.selfId && !pet.isDead).map((pet) => pet.classId)
  return {
    area: world.areaId,
    xy: [round(me.x), round(me.y)],
    level: me.level,
    life: [round(me.life), hudManager.maxHp || me.maxLife],
    mana: [round(me.mana), hudManager.maxMana || me.maxMana],
    skills: [me.leftSkill, me.rightSkill],
    mode: me.mode,
    dead: world.isDead,
    status: guide.pilotStatus,
    hint: guide.currentPlan?.hint,
    pilot: pilot.report(),
    fight: { auto: assists.pilotCombat, standDown: assists.standDown, target: target && { id: target.id, classId: target.classId, name: target.name, lifePct: target.lifePct, distance: round(Math.hypot(target.x - me.x, target.y - me.y)) } },
    hostiles: monsters.filter((unit) => !unit.dead && assists.isHostile(unit)).length,
    corpses: monsters.filter((unit) => unit.dead).length,
    pets,
    belt: world.containers.belt.size,
    gold: me.gold,
    quest: [...world.containers.inventory.values(), ...world.containers.cube.values(), ...world.containers.stash.values()].filter((item) => QUEST_CODES.has(item.code.trim())).map((item) => `${item.code.trim()}@${world.containers.stash.has(item.id) ? 'stash' : world.containers.cube.has(item.id) ? 'cube' : 'bag'}`),
    bag: bagReport(world, assists),
    panel: hudManager.leftPanel,
    menu: Boolean(hudManager.worldPanels.npcMenu),
    speech: Boolean(hudManager.worldPanels.npcSpeech),
  }
}
