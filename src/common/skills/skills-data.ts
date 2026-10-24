import { SKILLS_BY_ID } from '../data/skills-catalog.ts'

/**
 * Canonical 1.13c Skills Data & ID Lookup Table (Skills.txt).
 */
export const CANONICAL_SKILLS: readonly [number, string, string, string][] = [
  [0, "Attack", "Attack", ""],
  [1, "Kick", "Kick", ""],
  [2, "Throw", "Throw", ""],
  [3, "Unsummon", "Unsummon", ""],
  [4, "Left Hand Throw", "Left Hand Throw", ""],
  [5, "Left Hand Swing", "Left Hand Swing", ""],
  [6, "Magic Arrow", "Magic Arrow", "ama"],
  [7, "Fire Arrow", "Fire Arrow", "ama"],
  [8, "Inner Sight", "Inner Sight", "ama"],
  [9, "Critical Strike", "Critical Strike", "ama"],
  [10, "Jab", "Jab", "ama"],
  [11, "Cold Arrow", "Cold Arrow", "ama"],
  [12, "Multiple Shot", "Multiple Shot", "ama"],
  [13, "Dodge", "Dodge", "ama"],
  [14, "Power Strike", "Power Strike", "ama"],
  [15, "Poison Javelin", "Poison Javelin", "ama"],
  [16, "Exploding Arrow", "Exploding Arrow", "ama"],
  [17, "Slow Missiles", "Slow Missiles", "ama"],
  [18, "Avoid", "Avoid", "ama"],
  [19, "Impale", "Impale", "ama"],
  [20, "Lightning Bolt", "Lightning Bolt", "ama"],
  [21, "Ice Arrow", "Ice Arrow", "ama"],
  [22, "Guided Arrow", "Guided Arrow", "ama"],
  [23, "Penetrate", "Penetrate", "ama"],
  [24, "Charged Strike", "Charged Strike", "ama"],
  [25, "Plague Javelin", "Plague Javelin", "ama"],
  [26, "Strafe", "Strafe", "ama"],
  [27, "Immolation Arrow", "Immolation Arrow", "ama"],
  [28, "Dopplezon", "Decoy", "ama"],
  [29, "Evade", "Evade", "ama"],
  [30, "Fend", "Fend", "ama"],
  [31, "Freezing Arrow", "Freezing Arrow", "ama"],
  [32, "Valkyrie", "Valkyrie", "ama"],
  [33, "Pierce", "Pierce", "ama"],
  [34, "Lightning Strike", "Lightning Strike", "ama"],
  [35, "Lightning Fury", "Lightning Fury", "ama"],
  [36, "Fire Bolt", "Fire Bolt", "sor"],
  [37, "Warmth", "Warmth", "sor"],
  [38, "Charged Bolt", "Charged Bolt", "sor"],
  [39, "Ice Bolt", "Ice Bolt", "sor"],
  [40, "Frozen Armor", "Frozen Armor", "sor"],
  [41, "Inferno", "Inferno", "sor"],
  [42, "Static Field", "Static Field", "sor"],
  [43, "Telekinesis", "Telekinesis", "sor"],
  [44, "Frost Nova", "Frost Nova", "sor"],
  [45, "Ice Blast", "Ice Blast", "sor"],
  [46, "Blaze", "Blaze", "sor"],
  [47, "Fire Ball", "Fire Ball", "sor"],
  [48, "Nova", "Nova", "sor"],
  [49, "Lightning", "Lightning", "sor"],
  [50, "Shiver Armor", "Shiver Armor", "sor"],
  [51, "Fire Wall", "Fire Wall", "sor"],
  [52, "Enchant", "Enchant", "sor"],
  [53, "Chain Lightning", "Chain Lightning", "sor"],
  [54, "Teleport", "Teleport", "sor"],
  [55, "Glacial Spike", "Glacial Spike", "sor"],
  [56, "Meteor", "Meteor", "sor"],
  [57, "Thunder Storm", "Thunder Storm", "sor"],
  [58, "Energy Shield", "Energy Shield", "sor"],
  [59, "Blizzard", "Blizzard", "sor"],
  [60, "Chilling Armor", "Chilling Armor", "sor"],
  [61, "Fire Mastery", "Fire Mastery", "sor"],
  [62, "Hydra", "Hydra", "sor"],
  [63, "Lightning Mastery", "Lightning Mastery", "sor"],
  [64, "Frozen Orb", "Frozen Orb", "sor"],
  [65, "Cold Mastery", "Cold Mastery", "sor"],
  [66, "Amplify Damage", "Amplify Damage", "nec"],
  [67, "Teeth", "Teeth", "nec"],
  [68, "Bone Armor", "Bone Armor", "nec"],
  [69, "Skeleton Mastery", "Skeleton Mastery", "nec"],
  [70, "Raise Skeleton", "Raise Skeleton", "nec"],
  [71, "Dim Vision", "Dim Vision", "nec"],
  [72, "Weaken", "Weaken", "nec"],
  [73, "Poison Dagger", "Poison Dagger", "nec"],
  [74, "Corpse Explosion", "Corpse Explosion", "nec"],
  [75, "Clay Golem", "Clay Golem", "nec"],
  [76, "Iron Maiden", "Iron Maiden", "nec"],
  [77, "Terror", "Terror", "nec"],
  [78, "Bone Wall", "Bone Wall", "nec"],
  [79, "Golem Mastery", "Golem Mastery", "nec"],
  [80, "Raise Skeletal Mage", "Raise Skeletal Mage", "nec"],
  [81, "Confuse", "Confuse", "nec"],
  [82, "Life Tap", "Life Tap", "nec"],
  [83, "Poison Explosion", "Poison Explosion", "nec"],
  [84, "Bone Spear", "Bone Spear", "nec"],
  [85, "BloodGolem", "Blood Golem", "nec"],
  [86, "Attract", "Attract", "nec"],
  [87, "Decrepify", "Decrepify", "nec"],
  [88, "Bone Prison", "Bone Prison", "nec"],
  [89, "Summon Resist", "Summon Resist", "nec"],
  [90, "IronGolem", "Iron Golem", "nec"],
  [91, "Lower Resist", "Lower Resist", "nec"],
  [92, "Poison Nova", "Poison Nova", "nec"],
  [93, "Bone Spirit", "Bone Spirit", "nec"],
  [94, "FireGolem", "Fire Golem", "nec"],
  [95, "Revive", "Revive", "nec"],
  [96, "Sacrifice", "Sacrifice", "pal"],
  [97, "Smite", "Smite", "pal"],
  [98, "Might", "Might", "pal"],
  [99, "Prayer", "Prayer", "pal"],
  [100, "Resist Fire", "Resist Fire", "pal"],
  [101, "Holy Bolt", "Holy Bolt", "pal"],
  [102, "Holy Fire", "Holy Fire", "pal"],
  [103, "Thorns", "Thorns", "pal"],
  [104, "Defiance", "Defiance", "pal"],
  [105, "Resist Cold", "Resist Cold", "pal"],
  [106, "Zeal", "Zeal", "pal"],
  [107, "Charge", "Charge", "pal"],
  [108, "Blessed Aim", "Blessed Aim", "pal"],
  [109, "Cleansing", "Cleansing", "pal"],
  [110, "Resist Lightning", "Resist Lightning", "pal"],
  [111, "Vengeance", "Vengeance", "pal"],
  [112, "Blessed Hammer", "Blessed Hammer", "pal"],
  [113, "Concentration", "Concentration", "pal"],
  [114, "Holy Freeze", "Holy Freeze", "pal"],
  [115, "Vigor", "Vigor", "pal"],
  [116, "Conversion", "Conversion", "pal"],
  [117, "Holy Shield", "Holy Shield", "pal"],
  [118, "Holy Shock", "Holy Shock", "pal"],
  [119, "Sanctuary", "Sanctuary", "pal"],
  [120, "Meditation", "Meditation", "pal"],
  [121, "Fist of the Heavens", "Fist of the Heavens", "pal"],
  [122, "Fanaticism", "Fanaticism", "pal"],
  [123, "Conviction", "Conviction", "pal"],
  [124, "Redemption", "Redemption", "pal"],
  [125, "Salvation", "Salvation", "pal"],
  [126, "Bash", "Bash", "bar"],
  [127, "Sword Mastery", "Sword Mastery", "bar"],
  [128, "Axe Mastery", "Axe Mastery", "bar"],
  [129, "Mace Mastery", "Mace Mastery", "bar"],
  [130, "Howl", "Howl", "bar"],
  [131, "Find Potion", "Find Potion", "bar"],
  [132, "Leap", "Leap", "bar"],
  [133, "Double Swing", "Double Swing", "bar"],
  [134, "Pole Arm Mastery", "Pole Arm Mastery", "bar"],
  [135, "Throwing Mastery", "Throwing Mastery", "bar"],
  [136, "Spear Mastery", "Spear Mastery", "bar"],
  [137, "Taunt", "Taunt", "bar"],
  [138, "Shout", "Shout", "bar"],
  [139, "Stun", "Stun", "bar"],
  [140, "Double Throw", "Double Throw", "bar"],
  [141, "Increased Stamina", "Increased Stamina", "bar"],
  [142, "Find Item", "Find Item", "bar"],
  [143, "Leap Attack", "Leap Attack", "bar"],
  [144, "Concentrate", "Concentrate", "bar"],
  [145, "Iron Skin", "Iron Skin", "bar"],
  [146, "Battle Cry", "Battle Cry", "bar"],
  [147, "Frenzy", "Frenzy", "bar"],
  [148, "Increased Speed", "Increased Speed", "bar"],
  [149, "Battle Orders", "Battle Orders", "bar"],
  [150, "Grim Ward", "Grim Ward", "bar"],
  [151, "Whirlwind", "Whirlwind", "bar"],
  [152, "Berserk", "Berserk", "bar"],
  [153, "Natural Resistance", "Natural Resistance", "bar"],
  [154, "War Cry", "War Cry", "bar"],
  [155, "Battle Command", "Battle Command", "bar"],
  [197, "DiabWall", "Firestorm", ""],
  [217, "Scroll of Identify", "Scroll of Identify", ""],
  [218, "Book of Identify", "Tome of Identify", ""],
  [219, "Scroll of Townportal", "Scroll of Townportal", ""],
  [220, "Book of Townportal", "Tome of Townportal", ""],
  [221, "Raven", "Raven", "dru"],
  [222, "Plague Poppy", "Poison Creeper", "dru"],
  [223, "Wearwolf", "Werewolf", "dru"],
  [224, "Shape Shifting", "Lycanthropy", "dru"],
  [225, "Firestorm", "Firestorm", "dru"],
  [226, "Oak Sage", "Oak Sage", "dru"],
  [227, "Summon Spirit Wolf", "Summon Spirit Wolf", "dru"],
  [228, "Wearbear", "Werebear", "dru"],
  [229, "Molten Boulder", "Molten Boulder", "dru"],
  [230, "Arctic Blast", "Arctic Blast", "dru"],
  [231, "Cycle of Life", "Carrion Vine", "dru"],
  [232, "Feral Rage", "Feral Rage", "dru"],
  [233, "Maul", "Maul", "dru"],
  [234, "Eruption", "Fissure", "dru"],
  [235, "Cyclone Armor", "Cyclone Armor", "dru"],
  [236, "Heart of Wolverine", "Heart of Wolverine", "dru"],
  [237, "Summon Fenris", "Summon Dire Wolf", "dru"],
  [238, "Rabies", "Rabies", "dru"],
  [239, "Fire Claws", "Fire Claws", "dru"],
  [240, "Twister", "Twister", "dru"],
  [241, "Vines", "Solar Creeper", "dru"],
  [242, "Hunger", "Hunger", "dru"],
  [243, "Shock Wave", "Shock Wave", "dru"],
  [244, "Volcano", "Volcano", "dru"],
  [245, "Tornado", "Tornado", "dru"],
  [246, "Spirit of Barbs", "Spirit of Barbs", "dru"],
  [247, "Summon Grizzly", "Summon Grizzly", "dru"],
  [248, "Fury", "Fury", "dru"],
  [249, "Armageddon", "Armageddon", "dru"],
  [250, "Hurricane", "Hurricane", "dru"],
  [251, "Fire Trauma", "Fire Blast", "ass"],
  [252, "Claw Mastery", "Claw Mastery", "ass"],
  [253, "Psychic Hammer", "Psychic Hammer", "ass"],
  [254, "Tiger Strike", "Tiger Strike", "ass"],
  [255, "Dragon Talon", "Dragon Talon", "ass"],
  [256, "Shock Field", "Shock Web", "ass"],
  [257, "Blade Sentinel", "Blade Sentinel", "ass"],
  [258, "Quickness", "Burst of Speed", "ass"],
  [259, "Fists of Fire", "Fists of Fire", "ass"],
  [260, "Dragon Claw", "Dragon Claw", "ass"],
  [261, "Charged Bolt Sentry", "Charged Bolt Sentry", "ass"],
  [262, "Wake of Fire Sentry", "Wake of Fire", "ass"],
  [263, "Weapon Block", "Weapon Block", "ass"],
  [264, "Cloak of Shadows", "Cloak of Shadows", "ass"],
  [265, "Cobra Strike", "Cobra Strike", "ass"],
  [266, "Blade Fury", "Blade Fury", "ass"],
  [267, "Fade", "Fade", "ass"],
  [268, "Shadow Warrior", "Shadow Warrior", "ass"],
  [269, "Claws of Thunder", "Claws of Thunder", "ass"],
  [270, "Dragon Tail", "Dragon Tail", "ass"],
  [271, "Lightning Sentry", "Lightning Sentry", "ass"],
  [272, "Inferno Sentry", "Wake of Inferno", "ass"],
  [273, "Mind Blast", "Mind Blast", "ass"],
  [274, "Blades of Ice", "Blades of Ice", "ass"],
  [275, "Dragon Flight", "Dragon Flight", "ass"],
  [276, "Death Sentry", "Death Sentry", "ass"],
  [277, "Blade Shield", "Blade Shield", "ass"],
  [278, "Venom", "Venom", "ass"],
  [279, "Shadow Master", "Shadow Master", "ass"],
  [280, "Royal Strike", "Phoenix Strike", "ass"],
  [350, "Delerium Change", "Delirium", ""],
]

