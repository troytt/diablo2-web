/**
 * Canonical 1.13c per-level scripted, DS1-preset, SuperUnique (+ minion), and
 * summon/spawner monster preload tables (`areaId 1..136`, Issue #1775).
 *
 * Ground truth sources (`samples/d2` 1.13c MPQs + `D2Game.dll` / `D2Common.dll`):
 * - `Levels.txt` (`Id 1..136`): Note `Levels.txt` `mon1..10` / `nmon1..10` / `umon1..10`
 *   only list random room density pools and omit DS1-placed, quest-scripted, seal/altar,
 *   and boss-wave monsters (e.g. `131` Throne of Destruction Baal waves `#61..65` including
 *   `571` `baalminion1` Lister, `132` Worldstone Chamber `544` Baal, `108` Chaos Sanctuary
 *   seals + `243` Diablo, `120` Arreat Summit Ancients `540..542`, `136` Uber Tristram `704,705,709`).
 * - `SuperUniques.txt` (all 66 rows `0..65`) + `MonStats.txt` `minion1`/`minion2` +
 *   `D2Game` Wave 2 (`suIdx = 62`) hardcoded Cold Mage (`381` `skmage_cold3`).
 * - `LvlPrest.txt`, `LvlMaze.txt`, `LvlSub.txt`, `MonPreset.txt`, `MonPlace.txt`, and all
 *   `.ds1` type-1 (`UNIT_MONSTER`) placements across Acts 1–5.
 * - `MonStats.txt` `spawn` column and `Skills.txt` monster `summon` column transitive closure.
 */

/**
 * The 7 `MonStats.txt` rows (`0..733`) that have no sprite pack (`file: null` in `entities/index.json`).
 * Skipping them in preload avoids futile pack lookups while keeping real unit rendering untouched.
 */
const NULL_ART_MONSTER_HCINDICES_113C = new Set<number>([
  106, // chaoshorde1
  107, // chaoshorde2
  108, // chaoshorde3
  109, // chaoshorde4
  158, // bird2
  197, // act2child
  320, // fish
])

export function isMonsterArtNull113c(hcIdx: number): boolean {
  return NULL_ART_MONSTER_HCINDICES_113C.has(hcIdx)
}

/**
 * All 66 `SuperUniques.txt` entries (`hcIdx 0..65`) mapped to `[bossHcIdx, ...minionHcIndices]`.
 * Verified against `SuperUniques.txt`, `MonStats.txt` (`minion1`/`minion2`), and `D2Game` `spawnSuperUnique`.
 */
