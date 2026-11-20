/**
 * Canonical 1.13c Level Warp & Geometry Metadata (Levels.txt & LvlWarp.txt).
 *
 * Ground truth parsed from:
 * - Levels.txt: column LevelWarp (key into string.tbl / expansionstring.tbl / patchstring.tbl)
 * - LvlWarp.txt: columns SelectX, SelectY, SelectDX, SelectDY (hitbox bounds)
 */

import { CANONICAL_ENG_TBL_DICT, CANONICAL_CHI_TBL_DICT } from '../data/canonical-tbl-strings.ts'

export interface LvlWarpBounds {
  readonly selectX: number
  readonly selectY: number
  readonly selectDX: number
  readonly selectDY: number
  readonly radiusX: number
  readonly radiusY: number
}

export const CANONICAL_LEVEL_WARP_KEYS: Readonly<Record<number, string>> = Object.freeze({
  "1": "To The Rogue Encampment",
  "2": "To The Blood Moor",
  "3": "To The Cold Plains",
  "4": "To The Stony Field",
  "5": "To The Dark Wood",
  "6": "To The Black Marsh",
  "7": "To The Tamoe Highland",
  "8": "To The Den of Evil",
  "9": "To The Cave Level 1",
  "10": "To Underground Passage Level 1",
  "11": "To The Hole Level 1",
  "12": "To The Pit Level 1",
  "13": "To The Cave Level 2",
  "14": "To Underground Passage Level 2",
  "15": "To The Hole Level 2",
  "16": "To The Pit Level 2",
  "17": "To The Burial Grounds",
  "18": "To The Crypt",
  "19": "To The Mausoleum",
  "20": "To The Forgotten Tower",
  "21": "To The Tower Cellar Level 1",
  "22": "To The Tower Cellar Level 2",
  "23": "To The Tower Cellar Level 3",
  "24": "To The Tower Cellar Level 4",
  "25": "To The Tower Cellar Level 5",
  "26": "To The Monastery Gate",
  "27": "To The Outer Cloister",
  "28": "To The Barracks",
  "29": "To The Jail Level 1",
  "30": "To The Jail Level 2",
  "31": "To The Jail Level 3",
  "32": "To The Inner Cloister",
  "33": "To The Cathedral",
  "34": "To The Catacombs Level 1",
  "35": "To The Catacombs Level 2",
  "36": "To The Catacombs Level 3",
  "37": "To The Catacombs Level 4",
  "38": "To Tristram",
  "39": "To The Moo Moo Farm",
  "40": "To Lut Gholein",
  "41": "To The Rocky Waste",
  "42": "To The Dry Hills",
  "43": "To The Far Oasis",
  "44": "To The Lost City",
  "45": "To The Valley of Snakes",
  "46": "To The Canyon of the Magi",
  "47": "To The Sewers Level 1",
  "48": "To The Sewers Level 2",
  "49": "To The Sewers Level 3",
  "50": "To The Harem Level 1",
  "51": "To The Harem Level 2",
  "52": "To The Palace Cellar Level 1",
  "53": "To The Palace Cellar Level 2",
  "54": "To The Palace Cellar Level 3",
  "55": "To The Stony Tomb Level 1",
  "56": "To The Halls of the Dead Level 1",
  "57": "To The Halls of the Dead Level 2",
  "58": "To The Claw Viper Temple Level 1",
  "59": "To The Stony Tomb Level 2",
  "60": "To The Halls of the Dead Level 3",
  "61": "To The Claw Viper Temple Level 2",
  "62": "To The Maggot Lair Level 1",
  "63": "To The Maggot Lair Level 2",
  "64": "To The Maggot Lair Level 3",
  "65": "To The Ancient Tunnels",
  "66": "To Tal Rasha's Tomb",
  "67": "To Tal Rasha's Tomb",
  "68": "To Tal Rasha's Tomb",
  "69": "To Tal Rasha's Tomb",
  "70": "To Tal Rasha's Tomb",
  "71": "To Tal Rasha's Tomb",
  "72": "To Tal Rasha's Tomb",
  "73": "To Duriel's Lair",
  "74": "To The Arcane Sanctuary",
  "75": "To The Kurast Docktown",
  "76": "To The Spider Forest",
  "77": "To The Great Marsh",
  "78": "To The Flayer Jungle",
  "79": "To Lower Kurast",
  "80": "To The Kurast Bazaar",
  "81": "To Upper Kurast",
  "82": "To The Kurast Causeway",
  "83": "To Travincal",
  "84": "To The Spider Cave",
  "85": "To The Spider Cavern",
  "86": "To The Swampy Pit Level 1",
  "87": "To The Swampy Pit Level 2",
  "88": "To The Flayer Dungeon Level 1",
  "89": "To The Flayer Dungeon Level 2",
  "90": "To The Swampy Pit Level 3",
  "91": "To The Flayer Dungeon Level 3",
  "92": "To The Sewers Level 1",
  "93": "To The Sewers Level 2",
  "94": "To The Ruined Temple",
  "95": "To The Disused Fane",
  "96": "To The Forgotten Reliquary",
  "97": "To The Forgotten Temple",
  "98": "To The Ruined Fane",
  "99": "To The Disused Reliquary",
  "100": "To The Durance of Hate Level 1",
  "101": "To The Durance of Hate Level 2",
  "102": "To The Durance of Hate Level 3",
  "103": "To The Pandemonium Fortress",
  "104": "To The Outer Steppes",
  "105": "To The Plains of Despair",
  "106": "To The City of the Damned",
  "107": "To The River of Flame",
  "108": "To Chaos Sanctum",
  "109": "To Harrogath",
  "110": "To The Bloody Foothills",
  "111": "To The Rigid Highlands",
  "112": "To The Arreat Plateau",
  "113": "To The Crystalized Cavern Level 1",
  "114": "To The Cellar of Pity",
  "115": "To The Crystalized Cavern Level 2",
  "116": "To The Echo Chamber",
  "117": "To The Tundra Wastelands",
  "118": "To The Glacier Caves Level 1",
  "119": "To The Glacier Caves Level 2",
  "120": "To The Rocky Summit",
  "121": "To Nihlathaks Temple",
  "122": "To The Halls of Anguish",
  "123": "To The Halls of Death's Calling",
  "124": "To The Halls of Vaught",
  "125": "To Hell1",
  "126": "To Hell2",
  "127": "To Hell3",
  "128": "To The Worldstone Keep Level 1",
  "129": "To The Worldstone Keep Level 2",
  "130": "To The Worldstone Keep Level 3",
  "131": "To The Throne of Destruction",
  "132": "To The Worldstone Chamber",
  "133": "To The Pandemonium Run 1",
  "134": "To The Pandemonium Run 2",
  "135": "To The Pandemonium Run 3",
  "136": "To Tristram"
})