const CLASS_ONLY_LABELS: Record<string, string> = {
  ama: '(Amazon Only)',
  sor: '(Sorceress Only)',
  nec: '(Necromancer Only)',
  pal: '(Paladin Only)',
  bar: '(Barbarian Only)',
  dru: '(Druid Only)',
  ass: '(Assassin Only)',
}

export interface CanonicalSkillMeta {
  readonly id: number
  readonly name: string
  readonly classCode: string
  readonly classOnly?: string | undefined
  readonly reqlevel: number
}

const SKILL_LOOKUP_BY_ID = new Map<number, { name: string; classOnly?: string }>()
const SKILL_LOOKUP_BY_NAME = new Map<string, { name: string; classOnly?: string }>()
const SKILL_META_BY_ID = new Map<number, CanonicalSkillMeta>()
const SKILL_META_BY_NAME = new Map<string, CanonicalSkillMeta>()

for (const [id, rawName, displayName, cls] of CANONICAL_SKILLS) {
  const classOnly = cls ? CLASS_ONLY_LABELS[cls] : undefined
  const info = classOnly ? { name: displayName, classOnly } : { name: displayName }
  SKILL_LOOKUP_BY_ID.set(id, info)
  SKILL_LOOKUP_BY_NAME.set(rawName.toLowerCase(), info)
  SKILL_LOOKUP_BY_NAME.set(displayName.toLowerCase(), info)

  const catalogEntry = SKILLS_BY_ID[id]
  const reqlevel = catalogEntry?.reqlevel ?? 0
  const meta: CanonicalSkillMeta = {
    id,
    name: displayName,
    classCode: cls,
    ...(classOnly ? { classOnly } : {}),
    reqlevel,
  }
  SKILL_META_BY_ID.set(id, meta)
  SKILL_META_BY_NAME.set(rawName.toLowerCase(), meta)
  SKILL_META_BY_NAME.set(displayName.toLowerCase(), meta)
}

