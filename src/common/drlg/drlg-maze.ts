/**
 * D2Common DRLG maze generator: 1:1 port of D2MOO source/D2Common/src/Drlg/DrlgMaze.cpp
 * (commit 5596f5c, MIT License, Copyright (c) 2020-2025 The Phrozen Keep community).
 */

import { SEED_RollLimitedRandomNumber, SEED_RollRandomNumber } from '../rng/d2-rng.ts'
import {
  DRLG_GetDirectionFromCoordinates,
  DRLG_GetLevel,
  DRLG_GetMinAndMaxCoordinatesFromLevel,
  DRLG_UpdateRoomExCoordinates,
} from './drlg-drlg.ts'
import {
  LVLPREST_ACT1_BARRACKS_COURT_CONNECT,
  LVLPREST_ACT1_BARRACKS_E,
  LVLPREST_ACT1_BARRACKS_FORGE_E,
  LVLPREST_ACT1_BARRACKS_FORGE_N,
  LVLPREST_ACT1_BARRACKS_FORGE_S,
  LVLPREST_ACT1_BARRACKS_FORGE_W,
  LVLPREST_ACT1_BARRACKS_N,
  LVLPREST_ACT1_BARRACKS_NEXT_E,
  LVLPREST_ACT1_BARRACKS_NEXT_N,
  LVLPREST_ACT1_BARRACKS_NEXT_S,
  LVLPREST_ACT1_BARRACKS_NEXT_W,
  LVLPREST_ACT1_BARRACKS_S,
  LVLPREST_ACT1_BARRACKS_W,
  LVLPREST_ACT1_CATACOMBS_E,
  LVLPREST_ACT1_CATACOMBS_N,
  LVLPREST_ACT1_CATACOMBS_NEXT_E,
  LVLPREST_ACT1_CATACOMBS_NEXT_N,
  LVLPREST_ACT1_CATACOMBS_NEXT_S,
  LVLPREST_ACT1_CATACOMBS_NEXT_W,
  LVLPREST_ACT1_CATACOMBS_PREV_EW,
  LVLPREST_ACT1_CATACOMBS_PREV_NS,
  LVLPREST_ACT1_CATACOMBS_PREV_NSEW,
  LVLPREST_ACT1_CATACOMBS_S,
  LVLPREST_ACT1_CATACOMBS_W,
  LVLPREST_ACT1_CATACOMBS_WAYPOINT_E,
  LVLPREST_ACT1_CATACOMBS_WAYPOINT_N,
  LVLPREST_ACT1_CATACOMBS_WAYPOINT_S,
  LVLPREST_ACT1_CATACOMBS_WAYPOINT_W,
  LVLPREST_ACT1_CATHEDRAL,
  LVLPREST_ACT1_CAVE_COLDCROW_E,
  LVLPREST_ACT1_CAVE_COLDCROW_N,
  LVLPREST_ACT1_CAVE_COLDCROW_S,
  LVLPREST_ACT1_CAVE_COLDCROW_W,
  LVLPREST_ACT1_CAVE_DEN_OF_EVIL_E,
  LVLPREST_ACT1_CAVE_DEN_OF_EVIL_N,
  LVLPREST_ACT1_CAVE_DEN_OF_EVIL_S,
  LVLPREST_ACT1_CAVE_DEN_OF_EVIL_W,
  LVLPREST_ACT1_CAVE_DOWN_E,
  LVLPREST_ACT1_CAVE_DOWN_N,
  LVLPREST_ACT1_CAVE_DOWN_S,
  LVLPREST_ACT1_CAVE_DOWN_W,
  LVLPREST_ACT1_CAVE_E,
  LVLPREST_ACT1_CAVE_N,
  LVLPREST_ACT1_CAVE_NEXT_E,
  LVLPREST_ACT1_CAVE_NEXT_N,
  LVLPREST_ACT1_CAVE_NEXT_S,
  LVLPREST_ACT1_CAVE_NEXT_W,
  LVLPREST_ACT1_CAVE_PREV_E,
  LVLPREST_ACT1_CAVE_PREV_N,
  LVLPREST_ACT1_CAVE_PREV_S,
  LVLPREST_ACT1_CAVE_PREV_W,
  LVLPREST_ACT1_CAVE_S,
  LVLPREST_ACT1_CAVE_W,
  LVLPREST_ACT1_CRYPT_BONEBREAK_E,
  LVLPREST_ACT1_CRYPT_BONEBREAK_N,
  LVLPREST_ACT1_CRYPT_BONEBREAK_S,
  LVLPREST_ACT1_CRYPT_BONEBREAK_W,
  LVLPREST_ACT1_CRYPT_CHEST_E,
  LVLPREST_ACT1_CRYPT_CHEST_N,
  LVLPREST_ACT1_CRYPT_CHEST_S,
  LVLPREST_ACT1_CRYPT_CHEST_W,
  LVLPREST_ACT1_CRYPT_E,
  LVLPREST_ACT1_CRYPT_N,
  LVLPREST_ACT1_CRYPT_NEXT_E,
  LVLPREST_ACT1_CRYPT_NEXT_N,
  LVLPREST_ACT1_CRYPT_NEXT_S,
  LVLPREST_ACT1_CRYPT_NEXT_W,
  LVLPREST_ACT1_CRYPT_PORTAL_E,
  LVLPREST_ACT1_CRYPT_PORTAL_N,
  LVLPREST_ACT1_CRYPT_PORTAL_S,
  LVLPREST_ACT1_CRYPT_PORTAL_W,
  LVLPREST_ACT1_CRYPT_PREV_E,
  LVLPREST_ACT1_CRYPT_PREV_N,
  LVLPREST_ACT1_CRYPT_PREV_S,
  LVLPREST_ACT1_CRYPT_PREV_W,
  LVLPREST_ACT1_CRYPT_S,
  LVLPREST_ACT1_CRYPT_W,
  LVLPREST_ACT1_DOE_ENTRANCE,
  LVLPREST_ACT1_GRAVEYARD,
  LVLPREST_ACT1_JAIL_CATH_E,
  LVLPREST_ACT1_JAIL_CATH_N,
  LVLPREST_ACT1_JAIL_CATH_S,
  LVLPREST_ACT1_JAIL_CATH_W,
  LVLPREST_ACT1_JAIL_E,
  LVLPREST_ACT1_JAIL_N,
  LVLPREST_ACT1_JAIL_NEXT_E,
  LVLPREST_ACT1_JAIL_NEXT_N,
  LVLPREST_ACT1_JAIL_NEXT_S,
  LVLPREST_ACT1_JAIL_NEXT_W,
  LVLPREST_ACT1_JAIL_PITSPAWN_E,
  LVLPREST_ACT1_JAIL_PITSPAWN_N,
  LVLPREST_ACT1_JAIL_PITSPAWN_S,
  LVLPREST_ACT1_JAIL_PITSPAWN_W,
  LVLPREST_ACT1_JAIL_PREV_E,
  LVLPREST_ACT1_JAIL_PREV_N,
  LVLPREST_ACT1_JAIL_PREV_S,
  LVLPREST_ACT1_JAIL_PREV_W,
  LVLPREST_ACT1_JAIL_S,
  LVLPREST_ACT1_JAIL_W,
  LVLPREST_ACT1_JAIL_WAYPOINT_E,
  LVLPREST_ACT1_JAIL_WAYPOINT_N,
  LVLPREST_ACT1_JAIL_WAYPOINT_S,
  LVLPREST_ACT1_JAIL_WAYPOINT_W,
  LVLPREST_ACT2_ARCANE_E,
  LVLPREST_ACT2_ARCANE_N,
  LVLPREST_ACT2_ARCANE_S,
  LVLPREST_ACT2_ARCANE_SUMMONER_E,
  LVLPREST_ACT2_ARCANE_SUMMONER_N,
  LVLPREST_ACT2_ARCANE_SUMMONER_S,
  LVLPREST_ACT2_ARCANE_SUMMONER_W,
  LVLPREST_ACT2_ARCANE_W,
  LVLPREST_ACT2_BASEMENT_NE,
  LVLPREST_ACT2_BASEMENT_NW,
  LVLPREST_ACT2_BASEMENT_SE,
  LVLPREST_ACT2_BASEMENT_SW,
  LVLPREST_ACT2_CORRUPT_HAREM_NE,
  LVLPREST_ACT2_CORRUPT_HAREM_NW,
  LVLPREST_ACT2_CORRUPT_HAREM_SE,
  LVLPREST_ACT2_CORRUPT_HAREM_SW,
  LVLPREST_ACT2_DESERT_RUINS_ELDER,
  LVLPREST_ACT2_DURIELS_LAIR,
  LVLPREST_ACT2_LAIR_E,
  LVLPREST_ACT2_LAIR_N,
  LVLPREST_ACT2_LAIR_NEXT_E,
  LVLPREST_ACT2_LAIR_NEXT_N,
  LVLPREST_ACT2_LAIR_NEXT_S,
  LVLPREST_ACT2_LAIR_NEXT_W,
  LVLPREST_ACT2_LAIR_PREV_E,
  LVLPREST_ACT2_LAIR_PREV_N,
  LVLPREST_ACT2_LAIR_PREV_S,
  LVLPREST_ACT2_LAIR_PREV_W,
  LVLPREST_ACT2_LAIR_S,
  LVLPREST_ACT2_LAIR_TIGHT_SPOT_S,
  LVLPREST_ACT2_LAIR_TREASURE_E,
  LVLPREST_ACT2_LAIR_TREASURE_N,
  LVLPREST_ACT2_LAIR_TREASURE_S,
  LVLPREST_ACT2_LAIR_TREASURE_W,
  LVLPREST_ACT2_LAIR_W,
  LVLPREST_ACT2_SEWER_CHEST_E,
  LVLPREST_ACT2_SEWER_CHEST_N,
  LVLPREST_ACT2_SEWER_CHEST_S,
  LVLPREST_ACT2_SEWER_CHEST_W,
  LVLPREST_ACT2_SEWER_E,
  LVLPREST_ACT2_SEWER_N,
  LVLPREST_ACT2_SEWER_NEXT_E,
  LVLPREST_ACT2_SEWER_NEXT_N,
  LVLPREST_ACT2_SEWER_NEXT_S,
  LVLPREST_ACT2_SEWER_NEXT_W,
  LVLPREST_ACT2_SEWER_PREV_E,
  LVLPREST_ACT2_SEWER_PREV_N,
  LVLPREST_ACT2_SEWER_PREV_NS,
  LVLPREST_ACT2_SEWER_PREV_S,
  LVLPREST_ACT2_SEWER_PREV_W,
  LVLPREST_ACT2_SEWER_RADAMENTS_LAIR_E,
  LVLPREST_ACT2_SEWER_RADAMENTS_LAIR_N,
  LVLPREST_ACT2_SEWER_RADAMENTS_LAIR_S,
  LVLPREST_ACT2_SEWER_RADAMENTS_LAIR_W,
  LVLPREST_ACT2_SEWER_S,
  LVLPREST_ACT2_SEWER_W,
  LVLPREST_ACT2_SEWER_WAYPOINT_E,
  LVLPREST_ACT2_SEWER_WAYPOINT_N,
  LVLPREST_ACT2_SEWER_WAYPOINT_S,
  LVLPREST_ACT2_SEWER_WAYPOINT_W,
  LVLPREST_ACT2_TOMB_CHEST_E,
  LVLPREST_ACT2_TOMB_CHEST_N,
  LVLPREST_ACT2_TOMB_CHEST_S,
  LVLPREST_ACT2_TOMB_CHEST_W,
  LVLPREST_ACT2_TOMB_CUBE_E,
  LVLPREST_ACT2_TOMB_CUBE_N,
  LVLPREST_ACT2_TOMB_CUBE_S,
  LVLPREST_ACT2_TOMB_CUBE_W,
  LVLPREST_ACT2_TOMB_E,
  LVLPREST_ACT2_TOMB_KAA_E,
  LVLPREST_ACT2_TOMB_KAA_N,
  LVLPREST_ACT2_TOMB_KAA_S,
  LVLPREST_ACT2_TOMB_KAA_W,
  LVLPREST_ACT2_TOMB_LEATHERARM_E,
  LVLPREST_ACT2_TOMB_LEATHERARM_N,
  LVLPREST_ACT2_TOMB_LEATHERARM_S,
  LVLPREST_ACT2_TOMB_LEATHERARM_W,
  LVLPREST_ACT2_TOMB_N,
  LVLPREST_ACT2_TOMB_NEXT_E,
  LVLPREST_ACT2_TOMB_NEXT_N,
  LVLPREST_ACT2_TOMB_NEXT_S,
  LVLPREST_ACT2_TOMB_NEXT_W,
  LVLPREST_ACT2_TOMB_PREV_NEW,
  LVLPREST_ACT2_TOMB_PREV_NSE,
  LVLPREST_ACT2_TOMB_PREV_NSW,
  LVLPREST_ACT2_TOMB_PREV_SEW,
  LVLPREST_ACT2_TOMB_S,
  LVLPREST_ACT2_TOMB_TAINTED_SUN_X,
  LVLPREST_ACT2_TOMB_TALRASHA_E,
  LVLPREST_ACT2_TOMB_TALRASHA_N,
  LVLPREST_ACT2_TOMB_TALRASHA_S,
  LVLPREST_ACT2_TOMB_TALRASHA_W,
  LVLPREST_ACT2_TOMB_TREASURE_E,
  LVLPREST_ACT2_TOMB_TREASURE_N,
  LVLPREST_ACT2_TOMB_TREASURE_S,
  LVLPREST_ACT2_TOMB_TREASURE_W,
  LVLPREST_ACT2_TOMB_W,
  LVLPREST_ACT2_TOMB_WAYPOINT_E,
  LVLPREST_ACT2_TOMB_WAYPOINT_N,
  LVLPREST_ACT2_TOMB_WAYPOINT_S,
  LVLPREST_ACT2_TOMB_WAYPOINT_W,
  LVLPREST_ACT2_TOWN,
  LVLPREST_ACT3_DUNGEON_E,
  LVLPREST_ACT3_DUNGEON_N,
  LVLPREST_ACT3_DUNGEON_NEXT_E,
  LVLPREST_ACT3_DUNGEON_NEXT_N,
  LVLPREST_ACT3_DUNGEON_NEXT_S,
  LVLPREST_ACT3_DUNGEON_NEXT_W,
  LVLPREST_ACT3_DUNGEON_PREV_E,
  LVLPREST_ACT3_DUNGEON_PREV_N,
  LVLPREST_ACT3_DUNGEON_PREV_S,
  LVLPREST_ACT3_DUNGEON_PREV_W,
  LVLPREST_ACT3_DUNGEON_S,
  LVLPREST_ACT3_DUNGEON_TREASURE_2,
  LVLPREST_ACT3_DUNGEON_W,
  LVLPREST_ACT3_MEPHISTO_E,
  LVLPREST_ACT3_MEPHISTO_N,
  LVLPREST_ACT3_MEPHISTO_NEXT_E,
  LVLPREST_ACT3_MEPHISTO_NEXT_N,
  LVLPREST_ACT3_MEPHISTO_NEXT_S,
  LVLPREST_ACT3_MEPHISTO_NEXT_W,
  LVLPREST_ACT3_MEPHISTO_PREV_E,
  LVLPREST_ACT3_MEPHISTO_PREV_N,
  LVLPREST_ACT3_MEPHISTO_PREV_S,
  LVLPREST_ACT3_MEPHISTO_PREV_W,
  LVLPREST_ACT3_MEPHISTO_S,
  LVLPREST_ACT3_MEPHISTO_W,
  LVLPREST_ACT3_MEPHISTO_WAYPOINT_E,
  LVLPREST_ACT3_MEPHISTO_WAYPOINT_N,
  LVLPREST_ACT3_MEPHISTO_WAYPOINT_S,
  LVLPREST_ACT3_MEPHISTO_WAYPOINT_W,
  LVLPREST_ACT3_SEWER_CHEST_E,
  LVLPREST_ACT3_SEWER_CHEST_N,
  LVLPREST_ACT3_SEWER_CHEST_S,
  LVLPREST_ACT3_SEWER_CHEST_W,
  LVLPREST_ACT3_SEWER_DRAIN_E,
  LVLPREST_ACT3_SEWER_DRAIN_N,
  LVLPREST_ACT3_SEWER_DRAIN_S,
  LVLPREST_ACT3_SEWER_DRAIN_W,
  LVLPREST_ACT3_SEWER_E,
  LVLPREST_ACT3_SEWER_N,
  LVLPREST_ACT3_SEWER_NE,
  LVLPREST_ACT3_SEWER_NW,
  LVLPREST_ACT3_SEWER_PREV_NE,
  LVLPREST_ACT3_SEWER_PREV_NW,
  LVLPREST_ACT3_SEWER_PREV_SE,
  LVLPREST_ACT3_SEWER_PREV_SW,
  LVLPREST_ACT3_SEWER_S,
  LVLPREST_ACT3_SEWER_SE,
  LVLPREST_ACT3_SEWER_SW,
  LVLPREST_ACT3_SEWER_W,
  LVLPREST_ACT3_SPIDER_CHEST_NE,
  LVLPREST_ACT3_SPIDER_CHEST_NW,
  LVLPREST_ACT3_SPIDER_NE,
  LVLPREST_ACT3_SPIDER_NW,
  LVLPREST_ACT3_SPIDER_SE,
  LVLPREST_ACT3_SPIDER_SW,
  LVLPREST_ACT3_TEMPLE_6,
  LVLPREST_ACT4_BRIDGE_1,
  LVLPREST_ACT4_BRIDGE_2,
  LVLPREST_ACT4_LAVA_E,
  LVLPREST_ACT4_LAVA_FORGE_E,
  LVLPREST_ACT4_LAVA_FORGE_W,
  LVLPREST_ACT4_LAVA_W,
  LVLPREST_ACT4_LAVA_WARP_N,
  LVLPREST_ACT4_LAVA_X,
  LVLPREST_ACT5_BAAL_E,
  LVLPREST_ACT5_BAAL_N,
  LVLPREST_ACT5_BAAL_NEXT_E,
  LVLPREST_ACT5_BAAL_NEXT_N,
  LVLPREST_ACT5_BAAL_NEXT_S,
  LVLPREST_ACT5_BAAL_NEXT_W,
  LVLPREST_ACT5_BAAL_PREV_NEW,
  LVLPREST_ACT5_BAAL_PREV_NSE,
  LVLPREST_ACT5_BAAL_PREV_NSW,
  LVLPREST_ACT5_BAAL_PREV_SEW,
  LVLPREST_ACT5_BAAL_S,
  LVLPREST_ACT5_BAAL_W,
  LVLPREST_ACT5_BAAL_WAYPOINT_E,
  LVLPREST_ACT5_BAAL_WAYPOINT_N,
  LVLPREST_ACT5_BAAL_WAYPOINT_S,
  LVLPREST_ACT5_BAAL_WAYPOINT_W,
  LVLPREST_ACT5_BARRICADE_16_SNOW,
  LVLPREST_ACT5_ICE_DOWN_E,
  LVLPREST_ACT5_ICE_DOWN_N,
  LVLPREST_ACT5_ICE_DOWN_S,
  LVLPREST_ACT5_ICE_DOWN_W,
  LVLPREST_ACT5_ICE_E,
  LVLPREST_ACT5_ICE_N,
  LVLPREST_ACT5_ICE_NEXT_E,
  LVLPREST_ACT5_ICE_NEXT_N,
  LVLPREST_ACT5_ICE_NEXT_S,
  LVLPREST_ACT5_ICE_NEXT_W,
  LVLPREST_ACT5_ICE_POOL_A,
  LVLPREST_ACT5_ICE_POOL_B,
  LVLPREST_ACT5_ICE_PREV_E,
  LVLPREST_ACT5_ICE_PREV_N,
  LVLPREST_ACT5_ICE_PREV_S,
  LVLPREST_ACT5_ICE_PREV_W,
  LVLPREST_ACT5_ICE_RIVER_A,
  LVLPREST_ACT5_ICE_RIVER_B,
  LVLPREST_ACT5_ICE_S,
  LVLPREST_ACT5_ICE_THEME_E,
  LVLPREST_ACT5_ICE_THEME_N,
  LVLPREST_ACT5_ICE_THEME_S,
  LVLPREST_ACT5_ICE_THEME_W,
  LVLPREST_ACT5_ICE_W,
  LVLPREST_ACT5_ICE_WAYPOINT_E,
  LVLPREST_ACT5_ICE_WAYPOINT_N,
  LVLPREST_ACT5_ICE_WAYPOINT_S,
  LVLPREST_ACT5_ICE_WAYPOINT_W,
  LVLPREST_ACT5_LAVA_E,
  LVLPREST_ACT5_LAVA_EW,
  LVLPREST_ACT5_LAVA_N,
  LVLPREST_ACT5_LAVA_NS,
  LVLPREST_ACT5_LAVA_S,
  LVLPREST_ACT5_LAVA_W,
  LVLPREST_ACT5_TEMPLE_NE,
  LVLPREST_ACT5_TEMPLE_NE_DOWN,
  LVLPREST_ACT5_TEMPLE_NE_WAYPOINT,
  LVLPREST_ACT5_TEMPLE_NW,
  LVLPREST_ACT5_TEMPLE_NW_DOWN,
  LVLPREST_ACT5_TEMPLE_NW_WAYPOINT,
  LVLPREST_ACT5_TEMPLE_SE_UP,
  LVLPREST_ACT5_TEMPLE_SE_WAYPOINT,
  LVLPREST_ACT5_TEMPLE_SW,
  LVLPREST_ACT5_TEMPLE_SW_DOWN,
  LVLPREST_ACT5_TEMPLE_SW_WAYPOINT,
  LVLPREST_NONE,
  LVLTYPE_ACT1_BARRACKS,
  LVLTYPE_ACT1_CATACOMBS,
  LVLTYPE_ACT1_CAVE,
  LVLTYPE_ACT1_CRYPT,
  LVLTYPE_ACT1_JAIL,
  LVLTYPE_ACT2_ARCANE,
  LVLTYPE_ACT2_BASEMENT,
  LVLTYPE_ACT2_HAREM,
  LVLTYPE_ACT2_LAIR,
  LVLTYPE_ACT2_SEWER,
  LVLTYPE_ACT2_TOMB,
  LVLTYPE_ACT3_DUNGEON,
  LVLTYPE_ACT3_KURAST,
  LVLTYPE_ACT3_SEWER,
  LVLTYPE_ACT3_SPIDER,
  LVLTYPE_ACT4_LAVA,
  LVLTYPE_ACT5_BAAL,
  LVLTYPE_ACT5_ICE_CAVES,
  LVLTYPE_ACT5_LAVA,
  LVLTYPE_ACT5_TEMPLE,
} from './drlg-ids.ts'
import { DRLGPRESET_AllocDrlgMap, DRLGPRESET_BuildArea } from './drlg-preset.ts'
import {
  DRLGMAZE_CheckRoomNotOverlaping,
  DRLGROOM_AddOrth,
  DRLGROOM_AddRoomExToLevel,
  DRLGROOM_AllocDrlgOrthsForRooms,
  DRLGROOM_AllocRoomEx,
  DRLGROOM_FreeRoomEx,
  DRLG_CheckNotOverlappingUsingManhattanDistance,
  DRLG_GetRectanglesManhattanDistanceAndCheckNotOverlapping,
} from './drlg-room.ts'
import {
  ACT_V,
  ALTDIR_EAST,
  ALTDIR_NORTH,
  ALTDIR_SOUTH,
  ALTDIR_WEST,
  DIRECTION_INVALID,
  DRLGPRESETROOMFLAG_HAS_MAP_DS1,
  DRLGTYPE_PRESET,
  LEVEL_ANCIENTTUNNELS,
  LEVEL_BARRACKS,
  LEVEL_CATACOMBSLEV1,
  LEVEL_CATACOMBSLEV2,
  LEVEL_CAVELEV1,
  LEVEL_CELLAROFPITY,
  LEVEL_CHAOSSANCTUM,
  LEVEL_CLAWVIPERTEMPLELEV1,
  LEVEL_CLAWVIPERTEMPLELEV2,
  LEVEL_CRYPT,
  LEVEL_CRYSTALIZEDCAVERNLEV1,
  LEVEL_CRYSTALIZEDCAVERNLEV2,
  LEVEL_DENOFEVIL,
  LEVEL_DURANCEOFHATELEV1,
  LEVEL_DURANCEOFHATELEV2,
  LEVEL_ECHOCHAMBER,
  LEVEL_GLACIALCAVESLEV1,
  LEVEL_GLACIALCAVESLEV2,
  LEVEL_HALLSOFDEATHSCALLING,
  LEVEL_HALLSOFTHEDEADLEV2,
  LEVEL_HALLSOFTHEDEADLEV3,
  LEVEL_HALLSOFVAUGHT,
  LEVEL_JAILLEV1,
  LEVEL_JAILLEV2,
  LEVEL_JAILLEV3,
  LEVEL_MAGGOTLAIRLEV3,
  LEVEL_MAUSOLEUM,
  LEVEL_OUTERCLOISTER,
  LEVEL_PALACECELLARLEV1,
  LEVEL_PALACECELLARLEV3,
  LEVEL_PANDEMONIUMRUN1,
  LEVEL_RIVEROFFLAME,
  LEVEL_SEWERSA3LEV1,
  LEVEL_SEWERSLEV1,
  LEVEL_SEWERSLEV2,
  LEVEL_SEWERSLEV3,
  LEVEL_SPIDERCAVE,
  LEVEL_SPIDERCAVERN,
  LEVEL_STONYTOMBLEV1,
  LEVEL_STONYTOMBLEV2,
  LEVEL_TALRASHASTOMB1,
  LEVEL_TALRASHASTOMB7,
  LEVEL_THEWORLDSTONEKEEPLEV2,
  LEVEL_TOWERCELLARLEV1,
  LEVEL_TOWERCELLARLEV4,
  LEVEL_UNDERGROUNDPASSAGELEV1,
  type D2DrlgBuildStrc,
  type D2DrlgLevelStrc,
  type D2DrlgOrthStrc,
  type D2DrlgRoomStrc,
} from './drlg-types.ts'

