// Auto-generated Diablo II 1.13c 210-Skill Catalog
// Ground truth parsed from Skills.txt, SkillDesc.txt, string.tbl, and MPQs.

import type { CharacterClassCode } from '../units/classes.ts'

export interface SynergyBonusInfo {
  readonly providerId: number
  readonly providerName: string
  readonly percentPerLevel: number
  readonly type: 'damage' | 'elemental' | 'duration' | 'attack' | 'life' | 'defense' | 'toHit' | 'magic'
  readonly labelEn?: string | undefined
  readonly labelZh?: string | undefined
}

export interface SynergyGivenInfo {
  readonly targetId: number
  readonly targetName: string
  readonly targetNameZh: string
  readonly percentPerLevel: number
}

export interface DescLineDefinition {
  readonly lineType: number
  readonly textaKey?: string | undefined
  readonly textbKey?: string | undefined
  readonly textaEn?: string | undefined
  readonly textaZh?: string | undefined
  readonly textbEn?: string | undefined
  readonly textbZh?: string | undefined
  readonly calca?: string | undefined
  readonly calcb?: string | undefined
}

export interface MinionBaseStats {
  readonly code: string
  readonly minHP: number
  readonly maxHP: number
  readonly minDam: number
  readonly maxDam: number
}

export interface SkillCatalogEntry {
  readonly id: number
  readonly name: string
  readonly nameZh: string
  readonly classCode: CharacterClassCode
  readonly classNameZh: string
  readonly tabIndex: number
  readonly tabName: string
  readonly tabNameZh: string
  readonly row: number
  readonly col: number
  readonly reqlevel: number
  readonly reqskills: readonly number[]
  readonly dependents: readonly number[]
  readonly mana: number
  readonly lvlmana: number
  readonly minmana: number
  readonly manashift: number
  readonly delay: number
  readonly descdam?: string | undefined
  readonly hitshift: number
  readonly srcDamage: number
  readonly minDam: number
  readonly maxDam: number
  readonly minLevDam: readonly number[]
  readonly maxLevDam: readonly number[]
  readonly eType: string
  readonly eMin: number
  readonly eMax: number
  readonly eMinLev: readonly number[]
  readonly eMaxLev: readonly number[]
  readonly eLen: number
  readonly eLevLen: readonly number[]
  readonly toHit: number
  readonly toHitLev: number
  readonly toHitCalc?: string | undefined
  readonly auraLenCalc?: string | undefined
  readonly startmana: number
  readonly params: Readonly<Record<string, number | undefined>>
  readonly synergyFormulas: {
    readonly physical?: string | undefined
    readonly elemental?: string | undefined
    readonly duration?: string | undefined
  }
  readonly synergiesReceived: readonly SynergyBonusInfo[]
  readonly synergiesGiven: readonly SynergyGivenInfo[]
  readonly masteries: readonly number[]
  readonly descLines?: readonly DescLineDefinition[] | undefined
  readonly dsc2Lines?: readonly DescLineDefinition[] | undefined
  readonly minionStats?: MinionBaseStats | undefined
  readonly shortDesc: string
  readonly shortDescZh: string
  readonly longDesc: string
  readonly longDescZh: string
  readonly icon: string
  readonly iconActive: string
}