/**
 * Resolves a skill parameter (numeric ID or internal name from Skills.txt)
 * into its 1.13c canonical English display name and optional class restriction.
 */
export function resolveSkillInfo(par: string | number | undefined): { name: string; classOnly?: string } {
  if (par === undefined || par === '') return { name: 'Skill' }
  const str = String(par).trim()
  const num = Number(str)
  if (!Number.isNaN(num) && SKILL_LOOKUP_BY_ID.has(num)) {
    return SKILL_LOOKUP_BY_ID.get(num)!
  }
  const byName = SKILL_LOOKUP_BY_NAME.get(str.toLowerCase())
  if (byName) return byName
  return { name: str }
}

/**
 * Resolves a skill parameter (numeric ID or internal/display name from Skills.txt)
 * into its 1.13c canonical metadata including `reqlevel` (`wReqLevel` in `D2SkillsTxt`)
 * and `classCode` (`nCharClass`), used by `ITEMS_GetRequiredLevel` (0x6FD9A3F0).
 */
export function resolveSkillMeta(par: string | number | undefined): CanonicalSkillMeta | undefined {
  if (par === undefined || par === '') return undefined
  const str = String(par).trim()
  const num = Number(str)
  if (!Number.isNaN(num) && SKILL_META_BY_ID.has(num)) {
    return SKILL_META_BY_ID.get(num)
  }
  return SKILL_META_BY_NAME.get(str.toLowerCase())
}

