/**
 * Pure skill metadata, canonical 1.13c `skills.txt` / `skilldesc.txt` table columns,
 * passive/aura/left-click skill predicates, and display helpers shared between
 * `src/common/`, `src/server/`, and `src/client/`.
 */

import {
  RAW_ARMOR,
  RAW_ITEM_TYPES,
  RAW_MISC,
  RAW_WEAPONS,
} from '../data/canonical-drop-data.ts'
import { SKILLS_BY_ID, SKILLS_CATALOG } from '../data/skills-catalog.ts'
import { getDefaultTblLang, type TblLang } from '../formats/tbl.ts'
import { isA, type ItemTypeTable, parseItemTypesTable } from '../items/item-types.ts'
import type { CharacterClassCode } from '../units/classes.ts'
import { cell, parseTable } from '../world/acts.ts'

export type D2ColorCode =
  | 'white'
  | 'red'
  | 'green'
  | 'blue'
  | 'gold'
  | 'gray'
  | 'black'
  | 'tan'
  | 'orange'
  | 'yellow'
  | 'darkgreen'
  | 'purple'
  | 'brightgreen'

export interface FormattedTooltipLine {
  readonly text: string
  readonly color: D2ColorCode
  readonly font: 'fontexocet10' | 'font8'
  readonly align?: 'left' | 'center'
}

export interface HotkeySkillEntry {
  readonly skillId: number
  readonly name: string
  readonly nameZh: string
  readonly level: number
  readonly manaCost: number
  readonly leftUsable: boolean
  readonly rightUsable: boolean
  readonly isPassive?: boolean
  readonly isAura?: boolean
  readonly charges?: number
  readonly maxCharges?: number
  readonly cooldownMs?: number
  readonly listRow?: number
  readonly reqlevel?: number
  readonly isItemSkill?: boolean
  readonly tabIndex?: number
}

/**
 * Canonical 1.13c `skills.txt` + `skilldesc.txt` row metadata.
 */
export interface SkillTableMeta {
  readonly skillId: number
  readonly skilldesc: string
  readonly passive: 0 | 1
  readonly leftskill: 0 | 1
  readonly aura: 0 | 1
  readonly maxlvl: number
  readonly restrict?: 0 | 1 | 2
  readonly state1?: string
  readonly state2?: string
  readonly state3?: string
  readonly itypea1?: string
  readonly itypeb1?: string
  readonly etypea1?: string
  readonly weapsel?: number
  readonly checkfunc?: number
  readonly skillPage: number
  readonly listRow: number
  readonly listPool: number
  readonly iconCel: number
  readonly strNameKey: string
  readonly strShortKey: string
  readonly strLongKey: string
  readonly strAltKey: string
  readonly descline1?: number
  readonly desctexta1?: string
}

/**
 * Canonical `.tbl` strings for skill tooltips (`string.tbl`, `expansionstring.tbl`, `patchstring.tbl`).
 */
export const SKILL_TBL_STRINGS = {
  ENG: {
    StrSkill1: 'Next Level',
    StrSkill2: 'Current Skill Level: ',
    StrSkill3: 'Mana Cost: ',
    StrSkill17: 'First Level',
    StrSkill18: 'Required Level:',
    Sksyn: '%s Receives Bonuses From:',
    skilldesc4: 'Quantity ',
  },
  CHI: {
    StrSkill1: '下一等級',
    StrSkill2: '目前技能等級：',
    StrSkill3: '法力消耗：',
    StrSkill17: '第一級',
    StrSkill18: '需要等級：',
    Sksyn: '額外的對%s',
    skilldesc4: '數量 ',
  },
} as const

/**
 * Canonical `.tbl` strings (`strName`, `strShort`, `strLong`, `strAlt`) for generic & item skills (`#0..#5`, `#217..#220`, `#350`).
 */
export const GENERIC_SKILL_TBL_STRINGS: Readonly<
  Record<
    number,
    {
      readonly nameEn: string
      readonly nameZh: string
      readonly shortEn: string
      readonly shortZh: string
      readonly longEn: string
      readonly longZh: string
    }
  >
> = {
  0: {
    nameEn: 'Attack',
    nameZh: '攻擊',
    shortEn: 'normal attack',
    shortZh: '一般攻擊',
    longEn: 'normal attack',
    longZh: '一般攻擊',
  },
  1: {
    nameEn: 'Kick',
    nameZh: '腳踢',
    shortEn: 'kick target',
    shortZh: '腳踢目標',
    longEn: 'kick target',
    longZh: '腳踢目標',
  },
  2: {
    nameEn: 'Throw',
    nameZh: '投擲',
    shortEn: 'throw equipped item',
    shortZh: '投擲裝備的物品',
    longEn: 'throw equipped item',
    longZh: '投擲裝備的物品',
  },
  3: {
    nameEn: 'Unsummon',
    nameZh: '取消召喚',
    shortEn: 'releases a summoned creature',
    shortZh: '釋放掉你所控制生物中，',
    longEn: 'of one of your creatures\nrelinquishes control',
    longZh: '其中一位召喚生物\n放棄對它的控制',
  },
  4: {
    nameEn: 'Left Hand Throw',
    nameZh: '左手投擲',
    shortEn: 'throw left hand item',
    shortZh: '丟出左手的物品',
    longEn: 'throw left hand item',
    longZh: '丟出左手的物品',
  },
  5: {
    nameEn: 'Left Hand Swing',
    nameZh: '左手揮動',
    shortEn: 'swing left hand weapon',
    shortZh: '揮動左手的武器',
    longEn: 'swing left hand weapon',
    longZh: '揮動左手的武器',
  },
  217: {
    nameEn: 'Scroll of Identify',
    nameZh: '辨視卷軸',
    shortEn: "identify a magic item's properties",
    shortZh: '辨視一個魔法物品的屬性',
    longEn: "identify a magic item's properties",
    longZh: '辨視一個魔法物品的屬性',
  },
  218: {
    nameEn: 'Tome of Identify',
    nameZh: '辨視之書',
    shortEn: "identify a magic item's properties",
    shortZh: '辨視一個魔法物品的屬性',
    longEn: "identify a magic item's properties",
    longZh: '辨視一個魔法物品的屬性',
  },
  219: {
    nameEn: 'Scroll of Townportal',
    nameZh: '城鎮傳送卷軸',
    shortEn: 'create a magic portal to the nearest town',
    shortZh: '創造出一個魔法傳送門，通往最近的城市',
    longEn: 'create a magic portal to the nearest town',
    longZh: '創造出一個魔法傳送門，通往最近的城市',
  },
  220: {
    nameEn: 'Tome of Townportal',
    nameZh: '城鎮傳送之書',
    shortEn: 'create a magic portal to the nearest town',
    shortZh: '創造出一個魔法傳送門，通往最近的城市',
    longEn: 'create a magic portal to the nearest town',
    longZh: '創造出一個魔法傳送門，通往最近的城市',
  },
  350: {
    nameEn: 'Delerium Change',
    nameZh: 'Delerium Change',
    shortEn: '',
    shortZh: '',
    longEn: '',
    longZh: '',
  },
}