export interface D2MazeLevelIdStrc {
  nLevelPrestId1: number
  nLevelPrestId2: number
  nPickedFile: number
  nDirection: number
}

// Helper function (D2DrlgPreset.h)
export function DRLGMAZE_HasMapDS1(pDrlgRoom: D2DrlgRoomStrc): boolean {
  return (pDrlgRoom.pMaze!.dwFlags & DRLGPRESETROOMFLAG_HAS_MAP_DS1) !== 0
}

function DRLGMAZE_CheckIfRoomOverlapsOrth(pNewRoomEx: D2DrlgRoomStrc, pDrlgOrth: D2DrlgOrthStrc | null): boolean {
  while (pDrlgOrth) {
    if (!DRLG_CheckNotOverlappingUsingManhattanDistance(pNewRoomEx.pDrlgCoord, pDrlgOrth.pBox!, 0)) {
      return true
    }
    pDrlgOrth = pDrlgOrth.pNext
  }
  return false
}

function DRLGMAZE_CheckIfRoomOverlapsAythingOtherThanParent(pNewRoomEx: D2DrlgRoomStrc, pParentRoomEx: D2DrlgRoomStrc): boolean {
  return (
    DRLGMAZE_CheckIfRoomOverlapsOrth(pNewRoomEx, pParentRoomEx.pDrlgOrth) ||
    !DRLGMAZE_CheckRoomNotOverlaping(pNewRoomEx.pLevel, pNewRoomEx, pParentRoomEx, 0)
  )
}

function DRLGMAZE_OrthWithDirectionExists(pDrlgRoom: D2DrlgRoomStrc, nDirection: number): boolean {
  let pDrlgOrth = pDrlgRoom.pDrlgOrth
  while (pDrlgOrth) {
    if (pDrlgOrth.nDirection === nDirection) return true
    pDrlgOrth = pDrlgOrth.pNext
  }
  return false
}

//D2Common.0x6FD78E50
export function DRLGMAZE_GetFreeLocationForRoomEast(pLevel: D2DrlgLevelStrc): D2DrlgRoomStrc | null {
  let pResult: D2DrlgRoomStrc | null = null
  for (let pDrlgRoom = pLevel.pFirstRoomEx; pDrlgRoom; pDrlgRoom = pDrlgRoom.pDrlgRoomNext) {
    if (!pResult || pDrlgRoom.pDrlgCoord.nPosX < pResult.pDrlgCoord.nPosX) {
      if (DRLGMAZE_CheckIfMayPlaceAdjacentPresetRoom(pDrlgRoom, ALTDIR_WEST)) {
        pResult = pDrlgRoom
      }
    }
  }
  return pResult
}

//D2Common.0x6FD79240
export function DRLGMAZE_GetFreeLocationForRoomWest(pLevel: D2DrlgLevelStrc): D2DrlgRoomStrc | null {
  let pResult: D2DrlgRoomStrc | null = null
  for (let pDrlgRoom = pLevel.pFirstRoomEx; pDrlgRoom; pDrlgRoom = pDrlgRoom.pDrlgRoomNext) {
    if (!pResult || pDrlgRoom.pDrlgCoord.nPosX > pResult.pDrlgCoord.nPosX) {
      if (DRLGMAZE_CheckIfMayPlaceAdjacentPresetRoom(pDrlgRoom, ALTDIR_EAST)) {
        pResult = pDrlgRoom
      }
    }
  }
  return pResult
}

//D2Common.0x6FD79360
export function DRLGMAZE_GetFreeLocationForRoomNorth(pLevel: D2DrlgLevelStrc): D2DrlgRoomStrc | null {
  let pResult: D2DrlgRoomStrc | null = null
  for (let pDrlgRoom = pLevel.pFirstRoomEx; pDrlgRoom; pDrlgRoom = pDrlgRoom.pDrlgRoomNext) {
    if ((!pResult || pDrlgRoom.pDrlgCoord.nPosY > pResult.pDrlgCoord.nPosY) && DRLGMAZE_CheckIfMayPlaceAdjacentPresetRoom(pDrlgRoom, ALTDIR_SOUTH)) {
      pResult = pDrlgRoom
    }
  }
  return pResult
}

// Helper function
export function DRLGMAZE_GetFreeLocationForRoomSouth(pLevel: D2DrlgLevelStrc): D2DrlgRoomStrc | null {
  let pResult: D2DrlgRoomStrc | null = null
  for (let pDrlgRoom = pLevel.pFirstRoomEx; pDrlgRoom; pDrlgRoom = pDrlgRoom.pDrlgRoomNext) {
    if ((!pResult || pDrlgRoom.pDrlgCoord.nPosY < pResult.pDrlgCoord.nPosY) && DRLGMAZE_CheckIfMayPlaceAdjacentPresetRoom(pDrlgRoom, ALTDIR_NORTH)) {
      pResult = pDrlgRoom
    }
  }
  return pResult
}

//D2Common.0x6FD78F70
export function DRLGMAZE_PickRoomPreset(pDrlgRoom: D2DrlgRoomStrc, bResetFlag: boolean): void {
  const nHardcodedPresetsRemapping: readonly (readonly [number, number, number])[] = [
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_ACT2_CORRUPT_HAREM_SW, LVLPREST_ACT2_BASEMENT_SW, LVLPREST_ACT3_SPIDER_SW],
    [LVLPREST_ACT2_CORRUPT_HAREM_SE, LVLPREST_ACT2_BASEMENT_SE, LVLPREST_ACT3_SPIDER_SE],
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_ACT2_CORRUPT_HAREM_NW, LVLPREST_ACT2_BASEMENT_NW, LVLPREST_ACT3_SPIDER_NW],
    [LVLPREST_ACT2_CORRUPT_HAREM_NE, LVLPREST_ACT2_BASEMENT_NE, LVLPREST_ACT3_SPIDER_NE],
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE, LVLPREST_NONE],
  ]

  const nExpansionHardcodedPresetsRemapping: readonly (readonly [number, number])[] = [
    [LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_ACT5_LAVA_W],
    [LVLPREST_NONE, LVLPREST_ACT5_LAVA_E],
    [LVLPREST_NONE, LVLPREST_ACT5_LAVA_EW],
    [LVLPREST_NONE, LVLPREST_ACT5_LAVA_S],
    [LVLPREST_ACT5_TEMPLE_SW, LVLPREST_NONE],
    [LVLPREST_ACT5_TEMPLE_SE_UP, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_ACT5_LAVA_N],
    [LVLPREST_ACT5_TEMPLE_NW, LVLPREST_NONE],
    [LVLPREST_ACT5_TEMPLE_NE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_ACT5_LAVA_NS],
    [LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE],
    [LVLPREST_NONE, LVLPREST_NONE],
  ]

  let nPickedFile = -1
  let nLevelPrest = 0

  for (let pDrlgOrth = pDrlgRoom.pDrlgOrth; pDrlgOrth; pDrlgOrth = pDrlgOrth.pNext) {
    switch (pDrlgOrth.nDirection) {
      case 0:
        nLevelPrest |= 1
        break
      case 1:
        nLevelPrest |= 8
        break
      case 2:
        nLevelPrest |= 2
        break
      case 3:
        nLevelPrest |= 4
        break
      default:
        break
    }
  }

  switch (pDrlgRoom.pLevel.nLevelType) {
    case LVLTYPE_ACT1_CAVE:
      nLevelPrest += LVLPREST_ACT1_DOE_ENTRANCE
      break
    case LVLTYPE_ACT1_CRYPT:
      nLevelPrest += LVLPREST_ACT1_GRAVEYARD
      break
    case LVLTYPE_ACT1_BARRACKS:
      nLevelPrest += LVLPREST_ACT1_BARRACKS_COURT_CONNECT
      break
    case LVLTYPE_ACT1_JAIL:
      nLevelPrest += LVLPREST_ACT1_BARRACKS_FORGE_N
      break
    case LVLTYPE_ACT1_CATACOMBS:
      nLevelPrest += LVLPREST_ACT1_CATHEDRAL
      break
    case LVLTYPE_ACT2_SEWER:
      nLevelPrest += LVLPREST_ACT2_TOWN
      break
    case LVLTYPE_ACT2_HAREM:
      nLevelPrest = nHardcodedPresetsRemapping[nLevelPrest]![0]
      break
    case LVLTYPE_ACT2_BASEMENT:
      nLevelPrest = nHardcodedPresetsRemapping[nLevelPrest]![1]
      if (pDrlgRoom.pLevel.nLevelId === LEVEL_PALACECELLARLEV1 && nLevelPrest === LVLPREST_ACT2_BASEMENT_NW) {
        nPickedFile = 2
      }
      if (
        pDrlgRoom.pLevel.nLevelId === LEVEL_PALACECELLARLEV3 &&
        (nLevelPrest === LVLPREST_ACT2_BASEMENT_NW || nLevelPrest === LVLPREST_ACT2_BASEMENT_SE)
      ) {
        nPickedFile = 3
      }
      break
    case LVLTYPE_ACT2_TOMB:
      nLevelPrest += LVLPREST_ACT2_DESERT_RUINS_ELDER
      break
    case LVLTYPE_ACT2_LAIR:
      nLevelPrest += LVLPREST_ACT2_DURIELS_LAIR
      break
    case LVLTYPE_ACT2_ARCANE:
      nLevelPrest += LVLPREST_ACT2_LAIR_TIGHT_SPOT_S
      break
    case LVLTYPE_ACT3_KURAST:
      nLevelPrest += LVLPREST_ACT3_TEMPLE_6
      break
    case LVLTYPE_ACT3_SPIDER:
      nLevelPrest = nHardcodedPresetsRemapping[nLevelPrest]![2]
      if (pDrlgRoom.pLevel.nLevelId === LEVEL_SPIDERCAVE && nLevelPrest === LVLPREST_ACT3_SPIDER_NE) {
        nLevelPrest = LVLPREST_ACT3_SPIDER_CHEST_NE
      }
      if (pDrlgRoom.pLevel.nLevelId === LEVEL_SPIDERCAVERN && nLevelPrest === LVLPREST_ACT3_SPIDER_NW) {
        nLevelPrest = LVLPREST_ACT3_SPIDER_CHEST_NW
      }
      break
    case LVLTYPE_ACT3_DUNGEON:
      nLevelPrest += LVLPREST_ACT3_SPIDER_CHEST_NE
      break
    case LVLTYPE_ACT3_SEWER:
      nLevelPrest += LVLPREST_ACT3_DUNGEON_TREASURE_2
      break
    case LVLTYPE_ACT4_LAVA:
      nLevelPrest += LVLPREST_ACT4_LAVA_X
      break
    case LVLTYPE_ACT5_ICE_CAVES:
      if (pDrlgRoom.pLevel.pMaze!.dwRooms[pDrlgRoom.pLevel.pDrlg.nDifficulty] !== 1) {
        nLevelPrest += LVLPREST_ACT5_BARRICADE_16_SNOW
      }
      break
    case LVLTYPE_ACT5_TEMPLE:
      nLevelPrest = nExpansionHardcodedPresetsRemapping[nLevelPrest]![0]
      break
    case LVLTYPE_ACT5_BAAL:
      nLevelPrest += LVLPREST_ACT5_LAVA_NS
      break
    case LVLTYPE_ACT5_LAVA:
      nLevelPrest = nExpansionHardcodedPresetsRemapping[nLevelPrest]![1]
      break
    default:
      throw new Error('sSetChamberPreset() - Some really bad voodoo here!')
  }

  if (nLevelPrest) {
    DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, nLevelPrest, nPickedFile, bResetFlag)
  }
}

