/**
 * Explicit legacy demo / Sorceress HUD state for widget tests.
 *
 * The production HUD starts from a neutral, server-not-ready state (no class, no skills, no gear,
 * zero vitals, locked waypoints/quests). Widget tests that exercise pure layout / interaction
 * behavior seed the former demo profile explicitly through these helpers instead of relying on
 * hidden defaults in `src/`.
 */

import { CharacterSheetPanel } from '../../src/client/ui/character-sheet.ts'
import type { HudManager } from '../../src/client/ui/hud-manager.ts'
import { SkillHotkeysHud } from '../../src/client/ui/hotkeys.ts'
import { InventoryPanel, type EquipSlotId } from '../../src/client/ui/inventory.ts'
import { SkillTreePanel } from '../../src/client/ui/skill-tree-panel.ts'
import { ACT_WAYPOINTS, ALL_QUESTS, WorldPanelsHud } from '../../src/client/ui/world-panels.ts'
import type { BeltModel } from '../../src/common/items/belt-model.ts'
import { DEMO_BAG_ITEMS, DEMO_EQUIPPED_GEAR, DEMO_SORCERESS_SKILLS, seedDemoBeltPotions } from './demo-profile-data.ts'

/** Former demo Sorceress profile (level 85). */
export const DEMO_LEVEL = 85
export const DEMO_STR = 156
export const DEMO_DEX = 75
export const DEMO_VITALS = {
  hp: 1180,
  maxHp: 1180,
  mana: 940,
  maxMana: 940,
  stamina: 465,
  maxStamina: 465,
} as const

/** Former default F1..F8 quickbar bindings. */
export const DEMO_HOTKEY_BINDINGS: ReadonlyArray<[string, { side: 'left' | 'right'; skillId: number }]> = [
  ['F1', { side: 'right', skillId: 64 }],
  ['F2', { side: 'right', skillId: 59 }],
  ['F3', { side: 'right', skillId: 56 }],
  ['F4', { side: 'right', skillId: 54 }],
  ['F5', { side: 'left', skillId: 47 }],
  ['F6', { side: 'left', skillId: 49 }],
  ['F7', { side: 'right', skillId: 40 }],
  ['F8', { side: 'right', skillId: 42 }],
]

/** Former demo skill-tree hard points. */
export const DEMO_SKILL_HARD_POINTS: ReadonlyArray<[number, number]> = [
  [39, 1], [40, 1], [44, 1], [45, 5], [55, 10], [59, 20], [64, 20], [65, 10],
  [38, 1], [42, 1], [43, 1], [49, 5], [54, 1],
  [36, 1], [37, 1], [47, 15], [56, 10], [61, 5],
]

/** Quests the former demo profile had completed (all others were active). */
export const DEMO_COMPLETED_QUEST_IDS: ReadonlySet<string> = new Set(['a1q1', 'a1q2', 'a1q3'])

/** Seed Sorceress quickbar: all default skills, Fire Ball (47) left, Frozen Orb (64) right, F1..F8 bindings. */
export function seedDemoHotkeys(hotkeys: SkillHotkeysHud): SkillHotkeysHud {
  hotkeys.setAvailableSkills([...DEMO_SORCERESS_SKILLS])
  hotkeys.leftSkillId = 47
  hotkeys.rightSkillId = 64
  hotkeys.bindings.clear()
  for (const [key, binding] of DEMO_HOTKEY_BINDINGS) hotkeys.bindings.set(key, { ...binding })
  return hotkeys
}

/** Seed Sorceress skill tree (level 85, 12 unspent, +8 all skills, demo hard points). */
export function seedDemoSkillTree(tree: SkillTreePanel): SkillTreePanel {
  tree.setClass('sor')
  tree.unspentSkillPoints = 12
  tree.bonusAllSkills = 8
  tree.characterLevel = DEMO_LEVEL
  tree.hardPoints.clear()
  tree.bonusLevels.clear()
  for (const [id, pts] of DEMO_SKILL_HARD_POINTS) tree.hardPoints.set(id, pts)
  return tree
}

