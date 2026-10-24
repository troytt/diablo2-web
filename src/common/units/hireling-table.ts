/**
 * Canonical Diablo II v1.13c Hireling data table & stat resolver.
 *
 * Ground Truth References:
 * - `Hireling.txt` / `hireling.bin` (120 rows)
 * - D2Common.dll ordinal 10988 (0x6fd7c9e0) -> Act index resolution
 * - D2Common.dll ordinal 10458 (0x6fd7ccc0) -> 64-bit LCG candidate evaluation
 * - D2Common.dll ordinal 10091 (0x6fd7c9c0) -> Ability description string resolution
 * - D2Common.dll ordinal 11156 (0x6fda32c0) -> Highest level <= mercLevel bracket selection
 * - D2Game.dll 0x6fc68ba0 (D2GAME_MERCS_SetStats_6FC68BA0) -> Hireling level-up stat scaling
 * - D2Game.dll 0x6fc3c4e0 (AIMERC_ChooseSkill_6FC3C4E0) -> Hireling skill chance & level scaling
 * - D2Client.dll 0x6faf9440 -> Candidate dialog line formatting
 *
 * DO NOT EDIT MANUALLY.
 */

import { lookupTbl } from '../formats/tbl.ts'

export interface HirelingSkillEntry {
  readonly slot: 1 | 2 | 3 | 4 | 5 | 6
  readonly skillName: string
  readonly skillId: number
  readonly mode: number
  readonly chance: number
  readonly chancePerLvl: number
  readonly level: number
  readonly lvlPerLvl: number
}

export interface HirelingRecord {
  readonly hireling: string
  readonly subType: string
  readonly id: number
  readonly version: number
  readonly subTypeId: number
  readonly classId: number
  readonly act: number
  readonly difficulty: number
  readonly seller: number
  readonly gold: number
  readonly hireCost: number
  readonly level: number
  readonly expPerLvl: number
  readonly hp: number
  readonly hpPerLvl: number
  readonly defense: number
  readonly defPerLvl: number
  readonly str: number
  readonly strPerLvl: number
  readonly dex: number
  readonly dexPerLvl: number
  readonly ar: number
  readonly arPerLvl: number
  readonly share: number
  readonly dmgMin: number
  readonly dmgMax: number
  readonly dmgPerLvl: number
  readonly resist: number
  readonly resistPerLvl: number
  readonly wType1: string
  readonly wType2: string
  readonly hireDesc: number
  readonly defaultChance: number
  readonly nameFirstKey: string
  readonly nameLastKey: string
  readonly wNameFirstId: number
  readonly wNameLastId: number
  readonly skills: readonly number[]
  readonly skillEntries: readonly HirelingSkillEntry[]
}