export const SKILLS_CATALOG: readonly SkillCatalogEntry[] = Object.freeze([
  {
    "id": 6,
    "name": "Magic Arrow",
    "nameZh": "魔法箭",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 0,
    "tabName": "Bow and Crossbow Skills",
    "tabNameZh": "弓与弩技能",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      12
    ],
    "mana": 12,
    "lvlmana": -1,
    "minmana": 0,
    "manashift": 5,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 1,
    "maxDam": 1,
    "minLevDam": [
      1,
      1,
      1,
      1,
      1
    ],
    "maxLevDam": [
      1,
      1,
      1,
      1,
      1
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {},
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      },
      {
        "lineType": 66,
        "textaKey": "Convphy2elemalt",
        "textaEn": "Converts %d%% Physical Damage to Magic Damage",
        "textaZh": "轉換%d%%實體害為魔法傷害",
        "calca": "1+(lvl-1)*1"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates a magical arrow",
    "shortDescZh": "創造魔法箭矢",
    "longDesc": "that does extra damage\ncreates a magical arrow or bolt",
    "longDescZh": "造成額外的傷害\n創造魔法箭或魔法彈",
    "icon": "/skills/icon_6.png",
    "iconActive": "/skills/icon_6_active.png",
    "toHit": 10,
    "toHitLev": 9,
    "startmana": 0
  },
  {
    "id": 7,
    "name": "Fire Arrow",
    "nameZh": "火焰箭",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 0,
    "tabName": "Bow and Crossbow Skills",
    "tabNameZh": "弓与弩技能",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      16
    ],
    "mana": 24,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 5,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 1,
    "eMax": 4,
    "eMinLev": [
      2,
      3,
      6,
      12,
      24
    ],
    "eMaxLev": [
      2,
      3,
      7,
      14,
      27
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 12
    },
    "synergyFormulas": {
      "elemental": "(skill('Exploding Arrow'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Exploding Arrow",
        "providerId": 16,
        "percentPerLevel": 12,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 16,
        "targetName": "Exploding Arrow",
        "targetNameZh": "爆裂箭",
        "percentPerLevel": 12
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      },
      {
        "lineType": 66,
        "textaKey": "Convphy2magalt",
        "textaEn": "Converts %d%% Physical Damage to Elemental Damage",
        "textaZh": "轉換%d%%實體傷害為元素傷害",
        "calca": "3+(lvl-1)*2"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "enchants arrows with flame",
    "shortDescZh": "讓箭矢附上火焰",
    "longDesc": "or bolts with fire\nmagically enhances your arrows",
    "longDescZh": "",
    "icon": "/skills/icon_7.png",
    "iconActive": "/skills/icon_7_active.png",
    "toHit": 10,
    "toHitLev": 9,
    "startmana": 0
  },
  {
    "id": 8,
    "name": "Inner Sight",
    "nameZh": "內視",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 1,
    "tabName": "Passive and Magic Skills",
    "tabNameZh": "被动与魔法技能",
    "row": 1,
    "col": 1,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      17
    ],
    "mana": 10,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 40,
    "eMax": 0,
    "eMinLev": [
      25,
      45,
      60,
      80,
      100
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 20,
      "par1": 40,
      "par2": 25,
      "par3": 200,
      "par4": 100
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln56"
      },
      {
        "lineType": 5,
        "textaKey": "StrSkill25",
        "textaEn": "Enemy Defense:",
        "textaZh": "敵人防禦：",
        "calca": "-edmn"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "illuminates and weakens nearby monsters",
    "shortDescZh": "照亮並削弱附近的怪物",
    "longDesc": "for you and your party\nmaking them easier to hit\nilluminates nearby enemies",
    "longDescZh": "讓你和你的隊伍成員\n更容易擊中目標\n照亮附近的敵人",
    "icon": "/skills/icon_8.png",
    "iconActive": "/skills/icon_8_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 9,
    "name": "Critical Strike",
    "nameZh": "致命攻擊",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 1,
    "tabName": "Passive and Magic Skills",
    "tabNameZh": "被动与魔法技能",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      23
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 5,
      "par2": 80
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill24",
        "textaEn": "percent chance",
        "textaZh": "百分機率",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - chance of doing double damage",
    "shortDescZh": "被動-有機會造成二倍的傷害",
    "longDesc": "passive - your attacks have a chance to do double damage",
    "longDescZh": "被動-你的攻擊可能對目標造成雙倍傷害",
    "icon": "/skills/icon_9.png",
    "iconActive": "/skills/icon_9_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 10,
    "name": "Jab",
    "nameZh": "戳刺",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 2,
    "tabName": "Javelin and Spear Skills",
    "tabNameZh": "标枪与长矛技能",
    "row": 1,
    "col": 1,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      14,
      19
    ],
    "mana": 8,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par3": -15,
      "par4": 3
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 25,
        "textaKey": "StrSkill61",
        "textaEn": "Multiple Hits",
        "textaZh": "多重攻擊"
      }
    ],
    "shortDesc": "rapid attacks with a thrusting weapon",
    "shortDescZh": "利用突刺性武器快速的戳刺",
    "longDesc": "using a javelin or spear class weapon\nattacks with a series of rapid thrusts",
    "longDescZh": "使用鏢槍或是長矛類的武器\n用快速的刺擊攻擊數下",
    "icon": "/skills/icon_10.png",
    "iconActive": "/skills/icon_10_active.png",
    "toHit": 10,
    "toHitLev": 9,
    "startmana": 0
  },
  {
    "id": 11,
    "name": "Cold Arrow",
    "nameZh": "冰箭",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 0,
    "tabName": "Bow and Crossbow Skills",
    "tabNameZh": "弓与弩技能",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      21,
      22
    ],
    "mana": 28,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 5,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 6,
    "eMax": 8,
    "eMinLev": [
      4,
      5,
      8,
      16,
      42
    ],
    "eMaxLev": [
      4,
      5,
      9,
      17,
      44
    ],
    "eLen": 100,
    "eLevLen": [
      30,
      30,
      30
    ],
    "params": {
      "par8": 12
    },
    "synergyFormulas": {
      "elemental": "(skill('Ice Arrow'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Ice Arrow",
        "providerId": 21,
        "percentPerLevel": 12,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 21,
        "targetName": "Ice Arrow",
        "targetNameZh": "急凍箭",
        "percentPerLevel": 8
      },
      {
        "targetId": 31,
        "targetName": "Freezing Arrow",
        "targetNameZh": "凍結之箭",
        "percentPerLevel": 12
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      },
      {
        "lineType": 66,
        "textaKey": "Convphy2magalt",
        "textaEn": "Converts %d%% Physical Damage to Elemental Damage",
        "textaZh": "轉換%d%%實體傷害為元素傷害",
        "calca": "3+(lvl-1)*2"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "enchants arrows to slow targets",
    "shortDescZh": "讓魔法強化的箭矢減慢目標的移動",
    "longDesc": "cold arrows only do half of their regular damage\nby adding cold damage and a slowing effect\nmagically enhances your arrows or bolts",
    "longDescZh": "",
    "icon": "/skills/icon_11.png",
    "iconActive": "/skills/icon_11_active.png",
    "toHit": 10,
    "toHitLev": 9,
    "startmana": 0
  },
  {
    "id": 12,
    "name": "Multiple Shot",
    "nameZh": "多重箭",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 0,
    "tabName": "Bow and Crossbow Skills",
    "tabNameZh": "弓与弩技能",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [
      6
    ],
    "dependents": [
      16,
      22
    ],
    "mana": 4,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 96,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 2,
      "par2": 1,
      "par3": 1
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill9",
        "textaEn": "arrows",
        "textaZh": "箭矢",
        "calca": "\"min(24,ln12)\""
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 73,
        "textaKey": "WeapDamsk",
        "textaEn": "Weapon Damage",
        "textaZh": "武器傷害",
        "calca": "3",
        "calcb": "4"
      }
    ],
    "shortDesc": "fires multiple arrows",
    "shortDescZh": "射出多重的箭矢",
    "longDesc": "or bolt into many\nmagically splits one arrow",
    "longDescZh": "或十字弓彈，魔法般的\n由一根分為數根飛射",
    "icon": "/skills/icon_12.png",
    "iconActive": "/skills/icon_12_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 13,
    "name": "Dodge",
    "nameZh": "閃避",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 1,
    "tabName": "Passive and Magic Skills",
    "tabNameZh": "被动与魔法技能",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      18
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 10,
      "par2": 65
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill24",
        "textaEn": "percent chance",
        "textaZh": "百分機率",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - dodges melee attacks",
    "shortDescZh": "被動-閃避肉博戰中的攻擊",
    "longDesc": "or standing still\na melee attack when attacking\npassive - you have a chance to dodge",
    "longDescZh": "或是在肉搏戰之中\n以站立不動的方式攻擊\n被動-你有機會閃避",
    "icon": "/skills/icon_13.png",
    "iconActive": "/skills/icon_13_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 14,
    "name": "Power Strike",
    "nameZh": "威力一擊",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 2,
    "tabName": "Javelin and Spear Skills",
    "tabNameZh": "标枪与长矛技能",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [
      10
    ],
    "dependents": [
      24
    ],
    "mana": 8,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 16,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      18,
      36,
      54,
      72,
      90
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 10
    },
    "synergyFormulas": {
      "elemental": "(skill('Lightning Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Charged Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Lightning Strike",
        "providerId": 34,
        "percentPerLevel": 10,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Bolt",
        "providerId": 20,
        "percentPerLevel": 10,
        "type": "elemental"
      },
      {
        "providerName": "Charged Strike",
        "providerId": 24,
        "percentPerLevel": 10,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Fury",
        "providerId": 35,
        "percentPerLevel": 10,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 20,
        "targetName": "Lightning Bolt",
        "targetNameZh": "閃電球",
        "percentPerLevel": 3
      },
      {
        "targetId": 24,
        "targetName": "Charged Strike",
        "targetNameZh": "充能一擊",
        "percentPerLevel": 10
      },
      {
        "targetId": 34,
        "targetName": "Lightning Strike",
        "targetNameZh": "閃電攻擊",
        "percentPerLevel": 8
      },
      {
        "targetId": 35,
        "targetName": "Lightning Fury",
        "targetNameZh": "閃電之怒",
        "percentPerLevel": 1
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "adds lightning damage",
    "shortDescZh": "附加閃電的傷害",
    "longDesc": "javelin and spear class weapons\nadds lightning damage to attacks with",
    "longDescZh": "鏢槍和長矛之類的武器\n可以附加閃電性質的傷害力",
    "icon": "/skills/icon_14.png",
    "iconActive": "/skills/icon_14_active.png",
    "toHit": 20,
    "toHitLev": 12,
    "startmana": 0
  },
  {
    "id": 15,
    "name": "Poison Javelin",
    "nameZh": "毒槍",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 2,
    "tabName": "Javelin and Spear Skills",
    "tabNameZh": "标枪与长矛技能",
    "row": 2,
    "col": 3,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      20
    ],
    "mana": 16,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 15,
    "descdam": "22",
    "hitshift": 0,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "pois",
    "eMin": 32,
    "eMax": 48,
    "eMinLev": [
      16,
      32,
      48,
      64,
      96
    ],
    "eMaxLev": [
      16,
      36,
      52,
      68,
      84
    ],
    "eLen": 200,
    "eLevLen": [
      50,
      50,
      50
    ],
    "params": {
      "par8": 12
    },
    "synergyFormulas": {
      "elemental": "(skill('Plague Javelin'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Plague Javelin",
        "providerId": 25,
        "percentPerLevel": 12,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 25,
        "targetName": "Plague Javelin",
        "targetNameZh": "瘟疫標槍",
        "percentPerLevel": 10
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 14
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "adds poison damage",
    "shortDescZh": "增加中毒的傷害",
    "longDesc": "to leave a trail of poison clouds\nmagically enhances your javelin",
    "longDescZh": "你的鏢槍會魔法般的\n留下毒氣般的雲霧",
    "icon": "/skills/icon_15.png",
    "iconActive": "/skills/icon_15_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 16,
    "name": "Exploding Arrow",
    "nameZh": "爆裂箭",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 0,
    "tabName": "Bow and Crossbow Skills",
    "tabNameZh": "弓与弩技能",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      7,
      12
    ],
    "dependents": [
      27
    ],
    "mana": 10,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "6",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 2,
    "eMax": 6,
    "eMinLev": [
      5,
      7,
      9,
      12,
      20
    ],
    "eMaxLev": [
      5,
      8,
      11,
      14,
      23
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 12
    },
    "synergyFormulas": {
      "elemental": "(skill('Fire Arrow'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Fire Arrow",
        "providerId": 7,
        "percentPerLevel": 12,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 7,
        "targetName": "Fire Arrow",
        "targetNameZh": "火焰箭",
        "percentPerLevel": 12
      },
      {
        "targetId": 27,
        "targetName": "Immolation Arrow",
        "targetNameZh": "犧牲之箭",
        "percentPerLevel": 10
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "enchant arrows to explode",
    "shortDescZh": "讓箭附加爆炸攻擊",
    "longDesc": "contact, damaging all nearby enemies\nenchants an arrow or bolt that explodes on",
    "longDescZh": "",
    "icon": "/skills/icon_16.png",
    "iconActive": "/skills/icon_16_active.png",
    "toHit": 20,
    "toHitLev": 9,
    "startmana": 0
  },
  {
    "id": 17,
    "name": "Slow Missiles",
    "nameZh": "慢速箭",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 1,
    "tabName": "Passive and Magic Skills",
    "tabNameZh": "被动与魔法技能",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [
      8
    ],
    "dependents": [
      28
    ],
    "mana": 10,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 20,
      "par1": 33,
      "par3": 300,
      "par4": 150
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln56"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill67",
        "textbKey": "StrSkill23",
        "textaEn": "Ranged attacks slowed to",
        "textaZh": "長距離攻擊減慢到",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "slows ranged attacks of enemies",
    "shortDescZh": "減弱一個敵人的長距離攻擊",
    "longDesc": "illuminates nearby enemies and slows their ranged attacks",
    "longDescZh": "在這道光明之中的敵人，他們的長距離攻擊都會減慢",
    "icon": "/skills/icon_17.png",
    "iconActive": "/skills/icon_17_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 18,
    "name": "Avoid",
    "nameZh": "躲避",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 1,
    "tabName": "Passive and Magic Skills",
    "tabNameZh": "被动与魔法技能",
    "row": 3,
    "col": 2,
    "reqlevel": 12,
    "reqskills": [
      13
    ],
    "dependents": [
      29
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 15,
      "par2": 75
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill24",
        "textaEn": "percent chance",
        "textaZh": "百分機率",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - dodges missiles",
    "shortDescZh": "被動-躲避飛射武器",
    "longDesc": "when attacking or standing still\npassive - you have a chance to dodge enemy missiles",
    "longDescZh": "當你站立不動或是受到攻擊\n被動-你機會躲開敵人的飛射武器",
    "icon": "/skills/icon_18.png",
    "iconActive": "/skills/icon_18_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 19,
    "name": "Impale",
    "nameZh": "刺爆",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 2,
    "tabName": "Javelin and Spear Skills",
    "tabNameZh": "标枪与长矛技能",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [
      10
    ],
    "dependents": [
      30
    ],
    "mana": 3,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 50,
      "par5": 1,
      "par1": 300,
      "par2": 25,
      "par4": 30
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill65",
        "textbKey": "StrSkill23",
        "textaEn": "Chance of losing durability:",
        "textaZh": "損失耐久度機率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "par6-dm34"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "increases damage but degrades weapon",
    "shortDescZh": "藉由武器變差，增加傷害力",
    "longDesc": "increases attack damage but rapidly degrades the weapon",
    "longDescZh": "可以增加破壞力，但是武器的狀況會迅速下降",
    "icon": "/skills/icon_19.png",
    "iconActive": "/skills/icon_19_active.png",
    "toHit": 100,
    "toHitLev": 25,
    "startmana": 0
  },
  {
    "id": 20,
    "name": "Lightning Bolt",
    "nameZh": "閃電球",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 2,
    "tabName": "Javelin and Spear Skills",
    "tabNameZh": "标枪与长矛技能",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      15
    ],
    "dependents": [
      24,
      25
    ],
    "mana": 24,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "21",
    "hitshift": 8,
    "srcDamage": 96,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 40,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      12,
      18,
      28,
      48,
      88
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 3
    },
    "synergyFormulas": {
      "elemental": "(skill('Lightning Strike'.blvl)+skill('Power Strike'.blvl)+skill('Charged Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Lightning Strike",
        "providerId": 34,
        "percentPerLevel": 3,
        "type": "elemental"
      },
      {
        "providerName": "Power Strike",
        "providerId": 14,
        "percentPerLevel": 3,
        "type": "elemental"
      },
      {
        "providerName": "Charged Strike",
        "providerId": 24,
        "percentPerLevel": 3,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Fury",
        "providerId": 35,
        "percentPerLevel": 3,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 14,
        "targetName": "Power Strike",
        "targetNameZh": "威力一擊",
        "percentPerLevel": 10
      },
      {
        "targetId": 24,
        "targetName": "Charged Strike",
        "targetNameZh": "充能一擊",
        "percentPerLevel": 10
      },
      {
        "targetId": 34,
        "targetName": "Lightning Strike",
        "targetNameZh": "閃電攻擊",
        "percentPerLevel": 8
      },
      {
        "targetId": 35,
        "targetName": "Lightning Fury",
        "targetNameZh": "閃電之怒",
        "percentPerLevel": 1
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 66,
        "textaKey": "Convphy2magalt",
        "textaEn": "Converts %d%% Physical Damage to Elemental Damage",
        "textaZh": "轉換%d%%實體傷害為元素傷害",
        "calca": "100"
      },
      {
        "lineType": 73,
        "textaKey": "WeapDamsk",
        "textaEn": "Weapon Damage",
        "textaZh": "武器傷害",
        "calca": "3",
        "calcb": "4"
      }
    ],
    "shortDesc": "changes a thrown javelin into lightning",
    "shortDescZh": "把丟出去的標槍變成閃電",
    "longDesc": "magically converts your javelin into a bolt of lightning",
    "longDescZh": "魔法般的把你的鏢槍變成一個閃電球",
    "icon": "/skills/icon_20.png",
    "iconActive": "/skills/icon_20_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 21,
    "name": "Ice Arrow",
    "nameZh": "急凍箭",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 0,
    "tabName": "Bow and Crossbow Skills",
    "tabNameZh": "弓与弩技能",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      11
    ],
    "dependents": [
      31
    ],
    "mana": 16,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 6,
    "eMax": 10,
    "eMinLev": [
      6,
      12,
      18,
      26,
      36
    ],
    "eMaxLev": [
      6,
      13,
      19,
      27,
      38
    ],
    "eLen": 50,
    "eLevLen": [
      5,
      5,
      5
    ],
    "params": {
      "par8": 8,
      "par7": 5
    },
    "synergyFormulas": {
      "elemental": "(skill('Cold Arrow'.blvl))*par8",
      "duration": "(skill('Freezing Arrow'.blvl)) * par7"
    },
    "synergiesReceived": [
      {
        "providerName": "Cold Arrow",
        "providerId": 11,
        "percentPerLevel": 8,
        "type": "elemental"
      },
      {
        "providerName": "Freezing Arrow",
        "providerId": 31,
        "percentPerLevel": 8,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 11,
        "targetName": "Cold Arrow",
        "targetNameZh": "冰箭",
        "percentPerLevel": 12
      },
      {
        "targetId": 31,
        "targetName": "Freezing Arrow",
        "targetNameZh": "凍結之箭",
        "percentPerLevel": 12
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill62",
        "textaEn": "Freezes for",
        "textaZh": "冰凍是因為",
        "calca": "edln"
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "enchants arrows to freeze enemies",
    "shortDescZh": "讓箭上的魔法把敵人冰凍起來",
    "longDesc": "to freeze your enemies\nmagically enhances your arrow or bolt",
    "longDescZh": "",
    "icon": "/skills/icon_21.png",
    "iconActive": "/skills/icon_21_active.png",
    "toHit": 20,
    "toHitLev": 9,
    "startmana": 0
  },
  {
    "id": 22,
    "name": "Guided Arrow",
    "nameZh": "導引箭",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 0,
    "tabName": "Bow and Crossbow Skills",
    "tabNameZh": "弓与弩技能",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      11,
      12
    ],
    "dependents": [
      26
    ],
    "mana": 32,
    "lvlmana": -1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "enchants arrows to seek enemies",
    "shortDescZh": "讓箭能夠自尋目標",
    "longDesc": "always hits\nor seek one of its own\nto track your target\nenhances your arrows and bolts",
    "longDescZh": "一定擊中\n或是自行找尋目標\n並追蹤你的目標\n可附加在你的箭矢或十字弓彈上",
    "icon": "/skills/icon_22.png",
    "iconActive": "/skills/icon_22_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 23,
    "name": "Penetrate",
    "nameZh": "刺入",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 1,
    "tabName": "Passive and Magic Skills",
    "tabNameZh": "被动与魔法技能",
    "row": 4,
    "col": 3,
    "reqlevel": 18,
    "reqskills": [
      9
    ],
    "dependents": [
      33
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 35,
      "par2": 10
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill10",
        "textbKey": "StrSkill23",
        "textaEn": "To Attack Rating:",
        "textaZh": "變動準確率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - increases attack rating",
    "shortDescZh": "被動-增加準確率",
    "longDesc": "passive - increases your attack rating",
    "longDescZh": "被動-增加準確率",
    "icon": "/skills/icon_23.png",
    "iconActive": "/skills/icon_23_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 24,
    "name": "Charged Strike",
    "nameZh": "充能一擊",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 2,
    "tabName": "Javelin and Spear Skills",
    "tabNameZh": "标枪与长矛技能",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      14,
      20
    ],
    "dependents": [
      34
    ],
    "mana": 16,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "17",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 30,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      12,
      16,
      20,
      24,
      28
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 10,
      "par1": 3,
      "par2": 5
    },
    "synergyFormulas": {
      "elemental": "(skill('Lightning Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Power Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Lightning Strike",
        "providerId": 34,
        "percentPerLevel": 10,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Bolt",
        "providerId": 20,
        "percentPerLevel": 10,
        "type": "elemental"
      },
      {
        "providerName": "Power Strike",
        "providerId": 14,
        "percentPerLevel": 10,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Fury",
        "providerId": 35,
        "percentPerLevel": 10,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 14,
        "targetName": "Power Strike",
        "targetNameZh": "威力一擊",
        "percentPerLevel": 10
      },
      {
        "targetId": 20,
        "targetName": "Lightning Bolt",
        "targetNameZh": "閃電球",
        "percentPerLevel": 3
      },
      {
        "targetId": 34,
        "targetName": "Lightning Strike",
        "targetNameZh": "閃電攻擊",
        "percentPerLevel": 8
      },
      {
        "targetId": 35,
        "targetName": "Lightning Fury",
        "targetNameZh": "閃電之怒",
        "percentPerLevel": 1
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill72",
        "textbKey": "StrSkill73",
        "textaEn": "Releases",
        "textaZh": "放出",
        "textbEn": "charged bolts",
        "textbZh": "充能的光彈",
        "calca": "par1 + lvl/par2"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "enchants thrusting weapons with charged bolts",
    "shortDescZh": "在戳刺性的武器上面附加充能的光彈",
    "longDesc": "and releases charged bolts upon impact\nadds lightning damage to javelin and spear class weapons",
    "longDescZh": "並在接觸的時候將光彈的能量釋放出來\n在標槍或是長矛上面附加閃電性傷害",
    "icon": "/skills/icon_24.png",
    "iconActive": "/skills/icon_24_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 25,
    "name": "Plague Javelin",
    "nameZh": "瘟疫標槍",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 2,
    "tabName": "Javelin and Spear Skills",
    "tabNameZh": "标枪与长矛技能",
    "row": 4,
    "col": 3,
    "reqlevel": 18,
    "reqskills": [
      20
    ],
    "dependents": [
      35
    ],
    "mana": 14,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 100,
    "descdam": "22",
    "hitshift": 3,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "pois",
    "eMin": 10,
    "eMax": 16,
    "eMinLev": [
      6,
      12,
      20,
      40,
      60
    ],
    "eMaxLev": [
      6,
      12,
      20,
      40,
      60
    ],
    "eLen": 75,
    "eLevLen": [
      10,
      10,
      10
    ],
    "params": {
      "par8": 10
    },
    "synergyFormulas": {
      "elemental": "(skill('Poison Javelin'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Poison Javelin",
        "providerId": 15,
        "percentPerLevel": 10,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 15,
        "targetName": "Poison Javelin",
        "targetNameZh": "毒槍",
        "percentPerLevel": 12
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 14
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "enchants javelins with poison explosions",
    "shortDescZh": "讓標槍攻擊時爆出毒素般的氣體",
    "longDesc": "expanding clouds of poison upon impact\nmagically enhances your javelin to release",
    "longDescZh": "爆出毒氣煙霧\n在撞擊時魔法般的從你的標槍",
    "icon": "/skills/icon_25.png",
    "iconActive": "/skills/icon_25_active.png",
    "toHit": 30,
    "toHitLev": 9,
    "startmana": 0
  },
  {
    "id": 26,
    "name": "Strafe",
    "nameZh": "砲轟",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 0,
    "tabName": "Bow and Crossbow Skills",
    "tabNameZh": "弓与弩技能",
    "row": 5,
    "col": 2,
    "reqlevel": 24,
    "reqskills": [
      22
    ],
    "dependents": [],
    "mana": 11,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 96,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 50,
      "par5": 35,
      "par1": 5,
      "par2": 5,
      "par3": 4,
      "par4": 10
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill86",
        "textbKey": "StrSkill87",
        "textaEn": "Attacks up to",
        "textaZh": "攻擊上昇到",
        "textbEn": "targets",
        "textbZh": "目標",
        "calca": "\"min(lvl+par3,par4)\""
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 73,
        "textaKey": "WeapDamsk",
        "textaEn": "Weapon Damage",
        "textaZh": "武器傷害",
        "calca": "3",
        "calcb": "4"
      }
    ],
    "shortDesc": "enchants arrows to strike multiple targets",
    "shortDescZh": "讓你的箭矢魔法般的攻擊數個目標",
    "longDesc": "that target multiple nearby enemies\nmagically splits one arrow into several",
    "longDescZh": "會瞄準數個靠近的敵人\n讓射出的箭矢自動分裂攻擊",
    "icon": "/skills/icon_26.png",
    "iconActive": "/skills/icon_26_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 27,
    "name": "Immolation Arrow",
    "nameZh": "犧牲之箭",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 0,
    "tabName": "Bow and Crossbow Skills",
    "tabNameZh": "弓与弩技能",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      16
    ],
    "dependents": [],
    "mana": 12,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 25,
    "descdam": "6",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 12,
    "eMax": 23,
    "eMinLev": [
      12,
      23,
      34,
      36,
      38
    ],
    "eMaxLev": [
      12,
      23,
      34,
      36,
      38
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 10,
      "par1": 3,
      "par2": 4
    },
    "synergyFormulas": {
      "elemental": "(skill('Exploding Arrow'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Exploding Arrow",
        "providerId": 16,
        "percentPerLevel": 10,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 22
      },
      {
        "lineType": 23,
        "textaKey": "StrSkill82",
        "textaEn": "Fire Duration:",
        "textaZh": "火焰持續："
      },
      {
        "lineType": 24,
        "textaKey": "StrSkill83",
        "textaEn": "Fire Explosion Damage:",
        "textaZh": "火焰爆炸傷害："
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "enchants arrows to burn enemies",
    "shortDescZh": "讓箭矢附加燃燒敵人的力量",
    "longDesc": "creates a pyre upon impact\ncause severe fire damage and\nenhances arrows or bolts to",
    "longDescZh": "",
    "icon": "/skills/icon_27.png",
    "iconActive": "/skills/icon_27_active.png",
    "toHit": 30,
    "toHitLev": 9,
    "startmana": 0
  },
  {
    "id": 28,
    "name": "Decoy",
    "nameZh": "誘餌",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 1,
    "tabName": "Passive and Magic Skills",
    "tabNameZh": "被动与魔法技能",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      17
    ],
    "dependents": [
      32
    ],
    "mana": 76,
    "lvlmana": -3,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par7": 4,
      "par1": 250,
      "par2": 125,
      "par3": 50,
      "par4": 10
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill42",
        "textbKey": "StrSkill23",
        "textaEn": "Life:",
        "textaZh": "生命：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "lvl*par4"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "dopplezon",
      "minHP": 10,
      "maxHP": 10,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "creates a duplicate of yourself",
    "shortDescZh": "創造一個你自己的影子",
    "longDesc": "that draws fire from enemies\ncreates a duplicate of yourself",
    "longDescZh": "可以吸引敵人攻擊\n你所創造出來的分身",
    "icon": "/skills/icon_28.png",
    "iconActive": "/skills/icon_28_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 29,
    "name": "Evade",
    "nameZh": "迴避",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 1,
    "tabName": "Passive and Magic Skills",
    "tabNameZh": "被动与魔法技能",
    "row": 5,
    "col": 2,
    "reqlevel": 24,
    "reqskills": [
      18
    ],
    "dependents": [
      32
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 10,
      "par2": 65
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill24",
        "textaEn": "percent chance",
        "textaZh": "百分機率",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - dodges when moving",
    "shortDescZh": "被動-移動時迴避",
    "longDesc": "when walking or running\na melee or missile attack\npassive - you have a chance to dodge",
    "longDescZh": "當你在行走或是跑步時有機會\n避開來襲的近戰攻擊或飛箭\n被動-你有機會迴避",
    "icon": "/skills/icon_29.png",
    "iconActive": "/skills/icon_29_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 30,
    "name": "Fend",
    "nameZh": "擊退",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 2,
    "tabName": "Javelin and Spear Skills",
    "tabNameZh": "标枪与长矛技能",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      19
    ],
    "dependents": [],
    "mana": 5,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 1,
      "par2": 60,
      "par3": 70,
      "par4": 10
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill30",
        "textbKey": "StrSkill23",
        "textaEn": "Attack Bonus:",
        "textaZh": "攻擊加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "attacks all adjacent targets",
    "shortDescZh": "攻擊所有鄰近的目標",
    "longDesc": "attacks all adjacent targets",
    "longDescZh": "攻擊所有鄰近的目標",
    "icon": "/skills/icon_30.png",
    "iconActive": "/skills/icon_30_active.png",
    "toHit": 40,
    "toHitLev": 10,
    "startmana": 0
  },
  {
    "id": 31,
    "name": "Freezing Arrow",
    "nameZh": "凍結之箭",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 0,
    "tabName": "Bow and Crossbow Skills",
    "tabNameZh": "弓与弩技能",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      21
    ],
    "dependents": [],
    "mana": 18,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "6",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 40,
    "eMax": 50,
    "eMinLev": [
      10,
      15,
      20,
      22,
      24
    ],
    "eMaxLev": [
      10,
      15,
      20,
      22,
      24
    ],
    "eLen": 50,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 12,
      "par7": 5,
      "par1": 5
    },
    "synergyFormulas": {
      "elemental": "(skill('Cold Arrow'.blvl))*par8",
      "duration": "(skill('Ice Arrow'.blvl)) * par7"
    },
    "synergiesReceived": [
      {
        "providerName": "Cold Arrow",
        "providerId": 11,
        "percentPerLevel": 12,
        "type": "elemental"
      },
      {
        "providerName": "Ice Arrow",
        "providerId": 21,
        "percentPerLevel": 12,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 21,
        "targetName": "Ice Arrow",
        "targetNameZh": "急凍箭",
        "percentPerLevel": 8
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill62",
        "textaEn": "Freezes for",
        "textaZh": "冰凍是因為",
        "calca": "edln"
      },
      {
        "lineType": 10
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "par1"
      }
    ],
    "shortDesc": "enchants arrows to freeze multiple monsters",
    "shortDescZh": "加強的箭矢可以凍住多個怪物",
    "longDesc": "to freeze entire groups of monsters\nmagically enhances an arrow or bolt",
    "longDescZh": "",
    "icon": "/skills/icon_31.png",
    "iconActive": "/skills/icon_31_active.png",
    "toHit": 40,
    "toHitLev": 9,
    "startmana": 0
  },
  {
    "id": 32,
    "name": "Valkyrie",
    "nameZh": "女武神",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 1,
    "tabName": "Passive and Magic Skills",
    "tabNameZh": "被动与魔法技能",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      28,
      29
    ],
    "dependents": [],
    "mana": 25,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 150,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 20,
      "par7": 2,
      "par6": 3,
      "par5": 25,
      "par1": 20,
      "par2": 25,
      "par3": 10,
      "par4": 12
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill31",
        "textbKey": "StrSkill23",
        "textaEn": "Defense Bonus:",
        "textaZh": "防禦加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "(lvl-1)*par3"
      },
      {
        "lineType": 4,
        "textaKey": "StrSkill22",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "par2*(lvl-1)"
      },
      {
        "lineType": 13,
        "calca": "par1 * (lvl - 1) + skill('Dopplezon'.blvl) * par8"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "valkyrie",
      "minHP": 400,
      "maxHP": 480,
      "minDam": 9,
      "maxDam": 24
    },
    "shortDesc": "summons a powerful Valkyrie ally",
    "shortDescZh": "召喚一個威力強大的女武神同伴",
    "longDesc": "summons a powerful Valkyrie ally",
    "longDescZh": "召喚一個威力強大的女武神同伴",
    "icon": "/skills/icon_32.png",
    "iconActive": "/skills/icon_32_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "toHitCalc": "40*lvl+40*skill('Penetrate'.blvl)",
    "startmana": 0
  },
  {
    "id": 33,
    "name": "Pierce",
    "nameZh": "穿刺",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 1,
    "tabName": "Passive and Magic Skills",
    "tabNameZh": "被动与魔法技能",
    "row": 6,
    "col": 3,
    "reqlevel": 30,
    "reqskills": [
      23
    ],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 10,
      "par2": 100
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill24",
        "textaEn": "percent chance",
        "textaZh": "百分機率",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - missiles may continue through enemies",
    "shortDescZh": "被動-飛射武器可以穿過敵人繼續前進",
    "longDesc": "pass through enemies that they hit\npassive - your missiles have a chance to",
    "longDescZh": "在擊中時穿過敵人繼續飛行\n被動-你的飛射武器，有機會",
    "icon": "/skills/icon_33.png",
    "iconActive": "/skills/icon_33_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 34,
    "name": "Lightning Strike",
    "nameZh": "閃電攻擊",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 2,
    "tabName": "Javelin and Spear Skills",
    "tabNameZh": "标枪与长矛技能",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      24
    ],
    "dependents": [],
    "mana": 9,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "17",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 25,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      10,
      15,
      20,
      25,
      30
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 8,
      "par1": 20,
      "par3": 2,
      "par4": 1
    },
    "synergyFormulas": {
      "elemental": "(skill('Charged Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Power Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Charged Strike",
        "providerId": 24,
        "percentPerLevel": 8,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Bolt",
        "providerId": 20,
        "percentPerLevel": 8,
        "type": "elemental"
      },
      {
        "providerName": "Power Strike",
        "providerId": 14,
        "percentPerLevel": 8,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Fury",
        "providerId": 35,
        "percentPerLevel": 8,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 14,
        "targetName": "Power Strike",
        "targetNameZh": "威力一擊",
        "percentPerLevel": 10
      },
      {
        "targetId": 20,
        "targetName": "Lightning Bolt",
        "targetNameZh": "閃電球",
        "percentPerLevel": 3
      },
      {
        "targetId": 24,
        "targetName": "Charged Strike",
        "targetNameZh": "充能一擊",
        "percentPerLevel": 10
      },
      {
        "targetId": 35,
        "targetName": "Lightning Fury",
        "targetNameZh": "閃電之怒",
        "percentPerLevel": 1
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 7,
        "textaKey": "StrSkill11",
        "textaEn": "hits",
        "textaZh": "擊中",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "enchants thrusting weapons with chain lightning",
    "shortDescZh": "讓戳刺性的武器帶著一連串的電擊力量",
    "longDesc": "and releases chain lightning upon impact\nadds lightning damage to javelin and spear class weapons",
    "longDescZh": "加上閃電力量並在撞擊時釋放出來\n在鏢槍或是長矛性的武器",
    "icon": "/skills/icon_34.png",
    "iconActive": "/skills/icon_34_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 35,
    "name": "Lightning Fury",
    "nameZh": "閃電之怒",
    "classCode": "ama",
    "classNameZh": "亚马逊",
    "tabIndex": 2,
    "tabName": "Javelin and Spear Skills",
    "tabNameZh": "标枪与长矛技能",
    "row": 6,
    "col": 3,
    "reqlevel": 30,
    "reqskills": [
      25
    ],
    "dependents": [],
    "mana": 20,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "22",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 40,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      20,
      30,
      40,
      50,
      50
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 1,
      "par1": 2,
      "par2": 1,
      "par3": 15
    },
    "synergyFormulas": {
      "elemental": "(skill('Charged Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Power Strike'.blvl)+skill('Lightning Strike'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Charged Strike",
        "providerId": 24,
        "percentPerLevel": 1,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Bolt",
        "providerId": 20,
        "percentPerLevel": 1,
        "type": "elemental"
      },
      {
        "providerName": "Power Strike",
        "providerId": 14,
        "percentPerLevel": 1,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Strike",
        "providerId": 34,
        "percentPerLevel": 1,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 14,
        "targetName": "Power Strike",
        "targetNameZh": "威力一擊",
        "percentPerLevel": 10
      },
      {
        "targetId": 20,
        "targetName": "Lightning Bolt",
        "targetNameZh": "閃電球",
        "percentPerLevel": 3
      },
      {
        "targetId": 24,
        "targetName": "Charged Strike",
        "targetNameZh": "充能一擊",
        "percentPerLevel": 10
      },
      {
        "targetId": 34,
        "targetName": "Lightning Strike",
        "targetNameZh": "閃電攻擊",
        "percentPerLevel": 8
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill72",
        "textbKey": "StrSkill27",
        "textaEn": "Releases",
        "textaZh": "放出",
        "textbEn": "bolts",
        "textbZh": "彈",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "a lightning bolt that splits on impact",
    "shortDescZh": "一個閃電球在撞擊時會自動分散",
    "longDesc": "bolt of lightning that splits on impact\nchanges a thrown javelin into a powerful",
    "longDescZh": "強大的閃電之球，並在撞擊時自動散開\n把投擲性的鏢槍變成一個威力",
    "icon": "/skills/icon_35.png",
    "iconActive": "/skills/icon_35_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 36,
    "name": "Fire Bolt",
    "nameZh": "火彈",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 0,
    "tabName": "Fire Spells",
    "tabNameZh": "火焰法术",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      47
    ],
    "mana": 5,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 6,
    "eMax": 12,
    "eMinLev": [
      3,
      4,
      8,
      18,
      54
    ],
    "eMaxLev": [
      3,
      6,
      10,
      20,
      56
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 16
    },
    "synergyFormulas": {
      "elemental": "(skill('Fire Ball'.blvl)+skill('Meteor'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Fire Ball",
        "providerId": 47,
        "percentPerLevel": 16,
        "type": "elemental"
      },
      {
        "providerName": "Meteor",
        "providerId": 56,
        "percentPerLevel": 16,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 47,
        "targetName": "Fire Ball",
        "targetNameZh": "火球",
        "percentPerLevel": 14
      },
      {
        "targetId": 56,
        "targetName": "Meteor",
        "targetNameZh": "隕石",
        "percentPerLevel": 5
      },
      {
        "targetId": 62,
        "targetName": "Hydra",
        "targetNameZh": "九頭海蛇",
        "percentPerLevel": 3
      }
    ],
    "masteries": [
      61
    ],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates a missile of flame",
    "shortDescZh": "創造出火焰之箭",
    "longDesc": "creates a magical flaming missile",
    "longDescZh": "創造出魔法性的火焰箭",
    "icon": "/skills/icon_36.png",
    "iconActive": "/skills/icon_36_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 37,
    "name": "Warmth",
    "nameZh": "暖氣",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 0,
    "tabName": "Fire Spells",
    "tabNameZh": "火焰法术",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      52
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 30,
      "par2": 12
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 41,
        "targetName": "Inferno",
        "targetNameZh": "地獄之火",
        "percentPerLevel": 13
      },
      {
        "targetId": 46,
        "targetName": "Blaze",
        "targetNameZh": "熾烈之徑",
        "percentPerLevel": 4
      },
      {
        "targetId": 51,
        "targetName": "Fire Wall",
        "targetNameZh": "火牆",
        "percentPerLevel": 4
      },
      {
        "targetId": 52,
        "targetName": "Enchant",
        "targetNameZh": "強化",
        "percentPerLevel": 9
      }
    ],
    "masteries": [
      61
    ],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill23",
        "textaEn": "percent",
        "textaZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - increases mana recovery rate",
    "shortDescZh": "被動-增加你的法力回復速度",
    "longDesc": "passive - increases the rate at which you recover mana",
    "longDescZh": "被動-讓你的法力回復速度加快",
    "icon": "/skills/icon_37.png",
    "iconActive": "/skills/icon_37_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 38,
    "name": "Charged Bolt",
    "nameZh": "充能彈",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 1,
    "tabName": "Lightning Spells",
    "tabNameZh": "闪电法术",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      49
    ],
    "mana": 24,
    "lvlmana": 4,
    "minmana": 1,
    "manashift": 5,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 4,
    "eMax": 8,
    "eMinLev": [
      1,
      1,
      2,
      3,
      4
    ],
    "eMaxLev": [
      1,
      1,
      2,
      3,
      4
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 6,
      "par1": 3,
      "par2": 1
    },
    "synergyFormulas": {
      "elemental": "(skill('Lightning'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Lightning",
        "providerId": 49,
        "percentPerLevel": 6,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 49,
        "targetName": "Lightning",
        "targetNameZh": "閃電",
        "percentPerLevel": 8
      },
      {
        "targetId": 53,
        "targetName": "Chain Lightning",
        "targetNameZh": "連鎖閃電",
        "percentPerLevel": 4
      }
    ],
    "masteries": [
      63
    ],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill27",
        "textaEn": "bolts",
        "textaZh": "彈",
        "calca": "\"min(24,ln12)\""
      },
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates multiple deadly sparks",
    "shortDescZh": "創造出多重致命火光",
    "longDesc": "bolts of electrical energy\ncreates multiple, randomly directed",
    "longDescZh": "電擊性能量球\n創造出多重、方向不定的",
    "icon": "/skills/icon_38.png",
    "iconActive": "/skills/icon_38_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 39,
    "name": "Ice Bolt",
    "nameZh": "冰彈",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 2,
    "tabName": "Cold Spells",
    "tabNameZh": "冰冷法术",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      45
    ],
    "mana": 3,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 6,
    "eMax": 10,
    "eMinLev": [
      2,
      4,
      6,
      8,
      10
    ],
    "eMaxLev": [
      3,
      5,
      7,
      9,
      11
    ],
    "eLen": 150,
    "eLevLen": [
      35,
      35,
      35
    ],
    "params": {
      "par8": 15
    },
    "synergyFormulas": {
      "elemental": "(skill('Frost Nova'.blvl)+skill('Ice Blast'.blvl)+skill('Glacial Spike'.blvl)+skill('Blizzard'.blvl)+skill('Frozen Orb'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Frost Nova",
        "providerId": 44,
        "percentPerLevel": 15,
        "type": "elemental"
      },
      {
        "providerName": "Ice Blast",
        "providerId": 45,
        "percentPerLevel": 15,
        "type": "elemental"
      },
      {
        "providerName": "Glacial Spike",
        "providerId": 55,
        "percentPerLevel": 15,
        "type": "elemental"
      },
      {
        "providerName": "Blizzard",
        "providerId": 59,
        "percentPerLevel": 15,
        "type": "elemental"
      },
      {
        "providerName": "Frozen Orb",
        "providerId": 64,
        "percentPerLevel": 15,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 45,
        "targetName": "Ice Blast",
        "targetNameZh": "冰風暴",
        "percentPerLevel": 8
      },
      {
        "targetId": 55,
        "targetName": "Glacial Spike",
        "targetNameZh": "冰尖柱",
        "percentPerLevel": 5
      },
      {
        "targetId": 59,
        "targetName": "Blizzard",
        "targetNameZh": "暴風雪",
        "percentPerLevel": 5
      },
      {
        "targetId": 64,
        "targetName": "Frozen Orb",
        "targetNameZh": "冰封球",
        "percentPerLevel": 2
      }
    ],
    "masteries": [
      65
    ],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates a shard of ice that slows enemies",
    "shortDescZh": "創造出一塊冰之碎片，讓敵人行動慢下來",
    "longDesc": "that damages and slows your enemies\ncreates a magical bolt of ice",
    "longDescZh": "讓你的敵人受傷並行動減慢\n創造出一個魔法性的冰之碎片",
    "icon": "/skills/icon_39.png",
    "iconActive": "/skills/icon_39_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 40,
    "name": "Frozen Armor",
    "nameZh": "冰封裝甲",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 2,
    "tabName": "Cold Spells",
    "tabNameZh": "冰冷法术",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      50
    ],
    "mana": 7,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par7": 250,
      "par6": 3,
      "par5": 30,
      "par1": 30,
      "par2": 5,
      "par3": 3000,
      "par4": 300
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 50,
        "targetName": "Shiver Armor",
        "targetNameZh": "碎冰甲",
        "percentPerLevel": 9
      },
      {
        "targetId": 60,
        "targetName": "Chilling Armor",
        "targetNameZh": "寒冰裝甲",
        "percentPerLevel": 7
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill62",
        "textaEn": "Freezes for",
        "textaZh": "冰凍是因為",
        "calca": "ln56*(100+((skill('Shiver Armor'.blvl)+skill('Chilling Armor'.blvl))*par8))/100"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34+(skill('Shiver Armor'.blvl)+skill('Chilling Armor'.blvl))*par7"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill31",
        "textbKey": "StrSkill23",
        "textaEn": "Defense Bonus:",
        "textaZh": "防禦加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "improves defense and freezes attacker",
    "shortDescZh": "加強你的防禦力，並讓攻擊者冰封",
    "longDesc": "and freezes enemies that hit you\nincreases your defense rating",
    "longDescZh": "並讓敵人擊中你時受到冰封\n可以增加你的防禦等級",
    "icon": "/skills/icon_40.png",
    "iconActive": "/skills/icon_40_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34+(skill('Shiver Armor'.blvl)+skill('Chilling Armor'.blvl))*par7",
    "startmana": 0
  },
  {
    "id": 41,
    "name": "Inferno",
    "nameZh": "地獄之火",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 0,
    "tabName": "Fire Spells",
    "tabNameZh": "火焰法术",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      46
    ],
    "mana": 36,
    "lvlmana": 1,
    "minmana": 0,
    "manashift": 2,
    "delay": 0,
    "descdam": "8",
    "hitshift": 2,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 32,
    "eMax": 64,
    "eMinLev": [
      24,
      26,
      28,
      32,
      36
    ],
    "eMaxLev": [
      24,
      27,
      29,
      33,
      37
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 13,
      "par1": 20,
      "par2": 3,
      "par3": 6
    },
    "synergyFormulas": {
      "elemental": "(skill('Warmth'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Warmth",
        "providerId": 37,
        "percentPerLevel": 13,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 51,
        "targetName": "Fire Wall",
        "targetNameZh": "火牆",
        "percentPerLevel": 1
      }
    ],
    "masteries": [
      61
    ],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill3",
        "textbKey": "StrSkill34",
        "textaEn": "Mana Cost:",
        "textaZh": "法力耗費：",
        "textbEn": "per second",
        "textbZh": "每秒",
        "calca": "mps"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill56",
        "textaEn": "Range:",
        "textaZh": "射程",
        "calca": "ln12/4"
      },
      {
        "lineType": 11
      },
      {
        "lineType": 26
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 5,
        "textaKey": "StrSkill115",
        "textaEn": "Minimum Mana Required to Cast:",
        "textaZh": "施展法術至少須要法力點數為：",
        "calca": "par3"
      }
    ],
    "shortDesc": "creates a jet of flame",
    "shortDescZh": "創造出一團噴射的火焰",
    "longDesc": "to scorch your enemies\ncreates a continuous jet of flame",
    "longDescZh": "燒焦你的敵人\n創造出一團噴射性火焰",
    "icon": "/skills/icon_41.png",
    "iconActive": "/skills/icon_41_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 6
  },
  {
    "id": 42,
    "name": "Static Field",
    "nameZh": "靜態力場",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 1,
    "tabName": "Lightning Spells",
    "tabNameZh": "闪电法术",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      48
    ],
    "mana": 9,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 5,
      "par2": 1,
      "par4": 25
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [
      63
    ],
    "descLines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill33",
        "textbKey": "StrSkill23",
        "textaEn": "Weakens Enemies by",
        "textaZh": "可以讓敵人變弱",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "par4"
      }
    ],
    "shortDesc": "creates a field of deadly sparks",
    "shortDescZh": "創造一個充滿致命火星的力場",
    "longDesc": "of all nearby enemies\ncreates an electrical field that reduces life",
    "longDescZh": "所有敵人的生命\n創造一道閃電結界，降低附近",
    "icon": "/skills/icon_42.png",
    "iconActive": "/skills/icon_42_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 43,
    "name": "Telekinesis",
    "nameZh": "心靈傳動",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 1,
    "tabName": "Lightning Spells",
    "tabNameZh": "闪电法术",
    "row": 2,
    "col": 3,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      54
    ],
    "mana": 7,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 2,
    "eMinLev": [
      1,
      1,
      1,
      1,
      1
    ],
    "eMaxLev": [
      1,
      1,
      1,
      1,
      1
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 25,
      "par2": 35
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [
      63
    ],
    "descLines": [
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "moves objects with your mind",
    "shortDescZh": "利用你的意志移動物品",
    "longDesc": "and knock back enemies\npick up items, use objects,\nuses the power of your mind to",
    "longDescZh": "並擊退敵人\n拾取物品，使用物品\n利用你的意志力量來",
    "icon": "/skills/icon_43.png",
    "iconActive": "/skills/icon_43_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 44,
    "name": "Frost Nova",
    "nameZh": "霜之新星",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 2,
    "tabName": "Cold Spells",
    "tabNameZh": "冰冷法术",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      59
    ],
    "mana": 9,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 4,
    "eMax": 8,
    "eMinLev": [
      4,
      6,
      8,
      10,
      12
    ],
    "eMaxLev": [
      5,
      7,
      9,
      11,
      13
    ],
    "eLen": 200,
    "eLevLen": [
      25,
      25,
      25
    ],
    "params": {
      "par8": 10,
      "par1": 9,
      "par2": 3
    },
    "synergyFormulas": {
      "elemental": "(skill('Blizzard'.blvl)+skill('Frozen Orb'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Blizzard",
        "providerId": 59,
        "percentPerLevel": 10,
        "type": "elemental"
      },
      {
        "providerName": "Frozen Orb",
        "providerId": 64,
        "percentPerLevel": 10,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 39,
        "targetName": "Ice Bolt",
        "targetNameZh": "冰彈",
        "percentPerLevel": 15
      }
    ],
    "masteries": [
      65
    ],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates a freezing ring",
    "shortDescZh": "創造出一個冷凍之環",
    "longDesc": "and slows all nearby enemies\ncreates an expanding ring of ice that damages",
    "longDescZh": "減慢所有附近的敵人\n創造出一個不斷擴張的冰之環，傷害並",
    "icon": "/skills/icon_44.png",
    "iconActive": "/skills/icon_44_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 45,
    "name": "Ice Blast",
    "nameZh": "冰風暴",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 2,
    "tabName": "Cold Spells",
    "tabNameZh": "冰冷法术",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [
      39
    ],
    "dependents": [
      50,
      55
    ],
    "mana": 12,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 16,
    "eMax": 24,
    "eMinLev": [
      14,
      28,
      42,
      56,
      70
    ],
    "eMaxLev": [
      15,
      29,
      43,
      57,
      71
    ],
    "eLen": 75,
    "eLevLen": [
      5,
      5,
      5
    ],
    "params": {
      "par8": 8,
      "par7": 10,
      "par1": 75,
      "par2": 5
    },
    "synergyFormulas": {
      "elemental": "(skill('Ice Bolt'.blvl)+skill('Blizzard'.blvl)+skill('Frozen Orb'.blvl))*par8",
      "duration": "(skill('Glacial Spike'.blvl))*par7"
    },
    "synergiesReceived": [
      {
        "providerName": "Ice Bolt",
        "providerId": 39,
        "percentPerLevel": 8,
        "type": "elemental"
      },
      {
        "providerName": "Blizzard",
        "providerId": 59,
        "percentPerLevel": 8,
        "type": "elemental"
      },
      {
        "providerName": "Frozen Orb",
        "providerId": 64,
        "percentPerLevel": 8,
        "type": "elemental"
      },
      {
        "providerName": "Glacial Spike",
        "providerId": 55,
        "percentPerLevel": 8,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 39,
        "targetName": "Ice Bolt",
        "targetNameZh": "冰彈",
        "percentPerLevel": 15
      },
      {
        "targetId": 55,
        "targetName": "Glacial Spike",
        "targetNameZh": "冰尖柱",
        "percentPerLevel": 5
      },
      {
        "targetId": 59,
        "targetName": "Blizzard",
        "targetNameZh": "暴風雪",
        "percentPerLevel": 5
      }
    ],
    "masteries": [
      65
    ],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill62",
        "textaEn": "Freezes for",
        "textaZh": "冰凍是因為",
        "calca": "edln"
      },
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates an ice bolt that freezes enemies",
    "shortDescZh": "創造出一個冰彈，把敵人統統凍住",
    "longDesc": "damages and freezes your enemy\ncreates a magical sphere of ice that",
    "longDescZh": "重傷並冰凍你的敵人\n創造出一個魔法冰球，",
    "icon": "/skills/icon_45.png",
    "iconActive": "/skills/icon_45_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 46,
    "name": "Blaze",
    "nameZh": "熾烈之徑",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 0,
    "tabName": "Fire Spells",
    "tabNameZh": "火焰法术",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [
      41
    ],
    "dependents": [
      51
    ],
    "mana": 22,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "9",
    "hitshift": 4,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 4,
    "eMax": 8,
    "eMinLev": [
      2,
      3,
      4,
      6,
      9
    ],
    "eMaxLev": [
      2,
      3,
      4,
      6,
      9
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 4,
      "par7": 1,
      "par1": 50,
      "par2": 500
    },
    "synergyFormulas": {
      "elemental": "skill('Warmth'.blvl)*par8+skill('Fire Wall'.blvl)*par7"
    },
    "synergiesReceived": [
      {
        "providerName": "Warmth",
        "providerId": 37,
        "percentPerLevel": 4,
        "type": "elemental"
      },
      {
        "providerName": "Fire Wall",
        "providerId": 51,
        "percentPerLevel": 1,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [
      61
    ],
    "descLines": [
      {
        "lineType": 27
      },
      {
        "lineType": 23,
        "textaKey": "StrSkill82",
        "textaEn": "Fire Duration:",
        "textaZh": "火焰持續："
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates fire in your wake",
    "shortDescZh": "創造你的復甦之火",
    "longDesc": "in your wake to scorch your enemies\ncreates a wall of fire",
    "longDescZh": "如同你復甦一樣燒烤敵人\n創造出一道火牆",
    "icon": "/skills/icon_46.png",
    "iconActive": "/skills/icon_46_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "dm12",
    "startmana": 0
  },
  {
    "id": 47,
    "name": "Fire Ball",
    "nameZh": "火球",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 0,
    "tabName": "Fire Spells",
    "tabNameZh": "火焰法术",
    "row": 3,
    "col": 2,
    "reqlevel": 12,
    "reqskills": [
      36
    ],
    "dependents": [
      52,
      56
    ],
    "mana": 10,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 12,
    "eMax": 28,
    "eMinLev": [
      13,
      23,
      28,
      33,
      38
    ],
    "eMaxLev": [
      15,
      25,
      30,
      35,
      40
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 14
    },
    "synergyFormulas": {
      "elemental": "(skill('Fire Bolt'.blvl)+skill('Meteor'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Fire Bolt",
        "providerId": 36,
        "percentPerLevel": 14,
        "type": "elemental"
      },
      {
        "providerName": "Meteor",
        "providerId": 56,
        "percentPerLevel": 14,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 36,
        "targetName": "Fire Bolt",
        "targetNameZh": "火彈",
        "percentPerLevel": 16
      },
      {
        "targetId": 56,
        "targetName": "Meteor",
        "targetNameZh": "隕石",
        "percentPerLevel": 5
      },
      {
        "targetId": 62,
        "targetName": "Hydra",
        "targetNameZh": "九頭海蛇",
        "percentPerLevel": 3
      }
    ],
    "masteries": [
      61
    ],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 28
      }
    ],
    "shortDesc": "creates an explosive sphere of fire",
    "shortDescZh": "創造出一團爆炸性的火焰球體",
    "longDesc": "to engulf your enemies\ncreates an explosive sphere of fiery death",
    "longDescZh": "將敵人吞沒\n創造出一團爆炸性的致命球體",
    "icon": "/skills/icon_47.png",
    "iconActive": "/skills/icon_47_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 48,
    "name": "Nova",
    "nameZh": "新星",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 1,
    "tabName": "Lightning Spells",
    "tabNameZh": "闪电法术",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [
      42
    ],
    "dependents": [
      57
    ],
    "mana": 15,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 20,
    "eMinLev": [
      6,
      7,
      8,
      9,
      10
    ],
    "eMaxLev": [
      8,
      9,
      10,
      11,
      12
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 12,
      "par2": 4
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 49,
        "targetName": "Lightning",
        "targetNameZh": "閃電",
        "percentPerLevel": 8
      },
      {
        "targetId": 53,
        "targetName": "Chain Lightning",
        "targetNameZh": "連鎖閃電",
        "percentPerLevel": 4
      }
    ],
    "masteries": [
      63
    ],
    "descLines": [
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates an electrically charged ring",
    "shortDescZh": "創造出一個充滿電擊力量之環",
    "longDesc": "to shock nearby enemies\ncreates an expanding ring of lightning",
    "longDescZh": "電擊附近的所有敵人\n創造出一個充滿電擊力量之環",
    "icon": "/skills/icon_48.png",
    "iconActive": "/skills/icon_48_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 49,
    "name": "Lightning",
    "nameZh": "閃電",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 1,
    "tabName": "Lightning Spells",
    "tabNameZh": "闪电法术",
    "row": 3,
    "col": 2,
    "reqlevel": 12,
    "reqskills": [
      38
    ],
    "dependents": [
      53
    ],
    "mana": 16,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 40,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      8,
      12,
      20,
      28,
      36
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 8,
      "par1": 10,
      "par2": 20,
      "par3": 4
    },
    "synergyFormulas": {
      "elemental": "(skill('Charged Bolt'.blvl)+skill('Chain Lightning'.blvl)+skill('Nova'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Charged Bolt",
        "providerId": 38,
        "percentPerLevel": 8,
        "type": "elemental"
      },
      {
        "providerName": "Chain Lightning",
        "providerId": 53,
        "percentPerLevel": 8,
        "type": "elemental"
      },
      {
        "providerName": "Nova",
        "providerId": 48,
        "percentPerLevel": 8,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 38,
        "targetName": "Charged Bolt",
        "targetNameZh": "充能彈",
        "percentPerLevel": 6
      },
      {
        "targetId": 53,
        "targetName": "Chain Lightning",
        "targetNameZh": "連鎖閃電",
        "percentPerLevel": 4
      }
    ],
    "masteries": [
      63
    ],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates a bolt of lightning",
    "shortDescZh": "創造一個閃電之球",
    "longDesc": "to lay waste to your enemies\ncreates a powerful lightning bolt",
    "longDescZh": "毀掉你的敵人\n創造一個威力強大的閃電之球",
    "icon": "/skills/icon_49.png",
    "iconActive": "/skills/icon_49_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 50,
    "name": "Shiver Armor",
    "nameZh": "碎冰甲",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 2,
    "tabName": "Cold Spells",
    "tabNameZh": "冰冷法术",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      45,
      40
    ],
    "dependents": [
      60
    ],
    "mana": 11,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 12,
    "eMax": 16,
    "eMinLev": [
      4,
      6,
      8,
      10,
      12
    ],
    "eMaxLev": [
      5,
      7,
      9,
      11,
      13
    ],
    "eLen": 100,
    "eLevLen": [
      0,
      25,
      50
    ],
    "params": {
      "par8": 9,
      "par7": 250,
      "par1": 45,
      "par2": 6,
      "par3": 3000,
      "par4": 300
    },
    "synergyFormulas": {
      "elemental": "(skill('Frozen Armor'.blvl)+skill('Chilling Armor'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Frozen Armor",
        "providerId": 40,
        "percentPerLevel": 9,
        "type": "elemental"
      },
      {
        "providerName": "Chilling Armor",
        "providerId": 60,
        "percentPerLevel": 9,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 60,
        "targetName": "Chilling Armor",
        "targetNameZh": "寒冰裝甲",
        "percentPerLevel": 7
      }
    ],
    "masteries": [
      65
    ],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill31",
        "textbKey": "StrSkill23",
        "textaEn": "Defense Bonus:",
        "textaZh": "防禦加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34+(skill('Frozen Armor'.blvl)+skill('Chilling Armor'.blvl))*par7"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "freezes and damages attackers",
    "shortDescZh": "讓攻擊你的人受傷並冰凍",
    "longDesc": "freezes and damages enemies that hit you\nincreases your defense rating",
    "longDescZh": "並且可以讓擊中你的敵人冰封並受傷\n增加你的防禦等級",
    "icon": "/skills/icon_50.png",
    "iconActive": "/skills/icon_50_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34+(skill('Frozen Armor'.blvl)+skill('Chilling Armor'.blvl))*par7",
    "startmana": 0
  },
  {
    "id": 51,
    "name": "Fire Wall",
    "nameZh": "火牆",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 0,
    "tabName": "Fire Spells",
    "tabNameZh": "火焰法术",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      46
    ],
    "dependents": [
      56
    ],
    "mana": 22,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 35,
    "descdam": "9",
    "hitshift": 4,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 15,
    "eMax": 20,
    "eMinLev": [
      9,
      14,
      21,
      21,
      21
    ],
    "eMaxLev": [
      9,
      14,
      21,
      21,
      21
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 4,
      "par7": 1
    },
    "synergyFormulas": {
      "elemental": "(skill('Warmth'.blvl)*par8+skill('Inferno'.blvl)*par7"
    },
    "synergiesReceived": [
      {
        "providerName": "Warmth",
        "providerId": 37,
        "percentPerLevel": 4,
        "type": "elemental"
      },
      {
        "providerName": "Inferno",
        "providerId": 41,
        "percentPerLevel": 1,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 46,
        "targetName": "Blaze",
        "targetNameZh": "熾烈之徑",
        "percentPerLevel": 1
      }
    ],
    "masteries": [
      61
    ],
    "descLines": [
      {
        "lineType": 29
      },
      {
        "lineType": 27
      },
      {
        "lineType": 30,
        "textaKey": "StrSkill82",
        "textaEn": "Fire Duration:",
        "textaZh": "火焰持續："
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates a wall of flame",
    "shortDescZh": "創造一道火焰之牆",
    "longDesc": "blocks or burns your enemies\ncreates a wall of flame that",
    "longDescZh": "阻檔或是焚燒你的敵人\n創造一道火焰之牆",
    "icon": "/skills/icon_51.png",
    "iconActive": "/skills/icon_51_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 52,
    "name": "Enchant",
    "nameZh": "強化",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 0,
    "tabName": "Fire Spells",
    "tabNameZh": "火焰法术",
    "row": 4,
    "col": 3,
    "reqlevel": 18,
    "reqskills": [
      37,
      47
    ],
    "dependents": [
      62
    ],
    "mana": 25,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 16,
    "eMax": 20,
    "eMinLev": [
      3,
      7,
      11,
      15,
      19
    ],
    "eMaxLev": [
      5,
      9,
      13,
      17,
      21
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 9,
      "par1": 3600,
      "par2": 600,
      "par3": 33
    },
    "synergyFormulas": {
      "elemental": "(skill('Warmth'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Warmth",
        "providerId": 37,
        "percentPerLevel": 9,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [
      61
    ],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill30",
        "textbKey": "StrSkill23",
        "textaEn": "Attack Bonus:",
        "textaZh": "攻擊加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 10
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "enchants melee or ranged weapons with fire",
    "shortDescZh": "讓你的近戰或是長距離武器附上火焰",
    "longDesc": "adds one-third fire damage to ranged weapons\nadds fire damage to melee weapons\nenchants equipped weapon of targeted character or minion",
    "longDescZh": "讓長距離武器增加三分之一的破壞力\n在近戰武器附上火焰性傷害\n讓施法目標的人物或是隨從的武器變強",
    "icon": "/skills/icon_52.png",
    "iconActive": "/skills/icon_52_active.png",
    "toHit": 20,
    "toHitLev": 9,
    "auraLenCalc": "ln12",
    "startmana": 0
  },
  {
    "id": 53,
    "name": "Chain Lightning",
    "nameZh": "連鎖閃電",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 1,
    "tabName": "Lightning Spells",
    "tabNameZh": "闪电法术",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      49
    ],
    "dependents": [
      57,
      58
    ],
    "mana": 9,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 40,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      11,
      13,
      15,
      15,
      15
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 4,
      "par5": 5,
      "par1": 20,
      "par3": 26,
      "par4": 1
    },
    "synergyFormulas": {
      "elemental": "(skill('Charged Bolt'.blvl)+skill('Lightning'.blvl)+skill('Nova'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Charged Bolt",
        "providerId": 38,
        "percentPerLevel": 4,
        "type": "elemental"
      },
      {
        "providerName": "Lightning",
        "providerId": 49,
        "percentPerLevel": 4,
        "type": "elemental"
      },
      {
        "providerName": "Nova",
        "providerId": 48,
        "percentPerLevel": 4,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 49,
        "targetName": "Lightning",
        "targetNameZh": "閃電",
        "percentPerLevel": 8
      }
    ],
    "masteries": [
      63
    ],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 7,
        "textaKey": "StrSkill11",
        "textaEn": "hits",
        "textaZh": "擊中",
        "calca": "ln34/par5"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates a bolt of lightning that arcs",
    "shortDescZh": "創造一個充滿電弧的光球",
    "longDesc": "arcs through several targets\ncreates a bolt of lightning that",
    "longDescZh": "其中的電弧會流經數個敵人身上\n創造一個閃電之球撞擊後",
    "icon": "/skills/icon_53.png",
    "iconActive": "/skills/icon_53_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 54,
    "name": "Teleport",
    "nameZh": "傳送",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 1,
    "tabName": "Lightning Spells",
    "tabNameZh": "闪电法术",
    "row": 4,
    "col": 3,
    "reqlevel": 18,
    "reqskills": [
      43
    ],
    "dependents": [
      58
    ],
    "mana": 24,
    "lvlmana": -1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {},
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [],
    "dsc2Lines": [],
    "shortDesc": "instantly moves to destination",
    "shortDescZh": "馬上移動到目標",
    "longDesc": "instantly moves to a destination within your line of sight",
    "longDescZh": "馬上移動到你視線所及的目的地",
    "icon": "/skills/icon_54.png",
    "iconActive": "/skills/icon_54_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 55,
    "name": "Glacial Spike",
    "nameZh": "冰尖柱",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 2,
    "tabName": "Cold Spells",
    "tabNameZh": "冰冷法术",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      45
    ],
    "dependents": [
      59
    ],
    "mana": 20,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 32,
    "eMax": 48,
    "eMinLev": [
      14,
      26,
      28,
      30,
      32
    ],
    "eMaxLev": [
      15,
      27,
      29,
      31,
      33
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par7": 3,
      "par1": 4,
      "par3": 50,
      "par4": 3
    },
    "synergyFormulas": {
      "elemental": "(skill('Ice Bolt'.blvl)+skill('Ice Blast'.blvl)+skill('Frozen Orb'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Ice Bolt",
        "providerId": 39,
        "percentPerLevel": 5,
        "type": "elemental"
      },
      {
        "providerName": "Ice Blast",
        "providerId": 45,
        "percentPerLevel": 5,
        "type": "elemental"
      },
      {
        "providerName": "Frozen Orb",
        "providerId": 64,
        "percentPerLevel": 5,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 39,
        "targetName": "Ice Bolt",
        "targetNameZh": "冰彈",
        "percentPerLevel": 15
      },
      {
        "targetId": 45,
        "targetName": "Ice Blast",
        "targetNameZh": "冰風暴",
        "percentPerLevel": 8
      },
      {
        "targetId": 59,
        "targetName": "Blizzard",
        "targetNameZh": "暴風雪",
        "percentPerLevel": 5
      }
    ],
    "masteries": [
      65
    ],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill62",
        "textaEn": "Freezes for",
        "textaZh": "冰凍是因為",
        "calca": "ln34 * (100 + skill('Blizzard'.blvl) * par7) / 100"
      },
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "shortDesc": "creates a freezing comet of ice",
    "shortDescZh": "創造出一個尖冰形成的彗星",
    "longDesc": "that freezes or kills nearby enemies\ncreates a magical ice comet",
    "longDescZh": "凍結或是殺死臨近的敵人\n創造出一個魔法的尖冰彗星",
    "icon": "/skills/icon_55.png",
    "iconActive": "/skills/icon_55_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34 * (100 + skill('Blizzard'.blvl) * par7) / 100",
    "startmana": 0
  },
  {
    "id": 56,
    "name": "Meteor",
    "nameZh": "隕石",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 0,
    "tabName": "Fire Spells",
    "tabNameZh": "火焰法术",
    "row": 5,
    "col": 2,
    "reqlevel": 24,
    "reqskills": [
      47,
      51
    ],
    "dependents": [],
    "mana": 34,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 30,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 80,
    "eMax": 100,
    "eMinLev": [
      23,
      39,
      79,
      81,
      83
    ],
    "eMaxLev": [
      25,
      41,
      81,
      83,
      85
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par1": 6,
      "par3": 30,
      "par4": 15
    },
    "synergyFormulas": {
      "elemental": "(skill('Fire Bolt'.blvl)+skill('Fire Ball'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Fire Bolt",
        "providerId": 36,
        "percentPerLevel": 5,
        "type": "elemental"
      },
      {
        "providerName": "Fire Ball",
        "providerId": 47,
        "percentPerLevel": 5,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 36,
        "targetName": "Fire Bolt",
        "targetNameZh": "火彈",
        "percentPerLevel": 16
      },
      {
        "targetId": 47,
        "targetName": "Fire Ball",
        "targetNameZh": "火球",
        "percentPerLevel": 14
      }
    ],
    "masteries": [
      61
    ],
    "descLines": [
      {
        "lineType": 22
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      },
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "summons a meteor from the heavens",
    "shortDescZh": "從天堂召喚一枚隕石",
    "longDesc": "to crush and incinerate your enemies\nsummons a meteor from the heavens",
    "longDescZh": "壓碎並焚化你的敵人\n從天堂召喚一枚隕石",
    "icon": "/skills/icon_56.png",
    "iconActive": "/skills/icon_56_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 57,
    "name": "Thunder Storm",
    "nameZh": "雷雲風暴",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 1,
    "tabName": "Lightning Spells",
    "tabNameZh": "闪电法术",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      48,
      53
    ],
    "dependents": [],
    "mana": 19,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 100,
    "eMinLev": [
      10,
      10,
      11,
      11,
      11
    ],
    "eMaxLev": [
      10,
      10,
      11,
      11,
      11
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par7": 17,
      "par6": 100,
      "par5": 0,
      "par1": 800,
      "par2": 200,
      "par3": 25,
      "par4": 100
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [
      63
    ],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "summons a powerful tempest",
    "shortDescZh": "召喚威力強大的暴風雨",
    "longDesc": "your enemies with bolts of lightning\nsummons a deadly thunderstorm that strikes",
    "longDescZh": "以連續的電球攻擊你的敵人\n召喚致命的雷電風暴",
    "icon": "/skills/icon_57.png",
    "iconActive": "/skills/icon_57_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln12",
    "startmana": 0
  },
  {
    "id": 58,
    "name": "Energy Shield",
    "nameZh": "能量護盾",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 1,
    "tabName": "Lightning Spells",
    "tabNameZh": "闪电法术",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      54,
      53
    ],
    "dependents": [],
    "mana": 5,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 20,
    "eMax": 0,
    "eMinLev": [
      5,
      2,
      1,
      1,
      1
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par5": 32,
      "par1": 3600,
      "par2": 1500
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill40",
        "textbKey": "StrSkill23",
        "textaEn": "Absorbs",
        "textaZh": "吸收",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "\"min(edmn,95)\""
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "uses your mana as a shield",
    "shortDescZh": "以你的法力做為護盾",
    "longDesc": "instead of health when you take damage\ncreates a magical shield that consumes mana",
    "longDescZh": "當你受傷時代替耗損的生命\n形成一個耗損法力的魔法護盾",
    "icon": "/skills/icon_58.png",
    "iconActive": "/skills/icon_58_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln12",
    "startmana": 0
  },
  {
    "id": 59,
    "name": "Blizzard",
    "nameZh": "暴風雪",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 2,
    "tabName": "Cold Spells",
    "tabNameZh": "冰冷法术",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      44,
      55
    ],
    "dependents": [
      64
    ],
    "mana": 23,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 45,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 45,
    "eMax": 75,
    "eMinLev": [
      15,
      30,
      45,
      55,
      65
    ],
    "eMaxLev": [
      16,
      31,
      46,
      56,
      66
    ],
    "eLen": 100,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par1": 7,
      "par3": 4
    },
    "synergyFormulas": {
      "elemental": "(skill('Ice Bolt'.blvl)+skill('Ice Blast'.blvl)+skill('Glacial Spike'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Ice Bolt",
        "providerId": 39,
        "percentPerLevel": 5,
        "type": "elemental"
      },
      {
        "providerName": "Ice Blast",
        "providerId": 45,
        "percentPerLevel": 5,
        "type": "elemental"
      },
      {
        "providerName": "Glacial Spike",
        "providerId": 55,
        "percentPerLevel": 5,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 39,
        "targetName": "Ice Bolt",
        "targetNameZh": "冰彈",
        "percentPerLevel": 15
      },
      {
        "targetId": 44,
        "targetName": "Frost Nova",
        "targetNameZh": "霜之新星",
        "percentPerLevel": 10
      },
      {
        "targetId": 45,
        "targetName": "Ice Blast",
        "targetNameZh": "冰風暴",
        "percentPerLevel": 8
      }
    ],
    "masteries": [
      65
    ],
    "descLines": [
      {
        "lineType": 23,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續："
      },
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "summons a massive ice storm",
    "shortDescZh": "召喚一場強大的冰雪暴",
    "longDesc": "summons massive shards of ice to destroy your enemies",
    "longDescZh": "召喚大量的冰塊並摧毀你的敵人",
    "icon": "/skills/icon_59.png",
    "iconActive": "/skills/icon_59_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 60,
    "name": "Chilling Armor",
    "nameZh": "寒冰裝甲",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 2,
    "tabName": "Cold Spells",
    "tabNameZh": "冰冷法术",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      50
    ],
    "dependents": [],
    "mana": 17,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 8,
    "eMax": 12,
    "eMinLev": [
      2,
      4,
      6,
      8,
      10
    ],
    "eMaxLev": [
      3,
      5,
      7,
      9,
      11
    ],
    "eLen": 100,
    "eLevLen": [
      0,
      25,
      25
    ],
    "params": {
      "par8": 7,
      "par7": 250,
      "par1": 45,
      "par2": 5,
      "par3": 3600,
      "par4": 150
    },
    "synergyFormulas": {
      "elemental": "(skill('Frozen Armor'.blvl)+skill('Shiver Armor'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Frozen Armor",
        "providerId": 40,
        "percentPerLevel": 7,
        "type": "elemental"
      },
      {
        "providerName": "Shiver Armor",
        "providerId": 50,
        "percentPerLevel": 7,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 50,
        "targetName": "Shiver Armor",
        "targetNameZh": "碎冰甲",
        "percentPerLevel": 9
      }
    ],
    "masteries": [
      65
    ],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34+(skill('Frozen Armor'.blvl)+skill('Shiver Armor'.blvl))*par7"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill31",
        "textbKey": "StrSkill23",
        "textaEn": "Defense Bonus:",
        "textaZh": "防禦加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "retaliates against ranged attackers",
    "shortDescZh": "報復遠距離攻擊者",
    "longDesc": "against ranged attackers\nincreases defense and discharges an ice bolt in retaliation",
    "longDescZh": "射出復仇的冰彈\n增加防禦力，並對以遠距離攻擊你的敵人",
    "icon": "/skills/icon_60.png",
    "iconActive": "/skills/icon_60_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34+(skill('Frozen Armor'.blvl)+skill('Shiver Armor'.blvl))*par7",
    "startmana": 0
  },
  {
    "id": 61,
    "name": "Fire Mastery",
    "nameZh": "支配之焰",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 0,
    "tabName": "Fire Spells",
    "tabNameZh": "火焰法术",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 30,
      "par2": 7
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill5",
        "textbKey": "StrSkill23",
        "textaEn": "Fire Damage:",
        "textaZh": "火焰傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - increases fire damage",
    "shortDescZh": "被動-增加火焰傷害",
    "longDesc": "passive - increases all damage caused by your fire spells",
    "longDescZh": "被動-讓你的火焰法術的傷害力量變強",
    "icon": "/skills/icon_61.png",
    "iconActive": "/skills/icon_61_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 62,
    "name": "Hydra",
    "nameZh": "九頭海蛇",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 0,
    "tabName": "Fire Spells",
    "tabNameZh": "火焰法术",
    "row": 6,
    "col": 3,
    "reqlevel": 30,
    "reqskills": [
      52
    ],
    "dependents": [],
    "mana": 40,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 40,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 28,
    "eMax": 39,
    "eMinLev": [
      11,
      15,
      19,
      23,
      27
    ],
    "eMaxLev": [
      13,
      17,
      21,
      25,
      29
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 3,
      "par1": 250
    },
    "synergyFormulas": {
      "elemental": "(skill('Fire Bolt'.blvl) + skill('Fire Ball'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Fire Bolt",
        "providerId": 36,
        "percentPerLevel": 3,
        "type": "elemental"
      },
      {
        "providerName": "Fire Ball",
        "providerId": 47,
        "percentPerLevel": 3,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [
      61
    ],
    "descLines": [
      {
        "lineType": 24,
        "textaKey": "StrSkill113",
        "textaEn": "Hydra Fire Damage:",
        "textaZh": "九頭蛇火焰傷害："
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "hydra1",
      "minHP": 0,
      "maxHP": 0,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summons multi-headed fire beast",
    "shortDescZh": "召喚多頭的火焰獸",
    "longDesc": "to reduce your enemies to ashes\nsummons a multi-headed beast of flame",
    "longDescZh": "把你的敵人化為灰\n召喚多頭的火焰獸",
    "icon": "/skills/icon_62.png",
    "iconActive": "/skills/icon_62_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 63,
    "name": "Lightning Mastery",
    "nameZh": "支配閃電",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 1,
    "tabName": "Lightning Spells",
    "tabNameZh": "闪电法术",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 50,
      "par2": 12
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill7",
        "textbKey": "StrSkill23",
        "textaEn": "Lightning Damage:",
        "textaZh": "閃電傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - increases lightning damage",
    "shortDescZh": "被動-增加閃電傷害",
    "longDesc": "passive - increases all damage caused by your lightning spells",
    "longDescZh": "被動-增加閃電法術所造成的所有傷害",
    "icon": "/skills/icon_63.png",
    "iconActive": "/skills/icon_63_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 64,
    "name": "Frozen Orb",
    "nameZh": "冰封球",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 2,
    "tabName": "Cold Spells",
    "tabNameZh": "冰冷法术",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      59
    ],
    "dependents": [],
    "mana": 50,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 25,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 80,
    "eMax": 90,
    "eMinLev": [
      20,
      24,
      28,
      29,
      30
    ],
    "eMaxLev": [
      21,
      25,
      29,
      30,
      31
    ],
    "eLen": 200,
    "eLevLen": [
      25,
      25,
      25
    ],
    "params": {
      "par8": 2
    },
    "synergyFormulas": {
      "elemental": "(skill('Ice Bolt'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Ice Bolt",
        "providerId": 39,
        "percentPerLevel": 2,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 39,
        "targetName": "Ice Bolt",
        "targetNameZh": "冰彈",
        "percentPerLevel": 15
      },
      {
        "targetId": 44,
        "targetName": "Frost Nova",
        "targetNameZh": "霜之新星",
        "percentPerLevel": 10
      },
      {
        "targetId": 45,
        "targetName": "Ice Blast",
        "targetNameZh": "冰風暴",
        "percentPerLevel": 8
      },
      {
        "targetId": 55,
        "targetName": "Glacial Spike",
        "targetNameZh": "冰尖柱",
        "percentPerLevel": 5
      }
    ],
    "masteries": [
      65
    ],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates a globe of frozen death",
    "shortDescZh": "創造一個冰凍的死亡之球",
    "longDesc": "to lay waste to your enemies\ncreates a magical globe that sprays a torrent of ice bolts",
    "longDescZh": "毀掉你的敵人\n創造一個魔法之球噴出大量的冰彈",
    "icon": "/skills/icon_64.png",
    "iconActive": "/skills/icon_64_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 65,
    "name": "Cold Mastery",
    "nameZh": "支配冰冷",
    "classCode": "sor",
    "classNameZh": "法师",
    "tabIndex": 2,
    "tabName": "Cold Spells",
    "tabNameZh": "冰冷法术",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 20,
      "par2": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill23",
        "textaEn": "percent",
        "textaZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - cold attacks become piercing",
    "shortDescZh": "被動-冰系攻擊具有刺穿性",
    "longDesc": "by piercing enemies' resistances to cold\npassive - increases the damage of your cold attacks",
    "longDescZh": "增加冰系法術的傷害\n被動-以提供刺穿能力來",
    "icon": "/skills/icon_65.png",
    "iconActive": "/skills/icon_65_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 66,
    "name": "Amplify Damage",
    "nameZh": "傷害加深",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 0,
    "tabName": "Curses",
    "tabNameZh": "诅咒",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      72,
      76
    ],
    "mana": 4,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par5": 100,
      "par1": 3,
      "par2": 1,
      "par3": 200,
      "par4": 75
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill37",
        "textbKey": "StrSkill23",
        "textaEn": "Damage Taken:",
        "textaZh": "受到傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "par5"
      }
    ],
    "shortDesc": "curse - amplifies damage taken by enemies",
    "shortDescZh": "詛咒-加深敵人所受的傷害",
    "longDesc": "the non-magic damage they receive\ncurses a group of enemies, increasing",
    "longDescZh": "受到非魔法性傷害時受更重的傷\n詛咒一群敵人，讓他們",
    "icon": "/skills/icon_66.png",
    "iconActive": "/skills/icon_66_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 67,
    "name": "Teeth",
    "nameZh": "牙",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 1,
    "tabName": "Poison and Bone Spells",
    "tabNameZh": "毒素与白骨法术",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      74
    ],
    "mana": 6,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "mag",
    "eMin": 4,
    "eMax": 8,
    "eMinLev": [
      2,
      2,
      3,
      4,
      5
    ],
    "eMaxLev": [
      2,
      3,
      4,
      5,
      6
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 15,
      "par1": 2,
      "par2": 1
    },
    "synergyFormulas": {
      "elemental": "(skill('Bone Wall'.blvl)+skill('Bone Prison'.blvl)+skill('Bone Spear'.blvl)+skill('Bone Spirit'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Bone Wall",
        "providerId": 78,
        "percentPerLevel": 15,
        "type": "elemental"
      },
      {
        "providerName": "Bone Prison",
        "providerId": 88,
        "percentPerLevel": 15,
        "type": "elemental"
      },
      {
        "providerName": "Bone Spear",
        "providerId": 84,
        "percentPerLevel": 15,
        "type": "elemental"
      },
      {
        "providerName": "Bone Spirit",
        "providerId": 93,
        "percentPerLevel": 15,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 84,
        "targetName": "Bone Spear",
        "targetNameZh": "骨矛",
        "percentPerLevel": 7
      },
      {
        "targetId": 93,
        "targetName": "Bone Spirit",
        "targetNameZh": "白骨之魂",
        "percentPerLevel": 6
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 7,
        "textaKey": "StrSkill28",
        "textaEn": "teeth",
        "textaZh": "牙",
        "calca": "\"min(ln12,24)\""
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "fires barbed teeth",
    "shortDescZh": "射出倒刺的牙",
    "longDesc": "fires a barrage of summoned barbed teeth",
    "longDescZh": "召喚倒鉤般的牙，連續射向目標",
    "icon": "/skills/icon_67.png",
    "iconActive": "/skills/icon_67_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 68,
    "name": "Bone Armor",
    "nameZh": "白骨裝甲",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 1,
    "tabName": "Poison and Bone Spells",
    "tabNameZh": "毒素与白骨法术",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      78
    ],
    "mana": 11,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 15,
      "par1": 20,
      "par2": 10
    },
    "synergyFormulas": {},
    "synergiesReceived": [
      {
        "providerId": 78,
        "providerName": "Bone Wall",
        "percentPerLevel": 15,
        "type": "defense",
        "labelEn": "+15 damage absorbed per level",
        "labelZh": "+15 吸收傷害每一等級"
      },
      {
        "providerId": 88,
        "providerName": "Bone Prison",
        "percentPerLevel": 15,
        "type": "defense",
        "labelEn": "+15 damage absorbed per level",
        "labelZh": "+15 吸收傷害每一等級"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 78,
        "targetName": "Bone Wall",
        "targetNameZh": "骨牆",
        "percentPerLevel": 10
      },
      {
        "targetId": 88,
        "targetName": "Bone Prison",
        "targetNameZh": "骨牢",
        "percentPerLevel": 8
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill40",
        "textbKey": "StrSkill41",
        "textaEn": "Absorbs",
        "textaZh": "吸收",
        "textbEn": "damage",
        "textbZh": "傷害",
        "calca": "(ln12 + (skill('Bone Wall'.blvl) + skill('Bone Prison'.blvl)) * par8)"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates a damage absorbing bone shell",
    "shortDescZh": "創造出一個可以吸收傷害的白骨外殼",
    "longDesc": "that absorbs melee damage\ncreates an orbiting shield of bone",
    "longDescZh": "可以吸收近戰中的傷害\n創造出一個環繞著你的白骨外殼",
    "icon": "/skills/icon_68.png",
    "iconActive": "/skills/icon_68_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 69,
    "name": "Skeleton Mastery",
    "nameZh": "支配骷髏",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 2,
    "tabName": "Summoning Spells",
    "tabNameZh": "召唤法术",
    "row": 1,
    "col": 1,
    "reqlevel": 1,
    "reqskills": [
      70
    ],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 8,
      "par2": 2,
      "par3": 5,
      "par4": 10
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 32,
        "textaKey": "StrSkill97",
        "textbKey": "StrSkill4",
        "textaEn": "Monsters:",
        "textaZh": "怪物：",
        "textbEn": "Damage:",
        "textbZh": "傷害：",
        "calca": "lvl*par4"
      },
      {
        "lineType": 32,
        "textaKey": "StrSkill97",
        "textbKey": "StrSkill42",
        "textaEn": "Monsters:",
        "textaZh": "怪物：",
        "textbEn": "Life:",
        "textbZh": "生命：",
        "calca": "lvl*par3"
      },
      {
        "lineType": 33,
        "textaKey": "StrSkill96",
        "textbKey": "StrSkill43",
        "textaEn": "Magi:",
        "textaZh": "法師：",
        "textbEn": "Improved Missile Damage",
        "textbZh": "加強投射傷害"
      },
      {
        "lineType": 70,
        "textaKey": "StrSkill96",
        "textbKey": "StrSkill42",
        "textaEn": "Magi:",
        "textaZh": "法師：",
        "textbEn": "Life:",
        "textbZh": "生命：",
        "calca": "lvl*par1"
      },
      {
        "lineType": 70,
        "textaKey": "StrSkill95",
        "textbKey": "StrSkill4",
        "textaEn": "Skeletons:",
        "textaZh": "骷髏：",
        "textbEn": "Damage:",
        "textbZh": "傷害：",
        "calca": "lvl*par2"
      },
      {
        "lineType": 70,
        "textaKey": "StrSkill95",
        "textbKey": "StrSkill42",
        "textaEn": "Skeletons:",
        "textaZh": "骷髏：",
        "textbEn": "Life:",
        "textbZh": "生命：",
        "calca": "lvl*par1"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - better skeletons and revived creatures",
    "shortDescZh": "被動-更好的骷髏和召喚來的生物",
    "longDesc": "of raised skeletons and revived creatures\npassive - increases life and damage",
    "longDescZh": "和召喚生物的生命值和傷害力\n被動-增加你所復甦骷髏",
    "icon": "/skills/icon_69.png",
    "iconActive": "/skills/icon_69_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 70,
    "name": "Raise Skeleton",
    "nameZh": "骷髏復甦",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 2,
    "tabName": "Summoning Spells",
    "tabNameZh": "召唤法术",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      69,
      80
    ],
    "mana": 6,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      1,
      2,
      3,
      4
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par5": 15,
      "par1": 5,
      "par2": 50,
      "par3": 7,
      "par4": 15
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 36,
        "textaKey": "StrSkill94",
        "textbKey": "StrSkill44",
        "textaEn": "skeleton total",
        "textaZh": "骷髏總數",
        "textbEn": "skeletons total",
        "textbZh": "骷髏總數",
        "calca": "(lvl < 4) ?lvl:(2+lvl/3)"
      },
      {
        "lineType": 13,
        "calca": "(lvl < 4) ? 0 : (par2 * (lvl - 3))",
        "calcb": "skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par1)"
      },
      {
        "lineType": 5,
        "textaKey": "StrSkill21",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "calca": "5+(lvl+skill('Skeleton Mastery'.lvl))*par5"
      },
      {
        "lineType": 5,
        "textaKey": "StrSkill22",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "calca": "5+(lvl+skill('Skeleton Mastery'.lvl))*par4"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "((lvl < 4) ? 0 : ((lvl-3)*par3))"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 34
      }
    ],
    "minionStats": {
      "code": "necroskeleton",
      "minHP": 21,
      "maxHP": 21,
      "minDam": 1,
      "maxDam": 2
    },
    "shortDesc": "reanimate skeletal warrior from target corpse",
    "shortDescZh": "讓所選擇屍體之中的骷髏站立起來",
    "longDesc": "fights for you\nthis raises a skeleton warrior that\ncast on the corpse of a slain monster,",
    "longDescZh": "並為你而戰\n會讓一個骷髏戰士從中甦醒\n施展在一個已死的怪物身上，",
    "icon": "/skills/icon_70.png",
    "iconActive": "/skills/icon_70_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 71,
    "name": "Dim Vision",
    "nameZh": "微暗靈視",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 0,
    "tabName": "Curses",
    "tabNameZh": "诅咒",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      81
    ],
    "mana": 9,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 4,
      "par2": 1,
      "par3": 175,
      "par4": 50
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 31,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "curse - reduces vision of monsters",
    "shortDescZh": "詛咒-減低怪物的可見範圍",
    "longDesc": "reducing their vision radius\ncurses a group of monsters,",
    "longDescZh": "降低它們的可見範圍\n詛咒一群怪物，",
    "icon": "/skills/icon_71.png",
    "iconActive": "/skills/icon_71_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 72,
    "name": "Weaken",
    "nameZh": "削弱",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 0,
    "tabName": "Curses",
    "tabNameZh": "诅咒",
    "row": 2,
    "col": 3,
    "reqlevel": 6,
    "reqskills": [
      66
    ],
    "dependents": [
      77
    ],
    "mana": 4,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par5": 33,
      "par1": 9,
      "par2": 1,
      "par3": 350,
      "par4": 60
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill38",
        "textbKey": "StrSkill23",
        "textaEn": "Target's Damage:",
        "textaZh": "目標的傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "-par5"
      }
    ],
    "shortDesc": "curse - reduces damage done by enemies",
    "shortDescZh": "詛咒-降低敵人所造成的傷害",
    "longDesc": "reducing the amount of damage they inflict\ncurses a group of enemies,",
    "longDescZh": "降低他們所能造成的傷害\n詛咒一群敵人，",
    "icon": "/skills/icon_72.png",
    "iconActive": "/skills/icon_72_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 73,
    "name": "Poison Dagger",
    "nameZh": "淬毒匕首",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 1,
    "tabName": "Poison and Bone Spells",
    "tabNameZh": "毒素与白骨法术",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      83
    ],
    "mana": 12,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "5",
    "hitshift": 1,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "pois",
    "eMin": 18,
    "eMax": 40,
    "eMinLev": [
      10,
      15,
      20,
      23,
      26
    ],
    "eMaxLev": [
      10,
      15,
      20,
      23,
      26
    ],
    "eLen": 50,
    "eLevLen": [
      10,
      10,
      10
    ],
    "params": {
      "par8": 20
    },
    "synergyFormulas": {
      "elemental": "(skill('Poison Explosion'.blvl)+skill('Poison Nova'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Poison Explosion",
        "providerId": 83,
        "percentPerLevel": 20,
        "type": "elemental"
      },
      {
        "providerName": "Poison Nova",
        "providerId": 92,
        "percentPerLevel": 20,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 83,
        "targetName": "Poison Explosion",
        "targetNameZh": "毒爆",
        "percentPerLevel": 15
      },
      {
        "targetId": 92,
        "targetName": "Poison Nova",
        "targetNameZh": "劇毒新星",
        "percentPerLevel": 10
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 14
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "next dagger attack poisons target",
    "shortDescZh": "在目標的身上釘上一把淬毒的匕首",
    "longDesc": "adds poison to your dagger attacks",
    "longDescZh": "讓匕首攻擊的目標中毒",
    "icon": "/skills/icon_73.png",
    "iconActive": "/skills/icon_73_active.png",
    "toHit": 30,
    "toHitLev": 20,
    "startmana": 0
  },
  {
    "id": 74,
    "name": "Corpse Explosion",
    "nameZh": "屍體爆炸",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 1,
    "tabName": "Poison and Bone Spells",
    "tabNameZh": "毒素与白骨法术",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [
      67
    ],
    "dependents": [
      83,
      84
    ],
    "mana": 15,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par5": 50,
      "par1": 70,
      "par2": 120,
      "par3": 8,
      "par4": 1
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 37,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 38,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill46",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent of corpse Life",
        "textbZh": "%的屍體生命",
        "calca": "par1",
        "calcb": "par2"
      }
    ],
    "shortDesc": "turns a corpse into a bomb",
    "shortDescZh": "把一個屍體變成炸彈",
    "longDesc": "it explodes, damaging nearby enemies\ncast on the corpse of a slain monster,",
    "longDescZh": "如果它爆炸的話，打傷附近的敵人\n施在已經死亡的怪物屍體上，",
    "icon": "/skills/icon_74.png",
    "iconActive": "/skills/icon_74_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 75,
    "name": "Clay Golem",
    "nameZh": "黏土石魔",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 2,
    "tabName": "Summoning Spells",
    "tabNameZh": "召唤法术",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      79,
      85
    ],
    "mana": 15,
    "lvlmana": 3,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 20,
      "par1": 35,
      "par2": 35,
      "par4": 75
    },
    "synergyFormulas": {},
    "synergiesReceived": [
      {
        "providerName": "Blood Golem",
        "providerId": 85,
        "percentPerLevel": 5,
        "type": "life",
        "labelEn": "Blood Golem: +5% Life per Level",
        "labelZh": "鮮血石魔: +5% 每等級生命"
      },
      {
        "providerName": "Iron Golem",
        "providerId": 90,
        "percentPerLevel": 35,
        "type": "defense",
        "labelEn": "Iron Golem: +35 Defense per Level",
        "labelZh": "鋼鐵石魔: +35 每等級防禦"
      },
      {
        "providerName": "Fire Golem",
        "providerId": 94,
        "percentPerLevel": 6,
        "type": "damage",
        "labelEn": "Fire Golem: +6% Damage per Level",
        "labelZh": "火焰石魔: +6% 每等級傷害"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 85,
        "targetName": "Blood Golem",
        "targetNameZh": "鮮血石魔",
        "percentPerLevel": 20
      },
      {
        "targetId": 90,
        "targetName": "Iron Golem",
        "targetNameZh": "鋼鐵石魔",
        "percentPerLevel": 20
      },
      {
        "targetId": 94,
        "targetName": "Fire Golem",
        "targetNameZh": "火焰石魔",
        "percentPerLevel": 20
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "Cgslow",
        "textbKey": "StrSkill23",
        "textaEn": "Slows Enemies:",
        "textaZh": "遲緩敵人:",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 4,
        "textaKey": "StrSkill30",
        "textaEn": "Attack Bonus:",
        "textaZh": "攻擊加成：",
        "calca": "lvl*par8"
      },
      {
        "lineType": 39
      },
      {
        "lineType": 13,
        "calca": "(100+(par1 * (lvl - 1)))*(100+skill('Golem Mastery'.ln12) + (skill('BloodGolem'.blvl)*skill('BloodGolem'.par8)))/100-100"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 5,
        "textaKey": "StrSkill21",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "calca": "100+skill('IronGolem'.blvl)*skill('IronGolem'.par8)"
      },
      {
        "lineType": 5,
        "textaKey": "StrSkill22",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "calca": "40 + skill('Golem Mastery'.ln56) + (lvl*par8)"
      }
    ],
    "minionStats": {
      "code": "ClayGolem",
      "minHP": 100,
      "maxHP": 100,
      "minDam": 2,
      "maxDam": 5
    },
    "shortDesc": "creates a golem to fight for you",
    "shortDescZh": "創造一個為你作戰的石魔",
    "longDesc": "to fight by your side\ncreates a golem from the earth",
    "longDescZh": "站在你這邊作戰\n從大地創造出一個石魔",
    "icon": "/skills/icon_75.png",
    "iconActive": "/skills/icon_75_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 76,
    "name": "Iron Maiden",
    "nameZh": "攻擊反噬",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 0,
    "tabName": "Curses",
    "tabNameZh": "诅咒",
    "row": 3,
    "col": 2,
    "reqlevel": 12,
    "reqskills": [
      66
    ],
    "dependents": [
      82
    ],
    "mana": 5,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 25,
      "par5": 200,
      "par1": 7,
      "par3": 300,
      "par4": 60
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      },
      {
        "lineType": 7,
        "textaKey": "StrSkill55",
        "textaEn": "percent damage returned",
        "textaZh": "%的傷害會回彈",
        "calca": "ln56"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "curse - enemies damage themselves",
    "shortDescZh": "詛咒-敵人傷害自己",
    "longDesc": "to damage themselves when damaging others\ncurses a group of enemies, causing them",
    "longDescZh": "在傷害其他人時也傷到自己\n詛咒一群敵人，讓他們",
    "icon": "/skills/icon_76.png",
    "iconActive": "/skills/icon_76_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 77,
    "name": "Terror",
    "nameZh": "恐懼",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 0,
    "tabName": "Curses",
    "tabNameZh": "诅咒",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      72
    ],
    "dependents": [
      87
    ],
    "mana": 7,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 2,
      "par5": 24,
      "par1": 4,
      "par3": 200,
      "par4": 25
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "shortDesc": "curse - monsters run away in fear",
    "shortDescZh": "詛咒-怪物在恐懼中逃開",
    "longDesc": "causing them to flee in terror\ncurses a group of monsters,",
    "longDescZh": "恐懼中逃之夭夭\n導致一群怪物在",
    "icon": "/skills/icon_77.png",
    "iconActive": "/skills/icon_77_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 78,
    "name": "Bone Wall",
    "nameZh": "骨牆",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 1,
    "tabName": "Poison and Bone Spells",
    "tabNameZh": "毒素与白骨法术",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      68
    ],
    "dependents": [
      88
    ],
    "mana": 17,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 10,
      "par1": 25,
      "par2": 600,
      "par3": 8
    },
    "synergyFormulas": {},
    "synergiesReceived": [
      {
        "providerId": 68,
        "providerName": "Bone Armor",
        "percentPerLevel": 10,
        "type": "life",
        "labelEn": "+10% Life per level",
        "labelZh": "+10% 生命每一等級"
      },
      {
        "providerId": 88,
        "providerName": "Bone Prison",
        "percentPerLevel": 10,
        "type": "life",
        "labelEn": "+10% Life per level",
        "labelZh": "+10% 生命每一等級"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 67,
        "targetName": "Teeth",
        "targetNameZh": "牙",
        "percentPerLevel": 15
      },
      {
        "targetId": 68,
        "targetName": "Bone Armor",
        "targetNameZh": "白骨裝甲",
        "percentPerLevel": 15
      },
      {
        "targetId": 84,
        "targetName": "Bone Spear",
        "targetNameZh": "骨矛",
        "percentPerLevel": 7
      },
      {
        "targetId": 88,
        "targetName": "Bone Prison",
        "targetNameZh": "骨牢",
        "percentPerLevel": 8
      },
      {
        "targetId": 93,
        "targetName": "Bone Spirit",
        "targetNameZh": "白骨之魂",
        "percentPerLevel": 6
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "par2"
      },
      {
        "lineType": 13,
        "calca": "(par1 * (lvl-1)) + ((skill('Bone Armor'.blvl)+skill('Bone Prison'.blvl))*par8)"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "bonewall",
      "minHP": 19,
      "maxHP": 19,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "creates an impassable barrier",
    "shortDescZh": "創造一道無法通過的障礙",
    "longDesc": "of bone and debris\ncreates an impassable barrier",
    "longDescZh": "所組成的的障礙，完全無法通過\n創造一道由骨頭和碎片",
    "icon": "/skills/icon_78.png",
    "iconActive": "/skills/icon_78_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 79,
    "name": "Golem Mastery",
    "nameZh": "支配石魔",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 2,
    "tabName": "Summoning Spells",
    "tabNameZh": "召唤法术",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [
      75
    ],
    "dependents": [
      89
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 25,
      "par5": 25,
      "par1": 20,
      "par2": 20,
      "par4": 40
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill89",
        "textbKey": "StrSkill23",
        "textaEn": "Walk/Run Speed:",
        "textaZh": "行走/跑步速度：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 4,
        "textaKey": "StrSkill30",
        "textaEn": "Attack Bonus:",
        "textaZh": "攻擊加成：",
        "calca": "ln56"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill42",
        "textbKey": "StrSkill23",
        "textaEn": "Life:",
        "textaZh": "生命：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "lvl*par1"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "Enhances Speed and Life of Golems",
    "shortDescZh": "加強石魔的生命和速度",
    "longDesc": "Enhances Speed and Life of all your Golems",
    "longDescZh": "加強你所有召喚石魔的生命和速度",
    "icon": "/skills/icon_79.png",
    "iconActive": "/skills/icon_79_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 80,
    "name": "Raise Skeletal Mage",
    "nameZh": "復甦骷髏法師",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 2,
    "tabName": "Summoning Spells",
    "tabNameZh": "召唤法术",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      70
    ],
    "dependents": [
      95
    ],
    "mana": 8,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par5": 10,
      "par2": 7
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 36,
        "textaKey": "StrSkill43a",
        "textbKey": "StrSkill44a",
        "textaEn": "skeleton mage",
        "textaZh": "骷髏法師",
        "textbEn": "skeleton magi",
        "textbZh": "骷髏法師",
        "calca": "(lvl < 4) ?lvl:(2+lvl/3)"
      },
      {
        "lineType": 5,
        "textaKey": "StrSkill21",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "calca": "(lvl+skill('Skeleton Mastery'.lvl))*par5"
      },
      {
        "lineType": 13,
        "calca": "(lvl < 4) ? 0 : (par2 * (lvl - 3))",
        "calcb": "skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par1)"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "necromage",
      "minHP": 61,
      "maxHP": 61,
      "minDam": 1,
      "maxDam": 2
    },
    "shortDesc": "reanimate skeletal mage from target corpse",
    "shortDescZh": "從選定的屍體中，招喚出骷髏法師",
    "longDesc": "fights for you\nthis raises a skeleton mage that\ncast on the corpse of a slain monster,",
    "longDescZh": "並為你而戰\n可以讓一個骷髏法師站起來\n施展在一個已死的怪物屍體上，",
    "icon": "/skills/icon_80.png",
    "iconActive": "/skills/icon_80_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 81,
    "name": "Confuse",
    "nameZh": "迷亂",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 0,
    "tabName": "Curses",
    "tabNameZh": "诅咒",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      71
    ],
    "dependents": [
      86
    ],
    "mana": 13,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 6,
      "par2": 1,
      "par3": 250,
      "par4": 50
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 31,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "curse - monster attacks random targets",
    "shortDescZh": "詛咒-怪物隨便攻擊目標",
    "longDesc": "curses a monster to force it to attack random targets",
    "longDescZh": "詛咒一個怪物，逼他隨意攻擊目標",
    "icon": "/skills/icon_81.png",
    "iconActive": "/skills/icon_81_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 82,
    "name": "Life Tap",
    "nameZh": "偷取生命",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 0,
    "tabName": "Curses",
    "tabNameZh": "诅咒",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      76
    ],
    "dependents": [
      91
    ],
    "mana": 9,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 50,
      "par1": 4,
      "par2": 1,
      "par3": 400,
      "par4": 60
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill50",
        "textbKey": "StrSkill79",
        "textaEn": "Heals:",
        "textaZh": "治療：",
        "textbEn": "percent of attack damage",
        "textbZh": "%的攻擊傷害",
        "calca": "ln56"
      }
    ],
    "shortDesc": "curse - enemies return life to attacker",
    "shortDescZh": "詛咒-敵人的生命流向攻擊者",
    "longDesc": "damaging them gives the attacker life\ncurses a group of monsters so that",
    "longDescZh": "受到的傷害流向攻擊者，成為生命點數\n詛咒一群怪物讓它們",
    "icon": "/skills/icon_82.png",
    "iconActive": "/skills/icon_82_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 83,
    "name": "Poison Explosion",
    "nameZh": "毒爆",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 1,
    "tabName": "Poison and Bone Spells",
    "tabNameZh": "毒素与白骨法术",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      73,
      74
    ],
    "dependents": [
      92
    ],
    "mana": 8,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 4,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "pois",
    "eMin": 8,
    "eMax": 24,
    "eMinLev": [
      2,
      4,
      6,
      8,
      10
    ],
    "eMaxLev": [
      2,
      4,
      6,
      8,
      10
    ],
    "eLen": 50,
    "eLevLen": [
      10,
      10,
      10
    ],
    "params": {
      "par8": 15
    },
    "synergyFormulas": {
      "elemental": "(skill('Poison Dagger'.blvl)+skill('Poison Nova'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Poison Dagger",
        "providerId": 73,
        "percentPerLevel": 15,
        "type": "elemental"
      },
      {
        "providerName": "Poison Nova",
        "providerId": 92,
        "percentPerLevel": 15,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 73,
        "targetName": "Poison Dagger",
        "targetNameZh": "淬毒匕首",
        "percentPerLevel": 20
      },
      {
        "targetId": 92,
        "targetName": "Poison Nova",
        "targetNameZh": "劇毒新星",
        "percentPerLevel": 10
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 14
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "turns a corpse into a poison gas bomb",
    "shortDescZh": "把一個屍體變成毒氣瓦斯炸彈",
    "longDesc": "that poisons nearby monsters\ntoxic gas is released\ncast on the corpse of a slain monster,",
    "longDescZh": "讓附近的怪物統統中毒\n放出大量的劇毒\n施展在一個已死的怪物屍體上，",
    "icon": "/skills/icon_83.png",
    "iconActive": "/skills/icon_83_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 84,
    "name": "Bone Spear",
    "nameZh": "骨矛",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 1,
    "tabName": "Poison and Bone Spells",
    "tabNameZh": "毒素与白骨法术",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      74
    ],
    "dependents": [
      88,
      93
    ],
    "mana": 28,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "mag",
    "eMin": 16,
    "eMax": 24,
    "eMinLev": [
      8,
      9,
      12,
      18,
      24
    ],
    "eMaxLev": [
      8,
      9,
      13,
      19,
      25
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 7
    },
    "synergyFormulas": {
      "elemental": "(skill('Bone Wall'.blvl)+skill('Bone Prison'.blvl)+skill('Teeth'.blvl)+skill('Bone Spirit'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Bone Wall",
        "providerId": 78,
        "percentPerLevel": 7,
        "type": "elemental"
      },
      {
        "providerName": "Bone Prison",
        "providerId": 88,
        "percentPerLevel": 7,
        "type": "elemental"
      },
      {
        "providerName": "Teeth",
        "providerId": 67,
        "percentPerLevel": 7,
        "type": "elemental"
      },
      {
        "providerName": "Bone Spirit",
        "providerId": 93,
        "percentPerLevel": 7,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 67,
        "targetName": "Teeth",
        "targetNameZh": "牙",
        "percentPerLevel": 15
      },
      {
        "targetId": 93,
        "targetName": "Bone Spirit",
        "targetNameZh": "白骨之魂",
        "percentPerLevel": 6
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "summons a deadly spike of bone",
    "shortDescZh": "召喚一把致命的白骨長矛",
    "longDesc": "summons a deadly spike of bone to impale your enemies",
    "longDescZh": "召喚一把致命的白骨長矛刺穿你的敵人",
    "icon": "/skills/icon_84.png",
    "iconActive": "/skills/icon_84_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 85,
    "name": "Blood Golem",
    "nameZh": "鮮血石魔",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 2,
    "tabName": "Summoning Spells",
    "tabNameZh": "召唤法术",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      75
    ],
    "dependents": [
      90
    ],
    "mana": 25,
    "lvlmana": 4,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par6": 25,
      "par5": 0,
      "par1": 75,
      "par2": 150,
      "par3": 30,
      "par4": 35
    },
    "synergyFormulas": {},
    "synergiesReceived": [
      {
        "providerName": "Clay Golem",
        "providerId": 75,
        "percentPerLevel": 20,
        "type": "attack",
        "labelEn": "Clay Golem: +20 Attack Rating per Level",
        "labelZh": "黏土石魔: +20 每等級準確率"
      },
      {
        "providerName": "Iron Golem",
        "providerId": 90,
        "percentPerLevel": 35,
        "type": "defense",
        "labelEn": "Iron Golem: +35 Defense per Level",
        "labelZh": "鋼鐵石魔: +35 每等級防禦"
      },
      {
        "providerName": "Fire Golem",
        "providerId": 94,
        "percentPerLevel": 6,
        "type": "damage",
        "labelEn": "Fire Golem: +6% Damage per Level",
        "labelZh": "火焰石魔: +6% 每等級傷害"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 75,
        "targetName": "Clay Golem",
        "targetNameZh": "黏土石魔",
        "percentPerLevel": 5
      },
      {
        "targetId": 90,
        "targetName": "Iron Golem",
        "targetNameZh": "鋼鐵石魔",
        "percentPerLevel": 5
      },
      {
        "targetId": 94,
        "targetName": "Fire Golem",
        "targetNameZh": "火焰石魔",
        "percentPerLevel": 5
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 39
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill80",
        "textbKey": "StrSkill81",
        "textaEn": "Converts",
        "textaZh": "轉換",
        "textbEn": "percent damage to life",
        "textbZh": "%的傷害到生命",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 5,
        "textaKey": "StrSkill21",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "calca": "120+skill('IronGolem'.blvl)*skill('IronGolem'.par8)"
      },
      {
        "lineType": 5,
        "textaKey": "StrSkill22",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "calca": "60 + skill('Golem Mastery'.ln56)+skill('Clay Golem'.blvl)*skill('Clay Golem'.par8)"
      },
      {
        "lineType": 13,
        "calca": "skill('Golem Mastery'.ln12)"
      }
    ],
    "minionStats": {
      "code": "BloodGolem",
      "minHP": 201,
      "maxHP": 201,
      "minDam": 6,
      "maxDam": 16
    },
    "shortDesc": "a golem that shares life and damage",
    "shortDescZh": "一個和你共享生命和傷害的石魔",
    "longDesc": "it steals and damage it receives\ncreates a golem that shares with you the life",
    "longDescZh": "它會承受它的偷取和傷害\n創造出一個和你共享生命的石魔",
    "icon": "/skills/icon_85.png",
    "iconActive": "/skills/icon_85_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 86,
    "name": "Attract",
    "nameZh": "吸引",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 0,
    "tabName": "Curses",
    "tabNameZh": "诅咒",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      81
    ],
    "dependents": [],
    "mana": 17,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 9,
      "par3": 300,
      "par4": 90
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 31,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "shortDesc": "curse - monster becomes universal target",
    "shortDescZh": "詛咒-怪物成為統一的目標",
    "longDesc": "this curse may not be overridden by another curse\ntarget of all nearby monsters\ncurses a monster to become the",
    "longDescZh": "此詛咒無法被其他詛咒撤銷\n其他週邊的怪物目標，\n詛咒一隻怪物變成",
    "icon": "/skills/icon_86.png",
    "iconActive": "/skills/icon_86_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 87,
    "name": "Decrepify",
    "nameZh": "衰老",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 0,
    "tabName": "Curses",
    "tabNameZh": "诅咒",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      77
    ],
    "dependents": [
      91
    ],
    "mana": 11,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par5": -50,
      "par1": 6,
      "par3": 100,
      "par4": 15
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "shortDesc": "curse - greatly slows and weakens enemies",
    "shortDescZh": "詛咒-讓敵人變得極度緩慢而衰弱",
    "longDesc": "slow, weak and take amplified damage\ncurses a group of enemies to make them",
    "longDescZh": "緩慢、衰弱而且受攻擊時生命大量降低\n詛咒一群敵人並讓它們",
    "icon": "/skills/icon_87.png",
    "iconActive": "/skills/icon_87_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 88,
    "name": "Bone Prison",
    "nameZh": "骨牢",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 1,
    "tabName": "Poison and Bone Spells",
    "tabNameZh": "毒素与白骨法术",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      78,
      84
    ],
    "dependents": [],
    "mana": 27,
    "lvlmana": -1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 8,
      "par1": 25,
      "par2": 600
    },
    "synergyFormulas": {},
    "synergiesReceived": [
      {
        "providerId": 68,
        "providerName": "Bone Armor",
        "percentPerLevel": 8,
        "type": "life",
        "labelEn": "+8% Life per level",
        "labelZh": "+8% 生命每一等級"
      },
      {
        "providerId": 78,
        "providerName": "Bone Wall",
        "percentPerLevel": 8,
        "type": "life",
        "labelEn": "+8% Life per level",
        "labelZh": "+8% 生命每一等級"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 67,
        "targetName": "Teeth",
        "targetNameZh": "牙",
        "percentPerLevel": 15
      },
      {
        "targetId": 68,
        "targetName": "Bone Armor",
        "targetNameZh": "白骨裝甲",
        "percentPerLevel": 15
      },
      {
        "targetId": 78,
        "targetName": "Bone Wall",
        "targetNameZh": "骨牆",
        "percentPerLevel": 10
      },
      {
        "targetId": 84,
        "targetName": "Bone Spear",
        "targetNameZh": "骨矛",
        "percentPerLevel": 7
      },
      {
        "targetId": 93,
        "targetName": "Bone Spirit",
        "targetNameZh": "白骨之魂",
        "percentPerLevel": 6
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "par2"
      },
      {
        "lineType": 13,
        "calca": "(par1 * (lvl-1)) + ((skill('Bone Armor'.blvl)+skill('Bone Wall'.blvl))*par8)"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "bonewall",
      "minHP": 19,
      "maxHP": 19,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "creates a barrier of bone around target",
    "shortDescZh": "在目標附近創造出一群用骨頭形成的牢籠",
    "longDesc": "creates a barrier of fossilized bone around your target",
    "longDescZh": "在你的目標附近創造出一堆化石般的骨頭",
    "icon": "/skills/icon_88.png",
    "iconActive": "/skills/icon_88_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 89,
    "name": "Summon Resist",
    "nameZh": "召喚反抗",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 2,
    "tabName": "Summoning Spells",
    "tabNameZh": "召唤法术",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      79
    ],
    "dependents": [],
    "mana": 44,
    "lvlmana": -3,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 20,
      "par2": 75
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill54",
        "textbKey": "StrSkill23",
        "textaEn": "Resist All:",
        "textaZh": "全面抵抗：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - summoned monsters gain resistances",
    "shortDescZh": "被動-召喚的怪物獲得反抗力",
    "longDesc": "of all summoned creatures\npassive - increases the resistances",
    "longDescZh": "增加它們的反抗力\n被動-為所有召喚而來的生物",
    "icon": "/skills/icon_89.png",
    "iconActive": "/skills/icon_89_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 90,
    "name": "Iron Golem",
    "nameZh": "鋼鐵石魔",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 2,
    "tabName": "Summoning Spells",
    "tabNameZh": "召唤法术",
    "row": 5,
    "col": 2,
    "reqlevel": 24,
    "reqskills": [
      85
    ],
    "dependents": [
      94,
      95
    ],
    "mana": 35,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 35,
      "par1": 150,
      "par2": 15
    },
    "synergyFormulas": {},
    "synergiesReceived": [
      {
        "providerName": "Clay Golem",
        "providerId": 75,
        "percentPerLevel": 20,
        "type": "attack",
        "labelEn": "Clay Golem: +20 Attack Rating per Level",
        "labelZh": "黏土石魔: +20 每等級準確率"
      },
      {
        "providerName": "Blood Golem",
        "providerId": 85,
        "percentPerLevel": 5,
        "type": "life",
        "labelEn": "Blood Golem: +5% Life per Level",
        "labelZh": "鮮血石魔: +5% 每等級生命"
      },
      {
        "providerName": "Fire Golem",
        "providerId": 94,
        "percentPerLevel": 6,
        "type": "damage",
        "labelEn": "Fire Golem: +6% Damage per Level",
        "labelZh": "火焰石魔: +6% 每等級傷害"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 75,
        "targetName": "Clay Golem",
        "targetNameZh": "黏土石魔",
        "percentPerLevel": 35
      },
      {
        "targetId": 85,
        "targetName": "Blood Golem",
        "targetNameZh": "鮮血石魔",
        "percentPerLevel": 35
      },
      {
        "targetId": 94,
        "targetName": "Fire Golem",
        "targetNameZh": "火焰石魔",
        "percentPerLevel": 35
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 4,
        "textaKey": "StrSkill31",
        "textaEn": "Defense Bonus:",
        "textaZh": "防禦加成：",
        "calca": "lvl*par8"
      },
      {
        "lineType": 7,
        "textaKey": "StrSkill55",
        "textaEn": "percent damage returned",
        "textaZh": "%的傷害會回彈",
        "calca": "ln12"
      },
      {
        "lineType": 18,
        "textaKey": "StrSkill112",
        "textaEn": "Thorns damage",
        "textaZh": "刺針傷害"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 5,
        "textaKey": "StrSkill21",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "calca": "140+lvl*par8"
      },
      {
        "lineType": 5,
        "textaKey": "StrSkill22",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "calca": "80 + skill('Golem Mastery'.ln56)+skill('Clay Golem'.blvl)*skill('Clay Golem'.par8)"
      },
      {
        "lineType": 39
      },
      {
        "lineType": 13,
        "calca": "skill('Golem Mastery'.ln12) + (skill('BloodGolem'.blvl)*skill('BloodGolem'.par8))"
      }
    ],
    "minionStats": {
      "code": "IronGolem",
      "minHP": 306,
      "maxHP": 306,
      "minDam": 7,
      "maxDam": 19
    },
    "shortDesc": "creates a golem from an item",
    "shortDescZh": "從一個物品中創造石魔",
    "longDesc": "the properties of the item\ntransforms a metallic item into a golem that gains",
    "longDescZh": "該物品的特性\n把一個金屬的物品轉換成石魔，並獲得",
    "icon": "/skills/icon_90.png",
    "iconActive": "/skills/icon_90_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 91,
    "name": "Lower Resist",
    "nameZh": "降低抵抗",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 0,
    "tabName": "Curses",
    "tabNameZh": "诅咒",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      82,
      87
    ],
    "dependents": [],
    "mana": 22,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 70,
      "par5": 25,
      "par1": 7,
      "par2": 1,
      "par3": 500,
      "par4": 50
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill54",
        "textbKey": "StrSkill23",
        "textaEn": "Resist All:",
        "textaZh": "全面抵抗：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "-dm56"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "curse - lowers enemies resistance to magic",
    "shortDescZh": "詛咒-降低敵人對魔法的抵抗",
    "longDesc": "lowers maximum resistances of hostile players\nlowers resistances of monsters\ncurses an enemy to take more damage from all magical attacks",
    "longDescZh": "降低敵對玩者的最大防禦力\n降低怪物的抵抗力\n詛咒一個敵人在受到魔法攻擊時，會受到更多的傷害",
    "icon": "/skills/icon_91.png",
    "iconActive": "/skills/icon_91_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 92,
    "name": "Poison Nova",
    "nameZh": "劇毒新星",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 1,
    "tabName": "Poison and Bone Spells",
    "tabNameZh": "毒素与白骨法术",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      83
    ],
    "dependents": [],
    "mana": 20,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 4,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "pois",
    "eMin": 16,
    "eMax": 29,
    "eMinLev": [
      4,
      6,
      9,
      14,
      16
    ],
    "eMaxLev": [
      4,
      6,
      9,
      14,
      16
    ],
    "eLen": 50,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 10
    },
    "synergyFormulas": {
      "elemental": "(skill('Poison Dagger'.blvl)+skill('Poison Explosion'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Poison Dagger",
        "providerId": 73,
        "percentPerLevel": 10,
        "type": "elemental"
      },
      {
        "providerName": "Poison Explosion",
        "providerId": 83,
        "percentPerLevel": 10,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 73,
        "targetName": "Poison Dagger",
        "targetNameZh": "淬毒匕首",
        "percentPerLevel": 20
      },
      {
        "targetId": 83,
        "targetName": "Poison Explosion",
        "targetNameZh": "毒爆",
        "percentPerLevel": 15
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 14
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "emits an expanding ring of poison",
    "shortDescZh": "發出一個不斷擴張的劇毒之環",
    "longDesc": "emits an expanding ring of concentrated poison",
    "longDescZh": "發出一個不斷擴張的劇毒之環",
    "icon": "/skills/icon_92.png",
    "iconActive": "/skills/icon_92_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 93,
    "name": "Bone Spirit",
    "nameZh": "白骨之魂",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 1,
    "tabName": "Poison and Bone Spells",
    "tabNameZh": "毒素与白骨法术",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      84
    ],
    "dependents": [],
    "mana": 24,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "mag",
    "eMin": 20,
    "eMax": 30,
    "eMinLev": [
      16,
      17,
      18,
      19,
      20
    ],
    "eMaxLev": [
      17,
      18,
      19,
      20,
      21
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 6
    },
    "synergyFormulas": {
      "elemental": "(skill('Bone Wall'.blvl)+skill('Bone Prison'.blvl)+skill('Teeth'.blvl)+skill('Bone Spear'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Bone Wall",
        "providerId": 78,
        "percentPerLevel": 6,
        "type": "elemental"
      },
      {
        "providerName": "Bone Prison",
        "providerId": 88,
        "percentPerLevel": 6,
        "type": "elemental"
      },
      {
        "providerName": "Teeth",
        "providerId": 67,
        "percentPerLevel": 6,
        "type": "elemental"
      },
      {
        "providerName": "Bone Spear",
        "providerId": 84,
        "percentPerLevel": 6,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 67,
        "targetName": "Teeth",
        "targetNameZh": "牙",
        "percentPerLevel": 15
      },
      {
        "targetId": 84,
        "targetName": "Bone Spear",
        "targetNameZh": "骨矛",
        "percentPerLevel": 7
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "releases an undead specter",
    "shortDescZh": "釋放出一個不死的鬼魂",
    "longDesc": "tracks its target or finds one of its own\nreleases a spirit of the restless undead that",
    "longDescZh": "開始追擊它的目標或是自行找個目標\n釋放出一個不知疲累的不死生物",
    "icon": "/skills/icon_93.png",
    "iconActive": "/skills/icon_93_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 94,
    "name": "Fire Golem",
    "nameZh": "火焰石魔",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 2,
    "tabName": "Summoning Spells",
    "tabNameZh": "召唤法术",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      90
    ],
    "dependents": [],
    "mana": 50,
    "lvlmana": 10,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 10,
    "eMax": 27,
    "eMinLev": [
      9,
      10,
      11,
      12,
      13
    ],
    "eMaxLev": [
      10,
      11,
      12,
      13,
      14
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 6,
      "par6": 1,
      "par5": 8,
      "par1": 25,
      "par2": 100,
      "par3": 100,
      "par4": 35
    },
    "synergyFormulas": {},
    "synergiesReceived": [
      {
        "providerName": "Clay Golem",
        "providerId": 75,
        "percentPerLevel": 20,
        "type": "attack",
        "labelEn": "Clay Golem: +20 Attack Rating per Level",
        "labelZh": "黏土石魔: +20 每等級準確率"
      },
      {
        "providerName": "Blood Golem",
        "providerId": 85,
        "percentPerLevel": 5,
        "type": "life",
        "labelEn": "Blood Golem: +5% Life per Level",
        "labelZh": "鮮血石魔: +5% 每等級生命"
      },
      {
        "providerName": "Iron Golem",
        "providerId": 90,
        "percentPerLevel": 35,
        "type": "defense",
        "labelEn": "Iron Golem: +35 Defense per Level",
        "labelZh": "鋼鐵石魔: +35 每等級防禦"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 75,
        "targetName": "Clay Golem",
        "targetNameZh": "黏土石魔",
        "percentPerLevel": 6
      },
      {
        "targetId": 85,
        "targetName": "Blood Golem",
        "targetNameZh": "鮮血石魔",
        "percentPerLevel": 6
      },
      {
        "targetId": 90,
        "targetName": "Iron Golem",
        "targetNameZh": "鋼鐵石魔",
        "percentPerLevel": 6
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 35,
        "textaKey": "skillname102",
        "textaEn": "Holy Fire",
        "textaZh": "聖火",
        "calca": "sklvl('Holy Fire'.ln56.edmn)",
        "calcb": "sklvl('Holy Fire'.ln56.edmx)"
      },
      {
        "lineType": 41,
        "calca": "edmn+sklvl('Holy Fire'.ln56.edmn)*sklvl('Holy Fire'.ln56.par5)",
        "calcb": "edmx+sklvl('Holy Fire'.ln56.edmx)*sklvl('Holy Fire'.ln56.par5)"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill40",
        "textbKey": "StrSkill103",
        "textaEn": "Absorbs",
        "textaZh": "吸收",
        "textbEn": "percent fire damage",
        "textbZh": "%的火焰傷害",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 5,
        "textaKey": "StrSkill21",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "calca": "200+skill('IronGolem'.blvl)*skill('IronGolem'.par8)"
      },
      {
        "lineType": 5,
        "textaKey": "StrSkill22",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "calca": "120 + skill('Golem Mastery'.ln56)+skill('Clay Golem'.blvl)*skill('Clay Golem'.par8)"
      },
      {
        "lineType": 13,
        "calca": "skill('Golem Mastery'.ln12) + (skill('BloodGolem'.blvl)*skill('BloodGolem'.par8))"
      }
    ],
    "minionStats": {
      "code": "FireGolem",
      "minHP": 313,
      "maxHP": 313,
      "minDam": 10,
      "maxDam": 27
    },
    "shortDesc": "creates a golem of fire",
    "shortDescZh": "創造出一個火焰石魔",
    "longDesc": "it receives from fire into life\ncreates a golem that converts the damage",
    "longDescZh": "火焰傷害轉換成生命\n創造一個石魔，可以把承受到的",
    "icon": "/skills/icon_94.png",
    "iconActive": "/skills/icon_94_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 95,
    "name": "Revive",
    "nameZh": "重生",
    "classCode": "nec",
    "classNameZh": "死灵法师",
    "tabIndex": 2,
    "tabName": "Summoning Spells",
    "tabNameZh": "召唤法术",
    "row": 6,
    "col": 3,
    "reqlevel": 30,
    "reqskills": [
      80,
      90
    ],
    "dependents": [],
    "mana": 45,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par5": 50,
      "par1": 200,
      "par3": 4500
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 5,
        "textaKey": "StrSkill97",
        "textaEn": "Monsters:",
        "textaZh": "怪物：",
        "calca": "lvl",
        "calcb": " "
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par4)"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill42",
        "textbKey": "StrSkill23",
        "textaEn": "Life:",
        "textaZh": "生命：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "par1 + skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par3)"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      }
    ],
    "shortDesc": "raises a monster to fight for you",
    "shortDescZh": "把一個怪物復活，並為你而戰",
    "longDesc": "to fight by your side\nreturns a monster to life",
    "longDescZh": "為你而戰\n讓一個怪物重獲生命",
    "icon": "/skills/icon_95.png",
    "iconActive": "/skills/icon_95_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 96,
    "name": "Sacrifice",
    "nameZh": "犧牲",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "作战技能",
    "row": 1,
    "col": 1,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      106
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 15,
      "par7": 5,
      "par1": 180,
      "par2": 15,
      "par3": 8
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12+skill('Redemption'.blvl)*par8+skill('Fanaticism'.blvl)*par7"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill10",
        "textbKey": "StrSkill23",
        "textaEn": "To Attack Rating:",
        "textaZh": "變動準確率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 68,
        "textaKey": "StrSkill23",
        "textbKey": "StrSkill47",
        "textaEn": "percent",
        "textaZh": "百分比",
        "textbEn": "damage to Self",
        "textbZh": "本身受損",
        "calca": "par3"
      }
    ],
    "shortDesc": "increased accuracy and damage",
    "shortDescZh": "增加準確性和傷害性",
    "longDesc": "at the cost of life\nincreased accuracy and damage",
    "longDescZh": "但以生命為代價\n增加準確性和傷害性",
    "icon": "/skills/icon_96.png",
    "iconActive": "/skills/icon_96_active.png",
    "toHit": 20,
    "toHitLev": 7,
    "startmana": 0
  },
  {
    "id": 97,
    "name": "Smite",
    "nameZh": "重擊",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "作战技能",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      107
    ],
    "mana": 2,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "10",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 15,
      "par2": 5,
      "par3": 15,
      "par4": 15
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill48",
        "textaEn": "Stun Length:",
        "textaZh": "昏迷時間：",
        "calca": "\"min(250,ln12)\""
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "shield bash",
    "shortDescZh": "用盾牌重擊",
    "longDesc": "by bashing it with your shield\ntemporarily stun your enemy",
    "longDescZh": "利用你的盾牌重擊\n可以暫時讓對手昏眩",
    "icon": "/skills/icon_97.png",
    "iconActive": "/skills/icon_97_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 98,
    "name": "Might",
    "nameZh": "力量",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 1,
    "tabName": "Offensive Auras",
    "tabNameZh": "攻击灵气",
    "row": 1,
    "col": 1,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      102,
      108
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 16,
      "par2": 2,
      "par3": 40,
      "par4": 10
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - increases damage",
    "shortDescZh": "靈氣-增加傷害",
    "longDesc": "done by you and your party\nwhen active, aura increases the damage",
    "longDescZh": "隊伍成員所造成的傷害\n當啟用時，靈氣會增加你和",
    "icon": "/skills/icon_98.png",
    "iconActive": "/skills/icon_98_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 99,
    "name": "Prayer",
    "nameZh": "祈禱",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 2,
    "tabName": "Defensive Auras",
    "tabNameZh": "防御灵气",
    "row": 1,
    "col": 1,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      109
    ],
    "mana": 16,
    "lvlmana": 3,
    "minmana": 1,
    "manashift": 4,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 2,
    "eMax": 0,
    "eMinLev": [
      1,
      1,
      2,
      2,
      3
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 16,
      "par2": 2
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 4,
        "textaKey": "StrSkill50",
        "textaEn": "Heals:",
        "textaZh": "治療：",
        "calca": "edmn"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - regenerates life",
    "shortDescZh": "靈氣-生命重生",
    "longDesc": "the life of you and your party\nwhen active, aura slowly regenerates",
    "longDescZh": "的為你和你的隊伍補充生命\n當啟用時，靈氣會慢慢",
    "icon": "/skills/icon_99.png",
    "iconActive": "/skills/icon_99_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 100,
    "name": "Resist Fire",
    "nameZh": "抗火",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 2,
    "tabName": "Defensive Auras",
    "tabNameZh": "防御灵气",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 16,
      "par2": 2,
      "par3": 35,
      "par4": 150
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 102,
        "targetName": "Holy Fire",
        "targetNameZh": "聖火",
        "percentPerLevel": 18
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill51",
        "textbKey": "StrSkill23",
        "textaEn": "Resist Fire:",
        "textaZh": "抵抗火焰：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - protects against fire damage",
    "shortDescZh": "靈氣-保護你免於火焰傷害",
    "longDesc": "done to you and your party\nwhen active, aura decreases fire damage",
    "longDescZh": "所受到的火焰傷害\n當啟用時，靈氣會降低你和你的隊伍",
    "icon": "/skills/icon_100.png",
    "iconActive": "/skills/icon_100_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 101,
    "name": "Holy Bolt",
    "nameZh": "聖光彈",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "作战技能",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      112
    ],
    "mana": 32,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 4,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "mag",
    "eMin": 8,
    "eMax": 16,
    "eMinLev": [
      8,
      10,
      13,
      16,
      20
    ],
    "eMaxLev": [
      8,
      11,
      15,
      18,
      23
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 50,
      "par7": 15,
      "par1": 1,
      "par2": 2,
      "par3": 6,
      "par4": 4
    },
    "synergyFormulas": {
      "elemental": "(skill('Blessed Hammer'.blvl)+skill('Fist of the Heavens'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Blessed Hammer",
        "providerId": 112,
        "percentPerLevel": 50,
        "type": "elemental"
      },
      {
        "providerName": "Fist of the Heavens",
        "providerId": 121,
        "percentPerLevel": 50,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 47,
        "textaKey": "StrSkill50",
        "textaEn": "Heals:",
        "textaZh": "治療：",
        "calca": "ln12 * (100 + skill('Prayer'.blvl) * par7) / 100",
        "calcb": "ln34 * (100 + skill('Prayer'.blvl) * par7) / 100"
      },
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "divine energy that damages undead",
    "shortDescZh": "神聖的能量可傷害不死生物",
    "longDesc": "or heals allies\nthat damages undead enemies\na bolt of divine energy",
    "longDescZh": "或治療你的同盟\n可以傷害不死的敵人\n一個神屬的能源彈",
    "icon": "/skills/icon_101.png",
    "iconActive": "/skills/icon_101_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 102,
    "name": "Holy Fire",
    "nameZh": "聖火",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 1,
    "tabName": "Offensive Auras",
    "tabNameZh": "攻击灵气",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [
      98
    ],
    "dependents": [
      114
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 2,
    "eMax": 6,
    "eMinLev": [
      1,
      2,
      3,
      5,
      7
    ],
    "eMaxLev": [
      1,
      2,
      3,
      5,
      7
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 18,
      "par7": 6,
      "par5": 6,
      "par1": 6,
      "par2": 1
    },
    "synergyFormulas": {
      "elemental": "skill('Resist Fire'.blvl)*par8+skill('Salvation'.blvl)*par7"
    },
    "synergiesReceived": [
      {
        "providerName": "Resist Fire",
        "providerId": 100,
        "percentPerLevel": 18,
        "type": "elemental"
      },
      {
        "providerName": "Salvation",
        "providerId": 125,
        "percentPerLevel": 6,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 43,
        "textaKey": "StrSkill5",
        "textaEn": "Fire Damage:",
        "textaZh": "火焰傷害：",
        "calca": "edns",
        "calcb": "edxs"
      },
      {
        "lineType": 38,
        "textaKey": "StrSkill5",
        "textbKey": "strEskilllighttoattack",
        "textaEn": "Fire Damage:",
        "textaZh": "火焰傷害：",
        "textbEn": "to your attack",
        "textbZh": "對你的攻擊",
        "calca": "edns*par5/256",
        "calcb": "edxs*par5/256"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - flames damage nearby enemies",
    "shortDescZh": "靈氣-火焰傷害附近的敵人",
    "longDesc": "with heavenly flames\nwhen active, aura damages nearby enemies",
    "longDescZh": "傷害附近的敵人\n當啟用時，靈氣會以天堂之火",
    "icon": "/skills/icon_102.png",
    "iconActive": "/skills/icon_102_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 103,
    "name": "Thorns",
    "nameZh": "刺針",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 1,
    "tabName": "Offensive Auras",
    "tabNameZh": "攻击灵气",
    "row": 2,
    "col": 3,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      119
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 16,
      "par2": 2,
      "par3": 250,
      "par4": 40
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill55",
        "textaEn": "percent damage returned",
        "textaZh": "%的傷害會回彈",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - reflects damage back at enemies",
    "shortDescZh": "靈氣-反彈敵人造成的傷害",
    "longDesc": "back at your attacker\nwhen active, aura reflects damage done to you",
    "longDescZh": "造成的傷害反彈回去\n當啟用時，靈氣會把敵人對你",
    "icon": "/skills/icon_103.png",
    "iconActive": "/skills/icon_103_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 104,
    "name": "Defiance",
    "nameZh": "反抗",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 2,
    "tabName": "Defensive Auras",
    "tabNameZh": "防御灵气",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      115
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 0,
      "par1": 16,
      "par2": 2,
      "par3": 70,
      "par4": 10
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill31",
        "textbKey": "StrSkill23",
        "textaEn": "Defense Bonus:",
        "textaZh": "防禦加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - increases defense",
    "shortDescZh": "靈氣-增加防禦性",
    "longDesc": "of you and your party\nwhen active, aura increases the defense rating",
    "longDescZh": "隊伍增加防禦等級\n當啟用時，靈氣會為你和你的",
    "icon": "/skills/icon_104.png",
    "iconActive": "/skills/icon_104_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 105,
    "name": "Resist Cold",
    "nameZh": "抗冰冷",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 2,
    "tabName": "Defensive Auras",
    "tabNameZh": "防御灵气",
    "row": 2,
    "col": 3,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 0,
      "par1": 16,
      "par2": 2,
      "par3": 35,
      "par4": 150
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 114,
        "targetName": "Holy Freeze",
        "targetNameZh": "神聖冰凍",
        "percentPerLevel": 15
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill52",
        "textbKey": "StrSkill23",
        "textaEn": "Resist Cold:",
        "textaZh": "抵抗冰凍：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - protects against cold damage",
    "shortDescZh": "靈氣-保護你免於冰冷傷害",
    "longDesc": "done to you and your party\nwhen active, aura decreases cold damage",
    "longDescZh": "你的隊伍所受到的傷害\n當啟用時，靈氣會降低你和",
    "icon": "/skills/icon_105.png",
    "iconActive": "/skills/icon_105_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 106,
    "name": "Zeal",
    "nameZh": "白熱",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "作战技能",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [
      96
    ],
    "dependents": [
      111
    ],
    "mana": 2,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 12,
      "par6": 5,
      "par5": 2,
      "par2": 100,
      "par4": 6
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill11",
        "textaEn": "hits",
        "textaZh": "擊中",
        "calca": "\"min((par5 + lvl -1), par6)\""
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "((lvl < 5) ? 0 : ((lvl-4) * par4) )+skill('Sacrifice'.blvl)*par8"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill30",
        "textbKey": "StrSkill23",
        "textaEn": "Attack Bonus:",
        "textaZh": "攻擊加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "attacks multiple adjacent enemies",
    "shortDescZh": "攻擊多個鄰近的敵人",
    "longDesc": "with a single attack\nallows you to attack multiple adjacent enemies",
    "longDescZh": "攻擊數個鄰近的敵人\n讓你可以在揮動一次武器時",
    "icon": "/skills/icon_106.png",
    "iconActive": "/skills/icon_106_active.png",
    "toHit": 10,
    "toHitLev": 10,
    "startmana": 0
  },
  {
    "id": 107,
    "name": "Charge",
    "nameZh": "突擊",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "作战技能",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      97
    ],
    "dependents": [
      117
    ],
    "mana": 9,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 20,
      "par6": 0,
      "par5": 2,
      "par1": 150,
      "par3": 100,
      "par4": 25
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34+(skill('Vigor'.blvl)+skill('Might'.blvl))*par8"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "charge and attack target",
    "shortDescZh": "突擊並攻擊目標",
    "longDesc": "charge into battle and attack an enemy",
    "longDescZh": "突擊衝入戰場，並攻擊一個敵人",
    "icon": "/skills/icon_107.png",
    "iconActive": "/skills/icon_107_active.png",
    "toHit": 50,
    "toHitLev": 15,
    "startmana": 0
  },
  {
    "id": 108,
    "name": "Blessed Aim",
    "nameZh": "祝福瞄準",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 1,
    "tabName": "Offensive Auras",
    "tabNameZh": "攻击灵气",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [
      98
    ],
    "dependents": [
      113
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par6": 0,
      "par5": 0,
      "par1": 16,
      "par2": 2,
      "par3": 75,
      "par4": 15
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 112,
        "targetName": "Blessed Hammer",
        "targetNameZh": "祝福之鎚",
        "percentPerLevel": 14
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - increases your attack rating",
    "shortDescZh": "靈氣-增加你的準確率",
    "longDesc": "for you and your party\nwhen active, aura increases the attack rating",
    "longDescZh": "你的隊伍的準確率 \n當啟用時，靈氣會增加你和",
    "icon": "/skills/icon_108.png",
    "iconActive": "/skills/icon_108_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 109,
    "name": "Cleansing",
    "nameZh": "淨化",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 2,
    "tabName": "Defensive Auras",
    "tabNameZh": "防御灵气",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [
      99
    ],
    "dependents": [
      115,
      120
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 0,
      "par1": 16,
      "par2": 2,
      "par3": 30,
      "par4": 90
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 119,
        "targetName": "Sanctuary",
        "targetNameZh": "庇護所",
        "percentPerLevel": 7
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 4,
        "textaKey": "StrSkill50",
        "textaEn": "Heals:",
        "textaZh": "治療：",
        "calca": "skill('Prayer'.edmn)"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill74",
        "textbKey": "StrSkill23",
        "textaEn": "Duration reduced by",
        "textaZh": "持續性減低為",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 67,
        "textaKey": "skillname99",
        "textbKey": "Healplev2",
        "textaEn": "Prayer",
        "textaZh": "祈禱",
        "textbEn": "Life Healed Every 2 Seconds",
        "textbZh": "治療每2秒",
        "calca": "skill('Prayer'.edmn)"
      }
    ],
    "shortDesc": "aura - reduces poison and curse duration",
    "shortDescZh": "靈氣-降低毒氣和詛咒的持續時間",
    "longDesc": "will remain poisoned or cursed\nof time you and your party\nwhen active, aura reduces the length",
    "longDescZh": "毒氣和詛咒的持續時間\n你和你的隊伍受\n當啟用時，靈氣會降低",
    "icon": "/skills/icon_109.png",
    "iconActive": "/skills/icon_109_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 110,
    "name": "Resist Lightning",
    "nameZh": "抵抗閃電",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 2,
    "tabName": "Defensive Auras",
    "tabNameZh": "防御灵气",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 0,
      "par1": 16,
      "par2": 2,
      "par3": 35,
      "par4": 150
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 118,
        "targetName": "Holy Shock",
        "targetNameZh": "神聖衝擊",
        "percentPerLevel": 12
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill53",
        "textbKey": "StrSkill23",
        "textaEn": "Resist Lightning:",
        "textaZh": "抵抗閃電：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - protects against lightning damage",
    "shortDescZh": "靈氣保護你抵抗閃電的傷害",
    "longDesc": "done to you and your party\nwhen active, aura decreases lightning damage",
    "longDescZh": "對你和隊伍所造成的傷害\n當啟用時，靈氣會降低閃電",
    "icon": "/skills/icon_110.png",
    "iconActive": "/skills/icon_110_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 111,
    "name": "Vengeance",
    "nameZh": "復仇",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "作战技能",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      106
    ],
    "dependents": [
      116
    ],
    "mana": 16,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "11",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 30,
    "eLevLen": [
      15,
      15,
      15
    ],
    "params": {
      "par8": 10,
      "par7": 2,
      "par6": 0,
      "par5": 0,
      "par1": 70,
      "par2": 6
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill7",
        "textbKey": "StrSkill23",
        "textaEn": "Lightning Damage:",
        "textaZh": "閃電傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12+skill('Resist Lightning'.blvl)*par8+skill('Salvation'.blvl)*par7"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill6",
        "textbKey": "StrSkill23",
        "textaEn": "Cold Damage:",
        "textaZh": "冰凍傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12+skill('Resist Cold'.blvl)*par8+skill('Salvation'.blvl)*par7"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill5",
        "textbKey": "StrSkill23",
        "textaEn": "Fire Damage:",
        "textaZh": "火焰傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12+skill('Resist Fire'.blvl)*par8+skill('Salvation'.blvl)*par7"
      },
      {
        "lineType": 11
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill30",
        "textbKey": "StrSkill23",
        "textaEn": "Attack Bonus:",
        "textaZh": "攻擊加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      }
    ],
    "shortDesc": "attacks add elemental damage",
    "shortDescZh": "在攻擊中附上元素性傷害",
    "longDesc": "to each successful attack\nfire, lightning and cold damage are added",
    "longDescZh": "火焰、閃電和冰凍的傷害\n在每一次成功的攻擊中，會附加",
    "icon": "/skills/icon_111.png",
    "iconActive": "/skills/icon_111_active.png",
    "toHit": 20,
    "toHitLev": 10,
    "startmana": 0
  },
  {
    "id": 112,
    "name": "Blessed Hammer",
    "nameZh": "祝福之鎚",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "作战技能",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      101
    ],
    "dependents": [
      117,
      121
    ],
    "mana": 20,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "12",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "mag",
    "eMin": 12,
    "eMax": 16,
    "eMinLev": [
      8,
      10,
      12,
      13,
      14
    ],
    "eMaxLev": [
      8,
      10,
      12,
      13,
      14
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 14,
      "par6": 0,
      "par5": 0,
      "par1": 4
    },
    "synergyFormulas": {
      "elemental": "(skill('Vigor'.blvl)+skill('Blessed Aim'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Vigor",
        "providerId": 115,
        "percentPerLevel": 14,
        "type": "elemental"
      },
      {
        "providerName": "Blessed Aim",
        "providerId": 108,
        "percentPerLevel": 14,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 101,
        "targetName": "Holy Bolt",
        "targetNameZh": "聖光彈",
        "percentPerLevel": 50
      }
    ],
    "masteries": [
      113
    ],
    "descLines": [
      {
        "lineType": 48
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "summon a spiraling magic hammer",
    "shortDescZh": "召喚一個旋渦般的魔法鐵鎚",
    "longDesc": "150 Percent Damage to Undead\nspirals outwards damaging enemies it hits\nsummons an ethereal hammer that",
    "longDescZh": "對不死系生物造成150%的傷害\n朝敵人旋轉攻擊\n召喚一把永久的鐵鎚",
    "icon": "/skills/icon_112.png",
    "iconActive": "/skills/icon_112_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 113,
    "name": "Concentration",
    "nameZh": "專注",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 1,
    "tabName": "Offensive Auras",
    "tabNameZh": "攻击灵气",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      108
    ],
    "dependents": [
      122
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 20,
      "par1": 16,
      "par2": 2,
      "par3": 60,
      "par4": 15
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill76",
        "textbKey": "StrSkill23",
        "textaEn": "Chance uninterruptable",
        "textaZh": "破除中斷的機率",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "par5"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - increases your attack ability",
    "shortDescZh": "靈氣-增加你的攻擊力",
    "longDesc": "that the attack will be interrupted for you and your party \nwhen active, aura increases the damage and decreases the chance",
    "longDescZh": "增加破壞力，並降低攻擊中斷的可能\n當啟用時，靈氣會讓你和你的隊伍",
    "icon": "/skills/icon_113.png",
    "iconActive": "/skills/icon_113_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 114,
    "name": "Holy Freeze",
    "nameZh": "神聖冰凍",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 1,
    "tabName": "Offensive Auras",
    "tabNameZh": "攻击灵气",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      102
    ],
    "dependents": [
      118,
      119
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 2,
    "eMax": 3,
    "eMinLev": [
      1,
      2,
      3,
      4,
      5
    ],
    "eMaxLev": [
      1,
      2,
      3,
      4,
      5
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 15,
      "par7": 7,
      "par6": 0,
      "par5": 5,
      "par1": 6,
      "par2": 1,
      "par3": 25,
      "par4": 60
    },
    "synergyFormulas": {
      "elemental": "skill('Resist Cold'.blvl)*par8+skill('Salvation'.blvl)*par7"
    },
    "synergiesReceived": [
      {
        "providerName": "Resist Cold",
        "providerId": 105,
        "percentPerLevel": 15,
        "type": "elemental"
      },
      {
        "providerName": "Salvation",
        "providerId": 125,
        "percentPerLevel": 7,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill77",
        "textbKey": "StrSkill23",
        "textaEn": "Enemies slowed",
        "textaZh": "敵人減慢",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 10
      },
      {
        "lineType": 38,
        "textaKey": "StrSkill6",
        "textbKey": "strEskilllighttoattack",
        "textaEn": "Cold Damage:",
        "textaZh": "冰凍傷害：",
        "textbEn": "to your attack",
        "textbZh": "對你的攻擊",
        "calca": "edns*par5/256",
        "calcb": "edxs*par5/256"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - freezes nearby monsters",
    "shortDescZh": "靈氣-凍住附近的怪物",
    "longDesc": "when active, aura freezes nearby monsters",
    "longDescZh": "當啟用時，靈氣會凍住附近的怪物",
    "icon": "/skills/icon_114.png",
    "iconActive": "/skills/icon_114_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 115,
    "name": "Vigor",
    "nameZh": "精力",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 2,
    "tabName": "Defensive Auras",
    "tabNameZh": "防御灵气",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      109,
      104
    ],
    "dependents": [
      124
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 50,
      "par5": 7,
      "par1": 16,
      "par2": 3,
      "par3": 50,
      "par4": 25
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 112,
        "targetName": "Blessed Hammer",
        "targetNameZh": "祝福之鎚",
        "percentPerLevel": 14
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill69",
        "textbKey": "StrSkill23",
        "textaEn": "Stamina Recovery Rate:",
        "textaZh": "耐力回復率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill71",
        "textbKey": "StrSkill23",
        "textaEn": "Stamina Bonus:",
        "textaZh": "耐力加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill70",
        "textbKey": "StrSkill23",
        "textaEn": "Velocity:",
        "textaZh": "加速度：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm56"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - increases speed and stamina recovery",
    "shortDescZh": "靈氣-增加速度以及耐力的回復速度",
    "longDesc": "and movement speed for you and your party\nwhen active, aura increases stamina recovery rate, maximum stamina",
    "longDescZh": "耐力的上限以及你的移動速度\n當啟用時，靈氣會增加你和你隊伍的耐力回復速度",
    "icon": "/skills/icon_115.png",
    "iconActive": "/skills/icon_115_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 116,
    "name": "Conversion",
    "nameZh": "轉換",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "作战技能",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      111
    ],
    "dependents": [
      121
    ],
    "mana": 4,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 0,
      "par1": 400,
      "par4": 50
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill99",
        "textbKey": "StrSkill23",
        "textaEn": "Chance to convert:",
        "textaZh": "轉換的機會：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "Change allegiance of monsters",
    "shortDescZh": "變更怪物的陣營",
    "longDesc": "other foul demons and beasts\nconverts monsters to fight against",
    "longDescZh": "轉頭攻擊惡魔和怪物\n讓正在和你作戰的怪物",
    "icon": "/skills/icon_116.png",
    "iconActive": "/skills/icon_116_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln12",
    "startmana": 0
  },
  {
    "id": 117,
    "name": "Holy Shield",
    "nameZh": "神聖之盾",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "作战技能",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      107,
      112
    ],
    "dependents": [],
    "mana": 35,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 3,
    "maxDam": 6,
    "minLevDam": [
      2,
      3,
      4,
      4,
      4
    ],
    "maxLevDam": [
      2,
      3,
      4,
      4,
      4
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 15,
      "par6": 40,
      "par5": 10,
      "par1": 750,
      "par2": 625,
      "par3": 25,
      "par4": 15
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill110",
        "textbKey": "StrSkill23",
        "textaEn": "Successful Blocking:",
        "textaZh": "成功格擋：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm56"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill31",
        "textbKey": "StrSkill23",
        "textaEn": "Defense Bonus:",
        "textaZh": "防禦加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34+skill('Defiance'.blvl)*par8"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      },
      {
        "lineType": 49,
        "textaKey": "ItemStats1o",
        "textaEn": "Smite Damage:",
        "textaZh": "重擊傷害："
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "enhances your shield",
    "shortDescZh": "加強你的盾牌",
    "longDesc": "enhances your shield with divine power",
    "longDescZh": "利用神屬的力量來加強你的盾牌",
    "icon": "/skills/icon_117.png",
    "iconActive": "/skills/icon_117_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln12",
    "startmana": 0
  },
  {
    "id": 118,
    "name": "Holy Shock",
    "nameZh": "神聖衝擊",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 1,
    "tabName": "Offensive Auras",
    "tabNameZh": "攻击灵气",
    "row": 5,
    "col": 2,
    "reqlevel": 24,
    "reqskills": [
      114
    ],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 10,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      6,
      8,
      10,
      12,
      15
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 12,
      "par7": 4,
      "par6": 0,
      "par5": 6,
      "par1": 6,
      "par2": 1
    },
    "synergyFormulas": {
      "elemental": "skill('Resist Lightning'.blvl)*par8+skill('Salvation'.blvl)*par7"
    },
    "synergiesReceived": [
      {
        "providerName": "Resist Lightning",
        "providerId": 110,
        "percentPerLevel": 12,
        "type": "elemental"
      },
      {
        "providerName": "Salvation",
        "providerId": 125,
        "percentPerLevel": 4,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 121,
        "targetName": "Fist of the Heavens",
        "targetNameZh": "天堂之拳",
        "percentPerLevel": 7
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 38,
        "textaKey": "StrSkill7",
        "textbKey": "strEskilllighttoattack",
        "textaEn": "Lightning Damage:",
        "textaZh": "閃電傷害：",
        "textbEn": "to your attack",
        "textbZh": "對你的攻擊",
        "calca": "1",
        "calcb": "edxs*par5/256"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - lightning damages nearby enemies",
    "shortDescZh": "靈氣-對附近敵人造成閃電傷害",
    "longDesc": "adds lightning damage to your attack\nto damage nearby enemies\nwhen active, aura causes pulses of electricity",
    "longDescZh": "在你的攻擊中增加閃電傷害\n傷害週邊的怪物，\n當動作時，靈氣引發電擊脈衝",
    "icon": "/skills/icon_118.png",
    "iconActive": "/skills/icon_118_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 119,
    "name": "Sanctuary",
    "nameZh": "庇護所",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 1,
    "tabName": "Offensive Auras",
    "tabNameZh": "攻击灵气",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      103,
      114
    ],
    "dependents": [
      123
    ],
    "mana": 1,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "mag",
    "eMin": 8,
    "eMax": 16,
    "eMinLev": [
      4,
      4,
      5,
      5,
      6
    ],
    "eMaxLev": [
      4,
      5,
      6,
      6,
      7
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 7,
      "par6": 50,
      "par5": 100,
      "par1": 5,
      "par2": 1,
      "par3": 150,
      "par4": 30
    },
    "synergyFormulas": {
      "elemental": "skill('Cleansing'.blvl)*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Cleansing",
        "providerId": 109,
        "percentPerLevel": 7,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 67,
        "textaKey": "ModStr4f",
        "textbKey": "StrSkill23",
        "textaEn": "Damage to Undead",
        "textaZh": "對不死生物的傷害",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - repels and damages undead",
    "shortDescZh": "靈氣-趨逐並傷害不死系生物",
    "longDesc": "and knocks them back\nwhen active, aura damages the undead",
    "longDescZh": "並逼退它們\n當啟用時，靈氣會傷害不死系生物",
    "icon": "/skills/icon_119.png",
    "iconActive": "/skills/icon_119_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 120,
    "name": "Meditation",
    "nameZh": "冥思",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 2,
    "tabName": "Defensive Auras",
    "tabNameZh": "防御灵气",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      109
    ],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 0,
      "par1": 16,
      "par2": 2,
      "par3": 300,
      "par4": 25
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 4,
        "textaKey": "StrSkill50",
        "textaEn": "Heals:",
        "textaZh": "治療：",
        "calca": "skill('Prayer'.edmn)"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill88",
        "textbKey": "StrSkill23",
        "textaEn": "Mana Recovery Rate:",
        "textaZh": "法力回復比率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 67,
        "textaKey": "skillname99",
        "textbKey": "Healplev2",
        "textaEn": "Prayer",
        "textaZh": "祈禱",
        "textbEn": "Life Healed Every 2 Seconds",
        "textbZh": "治療每2秒",
        "calca": "skill('Prayer'.edmn)"
      }
    ],
    "shortDesc": "aura - increases mana recovery",
    "shortDescZh": "靈氣-增加你的法力回復速度",
    "longDesc": "for you and your party\nwhen active, aura increases mana recovery",
    "longDescZh": "你和你隊伍的法力回復速度\n當啟用時，靈氣會增加",
    "icon": "/skills/icon_120.png",
    "iconActive": "/skills/icon_120_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 121,
    "name": "Fist of the Heavens",
    "nameZh": "天堂之拳",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "作战技能",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      112,
      116
    ],
    "dependents": [],
    "mana": 25,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 25,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 150,
    "eMax": 200,
    "eMinLev": [
      15,
      30,
      45,
      55,
      65
    ],
    "eMaxLev": [
      15,
      30,
      45,
      55,
      65
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 7,
      "par6": 2,
      "par5": 6,
      "par1": 6,
      "par2": 1,
      "par3": 1,
      "par4": 2
    },
    "synergyFormulas": {
      "elemental": "skill('Holy Shock'.blvl)*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Holy Shock",
        "providerId": 118,
        "percentPerLevel": 7,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 101,
        "targetName": "Holy Bolt",
        "targetNameZh": "聖光彈",
        "percentPerLevel": 50
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 50,
        "textaKey": "StrSkill91",
        "textaEn": "Holy Bolt Damage:",
        "textaZh": "聖光彈的傷害："
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "target is banished",
    "shortDescZh": "目標將被放逐",
    "longDesc": "seek out nearby enemies\nlightning strikes your target as holy bolts",
    "longDescZh": "附近的敵人，並直擊你的目標\n神聖的閃電光彈會自動找出",
    "icon": "/skills/icon_121.png",
    "iconActive": "/skills/icon_121_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 122,
    "name": "Fanaticism",
    "nameZh": "狂熱",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 1,
    "tabName": "Offensive Auras",
    "tabNameZh": "攻击灵气",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      113
    ],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 17,
      "par5": 50,
      "par1": 11,
      "par2": 1,
      "par3": 10,
      "par4": 40
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill106",
        "textbKey": "StrSkill23",
        "textaEn": "Attack Speed:",
        "textaZh": "準確率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 2,
        "textaKey": "FanYDam",
        "textbKey": "StrSkill23",
        "textaEn": "Your Damage:",
        "textaZh": "你的傷害:",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln56"
      },
      {
        "lineType": 2,
        "textaKey": "PartDam",
        "textbKey": "StrSkill23",
        "textaEn": "Party Damage:",
        "textaZh": "團隊傷害:",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln56/2"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - increases attack speed and damage",
    "shortDescZh": "靈氣-增加攻擊速度和傷害",
    "longDesc": "and attack rating for you and your party\nwhen active, aura increases damage, attack speed,",
    "longDescZh": "傷害、攻擊速度和準確率\n當你發揮之後，靈氣會增加你和你隊伍人士的",
    "icon": "/skills/icon_122.png",
    "iconActive": "/skills/icon_122_active.png",
    "toHit": 40,
    "toHitLev": 5,
    "startmana": 0
  },
  {
    "id": 123,
    "name": "Conviction",
    "nameZh": "信念",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 1,
    "tabName": "Offensive Auras",
    "tabNameZh": "攻击灵气",
    "row": 6,
    "col": 3,
    "reqlevel": 30,
    "reqskills": [
      119
    ],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 100,
      "par5": 40,
      "par1": 20,
      "par3": 30,
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill90",
        "textbKey": "StrSkill23",
        "textaEn": "Resistances:",
        "textaZh": "抵抗：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "\"-min(ln34,150)\""
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill21",
        "textbKey": "StrSkill23",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "-dm56"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - weakens enemies",
    "shortDescZh": "靈氣 - 軟弱敵人",
    "longDesc": "and resistances of nearby enemies\nwhen active, aura reduces the defenses",
    "longDescZh": "防禦力量和抵抗力量\n當啟用時，靈氣會降低附近敵人的",
    "icon": "/skills/icon_123.png",
    "iconActive": "/skills/icon_123_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 124,
    "name": "Redemption",
    "nameZh": "救贖",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 2,
    "tabName": "Defensive Auras",
    "tabNameZh": "防御灵气",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      115
    ],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 5,
      "par5": 25,
      "par1": 16,
      "par3": 10,
      "par4": 100
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill107",
        "textbKey": "StrSkill108",
        "textaEn": "Life/Mana Recovered:",
        "textaZh": "生命/法力回復：",
        "textbEn": "points",
        "textbZh": "點",
        "calca": "ln56"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill109",
        "textbKey": "StrSkill23",
        "textaEn": "Chance to redeem soul:",
        "textaZh": "救贖靈魂的機率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - redeems the dead for mana and life",
    "shortDescZh": "靈氣-讓死去的人重獲法力和生命",
    "longDesc": "you life and mana\nthe souls of slain enemies to give\nwhen active, aura attempts to redeem",
    "longDescZh": "中的人員重獲法力和生命\n被殺死敵人的靈魂，讓你和隊伍\n當啟用時，靈氣會試著利用",
    "icon": "/skills/icon_124.png",
    "iconActive": "/skills/icon_124_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 125,
    "name": "Salvation",
    "nameZh": "救助",
    "classCode": "pal",
    "classNameZh": "圣骑士",
    "tabIndex": 2,
    "tabName": "Defensive Auras",
    "tabNameZh": "防御灵气",
    "row": 6,
    "col": 3,
    "reqlevel": 30,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 16,
      "par2": 2,
      "par3": 50,
      "par4": 120
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 102,
        "targetName": "Holy Fire",
        "targetNameZh": "聖火",
        "percentPerLevel": 6
      },
      {
        "targetId": 114,
        "targetName": "Holy Freeze",
        "targetNameZh": "神聖冰凍",
        "percentPerLevel": 7
      },
      {
        "targetId": 118,
        "targetName": "Holy Shock",
        "targetNameZh": "神聖衝擊",
        "percentPerLevel": 4
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill54",
        "textbKey": "StrSkill23",
        "textaEn": "Resist All:",
        "textaZh": "全面抵抗：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "aura - protects against elemental damage",
    "shortDescZh": "靈氣-保護你免於元素性的傷害",
    "longDesc": "done to you and your party\nwhen active, aura decreases fire, cold and lightning damage",
    "longDescZh": "閃電對你和你的隊伍所造成的傷害\n當啟用時，靈氣會降低火焰、冰凍和",
    "icon": "/skills/icon_125.png",
    "iconActive": "/skills/icon_125_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 126,
    "name": "Bash",
    "nameZh": "重擊",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "战斗技能",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      133,
      139
    ],
    "mana": 2,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par7": 5,
      "par1": 50,
      "par2": 5,
      "par3": 1,
      "par4": 1
    },
    "synergyFormulas": {
      "damage": "skill('Stun'.blvl)*par8",
      "toHit": "skill('Concentrate'.blvl)*par7"
    },
    "synergiesReceived": [
      {
        "providerName": "Stun",
        "providerId": 139,
        "percentPerLevel": 5,
        "type": "damage"
      },
      {
        "providerName": "Concentrate",
        "providerId": 144,
        "percentPerLevel": 5,
        "type": "toHit"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 133,
        "targetName": "Double Swing",
        "targetNameZh": "雙手揮擊",
        "percentPerLevel": 10
      },
      {
        "targetId": 139,
        "targetName": "Stun",
        "targetNameZh": "擊昏",
        "percentPerLevel": 8
      },
      {
        "targetId": 144,
        "targetName": "Concentrate",
        "targetNameZh": "專心",
        "percentPerLevel": 5
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 4,
        "textaKey": "StrSkill4",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "calca": "ln34"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "clc1"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "powerful blow that increases damage",
    "shortDescZh": "威力強大的一擊，以增加傷害",
    "longDesc": "to enemies and knocks them back\npowerful blow that increases the damage done",
    "longDescZh": "並把敵人打退\n威力強大的一擊，可以增加造成的傷害",
    "icon": "/skills/icon_126.png",
    "iconActive": "/skills/icon_126_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "toHitCalc": "15+lvl*5+skill('Concentrate'.blvl)*par7",
    "startmana": 0
  },
  {
    "id": 127,
    "name": "Sword Mastery",
    "nameZh": "支配長劍",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 1,
    "tabName": "Combat Masteries",
    "tabNameZh": "战斗专家",
    "row": 1,
    "col": 1,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 35,
      "par5": 0,
      "par1": 28,
      "par2": 8,
      "par3": 28,
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 51,
        "textaKey": "eskillincasemasteryX",
        "textaEn": "%d Percent Chance of Critical Strike",
        "textaZh": "%d機率做出致命一擊",
        "calca": "macr"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "math"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "madm"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - improves sword fighting skill",
    "shortDescZh": "被動-增加你用劍的戰鬥技能",
    "longDesc": "passive - improves sword fighting skill",
    "longDescZh": "被動-增加你用劍的戰鬥技能",
    "icon": "/skills/icon_127.png",
    "iconActive": "/skills/icon_127_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 128,
    "name": "Axe Mastery",
    "nameZh": "支配斧頭",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 1,
    "tabName": "Combat Masteries",
    "tabNameZh": "战斗专家",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 35,
      "par5": 0,
      "par1": 28,
      "par2": 8,
      "par3": 28,
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 51,
        "textaKey": "eskillincasemasteryX",
        "textaEn": "%d Percent Chance of Critical Strike",
        "textaZh": "%d機率做出致命一擊",
        "calca": "macr"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "math"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "madm"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - improves axe fighting skill",
    "shortDescZh": "被動-增加你用斧的戰鬥技能",
    "longDesc": "passive - improves axe fighting skill",
    "longDescZh": "被動-增加你用斧的戰鬥技能",
    "icon": "/skills/icon_128.png",
    "iconActive": "/skills/icon_128_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 129,
    "name": "Mace Mastery",
    "nameZh": "支配釘頭鎚",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 1,
    "tabName": "Combat Masteries",
    "tabNameZh": "战斗专家",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 35,
      "par5": 0,
      "par1": 28,
      "par2": 8,
      "par3": 28,
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 51,
        "textaKey": "eskillincasemasteryX",
        "textaEn": "%d Percent Chance of Critical Strike",
        "textaZh": "%d機率做出致命一擊",
        "calca": "macr"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "math"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "madm"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - improves mace fighting skill",
    "shortDescZh": "被動-增加你用釘頭鎚的戰鬥技能",
    "longDesc": "passive - improves mace fighting skill",
    "longDescZh": "被動-增加你用釘頭鎚的戰鬥技能",
    "icon": "/skills/icon_129.png",
    "iconActive": "/skills/icon_129_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 130,
    "name": "Howl",
    "nameZh": "狂嗥",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 2,
    "tabName": "Warcries",
    "tabNameZh": "呐喊",
    "row": 1,
    "col": 1,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      137,
      138
    ],
    "mana": 4,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 25,
      "par5": 75,
      "par1": 2,
      "par2": 1,
      "par3": 24,
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 154,
        "targetName": "War Cry",
        "targetNameZh": "戰鬥狂嗥",
        "percentPerLevel": 6
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill59",
        "textaEn": "Enemy runs for",
        "textaZh": "敵人逃竄是因為",
        "calca": "ln56"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill58",
        "textaEn": "Enemy runs up to",
        "textaZh": "敵人跑上來要",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "frightens nearby monsters",
    "shortDescZh": "嚇壞附近的怪物",
    "longDesc": "scrambling away in fear\nsends nearby monsters",
    "longDescZh": "恐懼之中四散奔跑\n讓附近的怪物在",
    "icon": "/skills/icon_130.png",
    "iconActive": "/skills/icon_130_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 131,
    "name": "Find Potion",
    "nameZh": "找尋葯劑",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 2,
    "tabName": "Warcries",
    "tabNameZh": "呐喊",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      142
    ],
    "mana": 2,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par2": 100,
      "par3": 30,
      "par4": 10
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill24",
        "textaEn": "percent chance",
        "textaZh": "百分機率",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "targets corpses to find potions",
    "shortDescZh": "對準屍體找出葯劑",
    "longDesc": "for a chance to find a potion\nuse on the corpse of a slain monster",
    "longDescZh": "看看有沒有機會找出葯劑\n使用殺死怪物的屍體",
    "icon": "/skills/icon_131.png",
    "iconActive": "/skills/icon_131_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 132,
    "name": "Leap",
    "nameZh": "跳躍",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "战斗技能",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      143
    ],
    "mana": 2,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 4,
      "par2": 30,
      "par3": 4,
      "par4": 1
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 143,
        "targetName": "Leap Attack",
        "targetNameZh": "跳躍攻擊",
        "percentPerLevel": 10
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "jumps over obstacles",
    "shortDescZh": "跳過障礙",
    "longDesc": "or into the fray\nleaps away from danger",
    "longDescZh": "跳入爭戰之中\n從危險之中跳離或是",
    "icon": "/skills/icon_132.png",
    "iconActive": "/skills/icon_132_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 133,
    "name": "Double Swing",
    "nameZh": "雙手揮擊",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "战斗技能",
    "row": 2,
    "col": 3,
    "reqlevel": 6,
    "reqskills": [
      126
    ],
    "dependents": [
      140
    ],
    "mana": 8,
    "lvlmana": -1,
    "minmana": 0,
    "manashift": 5,
    "delay": 0,
    "descdam": "19",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 10,
      "par5": 50,
      "par1": 50
    },
    "synergyFormulas": {
      "damage": "skill('Bash'.blvl)*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Bash",
        "providerId": 126,
        "percentPerLevel": 10,
        "type": "damage"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 140,
        "targetName": "Double Throw",
        "targetNameZh": "雙手投擲",
        "percentPerLevel": 8
      },
      {
        "targetId": 147,
        "targetName": "Frenzy",
        "targetNameZh": "狂亂",
        "percentPerLevel": 8
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 5,
        "textaKey": "StrSkill3",
        "textaEn": "Mana Cost:",
        "textaZh": "法力耗費：",
        "calca": "usmc/128"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "clc1"
      }
    ],
    "shortDesc": "swings two weapons at once",
    "shortDescZh": "同時揮動二把武器",
    "longDesc": "or one target twice\nattacks two targets if possible,\nwhen two weapons are equipped",
    "longDescZh": "同時傷害二個目標\n就有可能在一次攻擊之中，\n當你裝備了二把武器",
    "icon": "/skills/icon_133.png",
    "iconActive": "/skills/icon_133_active.png",
    "toHit": 15,
    "toHitLev": 5,
    "startmana": 0
  },
  {
    "id": 134,
    "name": "Pole Arm Mastery",
    "nameZh": "支配長棍",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 1,
    "tabName": "Combat Masteries",
    "tabNameZh": "战斗专家",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 35,
      "par5": 0,
      "par1": 30,
      "par2": 8,
      "par3": 28,
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 51,
        "textaKey": "eskillincasemasteryX",
        "textaEn": "%d Percent Chance of Critical Strike",
        "textaZh": "%d機率做出致命一擊",
        "calca": "macr"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "math"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "madm"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - improves pole arm skill",
    "shortDescZh": "被動-增加你用長棍的戰鬥技能",
    "longDesc": "passive - improves pole arm skill",
    "longDescZh": "被動-增加你用長棍的戰鬥技能",
    "icon": "/skills/icon_134.png",
    "iconActive": "/skills/icon_134_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 135,
    "name": "Throwing Mastery",
    "nameZh": "支配飛擲",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 1,
    "tabName": "Combat Masteries",
    "tabNameZh": "战斗专家",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 35,
      "par5": 0,
      "par1": 30,
      "par2": 8,
      "par3": 28,
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 51,
        "textaKey": "eskillincasemasteryX",
        "textaEn": "%d Percent Chance of Critical Strike",
        "textaZh": "%d機率做出致命一擊",
        "calca": "macr"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "math"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "madm"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - improves thrown weapon skill",
    "shortDescZh": "被動-增加你用投擲性武器的戰鬥技能",
    "longDesc": "passive - improves thrown weapon skill",
    "longDescZh": "被動-增加你用投擲性武器的戰鬥技能",
    "icon": "/skills/icon_135.png",
    "iconActive": "/skills/icon_135_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 136,
    "name": "Spear Mastery",
    "nameZh": "支配長矛",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 1,
    "tabName": "Combat Masteries",
    "tabNameZh": "战斗专家",
    "row": 2,
    "col": 3,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 35,
      "par5": 0,
      "par1": 30,
      "par2": 8,
      "par3": 28,
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 51,
        "textaKey": "eskillincasemasteryX",
        "textaEn": "%d Percent Chance of Critical Strike",
        "textaZh": "%d機率做出致命一擊",
        "calca": "macr"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "math"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "madm"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - improves spear fighting skill",
    "shortDescZh": "被動-增加你用長矛的戰鬥技能",
    "longDesc": "passive - improves spear fighting skill",
    "longDescZh": "被動-增加你用長矛的戰鬥技能",
    "icon": "/skills/icon_136.png",
    "iconActive": "/skills/icon_136_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 137,
    "name": "Taunt",
    "nameZh": "嘲弄",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 2,
    "tabName": "Warcries",
    "tabNameZh": "呐喊",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [
      130
    ],
    "dependents": [
      146
    ],
    "mana": 3,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": -5,
      "par2": -2,
      "par3": -5,
      "par4": -2
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 154,
        "targetName": "War Cry",
        "targetNameZh": "戰鬥狂嗥",
        "percentPerLevel": 6
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill57",
        "textbKey": "StrSkill23",
        "textaEn": "Target's Attack:",
        "textaZh": "目標的攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill38",
        "textbKey": "StrSkill23",
        "textaEn": "Target's Damage:",
        "textaZh": "目標的傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "causes a monster to attack",
    "shortDescZh": "導致一個怪物開始攻擊",
    "longDesc": "enrages a monster into relentlessly attacking",
    "longDescZh": "觸怒一個怪物，讓他展開無情的攻擊",
    "icon": "/skills/icon_137.png",
    "iconActive": "/skills/icon_137_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 138,
    "name": "Shout",
    "nameZh": "大叫",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 2,
    "tabName": "Warcries",
    "tabNameZh": "呐喊",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [
      130
    ],
    "dependents": [
      149
    ],
    "mana": 6,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 125,
      "par1": 100,
      "par2": 10,
      "par3": 500,
      "par4": 250
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "len"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill21",
        "textbKey": "StrSkill23",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "alerts party and improves defense",
    "shortDescZh": "警告你的隊伍，並加強防禦",
    "longDesc": "rating of you and your party\nwarns of impending danger and improves the defense",
    "longDescZh": "危險，並加強你的防禦力\n警告你和你的隊伍眼前逼近的",
    "icon": "/skills/icon_138.png",
    "iconActive": "/skills/icon_138_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34+(skill('Battle Orders'.blvl)+skill('Battle Command'.blvl))*par8",
    "startmana": 0
  },
  {
    "id": 139,
    "name": "Stun",
    "nameZh": "擊昏",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "战斗技能",
    "row": 3,
    "col": 2,
    "reqlevel": 12,
    "reqskills": [
      126
    ],
    "dependents": [
      144
    ],
    "mana": 2,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "stun",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 30,
    "eLevLen": [
      5,
      5,
      2
    ],
    "params": {
      "par8": 8,
      "par7": 5,
      "par6": 5,
      "par1": 30,
      "par2": 5
    },
    "synergyFormulas": {
      "damage": "skill('Bash'.blvl)*par8",
      "toHit": "skill('Concentrate'.blvl)*par7",
      "duration": "skill('War Cry'.blvl)*par6"
    },
    "synergiesReceived": [
      {
        "providerName": "Bash",
        "providerId": 126,
        "percentPerLevel": 8,
        "type": "damage"
      },
      {
        "providerName": "Concentrate",
        "providerId": 144,
        "percentPerLevel": 5,
        "type": "toHit"
      },
      {
        "providerName": "War Cry",
        "providerId": 154,
        "percentPerLevel": 5,
        "type": "duration"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 126,
        "targetName": "Bash",
        "targetNameZh": "重擊",
        "percentPerLevel": 5
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "\"min(250,edln)\""
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "clc1"
      }
    ],
    "shortDesc": "stuns your target",
    "shortDescZh": "把你的目標擊昏",
    "longDesc": "and increases your attack rating\nstuns your target for a short time",
    "longDescZh": "並增加你的準確率\n把你的目標擊昏一小段時間",
    "icon": "/skills/icon_139.png",
    "iconActive": "/skills/icon_139_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "toHitCalc": "10+lvl*5+skill('Concentrate'.blvl)*par7",
    "startmana": 0
  },
  {
    "id": 140,
    "name": "Double Throw",
    "nameZh": "雙手投擲",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "战斗技能",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      133
    ],
    "dependents": [
      147
    ],
    "mana": 1,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "13",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 8
    },
    "synergyFormulas": {
      "damage": "skill('Double Swing'.blvl)*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Double Swing",
        "providerId": 133,
        "percentPerLevel": 8,
        "type": "damage"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 5,
        "textaKey": "StrSkill3",
        "textaEn": "Mana Cost:",
        "textaZh": "法力耗費：",
        "calca": "usmc/128"
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "clc1"
      }
    ],
    "shortDesc": "throw two weapons at once",
    "shortDescZh": "同時丟出二個武器",
    "longDesc": "throwing weapons at the same time\nallows you to throw two different",
    "longDescZh": "丟出二種不同的武器\n可以讓你在同一時間",
    "icon": "/skills/icon_140.png",
    "iconActive": "/skills/icon_140_active.png",
    "toHit": 20,
    "toHitLev": 10,
    "startmana": 0
  },
  {
    "id": 141,
    "name": "Increased Stamina",
    "nameZh": "增加耐力",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 1,
    "tabName": "Combat Masteries",
    "tabNameZh": "战斗专家",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [],
    "dependents": [
      148
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 30,
      "par2": 15
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill71",
        "textbKey": "StrSkill23",
        "textaEn": "Stamina Bonus:",
        "textaZh": "耐力加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - increases stamina",
    "shortDescZh": "被動-增加耐力",
    "longDesc": "passive - increases your stamina",
    "longDescZh": "被動-增加你的耐力",
    "icon": "/skills/icon_141.png",
    "iconActive": "/skills/icon_141_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 142,
    "name": "Find Item",
    "nameZh": "找尋物品",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 2,
    "tabName": "Warcries",
    "tabNameZh": "呐喊",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      131
    ],
    "dependents": [
      150
    ],
    "mana": 7,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 5,
      "par2": 60,
      "par3": 30,
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill24",
        "textaEn": "percent chance",
        "textaZh": "百分機率",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "targets corpses to find items",
    "shortDescZh": "對準屍體找尋物品",
    "longDesc": "to find hidden treasures\nuse on the corpse of a slain monster",
    "longDescZh": "中找出隱藏的寶物\n在已殺死的怪物屍體",
    "icon": "/skills/icon_142.png",
    "iconActive": "/skills/icon_142_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 143,
    "name": "Leap Attack",
    "nameZh": "跳躍攻擊",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "战斗技能",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      132
    ],
    "dependents": [
      151
    ],
    "mana": 9,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 10,
      "par6": 2,
      "par5": 4,
      "par1": 4,
      "par2": 30,
      "par3": 100,
      "par4": 30
    },
    "synergyFormulas": {
      "damage": "skill('Leap'.blvl)*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Leap",
        "providerId": 132,
        "percentPerLevel": 10,
        "type": "damage"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "clc1"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "leaps and attacks target enemy",
    "shortDescZh": "跳躍並攻擊目標的敵人",
    "longDesc": "in one swift assault\nleaps to and attacks target enemy",
    "longDescZh": "進行迅速的突擊\n跳躍並對攻擊目標",
    "icon": "/skills/icon_143.png",
    "iconActive": "/skills/icon_143_active.png",
    "toHit": 50,
    "toHitLev": 15,
    "startmana": 0
  },
  {
    "id": 144,
    "name": "Concentrate",
    "nameZh": "專心",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "战斗技能",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      139
    ],
    "dependents": [
      151,
      152
    ],
    "mana": 2,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "mag",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par7": 10,
      "par1": 70,
      "par2": 5,
      "par3": 100,
      "par4": 10
    },
    "synergyFormulas": {
      "damage": "skill('Bash'.blvl)*par8+skill('Battle Orders'.blvl)*par7",
      "defense": "skill('Iron Skin'.blvl)*par7",
      "magic": "skill('Berserk'.blvl)*1"
    },
    "synergiesReceived": [
      {
        "providerName": "Bash",
        "providerId": 126,
        "percentPerLevel": 5,
        "type": "damage"
      },
      {
        "providerName": "Battle Orders",
        "providerId": 149,
        "percentPerLevel": 10,
        "type": "damage"
      },
      {
        "providerName": "Iron Skin",
        "providerId": 145,
        "percentPerLevel": 10,
        "type": "defense"
      },
      {
        "providerName": "Berserk",
        "providerId": 152,
        "percentPerLevel": 1,
        "type": "magic"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 126,
        "targetName": "Bash",
        "targetNameZh": "重擊",
        "percentPerLevel": 5
      },
      {
        "targetId": 139,
        "targetName": "Stun",
        "targetNameZh": "擊昏",
        "percentPerLevel": 5
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "clc1"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill31",
        "textbKey": "StrSkill23",
        "textaEn": "Defense Bonus:",
        "textaZh": "防禦加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill39",
        "textbKey": "StrSkill23",
        "textaEn": "Magic Damage:",
        "textaZh": "魔法傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "clc4"
      }
    ],
    "shortDesc": "attack that is not interruptible",
    "shortDescZh": "讓攻擊完全不受干擾",
    "longDesc": "improves attack and defense rating\nattack that is not interruptible and",
    "longDescZh": "提高準確率和防禦力\n讓攻擊不致於中斷而且",
    "icon": "/skills/icon_144.png",
    "iconActive": "/skills/icon_144_active.png",
    "toHit": 60,
    "toHitLev": 10,
    "startmana": 0
  },
  {
    "id": 145,
    "name": "Iron Skin",
    "nameZh": "鐵布杉",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 1,
    "tabName": "Combat Masteries",
    "tabNameZh": "战斗专家",
    "row": 4,
    "col": 3,
    "reqlevel": 18,
    "reqskills": [],
    "dependents": [
      153
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 30,
      "par2": 10
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 6,
        "textaKey": "StrSkill23",
        "textaEn": "percent",
        "textaZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - improves defense rating",
    "shortDescZh": "被動-增加你的防禦力",
    "longDesc": "passive - improves defense rating",
    "longDescZh": "被動-增加你的防禦力",
    "icon": "/skills/icon_145.png",
    "iconActive": "/skills/icon_145_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 146,
    "name": "Battle Cry",
    "nameZh": "戰嗥",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 2,
    "tabName": "Warcries",
    "tabNameZh": "呐喊",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      137
    ],
    "dependents": [
      154
    ],
    "mana": 5,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": -1,
      "par5": -25,
      "par1": 300,
      "par2": 60,
      "par3": -50,
      "par4": -2
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 154,
        "targetName": "War Cry",
        "targetNameZh": "戰鬥狂嗥",
        "percentPerLevel": 6
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln56"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill21",
        "textbKey": "StrSkill23",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "reduces enemy effectiveness",
    "shortDescZh": "降低敵人的效率",
    "longDesc": "enemies' defense rating and damage\nfearsome cry that decreases",
    "longDescZh": "敵人的防禦力和傷害力\n令人恐懼的狂吼可以降低",
    "icon": "/skills/icon_146.png",
    "iconActive": "/skills/icon_146_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln12",
    "startmana": 0
  },
  {
    "id": 147,
    "name": "Frenzy",
    "nameZh": "狂亂",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "战斗技能",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      140
    ],
    "dependents": [],
    "mana": 3,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "19",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "mag",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 8,
      "par7": 150,
      "par6": 50,
      "par5": 0,
      "par1": 90,
      "par2": 5,
      "par3": 20,
      "par4": 200
    },
    "synergyFormulas": {
      "damage": "(skill('Double Swing'.blvl)+skill('Taunt'.blvl))*par8",
      "duration": "skill('Increased Stamina'.blvl)*10",
      "magic": "skill('Berserk'.blvl)*1"
    },
    "synergiesReceived": [
      {
        "providerName": "Double Swing",
        "providerId": 133,
        "percentPerLevel": 8,
        "type": "damage"
      },
      {
        "providerName": "Taunt",
        "providerId": 137,
        "percentPerLevel": 8,
        "type": "damage"
      },
      {
        "providerName": "Increased Stamina",
        "providerId": 141,
        "percentPerLevel": 0.4,
        "type": "duration"
      },
      {
        "providerName": "Berserk",
        "providerId": 152,
        "percentPerLevel": 1,
        "type": "magic"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 5,
        "textaKey": "StrSkill3",
        "textaEn": "Mana Cost:",
        "textaZh": "法力耗費：",
        "calca": "usmc/128"
      },
      {
        "lineType": 52,
        "textaKey": "StrSkill89",
        "textbKey": "StrSkill23",
        "textaEn": "Walk/Run Speed:",
        "textaZh": "行走/跑步速度：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "15*(par4-par3)/100+par3",
        "calcb": "dm34"
      },
      {
        "lineType": 52,
        "textaKey": "StrSkill106",
        "textbKey": "StrSkill23",
        "textaEn": "Attack Speed:",
        "textaZh": "準確率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "15*(par6-par5)/100+par5",
        "calcb": "dm56"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "clc1"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "par7"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill39",
        "textbKey": "StrSkill23",
        "textaEn": "Magic Damage:",
        "textaZh": "魔法傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "clc4"
      }
    ],
    "shortDesc": "successful double swing hit increases speed",
    "shortDescZh": "成功擊中讓揮動速度加倍",
    "longDesc": "requires you to equip two weapons\neach successful attack increases your overall speed\nallows you to swing two weapons at once",
    "longDescZh": "必須先裝備二把武器\n每次成功的擊中後可以增加你整體性的攻擊速度\n讓你同時揮動二把武器",
    "icon": "/skills/icon_147.png",
    "iconActive": "/skills/icon_147_active.png",
    "toHit": 100,
    "toHitLev": 7,
    "auraLenCalc": "par7",
    "startmana": 0
  },
  {
    "id": 148,
    "name": "Increased Speed",
    "nameZh": "加速",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 1,
    "tabName": "Combat Masteries",
    "tabNameZh": "战斗专家",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      141
    ],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 7,
      "par2": 50
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill89",
        "textbKey": "StrSkill23",
        "textaEn": "Walk/Run Speed:",
        "textaZh": "行走/跑步速度：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - increases walk and run speed",
    "shortDescZh": "被動-增加行走和跑步的速度",
    "longDesc": "passive - increases walk and run speed",
    "longDescZh": "被動-增加行走和跑步的速度",
    "icon": "/skills/icon_148.png",
    "iconActive": "/skills/icon_148_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 149,
    "name": "Battle Orders",
    "nameZh": "戰鬥體制",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 2,
    "tabName": "Warcries",
    "tabNameZh": "呐喊",
    "row": 5,
    "col": 2,
    "reqlevel": 24,
    "reqskills": [
      138
    ],
    "dependents": [
      154,
      155
    ],
    "mana": 7,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 125,
      "par1": 750,
      "par2": 250,
      "par3": 35,
      "par4": 3
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill101",
        "textbKey": "StrSkill23",
        "textaEn": "Max Mana:",
        "textaZh": "法力最大值：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill100",
        "textbKey": "StrSkill23",
        "textaEn": "Max Life:",
        "textaZh": "生命最大值：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill102",
        "textbKey": "StrSkill23",
        "textaEn": "Max Stamina:",
        "textaZh": "耐力最大值：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "len"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "improves life, mana and stamina of party",
    "shortDescZh": "加強隊伍的生命、法力和耐力",
    "longDesc": "stamina of you and your party\nimproves the maximum mana, life and",
    "longDescZh": "法力、生命和耐力上限 \n加強你和你隊伍的",
    "icon": "/skills/icon_149.png",
    "iconActive": "/skills/icon_149_active.png",
    "toHit": 50,
    "toHitLev": 10,
    "auraLenCalc": "ln12+(skill('Shout'.blvl)+skill('Battle Command'.blvl))*par8",
    "startmana": 0
  },
  {
    "id": 150,
    "name": "Grim Ward",
    "nameZh": "殘酷嚇阻",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 2,
    "tabName": "Warcries",
    "tabNameZh": "呐喊",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      142
    ],
    "dependents": [],
    "mana": 4,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 60,
      "par5": 10,
      "par1": 3,
      "par2": 1,
      "par3": 1000
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln12"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "creates a frightening totem",
    "shortDescZh": "創造出一個嚇人的圖騰",
    "longDesc": "that causes nearby monsters to flee\nto create a frightening totem\nuse on the corpse of a slain monster",
    "longDescZh": "導致附近的怪物四散逃避\n創造一個嚇人的圖騰\n施展在已死的怪物屍體上",
    "icon": "/skills/icon_150.png",
    "iconActive": "/skills/icon_150_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "par6",
    "startmana": 0
  },
  {
    "id": 151,
    "name": "Whirlwind",
    "nameZh": "旋風",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "战斗技能",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      143,
      144
    ],
    "dependents": [],
    "mana": 25,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 0,
    "descdam": "1",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": -50,
      "par2": 8,
      "par3": 1
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "clc1"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "whirling dance of death",
    "shortDescZh": "旋轉的死亡之舞",
    "longDesc": "legions of your enemies\nthat cuts a path through the\na whirling dance of death",
    "longDescZh": "切出一條路\n在你的敵陣之間\n旋轉的死亡之舞",
    "icon": "/skills/icon_151.png",
    "iconActive": "/skills/icon_151_active.png",
    "toHit": 0,
    "toHitLev": 5,
    "startmana": 0
  },
  {
    "id": 152,
    "name": "Berserk",
    "nameZh": "狂戰士",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 0,
    "tabName": "Combat Skills",
    "tabNameZh": "战斗技能",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      144
    ],
    "dependents": [],
    "mana": 4,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "mag",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 10,
      "par5": 0,
      "par1": 150,
      "par2": 15,
      "par3": 25,
      "par4": 75
    },
    "synergyFormulas": {
      "damage": "(skill('Howl'.blvl)+skill('Shout'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Howl",
        "providerId": 130,
        "percentPerLevel": 10,
        "type": "damage"
      },
      {
        "providerName": "Shout",
        "providerId": 138,
        "percentPerLevel": 10,
        "type": "damage"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 144,
        "targetName": "Concentrate",
        "targetNameZh": "專心",
        "percentPerLevel": 1
      },
      {
        "targetId": 147,
        "targetName": "Frenzy",
        "targetNameZh": "狂亂",
        "percentPerLevel": 1
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "\"par4-min(((110*lvl)/(lvl+6)*(par4-par3)/100),(par4-par3))\""
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill39",
        "textbKey": "StrSkill23",
        "textaEn": "Magic Damage:",
        "textaZh": "魔法傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "clc1"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "powerful but reckless attack",
    "shortDescZh": "威力強大但攻擊鹵莽",
    "longDesc": "but decreases defense rating\nthat increases damage and attack rating\na powerful but reckless attack",
    "longDescZh": "但會降低防禦力\n增加傷害力和準確率\n威力強大但攻擊鹵莽",
    "icon": "/skills/icon_152.png",
    "iconActive": "/skills/icon_152_active.png",
    "toHit": 100,
    "toHitLev": 15,
    "auraLenCalc": "\"par4-min(((110*lvl)/(lvl+6)*(par4-par3)/100),(par4-par3))\"",
    "startmana": 0
  },
  {
    "id": 153,
    "name": "Natural Resistance",
    "nameZh": "自然抵抗",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 1,
    "tabName": "Combat Masteries",
    "tabNameZh": "战斗专家",
    "row": 6,
    "col": 3,
    "reqlevel": 30,
    "reqskills": [
      145
    ],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par2": 80
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill90",
        "textbKey": "StrSkill23",
        "textaEn": "Resistances:",
        "textaZh": "抵抗：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - increases natural resistances",
    "shortDescZh": "被動-增加自然的抵抗力",
    "longDesc": "to elemental and poison damage\npassive - increases natural resistances",
    "longDescZh": "降低毒素和元素系的傷害\n被動-增加自然的抵抗力",
    "icon": "/skills/icon_153.png",
    "iconActive": "/skills/icon_153_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 154,
    "name": "War Cry",
    "nameZh": "戰鬥狂嗥",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 2,
    "tabName": "Warcries",
    "tabNameZh": "呐喊",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      146,
      149
    ],
    "dependents": [],
    "mana": 10,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 20,
    "maxDam": 30,
    "minLevDam": [
      6,
      7,
      8,
      9,
      10
    ],
    "maxLevDam": [
      6,
      7,
      8,
      9,
      10
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 6,
      "par1": 25,
      "par2": 5
    },
    "synergyFormulas": {
      "physical": "(skill('Howl'.blvl)+skill('Taunt'.blvl)+skill('Battle Cry'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Howl",
        "providerId": 130,
        "percentPerLevel": 6,
        "type": "elemental"
      },
      {
        "providerName": "Taunt",
        "providerId": 137,
        "percentPerLevel": 6,
        "type": "elemental"
      },
      {
        "providerName": "Battle Cry",
        "providerId": 146,
        "percentPerLevel": 6,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 139,
        "targetName": "Stun",
        "targetNameZh": "擊昏",
        "percentPerLevel": 5
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill48",
        "textaEn": "Stun Length:",
        "textaZh": "昏迷時間：",
        "calca": "\"min(250,ln12)\""
      },
      {
        "lineType": 9
      },
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "injures and stuns nearby enemies",
    "shortDescZh": "讓附近的敵人受傷並昏眩",
    "longDesc": "injures and stuns all nearby enemies",
    "longDescZh": "讓附近的敵人受傷並昏眩",
    "icon": "/skills/icon_154.png",
    "iconActive": "/skills/icon_154_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 155,
    "name": "Battle Command",
    "nameZh": "戰鬥指揮",
    "classCode": "bar",
    "classNameZh": "野蛮人",
    "tabIndex": 2,
    "tabName": "Warcries",
    "tabNameZh": "呐喊",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      149
    ],
    "dependents": [],
    "mana": 11,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 125,
      "par1": 125,
      "par2": 250
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "len"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "increases skill levels",
    "shortDescZh": "增加技能等級",
    "longDesc": "increases all current skill levels for you and your party",
    "longDescZh": "增加你和你隊伍的技能等級",
    "icon": "/skills/icon_155.png",
    "iconActive": "/skills/icon_155_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln12+(skill('Shout'.blvl)+skill('Battle Orders'.blvl))*par8",
    "startmana": 0
  },
  {
    "id": 221,
    "name": "Raven",
    "nameZh": "乌鸦",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 0,
    "tabName": "Summoning",
    "tabNameZh": "召唤技能",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      227
    ],
    "mana": 6,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 2,
    "maxDam": 4,
    "minLevDam": [
      1,
      1,
      1,
      1,
      1
    ],
    "maxLevDam": [
      1,
      1,
      1,
      1,
      1
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 1,
      "par5": 12,
      "par1": -2,
      "par2": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 5,
        "textaKey": "ESkillHawk",
        "textaEn": "Ravens:",
        "textaZh": "乌鸦：",
        "calca": "\"min(lvl,par2)\""
      },
      {
        "lineType": 7,
        "textaKey": "StrSkill11",
        "textaEn": "hits",
        "textaZh": "擊中",
        "calca": "ln56"
      },
      {
        "lineType": 9
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "druidhawk",
      "minHP": 20,
      "maxHP": 32,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon ravens",
    "shortDescZh": "召唤乌鸦啄瞎敌人",
    "longDesc": "the eyes of your enemies\nsummon ravens to peck out",
    "longDescZh": "召唤乌鸦啄击敌人眼睛，降低其视野",
    "icon": "/skills/icon_221.png",
    "iconActive": "/skills/icon_221_active.png",
    "toHit": 100,
    "toHitLev": 15,
    "startmana": 0
  },
  {
    "id": 222,
    "name": "Poison Creeper",
    "nameZh": "毒藤",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 0,
    "tabName": "Summoning",
    "tabNameZh": "召唤技能",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      231
    ],
    "mana": 8,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 0,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "pois",
    "eMin": 12,
    "eMax": 16,
    "eMinLev": [
      7,
      12,
      15,
      17,
      19
    ],
    "eMaxLev": [
      7,
      12,
      15,
      17,
      19
    ],
    "eLen": 100,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 0,
      "par1": 3,
      "par2": 1,
      "par3": 25
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 238,
        "targetName": "Rabies",
        "targetNameZh": "狂犬病",
        "percentPerLevel": 18
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 14
      },
      {
        "lineType": 13,
        "calca": "(lvl-1)*par3"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "plaguepoppy",
      "minHP": 42,
      "maxHP": 58,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon disease spreading vine",
    "shortDescZh": "召唤毒藤在地下散播毒素",
    "longDesc": "disease to all it contacts\nsummon a vine that spreads",
    "longDescZh": "毒藤在地下穿行，让接触的敌人中毒",
    "icon": "/skills/icon_222.png",
    "iconActive": "/skills/icon_222_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 223,
    "name": "Werewolf",
    "nameZh": "狼人变化",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 1,
    "tabName": "Shape Shifting",
    "tabNameZh": "变形技能",
    "row": 1,
    "col": 1,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      224,
      232
    ],
    "mana": 15,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 25,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 0,
      "par1": 25,
      "par2": 25,
      "par3": 10,
      "par4": 80
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill106",
        "textbKey": "StrSkill23",
        "textaEn": "Attack Speed:",
        "textaZh": "準確率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill10",
        "textbKey": "StrSkill23",
        "textaEn": "To Attack Rating:",
        "textaZh": "變動準確率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "1000+skill('shape shifting'.ln12)"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill71",
        "textbKey": "StrSkill23",
        "textaEn": "Stamina Bonus:",
        "textaZh": "耐力加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "par1"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill42",
        "textbKey": "StrSkill23",
        "textaEn": "Life:",
        "textaZh": "生命：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "par2+skill('shape shifting'.ln34)"
      }
    ],
    "shortDesc": "transform into a werewolf",
    "shortDescZh": "变身为狼人形态",
    "longDesc": "transform into a werewolf",
    "longDescZh": "提升攻击速度、准确率和移动速度",
    "icon": "/skills/icon_223.png",
    "iconActive": "/skills/icon_223_active.png",
    "toHit": 50,
    "toHitLev": 15,
    "auraLenCalc": "1000+skill('Shape Shifting'.ln12)",
    "startmana": 0
  },
  {
    "id": 224,
    "name": "Lycanthropy",
    "nameZh": "变形术",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 1,
    "tabName": "Shape Shifting",
    "tabNameZh": "变形技能",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [
      223
    ],
    "dependents": [],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 0,
      "par1": 1000,
      "par2": 500,
      "par3": 20,
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 57,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill100",
        "textbKey": "StrSkill23",
        "textaEn": "Max Life:",
        "textaZh": "生命最大值：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - improves shape-shifting ability",
    "shortDescZh": "提升变身形态的生命与持续时间",
    "longDesc": "when in werewolf or werebear form\npassive - improves duration and life",
    "longDescZh": "被动提升狼人和熊人形态的最大生命值和变形持续时间",
    "icon": "/skills/icon_224.png",
    "iconActive": "/skills/icon_224_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 225,
    "name": "Firestorm",
    "nameZh": "火风暴",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 2,
    "tabName": "Elemental",
    "tabNameZh": "元素技能",
    "row": 1,
    "col": 1,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      229
    ],
    "mana": 4,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 15,
    "descdam": "9",
    "hitshift": 2,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 3,
    "eMax": 6,
    "eMinLev": [
      3,
      5,
      7,
      14,
      21
    ],
    "eMaxLev": [
      3,
      6,
      8,
      15,
      23
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 23,
      "par6": 0,
      "par5": 0,
      "par1": 3
    },
    "synergyFormulas": {
      "elemental": "(skill('Molten Boulder'.blvl)+skill('Eruption'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Molten Boulder",
        "providerId": 229,
        "percentPerLevel": 23,
        "type": "elemental"
      },
      {
        "providerName": "Eruption",
        "providerId": 234,
        "percentPerLevel": 23,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 229,
        "targetName": "Molten Boulder",
        "targetNameZh": "熔岩巨石",
        "percentPerLevel": 8
      },
      {
        "targetId": 234,
        "targetName": "Fissure",
        "targetNameZh": "裂地",
        "percentPerLevel": 12
      },
      {
        "targetId": 239,
        "targetName": "Fire Claws",
        "targetNameZh": "焰爪",
        "percentPerLevel": 22
      },
      {
        "targetId": 249,
        "targetName": "Armageddon",
        "targetNameZh": "末日浩劫",
        "percentPerLevel": 14
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 27
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "unleash fiery chaos",
    "shortDescZh": "向前方喷射混乱的地表烈火",
    "longDesc": "unleash fiery chaos to burn your enemies",
    "longDescZh": "在地面释放多道混乱游走的烈焰裂隙",
    "icon": "/skills/icon_225.png",
    "iconActive": "/skills/icon_225_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 226,
    "name": "Oak Sage",
    "nameZh": "橡木智者",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 0,
    "tabName": "Summoning",
    "tabNameZh": "召唤技能",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      236,
      237
    ],
    "mana": 15,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 2,
      "par7": 30,
      "par6": 0,
      "par5": 0,
      "par1": 30,
      "par2": 5,
      "par3": 250
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln78"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill42",
        "textbKey": "StrSkill23",
        "textaEn": "Life:",
        "textaZh": "生命：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      },
      {
        "lineType": 13,
        "calca": "(lvl-1)*par1"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "oaksage",
      "minHP": 56,
      "maxHP": 64,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon the spirit of the oak",
    "shortDescZh": "召唤提升全队最大生命值的自然之灵",
    "longDesc": "life for you and your party\nsummon a spirit pet that increases",
    "longDescZh": "光环增加附近所有队友的最大生命值",
    "icon": "/skills/icon_226.png",
    "iconActive": "/skills/icon_226_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 227,
    "name": "Summon Spirit Wolf",
    "nameZh": "召唤恶狼",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 0,
    "tabName": "Summoning",
    "tabNameZh": "召唤技能",
    "row": 2,
    "col": 2,
    "reqlevel": 6,
    "reqskills": [
      221
    ],
    "dependents": [
      237
    ],
    "mana": 15,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 2,
    "maxDam": 6,
    "minLevDam": [
      1,
      2,
      4,
      5,
      8
    ],
    "maxLevDam": [
      1,
      2,
      4,
      5,
      8
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par7": 0,
      "par6": 10,
      "par5": 50,
      "par1": 50,
      "par2": 25,
      "par3": 5,
      "par4": 7
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill21",
        "textbKey": "StrSkill23",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln56"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      },
      {
        "lineType": 5,
        "textaKey": "ESkillWolves",
        "textaEn": "Wolves:",
        "textaZh": "狼：",
        "calca": "\"min(lvl,par3)\""
      },
      {
        "lineType": 9,
        "calca": "skill('Summon Grizzly'.ln12)"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 13,
        "calca": "(skill('summon fenris'.lvl) > 0) ? skill('summon fenris'.ln12) : 0"
      }
    ],
    "minionStats": {
      "code": "spiritwolf",
      "minHP": 60,
      "maxHP": 82,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon a wolf",
    "shortDescZh": "召唤恶狼协助战斗",
    "longDesc": "to fight by your side\nsummon a wolf with teleporting ability",
    "longDescZh": "召唤狼群撕咬敌人，提升自身命中",
    "icon": "/skills/icon_227.png",
    "iconActive": "/skills/icon_227_active.png",
    "toHit": 75,
    "toHitLev": 20,
    "startmana": 0
  },
  {
    "id": 228,
    "name": "Werebear",
    "nameZh": "熊人变化",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 1,
    "tabName": "Shape Shifting",
    "tabNameZh": "变形技能",
    "row": 2,
    "col": 3,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      233
    ],
    "mana": 15,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 25,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par5": 50,
      "par1": 50,
      "par2": 8,
      "par3": 25,
      "par4": 6
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill21",
        "textbKey": "StrSkill23",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "1000+skill('shape shifting'.ln12)"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill42",
        "textbKey": "StrSkill23",
        "textaEn": "Life:",
        "textaZh": "生命：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "par5 + skill('Shape Shifting'.ln34)"
      }
    ],
    "shortDesc": "transform into a werebear",
    "shortDescZh": "变身为巨熊形态",
    "longDesc": "transform into a werebear",
    "longDescZh": "大幅提升防御力、生命值和打击力量",
    "icon": "/skills/icon_228.png",
    "iconActive": "/skills/icon_228_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "1000+skill('Shape Shifting'.ln12)",
    "startmana": 0
  },
  {
    "id": 229,
    "name": "Molten Boulder",
    "nameZh": "熔岩巨石",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 2,
    "tabName": "Elemental",
    "tabNameZh": "元素技能",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [
      225
    ],
    "dependents": [
      234
    ],
    "mana": 20,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 50,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 6,
    "maxDam": 12,
    "minLevDam": [
      4,
      7,
      10,
      13,
      16
    ],
    "maxLevDam": [
      5,
      8,
      11,
      14,
      17
    ],
    "eType": "fire",
    "eMin": 6,
    "eMax": 12,
    "eMinLev": [
      4,
      7,
      10,
      13,
      16
    ],
    "eMaxLev": [
      5,
      8,
      11,
      14,
      17
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 8,
      "par7": 10,
      "par1": 7
    },
    "synergyFormulas": {
      "physical": "skill('Volcano'.blvl)*par7",
      "elemental": "skill('Firestorm'.blvl)*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Firestorm",
        "providerId": 225,
        "percentPerLevel": 8,
        "type": "elemental"
      },
      {
        "providerName": "Volcano",
        "providerId": 244,
        "percentPerLevel": 10,
        "type": "damage"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 225,
        "targetName": "Firestorm",
        "targetNameZh": "火风暴",
        "percentPerLevel": 23
      },
      {
        "targetId": 239,
        "targetName": "Fire Claws",
        "targetNameZh": "焰爪",
        "percentPerLevel": 22
      },
      {
        "targetId": 244,
        "targetName": "Volcano",
        "targetNameZh": "火山",
        "percentPerLevel": 12
      },
      {
        "targetId": 249,
        "targetName": "Armageddon",
        "targetNameZh": "末日浩劫",
        "percentPerLevel": 14
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 22
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "launch a molten boulder",
    "shortDescZh": "发射滚动的熔岩火球击退敌人",
    "longDesc": "that knocks back your enemies\nlaunch a boulder of flaming hot magma",
    "longDescZh": "火石沿直线滚向敌人，造成物理和火焰双重爆炸伤害",
    "icon": "/skills/icon_229.png",
    "iconActive": "/skills/icon_229_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 230,
    "name": "Arctic Blast",
    "nameZh": "极地风暴",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 2,
    "tabName": "Elemental",
    "tabNameZh": "元素技能",
    "row": 2,
    "col": 3,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      235
    ],
    "mana": 24,
    "lvlmana": 1,
    "minmana": 0,
    "manashift": 2,
    "delay": 0,
    "descdam": "8",
    "hitshift": 2,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 21,
    "eMax": 40,
    "eMinLev": [
      16,
      18,
      20,
      24,
      29
    ],
    "eMaxLev": [
      16,
      19,
      21,
      25,
      31
    ],
    "eLen": 100,
    "eLevLen": [
      15,
      15,
      15
    ],
    "params": {
      "par8": 15,
      "par1": 35,
      "par2": 2,
      "par3": 4
    },
    "synergyFormulas": {
      "elemental": "(skill('Cyclone Armor'.blvl)+skill('Hurricane'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Cyclone Armor",
        "providerId": 235,
        "percentPerLevel": 15,
        "type": "elemental"
      },
      {
        "providerName": "Hurricane",
        "providerId": 250,
        "percentPerLevel": 15,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill3",
        "textbKey": "StrSkill34",
        "textaEn": "Mana Cost:",
        "textaZh": "法力耗費：",
        "textbEn": "per second",
        "textbZh": "每秒",
        "calca": "mps"
      },
      {
        "lineType": 19,
        "textaKey": "StrSkill56",
        "textaEn": "Range:",
        "textaZh": "射程",
        "calca": "ln12/4"
      },
      {
        "lineType": 11
      },
      {
        "lineType": 26
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 5,
        "textaKey": "StrSkill115",
        "textaEn": "Minimum Mana Required to Cast:",
        "textaZh": "施展法術至少須要法力點數為：",
        "calca": "par3"
      }
    ],
    "shortDesc": "shoot a jet of ice",
    "shortDescZh": "引导一道连续的严寒冻气",
    "longDesc": "to burn your enemies with frost\nblast a continuous jet of ice",
    "longDescZh": "持续喷射极地寒冰冻结并减速前方敌人",
    "icon": "/skills/icon_230.png",
    "iconActive": "/skills/icon_230_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 6
  },
  {
    "id": 231,
    "name": "Carrion Vine",
    "nameZh": "食尸藤",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 0,
    "tabName": "Summoning",
    "tabNameZh": "召唤技能",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      222
    ],
    "dependents": [
      241
    ],
    "mana": 10,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 12,
      "par5": 3,
      "par1": 10,
      "par3": 25
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill50",
        "textbKey": "StrSkill23",
        "textaEn": "Heals:",
        "textaZh": "治療：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm56"
      },
      {
        "lineType": 13,
        "calca": "(lvl-1)*par3"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "cycleoflife",
      "minHP": 80,
      "maxHP": 110,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon corpse eating vine",
    "shortDescZh": "召唤食尸藤吞噬尸体回复生命",
    "longDesc": "and replenishes your life\nsummon a vine that eats corpses",
    "longDescZh": "在地下吞噬倒下的怪物尸体，为德鲁伊回复生命",
    "icon": "/skills/icon_231.png",
    "iconActive": "/skills/icon_231_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 232,
    "name": "Feral Rage",
    "nameZh": "野性狂暴",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 1,
    "tabName": "Shape Shifting",
    "tabNameZh": "变形技能",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [
      223
    ],
    "dependents": [
      238,
      239
    ],
    "mana": 3,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 3,
      "par7": 2,
      "par6": 5,
      "par5": 50,
      "par1": 500,
      "par2": 4,
      "par3": 10,
      "par4": 70
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln56"
      },
      {
        "lineType": 52,
        "textaKey": "EskillLifeSteal",
        "textbKey": "StrSkill23",
        "textaEn": "Life Steal:",
        "textaZh": "生命偷取：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "4",
        "calcb": "par2 * lvl + 8"
      },
      {
        "lineType": 52,
        "textaKey": "StrSkill89",
        "textbKey": "StrSkill23",
        "textaEn": "Walk/Run Speed:",
        "textaZh": "行走/跑步速度：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "19",
        "calcb": "((110*(par8+lvl/par7)) * (par4-par3))/(100 * ((par8+lvl/par7)+6)) + par3"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "par1"
      }
    ],
    "shortDesc": "life-stealing rage attack - werewolf form",
    "shortDescZh": "狼人撕咬敌人进入狂暴状态，连续攻击偷取生命并提升移动速度",
    "longDesc": "with successive hits\nincreasing amounts of life from your enemies\ngo into a frenzied rage to steal\nwhen in werewolf form,",
    "longDescZh": "连续撕咬敌人使自身进入狂暴，逐渐增加每次攻击的生命偷取与步行/跑步速度",
    "icon": "/skills/icon_232.png",
    "iconActive": "/skills/icon_232_active.png",
    "toHit": 20,
    "toHitLev": 10,
    "auraLenCalc": "par1",
    "startmana": 0
  },
  {
    "id": 233,
    "name": "Maul",
    "nameZh": "撞击",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 1,
    "tabName": "Shape Shifting",
    "tabNameZh": "变形技能",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      228
    ],
    "dependents": [
      239,
      243
    ],
    "mana": 3,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "1",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 3,
      "par7": 2,
      "par6": 100,
      "par5": 10,
      "par3": 20,
      "par4": 500
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 243,
        "targetName": "Shock Wave",
        "targetNameZh": "震波",
        "percentPerLevel": 5
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 52,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "par3",
        "calcb": "par3 * (lvl/par7+par8)"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill48",
        "textaEn": "Stun Length:",
        "textaZh": "昏迷時間：",
        "calca": "dm56"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "par4"
      }
    ],
    "shortDesc": "maul your enemies - werebear form",
    "shortDescZh": "熊人连续猛击敌人，逐渐累积额外伤害并震晕目标",
    "longDesc": "with successive hits\nfor increasing extra damage\nmaul your enemies\nwhen in werebear form,",
    "longDescZh": "熊人重击目标，每次命中都会叠加更高的伤害加成并延长眩晕时间",
    "icon": "/skills/icon_233.png",
    "iconActive": "/skills/icon_233_active.png",
    "toHit": 20,
    "toHitLev": 10,
    "auraLenCalc": "par4",
    "startmana": 0
  },
  {
    "id": 234,
    "name": "Fissure",
    "nameZh": "裂地",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 2,
    "tabName": "Elemental",
    "tabNameZh": "元素技能",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [
      229
    ],
    "dependents": [
      244
    ],
    "mana": 15,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 50,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 15,
    "eMax": 25,
    "eMinLev": [
      6,
      12,
      16,
      18,
      22
    ],
    "eMaxLev": [
      6,
      12,
      16,
      19,
      23
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 12,
      "par1": 7,
      "par2": 6
    },
    "synergyFormulas": {
      "elemental": "(skill('Firestorm'.blvl)+skill('Volcano'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Firestorm",
        "providerId": 225,
        "percentPerLevel": 12,
        "type": "elemental"
      },
      {
        "providerName": "Volcano",
        "providerId": 244,
        "percentPerLevel": 12,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 225,
        "targetName": "Firestorm",
        "targetNameZh": "火风暴",
        "percentPerLevel": 23
      },
      {
        "targetId": 239,
        "targetName": "Fire Claws",
        "targetNameZh": "焰爪",
        "percentPerLevel": 22
      },
      {
        "targetId": 244,
        "targetName": "Volcano",
        "targetNameZh": "火山",
        "percentPerLevel": 12
      },
      {
        "targetId": 249,
        "targetName": "Armageddon",
        "targetNameZh": "末日浩劫",
        "percentPerLevel": 2
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 23,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續："
      },
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "open the earth to burn enemies",
    "shortDescZh": "撕裂大地喷发地热蒸汽与熔火",
    "longDesc": "burning them to a crisp\nopen volcanic vents below your enemies,",
    "longDescZh": "在地面裂隙中喷发出炽热地火",
    "icon": "/skills/icon_234.png",
    "iconActive": "/skills/icon_234_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 235,
    "name": "Cyclone Armor",
    "nameZh": "旋风甲",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 2,
    "tabName": "Elemental",
    "tabNameZh": "元素技能",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      230
    ],
    "dependents": [
      240
    ],
    "mana": 5,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 7,
      "par1": 40,
      "par2": 12
    },
    "synergyFormulas": {},
    "synergiesReceived": [
      {
        "providerName": "Twister",
        "providerId": 240,
        "percentPerLevel": 7,
        "type": "defense"
      },
      {
        "providerName": "Tornado",
        "providerId": 245,
        "percentPerLevel": 7,
        "type": "defense"
      },
      {
        "providerName": "Hurricane",
        "providerId": 250,
        "percentPerLevel": 7,
        "type": "defense"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 230,
        "targetName": "Arctic Blast",
        "targetNameZh": "极地风暴",
        "percentPerLevel": 15
      },
      {
        "targetId": 245,
        "targetName": "Tornado",
        "targetNameZh": "龙卷风",
        "percentPerLevel": 9
      },
      {
        "targetId": 250,
        "targetName": "Hurricane",
        "targetNameZh": "暴风",
        "percentPerLevel": 2
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill40",
        "textbKey": "StrSkill41",
        "textaEn": "Absorbs",
        "textaZh": "吸收",
        "textbEn": "damage",
        "textbZh": "傷害",
        "calca": "(ln12*(100+(skill('Twister'.blvl)+skill('Tornado'.blvl)+skill('Hurricane'.blvl))*par8)/100)"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "shield from elemental damage",
    "shortDescZh": "召唤环绕身躯的旋风护盾吸收元素伤害",
    "longDesc": "fire, cold, and lightning\nshield yourself from damage caused by",
    "longDescZh": "吸收即将到来的火焰、冰冷和闪电元素伤害",
    "icon": "/skills/icon_235.png",
    "iconActive": "/skills/icon_235_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 236,
    "name": "Heart of Wolverine",
    "nameZh": "狼獾之心",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 0,
    "tabName": "Summoning",
    "tabNameZh": "召唤技能",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      226
    ],
    "dependents": [
      246
    ],
    "mana": 20,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 2,
      "par7": 30,
      "par6": 7,
      "par5": 20,
      "par1": 25,
      "par2": 3,
      "par3": 25,
      "par4": 7
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln78"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln56"
      },
      {
        "lineType": 13,
        "calca": "(lvl-1)*par1"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "heartofwolverine",
      "minHP": 128,
      "maxHP": 144,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon a wolverine spirit",
    "shortDescZh": "召唤提升全队物理伤害与准确率的灵体",
    "longDesc": "of you and your party\nto the damage and attack rating\nsummon a spirit pet that adds",
    "longDescZh": "狼獾图腾提升周围所有同伴的物理伤害与攻击命中",
    "icon": "/skills/icon_236.png",
    "iconActive": "/skills/icon_236_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 237,
    "name": "Summon Dire Wolf",
    "nameZh": "召唤狂狼",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 0,
    "tabName": "Summoning",
    "tabNameZh": "召唤技能",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      226,
      227
    ],
    "dependents": [
      247
    ],
    "mana": 20,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 7,
    "maxDam": 12,
    "minLevDam": [
      2,
      3,
      6,
      8,
      11
    ],
    "maxLevDam": [
      2,
      3,
      6,
      9,
      13
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par7": 0,
      "par6": 4,
      "par5": 100,
      "par1": 50,
      "par2": 25,
      "par3": 3,
      "par4": 500
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill42",
        "textbKey": "StrSkill23",
        "textaEn": "Life:",
        "textaZh": "生命：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      },
      {
        "lineType": 5,
        "textaKey": "ESkillWolves",
        "textaEn": "Wolves:",
        "textaZh": "狼：",
        "calca": "\"min(lvl,par3)\""
      },
      {
        "lineType": 9,
        "calca": "skill('Summon Grizzly'.ln12)"
      },
      {
        "lineType": 13,
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill21",
        "textbKey": "StrSkill23",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "skill('Summon Spirit Wolf'.ln56)"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "skill('Summon Spirit Wolf'.ln12)"
      }
    ],
    "minionStats": {
      "code": "fenris",
      "minHP": 98,
      "maxHP": 130,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon an enraged wolf",
    "shortDescZh": "召唤更加凶残狂暴的狂狼",
    "longDesc": "it does to enemies\neating corpses to increase damage\nsummon a wolf that becomes enraged,",
    "longDescZh": "狂狼可以吃下死者尸体进入狂乱嗜血状态",
    "icon": "/skills/icon_237.png",
    "iconActive": "/skills/icon_237_active.png",
    "toHit": 150,
    "toHitLev": 20,
    "startmana": 0
  },
  {
    "id": 238,
    "name": "Rabies",
    "nameZh": "狂犬病",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 1,
    "tabName": "Shape Shifting",
    "tabNameZh": "变形技能",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      232
    ],
    "dependents": [
      248
    ],
    "mana": 10,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "23",
    "hitshift": 3,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "pois",
    "eMin": 6,
    "eMax": 14,
    "eMinLev": [
      4,
      5,
      7,
      11,
      16
    ],
    "eMaxLev": [
      4,
      5,
      7,
      11,
      16
    ],
    "eLen": 100,
    "eLevLen": [
      10,
      10,
      10
    ],
    "params": {
      "par8": 18
    },
    "synergyFormulas": {
      "elemental": "(skill('Plague Poppy'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Plague Poppy",
        "providerId": 222,
        "percentPerLevel": 18,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 14
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "bite causes disease - werewolf form",
    "shortDescZh": "狼人撕咬敌人传播剧毒传染病",
    "longDesc": "that spreads to other monsters\nto inflict them with disease\nbite your enemies\nwhen in werewolf form,",
    "longDescZh": "撕咬使目标感染狂犬病毒，毒素会快速传染给周围怪物",
    "icon": "/skills/icon_238.png",
    "iconActive": "/skills/icon_238_active.png",
    "toHit": 50,
    "toHitLev": 7,
    "startmana": 0
  },
  {
    "id": 239,
    "name": "Fire Claws",
    "nameZh": "焰爪",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 1,
    "tabName": "Shape Shifting",
    "tabNameZh": "变形技能",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      232,
      233
    ],
    "dependents": [
      242
    ],
    "mana": 4,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 15,
    "eMax": 20,
    "eMinLev": [
      8,
      12,
      20,
      24,
      30
    ],
    "eMaxLev": [
      8,
      12,
      22,
      26,
      34
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 22
    },
    "synergyFormulas": {
      "elemental": "(skill('Firestorm'.blvl)+skill('Molten Boulder'.blvl)+skill('Volcano'.blvl)+skill('Eruption'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Firestorm",
        "providerId": 225,
        "percentPerLevel": 22,
        "type": "elemental"
      },
      {
        "providerName": "Molten Boulder",
        "providerId": 229,
        "percentPerLevel": 22,
        "type": "elemental"
      },
      {
        "providerName": "Volcano",
        "providerId": 244,
        "percentPerLevel": 22,
        "type": "elemental"
      },
      {
        "providerName": "Eruption",
        "providerId": 234,
        "percentPerLevel": 22,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "fiery, mauling attack",
    "shortDescZh": "在狼人或熊人形态下挥出烈焰利爪攻击敌人",
    "longDesc": "with a fiery claw attack\nform, maul your enemies\nwhen in werewolf or werebear",
    "longDescZh": "将烈焰附着于利爪之上，每次攻击造成高额火焰伤害并提高命中率",
    "icon": "/skills/icon_239.png",
    "iconActive": "/skills/icon_239_active.png",
    "toHit": 50,
    "toHitLev": 15,
    "startmana": 0
  },
  {
    "id": 240,
    "name": "Twister",
    "nameZh": "小旋风",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 2,
    "tabName": "Elemental",
    "tabNameZh": "元素技能",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      235
    ],
    "dependents": [
      245
    ],
    "mana": 7,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 12,
    "maxDam": 16,
    "minLevDam": [
      4,
      7,
      10,
      13,
      16
    ],
    "maxLevDam": [
      4,
      7,
      11,
      14,
      17
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 10,
      "par1": 3,
      "par2": 10
    },
    "synergyFormulas": {
      "physical": "(skill('Tornado'.blvl)+skill('Hurricane'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Tornado",
        "providerId": 245,
        "percentPerLevel": 10,
        "type": "damage"
      },
      {
        "providerName": "Hurricane",
        "providerId": 250,
        "percentPerLevel": 10,
        "type": "damage"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 235,
        "targetName": "Cyclone Armor",
        "targetNameZh": "旋风甲",
        "percentPerLevel": 7
      },
      {
        "targetId": 245,
        "targetName": "Tornado",
        "targetNameZh": "龙卷风",
        "percentPerLevel": 9
      },
      {
        "targetId": 250,
        "targetName": "Hurricane",
        "targetNameZh": "暴风",
        "percentPerLevel": 9
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 9
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill48",
        "textaEn": "Stun Length:",
        "textaZh": "昏迷時間：",
        "calca": "par2"
      }
    ],
    "shortDesc": "release several small whirlwinds",
    "shortDescZh": "释放多道不可预测的毁灭龙卷风",
    "longDesc": "cut a path through your enemies\nrelease several small whirlwinds that",
    "longDescZh": "向前方释放穿透撕裂敌人的强力物理龙卷风",
    "icon": "/skills/icon_240.png",
    "iconActive": "/skills/icon_240_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 241,
    "name": "Solar Creeper",
    "nameZh": "太阳藤",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 0,
    "tabName": "Summoning",
    "tabNameZh": "召唤技能",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      231
    ],
    "dependents": [],
    "mana": 14,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 8,
      "par5": 1,
      "par1": 3,
      "par2": 1,
      "par3": 20
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill88",
        "textbKey": "StrSkill23",
        "textaEn": "Mana Recovery Rate:",
        "textaZh": "法力回復比率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm56"
      },
      {
        "lineType": 13,
        "calca": "(lvl-1)*par3"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "vinecreature",
      "minHP": 138,
      "maxHP": 192,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon corpse eating vine",
    "shortDescZh": "召唤太阳藤吞噬尸体回复法力",
    "longDesc": "and replenishes your mana\nsummon a vine that eats corpses",
    "longDescZh": "在地下吞噬倒下的怪物尸体，为德鲁伊回复法力",
    "icon": "/skills/icon_241.png",
    "iconActive": "/skills/icon_241_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 242,
    "name": "Hunger",
    "nameZh": "饥饿",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 1,
    "tabName": "Shape Shifting",
    "tabNameZh": "变形技能",
    "row": 5,
    "col": 2,
    "reqlevel": 24,
    "reqskills": [
      239
    ],
    "dependents": [],
    "mana": 3,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "14",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par5": -75,
      "par1": 50,
      "par2": 200,
      "par3": 50,
      "par4": 200
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 3,
        "textaKey": "EskillManaSteal",
        "textbKey": "StrSkill23",
        "textaEn": "Mana Steal:",
        "textaZh": "法力偷取：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      },
      {
        "lineType": 3,
        "textaKey": "EskillLifeSteal",
        "textbKey": "StrSkill23",
        "textaEn": "Life Steal:",
        "textaZh": "生命偷取：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "par5"
      }
    ],
    "shortDesc": "life-and-mana-stealing bite",
    "shortDescZh": "撕咬敌人偷取大量生命与法力，但降低造成的物理伤害",
    "longDesc": "to gain life and mana\nform, bite your enemies\nwhen in werewolf or werebear",
    "longDescZh": "以凶猛的噬咬吸取目标的生命值与法力值，但单次攻击伤害降低 75%",
    "icon": "/skills/icon_242.png",
    "iconActive": "/skills/icon_242_active.png",
    "toHit": 50,
    "toHitLev": 10,
    "startmana": 0
  },
  {
    "id": 243,
    "name": "Shock Wave",
    "nameZh": "震波",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 1,
    "tabName": "Shape Shifting",
    "tabNameZh": "变形技能",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      233
    ],
    "dependents": [],
    "mana": 7,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 10,
    "maxDam": 20,
    "minLevDam": [
      3,
      5,
      7,
      7,
      7
    ],
    "maxLevDam": [
      3,
      5,
      7,
      7,
      7
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par1": 40,
      "par2": 15
    },
    "synergyFormulas": {
      "physical": "skill('Maul'.blvl)*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Maul",
        "providerId": 233,
        "percentPerLevel": 5,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill48",
        "textaEn": "Stun Length:",
        "textaZh": "昏迷時間：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "create shock waves - werebear form",
    "shortDescZh": "熊人咆哮震出大范围冲击波击晕敌人",
    "longDesc": "that stuns nearby enemies\nstomp to create a shock wave\nwhen in werebear form,",
    "longDescZh": "熊吼发出锥形震波，大范围击晕所有前方敌人",
    "icon": "/skills/icon_243.png",
    "iconActive": "/skills/icon_243_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 244,
    "name": "Volcano",
    "nameZh": "火山",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 2,
    "tabName": "Elemental",
    "tabNameZh": "元素技能",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      234
    ],
    "dependents": [
      249
    ],
    "mana": 25,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 100,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 8,
    "maxDam": 10,
    "minLevDam": [
      2,
      4,
      6,
      8,
      10
    ],
    "maxLevDam": [
      2,
      4,
      6,
      8,
      10
    ],
    "eType": "fire",
    "eMin": 8,
    "eMax": 10,
    "eMinLev": [
      2,
      4,
      6,
      8,
      11
    ],
    "eMaxLev": [
      2,
      4,
      6,
      8,
      13
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 12,
      "par7": 12,
      "par1": 12,
      "par2": 2
    },
    "synergyFormulas": {
      "physical": "skill('Molten Boulder'.blvl)*par7",
      "elemental": "(skill('Eruption'.blvl)+skill('Armageddon'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Eruption",
        "providerId": 234,
        "percentPerLevel": 12,
        "type": "elemental"
      },
      {
        "providerName": "Armageddon",
        "providerId": 249,
        "percentPerLevel": 12,
        "type": "elemental"
      },
      {
        "providerName": "Molten Boulder",
        "providerId": 229,
        "percentPerLevel": 12,
        "type": "damage"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 229,
        "targetName": "Molten Boulder",
        "targetNameZh": "熔岩巨石",
        "percentPerLevel": 10
      },
      {
        "targetId": 234,
        "targetName": "Fissure",
        "targetNameZh": "裂地",
        "percentPerLevel": 12
      },
      {
        "targetId": 239,
        "targetName": "Fire Claws",
        "targetNameZh": "焰爪",
        "percentPerLevel": 22
      },
      {
        "targetId": 249,
        "targetName": "Armageddon",
        "targetNameZh": "末日浩劫",
        "percentPerLevel": 14
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "create a volcano",
    "shortDescZh": "在地面引发微型火山喷发火球",
    "longDesc": "and destruction over your enemies\nsummon forth a volcano to rain death",
    "longDescZh": "在指定位置升起火山，持续喷吐炽热石块砸向周围敌人",
    "icon": "/skills/icon_244.png",
    "iconActive": "/skills/icon_244_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 245,
    "name": "Tornado",
    "nameZh": "龙卷风",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 2,
    "tabName": "Elemental",
    "tabNameZh": "元素技能",
    "row": 5,
    "col": 2,
    "reqlevel": 24,
    "reqskills": [
      240
    ],
    "dependents": [
      250
    ],
    "mana": 10,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 25,
    "maxDam": 35,
    "minLevDam": [
      8,
      14,
      20,
      24,
      28
    ],
    "maxLevDam": [
      8,
      15,
      21,
      25,
      29
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 9,
      "par1": 15,
      "par2": 3
    },
    "synergyFormulas": {
      "physical": "(skill('Cyclone Armor'.blvl)+skill('Twister'.blvl)+skill('Hurricane'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Cyclone Armor",
        "providerId": 235,
        "percentPerLevel": 9,
        "type": "damage"
      },
      {
        "providerName": "Twister",
        "providerId": 240,
        "percentPerLevel": 9,
        "type": "damage"
      },
      {
        "providerName": "Hurricane",
        "providerId": 250,
        "percentPerLevel": 9,
        "type": "damage"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 235,
        "targetName": "Cyclone Armor",
        "targetNameZh": "旋风甲",
        "percentPerLevel": 7
      },
      {
        "targetId": 240,
        "targetName": "Twister",
        "targetNameZh": "小旋风",
        "percentPerLevel": 10
      },
      {
        "targetId": 250,
        "targetName": "Hurricane",
        "targetNameZh": "暴风",
        "percentPerLevel": 9
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      },
      {
        "lineType": 8
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "create a tornado",
    "shortDescZh": "释放一道呼啸的龙卷风撕裂沿途敌人",
    "longDesc": "to blast your enemies\ncreate a funnel of wind and debris",
    "longDescZh": "召唤一道急速旋转的龙卷风向前推进，对路径上的敌人造成物理伤害",
    "icon": "/skills/icon_245.png",
    "iconActive": "/skills/icon_245_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 246,
    "name": "Spirit of Barbs",
    "nameZh": "灵之守护",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 0,
    "tabName": "Summoning",
    "tabNameZh": "召唤技能",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      236
    ],
    "dependents": [],
    "mana": 25,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 2,
      "par7": 30,
      "par1": 25,
      "par3": 50,
      "par4": 20
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "ln78"
      },
      {
        "lineType": 7,
        "textaKey": "StrSkill55",
        "textaEn": "percent damage returned",
        "textaZh": "%的傷害會回彈",
        "calca": "ln34"
      },
      {
        "lineType": 13,
        "calca": "(lvl-1)*par1"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "spiritofbarbs",
      "minHP": 200,
      "maxHP": 226,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon a spirit pet of thorns",
    "shortDescZh": "召唤带有荆棘反伤效果的自然之灵",
    "longDesc": "back at your enemies\ntaken by you and your party\nsummon spirit pet that reflects damage",
    "longDescZh": "反弹受到的物理伤害给近战攻击者",
    "icon": "/skills/icon_246.png",
    "iconActive": "/skills/icon_246_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 247,
    "name": "Summon Grizzly",
    "nameZh": "召唤灰熊",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 0,
    "tabName": "Summoning",
    "tabNameZh": "召唤技能",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      237
    ],
    "dependents": [],
    "mana": 40,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 30,
    "maxDam": 60,
    "minLevDam": [
      10,
      15,
      20,
      26,
      30
    ],
    "maxLevDam": [
      10,
      15,
      20,
      26,
      30
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 5,
      "par7": 0,
      "par1": 25,
      "par2": 10
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      },
      {
        "lineType": 9,
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill21",
        "textbKey": "StrSkill23",
        "textaEn": "Defense:",
        "textaZh": "防禦：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "skill('Summon Spirit Wolf'.ln56)"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "skill('Summon Spirit Wolf'.ln12)"
      },
      {
        "lineType": 13,
        "calca": "skill('summon fenris'.ln12)"
      }
    ],
    "minionStats": {
      "code": "druidbear",
      "minHP": 550,
      "maxHP": 750,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon a grizzly bear",
    "shortDescZh": "召唤威猛无比的森林灰熊",
    "longDesc": "summon a ferocious grizzly bear",
    "longDescZh": "召唤强大的巨熊，具备极高的生命值与重击压制力",
    "icon": "/skills/icon_247.png",
    "iconActive": "/skills/icon_247_active.png",
    "toHit": 300,
    "toHitLev": 20,
    "startmana": 0
  },
  {
    "id": 248,
    "name": "Fury",
    "nameZh": "狂怒",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 1,
    "tabName": "Shape Shifting",
    "tabNameZh": "变形技能",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      238
    ],
    "dependents": [],
    "mana": 4,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "7",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 5,
      "par5": 2,
      "par2": 100,
      "par3": 100,
      "par4": 17
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln34"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill30",
        "textbKey": "StrSkill23",
        "textaEn": "Attack Bonus:",
        "textaZh": "攻擊加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 7,
        "textaKey": "StrSkill11",
        "textaEn": "hits",
        "textaZh": "擊中",
        "calca": "\"min((par5+lvl-1),par6)\""
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "multiple attacks - werewolf Form",
    "shortDescZh": "狼人狂暴撕咬",
    "longDesc": "or one target multiple times\neither multiple adjacent targets\nwhen in werewolf form, attack",
    "longDescZh": "连续撕咬目标",
    "icon": "/skills/icon_248.png",
    "iconActive": "/skills/icon_248_active.png",
    "toHit": 50,
    "toHitLev": 7,
    "startmana": 0
  },
  {
    "id": 249,
    "name": "Armageddon",
    "nameZh": "末日浩劫",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 2,
    "tabName": "Elemental",
    "tabNameZh": "元素技能",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      244,
      250
    ],
    "dependents": [],
    "mana": 35,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 150,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 4,
    "maxDam": 16,
    "minLevDam": [
      4,
      6,
      8,
      10,
      12
    ],
    "maxLevDam": [
      4,
      7,
      9,
      12,
      14
    ],
    "eType": "fire",
    "eMin": 25,
    "eMax": 75,
    "eMinLev": [
      15,
      20,
      25,
      31,
      38
    ],
    "eMaxLev": [
      16,
      22,
      27,
      34,
      40
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 14,
      "par7": 50,
      "par1": 250,
      "par3": 8,
      "par4": 8
    },
    "synergyFormulas": {
      "elemental": "(skill('Firestorm'.blvl)+skill('Molten Boulder'.blvl)+skill('Volcano'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Eruption",
        "providerId": 234,
        "percentPerLevel": 2,
        "type": "duration"
      },
      {
        "providerName": "Firestorm",
        "providerId": 225,
        "percentPerLevel": 14,
        "type": "elemental"
      },
      {
        "providerName": "Molten Boulder",
        "providerId": 229,
        "percentPerLevel": 14,
        "type": "elemental"
      },
      {
        "providerName": "Volcano",
        "providerId": 244,
        "percentPerLevel": 14,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 244,
        "targetName": "Volcano",
        "targetNameZh": "火山",
        "percentPerLevel": 12
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 22
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "par3"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12 + skill('Eruption'.blvl) * par7"
      }
    ],
    "shortDesc": "rain fire on your enemies",
    "shortDescZh": "召唤毁天灭地的烈焰流星雨，持续轰炸身周敌人造成火焰与物理伤害",
    "longDesc": "destruction on nearby enemies\ncreate a meteor shower to rain fiery",
    "longDescZh": "在德鲁伊身周降下持续的烈焰流星雨，对大范围内的敌人造成巨额火焰与物理伤害",
    "icon": "/skills/icon_249.png",
    "iconActive": "/skills/icon_249_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln12 + skill('Eruption'.blvl) * par7",
    "startmana": 0
  },
  {
    "id": 250,
    "name": "Hurricane",
    "nameZh": "暴风",
    "classCode": "dru",
    "classNameZh": "德鲁伊",
    "tabIndex": 2,
    "tabName": "Elemental",
    "tabNameZh": "元素技能",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      245
    ],
    "dependents": [
      249
    ],
    "mana": 30,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 150,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 25,
    "eMax": 50,
    "eMinLev": [
      7,
      10,
      12,
      14,
      16
    ],
    "eMaxLev": [
      7,
      10,
      12,
      14,
      16
    ],
    "eLen": 50,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 9,
      "par7": 50,
      "par1": 250,
      "par3": 9,
      "par4": 20
    },
    "synergyFormulas": {
      "elemental": "(skill('Twister'.blvl)+skill('Tornado'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Cyclone Armor",
        "providerId": 235,
        "percentPerLevel": 2,
        "type": "duration"
      },
      {
        "providerName": "Twister",
        "providerId": 240,
        "percentPerLevel": 9,
        "type": "elemental"
      },
      {
        "providerName": "Tornado",
        "providerId": 245,
        "percentPerLevel": 9,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 230,
        "targetName": "Arctic Blast",
        "targetNameZh": "极地风暴",
        "percentPerLevel": 15
      },
      {
        "targetId": 235,
        "targetName": "Cyclone Armor",
        "targetNameZh": "旋风甲",
        "percentPerLevel": 7
      },
      {
        "targetId": 240,
        "targetName": "Twister",
        "targetNameZh": "小旋风",
        "percentPerLevel": 10
      },
      {
        "targetId": 245,
        "targetName": "Tornado",
        "targetNameZh": "龙卷风",
        "percentPerLevel": 9
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "par3"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12 + skill('Cyclone Armor'.blvl) * par7"
      }
    ],
    "shortDesc": "create a massive wind storm",
    "shortDescZh": "在身周召唤严寒暴风席卷敌人",
    "longDesc": "debris to pound your enemies to bits\ncreate a massive storm of wind and",
    "longDescZh": "环绕德鲁伊旋转的极寒风暴，持续对近身敌人造成冰冷伤害并使其减速",
    "icon": "/skills/icon_250.png",
    "iconActive": "/skills/icon_250_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln12 + skill('Cyclone Armor'.blvl) * par7",
    "startmana": 0
  },
  {
    "id": 251,
    "name": "Fire Blast",
    "nameZh": "火焰爆震",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 0,
    "tabName": "Traps",
    "tabNameZh": "陷阱",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      256,
      262
    ],
    "mana": 24,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 5,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 6,
    "eMax": 8,
    "eMinLev": [
      3,
      8,
      20,
      38,
      58
    ],
    "eMaxLev": [
      5,
      11,
      24,
      44,
      66
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 9,
      "par1": 5
    },
    "synergyFormulas": {
      "elemental": "(skill('Shock Field'.blvl) + skill('Death Sentry'.blvl) + skill('Charged Bolt Sentry'.blvl) + skill('Lightning Sentry'.blvl) + skill('Wake of Fire Sentry'.blvl) + skill('Inferno Sentry'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Shock Field",
        "providerId": 256,
        "percentPerLevel": 9,
        "type": "elemental"
      },
      {
        "providerName": "Death Sentry",
        "providerId": 276,
        "percentPerLevel": 9,
        "type": "elemental"
      },
      {
        "providerName": "Charged Bolt Sentry",
        "providerId": 261,
        "percentPerLevel": 9,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Sentry",
        "providerId": 271,
        "percentPerLevel": 9,
        "type": "elemental"
      },
      {
        "providerName": "Wake of Fire Sentry",
        "providerId": 262,
        "percentPerLevel": 9,
        "type": "elemental"
      },
      {
        "providerName": "Inferno Sentry",
        "providerId": 272,
        "percentPerLevel": 9,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 261,
        "targetName": "Charged Bolt Sentry",
        "targetNameZh": "充能弹哨卫",
        "percentPerLevel": 6
      },
      {
        "targetId": 262,
        "targetName": "Wake of Fire",
        "targetNameZh": "火焰复苏",
        "percentPerLevel": 8
      },
      {
        "targetId": 272,
        "targetName": "Wake of Inferno",
        "targetNameZh": "地狱火复苏",
        "percentPerLevel": 10
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "par1"
      }
    ],
    "shortDesc": "throw a fire bomb",
    "shortDescZh": "投掷火焰爆震手雷",
    "longDesc": "to blast your enemies to bits\nthrow a fire bomb",
    "longDescZh": "投掷一枚火焰炸弹，落地引爆对小范围敌人造成火焰伤害",
    "icon": "/skills/icon_251.png",
    "iconActive": "/skills/icon_251_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 252,
    "name": "Claw Mastery",
    "nameZh": "爪支配",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 1,
    "tabName": "Shadow Disciplines",
    "tabNameZh": "暗影武艺",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      258,
      263
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 25,
      "par5": 0,
      "par1": 30,
      "par2": 10,
      "par3": 35,
      "par4": 4
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [
      {
        "targetId": 260,
        "targetName": "Dragon Claw",
        "targetNameZh": "双龙爪",
        "percentPerLevel": 4
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 51,
        "textaKey": "eskillincasemasteryX",
        "textaEn": "%d Percent Chance of Critical Strike",
        "textaZh": "%d機率做出致命一擊",
        "calca": "macr"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "math"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "madm"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - improves claw-class weapons ability",
    "shortDescZh": "提升爪类武器的伤害、命中与暴击",
    "longDesc": "with claw-class weapons\npassive - improves your skill",
    "longDescZh": "被动提升使用爪类武器时的战斗效能",
    "icon": "/skills/icon_252.png",
    "iconActive": "/skills/icon_252_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 253,
    "name": "Psychic Hammer",
    "nameZh": "心灵战锤",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 1,
    "tabName": "Shadow Disciplines",
    "tabNameZh": "暗影武艺",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      264
    ],
    "mana": 16,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 2,
    "maxDam": 6,
    "minLevDam": [
      2,
      3,
      4,
      5,
      6
    ],
    "maxLevDam": [
      3,
      4,
      5,
      6,
      7
    ],
    "eType": "mag",
    "eMin": 2,
    "eMax": 6,
    "eMinLev": [
      2,
      3,
      4,
      5,
      6
    ],
    "eMaxLev": [
      3,
      4,
      5,
      6,
      7
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 99,
      "par5": 25,
      "par1": 100,
      "par3": 50,
      "par4": 100
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 11
      },
      {
        "lineType": 10
      },
      {
        "lineType": 9
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "a mind blast to crush your enemies",
    "shortDescZh": "运用念力冲击并击退目标敌人",
    "longDesc": "to crush and knock back your enemies\nto create a psychic blast\nuse the power of your mind",
    "longDescZh": "凝聚精神力量重击单个敌人，造成物理与魔法伤害并将其击退",
    "icon": "/skills/icon_253.png",
    "iconActive": "/skills/icon_253_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 254,
    "name": "Tiger Strike",
    "nameZh": "虎击",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 2,
    "tabName": "Martial Arts",
    "tabNameZh": "武学艺术",
    "row": 1,
    "col": 2,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      265
    ],
    "mana": 1,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 100,
      "par2": 20,
      "par3": 375,
      "par4": 50
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [
      252
    ],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "Eskillpowerup3",
        "textbKey": "Eskillpuddgmper",
        "textaEn": "Charge 3 -",
        "textaZh": "聚气 3 段 -",
        "textbEn": "percent damage",
        "textbZh": "% 伤害",
        "calca": "3*ln12"
      },
      {
        "lineType": 2,
        "textaKey": "Eskillpowerup2",
        "textbKey": "Eskillpuddgmper",
        "textaEn": "Charge 2 -",
        "textaZh": "聚气 2 段 -",
        "textbEn": "percent damage",
        "textbZh": "% 伤害",
        "calca": "2*ln12"
      },
      {
        "lineType": 2,
        "textaKey": "Eskillpowerup1",
        "textbKey": "Eskillpuddgmper",
        "textaEn": "Charge 1 -",
        "textaZh": "聚气 1 段 -",
        "textbEn": "percent damage",
        "textbZh": "% 伤害",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "increases damage of finishing moves\n\nCharge-up Skill",
    "shortDescZh": "武术聚气：积聚毁灭性的物理近战能量",
    "longDesc": "normal attack to release charges\nmust use a dragon finishing move or\nto finishing moves\nconsecutive hits add damage bonuses\n\nCharge-up Skill",
    "longDescZh": "最多积聚3段气劲，释放时造成毁天灭地的巨大物理爆发",
    "icon": "/skills/icon_254.png",
    "iconActive": "/skills/icon_254_active.png",
    "toHit": 15,
    "toHitLev": 7,
    "auraLenCalc": "par3",
    "startmana": 0
  },
  {
    "id": 255,
    "name": "Dragon Talon",
    "nameZh": "龙爪",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 2,
    "tabName": "Martial Arts",
    "tabNameZh": "武学艺术",
    "row": 1,
    "col": 3,
    "reqlevel": 1,
    "reqskills": [],
    "dependents": [
      260
    ],
    "mana": 10,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "15",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 99,
      "par5": 25,
      "par1": 5,
      "par2": 7,
      "par3": 50,
      "par4": 100
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [
      252
    ],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "Eskillkickdamage",
        "textbKey": "StrSkill23",
        "textaEn": "Kick Damage:",
        "textaZh": "踢击伤害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      },
      {
        "lineType": 36,
        "textaKey": "EskillKickSing",
        "textbKey": "EskillKickPlur",
        "textaEn": "Kick",
        "textaZh": "踢",
        "textbEn": "Kicks",
        "textbZh": "踢",
        "calca": "lvl/6+1"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "kick your enemies\n\nFinishing Move",
    "shortDescZh": "连续飞腿踢击单个目标",
    "longDesc": "adds charged-up bonuses to the kick\nkick your enemies out of your way\n\nFinishing Move",
    "longDescZh": "随着技能等级提高，发动2次至5次超快速的连续旋风踢",
    "icon": "/skills/icon_255.png",
    "iconActive": "/skills/icon_255_active.png",
    "toHit": 20,
    "toHitLev": 35,
    "startmana": 0
  },
  {
    "id": 256,
    "name": "Shock Web",
    "nameZh": "雷电网",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 0,
    "tabName": "Traps",
    "tabNameZh": "陷阱",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [
      251
    ],
    "dependents": [
      261
    ],
    "mana": 6,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 15,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 2,
    "eMax": 20,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      6,
      12,
      20,
      30,
      42
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 11,
      "par1": 6,
      "par2": 4
    },
    "synergyFormulas": {
      "elemental": "(skill('Charged Bolt Sentry'.blvl) + skill('Lightning Sentry'.blvl) + skill('Death Sentry'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Charged Bolt Sentry",
        "providerId": 261,
        "percentPerLevel": 11,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Sentry",
        "providerId": 271,
        "percentPerLevel": 11,
        "type": "elemental"
      },
      {
        "providerName": "Death Sentry",
        "providerId": 276,
        "percentPerLevel": 11,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 251,
        "targetName": "Fire Blast",
        "targetNameZh": "火焰爆震",
        "percentPerLevel": 9
      },
      {
        "targetId": 271,
        "targetName": "Lightning Sentry",
        "targetNameZh": "闪电哨卫",
        "percentPerLevel": 12
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 38,
        "textaKey": "StrSkill7",
        "textbKey": "StrSkill34",
        "textaEn": "Lightning Damage:",
        "textaZh": "閃電傷害：",
        "textbEn": "per second",
        "textbZh": "每秒",
        "calca": "edmn",
        "calcb": "edmx"
      },
      {
        "lineType": 23,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續："
      },
      {
        "lineType": 5,
        "textaKey": "ESkillSpikes",
        "textaEn": "Spikes:",
        "textaZh": "地刺：",
        "calca": "par1+lvl/par2+skill('Fire Trauma'.blvl)/3"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "throw a web of lightning",
    "shortDescZh": "投掷一张布满电流地刺的雷电网",
    "longDesc": "to shock your enemies\nthrow a web of lightning",
    "longDescZh": "投掷散落多枚放电地刺的雷电网，对踏入区域的敌人持续造成闪电伤害",
    "icon": "/skills/icon_256.png",
    "iconActive": "/skills/icon_256_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 257,
    "name": "Blade Sentinel",
    "nameZh": "刀刃守卫",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 0,
    "tabName": "Traps",
    "tabNameZh": "陷阱",
    "row": 2,
    "col": 3,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      266
    ],
    "mana": 7,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 50,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 48,
    "minDam": 6,
    "maxDam": 10,
    "minLevDam": [
      3,
      4,
      5,
      5,
      5
    ],
    "maxLevDam": [
      3,
      4,
      5,
      5,
      5
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 100,
      "par2": 12,
      "par3": 5,
      "par4": 3
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 72,
        "textaKey": "WeapDamsk",
        "textaEn": "Weapon Damage",
        "textaZh": "武器傷害",
        "calca": "3",
        "calcb": "8"
      },
      {
        "lineType": 9
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "bladecreeper",
      "minHP": 100,
      "maxHP": 100,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "set a spinning blade",
    "shortDescZh": "布置一道巡逻的旋转飞刃",
    "longDesc": "between you and target point\nset a spinning blade to patrol",
    "longDescZh": "在自身与目标点之间布置来回巡逻的旋转飞刃，切割沿途敌人",
    "icon": "/skills/icon_257.png",
    "iconActive": "/skills/icon_257_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 258,
    "name": "Burst of Speed",
    "nameZh": "加速",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 1,
    "tabName": "Shadow Disciplines",
    "tabNameZh": "暗影武艺",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [
      252
    ],
    "dependents": [
      267
    ],
    "mana": 10,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 300,
      "par5": 3000,
      "par1": 15,
      "par2": 70,
      "par3": 15,
      "par4": 60
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln56"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill89",
        "textbKey": "StrSkill23",
        "textaEn": "Walk/Run Speed:",
        "textaZh": "行走/跑步速度：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm12"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill106",
        "textbKey": "StrSkill23",
        "textaEn": "Attack Speed:",
        "textaZh": "準確率：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "increases attack and movement speed",
    "shortDescZh": "短时间内大幅提升攻击与移动速度",
    "longDesc": "for a period of time\nincreases attack and movement speed",
    "longDescZh": "进入加速状态，脚步如飞，出招极快",
    "icon": "/skills/icon_258.png",
    "iconActive": "/skills/icon_258_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln56",
    "startmana": 0
  },
  {
    "id": 259,
    "name": "Fists of Fire",
    "nameZh": "焰拳",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 2,
    "tabName": "Martial Arts",
    "tabNameZh": "武学艺术",
    "row": 2,
    "col": 1,
    "reqlevel": 6,
    "reqskills": [],
    "dependents": [
      269
    ],
    "mana": 2,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "20",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 6,
    "eMax": 10,
    "eMinLev": [
      5,
      10,
      20,
      30,
      40
    ],
    "eMaxLev": [
      5,
      11,
      22,
      33,
      44
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 12,
      "par1": 4,
      "par2": 4,
      "par3": 375,
      "par4": 50
    },
    "synergyFormulas": {
      "elemental": "(skill('Royal Strike'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Royal Strike",
        "providerId": 280,
        "percentPerLevel": 12,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 280,
        "targetName": "Phoenix Strike",
        "targetNameZh": "凤凰攻击",
        "percentPerLevel": 10
      }
    ],
    "masteries": [
      252
    ],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 17,
        "textaKey": "Eskillfistsoffire1",
        "textbKey": "Eskillpowerup3",
        "textaEn": "fire damage:",
        "textaZh": "火焰伤害：",
        "textbEn": "Charge 3 -",
        "textbZh": "聚气 3 段 -",
        "calca": "m1eo*50/256",
        "calcb": "m1ey*50/256"
      },
      {
        "lineType": 19,
        "textaKey": "Eskillfistsoffire2",
        "textbKey": "Eskillpowerup2",
        "textaEn": "fire damage radius:",
        "textaZh": "火焰伤害范围：",
        "textbEn": "Charge 2 -",
        "textbZh": "聚气 2 段 -",
        "calca": "par1"
      },
      {
        "lineType": 24,
        "textaKey": "Eskillfistsoffire1",
        "textbKey": "Eskillpowerup1",
        "textaEn": "fire damage:",
        "textaZh": "火焰伤害：",
        "textbEn": "Charge 1 -",
        "textbZh": "聚气 1 段 -"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "adds fire damage to finishing moves\n\nCharge-up Skill",
    "shortDescZh": "为终结技附加火焰伤害\n\n聚气技能",
    "longDesc": "normal attack to release charges\nmust use a dragon finishing move or\ncan only be used with claw-class weapons\nto finishing moves\nconsecutive hits add fire damage\n\nCharge-up Skill",
    "longDescZh": "连续命中积聚火焰伤害并附加到终结技上；仅限装备爪类武器时使用，需配合龙系终结技或普通攻击释放聚气",
    "icon": "/skills/icon_259.png",
    "iconActive": "/skills/icon_259_active.png",
    "toHit": 15,
    "toHitLev": 7,
    "auraLenCalc": "par3",
    "startmana": 0
  },
  {
    "id": 260,
    "name": "Dragon Claw",
    "nameZh": "双龙爪",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 2,
    "tabName": "Martial Arts",
    "tabNameZh": "武学艺术",
    "row": 2,
    "col": 3,
    "reqlevel": 6,
    "reqskills": [
      255
    ],
    "dependents": [
      270
    ],
    "mana": 2,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "19",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 4,
      "par5": 4,
      "par1": 50,
      "par2": 5
    },
    "synergyFormulas": {
      "damage": "(skill('Claw Mastery'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Claw Mastery",
        "providerId": 252,
        "percentPerLevel": 4,
        "type": "damage"
      }
    ],
    "synergiesGiven": [],
    "masteries": [
      252
    ],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill4",
        "textbKey": "StrSkill23",
        "textaEn": "Damage:",
        "textaZh": "傷害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12 + (skill('Claw Mastery'.blvl)) * par8"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "double claw attack\n\nFinishing Move",
    "shortDescZh": "双爪连击\n\n终结技",
    "longDesc": "adds charged-up bonuses to both claw attacks\nwith your dual claw-class weapons\nslice and dice your enemies\n\nFinishing Move",
    "longDescZh": "使用双持爪类武器连续劈砍敌人，将聚气加成附加到两次爪击上\n\n终结技",
    "icon": "/skills/icon_260.png",
    "iconActive": "/skills/icon_260_active.png",
    "toHit": 40,
    "toHitLev": 25,
    "startmana": 0
  },
  {
    "id": 261,
    "name": "Charged Bolt Sentry",
    "nameZh": "充能弹哨卫",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 0,
    "tabName": "Traps",
    "tabNameZh": "陷阱",
    "row": 3,
    "col": 1,
    "reqlevel": 12,
    "reqskills": [
      256
    ],
    "dependents": [
      271
    ],
    "mana": 13,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 7,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 2,
    "eMax": 14,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      6,
      8,
      12,
      14,
      16
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 6,
      "par1": 5,
      "par3": 5
    },
    "synergyFormulas": {
      "elemental": "(skill('Fire Trauma'.blvl) + skill('Lightning Sentry'.blvl) + skill('Death Sentry'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Fire Trauma",
        "providerId": 251,
        "percentPerLevel": 6,
        "type": "elemental"
      },
      {
        "providerName": "Lightning Sentry",
        "providerId": 271,
        "percentPerLevel": 6,
        "type": "elemental"
      },
      {
        "providerName": "Death Sentry",
        "providerId": 276,
        "percentPerLevel": 6,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 251,
        "targetName": "Fire Blast",
        "targetNameZh": "火焰爆震",
        "percentPerLevel": 9
      },
      {
        "targetId": 256,
        "targetName": "Shock Web",
        "targetNameZh": "雷电网",
        "percentPerLevel": 11
      },
      {
        "targetId": 271,
        "targetName": "Lightning Sentry",
        "targetNameZh": "闪电哨卫",
        "percentPerLevel": 12
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill72",
        "textbKey": "StrSkill73",
        "textaEn": "Releases",
        "textaZh": "放出",
        "textbEn": "charged bolts",
        "textbZh": "充能的光彈",
        "calca": "ln34 + skill('Shock Field'.blvl)/3"
      },
      {
        "lineType": 3,
        "textaKey": "ESkillShoots",
        "textbKey": "ESkillTimes",
        "textaEn": "Shoots",
        "textaZh": "发射",
        "textbEn": "Times",
        "textbZh": "次",
        "calca": "par1 + skill('Lightning Sentry'.blvl)/4"
      }
    ],
    "minionStats": {
      "code": "chargeboltsentry",
      "minHP": 100,
      "maxHP": 100,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "a trap that emits charged bolts",
    "shortDescZh": "布置发射充能弹的哨卫陷阱",
    "longDesc": "at enemies that pass near\na trap that emits charged bolts",
    "longDescZh": "当敌人接近时自动释放大量蜿蜒前行的充能电火花",
    "icon": "/skills/icon_261.png",
    "iconActive": "/skills/icon_261_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 262,
    "name": "Wake of Fire",
    "nameZh": "火焰复苏",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 0,
    "tabName": "Traps",
    "tabNameZh": "陷阱",
    "row": 3,
    "col": 2,
    "reqlevel": 12,
    "reqskills": [
      251
    ],
    "dependents": [
      266,
      272
    ],
    "mana": 13,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 5,
    "eMax": 10,
    "eMinLev": [
      2,
      3,
      5,
      7,
      9
    ],
    "eMaxLev": [
      2,
      3,
      6,
      8,
      10
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 8,
      "par1": 5
    },
    "synergyFormulas": {
      "elemental": "(skill('Fire Trauma'.blvl) + skill('Inferno Sentry'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Fire Trauma",
        "providerId": 251,
        "percentPerLevel": 8,
        "type": "elemental"
      },
      {
        "providerName": "Inferno Sentry",
        "providerId": 272,
        "percentPerLevel": 8,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 251,
        "targetName": "Fire Blast",
        "targetNameZh": "火焰爆震",
        "percentPerLevel": 9
      },
      {
        "targetId": 272,
        "targetName": "Wake of Inferno",
        "targetNameZh": "地狱火复苏",
        "percentPerLevel": 7
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 3,
        "textaKey": "ESkillShoots",
        "textbKey": "ESkillTimes",
        "textaEn": "Shoots",
        "textaZh": "发射",
        "textbEn": "Times",
        "textbZh": "次",
        "calca": "par1"
      }
    ],
    "minionStats": {
      "code": "wakeofdestruction",
      "minHP": 100,
      "maxHP": 100,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "a trap that emits waves of fire",
    "shortDescZh": "布置喷射火焰浪潮的哨卫陷阱",
    "longDesc": "a trap that emits waves of fire",
    "longDescZh": "当敌人接近时自动向前方喷射V型烈焰波浪",
    "icon": "/skills/icon_262.png",
    "iconActive": "/skills/icon_262_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 263,
    "name": "Weapon Block",
    "nameZh": "武器格挡",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 1,
    "tabName": "Shadow Disciplines",
    "tabNameZh": "暗影武艺",
    "row": 3,
    "col": 2,
    "reqlevel": 12,
    "reqskills": [
      252
    ],
    "dependents": [
      268
    ],
    "mana": 0,
    "lvlmana": 0,
    "minmana": 0,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 20,
      "par2": 65
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 7,
        "textaKey": "StrSkill24",
        "textaEn": "percent chance",
        "textaZh": "百分機率",
        "calca": "dm12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "passive - block with two claw-class weapons",
    "shortDescZh": "双持爪类武器时格挡敌人的攻击",
    "longDesc": "you are using dual claw-class weapons\npassive - chance to block when",
    "longDescZh": "甚至可以格挡法术飞弹与远程攻击",
    "icon": "/skills/icon_263.png",
    "iconActive": "/skills/icon_263_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 264,
    "name": "Cloak of Shadows",
    "nameZh": "魔影斗篷",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 1,
    "tabName": "Shadow Disciplines",
    "tabNameZh": "暗影武艺",
    "row": 3,
    "col": 3,
    "reqlevel": 12,
    "reqskills": [
      253
    ],
    "dependents": [
      268,
      273
    ],
    "mana": 13,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 3,
      "par7": 10,
      "par6": 3,
      "par5": 15,
      "par1": 30,
      "par2": 30,
      "par3": 200,
      "par4": 25
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill25",
        "textbKey": "StrSkill23",
        "textaEn": "Enemy Defense:",
        "textaZh": "敵人防禦：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "\"-min(ln56,95)\""
      },
      {
        "lineType": 2,
        "textaKey": "StrSkill31",
        "textbKey": "StrSkill23",
        "textaEn": "Defense Bonus:",
        "textaZh": "防禦加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln78"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln34"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill56",
        "textaEn": "Range:",
        "textaZh": "射程",
        "calca": "dm12"
      }
    ],
    "shortDesc": "blind your enemies",
    "shortDescZh": "唤来暗影帷幕降低敌人视野与防御",
    "longDesc": "lowering their defenses for a period of time\ncast a shadow to blind nearby enemies",
    "longDescZh": "使全场陷入致盲暗影，极大降低怪物的防御力",
    "icon": "/skills/icon_264.png",
    "iconActive": "/skills/icon_264_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln34",
    "startmana": 0
  },
  {
    "id": 265,
    "name": "Cobra Strike",
    "nameZh": "眼镜蛇攻击",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 2,
    "tabName": "Martial Arts",
    "tabNameZh": "武学艺术",
    "row": 3,
    "col": 2,
    "reqlevel": 12,
    "reqskills": [
      254
    ],
    "dependents": [
      280
    ],
    "mana": 2,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 40,
      "par2": 5,
      "par3": 375,
      "par4": 50
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [
      252
    ],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "Eskillpowerup3",
        "textbKey": "Eskillpudmana",
        "textaEn": "Charge 3 -",
        "textaZh": "聚气 3 段 -",
        "textbEn": "percent life and mana stealing",
        "textbZh": "% 生命与法力偷取",
        "calca": "2*ln12"
      },
      {
        "lineType": 2,
        "textaKey": "Eskillpowerup2",
        "textbKey": "Eskillpudmana",
        "textaEn": "Charge 2 -",
        "textaZh": "聚气 2 段 -",
        "textbEn": "percent life and mana stealing",
        "textbZh": "% 生命与法力偷取",
        "calca": "ln12"
      },
      {
        "lineType": 2,
        "textaKey": "Eskillpowerup1",
        "textbKey": "Eskillpudlife",
        "textaEn": "Charge 1 -",
        "textaZh": "聚气 1 段 -",
        "textbEn": "percent life stealing",
        "textbZh": "% 生命偷取",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "adds life and mana stealing to finishing moves\n\nCharge-up Skill",
    "shortDescZh": "为终结技附加生命与法力偷取\n\n聚气技能",
    "longDesc": "normal attack to release charges\nmust use a dragon finishing move or\nto finishing moves\nconsecutive hits add life and mana stealing\n\nCharge-up Skill",
    "longDescZh": "连续命中积聚生命与法力偷取并附加到终结技上；需配合龙系终结技或普通攻击释放聚气",
    "icon": "/skills/icon_265.png",
    "iconActive": "/skills/icon_265_active.png",
    "toHit": 15,
    "toHitLev": 7,
    "auraLenCalc": "par3",
    "startmana": 0
  },
  {
    "id": 266,
    "name": "Blade Fury",
    "nameZh": "刀刃之怒",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 0,
    "tabName": "Traps",
    "tabNameZh": "陷阱",
    "row": 4,
    "col": 3,
    "reqlevel": 18,
    "reqskills": [
      257,
      262
    ],
    "dependents": [
      277
    ],
    "mana": 8,
    "lvlmana": 1,
    "minmana": 0,
    "manashift": 5,
    "delay": 0,
    "descdam": "24",
    "hitshift": 8,
    "srcDamage": 96,
    "minDam": 8,
    "maxDam": 10,
    "minLevDam": [
      3,
      5,
      8,
      8,
      8
    ],
    "maxLevDam": [
      3,
      5,
      8,
      8,
      8
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par3": 3,
      "par4": 5
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 61,
        "textaKey": "StrSkill3",
        "textbKey": "EskillPerBlade",
        "textaEn": "Mana Cost:",
        "textaZh": "法力耗費：",
        "textbEn": "per blade",
        "textbZh": "每枚利刃",
        "calca": "usmc",
        "calcb": "10"
      },
      {
        "lineType": 72,
        "textaKey": "WeapDamsk",
        "textaEn": "Weapon Damage",
        "textaZh": "武器傷害",
        "calca": "3",
        "calcb": "4"
      },
      {
        "lineType": 9
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 5,
        "textaKey": "StrSkill115",
        "textaEn": "Minimum Mana Required to Cast:",
        "textaZh": "施展法術至少須要法力點數為：",
        "calca": "par3"
      }
    ],
    "shortDesc": "throw spinning blades",
    "shortDescZh": "投掷高速旋转的飞刀",
    "longDesc": "to slice up your enemies\nthrow spinning blades",
    "longDescZh": "持续向目标方向高速投掷旋转飞刀，切碎沿途敌人",
    "icon": "/skills/icon_266.png",
    "iconActive": "/skills/icon_266_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 6
  },
  {
    "id": 267,
    "name": "Fade",
    "nameZh": "消解",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 1,
    "tabName": "Shadow Disciplines",
    "tabNameZh": "暗影武艺",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      258
    ],
    "dependents": [
      278
    ],
    "mana": 10,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 1,
      "par7": 1,
      "par6": 300,
      "par5": 3000,
      "par1": 10,
      "par2": 75,
      "par3": 40,
      "par4": 90
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln56"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill54",
        "textbKey": "StrSkill23",
        "textaEn": "Resist All:",
        "textaZh": "全面抵抗：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm12"
      },
      {
        "lineType": 3,
        "textaKey": "StrSkill85",
        "textbKey": "StrSkill23",
        "textaEn": "Reduces curse duration by",
        "textaZh": "詛咒持續時間降低",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm34"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "temporary resist all",
    "shortDescZh": "提高所有元素抗性与物理伤害减免",
    "longDesc": "for a period of time\nraise all resistances and resist curses",
    "longDescZh": "身躯半虚无化，减少受到的诅咒持续时间和所有伤害",
    "icon": "/skills/icon_267.png",
    "iconActive": "/skills/icon_267_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln56",
    "startmana": 0
  },
  {
    "id": 268,
    "name": "Shadow Warrior",
    "nameZh": "暗影战士",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 1,
    "tabName": "Shadow Disciplines",
    "tabNameZh": "暗影武艺",
    "row": 4,
    "col": 2,
    "reqlevel": 18,
    "reqskills": [
      264,
      263
    ],
    "dependents": [
      279
    ],
    "mana": 54,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 150,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 2,
      "par5": 18,
      "par1": 15,
      "par2": 40,
      "par3": 12
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill31",
        "textbKey": "StrSkill23",
        "textaEn": "Defense Bonus:",
        "textaZh": "防禦加成：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "(lvl-1)*par3"
      },
      {
        "lineType": 4,
        "textaKey": "StrSkill22",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "calca": "lvl*par2"
      },
      {
        "lineType": 13,
        "calca": "(lvl-1)*par1"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "shadowwarrior",
      "minHP": 376,
      "maxHP": 376,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon a shadow of yourself",
    "shortDescZh": "召唤模仿你当前所装备技能的暗影分身",
    "longDesc": "your skills and fights by your side\nsummon a shadow of yourself that mimics",
    "longDescZh": "投射出一个暗影分身与你并肩作战，使用你左右键装备的技能",
    "icon": "/skills/icon_268.png",
    "iconActive": "/skills/icon_268_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 269,
    "name": "Claws of Thunder",
    "nameZh": "雷电爪",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 2,
    "tabName": "Martial Arts",
    "tabNameZh": "武学艺术",
    "row": 4,
    "col": 1,
    "reqlevel": 18,
    "reqskills": [
      259
    ],
    "dependents": [
      274
    ],
    "mana": 16,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 6,
    "delay": 0,
    "descdam": "20",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 80,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      20,
      40,
      60,
      80,
      100
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 8,
      "par1": 4,
      "par3": 375,
      "par4": 50
    },
    "synergyFormulas": {
      "elemental": "(skill('Royal Strike'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Royal Strike",
        "providerId": 280,
        "percentPerLevel": 8,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 280,
        "targetName": "Phoenix Strike",
        "targetNameZh": "凤凰攻击",
        "percentPerLevel": 13
      }
    ],
    "masteries": [
      252
    ],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 62,
        "textaKey": "Eskillpowerup3",
        "textbKey": "Eskillthunder3",
        "textaEn": "Charge 3 -",
        "textaZh": "聚气 3 段 -",
        "textbEn": "charged bolt damage:",
        "textbZh": "充能弹伤害：",
        "calca": "m3en",
        "calcb": "m3ex"
      },
      {
        "lineType": 62,
        "textaKey": "Eskillpowerup2",
        "textbKey": "Eskillthunder2",
        "textaEn": "Charge 2 -",
        "textaZh": "聚气 2 段 -",
        "textbEn": "nova damage:",
        "textbZh": "闪电新星伤害：",
        "calca": "m2en",
        "calcb": "m2ex"
      },
      {
        "lineType": 24,
        "textaKey": "Eskillthunder1",
        "textbKey": "Eskillpowerup1",
        "textaEn": "lightning damage:",
        "textaZh": "闪电伤害：",
        "textbEn": "Charge 1 -",
        "textbZh": "聚气 1 段 -"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "adds lightning damage to finishing moves\n \nCharge-up Skill",
    "shortDescZh": "为终结技附加闪电伤害\n\n聚气技能",
    "longDesc": "normal attack to release charges\nmust use a dragon finishing move or\ncan only be used with claw-class weapons\nto finishing moves\nconsecutive hits add lightning damage\n\nCharge-up Skill",
    "longDescZh": "连续命中积聚闪电伤害并附加到终结技上；仅限装备爪类武器时使用，需配合龙系终结技或普通攻击释放聚气",
    "icon": "/skills/icon_269.png",
    "iconActive": "/skills/icon_269_active.png",
    "toHit": 15,
    "toHitLev": 7,
    "auraLenCalc": "par3",
    "startmana": 0
  },
  {
    "id": 270,
    "name": "Dragon Tail",
    "nameZh": "神龙摆尾",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 2,
    "tabName": "Martial Arts",
    "tabNameZh": "武学艺术",
    "row": 4,
    "col": 3,
    "reqlevel": 18,
    "reqskills": [
      260
    ],
    "dependents": [
      275
    ],
    "mana": 10,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "16",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 50,
      "par2": 10,
      "par3": 6,
      "par4": -40
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [
      252
    ],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "Eskillfistsoffire1",
        "textbKey": "StrSkill23",
        "textaEn": "fire damage:",
        "textaZh": "火焰伤害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 19,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "par3"
      }
    ],
    "shortDesc": "explosive kick\n\nFinishing Move",
    "shortDescZh": "爆炸飞踢\n\n终结技",
    "longDesc": "adds charged-up bonuses to the kick\nknock back your enemies with an explosive kick\n\nFinishing Move",
    "longDescZh": "以爆炸性的飞踢击退敌人并将聚气加成附加到踢击上\n\n终结技",
    "icon": "/skills/icon_270.png",
    "iconActive": "/skills/icon_270_active.png",
    "toHit": 20,
    "toHitLev": 15,
    "startmana": 0
  },
  {
    "id": 271,
    "name": "Lightning Sentry",
    "nameZh": "闪电哨卫",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 0,
    "tabName": "Traps",
    "tabNameZh": "陷阱",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      261
    ],
    "dependents": [
      276
    ],
    "mana": 20,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 20,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      10,
      16,
      24,
      34,
      44
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 12,
      "par1": 10
    },
    "synergyFormulas": {
      "elemental": "(skill('Shock Field'.blvl) + skill('Charged Bolt Sentry'.blvl) + skill('Death Sentry'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Shock Field",
        "providerId": 256,
        "percentPerLevel": 12,
        "type": "elemental"
      },
      {
        "providerName": "Charged Bolt Sentry",
        "providerId": 261,
        "percentPerLevel": 12,
        "type": "elemental"
      },
      {
        "providerName": "Death Sentry",
        "providerId": 276,
        "percentPerLevel": 12,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 251,
        "targetName": "Fire Blast",
        "targetNameZh": "火焰爆震",
        "percentPerLevel": 9
      },
      {
        "targetId": 256,
        "targetName": "Shock Web",
        "targetNameZh": "雷电网",
        "percentPerLevel": 11
      },
      {
        "targetId": 261,
        "targetName": "Charged Bolt Sentry",
        "targetNameZh": "充能弹哨卫",
        "percentPerLevel": 6
      },
      {
        "targetId": 276,
        "targetName": "Death Sentry",
        "targetNameZh": "死亡哨卫",
        "percentPerLevel": 12
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 3,
        "textaKey": "ESkillShoots",
        "textbKey": "ESkillTimes",
        "textaEn": "Shoots",
        "textaZh": "发射",
        "textbEn": "Times",
        "textbZh": "次",
        "calca": "par1"
      }
    ],
    "minionStats": {
      "code": "lightningsentry",
      "minHP": 100,
      "maxHP": 100,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "a trap that emits lightning",
    "shortDescZh": "布置发射闪电束的哨卫陷阱",
    "longDesc": "to scorch passing enemies\na trap that shoots lightning",
    "longDescZh": "刺客核心陷阱，向经过的敌人发射高伤害穿透闪电束",
    "icon": "/skills/icon_271.png",
    "iconActive": "/skills/icon_271_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 272,
    "name": "Wake of Inferno",
    "nameZh": "地狱火复苏",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 0,
    "tabName": "Traps",
    "tabNameZh": "陷阱",
    "row": 5,
    "col": 2,
    "reqlevel": 24,
    "reqskills": [
      262
    ],
    "dependents": [],
    "mana": 20,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "8",
    "hitshift": 4,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "fire",
    "eMin": 20,
    "eMax": 50,
    "eMinLev": [
      17,
      21,
      26,
      32,
      39
    ],
    "eMaxLev": [
      19,
      23,
      28,
      34,
      41
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 7,
      "par7": 10,
      "par1": 10
    },
    "synergyFormulas": {
      "elemental": "(skill('Fire Trauma'.blvl) + skill('Death Sentry'.blvl)) * par7 + skill('Wake of Fire Sentry'.blvl)*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Fire Trauma",
        "providerId": 251,
        "percentPerLevel": 10,
        "type": "elemental"
      },
      {
        "providerName": "Death Sentry",
        "providerId": 276,
        "percentPerLevel": 10,
        "type": "elemental"
      },
      {
        "providerName": "Wake of Fire Sentry",
        "providerId": 262,
        "percentPerLevel": 7,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 251,
        "targetName": "Fire Blast",
        "targetNameZh": "火焰爆震",
        "percentPerLevel": 9
      },
      {
        "targetId": 262,
        "targetName": "Wake of Fire",
        "targetNameZh": "火焰复苏",
        "percentPerLevel": 8
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 59,
        "textaKey": "StrSkill5",
        "textaEn": "Fire Damage:",
        "textaZh": "火焰傷害：",
        "calca": "edns*25/768",
        "calcb": "edxs*25/768"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 3,
        "textaKey": "ESkillShoots",
        "textbKey": "ESkillTimes",
        "textaEn": "Shoots",
        "textaZh": "发射",
        "textbEn": "Times",
        "textbZh": "次",
        "calca": "par1"
      }
    ],
    "minionStats": {
      "code": "infernosentry",
      "minHP": 100,
      "maxHP": 100,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "trap that sprays fire",
    "shortDescZh": "布置喷射地狱火的哨卫陷阱",
    "longDesc": "trap that sprays fire at passing enemies",
    "longDescZh": "向经过的敌人持续喷射高温地狱烈焰流",
    "icon": "/skills/icon_272.png",
    "iconActive": "/skills/icon_272_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 273,
    "name": "Mind Blast",
    "nameZh": "心灵震爆",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 1,
    "tabName": "Shadow Disciplines",
    "tabNameZh": "暗影武艺",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      264
    ],
    "dependents": [],
    "mana": 15,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 10,
    "maxDam": 20,
    "minLevDam": [
      2,
      5,
      8,
      8,
      8
    ],
    "maxLevDam": [
      2,
      5,
      8,
      8,
      8
    ],
    "eType": "stun",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 50,
    "eLevLen": [
      5,
      5,
      5
    ],
    "params": {
      "par7": 4,
      "par6": 40,
      "par5": 15,
      "par1": 50,
      "par2": 5,
      "par3": 150,
      "par4": 100
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 3,
        "textaKey": "StrSkill99",
        "textbKey": "StrSkill23",
        "textaEn": "Chance to convert:",
        "textaZh": "轉換的機會：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "dm56"
      },
      {
        "lineType": 12,
        "textaKey": "StrSkill48",
        "textaEn": "Stun Length:",
        "textaZh": "昏迷時間：",
        "calca": "\"min(250,edln)\""
      },
      {
        "lineType": 9
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 16,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "par3",
        "calcb": "par3+par4"
      }
    ],
    "shortDesc": "compelling psionic blast",
    "shortDescZh": "释放精神冲击震晕并转化范围内的敌人",
    "longDesc": "and convert the feeble-minded\nstun a group of enemies\nusing the power of your mind",
    "longDescZh": "摧毁一群敌人的心智，造成物理伤害、击退与眩晕，并有几率将其转化为友军",
    "icon": "/skills/icon_273.png",
    "iconActive": "/skills/icon_273_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 274,
    "name": "Blades of Ice",
    "nameZh": "寒冰刃",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 2,
    "tabName": "Martial Arts",
    "tabNameZh": "武学艺术",
    "row": 5,
    "col": 1,
    "reqlevel": 24,
    "reqskills": [
      269
    ],
    "dependents": [
      280
    ],
    "mana": 3,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "20",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "cold",
    "eMin": 15,
    "eMax": 35,
    "eMinLev": [
      8,
      10,
      20,
      30,
      40
    ],
    "eMaxLev": [
      8,
      10,
      22,
      32,
      42
    ],
    "eLen": 100,
    "eLevLen": [
      10,
      10,
      10
    ],
    "params": {
      "par8": 8,
      "par5": 1,
      "par1": 6,
      "par2": 3,
      "par3": 375,
      "par4": 50
    },
    "synergyFormulas": {
      "elemental": "(skill('Royal Strike'.blvl)) * par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Royal Strike",
        "providerId": 280,
        "percentPerLevel": 8,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 280,
        "targetName": "Phoenix Strike",
        "targetNameZh": "凤凰攻击",
        "percentPerLevel": 10
      }
    ],
    "masteries": [
      252
    ],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 12,
        "textaKey": "Eskillbladesofice3",
        "textbKey": "Eskillpowerup3",
        "textaEn": "freeze duration:",
        "textaZh": "冻结时间：",
        "textbEn": "Charge 3 -",
        "textbZh": "聚气 3 段 -",
        "calca": "edln"
      },
      {
        "lineType": 19,
        "textaKey": "Eskillbladesofice2",
        "textbKey": "Eskillpowerup2",
        "textaEn": "cold damage radius:",
        "textaZh": "冰冷伤害范围：",
        "textbEn": "Charge 2 -",
        "textbZh": "聚气 2 段 -",
        "calca": "par1"
      },
      {
        "lineType": 24,
        "textaKey": "Eskillbladesofice1",
        "textbKey": "Eskillpowerup1",
        "textaEn": "cold damage:",
        "textaZh": "冰冷伤害：",
        "textbEn": "Charge 1 -",
        "textbZh": "聚气 1 段 -",
        "calca": "par1"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "adds cold damage to finishing moves\n\nCharge-up Skill",
    "shortDescZh": "为终结技附加冰冷伤害\n\n聚气技能",
    "longDesc": "normal attack to release charges\nmust use a dragon finishing move or\ncan only be used with claw-class weapons\nto finishing moves\nconsecutive hits add cold damage\n\nCharge-up Skill",
    "longDescZh": "连续命中积聚冰冷伤害并附加到终结技上；仅限装备爪类武器时使用，需配合龙系终结技或普通攻击释放聚气",
    "icon": "/skills/icon_274.png",
    "iconActive": "/skills/icon_274_active.png",
    "toHit": 15,
    "toHitLev": 7,
    "auraLenCalc": "par3",
    "startmana": 0
  },
  {
    "id": 275,
    "name": "Dragon Flight",
    "nameZh": "龙翔",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 2,
    "tabName": "Martial Arts",
    "tabNameZh": "武学艺术",
    "row": 5,
    "col": 3,
    "reqlevel": 24,
    "reqskills": [
      270
    ],
    "dependents": [],
    "mana": 15,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 25,
    "descdam": "15",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par7": 27,
      "par1": 100,
      "par2": 25
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [
      252
    ],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 2,
        "textaKey": "Eskillkickdamage",
        "textbKey": "StrSkill23",
        "textaEn": "Kick Damage:",
        "textaZh": "踢击伤害：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "ln12"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "teleport and kick enemies\n\nFinishing Move",
    "shortDescZh": "瞬移并踢击敌人\n\n终结技",
    "longDesc": "adds charged-up bonuses to the kick\nand destroy them with a kick\nteleport to your enemies\n\nFinishing Move",
    "longDescZh": "瞬间传送至敌人身旁并以飞踢将其重创，将聚气加成附加到踢击上\n\n终结技",
    "icon": "/skills/icon_275.png",
    "iconActive": "/skills/icon_275_active.png",
    "toHit": 60,
    "toHitLev": 25,
    "startmana": 0
  },
  {
    "id": 276,
    "name": "Death Sentry",
    "nameZh": "死亡哨卫",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 0,
    "tabName": "Traps",
    "tabNameZh": "陷阱",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      271
    ],
    "dependents": [],
    "mana": 20,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "ltng",
    "eMin": 1,
    "eMax": 50,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      8,
      14,
      22,
      28,
      34
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par8": 12,
      "par1": 5
    },
    "synergyFormulas": {
      "elemental": "(skill('Lightning Sentry'.blvl))*par8"
    },
    "synergiesReceived": [
      {
        "providerName": "Lightning Sentry",
        "providerId": 271,
        "percentPerLevel": 12,
        "type": "elemental"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 251,
        "targetName": "Fire Blast",
        "targetNameZh": "火焰爆震",
        "percentPerLevel": 9
      },
      {
        "targetId": 256,
        "targetName": "Shock Web",
        "targetNameZh": "雷电网",
        "percentPerLevel": 11
      },
      {
        "targetId": 261,
        "targetName": "Charged Bolt Sentry",
        "targetNameZh": "充能弹哨卫",
        "percentPerLevel": 6
      },
      {
        "targetId": 271,
        "targetName": "Lightning Sentry",
        "targetNameZh": "闪电哨卫",
        "percentPerLevel": 12
      },
      {
        "targetId": 272,
        "targetName": "Wake of Inferno",
        "targetNameZh": "地狱火复苏",
        "percentPerLevel": 10
      }
    ],
    "masteries": [],
    "descLines": [
      {
        "lineType": 10
      },
      {
        "lineType": 37,
        "textaKey": "StrSkill18",
        "textaEn": "Radius:",
        "textaZh": "半徑：",
        "calca": "skill('mon death sentry'.par3) + skill('mon death sentry'.par4) * (lvl - 1)"
      }
    ],
    "dsc2Lines": [
      {
        "lineType": 3,
        "textaKey": "ESkillShoots",
        "textbKey": "ESkillTimes",
        "textaEn": "Shoots",
        "textaZh": "发射",
        "textbEn": "Times",
        "textbZh": "次",
        "calca": "par1 + skill('Fire Trauma'.blvl)/3"
      },
      {
        "lineType": 38,
        "textaKey": "Corexpdam",
        "textbKey": "StrSkill46",
        "textaEn": "Corpse Explosion Damage:",
        "textaZh": "屍爆傷害：",
        "textbEn": "percent of corpse Life",
        "textbZh": "%的屍體生命",
        "calca": "skill('mon death sentry'.par1)",
        "calcb": "skill('mon death sentry'.par2)"
      }
    ],
    "minionStats": {
      "code": "deathsentry",
      "minHP": 100,
      "maxHP": 100,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "trap that explodes nearby corpses",
    "shortDescZh": "布置引爆附近尸体的哨卫陷阱",
    "longDesc": "or explodes nearby corpses laying waste to more enemies\ntrap that shoots lightning at your enemies",
    "longDescZh": "向敌人发射闪电束，或引爆附近的怪物尸体造成毁灭性的尸爆伤害",
    "icon": "/skills/icon_276.png",
    "iconActive": "/skills/icon_276_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 277,
    "name": "Blade Shield",
    "nameZh": "刀刃之盾",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 0,
    "tabName": "Traps",
    "tabNameZh": "陷阱",
    "row": 6,
    "col": 3,
    "reqlevel": 30,
    "reqskills": [
      266
    ],
    "dependents": [],
    "mana": 27,
    "lvlmana": 2,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "5",
    "hitshift": 8,
    "srcDamage": 32,
    "minDam": 1,
    "maxDam": 30,
    "minLevDam": [
      5,
      6,
      7,
      7,
      7
    ],
    "maxLevDam": [
      5,
      6,
      7,
      7,
      7
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par1": 500,
      "par2": 125,
      "par3": 25,
      "par4": 6
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      },
      {
        "lineType": 72,
        "textaKey": "WeapDamsk",
        "textaEn": "Weapon Damage",
        "textaZh": "武器傷害",
        "calca": "1",
        "calcb": "4"
      },
      {
        "lineType": 9
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "spinning blades of defense",
    "shortDescZh": "召唤环绕身躯的旋转飞刃护盾",
    "longDesc": "who stray too close\nspinning blades slice enemies",
    "longDescZh": "召唤环绕自身旋转的锋利飞刃，自动切割任何近身的敌人",
    "icon": "/skills/icon_277.png",
    "iconActive": "/skills/icon_277_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln12",
    "startmana": 0
  },
  {
    "id": 278,
    "name": "Venom",
    "nameZh": "毒牙",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 1,
    "tabName": "Shadow Disciplines",
    "tabNameZh": "暗影武艺",
    "row": 6,
    "col": 1,
    "reqlevel": 30,
    "reqskills": [
      267
    ],
    "dependents": [],
    "mana": 12,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "",
    "hitshift": 6,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "pois",
    "eMin": 24,
    "eMax": 32,
    "eMinLev": [
      6,
      8,
      10,
      12,
      14
    ],
    "eMaxLev": [
      6,
      8,
      10,
      12,
      14
    ],
    "eLen": 10,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 0,
      "par5": 0,
      "par1": 3000,
      "par2": 100
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 12,
        "textaKey": "StrSkill20",
        "textaEn": "Duration:",
        "textaZh": "持續：",
        "calca": "ln12"
      },
      {
        "lineType": 14
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "poison your weapon",
    "shortDescZh": "为武器涂抹剧毒，在极短时间内爆发高额毒素伤害",
    "longDesc": "add poison damage to your weapons",
    "longDescZh": "将致命毒素附着于武器之上，令攻击在0.4秒内造成大量毒素伤害",
    "icon": "/skills/icon_278.png",
    "iconActive": "/skills/icon_278_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "auraLenCalc": "ln12",
    "startmana": 0
  },
  {
    "id": 279,
    "name": "Shadow Master",
    "nameZh": "暗影大师",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 1,
    "tabName": "Shadow Disciplines",
    "tabNameZh": "暗影武艺",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      268
    ],
    "dependents": [],
    "mana": 70,
    "lvlmana": 1,
    "minmana": 1,
    "manashift": 7,
    "delay": 150,
    "descdam": "",
    "hitshift": 8,
    "srcDamage": 0,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par6": 3,
      "par5": 24,
      "par1": 15,
      "par2": 40,
      "par3": 5,
      "par4": 90
    },
    "synergyFormulas": {},
    "synergiesReceived": [],
    "synergiesGiven": [],
    "masteries": [],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill54",
        "textbKey": "StrSkill23",
        "textaEn": "Resist All:",
        "textaZh": "全面抵抗：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "((110*(lvl-1))/(lvl+5)*(par4-par3))/100+par3"
      },
      {
        "lineType": 4,
        "textaKey": "StrSkill22",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "calca": "lvl*par2"
      },
      {
        "lineType": 13,
        "calca": "(lvl-1)*par1"
      }
    ],
    "dsc2Lines": [],
    "minionStats": {
      "code": "shadowmaster",
      "minHP": 376,
      "maxHP": 376,
      "minDam": 0,
      "maxDam": 0
    },
    "shortDesc": "summon your shadow",
    "shortDescZh": "召唤精通刺客全系技能的强大暗影分身",
    "longDesc": "to fight by your side\nsummon a powerful shadow of yourself",
    "longDescZh": "召唤强大的暗影大师为你作战，可自主施展全部刺客技能并拥有极高抗性",
    "icon": "/skills/icon_279.png",
    "iconActive": "/skills/icon_279_active.png",
    "toHit": 0,
    "toHitLev": 0,
    "startmana": 0
  },
  {
    "id": 280,
    "name": "Phoenix Strike",
    "nameZh": "凤凰攻击",
    "classCode": "ass",
    "classNameZh": "刺客",
    "tabIndex": 2,
    "tabName": "Martial Arts",
    "tabNameZh": "武学艺术",
    "row": 6,
    "col": 2,
    "reqlevel": 30,
    "reqskills": [
      265,
      274
    ],
    "dependents": [],
    "mana": 4,
    "lvlmana": 0,
    "minmana": 1,
    "manashift": 8,
    "delay": 0,
    "descdam": "18",
    "hitshift": 8,
    "srcDamage": 128,
    "minDam": 0,
    "maxDam": 0,
    "minLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "maxLevDam": [
      0,
      0,
      0,
      0,
      0
    ],
    "eType": "",
    "eMin": 0,
    "eMax": 0,
    "eMinLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eMaxLev": [
      0,
      0,
      0,
      0,
      0
    ],
    "eLen": 0,
    "eLevLen": [
      0,
      0,
      0
    ],
    "params": {
      "par7": 25,
      "par6": 10,
      "par5": 16,
      "par1": 8,
      "par2": 6,
      "par3": 30,
      "par4": 15
    },
    "synergyFormulas": {},
    "synergiesReceived": [
      {
        "providerName": "Fists of Fire",
        "providerId": 259,
        "percentPerLevel": 10,
        "type": "elemental",
        "labelEn": "Fire Damage",
        "labelZh": "火焰伤害"
      },
      {
        "providerName": "Fists of Fire",
        "providerId": 259,
        "percentPerLevel": 6,
        "type": "elemental",
        "labelEn": "Average Fire Damage per Second",
        "labelZh": "平均每秒火焰伤害"
      },
      {
        "providerName": "Claws of Thunder",
        "providerId": 269,
        "percentPerLevel": 13,
        "type": "elemental",
        "labelEn": "Lightning Damage",
        "labelZh": "闪电伤害"
      },
      {
        "providerName": "Blades of Ice",
        "providerId": 274,
        "percentPerLevel": 10,
        "type": "elemental",
        "labelEn": "Cold Damage",
        "labelZh": "冰冷伤害"
      }
    ],
    "synergiesGiven": [
      {
        "targetId": 259,
        "targetName": "Fists of Fire",
        "targetNameZh": "焰拳",
        "percentPerLevel": 12
      },
      {
        "targetId": 269,
        "targetName": "Claws of Thunder",
        "targetNameZh": "雷电爪",
        "percentPerLevel": 8
      },
      {
        "targetId": 274,
        "targetName": "Blades of Ice",
        "targetNameZh": "寒冰刃",
        "percentPerLevel": 8
      }
    ],
    "masteries": [
      252
    ],
    "descLines": [
      {
        "lineType": 2,
        "textaKey": "StrSkill22",
        "textbKey": "StrSkill23",
        "textaEn": "Attack:",
        "textaZh": "攻擊：",
        "textbEn": "percent",
        "textbZh": "百分比",
        "calca": "toht"
      },
      {
        "lineType": 62,
        "textaKey": "Eskillpowerup3",
        "textbKey": "Eskillphoenix3",
        "textaEn": "Charge 3 -",
        "textaZh": "聚气 3 段 -",
        "textbEn": "chaos ice bolt damage:",
        "textbZh": "混沌冰球伤害：",
        "calca": "m3en",
        "calcb": "m3ex"
      },
      {
        "lineType": 62,
        "textaKey": "Eskillpowerup2",
        "textbKey": "Eskillphoenix2",
        "textaEn": "Charge 2 -",
        "textaZh": "聚气 2 段 -",
        "textbEn": "chain lightning damage:",
        "textbZh": "连锁闪电伤害：",
        "calca": "m2en",
        "calcb": "m2ex"
      },
      {
        "lineType": 38,
        "textaKey": "StrSkill83",
        "textbKey": "StrSkill34",
        "textaEn": "Fire Explosion Damage:",
        "textaZh": "火焰爆炸傷害：",
        "textbEn": "per second",
        "textbZh": "每秒",
        "calca": "miss('royalstrikemeteorfire'.edns)*75/256",
        "calcb": "miss('royalstrikemeteorfire'.edxs)*75/256"
      },
      {
        "lineType": 62,
        "textaKey": "Eskillpowerup1",
        "textbKey": "Eskillphoenix1",
        "textaEn": "Charge 1 -",
        "textaZh": "聚气 1 段 -",
        "textbEn": "meteor damage:",
        "textbZh": "陨石伤害：",
        "calca": "m1en",
        "calcb": "m1ex"
      }
    ],
    "dsc2Lines": [],
    "shortDesc": "adds elemental novas to finishing moves\n\nCharge-up Skill",
    "shortDescZh": "武术终极聚气：召唤凤凰的烈焰、闪电与冰霜",
    "longDesc": "normal attack to release charges\nmust use a dragon finishing move or\nadds elemental novas to finishing moves\n\nCharge-up Skill",
    "longDescZh": "1段聚气陨石，2段聚气连锁闪电，3段聚气极寒冰晶",
    "icon": "/skills/icon_280.png",
    "iconActive": "/skills/icon_280_active.png",
    "toHit": 15,
    "toHitLev": 7,
    "auraLenCalc": "375",
    "startmana": 0
  }
])

export const SKILLS_BY_ID: Readonly<Record<number, SkillCatalogEntry>> = Object.freeze(
  SKILLS_CATALOG.reduce<Record<number, SkillCatalogEntry>>((acc, cur) => {
    acc[cur.id] = cur
    return acc
  }, {})
)

export const SKILLS_BY_CLASS: Readonly<Record<CharacterClassCode, readonly SkillCatalogEntry[]>> = Object.freeze({
  ama: SKILLS_CATALOG.filter(s => s.classCode === 'ama'),
  sor: SKILLS_CATALOG.filter(s => s.classCode === 'sor'),
  nec: SKILLS_CATALOG.filter(s => s.classCode === 'nec'),
  pal: SKILLS_CATALOG.filter(s => s.classCode === 'pal'),
  bar: SKILLS_CATALOG.filter(s => s.classCode === 'bar'),
  dru: SKILLS_CATALOG.filter(s => s.classCode === 'dru'),
  ass: SKILLS_CATALOG.filter(s => s.classCode === 'ass'),
})