export const SUPERUNIQUE_MONSTER_HCINDICES_113C: Readonly<Record<number, readonly number[]>> =
  Object.freeze({
    0: [58, 19, 20], // Bishibosh (fallenshaman1 + fallen1/2)
    1: [0], // Bonebreak (skeleton1)
    2: [160, 43], // Coldcrow (cr_archer1 + corruptrogue1)
    3: [20, 21], // Rakanishu (fallen2 + fallen3)
    4: [24], // Treehead WoodFist (brute2)
    5: [365], // Griswold
    6: [45, 43, 44, 46, 47], // The Countess (corruptrogue3 + stalkers)
    7: [11], // Pitspawn Fouldog (bighead2)
    8: [66], // Flamespike the Crawler (quillrat4)
    9: [276], // Boneash (skmage_pois3)
    10: [229, 3, 4, 0, 96], // Radament + skeleton4/5/1 + mummy1
    11: [83], // Bloodwitch the Wild (pantherwoman1)
    12: [75], // Fangskin (clawviper3)
    13: [92, 93], // Beetleburst (scarab2 + scarab3)
    14: [97], // Leatherarm (mummy2)
    15: [284, 68, 190, 180], // Coldworm the Burrower (maggotqueen1 + sandmaggot1/egg/baby)
    16: [31], // Fire Eye (sandraider3)
    17: [9], // Dark Elder (zombie5)
    18: [250], // The Summoner
    19: [103, 3, 4], // Ancient Kaa the Soulless (unraveler3 + skeleton4/5)
    20: [402], // The Smith
    21: [125], // Sszark the Burning (arach4)
    22: [281, 144, 399], // Witch Doctor Endugu (fetishshaman4 + fetish4 + fetishblow4)
    23: [129], // Stormtree (thornhulk3)
    24: [47], // Battlemaid Sarina (corruptrogue5)
    25: [138], // Icehawk Riftwing (batdemon3)
    26: [345, 351], // Ismail Vilehand (+ Hydra)
    27: [346, 351], // Geleb Flamefinger (+ Hydra)
    28: [347, 351], // Bremm Sparkfist (+ Hydra)
    29: [345, 351], // Toorc Icefist (+ Hydra)
    30: [346, 351], // Wyand Voidfinger (+ Hydra)
    31: [347, 351], // Maffer Dragonhand (+ Hydra)
    32: [362], // Winged Death (megademon3)
    33: [120], // The Tormentor (willowisp3)
    34: [299, 302], // Taintbreeder (vilemother2 + vilechild2)
    35: [308], // Riftwraith the Cannibal (regurgitator2)
    36: [362], // Infector of Souls (megademon3)
    37: [312, 310, 699], // Lord De Seis (doomknight3 + doomknight1 + dkfig1)
    38: [306], // Grand Vizier of Chaos (fingermage3)
    39: [391], // The Cow King (hellbovine)
    40: [5], // Corpsefire (zombie1)
    41: [409], // Hephasto the Armorer
    42: [479, 453, 454, 461], // Shenk the Overseer (overseer1 + minion1/2 + suicideminion1)
    43: [540], // Talic (ancientbarb1)
    44: [541], // Madawc (ancientbarb2)
    45: [542], // Korlic (ancientbarb3)
    46: [508], // Axe Dweller (bloodlord3)
    47: [437], // Bonesaw Breaker (reanimatedhorde2)
    48: [494], // Dac Farren (imp3)
    49: [453], // Eldritch the Rectifier (minion1)
    50: [529], // Eyeback the Unleashed (deathmauler1)
    51: [443, 494, 495], // Thresh Socket (siegebeast3 + imp3/4)
    52: [440, 438], // Pindleskin (reanimatedhorde5 + defiled warriors)
    53: [501], // Snapchip Shatter (frozenhorror1)
    54: [472], // Anodized Elite (succubus4)
    55: [475], // Vinvear Molech (succubuswitch2)
    56: [481, 455, 456, 461], // Sharptooth Slayer (overseer3 + minion3/4 + suicideminion1)
    57: [496], // Magma Torquer (imp5)
    58: [533], // Blaze Ripper (deathmauler5)
    59: [449], // Frozenstein (snowyeti4)
    60: [526, 453, 461], // Nihlathak Boss (+ Ice Spawn minion1 + frenzied suicideminion1)
    61: [62, 23, 642], // Colenzo the Annihilator (fallenshaman5 + fallen5/6)
    62: [105, 381], // Achmel the Cursed (unraveler5 + skmage_cold3)
    63: [557, 351], // Bartuc the Bloody (baalhighpriest + Hydra)
    64: [558], // Ventar the Unholy (venomlord)
    65: [571], // Lister the Tormentor (baalminion1)
  })

/**
 * Transitive `MonStats.txt` `spawn` column + `Skills.txt` `summon` column + paired/death
 * monster spawns (`hcIdx -> child/companion hcIdx[]`).
 */