export const HIRELING_RECORDS: readonly HirelingRecord[] = [
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Normal",
    "id": 0,
    "version": 0,
    "subTypeId": 0,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 100,
    "hireCost": 100,
    "level": 3,
    "expPerLvl": 100,
    "hp": 45,
    "hpPerLvl": 8,
    "defense": 15,
    "defPerLvl": 6,
    "str": 35,
    "strPerLvl": 10,
    "dex": 45,
    "dexPerLvl": 16,
    "ar": 10,
    "arPerLvl": 10,
    "share": 0,
    "dmgMin": 1,
    "dmgMax": 3,
    "dmgPerLvl": 2,
    "resist": 0,
    "resistPerLvl": 8,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 1,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 25,
        "chancePerLvl": 8,
        "level": 1,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Normal",
    "id": 0,
    "version": 0,
    "subTypeId": 0,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 100,
    "hireCost": 100,
    "level": 25,
    "expPerLvl": 100,
    "hp": 221,
    "hpPerLvl": 13,
    "defense": 147,
    "defPerLvl": 12,
    "str": 63,
    "strPerLvl": 10,
    "dex": 89,
    "dexPerLvl": 16,
    "ar": 230,
    "arPerLvl": 20,
    "share": 1,
    "dmgMin": 7,
    "dmgMax": 9,
    "dmgPerLvl": 4,
    "resist": 44,
    "resistPerLvl": 7,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 8,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 8,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Normal",
    "id": 0,
    "version": 0,
    "subTypeId": 0,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 100,
    "hireCost": 100,
    "level": 49,
    "expPerLvl": 100,
    "hp": 533,
    "hpPerLvl": 25,
    "defense": 435,
    "defPerLvl": 18,
    "str": 93,
    "strPerLvl": 10,
    "dex": 137,
    "dexPerLvl": 16,
    "ar": 710,
    "arPerLvl": 30,
    "share": 2,
    "dmgMin": 19,
    "dmgMax": 21,
    "dmgPerLvl": 6,
    "resist": 86,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Normal",
    "id": 1,
    "version": 0,
    "subTypeId": 1,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 150,
    "hireCost": 150,
    "level": 3,
    "expPerLvl": 105,
    "hp": 45,
    "hpPerLvl": 8,
    "defense": 15,
    "defPerLvl": 6,
    "str": 35,
    "strPerLvl": 10,
    "dex": 45,
    "dexPerLvl": 16,
    "ar": 10,
    "arPerLvl": 10,
    "share": 0,
    "dmgMin": 1,
    "dmgMax": 3,
    "dmgPerLvl": 2,
    "resist": 0,
    "resistPerLvl": 8,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 1,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 25,
        "chancePerLvl": 2,
        "level": 1,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Normal",
    "id": 1,
    "version": 0,
    "subTypeId": 1,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 150,
    "hireCost": 150,
    "level": 25,
    "expPerLvl": 105,
    "hp": 221,
    "hpPerLvl": 12,
    "defense": 147,
    "defPerLvl": 12,
    "str": 63,
    "strPerLvl": 10,
    "dex": 89,
    "dexPerLvl": 16,
    "ar": 230,
    "arPerLvl": 20,
    "share": 1,
    "dmgMin": 7,
    "dmgMax": 9,
    "dmgPerLvl": 4,
    "resist": 44,
    "resistPerLvl": 7,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 8,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 36,
        "chancePerLvl": 0,
        "level": 8,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Normal",
    "id": 1,
    "version": 0,
    "subTypeId": 1,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 150,
    "hireCost": 150,
    "level": 49,
    "expPerLvl": 105,
    "hp": 509,
    "hpPerLvl": 16,
    "defense": 435,
    "defPerLvl": 18,
    "str": 93,
    "strPerLvl": 10,
    "dex": 137,
    "dexPerLvl": 16,
    "ar": 710,
    "arPerLvl": 30,
    "share": 2,
    "dmgMin": 19,
    "dmgMax": 21,
    "dmgPerLvl": 6,
    "resist": 86,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 36,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Nightmare",
    "id": 2,
    "version": 0,
    "subTypeId": 2,
    "classId": 271,
    "act": 1,
    "difficulty": 2,
    "seller": 150,
    "gold": 6000,
    "hireCost": 6000,
    "level": 25,
    "expPerLvl": 110,
    "hp": 199,
    "hpPerLvl": 12,
    "defense": 132,
    "defPerLvl": 12,
    "str": 60,
    "strPerLvl": 10,
    "dex": 84,
    "dexPerLvl": 16,
    "ar": 207,
    "arPerLvl": 20,
    "share": 1,
    "dmgMin": 6,
    "dmgMax": 8,
    "dmgPerLvl": 4,
    "resist": 41,
    "resistPerLvl": 7,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 7,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 7,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Nightmare",
    "id": 2,
    "version": 0,
    "subTypeId": 2,
    "classId": 271,
    "act": 1,
    "difficulty": 2,
    "seller": 150,
    "gold": 6000,
    "hireCost": 6000,
    "level": 49,
    "expPerLvl": 110,
    "hp": 487,
    "hpPerLvl": 16,
    "defense": 420,
    "defPerLvl": 18,
    "str": 90,
    "strPerLvl": 10,
    "dex": 132,
    "dexPerLvl": 16,
    "ar": 687,
    "arPerLvl": 30,
    "share": 2,
    "dmgMin": 18,
    "dmgMax": 20,
    "dmgPerLvl": 6,
    "resist": 83,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Nightmare",
    "id": 3,
    "version": 0,
    "subTypeId": 3,
    "classId": 271,
    "act": 1,
    "difficulty": 2,
    "seller": 150,
    "gold": 7500,
    "hireCost": 7500,
    "level": 25,
    "expPerLvl": 115,
    "hp": 199,
    "hpPerLvl": 12,
    "defense": 132,
    "defPerLvl": 12,
    "str": 60,
    "strPerLvl": 10,
    "dex": 84,
    "dexPerLvl": 16,
    "ar": 207,
    "arPerLvl": 20,
    "share": 1,
    "dmgMin": 6,
    "dmgMax": 8,
    "dmgPerLvl": 4,
    "resist": 41,
    "resistPerLvl": 7,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 7,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 7,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Nightmare",
    "id": 3,
    "version": 0,
    "subTypeId": 3,
    "classId": 271,
    "act": 1,
    "difficulty": 2,
    "seller": 150,
    "gold": 7500,
    "hireCost": 7500,
    "level": 49,
    "expPerLvl": 115,
    "hp": 487,
    "hpPerLvl": 16,
    "defense": 420,
    "defPerLvl": 18,
    "str": 90,
    "strPerLvl": 10,
    "dex": 132,
    "dexPerLvl": 16,
    "ar": 687,
    "arPerLvl": 30,
    "share": 2,
    "dmgMin": 18,
    "dmgMax": 20,
    "dmgPerLvl": 6,
    "resist": 83,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Hell",
    "id": 4,
    "version": 0,
    "subTypeId": 4,
    "classId": 271,
    "act": 1,
    "difficulty": 3,
    "seller": 150,
    "gold": 12500,
    "hireCost": 12500,
    "level": 49,
    "expPerLvl": 120,
    "hp": 438,
    "hpPerLvl": 16,
    "defense": 378,
    "defPerLvl": 18,
    "str": 87,
    "strPerLvl": 10,
    "dex": 127,
    "dexPerLvl": 16,
    "ar": 618,
    "arPerLvl": 30,
    "share": 2,
    "dmgMin": 17,
    "dmgMax": 19,
    "dmgPerLvl": 6,
    "resist": 80,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Hell",
    "id": 5,
    "version": 0,
    "subTypeId": 5,
    "classId": 271,
    "act": 1,
    "difficulty": 3,
    "seller": 150,
    "gold": 14000,
    "hireCost": 14000,
    "level": 49,
    "expPerLvl": 125,
    "hp": 438,
    "hpPerLvl": 16,
    "defense": 378,
    "defPerLvl": 18,
    "str": 87,
    "strPerLvl": 10,
    "dex": 127,
    "dexPerLvl": 16,
    "ar": 618,
    "arPerLvl": 30,
    "share": 2,
    "dmgMin": 17,
    "dmgMax": 19,
    "dmgPerLvl": 6,
    "resist": 80,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Normal",
    "id": 0,
    "version": 100,
    "subTypeId": 0,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 100,
    "hireCost": 100,
    "level": 3,
    "expPerLvl": 100,
    "hp": 45,
    "hpPerLvl": 9,
    "defense": 15,
    "defPerLvl": 8,
    "str": 35,
    "strPerLvl": 10,
    "dex": 45,
    "dexPerLvl": 16,
    "ar": 10,
    "arPerLvl": 12,
    "share": 0,
    "dmgMin": 1,
    "dmgMax": 3,
    "dmgPerLvl": 2,
    "resist": 0,
    "resistPerLvl": 8,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 1,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 25,
        "chancePerLvl": 5,
        "level": 1,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Normal",
    "id": 0,
    "version": 100,
    "subTypeId": 0,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 100,
    "hireCost": 100,
    "level": 36,
    "expPerLvl": 100,
    "hp": 342,
    "hpPerLvl": 18,
    "defense": 279,
    "defPerLvl": 15,
    "str": 77,
    "strPerLvl": 10,
    "dex": 111,
    "dexPerLvl": 16,
    "ar": 406,
    "arPerLvl": 24,
    "share": 1,
    "dmgMin": 9,
    "dmgMax": 11,
    "dmgPerLvl": 4,
    "resist": 66,
    "resistPerLvl": 7,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 12,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 67,
        "chancePerLvl": 0,
        "level": 12,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Normal",
    "id": 0,
    "version": 100,
    "subTypeId": 0,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 100,
    "hireCost": 100,
    "level": 67,
    "expPerLvl": 100,
    "hp": 900,
    "hpPerLvl": 30,
    "defense": 744,
    "defPerLvl": 22,
    "str": 116,
    "strPerLvl": 10,
    "dex": 173,
    "dexPerLvl": 16,
    "ar": 1150,
    "arPerLvl": 36,
    "share": 2,
    "dmgMin": 25,
    "dmgMax": 27,
    "dmgPerLvl": 6,
    "resist": 121,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 22,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 67,
        "chancePerLvl": 0,
        "level": 22,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Normal",
    "id": 1,
    "version": 100,
    "subTypeId": 1,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 150,
    "hireCost": 150,
    "level": 3,
    "expPerLvl": 105,
    "hp": 45,
    "hpPerLvl": 9,
    "defense": 15,
    "defPerLvl": 8,
    "str": 35,
    "strPerLvl": 10,
    "dex": 45,
    "dexPerLvl": 16,
    "ar": 10,
    "arPerLvl": 12,
    "share": 0,
    "dmgMin": 1,
    "dmgMax": 3,
    "dmgPerLvl": 2,
    "resist": 0,
    "resistPerLvl": 8,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 1,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 25,
        "chancePerLvl": 5,
        "level": 1,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Normal",
    "id": 1,
    "version": 100,
    "subTypeId": 1,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 150,
    "hireCost": 150,
    "level": 36,
    "expPerLvl": 105,
    "hp": 342,
    "hpPerLvl": 18,
    "defense": 279,
    "defPerLvl": 15,
    "str": 77,
    "strPerLvl": 10,
    "dex": 111,
    "dexPerLvl": 16,
    "ar": 406,
    "arPerLvl": 24,
    "share": 1,
    "dmgMin": 9,
    "dmgMax": 11,
    "dmgPerLvl": 4,
    "resist": 66,
    "resistPerLvl": 7,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 12,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 67,
        "chancePerLvl": 0,
        "level": 12,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Normal",
    "id": 1,
    "version": 100,
    "subTypeId": 1,
    "classId": 271,
    "act": 1,
    "difficulty": 1,
    "seller": 150,
    "gold": 150,
    "hireCost": 150,
    "level": 67,
    "expPerLvl": 105,
    "hp": 900,
    "hpPerLvl": 30,
    "defense": 744,
    "defPerLvl": 22,
    "str": 116,
    "strPerLvl": 10,
    "dex": 173,
    "dexPerLvl": 16,
    "ar": 1150,
    "arPerLvl": 36,
    "share": 2,
    "dmgMin": 25,
    "dmgMax": 27,
    "dmgPerLvl": 6,
    "resist": 121,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 22,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 67,
        "chancePerLvl": 0,
        "level": 22,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Nightmare",
    "id": 2,
    "version": 100,
    "subTypeId": 2,
    "classId": 271,
    "act": 1,
    "difficulty": 2,
    "seller": 150,
    "gold": 6000,
    "hireCost": 6000,
    "level": 36,
    "expPerLvl": 110,
    "hp": 308,
    "hpPerLvl": 18,
    "defense": 251,
    "defPerLvl": 15,
    "str": 74,
    "strPerLvl": 10,
    "dex": 106,
    "dexPerLvl": 16,
    "ar": 365,
    "arPerLvl": 24,
    "share": 1,
    "dmgMin": 8,
    "dmgMax": 10,
    "dmgPerLvl": 4,
    "resist": 63,
    "resistPerLvl": 7,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Nightmare",
    "id": 2,
    "version": 100,
    "subTypeId": 2,
    "classId": 271,
    "act": 1,
    "difficulty": 2,
    "seller": 150,
    "gold": 6000,
    "hireCost": 6000,
    "level": 67,
    "expPerLvl": 110,
    "hp": 866,
    "hpPerLvl": 30,
    "defense": 716,
    "defPerLvl": 22,
    "str": 113,
    "strPerLvl": 10,
    "dex": 168,
    "dexPerLvl": 16,
    "ar": 1109,
    "arPerLvl": 36,
    "share": 2,
    "dmgMin": 24,
    "dmgMax": 26,
    "dmgPerLvl": 6,
    "resist": 118,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 21,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 21,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Nightmare",
    "id": 3,
    "version": 100,
    "subTypeId": 3,
    "classId": 271,
    "act": 1,
    "difficulty": 2,
    "seller": 150,
    "gold": 7500,
    "hireCost": 7500,
    "level": 36,
    "expPerLvl": 115,
    "hp": 308,
    "hpPerLvl": 18,
    "defense": 251,
    "defPerLvl": 15,
    "str": 74,
    "strPerLvl": 10,
    "dex": 106,
    "dexPerLvl": 16,
    "ar": 365,
    "arPerLvl": 24,
    "share": 1,
    "dmgMin": 8,
    "dmgMax": 10,
    "dmgPerLvl": 4,
    "resist": 63,
    "resistPerLvl": 7,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Nightmare",
    "id": 3,
    "version": 100,
    "subTypeId": 3,
    "classId": 271,
    "act": 1,
    "difficulty": 2,
    "seller": 150,
    "gold": 7500,
    "hireCost": 7500,
    "level": 67,
    "expPerLvl": 115,
    "hp": 866,
    "hpPerLvl": 30,
    "defense": 716,
    "defPerLvl": 22,
    "str": 113,
    "strPerLvl": 10,
    "dex": 168,
    "dexPerLvl": 16,
    "ar": 1109,
    "arPerLvl": 36,
    "share": 2,
    "dmgMin": 24,
    "dmgMax": 26,
    "dmgPerLvl": 6,
    "resist": 118,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 21,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 21,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Fire - Hell",
    "id": 4,
    "version": 100,
    "subTypeId": 4,
    "classId": 271,
    "act": 1,
    "difficulty": 3,
    "seller": 150,
    "gold": 12500,
    "hireCost": 12500,
    "level": 67,
    "expPerLvl": 120,
    "hp": 779,
    "hpPerLvl": 30,
    "defense": 644,
    "defPerLvl": 22,
    "str": 110,
    "strPerLvl": 10,
    "dex": 163,
    "dexPerLvl": 16,
    "ar": 998,
    "arPerLvl": 36,
    "share": 2,
    "dmgMin": 23,
    "dmgMax": 25,
    "dmgPerLvl": 6,
    "resist": 115,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 1,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      7
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 20,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Arrow",
        "skillId": 7,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 20,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Rogue Scout",
    "subType": "Ice - Hell",
    "id": 5,
    "version": 100,
    "subTypeId": 5,
    "classId": 271,
    "act": 1,
    "difficulty": 3,
    "seller": 150,
    "gold": 14000,
    "hireCost": 14000,
    "level": 67,
    "expPerLvl": 125,
    "hp": 779,
    "hpPerLvl": 30,
    "defense": 644,
    "defPerLvl": 22,
    "str": 110,
    "strPerLvl": 10,
    "dex": 163,
    "dexPerLvl": 16,
    "ar": 998,
    "arPerLvl": 36,
    "share": 2,
    "dmgMin": 23,
    "dmgMax": 25,
    "dmgPerLvl": 6,
    "resist": 115,
    "resistPerLvl": 5,
    "wType1": "bow",
    "wType2": "",
    "hireDesc": 2,
    "defaultChance": 75,
    "nameFirstKey": "merc01",
    "nameLastKey": "merc41",
    "wNameFirstId": 3411,
    "wNameLastId": 3451,
    "skills": [
      8,
      11
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inner Sight",
        "skillId": 8,
        "mode": 4,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 20,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Cold Arrow",
        "skillId": 11,
        "mode": 4,
        "chance": 69,
        "chancePerLvl": 0,
        "level": 20,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Normal",
    "id": 6,
    "version": 0,
    "subTypeId": 6,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 9,
    "expPerLvl": 110,
    "hp": 120,
    "hpPerLvl": 10,
    "defense": 45,
    "defPerLvl": 9,
    "str": 57,
    "strPerLvl": 14,
    "dex": 40,
    "dexPerLvl": 12,
    "ar": 20,
    "arPerLvl": 10,
    "share": 1,
    "dmgMin": 7,
    "dmgMax": 14,
    "dmgPerLvl": 4,
    "resist": 18,
    "resistPerLvl": 8,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      99
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 70,
        "chancePerLvl": 4,
        "level": 3,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Prayer",
        "skillId": 99,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Normal",
    "id": 6,
    "version": 0,
    "subTypeId": 6,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 31,
    "expPerLvl": 110,
    "hp": 340,
    "hpPerLvl": 20,
    "defense": 243,
    "defPerLvl": 16,
    "str": 96,
    "strPerLvl": 14,
    "dex": 73,
    "dexPerLvl": 12,
    "ar": 240,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 18,
    "dmgMax": 25,
    "dmgPerLvl": 6,
    "resist": 62,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      99
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 92,
        "chancePerLvl": 4,
        "level": 10,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Prayer",
        "skillId": 99,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 10,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Normal",
    "id": 6,
    "version": 0,
    "subTypeId": 6,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 55,
    "expPerLvl": 110,
    "hp": 820,
    "hpPerLvl": 35,
    "defense": 627,
    "defPerLvl": 24,
    "str": 138,
    "strPerLvl": 14,
    "dex": 109,
    "dexPerLvl": 12,
    "ar": 720,
    "arPerLvl": 30,
    "share": 4,
    "dmgMin": 36,
    "dmgMax": 43,
    "dmgPerLvl": 8,
    "resist": 104,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      99
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 116,
        "chancePerLvl": 4,
        "level": 18,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Prayer",
        "skillId": 99,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 18,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Normal",
    "id": 7,
    "version": 0,
    "subTypeId": 7,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 9,
    "expPerLvl": 110,
    "hp": 120,
    "hpPerLvl": 10,
    "defense": 45,
    "defPerLvl": 9,
    "str": 57,
    "strPerLvl": 14,
    "dex": 40,
    "dexPerLvl": 12,
    "ar": 20,
    "arPerLvl": 10,
    "share": 1,
    "dmgMin": 7,
    "dmgMax": 14,
    "dmgPerLvl": 4,
    "resist": 18,
    "resistPerLvl": 8,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      104
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 70,
        "chancePerLvl": 4,
        "level": 3,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Defiance",
        "skillId": 104,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Normal",
    "id": 7,
    "version": 0,
    "subTypeId": 7,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 31,
    "expPerLvl": 110,
    "hp": 340,
    "hpPerLvl": 20,
    "defense": 243,
    "defPerLvl": 16,
    "str": 96,
    "strPerLvl": 14,
    "dex": 73,
    "dexPerLvl": 12,
    "ar": 240,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 18,
    "dmgMax": 25,
    "dmgPerLvl": 6,
    "resist": 62,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      104
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 92,
        "chancePerLvl": 4,
        "level": 10,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Defiance",
        "skillId": 104,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 10,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Normal",
    "id": 7,
    "version": 0,
    "subTypeId": 7,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 55,
    "expPerLvl": 110,
    "hp": 820,
    "hpPerLvl": 35,
    "defense": 627,
    "defPerLvl": 24,
    "str": 138,
    "strPerLvl": 14,
    "dex": 109,
    "dexPerLvl": 12,
    "ar": 720,
    "arPerLvl": 30,
    "share": 4,
    "dmgMin": 36,
    "dmgMax": 43,
    "dmgPerLvl": 8,
    "resist": 104,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      104
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 116,
        "chancePerLvl": 4,
        "level": 18,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Defiance",
        "skillId": 104,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 18,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Normal",
    "id": 8,
    "version": 0,
    "subTypeId": 8,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 9,
    "expPerLvl": 110,
    "hp": 120,
    "hpPerLvl": 10,
    "defense": 45,
    "defPerLvl": 9,
    "str": 57,
    "strPerLvl": 14,
    "dex": 40,
    "dexPerLvl": 12,
    "ar": 20,
    "arPerLvl": 10,
    "share": 1,
    "dmgMin": 7,
    "dmgMax": 14,
    "dmgPerLvl": 4,
    "resist": 18,
    "resistPerLvl": 8,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      108
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 70,
        "chancePerLvl": 4,
        "level": 3,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Blessed Aim",
        "skillId": 108,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Normal",
    "id": 8,
    "version": 0,
    "subTypeId": 8,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 31,
    "expPerLvl": 110,
    "hp": 340,
    "hpPerLvl": 20,
    "defense": 243,
    "defPerLvl": 16,
    "str": 96,
    "strPerLvl": 14,
    "dex": 73,
    "dexPerLvl": 12,
    "ar": 240,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 18,
    "dmgMax": 25,
    "dmgPerLvl": 6,
    "resist": 62,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      108
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 92,
        "chancePerLvl": 4,
        "level": 10,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Blessed Aim",
        "skillId": 108,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 10,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Normal",
    "id": 8,
    "version": 0,
    "subTypeId": 8,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 55,
    "expPerLvl": 110,
    "hp": 820,
    "hpPerLvl": 35,
    "defense": 627,
    "defPerLvl": 24,
    "str": 138,
    "strPerLvl": 14,
    "dex": 109,
    "dexPerLvl": 12,
    "ar": 720,
    "arPerLvl": 30,
    "share": 4,
    "dmgMin": 36,
    "dmgMax": 43,
    "dmgPerLvl": 8,
    "resist": 104,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      108
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 116,
        "chancePerLvl": 4,
        "level": 18,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Blessed Aim",
        "skillId": 108,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 18,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Nightmare",
    "id": 9,
    "version": 0,
    "subTypeId": 9,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 31,
    "expPerLvl": 120,
    "hp": 306,
    "hpPerLvl": 20,
    "defense": 219,
    "defPerLvl": 16,
    "str": 92,
    "strPerLvl": 14,
    "dex": 69,
    "dexPerLvl": 12,
    "ar": 216,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 16,
    "dmgMax": 23,
    "dmgPerLvl": 6,
    "resist": 59,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      103
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 120,
        "chancePerLvl": 4,
        "level": 9,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Thorns",
        "skillId": 103,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 5,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Nightmare",
    "id": 9,
    "version": 0,
    "subTypeId": 9,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 55,
    "expPerLvl": 120,
    "hp": 786,
    "hpPerLvl": 35,
    "defense": 603,
    "defPerLvl": 24,
    "str": 134,
    "strPerLvl": 14,
    "dex": 105,
    "dexPerLvl": 12,
    "ar": 696,
    "arPerLvl": 30,
    "share": 4,
    "dmgMin": 34,
    "dmgMax": 41,
    "dmgPerLvl": 8,
    "resist": 101,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      103
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 144,
        "chancePerLvl": 4,
        "level": 17,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Thorns",
        "skillId": 103,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 13,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Nightmare",
    "id": 10,
    "version": 0,
    "subTypeId": 10,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 31,
    "expPerLvl": 120,
    "hp": 306,
    "hpPerLvl": 20,
    "defense": 219,
    "defPerLvl": 16,
    "str": 92,
    "strPerLvl": 14,
    "dex": 69,
    "dexPerLvl": 12,
    "ar": 216,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 16,
    "dmgMax": 23,
    "dmgPerLvl": 6,
    "resist": 59,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      114
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 120,
        "chancePerLvl": 4,
        "level": 9,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Holy Freeze",
        "skillId": 114,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 6,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Nightmare",
    "id": 10,
    "version": 0,
    "subTypeId": 10,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 55,
    "expPerLvl": 120,
    "hp": 786,
    "hpPerLvl": 35,
    "defense": 603,
    "defPerLvl": 24,
    "str": 134,
    "strPerLvl": 14,
    "dex": 105,
    "dexPerLvl": 12,
    "ar": 696,
    "arPerLvl": 30,
    "share": 4,
    "dmgMin": 34,
    "dmgMax": 41,
    "dmgPerLvl": 8,
    "resist": 101,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      114
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 144,
        "chancePerLvl": 4,
        "level": 17,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Holy Freeze",
        "skillId": 114,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Nightmare",
    "id": 11,
    "version": 0,
    "subTypeId": 11,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 31,
    "expPerLvl": 120,
    "hp": 306,
    "hpPerLvl": 20,
    "defense": 219,
    "defPerLvl": 16,
    "str": 92,
    "strPerLvl": 14,
    "dex": 69,
    "dexPerLvl": 12,
    "ar": 216,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 16,
    "dmgMax": 23,
    "dmgPerLvl": 6,
    "resist": 59,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      98
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 120,
        "chancePerLvl": 4,
        "level": 9,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Might",
        "skillId": 98,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 7,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Nightmare",
    "id": 11,
    "version": 0,
    "subTypeId": 11,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 55,
    "expPerLvl": 120,
    "hp": 786,
    "hpPerLvl": 35,
    "defense": 603,
    "defPerLvl": 24,
    "str": 134,
    "strPerLvl": 14,
    "dex": 105,
    "dexPerLvl": 12,
    "ar": 696,
    "arPerLvl": 30,
    "share": 4,
    "dmgMin": 34,
    "dmgMax": 41,
    "dmgPerLvl": 8,
    "resist": 101,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      98
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 144,
        "chancePerLvl": 4,
        "level": 17,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Might",
        "skillId": 98,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 13,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Hell",
    "id": 12,
    "version": 0,
    "subTypeId": 12,
    "classId": 338,
    "act": 2,
    "difficulty": 3,
    "seller": 198,
    "gold": 15000,
    "hireCost": 15000,
    "level": 55,
    "expPerLvl": 130,
    "hp": 707,
    "hpPerLvl": 35,
    "defense": 543,
    "defPerLvl": 24,
    "str": 130,
    "strPerLvl": 14,
    "dex": 101,
    "dexPerLvl": 12,
    "ar": 626,
    "arPerLvl": 30,
    "share": 4,
    "dmgMin": 32,
    "dmgMax": 39,
    "dmgPerLvl": 8,
    "resist": 98,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      99
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 104,
        "chancePerLvl": 4,
        "level": 16,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Prayer",
        "skillId": 99,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Hell",
    "id": 13,
    "version": 0,
    "subTypeId": 13,
    "classId": 338,
    "act": 2,
    "difficulty": 3,
    "seller": 198,
    "gold": 15000,
    "hireCost": 15000,
    "level": 55,
    "expPerLvl": 130,
    "hp": 707,
    "hpPerLvl": 35,
    "defense": 543,
    "defPerLvl": 24,
    "str": 130,
    "strPerLvl": 14,
    "dex": 101,
    "dexPerLvl": 12,
    "ar": 626,
    "arPerLvl": 30,
    "share": 4,
    "dmgMin": 32,
    "dmgMax": 39,
    "dmgPerLvl": 8,
    "resist": 98,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      104
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 104,
        "chancePerLvl": 4,
        "level": 16,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Defiance",
        "skillId": 104,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Hell",
    "id": 14,
    "version": 0,
    "subTypeId": 14,
    "classId": 338,
    "act": 2,
    "difficulty": 3,
    "seller": 198,
    "gold": 15000,
    "hireCost": 15000,
    "level": 55,
    "expPerLvl": 130,
    "hp": 707,
    "hpPerLvl": 35,
    "defense": 543,
    "defPerLvl": 24,
    "str": 130,
    "strPerLvl": 14,
    "dex": 101,
    "dexPerLvl": 12,
    "ar": 626,
    "arPerLvl": 30,
    "share": 4,
    "dmgMin": 32,
    "dmgMax": 39,
    "dmgPerLvl": 8,
    "resist": 98,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      108
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 104,
        "chancePerLvl": 4,
        "level": 16,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Blessed Aim",
        "skillId": 108,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Normal",
    "id": 6,
    "version": 100,
    "subTypeId": 6,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 9,
    "expPerLvl": 110,
    "hp": 120,
    "hpPerLvl": 15,
    "defense": 45,
    "defPerLvl": 11,
    "str": 57,
    "strPerLvl": 14,
    "dex": 40,
    "dexPerLvl": 12,
    "ar": 20,
    "arPerLvl": 12,
    "share": 1,
    "dmgMin": 7,
    "dmgMax": 14,
    "dmgPerLvl": 4,
    "resist": 18,
    "resistPerLvl": 8,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      99
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 70,
        "chancePerLvl": 4,
        "level": 3,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Prayer",
        "skillId": 99,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 7
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Normal",
    "id": 6,
    "version": 100,
    "subTypeId": 6,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 43,
    "expPerLvl": 110,
    "hp": 630,
    "hpPerLvl": 25,
    "defense": 419,
    "defPerLvl": 19,
    "str": 117,
    "strPerLvl": 14,
    "dex": 91,
    "dexPerLvl": 12,
    "ar": 428,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 24,
    "dmgMax": 31,
    "dmgPerLvl": 6,
    "resist": 86,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      99
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 104,
        "chancePerLvl": 4,
        "level": 14,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Prayer",
        "skillId": 99,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 7
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Normal",
    "id": 6,
    "version": 100,
    "subTypeId": 6,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 75,
    "expPerLvl": 110,
    "hp": 1430,
    "hpPerLvl": 40,
    "defense": 1027,
    "defPerLvl": 28,
    "str": 173,
    "strPerLvl": 14,
    "dex": 139,
    "dexPerLvl": 12,
    "ar": 1196,
    "arPerLvl": 36,
    "share": 4,
    "dmgMin": 48,
    "dmgMax": 55,
    "dmgPerLvl": 8,
    "resist": 142,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      99
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 136,
        "chancePerLvl": 4,
        "level": 24,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Prayer",
        "skillId": 99,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 18,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Normal",
    "id": 7,
    "version": 100,
    "subTypeId": 7,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 9,
    "expPerLvl": 110,
    "hp": 120,
    "hpPerLvl": 15,
    "defense": 45,
    "defPerLvl": 11,
    "str": 57,
    "strPerLvl": 14,
    "dex": 40,
    "dexPerLvl": 12,
    "ar": 20,
    "arPerLvl": 12,
    "share": 1,
    "dmgMin": 7,
    "dmgMax": 14,
    "dmgPerLvl": 4,
    "resist": 18,
    "resistPerLvl": 8,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      104
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 70,
        "chancePerLvl": 4,
        "level": 3,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Defiance",
        "skillId": 104,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 7
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Normal",
    "id": 7,
    "version": 100,
    "subTypeId": 7,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 43,
    "expPerLvl": 110,
    "hp": 630,
    "hpPerLvl": 25,
    "defense": 419,
    "defPerLvl": 19,
    "str": 117,
    "strPerLvl": 14,
    "dex": 91,
    "dexPerLvl": 12,
    "ar": 428,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 24,
    "dmgMax": 31,
    "dmgPerLvl": 6,
    "resist": 86,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      104
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 104,
        "chancePerLvl": 4,
        "level": 14,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Defiance",
        "skillId": 104,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 7
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Normal",
    "id": 7,
    "version": 100,
    "subTypeId": 7,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 75,
    "expPerLvl": 110,
    "hp": 1430,
    "hpPerLvl": 40,
    "defense": 1027,
    "defPerLvl": 28,
    "str": 173,
    "strPerLvl": 14,
    "dex": 139,
    "dexPerLvl": 12,
    "ar": 1196,
    "arPerLvl": 36,
    "share": 4,
    "dmgMin": 48,
    "dmgMax": 55,
    "dmgPerLvl": 8,
    "resist": 142,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      104
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 136,
        "chancePerLvl": 4,
        "level": 24,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Defiance",
        "skillId": 104,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 18,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Normal",
    "id": 8,
    "version": 100,
    "subTypeId": 8,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 9,
    "expPerLvl": 110,
    "hp": 120,
    "hpPerLvl": 15,
    "defense": 45,
    "defPerLvl": 11,
    "str": 57,
    "strPerLvl": 14,
    "dex": 40,
    "dexPerLvl": 12,
    "ar": 20,
    "arPerLvl": 12,
    "share": 1,
    "dmgMin": 7,
    "dmgMax": 14,
    "dmgPerLvl": 4,
    "resist": 18,
    "resistPerLvl": 8,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      108
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 70,
        "chancePerLvl": 4,
        "level": 3,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Blessed Aim",
        "skillId": 108,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 7
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Normal",
    "id": 8,
    "version": 100,
    "subTypeId": 8,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 43,
    "expPerLvl": 110,
    "hp": 630,
    "hpPerLvl": 25,
    "defense": 419,
    "defPerLvl": 19,
    "str": 117,
    "strPerLvl": 14,
    "dex": 91,
    "dexPerLvl": 12,
    "ar": 428,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 24,
    "dmgMax": 31,
    "dmgPerLvl": 6,
    "resist": 86,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      108
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 104,
        "chancePerLvl": 4,
        "level": 14,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Blessed Aim",
        "skillId": 108,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 7
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Normal",
    "id": 8,
    "version": 100,
    "subTypeId": 8,
    "classId": 338,
    "act": 2,
    "difficulty": 1,
    "seller": 198,
    "gold": 350,
    "hireCost": 350,
    "level": 75,
    "expPerLvl": 110,
    "hp": 1430,
    "hpPerLvl": 40,
    "defense": 1027,
    "defPerLvl": 28,
    "str": 173,
    "strPerLvl": 14,
    "dex": 139,
    "dexPerLvl": 12,
    "ar": 1196,
    "arPerLvl": 36,
    "share": 4,
    "dmgMin": 48,
    "dmgMax": 55,
    "dmgPerLvl": 8,
    "resist": 142,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      108
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 136,
        "chancePerLvl": 4,
        "level": 24,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Blessed Aim",
        "skillId": 108,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 18,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Nightmare",
    "id": 9,
    "version": 100,
    "subTypeId": 9,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 43,
    "expPerLvl": 120,
    "hp": 567,
    "hpPerLvl": 25,
    "defense": 377,
    "defPerLvl": 19,
    "str": 113,
    "strPerLvl": 14,
    "dex": 87,
    "dexPerLvl": 12,
    "ar": 385,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 22,
    "dmgMax": 29,
    "dmgPerLvl": 6,
    "resist": 83,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      103
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 120,
        "chancePerLvl": 4,
        "level": 13,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Thorns",
        "skillId": 103,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 5,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Nightmare",
    "id": 9,
    "version": 100,
    "subTypeId": 9,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 75,
    "expPerLvl": 120,
    "hp": 1367,
    "hpPerLvl": 40,
    "defense": 985,
    "defPerLvl": 28,
    "str": 169,
    "strPerLvl": 14,
    "dex": 135,
    "dexPerLvl": 12,
    "ar": 1153,
    "arPerLvl": 36,
    "share": 4,
    "dmgMin": 46,
    "dmgMax": 53,
    "dmgPerLvl": 8,
    "resist": 139,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      103
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 152,
        "chancePerLvl": 4,
        "level": 23,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Thorns",
        "skillId": 103,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Nightmare",
    "id": 10,
    "version": 100,
    "subTypeId": 10,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 43,
    "expPerLvl": 120,
    "hp": 567,
    "hpPerLvl": 25,
    "defense": 377,
    "defPerLvl": 19,
    "str": 113,
    "strPerLvl": 14,
    "dex": 87,
    "dexPerLvl": 12,
    "ar": 385,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 22,
    "dmgMax": 29,
    "dmgPerLvl": 6,
    "resist": 83,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      114
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 120,
        "chancePerLvl": 4,
        "level": 13,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Holy Freeze",
        "skillId": 114,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 6,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Nightmare",
    "id": 10,
    "version": 100,
    "subTypeId": 10,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 75,
    "expPerLvl": 120,
    "hp": 1367,
    "hpPerLvl": 40,
    "defense": 985,
    "defPerLvl": 28,
    "str": 169,
    "strPerLvl": 14,
    "dex": 135,
    "dexPerLvl": 12,
    "ar": 1153,
    "arPerLvl": 36,
    "share": 4,
    "dmgMin": 46,
    "dmgMax": 53,
    "dmgPerLvl": 8,
    "resist": 139,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      114
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 152,
        "chancePerLvl": 4,
        "level": 23,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Holy Freeze",
        "skillId": 114,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Nightmare",
    "id": 11,
    "version": 100,
    "subTypeId": 11,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 43,
    "expPerLvl": 120,
    "hp": 567,
    "hpPerLvl": 25,
    "defense": 377,
    "defPerLvl": 19,
    "str": 113,
    "strPerLvl": 14,
    "dex": 87,
    "dexPerLvl": 12,
    "ar": 385,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 22,
    "dmgMax": 29,
    "dmgPerLvl": 6,
    "resist": 83,
    "resistPerLvl": 7,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      98
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 120,
        "chancePerLvl": 4,
        "level": 13,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Might",
        "skillId": 98,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 7,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Nightmare",
    "id": 11,
    "version": 100,
    "subTypeId": 11,
    "classId": 338,
    "act": 2,
    "difficulty": 2,
    "seller": 198,
    "gold": 7900,
    "hireCost": 7900,
    "level": 75,
    "expPerLvl": 120,
    "hp": 1367,
    "hpPerLvl": 40,
    "defense": 985,
    "defPerLvl": 28,
    "str": 169,
    "strPerLvl": 14,
    "dex": 135,
    "dexPerLvl": 12,
    "ar": 1153,
    "arPerLvl": 36,
    "share": 4,
    "dmgMin": 46,
    "dmgMax": 53,
    "dmgPerLvl": 8,
    "resist": 139,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      98
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 152,
        "chancePerLvl": 4,
        "level": 23,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Might",
        "skillId": 98,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Comb-Hell",
    "id": 12,
    "version": 100,
    "subTypeId": 12,
    "classId": 338,
    "act": 2,
    "difficulty": 3,
    "seller": 198,
    "gold": 15000,
    "hireCost": 15000,
    "level": 75,
    "expPerLvl": 130,
    "hp": 1230,
    "hpPerLvl": 40,
    "defense": 887,
    "defPerLvl": 28,
    "str": 165,
    "strPerLvl": 14,
    "dex": 131,
    "dexPerLvl": 12,
    "ar": 1038,
    "arPerLvl": 36,
    "share": 4,
    "dmgMin": 44,
    "dmgMax": 51,
    "dmgPerLvl": 8,
    "resist": 136,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 3,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      99
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 104,
        "chancePerLvl": 4,
        "level": 22,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Prayer",
        "skillId": 99,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Def-Hell",
    "id": 13,
    "version": 100,
    "subTypeId": 13,
    "classId": 338,
    "act": 2,
    "difficulty": 3,
    "seller": 198,
    "gold": 15000,
    "hireCost": 15000,
    "level": 75,
    "expPerLvl": 130,
    "hp": 1230,
    "hpPerLvl": 40,
    "defense": 887,
    "defPerLvl": 28,
    "str": 165,
    "strPerLvl": 14,
    "dex": 131,
    "dexPerLvl": 12,
    "ar": 1038,
    "arPerLvl": 36,
    "share": 4,
    "dmgMin": 44,
    "dmgMax": 51,
    "dmgPerLvl": 8,
    "resist": 136,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 4,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      104
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 104,
        "chancePerLvl": 4,
        "level": 22,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Defiance",
        "skillId": 104,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Desert Mercenary",
    "subType": "Off-Hell",
    "id": 14,
    "version": 100,
    "subTypeId": 14,
    "classId": 338,
    "act": 2,
    "difficulty": 3,
    "seller": 198,
    "gold": 15000,
    "hireCost": 15000,
    "level": 75,
    "expPerLvl": 130,
    "hp": 1230,
    "hpPerLvl": 40,
    "defense": 887,
    "defPerLvl": 28,
    "str": 165,
    "strPerLvl": 14,
    "dex": 131,
    "dexPerLvl": 12,
    "ar": 1038,
    "arPerLvl": 36,
    "share": 4,
    "dmgMin": 44,
    "dmgMax": 51,
    "dmgPerLvl": 8,
    "resist": 136,
    "resistPerLvl": 4,
    "wType1": "pole",
    "wType2": "spea",
    "hireDesc": 5,
    "defaultChance": 30,
    "nameFirstKey": "merca201",
    "nameLastKey": "merca221",
    "wNameFirstId": 1019,
    "wNameLastId": 1039,
    "skills": [
      10,
      108
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Jab",
        "skillId": 10,
        "mode": 14,
        "chance": 104,
        "chancePerLvl": 4,
        "level": 22,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Blessed Aim",
        "skillId": 108,
        "mode": 1,
        "chance": 10,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Normal",
    "id": 15,
    "version": 0,
    "subTypeId": 15,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 15,
    "expPerLvl": 110,
    "hp": 160,
    "hpPerLvl": 8,
    "defense": 80,
    "defPerLvl": 4,
    "str": 49,
    "strPerLvl": 10,
    "dex": 40,
    "dexPerLvl": 8,
    "ar": 15,
    "arPerLvl": 10,
    "share": 0,
    "dmgMin": 1,
    "dmgMax": 7,
    "dmgPerLvl": 4,
    "resist": 25,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 6,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 4,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Normal",
    "id": 15,
    "version": 0,
    "subTypeId": 15,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 37,
    "expPerLvl": 110,
    "hp": 336,
    "hpPerLvl": 14,
    "defense": 168,
    "defPerLvl": 10,
    "str": 77,
    "strPerLvl": 10,
    "dex": 62,
    "dexPerLvl": 8,
    "ar": 235,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 12,
    "dmgMax": 18,
    "dmgPerLvl": 4,
    "resist": 64,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 13,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Normal",
    "id": 15,
    "version": 0,
    "subTypeId": 15,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 61,
    "expPerLvl": 110,
    "hp": 672,
    "hpPerLvl": 20,
    "defense": 408,
    "defPerLvl": 18,
    "str": 107,
    "strPerLvl": 10,
    "dex": 86,
    "dexPerLvl": 8,
    "ar": 715,
    "arPerLvl": 30,
    "share": 5,
    "dmgMin": 24,
    "dmgMax": 30,
    "dmgPerLvl": 4,
    "resist": 106,
    "resistPerLvl": 6,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 21,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 19,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Normal",
    "id": 16,
    "version": 0,
    "subTypeId": 16,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1500,
    "hireCost": 1500,
    "level": 15,
    "expPerLvl": 120,
    "hp": 160,
    "hpPerLvl": 8,
    "defense": 80,
    "defPerLvl": 4,
    "str": 49,
    "strPerLvl": 10,
    "dex": 40,
    "dexPerLvl": 8,
    "ar": 15,
    "arPerLvl": 10,
    "share": 0,
    "dmgMin": 1,
    "dmgMax": 7,
    "dmgPerLvl": 4,
    "resist": 25,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 1,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 2,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 6,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Normal",
    "id": 16,
    "version": 0,
    "subTypeId": 16,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1500,
    "hireCost": 1500,
    "level": 37,
    "expPerLvl": 120,
    "hp": 336,
    "hpPerLvl": 14,
    "defense": 168,
    "defPerLvl": 10,
    "str": 77,
    "strPerLvl": 10,
    "dex": 62,
    "dexPerLvl": 8,
    "ar": 235,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 12,
    "dmgMax": 18,
    "dmgPerLvl": 4,
    "resist": 64,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 5,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 9,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 13,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Normal",
    "id": 16,
    "version": 0,
    "subTypeId": 16,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1500,
    "hireCost": 1500,
    "level": 61,
    "expPerLvl": 120,
    "hp": 672,
    "hpPerLvl": 20,
    "defense": 408,
    "defPerLvl": 16,
    "str": 107,
    "strPerLvl": 10,
    "dex": 86,
    "dexPerLvl": 8,
    "ar": 715,
    "arPerLvl": 30,
    "share": 5,
    "dmgMin": 24,
    "dmgMax": 30,
    "dmgPerLvl": 4,
    "resist": 106,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 9,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 17,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 21,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Normal",
    "id": 17,
    "version": 0,
    "subTypeId": 17,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 15,
    "expPerLvl": 110,
    "hp": 160,
    "hpPerLvl": 8,
    "defense": 80,
    "defPerLvl": 4,
    "str": 49,
    "strPerLvl": 10,
    "dex": 40,
    "dexPerLvl": 8,
    "ar": 15,
    "arPerLvl": 10,
    "share": 0,
    "dmgMin": 1,
    "dmgMax": 7,
    "dmgPerLvl": 4,
    "resist": 25,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 4,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Normal",
    "id": 17,
    "version": 0,
    "subTypeId": 17,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 37,
    "expPerLvl": 110,
    "hp": 336,
    "hpPerLvl": 14,
    "defense": 168,
    "defPerLvl": 10,
    "str": 77,
    "strPerLvl": 10,
    "dex": 62,
    "dexPerLvl": 8,
    "ar": 235,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 12,
    "dmgMax": 18,
    "dmgPerLvl": 4,
    "resist": 64,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 8,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 10,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Normal",
    "id": 17,
    "version": 0,
    "subTypeId": 17,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 61,
    "expPerLvl": 110,
    "hp": 672,
    "hpPerLvl": 20,
    "defense": 408,
    "defPerLvl": 16,
    "str": 107,
    "strPerLvl": 10,
    "dex": 86,
    "dexPerLvl": 8,
    "ar": 715,
    "arPerLvl": 30,
    "share": 5,
    "dmgMin": 24,
    "dmgMax": 30,
    "dmgPerLvl": 4,
    "resist": 106,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 12,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 18,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Nightmare",
    "id": 18,
    "version": 0,
    "subTypeId": 18,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 9500,
    "hireCost": 9500,
    "level": 37,
    "expPerLvl": 120,
    "hp": 302,
    "hpPerLvl": 14,
    "defense": 151,
    "defPerLvl": 10,
    "str": 73,
    "strPerLvl": 10,
    "dex": 58,
    "dexPerLvl": 8,
    "ar": 212,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 10,
    "dmgMax": 16,
    "dmgPerLvl": 4,
    "resist": 61,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 12,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 10,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Nightmare",
    "id": 18,
    "version": 0,
    "subTypeId": 18,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 9500,
    "hireCost": 9500,
    "level": 61,
    "expPerLvl": 120,
    "hp": 638,
    "hpPerLvl": 20,
    "defense": 391,
    "defPerLvl": 16,
    "str": 103,
    "strPerLvl": 10,
    "dex": 82,
    "dexPerLvl": 8,
    "ar": 692,
    "arPerLvl": 30,
    "share": 5,
    "dmgMin": 22,
    "dmgMax": 28,
    "dmgPerLvl": 4,
    "resist": 103,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 20,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 18,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Nightmare",
    "id": 19,
    "version": 0,
    "subTypeId": 19,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 12000,
    "hireCost": 12000,
    "level": 37,
    "expPerLvl": 130,
    "hp": 302,
    "hpPerLvl": 14,
    "defense": 151,
    "defPerLvl": 10,
    "str": 73,
    "strPerLvl": 10,
    "dex": 58,
    "dexPerLvl": 8,
    "ar": 212,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 10,
    "dmgMax": 16,
    "dmgPerLvl": 4,
    "resist": 61,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 4,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 8,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 12,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Nightmare",
    "id": 19,
    "version": 0,
    "subTypeId": 19,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 12000,
    "hireCost": 12000,
    "level": 61,
    "expPerLvl": 130,
    "hp": 638,
    "hpPerLvl": 20,
    "defense": 391,
    "defPerLvl": 16,
    "str": 103,
    "strPerLvl": 10,
    "dex": 82,
    "dexPerLvl": 8,
    "ar": 692,
    "arPerLvl": 30,
    "share": 5,
    "dmgMin": 22,
    "dmgMax": 28,
    "dmgPerLvl": 4,
    "resist": 103,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 8,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 20,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Nightmare",
    "id": 20,
    "version": 0,
    "subTypeId": 20,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 10000,
    "hireCost": 10000,
    "level": 37,
    "expPerLvl": 120,
    "hp": 302,
    "hpPerLvl": 14,
    "defense": 151,
    "defPerLvl": 10,
    "str": 73,
    "strPerLvl": 10,
    "dex": 58,
    "dexPerLvl": 8,
    "ar": 212,
    "arPerLvl": 20,
    "share": 3,
    "dmgMin": 10,
    "dmgMax": 16,
    "dmgPerLvl": 4,
    "resist": 61,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 7,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 9,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Nightmare",
    "id": 20,
    "version": 0,
    "subTypeId": 20,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 10000,
    "hireCost": 10000,
    "level": 61,
    "expPerLvl": 120,
    "hp": 638,
    "hpPerLvl": 20,
    "defense": 391,
    "defPerLvl": 16,
    "str": 103,
    "strPerLvl": 10,
    "dex": 82,
    "dexPerLvl": 8,
    "ar": 692,
    "arPerLvl": 30,
    "share": 5,
    "dmgMin": 22,
    "dmgMax": 28,
    "dmgPerLvl": 4,
    "resist": 103,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 17,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Hell",
    "id": 21,
    "version": 0,
    "subTypeId": 21,
    "classId": 359,
    "act": 3,
    "difficulty": 3,
    "seller": 252,
    "gold": 21000,
    "hireCost": 21000,
    "level": 61,
    "expPerLvl": 130,
    "hp": 574,
    "hpPerLvl": 20,
    "defense": 352,
    "defPerLvl": 16,
    "str": 99,
    "strPerLvl": 10,
    "dex": 78,
    "dexPerLvl": 8,
    "ar": 623,
    "arPerLvl": 30,
    "share": 5,
    "dmgMin": 20,
    "dmgMax": 26,
    "dmgPerLvl": 4,
    "resist": 100,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 19,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 17,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Hell",
    "id": 22,
    "version": 0,
    "subTypeId": 22,
    "classId": 359,
    "act": 3,
    "difficulty": 3,
    "seller": 252,
    "gold": 27000,
    "hireCost": 27000,
    "level": 61,
    "expPerLvl": 140,
    "hp": 574,
    "hpPerLvl": 20,
    "defense": 352,
    "defPerLvl": 16,
    "str": 99,
    "strPerLvl": 10,
    "dex": 78,
    "dexPerLvl": 8,
    "ar": 623,
    "arPerLvl": 30,
    "share": 5,
    "dmgMin": 20,
    "dmgMax": 26,
    "dmgPerLvl": 4,
    "resist": 100,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 7,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 19,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Hell",
    "id": 23,
    "version": 0,
    "subTypeId": 23,
    "classId": 359,
    "act": 3,
    "difficulty": 3,
    "seller": 252,
    "gold": 21000,
    "hireCost": 21000,
    "level": 61,
    "expPerLvl": 130,
    "hp": 574,
    "hpPerLvl": 20,
    "defense": 352,
    "defPerLvl": 16,
    "str": 99,
    "strPerLvl": 10,
    "dex": 78,
    "dexPerLvl": 8,
    "ar": 623,
    "arPerLvl": 30,
    "share": 5,
    "dmgMin": 20,
    "dmgMax": 27,
    "dmgPerLvl": 4,
    "resist": 100,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 10,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Normal",
    "id": 15,
    "version": 100,
    "subTypeId": 15,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 15,
    "expPerLvl": 110,
    "hp": 160,
    "hpPerLvl": 9,
    "defense": 80,
    "defPerLvl": 5,
    "str": 49,
    "strPerLvl": 10,
    "dex": 40,
    "dexPerLvl": 8,
    "ar": 15,
    "arPerLvl": 12,
    "share": 0,
    "dmgMin": 1,
    "dmgMax": 7,
    "dmgPerLvl": 4,
    "resist": 25,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 6,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 4,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Normal",
    "id": 15,
    "version": 100,
    "subTypeId": 15,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 49,
    "expPerLvl": 110,
    "hp": 466,
    "hpPerLvl": 18,
    "defense": 250,
    "defPerLvl": 13,
    "str": 92,
    "strPerLvl": 10,
    "dex": 74,
    "dexPerLvl": 8,
    "ar": 423,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 18,
    "dmgMax": 24,
    "dmgPerLvl": 4,
    "resist": 85,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 17,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Normal",
    "id": 15,
    "version": 100,
    "subTypeId": 15,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 79,
    "expPerLvl": 110,
    "hp": 1006,
    "hpPerLvl": 27,
    "defense": 640,
    "defPerLvl": 25,
    "str": 130,
    "strPerLvl": 10,
    "dex": 104,
    "dexPerLvl": 8,
    "ar": 1143,
    "arPerLvl": 36,
    "share": 5,
    "dmgMin": 33,
    "dmgMax": 39,
    "dmgPerLvl": 4,
    "resist": 138,
    "resistPerLvl": 6,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 27,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 25,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Normal",
    "id": 16,
    "version": 100,
    "subTypeId": 16,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1500,
    "hireCost": 1500,
    "level": 15,
    "expPerLvl": 120,
    "hp": 160,
    "hpPerLvl": 9,
    "defense": 80,
    "defPerLvl": 5,
    "str": 49,
    "strPerLvl": 10,
    "dex": 40,
    "dexPerLvl": 8,
    "ar": 15,
    "arPerLvl": 12,
    "share": 0,
    "dmgMin": 1,
    "dmgMax": 7,
    "dmgPerLvl": 4,
    "resist": 25,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 1,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 2,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 6,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Normal",
    "id": 16,
    "version": 100,
    "subTypeId": 16,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1500,
    "hireCost": 1500,
    "level": 49,
    "expPerLvl": 120,
    "hp": 466,
    "hpPerLvl": 18,
    "defense": 250,
    "defPerLvl": 13,
    "str": 92,
    "strPerLvl": 10,
    "dex": 74,
    "dexPerLvl": 8,
    "ar": 423,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 18,
    "dmgMax": 24,
    "dmgPerLvl": 4,
    "resist": 85,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 7,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 13,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 17,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Normal",
    "id": 16,
    "version": 100,
    "subTypeId": 16,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1500,
    "hireCost": 1500,
    "level": 79,
    "expPerLvl": 120,
    "hp": 1006,
    "hpPerLvl": 27,
    "defense": 640,
    "defPerLvl": 25,
    "str": 130,
    "strPerLvl": 10,
    "dex": 104,
    "dexPerLvl": 8,
    "ar": 1143,
    "arPerLvl": 36,
    "share": 5,
    "dmgMin": 33,
    "dmgMax": 39,
    "dmgPerLvl": 4,
    "resist": 138,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 12,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 23,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 27,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Normal",
    "id": 17,
    "version": 100,
    "subTypeId": 17,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 15,
    "expPerLvl": 110,
    "hp": 160,
    "hpPerLvl": 9,
    "defense": 80,
    "defPerLvl": 5,
    "str": 49,
    "strPerLvl": 10,
    "dex": 40,
    "dexPerLvl": 8,
    "ar": 15,
    "arPerLvl": 12,
    "share": 0,
    "dmgMin": 1,
    "dmgMax": 7,
    "dmgPerLvl": 4,
    "resist": 25,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 4,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Normal",
    "id": 17,
    "version": 100,
    "subTypeId": 17,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 49,
    "expPerLvl": 110,
    "hp": 466,
    "hpPerLvl": 18,
    "defense": 250,
    "defPerLvl": 13,
    "str": 92,
    "strPerLvl": 10,
    "dex": 74,
    "dexPerLvl": 8,
    "ar": 423,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 18,
    "dmgMax": 24,
    "dmgPerLvl": 4,
    "resist": 85,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 10,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Normal",
    "id": 17,
    "version": 100,
    "subTypeId": 17,
    "classId": 359,
    "act": 3,
    "difficulty": 1,
    "seller": 252,
    "gold": 1000,
    "hireCost": 1000,
    "level": 79,
    "expPerLvl": 110,
    "hp": 1006,
    "hpPerLvl": 27,
    "defense": 640,
    "defPerLvl": 25,
    "str": 130,
    "strPerLvl": 10,
    "dex": 104,
    "dexPerLvl": 8,
    "ar": 1143,
    "arPerLvl": 36,
    "share": 5,
    "dmgMin": 33,
    "dmgMax": 39,
    "dmgPerLvl": 4,
    "resist": 138,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 24,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Nightmare",
    "id": 18,
    "version": 100,
    "subTypeId": 18,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 9500,
    "hireCost": 9500,
    "level": 49,
    "expPerLvl": 120,
    "hp": 419,
    "hpPerLvl": 18,
    "defense": 225,
    "defPerLvl": 13,
    "str": 88,
    "strPerLvl": 10,
    "dex": 70,
    "dexPerLvl": 8,
    "ar": 381,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 16,
    "dmgMax": 22,
    "dmgPerLvl": 4,
    "resist": 82,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Nightmare",
    "id": 18,
    "version": 100,
    "subTypeId": 18,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 9500,
    "hireCost": 9500,
    "level": 79,
    "expPerLvl": 120,
    "hp": 959,
    "hpPerLvl": 27,
    "defense": 615,
    "defPerLvl": 25,
    "str": 126,
    "strPerLvl": 10,
    "dex": 100,
    "dexPerLvl": 8,
    "ar": 1101,
    "arPerLvl": 36,
    "share": 5,
    "dmgMin": 31,
    "dmgMax": 37,
    "dmgPerLvl": 4,
    "resist": 135,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 26,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 24,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Nightmare",
    "id": 19,
    "version": 100,
    "subTypeId": 19,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 12000,
    "hireCost": 12000,
    "level": 49,
    "expPerLvl": 130,
    "hp": 419,
    "hpPerLvl": 18,
    "defense": 225,
    "defPerLvl": 13,
    "str": 88,
    "strPerLvl": 10,
    "dex": 70,
    "dexPerLvl": 8,
    "ar": 381,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 16,
    "dmgMax": 22,
    "dmgPerLvl": 4,
    "resist": 82,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 6,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 12,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Nightmare",
    "id": 19,
    "version": 100,
    "subTypeId": 19,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 12000,
    "hireCost": 12000,
    "level": 79,
    "expPerLvl": 130,
    "hp": 959,
    "hpPerLvl": 27,
    "defense": 615,
    "defPerLvl": 25,
    "str": 126,
    "strPerLvl": 10,
    "dex": 100,
    "dexPerLvl": 8,
    "ar": 1101,
    "arPerLvl": 36,
    "share": 5,
    "dmgMin": 31,
    "dmgMax": 37,
    "dmgPerLvl": 4,
    "resist": 135,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 22,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 26,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Nightmare",
    "id": 20,
    "version": 100,
    "subTypeId": 20,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 10000,
    "hireCost": 10000,
    "level": 49,
    "expPerLvl": 120,
    "hp": 419,
    "hpPerLvl": 18,
    "defense": 225,
    "defPerLvl": 13,
    "str": 88,
    "strPerLvl": 10,
    "dex": 70,
    "dexPerLvl": 8,
    "ar": 381,
    "arPerLvl": 24,
    "share": 3,
    "dmgMin": 16,
    "dmgMax": 22,
    "dmgPerLvl": 4,
    "resist": 82,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 9,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 13,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Nightmare",
    "id": 20,
    "version": 100,
    "subTypeId": 20,
    "classId": 359,
    "act": 3,
    "difficulty": 2,
    "seller": 252,
    "gold": 10000,
    "hireCost": 10000,
    "level": 79,
    "expPerLvl": 120,
    "hp": 959,
    "hpPerLvl": 27,
    "defense": 615,
    "defPerLvl": 25,
    "str": 126,
    "strPerLvl": 10,
    "dex": 100,
    "dexPerLvl": 8,
    "ar": 1101,
    "arPerLvl": 36,
    "share": 5,
    "dmgMin": 31,
    "dmgMax": 37,
    "dmgPerLvl": 4,
    "resist": 135,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 23,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Fire-Hell",
    "id": 21,
    "version": 100,
    "subTypeId": 21,
    "classId": 359,
    "act": 3,
    "difficulty": 3,
    "seller": 252,
    "gold": 21000,
    "hireCost": 21000,
    "level": 79,
    "expPerLvl": 130,
    "hp": 863,
    "hpPerLvl": 27,
    "defense": 554,
    "defPerLvl": 25,
    "str": 122,
    "strPerLvl": 10,
    "dex": 96,
    "dexPerLvl": 8,
    "ar": 991,
    "arPerLvl": 36,
    "share": 5,
    "dmgMin": 29,
    "dmgMax": 35,
    "dmgPerLvl": 4,
    "resist": 132,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 6,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      41,
      47
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Inferno",
        "skillId": 41,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 25,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Fire Ball",
        "skillId": 47,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 23,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Cold-Hell",
    "id": 22,
    "version": 100,
    "subTypeId": 22,
    "classId": 359,
    "act": 3,
    "difficulty": 3,
    "seller": 252,
    "gold": 27000,
    "hireCost": 27000,
    "level": 79,
    "expPerLvl": 140,
    "hp": 863,
    "hpPerLvl": 27,
    "defense": 554,
    "defPerLvl": 25,
    "str": 122,
    "strPerLvl": 10,
    "dex": 96,
    "dexPerLvl": 8,
    "ar": 991,
    "arPerLvl": 36,
    "share": 5,
    "dmgMin": 29,
    "dmgMax": 35,
    "dmgPerLvl": 4,
    "resist": 132,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 7,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      55,
      40,
      45
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Glacial Spike",
        "skillId": 55,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 10,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Frozen Armor",
        "skillId": 40,
        "mode": 7,
        "chance": 1000,
        "chancePerLvl": 0,
        "level": 21,
        "lvlPerLvl": 10
      },
      {
        "slot": 3,
        "skillName": "Ice Blast",
        "skillId": 45,
        "mode": 7,
        "chance": 240,
        "chancePerLvl": 0,
        "level": 25,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Eastern Sorceror",
    "subType": "Ltng-Hell",
    "id": 23,
    "version": 100,
    "subTypeId": 23,
    "classId": 359,
    "act": 3,
    "difficulty": 3,
    "seller": 252,
    "gold": 21000,
    "hireCost": 21000,
    "level": 79,
    "expPerLvl": 130,
    "hp": 863,
    "hpPerLvl": 27,
    "defense": 554,
    "defPerLvl": 25,
    "str": 122,
    "strPerLvl": 10,
    "dex": 96,
    "dexPerLvl": 8,
    "ar": 991,
    "arPerLvl": 36,
    "share": 5,
    "dmgMin": 29,
    "dmgMax": 36,
    "dmgPerLvl": 4,
    "resist": 132,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "shie",
    "hireDesc": 8,
    "defaultChance": 10,
    "nameFirstKey": "merca222",
    "nameLastKey": "merca241",
    "wNameFirstId": 1040,
    "wNameLastId": 1059,
    "skills": [
      38,
      49
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Charged Bolt",
        "skillId": 38,
        "mode": 7,
        "chance": 60,
        "chancePerLvl": 0,
        "level": 13,
        "lvlPerLvl": 5
      },
      {
        "slot": 2,
        "skillName": "Lightning",
        "skillId": 49,
        "mode": 7,
        "chance": 30,
        "chancePerLvl": 0,
        "level": 22,
        "lvlPerLvl": 10
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 24,
    "version": 0,
    "subTypeId": 24,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 28,
    "expPerLvl": 120,
    "hp": 288,
    "hpPerLvl": 14,
    "defense": 180,
    "defPerLvl": 7,
    "str": 101,
    "strPerLvl": 15,
    "dex": 63,
    "dexPerLvl": 10,
    "ar": 150,
    "arPerLvl": 17,
    "share": 1,
    "dmgMin": 16,
    "dmgMax": 20,
    "dmgPerLvl": 6,
    "resist": 56,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 15,
        "chancePerLvl": 0,
        "level": 4,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 15,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 24,
    "version": 0,
    "subTypeId": 24,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 42,
    "expPerLvl": 120,
    "hp": 484,
    "hpPerLvl": 21,
    "defense": 278,
    "defPerLvl": 20,
    "str": 128,
    "strPerLvl": 15,
    "dex": 81,
    "dexPerLvl": 10,
    "ar": 388,
    "arPerLvl": 27,
    "share": 1,
    "dmgMin": 27,
    "dmgMax": 31,
    "dmgPerLvl": 8,
    "resist": 81,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 9,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 7,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 24,
    "version": 0,
    "subTypeId": 24,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 75,
    "expPerLvl": 120,
    "hp": 1177,
    "hpPerLvl": 35,
    "defense": 938,
    "defPerLvl": 40,
    "str": 190,
    "strPerLvl": 15,
    "dex": 123,
    "dexPerLvl": 10,
    "ar": 1279,
    "arPerLvl": 37,
    "share": 1,
    "dmgMin": 60,
    "dmgMax": 64,
    "dmgPerLvl": 8,
    "resist": 139,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 20,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 25,
    "version": 0,
    "subTypeId": 25,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 28,
    "expPerLvl": 120,
    "hp": 288,
    "hpPerLvl": 14,
    "defense": 180,
    "defPerLvl": 7,
    "str": 101,
    "strPerLvl": 15,
    "dex": 63,
    "dexPerLvl": 10,
    "ar": 150,
    "arPerLvl": 17,
    "share": 1,
    "dmgMin": 16,
    "dmgMax": 20,
    "dmgPerLvl": 6,
    "resist": 56,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 15,
        "chancePerLvl": 0,
        "level": 4,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 15,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 25,
    "version": 0,
    "subTypeId": 25,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 42,
    "expPerLvl": 120,
    "hp": 484,
    "hpPerLvl": 21,
    "defense": 278,
    "defPerLvl": 20,
    "str": 128,
    "strPerLvl": 15,
    "dex": 81,
    "dexPerLvl": 10,
    "ar": 388,
    "arPerLvl": 27,
    "share": 1,
    "dmgMin": 27,
    "dmgMax": 31,
    "dmgPerLvl": 8,
    "resist": 81,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 9,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 7,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 25,
    "version": 0,
    "subTypeId": 25,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 75,
    "expPerLvl": 120,
    "hp": 1177,
    "hpPerLvl": 35,
    "defense": 938,
    "defPerLvl": 40,
    "str": 190,
    "strPerLvl": 15,
    "dex": 123,
    "dexPerLvl": 10,
    "ar": 1279,
    "arPerLvl": 37,
    "share": 1,
    "dmgMin": 60,
    "dmgMax": 64,
    "dmgPerLvl": 8,
    "resist": 139,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 20,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Nightmare",
    "id": 26,
    "version": 0,
    "subTypeId": 26,
    "classId": 561,
    "act": 5,
    "difficulty": 2,
    "seller": 515,
    "gold": 18000,
    "hireCost": 18000,
    "level": 42,
    "expPerLvl": 130,
    "hp": 436,
    "hpPerLvl": 21,
    "defense": 250,
    "defPerLvl": 20,
    "str": 125,
    "strPerLvl": 15,
    "dex": 76,
    "dexPerLvl": 10,
    "ar": 349,
    "arPerLvl": 27,
    "share": 4,
    "dmgMin": 25,
    "dmgMax": 29,
    "dmgPerLvl": 8,
    "resist": 78,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 8,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 6,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Nightmare",
    "id": 26,
    "version": 0,
    "subTypeId": 26,
    "classId": 561,
    "act": 5,
    "difficulty": 2,
    "seller": 515,
    "gold": 18000,
    "hireCost": 18000,
    "level": 75,
    "expPerLvl": 130,
    "hp": 1129,
    "hpPerLvl": 35,
    "defense": 910,
    "defPerLvl": 40,
    "str": 187,
    "strPerLvl": 15,
    "dex": 118,
    "dexPerLvl": 10,
    "ar": 1240,
    "arPerLvl": 37,
    "share": 4,
    "dmgMin": 58,
    "dmgMax": 62,
    "dmgPerLvl": 8,
    "resist": 136,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 19,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Nightmare",
    "id": 27,
    "version": 0,
    "subTypeId": 27,
    "classId": 561,
    "act": 5,
    "difficulty": 2,
    "seller": 515,
    "gold": 18000,
    "hireCost": 18000,
    "level": 42,
    "expPerLvl": 130,
    "hp": 436,
    "hpPerLvl": 21,
    "defense": 250,
    "defPerLvl": 20,
    "str": 125,
    "strPerLvl": 15,
    "dex": 76,
    "dexPerLvl": 10,
    "ar": 349,
    "arPerLvl": 27,
    "share": 4,
    "dmgMin": 25,
    "dmgMax": 29,
    "dmgPerLvl": 8,
    "resist": 78,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 8,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 6,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Nightmare",
    "id": 27,
    "version": 0,
    "subTypeId": 27,
    "classId": 561,
    "act": 5,
    "difficulty": 2,
    "seller": 515,
    "gold": 18000,
    "hireCost": 18000,
    "level": 75,
    "expPerLvl": 130,
    "hp": 1129,
    "hpPerLvl": 35,
    "defense": 910,
    "defPerLvl": 40,
    "str": 187,
    "strPerLvl": 15,
    "dex": 118,
    "dexPerLvl": 10,
    "ar": 1240,
    "arPerLvl": 37,
    "share": 4,
    "dmgMin": 58,
    "dmgMax": 62,
    "dmgPerLvl": 8,
    "resist": 136,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 19,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Hell",
    "id": 28,
    "version": 0,
    "subTypeId": 28,
    "classId": 561,
    "act": 5,
    "difficulty": 3,
    "seller": 515,
    "gold": 32000,
    "hireCost": 32000,
    "level": 75,
    "expPerLvl": 140,
    "hp": 1016,
    "hpPerLvl": 35,
    "defense": 819,
    "defPerLvl": 40,
    "str": 184,
    "strPerLvl": 15,
    "dex": 113,
    "dexPerLvl": 10,
    "ar": 1116,
    "arPerLvl": 37,
    "share": 6,
    "dmgMin": 56,
    "dmgMax": 60,
    "dmgPerLvl": 8,
    "resist": 133,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 70,
        "chancePerLvl": 0,
        "level": 18,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 70,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Hell",
    "id": 29,
    "version": 0,
    "subTypeId": 29,
    "classId": 561,
    "act": 5,
    "difficulty": 3,
    "seller": 515,
    "gold": 32000,
    "hireCost": 32000,
    "level": 75,
    "expPerLvl": 140,
    "hp": 1016,
    "hpPerLvl": 35,
    "defense": 819,
    "defPerLvl": 40,
    "str": 184,
    "strPerLvl": 15,
    "dex": 113,
    "dexPerLvl": 10,
    "ar": 1116,
    "arPerLvl": 37,
    "share": 6,
    "dmgMin": 56,
    "dmgMax": 60,
    "dmgPerLvl": 8,
    "resist": 133,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 70,
        "chancePerLvl": 0,
        "level": 18,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 70,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 24,
    "version": 100,
    "subTypeId": 24,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 28,
    "expPerLvl": 120,
    "hp": 288,
    "hpPerLvl": 18,
    "defense": 180,
    "defPerLvl": 10,
    "str": 101,
    "strPerLvl": 15,
    "dex": 63,
    "dexPerLvl": 10,
    "ar": 150,
    "arPerLvl": 20,
    "share": 1,
    "dmgMin": 16,
    "dmgMax": 20,
    "dmgPerLvl": 6,
    "resist": 56,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 15,
        "chancePerLvl": 0,
        "level": 4,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 15,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 24,
    "version": 100,
    "subTypeId": 24,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 58,
    "expPerLvl": 120,
    "hp": 828,
    "hpPerLvl": 27,
    "defense": 480,
    "defPerLvl": 35,
    "str": 158,
    "strPerLvl": 15,
    "dex": 101,
    "dexPerLvl": 10,
    "ar": 750,
    "arPerLvl": 35,
    "share": 1,
    "dmgMin": 39,
    "dmgMax": 43,
    "dmgPerLvl": 8,
    "resist": 109,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 24,
    "version": 100,
    "subTypeId": 24,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 80,
    "expPerLvl": 120,
    "hp": 1422,
    "hpPerLvl": 45,
    "defense": 1250,
    "defPerLvl": 50,
    "str": 200,
    "strPerLvl": 15,
    "dex": 129,
    "dexPerLvl": 10,
    "ar": 1520,
    "arPerLvl": 45,
    "share": 1,
    "dmgMin": 61,
    "dmgMax": 65,
    "dmgPerLvl": 8,
    "resist": 148,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 21,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 17,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 25,
    "version": 100,
    "subTypeId": 25,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 28,
    "expPerLvl": 120,
    "hp": 288,
    "hpPerLvl": 18,
    "defense": 180,
    "defPerLvl": 10,
    "str": 101,
    "strPerLvl": 15,
    "dex": 63,
    "dexPerLvl": 10,
    "ar": 150,
    "arPerLvl": 20,
    "share": 1,
    "dmgMin": 16,
    "dmgMax": 20,
    "dmgPerLvl": 6,
    "resist": 56,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 15,
        "chancePerLvl": 0,
        "level": 4,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 15,
        "chancePerLvl": 0,
        "level": 3,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 25,
    "version": 100,
    "subTypeId": 25,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 58,
    "expPerLvl": 120,
    "hp": 828,
    "hpPerLvl": 27,
    "defense": 480,
    "defPerLvl": 35,
    "str": 158,
    "strPerLvl": 15,
    "dex": 101,
    "dexPerLvl": 10,
    "ar": 750,
    "arPerLvl": 35,
    "share": 1,
    "dmgMin": 39,
    "dmgMax": 43,
    "dmgPerLvl": 8,
    "resist": 109,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 14,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 11,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Normal",
    "id": 25,
    "version": 100,
    "subTypeId": 25,
    "classId": 561,
    "act": 5,
    "difficulty": 1,
    "seller": 515,
    "gold": 9000,
    "hireCost": 9000,
    "level": 80,
    "expPerLvl": 120,
    "hp": 1422,
    "hpPerLvl": 45,
    "defense": 1250,
    "defPerLvl": 50,
    "str": 200,
    "strPerLvl": 15,
    "dex": 129,
    "dexPerLvl": 10,
    "ar": 1520,
    "arPerLvl": 45,
    "share": 1,
    "dmgMin": 61,
    "dmgMax": 65,
    "dmgPerLvl": 8,
    "resist": 148,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 21,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 17,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Nightmare",
    "id": 26,
    "version": 100,
    "subTypeId": 26,
    "classId": 561,
    "act": 5,
    "difficulty": 2,
    "seller": 515,
    "gold": 18000,
    "hireCost": 18000,
    "level": 58,
    "expPerLvl": 130,
    "hp": 745,
    "hpPerLvl": 27,
    "defense": 432,
    "defPerLvl": 35,
    "str": 155,
    "strPerLvl": 15,
    "dex": 96,
    "dexPerLvl": 10,
    "ar": 675,
    "arPerLvl": 35,
    "share": 4,
    "dmgMin": 37,
    "dmgMax": 41,
    "dmgPerLvl": 8,
    "resist": 106,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 13,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 10,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Nightmare",
    "id": 26,
    "version": 100,
    "subTypeId": 26,
    "classId": 561,
    "act": 5,
    "difficulty": 2,
    "seller": 515,
    "gold": 18000,
    "hireCost": 18000,
    "level": 80,
    "expPerLvl": 130,
    "hp": 1339,
    "hpPerLvl": 45,
    "defense": 1202,
    "defPerLvl": 50,
    "str": 197,
    "strPerLvl": 15,
    "dex": 124,
    "dexPerLvl": 10,
    "ar": 1445,
    "arPerLvl": 45,
    "share": 4,
    "dmgMin": 59,
    "dmgMax": 63,
    "dmgPerLvl": 8,
    "resist": 145,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 20,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Nightmare",
    "id": 27,
    "version": 100,
    "subTypeId": 27,
    "classId": 561,
    "act": 5,
    "difficulty": 2,
    "seller": 515,
    "gold": 18000,
    "hireCost": 18000,
    "level": 58,
    "expPerLvl": 130,
    "hp": 745,
    "hpPerLvl": 27,
    "defense": 432,
    "defPerLvl": 35,
    "str": 155,
    "strPerLvl": 15,
    "dex": 96,
    "dexPerLvl": 10,
    "ar": 675,
    "arPerLvl": 35,
    "share": 4,
    "dmgMin": 37,
    "dmgMax": 41,
    "dmgPerLvl": 8,
    "resist": 106,
    "resistPerLvl": 7,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 13,
        "lvlPerLvl": 10
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 50,
        "chancePerLvl": 0,
        "level": 10,
        "lvlPerLvl": 8
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Nightmare",
    "id": 27,
    "version": 100,
    "subTypeId": 27,
    "classId": 561,
    "act": 5,
    "difficulty": 2,
    "seller": 515,
    "gold": 18000,
    "hireCost": 18000,
    "level": 80,
    "expPerLvl": 130,
    "hp": 1339,
    "hpPerLvl": 45,
    "defense": 1202,
    "defPerLvl": 50,
    "str": 197,
    "strPerLvl": 15,
    "dex": 124,
    "dexPerLvl": 10,
    "ar": 1445,
    "arPerLvl": 45,
    "share": 4,
    "dmgMin": 59,
    "dmgMax": 63,
    "dmgPerLvl": 8,
    "resist": 145,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 20,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 75,
        "chancePerLvl": 0,
        "level": 16,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Hell",
    "id": 28,
    "version": 100,
    "subTypeId": 28,
    "classId": 561,
    "act": 5,
    "difficulty": 3,
    "seller": 515,
    "gold": 32000,
    "hireCost": 32000,
    "level": 80,
    "expPerLvl": 140,
    "hp": 1205,
    "hpPerLvl": 45,
    "defense": 1082,
    "defPerLvl": 50,
    "str": 194,
    "strPerLvl": 15,
    "dex": 119,
    "dexPerLvl": 10,
    "ar": 1301,
    "arPerLvl": 45,
    "share": 6,
    "dmgMin": 57,
    "dmgMax": 61,
    "dmgPerLvl": 8,
    "resist": 142,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 70,
        "chancePerLvl": 0,
        "level": 19,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 70,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 0
      }
    ]
  },
  {
    "hireling": "Barbarian",
    "subType": "1hs-Hell",
    "id": 29,
    "version": 100,
    "subTypeId": 29,
    "classId": 561,
    "act": 5,
    "difficulty": 3,
    "seller": 515,
    "gold": 32000,
    "hireCost": 32000,
    "level": 80,
    "expPerLvl": 140,
    "hp": 1205,
    "hpPerLvl": 45,
    "defense": 1082,
    "defPerLvl": 50,
    "str": 194,
    "strPerLvl": 15,
    "dex": 119,
    "dexPerLvl": 10,
    "ar": 1301,
    "arPerLvl": 45,
    "share": 6,
    "dmgMin": 57,
    "dmgMax": 61,
    "dmgPerLvl": 8,
    "resist": 142,
    "resistPerLvl": 4,
    "wType1": "swor",
    "wType2": "",
    "hireDesc": 0,
    "defaultChance": 50,
    "nameFirstKey": "MercX101",
    "nameLastKey": "MercX167",
    "wNameFirstId": 10835,
    "wNameLastId": 10901,
    "skills": [
      126,
      139
    ],
    "skillEntries": [
      {
        "slot": 1,
        "skillName": "Bash",
        "skillId": 126,
        "mode": 5,
        "chance": 70,
        "chancePerLvl": 0,
        "level": 19,
        "lvlPerLvl": 0
      },
      {
        "slot": 2,
        "skillName": "Stun",
        "skillId": 139,
        "mode": 5,
        "chance": 70,
        "chancePerLvl": 0,
        "level": 15,
        "lvlPerLvl": 0
      }
    ]
  }
]