/**
 * Canonical 1.13c skilltab mapping (par 0..20 from CharStats.txt StrSkillTab1..3 + StrClassOnly).
 */
export const CANONICAL_SKILL_TABS: Record<number, string> = {
  0: 'Bow and Crossbow Skills (Amazon Only)',
  1: 'Passive and Magic Skills (Amazon Only)',
  2: 'Javelin and Spear Skills (Amazon Only)',
  3: 'Fire Skills (Sorceress Only)',
  4: 'Lightning Skills (Sorceress Only)',
  5: 'Cold Skills (Sorceress Only)',
  6: 'Curses (Necromancer Only)',
  7: 'Poison and Bone Skills (Necromancer Only)',
  8: 'Summoning Skills (Necromancer Only)',
  9: 'Combat Skills (Paladin Only)',
  10: 'Offensive Auras (Paladin Only)',
  11: 'Defensive Auras (Paladin Only)',
  12: 'Combat Skills (Barbarian Only)',
  13: 'Masteries (Barbarian Only)',
  14: 'Warcries (Barbarian Only)',
  15: 'Summoning Skills (Druid Only)',
  16: 'Shape Shifting Skills (Druid Only)',
  17: 'Elemental Skills (Druid Only)',
  18: 'Traps (Assassin Only)',
  19: 'Shadow Disciplines (Assassin Only)',
  20: 'Martial Arts (Assassin Only)',
}