export const CANONICAL_LVLWARP_GEOMETRY: Readonly<Record<number, { readonly selectX: number; readonly selectY: number; readonly selectDX: number; readonly selectDY: number }>> = Object.freeze({
  "0": {
    "selectX": -90,
    "selectY": -100,
    "selectDX": 90,
    "selectDY": 110
  },
  "1": {
    "selectX": -15,
    "selectY": -90,
    "selectDX": 90,
    "selectDY": 110
  },
  "2": {
    "selectX": -60,
    "selectY": -60,
    "selectDX": 85,
    "selectDY": 100
  },
  "3": {
    "selectX": -25,
    "selectY": -60,
    "selectDX": 85,
    "selectDY": 100
  },
  "4": {
    "selectX": -30,
    "selectY": -120,
    "selectDX": 120,
    "selectDY": 150
  },
  "5": {
    "selectX": -25,
    "selectY": -75,
    "selectDX": 80,
    "selectDY": 100
  },
  "6": {
    "selectX": -90,
    "selectY": -110,
    "selectDX": 110,
    "selectDY": 140
  },
  "7": {
    "selectX": -70,
    "selectY": -90,
    "selectDX": 90,
    "selectDY": 120
  },
  "8": {
    "selectX": -10,
    "selectY": -90,
    "selectDX": 60,
    "selectDY": 110
  },
  "9": {
    "selectX": -30,
    "selectY": -90,
    "selectDX": 60,
    "selectDY": 110
  },
  "10": {
    "selectX": -10,
    "selectY": -50,
    "selectDX": 150,
    "selectDY": 80
  },
  "11": {
    "selectX": -50,
    "selectY": -130,
    "selectDX": 60,
    "selectDY": 140
  },
  "12": {
    "selectX": -50,
    "selectY": -90,
    "selectDX": 80,
    "selectDY": 110
  },
  "13": {
    "selectX": -50,
    "selectY": -110,
    "selectDX": 110,
    "selectDY": 150
  },
  "14": {
    "selectX": -40,
    "selectY": -80,
    "selectDX": 210,
    "selectDY": 110
  },
  "15": {
    "selectX": -30,
    "selectY": -110,
    "selectDX": 85,
    "selectDY": 130
  },
  "16": {
    "selectX": -35,
    "selectY": -130,
    "selectDX": 90,
    "selectDY": 150
  },
  "17": {
    "selectX": -50,
    "selectY": -110,
    "selectDX": 110,
    "selectDY": 150
  },
  "18": {
    "selectX": -60,
    "selectY": -80,
    "selectDX": 210,
    "selectDY": 110
  },
  "19": {
    "selectX": -10,
    "selectY": -10,
    "selectDX": 0,
    "selectDY": 0
  },
  "20": {
    "selectX": -25,
    "selectY": -95,
    "selectDX": 70,
    "selectDY": 130
  },
  "21": {
    "selectX": 20,
    "selectY": -80,
    "selectDX": 65,
    "selectDY": 140
  },
  "22": {
    "selectX": -25,
    "selectY": -160,
    "selectDX": 100,
    "selectDY": 180
  },
  "23": {
    "selectX": -65,
    "selectY": -55,
    "selectDX": 150,
    "selectDY": 110
  },
  "24": {
    "selectX": -120,
    "selectY": -20,
    "selectDX": 150,
    "selectDY": 130
  },
  "25": {
    "selectX": -35,
    "selectY": -70,
    "selectDX": 95,
    "selectDY": 130
  },
  "26": {
    "selectX": -25,
    "selectY": -150,
    "selectDX": 80,
    "selectDY": 180
  },
  "27": {
    "selectX": -40,
    "selectY": -160,
    "selectDX": 80,
    "selectDY": 180
  },
  "28": {
    "selectX": -20,
    "selectY": -40,
    "selectDX": 170,
    "selectDY": 100
  },
  "29": {
    "selectX": -50,
    "selectY": -20,
    "selectDX": 160,
    "selectDY": 85
  },
  "30": {
    "selectX": -25,
    "selectY": -100,
    "selectDX": 60,
    "selectDY": 125
  },
  "31": {
    "selectX": -40,
    "selectY": -100,
    "selectDX": 60,
    "selectDY": 125
  },
  "32": {
    "selectX": -30,
    "selectY": -30,
    "selectDX": 170,
    "selectDY": 90
  },
  "33": {
    "selectX": -70,
    "selectY": -140,
    "selectDX": 80,
    "selectDY": 160
  },
  "34": {
    "selectX": -50,
    "selectY": -120,
    "selectDX": 90,
    "selectDY": 150
  },
  "35": {
    "selectX": -30,
    "selectY": -140,
    "selectDX": 80,
    "selectDY": 160
  },
  "36": {
    "selectX": 0,
    "selectY": -140,
    "selectDX": 100,
    "selectDY": 150
  },
  "37": {
    "selectX": -30,
    "selectY": -140,
    "selectDX": 80,
    "selectDY": 160
  },
  "38": {
    "selectX": -40,
    "selectY": -190,
    "selectDX": 90,
    "selectDY": 210
  },
  "39": {
    "selectX": -40,
    "selectY": -210,
    "selectDX": 50,
    "selectDY": 230
  },
  "40": {
    "selectX": -30,
    "selectY": -100,
    "selectDX": 60,
    "selectDY": 140
  },
  "41": {
    "selectX": -90,
    "selectY": -140,
    "selectDX": 70,
    "selectDY": 160
  },
  "42": {
    "selectX": -10,
    "selectY": -110,
    "selectDX": 60,
    "selectDY": 150
  },
  "43": {
    "selectX": 0,
    "selectY": -130,
    "selectDX": 90,
    "selectDY": 150
  },
  "44": {
    "selectX": -10,
    "selectY": -210,
    "selectDX": 70,
    "selectDY": 240
  },
  "45": {
    "selectX": -30,
    "selectY": -115,
    "selectDX": 75,
    "selectDY": 145
  },
  "46": {
    "selectX": -45,
    "selectY": -120,
    "selectDX": 85,
    "selectDY": 145
  },
  "47": {
    "selectX": -10,
    "selectY": -60,
    "selectDX": 90,
    "selectDY": 90
  },
  "48": {
    "selectX": -20,
    "selectY": -70,
    "selectDX": 80,
    "selectDY": 85
  },
  "49": {
    "selectX": -115,
    "selectY": -10,
    "selectDX": 160,
    "selectDY": 70
  },
  "50": {
    "selectX": -10,
    "selectY": -10,
    "selectDX": 0,
    "selectDY": 0
  },
  "51": {
    "selectX": -60,
    "selectY": -70,
    "selectDX": 70,
    "selectDY": 90
  },
  "52": {
    "selectX": 10,
    "selectY": -100,
    "selectDX": 80,
    "selectDY": 110
  },
  "53": {
    "selectX": -15,
    "selectY": -70,
    "selectDX": 70,
    "selectDY": 110
  },
  "54": {
    "selectX": -130,
    "selectY": -10,
    "selectDX": 170,
    "selectDY": 100
  },
  "55": {
    "selectX": -10,
    "selectY": -100,
    "selectDX": 90,
    "selectDY": 130
  },
  "56": {
    "selectX": -40,
    "selectY": -20,
    "selectDX": 170,
    "selectDY": 100
  },
  "57": {
    "selectX": -60,
    "selectY": -40,
    "selectDX": 120,
    "selectDY": 90
  },
  "58": {
    "selectX": -75,
    "selectY": -110,
    "selectDX": 100,
    "selectDY": 150
  },
  "59": {
    "selectX": -25,
    "selectY": -110,
    "selectDX": 100,
    "selectDY": 150
  },
  "60": {
    "selectX": -10,
    "selectY": -10,
    "selectDX": 0,
    "selectDY": 0
  },
  "61": {
    "selectX": -10,
    "selectY": -10,
    "selectDX": 0,
    "selectDY": 0
  },
  "62": {
    "selectX": -50,
    "selectY": -110,
    "selectDX": 80,
    "selectDY": 140
  },
  "63": {
    "selectX": -30,
    "selectY": -110,
    "selectDX": 80,
    "selectDY": 140
  },
  "64": {
    "selectX": -10,
    "selectY": -10,
    "selectDX": 0,
    "selectDY": 0
  },
  "65": {
    "selectX": -65,
    "selectY": -150,
    "selectDX": 125,
    "selectDY": 180
  },
  "66": {
    "selectX": -60,
    "selectY": -150,
    "selectDX": 125,
    "selectDY": 180
  },
  "67": {
    "selectX": -65,
    "selectY": -150,
    "selectDX": 125,
    "selectDY": 180
  },
  "68": {
    "selectX": -60,
    "selectY": -150,
    "selectDX": 125,
    "selectDY": 180
  },
  "69": {
    "selectX": -60,
    "selectY": -40,
    "selectDX": 150,
    "selectDY": 160
  },
  "70": {
    "selectX": -90,
    "selectY": -50,
    "selectDX": 160,
    "selectDY": 120
  },
  "71": {
    "selectX": -15,
    "selectY": -90,
    "selectDX": 70,
    "selectDY": 100
  },
  "72": {
    "selectX": -20,
    "selectY": -120,
    "selectDX": 75,
    "selectDY": 100
  },
  "73": {
    "selectX": -10,
    "selectY": -120,
    "selectDX": 100,
    "selectDY": 120
  },
  "74": {
    "selectX": -20,
    "selectY": -110,
    "selectDX": 90,
    "selectDY": 115
  },
  "75": {
    "selectX": -5,
    "selectY": -110,
    "selectDX": 80,
    "selectDY": 110
  },
  "76": {
    "selectX": 0,
    "selectY": -110,
    "selectDX": 95,
    "selectDY": 100
  },
  "77": {
    "selectX": 0,
    "selectY": -70,
    "selectDX": 140,
    "selectDY": 80
  },
  "78": {
    "selectX": -20,
    "selectY": -110,
    "selectDX": 100,
    "selectDY": 110
  },
  "79": {
    "selectX": -40,
    "selectY": -110,
    "selectDX": 0,
    "selectDY": 0
  },
  "80": {
    "selectX": -20,
    "selectY": -110,
    "selectDX": 0,
    "selectDY": 0
  },
  "81": {
    "selectX": -20,
    "selectY": -110,
    "selectDX": 80,
    "selectDY": 115
  },
  "82": {
    "selectX": -20,
    "selectY": -110,
    "selectDX": 80,
    "selectDY": 115
  }
})