//D2Common.0x6FD794A0
export function DRLGMAZE_GenerateLevel(pLevel: D2DrlgLevelStrc): void {
  const nAct1CavePrevIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_N, nLevelPrestId2: LVLPREST_ACT1_CAVE_PREV_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_E, nLevelPrestId2: LVLPREST_ACT1_CAVE_PREV_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_S, nLevelPrestId2: LVLPREST_ACT1_CAVE_PREV_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_W, nLevelPrestId2: LVLPREST_ACT1_CAVE_PREV_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1CaveDOEIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_N, nLevelPrestId2: LVLPREST_ACT1_CAVE_DEN_OF_EVIL_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_E, nLevelPrestId2: LVLPREST_ACT1_CAVE_DEN_OF_EVIL_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_S, nLevelPrestId2: LVLPREST_ACT1_CAVE_DEN_OF_EVIL_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_W, nLevelPrestId2: LVLPREST_ACT1_CAVE_DEN_OF_EVIL_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1CaveDownIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_N, nLevelPrestId2: LVLPREST_ACT1_CAVE_DOWN_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_E, nLevelPrestId2: LVLPREST_ACT1_CAVE_DOWN_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_S, nLevelPrestId2: LVLPREST_ACT1_CAVE_DOWN_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_W, nLevelPrestId2: LVLPREST_ACT1_CAVE_DOWN_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1CaveColdcrowIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_N, nLevelPrestId2: LVLPREST_ACT1_CAVE_COLDCROW_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_E, nLevelPrestId2: LVLPREST_ACT1_CAVE_COLDCROW_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_S, nLevelPrestId2: LVLPREST_ACT1_CAVE_COLDCROW_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_W, nLevelPrestId2: LVLPREST_ACT1_CAVE_COLDCROW_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1CaveNextIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_N, nLevelPrestId2: LVLPREST_ACT1_CAVE_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_E, nLevelPrestId2: LVLPREST_ACT1_CAVE_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_S, nLevelPrestId2: LVLPREST_ACT1_CAVE_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CAVE_W, nLevelPrestId2: LVLPREST_ACT1_CAVE_NEXT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1CryptPrevIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_N, nLevelPrestId2: LVLPREST_ACT1_CRYPT_PREV_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_E, nLevelPrestId2: LVLPREST_ACT1_CRYPT_PREV_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_S, nLevelPrestId2: LVLPREST_ACT1_CRYPT_PREV_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_W, nLevelPrestId2: LVLPREST_ACT1_CRYPT_PREV_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1CryptSpecialIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_N, nLevelPrestId2: LVLPREST_ACT1_CRYPT_BONEBREAK_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_E, nLevelPrestId2: LVLPREST_ACT1_CRYPT_BONEBREAK_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_S, nLevelPrestId2: LVLPREST_ACT1_CRYPT_BONEBREAK_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_W, nLevelPrestId2: LVLPREST_ACT1_CRYPT_BONEBREAK_W, nPickedFile: -1, nDirection: 2 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_N, nLevelPrestId2: LVLPREST_ACT1_CRYPT_PORTAL_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_E, nLevelPrestId2: LVLPREST_ACT1_CRYPT_PORTAL_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_S, nLevelPrestId2: LVLPREST_ACT1_CRYPT_PORTAL_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_W, nLevelPrestId2: LVLPREST_ACT1_CRYPT_PORTAL_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1CryptChestIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_N, nLevelPrestId2: LVLPREST_ACT1_CRYPT_CHEST_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_E, nLevelPrestId2: LVLPREST_ACT1_CRYPT_CHEST_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_S, nLevelPrestId2: LVLPREST_ACT1_CRYPT_CHEST_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_W, nLevelPrestId2: LVLPREST_ACT1_CRYPT_CHEST_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1CryptNextIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_N, nLevelPrestId2: LVLPREST_ACT1_CRYPT_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_E, nLevelPrestId2: LVLPREST_ACT1_CRYPT_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_S, nLevelPrestId2: LVLPREST_ACT1_CRYPT_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CRYPT_W, nLevelPrestId2: LVLPREST_ACT1_CRYPT_NEXT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1JailPrevIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_N, nLevelPrestId2: LVLPREST_ACT1_JAIL_PREV_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_E, nLevelPrestId2: LVLPREST_ACT1_JAIL_PREV_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_S, nLevelPrestId2: LVLPREST_ACT1_JAIL_PREV_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_W, nLevelPrestId2: LVLPREST_ACT1_JAIL_PREV_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1JailCathIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_N, nLevelPrestId2: LVLPREST_ACT1_JAIL_CATH_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_E, nLevelPrestId2: LVLPREST_ACT1_JAIL_CATH_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_S, nLevelPrestId2: LVLPREST_ACT1_JAIL_CATH_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_W, nLevelPrestId2: LVLPREST_ACT1_JAIL_CATH_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1JailNextIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_N, nLevelPrestId2: LVLPREST_ACT1_JAIL_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_E, nLevelPrestId2: LVLPREST_ACT1_JAIL_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_S, nLevelPrestId2: LVLPREST_ACT1_JAIL_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_W, nLevelPrestId2: LVLPREST_ACT1_JAIL_NEXT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1JailWaypointIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_N, nLevelPrestId2: LVLPREST_ACT1_JAIL_WAYPOINT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_E, nLevelPrestId2: LVLPREST_ACT1_JAIL_WAYPOINT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_S, nLevelPrestId2: LVLPREST_ACT1_JAIL_WAYPOINT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_W, nLevelPrestId2: LVLPREST_ACT1_JAIL_WAYPOINT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1JailPitspawnIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_N, nLevelPrestId2: LVLPREST_ACT1_JAIL_PITSPAWN_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_E, nLevelPrestId2: LVLPREST_ACT1_JAIL_PITSPAWN_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_S, nLevelPrestId2: LVLPREST_ACT1_JAIL_PITSPAWN_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_JAIL_W, nLevelPrestId2: LVLPREST_ACT1_JAIL_PITSPAWN_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1CatacombsNextIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_CATACOMBS_N, nLevelPrestId2: LVLPREST_ACT1_CATACOMBS_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CATACOMBS_E, nLevelPrestId2: LVLPREST_ACT1_CATACOMBS_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CATACOMBS_S, nLevelPrestId2: LVLPREST_ACT1_CATACOMBS_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CATACOMBS_W, nLevelPrestId2: LVLPREST_ACT1_CATACOMBS_NEXT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1CatacombsWaypointIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_CATACOMBS_N, nLevelPrestId2: LVLPREST_ACT1_CATACOMBS_WAYPOINT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_CATACOMBS_E, nLevelPrestId2: LVLPREST_ACT1_CATACOMBS_WAYPOINT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_CATACOMBS_S, nLevelPrestId2: LVLPREST_ACT1_CATACOMBS_WAYPOINT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_CATACOMBS_W, nLevelPrestId2: LVLPREST_ACT1_CATACOMBS_WAYPOINT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2ArcaneSummonerIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_ARCANE_N, nLevelPrestId2: LVLPREST_ACT2_ARCANE_SUMMONER_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_ARCANE_E, nLevelPrestId2: LVLPREST_ACT2_ARCANE_SUMMONER_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_ARCANE_S, nLevelPrestId2: LVLPREST_ACT2_ARCANE_SUMMONER_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_ARCANE_W, nLevelPrestId2: LVLPREST_ACT2_ARCANE_SUMMONER_W, nPickedFile: -1, nDirection: 2 },
  ]

  const pDrlgRoom = DRLGROOM_AllocRoomEx(pLevel, DRLGTYPE_PRESET)
  pDrlgRoom.pDrlgCoord.nWidth = pDrlgRoom.pLevel.pMaze!.dwSizeX
  pDrlgRoom.pDrlgCoord.nHeight = pDrlgRoom.pLevel.pMaze!.dwSizeY
  pDrlgRoom.pDrlgCoord.nPosX = pLevel.pLevelCoords.nPosX + Math.trunc((pLevel.pLevelCoords.nWidth - pDrlgRoom.pDrlgCoord.nWidth) / 2)
  pDrlgRoom.pDrlgCoord.nPosY = pLevel.pLevelCoords.nPosY + Math.trunc((pLevel.pLevelCoords.nHeight - pDrlgRoom.pDrlgCoord.nHeight) / 2)

  DRLGROOM_AddRoomExToLevel(pLevel, pDrlgRoom)
  const pLevelFirstRoomEx = pLevel.pFirstRoomEx!

  let nRooms = 0
  let nRand = 0

  switch (pLevel.nLevelType) {
    case LVLTYPE_ACT1_CAVE:
      nRooms = pLevel.pMaze!.dwRooms[pLevel.pDrlg.nDifficulty]!
      if (pLevel.nLevelId === pLevel.pDrlg.nStaffTombLevel) {
        nRooms *= 3
      } else if (pLevel.nLevelId === pLevel.pDrlg.nBossTombLevel) {
        nRooms *= 2
      }

      while (pLevel.nRooms < nRooms) {
        const pRandomRoomEx = DRLGMAZE_GetRandomRoomExFromLevel(pLevel)
        const nDirection = SEED_RollRandomNumber(pRandomRoomEx.pSeed) & 3
        if (!DRLGMAZE_HasMapDS1(pRandomRoomEx)) {
          DRLGMAZE_AddAdjacentMazeRoom(pRandomRoomEx, nDirection, true)
        }
      }

      nRand = SEED_RollRandomNumber(pLevel.pSeed) & 3
      nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1CavePrevIds[nRand]!, nRand)

      if (pLevel.nLevelId === LEVEL_DENOFEVIL) {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1CaveDOEIds[nRand]!, nRand)
      } else {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1CaveDownIds[nRand]!, nRand)
      }

      if (pLevel.nLevelId === LEVEL_CAVELEV1) {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1CaveColdcrowIds[nRand]!, nRand)
      }

      if (pLevel.nLevelId === LEVEL_UNDERGROUNDPASSAGELEV1) {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1CaveNextIds[nRand]!, nRand)
      }
      break

    case LVLTYPE_ACT1_CRYPT:
      nRooms = pLevel.pMaze!.dwRooms[pLevel.pDrlg.nDifficulty]!
      if (pLevel.nLevelId === pLevel.pDrlg.nStaffTombLevel) {
        nRooms *= 3
      } else if (pLevel.nLevelId === pLevel.pDrlg.nBossTombLevel) {
        nRooms *= 2
      }

      while (pLevel.nRooms < nRooms) {
        const pRandomRoomEx = DRLGMAZE_GetRandomRoomExFromLevel(pLevel)
        const nDirection = SEED_RollRandomNumber(pRandomRoomEx.pSeed) & 3
        if (!DRLGMAZE_HasMapDS1(pRandomRoomEx)) {
          DRLGMAZE_AddAdjacentMazeRoom(pRandomRoomEx, nDirection, true)
        }
      }

      nRand = SEED_RollRandomNumber(pLevel.pSeed) & 3
      nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1CryptPrevIds[nRand]!, nRand)
      if (pLevel.nLevelId === LEVEL_CRYPT) {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1CryptSpecialIds[nRand]!, nRand)
      }

      if (pLevel.nLevelId === LEVEL_MAUSOLEUM || pLevel.nLevelId === LEVEL_PANDEMONIUMRUN1) {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1CryptChestIds[nRand]!, nRand)
      }

      if (pLevel.nLevelId >= LEVEL_TOWERCELLARLEV1 && pLevel.nLevelId <= LEVEL_TOWERCELLARLEV4) {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1CryptNextIds[nRand]!, nRand)
      }
      break

    case LVLTYPE_ACT1_BARRACKS:
      DRLGMAZE_InitBasicMazeLayout(pLevel, 2)
      nRooms = pLevel.pMaze!.dwRooms[pLevel.pDrlg.nDifficulty]!
      if (pLevel.nLevelId === pLevel.pDrlg.nStaffTombLevel) {
        nRooms *= 3
      } else if (pLevel.nLevelId === pLevel.pDrlg.nBossTombLevel) {
        nRooms *= 2
      }

      while (pLevel.nRooms < nRooms) {
        const pRandomRoomEx = DRLGMAZE_GetRandomRoomExFromLevel(pLevel)
        const nDirection = SEED_RollRandomNumber(pRandomRoomEx.pSeed) & 3
        if (!DRLGMAZE_HasMapDS1(pRandomRoomEx)) {
          DRLGMAZE_AddAdjacentMazeRoom(pRandomRoomEx, nDirection, true)
        }
      }
      break

    case LVLTYPE_ACT1_JAIL:
      DRLGMAZE_InitBasicMazeLayout(pLevel, 2)
      nRooms = pLevel.pMaze!.dwRooms[pLevel.pDrlg.nDifficulty]!
      if (pLevel.nLevelId === pLevel.pDrlg.nStaffTombLevel) {
        nRooms *= 3
      } else if (pLevel.nLevelId === pLevel.pDrlg.nBossTombLevel) {
        nRooms *= 2
      }

      while (pLevel.nRooms < nRooms) {
        const pRandomRoomEx = DRLGMAZE_GetRandomRoomExFromLevel(pLevel)
        const nDirection = SEED_RollRandomNumber(pRandomRoomEx.pSeed) & 3
        if (!DRLGMAZE_HasMapDS1(pRandomRoomEx)) {
          DRLGMAZE_AddAdjacentMazeRoom(pRandomRoomEx, nDirection, true)
        }
      }

      nRand = SEED_RollRandomNumber(pLevel.pSeed) & 3
      nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1JailPrevIds[nRand]!, nRand)

      if (pLevel.nLevelId === LEVEL_JAILLEV1) {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1JailWaypointIds[nRand]!, nRand)
      }
      if (pLevel.nLevelId === LEVEL_JAILLEV2) {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1JailPitspawnIds[nRand]!, nRand)
      }
      if (pLevel.nLevelId === LEVEL_JAILLEV3) {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1JailCathIds[nRand]!, nRand)
      } else {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1JailNextIds[nRand]!, nRand)
      }
      break

    case LVLTYPE_ACT1_CATACOMBS:
      if (pLevel.nLevelId === LEVEL_CATACOMBSLEV1) {
        DRLGMAZE_AddAdjacentMazeRoom(pLevelFirstRoomEx, ALTDIR_NORTH, true)
        DRLGMAZE_AddAdjacentMazeRoom(pLevelFirstRoomEx, ALTDIR_EAST, true)
        DRLGMAZE_AddAdjacentMazeRoom(pLevelFirstRoomEx, ALTDIR_SOUTH, true)
        DRLGMAZE_AddAdjacentMazeRoom(pLevelFirstRoomEx, ALTDIR_WEST, true)
        DRLGMAZE_SetPickedFileAndPresetId(pLevelFirstRoomEx, LVLPREST_ACT1_CATACOMBS_PREV_NSEW, -1, false)
      } else if (SEED_RollRandomNumber(pLevel.pSeed) & 1) {
        DRLGMAZE_AddAdjacentMazeRoom(pLevelFirstRoomEx, ALTDIR_WEST, true)
        DRLGMAZE_AddAdjacentMazeRoom(pLevelFirstRoomEx, ALTDIR_EAST, true)
        DRLGMAZE_SetPickedFileAndPresetId(pLevelFirstRoomEx, LVLPREST_ACT1_CATACOMBS_PREV_EW, -1, false)
      } else {
        DRLGMAZE_AddAdjacentMazeRoom(pLevelFirstRoomEx, ALTDIR_NORTH, true)
        DRLGMAZE_AddAdjacentMazeRoom(pLevelFirstRoomEx, ALTDIR_SOUTH, true)
        DRLGMAZE_SetPickedFileAndPresetId(pLevelFirstRoomEx, LVLPREST_ACT1_CATACOMBS_PREV_NS, -1, false)
      }

      nRooms = pLevel.pMaze!.dwRooms[pLevel.pDrlg.nDifficulty]!
      if (pLevel.nLevelId === pLevel.pDrlg.nStaffTombLevel) {
        nRooms *= 3
      } else if (pLevel.nLevelId === pLevel.pDrlg.nBossTombLevel) {
        nRooms *= 2
      }

      while (pLevel.nRooms < nRooms) {
        const pRandomRoomEx = DRLGMAZE_GetRandomRoomExFromLevel(pLevel)
        const nDirection = SEED_RollRandomNumber(pRandomRoomEx.pSeed) & 3
        if (!DRLGMAZE_HasMapDS1(pRandomRoomEx)) {
          DRLGMAZE_AddAdjacentMazeRoom(pRandomRoomEx, nDirection, true)
        }
      }

      nRand = SEED_RollRandomNumber(pLevel.pSeed) & 3
      nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1CatacombsNextIds[nRand]!, nRand)

      if (pLevel.nLevelId === LEVEL_CATACOMBSLEV2) {
        nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1CatacombsWaypointIds[nRand]!, nRand)
      }
      break

    case LVLTYPE_ACT2_SEWER:
      DRLGMAZE_InitBasicMazeLayout(pLevel, 2)

      nRooms = pLevel.pMaze!.dwRooms[pLevel.pDrlg.nDifficulty]!
      if (pLevel.nLevelId === pLevel.pDrlg.nStaffTombLevel) {
        nRooms *= 3
      } else if (pLevel.nLevelId === pLevel.pDrlg.nBossTombLevel) {
        nRooms *= 2
      }

      while (pLevel.nRooms < nRooms) {
        const pRandomRoomEx = DRLGMAZE_GetRandomRoomExFromLevel(pLevel)
        const nDirection = SEED_RollRandomNumber(pRandomRoomEx.pSeed) & 3
        if (!DRLGMAZE_HasMapDS1(pRandomRoomEx)) {
          DRLGMAZE_AddAdjacentMazeRoom(pRandomRoomEx, nDirection, true)
        }
      }

      DRLGMAZE_ScanReplaceSpecialAct2SewersPresets(pLevel)
      break

    case LVLTYPE_ACT2_TOMB:
      if (pLevel.nLevelId === LEVEL_CLAWVIPERTEMPLELEV2) {
        pDrlgRoom.pMaze!.nLevelPrest = LVLPREST_ACT2_TOMB_TAINTED_SUN_X
        pDrlgRoom.pMaze!.nPickedFile = -1
        pDrlgRoom.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
      } else {
        DRLGMAZE_PlaceAct2TombPrev_Act5BaalPrev(pLevel)
        DRLGMAZE_BuildBasicMaze(pLevel)
        DRLGMAZE_PlaceAct2TombStuff(pLevel)
      }
      break

    case LVLTYPE_ACT2_LAIR:
      DRLGMAZE_InitBasicMazeLayout(pLevel, 2)
      DRLGMAZE_BuildBasicMaze(pLevel)
      DRLGMAZE_PlaceAct2LairStuff(pLevel)
      break

    case LVLTYPE_ACT2_ARCANE:
      DRLGMAZE_PlaceArcaneSanctuary(pLevel)

      nRand = SEED_RollRandomNumber(pLevel.pSeed) & 3
      nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct2ArcaneSummonerIds[nRand]!, nRand)
      break

    case LVLTYPE_ACT2_HAREM:
    case LVLTYPE_ACT2_BASEMENT:
    case LVLTYPE_ACT3_SPIDER:
      DRLGMAZE_InitBasicMazeLayout(pLevel, 2)
      break

    case LVLTYPE_ACT3_KURAST:
      DRLGMAZE_InitBasicMazeLayout(pLevel, 2)
      DRLGMAZE_BuildBasicMaze(pLevel)
      DRLGMAZE_PlaceAct3MephistoStuff(pLevel)
      break

    case LVLTYPE_ACT3_DUNGEON:
      DRLGMAZE_InitBasicMazeLayout(pLevel, 2)
      DRLGMAZE_BuildBasicMaze(pLevel)
      DRLGMAZE_PlaceAct3DungeonStuff(pLevel)
      break

    case LVLTYPE_ACT3_SEWER:
      if (pLevel.nLevelId === LEVEL_SEWERSA3LEV1) {
        DRLGMAZE_InitBasicMazeLayout(pLevel, 5)
        DRLGMAZE_ReplaceRoomPreset(pLevel, LVLPREST_ACT3_SEWER_SW, LVLPREST_ACT3_SEWER_PREV_SW, -1, false)
        DRLGMAZE_ReplaceRoomPreset(pLevel, LVLPREST_ACT3_SEWER_SE, LVLPREST_ACT3_SEWER_PREV_SE, -1, false)
        DRLGMAZE_ReplaceRoomPreset(pLevel, LVLPREST_ACT3_SEWER_NW, LVLPREST_ACT3_SEWER_PREV_NW, -1, false)
        DRLGMAZE_ReplaceRoomPreset(pLevel, LVLPREST_ACT3_SEWER_NE, LVLPREST_ACT3_SEWER_PREV_NE, -1, false)
      } else {
        DRLGMAZE_InitBasicMazeLayout(pLevel, 2)
      }

      DRLGMAZE_BuildBasicMaze(pLevel)
      DRLGMAZE_PlaceAct3SewerStuff(pLevel)
      break

    case LVLTYPE_ACT4_LAVA:
      DRLGMAZE_BuildBasicMaze(pLevel)
      break

    case LVLTYPE_ACT5_ICE_CAVES:
      switch (pLevel.nLevelId) {
        case LEVEL_CELLAROFPITY:
          if (SEED_RollLimitedRandomNumber(pDrlgRoom.pLevel.pSeed, 2) !== 0) {
            DRLGMAZE_SetPickedFileAndPresetId(pLevelFirstRoomEx, LVLPREST_ACT5_ICE_RIVER_A, -1, false)
          } else {
            DRLGMAZE_SetPickedFileAndPresetId(pLevelFirstRoomEx, LVLPREST_ACT5_ICE_RIVER_B, -1, false)
          }
          break

        case LEVEL_ECHOCHAMBER:
          DRLGMAZE_SetPickedFileAndPresetId(pLevelFirstRoomEx, LVLPREST_ACT5_ICE_POOL_A, -1, false)
          break

        case LEVEL_GLACIALCAVESLEV2:
          DRLGMAZE_SetPickedFileAndPresetId(pLevelFirstRoomEx, LVLPREST_ACT5_ICE_POOL_B, -1, false)
          break

        default:
          DRLGMAZE_InitBasicMazeLayout(pLevel, 2)
          DRLGMAZE_BuildBasicMaze(pLevel)
          DRLGMAZE_PlaceAct5IceStuff(pLevel)
          break
      }
      break

    case LVLTYPE_ACT5_TEMPLE:
      DRLGMAZE_InitBasicMazeLayout(pLevel, 2)
      DRLGMAZE_PlaceAct5TempleStuff(pLevel)
      break

    case LVLTYPE_ACT5_BAAL:
      DRLGMAZE_PlaceAct2TombPrev_Act5BaalPrev(pLevel)
      DRLGMAZE_BuildBasicMaze(pLevel)
      DRLGMAZE_PlaceAct5BaalStuff(pLevel)
      break

    case LVLTYPE_ACT5_LAVA:
      DRLGMAZE_PlaceAct5LavaPresets(pLevel)
      break

    default:
      throw new Error(`MazeLevelGenerate(${pLevel.nLevelId}, type=${pLevel.nLevelType}) - Some really bad voodoo here!`)
  }

  if (pLevel.nLevelId === LEVEL_BARRACKS) {
    DRLGMAZE_PlaceAct1Barracks(pLevel)
  } else if (pLevel.nLevelId === LEVEL_RIVEROFFLAME) {
    DRLGMAZE_PlaceAct4Lava(pLevel)
  } else {
    DRLG_UpdateRoomExCoordinates(pLevel)
  }

  DRLGMAZE_RollAct_1_2_3_BasicPresets(pLevel)
  DRLGMAZE_RollBasicPresets(pLevel)
}