export interface ResolvedHirelingSkillAtLevel {
  readonly skillId: number
  readonly skillName: string
  readonly mode: number
  readonly chance: number
  readonly effectiveLevel: number
}

export interface ResolvedHirelingStatsAtLevel {
  readonly id: number
  readonly subType: string
  readonly classId: number
  readonly act: number
  readonly difficulty: number
  readonly level: number
  readonly baseRowLevel: number
  readonly hp: number
  readonly defense: number
  readonly str: number
  readonly dex: number
  readonly ar: number
  readonly minDmg: number
  readonly maxDmg: number
  readonly resist: number
  readonly defaultChance: number
  readonly skills: readonly ResolvedHirelingSkillAtLevel[]
  readonly auraSkillId?: number
  readonly auraSkillLevel?: number
  readonly record: HirelingRecord
}

/**
 * Returns all Hireling.txt rows matching a Hireling Id (and expansion/classic version).
 */
export function getHirelingRecordsById(id: number, expansion = true): readonly HirelingRecord[] {
  const version = expansion ? 100 : 0
  return HIRELING_RECORDS.filter((r) => r.version === version && (r.id === id || r.subTypeId === id))
}

/**
 * Resolves a hireling's stats and skill levels at a target mercenary level
 * per D2Common.dll #11156 (0x6fda32c0) bracket selection and
 * D2Game.dll D2GAME_MERCS_SetStats_6FC68BA0 (0x6fc68ba0) + AIMERC_ChooseSkill_6FC3C4E0 (0x6fc3c4e0).
 */