export const MONSTER_RELATED_SPAWNS_113C: Readonly<Record<number, readonly number[]>> =
  Object.freeze({
    // Fallen Shamans -> Fallen
    58: [19, 20],
    59: [20, 21],
    60: [21, 22],
    61: [22, 23],
    62: [23, 642],
    645: [642],
    646: [643],
    647: [644],
    // Sand Maggots -> Maggot Eggs -> Maggot Babies
    68: [190, 180],
    69: [191, 181],
    70: [192, 182],
    71: [193, 183],
    72: [194, 184],
    190: [180],
    191: [181],
    192: [182],
    193: [183],
    194: [184],
    679: [681, 680],
    681: [680],
    716: [681, 680],
    // Greater Mummies (Unravelers) -> Skeletons
    101: [0, 1],
    102: [1, 2],
    103: [2, 3],
    104: [3, 4],
    105: [4, 381],
    // Foul Crow Nests -> Foul Crows
    206: [15],
    207: [16],
    208: [17],
    209: [18],
    // Duriel -> Death Maggots
    211: [227],
    // Mummy Sarcophagus -> Dried Corpse
    228: [96],
    // Radament -> Skeletons
    229: [3, 4, 0],
    // Diablo -> Bone Prison (`DiabPrison`)
    243: [340, 341, 342, 343],
    // Izual -> Izual's Spirit (`izualghost`)
    256: [406],
    // Water Watchers (Tentacles 258..260 <-> Heads 261..263)
    258: [261],
    259: [262],
    260: [263],
    261: [258],
    262: [259],
    263: [260],
    // Blood Raven -> Hungry Dead + Skeletons
    267: [6, 7, 0, 1],
    // Fetish Shamans -> Fetishes + Blowers
    278: [141, 396],
    279: [142, 397],
    280: [143, 398],
    281: [144, 399],
    282: [145, 400],
    662: [656, 659],
    663: [657, 660],
    664: [658, 661],
    // Maggot Queens -> Sand Maggots -> Eggs -> Babies
    284: [68, 190, 180],
    285: [69, 191, 181],
    286: [70, 192, 182],
    287: [71, 193, 183],
    288: [72, 194, 184],
    // Vile Mothers -> Vile Children
    298: [301],
    299: [302],
    300: [303],
    675: [677],
    676: [678],
    // Evil Holes -> Fallen
    321: [19],
    322: [19],
    323: [19],
    324: [19],
    325: [19],
    // Diablo Clone -> Bone Prison
    333: [340, 341, 342, 343],
    // Sucker Nests -> Mosquitoes
    334: [114],
    335: [115],
    336: [116],
    337: [117],
    // Council Members -> Hydra
    345: [351],
    346: [351],
    347: [351],
    // Overseers -> Minions + Frenzied Ice Spawn (`Overseer Whip`)
    479: [453, 454, 461],
    480: [454, 455, 461],
    481: [455, 456, 461],
    482: [456, 457, 461],
    483: [457, 458, 461],
    // Minion Spawners -> Minions
    484: [453],
    485: [454],
    486: [455],
    487: [456],
    488: [457],
    489: [458],
    490: [459],
    491: [460],
    // Nihlathak Boss -> Ice Spawn + Frenzied Ice Spawn
    526: [453, 461],
    // Evil Demon Hut -> Demon Imp
    528: [492],
    // Ancient Statues -> Ancient Barbarians
    537: [540],
    538: [541],
    539: [542],
    // Baal Throne -> 5 Throne Waves + Baal Walking To Stairs
    543: [559, 62, 23, 642, 105, 381, 557, 351, 558, 571],
    // Baal -> Baal Clone (`570`) + Festering Appendages (`562..566`)
    544: [570, 562, 563, 564, 565, 566],
    // Putrid Defilers -> Pain Worms (`Impregnate`)
    546: [551],
    547: [552],
    548: [553],
    549: [554],
    550: [555],
    // Bartuc -> Hydra
    557: [351],
    // Pandemonium / Uber Tristram Bosses & Spawners
    704: [725, 726, 727, 728, 729, 730], // Uber Mephisto -> Skeleton/Archer/4-Elem Mages
    705: [712, 340, 341, 342, 343], // Uber Diablo -> Pit Lord (`712`) + Bone Prison
    708: [227], // Uber Duriel -> Death Maggots
    709: [570, 562, 563, 564, 565, 566, 731, 732], // Uber Baal -> Clone + Tentacles + Dark Lord + Specter
    710: [687], // Pandemonium Demon Spawner -> Megademon5
    711: [712], // Pandemonium Demon Hole -> Pit Lord (`712`)
    724: [461], // Furnace Overseer -> Frenzied Ice Spawn
  })

/**
 * Per-level (`areaId 1..136`) canonical scripted, DS1-preset, NPC, SuperUnique, seal/altar,
 * and boss-wave monsters not guaranteed to appear in `Levels.txt` `mon`/`nmon`/`umon`.
 */