//D2Common.0x6FD79E10
export function DRLGMAZE_SetPickedFileAndPresetId(
  pDrlgRoom: D2DrlgRoomStrc,
  nLevelPrest: number,
  nPickedFile: number,
  bResetFlag: boolean,
): void {
  pDrlgRoom.pMaze!.nPickedFile = nPickedFile
  pDrlgRoom.pMaze!.nLevelPrest = nLevelPrest

  if (bResetFlag) {
    pDrlgRoom.pMaze!.dwFlags &= ~DRLGPRESETROOMFLAG_HAS_MAP_DS1
  } else {
    pDrlgRoom.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
  }
}

//D2Common.0x6FD79E40
export function DRLGMAZE_ReplaceRoomPreset(
  pLevel: D2DrlgLevelStrc,
  nLevelPrestId1: number,
  nLevelPrestId2: number,
  nPickedFile: number,
  bResetFlag: boolean,
): D2DrlgRoomStrc | null {
  for (let pDrlgRoom = pLevel.pFirstRoomEx; pDrlgRoom; pDrlgRoom = pDrlgRoom.pDrlgRoomNext) {
    if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === nLevelPrestId1) {
      DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, nLevelPrestId2, nPickedFile, bResetFlag)
      return pDrlgRoom
    }
  }
  return null
}

//D2Common.0x6FD79EA0
export function DRLGMAZE_AddAdjacentMazeRoom(
  pDrlgRoom: D2DrlgRoomStrc,
  nDirection: number,
  bMergeRooms: boolean,
): D2DrlgRoomStrc | null {
  const pNewRoomEx = DRLGROOM_AllocRoomEx(pDrlgRoom.pLevel, DRLGTYPE_PRESET)
  pNewRoomEx.pDrlgCoord.nWidth = pNewRoomEx.pLevel.pMaze!.dwSizeX
  pNewRoomEx.pDrlgCoord.nHeight = pNewRoomEx.pLevel.pMaze!.dwSizeY

  switch (nDirection) {
    case 0:
      pNewRoomEx.pDrlgCoord.nPosX = pDrlgRoom.pDrlgCoord.nPosX - pDrlgRoom.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pDrlgRoom.pDrlgCoord.nPosY
      break
    case 1:
      pNewRoomEx.pDrlgCoord.nPosX = pDrlgRoom.pDrlgCoord.nPosX
      pNewRoomEx.pDrlgCoord.nPosY = pDrlgRoom.pDrlgCoord.nPosY - pDrlgRoom.pDrlgCoord.nHeight
      break
    case 2:
      pNewRoomEx.pDrlgCoord.nPosX = pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pDrlgRoom.pDrlgCoord.nPosY
      break
    case 3:
      pNewRoomEx.pDrlgCoord.nPosX = pDrlgRoom.pDrlgCoord.nPosX
      pNewRoomEx.pDrlgCoord.nPosY = pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight
      break
    case 4:
      pNewRoomEx.pDrlgCoord.nPosX = pDrlgRoom.pDrlgCoord.nPosX - pDrlgRoom.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pDrlgRoom.pDrlgCoord.nPosY - pDrlgRoom.pDrlgCoord.nHeight
      break
    case 5:
      pNewRoomEx.pDrlgCoord.nPosX = pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pDrlgRoom.pDrlgCoord.nPosY - pDrlgRoom.pDrlgCoord.nHeight
      break
    case 6:
      pNewRoomEx.pDrlgCoord.nPosX = pDrlgRoom.pDrlgCoord.nPosX + pDrlgRoom.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight
      break
    case 7:
      pNewRoomEx.pDrlgCoord.nPosX = pDrlgRoom.pDrlgCoord.nPosX - pDrlgRoom.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pDrlgRoom.pDrlgCoord.nPosY + pDrlgRoom.pDrlgCoord.nHeight
      break
    default:
      break
  }

  for (let i = pDrlgRoom.pDrlgOrth; i; i = i.pNext) {
    if (!DRLG_CheckNotOverlappingUsingManhattanDistance(pNewRoomEx.pDrlgCoord, i.pBox!, 0)) {
      DRLGROOM_FreeRoomEx(pNewRoomEx)
      return null
    }
  }

  if (!DRLGMAZE_CheckRoomNotOverlaping(pNewRoomEx.pLevel, pNewRoomEx, pDrlgRoom, 0)) {
    DRLGROOM_FreeRoomEx(pNewRoomEx)
    return null
  }

  DRLGROOM_AllocDrlgOrthsForRooms(pDrlgRoom, pNewRoomEx, nDirection)

  if (bMergeRooms && !DRLGMAZE_HasMapDS1(pDrlgRoom)) {
    for (let i = pNewRoomEx.pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
      if (i !== pNewRoomEx && !DRLGMAZE_HasMapDS1(i)) {
        const dist = DRLG_GetRectanglesManhattanDistanceAndCheckNotOverlapping(pNewRoomEx.pDrlgCoord, i.pDrlgCoord, 1)
        if (!dist.result) {
          if (dist.nDistanceX !== dist.nDistanceY) {
            let pDrlgOrth = pNewRoomEx.pDrlgOrth
            while (pDrlgOrth && pDrlgOrth.pDrlgRoom !== i) {
              pDrlgOrth = pDrlgOrth.pNext
            }

            if (!pDrlgOrth) {
              if (((SEED_RollRandomNumber(i.pSeed) >>> 0) % 1000) < (pNewRoomEx.pLevel.pMaze!.dwMerge | 0)) {
                const nDir = DRLG_GetDirectionFromCoordinates(i.pDrlgCoord, pNewRoomEx.pDrlgCoord)
                if (nDir !== DIRECTION_INVALID) {
                  DRLGROOM_AllocDrlgOrthsForRooms(i, pNewRoomEx, nDir)
                  DRLGMAZE_PickRoomPreset(i, true)
                }
              }
            }
          }
        }
      }
    }
  }

  DRLGROOM_AddRoomExToLevel(pDrlgRoom.pLevel, pNewRoomEx)
  if (bMergeRooms) {
    DRLGMAZE_PickRoomPreset(pDrlgRoom, true)
  }

  DRLGMAZE_PickRoomPreset(pNewRoomEx, true)
  return pNewRoomEx
}

//D2Common.0x6FD7A110
export function DRLGMAZE_InitBasicMazeLayout(pLevel: D2DrlgLevelStrc, nRoomsPerDirection: number): void {
  const pFirstRoomEx = pLevel.pFirstRoomEx!
  let pDrlgRoom: D2DrlgRoomStrc | null = pLevel.pFirstRoomEx

  for (let i = nRoomsPerDirection - 1; i > 0; i -= 1) {
    let pNewRoomEx: D2DrlgRoomStrc | null = DRLGROOM_AllocRoomEx(pDrlgRoom!.pLevel, DRLGTYPE_PRESET)
    pNewRoomEx.pDrlgCoord.nWidth = pNewRoomEx.pLevel.pMaze!.dwSizeX
    pNewRoomEx.pDrlgCoord.nHeight = pNewRoomEx.pLevel.pMaze!.dwSizeY

    if (DRLGMAZE_LinkMazeRooms(pNewRoomEx, pDrlgRoom!, 1)) {
      DRLGROOM_AllocDrlgOrthsForRooms(pDrlgRoom!, pNewRoomEx, 1)
      DRLGMAZE_MergeMazeRooms(pNewRoomEx)
      DRLGROOM_AddRoomExToLevel(pDrlgRoom!.pLevel, pNewRoomEx)
      DRLGMAZE_PickRoomPreset(pDrlgRoom!, true)
      DRLGMAZE_PickRoomPreset(pNewRoomEx, true)
    } else {
      DRLGROOM_FreeRoomEx(pNewRoomEx)
      pNewRoomEx = null
    }
    pDrlgRoom = pNewRoomEx
  }

  for (let i = nRoomsPerDirection - 1; i > 0; i -= 1) {
    let pNewRoomEx: D2DrlgRoomStrc | null = DRLGROOM_AllocRoomEx(pDrlgRoom!.pLevel, DRLGTYPE_PRESET)
    pNewRoomEx.pDrlgCoord.nWidth = pNewRoomEx.pLevel.pMaze!.dwSizeX
    pNewRoomEx.pDrlgCoord.nHeight = pNewRoomEx.pLevel.pMaze!.dwSizeY

    if (DRLGMAZE_LinkMazeRooms(pNewRoomEx, pDrlgRoom!, 0)) {
      DRLGROOM_AllocDrlgOrthsForRooms(pDrlgRoom!, pNewRoomEx, 0)
      DRLGMAZE_MergeMazeRooms(pNewRoomEx)
      DRLGROOM_AddRoomExToLevel(pDrlgRoom!.pLevel, pNewRoomEx)
      DRLGMAZE_PickRoomPreset(pDrlgRoom!, true)
      DRLGMAZE_PickRoomPreset(pNewRoomEx, true)
    } else {
      DRLGROOM_FreeRoomEx(pNewRoomEx)
      pNewRoomEx = null
    }
    pDrlgRoom = pNewRoomEx
  }

  for (let i = nRoomsPerDirection - 1; i > 0; i -= 1) {
    let pNewRoomEx: D2DrlgRoomStrc | null = DRLGROOM_AllocRoomEx(pDrlgRoom!.pLevel, DRLGTYPE_PRESET)
    pNewRoomEx.pDrlgCoord.nWidth = pNewRoomEx.pLevel.pMaze!.dwSizeX
    pNewRoomEx.pDrlgCoord.nHeight = pNewRoomEx.pLevel.pMaze!.dwSizeY

    if (DRLGMAZE_LinkMazeRooms(pNewRoomEx, pDrlgRoom!, 3)) {
      DRLGROOM_AllocDrlgOrthsForRooms(pDrlgRoom!, pNewRoomEx, 3)
      DRLGMAZE_MergeMazeRooms(pNewRoomEx)
      DRLGROOM_AddRoomExToLevel(pDrlgRoom!.pLevel, pNewRoomEx)
      DRLGMAZE_PickRoomPreset(pDrlgRoom!, true)
      DRLGMAZE_PickRoomPreset(pNewRoomEx, true)
    } else {
      DRLGROOM_FreeRoomEx(pNewRoomEx)
      pNewRoomEx = null
    }
    pDrlgRoom = pNewRoomEx
  }

  for (let i = nRoomsPerDirection - 2; i > 0; i -= 1) {
    let pNewRoomEx: D2DrlgRoomStrc | null = DRLGROOM_AllocRoomEx(pDrlgRoom!.pLevel, DRLGTYPE_PRESET)
    pNewRoomEx.pDrlgCoord.nWidth = pNewRoomEx.pLevel.pMaze!.dwSizeX
    pNewRoomEx.pDrlgCoord.nHeight = pNewRoomEx.pLevel.pMaze!.dwSizeY

    if (DRLGMAZE_LinkMazeRooms(pNewRoomEx, pDrlgRoom!, 2)) {
      DRLGROOM_AllocDrlgOrthsForRooms(pDrlgRoom!, pNewRoomEx, 2)
      DRLGMAZE_MergeMazeRooms(pNewRoomEx)
      DRLGROOM_AddRoomExToLevel(pDrlgRoom!.pLevel, pNewRoomEx)
      DRLGMAZE_PickRoomPreset(pDrlgRoom!, true)
      DRLGMAZE_PickRoomPreset(pNewRoomEx, true)
    } else {
      DRLGROOM_FreeRoomEx(pNewRoomEx)
      pNewRoomEx = null
    }
    pDrlgRoom = pNewRoomEx
  }

  DRLGROOM_AllocDrlgOrthsForRooms(pDrlgRoom!, pFirstRoomEx, 2)
  DRLGMAZE_PickRoomPreset(pDrlgRoom!, true)
  DRLGMAZE_PickRoomPreset(pFirstRoomEx, true)
}

//D2Common.0x6FD7A340
export function DRLGMAZE_LinkMazeRooms(pDrlgRoom1: D2DrlgRoomStrc, pDrlgRoom2: D2DrlgRoomStrc, nDirection: number): boolean {
  switch (nDirection) {
    case 0:
      pDrlgRoom1.pDrlgCoord.nPosX = pDrlgRoom2.pDrlgCoord.nPosX - pDrlgRoom2.pDrlgCoord.nWidth
      pDrlgRoom1.pDrlgCoord.nPosY = pDrlgRoom2.pDrlgCoord.nPosY
      break
    case 1:
      pDrlgRoom1.pDrlgCoord.nPosX = pDrlgRoom2.pDrlgCoord.nPosX
      pDrlgRoom1.pDrlgCoord.nPosY = pDrlgRoom2.pDrlgCoord.nPosY - pDrlgRoom2.pDrlgCoord.nHeight
      break
    case 2:
      pDrlgRoom1.pDrlgCoord.nPosX = pDrlgRoom2.pDrlgCoord.nPosX + pDrlgRoom2.pDrlgCoord.nWidth
      pDrlgRoom1.pDrlgCoord.nPosY = pDrlgRoom2.pDrlgCoord.nPosY
      break
    case 3:
      pDrlgRoom1.pDrlgCoord.nPosX = pDrlgRoom2.pDrlgCoord.nPosX
      pDrlgRoom1.pDrlgCoord.nPosY = pDrlgRoom2.pDrlgCoord.nPosY + pDrlgRoom2.pDrlgCoord.nHeight
      break
    case 4:
      pDrlgRoom1.pDrlgCoord.nPosX = pDrlgRoom2.pDrlgCoord.nPosX - pDrlgRoom2.pDrlgCoord.nWidth
      pDrlgRoom1.pDrlgCoord.nPosY = pDrlgRoom2.pDrlgCoord.nPosY - pDrlgRoom2.pDrlgCoord.nHeight
      break
    case 5:
      pDrlgRoom1.pDrlgCoord.nPosX = pDrlgRoom2.pDrlgCoord.nPosX + pDrlgRoom2.pDrlgCoord.nWidth
      pDrlgRoom1.pDrlgCoord.nPosY = pDrlgRoom2.pDrlgCoord.nPosY - pDrlgRoom2.pDrlgCoord.nHeight
      break
    case 6:
      pDrlgRoom1.pDrlgCoord.nPosX = pDrlgRoom2.pDrlgCoord.nPosX + pDrlgRoom2.pDrlgCoord.nWidth
      pDrlgRoom1.pDrlgCoord.nPosY = pDrlgRoom2.pDrlgCoord.nPosY + pDrlgRoom2.pDrlgCoord.nHeight
      break
    case 7:
      pDrlgRoom1.pDrlgCoord.nPosX = pDrlgRoom2.pDrlgCoord.nPosX - pDrlgRoom2.pDrlgCoord.nWidth
      pDrlgRoom1.pDrlgCoord.nPosY = pDrlgRoom2.pDrlgCoord.nPosY + pDrlgRoom2.pDrlgCoord.nHeight
      break
    default:
      break
  }

  for (let pDrlgOrth = pDrlgRoom2.pDrlgOrth; pDrlgOrth; pDrlgOrth = pDrlgOrth.pNext) {
    if (!DRLG_CheckNotOverlappingUsingManhattanDistance(pDrlgRoom1.pDrlgCoord, pDrlgOrth.pBox!, 0)) {
      return false
    }
  }

  return DRLGMAZE_CheckRoomNotOverlaping(pDrlgRoom1.pLevel, pDrlgRoom1, pDrlgRoom2, 0)
}

//D2Common.0x6FD7A450
export function DRLGMAZE_MergeMazeRooms(pDrlgRoom: D2DrlgRoomStrc): void {
  if (!DRLGMAZE_HasMapDS1(pDrlgRoom)) {
    for (let i = pDrlgRoom.pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
      if (i !== pDrlgRoom && !DRLGMAZE_HasMapDS1(i)) {
        const dist = DRLG_GetRectanglesManhattanDistanceAndCheckNotOverlapping(pDrlgRoom.pDrlgCoord, i.pDrlgCoord, 1)
        if (!dist.result) {
          if (dist.nDistanceX !== dist.nDistanceY) {
            let pDrlgOrth = pDrlgRoom.pDrlgOrth
            while (pDrlgOrth) {
              if (pDrlgOrth.pDrlgRoom === i) break
              pDrlgOrth = pDrlgOrth.pNext
            }

            if (!pDrlgOrth && ((SEED_RollRandomNumber(i.pSeed) >>> 0) % 1000) < (pDrlgRoom.pLevel.pMaze!.dwMerge | 0)) {
              const nDirection = DRLG_GetDirectionFromCoordinates(i.pDrlgCoord, pDrlgRoom.pDrlgCoord)
              if (nDirection !== DIRECTION_INVALID) {
                DRLGROOM_AllocDrlgOrthsForRooms(i, pDrlgRoom, nDirection)
                DRLGMAZE_PickRoomPreset(i, true)
              }
            }
          }
        }
      }
    }
  }
}