export function resolveHirelingStatsAtLevel(
  hirelingId: number,
  targetLevel: number,
  expansion?: boolean,
): ResolvedHirelingStatsAtLevel | undefined
export function resolveHirelingStatsAtLevel(
  subTypeOrId: number | string,
  act: number,
  difficulty: number,
  mercLevel: number,
  expansion?: boolean,
): ResolvedHirelingStatsAtLevel | undefined
export function resolveHirelingStatsAtLevel(
  subTypeOrId: number | string,
  actOrTargetLevel: number,
  difficultyOrExpansion?: number | boolean,
  maybeMercLevel?: number,
  maybeExpansion = true,
): ResolvedHirelingStatsAtLevel | undefined {
  let candidates: readonly HirelingRecord[]
  let mercLevel: number

  if (typeof difficultyOrExpansion === 'boolean' || difficultyOrExpansion === undefined) {
    // 2/3-arg overload: (hirelingId, targetLevel, expansion?)
    const expansion = difficultyOrExpansion ?? true
    const version = expansion ? 100 : 0
    mercLevel = actOrTargetLevel
    candidates = HIRELING_RECORDS.filter(
      (r) =>
        r.version === version &&
        (typeof subTypeOrId === 'number'
          ? r.id === subTypeOrId || r.subTypeId === subTypeOrId
          : r.subType.toLowerCase() === subTypeOrId.toLowerCase().trim() ||
            r.hireling.toLowerCase() === subTypeOrId.toLowerCase().trim()),
    )
  } else {
    // 4/5-arg overload: (subTypeOrId, act, difficulty, mercLevel, expansion?)
    const act = actOrTargetLevel
    const difficulty = difficultyOrExpansion
    mercLevel = maybeMercLevel ?? 1
    const version = maybeExpansion ? 100 : 0
    const matchesSubType = (r: HirelingRecord): boolean => {
      if (typeof subTypeOrId === 'number') {
        return r.id === subTypeOrId || r.subTypeId === subTypeOrId
      }
      const q = subTypeOrId.toLowerCase().trim()
      const sub = r.subType.toLowerCase()
      const subPrefix = sub.split(/[\s-]+/)[0] ?? sub
      return (
        sub === q ||
        sub.startsWith(q) ||
        (subPrefix.length >= 3 && q.startsWith(subPrefix)) ||
        r.hireling.toLowerCase() === q
      )
    }
    candidates = HIRELING_RECORDS.filter(
      (r) =>
        r.version === version &&
        r.act === act &&
        r.difficulty === difficulty &&
        matchesSubType(r),
    )

    if (candidates.length === 0) {
      candidates = HIRELING_RECORDS.filter(
        (r) => r.version === version && matchesSubType(r),
      )
    }
  }

  if (candidates.length === 0) return undefined

  // Select the row with the highest base level <= mercLevel (or lowest row if mercLevel < all rows)
  let selected = candidates[0]!
  for (const row of candidates) {
    if (row.level <= mercLevel && row.level >= selected.level) {
      selected = row
    }
  }

  const deltaLvl = Math.max(0, mercLevel - selected.level)

  // D2Game.dll 0x6fc68ba0 fixed-point scaling
  const hp = Math.max(40, selected.hp + deltaLvl * selected.hpPerLvl)
  const defense = Math.max(0, selected.defense + deltaLvl * selected.defPerLvl)
  const str = Math.max(10, selected.str + Math.trunc((deltaLvl * selected.strPerLvl) / 8))
  const dex = Math.max(10, selected.dex + Math.trunc((deltaLvl * selected.dexPerLvl) / 8))
  const ar = Math.max(0, selected.ar + deltaLvl * selected.arPerLvl)
  const dmgBonus = Math.trunc((deltaLvl * selected.dmgPerLvl) / 8)
  const minDmg = selected.dmgMin + dmgBonus
  const maxDmg = selected.dmgMax + dmgBonus
  const resist = Math.max(0, selected.resist + Math.trunc((deltaLvl * selected.resistPerLvl) / 4))

  let auraSkillId: number | undefined
  let auraSkillLevel: number | undefined

  const skills: ResolvedHirelingSkillAtLevel[] = selected.skillEntries.map((sk) => {
    const chance = Math.max(0, sk.chance + Math.trunc((deltaLvl * sk.chancePerLvl) / 4))
    const rawLevel = sk.level + Math.trunc((deltaLvl * sk.lvlPerLvl) / 32)
    const effectiveLevel = Math.min(32, Math.max(1, rawLevel))
    if (sk.mode === 1) {
      auraSkillId = sk.skillId
      auraSkillLevel = effectiveLevel
    }
    return {
      skillId: sk.skillId,
      skillName: sk.skillName,
      mode: sk.mode,
      chance,
      effectiveLevel,
    }
  })

  return {
    id: selected.id,
    subType: selected.subType,
    classId: selected.classId,
    act: selected.act,
    difficulty: selected.difficulty,
    level: mercLevel,
    baseRowLevel: selected.level,
    hp,
    defense,
    str,
    dex,
    ar,
    minDmg,
    maxDmg,
    resist,
    defaultChance: selected.defaultChance,
    skills,
    ...(auraSkillId !== undefined ? { auraSkillId } : {}),
    ...(auraSkillLevel !== undefined ? { auraSkillLevel } : {}),
    record: selected,
  }
}