const CANONICAL_PASSIVE_COLUMN_ONE: ReadonlySet<number> = new Set<number>([
  9, 13, 18, 23, 29, 33,
  37, 61, 63, 65,
  69, 79, 89,
  127, 128, 129, 134, 135, 136, 141, 145, 148, 153,
  224,
  252, 263,
])

const CANONICAL_LEFTSKILL_COLUMN_ONE: ReadonlySet<number> = new Set<number>([
  0, 2, 4, 5,
  6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 30, 31, 33, 34, 35,
  36, 37, 38, 39, 41, 45, 47, 49, 53, 55, 61, 63, 64, 65,
  67, 73, 79, 84, 89, 93,
  96, 97, 101, 106, 107, 111, 112, 116, 121,
  126, 132, 133, 139, 140, 143, 144, 147, 151, 152,
  225, 229, 230, 232, 233, 238, 239, 240, 242, 243, 245, 248,
  251, 254, 255, 256, 257, 259, 260, 263, 265, 266, 269, 270, 274, 275, 280,
])

const CANONICAL_AURA_COLUMN_ONE: ReadonlySet<number> = new Set<number>([
  98, 99, 100, 102, 103, 104, 105, 108, 109, 110,
  113, 114, 115, 118, 119, 120, 122, 123, 124, 125,
  127, 128, 129,
])

const CANONICAL_CLASS_SKILL_ICON_CEL: Readonly<Record<number, number>> = {
  6: 0, 7: 2, 8: 4, 9: 6, 10: 8, 11: 10, 12: 12, 13: 14, 14: 16, 15: 18,
  16: 20, 17: 22, 18: 24, 19: 26, 20: 28, 21: 30, 22: 32, 23: 34, 24: 36, 25: 38,
  26: 40, 27: 42, 28: 44, 29: 46, 30: 48, 31: 50, 32: 52, 33: 54, 34: 56, 35: 58,
  36: 0, 37: 2, 38: 4, 39: 6, 40: 8, 41: 10, 42: 12, 43: 14, 44: 16, 45: 18,
  46: 20, 47: 22, 48: 24, 49: 26, 50: 28, 51: 30, 52: 32, 53: 34, 54: 36, 55: 38,
  56: 40, 57: 42, 58: 44, 59: 46, 60: 48, 61: 50, 62: 52, 63: 54, 64: 56, 65: 58,
  66: 0, 67: 2, 68: 4, 69: 6, 70: 8, 71: 10, 72: 12, 73: 14, 74: 16, 75: 18,
  76: 20, 77: 22, 78: 24, 79: 26, 80: 28, 81: 30, 82: 32, 83: 34, 84: 36, 85: 38,
  86: 40, 87: 42, 88: 44, 89: 46, 90: 48, 91: 50, 92: 52, 93: 54, 94: 56, 95: 58,
  96: 0, 97: 2, 98: 4, 99: 6, 100: 8, 101: 10, 102: 12, 103: 14, 104: 16, 105: 18,
  106: 20, 107: 22, 108: 24, 109: 38, 110: 28, 111: 40, 112: 32, 113: 34, 114: 36, 115: 26,
  116: 30, 117: 42, 118: 44, 119: 46, 120: 48, 121: 50, 122: 52, 123: 56, 124: 54, 125: 58,
  126: 0, 127: 2, 128: 4, 129: 6, 130: 8, 131: 10, 132: 12, 133: 14, 134: 16, 135: 18,
  136: 20, 137: 22, 138: 24, 139: 26, 140: 28, 141: 30, 142: 32, 143: 34, 144: 36, 145: 38,
  146: 40, 147: 42, 148: 44, 149: 46, 150: 48, 151: 50, 152: 52, 153: 54, 154: 56, 155: 58,
  221: 0, 222: 2, 223: 20, 224: 52, 225: 32, 226: 16, 227: 6, 228: 22, 229: 34, 230: 36,
  231: 8, 232: 54, 233: 56, 234: 38, 235: 40, 236: 10, 237: 12, 238: 24, 239: 26, 240: 42,
  241: 14, 242: 58, 243: 28, 244: 44, 245: 46, 246: 4, 247: 18, 248: 30, 249: 50, 250: 48,
  251: 0, 252: 20, 253: 22, 254: 40, 255: 42, 256: 2, 257: 4, 258: 36, 259: 44, 260: 46,
  261: 6, 262: 8, 263: 26, 264: 24, 265: 50, 266: 10, 267: 30, 268: 38, 269: 58, 270: 48,
  271: 12, 272: 14, 273: 34, 274: 52, 275: 54, 276: 16, 277: 18, 278: 28, 279: 32, 280: 56,
}