//D2Common.0x6FD7A570
export function DRLGMAZE_GetRandomRoomExFromLevel(pLevel: D2DrlgLevelStrc): D2DrlgRoomStrc {
  let pDrlgRoom = pLevel.pFirstRoomEx!
  for (let i = SEED_RollLimitedRandomNumber(pLevel.pSeed, pLevel.nRooms); i; i -= 1) {
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext!
  }
  return pDrlgRoom
}

//D2Common.0x6FD7A5D0
export function DRLGMAZE_BuildBasicMaze(pLevel: D2DrlgLevelStrc): void {
  let nRooms = pLevel.pMaze!.dwRooms[pLevel.pDrlg.nDifficulty]!
  if (pLevel.nLevelId === pLevel.pDrlg.nStaffTombLevel) {
    nRooms *= 3
  }
  if (pLevel.nLevelId === pLevel.pDrlg.nBossTombLevel) {
    nRooms *= 2
  }

  for (let i = pLevel.nRooms; i < nRooms; i = pLevel.nRooms) {
    const pRandomRoomEx = DRLGMAZE_GetRandomRoomExFromLevel(pLevel)
    const nDirection = SEED_RollRandomNumber(pRandomRoomEx.pSeed) & 3

    if (!DRLGMAZE_HasMapDS1(pRandomRoomEx)) {
      const pNewRoomEx = DRLGROOM_AllocRoomEx(pRandomRoomEx.pLevel, DRLGTYPE_PRESET)
      pNewRoomEx.pDrlgCoord.nWidth = pNewRoomEx.pLevel.pMaze!.dwSizeX
      pNewRoomEx.pDrlgCoord.nHeight = pNewRoomEx.pLevel.pMaze!.dwSizeY

      switch (nDirection) {
        case 0:
          pNewRoomEx.pDrlgCoord.nPosX = pRandomRoomEx.pDrlgCoord.nPosX - pRandomRoomEx.pDrlgCoord.nWidth
          pNewRoomEx.pDrlgCoord.nPosY = pRandomRoomEx.pDrlgCoord.nPosY
          break
        case 1:
          pNewRoomEx.pDrlgCoord.nPosX = pRandomRoomEx.pDrlgCoord.nPosX
          pNewRoomEx.pDrlgCoord.nPosY = pRandomRoomEx.pDrlgCoord.nPosY - pRandomRoomEx.pDrlgCoord.nHeight
          break
        case 2:
          pNewRoomEx.pDrlgCoord.nPosX = pRandomRoomEx.pDrlgCoord.nPosX + pRandomRoomEx.pDrlgCoord.nWidth
          pNewRoomEx.pDrlgCoord.nPosY = pRandomRoomEx.pDrlgCoord.nPosY
          break
        case 3:
          pNewRoomEx.pDrlgCoord.nPosX = pRandomRoomEx.pDrlgCoord.nPosX
          pNewRoomEx.pDrlgCoord.nPosY = pRandomRoomEx.pDrlgCoord.nPosY + pRandomRoomEx.pDrlgCoord.nHeight
          break
        case 4:
          pNewRoomEx.pDrlgCoord.nPosX = pRandomRoomEx.pDrlgCoord.nPosX - pRandomRoomEx.pDrlgCoord.nWidth
          pNewRoomEx.pDrlgCoord.nPosY = pRandomRoomEx.pDrlgCoord.nPosY - pRandomRoomEx.pDrlgCoord.nHeight
          break
        case 5:
          pNewRoomEx.pDrlgCoord.nPosX = pRandomRoomEx.pDrlgCoord.nPosX + pRandomRoomEx.pDrlgCoord.nWidth
          pNewRoomEx.pDrlgCoord.nPosY = pRandomRoomEx.pDrlgCoord.nPosY - pRandomRoomEx.pDrlgCoord.nHeight
          break
        case 6:
          pNewRoomEx.pDrlgCoord.nPosX = pRandomRoomEx.pDrlgCoord.nPosX + pRandomRoomEx.pDrlgCoord.nWidth
          pNewRoomEx.pDrlgCoord.nPosY = pRandomRoomEx.pDrlgCoord.nPosY + pRandomRoomEx.pDrlgCoord.nHeight
          break
        case 7:
          pNewRoomEx.pDrlgCoord.nPosX = pRandomRoomEx.pDrlgCoord.nPosX - pRandomRoomEx.pDrlgCoord.nWidth
          pNewRoomEx.pDrlgCoord.nPosY = pRandomRoomEx.pDrlgCoord.nPosY + pRandomRoomEx.pDrlgCoord.nHeight
          break
        default:
          break
      }

      let pDrlgOrth = pRandomRoomEx.pDrlgOrth
      while (pDrlgOrth && DRLG_CheckNotOverlappingUsingManhattanDistance(pNewRoomEx.pDrlgCoord, pDrlgOrth.pBox!, 0)) {
        pDrlgOrth = pDrlgOrth.pNext
      }

      if (!pDrlgOrth) {
        if (DRLGMAZE_CheckRoomNotOverlaping(pNewRoomEx.pLevel, pNewRoomEx, pRandomRoomEx, 0)) {
          DRLGROOM_AllocDrlgOrthsForRooms(pRandomRoomEx, pNewRoomEx, nDirection)
          DRLGMAZE_MergeMazeRooms(pNewRoomEx)
          DRLGROOM_AddRoomExToLevel(pRandomRoomEx.pLevel, pNewRoomEx)
          DRLGMAZE_PickRoomPreset(pRandomRoomEx, true)
          DRLGMAZE_PickRoomPreset(pNewRoomEx, true)
        } else {
          DRLGROOM_FreeRoomEx(pNewRoomEx)
        }
      } else {
        DRLGROOM_FreeRoomEx(pNewRoomEx)
      }
    }
  }
}

const dword_6FDCE850: readonly (readonly [number, number, number])[] = [
  [LVLPREST_ACT5_LAVA_S, 1, 0],
  [LVLPREST_ACT5_LAVA_N, 3, 1],
  [LVLPREST_ACT5_LAVA_S, 1, 1],
  [LVLPREST_ACT5_LAVA_N, 3, 0],
  [LVLPREST_ACT5_LAVA_E, 0, 1],
  [LVLPREST_ACT5_LAVA_W, 2, 0],
  [LVLPREST_ACT5_LAVA_E, 0, 0],
  [LVLPREST_ACT5_LAVA_W, 2, 1],
]

function PlaceLavaPreset(pFirstRoomEx: D2DrlgRoomStrc, nSet: number): void {
  const nDirection = dword_6FDCE850[nSet]![1]

  const pNewRoomEx = DRLGROOM_AllocRoomEx(pFirstRoomEx.pLevel, DRLGTYPE_PRESET)
  pNewRoomEx.pDrlgCoord.nWidth = pNewRoomEx.pLevel.pMaze!.dwSizeX
  pNewRoomEx.pDrlgCoord.nHeight = pNewRoomEx.pLevel.pMaze!.dwSizeY

  if (DRLGMAZE_LinkMazeRooms(pNewRoomEx, pFirstRoomEx, nDirection)) {
    DRLGROOM_AllocDrlgOrthsForRooms(pFirstRoomEx, pNewRoomEx, nDirection)
    DRLGROOM_AddRoomExToLevel(pFirstRoomEx.pLevel, pNewRoomEx)
    DRLGMAZE_PickRoomPreset(pFirstRoomEx, true)

    pNewRoomEx.pMaze!.nLevelPrest = dword_6FDCE850[nSet]![0]
    pNewRoomEx.pMaze!.nPickedFile = dword_6FDCE850[nSet]![2]
    pNewRoomEx.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
  } else {
    DRLGROOM_FreeRoomEx(pNewRoomEx)
  }
}

//D2Common.0x6FD7A830
export function DRLGMAZE_PlaceAct5LavaPresets(pLevel: D2DrlgLevelStrc): void {
  const nSet = 2 * (SEED_RollRandomNumber(pLevel.pFirstRoomEx!.pSeed) & 3)
  const pLevelFirstRoom = pLevel.pFirstRoomEx!
  PlaceLavaPreset(pLevelFirstRoom, nSet)
  PlaceLavaPreset(pLevelFirstRoom, nSet + 1)
  DRLGMAZE_FillBlankMazeSpaces(pLevel, LVLPREST_ACT4_LAVA_X, null)
}

//D2Common.0x6FD7A9B0
export function DRLGMAZE_FillBlankMazeSpaces(pLevel: D2DrlgLevelStrc, nLevelPrest: number, pIgnoreRoomEx: D2DrlgRoomStrc | null): void {
  const nRooms = pLevel.nRooms
  if (nRooms > 0) {
    const pDrlgRoomArray: D2DrlgRoomStrc[] = []
    let pTemp = pLevel.pFirstRoomEx
    for (let i = 0; i < nRooms; i += 1) {
      pDrlgRoomArray.push(pTemp!)
      pTemp = pTemp!.pDrlgRoomNext
    }

    for (let i = 0; i < nRooms; i += 1) {
      const pCurrentRoomEx = pDrlgRoomArray[i]!
      if (pCurrentRoomEx !== pIgnoreRoomEx) {
        for (let j = 0; j < 8; j += 1) {
          const pNewRoomEx = DRLGROOM_AllocRoomEx(pCurrentRoomEx.pLevel, DRLGTYPE_PRESET)
          pNewRoomEx.pDrlgCoord.nWidth = pNewRoomEx.pLevel.pMaze!.dwSizeX
          pNewRoomEx.pDrlgCoord.nHeight = pNewRoomEx.pLevel.pMaze!.dwSizeY

          if (DRLGMAZE_LinkMazeRooms(pNewRoomEx, pCurrentRoomEx, j)) {
            DRLGROOM_AllocDrlgOrthsForRooms(pCurrentRoomEx, pNewRoomEx, j)
            DRLGROOM_AddRoomExToLevel(pCurrentRoomEx.pLevel, pNewRoomEx)
            DRLGMAZE_SetPickedFileAndPresetId(pNewRoomEx, nLevelPrest, -1, false)
          } else {
            DRLGROOM_FreeRoomEx(pNewRoomEx)
          }
        }
      }
    }
  }
}

//D2Common.0x6FD7AAC0
export function DRLGMAZE_PlaceAct2TombPrev_Act5BaalPrev(pLevel: D2DrlgLevelStrc): void {
  const dword_6FDCE8B4: readonly (readonly [number, number])[] = [
    [LVLPREST_ACT2_TOMB_PREV_NSE, LVLPREST_ACT5_BAAL_PREV_NSE],
    [LVLPREST_ACT2_TOMB_PREV_SEW, LVLPREST_ACT5_BAAL_PREV_SEW],
    [LVLPREST_ACT2_TOMB_PREV_NSW, LVLPREST_ACT5_BAAL_PREV_NSW],
    [LVLPREST_ACT2_TOMB_PREV_NEW, LVLPREST_ACT5_BAAL_PREV_NEW],
  ]

  const pLevelFirstRoomEx = pLevel.pFirstRoomEx!
  let nDirection = SEED_RollRandomNumber(pLevel.pSeed) & 3
  for (let i = 0; i < 3; i += 1) {
    const pDrlgRoom = DRLGROOM_AllocRoomEx(pLevelFirstRoomEx.pLevel, DRLGTYPE_PRESET)
    DRLGMAZE_SetRoomSize(pDrlgRoom)

    if (DRLGMAZE_LinkMazeRooms(pDrlgRoom, pLevelFirstRoomEx, nDirection)) {
      DRLGROOM_AllocDrlgOrthsForRooms(pLevelFirstRoomEx, pDrlgRoom, nDirection)
      DRLGMAZE_MergeMazeRooms(pDrlgRoom)
      DRLGROOM_AddRoomExToLevel(pLevelFirstRoomEx.pLevel, pDrlgRoom)
      DRLGMAZE_PickRoomPreset(pLevelFirstRoomEx, true)
      DRLGMAZE_PickRoomPreset(pDrlgRoom, true)
    } else {
      DRLGROOM_FreeRoomEx(pDrlgRoom)
    }

    nDirection = (nDirection + 1) % 4
  }

  if (pLevel.nLevelType === LVLTYPE_ACT2_TOMB) {
    pLevelFirstRoomEx.pMaze!.nLevelPrest = dword_6FDCE8B4[nDirection]![0]
    pLevelFirstRoomEx.pMaze!.nPickedFile = -1
    pLevelFirstRoomEx.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
  } else if (pLevel.nLevelType === LVLTYPE_ACT5_BAAL) {
    pLevelFirstRoomEx.pMaze!.nLevelPrest = dword_6FDCE8B4[nDirection]![1]
    pLevelFirstRoomEx.pMaze!.nPickedFile = -1
    pLevelFirstRoomEx.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
  }
}

function DRLGMAZE_PlaceRoomForArcaneBranch(pParentRoom: D2DrlgRoomStrc, nArcaneMapBranch: number): D2DrlgRoomStrc | null {
  const pDrlgRoom = DRLGMAZE_PlaceAdjacentPresetRoom(pParentRoom, nArcaneMapBranch % 4, true)
  if (pDrlgRoom) {
    DRLGMAZE_PickRoomPreset(pParentRoom, true)
    DRLGMAZE_PickRoomPreset(pDrlgRoom, true)
    return pDrlgRoom
  }
  return null
}

function DRLGMAZE_ArcaneSanctuaryDirectionFromRoomIdx(nBranchDirection: number, nBranchRoomIdx: number): number {
  switch (nBranchRoomIdx) {
    default:
      return nBranchDirection
    case 2:
    case 12:
      return nBranchDirection + 3
    case 7:
    case 9:
      return nBranchDirection + 1
    case 10:
    case 11:
    case 13:
    case 14:
      return nBranchDirection + 2
  }
}

//D2Common.0x6FD7ABC0
export function DRLGMAZE_PlaceArcaneSanctuary(pLevel: D2DrlgLevelStrc): void {
  const pLevelFirstRoomEx = pLevel.pFirstRoomEx!
  const nRand = SEED_RollRandomNumber(pLevel.pSeed) & 3
  const nRoomsPerBranch = 15
  const nBranchDirections = 4
  const pDrlgRoomArray: (D2DrlgRoomStrc | null)[] = new Array(nRoomsPerBranch * nBranchDirections).fill(null)

  for (let nBranchDirection = 0; nBranchDirection < nBranchDirections; nBranchDirection += 1) {
    let pParentRoom: D2DrlgRoomStrc | null = pLevelFirstRoomEx
    for (let nBranchRoomIdx = 0; nBranchRoomIdx < nRoomsPerBranch; nBranchRoomIdx += 1) {
      const nRoomDirection = DRLGMAZE_ArcaneSanctuaryDirectionFromRoomIdx(nBranchDirection, nBranchRoomIdx)
      const pNewRoom = DRLGMAZE_PlaceRoomForArcaneBranch(pParentRoom!, nRoomDirection)
      if (nBranchRoomIdx !== 8 && nBranchRoomIdx !== 12) {
        pDrlgRoomArray[nBranchRoomIdx + nBranchDirection * nRoomsPerBranch] = pNewRoom
        pParentRoom = pNewRoom
      }
    }
  }

  for (let i = 0; i < pDrlgRoomArray.length; i += 1) {
    if (pDrlgRoomArray[i]) {
      pDrlgRoomArray[i]!.pMaze!.nPickedFile = (nRand + Math.trunc(i / 15)) % 4
    }
  }

  pLevelFirstRoomEx.pMaze!.nPickedFile = 4
}

//D2Common.0x6FD7AFD0
export function DRLGMAZE_PlaceAdjacentPresetRoom(
  pParentRoomEx: D2DrlgRoomStrc,
  nDirection: number,
  bMergeRooms: boolean,
): D2DrlgRoomStrc | null {
  const pNewRoomEx = DRLGROOM_AllocRoomEx(pParentRoomEx.pLevel, DRLGTYPE_PRESET)
  pNewRoomEx.pDrlgCoord.nWidth = pNewRoomEx.pLevel.pMaze!.dwSizeX
  pNewRoomEx.pDrlgCoord.nHeight = pNewRoomEx.pLevel.pMaze!.dwSizeY

  switch (nDirection) {
    case 0:
      pNewRoomEx.pDrlgCoord.nPosX = pParentRoomEx.pDrlgCoord.nPosX - pParentRoomEx.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pParentRoomEx.pDrlgCoord.nPosY
      break
    case 1:
      pNewRoomEx.pDrlgCoord.nPosX = pParentRoomEx.pDrlgCoord.nPosX
      pNewRoomEx.pDrlgCoord.nPosY = pParentRoomEx.pDrlgCoord.nPosY - pParentRoomEx.pDrlgCoord.nHeight
      break
    case 2:
      pNewRoomEx.pDrlgCoord.nPosX = pParentRoomEx.pDrlgCoord.nPosX + pParentRoomEx.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pParentRoomEx.pDrlgCoord.nPosY
      break
    case 3:
      pNewRoomEx.pDrlgCoord.nPosX = pParentRoomEx.pDrlgCoord.nPosX
      pNewRoomEx.pDrlgCoord.nPosY = pParentRoomEx.pDrlgCoord.nPosY + pParentRoomEx.pDrlgCoord.nHeight
      break
    case 4:
      pNewRoomEx.pDrlgCoord.nPosX = pParentRoomEx.pDrlgCoord.nPosX - pParentRoomEx.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pParentRoomEx.pDrlgCoord.nPosY - pParentRoomEx.pDrlgCoord.nHeight
      break
    case 5:
      pNewRoomEx.pDrlgCoord.nPosX = pParentRoomEx.pDrlgCoord.nPosX + pParentRoomEx.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pParentRoomEx.pDrlgCoord.nPosY - pParentRoomEx.pDrlgCoord.nHeight
      break
    case 6:
      pNewRoomEx.pDrlgCoord.nPosX = pParentRoomEx.pDrlgCoord.nPosX + pParentRoomEx.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pParentRoomEx.pDrlgCoord.nPosY + pParentRoomEx.pDrlgCoord.nHeight
      break
    case 7:
      pNewRoomEx.pDrlgCoord.nPosX = pParentRoomEx.pDrlgCoord.nPosX - pParentRoomEx.pDrlgCoord.nWidth
      pNewRoomEx.pDrlgCoord.nPosY = pParentRoomEx.pDrlgCoord.nPosY + pParentRoomEx.pDrlgCoord.nHeight
      break
    default:
      break
  }

  if (DRLGMAZE_CheckIfRoomOverlapsAythingOtherThanParent(pNewRoomEx, pParentRoomEx)) {
    DRLGROOM_FreeRoomEx(pNewRoomEx)
    return null
  }

  DRLGROOM_AllocDrlgOrthsForRooms(pParentRoomEx, pNewRoomEx, nDirection)

  if (bMergeRooms) {
    DRLGMAZE_MergeMazeRooms(pNewRoomEx)
  }

  DRLGROOM_AddRoomExToLevel(pParentRoomEx.pLevel, pNewRoomEx)
  return pNewRoomEx
}