export const LEVEL_SCRIPTED_MONSTERS_113C: Readonly<Record<number, readonly number[]>> =
  Object.freeze({
    // === Act 1 (`1..39`) ===
    1: [147, 148, 149, 150, 152, 154, 155, 179, 265, 270, 272], // Rogue Encampment NPCs, Cain, mercs, critters
    2: [179, 266], // Blood Moor (Flavie `navi` at Cold Plains bridge + cow)
    3: [58, 19, 20, 266], // Cold Plains (Bishibosh + Fallen + Flavie)
    4: [20, 21, 58, 179], // Stony Field (Rakanishu + Fallen Shaman camp + cow)
    5: [24, 58, 19, 20], // Dark Wood (Treehead WoodFist + Fallen camp)
    6: [58, 19, 20, 179], // Black Marsh (Fallen camp + cow)
    7: [58, 19, 20], // Tamoe Highland (Fallen camp)
    8: [5], // Den of Evil (Corpsefire)
    9: [160, 43], // Cave Level 1 (Coldcrow)
    17: [267, 6, 7, 0, 1], // Burial Grounds (Blood Raven + Hungry Dead + Skeletons)
    18: [0], // Crypt (Bonebreak)
    25: [45, 43, 44, 46, 47], // Tower Cellar Level 5 (The Countess + Dark Stalkers)
    28: [402, 58, 19, 20], // Barracks (The Smith + Fallen Shaman preset)
    29: [273], // Jail Level 1 (Gargoyle Trap)
    30: [11, 273], // Jail Level 2 (Pitspawn Fouldog + Gargoyle Trap)
    31: [273], // Jail Level 3 (Gargoyle Trap)
    32: [66], // Inner Cloister (Flamespike the Crawler legacy DS1 preset)
    33: [276, 58, 19, 20], // Cathedral (Boneash + Fallen Shaman preset)
    34: [273], // Catacombs Level 1 (Gargoyle Trap)
    35: [273], // Catacombs Level 2 (Gargoyle Trap)
    36: [273], // Catacombs Level 3 (Gargoyle Trap)
    37: [156, 58, 19, 20, 22], // Catacombs Level 4 (Andariel + Dark Shaman / Afflicted presets)
    38: [365, 146, 179, 58, 19, 20], // Tristram (Griswold, Caged Cain, cows, Rakanishu/Shaman)
    39: [391], // Moo Moo Farm (The Cow King + Hell Bovines)

    // === Act 2 (`40..74`) ===
    40: [175, 176, 177, 178, 185, 195, 196, 198, 199, 200, 201, 202, 203, 204, 205, 210, 244, 331, 338], // Lut Gholein NPCs + Greiz merc
    43: [92, 93], // Far Oasis (Beetleburst)
    44: [9, 372], // Lost City (Dark Elder + Fire Tower)
    45: [372], // Valley of Snakes (Fire Tower)
    49: [229, 3, 4, 0, 96], // Sewers Level 3 (Radament + Skeletons + Dried Corpse)
    50: [201, 331, 377, 378], // Harem Level 1 (Jerhyn + Kaelan + Palace Guards)
    51: [377, 378], // Harem Level 2 (Slain Palace Guards)
    54: [31], // Palace Cellar Level 3 (Fire Eye)
    55: [328, 327], // Stony Tomb Level 1 (Wall Traps)
    56: [328, 327, 228, 96], // Halls of the Dead Level 1 (Wall Traps + Sarcophagus)
    57: [328, 327, 228, 96, 372], // Halls of the Dead Level 2 (Wall Traps + Sarcophagus + Fire Tower)
    58: [327, 328, 228, 96], // Claw Viper Temple Level 1 (Wall Traps + Sarcophagus)
    59: [97, 328, 327, 228, 96], // Stony Tomb Level 2 (Creeping Feature + Traps + Sarcophagus)
    60: [83, 228, 96, 328, 327], // Halls of the Dead Level 3 (Bloodwitch the Wild + Sarcophagus + Traps)
    61: [75], // Claw Viper Temple Level 2 (Fangskin)
    64: [284, 68, 190, 180], // Maggot Lair Level 3 (Coldworm the Burrower + Maggots/Eggs/Young)
    66: [103, 3, 4, 228, 96, 327, 328, 372], // Tal Rasha's Tomb 1 (Ancient Kaa may roll in any of 66..72)
    67: [103, 3, 4, 228, 96, 327, 328, 372], // Tal Rasha's Tomb 2
    68: [103, 3, 4, 228, 96, 327, 328, 372], // Tal Rasha's Tomb 3
    69: [103, 3, 4, 228, 96, 327, 328, 372], // Tal Rasha's Tomb 4
    70: [103, 3, 4, 228, 96, 327, 328, 372], // Tal Rasha's Tomb 5
    71: [103, 3, 4, 228, 96, 327, 328, 372], // Tal Rasha's Tomb 6
    72: [103, 3, 4, 228, 96, 327, 328, 372], // Tal Rasha's Tomb 7
    73: [211, 227, 251], // Tal Rasha's Chamber (Duriel + Death Maggots + Tyrael)
    74: [250, 371], // Arcane Sanctuary (The Summoner + Lightning Spire)

    // === Act 3 (`75..102`) ===
    75: [245, 252, 253, 254, 255, 264, 294, 296, 297, 359], // Kurast Docktown NPCs + Hratli + Natalya + Iron Wolf
    76: [262, 259, 278, 141, 396, 327, 328], // Spider Forest (River Stalker + Fetish Shaman + Traps)
    77: [262, 259, 278, 141, 396, 327, 328], // Great Marsh (River Stalker + Bog/Fetish presets)
    78: [129, 262, 259, 278, 141, 396, 327, 328], // Flayer Jungle (Stormtree + Fetish Shaman + River Stalker + Traps)
    83: [345, 346, 351, 261, 258, 366], // Travincal (Ismail, Geleb, Toorc + Hydra + Water Watcher + Compelling Orb)
    85: [125], // Spider Cavern (Sszark the Burning)
    86: [327, 328, 261, 258, 278, 141], // Swampy Pit Level 1
    87: [327, 328, 261, 258, 278, 141], // Swampy Pit Level 2
    88: [327, 328, 261, 258, 278, 141], // Flayer Dungeon Level 1
    89: [327, 328, 261, 258, 278, 141], // Flayer Dungeon Level 2
    90: [327, 328, 261, 258, 278, 141], // Swampy Pit Level 3
    91: [281, 144, 399, 278, 141, 261, 258, 327, 328], // Flayer Dungeon Level 3 (Witch Doctor Endugu + Traps)
    92: [138, 263, 260], // Kurast Sewers Level 1 (Icehawk Riftwing + Stygian Watcher)
    93: [263, 260], // Kurast Sewers Level 2 (Stygian Watcher)
    94: [47], // Ruined Temple (Battlemaid Sarina)
    102: [242, 346, 347, 351, 401], // Durance of Hate Level 3 (Mephisto + Bremm/Wyand/Maffer + Hydra + Evil Force)

    // === Act 4 (`103..108`) ===
    103: [246, 257, 367, 405], // The Pandemonium Fortress (Cain, Halbu, Tyrael, Jamella)
    104: [403, 404], // Outer Steppes (Trapped Souls)
    105: [256, 406, 403, 404], // Plains of Despair (Izual + Izual's Spirit + Trapped Souls)
    106: [309, 392, 393, 403, 404], // City of the Damned (Stained Glass Windows + Corpse Spitter + Trapped Souls)
    107: [409, 408, 153], // River of Flame (Hephasto the Armorer + Hadriel + Hell Meteor)
    108: [
      // Chaos Sanctuary: 3 Seal SuperUniques + Minions + Diablo + Diablo Clone + Bone Prison
      306, 304, 305, // Grand Vizier of Chaos (Storm Caster)
      312, 310, 311, 699, // Lord De Seis (Oblivion Knight + Abyss/Doom Knights)
      362, 360, 361, // Infector of Souls (Venom Lord)
      243, 333, // Diablo + Diablo Clone (shares `di-hth`)
      340, 341, 342, 343, // Diablo's Bone Prison (`boneprison1..4`)
    ],

    // === Act 5 (`109..136`) ===
    109: [149, 511, 512, 513, 514, 515, 520, 560, 561, 567, 568, 569], // Harrogath NPCs (Larzuk, Anya, Malah, Nihlathak, Qual-Kehk, Cain, Barb mercs, Injured Barbs)
    110: [
      479, 453, 454, 461, // Shenk the Overseer + Minions + Frenzied Ice Spawn
      494, 492, 528, // Dac Farren + Demon Imps + Demon Hut
      497, 498, 516, 517, // Siege Catapults + Spotters
      522, 523, 432, 433, 435, 524, 525, // Fighting Barbs + Barricades/Towers
    ],
    111: [
      453, // Eldritch the Rectifier
      481, 455, 456, 461, // Sharptooth Slayer + Minions
      529, // Eyeback the Unleashed
      434, 534, // Prison Door + Captured Barbarians (`a5q2`)
      492, 528, 497, 498, 516, 517, 522, 523, 432, 433, 435, 524, 525,
    ],
    112: [
      443, 494, 495, // Thresh Socket + Imps
      492, 528, 497, 498, 516, 517, 522, 523, 432, 433, 435, 524, 525,
    ],
    114: [449, 527], // Frozen River (Frozenstein + Frozen Anya `drehyaiced`)
    115: [437], // Glacial Trail (Bonesaw Breaker)
    117: [492, 528, 497, 498, 516, 517, 522, 523, 432, 433, 435, 524, 525], // Frozen Tundra siege presets
    119: [501], // Icy Cellar (Snapchip Shatter)
    120: [537, 538, 539, 540, 541, 542], // Arreat Summit (3 Ancient Statues + Talic, Madawc, Korlic)
    121: [440, 438], // Nihlathak's Temple (Pindleskin + Defiled Warriors)
    122: [522], // Halls of Anguish (DS1 barb corpse preset)
    123: [522], // Halls of Pain (DS1 barb corpse preset)
    124: [526, 453, 461], // Halls of Vaught (Nihlathak Boss + Ice Spawn + Frenzied Ice Spawn)
    125: [533, 496], // Abaddon (DS1 Hell entrance / SuperUnique pool)
    126: [472, 475], // Pit of Acheron
    127: [508], // Infernal Pit
    128: [545, 522], // Worldstone Keep Level 1 (`baaltaunt` + DS1 barb preset)
    129: [545, 522], // Worldstone Keep Level 2 (`baaltaunt` + DS1 barb preset)
    130: [545, 522], // Worldstone Keep Level 3 (`baaltaunt` + DS1 barb preset; `Vis1=131` preloads Throne waves!)
    131: [
      // Throne of Destruction (`wthrone.ds1` + `BAAL_THRONE_WAVES_113C`):
      543, // Baal on Throne (`baalthrone`, `41-hth`)
      559, // Baal Walking to Worldstone Portal (`baalcrabstairs`, `42-hth` — also preloads Worldstone Baal!)
      62, 23, 642, // Wave 1: Colenzo the Annihilator (`fallenshaman5`) + Warped Fallen (`23`, `642`)
      105, 381, // Wave 2: Achmel the Cursed (`unraveler5`) + Horadrim Ancient + Burning Dead Mage (`skmage_cold3`)
      557, 351, // Wave 3: Bartuc the Bloody (`baalhighpriest`) + Council Member + Hydra (`351`)
      558, // Wave 4: Ventar the Unholy (`venomlord`) + Venom Lords
      571, // Wave 5: Lister the Tormentor (`baalminion1`, `monster-43-hth.r8` 16.4 MB!) + Minions of Destruction
    ],
    132: [
      // The Worldstone Chamber (`wstone01.ds1` + Baal combat AI + Quest completion):
      544, // Baal (`baalcrab`, `42-hth`)
      570, // Baal Clone (`Vile Effigy`, `42-hth`)
      562, 563, 564, 565, 566, // Festering Appendages (`baaltentacle1..5`, `44-hth`)
      521, // Tyrael (`tyrael3`, `ty-hth`, spawns on Baal death to open Destruction's End)
      574, // Worldstone Chamber effect controller (`worldstoneeffect`)
    ],
    133: [
      // Matron's Den (Pandemonium Run 1):
      707, // Lilith (`uberandariel`, `an-hth`)
      719, 720, 721, 722, 723, // Pandemonium Vile Witches / Dark Lancers / Archers
    ],
    134: [
      // Forgotten Sands (Pandemonium Run 2):
      708, 227, // Uber Duriel (`du-hth`) + Death Maggots
      715, 716, 681, 680, 717, 718, // Hell Swarm, Sand Maggot/Egg/Young, Arach, Scarab
    ],
    135: [
      // Furnace of Pain (Pandemonium Run 3):
      706, // Uber Izual (`22-hth`)
      724, 461, // Forgotten Sands/Furnace Overseer (`overseer6`) + Frenzied Ice Spawn
      710, 687, 711, 712, 713, 714, // Demon Spawner/Hole + Pit Lords + Oblivion Knights + Imps
    ],
    136: [
      // Uber Tristram (Pandemonium Finale):
      704, // Uber Mephisto (`mp-hth`)
      705, // Uber Diablo (`di-hth`)
      709, // Uber Baal (`42-hth`)
      725, 726, 727, 728, 729, 730, // Uber Mephisto summoned Skeletons / Archers / 4-Elem Mages
      711, 712, // Demon Hole + Uber Diablo Pit Lords (`megademon6`)
      731, 732, // Uber Baal Dark Lords (`vampire9`) + Specters (`wraith9`)
      570, 562, 563, 564, 565, 566, // Uber Baal Clone + Festering Appendages
      340, 341, 342, 343, // Uber Diablo Bone Prison
    ],
  })