const CANONICAL_CLASS_SKILL_WEAPON_META: Readonly<
  Record<
    number,
    {
      readonly itypea1?: string
      readonly itypeb1?: string
      readonly etypea1?: string
      readonly weapsel?: number
      readonly checkfunc?: number
    }
  >
> = {
  // Amazon Bow & Crossbow (miss, checkfunc=1)
  6: { itypea1: 'miss', checkfunc: 1 },
  7: { itypea1: 'miss', checkfunc: 1 },
  11: { itypea1: 'miss', checkfunc: 1 },
  12: { itypea1: 'miss', checkfunc: 1 },
  16: { itypea1: 'miss', checkfunc: 1 },
  21: { itypea1: 'miss', checkfunc: 1 },
  22: { itypea1: 'miss', checkfunc: 1 },
  26: { itypea1: 'miss', checkfunc: 1 },
  27: { itypea1: 'miss', checkfunc: 1 },
  31: { itypea1: 'miss', checkfunc: 1 },
  // Amazon Spear & Javelin (spea / jave)
  10: { itypea1: 'spea' },
  14: { itypea1: 'spea' },
  15: { itypea1: 'jave' },
  19: { itypea1: 'spea' },
  20: { itypea1: 'jave' },
  24: { itypea1: 'spea' },
  25: { itypea1: 'jave' },
  30: { itypea1: 'spea' },
  34: { itypea1: 'spea' },
  35: { itypea1: 'jave' },
  // Necromancer Poison Dagger
  73: { itypea1: 'knif' },
  // Paladin Combat & Shield Skills
  96: { itypea1: 'mele' },
  97: { itypea1: 'shld', weapsel: 2, checkfunc: 4 },
  106: { itypea1: 'mele' },
  107: { itypea1: 'mele' },
  111: { itypea1: 'mele' },
  116: { itypea1: 'mele' },
  117: { itypea1: 'shld' },
  123: { itypea1: 'mele' },
  // Barbarian Combat & Masteries
  126: { itypea1: 'mele' },
  127: { itypea1: 'swor' },
  128: { itypea1: 'axe' },
  129: { itypea1: 'blun' },
  133: { itypea1: 'mele', itypeb1: 'mele', weapsel: 3 },
  134: { itypea1: 'pole' },
  135: { itypea1: 'thro' },
  136: { itypea1: 'spea' },
  139: { itypea1: 'mele' },
  140: { itypea1: 'thro', itypeb1: 'thro', weapsel: 3, checkfunc: 5 },
  143: { itypea1: 'mele' },
  144: { itypea1: 'mele' },
  147: { itypea1: 'mele', itypeb1: 'mele', weapsel: 3 },
  151: { itypea1: 'mele' },
  152: { itypea1: 'mele' },
  // Assassin Martial Arts & Passives
  252: { itypea1: 'h2h' },
  254: { itypea1: 'mele' },
  259: { itypea1: 'h2h' },
  260: { itypea1: 'h2h', itypeb1: 'h2h', weapsel: 3 },
  263: { itypea1: 'h2h', itypeb1: 'h2h', weapsel: 2 },
  265: { itypea1: 'mele' },
  269: { itypea1: 'h2h' },
  274: { itypea1: 'h2h' },
  280: { itypea1: 'mele' },
}

const CANONICAL_SKILL_RESTRICT_META: Readonly<
  Record<
    number,
    {
      readonly restrict: 0 | 1 | 2
      readonly state1?: string
      readonly state2?: string
      readonly state3?: string
    }
  >
> = {
  // Skills.txt restrict = 1 without State1..3 (usable in human and ANY shapeshift state including Delirium)
  0: { restrict: 1 },
  3: { restrict: 1 },
  217: { restrict: 1 },
  218: { restrict: 1 },
  219: { restrict: 1 },
  220: { restrict: 1 },
  // Skills.txt restrict = 1 with State1..3 (usable in human AND listed shapeshift states, blocked in Delirium)
  221: { restrict: 1, state1: 'wolf', state2: 'bear' },
  222: { restrict: 1, state1: 'wolf', state2: 'bear' },
  223: { restrict: 1, state1: 'wolf' }, // Werewolf (cast in human to shift, or in wolf to unshift)
  226: { restrict: 1, state1: 'wolf', state2: 'bear' },
  227: { restrict: 1, state1: 'wolf', state2: 'bear' },
  228: { restrict: 1, state1: 'bear' }, // Werebear (cast in human to shift, or in bear to unshift)
  231: { restrict: 1, state1: 'wolf', state2: 'bear' },
  236: { restrict: 1, state1: 'wolf', state2: 'bear' },
  237: { restrict: 1, state1: 'wolf', state2: 'bear' },
  241: { restrict: 1, state1: 'wolf', state2: 'bear' },
  246: { restrict: 1, state1: 'wolf', state2: 'bear' },
  247: { restrict: 1, state1: 'wolf', state2: 'bear' },
  249: { restrict: 1, state1: 'wolf', state2: 'bear' }, // Armageddon
  // Skills.txt restrict = 2 (usable ONLY when in one of state1..state3)
  232: { restrict: 2, state1: 'wolf' }, // Feral Rage
  233: { restrict: 2, state1: 'bear' }, // Maul
  238: { restrict: 2, state1: 'wolf' }, // Rabies
  239: { restrict: 2, state1: 'wolf', state2: 'bear' }, // Fire Claws
  242: { restrict: 2, state1: 'wolf', state2: 'bear' }, // Hunger
  243: { restrict: 2, state1: 'bear' }, // Shock Wave
  248: { restrict: 2, state1: 'wolf' }, // Fury
}