//D2Common.0x6FD7B230
export function DRLGMAZE_ScanReplaceSpecialPreset(
  pLevel: D2DrlgLevelStrc,
  pMazeInit: D2MazeLevelIdStrc,
  nRand: number | null,
): number {
  for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
    if (!DRLGMAZE_HasMapDS1(i) && i.pMaze!.nLevelPrest === pMazeInit.nLevelPrestId1) {
      i.pMaze!.nLevelPrest = pMazeInit.nLevelPrestId2
      i.pMaze!.nPickedFile = pMazeInit.nPickedFile
      i.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
      return nRand !== null ? (nRand + 1) % 4 : 0
    }
  }

  for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
    if (!DRLGMAZE_HasMapDS1(i)) {
      const pNewRoomEx = DRLGROOM_AllocRoomEx(i.pLevel, DRLGTYPE_PRESET)
      pNewRoomEx.pDrlgCoord.nWidth = pNewRoomEx.pLevel.pMaze!.dwSizeX
      pNewRoomEx.pDrlgCoord.nHeight = pNewRoomEx.pLevel.pMaze!.dwSizeY

      if (!DRLGMAZE_LinkMazeRooms(pNewRoomEx, i, pMazeInit.nDirection)) {
        DRLGROOM_FreeRoomEx(pNewRoomEx)
      } else {
        DRLGROOM_AllocDrlgOrthsForRooms(i, pNewRoomEx, pMazeInit.nDirection)
        DRLGROOM_AddRoomExToLevel(i.pLevel, pNewRoomEx)

        DRLGMAZE_PickRoomPreset(i, true)

        pNewRoomEx.pMaze!.nLevelPrest = pMazeInit.nLevelPrestId2
        pNewRoomEx.pMaze!.nPickedFile = pMazeInit.nPickedFile
        pNewRoomEx.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
        break
      }
    }
  }

  return nRand !== null ? (nRand + 1) % 4 : 0
}

//D2Common.0x6FD7B330
export function DRLGMAZE_ScanReplaceSpecialAct2SewersPresets(pLevel: D2DrlgLevelStrc): void {
  const nAct2SewerPrevIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_N, nLevelPrestId2: LVLPREST_ACT2_SEWER_PREV_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_E, nLevelPrestId2: LVLPREST_ACT2_SEWER_PREV_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_S, nLevelPrestId2: LVLPREST_ACT2_SEWER_PREV_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_W, nLevelPrestId2: LVLPREST_ACT2_SEWER_PREV_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2SewerNextIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_N, nLevelPrestId2: LVLPREST_ACT2_SEWER_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_E, nLevelPrestId2: LVLPREST_ACT2_SEWER_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_S, nLevelPrestId2: LVLPREST_ACT2_SEWER_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_W, nLevelPrestId2: LVLPREST_ACT2_SEWER_NEXT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2SewerWaypointIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_N, nLevelPrestId2: LVLPREST_ACT2_SEWER_WAYPOINT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_E, nLevelPrestId2: LVLPREST_ACT2_SEWER_WAYPOINT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_S, nLevelPrestId2: LVLPREST_ACT2_SEWER_WAYPOINT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_W, nLevelPrestId2: LVLPREST_ACT2_SEWER_WAYPOINT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2SewerRadamentIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_N, nLevelPrestId2: LVLPREST_ACT2_SEWER_RADAMENTS_LAIR_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_E, nLevelPrestId2: LVLPREST_ACT2_SEWER_RADAMENTS_LAIR_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_S, nLevelPrestId2: LVLPREST_ACT2_SEWER_RADAMENTS_LAIR_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_W, nLevelPrestId2: LVLPREST_ACT2_SEWER_RADAMENTS_LAIR_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2SewerChestIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_N, nLevelPrestId2: LVLPREST_ACT2_SEWER_CHEST_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_E, nLevelPrestId2: LVLPREST_ACT2_SEWER_CHEST_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_S, nLevelPrestId2: LVLPREST_ACT2_SEWER_CHEST_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_SEWER_W, nLevelPrestId2: LVLPREST_ACT2_SEWER_CHEST_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nDirection = (2 * (SEED_RollRandomNumber(pLevel.pSeed) & 1)) | 1
  let nRand = SEED_RollRandomNumber(pLevel.pSeed) & 3

  switch (pLevel.nLevelId) {
    case LEVEL_SEWERSLEV1: {
      let pDrlgRoom1: D2DrlgRoomStrc | null = null
      for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
        if ((!pDrlgRoom1 || i.pDrlgCoord.nPosY < pDrlgRoom1.pDrlgCoord.nPosY) && DRLGMAZE_CheckIfMayPlaceAdjacentPresetRoom(i, ALTDIR_NORTH)) {
          pDrlgRoom1 = i
        }
      }

      let pDrlgRoom2 = DRLGMAZE_PlaceAdjacentPresetRoom(pDrlgRoom1!, ALTDIR_NORTH, true)
      if (pDrlgRoom2) {
        DRLGMAZE_PickRoomPreset(pDrlgRoom1!, true)
        DRLGMAZE_PickRoomPreset(pDrlgRoom2, true)
      }

      let pDrlgRoom3 = DRLGMAZE_PlaceAdjacentPresetRoom(pDrlgRoom2!, ALTDIR_NORTH, true)
      if (pDrlgRoom3) {
        DRLGMAZE_PickRoomPreset(pDrlgRoom2!, true)
        DRLGMAZE_PickRoomPreset(pDrlgRoom3, true)
      }

      let pDrlgRoom4 = DRLGMAZE_PlaceAdjacentPresetRoom(pDrlgRoom3!, ALTDIR_WEST, false)
      if (pDrlgRoom4) {
        DRLGMAZE_PickRoomPreset(pDrlgRoom3!, true)
        DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom4, LVLPREST_ACT2_SEWER_PREV_E, 0, false)
      }

      pDrlgRoom1 = null
      for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
        if ((!pDrlgRoom1 || i.pDrlgCoord.nPosX > pDrlgRoom1.pDrlgCoord.nPosX) && DRLGMAZE_CheckIfMayPlaceAdjacentPresetRoom(i, ALTDIR_EAST)) {
          pDrlgRoom1 = i
        }
      }

      pDrlgRoom2 = DRLGMAZE_PlaceAdjacentPresetRoom(pDrlgRoom1!, ALTDIR_EAST, true)
      if (pDrlgRoom2) {
        DRLGMAZE_PickRoomPreset(pDrlgRoom1!, true)
        DRLGMAZE_PickRoomPreset(pDrlgRoom2, true)
      }

      pDrlgRoom3 = DRLGMAZE_PlaceAdjacentPresetRoom(pDrlgRoom2!, ALTDIR_EAST, true)
      if (pDrlgRoom3) {
        DRLGMAZE_PickRoomPreset(pDrlgRoom2!, true)
        DRLGMAZE_PickRoomPreset(pDrlgRoom3, true)
      }

      pDrlgRoom4 = DRLGMAZE_PlaceAdjacentPresetRoom(pDrlgRoom3!, nDirection, false)
      if (pDrlgRoom4) {
        DRLGMAZE_PickRoomPreset(pDrlgRoom3!, true)
        DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom4, LVLPREST_ACT2_SEWER_PREV_NS, 0, false)
      }

      const pDrlgRoom5 = DRLGMAZE_PlaceAdjacentPresetRoom(pDrlgRoom4!, nDirection, false)
      if (pDrlgRoom5) {
        DRLGMAZE_PickRoomPreset(pDrlgRoom5, true)
      }

      const pMazeLevelIds = nAct2SewerNextIds[nRand]!
      if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
        DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
      }
      break
    }

    case LEVEL_SEWERSLEV2: {
      const pMazeLevelIds = nAct2SewerPrevIds[nRand]!
      if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
        DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
      }

      nRand = (nRand + 1) % 4
      nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct2SewerWaypointIds[nRand]!, nRand)
      nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct2SewerNextIds[nRand]!, nRand)
      break
    }

    case LEVEL_SEWERSLEV3:
      nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct2SewerPrevIds[nRand]!, nRand)
      nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct2SewerRadamentIds[nRand]!, nRand)
      break

    case LEVEL_ANCIENTTUNNELS:
      nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct2SewerPrevIds[nRand]!, nRand)
      nRand = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct2SewerChestIds[nRand]!, nRand)
      break

    default:
      return
  }
}

//D2Common.0x6FD7B660
export function DRLGMAZE_AddSpecialPreset(pLevel: D2DrlgLevelStrc, nDirection: number, nLvlPrestId: number, nFile: number): void {
  for (let pDrlgRoom = pLevel.pFirstRoomEx; pDrlgRoom; pDrlgRoom = pDrlgRoom.pDrlgRoomNext) {
    if (!DRLGMAZE_HasMapDS1(pDrlgRoom)) {
      if (DRLGMAZE_InitRoomFixedPreset(pDrlgRoom, nDirection, nLvlPrestId, nFile, true)) {
        break
      }
    }
  }
}

//D2Common.0x6FD7B710
export function DRLGMAZE_CheckIfMayPlaceAdjacentPresetRoom(pDrlgRoom: D2DrlgRoomStrc, nDirection: number): boolean {
  if (DRLGMAZE_HasMapDS1(pDrlgRoom)) return false
  if (DRLGMAZE_OrthWithDirectionExists(pDrlgRoom, nDirection)) return false

  const pNewRoomEx = DRLGMAZE_PlaceAdjacentPresetRoom(pDrlgRoom, nDirection, false)
  if (pNewRoomEx) {
    DRLGMAZE_PickRoomPreset(pNewRoomEx, true)
    DRLGROOM_FreeRoomEx(pNewRoomEx)
  }

  return pNewRoomEx !== null
}

//D2Common.0x6FD7B8B0
export function DRLGMAZE_PlaceAct2TombStuff(pLevel: D2DrlgLevelStrc): void {
  const nAct2TombNextIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_N, nLevelPrestId2: LVLPREST_ACT2_TOMB_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_E, nLevelPrestId2: LVLPREST_ACT2_TOMB_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_S, nLevelPrestId2: LVLPREST_ACT2_TOMB_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_W, nLevelPrestId2: LVLPREST_ACT2_TOMB_NEXT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2TombWaypointIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_N, nLevelPrestId2: LVLPREST_ACT2_TOMB_WAYPOINT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_E, nLevelPrestId2: LVLPREST_ACT2_TOMB_WAYPOINT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_S, nLevelPrestId2: LVLPREST_ACT2_TOMB_WAYPOINT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_W, nLevelPrestId2: LVLPREST_ACT2_TOMB_WAYPOINT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2TombChestIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_N, nLevelPrestId2: LVLPREST_ACT2_TOMB_CHEST_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_E, nLevelPrestId2: LVLPREST_ACT2_TOMB_CHEST_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_S, nLevelPrestId2: LVLPREST_ACT2_TOMB_CHEST_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_W, nLevelPrestId2: LVLPREST_ACT2_TOMB_CHEST_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2TombLeatherarmIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_N, nLevelPrestId2: LVLPREST_ACT2_TOMB_LEATHERARM_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_E, nLevelPrestId2: LVLPREST_ACT2_TOMB_LEATHERARM_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_S, nLevelPrestId2: LVLPREST_ACT2_TOMB_LEATHERARM_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_W, nLevelPrestId2: LVLPREST_ACT2_TOMB_LEATHERARM_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2TombCubeIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_N, nLevelPrestId2: LVLPREST_ACT2_TOMB_CUBE_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_E, nLevelPrestId2: LVLPREST_ACT2_TOMB_CUBE_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_S, nLevelPrestId2: LVLPREST_ACT2_TOMB_CUBE_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_W, nLevelPrestId2: LVLPREST_ACT2_TOMB_CUBE_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2TombTreasureIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_N, nLevelPrestId2: LVLPREST_ACT2_TOMB_TREASURE_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_E, nLevelPrestId2: LVLPREST_ACT2_TOMB_TREASURE_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_S, nLevelPrestId2: LVLPREST_ACT2_TOMB_TREASURE_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_W, nLevelPrestId2: LVLPREST_ACT2_TOMB_TREASURE_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2TombTalRashaIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_N, nLevelPrestId2: LVLPREST_ACT2_TOMB_TALRASHA_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_E, nLevelPrestId2: LVLPREST_ACT2_TOMB_TALRASHA_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_S, nLevelPrestId2: LVLPREST_ACT2_TOMB_TALRASHA_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_W, nLevelPrestId2: LVLPREST_ACT2_TOMB_TALRASHA_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2TombKaaIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_N, nLevelPrestId2: LVLPREST_ACT2_TOMB_KAA_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_E, nLevelPrestId2: LVLPREST_ACT2_TOMB_KAA_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_S, nLevelPrestId2: LVLPREST_ACT2_TOMB_KAA_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_TOMB_W, nLevelPrestId2: LVLPREST_ACT2_TOMB_KAA_W, nPickedFile: -1, nDirection: 2 },
  ]

  let pPresetRoom = pLevel.pFirstRoomEx!.pMaze!
  for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
    pPresetRoom = i.pMaze!
    if (pPresetRoom.nLevelPrest > 428) {
      break
    }
  }

  let nDirection = 0
  switch (pPresetRoom.nLevelPrest) {
    case LVLPREST_ACT2_TOMB_PREV_NSW:
      nDirection = 0
      break
    case LVLPREST_ACT2_TOMB_PREV_NEW:
      nDirection = 1
      break
    case LVLPREST_ACT2_TOMB_PREV_NSE:
      nDirection = 2
      break
    case LVLPREST_ACT2_TOMB_PREV_SEW:
      nDirection = 3
      break
    default:
      throw new Error("sPlaceTombStuff() - Why isn't the first room the preset warp room?")
  }

  if (pLevel.nLevelId >= LEVEL_STONYTOMBLEV1 && pLevel.nLevelId <= LEVEL_CLAWVIPERTEMPLELEV1) {
    const pMazeLevelIds = nAct2TombNextIds[nDirection]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
        if (!DRLGMAZE_HasMapDS1(i) && DRLGMAZE_InitRoomFixedPreset(i, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, true)) {
          break
        }
      }
    }
    nDirection = (nDirection + 1) % 4
  }

  if (pLevel.nLevelId === LEVEL_HALLSOFTHEDEADLEV2) {
    const pMazeLevelIds = nAct2TombWaypointIds[nDirection]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }
    nDirection = (nDirection + 1) % 4
  }

  if (pLevel.nLevelId === LEVEL_STONYTOMBLEV2 || pLevel.nLevelId === LEVEL_CLAWVIPERTEMPLELEV2) {
    const pMazeLevelIds = nAct2TombChestIds[nDirection]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }
    nDirection = (nDirection + 1) % 4
  }

  if (pLevel.nLevelId >= LEVEL_TALRASHASTOMB1 && pLevel.nLevelId <= LEVEL_TALRASHASTOMB7 && pLevel.nLevelId !== pLevel.pDrlg.nStaffTombLevel) {
    const pMazeLevelIds = nAct2TombChestIds[nDirection]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }
    nDirection = (nDirection + 1) % 4
  }

  if (pLevel.nLevelId === LEVEL_STONYTOMBLEV2) {
    const pMazeLevelIds = nAct2TombLeatherarmIds[nDirection]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }
    nDirection = (nDirection + 1) % 4
  }

  if (pLevel.nLevelId === LEVEL_HALLSOFTHEDEADLEV3) {
    const pMazeLevelIds = nAct2TombCubeIds[nDirection]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }
    nDirection = (nDirection + 1) % 4
  }

  if (pLevel.nLevelId === LEVEL_STONYTOMBLEV2 || pLevel.nLevelId === LEVEL_CLAWVIPERTEMPLELEV2) {
    const pMazeLevelIds = nAct2TombTreasureIds[nDirection]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }
    nDirection = (nDirection + 1) % 4
  }

  if (pLevel.nLevelId === pLevel.pDrlg.nStaffTombLevel) {
    const pMazeLevelIds = nAct2TombTalRashaIds[nDirection]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }
    nDirection = (nDirection + 1) % 4
  }

  if (pLevel.nLevelId === pLevel.pDrlg.nBossTombLevel) {
    nDirection = DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct2TombKaaIds[nDirection]!, nDirection)
  }
}

//D2Common.0x6FD7BC40
export function DRLGMAZE_InitRoomFixedPreset(
  pDrlgRoom: D2DrlgRoomStrc,
  nDirection: number,
  nLvlPrestId: number,
  nFile: number,
  bUseInitPreset: boolean,
): D2DrlgRoomStrc | null {
  const pNewRoomEx = DRLGROOM_AllocRoomEx(pDrlgRoom.pLevel, DRLGTYPE_PRESET)
  DRLGMAZE_SetRoomSize(pNewRoomEx)

  if (DRLGMAZE_LinkMazeRooms(pNewRoomEx, pDrlgRoom, nDirection)) {
    DRLGROOM_AllocDrlgOrthsForRooms(pDrlgRoom, pNewRoomEx, nDirection)
    DRLGROOM_AddRoomExToLevel(pDrlgRoom.pLevel, pNewRoomEx)

    if (bUseInitPreset) {
      DRLGMAZE_PickRoomPreset(pDrlgRoom, true)
    }

    pNewRoomEx.pMaze!.nLevelPrest = nLvlPrestId
    pNewRoomEx.pMaze!.nPickedFile = nFile
    pNewRoomEx.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
    return pNewRoomEx
  } else {
    DRLGROOM_FreeRoomEx(pNewRoomEx)
    return null
  }
}

//D2Common.0x6FD7BCD0
export function DRLGMAZE_PlaceAct2LairStuff(pLevel: D2DrlgLevelStrc): void {
  const nAct2LairPrevIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_N, nLevelPrestId2: LVLPREST_ACT2_LAIR_PREV_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_E, nLevelPrestId2: LVLPREST_ACT2_LAIR_PREV_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_S, nLevelPrestId2: LVLPREST_ACT2_LAIR_PREV_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_W, nLevelPrestId2: LVLPREST_ACT2_LAIR_PREV_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct2LairSpecialIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_N, nLevelPrestId2: LVLPREST_ACT2_LAIR_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_E, nLevelPrestId2: LVLPREST_ACT2_LAIR_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_S, nLevelPrestId2: LVLPREST_ACT2_LAIR_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_W, nLevelPrestId2: LVLPREST_ACT2_LAIR_NEXT_W, nPickedFile: -1, nDirection: 2 },
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_N, nLevelPrestId2: LVLPREST_ACT2_LAIR_TREASURE_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_E, nLevelPrestId2: LVLPREST_ACT2_LAIR_TREASURE_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_S, nLevelPrestId2: LVLPREST_ACT2_LAIR_TREASURE_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_W, nLevelPrestId2: LVLPREST_ACT2_LAIR_TREASURE_W, nPickedFile: -1, nDirection: 2 },
    { nLevelPrestId1: LVLPREST_ACT2_LAIR_S, nLevelPrestId2: LVLPREST_ACT2_LAIR_TIGHT_SPOT_S, nPickedFile: -1, nDirection: 1 },
  ]

  const nRand = SEED_RollRandomNumber(pLevel.pSeed) & 3
  let nIndex = 0

  if (pLevel.nLevelId === LEVEL_MAGGOTLAIRLEV3) {
    let pDrlgRoom = pLevel.pFirstRoomEx
    while (pDrlgRoom) {
      if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === LVLPREST_ACT2_LAIR_S) {
        DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, LVLPREST_ACT2_LAIR_TIGHT_SPOT_S, -1, false)
        break
      }
      pDrlgRoom = pDrlgRoom.pDrlgRoomNext
    }

    if (!pDrlgRoom) {
      pDrlgRoom = pLevel.pFirstRoomEx
      while (pDrlgRoom) {
        if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && DRLGMAZE_InitRoomFixedPreset(pDrlgRoom, 1, LVLPREST_ACT2_LAIR_TIGHT_SPOT_S, -1, true)) {
          break
        }
        pDrlgRoom = pDrlgRoom.pDrlgRoomNext
      }
    }

    pDrlgRoom = pLevel.pFirstRoomEx
    while (pDrlgRoom) {
      if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === LVLPREST_ACT2_LAIR_W) {
        DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, LVLPREST_ACT2_LAIR_TREASURE_W, -1, false)
        break
      }
      pDrlgRoom = pDrlgRoom.pDrlgRoomNext
    }

    if (!pDrlgRoom) {
      DRLGMAZE_AddSpecialPreset(pLevel, 2, LVLPREST_ACT2_LAIR_TREASURE_W, -1)
    }

    nIndex = 0
  } else {
    const pMazeLevelIds = nAct2LairSpecialIds[nRand]!
    let pDrlgRoom = pLevel.pFirstRoomEx
    while (pDrlgRoom) {
      if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
        DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)
        break
      }
      pDrlgRoom = pDrlgRoom.pDrlgRoomNext
    }

    if (!pDrlgRoom) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }

    nIndex = (nRand + 1) % 4
  }

  const pMazeLevelIds = nAct2LairPrevIds[nIndex]!
  if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
    DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
  }
}