/**
 * 1.13c `item_addskill_tab` (stat 188) stat-param encoding.
 *
 * The `skilltab` property `par` (MagicPrefix/Runes/UniqueItems/... `modNparam`, linear `class * 3 + tab`, 0..20,
 * the key of {@link CANONICAL_SKILL_TABS}) is NOT what the stat list carries:
 * - `D2Common.dll` property func 10 (`0x6fd98470`): `idiv 3; lea eax,[edx+eax*8]` -> stat param = `par % 3 + 8 * (par / 3)`.
 * - `D2Client.dll` descfunc 14 (`0x6fb052e2`): `class = param >> 3`, `tab = param & 7`, rejects `tab >= 3`, prints
 *   `CharStats[class].StrSkillTab{tab+1}` (+ `StrClassOnly`).
 * - `D2Common.dll` `SKILLS_GetSkillLevel` reads stat 188 at `SkillDesc.SkillPage - 1 + 8 * classId`.
 * ItemStatCost.txt: Save Param Bits 16 / Send Param Bits 6, so real 1.13c items (D2GS 0x9C, .d2s) carry the packed form.
 */
export const SKILL_TAB_CLASS_COUNT = 7
export const SKILL_TABS_PER_CLASS = 3

/** Linear `skilltab` par (0..20) -> stat 188 param (`tab + 8 * class`). Throws on out-of-range par. */
export function encodeSkillTabParam(par: number): number {
  if (!Number.isInteger(par) || par < 0 || par >= SKILL_TAB_CLASS_COUNT * SKILL_TABS_PER_CLASS) {
    throw new RangeError(`skilltab par ${par} out of range 0..${SKILL_TAB_CLASS_COUNT * SKILL_TABS_PER_CLASS - 1}`)
  }
  return (par % SKILL_TABS_PER_CLASS) + 8 * Math.trunc(par / SKILL_TABS_PER_CLASS)
}

/**
 * Stat 188 param (`tab + 8 * class`) -> linear `skilltab` par (0..20), or `undefined` when D2Client would print
 * nothing (tab >= 3 or class without a CharStats row).
 */
export function decodeSkillTabParam(param: number): number | undefined {
  if (!Number.isInteger(param) || param < 0) return undefined
  const classId = param >> 3
  const tab = param & 7
  if (tab >= SKILL_TABS_PER_CLASS || classId >= SKILL_TAB_CLASS_COUNT) return undefined
  return classId * SKILL_TABS_PER_CLASS + tab
}

/** Stat 188 param for a skill of `classId` on SkillDesc page `tabIndex` (0..2 = SkillPage - 1). */
export function skillTabStatParam(classId: number, tabIndex: number): number {
  return (classId << 3) | (tabIndex & 7)
}

/**
 * Canonical 1.13c MonStats.txt hcIdx -> NameStr for reanimate property.
 */
export const CANONICAL_REANIMATE_MONSTERS: Record<number, string> = {
  0: 'Skeleton',
  1: 'Returned',
  2: 'Bone Warrior',
  3: 'Burning Dead',
  4: 'Horror',
  5: 'Zombie',
}