/** Seed the demo Sorceress character sheet ("Isendra", level 85). */
export function seedDemoCharSheet(sheet: CharacterSheetPanel): CharacterSheetPanel {
  sheet.classCode = 'sor'
  sheet.attrs = {
    name: 'Isendra',
    classNameZh: '女法师',
    classNameEn: 'Sorceress',
    level: DEMO_LEVEL,
    xp: 1_068_078_030,
    nextLevelXp: 1_163_635_493,
    str: DEMO_STR,
    dex: DEMO_DEX,
    vit: 315,
    ene: 95,
    statPoints: 15,
    baseMaxHp: DEMO_VITALS.maxHp,
    baseMaxMana: DEMO_VITALS.maxMana,
    baseMaxStamina: DEMO_VITALS.maxStamina,
    defense: 1845,
    attackRating: 1240,
    fireRes: 75,
    coldRes: 75,
    lightRes: 75,
    poisRes: 75,
  }
  return sheet
}

/** Seed starter gear + bag items (deep-cloned), 850k gold and the level-85 Sorceress requirement context. */
export function seedDemoInventory(inv: InventoryPanel): InventoryPanel {
  for (const k of Object.keys(inv.equipped) as EquipSlotId[]) delete inv.equipped[k]
  for (const [slot, item] of Object.entries(DEMO_EQUIPPED_GEAR) as [EquipSlotId, NonNullable<(typeof DEMO_EQUIPPED_GEAR)[EquipSlotId]>][]) {
    inv.equipped[slot] = { ...item, stats: [...item.stats] }
  }
  inv.gridItems = DEMO_BAG_ITEMS.map(p => ({ ...p, item: { ...p.item, stats: [...p.item.stats] } }))
  inv.gold = 850_000
  inv.setPlayerContext({ level: DEMO_LEVEL, str: DEMO_STR, dex: DEMO_DEX, classCode: 'sor' })
  return inv
}

/** Seed all waypoints unlocked, demo quest progress, 2.5M stash gold and the level-85 Sorceress vendor context. */
export function seedDemoWorldPanels(wp: WorldPanelsHud): WorldPanelsHud {
  const allWaypointIds = Object.values(ACT_WAYPOINTS).flatMap(list => list.map(w => w.waypointId))
  wp.setUnlockedWaypoints(allWaypointIds)
  for (const q of ALL_QUESTS) wp.setQuestStatus(q.id, DEMO_COMPLETED_QUEST_IDS.has(q.id) ? 'completed' : 'active')
  wp.stashGold = 2_500_000
  wp.setPlayerContext({ level: DEMO_LEVEL, str: DEMO_STR, dex: DEMO_DEX, classCode: 'sor' })
  return wp
}

/** Seed the 4x4 belt with the legacy default potions. */
export function seedDemoBelt<T extends BeltModel>(belt: T): T {
  seedDemoBeltPotions(belt)
  return belt
}

/**
 * Seed a whole `HudManager` with the legacy demo Sorceress state: class `sor`, vitals, character sheet,
 * skill tree, quickbar, starter inventory, belt potions, waypoints/quests and stash gold.
 */
export function seedDemoHud<T extends HudManager>(hud: T): T {
  hud.setCharacterClass('sor')
  seedDemoCharSheet(hud.charSheet)
  seedDemoSkillTree(hud.skillTree)
  seedDemoHotkeys(hud.hotkeys)
  seedDemoInventory(hud.inventory)
  seedDemoWorldPanels(hud.worldPanels)
  seedDemoBelt(hud.belt)
  hud.hp = DEMO_VITALS.hp
  hud.maxHp = DEMO_VITALS.maxHp
  hud.mana = DEMO_VITALS.mana
  hud.maxMana = DEMO_VITALS.maxMana
  hud.stamina = DEMO_VITALS.stamina
  hud.maxStamina = DEMO_VITALS.maxStamina
  hud.syncPublishedState()
  return hud
}

/** Convenience constructors for standalone widgets pre-seeded with the demo state. */
export function createDemoHotkeys(): SkillHotkeysHud {
  return seedDemoHotkeys(new SkillHotkeysHud())
}
export function createDemoSkillTree(): SkillTreePanel {
  return seedDemoSkillTree(new SkillTreePanel())
}
export function createDemoCharSheet(): CharacterSheetPanel {
  return seedDemoCharSheet(new CharacterSheetPanel())
}
export function createDemoInventory(): InventoryPanel {
  return seedDemoInventory(new InventoryPanel())
}
export function createDemoWorldPanels(): WorldPanelsHud {
  return seedDemoWorldPanels(new WorldPanelsHud())
}
