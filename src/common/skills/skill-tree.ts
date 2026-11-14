/**
 * Canonical 210-Skill Tree System, Prerequisite DAG, and Synergy Engine for Diablo II (v1.13c).
 *
 * Ground truth reference:
 * - D2Common.dll (0x6fd70000)
 * - data\global\excel\Skills.txt (357 rows, IDs 6..35, 36..65, 66..95, 96..125, 126..155, 221..250, 251..280)
 * - data\global\excel\SkillDesc.txt (221 rows, grid placement and tabs)
 * - docs\d2kb\kb_440_Skills.txt.txt (synergy math, DmgSymPerCalc, EDmgSymPerCalc, ELenSymPerCalc)
 * - docs\d2kb\kb_371_Formulae_Guide_by_Xeno_and_Kingpin.txt (blvl base points invariant)
 */

import type { CharacterClassCode } from '../units/classes.ts'
import type { D2Table } from '../world/acts.ts'
import { cell } from '../world/acts.ts'

export type { CharacterClassCode }

/** Canonical node representing a single skill in the skill tree. */
export interface SkillNode {
  readonly id: number
  readonly name: string
  readonly classCode: CharacterClassCode
  readonly tabIndex: number // 0..2
  readonly tabName: string
  readonly row: number // 1..6
  readonly col: number // 1..3
  readonly reqlevel: number
  readonly reqskills: readonly number[]
  readonly dependents: readonly number[]
  readonly synergyFormulas: {
    readonly physical?: string | undefined
    readonly elemental?: string | undefined
    readonly duration?: string | undefined
  }
  readonly params?: {
    readonly par8?: number | undefined
    readonly par7?: number | undefined
    readonly par6?: number | undefined
    readonly par5?: number | undefined
  } | undefined
}

/** State tracking invested hard points and unspent skill points for a character. */
export interface SkillTreeState {
  readonly hardPoints: Record<number, number> // skillId -> 0..20 hard points (blvl)
  unspentPoints: number
}

/** Skill tree catalog: array, record, or map of skill nodes. */
export type SkillTreeCatalog =
  | readonly SkillNode[]
  | Record<number, SkillNode>
  | Map<number, SkillNode>
  | ReadonlyMap<number, SkillNode>

/** Canonical Skill Tabs per class (3 tabs each). */
export const CANONICAL_SKILL_TABS: Readonly<Record<CharacterClassCode, readonly string[]>> = Object.freeze({
  ama: ['Bow and Crossbow Skills', 'Passive and Magic Skills', 'Javelin and Spear Skills'],
  sor: ['Fire Spells', 'Lightning Spells', 'Cold Spells'],
  nec: ['Curses', 'Poison and Bone Spells', 'Summoning Spells'],
  pal: ['Combat Skills', 'Offensive Auras', 'Defensive Auras'],
  bar: ['Combat Skills', 'Combat Masteries', 'Warcries'],
  dru: ['Summoning', 'Shape Shifting', 'Elemental'],
  ass: ['Traps', 'Shadow Disciplines', 'Martial Arts'],
})

/** Canonical synergy parameters (par8, par7, par6, par5) from 1.13c Skills.txt. */
export const CANONICAL_SKILL_PARAMS: Readonly<Record<number, {
  readonly par8?: number
  readonly par7?: number
  readonly par6?: number
  readonly par5?: number
}>> = Object.freeze({
  "7": {
    "par8": 12
  },
  "8": {
    "par6": 0,
    "par5": 20
  },
  "11": {
    "par8": 12
  },
  "14": {
    "par8": 10
  },
  "15": {
    "par8": 12
  },
  "16": {
    "par8": 12
  },
  "17": {
    "par6": 0,
    "par5": 20
  },
  "19": {
    "par6": 50,
    "par5": 1
  },
  "20": {
    "par8": 3
  },
  "21": {
    "par8": 8,
    "par7": 5
  },
  "24": {
    "par8": 10
  },
  "25": {
    "par8": 10
  },
  "26": {
    "par6": 50,
    "par5": 35
  },
  "27": {
    "par8": 10
  },
  "28": {
    "par7": 4
  },
  "31": {
    "par8": 12,
    "par7": 5
  },
  "32": {
    "par8": 20,
    "par7": 2,
    "par6": 3,
    "par5": 25
  },
  "34": {
    "par8": 8
  },
  "35": {
    "par8": 1
  },
  "36": {
    "par8": 16
  },
  "38": {
    "par8": 6
  },
  "39": {
    "par8": 15
  },
  "40": {
    "par8": 5,
    "par7": 250,
    "par6": 3,
    "par5": 30
  },
  "41": {
    "par8": 13
  },
  "44": {
    "par8": 10
  },
  "45": {
    "par8": 8,
    "par7": 10
  },
  "46": {
    "par8": 4,
    "par7": 1
  },
  "47": {
    "par8": 14
  },
  "49": {
    "par8": 8
  },
  "50": {
    "par8": 9,
    "par7": 250
  },
  "51": {
    "par8": 4,
    "par7": 1
  },
  "52": {
    "par8": 9
  },
  "53": {
    "par8": 4,
    "par5": 5
  },
  "55": {
    "par8": 5,
    "par7": 3
  },
  "56": {
    "par8": 5
  },
  "57": {
    "par7": 17,
    "par6": 100,
    "par5": 0
  },
  "58": {
    "par5": 32
  },
  "59": {
    "par8": 5
  },
  "60": {
    "par8": 7,
    "par7": 250
  },
  "62": {
    "par8": 3
  },
  "64": {
    "par8": 2
  },
  "66": {
    "par5": 100
  },
  "67": {
    "par8": 15
  },
  "68": {
    "par8": 15
  },
  "70": {
    "par5": 15
  },
  "72": {
    "par5": 33
  },
  "73": {
    "par8": 20
  },
  "74": {
    "par5": 50
  },
  "75": {
    "par8": 20
  },
  "76": {
    "par6": 25,
    "par5": 200
  },
  "77": {
    "par6": 2,
    "par5": 24
  },
  "78": {
    "par8": 10
  },
  "79": {
    "par6": 25,
    "par5": 25
  },
  "80": {
    "par5": 10
  },
  "82": {
    "par6": 0,
    "par5": 50
  },
  "83": {
    "par8": 15
  },
  "84": {
    "par8": 7
  },
  "85": {
    "par8": 5,
    "par6": 25,
    "par5": 0
  },
  "87": {
    "par5": -50
  },
  "88": {
    "par8": 8
  },
  "90": {
    "par8": 35
  },
  "91": {
    "par6": 70,
    "par5": 25
  },
  "92": {
    "par8": 10
  },
  "93": {
    "par8": 6
  },
  "94": {
    "par8": 6,
    "par6": 1,
    "par5": 8
  },
  "95": {
    "par5": 50
  },
  "96": {
    "par8": 15,
    "par7": 5
  },
  "101": {
    "par8": 50,
    "par7": 15
  },
  "102": {
    "par8": 18,
    "par7": 6,
    "par5": 6
  },
  "104": {
    "par6": 0,
    "par5": 0
  },
  "105": {
    "par6": 0,
    "par5": 0
  },
  "106": {
    "par8": 12,
    "par6": 5,
    "par5": 2
  },
  "107": {
    "par8": 20,
    "par6": 0,
    "par5": 2
  },
  "108": {
    "par8": 5,
    "par6": 0,
    "par5": 0
  },
  "109": {
    "par6": 0,
    "par5": 0
  },
  "110": {
    "par6": 0,
    "par5": 0
  },
  "111": {
    "par8": 10,
    "par7": 2,
    "par6": 0,
    "par5": 0
  },
  "112": {
    "par8": 14,
    "par6": 0,
    "par5": 0
  },
  "113": {
    "par6": 0,
    "par5": 20
  },
  "114": {
    "par8": 15,
    "par7": 7,
    "par6": 0,
    "par5": 5
  },
  "115": {
    "par6": 50,
    "par5": 7
  },
  "116": {
    "par6": 0,
    "par5": 0
  },
  "117": {
    "par8": 15,
    "par6": 40,
    "par5": 10
  },
  "118": {
    "par8": 12,
    "par7": 4,
    "par6": 0,
    "par5": 6
  },
  "119": {
    "par8": 7,
    "par6": 50,
    "par5": 100
  },
  "120": {
    "par6": 0,
    "par5": 0
  },
  "121": {
    "par8": 7,
    "par6": 2,
    "par5": 6
  },
  "122": {
    "par6": 17,
    "par5": 50
  },
  "123": {
    "par6": 100,
    "par5": 40
  },
  "124": {
    "par6": 5,
    "par5": 25
  },
  "126": {
    "par8": 5,
    "par7": 5
  },
  "127": {
    "par6": 35,
    "par5": 0
  },
  "128": {
    "par6": 35,
    "par5": 0
  },
  "129": {
    "par6": 35,
    "par5": 0
  },
  "130": {
    "par6": 25,
    "par5": 75
  },
  "133": {
    "par8": 10,
    "par5": 50
  },
  "134": {
    "par6": 35,
    "par5": 0
  },
  "135": {
    "par6": 35,
    "par5": 0
  },
  "136": {
    "par6": 35,
    "par5": 0
  },
  "138": {
    "par8": 125
  },
  "139": {
    "par8": 8,
    "par7": 5,
    "par6": 5
  },
  "140": {
    "par8": 8
  },
  "143": {
    "par8": 10,
    "par6": 2,
    "par5": 4
  },
  "144": {
    "par8": 5,
    "par7": 10
  },
  "146": {
    "par6": -1,
    "par5": -25
  },
  "147": {
    "par8": 8,
    "par7": 150,
    "par6": 50,
    "par5": 0
  },
  "149": {
    "par8": 125
  },
  "150": {
    "par6": 60,
    "par5": 10
  },
  "152": {
    "par8": 10,
    "par5": 0
  },
  "154": {
    "par8": 6
  },
  "155": {
    "par8": 125
  },
  "221": {
    "par6": 1,
    "par5": 12
  },
  "222": {
    "par6": 0,
    "par5": 0
  },
  "223": {
    "par6": 0,
    "par5": 0
  },
  "224": {
    "par6": 0,
    "par5": 0
  },
  "225": {
    "par8": 23,
    "par6": 0,
    "par5": 0
  },
  "226": {
    "par8": 2,
    "par7": 30,
    "par6": 0,
    "par5": 0
  },
  "227": {
    "par8": 5,
    "par7": 0,
    "par6": 10,
    "par5": 50
  },
  "228": {
    "par5": 75
  },
  "229": {
    "par8": 8,
    "par7": 10
  },
  "230": {
    "par8": 15
  },
  "231": {
    "par6": 12,
    "par5": 3
  },
  "232": {
    "par8": 3,
    "par7": 2,
    "par6": 5,
    "par5": 50
  },
  "233": {
    "par8": 3,
    "par7": 2,
    "par6": 100,
    "par5": 10
  },
  "234": {
    "par8": 12
  },
  "235": {
    "par8": 7
  },
  "236": {
    "par8": 2,
    "par7": 30,
    "par6": 7,
    "par5": 20
  },
  "237": {
    "par8": 5,
    "par7": 0,
    "par6": 4,
    "par5": 100
  },
  "238": {
    "par8": 18
  },
  "239": {
    "par8": 22
  },
  "240": {
    "par8": 10
  },
  "241": {
    "par6": 8,
    "par5": 1
  },
  "242": {
    "par5": -75
  },
  "243": {
    "par8": 5
  },
  "244": {
    "par8": 12,
    "par7": 12
  },
  "245": {
    "par8": 9
  },
  "246": {
    "par8": 2,
    "par7": 30
  },
  "247": {
    "par8": 5,
    "par7": 0
  },
  "248": {
    "par6": 5,
    "par5": 2
  },
  "249": {
    "par8": 14,
    "par7": 50
  },
  "250": {
    "par8": 9,
    "par7": 50
  },
  "251": {
    "par8": 9
  },
  "252": {
    "par6": 25,
    "par5": 0
  },
  "253": {
    "par6": 99,
    "par5": 25
  },
  "255": {
    "par6": 99,
    "par5": 25
  },
  "256": {
    "par8": 11
  },
  "258": {
    "par6": 300,
    "par5": 3000
  },
  "259": {
    "par8": 12
  },
  "260": {
    "par8": 4
  },
  "261": {
    "par8": 6
  },
  "262": {
    "par8": 8
  },
  "264": {
    "par8": 3,
    "par7": 10,
    "par6": 3,
    "par5": 15
  },
  "267": {
    "par8": 1,
    "par7": 1,
    "par6": 300,
    "par5": 3000
  },
  "268": {
    "par6": 2,
    "par5": 18
  },
  "269": {
    "par8": 8
  },
  "271": {
    "par8": 12
  },
  "272": {
    "par8": 7,
    "par7": 10
  },
  "273": {
    "par7": 4,
    "par6": 40,
    "par5": 15
  },
  "274": {
    "par8": 8,
    "par5": 1
  },
  "275": {
    "par7": 27
  },
  "276": {
    "par8": 12
  },
  "278": {
    "par6": 0,
    "par5": 0
  },
  "279": {
    "par6": 3,
    "par5": 24
  },
  "280": {
    "par7": 25,
    "par6": 10,
    "par5": 16
  }
})