export interface HirelingCandidateDesc {
  readonly mercId: number
  readonly nameId: number
  readonly seed: number
  readonly actIndex: number
  readonly classId: number
  readonly subTypeId: number
  readonly name: string
  readonly level: number
  readonly hp: number
  readonly defense: number
  readonly strength: number
  readonly dexterity: number
  readonly cost: number
  readonly resist: number
  readonly hireDescId: number
  readonly hireDesc: string
  readonly skills: readonly number[]
  readonly line1: string
  readonly line2: string
  readonly record?: any | undefined
}

/**
 * Maps a mercenary name ID to their act index (0..3) per D2Common.dll ordinal 10988 (0x6fd7c9e0).
 */
export function resolveHirelingAct(wMercName: number, expansion = true): number {
  const version = expansion ? 100 : 0
  for (const r of HIRELING_RECORDS) {
    if (r.version === version && r.wNameFirstId <= wMercName && wMercName <= r.wNameLastId) {
      return r.act - 1
    }
  }
  // Fallbacks by known name ranges
  if (wMercName >= 3411 && wMercName <= 3451) return 0
  if (wMercName >= 1019 && wMercName <= 1039) return 1
  if (wMercName >= 1040 && wMercName <= 1059) return 2
  if (wMercName === 11021 || wMercName === 0x0421) return 2
  if (wMercName >= 10835 && wMercName <= 10901) return 4
  return 0
}