function buildSkillsTableMeta(): Readonly<Record<number, SkillTableMeta>> {
  const table: Record<number, SkillTableMeta> = {
    0: {
      skillId: 0,
      skilldesc: 'attack',
      passive: 0,
      leftskill: 1,
      aura: 0,
      maxlvl: 0,
      restrict: 1,
      itypea1: 'weap',
      etypea1: 'tpot',
      checkfunc: 1,
      skillPage: 0,
      listRow: 0,
      listPool: 0,
      iconCel: 2,
      strNameKey: 'skillname0',
      strShortKey: 'skillsd0',
      strLongKey: 'skillld0',
      strAltKey: 'skillan0',
    },
    1: {
      skillId: 1,
      skilldesc: 'kick',
      passive: 0,
      leftskill: 0,
      aura: 0,
      maxlvl: 0,
      restrict: 0,
      weapsel: 4,
      skillPage: 0,
      listRow: -1,
      listPool: 0,
      iconCel: 0,
      strNameKey: 'skillname1',
      strShortKey: 'skillsd1',
      strLongKey: 'skillld1',
      strAltKey: 'skillan1',
    },
    2: {
      skillId: 2,
      skilldesc: 'throw',
      passive: 0,
      leftskill: 1,
      aura: 0,
      maxlvl: 0,
      restrict: 0,
      itypea1: 'thro',
      skillPage: 0,
      listRow: 0,
      listPool: 0,
      iconCel: 6,
      strNameKey: 'skillname2',
      strShortKey: 'skillsd2',
      strLongKey: 'skillld2',
      strAltKey: 'skillan2',
    },
    3: {
      skillId: 3,
      skilldesc: 'unsummon',
      passive: 0,
      leftskill: 0,
      aura: 0,
      maxlvl: 0,
      restrict: 1,
      skillPage: 0,
      listRow: 0,
      listPool: 0,
      iconCel: 4,
      strNameKey: 'skillname3',
      strShortKey: 'skillsd3',
      strLongKey: 'skillld3',
      strAltKey: 'skillan3',
    },
    4: {
      skillId: 4,
      skilldesc: 'left hand throw',
      passive: 0,
      leftskill: 1,
      aura: 0,
      maxlvl: 0,
      restrict: 0,
      itypea1: 'thro',
      weapsel: 1,
      skillPage: 0,
      listRow: 0,
      listPool: 0,
      iconCel: 12,
      strNameKey: 'skillname4',
      strShortKey: 'skillsd4',
      strLongKey: 'skillld4',
      strAltKey: 'skillan4',
    },
    5: {
      skillId: 5,
      skilldesc: 'left hand swing',
      passive: 0,
      leftskill: 1,
      aura: 0,
      maxlvl: 0,
      restrict: 0,
      itypea1: 'weap',
      etypea1: 'tpot',
      weapsel: 1,
      skillPage: 0,
      listRow: -1,
      listPool: 0,
      iconCel: 10,
      strNameKey: 'skillname5',
      strShortKey: 'skillsd5',
      strLongKey: 'skillld5',
      strAltKey: 'skillan5',
    },
    217: {
      skillId: 217,
      skilldesc: 'scroll of identify',
      passive: 0,
      leftskill: 0,
      aura: 0,
      maxlvl: 0,
      restrict: 1,
      skillPage: 0,
      listRow: 4,
      listPool: 1,
      iconCel: 14,
      strNameKey: 'skillname217',
      strShortKey: 'skillsd217',
      strLongKey: 'skillld217',
      strAltKey: 'skillan217',
      descline1: 53,
      desctexta1: 'isc',
    },
    218: {
      skillId: 218,
      skilldesc: 'book of identify',
      passive: 0,
      leftskill: 0,
      aura: 0,
      maxlvl: 0,
      restrict: 1,
      skillPage: 0,
      listRow: 4,
      listPool: 0,
      iconCel: 14,
      strNameKey: 'skillname218',
      strShortKey: 'skillsd218',
      strLongKey: 'skillld218',
      strAltKey: 'skillan218',
      descline1: 55,
      desctexta1: 'ibk',
    },
    219: {
      skillId: 219,
      skilldesc: 'scroll of townportal',
      passive: 0,
      leftskill: 0,
      aura: 0,
      maxlvl: 0,
      restrict: 1,
      skillPage: 0,
      listRow: 4,
      listPool: 2,
      iconCel: 18,
      strNameKey: 'skillname219',
      strShortKey: 'skillsd219',
      strLongKey: 'skillld219',
      strAltKey: 'skillan219',
      descline1: 54,
      desctexta1: 'tsc',
    },
    220: {
      skillId: 220,
      skilldesc: 'book of townportal',
      passive: 0,
      leftskill: 0,
      aura: 0,
      maxlvl: 0,
      restrict: 1,
      skillPage: 0,
      listRow: 4,
      listPool: 0,
      iconCel: 18,
      strNameKey: 'skillname220',
      strShortKey: 'skillsd220',
      strLongKey: 'skillld220',
      strAltKey: 'skillan220',
      descline1: 56,
      desctexta1: 'tbk',
    },
    350: {
      skillId: 350,
      skilldesc: 'delerium change',
      passive: 0,
      leftskill: 0,
      aura: 0,
      maxlvl: 0,
      restrict: 0,
      skillPage: 0,
      listRow: 0,
      listPool: 0,
      iconCel: 2,
      strNameKey: 'Delerium Change',
      strShortKey: 'Delerium Change',
      strLongKey: 'Delerium Change',
      strAltKey: 'Delerium Change',
    },
  }

  for (const s of SKILLS_CATALOG) {
    const skillPage = s.tabIndex + 1
    const iconCel = CANONICAL_CLASS_SKILL_ICON_CEL[s.id] ?? 0
    const weaponMeta = CANONICAL_CLASS_SKILL_WEAPON_META[s.id]
    const restrictMeta = CANONICAL_SKILL_RESTRICT_META[s.id]
    table[s.id] = {
      skillId: s.id,
      skilldesc: s.name.toLowerCase(),
      passive: CANONICAL_PASSIVE_COLUMN_ONE.has(s.id) ? 1 : 0,
      leftskill: CANONICAL_LEFTSKILL_COLUMN_ONE.has(s.id) ? 1 : 0,
      aura: CANONICAL_AURA_COLUMN_ONE.has(s.id) ? 1 : 0,
      maxlvl: 20,
      restrict: restrictMeta?.restrict ?? 0,
      ...(restrictMeta?.state1 ? { state1: restrictMeta.state1 } : {}),
      ...(restrictMeta?.state2 ? { state2: restrictMeta.state2 } : {}),
      ...(restrictMeta?.state3 ? { state3: restrictMeta.state3 } : {}),
      ...(weaponMeta ?? {}),
      skillPage,
      listRow: skillPage,
      listPool: 0,
      iconCel,
      strNameKey: `skillname${s.id}`,
      strShortKey: `skillsd${s.id}`,
      strLongKey: `skillld${s.id}`,
      strAltKey: `skillan${s.id}`,
    }
  }

  return table
}