//D2Common.0x6FD7BE60
export function DRLGMAZE_PlaceAct3DungeonStuff(pLevel: D2DrlgLevelStrc): void {
  const nAct3DungeonPrevIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT3_DUNGEON_N, nLevelPrestId2: LVLPREST_ACT3_DUNGEON_PREV_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT3_DUNGEON_E, nLevelPrestId2: LVLPREST_ACT3_DUNGEON_PREV_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT3_DUNGEON_S, nLevelPrestId2: LVLPREST_ACT3_DUNGEON_PREV_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT3_DUNGEON_W, nLevelPrestId2: LVLPREST_ACT3_DUNGEON_PREV_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct3DungeonNextIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT3_DUNGEON_N, nLevelPrestId2: LVLPREST_ACT3_DUNGEON_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT3_DUNGEON_E, nLevelPrestId2: LVLPREST_ACT3_DUNGEON_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT3_DUNGEON_S, nLevelPrestId2: LVLPREST_ACT3_DUNGEON_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT3_DUNGEON_W, nLevelPrestId2: LVLPREST_ACT3_DUNGEON_NEXT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nDirection = SEED_RollRandomNumber(pLevel.pSeed) & 3

  let pMazeLevelIds = nAct3DungeonPrevIds[nDirection]!
  let pDrlgRoom = pLevel.pFirstRoomEx
  while (pDrlgRoom) {
    if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
      pDrlgRoom.pMaze!.nLevelPrest = pMazeLevelIds.nLevelPrestId2
      pDrlgRoom.pMaze!.nPickedFile = pMazeLevelIds.nPickedFile
      pDrlgRoom.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
      break
    }
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext
  }

  if (!pDrlgRoom) {
    for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
      if (!DRLGMAZE_HasMapDS1(i)) {
        pDrlgRoom = DRLGMAZE_PlaceAdjacentPresetRoom(i, pMazeLevelIds.nDirection, false)
        if (pDrlgRoom) {
          DRLGMAZE_PickRoomPreset(i, true)
          DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)
          break
        }
      }
    }
  }

  pMazeLevelIds = nAct3DungeonNextIds[(nDirection + 1) % 4]!
  pDrlgRoom = pLevel.pFirstRoomEx
  while (pDrlgRoom) {
    if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
      pDrlgRoom.pMaze!.nLevelPrest = pMazeLevelIds.nLevelPrestId2
      pDrlgRoom.pMaze!.nPickedFile = pMazeLevelIds.nPickedFile
      pDrlgRoom.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
      break
    }
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext
  }

  if (!pDrlgRoom) {
    for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
      if (!DRLGMAZE_HasMapDS1(i)) {
        pDrlgRoom = DRLGMAZE_PlaceAdjacentPresetRoom(i, pMazeLevelIds.nDirection, false)
        if (pDrlgRoom) {
          DRLGMAZE_PickRoomPreset(i, true)
          DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)
          break
        }
      }
    }
  }
}

//D2Common.0x6FD7C000
export function DRLGMAZE_PlaceAct3SewerStuff(pLevel: D2DrlgLevelStrc): void {
  const nAct3SewerDrainIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT3_SEWER_N, nLevelPrestId2: LVLPREST_ACT3_SEWER_DRAIN_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT3_SEWER_E, nLevelPrestId2: LVLPREST_ACT3_SEWER_DRAIN_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT3_SEWER_S, nLevelPrestId2: LVLPREST_ACT3_SEWER_DRAIN_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT3_SEWER_W, nLevelPrestId2: LVLPREST_ACT3_SEWER_DRAIN_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct3SewerChestIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT3_SEWER_N, nLevelPrestId2: LVLPREST_ACT3_SEWER_CHEST_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT3_SEWER_E, nLevelPrestId2: LVLPREST_ACT3_SEWER_CHEST_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT3_SEWER_S, nLevelPrestId2: LVLPREST_ACT3_SEWER_CHEST_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT3_SEWER_W, nLevelPrestId2: LVLPREST_ACT3_SEWER_CHEST_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nDirection = SEED_RollRandomNumber(pLevel.pSeed) & 3

  let pMazeLevelIds = nAct3SewerDrainIds[nDirection]!
  let pDrlgRoom = pLevel.pFirstRoomEx
  while (pDrlgRoom) {
    if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
      pDrlgRoom.pMaze!.nLevelPrest = pMazeLevelIds.nLevelPrestId2
      pDrlgRoom.pMaze!.nPickedFile = pMazeLevelIds.nPickedFile
      pDrlgRoom.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
      break
    }
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext
  }

  if (!pDrlgRoom) {
    for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
      if (!DRLGMAZE_HasMapDS1(i)) {
        const pTemp = DRLGMAZE_PlaceAdjacentPresetRoom(i, pMazeLevelIds.nDirection, false)
        if (pTemp) {
          DRLGMAZE_PickRoomPreset(i, true)
          DRLGMAZE_SetPickedFileAndPresetId(pTemp, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)
          break
        }
      }
    }
  }

  pMazeLevelIds = nAct3SewerChestIds[(nDirection + 1) % 4]!
  pDrlgRoom = pLevel.pFirstRoomEx
  while (pDrlgRoom) {
    if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
      pDrlgRoom.pMaze!.nLevelPrest = pMazeLevelIds.nLevelPrestId2
      pDrlgRoom.pMaze!.nPickedFile = pMazeLevelIds.nPickedFile
      pDrlgRoom.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
      break
    }
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext
  }

  if (!pDrlgRoom) {
    for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
      if (!DRLGMAZE_HasMapDS1(i)) {
        const pTemp = DRLGMAZE_PlaceAdjacentPresetRoom(i, pMazeLevelIds.nDirection, false)
        if (pTemp) {
          DRLGMAZE_PickRoomPreset(i, true)
          DRLGMAZE_SetPickedFileAndPresetId(pTemp, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)
          break
        }
      }
    }
  }
}

//D2Common.0x6FD7C1A0
export function DRLGMAZE_PlaceAct3MephistoStuff(pLevel: D2DrlgLevelStrc): void {
  const nAct3MephistoPrevIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_N, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_PREV_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_E, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_PREV_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_S, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_PREV_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_W, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_PREV_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct3MephistoWaypointIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_N, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_WAYPOINT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_E, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_WAYPOINT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_S, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_WAYPOINT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_W, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_WAYPOINT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct3MephistoNextIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_N, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_E, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_S, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT3_MEPHISTO_W, nLevelPrestId2: LVLPREST_ACT3_MEPHISTO_NEXT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nRand = SEED_RollRandomNumber(pLevel.pSeed) & 3

  let pMazeLevelIds = nAct3MephistoPrevIds[nRand]!
  let pDrlgRoom = pLevel.pFirstRoomEx
  while (pDrlgRoom) {
    if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
      DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)
      break
    }
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext
  }

  if (!pDrlgRoom) {
    for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
      if (!DRLGMAZE_HasMapDS1(i) && DRLGMAZE_InitRoomFixedPreset(i, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, true)) {
        break
      }
    }
  }

  let v9 = (nRand + 1) % 4
  if (pLevel.nLevelId === LEVEL_DURANCEOFHATELEV2) {
    pMazeLevelIds = nAct3MephistoWaypointIds[v9]!
    pDrlgRoom = pLevel.pFirstRoomEx
    while (pDrlgRoom) {
      if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
        DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)
        break
      }
      pDrlgRoom = pDrlgRoom.pDrlgRoomNext
    }

    if (!pDrlgRoom) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }

    const v14 = (v9 + 1) % 4
    pMazeLevelIds = nAct3MephistoNextIds[v14]!
    pDrlgRoom = pLevel.pFirstRoomEx
    while (pDrlgRoom) {
      if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
        DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)
        break
      }
      pDrlgRoom = pDrlgRoom.pDrlgRoomNext
    }

    if (!pDrlgRoom) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }

    v9 = (v14 + 1) % 4
  }

  if (pLevel.nLevelId === LEVEL_DURANCEOFHATELEV1) {
    pMazeLevelIds = nAct3MephistoNextIds[v9]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }
  }
}

//D2Common.0x6FD7C380
export function DRLGMAZE_PlaceAct5TempleStuff(pLevel: D2DrlgLevelStrc): void {
  const nAct5TempleSpecialIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT5_TEMPLE_NE, nLevelPrestId2: LVLPREST_ACT5_TEMPLE_NE_DOWN, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT5_TEMPLE_NW, nLevelPrestId2: LVLPREST_ACT5_TEMPLE_NW_DOWN, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT5_TEMPLE_SW, nLevelPrestId2: LVLPREST_ACT5_TEMPLE_SW_DOWN, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT5_TEMPLE_NE, nLevelPrestId2: LVLPREST_ACT5_TEMPLE_NE_WAYPOINT, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT5_TEMPLE_NW, nLevelPrestId2: LVLPREST_ACT5_TEMPLE_NW_WAYPOINT, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT5_TEMPLE_SW, nLevelPrestId2: LVLPREST_ACT5_TEMPLE_SW_WAYPOINT, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT5_TEMPLE_SE_UP, nLevelPrestId2: LVLPREST_ACT5_TEMPLE_SE_WAYPOINT, nPickedFile: -1, nDirection: 2 },
  ]

  let nDirection = (SEED_RollRandomNumber(pLevel.pSeed) >>> 0) % 3

  if (pLevel.nLevelId !== LEVEL_HALLSOFVAUGHT) {
    const pMazeLevelIds = nAct5TempleSpecialIds[nDirection]!
    let pDrlgRoom = pLevel.pFirstRoomEx
    while (pDrlgRoom) {
      if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
        pDrlgRoom.pMaze!.nLevelPrest = pMazeLevelIds.nLevelPrestId2
        pDrlgRoom.pMaze!.nPickedFile = pMazeLevelIds.nPickedFile
        pDrlgRoom.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
        break
      }
      pDrlgRoom = pDrlgRoom.pDrlgRoomNext
    }

    if (!pDrlgRoom) {
      for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
        if (!DRLGMAZE_HasMapDS1(i) && DRLGMAZE_InitRoomFixedPreset(i, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, true)) {
          break
        }
      }
    }

    nDirection = (nDirection + 1) % 4
  }

  if (pLevel.nLevelId === LEVEL_HALLSOFDEATHSCALLING) {
    const pMazeLevelIds = nAct5TempleSpecialIds[nDirection + 3]!
    let pDrlgRoom = pLevel.pFirstRoomEx
    while (pDrlgRoom) {
      if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
        pDrlgRoom.pMaze!.nPickedFile = pMazeLevelIds.nPickedFile
        pDrlgRoom.pMaze!.nLevelPrest = pMazeLevelIds.nLevelPrestId2
        pDrlgRoom.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
        break
      }
      pDrlgRoom = pDrlgRoom.pDrlgRoomNext
    }

    if (!pDrlgRoom) {
      for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
        if (!DRLGMAZE_HasMapDS1(i) && DRLGMAZE_InitRoomFixedPreset(i, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, true)) {
          break
        }
      }
    }
  }
}

//D2Common.0x6FD7C500
export function DRLGMAZE_PlaceAct5BaalStuff(pLevel: D2DrlgLevelStrc): void {
  const nAct5BaalNextIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT5_BAAL_N, nLevelPrestId2: LVLPREST_ACT5_BAAL_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT5_BAAL_E, nLevelPrestId2: LVLPREST_ACT5_BAAL_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT5_BAAL_S, nLevelPrestId2: LVLPREST_ACT5_BAAL_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT5_BAAL_W, nLevelPrestId2: LVLPREST_ACT5_BAAL_NEXT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct5BaalWaypointIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT5_BAAL_N, nLevelPrestId2: LVLPREST_ACT5_BAAL_WAYPOINT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT5_BAAL_E, nLevelPrestId2: LVLPREST_ACT5_BAAL_WAYPOINT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT5_BAAL_S, nLevelPrestId2: LVLPREST_ACT5_BAAL_WAYPOINT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT5_BAAL_W, nLevelPrestId2: LVLPREST_ACT5_BAAL_WAYPOINT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nDirection = SEED_RollRandomNumber(pLevel.pSeed) & 3
  let pMazeLevelIds = nAct5BaalNextIds[nDirection]!
  let pDrlgRoom = pLevel.pFirstRoomEx
  while (pDrlgRoom) {
    if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
      pDrlgRoom.pMaze!.nLevelPrest = pMazeLevelIds.nLevelPrestId2
      pDrlgRoom.pMaze!.nPickedFile = pMazeLevelIds.nPickedFile
      pDrlgRoom.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
      break
    }
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext
  }

  if (!pDrlgRoom) {
    for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
      if (!DRLGMAZE_HasMapDS1(i) && DRLGMAZE_InitRoomFixedPreset(i, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, true)) {
        break
      }
    }
  }

  if (pLevel.nLevelId === LEVEL_THEWORLDSTONEKEEPLEV2) {
    pMazeLevelIds = nAct5BaalWaypointIds[(nDirection + 1) % 4]!
    pDrlgRoom = pLevel.pFirstRoomEx
    while (pDrlgRoom) {
      if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
        pDrlgRoom.pMaze!.nPickedFile = pMazeLevelIds.nPickedFile
        pDrlgRoom.pMaze!.nLevelPrest = pMazeLevelIds.nLevelPrestId2
        pDrlgRoom.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1
        break
      }
      pDrlgRoom = pDrlgRoom.pDrlgRoomNext
    }

    if (!pDrlgRoom) {
      for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
        if (!DRLGMAZE_HasMapDS1(i) && DRLGMAZE_InitRoomFixedPreset(i, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, true)) {
          break
        }
      }
    }
  }
}

//D2Common.0x6FD7C660
export function DRLGMAZE_PlaceAct1Barracks(pLevel: D2DrlgLevelStrc): void {
  const pfGetBarracksEntryRoom = [
    DRLGMAZE_GetFreeLocationForRoomWest,
    DRLGMAZE_GetFreeLocationForRoomNorth,
    DRLGMAZE_GetFreeLocationForRoomEast,
  ] as const

  const nAct1BarracksNextIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_BARRACKS_N, nLevelPrestId2: LVLPREST_ACT1_BARRACKS_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_BARRACKS_E, nLevelPrestId2: LVLPREST_ACT1_BARRACKS_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_BARRACKS_S, nLevelPrestId2: LVLPREST_ACT1_BARRACKS_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_BARRACKS_W, nLevelPrestId2: LVLPREST_ACT1_BARRACKS_NEXT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct1BarracksForgeIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT1_BARRACKS_N, nLevelPrestId2: LVLPREST_ACT1_BARRACKS_FORGE_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT1_BARRACKS_E, nLevelPrestId2: LVLPREST_ACT1_BARRACKS_FORGE_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT1_BARRACKS_S, nLevelPrestId2: LVLPREST_ACT1_BARRACKS_FORGE_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT1_BARRACKS_W, nLevelPrestId2: LVLPREST_ACT1_BARRACKS_FORGE_W, nPickedFile: -1, nDirection: 2 },
  ]

  const pOuterCloisterLevel = DRLG_GetLevel(pLevel.pDrlg, LEVEL_OUTERCLOISTER)
  const nDirection = pOuterCloisterLevel.pPreset!.nDirection
  const pDrlgRoom = pfGetBarracksEntryRoom[nDirection]!(pLevel)!

  let nX = pOuterCloisterLevel.pLevelCoords.nPosX
  let nY = pOuterCloisterLevel.pLevelCoords.nPosY
  let pBarracksRoomEx: D2DrlgRoomStrc | null = null

  switch (nDirection) {
    case 0:
      pBarracksRoomEx = DRLGROOM_AllocRoomEx(pDrlgRoom.pLevel, DRLGTYPE_PRESET)
      DRLGMAZE_SetRoomSize(pBarracksRoomEx)

      if (DRLGMAZE_LinkMazeRooms(pBarracksRoomEx, pDrlgRoom, 2)) {
        DRLGROOM_AllocDrlgOrthsForRooms(pDrlgRoom, pBarracksRoomEx, 2)
        DRLGROOM_AddRoomExToLevel(pDrlgRoom.pLevel, pBarracksRoomEx)
        if (pBarracksRoomEx) {
          DRLGMAZE_PickRoomPreset(pDrlgRoom, true)
          DRLGMAZE_SetPickedFileAndPresetId(pBarracksRoomEx, LVLPREST_ACT1_BARRACKS_COURT_CONNECT, 0, false)
        }
      } else {
        DRLGROOM_FreeRoomEx(pBarracksRoomEx)
        pBarracksRoomEx = null
      }

      pBarracksRoomEx!.pDrlgOrth = DRLGROOM_AddOrth(pBarracksRoomEx!.pDrlgOrth, pOuterCloisterLevel, 2, false)
      nX -= pLevel.pMaze!.dwSizeX + pBarracksRoomEx!.pDrlgCoord.nPosX
      nY += Math.trunc(pOuterCloisterLevel.pLevelCoords.nHeight / 2) - pBarracksRoomEx!.pDrlgCoord.nPosY
      break

    case 1:
      pBarracksRoomEx = DRLGROOM_AllocRoomEx(pDrlgRoom.pLevel, DRLGTYPE_PRESET)
      DRLGMAZE_SetRoomSize(pBarracksRoomEx)

      if (DRLGMAZE_LinkMazeRooms(pBarracksRoomEx, pDrlgRoom, 3)) {
        DRLGROOM_AllocDrlgOrthsForRooms(pDrlgRoom, pBarracksRoomEx, 3)
        DRLGROOM_AddRoomExToLevel(pDrlgRoom.pLevel, pBarracksRoomEx)
        if (pBarracksRoomEx) {
          DRLGMAZE_PickRoomPreset(pDrlgRoom, true)
          DRLGMAZE_SetPickedFileAndPresetId(pBarracksRoomEx, LVLPREST_ACT1_BARRACKS_COURT_CONNECT, 1, false)
        }
      } else {
        DRLGROOM_FreeRoomEx(pBarracksRoomEx)
        pBarracksRoomEx = null
      }

      pBarracksRoomEx!.pDrlgOrth = DRLGROOM_AddOrth(pBarracksRoomEx!.pDrlgOrth, pOuterCloisterLevel, 3, false)
      nX += Math.trunc(pOuterCloisterLevel.pLevelCoords.nWidth / 2) - pBarracksRoomEx!.pDrlgCoord.nPosX - 6
      nY -= pLevel.pMaze!.dwSizeY + pBarracksRoomEx!.pDrlgCoord.nPosY
      break

    case 2:
      pBarracksRoomEx = DRLGMAZE_PlaceAdjacentPresetRoom(pDrlgRoom, ALTDIR_WEST, false)
      if (pBarracksRoomEx) {
        DRLGMAZE_PickRoomPreset(pDrlgRoom, true)
        DRLGMAZE_SetPickedFileAndPresetId(pBarracksRoomEx, LVLPREST_ACT1_BARRACKS_COURT_CONNECT, 2, false)
      }

      pBarracksRoomEx!.pDrlgOrth = DRLGROOM_AddOrth(pBarracksRoomEx!.pDrlgOrth, pOuterCloisterLevel, 0, false)
      nX += pOuterCloisterLevel.pLevelCoords.nWidth - pBarracksRoomEx!.pDrlgCoord.nPosX
      nY += Math.trunc(pOuterCloisterLevel.pLevelCoords.nHeight / 2) - pBarracksRoomEx!.pDrlgCoord.nPosY + 1
      break

    default:
      break
  }

  if (SEED_RollRandomNumber(pLevel.pSeed) & 1) {
    let pMazeLevelIds = nAct1BarracksNextIds[nDirection]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
        if (!DRLGMAZE_HasMapDS1(i) && DRLGMAZE_InitRoomFixedPreset(i, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, true)) {
          break
        }
      }
    }

    pMazeLevelIds = nAct1BarracksForgeIds[(nDirection + 1) % 4]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }
  } else {
    const pMazeLevelIds = nAct1BarracksForgeIds[nDirection]!
    if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
      DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
    }

    const nRand = (nDirection + 1) % 4
    DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct1BarracksNextIds[nRand]!, nRand)
  }

  for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
    i.pDrlgCoord.nPosX += nX
    i.pDrlgCoord.nPosY += nY
  }

  const { nTileMinX, nTileMinY, nTileMaxX, nTileMaxY } = DRLG_GetMinAndMaxCoordinatesFromLevel(pLevel)
  pLevel.pLevelCoords.nPosX = nTileMinX
  pLevel.pLevelCoords.nPosY = nTileMinY
  pLevel.pLevelCoords.nWidth = nTileMaxX - nTileMinX
  pLevel.pLevelCoords.nHeight = nTileMaxY - nTileMinY
}