/**
 * 1-hop red/quest portal monster lookaheads NOT encoded in `Levels.txt` `dwVis`.
 * IMPORTANT: Used ONLY for `neighborMonsterHcIndices` entity art preloading; NEVER added
 * to `neighborAreaIds` so outdoor DRLG seam stitching (`map-service-area-source.ts`) is untouched.
 */
export const LEVEL_PORTAL_NEIGHBOR_AREAS_113C: Readonly<Record<number, readonly number[]>> =
  Object.freeze({
    4: [38], // Stony Field Cairn Stones -> Tristram
    38: [4], // Tristram Portal -> Stony Field
    54: [74], // Palace Cellar Level 3 Portal -> Arcane Sanctuary
    66: [73], // Tal Rasha's Tomb 1 Orifice -> Tal Rasha's Chamber (Duriel)
    67: [73], // Tal Rasha's Tomb 2 Orifice -> Tal Rasha's Chamber
    68: [73], // Tal Rasha's Tomb 3 Orifice -> Tal Rasha's Chamber
    69: [73], // Tal Rasha's Tomb 4 Orifice -> Tal Rasha's Chamber
    70: [73], // Tal Rasha's Tomb 5 Orifice -> Tal Rasha's Chamber
    71: [73], // Tal Rasha's Tomb 6 Orifice -> Tal Rasha's Chamber
    72: [73], // Tal Rasha's Tomb 7 Orifice -> Tal Rasha's Chamber
    74: [46, 54], // Arcane Sanctuary -> Canyon of the Magi / Palace Cellar 3
    109: [121], // Harrogath Anya's Red Portal -> Nihlathak's Temple (Pindleskin)
    121: [109], // Nihlathak's Temple -> Harrogath
    130: [131], // Worldstone Keep Level 3 -> Throne of Destruction (also in Vis1)
    131: [130, 132], // Throne of Destruction -> WSK 3 + Worldstone Chamber (also in Vis0/Vis1)
    132: [131], // Worldstone Chamber -> Throne of Destruction
  })