/**
 * Canonical 1.13c `skills.txt` + `skilldesc.txt` metadata indexed by skillId.
 */
export const SKILLS_TABLE_META: Readonly<Record<number, SkillTableMeta>> = buildSkillsTableMeta()

export function getSkillTableMeta(skillId: number): SkillTableMeta | undefined {
  return SKILLS_TABLE_META[skillId]
}

export function getSkillName(skillId: number, lang: TblLang = getDefaultTblLang()): string {
  const generic = GENERIC_SKILL_TBL_STRINGS[skillId]
  if (generic) {
    return lang === 'ENG' ? generic.nameEn : generic.nameZh
  }
  const entry = SKILLS_BY_ID[skillId] ?? SKILLS_CATALOG.find(s => s.id === skillId)
  if (!entry) return `Skill #${skillId}`
  return lang === 'ENG' ? entry.name : (entry.nameZh || entry.name)
}

export function getGenericSkillShortDesc(skillId: number, lang: TblLang = getDefaultTblLang()): string | undefined {
  const generic = GENERIC_SKILL_TBL_STRINGS[skillId]
  if (!generic) return undefined
  return lang === 'ENG' ? generic.shortEn : generic.shortZh
}

export function getGenericSkillLongDesc(skillId: number, lang: TblLang = getDefaultTblLang()): string | undefined {
  const generic = GENERIC_SKILL_TBL_STRINGS[skillId]
  if (!generic) return undefined
  return lang === 'ENG' ? generic.longEn : generic.longZh
}

export function formatDamageTypeEn(type: string): string {
  switch (type) {
    case 'fire':
      return 'Fire Damage'
    case 'ltng':
      return 'Lightning Damage'
    case 'cold':
      return 'Cold Damage'
    case 'pois':
      return 'Poison Damage'
    case 'mag':
      return 'Magic Damage'
    case 'physical':
      return 'Physical Damage'
    default:
      return 'Damage'
  }
}

/**
 * Diablo II v1.13c Canonical Passive Skills (`skills.txt` `passive = 1`).
 * Derived directly from `SKILLS_TABLE_META`.
 */
export const PASSIVE_SKILL_IDS: ReadonlySet<number> = new Set<number>(
  Object.values(SKILLS_TABLE_META)
    .filter(m => m.passive === 1)
    .map(m => m.skillId),
)

export function isPassiveSkill(skillId: number): boolean {
  return (SKILLS_TABLE_META[skillId]?.passive ?? 0) === 1
}

/**
 * Diablo II v1.13c Paladin Aura Skills (`skills.txt` `aura = 1`).
 * Derived directly from `SKILLS_TABLE_META`.
 */
export const PALADIN_AURA_SKILL_IDS: ReadonlySet<number> = new Set<number>(
  Object.values(SKILLS_TABLE_META)
    .filter(m => m.aura === 1 && m.passive === 0)
    .map(m => m.skillId),
)

export function isAuraSkill(skillId: number): boolean {
  const meta = SKILLS_TABLE_META[skillId]
  if (!meta) return false
  return meta.aura === 1 && meta.passive === 0
}

/**
 * Diablo II v1.13c Skills usable on the Left-Click action button (`skills.txt` `leftskill = 1`).
 * Derived directly from `SKILLS_TABLE_META`.
 */
export const LEFT_USABLE_SKILL_IDS: ReadonlySet<number> = new Set<number>(
  Object.values(SKILLS_TABLE_META)
    .filter(m => m.leftskill === 1 && m.passive === 0 && m.aura === 0)
    .map(m => m.skillId),
)