/**
 * Resolves a mercenary name string from their TBL index or (mercType, nameId) per D2Client.dll 0x6faf9783.
 */
export function resolveHirelingName(
  mercTypeOrNameId: number,
  nameIdOrLang?: number | 'ENG' | 'CHI',
  maybeLang: 'ENG' | 'CHI' = 'CHI',
): string {
  let wMercName: number
  let lang: 'ENG' | 'CHI'

  if (typeof nameIdOrLang === 'number') {
    const mercType = mercTypeOrNameId
    const nameId = nameIdOrLang
    lang = maybeLang

    if (nameId >= 1000) {
      wMercName = nameId
    } else {
      if (mercType === 0 || mercType === 271) {
        wMercName = 3411 + nameId
      } else if (mercType === 1 || mercType === 338) {
        wMercName = 1019 + nameId
      } else if (mercType === 2 || mercType === 359) {
        wMercName = 1040 + nameId
      } else if (mercType === 3 || mercType === 4 || mercType === 561) {
        wMercName = 10835 + nameId
      } else {
        wMercName = nameId
      }
    }
  } else {
    wMercName = mercTypeOrNameId
    lang = nameIdOrLang ?? 'CHI'
  }

  // D2Client.dll 0x6faf978c: if wMercName == 0x0421 (1057), replace with 0x2b0d (11021 = "Jarulf")
  const resolvedNameId = wMercName === 0x0421 ? 0x2b0d : wMercName

  if (resolvedNameId === 0x2b0d) {
    return lookupTbl('merca239', lang) ?? (lang === 'ENG' ? 'Jarulf' : '賈魯夫')
  }

  // Act 1 Rogue (string.tbl 3411..3444 -> merc01..merc34)
  if (resolvedNameId >= 3411 && resolvedNameId <= 3451) {
    const idx = resolvedNameId - 3411 + 1
    const key = `merc${idx < 10 ? `0${idx}` : idx}`
    return lookupTbl(key, lang) ?? (lang === 'ENG' ? `Rogue #${idx}` : `羅格 #${idx}`)
  }

  // Act 2 Desert Mercenary (patchstring.tbl 1019..1039 -> merca201..merca221)
  if (resolvedNameId >= 1019 && resolvedNameId <= 1039) {
    const idx = resolvedNameId - 1019 + 1
    const key = `merca2${idx < 10 ? `0${idx}` : idx}`
    return lookupTbl(key, lang) ?? (lang === 'ENG' ? `Desert Mercenary #${idx}` : `沙漠傭兵 #${idx}`)
  }

  // Act 3 Iron Wolf (patchstring.tbl 1040..1059 -> merca222..merca241)
  if (resolvedNameId >= 1040 && resolvedNameId <= 1059) {
    const idx = resolvedNameId - 1040 + 22
    const key = `merca2${idx}`
    return lookupTbl(key, lang) ?? (lang === 'ENG' ? `Iron Wolf #${idx}` : `鐵狼 #${idx}`)
  }

  // Act 5 Barbarian (patchstring.tbl 835..901 / global 10835..10901 -> MercX101..MercX167)
  const barbId = resolvedNameId >= 10000 ? resolvedNameId - 10000 : resolvedNameId
  if (barbId >= 835 && barbId <= 901) {
    const idx = barbId - 835 + 101
    const key = `MercX${idx}`
    return lookupTbl(key, lang) ?? (lang === 'ENG' ? `Barbarian #${idx}` : `野蠻人 #${idx}`)
  }

  return lookupTbl(`merc${resolvedNameId}`, lang) ?? `Mercenary #${resolvedNameId}`
}