/** Canonical 210 skills tree catalog embedded for hermetic zero-IO execution. */
export const CANONICAL_SKILL_TREE: readonly SkillNode[] = Object.freeze([
  Object.freeze({
    id: 6,
    name: "Magic Arrow",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Bow and Crossbow Skills",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([12]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 7,
    name: "Fire Arrow",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Bow and Crossbow Skills",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([16]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Exploding Arrow'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":12}),
  }),
  Object.freeze({
    id: 8,
    name: "Inner Sight",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Passive and Magic Skills",
    row: 1,
    col: 1,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([17]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":20}),
  }),
  Object.freeze({
    id: 9,
    name: "Critical Strike",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Passive and Magic Skills",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([23]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 10,
    name: "Jab",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Javelin and Spear Skills",
    row: 1,
    col: 1,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([14,19]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 11,
    name: "Cold Arrow",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Bow and Crossbow Skills",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([21,22]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Ice Arrow'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":12}),
  }),
  Object.freeze({
    id: 12,
    name: "Multiple Shot",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Bow and Crossbow Skills",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([6]),
    dependents: Object.freeze([16,22]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 13,
    name: "Dodge",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Passive and Magic Skills",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([18]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 14,
    name: "Power Strike",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Javelin and Spear Skills",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([10]),
    dependents: Object.freeze([24]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Lightning Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Charged Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":10}),
  }),
  Object.freeze({
    id: 15,
    name: "Poison Javelin",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Javelin and Spear Skills",
    row: 2,
    col: 3,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([20]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Plague Javelin'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":12}),
  }),
  Object.freeze({
    id: 16,
    name: "Exploding Arrow",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Bow and Crossbow Skills",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([7,12]),
    dependents: Object.freeze([27]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Fire Arrow'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":12}),
  }),
  Object.freeze({
    id: 17,
    name: "Slow Missiles",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Passive and Magic Skills",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([8]),
    dependents: Object.freeze([28]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":20}),
  }),
  Object.freeze({
    id: 18,
    name: "Avoid",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Passive and Magic Skills",
    row: 3,
    col: 2,
    reqlevel: 12,
    reqskills: Object.freeze([13]),
    dependents: Object.freeze([29]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 19,
    name: "Impale",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Javelin and Spear Skills",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([10]),
    dependents: Object.freeze([30]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":50,"par5":1}),
  }),
  Object.freeze({
    id: 20,
    name: "Lightning Bolt",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Javelin and Spear Skills",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([15]),
    dependents: Object.freeze([24,25]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Lightning Strike'.blvl)+skill('Power Strike'.blvl)+skill('Charged Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":3}),
  }),
  Object.freeze({
    id: 21,
    name: "Ice Arrow",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Bow and Crossbow Skills",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([11]),
    dependents: Object.freeze([31]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Cold Arrow'.blvl))*par8",
      duration: "(skill('Freezing Arrow'.blvl)) * par7",
    }),
    params: Object.freeze({"par8":8,"par7":5}),
  }),
  Object.freeze({
    id: 22,
    name: "Guided Arrow",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Bow and Crossbow Skills",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([11,12]),
    dependents: Object.freeze([26]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 23,
    name: "Penetrate",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Passive and Magic Skills",
    row: 4,
    col: 3,
    reqlevel: 18,
    reqskills: Object.freeze([9]),
    dependents: Object.freeze([33]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 24,
    name: "Charged Strike",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Javelin and Spear Skills",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([14,20]),
    dependents: Object.freeze([34]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Lightning Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Power Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":10}),
  }),
  Object.freeze({
    id: 25,
    name: "Plague Javelin",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Javelin and Spear Skills",
    row: 4,
    col: 3,
    reqlevel: 18,
    reqskills: Object.freeze([20]),
    dependents: Object.freeze([35]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Poison Javelin'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":10}),
  }),
  Object.freeze({
    id: 26,
    name: "Strafe",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Bow and Crossbow Skills",
    row: 5,
    col: 2,
    reqlevel: 24,
    reqskills: Object.freeze([22]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":50,"par5":35}),
  }),
  Object.freeze({
    id: 27,
    name: "Immolation Arrow",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Bow and Crossbow Skills",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([16]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Exploding Arrow'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":10}),
  }),
  Object.freeze({
    id: 28,
    name: "Dopplezon",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Passive and Magic Skills",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([17]),
    dependents: Object.freeze([32]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par7":4}),
  }),
  Object.freeze({
    id: 29,
    name: "Evade",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Passive and Magic Skills",
    row: 5,
    col: 2,
    reqlevel: 24,
    reqskills: Object.freeze([18]),
    dependents: Object.freeze([32]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 30,
    name: "Fend",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Javelin and Spear Skills",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([19]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 31,
    name: "Freezing Arrow",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Bow and Crossbow Skills",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([21]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Cold Arrow'.blvl))*par8",
      duration: "(skill('Ice Arrow'.blvl)) * par7",
    }),
    params: Object.freeze({"par8":12,"par7":5}),
  }),
  Object.freeze({
    id: 32,
    name: "Valkyrie",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Passive and Magic Skills",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([28,29]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":20,"par7":2,"par6":3,"par5":25}),
  }),
  Object.freeze({
    id: 33,
    name: "Pierce",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Passive and Magic Skills",
    row: 6,
    col: 3,
    reqlevel: 30,
    reqskills: Object.freeze([23]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 34,
    name: "Lightning Strike",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Javelin and Spear Skills",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([24]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Charged Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Power Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":8}),
  }),
  Object.freeze({
    id: 35,
    name: "Lightning Fury",
    classCode: "ama" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Javelin and Spear Skills",
    row: 6,
    col: 3,
    reqlevel: 30,
    reqskills: Object.freeze([25]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Charged Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Power Strike'.blvl)+skill('Lightning Strike'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":1}),
  }),
  Object.freeze({
    id: 36,
    name: "Fire Bolt",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Fire Spells",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([47]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Fire Ball'.blvl)+skill('Meteor'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":16}),
  }),
  Object.freeze({
    id: 37,
    name: "Warmth",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Fire Spells",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([52]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 38,
    name: "Charged Bolt",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Lightning Spells",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([49]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Lightning'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":6}),
  }),
  Object.freeze({
    id: 39,
    name: "Ice Bolt",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Cold Spells",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([45]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Frost Nova'.blvl)+skill('Ice Blast'.blvl)+skill('Glacial Spike'.blvl)+skill('Blizzard'.blvl)+skill('Frozen Orb'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":15}),
  }),
  Object.freeze({
    id: 40,
    name: "Frozen Armor",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Cold Spells",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([50]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":5,"par7":250,"par6":3,"par5":30}),
  }),
  Object.freeze({
    id: 41,
    name: "Inferno",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Fire Spells",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([46]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Warmth'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":13}),
  }),
  Object.freeze({
    id: 42,
    name: "Static Field",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Lightning Spells",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([48]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 43,
    name: "Telekinesis",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Lightning Spells",
    row: 2,
    col: 3,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([54]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 44,
    name: "Frost Nova",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Cold Spells",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([59]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Blizzard'.blvl)+skill('Frozen Orb'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":10}),
  }),
  Object.freeze({
    id: 45,
    name: "Ice Blast",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Cold Spells",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([39]),
    dependents: Object.freeze([50,55]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Ice Bolt'.blvl)+skill('Blizzard'.blvl)+skill('Frozen Orb'.blvl))*par8",
      duration: "(skill('Glacial Spike'.blvl))*par7",
    }),
    params: Object.freeze({"par8":8,"par7":10}),
  }),
  Object.freeze({
    id: 46,
    name: "Blaze",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Fire Spells",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([41]),
    dependents: Object.freeze([51]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "skill('Warmth'.blvl)*par8+skill('Fire Wall'.blvl)*par7",
      duration: undefined,
    }),
    params: Object.freeze({"par8":4,"par7":1}),
  }),
  Object.freeze({
    id: 47,
    name: "Fire Ball",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Fire Spells",
    row: 3,
    col: 2,
    reqlevel: 12,
    reqskills: Object.freeze([36]),
    dependents: Object.freeze([52,56]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Fire Bolt'.blvl)+skill('Meteor'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":14}),
  }),
  Object.freeze({
    id: 48,
    name: "Nova",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Lightning Spells",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([42]),
    dependents: Object.freeze([57]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 49,
    name: "Lightning",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Lightning Spells",
    row: 3,
    col: 2,
    reqlevel: 12,
    reqskills: Object.freeze([38]),
    dependents: Object.freeze([53]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Charged Bolt'.blvl)+skill('Chain Lightning'.blvl)+skill('Nova'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":8}),
  }),
  Object.freeze({
    id: 50,
    name: "Shiver Armor",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Cold Spells",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([45,40]),
    dependents: Object.freeze([60]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Frozen Armor'.blvl)+skill('Chilling Armor'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":9,"par7":250}),
  }),
  Object.freeze({
    id: 51,
    name: "Fire Wall",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Fire Spells",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([46]),
    dependents: Object.freeze([56]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Warmth'.blvl)*par8+skill('Inferno'.blvl)*par7",
      duration: undefined,
    }),
    params: Object.freeze({"par8":4,"par7":1}),
  }),
  Object.freeze({
    id: 52,
    name: "Enchant",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Fire Spells",
    row: 4,
    col: 3,
    reqlevel: 18,
    reqskills: Object.freeze([37,47]),
    dependents: Object.freeze([62]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Warmth'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":9}),
  }),
  Object.freeze({
    id: 53,
    name: "Chain Lightning",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Lightning Spells",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([49]),
    dependents: Object.freeze([57,58]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Charged Bolt'.blvl)+skill('Lightning'.blvl)+skill('Nova'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":4,"par5":5}),
  }),
  Object.freeze({
    id: 54,
    name: "Teleport",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Lightning Spells",
    row: 4,
    col: 3,
    reqlevel: 18,
    reqskills: Object.freeze([43]),
    dependents: Object.freeze([58]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 55,
    name: "Glacial Spike",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Cold Spells",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([45]),
    dependents: Object.freeze([59]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Ice Bolt'.blvl)+skill('Ice Blast'.blvl)+skill('Frozen Orb'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":5,"par7":3}),
  }),
  Object.freeze({
    id: 56,
    name: "Meteor",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Fire Spells",
    row: 5,
    col: 2,
    reqlevel: 24,
    reqskills: Object.freeze([47,51]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Fire Bolt'.blvl)+skill('Fire Ball'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":5}),
  }),
  Object.freeze({
    id: 57,
    name: "Thunder Storm",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Lightning Spells",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([48,53]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par7":17,"par6":100,"par5":0}),
  }),
  Object.freeze({
    id: 58,
    name: "Energy Shield",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Lightning Spells",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([54,53]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par5":32}),
  }),
  Object.freeze({
    id: 59,
    name: "Blizzard",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Cold Spells",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([44,55]),
    dependents: Object.freeze([64]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Ice Bolt'.blvl)+skill('Ice Blast'.blvl)+skill('Glacial Spike'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":5}),
  }),
  Object.freeze({
    id: 60,
    name: "Chilling Armor",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Cold Spells",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([50]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Frozen Armor'.blvl)+skill('Shiver Armor'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":7,"par7":250}),
  }),
  Object.freeze({
    id: 61,
    name: "Fire Mastery",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Fire Spells",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 62,
    name: "Hydra",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Fire Spells",
    row: 6,
    col: 3,
    reqlevel: 30,
    reqskills: Object.freeze([52]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Fire Bolt'.blvl) + skill('Fire Ball'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":3}),
  }),
  Object.freeze({
    id: 63,
    name: "Lightning Mastery",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Lightning Spells",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 64,
    name: "Frozen Orb",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Cold Spells",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([59]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Ice Bolt'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":2}),
  }),
  Object.freeze({
    id: 65,
    name: "Cold Mastery",
    classCode: "sor" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Cold Spells",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 66,
    name: "Amplify Damage",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Curses",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([72,76]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par5":100}),
  }),
  Object.freeze({
    id: 67,
    name: "Teeth",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Poison and Bone Spells",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([74]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Bone Wall'.blvl)+skill('Bone Prison'.blvl)+skill('Bone Spear'.blvl)+skill('Bone Spirit'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":15}),
  }),
  Object.freeze({
    id: 68,
    name: "Bone Armor",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Poison and Bone Spells",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([78]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":15}),
  }),
  Object.freeze({
    id: 69,
    name: "Skeleton Mastery",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Summoning Spells",
    row: 1,
    col: 1,
    reqlevel: 1,
    reqskills: Object.freeze([70]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 70,
    name: "Raise Skeleton",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Summoning Spells",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([69,80]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par5":15}),
  }),
  Object.freeze({
    id: 71,
    name: "Dim Vision",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Curses",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([81]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 72,
    name: "Weaken",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Curses",
    row: 2,
    col: 3,
    reqlevel: 6,
    reqskills: Object.freeze([66]),
    dependents: Object.freeze([77]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par5":33}),
  }),
  Object.freeze({
    id: 73,
    name: "Poison Dagger",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Poison and Bone Spells",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([83]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Poison Explosion'.blvl)+skill('Poison Nova'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":20}),
  }),
  Object.freeze({
    id: 74,
    name: "Corpse Explosion",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Poison and Bone Spells",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([67]),
    dependents: Object.freeze([83,84]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par5":50}),
  }),
  Object.freeze({
    id: 75,
    name: "Clay Golem",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Summoning Spells",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([79,85]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":20}),
  }),
  Object.freeze({
    id: 76,
    name: "Iron Maiden",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Curses",
    row: 3,
    col: 2,
    reqlevel: 12,
    reqskills: Object.freeze([66]),
    dependents: Object.freeze([82]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":25,"par5":200}),
  }),
  Object.freeze({
    id: 77,
    name: "Terror",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Curses",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([72]),
    dependents: Object.freeze([87]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":2,"par5":24}),
  }),
  Object.freeze({
    id: 78,
    name: "Bone Wall",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Poison and Bone Spells",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([68]),
    dependents: Object.freeze([88]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":10}),
  }),
  Object.freeze({
    id: 79,
    name: "Golem Mastery",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Summoning Spells",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([75]),
    dependents: Object.freeze([89]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":25,"par5":25}),
  }),
  Object.freeze({
    id: 80,
    name: "Raise Skeletal Mage",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Summoning Spells",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([70]),
    dependents: Object.freeze([95]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par5":10}),
  }),
  Object.freeze({
    id: 81,
    name: "Confuse",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Curses",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([71]),
    dependents: Object.freeze([86]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 82,
    name: "Life Tap",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Curses",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([76]),
    dependents: Object.freeze([91]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":50}),
  }),
  Object.freeze({
    id: 83,
    name: "Poison Explosion",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Poison and Bone Spells",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([73,74]),
    dependents: Object.freeze([92]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Poison Dagger'.blvl)+skill('Poison Nova'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":15}),
  }),
  Object.freeze({
    id: 84,
    name: "Bone Spear",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Poison and Bone Spells",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([74]),
    dependents: Object.freeze([88,93]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Bone Wall'.blvl)+skill('Bone Prison'.blvl)+skill('Teeth'.blvl)+skill('Bone Spirit'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":7}),
  }),
  Object.freeze({
    id: 85,
    name: "BloodGolem",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Summoning Spells",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([75]),
    dependents: Object.freeze([90]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":5,"par6":25,"par5":0}),
  }),
  Object.freeze({
    id: 86,
    name: "Attract",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Curses",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([81]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 87,
    name: "Decrepify",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Curses",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([77]),
    dependents: Object.freeze([91]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par5":-50}),
  }),
  Object.freeze({
    id: 88,
    name: "Bone Prison",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Poison and Bone Spells",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([78,84]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":8}),
  }),
  Object.freeze({
    id: 89,
    name: "Summon Resist",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Summoning Spells",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([79]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 90,
    name: "IronGolem",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Summoning Spells",
    row: 5,
    col: 2,
    reqlevel: 24,
    reqskills: Object.freeze([85]),
    dependents: Object.freeze([94,95]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":35}),
  }),
  Object.freeze({
    id: 91,
    name: "Lower Resist",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Curses",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([82,87]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":70,"par5":25}),
  }),
  Object.freeze({
    id: 92,
    name: "Poison Nova",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Poison and Bone Spells",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([83]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Poison Dagger'.blvl)+skill('Poison Explosion'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":10}),
  }),
  Object.freeze({
    id: 93,
    name: "Bone Spirit",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Poison and Bone Spells",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([84]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Bone Wall'.blvl)+skill('Bone Prison'.blvl)+skill('Teeth'.blvl)+skill('Bone Spear'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":6}),
  }),
  Object.freeze({
    id: 94,
    name: "FireGolem",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Summoning Spells",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([90]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":6,"par6":1,"par5":8}),
  }),
  Object.freeze({
    id: 95,
    name: "Revive",
    classCode: "nec" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Summoning Spells",
    row: 6,
    col: 3,
    reqlevel: 30,
    reqskills: Object.freeze([80,90]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par5":50}),
  }),
  Object.freeze({
    id: 96,
    name: "Sacrifice",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 1,
    col: 1,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([106]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":15,"par7":5}),
  }),
  Object.freeze({
    id: 97,
    name: "Smite",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([107]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 98,
    name: "Might",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Offensive Auras",
    row: 1,
    col: 1,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([102,108]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 99,
    name: "Prayer",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Defensive Auras",
    row: 1,
    col: 1,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([109]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 100,
    name: "Resist Fire",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Defensive Auras",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 101,
    name: "Holy Bolt",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([112]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Blessed Hammer'.blvl)+skill('Fist of the Heavens'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":50,"par7":15}),
  }),
  Object.freeze({
    id: 102,
    name: "Holy Fire",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Offensive Auras",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([98]),
    dependents: Object.freeze([114]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "skill('Resist Fire'.blvl)*par8+skill('Salvation'.blvl)*par7",
      duration: undefined,
    }),
    params: Object.freeze({"par8":18,"par7":6,"par5":6}),
  }),
  Object.freeze({
    id: 103,
    name: "Thorns",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Offensive Auras",
    row: 2,
    col: 3,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([119]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 104,
    name: "Defiance",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Defensive Auras",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([115]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 105,
    name: "Resist Cold",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Defensive Auras",
    row: 2,
    col: 3,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 106,
    name: "Zeal",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([96]),
    dependents: Object.freeze([111]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":12,"par6":5,"par5":2}),
  }),
  Object.freeze({
    id: 107,
    name: "Charge",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([97]),
    dependents: Object.freeze([117]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":20,"par6":0,"par5":2}),
  }),
  Object.freeze({
    id: 108,
    name: "Blessed Aim",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Offensive Auras",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([98]),
    dependents: Object.freeze([113]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":5,"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 109,
    name: "Cleansing",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Defensive Auras",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([99]),
    dependents: Object.freeze([115,120]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 110,
    name: "Resist Lightning",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Defensive Auras",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 111,
    name: "Vengeance",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([106]),
    dependents: Object.freeze([116]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":10,"par7":2,"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 112,
    name: "Blessed Hammer",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([101]),
    dependents: Object.freeze([117,121]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Vigor'.blvl)+skill('Blessed Aim'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":14,"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 113,
    name: "Concentration",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Offensive Auras",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([108]),
    dependents: Object.freeze([122]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":20}),
  }),
  Object.freeze({
    id: 114,
    name: "Holy Freeze",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Offensive Auras",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([102]),
    dependents: Object.freeze([118,119]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "skill('Resist Cold'.blvl)*par8+skill('Salvation'.blvl)*par7",
      duration: undefined,
    }),
    params: Object.freeze({"par8":15,"par7":7,"par6":0,"par5":5}),
  }),
  Object.freeze({
    id: 115,
    name: "Vigor",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Defensive Auras",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([109,104]),
    dependents: Object.freeze([124]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":50,"par5":7}),
  }),
  Object.freeze({
    id: 116,
    name: "Conversion",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([111]),
    dependents: Object.freeze([121]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 117,
    name: "Holy Shield",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([107,112]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":15,"par6":40,"par5":10}),
  }),
  Object.freeze({
    id: 118,
    name: "Holy Shock",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Offensive Auras",
    row: 5,
    col: 2,
    reqlevel: 24,
    reqskills: Object.freeze([114]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "skill('Resist Lightning'.blvl)*par8+skill('Salvation'.blvl)*par7",
      duration: undefined,
    }),
    params: Object.freeze({"par8":12,"par7":4,"par6":0,"par5":6}),
  }),
  Object.freeze({
    id: 119,
    name: "Sanctuary",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Offensive Auras",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([103,114]),
    dependents: Object.freeze([123]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "skill('Cleansing'.blvl)*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":7,"par6":50,"par5":100}),
  }),
  Object.freeze({
    id: 120,
    name: "Meditation",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Defensive Auras",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([109]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 121,
    name: "Fist of the Heavens",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([112,116]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "skill('Holy Shock'.blvl)*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":7,"par6":2,"par5":6}),
  }),
  Object.freeze({
    id: 122,
    name: "Fanaticism",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Offensive Auras",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([113]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":17,"par5":50}),
  }),
  Object.freeze({
    id: 123,
    name: "Conviction",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Offensive Auras",
    row: 6,
    col: 3,
    reqlevel: 30,
    reqskills: Object.freeze([119]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":100,"par5":40}),
  }),
  Object.freeze({
    id: 124,
    name: "Redemption",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Defensive Auras",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([115]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":5,"par5":25}),
  }),
  Object.freeze({
    id: 125,
    name: "Salvation",
    classCode: "pal" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Defensive Auras",
    row: 6,
    col: 3,
    reqlevel: 30,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 126,
    name: "Bash",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([133,139]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":5,"par7":5}),
  }),
  Object.freeze({
    id: 127,
    name: "Sword Mastery",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Combat Masteries",
    row: 1,
    col: 1,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":35,"par5":0}),
  }),
  Object.freeze({
    id: 128,
    name: "Axe Mastery",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Combat Masteries",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":35,"par5":0}),
  }),
  Object.freeze({
    id: 129,
    name: "Mace Mastery",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Combat Masteries",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":35,"par5":0}),
  }),
  Object.freeze({
    id: 130,
    name: "Howl",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Warcries",
    row: 1,
    col: 1,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([137,138]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":25,"par5":75}),
  }),
  Object.freeze({
    id: 131,
    name: "Find Potion",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Warcries",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([142]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 132,
    name: "Leap",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([143]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 133,
    name: "Double Swing",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 2,
    col: 3,
    reqlevel: 6,
    reqskills: Object.freeze([126]),
    dependents: Object.freeze([140]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":10,"par5":50}),
  }),
  Object.freeze({
    id: 134,
    name: "Pole Arm Mastery",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Combat Masteries",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":35,"par5":0}),
  }),
  Object.freeze({
    id: 135,
    name: "Throwing Mastery",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Combat Masteries",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":35,"par5":0}),
  }),
  Object.freeze({
    id: 136,
    name: "Spear Mastery",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Combat Masteries",
    row: 2,
    col: 3,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":35,"par5":0}),
  }),
  Object.freeze({
    id: 137,
    name: "Taunt",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Warcries",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([130]),
    dependents: Object.freeze([146]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 138,
    name: "Shout",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Warcries",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([130]),
    dependents: Object.freeze([149]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":125}),
  }),
  Object.freeze({
    id: 139,
    name: "Stun",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 3,
    col: 2,
    reqlevel: 12,
    reqskills: Object.freeze([126]),
    dependents: Object.freeze([144]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: "skill('War Cry'.blvl)*par6",
    }),
    params: Object.freeze({"par8":8,"par7":5,"par6":5}),
  }),
  Object.freeze({
    id: 140,
    name: "Double Throw",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([133]),
    dependents: Object.freeze([147]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":8}),
  }),
  Object.freeze({
    id: 141,
    name: "Increased Stamina",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Combat Masteries",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([148]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 142,
    name: "Find Item",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Warcries",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([131]),
    dependents: Object.freeze([150]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 143,
    name: "Leap Attack",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([132]),
    dependents: Object.freeze([151]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":10,"par6":2,"par5":4}),
  }),
  Object.freeze({
    id: 144,
    name: "Concentrate",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([139]),
    dependents: Object.freeze([151,152]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":5,"par7":10}),
  }),
  Object.freeze({
    id: 145,
    name: "Iron Skin",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Combat Masteries",
    row: 4,
    col: 3,
    reqlevel: 18,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([153]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 146,
    name: "Battle Cry",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Warcries",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([137]),
    dependents: Object.freeze([154]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":-1,"par5":-25}),
  }),
  Object.freeze({
    id: 147,
    name: "Frenzy",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([140]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":8,"par7":150,"par6":50,"par5":0}),
  }),
  Object.freeze({
    id: 148,
    name: "Increased Speed",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Combat Masteries",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([141]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 149,
    name: "Battle Orders",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Warcries",
    row: 5,
    col: 2,
    reqlevel: 24,
    reqskills: Object.freeze([138]),
    dependents: Object.freeze([154,155]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":125}),
  }),
  Object.freeze({
    id: 150,
    name: "Grim Ward",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Warcries",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([142]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":60,"par5":10}),
  }),
  Object.freeze({
    id: 151,
    name: "Whirlwind",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([143,144]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 152,
    name: "Berserk",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Combat Skills",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([144]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":10,"par5":0}),
  }),
  Object.freeze({
    id: 153,
    name: "Natural Resistance",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Combat Masteries",
    row: 6,
    col: 3,
    reqlevel: 30,
    reqskills: Object.freeze([145]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 154,
    name: "War Cry",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Warcries",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([146,149]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: "(skill('Howl'.blvl)+skill('Taunt'.blvl)+skill('Battle Cry'.blvl))*par8",
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":6}),
  }),
  Object.freeze({
    id: 155,
    name: "Battle Command",
    classCode: "bar" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Warcries",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([149]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":125}),
  }),
  Object.freeze({
    id: 221,
    name: "Raven",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Summoning",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([227]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":1,"par5":12}),
  }),
  Object.freeze({
    id: 222,
    name: "Plague Poppy",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Summoning",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([231]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 223,
    name: "Wearwolf",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shape Shifting",
    row: 1,
    col: 1,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([224,232]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 224,
    name: "Shape Shifting",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shape Shifting",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([223]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 225,
    name: "Firestorm",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Elemental",
    row: 1,
    col: 1,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([229]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Molten Boulder'.blvl)+skill('Eruption'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":23,"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 226,
    name: "Oak Sage",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Summoning",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([236,237]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":2,"par7":30,"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 227,
    name: "Summon Spirit Wolf",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Summoning",
    row: 2,
    col: 2,
    reqlevel: 6,
    reqskills: Object.freeze([221]),
    dependents: Object.freeze([237]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":5,"par7":0,"par6":10,"par5":50}),
  }),
  Object.freeze({
    id: 228,
    name: "Wearbear",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shape Shifting",
    row: 2,
    col: 3,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([233]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par5":75}),
  }),
  Object.freeze({
    id: 229,
    name: "Molten Boulder",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Elemental",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([225]),
    dependents: Object.freeze([234]),
    synergyFormulas: Object.freeze({
      physical: "skill('Volcano'.blvl)*par7",
      elemental: "skill('Firestorm'.blvl)*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":8,"par7":10}),
  }),
  Object.freeze({
    id: 230,
    name: "Arctic Blast",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Elemental",
    row: 2,
    col: 3,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([235]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Cyclone Armor'.blvl)+skill('Hurricane'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":15}),
  }),
  Object.freeze({
    id: 231,
    name: "Cycle of Life",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Summoning",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([222]),
    dependents: Object.freeze([241]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":12,"par5":3}),
  }),
  Object.freeze({
    id: 232,
    name: "Feral Rage",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shape Shifting",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([223]),
    dependents: Object.freeze([238,239]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":3,"par7":2,"par6":5,"par5":50}),
  }),
  Object.freeze({
    id: 233,
    name: "Maul",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shape Shifting",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([228]),
    dependents: Object.freeze([239,243]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":3,"par7":2,"par6":100,"par5":10}),
  }),
  Object.freeze({
    id: 234,
    name: "Eruption",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Elemental",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([229]),
    dependents: Object.freeze([244]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Firestorm'.blvl)+skill('Volcano'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":12}),
  }),
  Object.freeze({
    id: 235,
    name: "Cyclone Armor",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Elemental",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([230]),
    dependents: Object.freeze([240]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":7}),
  }),
  Object.freeze({
    id: 236,
    name: "Heart of Wolverine",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Summoning",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([226]),
    dependents: Object.freeze([246]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":2,"par7":30,"par6":7,"par5":20}),
  }),
  Object.freeze({
    id: 237,
    name: "Summon Fenris",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Summoning",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([226,227]),
    dependents: Object.freeze([247]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":5,"par7":0,"par6":4,"par5":100}),
  }),
  Object.freeze({
    id: 238,
    name: "Rabies",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shape Shifting",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([232]),
    dependents: Object.freeze([248]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Plague Poppy'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":18}),
  }),
  Object.freeze({
    id: 239,
    name: "Fire Claws",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shape Shifting",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([232,233]),
    dependents: Object.freeze([242]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Firestorm'.blvl)+skill('Molten Boulder'.blvl)+skill('Volcano'.blvl)+skill('Eruption'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":22}),
  }),
  Object.freeze({
    id: 240,
    name: "Twister",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Elemental",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([235]),
    dependents: Object.freeze([245]),
    synergyFormulas: Object.freeze({
      physical: "(skill('Tornado'.blvl)+skill('Hurricane'.blvl))*par8",
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":10}),
  }),
  Object.freeze({
    id: 241,
    name: "Vines",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Summoning",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([231]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":8,"par5":1}),
  }),
  Object.freeze({
    id: 242,
    name: "Hunger",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shape Shifting",
    row: 5,
    col: 2,
    reqlevel: 24,
    reqskills: Object.freeze([239]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par5":-75}),
  }),
  Object.freeze({
    id: 243,
    name: "Shock Wave",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shape Shifting",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([233]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: "skill('Maul'.blvl)*par8",
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":5}),
  }),
  Object.freeze({
    id: 244,
    name: "Volcano",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Elemental",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([234]),
    dependents: Object.freeze([249]),
    synergyFormulas: Object.freeze({
      physical: "skill('Molten Boulder'.blvl)*par7",
      elemental: "(skill('Eruption'.blvl)+skill('Armageddon'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":12,"par7":12}),
  }),
  Object.freeze({
    id: 245,
    name: "Tornado",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Elemental",
    row: 5,
    col: 2,
    reqlevel: 24,
    reqskills: Object.freeze([240]),
    dependents: Object.freeze([250]),
    synergyFormulas: Object.freeze({
      physical: "(skill('Cyclone Armor'.blvl)+skill('Twister'.blvl)+skill('Hurricane'.blvl))*par8",
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":9}),
  }),
  Object.freeze({
    id: 246,
    name: "Spirit of Barbs",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Summoning",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([236]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":2,"par7":30}),
  }),
  Object.freeze({
    id: 247,
    name: "Summon Grizzly",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Summoning",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([237]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":5,"par7":0}),
  }),
  Object.freeze({
    id: 248,
    name: "Fury",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shape Shifting",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([238]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":5,"par5":2}),
  }),
  Object.freeze({
    id: 249,
    name: "Armageddon",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Elemental",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([244,250]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Firestorm'.blvl)+skill('Molten Boulder'.blvl)+skill('Volcano'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":14,"par7":50}),
  }),
  Object.freeze({
    id: 250,
    name: "Hurricane",
    classCode: "dru" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Elemental",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([245]),
    dependents: Object.freeze([249]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Twister'.blvl)+skill('Tornado'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":9,"par7":50}),
  }),
  Object.freeze({
    id: 251,
    name: "Fire Trauma",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Traps",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([256,262]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Shock Field'.blvl) + skill('Death Sentry'.blvl) + skill('Charged Bolt Sentry'.blvl) + skill('Lightning Sentry'.blvl) + skill('Wake of Fire Sentry'.blvl) + skill('Inferno Sentry'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":9}),
  }),
  Object.freeze({
    id: 252,
    name: "Claw Mastery",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shadow Disciplines",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([258,263]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":25,"par5":0}),
  }),
  Object.freeze({
    id: 253,
    name: "Psychic Hammer",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shadow Disciplines",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([264]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":99,"par5":25}),
  }),
  Object.freeze({
    id: 254,
    name: "Tiger Strike",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Martial Arts",
    row: 1,
    col: 2,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([265]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 255,
    name: "Dragon Talon",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Martial Arts",
    row: 1,
    col: 3,
    reqlevel: 1,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([260]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":99,"par5":25}),
  }),
  Object.freeze({
    id: 256,
    name: "Shock Field",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Traps",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([251]),
    dependents: Object.freeze([261]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Charged Bolt Sentry'.blvl) + skill('Lightning Sentry'.blvl) + skill('Death Sentry'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":11}),
  }),
  Object.freeze({
    id: 257,
    name: "Blade Sentinel",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Traps",
    row: 2,
    col: 3,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([266]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 258,
    name: "Quickness",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shadow Disciplines",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([252]),
    dependents: Object.freeze([267]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":300,"par5":3000}),
  }),
  Object.freeze({
    id: 259,
    name: "Fists of Fire",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Martial Arts",
    row: 2,
    col: 1,
    reqlevel: 6,
    reqskills: Object.freeze([]),
    dependents: Object.freeze([269]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Royal Strike'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":12}),
  }),
  Object.freeze({
    id: 260,
    name: "Dragon Claw",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Martial Arts",
    row: 2,
    col: 3,
    reqlevel: 6,
    reqskills: Object.freeze([255]),
    dependents: Object.freeze([270]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":4}),
  }),
  Object.freeze({
    id: 261,
    name: "Charged Bolt Sentry",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Traps",
    row: 3,
    col: 1,
    reqlevel: 12,
    reqskills: Object.freeze([256]),
    dependents: Object.freeze([271]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Fire Trauma'.blvl) + skill('Lightning Sentry'.blvl) + skill('Death Sentry'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":6}),
  }),
  Object.freeze({
    id: 262,
    name: "Wake of Fire Sentry",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Traps",
    row: 3,
    col: 2,
    reqlevel: 12,
    reqskills: Object.freeze([251]),
    dependents: Object.freeze([266,272]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Fire Trauma'.blvl) + skill('Inferno Sentry'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":8}),
  }),
  Object.freeze({
    id: 263,
    name: "Weapon Block",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shadow Disciplines",
    row: 3,
    col: 2,
    reqlevel: 12,
    reqskills: Object.freeze([252]),
    dependents: Object.freeze([268]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 264,
    name: "Cloak of Shadows",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shadow Disciplines",
    row: 3,
    col: 3,
    reqlevel: 12,
    reqskills: Object.freeze([253]),
    dependents: Object.freeze([268,273]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":3,"par7":10,"par6":3,"par5":15}),
  }),
  Object.freeze({
    id: 265,
    name: "Cobra Strike",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Martial Arts",
    row: 3,
    col: 2,
    reqlevel: 12,
    reqskills: Object.freeze([254]),
    dependents: Object.freeze([280]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 266,
    name: "Blade Fury",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Traps",
    row: 4,
    col: 3,
    reqlevel: 18,
    reqskills: Object.freeze([257,262]),
    dependents: Object.freeze([277]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 267,
    name: "Fade",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shadow Disciplines",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([258]),
    dependents: Object.freeze([278]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par8":1,"par7":1,"par6":300,"par5":3000}),
  }),
  Object.freeze({
    id: 268,
    name: "Shadow Warrior",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shadow Disciplines",
    row: 4,
    col: 2,
    reqlevel: 18,
    reqskills: Object.freeze([264,263]),
    dependents: Object.freeze([279]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":2,"par5":18}),
  }),
  Object.freeze({
    id: 269,
    name: "Claws of Thunder",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Martial Arts",
    row: 4,
    col: 1,
    reqlevel: 18,
    reqskills: Object.freeze([259]),
    dependents: Object.freeze([274]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Royal Strike'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":8}),
  }),
  Object.freeze({
    id: 270,
    name: "Dragon Tail",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Martial Arts",
    row: 4,
    col: 3,
    reqlevel: 18,
    reqskills: Object.freeze([260]),
    dependents: Object.freeze([275]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 271,
    name: "Lightning Sentry",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Traps",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([261]),
    dependents: Object.freeze([276]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Shock Field'.blvl) + skill('Charged Bolt Sentry'.blvl) + skill('Death Sentry'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":12}),
  }),
  Object.freeze({
    id: 272,
    name: "Inferno Sentry",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Traps",
    row: 5,
    col: 2,
    reqlevel: 24,
    reqskills: Object.freeze([262]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Fire Trauma'.blvl) + skill('Death Sentry'.blvl)) * par7 + skill('Wake of Fire Sentry'.blvl)*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":7,"par7":10}),
  }),
  Object.freeze({
    id: 273,
    name: "Mind Blast",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shadow Disciplines",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([264]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par7":4,"par6":40,"par5":15}),
  }),
  Object.freeze({
    id: 274,
    name: "Blades of Ice",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Martial Arts",
    row: 5,
    col: 1,
    reqlevel: 24,
    reqskills: Object.freeze([269]),
    dependents: Object.freeze([280]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Royal Strike'.blvl)) * par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":8,"par5":1}),
  }),
  Object.freeze({
    id: 275,
    name: "Dragon Flight",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Martial Arts",
    row: 5,
    col: 3,
    reqlevel: 24,
    reqskills: Object.freeze([270]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par7":27}),
  }),
  Object.freeze({
    id: 276,
    name: "Death Sentry",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Traps",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([271]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: "(skill('Lightning Sentry'.blvl))*par8",
      duration: undefined,
    }),
    params: Object.freeze({"par8":12}),
  }),
  Object.freeze({
    id: 277,
    name: "Blade Shield",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 0,
    tabName: "Traps",
    row: 6,
    col: 3,
    reqlevel: 30,
    reqskills: Object.freeze([266]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: undefined,
  }),
  Object.freeze({
    id: 278,
    name: "Venom",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shadow Disciplines",
    row: 6,
    col: 1,
    reqlevel: 30,
    reqskills: Object.freeze([267]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":0,"par5":0}),
  }),
  Object.freeze({
    id: 279,
    name: "Shadow Master",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 1,
    tabName: "Shadow Disciplines",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([268]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par6":3,"par5":24}),
  }),
  Object.freeze({
    id: 280,
    name: "Royal Strike",
    classCode: "ass" as CharacterClassCode,
    tabIndex: 2,
    tabName: "Martial Arts",
    row: 6,
    col: 2,
    reqlevel: 30,
    reqskills: Object.freeze([265,274]),
    dependents: Object.freeze([]),
    synergyFormulas: Object.freeze({
      physical: undefined,
      elemental: undefined,
      duration: undefined,
    }),
    params: Object.freeze({"par7":25,"par6":10,"par5":16}),
  })
])

/** Canonical lookup map: skillId -> SkillNode */
export const CANONICAL_SKILL_MAP: ReadonlyMap<number, SkillNode> = new Map(
  CANONICAL_SKILL_TREE.map(node => [node.id, node])
)

/**
 * Normalizes any SkillTreeCatalog representation into a standard Map<number, SkillNode>.
 */
export function asCatalogMap(tree: SkillTreeCatalog): Map<number, SkillNode> {
  if (tree instanceof Map) {
    return tree as Map<number, SkillNode>
  }
  const map = new Map<number, SkillNode>()
  if (Array.isArray(tree)) {
    for (const node of tree) {
      map.set(node.id, node)
    }
  } else {
    for (const key of Object.keys(tree)) {
      const id = Number(key)
      if (!Number.isNaN(id)) {
        map.set(id, (tree as Record<number, SkillNode>)[id])
      }
    }
  }
  return map
}

/**
 * Retrieves a skill node by its numeric ID.
 */
export function getSkillNode(tree: SkillTreeCatalog, skillId: number): SkillNode | undefined {
  if (tree instanceof Map) return tree.get(skillId)
  if (Array.isArray(tree)) return tree.find(n => n.id === skillId)
  return (tree as Record<number, SkillNode>)[skillId]
}

/**
 * Returns all skills belonging to a given character class.
 */
export function getSkillsForClass(
  tree: SkillTreeCatalog,
  classCode: CharacterClassCode
): readonly SkillNode[] {
  const map = asCatalogMap(tree)
  const result: SkillNode[] = []
  for (const node of map.values()) {
    if (node.classCode === classCode) {
      result.push(node)
    }
  }
  return result
}

/**
 * Returns all skills belonging to a specific class tab (0..2).
 */
export function getSkillsForTab(
  tree: SkillTreeCatalog,
  classCode: CharacterClassCode,
  tabIndex: number
): readonly SkillNode[] {
  const map = asCatalogMap(tree)
  const result: SkillNode[] = []
  for (const node of map.values()) {
    if (node.classCode === classCode && node.tabIndex === tabIndex) {
      result.push(node)
    }
  }
  return result
}

/**
 * Creates a clean skill tree state with the specified number of unspent points.
 */
export function createSkillTreeState(unspentPoints: number = 0): SkillTreeState {
  return {
    hardPoints: {},
    unspentPoints: Number.isFinite(unspentPoints) ? Math.max(0, Math.floor(unspentPoints)) : 0,
  }
}

/**
 * Checks whether a character can allocate a hard point into a skill.
 *
 * Rules:
 * 1. Must have at least 1 unspent skill point.
 * 2. Player level must be >= skill.reqlevel.
 * 3. Hard points invested cannot exceed 20.
 * 4. All direct prerequisites (reqskills) must have at least 1 allocated hard point.
 */
export function canAllocate(
  tree: SkillTreeCatalog,
  state: SkillTreeState,
  skillId: number,
  playerLevel: number
): boolean {
  if (!(state.unspentPoints > 0)) return false
  const map = asCatalogMap(tree)
  const node = map.get(skillId)
  if (!node) return false
  if (!(playerLevel >= node.reqlevel)) return false
  const currentPoints = state.hardPoints[skillId] ?? 0
  if (currentPoints >= 20) return false
  for (const prereqId of node.reqskills) {
    if ((state.hardPoints[prereqId] ?? 0) < 1) return false
  }
  return true
}

/**
 * Allocates 1 hard point into the target skill if eligible, deducting from unspent points.
 * Returns true if successful, false otherwise.
 */
export function allocatePoint(
  tree: SkillTreeCatalog,
  state: SkillTreeState,
  skillId: number,
  playerLevel: number
): boolean {
  if (!canAllocate(tree, state, skillId, playerLevel)) return false
  state.hardPoints[skillId] = (state.hardPoints[skillId] ?? 0) + 1
  state.unspentPoints -= 1
  return true
}

/**
 * Checks whether a skill point can be safely deallocated.
 *
 * Rules:
 * 1. Skill must currently have at least 1 hard point.
 * 2. If dropping from > 1 points, deallocation is always valid.
 * 3. If dropping from 1 to 0 points, no skill that depends on this skill
 *    (in its transitive prerequisite chain) can have any allocated hard points.
 */
export function canDeallocate(
  tree: SkillTreeCatalog,
  state: SkillTreeState,
  skillId: number
): boolean {
  const currentPoints = state.hardPoints[skillId] ?? 0
  if (!(currentPoints > 0)) return false
  if (currentPoints > 1) return true

  // Dropping from 1 to 0: verify no transitive dependent has invested points
  const map = asCatalogMap(tree)
  const node = map.get(skillId)
  if (!node) return true

  const visited = new Set<number>()
  const queue = [...node.dependents]
  while (queue.length > 0) {
    const depId = queue.shift()!
    if (visited.has(depId)) continue
    visited.add(depId)
    if ((state.hardPoints[depId] ?? 0) > 0) return false
    const depNode = map.get(depId)
    if (depNode) {
      queue.push(...depNode.dependents)
    }
  }

  return true
}

/**
 * Deallocates 1 point from the target skill if valid, returning it to unspent points.
 * Returns true if successful, false otherwise.
 */
export function deallocatePoint(
  tree: SkillTreeCatalog,
  state: SkillTreeState,
  skillId: number
): boolean {
  if (!canDeallocate(tree, state, skillId)) return false
  state.hardPoints[skillId] = (state.hardPoints[skillId] ?? 0) - 1
  state.unspentPoints += 1
  return true
}

/**
 * Resets all allocated skill points to 0 and refunds them to unspent points.
 * Returns the total number of refunded skill points.
 */
export function respec(state: SkillTreeState): number {
  let refunded = 0
  for (const skillIdStr of Object.keys(state.hardPoints)) {
    const id = Number(skillIdStr)
    const pts = state.hardPoints[id] ?? 0
    refunded += pts
    state.hardPoints[id] = 0
  }
  const currentUnspent = Number.isFinite(state.unspentPoints) ? Math.max(0, Math.floor(state.unspentPoints)) : 0
  state.unspentPoints = currentUnspent + refunded
  return refunded
}

/**
 * Evaluates 1.13c synergy formulas strictly against base allocated hard points (blvl).
 *
 * Invariants:
 * 1. Only physically allocated base points (blvl, 0..20) are counted. Soft points (+skills)
 *    from equipment, charms, or buffs MUST NOT alter synergy calculations.
 * 2. Formulas support expressions such as:
 *    (skill('Fire Ball'.blvl)+skill('Meteor'.blvl))*par8
 * 3. Tolerates unclosed parentheses (e.g. Fire Wall '(skill(\'Warmth\'.blvl)*par8+skill(\'Inferno\'.blvl)*par7').
 * 4. Gracefully falls back to 1.0 (no bonus) on empty or malformed syntax without throwing exceptions.
 */
export function calculateSynergyMultiplier(
  tree: SkillTreeCatalog,
  state: SkillTreeState,
  skillId: number,
  damageType: 'physical' | 'elemental' | 'duration' = 'elemental'
): number {
  const map = asCatalogMap(tree)
  const node = map.get(skillId)
  if (!node) return 1.0

  const formula = damageType === 'physical'
    ? node.synergyFormulas.physical
    : damageType === 'duration'
      ? node.synergyFormulas.duration
      : node.synergyFormulas.elemental

  if (!formula || formula.trim() === '' || formula.trim() === '-') return 1.0

  // Build name lookup map
  const nameToId = new Map<string, number>()
  for (const [id, s] of map.entries()) {
    nameToId.set(s.name.trim().toLowerCase(), id)
  }

  try {
    let sanitized = formula

    // Substitute skill('<Name>'.blvl) with hard points
    const regex = /skill\(\s*['"]([^'"]+)['"]\s*\.blvl\s*\)/gi
    sanitized = sanitized.replace(regex, (_match, skillName: string) => {
      const targetId = nameToId.get(skillName.trim().toLowerCase())
      if (targetId === undefined) return '0'
      const basePoints = Math.max(0, Math.min(20, state.hardPoints[targetId] ?? 0))
      return String(basePoints)
    })

    // Resolve parameter multipliers
    const paramOverrides = (node as any).params
    const canonParams = CANONICAL_SKILL_PARAMS[node.id]

    const p8 = (node as any).param8 ?? paramOverrides?.par8 ?? canonParams?.par8 ?? 16
    const p7 = (node as any).param7 ?? paramOverrides?.par7 ?? canonParams?.par7 ?? 8
    const p6 = (node as any).param6 ?? paramOverrides?.par6 ?? canonParams?.par6 ?? 5
    const p5 = (node as any).param5 ?? paramOverrides?.par5 ?? canonParams?.par5 ?? 0

    sanitized = sanitized.replace(/\bpar8\b/gi, String(p8))
    sanitized = sanitized.replace(/\bpar7\b/gi, String(p7))
    sanitized = sanitized.replace(/\bpar6\b/gi, String(p6))
    sanitized = sanitized.replace(/\bpar5\b/gi, String(p5))

    // Resilience: balance unclosed parentheses
    const openCount = (sanitized.match(/\(/g) || []).length
    const closeCount = (sanitized.match(/\)/g) || []).length
    if (openCount > closeCount) {
      sanitized += ')'.repeat(openCount - closeCount)
    } else if (closeCount > openCount) {
      sanitized = '('.repeat(closeCount - openCount) + sanitized
    }

    // Strict validation: arithmetic characters only (- placed at start to avoid range)
    if (!/^[-+0-9*/().\s]+$/.test(sanitized)) {
      return 1.0
    }

    const bonusPct = evalBasicArithmetic(sanitized)
    if (typeof bonusPct !== 'number' || !Number.isFinite(bonusPct) || bonusPct <= 0) {
      return 1.0
    }

    return 1.0 + bonusPct / 100.0
  } catch {
    return 1.0
  }
}

function evalBasicArithmetic(input: string): number {
  let pos = 0
  const len = input.length

  const skipWs = (): void => {
    while (pos < len && /\s/.test(input[pos]!)) pos++
  }

  const parseExpr = (): number => {
    let val = parseTerm()
    while (true) {
      skipWs()
      const ch = input[pos]
      if (ch === '+') {
        pos++
        val += parseTerm()
      } else if (ch === '-') {
        pos++
        val -= parseTerm()
      } else {
        break
      }
    }
    return val
  }

  const parseTerm = (): number => {
    let val = parseFactor()
    while (true) {
      skipWs()
      const ch = input[pos]
      if (ch === '*') {
        pos++
        val *= parseFactor()
      } else if (ch === '/') {
        pos++
        const denom = parseFactor()
        val = denom === 0 ? NaN : val / denom
      } else {
        break
      }
    }
    return val
  }

  const parseFactor = (): number => {
    skipWs()
    if (pos >= len) return NaN
    const ch = input[pos]!
    if (ch === '+') {
      pos++
      return +parseFactor()
    }
    if (ch === '-') {
      pos++
      return -parseFactor()
    }
    if (ch === '(') {
      pos++
      const val = parseExpr()
      skipWs()
      if (input[pos] !== ')') return NaN
      pos++
      return val
    }
    const numMatch = /^[0-9]+(?:\.[0-9]+)?/.exec(input.slice(pos))
    if (numMatch) {
      pos += numMatch[0].length
      return Number(numMatch[0])
    }
    return NaN
  }

  const result = parseExpr()
  skipWs()
  if (pos !== len) return NaN
  return result
}

/**
 * Validates prerequisite DAG integrity:
 * - 0 cycles (strictly acyclic)
 * - 0 level inversions (parent reqlevel <= child reqlevel)
 * - 0 unresolved prerequisite dependencies
 */
export function validatePrerequisiteDAG(tree: SkillTreeCatalog): {
  valid: boolean
  cycles: number[]
  inversions: Array<{ parent: number; child: number; parentLevel: number; childLevel: number }>
  unresolved: Array<{ skillId: number; missingReq: number }>
} {
  const map = asCatalogMap(tree)
  const nodes = Array.from(map.values())

  const inDegree = new Map<number, number>()
  const adj = new Map<number, number[]>()
  const unresolved: Array<{ skillId: number; missingReq: number }> = []
  const inversions: Array<{ parent: number; child: number; parentLevel: number; childLevel: number }> = []

  for (const node of nodes) {
    inDegree.set(node.id, node.reqskills.length)
    if (!adj.has(node.id)) adj.set(node.id, [])
  }

  for (const node of nodes) {
    for (const reqId of node.reqskills) {
      const parent = map.get(reqId)
      if (!parent) {
        unresolved.push({ skillId: node.id, missingReq: reqId })
      } else {
        if (parent.reqlevel > node.reqlevel) {
          inversions.push({
            parent: parent.id,
            child: node.id,
            parentLevel: parent.reqlevel,
            childLevel: node.reqlevel,
          })
        }
        if (!adj.has(reqId)) adj.set(reqId, [])
        adj.get(reqId)!.push(node.id)
      }
    }
  }

  // Kahn's algorithm for topological sorting
  const queue: number[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id)
  }

  let processedCount = 0
  while (queue.length > 0) {
    const u = queue.shift()!
    processedCount++
    for (const v of adj.get(u) || []) {
      const cur = inDegree.get(v)! - 1
      inDegree.set(v, cur)
      if (cur === 0) queue.push(v)
    }
  }

  const cycleNodeIds: number[] = []
  if (processedCount < nodes.length) {
    for (const [id, deg] of inDegree.entries()) {
      if (deg > 0) cycleNodeIds.push(id)
    }
  }

  const valid = cycleNodeIds.length === 0 && inversions.length === 0 && unresolved.length === 0

  return {
    valid,
    cycles: cycleNodeIds,
    inversions,
    unresolved,
  }
}

/**
 * Parses skill tree nodes dynamically from 1.13c Skills.txt and SkillDesc.txt tables.
 */
export function parseSkillTreeTable(skillsTable: D2Table, skilldescTable: D2Table): SkillNode[] {
  const descMap = new Map<string, { page: number; row: number; col: number }>()
  for (const r of skilldescTable.rows) {
    const key = cell(skilldescTable, r, 'skilldesc')
    if (key) {
      descMap.set(key, {
        page: Number(cell(skilldescTable, r, 'SkillPage')),
        row: Number(cell(skilldescTable, r, 'SkillRow')),
        col: Number(cell(skilldescTable, r, 'SkillColumn')),
      })
    }
  }

  const nameToId = new Map<string, number>()
  for (const r of skillsTable.rows) {
    const id = Number(cell(skillsTable, r, 'Id'))
    const name = cell(skillsTable, r, 'skill')
    nameToId.set(name.toLowerCase(), id)
  }

  const classCodes: CharacterClassCode[] = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass']
  const nodes: SkillNode[] = []

  for (const r of skillsTable.rows) {
    const charclass = cell(skillsTable, r, 'charclass') as CharacterClassCode
    if (!classCodes.includes(charclass)) continue

    const id = Number(cell(skillsTable, r, 'Id'))
    const name = cell(skillsTable, r, 'skill')
    const descKey = cell(skillsTable, r, 'skilldesc')
    const desc = descMap.get(descKey) ?? { page: 1, row: 1, col: 1 }
    const tabIndex = desc.page - 1
    const tabName = CANONICAL_SKILL_TABS[charclass][tabIndex] ?? ''
    const reqlevel = Number(cell(skillsTable, r, 'reqlevel') || 1)

    const reqskills: number[] = []
    for (const reqCol of ['reqskill1', 'reqskill2', 'reqskill3']) {
      const reqName = cell(skillsTable, r, reqCol)
      if (reqName) {
        const reqId = nameToId.get(reqName.toLowerCase())
        if (reqId !== undefined && reqId > 0) {
          reqskills.push(reqId)
        }
      }
    }

    const physical = cell(skillsTable, r, 'DmgSymPerCalc') || undefined
    const elemental = cell(skillsTable, r, 'EDmgSymPerCalc') || undefined
    const duration = cell(skillsTable, r, 'ELenSymPerCalc') || undefined

    const par8 = cell(skillsTable, r, 'Param8') ? Number(cell(skillsTable, r, 'Param8')) : undefined
    const par7 = cell(skillsTable, r, 'Param7') ? Number(cell(skillsTable, r, 'Param7')) : undefined
    const par6 = cell(skillsTable, r, 'Param6') ? Number(cell(skillsTable, r, 'Param6')) : undefined
    const par5 = cell(skillsTable, r, 'Param5') ? Number(cell(skillsTable, r, 'Param5')) : undefined

    nodes.push({
      id,
      name,
      classCode: charclass,
      tabIndex,
      tabName,
      row: desc.row,
      col: desc.col,
      reqlevel,
      reqskills: Object.freeze(reqskills),
      dependents: [],
      synergyFormulas: Object.freeze({ physical, elemental, duration }),
      params: (par8 !== undefined || par7 !== undefined || par6 !== undefined || par5 !== undefined)
        ? Object.freeze({ par8, par7, par6, par5 })
        : undefined,
    })
  }

  // Populate dependents
  const nodeMap = new Map<number, SkillNode>(nodes.map(n => [n.id, n]))
  for (const node of nodes) {
    for (const reqId of node.reqskills) {
      const parent = nodeMap.get(reqId)
      if (parent) {
        ;(parent.dependents as number[]).push(node.id)
      }
    }
  }

  return nodes
}

export {
  getSkillName,
  formatDamageTypeEn,
  PASSIVE_SKILL_IDS,
  isPassiveSkill,
  LEFT_USABLE_SKILL_IDS,
  isLeftUsableSkill,
  PALADIN_AURA_SKILL_IDS,
  isAuraSkill,
  type D2ColorCode,
  type FormattedTooltipLine,
  type HotkeySkillEntry,
} from './skills-meta.ts'