export function isLeftUsableSkill(skillId: number): boolean {
  const meta = SKILLS_TABLE_META[skillId]
  if (!meta) return false
  return meta.leftskill === 1 && meta.passive === 0 && meta.aura === 0
}

/**
 * Diablo II v1.13c Canonical Town-Castable Skills (`Skills.txt` `InTown = 1` in `Patch_D2.mpq`).
 * Per `D2Common_10948` (`SKILLS_IsCastableInTown`), only skills with `InTown = 1` may be cast
 * or activated while the player is inside a town area (`areaId` in `{1, 40, 75, 103, 109}`).
 */
export const IN_TOWN_SKILL_IDS_113C: ReadonlySet<number> = new Set<number>([
  3, // Unsummon
  32, // Valkyrie
  33, // Pierce (passive)
  37, // Warmth (passive)
  40, // Frozen Armor
  43, // Telekinesis
  50, // Shiver Armor
  52, // Enchant
  58, // Energy Shield
  60, // Chilling Armor
  68, // Bone Armor
  75, // Clay Golem
  85, // BloodGolem
  90, // IronGolem
  94, // FireGolem
  98, 99, 100, 102, 103, 104, 105, 108, 109, 110, 113, 114, 115, // Paladin Auras & Holy Shield
  117, // Holy Shield
  118, 119, 120, 122, 123, 124, 125, // Paladin Auras
  193, 194, 195, 197, 198, 199, // Monster/Diablo internal
  217, // Scroll of Identify
  218, // Book of Identify
  221, // Raven
  222, // Plague Poppy
  223, // Wearwolf
  226, // Oak Sage
  227, // Summon Spirit Wolf
  228, // Wearbear
  231, // Cycle of Life
  235, // Cyclone Armor
  236, // Heart of Wolverine
  237, // Summon Fenris
  241, // Vines
  246, // Spirit of Barbs
  247, // Summon Grizzly
  258, // Quickness (Burst of Speed)
  267, // Fade
  268, // Shadow Warrior
  277, // Blade Shield
  278, // Venom
  279, // Shadow Master
])

/**
 * Returns true if the given skill ID is allowed to be cast or activated in town
 * per Diablo II v1.13c `Skills.txt` (`InTown = 1`).
 */
export function isSkillAllowedInTown(skillId: number): boolean {
  return IN_TOWN_SKILL_IDS_113C.has(skillId)
}

/**
 * Returns the maximum base skill level from `skills.txt` `maxlvl` column.
 * Per D2MOO `PlrMsg.cpp:2969-2973`, if `maxlvl <= 0`, defaults to `20`.
 */
export function getSkillMaxLevel(skillId: number, maxlvlOverride?: number): number {
  const raw = maxlvlOverride !== undefined ? maxlvlOverride : (SKILLS_TABLE_META[skillId]?.maxlvl ?? 0)
  return raw > 0 ? raw : 20
}

/**
 * Returns the canonical `skilldesc.txt` `ListRow` for a skill.
 * Throws if the skill has no `skilldesc` entry and is not an item/charge skill.
 */
export function getCanonicalSkillListRow(skillId: number, isItemSkill?: boolean): number {
  if (isItemSkill) return 4
  const meta = SKILLS_TABLE_META[skillId]
  if (!meta) {
    throw new Error(`[skills-meta] Missing canonical skilldesc.txt ListRow metadata for skillId=${skillId}`)
  }
  return meta.listRow
}

/**
 * Returns the canonical `skilldesc.txt` `IconCel` for a skill.
 * Throws if the skill has no `skilldesc` entry.
 */
export function getCanonicalSkillIconCel(skillId: number): number {
  const meta = SKILLS_TABLE_META[skillId]
  if (!meta) {
    throw new Error(`[skills-meta] Missing canonical skilldesc.txt IconCel metadata for skillId=${skillId}`)
  }
  return meta.iconCel
}

/**
 * Canonical 1.13c item type codes in the `thro` (Throwing Weapon) hierarchy (`ItemTypes.txt`).
 */
export const THROWING_WEAPON_TYPES: ReadonlySet<string> = new Set<string>([
  'tpot',
  'tkni',
  'taxe',
  'jave',
  'thro',
  'ajav',
])

/**
 * Canonical 1.13c `Weapons.txt` item codes whose type inherits from `thro`.
 */
export const THROWING_WEAPON_CODES: ReadonlySet<string> = new Set<string>([
  'tkf', 'tax', 'bkf', 'bal', 'jav', 'pil', 'ssp', 'glv', 'tsp',
  'gps', 'ops', 'gpm', 'opm', 'gpl', 'opl',
  '9tk', '9ta', '9bk', '9b8', '9ja', '9pi', '9s9', '9gl', '9ts',
  '7tk', '7ta', '7bk', '7b8', '7ja', '7pi', '7s7', '7gl', '7ts',
  'am5', 'ama', 'amf',
])

export function isThrowingWeaponCodeOrType(codeOrType?: string | null): boolean {
  if (!codeOrType) return false
  const norm = codeOrType.trim().toLowerCase()
  return THROWING_WEAPON_CODES.has(norm) || THROWING_WEAPON_TYPES.has(norm)
}

export interface WeaponEquipCheckState {
  readonly rightHandCode?: string | null
  readonly rightHandType?: string | null
  readonly leftHandCode?: string | null
  readonly leftHandType?: string | null
  readonly isRightThrowing?: boolean
  readonly isLeftThrowing?: boolean
}

interface CanonicalWeaponTaxonomy {
  readonly itemTypes: ItemTypeTable
  readonly codeToType: ReadonlyMap<string, string>
}

let cachedWeaponTaxonomy: CanonicalWeaponTaxonomy | null = null