/**
 * Resolves the hireling ability description string per D2Common.dll ordinal 10091 (0x6fd7c9c0).
 */
export function resolveHirelingDesc(hireDescId: number, lang: 'ENG' | 'CHI' = 'CHI'): string {
  switch (hireDescId) {
    case 1:
      return lookupTbl('strhirespecial1', lang) ?? (lang === 'ENG' ? 'Fire Arrow' : '火箭')
    case 2:
      return lookupTbl('strhirespecial2', lang) ?? (lang === 'ENG' ? 'Cold Arrow' : '冰箭')
    case 3:
      return lookupTbl('PalMercEXST4X', lang) ?? (lang === 'ENG' ? 'Combat' : '戰鬥')
    case 4:
      return lookupTbl('PalMercExST1X', lang) ?? (lang === 'ENG' ? 'Defensive' : '防禦')
    case 5:
      return lookupTbl('PalMercEXST3X', lang) ?? (lang === 'ENG' ? 'Offensive' : '進攻')
    case 6:
      return lookupTbl('strhirespecial7', lang) ?? (lang === 'ENG' ? 'Fire' : '火')
    case 7:
      return lookupTbl('strhirespecial6', lang) ?? (lang === 'ENG' ? 'Cold' : '冷')
    case 8:
      return lookupTbl('strhirespecial5', lang) ?? (lang === 'ENG' ? 'Lightning' : '閃電')
    default:
      return ''
  }
}