/**
 * Resolves the localized display name for a destination level's warp.
 */
export function resolveLevelWarpName(toLevelId: number): { readonly name: string; readonly nameZh: string } | undefined {
  const warpKey = CANONICAL_LEVEL_WARP_KEYS[toLevelId]
  if (!warpKey) return undefined
  const name = CANONICAL_ENG_TBL_DICT[warpKey] ?? warpKey
  const nameZh = CANONICAL_CHI_TBL_DICT[warpKey] ?? name
  return { name, nameZh }
}

/**
 * Resolves the 1.13c LvlWarp.txt hover/selection bounding box and pixel radii for a warp ID.
 */
export function resolveLvlWarpBounds(warpId: number): LvlWarpBounds {
  const geom = CANONICAL_LVLWARP_GEOMETRY[warpId]
  if (geom && geom.selectDX > 0 && geom.selectDY > 0) {
    return {
      selectX: geom.selectX,
      selectY: geom.selectY,
      selectDX: geom.selectDX,
      selectDY: geom.selectDY,
      radiusX: Math.round(geom.selectDX / 2),
      radiusY: Math.round(geom.selectDY / 2),
    }
  }
  return {
    selectX: -28,
    selectY: -20,
    selectDX: 56,
    selectDY: 40,
    radiusX: 28,
    radiusY: 20,
  }
}