function getCanonicalWeaponTaxonomy(): CanonicalWeaponTaxonomy {
  if (cachedWeaponTaxonomy) return cachedWeaponTaxonomy
  const enc = new TextEncoder()
  const itemTypes = parseItemTypesTable(parseTable(enc.encode(RAW_ITEM_TYPES)))
  const codeToType = new Map<string, string>()
  for (const raw of [RAW_WEAPONS, RAW_ARMOR, RAW_MISC]) {
    const tbl = parseTable(enc.encode(raw))
    for (const row of tbl.rows) {
      const code = cell(tbl, row, 'code').trim().toLowerCase()
      const type = cell(tbl, row, 'type').trim().toLowerCase()
      if (code && type) {
        codeToType.set(code, type)
      }
    }
  }
  cachedWeaponTaxonomy = { itemTypes, codeToType }
  return cachedWeaponTaxonomy
}

const SUBTYPE_ALIAS_TO_ITEM_TYPE: Readonly<Record<string, string>> = {
  dagger: 'knif',
  knife: 'knif',
  sword: 'swor',
  axe: 'axe',
  mace: 'mace',
  hammer: 'hamm',
  club: 'club',
  scepter: 'scep',
  polearm: 'pole',
  spear: 'spea',
  javelin: 'jave',
  bow: 'bow',
  crossbow: 'xbow',
  staff: 'staf',
  wand: 'wand',
  orb: 'orb',
  claw: 'h2h',
  handtohand: 'h2h',
  shield: 'shie',
  throwing: 'thro',
  arrows: 'bowq',
  arrow: 'bowq',
  bolts: 'xboq',
  bolt: 'xboq',
  quiver: 'bowq',
}

/**
 * Resolves an equipped hand item's canonical `ItemTypes.txt` type code from its
 * 3-character item `code` (`Weapons.txt` / `Armor.txt` / `Misc.txt`) or `type` hint.
 */
export function resolveHandItemType(
  code?: string | null,
  typeHint?: string | null,
  isThrowingHint?: boolean,
): string | null {
  const { itemTypes, codeToType } = getCanonicalWeaponTaxonomy()

  if (code) {
    const normCode = code.trim().toLowerCase()
    const mapped = codeToType.get(normCode)
    if (mapped) return mapped
    if (itemTypes.byCode.has(normCode)) return normCode
    const alias = SUBTYPE_ALIAS_TO_ITEM_TYPE[normCode]
    if (alias) return alias
  }

  if (typeHint) {
    const normType = typeHint.trim().toLowerCase()
    if (itemTypes.byCode.has(normType)) return normType
    const alias = SUBTYPE_ALIAS_TO_ITEM_TYPE[normType]
    if (alias) return alias
    const mapped = codeToType.get(normType)
    if (mapped) return mapped
  }

  if (isThrowingHint === true) {
    return 'thro'
  }
  return null
}

function handMatchesType(
  itemTypes: ItemTypeTable,
  handType: string | null,
  reqType: string,
  exclType?: string,
): boolean {
  if (!handType) return false
  if (exclType && isA(handType, exclType, itemTypes)) return false
  return isA(handType, reqType, itemTypes)
}

/**
 * Canonical 1.13c `States.txt` state IDs with `restrict = 1`:
 * - `139`: `wolf` (Werewolf)
 * - `140`: `bear` (Werebear)
 * - `177`: `delerium` (Delirium / Morph fetish)
 */
export const RESTRICT_STATE_IDS_113C = [139, 140, 177] as const

export const RESTRICT_STATE_NAME_TO_ID_113C: Readonly<Record<string, number>> = {
  wolf: 139,
  werewolf: 139,
  bear: 140,
  werebear: 140,
  delerium: 177,
  delirium: 177,
}

export const SKILLS_META = SKILLS_TABLE_META

/**
 * Evaluates Diablo II v1.13c `Skills.txt` shapeshift / morph state restriction
 * (`restrict`, `state1..3` vs `States.txt` `restrict = 1` states `139`, `140`, `177`)
 * per `D2Common.dll` (`0x6fd9f8c0` / `SKILLS_CheckSkillStateRestrict`) and `D2Client.dll` (`0x6faece30`).
 *
 * - `restrict === 2`: Usable ONLY while the unit has at least one of the skill's `state1..state3` active.
 * - `restrict === 0` (or unset): Usable ONLY in human form (when NO `States.txt` `restrict = 1` state is active).
 * - `restrict === 1`: Usable in both human form and shapeshifted states (unless `state1..state3` are specified,
 *   in which case when shapeshifted at least one specified state must match).
 */
export function canUseSkillInMorphState(
  skillId: number,
  activeStates?: ReadonlySet<number> | Iterable<number>,
): boolean {
  const meta = SKILLS_TABLE_META[skillId]
  if (!meta) return false
  if (meta.passive === 1 || meta.aura === 1) return true

  const stateSet: ReadonlySet<number> =
    activeStates instanceof Set
      ? activeStates
      : activeStates
        ? new Set(activeStates)
        : new Set<number>()

  const restrict = meta.restrict ?? 0
  const allowedStateIds: number[] = []
  for (const name of [meta.state1, meta.state2, meta.state3]) {
    if (!name) continue
    const id = RESTRICT_STATE_NAME_TO_ID_113C[name.trim().toLowerCase()]
    if (id !== undefined) allowedStateIds.push(id)
  }

  const isRestrictStateActive = RESTRICT_STATE_IDS_113C.some(id => stateSet.has(id))

  if (restrict === 2) {
    if (allowedStateIds.length === 0) return isRestrictStateActive
    return allowedStateIds.some(id => stateSet.has(id))
  }

  if (restrict === 0) {
    return !isRestrictStateActive
  }

  // restrict === 1
  if (!isRestrictStateActive) return true
  if (allowedStateIds.length === 0) return true
  return allowedStateIds.some(id => stateSet.has(id))
}