//D2Common.0x6FD7CA20
export function DRLGMAZE_SetRoomSize(pDrlgRoom: D2DrlgRoomStrc): void {
  pDrlgRoom.pDrlgCoord.nWidth = pDrlgRoom.pLevel.pMaze!.dwSizeX
  pDrlgRoom.pDrlgCoord.nHeight = pDrlgRoom.pLevel.pMaze!.dwSizeY
}

//D2Common.0x6FD7CA40
export function DRLGMAZE_PlaceAct4Lava(pLevel: D2DrlgLevelStrc): void {
  const nAct4LavaForgeIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT4_LAVA_W, nLevelPrestId2: LVLPREST_ACT4_LAVA_FORGE_W, nPickedFile: -1, nDirection: 2 },
    { nLevelPrestId1: LVLPREST_ACT4_LAVA_E, nLevelPrestId2: LVLPREST_ACT4_LAVA_FORGE_E, nPickedFile: -1, nDirection: 0 },
  ]

  if (pLevel.pDrlg.nAct !== ACT_V) {
    const pChaosSanctum = DRLG_GetLevel(pLevel.pDrlg, LEVEL_CHAOSSANCTUM)
    let pParentRoom = DRLGMAZE_GetFreeLocationForRoomNorth(pLevel)!

    const pNewRoomEx = DRLGROOM_AllocRoomEx(pParentRoom.pLevel, DRLGTYPE_PRESET)
    DRLGMAZE_SetRoomSize(pNewRoomEx)

    if (DRLGMAZE_LinkMazeRooms(pNewRoomEx, pParentRoom, ALTDIR_SOUTH)) {
      DRLGROOM_AllocDrlgOrthsForRooms(pParentRoom, pNewRoomEx, ALTDIR_SOUTH)
      DRLGROOM_AddRoomExToLevel(pParentRoom.pLevel, pNewRoomEx)
      if (pNewRoomEx) {
        DRLGMAZE_PickRoomPreset(pParentRoom, true)
        DRLGMAZE_SetPickedFileAndPresetId(pNewRoomEx, LVLPREST_ACT4_LAVA_WARP_N, -1, false)
      }
    } else {
      DRLGROOM_FreeRoomEx(pNewRoomEx)
    }

    pParentRoom = DRLGMAZE_GetFreeLocationForRoomSouth(pLevel)!

    const pBridgeRoomEx1 = DRLGMAZE_PlaceAdjacentPresetRoom(pParentRoom, ALTDIR_NORTH, false)
    if (pBridgeRoomEx1) {
      DRLGMAZE_PickRoomPreset(pParentRoom, true)
      DRLGMAZE_SetPickedFileAndPresetId(pBridgeRoomEx1, LVLPREST_ACT4_BRIDGE_1, -1, false)
    }

    const pBridgeRoomEx2 = DRLGMAZE_PlaceAdjacentPresetRoom(pBridgeRoomEx1!, ALTDIR_NORTH, false)
    if (pBridgeRoomEx2) {
      DRLGMAZE_SetPickedFileAndPresetId(pBridgeRoomEx2, LVLPREST_ACT4_BRIDGE_2, -1, false)
    }

    const pBridgeRoomEx3 = DRLGMAZE_PlaceAdjacentPresetRoom(pBridgeRoomEx2!, ALTDIR_NORTH, false)!
    if (pBridgeRoomEx3) {
      DRLGMAZE_SetPickedFileAndPresetId(pBridgeRoomEx3, LVLPREST_ACT4_BRIDGE_2, -1, false)
    }

    pBridgeRoomEx3.pDrlgOrth = DRLGROOM_AddOrth(pBridgeRoomEx3.pDrlgOrth, pChaosSanctum, ALTDIR_NORTH, false)

    const nX = pChaosSanctum.pLevelCoords.nPosX + 2 * pBridgeRoomEx3.pDrlgCoord.nWidth - pBridgeRoomEx3.pDrlgCoord.nPosX
    const nY = pChaosSanctum.pLevelCoords.nPosY + pChaosSanctum.pLevelCoords.nHeight - pBridgeRoomEx3.pDrlgCoord.nPosY

    DRLGMAZE_ScanReplaceSpecialPreset(pLevel, nAct4LavaForgeIds[SEED_RollRandomNumber(pLevel.pSeed) & 1]!, null)
    DRLGMAZE_FillBlankMazeSpaces(pLevel, LVLPREST_ACT4_LAVA_X, pBridgeRoomEx3)

    for (let i = pLevel.pFirstRoomEx; i; i = i.pDrlgRoomNext) {
      i.pDrlgCoord.nPosX += nX
      i.pDrlgCoord.nPosY += nY
    }

    const { nTileMinX, nTileMinY, nTileMaxX, nTileMaxY } = DRLG_GetMinAndMaxCoordinatesFromLevel(pLevel)
    pLevel.pLevelCoords.nPosX = nTileMinX
    pLevel.pLevelCoords.nPosY = nTileMinY
    pLevel.pLevelCoords.nWidth = nTileMaxX - nTileMinX
    pLevel.pLevelCoords.nHeight = nTileMaxY - nTileMinY
  }
}

//D2Common.0x6FD7CCB0
export function DRLGMAZE_PlaceAct5IceStuff(pLevel: D2DrlgLevelStrc): void {
  const nAct5IcePrevIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT5_ICE_N, nLevelPrestId2: LVLPREST_ACT5_ICE_PREV_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_E, nLevelPrestId2: LVLPREST_ACT5_ICE_PREV_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_S, nLevelPrestId2: LVLPREST_ACT5_ICE_PREV_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_W, nLevelPrestId2: LVLPREST_ACT5_ICE_PREV_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct5IceNextIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT5_ICE_N, nLevelPrestId2: LVLPREST_ACT5_ICE_NEXT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_E, nLevelPrestId2: LVLPREST_ACT5_ICE_NEXT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_S, nLevelPrestId2: LVLPREST_ACT5_ICE_NEXT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_W, nLevelPrestId2: LVLPREST_ACT5_ICE_NEXT_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct5IceDownIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT5_ICE_N, nLevelPrestId2: LVLPREST_ACT5_ICE_DOWN_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_E, nLevelPrestId2: LVLPREST_ACT5_ICE_DOWN_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_S, nLevelPrestId2: LVLPREST_ACT5_ICE_DOWN_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_W, nLevelPrestId2: LVLPREST_ACT5_ICE_DOWN_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct5IceThemeIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT5_ICE_N, nLevelPrestId2: LVLPREST_ACT5_ICE_THEME_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_E, nLevelPrestId2: LVLPREST_ACT5_ICE_THEME_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_S, nLevelPrestId2: LVLPREST_ACT5_ICE_THEME_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_W, nLevelPrestId2: LVLPREST_ACT5_ICE_THEME_W, nPickedFile: -1, nDirection: 2 },
  ]

  const nAct5IceWaypointIds: readonly D2MazeLevelIdStrc[] = [
    { nLevelPrestId1: LVLPREST_ACT5_ICE_N, nLevelPrestId2: LVLPREST_ACT5_ICE_WAYPOINT_N, nPickedFile: -1, nDirection: 3 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_E, nLevelPrestId2: LVLPREST_ACT5_ICE_WAYPOINT_E, nPickedFile: -1, nDirection: 0 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_S, nLevelPrestId2: LVLPREST_ACT5_ICE_WAYPOINT_S, nPickedFile: -1, nDirection: 1 },
    { nLevelPrestId1: LVLPREST_ACT5_ICE_W, nLevelPrestId2: LVLPREST_ACT5_ICE_WAYPOINT_W, nPickedFile: -1, nDirection: 2 },
  ]

  let nDirection = SEED_RollRandomNumber(pLevel.pSeed) & 3
  let pMazeLevelIds = nAct5IcePrevIds[nDirection]!

  let pDrlgRoom = pLevel.pFirstRoomEx
  while (pDrlgRoom) {
    if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
      DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)
      break
    }
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext
  }

  if (!pDrlgRoom) {
    DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
  }

  nDirection = (nDirection + 1) % 4
  pMazeLevelIds = nAct5IceNextIds[nDirection]!
  pDrlgRoom = pLevel.pFirstRoomEx
  while (pDrlgRoom) {
    if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
      DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)
      break
    }
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext
  }

  if (!pDrlgRoom) {
    DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
  }

  nDirection = (nDirection + 1) % 4
  pMazeLevelIds = nAct5IceDownIds[nDirection]!
  pDrlgRoom = pLevel.pFirstRoomEx
  while (pDrlgRoom) {
    if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === pMazeLevelIds.nLevelPrestId1) {
      DRLGMAZE_SetPickedFileAndPresetId(pDrlgRoom, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)
      break
    }
    pDrlgRoom = pDrlgRoom.pDrlgRoomNext
  }

  if (!pDrlgRoom) {
    DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
  }

  nDirection = (nDirection + 1) % 4
  if (pLevel.nLevelId !== LEVEL_CRYSTALIZEDCAVERNLEV1) {
    if (pLevel.nLevelId === LEVEL_CRYSTALIZEDCAVERNLEV2) {
      pMazeLevelIds = nAct5IceThemeIds[nDirection]!
      if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
        DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
      }
      nDirection = (nDirection + 1) % 4
    } else if (pLevel.nLevelId !== LEVEL_GLACIALCAVESLEV1) {
      return
    }
  }

  pMazeLevelIds = nAct5IceWaypointIds[nDirection]!
  if (!DRLGMAZE_ReplaceRoomPreset(pLevel, pMazeLevelIds.nLevelPrestId1, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile, false)) {
    DRLGMAZE_AddSpecialPreset(pLevel, pMazeLevelIds.nDirection, pMazeLevelIds.nLevelPrestId2, pMazeLevelIds.nPickedFile)
  }
}

//D2Common.0x6FD7CEA0
export function DRLGMAZE_RollAct_1_2_3_BasicPresets(pLevel: D2DrlgLevelStrc): void {
  const pOffsets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  let nBaseLvlPrest = 0

  switch (pLevel.nLevelType) {
    case LVLTYPE_ACT1_CAVE:
      nBaseLvlPrest = LVLPREST_ACT1_DOE_ENTRANCE
      break
    case LVLTYPE_ACT1_CRYPT:
      nBaseLvlPrest = LVLPREST_ACT1_GRAVEYARD
      break
    case LVLTYPE_ACT1_BARRACKS:
      nBaseLvlPrest = LVLPREST_ACT1_BARRACKS_COURT_CONNECT
      break
    case LVLTYPE_ACT1_JAIL:
      nBaseLvlPrest = LVLPREST_ACT1_BARRACKS_FORGE_N
      break
    case LVLTYPE_ACT1_CATACOMBS:
      nBaseLvlPrest = LVLPREST_ACT1_CATHEDRAL
      break
    case LVLTYPE_ACT2_SEWER:
      nBaseLvlPrest = LVLPREST_ACT2_TOWN
      break
    case LVLTYPE_ACT2_TOMB:
      nBaseLvlPrest = LVLPREST_ACT2_DESERT_RUINS_ELDER
      break
    case LVLTYPE_ACT3_KURAST:
      nBaseLvlPrest = LVLPREST_ACT3_TEMPLE_6
      break
    case LVLTYPE_ACT3_DUNGEON:
      nBaseLvlPrest = LVLPREST_ACT3_SPIDER_CHEST_NE
      break
    case LVLTYPE_ACT3_SEWER:
      nBaseLvlPrest = LVLPREST_ACT3_DUNGEON_TREASURE_2
      break
    default:
      return
  }

  if (pLevel.nLevelId === LEVEL_DENOFEVIL) {
    return
  }

  let nIndex = (SEED_RollRandomNumber(pLevel.pSeed) >>> 0) % 15

  for (let i = 0; i < 15; i += 1) {
    const nIndex2 = (SEED_RollRandomNumber(pLevel.pSeed) >>> 0) % 15
    const nIndex1 = (SEED_RollRandomNumber(pLevel.pSeed) >>> 0) % 15

    const nTemp1 = pOffsets[nIndex1]!
    const nTemp2 = pOffsets[nIndex2]!

    pOffsets[nIndex2] = nTemp1
    pOffsets[nIndex1] = nTemp2
  }

  let nCounter1 = Math.trunc(pLevel.nRooms / 5) + 1
  if (nCounter1 <= 2) {
    nCounter1 = 2
  }

  let nCounter2 = 2 * pLevel.nRooms

  while (nCounter1 && nCounter2) {
    const nLevelPrestId = pOffsets[nIndex]! + nBaseLvlPrest

    for (let pDrlgRoom = pLevel.pFirstRoomEx; pDrlgRoom; pDrlgRoom = pDrlgRoom.pDrlgRoomNext) {
      if (!DRLGMAZE_HasMapDS1(pDrlgRoom) && pDrlgRoom.pMaze!.nLevelPrest === nLevelPrestId) {
        pDrlgRoom.pMaze!.nLevelPrest = nLevelPrestId + 15
        pDrlgRoom.pMaze!.nPickedFile = -1
        pDrlgRoom.pMaze!.dwFlags |= DRLGPRESETROOMFLAG_HAS_MAP_DS1

        nCounter1 -= 1
        break
      }
    }

    nCounter2 -= 1
    nIndex = (nIndex + 1) % 15
  }
}

//D2Common.0x6FD7D130
export function DRLGMAZE_RollBasicPresets(pLevel: D2DrlgLevelStrc): void {
  let pDrlgRoom = pLevel.pFirstRoomEx
  while (pDrlgRoom) {
    const pNextRoomEx = pDrlgRoom.pDrlgRoomNext
    const pDrlgMap = DRLGPRESET_AllocDrlgMap(pLevel, pDrlgRoom.pMaze!.nLevelPrest, pDrlgRoom.pDrlgCoord, pLevel.pSeed)

    const nPickedFile = pDrlgRoom.pMaze!.nPickedFile
    if (nPickedFile === -1) {
      const nLevelDef = pDrlgMap.pLvlPrestTxtRecord.dwDef
      const nFiles = pDrlgMap.pLvlPrestTxtRecord.dwFiles
      let nLvlPrestId = 0

      switch (pLevel.nLevelType) {
        case LVLTYPE_ACT1_CAVE:
          nLvlPrestId = LVLPREST_ACT1_DOE_ENTRANCE
          break
        case LVLTYPE_ACT1_CRYPT:
          nLvlPrestId = LVLPREST_ACT1_GRAVEYARD
          break
        case LVLTYPE_ACT1_BARRACKS:
          nLvlPrestId = LVLPREST_ACT1_BARRACKS_COURT_CONNECT
          break
        case LVLTYPE_ACT1_JAIL:
          nLvlPrestId = LVLPREST_ACT1_BARRACKS_FORGE_N
          break
        case LVLTYPE_ACT1_CATACOMBS:
          nLvlPrestId = LVLPREST_ACT1_CATHEDRAL
          break
        case LVLTYPE_ACT2_SEWER:
          nLvlPrestId = LVLPREST_ACT2_TOWN
          break
        case LVLTYPE_ACT2_TOMB:
          nLvlPrestId = LVLPREST_ACT2_DESERT_RUINS_ELDER
          break
        case LVLTYPE_ACT2_LAIR:
          nLvlPrestId = LVLPREST_ACT2_DURIELS_LAIR
          break
        case LVLTYPE_ACT3_KURAST:
          nLvlPrestId = LVLPREST_ACT3_TEMPLE_6
          break
        case LVLTYPE_ACT3_DUNGEON:
          nLvlPrestId = LVLPREST_ACT3_SPIDER_CHEST_NE
          break
        case LVLTYPE_ACT3_SEWER:
          nLvlPrestId = LVLPREST_ACT3_DUNGEON_TREASURE_2
          break
        case LVLTYPE_ACT4_LAVA:
          nLvlPrestId = LVLPREST_ACT4_LAVA_X
          break
        case LVLTYPE_ACT5_ICE_CAVES:
          nLvlPrestId = LVLPREST_ACT5_BARRICADE_16_SNOW
          break
        case LVLTYPE_ACT5_BAAL:
          nLvlPrestId = LVLPREST_ACT5_LAVA_NS
          break
        case LVLTYPE_ACT5_LAVA:
          nLvlPrestId = LVLPREST_ACT5_TEMPLE_SW_WAYPOINT
          break
        default:
          nLvlPrestId = nLevelDef
          break
      }

      if (nLevelDef > nLvlPrestId && nLevelDef < nLvlPrestId + 16) {
        let pDrlgBuild: D2DrlgBuildStrc | null = pLevel.pBuild
        while (pDrlgBuild) {
          if (pDrlgBuild.nPreset === nLevelDef) break
          pDrlgBuild = pDrlgBuild.pNext
        }

        if (!pDrlgBuild) {
          pDrlgBuild = {
            nPreset: nLevelDef,
            nDivisor: nFiles,
            nRand: SEED_RollLimitedRandomNumber(pLevel.pSeed, nFiles),
            pNext: pLevel.pBuild,
          }
          pLevel.pBuild = pDrlgBuild
        }

        pDrlgBuild.nRand = (pDrlgBuild.nRand + 1) % pDrlgBuild.nDivisor
        pDrlgMap.nPickedFile = pDrlgBuild.nRand
      }
    } else {
      pDrlgMap.nPickedFile = nPickedFile
    }

    const pTemp = DRLGPRESET_BuildArea(
      pLevel,
      pDrlgMap,
      0,
      pDrlgRoom.pDrlgCoord.nWidth <= 12 && pDrlgRoom.pDrlgCoord.nHeight <= 12,
    )!

    for (let pDrlgOrth = pDrlgRoom.pDrlgOrth; pDrlgOrth; pDrlgOrth = pDrlgOrth.pNext) {
      if (pDrlgOrth.bInit === 1) {
        DRLGROOM_AllocDrlgOrthsForRooms(pTemp, pDrlgOrth.pDrlgRoom!, pDrlgOrth.nDirection)
      }
    }

    DRLGROOM_FreeRoomEx(pDrlgRoom)
    pDrlgRoom = pNextRoomEx
  }
}