/**
 * Formats a candidate into 2 lines for the scrollable list control per D2Client.dll 0x6faf9440.
 */
export function formatHirelingCandidateLines(
  name: string,
  level: number,
  hp: number,
  defense: number,
  cost: number,
  hireDesc: string,
  lang: 'ENG' | 'CHI' = 'CHI',
): { line1: string; line2: string } {
  const lvlLabel = lookupTbl('Level', lang) ?? (lang === 'ENG' ? 'Lvl' : '等級')
  const lifeLabel = lookupTbl('HP', lang) ?? (lang === 'ENG' ? 'Life' : '生命')
  const defLabel = lookupTbl('AC', lang) ?? (lang === 'ENG' ? 'Def' : '防禦')
  const costLabel = lookupTbl('Cost', lang) ?? (lang === 'ENG' ? 'Cost' : '花費')

  const line1 = `${name} - ${lvlLabel}: ${level}  ${lifeLabel}: ${hp}  ${defLabel}: ${defense}  ${costLabel}: ${cost}`
  const line2 = hireDesc ? `  ${hireDesc}` : '  '

  return { line1, line2 }
}

/**
 * Evaluates a candidate's authentic stats, level, and hire cost using Diablo II's 64-bit LCG
 * per D2Common.dll ordinal 10458 (0x6fd7ccc0).
 * Also supports direct (act: 1|2|3|5, difficulty: 1|2|3, subTypeIndex: number, targetLevel: number, expansion?: boolean) lookup.
 */
export function resolveHirelingCandidate(
  candidate: { readonly nameId: number; readonly seed: number },
  playerLevel: number,
  difficulty: number,
  actIndex: number,
  expansion?: boolean,
  lang?: 'ENG' | 'CHI',
): HirelingCandidateDesc
export function resolveHirelingCandidate(
  act: 1 | 2 | 3 | 5,
  difficulty: 1 | 2 | 3,
  subTypeIndex: number,
  targetLevel: number,
  expansion?: boolean,
): HirelingRecord | undefined
export function resolveHirelingCandidate(
  candidateOrAct: { readonly nameId: number; readonly seed: number } | (1 | 2 | 3 | 5),
  playerLevelOrDifficulty: number,
  difficultyOrSubTypeIndex: number,
  actIndexOrTargetLevel: number,
  expansion = true,
  lang: 'ENG' | 'CHI' = 'CHI',
): HirelingCandidateDesc | HirelingRecord | undefined {
  const version = expansion ? 100 : 0

  if (typeof candidateOrAct === 'number') {
    const act = candidateOrAct
    const difficulty = playerLevelOrDifficulty
    const subTypeIndex = difficultyOrSubTypeIndex
    const targetLevel = actIndexOrTargetLevel
    const matching = HIRELING_RECORDS.filter(
      (r) => r.version === version && r.act === act && r.difficulty === difficulty,
    )
    if (matching.length === 0) return undefined
    const distinctIds: number[] = []
    for (const r of matching) {
      if (!distinctIds.includes(r.subTypeId)) distinctIds.push(r.subTypeId)
    }
    const targetSubTypeId = distinctIds[subTypeIndex % distinctIds.length]!
    const subRows = matching.filter((r) => r.subTypeId === targetSubTypeId)
    let selected = subRows[0]!
    for (const r of subRows) {
      if (r.level <= targetLevel && r.level >= selected.level) {
        selected = r
      }
    }
    return selected
  }

  const candidate = candidateOrAct
  const playerLevel = playerLevelOrDifficulty
  const difficulty = difficultyOrSubTypeIndex
  const actIndex = actIndexOrTargetLevel
  const targetAct = actIndex + 1
  const targetDiff = difficulty + 1

  // 1. Collect all base rows matching (version, act, difficulty) per 0x6fda3050
  const actDiffRows = HIRELING_RECORDS.filter(
    (r) => r.version === version && r.act === targetAct && r.difficulty === targetDiff,
  )

  let matchingRows = actDiffRows
  if (actDiffRows.length > 0) {
    const baseLevel = actDiffRows[0]!.level
    const levelFiltered = actDiffRows.filter((r) => r.level === baseLevel)
    if (levelFiltered.length > 0) {
      matchingRows = levelFiltered
    }
  }

  if (matchingRows.length === 0) {
    matchingRows = HIRELING_RECORDS.filter((r) => r.act === targetAct)
  }
  if (matchingRows.length === 0) {
    matchingRows = [HIRELING_RECORDS[0]!]
  }

  // 2. D2Common 64-bit LCG simulation (0x6fd7cd20..0x6fd7cd95)
  let seedLo = candidate.seed >>> 0
  let seedHi = 0x29a // 666

  // Step 1: Subtype / row selection
  const step1 = BigInt(seedLo) * 0x6ac690c5n + BigInt(seedHi)
  seedLo = Number(step1 & 0xffffffffn) >>> 0
  seedHi = Number((step1 >> 32n) & 0xffffffffn) >>> 0

  const rowCount = matchingRows.length
  const isPowerOfTwo = (rowCount & (rowCount - 1)) === 0
  const rowIndex = isPowerOfTwo ? (seedLo & (rowCount - 1)) : (seedLo % rowCount)
  const pRow = matchingRows[rowIndex] ?? matchingRows[0]!

  // Step 2: Level selection
  const step2 = BigInt(seedLo) * 0x6ac690c5n + BigInt(seedHi)
  const seedLo2 = Number(step2 & 0xffffffffn) >>> 0
  const levelOffset = (seedLo2 >>> 0) % 5

  const effPlayerLevel = Math.max(1, playerLevel)
  const mercLevel = Math.max(2, effPlayerLevel + levelOffset - 5)
  const levelDelta = mercLevel - pRow.level

  // Step 3: Compute exact stats
  const hp = Math.max(40, pRow.hp + levelDelta * pRow.hpPerLvl)
  const defense = Math.max(0, pRow.defense + levelDelta * pRow.defPerLvl)
  const strength = Math.max(10, pRow.str + ((levelDelta * pRow.strPerLvl) >> 3))
  const dexterity = Math.max(10, pRow.dex + ((levelDelta * pRow.dexPerLvl) >> 3))
  const cost = Math.max(
    pRow.hireCost,
    Math.trunc((pRow.hireCost * (100 + 15 * levelDelta)) / 100),
  )
  const resist = Math.max(0, pRow.resist + Math.trunc((levelDelta * pRow.resistPerLvl) / 4))

  const name = resolveHirelingName(candidate.nameId, lang)
  const hireDesc = resolveHirelingDesc(pRow.hireDesc, lang)
  const { line1, line2 } = formatHirelingCandidateLines(
    name,
    mercLevel,
    hp,
    defense,
    cost,
    hireDesc,
    lang,
  )

  return {
    mercId: candidate.nameId,
    nameId: candidate.nameId,
    seed: candidate.seed,
    actIndex,
    classId: pRow.classId,
    subTypeId: pRow.subTypeId,
    name,
    level: mercLevel,
    hp,
    defense,
    strength,
    dexterity,
    cost,
    resist,
    hireDescId: pRow.hireDesc,
    hireDesc,
    skills: pRow.skills,
    line1,
    line2,
    record: { ...pRow, hcIdx: pRow.classId },
  }
}

/**
 * Resolves a list of candidates from raw { nameId, seed } pairs.
 */
export function resolveHirelingCandidates(
  candidates: readonly { readonly nameId: number; readonly seed: number }[],
  playerLevel: number,
  difficulty: number,
  actIndex: number,
  expansion = true,
  lang: 'ENG' | 'CHI' = 'CHI',
): readonly HirelingCandidateDesc[] {
  return candidates.map((c) =>
    resolveHirelingCandidate(c, playerLevel, difficulty, actIndex, expansion, lang),
  )
}