export function getScriptedMonstersForLevel113c(areaId: number): readonly number[] {
  return LEVEL_SCRIPTED_MONSTERS_113C[areaId] ?? []
}

export function getPortalNeighborAreasForLevel113c(areaId: number): readonly number[] {
  return LEVEL_PORTAL_NEIGHBOR_AREAS_113C[areaId] ?? []
}

/**
 * Compute the closed monster `hcIdx` preload set from base monster IDs and optional
 * `SuperUniques.txt` indices, expanding SuperUnique minions and transitive monster
 * spawner/summon children (`MONSTER_RELATED_SPAWNS_113C`) while excluding null-art rows.
 */
export function expandMonsterPreloadClosure113c(
  baseMonsterHcIndices: Iterable<number>,
  superUniqueIndices?: Iterable<number>,
): number[] {
  const seen = new Set<number>()
  const queue: number[] = []

  const enqueue = (hcIdx: number): void => {
    if (!Number.isInteger(hcIdx) || hcIdx < 0 || isMonsterArtNull113c(hcIdx) || seen.has(hcIdx)) {
      return
    }
    seen.add(hcIdx)
    queue.push(hcIdx)
  }

  for (const hcIdx of baseMonsterHcIndices) {
    enqueue(hcIdx)
  }
  if (superUniqueIndices !== undefined) {
    for (const suIdx of superUniqueIndices) {
      const suList = SUPERUNIQUE_MONSTER_HCINDICES_113C[suIdx]
      if (suList !== undefined) {
        for (const hcIdx of suList) enqueue(hcIdx)
      }
    }
  }

  while (queue.length > 0) {
    const cur = queue.pop()!
    const children = MONSTER_RELATED_SPAWNS_113C[cur]
    if (children !== undefined) {
      for (const child of children) enqueue(child)
    }
  }

  return [...seen]
}