/**
 * Evaluates Diablo II v1.13c `Skills.txt` weapon, shield, dual-wield, ammunition quiver
 * (`itypea1`, `itypeb1`, `etypea1`, `weapsel`, `checkfunc`), and optional shapeshift state
 * (`restrict`, `state1..3`) requirements.
 * When `weaponState` is undefined, weapon checks return true so callers without equipment state remain unaffected.
 */
export function canUseSkillWithWeapon(
  skillId: number,
  weaponState?: WeaponEquipCheckState,
  activeStates?: ReadonlySet<number> | Iterable<number>,
): boolean {
  const meta = SKILLS_TABLE_META[skillId]
  if (!meta) return false
  if (meta.passive === 1 || meta.aura === 1) return true
  if (activeStates !== undefined && !canUseSkillInMorphState(skillId, activeStates)) {
    return false
  }
  if (!meta.itypea1) return true
  if (!weaponState) return true

  const { itemTypes } = getCanonicalWeaponTaxonomy()
  const rightType = resolveHandItemType(
    weaponState.rightHandCode,
    weaponState.rightHandType,
    weaponState.isRightThrowing,
  )
  const leftType = resolveHandItemType(
    weaponState.leftHandCode,
    weaponState.leftHandType,
    weaponState.isLeftThrowing,
  )

  // Throw (#2) and Left Hand Throw (#4): honor explicit boolean overrides if provided
  if (skillId === 2 || skillId === 4) {
    const rightThrow =
      weaponState.isRightThrowing ?? handMatchesType(itemTypes, rightType, 'thro')
    const leftThrow =
      weaponState.isLeftThrowing ?? handMatchesType(itemTypes, leftType, 'thro')
    if (meta.weapsel === 1) return leftThrow
    return rightThrow || leftThrow
  }

  // Normal Attack (#0): checkfunc=1, itypea1='weap', etypea1='tpot'
  // Unarmed or melee is valid; bow/crossbow requires matching quiver in the other hand;
  // throwing potions ('tpot') cannot be swung with Normal Attack.
  if (skillId === 0) {
    const rightIsBow = handMatchesType(itemTypes, rightType, 'bow')
    const leftIsBow = handMatchesType(itemTypes, leftType, 'bow')
    if (rightIsBow || leftIsBow) {
      const otherType = rightIsBow ? leftType : rightType
      return handMatchesType(itemTypes, otherType, 'bowq')
    }
    const rightIsXbow = handMatchesType(itemTypes, rightType, 'xbow')
    const leftIsXbow = handMatchesType(itemTypes, leftType, 'xbow')
    if (rightIsXbow || leftIsXbow) {
      const otherType = rightIsXbow ? leftType : rightType
      return handMatchesType(itemTypes, otherType, 'xboq')
    }
    const rightIsTpot = handMatchesType(itemTypes, rightType, 'tpot')
    const leftIsTpot = handMatchesType(itemTypes, leftType, 'tpot')
    if (rightIsTpot && !leftType) return false
    if (leftIsTpot && !rightType) return false
    if (rightIsTpot && leftIsTpot) return false
    return true
  }

  // Amazon Bow & Crossbow skills (itypea1 === 'miss', checkfunc === 1):
  // Require Bow + Arrow Quiver ('bow' + 'bowq') OR Crossbow + Bolt Quiver ('xbow' + 'xboq').
  if (meta.itypea1 === 'miss') {
    const bowWithQuiver =
      (handMatchesType(itemTypes, rightType, 'bow') &&
        handMatchesType(itemTypes, leftType, 'bowq')) ||
      (handMatchesType(itemTypes, leftType, 'bow') &&
        handMatchesType(itemTypes, rightType, 'bowq'))
    const xbowWithQuiver =
      (handMatchesType(itemTypes, rightType, 'xbow') &&
        handMatchesType(itemTypes, leftType, 'xboq')) ||
      (handMatchesType(itemTypes, leftType, 'xbow') &&
        handMatchesType(itemTypes, rightType, 'xboq'))
    return bowWithQuiver || xbowWithQuiver
  }

  // Dual-wield skills (weapsel === 3, itypeb1 present):
  // Double Swing (#133), Frenzy (#147), Double Throw (#140), Dragon Claw (#260)
  if (meta.weapsel === 3 && meta.itypeb1) {
    return (
      (handMatchesType(itemTypes, rightType, meta.itypea1, meta.etypea1) &&
        handMatchesType(itemTypes, leftType, meta.itypeb1, meta.etypea1)) ||
      (handMatchesType(itemTypes, leftType, meta.itypea1, meta.etypea1) &&
        handMatchesType(itemTypes, rightType, meta.itypeb1, meta.etypea1))
    )
  }

  // Left-hand specific skills (weapsel === 1): e.g. Left Hand Swing (#5)
  if (meta.weapsel === 1) {
    return handMatchesType(itemTypes, leftType, meta.itypea1, meta.etypea1)
  }

  // All single-weapon or shield skills (Poison Dagger #73, Jab #10, Lightning Fury #35,
  // Smite #97, Holy Shield #117, Zeal #106, Bash #126, Whirlwind #151, Fists of Fire #259, etc.)
  return (
    handMatchesType(itemTypes, rightType, meta.itypea1, meta.etypea1) ||
    handMatchesType(itemTypes, leftType, meta.itypea1, meta.etypea1)
  )
}

export type { CharacterClassCode }



